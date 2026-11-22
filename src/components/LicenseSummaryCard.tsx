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
      className="rounded-lg border border-white/[0.1] bg-[#030b18]/70 p-3.5 space-y-2.5 text-xs sm:text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-sky-200 flex items-center gap-1.5">
          <Info className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
          <span>{copy.name}</span>
        </div>
        {!compact && (
          <span className="font-mono text-[11px] text-slate-400">{licenseId}</span>
        )}
      </div>

      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{copy.summary}</p>

      <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 border ${
            allowCommercial
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          {allowCommercial ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          <span>{allowCommercial ? b.commercialYes : b.commercialNo}</span>
        </span>

        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 border ${
            def.allowsDerivatives
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-white/[0.14] bg-white/[0.05] text-slate-300'
          }`}
        >
          {def.allowsDerivatives ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          <span>{def.allowsDerivatives ? b.derivativesYes : b.derivativesNo}</span>
        </span>

        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 border border-white/[0.14] bg-white/[0.05] text-slate-200">
          <span>{def.requiresAttribution ? b.attributionYes : b.attributionNo}</span>
        </span>

        {def.requiresShareAlike && (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 border border-sky-300/30 bg-sky-400/10 text-sky-200">
            <span>{b.shareAlikeYes}</span>
          </span>
        )}
      </div>
    </div>
  );
}
