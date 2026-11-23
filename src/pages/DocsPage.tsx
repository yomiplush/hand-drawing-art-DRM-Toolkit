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

  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-white/[0.08] pb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">{t.docs.title}</h1>
        <p className="text-sm sm:text-base text-slate-300">{t.docs.subtitle}</p>
      </header>

      <section className="rounded-xl border border-white/[0.1] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-medium text-white flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{t.howTo.docsUsageTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">{t.howTo.homeSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {t.howTo.steps.map((step) => (
            <div
              key={step.title}
              className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-1.5"
            >
              <h3 className="text-sm font-medium text-sky-200">{step.title}</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div id="standalone">
        <StandaloneEditionSection variant="docs" />
      </div>

      <section
        data-testid="docs-licenses-section"
        className="rounded-xl border border-white/[0.1] bg-[#051224]/65 backdrop-blur-md p-5 space-y-4"
      >
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-medium text-white flex items-center gap-2">
            <Scale className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{t.licenses.guideTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {t.licenses.guideSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LICENSE_DEFINITIONS.map((lic) => (
            <LicenseSummaryCard key={lic.id} licenseId={lic.id} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-1.5">
            <h3 className="text-sm font-medium text-slate-100">{t.licenses.signalGuideTitle}</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.licenses.signalGuideBody}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-1.5">
            <h3 className="text-sm font-medium text-slate-100">{t.licenses.appLicenseTitle}</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.licenses.appLicenseBody}
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {t.docs.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-2"
          >
            <h2 className="text-base sm:text-lg font-medium text-slate-100 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{section.title}</span>
            </h2>
            <p className="text-sm text-slate-300/90 leading-relaxed">{section.body}</p>
          </section>
        ))}

        <section
          data-testid="docs-evidence-section"
          className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-3"
        >
          <h2 className="text-base sm:text-lg font-medium text-slate-100 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{t.artworkDetails.docsTitle}</span>
          </h2>
          <p className="text-sm text-slate-300/90 leading-relaxed">{t.artworkDetails.docsLead}</p>
          <div className="space-y-1.5 text-xs sm:text-sm text-slate-300">
            <div className="font-medium text-sky-200">{t.artworkDetails.docsModesTitle}</div>
            <ul className="space-y-1 list-disc list-inside text-slate-300/90">
              <li>{t.artworkDetails.docsModeA}</li>
              <li>{t.artworkDetails.docsModeB}</li>
              <li>{t.artworkDetails.docsModeC}</li>
            </ul>
          </div>
        </section>

        <section
          data-testid="docs-notices-section"
          className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-2"
        >
          <h2 className="text-base sm:text-lg font-medium text-slate-100 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{t.hardening.docsAddendum.noticesTitle}</span>
          </h2>
          <p className="text-sm text-slate-300/90 leading-relaxed">
            {t.hardening.docsAddendum.noticesBody}
          </p>
        </section>

        <section
          id="device-pairing"
          data-testid="docs-device-pairing-section"
          className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-medium text-slate-100 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-cyan-300 shrink-0" aria-hidden="true" />
              <span>{t.devices.docsPairingTitle}</span>
            </h2>
            <Link
              to="/devices"
              className="text-xs font-medium text-cyan-300 hover:text-cyan-200 underline underline-offset-4 shrink-0"
            >
              {t.devices.navItem} →
            </Link>
          </div>
          <p className="text-sm text-slate-300/90 leading-relaxed">
            {t.devices.docsPairingBody}
          </p>
        </section>

        <section
          data-testid="docs-cli-section"
          className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-3"
        >
          <h2 className="text-base sm:text-lg font-medium text-slate-100 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
            <span>{t.hardening.docsAddendum.cliTitle}</span>
          </h2>
          <p className="text-sm text-slate-300/90 leading-relaxed">
            {t.hardening.docsAddendum.cliBody}
          </p>
          <pre className="rounded-lg border border-white/[0.08] bg-[#030b18] p-3 text-xs font-mono text-sky-200 overflow-x-auto">
            {`node tools/chm-verify.mjs signed-artwork.png --evidence artwork.chmevidence --evidence-file sketch.png\ngo run ./tools/chm-verify --evidence artwork.chmevidence --evidence-file sketch.png signed-artwork.png`}
          </pre>
        </section>
      </div>

      <section className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-3">
        <h2 className="text-base sm:text-lg font-medium text-white flex items-center gap-2">
          <Package className="h-4 w-4 text-sky-300" aria-hidden="true" />
          <span>{t.docs.ossTitle}</span>
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-300">
          {t.docs.ossList.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-white/[0.08] bg-[#030b18]/65 px-3 py-2"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
