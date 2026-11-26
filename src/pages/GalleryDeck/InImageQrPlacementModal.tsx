import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Check, Move, QrCode, X } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import type { GalleryArtworkItem } from '../../types/gallerydeck';

export interface InImageQrPlacementSelection {
  x: number;
  y: number;
  boxSize: number;
  opacity: number;
}

type PresetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center' | 'custom';

interface InImageQrPlacementModalProps {
  open: boolean;
  item: GalleryArtworkItem | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (placement: InImageQrPlacementSelection) => Promise<void>;
}

function computePresetCoords(
  preset: Exclude<PresetPosition, 'custom'>,
  width: number,
  height: number,
  boxSize: number,
): { x: number; y: number } {
  const margin = 16;
  const maxX = Math.max(0, width - boxSize);
  const maxY = Math.max(0, height - boxSize);

  switch (preset) {
    case 'top-left':
      return { x: Math.min(margin, maxX), y: Math.min(margin, maxY) };
    case 'top-right':
      return { x: Math.max(0, width - boxSize - margin), y: Math.min(margin, maxY) };
    case 'bottom-left':
      return { x: Math.min(margin, maxX), y: Math.max(0, height - boxSize - margin) };
    case 'center':
      return { x: Math.round(maxX / 2), y: Math.round(maxY / 2) };
    case 'bottom-right':
    default:
      return {
        x: Math.max(0, width - boxSize - margin),
        y: Math.max(0, height - boxSize - margin),
      };
  }
}

export function InImageQrPlacementModal(props: InImageQrPlacementModalProps) {
  if (!props.open || !props.item) return null;
  return <InImageQrPlacementModalBody {...props} item={props.item} />;
}

