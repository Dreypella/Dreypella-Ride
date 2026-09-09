const { test, expect } = require('@playwright/test');

test.describe('Dreypella Ride — Partner Agreement Visibility', () => {
  test('partner agreement is shown for partner roles', async ({ page }) => {
    await page.goto('./register.html', { waitUntil: 'domcontentloaded' });

    const role = page.locator('#role');
    const partnerAgreement = page.locator('#partnerAgreementBox');

    await expect(role).toBeVisible();
    await expect(partnerAgreement).toBeAttached();

    for (const partnerRole of ['AMBASSADOR', 'VENDOR', 'WALKER', 'RIDER', 'DRIVER']) {
      await role.selectOption(partnerRole);
      await expect(partnerAgreement).toBeVisible();
    }
  });

  test('partner agreement is not shown for customer role', async ({ page }) => {
    await page.goto('./register.html', { waitUntil: 'domcontentloaded' });

    const role = page.locator('#role');
    const partnerAgreement = page.locator('#partnerAgreementBox');

    await role.selectOption('CUSTOMER');

    await expect(partnerAgreement).toBeHidden();
  });
});
