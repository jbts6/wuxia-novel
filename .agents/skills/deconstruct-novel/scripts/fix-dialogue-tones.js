const fs = require('fs');
const path = require('path');

const VOCAB = {
  emotional: new Set([
    '平静', '愤怒', '激动', '悲伤', '悲痛', '得意', '恐惧', '冷酷',
    '温柔', '慌张', '担心', '痛苦', '惊讶', '疑问', '好奇', '犹豫',
    '恳求', '嘲讽', '调侃', '豪迈', '无奈', '认真', '焦急', '欣慰', '欣喜',
  ]),
  manner: new Set([
    '冷笑', '苦笑', '轻笑', '大笑', '微笑', '狂笑', '喃喃', '沉声',
    '厉声', '颤声', '嘶声', '柔声', '淡然', '严肃', '低语', '娇声',
  ]),
  fallback: '陈述',
};
const VOCAB_ALL = new Set([...VOCAB.emotional, ...VOCAB.manner, VOCAB.fallback]);

function existsInVocab(t) {
  return t && VOCAB_ALL.has(t);
}

function mapTone(raw) {
  if (!raw) return VOCAB.fallback;
  const t = raw.trim();
  if (existsInVocab(t)) return t;

  const exact = {
    'neutral': '平静', 'NEUTRAL': '平静', 'Neutral': '平静',
    'normal': '陈述', 'NORMAL': '陈述', 'Normal': '陈述',
    '中性': '平静', '平常': '平静', '平常心': '平静',
    'undefined': '陈述',
  };
  if (exact[t] !== undefined) return exact[t];

  if (t === '道' || t === '说' || t === '说道') return '陈述';
  if (t === '笑') return '平静';
  if (t === '叹' || t === '叹气') return '无奈';
  if (t === '问') return '疑问';
  if (t === '冷冷') return '淡然';

  const rules = [
    { kw: ['悲痛', '悲恸', '哀恸'], to: '悲痛' },
    { kw: ['哀伤', '哀痛', '悲怆', '悲伤', '悲声', '悲泣', '哭', '泣', '哽咽', '哀', '凄然', '凄楚', '伤心', '心碎', '泪'], to: '悲伤' },
    { kw: ['愤怒', '怒喝', '怒吼', '怒道', '怒视', '怒声', '大怒', '暴怒', '盛怒', '嗔怒', '发怒', '气愤', '愤然', '愤', '忿'], to: '愤怒' },
    { kw: ['激动', '兴奋', '激昂', '慷慨', '振奋'], to: '激动' },
    { kw: ['得意', '骄傲', '自豪', '沾沾自喜', '洋洋得意', '自得', '傲然'], to: '得意' },
    { kw: ['恐惧', '害怕', '惊惧', '惊惶', '惶恐', '惧怕', '畏惧', '胆怯', '怯', '慑', '悚然'], to: '恐惧' },
    { kw: ['冷酷', '冷漠', '冷峻', '冷硬', '无情', '冰冷', '冰寒'], to: '冷酷' },
    { kw: ['温柔', '柔情', '温存', '温婉', '温和', '和煦', '亲切'], to: '温柔' },
    { kw: ['慌张', '慌乱', '手足无措', '惊慌', '失措', '忙乱'], to: '慌张' },
    { kw: ['担心', '担忧', '忧虑', '忧心', '焦虑', '不安'], to: '担心' },
    { kw: ['痛苦', '痛心', '痛楚', '煎熬', '苦痛', '痛'], to: '痛苦' },
    { kw: ['惊讶', '吃惊', '震惊', '诧异', '愕然', '愣住', '惊', '讶异', '惊奇', '目瞪口呆', '瞠目'], to: '惊讶' },
    { kw: ['疑问', '质疑', '困惑', '纳闷', '不解', '狐疑', '生疑', '疑'], to: '疑问' },
    { kw: ['好奇', '好生奇怪'], to: '好奇' },
    { kw: ['犹豫', '迟疑', '踌躇', '举棋不定', '摇摆', '矛盾'], to: '犹豫' },
    { kw: ['恳求', '哀求', '乞求', '祈求', '央求', '求', '请求'], to: '恳求' },
    { kw: ['嘲讽', '讥讽', '挖苦', '讽刺', '讥诮', '嘲笑', '嘲弄', '讥', '嘲'], to: '嘲讽' },
    { kw: ['调侃', '戏谑', '打趣', '逗弄', '玩笑'], to: '调侃' },
    { kw: ['豪迈', '豪爽', '豪情', '豪气', '豪'], to: '豪迈' },
    { kw: ['无奈', '无可奈何', '叹息', '叹', '叹气'], to: '无奈' },
    { kw: ['认真', '一本正经', '郑重', '正色', '一本正经', '正经'], to: '认真' },
    { kw: ['焦急', '急切', '急躁', '急迫', '迫不及待', '心急', '焦躁', '焦灼', '急'], to: '焦急' },
    { kw: ['欣慰', '安慰', '宽慰'], to: '欣慰' },
    { kw: ['欣喜', '欢喜', '喜悦', '高兴', '开心', '快乐', '愉快', '欢欣', '欢快', '欢畅', '欢乐', '欢', '喜'], to: '欣喜' },
    { kw: ['淡然', '淡定', '淡漠', '淡淡', '淡'], to: '淡然' },
    { kw: ['严肃', '庄重', '凝重', '肃然', '肃穆', '严', '厉色'], to: '严肃' },
    { kw: ['沉声', '低沉', '深沉', '沉'], to: '沉声' },
    { kw: ['厉声', '严厉', '声色俱厉', '厉'], to: '厉声' },
    { kw: ['颤声', '颤抖', '发抖', '哆嗦', '颤', '战栗'], to: '颤声' },
    { kw: ['嘶声', '嘶哑', '沙哑', '嘶'], to: '嘶声' },
    { kw: ['柔声', '柔', '温言'], to: '柔声' },
    { kw: ['低语', '低声', '小声', '悄声', '轻轻'], to: '低语' },
    { kw: ['喃喃', '自言自语', '嘀咕', '嘟囔', '念叨'], to: '喃喃' },
    { kw: ['大笑', '哈哈大笑', '哈哈笑', '放声大笑', '仰天大笑', '开怀大笑'], to: '大笑' },
    { kw: ['狂笑', '狞笑', '疯笑', '狂'], to: '狂笑' },
    { kw: ['冷笑', '冷冷笑', '冷然', '冷声'], to: '冷笑' },
    { kw: ['苦笑'], to: '苦笑' },
    { kw: ['轻笑', '轻轻一笑', '微微一笑'], to: '轻笑' },
    { kw: ['微笑', '含笑', '带笑', '笑着说'], to: '微笑' },
    { kw: ['娇声', '娇笑', '娇', '娇媚'], to: '娇声' },
    { kw: ['平静', '冷静', '从容', '镇定', '沉着', '安然', '淡定', '平和', '镇定'], to: '平静' },
    { kw: ['激动', '冲动', '激昂'], to: '激动' },
  ];

  for (const r of rules) {
    for (const kw of r.kw) {
      if (t.includes(kw)) return r.to;
    }
  }

  if (t.length <= 2 && /[笑道叹喝吼呼喊着唱吟读诵说问答评]/ .test(t)) return '陈述';

  return VOCAB.fallback;
}

