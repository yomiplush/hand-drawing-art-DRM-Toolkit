import { useEffect, useRef } from 'react';
import { useAppPreferences } from './PreferencesContext';

interface RibbonConfig {
  yRatio: number;
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  crestAlpha: number;
  fillTopAlpha: number;
}

const RIBBONS: RibbonConfig[] = [
  {
    yRatio: 0.48,
    amplitude: 44,
    frequency: 0.0019,
    speed: 0.14,
    phase: 0.0,
    crestAlpha: 0.16,
    fillTopAlpha: 0.09,
  },
  {
    yRatio: 0.56,
    amplitude: 52,
    frequency: 0.0015,
    speed: -0.1,
    phase: 1.7,
    crestAlpha: 0.2,
    fillTopAlpha: 0.11,
  },
  {
    yRatio: 0.65,
    amplitude: 36,
    frequency: 0.0022,
    speed: 0.09,
    phase: 3.4,
    crestAlpha: 0.13,
    fillTopAlpha: 0.07,
  },
];

export function Ps3WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useAppPreferences();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const motionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    let reducedMotion = motionQuery?.matches ?? false;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;
    let startTime = performance.now();
    let hidden = typeof document !== 'undefined' && document.hidden;
    const isDark = resolvedTheme === 'dark';

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = (elapsedSec: number) => {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        // Gentle Azure Night Canvas (#0C1424 -> #142744)
        bg.addColorStop(0, '#0C1424');
        bg.addColorStop(0.5, '#101D34');
        bg.addColorStop(0.85, '#142744');
        bg.addColorStop(1, '#0C1424');
      } else {
        // Gentle Azure Morning Stationery (#FFFFFF / #F5F8FD -> #DCE9FA wash)
        bg.addColorStop(0, '#FFFFFF');
        bg.addColorStop(0.45, '#F5F8FD');
        bg.addColorStop(0.88, '#E7F0FC');
        bg.addColorStop(1, '#DCE9FA');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Soft watercolor atmospheric glow
      const glow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.36,
        24,
        width * 0.5,
        height * 0.42,
        Math.max(width, height) * 0.65,
      );
      if (isDark) {
        glow.addColorStop(0, 'rgba(61, 115, 197, 0.16)');
        glow.addColorStop(0.55, 'rgba(40, 89, 182, 0.08)');
        glow.addColorStop(1, 'rgba(12, 20, 36, 0)');
      } else {
        glow.addColorStop(0, 'rgba(130, 184, 255, 0.22)');
        glow.addColorStop(0.55, 'rgba(220, 233, 250, 0.28)');
        glow.addColorStop(1, 'rgba(245, 248, 253, 0)');
      }
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const step = Math.max(16, Math.floor(width / 64));

      for (const r of RIBBONS) {
        const baseY = height * r.yRatio;
        const points: Array<[number, number]> = [];

        for (let x = -step; x <= width + step; x += step) {
          const t = elapsedSec * r.speed + r.phase;
          const wave1 = Math.sin(x * r.frequency + t) * r.amplitude;
          const wave2 =
            Math.sin(x * r.frequency * 1.65 - t * 0.65 + 1.1) * (r.amplitude * 0.36);
          points.push([x, baseY + wave1 + wave2]);
        }

        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i][0] + points[i + 1][0]) * 0.5;
          const yc = (points[i][1] + points[i + 1][1]) * 0.5;
          ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last[0], last[1]);
        ctx.lineTo(width + step, height);
        ctx.lineTo(-step, height);
        ctx.closePath();

        const ribbonGrad = ctx.createLinearGradient(0, baseY - r.amplitude, 0, height);
        if (isDark) {
          ribbonGrad.addColorStop(0, `rgba(130, 184, 255, ${r.fillTopAlpha})`);
          ribbonGrad.addColorStop(0.4, `rgba(61, 115, 197, ${r.fillTopAlpha * 0.5})`);
          ribbonGrad.addColorStop(1, 'rgba(12, 20, 36, 0)');
        } else {
          ribbonGrad.addColorStop(0, `rgba(61, 115, 197, ${r.fillTopAlpha * 0.85})`);
          ribbonGrad.addColorStop(0.42, `rgba(130, 184, 255, ${r.fillTopAlpha * 0.55})`);
          ribbonGrad.addColorStop(1, 'rgba(245, 248, 253, 0)');
        }
        ctx.fillStyle = ribbonGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i][0] + points[i + 1][0]) * 0.5;
          const yc = (points[i][1] + points[i + 1][1]) * 0.5;
          ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
        }
        ctx.lineTo(last[0], last[1]);
        ctx.strokeStyle = isDark
          ? `rgba(130, 184, 255, ${r.crestAlpha})`
          : `rgba(40, 89, 182, ${r.crestAlpha * 0.65})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const tick = (now: number) => {
      if (hidden || reducedMotion) return;
      const elapsedSec = (now - startTime) * 0.001;
      drawFrame(elapsedSec);
      rafId = window.requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      hidden = document.hidden;
      if (!hidden && !reducedMotion) {
        startTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      } else if (hidden && rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      if (reducedMotion) {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        drawFrame(0);
      } else if (!hidden && !rafId) {
        startTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    resize();
    drawFrame(0);
    if (!reducedMotion && !hidden) {
      rafId = window.requestAnimationFrame(tick);
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery?.addEventListener?.('change', onMotionChange);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery?.removeEventListener?.('change', onMotionChange);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="ps3-wave-bg"
      className="fixed inset-0 z-0 pointer-events-none select-none"
    />
  );
}
