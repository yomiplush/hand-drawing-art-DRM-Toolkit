import { Check } from 'lucide-react';

export interface StepItem {
  number: 1 | 2 | 3;
  label: string;
}

export function ThreeStepIndicator({
  steps,
  activeStep,
  testIdPrefix = 'flow-step',
}: {
  steps: [StepItem, StepItem, StepItem];
  activeStep: 1 | 2 | 3;
  testIdPrefix?: string;
}) {
  return (
    <nav aria-label="Progress" className="w-full" data-testid={`${testIdPrefix}-bar`}>
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {steps.map((s) => {
          const isCompleted = s.number < activeStep;
          const isCurrent = s.number === activeStep;
          return (
            <li
              key={s.number}
              data-testid={`${testIdPrefix}-${s.number}`}
              aria-current={isCurrent ? 'step' : undefined}
              className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 min-w-0 transition-colors ${
                isCurrent
                  ? 'ga-surface-subtle ga-border-strong'
                  : isCompleted
                    ? 'ga-status-success'
                    : 'ga-card-solid ga-border opacity-75'
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isCurrent
                    ? 'bg-[var(--ga-primary-bg)] text-[var(--ga-primary-text)]'
                    : isCompleted
                      ? 'bg-[var(--ga-success-text)] text-white'
                      : 'ga-surface-subtle ga-text-muted border ga-border'
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : s.number}
              </span>
              <span
                className={`text-xs sm:text-sm font-medium truncate ${
                  isCurrent ? 'ga-text' : isCompleted ? 'ga-text' : 'ga-text-muted'
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function WorkerProgressBar({
  percent,
  label,
  testId = 'worker-progress-bar',
}: {
  percent: number;
  label: string;
  testId?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      data-testid={testId}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="ga-surface-subtle rounded-xl border ga-border p-3.5 space-y-2"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="ga-text font-medium">{label}</span>
        <span className="ga-text-muted tabular-nums">{clamped}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ga-border)]">
        <div
          className="h-full rounded-full bg-[var(--ga-primary-bg)] transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
