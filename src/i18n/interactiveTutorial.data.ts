// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadInteractiveTutorialOthers().
import type { InteractiveTutorialTranslations } from './interactiveTutorial';
import { EN } from './locales-data/interactiveTutorial/en';
import { JA } from './locales-data/interactiveTutorial/ja';
import { OTHERS } from './locales-data/interactiveTutorial/others';

export const INTERACTIVE_TUTORIAL_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', InteractiveTutorialTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
