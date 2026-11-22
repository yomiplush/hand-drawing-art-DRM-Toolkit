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
      <div className="mx-auto max-w-4xl pointer-events-auto animate-slide-up rounded-xl border border-white/[0.14] bg-[#041021]/90 backdrop-blur-xl shadow-2xl shadow-black/75 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white/[0.06] border border-white/[0.1] p-2 text-sky-200 shrink-0 mt-0.5">
              <Cookie className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 id="cookie-consent-title" className="text-sm sm:text-base font-medium text-white">
                {t.consent.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{t.consent.body}</p>
            </div>
          </div>

          {status !== 'unset' && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t.consent.closeLabel}
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            to="/#privacypolicy"
            onClick={() => {
              if (status !== 'unset' && onClose) onClose();
            }}
            data-testid="cookie-policy-link"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200 underline underline-offset-4"
          >
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.consent.policyLink}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onReject}
              data-testid="cookie-reject-btn"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.16] bg-white/[0.05] px-4 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:bg-white/[0.12] transition-colors min-h-[42px] cursor-pointer"
            >
              <X className="h-4 w-4 text-slate-300" aria-hidden="true" />
              <span>{t.consent.rejectBtn}</span>
            </button>

            <button
              type="button"
              onClick={onAccept}
              data-testid="cookie-accept-btn"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-white transition-colors min-h-[42px] cursor-pointer"
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
