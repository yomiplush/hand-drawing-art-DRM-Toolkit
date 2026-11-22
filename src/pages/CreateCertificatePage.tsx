import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Info,
  KeyRound,
} from 'lucide-react';
import { ImageDropzone } from '../components/ImageDropzone';
import { bytesToHex } from '../core/crypto/sha256';
import { hashCanonicalRasterHex } from '../core/image/canonicalRaster';
import { decodeImageFileToCanonicalRgba8 } from '../core/image/pngCodec';
import type { CanonicalRaster } from '../core/image/pngCodec';
import type { FrameTheme, QrPlacement } from '../core/image/qrBurner';
import { utf8ByteLength } from '../core/manifest/cborCodec';
import { createSignedArtworkPng } from '../core/manifest/signArtwork';
import type { SignedArtworkResult } from '../core/manifest/signArtwork';
import {
  DEFAULT_VERIFY_BASE_URL,
  LICENSE_DEFINITIONS,
  MAX_ATTRIBUTION_UTF8_BYTES,
  MAX_AUTHOR_UTF8_BYTES,
  MAX_TITLE_UTF8_BYTES,
} from '../core/manifest/types';
import type { LicenseId, PolicySignal } from '../core/manifest/types';
import { listAuthorKeys } from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

export function CreateCertificatePage() {
  const { t } = useI18n();

  const [keys, setKeys] = useState<AuthorKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [keyPassphrase, setKeyPassphrase] = useState('');

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

  const [placement, setPlacement] = useState<QrPlacement>('bottom-right');
  const [theme, setTheme] = useState<FrameTheme>('dark-slate');
  const [marginPx, setMarginPx] = useState<number>(24);
  const [moduleScale, setModuleScale] = useState<number>(0); // 0 = Auto
  const [showLabel, setShowLabel] = useState<boolean>(true);
  const [verifyBaseUrl, setVerifyBaseUrl] = useState<string>(DEFAULT_VERIFY_BASE_URL);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [signedResult, setSignedResult] = useState<SignedArtworkResult | null>(null);
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

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);
    setSignedResult(null);
    try {
      const { raster, sourceFormat: fmt } = await decodeImageFileToCanonicalRgba8(file);
      const shaHex = await hashCanonicalRasterHex(raster);
      if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
      const url = URL.createObjectURL(file);
      setSourceFileName(file.name);
      setSourceFormat(fmt);
      setArtworkRaster(raster);
      setArtworkShaHex(shaHex);
      setArtworkPreviewUrl(url);
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
      const res = await createSignedArtworkPng({
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
    a.download = `${base}.certified-handmade.png`;
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
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.create.title}</h1>
        <p className="text-sm sm:text-base text-slate-300">{t.create.subtitle}</p>
      </header>

      <form onSubmit={handleSignAndBurn} className="space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="md:col-span-1 flex justify-center bg-slate-900 rounded-lg p-2 border border-slate-800">
                <img
                  src={artworkPreviewUrl}
                  alt={artworkTitle || sourceFileName}
                  className="max-h-48 object-contain rounded"
                />
              </div>
              <div className="md:col-span-2 space-y-2 text-xs sm:text-sm">
                <div className="font-semibold text-cyan-200">{sourceFileName}</div>
                <div className="text-slate-300">
                  {t.create.imageInfo}:{' '}
                  <span className="font-mono text-white">
                    {artworkRaster.width} × {artworkRaster.height} px (RGBA8 · {sourceFormat})
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs text-slate-400">{t.create.artworkShaLabel}</div>
                  <div className="font-mono text-xs text-cyan-300 break-all">{artworkShaHex}</div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
              >
                {LICENSE_DEFINITIONS.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.id} — {lic.shortLabel}
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
              >
                <option value="disallow">{t.create.policyDisallow}</option>
                <option value="allow">{t.create.policyAllow}</option>
                <option value="unspecified">{t.create.policyUnspecified}</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 flex items-start gap-2.5 text-xs text-slate-300">
            <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.create.ccNotice}</span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step4}</h2>
          {keys.length === 0 ? (
            <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t.create.noKeysWarning}</span>
              </div>
              <Link
                to="/keys"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 shrink-0"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.create.goToKeys}</span>
              </Link>
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
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{t.create.step5}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="placement" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.placementLabel}
              </label>
              <select
                id="placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value as QrPlacement)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
              >
                <option value="dark-slate">{t.create.themes['dark-slate']}</option>
                <option value="pure-white">{t.create.themes['pure-white']}</option>
                <option value="transparent-margin">{t.create.themes['transparent-margin']}</option>
              </select>
            </div>

            <div>
              <label htmlFor="marginPx" className="block text-xs font-medium text-slate-300 mb-1">
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
                className="w-full accent-cyan-400 mt-2"
              />
            </div>

            <div>
              <label htmlFor="moduleScale" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.moduleScaleLabel}
              </label>
              <select
                id="moduleScale"
                value={moduleScale}
                onChange={(e) => setModuleScale(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer min-h-[40px]">
              <input
                type="checkbox"
                checked={showLabel}
                onChange={(e) => setShowLabel(e.target.checked)}
                className="h-4 w-4 rounded accent-cyan-500"
              />
              <span>{t.create.showLabelToggle}</span>
            </label>

            <div>
              <label htmlFor="verifyBaseUrl" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.verifyUrlLabel}
              </label>
              <input
                id="verifyBaseUrl"
                type="url"
                value={verifyBaseUrl}
                onChange={(e) => setVerifyBaseUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-mono text-slate-200"
              />
              <p className="text-[11px] text-slate-400 mt-1">{t.create.verifyUrlHint}</p>
            </div>
          </div>
        </section>

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
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            <span>{busy ? t.create.signingBusy : t.create.signButton}</span>
          </button>
          <span className="text-xs text-slate-400">{t.create.timestampNote}</span>
        </div>
      </form>

      {signedResult && signedPreviewUrl && (
        <section
          data-testid="create-result-section"
          className="rounded-2xl border border-cyan-500/35 bg-[#091b30] p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-cyan-200">{t.create.resultTitle}</h2>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleDownloadSignedPng}
                data-testid="download-signed-png"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 min-h-[44px]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{t.create.downloadPng}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyProofUrl}
                data-testid="copy-proof-url"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-cyan-400/50 min-h-[44px]"
              >
                {copiedUrl ? <Check className="h-4 w-4 text-cyan-300" /> : <Copy className="h-4 w-4" />}
                <span>{copiedUrl ? t.create.copied : t.create.copyProofUrl}</span>
              </button>

              <Link
                to={localVerifyRoute}
                data-testid="open-local-verify"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 min-h-[44px]"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>{t.nav.verify}</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex justify-center">
              <img
                src={signedPreviewUrl}
                alt="Signed artwork with burned-in QR code"
                className="max-h-[420px] object-contain"
              />
            </div>

            <dl className="space-y-3 text-xs sm:text-sm">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <dt className="text-xs text-slate-400">{t.create.artworkRegionLabel}</dt>
                <dd className="font-mono text-white mt-0.5">
                  [{signedResult.manifest.region.join(', ')}] → Output{' '}
                  {signedResult.raster.width} × {signedResult.raster.height} px
                </dd>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <dt className="text-xs text-slate-400">{t.create.artworkShaLabel}</dt>
                <dd className="font-mono text-xs text-cyan-300 break-all mt-0.5">
                  {bytesToHex(signedResult.manifest.sha256)}
                </dd>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <dt className="text-xs text-slate-400">{t.create.proofSizeLabel}</dt>
                  <dd className="font-mono text-white mt-0.5">
                    {signedResult.proofBytes.length} bytes
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
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
