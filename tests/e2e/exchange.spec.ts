import fs from 'node:fs';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { encode as encodePng } from 'fast-png';

function buildSampleArtworkPng(width = 160, height = 120): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 7 + y * 3) & 0xff;
      data[i + 1] = (x * 5 + y * 11) & 0xff;
      data[i + 2] = (x * 13 + y) & 0xff;
      data[i + 3] = 255;
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

async function enableAdvancedMode(page: Page): Promise<void> {
  await page.getByTestId('header-mode-toggle-advanced').click();
  await expect(page.getByTestId('advanced-cockpit-bar')).toBeVisible();
}

test.describe('CHM-Exchange Critical End-to-End Integration', () => {
  test('cross-browser key exchange, unverified start, explicit trust, artwork verification, trust removal, and QR PNG upload', async ({
    browser,
  }, testInfo) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];

    for (const p of [pageA, pageB]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      p.on('pageerror', (err) => pageErrors.push(err.message));
      p.on('request', (req) => {
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
    }

    try {
      // 1. Artist (Context A) generates author identity on /keys and opens /exchange shortcut
      await pageA.goto('/');
      await pageA.getByTestId('cookie-reject-btn').click();

      // Switch to Advanced Mode via top header pill & check Exchange entry in unfolded Cockpit Bar
      await pageA.getByTestId('header-mode-toggle-advanced').click();
      await expect(pageA.getByTestId('cockpit-exchange-link')).toBeVisible();

      await pageA.goto('/keys');
      await pageA.getByTestId('keygen-label').fill('Artist Studio A');
      await pageA.getByTestId('keygen-submit').click();
      await expect(pageA.getByTestId('author-key-card')).toHaveCount(1);

      await pageA.getByTestId('keys-share-exchange-link').click();
      await expect(pageA).toHaveURL(/\/exchange\?identity=/);
      await expect(pageA.getByTestId('exchange-page')).toBeVisible();

      const shortFpA = (await pageA.getByTestId('chmx-share-fp-short').innerText()).trim();
      expect(shortFpA).toMatch(/^CHM-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

      // 2. Export exchange URL, QR PNG, and JSON bundle (zero private keys exposed)
      const shareUrl = await pageA.getByTestId('chmx-share-url').inputValue();
      expect(shareUrl).toContain('/exchange#key=');
      expect(shareUrl).not.toContain('privateKey');
      expect(shareUrl).not.toContain('encryptedBackup');

      const qrDlPromise = pageA.waitForEvent('download');
      await pageA.getByTestId('chmx-download-qr-btn').click();
      const qrDl = await qrDlPromise;
      const qrPngPath = testInfo.outputPath('artist-a-exchange-qr.png');
      await qrDl.saveAs(qrPngPath);
      expect(fs.readFileSync(qrPngPath).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const jsonDlPromise = pageA.waitForEvent('download');
      await pageA.getByTestId('chmx-export-json-btn').click();
      const jsonDl = await jsonDlPromise;
      const jsonPath = testInfo.outputPath('artist-a-exchange.json');
      await jsonDl.saveAs(jsonPath);
      const exportedJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      expect(exportedJson.format).toBe('chm-exchange-public-key');
      expect(exportedJson.version).toBe(1);
      expect(exportedJson.privateKey).toBeUndefined();
      expect(exportedJson.webCryptoPrivateKey).toBeUndefined();

      // Also sign an artwork in Context A so Context B can verify it later
      const artPath = testInfo.outputPath('artist-a-art.png');
      fs.writeFileSync(artPath, buildSampleArtworkPng());
      await pageA.goto('/create');
      await pageA.getByTestId('create-image-input').setInputFiles(artPath);
      await pageA.locator('[data-testid="create-identity-advanced"] > button').click();
      await pageA.getByTestId('create-author-input').fill('Artist Studio A');
      await pageA.getByTestId('create-title-input').fill('Exchange Integration Test');

      const signedDlPromise = pageA.waitForEvent('download');
      await pageA.getByTestId('create-sign-button').click();
      const signedDl = await signedDlPromise;
      await expect(pageA.getByTestId('create-result-section')).toBeVisible();
      await expect(pageA.getByTestId('download-signed-png')).toBeVisible();
      const signedPngPath = testInfo.outputPath('signed-by-artist-a.png');
      await signedDl.saveAs(signedPngPath);

      // 3. Collector (Context B - completely separate IndexedDB/session) opens the exchange #key= URL
      await pageB.goto(shareUrl);
      await expect(pageB.getByTestId('cookie-consent-banner')).toBeVisible();
      await pageB.getByTestId('cookie-reject-btn').click();

      // 4. Confirm the imported key ALWAYS starts Unverified
      await expect(pageB.getByTestId('chmx-inspected-result')).toBeVisible();
      await expect(pageB.getByTestId('chmx-receive-trust-status')).toContainText(
        'Unverified / Not Locally Trusted',
      );
      await expect(pageB.getByTestId('chmx-inspected-fp-short')).toHaveText(shortFpA);
      await expect(pageB.getByTestId('chmx-confirm-trust-btn')).toBeDisabled();

      // 5. Explicitly confirm & register as Trusted Artist
      await pageB.getByTestId('chmx-confirm-label-input').fill('Artist A (Confirmed)');
      await pageB.getByTestId('chmx-confirm-note-input').fill('Checked via website & QR');
      await pageB.getByTestId('chmx-confirm-checkbox').check();
      await expect(pageB.getByTestId('chmx-confirm-trust-btn')).toBeEnabled();
      await pageB.getByTestId('chmx-confirm-trust-btn').click();

      await expect(pageB.getByTestId('chmx-receive-trust-status')).toContainText(
        'Locally Trusted Key (Artist A (Confirmed))',
      );
      await expect(pageB.getByTestId('chmx-duplicate-notice')).toBeVisible();

      // Upload downloaded QR PNG to confirm duplicate detection & QR decoding end-to-end
      await pageB.getByTestId('chmx-receive-mode-qr').click();
      await pageB.getByTestId('chmx-qr-file-input').setInputFiles(qrPngPath);
      await expect(pageB.getByTestId('chmx-duplicate-notice')).toBeVisible();

      // 6 & 7. Verify artwork signed by Context A on /verify -> Valid + Matched + Trusted (Artist A (Confirmed))
      await pageB.goto('/verify');
      await pageB.getByTestId('verify-image-input').setInputFiles(signedPngPath);
      await expect(pageB.getByTestId('status-signature')).toContainText('Valid');
      await expect(pageB.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');
      await expect(pageB.getByTestId('status-identity')).toContainText(
        'Trusted (Artist A (Confirmed))',
      );

      // Verify shortcut from /verify -> /exchange?inspect=... (in Advanced Mode)
      await enableAdvancedMode(pageB);
      await pageB.getByTestId('verify-inspect-exchange-link').click();
      await expect(pageB).toHaveURL(/\/exchange\?inspect=/);
      await expect(pageB.getByTestId('chmx-receive-trust-status')).toContainText(
        'Locally Trusted Key (Artist A (Confirmed))',
      );

      // 8. Remove trust in Trusted Artists tab
      await pageB.getByTestId('chmx-tab-trusted').click();
      await expect(pageB.getByTestId('chmx-trusted-item')).toHaveCount(1);
      pageB.once('dialog', (d) => d.accept());
      await pageB.getByTestId('chmx-remove-trusted-btn').click();
      await expect(pageB.getByTestId('chmx-trusted-empty')).toBeVisible();

      // 9. Re-verify signed PNG -> Signature Valid & Matched, Identity returns to Unverified
      await pageB.goto('/verify');
      await pageB.getByTestId('verify-image-input').setInputFiles(signedPngPath);
      await expect(pageB.getByTestId('status-signature')).toContainText('Valid');
      await expect(pageB.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');
      await expect(pageB.getByTestId('status-identity')).toContainText('Unverified');

      // Confirm dist/exchange.html static SEO shell exists with canonical link
      const exchangeHtmlPath = path.resolve(process.cwd(), 'dist', 'exchange.html');
      expect(fs.existsSync(exchangeHtmlPath)).toBe(true);
      expect(fs.readFileSync(exchangeHtmlPath, 'utf8')).toContain(
        '<link rel="canonical" href="https://www.certified-handmade.com/exchange" />',
      );

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(externalRequests).toEqual([]);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('works offline via Service Worker on /exchange#key=...', async ({ page, context }) => {
    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });
    await page.waitForTimeout(800);

    await page.goto('/keys');
    await page.getByTestId('keygen-label').fill('Offline Exchange Key');
    await page.getByTestId('keygen-submit').click();
    await page.getByTestId('keys-share-exchange-link').click();
    const shareUrl = await page.getByTestId('chmx-share-url').inputValue();
    const shortFp = (await page.getByTestId('chmx-share-fp-short').innerText()).trim();

    await context.setOffline(true);

    await page.goto(shareUrl);
    await expect(page.getByTestId('chmx-inspected-fp-short')).toHaveText(shortFp);
    await expect(page.getByTestId('chmx-receive-trust-status')).toContainText('Unverified');

    await context.setOffline(false);
  });
});
