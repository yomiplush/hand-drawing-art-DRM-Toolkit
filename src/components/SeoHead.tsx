import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isSupportedLocale } from '../core/storage/consent';
import { useI18n } from '../i18n/context';
import type { Locale } from '../i18n/context';
import type { SeoPageMeta } from '../i18n/seo';

const SITE_ORIGIN = 'https://certified-handmade.com';

const OG_LOCALE_MAP: Record<Locale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  ko: 'ko_KR',
  ru: 'ru_RU',
  uk: 'uk_UA',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  pt: 'pt_PT',
  it: 'it_IT',
  ar: 'ar_AR',
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, hreflang?: string): void {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) {
      el.setAttribute('hreflang', hreflang);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function SeoHead() {
  const { pathname, search, hash } = useLocation();
  const { locale, t } = useI18n();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const hlParam = params.get('hl');
    const isHashPrivacy = hash.toLowerCase() === '#privacypolicy';

    let canonicalPath = '/';
    let meta: SeoPageMeta = t.seo.home;

    if (isHashPrivacy || pathname === '/privacypolicy') {
      canonicalPath = '/privacypolicy';
      meta = t.seo.privacy;
    } else if (pathname === '/create') {
      canonicalPath = '/create';
      meta = params.get('mode') === 'studio' ? t.seo.createStudio : t.seo.create;
    } else if (pathname === '/verify') {
      canonicalPath = '/verify';
      meta = t.seo.verify;
    } else if (pathname === '/tutorial') {
      canonicalPath = '/tutorial';
      meta = t.seo.tutorial;
    } else if (pathname === '/keys') {
      canonicalPath = '/keys';
      meta = t.seo.keys;
    } else if (pathname === '/devices') {
      canonicalPath = '/devices';
      meta = {
        title: `${t.devices.title} | Certified Handmade`,
        description: t.devices.subtitle,
        keywords: t.seo.keys.keywords,
      };
    } else if (pathname === '/exchange') {
      canonicalPath = '/exchange';
      meta = t.seo.exchange ?? t.seo.keys;
    } else if (pathname === '/docs') {
      canonicalPath = '/docs';
      meta = t.seo.docs;
    }

    const canonicalUrl = isSupportedLocale(hlParam)
      ? `${SITE_ORIGIN}${canonicalPath}?hl=${hlParam}`
      : `${SITE_ORIGIN}${canonicalPath}`;

    document.title = meta.title;

    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'keywords', meta.keywords);

    upsertLink('canonical', canonicalUrl);
    upsertLink('alternate', `${SITE_ORIGIN}${canonicalPath}`, 'x-default');
    upsertLink('alternate', `${SITE_ORIGIN}${canonicalPath}?hl=en`, 'en');
    upsertLink('alternate', `${SITE_ORIGIN}${canonicalPath}?hl=ja`, 'ja');

    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:locale', OG_LOCALE_MAP[locale] ?? 'en_US');

    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
  }, [pathname, search, hash, locale, t]);

  return null;
}
