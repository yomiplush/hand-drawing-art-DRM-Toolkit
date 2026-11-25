import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  applyResolvedThemeToDocument,
  getStoredAppMode,
  getStoredThemeMode,
  getSystemPrefersDark,
  persistAppMode,
  persistThemeMode,
  resolveTheme,
} from '../core/preferences/appPreferences';
import type { AppMode, ResolvedTheme, ThemeMode } from '../core/preferences/appPreferences';

interface PreferencesContextValue {
  mode: AppMode;
  isAdvanced: boolean;
  setMode: (next: AppMode) => void;
  toggleMode: () => void;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(getStoredAppMode);
  const [theme, setThemeState] = useState<ThemeMode>(getStoredThemeMode);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const resolvedTheme = resolveTheme(theme, systemDark);

  useEffect(() => {
    applyResolvedThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  const setMode = (next: AppMode) => {
    setModeState(next);
    persistAppMode(next);
  };

  const toggleMode = () => {
    setMode(mode === 'simple' ? 'advanced' : 'simple');
  };

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    persistThemeMode(next);
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <PreferencesContext.Provider
      value={{
        mode,
        isAdvanced: mode === 'advanced',
        setMode,
        toggleMode,
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function useAppPreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('useAppPreferences must be used within PreferencesProvider');
  }
  return ctx;
}
