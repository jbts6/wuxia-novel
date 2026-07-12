'use strict';

function sourceRef(text) {
  return { chapter: 1, line_start: 1, line_end: 1, text };
}

function fieldRefs(text, fields) {
  return Object.fromEntries(fields.map(field => [field, [sourceRef(text)]]));
}

function buildCompleteData(sourceText = '主角说道：“我练的是北冥神功。”') {
  const character = {
    id: 'char_main',
    name: '主角',
    alias: [],
    identity: '试验故事的主角',
    faction: '',
    role: '核心',
    archetype: 'warrior',
    power_rank: '初窥门径',
    importance: '核心',
    one_line: '修习北冥神功并主动说明所学。',
    biography: '主角在故事中说明自己正在修习北冥神功。',
    personality: {
      traits: ['坦率', '自信', '直接', '勤学', '沉着'],
      speech_style: '直陈事实',
      temperament: '沉着'
    },
    relationships: [],
    known_skills: ['skill_bei_ming'],
    related_skills: ['skill_bei_ming'],
    rag_refs: [1],
    source_refs: [sourceRef(sourceText)],
    field_source_refs: fieldRefs(sourceText, [
      'identity', 'one_line', 'biography', 'personality'
    ])
  };
  const skill = {
    id: 'skill_bei_ming',
    name: '北冥神功',
    type: '内功',
    faction: '',
    mastery_rank: '初窥门径',
    one_line: '主角明确说出自己正在修习的内功。',
    techniques: [],
    progression: '原文只说明正在修习，未交代阶段变化。',
    effects: [],
    combat_style: '以内力修习为主，原文未展示具体交手。',
    rag_refs: [1],
    source_refs: [sourceRef(sourceText)],
    field_source_refs: fieldRefs(sourceText, [
      'one_line', 'progression', 'combat_style'
    ])
  };
  const dialogue = {
    id: 'dialogue_zhu_jue_shuo_ming_suo_xue',
    speaker: 'char_main',
    speaker_name: '主角',
    listener: null,
    text: '我练的是北冥神功。',
    tone: '陈述',
    chapter: 1,
    line_start: 1,
    line_end: 1,
    event_id: 'event_zhu_jue_shuo_ming_suo_xue',
    selection_type: 'both',
    selection_reason: '推动事件并体现人物坦率自信',
    trait_tags: ['坦率', '自信'],
    context: sourceText,
    context_line_start: 1,
    context_line_end: 1
  };
  const chapterSummary = {
    chapter: 1,
    title: '第一章',
    summary: '主角主动说明自己正在修习北冥神功，交代了本章唯一的武学信息。',
    key_events: ['主角说明所学'],
    key_characters: ['char_main'],
    source_refs: [sourceRef(sourceText)],
    field_source_refs: fieldRefs(sourceText, ['summary', 'key_events'])
  };

  return {
    'characters.json': [character],
    'factions.json': [],
    'locations.json': [],
    'skills.json': [skill],
    'techniques.json': [],
    'items.json': [],
    'dialogues.json': [dialogue],
    'chapter_summaries.json': [chapterSummary]
  };
}

module.exports = { buildCompleteData, fieldRefs, sourceRef };
