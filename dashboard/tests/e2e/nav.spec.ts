import { test, expect } from '@playwright/test';

test('侧边导航链接正确', async ({ page }) => {
  await page.goto('/金庸/天龙八部/overview');
  await page.waitForTimeout(2000);

  // 点击武功阁
  await page.click('text=武功阁');
  await page.waitForTimeout(1000);

  // 验证 URL 包含 skills
  expect(page.url()).toContain('/skills');
  
  // 验证页面内容
  await expect(page.locator('h1')).toContainText('武功阁');
  await page.screenshot({ path: 'test-results/skills.png', fullPage: true });
});
