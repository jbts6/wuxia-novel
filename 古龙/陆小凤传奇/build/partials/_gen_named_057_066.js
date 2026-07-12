'use strict';
/**
 * Generate named-inventory candidates for ch057-ch066.
 * Run: node 古龙/陆小凤传奇/build/partials/_gen_named_057_066.js
 */
const fs = require('fs');
const path = require('path');

const novelDir = path.resolve(__dirname, '../..');
const sourceIndex = JSON.parse(fs.readFileSync(path.join(novelDir, 'build/source-index.json'), 'utf8'));
const windows = sourceIndex.windows.filter(w => w.chapter >= 57 && w.chapter <= 66);
const byId = Object.fromEntries(windows.map(w => [w.id, w]));

function lineAt(w, absLine) {
  const lines = w.text.split('\n');
  const idx = absLine - w.line_start;
  if (idx < 0 || idx >= lines.length) return null;
  return lines[idx];
}

function findLine(w, name, preferred) {
  const lines = w.text.split('\n');
  if (preferred != null) {
    const idx = preferred - w.line_start;
    if (idx >= 0 && idx < lines.length && lines[idx].includes(name)) {
      return { line: preferred, text: lines[idx] };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(name)) {
      return { line: w.line_start + i, text: lines[i] };
    }
  }
  return null;
}

