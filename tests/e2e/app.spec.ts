import fs from 'node:fs';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { decode as decodePng, encode as encodePng } from 'fast-png';
import { buildIllustrationPng, buildWorkingProjectPsd } from '../helpers/artworkFixtures';

// Flat-colour fixture: per-pixel gradients trip the artwork safety gate's
// photorealism heuristic, so artwork fixtures use solid fills with hard edges.
function buildTestArtworkPng(width = 160, height = 120): Buffer {
  return buildIllustrationPng(width, height);
}

// Upload the artwork and the working project file that /create requires before
// it will sign. Returns after the project has passed local structure checks.
async function uploadArtworkWithProject(
  page: Page,
  artPath: string,
  testInfo: { outputPath: (name: string) => string },
): Promise<void> {
  await page.getByTestId('create-image-input').setInputFiles(artPath);
  const projectPath = testInfo.outputPath(`${path.basename(artPath)}.psd`);
  fs.writeFileSync(projectPath, buildWorkingProjectPsd());
  await page.getByTestId('create-source-project-input').setInputFiles(projectPath);
  await expect(page.getByTestId('source-project-verified-badge')).toBeVisible();
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
  // The first-run 3D tutorial is a full-screen overlay that intercepts clicks;
  // suppress it so flows under test are reachable. The cookie banner is left
  // alone because this suite asserts its appearance and dismissal.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('chm_interactive_tutorial_seen_v1', 'skipped');
      } catch {
        // ignore
      }
    });
  });

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

    // Simple Mode on `/` shows first-key onboarding (no keys) or GalleryDeck
    // (key present); the marketing homepage lives in Advanced Mode. Switch there
    // to assert the homepage copy, then return to Simple for the rest of the flow.
    await enableAdvancedMode(page);
    await expect(page.getByTestId('home-advanced-page')).toBeVisible();
    await expect(page.getByTestId('home-tagline')).toContainText('Your art. Your proof.');
    await expect(page.getByTestId('home-subtitle')).toContainText(
      'Always free. No sign-up. No image uploads.',
    );
    await expect(page.getByTestId('home-cta-create')).toContainText('Certify Artwork');
    await expect(page.getByTestId('home-cta-verify')).toContainText('Verify Artwork');

    // Advanced home intentionally exposes technical entry points; the jargon-free
    // guarantee applies to the Simple Mode landing state checked below.
    const homeMainText = await page.locator('main').innerText();
    expect(homeMainText).toContain('Your art. Your proof.');

    // The rest of the flow runs from Simple Mode.
    await enableSimpleMode(page);

    // Simple landing keeps crypto jargon and long-form technical sections out.
    await expect(page.getByTestId('home-faq-section')).toHaveCount(0);
    await expect(page.getByTestId('home-howto-section')).toHaveCount(0);
    await expect(page.getByTestId('home-docs-link')).toHaveCount(0);
    const simpleMainText = await page.locator('main').innerText();
    for (const jargon of ['Ed25519', 'SHA-256', 'AES-256-GCM', 'Nostr']) {
      expect(simpleMainText).not.toContain(jargon);
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

    // Verify >=44x44 touch target on a control that is always present.
    for (const tid of ['theme-toggle-btn']) {
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

    // Multi-language switching (JA, zh-CN, ko, ru, uk, ar RTL, back to EN).
    // Assert the localized tagline in Advanced Mode, where it is rendered.
    await page.getByTestId('header-mode-toggle-advanced').click();
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

    // 1. Go to Keys page (Advanced Mode exposes the full keygen form), open the
    // ? Help storage note, generate a keypair with an encrypted backup.
    await page.getByTestId('header-mode-toggle-advanced').click();
    await page.goto('/keys');
    await page.getByTestId('keys-help-btn').click();
    await expect(page.getByTestId('keys-standalone-storage-note')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('keygen-label').fill('E2E Studio Key');
    await page.getByTestId('keygen-passphrase').fill('e2e-strong-passphrase');
    // Key creation requires the passphrase to be typed twice.
    await page.getByTestId('keygen-passphrase-confirm').fill('e2e-strong-passphrase');
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

    await uploadArtworkWithProject(page, artPath, testInfo);
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
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');
    await expect(page.getByTestId('status-identity')).toContainText('Unverified');

    // Interactive ? explanations on status rows
    await page.getByTestId('status-signature-help').click();
    await expect(page.getByTestId('status-signature')).toContainText('Ed25519 signature check');
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
    // The optional Step-2 "attach artwork" CTA is intentionally not rendered
    // (gated off in the page); pixels are verified through the attach input below.
    await expect(page.getByTestId('verify-proof-artwork-cta')).toHaveCount(0);
    await expect(page.getByTestId('verification-results')).toBeVisible();
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','compressed');

    const resultsBox = await page.getByTestId('verification-results').boundingBox();
    expect(resultsBox).not.toBeNull();

    // A #proof= launch hides the input tabs and the Step-2 attach CTA is gated
    // off, so this path reports signature-only (sns-pass): pixels are "not
    // checked" until an image is supplied through the normal Image tab flow.
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','compressed');

    // Verification through the Image tab (not a #proof= launch) does compare
    // pixels: the original matches, a tampered copy does not.
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(signedPngPath);
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass', { timeout: 30_000 });

    // A signed PNG with even one flipped pixel no longer carries a decodable
    // proof, so verification cannot reach a verdict: the page reports warn
    // rather than a false pass.
    const decodedArt = decodePng(fs.readFileSync(signedPngPath));
    // The signed PNG wraps the art in a QR margin/band, so a single blind offset
    // can land outside the hashed region and leave the check passing. Invert a
    // centred block instead: it always overlaps the artwork pixels.
    const x0 = Math.floor(decodedArt.width * 0.3);
    const x1 = Math.floor(decodedArt.width * 0.7);
    const y0 = Math.floor(decodedArt.height * 0.3);
    const y1 = Math.floor(decodedArt.height * 0.7);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * decodedArt.width + x) * 4;
        decodedArt.data[i] ^= 0xff;
        decodedArt.data[i + 1] ^= 0xff;
      }
    }
    const tamperedArtPath = testInfo.outputPath('tampered.png');
    fs.writeFileSync(tamperedArtPath, Buffer.from(encodePng(decodedArt)));
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(tamperedArtPath);
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','no-seal', { timeout: 30_000 });

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
      'https://www.certified-handmade.com/',
    );
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
      'content',
      /Ed25519/,
    );
    await page.getByTestId('cookie-reject-btn').click();
    await enableAdvancedMode(page);
    await expect(page.getByTestId('home-tagline')).toBeVisible();

    // Dynamic head tags update cleanly across SPA routes
    await page.goto('/create');
    await expect(page).toHaveURL(/\/create$/);
    await expect(page).toHaveTitle(/Create Cryptographic Artwork Provenance Certificate/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.certified-handmade.com/create',
    );

    await page.goto('/create?mode=studio');
    await expect(page).toHaveURL(/\/create\?mode=studio$/);
    await expect(page).toHaveTitle(/Manual In-Image QR Studio/);

    await page.goto('/verify');
    await expect(page).toHaveTitle(/Verify Artwork Provenance/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.certified-handmade.com/verify',
    );

    await page.goto('/docs');
    await expect(page).toHaveTitle(/Cryptographic Architecture, SPEC & Offline Verifier Docs/);
    await expect(page.getByTestId('docs-standalone-section')).toBeVisible();
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.certified-handmade.com/docs',
    );

    // ?hl=ja renders Japanese immediately with self-referencing canonical, without persisting chm_locale when rejected
    await page.goto('/?hl=ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page).toHaveTitle(/手描きDRM/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.certified-handmade.com/?hl=ja',
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
    expect(await robotsRes.text()).toContain('Sitemap: https://www.certified-handmade.com/sitemap.xml');

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
      expect(html).toContain(`<link rel="canonical" href="https://www.certified-handmade.com/${slug}" />`);
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
    await uploadArtworkWithProject(page, artPath, testInfo);
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
    // The Simple verdict card only renders outside Advanced Mode; switch back so
    // the end-user path is what this flow asserts.
    await enableSimpleMode(page);
    await page.getByTestId('verify-image-input').setInputFiles(studioPngPath);
    await expect(page.getByTestId('verification-results')).toBeVisible();
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');
    // Mask details live in the Advanced result surface; confirm the in-image
    // qrMask notice and coverage readout after the Simple verdict has rendered.
    await enableAdvancedMode(page);
    await expect(page.getByTestId('verify-qr-mask-notice')).toBeVisible();
    await expect(page.getByTestId('verify-qrmask-coverage')).toBeVisible();
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
    await uploadArtworkWithProject(page, artPath, testInfo);

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
    // The optional Step-2 attach/paste CTA was removed from the QR-verify view.
    await expect(page.getByTestId('verify-proof-artwork-cta')).toHaveCount(0);
    await expect(page.getByTestId('verify-paste-image-btn')).toHaveCount(0);
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','compressed');

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
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');

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
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');

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
    // The marketing CTAs live on the Advanced home; Simple shows onboarding/Deck.
    await enableAdvancedMode(page);
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
    await uploadArtworkWithProject(page, artPath, testInfo);
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
    await enableAdvancedMode(page);
    await page.getByTestId('keygen-label').fill('Offline Key');
    await page.getByTestId('keygen-submit').click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    const artPath = path.join(testInfo.outputPath('offline-art.png'));
    fs.writeFileSync(artPath, buildTestArtworkPng(120, 90));

    await page.goto('/create');
    await uploadArtworkWithProject(page, artPath, testInfo);
    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const dl = await dlPromise;
    const signedPath = testInfo.outputPath('offline-signed.png');
    await dl.saveAs(signedPath);
    const verifyHref = await page.getByTestId('open-local-verify').getAttribute('href');
    expect(verifyHref).toContain('/verify#proof=');

    await context.setOffline(true);

    await page.goto(verifyHref!);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    // Advanced Mode intentionally hides the Simple verdict card; assert the
    // advanced result shell instead of a mode-specific affordance.
    await expect(page.getByTestId('verification-results')).toBeVisible();
    await expect(page.getByTestId('verify-auto-verified-pill')).toBeVisible();

    // Hash-proof launches hide the input tabs, so verify the downloaded signed
    // PNG from a plain /verify route instead of the removed Step-2 attach CTA.
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(signedPath);
    await expect(page.getByTestId('verification-results')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('status-signature')).toContainText('Valid');

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
    await page.getByTestId('create-quick-passphrase-confirm').fill('offline-backup-pass');
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
    await uploadArtworkWithProject(page, artPath, testInfo);
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
    await enableSimpleMode(page);
    await page.getByTestId('verify-tab-proof').click();
    await page.getByTestId('verify-proof-bundle-input').setInputFiles(bundlePath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','compressed');

    // Image attachment lives on the Advanced result surface, which replaces the
    // Simple verdict card; assert the shared result shell there instead.
    await enableAdvancedMode(page);
    await page.getByTestId('verify-tab-image').click();
    await page.getByTestId('verify-attach-artwork-input').setInputFiles(artPath);
    await expect(page.getByTestId('verification-results')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await context.setOffline(false);
  });

  test('out-of-band trust state, offline revocation notices, and key-possession challenge-response', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    // Generate key on /keys and verify passphrase strength indicator
    await page.goto('/keys');
    await enableAdvancedMode(page);
    await page.getByTestId('keygen-label').fill('Hardening Artist Key');
    await page.getByTestId('keygen-passphrase').fill('short');
    await expect(page.getByTestId('keygen-passphrase-strength')).toContainText('Too short');
    await page.getByTestId('keygen-passphrase').fill('very-strong-artist-passphrase-2026');
    await expect(page.getByTestId('keygen-passphrase-strength')).toContainText('Strong');
    await page.getByTestId('keygen-passphrase-confirm').fill('very-strong-artist-passphrase-2026');
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
    await uploadArtworkWithProject(page, artPath, testInfo);
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
    // Return to Simple Mode: the verdict card this flow asserts is the
    // artist-facing summary, which Advanced Mode intentionally replaces.
    await enableSimpleMode(page);
    await page.getByTestId('verify-image-input').setInputFiles(signedPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');
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
    await enableAdvancedMode(page);

    // Generate key, trust one unconfirmed key, expand QR & panels
    await page.getByTestId('keygen-label').fill('Responsive Artist Studio Primary Key 2026');
    await page.getByTestId('keygen-passphrase').fill('responsive-test-passphrase-2026');
    await page.getByTestId('keygen-passphrase-confirm').fill('responsive-test-passphrase-2026');
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
    await enableAdvancedMode(page);
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

    // Without a key or the tutorial pref, `/` is the first-run onboarding
    // screen instead of the marketing homepage. Suppress the tutorial and use
    // Advanced Mode, where the marketing copy lives.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('chm_interactive_tutorial_seen_v1', 'skipped');
      } catch {
        // ignore
      }
    });

    await page.goto('/');
    await expect(page.getByTestId('moon-startup-splash')).toHaveCount(0);
    await enableAdvancedMode(page);
    await expect(page.getByTestId('home-tagline')).toBeVisible();
    await expect(page.getByTestId('home-cta-create')).toBeVisible();
    expect(pageErrors).toEqual([]);
    await context.close();
  });
});
