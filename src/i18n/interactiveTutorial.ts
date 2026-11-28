
export interface InteractiveTutorialStepCopy {
  badge: string;
  title: string;
  body: string;
  highlight: string;
}

export interface InteractiveTutorialTranslations {
  dialogAria: string;
  headerButtonLabel: string;
  headerButtonTooltip: string;
  launchFromPageBtn: string;
  dragHint: string;
  stepCounterLabel: string;
  backBtn: string;
  nextBtn: string;
  skipBtn: string;
  doneBtn: string;
  steps: readonly [
    InteractiveTutorialStepCopy,
    InteractiveTutorialStepCopy,
    InteractiveTutorialStepCopy,
    InteractiveTutorialStepCopy,
  ];
}

import { EN } from './locales-data/interactiveTutorial/en';
import { JA } from './locales-data/interactiveTutorial/ja';
import type { InteractiveTutorialTranslationsOthers } from './locales-data/interactiveTutorial/others';

export const INTERACTIVE_TUTORIAL_I18N_EN: InteractiveTutorialTranslations = EN;
export const INTERACTIVE_TUTORIAL_I18N_JA: InteractiveTutorialTranslations = JA;

export async function loadInteractiveTutorialOthers(): Promise<InteractiveTutorialTranslationsOthers> {
  return (await import('./locales-data/interactiveTutorial/others')).OTHERS;
}
