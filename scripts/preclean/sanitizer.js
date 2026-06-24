#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// 入口
// ============================================================

/**
 * sanitizeNovelFile({
 *   novelDir,      // e.g. "金庸/天龙八部"
 *   fileName,      // e.g. "items.json"
 *   fileKind,      // e.g. "items"
 *   companionFiles // { characters: path, skills: path, ... } — 用于引用修复
 * })
 */
function sanitizeNovelFile({ novelDir, fileName, fileKind, companionFiles = {} }) {
  const workPath = path.join(novelDir, fileName);
  if (!fs.existsSync(workPath)) {
    throw new Error(`文件不存在: ${workPath}`);
  }

  const archiveDir = path.join(novelDir, 'archive');
  const rawDir = path.join(archiveDir, 'raw');
  const precleanDir = path.join(archiveDir, 'preclean');
  const reportsDir = path.join(archiveDir, 'reports');

  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(precleanDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  // 1. raw 快照（已存在不覆盖）
  const rawPath = path.join(rawDir, fileName);
  if (!fs.existsSync(rawPath)) {
    fs.copyFileSync(workPath, rawPath);
  }

  // 2. 加载工作 JSON
  const raw = fs.readFileSync(workPath, 'utf-8').replace(/^﻿/, '');
  const data = JSON.parse(raw);
  const recordsBefore = Array.isArray(data) ? data.length : 0;

  // 3. 加载 companion files
  const companions = {};
  for (const [kind, p] of Object.entries(companionFiles)) {
    if (p && fs.existsSync(p)) {
      try {
        companions[kind] = JSON.parse(fs.readFileSync(p, 'utf-8').replace(/^﻿/, ''));
      } catch { /* ignore parse errors in companions */ }
    }
  }

  // 4. 执行预清洗
  const result = sanitizeByKind(data, fileKind, companions, { companionFiles, novelDir });

  // 5. 有数据变化时写回工作 JSON；无变化时保留原文件字节。
  const changed = result.changes.length > 0;
  if (changed) {
    fs.writeFileSync(workPath, JSON.stringify(result.data, null, 2) + '\n');
  }

  // 6. preclean 快照（每次预清洗完成后覆盖）
  const precleanPath = path.join(precleanDir, fileName);
  fs.copyFileSync(workPath, precleanPath);

  // 7. 跨文件同步写回
  for (const write of result.companionWrites || []) {
    writeCompanionJson({ novelDir, rawDir, precleanDir, targetPath: write.path, data: write.data });
  }

  // 8. 报告
  const baseName = fileName.replace('.json', '');
  const reportJsonPath = path.join(reportsDir, `${baseName}.sanitize-report.json`);
  const reportMdPath = path.join(reportsDir, `${baseName}.sanitize-report.md`);
  const pendingPath = path.join(reportsDir, `${baseName}.pending.json`);

  const reportExists = fs.existsSync(reportJsonPath) && fs.existsSync(reportMdPath) && fs.existsSync(pendingPath);
  if (changed || !reportExists) {
    const startedAt = new Date().toISOString();
    const summary = {
      records_before: recordsBefore,
      records_after: Array.isArray(result.data) ? result.data.length : recordsBefore,
      changed_records: result.changes.length,
      deleted_records: result.deletedCount || 0,
      pending_records: result.pending.length,
    };

    const report = {
      novel: novelDir,
      file: fileName,
      started_at: startedAt,
      raw_archive: path.relative(novelDir, rawPath),
      preclean_archive: path.relative(novelDir, precleanPath),
      summary,
      changes: result.changes,
      pending: result.pending,
    };

    fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(reportMdPath, renderReportMd(report));
    fs.writeFileSync(pendingPath, JSON.stringify(result.pending, null, 2) + '\n');
  }

  return {
    changed,
    outputPath: workPath,
    rawArchivePath: rawPath,
    precleanArchivePath: precleanPath,
    reportPath: reportJsonPath,
    pendingPath,
  };
}

// ============================================================
// 文件类型路由
// ============================================================

function sanitizeByKind(data, fileKind, companions, context) {
  switch (fileKind) {
    case 'characters':  return sanitizeCharacters(data, companions, context);
    case 'dialogues':   return sanitizeDialogues(data, companions, context);
    case 'locations':   return sanitizeLocations(data, companions, context);
    case 'factions':    return sanitizeFactions(data, companions, context);
    case 'items':       return sanitizeItems(data, companions, context);
    case 'skills':      return sanitizeSkills(data, companions, context);
    case 'techniques':  return sanitizeTechniques(data, companions, context);
    default:
      throw new Error(`未知文件类型: ${fileKind}`);
  }
}

// ============================================================
// 通用工具
// ============================================================

function cleanString(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/^﻿/, '').replace(/\s+/g, ' ').trim();
}

