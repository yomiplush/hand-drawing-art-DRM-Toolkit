import { useEffect, useState } from 'react';
import {
  APP_MODE_STORAGE_KEY,
  type AppMode,
  getStoredAppMode,
  persistAppMode,
} from '../core/preferences/appPreferences';
import {
  isSupportedLocale,
  readOptionalLocale,
  type SupportedLocale,
} from '../core/storage/consent';

export type UiMode = AppMode;

export const UI_MODE_STORAGE_KEY = APP_MODE_STORAGE_KEY;

export function getUiMode(): UiMode {
  return getStoredAppMode();
}

export function setUiMode(mode: UiMode): void {
  persistAppMode(mode);
}

export function detectQueryLang(): SupportedLocale | null {
  if (typeof window === 'undefined' || !window.location.search) return null;
  try {
    const hl = new URLSearchParams(window.location.search).get('hl');
    if (isSupportedLocale(hl)) {
      return hl;
    }
  } catch {
    // Ignore malformed URL query
  }
  return null;
}

export function detectInitialLang(): SupportedLocale {
  const queryLocale = detectQueryLang();
  if (queryLocale) return queryLocale;

  const saved = readOptionalLocale();
  if (saved) return saved;

  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('ja')) return 'ja';
    if (lang.includes('hant') || lang === 'zh-tw' || lang === 'zh-hk' || lang === 'zh-mo') {
      return 'zh-TW';
    }
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('ru')) return 'ru';
    if (lang.startsWith('uk')) return 'uk';
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('pt')) return 'pt';
    if (lang.startsWith('it')) return 'it';
    if (lang.startsWith('ar')) return 'ar';
  }
  return 'en';
}

export function getReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function subscribeReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  mql.addEventListener?.('change', listener);
  return () => mql.removeEventListener?.('change', listener);
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getReducedMotion);

  useEffect(() => {
    return subscribeReducedMotion(setReduced);
  }, []);

  return reduced;
}
