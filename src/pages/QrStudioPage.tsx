import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Info,
  KeyRound,
  Move,
  Sparkles,
} from 'lucide-react';
import { ImageDropzone } from '../components/ImageDropzone';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { bytesToHex } from '../core/crypto/sha256';
import { clampInImageQrOptions, overlayQrIntoArtwork } from '../core/image/inImageQr';
import type { InImageQrStyle } from '../core/image/inImageQr';
import { decodeImageFileToCanonicalRgba8 } from '../core/image/pngCodec';
import type { CanonicalRaster } from '../core/image/pngCodec';
import { utf8ByteLength } from '../core/manifest/cborCodec';
import { createInImageSignedArtworkPng } from '../core/manifest/signArtwork';
import type { InImageSignedArtworkResult } from '../core/manifest/signArtwork';
import {
  DEFAULT_VERIFY_BASE_URL,
  LICENSE_DEFINITIONS,
  MAX_ATTRIBUTION_UTF8_BYTES,
  MAX_AUTHOR_UTF8_BYTES,
  MAX_TITLE_UTF8_BYTES,
} from '../core/manifest/types';
import type { LicenseId, PolicySignal } from '../core/manifest/types';
import { decodeQrFromCanonicalRaster } from '../core/qr/qrDecoder';
import { generateQrMatrix } from '../core/qr/qrGenerator';
import type { QrErrorCorrectionLevel } from '../core/qr/qrGenerator';
import { createAuthorKey, listAuthorKeys } from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
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

