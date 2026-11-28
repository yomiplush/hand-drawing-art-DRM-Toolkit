
export interface GoogleComplianceTranslations {
  homeOverview: {
    appPurposeTitle: string;
    appPurposeBody: string;
    drivePurposeTitle: string;
    drivePurposeBody: string;
    privacyLinkLabel: string;
    storageLinkLabel: string;
    docsLinkLabel: string;
  };
  privacyPolicyGoogle: {
    sectionTitle: string;
    sectionBody: string;
    tableRowName: string;
    tableRowCategory: string;
    tableRowPurpose: string;
    tableRowRetention: string;
  };
}

import { EN } from './locales-data/googleCompliance/en';
import { JA } from './locales-data/googleCompliance/ja';
import type { GoogleComplianceTranslationsOthers } from './locales-data/googleCompliance/others';

export const GOOGLE_COMPLIANCE_I18N_EN: GoogleComplianceTranslations = EN;
export const GOOGLE_COMPLIANCE_I18N_JA: GoogleComplianceTranslations = JA;

export async function loadGoogleComplianceOthers(): Promise<GoogleComplianceTranslationsOthers> {
  return (await import('./locales-data/googleCompliance/others')).OTHERS;
}
