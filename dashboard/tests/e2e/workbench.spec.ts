import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

test('validates the read-only library workbench flow', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as typeof window & { __copiedCommand?: string }).__copiedCommand = value;
        },
      },
    });
  });

  const statusResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/library/status'));
  await page.goto('/');
  const statusResponse = await statusResponsePromise;
  const libraryStatus = await statusResponse.json() as {
    summary: { total: number; notStarted: number; browseable: number; completed: number };
    books: Array<{
      author: string;
      name: string;
      browseable: boolean;
      suggestedAction: { command: string | null } | null;
    }>;
  };
  const testBook = libraryStatus.books.find((book) => book.browseable && book.suggestedAction?.command);
  expect(testBook).toBeDefined();

  await expect(page.getByRole('heading', { name: '全库生成状态总览' })).toBeVisible();
  await expect(page.getByText(`发现 ${libraryStatus.summary.total} 本原文书籍`)).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`${libraryStatus.summary.browseable} 可浏览`) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`${libraryStatus.summary.completed} 已完成`) })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '知识条目' })).toBeVisible();

  const entitySummary = page.locator('tbody td:nth-child(3) span[title^="角色 "]').first();
  const entityLayout = await entitySummary.evaluate((element) => {
    const entityRect = element.getBoundingClientRect();
    const dataCellRect = element.closest('td')?.nextElementSibling?.getBoundingClientRect();
    return {
      entityRight: entityRect.right,
      dataLeft: dataCellRect?.left ?? 0,
      overflowX: getComputedStyle(element).overflowX,
    };
  });
  expect(entityLayout.entityRight).toBeLessThanOrEqual(entityLayout.dataLeft + 1);
  expect(entityLayout.overflowX).toBe('hidden');

  await page.screenshot({ path: 'test-results/workbench-overview.png', fullPage: true });

  await page.getByRole('button', { name: new RegExp(`${libraryStatus.summary.notStarted} 未生成`) }).click();
  await expect(page.getByText(`显示 ${libraryStatus.summary.notStarted} 本`)).toBeVisible();

  await page.getByRole('button', { name: new RegExp(`${libraryStatus.summary.total} 全部书目`) }).click();
  const firstBookBeforeSort = await page.locator('tbody tr').first().innerText();
  await page.getByRole('button', { name: '书籍' }).click();
  const firstBookAfterSort = await page.locator('tbody tr').first().innerText();
  expect(firstBookAfterSort).not.toBe(firstBookBeforeSort);

  const refreshResponse = page.waitForResponse((response) => response.url().endsWith('/api/library/status'));
  await page.getByRole('button', { name: '刷新知识库状态' }).click();
  await expect((await refreshResponse).status()).toBe(200);
  await expect(page.getByRole('button', { name: '刷新知识库状态' })).toBeEnabled();

  await page.getByRole('textbox', { name: '搜索作者或书名' }).fill(testBook!.name);
  await expect(page.getByText('显示 1 本')).toBeVisible();
  await page.getByRole('row', { name: `查看《${testBook!.name}》状态详情` }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('知识条目')).toBeVisible();
  await expect(page.getByText('建议下一步')).toBeVisible();
  await expect(page.getByRole('button', { name: '进入知识库' })).toBeEnabled();

  await page.getByRole('button', { name: '复制建议命令' }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __copiedCommand?: string }).__copiedCommand)).toContain(testBook!.name);
  await page.screenshot({ path: 'test-results/workbench-detail.png', fullPage: true });

  await page.getByRole('button', { name: '进入知识库' }).click();
  await page.waitForURL(/\/overview$/);
  expect(decodeURIComponent(page.url())).toContain(`/${testBook!.author}/${testBook!.name}/overview`);
  await expect(page.getByRole('heading', { name: testBook!.name, exact: true })).toBeVisible();

  await page.getByRole('link', { name: '人物志' }).click();
  await expect(page.getByRole('heading', { name: '人物志' })).toBeVisible();
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('性格特征')).toBeVisible();
  await page.screenshot({ path: 'test-results/workbench-book.png', fullPage: true });

  expect(pageErrors).toEqual([]);
});
