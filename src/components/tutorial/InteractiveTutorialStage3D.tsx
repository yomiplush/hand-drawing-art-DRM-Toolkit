import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, KeyRound, Move3d, QrCode, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';
import { useReducedMotion } from '../../state/uiPreferences';

interface InteractiveTutorialStage3DProps {
  stepIndex: number;
  dragHint: string;
}

interface StepPose {
  rx: number;
  ry: number;
}

const STEP_POSES: readonly StepPose[] = [
  { rx: 6, ry: -10 },
  { rx: 10, ry: 18 },
  { rx: -6, ry: -18 },
  { rx: 8, ry: 22 },
];

const MAX_TILT_X = 34;
const MAX_TILT_Y = 44;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function InteractiveTutorialStage3D({
  stepIndex,
  dragHint,
}: InteractiveTutorialStage3DProps) {
  const reducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const pose = STEP_POSES[stepIndex] ?? STEP_POSES[0];
  const physicsRef = useRef({
    rx: pose.rx,
    ry: pose.ry,
    vx: 0,
    vy: 0,
    targetRx: pose.rx,
    targetRy: pose.ry,
    dragging: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    const nextPose = STEP_POSES[stepIndex] ?? STEP_POSES[0];
    physicsRef.current.targetRx = nextPose.rx;
    physicsRef.current.targetRy = nextPose.ry;
    if (reducedMotion && cardRef.current) {
      physicsRef.current.rx = nextPose.rx;
      physicsRef.current.ry = nextPose.ry;
      cardRef.current.style.transform = `rotateX(${nextPose.rx.toFixed(2)}deg) rotateY(${nextPose.ry.toFixed(2)}deg)`;
    }
  }, [stepIndex, reducedMotion]);

  useEffect(() => {
    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const p = physicsRef.current;
      const elapsed = (now - startTime) * 0.001;

      if (!p.dragging) {
        const idleRx = reducedMotion ? 0 : Math.sin(elapsed * 1.15) * 3.2;
        const idleRy = reducedMotion ? 0 : Math.cos(elapsed * 0.85) * 5.2;
        const goalRx = p.targetRx + idleRx;
        const goalRy = p.targetRy + idleRy;

        // Critically-damped spring return with subtle inertia
        const stiffness = reducedMotion ? 0.22 : 0.095;
        const damping = reducedMotion ? 0.65 : 0.78;
        p.vx = (p.vx + (goalRx - p.rx) * stiffness) * damping;
        p.vy = (p.vy + (goalRy - p.ry) * stiffness) * damping;
        p.rx += p.vx;
        p.ry += p.vy;
      }

      const floatY = reducedMotion || p.dragging ? 0 : Math.sin(elapsed * 1.6) * 4.5;

      if (cardRef.current) {
        cardRef.current.style.transform = `translate3d(0, ${floatY.toFixed(2)}px, 0) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg)`;
      }

      if (glareRef.current) {
        const gx = clamp(50 + p.ry * 1.4, 10, 90);
        const gy = clamp(50 - p.rx * 1.6, 10, 90);
        glareRef.current.style.background = `radial-gradient(circle at ${gx.toFixed(1)}% ${gy.toFixed(1)}%, rgba(255, 255, 255, 0.36) 0%, rgba(125, 211, 252, 0.12) 34%, transparent 72%)`;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physicsRef.current;
    p.dragging = true;
    p.pointerId = e.pointerId;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    p.vx = 0;
    p.vy = 0;
    setIsDragging(true);
    setHasInteracted(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events in tests without active pointer capture
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physicsRef.current;
    if (!p.dragging || p.pointerId !== e.pointerId) return;
    const dx = e.clientX - p.lastX;
    const dy = e.clientY - p.lastY;
    p.lastX = e.clientX;
    p.lastY = e.clientY;

    p.ry = clamp(p.ry + dx * 0.48, -MAX_TILT_Y, MAX_TILT_Y);
    p.rx = clamp(p.rx - dy * 0.42, -MAX_TILT_X, MAX_TILT_X);
    p.vy = dx * 0.16;
    p.vx = -dy * 0.14;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physicsRef.current;
    if (!p.dragging || p.pointerId !== e.pointerId) return;
    p.dragging = false;
    p.pointerId = -1;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }
  };

  return (
    <div
      data-testid="tutorial-3d-stage"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ touchAction: 'none' }}
      className={`chm-3d-stage relative flex flex-col items-center justify-center w-full h-[250px] sm:h-[300px] select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Ambient aura behind the 3D artwork card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-6 bottom-8 rounded-full blur-3xl transition-colors duration-500"
        style={{
          background:
            stepIndex === 1
              ? 'radial-gradient(circle, rgba(245, 158, 11, 0.24) 0%, rgba(56, 189, 248, 0.12) 55%, transparent 75%)'
              : stepIndex === 3
                ? 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(56, 189, 248, 0.12) 55%, transparent 75%)'
                : 'radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(37, 99, 235, 0.14) 55%, transparent 75%)',
        }}
      />

      {/* 3D Rotatable Art Card Assembly */}
      <div
        ref={cardRef}
        data-testid="tutorial-3d-card"
        className="chm-3d-preserve relative w-[228px] h-[162px] sm:w-[276px] sm:h-[192px] will-change-transform"
      >
        {/* Base Layer: Hand-drawn Illustration Canvas Card */}
        <div
          className="absolute inset-0 rounded-2xl border border-sky-300/40 bg-gradient-to-br from-[#0f2952] via-[#133569] to-[#081a38] shadow-[0_24px_48px_-14px_rgba(3,12,30,0.75)] overflow-hidden"
          style={{ transform: 'translateZ(0px)' }}
        >
          {/* Stylized Hand-Drawn Landscape Vector Art */}
          <svg
            viewBox="0 0 280 192"
            fill="none"
            aria-hidden="true"
            className="w-full h-full opacity-95"
          >
            <defs>
              <linearGradient id="tut-sky" x1="0" y1="0" x2="280" y2="192" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.48" />
                <stop offset="55%" stopColor="#0EA5E9" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0F172A" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="tut-stroke" x1="20" y1="30" x2="250" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#BAE6FD" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
            <rect width="280" height="192" fill="url(#tut-sky)" />
            {/* Subtle paper grid */}
            <path
              d="M0 48H280M0 96H280M0 144H280M70 0V192M140 0V192M210 0V192"
              stroke="rgba(186,230,253,0.09)"
              strokeWidth="1"
            />
            {/* Hand-drawn hills & crescent */}
            <circle cx="216" cy="46" r="18" fill="#E0F2FE" fillOpacity="0.92" />
            <circle cx="224" cy="42" r="16" fill="#133569" />
            <path
              d="M12 146C52 104 94 114 134 132C176 150 218 96 268 122V192H12V146Z"
              fill="#0B2246"
              fillOpacity="0.85"
            />
            <path
              d="M16 144C54 106 94 116 134 132C176 148 218 98 266 122"
              stroke="url(#tut-stroke)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M36 74C58 58 84 62 104 76"
              stroke="#BAE6FD"
              strokeOpacity="0.7"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="52" cy="44" r="2.2" fill="#BAE6FD" />
            <circle cx="152" cy="34" r="1.8" fill="#7DD3FC" />
            <circle cx="118" cy="58" r="1.5" fill="#E0F2FE" />
          </svg>

          {/* Dynamic holographic glare */}
          <div
            ref={glareRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          />

          {/* Canvas footer bar */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3.5 py-2 bg-[#041126]/70 backdrop-blur-sm border-t border-sky-300/20 text-[10px] font-mono text-sky-100/90">
            <span>artwork_01.png</span>
            <span className="text-sky-300">Certified Handmade</span>
          </div>
        </div>

        {/* Step 0 Floating Layer: 100% Local & Offline Shield */}
        <div
          aria-hidden={stepIndex !== 0}
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            stepIndex === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
          style={{ transform: 'translateZ(42px)' }}
        >
          <div className="rounded-2xl border border-sky-300/45 bg-[#071e3f]/90 backdrop-blur-md px-4 py-3 shadow-[0_16px_34px_rgba(2,12,30,0.6)] flex items-center gap-3 text-sky-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/20 border border-sky-300/40 text-sky-200">
              <WifiOff className="h-5 w-5" />
            </div>
            <div className="text-start">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-300">
                100% LOCAL
              </div>
              <div className="text-xs font-semibold">Browser-Only Engine</div>
            </div>
          </div>
        </div>

        {/* Step 1 Floating Layer: Ed25519 Local Key Card */}
        <div
          aria-hidden={stepIndex !== 1}
          className={`pointer-events-none absolute -top-3 -start-3 sm:-start-5 transition-all duration-500 ${
            stepIndex === 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-90'
          }`}
          style={{ transform: 'translateZ(54px)' }}
        >
          <div className="rounded-2xl border border-amber-300/55 bg-gradient-to-br from-[#1f1a0a]/95 to-[#0b1c36]/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_18px_36px_rgba(2,12,30,0.65)] flex items-center gap-2.5 text-amber-50">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 border border-amber-300/40 text-amber-300">
              <KeyRound className="h-4.5 w-4.5" />
            </div>
            <div className="text-start">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                Ed25519 KEY
              </div>
              <div className="text-xs font-semibold">My Artist Stamp</div>
            </div>
          </div>
        </div>

        <div
          aria-hidden={stepIndex !== 1}
          className={`pointer-events-none absolute -bottom-3 -end-2 transition-all duration-500 ${
            stepIndex === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
          style={{ transform: 'translateZ(36px)' }}
        >
          <div className="rounded-full border border-sky-300/40 bg-[#071c3a]/92 px-3 py-1 text-[10px] font-mono text-sky-200 shadow-lg">
            .chkey.json Backup
          </div>
        </div>

        {/* Step 2 Floating Layer: QR Certificate & Simple Mode Stamp */}
        <div
          aria-hidden={stepIndex !== 2}
          className={`pointer-events-none absolute -bottom-4 -end-3 sm:-end-5 transition-all duration-500 ${
            stepIndex === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-85'
          }`}
          style={{ transform: 'translateZ(58px)' }}
        >
          <div className="rounded-2xl border border-sky-300/60 bg-white p-2.5 shadow-[0_20px_40px_rgba(2,12,30,0.65)] flex items-center gap-2.5 text-slate-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
              <QrCode className="h-8 w-8" />
            </div>
            <div className="pe-1 text-start">
              <div className="text-[10px] font-mono font-bold text-sky-700">SIMPLE MODE</div>
              <div className="text-xs font-bold leading-tight">QR Proof Burned</div>
            </div>
          </div>
        </div>

        <div
          aria-hidden={stepIndex !== 2}
          className={`pointer-events-none absolute -top-3 -start-2 transition-all duration-500 ${
            stepIndex === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
          style={{ transform: 'translateZ(34px)' }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/50 bg-[#0a2550]/95 px-3 py-1 text-[11px] font-semibold text-sky-100 shadow-lg">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            <span>SHA-256 Sealed</span>
          </div>
        </div>

        {/* Step 3 Floating Layer: Offline Verified Badge */}
        <div
          aria-hidden={stepIndex !== 3}
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            stepIndex === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-85'
          }`}
          style={{ transform: 'translateZ(62px)' }}
        >
          <div className="rounded-2xl border border-emerald-300/60 bg-gradient-to-br from-[#063829]/95 to-[#062135]/95 backdrop-blur-md px-4 py-3 shadow-[0_22px_44px_rgba(2,12,30,0.7)] flex items-center gap-3 text-emerald-50">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/20 border border-emerald-300/50 text-emerald-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="text-start">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                <span>VERIFIED OFFLINE</span>
              </div>
              <div className="text-xs font-semibold">Signature & Pixels Match</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Drag Affordance Pill */}
      <div
        data-testid="tutorial-3d-drag-hint"
        className={`mt-4 inline-flex items-center gap-1.5 rounded-full border ga-border bg-[var(--ga-surface)] px-3 py-1 text-[11px] font-medium ga-text-secondary transition-opacity duration-300 ${
          hasInteracted ? 'opacity-65' : 'opacity-100'
        }`}
      >
        <Move3d className="h-3.5 w-3.5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
        <span>{dragHint}</span>
      </div>
    </div>
  );
}
