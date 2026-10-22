const { test, expect } = require('@playwright/test');

test.describe('Dreypella Ride — Navigation', () => {
  const pages = [
    { name: 'Home', path: './' },
    { name: 'Login', path: './login.html' },
    { name: 'Register', path: './register.html' },
    { name: 'Terms', path: './terms.html' },
    { name: 'Privacy', path: './privacy.html' },
    { name: 'Partner Agreement', path: './partner-agreement.html' },
  ];

  for (const item of pages) {
    test(`${item.name} page loads`, async ({ page }) => {
      const response = await page.goto(item.path, {
        waitUntil: 'domcontentloaded'
      });

      expect(response).not.toBeNull();
      expect(response.status()).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();
    });
  }

  test('homepage navigation links have destinations', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const links = await page.locator('a').evaluateAll(anchors =>
      anchors.map(a => ({
        text: (a.textContent || '').trim(),
        href: a.getAttribute('href')
      }))
    );

    const importantLinks = links.filter(link =>
      [
        'HOME',
        'RIDE',
        'DELIVERY',
        'MARKETPLACE',
        'JOBS',
        'EARN',
        'ABOUT US',
        'CONTACT',
        'LOGIN',
        'SIGN UP'
      ].includes(link.text)
    );

    expect(importantLinks.length).toBeGreaterThan(0);

    for (const link of importantLinks) {
      expect(link.href).not.toBeNull();
      expect(link.href.trim()).not.toBe('');
    }
  });
});
