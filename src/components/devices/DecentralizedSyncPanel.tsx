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
  resetRelaysToDefault,
  runDecentralizedSyncCycle,
  saveSyncSettings,
  toggleRelayConfig,
} from '../../core/sync';
import {
  CURATED_DEFAULT_RELAY_PRESETS,
  OPTIONAL_JAPAN_RELAY_PRESETS,
} from '../../core/sync/types';
import type {
  RelayConfig,
  SyncSettings,
  SyncStatusSummary,
  VerifiedPeerBinding,
} from '../../core/sync/types';
import type { DeviceIdentityRecord } from '../../core/storage/devicePairingStore';
import type { AuthorKeyRecord } from '../../core/storage/keyStore';
import { useI18n } from '../../i18n/context';
import { FriendlyErrorAlert } from '../ui/FriendlyErrorAlert';

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
  const { t, locale } = useI18n();
  const s = t.devices.sync;
  const authOnly = t.nextGen.nostrAuthOnly;

  const [consentChecked, setConsentChecked] = useState(settings.consentAccepted);
  const [ownerPassInput, setOwnerPassInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [relayInput, setRelayInput] = useState('');
  const [relayError, setRelayError] = useState<string | null>(null);
  const [checkingRelayUrl, setCheckingRelayUrl] = useState<string | null>(null);

  const [peerCardInput, setPeerCardInput] = useState('');
  const [peerImportMsg, setPeerImportMsg] = useState<string | null>(null);
  const [peerImportError, setPeerImportError] = useState<string | null>(null);

  const [backupPass, setBackupPass] = useState('');
  const [backupPassConfirm, setBackupPassConfirm] = useState('');
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

  const handleAddPresetRelays = async (presets: readonly RelayConfig[]) => {
    setRelayError(null);
    try {
      const mergedMap = new Map(settings.relays.map((r) => [r.url, r]));
      for (const preset of presets) {
        if (!mergedMap.has(preset.url)) {
          mergedMap.set(preset.url, {
            url: preset.url,
            enabled: true,
            read: preset.read,
            write: preset.write,
            label: preset.label,
            isDefaultPreset: preset.isDefaultPreset,
            policyStatus: preset.policyStatus ?? 'unknown',
          });
        }
      }
      await saveSyncSettings({
        ...settings,
        relays: Array.from(mergedMap.values()),
      });
      await onRefresh();
    } catch (err) {
      setRelayError(err instanceof Error ? err.message : 'Failed to load preset relays');
    }
  };

  const handleLoadPresetRelays = () => handleAddPresetRelays(CURATED_DEFAULT_RELAY_PRESETS);

  const handleResetDefaultRelays = async () => {
    setRelayError(null);
    try {
      await resetRelaysToDefault();
      await onRefresh();
    } catch (err) {
      setRelayError(err instanceof Error ? err.message : 'Failed to reset default relays');
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
      ? 'ga-status-success'
      : status.health === 'partial-relays' || status.health === 'offline'
        ? 'ga-status-warning'
        : status.health === 'error-unreachable'
          ? 'ga-status-error'
          : 'ga-surface-subtle ga-text-muted';

  const statusText = syncing ? s.syncingLabel : s.statusLabels[status.health];

  return (
    <div data-testid="decentralized-sync-panel" className="space-y-6 min-w-0">
      <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <h2 className="text-lg font-semibold ga-text">{s.sectionTitle}</h2>
            <p className="text-xs ga-text-secondary leading-relaxed">{s.sectionSubtitle}</p>
          </div>
          <span
            data-testid="sync-status-badge"
            className={`rounded-full border px-3 py-1 text-xs font-semibold shrink-0 ${badgeClass}`}
          >
            {statusText}
          </span>
        </div>

        {/* Strict Nostr Auth-Only Scope Notice */}
        <div
          data-testid="nostr-auth-only-notice"
          className="ga-status-info rounded-xl border p-3.5 space-y-1.5 text-xs"
        >
          <div className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{authOnly.bannerTitle}</span>
          </div>
          <p className="ga-text-secondary leading-relaxed">{authOnly.bannerBody}</p>
          <div className="text-[11px] ga-text-secondary">
            {authOnly.vaultMovedHint}{' '}
            <Link
              to="/storage"
              className="font-semibold text-[var(--ga-accent)] underline underline-offset-4"
            >
              {t.nextGen.navStorage} →
            </Link>
          </div>
        </div>

        {!settings.enabled ? (
          <form
            onSubmit={handleEnableSync}
            data-testid="sync-consent-panel"
            className="ga-surface-subtle rounded-xl border ga-border-strong p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-[var(--ga-accent)]">{s.consentTitle}</h3>
            <ul className="space-y-1.5 list-disc ps-4 text-xs ga-text-secondary leading-relaxed">
              {s.consentPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>

            {selectedOwner?.storageMode === 'noble-encrypted-seed' && (
              <div className="pt-1">
                <label className="block text-xs ga-text-secondary mb-1">
                  {t.devices.ownerPassphraseLabel}
                </label>
                <input
                  type="password"
                  value={ownerPassInput}
                  onChange={(e) => setOwnerPassInput(e.target.value)}
                  placeholder={t.devices.ownerPassphrasePlaceholder}
                  className="ga-input w-full rounded-xl px-3 py-2 text-xs min-h-[44px]"
                />
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs ga-text cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={consentChecked || settings.consentAccepted}
                onChange={(e) => setConsentChecked(e.target.checked)}
                data-testid="sync-consent-checkbox"
                className="mt-0.5 h-4 w-4 rounded accent-[var(--ga-primary-bg)]"
              />
              <span>{s.consentCheckbox}</span>
            </label>

            {actionError && (
              <FriendlyErrorAlert
                error={actionError}
                testId="sync-action-error"
                onDismiss={() => setActionError(null)}
              />
            )}

            <button
              type="submit"
              disabled={(!consentChecked && !settings.consentAccepted) || syncing}
              data-testid="sync-enable-btn"
              className="ga-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{s.enableBtn}</span>
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="ga-surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 text-xs">
              <div className="space-y-1 ga-text-secondary">
                <div>
                  {s.queuedUpdatesLabel}:{' '}
                  <strong className="ga-text" data-testid="sync-queued-count">
                    {status.queuedOutboxCount}
                  </strong>
                  {' · '}
                  {s.lastSyncedLabel}:{' '}
                  <strong className="ga-text">
                    {status.lastSuccessfulSyncAt
                      ? new Date(status.lastSuccessfulSyncAt).toLocaleString()
                      : s.neverSyncedLabel}
                  </strong>
                </div>
                <div className="text-[11px] ga-text-secondary" data-testid="sync-budget-usage">
                  {s.onlineBudgetLabel}:{' '}
                  <strong className="text-[var(--ga-accent)]">
                    {(status.syncWindowBytesUsed / 1024).toFixed(1)} KiB /{' '}
                    {(status.onlineSyncBudgetBytes / 1024).toFixed(0)} KiB (¥0)
                  </strong>
                </div>
                <p className="text-[11px] ga-text-muted leading-relaxed">{s.honestGuaranteeNote}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={syncing}
                  data-testid="sync-now-btn"
                  onClick={() => void handleSyncNow()}
                  className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{syncing ? s.syncingLabel : s.syncNowBtn}</span>
                </button>
                <button
                  type="button"
                  data-testid="sync-disable-btn"
                  onClick={() => void handleDisableSync()}
                  className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium hover:text-[var(--ga-error-text)] min-h-[44px] cursor-pointer"
                >
                  <span>{s.disableBtn}</span>
                </button>
              </div>
            </div>

            {status.gracefulFallbackReason !== 'none' && (
              <div
                data-testid="sync-graceful-fallback"
                className="ga-status-info rounded-xl border p-3.5 space-y-1.5 text-xs"
              >
                <div className="font-semibold">{s.gracefulFallbackTitle}</div>
                <p className="text-[11px] ga-text-secondary leading-relaxed">
                  {s.gracefulFallbackBody}
                </p>
                <Link
                  to="/vault"
                  className="inline-block text-[11px] font-semibold text-[var(--ga-accent)] underline underline-offset-4"
                >
                  {s.gracefulFallbackExportLink}
                </Link>
              </div>
            )}

            {status.hasCausalGap && (
              <div
                role="alert"
                data-testid="sync-causal-gap-alert"
                className="ga-status-warning rounded-xl border p-3.5 flex items-start gap-2.5 text-xs"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {s.causalGapWarning} (Missing #{status.missingSequences.join(', #')})
                </span>
              </div>
            )}

            {actionError && (
              <FriendlyErrorAlert
                error={actionError}
                testId="sync-action-error"
                onDismiss={() => setActionError(null)}
              />
            )}
          </div>
        )}
      </section>

      {settings.enabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Peer Sync Linking */}
          <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <h3 className="text-base font-semibold ga-text flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{s.peerCardTitle}</span>
            </h3>
            <p className="text-xs ga-text-secondary leading-relaxed">{s.peerCardDesc}</p>

            {localBindingToken && (
              <div className="space-y-2">
                <input
                  type="text"
                  readOnly
                  value={localBindingToken}
                  data-testid="sync-peer-card-output"
                  aria-label={s.peerCardTitle}
                  className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
                />
                <button
                  type="button"
                  data-testid="sync-copy-peer-card-btn"
                  onClick={() => void handleCopy('peer-card', localBindingToken)}
                  className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
                >
                  {copiedKey === 'peer-card' ? (
                    <Check className="h-3.5 w-3.5 text-[var(--ga-success-text)]" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedKey === 'peer-card' ? t.devices.copiedMsg : s.copyPeerCardBtn}</span>
                </button>
              </div>
            )}

            <div className="pt-2 border-t ga-border space-y-2">
              <label className="block text-xs font-medium ga-text-secondary">
                {s.importPeerCardLabel}
              </label>
              <textarea
                rows={2}
                value={peerCardInput}
                onChange={(e) => setPeerCardInput(e.target.value)}
                placeholder={s.importPeerCardPlaceholder}
                data-testid="sync-peer-import-input"
                className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
              />
              {peerImportError && (
                <FriendlyErrorAlert
                  error={peerImportError}
                  testId="sync-peer-import-error"
                  onDismiss={() => setPeerImportError(null)}
                />
              )}
              {peerImportMsg && (
                <p role="status" data-testid="sync-peer-import-msg" className="text-xs text-[var(--ga-success-text)]">
                  {peerImportMsg}
                </p>
              )}
              <button
                type="button"
                data-testid="sync-peer-import-btn"
                onClick={() => void handleImportPeerCard()}
                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-[var(--ga-accent)]" aria-hidden="true" />
                <span>{s.importPeerCardBtn}</span>
              </button>
            </div>

            {peerBindings.length > 0 && (
              <div className="pt-2 border-t ga-border space-y-1 text-[11px] ga-text-muted">
                {peerBindings.map((pb) => (
                  <div key={pb.key} className="font-mono break-all">
                    {pb.deviceIdHex.slice(0, 8)}… → {pb.npub.slice(0, 22)}…
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Relay Configuration */}
          <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <h3 className="text-base font-semibold ga-text flex items-center gap-2">
              <Server className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{s.relaysTitle}</span>
            </h3>
            <p className="text-xs ga-text-secondary leading-relaxed">{s.relaysDesc}</p>

            <form onSubmit={handleAddRelay} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={relayInput}
                onChange={(e) => setRelayInput(e.target.value)}
                placeholder={s.addRelayPlaceholder}
                data-testid="sync-relay-add-input"
                className="ga-input flex-1 min-w-[200px] rounded-xl px-3 py-2 text-xs font-mono min-h-[44px]"
              />
              <button
                type="submit"
                data-testid="sync-relay-add-btn"
                className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.addRelayBtn}</span>
              </button>
            </form>

            {relayError && (
              <FriendlyErrorAlert
                error={relayError}
                testId="sync-relay-error"
                onDismiss={() => setRelayError(null)}
              />
            )}

            <ul data-testid="sync-relay-list" className="space-y-2">
              {settings.relays.map((r) => {
                const rt = status.relayStatuses.find((x) => x.url === r.url);
                return (
                  <li
                    key={r.url}
                    className="ga-surface-subtle flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
                  >
                    <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={(e) =>
                          void toggleRelayConfig(r.url, e.target.checked).then(onRefresh)
                        }
                        className="h-4 w-4 rounded accent-[var(--ga-primary-bg)] shrink-0"
                      />
                      <span className="font-mono ga-text truncate">{r.url}</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {r.policyStatus && r.policyStatus !== 'unknown' && (
                        <span
                          data-testid="sync-relay-policy-badge"
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            r.policyStatus === 'free-usable'
                              ? 'ga-status-success'
                              : r.policyStatus === 'payment-required'
                                ? 'ga-status-error'
                                : 'ga-status-warning'
                          }`}
                        >
                          {s.policyLabels[r.policyStatus]}
                        </span>
                      )}
                      {rt && (
                        <span className="text-[11px] ga-text-muted">
                          {rt.state}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={checkingRelayUrl === r.url}
                        data-testid="sync-relay-probe-btn"
                        onClick={() => void handleProbeRelay(r.url)}
                        className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] disabled:opacity-50 cursor-pointer"
                      >
                        <span>{s.checkRelayPolicyBtn}</span>
                      </button>
                      <button
                        type="button"
                        data-testid="sync-relay-remove-btn"
                        aria-label={`${s.removeRelayBtn} ${r.url}`}
                        onClick={() => void removeRelayConfig(r.url).then(onRefresh)}
                        className="ga-status-error inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        <span>{s.removeRelayBtn}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                data-testid="sync-load-presets-btn"
                onClick={() => void handleLoadPresetRelays()}
                className="text-xs font-medium text-[var(--ga-accent)] hover:underline underline-offset-4 cursor-pointer"
              >
                {s.loadPresetsBtn}
              </button>
              <button
                type="button"
                data-testid="sync-reset-presets-btn"
                onClick={() => void handleResetDefaultRelays()}
                className="text-xs font-medium ga-text-secondary hover:underline underline-offset-4 cursor-pointer"
              >
                {s.resetRelaysBtn}
              </button>
            </div>

            {/* Optional Regional Relay Presets (Global & Japan) */}
            <div className="pt-2 border-t ga-border space-y-2.5 text-xs">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium ga-text">{s.presetGlobalTitle}</span>
                  <button
                    type="button"
                    data-testid="sync-add-global-presets-btn"
                    onClick={() => void handleAddPresetRelays(CURATED_DEFAULT_RELAY_PRESETS)}
                    className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    <span>{s.presetGlobalAddBtn}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium ga-text">{s.presetJapanTitle}</span>
                  <button
                    type="button"
                    data-testid="sync-add-japan-presets-btn"
                    onClick={() => void handleAddPresetRelays(OPTIONAL_JAPAN_RELAY_PRESETS)}
                    className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    <span>{s.presetJapanAddBtn}</span>
                  </button>
                </div>
                <ul data-testid="sync-japan-preset-list" className="space-y-1">
                  {OPTIONAL_JAPAN_RELAY_PRESETS.map((preset) => {
                    const alreadyAdded = settings.relays.some((r) => r.url === preset.url);
                    return (
                      <li
                        key={preset.url}
                        className="ga-surface-subtle flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono ga-text break-all">{preset.url}</span>
                          <span className="ms-2 ga-text-muted">
                            ({locale === 'ja' ? preset.regionNoteJa : preset.regionNoteEn})
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => void handleAddPresetRelays([preset])}
                          className="ga-btn-secondary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] disabled:opacity-50 cursor-pointer shrink-0"
                        >
                          <span>{alreadyAdded ? s.presetRelayAdded : s.presetRelayAddOne}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] ga-text-muted leading-relaxed">
                  {s.presetJapanIpNotice}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Collapsible Advanced Section (Nostr Details & NIP-49 Backup) */}
      <details
        data-testid="sync-advanced-details"
        className="ga-card rounded-2xl p-4 text-xs ga-text-secondary"
      >
        <summary className="cursor-pointer font-semibold ga-text">
          {s.advancedSummary}
        </summary>
        <div className="mt-3 space-y-3">
          {nostrKey && (
            <div className="ga-surface-subtle space-y-1.5 font-mono text-[11px] break-all rounded-xl p-3">
              <div>
                <span className="ga-text-muted">{s.advancedNpubLabel}: </span>
                <span data-testid="sync-npub-display" className="text-[var(--ga-accent)]">
                  {nostrKey.npub}
                </span>
              </div>
              <div>
                <span className="ga-text-muted">{s.advancedKeyCustodyLabel}: </span>
                <span className="ga-text">{nostrKey.storageMode}</span>
              </div>
              <div>
                <span className="ga-text-muted">{s.advancedProtocolLabel}: </span>
                <span className="ga-text">CHM-SYNC-v1 (Auth-Only) + NIP-01 / NIP-42 / NIP-44 / NIP-49 / NIP-59</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-[var(--ga-warning-text)] leading-relaxed">{s.advancedBrowserWarning}</p>

          <div className="ga-surface-subtle rounded-xl p-3 space-y-2.5">
            <div className="font-semibold ga-text">{s.backupNcryptsecTitle}</div>
            <input
              type="password"
              value={backupPass}
              onChange={(e) => setBackupPass(e.target.value)}
              placeholder={s.backupPasswordPlaceholder}
              data-testid="sync-backup-password-input"
              className="ga-input w-full rounded-xl px-3 py-2 text-xs min-h-[44px]"
            />
            {backupPass.length > 0 && (
              <div className="space-y-1">
                <input
                  type="password"
                  value={backupPassConfirm}
                  onChange={(e) => setBackupPassConfirm(e.target.value)}
                  placeholder={
                    locale === 'ja'
                      ? 'パスフレーズ（確認用・もう一度入力）'
                      : 'Confirm passphrase'
                  }
                  data-testid="sync-backup-password-confirm-input"
                  className="ga-input w-full rounded-xl px-3 py-2 text-xs min-h-[44px]"
                />
                {backupPassConfirm.length > 0 && backupPass !== backupPassConfirm && (
                  <p role="alert" className="text-xs text-[var(--ga-error-text)]">
                    {locale === 'ja'
                      ? 'パスフレーズが一致していません'
                      : 'Passphrases do not match'}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!nostrKey || (backupPass.length > 0 && backupPass !== backupPassConfirm)}
                data-testid="sync-export-ncryptsec-btn"
                onClick={() => void handleExportNcryptsec()}
                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 min-h-[44px] cursor-pointer"
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
                className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
              />
            )}

            <div className="pt-2 border-t ga-border space-y-2">
              <textarea
                rows={2}
                value={importNcryptsecInput}
                onChange={(e) => setImportNcryptsecInput(e.target.value)}
                placeholder={s.importNcryptsecPlaceholder}
                data-testid="sync-import-ncryptsec-input"
                className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
              />
              <button
                type="button"
                data-testid="sync-import-ncryptsec-btn"
                onClick={() => void handleImportNcryptsec()}
                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer"
              >
                <span>{s.importNcryptsecBtn}</span>
              </button>
            </div>

            {backupError && (
              <FriendlyErrorAlert
                error={backupError}
                onDismiss={() => setBackupError(null)}
              />
            )}
            {backupMsg && (
              <p role="status" data-testid="sync-ncryptsec-msg" className="text-xs text-[var(--ga-success-text)]">
                {backupMsg}
              </p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
