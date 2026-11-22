import { decode as decodePng, encode as encodePng, hasPngSignature } from 'fast-png';
import { MAX_IMAGE_DIMENSION, MAX_OUTPUT_DIMENSION } from '../manifest/types';
import type { ArtworkRegion } from '../manifest/types';

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_TOTAL_PIXELS = 33_554_432; // 32 MP (~134 MB RGBA8)

export interface CanonicalRaster {
  width: number;
  height: number;
  data: Uint8Array; // Un-premultiplied RGBA8, length = width * height * 4
}

export interface PngHeaderInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

export function inspectPngHeader(bytes: Uint8Array): PngHeaderInfo {
  if (!hasPngSignature(bytes)) {
    throw new Error('Invalid PNG signature');
  }
  if (bytes.length < 33) {
    throw new Error('Truncated PNG file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ihdrLength = view.getUint32(8, false);
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== 'IHDR' || ihdrLength !== 13) {
    throw new Error('Malformed PNG: missing or invalid IHDR chunk');
  }
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  const bitDepth = bytes[24];
  const colorType = bytes[25];

  if (width < 1 || height < 1) {
    throw new Error('PNG dimensions must be positive');
  }
  if (width > MAX_OUTPUT_DIMENSION || height > MAX_OUTPUT_DIMENSION) {
    throw new Error(
      `PNG dimensions (${width}x${height}) exceed safety limit (${MAX_OUTPUT_DIMENSION}px)`,
    );
  }
  if (width * height > MAX_TOTAL_PIXELS) {
    throw new Error(`PNG pixel count (${width * height}) exceeds safety limit (${MAX_TOTAL_PIXELS})`);
  }
  return { width, height, bitDepth, colorType };
}

function normalizeSampleTo8Bit(sample: number, depth: number): number {
  if (depth === 8) return sample & 0xff;
  if (depth === 16) return (sample >> 8) & 0xff;
  const maxVal = (1 << depth) - 1;
  return Math.round((sample / maxVal) * 255);
}

export function decodePngToCanonicalRgba8(bytes: Uint8Array): CanonicalRaster {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`File size exceeds maximum allowed ${MAX_FILE_BYTES} bytes`);
  }
  inspectPngHeader(bytes);

  const decoded = decodePng(bytes, { checkCrc: true });
  const { width, height, data, depth, channels, palette, transparency } = decoded;

  if (width < 1 || height < 1 || width > MAX_OUTPUT_DIMENSION || height > MAX_OUTPUT_DIMENSION) {
    throw new Error('Decoded PNG dimensions out of allowed bounds');
  }

  const pixelCount = width * height;
  const rgba = new Uint8Array(pixelCount * 4);

  if (palette && palette.length > 0) {
    for (let i = 0; i < pixelCount; i++) {
      const idx = data[i];
      const entry = palette[idx];
      const out = i * 4;
      if (!entry) {
        rgba[out] = 0;
        rgba[out + 1] = 0;
        rgba[out + 2] = 0;
        rgba[out + 3] = 255;
        continue;
      }
      rgba[out] = entry[0] ?? 0;
      rgba[out + 1] = entry[1] ?? 0;
      rgba[out + 2] = entry[2] ?? 0;
      if (entry.length >= 4) {
        rgba[out + 3] = entry[3];
      } else if (transparency && idx < transparency.length) {
        rgba[out + 3] = transparency[idx] & 0xff;
      } else {
        rgba[out + 3] = 255;
      }
    }
    return { width, height, data: rgba };
  }

  if (channels === 4 && depth === 8 && data instanceof Uint8Array) {
    rgba.set(data);
    return { width, height, data: rgba };
  }

  if (channels === 4) {
    for (let i = 0; i < pixelCount; i++) {
      const src = i * 4;
      const dst = i * 4;
      rgba[dst] = normalizeSampleTo8Bit(data[src], depth);
      rgba[dst + 1] = normalizeSampleTo8Bit(data[src + 1], depth);
      rgba[dst + 2] = normalizeSampleTo8Bit(data[src + 2], depth);
      rgba[dst + 3] = normalizeSampleTo8Bit(data[src + 3], depth);
    }
    return { width, height, data: rgba };
  }

  if (channels === 3) {
    const trnsR = transparency && transparency.length >= 3 ? transparency[0] : -1;
    const trnsG = transparency && transparency.length >= 3 ? transparency[1] : -1;
    const trnsB = transparency && transparency.length >= 3 ? transparency[2] : -1;

    for (let i = 0; i < pixelCount; i++) {
      const src = i * 3;
      const dst = i * 4;
      const rRaw = data[src];
      const gRaw = data[src + 1];
      const bRaw = data[src + 2];
      rgba[dst] = normalizeSampleTo8Bit(rRaw, depth);
      rgba[dst + 1] = normalizeSampleTo8Bit(gRaw, depth);
      rgba[dst + 2] = normalizeSampleTo8Bit(bRaw, depth);
      rgba[dst + 3] = rRaw === trnsR && gRaw === trnsG && bRaw === trnsB ? 0 : 255;
    }
    return { width, height, data: rgba };
  }

  if (channels === 2) {
    for (let i = 0; i < pixelCount; i++) {
      const src = i * 2;
      const dst = i * 4;
      const g = normalizeSampleTo8Bit(data[src], depth);
      rgba[dst] = g;
      rgba[dst + 1] = g;
      rgba[dst + 2] = g;
      rgba[dst + 3] = normalizeSampleTo8Bit(data[src + 1], depth);
    }
    return { width, height, data: rgba };
  }

  if (channels === 1) {
    const trnsGray = transparency && transparency.length >= 1 ? transparency[0] : -1;
    for (let i = 0; i < pixelCount; i++) {
      const gRaw = data[i];
      const g = normalizeSampleTo8Bit(gRaw, depth);
      const dst = i * 4;
      rgba[dst] = g;
      rgba[dst + 1] = g;
      rgba[dst + 2] = g;
      rgba[dst + 3] = gRaw === trnsGray ? 0 : 255;
    }
    return { width, height, data: rgba };
  }

  throw new Error(`Unsupported PNG channel count: ${channels}`);
}

