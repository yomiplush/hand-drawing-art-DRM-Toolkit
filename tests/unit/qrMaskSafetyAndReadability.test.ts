import { describe, expect, it } from 'vitest';
import * as ed from '@noble/ed25519';
import { signWithSeed } from '../../src/core/crypto/ed25519';
import { base64UrlEncode } from '../../src/core/crypto/sha256';
import { hashMaskedArtworkRegion } from '../../src/core/image/canonicalRaster';
import {
  computeMaskCoverageStats,
  evaluateInImageQrReadability,
  overlayQrIntoArtwork,
} from '../../src/core/image/inImageQr';
import type { CanonicalRaster } from '../../src/core/image/pngCodec';
import {
  buildSigningMessage,
  encodeSignedProofEnvelope,
  encodeUnsignedPayload,
} from '../../src/core/manifest/cborCodec';
import type { ArtworkRegion, UnsignedManifest } from '../../src/core/manifest/types';
import { generateQrMatrix } from '../../src/core/qr/qrGenerator';
import { verifyProofAndArtwork } from '../../src/core/verify/verifier';
import { SUPPORTED_LOCALES } from '../../src/core/storage/consent';
import { UX_GUIDANCE_I18N } from '../../src/i18n/uxGuidance.data';

function makeSolidRaster(width: number, height: number, r: number, g: number, b: number): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

async function buildSignedV2ProofToken(raster: CanonicalRaster, qrMask: ArtworkRegion): Promise<string> {
  const seed32 = new Uint8Array(32).fill(0x2a);
  const publicKey = await ed.getPublicKeyAsync(seed32);
  const region: ArtworkRegion = [0, 0, raster.width, raster.height];
  const { digest } = await hashMaskedArtworkRegion(raster, region, qrMask);

  const manifest: UnsignedManifest = {
    version: 2,
    artworkId: new Uint8Array(16).fill(0x11),
    publicKey,
    sha256: digest,
    region,
    qrMask,
    issuedAt: 1795352786,
    license: {
      licenseId: 'ARR',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
    },
  };

  const payloadBytes = encodeUnsignedPayload(manifest);
  const signature = await signWithSeed(seed32, buildSigningMessage(payloadBytes, 2));
  const proofBytes = encodeSignedProofEnvelope(payloadBytes, signature, 2);
  return `https://certified-handmade.com/verify#proof=${base64UrlEncode(proofBytes)}`;
}

describe('Protocol v2 qrMask safety & In-Image QR readability checks', () => {
  it('classifies qrMask coverage boundaries accurately (<=15% ok, >15% caution, >30% high)', () => {
    // 100x100 = 10,000 px
    expect(computeMaskCoverageStats(100, 100, [0, 0, 38, 38]).tier).toBe('ok'); // 14.4%
    expect(computeMaskCoverageStats(100, 100, [0, 0, 39, 39]).tier).toBe('caution'); // 15.2%
    expect(computeMaskCoverageStats(100, 100, [0, 0, 55, 55]).tier).toBe('high'); // 30.3%
  });

  it('emits qrMask coverage warnings in verifyProofAndArtwork when qrMask exceeds 15% and 30%', async () => {
    const raster = makeSolidRaster(200, 200, 240, 240, 240);

    // >15% (caution): 80x80 / 40000 = 16%
    const cautionToken = await buildSignedV2ProofToken(raster, [10, 10, 80, 80]);
    const cautionRes = await verifyProofAndArtwork({
      proofInput: cautionToken,
      artworkRaster: raster,
      lookupTrustedKey: async () => undefined,
      lookupKeyNotices: async () => [],
    });
    expect(cautionRes.signatureStatus).toBe('valid');
    expect(cautionRes.integrityStatus).toBe('matched');
    expect(cautionRes.qrMaskCoverageTier).toBe('caution');
    expect(cautionRes.warnings.some((w) => w.includes('>15%'))).toBe(true);

    // >30% (high): 120x120 / 40000 = 36%
    const highToken = await buildSignedV2ProofToken(raster, [10, 10, 120, 120]);
    const highRes = await verifyProofAndArtwork({
      proofInput: highToken,
      artworkRaster: raster,
      lookupTrustedKey: async () => undefined,
      lookupKeyNotices: async () => [],
    });
    expect(highRes.signatureStatus).toBe('valid');
    expect(highRes.integrityStatus).toBe('matched');
    expect(highRes.qrMaskCoverageTier).toBe('high');
    expect(highRes.warnings.some((w) => w.includes('>30%'))).toBe(true);
  });

  it('detects too-small QR modules and low contrast against artwork background', () => {
    const qr = generateQrMatrix('https://certified-handmade.com/verify#proof=' + 'A'.repeat(280), 'M');

    // Too small: 96px box for a ~69+4=73 module QR -> ~1.31 px/module (< 2)
    const smallBg = makeSolidRaster(96, 96, 255, 255, 255);
    const { raster: smallBlended } = overlayQrIntoArtwork(smallBg, qr, {
      x: 0,
      y: 0,
      boxSize: 96,
      opacity: 1,
      style: 'frosted-light',
      eccLevel: 'M',
    });
    const smallEval = evaluateInImageQrReadability({
      blendedBox: smallBlended,
      qr,
      quietZoneModules: 2,
    });
    expect(smallEval.tooSmall).toBe(true);
    expect(smallEval.pxPerModule).toBeLessThan(2);

    // Low contrast: dark modules over near-black background with low opacity
    const darkBg = makeSolidRaster(200, 200, 15, 18, 28);
    const { raster: lowContrastBlended } = overlayQrIntoArtwork(darkBg, qr, {
      x: 0,
      y: 0,
      boxSize: 200,
      opacity: 0.3,
      style: 'modules-dark',
      eccLevel: 'M',
    });
    const lowContrastEval = evaluateInImageQrReadability({
      blendedBox: lowContrastBlended,
      qr,
      quietZoneModules: 2,
    });
    expect(lowContrastEval.tooSmall).toBe(false);
    expect(lowContrastEval.lowContrast).toBe(true);
    expect(lowContrastEval.contrastRatio).toBeLessThan(3.0);

    // Good size & high contrast
    const whiteBg = makeSolidRaster(200, 200, 255, 255, 255);
    const { raster: goodBlended } = overlayQrIntoArtwork(whiteBg, qr, {
      x: 0,
      y: 0,
      boxSize: 200,
      opacity: 1,
      style: 'frosted-light',
      eccLevel: 'M',
    });
    const goodEval = evaluateInImageQrReadability({
      blendedBox: goodBlended,
      qr,
      quietZoneModules: 2,
    });
    expect(goodEval.tooSmall).toBe(false);
    expect(goodEval.lowContrast).toBe(false);
    expect(goodEval.contrastRatio).toBeGreaterThanOrEqual(3.0);
  });

  it('provides complete UX guidance translations across all 13 supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const entry = UX_GUIDANCE_I18N[locale];
      expect(entry).toBeDefined();
      expect(entry.snsRecompression.createTitle.length).toBeGreaterThan(0);
      expect(entry.snsRecompression.createBody.length).toBeGreaterThan(0);
      expect(entry.snsRecompression.verifyTitle.length).toBeGreaterThan(0);
      expect(entry.snsRecompression.verifyBody.length).toBeGreaterThan(0);
      expect(entry.qrReadability.tooSmallWarning.length).toBeGreaterThan(0);
      expect(entry.qrReadability.lowContrastWarning.length).toBeGreaterThan(0);
    }
  });
});
