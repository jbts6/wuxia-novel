import fs from 'fs';
import path from 'path';

const dir = '/Users/jbts6/Site/wuxia-novel/.trellis/tasks/07-12-tlb-kb-rebuild-compare/scripts/_batch_drafts/ch08';
const winDir = path.join(dir, 'windows');
const windows = ['ch008_w001', 'ch008_w002', 'ch008_w003', 'ch008_w004'];

function loadWindow(id) {
  const raw = fs.readFileSync(path.join(winDir, `${id}.txt`), 'utf8');
  const map = new Map();
  const parts = [];
  for (const line of raw.split(/\n/)) {
    const i = line.indexOf('|');
    if (i === -1) {
      parts.push(line);
      continue;
    }
    const n = Number(line.slice(0, i));
    const t = line.slice(i + 1);
    if (!Number.isNaN(n)) map.set(n, t);
    parts.push(t);
  }
  return { id, map, text: parts.join('\n') };
}

const W = Object.fromEntries(windows.map((id) => [id, loadWindow(id)]));

function ref(winId, start, end) {
  const w = W[winId];
  const lines = [];
  for (let n = start; n <= end; n++) {
    if (w.map.has(n)) lines.push(w.map.get(n));
  }
  if (!lines.length) throw new Error(`no lines ${winId} ${start}-${end}`);
  const text = lines.join('\n\n');
  // prefer exact contiguous join with blank lines as in source? Better: reconstruct from full text substring search of first line
  // Use joined non-empty paragraphs with \n\n only if source has blank lines between.
  // Safer approach: find first line text in full raw and take a span including last line.
  const first = w.map.get(start);
  const last = w.map.get(end);
  if (!first || !last) throw new Error(`missing ${winId} ${start}/${end}`);
  const a = w.text.indexOf(first);
  if (a < 0) throw new Error(`first not found ${winId} ${start}: ${first.slice(0,40)}`);
  let b = w.text.indexOf(last, a);
  if (b < 0) throw new Error(`last not found ${winId} ${end}`);
  b += last.length;
  const text2 = w.text.slice(a, b);
  if (!w.text.includes(text2)) throw new Error('substring fail');
  return { line_start: start, line_end: end, text: text2 };
}

function oneLine(winId, n) {
  return ref(winId, n, n);
}

const named = [];
const event = [];
let seq = {};
function nid(win, i) {
  return `cand_${win}_${String(i).padStart(4, '0')}`;
}
function pushNamed(win, i, category_hint, name, start, end) {
  named.push({
    candidate_id: nid(win, i),
    category_hint,
    name,
    chapter: 8,
    source_ref: ref(win, start, end),
    discovery_pass: 'named-inventory',
    window_id: win,
  });
}
function pushEvent(win, i, name, start, end, level = 'main') {
  event.push({
    candidate_id: nid(win, i),
    category_hint: 'event',
    name,
    chapter: 8,
    source_ref: ref(win, start, end),
    discovery_pass: 'event-dialogue',
    window_id: win,
    event_level_hint: level,
  });
}
function pushDialogue(win, i, name, speaker, start, end, ctxStart, ctxEnd, sel, reason, traits) {
  const o = {
    candidate_id: nid(win, i),
    category_hint: 'dialogue',
    name,
    chapter: 8,
    source_ref: ref(win, start, end),
    discovery_pass: 'event-dialogue',
    window_id: win,
    speaker_name: speaker,
    selection_type_hint: sel,
    selection_reason: reason,
    context_source_ref: ref(win, ctxStart, ctxEnd),
  };
  if (sel === 'persona' || sel === 'both') o.trait_tags = traits || [];
  event.push(o);
}

