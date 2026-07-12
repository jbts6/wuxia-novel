import { test } from '@playwright/test';

test('验证导航高亮', async ({ page }) => {
  await page.goto('/');
  await page.click('.grid > a:first-child');
  await page.waitForTimeout(2000);

  // 点击人物志
  await page.click('text=人物志');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/nav-highlight.png', fullPage: true });
});

test('验证章回录', async ({ page }) => {
  await page.goto('/');
  await page.click('.grid > a:first-child');
  await page.waitForTimeout(2000);

  // 点击章回录
  await page.click('text=章回录');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/chapters.png', fullPage: true });
});
