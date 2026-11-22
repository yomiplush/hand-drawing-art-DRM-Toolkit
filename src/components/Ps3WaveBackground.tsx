import { useEffect, useRef } from 'react';

interface RibbonConfig {
  yRatio: number;
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  crestAlpha: number;
  fillTopAlpha: number;
  fillBottomAlpha: number;
}

const RIBBONS: RibbonConfig[] = [
  {
    yRatio: 0.48,
    amplitude: 52,
    frequency: 0.0021,
    speed: 0.22,
    phase: 0.0,
    crestAlpha: 0.2,
    fillTopAlpha: 0.12,
    fillBottomAlpha: 0.0,
  },
  {
    yRatio: 0.54,
    amplitude: 64,
    frequency: 0.0017,
    speed: -0.16,
    phase: 1.7,
    crestAlpha: 0.26,
    fillTopAlpha: 0.15,
    fillBottomAlpha: 0.0,
  },
  {
    yRatio: 0.61,
    amplitude: 44,
    frequency: 0.0026,
    speed: 0.13,
    phase: 3.4,
    crestAlpha: 0.16,
    fillTopAlpha: 0.09,
    fillBottomAlpha: 0.0,
  },
  {
    yRatio: 0.69,
    amplitude: 38,
    frequency: 0.0019,
    speed: -0.1,
    phase: 5.1,
    crestAlpha: 0.12,
    fillTopAlpha: 0.07,
    fillBottomAlpha: 0.0,
  },
];

interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

function createMotes(count: number, width: number, height: number): DustMote[] {
  const motes: DustMote[] = [];
  for (let i = 0; i < count; i++) {
    motes.push({
      x: Math.random() * width,
      y: height * (0.25 + Math.random() * 0.65),
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.04 - Math.random() * 0.09,
      r: 0.8 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return motes;
}

export function Ps3WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let motes = createMotes(26, width, height);
    let rafId = 0;
    let startTime = performance.now();
    let hidden = typeof document !== 'undefined' && document.hidden;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = createMotes(26, width, height);
    };

    const drawFrame = (elapsedSec: number) => {
      // Deep nocturnal XMB gradient backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#020813');
      bg.addColorStop(0.45, '#041226');
      bg.addColorStop(0.82, '#061d38');
      bg.addColorStop(1, '#030c1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric glow behind wave horizon
      const glow = ctx.createRadialGradient(
        width * 0.52,
        height * 0.56,
        20,
        width * 0.52,
        height * 0.56,
        Math.max(width, height) * 0.65,
      );
      glow.addColorStop(0, 'rgba(56, 165, 232, 0.16)');
      glow.addColorStop(0.5, 'rgba(14, 78, 138, 0.07)');
      glow.addColorStop(1, 'rgba(2, 8, 19, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const step = Math.max(12, Math.floor(width / 72));

      for (const r of RIBBONS) {
        const baseY = height * r.yRatio;
        const points: Array<[number, number]> = [];

        for (let x = -step; x <= width + step; x += step) {
          const t = elapsedSec * r.speed + r.phase;
          const wave1 = Math.sin(x * r.frequency + t) * r.amplitude;
          const wave2 =
            Math.sin(x * r.frequency * 1.85 - t * 0.72 + 1.1) * (r.amplitude * 0.42);
          const wave3 = Math.cos(x * r.frequency * 0.62 + t * 0.38) * (r.amplitude * 0.28);
          points.push([x, baseY + wave1 + wave2 + wave3]);
        }

        // Translucent silk ribbon fill
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
        ribbonGrad.addColorStop(0, `rgba(147, 217, 253, ${r.fillTopAlpha})`);
        ribbonGrad.addColorStop(0.32, `rgba(14, 116, 184, ${r.fillTopAlpha * 0.45})`);
        ribbonGrad.addColorStop(1, `rgba(3, 12, 26, ${r.fillBottomAlpha})`);
        ctx.fillStyle = ribbonGrad;
        ctx.fill();

        // Delicate luminous silk crest
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i][0] + points[i + 1][0]) * 0.5;
          const yc = (points[i][1] + points[i + 1][1]) * 0.5;
          ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
        }
        ctx.lineTo(last[0], last[1]);
        ctx.strokeStyle = `rgba(219, 240, 255, ${r.crestAlpha})`;
        ctx.lineWidth = 1.15;
        ctx.stroke();
      }

      // Quiet floating XMB dust motes
      for (const m of motes) {
        if (!reducedMotion) {
          m.x += m.vx;
          m.y += m.vy;
          if (m.y < height * 0.15) m.y = height * 0.92;
          if (m.x < -10) m.x = width + 10;
          if (m.x > width + 10) m.x = -10;
        }
        const pulse = 0.16 + 0.16 * Math.sin(elapsedSec * 0.9 + m.phase);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 242, 254, ${pulse.toFixed(3)})`;
        ctx.fill();
      }
    };

    const tick = (now: number) => {
      if (hidden) return;
      const elapsedSec = (now - startTime) * 0.001;
      drawFrame(elapsedSec);
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onVisibility = () => {
      hidden = document.hidden;
      if (!hidden && !reducedMotion) {
        startTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      } else if (hidden && rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };

    resize();
    drawFrame(0);
    if (!reducedMotion && !hidden) {
      rafId = window.requestAnimationFrame(tick);
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="ps3-wave-bg"
      className="fixed inset-0 z-0 pointer-events-none select-none"
    />
  );
}
