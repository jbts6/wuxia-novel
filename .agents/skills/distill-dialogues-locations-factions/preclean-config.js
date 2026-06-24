'use strict';

const TONE_ENUM = ['陈述', '疑问', '愤怒', '激动', '悲伤', '恳求', '嘲讽', '调侃', '冷酷', '恐惧', '欣喜', '焦急'];

const TONE_MAP = {
  '平静': '陈述', '淡然': '陈述', '低语': '陈述', '喃喃': '陈述',
  '温柔': '陈述', '柔声': '陈述', '娇声': '陈述', '严肃': '陈述',
  '沉声': '陈述', '无奈': '陈述', '苦笑': '陈述', '犹豫': '陈述',
  '好奇': '疑问',
  '厉声': '愤怒',
  '惊讶': '激动',
  '悲痛': '悲伤', '痛苦': '悲伤', '颤声': '悲伤', '嘶声': '悲伤',
  '冷笑': '嘲讽',
  '微笑': '欣喜', '轻笑': '欣喜', '大笑': '欣喜', '狂笑': '欣喜', '欣慰': '欣喜', '得意': '欣喜',
  '慌张': '焦急', '担心': '焦急',
};

const EXCLAMATION_WORDS = new Set([
  '嗤', '啊', '嘶', '哼', '哈', '嗯', '哦', '呃',
  '着！', '是！', '好！', '走！', '去！', '杀！',
]);

const REGION_KEYWORDS = {
  '大理': ['大理', '镇南', '万劫谷'],
  '无量山': ['无量'],
  '天山': ['天山', '缥缈峰', '灵鹫'],
  '中原': ['少林', '丐帮', '河南', '信阳', '擂鼓'],
  '江南': ['苏州', '姑苏', '燕子坞', '太湖', '无锡', '曼陀'],
  '西夏': ['西夏'],
  '辽国': ['辽国', '契丹'],
  '吐蕃': ['吐蕃'],
};

const STANDARD_REGIONS = new Set(Object.keys(REGION_KEYWORDS));

const FACTION_TYPE_ENUM = ['武林门派', '帮派', '家族', '军队', '王族', '寺院', '部族', '官署'];

const FACTION_TYPE_MAP = {
  '武林家族': '家族', '武林世家': '家族',
  '丐帮分舵': '帮派',
  '剑派': '武林门派', '岛派': '武林门派',
  '佛寺与大理段氏护国武学重地': '寺院', '吐蕃佛寺武学势力': '寺院',
  '上位江湖势力': '武林门派',
};

