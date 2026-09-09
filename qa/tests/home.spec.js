const { test, expect } = require('@playwright/test');

test.describe('Dreypella Ride — Homepage', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('./', { waitUntil: 'domcontentloaded' });

    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(400);

    await expect(page.locator('body')).toBeVisible();
  });

  test('homepage has a meaningful title', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const title = await page.title();

    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('main navigation is present', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const nav = page.locator('nav').first();

    await expect(nav).toBeVisible();

    for (const label of ['HOME', 'RIDE', 'DELIVERY', 'MARKETPLACE', 'JOBS', 'EARN', 'ABOUT US', 'CONTACT']) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('login and sign up controls are present', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('LOGIN', { exact: true })).toBeVisible();
    await expect(page.getByText('SIGN UP', { exact: true })).toBeVisible();
  });

  test('important homepage sections are present', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    for (const text of [
      'BY STUDENTS, FOR STUDENTS.',
      'BOOK A RIDE',
      'SEND A PACKAGE',
      'BECOME A CAMPUS EARNER',
      'JOIN AS A VENDOR',
      'HOW IT WORKS'
    ]) {
      await expect(page.getByText(text, { exact: true })).toBeVisible();
    }
  });
});
