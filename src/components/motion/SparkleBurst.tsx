import { useAppPreferences } from '../useAppPreferences';

interface SparkleBurstProps {
  active?: boolean;
  className?: string;
  testId?: string;
}

const SPARKLES = [
  { tx: '-54px', ty: '-44px', delay: '0ms', scale: '1', color: '#F59E0B' },
  { tx: '58px', ty: '-40px', delay: '40ms', scale: '0.9', color: '#38BDF8' },
  { tx: '-64px', ty: '14px', delay: '70ms', scale: '0.78', color: '#2563EB' },
  { tx: '64px', ty: '22px', delay: '30ms', scale: '0.85', color: '#FBBF24' },
  { tx: '-24px', ty: '-66px', delay: '50ms', scale: '0.72', color: '#60A5FA' },
  { tx: '28px', ty: '-62px', delay: '90ms', scale: '0.95', color: '#F59E0B' },
  { tx: '-32px', ty: '52px', delay: '60ms', scale: '0.8', color: '#34D399' },
  { tx: '36px', ty: '50px', delay: '20ms', scale: '0.75', color: '#38BDF8' },
];

export function SparkleBurst({ active = true, className = '', testId }: SparkleBurstProps) {
  const { reducedMotion } = useAppPreferences();

  if (!active || reducedMotion) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible ${className}`}
    >
      {SPARKLES.map((sp, idx) => (
        <svg
          key={idx}
          viewBox="0 0 24 24"
          className="absolute h-5 w-5 chm-sparkle-particle"
          style={
            {
              color: sp.color,
              '--chm-tx': sp.tx,
              '--chm-ty': sp.ty,
              '--chm-scale': sp.scale,
              animationDelay: sp.delay,
            } as React.CSSProperties
          }
          fill="currentColor"
        >
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
        </svg>
      ))}
    </div>
  );
}
