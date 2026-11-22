import React, { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Info,
  KeyRound,
  PlusCircle,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { decryptKeyBackup } from '../core/crypto/keyBackup';
import type { EncryptedKeyBackup } from '../core/crypto/keyBackup';
import {
  addTrustedKey,
  buildPublicKeyExportBundle,
  createAuthorKey,
  deleteAuthorKey,
  listAuthorKeys,
  listTrustedKeys,
  markAuthorKeyBackedUp,
  removeTrustedKey,
  restoreAuthorKeyFromBackup,
} from '../core/storage/keyStore';
import type { AuthorKeyRecord, TrustedKeyRecord } from '../core/storage/keyStore';
import { useI18n } from '../i18n/context';

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function KeysPage() {
  const { t } = useI18n();
  const restoreFileInputId = useId();

  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);
  const [trustedKeys, setTrustedKeys] = useState<TrustedKeyRecord[]>([]);

  const [newLabel, setNewLabel] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<{
    keyId: string;
    backup: EncryptedKeyBackup;
  } | null>(null);

  const [restorePass, setRestorePass] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [trustPubInput, setTrustPubInput] = useState('');
  const [trustLabel, setTrustLabel] = useState('');
  const [trustNote, setTrustNote] = useState('');
  const [trustError, setTrustError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    const [ak, tk] = await Promise.all([listAuthorKeys(), listTrustedKeys()]);
    setAuthorKeys(ak);
    setTrustedKeys(tk);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([listAuthorKeys(), listTrustedKeys()]).then(([ak, tk]) => {
      if (active) {
        setAuthorKeys(ak);
        setTrustedKeys(tk);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);
    setPendingBackup(null);
    try {
      if (newPassphrase && newPassphrase.length < 8) {
        throw new Error('Backup passphrase must be at least 8 characters (or leave empty to skip backup)');
      }
      const { record, encryptedBackup } = await createAuthorKey({
        label: newLabel || 'Artist Key',
        backupPassphrase: newPassphrase || undefined,
      });
      setNewLabel('');
      setNewPassphrase('');
      if (encryptedBackup) {
        setPendingBackup({ keyId: record.id, backup: encryptedBackup });
      }
      await refreshAll();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate keypair');
    }
  };

  const handleDownloadBackup = async (keyId: string, backup: EncryptedKeyBackup) => {
    const safeName = backup.label.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'artist';
    downloadJsonFile(backup, `chm-${safeName}-${backup.fingerprint.slice(0, 8)}.chkey.json`);
    await markAuthorKeyBackedUp(keyId);
    await refreshAll();
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError(null);
    setRestoreStatus(null);
    try {
      if (!restoreFile) {
        throw new Error('Select a .chkey.json backup file first');
      }
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);
      const restored = await restoreAuthorKeyFromBackup(parsed, restorePass);
      setRestorePass('');
      setRestoreFile(null);
      setRestoreStatus(`Restored: ${restored.label} (${restored.fingerprintShort})`);
      await refreshAll();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed');
    }
  };

  const handleVerifyBackupOnly = async () => {
    setRestoreError(null);
    setRestoreStatus(null);
    try {
      if (!restoreFile) {
        throw new Error('Select a .chkey.json backup file first');
      }
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);
      const decrypted = await decryptKeyBackup(parsed, restorePass);
      const fpShort = decrypted.fingerprint.slice(0, 16);
      const pubB64 = typeof parsed?.publicKey === 'string' ? parsed.publicKey : '';
      decrypted.seed32.fill(0);

      const existingAuthor = authorKeys.find(
        (k) => k.fingerprintHex === decrypted.fingerprint || (pubB64 && k.publicKeyBase64Url === pubB64),
      );
      if (existingAuthor) {
        setRestoreStatus(
          `${t.keys.verifyBackupMatchExisting}: ${existingAuthor.label} (${existingAuthor.fingerprintShort})`,
        );
        return;
      }

      const existingTrusted = trustedKeys.find(
        (tk) =>
          tk.fingerprintHex === decrypted.fingerprint ||
          (pubB64 && tk.publicKeyBase64Url === pubB64),
      );
      if (existingTrusted) {
        setRestoreStatus(
          `${t.keys.verifyBackupMatchTrusted}: ${existingTrusted.label} (${existingTrusted.fingerprintShort})`,
        );
        return;
      }

      setRestoreStatus(`${t.keys.verifyBackupValidNew} (${decrypted.label} · ${fpShort}…)`);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Backup verification failed');
    }
  };

  const handleDeleteAuthorKey = async (id: string) => {
    if (!window.confirm(t.keys.deleteConfirm)) return;
    await deleteAuthorKey(id);
    if (pendingBackup?.keyId === id) setPendingBackup(null);
    await refreshAll();
  };

  const handleCopyPublicKey = async (id: string, b64: string) => {
    try {
      await navigator.clipboard.writeText(b64);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleAddTrusted = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrustError(null);
    try {
      await addTrustedKey({
        publicKeyInput: trustPubInput,
        label: trustLabel,
        note: trustNote,
      });
      setTrustPubInput('');
      setTrustLabel('');
      setTrustNote('');
      await refreshAll();
    } catch (err) {
      setTrustError(err instanceof Error ? err.message : 'Invalid public key');
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-white/[0.08] pb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">{t.keys.title}</h1>
        <p className="text-sm sm:text-base text-slate-300">{t.keys.subtitle}</p>
      </header>

      <div className="space-y-3">
        <div
          role="note"
          className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4 flex items-start gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-amber-200">{t.keys.storageWarningTitle}</h2>
            <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
              {t.keys.storageWarningBody}
            </p>
          </div>
        </div>

        <div
          role="note"
          data-testid="keys-standalone-storage-note"
          className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 flex items-start gap-3"
        >
          <Info className="h-5 w-5 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs sm:text-sm text-sky-100/90 leading-relaxed">
            {t.keys.standaloneStorageNote}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <span>{t.keys.generateTitle}</span>
          </h2>

          <form onSubmit={handleGenerate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.keys.keyLabelInput}
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={64}
                placeholder={t.keys.keyLabelPlaceholder}
                data-testid="keygen-label"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.keys.backupPassInput}
              </label>
              <input
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                placeholder={t.keys.backupPassPlaceholder}
                data-testid="keygen-passphrase"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            {genError && (
              <p role="alert" className="text-xs text-rose-300">
                {genError}
              </p>
            )}

            <button
              type="submit"
              data-testid="keygen-submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white transition-colors min-h-[44px]"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>{t.keys.generateBtn}</span>
            </button>
          </form>

          {pendingBackup && (
            <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-4 space-y-2.5">
              <h3 className="text-sm font-semibold text-cyan-200">{t.keys.backupReadyTitle}</h3>
              <p className="text-xs text-slate-200 leading-relaxed">{t.keys.backupReadyBody}</p>
              <button
                type="button"
                data-testid="download-pending-backup"
                onClick={() => handleDownloadBackup(pendingBackup.keyId, pendingBackup.backup)}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 min-h-[40px]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{t.keys.downloadBackupBtn}</span>
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <Upload className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <span>{t.keys.restoreTitle}</span>
          </h2>

          <form onSubmit={handleRestore} className="space-y-3">
            <div>
              <label
                htmlFor={restoreFileInputId}
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.keys.restoreFileLabel}
              </label>
              <input
                id={restoreFileInputId}
                type="file"
                accept=".json,.chkey.json,application/json"
                data-testid="restore-file-input"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.keys.restorePassLabel}
              </label>
              <input
                type="password"
                value={restorePass}
                onChange={(e) => setRestorePass(e.target.value)}
                data-testid="restore-passphrase"
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white"
              />
            </div>

            {restoreError && (
              <p role="alert" className="text-xs text-rose-300">
                {restoreError}
              </p>
            )}
            {restoreStatus && (
              <p role="status" data-testid="restore-status-msg" className="text-xs text-cyan-300">
                {restoreStatus}
              </p>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                data-testid="restore-submit"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 transition-colors min-h-[44px] cursor-pointer"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{t.keys.restoreBtn}</span>
              </button>

              <button
                type="button"
                data-testid="verify-backup-btn"
                onClick={() => void handleVerifyBackupOnly()}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.16] bg-[#030b18]/75 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-white/[0.3] transition-colors min-h-[44px] cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <span>{t.keys.verifyBackupBtn}</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
        <h2 className="text-base sm:text-lg font-semibold text-white">{t.keys.myKeysTitle}</h2>
        {authorKeys.length === 0 ? (
          <p className="text-sm text-slate-400">{t.keys.noMyKeys}</p>
        ) : (
          <div className="space-y-3">
            {authorKeys.map((k) => (
              <div
                key={k.id}
                data-testid="author-key-card"
                className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{k.label}</span>
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300">
                      {k.storageMode === 'webcrypto-non-extractable'
                        ? t.keys.modeNonExtractable
                        : t.keys.modeEncryptedFallback}
                    </span>
                    {!k.hasBackupDownloaded && (
                      <span
                        data-testid="key-unbacked-badge"
                        className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-200"
                      >
                        {t.keys.unbackedBadge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-cyan-300 break-all">
                    {k.fingerprintShort} ({k.fingerprintHex.slice(0, 16)}…)
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 break-all">
                    Ed25519 PK: {k.publicKeyBase64Url}
                  </div>
                  {!k.encryptedBackup && (
                    <div className="text-[11px] text-amber-200/85">
                      {t.keys.noBackupExportNotice}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyPublicKey(k.id, k.publicKeyBase64Url)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400/40 min-h-[38px]"
                  >
                    {copiedId === k.id ? (
                      <Check className="h-3.5 w-3.5 text-cyan-300" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{t.keys.copyPublicBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadJsonFile(
                        buildPublicKeyExportBundle(k),
                        `chm-public-${k.fingerprintHex.slice(0, 8)}.json`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400/40 min-h-[38px]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t.keys.exportPublicBtn}</span>
                  </button>

                  <Link
                    to={`/exchange?identity=${encodeURIComponent(k.id)}`}
                    data-testid="keys-share-exchange-link"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 min-h-[38px]"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>{t.keys.shareViaExchangeBtn}</span>
                  </Link>

                  {k.encryptedBackup && (
                    <button
                      type="button"
                      onClick={() => handleDownloadBackup(k.id, k.encryptedBackup!)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 min-h-[38px]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{t.keys.downloadBackupBtn}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteAuthorKey(k.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20 min-h-[38px]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t.keys.deleteKeyBtn}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <span>{t.keys.trustedTitle}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">{t.keys.trustedSubtitle}</p>
          </div>
          <Link
            to="/exchange?tab=trusted"
            data-testid="keys-open-exchange-link"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 self-start sm:self-center shrink-0 min-h-[38px]"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.keys.openExchangeTrustedBtn}</span>
          </Link>
        </div>

        <form onSubmit={handleAddTrusted} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={trustPubInput}
            onChange={(e) => setTrustPubInput(e.target.value)}
            placeholder={t.keys.addTrustedPubInput}
            data-testid="trusted-pub-input"
            className="rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
          />
          <input
            type="text"
            required
            value={trustLabel}
            onChange={(e) => setTrustLabel(e.target.value)}
            maxLength={64}
            placeholder={t.keys.addTrustedLabelInput}
            data-testid="trusted-label-input"
            className="rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={trustNote}
              onChange={(e) => setTrustNote(e.target.value)}
              maxLength={200}
              placeholder={t.keys.addTrustedNoteInput}
              className="flex-1 rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              data-testid="trusted-add-btn"
              className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 shrink-0 min-h-[44px]"
            >
              {t.keys.addTrustedBtn}
            </button>
          </div>
        </form>

        {trustError && (
          <p role="alert" className="text-xs text-rose-300">
            {trustError}
          </p>
        )}

        {trustedKeys.length === 0 ? (
          <p className="text-sm text-slate-400">{t.keys.noTrustedKeys}</p>
        ) : (
          <div className="space-y-2.5">
            {trustedKeys.map((tk) => (
              <div
                key={tk.publicKeyBase64Url}
                className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-emerald-200 text-sm">{tk.label}</div>
                  <div className="text-xs font-mono text-slate-300">{tk.fingerprintShort}</div>
                  <div className="text-[11px] font-mono text-slate-500 break-all">
                    {tk.publicKeyBase64Url}
                  </div>
                  {tk.note && <div className="text-xs text-slate-400">{tk.note}</div>}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await removeTrustedKey(tk.publicKeyBase64Url);
                    await refreshAll();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-200 self-start sm:self-center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t.keys.removeBtn}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
