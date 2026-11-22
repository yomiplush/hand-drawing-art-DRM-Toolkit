import { beforeEach, describe, expect, it } from 'vitest';
import {
  SUPPORTED_LOCALES,
  getConsentRecord,
  getConsentStatus,
  hasOptionalStorageConsent,
  isSupportedLocale,
  persistOptionalLocale,
  readOptionalLocale,
  resetConsentStatus,
  setConsentStatus,
} from '../../src/core/storage/consent';

describe('GDPR consent & optional locale persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'chm_consent=; Path=/; Max-Age=0; SameSite=Lax';
    document.cookie = 'chm_locale=; Path=/; Max-Age=0; SameSite=Lax';
  });

  it('starts unset and refuses optional locale writes before consent', () => {
    expect(getConsentStatus()).toBe('unset');
    expect(getConsentRecord()).toBeNull();
    expect(hasOptionalStorageConsent()).toBe(false);

    persistOptionalLocale('ja');
    expect(localStorage.getItem('chm_locale')).toBeNull();
    expect(readOptionalLocale()).toBeNull();
  });

  it('persists optional locale after acceptance and clears everything on rejection or reset', () => {
    const accepted = setConsentStatus('accepted', 'ko');
    expect(accepted.status).toBe('accepted');
    expect(getConsentStatus()).toBe('accepted');
    expect(hasOptionalStorageConsent()).toBe(true);
    expect(readOptionalLocale()).toBe('ko');
    expect(document.cookie).toContain('chm_consent=accepted');
    expect(document.cookie).toContain('chm_locale=ko');

    persistOptionalLocale('uk');
    expect(readOptionalLocale()).toBe('uk');

    const rejected = setConsentStatus('rejected');
    expect(rejected.status).toBe('rejected');
    expect(getConsentStatus()).toBe('rejected');
    expect(hasOptionalStorageConsent()).toBe(false);
    expect(localStorage.getItem('chm_locale')).toBeNull();
    expect(readOptionalLocale()).toBeNull();
    expect(document.cookie).not.toContain('chm_locale=uk');

    persistOptionalLocale('zh-CN');
    expect(localStorage.getItem('chm_locale')).toBeNull();

    resetConsentStatus();
    expect(getConsentStatus()).toBe('unset');
    expect(getConsentRecord()).toBeNull();
  });

  it('validates all 13 supported locales accurately', () => {
    expect(SUPPORTED_LOCALES).toEqual([
      'en',
      'ja',
      'zh-CN',
      'zh-TW',
      'ko',
      'ru',
      'uk',
      'es',
      'fr',
      'de',
      'pt',
      'it',
      'ar',
    ]);
    for (const loc of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(loc)).toBe(true);
    }
    expect(isSupportedLocale('xx')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
  });
});