export function encodeCanonicalRgba8ToPng(
  raster: CanonicalRaster,
  textMetadata?: Record<string, string>,
): Uint8Array {
  if (raster.data.length !== raster.width * raster.height * 4) {
    throw new Error('RGBA8 buffer length does not match dimensions');
  }
  return encodePng({
    width: raster.width,
    height: raster.height,
    data: raster.data,
    depth: 8,
    channels: 4,
    text: textMetadata,
  });
}

export function extractRegionFromRaster(
  raster: CanonicalRaster,
  region: ArtworkRegion,
): CanonicalRaster {
  const [rx, ry, rw, rh] = region;
  if (rx < 0 || ry < 0 || rw < 1 || rh < 1) {
    throw new Error('Invalid region dimensions');
  }
  if (rx + rw > raster.width || ry + rh > raster.height) {
    throw new Error(
      `Region [${rx}, ${ry}, ${rw}, ${rh}] exceeds image bounds (${raster.width}x${raster.height})`,
    );
  }
  if (rx === 0 && ry === 0 && rw === raster.width && rh === raster.height) {
    return {
      width: rw,
      height: rh,
      data: new Uint8Array(raster.data),
    };
  }
  const out = new Uint8Array(rw * rh * 4);
  const srcStride = raster.width * 4;
  const dstStride = rw * 4;
  for (let row = 0; row < rh; row++) {
    const srcOffset = (ry + row) * srcStride + rx * 4;
    const dstOffset = row * dstStride;
    out.set(raster.data.subarray(srcOffset, srcOffset + dstStride), dstOffset);
  }
  return { width: rw, height: rh, data: out };
}

export async function decodeImageFileToCanonicalRgba8(
  fileOrBytes: File | Blob | Uint8Array,
): Promise<{ raster: CanonicalRaster; sourceFormat: 'png' | 'browser-raster' }> {
  let bytes: Uint8Array;
  if (fileOrBytes instanceof Uint8Array) {
    bytes = fileOrBytes;
  } else {
    if (fileOrBytes.size > MAX_FILE_BYTES) {
      throw new Error(`File exceeds ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB safety limit`);
    }
    bytes = new Uint8Array(await fileOrBytes.arrayBuffer());
  }

  if (bytes.byteLength === 0) {
    throw new Error('Empty image file');
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`File exceeds ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB safety limit`);
  }

  if (hasPngSignature(bytes)) {
    return {
      raster: decodePngToCanonicalRgba8(bytes),
      sourceFormat: 'png',
    };
  }

  // Fallback for JPEG, WebP, etc. using browser image decoder
  const blob = fileOrBytes instanceof Uint8Array ? new Blob([new Uint8Array(bytes)]) : fileOrBytes;
  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(blob, {
        imageOrientation: 'from-image',
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      });
      const width = bitmap.width;
      const height = bitmap.height;
      if (
        width < 1 ||
        height < 1 ||
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION ||
        width * height > MAX_TOTAL_PIXELS
      ) {
        throw new Error(`Image dimensions (${width}x${height}) exceed safety limits`);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('Failed to create 2D canvas context');
      }
      ctx.drawImage(bitmap, 0, 0);
      const imgData = ctx.getImageData(0, 0, width, height);
      return {
        raster: { width, height, data: new Uint8Array(imgData.data) },
        sourceFormat: 'browser-raster',
      };
    }
  } finally {
    bitmap?.close();
  }

  // Legacy HTMLImageElement fallback
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unsupported or corrupted image file'));
      el.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (
      width < 1 ||
      height < 1 ||
      width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION ||
      width * height > MAX_TOTAL_PIXELS
    ) {
      throw new Error(`Image dimensions (${width}x${height}) exceed safety limits`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to create 2D canvas context');
    }
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, width, height);
    return {
      raster: { width, height, data: new Uint8Array(imgData.data) },
      sourceFormat: 'browser-raster',
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isPngBytes(bytes: Uint8Array): boolean {
  return hasPngSignature(bytes);
}

export function assertArtworkInputBounds(raster: CanonicalRaster): void {
  if (
    raster.width < 1 ||
    raster.height < 1 ||
    raster.width > MAX_IMAGE_DIMENSION ||
    raster.height > MAX_IMAGE_DIMENSION
  ) {
    throw new Error(`Artwork dimensions must be between 1 and ${MAX_IMAGE_DIMENSION}px`);
  }
  if (raster.width * raster.height > MAX_TOTAL_PIXELS) {
    throw new Error('Artwork pixel count exceeds maximum allowed');
  }
}
