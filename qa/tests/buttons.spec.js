const { test, expect } = require('@playwright/test');

test.describe('Dreypella Ride — Homepage Buttons', () => {
  const buttons = [
    'BOOK A RIDE',
    'SEND A PACKAGE',
    'BECOME A CAMPUS EARNER',
    'JOIN AS A VENDOR'
  ];

  for (const label of buttons) {
    test(`${label} control is visible and actionable`, async ({ page }) => {
      await page.goto('./', { waitUntil: 'domcontentloaded' });

      const control = page.getByText(label, { exact: true }).first();

      await expect(control).toBeVisible();

      const tagName = await control.evaluate(element => element.tagName);

      expect(['A', 'BUTTON']).toContain(tagName);
    });
  }
});
