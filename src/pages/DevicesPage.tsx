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
import { HelpIconButton } from '../components/ui/HelpIconButton';
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
import { createAuthorKey, listAuthorKeys } from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { DecentralizedSyncPanel } from '../components/devices/DecentralizedSyncPanel';
import { getDeviceNostrKeyRecord } from '../core/nostr/nostrKeyStore';
import type { NostrDeviceKeyRecord } from '../core/nostr/nostrKeyStore';
import {
  SYNC_BINDING_TOKEN_PREFIX,
  announceLocalBindingToKnownPeers,
  attachSyncBindingToPairingUrl,
  computeConfirmationCodeForCertificate,
  computeConfirmationCodeForRequest,
  computePairingConfirmationCode,
  createDefaultSyncSettings,
  ensureLocalBindingAttestation,
  extractSyncBindFromPairingUrl,
  getSyncStatusSummary,
  importPeerSyncBindingInput,
  listVerifiedPeerBindings,
  loadSyncSettings,
  recordAndBroadcastOwnerSyncMutation,
  runDecentralizedSyncCycle,
} from '../core/sync';
import type {
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
  const [completedDevice, setCompletedDevice] = useState<PairedDeviceRecord | null>(null);

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
      h.startsWith('#pair-req=') || h.startsWith('#pair-cert=') || h.startsWith('#pair-rev=');
    if (!isPairingHash) return;
    if (processedHashRef.current === h) return;
    processedHashRef.current = h;
    const fullUrl = window.location.href;

    navigate(`${location.pathname}${location.search}`, { replace: true });

    if (h.startsWith('#pair-req=')) {
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
            throw new Error('This device key has been revoked and cannot be registered.');
          }
          if (res.alreadyRegisteredUnderOwner) {
            throw new Error('Double-registration blocked: this device is already registered under your My ID.');
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
            throw new Error('This device has been revoked and cannot complete registration.');
          }
          if (res.alreadyRegistered) {
            throw new Error('This device is already registered under this CHM Identity.');
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
    setCertInspection(null);
    setConfirmOwnerChecked(false);
    setCompletedDevice(null);
    try {
      const inspected = await inspectEnrollmentCertificateForDevice({
        rawCertificateInput: rawValue,
      });
      if (!inspected.verification.valid) {
        throw new Error(inspected.verification.errors.join(' '));
      }
      if (inspected.deviceRevoked) {
        throw new Error('This device has been revoked and cannot complete registration.');
      }
      if (inspected.alreadyRegistered) {
        throw new Error('This device is already registered under this CHM Identity.');
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
        throw new Error('This device key has been revoked and cannot be registered.');
      }
      if (inspected.alreadyRegisteredUnderOwner) {
        throw new Error('Double-registration blocked: this device is already registered under your My ID.');
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

  const handleApprovePairing = async () => {
    if (!reqInspection || !selectedAuthorKeyId) return;
    setApproveError(null);
    try {
      const res = await approvePairingRequestAsOwner({
        rawRequestInput: reqInspection.request.token,
        authorKeyId: selectedAuthorKeyId,
        passphrase: ownerPassphrase || undefined,
      });
      let qrUrl = res.qrUrl;
      try {
        const settingsNow = await loadSyncSettings();
        if (settingsNow.enabled && settingsNow.consentAccepted) {
          const ensured = await ensureLocalBindingAttestation({
            authorKeyId: selectedAuthorKeyId,
            ownerPassphrase: ownerPassphrase || undefined,
          });
          if (ensured.binding) {
            qrUrl = attachSyncBindingToPairingUrl(res.qrUrl, ensured.binding);
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
      <header className="flex items-start justify-between gap-3 sm:gap-4 border-b border-white/[0.08] pb-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white break-words">
            {t.devices.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed break-words">
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
          <ul className="space-y-2 list-disc ps-4 text-xs text-slate-200 leading-relaxed">
            {t.devices.helpPoints.map((pt, idx) => (
              <li key={idx}>{pt}</li>
            ))}
          </ul>
          <div className="rounded-lg border border-sky-400/25 bg-sky-500/10 p-3 text-xs text-sky-100">
            {t.devices.noRootKeyCopyNote}
          </div>
        </HelpIconButton>
      </header>

      {corruptionWarnings.length > 0 && (
        <div
          role="alert"
          data-testid="pairing-corruption-warning"
          className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-100"
        >
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 text-rose-300 shrink-0" aria-hidden="true" />
            <span>{t.devices.corruptRecordWarningTitle}</span>
          </div>
          <ul className="space-y-1.5">
            {corruptionWarnings.map((w, idx) => (
              <li
                key={`${w.store}:${w.recordKey}:${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/25 px-3 py-2"
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
                  className="rounded-md border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-500/25 cursor-pointer"
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
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.devices.myIdSectionTitle}</span>
            </h2>
            <Link
              to="/keys"
              className="text-xs font-medium text-sky-300 hover:text-sky-200 underline underline-offset-4 shrink-0"
            >
              {t.devices.goToKeysBackupBtn}
            </Link>
          </div>

          {authorKeys.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">{t.devices.myIdEmptyDesc}</p>
              <form onSubmit={handleQuickCreateAuthorKey} className="space-y-2.5">
                <label className="block text-xs font-medium text-slate-300">
                  {t.devices.quickCreateIdLabel}
                </label>
                <input
                  type="text"
                  value={quickIdName}
                  onChange={(e) => setQuickIdName(e.target.value)}
                  maxLength={64}
                  placeholder={t.devices.quickCreateIdPlaceholder}
                  data-testid="pairing-quick-myid-name"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                />
                <input
                  type="password"
                  value={quickIdPass}
                  onChange={(e) => setQuickIdPass(e.target.value)}
                  placeholder={t.devices.quickCreateIdPassPlaceholder}
                  data-testid="pairing-quick-myid-pass"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                />
                {quickIdError && (
                  <p role="alert" className="text-xs text-rose-300">
                    {quickIdError}
                  </p>
                )}
                <button
                  type="submit"
                  data-testid="pairing-quick-myid-submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-white min-h-[44px] cursor-pointer"
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
                  className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 px-3 py-2.5 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-white">{k.label}</span>
                    <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                      {k.fingerprintShort}
                    </span>
                  </div>
                  <details className="text-[11px] text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-200">
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

        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-3 min-w-0">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Laptop className="h-4 w-4 text-cyan-300 shrink-0" aria-hidden="true" />
            <span>{t.devices.thisDeviceTitle}</span>
          </h2>

          {localDevice ? (
            <div className="space-y-2.5">
              <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 px-3 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-white" data-testid="local-device-name">
                    {localDevice.deviceName}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!localDevice.revokedLocally && localDeviceActivePairings.length > 0 && (
                      <span
                        data-testid="local-device-paired-badge"
                        className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
                      >
                        {t.devices.alreadyPairedBadge}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        localDevice.revokedLocally
                          ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                          : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                      }`}
                    >
                      {localDevice.revokedLocally ? t.devices.statusRevoked : localDevice.fingerprintShort}
                    </span>
                  </div>
                </div>
                {!localDevice.revokedLocally && localDeviceActivePairings.length > 0 && (
                  <p className="text-[11px] text-emerald-200/90">
                    {t.devices.alreadyPairedUnderOwnersLabel}:{' '}
                    {localDeviceActivePairings
                      .map((d) => `${d.ownerDisplayName} (${d.ownerFingerprintShort})`)
                      .join(', ')}
                  </p>
                )}
                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200">
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
                  className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 space-y-2 text-xs text-rose-100"
                >
                  <p>{t.devices.thisDeviceRevokedAlert}</p>
                  <button
                    type="button"
                    data-testid="device-regenerate-btn"
                    onClick={() => void handleRegenerateDeviceIdentity()}
                    className="rounded-lg border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500/30 min-h-[44px] cursor-pointer"
                  >
                    {t.devices.regenerateDeviceIdBtn}
                  </button>
                </div>
              ) : (
                localDeviceActivePairings.length > 0 && (
                  <button
                    type="button"
                    data-testid="device-regenerate-btn"
                    onClick={() => void handleRegenerateDeviceIdentity()}
                    className="rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                  >
                    {t.devices.createSeparateDeviceIdBtn}
                  </button>
                )
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">{t.devices.step1Desc}</p>
          )}
        </section>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        className="flex flex-wrap gap-2 border-b border-white/[0.1] pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'add'}
          data-testid="devices-tab-add"
          onClick={() => setActiveTab('add')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer transition-colors ${
            activeTab === 'add'
              ? 'bg-sky-500/20 text-white border border-sky-400/45'
              : 'bg-[#051224]/70 text-slate-300 border border-white/[0.1] hover:text-white'
          }`}
        >
          <Smartphone className="h-4 w-4 text-sky-300" aria-hidden="true" />
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
              ? 'bg-sky-500/20 text-white border border-sky-400/45'
              : 'bg-[#051224]/70 text-slate-300 border border-white/[0.1] hover:text-white'
          }`}
        >
          <QrCode className="h-4 w-4 text-cyan-300" aria-hidden="true" />
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
              ? 'bg-sky-500/20 text-white border border-sky-400/45'
              : 'bg-[#051224]/70 text-slate-300 border border-white/[0.1] hover:text-white'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
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
              ? 'bg-sky-500/20 text-white border border-sky-400/45'
              : 'bg-[#051224]/70 text-slate-300 border border-white/[0.1] hover:text-white'
          }`}
        >
          <RefreshCw className="h-4 w-4 text-sky-300" aria-hidden="true" />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Step 1 */}
          <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-4 min-w-0">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">{t.devices.step1Heading}</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{t.devices.step1Desc}</p>
            </div>

            {localDevice && !localDevice.revokedLocally && localDeviceActivePairings.length > 0 && (
              <div
                role="note"
                data-testid="pairing-already-paired-note"
                className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-3 text-xs text-sky-100 leading-relaxed"
              >
                {t.devices.alreadyPairedStep1Note}
              </div>
            )}

            <form onSubmit={handleStartPairingSession} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.devices.deviceNameLabel}
                </label>
                <input
                  type="text"
                  value={deviceNameInput}
                  onChange={(e) => setDeviceNameInput(e.target.value)}
                  maxLength={64}
                  placeholder={t.devices.deviceNamePlaceholder}
                  data-testid="pairing-device-name-input"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                />
              </div>

              {!webCryptoSupported && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t.devices.devicePassLabel}
                  </label>
                  <input
                    type="password"
                    value={devicePassInput}
                    onChange={(e) => setDevicePassInput(e.target.value)}
                    placeholder={t.devices.devicePassPlaceholder}
                    data-testid="pairing-device-pass-input"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                  />
                </div>
              )}

              {step1Error && (
                <p role="alert" data-testid="pairing-step1-error" className="text-xs text-rose-300">
                  {step1Error}
                </p>
              )}

              <button
                type="submit"
                disabled={Boolean(localDevice?.revokedLocally)}
                data-testid="pairing-create-req-btn"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
                <span>{t.devices.generateRequestQrBtn}</span>
              </button>
            </form>

            {displayedSession && displayedQrUrl && (
              <div
                data-testid="pairing-request-qr-panel"
                className="rounded-xl border border-sky-400/35 bg-[#030b18]/80 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{t.devices.requestQrTitle}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      displayedRequestExpired
                        ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                        : 'bg-sky-500/15 text-sky-200 border border-sky-400/35'
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
                  <div className="rounded-lg border border-sky-400/30 bg-[#020813] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">{t.devices.sync.confirmationCodeLabel}: </span>
                      <span
                        data-testid="pairing-req-confirm-code"
                        className="font-mono font-bold tracking-wider text-sky-200 text-sm"
                      >
                        {displayedReqConfirmCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
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
                    className="w-full rounded-lg border border-white/[0.12] bg-[#020813] px-3 py-2 text-xs font-mono text-slate-300"
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20 min-h-[44px] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.devices.downloadQrPngBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopy('req-url', displayedQrUrl)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                    >
                      {copiedKey === 'req-url' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedKey === 'req-url' ? t.devices.copiedMsg : t.devices.copyUrlBtn}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="pairing-cancel-req-btn"
                      onClick={() => void handleCancelPairingRequest(displayedSession.requestIdHex)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20 min-h-[44px] cursor-pointer"
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
          <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-4 min-w-0">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">{t.devices.step2NewHeading}</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{t.devices.step2NewDesc}</p>
            </div>

            {completedDevice && (
              <div
                role="status"
                data-testid="pairing-completed-banner"
                className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 space-y-1.5 text-xs text-emerald-100"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.devices.pairingCompletedTitle}</span>
                </div>
                <p>{t.devices.pairingCompletedDesc}</p>
                <p className="text-[11px] text-emerald-200/90">
                  {completedDevice.deviceName} · {completedDevice.ownerDisplayName} (
                  {completedDevice.localVerificationStatus === 'active-trusted'
                    ? t.devices.ownerConfirmedBadge
                    : t.devices.statusActiveUnverified}
                  )
                </p>
              </div>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-[#030b18]/70 p-3 space-y-3">
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

              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <label htmlFor={certUploadId} className="block text-xs font-medium text-slate-300">
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
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
                />
              </div>

              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  {t.devices.pasteInputLabel}
                </label>
                <textarea
                  rows={2}
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  placeholder={t.devices.pasteInputPlaceholder}
                  data-testid="pairing-cert-text-input"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  data-testid="pairing-cert-inspect-btn"
                  onClick={() => void inspectCertValue(certInput)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
                >
                  <span>{t.devices.verifyCertBtn}</span>
                </button>
              </div>
            </div>

            {step2Error && (
              <p role="alert" data-testid="pairing-step2-error" className="text-xs text-rose-300">
                {step2Error}
              </p>
            )}

            {certInspection && (
              <div
                data-testid="pairing-cert-preview"
                className="rounded-xl border border-cyan-400/35 bg-[#030b18]/85 p-4 space-y-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-sm text-white">
                    {certInspection.certificate.payload.ownerDisplayName} (
                    {certInspection.certificate.payload.ownerFingerprintShort})
                  </div>
                  <div className="text-slate-300">
                    {t.devices.confirmDeviceNameLabel}:{' '}
                    {certInspection.certificate.payload.deviceDisplayName}
                  </div>
                  <div className="text-slate-300">
                    {t.devices.confirmPermissionLabel}: {t.devices.confirmPermissionValue}
                  </div>
                  {certInspectConfirmCode && (
                    <div className="pt-1 text-slate-300">
                      {t.devices.sync.confirmationCodeLabel}:{' '}
                      <span
                        data-testid="pairing-cert-confirm-code"
                        className="font-mono font-bold tracking-wider text-cyan-200"
                      >
                        {certInspectConfirmCode}
                      </span>
                    </div>
                  )}
                </div>

                {certInspection.requiresOwnerTrustConfirmation ? (
                  <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-3 space-y-2 text-xs text-amber-100">
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
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.devices.ownerConfirmedBadge}</span>
                  </div>
                )}

                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200">
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
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 min-h-[44px] cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{t.devices.completePairingBtn}</span>
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: EXISTING OWNER DEVICE APPROVAL */}
      {activeTab === 'approve' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-4 min-w-0">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">{t.devices.approveHeading}</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{t.devices.approveDesc}</p>
            </div>

            {authorKeys.length > 0 && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t.devices.selectOwnerIdLabel}
                  </label>
                  <select
                    value={selectedAuthorKeyId}
                    onChange={(e) => setSelectedAuthorKeyId(e.target.value)}
                    data-testid="pairing-owner-select"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {t.devices.ownerPassphraseLabel}
                    </label>
                    <input
                      type="password"
                      value={ownerPassphrase}
                      onChange={(e) => setOwnerPassphrase(e.target.value)}
                      placeholder={t.devices.ownerPassphrasePlaceholder}
                      data-testid="pairing-owner-passphrase"
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-[#030b18]/70 p-3 space-y-3">
              <QrCameraScanner
                startLabel={t.devices.scanCameraBtn}
                stopLabel={t.devices.stopCameraBtn}
                hint={t.devices.cameraHint}
                errorText={t.devices.cameraDeniedFallbackMsg}
                onDetected={(text) => {
                  setIncomingReqInput(text);
                  void inspectIncomingRequestValue(text);
                }}
              />

              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <label htmlFor={reqUploadId} className="block text-xs font-medium text-slate-300">
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
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
                />
              </div>

              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  {t.devices.pasteInputLabel}
                </label>
                <textarea
                  rows={2}
                  value={incomingReqInput}
                  onChange={(e) => setIncomingReqInput(e.target.value)}
                  placeholder={t.devices.pasteInputPlaceholder}
                  data-testid="pairing-req-paste-input"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  data-testid="pairing-req-inspect-btn"
                  onClick={() => void inspectIncomingRequestValue(incomingReqInput)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
                >
                  <span>{t.devices.verifyCertBtn}</span>
                </button>
              </div>
            </div>

            {approveError && (
              <p role="alert" data-testid="pairing-approve-error" className="text-xs text-rose-300">
                {approveError}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-4 min-w-0">
            {reqInspection && (
              <div
                data-testid="pairing-approve-confirm-card"
                className="rounded-xl border border-sky-400/45 bg-[#030b18]/90 p-4 space-y-4"
              >
                <h3 className="text-base font-semibold text-white">
                  {t.devices.confirmDialogTitlePrefix}
                  {reqInspection.request.payload.deviceDisplayName}
                  {t.devices.confirmDialogTitleSuffix}
                </h3>

                <dl className="space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-1.5">
                    <dt className="text-slate-400">{t.devices.confirmDeviceNameLabel}</dt>
                    <dd className="font-semibold text-white">
                      {reqInspection.request.payload.deviceDisplayName}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-1.5">
                    <dt className="text-slate-400">{t.devices.confirmOwnerIdLabel}</dt>
                    <dd className="font-semibold text-sky-200">
                      {selectedOwnerKey
                        ? `${selectedOwnerKey.label} (${selectedOwnerKey.fingerprintShort})`
                        : t.devices.myIdEmptyDesc}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-1.5">
                    <dt className="text-slate-400">{t.devices.confirmPermissionLabel}</dt>
                    <dd className="text-slate-200">{t.devices.confirmPermissionValue}</dd>
                  </div>
                  {reqInspectConfirmCode && (
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-slate-400">{t.devices.sync.confirmationCodeLabel}</dt>
                      <dd
                        data-testid="pairing-approve-confirm-code"
                        className="font-mono font-bold tracking-wider text-sky-200 text-sm"
                      >
                        {reqInspectConfirmCode}
                      </dd>
                    </div>
                  )}
                </dl>

                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200">
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

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={!selectedAuthorKeyId}
                    data-testid="pairing-approve-confirm-btn"
                    onClick={() => void handleApprovePairing()}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-sky-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50 min-h-[44px] cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>{t.devices.confirmApproveBtn}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="pairing-approve-cancel-btn"
                    onClick={() => {
                      setReqInspection(null);
                      setIncomingReqInput('');
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-white/[0.16] bg-[#051224] px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
                  >
                    {t.devices.confirmCancelBtn}
                  </button>
                </div>
              </div>
            )}

            {issuedApproval && (
              <div
                data-testid="pairing-approval-qr-panel"
                className="rounded-xl border border-emerald-400/40 bg-[#030b18]/85 p-4 space-y-3"
              >
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-emerald-200">
                    {t.devices.approvalQrReadyTitle}
                  </h3>
                  <p className="text-xs text-slate-300">{t.devices.approvalQrReadyDesc}</p>
                </div>

                <QrCodeDisplay
                  value={issuedApproval.qrUrl}
                  alt={t.devices.approvalQrReadyTitle}
                />

                {issuedApprovalConfirmCode && (
                  <div className="rounded-lg border border-emerald-400/30 bg-[#020813] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">{t.devices.sync.confirmationCodeLabel}: </span>
                      <span
                        data-testid="pairing-approval-confirm-code"
                        className="font-mono font-bold tracking-wider text-emerald-200 text-sm"
                      >
                        {issuedApprovalConfirmCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
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
                  className="w-full rounded-lg border border-white/[0.12] bg-[#020813] px-3 py-2 text-xs font-mono text-slate-300"
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 min-h-[44px] cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.devices.downloadQrPngBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopy('cert-url', issuedApproval.qrUrl)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                  >
                    {copiedKey === 'cert-url' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
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
                      setReqInspection(null);
                      setIncomingReqInput('');
                      setApproveError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                  >
                    <span>{t.devices.approveNextDeviceBtn}</span>
                  </button>
                </div>
              </div>
            )}

            {!reqInspection && !issuedApproval && (
              <div className="rounded-xl border border-dashed border-white/[0.12] p-6 text-center text-xs text-slate-400">
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
            className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-100 leading-relaxed"
          >
            <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.devices.offlineSyncWarning}</span>
          </div>

          <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-4 min-w-0">
            <h2 className="text-lg font-semibold text-white">{t.devices.registeredDevicesTitle}</h2>

            {removeError && (
              <p role="alert" data-testid="device-list-error-msg" className="text-xs text-rose-300">
                {removeError}
              </p>
            )}
            {deviceListMsg && (
              <p role="status" data-testid="device-list-status-msg" className="text-xs text-emerald-300">
                {deviceListMsg}
              </p>
            )}

            {pairedDevices.length === 0 ? (
              <p className="text-sm text-slate-400">{t.devices.noDevicesYet}</p>
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
                      className="rounded-xl border border-white/[0.08] bg-[#030b18]/70 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{d.deviceName}</span>
                          {isThisBrowserDevice && (
                            <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
                              {t.devices.thisDeviceTitle}
                            </span>
                          )}
                          <span
                            data-testid="paired-device-status"
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              d.localVerificationStatus === 'active-trusted'
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                                : d.localVerificationStatus === 'active-unverified-owner'
                                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                                  : 'border-rose-400/40 bg-rose-500/15 text-rose-200'
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
                        <span className="text-xs text-slate-300">
                          {t.devices.confirmOwnerIdLabel}: {d.ownerDisplayName} (
                          {d.ownerFingerprintShort})
                        </span>
                      </div>

                      <details className="text-[11px] text-slate-400">
                        <summary className="cursor-pointer hover:text-slate-200">
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

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                        {d.localVerificationStatus === 'active-unverified-owner' && (
                          <button
                            type="button"
                            data-testid="confirm-paired-owner-btn"
                            onClick={() => void handleConfirmOwnerTrust(d.key)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/25 min-h-[44px] cursor-pointer"
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20 min-h-[44px] cursor-pointer"
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-500/40 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 hover:border-rose-400/50 hover:text-rose-200 min-h-[44px] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{isRevoked ? t.devices.removeDeviceBtn : t.devices.removeLocalOnlyBtn}</span>
                          </button>
                        )}
                      </div>

                      {removingKey === d.key && (
                        <div
                          data-testid="remove-device-confirm-panel"
                          className="rounded-xl border border-amber-400/40 bg-amber-950/20 p-4 space-y-3 text-xs"
                        >
                          <div className="font-semibold text-sm text-amber-100">
                            {isRevoked
                              ? t.devices.removeConfirmTitleRevoked
                              : t.devices.removeConfirmTitleLocalOnly}
                          </div>
                          <p className="text-slate-300 leading-relaxed">
                            {isRevoked
                              ? t.devices.removeConfirmDescRevoked
                              : t.devices.removeConfirmDescLocalOnly}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid="remove-device-confirm-btn"
                              onClick={() => void handleRemoveDeviceSubmit(d)}
                              className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400 min-h-[44px] cursor-pointer"
                            >
                              {t.devices.removeConfirmSubmitBtn}
                            </button>
                            <button
                              type="button"
                              data-testid="remove-device-cancel-btn"
                              onClick={() => setRemovingKey(null)}
                              className="rounded-lg border border-white/[0.16] px-4 py-2 text-xs font-medium text-slate-200 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
                            >
                              {t.devices.confirmCancelBtn}
                            </button>
                          </div>
                        </div>
                      )}

                      {revokingKey === d.key && (
                        <div
                          data-testid="revoke-confirm-panel"
                          className="rounded-xl border border-rose-400/40 bg-rose-950/25 p-4 space-y-3 text-xs"
                        >
                          <div className="font-semibold text-sm text-rose-100">
                            {t.devices.revokeConfirmTitle}
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1">
                              {t.devices.revokeReasonLabel}
                            </label>
                            <select
                              value={revokeReason}
                              onChange={(e) =>
                                setRevokeReason(e.target.value as DeviceRevocationReason)
                              }
                              data-testid="revoke-reason-select"
                              className="w-full rounded-lg border border-white/[0.14] bg-[#030b18] px-3 py-2 text-xs text-white min-h-[44px]"
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
                            <label className="block text-slate-300 mb-1">
                              {t.devices.revokeNoteLabel}
                            </label>
                            <input
                              type="text"
                              value={revokeNote}
                              onChange={(e) => setRevokeNote(e.target.value)}
                              placeholder={t.devices.revokeNotePlaceholder}
                              className="w-full rounded-lg border border-white/[0.14] bg-[#030b18] px-3 py-2 text-xs text-white min-h-[44px]"
                            />
                          </div>

                          {ownerKeyForDevice?.storageMode === 'noble-encrypted-seed' && (
                            <div>
                              <label className="block text-slate-300 mb-1">
                                {t.devices.ownerPassphraseLabel}
                              </label>
                              <input
                                type="password"
                                value={revokePassphrase}
                                onChange={(e) => setRevokePassphrase(e.target.value)}
                                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18] px-3 py-2 text-xs text-white min-h-[44px]"
                              />
                            </div>
                          )}

                          <label className="flex items-start gap-2 text-slate-200 cursor-pointer pt-1">
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
                            <p role="alert" className="text-rose-300">
                              {revokeError}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid="revoke-confirm-submit-btn"
                              onClick={() => void handleRevokeSubmit(d)}
                              className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400 min-h-[44px] cursor-pointer"
                            >
                              {t.devices.revokeConfirmSubmitBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevokingKey(null)}
                              className="rounded-lg border border-white/[0.16] px-4 py-2 text-xs font-medium text-slate-200 hover:border-white/[0.3] min-h-[44px] cursor-pointer"
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
                className="rounded-xl border border-rose-400/40 bg-[#030b18]/85 p-4 space-y-3"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-rose-200">
                    {t.devices.revocationQrTitle}
                  </h3>
                  <p className="text-xs text-slate-300">{t.devices.revocationQrDesc}</p>
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
                  className="w-full rounded-lg border border-white/[0.12] bg-[#020813] px-3 py-2 text-xs font-mono text-slate-300"
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/25 min-h-[44px] cursor-pointer"
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
            <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-3 min-w-0">
              <h2 className="text-base font-semibold text-white">{t.devices.importRevocationTitle}</h2>

              <div>
                <label htmlFor={revUploadId} className="block text-xs text-slate-300 mb-1">
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
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100"
                />
              </div>

              <textarea
                rows={2}
                value={importRevInput}
                onChange={(e) => setImportRevInput(e.target.value)}
                placeholder="chm-pair-rev:... or /devices#pair-rev=..."
                data-testid="pairing-rev-import-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs font-mono text-white"
              />

              {importRevError && (
                <p role="alert" data-testid="pairing-rev-import-error" className="text-xs text-rose-300">
                  {importRevError}
                </p>
              )}
              {importRevMsg && (
                <p role="status" data-testid="pairing-rev-import-msg" className="text-xs text-emerald-300">
                  {importRevMsg}
                </p>
              )}

              <button
                type="button"
                data-testid="pairing-rev-import-btn"
                onClick={() => void handleImportRevocation(importRevInput)}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.devices.importRevocationBtn}</span>
              </button>
            </section>

            {/* Signed Registry Backup Export & Import */}
            <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-3 min-w-0">
              <h2 className="text-base font-semibold text-white">{t.devices.backupExportTitle}</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{t.devices.backupExportDesc}</p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={authorKeys.length === 0}
                  data-testid="export-registry-json-btn"
                  onClick={() => void handleExportRegistry('json')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-500/25 disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.devices.exportRegistryJsonBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={authorKeys.length === 0}
                  data-testid="export-registry-cbor-btn"
                  onClick={() => void handleExportRegistry('cbor')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.16] bg-[#030b18] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.devices.exportRegistryCborBtn}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <label htmlFor={regUploadId} className="block text-xs font-medium text-slate-300">
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
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100"
                />
              </div>

              {registryActionError && (
                <p role="alert" data-testid="registry-action-error" className="text-xs text-rose-300">
                  {registryActionError}
                </p>
              )}
              {registryActionMsg && (
                <div
                  role="status"
                  data-testid="registry-action-msg"
                  className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 p-3 space-y-1 text-xs text-emerald-100"
                >
                  <p className="font-semibold">{registryActionMsg}</p>
                  {registryReconcileResult && (
                    <p className="text-[11px] text-emerald-200/90">
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