module.exports = {
  fileKind: 'dialogues', // 主入口，locations/factions 通过子配置处理
  companions: ['characters'],

  enums: {
    tone: { values: TONE_ENUM, map: TONE_MAP },
    region: { values: STANDARD_REGIONS, keywords: REGION_KEYWORDS },
    factionType: { values: FACTION_TYPE_ENUM, map: FACTION_TYPE_MAP },
  },

  sanitizeDialogues(data, companions) {
    if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

    const changes = [];
    const pending = [];
    let deletedCount = 0;
    const kept = [];

    // 构建 characters 索引
    const chars = companions.characters || [];
    const charNameMap = new Map();
    for (const c of chars) {
      if (c.name) addUniqueMapValue(charNameMap, c.name, c.id);
      if (Array.isArray(c.alias)) {
        for (const a of c.alias) addUniqueMapValue(charNameMap, a, c.id);
      }
    }

    for (const d of data) {
      // 删除空 text
      if (!d.text || d.text.trim() === '') {
        deletedCount++;
        changes.push({ id: `${d.chapter}-${d.line_start}`, field: 'text', before: d.text, after: '[deleted]', rule: 'empty_text_delete', confidence: 'high' });
        continue;
      }

      // 删除 text≤2 感叹词
      if (d.text.length <= 2 && EXCLAMATION_WORDS.has(d.text)) {
        deletedCount++;
        changes.push({ id: `${d.chapter}-${d.line_start}`, field: 'text', before: d.text, after: '[deleted]', rule: 'exclamation_delete', confidence: 'high' });
        continue;
      }

      // tone 归一
      if (d.tone && !TONE_ENUM.includes(d.tone)) {
        const mapped = TONE_MAP[d.tone];
        if (mapped) {
          changes.push({ id: `${d.chapter}-${d.line_start}`, field: 'tone', before: d.tone, after: mapped, rule: 'dialogue.tone_map', confidence: 'high' });
          d.tone = mapped;
        } else {
          pending.push({ id: `${d.chapter}-${d.line_start}`, reason: 'tone_not_in_map', value: d.tone });
        }
      }

      // speaker_name 唯一匹配时修复 speaker
      if (d.speaker_name && !d.speaker) {
        if (charNameMap.has(d.speaker_name)) {
          const matchId = charNameMap.get(d.speaker_name);
          if (matchId) {
            changes.push({ id: `${d.chapter}-${d.line_start}`, field: 'speaker', before: null, after: matchId, rule: 'speaker_name_match', confidence: 'high' });
            d.speaker = matchId;
          }
        }
      }

      kept.push(d);
    }

    return { data: kept, changes, pending, deletedCount };
  },

  sanitizeLocations(data) {
    if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

    const changes = [];
    const pending = [];

    for (const loc of data) {
      // region 归一
      if (loc.region && !STANDARD_REGIONS.has(loc.region)) {
        const mapped = mapRegion(loc.region, loc);
        if (mapped) {
          changes.push({ id: loc.id, field: 'region', before: loc.region, after: mapped, rule: 'location.region_map', confidence: 'high' });
          loc.region = mapped;
        } else {
          pending.push({ id: loc.id, reason: 'region_not_standard', value: loc.region });
        }
      }

      // one_line 空值补全
      if (!loc.one_line && Array.isArray(loc.source_refs) && loc.source_refs.length > 0) {
        const firstText = loc.source_refs[0].text;
        if (firstText && firstText.length > 5) {
          const oneLine = firstText.slice(0, 80);
          changes.push({ id: loc.id, field: 'one_line', before: null, after: oneLine, rule: 'one_line_from_source', confidence: 'high' });
          loc.one_line = oneLine;
        }
      }
    }

    return { data, changes, pending, deletedCount: 0 };
  },

  sanitizeFactions(data, companions, context) {
    if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

    const changes = [];
    const pending = [];
    const companionWrites = [];
    let deletedCount = 0;

    // type 枚举归一
    for (const f of data) {
      if (f.type && !FACTION_TYPE_ENUM.includes(f.type)) {
        const mapped = FACTION_TYPE_MAP[f.type];
        if (mapped) {
          changes.push({ id: f.id, field: 'type', before: f.type, after: mapped, rule: 'faction.type_map', confidence: 'high' });
          f.type = mapped;
        } else {
          pending.push({ id: f.id, reason: 'type_not_in_map', value: f.type });
        }
      }
    }

    // name+location 完全相同的势力合并
    const dedupKey = new Map();
    const kept = [];
    const factionNameRedirects = new Map();
    for (const f of data) {
      const key = `${f.name}||${f.location || ''}`;
      if (dedupKey.has(key)) {
        const existing = dedupKey.get(key);
        if (f.name !== existing.name) factionNameRedirects.set(f.name, existing.name);
        if (Array.isArray(f.source_refs) && Array.isArray(existing.source_refs)) {
          for (const ref of f.source_refs) {
            if (!existing.source_refs.some(r => JSON.stringify(r) === JSON.stringify(ref))) {
              existing.source_refs.push(ref);
            }
          }
        }
        deletedCount++;
        changes.push({ id: f.id, field: '*', before: f.name, after: `[merged into ${existing.id}]`, rule: 'faction_dedup', confidence: 'high' });
      } else {
        dedupKey.set(key, f);
        kept.push(f);
      }
    }

    // 同步 characters.faction
    const charactersPath = context?.companionFiles?.characters;
    if (charactersPath && factionNameRedirects.size > 0 && Array.isArray(companions.characters)) {
      let characterChanged = false;
      for (const char of companions.characters) {
        if (typeof char.faction === 'string' && factionNameRedirects.has(char.faction)) {
          changes.push({ id: char.id, field: 'characters.faction', before: char.faction, after: factionNameRedirects.get(char.faction), rule: 'faction_reference_fix', confidence: 'high' });
          char.faction = factionNameRedirects.get(char.faction);
          characterChanged = true;
        }
      }
      if (characterChanged) {
        companionWrites.push({ path: charactersPath, data: companions.characters });
      }
    }

    // location ID 残留修复
    const locs = companions.locations || [];
    const locIdMap = new Map();
    for (const l of locs) { if (l.id) locIdMap.set(l.id, l.name); }
    for (const f of kept) {
      if (f.location && locIdMap.has(f.location)) {
        changes.push({ id: f.id, field: 'location', before: f.location, after: locIdMap.get(f.location), rule: 'location_id_to_name', confidence: 'high' });
        f.location = locIdMap.get(f.location);
      }
    }

    return { data: kept, changes, pending, deletedCount, companionWrites };
  },
};

function addUniqueMapValue(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) { map.set(key, value); return; }
  if (map.get(key) !== value) map.set(key, null);
}

function mapRegion(region, loc) {
  for (const [standard, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const kw of keywords) { if (region.includes(kw)) return standard; }
  }
  const name = loc.name || '';
  for (const [standard, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const kw of keywords) { if (name.includes(kw)) return standard; }
  }
  return null;
}
