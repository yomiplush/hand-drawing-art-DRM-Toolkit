import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Clock,
  Cpu,
  ExternalLink,
  Eye,
  FileCheck2,
  FileImage,
  HelpCircle,
  History,
  Info,
  Link2,
  Loader2,
  MessageSquare,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { HelpTip } from '../components/HelpTip';
import { SafeArtworkImage } from '../components/SafeArtworkImage';
import { ImageDropzone } from '../components/ImageDropzone';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { ScannerBeam } from '../components/motion/ScannerBeam';
import { SparkleBurst } from '../components/motion/SparkleBurst';
import { useAppPreferences } from '../components/PreferencesContext';
import { QrCameraScanner } from '../components/QrCameraScanner';
import { StatusDimensionsGrid } from '../components/StatusBadge';
import { AdvancedSettings } from '../components/ui/AdvancedSettings';
import { FriendlyErrorAlert } from '../components/ui/FriendlyErrorAlert';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { ThreeStepIndicator, WorkerProgressBar } from '../components/ui/StepProgressBar';
import { VerifiedArtworkDetailsCard } from '../components/VerifiedArtworkDetailsCard';
import { base64UrlEncode, bytesToHex } from '../core/crypto/sha256';
import { getStoredDiscordBinding } from '../core/discord/identityLink';
import { getSampleSignedArtworkFile } from '../core/demo/sampleArtwork';
import { comparePerceptualHashes } from '../core/image/perceptualHash';
import type { PerceptualComparisonResult } from '../core/image/perceptualHash';
import type { CanonicalRaster } from '../core/image/pngCodec';
import { readFileAsDataUrl } from '../core/image/previewDataUrl';
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
import {
  appendVerificationLog,
  clearVerificationLogs,
  loadVerificationLogs,
  type VerificationLogEntry,
} from '../core/verify/verificationLog';
import { imageWorkerClient, type WorkerProgressStage } from '../core/workers/imageWorkerClient';
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
  const { t, locale } = useI18n();
  const { isAdvanced, setMode, reducedMotion } = useAppPreferences();
  const demoTriggeredRef = useRef(false);
  const scanTimerRef = useRef<number | null>(null);
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
  const [workerProgress, setWorkerProgress] = useState<{
    percent: number;
    stage: WorkerProgressStage;
  } | null>(null);
  const [proofInput, setProofInput] = useState(() =>
    hasInitialHashProof ? window.location.href : '',
  );
  const [activeProofRaw, setActiveProofRaw] = useState<string | null>(() => initialUrlProof);
  const [attachedRaster, setAttachedRaster] = useState<CanonicalRaster | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFallbackDataUrl, setAttachedFallbackDataUrl] = useState<string | null>(null);
  const [scannerSweeping, setScannerSweeping] = useState(false);
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

  const [verificationLogs, setVerificationLogs] = useState<VerificationLogEntry[]>(() =>
    loadVerificationLogs(),
  );


  useEffect(() => {
    return () => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  const triggerScannerSweep = useCallback(
    async (work: () => Promise<void>) => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      if (isAdvanced || reducedMotion) {
        await work();
        return;
      }
      setScannerSweeping(true);
      const minSweep = new Promise<void>((resolve) => {
        scanTimerRef.current = window.setTimeout(() => {
          scanTimerRef.current = null;
          resolve();
        }, 650);
      });
      try {
        await Promise.all([work(), minSweep]);
      } finally {
        setScannerSweeping(false);
      }
    },
    [isAdvanced, reducedMotion],
  );

  const recordLog = useCallback(
    (res: VerificationResult, sourceLabel: string, qrStrategy?: string) => {
      const updated = appendVerificationLog({
        sourceLabel,
        protocolVersion: res.manifest?.version ?? null,
        signatureStatus: res.signatureStatus,
        integrityStatus: res.integrityStatus,
        identityStatus: res.identityStatus,
        artworkTitle: res.manifest?.artworkTitle,
        authorName: res.manifest?.authorName,
        authorFingerprintShort: res.publicKeyFingerprintShort ?? null,
        artworkIdHex: res.manifest?.artworkIdHex,
        qrStrategy,
      });
      setVerificationLogs(updated);
    },
    [],
  );

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
    async (
      rawProof: string,
      raster: CanonicalRaster | null,
      sourceLabel = 'Proof link / JSON',
      skipLog = false,
    ) => {
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
      setWorkerProgress({ percent: 12, stage: 'verifying' });
      try {
        const { verification: res } = await imageWorkerClient.verifyProof(
          {
            proofInput: rawProof,
            artworkRaster: raster,
          },
          (percent, stage) => setWorkerProgress({ percent, stage }),
        );
        setResult(res);
        if (!skipLog) {
          recordLog(res, sourceLabel);
        }
        await runEvidenceVerification(
          evidenceInputRaw,
          res.proofBytes,
          res.manifest,
          suppliedEvidenceFiles,
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to verify proof');
      } finally {
        setVerifyingProof(false);
        setWorkerProgress(null);
      }
    },
    [
      evidenceInputRaw,
      recordLog,
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
      setWorkerProgress({ percent: 15, stage: 'verifying' });
      try {
        const { verification: res } = await imageWorkerClient.verifyProof(
          {
            proofInput: urlProof,
            artworkRaster: null,
          },
          (percent, stage) => {
            if (active) setWorkerProgress({ percent, stage });
          },
        );
        if (active) {
          setLaunchedWithHashProof(true);
          setCameraAutoVerified(false);
          setActiveTab('proof');
          setProofInput(window.location.href);
          setActiveProofRaw(urlProof);
          setAttachedRaster(null);
          setAttachedFallbackDataUrl(null);
          setAttachedFileName(null);
          setQrInfoNote(null);
          setErrorMsg(null);
          setPasteFeedback(null);
          setTrustSavedMsg(null);
          setResult(res);
          recordLog(res, 'URL proof link');
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
          setWorkerProgress(null);
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
    recordLog,
    runEvidenceVerification,
    suppliedEvidenceFiles,
  ]);

  const handleSignedImageUpload = useCallback(
    async (file: File) => {
      const rawBytesPromise = file.arrayBuffer().then((buf) => new Uint8Array(buf));
      setAttachedRaster(null);
      setAttachedFallbackDataUrl(null);
      void readFileAsDataUrl(file).then((dataUrl) => {
        if (dataUrl) setAttachedFallbackDataUrl(dataUrl);
      });
      setAttachedFileName(file.name);
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
      setVerifyingProof(true);
      setResult(null);
      setWorkerProgress({ percent: 10, stage: 'decoding' });
      await triggerScannerSweep(async () => {
        try {
          const rawBytes = await rawBytesPromise;
          const res = await imageWorkerClient.verifyImage(
            { fileOrBytes: rawBytes },
            (percent, stage) => setWorkerProgress({ percent, stage }),
          );
          setAttachedRaster(res.raster);
          setAttachedFileName(file.name);
          setActiveProofRaw(res.qrRawText);
          setProofInput(res.qrRawText);
          setQrInfoNote(
            `QR decoded (${res.qrStrategy}) · ${res.imageWidth}×${res.imageHeight} px (${res.sourceFormat})`,
          );
          setResult(res.verification);
          recordLog(res.verification, file.name, res.qrStrategy);
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
        } finally {
          setVerifyingProof(false);
          setWorkerProgress(null);
        }
      });
    },
    [evidenceInputRaw, recordLog, runEvidenceVerification, suppliedEvidenceFiles, triggerScannerSweep],
  );

  const handleLoadSampleArtwork = useCallback(async () => {
    try {
      const sampleFile = await getSampleSignedArtworkFile(locale === 'ja' ? 'ja' : 'en');
      await handleSignedImageUpload(sampleFile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load sample artwork');
    }
  }, [handleSignedImageUpload, locale]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || (typeof window !== 'undefined' ? window.location.search : ''));
    if (params.get('demo') !== 'sample' || demoTriggeredRef.current) return;
    demoTriggeredRef.current = true;
    void handleLoadSampleArtwork();
  }, [handleLoadSampleArtwork, location.search]);

  const handleAttachArtworkForProof = useCallback(
    async (file: File) => {
      const rawBytesPromise = file.arrayBuffer().then((buf) => new Uint8Array(buf));
      setAttachedRaster(null);
      setAttachedFallbackDataUrl(null);
      void readFileAsDataUrl(file).then((dataUrl) => {
        if (dataUrl) setAttachedFallbackDataUrl(dataUrl);
      });
      setErrorMsg(null);
      setPasteFeedback(null);
      setWorkerProgress({ percent: 15, stage: 'decoding' });
      await triggerScannerSweep(async () => {
        try {
          const rawBytes = await rawBytesPromise;
          const { raster } = await imageWorkerClient.decodeImage(rawBytes, (percent, stage) =>
            setWorkerProgress({ percent, stage }),
          );
          setAttachedRaster(raster);
          setAttachedFileName(file.name);
          setSimComparisonName(null);
          setSimComparisonResult(null);
          setSimComparisonError(null);
          if (activeProofRaw) {
            await runProofVerify(activeProofRaw, raster, file.name);
          }
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to decode artwork image');
        } finally {
          setWorkerProgress(null);
        }
      });
    },
    [activeProofRaw, runProofVerify, triggerScannerSweep],
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
          const res = await imageWorkerClient.verifyImage({ fileOrBytes: rawBytes });
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
          recordLog(res.verification, rawName, res.qrStrategy);
          await runEvidenceVerification(
            evidenceInputRaw,
            res.verification.proofBytes,
            res.verification.manifest,
            suppliedEvidenceFiles,
          );
        } catch {
          const { raster } = await imageWorkerClient.decodeImage(rawBytes);
          if (!active) return;
          setAttachedRaster(raster);
          setAttachedFileName(rawName);
          setErrorMsg(null);
          const hash = window.location.hash;
          if (hash && hash.includes('proof=')) {
            setActiveTab('proof');
            await runProofVerify(hash, raster, rawName);
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
    recordLog,
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
    await runProofVerify(proofInput, attachedRaster, attachedFileName || 'Manual proof');
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
      await runProofVerify(text, attachedRaster, file.name);
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
      void runProofVerify(rawText, attachedRaster, 'Camera QR scan');
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
      await runProofVerify(activeProofRaw, attachedRaster, attachedFileName || 'Proof', true);
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
      await runProofVerify(activeProofRaw, attachedRaster, attachedFileName || 'Proof', true);
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
      await runProofVerify(activeProofRaw, attachedRaster, attachedFileName || 'Proof', true);
    }
  };

  const handleSimilarityCompareFile = async (file: File) => {
    setSimComparisonError(null);
    if (!attachedRaster) {
      setSimComparisonError(t.hardening.similarity.noBaseline);
      return;
    }
    try {
      const { raster: candidateRaster } = await imageWorkerClient.decodeImage(file);
      const [refHashes, candHashes] = await Promise.all([
        imageWorkerClient.computePerceptualHashes(attachedRaster),
        imageWorkerClient.computePerceptualHashes(candidateRaster),
      ]);
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
    if (signal === 'disallow') return 'ga-status-error';
    if (signal === 'allow') return 'ga-status-success';
    return 'ga-surface-subtle ga-text-secondary ga-border';
  };

  const tabClass = (tab: InputTab) =>
    `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] cursor-pointer ${
      activeTab === tab ? 'ga-surface-subtle ga-text border ga-border-strong' : 'ga-btn-secondary'
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

  const activeStep: 1 | 2 | 3 = verifyingProof || workerProgress ? 2 : result ? 3 : 1;

  const progressStageLabel = workerProgress
    ? workerProgress.stage === 'decoding'
      ? t.humanUx.verifyUx.progressStages.decoding
      : workerProgress.stage === 'scanning-qr'
        ? t.humanUx.verifyUx.progressStages.scanningQr
        : workerProgress.stage === 'verifying'
          ? t.humanUx.verifyUx.progressStages.verifying
          : workerProgress.stage === 'hashing'
            ? t.humanUx.verifyUx.progressStages.hashing
            : t.humanUx.verifyUx.progressStages.complete
    : '';

  const proofForm = (
    <form onSubmit={handleManualProofSubmit} className="space-y-3">
      <label htmlFor="proofInput" className="block text-xs font-medium ga-text-secondary">
        {t.verify.proofInputLabel}
      </label>
      <textarea
        id="proofInput"
        rows={3}
        value={proofInput}
        onChange={(e) => setProofInput(e.target.value)}
        placeholder={t.verify.proofInputPlaceholder}
        data-testid="verify-proof-textarea"
        className="ga-input w-full rounded-xl p-3 text-xs font-mono"
      />
      <div className="space-y-1.5">
        <label htmlFor={proofBundleInputId} className="block text-xs font-medium ga-text-secondary">
          {t.verify.proofBundleUploadLabel}
        </label>
        <input
          id={proofBundleInputId}
          type="file"
          accept=".json,.chproof.json,application/json"
          data-testid="verify-proof-bundle-input"
          onChange={(e) => void handleProofBundleFileChange(e)}
          className="block w-full text-xs ga-text-secondary file:mr-3 file:rounded-xl file:border file:border-[var(--ga-border-strong)] file:bg-[var(--ga-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--ga-text)] cursor-pointer"
        />
      </div>
      <button
        type="submit"
        data-testid="verify-proof-submit"
        className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
      >
        <span>{t.verify.verifyProofBtn}</span>
      </button>
    </form>
  );

  const showEvidenceSection =
    isAdvanced ||
    Boolean(evidenceInputRaw) ||
    Boolean(result?.manifest?.evidenceHashes && result.manifest.evidenceHashes.length > 0);

  const optionalExtensionSection = showEvidenceSection ? (
    <AdvancedSettings
      label={t.artworkDetails.verifySectionTitle}
      summary={evidenceFileName || t.artworkDetails.verifySectionHint}
      testId="verify-evidence-panel"
    >
      <p className="text-xs ga-text-secondary leading-relaxed">
        {t.artworkDetails.verifySectionHint}
      </p>

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
          className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px] cursor-pointer"
        >
          <FileCheck2 className="h-4 w-4 shrink-0 ga-text-accent" aria-hidden="true" />
          <span>{t.artworkDetails.verifyAttachEvidenceBtn}</span>
        </label>

        {canAttachLocalEvidenceFiles && (
          <label
            htmlFor={localFilesInputId}
            className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px] cursor-pointer"
          >
            <Upload className="h-4 w-4 shrink-0 ga-text-accent" aria-hidden="true" />
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
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs min-h-[44px] cursor-pointer"
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
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs min-h-[44px] cursor-pointer"
          >
            <span>{t.artworkDetails.verifyClearFilesBtn}</span>
          </button>
        )}
      </div>

      {evidenceFileName && (
        <p className="text-xs font-mono ga-text-accent">
          {evidenceFileName}
          {suppliedEvidenceFiles.length > 0
            ? ` · ${suppliedEvidenceFiles.length} file(s)`
            : ''}
        </p>
      )}

      {evidenceHashProgress && (
        <p role="status" className="text-xs font-mono ga-text-accent">
          {evidenceHashProgress}
        </p>
      )}
    </AdvancedSettings>
  ) : null;

  const inputTabsSection = (
    <section
      data-testid="verify-input-section"
      className="ga-card rounded-2xl p-5 space-y-4"
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
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={pasteBusy}
              onClick={() => void handlePasteButtonClick()}
              data-testid="verify-paste-image-btn"
              className="chm-spring-btn ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <ClipboardPaste className="h-4 w-4 shrink-0 ga-text-accent" aria-hidden="true" />
              <span>{pasteBusy ? t.verifyMobile.pasteBusy : t.verifyMobile.pasteImageBtn}</span>
            </button>

            <button
              type="button"
              disabled={verifyingProof}
              onClick={() => void handleLoadSampleArtwork()}
              data-testid="verify-sample-btn"
              className="chm-spring-btn ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <Sparkles className="h-4 w-4 shrink-0 ga-text-accent" aria-hidden="true" />
              <span>{t.simple.verify.sampleTryBtn}</span>
            </button>

            <span className="text-xs ga-text-muted">{t.verifyMobile.pasteHint}</span>
          </div>

          {(attachedRaster || attachedFallbackDataUrl) && (
            <ScannerBeam
              scanning={scannerSweeping || verifyingProof}
              label={t.simple.verify.scanningLabel}
              testId="verify-scanner-beam"
              className="ga-surface-subtle p-3 flex flex-col items-center gap-2"
            >
              <SafeArtworkImage
                raster={attachedRaster}
                fallbackDataUrl={attachedFallbackDataUrl}
                alt={attachedFileName ?? 'Artwork preview'}
                testId="verify-attached-preview"
                className="max-h-56 max-w-full w-auto object-contain rounded-lg border ga-border"
              />
              {attachedFileName && (
                <span className="text-[11px] font-mono ga-text-muted truncate max-w-full">
                  {attachedFileName}
                </span>
              )}
            </ScannerBeam>
          )}
          {pasteFeedback && (
            <p role="status" className="ga-status-warning rounded-xl border px-3 py-2 text-xs">
              {pasteFeedback}
            </p>
          )}
        </div>
      )}

      {activeTab === 'camera' && <QrCameraScanner onDetected={handleCameraDetected} />}

      {activeTab === 'proof' &&
        (launchedWithHashProof ? (
          <details className="group ga-surface-subtle rounded-xl border ga-border p-3">
            <summary className="flex items-center justify-between gap-2 cursor-pointer text-xs sm:text-sm font-medium ga-text list-none select-none min-h-[44px]">
              <span>{t.verifyMobile.rawProofToggle}</span>
              <ChevronDown
                className="h-4 w-4 ga-text-muted transition-transform group-open:rotate-180 shrink-0"
                aria-hidden="true"
              />
            </summary>
            <div className="pt-3 mt-3 border-t ga-border">{proofForm}</div>
          </details>
        ) : (
          proofForm
        ))}

      {qrInfoNote && (
        <p className="ga-surface-subtle rounded-xl border ga-border px-3 py-2 text-xs font-mono ga-text-accent">
          {qrInfoNote}
        </p>
      )}

      {errorMsg && !isAdvanced && !scannerSweeping && (
        <div
          data-testid="verify-simple-verdict"
          data-verdict="warn"
          className="chm-verdict-wobble ga-status-warning rounded-2xl border p-4 sm:p-5 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-sm sm:text-base font-bold">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{t.simple.verify.verdictWarnTitle}</span>
            </div>
            <HelpTip
              label={t.simple.verify.verdictWarnTitle}
              text={t.simple.verify.verdictWarnTipText}
              testId="verify-verdict-tip-btn"
              panelTestId="verify-verdict-tip-panel"
            />
          </div>
          <p className="text-xs sm:text-sm opacity-90">{t.simple.verify.verdictWarnDesc}</p>
        </div>
      )}

      {errorMsg && (
        <FriendlyErrorAlert
          error={errorMsg}
          onDismiss={() => setErrorMsg(null)}
          testId="verify-error-alert"
        />
      )}

      {standaloneEvidenceError && (
        <FriendlyErrorAlert
          error={standaloneEvidenceError}
          onDismiss={() => setStandaloneEvidenceError(null)}
          testId="verify-standalone-evidence-error"
        />
      )}
    </section>
  );

  const step2ArtworkCtaSection = showTopProofStep2Cta ? (
    <section
      data-testid="verify-proof-artwork-cta"
      className="ga-status-info rounded-2xl border p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-semibold ga-text">
          {t.verifyMobile.proofStep2Title}
        </h2>
        {attachedFileName && (
          <span className="ga-status-info rounded-full border px-3 py-1 text-xs font-mono">
            {t.verifyMobile.attachedReadyBadge}: {attachedFileName}
          </span>
        )}
      </div>
      <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
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
          className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
        >
          <ClipboardPaste className="h-4 w-4 shrink-0 ga-text-accent" aria-hidden="true" />
          <span>{pasteBusy ? t.verifyMobile.pasteBusy : t.verifyMobile.pasteImageBtn}</span>
        </button>
        <span className="text-xs ga-text-secondary">{t.verifyMobile.pasteHint}</span>
      </div>
      {pasteFeedback && (
        <p role="status" className="ga-status-warning rounded-xl border px-3 py-2 text-xs">
          {pasteFeedback}
        </p>
      )}
    </section>
  ) : null;

  const verifyingSpinnerCard = workerProgress ? (
    <WorkerProgressBar
      percent={workerProgress.percent}
      label={progressStageLabel || t.minimal.verify.verifyingProofLabel}
      testId="verify-worker-progress"
    />
  ) : verifyingProof && !result ? (
    <div
      role="status"
      data-testid="verify-auto-status-banner"
      className="ga-status-info rounded-2xl border p-4 flex items-center gap-3 text-sm"
    >
      <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
      <span>{t.minimal.verify.verifyingProofLabel}</span>
    </div>
  ) : null;

  const simpleVerdictKind = result
    ? result.signatureStatus === 'valid' && result.integrityStatus === 'matched'
      ? 'pass'
      : result.signatureStatus === 'valid'
        ? 'sns-pass'
        : 'warn'
    : null;

  const resultsSection = result && !scannerSweeping ? (
    <div className="space-y-5" data-testid="verification-results">
      {!isAdvanced && simpleVerdictKind && (
        <section
          data-testid="verify-simple-verdict"
          data-verdict={simpleVerdictKind}
          className={`relative rounded-2xl border p-4 sm:p-5 space-y-3 min-w-0 ${
            simpleVerdictKind === 'pass'
              ? 'chm-verdict-pop ga-status-success shadow-sm'
              : simpleVerdictKind === 'sns-pass'
                ? 'chm-pulse-soft ga-status-info shadow-sm'
                : 'chm-verdict-wobble ga-status-warning'
          }`}
        >
          {simpleVerdictKind === 'pass' && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <SparkleBurst active={!reducedMotion} testId="verify-verdict-sparkles" />
            </div>
          )}
          <div className="relative z-10 flex items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 text-base sm:text-lg font-bold">
                {simpleVerdictKind === 'warn' ? (
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {simpleVerdictKind === 'pass'
                    ? t.simple.verify.verdictPassTitle
                    : simpleVerdictKind === 'sns-pass'
                      ? t.simple.verify.verdictSnsTitle
                      : t.simple.verify.verdictWarnTitle}
                </span>
              </div>
              <p className="text-xs sm:text-sm opacity-90">
                {simpleVerdictKind === 'pass'
                  ? t.simple.verify.verdictPassDesc
                  : simpleVerdictKind === 'sns-pass'
                    ? t.simple.verify.verdictSnsDesc
                    : t.simple.verify.verdictWarnDesc}
              </p>
            </div>

            <HelpTip
              label={
                simpleVerdictKind === 'pass'
                  ? t.simple.verify.verdictPassTipLabel
                  : simpleVerdictKind === 'sns-pass'
                    ? t.simple.verify.verdictSnsTipLabel
                    : t.simple.verify.verdictWarnTitle
              }
              text={
                simpleVerdictKind === 'pass'
                  ? t.simple.verify.verdictPassTipText
                  : simpleVerdictKind === 'sns-pass'
                    ? t.simple.verify.verdictSnsTipText
                    : t.simple.verify.verdictWarnTipText
              }
              testId="verify-verdict-tip-btn"
              panelTestId="verify-verdict-tip-panel"
            />
          </div>

          {result.manifest && (
            <div
              data-testid="verify-simple-meta-pills"
              className="relative z-10 flex flex-wrap gap-2 pt-1 text-xs"
            >
              {result.manifest.authorName && (
                <span className="ga-card-solid rounded-full border ga-border px-3 py-1 font-medium ga-text">
                  {t.simple.verify.artistPillLabel}: {result.manifest.authorName}
                </span>
              )}
              {result.manifest.artworkTitle && (
                <span className="ga-card-solid rounded-full border ga-border px-3 py-1 font-medium ga-text">
                  {t.simple.verify.titlePillLabel}: {result.manifest.artworkTitle}
                </span>
              )}
              <span className="ga-card-solid rounded-full border ga-border px-3 py-1 font-medium ga-text-accent">
                {t.simple.verify.licensePillLabel}: {result.manifest.license.licenseId}
              </span>
            </div>
          )}
        </section>
      )}
      {prioritizeResultsTop && result.manifest && (
        <div
          data-testid="verify-auto-verified-pill"
          className="ga-status-success inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t.minimal.verify.autoVerifiedBadge}</span>
          {isAdvanced && (
            <span className="font-mono text-[11px] opacity-85">
              · Protocol v{result.manifest.version}
            </span>
          )}
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

      {result.signatureStatus === 'valid' &&
        result.manifest &&
        (() => {
          const pubKeyB64 = base64UrlEncode(result.manifest.publicKey);
          const storedBinding = getStoredDiscordBinding(pubKeyB64);
          const manifestDiscordSns = result.manifest.snsLinks?.find(
            (s) => s.platform === 'discord' && (s.label?.trim() || s.url.trim()),
          );
          const discordHandle =
            storedBinding?.discordUsername ??
            manifestDiscordSns?.label?.trim() ??
            manifestDiscordSns?.url.trim() ??
            null;
          if (!discordHandle) return null;
          const sourceLabel = storedBinding
            ? t.discordUx.identityLink.verifyBadgeSourceExchange
            : t.discordUx.identityLink.verifyBadgeSourceManifest;
          return (
            <div
              data-testid="verify-discord-badge"
              className="ga-status-info rounded-2xl border p-4 flex items-start gap-3 min-w-0"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ga-accent-soft)] ga-text-accent shrink-0">
                <MessageSquare className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold ga-text">
                  <span>{t.discordUx.identityLink.verifyBadgeTitle}</span>
                  <span className="rounded-full bg-[var(--ga-accent-soft)] px-2.5 py-0.5 font-mono text-xs ga-text-accent">
                    {discordHandle}
                  </span>
                </div>
                <p className="text-xs ga-text-secondary">
                  {t.discordUx.identityLink.verifyBadgeDesc}
                </p>
                <p className="text-[11px] ga-text-muted">{sourceLabel}</p>
              </div>
            </div>
          );
        })()}

      {result.manifest &&
        (result.keyNoticeStatus === 'revocation-notice' ||
          result.keyNoticeStatus === 'rotation-notice') && (
          <div
            role="alert"
            data-testid="verify-key-notice-banner"
            className="ga-status-warning rounded-2xl border p-4 space-y-2.5 text-xs sm:text-sm"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {result.keyNoticeStatus === 'revocation-notice'
                    ? t.hardening.notices.localMatchBannerRevoked
                    : t.hardening.notices.localMatchBannerRotated}
                </p>
                <p className="text-xs opacity-90 leading-relaxed">
                  {t.hardening.notices.historicalValidNote}
                </p>
              </div>
            </div>
            {(result.keyNotices ?? []).map((notice) => (
              <div
                key={notice.id}
                className="ga-surface-subtle rounded-xl border ga-border p-3 space-y-1 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold ga-text">
                    {notice.noticeType === 'revocation'
                      ? t.hardening.notices.revokeBadge
                      : t.hardening.notices.rotateBadge}
                  </span>
                  <span className="font-mono ga-text-secondary">
                    {t.hardening.notices.reasons[notice.reason]}
                  </span>
                  {notice.replacementFingerprintShort && (
                    <span className="font-mono ga-text-accent">
                      → {notice.replacementFingerprintShort}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] ga-text-muted">
                  {t.hardening.notices.issuedAtLabel}:{' '}
                  {new Date(notice.noticeIssuedAt * 1000).toISOString()}
                </div>
                {notice.note && <p className="ga-text break-words">{notice.note}</p>}
              </div>
            ))}
            <p className="text-[11px] opacity-90 leading-relaxed">
              {t.hardening.notices.compromiseWarning}
            </p>
          </div>
        )}

      {result.manifest &&
        (!result.keyNoticeStatus || result.keyNoticeStatus === 'none-local') && (
          <div
            role="note"
            data-testid="verify-no-local-notice-note"
            className="ga-surface-subtle rounded-xl border ga-border p-3 flex items-start gap-2.5 text-xs ga-text-secondary"
          >
            <Info className="h-4 w-4 ga-text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.hardening.notices.noneLocalInfo}</span>
          </div>
        )}

      {result.errors.length > 0 && (
        <FriendlyErrorAlert
          error={result.errors.join(' · ')}
          testId="verify-result-errors"
        />
      )}

      {result.manifest && (
        <section
          data-testid="verify-drm-quick-card"
          className="ga-card rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-semibold ga-text">
              {t.minimal.verify.declaredSummaryTitle}
            </h2>
            <span className="ga-surface-subtle rounded-lg border ga-border px-2.5 py-1 text-xs font-mono ga-text-accent">
              v{result.manifest.version} · {result.publicKeyFingerprintShort ?? ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="ga-surface-subtle rounded-xl border ga-border px-3.5 py-2.5">
              <div className="text-[11px] ga-text-muted">{t.verify.fields.artworkTitle}</div>
              <div className="font-medium ga-text mt-0.5 break-words">
                {result.manifest.artworkTitle || t.verify.fields.none}
              </div>
            </div>

            <div className="ga-surface-subtle rounded-xl border ga-border px-3.5 py-2.5">
              <div className="text-[11px] ga-text-muted">{t.verify.fields.authorName}</div>
              <div className="font-medium ga-text mt-0.5 break-words">
                {result.manifest.authorName || t.verify.fields.none}
              </div>
            </div>

            {result.manifest.license.attributionName && (
              <div className="ga-surface-subtle rounded-xl border ga-border px-3.5 py-2.5">
                <div className="text-[11px] ga-text-muted">{t.verify.fields.attribution}</div>
                <div className="font-medium ga-text mt-0.5 break-words">
                  {result.manifest.license.attributionName}
                </div>
              </div>
            )}

            <div
              className={`ga-surface-subtle rounded-xl border ga-border px-3.5 py-2.5 ${
                result.manifest.license.attributionName ? '' : 'sm:col-span-2'
              }`}
            >
              <div className="text-[11px] ga-text-muted">{t.verify.fields.issuedAt}</div>
              <div className="font-mono text-xs ga-text mt-0.5">
                {new Date(result.manifest.issuedAt * 1000).toLocaleString()}
              </div>
            </div>
          </div>

          <p className="text-[11px] ga-text-muted flex items-start gap-1.5 leading-relaxed">
            <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.humanUx.verifyUx.selfDeclaredTimestampNote}</span>
          </p>

          <LicenseSummaryCard
            licenseId={result.manifest.license.licenseId}
            compact
            testId="verify-license-summary"
          />

          <div className="space-y-2" data-testid="verify-drm-policy-pills">
            <div className="text-xs font-medium ga-text-muted">
              {t.minimal.verify.rightsSignalsLabel}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.commercialUse)}`}
              >
                <div className="opacity-75 text-[11px]">{t.verify.fields.commercial}</div>
                <div className="font-semibold mt-0.5">
                  {formatPolicySignal(result.manifest.license.commercialUse)}
                </div>
              </div>
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.redistribution)}`}
              >
                <div className="opacity-75 text-[11px]">{t.verify.fields.redistribution}</div>
                <div className="font-semibold mt-0.5">
                  {formatPolicySignal(result.manifest.license.redistribution)}
                </div>
              </div>
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.aiTraining)}`}
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
                    className={`rounded-xl border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.allowsDerivatives)}`}
                  >
                    <div className="opacity-75 text-[11px]">
                      {t.nextGen.verify.v3DerivativesLabel}
                    </div>
                    <div className="font-semibold mt-0.5">
                      {formatPolicySignal(result.manifest.license.allowsDerivatives)}
                    </div>
                  </div>
                )}
                {result.manifest.license.allowsModifications !== undefined && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-xs ${policyPillTone(result.manifest.license.allowsModifications)}`}
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
                  <div className="ga-surface-subtle rounded-xl border ga-border px-3 py-2 text-xs ga-text">
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
                className="ga-surface-subtle rounded-xl border ga-border px-3 py-2 text-xs ga-text-secondary"
              >
                <span className="text-[11px] ga-text-muted">
                  {t.nextGen.verify.v3PolicyNoteLabel}:{' '}
                </span>
                <span className="break-words">{result.manifest.policyNote}</span>
              </div>
            )}
          </div>

          {result.manifest.description && (
            <div
              data-testid="verify-v3-description"
              className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-1.5"
            >
              <div className="text-[11px] ga-text-muted">{t.artworkDetails.descriptionLabel}</div>
              <p className="text-xs sm:text-sm ga-text whitespace-pre-wrap break-words leading-relaxed">
                {result.manifest.description}
              </p>
            </div>
          )}

          {(safeV3Website || safeV3SnsLinks.length > 0 || safeV3PortfolioLinks.length > 0) && (
            <div
              data-testid="verify-v3-creator-links"
              className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold ga-text-accent">
                  <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.groupCreator}</span>
                </span>
                <span className="ga-card-solid rounded-full border ga-border px-2.5 py-0.5 text-[10px] ga-text-secondary">
                  {t.artworkDetails.verifyProfileSelfDeclared}
                </span>
              </div>

              {safeV3Website && (
                <div>
                  <a
                    href={safeV3Website}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="verify-v3-website"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm ga-text-accent underline underline-offset-4 break-all"
                  >
                    <span>{safeV3Website}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              )}

              {safeV3SnsLinks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] ga-text-muted">
                    {t.nextGen.verify.v3SnsLinksLabel}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {safeV3SnsLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ga-card-solid inline-flex items-center gap-1.5 rounded-lg border ga-border px-3 py-1.5 text-xs ga-text-accent hover:border-[var(--ga-border-strong)] break-all"
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
                  <div className="text-[11px] ga-text-muted">
                    {t.nextGen.verify.v3PortfolioLinksLabel}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {safeV3PortfolioLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ga-card-solid inline-flex items-center gap-1.5 rounded-lg border ga-border px-3 py-1.5 text-xs ga-text-accent hover:border-[var(--ga-border-strong)] break-all"
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

          {result.signatureStatus === 'valid' &&
            result.identityStatus === 'unknown' &&
            result.trustedKeyUnconfirmed && (
              <div
                data-testid="verify-unconfirmed-trust-card"
                className="ga-status-warning rounded-xl border p-4 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">{t.hardening.trust.unconfirmedBadge}</p>
                    <p className="opacity-90 leading-relaxed">
                      {t.hardening.trust.unconfirmedHelp}
                    </p>
                  </div>
                </div>
                {result.publicKeyFingerprintHex && (
                  <div
                    data-testid="verify-trust-fingerprint-hex"
                    className="ga-surface-subtle rounded-lg border ga-border px-3 py-2 font-mono text-[11px] ga-text break-all"
                  >
                    {result.publicKeyFingerprintHex}
                  </div>
                )}
                <label className="flex items-start gap-2.5 text-xs ga-text cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={trustConfirmChecked}
                    onChange={(e) => setTrustConfirmChecked(e.target.checked)}
                    data-testid="verify-trust-confirm-checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-[var(--ga-primary-bg)] shrink-0"
                  />
                  <span>{t.hardening.trust.confirmCheckbox}</span>
                </label>
                <button
                  type="button"
                  disabled={!trustConfirmChecked}
                  onClick={() => void handleConfirmUnconfirmedKey()}
                  data-testid="verify-confirm-now-btn"
                  className="ga-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-45 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
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
                className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3"
              >
                <p className="text-xs sm:text-sm font-medium ga-text">
                  {t.verify.trustKeyPrompt}
                </p>
                <p className="text-xs ga-text-secondary leading-relaxed">
                  {t.hardening.trust.outOfBandNote}
                </p>
                {result.publicKeyFingerprintHex && (
                  <div
                    data-testid="verify-trust-fingerprint-hex"
                    className="ga-card-solid rounded-lg border ga-border px-3 py-2 font-mono text-[11px] ga-text-accent break-all"
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
                  className="ga-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                />
                <label className="flex items-start gap-2.5 text-xs ga-text cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={trustConfirmChecked}
                    onChange={(e) => setTrustConfirmChecked(e.target.checked)}
                    data-testid="verify-trust-confirm-checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-[var(--ga-primary-bg)] shrink-0"
                  />
                  <span>{t.hardening.trust.confirmCheckbox}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={!trustConfirmChecked}
                    data-testid="verify-trust-btn"
                    className="ga-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-45 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
                  >
                    {t.verify.trustKeyBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveUnconfirmedKey()}
                    data-testid="verify-trust-unconfirmed-btn"
                    className="ga-btn-secondary rounded-xl px-4 py-2 text-xs sm:text-sm font-medium min-h-[44px] cursor-pointer"
                  >
                    {t.hardening.trust.saveUnconfirmedBtn}
                  </button>
                </div>
              </form>
            )}

          {trustSavedMsg && (
            <p
              role="status"
              className="ga-status-success rounded-xl border px-3 py-2 text-xs font-medium"
            >
              {t.verify.trustedAlready} {trustSavedMsg}
            </p>
          )}

          {isAdvanced && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Link
                to={`/exchange?inspect=${encodeURIComponent(base64UrlEncode(result.manifest.publicKey))}`}
                data-testid="verify-inspect-exchange-link"
                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px]"
              >
                <Share2 className="h-3.5 w-3.5 shrink-0 ga-text-accent" aria-hidden="true" />
                <span>{t.verify.inspectInExchangeBtn}</span>
              </Link>
            </div>
          )}
        </section>
      )}

      {hasV3SelfContainedMetadata && result.manifest && Boolean(0) && (
        <section
          data-testid="verify-v3-metadata-card"
          className="ga-card rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-semibold ga-text">
              {t.nextGen.verify.v3MetadataTitle}
            </h2>
            <span className="ga-status-info rounded-full border px-2.5 py-0.5 text-[11px] font-mono">
              {t.nextGen.create.qrV3SelfContainedBadge}
            </span>
          </div>

          {result.manifest.description && (
            <div
              data-testid="verify-v3-description"
              className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-1.5"
            >
              <div className="text-[11px] ga-text-muted">{t.artworkDetails.descriptionLabel}</div>
              <p className="text-xs sm:text-sm ga-text whitespace-pre-wrap break-words leading-relaxed">
                {result.manifest.description}
              </p>
            </div>
          )}

          {(safeV3Website || safeV3SnsLinks.length > 0 || safeV3PortfolioLinks.length > 0) && (
            <div
              data-testid="verify-v3-creator-links"
              className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold ga-text-accent">
                  <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.groupCreator}</span>
                </span>
                <span className="ga-card-solid rounded-full border ga-border px-2.5 py-0.5 text-[10px] ga-text-secondary">
                  {t.artworkDetails.verifyProfileSelfDeclared}
                </span>
              </div>

              <p className="text-[11px] ga-text-muted leading-relaxed">
                {t.nextGen.verify.v3ProfileSnapshotNote}
              </p>

              {safeV3Website && (
                <div>
                  <a
                    href={safeV3Website}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="verify-v3-website"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm ga-text-accent underline underline-offset-4 break-all"
                  >
                    <span>{safeV3Website}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              )}

              {safeV3SnsLinks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] ga-text-muted">
                    {t.nextGen.verify.v3SnsLinksLabel}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {safeV3SnsLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ga-card-solid inline-flex items-center gap-1.5 rounded-lg border ga-border px-3 py-1.5 text-xs ga-text-accent hover:border-[var(--ga-border-strong)] break-all"
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
                  <div className="text-[11px] ga-text-muted">
                    {t.nextGen.verify.v3PortfolioLinksLabel}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {safeV3PortfolioLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ga-card-solid inline-flex items-center gap-1.5 rounded-lg border ga-border px-3 py-1.5 text-xs ga-text-accent hover:border-[var(--ga-border-strong)] break-all"
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
              className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold ga-text-accent">
                <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t.artworkDetails.groupCreation}</span>
              </div>

              {result.manifest.creationMethod && (
                <div
                  data-testid="verify-v3-creation-method"
                  className="ga-status-info rounded-xl border px-3 py-2 text-xs sm:text-sm"
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
                    <div className="ga-card-solid rounded-lg border ga-border p-2.5">
                      <div className="text-[11px] ga-text-muted">
                        {t.artworkDetails.softwareLabel}
                      </div>
                      <div className="ga-text mt-0.5 break-words">
                        {result.manifest.creationEnvironment.software}
                      </div>
                    </div>
                  )}
                  {result.manifest.creationEnvironment.hardware && (
                    <div className="ga-card-solid rounded-lg border ga-border p-2.5">
                      <div className="text-[11px] ga-text-muted">
                        {t.artworkDetails.hardwareLabel}
                      </div>
                      <div className="ga-text mt-0.5 break-words">
                        {result.manifest.creationEnvironment.hardware}
                      </div>
                    </div>
                  )}
                  {result.manifest.creationEnvironment.inputDevice && (
                    <div className="ga-card-solid rounded-lg border ga-border p-2.5">
                      <div className="text-[11px] ga-text-muted">
                        {t.artworkDetails.inputDeviceLabel}
                      </div>
                      <div className="ga-text mt-0.5 break-words">
                        {result.manifest.creationEnvironment.inputDevice}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.manifest.creationEnvironment?.notes && (
                <div>
                  <div className="text-[11px] ga-text-muted">
                    {t.artworkDetails.creationNotesLabel}
                  </div>
                  <p className="text-xs ga-text-secondary whitespace-pre-wrap break-words mt-0.5">
                    {result.manifest.creationEnvironment.notes}
                  </p>
                </div>
              )}

              <p className="text-[11px] ga-text-muted leading-relaxed">
                {t.artworkDetails.verifyStatementOnlyNote}
              </p>
            </div>
          )}

          {result.manifest.evidenceHashes && result.manifest.evidenceHashes.length > 0 && (
            <div
              data-testid="verify-v3-evidence-hashes"
              className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold ga-text-accent">
                  <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.nextGen.verify.v3EvidenceHashesTitle}</span>
                </span>
                <label
                  htmlFor={localFilesInputId}
                  data-testid="verify-v3-attach-local-files-btn"
                  className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0 ga-text-accent" aria-hidden="true" />
                  <span>{t.artworkDetails.verifyAttachFilesBtn}</span>
                </label>
              </div>

              <ul className="space-y-2">
                {(v3EvidenceMatch?.recordChecks ?? []).map((rec) => (
                  <li
                    key={rec.index}
                    data-testid={`verify-v3-evidence-record-${rec.index}`}
                    className="ga-card-solid rounded-lg border ga-border p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium ga-text break-words">
                        {rec.label || `Evidence #${rec.index + 1}`}
                        <span className="ms-2 rounded ga-surface-subtle px-2 py-0.5 text-[10px] ga-text-secondary">
                          {formatCategory(rec.category)}
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          rec.status === 'verified'
                            ? 'ga-status-success'
                            : 'ga-surface-subtle ga-border ga-text-secondary'
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
                    <div className="font-mono text-[11px] ga-text-muted break-all">
                      SHA-256: {rec.sha256Hex} · {rec.byteLength.toLocaleString()} bytes
                      {rec.matchedFileName && (
                        <span className="ms-2 text-[var(--ga-success-text)]">
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
                  className="ga-status-error rounded-xl border p-3 space-y-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t.artworkDetails.verifyEvidenceMismatchTitle}</span>
                  </div>
                  <p>{t.artworkDetails.verifyEvidenceMismatchHint}</p>
                  <ul className="space-y-1 font-mono text-[11px] break-all">
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
            <p className="text-[11px] ga-text-muted leading-relaxed">
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
          className="ga-status-info rounded-2xl border p-4 flex items-start gap-3 text-xs sm:text-sm"
        >
          <Info className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{t.verify.qrMaskNoticeTitle}</h2>
              {isAdvanced && (
                <HelpTip
                  label={t.simple.advancedTips.protocolModesLabel}
                  text={t.simple.advancedTips.protocolModesText}
                  testId="verify-qrmask-tip-btn"
                />
              )}
            </div>
            <p className="opacity-90 leading-relaxed">{t.verify.qrMaskNoticeBody}</p>
            <p className="font-mono text-xs">
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
                  result.qrMaskCoverageTier === 'high'
                    ? 'text-[var(--ga-error-text)]'
                    : 'text-[var(--ga-warning-text)]'
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
        <section className="ga-card rounded-2xl p-5 space-y-3">
          <h2 className="text-sm sm:text-base font-semibold ga-text">
            {t.verify.attachArtworkTitle}
          </h2>
          <p className="text-xs ga-text-muted">{t.verify.attachArtworkHint}</p>
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

      <p className="text-xs ga-text-muted px-1">{t.verify.trustReminder}</p>

      {/* Non-cryptographic Perceptual Similarity Check (Advanced Mode) */}
      {isAdvanced && attachedRaster && (
        <AdvancedSettings
          label={t.hardening.similarity.sectionTitle}
          testId="verify-similarity-panel"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="verify-similarity-noncrypto-badge"
                className="ga-status-warning inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
              >
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t.hardening.similarity.badgeNonCrypto}</span>
              </span>
            </div>
            <p className="text-xs ga-text-secondary leading-relaxed">
              {t.humanUx.verifyUx.perceptualNotice}
            </p>
            <ImageDropzone
              onFileSelected={handleSimilarityCompareFile}
              title={t.hardening.similarity.dropTitle}
              testId="verify-similarity-input"
            />
            {simComparisonError && (
              <FriendlyErrorAlert error={simComparisonError} onDismiss={() => setSimComparisonError(null)} />
            )}
            {simComparisonResult && (
              <div
                data-testid="verify-similarity-result"
                className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium ga-text-accent truncate">{simComparisonName}</span>
                  <span className="ga-card-solid rounded border ga-border px-2 py-0.5 font-semibold ga-text">
                    {simComparisonResult.band === 'high'
                      ? t.hardening.similarity.bandHigh
                      : simComparisonResult.band === 'moderate'
                        ? t.hardening.similarity.bandModerate
                        : t.hardening.similarity.bandLow}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                  <div className="ga-card-solid rounded-lg border ga-border p-2.5">
                    <div className="text-[11px] ga-text-muted">
                      {t.hardening.similarity.combinedLabel}
                    </div>
                    <div className="text-sm font-semibold ga-text mt-0.5">
                      {simComparisonResult.combinedSimilarityPct}%
                    </div>
                  </div>
                  <div className="ga-card-solid rounded-lg border ga-border p-2.5">
                    <div className="text-[11px] ga-text-muted">
                      {t.hardening.similarity.dHashLabel}
                    </div>
                    <div className="text-sm ga-text-accent mt-0.5">
                      {simComparisonResult.dHashSimilarityPct}% (d={simComparisonResult.dHashHamming})
                    </div>
                  </div>
                  <div className="ga-card-solid rounded-lg border ga-border p-2.5">
                    <div className="text-[11px] ga-text-muted">
                      {t.hardening.similarity.pHashLabel}
                    </div>
                    <div className="text-sm ga-text-accent mt-0.5">
                      {simComparisonResult.pHashSimilarityPct}% (d={simComparisonResult.pHashHamming})
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
                    className="ga-btn-secondary rounded-xl px-3 py-1.5 text-xs min-h-[36px] cursor-pointer"
                  >
                    {t.hardening.similarity.clearBtn}
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] ga-text-muted leading-relaxed">
              {t.hardening.similarity.disclaimer}
            </p>
          </div>
        </AdvancedSettings>
      )}

      {/* Raw Manifest & CBOR Inspector (Advanced Mode) */}
      {isAdvanced && result.manifest && (
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

      {!isAdvanced && result.manifest && (
        <div
          data-testid="verify-simple-advanced-hint"
          className="ga-surface-subtle rounded-xl border ga-border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs ga-text-secondary"
        >
          <span>{t.humanUx.verifyUx.historyAdvancedHint}</span>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium min-h-[36px] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.humanUx.mode.switchToAdvancedBtn}</span>
          </button>
        </div>
      )}
    </div>
  ) : null;

  const historySection = isAdvanced ? (
    <section
      data-testid="verify-history-panel"
      className="ga-card rounded-2xl p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-sm sm:text-base font-semibold ga-text flex items-center gap-2">
            <History className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.humanUx.verifyUx.historyTitle}</span>
          </h2>
          <p className="text-xs ga-text-muted">{t.humanUx.verifyUx.historySubtitle}</p>
        </div>
        {verificationLogs.length > 0 && (
          <button
            type="button"
            data-testid="verify-history-clear-btn"
            onClick={() => setVerificationLogs(clearVerificationLogs())}
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium min-h-[36px] cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.humanUx.verifyUx.historyClearBtn}</span>
          </button>
        )}
      </div>

      {verificationLogs.length === 0 ? (
        <p className="text-xs ga-text-muted py-2">{t.humanUx.verifyUx.historyEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {verificationLogs.slice(0, 15).map((entry) => (
            <li
              key={entry.id}
              data-testid="verify-history-item"
              className="ga-surface-subtle rounded-xl border ga-border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="font-medium ga-text truncate">
                  {entry.artworkTitle || entry.sourceLabel}
                  {entry.authorName ? ` · ${entry.authorName}` : ''}
                </div>
                <div className="font-mono text-[11px] ga-text-muted">
                  {new Date(entry.checkedAt).toLocaleString()} · {entry.sourceLabel}
                  {entry.authorFingerprintShort ? ` · ${entry.authorFingerprintShort}` : ''}
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0 ${
                  entry.signatureStatus === 'valid' ? 'ga-status-success' : 'ga-status-error'
                }`}
              >
                {entry.signatureStatus === 'valid'
                  ? t.humanUx.verifyUx.historyValidLabel
                  : t.humanUx.verifyUx.historyInvalidLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full min-w-0">
      <header className="flex items-start justify-between gap-3 sm:gap-4 border-b ga-border pb-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight ga-text break-words">
            {!isAdvanced ? t.simple.verify.pageTitle : t.home.ctaVerify}
          </h1>
          <p className="text-xs sm:text-sm ga-text-secondary break-words">
            {!isAdvanced ? t.simple.verify.pageSubtitle : t.minimal.verify.dropHint}
          </p>
        </div>

        <HelpIconButton
          label={t.minimal.verify.helpLabel}
          title={t.minimal.verify.helpLabel}
          closeLabel={t.minimal.home.closeHelp}
          testId="verify-help-btn"
        >
          <p>{t.minimal.verify.helpBody}</p>
          <p className="text-xs ga-text-muted">{t.verify.trustReminder}</p>
        </HelpIconButton>
      </header>

      <ThreeStepIndicator
        activeStep={activeStep}
        testIdPrefix="verify-step-indicator"
        steps={[
          { number: 1, label: t.humanUx.verifyUx.step1Short },
          { number: 2, label: t.humanUx.verifyUx.step2Short },
          { number: 3, label: t.humanUx.verifyUx.step3Short },
        ]}
      />

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
          {historySection}
        </>
      ) : (
        <>
          {verifyingSpinnerCard}
          {inputTabsSection}
          {optionalExtensionSection}
          {step2ArtworkCtaSection}
          {resultsSection}
          {historySection}
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="ga-surface-subtle rounded-xl border ga-border p-3">
      <dt className="text-xs ga-text-muted">{label}</dt>
      <dd className={`mt-0.5 ga-text break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
