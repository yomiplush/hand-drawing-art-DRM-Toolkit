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
  a.click();
  URL.revokeObjectURL(url);
}

export function VaultPage() {
  const { t } = useI18n();
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

  return (
    <div data-testid="vault-page" className="space-y-6 max-w-4xl mx-auto">
      <header className="space-y-2 border-b border-white/[0.08] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white flex items-center gap-2.5">
            <Archive className="h-6 w-6 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{v.title}</span>
          </h1>
          <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            {v.zeroCostNote}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{v.subtitle}</p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.1] bg-[#051224]/70 p-4">
          <div className="text-xs text-slate-400">{v.statsTotalProofs}</div>
          <div className="text-xl font-semibold text-white mt-1" data-testid="vault-total-count">
            {stats.totalProofs}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.1] bg-[#051224]/70 p-4">
          <div className="text-xs text-slate-400">{v.statsSyncSelected}</div>
          <div className="text-xl font-semibold text-sky-200 mt-1" data-testid="vault-sync-count">
            {stats.syncSelectedCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.1] bg-[#051224]/70 p-4">
          <div className="text-xs text-slate-400">{v.statsEstimatedStorage}</div>
          <div className="text-xl font-semibold text-emerald-200 mt-1" data-testid="vault-total-bytes">
            {formatBytes(stats.estimatedTotalBytes)}
          </div>
        </div>
      </section>

      {/* Search & List */}
      <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="h-4 w-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={v.searchPlaceholder}
              data-testid="vault-search-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] ps-9 pe-3 py-2 text-xs sm:text-sm text-white min-h-[44px]"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={syncOnly}
              onChange={(e) => setSyncOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500"
            />
            <span>{v.syncSelectedOnlyFilter}</span>
          </label>
        </div>

        {items.length === 0 ? (
          <div
            data-testid="vault-empty-state"
            className="rounded-xl border border-dashed border-white/[0.12] bg-[#030b18]/60 p-6 text-center space-y-1.5"
          >
            <div className="text-sm font-medium text-slate-200">{v.emptyStateTitle}</div>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              {v.emptyStateBody}
            </p>
          </div>
        ) : (
          <ul data-testid="vault-proof-list" className="space-y-3">
            {items.map((rec) => (
              <li
                key={rec.id}
                data-testid="vault-proof-item"
                className="rounded-xl border border-white/[0.08] bg-[#030b18]/75 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {rec.artworkTitle || `Artwork ${rec.artworkIdHex.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{rec.authorName || rec.authorFingerprintShort}</span>
                      <span className="font-mono text-sky-300">{rec.licenseId}</span>
                      {rec.creationMethod && <span>{rec.creationMethod}</span>}
                      <span>{new Date(rec.issuedAt * 1000).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 break-all">
                      SHA-256: {rec.imageSha256Hex.slice(0, 16)}… · ID: {rec.artworkIdHex.slice(0, 8)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={rec.syncSelected}
                      data-testid={`vault-sync-toggle-${rec.id}`}
                      onChange={(e) => void handleToggleSync(rec.id, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-500"
                    />
                    <span>{v.syncDeviceCheckbox}</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyVerifyUrl(rec)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.14] bg-[#051224] px-2.5 py-1.5 text-xs text-slate-200 hover:border-sky-400/40 min-h-[36px] cursor-pointer"
                    >
                      {copiedId === rec.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{copiedId === rec.id ? v.copiedBtn : v.copyVerifyUrlBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadChproof(rec)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.14] bg-[#051224] px-2.5 py-1.5 text-xs text-slate-200 hover:border-sky-400/40 min-h-[36px] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{v.downloadProofJsonBtn}</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`vault-delete-${rec.id}`}
                      onClick={() => void handleDelete(rec.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20 min-h-[36px] cursor-pointer"
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
          <p className="text-xs text-slate-400">
            Showing {items.length} of {totalCount} records.
          </p>
        )}
      </section>

      {/* Portable Backup & Restore */}
      <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 p-4 sm:p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">{v.backupSectionTitle}</h2>
          <p className="text-xs text-slate-300 leading-relaxed">{v.backupSectionDesc}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="vault-export-json-btn"
            onClick={() => void handleExportPlain()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-300 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-200 min-h-[44px] cursor-pointer"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{v.exportPlainJsonBtn}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.08]">
          <input
            type="password"
            value={backupPass}
            onChange={(e) => setBackupPass(e.target.value)}
            placeholder={v.encryptedPassPlaceholder}
            data-testid="vault-backup-pass-input"
            className="flex-1 min-w-[220px] rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs text-white min-h-[44px]"
          />
          <button
            type="button"
            data-testid="vault-export-encrypted-btn"
            onClick={() => void handleExportEncrypted()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>{v.exportEncryptedJsonBtn}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-white/[0.08] space-y-2">
          <label className="block text-xs font-medium text-slate-200">
            {v.importBackupLabel}
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.16] bg-[#030b18] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer">
            <Upload className="h-4 w-4" aria-hidden="true" />
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
          <p role="alert" data-testid="vault-backup-error" className="text-xs text-rose-300">
            {backupError}
          </p>
        )}
        {backupMsg && (
          <p role="status" data-testid="vault-backup-msg" className="text-xs text-emerald-300">
            {backupMsg}
          </p>
        )}
      </section>

      {/* Optional Public Relay Proof Search (Opt-In) */}
      <details className="rounded-xl border border-white/[0.1] bg-[#051224]/60 p-4 text-xs text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-200 hover:text-white">
          {v.publicLookupSummary}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">{v.publicLookupDesc}</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={publicAuthorFilter}
              onChange={(e) => setPublicAuthorFilter(e.target.value)}
              placeholder={v.publicLookupAuthorFilterPlaceholder}
              className="flex-1 min-w-[200px] rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-xs font-mono text-white min-h-[44px]"
            />
            <button
              type="button"
              disabled={publicSearching}
              data-testid="vault-public-search-btn"
              onClick={() => void handlePublicLookup()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{publicSearching ? v.publicLookupSearching : v.publicLookupBtn}</span>
            </button>
          </div>
          {publicError && (
            <p role="alert" className="text-xs text-rose-300">
              {publicError}
            </p>
          )}
          {publicResults !== null && (
            <p data-testid="vault-public-search-result" className="text-xs text-emerald-300">
              {v.publicLookupResultNote} {publicResults.length}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
