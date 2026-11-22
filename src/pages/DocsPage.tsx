import { BookOpen, Package } from 'lucide-react';
import { useI18n } from '../i18n/context';

export function DocsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.docs.title}</h1>
        <p className="text-sm sm:text-base text-slate-300">{t.docs.subtitle}</p>
      </header>

      <div className="space-y-4">
        {t.docs.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-2"
          >
            <h2 className="text-base sm:text-lg font-semibold text-cyan-200 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400 shrink-0" aria-hidden="true" />
              <span>{section.title}</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
        <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <Package className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          <span>{t.docs.ossTitle}</span>
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-300">
          {t.docs.ossList.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
