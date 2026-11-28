// Full synchronous locale record (all 13 languages). Tests only:
// the app imports EN/JA eagerly and streams the rest via loadQrStudioOthers().
import type { QrStudioTranslations } from './qrStudio';
import { EN } from './locales-data/qrStudio/en';
import { JA } from './locales-data/qrStudio/ja';
import { OTHERS } from './locales-data/qrStudio/others';

export const QR_STUDIO_I18N: Record<'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ar', QrStudioTranslations> = {
  'en': EN,
  'ja': JA,
  ...OTHERS,
};
