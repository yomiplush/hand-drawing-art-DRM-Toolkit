
export interface UxGuidanceTranslations {
  snsRecompression: {
    createTitle: string;
    createBody: string;
    verifyTitle: string;
    verifyBody: string;
  };
  qrReadability: {
    tooSmallWarning: string;
    lowContrastWarning: string;
    moduleSizeLabel: string;
    contrastRatioLabel: string;
  };
}

import { EN } from './locales-data/uxGuidance/en';
import { JA } from './locales-data/uxGuidance/ja';
import type { UxGuidanceTranslationsOthers } from './locales-data/uxGuidance/others';

export const UX_GUIDANCE_I18N_EN: UxGuidanceTranslations = EN;
export const UX_GUIDANCE_I18N_JA: UxGuidanceTranslations = JA;

export async function loadUxGuidanceOthers(): Promise<UxGuidanceTranslationsOthers> {
  return (await import('./locales-data/uxGuidance/others')).OTHERS;
}
