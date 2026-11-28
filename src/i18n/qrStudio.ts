
export interface QrStudioTranslations {
  navLabel: string;
  title: string;
  subtitle: string;
  modeSectionTitle: string;
  modeOuterLabel: string;
  modeOuterDesc: string;
  modeStudioLabel: string;
  modeStudioDesc: string;
  uploadFirstHint: string;
  createBannerTitle: string;
  createBannerDesc: string;
  createBannerBtn: string;
  backToMarginCreate: string;
  previewTitle: string;
  previewHint: string;
  presetsLabel: string;
  presets: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    center: string;
  };
  controlsTitle: string;
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  opacityLabel: string;
  styleLabel: string;
  eccLabel: string;
  styles: {
    'frosted-light': string;
    'frosted-dark': string;
    'modules-dark': string;
    'modules-light': string;
  };
  eccOptions: {
    M: string;
    Q: string;
    H: string;
  };
  readabilityLabel: string;
  readabilityOk: string;
  readabilityWarn: string;
  readabilityHint: string;
  maskRegionLabel: string;
  signInImageBtn: string;
  signingBusy: string;
  maskedDigestNote: string;
}

import { EN } from './locales-data/qrStudio/en';
import { JA } from './locales-data/qrStudio/ja';
import type { QrStudioTranslationsOthers } from './locales-data/qrStudio/others';

export const QR_STUDIO_I18N_EN: QrStudioTranslations = EN;
export const QR_STUDIO_I18N_JA: QrStudioTranslations = JA;

export async function loadQrStudioOthers(): Promise<QrStudioTranslationsOthers> {
  return (await import('./locales-data/qrStudio/others')).OTHERS;
}
