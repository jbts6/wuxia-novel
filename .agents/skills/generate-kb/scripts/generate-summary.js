#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { computeFinalDataHash } = require('./lib/final-data-contract');
const {
  assertExpectedFinalDataHash,
  parseArtifactArgs,
  resolveArtifactRoots
} = require('./lib/report-context');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');

const DATA_FILES = {
  characters: 'characters.json',
  factions: 'factions.json',
  locations: 'locations.json',
  skills: 'skills.json',
  techniques: 'techniques.json',
  items: 'items.json',
  dialogues: 'dialogues.json',
  chapter_summaries: 'chapter_summaries.json'
};

function loadJson(filename, fallback) {
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : fallback;
}

function important(records) {
  return records.filter(record => ['core', 'important', '核心', '重要'].includes(record.importance));
}

function names(records, limit = 40) {
  const values = records.map(record => record.name).filter(Boolean).slice(0, limit);
  return values.length ? values.join('、') : '无';
}

function generateSummary(novelDir, options = {}) {
  const roots = resolveArtifactRoots(novelDir, options);
  const finalDataHash = computeFinalDataHash(novelDir, { dataRoot: roots.dataRoot });
  assertExpectedFinalDataHash(finalDataHash, roots.expectedFinalDataHash);
  const data = Object.fromEntries(Object.entries(DATA_FILES).map(([key, filename]) => [
    key,
    loadJson(path.join(roots.dataRoot, filename), [])
  ]));
  const sourceIndex = loadJson(path.join(roots.buildRoot, 'source-index.json'), {});
  const quality = loadJson(path.join(roots.reportsRoot, 'quality_report.json'), {});
  if (quality.final_data_hash && quality.final_data_hash !== finalDataHash) {
    throw new Error('quality_report.json final_data_hash does not match the selected data root');
  }
  const novel = sourceIndex.novel || path.basename(novelDir);
  const author = sourceIndex.author || path.basename(path.dirname(novelDir));
  const dialogueChapters = new Set(data.dialogues.map(dialogue => dialogue.chapter).filter(Number.isInteger));

  const lines = [
    `# ${novel}知识库摘要`,
    '',
    `- 作者：${author}`,
    `- 原文 SHA-256：${sourceIndex.source_hash || '未准备'}`,
    `- 完成门禁：${quality.completion_gate_passed === true ? 'PASS' : 'FAIL'}`,
    `- 人工金标：${quality.baseline_mode || 'no_gold'}`,
    '',
    '## 数据规模',
    '',
    '| 类别 | 数量 |',
    '|---|---:|',
    ...Object.keys(DATA_FILES).map(key => `| ${key} | ${data[key].length} |`),
    '',
    '## 硬门禁',
    ''
  ];

  if (quality.gates) {
    for (const [id, gate] of Object.entries(quality.gates)) {
      lines.push(`### ${id}: ${gate.passed ? 'PASS' : 'FAIL'}`);
      if (gate.reasons?.length) gate.reasons.forEach(reason => lines.push(`- ${reason}`));
      else lines.push('- 无阻塞项。');
      lines.push('');
    }
  } else {
    lines.push('- 尚未生成新版质量报告。', '');
  }

  lines.push(
    '## 主要角色', '', names(important(data.characters)), '',
    '## 武功', '', names(data.skills), '',
    '## 招式', '', names(data.techniques), '',
    '## 关键物品', '', names(important(data.items)), '',
    '## 门派与势力', '', names(data.factions), '',
    '## 地点', '', names(data.locations), '',
    '## 对话覆盖', '',
    `- 对话总数：${data.dialogues.length}`,
    `- 覆盖章节：${dialogueChapters.size}/${data.chapter_summaries.length}`,
    ''
  );
  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  try {
    const context = parseArtifactArgs(process.argv.slice(2), {
      usage: 'Usage: node generate-summary.js <novel-dir> [--bundle-root DIR | --data-root DIR --reports-root DIR] [--build-root DIR] [--expected-final-data-hash HASH]'
    });
    const outputPath = path.join(context.novelDir, 'summary.md');
    assertLegacyWriteAllowed(context.novelDir, { operation: 'generate-summary' });
    fs.writeFileSync(outputPath, generateSummary(context.novelDir, context));
    console.log(`Summary written to ${outputPath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { generateSummary };