// [windowId, name, category, preferredLine?]
// High-recall inventory: named people/factions/locations/skills/techniques/items in each window.
const specs = [
  // ===== ch057_w001 (1-120) =====
  ['ch057_w001', '陆小凤', 'character', 5],
  ['ch057_w001', '叶灵', 'character', 5],
  ['ch057_w001', '老刀把子', 'character', 7],
  ['ch057_w001', '叶雪', 'character', 29],
  ['ch057_w001', '阿雪', 'character', 35],
  ['ch057_w001', '柳青青', 'character', 87],

  // ===== ch057_w002 (101-191) =====
  ['ch057_w002', '陆小凤', 'character', 101],
  ['ch057_w002', '柳青青', 'character', 103],
  ['ch057_w002', '阿雪', 'character', 121],
  ['ch057_w002', '西门吹雪', 'character', 139],
  ['ch057_w002', '叶雪', 'character', 139],
  ['ch057_w002', '叶灵', 'character', 143],
  ['ch057_w002', '表哥', 'character', 149],
  ['ch057_w002', '通天阁', 'location', 165],
  ['ch057_w002', '通天崖', 'location', 171],
  ['ch057_w002', '幽灵山庄', 'location', 181],
  ['ch057_w002', '叶孤鸿', 'character', 183],

  // ===== ch058_w001 (1-120) =====
  ['ch058_w001', '海奇阔', 'character', 5],
  ['ch058_w001', '管家婆', 'character', 5],
  ['ch058_w001', '老刀把子', 'character', 5],
  ['ch058_w001', '陆小凤', 'character', 11],
  ['ch058_w001', '表哥', 'character', 11],
  ['ch058_w001', '柳青青', 'character', 11],
  ['ch058_w001', '叶雪', 'character', 35],
  ['ch058_w001', '花寡妇', 'character', 69],
  ['ch058_w001', '巴山顾道人', 'character', 75],
  ['ch058_w001', '游魂', 'character', 83],
  ['ch058_w001', '将军', 'character', 83],
  ['ch058_w001', '独孤美', 'character', 89],
  ['ch058_w001', '叶家姐妹', 'character', 101],
  ['ch058_w001', '叶孤鸿', 'character', 109],

  // ===== ch058_w002 (101-220) =====
  ['ch058_w002', '独孤美', 'character', 101],
  ['ch058_w002', '叶家姐妹', 'character', 101],
  ['ch058_w002', '花寡妇', 'character', 101],
  ['ch058_w002', '老刀把子', 'character', 103],
  ['ch058_w002', '陆小凤', 'character', 109],
  ['ch058_w002', '叶孤鸿', 'character', 109],
  ['ch058_w002', '叶雪', 'character', 169],
  ['ch058_w002', '通天阁', 'location', 1], // may fail - only if in window

  // ===== ch058_w003 (201-320) =====
  ['ch058_w003', '叶雪', 'character', 203],
  ['ch058_w003', '陆小凤', 'character', 205],
  ['ch058_w003', '沼泽', 'location', 243],

  // ===== ch058_w004 (301-420) =====
  ['ch058_w004', '陆小凤', 'character', 303],
  ['ch058_w004', '叶雪', 'character', 309],
  ['ch058_w004', '叶凌风', 'character', 373],
  ['ch058_w004', '玉树剑客', 'character', 373],
  ['ch058_w004', '老刀把子', 'character', 375],
  ['ch058_w004', '阿雪', 'character', 391],
  ['ch058_w004', '沼泽', 'location', 413],

  // ===== ch058_w005 (401-520) =====
  ['ch058_w005', '陆小凤', 'character', 407],
  ['ch058_w005', '老刀把子', 'character', 409],
  ['ch058_w005', '叶雪', 'character', 439],
  ['ch058_w005', '犬郎君', 'character', 455],
  ['ch058_w005', '将军', 'character', 491],
  ['ch058_w005', '小叶', 'character', 491],
  ['ch058_w005', '将军府', 'location', 525],

  // ===== ch058_w006 (501-620) =====
  ['ch058_w006', '犬郎君', 'character', 501],
  ['ch058_w006', '将军', 'character', 501],
  ['ch058_w006', '老刀把子', 'character', 509],
  ['ch058_w006', '将军府', 'location', 525],
  ['ch058_w006', '独孤美', 'character', 533],
  ['ch058_w006', '陆小凤', 'character', 535],
  ['ch058_w006', '六亲不认', 'character', 551],
  ['ch058_w006', '孙不变', 'character', 575],
  ['ch058_w006', '武当', 'faction', 575],
  ['ch058_w006', '石真人', 'character', 577],
  ['ch058_w006', '花四姑', 'character', 583],
  ['ch058_w006', '石鹤', 'character', 591],
  ['ch058_w006', '钟无骨', 'character', 597],
  ['ch058_w006', '玉树剑客', 'character', 601],
  ['ch058_w006', '叶凌风', 'character', 601],
  ['ch058_w006', '梅真人', 'character', 603],
  ['ch058_w006', '木道人', 'character', 605],
  ['ch058_w006', '石雁', 'character', 605],
  ['ch058_w006', '西门吹雪', 'character', 621],
  ['ch058_w006', '幽灵山庄', 'location', 621],

  // ===== ch058_w007 (601-720) =====
  ['ch058_w007', '玉树剑客', 'character', 601],
  ['ch058_w007', '叶凌风', 'character', 601],
  ['ch058_w007', '孙不变', 'character', 603],
  ['ch058_w007', '钟无骨', 'character', 603],
  ['ch058_w007', '武当', 'faction', 603],
  ['ch058_w007', '梅真人', 'character', 603],
  ['ch058_w007', '木道人', 'character', 605],
  ['ch058_w007', '石雁', 'character', 605],
  ['ch058_w007', '独孤美', 'character', 607],
  ['ch058_w007', '陆小凤', 'character', 609],
  ['ch058_w007', '将军', 'character', 609],
  ['ch058_w007', '将军府', 'location', 611],
  ['ch058_w007', '西门吹雪', 'character', 621],
  ['ch058_w007', '幽灵山庄', 'location', 621],
  ['ch058_w007', '老刀把子', 'character', 631],
  ['ch058_w007', '武当小天星掌力', 'skill', 643],
  ['ch058_w007', '玄玑穴', 'technique', 643],
  ['ch058_w007', '玄鸟划沙', 'technique', 647],
  ['ch058_w007', '平沙落雁', 'technique', 647],
  ['ch058_w007', '北雁南飞', 'technique', 647],
  ['ch058_w007', '武当掌法', 'skill', 647],
  ['ch058_w007', '石道人', 'character', 649],
  ['ch058_w007', '武当功夫', 'skill', 655],
  ['ch058_w007', '小天星掌力', 'skill', 667],

  // ===== ch058_w008 (701-820) =====
  ['ch058_w008', '陆小凤', 'character', 701],
  ['ch058_w008', '老刀把子', 'character', 703],
  ['ch058_w008', '孙不变', 'character', 717],
  ['ch058_w008', '将军', 'character', 739],
  ['ch058_w008', '钟无骨', 'character', 739],
  ['ch058_w008', '幽灵山庄', 'location', 769],
  ['ch058_w008', '波斯葡萄酒', 'item', 807],
  ['ch058_w008', '金钱豹', 'character', 827],
  ['ch058_w008', '花魁', 'character', 827],

  // ===== ch058_w009 (801-893) =====
  ['ch058_w009', '老刀把子', 'character', 801],
  ['ch058_w009', '陆小凤', 'character', 809],
  ['ch058_w009', '金钱豹', 'character', 827],
  ['ch058_w009', '花魁', 'character', 827],
  ['ch058_w009', '江南花家', 'faction', 833],
  ['ch058_w009', '花家', 'faction', 833],
  ['ch058_w009', '黑道七十二寨', 'faction', 839],
  ['ch058_w009', '辣手追魂', 'character', 839],
  ['ch058_w009', '杜铁心', 'character', 839],
  ['ch058_w009', '秦岭双猿', 'faction', 841],
  ['ch058_w009', '圣手仙猿', 'character', 841],
  ['ch058_w009', '娄大圣', 'character', 841],
  ['ch058_w009', '柳青青', 'character', 845],
  ['ch058_w009', '叶灵', 'character', 847],
  ['ch058_w009', '如意鱼皮水靠', 'item', 857],
  ['ch058_w009', '分水飞鱼刺', 'item', 857],
  ['ch058_w009', '如意水靠', 'item', 865],
  ['ch058_w009', '飞鱼刺', 'item', 865],
  ['ch058_w009', '飞鱼岛主', 'character', 867],
  ['ch058_w009', '于还', 'character', 867],
  ['ch058_w009', '中原武林', 'faction', 867],
  ['ch058_w009', '勾魂使者', 'character', 881],
  ['ch058_w009', '七星宝剑', 'item', 889],
  ['ch058_w009', '武当派', 'faction', 889],
  ['ch058_w009', '海奇阔', 'character', 891],

  // ===== ch059_w001 (1-120) =====
  ['ch059_w001', '老刀把子', 'character', 15],
  ['ch059_w001', '陆小凤', 'character', 19],
  ['ch059_w001', '武当石雁', 'character', 27],
  ['ch059_w001', '少林铁肩', 'character', 27],
  ['ch059_w001', '丐帮王十袋', 'character', 27],
  ['ch059_w001', '长江水上飞', 'character', 27],
  ['ch059_w001', '雁荡高行空', 'character', 27],
  ['ch059_w001', '巴山小顾道人', 'character', 27],
  ['ch059_w001', '十二连环坞', 'faction', 27],
  ['ch059_w001', '鹰眼老七', 'character', 27],
  ['ch059_w001', '朱菲', 'character', 51],
  ['ch059_w001', '地趟刀法', 'skill', 53],
  ['ch059_w001', '满地开花八十一式', 'technique', 53],
  ['ch059_w001', '于还', 'character', 83],
  ['ch059_w001', '飞鱼岛主', 'character', 83],
  ['ch059_w001', '南海群剑', 'faction', 81],
  ['ch059_w001', '白云城主', 'character', 81],
  ['ch059_w001', '水靠', 'item', 79],
  ['ch059_w001', '鱼刺', 'item', 79],
  ['ch059_w001', '杜铁心', 'character', 91],
  ['ch059_w001', '辣手无情', 'character', 105],

  // ===== ch059_w002 (101-220) =====
  ['ch059_w002', '杜铁心', 'character', 101],
  ['ch059_w002', '于还', 'character', 107],
  ['ch059_w002', '辣手无情', 'character', 105],
  ['ch059_w002', '朱菲', 'character', 127],
  ['ch059_w002', '司空斗', 'character', 143],
  ['ch059_w002', '大头鬼王', 'character', 143],
  ['ch059_w002', '西方群鬼', 'faction', 143],
  ['ch059_w002', '白骨爪', 'skill', 205],
  ['ch059_w002', '黑鬼爪', 'skill', 205],
  ['ch059_w002', '老刀把子', 'character', 199],
  ['ch059_w002', '吴先生', 'character', 199],
  ['ch059_w002', '陆小凤', 'character', 141],

  // ===== ch059_w003 (201-320) =====
  ['ch059_w003', '司空斗', 'character', 203],
  ['ch059_w003', '白骨爪', 'skill', 205],
  ['ch059_w003', '黑鬼爪', 'skill', 205],
  ['ch059_w003', '老刀把子', 'character', 199],
  ['ch059_w003', '吴先生', 'character', 199],
  ['ch059_w003', '苦瓜上人', 'character', 243],
  ['ch059_w003', '陆公子', 'character', 243],
  ['ch059_w003', '陆小凤', 'character', 245],
  ['ch059_w003', '少林寺', 'faction', 263],
  ['ch059_w003', '五罗汉', 'faction', 263],
  ['ch059_w003', '无龙罗汉', 'character', 265],
  ['ch059_w003', '五恶兽', 'faction', 267],
  ['ch059_w003', '藏经阁', 'location', 271],
  ['ch059_w003', '无龙', 'character', 271],
  ['ch059_w003', '石鹤', 'character', 277],
  ['ch059_w003', '武当', 'faction', 277],
  ['ch059_w003', '苦瓜和尚', 'character', 279],
  ['ch059_w003', '无豹', 'character', 283],
  ['ch059_w003', '高涛', 'character', 285],
  ['ch059_w003', '凤尾帮', 'faction', 285],
  ['ch059_w003', '顾飞云', 'character', 287],
  ['ch059_w003', '小顾道人', 'character', 287],
  ['ch059_w003', '巴山', 'location', 287],
  ['ch059_w003', '海奇阔', 'character', 289],
  ['ch059_w003', '水上飞', 'character', 289],
  ['ch059_w003', '长江', 'location', 289],
  ['ch059_w003', '杜铁心', 'character', 291],
  ['ch059_w003', '丐帮', 'faction', 291],
  ['ch059_w003', '高行空', 'character', 291],
  ['ch059_w003', '雁荡', 'location', 291],
  ['ch059_w003', '百胜刀王', 'character', 291],
  ['ch059_w003', '关天武', 'character', 291],
  ['ch059_w003', '梅真人', 'character', 297],
  ['ch059_w003', '石雁', 'character', 297],
  ['ch059_w003', '铁肩', 'character', 297],
  ['ch059_w003', '王十袋', 'character', 297],
  ['ch059_w003', '武当', 'faction', 297],

  // ===== ch059_w004 (301-420) =====
  ['ch059_w004', '老刀把子', 'character', 301],
  ['ch059_w004', '武当', 'faction', 301],
  ['ch059_w004', '杜铁心', 'character', 299],
  ['ch059_w004', '管家婆', 'character', 311],
  ['ch059_w004', '解剑池', 'location', 317],
  ['ch059_w004', '解剑岩', 'location', 317],
  ['ch059_w004', '雪隐', 'location', 319],
  ['ch059_w004', '娄老太太', 'character', 321],
  ['ch059_w004', '雪窦山', 'location', 329],
  ['ch059_w004', '明觉禅师', 'character', 329],
  ['ch059_w004', '灵隐寺', 'location', 329],
  ['ch059_w004', '雪峰义存', 'character', 331],
  ['ch059_w004', '于还', 'character', 335],
  ['ch059_w004', '叶灵', 'character', 345],
  ['ch059_w004', '飞鱼刺', 'item', 345],
  ['ch059_w004', '石鹤', 'character', 347],
  ['ch059_w004', '七星皮鞘', 'item', 347],
  ['ch059_w004', '叶孤城', 'character', 353],
  ['ch059_w004', '天外飞仙', 'technique', 353],
  ['ch059_w004', '陆小凤', 'character', 361],
  ['ch059_w004', '叶雪', 'character', 385],
  ['ch059_w004', '叶凌风', 'character', 387],
  ['ch059_w004', '武当石雁', 'character', 397],
  ['ch059_w004', '少林铁肩', 'character', 397],
  ['ch059_w004', '王十袋', 'character', 401],
  ['ch059_w004', '娄老太太', 'character', 403],
  ['ch059_w004', '小顾道人', 'character', 405],
  ['ch059_w004', '表哥', 'character', 405],
  ['ch059_w004', '水上飞', 'character', 405],
  ['ch059_w004', '海奇阔', 'character', 405],
  ['ch059_w004', '关天武', 'character', 409],
  ['ch059_w004', '高行空', 'character', 409],

  // ===== ch059_w005 (401-520) =====
  ['ch059_w005', '陆小凤', 'character', 401],
  ['ch059_w005', '老刀把子', 'character', 403],
  ['ch059_w005', '杜铁心', 'character', 401],
  ['ch059_w005', '王十袋', 'character', 401],
  ['ch059_w005', '娄老太太', 'character', 403],
  ['ch059_w005', '小顾道人', 'character', 405],
  ['ch059_w005', '表哥', 'character', 405],
  ['ch059_w005', '水上飞', 'character', 405],
  ['ch059_w005', '海奇阔', 'character', 405],
  ['ch059_w005', '关天武', 'character', 409],
  ['ch059_w005', '高行空', 'character', 409],
  ['ch059_w005', '武当', 'faction', 415],
  ['ch059_w005', '雁荡', 'location', 417],
  ['ch059_w005', '鹰眼老七', 'character', 419],
  ['ch059_w005', '管家婆', 'character', 419],
  ['ch059_w005', '花魁', 'character', 419],
  ['ch059_w005', '高涛', 'character', 421],
  ['ch059_w005', '钩子', 'character', 441],
  ['ch059_w005', '柳青青', 'character', 441],
  ['ch059_w005', '西门吹雪', 'character', 445],
  ['ch059_w005', '犬郎君', 'character', 451],
  ['ch059_w005', '石鹤', 'character', 469],
  ['ch059_w005', '少林', 'faction', 469],
  ['ch059_w005', '虎豹兄弟', 'character', 469],
  ['ch059_w005', '人皮面具', 'item', 493],
  ['ch059_w005', '牛皮胶', 'item', 493],

  // ===== ch059_w006 (501-620) - need remaining ch059 text =====
  // filled after reading more

  // ===== ch059_w007, ch059_w008 =====
];

