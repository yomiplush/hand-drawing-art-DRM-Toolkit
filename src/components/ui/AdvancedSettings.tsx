import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

interface AdvancedSettingsProps {
  label: string;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  className?: string;
}

export function AdvancedSettings({
  label,
  summary,
  children,
  defaultOpen = false,
  testId,
  className = '',
}: AdvancedSettingsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
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
        aria-controls={contentId}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium ga-text hover:opacity-90 transition-colors min-h-[44px] cursor-pointer rounded-2xl"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <SlidersHorizontal className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {summary && !open && (
            <span className="hidden sm:inline text-xs font-normal ga-text-muted truncate">
              · {summary}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 ga-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={contentId}
          role="region"
          aria-label={label}
          className="border-t ga-border p-4 space-y-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
