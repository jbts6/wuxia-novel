#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const CATEGORIES = new Set([
  'character', 'faction', 'location', 'skill', 'technique', 'item',
  'event', 'dialogue', 'chapter_summary'
]);
const DISCOVERY_PASSES = new Set(['named-inventory', 'event-dialogue', 'gap-audit']);
const DECISIONS = new Set(['keep', 'merge', 'redirect', 'reject']);
const REJECT_REASONS = new Set([
  'duplicate', 'generic_unnamed', 'not_an_entity', 'not_source_grounded',
  'trivial', 'non_major'
]);
const MARTIAL_CATEGORIES = new Set(['skill', 'technique']);
const MARTIAL_IMPORTANCE_REJECTIONS = new Set(['trivial', 'non_major']);
const AI_REVIEW_STATUSES = new Set(['confirmed', 'revised', 'needs_human']);

function parseJsonl(content, label = 'JSONL') {
  return String(content ?? '').split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch (error) {
      throw new Error(`${label} line ${index + 1}: ${error.message}`);
    }
  });
}

function readJsonl(filename, options = {}) {
  if (!fs.existsSync(filename)) {
    if (options.optional) return [];
    throw new Error(`Missing JSONL file: ${filename}`);
  }
  return parseJsonl(fs.readFileSync(filename, 'utf8'), filename);
}

function validateCandidate(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') return ['candidate must be an object'];
  if (!/^cand_ch\d+_w\d+_\d+$/i.test(candidate.candidate_id ?? '')) {
    errors.push('candidate_id must match cand_chNNN_wNNN_NNNN');
  }
  if (!CATEGORIES.has(candidate.category_hint)) {
    errors.push(`invalid category_hint: ${candidate.category_hint}`);
  }
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) errors.push('name is required');
  if (!Number.isInteger(candidate.chapter) || candidate.chapter < 1) {
    errors.push('chapter must be a positive integer');
  }
  if (!candidate.window_id || typeof candidate.window_id !== 'string') {
    errors.push('window_id is required');
  }
  if (!DISCOVERY_PASSES.has(candidate.discovery_pass)) {
    errors.push(`invalid discovery_pass: ${candidate.discovery_pass}`);
  }
  const ref = candidate.source_ref;
  if (!ref || !Number.isInteger(ref.line_start) || !Number.isInteger(ref.line_end) ||
      ref.line_start < 1 || ref.line_end < ref.line_start || !String(ref.text ?? '').trim()) {
    errors.push('source_ref requires valid line_start, line_end, and text');
  }
  return errors;
}

function deduplicateCandidateOccurrences(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const ref = candidate.source_ref ?? {};
    const key = [
      candidate.category_hint,
      candidate.name,
      candidate.chapter,
      ref.line_start,
      ref.line_end,
      ref.text
    ].join('\u0000');
    if (!groups.has(key)) {
      groups.set(key, {
        category_hint: candidate.category_hint,
        name: candidate.name,
        chapter: candidate.chapter,
        candidate_ids: [],
        occurrences: [],
        discovery_passes: []
      });
    }
    const group = groups.get(key);
    group.candidate_ids.push(candidate.candidate_id);
    group.occurrences.push({
      candidate_id: candidate.candidate_id,
      window_id: candidate.window_id,
      discovery_pass: candidate.discovery_pass,
      source_ref: candidate.source_ref
    });
    if (!group.discovery_passes.includes(candidate.discovery_pass)) {
      group.discovery_passes.push(candidate.discovery_pass);
    }
  }
  for (const group of groups.values()) group.discovery_passes.sort();
  return [...groups.values()];
}

