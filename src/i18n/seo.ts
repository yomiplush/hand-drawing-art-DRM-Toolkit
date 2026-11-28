
export interface SeoPageMeta {
  title: string;
  description: string;
  keywords: string;
}

export interface SeoFaqItem {
  q: string;
  a: string;
}

export interface SeoTranslations {
  home: SeoPageMeta;
  create: SeoPageMeta;
  createStudio: SeoPageMeta;
  verify: SeoPageMeta;
  tutorial: SeoPageMeta;
  keys: SeoPageMeta;
  exchange?: SeoPageMeta;
  docs: SeoPageMeta;
  privacy: SeoPageMeta;
  homeFaqTitle: string;
  homeFaqSubtitle: string;
  homeFaqs: SeoFaqItem[];
}

import { EN } from './locales-data/seo/en';
import { JA } from './locales-data/seo/ja';
import type { SeoTranslationsOthers } from './locales-data/seo/others';

export const SEO_I18N_EN: SeoTranslations = EN;
export const SEO_I18N_JA: SeoTranslations = JA;

export async function loadSeoOthers(): Promise<SeoTranslationsOthers> {
  return (await import('./locales-data/seo/others')).OTHERS;
}
