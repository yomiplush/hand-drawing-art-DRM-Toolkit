import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface HelpTipProps {
  text: string;
  label?: string;
  testId?: string;
  panelTestId?: string;
  className?: string;
}

interface FloatingCoords {
  top: number;
  left: number;
  width: number;
}

export function HelpTip({
  text,
  label = 'Help',
  testId,
  panelTestId,
  className = '',
}: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<FloatingCoords | null>(null);
  const panelId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const updateCoords = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return;
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const margin = 12;
    const width = Math.max(200, Math.min(336, vw - margin * 2));
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.max(margin, Math.min(vw - width - margin, rect.left));
    const top = Math.max(margin, Math.min(vh - 156, rect.bottom + 8));
    setCoords({ top, left, width });
  }, []);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        updateCoords();
      }
      return next;
    });
  };

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

    const handleReposition = () => {
      updateCoords();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition);
    };
  }, [open, updateCoords]);

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center align-middle shrink-0 ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
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
        style={
          open && coords
            ? {
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
              }
            : {
                position: 'fixed',
                top: '0px',
                left: '0px',
                width: '0px',
                height: '0px',
              }
        }
        className={`z-50 overflow-hidden transition-all duration-200 ease-out ${
          open
            ? 'max-h-60 opacity-100 translate-y-0 visible'
            : 'max-h-0 opacity-0 -translate-y-1 invisible pointer-events-none'
        }`}
      >
        <div className="rounded-xl border ga-border-strong ga-popover px-3.5 py-2.5 text-xs leading-relaxed ga-text-secondary flex items-start justify-between gap-2 text-start shadow-lg">
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
