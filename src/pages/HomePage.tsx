import { Link } from 'react-router-dom';
import { BookOpen, Cloud, Compass, FileSignature, Shield, ShieldCheck } from 'lucide-react';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { useI18n } from '../i18n/context';

export function HomePage() {
  const { t } = useI18n();
  const homeUi = t.minimal.home;
  const overview = t.googleCompliance.homeOverview;

  return (
    <div
      data-testid="home-minimal-page"
      className="relative flex flex-col justify-center min-h-[calc(100vh-14rem)] py-6 sm:py-10 space-y-12"
    >
      <div className="flex justify-end">
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

      <section
        data-testid="home-overview-section"
        className="mx-auto w-full max-w-3xl space-y-4 pt-2"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.1] bg-[#051224]/65 backdrop-blur-md p-5 space-y-2">
            <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{overview.appPurposeTitle}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {overview.appPurposeBody}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.1] bg-[#051224]/65 backdrop-blur-md p-5 space-y-2">
            <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{overview.drivePurposeTitle}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {overview.drivePurposeBody}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
          <Link
            to="/privacypolicy"
            data-testid="home-privacy-link"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#041021]/75 px-3.5 py-2 text-sky-200 hover:border-sky-400/45 hover:text-white transition-colors min-h-[40px]"
          >
            <Shield className="h-3.5 w-3.5 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{overview.privacyLinkLabel}</span>
          </Link>

          <Link
            to="/storage"
            data-testid="home-storage-link"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#041021]/75 px-3.5 py-2 text-slate-200 hover:border-sky-400/45 hover:text-white transition-colors min-h-[40px]"
          >
            <Cloud className="h-3.5 w-3.5 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{overview.storageLinkLabel}</span>
          </Link>

          <Link
            to="/docs"
            data-testid="home-docs-link"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#041021]/75 px-3.5 py-2 text-slate-200 hover:border-sky-400/45 hover:text-white transition-colors min-h-[40px]"
          >
            <BookOpen className="h-3.5 w-3.5 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{overview.docsLinkLabel}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
