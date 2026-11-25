import type { ReactNode } from 'react';
import { Award } from 'lucide-react';
import { useAppPreferences } from '../PreferencesContext';
import { SparkleBurst } from './SparkleBurst';

interface StampCeremonyProps {
  active: boolean;
  children: ReactNode;
  badgeText?: string;
}

export function StampCeremony({
  active,
  children,
  badgeText = 'SEALED',
}: StampCeremonyProps) {
  const { reducedMotion } = useAppPreferences();

  return (
    <div className="relative flex items-center justify-center w-full overflow-visible">
      {children}

      {active && !reducedMotion && (
        <div
          aria-hidden="true"
          data-testid="stamp-ceremony-overlay"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="absolute h-28 w-28 rounded-full border-2 border-amber-400/75 chm-stamp-shockwave" />
          <div className="relative flex flex-col items-center justify-center rounded-full h-24 w-24 bg-gradient-to-br from-amber-400 via-amber-500 to-blue-600 text-white shadow-xl border-2 border-white/80 chm-stamp-press">
            <Award className="h-9 w-9 drop-shadow" />
            <span className="text-[10px] font-bold tracking-widest uppercase mt-0.5">
              {badgeText}
            </span>
          </div>
          <SparkleBurst active />
        </div>
      )}
    </div>
  );
}
