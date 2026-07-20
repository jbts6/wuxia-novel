'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const skillRoot = path.resolve(__dirname, '..', '..', 'generate-game-kb-lite');

function read(relativePath) {
  return fs.readFileSync(path.join(skillRoot, relativePath), 'utf8');
}

function assertOrdered(text, markers, label) {
  let cursor = -1;
  for (const marker of markers) {
    const next = text.indexOf(marker, cursor + 1);
    assert.ok(next > cursor, `${label}: missing or out-of-order ${marker}`);
    cursor = next;
  }
}

function parseEnvelopeExample(text, label) {
  const block = text.match(/```json\r?\n([\s\S]*?)\r?\n```/i);
  assert.ok(block, `${label}: missing JSON envelope example`);
  return JSON.parse(block[1]);
}

test('English and Chinese Skills declare the exact broker lifecycle in order', () => {
  const lifecycle = [
    'lite-status',
    'lite-guard-open',
    'worker message',
    'lite-guard-check',
    'lite-submit-draft',
    'lite-status'
  ];
  assertOrdered(read('SKILL.md'), lifecycle, 'English Skill');
  assertOrdered(read('SKILL-cn.md'), [
    'lite-status',
    'lite-guard-open',
    'worker message',
    'lite-guard-check',
    'lite-submit-draft',
    'lite-status'
  ], 'Chinese Skill');
});

test('Lite Skills expose executable bootstrap and resume commands without examples', () => {
  const statusCommand = /node \.agents\/skills\/generate-game-kb\/scripts\/flow\.js lite-status "<novel>" --run <run-id> --json/;
  const prepareCommand = /node \.agents\/skills\/generate-game-kb\/scripts\/flow\.js lite-prepare "<novel>" --run <run-id> --json/;
  for (const [label, contract] of [['English', read('SKILL.md')], ['Chinese', read('SKILL-cn.md')]]) {
    assert.match(contract, statusCommand, `${label}: complete lite-status command`);
    assert.match(contract, prepareCommand, `${label}: complete lite-prepare command`);
    assert.match(contract, /(?:existing|已有)[^\r\n]*run[^\r\n]*lite-status/iu, `${label}: resume entry`);
    assert.match(contract, /(?:new|新)[^\r\n]*run[^\r\n]*lite-prepare/iu, `${label}: bootstrap entry`);
    assert.ok(
      contract.indexOf('node .agents/skills/generate-game-kb/scripts/flow.js lite-status') < contract.indexOf('examples'),
      `${label}: status command must not depend on examples`,
    );
  }
});

test('Lite Skills define a cross-batch rolling pool with a guarded serial broker barrier', () => {
  const english = read('SKILL.md');
  const chinese = read('SKILL-cn.md');
  for (const [label, contract] of [['English', english], ['Chinese', chinese]]) {
    assert.match(contract, /game-kb-chapter-extract/iu, `${label}: Claude workflow`);
    assert.match(contract, /(?:first|前)[^\r\n]*(?:concurrency_limit|并发上限)[^\r\n]*(?:distinct|不同)[^\r\n]*batch/iu, `${label}: window`);
    assert.match(contract, /(?:one|一个)[^\r\n]*(?:sub-agent|子代理)[^\r\n]*(?:one|一)[^\r\n]*(?:chapter|章)/iu, `${label}: one chapter`);
    assert.match(contract, /(?:slot|槽位)[^\r\n]*(?:free|释放)[^\r\n]*(?:next|下一)/iu, `${label}: refill`);
    assert.match(contract, /(?:all|全部)[^\r\n]*guard[^\r\n]*(?:before|之后|以前|前)[^\r\n]*(?:submit|提交)/iu, `${label}: guard barrier`);
    assert.match(contract, /(?:serial|串行)[^\r\n]*(?:descriptor|描述符|chapter_jobs)[^\r\n]*(?:order|顺序)/iu, `${label}: serial order`);
    assert.match(contract, /(?:other platforms|其他平台)[^\r\n]*(?:native|原生)[^\r\n]*(?:pool|池)/iu, `${label}: fallback`);
    assert.doesNotMatch(contract, /(?:one|每个)[^\r\n]*(?:sub-agent|子代理)[^\r\n]*(?:2|2\s*(?:-|至|到)\s*3)[^\r\n]*(?:chapter|章)/iu);
  }
});

