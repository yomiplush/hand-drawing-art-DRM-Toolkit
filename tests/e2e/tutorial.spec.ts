import { expect, test } from '@playwright/test';

test.describe('Interactive 3D Tutorial onboarding & relaunch flow', () => {
  test('shows on first visit, persists skip across reload, and reopens from header button', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. First visit automatically shows the 3D tutorial modal
    const modal = page.getByTestId('interactive-tutorial-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('tutorial-3d-stage')).toBeVisible();
    await expect(page.getByTestId('tutorial-step-counter')).toContainText('1 / 4');

    // Step forward once to verify step transition
    await page.getByTestId('tutorial-next-btn').click();
    await expect(page.getByTestId('tutorial-step-counter')).toContainText('2 / 4');

    // 2. Skip via fixed bottom-end Skip button
    await page.getByTestId('tutorial-skip-btn').click();
    await expect(modal).toBeHidden();

    // 3. Reloading does not auto-show the tutorial again
    await page.reload();
    await expect(modal).toBeHidden();

    // 4. Header tutorial button reopens the interactive 3D tutorial anytime
    await page.getByTestId('header-tutorial-btn').click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('tutorial-step-counter')).toContainText('1 / 4');
  });
});
