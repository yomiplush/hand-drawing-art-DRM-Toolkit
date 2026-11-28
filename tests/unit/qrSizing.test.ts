import { describe, expect, it } from 'vitest';
import { signWithSeed } from '../../src/core/crypto/ed25519';
import {
  buildSigningMessage,
  encodeSignedProofEnvelope,
  encodeUnsignedPayload,
} from '../../src/core/manifest/cborCodec';
import { buildProofUrl } from '../../src/core/manifest/proofUrl';
import { measureUnsignedQrSizing } from '../../src/core/manifest/qrSizing';
import type { UnsignedManifest } from '../../src/core/manifest/types';
import { generateQrMatrix } from '../../src/core/qr/qrGenerator';

function placeholder(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed >>> 0 || 0x9e3779b9;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out[i] = state & 0xff;
  }
  return out;
}

describe('QR sizing estimate', () => {
  it('predicts the real v3 proof URL length and QR density without compressible dummy bytes', async () => {
    const seed = placeholder(32, 0x77);
    const publicKey = await (await import('@noble/ed25519')).getPublicKeyAsync(seed);
    const manifest: UnsignedManifest = {
      version: 3,
      artworkId: placeholder(16, 0x11),
      publicKey,
      sha256: placeholder(32, 0x33),
      region: [0, 0, 320, 240],
      qrMask: [12, 12, 186, 186],
      issuedAt: 1_795_400_000,
      authorName: 'Offline Key',
      artworkTitle: 'Studio Sketch',
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
        allowsDerivatives: 'disallow',
        allowsModifications: 'disallow',
        requiresAttribution: false,
      },
    };

    const payloadBytes = encodeUnsignedPayload(manifest);
    const signature = await signWithSeed(seed, buildSigningMessage(payloadBytes, 3));
    const proofBytes = encodeSignedProofEnvelope(payloadBytes, signature, 3);
    const actualUrl = buildProofUrl(proofBytes);

    const sizing = measureUnsignedQrSizing({
      manifestWithoutCrypto: {
        artworkId: manifest.artworkId,
        publicKey: manifest.publicKey,
        sha256: manifest.sha256,
        region: manifest.region,
        qrMask: manifest.qrMask,
        issuedAt: manifest.issuedAt,
        authorName: manifest.authorName,
        artworkTitle: manifest.artworkTitle,
        license: manifest.license,
      },
      eccLevel: 'Q',
    });

    // Real signatures are incompressible; the estimate must not collapse to the
    // tiny all-0x55 dummy envelope that used to recommend undersized QR boxes.
    expect(Math.abs(sizing.proofUrlChars - actualUrl.length)).toBeLessThanOrEqual(16);
    expect(sizing.qrModules).toBe(generateQrMatrix(actualUrl, 'Q').size);
    expect(sizing.qrVersion).toBe(generateQrMatrix(actualUrl, 'Q').version);
  });
});
