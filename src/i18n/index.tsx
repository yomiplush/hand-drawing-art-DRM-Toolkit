import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { persistOptionalLocale } from '../core/storage/consent';
import { detectInitialLang } from '../state/uiPreferences';
import { A11Y_I18N } from './a11y';
import { ARTWORK_DETAILS_I18N_EN, ARTWORK_DETAILS_I18N_JA } from './artworkDetails';
import { I18nContext, LOCALE_OPTIONS } from './context';
import type { FullTranslations, Locale } from './context';
import { DEVICE_PAIRING_I18N } from './devicePairing';
import { DISCORD_UX_I18N } from './discord';
import { en } from './en';
import type { Translations } from './en';
import { GALLERY_DECK_I18N } from './galleryDeck';
import { GOOGLE_COMPLIANCE_I18N_EN, GOOGLE_COMPLIANCE_I18N_JA } from './googleCompliance';
import { HARDENING_I18N_EN, HARDENING_I18N_JA } from './hardening';
import { HOWTO_I18N_EN, HOWTO_I18N_JA } from './howto';
import { HUMAN_UX_I18N } from './humanUx';
import { INTERACTIVE_TUTORIAL_I18N_EN, INTERACTIVE_TUTORIAL_I18N_JA } from './interactiveTutorial';
import { ja } from './ja';
import { LICENSE_I18N_EN, LICENSE_I18N_JA } from './licenses';
import { MINIMAL_UI_I18N_EN, MINIMAL_UI_I18N_JA } from './minimalUi';
import { NEXT_GEN_I18N_EN, NEXT_GEN_I18N_JA } from './nextGen';
import { QR_STUDIO_I18N_EN, QR_STUDIO_I18N_JA } from './qrStudio';
import { SEO_I18N_EN, SEO_I18N_JA } from './seo';
import { SIMPLE_I18N } from './simple';
import { TUTORIAL_I18N_EN, TUTORIAL_I18N_JA } from './tutorial';
import { UX_GUIDANCE_I18N_EN, UX_GUIDANCE_I18N_JA } from './uxGuidance';
import { VAULT_I18N } from './vault';
import { VERIFY_MOBILE_I18N_EN, VERIFY_MOBILE_I18N_JA } from './verifyMobile';

type OthersBundle = typeof import('./locales-data/others-bundle')['LOCALE_OTHERS'];

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
  // Non-English/Japanese copy is fetched as one lazily-loaded chunk.
  const [others, setOthers] = useState<OthersBundle | null>(null);

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

  useEffect(() => {
    if (locale === 'en' || locale === 'ja' || others) return;
    let cancelled = false;
    void import('./locales-data/others-bundle').then((mod) => {
      if (!cancelled) setOthers(mod.LOCALE_OTHERS);
    });
    return () => {
      cancelled = true;
    };
  }, [locale, others]);

  const base = loadedLocales[locale] ?? en;

  const t: FullTranslations = useMemo(() => {
    // English and Japanese ship eagerly; every other locale comes from the
    // lazily fetched bundle, falling back to English until it arrives.
    const pick = <T,>(enValue: T, jaValue: T, key: keyof OthersBundle): T => {
      if (locale === 'en') return enValue;
      if (locale === 'ja') return jaValue;
      const fromBundle = others?.[key] as Record<string, T> | undefined;
      return fromBundle?.[locale] ?? enValue;
    };

    return {
      ...base,
      a11y: A11Y_I18N[locale] ?? A11Y_I18N.en,
      licenses: pick(LICENSE_I18N_EN, LICENSE_I18N_JA, 'licenses'),
      howTo: pick(HOWTO_I18N_EN, HOWTO_I18N_JA, 'howTo'),
      tutorial: pick(TUTORIAL_I18N_EN, TUTORIAL_I18N_JA, 'tutorial'),
      interactiveTutorial: pick(
        INTERACTIVE_TUTORIAL_I18N_EN,
        INTERACTIVE_TUTORIAL_I18N_JA,
        'interactiveTutorial',
      ),
      qrStudio: pick(QR_STUDIO_I18N_EN, QR_STUDIO_I18N_JA, 'qrStudio'),
      verifyMobile: pick(VERIFY_MOBILE_I18N_EN, VERIFY_MOBILE_I18N_JA, 'verifyMobile'),
      seo: pick(SEO_I18N_EN, SEO_I18N_JA, 'seo'),
      minimal: pick(MINIMAL_UI_I18N_EN, MINIMAL_UI_I18N_JA, 'minimal'),
      hardening: pick(HARDENING_I18N_EN, HARDENING_I18N_JA, 'hardening'),
      devices: DEVICE_PAIRING_I18N[locale] ?? DEVICE_PAIRING_I18N.en,
      artworkDetails: pick(ARTWORK_DETAILS_I18N_EN, ARTWORK_DETAILS_I18N_JA, 'artworkDetails'),
      vault: VAULT_I18N[locale] ?? VAULT_I18N.en,
      nextGen: pick(NEXT_GEN_I18N_EN, NEXT_GEN_I18N_JA, 'nextGen'),
      googleCompliance: pick(
        GOOGLE_COMPLIANCE_I18N_EN,
        GOOGLE_COMPLIANCE_I18N_JA,
        'googleCompliance',
      ),
      humanUx: HUMAN_UX_I18N[locale] ?? HUMAN_UX_I18N.en,
      simple: SIMPLE_I18N[locale] ?? SIMPLE_I18N.en,
      discordUx: DISCORD_UX_I18N[locale] ?? DISCORD_UX_I18N.en,
      galleryDeck: GALLERY_DECK_I18N[locale] ?? GALLERY_DECK_I18N.en,
      uxGuidance: pick(UX_GUIDANCE_I18N_EN, UX_GUIDANCE_I18N_JA, 'uxGuidance'),
    };
  }, [base, locale, others]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistOptionalLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((current) => {
      const next = current === 'en' ? 'ja' : 'en';
      persistOptionalLocale(next);
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}