function InImageQrPlacementModalBody({
  item,
  busy,
  onCancel,
  onConfirm,
}: Omit<InImageQrPlacementModalProps, 'item'> & { item: GalleryArtworkItem }) {
  const { locale } = useI18n();
  const isJa = locale === 'ja';

  const artWidth = Math.max(120, item.width || 1024);
  const artHeight = Math.max(120, item.height || 1024);
  const minDim = Math.min(artWidth, artHeight);
  const minBoxSize = Math.max(64, Math.min(96, Math.round(minDim * 0.12)));
  const maxBoxSize = Math.max(minBoxSize + 32, Math.min(360, Math.round(minDim * 0.45)));
  const defaultBoxSize = Math.max(minBoxSize, Math.min(200, Math.round(minDim * 0.18)));

  const [boxSize, setBoxSize] = useState<number>(defaultBoxSize);
  const [opacityPct, setOpacityPct] = useState<number>(85);
  const [preset, setPreset] = useState<PresetPosition>('bottom-right');
  const [coords, setCoords] = useState<{ x: number; y: number }>(() =>
    computePresetCoords('bottom-right', artWidth, artHeight, defaultBoxSize),
  );
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const applyPreset = (nextPreset: Exclude<PresetPosition, 'custom'>) => {
    setPreset(nextPreset);
    setCoords(computePresetCoords(nextPreset, artWidth, artHeight, boxSize));
  };

  const handleBoxSizeChange = (nextSize: number) => {
    setBoxSize(nextSize);
    if (preset !== 'custom') {
      setCoords(computePresetCoords(preset, artWidth, artHeight, nextSize));
    } else {
      setCoords((prev) => ({
        x: Math.max(0, Math.min(artWidth - nextSize, prev.x)),
        y: Math.max(0, Math.min(artHeight - nextSize, prev.y)),
      }));
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pointerArtX = ((e.clientX - rect.left) / rect.width) * artWidth;
    const pointerArtY = ((e.clientY - rect.top) / rect.height) * artHeight;
    dragOffsetRef.current = {
      dx: pointerArtX - coords.x,
      dy: pointerArtY - coords.y,
    };
    setPreset('custom');
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pointerArtX = ((e.clientX - rect.left) / rect.width) * artWidth;
    const pointerArtY = ((e.clientY - rect.top) / rect.height) * artHeight;
    const nextX = Math.round(
      Math.max(0, Math.min(artWidth - boxSize, pointerArtX - dragOffsetRef.current.dx)),
    );
    const nextY = Math.round(
      Math.max(0, Math.min(artHeight - boxSize, pointerArtY - dragOffsetRef.current.dy)),
    );
    setCoords({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const leftPct = (coords.x / artWidth) * 100;
  const topPct = (coords.y / artHeight) * 100;
  const widthPct = (boxSize / artWidth) * 100;
  const heightPct = (boxSize / artHeight) * 100;

  const presetButtons: Array<{ id: PresetPosition; label: string }> = [
    { id: 'bottom-right', label: isJa ? '右下' : 'Bottom Right' },
    { id: 'bottom-left', label: isJa ? '左下' : 'Bottom Left' },
    { id: 'top-right', label: isJa ? '右上' : 'Top Right' },
    { id: 'top-left', label: isJa ? '左上' : 'Top Left' },
    { id: 'center', label: isJa ? '中央' : 'Center' },
    { id: 'custom', label: isJa ? '自由に編集' : 'Free Drag' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isJa ? 'QRコードの位置をプレビュー調整' : 'Adjust In-Image QR Placement'}
      data-testid="gallerydeck-qr-placement-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#041226]/82 backdrop-blur-md p-3 sm:p-5"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-sky-400/35 bg-gradient-to-b from-[#071c38]/95 to-[#041328]/98 text-sky-50 shadow-[0_24px_80px_rgba(3,18,42,0.75)] p-4 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold ga-text flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[var(--ga-accent)] shrink-0" />
              <span>{isJa ? '絵の中のQRコード位置を調整' : 'Adjust In-Image QR Placement'}</span>
            </h2>
            <p className="text-xs ga-text-secondary mt-0.5">
              {isJa
                ? 'プリセットを選ぶか、プレビュー上のQR枠をドラッグして自由に配置できます。'
                : 'Pick a preset or drag the QR overlay directly on the preview.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={isJa ? '閉じる' : 'Close'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full ga-btn-secondary cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-2">
          {presetButtons.map((btn) => {
            const active = preset === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                data-testid={`qr-preset-${btn.id}`}
                onClick={() => {
                  if (btn.id === 'custom') {
                    setPreset('custom');
                  } else {
                    applyPreset(btn.id);
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--ga-accent)] bg-[var(--ga-accent-soft)] text-[var(--ga-accent)] font-semibold'
                    : 'ga-border ga-surface-subtle ga-text-secondary hover:ga-text'
                }`}
              >
                {btn.id === 'custom' && <Move className="h-3.5 w-3.5" />}
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Interactive Preview */}
        <div className="flex justify-center rounded-2xl border ga-border bg-black/35 p-3 sm:p-4">
          <div
            ref={stageRef}
            className="relative inline-block max-w-full max-h-[48vh] select-none overflow-hidden rounded-lg"
            style={{ aspectRatio: `${artWidth} / ${artHeight}` }}
          >
            <img
              src={item.thumbnailDataUrl}
              alt={item.title}
              draggable={false}
              className="block h-full w-full object-contain pointer-events-none"
            />
            <div
              role="presentation"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              data-testid="qr-placement-overlay"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                opacity: opacityPct / 100,
              }}
              className={`absolute flex flex-col items-center justify-center rounded-md border-2 border-cyan-300 bg-white/90 text-slate-900 shadow-lg touch-none ${
                dragging ? 'cursor-grabbing ring-2 ring-cyan-400' : 'cursor-grab'
              }`}
            >
              <QrCode className="h-1/2 w-1/2 text-slate-900" />
              <span className="text-[9px] font-mono font-bold tracking-tight text-slate-800 leading-none">
                QR
              </span>
            </div>
          </div>
        </div>

        {/* Size & Opacity Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 text-xs ga-text-secondary">
            <div className="flex items-center justify-between">
              <span>{isJa ? 'QRサイズ' : 'QR Size'}</span>
              <span className="font-mono ga-text">{boxSize}px</span>
            </div>
            <input
              type="range"
              min={minBoxSize}
              max={maxBoxSize}
              value={boxSize}
              onChange={(e) => handleBoxSizeChange(Number(e.target.value))}
              className="w-full accent-[var(--ga-accent)] cursor-pointer"
            />
          </label>

          <label className="space-y-1.5 text-xs ga-text-secondary">
            <div className="flex items-center justify-between">
              <span>{isJa ? '不透明度' : 'Opacity'}</span>
              <span className="font-mono ga-text">{opacityPct}%</span>
            </div>
            <input
              type="range"
              min={45}
              max={100}
              value={opacityPct}
              onChange={(e) => setOpacityPct(Number(e.target.value))}
              className="w-full accent-[var(--ga-accent)] cursor-pointer"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t ga-border">
          <span className="font-mono text-[11px] ga-text-muted">
            X: {coords.x}px / Y: {coords.y}px ({artWidth}×{artHeight})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="ga-btn-secondary rounded-xl px-4 py-2 text-xs sm:text-sm font-medium cursor-pointer"
            >
              {isJa ? 'キャンセル' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="qr-placement-confirm-btn"
              onClick={() =>
                void onConfirm({
                  x: coords.x,
                  y: coords.y,
                  boxSize,
                  opacity: opacityPct / 100,
                })
              }
              className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>
                {busy
                  ? isJa
                    ? '証明を作成中…'
                    : 'Certifying…'
                  : isJa
                    ? 'この位置で証明する'
                    : 'Certify at This Position'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
