
export interface TutorialStepItem {
  title: string;
  desc: string;
  ctaLabel: string;
  to: '/create' | '/verify' | '/keys' | '/docs';
}

export interface LicenseScenarioItem {
  scenario: string;
  recommended: string;
  note: string;
}

export interface TutorialFaqItem {
  q: string;
  a: string;
}

export interface TutorialTranslations {
  navLabel: string;
  homeCta: string;
  title: string;
  subtitle: string;
  reassuranceItems: readonly [string, string, string];
  stepsTitle: string;
  steps: readonly [TutorialStepItem, TutorialStepItem, TutorialStepItem, TutorialStepItem];
  cheatTitle: string;
  cheatItems: readonly [
    LicenseScenarioItem,
    LicenseScenarioItem,
    LicenseScenarioItem,
    LicenseScenarioItem,
  ];
  cheatDocsLink: string;
  snsTipTitle: string;
  snsTipBody: string;
  faqTitle: string;
  faqs: readonly [TutorialFaqItem, TutorialFaqItem, TutorialFaqItem];
  bottomTitle: string;
  bottomStartBtn: string;
  bottomVerifyBtn: string;
}

import { EN } from './locales-data/tutorial/en';
import { JA } from './locales-data/tutorial/ja';
import type { TutorialTranslationsOthers } from './locales-data/tutorial/others';

export const TUTORIAL_I18N_EN: TutorialTranslations = EN;
export const TUTORIAL_I18N_JA: TutorialTranslations = JA;

export async function loadTutorialOthers(): Promise<TutorialTranslationsOthers> {
  return (await import('./locales-data/tutorial/others')).OTHERS;
}
