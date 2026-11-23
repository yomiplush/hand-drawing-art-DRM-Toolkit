import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprint,
  derivePublicKeyFromSeed,
  encryptKeyBackup,
  hexToBytes,
} from '../../src/core/crypto';
import { decodePngToCanonicalRgba8, encodeCanonicalRgba8ToPng } from '../../src/core/image';
import type { CanonicalRaster } from '../../src/core/image';
import type { FrameTheme, QrPlacement } from '../../src/core/image/qrBurner';
import { createPortableProofBundle } from '../../src/core/manifest/proofBundle';
import {
  createInImageSignedArtworkPng,
  createSignedArtworkPng,
} from '../../src/core/manifest/signArtwork';
import type { AuthorKeyRecord, TrustedKeyRecord } from '../../src/core/storage/keyStore';
import { verifyImageWithEmbeddedQr, verifyProofAndArtwork } from '../../src/core/verify/verifier';

function makePatternRaster(width: number, height: number, withTransparency = false): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 7 + y * 3) & 0xff;
      data[i + 1] = (x * 2 + y * 11) & 0xff;
      data[i + 2] = (x * 5 + y * 13) & 0xff;
      data[i + 3] = withTransparency ? ((x + y) % 5 === 0 ? 0 : (x * 17) & 0xff) : 255;
    }
  }
  return { width, height, data };
}

async function makeTestAuthorKey(seedHex: string, label = 'Test Artist'): Promise<AuthorKeyRecord> {
  const seed32 = hexToBytes(seedHex);
  const publicKey = derivePublicKeyFromSeed(seed32);
  const fp = await computePublicKeyFingerprint(publicKey);
  const encryptedBackup = await encryptKeyBackup({
    seed32,
    publicKey32: publicKey,
    passphrase: 'test-passphrase-123',
    label,
    iterations: 100_000,
  });
  return {
    id: 'test-key-1',
    label,
    publicKey,
    publicKeyBase64Url: base64UrlEncode(publicKey),
    fingerprintHex: fp.fullHex,
    fingerprintShort: fp.shortDisplay,
    storageMode: 'noble-encrypted-seed',
    encryptedBackup,
    hasBackupDownloaded: true,
    createdAt: '2026-11-22T00:00:00.000Z',
  };
}

