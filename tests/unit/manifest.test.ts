import { encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  derivePublicKeyFromSeed,
  hexToBytes,
  signWithSeed,
  verifyEd25519Signature,
} from '../../src/core/crypto';
import {
  UnsupportedProtocolVersionError,
  buildProofUrl,
  buildSigningMessage,
  createPortableProofBundle,
  decodeSignedProofEnvelope,
  encodeSignedProofEnvelope,
  encodeUnsignedPayload,
  extractProofBytesFromInput,
  generateArtworkId,
  parsePortableProofBundle,
  sanitizeVerifyBaseUrl,
} from '../../src/core/manifest';
import { PROTOCOL_VERSION, PROTOCOL_VERSION_MASKED } from '../../src/core/manifest/types';
import { verifyProofAndArtwork } from '../../src/core/verify/verifier';

describe('Manifest deterministic CBOR encoding & proof URL handling', () => {
  const testSeed = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
  const testPk = derivePublicKeyFromSeed(testSeed);
  const testHash = new Uint8Array(32).fill(0xab);

  it('encodes, signs, and decodes a v1 manifest deterministically', async () => {
    const artworkId = generateArtworkId();
    const unsigned = {
      version: PROTOCOL_VERSION,
      artworkId,
      publicKey: testPk,
      sha256: testHash,
      region: [24, 24, 1200, 900] as const,
      issuedAt: 1795352786,
      license: {
        licenseId: 'CC-BY-NC-4.0' as const,
        attributionName: 'YomiPlush',
        commercialUse: 'disallow' as const,
        redistribution: 'allow' as const,
        aiTraining: 'disallow' as const,
      },
      authorName: 'YomiPlush',
      artworkTitle: 'Starlight Sketch',
    };

    const payloadBytes = encodeUnsignedPayload(unsigned);
    const sig = signWithSeed(testSeed, buildSigningMessage(payloadBytes));
    const proof = encodeSignedProofEnvelope(payloadBytes, sig);
    const url = buildProofUrl(proof);

    expect(url.startsWith('https://certified-handmade.com/verify#proof=')).toBe(true);
    expect(proof.length).toBeLessThan(350);

    const extracted = extractProofBytesFromInput(url);
    expect(extracted).toEqual(proof);

    const decoded = decodeSignedProofEnvelope(extracted);
    expect(decoded.version).toBe(1);
    expect(decoded.manifest.authorName).toBe('YomiPlush');
    expect(decoded.manifest.artworkTitle).toBe('Starlight Sketch');
    expect(decoded.manifest.license.licenseId).toBe('CC-BY-NC-4.0');
    expect(decoded.manifest.license.aiTraining).toBe('disallow');
    expect(decoded.manifest.region).toEqual([24, 24, 1200, 900]);
    expect(decoded.manifest.qrMask).toBeUndefined();

    const ok = await verifyEd25519Signature(
      decoded.manifest.publicKey,
      buildSigningMessage(decoded.payloadBytes),
      decoded.signature,
    );
    expect(ok).toBe(true);
  });

  it('encodes, signs, and decodes a v2 in-image masked manifest with qrMask', async () => {
    const artworkId = generateArtworkId();
    const unsigned = {
      version: PROTOCOL_VERSION_MASKED,
      artworkId,
      publicKey: testPk,
      sha256: testHash,
      region: [0, 0, 800, 600] as const,
      qrMask: [580, 380, 180, 180] as const,
      issuedAt: 1795352786,
      license: {
        licenseId: 'ARR' as const,
        commercialUse: 'disallow' as const,
        redistribution: 'disallow' as const,
        aiTraining: 'disallow' as const,
      },
      authorName: 'YomiPlush',
    };

    const payloadBytes = encodeUnsignedPayload(unsigned);
    const sig = signWithSeed(testSeed, buildSigningMessage(payloadBytes));
    const proof = encodeSignedProofEnvelope(payloadBytes, sig, PROTOCOL_VERSION_MASKED);
    const decoded = decodeSignedProofEnvelope(proof);

    expect(decoded.version).toBe(2);
    expect(decoded.manifest.region).toEqual([0, 0, 800, 600]);
    expect(decoded.manifest.qrMask).toEqual([580, 380, 180, 180]);

    // Rejects qrMask on v1 or out-of-bounds qrMask on v2
    expect(() =>
      encodeUnsignedPayload({
        ...unsigned,
        version: PROTOCOL_VERSION,
      }),
    ).toThrow();
    expect(() =>
      encodeUnsignedPayload({
        ...unsigned,
        qrMask: [700, 380, 180, 180],
      }),
    ).toThrow();
  });

  it('round-trips optional .chproof.json portable proof bundles without altering signed bytes', () => {
    const artworkId = generateArtworkId();
    const payloadBytes = encodeUnsignedPayload({
      version: PROTOCOL_VERSION,
      artworkId,
      publicKey: testPk,
      sha256: testHash,
      region: [24, 24, 300, 300],
      issuedAt: 1795352786,
      license: {
        licenseId: 'CC0-1.0',
        commercialUse: 'allow',
        redistribution: 'allow',
        aiTraining: 'unspecified',
      },
    });
    const sig = signWithSeed(testSeed, buildSigningMessage(payloadBytes));
    const proofBytes = encodeSignedProofEnvelope(payloadBytes, sig);

    const bundle = createPortableProofBundle({
      protocolVersion: 1,
      artworkId: '01234567-89ab-cdef-4123-8123456789ab',
      publicKeyFingerprint: 'deadbeef'.repeat(8),
      proofBytes,
    });

    const parsed = parsePortableProofBundle(bundle);
    expect(parsed.proofBytes).toEqual(proofBytes);
    expect(extractProofBytesFromInput(JSON.stringify(bundle))).toEqual(proofBytes);

    // Reject malformed bundle inputs
    expect(() => parsePortableProofBundle({ ...bundle, format: 'wrong' })).toThrow();
    expect(() => parsePortableProofBundle({ ...bundle, version: 2 })).toThrow();
    expect(() => parsePortableProofBundle({ ...bundle, proofBase64Url: 'bad+char' })).toThrow();
    expect(() => extractProofBytesFromInput('{not-json')).toThrow();
  });

  it('matches the normative SPEC.md v1 test vector', async () => {
    const token =
      'gwFYk6gBUAEjRWeJq83vQSOBI0VniasCWCDXWpgBgrEKt9VL_tPJZAc6DuFy89qmIyWvAhpo9wdRGgNYIOYBn-Qcdjc2CrkMicM4sdyGR2bHrbtIuWCr2UY3JcV6BIQYGBgYAgIFGmsC6NIGhQQCAQJpWW9taVBsdXNoB2lZb21pUGx1c2gIb1Rlc3QgVmVjdG9yIDJ4MlhA3h7ocTKymomonxlUtWughyq7B7fzi78F3nP6fQBk8heiLtPIFoAA1VKwTpKs3J2TENjLeO-TLlmt63GsaWjUBA';
    const proofBytes = extractProofBytesFromInput(token);
    const decoded = decodeSignedProofEnvelope(proofBytes);

    expect(decoded.manifest.artworkIdHex).toBe('01234567-89ab-cdef-4123-8123456789ab');
    expect(decoded.manifest.region).toEqual([24, 24, 2, 2]);
    expect(decoded.manifest.issuedAt).toBe(1795352786);
    expect(decoded.manifest.license.licenseId).toBe('CC-BY-NC-4.0');
    expect(decoded.manifest.authorName).toBe('YomiPlush');
    expect(decoded.manifest.artworkTitle).toBe('Test Vector 2x2');

    const ok = await verifyEd25519Signature(
      decoded.manifest.publicKey,
      buildSigningMessage(decoded.payloadBytes),
      decoded.signature,
    );
    expect(ok).toBe(true);
  });

  it('rejects unsupported protocol versions explicitly (v0, v3, v99)', async () => {
    for (const ver of [0, 3, 99]) {
      const fakeEnvelope = cborEncode(
        [ver, new Uint8Array([1, 2, 3]), new Uint8Array(64)],
        rfc8949EncodeOptions,
      );
      expect(() => decodeSignedProofEnvelope(fakeEnvelope)).toThrow(UnsupportedProtocolVersionError);

      const verifyRes = await verifyProofAndArtwork({
        proofInput: base64UrlEncode(fakeEnvelope),
        artworkRaster: null,
        lookupTrustedKey: async () => undefined,
      });
      expect(verifyRes.signatureStatus).toBe('unsupported');
    }
  });

  it('rejects non-canonical CBOR, malformed CBOR, oversized metadata, control chars, and invalid URLs', async () => {
    expect(() =>
      encodeUnsignedPayload({
        version: 1,
        artworkId: new Uint8Array(16),
        publicKey: testPk,
        sha256: testHash,
        region: [0, 0, 100, 100],
        issuedAt: 100,
        license: {
          licenseId: 'ARR',
          commercialUse: 'disallow',
          redistribution: 'disallow',
          aiTraining: 'disallow',
        },
        authorName: 'Bad\x00Name',
      }),
    ).toThrow();

    expect(() =>
      encodeUnsignedPayload({
        version: 1,
        artworkId: new Uint8Array(16),
        publicKey: testPk,
        sha256: testHash,
        region: [0, 0, 100, 100],
        issuedAt: 100,
        license: {
          licenseId: 'ARR',
          commercialUse: 'disallow',
          redistribution: 'disallow',
          aiTraining: 'disallow',
        },
        artworkTitle: 'あ'.repeat(22), // 66 UTF-8 bytes
      }),
    ).toThrow();

    const nonCanonicalBytes = new Uint8Array([0xa1, 0x01, 0x40]);
    const badEnvelope = cborEncode([1, nonCanonicalBytes, new Uint8Array(64)], rfc8949EncodeOptions);
    expect(() => decodeSignedProofEnvelope(badEnvelope)).toThrow();

    const truncatedVerify = await verifyProofAndArtwork({
      proofInput: base64UrlEncode(new Uint8Array([0x83, 0x01])),
      artworkRaster: null,
      lookupTrustedKey: async () => undefined,
    });
    expect(truncatedVerify.signatureStatus).toBe('invalid');

    expect(() => sanitizeVerifyBaseUrl('javascript:alert(1)')).toThrow();
    expect(() => sanitizeVerifyBaseUrl('http://evil.example.com/verify')).toThrow();
    expect(sanitizeVerifyBaseUrl('http://localhost:4173/verify')).toBe('http://localhost:4173/verify');
    expect(sanitizeVerifyBaseUrl('http://127.0.0.1:43777/verify')).toBe(
      'http://127.0.0.1:43777/verify',
    );
  });
});
