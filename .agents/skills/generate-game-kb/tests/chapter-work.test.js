'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createProgress,
  transitionProgress,
  assertProgressInvariant
} = require('../scripts/lib/chapter-progress');
const {
  issueNextWindow,
  issueRetryJob,
  advanceChapterWork,
  activeJobMetadata
} = require('../scripts/lib/chapter-work');
const { stableHash } = require('../scripts/lib/io');
const { chapterAttemptPaths, pathsFor } = require('../scripts/lib/paths');
const {
  WORKER_CONTRACT_VERSION,
  createWorkerContract
} = require('../scripts/lib/chapter-worker-contract');
const {
  CHARACTER_LEVELS,
  POWER_RANK_CONTRACT,
  POWER_RANKS
} = require('../scripts/lib/semantic-contract');

function manifestWithChapters(count, root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-source-'))) {
  fs.mkdirSync(root, { recursive: true });
  const chapters = [];
  for (let number = 1; number <= count; number += 1) {
    const file = path.join(root, `chapter_${String(number).padStart(3, '0')}.txt`);
    fs.writeFileSync(file, `第${number}章\n甲在此章现身。\n`, 'utf8');
    chapters.push({
      number,
      title: `第${number}章`,
      file,
      input_hash: `sha256:chapter-${number}`
    });
  }
  return { chapters };
}

function temporaryRunPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kb-work-'));
  const novel = path.join(root, 'novel');
  fs.mkdirSync(novel, { recursive: true });
  const paths = pathsFor(novel, 'run-test');
  fs.mkdirSync(paths.run, { recursive: true });
  return paths;
}

