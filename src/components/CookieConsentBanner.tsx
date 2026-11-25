import { Link } from 'react-router-dom';
import { Check, Cookie, Shield, X } from 'lucide-react';
import type { ConsentStatus } from '../core/storage/consent';
import { useI18n } from '../i18n/context';

interface CookieConsentBannerProps {
  open: boolean;
  status: ConsentStatus;
  onAccept: () => void;
  onReject: () => void;
  onClose?: () => void;
}

export function CookieConsentBanner({
  open,
  status,
  onAccept,
  onReject,
  onClose,
}: CookieConsentBannerProps) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      data-testid="cookie-consent-banner"
      className="fixed bottom-0 inset-x-0 z-50 px-3 pb-3 sm:px-6 sm:pb-5 pointer-events-none"
    >
      <div className="mx-auto max-w-4xl pointer-events-auto animate-slide-up rounded-2xl ga-popover p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl ga-surface-subtle p-2 text-[var(--ga-accent)] shrink-0 mt-0.5">
              <Cookie className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 id="cookie-consent-title" className="text-sm sm:text-base font-semibold ga-text">
                {t.consent.title}
              </h2>
              <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{t.consent.body}</p>
            </div>
          </div>

          {status !== 'unset' && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t.consent.closeLabel}
              className="rounded-lg p-1.5 ga-text-muted hover:text-[var(--ga-text)] transition-colors shrink-0 cursor-pointer min-h-[36px] min-w-[36px]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            to="/privacypolicy"
            onClick={() => {
              if (status !== 'unset' && onClose) onClose();
            }}
            data-testid="cookie-policy-link"
            className="inline-flex items-center gap-1.5 text-xs font-medium ga-text-accent hover:underline underline-offset-4"
          >
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.consent.policyLink}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onReject}
              data-testid="cookie-reject-btn"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl ga-btn-secondary px-4 py-2 text-xs sm:text-sm font-medium transition-colors min-h-[44px] cursor-pointer"
            >
              <X className="h-4 w-4 ga-text-muted" aria-hidden="true" />
              <span>{t.consent.rejectBtn}</span>
            </button>

            <button
              type="button"
              onClick={onAccept}
              data-testid="cookie-accept-btn"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl ga-btn-primary px-4 py-2 text-xs sm:text-sm font-semibold transition-colors min-h-[44px] cursor-pointer"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{t.consent.acceptBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
