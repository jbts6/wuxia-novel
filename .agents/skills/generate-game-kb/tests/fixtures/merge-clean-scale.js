'use strict';

function candidateKey(index, category = 'characters') {
  const chapter = String((index % 20) + 1).padStart(3, '0');
  return `ch${chapter}:${category}:candidate:${String(index).padStart(4, '0')}`;
}

function scaleCandidates(count = 1089, category = 'characters') {
  return Array.from({ length: count }, (_, index) => ({
    candidate_key: candidateKey(index, category),
    local_key: `candidate:${index}`,
    name: `候选${index}`,
    ...(category === 'characters' || category === 'skills' ? { power_rank: '平平无奇' } : {}),
    source_refs: [{ chapter: (index % 20) + 1, text: `证据${index}` }]
  }));
}

function mappedCandidateKeys(count = 420, category = 'techniques') {
  return scaleCandidates(count, category).map(candidate => candidate.candidate_key);
}

module.exports = { candidateKey, mappedCandidateKeys, scaleCandidates };
