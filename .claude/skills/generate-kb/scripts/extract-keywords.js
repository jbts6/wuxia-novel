#!/usr/bin/env node
'use strict';

/**
 * extract-keywords.js
 * 为每本小说提取专属关键词字典，供 locate.js 使用
 * 
 * 用法: node extract-keywords.js <novelDir>
 * 输出: <novelDir>/keywords.json
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: extract-keywords.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
const splitDir = path.join(novelDir, 'ch_split');
const mentionPath = path.join(novelDir, 'mention_index.jsonl');

if (!fs.existsSync(splitDir)) {
  console.error(`ch_split/ not found; run split-chapters.js first`);
  process.exit(1);
}

// 1. 从 mention_index.jsonl 加载高频词
const mentionTerms = new Set();
if (fs.existsSync(mentionPath)) {
  for (const raw of fs.readFileSync(mentionPath, 'utf8').split(/\r?\n/)) {
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      if (obj.term && obj.term.length >= 2) {
        mentionTerms.add(obj.term);
      }
    } catch {}
  }
}
console.log(`From mention_index: ${mentionTerms.size} terms`);

// 2. 读取所有章节原文
const chapterFiles = fs.readdirSync(splitDir).filter(f => f.startsWith('ch_') && f.endsWith('.txt'));
const allText = chapterFiles.map(f => fs.readFileSync(path.join(splitDir, f), 'utf8')).join('\n');

// 3. 武侠关键词类型提示（仅用于分类，具体关键词从mention和实体JSON中提取）
const wuxiaKeywordTypes = {
  'skill_types': [
    '剑法', '掌法', '拳法', '刀法', '鞭法', '枪法', '棍法', '杖法',
    '暗器', '轻功', '内功', '点穴', '擒拿', '指法', '腿法', '爪法',
  ],
  'event_types': [
    '比武', '报仇', '结拜', '定情', '自尽', '传授', '激斗', '对峙',
    '大战', '决战', '血战', '围攻', '伏击',
    '重逢', '相会', '离别', '归隐',
    '中毒', '受伤', '疗伤', '解毒',
  ],
  'item_types': [
    '剑', '刀', '枪', '棍', '鞭', '针', '镖', '暗器',
    '秘籍', '宝剑', '宝刀', '神兵', '利器',
    '丹药', '解药', '毒药',
  ],
};

// 4. 从原文中提取实际出现的武侠类型词（用于分类，不直接加入关键词）
const foundTypeKeywords = {};
for (const [category, keywords] of Object.entries(wuxiaKeywordTypes)) {
  foundTypeKeywords[category] = [];
  for (const kw of keywords) {
    if (allText.includes(kw)) {
      foundTypeKeywords[category].push(kw);
    }
  }
}
console.log(`From type hints: ${Object.values(foundTypeKeywords).flat().length} type keywords found`);

// 4.5 从已生成的实体 JSON 中提取实体名（Phase 2 产物）
const entityNames = new Set();
const dataDir = path.join(novelDir, 'data');
const entityFiles = ['characters.json', 'factions.json', 'locations.json', 'skills.json', 'techniques.json', 'items.json'];
if (fs.existsSync(dataDir)) {
  for (const jf of entityFiles) {
    const fp = path.join(dataDir, jf);
    if (!fs.existsSync(fp)) continue;
    try {
      const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const entities = Array.isArray(arr) ? arr : [];
      for (const e of entities) {
        if (e.name && e.name.length >= 2) entityNames.add(e.name);
        if (e.alias && Array.isArray(e.alias)) {
          for (const a of e.alias) {
            if (a && a.length >= 2) entityNames.add(a);
          }
        }
      }
    } catch {}
  }
  console.log(`From entity JSONs: ${entityNames.size} names`);
}

// 5. 合并所有关键词（主要来源：mention高频词 + 实体名）
const allKeywords = new Set();

// 添加 mention 中的高频词（主要来源）
for (const term of mentionTerms) {
  allKeywords.add(term);
}

// 添加实体名（主要来源）
for (const name of entityNames) {
  allKeywords.add(name);
}

// 添加武侠类型词（辅助来源，用于通用匹配）
for (const keywords of Object.values(foundTypeKeywords)) {
  for (const kw of keywords) {
    allKeywords.add(kw);
  }
}

// 6. 过滤停用词
const stopwords = new Set([
  '的', '了', '在', '是', '与', '和', '他', '她', '它', '们', '为', '以',
  '其', '所', '将', '被', '把', '给', '让', '着', '过', '到', '从', '向',
  '对', '由', '经', '因', '若', '虽', '而', '且', '或', '但', '却', '也',
  '都', '又', '还', '就', '才', '很', '太', '更', '已', '不', '没', '别',
  '初', '次', '中', '后', '前', '得', '个', '这', '那', '有', '无', '我',
  '你', '他', '她', '它', '们', '谁', '什么', '怎样', '如何', '为什么',
]);

const finalKeywords = [...allKeywords]
  .filter(kw => !stopwords.has(kw) && kw.length >= 2)
  .sort((a, b) => b.length - a.length); // 按长度降序，长词优先

console.log(`Total keywords: ${finalKeywords.length}`);
console.log('By category:');
for (const [category, keywords] of Object.entries(foundTypeKeywords)) {
  console.log(`  ${category}: ${keywords.length}`);
}

// 7. 写入 keywords.json
const outputPath = path.join(novelDir, 'build', 'keywords.json');
fs.writeFileSync(outputPath, JSON.stringify(finalKeywords, null, 2));
console.log(`\nWrote ${outputPath}`);
