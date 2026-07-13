#!/usr/bin/env node
'use strict';

const { sha256, stableStringify } = require('./atomic-json');

const PROVISIONAL_CATEGORIES = new Set([
  'character', 'faction', 'location', 'skill', 'technique', 'item', 'event', 'dialogue'
]);
const DECISIONS = new Set(['keep', 'merge', 'redirect', 'reject']);
const REJECT_REASONS = new Set([
  'duplicate', 'generic_unnamed', 'not_an_entity', 'not_source_grounded',
  'trivial', 'non_major'
]);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);

function contentToken(value) {
  return sha256(typeof value === 'string' ? value : stableStringify(value)).slice(0, 16);
}

function provisionalKey(category, seed) {
  if (!PROVISIONAL_CATEGORIES.has(category)) return null;
  const token = contentToken({ category, seed });
  if (category === 'event') return `event_key_${token}`;
  if (category === 'dialogue') return `dialogue_key_${token}`;
  return `entity_${category}_${token}`;
}

function clusterId(candidates, round = 0) {
  return `cluster_${contentToken({
    round,
    candidates: candidates.map(candidate => candidate.candidate_id).sort()
  })}`;
}

function decisionId(cluster) {
  return `decision_${contentToken(cluster)}`;
}

function signalSeed(name, candidateIds) {
  return `signal_${contentToken({ name: String(name).trim(), candidate_ids: [...candidateIds].sort() })}`;
}

module.exports = {
  DECISIONS,
  PROVISIONAL_CATEGORIES,
  REJECT_REASONS,
  RISK_LEVELS,
  clusterId,
  contentToken,
  decisionId,
  provisionalKey,
  signalSeed
};
