const assert = require('assert');
const fs = require('fs');
const path = require('path');

const skillDir = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(skillDir, relativePath), 'utf8');
}

const skill = read('SKILL.md');
const template = read('subagent-template.md');
const prepare = read('scripts/prepare.js');
const resume = read('scripts/resume.js');

assert(
  /Sub Agent 不可用/.test(skill) && /顺序兼容模式/.test(skill),
  'SKILL.md 必须说明 Sub Agent 不可用时的顺序兼容模式'
);

assert(
  /第一次派发失败后立刻切换顺序兼容模式/.test(skill),
  'SKILL.md 必须禁止第三方模型反复重试失败的 Sub Agent 派发'
);

assert(
  /主 Agent 可以读取并处理当前 1 章正文/.test(skill),
  'SKILL.md 必须授权兼容模式下主 Agent 按章读取正文'
);

assert(
  /Sub Agent \/ 顺序兼容模式/.test(template) && /主 Agent 按本模板亲自处理当前 1 章/.test(template),
  '章节模板必须同时支持 Sub Agent 和主 Agent 顺序处理'
);

assert(
  /顺序兼容模式/.test(prepare) && /每次处理 1 章/.test(prepare),
  'prepare.js 的下一步提示必须包含顺序兼容模式'
);

assert(
  /顺序兼容模式/.test(resume) && !/必须立即继续派发/.test(resume),
  'resume.js 不能再要求必须派发 Sub Agent'
);

console.log('subagent-fallback ok');
