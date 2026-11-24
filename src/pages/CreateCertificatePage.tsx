import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileJson,
  FileSignature,
  Frame,
  ImagePlus,
  Info,
  KeyRound,
  QrCode,
  Sparkles,
} from 'lucide-react';
import {
  ArtworkDetailsPanel,
  createEmptyArtworkDetailsDraft,
} from '../components/ArtworkDetailsPanel';
import type { ArtworkDetailsDraft } from '../components/ArtworkDetailsPanel';
import { ImageDropzone } from '../components/ImageDropzone';
import {
  InImageAdvancedControls,
  InImageQrStudioPanel,
} from '../components/InImageQrStudioPanel';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { AdvancedSettings } from '../components/ui/AdvancedSettings';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { computePublicKeyFingerprint } from '../core/crypto/ed25519';
import { saveProofToVault } from '../core/vault';
import { evaluatePassphraseStrength } from '../core/crypto/keyBackup';
import { bytesToHex } from '../core/crypto/sha256';
import { clampInImageQrOptions } from '../core/image/inImageQr';
import type { InImageQrStyle } from '../core/image/inImageQr';
import { decodeImageFileToCanonicalRgba8 } from '../core/image/pngCodec';
import type { CanonicalRaster } from '../core/image/pngCodec';
import type { FrameTheme, QrPlacement } from '../core/image/qrBurner';
import { utf8ByteLength } from '../core/manifest/cborCodec';
import {
  createSignedEvidenceExtension,
  hasEvidenceExtensionDetails,
} from '../core/manifest/evidenceExtension';
import type {
  EvidenceExtensionDetailsInput,
  PortableEvidenceBundle,
} from '../core/manifest/evidenceExtension';
import { createPortableProofBundle } from '../core/manifest/proofBundle';
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
import {
  clearCreatorProfileDefaults,
  createAuthorKey,
  listAuthorKeys,
  loadCreatorProfileDefaults,
  markAuthorKeyBackedUp,
  saveCreatorProfileDefaults,
} from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

type QrCreationMode = 'outer-frame' | 'in-image';

type UnifiedSignResult =
  | (SignedArtworkResult & { mode: 'outer-frame'; qrMask?: undefined })
  | (InImageSignedArtworkResult & { mode: 'in-image'; qrMask: ArtworkRegion });

