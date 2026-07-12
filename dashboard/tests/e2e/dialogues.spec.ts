import { test } from '@playwright/test';

test('验证对话集显示中文名', async ({ page }) => {
  await page.goto('/');
  await page.click('.grid > a:first-child');
  await page.waitForTimeout(2000);

  // 点击对话集
  await page.click('text=对话集');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/dialogues.png', fullPage: true });
});
