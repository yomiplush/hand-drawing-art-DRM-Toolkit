import { useEffect, useMemo, useRef, useState } from 'react';
import type { CanonicalRaster } from '../core/image/pngCodec';
import {
  drawRasterToCanvas,
  pngBytesToDataUrl,
  rasterToPreviewDataUrl,
} from '../core/image/previewDataUrl';

interface SafeArtworkImageProps {
  raster?: CanonicalRaster | null;
  pngBytes?: Uint8Array | null;
  fallbackDataUrl?: string | null;
  alt: string;
  className?: string;
  testId?: string;
}

/**
 * Renders artwork previews without relying on fragile blob: object URLs that can
 * fail or be invalidated in iOS/iPadOS Safari (WKWebView) and Brave Shields.
 * Always prefers immutable data:image/png;base64 URIs with an automatic <canvas> fallback.
 */
export function SafeArtworkImage({
  raster,
  pngBytes,
  fallbackDataUrl = null,
  alt,
  className = '',
  testId,
}: SafeArtworkImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dataUrl = useMemo(() => {
    if (pngBytes && pngBytes.length > 0) {
      try {
        return pngBytesToDataUrl(pngBytes);
      } catch {
        // Fall through to raster / fallbackDataUrl
      }
    }
    if (raster) {
      const fromRaster = rasterToPreviewDataUrl(raster);
      if (fromRaster) return fromRaster;
    }
    if (fallbackDataUrl && fallbackDataUrl.startsWith('data:image/')) {
      return fallbackDataUrl;
    }
    return null;
  }, [fallbackDataUrl, pngBytes, raster]);

  const imgFailed = Boolean(dataUrl) && failedUrl === dataUrl;
  const useCanvasFallback = Boolean(raster) && (!dataUrl || imgFailed);

  useEffect(() => {
    if (!useCanvasFallback || !raster || !canvasRef.current) return;
    drawRasterToCanvas(canvasRef.current, raster);
  }, [raster, useCanvasFallback]);

  if (useCanvasFallback && raster) {
    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        data-testid={testId}
        style={{ aspectRatio: `${raster.width} / ${raster.height}` }}
        className={className}
      />
    );
  }

  if (!dataUrl) {
    return null;
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      data-testid={testId}
      decoding="async"
      onError={() => setFailedUrl(dataUrl)}
      className={className}
    />
  );
}
