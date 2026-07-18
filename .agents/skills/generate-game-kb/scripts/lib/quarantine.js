'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { GameKbError } = require('./errors');
const { atomicWriteFile } = require('./io');
const { sha256 } = require('./source');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

function safeSegment(value, fallback) {
  const segment = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return !segment || /^\.+$/.test(segment) ? fallback : segment;
}

function quarantineRecord(paths, { unit, category, record, errors, inputHash }) {
  const value = {
    schema_version: 1,
    unit,
    category,
    input_hash: inputHash,
    record,
    errors
  };
  const content = yaml.dump(value, { lineWidth: -1, noRefs: true });
  const fingerprint = sha256(JSON.stringify(stableValue(value))).slice(7, 23);
  const directory = path.join(
    paths.quarantine,
    safeSegment(unit, 'unit'),
    safeSegment(category, 'records')
  );
  const file = path.resolve(
    directory,
    `${safeSegment(record?.local_key || record?.name, 'record')}_${fingerprint}.yaml`
  );
  const quarantineRoot = path.resolve(paths.quarantine);
  const relative = path.relative(quarantineRoot, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new GameKbError('QUARANTINE_PATH_ESCAPE', 'Quarantine record path must stay within the selected run', {
      quarantine: quarantineRoot,
      file
    });
  }
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== content) {
      throw new GameKbError('QUARANTINE_CONFLICT', 'Immutable quarantine record has conflicting bytes', {
        file
      });
    }
    return file;
  }
  atomicWriteFile(file, content);
  return file;
}

module.exports = { quarantineRecord };
