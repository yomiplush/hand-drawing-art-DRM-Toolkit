import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  Plus,
  QrCode,
  Sparkles,
  Trash2,
  User,
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
import { evaluatePassphraseStrength } from '../core/crypto/keyBackup';
import { bytesToHex } from '../core/crypto/sha256';
import { clampInImageQrOptions } from '../core/image/inImageQr';
import type { InImageQrStyle } from '../core/image/inImageQr';
import { decodeImageFileToCanonicalRgba8 } from '../core/image/pngCodec';
import type { CanonicalRaster } from '../core/image/pngCodec';
import type { FrameTheme, QrPlacement } from '../core/image/qrBurner';
import { utf8ByteLength } from '../core/manifest/cborCodec';
import { createSignedEvidenceExtension } from '../core/manifest/evidenceExtension';
import type {
  EvidenceExtensionDetailsInput,
  PortableEvidenceBundle,
} from '../core/manifest/evidenceExtension';
import { createPortableProofBundle } from '../core/manifest/proofBundle';
import { measureUnsignedQrSizing } from '../core/manifest/qrSizing';
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
  MAX_V3_AUTHOR_UTF8_BYTES,
  MAX_V3_DESCRIPTION_UTF8_BYTES,
  MAX_V3_POLICY_NOTE_UTF8_BYTES,
  MAX_V3_PORTFOLIO_LINKS,
  MAX_V3_SNS_LINKS,
  MAX_V3_TITLE_UTF8_BYTES,
} from '../core/manifest/types';
import type {
  ArtworkRegion,
  CompactSnsLink,
  CreationEnvironmentData,
  CreatorProfileLink,
  EvidenceHashRecord,
  LicenseId,
  PolicySignal,
} from '../core/manifest/types';
import {
  detectPolicyContradictions,
  ensureDefaultPolicyPresets,
  savePolicyPreset,
} from '../core/policies';
import type { PolicyPreset } from '../core/policies';
import {
  buildAuthorProfileSnapshot,
  deleteAuthorProfile,
  listAuthorProfiles,
  migrateLegacyCreatorProfileIfNeeded,
  saveAuthorProfile,
  setDefaultAuthorProfile,
  trySanitizeProfileUrl,
  SNS_PLATFORM_PRESETS,
} from '../core/profiles';
import type { AuthorProfile, AuthorSnsLink, SnsPlatformId } from '../core/profiles';
import { generateQrMatrix } from '../core/qr/qrGenerator';
import type { QrErrorCorrectionLevel } from '../core/qr/qrGenerator';
import {
  createAuthorKey,
  listAuthorKeys,
  markAuthorKeyBackedUp,
} from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { saveProofToVault } from '../core/vault';
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