function writeCompanionJson({ novelDir, rawDir, precleanDir, targetPath, data }) {
  const baseName = path.basename(targetPath);
  const rawPath = path.join(rawDir, baseName);
  if (!fs.existsSync(rawPath) && fs.existsSync(targetPath)) {
    fs.copyFileSync(targetPath, rawPath);
  }

  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2) + '\n');

  const relative = path.relative(novelDir, targetPath);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    fs.copyFileSync(targetPath, path.join(precleanDir, baseName));
  }
}

function isEmptyValue(v) {
  return v === '' || v === null || v === undefined
    || (typeof v === 'string' && ['未知', 'N/A', 'n/a', 'none', 'null', 'undefined'].includes(v.trim()));
}

function addUniqueMapValue(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) {
    map.set(key, value);
    return;
  }
  const existing = map.get(key);
  if (existing !== value) map.set(key, null);
}

function buildCharacterIdRedirects(characters) {
  const redirects = new Map();
  for (const char of characters || []) {
    for (const field of ['merged_ids', 'mergedIds', 'previous_ids', 'previousIds', 'old_ids', 'oldIds']) {
      if (!Array.isArray(char[field])) continue;
      for (const oldId of char[field]) {
        addUniqueMapValue(redirects, oldId, char.id);
      }
    }
  }
  return redirects;
}

function normalizeId(id) {
  if (typeof id !== 'string') return id;
  // 只在已经是 lower_snake_case 格式时保留，否则尝试无歧义转换
  if (/^[a-z][a-z0-9_]*$/.test(id)) return id;
  return id; // 无法无歧义转换的不改
}

function toSnakeCase(s) {
  if (typeof s !== 'string') return s;
  // 已经是 snake_case
  if (/^[a-z][a-z0-9_]*$/.test(s)) return s;
  // 不做中文→拼音转换（需要从中文重新推断 ID，不属于高置信修复）
  return s;
}

/**
 * 精确去重：按 id 去重，数组字段取并集
 */
function dedupById(arr, arrayFields = []) {
  if (!Array.isArray(arr)) return { data: arr, dedupCount: 0, idMap: {} };
  const map = new Map();
  const idMap = {};
  let dedupCount = 0;

  for (const item of arr) {
    const id = item.id;
    if (!id) { map.set(Symbol(), item); continue; }

    if (map.has(id)) {
      dedupCount++;
      const existing = map.get(id);
      // 合并数组字段
      for (const f of arrayFields) {
        if (Array.isArray(item[f]) && Array.isArray(existing[f])) {
          const merged = [...existing[f]];
          for (const val of item[f]) {
            if (!merged.some(e => JSON.stringify(e) === JSON.stringify(val))) {
              merged.push(val);
            }
          }
          existing[f] = merged;
        }
      }
      // 对象字段：保留信息更丰富的
      for (const f of Object.keys(item)) {
        if (f === 'id') continue;
        if (Array.isArray(item[f])) continue; // 已处理
        if (!existing[f] && item[f]) existing[f] = item[f];
        if (typeof existing[f] === 'string' && typeof item[f] === 'string'
          && item[f].length > existing[f].length) {
          existing[f] = item[f];
        }
      }
    } else {
      map.set(id, { ...item });
    }
  }

  return {
    data: Array.from(map.values()),
    dedupCount,
    idMap,
  };
}

// ============================================================
// characters
// ============================================================

const CHARACTER_ROLE_ENUM = ['核心', '重要', '次要', '龙套', '背景'];

