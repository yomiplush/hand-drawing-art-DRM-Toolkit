import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  FileImage,
  Link2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { AssessmentDetailsCard } from '../components/AssessmentDetailsCard';
import { ImageDropzone } from '../components/ImageDropzone';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { QrCameraScanner } from '../components/QrCameraScanner';
import { StatusDimensionsGrid } from '../components/StatusBadge';
import { base64UrlEncode, bytesToHex } from '../core/crypto/sha256';
import { decodeImageFileToCanonicalRgba8 } from '../core/image/pngCodec';
import type { CanonicalRaster } from '../core/image/pngCodec';
import type { VerificationResult } from '../core/manifest/types';
import { addTrustedKey } from '../core/storage/keyStore';
import { verifyImageWithEmbeddedQr, verifyProofAndArtwork } from '../core/verify/verifier';
import { useI18n } from '../i18n/context';

type InputTab = 'image' | 'camera' | 'proof';

export function VerifyCertificatePage() {
  const { t } = useI18n();
  const location = useLocation();

  const hasInitialHashProof =
    typeof window !== 'undefined' && window.location.hash.includes('proof=');

  const [activeTab, setActiveTab] = useState<InputTab>(() =>
    hasInitialHashProof ? 'proof' : 'image',
  );
  const [proofInput, setProofInput] = useState(() =>
    hasInitialHashProof ? window.location.href : '',
  );
  const [activeProofRaw, setActiveProofRaw] = useState<string | null>(() =>
    hasInitialHashProof ? window.location.hash : null,
  );
  const [attachedRaster, setAttachedRaster] = useState<CanonicalRaster | null>(null);
  const [attachedRawBytes, setAttachedRawBytes] = useState<Uint8Array | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrInfoNote, setQrInfoNote] = useState<string | null>(null);

  const [trustLabelInput, setTrustLabelInput] = useState('');
  const [trustSavedMsg, setTrustSavedMsg] = useState<string | null>(null);

  const runProofVerify = useCallback(
    async (
      rawProof: string,
      raster: CanonicalRaster | null,
      rawBytes: Uint8Array | null = null,
    ) => {
      setErrorMsg(null);
      setTrustSavedMsg(null);
      setActiveProofRaw(rawProof);
      const res = await verifyProofAndArtwork({
        proofInput: rawProof,
        artworkRaster: raster,
        rawFileBytes: rawBytes,
      });
      setResult(res);
    },
    [],
  );

  // Automatically verify #proof=... when URL hash changes (and clear previous attached artwork)
  useEffect(() => {
    const hash = location.hash || window.location.hash;
    if (!hash || !hash.includes('proof=')) return;
    let active = true;
    verifyProofAndArtwork({
      proofInput: hash,
      artworkRaster: null,
      rawFileBytes: null,
    }).then((res) => {
      if (active) {
        setActiveTab('proof');
        setProofInput(window.location.href);
        setActiveProofRaw(hash);
        setAttachedRaster(null);
        setAttachedRawBytes(null);
        setAttachedFileName(null);
        setQrInfoNote(null);
        setErrorMsg(null);
        setTrustSavedMsg(null);
        setResult(res);
      }
    });
    return () => {
      active = false;
    };
  }, [location.hash]);

  const handleSignedImageUpload = async (file: File) => {
    setErrorMsg(null);
    setQrInfoNote(null);
    setTrustSavedMsg(null);
    try {
      const rawBytes = new Uint8Array(await file.arrayBuffer());
      const res = await verifyImageWithEmbeddedQr({ fileOrBytes: rawBytes });
      setAttachedRaster(res.raster);
      setAttachedRawBytes(rawBytes);
      setAttachedFileName(file.name);
      setActiveProofRaw(res.qrRawText);
      setProofInput(res.qrRawText);
      setQrInfoNote(
        `QR decoded (${res.qrStrategy}) · ${res.imageWidth}×${res.imageHeight} px (${res.sourceFormat})`,
      );
      setResult(res.verification);
    } catch (err) {
      setResult(null);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to verify image');
    }
  };

  const handleAttachArtworkForProof = async (file: File) => {
    setErrorMsg(null);
    try {
      const rawBytes = new Uint8Array(await file.arrayBuffer());
      const { raster } = await decodeImageFileToCanonicalRgba8(rawBytes);
      setAttachedRaster(raster);
      setAttachedRawBytes(rawBytes);
      setAttachedFileName(file.name);
      if (activeProofRaw) {
        await runProofVerify(activeProofRaw, raster, rawBytes);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to decode artwork image');
    }
  };

  const handleManualProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQrInfoNote(null);
    await runProofVerify(proofInput, attachedRaster, attachedRawBytes);
  };

  const handleCameraDetected = useCallback(
    (rawText: string) => {
      setProofInput(rawText);
      setQrInfoNote('QR detected from local camera stream');
      void runProofVerify(rawText, attachedRaster, attachedRawBytes);
    },
    [attachedRaster, attachedRawBytes, runProofVerify],
  );

  const handleTrustThisKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result?.manifest) return;
    const pubB64 = base64UrlEncode(result.manifest.publicKey);
    const label =
      trustLabelInput.trim() || result.manifest.authorName || result.publicKeyFingerprintShort || 'Artist';
    await addTrustedKey({
      publicKeyInput: pubB64,
      label,
      note: 'Added from verification screen',
    });
    setTrustLabelInput('');
    setTrustSavedMsg(label);
    if (activeProofRaw) {
      await runProofVerify(activeProofRaw, attachedRaster, attachedRawBytes);
    }
  };

  const renderOverallBanner = (res: VerificationResult) => {
    if (res.signatureStatus === 'unsupported') {
      return (
        <div
          role="alert"
          className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-4 flex items-center gap-3 text-amber-100"
        >
          <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0" />
          <span className="text-sm font-semibold">{t.verify.banners.unsupported}</span>
        </div>
      );
    }
    if (res.signatureStatus === 'invalid' || res.integrityStatus === 'mismatched') {
      return (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/50 bg-rose-500/15 p-4 flex items-center gap-3 text-rose-100"
        >
          <XCircle className="h-5 w-5 text-rose-300 shrink-0" />
          <span className="text-sm font-semibold">{t.verify.banners.invalid}</span>
        </div>
      );
    }
    if (res.integrityStatus === 'matched' && res.identityStatus === 'locally-trusted') {
      return (
        <div
          role="status"
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 flex items-center gap-3 text-emerald-100"
        >
          <ShieldCheck className="h-5 w-5 text-emerald-300 shrink-0" />
          <span className="text-sm font-semibold">{t.verify.banners.validTrustedMatched}</span>
        </div>
      );
    }
    if (res.integrityStatus === 'matched') {
      return (
        <div
          role="status"
          className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-4 flex items-center gap-3 text-cyan-100"
        >
          <ShieldAlert className="h-5 w-5 text-amber-300 shrink-0" />
          <span className="text-sm font-semibold">{t.verify.banners.validUnknownMatched}</span>
        </div>
      );
    }
    return (
      <div
        role="status"
        className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4 flex items-center gap-3 text-amber-100"
      >
        <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0" />
        <span className="text-sm font-semibold">{t.verify.banners.validNotChecked}</span>
      </div>
    );
  };

  const tabClass = (tab: InputTab) =>
    `inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
      activeTab === tab
        ? 'bg-white/[0.12] text-white border border-white/[0.2]'
        : 'bg-[#051224]/60 text-slate-300 border border-white/[0.09] hover:border-white/[0.18]'
    }`;

  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-white/[0.08] pb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">{t.verify.title}</h1>
        <p className="text-sm sm:text-base text-slate-300">{t.verify.subtitle}</p>
      </header>

      <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-5">
        <div className="flex flex-wrap gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'image'}
            onClick={() => setActiveTab('image')}
            className={tabClass('image')}
          >
            <FileImage className="h-4 w-4" aria-hidden="true" />
            <span>{t.verify.inputTabImage}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'camera'}
            onClick={() => setActiveTab('camera')}
            className={tabClass('camera')}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span>{t.verify.inputTabCamera}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'proof'}
            onClick={() => setActiveTab('proof')}
            className={tabClass('proof')}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            <span>{t.verify.inputTabProof}</span>
          </button>
        </div>

        {activeTab === 'image' && (
          <ImageDropzone
            onFileSelected={handleSignedImageUpload}
            title={t.verify.imageDropText}
            subtitle={t.verify.imageDropSub}
            testId="verify-image-input"
          />
        )}

        {activeTab === 'camera' && <QrCameraScanner onDetected={handleCameraDetected} />}

        {activeTab === 'proof' && (
          <form onSubmit={handleManualProofSubmit} className="space-y-3">
            <label htmlFor="proofInput" className="block text-xs font-medium text-slate-300">
              {t.verify.proofInputLabel}
            </label>
            <textarea
              id="proofInput"
              rows={3}
              value={proofInput}
              onChange={(e) => setProofInput(e.target.value)}
              placeholder={t.verify.proofInputPlaceholder}
              data-testid="verify-proof-textarea"
              className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 p-3 text-xs font-mono text-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              data-testid="verify-proof-submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white min-h-[44px]"
            >
              <span>{t.verify.verifyProofBtn}</span>
            </button>
          </form>
        )}

        {qrInfoNote && <p className="text-xs font-mono text-cyan-300">{qrInfoNote}</p>}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-sm text-rose-200"
          >
            {errorMsg}
          </div>
        )}
      </section>

      {result && (
        <div className="space-y-6" data-testid="verification-results">
          {renderOverallBanner(result)}

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-white">
              {t.verify.statusDimensionsTitle}
            </h2>
            <StatusDimensionsGrid
              signatureStatus={result.signatureStatus}
              integrityStatus={result.integrityStatus}
              identityStatus={result.identityStatus}
              assessmentStatus={result.assessmentStatus}
              assessment={result.assessment}
              trustedKeyLabel={result.trustedKeyLabel}
            />
          </section>

          <AssessmentDetailsCard
            assessment={result.assessment}
            testId="assessment-details-card"
          />

          {result.errors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-1 text-xs sm:text-sm text-rose-200"
            >
              {result.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-white/[0.1] bg-[#051224]/65 backdrop-blur-md p-4 text-xs sm:text-sm text-slate-300">
            {t.verify.trustReminder}
          </div>

          {result.manifest && (
            <section className="rounded-xl border border-white/[0.12] bg-[#051224]/65 backdrop-blur-md p-5 space-y-3">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                {t.verify.attachArtworkTitle}
              </h3>
              <p className="text-xs text-slate-400">{t.verify.attachArtworkHint}</p>
              <ImageDropzone
                onFileSelected={handleAttachArtworkForProof}
                title={
                  attachedFileName
                    ? `${t.verify.attachArtworkBtn} (${attachedFileName})`
                    : t.verify.attachArtworkBtn
                }
                testId="verify-attach-artwork-input"
              />
            </section>
          )}

          {result.manifest && (
            <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-white">
                {t.verify.detailsTitle}
              </h2>

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                <DetailRow
                  label={t.verify.fields.protocolVersion}
                  value={`v${result.manifest.version}`}
                  mono
                />
                <DetailRow
                  label={t.verify.fields.artworkId}
                  value={result.manifest.artworkIdHex}
                  mono
                />
                <DetailRow
                  label={t.verify.fields.authorName}
                  value={result.manifest.authorName || t.verify.fields.none}
                />
                <DetailRow
                  label={t.verify.fields.artworkTitle}
                  value={result.manifest.artworkTitle || t.verify.fields.none}
                />
                <DetailRow
                  label={t.verify.fields.issuedAt}
                  value={new Date(result.manifest.issuedAt * 1000).toISOString()}
                  mono
                />
                <DetailRow
                  label={t.verify.fields.region}
                  value={`[${result.manifest.region.join(', ')}]`}
                  mono
                />
                <DetailRow
                  label={t.verify.fields.fingerprint}
                  value={`${result.publicKeyFingerprintShort ?? ''} (${result.publicKeyFingerprintHex ?? ''})`}
                  mono
                />
                <DetailRow
                  label={t.verify.fields.publicKeyB64}
                  value={base64UrlEncode(result.manifest.publicKey)}
                  mono
                />
                <DetailRow
                  label={t.verify.fields.artworkSha}
                  value={bytesToHex(result.manifest.sha256)}
                  mono
                />
                <DetailRow
                  label={t.verify.fields.computedSha}
                  value={
                    result.computedArtworkSha256Hex
                      ? `${result.computedArtworkSha256Hex} (${result.matchedMode ?? 'checked'})`
                      : t.verify.badges.intNotChecked
                  }
                  mono
                />
                <DetailRow
                  label={t.verify.fields.license}
                  value={`${result.manifest.license.licenseId} — ${t.licenses.items[result.manifest.license.licenseId].name}`}
                />
                <DetailRow
                  label={t.verify.fields.attribution}
                  value={result.manifest.license.attributionName || t.verify.fields.none}
                />
                <DetailRow
                  label={t.verify.fields.commercial}
                  value={result.manifest.license.commercialUse}
                />
                <DetailRow
                  label={t.verify.fields.redistribution}
                  value={result.manifest.license.redistribution}
                />
                <DetailRow
                  label={t.verify.fields.aiTraining}
                  value={result.manifest.license.aiTraining}
                />
              </dl>

              <LicenseSummaryCard
                licenseId={result.manifest.license.licenseId}
                testId="verify-license-summary"
              />

              {result.signatureStatus === 'valid' && result.identityStatus === 'unknown' && (
                <form
                  onSubmit={handleTrustThisKey}
                  className="rounded-xl border border-white/[0.1] bg-[#030b18]/65 p-4 space-y-3"
                >
                  <p className="text-xs sm:text-sm font-medium text-slate-200">
                    {t.verify.trustKeyPrompt}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={trustLabelInput}
                      onChange={(e) => setTrustLabelInput(e.target.value)}
                      placeholder={t.verify.trustKeyLabelInput}
                      maxLength={64}
                      data-testid="verify-trust-label-input"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="submit"
                      data-testid="verify-trust-btn"
                      className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 min-h-[42px]"
                    >
                      {t.verify.trustKeyBtn}
                    </button>
                  </div>
                </form>
              )}

              {trustSavedMsg && (
                <p role="status" className="text-xs text-emerald-300">
                  {t.verify.trustedAlready} {trustSavedMsg}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-slate-100 break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
