import type { CanonicalRaster } from './pngCodec';

const DEFAULT_MAX_PREVIEW_DIM = 960;

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    parts.push(String.fromCharCode(...chunk));
  }
  return btoa(parts.join(''));
}

export function pngBytesToDataUrl(pngBytes: Uint8Array): string {
  return `data:image/png;base64,${bytesToBase64(pngBytes)}`;
}

export function computeScaledPreviewDimensions(
  width: number,
  height: number,
  maxDim = DEFAULT_MAX_PREVIEW_DIM,
): { width: number; height: number } {
  if (width < 1 || height < 1) return { width: 1, height: 1 };
  const largest = Math.max(width, height);
  if (largest <= maxDim) {
    return { width, height };
  }
  const scale = maxDim / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function drawRasterToCanvas(
  canvas: HTMLCanvasElement,
  raster: CanonicalRaster,
  maxDim = DEFAULT_MAX_PREVIEW_DIM,
): boolean {
  if (typeof document === 'undefined' || raster.width < 1 || raster.height < 1) {
    return false;
  }
  const { width: dispW, height: dispH } = computeScaledPreviewDimensions(
    raster.width,
    raster.height,
    maxDim,
  );
  if (canvas.width !== dispW || canvas.height !== dispH) {
    canvas.width = dispW;
    canvas.height = dispH;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  try {
    const srcCanvas =
      dispW === raster.width && dispH === raster.height
        ? canvas
        : document.createElement('canvas');
    if (srcCanvas !== canvas) {
      srcCanvas.width = raster.width;
      srcCanvas.height = raster.height;
    }
    const srcCtx = srcCanvas === canvas ? ctx : srcCanvas.getContext('2d');
    if (!srcCtx) return false;

    const clamped = new Uint8ClampedArray(raster.data.length);
    clamped.set(raster.data);
    srcCtx.putImageData(new ImageData(clamped, raster.width, raster.height), 0, 0);

    if (srcCanvas !== canvas) {
      ctx.clearRect(0, 0, dispW, dispH);
      ctx.drawImage(srcCanvas, 0, 0, dispW, dispH);
    }
    return true;
  } catch {
    return false;
  }
}

export function rasterToPreviewDataUrl(
  raster: CanonicalRaster,
  maxDim = DEFAULT_MAX_PREVIEW_DIM,
): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    if (!drawRasterToCanvas(canvas, raster, maxDim)) {
      return null;
    }
    const url = canvas.toDataURL('image/png');
    if (!url || !url.startsWith('data:image/')) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function readFileAsDataUrl(file: File): Promise<string | null> {
  if (typeof FileReader === 'undefined') return Promise.resolve(null);
  // Only use direct file Data URL pre-preview for universally safe web raster types;
  // HEIC / exotic formats will still render cleanly once decoded into CanonicalRaster.
  const lower = (file.type || file.name || '').toLowerCase();
  const isSafeWebImage =
    lower.includes('png') ||
    lower.includes('jpeg') ||
    lower.includes('jpg') ||
    lower.includes('webp');
  if (!isSafeWebImage) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    try {
      reader.readAsDataURL(file);
    } catch {
      resolve(null);
    }
  });
}
