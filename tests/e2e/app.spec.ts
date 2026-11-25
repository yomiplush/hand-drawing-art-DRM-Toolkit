import fs from 'node:fs';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { decode as decodePng, encode as encodePng } from 'fast-png';

function buildTestArtworkPng(width = 160, height = 120): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 5 + y * 2) & 0xff;
      data[i + 1] = (x * 3 + y * 7) & 0xff;
      data[i + 2] = (x * 11 + y) & 0xff;
      data[i + 3] = x < 20 && y < 20 ? 0 : 255; // Includes alpha=0 region
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

async function enableAdvancedMode(page: Page): Promise<void> {
  await page.getByTestId('header-mode-toggle-advanced').click();
  await expect(page.getByTestId('advanced-cockpit-bar')).toBeVisible();
}

async function enableSimpleMode(page: Page): Promise<void> {
  await page.getByTestId('header-mode-toggle-simple').click();
  await expect(page.getByTestId('advanced-cockpit-bar')).toHaveCount(0);
}

test.describe('Certified Handmade E2E suite', () => {
  test('minimal homepage, Gentle Azure theme toggle, Simple/Advanced mode preservation, key lifecycle, 3-step signing, verify log, and multilingual switching', async ({
    page,
  }, testInfo) => {
    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (
        url.protocol !== 'blob:' &&
        url.protocol !== 'data:' &&
        url.hostname !== '127.0.0.1' &&
        url.hostname !== 'localhost'
      ) {
        externalRequests.push(req.url());
      }
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('home-tagline')).toContainText('Your art. Your proof.');
    await expect(page.getByTestId('home-subtitle')).toContainText(
      'Always free. No sign-up. No image uploads.',
    );
    await expect(page.getByTestId('home-cta-create')).toContainText('Certify Artwork');
    await expect(page.getByTestId('home-cta-verify')).toContainText('Verify Artwork');

    // No crypto jargon or long-form technical sections cluttering the default Simple homepage
    await expect(page.getByTestId('home-faq-section')).toHaveCount(0);
    await expect(page.getByTestId('home-howto-section')).toHaveCount(0);
    await expect(page.getByTestId('home-docs-link')).toHaveCount(0);
    const homeMainText = await page.locator('main').innerText();
    for (const jargon of ['Ed25519', 'SHA-256', 'AES-256-GCM', 'Nostr']) {
      expect(homeMainText).not.toContain(jargon);
    }

    // Gentle Azure animated wave background canvas is mounted and sized
    const waveCanvas = page.getByTestId('ps3-wave-bg');
    await expect(waveCanvas).toBeVisible();
    const box = await waveCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);

    // Dismiss initial cookie banner cleanly so it doesn't obscure bottom interactions
    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
    await page.getByTestId('cookie-reject-btn').click();
    await expect(page.getByTestId('cookie-consent-banner')).toBeHidden();

    // Verify >=44x44 touch targets on key homepage controls
    for (const tid of [
      'home-cta-create',
      'home-cta-verify',
      'home-sample-demo-link',
      'home-switch-advanced-btn',
      'theme-toggle-btn',
    ]) {
      const targetBox = await page.getByTestId(tid).boundingBox();
      expect(targetBox).not.toBeNull();
      expect(targetBox!.height).toBeGreaterThanOrEqual(44);
      expect(targetBox!.width).toBeGreaterThanOrEqual(44);
    }

    // Light / Dark theme switching updates html[data-theme] cleanly
    const initialTheme = await page.locator('html').getAttribute('data-theme');
    await page.getByTestId('theme-toggle-btn').click();
    const flippedTheme = await page.locator('html').getAttribute('data-theme');
    expect(flippedTheme).not.toBe(initialTheme);
    await page.getByTestId('theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme ?? 'light');

    // Open contextual ? HelpTip inline disclosure on Simple Home and close with Escape
    await page.getByTestId('home-local-tip-btn').click();
    const helpPanel = page.getByTestId('home-local-tip-panel');
    await expect(helpPanel).toHaveAttribute('data-open', 'true');
    await expect(helpPanel).toContainText('Everything runs 100% inside your device');
    await page.keyboard.press('Escape');
    await expect(helpPanel).toHaveAttribute('data-open', 'false');

    // Verify top-header Dual-Mode pill starts cleanly in Simple Mode -> switches to Advanced Cockpit -> returns to Simple Mode
    await expect(page.getByTestId('header-mode-toggle-simple')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('advanced-cockpit-bar')).toHaveCount(0);

    await page.getByTestId('header-mode-toggle-advanced').click();
    await expect(page.getByTestId('header-mode-toggle-advanced')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('advanced-cockpit-bar')).toBeVisible();
    await expect(page.getByTestId('cockpit-create-link')).toBeVisible();
    await expect(page.getByTestId('cockpit-verify-link')).toBeVisible();
    await expect(page.getByTestId('cockpit-keys-link')).toBeVisible();
    await expect(page.getByTestId('cockpit-devices-link')).toBeVisible();
    await expect(page.getByTestId('cockpit-vault-link')).toBeVisible();
    await expect(page.getByTestId('cockpit-exchange-link')).toBeVisible();
    await expect(page.getByTestId('cockpit-storage-link')).toBeVisible();
    await expect(page.getByTestId('cockpit-spec-link')).toBeVisible();
    await expect(page.getByTestId('home-tutorial-link')).toBeVisible();

    await page.getByTestId('header-mode-toggle-simple').click();
    await expect(page.getByTestId('advanced-cockpit-bar')).toHaveCount(0);

    // Multi-language switching (JA tagline check, zh-CN, ko, ru, uk, ar RTL, back to EN)
    const langSelect = page.getByTestId('lang-select');
    await langSelect.selectOption('ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByTestId('home-tagline')).toContainText('大切な絵に、あなたの証を。');
    await langSelect.selectOption('zh-CN');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await langSelect.selectOption('ko');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await langSelect.selectOption('ru');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await langSelect.selectOption('uk');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await langSelect.selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await langSelect.selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    // 1. Go to Keys page, open ? Help storage note, generate keypair with encrypted backup
    await page.goto('/keys');
    await page.getByTestId('keys-help-btn').click();
    await expect(page.getByTestId('keys-standalone-storage-note')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('keygen-label').fill('E2E Studio Key');
    await page.getByTestId('keygen-passphrase').fill('e2e-strong-passphrase');
    await page.getByTestId('keygen-submit').click();

    await expect(page.getByTestId('author-key-card')).toHaveCount(1);
    await expect(page.getByTestId('keys-unbacked-alert')).toBeVisible();
    const downloadBackupPromise = page.waitForEvent('download');
    await page.getByTestId('download-pending-backup').click();
    const backupDownload = await downloadBackupPromise;
    const backupPath = testInfo.outputPath('backup.chkey.json');
    await backupDownload.saveAs(backupPath);
    const backupJson = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    expect(backupJson.format).toBe('certified-handmade-key-backup');
    await expect(page.getByTestId('keys-unbacked-alert')).toBeHidden();

    // Delete key, then restore from backup file
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete Key' }).click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(0);

    await page.getByTestId('restore-file-input').setInputFiles(backupPath);
    await page.getByTestId('restore-passphrase').fill('e2e-strong-passphrase');
    await page.getByTestId('restore-submit').click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    // 2. Create signed PNG via 3-step Simple Mode workflow & confirm zero data loss when toggling Simple <-> Advanced
    const artPath = testInfo.outputPath('artwork.png');
    fs.writeFileSync(artPath, buildTestArtworkPng());

    await page.goto('/create');
    await expect(page.getByTestId('create-step-indicator-1')).toBeVisible();
    await expect(page.getByTestId('create-step-indicator-2')).toBeVisible();
    await expect(page.getByTestId('create-step-indicator-3')).toBeVisible();

    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await expect(page.getByText('160 × 120 px')).toBeVisible();
    await expect(page.getByTestId('create-outer-live-preview')).toBeVisible();

    // Author & Artwork fields are directly editable in Simple Mode
    await page.getByTestId('create-author-input').fill('YomiPlush');
    await page.getByTestId('create-title-input').fill('Moonlight E2E');

    // Toggle Simple -> Advanced -> Simple without page reload & verify unsaved draft stays intact
    await enableAdvancedMode(page);
    await expect(page.getByTestId('create-mode-studio')).toBeVisible();
    await expect(page.getByTestId('create-author-input')).toHaveValue('YomiPlush');
    await expect(page.getByTestId('create-title-input')).toHaveValue('Moonlight E2E');
    await enableSimpleMode(page);
    await expect(page.getByTestId('create-mode-studio')).toHaveCount(0);
    await expect(page.getByTestId('create-title-input')).toHaveValue('Moonlight E2E');

    await expect(page.getByTestId('create-license-summary')).toBeVisible();
    await page.getByTestId('create-license-select').selectOption('CC-BY-NC-4.0');
    await expect(page.getByTestId('create-license-summary')).toContainText('CC BY-NC 4.0');

    const signedDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const signedDownload = await signedDownloadPromise;
    await expect(page.getByTestId('create-result-section')).toBeVisible();
    await expect(page.getByTestId('download-signed-png')).toBeVisible();
    const signedPngPath = testInfo.outputPath('signed.certified-handmade.png');
    await signedDownload.saveAs(signedPngPath);

    // Extract the proof URL route from the Open in Verify link
    const verifyHref = await page.getByTestId('open-local-verify').getAttribute('href');
    expect(verifyHref).toContain('/verify#proof=');

    // 3. Upload signed PNG on /verify -> Simple Mode 3-step & status rows, then Advanced Mode details + history log
    await page.goto('/verify');
    await expect(page.getByTestId('verify-step-indicator-1')).toBeVisible();
    await expect(page.getByTestId('verify-step-indicator-2')).toBeVisible();
    await expect(page.getByTestId('verify-step-indicator-3')).toBeVisible();

    await page.getByTestId('verify-image-input').setInputFiles(signedPngPath);
    await expect(page.getByTestId('verification-results')).toBeVisible();
    await expect(page.getByTestId('verify-license-summary')).toContainText('CC BY-NC 4.0');
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await expect(page.getByTestId('status-identity')).toContainText('Unverified');

    // Interactive ? explanations on status rows
    await page.getByTestId('status-signature-help').click();
    await expect(page.getByTestId('status-signature')).toContainText('Ed25519 signature check');
    await page.getByTestId('status-integrity-help').click();
    await expect(page.getByTestId('status-integrity')).toContainText('RGBA8 pixels');
    await page.getByTestId('status-identity-help').click();
    await expect(page.getByTestId('status-identity')).toContainText('Trusted Keys');

    // Technical manifest details & history log stay hidden in Simple Mode
    await expect(page.getByTestId('verify-manifest-details')).toHaveCount(0);
    await expect(page.getByTestId('verify-history-panel')).toHaveCount(0);

    // Trust this key locally from /verify (requires explicit out-of-band confirmation checkbox)
    await expect(page.getByTestId('verify-no-local-notice-note')).toBeVisible();
    await expect(page.getByTestId('verify-trust-btn')).toBeDisabled();
    await page.getByTestId('verify-trust-label-input').fill('YomiPlush Official');
    await page.getByTestId('verify-trust-confirm-checkbox').check();
    await expect(page.getByTestId('verify-trust-btn')).toBeEnabled();
    await page.getByTestId('verify-trust-btn').click();
    await expect(page.getByTestId('status-identity')).toContainText('Trusted (YomiPlush Official)');

    // Enable Advanced Mode -> verify manifest details & local verification log entry appear
    await enableAdvancedMode(page);
    await page.locator('[data-testid="verify-manifest-details"] > button').click();
    await expect(page.getByTestId('verify-manifest-details')).toContainText('Moonlight E2E');
    await expect(page.getByTestId('verify-history-panel')).toBeVisible();
    await expect(page.getByTestId('verify-history-item').first()).toContainText('Moonlight E2E');
    await enableSimpleMode(page);

    // 4. Direct navigation to /verify#proof=... -> results & Quick DRM card prioritized ABOVE optional Step 2 CTA
    await page.goto(verifyHref!);
    await expect(page.getByTestId('verify-auto-verified-pill')).toBeVisible();
    await expect(page.getByTestId('verify-drm-quick-card')).toBeVisible();
    await expect(page.getByTestId('verify-drm-quick-card')).toContainText('YomiPlush');
    await expect(page.getByTestId('verify-drm-quick-card')).toContainText('Moonlight E2E');
    await expect(page.getByTestId('verify-drm-quick-card')).toContainText('CC BY-NC 4.0');
    await expect(page.getByTestId('verify-drm-policy-pills')).toContainText('Disallow');
    await expect(page.getByTestId('verify-proof-artwork-cta')).toBeVisible();
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Not Checked');

    const resultsBox = await page.getByTestId('verification-results').boundingBox();
    const step2Box = await page.getByTestId('verify-proof-artwork-cta').boundingBox();
    expect(resultsBox).not.toBeNull();
    expect(step2Box).not.toBeNull();
    expect(resultsBox!.y).toBeLessThan(step2Box!.y);

    await page.getByTestId('verify-attach-artwork-input').setInputFiles(artPath);
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');

    // Tamper 1 pixel in artwork and verify Mismatched detection
    const decodedArt = decodePng(fs.readFileSync(artPath));
    decodedArt.data[0] ^= 0xff;
    const tamperedArtPath = testInfo.outputPath('tampered.png');
    fs.writeFileSync(tamperedArtPath, Buffer.from(encodePng(decodedArt)));
    await page.getByTestId('verify-attach-artwork-input').setInputFiles(tamperedArtPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Mismatched');

    // Zero external network calls allowed
    expect(externalRequests).toEqual([]);
  });

  test('SEO head metadata, ?hl=ja crawler support without GDPR bypass, static route shells, and zero CSP errors', async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Home SEO metadata
    await page.goto('/');
    await expect(page).toHaveTitle(/Cryptographic Artwork Provenance/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/',
    );
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
      'content',
      /Ed25519/,
    );
    await expect(page.getByTestId('home-tagline')).toBeVisible();

    await page.getByTestId('cookie-reject-btn').click();

    // Dynamic head tags update cleanly across SPA routes
    await page.goto('/create');
    await expect(page).toHaveURL(/\/create$/);
    await expect(page).toHaveTitle(/Create Cryptographic Artwork Provenance Certificate/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/create',
    );

    await page.goto('/create?mode=studio');
    await expect(page).toHaveURL(/\/create\?mode=studio$/);
    await expect(page).toHaveTitle(/Manual In-Image QR Studio/);

    await page.goto('/verify');
    await expect(page).toHaveTitle(/Verify Artwork Provenance/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/verify',
    );

    await page.goto('/docs');
    await expect(page).toHaveTitle(/Cryptographic Architecture, SPEC & Offline Verifier Docs/);
    await expect(page.getByTestId('docs-standalone-section')).toBeVisible();
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/docs',
    );

    // ?hl=ja renders Japanese immediately with self-referencing canonical, without persisting chm_locale when rejected
    await page.goto('/?hl=ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page).toHaveTitle(/手描きDRM/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/?hl=ja',
    );
    await expect(page.getByTestId('home-tagline')).toContainText('大切な絵に、あなたの証を。');
    const leakedLocaleStorage = await page.evaluate(() => ({
      lsLocale: localStorage.getItem('chm_locale'),
      cookie: document.cookie,
    }));
    expect(leakedLocaleStorage.lsLocale).toBeNull();
    expect(leakedLocaleStorage.cookie).not.toContain('chm_locale=');

    // Crawler / AI-search assets & static SEO shells on dist/
    const robotsRes = await request.get('/robots.txt');
    expect(robotsRes.status()).toBe(200);
    expect(await robotsRes.text()).toContain('Sitemap: https://certified-handmade.com/sitemap.xml');

    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);
    expect(await sitemapRes.text()).toContain('hreflang="ja"');

    const llmsRes = await request.get('/llms.txt');
    expect(llmsRes.status()).toBe(200);
    expect(await llmsRes.text()).toContain('Ed25519');

    const ogRes = await request.get('/og-card.png');
    expect(ogRes.status()).toBe(200);

    const distDir = path.resolve(process.cwd(), 'dist');
    for (const slug of ['create', 'verify', 'tutorial', 'keys', 'docs', 'privacypolicy']) {
      const htmlPath = path.join(distDir, `${slug}.html`);
      expect(fs.existsSync(htmlPath)).toBe(true);
      const html = fs.readFileSync(htmlPath, 'utf8');
      expect(html).toContain(`<link rel="canonical" href="https://certified-handmade.com/${slug}" />`);
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('menu GitHub & Sponsor links, /qr-studio redirect, and unified In-Image QR Studio inside /create (Advanced Mode)', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    // Enable Advanced Mode via top-header pill -> verify GitHub + adjacent Sponsor Heart link inside Cockpit Bar
    await page.getByTestId('header-mode-toggle-advanced').click();
    const githubLink = page.getByTestId('header-github-link');
    const sponsorLink = page.getByTestId('header-sponsor-link');
    await expect(githubLink).toBeVisible();
    await expect(sponsorLink).toBeVisible();
    await expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit',
    );
    await expect(sponsorLink).toHaveAttribute('href', 'https://github.com/sponsors/yomiplush');

    const githubBox = await githubLink.boundingBox();
    const sponsorBox = await sponsorLink.boundingBox();
    expect(githubBox).not.toBeNull();
    expect(sponsorBox).not.toBeNull();
    expect(sponsorBox!.x).toBeGreaterThan(githubBox!.x);

    // /qr-studio removed from navigation & redirects to /create?mode=studio
    await expect(page.locator('a[href="/qr-studio"]')).toHaveCount(0);
    await page.goto('/qr-studio');
    await expect(page).toHaveURL(/\/create\?mode=studio$/);
    await expect(page.getByTestId('create-mode-studio')).toHaveAttribute('aria-selected', 'true');

    // Switch back to /create, then toggle into studio mode inside /create without URL navigation
    await page.goto('/create');
    await page.getByTestId('create-mode-studio').click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByTestId('create-mode-studio')).toHaveAttribute('aria-selected', 'true');

    // Upload 320x240 artwork, adjust preset, expand Advanced QR Settings for opacity & quiet zone, verify readability, quick keygen & sign
    const artPath = testInfo.outputPath('studio-art.png');
    fs.writeFileSync(artPath, buildTestArtworkPng(320, 240));
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await expect(page.getByTestId('qrstudio-preview-canvas')).toBeVisible();

    await expect(page.getByTestId('qrstudio-coverage-badge')).toBeVisible();
    await page.getByTestId('qrstudio-highlight-mask-toggle').click();
    await expect(page.getByTestId('qrstudio-highlight-mask-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('qrstudio-optimize-size-btn').click();
    await page.getByTestId('qrstudio-preset-topLeft').click();
    await page.locator('[data-testid="create-qr-advanced"] > button').click();
    await page.getByTestId('qrstudio-opacity-slider').fill('75');
    await page.getByTestId('qrstudio-quietzone-select').selectOption('0');
    await expect(page.getByTestId('qrstudio-readability-badge')).toContainText(
      'Scannable in live preview',
    );

    await page.getByTestId('create-quick-keygen').click();
    await expect(page.getByTestId('create-key-select')).toBeVisible();
    await expect(page.getByTestId('create-key-backup-warning')).toBeVisible();

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const dl = await dlPromise;
    await expect(page.getByTestId('create-result-section')).toBeVisible();
    const studioPngPath = testInfo.outputPath('studio.in-image-qr.png');
    await dl.saveAs(studioPngPath);

    // Verify downloaded in-image QR PNG on /verify -> Valid + Matched + in-image-masked + qrMask notice
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(studioPngPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await expect(page.getByTestId('verification-results')).toContainText('in-image-masked');
    await expect(page.getByTestId('verify-qr-mask-notice')).toBeVisible();
  });

  test('mobile #proof= Step 2 CTA, clipboard paste verification, and PWA ?shared=1 cache consumer', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    // Sign a test artwork in Simple Mode on /create (auto-generates local key seamlessly on sign)
    await page.goto('/create');
    await expect(page.getByTestId('create-auto-key-info')).toBeVisible();

    const artBuffer = buildTestArtworkPng(160, 120);
    const artPath = testInfo.outputPath('mobile-art.png');
    fs.writeFileSync(artPath, artBuffer);
    await page.getByTestId('create-image-input').setInputFiles(artPath);

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const dl = await dlPromise;
    await expect(page.getByTestId('create-result-section')).toBeVisible();

    const verifyHref = await page.getByTestId('open-local-verify').getAttribute('href');
    expect(verifyHref).toContain('/verify#proof=');

    const signedPath = testInfo.outputPath('mobile-signed.png');
    await dl.saveAs(signedPath);
    const signedBytes = Array.from(fs.readFileSync(signedPath));

    // Open /verify#proof=... -> Step 2 CTA visible, paste image via ClipboardEvent on window
    await page.goto(verifyHref!);
    await expect(page.getByTestId('verify-drm-quick-card')).toBeVisible();
    await expect(page.getByTestId('verify-proof-artwork-cta')).toBeVisible();
    await expect(page.getByTestId('verify-paste-image-btn')).toBeVisible();
    await expect(page.getByTestId('status-integrity')).toContainText('Not Checked');

    const artBytes = Array.from(artBuffer);
    await page.evaluate((bytes) => {
      const dt = new DataTransfer();
      const file = new File([new Uint8Array(bytes)], 'pasted-artwork.png', { type: 'image/png' });
      dt.items.add(file);
      const evt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(evt);
    }, artBytes);

    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');

    // Simulate PWA Share Target handoff (?shared=1 via Cache Storage 'chm-share-target-v1')
    await page.evaluate(async (bytes) => {
      const cache = await caches.open('chm-share-target-v1');
      await cache.put(
        '/__shared-artwork__',
        new Response(new Uint8Array(bytes), {
          headers: {
            'Content-Type': 'image/png',
            'X-Shared-Filename': encodeURIComponent('shared-signed.png'),
          },
        }),
      );
    }, signedBytes);

    await page.goto('/verify?shared=1');
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');

    // Cache entry must be cleaned up immediately after consumption
    const remainingCache = await page.evaluate(async () => {
      const cache = await caches.open('chm-share-target-v1');
      return (await cache.match('/__shared-artwork__')) !== undefined;
    });
    expect(remainingCache).toBe(false);
  });

  test('GDPR bottom popup, consent-gated locale persistence, and /#privacypolicy page', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();

    // Reject optional -> select Japanese -> reload -> banner stays closed and language resets to default 'en'
    await page.getByTestId('cookie-reject-btn').click();
    await expect(page.getByTestId('cookie-consent-banner')).toBeHidden();
    await page.getByTestId('lang-select').selectOption('ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

    await page.reload();
    await expect(page.getByTestId('cookie-consent-banner')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Reopen via footer button -> Accept optional -> select Ukrainian -> reload -> Ukrainian persists
    await page.getByTestId('footer-cookie-settings').click();
    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
    await page.getByTestId('cookie-accept-btn').click();
    await expect(page.getByTestId('cookie-consent-banner')).toBeHidden();

    await page.getByTestId('lang-select').selectOption('uk');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');

    // Visit /#privacypolicy and verify gdpr-info.eu reference + reset button
    await page.goto('/#privacypolicy');
    await expect(page.getByTestId('privacy-policy-page')).toBeVisible();
    await expect(page.locator('a[href="https://gdpr-info.eu/"]')).toBeVisible();
    await expect(page.getByTestId('policy-consent-status')).toBeVisible();

    await page.getByTestId('policy-reset-btn').click();
    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
  });

  test('Tutorial menu navigation, guided flow into /create, and multilingual tutorial rendering', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('cookie-accept-btn').click();

    // Verify & click Tutorial link in footer across desktop and mobile
    const tutorialLink = page.locator('footer a[href="/tutorial"]');
    await expect(tutorialLink).toBeVisible();
    await tutorialLink.click();

    await expect(page.getByTestId('tutorial-page')).toBeVisible();
    await expect(page.getByTestId('tutorial-step-0')).toBeVisible();
    await expect(page.getByTestId('tutorial-cheat-section')).toContainText('ARR (All Rights Reserved)');

    // Check multilingual rendering (ja and uk)
    await page.getByTestId('lang-select').selectOption('ja');
    await expect(page.getByTestId('tutorial-page')).toContainText('かんたんチュートリアル');
    await page.getByTestId('lang-select').selectOption('uk');
    await expect(page.getByTestId('tutorial-page')).toContainText('Простий покроковий туторіал');

    // Follow guided CTA from Tutorial into /create
    await page.getByTestId('tutorial-step-cta-0').click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByTestId('create-auto-key-info')).toBeVisible();
    await expect(page.getByTestId('create-image-input')).toBeVisible();
    await expect(page.getByTestId('create-sign-button')).toBeVisible();
  });

  test('1-click keygen on /create (Advanced Mode) with default ARR license and multilingual license guide on /docs', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-accept-btn').click();
    await expect(page.getByTestId('home-cta-create')).toBeVisible();
    await expect(page.getByTestId('home-cta-verify')).toBeVisible();

    // Switch to Japanese and verify artist-friendly CTA + 1-click keygen on /create (Advanced Mode)
    await page.getByTestId('lang-select').selectOption('ja');
    await expect(page.getByTestId('home-cta-create')).toContainText('作品を証明する');

    await page.goto('/create');
    await enableAdvancedMode(page);
    await expect(page.getByTestId('create-license-summary')).toContainText('無断使用');
    await page.getByTestId('create-quick-keygen').click();
    await expect(page.getByTestId('create-key-select')).toBeVisible();

    const artPath = testInfo.outputPath('quick-art.png');
    fs.writeFileSync(artPath, buildTestArtworkPng(120, 90));
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await page.getByTestId('create-sign-button').click();
    await expect(page.getByTestId('create-result-section')).toBeVisible();

    // Check /docs license guide in multiple languages
    await page.goto('/docs');
    await expect(page.getByTestId('docs-licenses-section')).toContainText('CC BY-NC-ND 4.0');
    await page.getByTestId('lang-select').selectOption('uk');
    await expect(page.getByTestId('docs-licenses-section')).toContainText('Довідник ліцензій');
  });

  test('works offline via Service Worker on /verify#proof=...', async ({ page, context }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });
    await page.waitForTimeout(800);

    await page.goto('/keys');
    await page.getByTestId('keygen-label').fill('Offline Key');
    await page.getByTestId('keygen-submit').click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    const artPath = path.join(testInfo.outputPath('offline-art.png'));
    fs.writeFileSync(artPath, buildTestArtworkPng(120, 90));

    await page.goto('/create');
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await page.getByTestId('create-sign-button').click();
    const verifyHref = await page.getByTestId('open-local-verify').getAttribute('href');
    expect(verifyHref).toContain('/verify#proof=');

    await context.setOffline(true);

    await page.goto(verifyHref!);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Not Checked');

    await page.getByTestId('verify-attach-artwork-input').setInputFiles(artPath);
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');

    await context.setOffline(false);
  });

  test('passphrase quick-keygen backup clearance, backup verification without import, and portable .chproof.json offline verification', async ({
    page,
    context,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    await page.goto('/create');
    await enableAdvancedMode(page);
    await page.getByTestId('create-quick-passphrase').fill('offline-backup-pass');
    await page.getByTestId('create-quick-keygen').click();
    await expect(page.getByTestId('create-key-select')).toBeVisible();
    await expect(page.getByTestId('create-key-backup-warning')).toBeVisible();
    await expect(page.getByTestId('create-download-pending-backup')).toBeVisible();

    const keyDlPromise = page.waitForEvent('download');
    await page.getByTestId('create-download-pending-backup').click();
    const keyDl = await keyDlPromise;
    const keyBackupPath = testInfo.outputPath('quick-backup.chkey.json');
    await keyDl.saveAs(keyBackupPath);
    await expect(page.getByTestId('create-key-backup-warning')).toBeHidden();

    // Sign artwork and expand technical disclosure to download portable .chproof.json
    const artPath = testInfo.outputPath('bundle-art.png');
    fs.writeFileSync(artPath, buildTestArtworkPng(140, 100));
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await page.getByTestId('create-sign-button').click();
    await expect(page.getByTestId('create-result-section')).toBeVisible();

    await page.locator('[data-testid="create-result-technical"] > button').click();
    const bundleDlPromise = page.waitForEvent('download');
    await page.getByTestId('download-proof-bundle').click();
    const bundleDl = await bundleDlPromise;
    const bundlePath = testInfo.outputPath('art.chproof.json');
    await bundleDl.saveAs(bundlePath);

    // Verify backup only on /keys without duplicating IndexedDB records
    await page.goto('/keys');
    await expect(page.getByTestId('key-unbacked-badge')).toHaveCount(0);
    await page.getByTestId('restore-file-input').setInputFiles(keyBackupPath);
    await page.getByTestId('restore-passphrase').fill('offline-backup-pass');
    await page.getByTestId('verify-backup-btn').click();
    await expect(page.getByTestId('restore-status-msg')).toContainText('Verified');
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    // Go offline and verify portable .chproof.json + artwork
    await context.setOffline(true);
    await page.goto('/verify');
    await page.getByTestId('verify-tab-proof').click();
    await page.getByTestId('verify-proof-bundle-input').setInputFiles(bundlePath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Not Checked');

    await page.getByTestId('verify-attach-artwork-input').setInputFiles(artPath);
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await context.setOffline(false);
  });

  test('out-of-band trust state, offline revocation notices, and key-possession challenge-response', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    // Generate key on /keys and verify passphrase strength indicator
    await page.goto('/keys');
    await page.getByTestId('keygen-label').fill('Hardening Artist Key');
    await page.getByTestId('keygen-passphrase').fill('short');
    await expect(page.getByTestId('keygen-passphrase-strength')).toContainText('Too short');
    await page.getByTestId('keygen-passphrase').fill('very-strong-artist-passphrase-2026');
    await expect(page.getByTestId('keygen-passphrase-strength')).toContainText('Strong');
    await page.getByTestId('keygen-submit').click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    // Offline Key-Possession Challenge-Response roundtrip
    const pubLine = await page
      .getByTestId('author-key-card')
      .first()
      .getByText(/^Ed25519 PK:/)
      .innerText();
    const pubB64 = pubLine.replace(/^Ed25519 PK:\s*/, '').trim();
    await page.locator('[data-testid="keys-challenge-panel"] > button').click();
    await page.getByTestId('challenge-target-input').fill(pubB64.trim());
    await page.getByTestId('challenge-create-btn').click();
    const challengeToken = await page.getByTestId('challenge-token-output').inputValue();
    expect(challengeToken.startsWith('chm-challenge:')).toBe(true);

    await page.getByTestId('challenge-sign-input').fill(challengeToken);
    await page.getByTestId('challenge-sign-btn').click();
    const responseToken = await page.getByTestId('challenge-response-output').inputValue();
    expect(responseToken.startsWith('chm-response:')).toBe(true);

    await page.getByTestId('challenge-verify-challenge-input').fill(challengeToken);
    await page.getByTestId('challenge-verify-response-input').fill(responseToken);
    await page.getByTestId('challenge-verify-btn').click();
    await expect(page.getByTestId('challenge-verify-result')).toContainText(
      'Key possession verified offline',
    );

    // Create signed PNG artwork first
    const artPath = testInfo.outputPath('notice-art.png');
    fs.writeFileSync(artPath, buildTestArtworkPng(120, 90));
    await page.goto('/create');
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const dl = await dlPromise;
    const signedPath = testInfo.outputPath('notice-signed.png');
    await dl.saveAs(signedPath);

    // Save key as Unconfirmed Only on /verify, confirm still Unknown until confirmed
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(signedPath);
    await expect(page.getByTestId('verify-no-local-notice-note')).toBeVisible();
    await page.getByTestId('verify-trust-unconfirmed-btn').click();
    await expect(page.getByTestId('status-identity')).toContainText('Unverified');
    await expect(page.getByTestId('verify-unconfirmed-trust-card')).toBeVisible();

    // Now confirm fingerprint out-of-band on /verify
    await page.getByTestId('verify-trust-confirm-checkbox').check();
    await page.getByTestId('verify-confirm-now-btn').click();
    await expect(page.getByTestId('status-identity')).toContainText('Trusted');

    // Create & import an offline revocation notice on /keys
    await page.goto('/keys');
    await page.locator('[data-testid="keys-notices-panel"] > button').click();
    await page.getByTestId('notice-type-select').selectOption('revocation');
    await page.getByTestId('notice-reason-select').selectOption('retired');
    await page.getByTestId('notice-create-btn').click();
    const noticeToken = (
      await page
        .getByTestId('keys-notices-panel')
        .getByText(/^chm-notice:/)
        .innerText()
    ).trim();
    expect(noticeToken.startsWith('chm-notice:')).toBe(true);

    await page.getByTestId('notice-import-input').fill(noticeToken);
    await page.getByTestId('notice-import-btn').click();
    await expect(page.getByTestId('stored-notice-item')).toHaveCount(1);

    // Re-verify historical signed PNG: signature & pixel integrity remain valid while local notice banner warns
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(signedPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await expect(page.getByTestId('verify-key-notice-banner')).toBeVisible();
    await expect(page.getByTestId('verify-key-notice-banner')).toContainText(
      'Local Revocation Notice Found',
    );
  });

  test('/keys responsive layout without horizontal overflow on Android, iPhone, iPad, and PC', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();
    await page.goto('/keys');

    // Generate key, trust one unconfirmed key, expand QR & panels
    await page.getByTestId('keygen-label').fill('Responsive Artist Studio Primary Key 2026');
    await page.getByTestId('keygen-passphrase').fill('responsive-test-passphrase-2026');
    await page.getByTestId('keygen-submit').click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    const pubLine = await page
      .getByTestId('author-key-card')
      .first()
      .getByText(/^Ed25519 PK:/)
      .innerText();
    const pubB64 = pubLine.replace(/^Ed25519 PK:\s*/, '').trim();

    await page.getByTestId('trusted-pub-input').fill(pubB64);
    await page.getByTestId('trusted-label-input').fill('Unconfirmed Responsive Check');
    await page.getByTestId('trusted-save-unconfirmed-btn').click();
    await expect(page.getByTestId('trusted-key-card')).toHaveCount(1);

    await page.locator('[data-testid="author-key-card"] button', { hasText: 'Fingerprint QR' }).click();
    await page.locator('[data-testid="keys-notices-panel"] > button').click();
    await page.getByTestId('notice-create-btn').click();
    await expect(page.getByTestId('stored-notice-item')).toHaveCount(1);
    await page.locator('[data-testid="keys-challenge-panel"] > button').click();

    const viewports = [
      { name: 'android-360', width: 360, height: 800 },
      { name: 'iphone-375', width: 375, height: 667 },
      { name: 'ipad-768', width: 768, height: 1024 },
      { name: 'laptop-1024', width: 1024, height: 768 },
      { name: 'desktop-1280', width: 1280, height: 800 },
    ];

    for (const locale of ['en', 'ja']) {
      await page.getByTestId('lang-select').selectOption(locale);
      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(80);
        const metrics = await page.evaluate(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const card = document.querySelector('[data-testid="author-key-card"]');
          const fpEl = document.querySelector('[data-testid^="author-key-fp-"]');
          const trustedCard = document.querySelector('[data-testid="trusted-key-card"]');
          const noticeItem = document.querySelector('[data-testid="stored-notice-item"]');
          return {
            docW,
            scrollW,
            cardRight: card ? card.getBoundingClientRect().right : 0,
            fpWidth: fpEl ? fpEl.getBoundingClientRect().width : 0,
            trustedRight: trustedCard ? trustedCard.getBoundingClientRect().right : 0,
            noticeRight: noticeItem ? noticeItem.getBoundingClientRect().right : 0,
          };
        });
        expect(metrics.scrollW, `${locale} ${vp.name} scrollWidth`).toBeLessThanOrEqual(metrics.docW + 1);
        expect(metrics.cardRight, `${locale} ${vp.name} author-key-card`).toBeLessThanOrEqual(vp.width + 1);
        expect(metrics.trustedRight, `${locale} ${vp.name} trusted-key-card`).toBeLessThanOrEqual(vp.width + 1);
        expect(metrics.noticeRight, `${locale} ${vp.name} stored-notice-item`).toBeLessThanOrEqual(vp.width + 1);
        expect(metrics.fpWidth, `${locale} ${vp.name} fingerprint width`).toBeGreaterThanOrEqual(240);
      }
    }
  });

  test('homepage renders immediately without blocking splash and exposes /storage + /privacypolicy drive.appdata notice', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('moon-startup-splash')).toHaveCount(0);
    await expect(page.getByTestId('home-cta-create')).toBeVisible();
    await expect(page.getByTestId('home-subtitle')).toContainText(
      'Always free. No sign-up. No image uploads.',
    );
    await expect(page.getByTestId('home-storage-link')).toHaveAttribute('href', '/storage');
    await expect(page.getByTestId('home-privacy-link')).toHaveAttribute('href', '/privacypolicy');
    await expect(page.getByTestId('footer-privacy-link')).toHaveAttribute('href', '/privacypolicy');

    await page.getByTestId('home-privacy-link').click();
    await expect(page).toHaveURL(/\/privacypolicy$/);
    await expect(page.getByTestId('privacy-google-drive-section')).toBeVisible();
    await expect(page.getByTestId('privacy-google-drive-section')).toContainText('drive.appdata');
    await expect(page.getByTestId('privacy-google-drive-section')).toContainText('appDataFolder');
    await expect(page.getByTestId('privacy-google-drive-section')).toContainText('Limited Use');
  });

  test('mobile 390x844 has zero horizontal overflow across all primary routes in Simple and Advanced mode', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    const routes = ['/', '/create', '/verify', '/keys', '/storage', '/devices', '/tutorial', '/docs'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(80);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `Simple Mode 390x844 overflow on ${route}`).toBeLessThanOrEqual(1);
    }

    await enableAdvancedMode(page);
    for (const route of ['/create', '/verify', '/storage']) {
      await page.goto(route);
      await page.waitForTimeout(80);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `Advanced Mode 390x844 overflow on ${route}`).toBeLessThanOrEqual(1);
    }

    expect(pageErrors).toEqual([]);
  });

  test('respects prefers-reduced-motion cleanly', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.getByTestId('moon-startup-splash')).toHaveCount(0);
    await expect(page.getByTestId('home-tagline')).toBeVisible();
    await expect(page.getByTestId('home-cta-create')).toBeVisible();
    expect(pageErrors).toEqual([]);
    await context.close();
  });
});
