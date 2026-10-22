const { test, expect } = require('@playwright/test');

test.describe('Dreypella Ride — Registration', () => {
  test('registration page loads and contains required agreement controls', async ({ page }) => {
    await page.goto('./register.html', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toBeVisible();

    await expect(page.locator('#termsAgreement')).toBeVisible();
    await expect(page.locator('#privacyAgreement')).toBeVisible();

    await expect(page.locator('a[href="terms.html"]')).toBeVisible();
    await expect(page.locator('a[href="privacy.html"]')).toBeVisible();
  });

  test('partner agreement control exists for partner registration', async ({ page }) => {
    await page.goto('./register.html', { waitUntil: 'domcontentloaded' });

    const role = page.locator('#role');
    await expect(role).toBeVisible();

    const partnerAgreement = page.locator('#partnerAgreementBox');

    await expect(partnerAgreement).toBeAttached();
  });
});
