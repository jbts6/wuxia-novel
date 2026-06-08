import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');

function loadTsModule(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    exports: module.exports,
    module,
    require: (specifier) => {
      throw new Error(`Unexpected runtime import in ${relativePath}: ${specifier}`);
    },
  });
  vm.runInContext(compiled, context, { filename: relativePath });
  return module.exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const detailNavigation = loadTsModule('src/utils/detailNavigation.ts');
const graphHelper = loadTsModule('src/utils/graphHelper.ts');

assert.equal(
  detailNavigation.formatDetailParam({ type: 'character', id: 'char_li_xun_huan' }),
  'character:char_li_xun_huan',
);
assert.deepEqual(
  plain(detailNavigation.parseDetailParam('skill:skill_xiao_li_fei_dao')),
  { type: 'skill', id: 'skill_xiao_li_fei_dao' },
);
assert.equal(detailNavigation.parseDetailParam('dialogue:bad'), null);
assert.deepEqual(
  plain(detailNavigation.getDetailSyncAction(
    'character:old',
    { visible: true, type: 'skill', id: 'new' },
    { urlDetail: 'character:old', panelDetail: 'character:old' },
  )),
  { type: 'navigate', detail: 'skill:new' },
);
assert.deepEqual(
  plain(detailNavigation.getDetailSyncAction(
    'character:old',
    { visible: true, type: 'skill', id: 'new' },
    { urlDetail: 'skill:new', panelDetail: 'skill:new' },
  )),
  { type: 'show', target: { type: 'character', id: 'old' } },
);
assert.deepEqual(
  plain(detailNavigation.getDetailSyncAction(
    'character:old',
    { visible: false, type: null, id: null },
  )),
  { type: 'show', target: { type: 'character', id: 'old' } },
);

const trail = detailNavigation.appendDetailTrail(
  [{ type: 'character', id: 'char_li_xun_huan' }],
  { type: 'skill', id: 'skill_xiao_li_fei_dao' },
);
assert.deepEqual(plain(trail), [
  { type: 'character', id: 'char_li_xun_huan' },
  { type: 'skill', id: 'skill_xiao_li_fei_dao' },
]);
assert.deepEqual(
  plain(detailNavigation.appendDetailTrail(trail, { type: 'character', id: 'char_li_xun_huan' })),
  [{ type: 'character', id: 'char_li_xun_huan' }],
);

const nodes = [
  { id: 'char_li_xun_huan', name: '李寻欢', type: 'character', val: 3, color: '#000', data: {} },
  { id: 'skill_xiao_li_fei_dao', name: '小李飞刀', type: 'skill', val: 2, color: '#000', data: {} },
  { id: 'item_fei_dao', name: '飞刀', type: 'item', val: 2, color: '#000', data: {} },
];
const links = [
  { source: 'char_li_xun_huan', target: 'skill_xiao_li_fei_dao', type: '掌握', strength: 0.8, color: '#999' },
  { source: 'item_fei_dao', target: 'skill_xiao_li_fei_dao', type: '关联', strength: 0.5, color: '#999' },
];

assert.deepEqual(
  plain(graphHelper.getRelationshipChain('skill_xiao_li_fei_dao', nodes, links).map((item) => ({
    targetId: item.targetId,
    targetName: item.targetName,
    targetType: item.targetType,
    relation: item.relation,
    direction: item.direction,
  }))),
  [
    {
      targetId: 'char_li_xun_huan',
      targetName: '李寻欢',
      targetType: 'character',
      relation: '掌握',
      direction: 'incoming',
    },
    {
      targetId: 'item_fei_dao',
      targetName: '飞刀',
      targetType: 'item',
      relation: '关联',
      direction: 'incoming',
    },
  ],
);

assert.deepEqual(
  plain(graphHelper.getRelationshipChain('skill_xiao_li_fei_dao', nodes, links, {
    excludeIds: ['char_li_xun_huan'],
  }).map((item) => ({
    targetId: item.targetId,
    relation: item.relation,
  }))),
  [
    {
      targetId: 'item_fei_dao',
      relation: '关联',
    },
  ],
);

const graph = graphHelper.buildGraphData(
  [
    {
      id: 'char_li_xun_huan',
      name: '李寻欢',
      alias: [],
      identity: '小李探花',
      faction: null,
      role: 'protagonist',
      archetype: 'warrior',
      rank: '登峰造极',
      one_line: '例子',
      personality: { traits: [], speech_style: '', temperament: '' },
      relationships: [],
      known_skills: ['skill_xiao_li_fei_dao'],
      related_skills: [],
      source_refs: [],
    },
    {
      id: 'char_jiang_nan_liu_guai',
      name: '江南六怪',
      alias: [],
      identity: '组合角色',
      faction: null,
      role: 'companion',
      archetype: 'warrior',
      rank: '炉火纯青',
      one_line: '缺少 relationships 的射雕数据形状',
      personality: { traits: [], speech_style: '', temperament: '' },
      known_skills: [],
      related_skills: [],
      source_refs: [],
    },
  ],
  [
    {
      id: 'skill_xiao_li_fei_dao',
      name: '小李飞刀',
      type: '暗器',
      faction: null,
      rank: '登峰造极',
      one_line: '例子',
      techniques: [],
      progression: [],
      effects: [],
      combat_style: '',
      source_refs: [],
    },
    {
      id: 'skill_luo_han_quan',
      name: '少林罗汉拳',
      type: '拳法',
      faction: null,
      rank: '',
      one_line: '缺少 techniques 的射雕数据形状',
      source_refs: [],
    },
  ],
  [
    {
      id: 'item_fei_dao',
      name: '飞刀',
      type: '暗器',
      owner: 'char_li_xun_huan',
      one_line: '例子',
      description: '',
      effects: [],
      origin: '',
      rarity: '上乘佳品',
      related_skills: ['skill_xiao_li_fei_dao'],
      source_refs: [],
    },
  ],
  [],
  [],
);
assert.ok(
  graph.links.some((link) => link.source === 'item_fei_dao' && link.target === 'skill_xiao_li_fei_dao'),
  'graph should include item-to-skill relationship links',
);

console.log('dashboard UX verification passed');
