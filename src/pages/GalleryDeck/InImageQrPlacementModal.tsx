import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, FileSignature, Globe, HelpCircle, Move, QrCode, Share2, X } from 'lucide-react';
import { LicenseSummaryCard } from '../../components/LicenseSummaryCard';
import { LICENSE_DEFINITIONS } from '../../core/manifest/types';
import type { CompactSnsLink, LicenseId } from '../../core/manifest/types';
import { useI18n } from '../../i18n/context';
import type { GalleryArtworkItem } from '../../types/gallerydeck';

export interface InImageQrPlacementSelection {
  x: number;
  y: number;
  boxSize: number;
  opacity: number;
}

export interface CertifyModalSubmission {
  authorName: string;
  artworkTitle: string;
  licenseId: LicenseId;
  qrMode: 'in-image' | 'outer-border';
  description?: string;
  website?: string;
  snsLinks?: CompactSnsLink[];
  inImagePlacement?: InImageQrPlacementSelection;
}

type PresetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center' | 'custom';

interface InImageQrPlacementModalProps {
  open: boolean;
  item: GalleryArtworkItem | null;
  initialLicenseId: LicenseId;
  initialQrMode: 'in-image' | 'outer-border';
  busy: boolean;
  onCancel: () => void;
  onConfirm: (submission: CertifyModalSubmission) => Promise<void>;
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
  initialLicenseId,
  initialQrMode,
  busy,
  onCancel,
  onConfirm,
}: Omit<InImageQrPlacementModalProps, 'item'> & { item: GalleryArtworkItem }) {
  const { t, locale } = useI18n();
  const isJa = locale === 'ja';

  const [step, setStep] = useState<'info' | 'placement'>('info');
  const [authorName, setAuthorName] = useState<string>(item.authorName ?? '');
  const [artworkTitle, setArtworkTitle] = useState<string>(item.title ?? '');
  const [description, setDescription] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [snsLinksText, setSnsLinksText] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [licenseId, setLicenseId] = useState<LicenseId>(initialLicenseId);
  const [licenseHelpOpen, setLicenseHelpOpen] = useState(false);
  const [qrMode, setQrMode] = useState<'in-image' | 'outer-border'>(initialQrMode);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#create') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#create`);
    }
    return () => {
      if (window.location.hash === '#create') {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    };
  }, []);

  const parseSnsLinks = (raw: string): CompactSnsLink[] | undefined => {
    const urls = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (urls.length === 0) return undefined;
    return urls.map((url) => ({ url }));
  };

  const validateRequiredInfo = (): boolean => {
    if (!authorName.trim() || !artworkTitle.trim()) {
      setValidationError(
        isJa
          ? '作家名と作品タイトルは必須です。入力してください。'
          : 'Artist name and artwork title are required.',
      );
      return false;
    }
    setValidationError(null);
    return true;
  };

  const artWidth = Math.max(120, item.width || 1024);
  const artHeight = Math.max(120, item.height || 1024);
  const minDim = Math.min(artWidth, artHeight);
  const minBoxSize = Math.min(minDim, Math.max(240, Math.round(minDim * 0.26)));
  const maxBoxSize = Math.min(minDim, Math.max(minBoxSize + 64, Math.min(580, Math.round(minDim * 0.58))));
  const defaultBoxSize = Math.max(minBoxSize, Math.min(maxBoxSize, Math.round(minDim * 0.3)));

  const [boxSize, setBoxSize] = useState<number>(defaultBoxSize);
  const [opacityPct, setOpacityPct] = useState<number>(100);
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
      aria-label={isJa ? '作品情報の入力と証明作成' : 'Artwork Info & Certification'}
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
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              {step === 'info' ? (
                <FileSignature className="h-4 w-4 text-sky-400 shrink-0" />
              ) : (
                <QrCode className="h-4 w-4 text-sky-400 shrink-0" />
              )}
              <span>
                {step === 'info'
                  ? isJa
                    ? '作品情報を入力して証明を作成'
                    : 'Enter Artwork Info to Certify'
                  : isJa
                    ? '絵の中のQRコード位置を調整'
                    : 'Adjust In-Image QR Placement'}
              </span>
            </h2>
            <p className="text-xs text-sky-200/75 mt-0.5">
              {step === 'info'
                ? isJa
                  ? '作家名・タイトル・ライセンス・QR配置を確認して証明を付与します。'
                  : 'Confirm artist name, title, license, and QR placement before signing.'
                : isJa
                  ? 'プリセットを選ぶか、プレビュー上のQR枠をドラッグして自由に配置できます。'
                  : 'Pick a preset or drag the QR overlay directly on the preview.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={isJa ? '閉じる' : 'Close'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-900/60 hover:bg-sky-800/80 text-sky-100 cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'info' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-sky-200">
                  {t.simple.create.artistNameLabel} <span className="text-rose-400">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder={t.simple.create.artistNamePlaceholder}
                  data-testid="certify-modal-author-input"
                  className="w-full rounded-xl border border-sky-400/30 bg-[#04142b]/90 px-3 py-2.5 text-sm text-white placeholder:text-sky-300/40 focus:border-sky-400 focus:outline-none"
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-sky-200">
                  {isJa ? '作品タイトル' : 'Artwork Title'} <span className="text-rose-400">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={artworkTitle}
                  onChange={(e) => {
                    setArtworkTitle(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder={t.simple.create.titlePlaceholder}
                  data-testid="certify-modal-title-input"
                  className="w-full rounded-xl border border-sky-400/30 bg-[#04142b]/90 px-3 py-2.5 text-sm text-white placeholder:text-sky-300/40 focus:border-sky-400 focus:outline-none"
                />
              </label>
            </div>

            {/* Optional QR-embedded Artwork Details (Protocol v3) */}
            <div className="space-y-3 rounded-xl border border-sky-400/20 bg-sky-950/25 p-3.5">
              <p className="text-[11px] font-medium text-sky-300/90">
                {isJa
                  ? 'QRコード内に埋め込む追加情報（任意・検証時に表示）'
                  : 'Optional metadata embedded inside the QR code'}
              </p>
              <label className="space-y-1 block">
                <span className="text-xs text-sky-200/90">
                  {isJa ? '作品の内容・コメント' : 'Artwork Description'}
                </span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isJa ? '制作コンセプトや使用画材など…' : 'Concept, medium, or notes…'}
                  data-testid="certify-modal-description-input"
                  className="w-full rounded-xl border border-sky-400/25 bg-[#04142b]/90 px-3 py-2 text-xs text-white placeholder:text-sky-300/40 focus:border-sky-400 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="inline-flex items-center gap-1 text-xs text-sky-200/90">
                    <Globe className="h-3.5 w-3.5 text-sky-400" />
                    {isJa ? 'Webサイト / ポートフォリオ URL' : 'Website / Portfolio URL'}
                  </span>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    data-testid="certify-modal-website-input"
                    className="w-full rounded-xl border border-sky-400/25 bg-[#04142b]/90 px-3 py-2 text-xs text-white placeholder:text-sky-300/40 focus:border-sky-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="inline-flex items-center gap-1 text-xs text-sky-200/90">
                    <Share2 className="h-3.5 w-3.5 text-sky-400" />
                    {isJa ? 'SNSリンク（カンマまたは改行区切り）' : 'SNS Links (comma or newline separated)'}
                  </span>
                  <input
                    type="text"
                    value={snsLinksText}
                    onChange={(e) => setSnsLinksText(e.target.value)}
                    placeholder="https://x.com/yourhandle, https://pixiv.net/..."
                    data-testid="certify-modal-sns-input"
                    className="w-full rounded-xl border border-sky-400/25 bg-[#04142b]/90 px-3 py-2 text-xs text-white placeholder:text-sky-300/40 focus:border-sky-400 focus:outline-none"
                  />
                </label>
              </div>
            </div>

            {validationError && (
              <p role="alert" className="text-xs font-medium text-rose-300">
                {validationError}
              </p>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label htmlFor="certify-modal-license-select" className="text-xs font-medium text-sky-200">
                  {t.simple.create.licenseLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setLicenseHelpOpen(true)}
                  aria-label={isJa ? 'ライセンスの説明を見る' : 'View license guide'}
                  data-testid="certify-modal-license-help-btn"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/30 hover:text-white transition-colors cursor-pointer"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <select
                id="certify-modal-license-select"
                value={licenseId}
                onChange={(e) => setLicenseId(e.target.value as LicenseId)}
                data-testid="certify-modal-license-select"
                className="w-full rounded-xl border border-sky-400/30 bg-[#04142b]/90 px-3 py-2.5 text-sm text-white focus:border-sky-400 focus:outline-none"
              >
                {LICENSE_DEFINITIONS.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.id} — {lic.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-sky-200 block">
                {t.simple.create.qrStyleLabel}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup">
                <button
                  type="button"
                  role="radio"
                  aria-checked={qrMode === 'in-image'}
                  onClick={() => setQrMode('in-image')}
                  data-testid="certify-modal-qrmode-in-image"
                  className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    qrMode === 'in-image'
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-sky-400/20 bg-[#04142b]/60 text-sky-200/80 hover:border-sky-400/40'
                  }`}
                >
                  <div className="text-xs font-semibold">{t.simple.create.styleInsideTitle}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{t.simple.create.styleInsideDesc}</div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={qrMode === 'outer-border'}
                  onClick={() => setQrMode('outer-border')}
                  data-testid="certify-modal-qrmode-outer-border"
                  className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    qrMode === 'outer-border'
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-sky-400/20 bg-[#04142b]/60 text-sky-200/80 hover:border-sky-400/40'
                  }`}
                >
                  <div className="text-xs font-semibold">{t.simple.create.styleOuterTitle}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{t.simple.create.styleOuterDesc}</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-sky-400/20">
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-xl border border-sky-400/30 bg-sky-950/60 hover:bg-sky-900/70 px-4 py-2 text-xs sm:text-sm font-medium text-sky-100 cursor-pointer"
              >
                {isJa ? 'キャンセル' : 'Cancel'}
              </button>
              {qrMode === 'in-image' ? (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="certify-modal-next-placement-btn"
                  onClick={() => {
                    if (validateRequiredInfo()) {
                      setStep('placement');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 cursor-pointer"
                >
                  <span>{isJa ? 'QR位置をプレビュー調整' : 'Adjust QR Position'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="certify-modal-confirm-outer-btn"
                  onClick={() => {
                    if (!validateRequiredInfo()) return;
                    void onConfirm({
                      authorName: authorName.trim(),
                      artworkTitle: artworkTitle.trim(),
                      licenseId,
                      qrMode: 'outer-border',
                      description: description.trim() || undefined,
                      website: website.trim() || undefined,
                      snsLinks: parseSnsLinks(snsLinksText),
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>
                    {busy
                      ? isJa
                        ? '証明を作成中…'
                        : 'Certifying…'
                      : isJa
                        ? 'この内容で証明する'
                        : 'Certify Artwork'}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
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
                        ? 'border-sky-400 bg-sky-500/25 text-white font-semibold'
                        : 'border-sky-400/20 bg-[#04142b]/60 text-sky-200/80 hover:text-white'
                    }`}
                  >
                    {btn.id === 'custom' && <Move className="h-3.5 w-3.5" />}
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Interactive Preview */}
            <div className="flex justify-center rounded-2xl border border-sky-400/25 bg-black/40 p-3 sm:p-4">
              <div
                ref={stageRef}
                className="relative inline-block max-w-full max-h-[46vh] select-none overflow-hidden rounded-lg"
                style={{ aspectRatio: `${artWidth} / ${artHeight}` }}
              >
                <img
                  src={item.thumbnailDataUrl}
                  alt={artworkTitle || item.title}
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
              <label className="space-y-1.5 text-xs text-sky-200/85">
                <div className="flex items-center justify-between">
                  <span>{isJa ? 'QRサイズ' : 'QR Size'}</span>
                  <span className="font-mono text-white">{boxSize}px</span>
                </div>
                <input
                  type="range"
                  min={minBoxSize}
                  max={maxBoxSize}
                  value={boxSize}
                  onChange={(e) => handleBoxSizeChange(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </label>

              <label className="space-y-1.5 text-xs text-sky-200/85">
                <div className="flex items-center justify-between">
                  <span>{isJa ? '不透明度' : 'Opacity'}</span>
                  <span className="font-mono text-white">{opacityPct}%</span>
                </div>
                <input
                  type="range"
                  min={75}
                  max={100}
                  value={opacityPct}
                  onChange={(e) => setOpacityPct(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-sky-400/20">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('info')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-950/60 hover:bg-sky-900/70 px-3.5 py-2 text-xs font-medium text-sky-100 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{isJa ? '作品情報に戻る' : 'Back to Info'}</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline font-mono text-[11px] text-sky-300/70">
                  X: {coords.x}px / Y: {coords.y}px
                </span>
                <button
                  type="button"
                  disabled={busy}
                  data-testid="qr-placement-confirm-btn"
                  onClick={() =>
                    void onConfirm({
                      authorName: authorName.trim(),
                      artworkTitle: artworkTitle.trim(),
                      licenseId,
                      qrMode: 'in-image',
                      description: description.trim() || undefined,
                      website: website.trim() || undefined,
                      snsLinks: parseSnsLinks(snsLinksText),
                      inImagePlacement: {
                        x: coords.x,
                        y: coords.y,
                        boxSize,
                        opacity: opacityPct / 100,
                      },
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 cursor-pointer"
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
          </>
        )}
      </div>

      {/* Separate-Layer License Guide Popup */}
      {licenseHelpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isJa ? 'ライセンスの説明' : 'License Guide'}
          data-testid="certify-modal-license-help-dialog"
          onClick={(e) => {
            e.stopPropagation();
            setLicenseHelpOpen(false);
          }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-[#020a18]/82 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-sky-400/40 bg-gradient-to-b from-[#082042]/98 to-[#041328]/98 text-sky-50 shadow-[0_24px_80px_rgba(2,12,30,0.85)] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-sky-400 shrink-0" />
                <span>{isJa ? '見てくれる人とのルール（ライセンス）' : 'Sharing Rules (Licenses)'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLicenseHelpOpen(false)}
                aria-label={isJa ? '閉じる' : 'Close'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-900/60 hover:bg-sky-800/80 text-sky-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {LICENSE_DEFINITIONS.map((lic) => (
                <div
                  key={lic.id}
                  className={lic.id === licenseId ? 'ring-1 ring-sky-400 rounded-xl' : undefined}
                >
                  <LicenseSummaryCard licenseId={lic.id} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
