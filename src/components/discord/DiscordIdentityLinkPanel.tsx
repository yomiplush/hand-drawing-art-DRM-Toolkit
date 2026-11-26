import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Link2,
  MessageSquare,
  QrCode,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  createSignedDiscordProfileClaim,
  encodeDiscordProfileShareParam,
  listStoredDiscordBindings,
  parseDiscordProfileInput,
  removeStoredDiscordBinding,
  saveVerifiedDiscordBinding,
  verifySignedDiscordProfileClaim,
  type SignedDiscordProfileClaim,
  type StoredDiscordBinding,
} from '../../core/discord/identityLink';
import { listAuthorKeys, type AuthorKeyRecord } from '../../core/storage/keyStore';
import { useI18n } from '../../i18n/context';
import { QrMatrixSvg } from '../QrMatrixSvg';

interface DiscordIdentityLinkPanelProps {
  initialProfileParam?: string;
}

export function DiscordIdentityLinkPanel({
  initialProfileParam,
}: DiscordIdentityLinkPanelProps) {
  const { t } = useI18n();
  const d = t.discordUx.identityLink;

  const [authorKeys, setAuthorKeys] = useState<AuthorKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [signBusy, setSignBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signedClaim, setSignedClaim] = useState<SignedDiscordProfileClaim | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'json' | 'link' | null>(null);

  const [importInput, setImportInput] = useState(initialProfileParam ?? '');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [bindings, setBindings] = useState<StoredDiscordBinding[]>(() =>
    listStoredDiscordBindings(),
  );

  useEffect(() => {
    let active = true;
    void listAuthorKeys().then((keys) => {
      if (!active) return;
      setAuthorKeys(keys);
      if (keys.length > 0) {
        setSelectedKeyId((prev) => prev || keys[0].id);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignError(null);
    const key = authorKeys.find((k) => k.id === selectedKeyId);
    if (!key) return;
    setSignBusy(true);
    try {
      const claim = await createSignedDiscordProfileClaim({
        authorKey: key,
        discordUsername: discordHandle,
        passphrase: passphrase || undefined,
      });
      saveVerifiedDiscordBinding(claim);
      setSignedClaim(claim);
      setBindings(listStoredDiscordBindings());
      setPassphrase('');
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_DISCORD_USERNAME') {
        setSignError(d.invalidHandleError);
      } else {
        setSignError(err instanceof Error ? err.message : d.invalidClaimError);
      }
    } finally {
      setSignBusy(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportStatus(null);
    try {
      const claim = parseDiscordProfileInput(importInput);
      const valid = await verifySignedDiscordProfileClaim(claim);
      if (!valid) {
        throw new Error(d.invalidClaimError);
      }
      saveVerifiedDiscordBinding(claim);
      setBindings(listStoredDiscordBindings());
      setImportInput('');
      setImportStatus(`${d.importSuccessMsg} (${claim.discordUsername})`);
    } catch {
      setImportError(d.invalidClaimError);
    }
  };

  const shareUrl = signedClaim
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://certified-handmade.com'}/exchange?discordProfile=${encodeDiscordProfileShareParam(signedClaim)}`
    : '';

  const handleCopy = async (kind: 'json' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      window.setTimeout(() => setCopiedKind(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadJson = () => {
    if (!signedClaim) return;
    const blob = new Blob([JSON.stringify(signedClaim, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chm-discord-profile-${signedClaim.fingerprint.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const handleRemoveBinding = (pubKey: string) => {
    removeStoredDiscordBinding(pubKey);
    setBindings(listStoredDiscordBindings());
  };

  return (
    <section
      data-testid="discord-identity-link-panel"
      className="ga-card rounded-2xl p-4 sm:p-5 space-y-5 min-w-0"
    >
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg font-semibold ga-text flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
          <span>{d.sectionTitle}</span>
        </h2>
        <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{d.sectionSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Sign & Link Own Discord Username */}
        <form onSubmit={handleSign} className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3">
          {authorKeys.length > 0 && (
            <div>
              <label className="block text-xs font-medium ga-text-secondary mb-1">
                {d.keySelectLabel}
              </label>
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                data-testid="discord-link-key-select"
                className="ga-input w-full rounded-xl px-3 py-2 text-xs sm:text-sm min-h-[42px]"
              >
                {authorKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label} ({k.fingerprintShort})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium ga-text-secondary mb-1">
              {d.discordHandleLabel}
            </label>
            <input
              type="text"
              value={discordHandle}
              onChange={(e) => setDiscordHandle(e.target.value)}
              placeholder={d.discordHandlePlaceholder}
              data-testid="discord-handle-input"
              className="ga-input w-full rounded-xl px-3 py-2 text-sm min-h-[42px]"
            />
          </div>

          {authorKeys.find((k) => k.id === selectedKeyId)?.storageMode ===
            'noble-encrypted-seed' && (
            <div>
              <label className="block text-xs font-medium ga-text-secondary mb-1">
                {d.passphraseLabel}
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={d.passphrasePlaceholder}
                className="ga-input w-full rounded-xl px-3 py-2 text-sm min-h-[42px]"
              />
            </div>
          )}

          {signError && (
            <p role="alert" className="ga-status-error rounded-xl border px-3 py-2 text-xs">
              {signError}
            </p>
          )}

          <button
            type="submit"
            disabled={signBusy || authorKeys.length === 0 || !discordHandle.trim()}
            data-testid="discord-sign-profile-btn"
            className="ga-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold min-h-[42px] disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{d.signBtn}</span>
          </button>

          {signedClaim && (
            <div
              data-testid="discord-signed-claim-result"
              className="ga-status-success rounded-xl border p-3 space-y-2.5 text-xs"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {d.signedSuccessMsg} ({signedClaim.discordUsername})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy('json', JSON.stringify(signedClaim, null, 2))}
                  className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                >
                  {copiedKind === 'json' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedKind === 'json' ? d.copiedLabel : d.copyJsonBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{d.downloadJsonBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy('link', shareUrl)}
                  className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                >
                  {copiedKind === 'link' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedKind === 'link' ? d.copiedLabel : d.copyLinkBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowQr((prev) => !prev)}
                  className="ga-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{showQr ? d.hideQrBtn : d.showQrBtn}</span>
                </button>
              </div>
              {showQr && shareUrl && (
                <div className="pt-2 flex justify-center">
                  <div className="rounded-xl bg-white p-2.5 inline-block border ga-border">
                    <QrMatrixSvg value={shareUrl} className="w-40 h-40" />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Verify & Import Artist Discord Profile */}
        <form onSubmit={handleImport} className="ga-surface-subtle rounded-xl border ga-border p-4 space-y-3">
          <div className="text-xs sm:text-sm font-semibold ga-text">{d.importTitle}</div>
          <textarea
            rows={4}
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            placeholder={d.importPlaceholder}
            data-testid="discord-import-claim-input"
            className="ga-input w-full rounded-xl px-3 py-2 text-xs font-mono"
          />
          {importError && (
            <p role="alert" className="ga-status-error rounded-xl border px-3 py-2 text-xs">
              {importError}
            </p>
          )}
          {importStatus && (
            <p role="status" className="ga-status-success rounded-xl border px-3 py-2 text-xs">
              {importStatus}
            </p>
          )}
          <button
            type="submit"
            disabled={!importInput.trim()}
            data-testid="discord-import-claim-btn"
            className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold min-h-[42px] disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{d.importBtn}</span>
          </button>
        </form>
      </div>

      {bindings.length > 0 && (
        <div className="space-y-2 pt-2 border-t ga-border">
          <div className="text-xs font-semibold ga-text-secondary">{d.verifiedBindingsTitle}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {bindings.map((b) => (
              <div
                key={b.publicKeyBase64Url}
                data-testid="discord-binding-item"
                className="ga-surface-subtle rounded-xl border ga-border px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold ga-text truncate">
                    {b.discordUsername}{' '}
                    <span className="font-normal ga-text-muted">({b.label})</span>
                  </div>
                  <div className="font-mono text-[11px] ga-text-muted truncate">
                    FP: {b.fingerprintHex.slice(0, 16)}…
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBinding(b.publicKeyBase64Url)}
                  className="ga-btn-secondary rounded-lg p-1.5 text-[var(--ga-error-text)] cursor-pointer shrink-0"
                  title={d.removeBindingBtn}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
