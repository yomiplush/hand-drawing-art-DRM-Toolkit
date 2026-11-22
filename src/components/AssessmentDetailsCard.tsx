import { AlertTriangle, CheckCircle2, Cpu, HelpCircle } from 'lucide-react';
import type { HumanMadeAssessmentResult } from '../core/manifest/types';
import { useI18n } from '../i18n/context';

interface AssessmentDetailsCardProps {
  assessment?: HumanMadeAssessmentResult;
  testId?: string;
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`;
}

export function AssessmentDetailsCard({
  assessment,
  testId = 'assessment-details-card',
}: AssessmentDetailsCardProps) {
  const { t } = useI18n();
  const a = t.assessment;

  const summaryKey = assessment?.summaryKey ?? 'no-image';
  const metrics = assessment?.metrics ?? null;

  const isWarning = summaryKey === 'ai-metadata-detected';
  const isClean = summaryKey === 'local-signals-clean';

  const BannerIcon = isWarning ? AlertTriangle : isClean ? CheckCircle2 : HelpCircle;
  const bannerTone = isWarning
    ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
    : isClean
      ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
      : 'border-white/[0.1] bg-[#030b18]/65 text-slate-300';

  const transparencySummary = (() => {
    if (!metrics) return '-';
    if (metrics.semiTransparentRatio > 0.001) {
      return `${a.values.hasSoftAlpha} (${pct(metrics.semiTransparentRatio)})`;
    }
    if (metrics.transparentRatio > 0.001) {
      return `${a.values.hasTransparency} (${pct(metrics.transparentRatio)})`;
    }
    return a.values.fullyOpaque;
  })();

  const detailSummary = (() => {
    if (!metrics) return '-';
    const base = metrics.edgeDensity >= 0.02 || metrics.meanGradient >= 2.5
      ? a.values.detailRich
      : a.values.detailFlat;
    return `${base} (${a.values.edgeDensityLabel}: ${pct(metrics.edgeDensity)})`;
  })();

  const metadataSummary = (() => {
    if (!metrics) return '-';
    if (metrics.aiMetadataSignals.length > 0) {
      return `${a.values.aiTagsDetectedPrefix} ${metrics.aiMetadataSignals.join(', ')}`;
    }
    return metrics.isCertifiedHandmadeOutput
      ? `${a.values.noAiTags} ${a.values.reencodedNote}`
      : a.values.noAiTags;
  })();

  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4"
    >
      <div className="flex items-center gap-2 text-white">
        <Cpu className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
        <h3 className="text-sm sm:text-base font-semibold">{a.cardTitle}</h3>
      </div>

      <div className={`rounded-lg border p-3 flex items-start gap-2.5 text-xs sm:text-sm ${bannerTone}`}>
        <BannerIcon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{a.outcomes[summaryKey]}</span>
      </div>

      {metrics && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3 sm:col-span-2">
            <dt className="text-xs text-slate-400">{a.labels.metadataScan}</dt>
            <dd className="mt-0.5 text-slate-100 break-words">{metadataSummary}</dd>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
            <dt className="text-xs text-slate-400">{a.labels.artworkArea}</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-100">
              {metrics.artworkWidth} × {metrics.artworkHeight} px ({metrics.containerFormat.toUpperCase()})
            </dd>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
            <dt className="text-xs text-slate-400">{a.labels.toolHints}</dt>
            <dd className="mt-0.5 text-slate-100">
              {metrics.creativeToolHints.length > 0
                ? metrics.creativeToolHints.join(', ')
                : a.values.noneDetected}
            </dd>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
            <dt className="text-xs text-slate-400">{a.labels.transparency}</dt>
            <dd className="mt-0.5 text-slate-100">{transparencySummary}</dd>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3">
            <dt className="text-xs text-slate-400">{a.labels.visualDetail}</dt>
            <dd className="mt-0.5 text-slate-100">{detailSummary}</dd>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3 sm:col-span-2">
            <dt className="text-xs text-slate-400">{a.labels.colorVariety}</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-100">
              {metrics.sampledColorBuckets.toLocaleString()} {a.values.bucketsLabel}
            </dd>
          </div>
        </dl>
      )}

      <p className="text-xs text-slate-400 leading-relaxed">{a.cardDisclaimer}</p>
    </section>
  );
}
