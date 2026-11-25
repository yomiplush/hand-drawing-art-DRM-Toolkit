import { Link } from 'react-router-dom';
import { BookOpen, Cloud, Compass, FileSignature, Shield, ShieldCheck } from 'lucide-react';
import { useAppPreferences } from '../components/PreferencesContext';
import { HelpIconButton } from '../components/ui/HelpIconButton';
import { useI18n } from '../i18n/context';

export function HomePage() {
  const { t } = useI18n();
  const { isAdvanced } = useAppPreferences();
  const homeUi = t.minimal.home;
  const overview = t.googleCompliance.homeOverview;

  return (
    <div
      data-testid="home-minimal-page"
      className="relative flex flex-col justify-center min-h-[calc(100vh-14rem)] py-8 sm:py-14 space-y-10"
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
                className="ga-surface-subtle rounded-xl border ga-border p-3 space-y-1"
              >
                <h3 className="text-xs sm:text-sm font-semibold ga-text-accent">{item.title}</h3>
                <p className="text-xs ga-text-secondary leading-relaxed">{item.body}</p>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                to="/tutorial"
                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[44px]"
              >
                <Compass className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
                <span>{homeUi.helpTutorialLink}</span>
              </Link>
              <Link
                to="/docs"
                className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium min-h-[44px]"
              >
                <BookOpen className="h-3.5 w-3.5 ga-text-accent shrink-0" aria-hidden="true" />
                <span>{homeUi.helpDocsLink}</span>
              </Link>
            </div>
          </div>
        </HelpIconButton>
      </div>

      <section className="mx-auto w-full max-w-xl text-center space-y-7 px-2">
        <div className="flex justify-center">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border ga-border-strong ga-surface-subtle shadow-sm"
            aria-hidden="true"
          >
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight ga-text">
            {t.appName}
          </h1>
          <p
            data-testid="home-tagline"
            className="text-lg sm:text-2xl font-medium ga-text-accent tracking-wide"
          >
            {homeUi.tagline}
          </p>
          <p
            data-testid="home-subtitle"
            className="text-sm sm:text-base ga-text-secondary"
          >
            {homeUi.subtitle}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 pt-2">
          <Link
            to="/create"
            data-testid="home-cta-create"
            className="ga-btn-primary inline-flex items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-base font-semibold min-h-[52px]"
          >
            <FileSignature className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{homeUi.createCta}</span>
          </Link>

          <Link
            to="/verify"
            data-testid="home-cta-verify"
            className="ga-btn-secondary inline-flex items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-base font-semibold min-h-[52px]"
          >
            <ShieldCheck className="h-5 w-5 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{homeUi.verifyCta}</span>
          </Link>
        </div>
      </section>

      <nav
        aria-label="Secondary navigation"
        className="mx-auto flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm pt-2"
      >
        <Link
          to="/tutorial"
          data-testid="home-tutorial-link"
          className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm min-h-[44px]"
        >
          <Compass className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
          <span>{t.tutorial.navLabel}</span>
        </Link>

        <Link
          to="/storage"
          data-testid="home-storage-link"
          className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm min-h-[44px]"
        >
          <Cloud className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
          <span>{overview.storageLinkLabel}</span>
        </Link>

        <Link
          to="/privacypolicy"
          data-testid="home-privacy-link"
          className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm min-h-[44px]"
        >
          <Shield className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
          <span>{overview.privacyLinkLabel}</span>
        </Link>

        {isAdvanced && (
          <Link
            to="/docs"
            data-testid="home-docs-link"
            className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm min-h-[44px]"
          >
            <BookOpen className="h-4 w-4 ga-text-accent shrink-0" aria-hidden="true" />
            <span>{overview.docsLinkLabel}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
