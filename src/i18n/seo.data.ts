// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadSeoOthers().
import type { SeoTranslations } from './seo';
import { EN } from './locales-data/seo/en';
import { JA } from './locales-data/seo/ja';
import { OTHERS } from './locales-data/seo/others';

export const SEO_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', SeoTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