// ========== ch008_w001 named ==========
const w1 = 'ch008_w001';
let i = 1;
pushNamed(w1, i++, 'character', '高升泰', 3, 3);
pushNamed(w1, i++, 'character', '钟万仇', 3, 3);
pushNamed(w1, i++, 'character', '秦红棉', 3, 3);
pushNamed(w1, i++, 'character', '刀白凤', 3, 3);
pushNamed(w1, i++, 'character', '保定帝段正明', 3, 3);
pushNamed(w1, i++, 'character', '段正淳', 5, 5);
pushNamed(w1, i++, 'location', '万劫谷', 3, 3);
pushNamed(w1, i++, 'location', '镇南王府', 3, 3);
pushNamed(w1, i++, 'location', '大理', 7, 7);
pushNamed(w1, i++, 'faction', '摆夷族', 7, 7);
pushNamed(w1, i++, 'character', '巴天石', 11, 11);
pushNamed(w1, i++, 'location', '善人渡', 9, 9);
pushNamed(w1, i++, 'location', '铁索桥', 9, 9);
pushNamed(w1, i++, 'character', '褚万里', 17, 17);
pushNamed(w1, i++, 'character', '古笃诚', 17, 17);
pushNamed(w1, i++, 'character', '傅思归', 17, 17);
pushNamed(w1, i++, 'character', '朱丹臣', 17, 17);
pushNamed(w1, i++, 'character', '云中鹤', 31, 31);
pushNamed(w1, i++, 'item', '修罗刀', 41, 41);
pushNamed(w1, i++, 'technique', '十字斫', 43, 43);
pushNamed(w1, i++, 'character', '叶二娘', 67, 67);
pushNamed(w1, i++, 'skill', '七十二路乱披风斧法', 69, 69);
pushNamed(w1, i++, 'character', '南海鳄神', 73, 73);
pushNamed(w1, i++, 'item', '鳄嘴剪', 73, 73);
pushNamed(w1, i++, 'item', '鳄尾鞭', 77, 77);
pushNamed(w1, i++, 'character', '钟灵', 85, 85);
pushNamed(w1, i++, 'character', '段誉', 89, 89);
pushNamed(w1, i++, 'character', '木婉清', 89, 89);
pushNamed(w1, i++, 'character', '恶贯满盈', 89, 89);
pushNamed(w1, i++, 'item', '阴阳和合散', 91, 91);
pushNamed(w1, i++, 'faction', '南海派', 95, 95);
pushNamed(w1, i++, 'skill', '一阳指', 119, 119);
pushNamed(w1, i++, 'location', '缺盆穴', 117, 117);
pushNamed(w1, i++, 'location', '天池穴', 117, 117);
// also 甘宝宝 mentioned later? not in w1
// 叶二娘 thin knife already character
// 褚古傅朱四大护卫 covered

// events/dialogues w1
let e = 100;
pushEvent(w1, e++, '巴天石探得万劫谷入口', 9, 13, 'main');
pushEvent(w1, e++, '段氏众人进谷拜山', 23, 29, 'main');
pushEvent(w1, e++, '巴天石与云中鹤轻功追逐', 31, 31, 'main');
pushEvent(w1, e++, '刀白凤秦红棉交手段正淳两难', 41, 47, 'main');
pushEvent(w1, e++, '段正淳斩箭救刀白凤', 51, 53, 'main');
pushEvent(w1, e++, '二女联手攻段正淳', 63, 63, 'branch');
pushEvent(w1, e++, '古笃诚朱丹臣战叶二娘', 67, 69, 'branch');
pushEvent(w1, e++, '南海鳄神出手与护卫交锋', 73, 77, 'branch');
pushEvent(w1, e++, '保定帝遇钟灵寻段誉', 83, 87, 'main');
pushEvent(w1, e++, '青袍客逼段誉木婉清成亲后离去', 89, 93, 'main');
pushEvent(w1, e++, '段誉呼南海鳄神愿拜师求救', 95, 95, 'branch');
pushEvent(w1, e++, '钟灵潜入石屋外欲救段誉', 99, 101, 'main');
pushEvent(w1, e++, '钟灵引保定帝至石屋前', 107, 113, 'main');
pushEvent(w1, e++, '保定帝与青袍客点穴对峙一阳指相碰', 115, 119, 'main');

