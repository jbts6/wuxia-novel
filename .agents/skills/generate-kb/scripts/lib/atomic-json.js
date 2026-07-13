#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class PipelineError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
    this.details = details;
  }
}

function normalizeForJson(value) {
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) normalized[key] = normalizeForJson(value[key]);
    }
    return normalized;
  }
  return value;
}

function stableStringify(value, space = 0) {
  return JSON.stringify(normalizeForJson(value), null, space);
}

function sha256(value) {
  const input = Buffer.isBuffer(value) || typeof value === 'string'
    ? value
    : stableStringify(value);
  return crypto.createHash('sha256').update(input).digest('hex');
}

function resolveInside(root, ...segments) {
  const base = path.resolve(root);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new PipelineError('PATH_OUTSIDE_RUN', `Managed path escapes ${base}: ${target}`);
  }
  return target;
}

function writeTextAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  try {
    fs.writeFileSync(tempPath, content, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(tempPath, filePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, `${stableStringify(value, 2)}\n`);
}

function writeJsonLinesAtomic(filePath, values) {
  const text = values.length > 0
    ? `${values.map(value => stableStringify(value)).join('\n')}\n`
    : '';
  writeTextAtomic(filePath, text);
}

function readJson(filePath, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

module.exports = {
  PipelineError,
  normalizeForJson,
  readJson,
  resolveInside,
  sha256,
  stableStringify,
  writeJsonAtomic,
  writeJsonLinesAtomic,
  writeTextAtomic
};