function sanitizeCharacters(data, companions) {
  if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

  const changes = [];
  const pending = [];
  let deletedCount = 0;

  // 1. 字符串清理
  for (const char of data) {
    for (const [k, v] of Object.entries(char)) {
      if (typeof v === 'string') {
        const cleaned = cleanString(v);
        if (cleaned !== v) {
          changes.push({ id: char.id, field: k, before: v, after: cleaned, rule: 'string_cleanup', confidence: 'high' });
          char[k] = cleaned;
        }
      }
    }
  }

  // 2. 精确去重（同 id）
  const deduped = dedupById(data, ['alias', 'relationships', 'source_refs', 'rag_refs', 'known_skills', 'related_skills']);
  if (deduped.dedupCount > 0) {
    changes.push({ id: '*', field: '*', before: `${data.length} records`, after: `${deduped.data.length} records`, rule: 'dedup_by_id', confidence: 'high' });
  }

  // 3. role 枚举归一
  for (const char of deduped.data) {
    if (char.role && !CHARACTER_ROLE_ENUM.includes(char.role)) {
      const mapped = mapCharacterRole(char.role);
      if (mapped) {
        changes.push({ id: char.id, field: 'role', before: char.role, after: mapped, rule: 'character.role_map', confidence: 'high' });
        char.role = mapped;
      } else {
        pending.push({ id: char.id, reason: 'role_not_in_enum', value: char.role });
      }
    }
  }

  // 4. 空值规整
  for (const char of deduped.data) {
    for (const [k, v] of Object.entries(char)) {
      if (k === 'id') continue;
      if (isEmptyValue(v) && v !== null) {
        changes.push({ id: char.id, field: k, before: v, after: null, rule: 'null_normalize', confidence: 'high' });
        char[k] = null;
      }
    }
  }

  // 5. relationships.target 引用修复（指向被合并的 id）
  const validIds = new Set(deduped.data.map(c => c.id));
  for (const char of deduped.data) {
    if (!Array.isArray(char.relationships)) continue;
    for (const rel of char.relationships) {
      if (rel.target && !validIds.has(rel.target)) {
        // 尝试在去重 idMap 中查找
        const remapped = deduped.idMap[rel.target];
        if (remapped) {
          changes.push({ id: char.id, field: 'relationships.target', before: rel.target, after: remapped, rule: 'reference_fix', confidence: 'high' });
          rel.target = remapped;
        } else {
          pending.push({ id: char.id, reason: 'invalid_relationship_target', value: rel.target });
        }
      }
    }
  }

  return { data: deduped.data, changes, pending, deletedCount };
}

function mapCharacterRole(role) {
  // 不做模糊映射，只处理明确的
  return null;
}

// ============================================================
// dialogues
// ============================================================

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

function sanitizeDialogues(data, companions) {
  if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

  const changes = [];
  const pending = [];
  let deletedCount = 0;
  const kept = [];

  // 构建 characters 索引（用于 speaker 匹配）
  const chars = companions.characters || [];
  const charNameMap = new Map(); // name/alias -> char id (唯一匹配时可用)
  for (const c of chars) {
    if (c.name) {
      addUniqueMapValue(charNameMap, c.name, c.id);
    }
    if (Array.isArray(c.alias)) {
      for (const a of c.alias) {
        addUniqueMapValue(charNameMap, a, c.id);
      }
    }
  }

  for (const d of data) {
    // 字符串清理
    if (typeof d.text === 'string') {
      const cleaned = cleanString(d.text);
      if (cleaned !== d.text) {
        changes.push({ id: `${d.chapter}-${d.line_start}`, field: 'text', before: d.text, after: cleaned, rule: 'string_cleanup', confidence: 'high' });
        d.text = cleaned;
      }
    }

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
        } else {
          pending.push({ id: `${d.chapter}-${d.line_start}`, reason: 'speaker_name_ambiguous', value: d.speaker_name });
        }
      }
    }

    // speaker 指向已合并角色 ID 时同步重写
    // (这里 companion characters 已经是预清洗后的，id 已合并)

    kept.push(d);
  }

  return { data: kept, changes, pending, deletedCount };
}

// ============================================================
// locations
// ============================================================

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

function sanitizeLocations(data, companions) {
  if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

  const changes = [];
  const pending = [];

  for (const loc of data) {
    // 字符串清理
    for (const [k, v] of Object.entries(loc)) {
      if (typeof v === 'string') {
        const cleaned = cleanString(v);
        if (cleaned !== v) {
          changes.push({ id: loc.id, field: k, before: v, after: cleaned, rule: 'string_cleanup', confidence: 'high' });
          loc[k] = cleaned;
        }
      }
    }

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

    // 空值规整
    for (const [k, v] of Object.entries(loc)) {
      if (k === 'id') continue;
      if (isEmptyValue(v) && v !== null) {
        changes.push({ id: loc.id, field: k, before: v, after: null, rule: 'null_normalize', confidence: 'high' });
        loc[k] = null;
      }
    }
  }

  return { data, changes, pending, deletedCount: 0 };
}