function assertSelfContainedWorkerContract(contract, producer) {
  assert.equal(contract.version, 4);
  assert.equal(contract.output.format, 'yaml-single-document');
  assert.equal(contract.output.markdown_fences, false);
  assert.deepEqual(contract.output.top_level_fields, [
    'characters', 'skills', 'items', 'factions', 'chapter_summary'
  ]);
  for (const field of contract.output.top_level_fields) {
    assert.match(contract.output.yaml_skeleton, new RegExp(`^${field}:`, 'm'));
  }

  assert.deepEqual(contract.required_fields.characters, [
    'name', 'aliases', 'identities', 'level', 'rank', 'description',
    'factions', 'skills', 'source_refs'
  ]);
  assert.deepEqual(contract.required_fields.skills, [
    'name', 'aliases', 'types', 'factions', 'rank', 'description',
    'techniques', 'source_refs'
  ]);
  assert.deepEqual(contract.required_fields.skill_technique, ['name', 'description']);
  assert.deepEqual(contract.required_fields.items, [
    'name', 'aliases', 'types', 'description', 'source_refs'
  ]);
  assert.deepEqual(contract.required_fields.factions, [
    'name', 'aliases', 'types', 'description', 'source_refs'
  ]);
  assert.deepEqual(contract.required_fields.chapter_summary, ['summary', 'source_refs']);
  assert.deepEqual(contract.required_fields.source_ref, ['text']);
  assert.deepEqual(contract.optional_fields.source_ref, []);
  assert.deepEqual(contract.derived_fields.source_ref, ['chapter', 'line_start', 'line_end']);
  assert.doesNotMatch(contract.output.yaml_skeleton, /line_start|line_end/);

  assert.deepEqual(contract.controlled_fields.character_level.fields, ['characters[].level']);
  assert.deepEqual(contract.controlled_fields.character_level.allowed_values, CHARACTER_LEVELS);
  assert.equal(contract.controlled_fields.character_level.nullable, true);
  assert.match(contract.controlled_fields.character_level.meaning, /叙事重要度/);
  assert.equal(contract.controlled_fields.character_level.insufficient_evidence_action, 'null');
  assert.equal(contract.controlled_fields.character_level.invalid_value_action, 'reject');

  assert.deepEqual(contract.controlled_fields.power_rank.fields, [
    'characters[].rank', 'skills[].rank'
  ]);
  assert.deepEqual(contract.controlled_fields.power_rank.allowed_values, POWER_RANKS);
  assert.equal(contract.controlled_fields.power_rank.nullable, true);
  assert.deepEqual(contract.controlled_fields.power_rank.scale, POWER_RANK_CONTRACT.scale);
  assert.equal(
    contract.controlled_fields.power_rank.character_rule,
    POWER_RANK_CONTRACT.character_rule
  );
  assert.equal(contract.controlled_fields.power_rank.skill_rule, POWER_RANK_CONTRACT.skill_rule);
  assert.deepEqual(
    contract.controlled_fields.power_rank.evidence_priority,
    POWER_RANK_CONTRACT.evidence_priority
  );
  assert.deepEqual(contract.controlled_fields.power_rank.non_rank_examples, [
    '职位', '门派职务', '称号', '社会身份'
  ]);
  assert.match(contract.controlled_fields.power_rank.identity_rule, /identities/);
  assert.equal(contract.controlled_fields.power_rank.insufficient_evidence_action, 'null');
  assert.equal(contract.controlled_fields.power_rank.invalid_value_action, 'reject');

  for (const field of [
    'schema_version', 'chapter', 'title', 'source_hash', 'unit', 'cycle',
    'attempt', 'input_hash', 'output_file'
  ]) assert.ok(contract.forbidden_fields.top_level.includes(field), field);
  for (const field of ['id', 'local_key', 'candidate_key', 'type']) {
    assert.ok(contract.forbidden_fields.entity.includes(field), field);
  }

  assert.equal(contract.grounding.entity_name_check, 'chapter_text.includes(entity.name)');
  assert.equal(contract.grounding.technique_name_check, 'chapter_text.includes(technique.name)');
  assert.equal(contract.grounding.source_ref_text_check, 'chapter_text.includes(source_ref.text)');
  assert.equal(
    contract.grounding.entity_name_evidence_check,
    'entity.source_refs.some(source_ref => source_ref.text.includes(entity.name))'
  );
  assert.equal(
    contract.grounding.technique_name_evidence_check,
    'entity.source_refs.some(source_ref => source_ref.text.includes(technique.name))'
  );
  assert.equal(contract.grounding.name_miss_action, 'omit_candidate');
  assert.equal(contract.grounding.quote_miss_action, 'omit_source_ref');
  assert.equal(contract.grounding.allow_description_as_formal_name, false);
  assert.equal(contract.grounding.allow_quote_rewrite, false);
  assert.equal(contract.summary.non_empty_check, 'chapter_summary.summary.trim() !== ""');

  assert.equal(contract.taxonomy.mode, 'closed');
  assert.deepEqual(contract.taxonomy.fields, {
    'skills[].types': 'taxonomies.skills',
    'items[].types': 'taxonomies.items',
    'factions[].types': 'taxonomies.factions'
  });
  assert.equal(contract.taxonomy.unknown_value_action, 'do_not_guess');
  assert.deepEqual(contract.reference_closure.fields, {
    'characters[].skills': 'skills[].name',
    'characters[].factions': 'factions[].name',
    'skills[].factions': 'factions[].name'
  });
  assert.deepEqual(contract.reference_closure.match_priority, ['exact_name', 'unique_alias']);
  assert.equal(contract.reference_closure.canonical_name_precedence, true);
  assert.equal(contract.reference_closure.ambiguous_action, 'reject_relation');
  assert.equal(contract.reference_closure.unresolved_action, 'omit_relation_or_extract_grounded_candidate');

  for (const target of [
    'characters[]', 'skills[]', 'skills[].techniques[]', 'items[]',
    'factions[]', 'chapter_summary', '**.source_refs[]'
  ]) assert.ok(contract.preflight.recursive_targets.includes(target), target);
  for (const check of [
    'reread_output_yaml', 'single_document', 'exact_top_level_fields',
    'required_fields_recursive', 'forbidden_fields_recursive',
    'source_refs_recursive', 'non_empty_summary', 'controlled_rank_and_level_values',
    'positions_titles_and_social_roles_belong_in_identities'
  ]) assert.ok(contract.preflight.common.includes(check), check);
  assert.ok(Array.isArray(contract.preflight.producers[producer]));
  assert.ok(contract.preflight.producers[producer].length > 0);
}

