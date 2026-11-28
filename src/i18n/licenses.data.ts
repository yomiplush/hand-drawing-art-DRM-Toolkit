// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadLicensesOthers().
import type { LicenseGuideTranslations } from './licenses';
import { EN } from './locales-data/licenses/en';
import { JA } from './locales-data/licenses/ja';
import { OTHERS } from './locales-data/licenses/others';

export const LICENSE_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', LicenseGuideTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
