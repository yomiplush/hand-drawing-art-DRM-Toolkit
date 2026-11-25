import { Check, Info, Minus } from 'lucide-react';
import { getLicenseById } from '../core/manifest/types';
import type { LicenseId } from '../core/manifest/types';
import { useI18n } from '../i18n/context';

interface LicenseSummaryCardProps {
  licenseId: LicenseId;
  compact?: boolean;
  testId?: string;
}

export function LicenseSummaryCard({
  licenseId,
  compact = false,
  testId,
}: LicenseSummaryCardProps) {
  const { t } = useI18n();
  const def = getLicenseById(licenseId);
  const copy = t.licenses.items[licenseId];
  const b = t.licenses.badges;

  const allowCommercial = def.allowsCommercialDefault === 'allow';

  return (
    <div
      data-testid={testId}
      className="rounded-xl ga-surface-subtle p-3.5 space-y-2.5 text-xs sm:text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold ga-text flex items-center gap-1.5">
          <Info className="h-4 w-4 shrink-0 text-[var(--ga-accent)]" aria-hidden="true" />
          <span>{copy.name}</span>
        </div>
        {!compact && (
          <span className="font-mono text-[11px] ga-text-muted">{licenseId}</span>
        )}
      </div>

      <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{copy.summary}</p>

      <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 border ${
            allowCommercial ? 'ga-status-success' : 'ga-status-warning'
          }`}
        >
          {allowCommercial ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          <span>{allowCommercial ? b.commercialYes : b.commercialNo}</span>
        </span>

        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 border ${
            def.allowsDerivatives ? 'ga-status-success' : 'ga-surface-subtle ga-text-secondary'
          }`}
        >
          {def.allowsDerivatives ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          <span>{def.allowsDerivatives ? b.derivativesYes : b.derivativesNo}</span>
        </span>

        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 ga-surface-subtle ga-text-secondary">
          <span>{def.requiresAttribution ? b.attributionYes : b.attributionNo}</span>
        </span>

        {def.requiresShareAlike && (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 border ga-status-info">
            <span>{b.shareAlikeYes}</span>
          </span>
        )}
      </div>
    </div>
  );
}
