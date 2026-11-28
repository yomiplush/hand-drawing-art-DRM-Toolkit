import { createContext, useContext } from 'react';
import type { AppMode, ResolvedTheme, ThemeMode } from '../core/preferences/appPreferences';

export interface PreferencesContextValue {
  mode: AppMode;
  isAdvanced: boolean;
  setMode: (next: AppMode) => void;
  toggleMode: () => void;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
  reducedMotion: boolean;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function useAppPreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('useAppPreferences must be used within PreferencesProvider');
  }
  return ctx;
}
