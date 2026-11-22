import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Compass,
  FileSignature,
  HelpCircle,
  KeyRound,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../i18n/context';

export function HomePage() {
  const { t } = useI18n();
  const icons = [Sparkles, Lock, QrCode, ShieldCheck];

  return (
    <div className="space-y-12">
      <section className="py-4 sm:py-8 border-b border-white/[0.08]">
        <div className="max-w-3xl space-y-5">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-sky-300/80">
            {t.home.badge}
          </p>

          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            {t.home.heroTitle}
          </h1>

          <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-2xl">
            {t.home.heroSubtitle}
          </p>

          <blockquote
            data-testid="home-manifesto"
            className="border-s-2 border-cyan-400/70 bg-cyan-500/[0.06] rounded-e-lg ps-4 pe-3 py-2.5 text-sm sm:text-base font-medium italic text-cyan-100/95 tracking-wide max-w-2xl"
          >
            “{t.home.manifesto}”
          </blockquote>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white transition-colors min-h-[44px]"
            >
              <FileSignature className="h-4 w-4" aria-hidden="true" />
              <span>{t.home.ctaCreate}</span>
            </Link>

            <Link
              to="/verify"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.16] bg-[#061426]/65 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.1] transition-colors min-h-[44px]"
            >
              <ShieldCheck className="h-4 w-4 text-sky-300" aria-hidden="true" />
              <span>{t.home.ctaVerify}</span>
            </Link>

            <Link
              to="/keys"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#041020]/55 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-white/[0.22] hover:text-white transition-colors min-h-[44px]"
            >
              <KeyRound className="h-4 w-4 text-slate-300" aria-hidden="true" />
              <span>{t.home.ctaKeys}</span>
            </Link>

            <Link
              to="/tutorial"
              data-testid="home-hero-tutorial-link"
              className="inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/10 backdrop-blur-md px-4 py-2.5 text-sm font-medium text-sky-100 hover:bg-sky-500/20 transition-colors min-h-[44px]"
            >
              <Compass className="h-4 w-4 text-sky-300" aria-hidden="true" />
              <span>{t.tutorial.navLabel}</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4" data-testid="home-howto-section">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-sky-300/90">
              {t.howTo.homeTitle}
            </h2>
            <p className="text-sm text-slate-300/85">{t.howTo.homeSubtitle}</p>
          </div>

          <Link
            to="/tutorial"
            data-testid="home-tutorial-link"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#051224]/70 px-3.5 py-2 text-xs sm:text-sm font-medium text-sky-200 hover:border-sky-400/40 hover:text-white transition-colors min-h-[38px]"
          >
            <Compass className="h-4 w-4 text-sky-300" aria-hidden="true" />
            <span>{t.tutorial.homeCta}</span>
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {t.howTo.steps.map((step, idx) => (
            <div
              key={step.title}
              className="rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md p-5 space-y-2"
            >
              <div className="font-mono text-xs text-sky-300/80">STEP 0{idx + 1}</div>
              <h3 className="text-base font-medium text-white">{step.title}</h3>
              <p className="text-sm text-slate-300/85 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-slate-300">
          {t.home.principlesTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-lg overflow-hidden border border-white/[0.09] bg-white/[0.08]">
          {t.home.principles.map((item, idx) => {
            const Icon = icons[idx % icons.length];
            return (
              <div
                key={item.title}
                className="bg-[#051224]/70 backdrop-blur-md p-6 space-y-2.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-mono text-[11px] tracking-widest">0{idx + 1}</span>
                  <Icon className="h-4 w-4 text-sky-300/80" aria-hidden="true" />
                </div>
                <h3 className="text-base font-medium text-slate-100">{item.title}</h3>
                <p className="text-sm text-slate-300/80 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4" data-testid="home-faq-section">
        <div className="space-y-1">
          <h2 className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-[0.14em] text-sky-300/90">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span>{t.seo.homeFaqTitle}</span>
          </h2>
          <p className="text-sm text-slate-300/85">{t.seo.homeFaqSubtitle}</p>
        </div>

        <div className="space-y-2.5">
          {t.seo.homeFaqs.map((faq, idx) => (
            <details
              key={faq.q}
              open={idx === 0}
              className="group rounded-xl border border-white/[0.09] bg-[#051224]/65 backdrop-blur-md open:border-sky-400/25 transition-colors"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm sm:text-base font-medium text-slate-100 hover:text-white">
                <span>{faq.q}</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="border-t border-white/[0.06] px-5 py-3.5 text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section
        aria-label={t.home.disclaimerTitle}
        className="rounded-lg border border-white/[0.09] border-s-2 border-s-amber-400/70 bg-[#061325]/70 backdrop-blur-md p-5 flex items-start gap-3.5"
      >
        <AlertCircle className="h-5 w-5 text-amber-300/90 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-medium text-amber-100">
            {t.home.disclaimerTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
            {t.home.disclaimerBody}
          </p>
        </div>
      </section>
    </div>
  );
}
