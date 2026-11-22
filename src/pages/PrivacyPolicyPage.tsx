import { Link } from 'react-router-dom';
import { Check, Cookie, ExternalLink, KeyRound, ShieldCheck, Trash2, X } from 'lucide-react';
import type { ConsentStatus } from '../core/storage/consent';
import { useI18n } from '../i18n/context';

interface PrivacyPolicyPageProps {
  consentStatus: ConsentStatus;
  onAcceptConsent: () => void;
  onRejectConsent: () => void;
  onResetConsent: () => void;
  onOpenBanner: () => void;
}

export function PrivacyPolicyPage({
  consentStatus,
  onAcceptConsent,
  onRejectConsent,
  onResetConsent,
  onOpenBanner,
}: PrivacyPolicyPageProps) {
  const { t } = useI18n();

  const statusText =
    consentStatus === 'accepted'
      ? t.consent.statusAccepted
      : consentStatus === 'rejected'
        ? t.consent.statusRejected
        : t.consent.statusUnset;

  const statusBadgeTone =
    consentStatus === 'accepted'
      ? 'border-sky-300/35 bg-sky-400/10 text-sky-200'
      : consentStatus === 'rejected'
        ? 'border-white/[0.14] bg-white/[0.06] text-slate-200'
        : 'border-amber-400/35 bg-amber-500/10 text-amber-200';

  return (
    <div className="space-y-8" data-testid="privacy-policy-page">
      <header className="space-y-2.5 border-b border-white/[0.08] pb-6">
        <p className="inline-flex items-center gap-2 text-xs font-mono text-sky-300/80">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.privacyPolicy.lastUpdated}</span>
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">{t.privacyPolicy.title}</h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
          {t.privacyPolicy.subtitle}
        </p>
        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
          <span>{t.privacyPolicy.gdprRefLabel}</span>
          <a
            href={t.privacyPolicy.gdprRefUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline underline-offset-4"
          >
            <span>{t.privacyPolicy.gdprRefUrl}</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </header>

      <section className="rounded-xl border border-white/[0.12] bg-[#051224]/70 backdrop-blur-md p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-medium text-white flex items-center gap-2">
            <Cookie className="h-5 w-5 text-sky-300" aria-hidden="true" />
            <span>{t.privacyPolicy.controlsTitle}</span>
          </h2>
          <span
            data-testid="policy-consent-status"
            className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium ${statusBadgeTone}`}
          >
            {t.consent.statusLabel}: {statusText}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {t.privacyPolicy.controlsDesc}
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onAcceptConsent}
            data-testid="policy-accept-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-white min-h-[42px] cursor-pointer"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>{t.consent.acceptBtn}</span>
          </button>

          <button
            type="button"
            onClick={onRejectConsent}
            data-testid="policy-reject-btn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.16] bg-white/[0.05] px-4 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:bg-white/[0.12] min-h-[42px] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{t.consent.rejectBtn}</span>
          </button>

          <button
            type="button"
            onClick={onOpenBanner}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs sm:text-sm font-medium text-sky-200 hover:bg-sky-500/20 min-h-[42px] cursor-pointer"
          >
            <Cookie className="h-4 w-4" aria-hidden="true" />
            <span>{t.privacyPolicy.reopenBannerBtn}</span>
          </button>

          <button
            type="button"
            onClick={onResetConsent}
            data-testid="policy-reset-btn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-2 text-xs sm:text-sm font-medium text-rose-200 hover:bg-rose-500/20 min-h-[42px] cursor-pointer"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>{t.privacyPolicy.resetConsentBtn}</span>
          </button>

          <Link
            to="/keys"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#030b18]/60 px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:border-white/[0.25] min-h-[42px]"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>{t.privacyPolicy.manageKeysBtn}</span>
          </Link>
        </div>
      </section>

      <div className="space-y-4">
        {t.privacyPolicy.sections.map((sec, idx) => (
          <section
            key={sec.title}
            className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-3"
          >
            <h2 className="text-base sm:text-lg font-medium text-slate-100">{sec.title}</h2>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{sec.body}</p>

            {idx === 3 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.12] text-slate-300">
                      <th className="py-2 pr-4 font-semibold">{t.privacyPolicy.tableHeaders.name}</th>
                      <th className="py-2 pr-4 font-semibold">
                        {t.privacyPolicy.tableHeaders.category}
                      </th>
                      <th className="py-2 pr-4 font-semibold">
                        {t.privacyPolicy.tableHeaders.purpose}
                      </th>
                      <th className="py-2 font-semibold">{t.privacyPolicy.tableHeaders.retention}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.08] text-slate-300">
                    {t.privacyPolicy.tableRows.map((row) => (
                      <tr key={row.name}>
                        <td className="py-2.5 pr-4 font-mono text-xs text-sky-200 align-top">
                          {row.name}
                        </td>
                        <td className="py-2.5 pr-4 align-top">{row.category}</td>
                        <td className="py-2.5 pr-4 align-top">{row.purpose}</td>
                        <td className="py-2.5 align-top text-slate-400">{row.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
