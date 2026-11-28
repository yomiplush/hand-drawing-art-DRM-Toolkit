// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadNextGenOthers().
import type { NextGenTranslations } from './nextGen';
import { EN } from './locales-data/nextGen/en';
import { JA } from './locales-data/nextGen/ja';
import { OTHERS } from './locales-data/nextGen/others';

export const NEXT_GEN_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', NextGenTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
