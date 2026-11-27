import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Cloud, Download, KeyRound, Plus, Upload } from 'lucide-react';
import type { EncryptedKeyBackup } from '../core/crypto/keyBackup';
import {
  createAuthorKey,
  listAuthorKeys,
  markAuthorKeyBackedUp,
  restoreAuthorKeyFromBackup,
} from '../core/storage/keyStore';
import type { AuthorKeyRecord } from '../core/storage/keyStore';
import { inspectAuthorName } from '../core/security/authorNameGuard';
import { useI18n } from '../i18n/context';

function downloadKeyBackup(backup: EncryptedKeyBackup, label: string) {
  const safe = (label || 'artist-key').replace(/[^a-zA-Z0-9_-]/g, '_');
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.chkey.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

interface SimpleKeysCardProps {
  /** Called right after a key is created or restored (e.g. to advance onboarding into GalleryDeck). */
  onKeyReady?: (record: AuthorKeyRecord) => void;
  /** When true, shows a primary link to GalleryDeck once a key exists. */
  showContinueToDeck?: boolean;
}

export function SimpleKeysCard({
  onKeyReady,
  showContinueToDeck = true,
}: SimpleKeysCardProps) {
  const { locale } = useI18n();
  const isJa = locale === 'ja';

  const [keys, setKeys] = useState<AuthorKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBackup, setSavedBackup] = useState<{
    keyId: string;
    label: string;
    backup: EncryptedKeyBackup;
  } | null>(null);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restorePass, setRestorePass] = useState('');
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    try {
      const list = await listAuthorKeys();
      setKeys(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const primaryKey = keys[0] ?? null;
  const labelGuard = inspectAuthorName(label);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError(isJa ? '作家名（ニックネーム）を入力してください' : 'Enter your artist nickname');
      return;
    }
    const guard = inspectAuthorName(trimmed);
    if (guard.level === 'block') {
      setError(isJa ? guard.messageJa : guard.messageEn);
      return;
    }
    if (passphrase.trim().length > 0 && passphrase.trim().length < 8) {
      setError(isJa ? 'バックアップ用パスフレーズは8文字以上にしてください' : 'Passphrase must be 8+ characters');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await createAuthorKey({
        label: trimmed,
        backupPassphrase: passphrase.trim() || undefined,
      });
      if (result.encryptedBackup) {
        setSavedBackup({
          keyId: result.record.id,
          label: result.record.label,
          backup: result.encryptedBackup,
        });
      }
      window.dispatchEvent(new Event('chm-keys-updated'));
      await refresh();
      setLabel('');
      setPassphrase('');
      if (!result.encryptedBackup) {
        onKeyReady?.(result.record);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!savedBackup) return;
    downloadKeyBackup(savedBackup.backup, savedBackup.label);
    await markAuthorKeyBackedUp(savedBackup.keyId);
    await refresh();
    const updated = (await listAuthorKeys()).find((k) => k.id === savedBackup.keyId);
    if (updated) onKeyReady?.(updated);
  };

  const handleRestoreFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as EncryptedKeyBackup;
      const record = await restoreAuthorKeyFromBackup(parsed, restorePass);
      window.dispatchEvent(new Event('chm-keys-updated'));
      await refresh();
      setRestoreOpen(false);
      setRestorePass('');
      onKeyReady?.(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : isJa ? '復元に失敗しました' : 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-xs ga-text-muted">
        {isJa ? '読み込み中…' : 'Loading…'}
      </div>
    );
  }

  return (
    <div
      data-testid="simple-keys-card"
      className="mx-auto w-full max-w-md rounded-3xl border border-sky-400/30 bg-gradient-to-b from-[#071c38]/90 to-[#041328]/95 text-sky-50 shadow-[0_24px_70px_rgba(3,18,42,0.55)] p-6 sm:p-7 space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-300">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          {primaryKey
            ? isJa
              ? 'マイ鍵（準備完了）'
              : 'My Key (Ready)'
            : isJa
              ? '最初にマイ鍵を作成'
              : 'Create Your Key First'}
        </h1>
        <p className="text-xs text-sky-200/75">
          {primaryKey
            ? isJa
              ? 'この端末の署名鍵が有効です。'
              : 'Your local signing key is active.'
            : isJa
              ? '端末内だけで生成されます。送信ゼロ。'
              : 'Generated 100% locally. Never uploaded.'}
        </p>
      </div>

      {primaryKey && (
        <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="truncate">{primaryKey.label}</span>
            </div>
            <div className="font-mono text-[11px] text-sky-200/80 mt-0.5">
              {primaryKey.fingerprintShort}
            </div>
          </div>
          {showContinueToDeck && (
            <Link
              to="/"
              data-testid="simple-keys-go-deck-link"
              className="inline-flex items-center gap-1 rounded-xl bg-sky-500 hover:bg-sky-400 px-3.5 py-2 text-xs font-semibold text-slate-950 shrink-0"
            >
              <span>GalleryDeck</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {savedBackup && (
        <div className="rounded-2xl border border-sky-400/40 bg-sky-500/15 p-4 space-y-3 text-center">
          <p className="text-xs font-medium text-sky-100">
            {isJa ? '復元用バックアップ (.chkey.json) を保存できます' : 'Save your recovery backup (.chkey.json)'}
          </p>
          <p
            data-testid="simple-keys-adult-backup-note"
            className="text-[11px] leading-relaxed text-sky-200/85"
          >
            {isJa
              ? 'ブラウザの履歴を消すと鍵も消えてしまいます。大切な絵を守るため、おとなの人（保護者）と一緒に保存しておこう。'
              : 'Clearing browser history deletes local keys. Save this backup together with a parent or guardian to keep your artworks safe.'}
          </p>
          <button
            type="button"
            onClick={() => void handleDownloadBackup()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{isJa ? '.chkey.json を保存して進む' : 'Save .chkey.json & Continue'}</span>
          </button>
        </div>
      )}

      {!primaryKey && (
        <form onSubmit={(e) => void handleCreateKey(e)} className="space-y-3.5">
          <div className="space-y-1.5">
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setError(null);
              }}
              placeholder={isJa ? 'ニックネーム・ペンネーム（本名は入れないでね）' : 'Nickname / Pen Name (not your real name)'}
              data-testid="simple-keys-label-input"
              className="w-full rounded-xl border border-sky-400/30 bg-[#04142b]/90 px-3.5 py-2.5 text-sm text-white placeholder:text-sky-300/45 focus:border-sky-400 focus:outline-none"
            />
            <p
              data-testid="simple-keys-nickname-hint"
              className="text-[11px] text-sky-200/75 px-1"
            >
              {isJa
                ? '※ 本名や学校名ではなく、ニックネーム（ペンネーム）を入れよう'
                : 'Use a nickname or pen name — not your real name or school name.'}
            </p>
            {labelGuard.level !== 'safe' && (
              <p
                role={labelGuard.level === 'block' ? 'alert' : 'status'}
                data-testid="simple-keys-name-guard"
                className={`rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${
                  labelGuard.level === 'block'
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                    : 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                }`}
              >
                {isJa ? labelGuard.messageJa : labelGuard.messageEn}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setError(null);
              }}
              placeholder={isJa ? 'バックアップ用パスフレーズ（任意・8文字以上）' : 'Backup passphrase (optional, 8+ chars)'}
              data-testid="simple-keys-passphrase-input"
              className="w-full rounded-xl border border-sky-400/25 bg-[#04142b]/90 px-3.5 py-2.5 text-xs text-white placeholder:text-sky-300/40 focus:border-sky-400 focus:outline-none"
            />
            <p className="text-[11px] text-sky-200/70 px-1">
              {isJa
                ? '※ ブラウザの履歴を消すと鍵が消えるため、おとなの人と一緒にバックアップを保存しておくと安心です。'
                : 'Clearing browser history removes local keys — back up your key together with a parent or guardian.'}
            </p>
          </div>
          <button
            type="submit"
            disabled={busy || labelGuard.level === 'block'}
            data-testid="simple-keys-create-btn"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-slate-950 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{busy ? (isJa ? '作成中…' : 'Creating…') : isJa ? 'マイ鍵を作成してはじめる' : 'Create Key & Start'}</span>
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-center text-xs font-medium text-rose-300">
          {error}
        </p>
      )}

      {/* Minimal Restore Toggle & Google Drive Restore */}
      <div className="pt-2 border-t border-sky-400/20 text-center space-y-2.5">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => setRestoreOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-sky-300/80 hover:text-sky-200 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{isJa ? 'バックアップ (.chkey.json) から復元' : 'Restore from .chkey.json'}</span>
          </button>

          <Link
            to="/gallerydeck?sync=1"
            data-testid="simple-keys-restore-gdrive-link"
            className="inline-flex items-center gap-1.5 text-xs text-sky-300/80 hover:text-sky-200"
          >
            <Cloud className="h-3.5 w-3.5" />
            <span>{isJa ? 'Google Drive から復号して復元' : 'Decrypt & Restore from Google Drive'}</span>
          </Link>
        </div>

        {restoreOpen && (
          <div className="space-y-2 pt-1">
            <input
              type="password"
              value={restorePass}
              onChange={(e) => setRestorePass(e.target.value)}
              placeholder={isJa ? '復元パスフレーズ' : 'Recovery passphrase'}
              className="w-full rounded-xl border border-sky-400/25 bg-[#04142b]/90 px-3 py-2 text-xs text-white placeholder:text-sky-300/40 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => restoreInputRef.current?.click()}
              className="w-full rounded-xl border border-sky-400/35 bg-sky-950/60 hover:bg-sky-900/70 px-3 py-2 text-xs font-medium text-sky-100 cursor-pointer"
            >
              {isJa ? '.chkey.json ファイルを選択' : 'Select .chkey.json File'}
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,.chkey.json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleRestoreFile(file);
                  e.target.value = '';
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
