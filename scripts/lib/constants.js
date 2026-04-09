/**
 * constants.js — Shared constants
 *
 * DEPRECATED: CACHE_DIR moved to lib/cache-paths.js as CACHE_BASE.
 * This file re-exports for backward compatibility.
 */

const { CACHE_BASE } = require('./cache-paths');

module.exports = {
  /** @deprecated Use CACHE_BASE from lib/cache-paths.js instead */
  CACHE_DIR: CACHE_BASE,
};
