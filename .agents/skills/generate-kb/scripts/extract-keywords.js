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

// 3. 常见武侠关键词库（通用，适用于所有武侠小说）
const wuxiaKeywords = {
  // 门派
  'sects': [
    '华山派', '武当派', '少林派', '峨嵋派', '昆仑派', '崆峒派', '点苍派',
    '丐帮', '明教', '全真教', '古墓派', '桃花岛', '白驼山', '星宿派',
    '五岳剑派', '青城派', '峨嵋', '昆仑', '崆峒', '点苍', '恒山派', '泰山派',
    '嵩山派', '衡山派', '日月神教', '灵鹫宫', '天山派', '逍遥派',
    '五毒教', '神龙教', '天地会', '红花会',
  ],
  // 地点
  'locations': [
    '华山', '泰山', '嵩山', '衡山', '恒山', '黄山', '峨眉山', '昆仑山',
    '大理', '洛阳', '开封', '北京', '南京', '杭州', '苏州', '扬州', '成都',
    '长安', '太原', '济南', '青岛', '福州', '广州', '云南', '四川', '陕西',
    '山东', '山西', '河南', '河北', '江南', '塞外', '关外', '辽东',
    '少林寺', '武当山', '峨嵋山', '昆仑山', '崆峒山',
  ],
  // 功法类型
  'skill_types': [
    '剑法', '掌法', '拳法', '刀法', '鞭法', '枪法', '棍法', '杖法',
    '暗器', '轻功', '内功', '点穴', '擒拿', '指法', '腿法', '爪法',
    '吸星大法', '北冥神功', '九阳神功', '九阴真经', '葵花宝典', '独孤九剑',
    '降龙十八掌', '打狗棒法', '一阳指', '六脉神剑', '乾坤大挪移', '太极剑',
    '紫霞神功', '混元功', '易筋经', '洗髓经',
  ],
  // 常见事件
  'events': [
    '比武', '报仇', '结拜', '定情', '自尽', '传授', '拜见', '激斗', '对峙',
    '大战', '决战', '血战', '独战', '群战', '围攻', '伏击', '暗杀',
    '重逢', '相会', '离别', '出家', '归隐', '登基', '继位', '称帝',
    '夺宝', '寻仇', '报仇', '雪恨', '冤枉', '平反', '昭雪',
    '中毒', '受伤', '疗伤', '解毒', '走火入魔',
    '结盟', '反目', '背叛', '投降', '归降',
  ],
  // 常见物品
  'items': [
    '剑', '刀', '枪', '棍', '鞭', '针', '镖', '暗器',
    '秘籍', '宝剑', '宝刀', '神兵', '利器',
    '丹药', '解药', '毒药', '迷药',
    '玉佩', '金钗', '戒指', '手镯', '项链',
  ],
};

// 4. 从原文中提取实际出现的关键词
const foundKeywords = {
  sects: [],
  locations: [],
  skill_types: [],
  events: [],
  items: [],
};

for (const [category, keywords] of Object.entries(wuxiaKeywords)) {
  for (const kw of keywords) {
    if (allText.includes(kw)) {
      foundKeywords[category].push(kw);
    }
  }
}

// 5. 合并所有关键词
const allKeywords = new Set();

// 添加 mention 中的高频词
for (const term of mentionTerms) {
  allKeywords.add(term);
}

// 添加找到的武侠关键词
for (const keywords of Object.values(foundKeywords)) {
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
for (const [category, keywords] of Object.entries(foundKeywords)) {
  console.log(`  ${category}: ${keywords.length}`);
}

// 7. 写入 keywords.json
const outputPath = path.join(novelDir, 'keywords.json');
fs.writeFileSync(outputPath, JSON.stringify(finalKeywords, null, 2));
console.log(`\nWrote ${outputPath}`);
