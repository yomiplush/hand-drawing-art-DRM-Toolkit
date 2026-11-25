import { AlertCircle, ChevronDown, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toFriendlyError } from '../../core/errors/friendlyError';
import { useI18n } from '../../i18n/context';

interface FriendlyErrorAlertProps {
  error: unknown;
  testId?: string;
  onDismiss?: () => void;
  className?: string;
}

export function FriendlyErrorAlert({
  error,
  testId,
  onDismiss,
  className = '',
}: FriendlyErrorAlertProps) {
  const { locale } = useI18n();
  const [showDetail, setShowDetail] = useState(false);

  if (!error) return null;

  const info = toFriendlyError(error, locale);
  const isJa = locale === 'ja';

  return (
    <div
      role="alert"
      data-testid={testId}
      className={`ga-status-error rounded-2xl border p-4 sm:p-5 space-y-2.5 text-start ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold leading-snug">{info.title}</h3>
            <p className="text-xs sm:text-sm opacity-90 leading-relaxed">{info.whatHappened}</p>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium underline underline-offset-4 opacity-80 hover:opacity-100 shrink-0 min-h-[36px] px-2 cursor-pointer"
          >
            {isJa ? '閉じる' : 'Dismiss'}
          </button>
        )}
      </div>

      <div className="rounded-xl px-3 py-2 text-xs sm:text-sm ga-surface-subtle flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-[var(--ga-success-text)]" aria-hidden="true" />
        <span className="ga-text">{info.dataSafe}</span>
      </div>

      <p className="text-xs sm:text-sm font-medium opacity-95">
        {isJa ? '次のステップ: ' : 'Next step: '}
        <span className="font-normal">{info.nextAction}</span>
      </p>

      {info.technicalDetail && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            className="inline-flex items-center gap-1.5 text-xs opacity-75 hover:opacity-100 cursor-pointer min-h-[32px]"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showDetail ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            <span>{isJa ? '技術的な詳細を表示' : 'Show technical details'}</span>
          </button>
          {showDetail && (
            <pre className="mt-1.5 rounded-lg p-2.5 text-[11px] font-mono overflow-x-auto ga-surface-subtle ga-text-muted whitespace-pre-wrap break-all">
              {info.technicalDetail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