function validateDecision(decision) {
  const errors = [];
  if (!decision || typeof decision !== 'object') return ['decision must be an object'];
  if (!Array.isArray(decision.candidate_ids) || decision.candidate_ids.length === 0 ||
      decision.candidate_ids.some(id => typeof id !== 'string' || !id)) {
    errors.push('candidate_ids must be a non-empty string array');
  }
  if (!DECISIONS.has(decision.decision)) errors.push(`invalid decision: ${decision.decision}`);
  if (decision.decision === 'reject') {
    if (!REJECT_REASONS.has(decision.reason)) errors.push(`invalid reject reason: ${decision.reason}`);
  } else {
    if (typeof decision.canonical_name !== 'string' || !decision.canonical_name.trim()) {
      errors.push(`${decision.decision} decision requires canonical_name`);
    }
    if (typeof decision.importance !== 'string' || !decision.importance.trim()) {
      errors.push(`${decision.decision} decision requires importance`);
    }
    if (typeof decision.reason !== 'string' || !decision.reason.trim()) {
      errors.push(`${decision.decision} decision requires reason`);
    }
    if (!decision.final_id || typeof decision.final_id !== 'string') {
      errors.push(`${decision.decision} decision requires final_id`);
    }
    if (!CATEGORIES.has(decision.final_category)) {
      errors.push(`invalid final_category: ${decision.final_category}`);
    }
  }
  if (decision.ai_review !== undefined) {
    if (!decision.ai_review || typeof decision.ai_review !== 'object' ||
        Array.isArray(decision.ai_review)) {
      errors.push('ai_review must be an object when provided');
    } else if (!AI_REVIEW_STATUSES.has(decision.ai_review.status)) {
      errors.push(`invalid ai_review.status: ${decision.ai_review.status}`);
    }
  }
  return errors;
}

function validateLedgerClosure(candidates, decisions, options = {}) {
  const errors = [];
  const candidateById = new Map();
  const decisionsByCandidate = new Map();

  for (const candidate of candidates) {
    const candidateErrors = validateCandidate(candidate);
    candidateErrors.forEach(error => errors.push(`${candidate.candidate_id ?? '<unknown>'}: ${error}`));
    if (candidateById.has(candidate.candidate_id)) {
      errors.push(`duplicate candidate_id: ${candidate.candidate_id}`);
    }
    candidateById.set(candidate.candidate_id, candidate);
  }

  for (const decision of decisions) {
    const decisionErrors = validateDecision(decision);
    decisionErrors.forEach(error => errors.push(`${decision.candidate_ids?.join(',') ?? '<unknown>'}: ${error}`));
    for (const candidateId of decision.candidate_ids ?? []) {
      if (!candidateById.has(candidateId)) errors.push(`decision references unknown candidate: ${candidateId}`);
      if (decisionsByCandidate.has(candidateId)) errors.push(`candidate has multiple decisions: ${candidateId}`);
      decisionsByCandidate.set(candidateId, decision);
    }
  }

  const unresolved = [...candidateById.keys()].filter(id => !decisionsByCandidate.has(id)).sort();
  for (const candidateId of unresolved) errors.push(`unresolved candidate: ${candidateId}`);

  for (const [candidateId, decision] of decisionsByCandidate) {
    const candidate = candidateById.get(candidateId);
    if (!candidate) continue;
    if (decision.decision === 'reject' && MARTIAL_CATEGORIES.has(candidate.category_hint) &&
        MARTIAL_IMPORTANCE_REJECTIONS.has(decision.reason)) {
      errors.push(`${candidateId}: named ${candidate.category_hint} cannot be rejected as ${decision.reason}`);
    }
    if (decision.decision !== 'reject' && options.finalIds && !options.finalIds.has(decision.final_id)) {
      errors.push(`${candidateId}: final_id does not exist: ${decision.final_id}`);
    }
  }

  return {
    passed: errors.length === 0,
    candidate_count: candidates.length,
    decision_count: decisions.length,
    unresolved_candidate_ids: unresolved,
    errors
  };
}

module.exports = {
  AI_REVIEW_STATUSES,
  CATEGORIES,
  DECISIONS,
  DISCOVERY_PASSES,
  REJECT_REASONS,
  deduplicateCandidateOccurrences,
  parseJsonl,
  readJsonl,
  validateCandidate,
  validateDecision,
  validateLedgerClosure
};
