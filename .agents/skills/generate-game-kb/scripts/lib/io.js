'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { GameKbError } = require('./errors');

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

function temporaryPath(file) {
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${file}.tmp-${nonce}`;
}

function atomicWriteFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = temporaryPath(file);
  const descriptor = fs.openSync(temp, 'wx');
  try {
    fs.writeFileSync(descriptor, content, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

function atomicWriteJson(file, value) {
  atomicWriteFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function serializeYaml(value) {
  return yaml.dump(value, { lineWidth: -1, noRefs: true });
}

function atomicWriteYaml(file, value) {
  const content = serializeYaml(value);
  atomicWriteFile(file, content);
  return content;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function writeFileIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  atomicWriteFile(file, content);
  return true;
}

function writeImmutableFile(file, bytes, conflictCode) {
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');
    if (existing === bytes) return;
    throw new GameKbError(conflictCode, 'Immutable file already exists with different content', {
      file,
      existing_hash: sha256(existing),
      incoming_hash: sha256(bytes)
    });
  }
  atomicWriteFile(file, bytes);
}

function writeImmutableJson(file, value, conflictCode) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  writeImmutableFile(file, bytes, conflictCode);
}

module.exports = {
  atomicWriteFile,
  atomicWriteJson,
  atomicWriteYaml,
  readJson,
  readYaml,
  serializeYaml,
  writeFileIfChanged,
  writeImmutableFile,
  writeImmutableJson
};
