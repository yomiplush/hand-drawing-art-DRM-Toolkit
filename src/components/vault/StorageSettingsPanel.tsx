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
  RefreshCw,
  ShieldAlert,
  Unlock,
  Upload,
} from 'lucide-react';
import { evaluatePassphraseStrength } from '../../core/crypto/keyBackup';
import {
  checkGoogleDriveEnvironmentSupport,
  defaultGoogleDriveProvider,
} from '../../core/google';
import type { GoogleAuthSessionState } from '../../core/google/gisAuth';
import {
  IndexedDbStorageProvider,
  PORTABLE_VAULT_FILE_EXTENSION,
  PortableFileStorageProvider,
  type StorageProviderStatus,
} from '../../core/storage/providers';
import {
  unlockDriveVaultFromKeyShare,
  type PersistedDriveAccountState,
} from '../../core/vault/driveSyncEngine';
import type { CrossDeviceVaultKeyShareEnvelope } from '../../core/vault/vaultCrypto';
import { useI18n } from '../../i18n/context';

interface StorageSettingsPanelProps {
  onVaultChanged?: () => Promise<void> | void;
}

const indexedDbProvider = new IndexedDbStorageProvider();
const portableFileProvider = new PortableFileStorageProvider();

export function StorageSettingsPanel({ onVaultChanged }: StorageSettingsPanelProps) {
  const { t } = useI18n();
  const s = t.nextGen.storage;

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

  const refreshAll = useCallback(async () => {
    const [nextIdb, nextDrive, nextPersisted] = await Promise.all([
      indexedDbProvider.getStatus(),
      defaultGoogleDriveProvider.getStatus(),
      defaultGoogleDriveProvider.getPersistedAccountState(),
    ]);
    setIdbStatus(nextIdb);
    setDriveStatus(nextDrive);
    setAuthState(defaultGoogleDriveProvider.getAuthManager().getState());
    setPersistedState(nextPersisted);
    setVaultUnlocked(defaultGoogleDriveProvider.isVaultUnlocked());
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
      a.click();
      URL.revokeObjectURL(url);
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

  const currentKeyring = defaultGoogleDriveProvider.getUnlockedKeyring();

  return (
    <section
      data-testid="storage-settings-panel"
      className="rounded-2xl border border-white/[0.12] bg-[#051224]/75 backdrop-blur-md p-4 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.08] pb-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-semibold text-white">{s.pageTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{s.pageSubtitle}</p>
        </div>
        <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 shrink-0">
          {s.sectionBadge}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. IndexedDB Primary Store */}
        <div
          data-testid="storage-provider-indexeddb"
          className="rounded-xl border border-emerald-400/25 bg-[#030b18]/80 p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-300 shrink-0" aria-hidden="true" />
              <span>{s.localTitle}</span>
            </h3>
            <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200">
              {idbStatus?.active ? 'Active' : 'Ready'}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{s.localDesc}</p>
          {idbStatus?.detail && (
            <p className="text-[11px] text-slate-400 font-mono">{idbStatus.detail}</p>
          )}
        </div>

        {/* 2. Portable Encrypted File Provider (.chmvault.json) */}
        <div
          data-testid="storage-provider-portable"
          className="rounded-xl border border-white/[0.1] bg-[#030b18]/80 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileArchive className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{s.portableTitle}</span>
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{s.portableDesc}</p>

          <div className="space-y-2">
            <input
              type="password"
              value={portablePass}
              onChange={(e) => setPortablePass(e.target.value)}
              placeholder={s.portablePassPlaceholder}
              data-testid="portable-passphrase-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[40px]"
            />
            {portablePass.length > 0 && (
              <div className="text-[11px] text-slate-400">
                Strength:{' '}
                <span
                  className={
                    portablePassStrength.score === 'strong'
                      ? 'text-emerald-300'
                      : portablePassStrength.score === 'fair'
                        ? 'text-amber-300'
                        : 'text-rose-300'
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.exportChmvaultBtn}</span>
              </button>

              <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.16] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[40px] cursor-pointer">
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
            <p role="alert" className="text-xs text-rose-300">
              {portableError}
            </p>
          )}
          {portableMsg && (
            <p role="status" data-testid="portable-status-msg" className="text-xs text-emerald-300">
              {portableMsg}
            </p>
          )}
        </div>
      </div>

      {/* 3. Google Drive Encrypted Vault Sync */}
      <div
        data-testid="storage-provider-google-drive"
        className="rounded-xl border border-sky-400/25 bg-[#030b18]/85 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{s.driveTitle}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{s.driveDesc}</p>
          </div>
          {authState.connected && (
            <span
              data-testid="drive-scope-badge"
              className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-mono text-emerald-200 shrink-0"
            >
              {s.driveScopeBadge}
            </span>
          )}
        </div>

        {/* Security & Identity Boundary Notices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg border border-white/[0.08] bg-[#051224]/70 px-3 py-2 text-slate-300 flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{s.driveMemoryNotice}</span>
          </div>
          <div className="rounded-lg border border-amber-400/25 bg-amber-500/5 px-3 py-2 text-amber-100/90 flex items-start gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{s.driveIdentityNotice}</span>
          </div>
        </div>

        {!envSupport.supported ? (
          <div
            data-testid="drive-standalone-notice"
            className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-3 text-xs text-amber-100 flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">{s.driveStandaloneNotice}</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">{envSupport.message}</p>
            </div>
          </div>
        ) : !authState.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={driveBusy}
              data-testid="drive-connect-btn"
              onClick={() => void handleConnectDrive('select_account')}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-300 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <Cloud className="h-4 w-4" aria-hidden="true" />
              <span>{s.driveConnectBtn}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected Google Account Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.1] bg-[#051224]/70 px-3.5 py-2.5 text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400">{s.driveConnectedAs}</div>
                <div className="font-semibold text-white" data-testid="drive-account-label">
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
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.14] bg-[#030b18] px-2.5 py-1.5 text-xs text-slate-200 hover:border-sky-400/40 min-h-[36px] cursor-pointer"
                >
                  <span>{s.driveSwitchAccountBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={driveBusy}
                  data-testid="drive-disconnect-btn"
                  onClick={() => void handleDisconnectDrive(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.14] bg-[#030b18] px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-400/40 min-h-[36px] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{s.driveDisconnectBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={driveBusy}
                  data-testid="drive-revoke-btn"
                  onClick={() => void handleDisconnectDrive(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20 min-h-[36px] cursor-pointer"
                >
                  <span>{s.driveRevokeBtn}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">{s.driveDisconnectNote}</p>

            {/* Vault Passphrase Unlock / Initialize */}
            {!vaultUnlocked ? (
              <form
                onSubmit={handleUnlockDriveVault}
                data-testid="drive-unlock-form"
                className="rounded-lg border border-sky-400/25 bg-[#051224]/70 p-3.5 space-y-2.5"
              >
                <label className="block text-xs font-medium text-slate-200">
                  {s.drivePassphraseLabel}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="password"
                    value={drivePass}
                    onChange={(e) => setDrivePass(e.target.value)}
                    placeholder={s.drivePassphrasePlaceholder}
                    data-testid="drive-passphrase-input"
                    className="flex-1 min-w-[220px] rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[42px]"
                  />
                  <button
                    type="submit"
                    disabled={driveBusy || drivePass.length < 8}
                    data-testid="drive-unlock-btn"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-300 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50 min-h-[42px] cursor-pointer"
                  >
                    <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{s.driveUnlockBtn}</span>
                  </button>
                </div>
                {drivePass.length > 0 && (
                  <div className="text-[11px] text-slate-400">
                    Strength:{' '}
                    <span
                      className={
                        drivePassStrength.score === 'strong'
                          ? 'text-emerald-300'
                          : drivePassStrength.score === 'fair'
                            ? 'text-amber-300'
                            : 'text-rose-300'
                      }
                    >
                      {drivePassStrength.score}
                    </span>
                  </div>
                )}
              </form>
            ) : (
              <div className="space-y-3" data-testid="drive-unlocked-panel">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-400/25 bg-[#051224]/75 p-3 text-xs">
                  <div className="space-y-1 text-slate-300">
                    <div className="font-mono text-[11px] text-emerald-200">
                      Vault ID: {currentKeyring?.vaultId ?? driveStatus?.vaultId} · Epoch{' '}
                      {currentKeyring?.currentEpoch ?? 1}
                    </div>
                    <div>
                      {s.driveLastSynced}:{' '}
                      <strong className="text-white" data-testid="drive-last-synced">
                        {persistedState?.lastSyncedAt
                          ? new Date(persistedState.lastSyncedAt).toLocaleString()
                          : s.driveNeverSynced}
                      </strong>
                      {' · '}
                      {s.drivePendingQueue}:{' '}
                      <strong className="text-sky-200" data-testid="drive-pending-count">
                        {persistedState?.pendingQueue.length ?? 0}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={driveBusy}
                    data-testid="drive-sync-now-btn"
                    onClick={() => void handleSyncDriveNow()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-300 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50 min-h-[40px] cursor-pointer"
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
                    className="rounded-lg border border-rose-400/40 bg-rose-500/15 p-3 text-xs text-rose-100 flex items-start gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 text-rose-300 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{persistedState.rollbackWarning}</span>
                  </div>
                )}

                {/* Sync Conflicts */}
                {persistedState && persistedState.conflicts.length > 0 && (
                  <div
                    data-testid="drive-conflicts-list"
                    className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-3 space-y-2.5"
                  >
                    <div className="text-xs font-semibold text-amber-200">
                      {s.driveConflictsTitle} ({persistedState.conflicts.length})
                    </div>
                    {persistedState.conflicts.map((c) => (
                      <div
                        key={c.id}
                        data-testid={`drive-conflict-${c.id}`}
                        className="rounded-lg border border-white/[0.1] bg-[#030b18]/80 p-2.5 space-y-2 text-xs"
                      >
                        <div className="font-medium text-white">
                          {c.entityType}: {c.label}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={driveBusy}
                            data-testid={`drive-conflict-keep-local-${c.id}`}
                            onClick={() => void handleResolveConflict(c.id, 'keep-local')}
                            className="rounded-md border border-sky-400/35 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100 cursor-pointer"
                          >
                            {s.driveKeepLocalBtn}
                          </button>
                          <button
                            type="button"
                            disabled={driveBusy}
                            data-testid={`drive-conflict-accept-remote-${c.id}`}
                            onClick={() => void handleResolveConflict(c.id, 'accept-remote')}
                            className="rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-100 cursor-pointer"
                          >
                            {s.driveAcceptRemoteBtn}
                          </button>
                          {c.entityType !== 'setting' && (
                            <button
                              type="button"
                              disabled={driveBusy}
                              data-testid={`drive-conflict-keep-both-${c.id}`}
                              onClick={() => void handleResolveConflict(c.id, 'keep-both')}
                              className="rounded-md border border-white/[0.16] bg-[#051224] px-2.5 py-1 text-[11px] text-slate-200 cursor-pointer"
                            >
                              {s.driveKeepBothBtn}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cross-Device Key Share & Key Epoch Rotation */}
                <details className="rounded-lg border border-white/[0.1] bg-[#051224]/60 p-3 text-xs space-y-3">
                  <summary className="cursor-pointer font-semibold text-slate-200 hover:text-white flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
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
                        className="flex-1 min-w-[200px] rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[38px]"
                      />
                      <button
                        type="button"
                        disabled={driveBusy || transferPass.length < 8}
                        data-testid="drive-export-keyshare-btn"
                        onClick={() => void handleExportKeyShare()}
                        className="rounded-lg border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-100 disabled:opacity-50 cursor-pointer"
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
                          className="w-full rounded-lg border border-emerald-400/35 bg-[#020813] p-2 text-[11px] font-mono text-emerald-200"
                        />
                        <button
                          type="button"
                          onClick={() => void handleCopyShare()}
                          className="inline-flex items-center gap-1 rounded-md border border-white/[0.14] px-2.5 py-1 text-[11px] text-slate-200 cursor-pointer"
                        >
                          {copiedShare ? (
                            <Check className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>{copiedShare ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/[0.08] space-y-2">
                      <textarea
                        rows={2}
                        value={importKeyShareJson}
                        onChange={(e) => setImportKeyShareJson(e.target.value)}
                        placeholder={s.driveImportKeySharePlaceholder}
                        data-testid="drive-import-keyshare-input"
                        className="w-full rounded-lg border border-white/[0.14] bg-[#020813] p-2 text-[11px] font-mono text-white"
                      />
                      <button
                        type="button"
                        disabled={driveBusy || !importKeyShareJson.trim() || transferPass.length < 8}
                        data-testid="drive-import-keyshare-btn"
                        onClick={() => void handleImportKeyShare()}
                        className="rounded-lg border border-white/[0.16] bg-[#030b18] px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50 cursor-pointer"
                      >
                        {s.driveImportKeyShareBtn}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-white/[0.08] space-y-1.5">
                      <button
                        type="button"
                        disabled={driveBusy || (drivePass.length < 8 && transferPass.length < 8)}
                        data-testid="drive-rotate-epoch-btn"
                        onClick={() => void handleRotateEpoch()}
                        className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100 disabled:opacity-50 cursor-pointer"
                      >
                        {s.driveRotateEpochBtn}
                      </button>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
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
          <p role="alert" data-testid="drive-error-msg" className="text-xs text-rose-300">
            {driveError}
          </p>
        )}
        {driveMsg && (
          <p role="status" data-testid="drive-status-msg" className="text-xs text-emerald-300">
            {driveMsg}
          </p>
        )}
      </div>
    </section>
  );
}
