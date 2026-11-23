import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprint,
  createKeyChallenge,
  decryptKeyBackup,
  derivePublicKeyFromSeed,
  encryptKeyBackup,
  evaluatePassphraseStrength,
  hexToBytes,
  signKeyChallenge,
  signWithSeed,
  verifyEd25519Signature,
  verifyKeyChallengeResponse,
} from '../../src/core/crypto';
import {
  comparePerceptualHashes,
  computeMaskCoverageStats,
  computePerceptualHashes,
  recommendInImageBoxSize,
} from '../../src/core/image';
import type { CanonicalRaster } from '../../src/core/image';
import {
  buildSigningMessage,
  createSignedKeyNotice,
  decodeSignedKeyNoticeEnvelope,
  encodeSignedProofEnvelope,
  encodeUnsignedPayload,
  extractProofBytesFromInput,
  generateArtworkId,
  sanitizeVerifyBaseUrl,
  verifyKeyNoticeInput,
} from '../../src/core/manifest';
import { createSignedArtworkPng } from '../../src/core/manifest/signArtwork';
import type { AuthorKeyRecord } from '../../src/core/storage/keyStore';
import { verifyProofAndArtwork } from '../../src/core/verify/verifier';

function makeTestRaster(w: number, h: number, variant: 'gradient' | 'checker' = 'gradient'): CanonicalRaster {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (variant === 'gradient') {
        data[i] = Math.round((x / Math.max(1, w - 1)) * 220) + 15;
        data[i + 1] = Math.round((y / Math.max(1, h - 1)) * 200) + 20;
        data[i + 2] = ((x * 3 + y * 5) & 0x7f) + 40;
      } else {
        const block = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) * 210 + 20;
        data[i] = block;
        data[i + 1] = 240 - block;
        data[i + 2] = (x ^ y) & 0xff;
      }
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

async function makeSigningIdentity(seedHex: string, label: string): Promise<{
  seed32: Uint8Array;
  record: AuthorKeyRecord;
}> {
  const seed32 = hexToBytes(seedHex);
  const publicKey = derivePublicKeyFromSeed(seed32);
  const fp = await computePublicKeyFingerprint(publicKey);
  const encryptedBackup = await encryptKeyBackup({
    seed32,
    publicKey32: publicKey,
    passphrase: 'test-passphrase-strong-2026',
    label,
    iterations: 100_000,
  });
  return {
    seed32,
    record: {
      id: `test-${fp.shortDisplay}`,
      label,
      publicKey,
      publicKeyBase64Url: base64UrlEncode(publicKey),
      fingerprintHex: fp.fullHex,
      fingerprintShort: fp.shortDisplay,
      storageMode: 'noble-encrypted-seed',
      encryptedBackup,
      hasBackupDownloaded: true,
      createdAt: '2026-11-23T00:00:00.000Z',
    },
  };
}

