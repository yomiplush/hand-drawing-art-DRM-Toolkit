// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadHardeningOthers().
import type { HardeningTranslations } from './hardening';
import { EN } from './locales-data/hardening/en';
import { JA } from './locales-data/hardening/ja';
import { OTHERS } from './locales-data/hardening/others';

export const HARDENING_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', HardeningTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
