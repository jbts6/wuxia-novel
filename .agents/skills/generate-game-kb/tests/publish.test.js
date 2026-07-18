'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { stableHash } = require('../scripts/lib/accept');
const {
  acceptedArtifactHash,
  recordAcceptedArtifact
} = require('../scripts/lib/candidate-ledger');
const { buildBasicCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { readYaml } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { FINAL_FILES, SEMANTIC_PROFILE } = require('../scripts/lib/semantic-contract');
const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  writeStagingDraft
} = require('./helpers');

function pass(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function prepareGroundedRun() {
  const novel = makeNovel(
    '三章发布试书',
    '第一章 起始\n甲修习玄门内功并使出飞云掌。\n'
      + '第二章 续行\n乙守在山口。\n'
      + '第三章 终局\n丙返回故里。\n'
  );
  const prepared = pass(runFlow(['v5-prepare', novel, '--run', 'run-grounded-publish', '--json']), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  const chapterEvidence = new Map([
    [1, '甲修习玄门内功并使出飞云掌。'],
    [2, '乙守在山口。'],
    [3, '丙返回故里。']
  ]);

  for (const chapter of manifest.chapters) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const evidence = chapterEvidence.get(chapter.number);
    const draft = validChapterDraft({
      chapter: chapter.number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      ...(chapter.number === 1 ? {} : { characters: [], skills: [], items: [], factions: [] }),
      chapter_summary: {
        title: chapter.title,
        summary: `第${chapter.number}章摘要。`,
        source_refs: [sourceRef(chapter.number, evidence)]
      }
    });
    pass(runFlow([
      'v5-accept', novel, '--run', prepared.run_id, '--unit', unit,
      '--draft', writeStagingDraft(novel, unit, draft), '--json'
    ]), `accept ${unit}`);
  }

  const acceptedHashes = {};
  const chapters = manifest.chapters.map(chapter => {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = path.join(paths.chapters, `ch_${String(chapter.number).padStart(3, '0')}.yaml`);
    acceptedHashes[unit] = acceptedArtifactHash(paths, file);
    return readYaml(file);
  });
  const { registry } = buildBasicCandidateRegistry(chapters);
  recordAcceptedArtifact(paths, paths.candidateRegistry, stableHash({
    semantic_profile: SEMANTIC_PROFILE,
    accepted_hashes: acceptedHashes
  }), registry);
  pass(runFlow(['v5-basic-curate', novel, '--run', prepared.run_id, '--skip', '--json']), 'skip curate');
  return { novel, paths, prepared };
}

test('assembles three grounded chapters without domain artifacts when basic-curate is skipped', () => {
  const { novel, paths, prepared } = prepareGroundedRun();

  const assembled = runFlow(['v5-publish', novel, '--run', prepared.run_id, '--json']);

  assert.equal(assembled.status, 0, assembled.stderr);
  assert.deepEqual(fs.readdirSync(path.join(novel, 'data')).sort(), Object.values(FINAL_FILES).sort());
  assert.equal(fs.existsSync(path.join(novel, '_archive', 'generate-game-kb', prepared.run_id)), true);
  assert.equal(fs.existsSync(paths.domainWorkPlan), false);
});
