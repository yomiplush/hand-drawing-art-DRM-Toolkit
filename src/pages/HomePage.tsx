import { Link } from 'react-router-dom';
import { BookOpen, Compass, FileSignature, ShieldCheck } from 'lucide-react';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { useI18n } from '../i18n/context';

export function HomePage() {
  const { t } = useI18n();
  const homeUi = t.minimal.home;

  return (
    <div
      data-testid="home-minimal-page"
      className="relative flex flex-col justify-center min-h-[calc(100vh-14rem)] py-6 sm:py-12"
    >
      <div className="flex justify-end mb-6 sm:mb-8">
        <HelpIconButton
          label={homeUi.helpLabel}
          title={homeUi.helpTitle}
          closeLabel={homeUi.closeHelp}
          testId="home-help-btn"
          panelTestId="home-help-panel"
        >
          <div className="space-y-3">
            {homeUi.helpItems.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-3 space-y-1"
              >
                <h3 className="text-xs sm:text-sm font-semibold text-sky-200">{item.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{item.body}</p>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                to="/docs"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 hover:text-white min-h-[40px]"
              >
                <BookOpen className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span>{homeUi.helpDocsLink}</span>
              </Link>
              <Link
                to="/tutorial"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40 hover:text-white min-h-[40px]"
              >
                <Compass className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span>{homeUi.helpTutorialLink}</span>
              </Link>
            </div>
          </div>
        </HelpIconButton>
      </div>

      <section className="mx-auto w-full max-w-xl text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white">
            {t.appName}
          </h1>
          <p
            data-testid="home-tagline"
            className="text-base sm:text-xl font-medium text-cyan-200/95 tracking-wide"
          >
            {homeUi.tagline}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 pt-2">
          <Link
            to="/create"
            data-testid="home-cta-create"
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-100 px-7 py-4 text-base font-semibold text-slate-950 hover:bg-white transition-colors min-h-[52px] shadow-lg shadow-sky-950/30"
          >
            <FileSignature className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{homeUi.createCta}</span>
          </Link>

          <Link
            to="/verify"
            data-testid="home-cta-verify"
            className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.18] bg-[#061426]/75 backdrop-blur-md px-7 py-4 text-base font-semibold text-slate-100 hover:border-sky-400/50 hover:bg-[#081b34]/85 transition-colors min-h-[52px]"
          >
            <ShieldCheck className="h-5 w-5 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{homeUi.verifyCta}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
