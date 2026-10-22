const { test, expect } = require('@playwright/test');

test.describe('Dreypella Ride — Legal Pages', () => {
  const legalPages = [
    {
      name: 'Terms & Conditions',
      path: './terms.html',
      requiredText: 'Terms & Conditions'
    },
    {
      name: 'Privacy Policy',
      path: './privacy.html',
      requiredText: 'Privacy Policy'
    },
    {
      name: 'Partner Agreement',
      path: './partner-agreement.html',
      requiredText: 'Partner Agreement'
    }
  ];

  for (const legalPage of legalPages) {
    test(`${legalPage.name} contains required legal content`, async ({ page }) => {
      await page.goto(legalPage.path, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(legalPage.requiredText, { exact: true }).first()).toBeVisible();

      const bodyText = await page.locator('body').innerText();

      expect(bodyText).toMatch(/Version\s+1\.0/i);
      expect(bodyText).toMatch(/September\s+1,\s+2026/i);
    });
  }
});
