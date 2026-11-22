import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  FileSignature,
  HelpCircle,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../i18n/context';

export function TutorialPage() {
  const { t } = useI18n();
  const tr = t.tutorial;

  return (
    <div className="space-y-10 max-w-4xl mx-auto" data-testid="tutorial-page">
      <header className="space-y-4 border-b border-white/[0.08] pb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{tr.navLabel}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          {tr.title}
        </h1>

        <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-2xl">
          {tr.subtitle}
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {tr.reassuranceItems.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-lg border border-white/[0.08] bg-[#051224]/60 backdrop-blur-md px-3.5 py-3 text-xs sm:text-sm text-slate-200"
            >
              <CheckCircle2
                className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-sky-300/90">
          {tr.stepsTitle}
        </h2>

        <div className="space-y-3">
          {tr.steps.map((step, idx) => (
            <div
              key={step.title}
              data-testid={`tutorial-step-${idx}`}
              className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="font-mono text-xs text-sky-300/80">STEP 0{idx + 1}</div>
                <h3 className="text-base font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-slate-300/90 leading-relaxed">{step.desc}</p>
              </div>

              <Link
                to={step.to}
                data-testid={`tutorial-step-cta-${idx}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.16] bg-white/[0.08] hover:bg-white/[0.15] px-4 py-2.5 text-sm font-medium text-white transition-colors shrink-0 min-h-[44px]"
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
          <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-sky-300/90">
            {tr.cheatTitle}
          </h2>
          <Link
            to="/docs"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-sky-300 hover:text-sky-200 underline underline-offset-4"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{tr.cheatDocsLink}</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tr.cheatItems.map((item) => (
            <div
              key={item.recommended}
              className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-4 space-y-2"
            >
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {item.scenario}
              </p>
              <div className="inline-flex items-center rounded-md border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-sky-200">
                {item.recommended}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.09] border-s-2 border-s-sky-400/75 bg-[#061325]/70 backdrop-blur-md p-5 flex items-start gap-3.5">
        <Info className="h-5 w-5 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-medium text-sky-100">{tr.snsTipTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">{tr.snsTipBody}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-200">
          <HelpCircle className="h-4 w-4 text-sky-300" aria-hidden="true" />
          <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-slate-200">
            {tr.faqTitle}
          </h2>
        </div>

        <div className="space-y-3">
          {tr.faqs.map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-4 space-y-1.5"
            >
              <h3 className="text-sm sm:text-base font-medium text-white">{faq.q}</h3>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.12] bg-[#061529]/75 backdrop-blur-md p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-base sm:text-lg font-semibold text-white">{tr.bottomTitle}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/create"
            data-testid="tutorial-bottom-create"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white transition-colors min-h-[44px]"
          >
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            <span>{tr.bottomStartBtn}</span>
          </Link>
          <Link
            to="/verify"
            data-testid="tutorial-bottom-verify"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.16] bg-[#041020]/65 px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.1] transition-colors min-h-[44px]"
          >
            <ShieldCheck className="h-4 w-4 text-sky-300" aria-hidden="true" />
            <span>{tr.bottomVerifyBtn}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
