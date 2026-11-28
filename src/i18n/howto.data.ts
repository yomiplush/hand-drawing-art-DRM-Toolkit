// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadHowToOthers().
import type { HowToTranslations } from './howto';
import { EN } from './locales-data/howto/en';
import { JA } from './locales-data/howto/ja';
import { OTHERS } from './locales-data/howto/others';

export const HOWTO_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', HowToTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