pushDialogue(w1, e++, '保定帝：让他多经历一些艰难', '保定帝', 3, 3, 3, 3, 'persona', '对段誉被掳持磨练观，显慈和而冷峻的教子态度', ['慈和', '冷静']);
pushDialogue(w1, e++, '秦红棉：已将他开膛破肚喂了狗', '秦红棉', 41, 41, 39, 43, 'both', '以惨酷假话激怒刀白凤，旧恨新怒引爆冲突', ['狠毒', '善妒']);
pushDialogue(w1, e++, '刀白凤：谁来跟下贱女人说话', '刀白凤', 43, 43, 41, 43, 'persona', '对情敌极尽轻蔑，妒恨与母性护子并存', ['刚烈', '善妒']);
pushDialogue(w1, e++, '段正淳：凤凰儿别这么狠', '段正淳', 55, 55, 53, 55, 'both', '救妻又护旧情，两难处境鲜明', ['风流', '护短']);
pushDialogue(w1, e++, '傅思归：是你师父的爹爹来啦', '傅思归', 75, 75, 73, 75, 'event', '点破南海鳄神曾拜段誉为师的尴尬关系', null);
pushDialogue(w1, e++, '段誉：落在天下第一恶人手中', '段誉', 89, 89, 89, 91, 'event', '得知青袍客即恶贯满盈，危机定性', null);
pushDialogue(w1, e++, '段誉：愿意做南海派的传人', '段誉', 95, 95, 95, 95, 'persona', '危急时愿拜恶人为师以保门风，显权变与重名节', ['权变', '重名节']);
pushDialogue(w1, e++, '段誉：服了阴阳和合散', '段誉', 101, 101, 99, 101, 'event', '向钟灵道出春药之名，推动偷解药情节', null);

// ========== ch008_w002 ==========
const w2 = 'ch008_w002';
i = 1;
pushNamed(w2, i++, 'character', '延庆太子', 195, 195);
pushNamed(w2, i++, 'character', '上德帝段廉义', 205, 205);
pushNamed(w2, i++, 'character', '杨义贞', 205, 205);
pushNamed(w2, i++, 'character', '段寿辉', 205, 205);
pushNamed(w2, i++, 'character', '上明帝', 205, 205);
pushNamed(w2, i++, 'character', '高智升', 205, 205);
pushNamed(w2, i++, 'faction', '天龙寺', 195, 195);
pushNamed(w2, i++, 'faction', '神策军', 143, 143);
pushNamed(w2, i++, 'faction', '御林军', 143, 143);
pushNamed(w2, i++, 'faction', '天下四大恶人', 203, 203);
pushNamed(w2, i++, 'skill', '凌波微步', 127, 127);
pushNamed(w2, i++, 'location', '七突穴', 133, 133);
pushNamed(w2, i++, 'character', '甘宝宝', 167, 167);
pushNamed(w2, i++, 'location', '大理皇宫', 189, 189);
// 一阳指 already but keep in this window too as named skill appearance
pushNamed(w2, i++, 'skill', '一阳指', 119, 119);
pushNamed(w2, i++, 'item', '阴阳和合散', 131, 131);
pushNamed(w2, i++, 'character', '恶贯满盈', 209, 209);
pushNamed(w2, i++, 'location', '天龙寺', 195, 195); // faction already; skip duplicate location - wait I used faction. location also ok but avoid same name twice? different category ok? better not. Remove.
// fix: last was location duplicate - already faction. Change to something else.
named.pop();
pushNamed(w2, i++, 'location', '皇太弟', 219, 219); // not location - wrong
named.pop();
// 翰林学士 mentioned later. Use 豹皮大椅 item? skip.
pushNamed(w2, i++, 'item', '铁笛', 173, 173);

e = 100;
pushEvent(w2, e++, '保定帝与青袍客一阳指五指对试', 137, 141, 'main');
pushEvent(w2, e++, '青袍客自报身分延庆太子', 135, 141, 'main');
pushEvent(w2, e++, '段誉凌波微步避木婉清药发', 127, 129, 'main');
pushEvent(w2, e++, '青袍客逼保定帝让位出家', 145, 147, 'main');
pushEvent(w2, e++, '保定帝暂退并召回众人', 159, 163, 'main');
pushEvent(w2, e++, '巴天石一掌震退云中鹤', 165, 165, 'branch');
pushEvent(w2, e++, '高升泰铁笛击伤叶二娘', 173, 175, 'branch');
pushEvent(w2, e++, '保定帝回宫揭青袍客为延庆太子', 189, 197, 'main');
pushEvent(w2, e++, '保定帝拟册封段正淳为皇太弟', 219, 219, 'main');

