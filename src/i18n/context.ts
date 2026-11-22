import { createContext, useContext } from 'react';
import type { SupportedLocale } from '../core/storage/consent';
import type { AssessmentTranslations } from './assessment';
import type { Translations } from './en';
import type { HowToTranslations } from './howto';
import type { LicenseGuideTranslations } from './licenses';
import type { TutorialTranslations } from './tutorial';

export type Locale = SupportedLocale;

export type FullTranslations = Translations & {
  licenses: LicenseGuideTranslations;
  howTo: HowToTranslations;
  tutorial: TutorialTranslations;
  assessment: AssessmentTranslations;
};

export interface LocaleOption {
  code: Locale;
  label: string;
  dir: 'ltr' | 'rtl';
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'zh-CN', label: '简体中文', dir: 'ltr' },
  { code: 'zh-TW', label: '繁體中文', dir: 'ltr' },
  { code: 'ko', label: '한국어', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'uk', label: 'Українська', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'pt', label: 'Português', dir: 'ltr' },
  { code: 'it', label: 'Italiano', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

export interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: FullTranslations;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}