// More specs will be appended below after reading remaining chapters
// For now continue with auto-discovery of remaining windows using seed names

const SEED_NAMES = [
  // characters (longer/more specific first via sort)
  ['陆小凤', 'character'],
  ['叶灵', 'character'],
  ['叶雪', 'character'],
  ['阿雪', 'character'],
  ['老刀把子', 'character'],
  ['柳青青', 'character'],
  ['表哥', 'character'],
  ['西门吹雪', 'character'],
  ['叶孤鸿', 'character'],
  ['叶凌风', 'character'],
  ['玉树剑客', 'character'],
  ['海奇阔', 'character'],
  ['管家婆', 'character'],
  ['独孤美', 'character'],
  ['犬郎君', 'character'],
  ['将军', 'character'],
  ['孙不变', 'character'],
  ['石鹤', 'character'],
  ['钟无骨', 'character'],
  ['梅真人', 'character'],
  ['木道人', 'character'],
  ['石雁', 'character'],
  ['石真人', 'character'],
  ['花四姑', 'character'],
  ['花魁', 'character'],
  ['金钱豹', 'character'],
  ['杜铁心', 'character'],
  ['辣手追魂', 'character'],
  ['辣手无情', 'character'],
  ['娄大圣', 'character'],
  ['娄老太太', 'character'],
  ['娄金氏', 'character'],
  ['于还', 'character'],
  ['飞鱼岛主', 'character'],
  ['勾魂使者', 'character'],
  ['朱菲', 'character'],
  ['司空斗', 'character'],
  ['大头鬼王', 'character'],
  ['吴先生', 'character'],
  ['苦瓜上人', 'character'],
  ['苦瓜和尚', 'character'],
  ['无龙罗汉', 'character'],
  ['无龙', 'character'],
  ['无豹', 'character'],
  ['高涛', 'character'],
  ['顾飞云', 'character'],
  ['小顾道人', 'character'],
  ['巴山小顾道人', 'character'],
  ['巴山小顾', 'character'],
  ['水上飞', 'character'],
  ['长江水上飞', 'character'],
  ['高行空', 'character'],
  ['雁荡高行空', 'character'],
  ['关天武', 'character'],
  ['百胜刀王', 'character'],
  ['鹰眼老七', 'character'],
  ['武当石雁', 'character'],
  ['少林铁肩', 'character'],
  ['铁肩', 'character'],
  ['丐帮王十袋', 'character'],
  ['王十袋', 'character'],
  ['白云城主', 'character'],
  ['叶孤城', 'character'],
  ['钩子', 'character'],
  ['石道人', 'character'],
  ['游魂', 'character'],
  ['花寡妇', 'character'],
  ['巴山顾道人', 'character'],
  ['圣手仙猿', 'character'],
  ['明觉禅师', 'character'],
  ['雪峰义存', 'character'],
  ['虎豹兄弟', 'character'],
  ['小叶', 'character'],
  ['无垢', 'character'],
  ['无镜', 'character'],
  ['无色', 'character'],
  ['神眼沈三娘', 'character'],
  ['沈三娘', 'character'],
  ['司空摘星', 'character'],
  ['花满楼', 'character'],
  ['彭长备', 'character'],
  ['彭总管', 'character'],
  ['宋长清', 'character'],
  ['长清', 'character'],
  ['小翠', 'character'],
  ['古松居士', 'character'],
  ['古松', 'character'],
  ['千面人', 'character'],
  ['黑心老杜', 'character'],
  // factions
  ['武当', 'faction'],
  ['武当派', 'faction'],
  ['少林', 'faction'],
  ['少林寺', 'faction'],
  ['丐帮', 'faction'],
  ['十二连环坞', 'faction'],
  ['江南花家', 'faction'],
  ['花家', 'faction'],
  ['黑道七十二寨', 'faction'],
  ['三十六寨', 'faction'],
  ['秦岭双猿', 'faction'],
  ['南海群剑', 'faction'],
  ['西方群鬼', 'faction'],
  ['五罗汉', 'faction'],
  ['五恶兽', 'faction'],
  ['凤尾帮', 'faction'],
  ['中原武林', 'faction'],
  ['长江水寨', 'faction'],
  // locations
  ['幽灵山庄', 'location'],
  ['通天阁', 'location'],
  ['通天崖', 'location'],
  ['将军府', 'location'],
  ['沼泽', 'location'],
  ['武当山', 'location'],
  ['武当后山', 'location'],
  ['解剑池', 'location'],
  ['解剑岩', 'location'],
  ['雪隐', 'location'],
  ['雪窦山', 'location'],
  ['灵隐寺', 'location'],
  ['藏经阁', 'location'],
  ['巴山', 'location'],
  ['长江', 'location'],
  ['雁荡', 'location'],
  ['听竹院', 'location'],
  ['听竹小院', 'location'],
  ['三六九', 'location'],
  ['奎元馆', 'location'],
  ['满翠楼', 'location'],
  ['鹰巢', 'location'],
  ['香积厨', 'location'],
  ['凌风山庄', 'location'],
  ['森罗殿', 'location'],
  // skills / techniques
  ['武当小天星掌力', 'skill'],
  ['小天星掌力', 'skill'],
  ['武当掌法', 'skill'],
  ['武当功夫', 'skill'],
  ['地趟刀法', 'skill'],
  ['满地开花八十一式', 'technique'],
  ['玄鸟划沙', 'technique'],
  ['平沙落雁', 'technique'],
  ['北雁南飞', 'technique'],
  ['天外飞仙', 'technique'],
  ['白骨爪', 'skill'],
  ['黑鬼爪', 'skill'],
  ['玄玑穴', 'technique'],
  ['五丁开山', 'technique'],
  // items
  ['如意鱼皮水靠', 'item'],
  ['分水飞鱼刺', 'item'],
  ['如意水靠', 'item'],
  ['飞鱼刺', 'item'],
  ['水靠', 'item'],
  ['鱼刺', 'item'],
  ['七星宝剑', 'item'],
  ['七星皮鞘', 'item'],
  ['七星剑', 'item'],
  ['紫金道冠', 'item'],
  ['紫金冠', 'item'],
  ['紫阳毡笠', 'item'],
  ['人皮面具', 'item'],
  ['牛皮胶', 'item'],
  ['波斯葡萄酒', 'item'],
  ['竹叶青', 'item'],
  ['品级袋', 'item'],
];

