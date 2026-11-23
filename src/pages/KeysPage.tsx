import React, { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { parsePublicKeyExchangeInput } from '@yomiplush/chm-exchange/core';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  PlusCircle,
  QrCode,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { QrMatrixSvg } from '../components/QrMatrixSvg';
import { AdvancedSettings } from '../components/ui/AdvancedSettings';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import {
  createKeyChallenge,
  signKeyChallenge,
  verifyKeyChallengeResponse,
} from '../core/crypto/challenge';
import type { VerifiedChallengeResult } from '../core/crypto/challenge';
import { decryptKeyBackup, evaluatePassphraseStrength } from '../core/crypto/keyBackup';
import type { EncryptedKeyBackup } from '../core/crypto/keyBackup';
import { createSignedKeyNotice } from '../core/manifest/keyNotice';
import type { KeyNoticeReason, KeyNoticeType, PortableKeyNoticeBundle } from '../core/manifest/keyNotice';
import {
  addTrustedKey,
  buildPublicKeyExportBundle,
  confirmTrustedKey,
  createAuthorKey,
  deleteAuthorKey,
  deleteKeyNotice,
  listAuthorKeys,
  listKeyNotices,
  listTrustedKeys,
  markAuthorKeyBackedUp,
  removeTrustedKey,
  restoreAuthorKeyFromBackup,
  saveVerifiedKeyNotice,
  signWithAuthorKey,
} from '../core/storage/keyStore';
import type {
  AuthorKeyRecord,
  StoredKeyNoticeRecord,
  TrustedKeyRecord,
} from '../core/storage/keyStore';
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function KeysPage() {
  const { t } = useI18n();
  const restoreFileInputId = useId();
  const noticeImportFileId = useId();

  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);
  const [trustedKeys, setTrustedKeys] = useState<TrustedKeyRecord[]>([]);
  const [keyNotices, setKeyNotices] = useState<StoredKeyNoticeRecord[]>([]);

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
  const [trustOutOfBandConfirmed, setTrustOutOfBandConfirmed] = useState(false);
  const [trustError, setTrustError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQrKeyId, setExpandedQrKeyId] = useState<string | null>(null);

  // Notice creation & import state (Phase 3)
  const [noticeSubjectKeyId, setNoticeSubjectKeyId] = useState('');
  const [noticeType, setNoticeType] = useState<KeyNoticeType>('revocation');
  const [noticeReplacementKeyId, setNoticeReplacementKeyId] = useState('');
  const [noticeReason, setNoticeReason] = useState<KeyNoticeReason>('retired');
  const [noticeNote, setNoticeNote] = useState('');
  const [noticeSubjectPass, setNoticeSubjectPass] = useState('');
  const [noticeReplacementPass, setNoticeReplacementPass] = useState('');
  const [noticeGenResult, setNoticeGenResult] = useState<{
    token: string;
    bundle: PortableKeyNoticeBundle;
  } | null>(null);
  const [noticeGenError, setNoticeGenError] = useState<string | null>(null);
  const [noticeImportInput, setNoticeImportInput] = useState('');
  const [noticeImportMsg, setNoticeImportMsg] = useState<string | null>(null);
  const [noticeImportError, setNoticeImportError] = useState<string | null>(null);

  // Challenge-response state (Phase 2)
  const [challengeTargetPub, setChallengeTargetPub] = useState('');
  const [challengeNote, setChallengeNote] = useState('');
  const [generatedChallengeToken, setGeneratedChallengeToken] = useState('');
  const [challengeGenError, setChallengeGenError] = useState<string | null>(null);

  const [signChallengeInput, setSignChallengeInput] = useState('');
  const [signChallengeKeyId, setSignChallengeKeyId] = useState('');
  const [signChallengePass, setSignChallengePass] = useState('');
  const [generatedResponseToken, setGeneratedResponseToken] = useState('');
  const [signChallengeError, setSignChallengeError] = useState<string | null>(null);

  const [verifyChallengeText, setVerifyChallengeText] = useState('');
  const [verifyResponseText, setVerifyResponseText] = useState('');
  const [verifyChallengeResult, setVerifyChallengeResult] = useState<VerifiedChallengeResult | null>(
    null,
  );
  const [verifyChallengeError, setVerifyChallengeError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    const [ak, tk, kn] = await Promise.all([
      listAuthorKeys(),
      listTrustedKeys(),
      listKeyNotices(),
    ]);
    setAuthorKeys(ak);
    setTrustedKeys(tk);
    setKeyNotices(kn);
    if (ak.length > 0) {
      setNoticeSubjectKeyId((prev) => prev || ak[0].id);
      setSignChallengeKeyId((prev) => prev || ak[0].id);
      if (ak.length > 1) {
        setNoticeReplacementKeyId((prev) => prev || ak[1].id);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([listAuthorKeys(), listTrustedKeys(), listKeyNotices()]).then(([ak, tk, kn]) => {
      if (active) {
        setAuthorKeys(ak);
        setTrustedKeys(tk);
        setKeyNotices(kn);
        if (ak.length > 0) {
          setNoticeSubjectKeyId(ak[0].id);
          setSignChallengeKeyId(ak[0].id);
          if (ak.length > 1) {
            setNoticeReplacementKeyId(ak[1].id);
          }
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const passphraseStrength = evaluatePassphraseStrength(newPassphrase);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);
    setPendingBackup(null);
    try {
      if (newPassphrase && newPassphrase.length < 8) {
        throw new Error(t.hardening.passphraseStrength.guidance);
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
        (k) =>
          k.fingerprintHex === decrypted.fingerprint ||
          (pubB64 && k.publicKeyBase64Url === pubB64),
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

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleSaveTrusted = async (verificationState: 'confirmed' | 'unconfirmed') => {
    setTrustError(null);
    try {
      await addTrustedKey({
        publicKeyInput: trustPubInput,
        label: trustLabel,
        note: trustNote,
        verificationState,
      });
      setTrustPubInput('');
      setTrustLabel('');
      setTrustNote('');
      setTrustOutOfBandConfirmed(false);
      await refreshAll();
    } catch (err) {
      setTrustError(err instanceof Error ? err.message : 'Invalid public key');
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeGenError(null);
    setNoticeGenResult(null);
    try {
      const subjectKey = authorKeys.find((k) => k.id === noticeSubjectKeyId);
      if (!subjectKey) {
        throw new Error('Select a subject signing key first');
      }
      let replacementKey: AuthorKeyRecord | undefined;
      if (noticeType === 'rotation') {
        replacementKey = authorKeys.find((k) => k.id === noticeReplacementKeyId);
        if (!replacementKey || replacementKey.id === subjectKey.id) {
          throw new Error('Select a different replacement key for rotation');
        }
      }

      const created = await createSignedKeyNotice({
        noticeType,
        subjectPublicKey: subjectKey.publicKey,
        signWithSubjectKey: (msg) => signWithAuthorKey(subjectKey, msg, noticeSubjectPass || undefined),
        replacementPublicKey: replacementKey?.publicKey,
        signWithReplacementKey: replacementKey
          ? (msg) => signWithAuthorKey(replacementKey, msg, noticeReplacementPass || undefined)
          : undefined,
        reason: noticeReason,
        note: noticeNote.trim() || undefined,
      });

      await saveVerifiedKeyNotice(created.token);
      setNoticeGenResult({ token: created.token, bundle: created.bundle });
      setNoticeNote('');
      setNoticeSubjectPass('');
      setNoticeReplacementPass('');
      await refreshAll();
    } catch (err) {
      setNoticeGenError(err instanceof Error ? err.message : 'Failed to create signed notice');
    }
  };

  const handleImportNotice = async (raw: string) => {
    setNoticeImportError(null);
    setNoticeImportMsg(null);
    try {
      const { record } = await saveVerifiedKeyNotice(raw);
      setNoticeImportInput('');
      setNoticeImportMsg(
        `${record.noticeType === 'revocation' ? t.hardening.notices.revokeBadge : t.hardening.notices.rotateBadge}: ${record.subjectFingerprintShort}`,
      );
      await refreshAll();
    } catch (err) {
      setNoticeImportError(err instanceof Error ? err.message : 'Invalid key notice');
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setChallengeGenError(null);
    setGeneratedChallengeToken('');
    try {
      const parsed = parsePublicKeyExchangeInput(challengeTargetPub);
      const created = await createKeyChallenge({
        targetPublicKey32: parsed.publicKeyBytes,
        note: challengeNote.trim() || undefined,
      });
      setGeneratedChallengeToken(created.challengeToken);
      setVerifyChallengeText(created.challengeToken);
    } catch (err) {
      setChallengeGenError(err instanceof Error ? err.message : 'Invalid target public key');
    }
  };

  const handleSignChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignChallengeError(null);
    setGeneratedResponseToken('');
    try {
      const keyRec = authorKeys.find((k) => k.id === signChallengeKeyId);
      if (!keyRec) {
        throw new Error('Select a local signing key');
      }
      const signed = await signKeyChallenge({
        challengeInput: signChallengeInput,
        signerPublicKey32: keyRec.publicKey,
        signFn: (msg) => signWithAuthorKey(keyRec, msg, signChallengePass || undefined),
      });
      setGeneratedResponseToken(signed.responseToken);
      setVerifyResponseText(signed.responseToken);
      setSignChallengePass('');
    } catch (err) {
      setSignChallengeError(err instanceof Error ? err.message : 'Failed to sign challenge');
    }
  };

  const handleVerifyChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyChallengeError(null);
    setVerifyChallengeResult(null);
    try {
      const res = await verifyKeyChallengeResponse({
        challengeInput: verifyChallengeText,
        responseInput: verifyResponseText,
      });
      setVerifyChallengeResult(res);
    } catch (err) {
      setVerifyChallengeError(err instanceof Error ? err.message : 'Challenge verification error');
    }
  };

  const hasUnbackedKey = authorKeys.some((k) => !k.hasBackupDownloaded);
  const selectedNoticeSubject = authorKeys.find((k) => k.id === noticeSubjectKeyId);
  const selectedNoticeReplacement = authorKeys.find((k) => k.id === noticeReplacementKeyId);
  const selectedChallengeSigner = authorKeys.find((k) => k.id === signChallengeKeyId);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">{t.keys.title}</h1>
          <p className="text-xs sm:text-sm text-slate-400">{t.keys.subtitle}</p>
        </div>

        <HelpIconButton
          label={t.minimal.keys.helpLabel}
          title={t.minimal.keys.helpLabel}
          closeLabel={t.minimal.home.closeHelp}
          testId="keys-help-btn"
          panelTestId="keys-help-panel"
        >
          <div className="space-y-1.5">
            <p className="font-semibold text-amber-200">{t.keys.storageWarningTitle}</p>
            <p className="text-slate-200">{t.keys.storageWarningBody}</p>
          </div>
          <div
            data-testid="keys-standalone-storage-note"
            className="rounded-lg border border-sky-400/25 bg-sky-500/10 p-3 text-xs text-sky-100"
          >
            {t.keys.standaloneStorageNote}
          </div>
        </HelpIconButton>
      </header>

      {hasUnbackedKey && (
        <div
          role="note"
          data-testid="keys-unbacked-alert"
          className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm text-amber-100"
        >
          <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" aria-hidden="true" />
          <span>{t.minimal.keys.unbackedAlertShort}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-sky-300" aria-hidden="true" />
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
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
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
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
              />
              {newPassphrase.length > 0 && (
                <div data-testid="keygen-passphrase-strength" className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{t.hardening.passphraseStrength.label}</span>
                    <span
                      className={
                        passphraseStrength.score === 'strong'
                          ? 'font-medium text-emerald-300'
                          : passphraseStrength.score === 'fair'
                            ? 'font-medium text-amber-200'
                            : 'font-medium text-rose-300'
                      }
                    >
                      {passphraseStrength.score === 'strong'
                        ? t.hardening.passphraseStrength.strong
                        : passphraseStrength.score === 'fair'
                          ? t.hardening.passphraseStrength.fair
                          : t.hardening.passphraseStrength.tooShort}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t.hardening.passphraseStrength.guidance}
                  </p>
                </div>
              )}
            </div>

            {genError && (
              <p role="alert" className="text-xs text-rose-300">
                {genError}
              </p>
            )}

            <button
              type="submit"
              data-testid="keygen-submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white transition-colors min-h-[44px] cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>{t.keys.generateBtn}</span>
            </button>
          </form>

          {pendingBackup && (
            <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-4 space-y-2.5">
              <h3 className="text-sm font-semibold text-sky-200">{t.keys.backupReadyTitle}</h3>
              <p className="text-xs text-slate-200 leading-relaxed">{t.keys.backupReadyBody}</p>
              <button
                type="button"
                data-testid="download-pending-backup"
                onClick={() => handleDownloadBackup(pendingBackup.keyId, pendingBackup.backup)}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-300 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-200 min-h-[44px] cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{t.keys.downloadBackupBtn}</span>
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <Upload className="h-5 w-5 text-sky-300" aria-hidden="true" />
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
                className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
              />
            </div>

            {restoreError && (
              <p role="alert" className="text-xs text-rose-300">
                {restoreError}
              </p>
            )}
            {restoreStatus && (
              <p role="status" data-testid="restore-status-msg" className="text-xs text-sky-300">
                {restoreStatus}
              </p>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                data-testid="restore-submit"
                className="inline-flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/25 transition-colors min-h-[44px] cursor-pointer"
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

      <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
        <h2 className="text-base sm:text-lg font-semibold text-white">{t.keys.myKeysTitle}</h2>
        {authorKeys.length === 0 ? (
          <p className="text-sm text-slate-400">{t.keys.noMyKeys}</p>
        ) : (
          <div className="space-y-3">
            {authorKeys.map((k) => {
              const matchingNotices = keyNotices.filter(
                (n) => n.subjectPublicKeyBase64Url === k.publicKeyBase64Url,
              );
              const qrExpanded = expandedQrKeyId === k.id;
              return (
                <div
                  key={k.id}
                  data-testid="author-key-card"
                  className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{k.label}</span>
                        <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-200">
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
                        {matchingNotices.map((n) => (
                          <span
                            key={n.id}
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              n.noticeType === 'revocation'
                                ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                                : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                            }`}
                          >
                            {n.noticeType === 'revocation'
                              ? t.hardening.notices.revokeBadge
                              : t.hardening.notices.rotateBadge}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs font-mono text-sky-300">
                        {t.hardening.fingerprint.shortLabel}: {k.fingerprintShort}
                      </div>
                      <div
                        data-testid={`author-key-fp-${k.id}`}
                        className="text-[11px] font-mono text-slate-300 break-all"
                      >
                        {t.hardening.fingerprint.fullHexLabel}: {k.fingerprintHex}
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
                        data-testid={`copy-fp-btn-${k.id}`}
                        onClick={() => handleCopyText(`fp-${k.id}`, k.fingerprintHex)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                      >
                        {copiedId === `fp-${k.id}` ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {copiedId === `fp-${k.id}`
                            ? t.hardening.fingerprint.copiedFull
                            : t.hardening.fingerprint.copyFullBtn}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid={`toggle-fp-qr-${k.id}`}
                        aria-expanded={qrExpanded}
                        onClick={() => setExpandedQrKeyId(qrExpanded ? null : k.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5 text-sky-300" />
                        <span>
                          {qrExpanded
                            ? t.hardening.fingerprint.hideQrBtn
                            : t.hardening.fingerprint.showQrBtn}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyText(k.id, k.publicKeyBase64Url)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                      >
                        {copiedId === k.id ? (
                          <Check className="h-3.5 w-3.5 text-sky-300" />
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{t.keys.exportPublicBtn}</span>
                      </button>

                      <Link
                        to={`/exchange?identity=${encodeURIComponent(k.id)}`}
                        data-testid="keys-share-exchange-link"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20 min-h-[44px]"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>{t.keys.shareViaExchangeBtn}</span>
                      </Link>

                      {k.encryptedBackup && (
                        <button
                          type="button"
                          onClick={() => handleDownloadBackup(k.id, k.encryptedBackup!)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20 min-h-[44px] cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{t.keys.downloadBackupBtn}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteAuthorKey(k.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20 min-h-[44px] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t.keys.deleteKeyBtn}</span>
                      </button>
                    </div>
                  </div>

                  {qrExpanded && (
                    <div
                      data-testid={`fp-qr-panel-${k.id}`}
                      className="rounded-lg border border-sky-400/25 bg-[#051224]/90 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                    >
                      <QrMatrixSvg
                        value={`chm-fp:${k.fingerprintHex}`}
                        testId={`fp-qr-svg-${k.id}`}
                        label={`${k.label} ${t.hardening.fingerprint.showQrBtn}`}
                        className="w-32 h-32 rounded-lg bg-white p-1 shrink-0"
                      />
                      <div className="space-y-1 text-xs text-slate-300 min-w-0">
                        <p className="font-medium text-sky-200">{t.hardening.fingerprint.label}</p>
                        <p className="font-mono text-[11px] break-all text-slate-200">
                          {k.fingerprintHex}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {t.hardening.fingerprint.qrCaption}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.1] bg-[#051224]/70 backdrop-blur-md p-5 space-y-5">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3.5 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20 self-start sm:self-center shrink-0 min-h-[44px]"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.keys.openExchangeTrustedBtn}</span>
          </Link>
        </div>

        <p className="rounded-lg border border-sky-400/20 bg-sky-500/5 px-3 py-2 text-xs text-slate-300 leading-relaxed">
          {t.hardening.trust.outOfBandNote}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!trustOutOfBandConfirmed) return;
            void handleSaveTrusted('confirmed');
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={trustPubInput}
              onChange={(e) => setTrustPubInput(e.target.value)}
              placeholder={t.keys.addTrustedPubInput}
              data-testid="trusted-pub-input"
              className="rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
            />
            <input
              type="text"
              required
              value={trustLabel}
              onChange={(e) => setTrustLabel(e.target.value)}
              maxLength={64}
              placeholder={t.keys.addTrustedLabelInput}
              data-testid="trusted-label-input"
              className="rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
            />
            <input
              type="text"
              value={trustNote}
              onChange={(e) => setTrustNote(e.target.value)}
              maxLength={200}
              placeholder={t.keys.addTrustedNoteInput}
              className="rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={trustOutOfBandConfirmed}
                onChange={(e) => setTrustOutOfBandConfirmed(e.target.checked)}
                data-testid="trusted-confirm-checkbox"
                className="h-4 w-4 rounded border-white/25 bg-[#030b18] accent-emerald-400"
              />
              <span>{t.hardening.trust.confirmCheckbox}</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="trusted-save-unconfirmed-btn"
                disabled={!trustPubInput.trim() || !trustLabel.trim()}
                onClick={() => void handleSaveTrusted('unconfirmed')}
                className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
              >
                {t.hardening.trust.saveUnconfirmedBtn}
              </button>
              <button
                type="submit"
                data-testid="trusted-add-btn"
                disabled={!trustOutOfBandConfirmed}
                className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 min-h-[44px] cursor-pointer"
              >
                {t.keys.addTrustedBtn}
              </button>
            </div>
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
            {trustedKeys.map((tk) => {
              const isUnconfirmed = tk.verificationState === 'unconfirmed';
              const matchingNotices = keyNotices.filter(
                (n) => n.subjectPublicKeyBase64Url === tk.publicKeyBase64Url,
              );
              return (
                <div
                  key={tk.publicKeyBase64Url}
                  data-testid="trusted-key-card"
                  className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-semibold text-sm ${
                          isUnconfirmed ? 'text-amber-200' : 'text-emerald-200'
                        }`}
                      >
                        {tk.label}
                      </span>
                      {isUnconfirmed && (
                        <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                          {t.hardening.trust.unconfirmedBadge}
                        </span>
                      )}
                      {matchingNotices.map((n) => (
                        <span
                          key={n.id}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            n.noticeType === 'revocation'
                              ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                              : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                          }`}
                        >
                          {n.noticeType === 'revocation'
                            ? t.hardening.notices.revokeBadge
                            : t.hardening.notices.rotateBadge}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs font-mono text-slate-300">
                      {tk.fingerprintShort} · {tk.fingerprintHex}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 break-all">
                      {tk.publicKeyBase64Url}
                    </div>
                    {isUnconfirmed && (
                      <div className="text-[11px] text-amber-200/80">
                        {t.hardening.trust.unconfirmedHelp}
                      </div>
                    )}
                    {tk.note && <div className="text-xs text-slate-400">{tk.note}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    {isUnconfirmed && (
                      <button
                        type="button"
                        data-testid="trusted-confirm-now-btn"
                        onClick={async () => {
                          await confirmTrustedKey(tk.publicKeyBase64Url);
                          await refreshAll();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 min-h-[44px] cursor-pointer"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{t.hardening.trust.confirmNowBtn}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await removeTrustedKey(tk.publicKeyBase64Url);
                        await refreshAll();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] px-3 py-2 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-200 min-h-[44px] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t.keys.removeBtn}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AdvancedSettings
        label={t.hardening.notices.sectionTitle}
        summary={`${keyNotices.length}`}
        testId="keys-notices-panel"
      >
        <p className="text-xs text-slate-300 leading-relaxed">
          {t.hardening.notices.sectionSubtitle}
        </p>

        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-100 leading-relaxed">
          <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t.hardening.notices.compromiseWarning}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={handleCreateNotice} className="space-y-3 rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-4">
            <h3 className="text-sm font-semibold text-white">{t.hardening.notices.createTitle}</h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.hardening.notices.subjectKeyLabel}
              </label>
              <select
                value={noticeSubjectKeyId}
                onChange={(e) => setNoticeSubjectKeyId(e.target.value)}
                data-testid="notice-subject-select"
                className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-sm text-white min-h-[44px]"
              >
                {authorKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label} ({k.fingerprintShort})
                  </option>
                ))}
              </select>
            </div>

            {selectedNoticeSubject?.storageMode === 'noble-encrypted-seed' && (
              <div>
                <label className="block text-xs font-medium text-amber-200 mb-1">
                  {t.hardening.notices.passLabel} ({selectedNoticeSubject.label})
                </label>
                <input
                  type="password"
                  value={noticeSubjectPass}
                  onChange={(e) => setNoticeSubjectPass(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-sm text-white min-h-[44px]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.hardening.notices.typeLabel}
                </label>
                <select
                  value={noticeType}
                  onChange={(e) => {
                    const nextType = e.target.value as KeyNoticeType;
                    setNoticeType(nextType);
                    setNoticeReason(nextType === 'rotation' ? 'key-superseded' : 'retired');
                  }}
                  data-testid="notice-type-select"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-sm text-white min-h-[44px]"
                >
                  <option value="revocation">{t.hardening.notices.typeRevocation}</option>
                  <option value="rotation">{t.hardening.notices.typeRotation}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.hardening.notices.reasonLabel}
                </label>
                <select
                  value={noticeReason}
                  onChange={(e) => setNoticeReason(e.target.value as KeyNoticeReason)}
                  data-testid="notice-reason-select"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-sm text-white min-h-[44px]"
                >
                  {(['key-compromise', 'key-superseded', 'retired', 'other'] as const).map(
                    (reason) => (
                      <option key={reason} value={reason}>
                        {t.hardening.notices.reasons[reason]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {noticeType === 'rotation' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t.hardening.notices.replacementKeyLabel}
                  </label>
                  <select
                    value={noticeReplacementKeyId}
                    onChange={(e) => setNoticeReplacementKeyId(e.target.value)}
                    data-testid="notice-replacement-select"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-sm text-white min-h-[44px]"
                  >
                    {authorKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.fingerprintShort})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedNoticeReplacement?.storageMode === 'noble-encrypted-seed' && (
                  <div>
                    <label className="block text-xs font-medium text-amber-200 mb-1">
                      {t.hardening.notices.passLabel} ({selectedNoticeReplacement.label})
                    </label>
                    <input
                      type="password"
                      value={noticeReplacementPass}
                      onChange={(e) => setNoticeReplacementPass(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-sm text-white min-h-[44px]"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.hardening.notices.noteLabel}
              </label>
              <input
                type="text"
                value={noticeNote}
                onChange={(e) => setNoticeNote(e.target.value)}
                maxLength={160}
                className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-3 py-2 text-sm text-white min-h-[44px]"
              />
            </div>

            {noticeGenError && (
              <p role="alert" className="text-xs text-rose-300">
                {noticeGenError}
              </p>
            )}

            <button
              type="submit"
              data-testid="notice-create-btn"
              disabled={authorKeys.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-300 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-40 min-h-[44px] cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{t.hardening.notices.createBtn}</span>
            </button>

            {noticeGenResult && (
              <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 p-3 space-y-2">
                <div className="text-[11px] font-mono text-sky-200 break-all">
                  {noticeGenResult.token}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadJsonFile(
                        noticeGenResult.bundle,
                        `chm-notice-${noticeGenResult.bundle.subjectFingerprint.slice(0, 8)}.chnotice.json`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-[#051224] px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-500/20 min-h-[44px] cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t.hardening.notices.downloadBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyText('notice-tok', noticeGenResult.token)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3 py-1.5 text-xs text-slate-200 min-h-[44px] cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t.hardening.notices.copyBtn}</span>
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-4">
            <h3 className="text-sm font-semibold text-white">{t.hardening.notices.importTitle}</h3>

            <textarea
              rows={3}
              value={noticeImportInput}
              onChange={(e) => setNoticeImportInput(e.target.value)}
              placeholder={t.hardening.notices.importPlaceholder}
              data-testid="notice-import-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] p-2.5 text-xs font-mono text-white placeholder:text-slate-500"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="notice-import-btn"
                disabled={!noticeImportInput.trim()}
                onClick={() => void handleImportNotice(noticeImportInput)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:opacity-40 min-h-[44px] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{t.hardening.notices.importBtn}</span>
              </button>

              <label
                htmlFor={noticeImportFileId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 min-h-[44px] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{t.hardening.notices.importFileBtn}</span>
              </label>
              <input
                id={noticeImportFileId}
                type="file"
                accept=".json,.chnotice.json,application/json"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const txt = await f.text();
                    await handleImportNotice(txt);
                  }
                }}
              />
            </div>

            {noticeImportError && (
              <p role="alert" className="text-xs text-rose-300">
                {noticeImportError}
              </p>
            )}
            {noticeImportMsg && (
              <p role="status" className="text-xs text-emerald-300">
                {noticeImportMsg}
              </p>
            )}

            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-300">
                {t.hardening.notices.listTitle}
              </h4>
              {keyNotices.length === 0 ? (
                <p className="text-xs text-slate-500">{t.hardening.notices.noNotices}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {keyNotices.map((n) => (
                    <div
                      key={n.id}
                      data-testid="stored-notice-item"
                      className="rounded-lg border border-white/[0.08] bg-[#020813]/80 p-2.5 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              n.noticeType === 'revocation'
                                ? 'bg-rose-500/20 text-rose-200'
                                : 'bg-amber-500/20 text-amber-200'
                            }`}
                          >
                            {n.noticeType === 'revocation'
                              ? t.hardening.notices.revokeBadge
                              : t.hardening.notices.rotateBadge}
                          </span>
                          <span className="text-slate-300">
                            {t.hardening.notices.reasons[n.reason]}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-200">
                          {n.subjectFingerprintShort}
                          {n.replacementFingerprintShort
                            ? ` → ${n.replacementFingerprintShort}`
                            : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.hardening.notices.issuedAtLabel}:{' '}
                          {new Date(n.noticeIssuedAt * 1000).toISOString()}
                        </div>
                        {n.note && <div className="text-[11px] text-slate-400">{n.note}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteKeyNotice(n.id);
                          await refreshAll();
                        }}
                        aria-label={t.keys.removeBtn}
                        className="rounded-md border border-white/[0.1] p-2 text-slate-400 hover:text-rose-200 min-h-[36px] min-w-[36px] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AdvancedSettings>

      <AdvancedSettings
        label={t.hardening.challenge.sectionTitle}
        testId="keys-challenge-panel"
      >
        <p className="text-xs text-slate-300 leading-relaxed">
          {t.hardening.challenge.sectionSubtitle}
        </p>

        <div className="rounded-lg border border-sky-400/25 bg-sky-500/10 p-3 text-xs text-sky-100 leading-relaxed">
          {t.hardening.challenge.scopeDisclaimer}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form onSubmit={handleCreateChallenge} className="space-y-2.5 rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3.5">
            <h3 className="text-xs font-semibold text-white">{t.hardening.challenge.createTitle}</h3>
            <input
              type="text"
              required
              value={challengeTargetPub}
              onChange={(e) => setChallengeTargetPub(e.target.value)}
              placeholder={t.hardening.challenge.targetPubLabel}
              data-testid="challenge-target-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-2.5 py-2 text-xs font-mono text-white min-h-[44px]"
            />
            <input
              type="text"
              value={challengeNote}
              onChange={(e) => setChallengeNote(e.target.value)}
              maxLength={96}
              placeholder={t.hardening.challenge.notePlaceholder}
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-2.5 py-2 text-xs text-white min-h-[44px]"
            />
            {challengeGenError && <p className="text-xs text-rose-300">{challengeGenError}</p>}
            <button
              type="submit"
              data-testid="challenge-create-btn"
              className="w-full rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
            >
              {t.hardening.challenge.createBtn}
            </button>
            {generatedChallengeToken && (
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400">
                  {t.hardening.challenge.challengeTokenLabel}
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={generatedChallengeToken}
                  data-testid="challenge-token-output"
                  className="w-full rounded border border-white/[0.1] bg-[#020813] p-1.5 text-[10px] font-mono text-sky-200"
                />
              </div>
            )}
          </form>

          <form onSubmit={handleSignChallenge} className="space-y-2.5 rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3.5">
            <h3 className="text-xs font-semibold text-white">{t.hardening.challenge.signTitle}</h3>
            <textarea
              required
              rows={2}
              value={signChallengeInput}
              onChange={(e) => setSignChallengeInput(e.target.value)}
              placeholder={t.hardening.challenge.challengeInputLabel}
              data-testid="challenge-sign-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] p-2 text-xs font-mono text-white"
            />
            <select
              value={signChallengeKeyId}
              onChange={(e) => setSignChallengeKeyId(e.target.value)}
              data-testid="challenge-sign-key-select"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-2.5 py-2 text-xs text-white min-h-[44px]"
            >
              {authorKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label} ({k.fingerprintShort})
                </option>
              ))}
            </select>
            {selectedChallengeSigner?.storageMode === 'noble-encrypted-seed' && (
              <input
                type="password"
                value={signChallengePass}
                onChange={(e) => setSignChallengePass(e.target.value)}
                placeholder={t.hardening.challenge.signPassLabel}
                className="w-full rounded-lg border border-white/[0.14] bg-[#020813] px-2.5 py-2 text-xs text-white min-h-[44px]"
              />
            )}
            {signChallengeError && <p className="text-xs text-rose-300">{signChallengeError}</p>}
            <button
              type="submit"
              data-testid="challenge-sign-btn"
              disabled={authorKeys.length === 0}
              className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-40 min-h-[44px] cursor-pointer"
            >
              {t.hardening.challenge.signBtn}
            </button>
            {generatedResponseToken && (
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400">
                  {t.hardening.challenge.responseTokenLabel}
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={generatedResponseToken}
                  data-testid="challenge-response-output"
                  className="w-full rounded border border-white/[0.1] bg-[#020813] p-1.5 text-[10px] font-mono text-emerald-200"
                />
              </div>
            )}
          </form>

          <form onSubmit={handleVerifyChallenge} className="space-y-2.5 rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3.5">
            <h3 className="text-xs font-semibold text-white">{t.hardening.challenge.verifyTitle}</h3>
            <textarea
              required
              rows={2}
              value={verifyChallengeText}
              onChange={(e) => setVerifyChallengeText(e.target.value)}
              placeholder={t.hardening.challenge.challengeInputLabel}
              data-testid="challenge-verify-challenge-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] p-2 text-xs font-mono text-white"
            />
            <textarea
              required
              rows={2}
              value={verifyResponseText}
              onChange={(e) => setVerifyResponseText(e.target.value)}
              placeholder={t.hardening.challenge.responseInputLabel}
              data-testid="challenge-verify-response-input"
              className="w-full rounded-lg border border-white/[0.14] bg-[#020813] p-2 text-xs font-mono text-white"
            />
            {verifyChallengeError && (
              <p className="text-xs text-rose-300">{verifyChallengeError}</p>
            )}
            <button
              type="submit"
              data-testid="challenge-verify-btn"
              className="w-full rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 min-h-[44px] cursor-pointer"
            >
              {t.hardening.challenge.verifyBtn}
            </button>
            {verifyChallengeResult && (
              <div
                data-testid="challenge-verify-result"
                className={`rounded-lg border p-2.5 text-xs ${
                  verifyChallengeResult.valid
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                    : 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                }`}
              >
                {verifyChallengeResult.valid
                  ? t.hardening.challenge.validResult
                  : verifyChallengeResult.error || t.hardening.challenge.invalidResult}
              </div>
            )}
          </form>
        </div>
      </AdvancedSettings>
    </div>
  );
}