pushDialogue(w2, e++, '保定帝：武功是你稍胜半筹', '保定帝', 123, 123, 121, 123, 'both', '坦承对方武功略胜却自认能胜，显自信与诚恳', ['坦诚', '自信']);
pushDialogue(w2, e++, '青袍客：正要大理段氏乱伦败德', '青袍客', 141, 141, 141, 143, 'event', '道出囚禁段誉木婉清的复仇目的', null);
pushDialogue(w2, e++, '青袍客：出家为僧将大位让我', '青袍客', 145, 145, 145, 147, 'event', '以段誉性命要挟保定帝让位', null);
pushDialogue(w2, e++, '段誉：一指将我处死了罢', '段誉', 157, 157, 155, 157, 'both', '宁死不污段氏门风，显重名节与绝望', ['重名节', '刚烈']);
pushDialogue(w2, e++, '保定帝：生死有命任其自然', '保定帝', 159, 159, 157, 159, 'persona', '拒以邪道救侄，守段氏清誉', ['刚毅', '守正']);
pushDialogue(w2, e++, '保定帝：是延庆太子', '保定帝', 195, 195, 195, 197, 'event', '宫中揭破青袍客真实身分', null);
pushDialogue(w2, e++, '高升泰：只当他是四大恶人之首', '高升泰', 203, 203, 201, 203, 'event', '主张不认太子名分而以恶人诛之', null);
pushDialogue(w2, e++, '巴天石：怎能让他秉掌大理国政', '巴天石', 209, 209, 209, 209, 'event', '反对让位恶贯满盈式的延庆太子', null);

// ========== ch008_w003 ==========
const w3 = 'ch008_w003';
i = 1;
pushNamed(w3, i++, 'character', '华赫艮', 255, 255);
pushNamed(w3, i++, 'character', '范骅', 255, 255);
pushNamed(w3, i++, 'character', '黄眉和尚', 237, 237);
pushNamed(w3, i++, 'character', '黄眉僧', 239, 239);
pushNamed(w3, i++, 'location', '拈花寺', 231, 231);
pushNamed(w3, i++, 'skill', '金刚指力', 245, 245);
pushNamed(w3, i++, 'character', '破疑', 293, 293);
pushNamed(w3, i++, 'character', '破嗔', 301, 301);
pushNamed(w3, i++, 'skill', '凌波微步', 273, 273);
pushNamed(w3, i++, 'item', '铁木鱼', 277, 277);
pushNamed(w3, i++, 'item', '木鱼槌', 277, 277);
pushNamed(w3, i++, 'skill', '一阳指', 245, 245);
pushNamed(w3, i++, 'character', '阿根', 261, 261);
pushNamed(w3, i++, 'faction', '大理三公', 269, 269);
pushNamed(w3, i++, 'location', '大理城', 227, 227);

e = 100;
pushEvent(w3, e++, '保定帝册封段正淳为皇太弟', 219, 223, 'main');
pushEvent(w3, e++, '保定帝夜访拈花寺请黄眉僧', 231, 241, 'main');
pushEvent(w3, e++, '保定帝允废盐税换黄眉僧出手', 247, 251, 'main');
pushEvent(w3, e++, '三公议定掘地道救段誉', 259, 271, 'main');
pushEvent(w3, e++, '段誉凌波微步化解药性', 273, 273, 'branch');
pushEvent(w3, e++, '黄眉僧与青袍客青石刻棋盘', 275, 281, 'main');
pushEvent(w3, e++, '黄眉僧斩趾争先手', 289, 297, 'main');
pushEvent(w3, e++, '黄眉青袍以内力刻子对弈', 299, 301, 'main');
pushEvent(w3, e++, '段誉隔屋指点黄眉僧棋路', 303, 311, 'main');

