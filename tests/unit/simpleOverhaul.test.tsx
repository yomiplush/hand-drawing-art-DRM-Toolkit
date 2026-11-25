// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpTip } from '../../src/components/HelpTip';
import { SafeArtworkImage } from '../../src/components/SafeArtworkImage';
import {
  bytesToBase64,
  computeScaledPreviewDimensions,
  pngBytesToDataUrl,
} from '../../src/core/image/previewDataUrl';
import { ScannerBeam } from '../../src/components/motion/ScannerBeam';
import { SparkleBurst } from '../../src/components/motion/SparkleBurst';
import { StampCeremony } from '../../src/components/motion/StampCeremony';
import { PreferencesProvider } from '../../src/components/PreferencesContext';
import { getSampleSignedArtworkFile } from '../../src/core/demo/sampleArtwork';
import { ensureLocalSigningKey, listAuthorKeys } from '../../src/core/storage/keyStore';
import { SUPPORTED_LOCALES } from '../../src/core/storage/consent';
import { verifyImageWithEmbeddedQr } from '../../src/core/verify/verifier';
import { SIMPLE_I18N } from '../../src/i18n/simple';
import {
  UI_MODE_STORAGE_KEY,
  detectInitialLang,
  getUiMode,
  setUiMode,
} from '../../src/state/uiPreferences';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

