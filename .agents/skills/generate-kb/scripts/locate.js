#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: locate.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
assertLegacyWriteAllowed(novelDir, { operation: 'locate' });
const splitDir = path.join(novelDir, 'ch_split');
if (!fs.existsSync(splitDir)) {
  console.error(`ch_split/ not found; run split-chapters.js first`);
  process.exit(1);
}

const chapterLines = new Map();
for (const f of fs.readdirSync(splitDir)) {
  if (!f.startsWith('ch_') || !f.endsWith('.txt')) continue;
  const n = parseInt(f.slice(3, -4), 10);
  if (isNaN(n)) continue;
  const lines = fs.readFileSync(path.join(splitDir, f), 'utf8').split(/\r?\n/);
  chapterLines.set(n, lines);
}

let ANCHOR_DICT = null;
function loadAnchorDict() {
  if (ANCHOR_DICT) return ANCHOR_DICT;
  
  // 优先读取小说专属关键词文件 (from build/ or novelDir/)
  const keywordsPath = path.join(novelDir, 'build', 'keywords.json');
  const keywordsPathAlt = path.join(novelDir, 'keywords.json');
  if (fs.existsSync(keywordsPath)) {
    try {
      const keywords = JSON.parse(fs.readFileSync(keywordsPath, 'utf8'));
      if (Array.isArray(keywords) && keywords.length > 0) {
        ANCHOR_DICT = keywords.filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
        console.log(`Loaded ${ANCHOR_DICT.length} keywords from keywords.json`);
        return ANCHOR_DICT;
      }
    } catch (e) {
      console.warn(`Failed to load keywords.json: ${e.message}, falling back to defaults`);
    }
  } else if (fs.existsSync(keywordsPathAlt)) {
    try {
      const keywords = JSON.parse(fs.readFileSync(keywordsPathAlt, 'utf8'));
      if (Array.isArray(keywords) && keywords.length > 0) {
        ANCHOR_DICT = keywords.filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
        console.log(`Loaded ${ANCHOR_DICT.length} keywords from keywords.json`);
        return ANCHOR_DICT;
      }
    } catch (e) {
      console.warn(`Failed to load keywords.json: ${e.message}, falling back to defaults`);
    }
  }
  
  // Fallback: 使用 mention_index + 硬编码关键词
  console.log('keywords.json not found, using default keywords');
  const terms = new Set();
  const mentionPath = path.join(novelDir, 'build', 'mention_index.jsonl');
  if (fs.existsSync(mentionPath)) {
    for (const raw of fs.readFileSync(mentionPath, 'utf8').split(/\r?\n/)) {
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj.term && obj.term.length >= 2) terms.add(obj.term);
      } catch {}
    }
  }
  const extra = [
    '斗酒', '结拜', '自尽', '折箭', '误杀', '相认', '招亲', '破珍珑', '珍珑棋局', '珍珑棋会', '传功', '化功',
    '揭发', '独战', '绝交酒', '定情', '登场', '落败', '图谋', '认父', '传授', '初见', '论武',
    '重逢', '相会', '冰窖', '枯井', '污泥', '疯癫', '复国', '称帝', '招亲', '塞上牛羊',
    '丐帮大会', '武林大会', '雁门关惨案', '聚贤庄', '杏子林', '少室山', '少林寺',
    '曼陀山庄', '燕子坞', '参合庄', '灵鹫宫', '无量山', '剑湖宫', '松鹤楼', '小镜湖',
    '西夏皇宫', '擂鼓山', '天龙寺', '大理城', '无锡', '信阳', '洛阳', '苏州',
    '琅嬛福地', '天聋地哑谷', '藏经阁', '无量洞', '万劫谷', '大轮寺', '镇南王府',
    '玉像', '帛卷', '铁杖', '游坦之', '游氏双雄', '阿碧', '苏星河', '玄难',
    '段延庆', '钟万仇', '钟夫人', '甘宝宝', '扫地僧', '李秋水', '走火入魔',
    '点化', '搅局', '混战', '激斗', '对峙', '挑战', '拜见', '救走', '陪伴',
    '装聋作哑', '天聋地哑', '英雄大会', '佛法', '武功秘籍', '白虹掌力',
  ];
  for (const e of extra) terms.add(e);
  const stopwords = new Set(['的', '了', '在', '是', '与', '和', '他', '她', '它', '们', '为', '以', '其', '所', '将', '被', '把', '给', '让', '着', '过', '到', '从', '向', '对', '由', '经', '因', '若', '虽', '而', '且', '或', '但', '却', '也', '都', '又', '还', '就', '才', '很', '太', '更', '已', '不', '没', '别', '初', '次', '中', '后', '前', '得']);
  ANCHOR_DICT = [...terms].filter(t => !stopwords.has(t) && t.length >= 2).sort((a, b) => b.length - a.length);
  return ANCHOR_DICT;
}

