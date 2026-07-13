#!/usr/bin/env node
'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const canonical = path.join(root, '.agents', 'skills', 'generate-kb');
const compatibility = path.join(root, '.claude', 'skills', 'generate-kb');

it('keeps the Claude skill path as a symlink to the canonical Agents skill', () => {
  const stat = fs.lstatSync(compatibility);
  assert.equal(stat.isSymbolicLink(), true, '.claude skill must be a symlink');
  const resolved = path.resolve(path.dirname(compatibility), fs.readlinkSync(compatibility));
  assert.equal(resolved, canonical);
});
