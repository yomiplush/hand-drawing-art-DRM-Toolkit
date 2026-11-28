import { expect, test } from '@playwright/test';

test.describe('Interactive 3D tutorial on-demand flow', () => {
  test('does not block the first action, persists skip, and reopens from the header', async ({
    page,
  }) => {
    await page.goto('/');

    const modal = page.getByTestId('interactive-tutorial-modal');
    const headerButton = page.getByTestId('header-tutorial-btn');

    // 1. First visit no longer covers the onboarding card with a modal.
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('simple-keys-card')).toBeVisible();
    await expect(headerButton).toBeVisible();

    // 2. The tutorial opens on demand from the header button.
    await headerButton.click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('tutorial-3d-stage')).toBeVisible();
    await expect(page.getByTestId('tutorial-step-counter')).toContainText('1 / 4');

    await page.getByTestId('tutorial-next-btn').click();
    await expect(page.getByTestId('tutorial-step-counter')).toContainText('2 / 4');

    // 3. Skip closes it and the choice survives a reload.
    await page.getByTestId('tutorial-skip-btn').click();
    await expect(modal).toBeHidden();
    await page.reload();
    await expect(modal).toBeHidden();

    // 4. It can still be reopened at any time.
    await headerButton.click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('tutorial-step-counter')).toContainText('1 / 4');
  });
});
