import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { useAppPreferences } from '../PreferencesContext';

interface ThemeToggleProps {
  testId?: string;
}

export function ThemeToggle({ testId = 'theme-toggle-btn' }: ThemeToggleProps) {
  const { locale } = useI18n();
  const { resolvedTheme, toggleTheme } = useAppPreferences();
  const isJa = locale === 'ja';
  const isDark = resolvedTheme === 'dark';

  const label = isDark
    ? isJa
      ? 'ライトモードに切り替え'
      : 'Switch to Light Mode'
    : isJa
      ? 'ダークモードに切り替え'
      : 'Switch to Dark Mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid={testId}
      className="inline-flex items-center justify-center rounded-xl ga-btn-secondary min-h-[44px] min-w-[44px] px-2.5 cursor-pointer transition-colors"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[var(--ga-accent-sky)]" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--ga-accent)]" aria-hidden="true" />
      )}
    </button>
  );
}
