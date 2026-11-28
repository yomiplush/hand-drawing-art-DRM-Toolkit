import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
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
  MessageSquare,
  Plus,
  QrCode,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import {
  ArtworkDetailsPanel,
} from '../components/ArtworkDetailsPanel';
import { createEmptyArtworkDetailsDraft } from '../components/artworkDetailsDraft';
import type { ArtworkDetailsDraft } from '../components/ArtworkDetailsPanel';
import { ImageDropzone } from '../components/ImageDropzone';
import {
  InImageAdvancedControls,
  InImageQrStudioPanel,
} from '../components/InImageQrStudioPanel';
import { HelpTip } from '../components/HelpTip';
import { SafeArtworkImage } from '../components/SafeArtworkImage';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { StampCeremony } from '../components/motion/StampCeremony';
import { useAppPreferences } from '../components/useAppPreferences';
import { AdvancedSettings } from '../components/ui/AdvancedSettings';
import { FriendlyErrorAlert } from '../components/ui/FriendlyErrorAlert';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { ThreeStepIndicator, WorkerProgressBar } from '../components/ui/StepProgressBar';
import { computePublicKeyFingerprint } from '../core/crypto/ed25519';
import { evaluatePassphraseStrength } from '../core/crypto/keyBackup';
import { bytesToHex } from '../core/crypto/sha256';
import { getStoredDiscordBinding } from '../core/discord/identityLink';
import {
  formatDiscordWebhookError,
  loadDiscordSettings,
  sendDiscordProofLog,
} from '../core/discord/webhook';
import { clampInImageQrOptions } from '../core/image/inImageQr';
import type { InImageQrStyle } from '../core/image/inImageQr';
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
  ensureLocalSigningKey,
  listAuthorKeys,
  markAuthorKeyBackedUp,
} from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { saveProofToVault } from '../core/vault';
import {
  assertArtworkSafe,
  assertArtworkSafeAsync,
  formatArtworkSafetyError,
} from '../core/security/artworkSafetyGate';
import { inspectAuthorName } from '../core/security/authorNameGuard';
import {
  buildSourceProjectProofTag,
  formatSourceProjectError,
  type SourceProjectVerificationResult,
  verifySourceProjectFile,
} from '../core/security/sourceProjectVerifier';
import { getNativeProjectAcceptAttr } from '../core/parsers';
import { imageWorkerClient, type WorkerProgressStage } from '../core/workers/imageWorkerClient';
import { useI18n } from '../i18n/context';

const SIMPLE_AUTHOR_NAME_STORAGE_KEY = 'chm_simple_author_name_v1';

function readRememberedAuthorName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SIMPLE_AUTHOR_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveRememberedAuthorName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = name.trim();
    if (trimmed) {
      window.localStorage.setItem(SIMPLE_AUTHOR_NAME_STORAGE_KEY, trimmed);
    }
  } catch {
    // Ignore storage quota/disabled errors
  }
}

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
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
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
      ctx.fillStyle = '#142744';
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
      <span className="inline-flex items-center justify-center rounded border border-current/35 p-1">
        <QrCode className="h-6 w-6" aria-hidden="true" />
      </span>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      data-testid="create-outer-qr-canvas"
      className="h-14 w-14 rounded border ga-border bg-white shrink-0"
    />
  );
}

