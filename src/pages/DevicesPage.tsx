import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  base64UrlDecode,
  decodeQrFromImageBytes,
  hexToBytes,
  renderExchangeQrPng,
} from '@yomiplush/chm-exchange/core';
import type {
  DeviceRevocationReason,
  SignedDeviceRevocationNotice,
  SignedEnrollmentCertificate,
  SignedPairingRequest,
  VerifiedRegistryReconciliationResult,
} from '@yomiplush/chm-exchange/core';
import { QrCameraScanner, QrCodeDisplay } from '@yomiplush/chm-exchange/react';
import '@yomiplush/chm-exchange/styles.css';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Laptop,
  PlusCircle,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { FriendlyErrorAlert } from '../components/ui/FriendlyErrorAlert';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { SimpleModeBanner } from '../components/ui/SimpleModeBanner';
import { supportsWebCryptoEd25519 } from '../core/crypto/ed25519';
import {
  approvePairingRequestAsOwner,
  cancelPairingSession,
  clearCorruptDevicePairingRecord,
  completeDevicePairingWithCertificate,
  confirmPairedOwnerTrust,
  createOrReplaceLocalDeviceIdentity,
  exportSignedDeviceRegistry,
  importDeviceRevocationNotice,
  importSignedDeviceRegistry,
  inspectEnrollmentCertificateForDevice,
  inspectPairingRequestForApproval,
  loadDevicePairingState,
  parsePairingQrInput,
  removePairedDeviceEntry,
  revokePairedDevice,
  startDevicePairingRequestSession,
} from '../core/storage/devicePairingStore';
import type {
  DeviceIdentityRecord,
  EnrollmentCertificateInspection,
  PairedDeviceRecord,
  PairingRequestInspection,
  PairingSessionRecord,
  StorageCorruptionWarning,
} from '../core/storage/devicePairingStore';
import { createAuthorKey, listAuthorKeys, signWithAuthorKey } from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { DecentralizedSyncPanel } from '../components/devices/DecentralizedSyncPanel';
import { getDeviceNostrKeyRecord } from '../core/nostr/nostrKeyStore';
import type { NostrDeviceKeyRecord } from '../core/nostr/nostrKeyStore';
import {
  generateNostrKeypair,
  wipeBytes,
} from '../core/nostr/secp256k1';
import {
  type CreatedPairingInviteSession,
  type DecodedPairingInvite,
  SYNC_BINDING_TOKEN_PREFIX,
  announceLocalBindingToKnownPeers,
  attachSyncBindingToPairingUrl,
  buildInviteCertGiftWrap,
  buildInviteRequestGiftWrap,
  computeConfirmationCodeForCertificate,
  computeConfirmationCodeForRequest,
  computePairingConfirmationCode,
  createDefaultSyncSettings,
  createSignedPairingInvite,
  ensureLocalBindingAttestation,
  extractSyncBindFromPairingUrl,
  getSyncStatusSummary,
  getSyncTransport,
  importPeerSyncBindingInput,
  isPairingInviteInput,
  listVerifiedPeerBindings,
  loadSyncSettings,
  parseAndVerifyPairingInvite,
  recordAndBroadcastOwnerSyncMutation,
  runDecentralizedSyncCycle,
  suggestLocalDeviceName,
  toRelayConfigsFromUrls,
  unwrapAndVerifyInviteCert,
  unwrapAndVerifyInviteRequest,
} from '../core/sync';
import type {
  RelayConfig,
  SyncSettings,
  SyncStatusSummary,
  VerifiedPeerBinding,
} from '../core/sync/types';
import { useI18n } from '../i18n/context';

type DevicesTab = 'add' | 'approve' | 'registry' | 'sync';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadQrPngFile(qrText: string, filename: string) {
  const { pngBytes } = renderExchangeQrPng(qrText);
  downloadBlob(new Blob([new Uint8Array(pngBytes)], { type: 'image/png' }), filename);
}

