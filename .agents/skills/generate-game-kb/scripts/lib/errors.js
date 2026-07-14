'use strict';

class GameKbError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GameKbError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { GameKbError };
