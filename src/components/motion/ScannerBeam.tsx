import type { ReactNode } from 'react';
import { useAppPreferences } from '../useAppPreferences';

interface ScannerBeamProps {
  scanning: boolean;
  children: ReactNode;
  label?: string;
  className?: string;
  testId?: string;
}

export function ScannerBeam({
  scanning,
  children,
  label,
  className = '',
  testId,
}: ScannerBeamProps) {
  const { reducedMotion } = useAppPreferences();

  return (
    <div data-testid={testId} className={`relative overflow-hidden rounded-2xl ${className}`}>
      {children}

      {scanning && (
        <div
          data-testid="scanner-beam-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-sky-500/5 dark:bg-sky-400/10"
        >
          {!reducedMotion && (
            <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-sky-400/55 to-amber-300/70 shadow-[0_0_24px_rgba(56,189,248,0.65)] chm-scanner-sweep" />
          )}
          {label && (
            <div className="absolute bottom-3 inset-x-3 flex justify-center">
              <span className="rounded-full bg-slate-950/75 text-white px-3.5 py-1 text-xs font-medium backdrop-blur-sm">
                {label}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
