// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadUxGuidanceOthers().
import type { UxGuidanceTranslations } from './uxGuidance';
import { EN } from './locales-data/uxGuidance/en';
import { JA } from './locales-data/uxGuidance/ja';
import { OTHERS } from './locales-data/uxGuidance/others';

export const UX_GUIDANCE_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', UxGuidanceTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