const EVENT_TYPE_KEYWORDS = {
  first_mention: ['初见', '初遇', '首次', '第一次', '登场', '出场', '得名', '得名号', '首现', '初识', '首提', '拜见', '入门'],
  climax: ['大战', '对决', '独战', '群战', '血战', '激斗', '死战', '决战', '对决', '伏击', '复仇', '报仇', '误杀', '自尽', '破', '击败', '大胜', '惨败', '斗酒', '斗法', '斗剑', '定情', '告白', '揭穿', '揭晓', '相认', '背叛', '决裂'],
  resolution: ['结局', '终章', '收场', '落幕', '圆寂', '逝世', '归隐', '离去', '远走', '终成', '大婚', '继位', '登基', '成婚', '出家', '了断', '化解', '真相大白', '盖棺'],
};

function inferEventType(ref) {
  if (ref && ref.event_type && ['first_mention', 'climax', 'resolution', 'background'].includes(ref.event_type)) {
    return ref.event_type;
  }
  const anchor = (ref && (ref.anchor || ref.text)) || '';
  for (const [type, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (anchor.includes(kw)) return type;
    }
  }
  return 'background';
}

function applyEventTypeBonus(candidates, eventType, hintedChapter, totalChapters) {
  if (eventType === 'background' || !candidates.length) return candidates;
  const maxCh = totalChapters || 50;
  return candidates.map(c => {
    let bonus = 0;
    if (eventType === 'first_mention') {
      bonus = Math.max(0, (maxCh - c.chapter) * 3);
    } else if (eventType === 'climax') {
      bonus = 0;
    } else if (eventType === 'resolution') {
      bonus = c.chapter * 3;
    }
    return { ...c, score: c.score + bonus };
  });
}

function extractAnchors(text) {
  const dict = loadAnchorDict();
  const anchors = new Set();
  for (const term of dict) {
    if (text.includes(term)) anchors.add(term);
  }
  return [...anchors];
}

function bestSnippet(lines, windowLines = 5) {
  let best = null;
  for (let start = 0; start < lines.length; start++) {
    const end = Math.min(lines.length, start + windowLines);
    const snippet = lines.slice(start, end).join('\n');
    if (!best || snippet.length < best.text.length) best = { start: start + 1, end, text: snippet };
  }
  return best;
}

