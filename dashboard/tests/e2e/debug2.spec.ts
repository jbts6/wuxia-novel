import { test } from '@playwright/test';

test('调试白屏问题', async ({ page }) => {
  const logs: string[] = [];
  const errors: string[] = [];

  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  // 访问书籍路径
  await page.goto('/book/金庸%2F天龙八部/overview');
  await page.waitForTimeout(5000);

  console.log('=== Console Logs ===');
  logs.forEach((log) => console.log(log));

  console.log('\n=== Errors ===');
  errors.forEach((err) => console.log(err));

  // 检查页面内容
  const body = await page.textContent('body');
  console.log('\n=== Page Content ===');
  console.log(body?.substring(0, 500));

  await page.screenshot({ path: 'test-results/debug2.png', fullPage: true });
});