const NOVELS = [
  '古龙/绝代双骄', '古龙/孔雀翎', '古龙/凤舞九天', '古龙/剑神一笑',
  '古龙/多情剑客无情剑', '古龙/流星·蝴蝶·剑', '古龙/三少爷的剑',
  '古龙/浣花洗剑录', '古龙/圆月弯刀',
  '金庸/射雕英雄传', '金庸/天龙八部', '金庸/鹿鼎记', '金庸/笑傲江湖',
  '金庸/神雕侠侣', '金庸/倚天屠龙记', '金庸/雪山飞狐', '金庸/飞狐外传',
  '金庸/连城诀', '金庸/侠客行', '金庸/书剑恩仇录', '金庸/碧血剑',
  '金庸/白马啸西风', '金庸/鸳鸯刀',
  '梁羽生/绝塞传烽录', '梁羽生/弹指惊雷',
  '温瑞安/神州奇侠系列正传之01剑气长江', '温瑞安/杀人者唐斩',
];

const base = 'C:/git/wuxia-novel';
let totalFixed = 0;
let totalEntries = 0;
let totalBefore = 0;

for (const n of NOVELS) {
  const fp = path.join(base, n, 'dialogues.json');
  let raw;
  try { raw = fs.readFileSync(fp, 'utf8'); } catch { console.log(`${n}: 文件不存在，跳过`); continue; }
  const d = JSON.parse(raw);
  const before = new Set(d.map(x => x.tone));
  const beforeCount = before.size;
  const beforeUndef = d.filter(x => !x.tone).length;
  let fixed = 0;
  d.forEach(x => {
    const orig = x.tone;
    const mapped = mapTone(x.tone);
    if (orig !== mapped) { x.tone = mapped; fixed++; }
    else if (!orig) { x.tone = mapped; fixed++; }
  });
  fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8');
  const after = new Set(d.map(x => x.tone));
  const afterUndef = d.filter(x => !x.tone).length;
  const invalid = d.filter(x => !VOCAB_ALL.has(x.tone)).length;
  totalEntries += d.length;
  totalBefore += beforeCount;
  totalFixed += fixed;
  console.log(`${n}`);
  console.log(`  条目: ${d.length}, tone: ${beforeCount} → ${after.size}, undefined: ${beforeUndef} → ${afterUndef}, 不合规: ${invalid}, 已修复: ${fixed}`);
}
console.log(`\n总计: ${totalEntries} 条, 唯一 tone: ${totalBefore} → ≤42, 已修复: ${totalFixed}`);
