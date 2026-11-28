import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { EncryptedKeyBackup } from '../core/crypto/keyBackup';
import { decryptKeyBackup, MIN_PASSPHRASE_LENGTH } from '../core/crypto/keyBackup';
import {
  createAuthorKey,
  deleteAuthorKey,
  isAuthorKeyBackupVerified,
  listAuthorKeys,
  markAuthorKeyBackedUp,
  markAuthorKeyBackupVerified,
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

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

interface SimpleKeysCardProps {
  /** Called when the key is ready and the artist chooses to continue. */
  onKeyReady?: (record: AuthorKeyRecord) => void;
  /** When true, shows a primary link to GalleryDeck once a key exists. */
  showContinueToDeck?: boolean;
}

type Step = 1 | 2 | 3;

export function SimpleKeysCard({
  onKeyReady,
  showContinueToDeck = true,
}: SimpleKeysCardProps) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const o = t.simple.onboarding;

  const [keys, setKeys] = useState<AuthorKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);

  const [label, setLabel] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [verifyPass, setVerifyPass] = useState('');
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyFileName, setVerifyFileName] = useState<string>('');
  const [downloaded, setDownloaded] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restorePass, setRestorePass] = useState('');
  const [restartArmed, setRestartArmed] = useState(false);

  const verifyInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const isJa = locale === 'ja';

  const refresh = async (syncStep = false) => {
    try {
      const list = await listAuthorKeys();
      setKeys(list);
      if (syncStep) {
        const key = list[0] ?? null;
        setDownloaded(Boolean(key?.hasBackupDownloaded));
        setStep(key ? (isAuthorKeyBackupVerified(key) ? 3 : 2) : 1);
      }
      return list;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(true);
  }, []);

  const primaryKey = keys[0] ?? null;

  useEffect(() => {
    if (!loading) headingRef.current?.focus();
  }, [step, loading]);

  const announce = (message: string) => setStatus(message);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError(isJa ? '作家名を入力してください' : 'Enter your artist name');
      return;
    }
    const guard = inspectAuthorName(trimmed);
    if (guard.level === 'block') {
      setError(isJa ? guard.messageJa : guard.messageEn);
      return;
    }
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(
        isJa
          ? `パスフレーズは${MIN_PASSPHRASE_LENGTH}文字以上にしてください`
          : `Use at least ${MIN_PASSPHRASE_LENGTH} characters`,
      );
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await createAuthorKey({ label: trimmed, backupPassphrase: passphrase });
      window.dispatchEvent(new Event('chm-keys-updated'));
      const list = await refresh();
      setPassphrase('');
      setShowPassphrase(false);
      if (isAuthorKeyBackupVerified(list[0])) {
        setStep(3);
        announce(o.backupVerifiedStatus);
      } else {
        setStep(2);
        announce(o.keyCreatedStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!primaryKey?.encryptedBackup) return;
    downloadKeyBackup(primaryKey.encryptedBackup, primaryKey.label);
    await markAuthorKeyBackedUp(primaryKey.id);
    setDownloaded(true);
    await refresh();
    announce(o.backupSavedStatus);
  };

  const handleVerifyBackup = async () => {
    if (!primaryKey || !verifyFile) {
      setError(isJa ? '保存したバックアップファイルを選んでください' : 'Choose the backup file you saved');
      return;
    }
    if (!verifyPass) {
      setError(isJa ? 'パスフレーズを入力してください' : 'Enter the backup passphrase');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(await verifyFile.text()) as EncryptedKeyBackup;
      const decrypted = await decryptKeyBackup(parsed, verifyPass);
      const matches = sameBytes(decrypted.publicKey32, primaryKey.publicKey);
      decrypted.seed32.fill(0);
      if (!matches) {
        setError(o.verifyFail);
        return;
      }
      await markAuthorKeyBackupVerified(primaryKey.id);
      window.dispatchEvent(new Event('chm-keys-updated'));
      await refresh();
      setVerifyPass('');
      setVerifyFile(null);
      setVerifyFileName('');
      setStep(3);
      announce(o.backupVerifiedStatus);
    } catch {
      setError(o.verifyFail);
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as EncryptedKeyBackup;
      await restoreAuthorKeyFromBackup(parsed, restorePass);
      window.dispatchEvent(new Event('chm-keys-updated'));
      await refresh();
      setRestoreOpen(false);
      setRestorePass('');
      setStep(3);
      announce(o.backupVerifiedStatus);
    } catch {
      setError(o.restoreFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleRestartKey = async () => {
    if (!restartArmed) {
      setRestartArmed(true);
      return;
    }
    if (!primaryKey) return;
    setBusy(true);
    try {
      await deleteAuthorKey(primaryKey.id);
      window.dispatchEvent(new Event('chm-keys-updated'));
      await refresh();
      setRestartArmed(false);
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-xs ga-text-muted" role="status">
        {isJa ? '読み込み中…' : 'Loading…'}
      </div>
    );
  }

  const canDownload = Boolean(primaryKey?.encryptedBackup);
  const isLegacyUnbacked = Boolean(primaryKey && !primaryKey.encryptedBackup);
  const steps: Array<{ num: Step; label: string }> = [
    { num: 1, label: o.step1 },
    { num: 2, label: o.step2 },
    { num: 3, label: o.step3 },
  ];

  return (
    <div
      data-testid="simple-keys-card"
      className="mx-auto w-full max-w-md rounded-3xl border border-sky-400/30 bg-gradient-to-b from-[#071c38]/95 to-[#041328]/98 text-sky-50 shadow-[0_24px_70px_rgba(3,18,42,0.55)] p-6 sm:p-7 space-y-5"
    >
      <ol
        aria-label={o.progressAria}
        data-testid="simple-keys-steps"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        {steps.map((s) => {
          const state = step === s.num ? 'current' : step > s.num ? 'done' : 'todo';
          return (
            <li
              key={s.num}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                state === 'current'
                  ? 'border-sky-400 bg-sky-400/15 text-sky-100'
                  : state === 'done'
                    ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100'
                    : 'border-sky-400/20 text-sky-200/70'
              }`}
            >
              {state === 'done' ? (
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <Circle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="break-keep sm:whitespace-nowrap">{s.label}</span>
              {state === 'current' && (
                <span className="sr-only">{isJa ? '（現在の手順）' : '(current step)'}</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="text-center space-y-1.5">
        <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/20 text-sky-200">
          {step === 3 ? (
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          ) : step === 2 ? (
            <Lock aria-hidden="true" className="h-6 w-6" />
          ) : (
            <KeyRound aria-hidden="true" className="h-6 w-6" />
          )}
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-lg sm:text-xl font-bold tracking-tight text-white focus:outline-none"
        >
          {step === 1 ? o.keyTitle : step === 2 ? o.backupTitle : o.verifiedTitle}
        </h1>
        <p className="text-xs leading-relaxed text-sky-100/85">
          {step === 1 ? o.keySubtitle : step === 2 ? o.backupSubtitle : o.verifiedSubtitle}
        </p>
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {status}
      </div>

      {step === 1 && (
        <form onSubmit={(e) => void handleCreateKey(e)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="simple-key-name" className="block text-xs font-semibold text-sky-100">
              {o.nameLabel}
            </label>
            <input
              id="simple-key-name"
              type="text"
              value={label}
              autoComplete="nickname"
              onChange={(e) => {
                setLabel(e.target.value);
                setError(null);
              }}
              placeholder={o.namePlaceholder}
              aria-describedby="simple-key-name-hint"
              data-testid="simple-keys-label-input"
              className="w-full rounded-xl border border-sky-400/40 bg-[#04142b] px-3.5 py-2.5 text-sm text-white placeholder:text-sky-200/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            />
            <p id="simple-key-name-hint" className="px-1 text-[11px] text-sky-100/80">
              {o.nameHint}
            </p>
            {label.length > 0 && inspectAuthorName(label).level !== 'safe' && (
              <p
                role={inspectAuthorName(label).level === 'block' ? 'alert' : 'status'}
                className={`rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${
                  inspectAuthorName(label).level === 'block'
                    ? 'border-rose-300/60 bg-rose-500/20 text-rose-100'
                    : 'border-amber-300/60 bg-amber-500/20 text-amber-100'
                }`}
              >
                {isJa ? inspectAuthorName(label).messageJa : inspectAuthorName(label).messageEn}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="simple-key-pass" className="block text-xs font-semibold text-sky-100">
              {o.passLabel}
            </label>
            <div className="relative">
              <input
                id="simple-key-pass"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                autoComplete="new-password"
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setError(null);
                }}
                placeholder={o.passPlaceholder}
                aria-describedby="simple-key-pass-hint"
                data-testid="simple-keys-passphrase-input"
                className="w-full rounded-xl border border-sky-400/40 bg-[#04142b] px-3.5 py-2.5 pr-12 text-sm text-white placeholder:text-sky-200/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((v) => !v)}
                aria-pressed={showPassphrase}
                aria-label={showPassphrase ? o.passHide : o.passShow}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-sky-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-300"
              >
                {showPassphrase ? (
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </div>
            <p id="simple-key-pass-hint" className="px-1 text-[11px] text-sky-100/80">
              {o.passHint}
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            data-testid="simple-keys-create-btn"
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#04142b] hover:bg-sky-300 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            <span>{busy ? o.creatingBtn : o.createBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => setRestoreOpen((v) => !v)}
            aria-expanded={restoreOpen}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-sky-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            <Upload aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{o.restoreToggle}</span>
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {isLegacyUnbacked ? (
            <div className="space-y-3 rounded-2xl border border-amber-300/60 bg-amber-500/15 p-4">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-50">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{o.legacyWarn}</span>
              </p>
              <button
                type="button"
                onClick={() => void handleRestartKey()}
                disabled={busy}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-amber-200/70 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-200/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
              >
                {restartArmed ? o.restartConfirmBtn : o.legacyRestartBtn}
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-2 text-xs" data-testid="simple-backup-checklist">
                {[
                  { done: true, label: o.checklistPass },
                  { done: downloaded, label: o.checklistSave },
                  { done: isAuthorKeyBackupVerified(primaryKey), label: o.checklistVerify },
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sky-50">
                    {item.done ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />
                    ) : (
                      <Circle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-sky-200/60" />
                    )}
                    <span className={item.done ? 'text-sky-50' : 'text-sky-100/80'}>
                      {item.label}
                    </span>
                    <span className="sr-only">{item.done ? (isJa ? '完了' : 'done') : isJa ? '未完了' : 'not done'}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void handleDownloadBackup()}
                disabled={!canDownload}
                data-testid="simple-keys-download-backup-btn"
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#04142b] hover:bg-sky-300 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                <span>{downloaded ? o.downloadedBtn : o.downloadBtn}</span>
              </button>

              <div className="space-y-2 rounded-2xl border border-sky-400/30 bg-[#04142b]/70 p-4">
                <label htmlFor="simple-verify-pass" className="block text-xs font-semibold text-sky-100">
                  {o.verifyLabel}
                </label>
                <input
                  id="simple-verify-pass"
                  type="password"
                  value={verifyPass}
                  autoComplete="current-password"
                  onChange={(e) => {
                    setVerifyPass(e.target.value);
                    setError(null);
                  }}
                  placeholder={o.verifyPlaceholder}
                  className="w-full rounded-xl border border-sky-400/40 bg-[#04142b] px-3.5 py-2.5 text-sm text-white placeholder:text-sky-200/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                />
                <input
                  ref={verifyInputRef}
                  type="file"
                  accept=".json,.chkey.json,application/json"
                  className="sr-only"
                  aria-label={o.verifyFileBtn}
                  data-testid="simple-keys-verify-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setVerifyFile(file);
                    setVerifyFileName(file?.name ?? '');
                    setError(null);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => verifyInputRef.current?.click()}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-950/60 px-3 py-2 text-xs font-semibold text-sky-50 hover:bg-sky-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                >
                  <Upload aria-hidden="true" className="h-4 w-4" />
                  <span>{o.verifyFileBtn}</span>
                </button>
                <p className="text-[11px] text-sky-100/80" aria-live="polite">
                  {verifyFileName ? `${o.fileChosen}: ${verifyFileName}` : o.noFileChosen}
                </p>
                <button
                  type="button"
                  onClick={() => void handleVerifyBackup()}
                  disabled={busy || !verifyFile || !verifyPass}
                  data-testid="simple-keys-verify-btn"
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#04142b] hover:bg-emerald-300 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  <span>{busy ? o.verifyingBtn : o.verifyBtn}</span>
                </button>
              </div>

              <details className="rounded-xl border border-sky-400/20 bg-sky-950/30 px-3 py-2 text-xs text-sky-100/90">
                <summary className="cursor-pointer font-semibold text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                  {o.whyBackup}
                </summary>
                <p className="pt-2 leading-relaxed">{o.whyBackupText}</p>
              </details>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-300/50 bg-emerald-400/10 p-4 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-300" />
            <p className="pt-1 font-mono text-[11px] text-emerald-100/90">
              {primaryKey?.label} · {primaryKey?.fingerprintShort}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!primaryKey) return;
              if (onKeyReady) onKeyReady(primaryKey);
              else navigate('/');
            }}
            data-testid="simple-keys-start-btn"
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#04142b] hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
            <span>{o.startBtn}</span>
          </button>
          {showContinueToDeck && (
            <Link
              to="/"
              data-testid="simple-keys-go-deck-link"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-sky-400/40 px-3.5 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              <span>GalleryDeck</span>
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-xs font-medium leading-relaxed text-rose-200">
          {error}
        </p>
      )}

      {restoreOpen && step === 1 && (
        <div className="space-y-2 border-t border-sky-400/20 pt-3">
          <label htmlFor="simple-restore-pass" className="block text-xs font-semibold text-sky-100">
            {o.restorePassPlaceholder}
          </label>
          <input
            id="simple-restore-pass"
            type="password"
            value={restorePass}
            autoComplete="current-password"
            onChange={(e) => setRestorePass(e.target.value)}
            className="w-full rounded-xl border border-sky-400/40 bg-[#04142b] px-3.5 py-2.5 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          />
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,.chkey.json,application/json"
            className="sr-only"
            aria-label={o.restoreFileBtn}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleRestoreFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            disabled={busy || !restorePass}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-sky-400/40 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-400/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            <span>{o.restoreFileBtn}</span>
          </button>
        </div>
      )}
    </div>
  );
}
