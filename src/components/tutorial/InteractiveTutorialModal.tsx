import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { InteractiveTutorialStage3D } from './InteractiveTutorialStage3D';

interface InteractiveTutorialModalProps {
  open: boolean;
  onSkip: () => void;
  onComplete: () => void;
}

export function InteractiveTutorialModal({
  open,
  onSkip,
  onComplete,
}: InteractiveTutorialModalProps) {
  if (!open) {
    return null;
  }

  return <InteractiveTutorialDialog onSkip={onSkip} onComplete={onComplete} />;
}

function InteractiveTutorialDialog({
  onSkip,
  onComplete,
}: Omit<InteractiveTutorialModalProps, 'open'>) {
  const { t } = useI18n();
  const copy = t.interactiveTutorial;
  const [stepIndex, setStepIndex] = useState(0);

  const totalSteps = copy.steps.length;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;
  const activeStep = copy.steps[stepIndex] ?? copy.steps[0];

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
    }
  }, [isLastStep, onComplete, totalSteps]);

  const handleBack = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight') {
        setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onSkip, totalSteps]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.dialogAria}
      data-testid="interactive-tutorial-modal"
      className="fixed inset-0 z-[65] flex items-center justify-center bg-[#041024]/82 backdrop-blur-md p-4 pb-20 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-xl rounded-3xl border ga-border-strong bg-[var(--ga-surface-solid)] shadow-[var(--ga-shadow-lg)] p-5 sm:p-7 space-y-5 my-auto">
        {/* Top bar: step badge & step counter */}
        <div className="flex items-center justify-between gap-3">
          <span
            data-testid="tutorial-step-badge"
            className="ga-status-info inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>{activeStep.badge}</span>
          </span>

          <span
            data-testid="tutorial-step-counter"
            className="text-xs font-mono ga-text-muted"
          >
            {copy.stepCounterLabel} {stepIndex + 1} / {totalSteps}
          </span>
        </div>

        {/* Center 3D Interactive Motion Stage */}
        <InteractiveTutorialStage3D stepIndex={stepIndex} dragHint={copy.dragHint} />

        {/* Step Copy */}
        <div className="space-y-2 text-center px-1 sm:px-3">
          <h2
            data-testid="tutorial-step-title"
            className="text-lg sm:text-xl font-bold tracking-tight ga-text"
          >
            {activeStep.title}
          </h2>
          <p
            data-testid="tutorial-step-body"
            className="text-xs sm:text-sm ga-text-secondary leading-relaxed"
          >
            {activeStep.body}
          </p>
          <p className="pt-1 text-[11px] font-mono text-[var(--ga-accent)]">
            {activeStep.highlight}
          </p>
        </div>

        {/* Step Dots & Primary Navigation */}
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex items-center justify-center gap-2" role="tablist" aria-label={copy.dialogAria}>
            {copy.steps.map((step, idx) => (
              <button
                key={step.badge}
                type="button"
                role="tab"
                aria-selected={idx === stepIndex}
                aria-label={`${copy.stepCounterLabel} ${idx + 1}: ${step.title}`}
                data-testid={`tutorial-dot-${idx}`}
                onClick={() => setStepIndex(idx)}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === stepIndex
                    ? 'w-7 bg-[var(--ga-accent)]'
                    : 'w-2.5 bg-[var(--ga-border-strong)] hover:bg-[var(--ga-accent)]/60'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={isFirstStep}
              data-testid="tutorial-back-btn"
              className="ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              <span>{copy.backBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              data-testid={isLastStep ? 'tutorial-done-btn' : 'tutorial-next-btn'}
              className="ga-btn-primary inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold min-h-[44px] cursor-pointer"
            >
              <span>{isLastStep ? copy.doneBtn : copy.nextBtn}</span>
              {isLastStep ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Fixed bottom-end Skip button (RTL-aware via end-4 / end-6) */}
      <button
        type="button"
        onClick={onSkip}
        data-testid="tutorial-skip-btn"
        className="ga-btn-secondary fixed bottom-4 end-4 sm:bottom-6 sm:end-6 z-[66] inline-flex items-center justify-center rounded-full px-4 py-2 text-xs sm:text-sm font-medium shadow-lg backdrop-blur-md min-h-[44px] min-w-[44px] cursor-pointer"
      >
        {copy.skipBtn}
      </button>
    </div>
  );
}
