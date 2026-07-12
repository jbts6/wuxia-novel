#!/usr/bin/env node
/**
 * Generate ch11 named.jsonl + event.jsonl from window files.
 * Quotes are taken verbatim from window raw text (strip "N|" prefix).
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const WIN_DIR = path.join(DIR, 'windows');
const CHAPTER = 11;

function loadWindow(windowId) {
  const p = path.join(WIN_DIR, `${windowId}.txt`);
  const lines = fs.readFileSync(p, 'utf8').split(/\n/);
  const map = new Map();
  const order = [];
  for (const L of lines) {
    const m = L.match(/^(\d+)\|(.*)$/);
    if (!m) continue;
    const n = +m[1];
    map.set(n, m[2]);
    order.push(n);
  }
  order.sort((a, b) => a - b);
  return { map, order, rawJoined: order.map((n) => map.get(n)).join('\n') };
}

function quote(win, start, end) {
  const parts = [];
  for (let i = start; i <= end; i++) {
    if (!win.map.has(i)) continue;
    parts.push(win.map.get(i));
  }
  if (!parts.length) throw new Error(`empty quote ${start}-${end}`);
  const text = parts.join('\n\n');
  // verify substring of raw (allowing that blank lines may collapse differently)
  // reconstruct continuous raw with blank lines as stored
  const raw = win.rawJoined;
  // Also try joined with single newlines of consecutive non-empty
  if (!raw.includes(parts.join('\n')) && !raw.includes(text) && !raw.includes(parts.filter(Boolean).join('\n'))) {
    // check each non-empty line is present
    for (const p of parts) {
      if (p && !raw.includes(p)) {
        throw new Error(`quote not in raw lines ${start}-${end}: ${p.slice(0, 40)}`);
      }
    }
  }
  // Prefer exact multi-paragraph join as in pilot: non-empty paragraphs separated by \n\n
  // Pilot uses \n\n between original paragraphs. Our map already has empty lines as "".
  // Build like original file content without prefixes: keep empty lines as blank paragraphs.
  const ordered = [];
  for (let i = start; i <= end; i++) {
    if (!win.map.has(i)) continue;
    ordered.push(win.map.get(i));
  }
  // Join consecutive lines with \n; empty string becomes blank line so overall \n\n between paras
  const exact = ordered.join('\n');
  if (!raw.includes(exact) && !raw.includes(ordered.filter((x) => x !== undefined).join('\n'))) {
    // still OK if each line present
  }
  return exact;
}

function src(win, start, end) {
  return { line_start: start, line_end: end, text: quote(win, start, end) };
}

function makeNamed(id, cat, name, chapter, windowId, win, start, end) {
  return {
    candidate_id: id,
    category_hint: cat,
    name,
    chapter,
    source_ref: src(win, start, end),
    discovery_pass: 'named-inventory',
    window_id: windowId,
  };
}

function makeEvent(id, name, chapter, windowId, win, start, end, level) {
  return {
    candidate_id: id,
    category_hint: 'event',
    name,
    chapter,
    source_ref: src(win, start, end),
    discovery_pass: 'event-dialogue',
    window_id: windowId,
    event_level_hint: level,
  };
}

function makeDialogue(id, name, chapter, windowId, win, start, end, speaker, selType, reason, traitTags, cStart, cEnd) {
  const o = {
    candidate_id: id,
    category_hint: 'dialogue',
    name,
    chapter,
    source_ref: src(win, start, end),
    discovery_pass: 'event-dialogue',
    window_id: windowId,
    speaker_name: speaker,
    selection_type_hint: selType,
    selection_reason: reason,
    context_source_ref: src(win, cStart, cEnd),
  };
  if (traitTags && traitTags.length) o.trait_tags = traitTags;
  return o;
}

function makeSummary(id, chapter, windowId, win, start, end, title, summary, key_events) {
  return {
    candidate_id: id,
    category_hint: 'chapter_summary',
    name: title,
    chapter,
    source_ref: src(win, start, end),
    discovery_pass: 'event-dialogue',
    window_id: windowId,
    title,
    summary,
    key_events,
  };
}

function pad(n) {
  return String(n).padStart(4, '0');
}

function main() {
  const w1 = loadWindow('ch011_w001');
  const w2 = loadWindow('ch011_w002');
  const w3 = loadWindow('ch011_w003');
  const w4 = loadWindow('ch011_w004');
  const named = [];
  const events = [];

  // ========== W001 named ==========
  let n = 1;
  const N = (cat, name, s, e) => {
    named.push(makeNamed(`cand_ch011_w001_${pad(n++)}`, cat, name, CHAPTER, 'ch011_w001', w1, s, e));
  };
  N('character', '段誉', 3, 3);
  N('character', '鸠摩智', 3, 3);
  N('character', '木婉清', 13, 13);
  N('character', '慕容先生', 21, 21);
  N('character', '保定帝', 23, 23);
  N('character', '南海鳄神', 23, 23);
  N('character', '星宿老怪', 33, 33);
  N('character', '慕容博', 53, 53);
  N('character', '崔百泉', 61, 61);
  N('character', '过彦之', 61, 61);
  N('character', '柯百岁', 61, 61);
  N('character', '阿碧', 93, 93);
  N('character', '慕容公子', 91, 91);
  N('faction', '四大恶人', 23, 23);
  N('faction', '大理段氏', 39, 39);
  N('faction', '慕容氏', 61, 61);
  N('location', '大理国', 15, 15);
  N('location', '天龙寺', 23, 23);
  N('location', '苏州', 53, 53);
  N('location', '参合庄', 57, 57);
  N('location', '燕子坞', 59, 59);
  N('location', '吐蕃国', 91, 91);
  N('location', '琴韵小筑', 95, 95);
  N('location', '河南', 59, 59);
  N('skill', '少泽剑剑法', 11, 11);
  N('skill', '凌波微步', 17, 17);
  N('skill', '六脉神剑剑法', 21, 21);
  N('skill', '六脉神剑经', 21, 21);
  N('skill', '化功大法', 33, 33);
  N('skill', '一阳指', 39, 39);
  N('skill', '六脉神剑', 39, 39);
  N('technique', '火焰刀', 39, 39);
  N('item', '六脉神剑经', 21, 21);
  N('item', '六脉神剑剑谱', 25, 25);
  N('item', '金算盘', 71, 71);
  N('item', '软鞭', 71, 71);
  // also 《金刚经》 as item? skip
  N('location', '太湖', 113, 113);
  N('location', '洛水', 113, 113);

  // W001 events/dialogues
  let e = 100;
  const E = (name, s, e2, level) => {
    events.push(makeEvent(`cand_ch011_w001_${pad(e++)}`, name, CHAPTER, 'ch011_w001', w1, s, e2, level));
  };
  const D = (name, s, e2, speaker, sel, reason, tags, cs, ce) => {
    events.push(makeDialogue(`cand_ch011_w001_${pad(e++)}`, name, CHAPTER, 'ch011_w001', w1, s, e2, speaker, sel, reason, tags, cs, ce));
  };
  E('鸠摩智擒段誉北行', 3, 15, 'main');
  E('客店逼写六脉神剑经', 19, 29, 'main');
  E('鸠摩智运劲反遭内力倒吸', 31, 33, 'main');
  E('鸠摩智火焰刀威逼段誉', 39, 45, 'main');
  E('至苏州寻参合庄不得', 53, 59, 'main');
  E('遇崔百泉过彦之夺兵刃', 61, 79, 'main');
  E('阿碧划舟邀往燕子坞', 81, 109, 'main');

  D('段誉：办不到', 21, 21, '段誉', 'event', '识破鸠摩智逼取六脉神剑意图并当场拒绝', null, 19, 21);
  D('鸠摩智：公子可知小僧此举', 19, 21, '鸠摩智', 'event', '客店开场逼问用意，揭开取经宿愿', null, 19, 21);
  D('段誉：我不写此经你终不死心', 29, 29, '段誉', 'both', '点破写经即死，显其冷静决绝', ['冷静', '决绝', '机敏'], 27, 29);
  D('鸠摩智：你这化功大法到底是谁教你的', 37, 37, '鸠摩智', 'event', '运劲失败后厉声追问，推动对段氏武学的觊觎', null, 35, 39);
  D('段誉：化功大法暴殄天物', 37, 37, '段誉', 'persona', '引述玉洞帛轴讥讽化功大法', ['机敏', '诙谐'], 35, 39);
  D('段誉：我拚命记错越记越错', 47, 47, '段誉', 'both', '以佛经戏谑抗逼，显书生机锋与不屈', ['机敏', '诙谐', '不屈'], 45, 49);
  D('鸠摩智：死到临头亏你还有这等闲情', 55, 55, '鸠摩智', 'persona', '冷嘲段誉吟诗，显其阴狠压迫', ['阴狠', '嘲讽'], 53, 55);
  D('段誉：伯父和大理的五位高手', 69, 69, '段誉', 'event', '故意夸大鸠摩智战绩劝崔过二人勿妄救', null, 67, 71);
  D('崔百泉：老虎头上拍苍蝇', 75, 75, '崔百泉', 'both', '明知不敌仍出手，显义气与莽撞', ['义气', '莽撞'], 71, 77);
  D('阿碧：叫做阿碧', 93, 93, '阿碧', 'persona', '自报身份时吴语软甜，温雅可亲', ['温雅', '软语', '可亲'], 91, 95);

  // ========== W002 named ==========
  n = 1;
  const N2 = (cat, name, s, e2) => {
    named.push(makeNamed(`cand_ch011_w002_${pad(n++)}`, cat, name, CHAPTER, 'ch011_w002', w2, s, e2));
  };
  N2('character', '段誉', 101, 101);
  N2('character', '阿碧', 101, 101);
  N2('character', '崔百泉', 103, 103);
  N2('character', '过彦之', 107, 107);
  N2('character', '鸠摩智', 103, 103);
  N2('character', '阿朱', 139, 139);
  N2('character', '老黄伯伯', 177, 177);
  N2('character', '孙三', 183, 183);
  N2('character', '柯百岁', 157, 157);
  N2('character', '慕容博', 149, 149);
  N2('character', '慕容老太太', 205, 205);
  N2('character', '木婉清', 187, 187);
  N2('faction', '慕容氏', 111, 111);
  N2('faction', '伏牛派', 157, 157);
  N2('location', '太湖', 113, 113);
  N2('location', '河南洛水', 113, 113);
  N2('location', '燕子坞', 119, 119);
  N2('location', '琴韵', 139, 139);
  N2('location', '琴韵小筑', 139, 139); // "琴韵"匾额; also referenced later
  N2('location', '参合庄', 139, 139);
  N2('location', '听香水榭', 153, 153);
  N2('location', '吐蕃国', 141, 141);
  N2('location', '大宋', 141, 141);
  N2('location', '大理', 141, 141);
  N2('location', '辽国', 141, 141);
  N2('location', '西夏', 141, 141);
  N2('location', '中州', 193, 193);
  N2('item', '金算盘', 103, 103);
  N2('item', '软鞭', 105, 105);
  N2('item', '玫瑰绿豆糕', 147, 147);
  N2('item', '茯苓软糕', 147, 147);
  N2('item', '翡翠甜饼', 147, 147);
  N2('item', '藕粉火腿饺', 147, 147);
  N2('item', '吓煞人香', 145, 145);
  // skill/technique none new major in w2 except soft whip as weapon already item

  // W002 events
  e = 100;
  const E2 = (name, s, e2, level) => {
    events.push(makeEvent(`cand_ch011_w002_${pad(e++)}`, name, CHAPTER, 'ch011_w002', w2, s, e2, level));
  };
  const D2 = (name, s, e2, speaker, sel, reason, tags, cs, ce) => {
    events.push(makeDialogue(`cand_ch011_w002_${pad(e++)}`, name, CHAPTER, 'ch011_w002', w2, s, e2, speaker, sel, reason, tags, cs, ce));
  };
  E2('阿碧以算盘软鞭弹曲引舟入湖', 101, 121, 'branch');
  E2('众人抵琴韵小筑候阿朱', 137, 143, 'main');
  E2('过彦之扬言报仇打碎茶几', 157, 157, 'main');
  E2('老仆黄伯推诿祭墓', 161, 175, 'main');
  E2('段誉闻香疑孙三女扮', 183, 197, 'main');
  E2('孙三请出慕容老太太', 205, 209, 'main');
  E2('鸠摩智长揖砖地发劲如磕头', 211, 217, 'detail');

  D2('过彦之：今日跟师父报仇来啦', 157, 157, '过彦之', 'event', '在琴韵小筑公开报仇来意并毁家具', null, 153, 159);
  D2('崔百泉：我师兄柯百岁到底是谁害死的', 163, 163, '崔百泉', 'event', '追问柯百岁死因，推进报仇线', null, 161, 165);
  D2('老黄：年纪活到一百岁早就该死啦', 165, 165, '老黄伯伯', 'persona', '装糊涂嘲弄柯百岁之名', ['狡黠', '装糊涂'], 161, 167);
  D2('孙三：和尚尼姑更加靠不住', 195, 195, '孙三', 'both', '假管家口吻挡驾祭墓，显戏弄与伶俐', ['伶俐', '戏弄'], 193, 199);
  D2('孙三：嗅鮝啊嗅鮝', 203, 203, '孙三', 'persona', '吴语谐音回拒掘墓之疑', ['诙谐', '伶俐'], 203, 203);
  D2('鸠摩智：吐蕃国鸠摩智向老夫人请安', 205, 205, '鸠摩智', 'event', '改请老太太定夺，显其隐忍推进祭墓', null, 205, 205);
  D2('阿碧：快磕头啊', 211, 211, '阿碧', 'persona', '怂恿鸠摩智磕头，配合阿朱作弄', ['顽皮', '软语'], 209, 213);
  D2('老夫人：磕头磕得响', 217, 217, '慕容老太太', 'persona', '揭穿假磕头仍夸乖，戏弄高手', ['狡黠', '戏弄'], 213, 219);

  // ========== W003 named ==========
  n = 1;
  const N3 = (cat, name, s, e2) => {
    named.push(makeNamed(`cand_ch011_w003_${pad(n++)}`, cat, name, CHAPTER, 'ch011_w003', w3, s, e2));
  };
  N3('character', '段誉', 201, 201);
  N3('character', '鸠摩智', 203, 203);
  N3('character', '孙三', 203, 203);
  N3('character', '阿碧', 211, 211);
  N3('character', '阿朱', 223, 223);
  N3('character', '崔百泉', 215, 215);
  N3('character', '过彦之', 215, 215);
  N3('character', '慕容先生', 237, 237);
  N3('character', '慕容公子', 245, 245);
  N3('character', '枯荣大师', 249, 249);
  N3('faction', '大理段氏', 263, 263);
  N3('faction', '姑苏慕容', 263, 263);
  N3('location', '还施水阁', 239, 239);
  N3('location', '吐蕃国', 237, 237);
  N3('location', '大理天龙寺', 249, 249);
  N3('location', '天龙寺', 271, 271);
  N3('location', '琴韵小筑', 301, 301);
  N3('location', '锦瑟居', 303, 303);
  N3('location', '苏州', 265, 265);
  N3('skill', '六脉神剑', 237, 237);
  N3('skill', '六脉神剑剑谱', 237, 237);
  N3('skill', '火焰刀', 259, 259);
  N3('skill', '中冲剑法', 287, 287);
  N3('technique', '少泽剑', 287, 287);
  N3('technique', '火焰刀', 259, 259);
  N3('skill', '以彼之道还施彼身', 269, 269);
  N3('location', '藏书阁', 269, 269); // mentioned as 藏书阁
  // 中冲穴 as not entity

  // W003 events
  e = 100;
  const E3 = (name, s, e2, level) => {
    events.push(makeEvent(`cand_ch011_w003_${pad(e++)}`, name, CHAPTER, 'ch011_w003', w3, s, e2, level));
  };
  const D3 = (name, s, e2, speaker, sel, reason, tags, cs, ce) => {
    events.push(makeDialogue(`cand_ch011_w003_${pad(e++)}`, name, CHAPTER, 'ch011_w003', w3, s, e2, speaker, sel, reason, tags, cs, ce));
  };
  E3('段誉闻香识破阿朱乔装', 223, 225, 'main');
  E3('段誉向阿朱假扮老夫人磕三响头', 231, 233, 'branch');
  E3('鸠摩智求入还施水阁观书', 237, 249, 'main');
  E3('鸠摩智解穴逼段誉试六脉神剑', 253, 261, 'main');
  E3('鸠摩智火焰刀逼段誉出手', 273, 279, 'main');
  E3('鸠摩智劈阿碧逼段誉使剑', 281, 289, 'main');
  E3('段誉中冲少泽剑接火焰刀', 287, 293, 'main');
  E3('鸠摩智再点段誉穴道', 297, 299, 'main');
  E3('阿朱约明晨送去扫墓并转锦瑟居', 301, 305, 'main');

  D3('段誉：我有一个侄女儿最是聪明伶俐', 221, 221, '段誉', 'both', '以侄女儿扮猴暗讽阿朱乔装', ['机敏', '诙谐'], 221, 225);
  D3('阿朱：乖孩子别多口', 225, 225, '阿朱', 'both', '暗示勿揭穿底细仍装老太太', ['狡黠', '机变'], 223, 227);
  D3('段誉：对美人儿磕几个头心甘情愿', 231, 231, '段誉', 'persona', '以风流书生姿态向假老夫人磕头', ['风流', '随和', '重色'], 229, 233);
  D3('鸠摩智：要取得大理段氏六脉神剑的剑谱', 237, 237, '鸠摩智', 'event', '首次向慕容府说明取谱践约来意', null, 235, 239);
  D3('鸠摩智：就让小僧在尊府还施水阁看几天书', 239, 239, '鸠摩智', 'event', '提出以剑谱换还施水阁观书', null, 237, 241);
  D3('鸠摩智：要将段公子在慕容先生墓前烧化了', 249, 249, '鸠摩智', 'event', '扬言焚化段誉践约，震惊众人', null, 249, 251);
  D3('段誉：咱们从此一刀两断', 265, 265, '段誉', 'persona', '因江南美景与阿朱阿碧消怨气，书生气十足', ['随和', '风流', '书生'], 263, 267);
  D3('段誉：以彼之道还施彼身', 269, 269, '段誉', 'event', '当众点破鸠摩智觊觎慕容绝学', null, 269, 271);
  D3('段誉：贪嗔痴爱欲大和尚一应俱全', 279, 279, '段誉', 'both', '生死边缘嘲讽伪圣僧', ['刚烈', '机敏', '不屈'], 275, 281);
  D3('段誉：你们是我朋友啊', 295, 295, '段誉', 'persona', '危急时劝阿朱阿碧逃走，重情义', ['重义', '护弱'], 293, 297);
  D3('鸠摩智：居然尚来怜香惜玉', 299, 299, '鸠摩智', 'persona', '再点穴后嘲讽段誉护花', ['阴狠', '嘲讽'], 297, 301);
  D3('段誉：难为你扮老太太扮得这么像', 307, 307, '段誉', 'persona', '锦瑟居当面揭开阿朱乔装并赞其美', ['风流', '率直'], 305, 309);

  // ========== W004 named ==========
  n = 1;
  const N4 = (cat, name, s, e2) => {
    named.push(makeNamed(`cand_ch011_w004_${pad(n++)}`, cat, name, CHAPTER, 'ch011_w004', w4, s, e2));
  };
  N4('character', '阿朱', 301, 301);
  N4('character', '阿碧', 301, 301);
  N4('character', '鸠摩智', 303, 303);
  N4('character', '段誉', 303, 303);
  N4('character', '崔百泉', 303, 303);
  N4('character', '过彦之', 303, 303);
  N4('character', '慕容公子', 341, 341);
  N4('character', '玄悲大师', 351, 351);
  N4('character', '木婉清', 369, 369);
  N4('location', '琴韵小筑', 301, 301);
  N4('location', '锦瑟居', 303, 303);
  N4('location', '太湖', 335, 335);
  N4('location', '百曲湖', 349, 349);
  N4('location', '王家舅太太府上', 359, 359);
  N4('location', '无量山', 369, 369);
  N4('location', '天龙寺', 369, 369);
  N4('item', '古瑟', 321, 321);
  N4('item', '锦瑟', 323, 323);
  N4('skill', '六脉神剑', 301, 301); // referenced earlier in chapter context - only if in window: 301 text has 扫墓 not skill
  // remove invalid if not in text - check 301: no 六脉. skip skill if not present.
  // actually line 301 doesn't have 六脉神剑. Remove that last skill.
  named.pop();

  // W004 events
  e = 100;
  const E4 = (name, s, e2, level) => {
    events.push(makeEvent(`cand_ch011_w004_${pad(e++)}`, name, CHAPTER, 'ch011_w004', w4, s, e2, level));
  };
  const D4 = (name, s, e2, speaker, sel, reason, tags, cs, ce) => {
    events.push(makeDialogue(`cand_ch011_w004_${pad(e++)}`, name, CHAPTER, 'ch011_w004', w4, s, e2, speaker, sel, reason, tags, cs, ce));
  };
  E4('转往锦瑟居夜宴', 301, 315, 'branch');
  E4('锦瑟翻板机关落水脱身', 321, 329, 'main');
  E4('阿朱阿碧荷塘甩掉鸠摩智', 331, 349, 'main');
  E4('段誉荷叶塞耳破鸠摩智摄心', 341, 347, 'main');
  E4('三人湖中兜圈待耗鸠摩智', 349, 351, 'main');
  E4('划往王家舅太太府上岸', 359, 365, 'detail');

  D4('段誉：两个儿的相貌全然不同', 307, 307, '段誉', 'persona', '并赞阿朱阿碧各有其美，书生风流', ['风流', '善赞', '率直'], 305, 309);
  D4('阿碧：只要公子勿怕难听自当献丑', 321, 321, '阿碧', 'persona', '温雅应允鼓瑟，显其柔顺可亲', ['温雅', '可亲'], 319, 323);
  D4('阿朱：恶和尚追来啦', 333, 333, '阿朱', 'event', '发现鸠摩智驾船追击', null, 331, 335);
  D4('阿碧：这个大师父实头聪明', 335, 335, '阿碧', 'persona', '吴语叹鸠摩智学划船之快', ['机敏', '软语'], 333, 337);
  D4('段誉：他是骗人的说的话怎可相信', 341, 341, '段誉', 'both', '破鸠摩智摄心邪音，护住二女', ['机敏', '护弱', '沉着'], 339, 345);
  D4('阿碧：这和尚会使勾魂法儿', 345, 345, '阿碧', 'event', '醒悟险些中摄心术', null, 343, 347);
  D4('阿朱：就在这湖里跟这坏和尚大兜圈子', 349, 349, '阿朱', 'event', '定下荷塘耗敌策略', null, 347, 351);
  D4('段誉：作十日遨游就是做神仙也没这般快活', 349, 349, '段誉', 'persona', '湖中与二女为伴仍陶然，显其风流随和', ['风流', '随和', '乐观'], 347, 351);

  // chapter_summary on last window
  events.push(
    makeSummary(
      `cand_ch011_w004_${pad(e++)}`,
      CHAPTER,
      'ch011_w004',
      w4,
      301,
      369,
      '第十一回 向来痴',
      '鸠摩智点穴掳走段誉，北行东进，客店中逼写六脉神剑经；运劲反遭段誉体内异力倒吸，遂以火焰刀威逼。至苏州寻参合庄不着，遇为柯百岁报仇的崔百泉、过彦之，夺其软鞭金算盘后同往燕子坞。慕容府侍婢阿碧划舟相迎，引入太湖琴韵小筑；阿朱连番乔装老仆、管家、老太太戏弄鸠摩智，拒其祭墓与入还施水阁。鸠摩智解穴逼试六脉神剑，并以火焰刀攻阿碧迫段誉出手，段誉中冲、少泽剑勉强相接后再被点穴。夜宴锦瑟居时，阿朱阿碧以翻板机关使众人落水，救走段誉；鸠摩智追船并以摄心之声诱返，段誉以荷叶塞耳破之。三人钻入百曲湖荷塘与之周旋，天明拟往王家舅太太府上岸。',
      [
        '鸠摩智掳段誉逼取六脉神剑',
        '苏州遇崔百泉过彦之同赴燕子坞',
        '阿朱阿碧乔装戏弄鸠摩智拒入还施水阁',
        '鸠摩智逼段誉使出六脉神剑',
        '锦瑟居翻板脱身入太湖百曲湖',
      ]
    )
  );

  // Validate all source_ref texts
  const wins = {
    ch011_w001: w1,
    ch011_w002: w2,
    ch011_w003: w3,
    ch011_w004: w4,
  };
  const errors = [];
  function validate(c) {
    const w = wins[c.window_id];
    if (!w) {
      errors.push(`${c.candidate_id}: bad window`);
      return;
    }
    const refs = [c.source_ref];
    if (c.context_source_ref) refs.push(c.context_source_ref);
    for (const r of refs) {
      if (!r || !r.text) {
        errors.push(`${c.candidate_id}: empty ref`);
        continue;
      }
      // Each non-empty line of quote must appear in raw
      for (const line of r.text.split('\n')) {
        if (!line) continue;
        if (!w.rawJoined.includes(line)) {
          errors.push(`${c.candidate_id}: missing line in ${c.window_id}: ${line.slice(0, 60)}`);
        }
      }
    }
  }
  for (const c of named) validate(c);
  for (const c of events) validate(c);

  const namedPath = path.join(DIR, 'named.jsonl');
  const eventPath = path.join(DIR, 'event.jsonl');
  fs.writeFileSync(namedPath, named.map((x) => JSON.stringify(x)).join('\n') + '\n');
  fs.writeFileSync(eventPath, events.map((x) => JSON.stringify(x)).join('\n') + '\n');

  const status = {
    chapter: 11,
    windows: ['ch011_w001', 'ch011_w002', 'ch011_w003', 'ch011_w004'],
    named_count: named.length,
    event_count: events.length,
    ok: errors.length === 0,
    errors,
  };
  fs.writeFileSync(path.join(DIR, 'STATUS.json'), JSON.stringify(status, null, 2) + '\n');
  console.log(JSON.stringify(status, null, 2));
}

main();
