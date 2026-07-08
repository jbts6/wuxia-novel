import { test, expect } from '@playwright/test';

test('首页加载并显示书籍卡片', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('武侠知识库');
  await expect(page.locator('.grid > a')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/library.png', fullPage: true });
});

test('点击书籍卡片进入概览页', async ({ page }) => {
  await page.goto('/');
  await page.click('.grid > a:first-child');
  await expect(page.url()).toContain('/overview');
  await page.screenshot({ path: 'test-results/overview.png', fullPage: true });
});
