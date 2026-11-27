import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Move, Sparkles } from 'lucide-react';
import {
  computeMaskCoverageStats,
  evaluateInImageQrReadability,
  overlayQrIntoArtwork,
  recommendInImageBoxSize,
} from '../core/image/inImageQr';
import type {
  ClampedInImageQrOptions,
  InImageQrStyle,
  QrReadabilityAssessment,
} from '../core/image/inImageQr';
import type { CanonicalRaster } from '../core/image/pngCodec';
import { decodeQrFromCanonicalRaster } from '../core/qr/qrDecoder';
import { generateQrMatrix } from '../core/qr/qrGenerator';
import type { QrErrorCorrectionLevel } from '../core/qr/qrGenerator';
import { DEFAULT_VERIFY_BASE_URL } from '../core/manifest/types';
import { useI18n } from '../i18n/context';

const MAX_PREVIEW_DIM = 760;

function extractBoxSubRaster(
  raster: CanonicalRaster,
  x: number,
  y: number,
  size: number,
): CanonicalRaster {
  const out = new Uint8Array(size * size * 4);
  const srcStride = raster.width * 4;
  const dstStride = size * 4;
  for (let row = 0; row < size; row++) {
    const srcStart = (y + row) * srcStride + x * 4;
    out.set(raster.data.subarray(srcStart, srcStart + dstStride), row * dstStride);
  }
  return { width: size, height: size, data: out };
}

export interface InImageQrStudioPanelProps {
  artworkRaster: CanonicalRaster;
  clampedOptions: ClampedInImageQrOptions;
  eccLevel: QrErrorCorrectionLevel;
  verifyBaseUrl: string;
  estimatedProofTokenChars?: number;
  onChangeX: (x: number) => void;
  onChangeY: (y: number) => void;
  onChangeBoxSize?: (size: number) => void;
}

