import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const INTERNAL_ENTITY_ID = /\b(?:char(?:acter)?|skill|item|faction|location)[_:-][a-z0-9_-]+\b/i;
const ENGLISH_SCHEMA_VALUE = /\b(?:assassin|civilian|healer|leader|master|mentor|monk|official|ruler|schemer|scholar|tragic|warrior)\b/i;

test('searches the global library and restores state after opening a book entity', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/browse');
  await expect(page.getByRole('heading', { name: '全库知识搜索' })).toBeVisible();
  await expect(page.getByText(/正在建立全库索引/)).toBeHidden({ timeout: 30000 });

  const resultRows = page.locator('tbody tr[aria-label^="查看"]');
  const firstPageCount = await resultRows.count();
  expect(firstPageCount).toBeGreaterThan(0);
  expect(firstPageCount).toBeLessThanOrEqual(50);
  await expect(page.getByText(/1-50 \/ .* 条记录/)).toBeVisible();

  const searchInput = page.getByRole('textbox', { name: '搜索全库知识' });
  const firstResultName = (await resultRows.first().locator('td').first().innerText()).trim();
  await searchInput.fill(firstResultName);
  await expect(page).not.toHaveURL(/[?&]q=/);
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(resultRows.first()).toContainText(firstResultName);
  await page.getByRole('button', { name: '清空筛选' }).click();
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(resultRows).toHaveCount(50);

  const nextPage = page.getByRole('button', { name: '下一页' });
  await expect(nextPage).toBeEnabled();
  await nextPage.click();
  await expect(page.getByText(/51-100 \/ .* 条记录/)).toBeVisible();
  await page.getByRole('button', { name: '上一页' }).click();
  await expect(page.getByText(/1-50 \/ .* 条记录/)).toBeVisible();
  await expect(page.locator('tbody tr[aria-label^="查看"]')).toHaveCount(50);

  const targetRow = page.locator('tbody tr[aria-label^="查看"]').nth(20);
  const targetName = (await targetRow.locator('td').first().innerText()).trim();
  await targetRow.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await targetRow.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBeGreaterThanOrEqual(540);
  await expect(dialog.getByText(targetName, { exact: true })).toBeVisible();
  await expect(dialog.getByText('原文证据')).toBeVisible();
  await expect(dialog).not.toContainText(INTERNAL_ENTITY_ID);
  await expect(dialog).not.toContainText(ENGLISH_SCHEMA_VALUE);
  await page.screenshot({ path: 'test-results/global-library-detail.png', fullPage: true });

  await dialog.getByRole('link', { name: /打开单书详情/ }).click();
  await page.waitForURL(/\/(characters|skills|items|factions|locations)\?detail=/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toContainText(INTERNAL_ENTITY_ID);
  await expect(page.getByRole('dialog')).not.toContainText(ENGLISH_SCHEMA_VALUE);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('link', { name: '返回全库搜索' })).toBeVisible();

  await page.getByRole('link', { name: '返回全库搜索' }).click();
  await page.waitForURL(/\/browse/);
  await expect(page.getByRole('heading', { name: '全库知识搜索' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '搜索全库知识' })).toHaveValue('');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(Math.max(0, scrollBefore - 80));
  await page.screenshot({ path: 'test-results/global-library-overview.png', fullPage: true });

  await page.getByRole('textbox', { name: '搜索全库知识' }).fill('生死符');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('row', { name: '查看物品“生死符”详情' }).click();
  const indexOnlyDialog = page.getByRole('dialog');
  await expect(indexOnlyDialog.getByText('仅有索引记录')).toBeVisible();
  await expect(indexOnlyDialog.getByText('原文证据')).toBeVisible();
  await expect(indexOnlyDialog.locator('p').filter({ hasText: '生死符' }).first()).toBeVisible();
  await expect(indexOnlyDialog.getByRole('heading', { name: '基础信息', exact: true })).toHaveCount(0);
  await expect(indexOnlyDialog.getByRole('heading', { name: '简介', exact: true })).toHaveCount(0);
  await expect(indexOnlyDialog).not.toContainText('未分类');
  await page.screenshot({ path: 'test-results/global-library-index-only.png', fullPage: true });

  expect(pageErrors).toEqual([]);
});
