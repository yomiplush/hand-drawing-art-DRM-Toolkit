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
import { GALLERY_DECK_I18N } from './galleryDeck';
import { GOOGLE_COMPLIANCE_I18N } from './googleCompliance';
import { HARDENING_I18N } from './hardening';
import { HOWTO_I18N } from './howto';
import { HUMAN_UX_I18N } from './humanUx';
import { INTERACTIVE_TUTORIAL_I18N } from './interactiveTutorial';
import { ja } from './ja';
import { LICENSE_I18N } from './licenses';
import { MINIMAL_UI_I18N } from './minimalUi';
import { NEXT_GEN_I18N } from './nextGen';
import { QR_STUDIO_I18N } from './qrStudio';
import { SEO_I18N } from './seo';
import { SIMPLE_I18N } from './simple';
import { TUTORIAL_I18N } from './tutorial';
import { UX_GUIDANCE_I18N } from './uxGuidance';
import { VAULT_I18N } from './vault';
import { VERIFY_MOBILE_I18N } from './verifyMobile';

const STATIC_LOCALE_MAP: Partial<Record<Locale, Translations>> = {
  en,
  ja,
};

async function loadExtraLocale(locale: Locale): Promise<Translations | null> {
  if (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ko') {
    const mod = await import('./locales/eastAsia');
    if (locale === 'zh-CN') return mod.zhCN;
    if (locale === 'zh-TW') return mod.zhTW;
    return mod.ko;
  }
  if (locale === 'ru' || locale === 'uk') {
    const mod = await import('./locales/slavic');
    return locale === 'ru' ? mod.ru : mod.uk;
  }
  if (
    locale === 'es' ||
    locale === 'fr' ||
    locale === 'de' ||
    locale === 'pt' ||
    locale === 'it' ||
    locale === 'ar'
  ) {
    const mod = await import('./locales/europeanAndArabic');
    return mod[locale];
  }
  return null;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLang);
  const [loadedLocales, setLoadedLocales] = useState<Partial<Record<Locale, Translations>>>(
    STATIC_LOCALE_MAP,
  );

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    persistOptionalLocale(next);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    const option = LOCALE_OPTIONS.find((o) => o.code === locale);
    document.documentElement.dir = option?.dir ?? 'ltr';

    if (loadedLocales[locale]) return;
    let cancelled = false;
    void loadExtraLocale(locale).then((dict) => {
      if (cancelled || !dict) return;
      setLoadedLocales((prev) => ({ ...prev, [locale]: dict }));
    });
    return () => {
      cancelled = true;
    };
  }, [locale, loadedLocales]);

  const toggleLocale = () => setLocale(locale === 'en' ? 'ja' : 'en');
  const base = loadedLocales[locale] ?? en;
  const t: FullTranslations = {
    ...base,
    licenses: LICENSE_I18N[locale] ?? LICENSE_I18N.en,
    howTo: HOWTO_I18N[locale] ?? HOWTO_I18N.en,
    tutorial: TUTORIAL_I18N[locale] ?? TUTORIAL_I18N.en,
    interactiveTutorial: INTERACTIVE_TUTORIAL_I18N[locale] ?? INTERACTIVE_TUTORIAL_I18N.en,
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
    galleryDeck: GALLERY_DECK_I18N[locale] ?? GALLERY_DECK_I18N.en,
    uxGuidance: UX_GUIDANCE_I18N[locale] ?? UX_GUIDANCE_I18N.en,
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