function formatCountdown(expiresAtUnix: number, nowUnix: number): string {
  const diff = Math.max(0, expiresAtUnix - nowUnix);
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function DevicesPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const certUploadId = useId();
  const reqUploadId = useId();
  const revUploadId = useId();
  const regUploadId = useId();

  const [activeTab, setActiveTab] = useState<DevicesTab>(() => {
    const h = typeof window !== 'undefined' ? window.location.hash : '';
    if (h.startsWith('#pair-req=')) return 'approve';
    if (h.startsWith('#pair-rev=')) return 'registry';
    return 'add';
  });
  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);
  const [localDevice, setLocalDevice] = useState<DeviceIdentityRecord | null>(null);
  const [pendingSessions, setPendingSessions] = useState<PairingSessionRecord[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PairedDeviceRecord[]>([]);
  const [corruptionWarnings, setCorruptionWarnings] = useState<StorageCorruptionWarning[]>([]);
  const [webCryptoSupported, setWebCryptoSupported] = useState<boolean>(true);
  const [stateLoaded, setStateLoaded] = useState<boolean>(false);
  const processedHashRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick-create My ID if empty
  const [quickIdName, setQuickIdName] = useState('');
  const [quickIdPass, setQuickIdPass] = useState('');
  const [quickIdError, setQuickIdError] = useState<string | null>(null);

  // Tab 1: New device Step 1 & Step 2
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [devicePassInput, setDevicePassInput] = useState('');
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [activeRequestSession, setActiveRequestSession] = useState<{
    session: PairingSessionRecord;
    request: SignedPairingRequest;
    qrUrl: string;
  } | null>(null);

  const [certInput, setCertInput] = useState('');
  const [certInspection, setCertInspection] = useState<EnrollmentCertificateInspection | null>(null);
  const [confirmOwnerChecked, setConfirmOwnerChecked] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step2StatusMsg, setStep2StatusMsg] = useState<string | null>(null);
  const [step2WrongTypeKind, setStep2WrongTypeKind] = useState<'pairing-request-owner' | 'device-registry' | null>(null);
  const [step2WrongReqRaw, setStep2WrongReqRaw] = useState<string | null>(null);
  const [completedDevice, setCompletedDevice] = useState<PairedDeviceRecord | null>(null);
  const [completedViaInvite, setCompletedViaInvite] = useState(false);

  // Tab 1 Invite receiver state (when iPad scans #pair-invite= from PC)
  const [receivedInvite, setReceivedInvite] = useState<DecodedPairingInvite | null>(null);
  const [receivedInviteError, setReceivedInviteError] = useState<string | null>(null);
  const [receivedInviteSending, setReceivedInviteSending] = useState(false);
  const [receivedInviteSentState, setReceivedInviteSentState] = useState<{
    session: PairingSessionRecord;
    request: SignedPairingRequest;
    replyNostrSecretKey: Uint8Array;
    replyNostrPubkeyHex: string;
    relays: RelayConfig[];
    confirmCode: string;
    relayAccepted: boolean;
  } | null>(null);
  const replyNostrSecretRef = useRef<Uint8Array | null>(null);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Tab 2: Approve device (Owner side)
  const [selectedAuthorKeyId, setSelectedAuthorKeyId] = useState('');
  const latestOwnerRef = useRef<{ authorKeys: AuthorKeyRecord[]; selectedAuthorKeyId: string }>({
    authorKeys: [],
    selectedAuthorKeyId: '',
  });
  const [ownerPassphrase, setOwnerPassphrase] = useState('');
  const [incomingReqInput, setIncomingReqInput] = useState('');
  const [reqInspection, setReqInspection] = useState<PairingRequestInspection | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [issuedApproval, setIssuedApproval] = useState<{
    certificate: SignedEnrollmentCertificate;
    qrUrl: string;
    pairedDevice: PairedDeviceRecord;
  } | null>(null);

  // Tab 2 Invite issuer state (PC -> iPad Invitation QR)
  const [activeInviteSession, setActiveInviteSession] = useState<CreatedPairingInviteSession | null>(
    null,
  );
  const [inviteRelayStatus, setInviteRelayStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteCheckingNow, setInviteCheckingNow] = useState(false);
  const [pendingInviteReply, setPendingInviteReply] = useState<{
    inviteSession: CreatedPairingInviteSession;
    replyNostrPubkeyHex: string;
    requestHashHex: string;
    syncBindingToken?: string;
  } | null>(null);
  const [inviteApprovalSent, setInviteApprovalSent] = useState(false);
  const activeInviteRef = useRef<CreatedPairingInviteSession | null>(null);

  useEffect(() => {
    activeInviteRef.current = activeInviteSession;
  }, [activeInviteSession]);

  useEffect(() => {
    replyNostrSecretRef.current = receivedInviteSentState?.replyNostrSecretKey ?? null;
  }, [receivedInviteSentState]);

  useEffect(() => {
    return () => {
      activeInviteRef.current?.wipeSecrets();
      if (replyNostrSecretRef.current) {
        wipeBytes(replyNostrSecretRef.current);
      }
    };
  }, []);

  // Tab 3: Registry, revocation, export/import
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<DeviceRevocationReason>('lost-device');
  const [revokeNote, setRevokeNote] = useState('');
  const [revokePassphrase, setRevokePassphrase] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeAndRemove, setRevokeAndRemove] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [deviceListMsg, setDeviceListMsg] = useState<string | null>(null);
  const [generatedRevocation, setGeneratedRevocation] = useState<{
    revocation: SignedDeviceRevocationNotice;
    qrUrl: string;
  } | null>(null);

  const [importRevInput, setImportRevInput] = useState('');
  const [importRevMsg, setImportRevMsg] = useState<string | null>(null);
  const [importRevError, setImportRevError] = useState<string | null>(null);

  const [registryActionMsg, setRegistryActionMsg] = useState<string | null>(null);
  const [registryActionError, setRegistryActionError] = useState<string | null>(null);
  const [registryReconcileResult, setRegistryReconcileResult] =
    useState<VerifiedRegistryReconciliationResult | null>(null);

  // Tab 4: Optional Decentralized Sync state
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => createDefaultSyncSettings());
  const [syncStatus, setSyncStatus] = useState<SyncStatusSummary>(() => ({
    health: 'disabled',
    enabled: false,
    consentAccepted: false,
    queuedOutboxCount: 0,
    knownOpCount: 0,
    missingSequences: [],
    hasCausalGap: false,
    reachableRelays: 0,
    totalEnabledRelays: 0,
    relayStatuses: [],
    onlineSyncBudgetBytes: 1_048_576,
    syncWindowBytesUsed: 0,
    budgetPaused: false,
    paidRelaysRejectedCount: 0,
    gracefulFallbackReason: 'none',
  }));
  const [nostrKey, setNostrKey] = useState<NostrDeviceKeyRecord | null>(null);
  const [peerBindings, setPeerBindings] = useState<VerifiedPeerBinding[]>([]);

  const applyLoadedState = useCallback(
    (
      ak: AuthorKeyRecord[],
      state: Awaited<ReturnType<typeof loadDevicePairingState>>,
      wcSupported: boolean,
    ) => {
      setAuthorKeys(ak);
      setLocalDevice(state.localDevice);
      setPendingSessions(state.pendingSessions);
      setPairedDevices(state.pairedDevices);
      setCorruptionWarnings(state.corruptionWarnings);
      setWebCryptoSupported(wcSupported);

      if (ak.length > 0) {
        setSelectedAuthorKeyId((prev) => (prev && ak.some((k) => k.id === prev) ? prev : ak[0].id));
      } else {
        setSelectedAuthorKeyId('');
      }
      if (state.localDevice) {
        setDeviceNameInput((prev) => prev || state.localDevice!.deviceName);
      }
    },
    [],
  );

  const loadSyncViewState = useCallback(async (device: DeviceIdentityRecord | null) => {
    const [settings, status, bindings, nk] = await Promise.all([
      loadSyncSettings(),
      getSyncStatusSummary(),
      listVerifiedPeerBindings(),
      device ? getDeviceNostrKeyRecord(device.deviceIdHex) : Promise.resolve(null),
    ]);
    if (!isMountedRef.current) return;
    setSyncSettings(settings);
    setSyncStatus(status);
    setPeerBindings(bindings);
    setNostrKey(nk);
  }, []);

  const refreshAll = useCallback(async () => {
    const [ak, state, wcSupported] = await Promise.all([
      listAuthorKeys(),
      loadDevicePairingState(),
      supportsWebCryptoEd25519(),
    ]);
    applyLoadedState(ak, state, wcSupported);
    await loadSyncViewState(state.localDevice);
  }, [applyLoadedState, loadSyncViewState]);

  useEffect(() => {
    let active = true;
    Promise.all([listAuthorKeys(), loadDevicePairingState(), supportsWebCryptoEd25519()]).then(
      async ([ak, state, wcSupported]) => {
        if (active) {
          const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
          const enrolledUnderDifferentOwner = Boolean(
            state.localDevice &&
              state.pairedDevices.some(
                (d) =>
                  d.devicePublicKeyBase64Url === state.localDevice?.publicKeyBase64Url &&
                  d.localVerificationStatus !== 'revoked' &&
                  d.localVerificationStatus !== 'conflict-revoked' &&
                  !ak.some((k) => k.fingerprintHex === d.ownerFingerprintHex),
              ),
          );
          if (
            !initialHash.startsWith('#pair-') &&
            ak.length > 0 &&
            state.pendingSessions.length === 0 &&
            !enrolledUnderDifferentOwner
          ) {
            setActiveTab('approve');
          }
          applyLoadedState(ak, state, wcSupported);
          await loadSyncViewState(state.localDevice);
          if (active) setStateLoaded(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [applyLoadedState, loadSyncViewState]);

  // Countdown tick for pending request expiration display
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowUnix(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    latestOwnerRef.current = { authorKeys, selectedAuthorKeyId };
  }, [authorKeys, selectedAuthorKeyId]);

  // Auto-route hash fragments (#pair-req=, #pair-cert=, #pair-rev=) with full validation
  useEffect(() => {
    if (!stateLoaded) return;
    const h = typeof window !== 'undefined' ? window.location.hash : location.hash;
    if (!h) return;
    const isPairingHash =
      h.startsWith('#pair-invite=') ||
      h.startsWith('#pair-req=') ||
      h.startsWith('#pair-cert=') ||
      h.startsWith('#pair-rev=');
    if (!isPairingHash) return;
    if (processedHashRef.current === h) return;
    processedHashRef.current = h;
    const fullUrl = window.location.href;

    navigate(`${location.pathname}${location.search}`, { replace: true });

    if (h.startsWith('#pair-invite=')) {
      Promise.resolve().then(() => {
        if (!isMountedRef.current) return;
        setActiveTab('add');
        setReceivedInviteError(null);
        setReceivedInviteSentState(null);
        setCompletedDevice(null);
        setCompletedViaInvite(false);
        setDeviceNameInput((prev) => prev || suggestLocalDeviceName());
        try {
          const parsed = parseAndVerifyPairingInvite(fullUrl);
          if (parsed.expired) {
            setReceivedInvite(null);
            setReceivedInviteError(tRef.current.devices.inviteExpiredError);
            return;
          }
          setReceivedInvite(parsed.invite);
        } catch (err) {
          setReceivedInvite(null);
          setReceivedInviteError(err instanceof Error ? err.message : 'Invalid pairing invitation QR');
        }
      });
    } else if (h.startsWith('#pair-req=')) {
      const { authorKeys: latestKeys, selectedAuthorKeyId: latestOwnerId } = latestOwnerRef.current;
      const owner = latestKeys.find((k) => k.id === latestOwnerId);
      Promise.resolve().then(async () => {
        if (!isMountedRef.current) return;
        setActiveTab('approve');
        setIncomingReqInput(fullUrl);
        setApproveError(null);
        setReqInspection(null);
        setIssuedApproval(null);
        try {
          const res = await inspectPairingRequestForApproval({
            rawInput: fullUrl,
            ownerPublicKeyBase64Url: owner?.publicKeyBase64Url,
            ownerFingerprintHex: owner?.fingerprintHex,
          });
          if (!isMountedRef.current) return;
          if (res.alreadyConsumed) {
            throw new Error('Replay blocked: this pairing request QR has already been used.');
          }
          if (res.expired) {
            throw new Error('This pairing request QR has expired. Generate a fresh QR on the new device.');
          }
          if (res.deviceRevoked) {
            throw new Error(tRef.current.devices.approveRevokedDeviceError);
          }
          if (res.alreadyRegisteredUnderOwner) {
            throw new Error(tRef.current.devices.approveAlreadyRegisteredError);
          }
          setReqInspection(res);
        } catch (err) {
          if (!isMountedRef.current) return;
          setApproveError(err instanceof Error ? err.message : 'Invalid pairing request QR');
        }
      });
    } else if (h.startsWith('#pair-cert=')) {
      Promise.resolve().then(async () => {
        if (!isMountedRef.current) return;
        setActiveTab('add');
        setCertInput(fullUrl);
        setStep2Error(null);
        setCertInspection(null);
        setConfirmOwnerChecked(false);
        setCompletedDevice(null);
        try {
          const res = await inspectEnrollmentCertificateForDevice({
            rawCertificateInput: fullUrl,
          });
          if (!isMountedRef.current) return;
          if (!res.verification.valid) {
            throw new Error(res.verification.errors.join(' '));
          }
          if (res.deviceRevoked) {
            throw new Error(tRef.current.devices.step2RevokedDeviceError);
          }
          if (res.alreadyRegistered) {
            throw new Error(tRef.current.devices.step2AlreadyRegisteredError);
          }
          setCertInspection(res);
        } catch (err) {
          if (!isMountedRef.current) return;
          setStep2Error(err instanceof Error ? err.message : 'Invalid enrollment certificate');
        }
      });
    } else if (h.startsWith('#pair-rev=')) {
      Promise.resolve().then(() => {
        if (!isMountedRef.current) return;
        setActiveTab('registry');
        setImportRevInput(fullUrl);
      });
    }
  }, [location.hash, location.pathname, location.search, navigate, stateLoaded]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard blocked in some headless browsers
    }
  };

  const handleQuickCreateAuthorKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickIdError(null);
    try {
      if (quickIdPass && quickIdPass.length < 8) {
        throw new Error('Passphrase must be at least 8 characters');
      }
      await createAuthorKey({
        label: quickIdName.trim() || 'My CHM Identity',
        backupPassphrase: quickIdPass || undefined,
      });
      setQuickIdName('');
      setQuickIdPass('');
      await refreshAll();
    } catch (err) {
      setQuickIdError(err instanceof Error ? err.message : 'Failed to create My ID');
    }
  };

  const handleRegenerateDeviceIdentity = async () => {
    setStep1Error(null);
    setStep2Error(null);
    try {
      await createOrReplaceLocalDeviceIdentity({
        deviceName: deviceNameInput.trim() || 'My Device',
        backupPassphrase: devicePassInput || undefined,
        forceNew: true,
      });
      setActiveRequestSession(null);
      setCertInspection(null);
      setCompletedDevice(null);
      await refreshAll();
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Failed to create new device identity');
    }
  };

  const handleStartPairingSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    setCompletedDevice(null);
    setCertInspection(null);
    try {
      const res = await startDevicePairingRequestSession({
        deviceName: deviceNameInput.trim() || 'My Device',
        devicePassphrase: devicePassInput || undefined,
      });
      setActiveRequestSession(res);
      await refreshAll();
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Failed to create pairing QR');
    }
  };

  const handleCancelPairingRequest = async (requestIdHex: string) => {
    await cancelPairingSession(requestIdHex);
    if (activeRequestSession?.session.requestIdHex === requestIdHex) {
      setActiveRequestSession(null);
    }
    setCertInspection(null);
    await refreshAll();
  };

  const inspectCertValue = async (rawValue: string) => {
    setStep2Error(null);
    setStep2StatusMsg(null);
    setStep2WrongTypeKind(null);
    setStep2WrongReqRaw(null);
    setCertInspection(null);
    setConfirmOwnerChecked(false);
    setCompletedDevice(null);
    setCompletedViaInvite(false);
    try {
      if (isPairingInviteInput(rawValue)) {
        inspectIncomingInviteValue(rawValue);
        return;
      }
      let parsedKind: ReturnType<typeof parsePairingQrInput> | null = null;
      try {
        parsedKind = parsePairingQrInput(rawValue);
      } catch {
        // Fall through to inspectEnrollmentCertificateForDevice for malformed/tampered input errors
      }
      if (parsedKind?.kind === 'pairing-request') {
        if (authorKeys.length > 0) {
          setStep2WrongTypeKind('pairing-request-owner');
          setStep2WrongReqRaw(rawValue);
          setStep2Error(t.devices.step2WrongTypeRequestOwner);
        } else {
          setStep2Error(t.devices.step2WrongTypeRequestChild);
        }
        return;
      }
      if (parsedKind?.kind === 'device-revocation') {
        const rev = await importDeviceRevocationNotice(rawValue);
        setCertInput('');
        setStep2StatusMsg(`${t.devices.step2RevocationAppliedMsg} (${rev.payload.deviceFingerprintShort})`);
        await refreshAll();
        return;
      }
      if (parsedKind?.kind === 'device-registry') {
        setStep2WrongTypeKind('device-registry');
        setStep2Error(t.devices.step2WrongTypeRegistry);
        return;
      }

      const inspected = await inspectEnrollmentCertificateForDevice({
        rawCertificateInput: rawValue,
      });
      if (!inspected.verification.valid) {
        throw new Error(inspected.verification.errors.join(' '));
      }
      if (inspected.deviceRevoked) {
        throw new Error(t.devices.step2RevokedDeviceError);
      }
      if (inspected.alreadyRegistered) {
        throw new Error(t.devices.step2AlreadyRegisteredError);
      }
      setCertInspection(inspected);
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Invalid approval QR code');
    }
  };

  const handleCertQrFileUpload = async (file: File | null) => {
    if (!file) return;
    setStep2Error(null);
    setCertInspection(null);
    setCompletedDevice(null);
    try {
      const decoded = await decodeQrFromImageBytes(file);
      setCertInput(decoded);
      await inspectCertValue(decoded);
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Could not decode QR image');
    }
  };

  const handleCompletePairing = async () => {
    if (!certInspection) return;
    setStep2Error(null);
    const rawCertInput = certInput;
    try {
      const { pairedDevice } = await completeDevicePairingWithCertificate({
        rawCertificateInput: certInspection.certificate.token,
        confirmOwnerTrust: confirmOwnerChecked,
      });
      try {
        if (extractSyncBindFromPairingUrl(rawCertInput)) {
          await importPeerSyncBindingInput(rawCertInput);
        }
        const settingsNow = await loadSyncSettings();
        if (settingsNow.enabled && settingsNow.consentAccepted) {
          await announceLocalBindingToKnownPeers({
            ownerFingerprintHex: pairedDevice.ownerFingerprintHex,
          });
          await runDecentralizedSyncCycle();
        }
      } catch {
        // Non-blocking: offline pairing must never fail if sync fails
      }
      setCompletedDevice(pairedDevice);
      setCompletedViaInvite(false);
      setCertInspection(null);
      setCertInput('');
      setActiveRequestSession(null);
      await refreshAll();
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Failed to complete device pairing');
    }
  };

  const inspectIncomingRequestValue = async (rawValue: string) => {
    setApproveError(null);
    setReqInspection(null);
    setIssuedApproval(null);
    try {
      if (isPairingInviteInput(rawValue)) {
        inspectIncomingInviteValue(rawValue);
        return;
      }
      let parsedKind: ReturnType<typeof parsePairingQrInput> | null = null;
      try {
        parsedKind = parsePairingQrInput(rawValue);
      } catch {
        // Fall through to inspectPairingRequestForApproval for standard errors
      }
      if (parsedKind?.kind === 'enrollment-certificate') {
        throw new Error(t.devices.approveWrongTypeCert);
      }
      if (parsedKind?.kind === 'device-revocation') {
        throw new Error(t.devices.approveWrongTypeRevocation);
      }
      if (parsedKind?.kind === 'device-registry') {
        throw new Error(t.devices.step2WrongTypeRegistry);
      }

      const owner = authorKeys.find((k) => k.id === selectedAuthorKeyId);
      const inspected = await inspectPairingRequestForApproval({
        rawInput: rawValue,
        ownerPublicKeyBase64Url: owner?.publicKeyBase64Url,
        ownerFingerprintHex: owner?.fingerprintHex,
      });
      if (inspected.alreadyConsumed) {
        throw new Error('Replay blocked: this pairing request QR has already been used.');
      }
      if (inspected.expired) {
        throw new Error('This pairing request QR has expired. Generate a fresh QR on the new device.');
      }
      if (inspected.deviceRevoked) {
        throw new Error(t.devices.approveRevokedDeviceError);
      }
      if (inspected.alreadyRegisteredUnderOwner) {
        throw new Error(t.devices.approveAlreadyRegisteredError);
      }
      setReqInspection(inspected);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Invalid pairing request');
    }
  };

  const handleReqQrFileUpload = async (file: File | null) => {
    if (!file) return;
    setApproveError(null);
    setReqInspection(null);
    setIssuedApproval(null);
    try {
      const decoded = await decodeQrFromImageBytes(file);
      setIncomingReqInput(decoded);
      await inspectIncomingRequestValue(decoded);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to read pairing request QR image');
    }
  };

  const inspectIncomingInviteValue = useCallback((rawValue: string) => {
    setActiveTab('add');
    setReceivedInviteError(null);
    setReceivedInviteSentState(null);
    setCompletedDevice(null);
    setCompletedViaInvite(false);
    setDeviceNameInput((prev) => prev || suggestLocalDeviceName());
    try {
      const parsed = parseAndVerifyPairingInvite(rawValue);
      if (parsed.expired) {
        setReceivedInvite(null);
        setReceivedInviteError(tRef.current.devices.inviteExpiredError);
        return;
      }
      setReceivedInvite(parsed.invite);
    } catch (err) {
      setReceivedInvite(null);
      setReceivedInviteError(err instanceof Error ? err.message : 'Invalid pairing invitation QR');
    }
  }, []);

  const handleCreatePairingInvite = async () => {
    const owner = authorKeys.find((k) => k.id === selectedAuthorKeyId);
    if (!owner) return;
    setInviteError(null);
    setInviteRelayStatus(null);
    setInviteApprovalSent(false);
    setPendingInviteReply(null);
    setIssuedApproval(null);
    setReqInspection(null);
    activeInviteSession?.wipeSecrets();
    try {
      const settingsNow = await loadSyncSettings();
      const created = await createSignedPairingInvite({
        ownerPublicKey: owner.publicKey,
        ownerDisplayName: owner.label,
        signWithOwnerKey: (msg) => signWithAuthorKey(owner, msg, ownerPassphrase || undefined),
        relays: settingsNow.relays,
      });
      setActiveInviteSession(created);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to create pairing invitation QR');
    }
  };

  const handleClosePairingInvite = () => {
    activeInviteSession?.wipeSecrets();
    setActiveInviteSession(null);
    setInviteRelayStatus(null);
    setInviteError(null);
    setPendingInviteReply(null);
  };

  const pollInviteRequestOnce = useCallback(
    async (sessionOverride?: CreatedPairingInviteSession) => {
      const session = sessionOverride ?? activeInviteSession;
      if (!session) return;
      setInviteCheckingNow(true);
      try {
        const res = await getSyncTransport().fetchEnvelopesForRecipient({
          recipientPubkeyHex: session.inviteNostrPubkeyHex,
          relays: session.relays,
          localNostrSecretKey: session.inviteNostrSecretKey,
        });
        const { authorKeys: latestKeys, selectedAuthorKeyId: latestOwnerId } = latestOwnerRef.current;
        const owner = latestKeys.find((k) => k.id === latestOwnerId);
        for (const ev of res.events) {
          try {
            const decoded = unwrapAndVerifyInviteRequest({
              rawEvent: ev.rawEvent,
              expectedInvite: session.invite,
              inviteNostrSecretKey: session.inviteNostrSecretKey,
            });
            const inspected = await inspectPairingRequestForApproval({
              rawInput: decoded.requestToken,
              ownerPublicKeyBase64Url: owner?.publicKeyBase64Url,
              ownerFingerprintHex: owner?.fingerprintHex,
            });
            if (inspected.alreadyConsumed || inspected.expired || inspected.deviceRevoked) {
              continue;
            }
            if (inspected.alreadyRegisteredUnderOwner) {
              setApproveError(tRef.current.devices.approveAlreadyRegisteredError);
              continue;
            }
            if (!isMountedRef.current) return;
            setApproveError(null);
            setIncomingReqInput(decoded.requestToken);
            setReqInspection(inspected);
            setPendingInviteReply({
              inviteSession: session,
              replyNostrPubkeyHex: decoded.replyNostrPubkeyHex,
              requestHashHex: decoded.request.requestHashHex,
              syncBindingToken: decoded.syncBindingToken,
            });
            setInviteRelayStatus(tRef.current.devices.inviteReceivedFromRelayMsg);
            return;
          } catch {
            // Ignore malformed or unrelated events on public relays
          }
        }
      } catch {
        // Ignore transient relay polling failures; user can retry or use manual QR
      } finally {
        if (isMountedRef.current) {
          setInviteCheckingNow(false);
        }
      }
    },
    [activeInviteSession],
  );

  useEffect(() => {
    if (!activeInviteSession || reqInspection || issuedApproval) return;
    if (nowUnix > activeInviteSession.invite.expiresAt) return;
    const initTimer = window.setTimeout(() => {
      void pollInviteRequestOnce(activeInviteSession);
    }, 350);
    const interval = window.setInterval(() => {
      void pollInviteRequestOnce(activeInviteSession);
    }, 2500);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, [activeInviteSession, issuedApproval, nowUnix, pollInviteRequestOnce, reqInspection]);

  const handleAcceptAndSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedInvite) return;
    setReceivedInviteError(null);
    setReceivedInviteSending(true);
    try {
      const targetName = deviceNameInput.trim() || suggestLocalDeviceName();
      const res = await startDevicePairingRequestSession({
        deviceName: targetName,
        devicePassphrase: devicePassInput || undefined,
        ownerPublicKey: receivedInvite.ownerPublicKeyBase64Url,
        ownerFingerprintHex: receivedInvite.ownerFingerprintHex,
        autoReplaceIfRevoked: true,
      });

      const devicePubBytes = res.request.payload.devicePublicKey;
      const replyKeys = generateNostrKeypair([devicePubBytes, receivedInvite.ownerPublicKey]);
      const relays = toRelayConfigsFromUrls(receivedInvite.relays);

      let syncBindingToken: string | undefined;
      try {
        const settingsNow = await loadSyncSettings();
        if (settingsNow.enabled && settingsNow.consentAccepted) {
          const ensured = await ensureLocalBindingAttestation({
            deviceName: targetName,
            devicePassphrase: devicePassInput || undefined,
          });
          if (ensured.binding) {
            syncBindingToken = ensured.binding.token;
          }
        }
      } catch {
        // Optional peer sync card; never block pairing
      }

      const giftWrap = buildInviteRequestGiftWrap({
        invite: receivedInvite,
        request: res.request,
        replyNostrSecretKey: replyKeys.secretKey,
        syncBindingToken,
      });

      const pubRes = await getSyncTransport().publishEnvelopes({
        envelopes: [
          {
            id: res.session.requestIdHex,
            ownerFingerprintHex: receivedInvite.ownerFingerprintHex,
            recipientDeviceIdHex: receivedInvite.inviteIdHex,
            recipientNostrPubkeyHex: receivedInvite.ownerNostrPubkeyHex,
            opIdHex: res.session.requestIdHex,
            nostrEventJson: JSON.stringify(giftWrap),
          },
        ],
        relays,
        localNostrSecretKey: replyKeys.secretKey,
      });

      const confirmCode = computeConfirmationCodeForRequest(res.request);
      if (replyNostrSecretRef.current) {
        wipeBytes(replyNostrSecretRef.current);
      }
      setActiveRequestSession(res);
      setReceivedInviteSentState({
        session: res.session,
        request: res.request,
        replyNostrSecretKey: replyKeys.secretKey,
        replyNostrPubkeyHex: replyKeys.publicKeyHex,
        relays,
        confirmCode,
        relayAccepted: pubRes.succeededRelays > 0,
      });
      await refreshAll();
    } catch (err) {
      setReceivedInviteError(err instanceof Error ? err.message : 'Failed to send pairing request');
    } finally {
      if (isMountedRef.current) {
        setReceivedInviteSending(false);
      }
    }
  };

  const pollInviteCertOnce = useCallback(async () => {
    if (!receivedInvite || !receivedInviteSentState) return;
    try {
      const fetchRes = await getSyncTransport().fetchEnvelopesForRecipient({
        recipientPubkeyHex: receivedInviteSentState.replyNostrPubkeyHex,
        relays: receivedInviteSentState.relays,
        localNostrSecretKey: receivedInviteSentState.replyNostrSecretKey,
      });
      for (const ev of fetchRes.events) {
        try {
          const certMsg = unwrapAndVerifyInviteCert({
            rawEvent: ev.rawEvent,
            expectedInvite: receivedInvite,
            expectedRequest: receivedInviteSentState.request,
            replyNostrSecretKey: receivedInviteSentState.replyNostrSecretKey,
          });
          const { pairedDevice } = await completeDevicePairingWithCertificate({
            rawCertificateInput: certMsg.certificateToken,
            confirmOwnerTrust: true,
          });
          try {
            if (certMsg.syncBindingToken) {
              await importPeerSyncBindingInput(certMsg.syncBindingToken);
            }
            const settingsNow = await loadSyncSettings();
            if (settingsNow.enabled && settingsNow.consentAccepted) {
              await announceLocalBindingToKnownPeers({
                ownerFingerprintHex: pairedDevice.ownerFingerprintHex,
              });
              await runDecentralizedSyncCycle();
            }
          } catch {
            // Non-blocking sync hook
          }
          if (!isMountedRef.current) return;
          wipeBytes(receivedInviteSentState.replyNostrSecretKey);
          setCompletedDevice(pairedDevice);
          setCompletedViaInvite(true);
          setReceivedInvite(null);
          setReceivedInviteSentState(null);
          setActiveRequestSession(null);
          setCertInspection(null);
          setCertInput('');
          await refreshAll();
          return;
        } catch {
          // Ignore malformed/unrelated events
        }
      }
    } catch {
      // Transient relay failure; keep waiting
    }
  }, [receivedInvite, receivedInviteSentState, refreshAll]);

  useEffect(() => {
    if (!receivedInvite || !receivedInviteSentState || completedDevice) return;
    if (nowUnix > receivedInviteSentState.session.expiresAt) return;
    const initTimer = window.setTimeout(() => {
      void pollInviteCertOnce();
    }, 600);
    const interval = window.setInterval(() => {
      void pollInviteCertOnce();
    }, 2500);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, [completedDevice, nowUnix, pollInviteCertOnce, receivedInvite, receivedInviteSentState]);

  const handleApprovePairing = async () => {
    if (!reqInspection || !selectedAuthorKeyId) return;
    setApproveError(null);
    setInviteApprovalSent(false);
    try {
      const res = await approvePairingRequestAsOwner({
        rawRequestInput: reqInspection.request.token,
        authorKeyId: selectedAuthorKeyId,
        passphrase: ownerPassphrase || undefined,
      });
      let qrUrl = res.qrUrl;
      let ownerSyncBindingToken: string | undefined;
      try {
        const settingsNow = await loadSyncSettings();
        if (settingsNow.enabled && settingsNow.consentAccepted) {
          const ensured = await ensureLocalBindingAttestation({
            authorKeyId: selectedAuthorKeyId,
            ownerPassphrase: ownerPassphrase || undefined,
          });
          if (ensured.binding) {
            ownerSyncBindingToken = ensured.binding.token;
            qrUrl = attachSyncBindingToPairingUrl(res.qrUrl, ensured.binding);
          }
          if (pendingInviteReply?.syncBindingToken) {
            await importPeerSyncBindingInput(pendingInviteReply.syncBindingToken);
          }
          await recordAndBroadcastOwnerSyncMutation({
            authorKeyId: selectedAuthorKeyId,
            ownerPassphrase: ownerPassphrase || undefined,
            opKind: 'enroll-device',
            enrollmentCertificate: res.certificate,
          });
        }
      } catch {
        // Non-blocking: offline QR approval must never fail if sync fails
      }

      if (
        pendingInviteReply &&
        pendingInviteReply.requestHashHex === res.certificate.payload.requestHashHex
      ) {
        try {
          const certWrap = buildInviteCertGiftWrap({
            invite: pendingInviteReply.inviteSession.invite,
            certificate: res.certificate,
            inviteNostrSecretKey: pendingInviteReply.inviteSession.inviteNostrSecretKey,
            replyNostrPubkeyHex: pendingInviteReply.replyNostrPubkeyHex,
            syncBindingToken: ownerSyncBindingToken,
          });
          const pubRes = await getSyncTransport().publishEnvelopes({
            envelopes: [
              {
                id: res.certificate.payload.certIdHex,
                ownerFingerprintHex: res.certificate.payload.ownerFingerprintHex,
                recipientDeviceIdHex: res.certificate.payload.deviceIdHex,
                recipientNostrPubkeyHex: pendingInviteReply.replyNostrPubkeyHex,
                opIdHex: res.certificate.payload.certIdHex,
                nostrEventJson: JSON.stringify(certWrap),
              },
            ],
            relays: pendingInviteReply.inviteSession.relays,
            localNostrSecretKey: pendingInviteReply.inviteSession.inviteNostrSecretKey,
          });
          if (pubRes.succeededRelays > 0) {
            setInviteApprovalSent(true);
          }
        } catch {
          // Non-blocking: approval QR is still displayed for offline fallback
        } finally {
          pendingInviteReply.inviteSession.wipeSecrets();
          setPendingInviteReply(null);
          setActiveInviteSession(null);
          setInviteRelayStatus(null);
        }
      }

      setIssuedApproval({ ...res, qrUrl });
      setReqInspection(null);
      setIncomingReqInput('');
      setOwnerPassphrase('');
      await refreshAll();
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve pairing request');
    }
  };

  const handleConfirmOwnerTrust = async (key: string) => {
    setRegistryActionError(null);
    try {
      await confirmPairedOwnerTrust(key);
      await refreshAll();
    } catch (err) {
      setRegistryActionError(err instanceof Error ? err.message : 'Failed to confirm owner');
    }
  };

  const handleRevokeSubmit = async (device: PairedDeviceRecord) => {
    setRevokeError(null);
    setRemoveError(null);
    setDeviceListMsg(null);
    const matchingOwner = authorKeys.find((k) => k.fingerprintHex === device.ownerFingerprintHex);
    if (!matchingOwner) {
      setRevokeError('This browser does not hold the Owner root key needed to sign a revocation.');
      return;
    }
    try {
      const res = await revokePairedDevice({
        authorKeyId: matchingOwner.id,
        deviceIdHex: device.deviceIdHex,
        reason: revokeReason,
        note: revokeNote.trim() || undefined,
        passphrase: revokePassphrase || undefined,
      });
      try {
        const settingsNow = await loadSyncSettings();
        if (settingsNow.enabled && settingsNow.consentAccepted) {
          await recordAndBroadcastOwnerSyncMutation({
            authorKeyId: matchingOwner.id,
            ownerPassphrase: revokePassphrase || undefined,
            opKind: 'revoke-device',
            revocationNotice: res.revocation,
          });
        }
      } catch {
        // Non-blocking: offline revocation QR must always succeed
      }
      if (revokeAndRemove) {
        await removePairedDeviceEntry(device.key);
        setDeviceListMsg(`${t.devices.deviceRemovedMsg} (${device.deviceName})`);
      }
      setGeneratedRevocation(res);
      setRevokingKey(null);
      setRemovingKey(null);
      setRevokeAndRemove(false);
      setRevokeNote('');
      setRevokePassphrase('');
      await refreshAll();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke device');
    }
  };

  const handleRemoveDeviceSubmit = async (device: PairedDeviceRecord) => {
    setRemoveError(null);
    setDeviceListMsg(null);
    try {
      await removePairedDeviceEntry(device.key);
      setRemovingKey(null);
      if (revokingKey === device.key) {
        setRevokingKey(null);
      }
      setDeviceListMsg(`${t.devices.deviceRemovedMsg} (${device.deviceName})`);
      await refreshAll();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove device entry');
    }
  };

  const handleImportRevocation = async (raw: string) => {
    setImportRevError(null);
    setImportRevMsg(null);
    try {
      const rev = await importDeviceRevocationNotice(raw);
      setImportRevInput('');
      setImportRevMsg(`${t.devices.revocationImportedMsg} (${rev.payload.deviceFingerprintShort})`);
      await refreshAll();
    } catch (err) {
      setImportRevError(err instanceof Error ? err.message : 'Invalid revocation notice');
    }
  };

  const handleImportRevocationQrFile = async (file: File | null) => {
    if (!file) return;
    setImportRevError(null);
    setImportRevMsg(null);
    try {
      if (file.name.endsWith('.json') || file.type === 'application/json') {
        const text = await file.text();
        await handleImportRevocation(text);
        return;
      }
      const decoded = await decodeQrFromImageBytes(file);
      setImportRevInput(decoded);
      await handleImportRevocation(decoded);
    } catch (err) {
      setImportRevError(err instanceof Error ? err.message : 'Could not import revocation QR/file');
    }
  };

  const handleExportRegistry = async (format: 'json' | 'cbor') => {
    setRegistryActionError(null);
    setRegistryActionMsg(null);
    const ownerId = selectedAuthorKeyId || authorKeys[0]?.id;
    if (!ownerId) {
      setRegistryActionError('No local My ID found to sign the backup.');
      return;
    }
    try {
      const { snapshot, jsonString, cborBytes } = await exportSignedDeviceRegistry({
        authorKeyId: ownerId,
        passphrase: ownerPassphrase || undefined,
      });
      const prefix = `chm-devices-${snapshot.payload.ownerFingerprintHex.slice(0, 8)}`;
      if (format === 'json') {
        downloadBlob(new Blob([jsonString], { type: 'application/json' }), `${prefix}.chdevreg.json`);
      } else {
        downloadBlob(
          new Blob([new Uint8Array(cborBytes)], { type: 'application/cbor' }),
          `${prefix}.chdevreg.cbor`,
        );
      }
    } catch (err) {
      setRegistryActionError(err instanceof Error ? err.message : 'Failed to export signed registry');
    }
  };

  const handleImportRegistryFile = async (file: File | null) => {
    if (!file) return;
    setRegistryActionError(null);
    setRegistryActionMsg(null);
    setRegistryReconcileResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isJson = file.name.toLowerCase().endsWith('.json') || bytes[0] === 0x7b;
      const input: string | Uint8Array = isJson ? new TextDecoder('utf-8', { fatal: true }).decode(bytes) : bytes;
      const result = await importSignedDeviceRegistry(input);
      setRegistryReconcileResult(result);
      setRegistryActionMsg(t.devices.importRegistrySuccess);
      await refreshAll();
    } catch (err) {
      setRegistryActionError(err instanceof Error ? err.message : 'Failed to import signed device registry');
    }
  };

  const selectedOwnerKey = authorKeys.find((k) => k.id === selectedAuthorKeyId);
  const localDeviceActivePairings = localDevice
    ? pairedDevices.filter(
        (d) =>
          (d.devicePublicKeyBase64Url === localDevice.publicKeyBase64Url ||
            d.deviceIdHex === localDevice.deviceIdHex) &&
          d.localVerificationStatus !== 'revoked' &&
          d.localVerificationStatus !== 'conflict-revoked',
      )
    : [];
  const displayedSession =
    activeRequestSession?.session ?? (pendingSessions.length > 0 ? pendingSessions[0] : null);
  const displayedQrUrl = activeRequestSession?.qrUrl ?? displayedSession?.qrUrl ?? '';
  const displayedRequestExpired = displayedSession ? nowUnix > displayedSession.expiresAt : false;

  const displayedReqConfirmCode = displayedSession
    ? computePairingConfirmationCode({
        requestHash: hexToBytes(displayedSession.requestHashHex),
        nonce: hexToBytes(displayedSession.nonceHex),
        devicePublicKey: base64UrlDecode(displayedSession.devicePublicKeyBase64Url),
      })
    : null;
  const certInspectConfirmCode = certInspection
    ? computeConfirmationCodeForCertificate(certInspection.certificate)
    : null;
  const reqInspectConfirmCode = reqInspection
    ? computeConfirmationCodeForRequest(reqInspection.request)
    : null;
  const issuedApprovalConfirmCode = issuedApproval
    ? computeConfirmationCodeForCertificate(issuedApproval.certificate)
    : null;

  const localBindingMatch =
    localDevice && nostrKey
      ? peerBindings.find(
          (b) =>
            b.deviceIdHex === localDevice.deviceIdHex &&
            b.nostrPubkeyHex === nostrKey.nostrPubkeyHex &&
            (!selectedOwnerKey || b.ownerFingerprintHex === selectedOwnerKey.fingerprintHex),
        ) ??
        peerBindings.find(
          (b) =>
            b.deviceIdHex === localDevice.deviceIdHex &&
            b.nostrPubkeyHex === nostrKey.nostrPubkeyHex,
        )
      : undefined;
  const localBindingToken = localBindingMatch
    ? `${SYNC_BINDING_TOKEN_PREFIX}${localBindingMatch.bindingCborBase64Url}`
    : null;

  return (
    <div data-testid="devices-page" className="space-y-6 min-w-0">
      <header className="flex items-start justify-between gap-3 sm:gap-4 border-b border-[var(--ga-border)] pb-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-semibold ga-text break-words">
            {t.devices.title}
          </h1>
          <p className="text-xs sm:text-sm ga-text-muted leading-relaxed break-words">
            {t.devices.subtitle}
          </p>
        </div>

        <HelpIconButton
          label={t.devices.helpLabel}
          title={t.devices.helpTitle}
          closeLabel={t.minimal.home.closeHelp}
          testId="devices-help-btn"
          panelTestId="devices-help-panel"
        >
          <ul className="space-y-2 list-disc ps-4 text-xs ga-text-secondary leading-relaxed">
            {t.devices.helpPoints.map((pt, idx) => (
              <li key={idx}>{pt}</li>
            ))}
          </ul>
          <div className="ga-status-info rounded-xl border p-3 text-xs">
            {t.devices.noRootKeyCopyNote}
          </div>
        </HelpIconButton>
      </header>

      <SimpleModeBanner testId="devices-simple-mode-banner" />

      {corruptionWarnings.length > 0 && (
        <div
          role="alert"
          data-testid="pairing-corruption-warning"
          className="ga-status-error rounded-xl border p-4 space-y-2 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.devices.corruptRecordWarningTitle}</span>
          </div>
          <ul className="space-y-1.5">
            {corruptionWarnings.map((w, idx) => (
              <li
                key={`${w.store}:${w.recordKey}:${idx}`}
                className="ga-card-solid flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <span className="break-all">
                  {w.store} ({w.recordKey}): {w.reason}
                </span>
                <button
                  type="button"
                  data-testid="clear-corrupt-record-btn"
                  onClick={() =>
                    void clearCorruptDevicePairingRecord(w.store, w.recordKey).then(refreshAll)
                  }
                  className="ga-status-error rounded-md border px-2.5 py-1 text-[11px] font-medium hover:opacity-90 cursor-pointer"
                >
                  {t.devices.clearCorruptRecordBtn}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Identity Cards: My ID + This Device */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold ga-text flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{t.devices.myIdSectionTitle}</span>
            </h2>
            <Link
              to="/keys"
              className="text-xs font-medium text-[var(--ga-accent)] hover:text-[var(--ga-accent)] underline underline-offset-4 shrink-0"
            >
              {t.devices.goToKeysBackupBtn}
            </Link>
          </div>

          {authorKeys.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.myIdEmptyDesc}</p>
              <form onSubmit={handleQuickCreateAuthorKey} className="space-y-2.5">
                <label className="block text-xs font-medium ga-text-secondary">
                  {t.devices.quickCreateIdLabel}
                </label>
                <input
                  type="text"
                  value={quickIdName}
                  onChange={(e) => setQuickIdName(e.target.value)}
                  maxLength={64}
                  placeholder={t.devices.quickCreateIdPlaceholder}
                  data-testid="pairing-quick-myid-name"
                  className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                />
                <input
                  type="password"
                  value={quickIdPass}
                  onChange={(e) => setQuickIdPass(e.target.value)}
                  placeholder={t.devices.quickCreateIdPassPlaceholder}
                  data-testid="pairing-quick-myid-pass"
                  className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                />
                {quickIdError && <FriendlyErrorAlert error={quickIdError} onDismiss={() => setQuickIdError(null)} />}
                <button
                  type="submit"
                  data-testid="pairing-quick-myid-submit"
                  className="ga-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold min-h-[44px] cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  <span>{t.devices.quickCreateIdBtn}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              {authorKeys.map((k) => (
                <div
                  key={k.id}
                  data-testid="myid-summary-card"
                  className="ga-card-solid rounded-xl border px-3 py-2.5 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-sm ga-text">{k.label}</span>
                    <span className="ga-status-info rounded-full border px-2 py-0.5 text-[11px] font-medium">
                      {k.fingerprintShort}
                    </span>
                  </div>
                  <details className="text-[11px] ga-text-muted">
                    <summary className="cursor-pointer hover:text-[var(--ga-text)]">
                      {t.devices.technicalDetailsSummary}
                    </summary>
                    <div className="mt-1.5 space-y-1 font-mono break-all">
                      <div>
                        {t.devices.detailFingerprintFull}: {k.fingerprintHex}
                      </div>
                      <div>
                        {t.devices.detailPublicKey}: {k.publicKeyBase64Url}
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-3 min-w-0">
          <h2 className="text-base font-semibold ga-text flex items-center gap-2">
            <Laptop className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{t.devices.thisDeviceTitle}</span>
          </h2>

          {localDevice ? (
            <div className="space-y-2.5">
              <div className="ga-card-solid rounded-xl border px-3 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-sm ga-text" data-testid="local-device-name">
                    {localDevice.deviceName}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!localDevice.revokedLocally && localDeviceActivePairings.length > 0 && (
                      <span
                        data-testid="local-device-paired-badge"
                        className="ga-status-success rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      >
                        {t.devices.alreadyPairedBadge}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        localDevice.revokedLocally
                          ? 'ga-status-error'
                          : 'ga-status-info'
                      }`}
                    >
                      {localDevice.revokedLocally ? t.devices.statusRevoked : localDevice.fingerprintShort}
                    </span>
                  </div>
                </div>
                {!localDevice.revokedLocally && localDeviceActivePairings.length > 0 && (
                  <p className="text-[11px] text-[var(--ga-success-text)]">
                    {t.devices.alreadyPairedUnderOwnersLabel}:{' '}
                    {localDeviceActivePairings
                      .map((d) => `${d.ownerDisplayName} (${d.ownerFingerprintShort})`)
                      .join(', ')}
                  </p>
                )}
                <details className="text-[11px] ga-text-muted">
                  <summary className="cursor-pointer hover:text-[var(--ga-text)]">
                    {t.devices.technicalDetailsSummary}
                  </summary>
                  <div className="mt-1.5 space-y-1 font-mono break-all">
                    <div>
                      {t.devices.detailDeviceId}: {localDevice.deviceIdHex}
                    </div>
                    <div>
                      {t.devices.detailFingerprintFull}: {localDevice.fingerprintHex}
                    </div>
                    <div>
                      {t.devices.detailPublicKey}: {localDevice.publicKeyBase64Url}
                    </div>
                    <div>
                      {t.devices.detailStorageMode}: {localDevice.storageMode}
                    </div>
                  </div>
                </details>
              </div>

              {localDevice.revokedLocally ? (
                <div
                  role="alert"
                  data-testid="device-revoked-alert"
                  className="ga-status-error rounded-xl border p-3 space-y-2 text-xs"
                >
                  <p>{t.devices.thisDeviceRevokedAlert}</p>
                  <button
                    type="button"
                    data-testid="device-regenerate-btn"
                    onClick={() => void handleRegenerateDeviceIdentity()}
                    className="ga-status-error rounded-xl border px-3 py-2 text-xs font-semibold hover:opacity-90 min-h-[44px] cursor-pointer"
                  >
                    {t.devices.regenerateDeviceIdBtn}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="device-regenerate-btn"
                  onClick={() => void handleRegenerateDeviceIdentity()}
                  className="ga-btn-secondary rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                >
                  {t.devices.createSeparateDeviceIdBtn}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.step1Desc}</p>
          )}
        </section>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        className="flex flex-wrap gap-2 border-b border-[var(--ga-border)] pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'add'}
          data-testid="devices-tab-add"
          onClick={() => setActiveTab('add')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer transition-colors ${
            activeTab === 'add'
              ? 'bg-[var(--ga-primary-bg)] text-[var(--ga-primary-text)] border border-transparent'
              : 'ga-btn-secondary'
          }`}
        >
          <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.devices.addDeviceTab}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'approve'}
          data-testid="devices-tab-approve"
          onClick={() => setActiveTab('approve')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer transition-colors ${
            activeTab === 'approve'
              ? 'bg-[var(--ga-primary-bg)] text-[var(--ga-primary-text)] border border-transparent'
              : 'ga-btn-secondary'
          }`}
        >
          <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.devices.approveDeviceTab}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'registry'}
          data-testid="devices-tab-registry"
          onClick={() => setActiveTab('registry')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer transition-colors ${
            activeTab === 'registry'
              ? 'bg-[var(--ga-primary-bg)] text-[var(--ga-primary-text)] border border-transparent'
              : 'ga-btn-secondary'
          }`}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {t.devices.registryTab} ({pairedDevices.length})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sync'}
          data-testid="devices-tab-sync"
          onClick={() => setActiveTab('sync')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer transition-colors ${
            activeTab === 'sync'
              ? 'bg-[var(--ga-primary-bg)] text-[var(--ga-primary-text)] border border-transparent'
              : 'ga-btn-secondary'
          }`}
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.devices.sync.tabLabel}</span>
          {syncSettings.enabled && (
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                syncStatus.health === 'synced-observable'
                  ? 'bg-emerald-400'
                  : syncStatus.health === 'error-unreachable'
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
              }`}
            />
          )}
        </button>
      </div>

      {/* TAB 1: NEW DEVICE (STEP 1 + STEP 2) */}
      {activeTab === 'add' && (
        <div className="space-y-4 min-w-0">
          {completedDevice && completedViaInvite && (
            <div
              role="status"
              data-testid="pairing-completed-banner"
              className="ga-status-success rounded-xl border p-4 space-y-1.5 text-xs"
            >
              <div className="flex items-center gap-2 text-base font-semibold text-[var(--ga-success-text)]">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{t.devices.pairingCompletedTitle}</span>
              </div>
              <p>{t.devices.pairingCompletedDesc}</p>
              <p className="text-[11px] text-[var(--ga-success-text)]">
                {completedDevice.deviceName} · {completedDevice.ownerDisplayName} ({t.devices.ownerConfirmedBadge})
              </p>
            </div>
          )}

          {receivedInviteError && (
            <FriendlyErrorAlert
              error={receivedInviteError}
              testId="pairing-invite-accept-error"
              onDismiss={() => setReceivedInviteError(null)}
            />
          )}

          {receivedInvite && (
            <section
              data-testid="pairing-invite-accept-card"
              className="ga-card rounded-2xl border border-[var(--ga-border-strong)] p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold ga-text">{t.devices.inviteAcceptHeading}</h2>
                  <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.inviteAcceptDesc}</p>
                </div>
                <span className="ga-status-info rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                  {t.devices.requestExpiresIn}: {formatCountdown(receivedInvite.expiresAt, nowUnix)}
                </span>
              </div>

              <div className="ga-surface-subtle rounded-xl border border-[var(--ga-border)] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="ga-text-muted">{t.devices.inviteFromOwnerLabel}</span>
                <span className="font-semibold text-[var(--ga-accent)]">
                  {receivedInvite.ownerDisplayName} ({receivedInvite.ownerFingerprintShort})
                </span>
              </div>

              {localDeviceActivePairings.some(
                (d) => d.ownerFingerprintHex === receivedInvite.ownerFingerprintHex,
              ) && (
                <p
                  role="note"
                  className="ga-status-warning rounded-xl border px-3 py-2 text-xs"
                >
                  {t.devices.inviteAlreadyPairedNote}
                </p>
              )}

              {!receivedInviteSentState ? (
                <form onSubmit={handleAcceptAndSendInvite} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium ga-text-secondary mb-1">
                      {t.devices.deviceNameLabel}
                    </label>
                    <input
                      type="text"
                      value={deviceNameInput}
                      onChange={(e) => setDeviceNameInput(e.target.value)}
                      maxLength={64}
                      placeholder={t.devices.deviceNamePlaceholder}
                      data-testid="invite-device-name-input"
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    />
                  </div>

                  {!webCryptoSupported && (
                    <div>
                      <label className="block text-xs font-medium ga-text-secondary mb-1">
                        {t.devices.devicePassLabel}
                      </label>
                      <input
                        type="password"
                        value={devicePassInput}
                        onChange={(e) => setDevicePassInput(e.target.value)}
                        placeholder={t.devices.devicePassPlaceholder}
                        className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                      />
                    </div>
                  )}

                  <p className="text-[11px] ga-text-muted leading-relaxed">
                    {t.devices.inviteRelayNotice}
                  </p>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="submit"
                      disabled={receivedInviteSending || nowUnix > receivedInvite.expiresAt}
                      data-testid="invite-accept-send-btn"
                      className="ga-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {receivedInviteSending ? t.devices.inviteSendingBtn : t.devices.inviteAcceptSendBtn}
                      </span>
                    </button>
                    <button
                      type="button"
                      data-testid="invite-accept-dismiss-btn"
                      onClick={() => {
                        setReceivedInvite(null);
                        setReceivedInviteError(null);
                      }}
                      className="ga-btn-secondary inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-medium min-h-[44px] cursor-pointer"
                    >
                      {t.devices.inviteCancelReceiveBtn}
                    </button>
                  </div>
                </form>
              ) : (
                <div data-testid="invite-sent-waiting-panel" className="space-y-3">
                  <div className="ga-status-info rounded-xl border p-3.5 space-y-2 text-xs">
                    <div className="font-semibold text-sm text-[var(--ga-accent)] flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                      <span>{t.devices.inviteSentWaitingTitle}</span>
                    </div>
                    <p className="ga-text-secondary leading-relaxed">{t.devices.inviteSentWaitingDesc}</p>
                    <div className="ga-surface-subtle rounded-xl border border-[var(--ga-border-strong)] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="ga-text-muted">{t.devices.sync.confirmationCodeLabel}:</span>
                      <span
                        data-testid="invite-sent-confirm-code"
                        className="font-mono text-base font-bold tracking-wider text-[var(--ga-accent)]"
                      >
                        {receivedInviteSentState.confirmCode}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="invite-wait-check-btn"
                      onClick={() => void pollInviteCertOnce()}
                      className="ga-status-info inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:opacity-90 min-h-[44px] cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.devices.inviteCheckNowBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        wipeBytes(receivedInviteSentState.replyNostrSecretKey);
                        setReceivedInviteSentState(null);
                        setReceivedInvite(null);
                      }}
                      className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                    >
                      <span>{t.devices.inviteCancelReceiveBtn}</span>
                    </button>
                  </div>

                  <details className="text-xs ga-text-secondary">
                    <summary className="cursor-pointer hover:text-[var(--ga-text)]">
                      {t.devices.inviteManualFallbackSummary}
                    </summary>
                    <p className="mt-2 text-[11px] ga-text-muted">
                      {t.devices.step2NewDesc}
                    </p>
                  </details>
                </div>
              )}
            </section>
          )}
          {authorKeys.length > 0 && localDeviceActivePairings.length === 0 && (
            <div
              role="note"
              data-testid="owner-in-add-tab-hint"
              className="ga-status-info rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed"
            >
              <span className="flex-1 min-w-[240px]">{t.devices.ownerInAddTabHint}</span>
              <button
                type="button"
                data-testid="owner-switch-to-approve-btn"
                onClick={() => setActiveTab('approve')}
                className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] cursor-pointer shrink-0"
              >
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.devices.switchToApproveTabBtn}</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Step 1 */}
          <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-4 min-w-0">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold ga-text">{t.devices.step1Heading}</h2>
              <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.step1Desc}</p>
            </div>

            {localDevice && !localDevice.revokedLocally && localDeviceActivePairings.length > 0 && (
              <div
                role="note"
                data-testid="pairing-already-paired-note"
                className="ga-status-info rounded-xl border p-3 text-xs leading-relaxed"
              >
                {t.devices.alreadyPairedStep1Note}
              </div>
            )}

            <form onSubmit={handleStartPairingSession} className="space-y-3">
              <div>
                <label className="block text-xs font-medium ga-text-secondary mb-1">
                  {t.devices.deviceNameLabel}
                </label>
                <input
                  type="text"
                  value={deviceNameInput}
                  onChange={(e) => setDeviceNameInput(e.target.value)}
                  maxLength={64}
                  placeholder={t.devices.deviceNamePlaceholder}
                  data-testid="pairing-device-name-input"
                  className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                />
              </div>

              {!webCryptoSupported && (
                <div>
                  <label className="block text-xs font-medium ga-text-secondary mb-1">
                    {t.devices.devicePassLabel}
                  </label>
                  <input
                    type="password"
                    value={devicePassInput}
                    onChange={(e) => setDevicePassInput(e.target.value)}
                    placeholder={t.devices.devicePassPlaceholder}
                    data-testid="pairing-device-pass-input"
                    className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                  />
                </div>
              )}

              {step1Error && (
                <FriendlyErrorAlert
                  error={step1Error}
                  testId="pairing-step1-error"
                  onDismiss={() => setStep1Error(null)}
                />
              )}

              <button
                type="submit"
                disabled={Boolean(localDevice?.revokedLocally)}
                data-testid="pairing-create-req-btn"
                className="ga-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
                <span>{t.devices.generateRequestQrBtn}</span>
              </button>
            </form>

            {displayedSession && displayedQrUrl && (
              <div
                data-testid="pairing-request-qr-panel"
                className="ga-card-solid rounded-xl border border-[var(--ga-border-strong)] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold ga-text">{t.devices.requestQrTitle}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      displayedRequestExpired
                        ? 'ga-status-error border'
                        : 'ga-status-info border'
                    }`}
                  >
                    {displayedRequestExpired
                      ? t.devices.requestExpiredBadge
                      : `${t.devices.requestExpiresIn}: ${formatCountdown(displayedSession.expiresAt, nowUnix)}`}
                  </span>
                </div>

                <QrCodeDisplay
                  value={displayedQrUrl}
                  alt={t.devices.requestQrTitle}
                />

                {displayedReqConfirmCode && (
                  <div className="ga-surface-subtle rounded-xl border border-[var(--ga-border-strong)] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="ga-text-muted">{t.devices.sync.confirmationCodeLabel}: </span>
                      <span
                        data-testid="pairing-req-confirm-code"
                        className="font-mono font-bold tracking-wider text-[var(--ga-accent)] text-sm"
                      >
                        {displayedReqConfirmCode}
                      </span>
                    </div>
                    <span className="text-[11px] ga-text-muted">
                      {t.devices.sync.confirmationCodeHint}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={displayedQrUrl}
                    data-testid="pairing-req-url-input"
                    aria-label={t.devices.requestQrTitle}
                    className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono ga-text-secondary"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="pairing-req-download-qr"
                      onClick={() =>
                        downloadQrPngFile(
                          displayedQrUrl,
                          `chm-pair-request-${displayedSession.deviceIdHex.slice(0, 8)}.png`,
                        )
                      }
                      className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.devices.downloadQrPngBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopy('req-url', displayedQrUrl)}
                      className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                    >
                      {copiedKey === 'req-url' ? (
                        <Check className="h-3.5 w-3.5 text-[var(--ga-success-text)]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedKey === 'req-url' ? t.devices.copiedMsg : t.devices.copyUrlBtn}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="pairing-cancel-req-btn"
                      onClick={() => void handleCancelPairingRequest(displayedSession.requestIdHex)}
                      className="ga-status-error inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:opacity-90 min-h-[44px] cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.devices.cancelRequestBtn}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Step 2 on New Device */}
          <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-4 min-w-0">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold ga-text">{t.devices.step2NewHeading}</h2>
              <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.step2NewDesc}</p>
            </div>

            {completedDevice && !completedViaInvite && (
              <div
                role="status"
                data-testid="pairing-completed-banner"
                className="ga-status-success rounded-xl border p-4 space-y-1.5 text-xs"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ga-success-text)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.devices.pairingCompletedTitle}</span>
                </div>
                <p>{t.devices.pairingCompletedDesc}</p>
                <p className="text-[11px] text-[var(--ga-success-text)]">
                  {completedDevice.deviceName} · {completedDevice.ownerDisplayName} (
                  {completedDevice.localVerificationStatus === 'active-trusted'
                    ? t.devices.ownerConfirmedBadge
                    : t.devices.statusActiveUnverified}
                  )
                </p>
              </div>
            )}

            <div className="ga-surface-subtle rounded-xl border border-[var(--ga-border)] p-3 space-y-3">
              <QrCameraScanner
                startLabel={t.devices.scanCameraBtn}
                stopLabel={t.devices.stopCameraBtn}
                hint={t.devices.cameraHint}
                errorText={t.devices.cameraDeniedFallbackMsg}
                onDetected={(text) => {
                  setCertInput(text);
                  void inspectCertValue(text);
                }}
              />

              <div className="pt-2 border-t border-[var(--ga-border)] space-y-2">
                <label htmlFor={certUploadId} className="block text-xs font-medium ga-text-secondary">
                  {t.devices.uploadQrImageLabel}
                </label>
                <input
                  id={certUploadId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  data-testid="pairing-cert-file-input"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] ?? null;
                    e.currentTarget.value = '';
                    void handleCertQrFileUpload(file);
                  }}
                  className="block w-full text-xs ga-text-secondary file:mr-3 file:rounded-lg file:border file:border-[var(--ga-border-strong)] file:bg-[var(--ga-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--ga-text)] hover:file:opacity-90"
                />
              </div>

              <div className="pt-2 border-t border-[var(--ga-border)] space-y-2">
                <label className="block text-xs font-medium ga-text-secondary">
                  {t.devices.pasteInputLabel}
                </label>
                <textarea
                  rows={2}
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  placeholder={t.devices.pasteInputPlaceholder}
                  data-testid="pairing-cert-text-input"
                  className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
                />
                <button
                  type="button"
                  data-testid="pairing-cert-inspect-btn"
                  onClick={() => void inspectCertValue(certInput)}
                  className="ga-status-info inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold hover:opacity-90 min-h-[44px] cursor-pointer"
                >
                  <span>{t.devices.verifyCertBtn}</span>
                </button>
              </div>
            </div>

            {step2StatusMsg && (
              <p role="status" data-testid="pairing-step2-status" className="text-xs text-[var(--ga-success-text)]">
                {step2StatusMsg}
              </p>
            )}

            {step2Error && (
              <div
                role="alert"
                data-testid="pairing-step2-error"
                className="ga-status-error rounded-xl border p-3.5 space-y-2 text-xs leading-relaxed"
              >
                <p>{step2Error}</p>
                {step2WrongTypeKind === 'pairing-request-owner' && step2WrongReqRaw && (
                  <button
                    type="button"
                    data-testid="step2-switch-to-approve-btn"
                    onClick={() => {
                      const req = step2WrongReqRaw;
                      setActiveTab('approve');
                      setIncomingReqInput(req);
                      setStep2Error(null);
                      setStep2WrongTypeKind(null);
                      setStep2WrongReqRaw(null);
                      void inspectIncomingRequestValue(req);
                    }}
                    className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold min-h-[36px] cursor-pointer"
                  >
                    <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.devices.sendToApproveTabBtn}</span>
                  </button>
                )}
              </div>
            )}

            {certInspection && (
              <div
                data-testid="pairing-cert-preview"
                className="ga-card-solid rounded-xl border border-[var(--ga-border-strong)] p-4 space-y-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-sm ga-text">
                    {certInspection.certificate.payload.ownerDisplayName} (
                    {certInspection.certificate.payload.ownerFingerprintShort})
                  </div>
                  <div className="ga-text-secondary">
                    {t.devices.confirmDeviceNameLabel}:{' '}
                    {certInspection.certificate.payload.deviceDisplayName}
                  </div>
                  <div className="ga-text-secondary">
                    {t.devices.confirmPermissionLabel}: {t.devices.confirmPermissionValue}
                  </div>
                  {certInspectConfirmCode && (
                    <div className="pt-1 ga-text-secondary">
                      {t.devices.sync.confirmationCodeLabel}:{' '}
                      <span
                        data-testid="pairing-cert-confirm-code"
                        className="font-mono font-bold tracking-wider text-[var(--ga-accent)]"
                      >
                        {certInspectConfirmCode}
                      </span>
                    </div>
                  )}
                </div>

                {certInspection.requiresOwnerTrustConfirmation ? (
                  <div className="ga-status-warning rounded-xl border p-3 space-y-2 text-xs">
                    <p>{t.devices.ownerUnverifiedWarning}</p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmOwnerChecked}
                        onChange={(e) => setConfirmOwnerChecked(e.target.checked)}
                        data-testid="pairing-confirm-owner-checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-500"
                      />
                      <span>{t.devices.confirmOwnerCheckbox}</span>
                    </label>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 ga-status-success rounded-full border px-3 py-1 text-xs font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.devices.ownerConfirmedBadge}</span>
                  </div>
                )}

                <details className="text-[11px] ga-text-muted">
                  <summary className="cursor-pointer hover:text-[var(--ga-text)]">
                    {t.devices.technicalDetailsSummary}
                  </summary>
                  <div className="mt-1.5 space-y-1 font-mono break-all">
                    <div>
                      {t.devices.detailProtocol}: {certInspection.certificate.payload.protocol}
                    </div>
                    <div>
                      Owner FP: {certInspection.certificate.payload.ownerFingerprintHex}
                    </div>
                    <div>
                      Device PK: {certInspection.certificate.payload.devicePublicKeyBase64Url}
                    </div>
                  </div>
                </details>

                <button
                  type="button"
                  data-testid="pairing-complete-btn"
                  onClick={() => void handleCompletePairing()}
                  className="ga-btn-primary w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{t.devices.completePairingBtn}</span>
                </button>
              </div>
            )}
          </section>
          </div>
        </div>
      )}

      {/* TAB 2: EXISTING OWNER DEVICE APPROVAL */}
      {activeTab === 'approve' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-4 min-w-0">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold ga-text">{t.devices.approveHeading}</h2>
              <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.approveDesc}</p>
            </div>

            {authorKeys.length === 0 && (
              <div
                role="alert"
                data-testid="approve-no-owner-alert"
                className="ga-status-warning rounded-xl border p-3.5 space-y-2.5 text-xs leading-relaxed"
              >
                <div className="flex items-start gap-2 font-semibold text-[var(--ga-warning-text)]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{t.devices.approveNoOwnerTitle}</span>
                </div>
                <p className="opacity-90">{t.devices.approveNoOwnerDesc}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="approve-no-owner-go-add-btn"
                    onClick={() => setActiveTab('add')}
                    className="inline-flex items-center gap-1.5 ga-btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold min-h-[36px] cursor-pointer"
                  >
                    <span>{t.devices.approveNoOwnerGoAddBtn}</span>
                  </button>
                  <Link
                    to="/keys"
                    data-testid="approve-no-owner-go-keys-link"
                    className="inline-flex items-center gap-1.5 ga-btn-secondary rounded-xl px-3 py-1.5 text-xs font-medium min-h-[36px]"
                  >
                    <span>{t.devices.approveNoOwnerGoKeysBtn}</span>
                  </Link>
                </div>
              </div>
            )}

            {authorKeys.length > 0 && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-medium ga-text-secondary mb-1">
                    {t.devices.selectOwnerIdLabel}
                  </label>
                  <select
                    value={selectedAuthorKeyId}
                    onChange={(e) => setSelectedAuthorKeyId(e.target.value)}
                    data-testid="pairing-owner-select"
                    className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                  >
                    {authorKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.fingerprintShort})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOwnerKey?.storageMode === 'noble-encrypted-seed' && (
                  <div>
                    <label className="block text-xs font-medium ga-text-secondary mb-1">
                      {t.devices.ownerPassphraseLabel}
                    </label>
                    <input
                      type="password"
                      value={ownerPassphrase}
                      onChange={(e) => setOwnerPassphrase(e.target.value)}
                      placeholder={t.devices.ownerPassphrasePlaceholder}
                      data-testid="pairing-owner-passphrase"
                      className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                    />
                  </div>
                )}
              </div>
            )}

            {authorKeys.length > 0 && (
              <div
                data-testid="pairing-invite-card"
                className="ga-surface-subtle rounded-xl border border-[var(--ga-border-strong)] p-4 space-y-3"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold ga-text flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
                    <span>{t.devices.inviteSectionTitle}</span>
                  </h3>
                  <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.inviteSectionDesc}</p>
                </div>

                {inviteError && (
                  <FriendlyErrorAlert
                    error={inviteError}
                    testId="pairing-invite-error"
                    onDismiss={() => setInviteError(null)}
                  />
                )}

                {!activeInviteSession ? (
                  <button
                    type="button"
                    data-testid="pairing-create-invite-btn"
                    onClick={() => void handleCreatePairingInvite()}
                    className="ga-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
                  >
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    <span>{t.devices.createInviteQrBtn}</span>
                  </button>
                ) : (
                  <div
                    data-testid="pairing-invite-qr-panel"
                    className="ga-card-solid rounded-xl border border-[var(--ga-border-strong)] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold ga-text">{t.devices.inviteQrTitle}</h4>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          nowUnix > activeInviteSession.invite.expiresAt
                            ? 'ga-status-error border'
                            : 'ga-status-info border'
                        }`}
                      >
                        {nowUnix > activeInviteSession.invite.expiresAt
                          ? t.devices.requestExpiredBadge
                          : `${t.devices.requestExpiresIn}: ${formatCountdown(activeInviteSession.invite.expiresAt, nowUnix)}`}
                      </span>
                    </div>

                    <QrCodeDisplay
                      value={activeInviteSession.qrUrl}
                      alt={t.devices.inviteQrTitle}
                    />

                    <p
                      role="status"
                      data-testid="pairing-invite-status"
                      className="text-xs text-[var(--ga-accent)] leading-relaxed flex items-center gap-2"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 shrink-0 ${inviteCheckingNow && !inviteRelayStatus ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{inviteRelayStatus ?? t.devices.inviteWaitingStatus}</span>
                    </p>

                    <input
                      type="text"
                      readOnly
                      value={activeInviteSession.qrUrl}
                      data-testid="pairing-invite-url-input"
                      aria-label={t.devices.inviteQrTitle}
                      className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono ga-text-secondary"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid="pairing-invite-check-btn"
                        onClick={() => void pollInviteRequestOnce()}
                        className="ga-status-info inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:opacity-90 min-h-[44px] cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.devices.inviteCheckNowBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          downloadQrPngFile(
                            activeInviteSession.qrUrl,
                            `chm-pair-invite-${activeInviteSession.invite.inviteIdHex.slice(0, 8)}.png`,
                          )
                        }
                        className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.devices.downloadQrPngBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCopy('invite-url', activeInviteSession.qrUrl)}
                        className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                      >
                        {copiedKey === 'invite-url' ? (
                          <Check className="h-3.5 w-3.5 text-[var(--ga-success-text)]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedKey === 'invite-url' ? t.devices.copiedMsg : t.devices.copyUrlBtn}</span>
                      </button>

                      <button
                        type="button"
                        data-testid="pairing-invite-cancel-btn"
                        onClick={handleClosePairingInvite}
                        className="ga-status-error inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:opacity-90 min-h-[44px] cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.devices.cancelInviteBtn}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-[11px] font-medium ga-text-muted pt-1">
              {t.devices.inviteManualDivider}
            </div>

            <div className="ga-surface-subtle rounded-xl border border-[var(--ga-border)] p-3 space-y-3">
              <QrCameraScanner
                startLabel={t.devices.scanCameraBtn}
                stopLabel={t.devices.stopCameraBtn}
                hint={t.devices.approveCameraHint}
                errorText={t.devices.cameraDeniedFallbackMsg}
                onDetected={(text) => {
                  setIncomingReqInput(text);
                  void inspectIncomingRequestValue(text);
                }}
              />

              <div className="pt-2 border-t border-[var(--ga-border)] space-y-2">
                <label htmlFor={reqUploadId} className="block text-xs font-medium ga-text-secondary">
                  {t.devices.uploadQrImageLabel}
                </label>
                <input
                  id={reqUploadId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  data-testid="pairing-req-upload-input"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] ?? null;
                    e.currentTarget.value = '';
                    void handleReqQrFileUpload(file);
                  }}
                  className="block w-full text-xs ga-text-secondary file:mr-3 file:rounded-lg file:border file:border-[var(--ga-border-strong)] file:bg-[var(--ga-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--ga-text)] hover:file:opacity-90"
                />
              </div>

              <div className="pt-2 border-t border-[var(--ga-border)] space-y-2">
                <label className="block text-xs font-medium ga-text-secondary">
                  {t.devices.pasteInputLabel}
                </label>
                <textarea
                  rows={2}
                  value={incomingReqInput}
                  onChange={(e) => setIncomingReqInput(e.target.value)}
                  placeholder={t.devices.pasteInputPlaceholder}
                  data-testid="pairing-req-paste-input"
                  className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
                />
                <button
                  type="button"
                  data-testid="pairing-req-inspect-btn"
                  onClick={() => void inspectIncomingRequestValue(incomingReqInput)}
                  className="ga-status-info inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold hover:opacity-90 min-h-[44px] cursor-pointer"
                >
                  <span>{t.devices.verifyCertBtn}</span>
                </button>
              </div>
            </div>

            {approveError && (
              <p role="alert" data-testid="pairing-approve-error" className="ga-status-error rounded-xl border p-3 text-xs leading-relaxed">
                {approveError}
              </p>
            )}
          </section>

          <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-4 min-w-0">
            {reqInspection && (
              <div
                data-testid="pairing-approve-confirm-card"
                className="ga-card-solid rounded-xl border border-[var(--ga-border-strong)] p-4 space-y-4"
              >
                <h3 className="text-base font-semibold ga-text">
                  {t.devices.confirmDialogTitlePrefix}
                  {reqInspection.request.payload.deviceDisplayName}
                  {t.devices.confirmDialogTitleSuffix}
                </h3>

                <dl className="space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--ga-border)] pb-1.5">
                    <dt className="ga-text-muted">{t.devices.confirmDeviceNameLabel}</dt>
                    <dd className="font-semibold ga-text">
                      {reqInspection.request.payload.deviceDisplayName}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--ga-border)] pb-1.5">
                    <dt className="ga-text-muted">{t.devices.confirmOwnerIdLabel}</dt>
                    <dd className="font-semibold text-[var(--ga-accent)]">
                      {selectedOwnerKey
                        ? `${selectedOwnerKey.label} (${selectedOwnerKey.fingerprintShort})`
                        : t.devices.myIdEmptyDesc}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--ga-border)] pb-1.5">
                    <dt className="ga-text-muted">{t.devices.confirmPermissionLabel}</dt>
                    <dd className="ga-text-secondary">{t.devices.confirmPermissionValue}</dd>
                  </div>
                  {reqInspectConfirmCode && (
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="ga-text-muted">{t.devices.sync.confirmationCodeLabel}</dt>
                      <dd
                        data-testid="pairing-approve-confirm-code"
                        className="font-mono font-bold tracking-wider text-[var(--ga-accent)] text-sm"
                      >
                        {reqInspectConfirmCode}
                      </dd>
                    </div>
                  )}
                </dl>

                <details className="text-[11px] ga-text-muted">
                  <summary className="cursor-pointer hover:text-[var(--ga-text)]">
                    {t.devices.technicalDetailsSummary}
                  </summary>
                  <div className="mt-1.5 space-y-1 font-mono break-all">
                    <div>
                      {t.devices.detailFingerprintShort}:{' '}
                      {reqInspection.request.payload.deviceFingerprintShort}
                    </div>
                    <div>
                      {t.devices.detailFingerprintFull}:{' '}
                      {reqInspection.request.payload.deviceFingerprintHex}
                    </div>
                    <div>
                      {t.devices.detailPublicKey}:{' '}
                      {reqInspection.request.payload.devicePublicKeyBase64Url}
                    </div>
                    <div>
                      {t.devices.detailProtocol}: {reqInspection.request.payload.protocol}
                    </div>
                  </div>
                </details>

                {!selectedAuthorKeyId && (
                  <div
                    role="alert"
                    data-testid="approve-card-no-owner-warning"
                    className="ga-status-warning rounded-xl border p-3 space-y-2 text-xs leading-relaxed"
                  >
                    <p className="font-semibold text-[var(--ga-warning-text)]">{t.devices.approveNoOwnerTitle}</p>
                    <p>{t.devices.approveNoOwnerDesc}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('add')}
                        className="inline-flex items-center gap-1.5 ga-btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold min-h-[36px] cursor-pointer"
                      >
                        <span>{t.devices.approveNoOwnerGoAddBtn}</span>
                      </button>
                      <Link
                        to="/keys"
                        className="inline-flex items-center gap-1.5 ga-btn-secondary rounded-xl px-3 py-1.5 text-xs font-medium min-h-[36px]"
                      >
                        <span>{t.devices.approveNoOwnerGoKeysBtn}</span>
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={!selectedAuthorKeyId}
                    data-testid="pairing-approve-confirm-btn"
                    onClick={() => void handleApprovePairing()}
                    className="flex-1 ga-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>{t.devices.confirmApproveBtn}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="pairing-approve-cancel-btn"
                    onClick={() => {
                      setPendingInviteReply(null);
                      setReqInspection(null);
                      setIncomingReqInput('');
                    }}
                    className="ga-btn-secondary inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer"
                  >
                    {t.devices.confirmCancelBtn}
                  </button>
                </div>
              </div>
            )}

            {issuedApproval && (
              <div
                data-testid="pairing-approval-qr-panel"
                className="ga-card-solid rounded-xl border border-[var(--ga-success-border)] p-4 space-y-3"
              >
                {inviteApprovalSent && (
                  <div
                    role="status"
                    data-testid="pairing-invite-sent-banner"
                    className="ga-status-success rounded-xl border p-3 text-xs font-medium"
                  >
                    {t.devices.inviteApprovalSentMsg}
                  </div>
                )}

                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[var(--ga-success-text)]">
                    {t.devices.approvalQrReadyTitle}
                  </h3>
                  <p className="text-xs ga-text-secondary">{t.devices.approvalQrReadyDesc}</p>
                </div>

                <QrCodeDisplay
                  value={issuedApproval.qrUrl}
                  alt={t.devices.approvalQrReadyTitle}
                />

                {issuedApprovalConfirmCode && (
                  <div className="ga-status-success rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="ga-text-muted">{t.devices.sync.confirmationCodeLabel}: </span>
                      <span
                        data-testid="pairing-approval-confirm-code"
                        className="font-mono font-bold tracking-wider text-[var(--ga-success-text)] text-sm"
                      >
                        {issuedApprovalConfirmCode}
                      </span>
                    </div>
                    <span className="text-[11px] ga-text-muted">
                      {t.devices.sync.confirmationCodeHint}
                    </span>
                  </div>
                )}

                <input
                  type="text"
                  readOnly
                  value={issuedApproval.qrUrl}
                  data-testid="pairing-cert-url-output"
                  aria-label={t.devices.approvalQrReadyTitle}
                  className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono ga-text-secondary"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="pairing-cert-download-qr"
                    onClick={() =>
                      downloadQrPngFile(
                        issuedApproval.qrUrl,
                        `chm-pair-approval-${issuedApproval.pairedDevice.deviceIdHex.slice(0, 8)}.png`,
                      )
                    }
                    className="ga-status-success inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:opacity-90 min-h-[44px] cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.devices.downloadQrPngBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopy('cert-url', issuedApproval.qrUrl)}
                    className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                  >
                    {copiedKey === 'cert-url' ? (
                      <Check className="h-3.5 w-3.5 text-[var(--ga-success-text)]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedKey === 'cert-url' ? t.devices.copiedMsg : t.devices.copyUrlBtn}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="pairing-approve-next-btn"
                    onClick={() => {
                      setIssuedApproval(null);
                      setInviteApprovalSent(false);
                      setReqInspection(null);
                      setIncomingReqInput('');
                      setApproveError(null);
                    }}
                    className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                  >
                    <span>{t.devices.approveNextDeviceBtn}</span>
                  </button>
                </div>
              </div>
            )}

            {!reqInspection && !issuedApproval && (
              <div className="ga-surface-subtle rounded-xl border border-dashed border-[var(--ga-border-strong)] p-6 text-center text-xs ga-text-muted">
                {t.devices.approveDesc}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: DEVICE REGISTRY, REVOCATION & BACKUP */}
      {activeTab === 'registry' && (
        <div className="space-y-6 min-w-0">
          <div
            role="note"
            data-testid="pairing-offline-warning"
            className="ga-status-warning rounded-xl border px-4 py-3 flex items-start gap-2.5 text-xs leading-relaxed"
          >
            <AlertTriangle className="h-4 w-4 text-[var(--ga-warning-text)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.devices.offlineSyncWarning}</span>
          </div>

          <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-4 min-w-0">
            <h2 className="text-lg font-semibold ga-text">{t.devices.registeredDevicesTitle}</h2>

            {removeError && (
              <FriendlyErrorAlert
                error={removeError}
                testId="device-list-error-msg"
                onDismiss={() => setRemoveError(null)}
              />
            )}
            {deviceListMsg && (
              <p role="status" data-testid="device-list-status-msg" className="text-xs text-[var(--ga-success-text)]">
                {deviceListMsg}
              </p>
            )}

            {pairedDevices.length === 0 ? (
              <p className="text-sm ga-text-muted">{t.devices.noDevicesYet}</p>
            ) : (
              <div className="space-y-3">
                {pairedDevices.map((d) => {
                  const canSignRevocation = authorKeys.some(
                    (k) => k.fingerprintHex === d.ownerFingerprintHex,
                  );
                  const isRevoked =
                    d.localVerificationStatus === 'revoked' ||
                    d.localVerificationStatus === 'conflict-revoked';
                  const ownerKeyForDevice = authorKeys.find(
                    (k) => k.fingerprintHex === d.ownerFingerprintHex,
                  );
                  const isThisBrowserDevice =
                    localDevice?.publicKeyBase64Url === d.devicePublicKeyBase64Url;

                  return (
                    <div
                      key={d.key}
                      data-testid="paired-device-card"
                      className="ga-card-solid rounded-xl border p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold ga-text">{d.deviceName}</span>
                          {isThisBrowserDevice && (
                            <span className="ga-status-info rounded-full border px-2 py-0.5 text-[11px] font-medium">
                              {t.devices.thisDeviceTitle}
                            </span>
                          )}
                          <span
                            data-testid="paired-device-status"
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              d.localVerificationStatus === 'active-trusted'
                                ? 'ga-status-success'
                                : d.localVerificationStatus === 'active-unverified-owner'
                                  ? 'ga-status-warning'
                                  : 'ga-status-error'
                            }`}
                          >
                            {d.localVerificationStatus === 'active-trusted'
                              ? t.devices.statusActiveTrusted
                              : d.localVerificationStatus === 'active-unverified-owner'
                                ? t.devices.statusActiveUnverified
                                : d.localVerificationStatus === 'conflict-revoked'
                                  ? t.devices.statusConflict
                                  : t.devices.statusRevoked}
                          </span>
                        </div>
                        <span className="text-xs ga-text-secondary">
                          {t.devices.confirmOwnerIdLabel}: {d.ownerDisplayName} (
                          {d.ownerFingerprintShort})
                        </span>
                      </div>

                      <details className="text-[11px] ga-text-muted">
                        <summary className="cursor-pointer hover:text-[var(--ga-text)]">
                          {t.devices.technicalDetailsSummary}
                        </summary>
                        <div className="mt-1.5 space-y-1 font-mono break-all">
                          <div>
                            {t.devices.detailDeviceId}: {d.deviceIdHex}
                          </div>
                          <div>
                            {t.devices.detailFingerprintShort}: {d.deviceFingerprintShort}
                          </div>
                          <div>
                            {t.devices.detailFingerprintFull}: {d.deviceFingerprintHex}
                          </div>
                          <div>
                            {t.devices.detailPublicKey}: {d.devicePublicKeyBase64Url}
                          </div>
                          <div>
                            {t.devices.detailIssuedAt}:{' '}
                            {new Date(d.issuedAt * 1000).toISOString()}
                          </div>
                        </div>
                      </details>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--ga-border)]">
                        {d.localVerificationStatus === 'active-unverified-owner' && (
                          <button
                            type="button"
                            data-testid="confirm-paired-owner-btn"
                            onClick={() => void handleConfirmOwnerTrust(d.key)}
                            className="ga-status-warning inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:opacity-90 min-h-[44px] cursor-pointer"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t.devices.confirmOwnerNowBtn}</span>
                          </button>
                        )}

                        {!isRevoked && canSignRevocation && (
                          <button
                            type="button"
                            data-testid="revoke-device-open-btn"
                            onClick={() => {
                              setRevokingKey(revokingKey === d.key ? null : d.key);
                              setRemovingKey(null);
                              setRevokeAndRemove(false);
                              setRevokeError(null);
                            }}
                            className="ga-status-error inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:opacity-90 min-h-[44px] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t.devices.revokeDeviceBtn}</span>
                          </button>
                        )}

                        {(isRevoked || !canSignRevocation) && (
                          <button
                            type="button"
                            data-testid="remove-device-open-btn"
                            onClick={() => {
                              setRemovingKey(removingKey === d.key ? null : d.key);
                              setRevokingKey(null);
                              setRemoveError(null);
                            }}
                            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{isRevoked ? t.devices.removeDeviceBtn : t.devices.removeLocalOnlyBtn}</span>
                          </button>
                        )}
                      </div>

                      {removingKey === d.key && (
                        <div
                          data-testid="remove-device-confirm-panel"
                          className="ga-status-warning rounded-xl border p-4 space-y-3 text-xs"
                        >
                          <div className="font-semibold text-sm text-[var(--ga-warning-text)]">
                            {isRevoked
                              ? t.devices.removeConfirmTitleRevoked
                              : t.devices.removeConfirmTitleLocalOnly}
                          </div>
                          <p className="ga-text-secondary leading-relaxed">
                            {isRevoked
                              ? t.devices.removeConfirmDescRevoked
                              : t.devices.removeConfirmDescLocalOnly}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid="remove-device-confirm-btn"
                              onClick={() => void handleRemoveDeviceSubmit(d)}
                              className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold ga-text hover:bg-rose-400 min-h-[44px] cursor-pointer"
                            >
                              {t.devices.removeConfirmSubmitBtn}
                            </button>
                            <button
                              type="button"
                              data-testid="remove-device-cancel-btn"
                              onClick={() => setRemovingKey(null)}
                              className="ga-btn-secondary rounded-xl px-4 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                            >
                              {t.devices.confirmCancelBtn}
                            </button>
                          </div>
                        </div>
                      )}

                      {revokingKey === d.key && (
                        <div
                          data-testid="revoke-confirm-panel"
                          className="ga-status-error rounded-xl border p-4 space-y-3 text-xs"
                        >
                          <div className="font-semibold text-sm text-[var(--ga-error-text)]">
                            {t.devices.revokeConfirmTitle}
                          </div>

                          <div>
                            <label className="block ga-text-secondary mb-1">
                              {t.devices.revokeReasonLabel}
                            </label>
                            <select
                              value={revokeReason}
                              onChange={(e) =>
                                setRevokeReason(e.target.value as DeviceRevocationReason)
                              }
                              data-testid="revoke-reason-select"
                              className="ga-input w-full rounded-xl px-3 py-2 text-xs min-h-[44px]"
                            >
                              <option value="lost-device">
                                {t.devices.revokeReasons['lost-device']}
                              </option>
                              <option value="device-compromised">
                                {t.devices.revokeReasons['device-compromised']}
                              </option>
                              <option value="retired">{t.devices.revokeReasons.retired}</option>
                              <option value="other">{t.devices.revokeReasons.other}</option>
                            </select>
                          </div>

                          <div>
                            <label className="block ga-text-secondary mb-1">
                              {t.devices.revokeNoteLabel}
                            </label>
                            <input
                              type="text"
                              value={revokeNote}
                              onChange={(e) => setRevokeNote(e.target.value)}
                              placeholder={t.devices.revokeNotePlaceholder}
                              className="ga-input w-full rounded-xl px-3 py-2 text-xs min-h-[44px]"
                            />
                          </div>

                          {ownerKeyForDevice?.storageMode === 'noble-encrypted-seed' && (
                            <div>
                              <label className="block ga-text-secondary mb-1">
                                {t.devices.ownerPassphraseLabel}
                              </label>
                              <input
                                type="password"
                                value={revokePassphrase}
                                onChange={(e) => setRevokePassphrase(e.target.value)}
                                className="ga-input w-full rounded-xl px-3 py-2 text-xs min-h-[44px]"
                              />
                            </div>
                          )}

                          <label className="flex items-start gap-2 ga-text-secondary cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={revokeAndRemove}
                              onChange={(e) => setRevokeAndRemove(e.target.checked)}
                              data-testid="revoke-and-remove-checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-slate-500 shrink-0"
                            />
                            <span>{t.devices.revokeAndRemoveLabel}</span>
                          </label>

                          {revokeError && (
                            <FriendlyErrorAlert
                              error={revokeError}
                              onDismiss={() => setRevokeError(null)}
                            />
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid="revoke-confirm-submit-btn"
                              onClick={() => void handleRevokeSubmit(d)}
                              className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold ga-text hover:bg-rose-400 min-h-[44px] cursor-pointer"
                            >
                              {t.devices.revokeConfirmSubmitBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevokingKey(null)}
                              className="ga-btn-secondary rounded-xl px-4 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                            >
                              {t.devices.confirmCancelBtn}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {generatedRevocation && (
              <div
                data-testid="revocation-qr-panel"
                className="ga-card-solid rounded-xl border border-[var(--ga-error-border)] p-4 space-y-3"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[var(--ga-error-text)]">
                    {t.devices.revocationQrTitle}
                  </h3>
                  <p className="text-xs ga-text-secondary">{t.devices.revocationQrDesc}</p>
                </div>
                <QrCodeDisplay
                  value={generatedRevocation.qrUrl}
                  alt={t.devices.revocationQrTitle}
                />
                <input
                  type="text"
                  readOnly
                  value={generatedRevocation.qrUrl}
                  data-testid="pairing-rev-url-output"
                  className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono ga-text-secondary"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="pairing-rev-download-qr"
                    onClick={() =>
                      downloadQrPngFile(
                        generatedRevocation.qrUrl,
                        `chm-device-revocation-${generatedRevocation.revocation.payload.deviceIdHex.slice(0, 8)}.png`,
                      )
                    }
                    className="ga-status-error inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:opacity-90 min-h-[44px] cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.devices.downloadQrPngBtn}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
            {/* Import Revocation Notice */}
            <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-3 min-w-0">
              <h2 className="text-base font-semibold ga-text">{t.devices.importRevocationTitle}</h2>

              <div>
                <label htmlFor={revUploadId} className="block text-xs ga-text-secondary mb-1">
                  {t.devices.uploadQrImageLabel}
                </label>
                <input
                  id={revUploadId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.json"
                  data-testid="pairing-rev-file-input"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] ?? null;
                    e.currentTarget.value = '';
                    void handleImportRevocationQrFile(file);
                  }}
                  className="block w-full text-xs ga-text-secondary file:mr-3 file:rounded-lg file:border file:border-[var(--ga-border-strong)] file:bg-[var(--ga-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--ga-text)]"
                />
              </div>

              <textarea
                rows={2}
                value={importRevInput}
                onChange={(e) => setImportRevInput(e.target.value)}
                placeholder="chm-pair-rev:... or /devices#pair-rev=..."
                data-testid="pairing-rev-import-input"
                className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
              />

              {importRevError && (
                <FriendlyErrorAlert
                  error={importRevError}
                  testId="pairing-rev-import-error"
                  onDismiss={() => setImportRevError(null)}
                />
              )}
              {importRevMsg && (
                <p role="status" data-testid="pairing-rev-import-msg" className="text-xs text-[var(--ga-success-text)]">
                  {importRevMsg}
                </p>
              )}

              <button
                type="button"
                data-testid="pairing-rev-import-btn"
                onClick={() => void handleImportRevocation(importRevInput)}
                className="ga-status-info inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold hover:opacity-90 min-h-[44px] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.devices.importRevocationBtn}</span>
              </button>
            </section>

            {/* Signed Registry Backup Export & Import */}
            <section className="ga-card rounded-2xl border p-4 sm:p-5 space-y-3 min-w-0">
              <h2 className="text-base font-semibold ga-text">{t.devices.backupExportTitle}</h2>
              <p className="text-xs ga-text-secondary leading-relaxed">{t.devices.backupExportDesc}</p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={authorKeys.length === 0}
                  data-testid="export-registry-json-btn"
                  onClick={() => void handleExportRegistry('json')}
                  className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.devices.exportRegistryJsonBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={authorKeys.length === 0}
                  data-testid="export-registry-cbor-btn"
                  onClick={() => void handleExportRegistry('cbor')}
                  className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.devices.exportRegistryCborBtn}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-[var(--ga-border)] space-y-2">
                <label htmlFor={regUploadId} className="block text-xs font-medium ga-text-secondary">
                  {t.devices.importRegistryFileLabel}
                </label>
                <input
                  id={regUploadId}
                  type="file"
                  accept=".json,.cbor,.chdevreg.json,.chdevreg.cbor,application/json"
                  data-testid="import-registry-file-input"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] ?? null;
                    e.currentTarget.value = '';
                    void handleImportRegistryFile(file);
                  }}
                  className="block w-full text-xs ga-text-secondary file:mr-3 file:rounded-lg file:border file:border-[var(--ga-border-strong)] file:bg-[var(--ga-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--ga-text)]"
                />
              </div>

              {registryActionError && (
                <FriendlyErrorAlert
                  error={registryActionError}
                  testId="registry-action-error"
                  onDismiss={() => setRegistryActionError(null)}
                />
              )}
              {registryActionMsg && (
                <div
                  role="status"
                  data-testid="registry-action-msg"
                  className="ga-status-success rounded-xl border p-3 space-y-1 text-xs"
                >
                  <p className="font-semibold">{registryActionMsg}</p>
                  {registryReconcileResult && (
                    <p className="text-[11px] text-[var(--ga-success-text)]">
                      Preserved local revocations: {registryReconcileResult.preservedLocalRevocations} ·
                      Newly applied revocations: {registryReconcileResult.newlyAppliedRevocations}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* TAB 4: OPTIONAL DECENTRALIZED SYNC */}
      {activeTab === 'sync' && (
        <DecentralizedSyncPanel
          settings={syncSettings}
          status={syncStatus}
          localDevice={localDevice}
          nostrKey={nostrKey}
          localBindingToken={localBindingToken}
          peerBindings={peerBindings}
          authorKeys={authorKeys}
          selectedAuthorKeyId={selectedAuthorKeyId}
          onRefresh={refreshAll}
        />
      )}
    </div>
  );
}
