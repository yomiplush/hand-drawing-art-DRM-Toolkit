import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { decode as decodePng, encode as encodePng } from 'fast-png';

function buildTestPng(width = 180, height = 140): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 9 + y * 3) & 0xff;
      data[i + 1] = (x * 4 + y * 11) & 0xff;
      data[i + 2] = (x * 13 + y * 5) & 0xff;
      data[i + 3] = 255;
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

test.describe('Dual-Mode UX Overhaul, Progressive HelpTips & Tactile Flows', () => {
  test('first-time Simple Mode signing without pre-created keys, StampCeremony, QR style switch, and post-sign .chkey.json backup', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    await page.getByTestId('home-cta-create').click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByTestId('create-auto-key-info')).toBeVisible();

    const artPath = testInfo.outputPath('kid-drawing.png');
    fs.writeFileSync(artPath, buildTestPng(200, 160));
    await page.getByTestId('create-image-input').setInputFiles(artPath);

    await page.getByTestId('create-author-input').fill('Sakura Kid');
    await page.getByTestId('create-title-input').fill('Sunny Sky');

    // Toggle Simple QR style tip + switch between Outer Frame and In-Image Stamp
    await page.getByTestId('create-qr-style-tip-btn').click();
    await expect(page.getByTestId('create-qr-style-tip-panel')).toHaveAttribute('data-open', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('create-qr-style-tip-panel')).toHaveAttribute('data-open', 'false');

    await page.getByTestId('create-simple-style-inside').click();
    await expect(page.getByTestId('create-inside-live-preview')).toBeVisible();
    await page.getByTestId('create-simple-style-outer').click();
    await expect(page.getByTestId('create-outer-live-preview')).toBeVisible();

    // Sign seamlessly -> triggers auto keygen + StampCeremony + automatic PNG download
    const signedDlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    await expect(page.getByTestId('create-result-section')).toBeVisible();
    await expect(page.getByTestId('stamp-ceremony-overlay')).toBeVisible();
    const signedDl = await signedDlPromise;
    expect(signedDl.suggestedFilename()).toContain('.certified-handmade.png');

    // Post-sign .chkey.json recovery key reminder card + HelpTip
    await expect(page.getByTestId('create-post-backup-card')).toBeVisible();
    await page.getByTestId('create-backup-tip-btn').click();
    await expect(page.getByTestId('create-backup-tip-panel')).toHaveAttribute('data-open', 'true');

    // Validation when passphrase < 8 chars, then successful recovery key creation & download
    await page.getByTestId('create-post-backup-pass').fill('short');
    await page.getByTestId('create-post-backup-create-btn').click();
    await expect(page.getByTestId('create-post-backup-card')).toContainText('8');

    const keyDlPromise = page.waitForEvent('download');
    await page.getByTestId('create-post-backup-pass').fill('sakura-backup-key-2026');
    await page.getByTestId('create-post-backup-create-btn').click();
    const keyDl = await keyDlPromise;
    expect(keyDl.suggestedFilename()).toContain('.chkey.json');
    await expect(page.getByTestId('create-post-backup-saved')).toBeVisible();

    // Reload and confirm Artist Name convenience memory works in localStorage
    await page.reload();
    await expect(page.getByTestId('create-author-input')).toHaveValue('Sakura Kid');

    // Check Advanced Cockpit Ribbon shows live auto-created key metadata
    await page.getByTestId('header-mode-toggle-advanced').click();
    await expect(page.getByTestId('advanced-status-ribbon')).toBeVisible();
    await expect(page.getByTestId('ribbon-key-count')).toContainText('2');
  });

  test('1-click Sample verification from Landing (/verify?demo=sample), ScannerBeam, Pass verdict, and HelpTip mobile safety', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    await expect(page.getByTestId('home-magic-seal')).toBeVisible();

    // Open local-only HelpTip on 360px viewport and verify zero horizontal overflow
    await page.getByTestId('home-local-tip-btn').click();
    await expect(page.getByTestId('home-local-tip-panel')).toHaveAttribute('data-open', 'true');
    const overflowOnHome = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowOnHome).toBeLessThanOrEqual(1);

    // Outside click closes HelpTip
    await page.getByTestId('home-tagline').click();
    await expect(page.getByTestId('home-local-tip-panel')).toHaveAttribute('data-open', 'false');

    // Launch 1-click Sample Demo -> sweeps ScannerBeam -> displays Pass Verdict + metadata pills
    await page.getByTestId('home-sample-demo-link').click();
    await expect(page).toHaveURL(/\/verify\?demo=sample/);
    await expect(page.getByTestId('verify-simple-verdict')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict', 'pass');
    await expect(page.getByTestId('verify-simple-meta-pills')).toContainText('Demo Illustrator');
    await expect(page.getByTestId('verify-simple-meta-pills')).toContainText('CC-BY-NC-4.0');

    await page.getByTestId('verify-verdict-tip-btn').click();
    await expect(page.getByTestId('verify-verdict-tip-panel')).toHaveAttribute('data-open', 'true');
    const overflowOnVerify = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowOnVerify).toBeLessThanOrEqual(1);
  });

  test('Dual-Mode pill persists across reloads & Japanese browser locale auto-detects cleanly without bilingual DOM blocks', async ({
    browser,
  }, testInfo) => {
    const jaContext = await browser.newContext({ locale: 'ja-JP' });
    const page = await jaContext.newPage();

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByTestId('home-tagline')).toContainText('大切な絵に、あなたの証を。');
    await expect(page.getByTestId('header-mode-toggle-simple')).toHaveAttribute('aria-pressed', 'true');

    // Ensure no mixed English/Japanese jargon leaks in Simple Mode home
    const mainText = await page.locator('main').innerText();
    expect(mainText).not.toContain('Ed25519');
    expect(mainText).not.toContain('Your art. Your proof.');

    // Toggle to Advanced Mode -> reload -> remains in Advanced Mode
    await page.getByTestId('header-mode-toggle-advanced').click();
    await expect(page.getByTestId('advanced-cockpit-bar')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('header-mode-toggle-advanced')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('advanced-cockpit-bar')).toBeVisible();
    await expect(page.getByTestId('home-advanced-page')).toBeVisible();

    // Verify Advanced /spec route works cleanly
    await page.getByTestId('cockpit-spec-link').click();
    await expect(page).toHaveURL(/\/spec$/);
    await expect(page.getByTestId('docs-standalone-section')).toBeVisible();

    // Check uncertified warn verdict in Simple Mode
    await page.getByTestId('header-mode-toggle-simple').click();
    await page.goto('/verify');
    const plainPath = testInfo.outputPath('plain-drawing.png');
    const rawPng = buildTestPng(120, 90);
    const decoded = decodePng(rawPng);
    fs.writeFileSync(plainPath, Buffer.from(encodePng(decoded)));

    await page.getByTestId('verify-image-input').setInputFiles(plainPath);
    await expect(page.getByTestId('verify-simple-verdict')).toBeVisible();
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict', 'no-seal');

    await jaContext.close();
  });

  test('iPad Japanese viewport: tapping 作品の内側 stays in-page preserving inputs and renders non-blob previews cleanly', async ({
    browser,
  }, testInfo) => {
    const ipadContext = await browser.newContext({
      locale: 'ja-JP',
      viewport: { width: 820, height: 1180 },
      hasTouch: true,
    });
    const page = await ipadContext.newPage();

    await page.goto('/create');
    await page.getByTestId('cookie-reject-btn').click();

    const artPath = testInfo.outputPath('ipad-drawing.png');
    fs.writeFileSync(artPath, buildTestPng(360, 280));
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await page.getByTestId('create-author-input').fill('ハルカ');
    await page.getByTestId('create-title-input').fill('青空スケッチ');

    // Simple Mode: toggle to 絵の中にQR -> stays strictly on /create & keeps all inputs + image preview intact
    await page.getByTestId('create-simple-style-inside').click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByTestId('create-author-input')).toHaveValue('ハルカ');
    await expect(page.getByTestId('create-title-input')).toHaveValue('青空スケッチ');
    await expect(page.getByTestId('create-inside-live-preview')).toBeVisible();

    // Switch to Advanced Mode and tap 作品の内側 -> must stay on /create and keep all inputs & canvas studio
    await page.getByTestId('header-mode-toggle-advanced').click();
    await expect(page.getByTestId('create-mode-studio')).toContainText('作品の内側');
    await page.getByTestId('create-mode-studio').click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByTestId('create-mode-studio')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('create-author-input')).toHaveValue('ハルカ');
    await expect(page.getByTestId('create-title-input')).toHaveValue('青空スケッチ');
    await expect(page.getByTestId('qrstudio-preview-canvas')).toBeVisible();

    // Ensure zero broken <img> or blob: URLs exist on /create
    const createImgs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).map((img) => ({
        src: img.getAttribute('src') || '',
        complete: img.complete,
        naturalWidth: img.naturalWidth,
      })),
    );
    expect(createImgs.length).toBeGreaterThan(0);
    for (const img of createImgs) {
      expect(img.src.startsWith('blob:')).toBe(false);
      expect(img.complete).toBe(true);
      expect(img.naturalWidth).toBeGreaterThan(0);
    }

    // Sign in-image PNG and verify Step 3 preview + /verify preview render without blob: URLs
    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const dl = await dlPromise;
    await expect(page.getByTestId('create-signed-preview')).toBeVisible();
    const signedImgOk = await page.getByTestId('create-signed-preview').evaluate((el) => {
      if (el instanceof HTMLImageElement) {
        return !el.src.startsWith('blob:') && el.complete && el.naturalWidth > 0;
      }
      return el instanceof HTMLCanvasElement && el.width > 0 && el.height > 0;
    });
    expect(signedImgOk).toBe(true);

    const signedPath = testInfo.outputPath('ipad-signed.png');
    await dl.saveAs(signedPath);
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(signedPath);
    await expect(page.getByTestId('verify-attached-preview')).toBeVisible();
    const verifyImgOk = await page.getByTestId('verify-attached-preview').evaluate((el) => {
      if (el instanceof HTMLImageElement) {
        return !el.src.startsWith('blob:') && el.complete && el.naturalWidth > 0;
      }
      return el instanceof HTMLCanvasElement && el.width > 0 && el.height > 0;
    });
    expect(verifyImgOk).toBe(true);
    await expect(page.getByTestId('status-signature')).toBeVisible();

    await ipadContext.close();
  });

  test('large (>1200px) canvas clicking 作品の内側 / 絵の中にQR never throws qrMask bounds error and signs cleanly', async ({
    browser,
  }, testInfo) => {
    const jaContext = await browser.newContext({
      locale: 'ja-JP',
      viewport: { width: 820, height: 1180 },
      hasTouch: true,
    });
    const page = await jaContext.newPage();

    await page.goto('/create');
    await page.getByTestId('cookie-reject-btn').click();

    const largeArtPath = testInfo.outputPath('large-canvas-1600x1400.png');
    fs.writeFileSync(largeArtPath, buildTestPng(1600, 1400));
    await page.getByTestId('create-image-input').setInputFiles(largeArtPath);
    await page.getByTestId('create-author-input').fill('ミキ');
    await page.getByTestId('create-title-input').fill('大型キャンバス作品');

    // Simple Mode -> click 絵の中にQR (previously crashed RouteErrorBoundary on >1200px canvases)
    await page.getByTestId('create-simple-style-inside').click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByTestId('create-inside-live-preview')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('qrMask must fit inside artwork region bounds');

    // Advanced Mode -> click 作品の内側 -> must render In-Image QR Studio cleanly without throwing
    await page.getByTestId('header-mode-toggle-advanced').click();
    await page.getByTestId('create-mode-studio').click();
    await expect(page.getByTestId('create-mode-studio')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('qrstudio-preview-canvas')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('qrMask must fit inside artwork region bounds');

    // Sign large canvas with bottom-right (>1200px) qrMask and confirm valid download
    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toContain('.in-image-qr.certified-handmade.png');
    await expect(page.getByTestId('create-result-section')).toBeVisible();

    await jaContext.close();
  });

  test('single-line responsive footer and zero document horizontal overflow across routes on mobile (360px) and desktop', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      locale: 'ja-JP',
      viewport: { width: 360, height: 800 },
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    const routes = ['/', '/create', '/verify', '/keys', '/exchange', '/storage', '/vault', '/devices', '/privacypolicy'];

    for (const mode of ['simple', 'advanced'] as const) {
      await page.getByTestId(`header-mode-toggle-${mode}`).click();
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('footer')).toBeVisible();

        const metrics = await page.evaluate(() => {
          const docOverflow =
            document.documentElement.scrollWidth - document.documentElement.clientWidth;
          const footerEl = document.querySelector('footer');
          const rowEl = document.querySelector('[data-testid="footer-single-row"]');
          const rowItems = rowEl
            ? Array.from(rowEl.querySelectorAll('p, a, button')).map((el) => {
                const r = el.getBoundingClientRect();
                return { top: r.top, height: r.height };
              })
            : [];
          const tops = rowItems.filter((i) => i.height > 0).map((i) => i.top);
          const maxRowSpread = tops.length > 0 ? Math.max(...tops) - Math.min(...tops) : 0;
          return {
            docOverflow,
            footerHeight: footerEl ? footerEl.getBoundingClientRect().height : 999,
            maxRowSpread,
          };
        });

        expect(metrics.docOverflow, `${mode} ${route} docOverflow`).toBeLessThanOrEqual(1);
        expect(metrics.footerHeight, `${mode} ${route} footerHeight`).toBeLessThanOrEqual(64);
        expect(metrics.maxRowSpread, `${mode} ${route} single-line footer spread`).toBeLessThanOrEqual(14);
      }
    }

    await context.close();
  });
});