pushDialogue(w3, e++, '保定帝：皇位本是延庆太子的', '保定帝', 207, 207, 207, 209, 'persona', '认为皇位应归原主，显礼法观念与自责', ['守礼', '自省']);
pushDialogue(w3, e++, '段正淳：怎能为了他而甘舍大位', '段正淳', 213, 213, 211, 213, 'both', '劝兄不可因段誉让位，重社稷', ['忠义', '冷静']);
pushDialogue(w3, e++, '保定帝：你我兄弟一体', '保定帝', 221, 221, 219, 221, 'persona', '早决传位于弟，以名分息延庆之念', ['果决', '重亲']);
pushDialogue(w3, e++, '黄眉僧：不会武功也能杀人', '黄眉和尚', 239, 239, 239, 239, 'persona', '点破武功与杀生无必然，禅机式开示', ['通达', '机锋']);
pushDialogue(w3, e++, '保定帝：明天一早废除盐税', '保定帝', 247, 247, 247, 249, 'event', '以废盐税为请黄眉僧救侄的交换', null);
pushDialogue(w3, e++, '范骅：挖掘地道通入石室', '范骅', 263, 263, 259, 263, 'event', '提出盗墓式地道救援方案', null);
pushDialogue(w3, e++, '黄眉僧：到得七十岁时足趾是奇数', '黄眉僧', 295, 295, 293, 297, 'both', '自残小趾兑现奇偶之猜，志在必胜', ['狠决', '机智']);
pushDialogue(w3, e++, '段誉：反击去位不失先手', '段誉', 303, 303, 301, 305, 'event', '旁观破局，助黄眉僧稳住先手', null);
pushDialogue(w3, e++, '段誉：你早就不是真君子了', '段誉', 307, 307, 307, 307, 'persona', '反驳旁观不语，显机锋与不服', ['机锋', '率直']);

// ========== ch008_w004 ==========
const w4 = 'ch008_w004';
i = 1;
pushNamed(w4, i++, 'character', '破嗔', 301, 301);
pushNamed(w4, i++, 'skill', '虎爪功', 331, 331);
pushNamed(w4, i++, 'item', '孔明灯', 329, 329);
pushNamed(w4, i++, 'item', '阴阳和合散', 361, 361);
pushNamed(w4, i++, 'character', '钟夫人', 351, 351);
pushNamed(w4, i++, 'character', '甘宝宝', 341, 341);
pushNamed(w4, i++, 'faction', '一阳指段家', 353, 353);
pushNamed(w4, i++, 'character', '云中鹤', 367, 367);
pushNamed(w4, i++, 'location', '万劫谷', 329, 329);
pushNamed(w4, i++, 'character', '延庆太子', 329, 329);

e = 100;
pushEvent(w4, e++, '段誉传七步棋破嗔背书', 309, 315, 'main');
pushEvent(w4, e++, '青袍客不应之应扭转棋势', 315, 317, 'main');
pushEvent(w4, e++, '黄眉僧与青袍客一指一杖拚内力兼对弈', 321, 327, 'main');
pushEvent(w4, e++, '三公掘地道误入钟家居室', 329, 341, 'main');
pushEvent(w4, e++, '华赫艮掳钟灵入地道灭迹', 343, 345, 'main');
pushEvent(w4, e++, '钟万仇邀宾欲揭段氏乱伦', 351, 353, 'main');
pushEvent(w4, e++, '甘宝宝痛斥钟万仇卑鄙', 355, 359, 'branch');
pushEvent(w4, e++, '钟万仇踏中地道盖板未觉', 365, 365, 'detail');

