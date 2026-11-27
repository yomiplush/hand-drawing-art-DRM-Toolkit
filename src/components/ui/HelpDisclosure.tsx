import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface HelpDisclosureProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function HelpDisclosure({
  label,
  children,
  defaultOpen = false,
  testId,
  icon,
  className = '',
}: HelpDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={`rounded-2xl ga-card ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-start text-xs sm:text-sm font-medium ga-text hover:opacity-90 transition-colors min-h-[44px] cursor-pointer rounded-2xl"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {icon ?? <HelpCircle className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />}
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 ga-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={label}
          className="border-t ga-border px-4 py-3 text-xs sm:text-sm ga-text-secondary leading-relaxed"
        >
          {children}
        </div>
      )}
    </div>
  );
}
