import { test, expect } from '@playwright/test';

const BOOK_ROUTE = '/金庸/飞狐外传';
const ENCODED_BOOK_ROUTE = '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0';

const sourceLinks = [
  ['程灵素', `${ENCODED_BOOK_ROUTE}/characters?detail=char_cheng_ling_su`],
  ['八卦掌', `${ENCODED_BOOK_ROUTE}/skills?detail=skill_ba_gua_zhang`],
  ['闭门铁扇', `${ENCODED_BOOK_ROUTE}/skills?view=techniques&detail=tech_bi_men_tie_shan`],
  ['碧蚕毒蛊', `${ENCODED_BOOK_ROUTE}/items?detail=item_bi_can_du_gu`],
  ['八卦门', `${ENCODED_BOOK_ROUTE}/factions?detail=faction_ba_gua_men`],
  ['北帝庙', `${ENCODED_BOOK_ROUTE}/locations?detail=loc_bei_di_miao`],
  [
    '程灵素舍身吸毒救胡斐',
    `${ENCODED_BOOK_ROUTE}/chapter-summaries?view=events&detail=event_cheng_ling_su_she_shen_xi_du_jiu_hu_fei`,
  ],
] as const;

test('飞狐外传显示 44 条素材、五类分布和七类可解析来源', async ({ page }) => {
  await page.goto(`${BOOK_ROUTE}/game-materials`);

  await expect(page.getByRole('heading', { name: '游戏素材' })).toBeVisible();
  await expect(page.getByText('44 条游戏素材')).toBeVisible();
  await expect(page.getByTestId('game-material-card')).toHaveCount(44);
  await expect(page.getByRole('link', { name: /^打开来源：/ })).toHaveCount(44);
  await expect(page.getByRole('button', { name: '来源不可解析' })).toHaveCount(0);

  const baguaCard = page.getByTestId('game-material-card').filter({
    has: page.getByRole('link', { name: '打开来源：八卦掌' }),
  }).first();
  await expect(baguaCard.locator('[data-slot="card-title"]')).toHaveText('八卦掌');
  await expect(baguaCard.getByText('战斗系统原型', { exact: true })).toBeVisible();

  for (const [name, href] of sourceLinks) {
    await expect(page.getByRole('link', { name: `打开来源：${name}`, exact: true }).first()).toHaveAttribute('href', href);
  }

  await page.getByLabel('素材类型').selectOption('经典剧情桥段');
  await page.getByLabel('重要度').selectOption('高');
  await expect(page.getByText('显示 6 / 44')).toBeVisible();
  await expect(page.getByTestId('game-material-card')).toHaveCount(6);

  await page.getByLabel('素材类型').focus();
  await expect(page.getByLabel('素材类型')).toBeFocused();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('六条事件素材可进入 20 个关键事件中的对应详情', async ({ page }) => {
  await page.goto(`${BOOK_ROUTE}/game-materials`);
  await page.getByRole('link', { name: '打开来源：程灵素舍身吸毒救胡斐' }).click();

  await expect(page).toHaveURL(/\/chapter-summaries\?view=events&detail=event_cheng_ling_su_she_shen_xi_du_jiu_hu_fei$/);
  await expect(page.getByRole('heading', { name: '程灵素舍身吸毒救胡斐' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('tab', { name: '关键事件' })).toHaveAttribute('data-active', '');
  await expect(page.getByText('共 20 个关键事件')).toBeVisible();
});

test('四条招式素材全部指向武功阁招式视图', async ({ page }) => {
  const techniques = [
    ['闭门铁扇', 'tech_bi_men_tie_shan'],
    ['穿手藏刀', 'tech_chuan_shou_cang_dao'],
    ['谏果回甘', 'tech_jian_guo_hui_gan'],
    ['云龙三现', 'tech_yun_long_san_xian'],
  ] as const;

  await page.goto(`${BOOK_ROUTE}/game-materials`);

  for (const [name, id] of techniques) {
    await expect(page.getByRole('link', { name: `打开来源：${name}` })).toHaveAttribute(
      'href',
      `${ENCODED_BOOK_ROUTE}/skills?view=techniques&detail=${id}`,
    );
  }
});
