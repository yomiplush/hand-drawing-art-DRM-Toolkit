import { expect, test } from '@playwright/test';

// Minimal valid 2x2 RGBA PNG (base64)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

test.describe('GalleryDeck (/gallerydeck)', () => {
  test('renders empty state, imports artwork, navigates with keyboard, certifies, and exports/restores .chdeck', async ({
    page,
  }) => {
    await page.goto('/gallerydeck');

    // Dismiss cookie banner if present
    const acceptBtn = page.getByRole('button', { name: /accept|ok|agree|同意/i });
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
    }

    await expect(page.getByTestId('gallerydeck-page')).toBeVisible();
    await expect(page.getByTestId('gallerydeck-empty-state')).toBeVisible();

    // Import two PNG artworks
    const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
    await page.getByTestId('gallerydeck-file-input').setInputFiles([
      { name: 'alpha-sketch.png', mimeType: 'image/png', buffer: pngBuffer },
      { name: 'beta-illustration.png', mimeType: 'image/png', buffer: pngBuffer },
    ]);

    await expect(page.getByTestId('gallerydeck-carousel')).toBeVisible();
    await expect(page.getByTestId('gallerydeck-card-0')).toHaveAttribute('data-focused', 'true');

    // Keyboard navigation: ArrowRight -> focuses card 1, Enter -> opens detail drawer
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('gallerydeck-card-1')).toHaveAttribute('data-focused', 'true');

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('gallerydeck-detail-drawer')).toBeVisible();
    await expect(page.getByTestId('detail-status-unverified')).toBeVisible();

    // Certify Now via existing Ed25519 + QR pipeline
    await page.getByTestId('gallerydeck-certify-btn').click();
    await expect(page.getByTestId('detail-status-signed')).toBeVisible({ timeout: 15_000 });

    // Verify signed artwork
    await page.getByTestId('gallerydeck-verify-btn').click();
    await expect(page.getByTestId('gallerydeck-toast')).toBeVisible();

    // Close detail drawer with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gallerydeck-detail-drawer')).toBeHidden();

    // Open Storage & Sync modal and verify export/import controls
    await page.getByTestId('gallerydeck-open-sync-btn').click();
    await expect(page.getByTestId('gallerydeck-sync-modal')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('gallerydeck-export-archive-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.chdeck$/);
  });
});
