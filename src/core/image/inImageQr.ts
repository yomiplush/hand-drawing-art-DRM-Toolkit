import type { QrErrorCorrectionLevel, QrMatrix } from '../qr/qrGenerator';
import type { ArtworkRegion } from '../manifest/types';
import type { CanonicalRaster } from './pngCodec';

export type InImageQrStyle = 'frosted-light' | 'frosted-dark' | 'modules-dark' | 'modules-light';

export interface InImageQrOptions {
  x: number;
  y: number;
  boxSize: number;
  opacity: number; // 0.15 .. 1.0
  style: InImageQrStyle;
  eccLevel: QrErrorCorrectionLevel;
  quietZoneModules?: number; // Defaults to 1 (minimal border)
}

export interface ClampedInImageQrOptions {
  x: number;
  y: number;
  boxSize: number;
  opacity: number;
  style: InImageQrStyle;
  eccLevel: QrErrorCorrectionLevel;
  quietZoneModules: number;
}

export type QrMaskCoverageTier = 'ok' | 'caution' | 'high';

export interface QrMaskCoverageStats {
  maskPixels: number;
  artworkPixels: number;
  coverageRatio: number;
  coveragePct: number;
  tier: QrMaskCoverageTier;
}

const DEFAULT_QUIET_ZONE_MODULES = 1;

export function computeMaskCoverageStats(
  artWidth: number,
  artHeight: number,
  qrMask: ArtworkRegion,
): QrMaskCoverageStats {
  if (artWidth < 1 || artHeight < 1) {
    return {
      maskPixels: 0,
      artworkPixels: 0,
      coverageRatio: 0,
      coveragePct: 0,
      tier: 'ok',
    };
  }
  const [, , mw, mh] = qrMask;
  const safeMw = Math.max(0, Math.min(artWidth, mw));
  const safeMh = Math.max(0, Math.min(artHeight, mh));
  const maskPixels = safeMw * safeMh;
  const artworkPixels = artWidth * artHeight;
  const coverageRatio = Math.min(1, maskPixels / artworkPixels);
  const coveragePct = Math.round(coverageRatio * 1000) / 10;

  let tier: QrMaskCoverageTier = 'ok';
  if (coveragePct > 30) {
    tier = 'high';
  } else if (coveragePct > 15) {
    tier = 'caution';
  }

  return {
    maskPixels,
    artworkPixels,
    coverageRatio,
    coveragePct,
    tier,
  };
}

/**
 * Computes a minimal, crisp integer-module-aligned square boxSize for an in-image QR code
 * so it remains readable by decoders while covering as little of the artwork as practical.
 */
export function recommendInImageBoxSize(params: {
  artWidth: number;
  artHeight: number;
  qrModules: number;
  quietZoneModules?: number;
}): number {
  const { artWidth, artHeight, qrModules, quietZoneModules = DEFAULT_QUIET_ZONE_MODULES } = params;
  const maxBox = Math.min(artWidth, artHeight);
  const totalModules = Math.max(21, qrModules) + Math.max(0, quietZoneModules) * 2;
  const minScannablePx = 76;
  const pxPerModule = Math.max(2, Math.ceil(minScannablePx / totalModules));
  const preferred = totalModules * pxPerModule;
  const minClamp = Math.min(maxBox, 64);
  return Math.max(minClamp, Math.min(maxBox, preferred));
}

export function clampInImageQrOptions(
  artWidth: number,
  artHeight: number,
  options: InImageQrOptions,
): ClampedInImageQrOptions {
  if (artWidth < 21 || artHeight < 21) {
    throw new Error('Artwork dimensions must be at least 21x21 px for in-image QR placement');
  }
  const maxBox = Math.min(artWidth, artHeight);
  const minBox = Math.min(maxBox, 64);
  const rawBox = Number.isFinite(options.boxSize) ? Math.round(options.boxSize) : minBox;
  const boxSize = Math.max(21, Math.min(maxBox, Math.max(minBox, rawBox)));

  const rawX = Number.isFinite(options.x) ? Math.round(options.x) : 0;
  const rawY = Number.isFinite(options.y) ? Math.round(options.y) : 0;
  const x = Math.max(0, Math.min(artWidth - boxSize, rawX));
  const y = Math.max(0, Math.min(artHeight - boxSize, rawY));

  const rawOpacity = Number.isFinite(options.opacity) ? options.opacity : 0.72;
  const opacity = Math.max(0.15, Math.min(1, rawOpacity));

  const quietZoneModules =
    options.quietZoneModules !== undefined && Number.isFinite(options.quietZoneModules)
      ? Math.max(0, Math.min(4, Math.round(options.quietZoneModules)))
      : DEFAULT_QUIET_ZONE_MODULES;

  return {
    x,
    y,
    boxSize,
    opacity,
    style: options.style,
    eccLevel: options.eccLevel,
    quietZoneModules,
  };
}

