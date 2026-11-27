import { describe, expect, it } from 'vitest';
import { getNativeProjectAcceptAttr, NATIVE_PROJECT_ACCEPT } from '../../src/core/parsers';

describe('getNativeProjectAcceptAttr (cross-platform file picker compatibility)', () => {
  it('omits accept on iPadOS Safari (desktop-mode MacIntel + touch)', () => {
    expect(
      getNativeProjectAcceptAttr({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBeUndefined();
  });

  it('omits accept on iOS Safari (iPhone)', () => {
    expect(
      getNativeProjectAcceptAttr({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBeUndefined();
  });

  it('omits accept on Android Chrome', () => {
    expect(
      getNativeProjectAcceptAttr({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBeUndefined();
  });

  it('omits accept on macOS Safari so NSOpenPanel does not grey out unregistered UTIs (.clip/.procreate/.kra/.psd)', () => {
    expect(
      getNativeProjectAcceptAttr({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBeUndefined();
  });

  it('keeps extension filter on Windows Chrome/Edge and Linux Chrome', () => {
    expect(
      getNativeProjectAcceptAttr({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        platform: 'Win32',
        maxTouchPoints: 0,
      }),
    ).toBe(NATIVE_PROJECT_ACCEPT);

    expect(
      getNativeProjectAcceptAttr({
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        platform: 'Linux x86_64',
        maxTouchPoints: 0,
      }),
    ).toBe(NATIVE_PROJECT_ACCEPT);
  });
});
