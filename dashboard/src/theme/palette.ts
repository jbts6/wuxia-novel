// 水墨宣纸 · 浅色古典 设计调色板
// 以传统国画颜料命名，集中管理全站颜色。

// 宣纸 / 墨 基底
export const PAPER = {
  base: '#f4ece0',      // 宣纸米白（页面底）
  raised: '#faf5ea',    // 浮起表面（卡片）
  sunken: '#ece1d0',    // 凹陷表面（页眉/侧栏分区）
  edge: '#d9cab2',      // 纸张边缘
};

export const INK = {
  black: '#2b2620',     // 浓墨（主标题）
  body: '#3f3a32',      // 行文墨
  secondary: '#6f675b', // 次要墨（说明文字）
  faint: '#9a9082',     // 淡墨（辅助）
  hairline: '#d8ccba',  // 细墨线（分隔）
};

// 朱砂 —— 唯一主强调色
export const CINNABAR = {
  base: '#a8332a',      // 朱砂正色
  soft: '#c0473b',      // 朱砂亮
  wash: '#f0ddd4',      // 朱砂淡彩（底）
  deep: '#7d241d',      // 朱砂深
};

// 辅助国画颜料（用于语义标签）
export const PIGMENT = {
  ochre: '#b8863b',     // 赭石 / 藤黄
  ochreWash: '#f1e6cf',
  celadon: '#5e7a54',   // 竹青
  celadonWash: '#e2e8d8',
  indigo: '#3f5a78',    // 黛蓝
  indigoWash: '#dde3ec',
  violet: '#6d557e',    // 黛紫
  violetWash: '#e6dfec',
  cyan: '#3f7a78',      // 青
  cyanWash: '#dbe8e7',
  stone: '#7a7268',     // 石灰（中性）
  stoneWash: '#e7e1d7',
};

// 实体类型 → 颜色（图谱节点、概览统计、徽记）
export const ENTITY_COLORS: Record<string, string> = {
  character: CINNABAR.base,
  skill: PIGMENT.celadon,
  item: PIGMENT.ochre,
  event: CINNABAR.soft,
  location: PIGMENT.violet,
  faction: PIGMENT.cyan,
};

// 武学境界（由高到低）
export const RANK_COLORS: Record<string, string> = {
  返璞归真: CINNABAR.deep,
  登峰造极: CINNABAR.base,
  出神入化: PIGMENT.ochre,
  炉火纯青: PIGMENT.celadon,
  登堂入室: PIGMENT.violet,
  略有小成: PIGMENT.cyan,
  初窥门径: PIGMENT.stone,
  平平无奇: INK.faint,
};

// 物品稀有度
export const RARITY_COLORS: Record<string, string> = {
  绝世神兵: CINNABAR.base,
  稀世珍品: PIGMENT.ochre,
  上乘佳品: PIGMENT.indigo,
  寻常凡品: PIGMENT.stone,
};

// 角色阵营
export const ROLE_COLORS: Record<string, string> = {
  protagonist: CINNABAR.base,
  companion: PIGMENT.celadon,
  npc: PIGMENT.stone,
  villain: INK.black,
};

// 人物关系
export const RELATION_COLORS: Record<string, string> = {
  挚友: PIGMENT.celadon,
  恋人: CINNABAR.soft,
  旧爱: CINNABAR.wash,
  结义兄弟: PIGMENT.indigo,
  知己: PIGMENT.violet,
  主仆: PIGMENT.stone,
  宿敌: CINNABAR.deep,
  对手: PIGMENT.ochre,
  朋友: PIGMENT.cyan,
  合作者: PIGMENT.celadon,
};

// Antd 预设色名 → 水墨色（供 ConfigProvider 或 CSS 覆盖参考）
// 旧版组件曾使用 antd 预设色名，统一映射到水墨色。
export const ANTD_PRESET_MAP: Record<string, string> = {
  red: CINNABAR.base,
  volcano: CINNABAR.soft,
  orange: PIGMENT.ochre,
  gold: PIGMENT.ochre,
  yellow: PIGMENT.ochre,
  lime: PIGMENT.celadon,
  green: PIGMENT.celadon,
  cyan: PIGMENT.cyan,
  blue: PIGMENT.indigo,
  geekblue: PIGMENT.indigo,
  purple: PIGMENT.violet,
  magenta: CINNABAR.soft,
  default: PIGMENT.stone,
};
