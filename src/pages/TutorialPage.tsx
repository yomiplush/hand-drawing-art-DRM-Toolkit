import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  FileSignature,
  HelpCircle,
  Info,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../i18n/context';

interface TutorialPageProps {
  onOpenInteractiveTutorial?: () => void;
}

export function TutorialPage({ onOpenInteractiveTutorial }: TutorialPageProps) {
  const { t } = useI18n();
  const tr = t.tutorial;
  const recovery = t.humanUx.keyRecoveryGuide;

  return (
    <div className="space-y-10 max-w-4xl mx-auto" data-testid="tutorial-page">
      <header className="space-y-4 border-b ga-border pb-8">
        <div className="ga-status-info inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{tr.navLabel}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight ga-text">
          {tr.title}
        </h1>

        <p className="text-sm sm:text-base ga-text-secondary leading-relaxed max-w-2xl">
          {tr.subtitle}
        </p>

        {onOpenInteractiveTutorial && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onOpenInteractiveTutorial}
              data-testid="tutorial-page-launch-3d"
              className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold min-h-[44px] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{t.interactiveTutorial.launchFromPageBtn}</span>
            </button>
          </div>
        )}

        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {tr.reassuranceItems.map((item) => (
            <li
              key={item}
              className="ga-card flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs sm:text-sm ga-text"
            >
              <CheckCircle2
                className="h-4 w-4 text-[var(--ga-success-text)] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </header>

      <section className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--ga-accent)]">
          {tr.stepsTitle}
        </h2>

        <div className="space-y-3">
          {tr.steps.map((step, idx) => (
            <div
              key={step.title}
              data-testid={`tutorial-step-${idx}`}
              className="ga-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="font-mono text-xs text-[var(--ga-accent)]">STEP 0{idx + 1}</div>
                <h3 className="text-base font-semibold ga-text">{step.title}</h3>
                <p className="text-sm ga-text-secondary leading-relaxed">{step.desc}</p>
              </div>

              <Link
                to={step.to}
                data-testid={`tutorial-step-cta-${idx}`}
                className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors shrink-0 min-h-[44px]"
              >
                <span>{step.ctaLabel}</span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="tutorial-cheat-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--ga-accent)]">
            {tr.cheatTitle}
          </h2>
          <Link
            to="/docs"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[var(--ga-accent)] hover:underline underline-offset-4"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{tr.cheatDocsLink}</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tr.cheatItems.map((item) => (
            <div
              key={item.recommended}
              className="ga-card rounded-2xl p-4 space-y-2"
            >
              <p className="text-xs sm:text-sm ga-text leading-relaxed">
                {item.scenario}
              </p>
              <div className="ga-status-info inline-flex items-center rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold">
                {item.recommended}
              </div>
              <p className="text-xs ga-text-muted leading-relaxed">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="ga-card rounded-2xl p-5 sm:p-6 space-y-4"
        data-testid="tutorial-key-recovery-guide"
      >
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-semibold ga-text flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{recovery.title}</span>
          </h2>
          <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">
            {recovery.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recovery.steps.map((step) => (
            <div key={step.title} className="ga-surface-subtle rounded-xl p-4 space-y-1.5">
              <h3 className="text-sm font-semibold ga-text">{step.title}</h3>
              <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ga-status-info rounded-2xl border p-5 flex items-start gap-3.5">
        <Info className="h-5 w-5 text-[var(--ga-accent)] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-medium ga-text">{tr.snsTipTitle}</h2>
          <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{tr.snsTipBody}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[var(--ga-accent)]" aria-hidden="true" />
          <h2 className="text-xs font-mono uppercase tracking-[0.14em] ga-text">
            {tr.faqTitle}
          </h2>
        </div>

        <div className="space-y-3">
          {tr.faqs.map((faq) => (
            <div
              key={faq.q}
              className="ga-card rounded-2xl p-4 space-y-1.5"
            >
              <h3 className="text-sm sm:text-base font-medium ga-text">{faq.q}</h3>
              <p className="text-xs sm:text-sm ga-text-secondary leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ga-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-base sm:text-lg font-semibold ga-text">{tr.bottomTitle}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/create"
            data-testid="tutorial-bottom-create"
            className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            <span>{tr.bottomStartBtn}</span>
          </Link>
          <Link
            to="/verify"
            data-testid="tutorial-bottom-verify"
            className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors min-h-[44px]"
          >
            <ShieldCheck className="h-4 w-4 text-[var(--ga-accent)]" aria-hidden="true" />
            <span>{tr.bottomVerifyBtn}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
