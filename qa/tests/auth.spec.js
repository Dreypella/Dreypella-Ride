const { test, expect } = require('@playwright/test');

test.describe('Dreypella Ride — Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('./login.html', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toBeVisible();

    await expect(
      page.locator('input[type="email"], input[name="email"], #email').first()
    ).toBeVisible();

    await expect(
      page.locator('input[type="password"], input[name="password"], #password').first()
    ).toBeVisible();
  });

  test('registration link is available from login page', async ({ page }) => {
    await page.goto('./login.html', { waitUntil: 'domcontentloaded' });

    const registerLink = page.locator('a[href*="register"]').first();

    await expect(registerLink).toBeVisible();
  });

  test('forgot password link is available from login page', async ({ page }) => {
    await page.goto('./login.html', { waitUntil: 'domcontentloaded' });

    const forgotLink = page.locator('a[href*="forgot-password"]').first();

    await expect(forgotLink).toBeVisible();
  });
});