export function InImageQrStudioPanel({
  artworkRaster,
  clampedOptions,
  eccLevel,
  verifyBaseUrl,
  estimatedProofTokenChars = 310,
  onChangeX,
  onChangeY,
  onChangeBoxSize,
}: InImageQrStudioPanelProps) {
  const { t } = useI18n();
  const [isScannable, setIsScannable] = useState<boolean>(true);
  const [readability, setReadability] = useState<QrReadabilityAssessment | null>(null);
  const [highlightMask, setHighlightMask] = useState<boolean>(false);
  const [optimizedHintVisible, setOptimizedHintVisible] = useState<boolean>(false);
  const [kbAnnouncement, setKbAnnouncement] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
  });

  const cleanBase = (verifyBaseUrl || DEFAULT_VERIFY_BASE_URL).replace(/#.*$/, '');
  const tokenLen = Math.max(260, Math.min(2800, Math.round(estimatedProofTokenChars)));
  const samplePreviewText = `${cleanBase}#proof=${'A'.repeat(tokenLen)}`;

  const previewQrMatrix = useMemo(() => {
    try {
      return generateQrMatrix(samplePreviewText, eccLevel);
    } catch {
      try {
        return generateQrMatrix(`${cleanBase}#proof=${'A'.repeat(260)}`, eccLevel);
      } catch {
        return generateQrMatrix('https://www.certified-handmade.com/verify', 'M');
      }
    }
  }, [cleanBase, samplePreviewText, eccLevel]);

  const coverageStats = useMemo(
    () =>
      computeMaskCoverageStats(artworkRaster.width, artworkRaster.height, [
        clampedOptions.x,
        clampedOptions.y,
        clampedOptions.boxSize,
        clampedOptions.boxSize,
      ]),
    [artworkRaster.width, artworkRaster.height, clampedOptions.x, clampedOptions.y, clampedOptions.boxSize],
  );

  const recommendedBoxSize = useMemo(
    () =>
      recommendInImageBoxSize({
        artWidth: artworkRaster.width,
        artHeight: artworkRaster.height,
        qrModules: previewQrMatrix.size,
        quietZoneModules: clampedOptions.quietZoneModules,
      }),
    [artworkRaster.width, artworkRaster.height, previewQrMatrix.size, clampedOptions.quietZoneModules],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      baseCanvasRef.current = null;
      return;
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = artworkRaster.width;
    offscreen.height = artworkRaster.height;
    const ctx = offscreen.getContext('2d');
    if (ctx && artworkRaster.width > 0 && artworkRaster.height > 0) {
      try {
        const clampedCopy = new Uint8ClampedArray(artworkRaster.data.length);
        clampedCopy.set(artworkRaster.data);
        ctx.putImageData(
          new ImageData(clampedCopy, artworkRaster.width, artworkRaster.height),
          0,
          0,
        );
      } catch {
        // Guard against transient malformed ImageData sizes
      }
    }
    baseCanvasRef.current = offscreen;
  }, [artworkRaster]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const { width: artW, height: artH } = artworkRaster;
    const scale = Math.min(1, MAX_PREVIEW_DIM / Math.max(artW, artH));
    const dispW = Math.max(1, Math.round(artW * scale));
    const dispH = Math.max(1, Math.round(artH * scale));

    const canvas = canvasRef.current;
    if (canvas.width !== dispW || canvas.height !== dispH) {
      canvas.width = dispW;
      canvas.height = dispH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dispW, dispH);
    ctx.fillStyle = '#142744';
    ctx.fillRect(0, 0, dispW, dispH);

    if (baseCanvasRef.current) {
      ctx.drawImage(baseCanvasRef.current, 0, 0, dispW, dispH);
    }

    const subRaster = extractBoxSubRaster(
      artworkRaster,
      clampedOptions.x,
      clampedOptions.y,
      clampedOptions.boxSize,
    );
    const { raster: blendedBox } = overlayQrIntoArtwork(subRaster, previewQrMatrix, {
      x: 0,
      y: 0,
      boxSize: clampedOptions.boxSize,
      opacity: clampedOptions.opacity,
      style: clampedOptions.style,
      eccLevel: clampedOptions.eccLevel,
      quietZoneModules: clampedOptions.quietZoneModules,
    });

    if (typeof document !== 'undefined') {
      const boxCanvas = document.createElement('canvas');
      boxCanvas.width = blendedBox.width;
      boxCanvas.height = blendedBox.height;
      const bctx = boxCanvas.getContext('2d');
      if (bctx && blendedBox.width > 0 && blendedBox.height > 0) {
        try {
          const copy = new Uint8ClampedArray(blendedBox.data.length);
          copy.set(blendedBox.data);
          bctx.putImageData(new ImageData(copy, blendedBox.width, blendedBox.height), 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            boxCanvas,
            clampedOptions.x * scale,
            clampedOptions.y * scale,
            clampedOptions.boxSize * scale,
            clampedOptions.boxSize * scale,
          );
        } catch {
          // Guard against transient malformed box ImageData sizes
        }
      }
    }

    const gx = Math.round(clampedOptions.x * scale) + 0.5;
    const gy = Math.round(clampedOptions.y * scale) + 0.5;
    const gs = Math.max(8, Math.round(clampedOptions.boxSize * scale) - 1);
    ctx.save();
    if (highlightMask) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
      ctx.fillRect(gx, gy, gs, gs);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.98)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(gx, gy, gs, gs);
    } else {
      ctx.strokeStyle = 'rgba(61, 115, 197, 0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(gx, gy, gs, gs);
    }
    ctx.restore();

    const timer = window.setTimeout(() => {
      const decoded = decodeQrFromCanonicalRaster(blendedBox);
      setIsScannable(decoded !== null && decoded.rawText === samplePreviewText);
      setReadability(
        evaluateInImageQrReadability({
          blendedBox,
          qr: previewQrMatrix,
          quietZoneModules: clampedOptions.quietZoneModules,
        }),
      );
    }, 90);

    return () => window.clearTimeout(timer);
  }, [artworkRaster, clampedOptions, highlightMask, previewQrMatrix, samplePreviewText]);

  const applyPreset = (
    preset: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center',
  ) => {
    const w = artworkRaster.width;
    const h = artworkRaster.height;
    const box = clampedOptions.boxSize;
    const pad = Math.min(24, Math.floor(Math.min(w, h) * 0.05));

    if (preset === 'topLeft') {
      onChangeX(pad);
      onChangeY(pad);
    } else if (preset === 'topRight') {
      onChangeX(Math.max(0, w - box - pad));
      onChangeY(pad);
    } else if (preset === 'bottomLeft') {
      onChangeX(pad);
      onChangeY(Math.max(0, h - box - pad));
    } else if (preset === 'bottomRight') {
      onChangeX(Math.max(0, w - box - pad));
      onChangeY(Math.max(0, h - box - pad));
    } else {
      onChangeX(Math.max(0, Math.floor((w - box) / 2)));
      onChangeY(Math.max(0, Math.floor((h - box) / 2)));
    }
  };

  const clientToArtworkCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ax = ((clientX - rect.left) / rect.width) * artworkRaster.width;
    const ay = ((clientY - rect.top) / rect.height) * artworkRaster.height;
    return { ax, ay };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = clientToArtworkCoords(e.clientX, e.clientY);
    if (!coords) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const insideBox =
      coords.ax >= clampedOptions.x &&
      coords.ax <= clampedOptions.x + clampedOptions.boxSize &&
      coords.ay >= clampedOptions.y &&
      coords.ay <= clampedOptions.y + clampedOptions.boxSize;

    const offsetX = insideBox ? coords.ax - clampedOptions.x : clampedOptions.boxSize / 2;
    const offsetY = insideBox ? coords.ay - clampedOptions.y : clampedOptions.boxSize / 2;

    dragStateRef.current = { active: true, offsetX, offsetY };

    if (!insideBox) {
      const nextX = Math.max(
        0,
        Math.min(artworkRaster.width - clampedOptions.boxSize, Math.round(coords.ax - offsetX)),
      );
      const nextY = Math.max(
        0,
        Math.min(artworkRaster.height - clampedOptions.boxSize, Math.round(coords.ay - offsetY)),
      );
      onChangeX(nextX);
      onChangeY(nextY);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.active) return;
    const coords = clientToArtworkCoords(e.clientX, e.clientY);
    if (!coords) return;
    const nextX = Math.max(
      0,
      Math.min(
        artworkRaster.width - clampedOptions.boxSize,
        Math.round(coords.ax - dragStateRef.current.offsetX),
      ),
    );
    const nextY = Math.max(
      0,
      Math.min(
        artworkRaster.height - clampedOptions.boxSize,
        Math.round(coords.ay - dragStateRef.current.offsetY),
      ),
    );
    onChangeX(nextX);
    onChangeY(nextY);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragStateRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? 20 : 2;
    const maxX = Math.max(0, artworkRaster.width - clampedOptions.boxSize);
    const maxY = Math.max(0, artworkRaster.height - clampedOptions.boxSize);
    let nextX = clampedOptions.x;
    let nextY = clampedOptions.y;

    if (e.key === 'ArrowLeft') {
      nextX = Math.max(0, clampedOptions.x - step);
    } else if (e.key === 'ArrowRight') {
      nextX = Math.min(maxX, clampedOptions.x + step);
    } else if (e.key === 'ArrowUp') {
      nextY = Math.max(0, clampedOptions.y - step);
    } else if (e.key === 'ArrowDown') {
      nextY = Math.min(maxY, clampedOptions.y + step);
    } else {
      return;
    }

    e.preventDefault();
    if (nextX !== clampedOptions.x) onChangeX(nextX);
    if (nextY !== clampedOptions.y) onChangeY(nextY);
    setKbAnnouncement(
      t.a11y.qrPositionAnnounce.replace('{x}', String(nextX)).replace('{y}', String(nextY)),
    );
  };

  const coverageTone =
    coverageStats.tier === 'high'
      ? 'ga-status-error'
      : coverageStats.tier === 'caution'
        ? 'ga-status-warning'
        : 'ga-status-info';

  const coverageTierLabel =
    coverageStats.tier === 'high'
      ? t.hardening.qrMaskSafety.tierHigh
      : coverageStats.tier === 'caution'
        ? t.hardening.qrMaskSafety.tierCaution
        : t.hardening.qrMaskSafety.tierOk;

  return (
    <div
      data-testid="qrstudio-panel"
      className="ga-card rounded-2xl p-3 sm:p-4 space-y-4 min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium ga-text">
          <Move className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
          <span>{t.qrStudio.previewTitle}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            data-testid="qrstudio-coverage-badge"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${coverageTone}`}
          >
            <span>
              {t.hardening.qrMaskSafety.coverageLabel}: {coverageStats.coveragePct}%
            </span>
            <span className="opacity-80">· {coverageTierLabel}</span>
          </div>

          <div
            data-testid="qrstudio-readability-badge"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              isScannable ? 'ga-status-success' : 'ga-status-warning'
            }`}
          >
            {isScannable ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{isScannable ? t.qrStudio.readabilityOk : t.qrStudio.readabilityWarn}</span>
          </div>
        </div>
      </div>

      {coverageStats.tier !== 'ok' && (
        <div
          role="note"
          data-testid="qrstudio-coverage-warning"
          className={`rounded-xl border px-3 py-2 text-xs leading-relaxed flex items-start gap-2 ${
            coverageStats.tier === 'high' ? 'ga-status-error' : 'ga-status-warning'
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {coverageStats.tier === 'high'
              ? t.hardening.qrMaskSafety.warnHigh
              : t.hardening.qrMaskSafety.warnCaution}
          </span>
        </div>
      )}

      {readability && (readability.tooSmall || readability.lowContrast) && (
        <div
          role="note"
          data-testid="qrstudio-readability-quality-warning"
          className="ga-status-warning rounded-xl border px-3 py-2 text-xs leading-relaxed space-y-1"
        >
          {readability.tooSmall && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                {t.uxGuidance.qrReadability.tooSmallWarning} (
                {t.uxGuidance.qrReadability.moduleSizeLabel}: {readability.pxPerModule}px)
              </span>
            </div>
          )}
          {readability.lowContrast && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                {t.uxGuidance.qrReadability.lowContrastWarning} (
                {t.uxGuidance.qrReadability.contrastRatioLabel}: {readability.contrastRatio}:1)
              </span>
            </div>
          )}
        </div>
      )}

      <div className="ga-surface-subtle flex flex-col items-center justify-center rounded-xl p-3 space-y-2">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label={t.a11y.qrCanvasAria}
          aria-describedby="qrstudio-kb-hint"
          data-testid="qrstudio-preview-canvas"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          onKeyDown={handleCanvasKeyDown}
          className="max-h-[360px] max-w-full w-auto h-auto rounded cursor-grab active:cursor-grabbing touch-none select-none"
        />
        <p id="qrstudio-kb-hint" className="text-[11px] ga-text-muted text-center">
          {t.a11y.qrCanvasKeyboardHint}
        </p>
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {kbAnnouncement}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={highlightMask}
            data-testid="qrstudio-highlight-mask-toggle"
            onClick={() => setHighlightMask((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors min-h-[40px] cursor-pointer ${
              highlightMask ? 'ga-status-warning' : 'ga-btn-secondary'
            }`}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.hardening.qrMaskSafety.highlightToggle}</span>
          </button>

          {onChangeBoxSize && (
            <button
              type="button"
              data-testid="qrstudio-optimize-size-btn"
              onClick={() => {
                onChangeBoxSize(recommendedBoxSize);
                setOptimizedHintVisible(true);
              }}
              className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium min-h-[40px] cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--ga-accent)]" aria-hidden="true" />
              <span>
                {t.hardening.qrMaskSafety.optimizeSizeBtn} ({recommendedBoxSize}px)
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs ga-text-muted me-1">{t.qrStudio.presetsLabel}</span>
          {(
            [
              ['topLeft', t.qrStudio.presets.topLeft],
              ['topRight', t.qrStudio.presets.topRight],
              ['bottomLeft', t.qrStudio.presets.bottomLeft],
              ['bottomRight', t.qrStudio.presets.bottomRight],
              ['center', t.qrStudio.presets.center],
            ] as const
          ).map(([presetKey, label]) => (
            <button
              key={presetKey}
              type="button"
              onClick={() => applyPreset(presetKey)}
              data-testid={`qrstudio-preset-${presetKey}`}
              className="ga-btn-secondary rounded-xl px-3 py-1.5 text-xs font-medium transition-colors min-h-[40px] cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {optimizedHintVisible && (
        <p role="status" className="text-[11px] text-[var(--ga-accent)]">
          {t.hardening.qrMaskSafety.appliedHint} ({recommendedBoxSize} × {recommendedBoxSize} px)
        </p>
      )}
    </div>
  );
}

export interface InImageAdvancedControlsProps {
  artworkRaster: CanonicalRaster | null;
  clampedOptions: ClampedInImageQrOptions | null;
  qrX: number;
  qrY: number;
  qrBoxSize: number;
  qrOpacityPct: number;
  qrStyle: InImageQrStyle;
  eccLevel: QrErrorCorrectionLevel;
  qrQuietZone?: number;
  onChangeX: (x: number) => void;
  onChangeY: (y: number) => void;
  onChangeBoxSize: (size: number) => void;
  onChangeOpacityPct: (pct: number) => void;
  onChangeStyle: (style: InImageQrStyle) => void;
  onChangeEcc: (ecc: QrErrorCorrectionLevel) => void;
  onChangeQuietZone?: (quietZone: number) => void;
}

export function InImageAdvancedControls({
  artworkRaster,
  clampedOptions,
  qrX,
  qrY,
  qrBoxSize,
  qrOpacityPct,
  qrStyle,
  eccLevel,
  qrQuietZone = 1,
  onChangeX,
  onChangeY,
  onChangeBoxSize,
  onChangeOpacityPct,
  onChangeStyle,
  onChangeEcc,
  onChangeQuietZone,
}: InImageAdvancedControlsProps) {
  const { t } = useI18n();
  const maxBoxSize = artworkRaster ? Math.min(artworkRaster.width, artworkRaster.height) : 480;
  const minBoxSize = Math.min(maxBoxSize, 64);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs ga-text-secondary">
            <label htmlFor="qrX">{t.qrStudio.xLabel}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={
                  artworkRaster && clampedOptions
                    ? Math.max(0, artworkRaster.width - clampedOptions.boxSize)
                    : 1000
                }
                value={clampedOptions?.x ?? qrX}
                onChange={(e) => onChangeX(Number(e.target.value))}
                aria-label={t.a11y.qrXNumberAria}
                data-testid="qrstudio-x-number"
                className="ga-input w-20 rounded-lg px-2 py-0.5 text-xs font-mono text-end"
              />
              <span className="font-mono ga-text-muted" aria-hidden="true">px</span>
            </div>
          </div>
          <input
            id="qrX"
            type="range"
            min={0}
            max={
              artworkRaster && clampedOptions
                ? Math.max(0, artworkRaster.width - clampedOptions.boxSize)
                : 1000
            }
            value={clampedOptions?.x ?? qrX}
            onChange={(e) => onChangeX(Number(e.target.value))}
            data-testid="qrstudio-x-slider"
            className="w-full accent-[var(--ga-primary-bg)] mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 text-xs ga-text-secondary">
            <label htmlFor="qrY">{t.qrStudio.yLabel}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={
                  artworkRaster && clampedOptions
                    ? Math.max(0, artworkRaster.height - clampedOptions.boxSize)
                    : 1000
                }
                value={clampedOptions?.y ?? qrY}
                onChange={(e) => onChangeY(Number(e.target.value))}
                aria-label={t.a11y.qrYNumberAria}
                data-testid="qrstudio-y-number"
                className="ga-input w-20 rounded-lg px-2 py-0.5 text-xs font-mono text-end"
              />
              <span className="font-mono ga-text-muted" aria-hidden="true">px</span>
            </div>
          </div>
          <input
            id="qrY"
            type="range"
            min={0}
            max={
              artworkRaster && clampedOptions
                ? Math.max(0, artworkRaster.height - clampedOptions.boxSize)
                : 1000
            }
            value={clampedOptions?.y ?? qrY}
            onChange={(e) => onChangeY(Number(e.target.value))}
            data-testid="qrstudio-y-slider"
            className="w-full accent-[var(--ga-primary-bg)] mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 text-xs ga-text-secondary">
            <label htmlFor="qrBoxSize">{t.qrStudio.sizeLabel}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={minBoxSize}
                max={maxBoxSize}
                value={clampedOptions?.boxSize ?? qrBoxSize}
                onChange={(e) => onChangeBoxSize(Number(e.target.value))}
                aria-label={t.a11y.qrSizeNumberAria}
                data-testid="qrstudio-size-number"
                className="ga-input w-20 rounded-lg px-2 py-0.5 text-xs font-mono text-end"
              />
              <span className="font-mono ga-text-muted" aria-hidden="true">px</span>
            </div>
          </div>
          <input
            id="qrBoxSize"
            type="range"
            min={minBoxSize}
            max={maxBoxSize}
            value={clampedOptions?.boxSize ?? qrBoxSize}
            onChange={(e) => onChangeBoxSize(Number(e.target.value))}
            data-testid="qrstudio-size-slider"
            className="w-full accent-[var(--ga-primary-bg)] mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 text-xs ga-text-secondary">
            <label htmlFor="qrOpacity">{t.qrStudio.opacityLabel}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={20}
                max={100}
                step={1}
                value={qrOpacityPct}
                onChange={(e) => onChangeOpacityPct(Number(e.target.value))}
                aria-label={t.a11y.qrOpacityNumberAria}
                data-testid="qrstudio-opacity-number"
                className="ga-input w-20 rounded-lg px-2 py-0.5 text-xs font-mono text-end"
              />
              <span className="font-mono ga-text-muted" aria-hidden="true">%</span>
            </div>
          </div>
          <input
            id="qrOpacity"
            type="range"
            min={20}
            max={100}
            step={1}
            value={qrOpacityPct}
            onChange={(e) => onChangeOpacityPct(Number(e.target.value))}
            data-testid="qrstudio-opacity-slider"
            className="w-full accent-[var(--ga-primary-bg)] mt-1"
          />
        </div>

        <div>
          <label htmlFor="qrStyle" className="block text-xs ga-text-secondary mb-1">
            {t.qrStudio.styleLabel}
          </label>
          <select
            id="qrStyle"
            value={qrStyle}
            onChange={(e) => onChangeStyle(e.target.value as InImageQrStyle)}
            data-testid="qrstudio-style-select"
            className="ga-input w-full rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
          >
            <option value="frosted-light">{t.qrStudio.styles['frosted-light']}</option>
            <option value="frosted-dark">{t.qrStudio.styles['frosted-dark']}</option>
            <option value="modules-dark">{t.qrStudio.styles['modules-dark']}</option>
            <option value="modules-light">{t.qrStudio.styles['modules-light']}</option>
          </select>
        </div>

        <div>
          <label htmlFor="eccLevel" className="block text-xs ga-text-secondary mb-1">
            {t.qrStudio.eccLabel}
          </label>
          <select
            id="eccLevel"
            value={eccLevel}
            onChange={(e) => onChangeEcc(e.target.value as QrErrorCorrectionLevel)}
            data-testid="qrstudio-ecc-select"
            className="ga-input w-full rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
          >
            <option value="M">{t.qrStudio.eccOptions.M}</option>
            <option value="Q">{t.qrStudio.eccOptions.Q}</option>
            <option value="H">{t.qrStudio.eccOptions.H}</option>
          </select>
        </div>

        {onChangeQuietZone && (
          <div className="sm:col-span-2">
            <label htmlFor="qrQuietZone" className="block text-xs ga-text-secondary mb-1">
              {t.minimal.create.quietZoneLabel}
            </label>
            <select
              id="qrQuietZone"
              value={qrQuietZone}
              onChange={(e) => onChangeQuietZone(Number(e.target.value))}
              data-testid="qrstudio-quietzone-select"
              className="ga-input w-full rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
            >
              <option value={0}>{t.minimal.create.quietZoneNone}</option>
              <option value={1}>{t.minimal.create.quietZoneMinimal}</option>
              <option value={2}>{t.minimal.create.quietZoneCompact}</option>
            </select>
          </div>
        )}
      </div>

      {clampedOptions && (
        <div className="ga-surface-subtle rounded-xl p-3 text-xs ga-text-secondary space-y-1">
          <div className="font-mono text-[var(--ga-accent)]">
            {t.qrStudio.maskRegionLabel}: [{clampedOptions.x}, {clampedOptions.y},{' '}
            {clampedOptions.boxSize}, {clampedOptions.boxSize}]
          </div>
          <p className="text-[11px] ga-text-muted leading-relaxed">{t.qrStudio.maskedDigestNote}</p>
        </div>
      )}
    </div>
  );
}