function buildFromSpecs(specs) {
  const out = [];
  const errors = [];
  const perWin = {};
  const seen = new Set(); // windowId|name|category
  for (const spec of specs) {
    const [windowId, name, category, preferredLine] = spec;
    const key = `${windowId}|${name}|${category}`;
    if (seen.has(key)) continue;
    const w = byId[windowId];
    if (!w) {
      errors.push('unknown window ' + windowId);
      continue;
    }
    const hit = findLine(w, name, preferredLine);
    if (!hit) {
      errors.push(`miss ${name} in ${windowId}`);
      continue;
    }
    seen.add(key);
    perWin[windowId] = (perWin[windowId] || 0) + 1;
    const seq = String(perWin[windowId]).padStart(4, '0');
    out.push({
      candidate_id: `cand_${windowId}_${seq}`,
      category_hint: category,
      name,
      chapter: w.chapter,
      source_ref: {
        line_start: hit.line,
        line_end: hit.line,
        text: hit.text
      },
      discovery_pass: 'named-inventory',
      window_id: windowId
    });
  }
  return { out, errors, perWin, seen };
}

function autoFillRemaining(existingSeen) {
  const out = [];
  const perWin = {};
  // count existing per window
  for (const key of existingSeen) {
    const windowId = key.split('|')[0];
    perWin[windowId] = (perWin[windowId] || 0) + 1;
  }
  const seen = new Set(existingSeen);
  for (const w of windows) {
    // longer names first to prefer specific
    const seeds = [...SEED_NAMES].sort((a, b) => b[0].length - a[0].length);
    for (const [name, category] of seeds) {
      const key = `${w.id}|${name}|${category}`;
      if (seen.has(key)) continue;
      // also skip if same name any category already? keep category-specific
      const hit = findLine(w, name, null);
      if (!hit) continue;
      seen.add(key);
      perWin[w.id] = (perWin[w.id] || 0) + 1;
      const seq = String(perWin[w.id]).padStart(4, '0');
      out.push({
        candidate_id: `cand_${w.id}_${seq}`,
        category_hint: category,
        name,
        chapter: w.chapter,
        source_ref: {
          line_start: hit.line,
          line_end: hit.line,
          text: hit.text
        },
        discovery_pass: 'named-inventory',
        window_id: w.id
      });
    }
  }
  return { out, perWin, seen };
}

