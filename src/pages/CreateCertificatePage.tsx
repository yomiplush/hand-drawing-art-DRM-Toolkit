import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Frame,
  Info,
  KeyRound,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { ImageDropzone } from '../components/ImageDropzone';
import { InImageQrStudioPanel } from '../components/InImageQrStudioPanel';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { bytesToHex } from '../core/crypto/sha256';
import { hashCanonicalRasterHex } from '../core/image/canonicalRaster';
import { clampInImageQrOptions } from '../core/image/inImageQr';
import type { InImageQrStyle } from '../core/image/inImageQr';
import { decodeImageFileToCanonicalRgba8 } from '../core/image/pngCodec';
import type { CanonicalRaster } from '../core/image/pngCodec';
import type { FrameTheme, QrPlacement } from '../core/image/qrBurner';
import { utf8ByteLength } from '../core/manifest/cborCodec';
import {
  createInImageSignedArtworkPng,
  createSignedArtworkPng,
} from '../core/manifest/signArtwork';
import type {
  InImageSignedArtworkResult,
  SignedArtworkResult,
} from '../core/manifest/signArtwork';
import {
  DEFAULT_VERIFY_BASE_URL,
  LICENSE_DEFINITIONS,
  MAX_ATTRIBUTION_UTF8_BYTES,
  MAX_AUTHOR_UTF8_BYTES,
  MAX_TITLE_UTF8_BYTES,
} from '../core/manifest/types';
import type { ArtworkRegion, LicenseId, PolicySignal } from '../core/manifest/types';
import type { QrErrorCorrectionLevel } from '../core/qr/qrGenerator';
import { createAuthorKey, listAuthorKeys } from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

type QrCreationMode = 'outer-frame' | 'in-image';

type UnifiedSignResult =
  | (SignedArtworkResult & { mode: 'outer-frame'; qrMask?: undefined })
  | (InImageSignedArtworkResult & { mode: 'in-image'; qrMask: ArtworkRegion });

