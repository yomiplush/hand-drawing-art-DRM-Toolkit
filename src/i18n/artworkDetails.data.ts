// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadArtworkDetailsOthers().
import type { ArtworkDetailsTranslations } from './artworkDetails';
import { EN } from './locales-data/artworkDetails/en';
import { JA } from './locales-data/artworkDetails/ja';
import { OTHERS } from './locales-data/artworkDetails/others';

export const ARTWORK_DETAILS_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', ArtworkDetailsTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
