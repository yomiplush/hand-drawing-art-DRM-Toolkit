import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  bytesToHex,
  computePublicKeyFingerprint,
  derivePublicKeyFromSeed,
  encryptKeyBackup,
  hexToBytes,
  sha256,
  sha256Streamed,
  signWithSeed,
} from '../../src/core/crypto';
import type { CanonicalRaster } from '../../src/core/image';
import {
  EVIDENCE_EXTENSION_FORMAT,
  EVIDENCE_EXTENSION_VERSION,
  EVIDENCE_TOKEN_PREFIX,
  UnsupportedEvidenceVersionError,
  buildEvidenceSigningMessage,
  createPortableEvidenceBundle,
  createSignedEvidenceExtension,
  decodeSignedEvidenceEnvelope,
  encodeSignedEvidenceEnvelope,
  encodeUnsignedEvidencePayload,
  extractEvidenceBytesFromInput,
  extractProofBytesFromInput,
  isLikelyEvidenceExtensionText,
  parsePortableEvidenceBundle,
  sanitizeEvidenceBasename,
  sanitizeProfileUrl,
} from '../../src/core/manifest';
import { createSignedArtworkPng } from '../../src/core/manifest/signArtwork';
import type { AuthorKeyRecord } from '../../src/core/storage/keyStore';
import { verifyEvidenceExtension } from '../../src/core/verify/evidenceVerifier';
import { verifyProofAndArtwork } from '../../src/core/verify/verifier';

function makeTestRaster(w = 128, h = 96): CanonicalRaster {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = (x * 7 + y * 3) & 0xff;
      data[i + 1] = (x * 5 + y * 11) & 0xff;
      data[i + 2] = (x ^ y) & 0xff;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const DEFAULT_BURN_OPTIONS = {
  placement: 'bottom-right' as const,
  theme: 'dark-slate' as const,
  marginPx: 16,
  showLabel: false,
};

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
    passphrase: 'evidence-unit-test-pass-2026',
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
      createdAt: '2026-11-24T00:00:00.000Z',
    },
  };
}

