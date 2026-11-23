import React, { useId, useRef, useState } from 'react';
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
      className={`rounded-xl border border-white/[0.1] bg-[#041021]/65 backdrop-blur-md ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-start text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors min-h-[44px] cursor-pointer rounded-xl"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {icon ?? <HelpCircle className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />}
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={label}
          className="border-t border-white/[0.08] px-4 py-3 text-xs sm:text-sm text-slate-300 leading-relaxed"
        >
          {children}
        </div>
      )}
    </div>
  );
}
