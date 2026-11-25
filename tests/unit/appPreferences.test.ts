import { beforeEach, describe, expect, it } from 'vitest';
import {
  APP_MODE_STORAGE_KEY,
  DEFAULT_APP_PREFERENCES,
  THEME_MODE_STORAGE_KEY,
  applyResolvedThemeToDocument,
  getStoredAppMode,
  getStoredThemeMode,
  persistAppMode,
  persistThemeMode,
  resolveTheme,
} from '../../src/core/preferences/appPreferences';

describe('appPreferences (Simple/Advanced mode & Gentle Azure theme)', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove('dark');
  });

  it('defaults strictly to simple mode and system theme', () => {
    expect(DEFAULT_APP_PREFERENCES.mode).toBe('simple');
    expect(DEFAULT_APP_PREFERENCES.theme).toBe('system');
    expect(getStoredAppMode()).toBe('simple');
    expect(getStoredThemeMode()).toBe('system');
  });

  it('persists mode & theme choices and rejects invalid values gracefully', () => {
    persistAppMode('advanced');
    expect(localStorage.getItem(APP_MODE_STORAGE_KEY)).toBe('advanced');
    expect(getStoredAppMode()).toBe('advanced');

    localStorage.setItem(APP_MODE_STORAGE_KEY, 'unknown-mode');
    expect(getStoredAppMode()).toBe('simple');

    persistThemeMode('dark');
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
    expect(getStoredThemeMode()).toBe('dark');

    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'neon');
    expect(getStoredThemeMode()).toBe('system');
  });

  it('resolves theme modes and updates document theme attributes & dark class', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');

    applyResolvedThemeToDocument('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyResolvedThemeToDocument('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
