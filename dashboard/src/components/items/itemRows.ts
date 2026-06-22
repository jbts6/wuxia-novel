import type { Character, Item } from '../../types/novel';

export const ITEM_RARITY_ORDER = ['绝世神兵', '稀世珍品', '上乘佳品', '寻常凡品', '未分类'];
export const ITEM_TYPE_ORDER = ['兵器', '暗器', '防具', '饰品', '丹药', '毒药', '工具', '坐骑', '信物', '食物', '场景', '特殊', '未分类'];

const TYPE_MAP: Record<string, string> = {
  weapon: '兵器', '兵器': '兵器', '随身利器': '兵器', siege_weapon: '兵器',
  hidden_weapon: '暗器', '暗器': '暗器', '兵器暗器': '暗器',
  pill: '丹药', medicine: '丹药', '丹药': '丹药', '药瓶': '丹药', '毒草兼解药': '丹药',
  poison: '毒药', '毒药': '毒药', '毒物': '毒药',
  armor: '防具', clothing: '防具', '防具': '防具', '衣饰': '防具',
  '饰物': '饰品', accessory: '饰品', '首饰': '饰品', '剑饰': '饰品',
  '食物': '食物',
  tool: '工具', training_tool: '工具', trap: '工具', formation: '工具', '临时工具': '工具',
  '场景物': '场景', '建筑构件': '场景', '碑刻': '场景', '墓碑': '场景',
  '花木': '场景', '花架藤蔓': '场景', '树木': '场景', '包扎物': '场景', '旧事物件': '场景',
  message: '信物', '书信': '信物', '图卷': '信物', '经书': '信物',
  mount: '坐骑', '灵禽': '坐骑',
  special: '特殊', '特殊': '特殊', '随身器物': '特殊', '随身物': '特殊',
  '军旗': '特殊', '威胁标记': '特殊',
};

export interface ItemRow {
  id: string;
  name: string;
  type: string;
  rank: string;
  ownerName: string;
  ownerId: string | null;
  summary: string;
}

export interface ItemRowFilters {
  search: string;
  types: string[];
  rarities: string[];
}

export function normalizeItemType(raw: string): string {
  return TYPE_MAP[raw] || raw || '未分类';
}

export function buildItemRows(
  items: Item[],
  characters: Array<Pick<Character, 'id' | 'name'>>,
  filters: ItemRowFilters,
): ItemRow[] {
  const q = filters.search.toLowerCase();
  let result = items;

  if (q) {
    result = result.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.type?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  }
  if (filters.rarities.length > 0) {
    result = result.filter(i => filters.rarities.includes(i.rarity_tier || '未分类'));
  }
  if (filters.types.length > 0) {
    result = result.filter(i => filters.types.includes(normalizeItemType(i.type)));
  }

  return [...result]
    .sort((a, b) => {
      const ai = ITEM_RARITY_ORDER.indexOf(a.rarity_tier || '未分类');
      const bi = ITEM_RARITY_ORDER.indexOf(b.rarity_tier || '未分类');
      return ai - bi;
    })
    .map(i => {
      const owner = characters.find(c => c.id === i.owner);
      return {
        id: i.id,
        name: i.name,
        type: normalizeItemType(i.type),
        rank: i.rarity_tier || '未分类',
        ownerName: owner?.name ?? '',
        ownerId: owner?.id ?? null,
        summary: i.one_line || i.description || '',
      };
    });
}
