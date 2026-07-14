import { test, expect } from '@playwright/test';

test('首页显示所有书籍（按作者分组）', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '全库生成状态总览' })).toBeVisible();
  await expect(page.getByText('飞狐外传').first()).toBeVisible();
});

test('作者页显示该作者的书籍', async ({ page }) => {
  await page.goto('/金庸');
  await expect(page.getByRole('heading', { name: '金庸' })).toBeVisible();
  await expect(page.getByRole('link', { name: /飞狐外传/ })).toBeVisible();
});

test('书籍概览页正常显示', async ({ page }) => {
  await page.goto('/金庸/天龙八部/overview');
  await expect(page.getByRole('heading', { name: '天龙八部' })).toBeVisible();
});

test('招式素材深链接在前进后退后保持视图和详情', async ({ page }) => {
  await page.goto('/金庸/飞狐外传/game-materials');
  await page.getByRole('link', { name: '打开来源：闭门铁扇' }).click();

  await expect(page).toHaveURL(/\/skills\?view=techniques&detail=tech_bi_men_tie_shan$/);
  await expect(page.getByRole('heading', { name: '闭门铁扇' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/game-materials$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/skills\?view=techniques&detail=tech_bi_men_tie_shan$/);
  await expect(page.getByRole('heading', { name: '闭门铁扇' })).toBeVisible();
});

test('全库浏览只请求八类核心数据', async ({ page }) => {
  let extrasRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/library/book-extras')) extrasRequests += 1;
  });

  const firstBookData = page.waitForResponse((response) => response.url().includes('/api/library/book-data?'));
  await page.goto('/browse');
  await expect(page.getByRole('heading', { name: '全库知识搜索' })).toBeVisible();
  await firstBookData;
  await page.waitForFunction(() => {
    const text = document.body.textContent ?? '';
    return !text.includes('正在载入') && !text.includes('正在建立全库索引');
  });

  expect(extrasRequests).toBe(0);
});
