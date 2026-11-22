import React, { useEffect, useState } from 'react';
import { persistOptionalLocale, readOptionalLocale } from '../core/storage/consent';
import { ASSESSMENT_I18N } from './assessment';
import { I18nContext, LOCALE_OPTIONS } from './context';
import type { FullTranslations, Locale } from './context';
import { en } from './en';
import type { Translations } from './en';
import { HOWTO_I18N } from './howto';
import { ja } from './ja';
import { LICENSE_I18N } from './licenses';
import { ko, zhCN, zhTW } from './locales/eastAsia';
import { ar, de, es, fr, it, pt } from './locales/europeanAndArabic';
import { ru, uk } from './locales/slavic';
import { QR_STUDIO_I18N } from './qrStudio';
import { TUTORIAL_I18N } from './tutorial';

const LOCALE_MAP: Record<Locale, Translations> = {
  en,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ko,
  ru,
  uk,
  es,
  fr,
  de,
  pt,
  it,
  ar,
};

function detectInitialLocale(): Locale {
  const saved = readOptionalLocale();
  if (saved) return saved;
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('ja')) return 'ja';
    if (lang.includes('hant') || lang === 'zh-tw' || lang === 'zh-hk' || lang === 'zh-mo') {
      return 'zh-TW';
    }
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('ru')) return 'ru';
    if (lang.startsWith('uk')) return 'uk';
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('pt')) return 'pt';
    if (lang.startsWith('it')) return 'it';
    if (lang.startsWith('ar')) return 'ar';
  }
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    persistOptionalLocale(next);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    const option = LOCALE_OPTIONS.find((o) => o.code === locale);
    document.documentElement.dir = option?.dir ?? 'ltr';
  }, [locale]);

  const toggleLocale = () => setLocale(locale === 'en' ? 'ja' : 'en');
  const base = LOCALE_MAP[locale] ?? en;
  const t: FullTranslations = {
    ...base,
    licenses: LICENSE_I18N[locale] ?? LICENSE_I18N.en,
    howTo: HOWTO_I18N[locale] ?? HOWTO_I18N.en,
    tutorial: TUTORIAL_I18N[locale] ?? TUTORIAL_I18N.en,
    assessment: ASSESSMENT_I18N[locale] ?? ASSESSMENT_I18N.en,
    qrStudio: QR_STUDIO_I18N[locale] ?? QR_STUDIO_I18N.en,
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
