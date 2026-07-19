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
