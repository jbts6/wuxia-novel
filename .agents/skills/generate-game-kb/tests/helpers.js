'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SKILL_ROOT = path.resolve(__dirname, '..');
const FLOW = path.join(SKILL_ROOT, 'scripts', 'flow.js');

function makeNovel(name, source) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-game-kb-'));
  const novel = path.join(parent, name);
  fs.mkdirSync(novel, { recursive: true });
  fs.writeFileSync(path.join(novel, `${name}.txt`), source, 'utf8');
  return novel;
}

function makeNovelDirectory(files) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-game-kb-'));
  const novel = path.join(parent, '试书');
  fs.mkdirSync(novel, { recursive: true });
  for (const [name, content = `${name}\n`] of Object.entries(files)) {
    fs.writeFileSync(path.join(novel, name), content, 'utf8');
  }
  return novel;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function runFlow(args, options = {}) {
  return spawnSync(process.execPath, [FLOW, ...args], {
    cwd: options.cwd || SKILL_ROOT,
    encoding: 'utf8'
  });
}

module.exports = {
  FLOW,
  makeNovel,
  makeNovelDirectory,
  readJson,
  runFlow
};
