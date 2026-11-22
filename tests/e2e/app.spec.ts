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
  test('full key lifecycle, signing, PNG QR burning, verification, tamper detection, trust, and JA/EN toggle', async ({
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

    // Toggle Japanese <-> English
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

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
    await page.getByTestId('create-license-select').selectOption('CC-BY-NC-4.0');
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

  test('works offline via Service Worker on /verify#proof=...', async ({ page, context }, testInfo) => {
    await page.goto('/');
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