function locate(anchor, hintedChapter, refEventType) {
  const terms = extractAnchors(anchor).filter(t => t.length >= 2);
  const unique = [...new Set(terms)];
  const eventType = inferEventType({ anchor, event_type: refEventType });
  if (unique.length === 0) {
    return { status: 'not_located', reason: 'no anchor terms recognized' };
  }

  if (unique.length === 1 && hintedChapter && chapterLines.has(hintedChapter)) {
    const lines = chapterLines.get(hintedChapter);
    const idx = lines.findIndex(l => l.includes(unique[0]));
    if (idx >= 0) {
      const s = Math.max(0, idx - 1);
      const e = Math.min(lines.length, idx + 3);
      const primary = {
        chapter: hintedChapter,
        line_start: s + 1,
        line_end: e,
        text: lines.slice(s, e).join('\n'),
        score: 100,
        anchors_hit: unique,
        anchors_total: 1,
        method: 'partial',
      };
      return { status: 'partial', primary, alternatives: [], hint_chapter: hintedChapter };
    }
  }

  const candidates = [];
  const allChapters = [...chapterLines.keys()];
  const hintedNear = hintedChapter
    ? [hintedChapter - 3, hintedChapter - 2, hintedChapter - 1, hintedChapter, hintedChapter + 1, hintedChapter + 2, hintedChapter + 3].filter(c => chapterLines.has(c))
    : [];
  const toSearch = [...new Set([...hintedNear, ...allChapters])];

  for (const ch of toSearch) {
    const lines = chapterLines.get(ch);
    const hitsByTerm = new Map();
    for (const t of unique) {
      const positions = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(t)) positions.push(i);
      }
      if (positions.length) hitsByTerm.set(t, positions);
    }
    const hitCount = hitsByTerm.size;
    if (hitCount < 1) continue;

    const allPositions = [];
    for (const [term, positions] of hitsByTerm) {
      for (const p of positions) allPositions.push({ term, p });
    }
    allPositions.sort((a, b) => a.p - b.p);

    for (let i = 0; i < allPositions.length; i++) {
      const window = [allPositions[i]];
      const seenTerms = new Set([allPositions[i].term]);
      let j = i + 1;
      while (j < allPositions.length && seenTerms.size < unique.length) {
        if (!seenTerms.has(allPositions[j].term)) {
          seenTerms.add(allPositions[j].term);
          window.push(allPositions[j]);
        }
        j++;
      }
      const minHits = unique.length >= 2 ? 2 : 1;
      if (seenTerms.size >= minHits) {
        const spanStart = window[0].p;
        const spanEnd = window[window.length - 1].p;
        const spanLen = spanEnd - spanStart;
        if (spanLen <= 100) {
          const s = Math.max(0, spanStart - 1);
          const e = Math.min(lines.length, spanEnd + 2);
          const densityScore = seenTerms.size * 100 - Math.floor(spanLen / 5);
          candidates.push({
            chapter: ch,
            line_start: s + 1,
            line_end: e,
            text: lines.slice(s, e).join('\n'),
            score: densityScore,
            anchors_hit: [...seenTerms],
            anchors_total: unique.length,
          });
        }
      }
    }
  }

  if (!candidates.length) {
    const chapterScores = [];
    const searchChs = hintedChapter && chapterLines.has(hintedChapter)
      ? [hintedChapter, hintedChapter - 1, hintedChapter + 1].filter(c => chapterLines.has(c))
      : [...chapterLines.keys()];
    for (const ch of searchChs) {
      const chText = chapterLines.get(ch).join('\n');
      const hitTerms = unique.filter(t => chText.includes(t));
      if (hitTerms.length >= 1) {
        const midLine = Math.floor(chapterLines.get(ch).length / 2);
        chapterScores.push({
          chapter: ch,
          line_start: midLine + 1,
          line_end: midLine + 5,
          text: chapterLines.get(ch).slice(Math.max(0, midLine - 2), midLine + 3).join('\n'),
          score: hitTerms.length * 50,
          anchors_hit: hitTerms,
          anchors_total: unique.length,
          method: 'chapter_score',
        });
      }
    }
    const boostedScores = applyEventTypeBonus(chapterScores, eventType, hintedChapter, chapterLines.size);
    boostedScores.sort((a, b) => b.score - a.score);
    if (!boostedScores.length) {
      return { status: 'not_located', reason: 'no match in chapter', anchors: unique, event_type: eventType };
    }
    const [primary, ...alts] = boostedScores.slice(0, 3);
    const hintMatch = hintedChapter ? primary.chapter === hintedChapter : true;
    return {
      status: hintMatch ? 'located_chapter_level' : 'located_different_chapter',
      primary,
      alternatives: alts,
      hint_chapter: hintedChapter,
      event_type: eventType,
    };
  }
  const boostedCandidates = applyEventTypeBonus(candidates, eventType, hintedChapter, chapterLines.size);
  boostedCandidates.sort((a, b) => b.score - a.score);
  const byChapter = new Map();
  for (const c of boostedCandidates) {
    c.method = 'window';
    if (!byChapter.has(c.chapter) || byChapter.get(c.chapter).score < c.score) {
      byChapter.set(c.chapter, c);
    }
  }
  const perChapterBest = [...byChapter.values()].sort((a, b) => b.score - a.score);
  if (!perChapterBest.length) {
    return { status: 'not_located', reason: 'no match in chapter', anchors: unique };
  }
  const topScore = perChapterBest[0].score;
  const threshold = topScore * 0.6;
  const qualified = perChapterBest.filter(c => c.score >= threshold).slice(0, 5);
  const [primary, ...alts] = qualified.map(c => ({
    chapter: c.chapter,
    line_start: c.line_start,
    line_end: c.line_end,
    text: c.text.length > 400 ? c.text.slice(0, 400) + '…' : c.text,
    score: c.score,
    anchors_hit: c.anchors_hit,
    anchors_total: c.anchors_total,
    method: c.method,
  }));
  let hintMatch = false;
  if (hintedChapter) {
    if (primary.chapter === hintedChapter) hintMatch = true;
    else {
      for (const a of alts) {
        if (a.chapter === hintedChapter) { hintMatch = true; break; }
      }
      if (!hintMatch && Math.abs(primary.chapter - hintedChapter) <= 1) hintMatch = true;
    }
  } else {
    hintMatch = true;
  }
  return {
    status: hintMatch ? 'located' : 'located_different_chapter',
    primary,
    alternatives: alts,
    hint_chapter: hintedChapter,
    event_type: eventType,
  };
}

