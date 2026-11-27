import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PRIMARY_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/create', name: 'Create' },
  { path: '/verify', name: 'Verify' },
  { path: '/keys', name: 'Keys' },
  { path: '/exchange', name: 'Exchange' },
  { path: '/storage', name: 'Storage' },
  { path: '/tutorial', name: 'Tutorial' },
] as const;

test.describe('WCAG 2.1 AA Accessibility Audits', () => {
  test.beforeEach(async ({ page }) => {
    // Skip first-run tutorial & cookie banner so pages are audited in their primary interactive state
    await page.addInitScript(() => {
      window.localStorage.setItem('chm_interactive_tutorial_v1', 'completed');
      window.localStorage.setItem('chm_cookie_consent_v1', 'accepted');
    });
  });

  for (const route of PRIMARY_ROUTES) {
    test(`${route.name} (${route.path}) has no critical or serious WCAG 2.1 AA violations`, async ({
      page,
    }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' });
      await expect(page.locator('#main-content')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blockingViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      expect(
        blockingViolations,
        `WCAG 2.1 AA violations on ${route.path}:\n${JSON.stringify(
          blockingViolations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => n.html),
          })),
          null,
          2,
        )}`,
      ).toEqual([]);
    });
  }

  test('skip link, dynamic lang/title sync, and modal Escape/focus restoration work', async ({
    page,
  }) => {
    await page.goto('/?hl=ja', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page).toHaveTitle(/Certified Handmade/);

    // Skip link exists and targets #main-content
    const skipLink = page.getByTestId('skip-to-main-link');
    await expect(skipLink).toHaveAttribute('href', '#main-content');

    // Switch language via ?hl=en
    await page.goto('/verify?hl=en', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Changelog modal: open -> Escape closes -> focus returns to trigger button
    const changelogBtn = page.getByTestId('footer-changelog-btn');
    await changelogBtn.click();
    await expect(page.getByTestId('changelog-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('changelog-modal')).toBeHidden();
    await expect(changelogBtn).toBeFocused();
  });
});
