// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadVerifyMobileOthers().
import type { VerifyMobileTranslations } from './verifyMobile';
import { EN } from './locales-data/verifyMobile/en';
import { JA } from './locales-data/verifyMobile/ja';
import { OTHERS } from './locales-data/verifyMobile/others';

export const VERIFY_MOBILE_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', VerifyMobileTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