function normalizeRef(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return { anchor: ref };
  if (ref.anchor) return { chapter: ref.chapter, anchor: ref.anchor };
  if (ref.text) return { chapter: ref.chapter, anchor: ref.text };
  return null;
}

const FILES = ['characters.json', 'factions.json', 'locations.json', 'skills.json', 'techniques.json', 'items.json', 'dialogues.json'];
const summary = {};

for (const file of FILES) {
  // Try data/ subdirectory first, then root
  const fp = fs.existsSync(path.join(novelDir, 'data', file))
    ? path.join(novelDir, 'data', file)
    : path.join(novelDir, file);
  if (!fs.existsSync(fp)) { summary[file] = { error: 'file not found' }; continue; }
  let arr;
  try { arr = JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { summary[file] = { error: `parse error: ${e.message}` }; continue; }
  if (!Array.isArray(arr)) { summary[file] = { error: 'not an array' }; continue; }

  let located = 0, partial = 0, notLocated = 0, diffCh = 0;
  for (const ent of arr) {
    if (!ent) continue;
    if (Array.isArray(ent.source_refs)) {
      for (const ref of ent.source_refs) {
        const n = normalizeRef(ref);
        if (!n) { notLocated++; continue; }
        const r = locate(n.anchor, n.chapter, ref.event_type);
        if (r.status === 'located' || r.status === 'partial' || r.status === 'located_chapter_level') {
          const p = r.primary;
          ref.chapter = p.chapter;
          ref.line_start = p.line_start;
          ref.line_end = p.line_end;
          ref.text = p.text;
          ref.anchors_hit = p.anchors_hit;
          ref.anchors_total = p.anchors_total;
          ref.locate_status = r.status;
          ref.locate_score = p.score;
          ref.locate_method = p.method;
          ref.hint_chapter = r.hint_chapter;
          ref.event_type = r.event_type;
          ref.alternatives = (r.alternatives || []).map(a => ({
            chapter: a.chapter,
            line_start: a.line_start,
            line_end: a.line_end,
            text: a.text,
            score: a.score,
            anchors_hit: a.anchors_hit,
            method: a.method,
          }));
          located++;
          if (r.status === 'partial') partial++;
        } else if (r.status === 'located_different_chapter') {
          const p = r.primary;
          ref.chapter = p.chapter;
          ref.line_start = p.line_start;
          ref.line_end = p.line_end;
          ref.text = p.text;
          ref.anchors_hit = p.anchors_hit;
          ref.anchors_total = p.anchors_total;
          ref.locate_status = r.status;
          ref.locate_score = p.score;
          ref.locate_method = p.method;
          ref.hint_chapter = r.hint_chapter;
          ref.event_type = r.event_type;
          ref.alternatives = (r.alternatives || []).map(a => ({
            chapter: a.chapter,
            line_start: a.line_start,
            line_end: a.line_end,
            text: a.text,
            score: a.score,
            anchors_hit: a.anchors_hit,
            method: a.method,
          }));
          located++;
          diffCh++;
        } else {
          ref.locate_status = 'not_located';
          ref.locate_reason = r.reason;
          ref.locate_anchors = r.anchors;
          ref.event_type = r.event_type;
          ref.alternatives = [];
          notLocated++;
        }
      }
    }
    if (Array.isArray(ent.dialogues)) {
      for (const d of ent.dialogues) {
        const n = normalizeRef(d);
        if (!n) continue;
        const r = locate(n.anchor, n.chapter);
        if (r.status === 'located' || r.status === 'located_different_chapter') {
          d.chapter = r.chapter;
          d.line_start = r.line_start;
          d.line_end = r.line_end;
        }
      }
    }
  }
  fs.writeFileSync(fp, JSON.stringify(arr, null, 2), 'utf8');
  summary[file] = { entities: arr.length, located, partial, not_located: notLocated, different_chapter: diffCh };
}

console.log('=== locate summary ===');
for (const [f, s] of Object.entries(summary)) {
  if (s.error) { console.log(`${f}: ERROR ${s.error}`); continue; }
  const total = s.located + s.not_located;
  const rate = total ? Math.round((s.located / total) * 100) : 0;
  console.log(`${f}: ${s.entities} entities, ${s.located}/${total} located (${rate}%), partial=${s.partial}, diff_ch=${s.different_chapter}, not_located=${s.not_located}`);
}
console.log('\nsource_refs updated in-place with line_start/line_end/text');
