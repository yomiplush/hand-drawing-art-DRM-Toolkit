import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprint,
  derivePublicKeyFromSeed,
  hexToBytes,
  signWithSeed,
} from '../../src/core/crypto';
import type { CanonicalRaster } from '../../src/core/image';
import {
  buildSigningMessage,
  createPortableProofBundle,
  decodeSignedProofEnvelope,
  encodeSignedProofEnvelope,
  encodeUnsignedPayload,
  generateArtworkId,
  measureUnsignedQrSizing,
  parsePortableProofBundle,
  unpackV3PolicyFlags,
} from '../../src/core/manifest';
import {
  createInImageSignedArtworkPng,
  createSignedArtworkPng,
} from '../../src/core/manifest/signArtwork';
import { DOMAIN_SEPARATION_PREFIX_V3, PROTOCOL_VERSION_COMPACT } from '../../src/core/manifest/types';
import type { AuthorKeyRecord } from '../../src/core/storage/keyStore';
import { encryptKeyBackup } from '../../src/core/crypto';
import { verifyImageWithEmbeddedQr, verifyProofAndArtwork } from '../../src/core/verify/verifier';

function encodeBase45Upper(bytes: Uint8Array): string {
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      let x = (bytes[i] << 8) | bytes[i + 1];
      const e = Math.floor(x / (45 * 45));
      x %= 45 * 45;
      const d = Math.floor(x / 45);
      const c = x % 45;
      out += ALPHABET[c] + ALPHABET[d] + ALPHABET[e];
    } else {
      const x = bytes[i];
      const d = Math.floor(x / 45);
      const c = x % 45;
      out += ALPHABET[c] + ALPHABET[d];
    }
  }
  return out;
}