function validate(cands) {
  const errors = [];
  for (const c of cands) {
    const w = byId[c.window_id];
    if (!w) {
      errors.push('bad window ' + c.candidate_id);
      continue;
    }
    if (!w.text.includes(c.source_ref.text)) {
      errors.push('text missing: ' + c.candidate_id + ' ' + c.name);
    }
    if (c.chapter !== w.chapter) errors.push('chapter: ' + c.candidate_id);
    if (c.source_ref.line_start < w.line_start || c.source_ref.line_end > w.line_end) {
      errors.push('range: ' + c.candidate_id);
    }
  }
  return errors;
}

function main() {
  const { out: manual, errors: miss, seen } = buildFromSpecs(specs);
  const { out: auto } = autoFillRemaining(seen);
  // merge: manual first order, then auto for missing windows/names
  // rebuild sequential ids per window cleanly
  const allRaw = [...manual, ...auto];
  const byWin = {};
  for (const c of allRaw) {
    byWin[c.window_id] = byWin[c.window_id] || [];
    // dedupe by name+category within window
    if (!byWin[c.window_id].some(x => x.name === c.name && x.category_hint === c.category_hint)) {
      byWin[c.window_id].push(c);
    }
  }
  const final = [];
  for (const w of windows) {
    const list = byWin[w.id] || [];
    list.forEach((c, i) => {
      final.push({
        ...c,
        candidate_id: `cand_${w.id}_${String(i + 1).padStart(4, '0')}`
      });
    });
  }
  const valErr = validate(final);
  const outJsonl = path.join(__dirname, 'named-inventory.ch057-066.jsonl');
  const outDone = path.join(__dirname, 'named-inventory.ch057-066.done.json');
  fs.writeFileSync(outJsonl, final.map(c => JSON.stringify(c)).join('\n') + (final.length ? '\n' : ''));
  const windowIds = windows.map(w => w.id);
  fs.writeFileSync(outDone, JSON.stringify({
    pass: 'named-inventory',
    window_ids: windowIds,
    chapters: [...new Set(windows.map(w => w.chapter))].sort((a, b) => a - b),
    candidate_count: final.length
  }, null, 2) + '\n');

  const covered = windowIds.filter(id => (byWin[id] || []).length >= 0);
  const empty = windowIds.filter(id => !(byWin[id] && byWin[id].length));
  console.log(JSON.stringify({
    windows: windowIds.length,
    candidates: final.length,
    empty_windows: empty,
    manual_misses: miss.slice(0, 30),
    manual_miss_count: miss.length,
    validate_errors: valErr.slice(0, 20),
    validate_error_count: valErr.length,
    per_window: Object.fromEntries(windowIds.map(id => [id, (byWin[id] || []).length]))
  }, null, 2));
}

main();
