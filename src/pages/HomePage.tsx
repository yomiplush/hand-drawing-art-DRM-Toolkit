import { Link } from 'react-router-dom';
import {
  AlertCircle,
  FileSignature,
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
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-[#0b1f3a] via-[#08172c] to-[#06111e] p-6 sm:p-10 shadow-xl shadow-cyan-950/30">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-medium text-cyan-200">
            <span>{t.home.badge}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            {t.home.heroTitle}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {t.home.heroSubtitle}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors min-h-[44px]"
            >
              <FileSignature className="h-4 w-4" aria-hidden="true" />
              <span>{t.home.ctaCreate}</span>
            </Link>

            <Link
              to="/verify"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20 transition-colors min-h-[44px]"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{t.home.ctaVerify}</span>
            </Link>

            <Link
              to="/keys"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors min-h-[44px]"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>{t.home.ctaKeys}</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold text-white">{t.home.principlesTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {t.home.principles.map((item, idx) => {
            const Icon = icons[idx % icons.length];
            return (
              <div
                key={item.title}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-2 hover:border-cyan-500/30 transition-colors"
              >
                <div className="inline-flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-label={t.home.disclaimerTitle}
        className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-5 flex items-start gap-3.5"
      >
        <AlertCircle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-semibold text-amber-200">
            {t.home.disclaimerTitle}
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
            {t.home.disclaimerBody}
          </p>
        </div>
      </section>
    </div>
  );
}
