'use strict';

const path = require('node:path');

const ROOT_TEMP_NAME = /^\.(?:tmp|temp)-/i;
const DIRECT_WRITE_TOOL = /(?:^|[.:/\\])(?:write|edit|multiedit|notebookedit|write_file|edit_file)$/i;
const SHELL_TOOL = /(?:bash|shell|command|exec)/i;

function isRootTempName(name) {
  return ROOT_TEMP_NAME.test(name);
}

function stripQuotes(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function comparable(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isRepositoryRootTempPath(repoRoot, cwd, candidate) {
  const raw = stripQuotes(candidate);
  if (!raw) return false;
  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(cwd, raw);
  return comparable(path.dirname(resolved)) === comparable(repoRoot)
    && isRootTempName(path.basename(resolved));
}

function quotedOrBare(match) {
  return match[1] || match[2] || match[3] || '';
}

function patchWriteTargets(command) {
  const text = String(command || '');
  const added = [...text.matchAll(/^\*\*\* Add File:\s+(.+)$/gm)]
    .map(match => match[1].trim());
  const updated = [...text.matchAll(
    /^\*\*\* Update File:\s+(.+?)(?:\r?\n\*\*\* Move to:\s+(.+))?$/gm
  )].map(match => (match[2] || match[1]).trim());
  return [...added, ...updated];
}

function pathOptionTargets(command) {
  const writeVerb = /^\s*(?:Set-Content|Add-Content|Out-File|New-Item)\b/i;
  if (!writeVerb.test(command)) return [];
  return [...command.matchAll(/-(?:LiteralPath|FilePath|Path)\s+(?:"([^"]+)"|'([^']+)'|([^\s;|]+))/gi)]
    .map(quotedOrBare);
}

function destinationTarget(command) {
  if (!/^\s*(?:Copy-Item|Move-Item|cp|copy|mv|move|touch|tee)\b/i.test(command)) return [];
  const tokens = command.match(/"[^"]*"|'[^']*'|[^\s]+/g) || [];
  const values = tokens.slice(1).filter(token => !token.startsWith('-'));
  return values.length > 0 ? [stripQuotes(values.at(-1))] : [];
}

function shellSegments(command) {
  const text = String(command || '');
  const segments = [];
  let quote = '';
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (!/[;|&\r\n]/.test(character)) continue;
    const segment = text.slice(start, index).trim();
    if (segment) segments.push(segment);
    start = index + 1;
  }
  const tail = text.slice(start).trim();
  if (tail) segments.push(tail);
  return segments;
}

function tokenAfter(text, start) {
  let index = start;
  while (/\s/.test(text[index] || '')) index += 1;
  const quote = text[index] === '"' || text[index] === "'" ? text[index] : '';
  if (quote) {
    const end = text.indexOf(quote, index + 1);
    return end >= 0 ? text.slice(index + 1, end) : '';
  }
  const match = text.slice(index).match(/^[^\s;|&]+/);
  return match?.[0] || '';
}

function redirectTargets(command) {
  const targets = [];
  let quote = '';
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote && command[index - 1] !== '\\') quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character !== '>') continue;
    while (command[index + 1] === '>') index += 1;
    const target = tokenAfter(command, index + 1);
    if (target) targets.push(target);
  }
  return targets;
}

function shellWriteTargets(command) {
  const text = String(command || '');
  const nodeWrites = [...text.matchAll(/\bwriteFile(?:Sync)?\s*\(\s*(?:"([^"]+)"|'([^']+)'|([^\s,)]+))/g)]
    .map(quotedOrBare);
  const segmentTargets = shellSegments(text).flatMap(segment => [
    ...redirectTargets(segment),
    ...pathOptionTargets(segment),
    ...destinationTarget(segment)
  ]);
  return [...segmentTargets, ...nodeWrites];
}

function eventWriteTargets(event) {
  const toolName = String(event?.tool_name || event?.toolName || '');
  const input = event?.tool_input || event?.toolInput || {};
  const command = typeof input.command === 'string' ? input.command : '';
  if (toolName.toLowerCase().endsWith('apply_patch')) return patchWriteTargets(command);
  if (SHELL_TOOL.test(toolName)) return shellWriteTargets(command);
  if (!DIRECT_WRITE_TOOL.test(toolName)) return [];
  return ['file_path', 'path', 'target_path', 'destination', 'destination_path']
    .map(key => input[key])
    .filter(value => typeof value === 'string');
}

function deniedRootTempTargets(event, repoRoot) {
  const cwd = path.resolve(event?.cwd || repoRoot);
  return eventWriteTargets(event)
    .filter(target => isRepositoryRootTempPath(repoRoot, cwd, target));
}

module.exports = {
  deniedRootTempTargets,
  isRepositoryRootTempPath,
  isRootTempName
};
