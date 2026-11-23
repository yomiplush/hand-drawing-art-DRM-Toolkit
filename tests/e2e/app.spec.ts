import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
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

test.describe('Certified Handmade E2E suite', () => {
  test('full key lifecycle, signing, PNG QR burning, verification, tamper detection, trust, wave bg, motto, and multilingual switching', async ({
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
    await expect(page.getByTestId('home-manifesto')).toContainText(
      'Your artwork should outlive the platform that certifies it.',
    );
    await expect(page.getByTestId('home-standalone-section')).toBeVisible();
    await expect(page.getByTestId('home-standalone-download-link')).toHaveAttribute(
      'href',
      'https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/releases',
    );

    // PS3-inspired animated wave background canvas is mounted and sized
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

    // Multi-language switching (JA + motto check, zh-CN, ko, ru, uk, ar RTL, back to EN)
    const langSelect = page.getByTestId('lang-select');
    await langSelect.selectOption('ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByTestId('home-manifesto')).toContainText(
      'あなたの作品は、それを証明するプラットフォームより長く生き続けるべきだ。',
    );
    await expect(page.getByTestId('home-standalone-section')).toContainText('スタンドアローン版');
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

    // 1. Go to Keys page, generate keypair with encrypted backup
    await page.goto('/keys');
    await expect(page.getByTestId('keys-standalone-storage-note')).toBeVisible();
    await page.getByTestId('keygen-label').fill('E2E Studio Key');
    await page.getByTestId('keygen-passphrase').fill('e2e-strong-passphrase');
    await page.getByTestId('keygen-submit').click();

    await expect(page.getByTestId('author-key-card')).toHaveCount(1);
    const downloadBackupPromise = page.waitForEvent('download');
    await page.getByTestId('download-pending-backup').click();
    const backupDownload = await downloadBackupPromise;
    const backupPath = testInfo.outputPath('backup.chkey.json');
    await backupDownload.saveAs(backupPath);
    const backupJson = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    expect(backupJson.format).toBe('certified-handmade-key-backup');

    // Delete key, then restore from backup file
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete Key' }).click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(0);

    await page.getByTestId('restore-file-input').setInputFiles(backupPath);
    await page.getByTestId('restore-passphrase').fill('e2e-strong-passphrase');
    await page.getByTestId('restore-submit').click();
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    // 2. Create signed PNG with burned-in QR
    const artPath = testInfo.outputPath('artwork.png');
    fs.writeFileSync(artPath, buildTestArtworkPng());

    await page.goto('/create');
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await expect(page.getByText('160 × 120 px')).toBeVisible();

    await page.getByTestId('create-author-input').fill('YomiPlush');
    await page.getByTestId('create-title-input').fill('Moonlight E2E');
    await expect(page.getByTestId('create-license-summary')).toBeVisible();
    await page.getByTestId('create-license-select').selectOption('CC-BY-NC-4.0');
    await expect(page.getByTestId('create-license-summary')).toContainText('CC BY-NC 4.0');
    await page.getByTestId('create-sign-button').click();

    await expect(page.getByTestId('create-result-section')).toBeVisible();
    const signedDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-signed-png').click();
    const signedDownload = await signedDownloadPromise;
    const signedPngPath = testInfo.outputPath('signed.certified-handmade.png');
    await signedDownload.saveAs(signedPngPath);

    // Extract the proof URL route from the Open in Verify link
    const verifyHref = await page.getByTestId('open-local-verify').getAttribute('href');
    expect(verifyHref).toContain('/verify#proof=');

    // 3. Upload signed PNG on /verify -> reads QR + matches embedded artwork region (3 crisp dimensions, no Dimension D)
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(signedPngPath);
    await expect(page.getByTestId('verification-results')).toBeVisible();
    await expect(page.getByTestId('verify-license-summary')).toContainText('CC BY-NC 4.0');
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await expect(page.getByTestId('status-identity')).toContainText('Unknown / Unverified Key');
    await expect(page.getByTestId('status-assessment')).toHaveCount(0);
    await expect(page.getByTestId('assessment-details-card')).toHaveCount(0);

    // Trust this key locally from /verify
    await page.getByTestId('verify-trust-label-input').fill('YomiPlush Official');
    await page.getByTestId('verify-trust-btn').click();
    await expect(page.getByTestId('status-identity')).toContainText(
      'Locally Trusted Key (YomiPlush Official)',
    );

    // 4. Direct navigation to /verify#proof=... (without image first -> Not Checked, then attach original PNG -> Matched, then tampered PNG)
    await page.goto(verifyHref!);
    await expect(page.getByTestId('verify-proof-artwork-cta')).toBeVisible();
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Not Checked');

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

  test('SEO head metadata, ?hl=ja crawler support without GDPR bypass, FAQ section, static route shells, and zero CSP errors', async ({
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

    // Home SEO metadata & FAQ section
    await page.goto('/');
    await expect(page).toHaveTitle(/Hand-Drawing Artist Local DRM/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/',
    );
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
      'content',
      /Ed25519/,
    );
    const faqSection = page.getByTestId('home-faq-section');
    await expect(faqSection).toBeVisible();
    await expect(faqSection).toContainText('Frequently Asked Questions');

    await page.getByTestId('cookie-reject-btn').click();

    // Dynamic head tags update cleanly across SPA routes
    await page.goto('/create');
    await expect(page).toHaveURL(/\/create$/);
    await expect(page).toHaveTitle(/Create Hand-Drawn Art DRM Certificate/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/create',
    );

    await page.goto('/create?mode=studio');
    await expect(page).toHaveURL(/\/create\?mode=studio$/);
    await expect(page).toHaveTitle(/Manual In-Image QR Studio/);

    await page.goto('/verify');
    await expect(page).toHaveTitle(/Verify Hand-Drawn Artwork/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/verify',
    );

    await page.goto('/docs');
    await expect(page).toHaveTitle(/Cryptographic Architecture, SPEC & License Docs/);
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
    await expect(page.getByTestId('home-manifesto')).toContainText(
      'あなたの作品は、それを証明するプラットフォームより長く生き続けるべきだ。',
    );
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

  test('header GitHub & Sponsor Heart links, /qr-studio removal/redirect, and unified In-Image QR Studio inside /create', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    // Top-right GitHub link + adjacent Sponsor Heart link to its right
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

    // Switch back to /create, then toggle into studio mode inside /create
    await page.goto('/create');
    await page.getByTestId('create-mode-studio').click();
    await expect(page).toHaveURL(/\/create\?mode=studio$/);

    // Upload 320x240 artwork, adjust preset/opacity, verify readability, 1-click create key & sign
    const artPath = testInfo.outputPath('studio-art.png');
    fs.writeFileSync(artPath, buildTestArtworkPng(320, 240));
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await expect(page.getByTestId('qrstudio-preview-canvas')).toBeVisible();

    await page.getByTestId('qrstudio-preset-topLeft').click();
    await page.getByTestId('qrstudio-opacity-slider').fill('75');
    await expect(page.getByTestId('qrstudio-readability-badge')).toContainText(
      'Scannable in live preview',
    );

    await page.getByTestId('create-quick-keygen').click();
    await expect(page.getByTestId('create-key-select')).toBeVisible();
    await expect(page.getByTestId('create-key-backup-warning')).toBeVisible();

    await page.getByTestId('create-sign-button').click();
    await expect(page.getByTestId('create-result-section')).toBeVisible();

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('download-signed-png').click();
    const dl = await dlPromise;
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

    // Generate key & sign a test artwork in /create
    await page.goto('/create');
    await page.getByTestId('create-quick-keygen').click();
    await expect(page.getByTestId('create-key-select')).toBeVisible();

    const artBuffer = buildTestArtworkPng(160, 120);
    const artPath = testInfo.outputPath('mobile-art.png');
    fs.writeFileSync(artPath, artBuffer);
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await page.getByTestId('create-sign-button').click();
    await expect(page.getByTestId('create-result-section')).toBeVisible();

    const verifyHref = await page.getByTestId('open-local-verify').getAttribute('href');
    expect(verifyHref).toContain('/verify#proof=');

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('download-signed-png').click();
    const dl = await dlPromise;
    const signedPath = testInfo.outputPath('mobile-signed.png');
    await dl.saveAs(signedPath);
    const signedBytes = Array.from(fs.readFileSync(signedPath));

    // Open /verify#proof=... -> Step 2 CTA visible, paste image via ClipboardEvent on window
    await page.goto(verifyHref!);
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
    isMobile,
  }) => {
    await page.goto('/');
    await page.getByTestId('cookie-accept-btn').click();

    // Check Tutorial link in menu (Primary desktop nav or Mobile hamburger drawer)
    if (isMobile) {
      await page.getByRole('button', { name: 'Menu' }).click();
      const mobileNavLink = page.locator('nav[aria-label="Mobile"] a[href="/tutorial"]');
      await expect(mobileNavLink).toBeVisible();
      await mobileNavLink.click();
    } else {
      const desktopNavLink = page.locator('nav[aria-label="Primary"] a[href="/tutorial"]');
      await expect(desktopNavLink).toBeVisible();
      await desktopNavLink.click();
    }

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
    await expect(page.getByTestId('create-quick-keygen')).toBeVisible();
  });

  test('beginner-friendly 1-click keygen on /create and multilingual license guide on /docs', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-accept-btn').click();
    await expect(page.getByTestId('home-howto-section')).toBeVisible();
    await expect(page.getByTestId('home-tutorial-link')).toBeVisible();

    // Switch to Japanese and verify beginner guide & 1-click keygen on /create
    await page.getByTestId('lang-select').selectOption('ja');
    await expect(page.getByTestId('home-howto-section')).toContainText('3ステップ');

    await page.goto('/create');
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

    // Sign artwork and download portable .chproof.json
    const artPath = testInfo.outputPath('bundle-art.png');
    fs.writeFileSync(artPath, buildTestArtworkPng(140, 100));
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await page.getByTestId('create-sign-button').click();
    await expect(page.getByTestId('create-result-section')).toBeVisible();

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
});
