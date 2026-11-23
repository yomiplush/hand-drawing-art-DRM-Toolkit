import { Download, ExternalLink, HardDriveDownload, KeyRound, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/context';
import { STANDALONE_I18N } from '../i18n/standalone';

const GITHUB_RELEASES_URL =
  'https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/releases';

interface StandaloneEditionSectionProps {
  variant: 'home' | 'docs';
}

export function StandaloneEditionSection({ variant }: StandaloneEditionSectionProps) {
  const { locale } = useI18n();
  const s = STANDALONE_I18N[locale];
  const testId = variant === 'home' ? 'home-standalone-section' : 'docs-standalone-section';

  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-sky-400/20 bg-[#051224]/70 backdrop-blur-md p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-cyan-300/90">
            <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{s.badge}</span>
          </p>
          <h2 className="text-lg sm:text-xl font-semibold text-white">{s.title}</h2>
          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">{s.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`${variant}-standalone-download-link`}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors min-h-[42px]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{s.downloadCta}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
          </a>

          {variant === 'home' && (
            <Link
              to="/docs#standalone"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#041020]/70 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-200 hover:border-sky-400/40 hover:text-white transition-colors min-h-[42px]"
            >
              <span>{s.docsCta}</span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {s.modes.map((mode) => (
          <div
            key={mode.name}
            className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-white">{mode.name}</h3>
              <span className="rounded bg-sky-500/10 border border-sky-400/20 px-2 py-0.5 text-[10px] font-mono text-sky-200">
                {mode.badge}
              </span>
            </div>
            <p className="text-xs text-slate-300/85 leading-relaxed">{mode.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {s.platforms.map((plat) => (
          <div
            key={plat.os}
            className="rounded-lg border border-white/[0.08] bg-[#041020]/65 p-4 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-sky-100">
              <Monitor className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{plat.os}</span>
            </div>
            <div className="font-mono text-[11px] text-cyan-200/90 break-all">{plat.artifact}</div>
            <p className="text-xs text-slate-300/85 leading-relaxed">{plat.notes}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.05] px-4 py-3 flex items-start gap-2.5 text-xs text-slate-200/90 leading-relaxed">
        <KeyRound className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <div className="font-medium text-amber-100">{s.originNoteTitle}</div>
          <p className="text-slate-300/90">{s.originNoteBody}</p>
          <p className="font-mono text-[11px] text-slate-400">{s.checksumLabel}</p>
        </div>
      </div>
    </section>
  );
}
