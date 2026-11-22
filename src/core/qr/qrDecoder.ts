import jsQR from 'jsqr';
import type { CanonicalRaster } from '../image/pngCodec';

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
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(height - 1, Math.floor((y / targetH) * height));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(width - 1, Math.floor((x / targetW) * width));
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

  return null;
}

export function decodeQrFromImageData(imageData: ImageData): string | null {
  const res = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });
  return res?.data ?? null;
}
