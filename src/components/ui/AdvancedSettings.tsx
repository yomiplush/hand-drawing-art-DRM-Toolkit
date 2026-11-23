import React, { useId, useRef, useState } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      data-testid={testId}
      onKeyDown={handleKeyDown}
      className={`rounded-xl border border-white/[0.1] bg-[#041021]/60 backdrop-blur-md ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium text-slate-200 hover:text-white transition-colors min-h-[44px] cursor-pointer rounded-xl"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <SlidersHorizontal className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {summary && !open && (
            <span className="hidden sm:inline text-xs font-normal text-slate-400 truncate">
              · {summary}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={contentId}
          role="region"
          aria-label={label}
          className="border-t border-white/[0.08] p-4 space-y-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
