// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadMinimalUiOthers().
import type { MinimalUiTranslations } from './minimalUi';
import { EN } from './locales-data/minimalUi/en';
import { JA } from './locales-data/minimalUi/ja';
import { OTHERS } from './locales-data/minimalUi/others';

export const MINIMAL_UI_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', MinimalUiTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