pushDialogue(w4, e++, '青袍客：旁观不语真君子', '青袍客', 307, 307, 307, 307, 'event', '指责段誉多口，对局火药味上升', null);
pushDialogue(w4, e++, '黄眉僧：能者示人以不能', '黄眉僧', 313, 313, 311, 313, 'persona', '以弈理掩饰段誉授棋，机变从容', ['机变', '沉稳']);
pushDialogue(w4, e++, '华赫艮：是朋友救你们来啦', '华赫艮', 337, 337, 335, 337, 'event', '破地板入室安抚误以为木婉清的人', null);
pushDialogue(w4, e++, '钟万仇：明儿打开石屋让大家开开眼界', '钟万仇', 353, 353, 351, 353, 'event', '欲借宾客见证羞辱段氏，推动危机', null);
pushDialogue(w4, e++, '钟夫人：天下英雄耻笑的是你', '钟夫人', 355, 355, 353, 355, 'both', '痛斥丈夫以卑劣手段摆布段誉兄妹', ['刚直', '重义']);
pushDialogue(w4, e++, '钟夫人：我做点卑鄙无耻的事给你瞧', '钟夫人', 363, 363, 361, 363, 'persona', '以反话威胁丈夫，妒恨旧情交织', ['刚烈', '任性']);

// chapter_summary on last window
const summaryText = ref(w4, 351, 373);
event.push({
  candidate_id: nid(w4, e++),
  category_hint: 'chapter_summary',
  name: '第八回 虎啸龙吟',
  chapter: 8,
  source_ref: summaryText,
  discovery_pass: 'event-dialogue',
  window_id: w4,
  title: '第八回 虎啸龙吟',
  summary:
    '保定帝得巴天石探报，率段正淳夫妇与高升泰等攻入万劫谷。刀白凤与秦红棉仇杀，段正淳左右为难；护卫与云中鹤、叶二娘、南海鳄神混战。青袍客以阴阳和合散困段誉与木婉清于石屋，保定帝至石屋前与其对峙，一阳指五指试功后知对方为失踪的延庆太子，对方逼其让位出家。保定帝暂退回宫，册封段正淳为皇太弟，夜访拈花寺请黄眉僧，允废盐税；三公议掘地道救人。黄眉僧与青袍客于石屋前以内力刻棋对弈，段誉暗中授棋；三公地道误入钟家，掳走钟灵。钟万仇邀宾欲次日揭开石屋羞辱段氏，甘宝宝痛加斥责。',
  key_events: [
    '段氏攻入万劫谷混战',
    '青袍客囚段誉木婉清并逼保定帝让位',
    '青袍客身分揭为延庆太子',
    '保定帝册封皇太弟并请黄眉僧',
    '黄眉僧青石对弈牵制青袍客',
    '三公掘地道误掳钟灵',
  ],
});

// validate all source_ref
function validate(list, label) {
  const errors = [];
  for (const c of list) {
    const w = W[c.window_id];
    if (!w) {
      errors.push(`${c.candidate_id} bad window`);
      continue;
    }
    if (!w.text.includes(c.source_ref.text)) {
      errors.push(`${c.candidate_id} source_ref not substring`);
    }
    if (c.context_source_ref && !w.text.includes(c.context_source_ref.text)) {
      errors.push(`${c.candidate_id} context_source_ref not substring`);
    }
    // JSON serializable
    try {
      JSON.stringify(c);
    } catch (e) {
      errors.push(`${c.candidate_id} json fail ${e.message}`);
    }
  }
  return errors;
}

const errors = [...validate(named, 'named'), ...validate(event, 'event')];
// ensure one chapter_summary
const cs = event.filter((x) => x.category_hint === 'chapter_summary');
if (cs.length !== 1) errors.push(`chapter_summary count ${cs.length}`);

fs.writeFileSync(path.join(dir, 'named.jsonl'), named.map((x) => JSON.stringify(x)).join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'event.jsonl'), event.map((x) => JSON.stringify(x)).join('\n') + '\n');
const status = {
  chapter: 8,
  windows,
  named_count: named.length,
  event_count: event.length,
  ok: errors.length === 0,
  errors,
};
fs.writeFileSync(path.join(dir, 'STATUS.json'), JSON.stringify(status, null, 2) + '\n');
console.log(JSON.stringify({ chapter: 8, ok: status.ok, named: named.length, event: event.length, errors }, null, 2));