test('Lite Skills fail closed around the mandatory Claude workflow and memory-only handoff', () => {
  for (const [label, contract] of [['English', read('SKILL.md')], ['Chinese', read('SKILL-cn.md')]]) {
    assert.match(
      contract,
      /(?:even (?:for|when|if)|即使)[\s\S]{0,200}(?:one|single|一)[\s\S]{0,200}(?:chapter|章)[\s\S]{0,200}game-kb-chapter-extract/iu,
      `${label}: one chapter still requires the Workflow`,
    );
    assert.match(contract, /(?:generic|通用)[\s\S]{0,120}Agent\s*\/\s*Task[\s\S]{0,120}(?:forbidden|禁止|不得)/iu, `${label}: generic agent ban`);
    assert.match(
      contract,
      /(?:main\s+(?:agent|session)|主(?:代理|会话))[\s\S]{0,200}(?:must not|不得)[\s\S]{0,200}(?:read|读取)[\s\S]{0,120}source_file/iu,
      `${label}: main session cannot read chapter source`,
    );
    assert.match(
      contract,
      /(?:Workflow|工作流)[\s\S]{0,250}(?:unavailable|timeout|malformed|不可用|超时|格式错误|结构错误)[\s\S]{0,180}(?:fail closed|stop|停止|失败关闭)/iu,
      `${label}: workflow failures stop`,
    );
    assert.match(
      contract,
      /(?:must not|不得)[\s\S]{0,160}(?:repair|normalize|construct|修补|规范化|构造)[\s\S]{0,160}(?:draft|envelope)/iu,
      `${label}: main session cannot repair results`,
    );
    assert.match(
      contract,
      /(?:only|只有)[\s\S]{0,160}next_action[\s\S]{0,160}start-new-run[\s\S]{0,160}(?:new\s+run|新\s*run)/iu,
      `${label}: controller-authorized replacement run`,
    );
    assert.match(contract, /%TEMP%/u, `${label}: Windows temp ban`);
    assert.match(contract, /\/tmp/u, `${label}: Unix temp ban`);
    assert.match(
      contract,
      /(?:Workflow\s+result\s+memory|Workflow 结果内存)[\s\S]{0,160}(?:stdin|标准输入)/iu,
      `${label}: in-memory stdin handoff`,
    );
    assert.match(
      contract,
      /\$WORKFLOW_ENVELOPE_JSON\s*\|\s*node \.agents\/skills\/generate-game-kb\/scripts\/flow\.js lite-submit-draft "<novel>" --run <run-id> --batch <batch-id> --unit <unit> --attempt <attempt> --guard-id <guard-id> --json/iu,
      `${label}: direct stdin-only submit recipe`,
    );
  }
});

test('examples submit the unchanged envelope through stdin without a draft path', () => {
  for (const file of ['examples.md', 'examples-cn.md']) {
    const text = read(file);
    const envelope = parseEnvelopeExample(text, file);
    assert.equal(envelope.schema_version, 1);
    assert.equal(envelope.draft.schema_version, 1);
    assert.equal(envelope.draft.source_hash, envelope.input_hash);
    assert.match(text, /lite-guard-open/);
    assert.match(text, /lite-guard-check[^\r\n]*--guard-id/);
    assert.match(text, /lite-submit-draft[^\r\n]*--guard-id/);
    assert.match(text, /lite-submit-draft[^\r\n]*--unit/);
    assert.match(text, /lite-submit-draft[^\r\n]*--batch/);
    assert.match(text, /lite-submit-draft[^\r\n]*--attempt/);
    assert.match(text, /(?:unchanged|原样)[^\r\n]*(?:envelope|封装|信封)/i);
    assert.doesNotMatch(text, /lite-submit-draft[^\r\n]*--draft/i);
    assert.match(text, /lite-recover-draft[^\r\n]*--source/i);
    assert.doesNotMatch(text, /lite-recover-draft[^\r\n]*--from/i);
    assert.match(text, /lite-recover-draft[^\r\n]*--guard-id[^\r\n]*--confirm/i);
  }
});

test('Skill contracts reject lifecycle shortcuts and worker-authored acceptance', () => {
  const text = `${read('SKILL.md')}\n${read('SKILL-cn.md')}`;
  assert.match(text, /(?:worker|子代理)[^\r\n]*(?:must not|不得)[^\r\n]*(?:create|modify|move|delete|创建|修改|移动|删除)/i);
  assert.match(text, /(?:worker|子代理)[^\r\n]*(?:must not|不得)[^\r\n]*(?:controller|script|控制器|脚本)/i);
  assert.match(text, /(?:worker prose|worker 文本|子代理文本)[^\r\n]*(?:cannot|不得|不能)[^\r\n]*(?:accepted|acceptance|接收)/i);
  assert.match(
    text,
    /after[^\r\n]*clean guard[\s\S]{0,120}lite-submit-draft|(?:干净的 guard|guard[^\r\n]*无违规)[\s\S]{0,120}(?:之后|后)[\s\S]{0,120}lite-submit-draft/i
  );
  assert.match(text, /(?:attempt\s*3|第三次尝试)[^\r\n]*(?:forbidden|不得|禁止)/i);
});
