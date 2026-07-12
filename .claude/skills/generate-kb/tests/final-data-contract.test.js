#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  FINAL_DATA_FILES,
  computeFinalDataHash,
  validateFinalData
} = require('../scripts/lib/final-data-contract');
const { buildCompleteData } = require('./helpers/final-data-fixture');
const validateFinalDataScript = path.join(__dirname, '..', 'scripts', 'validate-final-data.js');

function writeData(novelDir, data) {
  const dataDir = path.join(novelDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  for (const [filename, records] of Object.entries(data)) {
    fs.writeFileSync(path.join(dataDir, filename), `${JSON.stringify(records, null, 2)}\n`);
  }
}

function withNovel(run) {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-contract-'));
  try {
    writeData(novelDir, buildCompleteData());
    return run(novelDir);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
}

describe('final data contract', () => {
  it('accepts a structurally complete minimal knowledge base', () => withNovel(novelDir => {
    const result = validateFinalData(novelDir);
    assert.deepEqual(result.missing_data_files, []);
    assert.deepEqual(result.invalid_data_files, []);
    assert.deepEqual(result.schema_errors, []);
    assert.deepEqual(result.enrichment_errors, []);
    assert.equal(typeof result.final_data_hash, 'string');
    assert.equal(result.final_data_hash.length, 64);
    assert.deepEqual(Object.keys(result.records_by_file), FINAL_DATA_FILES);
  }));

  it('rejects skeleton records instead of passing an empty enrichment check', () => withNovel(novelDir => {
    fs.writeFileSync(
      path.join(novelDir, 'data', 'characters.json'),
      `${JSON.stringify([{ id: 'char_main', name: '主角', source_refs: [] }], null, 2)}\n`
    );
    const result = validateFinalData(novelDir);
    assert.ok(result.schema_errors.some(error => error.includes('characters.json/char_main.alias')));
    assert.ok(result.schema_errors.some(error => error.includes('characters.json/char_main.importance')));
    assert.ok(result.enrichment_errors.some(error => error.includes('characters.json/char_main.one_line')));
  }));

  it('rejects Chinese IDs and accepts the canonical lowercase pinyin form', () => withNovel(novelDir => {
    const charactersPath = path.join(novelDir, 'data', 'characters.json');
    const dialoguesPath = path.join(novelDir, 'data', 'dialogues.json');
    const summariesPath = path.join(novelDir, 'data', 'chapter_summaries.json');
    const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));
    const dialogues = JSON.parse(fs.readFileSync(dialoguesPath, 'utf8'));
    const summaries = JSON.parse(fs.readFileSync(summariesPath, 'utf8'));

    characters[0].id = 'char_左子穆';
    fs.writeFileSync(charactersPath, `${JSON.stringify(characters, null, 2)}\n`);
    const invalid = validateFinalData(novelDir);
    assert.ok(invalid.schema_errors.some(error =>
      error.includes('invalid character ID') && error.includes('char_左子穆')
    ));

    characters[0].id = 'char_zuo_zi_mu';
    dialogues[0].speaker = 'char_zuo_zi_mu';
    summaries[0].key_characters = ['char_zuo_zi_mu'];
    fs.writeFileSync(charactersPath, `${JSON.stringify(characters, null, 2)}\n`);
    fs.writeFileSync(dialoguesPath, `${JSON.stringify(dialogues, null, 2)}\n`);
    fs.writeFileSync(summariesPath, `${JSON.stringify(summaries, null, 2)}\n`);

    const valid = validateFinalData(novelDir);
    assert.deepEqual(valid.schema_errors, []);
  }));

  it('rejects wrong-prefix and dangling ID references', () => withNovel(novelDir => {
    const charactersPath = path.join(novelDir, 'data', 'characters.json');
    const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));
    characters[0].known_skills = ['char_main'];
    characters[0].related_skills = ['skill_bu_cun_zai'];
    fs.writeFileSync(charactersPath, `${JSON.stringify(characters, null, 2)}\n`);

    const result = validateFinalData(novelDir);
    assert.ok(result.schema_errors.some(error =>
      error.includes('known_skills[0]') && error.includes('invalid skill ID')
    ));
    assert.ok(result.schema_errors.some(error =>
      error.includes('related_skills[0]') && error.includes('unknown skill ID')
    ));
  }));

  it('rejects missing files, invalid enums, and empty required enrichment', () => withNovel(novelDir => {
    fs.unlinkSync(path.join(novelDir, 'data', 'items.json'));
    fs.writeFileSync(path.join(novelDir, 'data', 'locations.json'), '{}\n');
    const skillsPath = path.join(novelDir, 'data', 'skills.json');
    const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
    skills[0].type = '神奇武功';
    fs.writeFileSync(skillsPath, `${JSON.stringify(skills, null, 2)}\n`);
    const charactersPath = path.join(novelDir, 'data', 'characters.json');
    const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));
    characters[0].biography = '';
    fs.writeFileSync(charactersPath, `${JSON.stringify(characters, null, 2)}\n`);

    const result = validateFinalData(novelDir);
    assert.ok(result.missing_data_files.includes('items.json'));
    assert.ok(result.invalid_data_files.some(error => error.includes('locations.json')));
    assert.ok(result.schema_errors.some(error => error.includes('skills.json/skill_bei_ming.type')));
    assert.ok(result.enrichment_errors.some(error => error.includes('characters.json/char_main.biography')));
    assert.equal(result.final_data_hash, null);
  }));

  it('applies a non-vacuous record contract to every final category', () => {
    const skeletons = {
      'characters.json': { id: 'char_test', name: '人物', source_refs: [] },
      'factions.json': { id: 'faction_test', name: '门派', source_refs: [] },
      'locations.json': { id: 'loc_test', name: '地点', source_refs: [] },
      'skills.json': { id: 'skill_test', name: '武功', source_refs: [] },
      'techniques.json': { id: 'tech_test', name: '招式', source_refs: [] },
      'items.json': { id: 'item_test', name: '物品', source_refs: [] },
      'dialogues.json': { id: 'dialogue_test' },
      'chapter_summaries.json': { chapter: 1 }
    };

    for (const [filename, skeleton] of Object.entries(skeletons)) {
      withNovel(novelDir => {
        fs.writeFileSync(
          path.join(novelDir, 'data', filename),
          `${JSON.stringify([skeleton], null, 2)}\n`
        );
        const result = validateFinalData(novelDir);
        assert.ok(
          [...result.schema_errors, ...result.enrichment_errors]
            .some(error => error.startsWith(`${filename}/`)),
          `${filename} skeleton must fail its record contract`
        );
      });
    }
  });

  it('allows explicitly low-detail background characters without inventing biography', () => withNovel(novelDir => {
    const charactersPath = path.join(novelDir, 'data', 'characters.json');
    const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));
    characters[0].role = '背景';
    characters[0].importance = '背景';
    characters[0].biography = '';
    characters[0].personality = { traits: [], speech_style: '', temperament: '' };
    characters[0].field_source_refs = {
      identity: characters[0].field_source_refs.identity,
      one_line: characters[0].field_source_refs.one_line
    };
    fs.writeFileSync(charactersPath, `${JSON.stringify(characters, null, 2)}\n`);

    const result = validateFinalData(novelDir);
    assert.deepEqual(result.schema_errors, []);
    assert.deepEqual(result.enrichment_errors, []);
  }));

  it('changes the stable final-data hash when any final record changes', () => withNovel(novelDir => {
    const before = computeFinalDataHash(novelDir);
    const skillsPath = path.join(novelDir, 'data', 'skills.json');
    const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
    skills[0].one_line = '修改后的完整描述。';
    fs.writeFileSync(skillsPath, `${JSON.stringify(skills, null, 2)}\n`);
    const after = computeFinalDataHash(novelDir);
    assert.notEqual(after, before);
  }));

  it('exposes the contract as a failing CLI stage without writing in dry-run mode', () => withNovel(novelDir => {
    const valid = spawnSync(process.execPath, [validateFinalDataScript, novelDir, '--dry-run'], {
      encoding: 'utf8'
    });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /Final data contract: PASS/);
    assert.equal(fs.existsSync(path.join(novelDir, 'reports', 'final_data_validation.json')), false);

    fs.unlinkSync(path.join(novelDir, 'data', 'items.json'));
    const invalid = spawnSync(process.execPath, [validateFinalDataScript, novelDir, '--dry-run'], {
      encoding: 'utf8'
    });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stdout, /Final data contract: FAIL/);
    assert.match(invalid.stdout, /missing: items\.json/);
  }));
});
