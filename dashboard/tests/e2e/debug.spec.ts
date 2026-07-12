import { test } from '@playwright/test';

test('调试总览页', async ({ page }) => {
  const logs: string[] = [];
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  await page.goto('/book/金庸%2F天龙八部/overview');
  await page.waitForTimeout(3000);

  console.log('=== Console Logs ===');
  logs.forEach((log) => console.log(log));

  console.log('\n=== Errors ===');
  errors.forEach((err) => console.log(err));

  await page.screenshot({ path: 'test-results/debug-overview.png', fullPage: true });
});
