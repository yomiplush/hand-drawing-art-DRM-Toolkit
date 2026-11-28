import React from 'react';
import { HelpIconButton } from './HelpIconButton';

export type StatusTone = 'success' | 'info' | 'warning' | 'danger';

interface CompactStatusProps {
  label: string;
  value: string;
  tone: StatusTone;
  icon: React.ReactNode;
  helpText?: string;
  helpLabel?: string;
  helpCloseLabel?: string;
  extra?: React.ReactNode;
  testId?: string;
  helpTestId?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'ga-status-success',
  info: 'ga-status-info',
  warning: 'ga-status-warning',
  danger: 'ga-status-error',
};

export function CompactStatus({
  label,
  value,
  tone,
  icon,
  helpText,
  helpLabel,
  helpCloseLabel,
  extra,
  testId,
  helpTestId,
}: CompactStatusProps) {
  return (
    <div
      data-testid={testId}
      className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 ${TONE_CLASSES[tone]}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider">
            {label}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm sm:text-base font-semibold">{value}</span>
            {extra}
          </div>
        </div>
      </div>

      {helpText && (
        <HelpIconButton
          variant="inline"
          label={helpLabel ?? `${label} info`}
          title={label}
          closeLabel={helpCloseLabel}
          testId={helpTestId}
        >
          <p>{helpText}</p>
        </HelpIconButton>
      )}
    </div>
  );
}
