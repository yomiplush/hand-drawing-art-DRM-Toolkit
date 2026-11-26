import React, { useEffect, useState } from 'react';
import { persistOptionalLocale } from '../core/storage/consent';
import { detectInitialLang } from '../state/uiPreferences';
import { ARTWORK_DETAILS_I18N } from './artworkDetails';
import { I18nContext, LOCALE_OPTIONS } from './context';
import type { FullTranslations, Locale } from './context';
import { DEVICE_PAIRING_I18N } from './devicePairing';
import { DISCORD_UX_I18N } from './discord';
import { en } from './en';
import type { Translations } from './en';
import { GOOGLE_COMPLIANCE_I18N } from './googleCompliance';
import { HARDENING_I18N } from './hardening';
import { HOWTO_I18N } from './howto';
import { HUMAN_UX_I18N } from './humanUx';
import { ja } from './ja';
import { LICENSE_I18N } from './licenses';
import { ko, zhCN, zhTW } from './locales/eastAsia';
import { ar, de, es, fr, it, pt } from './locales/europeanAndArabic';
import { ru, uk } from './locales/slavic';
import { MINIMAL_UI_I18N } from './minimalUi';
import { NEXT_GEN_I18N } from './nextGen';
import { QR_STUDIO_I18N } from './qrStudio';
import { SEO_I18N } from './seo';
import { SIMPLE_I18N } from './simple';
import { TUTORIAL_I18N } from './tutorial';
import { VAULT_I18N } from './vault';
import { VERIFY_MOBILE_I18N } from './verifyMobile';

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

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLang);

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
    qrStudio: QR_STUDIO_I18N[locale] ?? QR_STUDIO_I18N.en,
    verifyMobile: VERIFY_MOBILE_I18N[locale] ?? VERIFY_MOBILE_I18N.en,
    seo: SEO_I18N[locale] ?? SEO_I18N.en,
    minimal: MINIMAL_UI_I18N[locale] ?? MINIMAL_UI_I18N.en,
    hardening: HARDENING_I18N[locale] ?? HARDENING_I18N.en,
    devices: DEVICE_PAIRING_I18N[locale] ?? DEVICE_PAIRING_I18N.en,
    artworkDetails: ARTWORK_DETAILS_I18N[locale] ?? ARTWORK_DETAILS_I18N.en,
    vault: VAULT_I18N[locale] ?? VAULT_I18N.en,
    nextGen: NEXT_GEN_I18N[locale] ?? NEXT_GEN_I18N.en,
    googleCompliance: GOOGLE_COMPLIANCE_I18N[locale] ?? GOOGLE_COMPLIANCE_I18N.en,
    humanUx: HUMAN_UX_I18N[locale] ?? HUMAN_UX_I18N.en,
    simple: SIMPLE_I18N[locale] ?? SIMPLE_I18N.en,
    discordUx: DISCORD_UX_I18N[locale] ?? DISCORD_UX_I18N.en,
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
