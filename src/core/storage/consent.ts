export type ConsentStatus = 'unset' | 'accepted' | 'rejected';

export interface ConsentRecord {
  status: Exclude<ConsentStatus, 'unset'>;
  updatedAt: string;
  version: 1;
}

const CONSENT_STORAGE_KEY = 'chm_gdpr_consent_v1';
const LOCALE_STORAGE_KEY = 'chm_locale';
const CONSENT_COOKIE_NAME = 'chm_consent';
const LOCALE_COOKIE_NAME = 'chm_locale';
const SIX_MONTHS_SECONDS = 180 * 24 * 60 * 60;

export const SUPPORTED_LOCALES = [
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
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(val: string | null | undefined): val is SupportedLocale {
  return typeof val === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(val);
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    if (k === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getConsentRecord(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
      if (
        (parsed.status === 'accepted' || parsed.status === 'rejected') &&
        parsed.version === 1 &&
        typeof parsed.updatedAt === 'string'
      ) {
        return {
          status: parsed.status,
          updatedAt: parsed.updatedAt,
          version: 1,
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  const cookieVal = readCookie(CONSENT_COOKIE_NAME);
  if (cookieVal === 'accepted' || cookieVal === 'rejected') {
    return {
      status: cookieVal,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
  return null;
}

export function getConsentStatus(): ConsentStatus {
  return getConsentRecord()?.status ?? 'unset';
}

export function hasOptionalStorageConsent(): boolean {
  return getConsentStatus() === 'accepted';
}

export function clearOptionalPreferences(): void {
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // Ignore
  }
  deleteCookie(LOCALE_COOKIE_NAME);
}

export function setConsentStatus(
  status: Exclude<ConsentStatus, 'unset'>,
  currentLocale?: string,
): ConsentRecord {
  const record: ConsentRecord = {
    status,
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore
  }
  writeCookie(CONSENT_COOKIE_NAME, status, SIX_MONTHS_SECONDS);

  if (status === 'rejected') {
    clearOptionalPreferences();
  } else if (status === 'accepted' && isSupportedLocale(currentLocale)) {
    persistOptionalLocale(currentLocale);
  }
  return record;
}

export function resetConsentStatus(): void {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Ignore
  }
  deleteCookie(CONSENT_COOKIE_NAME);
  clearOptionalPreferences();
}

export function readOptionalLocale(): SupportedLocale | null {
  if (!hasOptionalStorageConsent()) return null;
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) return saved;
  } catch {
    // Ignore
  }
  const cookieVal = readCookie(LOCALE_COOKIE_NAME);
  if (isSupportedLocale(cookieVal)) return cookieVal;
  return null;
}

export function persistOptionalLocale(locale: SupportedLocale): void {
  if (!hasOptionalStorageConsent()) return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore
  }
  writeCookie(LOCALE_COOKIE_NAME, locale, SIX_MONTHS_SECONDS);
}
