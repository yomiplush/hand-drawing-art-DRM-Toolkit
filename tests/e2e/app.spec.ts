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
  test('full key lifecycle, signing, PNG QR burning, verification, tamper detection, trust, wave bg, and multilingual switching', async ({
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

    // Multi-language switching (JA, zh-CN, ko, ru, uk, ar RTL, back to EN)
    const langSelect = page.getByTestId('lang-select');
    await langSelect.selectOption('ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
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

    // 3. Upload signed PNG on /verify -> reads QR + matches embedded artwork region
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(signedPngPath);
    await expect(page.getByTestId('verification-results')).toBeVisible();
    await expect(page.getByTestId('verify-license-summary')).toContainText('CC BY-NC 4.0');
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await expect(page.getByTestId('status-identity')).toContainText('Unknown / Unverified Key');
    await expect(page.getByTestId('status-assessment')).toContainText('Not Assessed');

    // Trust this key locally from /verify
    await page.getByTestId('verify-trust-label-input').fill('YomiPlush Official');
    await page.getByTestId('verify-trust-btn').click();
    await expect(page.getByTestId('status-identity')).toContainText(
      'Locally Trusted Key (YomiPlush Official)',
    );

    // 4. Direct navigation to /verify#proof=... (without image first, then attach original PNG, then tampered PNG)
    await page.goto(verifyHref!);
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


  test('beginner-friendly 1-click keygen on /create and multilingual license guide on /docs', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('cookie-accept-btn').click();
    await expect(page.getByTestId('home-howto-section')).toBeVisible();

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
});