function mapRegion(region, loc) {
  for (const [standard, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const kw of keywords) {
      if (region.includes(kw)) return standard;
    }
  }
  // 尝试从 location name 或 parent 推断
  const name = loc.name || '';
  for (const [standard, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const kw of keywords) {
      if (name.includes(kw)) return standard;
    }
  }
  return null;
}

// ============================================================
// factions
// ============================================================

const FACTION_TYPE_ENUM = ['武林门派', '帮派', '家族', '军队', '王族', '寺院', '部族', '官署'];

const FACTION_TYPE_MAP = {
  '武林家族': '家族', '武林世家': '家族',
  '丐帮分舵': '帮派',
  '剑派': '武林门派', '岛派': '武林门派',
  '佛寺与大理段氏护国武学重地': '寺院', '吐蕃佛寺武学势力': '寺院',
  '上位江湖势力': '武林门派',
};

function sanitizeFactions(data, companions, context) {
  if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

  const changes = [];
  const pending = [];
  const companionWrites = [];
  let deletedCount = 0;
  const originalNames = new Map();

  // 1. 字符串清理
  for (const f of data) {
    originalNames.set(f, f.name);
    for (const [k, v] of Object.entries(f)) {
      if (typeof v === 'string') {
        const cleaned = cleanString(v);
        if (cleaned !== v) {
          changes.push({ id: f.id, field: k, before: v, after: cleaned, rule: 'string_cleanup', confidence: 'high' });
          f[k] = cleaned;
        }
      }
    }
  }

  // 2. type 枚举归一
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

  // 3. name+location 完全相同的势力合并
  const dedupKey = new Map();
  const kept = [];
  const factionNameRedirects = new Map();
  for (const f of data) {
    const key = `${f.name}||${f.location || ''}`;
    if (dedupKey.has(key)) {
      const existing = dedupKey.get(key);
      const oldName = originalNames.get(f);
      if (oldName && oldName !== existing.name) factionNameRedirects.set(oldName, existing.name);
      // 合并 source_refs
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

  // 4. 同步 characters.faction 中完全匹配旧 name 的引用
  const charactersPath = context && context.companionFiles && context.companionFiles.characters;
  if (charactersPath && factionNameRedirects.size > 0 && Array.isArray(companions.characters)) {
    let characterChanged = false;
    for (const char of companions.characters) {
      if (typeof char.faction === 'string' && factionNameRedirects.has(char.faction)) {
        const nextFaction = factionNameRedirects.get(char.faction);
        changes.push({ id: char.id, field: 'characters.faction', before: char.faction, after: nextFaction, rule: 'faction_reference_fix', confidence: 'high' });
        char.faction = nextFaction;
        characterChanged = true;
      }
    }
    if (characterChanged) {
      companionWrites.push({ path: charactersPath, data: companions.characters });
    }
  }

  // 5. location ID 残留修复
  const locs = companions.locations || [];
  const locIdMap = new Map();
  for (const l of locs) {
    if (l.id) locIdMap.set(l.id, l.name);
  }
  for (const f of kept) {
    if (f.location && locIdMap.has(f.location)) {
      const locName = locIdMap.get(f.location);
      changes.push({ id: f.id, field: 'location', before: f.location, after: locName, rule: 'location_id_to_name', confidence: 'high' });
      f.location = locName;
    }
  }

  // 6. 空值规整
  for (const f of kept) {
    for (const [k, v] of Object.entries(f)) {
      if (k === 'id') continue;
      if (isEmptyValue(v) && v !== null) {
        changes.push({ id: f.id, field: k, before: v, after: null, rule: 'null_normalize', confidence: 'high' });
        f[k] = null;
      }
    }
  }

  return { data: kept, changes, pending, deletedCount, companionWrites };
}

// ============================================================
// items
// ============================================================

const ITEM_TYPE_ENUM = ['兵器', '暗器', '防具', '丹药', '毒药', '信物', '秘籍', '坐骑', '食物', '工具', '饰品'];

const ITEM_TYPE_MAP = {
  '兵器': '兵器', 'weapon': '兵器', '随身利器': '兵器', 'siege_weapon': '兵器', '武器': '兵器',
  '暗器': '暗器', 'hidden_weapon': '暗器', '兵器暗器': '暗器',
  '丹药': '丹药', 'pill': '丹药', 'medicine': '丹药', '药瓶': '丹药', '解药': '丹药', '金创药': '丹药', '香药': '丹药', '毒草兼解药': '丹药',
  '毒药': '毒药', 'poison': '毒药', '毒物': '毒药',
  '防具': '防具', 'armor': '防具', 'clothing': '防具', '衣饰': '防具', '服饰': '防具', '衣物': '防具',
  '食物': '食物', '酒': '食物',
  '坐骑': '坐骑', 'mount': '坐骑', '灵禽': '坐骑',
  '信物': '信物', '书信': '信物', '信件': '信物', '令牌': '信物', 'message': '信物', 'token': '信物', '证物': '信物', '图卷': '信物', '书画': '信物', '军旗': '信物',
  '秘籍': '秘籍', '武学秘笈': '秘籍', '武学图谱': '秘籍', '经书': '秘籍', '书籍': '秘籍', 'book': '秘籍', 'manual': '秘籍', 'document': '秘籍',
  '工具': '工具', 'tool': '工具', 'training_tool': '工具', '临时工具': '工具', '随身器物': '工具', '随身物': '工具', '器物': '工具', '物品': '工具', 'formation': '工具', 'trap': '工具',
  '饰品': '饰品', '饰物': '饰品', 'accessory': '饰品', '首饰': '饰品', '剑饰': '饰品', 'jewelry': '饰品',
};

const RARITY_ENUM = ['寻常凡品', '上乘佳品', '稀世珍品', '绝世神兵'];

function sanitizeItems(data, companions) {
  if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

  const changes = [];
  const pending = [];

  // 1. 字符串清理
  for (const item of data) {
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'string') {
        const cleaned = cleanString(v);
        if (cleaned !== v) {
          changes.push({ id: item.id, field: k, before: v, after: cleaned, rule: 'string_cleanup', confidence: 'high' });
          item[k] = cleaned;
        }
      }
    }
  }

  // 2. type 归一
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

  // 3. rarity_tier "未知" → "寻常凡品"
  for (const item of data) {
    if (item.rarity_tier === '未知') {
      changes.push({ id: item.id, field: 'rarity_tier', before: '未知', after: '寻常凡品', rule: 'rarity_unknown_default', confidence: 'high' });
      item.rarity_tier = '寻常凡品';
    }
    if (item.rarity_tier && !RARITY_ENUM.includes(item.rarity_tier)) {
      pending.push({ id: item.id, reason: 'rarity_not_in_enum', value: item.rarity_tier });
    }
  }

  // 4. owner 引用已合并角色 ID 时同步修复
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

  // 5. 同 type+同 name 重复道具合并
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

  // 6. 空值规整
  for (const item of kept) {
    for (const [k, v] of Object.entries(item)) {
      if (k === 'id') continue;
      if (isEmptyValue(v) && v !== null) {
        changes.push({ id: item.id, field: k, before: v, after: null, rule: 'null_normalize', confidence: 'high' });
        item[k] = null;
      }
    }
  }

  return { data: kept, changes, pending, deletedCount };
}