describe('Simple/Advanced Dual-Mode UX Overhaul core & components', () => {
  const originalIdb = globalThis.indexedDB;
  const originalLangDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIdb,
    });
    if (originalLangDescriptor) {
      Object.defineProperty(Navigator.prototype, 'language', originalLangDescriptor);
    }
    window.history.replaceState({}, '', '/');
  });

  it('uiPreferences defaults to simple mode and persists mode switches cleanly', () => {
    expect(getUiMode()).toBe('simple');
    setUiMode('advanced');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('advanced');
    expect(getUiMode()).toBe('advanced');
    setUiMode('simple');
    expect(getUiMode()).toBe('simple');
  });

  it('detectInitialLang resolves ?hl= override, browser Japanese, and English fallback', () => {
    Object.defineProperty(Navigator.prototype, 'language', {
      configurable: true,
      get: () => 'ja-JP',
    });
    expect(detectInitialLang()).toBe('ja');

    Object.defineProperty(Navigator.prototype, 'language', {
      configurable: true,
      get: () => 'sv-SE',
    });
    expect(detectInitialLang()).toBe('en');

    window.history.replaceState({}, '', '/?hl=ko');
    expect(detectInitialLang()).toBe('ko');
  });

  it('SIMPLE_I18N covers all 13 supported languages completely without raw empty values', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const entry = SIMPLE_I18N[locale];
      expect(entry).toBeDefined();
      expect(entry.mode.simpleLabel.trim().length).toBeGreaterThan(0);
      expect(entry.mode.advancedLabel.trim().length).toBeGreaterThan(0);
      expect(entry.home.headline.trim().length).toBeGreaterThan(3);
      expect(entry.home.localOnlyBadge.trim().length).toBeGreaterThan(3);
      expect(entry.home.localOnlyTipText.trim().length).toBeGreaterThan(10);
      expect(entry.create.step3Cta.trim().length).toBeGreaterThan(2);
      expect(entry.create.backupTipText.trim().length).toBeGreaterThan(10);
      expect(entry.verify.verdictPassTitle.trim().length).toBeGreaterThan(3);
      expect(entry.verify.verdictSnsTitle.trim().length).toBeGreaterThan(3);
      expect(entry.verify.verdictWarnTitle.trim().length).toBeGreaterThan(3);
      expect(entry.advancedTips.ed25519Text.trim().length).toBeGreaterThan(10);
    }
    expect(SIMPLE_I18N.ja.home.headline).not.toBe(SIMPLE_I18N.en.home.headline);
  });

  it('ensureLocalSigningKey silently creates one keypair on first call and reuses it idempotently', async () => {
    const backend = new InMemoryIdbBackend();
    const { factory } = createInMemoryIndexedDb(backend);
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: factory,
    });

    expect(await listAuthorKeys()).toHaveLength(0);
    const first = await ensureLocalSigningKey({
      label: 'Test Kid Artist',
      backupPassphrase: 'fallback-test-passphrase',
    });
    expect(first.id).toBeTruthy();
    expect(first.label).toBe('Test Kid Artist');
    expect(first.publicKey).toHaveLength(32);

    const second = await ensureLocalSigningKey({
      label: 'Should Not Overwrite',
      backupPassphrase: 'fallback-test-passphrase',
    });
    expect(second.id).toBe(first.id);
    expect(await listAuthorKeys()).toHaveLength(1);
  });

  it('getSampleSignedArtworkFile generates a valid offline signed PNG verified by the core engine', async () => {
    const sampleFile = await getSampleSignedArtworkFile('ja');
    expect(sampleFile.name).toBe('sample-artwork.certified-handmade.png');
    expect(sampleFile.type).toBe('image/png');

    const result = await verifyImageWithEmbeddedQr({ fileOrBytes: sampleFile });
    expect(result.verification.signatureStatus).toBe('valid');
    expect(result.verification.integrityStatus).toBe('matched');
    expect(result.verification.manifest?.artworkTitle).toContain('サンプル');
  });

  it('HelpTip toggles open/closed, dismisses on Escape with focus restoration, and closes on outside pointerdown', () => {
    render(
      <div>
        <button type="button" data-testid="outside-target">
          Outside
        </button>
        <HelpTip
          text="Runs locally on your device."
          label="Local check"
          testId="tip-btn"
          panelTestId="tip-panel"
        />
      </div>,
    );

    const trigger = screen.getByTestId('tip-btn');
    const panel = screen.getByTestId('tip-panel');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.getAttribute('data-open')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.getAttribute('data-open')).toBe('true');
    expect(panel.textContent).toContain('Runs locally on your device.');

    // Escape closes and returns focus to trigger
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.getAttribute('data-open')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    // Outside pointerdown closes when open
    fireEvent.click(trigger);
    expect(panel.getAttribute('data-open')).toBe('true');
    fireEvent.pointerDown(screen.getByTestId('outside-target'));
    expect(panel.getAttribute('data-open')).toBe('false');
  });

  it('StampCeremony, SparkleBurst, and ScannerBeam render overlays cleanly and respect prefers-reduced-motion', () => {
    const { container, rerender } = render(
      <PreferencesProvider>
        <StampCeremony active badgeText="SEALED">
          <div data-testid="art-child">Art Canvas</div>
        </StampCeremony>
        <SparkleBurst active testId="standalone-sparkles" />
        <ScannerBeam scanning label="Scanning..." testId="scanner-box">
          <div data-testid="verify-child">Preview</div>
        </ScannerBeam>
      </PreferencesProvider>,
    );

    expect(screen.getByTestId('stamp-ceremony-overlay')).toBeTruthy();
    expect(screen.getByTestId('standalone-sparkles')).toBeTruthy();
    expect(container.querySelectorAll('.chm-sparkle-particle').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByTestId('scanner-beam-overlay')).toBeTruthy();
    expect(container.querySelector('.chm-scanner-sweep')).toBeTruthy();

    rerender(
      <PreferencesProvider>
        <StampCeremony active={false} badgeText="SEALED">
          <div data-testid="art-child">Art Canvas</div>
        </StampCeremony>
        <SparkleBurst active={false} testId="standalone-sparkles" />
        <ScannerBeam scanning={false} label="Scanning..." testId="scanner-box">
          <div data-testid="verify-child">Preview</div>
        </ScannerBeam>
      </PreferencesProvider>,
    );

    expect(screen.queryByTestId('stamp-ceremony-overlay')).toBeNull();
    expect(screen.queryByTestId('standalone-sparkles')).toBeNull();
    expect(screen.queryByTestId('scanner-beam-overlay')).toBeNull();

    cleanup();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const reduced = render(
      <PreferencesProvider>
        <StampCeremony active badgeText="SEALED">
          <div data-testid="art-child-rm">Art Canvas</div>
        </StampCeremony>
        <SparkleBurst active testId="rm-sparkles" />
        <ScannerBeam scanning label="Scanning..." testId="rm-scanner-box">
          <div data-testid="verify-child-rm">Preview</div>
        </ScannerBeam>
      </PreferencesProvider>,
    );

    expect(screen.queryByTestId('stamp-ceremony-overlay')).toBeNull();
    expect(screen.queryByTestId('rm-sparkles')).toBeNull();
    expect(screen.getByTestId('scanner-beam-overlay')).toBeTruthy();
    expect(reduced.container.querySelector('.chm-scanner-sweep')).toBeNull();
  });

  it('SafeArtworkImage renders immutable data:image/png URLs (never blob:) and falls back to canvas on image error', () => {
    const sampleBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytesToBase64(sampleBytes)).toBe('iVBORw0KGgo=');
    expect(pngBytesToDataUrl(sampleBytes)).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(computeScaledPreviewDimensions(4000, 2000, 960)).toEqual({ width: 960, height: 480 });

    const raster = {
      width: 4,
      height: 4,
      data: new Uint8Array(4 * 4 * 4).fill(200),
    };

    render(
      <SafeArtworkImage
        pngBytes={sampleBytes}
        raster={raster}
        alt="Signed illustration"
        testId="safe-img"
      />,
    );

    const imgEl = screen.getByTestId('safe-img');
    expect(imgEl.tagName).toBe('IMG');
    expect(imgEl.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(imgEl.getAttribute('src')).not.toContain('blob:');

    // Simulate WebKit/Safari image error -> switches to <canvas role="img"> without throwing
    fireEvent.error(imgEl);
    const canvasEl = screen.getByTestId('safe-img');
    expect(canvasEl.tagName).toBe('CANVAS');
    expect(canvasEl.getAttribute('role')).toBe('img');
    expect(canvasEl.getAttribute('aria-label')).toBe('Signed illustration');
  });
});
