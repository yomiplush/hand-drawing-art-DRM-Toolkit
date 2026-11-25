import { Link } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  FileCheck2,
  KeyRound,
  Package,
  Scale,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { LicenseSummaryCard } from '../components/LicenseSummaryCard';
import { StandaloneEditionSection } from '../components/StandaloneEditionSection';
import { LICENSE_DEFINITIONS } from '../core/manifest/types';
import { useI18n } from '../i18n/context';

export function DocsPage() {
  const { t } = useI18n();
  const recovery = t.humanUx.keyRecoveryGuide;

  return (
    <div className="space-y-8 min-w-0">
      <header className="space-y-2 border-b ga-border pb-5 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold ga-text break-words">{t.docs.title}</h1>
        <p className="text-sm sm:text-base ga-text-secondary break-words">{t.docs.subtitle}</p>
      </header>

      <section className="ga-card rounded-2xl p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
            <Compass className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{t.howTo.docsUsageTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm ga-text-secondary">{t.howTo.homeSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {t.howTo.steps.map((step) => (
            <div
              key={step.title}
              className="ga-surface-subtle rounded-xl p-4 space-y-1.5"
            >
              <h3 className="text-sm font-medium text-[var(--ga-accent)]">{step.title}</h3>
              <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div id="standalone">
        <StandaloneEditionSection variant="docs" />
      </div>

      <section
        data-testid="docs-licenses-section"
        className="ga-card rounded-2xl p-5 space-y-4"
      >
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
            <Scale className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{t.licenses.guideTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
            {t.licenses.guideSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LICENSE_DEFINITIONS.map((lic) => (
            <LicenseSummaryCard key={lic.id} licenseId={lic.id} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="ga-surface-subtle rounded-xl p-4 space-y-1.5">
            <h3 className="text-sm font-medium ga-text">{t.licenses.signalGuideTitle}</h3>
            <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
              {t.licenses.signalGuideBody}
            </p>
          </div>
          <div className="ga-surface-subtle rounded-xl p-4 space-y-1.5">
            <h3 className="text-sm font-medium ga-text">{t.licenses.appLicenseTitle}</h3>
            <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
              {t.licenses.appLicenseBody}
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {t.docs.sections.map((section) => (
          <section
            key={section.title}
            className="ga-card rounded-2xl p-5 space-y-2"
          >
            <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{section.title}</span>
            </h2>
            <p className="text-sm ga-text-secondary leading-relaxed">{section.body}</p>
          </section>
        ))}

        <section
          data-testid="docs-key-recovery-section"
          className="ga-card rounded-2xl p-5 space-y-4"
        >
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{recovery.title}</span>
            </h2>
            <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
              {recovery.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recovery.steps.map((step) => (
              <div key={step.title} className="ga-surface-subtle rounded-xl p-4 space-y-1.5">
                <h3 className="text-sm font-semibold ga-text">{step.title}</h3>
                <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          data-testid="docs-evidence-section"
          className="ga-card rounded-2xl p-5 space-y-3"
        >
          <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{t.artworkDetails.docsTitle}</span>
          </h2>
          <p className="text-sm ga-text-secondary leading-relaxed">{t.artworkDetails.docsLead}</p>
          <div className="space-y-1.5 text-xs sm:text-sm ga-text-secondary">
            <div className="font-medium text-[var(--ga-accent)]">{t.artworkDetails.docsModesTitle}</div>
            <ul className="space-y-1 list-disc list-inside ga-text-secondary">
              <li>{t.artworkDetails.docsModeA}</li>
              <li>{t.artworkDetails.docsModeB}</li>
              <li>{t.artworkDetails.docsModeC}</li>
            </ul>
          </div>
        </section>

        <section
          data-testid="docs-notices-section"
          className="ga-card rounded-2xl p-5 space-y-2"
        >
          <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{t.hardening.docsAddendum.noticesTitle}</span>
          </h2>
          <p className="text-sm ga-text-secondary leading-relaxed">
            {t.hardening.docsAddendum.noticesBody}
          </p>
        </section>

        <section
          id="device-pairing"
          data-testid="docs-device-pairing-section"
          className="ga-card rounded-2xl p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{t.devices.docsPairingTitle}</span>
            </h2>
            <Link
              to="/devices"
              className="text-xs font-medium text-[var(--ga-accent)] hover:underline underline-offset-4 shrink-0"
            >
              {t.devices.navItem} →
            </Link>
          </div>
          <p className="text-sm ga-text-secondary leading-relaxed">
            {t.devices.docsPairingBody}
          </p>
          <div className="pt-2 border-t ga-border space-y-1.5" data-testid="docs-sync-section">
            <h3 className="text-sm sm:text-base font-medium text-[var(--ga-accent)]">
              {t.devices.docsSyncTitle}
            </h3>
            <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
              {t.devices.docsSyncBody}
            </p>
          </div>
        </section>

        <section
          data-testid="docs-cli-section"
          className="ga-card rounded-2xl p-5 space-y-3"
        >
          <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{t.hardening.docsAddendum.cliTitle}</span>
          </h2>
          <p className="text-sm ga-text-secondary leading-relaxed">
            {t.hardening.docsAddendum.cliBody}
          </p>
          <pre className="ga-surface-subtle rounded-xl p-3 text-xs font-mono text-[var(--ga-accent)] overflow-x-auto">
            {`node tools/chm-verify.mjs signed-artwork.png --evidence artwork.chmevidence --evidence-file sketch.png\ngo run ./tools/chm-verify --evidence artwork.chmevidence --evidence-file sketch.png signed-artwork.png`}
          </pre>
        </section>
      </div>

      <section className="ga-card rounded-2xl p-5 space-y-3">
        <h2 className="text-base sm:text-lg font-medium ga-text flex items-center gap-2">
          <Package className="h-4 w-4 text-[var(--ga-accent)]" aria-hidden="true" />
          <span>{t.docs.ossTitle}</span>
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm ga-text-secondary">
          {t.docs.ossList.map((item) => (
            <li
              key={item}
              className="ga-surface-subtle rounded-xl px-3 py-2"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
