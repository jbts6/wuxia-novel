#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// 配置加载
// ============================================================

const SKILL_DIRS = [
  path.join(__dirname, '..'),         // .agents/skills
  path.join(__dirname, '../../.claude/skills'),
];

function findConfigFile(fileKind) {
  // 映射 fileKind -> skill 目录名
  const kindToSkill = {
    characters: 'distill-characters',
    dialogues: 'distill-dialogues-locations-factions',
    locations: 'distill-dialogues-locations-factions',
    factions: 'distill-dialogues-locations-factions',
    items: 'distill-items',
    skills: 'distill-skills-and-techniques',
    techniques: 'distill-skills-and-techniques',
  };

  const skillDir = kindToSkill[fileKind];
  if (!skillDir) return null;

  for (const base of SKILL_DIRS) {
    const configPath = path.join(base, skillDir, 'preclean-config.js');
    if (fs.existsSync(configPath)) return configPath;
  }
  return null;
}

function loadConfig(fileKind) {
  const configPath = findConfigFile(fileKind);
  if (!configPath) return null;
  return require(configPath);
}

// ============================================================
// 通用工具
// ============================================================

function cleanString(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim();
}

function isEmptyValue(v) {
  return v === '' || v === null || v === undefined
    || (typeof v === 'string' && ['未知', 'N/A', 'n/a', 'none', 'null', 'undefined'].includes(v.trim()));
}

function addUniqueMapValue(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) { map.set(key, value); return; }
  if (map.get(key) !== value) map.set(key, null);
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
      for (const f of arrayFields) {
        if (Array.isArray(item[f]) && Array.isArray(existing[f])) {
          const merged = [...existing[f]];
          for (const val of item[f]) {
            if (!merged.some(e => JSON.stringify(e) === JSON.stringify(val))) merged.push(val);
          }
          existing[f] = merged;
        }
      }
      for (const f of Object.keys(item)) {
        if (f === 'id' || Array.isArray(item[f])) continue;
        if (!existing[f] && item[f]) existing[f] = item[f];
        if (typeof existing[f] === 'string' && typeof item[f] === 'string' && item[f].length > existing[f].length) {
          existing[f] = item[f];
        }
      }
    } else {
      map.set(id, { ...item });
    }
  }

  return { data: Array.from(map.values()), dedupCount, idMap };
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

// ============================================================
// 通用预清洗（字符串清理、去重、空值规整）
// ============================================================

function sanitizeGeneric(data, arrayFields = []) {
  if (!Array.isArray(data)) return { data, changes: [], deletedCount: 0 };

  const changes = [];

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

  // 2. 精确去重
  const deduped = dedupById(data, arrayFields);
  if (deduped.dedupCount > 0) {
    changes.push({ id: '*', field: '*', before: `${data.length} records`, after: `${deduped.data.length} records`, rule: 'dedup_by_id', confidence: 'high' });
  }

  // 3. 空值规整
  for (const item of deduped.data) {
    for (const [k, v] of Object.entries(item)) {
      if (k === 'id') continue;
      if (isEmptyValue(v) && v !== null) {
        changes.push({ id: item.id, field: k, before: v, after: null, rule: 'null_normalize', confidence: 'high' });
        item[k] = null;
      }
    }
  }

  return { data: deduped.data, changes, deletedCount: 0 };
}

// ============================================================
// 文件类型路由
// ============================================================

const GENERIC_ARRAY_FIELDS = {
  characters: ['alias', 'relationships', 'source_refs', 'rag_refs', 'known_skills', 'related_skills'],
  dialogues: [],
  locations: ['source_refs', 'rag_refs'],
  factions: ['source_refs', 'characters'],
  items: ['source_refs', 'rag_refs'],
  skills: ['techniques', 'progression', 'effects', 'rag_refs', 'source_refs'],
  techniques: ['source_refs', 'rag_refs'],
};

function sanitizeByKind(data, fileKind, companions, context) {
  const config = loadConfig(fileKind);
  const arrayFields = GENERIC_ARRAY_FIELDS[fileKind] || [];

  // 1. 通用预清洗
  const generic = sanitizeGeneric(data, arrayFields);

  // 2. 类型专属预清洗（如果 config 有定义）
  let specific = { data: generic.data, changes: [], pending: [], deletedCount: 0 };

  if (config) {
    // 根据 fileKind 调用对应的 sanitize 函数
    const sanitizeFn = getSanitizeFunction(config, fileKind);
    if (sanitizeFn) {
      specific = sanitizeFn(generic.data, companions, context);
    }
  }

  // 3. 合并结果
  return {
    data: specific.data,
    changes: [...generic.changes, ...specific.changes],
    pending: specific.pending || [],
    deletedCount: (generic.deletedCount || 0) + (specific.deletedCount || 0),
    companionWrites: specific.companionWrites || [],
  };
}

function getSanitizeFunction(config, fileKind) {
  switch (fileKind) {
    case 'characters': return config.sanitize || null;
    case 'dialogues': return config.sanitizeDialogues || config.sanitize || null;
    case 'locations': return config.sanitizeLocations || config.sanitize || null;
    case 'factions': return config.sanitizeFactions || config.sanitize || null;
    case 'items': return config.sanitize || null;
    case 'skills': return config.sanitizeSkills || config.sanitize || null;
    case 'techniques': return config.sanitizeTechniques || config.sanitize || null;
    default: return null;
  }
}

// ============================================================
// 入口
// ============================================================

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
  const raw = fs.readFileSync(workPath, 'utf-8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  const recordsBefore = Array.isArray(data) ? data.length : 0;

  // 3. 加载 companion files
  const companions = {};
  for (const [kind, p] of Object.entries(companionFiles)) {
    if (p && fs.existsSync(p)) {
      try {
        companions[kind] = JSON.parse(fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, ''));
      } catch { /* ignore parse errors in companions */ }
    }
  }

  // 4. 执行预清洗
  const result = sanitizeByKind(data, fileKind, companions, { companionFiles, novelDir });

  // 5. 有数据变化时写回工作 JSON
  const changed = result.changes.length > 0;
  if (changed) {
    fs.writeFileSync(workPath, JSON.stringify(result.data, null, 2) + '\n');
  }

  // 6. preclean 快照
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
      started_at: new Date().toISOString(),
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

module.exports = { sanitizeNovelFile, loadConfig, findConfigFile };
