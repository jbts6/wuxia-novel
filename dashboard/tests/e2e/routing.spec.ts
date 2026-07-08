import { test, expect } from '@playwright/test';

test('首页显示所有书籍（按作者分组）', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('武侠知识库');
  await expect(page.locator('h2')).toContainText('金庸');
  await page.screenshot({ path: 'test-results/library.png', fullPage: true });
});

test('作者页显示该作者的书籍', async ({ page }) => {
  await page.goto('/金庸');
  await expect(page.locator('h1')).toContainText('金庸');
  await expect(page.locator('.grid > a')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/author.png', fullPage: true });
});

test('书籍概览页正常显示', async ({ page }) => {
  await page.goto('/金庸/天龙八部/overview');
  await expect(page.locator('h1')).toContainText('天龙八部');
  await page.screenshot({ path: 'test-results/book-overview.png', fullPage: true });
});
