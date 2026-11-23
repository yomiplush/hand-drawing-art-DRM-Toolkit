import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Move } from 'lucide-react';
import { overlayQrIntoArtwork } from '../core/image/inImageQr';
import type { ClampedInImageQrOptions, InImageQrStyle } from '../core/image/inImageQr';
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
}

export function InImageQrStudioPanel({
  artworkRaster,
  clampedOptions,
  eccLevel,
  verifyBaseUrl,
  estimatedProofTokenChars = 310,
  onChangeX,
  onChangeY,
}: InImageQrStudioPanelProps) {
  const { t } = useI18n();
  const [isScannable, setIsScannable] = useState<boolean>(true);

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

  useEffect(() => {
    if (typeof document === 'undefined') {
      baseCanvasRef.current = null;
      return;
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = artworkRaster.width;
    offscreen.height = artworkRaster.height;
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      const clampedCopy = new Uint8ClampedArray(artworkRaster.data.length);
      clampedCopy.set(artworkRaster.data);
      ctx.putImageData(
        new ImageData(clampedCopy, artworkRaster.width, artworkRaster.height),
        0,
        0,
      );
    }
    baseCanvasRef.current = offscreen;
  }, [artworkRaster]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const previewQrMatrix = generateQrMatrix(samplePreviewText, eccLevel);
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
    ctx.fillStyle = '#0b1628';
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
    });

    if (typeof document !== 'undefined') {
      const boxCanvas = document.createElement('canvas');
      boxCanvas.width = blendedBox.width;
      boxCanvas.height = blendedBox.height;
      const bctx = boxCanvas.getContext('2d');
      if (bctx) {
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
      }
    }

    const gx = Math.round(clampedOptions.x * scale) + 0.5;
    const gy = Math.round(clampedOptions.y * scale) + 0.5;
    const gs = Math.max(8, Math.round(clampedOptions.boxSize * scale) - 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(gx, gy, gs, gs);
    ctx.restore();

    const timer = window.setTimeout(() => {
      const decoded = decodeQrFromCanonicalRaster(blendedBox);
      setIsScannable(decoded !== null && decoded.rawText === samplePreviewText);
    }, 90);

    return () => window.clearTimeout(timer);
  }, [artworkRaster, clampedOptions, eccLevel, samplePreviewText]);

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

  return (
    <div
      data-testid="qrstudio-panel"
      className="rounded-xl border border-sky-400/25 bg-[#041021]/70 p-4 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-200">
          <Move className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
          <span>{t.qrStudio.previewTitle}</span>
        </div>

        <div
          data-testid="qrstudio-readability-badge"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            isScannable
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
              : 'border-amber-400/45 bg-amber-500/15 text-amber-200'
          }`}
        >
          {isScannable ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300 shrink-0" aria-hidden="true" />
          )}
          <span>{isScannable ? t.qrStudio.readabilityOk : t.qrStudio.readabilityWarn}</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#020813]/85 p-3">
        <canvas
          ref={canvasRef}
          data-testid="qrstudio-preview-canvas"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          className="max-h-[360px] max-w-full w-auto h-auto rounded cursor-grab active:cursor-grabbing touch-none select-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{t.qrStudio.presetsLabel}</span>
        <div className="flex flex-wrap gap-1.5">
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
              className="rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400/50 hover:text-white transition-colors min-h-[38px] cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
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
  onChangeX: (x: number) => void;
  onChangeY: (y: number) => void;
  onChangeBoxSize: (size: number) => void;
  onChangeOpacityPct: (pct: number) => void;
  onChangeStyle: (style: InImageQrStyle) => void;
  onChangeEcc: (ecc: QrErrorCorrectionLevel) => void;
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
  onChangeX,
  onChangeY,
  onChangeBoxSize,
  onChangeOpacityPct,
  onChangeStyle,
  onChangeEcc,
}: InImageAdvancedControlsProps) {
  const { t } = useI18n();
  const maxBoxSize = artworkRaster ? Math.min(artworkRaster.width, artworkRaster.height) : 480;
  const minBoxSize = Math.min(maxBoxSize, 64);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="qrX" className="flex justify-between text-xs text-slate-300">
            <span>{t.qrStudio.xLabel}</span>
            <span className="font-mono text-white">{clampedOptions?.x ?? qrX} px</span>
          </label>
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
            className="w-full accent-sky-300 mt-1"
          />
        </div>

        <div>
          <label htmlFor="qrY" className="flex justify-between text-xs text-slate-300">
            <span>{t.qrStudio.yLabel}</span>
            <span className="font-mono text-white">{clampedOptions?.y ?? qrY} px</span>
          </label>
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
            className="w-full accent-sky-300 mt-1"
          />
        </div>

        <div>
          <label htmlFor="qrBoxSize" className="flex justify-between text-xs text-slate-300">
            <span>{t.qrStudio.sizeLabel}</span>
            <span className="font-mono text-white">{clampedOptions?.boxSize ?? qrBoxSize} px</span>
          </label>
          <input
            id="qrBoxSize"
            type="range"
            min={minBoxSize}
            max={maxBoxSize}
            value={clampedOptions?.boxSize ?? qrBoxSize}
            onChange={(e) => onChangeBoxSize(Number(e.target.value))}
            data-testid="qrstudio-size-slider"
            className="w-full accent-sky-300 mt-1"
          />
        </div>

        <div>
          <label htmlFor="qrOpacity" className="flex justify-between text-xs text-slate-300">
            <span>{t.qrStudio.opacityLabel}</span>
            <span className="font-mono text-white">{qrOpacityPct}%</span>
          </label>
          <input
            id="qrOpacity"
            type="range"
            min={20}
            max={100}
            step={1}
            value={qrOpacityPct}
            onChange={(e) => onChangeOpacityPct(Number(e.target.value))}
            data-testid="qrstudio-opacity-slider"
            className="w-full accent-sky-300 mt-1"
          />
        </div>

        <div>
          <label htmlFor="qrStyle" className="block text-xs text-slate-300 mb-1">
            {t.qrStudio.styleLabel}
          </label>
          <select
            id="qrStyle"
            value={qrStyle}
            onChange={(e) => onChangeStyle(e.target.value as InImageQrStyle)}
            data-testid="qrstudio-style-select"
            className="w-full rounded-lg border border-white/[0.14] bg-[#061224] px-3 py-2 text-xs sm:text-sm text-white min-h-[44px]"
          >
            <option value="frosted-light">{t.qrStudio.styles['frosted-light']}</option>
            <option value="frosted-dark">{t.qrStudio.styles['frosted-dark']}</option>
            <option value="modules-dark">{t.qrStudio.styles['modules-dark']}</option>
            <option value="modules-light">{t.qrStudio.styles['modules-light']}</option>
          </select>
        </div>

        <div>
          <label htmlFor="eccLevel" className="block text-xs text-slate-300 mb-1">
            {t.qrStudio.eccLabel}
          </label>
          <select
            id="eccLevel"
            value={eccLevel}
            onChange={(e) => onChangeEcc(e.target.value as QrErrorCorrectionLevel)}
            data-testid="qrstudio-ecc-select"
            className="w-full rounded-lg border border-white/[0.14] bg-[#061224] px-3 py-2 text-xs sm:text-sm text-white min-h-[44px]"
          >
            <option value="M">{t.qrStudio.eccOptions.M}</option>
            <option value="Q">{t.qrStudio.eccOptions.Q}</option>
            <option value="H">{t.qrStudio.eccOptions.H}</option>
          </select>
        </div>
      </div>

      {clampedOptions && (
        <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3 text-xs text-slate-300 space-y-1">
          <div className="font-mono text-sky-300">
            {t.qrStudio.maskRegionLabel}: [{clampedOptions.x}, {clampedOptions.y},{' '}
            {clampedOptions.boxSize}, {clampedOptions.boxSize}]
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">{t.qrStudio.maskedDigestNote}</p>
        </div>
      )}
    </div>
  );
}
