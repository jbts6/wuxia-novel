#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readJsonl } = require('./ledger');

const FINAL_FILES = {
  character: 'characters.json',
  faction: 'factions.json',
  location: 'locations.json',
  skill: 'skills.json',
  technique: 'techniques.json',
  item: 'items.json',
  dialogue: 'dialogues.json',
  chapter_summary: 'chapter_summaries.json'
};

const REVIEW_CATEGORIES = [
  'character', 'faction', 'location', 'skill', 'technique', 'item',
  'event', 'dialogue', 'chapter_summary'
];

const HUMAN_ACTIONS = [
  {
    id: 'accept',
    label: '接受本书',
    description: '审核包中的规模、边界项和抽样均符合当前规则。'
  },
  {
    id: 'rerun_recall',
    label: '扩大召回重跑',
    description: '候选或最终实体明显偏少，回到原文窗口重新扫描。'
  },
  {
    id: 'rerun_precision',
    label: '收紧筛选重跑',
    description: '正式库仍包含过多泛称、杂物或非实体记录。'
  },
  {
    id: 'manual_investigation',
    label: '人工定点调查',
    description: '只检查无法由 AI 自审解决的少量分类、归并或证据争议。'
  }
];

function loadJson(filename, fallback = null) {
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : fallback;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function finalCounts(novelDir) {
  const result = {};
  for (const [category, filename] of Object.entries(FINAL_FILES)) {
    const value = loadJson(path.join(novelDir, 'data', filename), []);
    result[category] = Array.isArray(value) ? value.length : 0;
  }
  const events = loadJson(path.join(novelDir, 'build', 'events.json'), []);
  result.event = Array.isArray(events) ? events.length : 0;
  return result;
}

function sourceScale(sourceIndex) {
  const chapters = Array.isArray(sourceIndex?.chapters) ? sourceIndex.chapters : [];
  const chapterCount = chapters.length;
  const lineCount = chapters.reduce((sum, chapter) => sum + Number(chapter.line_count ?? 0), 0);
  const windowCount = Array.isArray(sourceIndex?.windows) ? sourceIndex.windows.length : 0;

  return {
    chapter_count: chapterCount,
    line_count: lineCount,
    window_count: windowCount,
    scale: chapterCount >= 30 || lineCount >= 12000
      ? 'long'
      : chapterCount >= 10 || lineCount >= 3000
        ? 'medium'
        : 'short'
  };
}

function decisionIndex(decisions) {
  const result = new Map();
  for (const decision of decisions) {
    for (const id of decision.candidate_ids ?? []) result.set(id, decision);
  }
  return result;
}

function buildCategoryStats(candidates, decisions, finals) {
  const byCandidate = decisionIndex(decisions);

  return Object.fromEntries(REVIEW_CATEGORIES.map(category => {
    const categoryCandidates = candidates.filter(candidate => candidate.category_hint === category);
    const retained = categoryCandidates.filter(candidate => {
      const decision = byCandidate.get(candidate.candidate_id);
      return decision && decision.decision !== 'reject';
    }).length;
    const rejected = categoryCandidates.filter(candidate =>
      byCandidate.get(candidate.candidate_id)?.decision === 'reject'
    ).length;
    const unresolved = categoryCandidates.length - retained - rejected;

    return [category, {
      candidates: categoryCandidates.length,
      retained_candidates: retained,
      rejected_candidates: rejected,
      unresolved_candidates: unresolved,
      final_records: finals[category] ?? 0,
      candidate_retention_ratio: ratio(retained, categoryCandidates.length),
      finalization_ratio: ratio(finals[category] ?? 0, categoryCandidates.length)
    }];
  }));
}

function addAlert(alerts, id, severity, category, message, evidence, suggestedAction) {
  alerts.push({
    id,
    severity,
    category,
    message,
    evidence,
    suggested_action: suggestedAction
  });
}

function plausibilityAlerts(scale, stats) {
  const alerts = [];
  const martialCandidates = stats.skill.candidates + stats.technique.candidates;
  const martialRetained = stats.skill.retained_candidates + stats.technique.retained_candidates;
  const martialFinal = stats.skill.final_records + stats.technique.final_records;
  const itemCandidates = stats.item.candidates;
  const itemRetained = stats.item.retained_candidates;
  const itemFinal = stats.item.final_records;

  if (scale.scale === 'long' && martialFinal < 10) {
    addAlert(
      alerts,
      'long_martial_inventory_too_small',
      'blocking',
      'martial',
      '长篇小说的最终武功与招式总数少于 10，召回规模明显可疑。',
      { final_martial: martialFinal, candidate_martial: martialCandidates, ...scale },
      '回到 named-inventory 扩大武功与招式召回，再重做归并和 gap audit。'
    );
  } else if (scale.scale === 'long' && martialFinal < 20) {
    addAlert(
      alerts,
      'long_martial_inventory_low',
      'warning',
      'martial',
      '长篇小说的最终武功与招式总数低于动态合理性观察线。',
      { final_martial: martialFinal, candidate_martial: martialCandidates, ...scale },
      '重点复核未命中的具名武学信号和各章武学候选分布。'
    );
  }

  if (scale.scale === 'long' && itemFinal < 5) {
    addAlert(
      alerts,
      'long_item_inventory_too_small',
      'blocking',
      'item',
      '长篇小说的最终物品少于 5，剧情物品召回规模明显可疑。',
      { final_items: itemFinal, candidate_items: itemCandidates, ...scale },
      '回到 named-inventory 重扫兵器、药物、信物、秘籍、钥匙和剧情链条物品。'
    );
  } else if (scale.scale === 'long' && itemFinal < 8) {
    addAlert(
      alerts,
      'long_item_inventory_low',
      'warning',
      'item',
      '长篇小说的最终物品数量偏低，需要检查是否漏掉剧情关键物品。',
      { final_items: itemFinal, candidate_items: itemCandidates, ...scale },
      '检查候选分布和被 reject 的剧情关键物品。'
    );
  }

  const martialRetention = ratio(martialRetained, martialCandidates);
  if (martialCandidates >= 20 && martialRetention !== null && martialRetention < 0.1) {
    addAlert(
      alerts,
      'martial_candidate_retention_collapse',
      'blocking',
      'martial',
      '武功与招式候选保留率低于 10%，AI 初筛可能过度删除。',
      {
        candidates: martialCandidates,
        retained_candidates: martialRetained,
        retention_ratio: martialRetention
      },
      '复审 martial reject 决定；不得用重要性删除具名武功或招式。'
    );
  }

  const itemRetention = ratio(itemRetained, itemCandidates);
  if (itemCandidates >= 20 && itemRetention !== null && itemRetention < 0.1) {
    addAlert(
      alerts,
      'item_candidate_retention_collapse',
      'blocking',
      'item',
      '物品候选保留率低于 10%，AI 初筛可能把剧情物品与杂物一起过度删除。',
      {
        candidates: itemCandidates,
        retained_candidates: itemRetained,
        retention_ratio: itemRetention
      },
      '复审 item reject 决定，区分普通杂物与推动剧情、体现人物或武学相关的物品。'
    );
  }

  return alerts;
}

function stableKey(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function compactCandidate(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    category: candidate.category_hint,
    name: candidate.name,
    chapter: candidate.chapter,
    window_id: candidate.window_id,
    discovery_pass: candidate.discovery_pass,
    source_ref: candidate.source_ref
  };
}

function decisionRows(candidates, decisions) {
  const candidatesById = new Map(candidates.map(candidate => [candidate.candidate_id, candidate]));

  return decisions.map((decision, index) => {
    const linked = (decision.candidate_ids ?? [])
      .map(id => candidatesById.get(id))
      .filter(Boolean);
    const categories = [...new Set(linked.map(candidate => candidate.category_hint))];
    const names = [...new Set(linked.map(candidate => candidate.name).filter(Boolean))];
    const discoveryPasses = [...new Set(
      linked.map(candidate => candidate.discovery_pass).filter(Boolean)
    )];
    const riskReasons = [];
    let riskScore = 0;

    if (decision.decision === 'redirect') {
      riskScore += 4;
      riskReasons.push('redirect 决定需要确认类别边界');
    }
    if (categories.length > 1 || categories.some(category =>
      decision.final_category && decision.final_category !== category
    )) {
      riskScore += 4;
      riskReasons.push('候选类别与最终类别存在冲突');
    }
    if (decision.decision === 'reject' && categories.some(category =>
      ['skill', 'technique'].includes(category)
    )) {
      riskScore += 5;
      riskReasons.push('具名武学候选被 reject');
    }
    if (decision.decision === 'reject' && categories.includes('item') &&
        ['trivial', 'non_major'].includes(decision.reason)) {
      riskScore += 4;
      riskReasons.push('物品因重要性被 reject');
    }
    if (discoveryPasses.includes('gap-audit')) {
      riskScore += 3;
      riskReasons.push('独立查漏轮发现的候选');
    }
    if (names.some(name => [...name].length <= 2)) {
      riskScore += 2;
      riskReasons.push('短名称容易发生泛称或错误归并');
    }
    if ((decision.candidate_ids ?? []).length >= 5) {
      riskScore += 1;
      riskReasons.push('大量候选合并到同一决定');
    }

    const aiReviewStatus = decision.ai_review?.status ?? null;
    if (aiReviewStatus === 'needs_human') {
      riskScore += 5;
      riskReasons.push('AI 自审明确要求人工裁决');
    } else if (['confirmed', 'revised'].includes(aiReviewStatus)) {
      riskScore = Math.max(0, riskScore - 4);
      riskReasons.push('AI 自审已复核');
    }

    return {
      id: 'decision_' + String(index + 1).padStart(5, '0'),
      decision: decision.decision,
      reason: decision.reason ?? null,
      canonical_name: decision.canonical_name ?? names[0] ?? null,
      final_category: decision.final_category ?? categories[0] ?? null,
      final_id: decision.final_id ?? null,
      ai_review: decision.ai_review ?? null,
      risk_score: riskScore,
      risk_reasons: riskReasons,
      candidates: linked.map(compactCandidate)
    };
  });
}

function stableSample(rows, count, excludedIds) {
  return rows
    .filter(row => !excludedIds.has(row.id))
    .sort((left, right) => stableKey(left.id).localeCompare(stableKey(right.id)))
    .slice(0, count);
}

function hardGateFailures(qualityReport) {
  return Object.entries(qualityReport?.gates ?? {}).flatMap(([gateId, gate]) =>
    gate?.passed ? [] : [{
      gate_id: gateId,
      reasons: Array.isArray(gate?.reasons) ? gate.reasons : ['gate failed without details']
    }]
  );
}

function buildReviewPacket(novelDir, options = {}) {
  const buildDir = path.join(novelDir, 'build');
  const sourceIndex = loadJson(path.join(buildDir, 'source-index.json'), {});
  const candidates = readJsonl(path.join(buildDir, 'candidates.jsonl'), { optional: true });
  const decisions = readJsonl(path.join(buildDir, 'decisions.jsonl'), { optional: true });
  const qualityReport = options.qualityReport ??
    loadJson(path.join(novelDir, 'reports', 'quality_report.json'), {});
  const scale = sourceScale(sourceIndex);
  const stats = buildCategoryStats(candidates, decisions, finalCounts(novelDir));
  const alerts = plausibilityAlerts(scale, stats);
  const rows = decisionRows(candidates, decisions);
  const allHighRisk = rows
    .filter(row => row.risk_score >= 5)
    .sort((left, right) => right.risk_score - left.risk_score || left.id.localeCompare(right.id));
  const highRisk = allHighRisk.slice(0, 10);

  if (allHighRisk.length > highRisk.length) {
    addAlert(
      alerts,
      'human_review_queue_too_large',
      'blocking',
      'review',
      '待人工裁决的高风险项超过 10 个，AI 尚未把问题压缩到适合人工审核的规模。',
      { high_risk_total: allHighRisk.length, packet_limit: highRisk.length },
      '先执行一次 AI 高风险自审，并在 decisions.jsonl 写入结构化 ai_review 结果。'
    );
  }

  const failures = hardGateFailures(qualityReport);
  const blockingAlerts = alerts.filter(alert => alert.severity === 'blocking');
  const status = qualityReport?.completion_gate_passed !== true || failures.length
    ? 'blocked'
    : blockingAlerts.length
      ? 'needs_ai_rerun'
      : 'ready_for_human_review';
  const highRiskIds = new Set(allHighRisk.map(row => row.id));
  const retainedRows = rows.filter(row => row.decision !== 'reject');
  const rejectedRows = rows.filter(row => row.decision === 'reject');
  const novel = sourceIndex.novel || path.basename(novelDir);
  const sourceHash = sourceIndex.source_hash ?? null;

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    novel,
    source_hash: sourceHash,
    review_id: novel + ':' + String(sourceHash ?? 'no-source').slice(0, 12),
    review_readiness: {
      status,
      quantity_is_completion_proof: false,
      hard_gate_failures: failures,
      blocking_alert_count: blockingAlerts.length,
      warning_count: alerts.filter(alert => alert.severity === 'warning').length,
      high_risk_total: allHighRisk.length,
      message: status === 'ready_for_human_review'
        ? 'AI 自筛和自动检查已完成，可以进行短人工审核。'
        : status === 'needs_ai_rerun'
          ? 'G1-G5 已通过，但召回规模或高风险队列仍异常，AI 必须先返工。'
          : 'G1-G5 尚未通过，不应进入人工终审。'
    },
    source_scale: scale,
    category_stats: stats,
    plausibility_alerts: alerts,
    high_risk_decisions: highRisk,
    high_risk_omitted: Math.max(0, allHighRisk.length - highRisk.length),
    deterministic_samples: {
      retained: stableSample(retainedRows, 3, highRiskIds),
      rejected: stableSample(rejectedRows, 3, highRiskIds)
    },
    semantic_summary: qualityReport?.gates?.G5?.details?.counts ?? null,
    actions: HUMAN_ACTIONS
  };
}