export function CreateCertificatePage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const qrMode: QrCreationMode =
    searchParams.get('mode') === 'studio' ? 'in-image' : 'outer-frame';

  const setQrMode = (nextMode: QrCreationMode) => {
    setSignedResult(null);
    setErrorMsg(null);
    if (nextMode === 'in-image') {
      setSearchParams({ mode: 'studio' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const [keys, setKeys] = useState<AuthorKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [quickKeyBusy, setQuickKeyBusy] = useState(false);

  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<string>('');
  const [artworkRaster, setArtworkRaster] = useState<CanonicalRaster | null>(null);
  const [artworkShaHex, setArtworkShaHex] = useState<string>('');
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [licenseId, setLicenseId] = useState<LicenseId>('ARR');
  const [attributionName, setAttributionName] = useState('');
  const [commercialUse, setCommercialUse] = useState<PolicySignal>('unspecified');
  const [redistribution, setRedistribution] = useState<PolicySignal>('unspecified');
  const [aiTraining, setAiTraining] = useState<PolicySignal>('disallow');

  // Outer Margin Frame options (Protocol v1)
  const [placement, setPlacement] = useState<QrPlacement>('bottom-right');
  const [theme, setTheme] = useState<FrameTheme>('dark-slate');
  const [marginPx, setMarginPx] = useState<number>(24);
  const [moduleScale, setModuleScale] = useState<number>(0); // 0 = Auto
  const [showLabel, setShowLabel] = useState<boolean>(true);

  // In-Image Semi-Transparent QR Studio options (Protocol v2)
  const [qrX, setQrX] = useState<number>(24);
  const [qrY, setQrY] = useState<number>(24);
  const [qrBoxSize, setQrBoxSize] = useState<number>(180);
  const [qrOpacityPct, setQrOpacityPct] = useState<number>(72);
  const [qrStyle, setQrStyle] = useState<InImageQrStyle>('frosted-light');
  const [eccLevel, setEccLevel] = useState<QrErrorCorrectionLevel>('Q');

  const [verifyBaseUrl, setVerifyBaseUrl] = useState<string>(DEFAULT_VERIFY_BASE_URL);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [signedResult, setSignedResult] = useState<UnifiedSignResult | null>(null);
  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    void listAuthorKeys().then((list) => {
      setKeys(list);
      if (list.length > 0) setSelectedKeyId(list[0].id);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
    };
  }, [artworkPreviewUrl]);

  useEffect(() => {
    return () => {
      if (signedPreviewUrl) URL.revokeObjectURL(signedPreviewUrl);
    };
  }, [signedPreviewUrl]);

  const selectedKey = useMemo(
    () => keys.find((k) => k.id === selectedKeyId) ?? null,
    [keys, selectedKeyId],
  );

  const clampedStudioOptions = useMemo(() => {
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

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);
    setSignedResult(null);
    try {
      const rawFileBytes = new Uint8Array(await file.arrayBuffer());
      const { raster, sourceFormat: fmt } = await decodeImageFileToCanonicalRgba8(rawFileBytes);
      const shaHex = await hashCanonicalRasterHex(raster);
      if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
      const url = URL.createObjectURL(file);

      // Initialize sensible studio coordinates for the newly selected artwork
      const minDim = Math.min(raster.width, raster.height);
      const defaultBox = Math.max(
        Math.min(minDim, 148),
        Math.min(260, Math.round(minDim * 0.3)),
      );
      const pad = Math.min(24, Math.floor(minDim * 0.05));

      setSourceFileName(file.name);
      setSourceFormat(fmt);
      setArtworkRaster(raster);
      setArtworkShaHex(shaHex);
      setArtworkPreviewUrl(url);
      setQrBoxSize(defaultBox);
      setQrX(Math.max(0, raster.width - defaultBox - pad));
      setQrY(Math.max(0, raster.height - defaultBox - pad));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to decode image');
    }
  };

  const handleSignAndBurn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!artworkRaster) {
      setErrorMsg('Please select an artwork image first.');
      return;
    }
    if (!selectedKey) {
      setErrorMsg('Please select or generate a local signing key first.');
      return;
    }

    setBusy(true);
    try {
      let res: UnifiedSignResult;
      if (qrMode === 'in-image' && clampedStudioOptions) {
        const studioRes = await createInImageSignedArtworkPng({
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
            x: clampedStudioOptions.x,
            y: clampedStudioOptions.y,
            boxSize: clampedStudioOptions.boxSize,
            opacity: clampedStudioOptions.opacity,
            style: qrStyle,
            eccLevel,
          },
          verifyBaseUrl,
        });
        res = { ...studioRes, mode: 'in-image' };
      } else {
        const marginRes = await createSignedArtworkPng({
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
          burnOptions: {
            placement,
            theme,
            marginPx,
            modulePx: moduleScale > 0 ? moduleScale : undefined,
            showLabel,
          },
          verifyBaseUrl,
        });
        res = { ...marginRes, mode: 'outer-frame' };
      }

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
    a.download =
      signedResult.mode === 'in-image'
        ? `${base}.in-image-qr.certified-handmade.png`
        : `${base}.certified-handmade.png`;
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
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">
          {qrMode === 'in-image' ? t.qrStudio.title : t.create.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          {qrMode === 'in-image' ? t.qrStudio.subtitle : t.create.subtitle}
        </p>
        <p className="text-xs sm:text-sm text-sky-200/90 pt-1">{t.howTo.simpleFlowHint}</p>
      </header>

      <section
        aria-label={t.qrStudio.modeSectionTitle}
        className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-3"
      >
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-300">
          {t.qrStudio.modeSectionTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={qrMode === 'outer-frame'}
            onClick={() => setQrMode('outer-frame')}
            data-testid="create-mode-margin"
            className={`text-start rounded-xl border p-3.5 transition-colors cursor-pointer ${
              qrMode === 'outer-frame'
                ? 'border-sky-300/60 bg-sky-500/15 text-white'
                : 'border-white/[0.1] bg-[#030b18]/60 text-slate-300 hover:border-white/[0.22]'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Frame className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.qrStudio.modeOuterLabel}</span>
            </div>
            <p className="mt-1 text-xs text-slate-300/90 leading-relaxed">
              {t.qrStudio.modeOuterDesc}
            </p>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={qrMode === 'in-image'}
            onClick={() => setQrMode('in-image')}
            data-testid="create-mode-studio"
            className={`text-start rounded-xl border p-3.5 transition-colors cursor-pointer ${
              qrMode === 'in-image'
                ? 'border-sky-300/60 bg-sky-500/15 text-white'
                : 'border-white/[0.1] bg-[#030b18]/60 text-slate-300 hover:border-white/[0.22]'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <QrCode className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.qrStudio.modeStudioLabel}</span>
            </div>
            <p className="mt-1 text-xs text-slate-300/90 leading-relaxed">
              {t.qrStudio.modeStudioDesc}
            </p>
          </button>
        </div>
      </section>

      <form onSubmit={handleSignAndBurn} className="space-y-6">
        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step1}</h2>
            <p className="text-xs text-slate-400 mt-1">{t.create.step1Hint}</p>
          </div>

          <ImageDropzone
            onFileSelected={handleFileSelected}
            title={t.create.dropzoneText}
            subtitle={t.create.dropzoneSub}
            testId="create-image-input"
          />

          {artworkRaster && artworkPreviewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center rounded-xl border border-white/[0.09] bg-[#030b18]/65 p-4">
              <div className="md:col-span-1 flex justify-center bg-[#020813]/80 rounded-lg p-2 border border-white/[0.08]">
                <img
                  src={artworkPreviewUrl}
                  alt={artworkTitle || sourceFileName}
                  className="max-h-48 object-contain rounded"
                />
              </div>
              <div className="md:col-span-2 space-y-2 text-xs sm:text-sm">
                <div className="font-semibold text-sky-200">{sourceFileName}</div>
                <div className="text-slate-300">
                  {t.create.imageInfo}:{' '}
                  <span className="font-mono text-white">
                    {artworkRaster.width} × {artworkRaster.height} px (RGBA8 · {sourceFormat})
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs text-slate-400">{t.create.artworkShaLabel}</div>
                  <div className="font-mono text-xs text-sky-300 break-all">{artworkShaHex}</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {qrMode === 'in-image' &&
          (artworkRaster && clampedStudioOptions ? (
            <InImageQrStudioPanel
              artworkRaster={artworkRaster}
              clampedOptions={clampedStudioOptions}
              qrOpacityPct={qrOpacityPct}
              qrStyle={qrStyle}
              eccLevel={eccLevel}
              verifyBaseUrl={verifyBaseUrl}
              onChangeX={setQrX}
              onChangeY={setQrY}
              onChangeBoxSize={setQrBoxSize}
              onChangeOpacityPct={setQrOpacityPct}
              onChangeStyle={setQrStyle}
              onChangeEcc={setEccLevel}
            />
          ) : (
            <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.07] p-4 text-xs sm:text-sm text-sky-100 flex items-center gap-2.5">
              <QrCode className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.qrStudio.uploadFirstHint}</span>
            </div>
          ))}

        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step2}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="authorName">{t.create.authorLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(authorName)} / {MAX_AUTHOR_UTF8_BYTES} {t.create.bytesUsed}
                </span>
              </div>
              <input
                id="authorName"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={t.create.authorPlaceholder}
                data-testid="create-author-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="artworkTitle">{t.create.titleLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(artworkTitle)} / {MAX_TITLE_UTF8_BYTES} {t.create.bytesUsed}
                </span>
              </div>
              <input
                id="artworkTitle"
                type="text"
                value={artworkTitle}
                onChange={(e) => setArtworkTitle(e.target.value)}
                placeholder={t.create.titlePlaceholder}
                data-testid="create-title-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step3}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="licenseId" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.licenseLabel}
              </label>
              <select
                id="licenseId"
                value={licenseId}
                onChange={(e) => setLicenseId(e.target.value as LicenseId)}
                data-testid="create-license-select"
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
                <label htmlFor="attributionName">{t.create.attributionLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(attributionName)} / {MAX_ATTRIBUTION_UTF8_BYTES}{' '}
                  {t.create.bytesUsed}
                </span>
              </div>
              <input
                id="attributionName"
                type="text"
                value={attributionName}
                onChange={(e) => setAttributionName(e.target.value)}
                placeholder={t.create.attributionPlaceholder}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <LicenseSummaryCard
            licenseId={licenseId}
            compact
            testId="create-license-summary"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="commercialUse"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.create.commercialLabel}
              </label>
              <select
                id="commercialUse"
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
              <label
                htmlFor="redistribution"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.create.redistributionLabel}
              </label>
              <select
                id="redistribution"
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
              <label htmlFor="aiTraining" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.aiTrainingLabel}
              </label>
              <select
                id="aiTraining"
                value={aiTraining}
                onChange={(e) => setAiTraining(e.target.value as PolicySignal)}
                data-testid="create-ai-select"
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
                  data-testid="create-quick-keygen"
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
                <label htmlFor="signingKey" className="block text-xs font-medium text-slate-300 mb-1">
                  {t.create.selectKeyLabel}
                </label>
                <select
                  id="signingKey"
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  data-testid="create-key-select"
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
                    htmlFor="keyPassphrase"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    {t.create.passphrasePrompt}
                  </label>
                  <input
                    id="keyPassphrase"
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

        <details
          data-testid="create-advanced-settings"
          className="group rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5"
        >
          <summary className="flex items-center justify-between gap-2 cursor-pointer text-sm sm:text-base font-medium text-slate-200 list-none select-none">
            <span>{t.howTo.advancedToggle}</span>
            <ChevronDown
              className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0"
              aria-hidden="true"
            />
          </summary>

          <div className="pt-4 mt-4 border-t border-white/[0.08] space-y-4">
            {qrMode === 'outer-frame' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label
                      htmlFor="placement"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      {t.create.placementLabel}
                    </label>
                    <select
                      id="placement"
                      value={placement}
                      onChange={(e) => setPlacement(e.target.value as QrPlacement)}
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
                    >
                      <option value="bottom-right">{t.create.placements['bottom-right']}</option>
                      <option value="bottom-left">{t.create.placements['bottom-left']}</option>
                      <option value="bottom-center">{t.create.placements['bottom-center']}</option>
                      <option value="top-right">{t.create.placements['top-right']}</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="theme" className="block text-xs font-medium text-slate-300 mb-1">
                      {t.create.themeLabel}
                    </label>
                    <select
                      id="theme"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as FrameTheme)}
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
                    >
                      <option value="dark-slate">{t.create.themes['dark-slate']}</option>
                      <option value="pure-white">{t.create.themes['pure-white']}</option>
                      <option value="transparent-margin">
                        {t.create.themes['transparent-margin']}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="marginPx"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      {t.create.marginLabel}: {marginPx}px
                    </label>
                    <input
                      id="marginPx"
                      type="range"
                      min={8}
                      max={80}
                      step={2}
                      value={marginPx}
                      onChange={(e) => setMarginPx(Number(e.target.value))}
                      className="w-full accent-sky-300 mt-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="moduleScale"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      {t.create.moduleScaleLabel}
                    </label>
                    <select
                      id="moduleScale"
                      value={moduleScale}
                      onChange={(e) => setModuleScale(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
                    >
                      <option value={0}>{t.create.autoScale}</option>
                      <option value={2}>2 px / module</option>
                      <option value={3}>3 px / module</option>
                      <option value={4}>4 px / module</option>
                      <option value={5}>5 px / module</option>
                      <option value={6}>6 px / module</option>
                    </select>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={showLabel}
                    onChange={(e) => setShowLabel(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-300"
                  />
                  <span>{t.create.showLabelToggle}</span>
                </label>
              </>
            )}

            <div>
              <label htmlFor="verifyBaseUrl" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.verifyUrlLabel}
              </label>
              <input
                id="verifyBaseUrl"
                type="url"
                value={verifyBaseUrl}
                onChange={(e) => setVerifyBaseUrl(e.target.value)}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2 text-xs font-mono text-slate-200"
              />
              <p className="text-[11px] text-slate-400 mt-1">{t.create.verifyUrlHint}</p>
            </div>
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
            data-testid="create-sign-button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] cursor-pointer"
          >
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            <span>
              {busy
                ? qrMode === 'in-image'
                  ? t.qrStudio.signingBusy
                  : t.create.signingBusy
                : qrMode === 'in-image'
                  ? t.qrStudio.signInImageBtn
                  : t.create.signButton}
            </span>
          </button>
          <span className="text-xs text-slate-400">{t.create.timestampNote}</span>
        </div>
      </form>

      {signedResult && signedPreviewUrl && (
        <section
          data-testid="create-result-section"
          className="rounded-xl border border-white/[0.14] bg-[#051224]/75 backdrop-blur-md p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-sky-200">{t.create.resultTitle}</h2>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleDownloadSignedPng}
                data-testid="download-signed-png"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white min-h-[44px] cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{t.create.downloadPng}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyProofUrl}
                data-testid="copy-proof-url"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
              >
                {copiedUrl ? <Check className="h-4 w-4 text-sky-300" /> : <Copy className="h-4 w-4" />}
                <span>{copiedUrl ? t.create.copied : t.create.copyProofUrl}</span>
              </button>

              <Link
                to={localVerifyRoute}
                data-testid="open-local-verify"
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
                alt="Signed artwork with QR code"
                className="max-h-[420px] object-contain"
              />
            </div>

            <dl className="space-y-3 text-xs sm:text-sm">
              <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                <dt className="text-xs text-slate-400">{t.create.artworkRegionLabel}</dt>
                <dd className="font-mono text-white mt-0.5">
                  [{signedResult.manifest.region.join(', ')}] → Output{' '}
                  {signedResult.raster.width} × {signedResult.raster.height} px{' '}
                  {signedResult.mode === 'in-image' ? '(Protocol v2)' : '(Protocol v1)'}
                </dd>
              </div>

              {signedResult.mode === 'in-image' && (
                <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                  <dt className="text-xs text-slate-400">{t.qrStudio.maskRegionLabel}</dt>
                  <dd className="font-mono text-sky-200 mt-0.5">
                    [{signedResult.qrMask.join(', ')}]
                  </dd>
                </div>
              )}

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
