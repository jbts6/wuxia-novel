'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { deferredPathsFor, pathsFor } = require('../scripts/lib/paths');

test('pathsFor keeps novel identity while placing migration runs under an isolated work root', () => {
  const novel = path.resolve('C:/repo/金庸/书剑恩仇录');
  const workRoot = path.resolve('C:/repo/.game-kb-migration-staging/金庸/书剑恩仇录');
  const paths = pathsFor(novel, 'migration-1', { workRoot });

  assert.equal(paths.novel, novel);
  assert.equal(paths.work, workRoot);
  assert.equal(paths.run, path.join(workRoot, 'runs', 'migration-1'));
  assert.equal(paths.migrationReceipt, path.join(paths.run, 'reports', 'migration-receipt.json'));
});

test('default and deferred paths expose the generic migration receipt without moving existing roots', () => {
  const novel = path.resolve('C:/repo/古龙/陆小凤传奇');
  const active = pathsFor(novel, 'run-active');
  const deferred = deferredPathsFor(novel, 'run-archived');

  assert.equal(active.work, path.join(novel, '.game-kb-work'));
  assert.equal(active.migrationReceipt, path.join(active.run, 'reports', 'migration-receipt.json'));
  assert.equal(deferred.run, path.join(novel, '_archive', 'generate-game-kb', 'run-archived'));
  assert.equal(deferred.migrationReceipt, path.join(deferred.run, 'reports', 'migration-receipt.json'));
});
