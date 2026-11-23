import fs from 'node:fs';
import http from 'node:http';
import { expect, test } from '@playwright/test';
import { decode as decodePng, encode as encodePng } from 'fast-png';

function buildTestArtworkPng(width = 240, height = 180): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 7 + y * 3) & 0xff;
      data[i + 1] = (x * 13 + y * 5) & 0xff;
      data[i + 2] = (x * 17 + y * 11) & 0xff;
      data[i + 3] = x < 24 && y < 24 ? 0 : 255;
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

function sendRawLoopbackRequest(opts: {
  method: string;
  path: string;
  hostHeader?: string;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 43777,
        method: opts.method,
        path: opts.path,
        headers: opts.hostHeader ? { Host: opts.hostHeader } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test.describe('Standalone Linux Binary Offline E2E & HTTP Hardening', () => {
  test('enforces loopback Host validation, read-only methods, traversal blocking, and security headers', async () => {
    const health = await sendRawLoopbackRequest({
      method: 'GET',
      path: '/__chm_health',
    });
    expect(health.statusCode).toBe(200);
    expect(health.headers['x-frame-options']).toBe('DENY');
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['content-security-policy']).toContain("default-src 'self'");
    const healthJson = JSON.parse(health.body) as { app: string; status: string; version: string };
    expect(healthJson.app).toBe('certified-handmade-standalone');
    expect(healthJson.status).toBe('ok');

    // DNS rebinding defense: forged Host header -> 403 Forbidden
    const rebindRes = await sendRawLoopbackRequest({
      method: 'GET',
      path: '/',
      hostHeader: 'evil.example:43777',
    });
    expect(rebindRes.statusCode).toBe(403);

    // State-changing HTTP methods rejected -> 405 Method Not Allowed
    const postRes = await sendRawLoopbackRequest({
      method: 'POST',
      path: '/',
    });
    expect(postRes.statusCode).toBe(405);
    expect(postRes.headers.allow).toBe('GET, HEAD');

    // Traversal sequences blocked -> 400 Bad Request
    const encodedTraversal = await sendRawLoopbackRequest({
      method: 'GET',
      path: '/%2e%2e/etc/passwd',
    });
    expect(encodedTraversal.statusCode).toBe(400);

    const rawTraversal = await sendRawLoopbackRequest({
      method: 'GET',
      path: '/../etc/passwd',
    });
    expect(rawTraversal.statusCode).toBe(400);
  });

  test('completes full keygen, v1/v2 signing, PNG/bundle export, verification, and key backup verify completely offline', async ({
    page,
  }, testInfo) => {
    const externalRequests: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // Hard block any non-loopback network traffic at the browser context level
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (
        url.protocol === 'blob:' ||
        url.protocol === 'data:' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === 'localhost'
      ) {
        await route.continue();
        return;
      }
      externalRequests.push(route.request().url());
      await route.abort('internetdisconnected');
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('home-tagline')).toContainText('Your Art. Your Rights.');
    await page.getByTestId('cookie-reject-btn').click();

    // 1. Passphrase quick-keygen + encrypted backup on /create
    await page.goto('/create');
    await page.getByTestId('create-quick-passphrase').fill('standalone-offline-pass');
    await page.getByTestId('create-quick-keygen').click();
    await expect(page.getByTestId('create-key-select')).toBeVisible();
    await expect(page.getByTestId('create-key-backup-warning')).toBeVisible();

    const backupDlPromise = page.waitForEvent('download');
    await page.getByTestId('create-download-pending-backup').click();
    const backupDl = await backupDlPromise;
    const backupPath = testInfo.outputPath('standalone-key.chkey.json');
    await backupDl.saveAs(backupPath);
    await expect(page.getByTestId('create-key-backup-warning')).toBeHidden();

    // 2. Sign Protocol v1 (Outer QR Border) & export signed PNG + .chproof.json
    const artBuffer = buildTestArtworkPng(240, 180);
    const artPath = testInfo.outputPath('standalone-art.png');
    fs.writeFileSync(artPath, artBuffer);

    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await page.locator('[data-testid="create-identity-advanced"] > button').click();
    await page.getByTestId('create-author-input').fill('OfflineArtist');
    await page.getByTestId('create-title-input').fill('Standalone V1');

    const v1PngDlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const v1PngDl = await v1PngDlPromise;
    await expect(page.getByTestId('create-result-section')).toBeVisible();
    await expect(page.getByTestId('download-signed-png')).toBeVisible();
    const v1PngPath = testInfo.outputPath('standalone-v1.certified-handmade.png');
    await v1PngDl.saveAs(v1PngPath);

    await page.locator('[data-testid="create-result-technical"] > button').click();
    const bundleDlPromise = page.waitForEvent('download');
    await page.getByTestId('download-proof-bundle').click();
    const bundleDl = await bundleDlPromise;
    const bundlePath = testInfo.outputPath('standalone-v1.chproof.json');
    await bundleDl.saveAs(bundlePath);

    // 3. Reopen & verify v1 PNG completely offline on standalone loopback origin
    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(v1PngPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await expect(page.getByTestId('status-identity')).toContainText('Unverified');

    // Verify .chproof.json + tampered PNG rejection
    await page.goto('/verify');
    await page.getByTestId('verify-tab-proof').click();
    await page.getByTestId('verify-proof-bundle-input').setInputFiles(bundlePath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Not Checked');

    const decoded = decodePng(artBuffer);
    decoded.data[4] ^= 0xff;
    const tamperedPath = testInfo.outputPath('standalone-tampered.png');
    fs.writeFileSync(tamperedPath, Buffer.from(encodePng(decoded)));
    await page.getByTestId('verify-attach-artwork-input').setInputFiles(tamperedPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Mismatched');

    // 4. Sign Protocol v2 (In-Image QR Overlay) in Studio mode & verify qrMask + trust key
    await page.goto('/create?mode=studio');
    const studioArtPath = testInfo.outputPath('standalone-studio-art.png');
    fs.writeFileSync(studioArtPath, buildTestArtworkPng(320, 240));
    await page.getByTestId('create-image-input').setInputFiles(studioArtPath);
    await expect(page.getByTestId('qrstudio-preview-canvas')).toBeVisible();
    await page.getByTestId('qrstudio-preset-bottomRight').click();
    await page.locator('[data-testid="create-qr-advanced"] > button').click();
    await page.getByTestId('qrstudio-opacity-slider').fill('80');
    await expect(page.getByTestId('qrstudio-readability-badge')).toContainText(
      'Scannable in live preview',
    );

    const v2PngDlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const v2PngDl = await v2PngDlPromise;
    await expect(page.getByTestId('create-result-section')).toBeVisible();
    const v2PngPath = testInfo.outputPath('standalone-v2.certified-handmade.png');
    await v2PngDl.saveAs(v2PngPath);

    await page.goto('/verify');
    await page.getByTestId('verify-image-input').setInputFiles(v2PngPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('status-integrity')).toContainText('Matched');
    await expect(page.getByTestId('verification-results')).toContainText('in-image-masked');
    await expect(page.getByTestId('verify-qr-mask-notice')).toBeVisible();

    await page.getByTestId('verify-trust-label-input').fill('Standalone Local Artist');
    await page.getByTestId('verify-trust-btn').click();
    await expect(page.getByTestId('status-identity')).toContainText(
      'Trusted (Standalone Local Artist)',
    );

    // 5. Verify Backup Only on /keys without duplicating IndexedDB records
    await page.goto('/keys');
    await page.getByTestId('keys-help-btn').click();
    await expect(page.getByTestId('keys-standalone-storage-note')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('author-key-card')).toHaveCount(1);
    await page.getByTestId('restore-file-input').setInputFiles(backupPath);
    await page.getByTestId('restore-passphrase').fill('standalone-offline-pass');
    await page.getByTestId('verify-backup-btn').click();
    await expect(page.getByTestId('restore-status-msg')).toContainText('Verified');
    await expect(page.getByTestId('author-key-card')).toHaveCount(1);

    expect(externalRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