export function CreateCertificatePage() {
  const { t, locale } = useI18n();
  const { isAdvanced, reducedMotion } = useAppPreferences();
  const [searchParams] = useSearchParams();
  const replaceInputId = useId();
  const resultSectionRef = useRef<HTMLElement | null>(null);

  const urlModeParam = searchParams.get('mode');
  const [prevUrlModeParam, setPrevUrlModeParam] = useState(urlModeParam);
  const [qrMode, setQrModeState] = useState<QrCreationMode>(() =>
    urlModeParam === 'studio' ? 'in-image' : 'outer-frame',
  );

  if (urlModeParam !== prevUrlModeParam) {
    setPrevUrlModeParam(urlModeParam);
    if (urlModeParam === 'studio') {
      setQrModeState('in-image');
    }
  }

  const setQrMode = (nextMode: QrCreationMode) => {
    setQrModeState(nextMode);
    setSignedResult(null);
    setSignedEvidence(null);
    setErrorMsg(null);
  };

  // Keys
  const [keys, setKeys] = useState<AuthorKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [quickPassphrase, setQuickPassphrase] = useState('');
  const [quickPassphraseConfirm, setQuickPassphraseConfirm] = useState('');
  const [quickKeyBusy, setQuickKeyBusy] = useState(false);
  const [quickKeyError, setQuickKeyError] = useState<string | null>(null);
  const [autoKeyCreatedNotice, setAutoKeyCreatedNotice] = useState(false);
  const quickPassphraseStrength = evaluatePassphraseStrength(quickPassphrase);

  // Artwork image
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<string>('');
  const [artworkRaster, setArtworkRaster] = useState<CanonicalRaster | null>(null);
  const [sourceProjectProof, setSourceProjectProof] =
    useState<SourceProjectVerificationResult | null>(null);
  const [sourceProjectFileName, setSourceProjectFileName] = useState<string | null>(null);
  const [sourceProjectError, setSourceProjectError] = useState<string | null>(null);

  // Canonical Artwork Metadata (single source of truth across Simple/Advanced toggles)
  const [artworkTitle, setArtworkTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attributionName, setAttributionName] = useState('');

  // Author Profiles (Multi-Profile)
  const [profiles, setProfiles] = useState<AuthorProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('new');
  const [profileName, setProfileName] = useState('');
  const [authorName, setAuthorName] = useState(() => readRememberedAuthorName());
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
  const [workerProgress, setWorkerProgress] = useState<{
    percent: number;
    stage: WorkerProgressStage;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [signedResult, setSignedResult] = useState<UnifiedSignResult | null>(null);
  const [signedEvidence, setSignedEvidence] = useState<{
    evidenceBytes: Uint8Array;
    bundle: PortableEvidenceBundle;
    saved: boolean;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [stampCeremonyActive, setStampCeremonyActive] = useState(false);
  const [postBackupPassphrase, setPostBackupPassphrase] = useState('');
  const [postBackupPassphraseConfirm, setPostBackupPassphraseConfirm] = useState('');
  const [postBackupBusy, setPostBackupBusy] = useState(false);
  const [postBackupError, setPostBackupError] = useState<string | null>(null);
  const [postBackupSaved, setPostBackupSaved] = useState(false);
  const [discordLogBusy, setDiscordLogBusy] = useState(false);
  const [discordLogSent, setDiscordLogSent] = useState<'manual' | 'auto' | null>(null);
  const [discordLogError, setDiscordLogError] = useState<string | null>(null);
  const [keyLossAlertDismissed, setKeyLossAlertDismissed] = useState(false);
  const lastAutoSentArtworkIdRef = useRef<string | null>(null);

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
    setAllowsDerivatives(preset.allowsDerivatives ?? 'unspecified');
    setAllowsModifications(preset.allowsModifications ?? 'unspecified');
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


  const selectedKey = useMemo(
    () => keys.find((k) => k.id === selectedKeyId) ?? null,
    [keys, selectedKeyId],
  );

  useEffect(() => {
    if (!signedResult) return;
    const artworkIdHex = signedResult.manifest.artworkIdHex;
    if (lastAutoSentArtworkIdRef.current === artworkIdHex) return;
    const settings = loadDiscordSettings();
    if (!settings.webhookUrl || !settings.autoSendOnCertify) return;

    lastAutoSentArtworkIdRef.current = artworkIdHex;
    let active = true;
    const binding = selectedKey
      ? getStoredDiscordBinding(selectedKey.publicKeyBase64Url)
      : null;
    void sendDiscordProofLog(settings.webhookUrl, {
      title: signedResult.manifest.artworkTitle,
      authorName: signedResult.manifest.authorName,
      artworkHashHex: artworkIdHex,
      signedAtIso: new Date().toISOString(),
      fingerprintShort: selectedKey?.fingerprintShort ?? artworkIdHex.slice(0, 12),
      discordHandle: binding?.discordUsername,
    })
      .then(() => {
        if (active) setDiscordLogSent('auto');
      })
      .catch((err) => {
        if (!active) return;
        setDiscordLogError(formatDiscordWebhookError(err, t.discordUx.webhook));
      });
    return () => {
      active = false;
    };
  }, [signedResult, selectedKey, t.discordUx.webhook]);

  const clampedStudioOptions = useMemo(() => {
    if (!artworkRaster || artworkRaster.width < 21 || artworkRaster.height < 21) return null;
    try {
      return clampInImageQrOptions(artworkRaster.width, artworkRaster.height, {
        x: qrX,
        y: qrY,
        boxSize: qrBoxSize,
        opacity: qrOpacityPct / 100,
        style: qrStyle,
        eccLevel,
        quietZoneModules: qrQuietZone,
      });
    } catch {
      return null;
    }
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
    const manualItems: EvidenceHashRecord[] = detailsDraft.evidenceItems.map((item) => ({
      sha256: item.sha256,
      byteLength: item.byteLength,
      label: item.label || undefined,
      category: item.category,
    }));
    // Automatically bind the locally verified working project file (.psd/.clip/etc.) into Protocol v3 evidenceHashes (CBOR key 16)
    if (sourceProjectProof?.sourceFileSha256) {
      const alreadyIncluded = manualItems.some(
        (m) =>
          m.sha256.length === sourceProjectProof.sourceFileSha256.length &&
          m.sha256.every((b, idx) => b === sourceProjectProof.sourceFileSha256[idx]),
      );
      if (!alreadyIncluded) {
        return [
          {
            sha256: sourceProjectProof.sourceFileSha256,
            byteLength: sourceProjectProof.fileSizeBytes,
            label: sourceProjectProof.sanitizedBasename || undefined,
            category: 'project-file',
          },
          ...manualItems,
        ];
      }
    }
    return manualItems;
  }, [detailsDraft.evidenceItems, sourceProjectProof]);

  const cleanWebsite = useMemo(() => trySanitizeProfileUrl(website), [website]);
  const cleanDescription = useMemo(
    () => description.trim() || publicNote.trim() || undefined,
    [description, publicNote],
  );

  const qrSizing = useMemo(() => {
    const regionW = artworkRaster ? artworkRaster.width : 1200;
    const regionH = artworkRaster ? artworkRaster.height : 1200;
    const effectiveRegion: ArtworkRegion = [0, 0, regionW, regionH];
    const validQrMask: ArtworkRegion | undefined =
      qrMode === 'in-image' &&
      artworkRaster &&
      clampedStudioOptions &&
      clampedStudioOptions.x >= 0 &&
      clampedStudioOptions.y >= 0 &&
      clampedStudioOptions.boxSize >= 21 &&
      clampedStudioOptions.x + clampedStudioOptions.boxSize <= regionW &&
      clampedStudioOptions.y + clampedStudioOptions.boxSize <= regionH
        ? [
            clampedStudioOptions.x,
            clampedStudioOptions.y,
            clampedStudioOptions.boxSize,
            clampedStudioOptions.boxSize,
          ]
        : undefined;

    const baseManifest = {
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
      region: effectiveRegion,
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
    };
    const activeEcc = qrMode === 'in-image' ? eccLevel : 'M';

    try {
      return measureUnsignedQrSizing({
        manifestWithoutCrypto: {
          ...baseManifest,
          qrMask: validQrMask,
        },
        verifyBaseUrl,
        eccLevel: activeEcc,
      });
    } catch {
      try {
        return measureUnsignedQrSizing({
          manifestWithoutCrypto: baseManifest,
          verifyBaseUrl,
          eccLevel: activeEcc,
        });
      } catch {
        return {
          uncompressedPayloadBytes: 0,
          compressedPayloadBytes: 0,
          usedDeflate: false,
          proofBytesLength: 0,
          proofUrlChars: 0,
          qrVersion: null,
          qrModules: null,
          eccLevel: activeEcc,
          tier: 'capacity-exceeded' as const,
          savingsBytes: 0,
          savingsPct: 0,
          previewUrl: null,
        };
      }
    }
  }, [
    aiTraining,
    allowsDerivatives,
    allowsModifications,
    artworkRaster,
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
    if (quickPassphrase && quickPassphrase !== quickPassphraseConfirm) {
      setQuickKeyError(
        locale === 'ja' ? '確認用パスフレーズが一致していません' : 'Passphrases do not match',
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
      setQuickPassphraseConfirm('');
      const updated = await listAuthorKeys();
      setKeys(updated);
      setSelectedKeyId(record.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('chm-keys-updated'));
      }
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

  const handlePostSignBackup = async () => {
    setPostBackupError(null);
    if (selectedKey?.encryptedBackup) {
      await handleDownloadSelectedKeyBackup();
      setPostBackupSaved(true);
      return;
    }
    if (postBackupPassphrase.length < 8) {
      setPostBackupError(t.simple.create.backupShortPassError);
      return;
    }
    if (postBackupPassphrase !== postBackupPassphraseConfirm) {
      setPostBackupError(
        locale === 'ja' ? '確認用パスフレーズが一致していません' : 'Passphrases do not match',
      );
      return;
    }
    setPostBackupBusy(true);
    try {
      const { record, encryptedBackup } = await createAuthorKey({
        label: authorName.trim() || selectedKey?.label || 'My Artist Key',
        backupPassphrase: postBackupPassphrase,
      });
      if (encryptedBackup) {
        const safeName =
          encryptedBackup.label.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'artist';
        triggerJsonDownload(
          encryptedBackup,
          `chm-${safeName}-${encryptedBackup.fingerprint.slice(0, 8)}.chkey.json`,
        );
        await markAuthorKeyBackedUp(record.id);
      }
      setPostBackupPassphrase('');
      setPostBackupPassphraseConfirm('');
      const updated = await listAuthorKeys();
      setKeys(updated);
      setSelectedKeyId(record.id);
      setPostBackupSaved(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('chm-keys-updated'));
      }
    } catch (err) {
      setPostBackupError(err instanceof Error ? err.message : 'Failed to create recovery key');
    } finally {
      setPostBackupBusy(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);
    setSignedResult(null);
    setSignedEvidence(null);
    setSourceProjectProof(null);
    setSourceProjectFileName(null);
    setSourceProjectError(null);
    setWorkerProgress({ percent: 15, stage: 'decoding' });
    try {
      const rawFileBytes = new Uint8Array(await file.arrayBuffer());
      const { raster, sourceFormat: fmt } = await imageWorkerClient.decodeImage(
        rawFileBytes,
        (percent, stage) => setWorkerProgress({ percent, stage }),
      );
      await assertArtworkSafeAsync({
        fileName: file.name,
        rawBytes: rawFileBytes,
        raster,
      });
      const minDim = Math.min(raster.width, raster.height);
      const defaultBox = Math.max(
        Math.min(minDim, 180),
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
      const safetyMsg = formatArtworkSafetyError(err, locale === 'ja' ? 'ja' : 'en');
      setErrorMsg(safetyMsg ?? (err instanceof Error ? err.message : 'Failed to decode image'));
    } finally {
      setWorkerProgress(null);
    }
  };

  const handleSourceProjectSelected = async (file: File) => {
    setSourceProjectError(null);
    try {
      const verified = await verifySourceProjectFile(file);
      setSourceProjectProof(verified);
      setSourceProjectFileName(file.name);
    } catch (err) {
      setSourceProjectProof(null);
      setSourceProjectFileName(null);
      const msg = formatSourceProjectError(err, locale === 'ja' ? 'ja' : 'en');
      setSourceProjectError(msg ?? (err instanceof Error ? err.message : 'Source project verification failed'));
    }
  };

  const handleSignAndBurn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!artworkRaster) {
      setErrorMsg('Please select an artwork image first.');
      return;
    }
    if (!sourceProjectProof) {
      setErrorMsg(
        locale === 'ja'
          ? '署名を発行するには、対応する作業データ（.psd / .clip / .procreate / .kra / .sai2）を選択してローカル構造検証を完了してください（作業データ本体は一切保存・送信されません）。'
          : 'Please select the matching working project file (.psd / .clip / .procreate / .kra / .sai2) for local structure verification before signing (the project file is never saved or uploaded).',
      );
      return;
    }

    const authorGuard = inspectAuthorName(authorName);
    if (authorGuard.level === 'block') {
      setErrorMsg(locale === 'ja' ? authorGuard.messageJa : authorGuard.messageEn);
      return;
    }

    try {
      assertArtworkSafe({
        fileName: sourceFileName,
        title: artworkTitle,
        description: cleanDescription,
        policyNote,
        raster: artworkRaster,
      });
    } catch (err) {
      const safetyMsg = formatArtworkSafetyError(err, locale === 'ja' ? 'ja' : 'en');
      setErrorMsg(safetyMsg ?? (err instanceof Error ? err.message : 'Artwork safety check failed'));
      return;
    }

    setBusy(true);
    setWorkerProgress({ percent: 10, stage: 'hashing' });
    try {
      let signingKey = selectedKey;
      // Seamless auto-key generation if artist has not generated a key yet
      if (!signingKey) {
        const hadKeysBefore = keys.length > 0;
        const record =
          quickPassphrase && quickPassphrase.length >= 8
            ? (
                await createAuthorKey({
                  label: authorName.trim() || 'My Artist Key',
                  backupPassphrase: quickPassphrase,
                })
              ).record
            : await ensureLocalSigningKey({
                label: authorName.trim() || 'My Artist Key',
              });
        setQuickPassphrase('');
      setQuickPassphraseConfirm('');
        const updatedKeys = await listAuthorKeys();
        setKeys(updatedKeys);
        setSelectedKeyId(record.id);
        signingKey = updatedKeys.find((k) => k.id === record.id) ?? record;
        if (!hadKeysBefore) {
          setAutoKeyCreatedNotice(true);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('chm-keys-updated'));
        }
      }
      saveRememberedAuthorName(authorName);

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
        tags: [buildSourceProjectProofTag(sourceProjectProof)],
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
        const studioRes = await imageWorkerClient.signArtworkInImage(
          {
            artworkRaster,
            authorKey: signingKey,
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
          },
          (percent, stage) => setWorkerProgress({ percent, stage }),
        );
        res = { ...studioRes, mode: 'in-image' };
      } else {
        const marginRes = await imageWorkerClient.signArtworkFrame(
          {
            artworkRaster,
            authorKey: signingKey,
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
          },
          (percent, stage) => setWorkerProgress({ percent, stage }),
        );
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
          signingKey.fingerprintHex ??
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
          authorKey: signingKey,
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

      setSignedResult(res);
      setSignedEvidence(nextExtensionState);
      setPostBackupSaved(false);
      setPostBackupError(null);
      const shouldCelebrate = !isAdvanced && !reducedMotion;
      if (shouldCelebrate) {
        setStampCeremonyActive(true);
        window.setTimeout(() => {
          triggerPngDownload(res.pngBytes, buildDownloadFilename(res.mode));
        }, 420);
        window.setTimeout(() => {
          setStampCeremonyActive(false);
        }, 1250);
      } else {
        triggerPngDownload(res.pngBytes, buildDownloadFilename(res.mode));
      }
      window.setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
        });
      }, 60);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setBusy(false);
      setWorkerProgress(null);
    }
  };

  const handleDownloadSignedPng = () => {
    if (!signedResult) return;
    triggerPngDownload(signedResult.pngBytes, buildDownloadFilename(signedResult.mode));
  };

  const handleShareSignedPng = async () => {
    if (!signedResult || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return;
    }
    try {
      const pngCopy = new Uint8Array(signedResult.pngBytes.byteLength);
      pngCopy.set(signedResult.pngBytes);
      const file = new File([pngCopy.buffer], buildDownloadFilename(signedResult.mode), {
        type: 'image/png',
      });
      if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
        return;
      }
      await navigator.share({
        title: artworkTitle.trim() || 'Certified Handmade Artwork',
        text: signedResult.proofUrl,
        files: [file],
      });
    } catch {
      // User dismissed share sheet — ignore gently
    }
  };

  const canShareFiles = useMemo(() => {
    if (
      !signedResult ||
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function' ||
      typeof File === 'undefined'
    ) {
      return false;
    }
    try {
      const testFile = new File([new Uint8Array([137, 80, 78, 71])], 'test.png', {
        type: 'image/png',
      });
      return !navigator.canShare || navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  }, [signedResult]);

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

  const handleStartAnother = () => {
    setArtworkRaster(null);
    setSourceFileName('');
    setSourceFormat('');
    setSignedResult(null);
    setSignedEvidence(null);
    setErrorMsg(null);
  };

  const localVerifyRoute = signedResult
    ? `/verify#proof=${signedResult.proofUrl.split('#proof=')[1] ?? ''}`
    : '/verify';

  const outerFrameColors =
    theme === 'pure-white'
      ? 'bg-white text-slate-900 border-[var(--ga-border-strong)]'
      : theme === 'transparent-margin'
        ? 'ga-surface-subtle ga-text border-dashed ga-border-strong'
        : 'bg-[#142744] text-white border-[#3D73C5]/40';

  const qrTierBadgeClass =
    qrSizing.tier === 'compact'
      ? 'ga-status-success'
      : qrSizing.tier === 'standard'
        ? 'ga-status-info'
        : qrSizing.tier === 'large'
          ? 'ga-status-warning'
          : 'ga-status-error';

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

  const activeStep: 1 | 2 | 3 = !artworkRaster ? 1 : signedResult ? 3 : 2;

  const progressStageLabel = workerProgress
    ? workerProgress.stage === 'decoding'
      ? t.humanUx.createUx.progressStages.decoding
      : workerProgress.stage === 'hashing'
        ? t.humanUx.createUx.progressStages.hashing
        : workerProgress.stage === 'signing'
          ? t.humanUx.createUx.progressStages.signing
          : (workerProgress.stage === 'encoding-png' || workerProgress.stage === 'embedding-qr')
            ? t.humanUx.createUx.progressStages.encoding
            : t.humanUx.createUx.progressStages.complete
    : '';

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 border-b ga-border pb-4 min-w-0">
        <div className="space-y-1.5 min-w-0 flex-1 max-w-full">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight ga-text break-words">
            {!isAdvanced ? t.simple.create.pageTitle : t.home.ctaCreate}
          </h1>
          <p className="text-xs sm:text-sm ga-text-secondary break-words">
            {!isAdvanced ? t.simple.create.pageSubtitle : t.humanUx.createUx.step1Subtitle}
          </p>
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border ga-border ga-surface-subtle px-3 py-1 text-[11px] font-medium ga-text-secondary max-w-full min-w-0">
            <span className="min-w-0 break-words">{t.simple.create.localTrustNote}</span>
            <HelpTip
              label={t.simple.home.localOnlyTipLabel}
              text={t.simple.home.localOnlyTipText}
              testId="create-local-tip-btn"
              panelTestId="create-local-tip-panel"
            />
          </div>
        </div>

        <HelpIconButton
          label={t.minimal.create.helpLabel}
          title={t.minimal.create.helpLabel}
          closeLabel={t.minimal.home.closeHelp}
          testId="create-help-btn"
        >
          <p>{t.minimal.create.helpBody}</p>
          <p className="text-xs ga-text-muted">{t.create.timestampNote}</p>
        </HelpIconButton>
      </header>

      <ThreeStepIndicator
        activeStep={activeStep}
        testIdPrefix="create-step-indicator"
        steps={[
          { number: 1, label: t.humanUx.createUx.step1Short },
          { number: 2, label: t.humanUx.createUx.step2Short },
          { number: 3, label: t.humanUx.createUx.step3Short },
        ]}
      />

      <div
        role="note"
        data-testid="create-sns-recompression-note"
        className="ga-status-info rounded-2xl border px-3.5 py-2.5 text-xs leading-relaxed flex items-start gap-2.5 min-w-0"
      >
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-[var(--ga-accent)]" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium ga-text">{t.uxGuidance.snsRecompression.createTitle}</p>
          <p className="ga-text-secondary break-words">{t.uxGuidance.snsRecompression.createBody}</p>
        </div>
      </div>

      <form onSubmit={handleSignAndBurn} className="space-y-6">
        {/* Step 1 — Choose Artwork */}
        <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold ga-text">
              {t.minimal.create.step1Title}
            </h2>
            <span className="text-xs ga-text-muted">{t.humanUx.createUx.noOverwriteNote}</span>
          </div>

          {!artworkRaster ? (
            <ImageDropzone
              onFileSelected={handleFileSelected}
              title={t.create.dropzoneText}
              subtitle={t.minimal.create.step1Hint}
              testId="create-image-input"
            />
          ) : (
            <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border ga-border ga-surface-subtle p-4">
              <div className="flex justify-center ga-card-solid rounded-lg p-2 border ga-border shrink-0">
                <SafeArtworkImage
                  raster={artworkRaster}
                  alt={artworkTitle || sourceFileName}
                  testId="create-uploaded-preview"
                  className="max-h-36 max-w-[180px] object-contain rounded"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-2 text-center sm:text-start">
                <div className="font-medium ga-text truncate">{sourceFileName}</div>
                <div className="font-mono text-xs ga-text-secondary">
                  {artworkRaster.width} × {artworkRaster.height} px · {sourceFormat}
                </div>
                <div className="pt-1">
                  <input
                    id={replaceInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    data-testid="create-image-input"
                    onClick={(e) => {
                      e.currentTarget.value = '';
                    }}
                    onChange={(e) => {
                      const inputEl = e.currentTarget;
                      const file = inputEl.files?.[0];
                      if (file) void handleFileSelected(file);
                      window.setTimeout(() => {
                        if (inputEl && document.contains(inputEl)) {
                          inputEl.value = '';
                        }
                      }, 250);
                    }}
                    className="sr-only"
                  />
                  <label
                    htmlFor={replaceInputId}
                    className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px] cursor-pointer"
                  >
                    <ImagePlus className="h-4 w-4 ga-text-accent" aria-hidden="true" />
                    <span>{t.minimal.create.changeImageBtn}</span>
                  </label>
                </div>
              </div>
            </div>

            <div
              data-testid="source-project-verifier-box"
              className="rounded-xl border ga-border ga-surface-subtle p-3.5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold ga-text">
                  {locale === 'ja'
                    ? '必須: 作業データ構造検証（.psd / .clip / .procreate / .kra / .sai2）'
                    : 'Required: Working Project Structure Verification (.psd / .clip / .procreate / .kra / .sai2)'}
                </div>
                <span className="text-[11px] ga-text-muted">
                  {locale === 'ja'
                    ? '100%ローカル一時検証・完全非保存（Google Drive同期対象外）'
                    : '100% local ephemeral check · Never saved or synced to Google Drive'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="file"
                    accept={getNativeProjectAcceptAttr()}
                    data-testid="create-source-project-input"
                    className="sr-only"
                    onClick={(e) => {
                      e.currentTarget.value = '';
                    }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleSourceProjectSelected(f);
                    }}
                  />
                  <span>
                    {locale === 'ja' ? '作業データを選択して検証' : 'Select Working Project File'}
                  </span>
                </label>
                {sourceProjectProof && (
                  <span
                    data-testid="source-project-verified-badge"
                    className="ga-status-success inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium"
                  >
                    {locale === 'ja'
                      ? `検証済み: ${sourceProjectProof.projectFormat} (${sourceProjectProof.layerCount} レイヤー) · ${sourceProjectFileName ?? ''}`
                      : `Verified: ${sourceProjectProof.projectFormat} (${sourceProjectProof.layerCount} layers) · ${sourceProjectFileName ?? ''}`}
                  </span>
                )}
              </div>
              {sourceProjectError && (
                <p
                  data-testid="source-project-error"
                  className="text-xs text-rose-600 dark:text-rose-400"
                >
                  {sourceProjectError}
                </p>
              )}
            </div>
            </div>
          )}

          {workerProgress && !busy && (
            <WorkerProgressBar
              percent={workerProgress.percent}
              label={progressStageLabel}
              testId="create-decode-progress"
            />
          )}
        </section>

        {/* Step 2 — Review Proof Content & Sign */}
        <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-5 min-w-0">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-semibold ga-text">
              {t.minimal.create.step2Title}
            </h2>
            <p className="text-xs ga-text-secondary">{t.humanUx.createUx.step2Subtitle}</p>
          </div>

          {/* Core Artist & Artwork Fields (always visible & preserved across mode switches) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs ga-text-secondary mb-1">
                <label htmlFor="authorName">{t.humanUx.createUx.artistNameSimpleLabel}</label>
                {isAdvanced && (
                  <span className="font-mono ga-text-muted">
                    {utf8ByteLength(authorName)} / {MAX_V3_AUTHOR_UTF8_BYTES}
                  </span>
                )}
              </div>
              <input
                id="authorName"
                type="text"
                value={authorName}
                onChange={(e) => {
                  const val = e.target.value;
                  setAuthorName(val);
                  saveRememberedAuthorName(val);
                }}
                placeholder={t.humanUx.createUx.artistNameSimplePlaceholder}
                data-testid="create-author-input"
                className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
              />
              <p
                data-testid="create-author-nickname-hint"
                className="mt-1 text-[11px] ga-text-muted"
              >
                {locale === 'ja'
                  ? '※ 本名や学校名ではなく、ニックネーム（ペンネーム）を入れよう'
                  : 'Use a nickname or pen name — not your real name or school name.'}
              </p>
              {(() => {
                const authorGuard = inspectAuthorName(authorName);
                if (authorGuard.level === 'safe') return null;
                return (
                  <p
                    role={authorGuard.level === 'block' ? 'alert' : 'status'}
                    data-testid="create-author-name-guard"
                    className={`mt-1.5 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                      authorGuard.level === 'block'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {locale === 'ja' ? authorGuard.messageJa : authorGuard.messageEn}
                  </p>
                );
              })()}
            </div>

            <div>
              <div className="flex justify-between text-xs ga-text-secondary mb-1">
                <label htmlFor="artworkTitle">{t.humanUx.createUx.artworkTitleSimpleLabel}</label>
                {isAdvanced && (
                  <span className="font-mono ga-text-muted">
                    {utf8ByteLength(artworkTitle)} / {MAX_V3_TITLE_UTF8_BYTES}
                  </span>
                )}
              </div>
              <input
                id="artworkTitle"
                type="text"
                value={artworkTitle}
                onChange={(e) => setArtworkTitle(e.target.value)}
                placeholder={t.humanUx.createUx.artworkTitleSimplePlaceholder}
                data-testid="create-title-input"
                className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>
          </div>

          {/* License Selector & Summary */}
          <div className="space-y-2.5">
            <div className={`grid grid-cols-1 ${isAdvanced ? 'sm:grid-cols-2' : ''} gap-3`}>
              {isAdvanced && (
                <div>
                  <label htmlFor="policyPreset" className="block text-xs font-medium ga-text-secondary mb-1">
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
                    className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                  >
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.licenseId})
                      </option>
                    ))}
                    <option value="custom">{t.nextGen.create.policyPresetCustom}</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="licenseId" className="block text-xs font-medium ga-text-secondary mb-1">
                  {t.humanUx.createUx.licenseSimpleLabel}
                </label>
                <select
                  id="licenseId"
                  value={licenseId}
                  onChange={(e) => {
                    setLicenseId(e.target.value as LicenseId);
                    setSelectedPresetId('custom');
                  }}
                  data-testid="create-license-select"
                  className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
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

          {/* Signing Key Area: effortless auto-create in Simple Mode, full controls in Advanced Mode */}
          {keys.length === 0 ? (
            !isAdvanced ? (
              <div
                data-testid="create-auto-key-info"
                className="ga-status-info rounded-xl border p-3.5 flex items-start gap-2.5 text-xs leading-relaxed"
              >
                <Sparkles className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t.humanUx.createUx.autoKeyNotice}</span>
              </div>
            ) : (
              <div className="ga-surface-subtle rounded-xl border ga-border-strong p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 ga-text-accent shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold ga-text">
                      {t.minimal.create.createSigningKeyBtn}
                    </h3>
                    <p className="text-xs ga-text-secondary leading-relaxed">
                      {t.minimal.create.keyRequiredNote}
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="quickPassphrase"
                    className="block text-xs font-medium ga-text-secondary mb-1"
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
                    className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                  />
                  {quickPassphrase.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <input
                        type="password"
                        value={quickPassphraseConfirm}
                        onChange={(e) => setQuickPassphraseConfirm(e.target.value)}
                        placeholder={
                          locale === 'ja'
                            ? 'パスフレーズ（確認用・もう一度入力）'
                            : 'Confirm passphrase'
                        }
                        data-testid="create-quick-passphrase-confirm"
                        className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                      />
                      {quickPassphraseConfirm.length > 0 &&
                        quickPassphrase !== quickPassphraseConfirm && (
                          <p role="alert" className="text-xs text-[var(--ga-error-text)]">
                            {locale === 'ja'
                              ? 'パスフレーズが一致していません'
                              : 'Passphrases do not match'}
                          </p>
                        )}
                    </div>
                  )}
                  {quickPassphrase.length > 0 && (
                    <div data-testid="create-quick-passphrase-strength" className="mt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="ga-text-secondary">{t.hardening.passphraseStrength.label}</span>
                        <span
                          className={`font-medium px-2 py-0.5 rounded-full ${
                            quickPassphraseStrength.score === 'strong'
                              ? 'ga-status-success'
                              : quickPassphraseStrength.score === 'fair'
                                ? 'ga-status-warning'
                                : 'ga-status-error'
                          }`}
                        >
                          {quickPassphraseStrength.score === 'strong'
                            ? t.hardening.passphraseStrength.strong
                            : quickPassphraseStrength.score === 'fair'
                              ? t.hardening.passphraseStrength.fair
                              : t.hardening.passphraseStrength.tooShort}
                        </span>
                      </div>
                      <p className="text-[11px] ga-text-muted">
                        {t.hardening.passphraseStrength.guidance}
                      </p>
                    </div>
                  )}
                </div>

                {quickKeyError && (
                  <FriendlyErrorAlert
                    error={quickKeyError}
                    onDismiss={() => setQuickKeyError(null)}
                    testId="create-quick-key-error"
                  />
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={quickKeyBusy}
                    onClick={handleQuickCreateKey}
                    data-testid="create-quick-keygen"
                    className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {quickKeyBusy ? t.howTo.quickKeyBusy : t.minimal.create.createSigningKeyBtn}
                    </span>
                  </button>

                  <Link
                    to="/keys"
                    className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px]"
                  >
                    <span>{t.create.goToKeys}</span>
                  </Link>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {isAdvanced ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="signingKey"
                      className="block text-xs font-medium ga-text-secondary mb-1"
                    >
                      {t.create.selectKeyLabel}
                    </label>
                    <select
                      id="signingKey"
                      value={selectedKeyId}
                      onChange={(e) => setSelectedKeyId(e.target.value)}
                      data-testid="create-key-select"
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
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
                        className="block text-xs font-medium ga-text-secondary mb-1"
                      >
                        {t.create.passphrasePrompt}
                      </label>
                      <input
                        id="keyPassphrase"
                        type="password"
                        required
                        value={keyPassphrase}
                        onChange={(e) => setKeyPassphrase(e.target.value)}
                        className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs ga-surface-subtle rounded-xl border ga-border px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-2 ga-text font-medium">
                    <KeyRound className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                    <span>
                      {t.humanUx.createUx.simpleKeyReadyBadge}: {selectedKey?.label} ({selectedKey?.fingerprintShort})
                    </span>
                  </span>
                  {selectedKey?.storageMode === 'noble-encrypted-seed' && (
                    <input
                      id="keyPassphrase"
                      type="password"
                      required
                      value={keyPassphrase}
                      onChange={(e) => setKeyPassphrase(e.target.value)}
                      placeholder={t.create.passphrasePrompt}
                      className="ga-input rounded-lg px-3 py-1.5 text-xs min-h-[40px]"
                    />
                  )}
                </div>
              )}

              {selectedKey && !selectedKey.hasBackupDownloaded && (
                <div
                  role="note"
                  data-testid="create-key-backup-warning"
                  className="ga-status-warning rounded-xl border p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {autoKeyCreatedNotice
                          ? t.humanUx.createUx.autoKeyCreatedNote
                          : t.create.keyNotBackedUpWarning}
                      </p>
                      <p className="opacity-90 leading-relaxed">
                        {selectedKey.encryptedBackup
                          ? t.create.quickBackupReadyBody
                          : t.create.keyNonExtractableNoBackup}
                      </p>
                      <p
                        data-testid="create-key-backup-adult-note"
                        className="opacity-90 leading-relaxed font-medium"
                      >
                        {locale === 'ja'
                          ? '※ ブラウザの履歴を消すと鍵も消えてしまいます。大切な作品を守るため、おとなの人（保護者）と一緒にバックアップを保存しておこう。'
                          : 'Clearing browser history deletes local keys. Save your backup together with a parent or guardian to keep your artworks safe.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 ps-6">
                    {selectedKey.encryptedBackup && (
                      <button
                        type="button"
                        data-testid="create-download-pending-backup"
                        onClick={() => void handleDownloadSelectedKeyBackup()}
                        className="ga-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold min-h-[40px] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.keys.downloadBackupBtn}</span>
                      </button>
                    )}
                    <Link
                      to="/keys"
                      className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium min-h-[40px]"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.create.goToKeys}</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Simple Mode QR Style Selector (Outer Frame vs In-Image) OR Advanced QR Placement & Studio */}
          {!isAdvanced ? (
            <div className="space-y-3 pt-2 border-t ga-border" data-testid="create-simple-qr-style">
              <div className="flex items-center gap-2 text-xs font-semibold ga-text">
                <span>{t.simple.create.qrStyleLabel}</span>
                <HelpTip
                  label={t.simple.create.qrStyleTipLabel}
                  text={t.simple.create.qrStyleTipText}
                  testId="create-qr-style-tip-btn"
                  panelTestId="create-qr-style-tip-panel"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t.simple.create.qrStyleLabel}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={qrMode === 'outer-frame'}
                  onClick={() => setQrMode('outer-frame')}
                  data-testid="create-simple-style-outer"
                  className={`chm-spring-btn text-start rounded-2xl border p-3.5 min-h-[44px] cursor-pointer space-y-1 ${
                    qrMode === 'outer-frame'
                      ? 'ga-surface-subtle ga-border-strong ga-text ring-2 ring-[var(--ga-accent)]/25'
                      : 'ga-card-solid ga-border ga-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
                    <Frame className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                    <span>{t.simple.create.styleOuterTitle}</span>
                  </div>
                  <p className="text-[11px] ga-text-secondary leading-relaxed">
                    {t.simple.create.styleOuterDesc}
                  </p>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={qrMode === 'in-image'}
                  onClick={() => setQrMode('in-image')}
                  data-testid="create-simple-style-inside"
                  className={`chm-spring-btn text-start rounded-2xl border p-3.5 min-h-[44px] cursor-pointer space-y-1 ${
                    qrMode === 'in-image'
                      ? 'ga-surface-subtle ga-border-strong ga-text ring-2 ring-[var(--ga-accent)]/25'
                      : 'ga-card-solid ga-border ga-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
                    <QrCode className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                    <span>{t.simple.create.styleInsideTitle}</span>
                  </div>
                  <p className="text-[11px] ga-text-secondary leading-relaxed">
                    {t.simple.create.styleInsideDesc}
                  </p>
                </button>
              </div>

              {artworkRaster && qrMode === 'outer-frame' && (
                <div
                  data-testid="create-outer-live-preview"
                  className={`rounded-xl border p-3 flex flex-col items-center gap-2.5 min-w-0 max-w-full ${outerFrameColors}`}
                >
                  <SafeArtworkImage
                    raster={artworkRaster}
                    alt={artworkTitle || sourceFileName}
                    className="max-h-48 max-w-full w-auto object-contain rounded border ga-border"
                  />
                  <div className="w-full flex items-center justify-end gap-2 text-[11px] font-mono opacity-85">
                    {showLabel && <span>CHM v3 · {licenseId}</span>}
                    <OuterMiniQrCanvas previewUrl={qrSizing.previewUrl} />
                  </div>
                </div>
              )}

              {artworkRaster && qrMode === 'in-image' && (
                <div
                  data-testid="create-inside-live-preview"
                  className="relative rounded-xl border ga-border ga-surface-subtle p-3 flex justify-center min-w-0 max-w-full"
                >
                  <div className="relative inline-block max-w-full">
                    <SafeArtworkImage
                      raster={artworkRaster}
                      alt={artworkTitle || sourceFileName}
                      className="max-h-48 max-w-full w-auto object-contain rounded border ga-border"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute bottom-2 end-2 rounded-lg bg-white/80 backdrop-blur-xs p-1 border border-slate-300/70 shadow-xs"
                    >
                      <OuterMiniQrCanvas previewUrl={qrSizing.previewUrl} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5 pt-2 border-t ga-border">
              {/* Multi-Author Profile, Extended Metadata & Policies */}
              <AdvancedSettings
                label={t.minimal.create.advancedIdentityLabel}
                testId="create-identity-advanced"
              >
                <div className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold ga-text-accent">
                      <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{t.nextGen.create.profileSectionTitle}</span>
                      {currentProfileIsDefault && (
                        <span className="ga-status-success rounded-full border px-2 py-0.5 text-[10px]">
                          {t.nextGen.create.profileDefaultBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="authorProfileSelect" className="block text-xs ga-text-secondary mb-1">
                        {t.nextGen.create.profileSelectorLabel}
                      </label>
                      <select
                        id="authorProfileSelect"
                        value={selectedProfileId}
                        data-testid="create-profile-select"
                        onChange={(e) => handleSelectProfile(e.target.value)}
                        className="ga-input w-full rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
                      >
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.profileName} ({p.displayName})
                            {p.isDefault ? ' ★' : ''}
                          </option>
                        ))}
                        <option value="new">{t.nextGen.create.profileNewOption}</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="profileNameInput" className="block text-xs ga-text-secondary mb-1">
                        {t.nextGen.create.profileNameLabel}
                      </label>
                      <input
                        id="profileNameInput"
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder={t.nextGen.create.profileNamePlaceholder}
                        data-testid="create-profile-name-input"
                        className="ga-input w-full rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="creatorWebsite" className="block text-xs ga-text-secondary mb-1">
                        {t.artworkDetails.websiteLabel}
                      </label>
                      <input
                        id="creatorWebsite"
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder={t.artworkDetails.websitePlaceholder}
                        data-testid="create-profile-website-input"
                        className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                      />
                    </div>

                    <div>
                      <label htmlFor="profilePublicNote" className="block text-xs ga-text-secondary mb-1">
                        {t.nextGen.create.profilePublicNoteLabel}
                      </label>
                      <input
                        id="profilePublicNote"
                        type="text"
                        value={publicNote}
                        onChange={(e) => setPublicNote(e.target.value)}
                        placeholder={t.nextGen.create.profilePublicNotePlaceholder}
                        data-testid="create-profile-note-input"
                        className="ga-input w-full rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* SNS Links */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium ga-text-secondary">
                        {t.nextGen.create.profileSnsTitle}
                      </span>
                      {snsLinks.length < MAX_V3_SNS_LINKS && (
                        <button
                          type="button"
                          data-testid="create-add-sns-btn"
                          onClick={() =>
                            setSnsLinks((prev) => [...prev, { platform: 'x', url: '', label: '' }])
                          }
                          className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
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
                          className="ga-input rounded-lg px-2.5 py-2 text-xs min-h-[40px]"
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
                          className="ga-input rounded-lg px-3 py-2 text-xs min-h-[40px]"
                        />
                        <button
                          type="button"
                          onClick={() => setSnsLinks((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={t.artworkDetails.removeBtn}
                          className="ga-btn-secondary inline-flex items-center justify-center rounded-lg px-2.5 py-2 min-h-[40px] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Portfolio Links */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium ga-text-secondary">
                        {t.nextGen.create.profilePortfolioTitle}
                      </span>
                      {portfolioLinks.length < MAX_V3_PORTFOLIO_LINKS && (
                        <button
                          type="button"
                          data-testid="create-add-portfolio-btn"
                          onClick={() =>
                            setPortfolioLinks((prev) => [...prev, { url: '', label: '' }])
                          }
                          className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
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
                          className="ga-input rounded-lg px-3 py-2 text-xs min-h-[40px]"
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
                          className="ga-input rounded-lg px-3 py-2 text-xs min-h-[40px]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPortfolioLinks((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={t.artworkDetails.removeBtn}
                          className="ga-btn-secondary inline-flex items-center justify-center rounded-lg px-2.5 py-2 min-h-[40px] cursor-pointer"
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
                      className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium min-h-[38px] cursor-pointer"
                    >
                      {profileSavedIndicator && (
                        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      )}
                      <span>{t.nextGen.create.profileSaveBtn}</span>
                    </button>
                    {selectedProfileId !== 'new' && !currentProfileIsDefault && (
                      <button
                        type="button"
                        data-testid="create-set-default-profile-btn"
                        onClick={() => void handleSetDefaultProfile()}
                        className="ga-btn-secondary rounded-lg px-3 py-1.5 text-xs min-h-[38px] cursor-pointer"
                      >
                        {t.nextGen.create.profileSetDefaultBtn}
                      </button>
                    )}
                    {selectedProfileId !== 'new' && (
                      <button
                        type="button"
                        data-testid="create-delete-profile-btn"
                        onClick={() => void handleDeleteProfile()}
                        className="ga-status-error rounded-lg border px-3 py-1.5 text-xs min-h-[38px] cursor-pointer"
                      >
                        {t.nextGen.create.profileDeleteBtn}
                      </button>
                    )}
                  </div>

                  {profileSavedIndicator && (
                    <p role="status" className="text-[11px] ga-status-success inline-block px-2 py-1 rounded">
                      {t.nextGen.create.profileSavedNote}
                    </p>
                  )}
                  {profileError && (
                    <FriendlyErrorAlert
                      error={profileError}
                      onDismiss={() => setProfileError(null)}
                    />
                  )}
                  <p className="text-[11px] ga-text-muted">{t.nextGen.create.profileSnapshotHint}</p>
                </div>

                {/* Attribution & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs ga-text-secondary mb-1">
                      <label htmlFor="attributionName">{t.create.attributionLabel}</label>
                      <span className="font-mono ga-text-muted">
                        {utf8ByteLength(attributionName)} / {MAX_ATTRIBUTION_UTF8_BYTES}
                      </span>
                    </div>
                    <input
                      id="attributionName"
                      type="text"
                      value={attributionName}
                      onChange={(e) => setAttributionName(e.target.value)}
                      placeholder={t.create.attributionPlaceholder}
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs ga-text-secondary mb-1">
                      <label htmlFor="policyNoteInput">{t.nextGen.create.policyNoteLabel}</label>
                      <span className="font-mono ga-text-muted">
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
                      className="ga-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs ga-text-secondary mb-1">
                    <label htmlFor="artworkDescription">{t.nextGen.create.descriptionLabel}</label>
                    <span className="font-mono ga-text-muted">
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
                    className="ga-input w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                {/* Extended Policy Signals */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="commercialUse"
                      className="block text-xs font-medium ga-text-secondary mb-1"
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
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    >
                      <option value="unspecified">{t.create.policyUnspecified}</option>
                      <option value="allow">{t.create.policyAllow}</option>
                      <option value="disallow">{t.create.policyDisallow}</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="redistribution"
                      className="block text-xs font-medium ga-text-secondary mb-1"
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
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    >
                      <option value="unspecified">{t.create.policyUnspecified}</option>
                      <option value="allow">{t.create.policyAllow}</option>
                      <option value="disallow">{t.create.policyDisallow}</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="aiTraining" className="block text-xs font-medium ga-text-secondary mb-1">
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
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    >
                      <option value="disallow">{t.create.policyDisallow}</option>
                      <option value="allow">{t.create.policyAllow}</option>
                      <option value="unspecified">{t.create.policyUnspecified}</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="allowsDerivatives"
                      className="block text-xs font-medium ga-text-secondary mb-1"
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
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    >
                      <option value="unspecified">{t.create.policyUnspecified}</option>
                      <option value="allow">{t.create.policyAllow}</option>
                      <option value="disallow">{t.create.policyDisallow}</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="allowsModifications"
                      className="block text-xs font-medium ga-text-secondary mb-1"
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
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    >
                      <option value="unspecified">{t.create.policyUnspecified}</option>
                      <option value="allow">{t.create.policyAllow}</option>
                      <option value="disallow">{t.create.policyDisallow}</option>
                    </select>
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="inline-flex items-center gap-2 text-xs ga-text cursor-pointer min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={requiresAttribution}
                        onChange={(e) => {
                          setRequiresAttribution(e.target.checked);
                          setSelectedPresetId('custom');
                        }}
                        className="h-4 w-4 rounded accent-[var(--ga-primary-bg)]"
                      />
                      <span>{t.nextGen.create.requiresAttributionLabel}</span>
                    </label>
                  </div>
                </div>

                {policyWarnings.length > 0 && (
                  <div
                    role="alert"
                    data-testid="create-policy-warnings"
                    className="ga-status-warning rounded-lg border p-3 space-y-1.5 text-xs"
                  >
                    {policyWarnings.map((w) => (
                      <div key={w.code} className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
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
                    className="ga-input w-full sm:w-auto sm:flex-1 min-w-0 rounded-xl px-3 py-2 text-xs min-h-[40px]"
                  />
                  <button
                    type="button"
                    disabled={!newPresetName.trim()}
                    data-testid="create-save-preset-btn"
                    onClick={() => void handleSavePreset()}
                    className="ga-btn-secondary rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 min-h-[40px] cursor-pointer"
                  >
                    {t.nextGen.create.savePresetBtn}
                  </button>
                  {presetSavedIndicator && (
                    <span className="self-center text-xs ga-status-success px-2 py-1 rounded">
                      {t.nextGen.create.presetSavedNote}
                    </span>
                  )}
                </div>

                <div className="ga-surface-subtle rounded-lg border ga-border p-3 flex items-start gap-2.5 text-xs ga-text-secondary">
                  <Info className="h-4 w-4 ga-text-accent shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{t.licenses.signalGuideBody}</span>
                </div>
              </AdvancedSettings>

              <ArtworkDetailsPanel draft={detailsDraft} onChange={setDetailsDraft} />

              {/* QR Mode & Advanced QR Studio */}
              <div className="space-y-4 pt-2 border-t ga-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-semibold ga-text">
                    {t.minimal.create.step3Title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="ga-status-info rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                      {t.nextGen.create.qrV3SelfContainedBadge}
                    </span>
                    <HelpTip
                      label={t.simple.advancedTips.protocolModesLabel}
                      text={t.simple.advancedTips.protocolModesText}
                      testId="create-protocol-tip-btn"
                    />
                  </div>
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
                        ? 'ga-surface-subtle ga-border-strong ga-text'
                        : 'ga-card-solid ga-border ga-text-secondary'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold">
                        <Frame className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                        <span>{t.minimal.create.modeOutsideTitle}</span>
                      </span>
                      <span className="ga-status-info rounded border px-2 py-0.5 text-[10px] font-mono">
                        {t.minimal.create.modeOutsideBadge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs ga-text-secondary leading-relaxed">
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
                        ? 'ga-surface-subtle ga-border-strong ga-text'
                        : 'ga-card-solid ga-border ga-text-secondary'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold">
                        <QrCode className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                        <span>{t.minimal.create.modeInsideTitle}</span>
                      </span>
                      <span className="ga-surface-subtle rounded border ga-border px-2 py-0.5 text-[10px] font-mono ga-text-secondary">
                        {t.minimal.create.modeInsideBadge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs ga-text-secondary leading-relaxed">
                      {t.minimal.create.modeInsideDesc}
                    </p>
                  </button>
                </div>

                {/* Live Compact QR Sizing & DEFLATE Compression Readout */}
                <div
                  data-testid="create-qr-sizing-card"
                  className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold ga-text">{t.nextGen.create.qrSizingTitle}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${qrTierBadgeClass}`}>
                        {qrTierLabel}
                      </span>
                      {qrSizing.qrVersion !== null && (
                        <span className="font-mono text-[11px] ga-text-secondary">
                          v{qrSizing.qrVersion} ({qrSizing.qrModules}×{qrSizing.qrModules}) · {qrSizing.proofBytesLength} B
                        </span>
                      )}
                    </div>
                  </div>

                  {qrSizing.usedDeflate && qrSizing.savingsBytes > 0 && (
                    <div className="text-[11px] ga-status-success inline-block px-2 py-0.5 rounded">
                      {t.nextGen.create.qrSavingsNote}: -{qrSizing.savingsBytes} B (-{qrSizing.savingsPct}%)
                    </div>
                  )}

                  {qrSizing.tier === 'capacity-exceeded' && (
                    <p role="alert" className="text-xs ga-status-error p-2 rounded">
                      {t.nextGen.create.qrExceededHint}
                    </p>
                  )}

                  <details data-testid="create-qr-metrics-details" className="text-[11px] ga-text-muted">
                    <summary className="cursor-pointer hover:underline">
                      {t.nextGen.create.qrMetricsToggle}
                    </summary>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 font-mono">
                      <div>
                        <dt className="ga-text-muted">{t.nextGen.create.qrUncompressedLabel}</dt>
                        <dd className="ga-text">{qrSizing.uncompressedPayloadBytes} B</dd>
                      </div>
                      <div>
                        <dt className="ga-text-muted">{t.nextGen.create.qrCompressedLabel}</dt>
                        <dd className="ga-text-accent">{qrSizing.compressedPayloadBytes} B</dd>
                      </div>
                      <div>
                        <dt className="ga-text-muted">{t.nextGen.create.qrProofBytesLabel}</dt>
                        <dd className="ga-text">{qrSizing.proofBytesLength} B</dd>
                      </div>
                      <div>
                        <dt className="ga-text-muted">{t.nextGen.create.qrUrlCharsLabel}</dt>
                        <dd className="ga-text">{qrSizing.proofUrlChars} chars</dd>
                      </div>
                    </dl>
                  </details>
                </div>

                {qrMode === 'outer-frame' && artworkRaster && (
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

                    <SafeArtworkImage
                      raster={artworkRaster}
                      alt={artworkTitle || sourceFileName}
                      className="max-h-52 max-w-full w-auto object-contain rounded border ga-border"
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
                    <div className="ga-status-info rounded-xl border p-4 text-xs sm:text-sm flex items-center gap-2.5">
                      <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
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
                            className="block text-xs font-medium ga-text-secondary mb-1"
                          >
                            {t.create.placementLabel}
                          </label>
                          <select
                            id="placement"
                            value={placement}
                            onChange={(e) => setPlacement(e.target.value as QrPlacement)}
                            className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                          >
                            <option value="bottom-right">{t.create.placements['bottom-right']}</option>
                            <option value="bottom-left">{t.create.placements['bottom-left']}</option>
                            <option value="bottom-center">{t.create.placements['bottom-center']}</option>
                            <option value="top-right">{t.create.placements['top-right']}</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="theme" className="block text-xs font-medium ga-text-secondary mb-1">
                            {t.create.themeLabel}
                          </label>
                          <select
                            id="theme"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as FrameTheme)}
                            className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
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
                            className="block text-xs font-medium ga-text-secondary mb-1"
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
                            className="w-full accent-[var(--ga-primary-bg)] mt-2"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="moduleScale"
                            className="block text-xs font-medium ga-text-secondary mb-1"
                          >
                            {t.create.moduleScaleLabel}
                          </label>
                          <select
                            id="moduleScale"
                            value={moduleScale}
                            onChange={(e) => setModuleScale(Number(e.target.value))}
                            className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
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
                            className="block text-xs font-medium ga-text-secondary mb-1"
                          >
                            {t.minimal.create.quietZoneLabel}
                          </label>
                          <select
                            id="outerQuietZone"
                            value={outerQuietZone}
                            onChange={(e) => setOuterQuietZone(Number(e.target.value))}
                            data-testid="create-outer-quietzone-select"
                            className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                          >
                            <option value={1}>{t.minimal.create.quietZoneMinimal}</option>
                            <option value={2}>{t.minimal.create.quietZoneCompact}</option>
                            <option value={4}>{t.minimal.create.quietZoneStandard}</option>
                          </select>
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2.5 text-sm ga-text cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={showLabel}
                          onChange={(e) => setShowLabel(e.target.checked)}
                          className="h-4 w-4 rounded accent-[var(--ga-primary-bg)]"
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

                  <div className="pt-2 border-t ga-border">
                    <label
                      htmlFor="verifyBaseUrl"
                      className="block text-xs font-medium ga-text-secondary mb-1"
                    >
                      {t.create.verifyUrlLabel}
                    </label>
                    <input
                      id="verifyBaseUrl"
                      type="url"
                      value={verifyBaseUrl}
                      onChange={(e) => setVerifyBaseUrl(e.target.value)}
                      className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono min-h-[44px]"
                    />
                    <p className="text-[11px] ga-text-muted mt-1">{t.create.verifyUrlHint}</p>
                  </div>
                </AdvancedSettings>
              </div>
            </div>
          )}

          {errorMsg && (
            <FriendlyErrorAlert
              error={errorMsg}
              onDismiss={() => setErrorMsg(null)}
              testId="create-error-alert"
            />
          )}

          {busy && workerProgress && (
            <WorkerProgressBar
              percent={workerProgress.percent}
              label={progressStageLabel || t.humanUx.createUx.progressLabel}
              testId="create-sign-progress"
            />
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={busy || !artworkRaster || qrSizing.tier === 'capacity-exceeded'}
              data-testid="create-sign-button"
              className="chm-spring-btn ga-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl px-7 py-3.5 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed min-h-[50px] cursor-pointer"
            >
              <FileSignature className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                {busy
                  ? !isAdvanced
                    ? t.simple.create.stampingBusy
                    : qrMode === 'in-image'
                      ? t.qrStudio.signingBusy
                      : t.create.signingBusy
                  : !isAdvanced
                    ? t.simple.create.step3Cta
                    : t.minimal.create.signAndDownloadBtn}
              </span>
            </button>
          </div>
        </section>
      </form>

      {/* Step 3 — Save Certified PNG */}
      {signedResult && (
        <section
          ref={resultSectionRef}
          data-testid="create-result-section"
          className="ga-card rounded-2xl border ga-border-strong p-5 space-y-5"
        >
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold ga-text-accent">
              {!isAdvanced ? t.simple.create.celebrationTitle : t.humanUx.createUx.step3SaveTitle}
            </h2>
            <p className="text-xs ga-text-secondary">
              {!isAdvanced ? t.simple.create.celebrationSubtitle : t.humanUx.createUx.step3Subtitle}
            </p>
          </div>

          <div className="relative w-full rounded-xl border ga-border ga-surface-subtle p-3 flex justify-center overflow-hidden">
            <StampCeremony active={stampCeremonyActive}>
              <SafeArtworkImage
                pngBytes={signedResult.pngBytes}
                raster={signedResult.raster}
                alt="Signed artwork with QR code"
                testId="create-signed-preview"
                className="max-h-[380px] max-w-full w-auto object-contain rounded"
              />
            </StampCeremony>
          </div>

          <div className="w-full flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadSignedPng}
              data-testid="download-signed-png"
              className="ga-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t.create.downloadPng}</span>
            </button>

            {canShareFiles && (
              <button
                type="button"
                onClick={() => void handleShareSignedPng()}
                data-testid="share-signed-png"
                className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer"
              >
                <Share2 className="h-4 w-4 shrink-0 ga-text-accent" aria-hidden="true" />
                <span>{t.humanUx.createUx.shareArtworkBtn}</span>
              </button>
            )}

            {signedEvidence && (
              <button
                type="button"
                onClick={handleDownloadEvidenceExtension}
                data-testid="download-evidence-extension"
                className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
              >
                <FileCheck2 className="h-4 w-4 shrink-0 ga-text-accent" aria-hidden="true" />
                <span>{t.artworkDetails.downloadEvidenceBtn}</span>
                {signedEvidence.saved && (
                  <span className="ga-status-success inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
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
              className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer"
            >
              {copiedUrl ? (
                <Check className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{copiedUrl ? t.create.copied : t.create.copyProofUrl}</span>
            </button>

            <Link
              to={localVerifyRoute}
              data-testid="open-local-verify"
              className="chm-spring-btn ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ga-text-accent min-h-[44px]"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{!isAdvanced ? t.simple.create.verifyNowBtn : t.nav.verify}</span>
            </Link>

            {loadDiscordSettings().webhookUrl ? (
              <button
                type="button"
                disabled={discordLogBusy}
                data-testid="send-discord-proof-btn"
                onClick={async () => {
                  const settings = loadDiscordSettings();
                  if (!settings.webhookUrl || !signedResult) return;
                  setDiscordLogBusy(true);
                  setDiscordLogError(null);
                  try {
                    const binding = selectedKey
                      ? getStoredDiscordBinding(selectedKey.publicKeyBase64Url)
                      : null;
                    await sendDiscordProofLog(settings.webhookUrl, {
                      title: signedResult.manifest.artworkTitle,
                      authorName: signedResult.manifest.authorName,
                      artworkHashHex: signedResult.manifest.artworkIdHex,
                      signedAtIso: new Date().toISOString(),
                      fingerprintShort: selectedKey?.fingerprintShort ?? signedResult.manifest.artworkIdHex.slice(0, 12),
                      discordHandle: binding?.discordUsername,
                    });
                    setDiscordLogSent('manual');
                  } catch (err) {
                    setDiscordLogError(formatDiscordWebhookError(err, t.discordUx.webhook));
                  } finally {
                    setDiscordLogBusy(false);
                  }
                }}
                className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer disabled:opacity-50"
              >
                <MessageSquare className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                <span>
                  {discordLogBusy
                    ? t.discordUx.certifyLog.sendingBtn
                    : t.discordUx.certifyLog.sendBtn}
                </span>
              </button>
            ) : (
              <Link
                to="/storage#discord-webhook"
                data-testid="setup-discord-webhook-link"
                className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium min-h-[44px]"
              >
                <MessageSquare className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                <span>{t.discordUx.webhook.configureLinkLabel}</span>
              </Link>
            )}
          </div>

          {discordLogSent && (
            <p
              role="status"
              data-testid="discord-proof-sent-status"
              className="ga-status-success rounded-xl border px-3 py-2 text-xs flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {discordLogSent === 'auto'
                  ? t.discordUx.certifyLog.autoSentBadge
                  : t.discordUx.certifyLog.sentBadge}
              </span>
            </p>
          )}
          {discordLogError && (
            <p
              role="alert"
              data-testid="discord-proof-error"
              className="ga-status-error rounded-xl border px-3 py-2 text-xs"
            >
              {discordLogError}
            </p>
          )}

          {/* First-time key-loss prevention onboarding alert */}
          {!keyLossAlertDismissed && !selectedKey?.hasBackupDownloaded && !postBackupSaved && (
            <div
              role="note"
              data-testid="create-key-loss-onboarding-alert"
              className="ga-status-warning rounded-2xl border p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <h3 className="text-xs sm:text-sm font-bold">
                      {t.discordUx.keyLossAlert.title}
                    </h3>
                    <p className="text-xs leading-relaxed">
                      {t.discordUx.keyLossAlert.body}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setKeyLossAlertDismissed(true)}
                  className="text-xs underline opacity-80 hover:opacity-100 shrink-0 cursor-pointer"
                >
                  {t.discordUx.keyLossAlert.dismissBtn}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 ps-7">
                <Link
                  to="/keys"
                  data-testid="onboarding-backup-keys-link"
                  className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold min-h-[36px]"
                >
                  <KeyRound className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
                  <span>{t.discordUx.keyLossAlert.keysPageLink}</span>
                </Link>
                <Link
                  to="/storage#discord-webhook"
                  data-testid="onboarding-backup-storage-link"
                  className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold min-h-[36px]"
                >
                  <MessageSquare className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
                  <span>{t.discordUx.keyLossAlert.storagePageLink}</span>
                </Link>
              </div>
            </div>
          )}

          {/* Mandatory HelpTip #3: Gentle post-sign .chkey.json backup reminder */}
          {!isAdvanced && (
            <div
              data-testid="create-post-backup-card"
              className="rounded-2xl border ga-border-strong ga-surface-subtle p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold ga-text">
                  <KeyRound className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                  <span>{t.simple.create.backupCardTitle}</span>
                  <HelpTip
                    label={t.simple.create.backupTipLabel}
                    text={t.simple.create.backupTipText}
                    testId="create-backup-tip-btn"
                    panelTestId="create-backup-tip-panel"
                  />
                </div>
                {postBackupSaved && (
                  <span
                    data-testid="create-post-backup-saved"
                    className="ga-status-success inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    <span>{t.simple.create.backupSavedBadge}</span>
                  </span>
                )}
              </div>

              <p
                data-testid="create-post-backup-adult-note"
                className="text-[11px] ga-text-secondary leading-relaxed"
              >
                {locale === 'ja'
                  ? '※ ブラウザの履歴を消すと端末の鍵が消えてしまいます。大切な絵を失わないよう、おとなの人（保護者）と一緒にバックアップを保存しておこう。'
                  : 'Clearing browser history removes local keys. Save a backup together with a parent or guardian so you never lose your artworks.'}
              </p>

              {selectedKey?.encryptedBackup ? (
                <button
                  type="button"
                  data-testid="create-post-backup-btn"
                  onClick={() => void handlePostSignBackup()}
                  className="chm-spring-btn ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold min-h-[44px] cursor-pointer"
                >
                  <Download className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                  <span>{t.simple.create.backupReadyBtn}</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="password"
                      value={postBackupPassphrase}
                      onChange={(e) => setPostBackupPassphrase(e.target.value)}
                      placeholder={t.simple.create.backupPassPlaceholder}
                      data-testid="create-post-backup-pass"
                      className="ga-input flex-1 rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
                    />
                    <input
                      type="password"
                      value={postBackupPassphraseConfirm}
                      onChange={(e) => setPostBackupPassphraseConfirm(e.target.value)}
                      placeholder={
                        locale === 'ja'
                          ? 'パスフレーズ（確認用・もう一度入力）'
                          : 'Confirm passphrase'
                      }
                      data-testid="create-post-backup-pass-confirm"
                      className="ga-input flex-1 rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[44px]"
                    />
                    <button
                      type="button"
                      disabled={
                        postBackupBusy ||
                        (postBackupPassphrase.length > 0 &&
                          postBackupPassphrase !== postBackupPassphraseConfirm)
                      }
                      onClick={() => void handlePostSignBackup()}
                      data-testid="create-post-backup-create-btn"
                      className="chm-spring-btn ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
                    >
                      <Download className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                      <span>{t.simple.create.backupCreateAndSaveBtn}</span>
                    </button>
                  </div>
                  {postBackupPassphraseConfirm.length > 0 &&
                    postBackupPassphrase !== postBackupPassphraseConfirm && (
                      <p role="alert" className="text-xs text-[var(--ga-error-text)]">
                        {locale === 'ja'
                          ? 'パスフレーズが一致していません'
                          : 'Passphrases do not match'}
                      </p>
                    )}
                </div>
              )}

              {postBackupError && (
                <p role="alert" className="text-xs text-[var(--ga-error-text)]">
                  {postBackupError}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t ga-border">
            <button
              type="button"
              data-testid="create-back-to-edit"
              onClick={() => {
                setSignedResult(null);
                setSignedEvidence(null);
              }}
              className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.humanUx.createUx.backToEditBtn}</span>
            </button>

            <button
              type="button"
              data-testid="create-start-another"
              onClick={handleStartAnother}
              className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.humanUx.createUx.startAnotherBtn}</span>
            </button>
          </div>

          {signedEvidence && !signedEvidence.saved && (
            <div
              role="note"
              data-testid="create-evidence-save-reminder"
              className="ga-status-warning rounded-xl border p-3.5 flex items-start gap-2.5 text-xs sm:text-sm"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.artworkDetails.evidenceSaveReminder}</span>
            </div>
          )}

          {!signedResult.qrVerifiedReadable && (
            <div
              role="alert"
              data-testid="create-qr-readability-warn"
              className="ga-status-warning rounded-xl border p-3.5 flex items-start gap-2.5 text-xs sm:text-sm"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.create.qrReadabilityPostWarn}</span>
            </div>
          )}

          {isAdvanced && (
            <AdvancedSettings
              label={t.minimal.create.technicalDetailsLabel}
              testId="create-result-technical"
            >
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleDownloadProofBundle()}
                  data-testid="download-proof-bundle"
                  className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium min-h-[44px] cursor-pointer"
                >
                  <FileJson className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                  <span>{t.create.downloadProofBundle}</span>
                </button>
              </div>

              <dl className="space-y-3 text-xs sm:text-sm">
                <div className="ga-surface-subtle rounded-xl border ga-border p-3">
                  <dt className="text-xs ga-text-muted">{t.create.artworkRegionLabel}</dt>
                  <dd className="font-mono ga-text mt-0.5">
                    [{signedResult.manifest.region.join(', ')}] → Output{' '}
                    {signedResult.raster.width} × {signedResult.raster.height} px{' '}
                    {`(Protocol v${signedResult.manifest.version} · ${signedResult.mode === 'in-image' ? 'In-Image' : 'Outer Frame'})`}
                  </dd>
                </div>

                {signedResult.mode === 'in-image' && (
                  <div className="ga-surface-subtle rounded-xl border ga-border p-3">
                    <dt className="text-xs ga-text-muted">{t.qrStudio.maskRegionLabel}</dt>
                    <dd className="font-mono ga-text-accent mt-0.5">
                      [{signedResult.qrMask.join(', ')}]
                    </dd>
                  </div>
                )}

                <div className="ga-surface-subtle rounded-xl border ga-border p-3">
                  <dt className="flex items-center gap-1.5 text-xs ga-text-muted">
                    <span>{t.create.artworkShaLabel}</span>
                    <HelpTip
                      label={t.simple.advancedTips.canonicalRgbaLabel}
                      text={t.simple.advancedTips.canonicalRgbaText}
                      testId="create-rgba-tip-btn"
                    />
                  </dt>
                  <dd className="font-mono text-xs ga-text-accent break-all mt-0.5">
                    {bytesToHex(signedResult.manifest.sha256)}
                  </dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="ga-surface-subtle rounded-xl border ga-border p-3">
                    <dt className="text-xs ga-text-muted">{t.create.proofSizeLabel}</dt>
                    <dd className="font-mono ga-text mt-0.5" data-testid="create-result-proof-bytes">
                      {signedResult.proofBytes.length} bytes
                    </dd>
                  </div>
                  <div className="ga-surface-subtle rounded-xl border ga-border p-3">
                    <dt className="text-xs ga-text-muted">{t.create.qrVersionLabel}</dt>
                    <dd className="font-mono ga-text mt-0.5" data-testid="create-result-qr-version">
                      v{signedResult.qrVersion} ({signedResult.qrModules}×{signedResult.qrModules})
                    </dd>
                  </div>
                  {signedEvidence && (
                    <div className="ga-surface-subtle rounded-xl border ga-border p-3">
                      <dt className="text-xs ga-text-muted">.chmevidence</dt>
                      <dd
                        className="font-mono ga-text-accent mt-0.5"
                        data-testid="create-result-evidence-bytes"
                      >
                        {signedEvidence.evidenceBytes.length} bytes
                      </dd>
                    </div>
                  )}
                </div>

                {signedEvidence && (
                  <p className="text-[11px] ga-text-muted">{t.artworkDetails.compactQrNote}</p>
                )}
              </dl>
            </AdvancedSettings>
          )}
        </section>
      )}
    </div>
  );
}
