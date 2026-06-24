'use strict';

const ITEM_TYPE_ENUM = ['兵器', '暗器', '防具', '丹药', '毒药', '信物', '秘籍', '坐骑', '食物', '工具', '饰品'];

const ITEM_TYPE_MAP = {
  'weapon': '兵器', '随身利器': '兵器', 'siege_weapon': '兵器', '武器': '兵器',
  'hidden_weapon': '暗器', '兵器暗器': '暗器',
  'pill': '丹药', 'medicine': '丹药', '药瓶': '丹药', '解药': '丹药', '金创药': '丹药', '香药': '丹药', '毒草兼解药': '丹药',
  'poison': '毒药', '毒物': '毒药',
  'armor': '防具', 'clothing': '防具', '衣饰': '防具', '服饰': '防具', '衣物': '防具',
  'food': '食物', '酒': '食物',
  'mount': '坐骑', '灵禽': '坐骑',
  '信物': '信物', '书信': '信物', '信件': '信物', '令牌': '信物', 'message': '信物', 'token': '信物', '证物': '信物', '图卷': '信物', '书画': '信物', '军旗': '信物',
  '秘籍': '秘籍', '武学秘笈': '秘籍', '武学图谱': '秘籍', '经书': '秘籍', '书籍': '秘籍', 'book': '秘籍', 'manual': '秘籍', 'document': '秘籍',
  '工具': '工具', 'tool': '工具', 'training_tool': '工具', '临时工具': '工具', '随身器物': '工具', '随身物': '工具', '器物': '工具', '物品': '工具', 'formation': '工具', 'trap': '工具',
  '饰品': '饰品', '饰物': '饰品', 'accessory': '饰品', '首饰': '饰品', '剑饰': '饰品', 'jewelry': '饰品',
};

const RARITY_ENUM = ['寻常凡品', '上乘佳品', '稀世珍品', '绝世神兵'];

module.exports = {
  fileKind: 'items',
  companions: ['characters'],

  enums: {
    itemType: { values: ITEM_TYPE_ENUM, map: ITEM_TYPE_MAP },
    rarity: { values: RARITY_ENUM },
  },

  sanitize(data, companions) {
    if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

    const changes = [];
    const pending = [];

    // type 归一
    for (const item of data) {
      if (item.type) {
        const mapped = ITEM_TYPE_MAP[item.type] || ITEM_TYPE_MAP[item.type.toLowerCase()];
        if (mapped && mapped !== item.type) {
          changes.push({ id: item.id, field: 'type', before: item.type, after: mapped, rule: 'items.type_map', confidence: 'high' });
          item.type = mapped;
        } else if (!mapped && !ITEM_TYPE_ENUM.includes(item.type)) {
          pending.push({ id: item.id, reason: 'type_not_in_map', value: item.type });
        }
      }
    }

    // rarity_tier "未知" → "寻常凡品"
    for (const item of data) {
      if (item.rarity_tier === '未知') {
        changes.push({ id: item.id, field: 'rarity_tier', before: '未知', after: '寻常凡品', rule: 'rarity_unknown_default', confidence: 'high' });
        item.rarity_tier = '寻常凡品';
      }
      if (item.rarity_tier && !RARITY_ENUM.includes(item.rarity_tier)) {
        pending.push({ id: item.id, reason: 'rarity_not_in_enum', value: item.rarity_tier });
      }
    }

    // owner 引用已合并角色 ID 时同步修复
    const characterRedirects = buildCharacterIdRedirects(companions.characters || []);
    for (const item of data) {
      if (typeof item.owner === 'string' && characterRedirects.has(item.owner)) {
        const nextOwner = characterRedirects.get(item.owner);
        if (nextOwner) {
          changes.push({ id: item.id, field: 'owner', before: item.owner, after: nextOwner, rule: 'owner_reference_fix', confidence: 'high' });
          item.owner = nextOwner;
        } else {
          pending.push({ id: item.id, reason: 'owner_reference_ambiguous', value: item.owner });
        }
      }
    }

    // 同 type+同 name 重复道具合并
    const dedupKey = new Map();
    const kept = [];
    let deletedCount = 0;
    for (const item of data) {
      const key = `${item.type}||${item.name}`;
      if (dedupKey.has(key)) {
        const existing = dedupKey.get(key);
        if (Array.isArray(item.source_refs) && Array.isArray(existing.source_refs)) {
          for (const ref of item.source_refs) {
            if (!existing.source_refs.some(r => JSON.stringify(r) === JSON.stringify(ref))) {
              existing.source_refs.push(ref);
            }
          }
        }
        deletedCount++;
        changes.push({ id: item.id, field: '*', before: item.name, after: `[merged into ${existing.id}]`, rule: 'item_dedup', confidence: 'high' });
      } else {
        dedupKey.set(key, item);
        kept.push(item);
      }
    }

    return { data: kept, changes, pending, deletedCount };
  },
};

function buildCharacterIdRedirects(characters) {
  const redirects = new Map();
  for (const char of characters || []) {
    for (const field of ['merged_ids', 'mergedIds', 'previous_ids', 'previousIds', 'old_ids', 'oldIds']) {
      if (!Array.isArray(char[field])) continue;
      for (const oldId of char[field]) {
        if (!redirects.has(oldId)) redirects.set(oldId, char.id);
      }
    }
  }
  return redirects;
}
