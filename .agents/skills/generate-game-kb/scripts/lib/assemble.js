'use strict';

const { GameKbError } = require('./errors');

function assembleRun({ paths, deep }) {
  throw new GameKbError(
    'ASSEMBLY_REMOVED',
    'Domain assembly paths (v6) have been removed; start a new run with the current pipeline',
    { deep: deep ?? null }
  );
}

module.exports = { assembleRun };
