import { useCallback, useEffect, useId, useState } from 'react';
import type { Locale } from '../i18n/context';
import { useI18n } from '../i18n/context';

type SplashPhase = 'playing' | 'exiting' | 'done';

const SPLASH_HOLD_MS = 1050;
const SPLASH_EXIT_MS = 350;
const SPLASH_SKIP_EXIT_MS = 200;

const SKIP_LABELS: Record<Locale, string> = {
  en: 'Skip',
  ja: 'スキップ',
  'zh-CN': '跳过',
  'zh-TW': '略過',
  ko: '건너뛰기',
  ru: 'Пропустить',
  uk: 'Пропустити',
  es: 'Omitir',
  fr: 'Passer',
  de: 'Überspringen',
  pt: 'Pular',
  it: 'Salta',
  ar: 'تخطي',
};

function prefersReducedMotionNow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function MoonStartupSplash() {
  const { t, locale } = useI18n();
  const [phase, setPhase] = useState<SplashPhase>(() =>
    prefersReducedMotionNow() ? 'done' : 'playing',
  );
  const [fastExit, setFastExit] = useState(false);

  const idPrefix = useId().replace(/:/g, '');

  const beginExit = useCallback((immediateSkip = false) => {
    setPhase((prev) => {
      if (prev !== 'playing') return prev;
      setFastExit(immediateSkip);
      return 'exiting';
    });
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;

    const holdTimer = window.setTimeout(() => {
      beginExit(false);
    }, SPLASH_HOLD_MS);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        beginExit(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(holdTimer);
    };
  }, [phase, beginExit]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const exitMs = fastExit ? SPLASH_SKIP_EXIT_MS : SPLASH_EXIT_MS;
    const doneTimer = window.setTimeout(() => {
      setPhase('done');
    }, exitMs);
    return () => {
      window.clearTimeout(doneTimer);
    };
  }, [phase, fastExit]);

  if (phase === 'done') {
    return null;
  }

  const isExiting = phase === 'exiting';
  const skipLabel = SKIP_LABELS[locale] ?? SKIP_LABELS.en;
  const bgHaloId = `${idPrefix}-halo`;
  const moonFillId = `${idPrefix}-moon-fill`;
  const moonEdgeId = `${idPrefix}-moon-edge`;
  const ringGradId = `${idPrefix}-ring-grad`;
  const veilGradId = `${idPrefix}-veil-grad`;
  const clipMoonId = `${idPrefix}-moon-clip`;

  return (
    <div
      data-testid="moon-startup-splash"
      data-phase={phase}
      role="presentation"
      onClick={() => beginExit(true)}
      style={{ backgroundColor: 'var(--ga-bg)' }}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden px-6 select-none ${
        isExiting
          ? `pointer-events-none opacity-0 scale-[1.025] transition-all ease-out ${
              fastExit ? 'duration-200' : 'duration-[350ms]'
            }`
          : 'pointer-events-auto opacity-100 scale-100 cursor-pointer'
      }`}
    >
      {/* Gentle Azure atmospheric backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, var(--ga-accent-soft) 0%, var(--ga-bg) 72%)',
        }}
      />

      {/* Top-right accessible skip pill */}
      <button
        type="button"
        data-testid="moon-splash-skip"
        onClick={(e) => {
          e.stopPropagation();
          beginExit(true);
        }}
        className="ga-btn-secondary absolute top-4 end-4 sm:top-6 sm:end-6 z-10 inline-flex items-center justify-center rounded-full px-3.5 py-2 text-xs font-medium transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
      >
        {skipLabel}
      </button>

      {/* Center Motion Graphic Composition */}
      <div className="relative flex flex-col items-center justify-center text-center max-w-full">
        {/* Volumetric Moonlight Halo */}
        <div
          aria-hidden="true"
          className="moon-splash-halo pointer-events-none absolute -top-6 h-60 w-60 sm:h-72 sm:w-72 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(61, 115, 197, 0.22) 0%, rgba(130, 184, 255, 0.08) 48%, transparent 72%)',
          }}
        />

        {/* Crescent Moon Vector Motion Graphic */}
        <svg
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          className="relative w-44 h-44 sm:w-52 sm:h-52 drop-shadow-[0_0_24px_rgba(61,115,197,0.25)]"
        >
          <defs>
            <radialGradient id={bgHaloId} cx="42%" cy="46%" r="58%">
              <stop offset="0%" stopColor="#82B8FF" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#3D73C5" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#3D73C5" stopOpacity="0" />
            </radialGradient>

            <linearGradient id={moonFillId} x1="68" y1="68" x2="164" y2="172" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#DCE9FA" />
              <stop offset="48%" stopColor="#82B8FF" />
              <stop offset="100%" stopColor="#2859B6" />
            </linearGradient>

            <linearGradient id={moonEdgeId} x1="90" y1="64" x2="162" y2="168" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#82B8FF" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#3D73C5" stopOpacity="0.45" />
            </linearGradient>

            <linearGradient id={ringGradId} x1="36" y1="36" x2="204" y2="204" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#82B8FF" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#3D73C5" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2859B6" stopOpacity="0.75" />
            </linearGradient>

            <radialGradient id={veilGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0C1424" stopOpacity="0.9" />
              <stop offset="78%" stopColor="#0C1424" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#0C1424" stopOpacity="0" />
            </radialGradient>

            <clipPath id={clipMoonId}>
              <circle cx="120" cy="120" r="56" />
            </clipPath>
          </defs>

          <circle cx="120" cy="120" r="88" fill={`url(#${bgHaloId})`} />

          <g className="moon-splash-orbit" style={{ transformOrigin: '120px 120px' }}>
            <circle
              cx="120"
              cy="120"
              r="98"
              stroke="rgba(61, 115, 197, 0.28)"
              strokeWidth="1"
              strokeDasharray="6 10"
            />
            <circle cx="120" cy="22" r="2.2" fill="#82B8FF" opacity="0.85" />
            <circle cx="218" cy="120" r="1.6" fill="#3D73C5" opacity="0.65" />
          </g>

          <circle
            cx="120"
            cy="120"
            r="80"
            stroke={`url(#${ringGradId})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            className="moon-splash-ring-trace"
            style={{ transformOrigin: '120px 120px', transform: 'rotate(-115deg)' }}
          />

          <g clipPath={`url(#${clipMoonId})`}>
            <g className="moon-splash-moon-group" style={{ transformOrigin: '120px 120px' }}>
              <path
                d="M 105.85 69.96 A 52 52 0 1 0 146.06 165 A 56 56 0 0 1 105.85 69.96 Z"
                fill={`url(#${moonFillId})`}
              />
              <path
                d="M 105.85 69.96 A 52 52 0 1 0 146.06 165 A 56 56 0 0 1 105.85 69.96 Z"
                stroke={`url(#${moonEdgeId})`}
                strokeWidth="2"
                strokeLinejoin="round"
                className="moon-splash-moon-stroke"
              />
            </g>

            <circle
              cx="116"
              cy="122"
              r="62"
              fill={`url(#${veilGradId})`}
              className="moon-splash-veil"
            />
          </g>

          <g className="moon-splash-sparkle" style={{ transformOrigin: '148px 94px' }}>
            <path
              d="M 148 82 L 150.6 91.4 L 160 94 L 150.6 96.6 L 148 106 L 145.4 96.6 L 136 94 L 145.4 91.4 Z"
              fill="#82B8FF"
            />
          </g>

          <circle
            cx="76"
            cy="72"
            r="2"
            fill="#82B8FF"
            className="moon-splash-star moon-splash-star-1"
            style={{ transformOrigin: '76px 72px' }}
          />
          <circle
            cx="176"
            cy="132"
            r="1.8"
            fill="#3D73C5"
            className="moon-splash-star moon-splash-star-2"
            style={{ transformOrigin: '176px 132px' }}
          />
          <circle
            cx="68"
            cy="158"
            r="1.5"
            fill="#82B8FF"
            className="moon-splash-star moon-splash-star-3"
            style={{ transformOrigin: '68px 158px' }}
          />
          <circle
            cx="166"
            cy="68"
            r="1.6"
            fill="#DCE9FA"
            className="moon-splash-star moon-splash-star-4"
            style={{ transformOrigin: '166px 68px' }}
          />
        </svg>

        {/* Brand Wordmark & Hairline Rule */}
        <div className="mt-1 flex flex-col items-center space-y-2.5 max-w-full">
          <div
            aria-hidden="true"
            className="moon-splash-hairline h-px w-28 bg-gradient-to-r from-transparent via-[var(--ga-accent)] to-transparent"
          />
          <p
            data-testid="moon-splash-brand"
            className="moon-splash-wordmark text-xl sm:text-2xl font-semibold ga-text tracking-tight"
          >
            {t.appName}
          </p>
          <p className="moon-splash-tagline text-xs sm:text-sm font-medium text-[var(--ga-accent)] tracking-wide">
            {t.minimal.home.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
