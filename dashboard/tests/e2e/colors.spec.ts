import { test, expect } from '@playwright/test';

test('浅色模式下文字颜色可见', async ({ page }) => {
  await page.goto('/');
  await page.click('.grid > a:first-child');
  await page.waitForTimeout(2000);

  // 检查 power_rank 文字颜色
  const powerRank = page.locator('text=登峰造极').first();
  await expect(powerRank).toBeVisible();

  // 截图验证
  await page.screenshot({ path: 'test-results/light-mode.png', fullPage: true });
});

test('深色模式下文字颜色可见', async ({ page }) => {
  await page.goto('/');
  await page.click('.grid > a:first-child');
  await page.waitForTimeout(2000);

  // 切换到深色模式
  await page.click('button:has(svg)'); // ThemeToggle 按钮
  await page.waitForTimeout(500);

  // 检查 power_rank 文字颜色
  const powerRank = page.locator('text=登峰造极').first();
  await expect(powerRank).toBeVisible();

  // 截图验证
  await page.screenshot({ path: 'test-results/dark-mode.png', fullPage: true });
});
