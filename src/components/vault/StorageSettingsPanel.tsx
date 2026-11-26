import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  Database,
  Download,
  FileArchive,
  KeyRound,
  Lock,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Upload,
} from 'lucide-react';
import { evaluatePassphraseStrength } from '../../core/crypto/keyBackup';
import type { EncryptedKeyBackup } from '../../core/crypto/keyBackup';
import {
  checkGoogleDriveEnvironmentSupport,
  defaultGoogleDriveProvider,
} from '../../core/google';
import type { GoogleAuthSessionState } from '../../core/google/gisAuth';
import { loadDevicePairingState } from '../../core/storage/devicePairingStore';
import {
  listAuthorKeys,
  listTrustedKeys,
  type AuthorKeyRecord,
} from '../../core/storage/keyStore';
import {
  IndexedDbStorageProvider,
  PORTABLE_VAULT_FILE_EXTENSION,
  PortableFileStorageProvider,
  type StorageProviderStatus,
} from '../../core/storage/providers';
import {
  unlockDriveVaultFromKeyShare,
  type PersistedDriveAccountState,
  type SyncedRecoveryKeyEntry,
} from '../../core/vault/driveSyncEngine';
import type { CrossDeviceVaultKeyShareEnvelope } from '../../core/vault/vaultCrypto';
import { useI18n } from '../../i18n/context';
import { DiscordWebhookSettings } from '../discord/DiscordWebhookSettings';
import { HelpTip } from '../HelpTip';
import { FriendlyErrorAlert } from '../ui/FriendlyErrorAlert';

interface StorageSettingsPanelProps {
  onVaultChanged?: () => Promise<void> | void;
}

const indexedDbProvider = new IndexedDbStorageProvider();
const portableFileProvider = new PortableFileStorageProvider();

