const fs = require('fs');

const chars = JSON.parse(fs.readFileSync('金庸/碧血剑/characters.json','utf-8'));
const skills = JSON.parse(fs.readFileSync('金庸/碧血剑/skills.json','utf-8'));
const items = JSON.parse(fs.readFileSync('金庸/碧血剑/items.json','utf-8'));

// Normalize rank - take first part if combined with semicolon
function normRank(r) {
  if (!r) return '未定';
  if (r.includes('；')) return r.split('；')[0];
  return r;
}

const charByRank = {};
chars.forEach(c => {
  const r = normRank(c.rank);
  if (!charByRank[r]) charByRank[r] = [];
  charByRank[r].push(c.name);
});

const skillByRank = {};
skills.forEach(s => {
  const r = normRank(s.rank);
  if (!skillByRank[r]) skillByRank[r] = [];
  skillByRank[r].push(s.name);
});

const itemByRarity = {};
items.forEach(i => {
  let r = i.rarity || '未定';
  if (r.includes('；')) r = r.split('；')[0];
  if (!itemByRarity[r]) itemByRarity[r] = [];
  itemByRarity[r].push(i.name);
});

const rankOrder = ['返璞归真','登峰造极','出神入化','炉火纯青','登堂入室','略有小成','初窥门径','平平无奇'];
const rarityOrder = ['绝世神兵','绝世神品','稀世珍品','上乘佳品','寻常凡品'];

const rankDesc = {
  '返璞归真': '已臻化境，天下无敌',
  '登峰造极': '五绝级别，当世最强',
  '出神入化': '仅次于绝顶，能与五绝对招',
  '炉火纯青': '江湖顶尖，门派掌门级',
  '登堂入室': '已入武学正途，门派核心弟子',
  '略有小成': '初窥门径，有一定战力',
  '初窥门径': '学过一些粗浅武功',
  '平平无奇': '不会武功或仅有蛮力'
};

const rarityDesc = {
  '绝世神兵': '百年难遇的神物，可遇不可求',
  '绝世神品': '绝世罕见的宝物',
  '稀世珍品': '世间少有，武林中人争相抢夺',
  '上乘佳品': '品质精良，名家所制',
  '寻常凡品': '江湖中随处可见'
};

let md = '# 碧血剑 · 实力等级概览\n\n';

md += '## 一、角色实力等级\n\n';
for (const rank of rankOrder) {
  const names = charByRank[rank] || [];
  md += '### ' + rank + '（' + rankDesc[rank] + '）\n';
  if (names.length === 0) {
    md += '（无）\n';
  } else {
    names.forEach(n => { md += '- ' + n + '\n'; });
  }
  md += '\n';
}

md += '## 二、功法品级\n\n';
for (const rank of rankOrder) {
  const names = skillByRank[rank] || [];
  md += '### ' + rank + '（' + rankDesc[rank] + '）\n';
  if (names.length === 0) {
    md += '（无）\n';
  } else {
    names.forEach(n => { md += '- ' + n + '\n'; });
  }
  md += '\n';
}

md += '## 三、物品等级\n\n';
for (const rarity of rarityOrder) {
  const names = itemByRarity[rarity] || [];
  md += '### ' + rarity + '（' + rarityDesc[rarity] + '，' + names.length + ' 件）\n';
  if (names.length === 0) {
    md += '（无）\n';
  } else {
    names.forEach(n => { md += '- ' + n + '\n'; });
  }
  md += '\n';
}

fs.writeFileSync('金庸/碧血剑/实力等级概览.md', md, 'utf-8');
console.log('实力等级概览.md generated');
console.log('Characters by rank:');
rankOrder.forEach(r => { console.log('  ' + r + ': ' + (charByRank[r] || []).length); });
console.log('Skills by rank:');
rankOrder.forEach(r => { console.log('  ' + r + ': ' + (skillByRank[r] || []).length); });
console.log('Items by rarity:');
rarityOrder.forEach(r => { console.log('  ' + r + ': ' + (itemByRarity[r] || []).length); });
