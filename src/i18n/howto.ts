
export interface HowToTranslations {
  homeTitle: string;
  homeSubtitle: string;
  steps: readonly [
    { title: string; desc: string },
    { title: string; desc: string },
    { title: string; desc: string },
  ];
  simpleFlowHint: string;
  quickKeyTitle: string;
  quickKeyBody: string;
  quickKeyBtn: string;
  quickKeyBusy: string;
  quickKeyTip: string;
  advancedToggle: string;
  docsUsageTitle: string;
}

import { EN } from './locales-data/howto/en';
import { JA } from './locales-data/howto/ja';
import type { HowToTranslationsOthers } from './locales-data/howto/others';

export const HOWTO_I18N_EN: HowToTranslations = EN;
export const HOWTO_I18N_JA: HowToTranslations = JA;

export async function loadHowToOthers(): Promise<HowToTranslationsOthers> {
  return (await import('./locales-data/howto/others')).OTHERS;
}
