/**
 * constants.js — Shared constants
 */

const path = require('path');
const os = require('os');

module.exports = {
  CACHE_DIR: path.join(os.homedir(), '.claude', 'cc-token-saver'),
};
