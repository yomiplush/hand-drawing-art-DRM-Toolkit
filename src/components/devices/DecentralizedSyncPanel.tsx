import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  exportDeviceNostrBackupNcryptsec,
  importDeviceNostrBackupNcryptsec,
} from '../../core/nostr/nostrKeyStore';
import type { NostrDeviceKeyRecord } from '../../core/nostr/nostrKeyStore';
import {
  addRelayConfig,
  announceLocalBindingToKnownPeers,
  disableDecentralizedSync,
  enableDecentralizedSync,
  importPeerSyncBindingInput,
  probeAndSaveRelayPolicy,
  removeRelayConfig,
  runDecentralizedSyncCycle,
  saveSyncSettings,
  syncSelectedVaultProofs,
  toggleRelayConfig,
} from '../../core/sync';
import { CURATED_DEFAULT_RELAY_PRESETS } from '../../core/sync/types';
import type {
  SyncSettings,
  SyncStatusSummary,
  VerifiedPeerBinding,
} from '../../core/sync/types';
import type { DeviceIdentityRecord } from '../../core/storage/devicePairingStore';
import type { AuthorKeyRecord } from '../../core/storage/keyStore';
import { useI18n } from '../../i18n/context';

interface DecentralizedSyncPanelProps {
  settings: SyncSettings;
  status: SyncStatusSummary;
  localDevice: DeviceIdentityRecord | null;
  nostrKey: NostrDeviceKeyRecord | null;
  localBindingToken: string | null;
  peerBindings: VerifiedPeerBinding[];
  authorKeys: AuthorKeyRecord[];
  selectedAuthorKeyId: string;
  onRefresh: () => Promise<void>;
}

