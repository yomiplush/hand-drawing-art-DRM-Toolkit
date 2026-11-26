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
  MessageSquare,
  PlusCircle,
  QrCode,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { HelpTip } from '../components/HelpTip';
import { QrMatrixSvg } from '../components/QrMatrixSvg';
import { AdvancedSettings } from '../components/ui/AdvancedSettings';
import { FriendlyErrorAlert } from '../components/ui/FriendlyErrorAlert';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { SimpleModeBanner } from '../components/ui/SimpleModeBanner';
import {
  createKeyChallenge,
  signKeyChallenge,
  verifyKeyChallengeResponse,
} from '../core/crypto/challenge';
import type { VerifiedChallengeResult } from '../core/crypto/challenge';
import { decryptKeyBackup, evaluatePassphraseStrength } from '../core/crypto/keyBackup';
import type { EncryptedKeyBackup } from '../core/crypto/keyBackup';
import {
  formatDiscordWebhookError,
  loadDiscordSettings,
  sendDiscordEncryptedKeyBackup,
  sendDiscordPublicKeyBackup,
} from '../core/discord/webhook';
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
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
  const [discordBusyKeyId, setDiscordBusyKeyId] = useState<string | null>(null);
  const [discordKeyMsg, setDiscordKeyMsg] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({});

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('chm-keys-updated'));
    }
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

  const handleSendPublicKeyToDiscord = async (k: AuthorKeyRecord) => {
    const settings = loadDiscordSettings();
    if (!settings.webhookUrl) {
      setDiscordKeyMsg((prev) => ({
        ...prev,
        [k.id]: { type: 'err', text: t.discordUx.webhook.notConfiguredError },
      }));
      return;
    }
    setDiscordBusyKeyId(k.id);
    setDiscordKeyMsg((prev) => {
      const next = { ...prev };
      delete next[k.id];
      return next;
    });
    try {
      const exportBundleJson = JSON.stringify(buildPublicKeyExportBundle(k), null, 2);
      await sendDiscordPublicKeyBackup(settings.webhookUrl, {
        label: k.label,
        publicKeyBase64Url: k.publicKeyBase64Url,
        fingerprintHex: k.fingerprintHex,
        fingerprintShort: k.fingerprintShort,
        exportBundleJson,
      });
      setDiscordKeyMsg((prev) => ({
        ...prev,
        [k.id]: { type: 'ok', text: t.discordUx.keyBackup.sentPublicKeyMsg },
      }));
    } catch (err) {
      setDiscordKeyMsg((prev) => ({
        ...prev,
        [k.id]: { type: 'err', text: formatDiscordWebhookError(err, t.discordUx.webhook) },
      }));
    } finally {
      setDiscordBusyKeyId(null);
    }
  };

  const handleSendEncryptedKeyToDiscord = async (k: AuthorKeyRecord) => {
    if (!k.encryptedBackup) return;
    const settings = loadDiscordSettings();
    if (!settings.webhookUrl) {
      setDiscordKeyMsg((prev) => ({
        ...prev,
        [k.id]: { type: 'err', text: t.discordUx.webhook.notConfiguredError },
      }));
      return;
    }
    if (!window.confirm(t.discordUx.keyBackup.encryptedConfirmWarning)) {
      return;
    }
    setDiscordBusyKeyId(k.id);
    try {
      await sendDiscordEncryptedKeyBackup(settings.webhookUrl, {
        label: k.label,
        fingerprintShort: k.fingerprintShort,
        encryptedBackupJson: JSON.stringify(k.encryptedBackup, null, 2),
      });
      setDiscordKeyMsg((prev) => ({
        ...prev,
        [k.id]: { type: 'ok', text: t.discordUx.keyBackup.sentEncryptedMsg },
      }));
    } catch (err) {
      setDiscordKeyMsg((prev) => ({
        ...prev,
        [k.id]: { type: 'err', text: formatDiscordWebhookError(err, t.discordUx.webhook) },
      }));
    } finally {
      setDiscordBusyKeyId(null);
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
    <div className="space-y-6 min-w-0">
      <header className="flex items-start justify-between gap-3 sm:gap-4 border-b ga-border pb-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-semibold ga-text break-words">
            {t.keys.title}
          </h1>
          <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed break-words">
            {t.keys.subtitle}
          </p>
        </div>

        <HelpIconButton
          label={t.minimal.keys.helpLabel}
          title={t.minimal.keys.helpLabel}
          closeLabel={t.minimal.home.closeHelp}
          testId="keys-help-btn"
          panelTestId="keys-help-panel"
        >
          <div className="space-y-1.5">
            <p className="font-semibold text-[var(--ga-warning-text)]">{t.keys.storageWarningTitle}</p>
            <p className="ga-text-secondary">{t.keys.storageWarningBody}</p>
          </div>
          <div
            data-testid="keys-standalone-storage-note"
            className="ga-status-info rounded-xl border p-3 text-xs"
          >
            {t.keys.standaloneStorageNote}
          </div>
        </HelpIconButton>
      </header>

      <SimpleModeBanner testId="keys-simple-mode-banner" />

      {hasUnbackedKey && (
        <div
          role="note"
          data-testid="keys-unbacked-alert"
          className="ga-status-warning rounded-2xl border px-4 py-3 flex items-start sm:items-center gap-2.5 text-xs sm:text-sm min-w-0"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{t.minimal.keys.unbackedAlertShort}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold ga-text flex items-center gap-2 min-w-0">
            <KeyRound className="h-5 w-5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.keys.generateTitle}</span>
            <HelpTip
              label={t.simple.advancedTips.ed25519Label}
              text={t.simple.advancedTips.ed25519Text}
              testId="keys-ed25519-tip-btn"
            />
          </h2>

          <form onSubmit={handleGenerate} className="space-y-3 min-w-0">
            <div className="min-w-0">
              <label className="block text-xs font-medium ga-text-secondary mb-1">
                {t.keys.keyLabelInput}
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={64}
                placeholder={t.keys.keyLabelPlaceholder}
                data-testid="keygen-label"
                className="ga-input w-full min-w-0 rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium ga-text-secondary mb-1">
                {t.keys.backupPassInput}
              </label>
              <input
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                placeholder={t.keys.backupPassPlaceholder}
                data-testid="keygen-passphrase"
                className="ga-input w-full min-w-0 rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
              />
              {newPassphrase.length > 0 && (
                <div data-testid="keygen-passphrase-strength" className="mt-1.5 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="ga-text-muted">{t.hardening.passphraseStrength.label}</span>
                    <span
                      className={
                        passphraseStrength.score === 'strong'
                          ? 'font-medium text-[var(--ga-success-text)]'
                          : passphraseStrength.score === 'fair'
                            ? 'font-medium text-[var(--ga-warning-text)]'
                            : 'font-medium text-[var(--ga-error-text)]'
                      }
                    >
                      {passphraseStrength.score === 'strong'
                        ? t.hardening.passphraseStrength.strong
                        : passphraseStrength.score === 'fair'
                          ? t.hardening.passphraseStrength.fair
                          : t.hardening.passphraseStrength.tooShort}
                    </span>
                  </div>
                  <p className="text-[11px] ga-text-muted break-words">
                    {t.hardening.passphraseStrength.guidance}
                  </p>
                </div>
              )}
            </div>

            {genError && (
              <FriendlyErrorAlert
                error={genError}
                onDismiss={() => setGenError(null)}
              />
            )}

            <button
              type="submit"
              data-testid="keygen-submit"
              className="ga-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px] cursor-pointer text-center"
            >
              <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t.keys.generateBtn}</span>
            </button>
          </form>

          {pendingBackup && (
            <div className="ga-status-info rounded-xl border p-4 space-y-2.5 min-w-0">
              <h3 className="text-sm font-semibold break-words">
                {t.keys.backupReadyTitle}
              </h3>
              <p className="text-xs ga-text-secondary leading-relaxed break-words">
                {t.keys.backupReadyBody}
              </p>
              <button
                type="button"
                data-testid="download-pending-backup"
                onClick={() => handleDownloadBackup(pendingBackup.keyId, pendingBackup.backup)}
                className="ga-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] cursor-pointer text-center"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t.keys.downloadBackupBtn}</span>
              </button>
            </div>
          )}
        </section>

        <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold ga-text flex items-center gap-2 min-w-0">
            <Upload className="h-5 w-5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.keys.restoreTitle}</span>
          </h2>

          <form onSubmit={handleRestore} className="space-y-3 min-w-0">
            <div className="min-w-0">
              <label
                htmlFor={restoreFileInputId}
                className="block text-xs font-medium ga-text-secondary mb-1"
              >
                {t.keys.restoreFileLabel}
              </label>
              <input
                id={restoreFileInputId}
                type="file"
                accept=".json,.chkey.json,application/json"
                data-testid="restore-file-input"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                className="block w-full min-w-0 max-w-full overflow-hidden text-xs ga-text-secondary file:mr-3 file:rounded-xl file:border file:border-[var(--ga-border-strong)] file:bg-[var(--ga-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--ga-text)] hover:file:opacity-90"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium ga-text-secondary mb-1">
                {t.keys.restorePassLabel}
              </label>
              <input
                type="password"
                value={restorePass}
                onChange={(e) => setRestorePass(e.target.value)}
                data-testid="restore-passphrase"
                className="ga-input w-full min-w-0 rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>

            {restoreError && (
              <FriendlyErrorAlert
                error={restoreError}
                onDismiss={() => setRestoreError(null)}
              />
            )}
            {restoreStatus && (
              <p role="status" data-testid="restore-status-msg" className="text-xs text-[var(--ga-accent)] break-words">
                {restoreStatus}
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
              <button
                type="submit"
                data-testid="restore-submit"
                className="ga-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px] cursor-pointer text-center"
              >
                <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t.keys.restoreBtn}</span>
              </button>

              <button
                type="button"
                data-testid="verify-backup-btn"
                onClick={() => void handleVerifyBackupOnly()}
                className="ga-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] cursor-pointer text-center"
              >
                <CheckCircle2 className="h-4 w-4 text-[var(--ga-success-text)] shrink-0" aria-hidden="true" />
                <span>{t.keys.verifyBackupBtn}</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold ga-text">{t.keys.myKeysTitle}</h2>
          <Link
            to="/devices"
            data-testid="keys-manage-devices-link"
            className="ga-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[44px] shrink-0 text-center"
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-[var(--ga-accent)]" aria-hidden="true" />
            <span>{t.devices.keysPageManageDevicesBtn}</span>
          </Link>
        </div>
        {authorKeys.length === 0 ? (
          <p className="text-sm ga-text-muted">{t.keys.noMyKeys}</p>
        ) : (
          <div className="space-y-3 min-w-0">
            {authorKeys.map((k) => {
              const matchingNotices = keyNotices.filter(
                (n) => n.subjectPublicKeyBase64Url === k.publicKeyBase64Url,
              );
              const qrExpanded = expandedQrKeyId === k.id;
              return (
                <div
                  key={k.id}
                  data-testid="author-key-card"
                  className="ga-surface-subtle rounded-xl p-4 space-y-3.5 min-w-0"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-semibold ga-text break-words">{k.label}</span>
                      <span className="ga-status-info rounded-full border px-2.5 py-0.5 text-[11px] font-medium max-w-full break-words">
                        {k.storageMode === 'webcrypto-non-extractable'
                          ? t.keys.modeNonExtractable
                          : t.keys.modeEncryptedFallback}
                      </span>
                      {!k.hasBackupDownloaded && (
                        <span
                          data-testid="key-unbacked-badge"
                          className="ga-status-warning rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                        >
                          {t.keys.unbackedBadge}
                        </span>
                      )}
                      {matchingNotices.map((n) => (
                        <span
                          key={n.id}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                            n.noticeType === 'revocation'
                              ? 'ga-status-error'
                              : 'ga-status-warning'
                          }`}
                        >
                          {n.noticeType === 'revocation'
                            ? t.hardening.notices.revokeBadge
                            : t.hardening.notices.rotateBadge}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs font-mono text-[var(--ga-accent)] break-all [overflow-wrap:anywhere]">
                      {t.hardening.fingerprint.shortLabel}: {k.fingerprintShort}
                    </div>
                    <div
                      data-testid={`author-key-fp-${k.id}`}
                      className="text-[11px] font-mono ga-text-secondary break-all [overflow-wrap:anywhere]"
                    >
                      {t.hardening.fingerprint.fullHexLabel}: {k.fingerprintHex}
                    </div>
                    <div className="text-[11px] font-mono ga-text-muted break-all [overflow-wrap:anywhere]">
                      Ed25519 PK: {k.publicKeyBase64Url}
                    </div>
                    {!k.encryptedBackup && (
                      <div className="text-[11px] text-[var(--ga-warning-text)] break-words">
                        {t.keys.noBackupExportNotice}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 pt-3 border-t ga-border min-w-0">
                    <button
                      type="button"
                      data-testid={`copy-fp-btn-${k.id}`}
                      onClick={() => handleCopyText(`fp-${k.id}`, k.fingerprintHex)}
                      className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer"
                    >
                      {copiedId === `fp-${k.id}` ? (
                        <Check className="h-3.5 w-3.5 text-[var(--ga-success-text)] shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0" />
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
                      className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer"
                    >
                      <QrCode className="h-3.5 w-3.5 text-[var(--ga-accent)] shrink-0" />
                      <span>
                        {qrExpanded
                          ? t.hardening.fingerprint.hideQrBtn
                          : t.hardening.fingerprint.showQrBtn}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText(k.id, k.publicKeyBase64Url)}
                      className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer"
                    >
                      {copiedId === k.id ? (
                        <Check className="h-3.5 w-3.5 text-[var(--ga-accent)] shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0" />
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
                      className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      <span>{t.keys.exportPublicBtn}</span>
                    </button>

                    <Link
                      to={`/exchange?identity=${encodeURIComponent(k.id)}`}
                      data-testid="keys-share-exchange-link"
                      className="ga-status-info inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center hover:opacity-90"
                    >
                      <Share2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{t.keys.shareViaExchangeBtn}</span>
                    </Link>

                    {k.encryptedBackup && (
                      <button
                        type="button"
                        onClick={() => handleDownloadBackup(k.id, k.encryptedBackup!)}
                        className="ga-status-info inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer hover:opacity-90"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        <span>{t.keys.downloadBackupBtn}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={discordBusyKeyId === k.id}
                      data-testid={`send-discord-pubkey-${k.id}`}
                      onClick={() => void handleSendPublicKeyToDiscord(k)}
                      className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer disabled:opacity-50"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[var(--ga-accent)] shrink-0" />
                      <span>
                        {discordBusyKeyId === k.id
                          ? t.discordUx.keyBackup.sendingBtn
                          : t.discordUx.keyBackup.sendPublicKeyBtn}
                      </span>
                    </button>

                    {k.encryptedBackup && (
                      <button
                        type="button"
                        disabled={discordBusyKeyId === k.id}
                        data-testid={`send-discord-enckey-${k.id}`}
                        onClick={() => void handleSendEncryptedKeyToDiscord(k)}
                        className="ga-status-warning inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer disabled:opacity-50"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>{t.discordUx.keyBackup.sendEncryptedBtn}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteAuthorKey(k.id)}
                      className="ga-status-error inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium min-h-[44px] max-w-full whitespace-normal text-center cursor-pointer hover:opacity-90"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{t.keys.deleteKeyBtn}</span>
                    </button>
                  </div>

                  {discordKeyMsg[k.id] && (
                    <div
                      role={discordKeyMsg[k.id].type === 'err' ? 'alert' : 'status'}
                      className={`rounded-xl border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
                        discordKeyMsg[k.id].type === 'err'
                          ? 'ga-status-error'
                          : 'ga-status-success'
                      }`}
                    >
                      <span>{discordKeyMsg[k.id].text}</span>
                      {discordKeyMsg[k.id].type === 'err' && (
                        <Link
                          to="/storage#discord-webhook"
                          className="underline font-semibold"
                        >
                          {t.discordUx.webhook.configureLinkLabel}
                        </Link>
                      )}
                    </div>
                  )}

                  {qrExpanded && (
                    <div
                      data-testid={`fp-qr-panel-${k.id}`}
                      className="ga-card-solid rounded-xl p-3 flex flex-col sm:flex-row items-center sm:items-center gap-4 min-w-0"
                    >
                      <QrMatrixSvg
                        value={`chm-fp:${k.fingerprintHex}`}
                        testId={`fp-qr-svg-${k.id}`}
                        label={`${k.label} ${t.hardening.fingerprint.showQrBtn}`}
                        className="w-32 h-32 max-w-full rounded-lg bg-white p-1 shrink-0 border ga-border"
                      />
                      <div className="space-y-1 text-xs ga-text-secondary min-w-0 w-full text-center sm:text-start">
                        <p className="font-medium text-[var(--ga-accent)]">{t.hardening.fingerprint.label}</p>
                        <p className="font-mono text-[11px] break-all [overflow-wrap:anywhere] ga-text">
                          {k.fingerprintHex}
                        </p>
                        <p className="text-[11px] ga-text-muted break-words">
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

      <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold ga-text flex items-center gap-2 min-w-0">
              <ShieldCheck className="h-5 w-5 text-[var(--ga-success-text)] shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{t.keys.trustedTitle}</span>
            </h2>
            <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed break-words">
              {t.keys.trustedSubtitle}
            </p>
          </div>
          <Link
            to="/exchange?tab=trusted"
            data-testid="keys-open-exchange-link"
            className="ga-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium self-start sm:self-center shrink-0 min-h-[44px] text-center"
          >
            <Share2 className="h-3.5 w-3.5 shrink-0 text-[var(--ga-accent)]" aria-hidden="true" />
            <span>{t.keys.openExchangeTrustedBtn}</span>
          </Link>
        </div>

        <p className="ga-status-info rounded-xl border px-3 py-2 text-xs leading-relaxed break-words">
          {t.hardening.trust.outOfBandNote}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!trustOutOfBandConfirmed) return;
            void handleSaveTrusted('confirmed');
          }}
          className="space-y-3 min-w-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
            <input
              type="text"
              required
              value={trustPubInput}
              onChange={(e) => setTrustPubInput(e.target.value)}
              placeholder={t.keys.addTrustedPubInput}
              data-testid="trusted-pub-input"
              className="ga-input w-full min-w-0 rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            />
            <input
              type="text"
              required
              value={trustLabel}
              onChange={(e) => setTrustLabel(e.target.value)}
              maxLength={64}
              placeholder={t.keys.addTrustedLabelInput}
              data-testid="trusted-label-input"
              className="ga-input w-full min-w-0 rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            />
            <input
              type="text"
              value={trustNote}
              onChange={(e) => setTrustNote(e.target.value)}
              maxLength={200}
              placeholder={t.keys.addTrustedNoteInput}
              className="ga-input w-full min-w-0 rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
            <label className="flex items-start gap-2.5 text-xs ga-text-secondary cursor-pointer min-h-[44px] min-w-0 py-1">
              <input
                type="checkbox"
                checked={trustOutOfBandConfirmed}
                onChange={(e) => setTrustOutOfBandConfirmed(e.target.checked)}
                data-testid="trusted-confirm-checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--ga-primary-bg)]"
              />
              <span className="leading-relaxed min-w-0 break-words">
                {t.hardening.trust.confirmCheckbox}
              </span>
            </label>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 shrink-0">
              <button
                type="button"
                data-testid="trusted-save-unconfirmed-btn"
                disabled={!trustPubInput.trim() || !trustLabel.trim()}
                onClick={() => void handleSaveTrusted('unconfirmed')}
                className="ga-status-warning w-full sm:w-auto inline-flex items-center justify-center rounded-xl border px-3.5 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] cursor-pointer text-center"
              >
                {t.hardening.trust.saveUnconfirmedBtn}
              </button>
              <button
                type="submit"
                data-testid="trusted-add-btn"
                disabled={!trustOutOfBandConfirmed}
                className="ga-status-success w-full sm:w-auto inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0 min-h-[44px] cursor-pointer text-center"
              >
                {t.keys.addTrustedBtn}
              </button>
            </div>
          </div>
        </form>

        {trustError && (
          <FriendlyErrorAlert
            error={trustError}
            onDismiss={() => setTrustError(null)}
          />
        )}

        {trustedKeys.length === 0 ? (
          <p className="text-sm ga-text-muted">{t.keys.noTrustedKeys}</p>
        ) : (
          <div className="space-y-2.5 min-w-0">
            {trustedKeys.map((tk) => {
              const isUnconfirmed = tk.verificationState === 'unconfirmed';
              const matchingNotices = keyNotices.filter(
                (n) => n.subjectPublicKeyBase64Url === tk.publicKeyBase64Url,
              );
              return (
                <div
                  key={tk.publicKeyBase64Url}
                  data-testid="trusted-key-card"
                  className="ga-surface-subtle rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className={`font-semibold text-sm break-words ${
                          isUnconfirmed ? 'text-[var(--ga-warning-text)]' : 'text-[var(--ga-success-text)]'
                        }`}
                      >
                        {tk.label}
                      </span>
                      {isUnconfirmed && (
                        <span className="ga-status-warning rounded-full border px-2 py-0.5 text-[11px] font-medium">
                          {t.hardening.trust.unconfirmedBadge}
                        </span>
                      )}
                      {matchingNotices.map((n) => (
                        <span
                          key={n.id}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            n.noticeType === 'revocation'
                              ? 'ga-status-error'
                              : 'ga-status-warning'
                          }`}
                        >
                          {n.noticeType === 'revocation'
                            ? t.hardening.notices.revokeBadge
                            : t.hardening.notices.rotateBadge}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs font-mono ga-text-secondary break-all [overflow-wrap:anywhere]">
                      {tk.fingerprintShort} · {tk.fingerprintHex}
                    </div>
                    <div className="text-[11px] font-mono ga-text-muted break-all [overflow-wrap:anywhere]">
                      {tk.publicKeyBase64Url}
                    </div>
                    {isUnconfirmed && (
                      <div className="text-[11px] text-[var(--ga-warning-text)] break-words">
                        {t.hardening.trust.unconfirmedHelp}
                      </div>
                    )}
                    {tk.note && (
                      <div className="text-xs ga-text-muted break-words [overflow-wrap:anywhere]">
                        {tk.note}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto lg:shrink-0">
                    {isUnconfirmed && (
                      <button
                        type="button"
                        data-testid="trusted-confirm-now-btn"
                        onClick={async () => {
                          await confirmTrustedKey(tk.publicKeyBase64Url);
                          await refreshAll();
                        }}
                        className="ga-status-success inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium min-h-[44px] cursor-pointer text-center"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span>{t.hardening.trust.confirmNowBtn}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await removeTrustedKey(tk.publicKeyBase64Url);
                        await refreshAll();
                      }}
                      className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs hover:text-[var(--ga-error-text)] min-h-[44px] cursor-pointer text-center"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
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
        <p className="text-xs ga-text-secondary leading-relaxed break-words">
          {t.hardening.notices.sectionSubtitle}
        </p>

        <div className="ga-status-warning rounded-xl border p-3 flex items-start gap-2.5 text-xs leading-relaxed min-w-0">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="min-w-0 break-words">{t.hardening.notices.compromiseWarning}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 min-w-0">
          <form
            onSubmit={handleCreateNotice}
            className="ga-surface-subtle space-y-3 rounded-xl p-3.5 sm:p-4 min-w-0"
          >
            <h3 className="text-sm font-semibold ga-text">{t.hardening.notices.createTitle}</h3>

            <div className="min-w-0">
              <label className="block text-xs font-medium ga-text-secondary mb-1">
                {t.hardening.notices.subjectKeyLabel}
              </label>
              <select
                value={noticeSubjectKeyId}
                onChange={(e) => setNoticeSubjectKeyId(e.target.value)}
                data-testid="notice-subject-select"
                className="ga-input w-full min-w-0 max-w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
              >
                {authorKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label} ({k.fingerprintShort})
                  </option>
                ))}
              </select>
            </div>

            {selectedNoticeSubject?.storageMode === 'noble-encrypted-seed' && (
              <div className="min-w-0">
                <label className="block text-xs font-medium text-[var(--ga-warning-text)] mb-1 break-words">
                  {t.hardening.notices.passLabel} ({selectedNoticeSubject.label})
                </label>
                <input
                  type="password"
                  value={noticeSubjectPass}
                  onChange={(e) => setNoticeSubjectPass(e.target.value)}
                  className="ga-input w-full min-w-0 rounded-xl px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div className="min-w-0">
                <label className="block text-xs font-medium ga-text-secondary mb-1">
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
                  className="ga-input w-full min-w-0 max-w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="revocation">{t.hardening.notices.typeRevocation}</option>
                  <option value="rotation">{t.hardening.notices.typeRotation}</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-medium ga-text-secondary mb-1">
                  {t.hardening.notices.reasonLabel}
                </label>
                <select
                  value={noticeReason}
                  onChange={(e) => setNoticeReason(e.target.value as KeyNoticeReason)}
                  data-testid="notice-reason-select"
                  className="ga-input w-full min-w-0 max-w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
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
                <div className="min-w-0">
                  <label className="block text-xs font-medium ga-text-secondary mb-1">
                    {t.hardening.notices.replacementKeyLabel}
                  </label>
                  <select
                    value={noticeReplacementKeyId}
                    onChange={(e) => setNoticeReplacementKeyId(e.target.value)}
                    data-testid="notice-replacement-select"
                    className="ga-input w-full min-w-0 max-w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                  >
                    {authorKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.fingerprintShort})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedNoticeReplacement?.storageMode === 'noble-encrypted-seed' && (
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-[var(--ga-warning-text)] mb-1 break-words">
                      {t.hardening.notices.passLabel} ({selectedNoticeReplacement.label})
                    </label>
                    <input
                      type="password"
                      value={noticeReplacementPass}
                      onChange={(e) => setNoticeReplacementPass(e.target.value)}
                      className="ga-input w-full min-w-0 rounded-xl px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                )}
              </>
            )}

            <div className="min-w-0">
              <label className="block text-xs font-medium ga-text-secondary mb-1">
                {t.hardening.notices.noteLabel}
              </label>
              <input
                type="text"
                value={noticeNote}
                onChange={(e) => setNoticeNote(e.target.value)}
                maxLength={160}
                className="ga-input w-full min-w-0 rounded-xl px-3 py-2 text-sm min-h-[44px]"
              />
            </div>

            {noticeGenError && (
              <FriendlyErrorAlert
                error={noticeGenError}
                onDismiss={() => setNoticeGenError(null)}
              />
            )}

            <button
              type="submit"
              data-testid="notice-create-btn"
              disabled={authorKeys.length === 0}
              className="ga-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-40 min-h-[44px] cursor-pointer text-center"
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span>{t.hardening.notices.createBtn}</span>
            </button>

            {noticeGenResult && (
              <div className="ga-status-info rounded-xl border p-3 space-y-2 min-w-0">
                <div className="text-[11px] font-mono break-all [overflow-wrap:anywhere]">
                  {noticeGenResult.token}
                </div>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadJsonFile(
                        noticeGenResult.bundle,
                        `chm-notice-${noticeGenResult.bundle.subjectFingerprint.slice(0, 8)}.chnotice.json`,
                      )
                    }
                    className="ga-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs min-h-[44px] cursor-pointer text-center"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.hardening.notices.downloadBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyText('notice-tok', noticeGenResult.token)}
                    className="ga-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs min-h-[44px] cursor-pointer text-center"
                  >
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.hardening.notices.copyBtn}</span>
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="ga-surface-subtle space-y-3 rounded-xl p-3.5 sm:p-4 min-w-0">
            <h3 className="text-sm font-semibold ga-text">{t.hardening.notices.importTitle}</h3>

            <textarea
              rows={3}
              value={noticeImportInput}
              onChange={(e) => setNoticeImportInput(e.target.value)}
              placeholder={t.hardening.notices.importPlaceholder}
              data-testid="notice-import-input"
              className="ga-input w-full min-w-0 rounded-xl p-2.5 text-xs font-mono"
            />

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <button
                type="button"
                data-testid="notice-import-btn"
                disabled={!noticeImportInput.trim()}
                onClick={() => void handleImportNotice(noticeImportInput)}
                className="ga-btn-primary inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-40 min-h-[44px] cursor-pointer text-center"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>{t.hardening.notices.importBtn}</span>
              </button>

              <label
                htmlFor={noticeImportFileId}
                className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[44px] cursor-pointer text-center"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
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
              <FriendlyErrorAlert
                error={noticeImportError}
                onDismiss={() => setNoticeImportError(null)}
              />
            )}
            {noticeImportMsg && (
              <p role="status" className="text-xs text-[var(--ga-success-text)] break-words">
                {noticeImportMsg}
              </p>
            )}

            <div className="pt-2 space-y-2 min-w-0">
              <h4 className="text-xs font-semibold ga-text-secondary">
                {t.hardening.notices.listTitle}
              </h4>
              {keyNotices.length === 0 ? (
                <p className="text-xs ga-text-muted">{t.hardening.notices.noNotices}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 min-w-0">
                  {keyNotices.map((n) => (
                    <div
                      key={n.id}
                      data-testid="stored-notice-item"
                      className="ga-card-solid rounded-xl p-2.5 flex items-start justify-between gap-2 text-xs min-w-0"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              n.noticeType === 'revocation'
                                ? 'ga-status-error'
                                : 'ga-status-warning'
                            }`}
                          >
                            {n.noticeType === 'revocation'
                              ? t.hardening.notices.revokeBadge
                              : t.hardening.notices.rotateBadge}
                          </span>
                          <span className="ga-text-secondary break-words">
                            {t.hardening.notices.reasons[n.reason]}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] ga-text break-all [overflow-wrap:anywhere]">
                          {n.subjectFingerprintShort}
                          {n.replacementFingerprintShort
                            ? ` → ${n.replacementFingerprintShort}`
                            : ''}
                        </div>
                        <div className="text-[11px] ga-text-muted break-all">
                          {t.hardening.notices.issuedAtLabel}:{' '}
                          {new Date(n.noticeIssuedAt * 1000).toISOString()}
                        </div>
                        {n.note && (
                          <div className="text-[11px] ga-text-muted break-words [overflow-wrap:anywhere]">
                            {n.note}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteKeyNotice(n.id);
                          await refreshAll();
                        }}
                        aria-label={t.keys.removeBtn}
                        className="ga-btn-secondary inline-flex items-center justify-center rounded-lg p-2 hover:text-[var(--ga-error-text)] min-h-[44px] min-w-[44px] shrink-0 cursor-pointer"
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
        <p className="text-xs ga-text-secondary leading-relaxed break-words">
          {t.hardening.challenge.sectionSubtitle}
        </p>

        <div className="ga-status-info rounded-xl border p-3 text-xs leading-relaxed break-words">
          {t.hardening.challenge.scopeDisclaimer}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
          <form
            onSubmit={handleCreateChallenge}
            className="ga-surface-subtle space-y-2.5 rounded-xl p-3.5 min-w-0"
          >
            <h3 className="text-xs font-semibold ga-text">{t.hardening.challenge.createTitle}</h3>
            <input
              type="text"
              required
              value={challengeTargetPub}
              onChange={(e) => setChallengeTargetPub(e.target.value)}
              placeholder={t.hardening.challenge.targetPubLabel}
              data-testid="challenge-target-input"
              className="ga-input w-full min-w-0 rounded-xl px-2.5 py-2 text-xs font-mono min-h-[44px]"
            />
            <input
              type="text"
              value={challengeNote}
              onChange={(e) => setChallengeNote(e.target.value)}
              maxLength={96}
              placeholder={t.hardening.challenge.notePlaceholder}
              className="ga-input w-full min-w-0 rounded-xl px-2.5 py-2 text-xs min-h-[44px]"
            />
            {challengeGenError && (
              <p className="text-xs text-[var(--ga-error-text)] break-words">{challengeGenError}</p>
            )}
            <button
              type="submit"
              data-testid="challenge-create-btn"
              className="ga-btn-secondary w-full rounded-xl px-3 py-2 text-xs font-semibold min-h-[44px] cursor-pointer"
            >
              {t.hardening.challenge.createBtn}
            </button>
            {generatedChallengeToken && (
              <div className="space-y-1 min-w-0">
                <div className="text-[10px] ga-text-muted">
                  {t.hardening.challenge.challengeTokenLabel}
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={generatedChallengeToken}
                  data-testid="challenge-token-output"
                  className="ga-input w-full min-w-0 rounded-lg p-1.5 text-[10px] font-mono text-[var(--ga-accent)] break-all"
                />
              </div>
            )}
          </form>

          <form
            onSubmit={handleSignChallenge}
            className="ga-surface-subtle space-y-2.5 rounded-xl p-3.5 min-w-0"
          >
            <h3 className="text-xs font-semibold ga-text">{t.hardening.challenge.signTitle}</h3>
            <textarea
              required
              rows={2}
              value={signChallengeInput}
              onChange={(e) => setSignChallengeInput(e.target.value)}
              placeholder={t.hardening.challenge.challengeInputLabel}
              data-testid="challenge-sign-input"
              className="ga-input w-full min-w-0 rounded-xl p-2 text-xs font-mono"
            />
            <select
              value={signChallengeKeyId}
              onChange={(e) => setSignChallengeKeyId(e.target.value)}
              data-testid="challenge-sign-key-select"
              className="ga-input w-full min-w-0 max-w-full rounded-xl px-2.5 py-2 text-xs min-h-[44px]"
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
                className="ga-input w-full min-w-0 rounded-xl px-2.5 py-2 text-xs min-h-[44px]"
              />
            )}
            {signChallengeError && (
              <p className="text-xs text-[var(--ga-error-text)] break-words">{signChallengeError}</p>
            )}
            <button
              type="submit"
              data-testid="challenge-sign-btn"
              disabled={authorKeys.length === 0}
              className="ga-btn-primary w-full rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 min-h-[44px] cursor-pointer"
            >
              {t.hardening.challenge.signBtn}
            </button>
            {generatedResponseToken && (
              <div className="space-y-1 min-w-0">
                <div className="text-[10px] ga-text-muted">
                  {t.hardening.challenge.responseTokenLabel}
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={generatedResponseToken}
                  data-testid="challenge-response-output"
                  className="ga-input w-full min-w-0 rounded-lg p-1.5 text-[10px] font-mono text-[var(--ga-success-text)] break-all"
                />
              </div>
            )}
          </form>

          <form
            onSubmit={handleVerifyChallenge}
            className="ga-surface-subtle space-y-2.5 rounded-xl p-3.5 min-w-0 md:col-span-2 xl:col-span-1"
          >
            <h3 className="text-xs font-semibold ga-text">{t.hardening.challenge.verifyTitle}</h3>
            <textarea
              required
              rows={2}
              value={verifyChallengeText}
              onChange={(e) => setVerifyChallengeText(e.target.value)}
              placeholder={t.hardening.challenge.challengeInputLabel}
              data-testid="challenge-verify-challenge-input"
              className="ga-input w-full min-w-0 rounded-xl p-2 text-xs font-mono"
            />
            <textarea
              required
              rows={2}
              value={verifyResponseText}
              onChange={(e) => setVerifyResponseText(e.target.value)}
              placeholder={t.hardening.challenge.responseInputLabel}
              data-testid="challenge-verify-response-input"
              className="ga-input w-full min-w-0 rounded-xl p-2 text-xs font-mono"
            />
            {verifyChallengeError && (
              <p className="text-xs text-[var(--ga-error-text)] break-words">{verifyChallengeError}</p>
            )}
            <button
              type="submit"
              data-testid="challenge-verify-btn"
              className="ga-status-success w-full rounded-xl border px-3 py-2 text-xs font-semibold min-h-[44px] cursor-pointer"
            >
              {t.hardening.challenge.verifyBtn}
            </button>
            {verifyChallengeResult && (
              <div
                data-testid="challenge-verify-result"
                className={`rounded-xl border p-2.5 text-xs break-words ${
                  verifyChallengeResult.valid
                    ? 'ga-status-success'
                    : 'ga-status-error'
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
