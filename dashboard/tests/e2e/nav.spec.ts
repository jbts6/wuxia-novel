import { test, expect } from '@playwright/test';

test('侧边导航链接正确', async ({ page }) => {
  await page.goto('/金庸/天龙八部/overview');
  await page.getByRole('link', { name: '武功阁' }).click();

  await expect(page).toHaveURL(/\/skills$/);
  await expect(page.getByRole('heading', { name: '武功阁' })).toBeVisible();
});

test('仅有旧八类数据的书籍也显示游戏素材入口', async ({ page }) => {
  await page.goto('/金庸/书剑恩仇录/overview');

  await expect(page.getByText('创作应用')).toBeVisible();
  await page.getByRole('link', { name: '游戏素材', exact: true }).click();

  await expect(page).toHaveURL(/\/game-materials$/);
  await expect(page.getByText('本书尚未生成游戏素材')).toBeVisible();
});
