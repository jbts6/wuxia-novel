'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { assembleRun } = require('../scripts/lib/assemble');
const { ensureAcceptedArtifact, initializeArtifactManifest } = require('../scripts/lib/candidate-ledger');
const { atomicWriteJson, readJson } = require('../scripts/lib/io');
const { pathsFor } = require('../scripts/lib/paths');
const { SEMANTIC_CONTRACT_VERSION, SEMANTIC_PROFILE } = require('../scripts/lib/run');

function acceptedChapter(number) {
  const text = `第${number}章证据。`;
  const ref = { chapter: number, text };
  return {
    schema_version: 7,
    chapter: number,
    title: `第${number}章`,
    source_hash: `sha256:chapter-${number}`,
    characters: [{
      local_key: `character:甲${number}`, name: `甲${number}`, aliases: [], identities: ['侠客'],
      level: number === 1 ? '核心' : '重要', rank: '初窥门径', description: `甲${number}行走江湖。`,
      factions: [`faction:玄门${number}`], skills: [`skill:玄门内功${number}`], source_refs: [ref]
    }],
    skills: [{
      local_key: `skill:玄门内功${number}`, name: `玄门内功${number}`, aliases: [], types: ['内功'],
      factions: [`faction:玄门${number}`], rank: '初窥门径', description: '调息养气。',
      techniques: [{ name: `飞云掌${number}`, description: '掌势迅疾。' }], source_refs: [ref]
    }],
    items: [{
      local_key: `item:回生丹${number}`, name: `回生丹${number}`, aliases: [], types: ['丹药'],
      description: '用于救治重伤。', source_refs: [ref]
    }],
    factions: [{
      local_key: `faction:玄门${number}`, name: `玄门${number}`, aliases: [], types: ['门派'],
      description: '隐居山中。', source_refs: [ref]
    }],
    chapter_summary: { summary: `第${number}章摘要。`, source_refs: [ref] },
    normalizations: []
  };
}

function createV7Workspace(options = {}) {
  const novel = fs.mkdtempSync(path.join(os.tmpdir(), options.prefix || 'game-kb-v7-workspace-'));
  const runId = options.runId || 'run-v7-fixture';
  const paths = pathsFor(novel, runId);
  const chapterCount = options.chapterCount || 1;
  const sourceHash = `sha256:${'a'.repeat(64)}`;
  fs.mkdirSync(paths.run, { recursive: true });
  fs.writeFileSync(path.join(novel, '试书.txt'), '第一章\n第1章证据。\n', 'utf8');

  const chapters = Array.from({ length: chapterCount }, (_, index) => {
    const number = index + 1;
    return {
      number,
      title: `第${number}章`,
      input_hash: `sha256:chapter-${number}`,
      file: path.join(paths.sourceChapters, `chapter_${String(number).padStart(3, '0')}.txt`)
    };
  });
  atomicWriteJson(paths.runJson, {
    run_id: runId,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    accepted_serialization: 'yaml-v1',
    deep: false,
    status: 'active',
    source_hash: sourceHash,
    created_at: '2026-07-22T00:00:00.000Z'
  });
  atomicWriteJson(paths.manifest, { source_hash: sourceHash, chapters });
  initializeArtifactManifest(paths);
  for (const chapter of chapters) {
    const value = acceptedChapter(chapter.number);
    ensureAcceptedArtifact(
      paths,
      path.join(paths.chapters, `chapter_${String(chapter.number).padStart(3, '0')}.yaml`),
      chapter.input_hash,
      value,
      { acceptedAt: '2026-07-22T00:00:01.000Z' }
    );
  }
  atomicWriteJson(paths.manualReview, []);
  atomicWriteJson(paths.progress, {
    schema_version: 1,
    active_units: [],
    units: Object.fromEntries(chapters.map(chapter => [
      `chapter:${String(chapter.number).padStart(3, '0')}`,
      { status: 'accepted', attempt: 1, cycle: 1 }
    ]))
  });
  assembleRun({ paths });
  return { novel, runId, paths, manifest: readJson(paths.manifest) };
}

module.exports = { acceptedChapter, createV7Workspace };
