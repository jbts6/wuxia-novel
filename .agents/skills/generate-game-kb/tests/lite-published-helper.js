'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { stableHash } = require('../scripts/lib/accept');
const {
  acceptedArtifactHash,
  recordAcceptedArtifact
} = require('../scripts/lib/candidate-ledger');
const { buildBasicCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { readYaml } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { SEMANTIC_PROFILE } = require('../scripts/lib/semantic-contract');
const {
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft,
  writeStagingDraft
} = require('./helpers');

function pass(result, label) {
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function preparePublishedLiteRun(options = {}) {
  const name = options.name || '已发布轻量版试书';
  const runId = options.runId || 'run-published-lite';
  const source = options.source || (
    '第一章 起始\n甲乙丙丁同赴山门。甲修习玄门内功并使出飞云掌。\n'
    + '第二章 续行\n乙守在山口。\n'
    + '第三章 终局\n丙返回故里。\n'
  );
  const novel = makeNovel(name, source);
  const prepared = pass(runFlow(['lite-prepare', novel, '--run', runId, '--json']), 'prepare');
  const paths = pathsFor(novel, prepared.run_id);
  const manifest = readJson(paths.manifest);
  const firstChapter = options.firstChapter || {
    characters: ['甲', '乙', '丙', '丁'].map((character, index) => ({
      local_key: `character:${character}`,
      name: character,
      level: index === 0 ? '核心' : '重要',
      rank: '初窥门径',
      source_refs: [sourceRef(1, character)]
    }))
  };

  for (const chapter of manifest.chapters) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const chapterText = fs.readFileSync(chapter.file, 'utf8');
    const evidence = chapterText.split(/\r?\n/).slice(1).find(line => line.trim()) || chapter.title;
    const draft = validChapterDraft({
      chapter: chapter.number,
      title: chapter.title,
      source_hash: chapter.input_hash,
      ...(chapter.number === 1
        ? firstChapter
        : { characters: [], skills: [], items: [], factions: [] }),
      chapter_summary: {
        title: chapter.title,
        summary: `第${chapter.number}章摘要。`,
        source_refs: [sourceRef(chapter.number, evidence)]
      }
    });
    pass(runFlow([
      'lite-accept', novel, '--run', prepared.run_id, '--unit', unit,
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
  pass(runFlow(['lite-basic-curate', novel, '--run', prepared.run_id, '--skip', '--json']), 'skip curate');
  const published = pass(runFlow(['lite-publish', novel, '--run', prepared.run_id, '--json']), 'publish');
  return {
    archivedRun: path.join(novel, '_archive', 'generate-game-kb', prepared.run_id),
    novel,
    prepared,
    published
  };
}

module.exports = { pass, preparePublishedLiteRun };
