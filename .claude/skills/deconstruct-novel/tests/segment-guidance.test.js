const assert = require('assert');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'subagent-template.md');
const template = fs.readFileSync(templatePath, 'utf8');

assert(
  /每段约\s*100\s*行左右/.test(template),
  'Sub Agent 分段规则必须限制为每段约 100 行左右'
);

assert(
  !/300\s*-\s*500\s*字/.test(template),
  'Sub Agent 分段规则不能继续使用 300-500 字的细粒度切分'
);

assert(
  /按自然段切分/.test(template) && /不在对话中间切断/.test(template),
  'Sub Agent 分段规则必须保留自然段边界和对话完整性要求'
);

console.log('segment-guidance ok');
