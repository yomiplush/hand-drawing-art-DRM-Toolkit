
export interface VerifyMobileTranslations {
  proofStep2Title: string;
  proofStep2Desc: string;
  pasteImageBtn: string;
  pasteBusy: string;
  pasteNoImage: string;
  pasteUnsupported: string;
  pasteHint: string;
  rawProofToggle: string;
  attachedReadyBadge: string;
  sharedImageVerifiedNote: string;
  sharedImageNoQrNote: string;
  cameraFollowUpHint: string;
}

import { EN } from './locales-data/verifyMobile/en';
import { JA } from './locales-data/verifyMobile/ja';
import type { VerifyMobileTranslationsOthers } from './locales-data/verifyMobile/others';

export const VERIFY_MOBILE_I18N_EN: VerifyMobileTranslations = EN;
export const VERIFY_MOBILE_I18N_JA: VerifyMobileTranslations = JA;

export async function loadVerifyMobileOthers(): Promise<VerifyMobileTranslationsOthers> {
  return (await import('./locales-data/verifyMobile/others')).OTHERS;
}
