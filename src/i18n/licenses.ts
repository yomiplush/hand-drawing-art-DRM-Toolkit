import type { LicenseId } from '../core/manifest/types';

export interface LicenseGuideEntry {
  name: string;
  summary: string;
}

export interface LicenseGuideTranslations {
  guideTitle: string;
  guideSubtitle: string;
  selectedLabel: string;
  appLicenseTitle: string;
  appLicenseBody: string;
  signalGuideTitle: string;
  signalGuideBody: string;
  badges: {
    commercialYes: string;
    commercialNo: string;
    derivativesYes: string;
    derivativesNo: string;
    shareAlikeYes: string;
    attributionYes: string;
    attributionNo: string;
  };
  items: Record<LicenseId, LicenseGuideEntry>;
}

import { EN } from './locales-data/licenses/en';
import { JA } from './locales-data/licenses/ja';
import type { LicenseGuideTranslationsOthers } from './locales-data/licenses/others';

export const LICENSE_I18N_EN: LicenseGuideTranslations = EN;
export const LICENSE_I18N_JA: LicenseGuideTranslations = JA;

export async function loadLicensesOthers(): Promise<LicenseGuideTranslationsOthers> {
  return (await import('./locales-data/licenses/others')).OTHERS;
}