// ============================================================
// skills + techniques
// ============================================================

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

function sanitizeSkills(data, companions) {
  if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

  const changes = [];
  const pending = [];

  // 1. 字符串清理
  for (const skill of data) {
    for (const [k, v] of Object.entries(skill)) {
      if (typeof v === 'string') {
        const cleaned = cleanString(v);
        if (cleaned !== v) {
          changes.push({ id: skill.id, field: k, before: v, after: cleaned, rule: 'string_cleanup', confidence: 'high' });
          skill[k] = cleaned;
        }
      }
    }
  }

  // 2. 精确去重
  const deduped = dedupById(data, ['techniques', 'progression', 'effects', 'rag_refs', 'source_refs']);
  if (deduped.dedupCount > 0) {
    changes.push({ id: '*', field: '*', before: `${data.length} records`, after: `${deduped.data.length} records`, rule: 'dedup_by_id', confidence: 'high' });
  }

  // 3. 空值规整
  for (const skill of deduped.data) {
    for (const [k, v] of Object.entries(skill)) {
      if (k === 'id') continue;
      if (isEmptyValue(v) && v !== null) {
        changes.push({ id: skill.id, field: k, before: v, after: null, rule: 'null_normalize', confidence: 'high' });
        skill[k] = null;
      }
    }
  }

  return { data: deduped.data, changes, pending, deletedCount: 0 };
}