export function QrStudioPage() {
  const { t } = useI18n();

  const [keys, setKeys] = useState<AuthorKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [quickKeyBusy, setQuickKeyBusy] = useState(false);

  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<string>('');
  const [artworkRaster, setArtworkRaster] = useState<CanonicalRaster | null>(null);

  const [qrX, setQrX] = useState<number>(24);
  const [qrY, setQrY] = useState<number>(24);
  const [qrBoxSize, setQrBoxSize] = useState<number>(180);
  const [qrOpacityPct, setQrOpacityPct] = useState<number>(72);
  const [qrStyle, setQrStyle] = useState<InImageQrStyle>('frosted-light');
  const [eccLevel, setEccLevel] = useState<QrErrorCorrectionLevel>('Q');

  const [authorName, setAuthorName] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [licenseId, setLicenseId] = useState<LicenseId>('ARR');
  const [attributionName, setAttributionName] = useState('');
  const [commercialUse, setCommercialUse] = useState<PolicySignal>('unspecified');
  const [redistribution, setRedistribution] = useState<PolicySignal>('unspecified');
  const [aiTraining, setAiTraining] = useState<PolicySignal>('disallow');
  const [verifyBaseUrl, setVerifyBaseUrl] = useState<string>(DEFAULT_VERIFY_BASE_URL);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScannable, setIsScannable] = useState<boolean>(true);

  const [signedResult, setSignedResult] = useState<InImageSignedArtworkResult | null>(null);
  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    void listAuthorKeys().then((list) => {
      setKeys(list);
      if (list.length > 0) setSelectedKeyId(list[0].id);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (signedPreviewUrl) URL.revokeObjectURL(signedPreviewUrl);
    };
  }, [signedPreviewUrl]);

  const selectedKey = useMemo(
    () => keys.find((k) => k.id === selectedKeyId) ?? null,
    [keys, selectedKeyId],
  );

  // Representative preview proof URL with realistic byte length (~310 chars)
  const samplePreviewText = useMemo(() => {
    const cleanBase = (verifyBaseUrl || DEFAULT_VERIFY_BASE_URL).replace(/#.*$/, '');
    return `${cleanBase}#proof=${'A'.repeat(260)}`;
  }, [verifyBaseUrl]);

  const previewQrMatrix = useMemo(
    () => generateQrMatrix(samplePreviewText, eccLevel),
    [samplePreviewText, eccLevel],
  );

  const clampedOptions = useMemo(() => {
    if (!artworkRaster) return null;
    return clampInImageQrOptions(artworkRaster.width, artworkRaster.height, {
      x: qrX,
      y: qrY,
      boxSize: qrBoxSize,
      opacity: qrOpacityPct / 100,
      style: qrStyle,
      eccLevel,
    });
  }, [artworkRaster, qrX, qrY, qrBoxSize, qrOpacityPct, qrStyle, eccLevel]);

  const maxBoxSize = artworkRaster ? Math.min(artworkRaster.width, artworkRaster.height) : 400;
  const minBoxSize = artworkRaster ? Math.min(maxBoxSize, 64) : 64;

  // Cache offscreen base artwork canvas whenever artworkRaster changes
  useEffect(() => {
    if (!artworkRaster || typeof document === 'undefined') {
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
      ctx.putImageData(new ImageData(clampedCopy, artworkRaster.width, artworkRaster.height), 0, 0);
    }
    baseCanvasRef.current = offscreen;
  }, [artworkRaster]);

  // Draw live preview canvas + run local jsQR readability check on the composited box
  useEffect(() => {
    if (!artworkRaster || !clampedOptions || !canvasRef.current) return;

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

    // Extract only the QR box region, overlay exact QR pixels, and paint into canvas
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

    // Draw dashed guide rectangle around QR mask (UI guide only, never exported)
    const gx = Math.round(clampedOptions.x * scale) + 0.5;
    const gy = Math.round(clampedOptions.y * scale) + 0.5;
    const gs = Math.max(8, Math.round(clampedOptions.boxSize * scale) - 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(gx, gy, gs, gs);
    ctx.restore();

    // Debounced local jsQR readability test against the exact blended box pixels
    const timer = window.setTimeout(() => {
      const decoded = decodeQrFromCanonicalRaster(blendedBox);
      setIsScannable(decoded !== null && decoded.rawText === samplePreviewText);
    }, 90);

    return () => window.clearTimeout(timer);
  }, [artworkRaster, clampedOptions, previewQrMatrix, samplePreviewText]);

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);
    setSignedResult(null);
    try {
      const { raster, sourceFormat: fmt } = await decodeImageFileToCanonicalRgba8(file);
      const minDim = Math.min(raster.width, raster.height);
      const defaultBox = Math.max(
        Math.min(minDim, 148),
        Math.min(260, Math.round(minDim * 0.3)),
      );
      const pad = Math.min(24, Math.floor(minDim * 0.05));
      setSourceFileName(file.name);
      setSourceFormat(fmt);
      setArtworkRaster(raster);
      setQrBoxSize(defaultBox);
      setQrX(Math.max(0, raster.width - defaultBox - pad));
      setQrY(Math.max(0, raster.height - defaultBox - pad));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to decode image');
    }
  };

  const applyPreset = (preset: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center') => {
    if (!artworkRaster || !clampedOptions) return;
    const w = artworkRaster.width;
    const h = artworkRaster.height;
    const box = clampedOptions.boxSize;
    const pad = Math.min(24, Math.floor(Math.min(w, h) * 0.05));

    if (preset === 'topLeft') {
      setQrX(pad);
      setQrY(pad);
    } else if (preset === 'topRight') {
      setQrX(Math.max(0, w - box - pad));
      setQrY(pad);
    } else if (preset === 'bottomLeft') {
      setQrX(pad);
      setQrY(Math.max(0, h - box - pad));
    } else if (preset === 'bottomRight') {
      setQrX(Math.max(0, w - box - pad));
      setQrY(Math.max(0, h - box - pad));
    } else {
      setQrX(Math.max(0, Math.floor((w - box) / 2)));
      setQrY(Math.max(0, Math.floor((h - box) / 2)));
    }
  };

  const clientToArtworkCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current || !artworkRaster) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ax = ((clientX - rect.left) / rect.width) * artworkRaster.width;
    const ay = ((clientY - rect.top) / rect.height) * artworkRaster.height;
    return { ax, ay };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!artworkRaster || !clampedOptions) return;
    const coords = clientToArtworkCoords(e.clientX, e.clientY);
    if (!coords) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const insideBox =
      coords.ax >= clampedOptions.x &&
      coords.ax <= clampedOptions.x + clampedOptions.boxSize &&
      coords.ay >= clampedOptions.y &&
      coords.ay <= clampedOptions.y + clampedOptions.boxSize;

    const offsetX = insideBox
      ? coords.ax - clampedOptions.x
      : clampedOptions.boxSize / 2;
    const offsetY = insideBox
      ? coords.ay - clampedOptions.y
      : clampedOptions.boxSize / 2;

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
      setQrX(nextX);
      setQrY(nextY);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.active || !artworkRaster || !clampedOptions) return;
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
    setQrX(nextX);
    setQrY(nextY);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragStateRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleQuickCreateKey = async () => {
    setErrorMsg(null);
    setQuickKeyBusy(true);
    try {
      const { record } = await createAuthorKey({
        label: authorName.trim() || 'Artist Key',
      });
      const updated = await listAuthorKeys();
      setKeys(updated);
      setSelectedKeyId(record.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create local signing key');
    } finally {
      setQuickKeyBusy(false);
    }
  };

  const handleSignInImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!artworkRaster || !clampedOptions) {
      setErrorMsg('Please select an artwork image first.');
      return;
    }
    if (!selectedKey) {
      setErrorMsg('Please select or generate a local signing key first.');
      return;
    }

    setBusy(true);
    try {
      const res = await createInImageSignedArtworkPng({
        artworkRaster,
        authorKey: selectedKey,
        passphraseIfEncrypted: keyPassphrase || undefined,
        authorName: authorName || undefined,
        artworkTitle: artworkTitle || undefined,
        license: {
          licenseId,
          attributionName: attributionName || undefined,
          commercialUse,
          redistribution,
          aiTraining,
        },
        qrOptions: {
          x: clampedOptions.x,
          y: clampedOptions.y,
          boxSize: clampedOptions.boxSize,
          opacity: clampedOptions.opacity,
          style: qrStyle,
          eccLevel,
        },
        verifyBaseUrl,
      });

      if (signedPreviewUrl) URL.revokeObjectURL(signedPreviewUrl);
      const pngCopy = new Uint8Array(res.pngBytes.byteLength);
      pngCopy.set(res.pngBytes);
      const blob = new Blob([pngCopy.buffer], { type: 'image/png' });
      const previewUrl = URL.createObjectURL(blob);
      setSignedPreviewUrl(previewUrl);
      setSignedResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadSignedPng = () => {
    if (!signedResult) return;
    const base = sourceFileName.replace(/\.[^.]+$/, '') || 'artwork';
    const pngCopy = new Uint8Array(signedResult.pngBytes.byteLength);
    pngCopy.set(signedResult.pngBytes);
    const blob = new Blob([pngCopy.buffer], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.in-image-qr.certified-handmade.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyProofUrl = async () => {
    if (!signedResult) return;
    try {
      await navigator.clipboard.writeText(signedResult.proofUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const localVerifyRoute = signedResult
    ? `/verify#proof=${signedResult.proofUrl.split('#proof=')[1] ?? ''}`
    : '/verify';

  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-white/[0.08] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">{t.qrStudio.title}</h1>
          <Link
            to="/create"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224]/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-white/[0.3] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.qrStudio.backToMarginCreate}</span>
          </Link>
        </div>
        <p className="text-sm sm:text-base text-slate-300">{t.qrStudio.subtitle}</p>
      </header>

      <form onSubmit={handleSignInImage} className="space-y-6">
        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step1}</h2>
            <p className="text-xs text-slate-400 mt-1">{t.create.step1Hint}</p>
          </div>

          <ImageDropzone
            onFileSelected={handleFileSelected}
            title={t.create.dropzoneText}
            subtitle={t.create.dropzoneSub}
            testId="qrstudio-image-input"
          />

          {artworkRaster && (
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-3">
              <span className="font-semibold text-sky-200">{sourceFileName}</span>
              <span className="font-mono text-white">
                {artworkRaster.width} × {artworkRaster.height} px (RGBA8 · {sourceFormat})
              </span>
            </div>
          )}
        </section>

        {artworkRaster && clampedOptions && (
          <section className="rounded-xl border border-sky-400/25 bg-[#051224]/75 backdrop-blur-md p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <Move className="h-4 w-4 text-sky-300" aria-hidden="true" />
                  <span>{t.qrStudio.previewTitle}</span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">{t.qrStudio.previewHint}</p>
              </div>

              <div
                data-testid="qrstudio-readability-badge"
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  isScannable
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                }`}
              >
                {isScannable ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" aria-hidden="true" />
                )}
                <span>{isScannable ? t.qrStudio.readabilityOk : t.qrStudio.readabilityWarn}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 flex flex-col items-center justify-center rounded-xl border border-white/[0.1] bg-[#020813]/85 p-3">
                <canvas
                  ref={canvasRef}
                  data-testid="qrstudio-preview-canvas"
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  className="max-h-[480px] max-w-full w-auto h-auto rounded cursor-grab active:cursor-grabbing touch-none select-none"
                />
                <p className="text-[11px] text-slate-400 mt-2">{t.qrStudio.readabilityHint}</p>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-300">
                    {t.qrStudio.presetsLabel}
                  </div>
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
                        className="rounded-md border border-white/[0.14] bg-[#030b18]/75 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {t.qrStudio.controlsTitle}
                  </h3>

                  <div>
                    <label htmlFor="qrX" className="flex justify-between text-xs text-slate-300">
                      <span>{t.qrStudio.xLabel}</span>
                      <span className="font-mono text-white">{clampedOptions.x} px</span>
                    </label>
                    <input
                      id="qrX"
                      type="range"
                      min={0}
                      max={Math.max(0, artworkRaster.width - clampedOptions.boxSize)}
                      value={clampedOptions.x}
                      onChange={(e) => setQrX(Number(e.target.value))}
                      data-testid="qrstudio-x-slider"
                      className="w-full accent-sky-300 mt-1"
                    />
                  </div>

                  <div>
                    <label htmlFor="qrY" className="flex justify-between text-xs text-slate-300">
                      <span>{t.qrStudio.yLabel}</span>
                      <span className="font-mono text-white">{clampedOptions.y} px</span>
                    </label>
                    <input
                      id="qrY"
                      type="range"
                      min={0}
                      max={Math.max(0, artworkRaster.height - clampedOptions.boxSize)}
                      value={clampedOptions.y}
                      onChange={(e) => setQrY(Number(e.target.value))}
                      data-testid="qrstudio-y-slider"
                      className="w-full accent-sky-300 mt-1"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="qrBoxSize"
                      className="flex justify-between text-xs text-slate-300"
                    >
                      <span>{t.qrStudio.sizeLabel}</span>
                      <span className="font-mono text-white">{clampedOptions.boxSize} px</span>
                    </label>
                    <input
                      id="qrBoxSize"
                      type="range"
                      min={minBoxSize}
                      max={maxBoxSize}
                      value={clampedOptions.boxSize}
                      onChange={(e) => setQrBoxSize(Number(e.target.value))}
                      data-testid="qrstudio-size-slider"
                      className="w-full accent-sky-300 mt-1"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="qrOpacity"
                      className="flex justify-between text-xs text-slate-300"
                    >
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
                      onChange={(e) => setQrOpacityPct(Number(e.target.value))}
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
                      onChange={(e) => setQrStyle(e.target.value as InImageQrStyle)}
                      data-testid="qrstudio-style-select"
                      className="w-full rounded-lg border border-white/[0.14] bg-[#061224] px-3 py-2 text-xs sm:text-sm text-white"
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
                      onChange={(e) => setEccLevel(e.target.value as QrErrorCorrectionLevel)}
                      data-testid="qrstudio-ecc-select"
                      className="w-full rounded-lg border border-white/[0.14] bg-[#061224] px-3 py-2 text-xs sm:text-sm text-white"
                    >
                      <option value="M">{t.qrStudio.eccOptions.M}</option>
                      <option value="Q">{t.qrStudio.eccOptions.Q}</option>
                      <option value="H">{t.qrStudio.eccOptions.H}</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3 text-xs text-slate-300 space-y-1">
                  <div className="font-mono text-sky-300">
                    {t.qrStudio.maskRegionLabel}: [{clampedOptions.x}, {clampedOptions.y},{' '}
                    {clampedOptions.boxSize}, {clampedOptions.boxSize}]
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {t.qrStudio.maskedDigestNote}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step2}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="studioAuthorName">{t.create.authorLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(authorName)} / {MAX_AUTHOR_UTF8_BYTES} {t.create.bytesUsed}
                </span>
              </div>
              <input
                id="studioAuthorName"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={t.create.authorPlaceholder}
                data-testid="qrstudio-author-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="studioTitle">{t.create.titleLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(artworkTitle)} / {MAX_TITLE_UTF8_BYTES} {t.create.bytesUsed}
                </span>
              </div>
              <input
                id="studioTitle"
                type="text"
                value={artworkTitle}
                onChange={(e) => setArtworkTitle(e.target.value)}
                placeholder={t.create.titlePlaceholder}
                data-testid="qrstudio-title-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step3}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="studioLicense" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.licenseLabel}
              </label>
              <select
                id="studioLicense"
                value={licenseId}
                onChange={(e) => setLicenseId(e.target.value as LicenseId)}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
              >
                {LICENSE_DEFINITIONS.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.id} — {t.licenses.items[lic.id].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="studioAttribution">{t.create.attributionLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(attributionName)} / {MAX_ATTRIBUTION_UTF8_BYTES}{' '}
                  {t.create.bytesUsed}
                </span>
              </div>
              <input
                id="studioAttribution"
                type="text"
                value={attributionName}
                onChange={(e) => setAttributionName(e.target.value)}
                placeholder={t.create.attributionPlaceholder}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <LicenseSummaryCard licenseId={licenseId} compact />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="studioComm" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.commercialLabel}
              </label>
              <select
                id="studioComm"
                value={commercialUse}
                onChange={(e) => setCommercialUse(e.target.value as PolicySignal)}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
              >
                <option value="unspecified">{t.create.policyUnspecified}</option>
                <option value="allow">{t.create.policyAllow}</option>
                <option value="disallow">{t.create.policyDisallow}</option>
              </select>
            </div>

            <div>
              <label htmlFor="studioRedist" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.redistributionLabel}
              </label>
              <select
                id="studioRedist"
                value={redistribution}
                onChange={(e) => setRedistribution(e.target.value as PolicySignal)}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
              >
                <option value="unspecified">{t.create.policyUnspecified}</option>
                <option value="allow">{t.create.policyAllow}</option>
                <option value="disallow">{t.create.policyDisallow}</option>
              </select>
            </div>

            <div>
              <label htmlFor="studioAi" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.aiTrainingLabel}
              </label>
              <select
                id="studioAi"
                value={aiTraining}
                onChange={(e) => setAiTraining(e.target.value as PolicySignal)}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
              >
                <option value="disallow">{t.create.policyDisallow}</option>
                <option value="allow">{t.create.policyAllow}</option>
                <option value="unspecified">{t.create.policyUnspecified}</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3 flex items-start gap-2.5 text-xs text-slate-300">
            <Info className="h-4 w-4 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.licenses.signalGuideBody}</span>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step4}</h2>
          {keys.length === 0 ? (
            <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-sky-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                  <span>{t.howTo.quickKeyTitle}</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {t.howTo.quickKeyBody}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={quickKeyBusy}
                  onClick={handleQuickCreateKey}
                  data-testid="qrstudio-quick-keygen"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-50 min-h-[42px] cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>{quickKeyBusy ? t.howTo.quickKeyBusy : t.howTo.quickKeyBtn}</span>
                </button>
                <Link
                  to="/keys"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.16] bg-[#030b18]/65 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-white/[0.3] min-h-[42px]"
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.create.goToKeys}</span>
                </Link>
              </div>
              <p className="text-[11px] text-slate-300/80">{t.howTo.quickKeyTip}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="studioSigningKey"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  {t.create.selectKeyLabel}
                </label>
                <select
                  id="studioSigningKey"
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  data-testid="qrstudio-key-select"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
                >
                  {keys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label} ({k.fingerprintShort})
                    </option>
                  ))}
                </select>
              </div>

              {selectedKey?.storageMode === 'noble-encrypted-seed' && (
                <div>
                  <label
                    htmlFor="studioKeyPass"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    {t.create.passphrasePrompt}
                  </label>
                  <input
                    id="studioKeyPass"
                    type="password"
                    required
                    value={keyPassphrase}
                    onChange={(e) => setKeyPassphrase(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <details className="group rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5">
          <summary className="flex items-center justify-between gap-2 cursor-pointer text-sm sm:text-base font-medium text-slate-200 list-none select-none">
            <span>{t.create.verifyUrlLabel}</span>
            <ChevronDown
              className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0"
              aria-hidden="true"
            />
          </summary>
          <div className="pt-4 mt-4 border-t border-white/[0.08]">
            <input
              id="studioVerifyBaseUrl"
              type="url"
              value={verifyBaseUrl}
              onChange={(e) => setVerifyBaseUrl(e.target.value)}
              className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2 text-xs font-mono text-slate-200"
            />
            <p className="text-[11px] text-slate-400 mt-1">{t.create.verifyUrlHint}</p>
          </div>
        </details>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-4 text-sm text-rose-200"
          >
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy || !artworkRaster || !selectedKey}
            data-testid="qrstudio-sign-button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] cursor-pointer"
          >
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            <span>{busy ? t.qrStudio.signingBusy : t.qrStudio.signInImageBtn}</span>
          </button>
          <span className="text-xs text-slate-400">{t.create.timestampNote}</span>
        </div>
      </form>

      {signedResult && signedPreviewUrl && (
        <section
          data-testid="qrstudio-result-section"
          className="rounded-xl border border-white/[0.14] bg-[#051224]/75 backdrop-blur-md p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-sky-200">{t.create.resultTitle}</h2>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleDownloadSignedPng}
                data-testid="qrstudio-download-png"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white min-h-[44px] cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{t.create.downloadPng}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyProofUrl}
                data-testid="qrstudio-copy-proof-url"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
              >
                {copiedUrl ? <Check className="h-4 w-4 text-sky-300" /> : <Copy className="h-4 w-4" />}
                <span>{copiedUrl ? t.create.copied : t.create.copyProofUrl}</span>
              </button>

              <Link
                to={localVerifyRoute}
                data-testid="qrstudio-open-local-verify"
                className="inline-flex items-center gap-2 rounded-lg border border-sky-300/35 bg-sky-400/10 px-4 py-2.5 text-sm font-medium text-sky-200 hover:bg-sky-400/20 min-h-[44px]"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>{t.nav.verify}</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div className="rounded-xl border border-white/[0.09] bg-[#020813]/80 p-3 flex justify-center">
              <img
                src={signedPreviewUrl}
                alt="Signed artwork with in-image semi-transparent QR code"
                className="max-h-[420px] object-contain"
              />
            </div>

            <dl className="space-y-3 text-xs sm:text-sm">
              <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                <dt className="text-xs text-slate-400">{t.create.artworkRegionLabel}</dt>
                <dd className="font-mono text-white mt-0.5">
                  [{signedResult.manifest.region.join(', ')}] (Protocol v2)
                </dd>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                <dt className="text-xs text-slate-400">{t.qrStudio.maskRegionLabel}</dt>
                <dd className="font-mono text-sky-200 mt-0.5">
                  [{signedResult.qrMask.join(', ')}]
                </dd>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                <dt className="text-xs text-slate-400">{t.create.artworkShaLabel}</dt>
                <dd className="font-mono text-xs text-sky-300 break-all mt-0.5">
                  {bytesToHex(signedResult.manifest.sha256)}
                </dd>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                  <dt className="text-xs text-slate-400">{t.create.proofSizeLabel}</dt>
                  <dd className="font-mono text-white mt-0.5">
                    {signedResult.proofBytes.length} bytes
                  </dd>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                  <dt className="text-xs text-slate-400">{t.create.qrVersionLabel}</dt>
                  <dd className="font-mono text-white mt-0.5">
                    v{signedResult.qrVersion} ({signedResult.qrModules}×{signedResult.qrModules})
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </section>
      )}
    </div>
  );
}