function renderDecision(row) {
  const name = row.canonical_name || row.candidates[0]?.name || row.id;
  const review = row.ai_review?.status ? '，AI 自审：' + row.ai_review.status : '';
  return '- ' + name + '：' + row.decision +
    (row.reason ? ' / ' + row.reason : '') + review;
}

function renderReviewPacketMarkdown(packet) {
  const lines = [
    '# ' + packet.novel + ' 人工审核包',
    '',
    '- 审核状态：**' + packet.review_readiness.status + '**',
    '- Source hash：' + (packet.source_hash ?? 'missing'),
    '- 原文规模：' + packet.source_scale.chapter_count + ' 章，' +
      packet.source_scale.line_count + ' 行，' + packet.source_scale.window_count + ' 个窗口',
    '- 数量只作召回异常报警：是',
    '',
    '## 类别漏斗',
    '',
    '| 类别 | 候选 | 保留候选 | 拒绝候选 | 未决 | 最终 | 保留率 |',
    '|---|---:|---:|---:|---:|---:|---:|'
  ];

  for (const category of REVIEW_CATEGORIES) {
    const item = packet.category_stats[category];
    const retention = item.candidate_retention_ratio === null
      ? '-'
      : (item.candidate_retention_ratio * 100).toFixed(1) + '%';
    lines.push(
      '| ' + category + ' | ' + item.candidates + ' | ' + item.retained_candidates +
      ' | ' + item.rejected_candidates + ' | ' + item.unresolved_candidates +
      ' | ' + item.final_records + ' | ' + retention + ' |'
    );
  }

  lines.push('', '## 自动异常', '');
  if (packet.plausibility_alerts.length === 0) lines.push('- 无。');
  else packet.plausibility_alerts.forEach(alert => {
    lines.push('- [' + alert.severity + '] ' + alert.message);
    lines.push('  - AI 下一步：' + alert.suggested_action);
  });

  lines.push('', '## 最高风险裁决', '');
  if (packet.high_risk_decisions.length === 0) lines.push('- 无。');
  else packet.high_risk_decisions.forEach(row => lines.push(renderDecision(row)));
  if (packet.high_risk_omitted > 0) {
    lines.push(
      '- 另有 ' + packet.high_risk_omitted +
      ' 项未展示；AI 必须先自审压缩，不能直接交给人工。'
    );
  }

  lines.push('', '## 确定性抽样', '', '### 保留侧', '');
  if (packet.deterministic_samples.retained.length === 0) lines.push('- 无。');
  else packet.deterministic_samples.retained.forEach(row => lines.push(renderDecision(row)));
  lines.push('', '### 拒绝侧', '');
  if (packet.deterministic_samples.rejected.length === 0) lines.push('- 无。');
  else packet.deterministic_samples.rejected.forEach(row => lines.push(renderDecision(row)));

  lines.push('', '## 人工动作', '');
  packet.actions.forEach(action => lines.push('- ' + action.id + '：' + action.description));
  lines.push('');
  return lines.join('\n');
}

function writeReviewPacket(novelDir, packet) {
  const reportsDir = path.join(novelDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, 'review_packet.json'),
    JSON.stringify(packet, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(reportsDir, 'review_packet.md'),
    renderReviewPacketMarkdown(packet) + '\n'
  );
}

module.exports = {
  HUMAN_ACTIONS,
  REVIEW_CATEGORIES,
  buildCategoryStats,
  buildReviewPacket,
  decisionRows,
  plausibilityAlerts,
  renderReviewPacketMarkdown,
  sourceScale,
  writeReviewPacket
};
