import React, { useState } from 'react';
import { Check, MessageSquare, Send, ShieldCheck, Trash2 } from 'lucide-react';
import {
  clearDiscordSettings,
  formatDiscordWebhookError,
  loadDiscordSettings,
  saveDiscordSettings,
  sendDiscordTestMessage,
  validateDiscordWebhookUrl,
} from '../../core/discord/webhook';
import { useI18n } from '../../i18n/context';

export function DiscordWebhookSettings() {
  const { t, locale } = useI18n();
  const w = t.discordUx.webhook;

  const [initial] = useState(() => loadDiscordSettings());
  const [webhookUrl, setWebhookUrl] = useState(initial.webhookUrl);
  const [autoSend, setAutoSend] = useState(initial.autoSendOnCertify);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      saveDiscordSettings({
        webhookUrl,
        autoSendOnCertify: autoSend,
      });
      setStatusMsg(w.savedMsg);
    } catch (err) {
      setErrorMsg(formatDiscordWebhookError(err, w));
    }
  };

  const handleTest = async () => {
    setStatusMsg(null);
    setErrorMsg(null);
    const { valid, normalized } = validateDiscordWebhookUrl(webhookUrl);
    if (!valid) {
      setErrorMsg(w.invalidUrlError);
      return;
    }
    setBusy(true);
    try {
      await sendDiscordTestMessage(normalized, locale === 'ja' ? 'ja' : 'en');
      setStatusMsg(w.testSuccessMsg);
    } catch (err) {
      setErrorMsg(formatDiscordWebhookError(err, w));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    clearDiscordSettings();
    setWebhookUrl('');
    setAutoSend(false);
    setErrorMsg(null);
    setStatusMsg(w.deletedMsg);
  };

  return (
    <section
      id="discord-webhook"
      data-testid="discord-webhook-settings"
      className="ga-card rounded-2xl p-4 sm:p-5 space-y-4 min-w-0"
    >
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg font-semibold ga-text flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
          <span>{w.sectionTitle}</span>
        </h2>
        <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{w.sectionSubtitle}</p>
      </div>

      <div className="ga-status-info rounded-xl border px-3.5 py-2.5 flex items-start gap-2 text-xs leading-relaxed">
        <ShieldCheck className="h-4 w-4 text-[var(--ga-accent)] shrink-0 mt-0.5" aria-hidden="true" />
        <span>{w.localOnlyNotice}</span>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        <div className="space-y-1.5">
          <label
            htmlFor="discord-webhook-url-input"
            className="block text-xs font-medium ga-text-secondary"
          >
            {w.urlLabel}
          </label>
          <input
            id="discord-webhook-url-input"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={w.urlPlaceholder}
            data-testid="discord-webhook-url-input"
            className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px] font-mono"
          />
        </div>

        <label className="flex items-start gap-2.5 text-xs sm:text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            data-testid="discord-autosend-checkbox"
            className="mt-1 h-4 w-4 rounded accent-[var(--ga-accent)]"
          />
          <span className="space-y-0.5">
            <span className="block font-medium ga-text">{w.autoSendLabel}</span>
            <span className="block text-xs ga-text-muted">{w.autoSendHint}</span>
          </span>
        </label>

        {errorMsg && (
          <p
            role="alert"
            data-testid="discord-webhook-error"
            className="ga-status-error rounded-xl border px-3 py-2 text-xs"
          >
            {errorMsg}
          </p>
        )}

        {statusMsg && (
          <p
            role="status"
            data-testid="discord-webhook-status"
            className="ga-status-success rounded-xl border px-3 py-2 text-xs flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{statusMsg}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="submit"
            data-testid="discord-webhook-save-btn"
            className="ga-btn-primary inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold min-h-[44px] cursor-pointer"
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{w.saveBtn}</span>
          </button>

          <button
            type="button"
            disabled={busy || !webhookUrl.trim()}
            onClick={() => void handleTest()}
            data-testid="discord-webhook-test-btn"
            className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium min-h-[44px] disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{busy ? w.sendingLabel : w.testBtn}</span>
          </button>

          {webhookUrl.trim() && (
            <button
              type="button"
              onClick={handleDelete}
              data-testid="discord-webhook-delete-btn"
              className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium text-[var(--ga-error-text)] min-h-[44px] cursor-pointer"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{w.deleteBtn}</span>
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
