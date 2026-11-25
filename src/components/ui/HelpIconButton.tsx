import React, { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpIconButtonProps {
  label: string;
  title?: string;
  children: React.ReactNode;
  testId?: string;
  panelTestId?: string;
  variant?: 'popover' | 'inline';
  closeLabel?: string;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export function HelpIconButton({
  label,
  title,
  children,
  testId,
  panelTestId,
  variant = 'popover',
  closeLabel = 'Close help',
  open: controlledOpen,
  onOpenChange,
}: HelpIconButtonProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const panelId = useId();
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (
        variant === 'popover' &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, variant]);

  if (variant === 'inline') {
    return (
      <div className="contents">
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          title={label}
          aria-expanded={isOpen}
          aria-controls={panelId}
          data-testid={testId}
          onClick={() => setOpen(!isOpen)}
          className="inline-flex items-center justify-center rounded-xl ga-btn-secondary ga-text-muted hover:text-[var(--ga-text)] transition-colors min-h-[44px] min-w-[44px] shrink-0 cursor-pointer"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </button>

        {isOpen && (
          <div
            id={panelId}
            role="region"
            aria-label={title ?? label}
            data-testid={panelTestId}
            className="w-full basis-full mt-2 rounded-xl ga-surface-subtle px-3.5 py-2.5 text-xs sm:text-sm ga-text-secondary leading-relaxed flex items-start justify-between gap-2"
          >
            <div className="space-y-1 min-w-0">{children}</div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={closeLabel}
              className="inline-flex items-center justify-center rounded-lg ga-text-muted hover:text-[var(--ga-text)] min-h-[36px] min-w-[36px] shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-testid={testId}
        onClick={() => setOpen(!isOpen)}
        className={`inline-flex items-center justify-center rounded-full border transition-colors min-h-[44px] min-w-[44px] cursor-pointer ${
          isOpen
            ? 'ga-btn-primary shadow-sm'
            : 'ga-btn-secondary'
        }`}
      >
        <HelpCircle className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={title ? titleId : undefined}
          aria-label={!title ? label : undefined}
          data-testid={panelTestId}
          className="fixed inset-x-4 top-20 z-50 sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-[26rem] md:w-[30rem] max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto rounded-2xl ga-popover p-5 space-y-4 text-start"
        >
          <div className="flex items-center justify-between gap-3 border-b ga-border pb-3">
            {title ? (
              <h2 id={titleId} className="text-sm sm:text-base font-semibold ga-text">
                {title}
              </h2>
            ) : (
              <span className="text-sm font-semibold ga-text">{label}</span>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={closeLabel}
              className="inline-flex items-center justify-center rounded-xl ga-btn-secondary min-h-[44px] min-w-[44px] shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-3 text-xs sm:text-sm ga-text-secondary leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
