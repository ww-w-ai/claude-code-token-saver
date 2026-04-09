/**
 * window-utils.js — Shared window detection and merging utilities
 *
 * Scans ratelimit CSVs for 5h_reset anchors and/or accepts timeline-based
 * window detections, deduplicates, merges overlapping windows, and returns
 * a sorted list of merged windows [{start, end}].
 */

const fs = require('fs');
const path = require('path');

const FIVE_HOURS_S = 5 * 3600;

/**
 * Scan ratelimit CSVs for 5h_reset values and derive window starts.
 * @param {string} cacheBase - Path to cache base directory (e.g. ~/.claude/cc-token-saver)
 * @returns {number[]} Array of unique window start timestamps
 */
function scanRatelimitWindows(cacheBase) {
  const windowStarts = new Set();
  try {
    const yymms = fs.readdirSync(cacheBase).filter(d => /^\d{4}$/.test(d));
    for (const ym of yymms) {
      const rlDir = path.join(cacheBase, ym);
      if (!fs.statSync(rlDir).isDirectory()) continue;
      const files = fs.readdirSync(rlDir).filter(f => f.startsWith('ratelimit-') && f.endsWith('.csv'));
      for (const f of files) {
        const lines = fs.readFileSync(path.join(rlDir, f), 'utf8').trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          const resetTs = cols[2] ? Number(cols[2]) : 0;
          if (resetTs > 0) {
            windowStarts.add(resetTs - FIVE_HOURS_S);
          }
        }
      }
    }
  } catch { /* ignore missing dirs */ }
  return [...windowStarts];
}

/**
 * Merge overlapping or adjacent windows.
 * @param {number[]} windowStarts - Array of window start timestamps
 * @param {number} windowDuration - Duration of each window in seconds (default: 5h)
 * @returns {{start: number, end: number}[]} Sorted, merged windows
 */
function mergeWindows(windowStarts, windowDuration = FIVE_HOURS_S) {
  if (windowStarts.length === 0) return [];

  const sorted = [...new Set(windowStarts)].sort((a, b) => a - b);

  const merged = [];
  let current = { start: sorted[0], end: sorted[0] + windowDuration };
  for (let i = 1; i < sorted.length; i++) {
    const nextStart = sorted[i];
    const nextEnd = nextStart + windowDuration;
    if (nextStart < current.end) {
      current.end = Math.max(current.end, nextEnd);
    } else {
      merged.push(current);
      current = { start: nextStart, end: nextEnd };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Scan ratelimit CSVs and return merged windows.
 * @param {string} cacheBase - Path to cache base directory
 * @returns {{start: number, end: number}[]} Sorted, merged windows
 */
function detectAndMergeWindows(cacheBase) {
  const starts = scanRatelimitWindows(cacheBase);
  return mergeWindows(starts);
}

module.exports = {
  FIVE_HOURS_S,
  scanRatelimitWindows,
  mergeWindows,
  detectAndMergeWindows,
};