function blendPixelOver(
  buf: Uint8Array,
  idx: number,
  sr: number,
  sg: number,
  sb: number,
  alpha01: number,
): void {
  if (alpha01 <= 0) return;
  if (alpha01 >= 0.999) {
    buf[idx] = sr;
    buf[idx + 1] = sg;
    buf[idx + 2] = sb;
    buf[idx + 3] = 255;
    return;
  }

  const da01 = buf[idx + 3] / 255;
  const outA01 = alpha01 + da01 * (1 - alpha01);
  if (outA01 <= 0) return;

  const inv = 1 - alpha01;
  buf[idx] = Math.round((sr * alpha01 + buf[idx] * da01 * inv) / outA01);
  buf[idx + 1] = Math.round((sg * alpha01 + buf[idx + 1] * da01 * inv) / outA01);
  buf[idx + 2] = Math.round((sb * alpha01 + buf[idx + 2] * da01 * inv) / outA01);
  buf[idx + 3] = Math.min(255, Math.max(0, Math.round(outA01 * 255)));
}

/**
 * Composites a QR code directly inside the artwork bounds `[x, y, boxSize, boxSize]`
 * using straight-alpha blending. Every pixel outside `[x, y, boxSize, boxSize]`
 * remains bit-for-bit identical to the source raster.
 */
export function overlayQrIntoArtwork(
  artwork: CanonicalRaster,
  qr: QrMatrix,
  options: InImageQrOptions,
): { raster: CanonicalRaster; clamped: ClampedInImageQrOptions } {
  const clamped = clampInImageQrOptions(artwork.width, artwork.height, options);
  const out = new Uint8Array(artwork.data);

  const { x: boxX, y: boxY, boxSize, opacity, style, quietZoneModules } = clamped;
  const totalModules = qr.size + quietZoneModules * 2;

  // Fill the entire qrMask box edge-to-edge so there is never an oversized wasted white margin
  const usedSize = boxSize;
  const originX = boxX;
  const originY = boxY;

  // Crisp pure white backdrop when opacity is 1.0; subtle translucent backdrop otherwise
  const hasBackdrop = style === 'frosted-light' || style === 'frosted-dark';
  const backdropColor = style === 'frosted-dark' ? ([10, 18, 34] as const) : ([255, 255, 255] as const);
  const backdropAlpha = opacity >= 0.99 ? 1 : Math.min(1, opacity * 0.88);
  const moduleAlpha = opacity >= 0.99 ? 1 : hasBackdrop ? Math.min(1, opacity * 0.96 + 0.04) : opacity;

  const stride = artwork.width * 4;

  for (let py = 0; py < boxSize; py++) {
    const absY = boxY + py;
    const relY = absY - originY;
    for (let px = 0; px < boxSize; px++) {
      const absX = boxX + px;
      const relX = absX - originX;
      const idx = absY * stride + absX * 4;

      let isDarkModule = false;
      if (relX >= 0 && relX < usedSize && relY >= 0 && relY < usedSize) {
        const modTotalX = Math.min(totalModules - 1, Math.floor((relX * totalModules) / usedSize));
        const modTotalY = Math.min(totalModules - 1, Math.floor((relY * totalModules) / usedSize));

        const mx = modTotalX - quietZoneModules;
        const my = modTotalY - quietZoneModules;
        if (mx >= 0 && mx < qr.size && my >= 0 && my < qr.size) {
          isDarkModule = qr.data[my * qr.size + mx] === 1;
        }
      }

      if (style === 'frosted-light') {
        if (isDarkModule) {
          blendPixelOver(out, idx, 0, 0, 0, moduleAlpha);
        } else {
          blendPixelOver(out, idx, backdropColor[0], backdropColor[1], backdropColor[2], backdropAlpha);
        }
      } else if (style === 'frosted-dark') {
        if (isDarkModule) {
          // Inverted bright modules over frosted dark plate
          blendPixelOver(out, idx, 245, 250, 255, moduleAlpha);
        } else {
          blendPixelOver(out, idx, backdropColor[0], backdropColor[1], backdropColor[2], backdropAlpha);
        }
      } else if (style === 'modules-dark') {
        if (isDarkModule) {
          blendPixelOver(out, idx, 8, 12, 24, moduleAlpha);
        }
      } else if (style === 'modules-light') {
        if (isDarkModule) {
          blendPixelOver(out, idx, 255, 255, 255, moduleAlpha);
        }
      }
    }
  }

  return {
    raster: { width: artwork.width, height: artwork.height, data: out },
    clamped,
  };
}
