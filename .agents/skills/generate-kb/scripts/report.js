#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: report.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
// Try reports/ subdirectory first, then root
const resultPath = fs.existsSync(path.join(novelDir, 'reports', 'verification_result.json'))
  ? path.join(novelDir, 'reports', 'verification_result.json')
  : path.join(novelDir, 'verification_result.json');
if (!fs.existsSync(resultPath)) {
  console.error(`verification_result.json not found; run verify.js first`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const { results, coverage } = data;

const lines = [];
lines.push(`# Verification Report — ${path.basename(novelDir)}`);
lines.push('');
lines.push(`Generated: ${data.generated_at}`);
lines.push('');

lines.push('## 整体统计');
lines.push('');
lines.push('| 文件 | 实体数 | 引文总数 | grounded | weak | unverified | grounded% |');
lines.push('|------|--------|----------|----------|------|------------|-----------|');
let grandTotal = { entities: 0, refs: 0, grounded: 0, weak: 0, unverified: 0 };
for (const [file, r] of Object.entries(results)) {
  if (r.error) {
    lines.push(`| ${file} | — | — | — | — | ERROR: ${r.error} |`);
    continue;
  }
  const refs = r.grounded + r.weak + r.unverified;
  const ratio = refs ? ((r.grounded / refs) * 100).toFixed(1) : '0.0';
  lines.push(`| ${file} | ${r.total} | ${refs} | ${r.grounded} | ${r.weak} | ${r.unverified} | ${ratio}% |`);
  grandTotal.entities += r.total;
  grandTotal.refs += refs;
  grandTotal.grounded += r.grounded;
  grandTotal.weak += r.weak;
  grandTotal.unverified += r.unverified;
}
const grandRatio = grandTotal.refs ? ((grandTotal.grounded / grandTotal.refs) * 100).toFixed(1) : '0.0';
lines.push(`| **合计** | **${grandTotal.entities}** | **${grandTotal.refs}** | **${grandTotal.grounded}** | **${grandTotal.weak}** | **${grandTotal.unverified}** | **${grandRatio}%** |`);
lines.push('');

lines.push('## Alternatives 校验（跨章证据）');
lines.push('');
lines.push('| 文件 | alt 总数 | grounded | weak | unverified | grounded% |');
lines.push('|------|----------|----------|------|------------|-----------|');
let altTotal = { total: 0, grounded: 0, weak: 0, unverified: 0 };
for (const [file, r] of Object.entries(results)) {
  if (r.error || r.alt_total == null) continue;
  const ratio = r.alt_total ? ((r.alt_grounded / r.alt_total) * 100).toFixed(1) : '—';
  lines.push(`| ${file} | ${r.alt_total} | ${r.alt_grounded} | ${r.alt_weak} | ${r.alt_unverified} | ${ratio}% |`);
  altTotal.total += r.alt_total;
  altTotal.grounded += r.alt_grounded;
  altTotal.weak += r.alt_weak;
  altTotal.unverified += r.alt_unverified;
}
const altRatio = altTotal.total ? ((altTotal.grounded / altTotal.total) * 100).toFixed(1) : '—';
lines.push(`| **合计** | **${altTotal.total}** | **${altTotal.grounded}** | **${altTotal.weak}** | **${altTotal.unverified}** | **${altRatio}%** |`);
lines.push('');

lines.push('## 跨章事件清单（alternatives 跨 ≥2 章）');
lines.push('');
lines.push('这些 source_ref 的 primary + alternatives 分布在多个章节，适合在 UI 里展示为时间线或多候选选择器。');
lines.push('');
let crossChapterCount = 0;
const crossItems = [];
for (const file of Object.keys(results)) {
  const r = results[file];
  if (r.error) continue;
  // Try data/ subdirectory first, then root
  const fp = fs.existsSync(path.join(novelDir, 'data', file))
    ? path.join(novelDir, 'data', file)
    : path.join(novelDir, file);
  if (!fs.existsSync(fp)) continue;
  let arr;
  try { arr = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
  for (const ent of arr) {
    if (!Array.isArray(ent.source_refs)) continue;
    for (const ref of ent.source_refs) {
      if (!Array.isArray(ref.alternatives) || ref.alternatives.length === 0) continue;
      const chapters = new Set([ref.chapter, ...ref.alternatives.map(a => a.chapter)]);
      if (chapters.size >= 2) {
        crossChapterCount++;
        if (crossItems.length < 30) {
          crossItems.push({
            file, name: ent.name, id: ent.id,
            anchor: (ref.anchor || '').slice(0, 60),
            chapters: [...chapters].sort((a, b) => a - b),
            primary: ref.chapter,
          });
        }
      }
    }
  }
}
if (crossItems.length === 0) {
  lines.push('_(无跨章事件)_');
} else {
  lines.push(`共 ${crossChapterCount} 个跨章 source_ref（展示前 30）：`);
  lines.push('');
  lines.push('| 文件 | 实体 | anchor | 章节分布 | primary |');
  lines.push('|------|------|--------|----------|---------|');
  for (const it of crossItems) {
    lines.push(`| ${it.file} | ${it.name} | ${it.anchor} | ch${it.chapters.join('/ch')} | ch${it.primary} |`);
  }
}
lines.push('');

lines.push('## 低置信度实体（grounded < 80%）');
lines.push('');
lines.push('这些实体需要人工复核或触发 Pass 3 补丁。');
lines.push('');
let lowConfCount = 0;
for (const [file, r] of Object.entries(results)) {
  if (r.error || !r.perEntity) continue;
  const low = r.perEntity.filter(e => e.grounded_ratio < 0.8 && e.total_refs > 0);
  if (!low.length) continue;
  lines.push(`### ${file}`);
  lines.push('');
  for (const e of low.sort((a, b) => a.grounded_ratio - b.grounded_ratio)) {
    lowConfCount++;
    lines.push(`- **${e.name}** (\`${e.id}\`)：${e.grounded}/${e.total_refs} grounded (${(e.grounded_ratio * 100).toFixed(0)}%)`);
    if (e.issues && e.issues.length) {
      for (const iss of e.issues.slice(0, 3)) {
        const refText = iss.ref?.text ? `\`${String(iss.ref.text).slice(0, 40)}\`` : '(no text)';
        lines.push(`  - ch${iss.ref?.chapter}:${iss.ref?.line_start} → ${iss.status} — ${iss.reason || ''} ${refText}`);
      }
    }
  }
  lines.push('');
}
if (lowConfCount === 0) lines.push('_(无低置信度实体)_');
lines.push('');

lines.push('## 完全无引文的实体');
lines.push('');
let noRef = 0;
for (const [file, r] of Object.entries(results)) {
  if (r.error || !r.perEntity) continue;
  const list = r.perEntity.filter(e => e.total_refs === 0);
  if (!list.length) continue;
  lines.push(`### ${file}`);
  for (const e of list) {
    noRef++;
    lines.push(`- \`${e.id}\` (${e.name})`);
  }
}
if (noRef === 0) lines.push('_(无)_');
lines.push('');

if (coverage) {
  lines.push('## Mention Index 覆盖率');
  lines.push('');
  lines.push(`- 索引中唯一术语：${coverage.total_unique_terms}`);
  lines.push(`- 已在 KB 中覆盖：${coverage.covered}`);
  lines.push(`- 未覆盖：${coverage.uncovered_count}`);
  lines.push('');
  lines.push('### 高频但未入 KB 的术语（Top 30）');
  lines.push('');
  lines.push('| 术语 | 提及次数 |');
  lines.push('|------|----------|');
  for (const u of coverage.top_uncovered) {
    lines.push(`| ${u.term} | ${u.count} |`);
  }
  lines.push('');
  lines.push('**建议**：高频术语（提及 ≥5 次）如确为真实实体，应在 Pass 3 补丁中补入。');
  lines.push('');
}

lines.push('## 建议的下一步');
lines.push('');
const needsPatch = lowConfCount > 0 || noRef > 0 || (coverage && coverage.top_uncovered.some(u => u.count >= 5));
if (needsPatch) {
  lines.push('1. 针对低置信度实体和无引文实体运行 Pass 3 补丁（`prompts/pass3-patch.md`）。');
  lines.push('2. 针对高频未覆盖术语，确认是否该补入 KB。');
  lines.push('3. 补丁合并后重跑 `verify.js` + `report.js`，直到 grounded ≥ 85%。');
} else {
  lines.push('质量良好，可直接使用。无需触发 Pass 3 补丁。');
}
lines.push('');

const md = lines.join('\n');
// Output to reports/ subdirectory
const reportsDir = path.join(novelDir, 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, 'verification_report.md'), md, 'utf8');
fs.writeFileSync(path.join(reportsDir, 'verification_report.json'), JSON.stringify({
  generated_at: data.generated_at,
  grand_total: grandTotal,
  grand_grounded_ratio: grandTotal.refs ? grandTotal.grounded / grandTotal.refs : 0,
  alt_total: altTotal,
  alt_grounded_ratio: altTotal.total ? altTotal.grounded / altTotal.total : 0,
  cross_chapter_count: crossChapterCount,
  low_confidence_count: lowConfCount,
  no_ref_count: noRef,
  needs_patch: needsPatch,
  coverage_summary: coverage ? {
    total_unique_terms: coverage.total_unique_terms,
    covered: coverage.covered,
    uncovered_count: coverage.uncovered_count,
  } : null,
}, null, 2), 'utf8');

console.log(`Wrote verification_report.md (${lines.length} lines)`);
console.log(`Wrote verification_report.json`);
console.log(`\ngrand total: ${grandTotal.refs} refs, grounded ${grandRatio}%`);
console.log(`low confidence entities: ${lowConfCount}`);
console.log(`entities with no refs: ${noRef}`);
console.log(`needs patch: ${needsPatch}`);
