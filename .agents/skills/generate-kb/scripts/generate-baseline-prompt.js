#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: generate-baseline-prompt.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);

// Load manifest for novel info (from build/)
const manifestPath = path.join(novelDir, 'build', 'manifest.json');
let novelName = path.basename(novelDir);
let author = 'Unknown';
let chapterCount = 0;

if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    novelName = manifest.novel || novelName;
    author = manifest.author || author;
    chapterCount = manifest.chapter_count || 0;
  } catch {}
}

// Load mention_summary for entity hints (from build/)
const mentionPath = path.join(novelDir, 'build', 'mention_summary.json');
let mentionTerms = [];
if (fs.existsSync(mentionPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(mentionPath, 'utf8'));
    mentionTerms = (data.terms || []).slice(0, 50).map(t => t.term);
  } catch {}
}

// Load existing characters.json for ID reference (from data/)
const charPath = path.join(novelDir, 'data', 'characters.json');
let existingChars = [];
if (fs.existsSync(charPath)) {
  try {
    existingChars = JSON.parse(fs.readFileSync(charPath, 'utf8'));
  } catch {}
}

// Read the prompt template
const templatePath = path.join(__dirname, '..', 'prompts', 'generate-baseline.md');
let template = '';
if (fs.existsSync(templatePath)) {
  template = fs.readFileSync(templatePath, 'utf8');
}

// Generate the prompt
const prompt = `# 任务：为《${novelName}》生成知识库基准数据

## 小说信息
- 小说名称：${novelName}
- 作者：${author}
- 章节数：${chapterCount}
- 原文路径：${novelDir}/${novelName}.txt

## 已有角色 ID 参考
${existingChars.slice(0, 20).map(c => `- ${c.id}: ${c.name}`).join('\n')}

## 高频提及术语（供参考）
${mentionTerms.join('、')}

## Prompt 模板

${template}

## 输出要求

请生成完整的 baseline.json，包含：
1. characters：按核心/重要/次要/龙套分级
2. relationships：所有重要关系对
3. events：每章重要事件
4. skills：重要武功/技能
5. items：重要物品
6. dialogues：代表性对话示例

输出格式为 JSON，直接写入文件。
`;

// Write prompt to file
const outputPath = path.join(novelDir, 'prompts', 'baseline-prompt.md');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, prompt, 'utf8');

console.log(`Baseline prompt generated: ${outputPath}`);
console.log(`\nNovel: ${novelName}`);
console.log(`Author: ${author}`);
console.log(`Chapters: ${chapterCount}`);
console.log(`Existing characters: ${existingChars.length}`);
console.log(`Mention terms: ${mentionTerms.length}`);