export function DecentralizedSyncPanel({
  settings,
  status,
  localDevice,
  nostrKey,
  localBindingToken,
  peerBindings,
  authorKeys,
  selectedAuthorKeyId,
  onRefresh,
}: DecentralizedSyncPanelProps) {
  const { t } = useI18n();
  const s = t.devices.sync;

  const [consentChecked, setConsentChecked] = useState(settings.consentAccepted);
  const [ownerPassInput, setOwnerPassInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [relayInput, setRelayInput] = useState('');
  const [relayError, setRelayError] = useState<string | null>(null);
  const [checkingRelayUrl, setCheckingRelayUrl] = useState<string | null>(null);
  const [vaultSyncMsg, setVaultSyncMsg] = useState<string | null>(null);

  const [peerCardInput, setPeerCardInput] = useState('');
  const [peerImportMsg, setPeerImportMsg] = useState<string | null>(null);
  const [peerImportError, setPeerImportError] = useState<string | null>(null);

  const [backupPass, setBackupPass] = useState('');
  const [exportedNcryptsec, setExportedNcryptsec] = useState<string | null>(null);
  const [importNcryptsecInput, setImportNcryptsecInput] = useState('');
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const selectedOwner = authorKeys.find((k) => k.id === selectedAuthorKeyId);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleEnableSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSyncing(true);
    try {
      await enableDecentralizedSync({
        acceptConsent: consentChecked || settings.consentAccepted,
        authorKeyId: selectedAuthorKeyId || undefined,
        ownerPassphrase: ownerPassInput || undefined,
        useDefaultPresets: true,
      });
      setOwnerPassInput('');
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to enable sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisableSync = async () => {
    setActionError(null);
    try {
      await disableDecentralizedSync();
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to disable sync');
    }
  };

  const handleSyncNow = async () => {
    setActionError(null);
    setSyncing(true);
    try {
      await announceLocalBindingToKnownPeers().catch(() => {});
      const report = await runDecentralizedSyncCycle();
      if (report.skipped && report.skipReason) {
        setActionError(report.skipReason);
      }
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    setRelayError(null);
    try {
      await addRelayConfig(relayInput);
      setRelayInput('');
      await onRefresh();
    } catch (err) {
      setRelayError(err instanceof Error ? err.message : 'Invalid relay URL');
    }
  };

  const handleProbeRelay = async (url: string) => {
    setRelayError(null);
    setCheckingRelayUrl(url);
    try {
      const res = await probeAndSaveRelayPolicy(url);
      if (res.error) {
        setRelayError(res.error);
      }
      await onRefresh();
    } catch (err) {
      setRelayError(err instanceof Error ? err.message : 'NIP-11 policy check failed');
    } finally {
      setCheckingRelayUrl(null);
    }
  };

  const handleToggleVaultSync = async (checked: boolean) => {
    await saveSyncSettings({ ...settings, syncVaultProofs: checked });
    await onRefresh();
  };

  const handleSyncVaultNow = async () => {
    setActionError(null);
    setVaultSyncMsg(null);
    setSyncing(true);
    try {
      const res = await syncSelectedVaultProofs({
        includeProfile: true,
        includeTrustedArtists: true,
      });
      setVaultSyncMsg(
        res.skippedDueToBudget
          ? s.gracefulFallbackTitle
          : `${s.syncVaultProofsSuccess} (${res.syncedProofCount})`,
      );
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Vault sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleLoadPresetRelays = async () => {
    setRelayError(null);
    try {
      const mergedMap = new Map(settings.relays.map((r) => [r.url, r]));
      for (const preset of CURATED_DEFAULT_RELAY_PRESETS) {
        if (!mergedMap.has(preset.url)) {
          mergedMap.set(preset.url, { ...preset });
        }
      }
      await saveSyncSettings({
        ...settings,
        relays: Array.from(mergedMap.values()),
      });
      await onRefresh();
    } catch (err) {
      setRelayError(err instanceof Error ? err.message : 'Failed to load default relays');
    }
  };

  const handleImportPeerCard = async () => {
    setPeerImportError(null);
    setPeerImportMsg(null);
    try {
      const res = await importPeerSyncBindingInput(peerCardInput);
      if (!res.accepted) {
        throw new Error(res.reason || 'Peer card was rejected');
      }
      setPeerCardInput('');
      setPeerImportMsg(`${s.importPeerCardSuccess} (${res.binding.deviceIdHex.slice(0, 8)})`);
      if (settings.enabled && settings.consentAccepted) {
        await announceLocalBindingToKnownPeers({
          ownerFingerprintHex: res.binding.ownerFingerprintHex,
        }).catch(() => {});
        await runDecentralizedSyncCycle().catch(() => {});
      }
      await onRefresh();
    } catch (err) {
      setPeerImportError(err instanceof Error ? err.message : 'Invalid sync peer card');
    }
  };

  const handleExportNcryptsec = async () => {
    setBackupError(null);
    setBackupMsg(null);
    setExportedNcryptsec(null);
    if (!localDevice) {
      setBackupError('No local Device Identity exists yet.');
      return;
    }
    if (!backupPass || backupPass.length < 4) {
      setBackupError('Please enter a password to encrypt the backup.');
      return;
    }
    try {
      const res = await exportDeviceNostrBackupNcryptsec({
        deviceIdHex: localDevice.deviceIdHex,
        backupPassword: backupPass,
      });
      setExportedNcryptsec(res.ncryptsec);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to export ncryptsec');
    }
  };

  const handleImportNcryptsec = async () => {
    setBackupError(null);
    setBackupMsg(null);
    if (!localDevice) {
      setBackupError('Create or open a Device Identity first.');
      return;
    }
    if (!backupPass) {
      setBackupError('Enter the password used to decrypt ncryptsec.');
      return;
    }
    try {
      await importDeviceNostrBackupNcryptsec({
        deviceIdHex: localDevice.deviceIdHex,
        ncryptsec: importNcryptsecInput,
        backupPassword: backupPass,
        disallowedEd25519Bytes: [localDevice.publicKey],
      });
      setImportNcryptsecInput('');
      setBackupMsg(s.importNcryptsecSuccess);
      await onRefresh();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to import ncryptsec');
    }
  };

  const badgeClass =
    status.health === 'synced-observable'
      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
      : status.health === 'partial-relays' || status.health === 'offline'
        ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
        : status.health === 'error-unreachable'
          ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
          : 'border-white/[0.14] bg-white/[0.04] text-slate-300';

  const statusText = syncing ? s.syncingLabel : s.statusLabels[status.health];

  return (
    <div data-testid="decentralized-sync-panel" className="space-y-6 min-w-0">
      <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white">{s.sectionTitle}</h2>
            <p className="text-xs text-slate-300 leading-relaxed">{s.sectionSubtitle}</p>
          </div>
          <span
            data-testid="sync-status-badge"
            className={`rounded-full border px-3 py-1 text-xs font-semibold shrink-0 ${badgeClass}`}
          >
            {statusText}
          </span>
        </div>

        {!settings.enabled ? (
          <form
            onSubmit={handleEnableSync}
            data-testid="sync-consent-panel"
            className="rounded-xl border border-sky-400/30 bg-[#030b18]/80 p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-sky-200">{s.consentTitle}</h3>
            <ul className="space-y-1.5 list-disc ps-4 text-xs text-slate-300 leading-relaxed">
              {s.consentPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>

            {selectedOwner?.storageMode === 'noble-encrypted-seed' && (
              <div className="pt-1">
                <label className="block text-xs text-slate-300 mb-1">
                  {t.devices.ownerPassphraseLabel}
                </label>
                <input
                  type="password"
                  value={ownerPassInput}
                  onChange={(e) => setOwnerPassInput(e.target.value)}
                  placeholder={t.devices.ownerPassphrasePlaceholder}
                  className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[44px]"
                />
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={consentChecked || settings.consentAccepted}
                onChange={(e) => setConsentChecked(e.target.checked)}
                data-testid="sync-consent-checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-500"
              />
              <span>{s.consentCheckbox}</span>
            </label>

            {actionError && (
              <p role="alert" data-testid="sync-action-error" className="text-xs text-rose-300">
                {actionError}
              </p>
            )}

            <button
              type="submit"
              disabled={(!consentChecked && !settings.consentAccepted) || syncing}
              data-testid="sync-enable-btn"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-300 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{s.enableBtn}</span>
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#030b18]/75 p-3.5 text-xs">
              <div className="space-y-1 text-slate-300">
                <div>
                  {s.queuedUpdatesLabel}:{' '}
                  <strong className="text-white" data-testid="sync-queued-count">
                    {status.queuedOutboxCount}
                  </strong>
                  {' · '}
                  {s.lastSyncedLabel}:{' '}
                  <strong className="text-white">
                    {status.lastSuccessfulSyncAt
                      ? new Date(status.lastSuccessfulSyncAt).toLocaleString()
                      : s.neverSyncedLabel}
                  </strong>
                </div>
                <div className="text-[11px] text-slate-300" data-testid="sync-budget-usage">
                  {s.onlineBudgetLabel}:{' '}
                  <strong className="text-sky-200">
                    {(status.syncWindowBytesUsed / 1024).toFixed(1)} KiB /{' '}
                    {(status.onlineSyncBudgetBytes / 1024).toFixed(0)} KiB (¥0)
                  </strong>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{s.honestGuaranteeNote}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={syncing}
                  data-testid="sync-now-btn"
                  onClick={() => void handleSyncNow()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-300 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{syncing ? s.syncingLabel : s.syncNowBtn}</span>
                </button>
                <button
                  type="button"
                  data-testid="sync-disable-btn"
                  onClick={() => void handleDisableSync()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.16] bg-[#051224] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-rose-400/40 min-h-[44px] cursor-pointer"
                >
                  <span>{s.disableBtn}</span>
                </button>
              </div>
            </div>

            {status.gracefulFallbackReason !== 'none' && (
              <div
                data-testid="sync-graceful-fallback"
                className="rounded-xl border border-sky-400/35 bg-sky-500/10 p-3.5 space-y-1.5 text-xs text-slate-200"
              >
                <div className="font-semibold text-sky-200">{s.gracefulFallbackTitle}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {s.gracefulFallbackBody}
                </p>
                <Link
                  to="/vault"
                  className="inline-block text-[11px] font-semibold text-sky-300 underline underline-offset-4 hover:text-sky-200"
                >
                  {s.gracefulFallbackExportLink}
                </Link>
              </div>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer flex-1 min-w-[200px]">
                <input
                  type="checkbox"
                  checked={settings.syncVaultProofs}
                  data-testid="sync-vault-proofs-checkbox"
                  onChange={(e) => void handleToggleVaultSync(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-500 shrink-0"
                />
                <span>{s.syncVaultProofsToggle}</span>
              </label>
              <button
                type="button"
                disabled={syncing}
                data-testid="sync-vault-proofs-btn"
                onClick={() => void handleSyncVaultNow()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/25 disabled:opacity-50 min-h-[36px] cursor-pointer"
              >
                <span>{s.syncVaultProofsBtn}</span>
              </button>
              {vaultSyncMsg && (
                <div className="w-full text-[11px] text-emerald-300" data-testid="sync-vault-msg">
                  {vaultSyncMsg}
                </div>
              )}
            </div>

            {status.hasCausalGap && (
              <div
                role="alert"
                data-testid="sync-causal-gap-alert"
                className="rounded-xl border border-amber-400/45 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-100"
              >
                <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {s.causalGapWarning} (Missing #{status.missingSequences.join(', #')})
                </span>
              </div>
            )}

            {actionError && (
              <p role="alert" data-testid="sync-action-error" className="text-xs text-rose-300">
                {actionError}
              </p>
            )}
          </div>
        )}
      </section>

      {settings.enabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Peer Sync Linking */}
          <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-3 min-w-0">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{s.peerCardTitle}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{s.peerCardDesc}</p>

            {localBindingToken && (
              <div className="space-y-2">
                <input
                  type="text"
                  readOnly
                  value={localBindingToken}
                  data-testid="sync-peer-card-output"
                  aria-label={s.peerCardTitle}
                  className="w-full rounded-lg border border-white/[0.12] bg-[#020813] px-3 py-2 text-xs font-mono text-slate-300"
                />
                <button
                  type="button"
                  data-testid="sync-copy-peer-card-btn"
                  onClick={() => void handleCopy('peer-card', localBindingToken)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#030b18] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                >
                  {copiedKey === 'peer-card' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedKey === 'peer-card' ? t.devices.copiedMsg : s.copyPeerCardBtn}</span>
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-white/[0.08] space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                {s.importPeerCardLabel}
              </label>
              <textarea
                rows={2}
                value={peerCardInput}
                onChange={(e) => setPeerCardInput(e.target.value)}
                placeholder={s.importPeerCardPlaceholder}
                data-testid="sync-peer-import-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs font-mono text-white"
              />
              {peerImportError && (
                <p role="alert" data-testid="sync-peer-import-error" className="text-xs text-rose-300">
                  {peerImportError}
                </p>
              )}
              {peerImportMsg && (
                <p role="status" data-testid="sync-peer-import-msg" className="text-xs text-emerald-300">
                  {peerImportMsg}
                </p>
              )}
              <button
                type="button"
                data-testid="sync-peer-import-btn"
                onClick={() => void handleImportPeerCard()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.importPeerCardBtn}</span>
              </button>
            </div>

            {peerBindings.length > 0 && (
              <div className="pt-2 border-t border-white/[0.08] space-y-1 text-[11px] text-slate-400">
                {peerBindings.map((pb) => (
                  <div key={pb.key} className="font-mono break-all">
                    {pb.deviceIdHex.slice(0, 8)}… → {pb.npub.slice(0, 22)}…
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Relay Configuration */}
          <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-4 sm:p-5 space-y-3 min-w-0">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-300 shrink-0" aria-hidden="true" />
              <span>{s.relaysTitle}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{s.relaysDesc}</p>

            <form onSubmit={handleAddRelay} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={relayInput}
                onChange={(e) => setRelayInput(e.target.value)}
                placeholder={s.addRelayPlaceholder}
                data-testid="sync-relay-add-input"
                className="flex-1 min-w-[200px] rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs font-mono text-white min-h-[44px]"
              />
              <button
                type="submit"
                data-testid="sync-relay-add-btn"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-white min-h-[44px] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.addRelayBtn}</span>
              </button>
            </form>

            {relayError && (
              <p role="alert" data-testid="sync-relay-error" className="text-xs text-rose-300">
                {relayError}
              </p>
            )}

            <ul data-testid="sync-relay-list" className="space-y-2">
              {settings.relays.map((r) => {
                const rt = status.relayStatuses.find((x) => x.url === r.url);
                return (
                  <li
                    key={r.url}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#030b18]/75 px-3 py-2 text-xs"
                  >
                    <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={(e) =>
                          void toggleRelayConfig(r.url, e.target.checked).then(onRefresh)
                        }
                        className="h-4 w-4 rounded border-slate-500 shrink-0"
                      />
                      <span className="font-mono text-slate-200 truncate">{r.url}</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {r.policyStatus && r.policyStatus !== 'unknown' && (
                        <span
                          data-testid="sync-relay-policy-badge"
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.policyStatus === 'free-usable'
                              ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30'
                              : r.policyStatus === 'payment-required'
                                ? 'bg-rose-500/15 text-rose-200 border border-rose-400/30'
                                : 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
                          }`}
                        >
                          {s.policyLabels[r.policyStatus]}
                        </span>
                      )}
                      {rt && (
                        <span className="text-[11px] text-slate-400">
                          {rt.state}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={checkingRelayUrl === r.url}
                        data-testid="sync-relay-probe-btn"
                        onClick={() => void handleProbeRelay(r.url)}
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.14] bg-[#051224] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400/40 disabled:opacity-50 cursor-pointer"
                      >
                        <span>{s.checkRelayPolicyBtn}</span>
                      </button>
                      <button
                        type="button"
                        data-testid="sync-relay-remove-btn"
                        aria-label={`${s.removeRelayBtn} ${r.url}`}
                        onClick={() => void removeRelayConfig(r.url).then(onRefresh)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        <span>{s.removeRelayBtn}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              data-testid="sync-load-presets-btn"
              onClick={() => void handleLoadPresetRelays()}
              className="text-xs font-medium text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer"
            >
              {s.loadPresetsBtn}
            </button>
          </section>
        </div>
      )}

      {/* Collapsible Advanced Section (Nostr Details & NIP-49 Backup) */}
      <details
        data-testid="sync-advanced-details"
        className="rounded-xl border border-white/[0.1] bg-[#051224]/60 p-4 text-xs text-slate-300"
      >
        <summary className="cursor-pointer font-semibold text-slate-200 hover:text-white">
          {s.advancedSummary}
        </summary>
        <div className="mt-3 space-y-3">
          {nostrKey && (
            <div className="space-y-1.5 font-mono text-[11px] break-all rounded-lg bg-[#030b18]/80 p-3 border border-white/[0.08]">
              <div>
                <span className="text-slate-400">{s.advancedNpubLabel}: </span>
                <span data-testid="sync-npub-display" className="text-sky-200">
                  {nostrKey.npub}
                </span>
              </div>
              <div>
                <span className="text-slate-400">{s.advancedKeyCustodyLabel}: </span>
                <span className="text-slate-200">{nostrKey.storageMode}</span>
              </div>
              <div>
                <span className="text-slate-400">{s.advancedProtocolLabel}: </span>
                <span className="text-slate-200">CHM-SYNC-v1 + NIP-01 / NIP-42 / NIP-44 / NIP-49 / NIP-59</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-amber-200/90 leading-relaxed">{s.advancedBrowserWarning}</p>

          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/75 p-3 space-y-2.5">
            <div className="font-semibold text-slate-200">{s.backupNcryptsecTitle}</div>
            <input
              type="password"
              value={backupPass}
              onChange={(e) => setBackupPass(e.target.value)}
              placeholder={s.backupPasswordPlaceholder}
              data-testid="sync-backup-password-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[44px]"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!nostrKey}
                data-testid="sync-export-ncryptsec-btn"
                onClick={() => void handleExportNcryptsec()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-500/25 disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                <span>{s.exportNcryptsecBtn}</span>
              </button>
            </div>
            {exportedNcryptsec && (
              <textarea
                readOnly
                rows={2}
                value={exportedNcryptsec}
                data-testid="sync-ncryptsec-output"
                className="w-full rounded-lg border border-emerald-400/35 bg-[#020813] px-3 py-2 text-xs font-mono text-emerald-200"
              />
            )}

            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <textarea
                rows={2}
                value={importNcryptsecInput}
                onChange={(e) => setImportNcryptsecInput(e.target.value)}
                placeholder={s.importNcryptsecPlaceholder}
                data-testid="sync-import-ncryptsec-input"
                className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs font-mono text-white"
              />
              <button
                type="button"
                data-testid="sync-import-ncryptsec-btn"
                onClick={() => void handleImportNcryptsec()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.16] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
              >
                <span>{s.importNcryptsecBtn}</span>
              </button>
            </div>

            {backupError && (
              <p role="alert" className="text-xs text-rose-300">
                {backupError}
              </p>
            )}
            {backupMsg && (
              <p role="status" data-testid="sync-ncryptsec-msg" className="text-xs text-emerald-300">
                {backupMsg}
              </p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
