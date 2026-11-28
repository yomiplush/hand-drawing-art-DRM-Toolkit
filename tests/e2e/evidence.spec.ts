import fs from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { encode as encodePng } from 'fast-png';

function buildSamplePng(width = 160, height = 120): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 7 + y) & 0xff;
      data[i + 1] = (x * 3 + y * 5) & 0xff;
      data[i + 2] = (x + y * 9) & 0xff;
      data[i + 3] = 255;
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

async function enableAdvancedMode(page: Page): Promise<void> {
  await page.getByTestId('header-mode-toggle-advanced').click();
  await expect(page.getByTestId('advanced-cockpit-bar')).toBeVisible();
}

test.describe('Protocol v3 Self-Contained Metadata, Profiles, Creation Evidence (.chmevidence), and Compact QR', () => {
  test('full creation, local profile persistence, v3 QR self-contained verification, standalone rejection, Mode B/C verification, XSS safety, and mobile layout', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const externalRequests: string[] = [];
    const dialogs: string[] = [];
    const pageErrors: string[] = [];

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
    page.on('dialog', async (dlg) => {
      dialogs.push(dlg.message());
      await dlg.dismiss();
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/');
    await page.getByTestId('cookie-reject-btn').click();

    const artPath = testInfo.outputPath('detail-art.png');
    fs.writeFileSync(artPath, buildSamplePng());

    const sketchPath = testInfo.outputPath('rough-sketch.kra');
    fs.writeFileSync(sketchPath, Buffer.from('KRITA-SKETCH-EVIDENCE-TEST-PAYLOAD-123456'));

    const wrongFilePath = testInfo.outputPath('wrong-file.png');
    fs.writeFileSync(wrongFilePath, Buffer.from('NOT-THE-RECORDED-SKETCH'));

    // 1. Open /create -> enable Advanced Mode -> generate quick key -> upload image -> inspect live QR sizing card
    await page.goto('/create');
    await enableAdvancedMode(page);
    await page.getByTestId('create-quick-keygen').click();
    await expect(page.getByTestId('create-key-select')).toBeVisible();
    await page.getByTestId('create-image-input').setInputFiles(artPath);
    await expect(page.getByTestId('create-qr-sizing-card')).toBeVisible();

    // Expand Author, Artwork, Profile & Policy panel with multilingual & XSS-probe strings
    const identityToggle = page.locator('[data-testid="create-identity-advanced"] > button');
    await identityToggle.click();

    await page.getByTestId('create-profile-name-input').fill('Main Studio Brand');
    await page.getByTestId('create-author-input').fill('YomiPlush');
    await page.getByTestId('create-profile-website-input').fill('https://certified-handmade.com');
    await page.getByTestId('create-add-sns-btn').click();
    await page.getByTestId('create-sns-url-0').fill('https://social.example/@yomi');
    await page.getByTestId('create-save-profile-btn').click();
    await expect(page.getByTestId('create-identity-advanced')).toContainText('Saved');

    await page.getByTestId('create-title-input').fill('<script>alert(1)</script> 月光のアトリエ 🎨');
    await page
      .getByTestId('create-description-input')
      .fill('Theme: Nocturne\n<img src=x onerror=alert(2)>');

    // Artwork Details (Creation method, environment, and local evidence SHA-256) stays collapsed by default
    const detailsToggle = page.locator('[data-testid="create-artwork-details"] > button');
    await expect(detailsToggle).toHaveAttribute('aria-expanded', 'false');

    await detailsToggle.click();
    await expect(detailsToggle).toHaveAttribute('aria-expanded', 'true');

    await page.getByTestId('details-group-creation').click();
    await page.getByTestId('details-creation-method').selectOption('hand-drawn-no-ai');
    await page.getByTestId('details-creation-software').fill('Krita');
    await page.getByTestId('details-creation-hardware').fill('Linux workstation');
    await page.getByTestId('details-creation-input').fill('Wacom pen');
    await page.getByTestId('details-creation-notes').fill('<b>Single layer oil brush</b>');

    await page.getByTestId('details-group-evidence').click();
    await page.getByTestId('details-evidence-file-input').setInputFiles(sketchPath);
    await expect(
      page.getByTestId('details-evidence-list').locator('input[type="text"]').first(),
    ).toHaveValue('rough-sketch.kra');
    await expect(page.getByTestId('details-evidence-list')).toContainText('SHA-256:');

    // Check mobile viewport (375x667) horizontal overflow while expanded on /create
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(80);
    const createOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(createOverflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Sign artwork -> PNG download + reminder to save .chmevidence
    const signedDlPromise = page.waitForEvent('download');
    await page.getByTestId('create-sign-button').click();
    const signedDl = await signedDlPromise;
    await expect(page.getByTestId('create-result-section')).toBeVisible();
    const signedPngPath = testInfo.outputPath('artwork.certified-handmade.png');
    await signedDl.saveAs(signedPngPath);

    await expect(page.getByTestId('create-evidence-save-reminder')).toBeVisible();
    const evDlPromise = page.waitForEvent('download');
    await page.getByTestId('download-evidence-extension').click();
    const evDl = await evDlPromise;
    const chmEvidencePath = testInfo.outputPath('artwork.chmevidence');
    await evDl.saveAs(chmEvidencePath);
    await expect(page.getByTestId('create-evidence-save-reminder')).toBeHidden();
    await expect(page.getByTestId('download-evidence-extension')).toContainText('Saved');

    // Reload /create -> verify saved multi-profile defaults auto-populate
    await page.goto('/create');
    await page.locator('[data-testid="create-identity-advanced"] > button').click();
    await expect(page.getByTestId('create-author-input')).toHaveValue('YomiPlush');
    await expect(page.getByTestId('create-profile-website-input')).toHaveValue(
      'https://certified-handmade.com/',
    );
    await expect(page.getByTestId('create-sns-url-0')).toHaveValue('https://social.example/@yomi');

    // 2. Verify standalone .chmevidence rejection on /verify before primary proof, then clear it
    await page.goto('/verify');
    await page.locator('[data-testid="verify-evidence-panel"] > button').click();
    await page.getByTestId('verify-evidence-file-input').setInputFiles(chmEvidencePath);
    await expect(page.getByTestId('verify-standalone-evidence-error')).toBeVisible();
    await expect(page.getByTestId('verify-artwork-details-panel')).toHaveCount(0);
    await page.getByTestId('verify-clear-evidence-btn').click();
    await expect(page.getByTestId('verify-standalone-evidence-error')).toHaveCount(0);

    // 3. Attach ONLY the signed PNG (no .chmevidence) -> Protocol v3 self-contained QR metadata & Mode C verification!
    await page.getByTestId('verify-image-input').setInputFiles(signedPngPath);
    await expect(page.getByTestId('status-signature')).toContainText('Valid');
    await expect(page.getByTestId('verify-simple-verdict')).toHaveAttribute('data-verdict','pass');
    await expect(page.getByTestId('verify-standalone-evidence-error')).toHaveCount(0);
    await expect(page.getByTestId('verify-artwork-details-panel')).toHaveCount(0);

    const v3Card = page.getByTestId('verify-v3-metadata-card');
    await expect(v3Card).toBeVisible();
    await expect(page.getByTestId('verify-v3-description')).toContainText('<img src=x onerror=alert(2)>');
    await expect(page.getByTestId('verify-v3-website')).toHaveAttribute(
      'href',
      'https://certified-handmade.com/',
    );
    await expect(page.getByTestId('verify-v3-creation-method')).toContainText(
      'Hand-drawn (no generative AI)',
    );
    await expect(page.getByTestId('verify-v3-evidence-hashes')).toBeVisible();
    const v3TagCount = await v3Card.evaluate((el) => el.querySelectorAll('script, img, b').length);
    expect(v3TagCount).toBe(0);

    // Mode C against QR-embedded evidenceHashes WITHOUT .chmevidence
    await page.getByTestId('verify-local-evidence-files-input').setInputFiles(wrongFilePath);
    await expect(page.getByTestId('verify-v3-evidence-mismatched-files')).toContainText(
      'wrong-file.png',
    );
    await page.getByTestId('verify-local-evidence-files-input').setInputFiles(sketchPath);
    await expect(page.getByTestId('verify-v3-evidence-mismatched-files')).toHaveCount(0);
    await expect(page.getByTestId('verify-v3-evidence-record-0')).toContainText('Hash verified');

    // Clear supplied files and test Mode B + Mode C with .chmevidence extension
    await page.getByTestId('verify-clear-local-files-btn').click();
    await page.getByTestId('verify-evidence-file-input').setInputFiles(chmEvidencePath);

    const detailsPanel = page.getByTestId('verify-artwork-details-panel');
    await expect(detailsPanel).toBeVisible();
    await expect(page.getByTestId('verify-extension-status-badge')).toContainText(
      'Extension signature & proof binding valid',
    );
    await expect(detailsPanel).toContainText('<script>alert(1)</script> 月光のアトリエ 🎨');
    await expect(detailsPanel).toContainText('<img src=x onerror=alert(2)>');
    await expect(detailsPanel).toContainText('<b>Single layer oil brush</b>');
    await expect(page.getByTestId('verify-ext-creation-method')).toContainText(
      'Creation method: Hand-drawn (no generative AI) (declared by creator)',
    );
    await expect(detailsPanel).not.toContainText('100% Human-Made Verified');
    await expect(page.getByTestId('verify-evidence-unavailable-count')).toContainText('1');
    await expect(page.getByTestId('verify-evidence-record-0')).toContainText(
      'Unavailable (not supplied)',
    );

    const injectedTagCount = await detailsPanel.evaluate(
      (el) => el.querySelectorAll('script, img, b').length,
    );
    expect(injectedTagCount).toBe(0);

    // 4. Mode C with .chmevidence: wrong file -> mismatch; matching file -> Hash verified
    await page.getByTestId('verify-local-evidence-files-input').setInputFiles(wrongFilePath);
    await expect(page.getByTestId('verify-evidence-mismatched-files')).toContainText('wrong-file.png');

    await page.getByTestId('verify-local-evidence-files-input').setInputFiles(sketchPath);
    await expect(page.getByTestId('verify-evidence-mismatched-files')).toHaveCount(0);
    await expect(page.getByTestId('verify-evidence-verified-count')).toContainText('1 verified');
    await expect(page.getByTestId('verify-evidence-record-0')).toContainText('Hash verified');

    // Check mobile viewport overflow on /verify with rich details open
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(80);
    const verifyOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(verifyOverflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 5. Docs section displays .chmevidence Mode A/B/C documentation
    await page.goto('/docs');
    await expect(page.getByTestId('docs-evidence-section')).toBeVisible();
    await expect(page.getByTestId('docs-evidence-section')).toContainText('Mode A');
    await expect(page.getByTestId('docs-evidence-section')).toContainText('Mode B');
    await expect(page.getByTestId('docs-evidence-section')).toContainText('Mode C');

    expect(dialogs).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
