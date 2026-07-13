#!/usr/bin/env node
'use strict';
/**
 * Semi-auto named inventory + skeleton events for remaining windows.
 * High-recall names via quote/title patterns; events are light anchors that must be fixed/reviewed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/jbts6/Site/wuxia-novel';
const INDEX = path.join(ROOT, '金庸/天龙八部/build/source-index.json');
const DRAFT = path.join(ROOT, '.trellis/tasks/07-12-tlb-kb-rebuild-compare/scripts/_batch_drafts/ch02-10');
const SPECS = path.join(DRAFT, 'specs');

const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));

function findSnippet(text, name) {
  // Prefer a sentence-ish window containing the name
  const i = text.indexOf(name);
  if (i < 0) return null;
  let start = i;
  while (start > 0 && text[start - 1] !== '\n' && i - start < 40) start--;
  let end = i + name.length;
  while (end < text.length && text[end] !== '\n' && end - i < 80) end++;
  let snip = text.slice(start, end).trim();
  // ensure unique-ish and includes name
  if (!snip.includes(name)) return null;
  // avoid ultra short
  if (snip.length < name.length + 4) {
    start = Math.max(0, i - 20);
    end = Math.min(text.length, i + name.length + 40);
    snip = text.slice(start, end).replace(/\n/g, '');
  }
  return snip;
}

function classify(name, ctx) {
  if (/功|经|剑法|掌|指|步|拳|刀法|心法|神功|武功/.test(name)) return 'skill';
  if (/招|式/.test(name)) return 'technique';
  if (/派|帮|会|教|宗|门|族|氏|军|府|宫(?!$)/.test(name) || /灵鹫宫|神农帮|无量剑|四大恶人|丐帮|少林|逍遥派/.test(name)) return 'faction';
  if (/山|谷|峰|湖|江|河|城|寺|宫|洞|庄|镇|桥|渡|壁|府|国|郡|州/.test(name)) return 'location';
  if (/散|药|丹|剑|刀|盒|卷|图|鞋|貂|马|箭|符|令|经书|秘籍/.test(name)) return 'item';
  // default character for person-like 2-4 han
  if (/^[一-龥]{2,4}$/.test(name)) return 'character';
  return 'character';
}

const STOP = new Set([
  '这个','那个','什么','如何','怎么','为什么','我们','你们','他们','自己','天下','世上','人间','不知','不敢','不能','不是','没有','已经','忽然','突然','只见','只听','原来','因此','然而','但是','可是','如果','虽然','因为','于是','当下','这时','此时','其时','一面','不禁','心中','心下','寻思','料想','说道','喝道','叫道','问道','答道','想道','便道','又道','忙道','难道','何况','其实','不过','终于','早已','正在','少年','少女','男子','女子','老婆婆','老人家','大丈夫','英雄','好汉','性命','事情','时候','地方','样子','模样','声音','眼睛','身子','心头','心下','心中','脸上','手中','地下','门外','店中','庄上'
]);

function extractNames(text) {
  const found = new Map(); // name -> {count, snippet}
  // quoted names
  for (const m of text.matchAll(/[‘'「“]([^’”'」\n]{2,12})[’”'」]/g)) {
    const name = m[1].replace(/[…⋯].*$/, '').trim();
    if (name.length < 2 || name.length > 10) continue;
    if (STOP.has(name)) continue;
    if (!found.has(name)) {
      const sn = findSnippet(text, m[0].includes(name) ? name : m[1]);
      if (sn) found.set(name, { count: 1, snippet: sn, category: classify(name, sn) });
    } else found.get(name).count++;
  }
  // 名叫 / 叫做 / 便是
  for (const m of text.matchAll(/(?:名叫|叫做|便是|正是|原是|却是|还有)([一-龥]{2,4})/g)) {
    const name = m[1];
    if (STOP.has(name)) continue;
    if (!found.has(name)) {
      const sn = findSnippet(text, name);
      if (sn) found.set(name, { count: 1, snippet: sn, category: 'character' });
    } else found.get(name).count++;
  }
  // speaker patterns X道
  for (const m of text.matchAll(/([一-龥]{2,4})(?:笑|怒|叹|冷|忙|急|大|低|柔|朗|沉|惊|哼|微微|突然)?(?:道|说道|问道|喝道|叫道|骂道|怒道)/g)) {
    const name = m[1];
    if (STOP.has(name)) continue;
    if (/^[上下左右前后东西南北中大小高低]/.test(name)) continue;
    if (!found.has(name)) {
      const sn = findSnippet(text, name);
      if (sn) found.set(name, { count: 1, snippet: sn, category: 'character' });
    } else found.get(name).count++;
  }
  // known multi-char entities hard list scan
  const hard = [
    '段誉','钟灵','钟万仇','甘宝宝','木婉清','司空玄','干光豪','葛光佩','左子穆','辛双清','段正淳','无崖子','秋水妹',
    '瑞婆婆','平婆婆','天山童姥','虚竹','鸠摩智','萧峰','乔峰','阿朱','阿紫','游坦之','慕容复','王语嫣','邓百川','公冶乾','包不同','风波恶',
    '北冥神功','凌波微步','一阳指','六脉神剑','易筋经','降龙十八掌','降龙廿八掌','化功大法','小无相功','火焰刀',
    '无量剑','神农帮','逍遥派','灵鹫宫','四大恶人','丐帮','少林派','大理段氏','姑苏慕容',
    '无量山','剑湖宫','万劫谷','善人渡','澜沧江','缥缈峰','琅嬛福地','无量玉壁','大理','苏州',
    '断肠散','闪电貂','黑玫瑰','珍珑','黄金钿盒'
  ];
  for (const name of hard) {
    if (text.includes(name) && !found.has(name)) {
      const sn = findSnippet(text, name);
      if (sn) found.set(name, { count: 1, snippet: sn, category: classify(name, sn) });
    }
  }
  return found;
}

function pickEvents(window) {
  // lightweight heuristic events: pick lines with strong verbs
  const lines = window.text.split('\n');
  const events = [];
  const keys = ['杀死','杀了','救出','攻打','比剑','中毒','服了','拜见','自报','突围','围攻','中剑','中箭','逃走','跌','坠入','发现','揭开','交战','对掌','投降','娶','拜堂','拜师','传功','练功'];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.trim()) continue;
    if (keys.some(k => ln.includes(k)) && ln.length > 20 && ln.length < 180) {
      events.push({
        category_hint: 'event',
        name: ln.replace(/[“”‘’]/g, '').slice(0, 18).replace(/[，。！？].*$/, '') || `情节${events.length+1}`,
        event_level_hint: 'detail',
        source_ref: ln.trim().slice(0, 120)
      });
    }
    if (events.length >= 5) break;
  }
  return events;
}

function ensureSpec(window, force = false) {
  const fp = path.join(SPECS, `${window.id}.json`);
  if (fs.existsSync(fp) && !force) return { id: window.id, skipped: true };
  const names = extractNames(window.text);
  const named = [];
  for (const [name, info] of names) {
    if (!info.snippet || !window.text.includes(info.snippet)) continue;
    // filter noisy
    if (name.length === 1) continue;
    if (/^[一二三四五六七八九十]+$/.test(name)) continue;
    named.push({
      category_hint: info.category,
      name,
      source_ref: info.snippet
    });
  }
  // dedupe by name keep first
  const seen = new Set();
  const named2 = [];
  for (const n of named) {
    if (seen.has(n.name)) continue;
    seen.add(n.name);
    named2.push(n);
  }
  // sort: prefer hard entities first by category diversity
  named2.sort((a, b) => a.category_hint.localeCompare(b.category_hint) || a.name.localeCompare(b.name));
  const event = pickEvents(window);
  // chapter summary on last window of chapter
  const chapterWins = idx.windows.filter(w => w.chapter === window.chapter);
  const last = chapterWins[chapterWins.length - 1];
  if (window.id === last.id) {
    // use first non-empty line of chapter if possible else last lines
    const firstWin = chapterWins[0];
    const titleLine = firstWin.text.split('\n').map(s => s.trim()).find(s => s && s.length <= 12) || `第${window.chapter}章`;
    // summary source must be from THIS last window
    const lastLine = window.text.split('\n').map(s => s.trim()).filter(Boolean).slice(-3)[0] || window.text.slice(0, 40);
    event.push({
      category_hint: 'chapter_summary',
      name: `第${window.chapter}章概要`,
      source_ref: lastLine.slice(0, 80)
    });
  }
  const spec = { window_id: window.id, named: named2.slice(0, 40), event: event.slice(0, 8) };
  fs.writeFileSync(fp, JSON.stringify(spec, null, 2) + '\n');
  return { id: window.id, named: named2.length, event: event.length, skipped: false };
}

function main() {
  fs.mkdirSync(SPECS, { recursive: true });
  const chapters = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const wins = idx.windows.filter(w => chapters.includes(w.chapter));
  const onlyMissing = process.argv.includes('--missing');
  const results = [];
  for (const w of wins) {
    const fp = path.join(SPECS, `${w.id}.json`);
    if (onlyMissing && fs.existsSync(fp)) {
      results.push({ id: w.id, skipped: true });
      continue;
    }
    // never overwrite hand specs for ch002/ch003 if exist unless --force
    if (fs.existsSync(fp) && !process.argv.includes('--force')) {
      results.push({ id: w.id, skipped: true });
      continue;
    }
    results.push(ensureSpec(w, process.argv.includes('--force')));
  }
  console.log(JSON.stringify({
    total: wins.length,
    written: results.filter(r => !r.skipped).length,
    skipped: results.filter(r => r.skipped).length,
    sample: results.filter(r => !r.skipped).slice(0, 5)
  }, null, 2));
}

if (require.main === module) main();
