'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildBasicCandidateRegistry,
  isGenericActionDescription,
  normalizeCandidateName
} = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const { sourceRef, validChapterDraft } = require('./helpers');

function chapter(number, overrides = {}) {
  return normalizeChapterDraft(validChapterDraft({
    chapter: number,
    source_hash: `sha256:chapter-${number}`,
    title: `第${number}章`,
    characters: [],
    items: [],
    skills: [],
    factions: [],
    ...overrides
  }));
}

test('normalizes names with NFKC and conservative whitespace and punctuation rules', () => {
  assert.equal(normalizeCandidateName('  ＡＢＣ　心法  '), 'ABC 心法');
  assert.equal(normalizeCandidateName('胡家 ・ 刀法'), '胡家·刀法');
  assert.equal(normalizeCandidateName('回风—拂柳剑'), '回风-拂柳剑');
});

test('recognizes only the explicit strong generic-action family', () => {
  for (const name of ['挥手一击', '反手一掌', '随手一刀', '连发数拳']) {
    assert.equal(isGenericActionDescription(name), true, name);
  }
  for (const name of ['打狗棒法', '回风拂柳剑', '反手夺命剑', '挥袖清风']) {
    assert.equal(isGenericActionDescription(name), false, name);
  }
});

test('exact normalized names remain distinct and preserve grounded evidence independently', () => {
  const chapters = [
    chapter(2, {
      skills: [{
        local_key: 'skill:hu-dao-2',
        name: '胡家·刀法',
        types: ['刀法'],
        techniques: [
          { name: '飞沙走石', description: '刀势卷沙。' },
          { name: '回风拂柳剑' }
        ],
        source_refs: [sourceRef(2, '胡家刀法再现')]
      }]
    }),
    chapter(1, {
      skills: [{
        local_key: 'skill:hu-dao-1',
        name: ' 胡家 ・ 刀法 ',
        types: ['刀法'],
        techniques: [
          { name: '飞沙走石' },
          { name: '挥手一击' }
        ],
        source_refs: [sourceRef(1, '胡家刀法初现')]
      }]
    })
  ];
  const result = buildBasicCandidateRegistry(chapters);
  const repeated = buildBasicCandidateRegistry([...chapters].reverse());

  assert.deepEqual(result, repeated);
  assert.equal(JSON.stringify(result), JSON.stringify(repeated));
  assert.equal(result.registry.categories.skills.length, 2);
  const skills = result.registry.categories.skills;
  assert.deepEqual(skills.map(skill => skill.normalized_name), ['胡家·刀法', '胡家·刀法']);
  assert.equal(new Set(skills.map(skill => skill.registry_key)).size, 2);
  const skillsByChapter = Object.fromEntries(skills.map(skill => [skill.source_chapters[0], skill]));
  assert.deepEqual(skillsByChapter[1].record.source_refs, [sourceRef(1, '胡家刀法初现')]);
  assert.deepEqual(skillsByChapter[2].record.source_refs, [sourceRef(2, '胡家刀法再现')]);
  assert.deepEqual(skillsByChapter[1].record.techniques.map(item => item.name), ['飞沙走石']);
  assert.deepEqual(
    skillsByChapter[2].record.techniques.map(item => item.name),
    ['飞沙走石', '回风拂柳剑']
  );
  assert.equal(skillsByChapter[2].record.techniques[0].description, '刀势卷沙。');
  assert.equal(result.quarantine.length, 1);
  assert.equal(result.quarantine[0].category, 'techniques');
  assert.equal(result.quarantine[0].normalized_name, '挥手一击');
  assert.deepEqual(result.quarantine[0].source_refs, [sourceRef(1, '胡家刀法初现')]);
});

test('same normalized name remains isolated across categories', () => {
  const result = buildBasicCandidateRegistry([
    chapter(1, {
      skills: [{
        local_key: 'skill:fei-hu', name: '飞狐', techniques: [],
        source_refs: [sourceRef(1, '飞狐之技')]
      }],
      factions: [{
        local_key: 'faction:fei-hu', name: '飞狐',
        source_refs: [sourceRef(1, '飞狐一脉')]
      }]
    })
  ]);

  assert.equal(result.registry.categories.skills.length, 1);
  assert.equal(result.registry.categories.factions.length, 1);
  assert.notEqual(
    result.registry.categories.skills[0].registry_key,
    result.registry.categories.factions[0].registry_key
  );
});