export function StorageSettingsPanel({ onVaultChanged }: StorageSettingsPanelProps) {
  const { t } = useI18n();
  const s = t.nextGen.storage;
  const dr = t.humanUx.driveRecovery;

  const envSupport = checkGoogleDriveEnvironmentSupport();

  const [idbStatus, setIdbStatus] = useState<StorageProviderStatus | null>(null);
  const [driveStatus, setDriveStatus] = useState<StorageProviderStatus | null>(null);
  const [authState, setAuthState] = useState<GoogleAuthSessionState>(() =>
    defaultGoogleDriveProvider.getAuthManager().getState(),
  );
  const [persistedState, setPersistedState] = useState<PersistedDriveAccountState | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(() =>
    defaultGoogleDriveProvider.isVaultUnlocked(),
  );

  // Synced counts summary
  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);
  const [syncCounts, setSyncCounts] = useState({
    authorKeys: 0,
    trustedKeys: 0,
    pairedDevices: 0,
    revocations: 0,
  });

  // Portable .chmvault.json state
  const [portablePass, setPortablePass] = useState('');
  const [portableBusy, setPortableBusy] = useState(false);
  const [portableMsg, setPortableMsg] = useState<string | null>(null);
  const [portableError, setPortableError] = useState<string | null>(null);

  // Google Drive state
  const [drivePass, setDrivePass] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Key Share & Rotation state
  const [transferPass, setTransferPass] = useState('');
  const [exportedKeyShare, setExportedKeyShare] = useState<string | null>(null);
  const [importKeyShareJson, setImportKeyShareJson] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  // Optional Opt-In Encrypted Key Recovery state
  const [recoveryEntries, setRecoveryEntries] = useState<SyncedRecoveryKeyEntry[]>([]);
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [selectedRecoveryKeyId, setSelectedRecoveryKeyId] = useState('');
  const [uploadedEnvelope, setUploadedEnvelope] = useState<EncryptedKeyBackup | null>(null);
  const [uploadedEnvelopeName, setUploadedEnvelopeName] = useState<string | null>(null);
  const [restorePassByKey, setRestorePassByKey] = useState<Record<string, string>>({});

  const refreshAll = useCallback(async () => {
    const [nextIdb, nextDrive, nextPersisted, nextAuthors, nextTrusted, pairingState] =
      await Promise.all([
        indexedDbProvider.getStatus(),
        defaultGoogleDriveProvider.getStatus(),
        defaultGoogleDriveProvider.getPersistedAccountState(),
        listAuthorKeys(),
        listTrustedKeys(),
        loadDevicePairingState().catch(() => ({ pairedDevices: [], revocations: [] })),
      ]);
    setIdbStatus(nextIdb);
    setDriveStatus(nextDrive);
    setAuthState(defaultGoogleDriveProvider.getAuthManager().getState());
    setPersistedState(nextPersisted);
    const unlocked = defaultGoogleDriveProvider.isVaultUnlocked();
    setVaultUnlocked(unlocked);
    setAuthorKeys(nextAuthors);
    const keysWithBackup = nextAuthors.filter((k) => Boolean(k.encryptedBackup));
    setSelectedRecoveryKeyId((prev) =>
      prev && keysWithBackup.some((k) => k.id === prev) ? prev : keysWithBackup[0]?.id ?? '',
    );
    setSyncCounts({
      authorKeys: nextAuthors.length,
      trustedKeys: nextTrusted.length,
      pairedDevices: pairingState.pairedDevices.length,
      revocations: pairingState.revocations.length,
    });
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void refreshAll();
      }
    });
    const unsub = defaultGoogleDriveProvider.getAuthManager().subscribe(() => {
      if (active) {
        void refreshAll();
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, [refreshAll]);

  const drivePassStrength = evaluatePassphraseStrength(drivePass);
  const portablePassStrength = evaluatePassphraseStrength(portablePass);
  const keysWithEncryptedEnvelope = authorKeys.filter((k) => Boolean(k.encryptedBackup));

  // Portable .chmvault.json handlers
  const handleExportChmvault = async () => {
    setPortableError(null);
    setPortableMsg(null);
    setPortableBusy(true);
    try {
      const blob = await portableFileProvider.exportEncryptedFileBlob(portablePass);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certified-handmade-vault-${new Date().toISOString().slice(0, 10)}${PORTABLE_VAULT_FILE_EXTENSION}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setPortablePass('');
      setPortableMsg(s.portableExportSuccess);
    } catch (err) {
      setPortableError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setPortableBusy(false);
    }
  };

  const handleImportChmvault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPortableError(null);
    setPortableMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setPortableBusy(true);
    try {
      const rawText = await file.text();
      const res = await portableFileProvider.importEncryptedSnapshot(rawText, portablePass);
      setPortablePass('');
      setPortableMsg(
        `${s.portableImportSuccess} (+${res.importedProofs} proofs, +${res.importedProfiles} profiles, +${res.importedPresets} policies)`,
      );
      await refreshAll();
      await onVaultChanged?.();
    } catch (err) {
      setPortableError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      e.target.value = '';
      setPortableBusy(false);
    }
  };

  // Google Drive handlers
  const handleConnectDrive = async (prompt: 'select_account' | 'consent' = 'select_account') => {
    setDriveError(null);
    setDriveMsg(null);
    setDriveBusy(true);
    try {
      await defaultGoogleDriveProvider.connectAccount(prompt);
      await refreshAll();
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Google connection failed');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleRefreshRecoveryBackups = useCallback(async () => {
    if (!defaultGoogleDriveProvider.isVaultUnlocked()) return;
    setRecoveryBusy(true);
    setDriveError(null);
    try {
      const list = await defaultGoogleDriveProvider.listOptionalEncryptedRecoveryBackups();
      setRecoveryEntries(list);
      setRecoveryLoaded(true);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Failed to list recovery backups');
    } finally {
      setRecoveryBusy(false);
    }
  }, []);

  const handleUnlockDriveVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriveError(null);
    setDriveMsg(null);
    setDriveBusy(true);
    try {
      await defaultGoogleDriveProvider.unlockOrInitializeVault({
        vaultPassphrase: drivePass,
      });
      setDrivePass('');
      setDriveMsg(s.driveUnlockedMsg);
      await refreshAll();
      await handleRefreshRecoveryBackups();
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Failed to unlock Drive vault');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleSyncDriveNow = async () => {
    setDriveError(null);
    setDriveMsg(null);
    setDriveBusy(true);
    try {
      const res = await defaultGoogleDriveProvider.sync();
      setDriveMsg(
        `${s.driveSyncDoneMsg} (+${res.uploadedCount} ↑ / +${res.downloadedCount} ↓${
          res.conflictCount > 0 ? ` · ${res.conflictCount} conflicts` : ''
        })`,
      );
      await refreshAll();
      await onVaultChanged?.();
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Drive sync failed');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDisconnectDrive = async (revokeAuthorization: boolean) => {
    setDriveError(null);
    setDriveMsg(null);
    setDriveBusy(true);
    try {
      await defaultGoogleDriveProvider.disconnect({ revokeAuthorization });
      setDrivePass('');
      setExportedKeyShare(null);
      setRecoveryEntries([]);
      setRecoveryLoaded(false);
      setDriveMsg(s.driveDisconnectedMsg);
      await refreshAll();
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleResolveConflict = async (
    conflictId: string,
    resolution: 'keep-local' | 'accept-remote' | 'keep-both',
  ) => {
    setDriveError(null);
    setDriveBusy(true);
    try {
      await defaultGoogleDriveProvider.resolveConflict({ conflictId, resolution });
      await defaultGoogleDriveProvider.sync();
      await refreshAll();
      await onVaultChanged?.();
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Failed to resolve conflict');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleExportKeyShare = async () => {
    setDriveError(null);
    setDriveBusy(true);
    try {
      const env = await defaultGoogleDriveProvider.createCrossDeviceKeyShare({
        transferPassphrase: transferPass,
      });
      setExportedKeyShare(JSON.stringify(env));
      setTransferPass('');
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Key share export failed');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleImportKeyShare = async () => {
    setDriveError(null);
    setDriveMsg(null);
    setDriveBusy(true);
    try {
      const parsed = JSON.parse(importKeyShareJson.trim()) as CrossDeviceVaultKeyShareEnvelope;
      const importedKeyring = await unlockDriveVaultFromKeyShare({
        envelope: parsed,
        transferPassphrase: transferPass,
      });
      await defaultGoogleDriveProvider.unlockOrInitializeVault({
        vaultPassphrase: drivePass || transferPass,
        importedKeyring,
      });
      setImportKeyShareJson('');
      setTransferPass('');
      setDriveMsg(s.driveUnlockedMsg);
      await refreshAll();
      await handleRefreshRecoveryBackups();
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Key share import failed');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleRotateEpoch = async () => {
    setDriveError(null);
    setDriveMsg(null);
    setDriveBusy(true);
    try {
      await defaultGoogleDriveProvider.rotateKeyAfterDeviceRevocation({
        vaultPassphrase: drivePass || transferPass,
      });
      setDrivePass('');
      setTransferPass('');
      setDriveMsg(s.driveSyncDoneMsg);
      await refreshAll();
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Key epoch rotation failed');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleCopyShare = async () => {
    if (!exportedKeyShare) return;
    try {
      await navigator.clipboard.writeText(exportedKeyShare);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handlePickRecoveryKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDriveError(null);
    try {
      const parsed = JSON.parse(await file.text()) as EncryptedKeyBackup;
      setUploadedEnvelope(parsed);
      setUploadedEnvelopeName(file.name);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Invalid .chkey.json backup file');
    }
  };

  const handleUploadRecoveryBackup = async () => {
    setDriveError(null);
    setDriveMsg(null);
    setRecoveryBusy(true);
    try {
      const res = await defaultGoogleDriveProvider.uploadOptionalEncryptedRecoveryBackup(
        uploadedEnvelope
          ? { encryptedKeyEnvelope: uploadedEnvelope }
          : { authorKeyId: selectedRecoveryKeyId },
      );
      setRecoveryEntries(res.entries);
      setRecoveryLoaded(true);
      setUploadedEnvelope(null);
      setUploadedEnvelopeName(null);
      setDriveMsg(dr.recoveryUploadedMsg);
    } catch (err) {
      setDriveError(
        err instanceof Error ? err.message : 'Failed to upload encrypted recovery backup',
      );
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleRestoreRecoveryEntry = async (publicKey: string) => {
    const pass = restorePassByKey[publicKey] ?? '';
    if (!pass) return;
    setDriveError(null);
    setDriveMsg(null);
    setRecoveryBusy(true);
    try {
      await defaultGoogleDriveProvider.restoreKeyFromOptionalRecoveryBackup({
        publicKey,
        backupPassphrase: pass,
      });
      setRestorePassByKey((prev) => ({ ...prev, [publicKey]: '' }));
      setDriveMsg(dr.recoveryRestoredMsg);
      await refreshAll();
      await onVaultChanged?.();
    } catch (err) {
      setDriveError(
        err instanceof Error ? err.message : 'Failed to decrypt and restore key backup',
      );
    } finally {
      setRecoveryBusy(false);
    }
  };

  const currentKeyring = defaultGoogleDriveProvider.getUnlockedKeyring();

  return (
    <section
      data-testid="storage-settings-panel"
      className="ga-card rounded-2xl p-4 sm:p-6 space-y-5 min-w-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b ga-border pb-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-semibold ga-text break-words">{s.pageTitle}</h2>
          <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed break-words">{s.pageSubtitle}</p>
        </div>
        <span className="ga-status-info rounded-full border px-3 py-1 text-xs font-medium shrink-0">
          {s.sectionBadge}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        {/* 1. IndexedDB Primary Store */}
        <div
          data-testid="storage-provider-indexeddb"
          className="ga-surface-subtle rounded-2xl border ga-border p-4 space-y-2 min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold ga-text flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--ga-success-text)] shrink-0" aria-hidden="true" />
              <span>{s.localTitle}</span>
            </h3>
            <span className="ga-status-success rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
              {idbStatus?.active ? 'Active' : 'Ready'}
            </span>
          </div>
          <p className="text-xs ga-text-secondary leading-relaxed">{s.localDesc}</p>
          {idbStatus?.detail && (
            <p className="text-[11px] ga-text-muted font-mono">{idbStatus.detail}</p>
          )}
        </div>

        {/* 2. Portable Encrypted File Provider (.chmvault.json) */}
        <div
          data-testid="storage-provider-portable"
          className="ga-surface-subtle rounded-2xl border ga-border p-4 space-y-3 min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold ga-text flex items-center gap-2">
              <FileArchive className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
              <span>{s.portableTitle}</span>
            </h3>
          </div>
          <p className="text-xs ga-text-secondary leading-relaxed">{s.portableDesc}</p>

          <div className="space-y-2">
            <input
              type="password"
              value={portablePass}
              onChange={(e) => setPortablePass(e.target.value)}
              placeholder={s.portablePassPlaceholder}
              data-testid="portable-passphrase-input"
              className="ga-input w-full rounded-xl px-3 py-2 text-xs min-h-[40px]"
            />
            {portablePass.length > 0 && (
              <div className="text-[11px] ga-text-muted">
                Strength:{' '}
                <span
                  className={
                    portablePassStrength.score === 'strong'
                      ? 'text-[var(--ga-success-text)] font-semibold'
                      : portablePassStrength.score === 'fair'
                        ? 'text-[var(--ga-warning-text)] font-semibold'
                        : 'text-[var(--ga-error-text)] font-semibold'
                  }
                >
                  {portablePassStrength.score}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={portableBusy || portablePass.length < 8}
                data-testid="portable-export-btn"
                onClick={() => void handleExportChmvault()}
                className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.exportChmvaultBtn}</span>
              </button>

              <label className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[40px] cursor-pointer">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.importChmvaultBtn}</span>
                <input
                  type="file"
                  accept=".json,.chmvault.json,application/json"
                  data-testid="portable-import-input"
                  onChange={(e) => void handleImportChmvault(e)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {portableError && (
            <FriendlyErrorAlert error={portableError} onDismiss={() => setPortableError(null)} />
          )}
          {portableMsg && (
            <p
              role="status"
              data-testid="portable-status-msg"
              className="ga-status-success rounded-xl border px-3 py-2 text-xs"
            >
              {portableMsg}
            </p>
          )}
        </div>
      </div>

      {/* 3. Google Drive Encrypted Vault Sync (appDataFolder) */}
      <div
        data-testid="storage-provider-google-drive"
        className="ga-card-solid rounded-2xl border ga-border-strong p-4 sm:p-5 space-y-4 min-w-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="text-base font-semibold ga-text flex flex-wrap items-center gap-2 min-w-0">
              <Cloud className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{s.driveTitle}</span>
              <HelpTip
                label={t.simple.advancedTips.driveVaultLabel}
                text={t.simple.advancedTips.driveVaultText}
                testId="storage-drive-tip-btn"
              />
            </h3>
            <p className="text-xs ga-text-secondary leading-relaxed break-words">{s.driveDesc}</p>
          </div>
          {authState.connected && (
            <span
              data-testid="drive-scope-badge"
              className="ga-status-success rounded-full border px-2.5 py-1 text-[11px] font-mono shrink-0"
            >
              {s.driveScopeBadge}
            </span>
          )}
        </div>

        {/* Multi-device summary + synced entity counts */}
        <div className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold ga-text flex items-center gap-1.5">
              <MonitorSmartphone className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
              <span>{dr.crossDeviceTitle}</span>
            </span>
            <span className="text-[11px] ga-text-muted">{dr.crossDeviceTargets}</span>
          </div>
          <p className="ga-text-secondary leading-relaxed">{dr.crossDeviceDesc}</p>
          <div
            data-testid="drive-cross-device-counts"
            className="flex flex-wrap gap-2 pt-1 font-mono text-[11px] ga-text-muted"
          >
            <span>{dr.syncedCountsLabel}:</span>
            <span>Author IDs: {syncCounts.authorKeys}</span>
            <span>· Trusted: {syncCounts.trustedKeys}</span>
            <span>· Paired Devices: {syncCounts.pairedDevices}</span>
            <span>· Revocations: {syncCounts.revocations}</span>
          </div>
        </div>

        {/* Security & Identity Boundary Notices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          <div className="ga-surface-subtle rounded-xl border ga-border px-3 py-2 ga-text-secondary flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 ga-text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <span>{s.driveMemoryNotice}</span>
          </div>
          <div className="ga-status-warning rounded-xl border px-3 py-2 flex items-start gap-2">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{s.driveIdentityNotice}</span>
          </div>
        </div>

        {!envSupport.supported ? (
          <div
            data-testid="drive-standalone-notice"
            className="ga-status-warning rounded-xl border p-3 text-xs flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">{s.driveStandaloneNotice}</p>
              <p className="text-[11px] opacity-85 mt-0.5">{envSupport.message}</p>
            </div>
          </div>
        ) : !authState.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={driveBusy}
              data-testid="drive-connect-btn"
              onClick={() => void handleConnectDrive('select_account')}
              className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <Cloud className="h-4 w-4" aria-hidden="true" />
              <span>{s.driveConnectBtn}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected Google Account Bar */}
            <div className="ga-surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl border ga-border px-3.5 py-2.5 text-xs">
              <div className="space-y-0.5">
                <div className="ga-text-muted">{s.driveConnectedAs}</div>
                <div className="font-semibold ga-text" data-testid="drive-account-label">
                  {authState.account?.displayName
                    ? `${authState.account.displayName} (${authState.account.emailAddress ?? authState.account.accountKey})`
                    : authState.account?.emailAddress ?? authState.account?.accountKey}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={driveBusy}
                  data-testid="drive-switch-account-btn"
                  onClick={() => void handleConnectDrive('consent')}
                  className="ga-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
                >
                  <span>{s.driveSwitchAccountBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={driveBusy}
                  data-testid="drive-disconnect-btn"
                  onClick={() => void handleDisconnectDrive(false)}
                  className="ga-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{s.driveDisconnectBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={driveBusy}
                  data-testid="drive-revoke-btn"
                  onClick={() => void handleDisconnectDrive(true)}
                  className="ga-status-error inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
                >
                  <span>{s.driveRevokeBtn}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] ga-text-muted">{s.driveDisconnectNote}</p>

            {/* Vault Passphrase Unlock / Initialize */}
            {!vaultUnlocked ? (
              <form
                onSubmit={handleUnlockDriveVault}
                data-testid="drive-unlock-form"
                className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-2.5"
              >
                <label className="block text-xs font-medium ga-text">
                  {s.drivePassphraseLabel}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="password"
                    value={drivePass}
                    onChange={(e) => setDrivePass(e.target.value)}
                    placeholder={s.drivePassphrasePlaceholder}
                    data-testid="drive-passphrase-input"
                    className="ga-input w-full sm:w-auto sm:flex-1 min-w-0 rounded-xl px-3 py-2 text-xs min-h-[42px]"
                  />
                  <button
                    type="submit"
                    disabled={driveBusy || drivePass.length < 8}
                    data-testid="drive-unlock-btn"
                    className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50 min-h-[42px] cursor-pointer"
                  >
                    <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{s.driveUnlockBtn}</span>
                  </button>
                </div>
                {drivePass.length > 0 && (
                  <div className="text-[11px] ga-text-muted">
                    Strength:{' '}
                    <span
                      className={
                        drivePassStrength.score === 'strong'
                          ? 'text-[var(--ga-success-text)] font-semibold'
                          : drivePassStrength.score === 'fair'
                            ? 'text-[var(--ga-warning-text)] font-semibold'
                            : 'text-[var(--ga-error-text)] font-semibold'
                      }
                    >
                      {drivePassStrength.score}
                    </span>
                  </div>
                )}
              </form>
            ) : (
              <div className="space-y-4" data-testid="drive-unlocked-panel">
                <div className="ga-surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl border ga-border-strong p-3 text-xs">
                  <div className="space-y-1 ga-text-secondary">
                    <div className="font-mono text-[11px] text-[var(--ga-success-text)] font-semibold">
                      Vault ID: {currentKeyring?.vaultId ?? driveStatus?.vaultId} · Epoch{' '}
                      {currentKeyring?.currentEpoch ?? 1}
                    </div>
                    <div>
                      {s.driveLastSynced}:{' '}
                      <strong className="ga-text" data-testid="drive-last-synced">
                        {persistedState?.lastSyncedAt
                          ? new Date(persistedState.lastSyncedAt).toLocaleString()
                          : s.driveNeverSynced}
                      </strong>
                      {' · '}
                      {s.drivePendingQueue}:{' '}
                      <strong className="ga-text-accent" data-testid="drive-pending-count">
                        {persistedState?.pendingQueue.length ?? 0}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={driveBusy}
                    data-testid="drive-sync-now-btn"
                    onClick={() => void handleSyncDriveNow()}
                    className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50 min-h-[40px] cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${driveBusy ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{driveBusy ? s.driveSyncingBtn : s.driveSyncNowBtn}</span>
                  </button>
                </div>

                {persistedState?.rollbackWarning && (
                  <div
                    role="alert"
                    data-testid="drive-rollback-warning"
                    className="ga-status-error rounded-xl border p-3 text-xs flex items-start gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{persistedState.rollbackWarning}</span>
                  </div>
                )}

                {/* Sync Conflicts */}
                {persistedState && persistedState.conflicts.length > 0 && (
                  <div
                    data-testid="drive-conflicts-list"
                    className="ga-status-warning rounded-xl border p-3 space-y-2.5"
                  >
                    <div className="text-xs font-semibold">
                      {s.driveConflictsTitle} ({persistedState.conflicts.length})
                    </div>
                    {persistedState.conflicts.map((c) => (
                      <div
                        key={c.id}
                        data-testid={`drive-conflict-${c.id}`}
                        className="ga-card-solid rounded-lg border ga-border p-2.5 space-y-2 text-xs"
                      >
                        <div className="font-medium ga-text">
                          {c.entityType}: {c.label}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={driveBusy}
                            data-testid={`drive-conflict-keep-local-${c.id}`}
                            onClick={() => void handleResolveConflict(c.id, 'keep-local')}
                            className="ga-btn-secondary rounded-lg px-2.5 py-1 text-[11px] cursor-pointer"
                          >
                            {s.driveKeepLocalBtn}
                          </button>
                          <button
                            type="button"
                            disabled={driveBusy}
                            data-testid={`drive-conflict-accept-remote-${c.id}`}
                            onClick={() => void handleResolveConflict(c.id, 'accept-remote')}
                            className="ga-status-success rounded-lg border px-2.5 py-1 text-[11px] cursor-pointer"
                          >
                            {s.driveAcceptRemoteBtn}
                          </button>
                          {c.entityType !== 'setting' && (
                            <button
                              type="button"
                              disabled={driveBusy}
                              data-testid={`drive-conflict-keep-both-${c.id}`}
                              onClick={() => void handleResolveConflict(c.id, 'keep-both')}
                              className="ga-btn-secondary rounded-lg px-2.5 py-1 text-[11px] cursor-pointer"
                            >
                              {s.driveKeepBothBtn}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional Opt-In Encrypted Key Recovery Backup */}
                <details
                  data-testid="drive-recovery-section"
                  className="ga-surface-subtle rounded-xl border ga-border p-3.5 text-xs space-y-3"
                >
                  <summary className="cursor-pointer font-semibold ga-text flex items-center gap-2 min-h-[32px]">
                    <ShieldCheck className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
                    <span>{dr.recoverySectionTitle}</span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="ga-text-secondary leading-relaxed">{dr.recoverySectionDesc}</p>
                    <p className="ga-status-warning rounded-xl border px-3 py-2 text-[11px] leading-relaxed">
                      {dr.recoveryOptInWarning}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {keysWithEncryptedEnvelope.length > 0 && (
                        <select
                          value={selectedRecoveryKeyId}
                          onChange={(e) => {
                            setSelectedRecoveryKeyId(e.target.value);
                            setUploadedEnvelope(null);
                            setUploadedEnvelopeName(null);
                          }}
                          className="ga-input rounded-xl px-3 py-2 text-xs min-h-[40px]"
                        >
                          {keysWithEncryptedEnvelope.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.label} ({k.fingerprintShort})
                            </option>
                          ))}
                        </select>
                      )}

                      <label className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[40px] cursor-pointer">
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{uploadedEnvelopeName || '.chkey.json'}</span>
                        <input
                          type="file"
                          accept=".json,.chkey.json,application/json"
                          onChange={(e) => void handlePickRecoveryKeyFile(e)}
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={
                          recoveryBusy ||
                          (!uploadedEnvelope && !selectedRecoveryKeyId)
                        }
                        data-testid="drive-recovery-upload-btn"
                        onClick={() => void handleUploadRecoveryBackup()}
                        className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50 min-h-[40px] cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{dr.recoveryUploadBtn}</span>
                      </button>

                      <button
                        type="button"
                        disabled={recoveryBusy}
                        data-testid="drive-recovery-refresh-btn"
                        onClick={() => void handleRefreshRecoveryBackups()}
                        className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs min-h-[40px] cursor-pointer"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${recoveryBusy ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>{dr.recoveryRefreshBtn}</span>
                      </button>
                    </div>

                    {recoveryLoaded && recoveryEntries.length === 0 && (
                      <p className="text-xs ga-text-muted">{dr.recoveryNoBackups}</p>
                    )}

                    {recoveryEntries.length > 0 && (
                      <ul data-testid="drive-recovery-list" className="space-y-2">
                        {recoveryEntries.map((entry) => (
                          <li
                            key={entry.publicKey}
                            className="ga-card-solid rounded-xl border ga-border p-3 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold ga-text">{entry.label}</div>
                                <div className="font-mono text-[11px] ga-text-muted">
                                  {entry.fingerprint.slice(0, 16)} ·{' '}
                                  {new Date(entry.uploadedAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="password"
                                value={restorePassByKey[entry.publicKey] ?? ''}
                                onChange={(e) =>
                                  setRestorePassByKey((prev) => ({
                                    ...prev,
                                    [entry.publicKey]: e.target.value,
                                  }))
                                }
                                placeholder={dr.recoveryRestorePassPlaceholder}
                                data-testid="drive-recovery-restore-pass"
                                className="ga-input flex-1 min-w-[200px] rounded-xl px-3 py-1.5 text-xs min-h-[38px]"
                              />
                              <button
                                type="button"
                                disabled={
                                  recoveryBusy || !(restorePassByKey[entry.publicKey] ?? '').trim()
                                }
                                data-testid="drive-recovery-restore-btn"
                                onClick={() => void handleRestoreRecoveryEntry(entry.publicKey)}
                                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50 min-h-[38px] cursor-pointer"
                              >
                                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{dr.recoveryRestoreBtn}</span>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>

                {/* Cross-Device Key Share & Key Epoch Rotation */}
                <details className="ga-surface-subtle rounded-xl border ga-border p-3 text-xs space-y-3">
                  <summary className="cursor-pointer font-semibold ga-text flex items-center gap-2 min-h-[32px]">
                    <KeyRound className="h-3.5 w-3.5 ga-text-accent" aria-hidden="true" />
                    <span>{s.driveKeyShareTitle}</span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="password"
                        value={transferPass}
                        onChange={(e) => setTransferPass(e.target.value)}
                        placeholder={s.driveTransferPassPlaceholder}
                        data-testid="drive-transfer-pass-input"
                        className="ga-input flex-1 min-w-[200px] rounded-xl px-3 py-2 text-xs min-h-[38px]"
                      />
                      <button
                        type="button"
                        disabled={driveBusy || transferPass.length < 8}
                        data-testid="drive-export-keyshare-btn"
                        onClick={() => void handleExportKeyShare()}
                        className="ga-btn-secondary rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 cursor-pointer"
                      >
                        {s.driveExportKeyShareBtn}
                      </button>
                    </div>

                    {exportedKeyShare && (
                      <div className="space-y-1.5">
                        <textarea
                          readOnly
                          rows={2}
                          value={exportedKeyShare}
                          data-testid="drive-keyshare-output"
                          className="ga-input w-full rounded-xl p-2 text-[11px] font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => void handleCopyShare()}
                          className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] cursor-pointer"
                        >
                          {copiedShare ? (
                            <Check className="h-3 w-3 text-[var(--ga-success-text)]" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>{copiedShare ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t ga-border space-y-2">
                      <textarea
                        rows={2}
                        value={importKeyShareJson}
                        onChange={(e) => setImportKeyShareJson(e.target.value)}
                        placeholder={s.driveImportKeySharePlaceholder}
                        data-testid="drive-import-keyshare-input"
                        className="ga-input w-full rounded-xl p-2 text-[11px] font-mono"
                      />
                      <button
                        type="button"
                        disabled={driveBusy || !importKeyShareJson.trim() || transferPass.length < 8}
                        data-testid="drive-import-keyshare-btn"
                        onClick={() => void handleImportKeyShare()}
                        className="ga-btn-secondary rounded-xl px-3 py-1.5 text-xs disabled:opacity-50 cursor-pointer"
                      >
                        {s.driveImportKeyShareBtn}
                      </button>
                    </div>

                    <div className="pt-2 border-t ga-border space-y-1.5">
                      <button
                        type="button"
                        disabled={driveBusy || (drivePass.length < 8 && transferPass.length < 8)}
                        data-testid="drive-rotate-epoch-btn"
                        onClick={() => void handleRotateEpoch()}
                        className="ga-status-warning rounded-xl border px-3 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer"
                      >
                        {s.driveRotateEpochBtn}
                      </button>
                      <p className="text-[11px] ga-text-muted leading-relaxed">
                        {s.driveRotateEpochNote}
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {driveError && (
          <FriendlyErrorAlert
            error={driveError}
            onDismiss={() => setDriveError(null)}
            testId="drive-error-msg"
          />
        )}
        {driveMsg && (
          <p
            role="status"
            data-testid="drive-status-msg"
            className="ga-status-success rounded-xl border px-3 py-2 text-xs"
          >
            {driveMsg}
          </p>
        )}
      </div>

      <DiscordWebhookSettings />
    </section>
  );
}
