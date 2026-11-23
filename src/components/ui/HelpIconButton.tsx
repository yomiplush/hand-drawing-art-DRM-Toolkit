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
          className="inline-flex items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] text-slate-300 hover:border-sky-400/40 hover:text-sky-200 transition-colors min-h-[44px] min-w-[44px] shrink-0 cursor-pointer"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </button>

        {isOpen && (
          <div
            id={panelId}
            role="region"
            aria-label={title ?? label}
            data-testid={panelTestId}
            className="w-full basis-full mt-2 rounded-lg border border-sky-400/25 bg-[#030b18]/80 px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed flex items-start justify-between gap-2"
          >
            <div className="space-y-1">{children}</div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={closeLabel}
              className="inline-flex items-center justify-center rounded-md text-slate-400 hover:text-white min-h-[36px] min-w-[36px] shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block">
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
            ? 'border-sky-300/60 bg-sky-400/15 text-sky-100'
            : 'border-white/[0.14] bg-[#051224]/80 text-slate-200 hover:border-sky-400/40 hover:text-white'
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
          className="fixed inset-x-4 top-20 z-50 sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-[26rem] md:w-[30rem] max-h-[75vh] overflow-y-auto rounded-2xl border border-sky-400/30 bg-[#041021]/95 backdrop-blur-xl shadow-2xl shadow-black/80 p-5 space-y-4 text-start"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            {title ? (
              <h2 id={titleId} className="text-sm sm:text-base font-semibold text-white">
                {title}
              </h2>
            ) : (
              <span className="text-sm font-semibold text-white">{label}</span>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={closeLabel}
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-slate-300 hover:text-white hover:border-white/[0.25] min-h-[44px] min-w-[44px] shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-3 text-xs sm:text-sm text-slate-200 leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
