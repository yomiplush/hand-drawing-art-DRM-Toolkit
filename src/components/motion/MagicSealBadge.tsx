import { useState } from 'react';
import { useAppPreferences } from '../PreferencesContext';

interface MagicSealBadgeProps {
  className?: string;
  testId?: string;
}

export function MagicSealBadge({
  className = '',
  testId = 'magic-seal-badge',
}: MagicSealBadgeProps) {
  const { reducedMotion } = useAppPreferences();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Math.round(-ny * 18 * 10) / 10,
      ry: Math.round(nx * 18 * 10) / 10,
    });
  };

  const resetTilt = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  return (
    <div
      data-testid={testId}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center select-none ${
        reducedMotion ? '' : 'chm-magic-float'
      } ${className}`}
    >
      <div
        style={{
          transform: reducedMotion
            ? undefined
            : `perspective(600px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full p-1 bg-gradient-to-br from-amber-300/80 via-sky-300/70 to-indigo-500/80 shadow-[0_14px_34px_-12px_rgba(37,99,235,0.45)] overflow-hidden"
      >
        <div className="relative h-full w-full rounded-full ga-card-solid flex items-center justify-center overflow-hidden border border-white/60 dark:border-white/15">
          <svg
            viewBox="0 0 80 80"
            className="h-14 w-14 sm:h-16 sm:w-16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="chmSealGold" x1="8" y1="8" x2="72" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="url(#chmSealGold)"
              strokeWidth="2.4"
              strokeDasharray="4 3"
              opacity="0.7"
            />
            <circle
              cx="40"
              cy="40"
              r="27"
              fill="url(#chmSealGold)"
              fillOpacity="0.14"
              stroke="url(#chmSealGold)"
              strokeWidth="2"
            />
            <path
              d="M40 18L44.6 31.2L58 32.8L47.6 41.6L50.8 55L40 47.4L29.2 55L32.4 41.6L22 32.8L35.4 31.2L40 18Z"
              fill="url(#chmSealGold)"
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
            <circle cx="57" cy="21" r="2.2" fill="#F59E0B" />
            <circle cx="22" cy="56" r="1.8" fill="#38BDF8" />
          </svg>

          {!reducedMotion && (
            <span className="pointer-events-none absolute inset-0 chm-shimmer-sweep" />
          )}
        </div>
      </div>
    </div>
  );
}
