export type AppMode = 'simple' | 'advanced';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface AppPreferences {
  mode: AppMode;
  theme: ThemeMode;
}

export const APP_MODE_STORAGE_KEY = 'chm_ui_mode_v1';
export const THEME_MODE_STORAGE_KEY = 'chm_theme_mode_v1';

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  mode: 'simple',
  theme: 'system',
};

export function isAppMode(val: unknown): val is AppMode {
  return val === 'simple' || val === 'advanced';
}

export function isThemeMode(val: unknown): val is ThemeMode {
  return val === 'light' || val === 'dark' || val === 'system';
}

export function getStoredAppMode(): AppMode {
  try {
    const saved = localStorage.getItem(APP_MODE_STORAGE_KEY);
    if (isAppMode(saved)) return saved;
  } catch {
    // Ignore storage unavailability
  }
  return 'simple';
}

export function persistAppMode(mode: AppMode): void {
  try {
    localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage unavailability
  }
}

export function getStoredThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (isThemeMode(saved)) return saved;
  } catch {
    // Ignore storage unavailability
  }
  return 'system';
}

export function persistThemeMode(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, theme);
  } catch {
    // Ignore storage unavailability
  }
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function applyResolvedThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', resolved === 'dark' ? '#0F1115' : '#FAFAFA');
  }
}
