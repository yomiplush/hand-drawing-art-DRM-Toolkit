import React, { useCallback, useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Cpu,
  ExternalLink,
  Eye,
  FileCheck2,
  FileImage,
  HelpCircle,
  Info,
  Link2,
  Loader2,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { ImageDropzone } from '../components/ImageDropzone';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { QrCameraScanner } from '../components/QrCameraScanner';
import { StatusDimensionsGrid } from '../components/StatusBadge';
import { AdvancedSettings } from '../components/ui/AdvancedSettings';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { VerifiedArtworkDetailsCard } from '../components/VerifiedArtworkDetailsCard';
import { base64UrlEncode, bytesToHex } from '../core/crypto/sha256';
import {
  comparePerceptualHashes,
  computePerceptualHashes,
} from '../core/image/perceptualHash';
import type { PerceptualComparisonResult } from '../core/image/perceptualHash';
import { decodeImageFileToCanonicalRgba8 } from '../core/image/pngCodec';
import type { CanonicalRaster } from '../core/image/pngCodec';
import { isLikelyEvidenceExtensionText } from '../core/manifest/evidenceExtension';
import { PROTOCOL_VERSION_COMPACT } from '../core/manifest/types';
import type {
  CreationMethod,
  EvidenceCategory,
  EvidenceVerificationSummary,
  PolicySignal,
  SignedManifest,
  VerificationResult,
} from '../core/manifest/types';
import { SNS_PLATFORM_PRESETS, trySanitizeProfileUrl } from '../core/profiles';
import { addTrustedKey, confirmTrustedKey } from '../core/storage/keyStore';
import {
  matchSuppliedEvidenceRecords,
  verifyEvidenceExtension,
} from '../core/verify/evidenceVerifier';
import type {
  EvidenceRecordsMatchResult,
  SuppliedEvidenceFileInput,
} from '../core/verify/evidenceVerifier';
import { verifyImageWithEmbeddedQr, verifyProofAndArtwork } from '../core/verify/verifier';
import { useI18n } from '../i18n/context';

type InputTab = 'image' | 'camera' | 'proof';

const SHARE_TARGET_CACHE_NAME = 'chm-share-target-v1';
const SHARE_TARGET_CACHE_KEY = '/__shared-artwork__';

function detectUrlProofInput(routerHash: string, routerSearch: string): string | null {
  const hash = routerHash || (typeof window !== 'undefined' ? window.location.hash : '');
  if (hash && hash.includes('proof=')) {
    return hash;
  }
  const search = routerSearch || (typeof window !== 'undefined' ? window.location.search : '');
  if (search && search.includes('proof=')) {
    return search;
  }
  if (typeof window !== 'undefined') {
    const href = window.location.href;
    if (href.includes('%23proof%3D') || href.includes('%23proof=')) {
      return href;
    }
  }
  return null;
}

export function VerifyCertificatePage() {
  const { t } = useI18n();
  const location = useLocation();
  const proofBundleInputId = useId();
  const evidenceFileInputId = useId();
  const localFilesInputId = useId();

  const initialUrlProof = detectUrlProofInput(location.hash, location.search);
  const hasInitialHashProof = Boolean(initialUrlProof);

  const [activeTab, setActiveTab] = useState<InputTab>(() =>
    hasInitialHashProof ? 'proof' : 'image',
  );
  const [launchedWithHashProof, setLaunchedWithHashProof] = useState<boolean>(
    () => hasInitialHashProof,
  );
  const [cameraAutoVerified, setCameraAutoVerified] = useState<boolean>(false);
  const [verifyingProof, setVerifyingProof] = useState<boolean>(() => hasInitialHashProof);
  const [proofInput, setProofInput] = useState(() =>
    hasInitialHashProof ? window.location.href : '',
  );
  const [activeProofRaw, setActiveProofRaw] = useState<string | null>(() => initialUrlProof);
  const [attachedRaster, setAttachedRaster] = useState<CanonicalRaster | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrInfoNote, setQrInfoNote] = useState<string | null>(null);

  const [evidenceInputRaw, setEvidenceInputRaw] = useState<string | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState<string | null>(null);
  const [suppliedEvidenceFiles, setSuppliedEvidenceFiles] = useState<SuppliedEvidenceFileInput[]>(
    [],
  );
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceVerificationSummary | null>(null);
  const [v3EvidenceMatch, setV3EvidenceMatch] = useState<EvidenceRecordsMatchResult | null>(null);
  const [evidenceHashProgress, setEvidenceHashProgress] = useState<string | null>(null);
  const [standaloneEvidenceError, setStandaloneEvidenceError] = useState<string | null>(null);

  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  const [trustLabelInput, setTrustLabelInput] = useState('');
  const [trustConfirmChecked, setTrustConfirmChecked] = useState(false);
  const [trustSavedMsg, setTrustSavedMsg] = useState<string | null>(null);

  const [simComparisonName, setSimComparisonName] = useState<string | null>(null);
  const [simComparisonResult, setSimComparisonResult] =
    useState<PerceptualComparisonResult | null>(null);
  const [simComparisonError, setSimComparisonError] = useState<string | null>(null);

  const runEvidenceVerification = useCallback(
    async (
      nextEvidenceRaw: string | null,
      nextProofBytes: Uint8Array | null | undefined,
      nextManifest: SignedManifest | null | undefined,
      nextSuppliedFiles: SuppliedEvidenceFileInput[],
    ) => {
      const hasRawEvidence = Boolean(nextEvidenceRaw && nextEvidenceRaw.trim());
      const v3Hashes = nextManifest?.evidenceHashes ?? [];

      try {
        if (v3Hashes.length > 0) {
          const v3Match = await matchSuppliedEvidenceRecords({
            records: v3Hashes,
            suppliedEvidenceFiles: nextSuppliedFiles,
            onEvidenceHashProgress: (fileIdx, totalFiles, done, total) => {
              const pct = total > 0 ? Math.round((done / total) * 100) : 100;
              setEvidenceHashProgress(
                `${t.artworkDetails.evidenceHashingBusy} (${fileIdx + 1}/${totalFiles}, ${pct}%)`,
              );
            },
          });
          setV3EvidenceMatch(v3Match);
        } else {
          setV3EvidenceMatch(null);
        }

        if (!hasRawEvidence || !nextEvidenceRaw) {
          setEvidenceSummary(null);
          setStandaloneEvidenceError(null);
          return;
        }
        if (!nextProofBytes || !nextManifest) {
          setEvidenceSummary(null);
          setStandaloneEvidenceError(t.artworkDetails.verifyStandaloneError);
          return;
        }

        setStandaloneEvidenceError(null);
        const summary = await verifyEvidenceExtension({
          evidenceInput: nextEvidenceRaw,
          proofBytes: nextProofBytes,
          manifest: nextManifest,
          suppliedEvidenceFiles: nextSuppliedFiles,
          onEvidenceHashProgress: (fileIdx, totalFiles, done, total) => {
            const pct = total > 0 ? Math.round((done / total) * 100) : 100;
            setEvidenceHashProgress(
              `${t.artworkDetails.evidenceHashingBusy} (${fileIdx + 1}/${totalFiles}, ${pct}%)`,
            );
          },
        });
        setEvidenceSummary(summary);
      } finally {
        setEvidenceHashProgress(null);
      }
    },
    [t.artworkDetails.evidenceHashingBusy, t.artworkDetails.verifyStandaloneError],
  );

  const runProofVerify = useCallback(
    async (rawProof: string, raster: CanonicalRaster | null) => {
      setErrorMsg(null);
      setTrustSavedMsg(null);
      setTrustConfirmChecked(false);
      if (isLikelyEvidenceExtensionText(rawProof)) {
        setResult(null);
        setV3EvidenceMatch(null);
        setActiveProofRaw(null);
        setStandaloneEvidenceError(t.artworkDetails.verifyStandaloneError);
        return;
      }
      setActiveProofRaw(rawProof);
      setVerifyingProof(true);
      try {
        const res = await verifyProofAndArtwork({
          proofInput: rawProof,
          artworkRaster: raster,
        });
        setResult(res);
        await runEvidenceVerification(
          evidenceInputRaw,
          res.proofBytes,
          res.manifest,
          suppliedEvidenceFiles,
        );
      } finally {
        setVerifyingProof(false);
      }
    },
    [
      evidenceInputRaw,
      runEvidenceVerification,
      suppliedEvidenceFiles,
      t.artworkDetails.verifyStandaloneError,
    ],
  );

  // Automatically verify #proof= / ?proof= when QR link opens or URL changes
  useEffect(() => {
    const urlProof = detectUrlProofInput(location.hash, location.search);
    if (!urlProof) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setVerifyingProof(true);
      try {
        const res = await verifyProofAndArtwork({
          proofInput: urlProof,
          artworkRaster: null,
        });
        if (active) {
          setLaunchedWithHashProof(true);
          setCameraAutoVerified(false);
          setActiveTab('proof');
          setProofInput(window.location.href);
          setActiveProofRaw(urlProof);
          setAttachedRaster(null);
          setAttachedFileName(null);
          setQrInfoNote(null);
          setErrorMsg(null);
          setPasteFeedback(null);
          setTrustSavedMsg(null);
          setResult(res);
          await runEvidenceVerification(
            evidenceInputRaw,
            res.proofBytes,
            res.manifest,
            suppliedEvidenceFiles,
          );
        }
      } finally {
        if (active) {
          setVerifyingProof(false);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [
    evidenceInputRaw,
    location.hash,
    location.search,
    runEvidenceVerification,
    suppliedEvidenceFiles,
  ]);

  const handleSignedImageUpload = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      setQrInfoNote(null);
      setPasteFeedback(null);
      setTrustSavedMsg(null);
      setTrustConfirmChecked(false);
      setSimComparisonName(null);
      setSimComparisonResult(null);
      setSimComparisonError(null);
      setLaunchedWithHashProof(false);
      setCameraAutoVerified(false);
      try {
        const rawBytes = new Uint8Array(await file.arrayBuffer());
        const res = await verifyImageWithEmbeddedQr({ fileOrBytes: rawBytes });
        setAttachedRaster(res.raster);
        setAttachedFileName(file.name);
        setActiveProofRaw(res.qrRawText);
        setProofInput(res.qrRawText);
        setQrInfoNote(
          `QR decoded (${res.qrStrategy}) · ${res.imageWidth}×${res.imageHeight} px (${res.sourceFormat})`,
        );
        setResult(res.verification);
        await runEvidenceVerification(
          evidenceInputRaw,
          res.verification.proofBytes,
          res.verification.manifest,
          suppliedEvidenceFiles,
        );
      } catch (err) {
        setResult(null);
        setEvidenceSummary(null);
        setV3EvidenceMatch(null);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to verify image');
      }
    },
    [evidenceInputRaw, runEvidenceVerification, suppliedEvidenceFiles],
  );

  const handleAttachArtworkForProof = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      setPasteFeedback(null);
      try {
        const rawBytes = new Uint8Array(await file.arrayBuffer());
        const { raster } = await decodeImageFileToCanonicalRgba8(rawBytes);
        setAttachedRaster(raster);
        setAttachedFileName(file.name);
        setSimComparisonName(null);
        setSimComparisonResult(null);
        setSimComparisonError(null);
        if (activeProofRaw) {
          await runProofVerify(activeProofRaw, raster);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to decode artwork image');
      }
    },
    [activeProofRaw, runProofVerify],
  );

  const handleEvidenceExtensionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setEvidenceInputRaw(text);
      setEvidenceFileName(file.name);
      await runEvidenceVerification(
        text,
        result?.proofBytes,
        result?.manifest,
        suppliedEvidenceFiles,
      );
    } catch (err) {
      setStandaloneEvidenceError(
        err instanceof Error ? err.message : 'Failed to read .chmevidence file',
      );
    }
  };

  const handleLocalEvidenceFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (picked.length === 0) return;

    const nextFiles: SuppliedEvidenceFileInput[] = picked.map((f) => ({
      name: f.name,
      data: f,
    }));
    setSuppliedEvidenceFiles(nextFiles);
    await runEvidenceVerification(
      evidenceInputRaw,
      result?.proofBytes,
      result?.manifest,
      nextFiles,
    );
  };

  // Consume shared artwork from PWA Web Share Target (?shared=1 via Cache Storage)
  useEffect(() => {
    const params = new URLSearchParams(location.search || window.location.search);
    if (params.get('shared') !== '1') return;
    if (typeof window === 'undefined' || !('caches' in window)) return;

    let active = true;
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(null, '', cleanUrl);

    (async () => {
      try {
        const cache = await window.caches.open(SHARE_TARGET_CACHE_NAME);
        const cached = await cache.match(SHARE_TARGET_CACHE_KEY);
        await cache.delete(SHARE_TARGET_CACHE_KEY);
        if (!cached || !active) return;

        const blob = await cached.blob();
        const rawHeaderName = cached.headers.get('X-Shared-Filename') || 'shared-artwork.png';
        let rawName = rawHeaderName;
        try {
          rawName = decodeURIComponent(rawHeaderName);
        } catch {
          rawName = rawHeaderName;
        }
        const rawBytes = new Uint8Array(await blob.arrayBuffer());
        if (!active) return;

        try {
          const res = await verifyImageWithEmbeddedQr({ fileOrBytes: rawBytes });
          if (!active) return;
          setLaunchedWithHashProof(false);
          setCameraAutoVerified(false);
          setActiveTab('image');
          setAttachedRaster(res.raster);
          setAttachedFileName(rawName);
          setActiveProofRaw(res.qrRawText);
          setProofInput(res.qrRawText);
          setQrInfoNote(
            `${t.verifyMobile.sharedImageVerifiedNote} (${res.qrStrategy}) · ${res.imageWidth}×${res.imageHeight} px`,
          );
          setErrorMsg(null);
          setResult(res.verification);
          await runEvidenceVerification(
            evidenceInputRaw,
            res.verification.proofBytes,
            res.verification.manifest,
            suppliedEvidenceFiles,
          );
        } catch {
          const { raster } = await decodeImageFileToCanonicalRgba8(rawBytes);
          if (!active) return;
          setAttachedRaster(raster);
          setAttachedFileName(rawName);
          setErrorMsg(null);
          const hash = window.location.hash;
          if (hash && hash.includes('proof=')) {
            setActiveTab('proof');
            await runProofVerify(hash, raster);
          } else {
            setQrInfoNote(t.verifyMobile.sharedImageNoQrNote);
          }
        }
      } catch (err) {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load shared image');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    evidenceInputRaw,
    location.search,
    runEvidenceVerification,
    runProofVerify,
    suppliedEvidenceFiles,
    t.verifyMobile.sharedImageNoQrNote,
    t.verifyMobile.sharedImageVerifiedNote,
  ]);

  const processClipboardImageFile = useCallback(
    async (file: File) => {
      if ((activeTab === 'proof' || activeTab === 'camera') && activeProofRaw) {
        await handleAttachArtworkForProof(file);
      } else {
        setActiveTab('image');
        await handleSignedImageUpload(file);
      }
    },
    [activeProofRaw, activeTab, handleAttachArtworkForProof, handleSignedImageUpload],
  );

  // Support Ctrl+V / OS image paste anywhere on /verify
  useEffect(() => {
    const onWindowPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      let imageFile: File | null = null;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            imageFile = item.getAsFile();
            if (imageFile) break;
          }
        }
      }
      if (!imageFile && event.clipboardData?.files?.length) {
        for (let i = 0; i < event.clipboardData.files.length; i++) {
          const f = event.clipboardData.files[i];
          if (f.type.startsWith('image/')) {
            imageFile = f;
            break;
          }
        }
      }
      if (!imageFile) return;
      event.preventDefault();
      void processClipboardImageFile(imageFile);
    };

    window.addEventListener('paste', onWindowPaste);
    return () => {
      window.removeEventListener('paste', onWindowPaste);
    };
  }, [processClipboardImageFile]);

  const handlePasteButtonClick = async () => {
    setPasteFeedback(null);
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      setPasteFeedback(t.verifyMobile.pasteUnsupported);
      return;
    }
    setPasteBusy(true);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
          const file = new File([blob], `clipboard-artwork.${ext}`, { type: imageType });
          await processClipboardImageFile(file);
          return;
        }
      }
      setPasteFeedback(t.verifyMobile.pasteNoImage);
    } catch {
      setPasteFeedback(t.verifyMobile.pasteUnsupported);
    } finally {
      setPasteBusy(false);
    }
  };

  const handleManualProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQrInfoNote(null);
    setCameraAutoVerified(false);
    await runProofVerify(proofInput, attachedRaster);
  };

  const handleProofBundleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (isLikelyEvidenceExtensionText(text)) {
        setEvidenceInputRaw(text);
        setEvidenceFileName(file.name);
        await runEvidenceVerification(
          text,
          result?.proofBytes,
          result?.manifest,
          suppliedEvidenceFiles,
        );
        return;
      }
      setProofInput(text);
      setCameraAutoVerified(false);
      setQrInfoNote(`Loaded proof bundle: ${file.name}`);
      await runProofVerify(text, attachedRaster);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to read proof bundle file');
    }
  };

  const handleCameraDetected = useCallback(
    (rawText: string) => {
      setProofInput(rawText);
      setCameraAutoVerified(true);
      setQrInfoNote(
        attachedRaster ? 'QR detected from local camera stream' : t.verifyMobile.cameraFollowUpHint,
      );
      void runProofVerify(rawText, attachedRaster);
    },
    [attachedRaster, runProofVerify, t.verifyMobile.cameraFollowUpHint],
  );

  const handleTrustThisKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result?.manifest || !trustConfirmChecked) return;
    const pubB64 = base64UrlEncode(result.manifest.publicKey);
    const label =
      trustLabelInput.trim() ||
      result.manifest.authorName ||
      result.publicKeyFingerprintShort ||
      'Artist';
    await addTrustedKey({
      publicKeyInput: pubB64,
      label,
      note: 'Confirmed out-of-band from verification screen',
      verificationState: 'confirmed',
    });
    setTrustLabelInput('');
    setTrustConfirmChecked(false);
    setTrustSavedMsg(label);
    if (activeProofRaw) {
      await runProofVerify(activeProofRaw, attachedRaster);
    }
  };

  const handleSaveUnconfirmedKey = async () => {
    if (!result?.manifest) return;
    const pubB64 = base64UrlEncode(result.manifest.publicKey);
    const label =
      trustLabelInput.trim() ||
      result.manifest.authorName ||
      result.publicKeyFingerprintShort ||
      'Artist';
    await addTrustedKey({
      publicKeyInput: pubB64,
      label,
      note: 'Saved unconfirmed from verification screen',
      verificationState: 'unconfirmed',
    });
    setTrustLabelInput('');
    setTrustConfirmChecked(false);
    if (activeProofRaw) {
      await runProofVerify(activeProofRaw, attachedRaster);
    }
  };

  const handleConfirmUnconfirmedKey = async () => {
    if (!result?.manifest || !trustConfirmChecked) return;
    const pubB64 = base64UrlEncode(result.manifest.publicKey);
    await confirmTrustedKey(pubB64);
    const label =
      result.trustedKeyLabel ||
      result.manifest.authorName ||
      result.publicKeyFingerprintShort ||
      'Artist';
    setTrustConfirmChecked(false);
    setTrustSavedMsg(label);
    if (activeProofRaw) {
      await runProofVerify(activeProofRaw, attachedRaster);
    }
  };

  const handleSimilarityCompareFile = async (file: File) => {
    setSimComparisonError(null);
    if (!attachedRaster) {
      setSimComparisonError(t.hardening.similarity.noBaseline);
      return;
    }
    try {
      const rawBytes = new Uint8Array(await file.arrayBuffer());
      const { raster: candidateRaster } = await decodeImageFileToCanonicalRgba8(rawBytes);
      const refHashes = computePerceptualHashes(attachedRaster);
      const candHashes = computePerceptualHashes(candidateRaster);
      const comparison = comparePerceptualHashes(refHashes, candHashes);
      setSimComparisonName(file.name);
      setSimComparisonResult(comparison);
    } catch (err) {
      setSimComparisonResult(null);
      setSimComparisonError(
        err instanceof Error ? err.message : 'Failed to compare images visually',
      );
    }
  };

  const formatPolicySignal = (signal: PolicySignal) => {
    if (signal === 'allow') return t.create.policyAllow;
    if (signal === 'disallow') return t.create.policyDisallow;
    return t.create.policyUnspecified;
  };

  const formatCreationMethod = (method: CreationMethod): string => {
    switch (method) {
      case 'hand-drawn-no-ai':
        return t.artworkDetails.methodHandDrawnNoAi;
      case 'hand-drawn-ai-assisted':
        return t.artworkDetails.methodHandDrawnAiAssisted;
      case 'ai-generated':
        return t.artworkDetails.methodAiGenerated;
      case 'other':
        return t.artworkDetails.methodOther;
      case 'prefer-not-to-disclose':
        return t.artworkDetails.methodPreferNotToDisclose;
    }
  };

  const formatCategory = (cat?: EvidenceCategory): string => {
    switch (cat) {
      case 'sketch':
        return t.artworkDetails.catSketch;
      case 'wip':
        return t.artworkDetails.catWip;
      case 'intermediate':
        return t.artworkDetails.catIntermediate;
      case 'timelapse':
        return t.artworkDetails.catTimelapse;
      case 'project-file':
        return t.artworkDetails.catProjectFile;
      default:
        return t.artworkDetails.catOther;
    }
  };

  const formatPlatformLabel = (platform?: string): string | undefined => {
    if (!platform) return undefined;
    return SNS_PLATFORM_PRESETS.find((p) => p.id === platform)?.label ?? platform;
  };

  const policyPillTone = (signal: PolicySignal) => {
    if (signal === 'disallow') {
      return 'border-rose-400/35 bg-rose-500/10 text-rose-200';
    }
    if (signal === 'allow') {
      return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200';
    }
    return 'border-white/[0.12] bg-[#030b18]/65 text-slate-300';
  };

  const tabClass = (tab: InputTab) =>
    `inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] cursor-pointer ${
      activeTab === tab
        ? 'bg-white/[0.12] text-white border border-white/[0.22]'
        : 'bg-[#030b18]/65 text-slate-300 border border-white/[0.09] hover:border-white/[0.2]'
    }`;

  const showTopProofStep2Cta =
    Boolean(result?.manifest) && (activeTab === 'proof' || activeTab === 'camera');

  const prioritizeResultsTop = launchedWithHashProof || cameraAutoVerified;
  const canAttachLocalEvidenceFiles = Boolean(
    evidenceInputRaw || (result?.manifest?.evidenceHashes && result.manifest.evidenceHashes.length > 0),
  );

  const manifestV3 = result?.manifest;
  const safeV3Website = trySanitizeProfileUrl(manifestV3?.website);
  const safeV3SnsLinks = (manifestV3?.snsLinks ?? [])
    .map((item) => {
      const safeUrl = trySanitizeProfileUrl(item.url);
      if (!safeUrl) return null;
      return {
        ...item,
        url: safeUrl,
        platformLabel: formatPlatformLabel(item.platform),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const safeV3PortfolioLinks = (manifestV3?.portfolioLinks ?? [])
    .map((item) => {
      const safeUrl = trySanitizeProfileUrl(item.url);
      if (!safeUrl) return null;
      return {
        ...item,
        url: safeUrl,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const hasV3ExtendedPolicy = Boolean(
    manifestV3 &&
      (manifestV3.license.allowsDerivatives !== undefined ||
        manifestV3.license.allowsModifications !== undefined ||
        manifestV3.license.requiresAttribution !== undefined ||
        manifestV3.policyNote),
  );

  const hasV3SelfContainedMetadata = Boolean(
    manifestV3 &&
      manifestV3.version === PROTOCOL_VERSION_COMPACT &&
      (manifestV3.description ||
        safeV3Website ||
        safeV3SnsLinks.length > 0 ||
        safeV3PortfolioLinks.length > 0 ||
        manifestV3.creationMethod !== undefined ||
        manifestV3.creationEnvironment ||
        (manifestV3.evidenceHashes && manifestV3.evidenceHashes.length > 0) ||
        hasV3ExtendedPolicy),
  );

  const proofForm = (
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
      <div className="space-y-1.5">
        <label htmlFor={proofBundleInputId} className="block text-xs font-medium text-slate-300">
          {t.verify.proofBundleUploadLabel}
        </label>
        <input
          id={proofBundleInputId}
          type="file"
          accept=".json,.chproof.json,application/json"
          data-testid="verify-proof-bundle-input"
          onChange={(e) => void handleProofBundleFileChange(e)}
          className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
        />
      </div>
      <button
        type="submit"
        data-testid="verify-proof-submit"
        className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white min-h-[44px] cursor-pointer"
      >
        <span>{t.verify.verifyProofBtn}</span>
      </button>
    </form>
  );

  const optionalExtensionSection = (
    <AdvancedSettings
      label={t.artworkDetails.verifySectionTitle}
      summary={evidenceFileName || t.artworkDetails.verifySectionHint}
      testId="verify-evidence-panel"
    >
      <p className="text-xs text-slate-300 leading-relaxed">{t.artworkDetails.verifySectionHint}</p>

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          id={evidenceFileInputId}
          type="file"
          accept=".chmevidence,.json,application/json"
          data-testid="verify-evidence-file-input"
          onChange={(e) => void handleEvidenceExtensionFileChange(e)}
          className="sr-only"
        />
        <label
          htmlFor={evidenceFileInputId}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-300/35 bg-sky-500/15 px-3.5 py-2 text-xs sm:text-sm font-medium text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
        >
          <FileCheck2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.artworkDetails.verifyAttachEvidenceBtn}</span>
        </label>

        {canAttachLocalEvidenceFiles && (
          <label
            htmlFor={localFilesInputId}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.16] bg-[#030b18]/75 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
          >
            <Upload className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
            <span>{t.artworkDetails.verifyAttachFilesBtn}</span>
          </label>
        )}

        {evidenceInputRaw && (
          <button
            type="button"
            data-testid="verify-clear-evidence-btn"
            onClick={() => {
              setEvidenceInputRaw(null);
              setEvidenceFileName(null);
              setSuppliedEvidenceFiles([]);
              setEvidenceSummary(null);
              setStandaloneEvidenceError(null);
              void runEvidenceVerification(null, result?.proofBytes, result?.manifest, []);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] px-3 py-2 text-xs text-slate-300 hover:border-rose-400/40 hover:text-rose-200 min-h-[44px] cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.artworkDetails.verifyClearEvidenceBtn}</span>
          </button>
        )}

        {suppliedEvidenceFiles.length > 0 && (
          <button
            type="button"
            data-testid="verify-clear-local-files-btn"
            onClick={() => {
              setSuppliedEvidenceFiles([]);
              void runEvidenceVerification(
                evidenceInputRaw,
                result?.proofBytes,
                result?.manifest,
                [],
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] px-3 py-2 text-xs text-slate-300 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
          >
            <span>{t.artworkDetails.verifyClearFilesBtn}</span>
          </button>
        )}
      </div>

      {evidenceFileName && (
        <p className="text-xs font-mono text-sky-300">
          {evidenceFileName}
          {suppliedEvidenceFiles.length > 0
            ? ` · ${suppliedEvidenceFiles.length} file(s)`
            : ''}
        </p>
      )}

      {evidenceHashProgress && (
        <p role="status" className="text-xs font-mono text-sky-300">
          {evidenceHashProgress}
        </p>
      )}
    </AdvancedSettings>
  );

  const inputTabsSection = (
    <section
      data-testid="verify-input-section"
      className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4"
    >
      <div className="flex flex-wrap gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'image'}
          onClick={() => setActiveTab('image')}
          className={tabClass('image')}
        >
          <FileImage className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.minimal.verify.tabImage}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'camera'}
          onClick={() => setActiveTab('camera')}
          className={tabClass('camera')}
        >
          <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.minimal.verify.tabCamera}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'proof'}
          onClick={() => setActiveTab('proof')}
          data-testid="verify-tab-proof"
          className={tabClass('proof')}
        >
          <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.minimal.verify.tabProof}</span>
        </button>
      </div>

      {activeTab === 'image' && (
        <div className="space-y-3">
          <ImageDropzone
            onFileSelected={handleSignedImageUpload}
            title={t.verify.imageDropText}
            subtitle={t.verify.imageDropSub}
            testId="verify-image-input"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pasteBusy}
              onClick={() => void handlePasteButtonClick()}
              data-testid="verify-paste-image-btn"
              className="inline-flex items-center gap-2 rounded-lg border border-sky-300/35 bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-100 hover:bg-sky-500/25 disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{pasteBusy ? t.verifyMobile.pasteBusy : t.verifyMobile.pasteImageBtn}</span>
            </button>
            <span className="text-xs text-slate-400">{t.verifyMobile.pasteHint}</span>
          </div>
          {pasteFeedback && (
            <p role="status" className="text-xs text-amber-200">
              {pasteFeedback}
            </p>
          )}
        </div>
      )}

      {activeTab === 'camera' && <QrCameraScanner onDetected={handleCameraDetected} />}

      {activeTab === 'proof' &&
        (launchedWithHashProof ? (
          <details className="group rounded-lg border border-white/[0.1] bg-[#030b18]/55 p-3">
            <summary className="flex items-center justify-between gap-2 cursor-pointer text-xs sm:text-sm font-medium text-slate-200 list-none select-none min-h-[44px]">
              <span>{t.verifyMobile.rawProofToggle}</span>
              <ChevronDown
                className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0"
                aria-hidden="true"
              />
            </summary>
            <div className="pt-3 mt-3 border-t border-white/[0.08]">{proofForm}</div>
          </details>
        ) : (
          proofForm
        ))}

      {qrInfoNote && <p className="text-xs font-mono text-sky-300">{qrInfoNote}</p>}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-sm text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {standaloneEvidenceError && (
        <div
          role="alert"
          data-testid="verify-standalone-evidence-error"
          className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-xs sm:text-sm text-rose-200"
        >
          {standaloneEvidenceError}
        </div>
      )}
    </section>
  );

  const step2ArtworkCtaSection = showTopProofStep2Cta ? (
    <section
      data-testid="verify-proof-artwork-cta"
      className="rounded-xl border border-sky-400/40 bg-sky-500/10 backdrop-blur-md p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-semibold text-white">
          {t.verifyMobile.proofStep2Title}
        </h2>
        {attachedFileName && (
          <span className="rounded-full border border-sky-300/40 bg-sky-400/15 px-3 py-1 text-xs font-mono text-sky-100">
            {t.verifyMobile.attachedReadyBadge}: {attachedFileName}
          </span>
        )}
      </div>
      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
        {t.verifyMobile.proofStep2Desc}
      </p>
      <ImageDropzone
        onFileSelected={handleAttachArtworkForProof}
        title={
          attachedFileName
            ? `${t.verify.attachArtworkBtn} (${attachedFileName})`
            : t.verify.attachArtworkBtn
        }
        testId="verify-attach-artwork-input"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pasteBusy}
          onClick={() => void handlePasteButtonClick()}
          data-testid="verify-paste-image-btn"
          className="inline-flex items-center gap-2 rounded-lg border border-sky-300/40 bg-[#051224]/80 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50 min-h-[44px] cursor-pointer"
        >
          <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{pasteBusy ? t.verifyMobile.pasteBusy : t.verifyMobile.pasteImageBtn}</span>
        </button>
        <span className="text-xs text-slate-300">{t.verifyMobile.pasteHint}</span>
      </div>
      {pasteFeedback && (
        <p role="status" className="text-xs text-amber-200">
          {pasteFeedback}
        </p>
      )}
    </section>
  ) : null;

  const verifyingSpinnerCard =
    verifyingProof && !result ? (
      <div
        role="status"
        data-testid="verify-auto-status-banner"
        className="rounded-xl border border-sky-400/35 bg-sky-500/10 p-4 flex items-center gap-3 text-sm text-sky-100"
      >
        <Loader2 className="h-4 w-4 text-sky-300 animate-spin shrink-0" aria-hidden="true" />
        <span>{t.minimal.verify.verifyingProofLabel}</span>
      </div>
    ) : null;

  const resultsSection = result ? (
    <div className="space-y-5" data-testid="verification-results">
      {prioritizeResultsTop && result.manifest && (
        <div
          data-testid="verify-auto-verified-pill"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-200"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 shrink-0" aria-hidden="true" />
          <span>{t.minimal.verify.autoVerifiedBadge}</span>
          <span className="font-mono text-[11px] text-emerald-100/80">
            · Protocol v{result.manifest.version}
          </span>
        </div>
      )}

      <StatusDimensionsGrid
        signatureStatus={result.signatureStatus}
        integrityStatus={result.integrityStatus}
        identityStatus={result.identityStatus}
        trustedKeyLabel={result.trustedKeyLabel}
        trustedKeyUnconfirmed={result.trustedKeyUnconfirmed}
        matchedMode={result.matchedMode}
      />

      {result.manifest &&
        (result.keyNoticeStatus === 'revocation-notice' ||
          result.keyNoticeStatus === 'rotation-notice') && (
          <div
            role="alert"
            data-testid="verify-key-notice-banner"
            className="rounded-xl border border-amber-400/45 bg-amber-500/15 p-4 space-y-2.5 text-xs sm:text-sm text-amber-100"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-200">
                  {result.keyNoticeStatus === 'revocation-notice'
                    ? t.hardening.notices.localMatchBannerRevoked
                    : t.hardening.notices.localMatchBannerRotated}
                </p>
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  {t.hardening.notices.historicalValidNote}
                </p>
              </div>
            </div>
            {(result.keyNotices ?? []).map((notice) => (
              <div
                key={notice.id}
                className="rounded-lg border border-amber-300/25 bg-[#030b18]/65 p-3 space-y-1 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-amber-200">
                    {notice.noticeType === 'revocation'
                      ? t.hardening.notices.revokeBadge
                      : t.hardening.notices.rotateBadge}
                  </span>
                  <span className="font-mono text-slate-300">
                    {t.hardening.notices.reasons[notice.reason]}
                  </span>
                  {notice.replacementFingerprintShort && (
                    <span className="font-mono text-sky-200">
                      → {notice.replacementFingerprintShort}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-slate-300">
                  {t.hardening.notices.issuedAtLabel}:{' '}
                  {new Date(notice.noticeIssuedAt * 1000).toISOString()}
                </div>
                {notice.note && <p className="text-slate-200 break-words">{notice.note}</p>}
              </div>
            ))}
            <p className="text-[11px] text-amber-200/85 leading-relaxed">
              {t.hardening.notices.compromiseWarning}
            </p>
          </div>
        )}

      {result.manifest &&
        (!result.keyNoticeStatus || result.keyNoticeStatus === 'none-local') && (
          <div
            role="note"
            data-testid="verify-no-local-notice-note"
            className="rounded-xl border border-white/[0.1] bg-[#030b18]/60 p-3 flex items-start gap-2.5 text-xs text-slate-300"
          >
            <Info className="h-4 w-4 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.hardening.notices.noneLocalInfo}</span>
          </div>
        )}

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

      {result.manifest && (
        <section
          data-testid="verify-drm-quick-card"
          className="rounded-xl border border-white/[0.12] bg-[#051224]/75 backdrop-blur-md p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-white">
              {t.minimal.verify.declaredSummaryTitle}
            </h2>
            <span className="rounded-md border border-white/[0.1] bg-[#030b18]/75 px-2.5 py-1 text-xs font-mono text-sky-200">
              v{result.manifest.version} · {result.publicKeyFingerprintShort ?? ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/60 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-400">{t.verify.fields.artworkTitle}</div>
              <div className="font-medium text-white mt-0.5 break-words">
                {result.manifest.artworkTitle || t.verify.fields.none}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/60 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-400">{t.verify.fields.authorName}</div>
              <div className="font-medium text-white mt-0.5 break-words">
                {result.manifest.authorName || t.verify.fields.none}
              </div>
            </div>

            {result.manifest.license.attributionName && (
              <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/60 px-3.5 py-2.5">
                <div className="text-[11px] text-slate-400">{t.verify.fields.attribution}</div>
                <div className="font-medium text-white mt-0.5 break-words">
                  {result.manifest.license.attributionName}
                </div>
              </div>
            )}

            <div
              className={`rounded-lg border border-white/[0.08] bg-[#030b18]/60 px-3.5 py-2.5 ${
                result.manifest.license.attributionName ? '' : 'sm:col-span-2'
              }`}
            >
              <div className="text-[11px] text-slate-400">{t.verify.fields.issuedAt}</div>
              <div className="font-mono text-xs text-slate-200 mt-0.5">
                {new Date(result.manifest.issuedAt * 1000).toLocaleString()}
              </div>
            </div>
          </div>

          <LicenseSummaryCard
            licenseId={result.manifest.license.licenseId}
            compact
            testId="verify-license-summary"
          />

          <div className="space-y-2" data-testid="verify-drm-policy-pills">
            <div className="text-xs font-medium text-slate-400">
              {t.minimal.verify.rightsSignalsLabel}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.commercialUse)}`}
              >
                <div className="opacity-75 text-[11px]">{t.verify.fields.commercial}</div>
                <div className="font-semibold mt-0.5">
                  {formatPolicySignal(result.manifest.license.commercialUse)}
                </div>
              </div>
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.redistribution)}`}
              >
                <div className="opacity-75 text-[11px]">{t.verify.fields.redistribution}</div>
                <div className="font-semibold mt-0.5">
                  {formatPolicySignal(result.manifest.license.redistribution)}
                </div>
              </div>
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.aiTraining)}`}
              >
                <div className="opacity-75 text-[11px]">{t.verify.fields.aiTraining}</div>
                <div className="font-semibold mt-0.5">
                  {formatPolicySignal(result.manifest.license.aiTraining)}
                </div>
              </div>
            </div>

            {hasV3ExtendedPolicy && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {result.manifest.license.allowsDerivatives !== undefined && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.allowsDerivatives)}`}
                  >
                    <div className="opacity-75 text-[11px]">{t.nextGen.verify.v3DerivativesLabel}</div>
                    <div className="font-semibold mt-0.5">
                      {formatPolicySignal(result.manifest.license.allowsDerivatives)}
                    </div>
                  </div>
                )}
                {result.manifest.license.allowsModifications !== undefined && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.allowsModifications)}`}
                  >
                    <div className="opacity-75 text-[11px]">
                      {t.nextGen.verify.v3ModificationsLabel}
                    </div>
                    <div className="font-semibold mt-0.5">
                      {formatPolicySignal(result.manifest.license.allowsModifications)}
                    </div>
                  </div>
                )}
                {result.manifest.license.requiresAttribution !== undefined && (
                  <div className="rounded-lg border border-white/[0.12] bg-[#030b18]/65 px-3 py-2 text-xs text-slate-200">
                    <div className="opacity-75 text-[11px]">
                      {t.nextGen.verify.v3RequiresAttributionLabel}
                    </div>
                    <div className="font-semibold mt-0.5">
                      {result.manifest.license.requiresAttribution
                        ? t.nextGen.verify.v3Yes
                        : t.nextGen.verify.v3No}
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.manifest.policyNote && (
              <div
                data-testid="verify-v3-policy-note"
                className="rounded-lg border border-white/[0.1] bg-[#030b18]/65 px-3 py-2 text-xs text-slate-200"
              >
                <span className="text-[11px] text-slate-400">{t.nextGen.verify.v3PolicyNoteLabel}: </span>
                <span className="break-words">{result.manifest.policyNote}</span>
              </div>
            )}
          </div>

          {result.signatureStatus === 'valid' &&
            result.identityStatus === 'unknown' &&
            result.trustedKeyUnconfirmed && (
              <div
                data-testid="verify-unconfirmed-trust-card"
                className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <ShieldAlert
                    className="h-4 w-4 text-amber-300 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-amber-200">
                      {t.hardening.trust.unconfirmedBadge}
                    </p>
                    <p className="text-slate-200 leading-relaxed">
                      {t.hardening.trust.unconfirmedHelp}
                    </p>
                  </div>
                </div>
                {result.publicKeyFingerprintHex && (
                  <div
                    data-testid="verify-trust-fingerprint-hex"
                    className="rounded-lg border border-white/[0.1] bg-[#030b18]/80 px-3 py-2 font-mono text-[11px] text-sky-200 break-all"
                  >
                    {result.publicKeyFingerprintHex}
                  </div>
                )}
                <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={trustConfirmChecked}
                    onChange={(e) => setTrustConfirmChecked(e.target.checked)}
                    data-testid="verify-trust-confirm-checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-emerald-400 shrink-0"
                  />
                  <span>{t.hardening.trust.confirmCheckbox}</span>
                </label>
                <button
                  type="button"
                  disabled={!trustConfirmChecked}
                  onClick={() => void handleConfirmUnconfirmedKey()}
                  data-testid="verify-confirm-now-btn"
                  className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-45 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
                >
                  {t.hardening.trust.confirmNowBtn}
                </button>
              </div>
            )}

          {result.signatureStatus === 'valid' &&
            result.identityStatus === 'unknown' &&
            !result.trustedKeyUnconfirmed && (
              <form
                onSubmit={handleTrustThisKey}
                className="rounded-xl border border-white/[0.1] bg-[#030b18]/65 p-4 space-y-3"
              >
                <p className="text-xs sm:text-sm font-medium text-slate-200">
                  {t.verify.trustKeyPrompt}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t.hardening.trust.outOfBandNote}
                </p>
                {result.publicKeyFingerprintHex && (
                  <div
                    data-testid="verify-trust-fingerprint-hex"
                    className="rounded-lg border border-white/[0.1] bg-[#030b18] px-3 py-2 font-mono text-[11px] text-sky-200 break-all"
                  >
                    {result.publicKeyFingerprintHex}
                  </div>
                )}
                <input
                  type="text"
                  value={trustLabelInput}
                  onChange={(e) => setTrustLabelInput(e.target.value)}
                  placeholder={t.verify.trustKeyLabelInput}
                  maxLength={64}
                  data-testid="verify-trust-label-input"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18] px-3 py-2 text-sm text-white min-h-[44px]"
                />
                <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={trustConfirmChecked}
                    onChange={(e) => setTrustConfirmChecked(e.target.checked)}
                    data-testid="verify-trust-confirm-checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-emerald-400 shrink-0"
                  />
                  <span>{t.hardening.trust.confirmCheckbox}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={!trustConfirmChecked}
                    data-testid="verify-trust-btn"
                    className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-45 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
                  >
                    {t.verify.trustKeyBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveUnconfirmedKey()}
                    data-testid="verify-trust-unconfirmed-btn"
                    className="rounded-lg border border-white/[0.16] bg-[#030b18]/80 px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
                  >
                    {t.hardening.trust.saveUnconfirmedBtn}
                  </button>
                </div>
              </form>
            )}

          {trustSavedMsg && (
            <p role="status" className="text-xs text-emerald-300">
              {t.verify.trustedAlready} {trustSavedMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Link
              to={`/exchange?inspect=${encodeURIComponent(base64UrlEncode(result.manifest.publicKey))}`}
              data-testid="verify-inspect-exchange-link"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/35 bg-sky-400/10 px-3.5 py-2 text-xs sm:text-sm font-medium text-sky-200 hover:bg-sky-400/20 min-h-[44px]"
            >
              <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t.verify.inspectInExchangeBtn}</span>
            </Link>
          </div>
        </section>
      )}

      {hasV3SelfContainedMetadata && result.manifest && (
        <section
          data-testid="verify-v3-metadata-card"
          className="rounded-xl border border-sky-400/25 bg-[#051224]/75 backdrop-blur-md p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-white">
              {t.nextGen.verify.v3MetadataTitle}
            </h2>
            <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-mono text-sky-200">
              {t.nextGen.create.qrV3SelfContainedBadge}
            </span>
          </div>

          {result.manifest.description && (
            <div
              data-testid="verify-v3-description"
              className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-1.5"
            >
              <div className="text-[11px] text-slate-400">{t.artworkDetails.descriptionLabel}</div>
              <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                {result.manifest.description}
              </p>
            </div>
          )}

          {(safeV3Website || safeV3SnsLinks.length > 0 || safeV3PortfolioLinks.length > 0) && (
            <div
              data-testid="verify-v3-creator-links"
              className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                  <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.groupCreator}</span>
                </span>
                <span className="rounded-full border border-white/[0.12] bg-[#020813]/75 px-2.5 py-0.5 text-[10px] text-slate-300">
                  {t.artworkDetails.verifyProfileSelfDeclared}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t.nextGen.verify.v3ProfileSnapshotNote}
              </p>

              {safeV3Website && (
                <div>
                  <a
                    href={safeV3Website}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="verify-v3-website"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-sky-300 hover:text-sky-200 underline underline-offset-4 break-all"
                  >
                    <span>{safeV3Website}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              )}

              {safeV3SnsLinks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">
                    {t.nextGen.verify.v3SnsLinksLabel}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {safeV3SnsLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#020813]/75 px-3 py-1.5 text-xs text-sky-200 hover:border-sky-400/40 break-all"
                        >
                          <span>
                            {link.platformLabel ? `[${link.platformLabel}] ` : ''}
                            {link.label ? `${link.label}: ${link.url}` : link.url}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {safeV3PortfolioLinks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">
                    {t.nextGen.verify.v3PortfolioLinksLabel}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {safeV3PortfolioLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#020813]/75 px-3 py-1.5 text-xs text-sky-200 hover:border-sky-400/40 break-all"
                        >
                          <span>{link.label ? `${link.label}: ${link.url}` : link.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {(result.manifest.creationMethod !== undefined ||
            result.manifest.creationEnvironment) && (
            <div
              data-testid="verify-v3-creation"
              className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t.artworkDetails.groupCreation}</span>
              </div>

              {result.manifest.creationMethod && (
                <div
                  data-testid="verify-v3-creation-method"
                  className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs sm:text-sm text-sky-100"
                >
                  <span className="font-semibold">
                    {t.artworkDetails.verifyMethodPrefix}{' '}
                    {formatCreationMethod(result.manifest.creationMethod)}{' '}
                    {t.artworkDetails.verifyMethodDeclaredSuffix}
                  </span>
                </div>
              )}

              {result.manifest.creationEnvironment && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {result.manifest.creationEnvironment.software && (
                    <div className="rounded-lg border border-white/[0.08] bg-[#020813]/70 p-2.5">
                      <div className="text-[11px] text-slate-400">
                        {t.artworkDetails.softwareLabel}
                      </div>
                      <div className="text-white mt-0.5 break-words">
                        {result.manifest.creationEnvironment.software}
                      </div>
                    </div>
                  )}
                  {result.manifest.creationEnvironment.hardware && (
                    <div className="rounded-lg border border-white/[0.08] bg-[#020813]/70 p-2.5">
                      <div className="text-[11px] text-slate-400">
                        {t.artworkDetails.hardwareLabel}
                      </div>
                      <div className="text-white mt-0.5 break-words">
                        {result.manifest.creationEnvironment.hardware}
                      </div>
                    </div>
                  )}
                  {result.manifest.creationEnvironment.inputDevice && (
                    <div className="rounded-lg border border-white/[0.08] bg-[#020813]/70 p-2.5">
                      <div className="text-[11px] text-slate-400">
                        {t.artworkDetails.inputDeviceLabel}
                      </div>
                      <div className="text-white mt-0.5 break-words">
                        {result.manifest.creationEnvironment.inputDevice}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.manifest.creationEnvironment?.notes && (
                <div>
                  <div className="text-[11px] text-slate-400">
                    {t.artworkDetails.creationNotesLabel}
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap break-words mt-0.5">
                    {result.manifest.creationEnvironment.notes}
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t.artworkDetails.verifyStatementOnlyNote}
              </p>
            </div>
          )}

          {result.manifest.evidenceHashes && result.manifest.evidenceHashes.length > 0 && (
            <div
              data-testid="verify-v3-evidence-hashes"
              className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                  <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.nextGen.verify.v3EvidenceHashesTitle}</span>
                </span>
                <label
                  htmlFor={localFilesInputId}
                  data-testid="verify-v3-attach-local-files-btn"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/35 bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/25 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.verifyAttachFilesBtn}</span>
                </label>
              </div>

              <ul className="space-y-2">
                {(v3EvidenceMatch?.recordChecks ?? []).map((rec) => (
                  <li
                    key={rec.index}
                    data-testid={`verify-v3-evidence-record-${rec.index}`}
                    className="rounded-lg border border-white/[0.08] bg-[#020813]/75 p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-white break-words">
                        {rec.label || `Evidence #${rec.index + 1}`}
                        <span className="ms-2 rounded bg-white/[0.08] px-2 py-0.5 text-[10px] text-slate-300">
                          {formatCategory(rec.category)}
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          rec.status === 'verified'
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                            : 'border-white/[0.14] bg-white/[0.05] text-slate-300'
                        }`}
                      >
                        {rec.status === 'verified' ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        ) : (
                          <HelpCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {rec.status === 'verified'
                            ? t.artworkDetails.verifyEvidenceStatusVerified
                            : t.artworkDetails.verifyEvidenceStatusUnavailable}
                        </span>
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 break-all">
                      SHA-256: {rec.sha256Hex} · {rec.byteLength.toLocaleString()} bytes
                      {rec.matchedFileName && (
                        <span className="ms-2 text-emerald-300">
                          ({t.artworkDetails.verifyMatchedLocalFile} {rec.matchedFileName})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {v3EvidenceMatch && v3EvidenceMatch.mismatchedSuppliedFiles.length > 0 && !evidenceSummary && (
                <div
                  role="alert"
                  data-testid="verify-v3-evidence-mismatched-files"
                  className="rounded-xl border border-rose-400/40 bg-rose-500/15 p-3 space-y-1.5 text-xs text-rose-100"
                >
                  <div className="flex items-center gap-2 font-semibold text-rose-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t.artworkDetails.verifyEvidenceMismatchTitle}</span>
                  </div>
                  <p>{t.artworkDetails.verifyEvidenceMismatchHint}</p>
                  <ul className="space-y-1 font-mono text-[11px] text-rose-200 break-all">
                    {v3EvidenceMatch.mismatchedSuppliedFiles.map((f, idx) => (
                      <li key={idx}>
                        {f.fileName} ({f.byteLength.toLocaleString()} bytes) · SHA-256:{' '}
                        {f.computedSha256Hex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!evidenceInputRaw && (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t.nextGen.verify.v3NoExtensionNeededNote}
            </p>
          )}
        </section>
      )}

      {evidenceSummary && <VerifiedArtworkDetailsCard summary={evidenceSummary} />}

      {result.manifest?.qrMask && (
        <div
          role="note"
          data-testid="verify-qr-mask-notice"
          className="rounded-xl border border-sky-400/35 bg-sky-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm text-sky-100"
        >
          <Info className="h-5 w-5 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-semibold text-sky-200">{t.verify.qrMaskNoticeTitle}</h2>
            <p className="text-sky-100/90 leading-relaxed">{t.verify.qrMaskNoticeBody}</p>
            <p className="font-mono text-xs text-sky-200">
              qrMask: [{result.manifest.qrMask.join(', ')}]
              {result.qrMaskCoveragePct != null && (
                <span data-testid="verify-qrmask-coverage" className="ms-2">
                  · {t.hardening.qrMaskSafety.coverageLabel}: {result.qrMaskCoveragePct}%
                </span>
              )}
            </p>
            {(result.qrMaskCoverageTier === 'caution' || result.qrMaskCoverageTier === 'high') && (
              <p
                role="alert"
                data-testid="verify-qrmask-warning"
                className={`text-xs font-medium mt-1 ${
                  result.qrMaskCoverageTier === 'high' ? 'text-rose-200' : 'text-amber-200'
                }`}
              >
                {result.qrMaskCoverageTier === 'high'
                  ? t.hardening.qrMaskSafety.warnHigh
                  : t.hardening.qrMaskSafety.warnCaution}
              </p>
            )}
          </div>
        </div>
      )}

      {result.manifest && !showTopProofStep2Cta && (
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/65 backdrop-blur-md p-5 space-y-3">
          <h2 className="text-sm sm:text-base font-semibold text-white">
            {t.verify.attachArtworkTitle}
          </h2>
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

      <p className="text-xs text-slate-400 px-1">{t.verify.trustReminder}</p>

      {attachedRaster && (
        <AdvancedSettings
          label={t.hardening.similarity.sectionTitle}
          testId="verify-similarity-panel"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="verify-similarity-noncrypto-badge"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-200"
              >
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t.hardening.similarity.badgeNonCrypto}</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t.hardening.similarity.subtitle}
            </p>
            <ImageDropzone
              onFileSelected={handleSimilarityCompareFile}
              title={t.hardening.similarity.dropTitle}
              testId="verify-similarity-input"
            />
            {simComparisonError && (
              <p role="alert" className="text-xs text-rose-300">
                {simComparisonError}
              </p>
            )}
            {simComparisonResult && (
              <div
                data-testid="verify-similarity-result"
                className="rounded-xl border border-white/[0.12] bg-[#030b18]/75 p-4 space-y-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sky-200 truncate">{simComparisonName}</span>
                  <span className="rounded bg-white/[0.08] px-2 py-0.5 font-semibold text-slate-100">
                    {simComparisonResult.band === 'high'
                      ? t.hardening.similarity.bandHigh
                      : simComparisonResult.band === 'moderate'
                        ? t.hardening.similarity.bandModerate
                        : t.hardening.similarity.bandLow}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                  <div className="rounded-lg border border-white/[0.08] bg-[#020813]/80 p-2.5">
                    <div className="text-[11px] text-slate-400">
                      {t.hardening.similarity.combinedLabel}
                    </div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {simComparisonResult.combinedSimilarityPct}%
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-[#020813]/80 p-2.5">
                    <div className="text-[11px] text-slate-400">
                      {t.hardening.similarity.dHashLabel}
                    </div>
                    <div className="text-sm text-sky-200 mt-0.5">
                      {simComparisonResult.dHashSimilarityPct}% (d={simComparisonResult.dHashHamming}
                      )
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-[#020813]/80 p-2.5">
                    <div className="text-[11px] text-slate-400">
                      {t.hardening.similarity.pHashLabel}
                    </div>
                    <div className="text-sm text-sky-200 mt-0.5">
                      {simComparisonResult.pHashSimilarityPct}% (d={simComparisonResult.pHashHamming}
                      )
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    data-testid="verify-similarity-clear-btn"
                    onClick={() => {
                      setSimComparisonName(null);
                      setSimComparisonResult(null);
                      setSimComparisonError(null);
                    }}
                    className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-xs text-slate-200 hover:border-white/[0.3] min-h-[36px] cursor-pointer"
                  >
                    {t.hardening.similarity.clearBtn}
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t.hardening.similarity.disclaimer}
            </p>
          </div>
        </AdvancedSettings>
      )}

      {result.manifest && (
        <AdvancedSettings
          label={t.minimal.verify.detailsLabel}
          testId="verify-manifest-details"
        >
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
            {result.manifest.qrMask && (
              <DetailRow
                label={t.qrStudio.maskRegionLabel}
                value={`[${result.manifest.qrMask.join(', ')}]`}
                mono
              />
            )}
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
            {result.manifest.license.allowsDerivatives !== undefined && (
              <DetailRow
                label={t.nextGen.verify.v3DerivativesLabel}
                value={result.manifest.license.allowsDerivatives}
              />
            )}
            {result.manifest.license.allowsModifications !== undefined && (
              <DetailRow
                label={t.nextGen.verify.v3ModificationsLabel}
                value={result.manifest.license.allowsModifications}
              />
            )}
            {result.manifest.license.requiresAttribution !== undefined && (
              <DetailRow
                label={t.nextGen.verify.v3RequiresAttributionLabel}
                value={
                  result.manifest.license.requiresAttribution
                    ? t.nextGen.verify.v3Yes
                    : t.nextGen.verify.v3No
                }
              />
            )}
            {result.manifest.policyNote && (
              <DetailRow
                label={t.nextGen.verify.v3PolicyNoteLabel}
                value={result.manifest.policyNote}
              />
            )}
            {result.manifest.description && (
              <DetailRow
                label={t.artworkDetails.descriptionLabel}
                value={result.manifest.description}
              />
            )}
            {safeV3Website && (
              <DetailRow label={t.artworkDetails.websiteLabel} value={safeV3Website} />
            )}
            {result.manifest.creationMethod && (
              <DetailRow
                label={t.artworkDetails.creationMethodLabel}
                value={formatCreationMethod(result.manifest.creationMethod)}
              />
            )}
          </dl>
        </AdvancedSettings>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            {t.home.ctaVerify}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">{t.minimal.verify.dropHint}</p>
        </div>

        <HelpIconButton
          label={t.minimal.verify.helpLabel}
          title={t.minimal.verify.helpLabel}
          closeLabel={t.minimal.home.closeHelp}
          testId="verify-help-btn"
        >
          <p>{t.minimal.verify.helpBody}</p>
          <p className="text-xs text-slate-400">{t.verify.trustReminder}</p>
        </HelpIconButton>
      </header>

      {canAttachLocalEvidenceFiles && (
        <input
          id={localFilesInputId}
          type="file"
          multiple
          data-testid="verify-local-evidence-files-input"
          onChange={(e) => void handleLocalEvidenceFilesChange(e)}
          className="sr-only"
        />
      )}

      {prioritizeResultsTop ? (
        <>
          {verifyingSpinnerCard}
          {resultsSection}
          {optionalExtensionSection}
          {step2ArtworkCtaSection}
          {inputTabsSection}
        </>
      ) : (
        <>
          {verifyingSpinnerCard}
          {inputTabsSection}
          {optionalExtensionSection}
          {step2ArtworkCtaSection}
          {resultsSection}
        </>
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
