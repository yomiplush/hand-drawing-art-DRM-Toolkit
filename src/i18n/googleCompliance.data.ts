// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadGoogleComplianceOthers().
import type { GoogleComplianceTranslations } from './googleCompliance';
import { EN } from './locales-data/googleCompliance/en';
import { JA } from './locales-data/googleCompliance/ja';
import { OTHERS } from './locales-data/googleCompliance/others';

export const GOOGLE_COMPLIANCE_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', GoogleComplianceTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
