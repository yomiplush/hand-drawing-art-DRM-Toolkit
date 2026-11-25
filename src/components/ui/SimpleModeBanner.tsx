import { SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { useAppPreferences } from '../PreferencesContext';

export function SimpleModeBanner({
  testId = 'simple-mode-banner',
}: {
  testId?: string;
}) {
  const { isAdvanced, setMode } = useAppPreferences();
  const { t } = useI18n();

  if (isAdvanced) return null;

  return (
    <div
      data-testid={testId}
      className="ga-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border"
    >
      <div className="space-y-1 min-w-0">
        <p className="text-sm font-semibold ga-text">
          {t.humanUx.mode.simpleModeBannerTitle}
        </p>
        <p className="text-xs ga-text-secondary leading-relaxed">
          {t.humanUx.mode.simpleModeBannerBody}
        </p>
      </div>
      <button
        type="button"
        data-testid={`${testId}-switch`}
        onClick={() => setMode('advanced')}
        className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium min-h-[44px] shrink-0 cursor-pointer"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t.humanUx.mode.switchToAdvancedBtn}</span>
      </button>
    </div>
  );
}
