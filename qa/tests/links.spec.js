const { test, expect } = require('@playwright/test');

test('homepage local links do not return 404/4xx/5xx', async ({ page, request }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });

  const links = await page.locator('a[href]').evaluateAll(anchors =>
    [...new Set(
      anchors
        .map(a => a.href)
        .filter(href =>
          href.startsWith(window.location.origin) &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:')
        )
    )]
  );

  const failures = [];

  for (const url of links) {
    try {
      const response = await request.get(url, { failOnStatusCode: false });

      if (response.status() >= 400) {
        failures.push(`${response.status()} ${url}`);
      }
    } catch (error) {
      failures.push(`REQUEST_FAILED ${url}`);
    }
  }

  expect(failures, `Broken local links:\n${failures.join('\n')}`).toEqual([]);
});
