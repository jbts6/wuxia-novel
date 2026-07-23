'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(
  REPO_ROOT,
  '.agents', 'skills', 'generate-game-kb', 'scripts', 'root-temp-hook.js'
);
const HOOK_COMMAND = 'node .agents/skills/generate-game-kb/scripts/root-temp-hook.js';

function runHook(payload) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: typeof payload === 'string' ? payload : JSON.stringify(payload)
  });
}

function event(toolName, toolInput) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    cwd: REPO_ROOT
  };
}

function assertDenied(result) {
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output, {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Repository-root .tmp-* and .temp-* writes are forbidden; write only to a managed output path.'
    }
  });
}

test('Codex apply_patch and Claude Write share the root temp denial', () => {
  assertDenied(runHook(event('apply_patch', {
    command: '*** Begin Patch\n*** Add File: .tmp-worker.js\n+bad\n*** End Patch'
  })));
  assertDenied(runHook(event('Write', {
    file_path: path.join(REPO_ROOT, '.temp-worker.txt'),
    content: 'bad'
  })));
});

test('an explicit PowerShell root temp write is denied', () => {
  assertDenied(runHook(event('Bash', {
    command: 'Set-Content -LiteralPath ".tmp-worker.js" -Value "bad"'
  })));
});

test('explicit writes in pipelines, command lists, and patch moves are denied', () => {
  const denied = [
    event('Bash', { command: 'echo bad | tee ".tmp-pipe.txt"' }),
    event('Bash', { command: 'cd .; touch .tmp-after-separator.txt' }),
    event('apply_patch', {
      command: '*** Begin Patch\n*** Update File: nested.txt\n*** Move to: .tmp-moved.txt\n*** End Patch'
    })
  ];
  for (const payload of denied) assertDenied(runHook(payload));
});

test('nested writes, reads, deletes, and moves away from root are allowed', () => {
  const allowed = [
    event('Write', {
      file_path: path.join(REPO_ROOT, 'scratch', '.tmp-worker.txt'),
      content: 'ok'
    }),
    event('Bash', { command: 'Get-Content -LiteralPath ".tmp-old.txt"' }),
    event('Bash', { command: 'Remove-Item -LiteralPath ".tmp-old.txt"' }),
    event('Bash', { command: 'Move-Item ".tmp-old.txt" "diagnostics/old.txt"' }),
    event('Bash', { command: 'node -e "console.log(1 > \'.tmp-not-a-write.txt\')"' }),
    event('apply_patch', {
      command: [
        '*** Begin Patch',
        '*** Update File: .tmp-old.txt',
        '*** Move to: diagnostics/old.txt',
        '*** End Patch'
      ].join('\n')
    }),
    event('apply_patch', {
      command: '*** Begin Patch\n*** Delete File: .tmp-old.txt\n*** End Patch'
    })
  ];
  for (const payload of allowed) {
    const result = runHook(payload);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  }
});

test('invalid hook JSON fails visibly', () => {
  const result = runHook('{invalid');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid PreToolUse JSON/i);
});

test('Codex and Claude register the same project-local hook entry', () => {
  const codex = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
  const claude = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude', 'settings.json'), 'utf8'));
  const commands = config => (config.hooks.PreToolUse || [])
    .flatMap(entry => entry.hooks)
    .map(hook => hook.command);
  assert.ok(commands(codex).includes(HOOK_COMMAND));
  assert.ok(commands(claude).includes(HOOK_COMMAND));
});
