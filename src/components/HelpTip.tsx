import { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface HelpTipProps {
  text: string;
  label?: string;
  testId?: string;
  panelTestId?: string;
  className?: string;
}

export function HelpTip({
  text,
  label = 'Help',
  testId,
  panelTestId,
  className = '',
}: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className={`inline-flex flex-col items-start max-w-full align-middle ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        data-testid={testId}
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ga-border-strong ga-surface-solid text-[var(--ga-accent)] hover:bg-[var(--ga-accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ga-focus)] transition-colors cursor-pointer before:absolute before:-inset-2.5 before:content-['']"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <div
        id={panelId}
        role="region"
        aria-label={label}
        aria-hidden={!open}
        data-testid={panelTestId}
        data-open={open ? 'true' : 'false'}
        className={`overflow-hidden transition-all duration-200 ease-out w-[min(21rem,calc(100vw-3rem))] max-w-full ${
          open
            ? 'mt-2 max-h-48 opacity-100 translate-y-0 visible'
            : 'mt-0 max-h-0 opacity-0 -translate-y-1 invisible pointer-events-none'
        }`}
      >
        <div className="rounded-xl border ga-border-strong ga-popover px-3.5 py-2.5 text-xs leading-relaxed ga-text-secondary flex items-start justify-between gap-2 text-start">
          <p className="min-w-0 break-words">{text}</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            aria-label="Close help"
            className="shrink-0 rounded-full p-0.5 ga-text-muted hover:text-[var(--ga-text)] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </span>
  );
}
