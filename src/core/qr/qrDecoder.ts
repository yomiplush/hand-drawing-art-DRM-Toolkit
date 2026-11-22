import jsQR from 'jsqr';
import type { CanonicalRaster } from '../image/pngCodec';
import type { ArtworkRegion } from '../manifest/types';

export interface QrDecodeResult {
  rawText: string;
  strategy: string;
}

function flattenOnWhite(
  rgba: Uint8Array,
  width: number,
  height: number,
  cropX = 0,
  cropY = 0,
  cropW = width,
  cropH = height,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const srcRow = (cropY + y) * width;
    const dstRow = y * cropW;
    for (let x = 0; x < cropW; x++) {
      const si = (srcRow + cropX + x) * 4;
      const di = (dstRow + x) * 4;
      const a = rgba[si + 3];
      if (a === 255) {
        out[di] = rgba[si];
        out[di + 1] = rgba[si + 1];
        out[di + 2] = rgba[si + 2];
        out[di + 3] = 255;
      } else if (a === 0) {
        out[di] = 255;
        out[di + 1] = 255;
        out[di + 2] = 255;
        out[di + 3] = 255;
      } else {
        const inv = 255 - a;
        out[di] = Math.round((rgba[si] * a + 255 * inv) / 255);
        out[di + 1] = Math.round((rgba[si + 1] * a + 255 * inv) / 255);
        out[di + 2] = Math.round((rgba[si + 2] * a + 255 * inv) / 255);
        out[di + 3] = 255;
      }
    }
  }
  return out;
}

function downscaleNearest(
  rgba: Uint8Array,
  width: number,
  height: number,
  maxDim: number,
  cropX = 0,
  cropY = 0,
  cropW = width,
  cropH = height,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
  const targetW = Math.max(1, Math.round(cropW * scale));
  const targetH = Math.max(1, Math.round(cropH * scale));
  const out = new Uint8ClampedArray(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const sy = cropY + Math.min(cropH - 1, Math.floor((y / targetH) * cropH));
    for (let x = 0; x < targetW; x++) {
      const sx = cropX + Math.min(cropW - 1, Math.floor((x / targetW) * cropW));
      const si = (sy * width + sx) * 4;
      const di = (y * targetW + x) * 4;
      const a = rgba[si + 3];
      const inv = 255 - a;
      out[di] = a === 255 ? rgba[si] : Math.round((rgba[si] * a + 255 * inv) / 255);
      out[di + 1] = a === 255 ? rgba[si + 1] : Math.round((rgba[si + 1] * a + 255 * inv) / 255);
      out[di + 2] = a === 255 ? rgba[si + 2] : Math.round((rgba[si + 2] * a + 255 * inv) / 255);
      out[di + 3] = 255;
    }
  }
  return { data: out, width: targetW, height: targetH };
}

function tryJsQr(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  const res = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return res?.data ?? null;
}

export function decodeQrFromRegion(
  raster: CanonicalRaster,
  region: ArtworkRegion,
  paddingPx = 12,
): QrDecodeResult | null {
  const x0 = Math.max(0, region[0] - paddingPx);
  const y0 = Math.max(0, region[1] - paddingPx);
  const x1 = Math.min(raster.width, region[0] + region[2] + paddingPx);
  const y1 = Math.min(raster.height, region[1] + region[3] + paddingPx);
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 21 || ch < 21) return null;

  if (cw * ch <= 2_500_000) {
    const flat = flattenOnWhite(raster.data, raster.width, raster.height, x0, y0, cw, ch);
    const hit = tryJsQr(flat, cw, ch);
    if (hit) return { rawText: hit, strategy: 'region-native' };
  } else {
    const scaled = downscaleNearest(raster.data, raster.width, raster.height, 1400, x0, y0, cw, ch);
    const hit = tryJsQr(scaled.data, scaled.width, scaled.height);
    if (hit) return { rawText: hit, strategy: 'region-downscaled' };
  }
  return null;
}

