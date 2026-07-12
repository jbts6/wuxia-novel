import { test } from '@playwright/test';

test('详情面板截图', async ({ page }) => {
  await page.goto('/金庸/天龙八部/characters');
  await page.waitForTimeout(2000);

  // 点击第一行打开详情
  await page.click('tbody tr:first-child');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'test-results/detail-panel.png', fullPage: true });
});
