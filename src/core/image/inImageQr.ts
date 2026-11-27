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

export interface QrReadabilityAssessment {
  pxPerModule: number;
  tooSmall: boolean;
  contrastRatio: number;
  lowContrast: boolean;
}

export const MIN_RECOMMENDED_PX_PER_MODULE = 2;
export const MIN_RECOMMENDED_CONTRAST_RATIO = 3.0;

function srgbChannelToLinear(c8: number): number {
  const s = c8 / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/**
 * Evaluates in-image QR readability heuristics:
 * 1. Module pixel size (warns when < 2 px/module).
 * 2. Average relative luminance contrast between dark modules and light modules/background
 *    inside the rendered QR box (warns when WCAG contrast ratio < 3.0:1).
 */
export function evaluateInImageQrReadability(params: {
  blendedBox: CanonicalRaster;
  qr: QrMatrix;
  quietZoneModules?: number;
}): QrReadabilityAssessment {
  const { blendedBox, qr, quietZoneModules = DEFAULT_QUIET_ZONE_MODULES } = params;
  const boxSize = Math.min(blendedBox.width, blendedBox.height);
  const totalModules = Math.max(21, qr.size) + Math.max(0, quietZoneModules) * 2;
  const pxPerModule = Math.round((boxSize / totalModules) * 100) / 100;
  const tooSmall = pxPerModule < MIN_RECOMMENDED_PX_PER_MODULE;

  const integerModulePx = Math.floor(boxSize / totalModules);
  const useIntegerGrid = integerModulePx >= 2;
  const usedSize = useIntegerGrid ? totalModules * integerModulePx : boxSize;
  const originX = Math.floor((blendedBox.width - usedSize) / 2);
  const originY = Math.floor((blendedBox.height - usedSize) / 2);

  let darkLumSum = 0;
  let darkCount = 0;
  let lightLumSum = 0;
  let lightCount = 0;

  const stride = blendedBox.width * 4;
  for (let my = 0; my < qr.size; my++) {
    const py = originY + Math.floor(((my + quietZoneModules + 0.5) * usedSize) / totalModules);
    if (py < 0 || py >= blendedBox.height) continue;
    for (let mx = 0; mx < qr.size; mx++) {
      const px = originX + Math.floor(((mx + quietZoneModules + 0.5) * usedSize) / totalModules);
      if (px < 0 || px >= blendedBox.width) continue;
      const idx = py * stride + px * 4;
      const lum = relativeLuminance(
        blendedBox.data[idx],
        blendedBox.data[idx + 1],
        blendedBox.data[idx + 2],
      );
      if (qr.data[my * qr.size + mx] === 1) {
        darkLumSum += lum;
        darkCount++;
      } else {
        lightLumSum += lum;
        lightCount++;
      }
    }
  }

  let contrastRatio = 1;
  if (darkCount > 0 && lightCount > 0) {
    const darkMean = darkLumSum / darkCount;
    const lightMean = lightLumSum / lightCount;
    const lighter = Math.max(darkMean, lightMean);
    const darker = Math.min(darkMean, lightMean);
    contrastRatio = Math.round(((lighter + 0.05) / (darker + 0.05)) * 10) / 10;
  }

  return {
    pxPerModule,
    tooSmall,
    contrastRatio,
    lowContrast: contrastRatio < MIN_RECOMMENDED_CONTRAST_RATIO,
  };
}

const DEFAULT_QUIET_ZONE_MODULES = 2;
export const MIN_IN_IMAGE_QR_BOX_PX = 96;

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
  const minScannablePx = MIN_IN_IMAGE_QR_BOX_PX;
  const pxPerModule = Math.max(2, Math.ceil(minScannablePx / totalModules));
  const preferred = totalModules * pxPerModule;
  const minClamp = Math.min(maxBox, MIN_IN_IMAGE_QR_BOX_PX);
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
  const minBox = Math.min(maxBox, MIN_IN_IMAGE_QR_BOX_PX);
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

  const { x: boxX, y: boxY, boxSize, opacity: rawOpacity, style, quietZoneModules } = clamped;
  // Boost contrast floor for compact QR boxes (<= 128px) so smartphone cameras decode reliably
  const opacity = boxSize <= 128 ? Math.max(rawOpacity, 0.92) : rawOpacity;
  const totalModules = qr.size + quietZoneModules * 2;
  const integerModulePx = Math.floor(boxSize / totalModules);

  // Use exact integer-pixel modules when >= 2px/module to prevent uneven 2px/3px jitter
  // that gets mangled by SNS WebP/JPEG 4:2:0 block quantization and downscaling.
  const useIntegerGrid = integerModulePx >= 2;
  const usedSize = useIntegerGrid ? totalModules * integerModulePx : boxSize;
  const originX = boxX + Math.floor((boxSize - usedSize) / 2);
  const originY = boxY + Math.floor((boxSize - usedSize) / 2);

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
        const modTotalX = useIntegerGrid
          ? Math.floor(relX / integerModulePx)
          : Math.min(totalModules - 1, Math.floor((relX * totalModules) / usedSize));
        const modTotalY = useIntegerGrid
          ? Math.floor(relY / integerModulePx)
          : Math.min(totalModules - 1, Math.floor((relY * totalModules) / usedSize));

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

  // Draw crisp center Shield + Pencil brand emblem when QR is large enough (>= 96px)
  // Keeping emblem within ~14% width preserves full ECC scannability.
  if (boxSize >= 96 && (style === 'frosted-light' || style === 'frosted-dark')) {
    const emblemSize = Math.max(14, Math.min(44, Math.round(usedSize * 0.14)));
    const pad = Math.max(2, Math.round(emblemSize * 0.14));
    const totalEmblem = emblemSize + pad * 2;
    const startX = originX + Math.floor((usedSize - totalEmblem) / 2);
    const startY = originY + Math.floor((usedSize - totalEmblem) / 2);

    const isDark = style === 'frosted-dark';
    const plateBg = isDark ? ([10, 18, 34] as const) : ([255, 255, 255] as const);

    for (let ey = 0; ey < totalEmblem; ey++) {
      const absY = startY + ey;
      if (absY < boxY || absY >= boxY + boxSize) continue;
      for (let ex = 0; ex < totalEmblem; ex++) {
        const absX = startX + ex;
        if (absX < boxX || absX >= boxX + boxSize) continue;
        const idx = absY * stride + absX * 4;

        const ix = ex - pad;
        const iy = ey - pad;
        if (ix < 0 || ix >= emblemSize || iy < 0 || iy >= emblemSize) {
          // Outer quiet pad around emblem
          blendPixelOver(out, idx, plateBg[0], plateBg[1], plateBg[2], backdropAlpha);
          continue;
        }

        // Normalized [0..1] coordinates inside the emblem
        const u = (ix + 0.5) / emblemSize;
        const v = (iy + 0.5) / emblemSize;

        // Shield silhouette in [0.18..0.82] x [0.12..0.88]
        const dx = Math.abs(u - 0.5);
        const maxHalfW = v < 0.52 ? 0.32 : Math.max(0, 0.32 * (1 - ((v - 0.52) / 0.36) ** 1.35));
        const inShield = v >= 0.12 && v <= 0.88 && dx <= maxHalfW;
        const onShieldBorder =
          inShield && (v <= 0.19 || v >= 0.82 || dx >= Math.max(0, maxHalfW - 0.08));

        // Diagonal pencil stroke from bottom-left (0.34, 0.64) to top-right (0.66, 0.32)
        const distToPencil = Math.abs((u - 0.5) + (v - 0.48)) / Math.SQRT2;
        const alongPencil = ((u - 0.5) - (v - 0.48)) / Math.SQRT2;
        const inPencil = inShield && distToPencil <= 0.065 && alongPencil >= -0.18 && alongPencil <= 0.18;

        if (inPencil) {
          blendPixelOver(out, idx, 224, 242, 254, moduleAlpha); // bright pencil (#e0f2fe)
        } else if (onShieldBorder) {
          blendPixelOver(out, idx, 56, 189, 248, moduleAlpha); // cyan shield border (#38bdf8)
        } else if (inShield) {
          blendPixelOver(out, idx, 13, 40, 71, moduleAlpha); // deep navy shield fill (#0d2847)
        } else {
          blendPixelOver(out, idx, 6, 17, 30, moduleAlpha); // dark badge bg (#06111e)
        }
      }
    }
  }

  return {
    raster: { width: artwork.width, height: artwork.height, data: out },
    clamped,
  };
}