export function decodeQrFromCanonicalRaster(raster: CanonicalRaster): QrDecodeResult | null {
  const { width, height, data } = raster;

  // 1. Direct full-image scan for small/medium images
  if (width * height <= 2_500_000) {
    const flat = flattenOnWhite(data, width, height);
    const hit = tryJsQr(flat, width, height);
    if (hit) return { rawText: hit, strategy: 'full-native' };
  } else {
    // Downscaled full pass for large photos
    const scaled = downscaleNearest(data, width, height, 1400);
    const hit = tryJsQr(scaled.data, scaled.width, scaled.height);
    if (hit) return { rawText: hit, strategy: 'full-downscaled' };
  }

  // 2. Targeted native-resolution margin, corner & center crops for high-res signed artworks
  const cropSpecs: Array<{ name: string; x: number; y: number; w: number; h: number }> = [];
  const halfW = Math.max(1, Math.floor(width / 2));
  const halfH = Math.max(1, Math.floor(height / 2));
  const stripH = Math.min(height, Math.max(480, Math.floor(height * 0.35)));
  const cornerW = Math.min(width, Math.max(640, halfW));
  const cornerH = Math.min(height, Math.max(640, halfH));
  const centerX = Math.max(0, Math.floor((width - cornerW) / 2));
  const centerY = Math.max(0, Math.floor((height - cornerH) / 2));
  const midStripY = Math.max(0, Math.floor((height - stripH) / 2));

  cropSpecs.push(
    { name: 'bottom-right', x: width - cornerW, y: height - cornerH, w: cornerW, h: cornerH },
    { name: 'bottom-left', x: 0, y: height - cornerH, w: cornerW, h: cornerH },
    { name: 'top-right', x: width - cornerW, y: 0, w: cornerW, h: cornerH },
    { name: 'top-left', x: 0, y: 0, w: cornerW, h: cornerH },
    { name: 'center', x: centerX, y: centerY, w: cornerW, h: cornerH },
    { name: 'bottom-strip', x: 0, y: height - stripH, w: width, h: stripH },
    { name: 'top-strip', x: 0, y: 0, w: width, h: stripH },
    { name: 'middle-strip', x: 0, y: midStripY, w: width, h: stripH },
  );

  for (const crop of cropSpecs) {
    if (crop.w < 21 || crop.h < 21 || crop.w * crop.h > 4_000_000) continue;
    const flat = flattenOnWhite(data, width, height, crop.x, crop.y, crop.w, crop.h);
    const hit = tryJsQr(flat, crop.w, crop.h);
    if (hit) return { rawText: hit, strategy: `crop:${crop.name}` };
  }

  // 3. Overlapping 3x3 grid scan for arbitrary small in-image QRs inside large (>2.5 MP) artworks
  if (width * height > 2_500_000) {
    const tileW = Math.min(width, Math.max(640, Math.ceil(width * 0.45)));
    const tileH = Math.min(height, Math.max(640, Math.ceil(height * 0.45)));
    const xs = [0, Math.max(0, Math.floor((width - tileW) / 2)), Math.max(0, width - tileW)];
    const ys = [0, Math.max(0, Math.floor((height - tileH) / 2)), Math.max(0, height - tileH)];
    for (let gy = 0; gy < ys.length; gy++) {
      for (let gx = 0; gx < xs.length; gx++) {
        const tx = xs[gx];
        const ty = ys[gy];
        if (tileW * tileH <= 2_500_000) {
          const flat = flattenOnWhite(data, width, height, tx, ty, tileW, tileH);
          const hit = tryJsQr(flat, tileW, tileH);
          if (hit) return { rawText: hit, strategy: `grid:${gx},${gy}` };
        } else {
          const scaled = downscaleNearest(data, width, height, 1200, tx, ty, tileW, tileH);
          const hit = tryJsQr(scaled.data, scaled.width, scaled.height);
          if (hit) return { rawText: hit, strategy: `grid-scaled:${gx},${gy}` };
        }
      }
    }
  }

  return null;
}

export function decodeQrFromImageData(imageData: ImageData): string | null {
  const res = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });
  return res?.data ?? null;
}
