// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadTutorialOthers().
import type { TutorialTranslations } from './tutorial';
import { EN } from './locales-data/tutorial/en';
import { JA } from './locales-data/tutorial/ja';
import { OTHERS } from './locales-data/tutorial/others';

export const TUTORIAL_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', TutorialTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
