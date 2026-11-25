import { Sparkles, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { useAppPreferences } from '../PreferencesContext';

interface ModeToggleProps {
  compact?: boolean;
  testId?: string;
}

export function ModeToggle({ compact = false, testId = 'app-mode-toggle' }: ModeToggleProps) {
  const { t } = useI18n();
  const { mode, setMode } = useAppPreferences();

  return (
    <div
      role="group"
      aria-label={t.simple.mode.switchGroupAria}
      data-testid={testId}
      className="inline-flex items-center rounded-full p-0.5 ga-surface-subtle border ga-border shadow-xs shrink-0"
    >
      <button
        type="button"
        onClick={() => setMode('simple')}
        aria-pressed={mode === 'simple'}
        data-testid={`${testId}-simple`}
        className={`chm-spring-btn inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap cursor-pointer min-h-[38px] ${
          compact ? 'px-2.5 sm:px-3 py-1.5 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm'
        } ${
          mode === 'simple'
            ? 'ga-btn-primary shadow-sm'
            : 'ga-text-muted hover:text-[var(--ga-text)]'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.simple.mode.simpleLabel}</span>
      </button>

      <button
        type="button"
        onClick={() => setMode('advanced')}
        aria-pressed={mode === 'advanced'}
        data-testid={`${testId}-advanced`}
        className={`chm-spring-btn inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap cursor-pointer min-h-[38px] ${
          compact ? 'px-2.5 sm:px-3 py-1.5 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm'
        } ${
          mode === 'advanced'
            ? 'ga-btn-primary shadow-sm'
            : 'ga-text-muted hover:text-[var(--ga-text)]'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.simple.mode.advancedLabel}</span>
      </button>
    </div>
  );
}