function OuterMiniQrCanvas({ previewUrl }: { previewUrl: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewUrl) return;
    try {
      const qr = generateQrMatrix(previewUrl, 'M');
      const quiet = 1;
      const totalModules = qr.size + quiet * 2;
      const targetPx = 64;
      canvas.width = targetPx;
      canvas.height = targetPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetPx, targetPx);
      ctx.fillStyle = '#09111f';
      const cell = targetPx / totalModules;
      for (let r = 0; r < qr.size; r++) {
        for (let c = 0; c < qr.size; c++) {
          if (qr.data[r * qr.size + c]) {
            ctx.fillRect(
              Math.floor((c + quiet) * cell),
              Math.floor((r + quiet) * cell),
              Math.ceil(cell),
              Math.ceil(cell),
            );
          }
        }
      }
    } catch {
      // Ignore transient capacity-exceeded error in mini preview
    }
  }, [previewUrl]);

  if (!previewUrl) {
    return (
      <span className="inline-flex items-center justify-center rounded border border-current/40 p-1">
        <QrCode className="h-6 w-6" aria-hidden="true" />
      </span>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      data-testid="create-outer-qr-canvas"
      className="h-14 w-14 rounded border border-white/25 bg-white shrink-0"
    />
  );
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

  // Keys
  const [keys, setKeys] = useState<AuthorKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [quickPassphrase, setQuickPassphrase] = useState('');
  const [quickKeyBusy, setQuickKeyBusy] = useState(false);
  const [quickKeyError, setQuickKeyError] = useState<string | null>(null);
  const quickPassphraseStrength = evaluatePassphraseStrength(quickPassphrase);

  // Artwork image
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<string>('');
  const [artworkRaster, setArtworkRaster] = useState<CanonicalRaster | null>(null);
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);

  // Canonical Artwork Metadata (single source of truth)
  const [artworkTitle, setArtworkTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attributionName, setAttributionName] = useState('');

  // Author Profiles (Multi-Profile)
  const [profiles, setProfiles] = useState<AuthorProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('new');
  const [profileName, setProfileName] = useState('');
  const [authorName, setAuthorName] = useState(''); // Canonical Display Name
  const [website, setWebsite] = useState('');
  const [publicNote, setPublicNote] = useState('');
  const [snsLinks, setSnsLinks] = useState<AuthorSnsLink[]>([]);
  const [portfolioLinks, setPortfolioLinks] = useState<CreatorProfileLink[]>([]);
  const [profileSavedIndicator, setProfileSavedIndicator] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Policies & Presets
  const [presets, setPresets] = useState<PolicyPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [newPresetName, setNewPresetName] = useState('');
  const [presetSavedIndicator, setPresetSavedIndicator] = useState(false);
  const [licenseId, setLicenseId] = useState<LicenseId>('ARR');
  const [commercialUse, setCommercialUse] = useState<PolicySignal>('unspecified');
  const [redistribution, setRedistribution] = useState<PolicySignal>('unspecified');
  const [aiTraining, setAiTraining] = useState<PolicySignal>('disallow');
  const [allowsDerivatives, setAllowsDerivatives] = useState<PolicySignal>('unspecified');
  const [allowsModifications, setAllowsModifications] = useState<PolicySignal>('unspecified');
  const [requiresAttribution, setRequiresAttribution] = useState<boolean>(true);
  const [policyNote, setPolicyNote] = useState('');

  // Creation Method, Environment, and Local Evidence Files
  const [detailsDraft, setDetailsDraft] = useState<ArtworkDetailsDraft>(
    createEmptyArtworkDetailsDraft,
  );

  // Outer Margin Frame options
  const [placement, setPlacement] = useState<QrPlacement>('bottom-right');
  const [theme, setTheme] = useState<FrameTheme>('dark-slate');
  const [marginPx, setMarginPx] = useState<number>(12);
  const [moduleScale, setModuleScale] = useState<number>(0); // 0 = Auto
  const [outerQuietZone, setOuterQuietZone] = useState<number>(1);
  const [showLabel, setShowLabel] = useState<boolean>(true);

  // In-Image Semi-Transparent QR Studio options
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

  const applyProfileToForm = (p: AuthorProfile) => {
    setSelectedProfileId(p.id);
    setProfileName(p.profileName);
    setAuthorName(p.displayName);
    setWebsite(p.website ?? '');
    setPublicNote(p.publicNote ?? '');
    setSnsLinks(p.snsLinks ?? []);
    setPortfolioLinks(p.portfolioLinks ?? []);
    if (p.defaultLicenseId) {
      setLicenseId(p.defaultLicenseId);
    }
    if (p.defaultAiTraining) {
      setAiTraining(p.defaultAiTraining);
    }
  };

  const applyPresetToForm = (preset: PolicyPreset) => {
    setSelectedPresetId(preset.id);
    setLicenseId(preset.licenseId);
    setCommercialUse(preset.commercialUse);
    setRedistribution(preset.redistribution);
    setAiTraining(preset.aiTraining);
    setAllowsDerivatives(preset.allowsDerivatives ?? "unspecified");
    setAllowsModifications(preset.allowsModifications ?? "unspecified");
    setRequiresAttribution(Boolean(preset.requiresAttribution));
    setPolicyNote(preset.customNote ?? '');
  };

  useEffect(() => {
    let active = true;
    void listAuthorKeys().then((list) => {
      if (!active) return;
      setKeys(list);
      if (list.length > 0) setSelectedKeyId(list[0].id);
    });

    void migrateLegacyCreatorProfileIfNeeded()
      .then(() => listAuthorProfiles())
      .then((loaded) => {
        if (!active) return;
        setProfiles(loaded);
        const def = loaded.find((p) => p.isDefault) ?? loaded[0];
        if (def) {
          applyProfileToForm(def);
        }
      });

    void ensureDefaultPolicyPresets().then((loadedPresets) => {
      if (!active) return;
      setPresets(loadedPresets);
      const def = loadedPresets.find((p) => p.isDefault);
      if (def) {
        applyPresetToForm(def);
      }
    });

    return () => {
      active = false;
    };
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

  const policyWarnings = useMemo(
    () =>
      detectPolicyContradictions({
        licenseId,
        commercialUse,
        redistribution,
        aiTraining,
        allowsDerivatives,
        allowsModifications,
      }).filter((w) => w.severity === 'warning'),
    [licenseId, commercialUse, redistribution, aiTraining, allowsDerivatives, allowsModifications],
  );

  const sanitizedCreationEnv = useMemo<CreationEnvironmentData | undefined>(() => {
    const software = detailsDraft.envSoftware.trim() || undefined;
    const hardware = detailsDraft.envHardware.trim() || undefined;
    const inputDevice = detailsDraft.envInputDevice.trim() || undefined;
    const notes = detailsDraft.envNotes.trim() || undefined;
    if (!software && !hardware && !inputDevice && !notes) return undefined;
    return { software, hardware, inputDevice, notes };
  }, [
    detailsDraft.envHardware,
    detailsDraft.envInputDevice,
    detailsDraft.envNotes,
    detailsDraft.envSoftware,
  ]);

  const sanitizedSnsLinks = useMemo<CompactSnsLink[]>(() => {
    const out: CompactSnsLink[] = [];
    for (const l of snsLinks) {
      const clean = trySanitizeProfileUrl(l.url);
      if (!clean) continue;
      out.push({
        url: clean,
        ...(l.platform ? { platform: l.platform } : {}),
        ...(l.label?.trim() ? { label: l.label.trim().slice(0, 32) } : {}),
      });
      if (out.length >= MAX_V3_SNS_LINKS) break;
    }
    return out;
  }, [snsLinks]);

  const sanitizedPortfolioLinks = useMemo<CreatorProfileLink[]>(() => {
    const out: CreatorProfileLink[] = [];
    for (const l of portfolioLinks) {
      const clean = trySanitizeProfileUrl(l.url);
      if (!clean) continue;
      out.push({
        url: clean,
        ...(l.label?.trim() ? { label: l.label.trim().slice(0, 32) } : {}),
      });
      if (out.length >= MAX_V3_PORTFOLIO_LINKS) break;
    }
    return out;
  }, [portfolioLinks]);

  const evidenceHashes = useMemo<EvidenceHashRecord[]>(() => {
    return detailsDraft.evidenceItems.map((item) => ({
      sha256: item.sha256,
      byteLength: item.byteLength,
      label: item.label || undefined,
      category: item.category,
    }));
  }, [detailsDraft.evidenceItems]);

  const cleanWebsite = useMemo(() => trySanitizeProfileUrl(website), [website]);
  const cleanDescription = useMemo(
    () => (description.trim() || publicNote.trim() || undefined),
    [description, publicNote],
  );

  const qrSizing = useMemo(() => {
    return measureUnsignedQrSizing({
      manifestWithoutCrypto: {
        authorName: authorName.trim() || undefined,
        artworkTitle: artworkTitle.trim() || undefined,
        description: cleanDescription,
        website: cleanWebsite,
        snsLinks: sanitizedSnsLinks.length > 0 ? sanitizedSnsLinks : undefined,
        portfolioLinks: sanitizedPortfolioLinks.length > 0 ? sanitizedPortfolioLinks : undefined,
        creationMethod: detailsDraft.creationMethod || undefined,
        creationEnvironment: sanitizedCreationEnv,
        evidenceHashes: evidenceHashes.length > 0 ? evidenceHashes : undefined,
        policyNote: policyNote.trim() || undefined,
        license: {
          licenseId,
          attributionName: attributionName.trim() || undefined,
          commercialUse,
          redistribution,
          aiTraining,
          allowsDerivatives,
          allowsModifications,
          requiresAttribution,
        },
        qrMask:
          qrMode === 'in-image' && clampedStudioOptions
            ? [
                clampedStudioOptions.x,
                clampedStudioOptions.y,
                clampedStudioOptions.boxSize,
                clampedStudioOptions.boxSize,
              ]
            : undefined,
      },
      verifyBaseUrl,
      eccLevel: qrMode === 'in-image' ? eccLevel : 'M',
    });
  }, [
    aiTraining,
    allowsDerivatives,
    allowsModifications,
    artworkTitle,
    attributionName,
    authorName,
    clampedStudioOptions,
    cleanDescription,
    cleanWebsite,
    commercialUse,
    detailsDraft.creationMethod,
    eccLevel,
    evidenceHashes,
    licenseId,
    policyNote,
    qrMode,
    redistribution,
    requiresAttribution,
    sanitizedCreationEnv,
    sanitizedPortfolioLinks,
    sanitizedSnsLinks,
    verifyBaseUrl,
  ]);

  const buildDownloadFilename = (mode: QrCreationMode) => {
    const base = sourceFileName.replace(/\.[^.]+$/, '') || 'artwork';
    return mode === 'in-image'
      ? `${base}.in-image-qr.certified-handmade.png`
      : `${base}.certified-handmade.png`;
  };

  // Profile handlers
  const handleSelectProfile = (id: string) => {
    if (id === 'new') {
      setSelectedProfileId('new');
      setProfileName('');
      setAuthorName('');
      setWebsite('');
      setPublicNote('');
      setSnsLinks([]);
      setPortfolioLinks([]);
      return;
    }
    const found = profiles.find((p) => p.id === id);
    if (found) {
      applyProfileToForm(found);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    try {
      const saved = await saveAuthorProfile({
        id: selectedProfileId !== 'new' ? selectedProfileId : undefined,
        profileName: profileName.trim() || authorName.trim() || 'Default Profile',
        displayName: authorName.trim() || profileName.trim(),
        website: website.trim() || undefined,
        snsLinks,
        portfolioLinks,
        publicNote: publicNote.trim() || undefined,
        defaultLicenseId: licenseId,
        defaultPolicyPresetId: selectedPresetId !== 'custom' ? selectedPresetId : undefined,
        defaultAiTraining: aiTraining,
      });
      const updated = await listAuthorProfiles();
      setProfiles(updated);
      setSelectedProfileId(saved.id);
      setProfileSavedIndicator(true);
      window.setTimeout(() => setProfileSavedIndicator(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save author profile');
    }
  };

  const handleSetDefaultProfile = async () => {
    if (selectedProfileId === 'new') return;
    await setDefaultAuthorProfile(selectedProfileId);
    const updated = await listAuthorProfiles();
    setProfiles(updated);
  };

  const handleDeleteProfile = async () => {
    if (selectedProfileId === 'new') return;
    await deleteAuthorProfile(selectedProfileId);
    const updated = await listAuthorProfiles();
    setProfiles(updated);
    if (updated.length > 0) {
      applyProfileToForm(updated[0]);
    } else {
      handleSelectProfile('new');
    }
  };

  const handleSavePreset = async () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    const saved = await savePolicyPreset({
      name: trimmed,
      licenseId,
      commercialUse,
      redistribution,
      aiTraining,
      allowsDerivatives,
      allowsModifications,
      requiresAttribution,
      customNote: policyNote.trim() || undefined,
    });
    const updated = await ensureDefaultPolicyPresets();
    setPresets(updated);
    setSelectedPresetId(saved.id);
    setNewPresetName('');
    setPresetSavedIndicator(true);
    window.setTimeout(() => setPresetSavedIndicator(false), 2500);
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
      const v3Metadata = {
        protocolVersion: 3 as const,
        description: cleanDescription,
        website: cleanWebsite,
        snsLinks: sanitizedSnsLinks.length > 0 ? sanitizedSnsLinks : undefined,
        portfolioLinks: sanitizedPortfolioLinks.length > 0 ? sanitizedPortfolioLinks : undefined,
        creationMethod: detailsDraft.creationMethod || undefined,
        creationEnvironment: sanitizedCreationEnv,
        evidenceHashes: evidenceHashes.length > 0 ? evidenceHashes : undefined,
        policyNote: policyNote.trim() || undefined,
      };

      const licensePayload = {
        licenseId,
        attributionName: attributionName.trim() || undefined,
        commercialUse,
        redistribution,
        aiTraining,
        allowsDerivatives,
        allowsModifications,
        requiresAttribution,
      };

      let res: UnifiedSignResult;
      if (qrMode === 'in-image' && clampedStudioOptions) {
        const studioRes = await createInImageSignedArtworkPng({
          artworkRaster,
          authorKey: selectedKey,
          passphraseIfEncrypted: keyPassphrase || undefined,
          authorName: authorName.trim() || undefined,
          artworkTitle: artworkTitle.trim() || undefined,
          license: licensePayload,
          ...v3Metadata,
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
          authorName: authorName.trim() || undefined,
          artworkTitle: artworkTitle.trim() || undefined,
          license: licensePayload,
          ...v3Metadata,
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

      // Generate .chmevidence extension when local evidence files are attached
      let nextExtensionState: {
        evidenceBytes: Uint8Array;
        bundle: PortableEvidenceBundle;
        saved: boolean;
      } | null = null;
      if (detailsDraft.evidenceItems.length > 0) {
        const fpHex =
          selectedKey.fingerprintHex ??
          (await computePublicKeyFingerprint(res.manifest.publicKey)).fullHex;
        const detailsInput: EvidenceExtensionDetailsInput = {
          artworkMetadata: {
            title: artworkTitle.trim() || undefined,
            artistName: authorName.trim() || undefined,
            description: cleanDescription,
          },
          creatorProfile: {
            displayName: authorName.trim() || undefined,
            website: cleanWebsite,
            links: [
              ...sanitizedSnsLinks.map((l) => ({
                url: l.url,
                label: l.label || l.platform || undefined,
              })),
              ...sanitizedPortfolioLinks.map((l) => ({
                url: l.url,
                label: l.label || undefined,
              })),
            ],
          },
          creationMethod: detailsDraft.creationMethod || undefined,
          creationEnvironment: sanitizedCreationEnv,
          evidenceRecords: detailsDraft.evidenceItems.map((item) => ({
            sha256: item.sha256,
            byteLength: item.byteLength,
            label: item.label || undefined,
            category: item.category,
            mimeType: item.mimeType || undefined,
          })),
        };
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

      const profileSnapshot = authorName.trim()
        ? buildAuthorProfileSnapshot({
            id: selectedProfileId !== 'new' ? selectedProfileId : undefined,
            displayName: authorName.trim(),
            website: cleanWebsite,
            snsLinks,
            portfolioLinks,
            publicNote: publicNote.trim() || undefined,
          })
        : undefined;

      await saveProofToVault({
        proofInput: res.proofBytes,
        creationMethod: detailsDraft.creationMethod || undefined,
        detailsSnapshot: {
          description: cleanDescription,
          creationMethod: detailsDraft.creationMethod || undefined,
          creationEnvironment: sanitizedCreationEnv,
          policyPresetId: selectedPresetId !== 'custom' ? selectedPresetId : undefined,
          allowsDerivatives,
          allowsModifications,
          requiresAttribution,
          customNote: policyNote.trim() || undefined,
          authorProfileSnapshot: profileSnapshot,
          evidenceHashes:
            evidenceHashes && evidenceHashes.length > 0
              ? evidenceHashes.map((e) => ({
                  sha256Hex: bytesToHex(e.sha256),
                  byteLength: e.byteLength,
                  label: e.label,
                  category: e.category,
                  mimeType: e.mimeType,
                }))
              : undefined,
        },
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
      protocolVersion: signedResult.manifest.version,
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

  const qrTierBadgeClass =
    qrSizing.tier === 'compact'
      ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
      : qrSizing.tier === 'standard'
        ? 'border-sky-400/35 bg-sky-500/15 text-sky-200'
        : qrSizing.tier === 'large'
          ? 'border-amber-400/35 bg-amber-500/15 text-amber-200'
          : 'border-rose-400/45 bg-rose-500/15 text-rose-200';

  const qrTierLabel =
    qrSizing.tier === 'compact'
      ? t.nextGen.create.qrTierCompact
      : qrSizing.tier === 'standard'
        ? t.nextGen.create.qrTierStandard
        : qrSizing.tier === 'large'
          ? t.nextGen.create.qrTierLarge
          : t.nextGen.create.qrTierExceeded;

  const currentProfileIsDefault =
    selectedProfileId !== 'new' &&
    profiles.find((p) => p.id === selectedProfileId)?.isDefault === true;

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
                  alt={artworkTitle || sourceFileName}
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

        {/* Step 2 — Identity, Author Profile & Policy Presets */}
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

          {/* Policy Preset + Primary License Selector */}
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="policyPreset" className="block text-xs font-medium text-slate-300 mb-1">
                  {t.nextGen.create.policyPresetLabel}
                </label>
                <select
                  id="policyPreset"
                  value={selectedPresetId}
                  data-testid="create-policy-preset-select"
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id === 'custom') {
                      setSelectedPresetId('custom');
                    } else {
                      const found = presets.find((p) => p.id === id);
                      if (found) applyPresetToForm(found);
                    }
                  }}
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.licenseId})
                    </option>
                  ))}
                  <option value="custom">{t.nextGen.create.policyPresetCustom}</option>
                </select>
              </div>

              <div>
                <label htmlFor="licenseId" className="block text-xs font-medium text-slate-300 mb-1">
                  {t.create.licenseLabel}
                </label>
                <select
                  id="licenseId"
                  value={licenseId}
                  onChange={(e) => {
                    setLicenseId(e.target.value as LicenseId);
                    setSelectedPresetId('custom');
                  }}
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
            </div>

            <LicenseSummaryCard
              licenseId={licenseId}
              compact
              testId="create-license-summary"
            />
          </div>

          {/* Unified Artwork Identity, Multi-Author Profile & Policy Controls */}
          <AdvancedSettings
            label={t.minimal.create.advancedIdentityLabel}
            testId="create-identity-advanced"
          >
            {/* Multi-Author Profile Selector */}
            <div className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                  <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.nextGen.create.profileSectionTitle}</span>
                  {currentProfileIsDefault && (
                    <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                      {t.nextGen.create.profileDefaultBadge}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="authorProfileSelect" className="block text-xs text-slate-300 mb-1">
                    {t.nextGen.create.profileSelectorLabel}
                  </label>
                  <select
                    id="authorProfileSelect"
                    value={selectedProfileId}
                    data-testid="create-profile-select"
                    onChange={(e) => handleSelectProfile(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs sm:text-sm text-white min-h-[44px]"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.profileName} ({p.displayName})
                        {p.isDefault ? ` ★` : ''}
                      </option>
                    ))}
                    <option value="new">{t.nextGen.create.profileNewOption}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="profileNameInput" className="block text-xs text-slate-300 mb-1">
                    {t.nextGen.create.profileNameLabel}
                  </label>
                  <input
                    id="profileNameInput"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder={t.nextGen.create.profileNamePlaceholder}
                    data-testid="create-profile-name-input"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs sm:text-sm text-white min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="authorName">{t.create.authorLabel}</label>
                    <span className="font-mono text-slate-400">
                      {utf8ByteLength(authorName)} / {MAX_V3_AUTHOR_UTF8_BYTES}
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
                  <label htmlFor="creatorWebsite" className="block text-xs text-slate-300 mb-1">
                    {t.artworkDetails.websiteLabel}
                  </label>
                  <input
                    id="creatorWebsite"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder={t.artworkDetails.websitePlaceholder}
                    data-testid="create-profile-website-input"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="profilePublicNote" className="block text-xs text-slate-300 mb-1">
                  {t.nextGen.create.profilePublicNoteLabel}
                </label>
                <input
                  id="profilePublicNote"
                  type="text"
                  value={publicNote}
                  onChange={(e) => setPublicNote(e.target.value)}
                  placeholder={t.nextGen.create.profilePublicNotePlaceholder}
                  data-testid="create-profile-note-input"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 min-h-[42px]"
                />
              </div>

              {/* SNS Links */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    {t.nextGen.create.profileSnsTitle}
                  </span>
                  {snsLinks.length < MAX_V3_SNS_LINKS && (
                    <button
                      type="button"
                      data-testid="create-add-sns-btn"
                      onClick={() =>
                        setSnsLinks((prev) => [...prev, { platform: 'x', url: '', label: '' }])
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.16] bg-[#020813] px-2.5 py-1.5 text-xs text-sky-200 hover:border-sky-400/40 min-h-[36px] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.nextGen.create.profileAddSnsBtn}</span>
                    </button>
                  )}
                </div>

                {snsLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-[135px_1fr_auto] gap-2 items-center"
                  >
                    <select
                      value={link.platform ?? 'custom'}
                      aria-label="SNS Platform"
                      data-testid={`create-sns-platform-${idx}`}
                      onChange={(e) =>
                        setSnsLinks((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, platform: e.target.value as SnsPlatformId } : row,
                          ),
                        )
                      }
                      className="rounded-lg border border-white/[0.14] bg-[#020813] px-2.5 py-2 text-xs text-white min-h-[40px]"
                    >
                      {SNS_PLATFORM_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="url"
                      value={link.url}
                      data-testid={`create-sns-url-${idx}`}
                      onChange={(e) =>
                        setSnsLinks((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, url: e.target.value } : row)),
                        )
                      }
                      placeholder={
                        SNS_PLATFORM_PRESETS.find((p) => p.id === (link.platform ?? 'custom'))
                          ?.placeholder ?? 'https://'
                      }
                      className="rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[40px]"
                    />
                    <button
                      type="button"
                      onClick={() => setSnsLinks((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={t.artworkDetails.removeBtn}
                      className="inline-flex items-center justify-center rounded-lg border border-white/[0.12] px-2.5 py-2 text-slate-300 hover:border-rose-400/40 hover:text-rose-200 min-h-[40px] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Portfolio Links */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    {t.nextGen.create.profilePortfolioTitle}
                  </span>
                  {portfolioLinks.length < MAX_V3_PORTFOLIO_LINKS && (
                    <button
                      type="button"
                      data-testid="create-add-portfolio-btn"
                      onClick={() =>
                        setPortfolioLinks((prev) => [...prev, { url: '', label: '' }])
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.16] bg-[#020813] px-2.5 py-1.5 text-xs text-sky-200 hover:border-sky-400/40 min-h-[36px] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.nextGen.create.profileAddPortfolioBtn}</span>
                    </button>
                  )}
                </div>

                {portfolioLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2 items-center"
                  >
                    <input
                      type="url"
                      value={link.url}
                      data-testid={`create-portfolio-url-${idx}`}
                      onChange={(e) =>
                        setPortfolioLinks((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, url: e.target.value } : row)),
                        )
                      }
                      placeholder="https://portfolio.example.com"
                      className="rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[40px]"
                    />
                    <input
                      type="text"
                      value={link.label ?? ''}
                      data-testid={`create-portfolio-label-${idx}`}
                      onChange={(e) =>
                        setPortfolioLinks((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, label: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder={t.artworkDetails.linkLabelPlaceholder}
                      className="rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[40px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPortfolioLinks((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label={t.artworkDetails.removeBtn}
                      className="inline-flex items-center justify-center rounded-lg border border-white/[0.12] px-2.5 py-2 text-slate-300 hover:border-rose-400/40 hover:text-rose-200 min-h-[40px] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  data-testid="create-save-profile-btn"
                  onClick={() => void handleSaveProfile()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/35 bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/25 min-h-[38px] cursor-pointer"
                >
                  {profileSavedIndicator && (
                    <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                  )}
                  <span>{t.nextGen.create.profileSaveBtn}</span>
                </button>
                {selectedProfileId !== 'new' && !currentProfileIsDefault && (
                  <button
                    type="button"
                    data-testid="create-set-default-profile-btn"
                    onClick={() => void handleSetDefaultProfile()}
                    className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-xs text-slate-200 hover:border-sky-400/40 min-h-[38px] cursor-pointer"
                  >
                    {t.nextGen.create.profileSetDefaultBtn}
                  </button>
                )}
                {selectedProfileId !== 'new' && (
                  <button
                    type="button"
                    data-testid="create-delete-profile-btn"
                    onClick={() => void handleDeleteProfile()}
                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20 min-h-[38px] cursor-pointer"
                  >
                    {t.nextGen.create.profileDeleteBtn}
                  </button>
                )}
              </div>

              {profileSavedIndicator && (
                <p role="status" className="text-[11px] text-emerald-300">
                  {t.nextGen.create.profileSavedNote}
                </p>
              )}
              {profileError && (
                <p role="alert" className="text-[11px] text-rose-300">
                  {profileError}
                </p>
              )}
              <p className="text-[11px] text-slate-400">{t.nextGen.create.profileSnapshotHint}</p>
            </div>

            {/* Canonical Artwork Title, Description, Attribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <label htmlFor="artworkTitle">{t.create.titleLabel}</label>
                  <span className="font-mono text-slate-400">
                    {utf8ByteLength(artworkTitle)} / {MAX_V3_TITLE_UTF8_BYTES}
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
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="artworkDescription">{t.nextGen.create.descriptionLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(description)} / {MAX_V3_DESCRIPTION_UTF8_BYTES}
                </span>
              </div>
              <textarea
                id="artworkDescription"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.nextGen.create.descriptionPlaceholder}
                data-testid="create-description-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            {/* Extended Policy Signals */}
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
                  onChange={(e) => {
                    setCommercialUse(e.target.value as PolicySignal);
                    setSelectedPresetId('custom');
                  }}
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
                  onChange={(e) => {
                    setRedistribution(e.target.value as PolicySignal);
                    setSelectedPresetId('custom');
                  }}
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
                  onChange={(e) => {
                    setAiTraining(e.target.value as PolicySignal);
                    setSelectedPresetId('custom');
                  }}
                  data-testid="create-ai-select"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                >
                  <option value="disallow">{t.create.policyDisallow}</option>
                  <option value="allow">{t.create.policyAllow}</option>
                  <option value="unspecified">{t.create.policyUnspecified}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="allowsDerivatives"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  {t.nextGen.create.derivativesLabel}
                </label>
                <select
                  id="allowsDerivatives"
                  value={allowsDerivatives}
                  onChange={(e) => {
                    setAllowsDerivatives(e.target.value as PolicySignal);
                    setSelectedPresetId('custom');
                  }}
                  data-testid="create-derivatives-select"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                >
                  <option value="unspecified">{t.create.policyUnspecified}</option>
                  <option value="allow">{t.create.policyAllow}</option>
                  <option value="disallow">{t.create.policyDisallow}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="allowsModifications"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  {t.nextGen.create.modificationsLabel}
                </label>
                <select
                  id="allowsModifications"
                  value={allowsModifications}
                  onChange={(e) => {
                    setAllowsModifications(e.target.value as PolicySignal);
                    setSelectedPresetId('custom');
                  }}
                  data-testid="create-modifications-select"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                >
                  <option value="unspecified">{t.create.policyUnspecified}</option>
                  <option value="allow">{t.create.policyAllow}</option>
                  <option value="disallow">{t.create.policyDisallow}</option>
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={requiresAttribution}
                    onChange={(e) => {
                      setRequiresAttribution(e.target.checked);
                      setSelectedPresetId('custom');
                    }}
                    className="h-4 w-4 rounded accent-sky-300"
                  />
                  <span>{t.nextGen.create.requiresAttributionLabel}</span>
                </label>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <label htmlFor="policyNoteInput">{t.nextGen.create.policyNoteLabel}</label>
                <span className="font-mono text-slate-400">
                  {utf8ByteLength(policyNote)} / {MAX_V3_POLICY_NOTE_UTF8_BYTES}
                </span>
              </div>
              <input
                id="policyNoteInput"
                type="text"
                value={policyNote}
                onChange={(e) => {
                  setPolicyNote(e.target.value);
                  setSelectedPresetId('custom');
                }}
                placeholder={t.nextGen.create.policyNotePlaceholder}
                data-testid="create-policy-note-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[42px]"
              />
            </div>

            {policyWarnings.length > 0 && (
              <div
                role="alert"
                data-testid="create-policy-warnings"
                className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-3 space-y-1.5 text-xs text-amber-100"
              >
                {policyWarnings.map((w) => (
                  <div key={w.code} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{t.nextGen.create.policyWarnings[w.code] ?? w.defaultMessage}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Save as Preset bar */}
            <div className="flex flex-wrap gap-2 pt-1">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t.nextGen.create.savePresetPlaceholder}
                data-testid="create-save-preset-name"
                className="flex-1 min-w-[200px] rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[40px]"
              />
              <button
                type="button"
                disabled={!newPresetName.trim()}
                data-testid="create-save-preset-btn"
                onClick={() => void handleSavePreset()}
                className="rounded-lg border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-500/25 disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                {t.nextGen.create.savePresetBtn}
              </button>
              {presetSavedIndicator && (
                <span className="self-center text-xs text-emerald-300">
                  {t.nextGen.create.presetSavedNote}
                </span>
              )}
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3 flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="h-4 w-4 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.licenses.signalGuideBody}</span>
            </div>
          </AdvancedSettings>

          <ArtworkDetailsPanel draft={detailsDraft} onChange={setDetailsDraft} />
        </section>

        {/* Step 3 — QR Placement & Live Compact Sizing Preview */}
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-white">
              {t.minimal.create.step3Title}
            </h2>
            <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-200">
              {t.nextGen.create.qrV3SelfContainedBadge}
            </span>
          </div>

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

          {/* Live Compact QR Sizing & DEFLATE Compression Readout */}
          <div
            data-testid="create-qr-sizing-card"
            className="rounded-xl border border-white/[0.1] bg-[#030b18]/75 p-3.5 space-y-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">{t.nextGen.create.qrSizingTitle}</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${qrTierBadgeClass}`}>
                  {qrTierLabel}
                </span>
                {qrSizing.qrVersion !== null && (
                  <span className="font-mono text-[11px] text-slate-300">
                    v{qrSizing.qrVersion} ({qrSizing.qrModules}×{qrSizing.qrModules}) · {qrSizing.proofBytesLength} B
                  </span>
                )}
              </div>
            </div>

            {qrSizing.usedDeflate && qrSizing.savingsBytes > 0 && (
              <div className="text-[11px] text-emerald-300">
                {t.nextGen.create.qrSavingsNote}: -{qrSizing.savingsBytes} B (-{qrSizing.savingsPct}%)
              </div>
            )}

            {qrSizing.tier === 'capacity-exceeded' && (
              <p role="alert" className="text-xs text-rose-300">
                {t.nextGen.create.qrExceededHint}
              </p>
            )}

            <details data-testid="create-qr-metrics-details" className="text-[11px] text-slate-400">
              <summary className="cursor-pointer hover:text-slate-200">
                {t.nextGen.create.qrMetricsToggle}
              </summary>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 font-mono">
                <div>
                  <dt className="text-slate-500">{t.nextGen.create.qrUncompressedLabel}</dt>
                  <dd className="text-slate-200">{qrSizing.uncompressedPayloadBytes} B</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t.nextGen.create.qrCompressedLabel}</dt>
                  <dd className="text-emerald-300">{qrSizing.compressedPayloadBytes} B</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t.nextGen.create.qrProofBytesLabel}</dt>
                  <dd className="text-slate-200">{qrSizing.proofBytesLength} B</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t.nextGen.create.qrUrlCharsLabel}</dt>
                  <dd className="text-slate-200">{qrSizing.proofUrlChars} chars</dd>
                </div>
              </dl>
            </details>
          </div>

          {qrMode === 'outer-frame' && artworkPreviewUrl && (
            <div
              data-testid="create-outer-live-preview"
              className={`rounded-xl border p-3 flex flex-col items-center gap-2.5 ${outerFrameColors}`}
            >
              {placement === 'top-right' && (
                <div className="w-full flex justify-end items-center gap-2 text-[11px] font-mono opacity-85">
                  {showLabel && <span>CHM v3 · {licenseId}</span>}
                  <OuterMiniQrCanvas previewUrl={qrSizing.previewUrl} />
                </div>
              )}

              <img
                src={artworkPreviewUrl}
                alt={artworkTitle || sourceFileName}
                className="max-h-52 object-contain rounded border border-white/[0.08]"
              />

              {placement !== 'top-right' && (
                <div
                  className={`w-full flex items-center gap-2 text-[11px] font-mono opacity-85 ${
                    placement === 'bottom-left'
                      ? 'justify-start'
                      : placement === 'bottom-center'
                        ? 'justify-center'
                        : 'justify-end'
                  }`}
                >
                  {showLabel && <span>CHM v3 · {licenseId}</span>}
                  <OuterMiniQrCanvas previewUrl={qrSizing.previewUrl} />
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
                estimatedProofTokenChars={qrSizing.proofUrlChars}
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
            disabled={busy || !artworkRaster || !selectedKey || qrSizing.tier === 'capacity-exceeded'}
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
                  {`(Protocol v${signedResult.manifest.version} · ${signedResult.mode === 'in-image' ? 'In-Image' : 'Outer Frame'})`}
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