describe('Evidence Extension (.chmevidence), Compact QR, Modes A/B/C & Security', () => {
  const seedHexA = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
  const seedHexB = '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb';

  it('keeps embedded QR byte length and QR matrix version completely unchanged (0-byte QR bloat)', async () => {
    const alice = await makeSigningIdentity(seedHexA, 'Compact QR Test Artist');
    const raster = makeTestRaster(160, 120);

    const baseLicense = {
      licenseId: 'ARR' as const,
      commercialUse: 'disallow' as const,
      redistribution: 'disallow' as const,
      aiTraining: 'disallow' as const,
    };

    const minimalSigned = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: alice.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      license: baseLicense,
      burnOptions: DEFAULT_BURN_OPTIONS,
    });

    const signedWithRichExt = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: alice.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      license: baseLicense,
      burnOptions: DEFAULT_BURN_OPTIONS,
    });

    const qrMin = QRCode.create(minimalSigned.proofUrl, { errorCorrectionLevel: 'M' });
    const qrWithExt = QRCode.create(signedWithRichExt.proofUrl, { errorCorrectionLevel: 'M' });

    expect(signedWithRichExt.proofBytes.length).toBe(minimalSigned.proofBytes.length);
    expect(signedWithRichExt.proofUrl.length).toBe(minimalSigned.proofUrl.length);
    expect(qrWithExt.version).toBe(qrMin.version);
    expect(qrWithExt.modules.size).toBe(qrMin.modules.size);

    const richExt = await createSignedEvidenceExtension({
      proofBytes: signedWithRichExt.proofBytes,
      manifest: signedWithRichExt.manifest,
      authorKey: alice.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      publicKeyFingerprintHex: alice.record.fingerprintHex,
      details: {
        artworkMetadata: {
          title: '月光のアトリエ / Moonlit Atelier 🎨',
          artistName: 'YomiPlush',
          description:
            'Hand-inked illustration drawn over two evenings.\nIncludes multi-script UTF-8: 日本語・한국어・العربية・Українська.',
        },
        creatorProfile: {
          displayName: 'YomiPlush Studio',
          website: 'https://certified-handmade.com',
          links: [
            { url: 'https://pixiv.net/users/12345', label: 'Pixiv' },
            { url: 'https://misskey.io/@yomiplush', label: 'Fediverse' },
            { url: 'https://portfolio.example.org/gallery' },
          ],
        },
        creationMethod: 'hand-drawn-no-ai',
        creationEnvironment: {
          software: 'Krita 5.2',
          hardware: 'iPad Pro / Linux Workstation',
          inputDevice: 'Apple Pencil & Wacom Intuos',
          notes: 'Single raster layer paint-over from pencil scan.',
        },
        evidenceRecords: [
          {
            sha256: await sha256(new Uint8Array([1, 2, 3, 4])),
            byteLength: 4,
            label: 'rough-sketch.kra',
            category: 'project-file',
            mimeType: 'application/x-krita',
          },
          {
            sha256: await sha256(new Uint8Array([5, 6, 7, 8, 9])),
            byteLength: 5,
            label: 'timelapse.mp4',
            category: 'timelapse',
            mimeType: 'video/mp4',
          },
        ],
      },
    });

    // Extended data lives inside .chmevidence, never inflating the QR token
    expect(richExt.evidenceBytes.length).toBeGreaterThan(250);
    expect(signedWithRichExt.proofBytes.length).toBeLessThan(260);
  });

  it('supports multilingual UTF-8, arbitrary profile URLs, creation methods, 1-layer & 0-evidence, and rejects unsafe inputs', () => {
    expect(sanitizeProfileUrl('https://art.example.jp/作品?id=1#top')).toBe(
      'https://art.example.jp/作品?id=1#top',
    );
    expect(sanitizeProfileUrl('http://localhost:8080/artist')).toBe('http://localhost:8080/artist');
    expect(() => sanitizeProfileUrl('javascript:alert(1)')).toThrow();
    expect(() => sanitizeProfileUrl('data:text/html,<script>alert(1)</script>')).toThrow();
    expect(() => sanitizeProfileUrl('file:///etc/passwd')).toThrow();
    expect(() => sanitizeProfileUrl('https://user:pass@example.com/a')).toThrow();
    expect(() => sanitizeProfileUrl('https://example.com/has space')).toThrow();

    expect(sanitizeEvidenceBasename('/Users/artist/Documents/My Secret WIP/sketch_01.png')).toBe(
      'sketch_01.png',
    );
    expect(sanitizeEvidenceBasename('C:\\Users\\artist\\work\\draft.psd')).toBe('draft.psd');

    const dummyId = new Uint8Array(16).fill(1);
    const dummyPub = new Uint8Array(32).fill(2);
    const dummySha = new Uint8Array(32).fill(3);

    expect(() =>
      encodeUnsignedEvidencePayload({
        version: EVIDENCE_EXTENSION_VERSION,
        evidenceId: dummyId,
        publicKey: dummyPub,
        proofSha256: dummySha,
        artworkId: dummyId,
        artworkSha256: dummySha,
        issuedAt: 1795352786,
        artworkMetadata: { title: 'Bad\u202EOverride' },
      }),
    ).toThrow();

    expect(() =>
      encodeUnsignedEvidencePayload({
        version: EVIDENCE_EXTENSION_VERSION,
        evidenceId: dummyId,
        publicKey: dummyPub,
        proofSha256: dummySha,
        artworkId: dummyId,
        artworkSha256: dummySha,
        issuedAt: 1795352786,
        artworkMetadata: { title: 'NUL\x00Title' },
      }),
    ).toThrow();

    const htmlLiteral = '<script>alert("xss")</script> & <b>Bold</b>';
    const payloadBytes = encodeUnsignedEvidencePayload({
      version: EVIDENCE_EXTENSION_VERSION,
      evidenceId: dummyId,
      publicKey: dummyPub,
      proofSha256: dummySha,
      artworkId: dummyId,
      artworkSha256: dummySha,
      issuedAt: 1795352786,
      artworkMetadata: { title: htmlLiteral, description: 'Line 1\r\nLine 2' },
      creationMethod: 'prefer-not-to-disclose',
    });
    const env = encodeSignedEvidenceEnvelope(payloadBytes, new Uint8Array(64).fill(9));
    const decoded = decodeSignedEvidenceEnvelope(env);
    expect(decoded.extension.artworkMetadata?.title).toBe(htmlLiteral);
    expect(decoded.extension.artworkMetadata?.description).toBe('Line 1\nLine 2');
    expect(decoded.extension.creationMethod).toBe('prefer-not-to-disclose');

    const v99 = cborEncode([99, payloadBytes, new Uint8Array(64)], rfc8949EncodeOptions);
    expect(() => decodeSignedEvidenceEnvelope(v99)).toThrow(UnsupportedEvidenceVersionError);
  });

  it('computes chunked streaming SHA-256 identically to one-shot SHA-256 and enforces size bounds', async () => {
    const buf = new Uint8Array(200 * 1024);
    for (let i = 0; i < buf.length; i++) buf[i] = (i * 31 + 7) & 0xff;

    const expected = await sha256(buf);
    const blob = new Blob([buf]);
    const progressCalls: number[] = [];
    const streamed = await sha256Streamed(blob, {
      chunkSize: 64 * 1024,
      onProgress: (processed) => progressCalls.push(processed),
    });

    expect(streamed.digest).toEqual(expected);
    expect(streamed.hex).toBe(bytesToHex(expected));
    expect(streamed.byteLength).toBe(buf.length);
    expect(progressCalls.length).toBeGreaterThanOrEqual(4);
    expect(progressCalls[progressCalls.length - 1]).toBe(buf.length);

    await expect(sha256Streamed(blob, { maxBytes: 1000 })).rejects.toThrow();
  });

  it('verifies Modes A/B/C, detects tampered extensions, prevents cross-proof replay, and rejects standalone .chmevidence', async () => {
    const alice = await makeSigningIdentity(seedHexA, 'Alice Key');
    const bob = await makeSigningIdentity(seedHexB, 'Bob Key');
    const raster = makeTestRaster(120, 96);

    const baseLicense = {
      licenseId: 'ARR' as const,
      commercialUse: 'disallow' as const,
      redistribution: 'disallow' as const,
      aiTraining: 'disallow' as const,
    };

    const proofA = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: alice.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      license: baseLicense,
      burnOptions: DEFAULT_BURN_OPTIONS,
    });
    const proofB = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: alice.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      license: baseLicense,
      burnOptions: DEFAULT_BURN_OPTIONS,
    });
    const proofBob = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey: bob.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      license: baseLicense,
      burnOptions: DEFAULT_BURN_OPTIONS,
    });

    const sketchBytes = new TextEncoder().encode('SKETCH-LAYER-1');
    const timelapseBytes = new TextEncoder().encode('TIMELAPSE-VIDEO-STREAM');
    const wrongBytes = new TextEncoder().encode('TAMPERED-FILE');

    const ext = await createSignedEvidenceExtension({
      proofBytes: proofA.proofBytes,
      manifest: proofA.manifest,
      authorKey: alice.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      publicKeyFingerprintHex: alice.record.fingerprintHex,
      details: {
        artworkMetadata: { title: 'Test Artwork' },
        creationMethod: 'ai-generated',
        evidenceRecords: [
          {
            sha256: await sha256(sketchBytes),
            byteLength: sketchBytes.length,
            label: 'sketch.kra',
            category: 'sketch',
          },
          {
            sha256: await sha256(timelapseBytes),
            byteLength: timelapseBytes.length,
            label: 'process.mp4',
            category: 'timelapse',
          },
        ],
      },
    });

    const bundleJson = JSON.stringify(ext.bundle);
    expect(isLikelyEvidenceExtensionText(bundleJson)).toBe(true);
    expect(isLikelyEvidenceExtensionText(ext.token)).toBe(true);
    expect(isLikelyEvidenceExtensionText(proofA.proofUrl)).toBe(false);

    expect(() => extractProofBytesFromInput(bundleJson)).toThrow();
    expect(() => extractProofBytesFromInput(ext.token)).toThrow();

    const standaloneRes = await verifyEvidenceExtension({
      evidenceInput: bundleJson,
      proofBytes: null,
      manifest: null,
    });
    expect(standaloneRes.status).toBe('missing-primary-proof');

    const modeARes = await verifyEvidenceExtension({
      evidenceInput: '',
      proofBytes: proofA.proofBytes,
      manifest: proofA.manifest,
    });
    expect(modeARes.status).toBe('none');

    const modeBRes = await verifyEvidenceExtension({
      evidenceInput: bundleJson,
      proofBytes: proofA.proofBytes,
      manifest: proofA.manifest,
    });
    expect(modeBRes.status).toBe('valid');
    expect(modeBRes.signatureValid).toBe(true);
    expect(modeBRes.proofBindingValid).toBe(true);
    expect(modeBRes.verifiedRecordCount).toBe(0);
    expect(modeBRes.unavailableRecordCount).toBe(2);
    expect(modeBRes.recordChecks.every((r) => r.status === 'unavailable')).toBe(true);

    const modeCPartial = await verifyEvidenceExtension({
      evidenceInput: ext.token,
      proofBytes: proofA.proofBytes,
      manifest: proofA.manifest,
      suppliedEvidenceFiles: [{ name: 'sketch.kra', data: sketchBytes }],
    });
    expect(modeCPartial.status).toBe('valid');
    expect(modeCPartial.verifiedRecordCount).toBe(1);
    expect(modeCPartial.unavailableRecordCount).toBe(1);
    expect(modeCPartial.mismatchedSuppliedFiles).toHaveLength(0);

    const modeCMismatch = await verifyEvidenceExtension({
      evidenceInput: bundleJson,
      proofBytes: proofA.proofBytes,
      manifest: proofA.manifest,
      suppliedEvidenceFiles: [
        { name: 'sketch.kra', data: sketchBytes },
        { name: 'wrong.mp4', data: wrongBytes },
      ],
    });
    expect(modeCMismatch.status).toBe('valid');
    expect(modeCMismatch.verifiedRecordCount).toBe(1);
    expect(modeCMismatch.unavailableRecordCount).toBe(1);
    expect(modeCMismatch.mismatchedSuppliedFiles).toHaveLength(1);
    expect(modeCMismatch.mismatchedSuppliedFiles[0].fileName).toBe('wrong.mp4');

    const replaySameArtist = await verifyEvidenceExtension({
      evidenceInput: bundleJson,
      proofBytes: proofB.proofBytes,
      manifest: proofB.manifest,
    });
    expect(replaySameArtist.status).toBe('binding-mismatch');
    expect(replaySameArtist.signatureValid).toBe(true);
    expect(replaySameArtist.proofBindingValid).toBe(false);
    expect(replaySameArtist.proofSha256MatchesProof).toBe(false);

    const replayOtherArtist = await verifyEvidenceExtension({
      evidenceInput: bundleJson,
      proofBytes: proofBob.proofBytes,
      manifest: proofBob.manifest,
    });
    expect(replayOtherArtist.status).toBe('binding-mismatch');
    expect(replayOtherArtist.publicKeyMatchesProof).toBe(false);

    const tamperedBytes = new Uint8Array(ext.evidenceBytes);
    tamperedBytes[tamperedBytes.length - 1] ^= 0xff;
    const tamperedToken = `${EVIDENCE_TOKEN_PREFIX}${base64UrlEncode(tamperedBytes)}`;
    const tamperedRes = await verifyEvidenceExtension({
      evidenceInput: tamperedToken,
      proofBytes: proofA.proofBytes,
      manifest: proofA.manifest,
    });
    expect(tamperedRes.status).toBe('invalid');
    expect(tamperedRes.signatureValid).toBe(false);

    const parsedBundle = parsePortableEvidenceBundle(
      createPortableEvidenceBundle({
        artworkId: proofA.manifest.artworkIdHex,
        proofSha256Hex: bytesToHex(await sha256(proofA.proofBytes)),
        publicKeyFingerprint: alice.record.fingerprintHex,
        evidenceBytes: ext.evidenceBytes,
      }),
    );
    expect(parsedBundle.bundle.format).toBe(EVIDENCE_EXTENSION_FORMAT);
    expect(extractEvidenceBytesFromInput(ext.token)).toEqual(ext.evidenceBytes);
  });

  it('produces deterministic .chmevidence vector and passes identical Node & Go CLI verification', async () => {
    const normativeV1Token =
      'gwFYk6gBUAEjRWeJq83vQSOBI0VniasCWCDXWpgBgrEKt9VL_tPJZAc6DuFy89qmIyWvAhpo9wdRGgNYIOYBn-Qcdjc2CrkMicM4sdyGR2bHrbtIuWCr2UY3JcV6BIQYGBgYAgIFGmsC6NIGhQQCAQJpWW9taVBsdXNoB2lZb21pUGx1c2gIb1Rlc3QgVmVjdG9yIDJ4MlhA3h7ocTKymomonxlUtWughyq7B7fzi78F3nP6fQBk8heiLtPIFoAA1VKwTpKs3J2TENjLeO-TLlmt63GsaWjUBA';
    const normativeV2Token =
      'gwJYlakBUP7cuph2VEMhgSNFZ4mrze8CWCDXWpgBgrEKt9VL_tPJZAc6DuFy89qmIyWvAhpo9wdRGgNYIL4T1EuxOwqo0mye468j4PtYPeqalKJhFPOd7lqlJZjzBIQAABgYGBgFGmsC6NIGhAACAgIHaVlvbWlQbHVzaAh1VGVzdCBWZWN0b3IgdjIgTWFza2VkCYQCAhUVWECCwvqH-yEO5EbIQlDNGeWAaR5d2Qyvzmbmd4tsSiDL2Wn1GAD3TWlZMeuWQtoajg5gONB9W_C_5dAYSeXxZ34D';

    const alice = await makeSigningIdentity(seedHexA, 'Normative Vector Artist');
    const proofCheck = await verifyProofAndArtwork({
      proofInput: normativeV1Token,
      artworkRaster: null,
      lookupTrustedKey: async () => undefined,
    });
    expect(proofCheck.manifest).not.toBeNull();
    expect(proofCheck.proofBytes).not.toBeNull();

    const evidenceFile1 = new TextEncoder().encode('CHM-NORMATIVE-SKETCH-VECTOR-1');
    const evidenceFile2 = new TextEncoder().encode('CHM-NORMATIVE-TIMELAPSE-VECTOR-2');
    const wrongEvidenceFile = new TextEncoder().encode('CHM-WRONG-FILE');

    const detExt = await createSignedEvidenceExtension({
      proofBytes: proofCheck.proofBytes!,
      manifest: proofCheck.manifest!,
      authorKey: alice.record,
      passphraseIfEncrypted: 'evidence-unit-test-pass-2026',
      publicKeyFingerprintHex: alice.record.fingerprintHex,
      evidenceId: hexToBytes('11112222333344448555666677778888'),
      issuedAt: 1795352800,
      customSigner: (msg) => signWithSeed(alice.seed32, msg),
      details: {
        artworkMetadata: {
          title: 'Normative Extended Vector 🎨',
          artistName: 'YomiPlush',
          description: 'Deterministic vector line 1\nDeterministic vector line 2',
        },
        creatorProfile: {
          displayName: 'YomiPlush Studio',
          website: 'https://certified-handmade.com',
          links: [
            { url: 'https://example.org/portfolio', label: 'Portfolio' },
            { url: 'https://social.example/@yomi' },
          ],
        },
        creationMethod: 'hand-drawn-no-ai',
        creationEnvironment: {
          software: 'Krita',
          hardware: 'Linux workstation',
          inputDevice: 'Wacom pen tablet',
          notes: 'Scanned pencil underdrawing',
        },
        evidenceRecords: [
          {
            sha256: await sha256(evidenceFile1),
            byteLength: evidenceFile1.length,
            label: 'sketch.png',
            category: 'sketch',
            mimeType: 'image/png',
          },
          {
            sha256: await sha256(evidenceFile2),
            byteLength: evidenceFile2.length,
            label: 'timelapse.mp4',
            category: 'timelapse',
            mimeType: 'video/mp4',
          },
        ],
      },
    });

    const prefix = new TextDecoder().decode(buildEvidenceSigningMessage(new Uint8Array()).slice(0, 14));
    expect(prefix).toBe('CHM-EVIDENCE1\0');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chm-ext-cli-'));
    const nodeCli = path.resolve(process.cwd(), 'tools/chm-verify.mjs');
    const goDir = path.resolve(process.cwd(), 'tools/chm-verify');

    try {
      const extPath = path.join(tmpDir, 'vector.chmevidence');
      const f1Path = path.join(tmpDir, 'sketch.png');
      const wrongPath = path.join(tmpDir, 'wrong.bin');
      fs.writeFileSync(extPath, JSON.stringify(detExt.bundle, null, 2));
      fs.writeFileSync(f1Path, evidenceFile1);
      fs.writeFileSync(wrongPath, wrongEvidenceFile);

      const nodeJsonRaw = execFileSync(
        'node',
        [nodeCli, '--proof', normativeV1Token, '--evidence', extPath, '--evidence-file', f1Path, '--json'],
        { encoding: 'utf8' },
      );
      const goJsonRaw = execFileSync(
        'go',
        ['run', '.', '--proof', normativeV1Token, '--evidence', extPath, '--evidence-file', f1Path, '--json'],
        { cwd: goDir, encoding: 'utf8' },
      );

      const nodeJson = JSON.parse(nodeJsonRaw);
      const goJson = JSON.parse(goJsonRaw);

      expect(nodeJson.evidenceExtension.status).toBe('valid');
      expect(goJson.evidenceExtension.status).toBe('valid');
      expect(goJson.evidenceExtension.evidenceId).toBe(nodeJson.evidenceExtension.evidenceId);
      expect(goJson.evidenceExtension.proofSha256Hex).toBe(nodeJson.evidenceExtension.proofSha256Hex);
      expect(nodeJson.evidenceExtension.verifiedRecordCount).toBe(1);
      expect(goJson.evidenceExtension.verifiedRecordCount).toBe(1);
      expect(nodeJson.evidenceExtension.unavailableRecordCount).toBe(1);
      expect(goJson.evidenceExtension.unavailableRecordCount).toBe(1);
      expect(nodeJson.evidenceExtension.creationMethod).toBe('hand-drawn-no-ai');
      expect(goJson.evidenceExtension.creationMethod).toBe('hand-drawn-no-ai');
      expect(nodeJson.evidenceExtension.mismatchedSuppliedFiles).toHaveLength(0);
      expect(goJson.evidenceExtension.mismatchedSuppliedFiles).toHaveLength(0);

      expect(() =>
        execFileSync('node', [nodeCli, '--evidence', extPath], { stdio: 'pipe' }),
      ).toThrow();
      expect(() =>
        execFileSync('go', ['run', '.', '--evidence', extPath], { cwd: goDir, stdio: 'pipe' }),
      ).toThrow();

      expect(() =>
        execFileSync('node', [nodeCli, '--proof', normativeV2Token, '--evidence', extPath], {
          stdio: 'pipe',
        }),
      ).toThrow();
      expect(() =>
        execFileSync('go', ['run', '.', '--proof', normativeV2Token, '--evidence', extPath], {
          cwd: goDir,
          stdio: 'pipe',
        }),
      ).toThrow();

      expect(() =>
        execFileSync(
          'node',
          [nodeCli, '--proof', normativeV1Token, '--evidence', extPath, '--evidence-file', wrongPath],
          { stdio: 'pipe' },
        ),
      ).toThrow();
      expect(() =>
        execFileSync(
          'go',
          ['run', '.', '--proof', normativeV1Token, '--evidence', extPath, '--evidence-file', wrongPath],
          { cwd: goDir, stdio: 'pipe' },
        ),
      ).toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 60_000);
});