describe('chapter-progress', () => {
  it('initializes the complete v7 unit state', () => {
    const progress = createProgress(manifestWithChapters(3));
    assert.equal(progress.schema_version, 7);
    assert.equal(progress.semantic_contract_version, 7);
    assert.deepEqual(progress.active_units, []);
    assert.deepEqual(progress.units['chapter:001'], {
      status: 'pending',
      cycle: 0,
      attempt: 0,
      producer: null,
      input_hash: null,
      input_file: null,
      output_file: null,
      output_hash: null,
      reject_reason: null,
      repair_allowed: false,
      errors: []
    });
  });

  it('keeps the whole fixed window until every unit is accepted', () => {
    const paths = temporaryRunPaths();
    const manifest = manifestWithChapters(2);
    const issued = issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
    let progress = transitionProgress(issued.progress, {
      type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one', manifest, paths
    });
    assert.deepEqual(progress.active_units, ['chapter:001', 'chapter:002']);
    progress = transitionProgress(progress, {
      type: 'accepted', unit: 'chapter:002', output_hash: 'sha256:two', manifest, paths
    });
    assert.deepEqual(progress.active_units, []);
  });

  it('rejects a later window while an earlier chapter is pending', () => {
    const manifest = manifestWithChapters(10);
    const progress = createProgress(manifest);
    progress.active_units = ['chapter:006'];
    progress.units['chapter:006'] = {
      status: 'active', cycle: 1, attempt: 1, producer: 'chapter-worker',
      input_hash: 'sha256:x', input_file: 'C:/outside/input.json',
      output_file: 'C:/outside/output.yaml', output_hash: null,
      reject_reason: null, repair_allowed: false, errors: []
    };
    assert.throws(
      () => assertProgressInvariant(progress, manifest),
      error => error.code === 'ACTIVE_WINDOW_INVALID'
    );
  });
});
describe('chapter-work', () => {
  let paths;
  let manifest;

  beforeEach(() => {
    paths = temporaryRunPaths();
    manifest = manifestWithChapters(25);
  });

  it('creates an isolated worker contract object for every job input', () => {
    const first = createWorkerContract();
    const second = createWorkerContract();
    assert.equal(WORKER_CONTRACT_VERSION, 4);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.preflight, second.preflight);
    assert.notStrictEqual(first.controlled_fields, second.controlled_fields);
    assert.notStrictEqual(
      first.controlled_fields.power_rank.allowed_values,
      second.controlled_fields.power_rank.allowed_values
    );
    assert.notStrictEqual(
      first.controlled_fields.power_rank.scale[0],
      second.controlled_fields.power_rank.scale[0]
    );
    first.preflight.common.push('mutated');
    first.controlled_fields.power_rank.allowed_values.push('伪造等级');
    assert.equal(second.preflight.common.includes('mutated'), false);
    assert.equal(second.controlled_fields.power_rank.allowed_values.includes('伪造等级'), false);
  });

  it('does not refill a partially completed five-unit window', () => {
    const first = issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
    assert.equal(first.jobs.length, 5);
    const acceptedOne = transitionProgress(first.progress, {
      type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one', manifest, paths
    });
    const second = issueNextWindow({ paths, manifest, progress: acceptedOne });
    assert.deepEqual(second.jobs, []);
    assert.deepEqual(second.progress.active_units, [
      'chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005'
    ]);
  });

  it('issues chapter six only after the first fixed window is accepted', () => {
    let progress = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    }).progress;
    for (let number = 1; number <= 5; number += 1) {
      const unit = `chapter:${String(number).padStart(3, '0')}`;
      progress = transitionProgress(progress, {
        type: 'accepted', unit, output_hash: `sha256:${unit}`, manifest, paths
      });
    }
    const second = issueNextWindow({ paths, manifest, progress });
    assert.equal(second.jobs.length, 5);
    assert.equal(second.jobs[0].unit, 'chapter:006');
  });

  it('returns stable public job metadata and writes immutable chapter input', () => {
    const issued = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    });
    const job = issued.jobs[0];
    assert.deepEqual(Object.keys(job).sort(), [
      'attempt', 'cycle', 'input_file', 'input_hash', 'output_file', 'producer', 'unit'
    ]);
    assert.equal(job.producer, 'chapter-worker');
    assert.equal(path.relative(paths.tasks, job.input_file).startsWith('..'), false);
    assert.equal(path.relative(paths.staging, job.output_file).startsWith('..'), false);
    const input = JSON.parse(fs.readFileSync(job.input_file, 'utf8'));
    assert.equal(input.chapter_text.includes('甲在此章现身'), true);
    assert.equal(input.output_file, job.output_file);
    assertSelfContainedWorkerContract(input.worker_contract, 'chapter-worker');
    assert.ok(input.worker_contract.preflight.producers['chapter-worker'].includes(
      'exact_names_and_quotes_in_chapter_text'
    ));
    assert.ok(input.worker_contract.preflight.producers['chapter-worker'].includes(
      'each_name_covered_by_own_source_refs'
    ));
    assert.ok(input.worker_contract.preflight.producers['chapter-worker'].includes(
      'all_relationship_names_resolve'
    ));
    assert.equal(job.input_hash, stableHash(input));
    assert.deepEqual(activeJobMetadata(paths, issued.progress)[0], { ...job, status: 'active' });
  });

  it('uses cycle and attempt in distinct task and staging paths', () => {
    const first = chapterAttemptPaths(paths, 'chapter:001', 1, 1);
    const secondAttempt = chapterAttemptPaths(paths, 'chapter:001', 1, 2);
    const secondCycle = chapterAttemptPaths(paths, 'chapter:001', 2, 1);
    assert.notEqual(first.input, secondAttempt.input);
    assert.notEqual(first.output, secondAttempt.output);
    assert.notEqual(first.input, secondCycle.input);
    assert.notEqual(first.output, secondCycle.output);
    assert.equal(path.relative(paths.tasks, first.input).startsWith('..'), false);
    assert.equal(path.relative(paths.staging, first.output).startsWith('..'), false);
  });

  it('keeps semantic retry on chapter-worker with the chapter source', () => {
    let progress = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'evidence', repair_allowed: false,
      errors: [{ code: 'SOURCE_REFS_REQUIRED' }], manifest, paths
    });
    const retry = issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' });
    assert.equal(retry.job.producer, 'chapter-worker');
    const input = JSON.parse(fs.readFileSync(retry.job.input_file, 'utf8'));
    assert.equal(typeof input.chapter_text, 'string');
    assert.deepEqual(input.previous_errors, [{ code: 'SOURCE_REFS_REQUIRED' }]);
  });

  it('isolates mechanical repair input from the novel source', () => {
    let progress = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'yaml_mechanical', repair_allowed: true,
      errors: [{ code: 'YAML_CODE_FENCE' }], manifest, paths
    });
    const retry = issueRetryJob({ paths, manifest, progress, unit: 'chapter:001' });
    assert.equal(retry.job.producer, 'main-agent-repair');
    const input = JSON.parse(fs.readFileSync(retry.job.input_file, 'utf8'));
    assert.deepEqual(input.allowed_repair_codes, ['YAML_CODE_FENCE']);
    for (const forbidden of ['chapter_text', 'source_file', 'source_hash', 'taxonomies']) {
      assert.equal(Object.hasOwn(input, forbidden), false, forbidden);
    }
    assert.equal(input.producer, 'main-agent-repair');
    assert.equal(input.output_file, retry.job.output_file);
    assertSelfContainedWorkerContract(input.worker_contract, 'main-agent-repair');
    assert.deepEqual(input.worker_contract.preflight.producers['main-agent-repair'], [
      'only_allowed_repair_codes',
      'preserve_all_semantic_content',
      'do_not_add_delete_or_rewrite_meaning'
    ]);
  });

  it('enters manual review after attempt two is rejected', () => {
    const smallManifest = manifestWithChapters(2);
    const smallPaths = temporaryRunPaths();
    let progress = issueNextWindow({
      paths: smallPaths, manifest: smallManifest, progress: createProgress(smallManifest)
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'bad', errors: [],
      repair_allowed: false, manifest: smallManifest, paths: smallPaths
    });
    progress = issueRetryJob({
      paths: smallPaths, manifest: smallManifest, progress, unit: 'chapter:001'
    }).progress;
    progress = transitionProgress(progress, {
      type: 'rejected', unit: 'chapter:001', reason: 'still bad', errors: [],
      repair_allowed: false, manifest: smallManifest, paths: smallPaths
    });
    const result = advanceChapterWork({ paths: smallPaths, manifest: smallManifest, progress });
    assert.equal(result.status, 'manual_review');
    assert.deepEqual(result.manual_review, ['chapter:001']);
  });

  it('returns ready-to-assemble only when all chapters are accepted', () => {
    const smallManifest = manifestWithChapters(2);
    const smallPaths = temporaryRunPaths();
    const issued = issueNextWindow({
      paths: smallPaths, manifest: smallManifest, progress: createProgress(smallManifest)
    });
    let progress = issued.progress;
    for (const job of issued.jobs) {
      progress = transitionProgress(progress, {
        type: 'accepted', unit: job.unit, output_hash: `sha256:${job.unit}`,
        manifest: smallManifest, paths: smallPaths
      });
    }
    assert.equal(
      advanceChapterWork({ paths: smallPaths, manifest: smallManifest, progress }).status,
      'ready-to-assemble'
    );
  });

  it('rejects tampered persisted job paths', () => {
    const issued = issueNextWindow({
      paths, manifest, progress: createProgress(manifest)
    });
    const tampered = structuredClone(issued.progress);
    tampered.units['chapter:001'].output_file = path.join(paths.run, '..', 'escape.yaml');
    assert.throws(
      () => assertProgressInvariant(tampered, manifest, paths),
      error => error.code === 'ACTIVE_WINDOW_INVALID'
    );
  });

  it('rejects a non-identical replay of an immutable job input', () => {
    issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
    const changedManifest = structuredClone(manifest);
    changedManifest.chapters[0].title = '被篡改的章标题';
    assert.throws(
      () => issueNextWindow({ paths, manifest: changedManifest, progress: createProgress(changedManifest) }),
      error => error.code === 'UNIT_ALREADY_ACTIVE'
    );
  });
});
