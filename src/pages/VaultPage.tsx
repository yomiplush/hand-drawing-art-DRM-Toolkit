import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Download,
  Lock,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAppPreferences } from '../components/PreferencesContext';
import { FriendlyErrorAlert } from '../components/ui/FriendlyErrorAlert';
import { SimpleModeBanner } from '../components/ui/SimpleModeBanner';
import { StorageSettingsPanel } from '../components/vault/StorageSettingsPanel';
import { createPortableProofBundle } from '../core/manifest/proofBundle';
import { buildProofUrl } from '../core/manifest/proofUrl';
import { loadSyncSettings } from '../core/sync';
import {
  type VaultProofRecord,
  type VaultStats,
  computeVaultStats,
  decodeVaultProofBytes,
  deleteVaultProof,
  exportEncryptedVaultBackup,
  exportVaultBackupBundle,
  importVaultBackupJson,
  queryPublicProofsFromRelays,
  queryVaultProofs,
  saveVaultProofBatch,
  setVaultProofSyncSelected,
} from '../core/vault';
import { useI18n } from '../i18n/context';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function triggerJsonDownload(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function VaultPage({ focusStorage = false }: { focusStorage?: boolean }) {
  const { t } = useI18n();
  const { isAdvanced } = useAppPreferences();
  const v = t.vault;

  const [query, setQuery] = useState('');
  const [syncOnly, setSyncOnly] = useState(false);
  const [items, setItems] = useState<VaultProofRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<VaultStats>({
    totalProofs: 0,
    syncSelectedCount: 0,
    estimatedTotalBytes: 0,
    avgBytesPerProof: 0,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [backupPass, setBackupPass] = useState('');
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [publicAuthorFilter, setPublicAuthorFilter] = useState('');
  const [publicSearching, setPublicSearching] = useState(false);
  const [publicResults, setPublicResults] = useState<VaultProofRecord[] | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);

  const refreshVault = useCallback(async () => {
    const [res, nextStats] = await Promise.all([
      queryVaultProofs({ query, syncSelectedOnly: syncOnly, limit: 100 }),
      computeVaultStats(),
    ]);
    setItems(res.items);
    setTotalCount(res.totalCount);
    setStats(nextStats);
  }, [query, syncOnly]);

  useEffect(() => {
    let active = true;
    Promise.all([
      queryVaultProofs({ query, syncSelectedOnly: syncOnly, limit: 100 }),
      computeVaultStats(),
    ]).then(([res, nextStats]) => {
      if (!active) return;
      setItems(res.items);
      setTotalCount(res.totalCount);
      setStats(nextStats);
    });
    return () => {
      active = false;
    };
  }, [query, syncOnly]);

  const handleToggleSync = async (id: string, checked: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, syncSelected: checked } : item)),
    );
    await setVaultProofSyncSelected(id, checked);
    await refreshVault();
  };

  const handleDelete = async (id: string) => {
    await deleteVaultProof(id);
    await refreshVault();
  };

  const handleCopyVerifyUrl = async (rec: VaultProofRecord) => {
    try {
      const url = buildProofUrl(decodeVaultProofBytes(rec));
      await navigator.clipboard.writeText(url);
      setCopiedId(rec.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownloadChproof = (rec: VaultProofRecord) => {
    const bytes = decodeVaultProofBytes(rec);
    const bundle = createPortableProofBundle({
      protocolVersion: rec.protocolVersion,
      artworkId: rec.artworkIdHex,
      publicKeyFingerprint: rec.authorFingerprintHex,
      proofBytes: bytes,
    });
    const slug = (rec.artworkTitle || rec.artworkIdHex.slice(0, 8))
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .toLowerCase();
    triggerJsonDownload(bundle, `${slug || 'artwork'}.chproof.json`);
  };

  const handleExportPlain = async () => {
    setBackupError(null);
    setBackupMsg(null);
    const bundle = await exportVaultBackupBundle();
    const dateSlug = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(bundle, `chm-vault-backup-${dateSlug}.json`);
  };

  const handleExportEncrypted = async () => {
    setBackupError(null);
    setBackupMsg(null);
    try {
      const enc = await exportEncryptedVaultBackup({ passphrase: backupPass });
      const dateSlug = new Date().toISOString().slice(0, 10);
      triggerJsonDownload(enc, `chm-vault-encrypted-${dateSlug}.json`);
      setBackupPass('');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : v.importBackupError);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupError(null);
    setBackupMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importVaultBackupJson({
        rawJson: text,
        passphraseIfEncrypted: backupPass || undefined,
      });
      setBackupPass('');
      setBackupMsg(`${v.importBackupSuccess} (+${res.importedProofs})`);
      await refreshVault();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : v.importBackupError);
    } finally {
      e.target.value = '';
    }
  };

  const handlePublicLookup = async () => {
    setPublicError(null);
    setPublicSearching(true);
    try {
      const settings = await loadSyncSettings();
      const res = await queryPublicProofsFromRelays({
        relays: settings.relays,
        authorFingerprintHex: publicAuthorFilter || undefined,
      });
      if (res.records.length > 0) {
        await saveVaultProofBatch(res.records);
        await refreshVault();
      }
      setPublicResults(res.records);
    } catch (err) {
      setPublicError(err instanceof Error ? err.message : 'Relay lookup failed');
    } finally {
      setPublicSearching(false);
    }
  };

  const statsSection = (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="ga-card rounded-2xl p-4">
        <div className="text-xs ga-text-muted">{v.statsTotalProofs}</div>
        <div className="text-xl font-semibold ga-text mt-1" data-testid="vault-total-count">
          {stats.totalProofs}
        </div>
      </div>
      <div className="ga-card rounded-2xl p-4">
        <div className="text-xs ga-text-muted">{v.statsSyncSelected}</div>
        <div className="text-xl font-semibold ga-text-accent mt-1" data-testid="vault-sync-count">
          {stats.syncSelectedCount}
        </div>
      </div>
      <div className="ga-card rounded-2xl p-4">
        <div className="text-xs ga-text-muted">{v.statsEstimatedStorage}</div>
        <div
          className="text-xl font-semibold text-[var(--ga-success-text)] mt-1"
          data-testid="vault-total-bytes"
        >
          {formatBytes(stats.estimatedTotalBytes)}
        </div>
      </div>
    </section>
  );

  return (
    <div data-testid="vault-page" className="space-y-6 max-w-4xl mx-auto w-full min-w-0">
      <header className="space-y-2 border-b ga-border pb-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold ga-text flex items-center gap-2.5 min-w-0">
            <Archive className="h-6 w-6 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{focusStorage ? t.nextGen.storage.pageTitle : v.title}</span>
          </h1>
          <span className="ga-status-success rounded-full border px-3 py-1 text-xs font-medium shrink-0">
            {v.zeroCostNote}
          </span>
        </div>
        <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed break-words">
          {focusStorage ? t.nextGen.storage.pageSubtitle : v.subtitle}
        </p>
      </header>

      {!focusStorage && <SimpleModeBanner testId="vault-simple-mode-banner" />}

      {focusStorage ? (
        <>
          <StorageSettingsPanel onVaultChanged={refreshVault} />
          {statsSection}
        </>
      ) : (
        <>
          {statsSection}
          <StorageSettingsPanel onVaultChanged={refreshVault} />
        </>
      )}

      {/* Search & List */}
      <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-auto sm:flex-1 min-w-0">
            <Search
              className="h-4 w-4 ga-text-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={v.searchPlaceholder}
              data-testid="vault-search-input"
              className="ga-input w-full rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm min-h-[44px]"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs ga-text-secondary cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={syncOnly}
              onChange={(e) => setSyncOnly(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--ga-primary-bg)]"
            />
            <span>{v.syncSelectedOnlyFilter}</span>
          </label>
        </div>

        {items.length === 0 ? (
          <div
            data-testid="vault-empty-state"
            className="ga-surface-subtle rounded-2xl border border-dashed ga-border-strong p-6 text-center space-y-1.5"
          >
            <div className="text-sm font-medium ga-text">{v.emptyStateTitle}</div>
            <p className="text-xs ga-text-muted max-w-lg mx-auto leading-relaxed">
              {v.emptyStateBody}
            </p>
          </div>
        ) : (
          <ul data-testid="vault-proof-list" className="space-y-3">
            {items.map((rec) => (
              <li
                key={rec.id}
                data-testid="vault-proof-item"
                className="ga-surface-subtle rounded-2xl border ga-border p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold ga-text truncate">
                        {rec.artworkTitle || `Artwork ${rec.artworkIdHex.slice(0, 8)}`}
                      </span>
                      <span className="ga-status-info rounded-full border px-2 py-0.5 text-[10px] font-mono">
                        v{rec.protocolVersion}
                      </span>
                    </div>
                    <div className="text-xs ga-text-secondary flex flex-wrap gap-x-3 gap-y-1">
                      <span>{rec.authorName || rec.authorFingerprintShort}</span>
                      <span className="font-mono ga-text-accent">{rec.licenseId}</span>
                      {rec.creationMethod && <span>{rec.creationMethod}</span>}
                      <span>{new Date(rec.issuedAt * 1000).toLocaleDateString()}</span>
                    </div>
                    {rec.detailsSnapshot?.customNote && (
                      <div className="text-[11px] ga-text-secondary">
                        {rec.detailsSnapshot.customNote}
                      </div>
                    )}
                    <div className="text-[11px] font-mono ga-text-muted break-all">
                      SHA-256: {rec.imageSha256Hex.slice(0, 16)}… · ID: {rec.artworkIdHex.slice(0, 8)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t ga-border">
                  <label className="inline-flex items-center gap-2 text-xs ga-text-secondary cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={rec.syncSelected}
                      data-testid={`vault-sync-toggle-${rec.id}`}
                      onChange={(e) => void handleToggleSync(rec.id, e.target.checked)}
                      className="h-4 w-4 rounded accent-[var(--ga-primary-bg)]"
                    />
                    <span>{v.syncDeviceCheckbox}</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyVerifyUrl(rec)}
                      className="ga-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
                    >
                      {copiedId === rec.id ? (
                        <Check className="h-3.5 w-3.5 text-[var(--ga-success-text)]" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{copiedId === rec.id ? v.copiedBtn : v.copyVerifyUrlBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadChproof(rec)}
                      className="ga-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{v.downloadProofJsonBtn}</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`vault-delete-${rec.id}`}
                      onClick={() => void handleDelete(rec.id)}
                      className="ga-status-error inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs min-h-[36px] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{v.deleteProofBtn}</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalCount > items.length && (
          <p className="text-xs ga-text-muted">
            Showing {items.length} of {totalCount} records.
          </p>
        )}
      </section>

      {/* Portable Backup & Restore */}
      <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold ga-text">{v.backupSectionTitle}</h2>
          <p className="text-xs ga-text-secondary leading-relaxed">{v.backupSectionDesc}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="vault-export-json-btn"
            onClick={() => void handleExportPlain()}
            className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] cursor-pointer"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{v.exportPlainJsonBtn}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t ga-border">
          <input
            type="password"
            value={backupPass}
            onChange={(e) => setBackupPass(e.target.value)}
            placeholder={v.encryptedPassPlaceholder}
            data-testid="vault-backup-pass-input"
            className="ga-input flex-1 min-w-[220px] rounded-xl px-3 py-2 text-xs min-h-[44px]"
          />
          <button
            type="button"
            data-testid="vault-export-encrypted-btn"
            onClick={() => void handleExportEncrypted()}
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] cursor-pointer"
          >
            <Lock className="h-4 w-4 ga-text-accent" aria-hidden="true" />
            <span>{v.exportEncryptedJsonBtn}</span>
          </button>
        </div>

        <div className="pt-2 border-t ga-border space-y-2">
          <label className="block text-xs font-medium ga-text-secondary">
            {v.importBackupLabel}
          </label>
          <label className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[44px] cursor-pointer">
            <Upload className="h-4 w-4 ga-text-accent" aria-hidden="true" />
            <span>JSON / .json</span>
            <input
              type="file"
              accept=".json,application/json"
              data-testid="vault-import-file-input"
              onChange={(e) => void handleImportFile(e)}
              className="sr-only"
            />
          </label>
        </div>

        {backupError && (
          <FriendlyErrorAlert
            error={backupError}
            onDismiss={() => setBackupError(null)}
            testId="vault-backup-error"
          />
        )}
        {backupMsg && (
          <p
            role="status"
            data-testid="vault-backup-msg"
            className="ga-status-success rounded-xl border px-3 py-2 text-xs"
          >
            {backupMsg}
          </p>
        )}
      </section>

      {/* Legacy Read-Only Public Relay Lookup (Advanced Mode) */}
      {isAdvanced && (
        <details className="ga-card rounded-2xl p-4 text-xs ga-text-secondary">
          <summary className="cursor-pointer font-semibold ga-text">
            {v.publicLookupSummary}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs ga-text-secondary leading-relaxed">{v.publicLookupDesc}</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={publicAuthorFilter}
                onChange={(e) => setPublicAuthorFilter(e.target.value)}
                placeholder={v.publicLookupAuthorFilterPlaceholder}
                className="ga-input flex-1 min-w-[200px] rounded-xl px-3 py-2 text-xs font-mono min-h-[44px]"
              />
              <button
                type="button"
                disabled={publicSearching}
                data-testid="vault-public-search-btn"
                onClick={() => void handlePublicLookup()}
                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 ga-text-accent" aria-hidden="true" />
                <span>{publicSearching ? v.publicLookupSearching : v.publicLookupBtn}</span>
              </button>
            </div>
            {publicError && (
              <FriendlyErrorAlert error={publicError} onDismiss={() => setPublicError(null)} />
            )}
            {publicResults !== null && (
              <p
                data-testid="vault-public-search-result"
                className="ga-status-success rounded-xl border px-3 py-2 text-xs"
              >
                {v.publicLookupResultNote} {publicResults.length}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
