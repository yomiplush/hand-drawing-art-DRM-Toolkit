import { useEffect, useRef, useState } from 'react';

export interface UseDeckNavigationOptions {
  itemCount: number;
  focusedIndex: number;
  onFocusChange: (nextIndex: number) => void;
  onSelect: () => void;
  onBack: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onOpenSearch?: () => void;
  disabled?: boolean;
}

export interface DeckNavigationState {
  gamepadConnected: boolean;
  gamepadName: string | null;
}

const AXIS_DEADZONE = 0.55;
const REPEAT_DEBOUNCE_MS = 180;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Multi-input GalleryDeck navigation hook supporting full keyboard shortcuts
 * and Web Gamepad API polling (controllers & mapped left-hand artist keypads).
 */
export function useDeckNavigation(options: UseDeckNavigationOptions): DeckNavigationState {
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const opts = optionsRef.current;
      if (opts.disabled) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        opts.onBack();
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (event.key === '/' && opts.onOpenSearch) {
        event.preventDefault();
        opts.onOpenSearch();
        return;
      }

      if (opts.itemCount <= 0) return;

      switch (event.key) {
        case 'ArrowRight': {
          event.preventDefault();
          const next = Math.min(opts.itemCount - 1, opts.focusedIndex + 1);
          opts.onFocusChange(next);
          break;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          const prev = Math.max(0, opts.focusedIndex - 1);
          opts.onFocusChange(prev);
          break;
        }
        case 'ArrowUp': {
          if (opts.onPrevTab) {
            event.preventDefault();
            opts.onPrevTab();
          }
          break;
        }
        case 'ArrowDown': {
          if (opts.onNextTab) {
            event.preventDefault();
            opts.onNextTab();
          }
          break;
        }
        case 'Enter': {
          event.preventDefault();
          opts.onSelect();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Web Gamepad API polling
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }

    let rafId = 0;
    let lastDirAt = 0;
    const prevButtons = new Map<number, boolean>();

    const onConnected = (e: GamepadEvent) => setGamepadName(e.gamepad.id);
    const onDisconnected = () => setGamepadName(null);
    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);

    const poll = () => {
      const pads = navigator.getGamepads();
      const pad = pads.find((p): p is Gamepad => p !== null && p.connected);
      if (pad) {
        setGamepadName((prev) => (prev === pad.id ? prev : pad.id));
        const opts = optionsRef.current;
        if (!opts.disabled) {
          const now = performance.now();
          const pressed = (idx: number) => Boolean(pad.buttons[idx]?.pressed);
          const justPressed = (idx: number) => {
            const curr = pressed(idx);
            const was = prevButtons.get(idx) ?? false;
            prevButtons.set(idx, curr);
            return curr && !was;
          };

          // Standard Gamepad mapping: A=0, B=1, LB=4, RB=5, D-Up=12, D-Down=13, D-Left=14, D-Right=15
          if (justPressed(0) && opts.itemCount > 0) {
            opts.onSelect();
          } else if (justPressed(1)) {
            opts.onBack();
          } else if (justPressed(4) && opts.onPrevTab) {
            opts.onPrevTab();
          } else if (justPressed(5) && opts.onNextTab) {
            opts.onNextTab();
          }

          const axisX = pad.axes[0] ?? 0;
          const dirRight = pressed(15) || axisX > AXIS_DEADZONE;
          const dirLeft = pressed(14) || axisX < -AXIS_DEADZONE;

          if ((dirRight || dirLeft) && now - lastDirAt >= REPEAT_DEBOUNCE_MS && opts.itemCount > 0) {
            lastDirAt = now;
            if (dirRight) {
              opts.onFocusChange(Math.min(opts.itemCount - 1, opts.focusedIndex + 1));
            } else if (dirLeft) {
              opts.onFocusChange(Math.max(0, opts.focusedIndex - 1));
            }
          }
        }
      }
      rafId = window.requestAnimationFrame(poll);
    };

    rafId = window.requestAnimationFrame(poll);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('gamepaddisconnected', onDisconnected);
    };
  }, []);

  return {
    gamepadConnected: gamepadName !== null,
    gamepadName,
  };
}
