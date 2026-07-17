'use strict';

const crypto = require('node:crypto');

const { FINAL_FILES } = require('./semantic-contract');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

function hashFinalData(finalData) {
  const ordered = Object.fromEntries(Object.values(FINAL_FILES).sort()
    .map(filename => [filename, finalData[filename] || []]));
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stableValue(ordered))).digest('hex')}`;
}

module.exports = { hashFinalData, stableValue };
