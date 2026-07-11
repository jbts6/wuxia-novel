#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: check-skill-items.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);

const skillsFile = path.join(novelDir, 'data', 'skills.json');
const itemsFile = path.join(novelDir, 'data', 'items.json');

if (!fs.existsSync(skillsFile) || !fs.existsSync(itemsFile)) {
  console.error('skills.json or items.json not found');
  process.exit(1);
}

const skills = JSON.parse(fs.readFileSync(skillsFile, 'utf8'));
const items = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));

const itemNames = new Set(items.map(i => i.name));
const itemIds = new Set(items.map(i => i.id));

// 1. 与 items.json 重名的 skill（可能是重复或错放）
const duplicates = skills.filter(s => itemNames.has(s.name));

// 2. 类型可疑的 skill（可能是错放到 skills.json 的兵器）
//    这些需要 LLM 二次审核

// 武功常见后缀（包含这些后缀的是武功，不是兵器）
const SKILL_SUFFIXES = /法$|功$|掌$|拳$|指$|腿$|步$|术$|诀$|经$|功法$|神功$|心法$|大法$|真经$|秘笈$|刀法$|剑法$|棍法$|枪法$|鞭法$|杖法$|钩法$|戟法$|锏法$|锤法$|斧法$/;

function isSuspiciousSkill(skill) {
  const name = skill.name;
  // 以武功后缀结尾 → 是武功，不可疑
  if (SKILL_SUFFIXES.test(name)) return false;
  // 排除"神剑""飞刀"等武功名
  if (/神剑|飞刀|飞剑|真剑|仙剑/.test(name)) return false;
  // type 是暗器且名字不以武功后缀结尾 → 可疑（可能是实物暗器）
  if (skill.type === '暗器') return true;
  // type 是兵器/防具 → 肯定错放
  if (['兵器', '防具'].includes(skill.type)) return true;
  return false;
}

const suspicious = skills.filter(s => isSuspiciousSkill(s) && !duplicates.includes(s));

const report = {
  novel: path.basename(novelDir),
  total_skills: skills.length,
  total_items: items.length,
  duplicates: duplicates.map(s => ({ id: s.id, name: s.name, type: s.type })),
  suspicious: suspicious.map(s => ({ id: s.id, name: s.name, type: s.type })),
  needs_review: duplicates.length + suspicious.length
};

console.log(JSON.stringify(report, null, 2));

// 退出码：0=无问题，1=需要审核
process.exit(report.needs_review > 0 ? 1 : 0);
