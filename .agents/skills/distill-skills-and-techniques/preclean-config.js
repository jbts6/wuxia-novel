'use strict';

const TECHNIQUE_TYPE_ENUM = ['attack', 'defense', 'buff', 'debuff', 'control', 'feint', 'movement', 'poison', 'internal', 'support', 'combo', 'counter', 'special'];

const TECHNIQUE_TYPE_MAP = {
  '剑招': 'attack', '兵刃招': 'attack', '兵器招式': 'attack', '短兵招': 'attack', '掌招': 'attack', '招式': 'attack',
  '小指剑气': 'attack', '中指剑气': 'attack', '无名指剑气': 'attack', '食指剑气': 'attack', '剑气': 'attack',
  '点穴': 'control', '擒拿': 'control', 'grab': 'control',
  '运功': 'buff',
  '毒性效果': 'debuff', '毒性发作': 'debuff',
  '身法剑招': 'movement',
  '毒兽攻击': 'poison', '毒药手段': 'poison',
  '心法': 'internal',
  '药理能力': 'support', '传音': 'support', '发声': 'support',
  '邪术': 'special', '暗器发射': 'special', '暗器手法': 'special',
  'healing': 'support',
  'formation': 'special', 'command': 'special',
};

module.exports = {
  fileKind: 'skills',
  companions: ['skills'],

  enums: {
    techniqueType: { values: TECHNIQUE_TYPE_ENUM, map: TECHNIQUE_TYPE_MAP },
  },

  sanitizeSkills(data) {
    if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };
    // skills 预清洗只做通用处理（字符串清理、去重、空值规整），无特殊逻辑
    return { data, changes: [], pending: [], deletedCount: 0 };
  },

  sanitizeTechniques(data, companions) {
    if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

    const changes = [];
    const pending = [];
    let deletedCount = 0;

    // type 归一
    for (const tech of data) {
      if (tech.type && !TECHNIQUE_TYPE_ENUM.includes(tech.type)) {
        const mapped = TECHNIQUE_TYPE_MAP[tech.type] || TECHNIQUE_TYPE_MAP[tech.type.toLowerCase()];
        if (mapped) {
          changes.push({ id: tech.id, field: 'type', before: tech.type, after: mapped, rule: 'technique.type_map', confidence: 'high' });
          tech.type = mapped;
        } else {
          pending.push({ id: tech.id, reason: 'type_not_in_map', value: tech.type });
        }
      }
    }

    // source_skill 引用修复
    const skills = companions.skills || [];
    const skillIdSet = new Set(skills.map(s => s.id));
    const skillNameMap = new Map();
    for (const s of skills) addUniqueMapValue(skillNameMap, s.name, s.id);

    for (const tech of data) {
      if (tech.source_skill && !skillIdSet.has(tech.source_skill)) {
        if (skillNameMap.has(tech.source_skill)) {
          const nameMatch = skillNameMap.get(tech.source_skill);
          if (nameMatch) {
            changes.push({ id: tech.id, field: 'source_skill', before: tech.source_skill, after: nameMatch, rule: 'source_skill_fix', confidence: 'high' });
            tech.source_skill = nameMatch;
          } else {
            pending.push({ id: tech.id, reason: 'source_skill_name_ambiguous', value: tech.source_skill });
          }
        } else {
          pending.push({ id: tech.id, reason: 'invalid_source_skill', value: tech.source_skill });
        }
      }
    }

    // 同 name+同 source_skill 合并
    const dedupKey = new Map();
    const kept = [];
    for (const tech of data) {
      const key = tech.source_skill ? `${tech.name}||${tech.source_skill}` : tech.id;
      if (dedupKey.has(key)) {
        const existing = dedupKey.get(key);
        if (Array.isArray(tech.source_refs) && Array.isArray(existing.source_refs)) {
          for (const ref of tech.source_refs) {
            if (!existing.source_refs.some(r => JSON.stringify(r) === JSON.stringify(ref))) {
              existing.source_refs.push(ref);
            }
          }
        }
        deletedCount++;
        changes.push({ id: tech.id, field: '*', before: tech.name, after: `[merged into ${existing.id}]`, rule: 'technique_dedup', confidence: 'high' });
      } else {
        dedupKey.set(key, tech);
        kept.push(tech);
      }
    }

    // orphan technique 补 source_skill
    for (const tech of kept) {
      if (!tech.source_skill && tech.name) {
        if (skillNameMap.has(tech.name)) {
          const matchId = skillNameMap.get(tech.name);
          if (matchId) {
            changes.push({ id: tech.id, field: 'source_skill', before: null, after: matchId, rule: 'orphan_attach', confidence: 'high' });
            tech.source_skill = matchId;
          }
        }
      }
    }

    return { data: kept, changes, pending, deletedCount };
  },
};

function addUniqueMapValue(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) { map.set(key, value); return; }
  if (map.get(key) !== value) map.set(key, null);
}