describe('End-to-end signing, QR burning, PNG encoding, QR decoding & verification', () => {
  const seedHex = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
  const otherSeedHex = '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb';

  it('signs a transparent artwork, burns QR into PNG, decodes QR, and verifies pixels & trust', async () => {
    const authorKey = await makeTestAuthorKey(seedHex, 'YomiPlush');
    const artwork = makePatternRaster(128, 128, true);

    const signed = await createSignedArtworkPng({
      artworkRaster: artwork,
      authorKey,
      passphraseIfEncrypted: 'test-passphrase-123',
      authorName: 'YomiPlush',
      artworkTitle: 'Transparent Alpha Test',
      license: {
        licenseId: 'CC-BY-NC-SA-4.0',
        attributionName: 'YomiPlush',
        commercialUse: 'disallow',
        redistribution: 'allow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 24,
        showLabel: false,
      },
      issuedAt: 1795352786,
    });

    expect(signed.qrVerifiedReadable).toBe(true);

    // Verify signed PNG directly (without trusted key first)
    const unknownRes = await verifyImageWithEmbeddedQr({
      fileOrBytes: signed.pngBytes,
      lookupTrustedKey: async () => undefined,
    });

    expect(unknownRes.verification.signatureStatus).toBe('valid');
    expect(unknownRes.verification.integrityStatus).toBe('matched');
    expect(unknownRes.verification.matchedMode).toBe('embedded-region');
    expect(unknownRes.verification.identityStatus).toBe('unknown');
    expect(unknownRes.verification.manifest?.authorName).toBe('YomiPlush');
    expect(unknownRes.verification.manifest?.license.licenseId).toBe('CC-BY-NC-SA-4.0');

    // Proof URL without image -> integrity not-checked
    const proofOnlyRes = await verifyProofAndArtwork({
      proofInput: signed.proofUrl,
      artworkRaster: null,
      lookupTrustedKey: async () => undefined,
    });
    expect(proofOnlyRes.signatureStatus).toBe('valid');
    expect(proofOnlyRes.integrityStatus).toBe('not-checked');

    // Portable .chproof.json bundle works identically offline
    const bundleJson = JSON.stringify(
      createPortableProofBundle({
        protocolVersion: 1,
        artworkId: signed.manifest.artworkIdHex,
        publicKeyFingerprint: authorKey.fingerprintHex,
        proofBytes: signed.proofBytes,
      }),
    );
    const bundleVerifyRes = await verifyProofAndArtwork({
      proofInput: bundleJson,
      artworkRaster: artwork,
      lookupTrustedKey: async () => undefined,
    });
    expect(bundleVerifyRes.signatureStatus).toBe('valid');
    expect(bundleVerifyRes.integrityStatus).toBe('matched');

    // Verify with trusted key store
    const trustedRecord: TrustedKeyRecord = {
      publicKeyBase64Url: authorKey.publicKeyBase64Url,
      publicKey: authorKey.publicKey,
      fingerprintHex: authorKey.fingerprintHex,
      fingerprintShort: authorKey.fingerprintShort,
      label: 'Verified Studio Key',
      addedAt: '2026-11-22T00:00:00.000Z',
    };
    const trustedRes = await verifyImageWithEmbeddedQr({
      fileOrBytes: signed.pngBytes,
      lookupTrustedKey: async (pk) =>
        base64UrlEncode(pk) === trustedRecord.publicKeyBase64Url ? trustedRecord : undefined,
    });
    expect(trustedRes.verification.identityStatus).toBe('locally-trusted');
    expect(trustedRes.verification.trustedKeyLabel).toBe('Verified Studio Key');

    // Also verify standalone original un-margined artwork against proof URL
    const standaloneRes = await verifyProofAndArtwork({
      proofInput: signed.proofUrl,
      artworkRaster: artwork,
      lookupTrustedKey: async () => undefined,
    });
    expect(standaloneRes.signatureStatus).toBe('valid');
    expect(standaloneRes.integrityStatus).toBe('matched');
    expect(standaloneRes.matchedMode).toBe('full-artwork');
  });

  it('embeds semi-transparent in-image QR (Protocol v2), decodes it, and verifies pixels outside qrMask', async () => {
    const authorKey = await makeTestAuthorKey(seedHex, 'YomiPlush');
    const artwork = makePatternRaster(400, 320, false);

    const signed = await createInImageSignedArtworkPng({
      artworkRaster: artwork,
      authorKey,
      passphraseIfEncrypted: 'test-passphrase-123',
      authorName: 'YomiPlush',
      artworkTitle: 'Translucent Overlay',
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      qrOptions: {
        x: 24,
        y: 24,
        boxSize: 180,
        opacity: 0.65,
        style: 'frosted-light',
        eccLevel: 'Q',
      },
      issuedAt: 1795352786,
    });

    expect(signed.manifest.version).toBe(2);
    expect(signed.manifest.qrMask).toEqual([24, 24, 180, 180]);
    expect(signed.qrVerifiedReadable).toBe(true);

    // Verify pixels outside qrMask remained bit-for-bit untouched
    for (let i = 0; i < 4; i++) {
      expect(signed.raster.data[i]).toBe(artwork.data[i]);
    }

    // Exported in-image QR PNG verifies end-to-end
    const embeddedRes = await verifyImageWithEmbeddedQr({
      fileOrBytes: signed.pngBytes,
      lookupTrustedKey: async () => undefined,
    });
    expect(embeddedRes.verification.protocolVersion).toBe(2);
    expect(embeddedRes.verification.signatureStatus).toBe('valid');
    expect(embeddedRes.verification.integrityStatus).toBe('matched');
    expect(embeddedRes.verification.matchedMode).toBe('in-image-masked');

    // Clean original artwork ALSO verifies against proof URL!
    const cleanOrigRes = await verifyProofAndArtwork({
      proofInput: signed.proofUrl,
      artworkRaster: artwork,
      lookupTrustedKey: async () => undefined,
    });
    expect(cleanOrigRes.signatureStatus).toBe('valid');
    expect(cleanOrigRes.integrityStatus).toBe('matched');
    expect(cleanOrigRes.matchedMode).toBe('in-image-masked');

    // Tampering 1 pixel outside qrMask triggers Mismatched!
    const mutated = new Uint8Array(artwork.data);
    mutated[0] ^= 0x01;
    const tamperedRes = await verifyProofAndArtwork({
      proofInput: signed.proofUrl,
      artworkRaster: { width: artwork.width, height: artwork.height, data: mutated },
      lookupTrustedKey: async () => undefined,
    });
    expect(tamperedRes.signatureStatus).toBe('valid');
    expect(tamperedRes.integrityStatus).toBe('mismatched');
  });

  it('flags ultra-low-opacity unreadable in-image QR via qrVerifiedReadable and decodes small in-image QRs on >2.5 MP canvases', async () => {
    const authorKey = await makeTestAuthorKey(seedHex, 'YomiPlush');

    // Low-opacity dark-glass over busy pattern -> qrVerifiedReadable === false
    const smallArt = makePatternRaster(300, 300, false);
    const faintSigned = await createInImageSignedArtworkPng({
      artworkRaster: smallArt,
      authorKey,
      passphraseIfEncrypted: 'test-passphrase-123',
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      qrOptions: {
        x: 20,
        y: 20,
        boxSize: 160,
        opacity: 0.08,
        style: 'transparent-tint',
        eccLevel: 'M',
      },
      issuedAt: 1795352786,
    });
    expect(faintSigned.qrVerifiedReadable).toBe(false);

    // High-res > 2.5 MP canvas (2200 x 1600 = 3.52 MP) with compact in-image QR offset away from exact edges
    const bigArt = makePatternRaster(2200, 1600, false);
    const bigSigned = await createInImageSignedArtworkPng({
      artworkRaster: bigArt,
      authorKey,
      passphraseIfEncrypted: 'test-passphrase-123',
      authorName: 'HighRes Artist',
      license: {
        licenseId: 'CC-BY-4.0',
        commercialUse: 'allow',
        redistribution: 'allow',
        aiTraining: 'disallow',
      },
      qrOptions: {
        x: 740,
        y: 520,
        boxSize: 200,
        opacity: 0.9,
        style: 'frosted-light',
        eccLevel: 'Q',
      },
      issuedAt: 1795352786,
    });
    expect(bigSigned.qrVerifiedReadable).toBe(true);

    const bigVerified = await verifyImageWithEmbeddedQr({
      fileOrBytes: bigSigned.pngBytes,
      lookupTrustedKey: async () => undefined,
    });
    expect(bigVerified.verification.signatureStatus).toBe('valid');
    expect(bigVerified.verification.integrityStatus).toBe('matched');
    expect(bigVerified.verification.matchedMode).toBe('in-image-masked');
  });

  it('detects tampered artwork pixels while keeping signature valid', async () => {
    const authorKey = await makeTestAuthorKey(seedHex);
    const artwork = makePatternRaster(160, 120, false);

    const signed = await createSignedArtworkPng({
      artworkRaster: artwork,
      authorKey,
      passphraseIfEncrypted: 'test-passphrase-123',
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'pure-white',
        marginPx: 20,
        showLabel: false,
      },
    });

    // Mutate 1 pixel inside the artwork region
    const decoded = decodePngToCanonicalRgba8(signed.pngBytes);
    const [rx, ry] = signed.manifest.region;
    const targetByte = ((ry + 10) * decoded.width + (rx + 10)) * 4;
    decoded.data[targetByte] ^= 0x01;
    const tamperedPng = encodeCanonicalRgba8ToPng(decoded);

    const res = await verifyImageWithEmbeddedQr({
      fileOrBytes: tamperedPng,
      lookupTrustedKey: async () => undefined,
    });
    expect(res.verification.signatureStatus).toBe('valid');
    expect(res.verification.integrityStatus).toBe('mismatched');
  });

  it('detects tampered proof URLs and unrecognized keys', async () => {
    const authorKey = await makeTestAuthorKey(seedHex);
    const otherKey = await makeTestAuthorKey(otherSeedHex, 'Other Artist');
    const artwork = makePatternRaster(96, 96);

    const signed = await createSignedArtworkPng({
      artworkRaster: artwork,
      authorKey,
      passphraseIfEncrypted: 'test-passphrase-123',
      license: {
        licenseId: 'CC0-1.0',
        commercialUse: 'allow',
        redistribution: 'allow',
        aiTraining: 'unspecified',
      },
      burnOptions: {
        placement: 'bottom-center',
        theme: 'dark-slate',
        marginPx: 16,
        showLabel: false,
      },
    });

    // Tamper 1 char inside proof fragment
    const prefix = signed.proofUrl.slice(0, signed.proofUrl.length - 5);
    const lastFive = signed.proofUrl.slice(signed.proofUrl.length - 5);
    const flipped = (lastFive[0] === 'A' ? 'B' : 'A') + lastFive.slice(1);
    const badProofRes = await verifyProofAndArtwork({
      proofInput: prefix + flipped,
      artworkRaster: artwork,
    });
    expect(badProofRes.signatureStatus).toBe('invalid');

    // Different trusted key does NOT match authorKey
    const otherRes = await verifyProofAndArtwork({
      proofInput: signed.proofUrl,
      artworkRaster: artwork,
      lookupTrustedKey: async (pk) =>
        base64UrlEncode(pk) === otherKey.publicKeyBase64Url
          ? {
              publicKeyBase64Url: otherKey.publicKeyBase64Url,
              publicKey: otherKey.publicKey,
              fingerprintHex: otherKey.fingerprintHex,
              fingerprintShort: otherKey.fingerprintShort,
              label: 'Other Artist',
              addedAt: '2026-11-22T00:00:00.000Z',
            }
          : undefined,
    });
    expect(otherRes.signatureStatus).toBe('valid');
    expect(otherRes.identityStatus).toBe('unknown');
  });

  it('works across minimum, portrait, landscape, high-res, transparent-margin, and max-payload cases', async () => {
    const authorKey = await makeTestAuthorKey(seedHex);

    const cases: Array<{
      name: string;
      w: number;
      h: number;
      placement: QrPlacement;
      theme: FrameTheme;
      maxPayload?: boolean;
    }> = [
      { name: 'minimum-16x16', w: 16, h: 16, placement: 'bottom-center', theme: 'dark-slate' },
      { name: 'portrait-400x1600', w: 400, h: 1600, placement: 'bottom-left', theme: 'pure-white' },
      { name: 'landscape-1600x400', w: 1600, h: 400, placement: 'top-right', theme: 'transparent-margin' },
      { name: 'highres-2400x1800', w: 2400, h: 1800, placement: 'bottom-right', theme: 'dark-slate' },
      {
        name: 'max-utf8-payload',
        w: 320,
        h: 240,
        placement: 'bottom-right',
        theme: 'dark-slate',
        maxPayload: true,
      },
    ];

    for (const c of cases) {
      const raster = makePatternRaster(c.w, c.h, c.theme === 'transparent-margin');
      const signed = await createSignedArtworkPng({
        artworkRaster: raster,
        authorKey,
        passphraseIfEncrypted: 'test-passphrase-123',
        authorName: c.maxPayload ? 'A'.repeat(48) : 'Artist',
        artworkTitle: c.maxPayload ? 'B'.repeat(64) : c.name,
        license: {
          licenseId: 'CC-BY-4.0',
          attributionName: c.maxPayload ? 'C'.repeat(48) : undefined,
          commercialUse: 'allow',
          redistribution: 'allow',
          aiTraining: 'disallow',
        },
        burnOptions: {
          placement: c.placement,
          theme: c.theme,
          marginPx: 24,
          showLabel: false,
        },
      });

      const verified = await verifyImageWithEmbeddedQr({
        fileOrBytes: signed.pngBytes,
        lookupTrustedKey: async () => undefined,
      });

      expect(verified.verification.signatureStatus, c.name).toBe('valid');
      expect(verified.verification.integrityStatus, c.name).toBe('matched');
      expect(verified.verification.matchedMode, c.name).toBe('embedded-region');
    }
  });
});