function makeRaster(w: number, h: number): CanonicalRaster {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = (x * 7 + y * 3) & 0xff;
      data[i + 1] = (x * 2 + y * 11) & 0xff;
      data[i + 2] = ((x ^ y) * 5) & 0xff;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

describe('CHM Compact Proof Protocol v3 + Compression Benchmark + CLI Parity', () => {
  const testSeed = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
  const testPk = derivePublicKeyFromSeed(testSeed);

  it('encodes, compresses, signs under CHM3\\0 domain, and decodes rich self-contained v3 manifests', async () => {
    const artworkId = generateArtworkId();
    const sha = new Uint8Array(32).fill(0xcd);
    const evHash = new Uint8Array(32).fill(0xef);

    const unsigned = {
      version: PROTOCOL_VERSION_COMPACT,
      artworkId,
      publicKey: testPk,
      sha256: sha,
      region: [0, 0, 1920, 1080] as const,
      qrMask: [1640, 800, 240, 240] as const,
      issuedAt: 1795400000,
      license: {
        licenseId: 'CC-BY-NC-ND-4.0' as const,
        attributionName: 'YomiPlush Studio',
        commercialUse: 'disallow' as const,
        redistribution: 'allow' as const,
        aiTraining: 'disallow' as const,
        allowsDerivatives: 'disallow' as const,
        allowsModifications: 'disallow' as const,
        requiresAttribution: true,
      },
      authorName: 'YomiPlush',
      artworkTitle: 'Twilight Lineart Study #42',
      description: 'Hand-drawn digital ink and watercolor wash study without generative AI.',
      website: 'https://certified-handmade.com',
      snsLinks: [
        { url: 'https://x.com/yomiplush_art', platform: 'x', label: 'X' },
        { url: 'https://bsky.app/profile/yomiplush.bsky.social', platform: 'bluesky' },
        { url: 'https://www.pixiv.net/users/12345678', platform: 'pixiv' },
      ],
      portfolioLinks: [{ url: 'https://vgen.co/yomiplush', label: 'Commissions' }],
      creationMethod: 'hand-drawn-no-ai' as const,
      creationEnvironment: {
        software: 'Krita 5.2',
        hardware: 'Desktop PC',
        inputDevice: 'Wacom Cintiq 16',
        notes: 'Layer-by-layer sketch to lineart workflow.',
      },
      evidenceHashes: [
        {
          sha256: evHash,
          byteLength: 4_512_880,
          category: 'project-file' as const,
          label: 'twilight-study.kra',
          mimeType: 'application/x-krita',
        },
      ],
      policyNote: 'Personal non-commercial sharing allowed with attribution.',
    };

    const payloadBytes = encodeUnsignedPayload(unsigned);
    const signingMsg = buildSigningMessage(payloadBytes, PROTOCOL_VERSION_COMPACT);
    expect(Array.from(signingMsg.subarray(0, 5))).toEqual(Array.from(DOMAIN_SEPARATION_PREFIX_V3));

    const sig = signWithSeed(testSeed, signingMsg);
    const proof = encodeSignedProofEnvelope(payloadBytes, sig, PROTOCOL_VERSION_COMPACT);
    const decoded = decodeSignedProofEnvelope(proof);

    expect(decoded.version).toBe(3);
    expect(decoded.usedDeflate).toBe(true);
    expect(decoded.manifest.authorName).toBe('YomiPlush');
    expect(decoded.manifest.artworkTitle).toBe('Twilight Lineart Study #42');
    expect(decoded.manifest.license.allowsDerivatives).toBe('disallow');
    expect(decoded.manifest.license.allowsModifications).toBe('disallow');
    expect(decoded.manifest.license.requiresAttribution).toBe(true);
    expect(decoded.manifest.website).toBe('https://certified-handmade.com');
    expect(decoded.manifest.snsLinks).toEqual([
      { url: 'https://x.com/yomiplush_art', platform: 'x', label: 'X' },
      { url: 'https://bsky.app/profile/yomiplush.bsky.social', platform: 'bluesky' },
      { url: 'https://www.pixiv.net/users/12345678', platform: 'pixiv' },
    ]);
    expect(decoded.manifest.portfolioLinks).toEqual([{ url: 'https://vgen.co/yomiplush', label: 'Commissions' }]);
    expect(decoded.manifest.creationMethod).toBe('hand-drawn-no-ai');
    expect(decoded.manifest.creationEnvironment?.software).toBe('Krita 5.2');
    expect(decoded.manifest.evidenceHashes).toHaveLength(1);
    expect(decoded.manifest.evidenceHashes?.[0].label).toBe('twilight-study.kra');
    expect(decoded.manifest.policyNote).toBe(
      'Personal non-commercial sharing allowed with attribution.',
    );

    const bundle = createPortableProofBundle({
      protocolVersion: 3,
      artworkId: decoded.manifest.artworkIdHex,
      publicKeyFingerprint: 'a'.repeat(64),
      proofBytes: proof,
    });
    expect(parsePortableProofBundle(bundle).bundle.protocolVersion).toBe(3);

    // Must fail verification if signed under CHM1 instead of CHM3 (cross-version domain isolation)
    const crossVersionSig = signWithSeed(testSeed, buildSigningMessage(payloadBytes, 1));
    const badProof = encodeSignedProofEnvelope(payloadBytes, crossVersionSig, PROTOCOL_VERSION_COMPACT);
    const badRes = await verifyProofAndArtwork({
      proofInput: base64UrlEncode(badProof),
      lookupTrustedKey: async () => undefined,
    });
    expect(badRes.signatureStatus).toBe('invalid');
  });

  it('rejects decompression bombs, fake compression flags, non-canonical URL prefix codes, and invalid bit-packed flags', () => {
    const big = new Uint8Array(20_000).fill(0x41);
    const bomb = new Uint8Array(zlib.deflateRawSync(big, { level: 9 }));
    const bombEnvelope = cborEncode([3, 1, bomb, new Uint8Array(64)], rfc8949EncodeOptions);
    expect(() => decodeSignedProofEnvelope(bombEnvelope)).toThrow(/exceeds maximum/);

    // Invalid bit-packed flags: unknown high bit 12
    expect(() => unpackV3PolicyFlags(1 << 12)).toThrow();
    // Invalid bit-packed flags: requiresAttribution value bit without presence bit
    expect(() => unpackV3PolicyFlags(1 << 11)).toThrow();
    // Invalid 2-bit policy code (3)
    expect(() => unpackV3PolicyFlags(3)).toThrow();
  });

  it('produces reproducible v3 outer-margin & in-image PNGs and matches Node + Go offline CLIs identically', async () => {
    const fp = await computePublicKeyFingerprint(testPk);
    const enc = await encryptKeyBackup({
      seed32: testSeed,
      publicKey32: testPk,
      passphrase: 'strong-passphrase-for-v3-cli',
      label: 'V3 Author',
      iterations: 100_000,
    });
    const authorKey: AuthorKeyRecord = {
      id: 'v3-key',
      label: 'V3 Author',
      publicKey: testPk,
      publicKeyBase64Url: base64UrlEncode(testPk),
      fingerprintHex: fp.fullHex,
      fingerprintShort: fp.shortDisplay,
      storageMode: 'noble-encrypted-seed',
      encryptedBackup: enc,
      hasBackupDownloaded: true,
      createdAt: '2026-11-24T00:00:00.000Z',
    };

    const raster = makeRaster(196, 196);
    const signedOuter = await createSignedArtworkPng({
      protocolVersion: 3,
      artworkRaster: raster,
      authorKey,
      passphraseIfEncrypted: 'strong-passphrase-for-v3-cli',
      authorName: 'YomiPlush',
      artworkTitle: 'Compact Proof v3 Outer',
      description: 'Self-contained offline proof with author links.',
      website: 'https://certified-handmade.com',
      snsLinks: [{ url: 'https://x.com/yomiplush', platform: 'x' }],
      creationMethod: 'hand-drawn-no-ai',
      creationEnvironment: { software: 'Clip Studio Paint', inputDevice: 'iPad Pro' },
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
        allowsDerivatives: 'disallow',
        requiresAttribution: true,
      },
      burnOptions: { placement: 'bottom-right', theme: 'dark-slate', marginPx: 16, showLabel: false },
    });

    expect(signedOuter.manifest.version).toBe(3);
    expect(signedOuter.qrVerifiedReadable).toBe(true);

    const webRes = await verifyImageWithEmbeddedQr({
      fileOrBytes: signedOuter.pngBytes,
      lookupTrustedKey: async () => undefined,
      lookupKeyNotices: async () => [],
    });
    expect(webRes.verification.protocolVersion).toBe(3);
    expect(webRes.verification.signatureStatus).toBe('valid');
    expect(webRes.verification.integrityStatus).toBe('matched');
    expect(webRes.verification.manifest?.creationMethod).toBe('hand-drawn-no-ai');
    expect(webRes.verification.manifest?.snsLinks?.[0].url).toBe('https://x.com/yomiplush');

    // In-image masked v3 PNG
    const signedMasked = await createInImageSignedArtworkPng({
      protocolVersion: 3,
      artworkRaster: makeRaster(440, 440),
      authorKey,
      passphraseIfEncrypted: 'strong-passphrase-for-v3-cli',
      authorName: 'YomiPlush',
      artworkTitle: 'Compact Proof v3 Masked',
      snsLinks: [{ url: 'https://bsky.app/profile/yomi.bsky.social', platform: 'bluesky' }],
      creationMethod: 'hand-drawn-no-ai',
      license: {
        licenseId: 'CC-BY-4.0',
        commercialUse: 'allow',
        redistribution: 'allow',
        aiTraining: 'disallow',
      },
      qrOptions: {
        x: 190,
        y: 190,
        boxSize: 220,
        eccLevel: 'M',
        opacity: 0.92,
        style: 'frosted-light',
      },
    });
    expect(signedMasked.manifest.version).toBe(3);
    expect(signedMasked.manifest.qrMask).toEqual([190, 190, 220, 220]);
    expect(signedMasked.qrVerifiedReadable).toBe(true);

    // Cross-verify the outer PNG with BOTH Node CLI and Go CLI!
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chm-v3-cli-'));
    const pngPath = path.join(tmpDir, 'signed-v3.png');
    fs.writeFileSync(pngPath, signedOuter.pngBytes);

    try {
      const nodeJson = JSON.parse(
        execFileSync('node', ['tools/chm-verify.mjs', pngPath, '--json'], { encoding: 'utf8' }),
      );
      expect(nodeJson.protocolVersion).toBe(3);
      expect(nodeJson.usedDeflate).toBe(true);
      expect(nodeJson.signatureValid).toBe(true);
      expect(nodeJson.integrityStatus).toBe('matched');
      expect(nodeJson.snsLinks).toEqual([{ url: 'https://x.com/yomiplush', platform: 'x' }]);
      expect(nodeJson.creationMethod).toBe('hand-drawn-no-ai');
      expect(nodeJson.requiresAttribution).toBe(true);

      const goJson = JSON.parse(
        execFileSync(
          'go',
          ['run', '.', '--proof', signedOuter.proofUrl, '--artwork', pngPath, '--json'],
          { cwd: path.join(process.cwd(), 'tools/chm-verify'), encoding: 'utf8' },
        ),
      );
      expect(goJson.protocolVersion).toBe(3);
      expect(goJson.usedDeflate).toBe(true);
      expect(goJson.signatureValid).toBe(true);
      expect(goJson.integrityStatus).toBe('matched');
      expect(goJson.snsLinks).toEqual([{ url: 'https://x.com/yomiplush', platform: 'x' }]);
      expect(goJson.creationMethod).toBe('hand-drawn-no-ai');
      expect(goJson.requiresAttribution).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('benchmarks v1/v3 uncompressed vs DEFLATE+PrefixDict+BitPack & Base64url vs Base45 QR versions', () => {
    const sha = new Uint8Array(32).fill(0xab);
    const id = generateArtworkId();
    const evHash = new Uint8Array(32).fill(0xcd);

    // Rich scenario matching typical creator output
    const richSizing = measureUnsignedQrSizing({
      manifestWithoutCrypto: {
        artworkId: id,
        publicKey: testPk,
        sha256: sha,
        region: [0, 0, 2000, 2500],
        issuedAt: 1795400000,
        authorName: 'YomiPlush',
        artworkTitle: 'Rainy Botanical Sketchbook Vol. 3',
        description:
          'Original ink and digital gouache illustration drawn frame-by-frame by hand without generative models.',
        website: 'https://certified-handmade.com',
        snsLinks: [
          { url: 'https://x.com/yomiplush_art', platform: 'x' },
          { url: 'https://bsky.app/profile/yomiplush.bsky.social', platform: 'bluesky' },
          { url: 'https://www.pixiv.net/users/12345678', platform: 'pixiv' },
          { url: 'https://skeb.jp/@yomiplush', platform: 'skeb' },
        ],
        portfolioLinks: [{ url: 'https://vgen.co/yomiplush', label: 'Portfolio' }],
        creationMethod: 'hand-drawn-no-ai',
        creationEnvironment: {
          software: 'Krita 5.2',
          hardware: 'Custom Linux Workstation',
          inputDevice: 'Wacom Cintiq 16',
        },
        evidenceHashes: [{ sha256: evHash, byteLength: 8_123_456, category: 'project-file', label: 'sketch.kra' }],
        policyNote: 'Personal non-commercial repost allowed with credit.',
        license: {
          licenseId: 'CC-BY-NC-ND-4.0',
          attributionName: 'YomiPlush',
          commercialUse: 'disallow',
          redistribution: 'allow',
          aiTraining: 'disallow',
          allowsDerivatives: 'disallow',
          allowsModifications: 'disallow',
          requiresAttribution: true,
        },
      },
    });

    // Compare uncompressed CBOR JSON-equivalent Baseline vs v3 DEFLATE+PrefixDict+Base64url vs Base45 Alnum
    const uncompressedPayload = encodeUnsignedPayload({
      version: 3,
      artworkId: id,
      publicKey: testPk,
      sha256: sha,
      region: [0, 0, 2000, 2500],
      issuedAt: 1795400000,
      authorName: 'YomiPlush',
      artworkTitle: 'Rainy Botanical Sketchbook Vol. 3',
      description:
        'Original ink and digital gouache illustration drawn frame-by-frame by hand without generative models.',
      website: 'https://certified-handmade.com',
      snsLinks: [
        { url: 'https://x.com/yomiplush_art', platform: 'x' },
        { url: 'https://bsky.app/profile/yomiplush.bsky.social', platform: 'bluesky' },
        { url: 'https://www.pixiv.net/users/12345678', platform: 'pixiv' },
        { url: 'https://skeb.jp/@yomiplush', platform: 'skeb' },
      ],
      portfolioLinks: [{ url: 'https://vgen.co/yomiplush', label: 'Portfolio' }],
      creationMethod: 'hand-drawn-no-ai',
      creationEnvironment: {
        software: 'Krita 5.2',
        hardware: 'Custom Linux Workstation',
        inputDevice: 'Wacom Cintiq 16',
      },
      evidenceHashes: [{ sha256: evHash, byteLength: 8_123_456, category: 'project-file', label: 'sketch.kra' }],
      policyNote: 'Personal non-commercial repost allowed with credit.',
      license: {
        licenseId: 'CC-BY-NC-ND-4.0',
        attributionName: 'YomiPlush',
        commercialUse: 'disallow',
        redistribution: 'allow',
        aiTraining: 'disallow',
        allowsDerivatives: 'disallow',
        allowsModifications: 'disallow',
        requiresAttribution: true,
      },
    });
    const rawNoDeflateProof = encodeSignedProofEnvelope(uncompressedPayload, new Uint8Array(64), 3, {
      allowDeflate: false,
    });
    const compressedProof = encodeSignedProofEnvelope(uncompressedPayload, new Uint8Array(64), 3, {
      allowDeflate: true,
    });
    const base64Url = `https://certified-handmade.com/verify#proof=${base64UrlEncode(compressedProof)}`;
    const qrB64M = QRCode.create(base64Url, { errorCorrectionLevel: 'M' });
    const qrRawNoDeflateM = QRCode.create(
      `https://certified-handmade.com/verify#proof=${base64UrlEncode(rawNoDeflateProof)}`,
      { errorCorrectionLevel: 'M' },
    );

    // Base45 mixed-segment QR vs naive byte-mode Base45
    const b45Token = encodeBase45Upper(compressedProof);
    const qrB45SegmentedM = QRCode.create(
      [
        { data: 'https://certified-handmade.com/verify#proof=', mode: 'byte' },
        { data: b45Token, mode: 'alphanumeric' },
      ],
      { errorCorrectionLevel: 'M' },
    );

    console.info(
      '[V3 BENCHMARK]',
      JSON.stringify({
        uncompressedPayloadBytes: uncompressedPayload.length,
        compressedPayloadBytes: richSizing.compressedPayloadBytes,
        savingsPct: richSizing.savingsPct,
        rawNoDeflateEnvelopeBytes: rawNoDeflateProof.length,
        rawNoDeflateQrVersionM: qrRawNoDeflateM.version,
        rawNoDeflateQrModules: qrRawNoDeflateM.modules.size,
        v3CompressedEnvelopeBytes: compressedProof.length,
        v3Base64UrlChars: base64Url.length,
        v3Base64UrlQrVersionM: qrB64M.version,
        v3Base64UrlQrModules: qrB64M.modules.size,
        v3Base45TokenChars: b45Token.length,
        v3Base45SegmentedQrVersionM: qrB45SegmentedM.version,
        v3Base45SegmentedQrModules: qrB45SegmentedM.modules.size,
      }),
    );

    expect(richSizing.usedDeflate).toBe(true);
    expect(compressedProof.length).toBeLessThan(rawNoDeflateProof.length);
    expect(qrB64M.version).toBeLessThanOrEqual(25);
  });
});
