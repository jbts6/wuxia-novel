import { test, expect } from '@playwright/test';

test('调试数据加载', async ({ page }) => {
  const logs: string[] = [];

  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // 先访问首页
  await page.goto('/');
  await page.waitForTimeout(1000);

  // 点击第一个书籍卡片
  await page.click('.grid > a:first-child');
  await page.waitForTimeout(3000);

  console.log('=== Current URL ===');
  console.log(page.url());

  console.log('\n=== Console Logs ===');
  logs.forEach((log) => console.log(log));

  // 检查页面内容
  const body = await page.textContent('body');
  console.log('\n=== Page Content (first 500 chars) ===');
  console.log(body?.substring(0, 500));

  await page.screenshot({ path: 'test-results/debug3.png', fullPage: true });
});