function triggerPngDownload(pngBytes: Uint8Array, filename: string) {
  const pngCopy = new Uint8Array(pngBytes.byteLength);
  pngCopy.set(pngBytes);
  const blob = new Blob([pngCopy.buffer], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerJsonDownload(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildExtensionDetailsInput(draft: ArtworkDetailsDraft): EvidenceExtensionDetailsInput {
  return {
    artworkMetadata: {
      title: draft.extTitle || undefined,
      artistName: draft.extArtistName || undefined,
      description: draft.extDescription || undefined,
    },
    creatorProfile: {
      displayName: draft.creatorDisplayName || undefined,
      website: draft.creatorWebsite || undefined,
      links: draft.creatorLinks
        .filter((l) => l.url.trim().length > 0)
        .map((l) => ({
          url: l.url,
          label: l.label || undefined,
        })),
    },
    creationMethod: draft.creationMethod || undefined,
    creationEnvironment: {
      software: draft.envSoftware || undefined,
      hardware: draft.envHardware || undefined,
      inputDevice: draft.envInputDevice || undefined,
      notes: draft.envNotes || undefined,
    },
    evidenceRecords:
      draft.evidenceItems.length > 0
        ? draft.evidenceItems.map((item) => ({
            sha256: item.sha256,
            byteLength: item.byteLength,
            label: item.label || undefined,
            category: item.category,
            mimeType: item.mimeType || undefined,
          }))
        : undefined,
  };
}

export function CreateCertificatePage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const replaceInputId = useId();

  const qrMode: QrCreationMode =
    searchParams.get('mode') === 'studio' ? 'in-image' : 'outer-frame';

  const setQrMode = (nextMode: QrCreationMode) => {
    setSignedResult(null);
    setSignedEvidence(null);
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
  const [quickPassphrase, setQuickPassphrase] = useState('');
  const [quickKeyBusy, setQuickKeyBusy] = useState(false);
  const [quickKeyError, setQuickKeyError] = useState<string | null>(null);
  const quickPassphraseStrength = evaluatePassphraseStrength(quickPassphrase);

  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<string>('');
  const [artworkRaster, setArtworkRaster] = useState<CanonicalRaster | null>(null);
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [licenseId, setLicenseId] = useState<LicenseId>('ARR');
  const [attributionName, setAttributionName] = useState('');
  const [commercialUse, setCommercialUse] = useState<PolicySignal>('unspecified');
  const [redistribution, setRedistribution] = useState<PolicySignal>('unspecified');
  const [aiTraining, setAiTraining] = useState<PolicySignal>('disallow');

  // Optional extended Artwork Details & Evidence Extension (.chmevidence)
  const [detailsDraft, setDetailsDraft] = useState<ArtworkDetailsDraft>(
    createEmptyArtworkDetailsDraft,
  );
  const [profileSavedIndicator, setProfileSavedIndicator] = useState(false);

  // Outer Margin Frame options (Protocol v1)
  const [placement, setPlacement] = useState<QrPlacement>('bottom-right');
  const [theme, setTheme] = useState<FrameTheme>('dark-slate');
  const [marginPx, setMarginPx] = useState<number>(12);
  const [moduleScale, setModuleScale] = useState<number>(0); // 0 = Auto
  const [outerQuietZone, setOuterQuietZone] = useState<number>(1);
  const [showLabel, setShowLabel] = useState<boolean>(true);

  // In-Image Semi-Transparent QR Studio options (Protocol v2)
  const [qrX, setQrX] = useState<number>(24);
  const [qrY, setQrY] = useState<number>(24);
  const [qrBoxSize, setQrBoxSize] = useState<number>(180);
  const [qrOpacityPct, setQrOpacityPct] = useState<number>(72);
  const [qrStyle, setQrStyle] = useState<InImageQrStyle>('frosted-light');
  const [eccLevel, setEccLevel] = useState<QrErrorCorrectionLevel>('Q');
  const [qrQuietZone, setQrQuietZone] = useState<number>(1);

  const [verifyBaseUrl, setVerifyBaseUrl] = useState<string>(DEFAULT_VERIFY_BASE_URL);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [signedResult, setSignedResult] = useState<UnifiedSignResult | null>(null);
  const [signedEvidence, setSignedEvidence] = useState<{
    evidenceBytes: Uint8Array;
    bundle: PortableEvidenceBundle;
    saved: boolean;
  } | null>(null);
  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    void listAuthorKeys().then((list) => {
      setKeys(list);
      if (list.length > 0) setSelectedKeyId(list[0].id);
    });
    void loadCreatorProfileDefaults().then((savedProfile) => {
      if (!savedProfile) return;
      setDetailsDraft((prev) => ({
        ...prev,
        creatorDisplayName: prev.creatorDisplayName || savedProfile.displayName || '',
        creatorWebsite: prev.creatorWebsite || savedProfile.website || '',
        creatorLinks:
          prev.creatorLinks.length > 0 ? prev.creatorLinks : (savedProfile.links ?? []),
      }));
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
      quietZoneModules: qrQuietZone,
    });
  }, [artworkRaster, qrX, qrY, qrBoxSize, qrOpacityPct, qrStyle, eccLevel, qrQuietZone]);

  const estimatedProofTokenChars = useMemo(() => {
    const extraBytes =
      utf8ByteLength(authorName.trim()) +
      utf8ByteLength(artworkTitle.trim()) +
      utf8ByteLength(attributionName.trim());
    return 310 + Math.ceil((extraBytes * 4) / 3);
  }, [authorName, artworkTitle, attributionName]);

  const buildDownloadFilename = (mode: QrCreationMode) => {
    const base = sourceFileName.replace(/\.[^.]+$/, '') || 'artwork';
    return mode === 'in-image'
      ? `${base}.in-image-qr.certified-handmade.png`
      : `${base}.certified-handmade.png`;
  };

  const handleSaveProfileDefaults = async () => {
    await saveCreatorProfileDefaults({
      displayName: detailsDraft.creatorDisplayName,
      website: detailsDraft.creatorWebsite,
      links: detailsDraft.creatorLinks,
    });
    setProfileSavedIndicator(true);
    window.setTimeout(() => setProfileSavedIndicator(false), 3000);
  };

  const handleClearProfileDefaults = async () => {
    await clearCreatorProfileDefaults();
    setProfileSavedIndicator(false);
    setDetailsDraft((prev) => ({
      ...prev,
      creatorDisplayName: '',
      creatorWebsite: '',
      creatorLinks: [],
    }));
  };

  const handleQuickCreateKey = async () => {
    setErrorMsg(null);
    setQuickKeyError(null);
    if (quickPassphrase && quickPassphrase.length < 8) {
      setQuickKeyError(
        'Backup passphrase must be at least 8 characters (or leave empty to skip backup)',
      );
      return;
    }
    setQuickKeyBusy(true);
    try {
      const { record } = await createAuthorKey({
        label: authorName.trim() || 'Artist Key',
        backupPassphrase: quickPassphrase || undefined,
      });
      setQuickPassphrase('');
      const updated = await listAuthorKeys();
      setKeys(updated);
      setSelectedKeyId(record.id);
    } catch (err) {
      setQuickKeyError(err instanceof Error ? err.message : 'Failed to create local signing key');
    } finally {
      setQuickKeyBusy(false);
    }
  };

  const handleDownloadSelectedKeyBackup = async () => {
    if (!selectedKey?.encryptedBackup) return;
    const backup = selectedKey.encryptedBackup;
    const safeName = backup.label.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'artist';
    triggerJsonDownload(backup, `chm-${safeName}-${backup.fingerprint.slice(0, 8)}.chkey.json`);
    await markAuthorKeyBackedUp(selectedKey.id);
    const updated = await listAuthorKeys();
    setKeys(updated);
  };

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);
    setSignedResult(null);
    setSignedEvidence(null);
    try {
      const rawFileBytes = new Uint8Array(await file.arrayBuffer());
      const { raster, sourceFormat: fmt } = await decodeImageFileToCanonicalRgba8(rawFileBytes);
      if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
      const url = URL.createObjectURL(file);

      const minDim = Math.min(raster.width, raster.height);
      const defaultBox = Math.max(
        Math.min(minDim, 148),
        Math.min(260, Math.round(minDim * 0.3)),
      );
      const pad = Math.min(24, Math.floor(minDim * 0.05));

      setSourceFileName(file.name);
      setSourceFormat(fmt);
      setArtworkRaster(raster);
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
      const detailsInput = buildExtensionDetailsInput(detailsDraft);
      const needsExtension = hasEvidenceExtensionDetails(detailsInput);

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
            quietZoneModules: clampedStudioOptions.quietZoneModules,
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
            quietZoneModules: outerQuietZone,
            showLabel,
          },
          verifyBaseUrl,
        });
        res = { ...marginRes, mode: 'outer-frame' };
      }

      let nextExtensionState: {
        evidenceBytes: Uint8Array;
        bundle: PortableEvidenceBundle;
        saved: boolean;
      } | null = null;
      if (needsExtension) {
        const fpHex =
          selectedKey.fingerprintHex ??
          (await computePublicKeyFingerprint(res.manifest.publicKey)).fullHex;
        const extRes = await createSignedEvidenceExtension({
          proofBytes: res.proofBytes,
          manifest: res.manifest,
          authorKey: selectedKey,
          passphraseIfEncrypted: keyPassphrase || undefined,
          publicKeyFingerprintHex: fpHex,
          details: detailsInput,
        });
        nextExtensionState = {
          evidenceBytes: extRes.evidenceBytes,
          bundle: extRes.bundle,
          saved: false,
        };
      }

      if (signedPreviewUrl) URL.revokeObjectURL(signedPreviewUrl);
      const pngCopy = new Uint8Array(res.pngBytes.byteLength);
      pngCopy.set(res.pngBytes);
      const blob = new Blob([pngCopy.buffer], { type: 'image/png' });
      const previewUrl = URL.createObjectURL(blob);
      await saveProofToVault({
        proofInput: res.proofBytes,
        creationMethod: detailsDraft.creationMethod,
      }).catch(() => {});
      setSignedPreviewUrl(previewUrl);
      setSignedResult(res);
      setSignedEvidence(nextExtensionState);
      triggerPngDownload(res.pngBytes, buildDownloadFilename(res.mode));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadSignedPng = () => {
    if (!signedResult) return;
    triggerPngDownload(signedResult.pngBytes, buildDownloadFilename(signedResult.mode));
  };

  const handleDownloadProofBundle = async () => {
    if (!signedResult) return;
    const fp =
      selectedKey?.fingerprintHex ??
      (await computePublicKeyFingerprint(signedResult.manifest.publicKey)).fullHex;
    const bundle = createPortableProofBundle({
      protocolVersion: signedResult.mode === 'in-image' ? 2 : 1,
      artworkId: signedResult.manifest.artworkIdHex,
      publicKeyFingerprint: fp,
      proofBytes: signedResult.proofBytes,
      verifyBaseUrl,
    });
    const base = sourceFileName.replace(/\.[^.]+$/, '') || 'artwork';
    triggerJsonDownload(bundle, `${base}.chproof.json`);
  };

  const handleDownloadEvidenceExtension = () => {
    if (!signedEvidence) return;
    const base = sourceFileName.replace(/\.[^.]+$/, '') || 'artwork';
    triggerJsonDownload(signedEvidence.bundle, `${base}.chmevidence`);
    setSignedEvidence((prev) => (prev ? { ...prev, saved: true } : null));
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

  const outerFrameColors =
    theme === 'pure-white'
      ? 'bg-slate-100 text-slate-900 border-slate-300'
      : theme === 'transparent-margin'
        ? 'bg-[#030b18]/40 text-slate-100 border-dashed border-white/25'
        : 'bg-[#0c1a30] text-slate-100 border-sky-400/25';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            {t.home.ctaCreate}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">{t.minimal.create.step1Hint}</p>
        </div>

        <HelpIconButton
          label={t.minimal.create.helpLabel}
          title={t.minimal.create.helpLabel}
          closeLabel={t.minimal.home.closeHelp}
          testId="create-help-btn"
        >
          <p>{t.minimal.create.helpBody}</p>
          <p className="text-xs text-slate-400">{t.create.timestampNote}</p>
        </HelpIconButton>
      </header>

      <form onSubmit={handleSignAndBurn} className="space-y-6">
        {/* Step 1 — Select Artwork */}
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {t.minimal.create.step1Title}
          </h2>

          {!artworkRaster || !artworkPreviewUrl ? (
            <ImageDropzone
              onFileSelected={handleFileSelected}
              title={t.create.dropzoneText}
              subtitle={t.minimal.create.step1Hint}
              testId="create-image-input"
            />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-white/[0.09] bg-[#030b18]/70 p-4">
              <div className="flex justify-center bg-[#020813] rounded-lg p-2 border border-white/[0.08] shrink-0">
                <img
                  src={artworkPreviewUrl}
                  alt={artworkTitle || detailsDraft.extTitle || sourceFileName}
                  className="max-h-36 max-w-[180px] object-contain rounded"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-2 text-center sm:text-start">
                <div className="font-medium text-sky-100 truncate">{sourceFileName}</div>
                <div className="font-mono text-xs text-slate-300">
                  {artworkRaster.width} × {artworkRaster.height} px · {sourceFormat}
                </div>
                <div className="pt-1">
                  <input
                    id={replaceInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    data-testid="create-image-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileSelected(file);
                      e.target.value = '';
                    }}
                    className="sr-only"
                  />
                  <label
                    htmlFor={replaceInputId}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.16] bg-white/[0.05] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:border-sky-400/40 hover:text-white transition-colors min-h-[44px] cursor-pointer"
                  >
                    <ImagePlus className="h-4 w-4 text-sky-300" aria-hidden="true" />
                    <span>{t.minimal.create.changeImageBtn}</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Step 2 — Identity and License */}
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {t.minimal.create.step2Title}
          </h2>

          {keys.length === 0 ? (
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-sky-100">
                    {t.minimal.create.createSigningKeyBtn}
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {t.minimal.create.keyRequiredNote}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="quickPassphrase"
                  className="block text-xs font-medium text-slate-200 mb-1"
                >
                  {t.create.quickPassLabel}
                </label>
                <input
                  id="quickPassphrase"
                  type="password"
                  value={quickPassphrase}
                  onChange={(e) => setQuickPassphrase(e.target.value)}
                  placeholder={t.create.quickPassPlaceholder}
                  data-testid="create-quick-passphrase"
                  className="w-full rounded-lg border border-white/[0.16] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                />
                {quickPassphrase.length > 0 && (
                  <div data-testid="create-quick-passphrase-strength" className="mt-1.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">{t.hardening.passphraseStrength.label}</span>
                      <span
                        className={
                          quickPassphraseStrength.score === 'strong'
                            ? 'font-medium text-emerald-300'
                            : quickPassphraseStrength.score === 'fair'
                              ? 'font-medium text-amber-200'
                              : 'font-medium text-rose-300'
                        }
                      >
                        {quickPassphraseStrength.score === 'strong'
                          ? t.hardening.passphraseStrength.strong
                          : quickPassphraseStrength.score === 'fair'
                            ? t.hardening.passphraseStrength.fair
                            : t.hardening.passphraseStrength.tooShort}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300/85">
                      {t.hardening.passphraseStrength.guidance}
                    </p>
                  </div>
                )}
              </div>

              {quickKeyError && (
                <p role="alert" className="text-xs text-rose-300">
                  {quickKeyError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={quickKeyBusy}
                  onClick={handleQuickCreateKey}
                  data-testid="create-quick-keygen"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {quickKeyBusy ? t.howTo.quickKeyBusy : t.minimal.create.createSigningKeyBtn}
                  </span>
                </button>

                <Link
                  to="/keys"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.16] bg-[#030b18]/65 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:border-white/[0.3] min-h-[44px]"
                >
                  <span>{t.create.goToKeys}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="signingKey"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    {t.create.selectKeyLabel}
                  </label>
                  <select
                    id="signingKey"
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyId(e.target.value)}
                    data-testid="create-key-select"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                    />
                  </div>
                )}
              </div>

              {selectedKey && !selectedKey.hasBackupDownloaded && (
                <div
                  role="note"
                  data-testid="create-key-backup-warning"
                  className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3.5 space-y-2.5 text-xs text-amber-100"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className="h-4 w-4 text-amber-300 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-200">
                        {t.create.keyNotBackedUpWarning}
                      </p>
                      <p className="text-amber-100/90 leading-relaxed">
                        {selectedKey.encryptedBackup
                          ? t.create.quickBackupReadyBody
                          : t.create.keyNonExtractableNoBackup}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 ps-6">
                    {selectedKey.encryptedBackup && (
                      <button
                        type="button"
                        data-testid="create-download-pending-backup"
                        onClick={() => void handleDownloadSelectedKeyBackup()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-300 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-200 min-h-[40px] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.keys.downloadBackupBtn}</span>
                      </button>
                    )}
                    <Link
                      to="/keys"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-[#030b18]/60 px-3.5 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/20 min-h-[40px]"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.create.goToKeys}</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <div>
              <label htmlFor="licenseId" className="block text-xs font-medium text-slate-300 mb-1">
                {t.create.licenseLabel}
              </label>
              <select
                id="licenseId"
                value={licenseId}
                onChange={(e) => setLicenseId(e.target.value as LicenseId)}
                data-testid="create-license-select"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
              >
                {LICENSE_DEFINITIONS.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.id} — {t.licenses.items[lic.id].name}
                  </option>
                ))}
              </select>
            </div>

            <LicenseSummaryCard
              licenseId={licenseId}
              compact
              testId="create-license-summary"
            />
          </div>

          <AdvancedSettings
            label={t.minimal.create.advancedIdentityLabel}
            testId="create-identity-advanced"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <label htmlFor="authorName">{t.create.authorLabel}</label>
                  <span className="font-mono text-slate-400">
                    {utf8ByteLength(authorName)} / {MAX_AUTHOR_UTF8_BYTES}
                  </span>
                </div>
                <input
                  id="authorName"
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={t.create.authorPlaceholder}
                  data-testid="create-author-input"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <label htmlFor="artworkTitle">{t.create.titleLabel}</label>
                  <span className="font-mono text-slate-400">
                    {utf8ByteLength(artworkTitle)} / {MAX_TITLE_UTF8_BYTES}
                  </span>
                </div>
                <input
                  id="artworkTitle"
                  type="text"
                  value={artworkTitle}
                  onChange={(e) => setArtworkTitle(e.target.value)}
                  placeholder={t.create.titlePlaceholder}
                  data-testid="create-title-input"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="attributionName">{t.create.attributionLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(attributionName)} / {MAX_ATTRIBUTION_UTF8_BYTES}
                </span>
              </div>
              <input
                id="attributionName"
                type="text"
                value={attributionName}
                onChange={(e) => setAttributionName(e.target.value)}
                placeholder={t.create.attributionPlaceholder}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
          </AdvancedSettings>

          <ArtworkDetailsPanel
            draft={detailsDraft}
            onChange={setDetailsDraft}
            onSaveProfileDefaults={handleSaveProfileDefaults}
            onClearProfileDefaults={handleClearProfileDefaults}
            profileSavedIndicator={profileSavedIndicator}
          />
        </section>

        {/* Step 3 — QR Placement */}
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {t.minimal.create.step3Title}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={qrMode === 'outer-frame'}
              onClick={() => setQrMode('outer-frame')}
              data-testid="create-mode-margin"
              className={`text-start rounded-xl border p-4 transition-colors cursor-pointer min-h-[44px] ${
                qrMode === 'outer-frame'
                  ? 'border-sky-300/60 bg-sky-500/15 text-white'
                  : 'border-white/[0.1] bg-[#030b18]/60 text-slate-300 hover:border-white/[0.22]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Frame className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                  <span>{t.minimal.create.modeOutsideTitle}</span>
                </span>
                <span className="rounded bg-sky-400/15 border border-sky-300/30 px-2 py-0.5 text-[10px] font-mono text-sky-200">
                  {t.minimal.create.modeOutsideBadge}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-300/90 leading-relaxed">
                {t.minimal.create.modeOutsideDesc}
              </p>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={qrMode === 'in-image'}
              onClick={() => setQrMode('in-image')}
              data-testid="create-mode-studio"
              className={`text-start rounded-xl border p-4 transition-colors cursor-pointer min-h-[44px] ${
                qrMode === 'in-image'
                  ? 'border-sky-300/60 bg-sky-500/15 text-white'
                  : 'border-white/[0.1] bg-[#030b18]/60 text-slate-300 hover:border-white/[0.22]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <QrCode className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                  <span>{t.minimal.create.modeInsideTitle}</span>
                </span>
                <span className="rounded bg-white/[0.08] border border-white/[0.14] px-2 py-0.5 text-[10px] font-mono text-slate-200">
                  {t.minimal.create.modeInsideBadge}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-300/90 leading-relaxed">
                {t.minimal.create.modeInsideDesc}
              </p>
            </button>
          </div>

          {qrMode === 'outer-frame' && artworkPreviewUrl && (
            <div
              data-testid="create-outer-live-preview"
              className={`rounded-xl border p-3 flex flex-col items-center gap-2.5 ${outerFrameColors}`}
            >
              {placement === 'top-right' && (
                <div className="w-full flex justify-end items-center gap-2 text-[11px] font-mono opacity-80">
                  {showLabel && <span>CHM v1 · {licenseId}</span>}
                  <span className="inline-flex items-center justify-center rounded border border-current/40 p-0.5">
                    <QrCode className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              )}

              <img
                src={artworkPreviewUrl}
                alt={artworkTitle || detailsDraft.extTitle || sourceFileName}
                className="max-h-52 object-contain rounded border border-white/[0.08]"
              />

              {placement !== 'top-right' && (
                <div
                  className={`w-full flex items-center gap-2 text-[11px] font-mono opacity-80 ${
                    placement === 'bottom-left'
                      ? 'justify-start'
                      : placement === 'bottom-center'
                        ? 'justify-center'
                        : 'justify-end'
                  }`}
                >
                  {showLabel && <span>CHM v1 · {licenseId}</span>}
                  <span className="inline-flex items-center justify-center rounded border border-current/40 p-0.5">
                    <QrCode className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              )}
              <p className="text-[11px] opacity-75 text-center">{t.minimal.create.outerPreviewNote}</p>
            </div>
          )}

          {qrMode === 'in-image' &&
            (artworkRaster && clampedStudioOptions ? (
              <InImageQrStudioPanel
                artworkRaster={artworkRaster}
                clampedOptions={clampedStudioOptions}
                eccLevel={eccLevel}
                verifyBaseUrl={verifyBaseUrl}
                estimatedProofTokenChars={estimatedProofTokenChars}
                onChangeX={setQrX}
                onChangeY={setQrY}
                onChangeBoxSize={setQrBoxSize}
              />
            ) : (
              <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.07] p-4 text-xs sm:text-sm text-sky-100 flex items-center gap-2.5">
                <QrCode className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                <span>{t.qrStudio.uploadFirstHint}</span>
              </div>
            ))}

          <AdvancedSettings
            label={t.minimal.create.advancedQrLabel}
            testId="create-qr-advanced"
          >
            {qrMode === 'outer-frame' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
                      min={4}
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
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                    >
                      <option value={0}>{t.create.autoScale}</option>
                      <option value={2}>2 px / module</option>
                      <option value={3}>3 px / module</option>
                      <option value={4}>4 px / module</option>
                      <option value={5}>5 px / module</option>
                      <option value={6}>6 px / module</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="outerQuietZone"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      {t.minimal.create.quietZoneLabel}
                    </label>
                    <select
                      id="outerQuietZone"
                      value={outerQuietZone}
                      onChange={(e) => setOuterQuietZone(Number(e.target.value))}
                      data-testid="create-outer-quietzone-select"
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                    >
                      <option value={1}>{t.minimal.create.quietZoneMinimal}</option>
                      <option value={2}>{t.minimal.create.quietZoneCompact}</option>
                      <option value={4}>{t.minimal.create.quietZoneStandard}</option>
                    </select>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={showLabel}
                    onChange={(e) => setShowLabel(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-300"
                  />
                  <span>{t.create.showLabelToggle}</span>
                </label>
              </div>
            ) : (
              <InImageAdvancedControls
                artworkRaster={artworkRaster}
                clampedOptions={clampedStudioOptions}
                qrX={qrX}
                qrY={qrY}
                qrBoxSize={qrBoxSize}
                qrOpacityPct={qrOpacityPct}
                qrStyle={qrStyle}
                eccLevel={eccLevel}
                qrQuietZone={qrQuietZone}
                onChangeX={setQrX}
                onChangeY={setQrY}
                onChangeBoxSize={setQrBoxSize}
                onChangeOpacityPct={setQrOpacityPct}
                onChangeStyle={setQrStyle}
                onChangeEcc={setEccLevel}
                onChangeQuietZone={setQrQuietZone}
              />
            )}

            <div className="pt-2 border-t border-white/[0.08]">
              <label
                htmlFor="verifyBaseUrl"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.create.verifyUrlLabel}
              </label>
              <input
                id="verifyBaseUrl"
                type="url"
                value={verifyBaseUrl}
                onChange={(e) => setVerifyBaseUrl(e.target.value)}
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-xs font-mono text-slate-200 min-h-[44px]"
              />
              <p className="text-[11px] text-slate-400 mt-1">{t.create.verifyUrlHint}</p>
            </div>
          </AdvancedSettings>
        </section>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-4 text-sm text-rose-200"
          >
            {errorMsg}
          </div>
        )}

        {/* Step 4 — Sign and Download */}
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {t.minimal.create.step4Title}
          </h2>

          <button
            type="submit"
            disabled={busy || !artworkRaster || !selectedKey}
            data-testid="create-sign-button"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-100 px-7 py-3.5 text-base font-semibold text-slate-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px] cursor-pointer"
          >
            <FileSignature className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              {busy
                ? qrMode === 'in-image'
                  ? t.qrStudio.signingBusy
                  : t.create.signingBusy
                : t.minimal.create.signAndDownloadBtn}
            </span>
          </button>
        </section>
      </form>

      {signedResult && signedPreviewUrl && (
        <section
          data-testid="create-result-section"
          className="rounded-xl border border-sky-400/30 bg-[#051224]/80 backdrop-blur-md p-5 space-y-5"
        >
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-base sm:text-lg font-semibold text-sky-200 self-start">
              {t.create.resultTitle}
            </h2>

            <div className="w-full rounded-xl border border-white/[0.09] bg-[#020813]/85 p-3 flex justify-center">
              <img
                src={signedPreviewUrl}
                alt="Signed artwork with QR code"
                className="max-h-[380px] object-contain rounded"
              />
            </div>

            <div className="w-full flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleDownloadSignedPng}
                data-testid="download-signed-png"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white min-h-[44px] cursor-pointer"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t.create.downloadPng}</span>
              </button>

              {signedEvidence && (
                <button
                  type="button"
                  onClick={handleDownloadEvidenceExtension}
                  data-testid="download-evidence-extension"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-300/50 bg-sky-500/20 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/30 min-h-[44px] cursor-pointer"
                >
                  <FileCheck2 className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                  <span>{t.artworkDetails.downloadEvidenceBtn}</span>
                  {signedEvidence.saved && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-400/40 px-2 py-0.5 text-[11px] text-emerald-200">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      {t.artworkDetails.evidenceSavedBadge}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyProofUrl}
                data-testid="copy-proof-url"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.16] bg-[#030b18]/80 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
              >
                {copiedUrl ? (
                  <Check className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{copiedUrl ? t.create.copied : t.create.copyProofUrl}</span>
              </button>

              <Link
                to={localVerifyRoute}
                data-testid="open-local-verify"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-300/35 bg-sky-400/10 px-4 py-2.5 text-sm font-medium text-sky-200 hover:bg-sky-400/20 min-h-[44px]"
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t.nav.verify}</span>
              </Link>
            </div>
          </div>

          {signedEvidence && !signedEvidence.saved && (
            <div
              role="note"
              data-testid="create-evidence-save-reminder"
              className="rounded-xl border border-amber-400/45 bg-amber-500/15 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-amber-100"
            >
              <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.artworkDetails.evidenceSaveReminder}</span>
            </div>
          )}

          {!signedResult.qrVerifiedReadable && (
            <div
              role="alert"
              data-testid="create-qr-readability-warn"
              className="rounded-xl border border-amber-400/45 bg-amber-500/15 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-amber-100"
            >
              <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.create.qrReadabilityPostWarn}</span>
            </div>
          )}

          <AdvancedSettings
            label={t.minimal.create.technicalDetailsLabel}
            testId="create-result-technical"
          >
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => void handleDownloadProofBundle()}
                data-testid="download-proof-bundle"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.16] bg-[#030b18]/80 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-100 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
              >
                <FileJson className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
                <span>{t.create.downloadProofBundle}</span>
              </button>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                  <dt className="text-xs text-slate-400">{t.create.proofSizeLabel}</dt>
                  <dd className="font-mono text-white mt-0.5" data-testid="create-result-proof-bytes">
                    {signedResult.proofBytes.length} bytes
                  </dd>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                  <dt className="text-xs text-slate-400">{t.create.qrVersionLabel}</dt>
                  <dd className="font-mono text-white mt-0.5" data-testid="create-result-qr-version">
                    v{signedResult.qrVersion} ({signedResult.qrModules}×{signedResult.qrModules})
                  </dd>
                </div>
                {signedEvidence && (
                  <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
                    <dt className="text-xs text-slate-400">.chmevidence</dt>
                    <dd
                      className="font-mono text-sky-200 mt-0.5"
                      data-testid="create-result-evidence-bytes"
                    >
                      {signedEvidence.evidenceBytes.length} bytes
                    </dd>
                  </div>
                )}
              </div>

              {signedEvidence && (
                <p className="text-[11px] text-slate-400">{t.artworkDetails.compactQrNote}</p>
              )}
            </dl>
          </AdvancedSettings>
        </section>
      )}
    </div>
  );
}