test('quarantine ordering is stable for identical generic technique keys', () => {
  const techniques = [
    { name: '挥手一击', description: '甲处动作' },
    { name: '挥手一击', description: '乙处动作' }
  ];
  const makeResult = values => buildBasicCandidateRegistry([
    chapter(1, {
      skills: [{
        local_key: 'skill:test', name: '试招刀法', techniques: values,
        source_refs: [sourceRef(1, '试招刀法中有两处动作。')]
      }]
    })
  ]);

  const first = makeResult(techniques);
  const reversed = makeResult([...techniques].reverse());
  assert.deepEqual(first.quarantine.map(item => item.record.description), ['甲处动作', '乙处动作']);
  assert.deepEqual(first, reversed);
  assert.equal(JSON.stringify(first), JSON.stringify(reversed));
});

test('generic skill names are quarantined while named techniques containing verbs remain', () => {
  const result = buildBasicCandidateRegistry([
    chapter(1, {
      skills: [
        {
          local_key: 'skill:generic', name: '随手一刀', techniques: [],
          source_refs: [sourceRef(1, '他随手一刀劈开木门。')]
        },
        {
          local_key: 'skill:dagou', name: '打狗棒法',
          techniques: [
            { name: '反手夺命剑' },
            { name: '挥袖清风' },
            { name: '连发数拳' }
          ],
          source_refs: [sourceRef(1, '使出打狗棒法、反手夺命剑与挥袖清风。')]
        }
      ]
    })
  ]);

  assert.deepEqual(result.registry.categories.skills.map(entry => entry.canonical_name), ['打狗棒法']);
  assert.deepEqual(
    result.registry.categories.skills[0].record.techniques.map(item => item.name),
    ['反手夺命剑', '挥袖清风']
  );
  assert.deepEqual(result.quarantine.map(item => item.normalized_name), ['连发数拳', '随手一刀']);
  assert.deepEqual(result.quarantine[1].source_refs, [sourceRef(1, '他随手一刀劈开木门。')]);
});

test('same-name array differences remain distinct without scalar-conflict warnings', () => {
  const result = buildBasicCandidateRegistry([
    chapter(2, {
      skills: [{
        local_key: 'skill:xuan-2', name: '玄门功', types: ['剑法'], techniques: [],
        source_refs: [sourceRef(2, '玄门功乃一路剑法。')]
      }]
    }),
    chapter(1, {
      characters: [
        {
          local_key: 'character:miao-1', name: '苗若兰', identities: ['苗人凤之女'],
          source_refs: [sourceRef(1, '苗若兰是苗人凤之女。')]
        },
        {
          local_key: 'character:miao-2', name: '苗若兰', identities: ['江湖化名'],
          source_refs: [sourceRef(1, '另有一人化名苗若兰。')]
        }
      ],
      skills: [{
        local_key: 'skill:xuan-1', name: '玄门功', types: ['内功'], techniques: [],
        source_refs: [sourceRef(1, '玄门功是一门内功。')]
      }]
    })
  ]);

  assert.equal(result.registry.categories.characters.length, 2);
  assert.equal(result.registry.categories.skills.length, 2);
  assert.equal(new Set(result.registry.categories.skills.map(entry => entry.registry_key)).size, 2);
  assert.deepEqual(result.warnings, []);
});

test('malformed chapter members produce a deterministic warning instead of throwing', () => {
  const result = buildBasicCandidateRegistry([null]);

  assert.deepEqual(Object.values(result.registry.categories), [[], [], [], []]);
  assert.deepEqual(result.quarantine, []);
  assert.deepEqual(result.warnings, [{
    code: 'CHAPTER_MEMBER_INVALID',
    received_type: 'null'
  }]);
});
