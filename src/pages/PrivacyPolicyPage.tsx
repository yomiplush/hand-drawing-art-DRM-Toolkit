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
  const googlePolicy = t.googleCompliance.privacyPolicyGoogle;

  const statusText =
    consentStatus === 'accepted'
      ? t.consent.statusAccepted
      : consentStatus === 'rejected'
        ? t.consent.statusRejected
        : t.consent.statusUnset;

  const statusBadgeTone =
    consentStatus === 'accepted'
      ? 'ga-status-info'
      : consentStatus === 'rejected'
        ? 'ga-surface-subtle ga-border ga-text-secondary'
        : 'ga-status-warning';

  const inventoryRows = [
    ...t.privacyPolicy.tableRows,
    {
      name: googlePolicy.tableRowName,
      category: googlePolicy.tableRowCategory,
      purpose: googlePolicy.tableRowPurpose,
      retention: googlePolicy.tableRowRetention,
    },
  ];

  return (
    <div className="space-y-8 min-w-0 w-full" data-testid="privacy-policy-page">
      <header className="space-y-2.5 border-b ga-border pb-6 min-w-0">
        <p className="inline-flex items-center gap-2 text-xs font-mono ga-text-accent">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t.privacyPolicy.lastUpdated}</span>
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold ga-text break-words">{t.privacyPolicy.title}</h1>
        <p className="text-sm sm:text-base ga-text-secondary leading-relaxed max-w-3xl break-words">
          {t.privacyPolicy.subtitle}
        </p>
        <div className="text-xs ga-text-muted flex flex-wrap items-center gap-2 min-w-0">
          <span>{t.privacyPolicy.gdprRefLabel}</span>
          <a
            href={t.privacyPolicy.gdprRefUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ga-text-accent underline underline-offset-4 break-all"
          >
            <span>{t.privacyPolicy.gdprRefUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </header>

      <section className="ga-card rounded-2xl p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2 min-w-0">
            <Cookie className="h-5 w-5 ga-text-accent shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t.privacyPolicy.controlsTitle}</span>
          </h2>
          <span
            data-testid="policy-consent-status"
            className={`inline-flex items-center rounded-lg border px-3 py-1 text-xs font-medium self-start sm:self-auto ${statusBadgeTone}`}
          >
            {t.consent.statusLabel}: {statusText}
          </span>
        </div>

        <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed break-words">
          {t.privacyPolicy.controlsDesc}
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onAcceptConsent}
            data-testid="policy-accept-btn"
            className="ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold min-h-[42px] cursor-pointer"
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.consent.acceptBtn}</span>
          </button>

          <button
            type="button"
            onClick={onRejectConsent}
            data-testid="policy-reject-btn"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium min-h-[42px] cursor-pointer"
          >
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.consent.rejectBtn}</span>
          </button>

          <button
            type="button"
            onClick={onOpenBanner}
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium min-h-[42px] cursor-pointer"
          >
            <Cookie className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.privacyPolicy.reopenBannerBtn}</span>
          </button>

          <button
            type="button"
            onClick={onResetConsent}
            data-testid="policy-reset-btn"
            className="ga-status-error inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs sm:text-sm font-medium min-h-[42px] cursor-pointer"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.privacyPolicy.resetConsentBtn}</span>
          </button>

          <Link
            to="/keys"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium min-h-[42px]"
          >
            <KeyRound className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{t.privacyPolicy.manageKeysBtn}</span>
          </Link>
        </div>
      </section>

      <div className="space-y-4 min-w-0">
        {t.privacyPolicy.sections.map((sec, idx) => (
          <section key={sec.title} className="ga-card rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
            <h2 className="text-base sm:text-lg font-medium ga-text break-words">{sec.title}</h2>
            <p className="text-sm ga-text-secondary leading-relaxed whitespace-pre-line break-words">
              {sec.body}
            </p>

            {idx === 3 && (
              <div className="overflow-x-auto pt-2 max-w-full">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b ga-border-strong ga-text">
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
                  <tbody className="divide-y divide-[var(--ga-border)] ga-text-secondary">
                    {inventoryRows.map((row) => (
                      <tr key={row.name}>
                        <td className="py-2.5 pr-4 font-mono text-xs ga-text-accent align-top break-all">
                          {row.name}
                        </td>
                        <td className="py-2.5 pr-4 align-top">{row.category}</td>
                        <td className="py-2.5 pr-4 align-top">{row.purpose}</td>
                        <td className="py-2.5 align-top ga-text-muted">{row.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        <section
          data-testid="privacy-google-drive-section"
          className="ga-card-solid rounded-2xl border ga-border-strong p-4 sm:p-5 space-y-3 min-w-0"
        >
          <h2 className="text-base sm:text-lg font-medium ga-text break-words">
            {googlePolicy.sectionTitle}
          </h2>
          <p className="text-sm ga-text-secondary leading-relaxed whitespace-pre-line break-words">
            {googlePolicy.sectionBody}
          </p>
        </section>
      </div>
    </div>
  );
}