function sanitizeTechniques(data, companions) {
  if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

  const changes = [];
  const pending = [];
  let deletedCount = 0;

  // 1. 字符串清理
  for (const tech of data) {
    for (const [k, v] of Object.entries(tech)) {
      if (typeof v === 'string') {
        const cleaned = cleanString(v);
        if (cleaned !== v) {
          changes.push({ id: tech.id, field: k, before: v, after: cleaned, rule: 'string_cleanup', confidence: 'high' });
          tech[k] = cleaned;
        }
      }
    }
  }

  // 2. type 归一
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

  // 3. source_skill 引用修复（指向已合并 skill ID）
  const skills = companions.skills || [];
  const skillIdSet = new Set(skills.map(s => s.id));
  const skillNameMap = new Map();
  for (const s of skills) {
    addUniqueMapValue(skillNameMap, s.name, s.id);
  }

  for (const tech of data) {
    if (tech.source_skill && !skillIdSet.has(tech.source_skill)) {
      // 尝试按 name 匹配
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

  // 4. 同 id 或同 name+同 source_skill 合并
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

  // 5. orphan technique 补 source_skill（name 完全匹配唯一 skill 时）
  for (const tech of kept) {
    if (!tech.source_skill && tech.name) {
      if (skillNameMap.has(tech.name)) {
        const matchId = skillNameMap.get(tech.name);
        if (matchId) {
          changes.push({ id: tech.id, field: 'source_skill', before: null, after: matchId, rule: 'orphan_attach', confidence: 'high' });
          tech.source_skill = matchId;
        } else {
          pending.push({ id: tech.id, reason: 'source_skill_name_ambiguous', value: tech.name });
        }
      } else {
        pending.push({ id: tech.id, reason: 'orphan_source_skill_unmatched', value: tech.name });
      }
    }
  }

  // 6. 空值规整
  for (const tech of kept) {
    for (const [k, v] of Object.entries(tech)) {
      if (k === 'id') continue;
      if (isEmptyValue(v) && v !== null) {
        changes.push({ id: tech.id, field: k, before: v, after: null, rule: 'null_normalize', confidence: 'high' });
        tech[k] = null;
      }
    }
  }

  return { data: kept, changes, pending, deletedCount };
}

// ============================================================
// 报告生成
// ============================================================

function renderReportMd(report) {
  const s = report.summary;
  let md = `# ${report.file} 预清洗报告\n\n`;
  md += `## 汇总\n\n`;
  md += `| 项 | 数量 |\n|----|------|\n`;
  md += `| 原始记录 | ${s.records_before} |\n`;
  md += `| 输出记录 | ${s.records_after} |\n`;
  md += `| 修改记录 | ${s.changed_records} |\n`;
  md += `| 删除记录 | ${s.deleted_records} |\n`;
  md += `| 待复核 | ${s.pending_records} |\n\n`;

  if (report.changes.length > 0) {
    md += `## 自动修改\n\n`;
    md += `| id | 字段 | 原值 | 新值 | 规则 |\n|----|------|------|------|------|\n`;
    // 只显示前 200 条
    const shown = report.changes.slice(0, 200);
    for (const c of shown) {
      const before = c.before === null ? 'null' : String(c.before).slice(0, 40);
      const after = c.after === null ? 'null' : String(c.after).slice(0, 40);
      md += `| ${c.id} | ${c.field} | ${before} | ${after} | ${c.rule} |\n`;
    }
    if (report.changes.length > 200) {
      md += `\n> 共 ${report.changes.length} 条修改，仅显示前 200 条\n`;
    }
    md += '\n';
  }

  if (report.pending.length > 0) {
    md += `## 待复核\n\n`;
    md += `| id | 原因 | 值 |\n|----|------|----|\n`;
    const shown = report.pending.slice(0, 100);
    for (const p of shown) {
      md += `| ${p.id} | ${p.reason} | ${p.value} |\n`;
    }
    if (report.pending.length > 100) {
      md += `\n> 共 ${report.pending.length} 条待复核，仅显示前 100 条\n`;
    }
  }

  return md;
}

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('用法: node sanitizer.js <novelDir> <fileName> <fileKind> [--companions JSON]');
    process.exit(1);
  }

  const [novelDir, fileName, fileKind] = args;
  let companionFiles = {};

  // 解析 --companions 参数
  const compIdx = args.indexOf('--companions');
  if (compIdx >= 0 && args[compIdx + 1]) {
    try {
      companionFiles = JSON.parse(args[compIdx + 1]);
    } catch (e) {
      console.error('--companions 参数必须是合法 JSON');
      process.exit(1);
    }
  }

  const result = sanitizeNovelFile({ novelDir, fileName, fileKind, companionFiles });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { sanitizeNovelFile };