describe('Phase 2–7 Security, Trust & Protocol Hardening', () => {
  it('evaluates passphrase strength and rejects tampered AES-GCM backup metadata', async () => {
    expect(evaluatePassphraseStrength('abc').score).toBe('too-short');
    expect(evaluatePassphraseStrength('abcdefgh').score).toBe('fair');
    expect(evaluatePassphraseStrength('correct-horse-2026!').score).toBe('strong');
    expect(evaluatePassphraseStrength('aaaaaaaaaaaa').score).toBe('fair');

    const seed32 = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    const pub32 = derivePublicKeyFromSeed(seed32);

    await expect(
      encryptKeyBackup({ seed32, publicKey32: pub32, passphrase: 'short', label: 'bad', iterations: 100_000 }),
    ).rejects.toThrow();

    const backup = await encryptKeyBackup({
      seed32,
      publicKey32: pub32,
      passphrase: 'very-strong-passphrase-2026',
      label: 'Artist Backup',
      iterations: 100_000,
    });

    // Tampered fingerprint fails verification
    const badFp = { ...backup, fingerprint: '0'.repeat(64) };
    await expect(decryptKeyBackup(badFp, 'very-strong-passphrase-2026')).rejects.toThrow();

    // Tampered salt breaks AES-GCM auth tag
    const badSalt = { ...backup, salt: base64UrlEncode(new Uint8Array(16).fill(9)) };
    await expect(decryptKeyBackup(badSalt, 'very-strong-passphrase-2026')).rejects.toThrow();
  });

  it('rejects all-zero / small-order Ed25519 keys and prevents cross-domain signature reuse', async () => {
    const seed32 = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    const pub32 = derivePublicKeyFromSeed(seed32);
    const msg = new TextEncoder().encode('hello');
    const sig = signWithSeed(seed32, msg);

    const allZeroKey = new Uint8Array(32);
    const smallOrderPoint = new Uint8Array(32);
    smallOrderPoint[0] = 1; // Ed25519 identity point (order 1)

    expect(await verifyEd25519Signature(allZeroKey, msg, sig)).toBe(false);
    expect(await verifyEd25519Signature(allZeroKey, msg, new Uint8Array(64))).toBe(false);
    expect(await verifyEd25519Signature(smallOrderPoint, msg, new Uint8Array(64))).toBe(false);
    expect(await verifyEd25519Signature(pub32, msg, new Uint8Array(63))).toBe(false);

    // Cross-domain separation: manifest payload signed under CHM1\0 cannot verify under CHM-NOTICE1\0
    const payload = encodeUnsignedPayload({
      version: 1,
      artworkId: generateArtworkId(),
      publicKey: pub32,
      sha256: new Uint8Array(32).fill(1),
      region: [0, 0, 10, 10],
      issuedAt: 1795352786,
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 16,
        showLabel: false,
      },
    });
    const manifestSig = signWithSeed(seed32, buildSigningMessage(payload));
    const manifestProof = encodeSignedProofEnvelope(payload, manifestSig, 1);
    expect(() => decodeSignedKeyNoticeEnvelope(manifestProof)).toThrow();
  });

  it('verifies revocation & dual-sig rotation notices while keeping historical artwork proofs intact', async () => {
    const oldId = await makeSigningIdentity(
      '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
      'Old Key',
    );
    const newId = await makeSigningIdentity(
      '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
      'New Key',
    );

    const revNotice = await createSignedKeyNotice({
      noticeType: 'revocation',
      subjectPublicKey: oldId.record.publicKey,
      signWithSubjectKey: async (m) => signWithSeed(oldId.seed32, m),
      reason: 'retired',
      note: 'Migrated to hardware token',
      noticeIssuedAt: 1795352800,
    });
    expect(revNotice.token.startsWith('chm-notice:')).toBe(true);

    const verifiedRev = await verifyKeyNoticeInput(revNotice.token, 1795359999);
    expect(verifiedRev.valid).toBe(true);
    expect(verifiedRev.noticeIssuedAt).toBe(1795352800);
    expect(verifiedRev.verifiedAt).toBe(1795359999);
    expect(verifiedRev.notice.noticeType).toBe('revocation');

    // Dual-sig rotation
    const rotNotice = await createSignedKeyNotice({
      noticeType: 'rotation',
      subjectPublicKey: oldId.record.publicKey,
      signWithSubjectKey: async (m) => signWithSeed(oldId.seed32, m),
      replacementPublicKey: newId.record.publicKey,
      signWithReplacementKey: async (m) => signWithSeed(newId.seed32, m),
      reason: 'key-superseded',
      noticeIssuedAt: 1795353000,
    });
    const verifiedRot = await verifyKeyNoticeInput(JSON.stringify(rotNotice.bundle));
    expect(verifiedRot.valid).toBe(true);
    expect(verifiedRot.replacementFingerprintHex).toBe(newId.record.fingerprintHex);

    // Reject same-key rotation
    await expect(
      createSignedKeyNotice({
        noticeType: 'rotation',
        subjectPublicKey: oldId.record.publicKey,
        signWithSubjectKey: async (m) => signWithSeed(oldId.seed32, m),
        replacementPublicKey: oldId.record.publicKey,
        signWithReplacementKey: async (m) => signWithSeed(oldId.seed32, m),
        reason: 'key-superseded',
      }),
    ).rejects.toThrow();

    // Sign artwork with old key, verify without notices -> 'none-local', then with revocation notice -> 'revocation-notice' while signature stays 'valid'
    const raster = makeTestRaster(96, 96);
    const signedArt = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: oldId.record,
      passphraseIfEncrypted: 'test-passphrase-strong-2026',
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 16,
        showLabel: false,
      },
    });

    const withoutNotice = await verifyProofAndArtwork({
      proofInput: signedArt.proofUrl,
      artworkRaster: raster,
      lookupTrustedKey: async () => undefined,
      lookupKeyNotices: async () => [],
    });
    expect(withoutNotice.signatureStatus).toBe('valid');
    expect(withoutNotice.integrityStatus).toBe('matched');
    expect(withoutNotice.keyNoticeStatus).toBe('none-local');

    const withNotice = await verifyProofAndArtwork({
      proofInput: signedArt.proofUrl,
      artworkRaster: raster,
      lookupTrustedKey: async () => undefined,
      lookupKeyNotices: async () => [
        {
          id: verifiedRev.notice.noticeIdHex,
          noticeType: 'revocation',
          reason: 'retired',
          subjectPublicKeyBase64Url: verifiedRev.subjectPublicKeyBase64Url,
          subjectFingerprintHex: verifiedRev.subjectFingerprintHex,
          subjectFingerprintShort: verifiedRev.subjectFingerprintShort,
          noticeIssuedAt: verifiedRev.noticeIssuedAt,
          importedAt: '2026-11-23T00:00:00.000Z',
          token: verifiedRev.token,
        },
      ],
    });
    expect(withNotice.signatureStatus).toBe('valid');
    expect(withNotice.integrityStatus).toBe('matched');
    expect(withNotice.keyNoticeStatus).toBe('revocation-notice');
    expect(withNotice.keyNotices).toHaveLength(1);
  });

  it('completes offline key-possession challenge-response and rejects wrong keys or tampering', async () => {
    const alice = await makeSigningIdentity(
      '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
      'Alice',
    );
    const bob = await makeSigningIdentity(
      '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
      'Bob',
    );

    const ch = await createKeyChallenge({
      targetPublicKey32: alice.record.publicKey,
      note: 'Identity check 2026',
    });
    expect(ch.challengeToken.startsWith('chm-challenge:')).toBe(true);

    const signedResp = await signKeyChallenge({
      challengeInput: ch.challengeToken,
      signerPublicKey32: alice.record.publicKey,
      signFn: async (m) => signWithSeed(alice.seed32, m),
    });

    const verified = await verifyKeyChallengeResponse({
      challengeInput: ch.challengeToken,
      responseInput: signedResp.responseToken,
    });
    expect(verified.valid).toBe(true);
    expect(verified.provesKeyPossessionOnly).toBe(true);
    expect(verified.provesRealWorldIdentity).toBe(false);

    // Signing challenge with wrong key must fail
    await expect(
      signKeyChallenge({
        challengeInput: ch.challengeToken,
        signerPublicKey32: bob.record.publicKey,
        signFn: async (m) => signWithSeed(bob.seed32, m),
      }),
    ).rejects.toThrow();

    // Cross-checking against another fresh challenge (different nonce) must fail
    const ch2 = await createKeyChallenge({ targetPublicKey32: alice.record.publicKey });
    const crossCheck = await verifyKeyChallengeResponse({
      challengeInput: ch2.challengeToken,
      responseInput: signedResp.responseToken,
    });
    expect(crossCheck.valid).toBe(false);
  });

  it('computes non-cryptographic perceptual similarity and qrMask safety coverage stats', () => {
    const a = makeTestRaster(128, 128, 'gradient');
    const aPerturbed: CanonicalRaster = {
      width: a.width,
      height: a.height,
      data: a.data.map((v, idx) => (idx % 4 === 3 ? v : Math.min(255, Math.max(0, v + ((idx % 5) - 2))))),
    };
    const distinct = makeTestRaster(128, 128, 'checker');

    const ha = computePerceptualHashes(a);
    const hap = computePerceptualHashes(aPerturbed);
    const hd = computePerceptualHashes(distinct);

    const sameCmp = comparePerceptualHashes(ha, ha);
    expect(sameCmp.combinedSimilarityPct).toBe(100);
    expect(sameCmp.band).toBe('high');
    expect(sameCmp.isCryptographic).toBe(false);

    const perturbedCmp = comparePerceptualHashes(ha, hap);
    expect(perturbedCmp.combinedSimilarityPct).toBeGreaterThanOrEqual(85);
    expect(perturbedCmp.band).toBe('high');

    const diffCmp = comparePerceptualHashes(ha, hd);
    expect(diffCmp.band).toBe('low');

    expect(computeMaskCoverageStats(100, 100, [0, 0, 30, 30]).tier).toBe('ok'); // 9%
    expect(computeMaskCoverageStats(100, 100, [0, 0, 45, 45]).tier).toBe('caution'); // 20.25%
    expect(computeMaskCoverageStats(100, 100, [0, 0, 60, 60]).tier).toBe('high'); // 36%

    const optSize = recommendInImageBoxSize({ artWidth: 600, artHeight: 600, qrModules: 45, quietZoneModules: 1 });
    expect(optSize).toBeGreaterThanOrEqual(64);
    expect(optSize).toBeLessThanOrEqual(600);
  });

  it('rejects malformed URLs, credentials, oversized proof inputs, and control chars in metadata', () => {
    expect(() => sanitizeVerifyBaseUrl('//evil.example/verify')).toThrow();
    expect(() => sanitizeVerifyBaseUrl('https://user:pass@certified-handmade.com/verify')).toThrow();
    expect(() => sanitizeVerifyBaseUrl('http://remote.example/verify')).toThrow();
    expect(sanitizeVerifyBaseUrl('https://certified-handmade.com/verify?foo=bar#x')).toBe(
      'https://certified-handmade.com/verify',
    );
    expect(sanitizeVerifyBaseUrl('http://127.0.0.1:43777/verify')).toBe('http://127.0.0.1:43777/verify');

    expect(() => extractProofBytesFromInput('')).toThrow();
    expect(() => extractProofBytesFromInput('https://certified-handmade.com/verify%23proof=%ZZ')).toThrow();
    expect(() => extractProofBytesFromInput('A'.repeat(33_000))).toThrow();
    expect(() => extractProofBytesFromInput('not a url or token!')).toThrow();

    const pub32 = derivePublicKeyFromSeed(
      hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'),
    );
    expect(() =>
      encodeUnsignedPayload({
        version: 1,
        artworkId: generateArtworkId(),
        publicKey: pub32,
        sha256: new Uint8Array(32),
        region: [0, 0, 10, 10],
        issuedAt: 1795352786,
        authorName: 'Bad\nAuthor',
        license: {
          licenseId: 'ARR',
          commercialUse: 'disallow',
          redistribution: 'disallow',
          aiTraining: 'disallow',
        },
      }),
    ).toThrow();
  });

  it('runs independent Node CLI tools/chm-verify.mjs with zero src/ imports', async () => {
    const cliPath = path.resolve(process.cwd(), 'tools/chm-verify.mjs');
    const cliSource = fs.readFileSync(cliPath, 'utf8');
    expect(cliSource).not.toMatch(/['"]\.\.?\/src\b/);

    const alice = await makeSigningIdentity(
      '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
      'CLI Test Artist',
    );
    const raster = makeTestRaster(120, 96);
    const signed = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: alice.record,
      passphraseIfEncrypted: 'test-passphrase-strong-2026',
      authorName: 'CLI Artist',
      artworkTitle: 'CLI Vector',
      license: {
        licenseId: 'CC-BY-4.0',
        commercialUse: 'allow',
        redistribution: 'allow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 16,
        showLabel: false,
      },
    });
    const revNotice = await createSignedKeyNotice({
      noticeType: 'revocation',
      subjectPublicKey: alice.record.publicKey,
      signWithSubjectKey: async (m) => signWithSeed(alice.seed32, m),
      reason: 'retired',
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chm-cli-test-'));
    try {
      const signedPng = path.join(tmpDir, 'signed.png');
      const noticeJson = path.join(tmpDir, 'notice.chnotice.json');
      fs.writeFileSync(signedPng, signed.pngBytes);
      fs.writeFileSync(noticeJson, JSON.stringify(revNotice.bundle, null, 2));

      const pngOut = execFileSync('node', [cliPath, signedPng, '--json'], { encoding: 'utf8' });
      const parsedPng = JSON.parse(pngOut);
      expect(parsedPng.signatureValid).toBe(true);
      expect(parsedPng.integrityStatus).toBe('matched');
      expect(parsedPng.protocolVersion).toBe(1);

      const noticeOut = execFileSync('node', [cliPath, '--notice', noticeJson, '--json'], {
        encoding: 'utf8',
      });
      const parsedNotice = JSON.parse(noticeOut);
      expect(parsedNotice.valid).toBe(true);
      expect(parsedNotice.noticeType).toBe('revocation');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
