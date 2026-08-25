#!/bin/bash
# statusline-logger.sh — Real-time status bar + rate limit logger
#
# Called by Claude Code on every API response (configured via settings.json statusLine).
# Two responsibilities:
#   1. stdout → CC status bar display (shown after each interaction)
#   2. ratelimit CSV append (persistent rate limit history)
#
# Input:  JSON via stdin (CC StatusLineCommandInput)
#   Fields used: rate_limits.{five_hour,seven_day}, cost.total_cost_usd,
#                session_id, context_window.used_percentage
#
# Output (stdout): compact status line
#   Subscriber: [RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
#              (weekly ≥60%): ... | [W🟡] 65% ⏳1d3h30m | ...
#   API key:    [RUN🟢] $0.10/$12.23 | [CTX🟢] 22%
#
#   Color thresholds:
#     RUN: 🟢 <$0.30, 🟡 ≥$0.30, 🔴 ≥$1.00 (PER-TURN accumulated cost)
#     5H:  🟢 <70%,   🟡 ≥70%,   🔴 ≥90%
#     W:              🟡 ≥60%,   🔴 ≥90%  (hidden below 60%)
#     CTX: 🟢 <35%,   🟡 ≥35%,   🔴 ≥70%
#
# v1.4.0 turn accumulation:
#   RUN indicator shows cost accumulated across the current user turn, not per
#   single API call. Previously a $1.43 cost spike was immediately overwritten
#   by the next cheap tool_result call — user never saw the red warning.
#   Now the turn accumulator resets only when the user starts a new prompt
#   (detected via idle threshold: no calls for > TURN_IDLE_SEC seconds).
#
#   TURN_IDLE_SEC default: 60 seconds. A long tool call (> 60s) could false-reset
#   the turn; this is acceptable because power users can tune via env var.
#
#   Hints: 5H🔴 → /report-limit, other warnings → /usage-view current
#
# Cache (side-effects):
#   ~/.claude/super-token-saver-data/{projectName}/{SESSION_ID}/ratelimit.csv
#     Header: ts,5h,5h_reset,7d,7d_reset,alert
#     - ts: unix timestamp
#     - 5h/7d: usage percentage (0-100, two decimals)
#     - 5h_reset/7d_reset: unix timestamp when window resets (sparse — only on change)
#     - alert: threshold crossing event ("warn" at ≥70%, "danger" at ≥90%, "" otherwise)
#     - Rows appended only when 5h or 7d percentage changes (delta dedup)
#     - projectName derived from CWD: sed 's/[^a-zA-Z0-9]/-/g'
#
#   $TMPDIR/super-token-saver-state-{SESSION_ID}.csv
#     Per-session cost delta state (cost,lastDelta). Used to calculate per-call cost.

LOG_DIR="$HOME/.claude/super-token-saver-data"

# Pipe stdin to node (avoids ARG_MAX limit)
cat | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const fs = require('fs');

const rl = d.rate_limits || {};
const now = new Date();
const ts = Math.floor(now.getTime() / 1000);
const fiveH = rl.five_hour ? Math.round(rl.five_hour.used_percentage * 100) / 100 : null;
const fiveHReset = rl.five_hour ? rl.five_hour.resets_at : null;
const sevenD = rl.seven_day ? Math.round(rl.seven_day.used_percentage * 100) / 100 : null;
const sevenDReset = rl.seven_day ? rl.seven_day.resets_at : null;
const cost = d.cost ? Math.round(d.cost.total_cost_usd * 10000) / 10000 : null;
const session = d.session_id || null;

// v1.4.0 turn accumulation — state file columns: cost,lastDelta,turnStartCost,lastCallTs
// New turn detected when idle gap since last call > TURN_IDLE_SEC (default 60s).
// RUN indicator shows cost accumulated within the current user turn, not per call.
const dir = '$LOG_DIR';
const stateFile = session ? require('path').join(require('os').tmpdir(), 'super-token-saver-state-' + session + '.csv') : null;
const TURN_IDLE_SEC = Number(process.env.CC_UPGRADER_TURN_IDLE_SEC || process.env.CC_TOKEN_SAVER_TURN_IDLE_SEC) || 60;
let lastCost = null;
let lastValidDelta = null;
let turnStartCost = null;
let lastCallTs = null;
if (stateFile) {
  try {
    const lines = fs.readFileSync(stateFile, 'utf8').trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(',');
      lastCost = parseFloat(parts[0]) || null;
      lastValidDelta = parseFloat(parts[1]) || null;
      turnStartCost = (parts[2] !== undefined && parts[2] !== '') ? parseFloat(parts[2]) : null;
      lastCallTs = (parts[3] !== undefined && parts[3] !== '') ? parseInt(parts[3], 10) : null;
    }
  } catch {}
}
const deltaCost = (lastCost !== null && cost !== null) ? Math.round((cost - lastCost) * 10000) / 10000 : null;
const currentDelta = (deltaCost !== null && deltaCost > 0) ? deltaCost : lastValidDelta;

// Detect turn boundary — start a new turn on idle or first call
const isNewTurn = (lastCallTs === null) || (ts - lastCallTs > TURN_IDLE_SEC);
if (isNewTurn || turnStartCost === null) {
  turnStartCost = lastCost !== null ? lastCost : (cost !== null ? Math.max(0, cost - (currentDelta || 0)) : 0);
}
const turnCost = (cost !== null && turnStartCost !== null)
  ? Math.round((cost - turnStartCost) * 10000) / 10000
  : currentDelta;

// Save last state (per-session, no cross-session interference)
fs.mkdirSync(dir, { recursive: true });
if (stateFile) {
  fs.writeFileSync(stateFile, 'cost,lastDelta,turnStartCost,lastCallTs\n' +
    cost + ',' + (currentDelta || '') + ',' + (turnStartCost !== null ? turnStartCost : '') + ',' + ts);
}

// Append to rate limit CSV (per-session, project/session folder)
if ((fiveH !== null || sevenD !== null) && deltaCost !== 0 && session) {
  const projectName = process.cwd().replace(/[^a-zA-Z0-9]/g, '-');
  const csvDir = require('path').join(dir, projectName, session);
  const csvFile = require('path').join(csvDir, 'ratelimit.csv');
  fs.mkdirSync(csvDir, { recursive: true });
  let lastFiveH = null, lastFiveHReset = null, lastSevenD = null, lastSevenDReset = null;
  if (!fs.existsSync(csvFile)) {
    fs.writeFileSync(csvFile, 'ts,5h,5h_reset,7d,7d_reset,alert,version\n');
  } else {
    try {
      const rows = fs.readFileSync(csvFile, 'utf8').trimEnd().split('\n');
      // Fast path: check first data row for reset values (rarely change)
      let firstFiveHReset = null, firstSevenDReset = null;
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (!firstFiveHReset && cols[2]) firstFiveHReset = cols[2];
        if (!firstSevenDReset && cols[4]) firstSevenDReset = cols[4];
        if (firstFiveHReset && firstSevenDReset) break;
      }
      // If current time hasn't passed the first reset, resets haven't changed
      const needReverseScan = (firstFiveHReset && ts > Number(firstFiveHReset))
        || (firstSevenDReset && ts > Number(firstSevenDReset));
      if (!needReverseScan) {
        lastFiveHReset = firstFiveHReset;
        lastSevenDReset = firstSevenDReset;
        // Still need last 5h/7d percentages from last row
        const lastCols = rows[rows.length - 1].split(',');
        lastFiveH = lastCols[1] || null;
        lastSevenD = lastCols[3] || null;
      } else {
        // Reverse scan: window rolled over, find actual last values
        for (let i = rows.length - 1; i >= 1; i--) {
          const cols = rows[i].split(',');
          if (!lastFiveH && cols[1]) lastFiveH = cols[1];
          if (!lastFiveHReset && cols[2]) lastFiveHReset = cols[2];
          if (!lastSevenD && cols[3]) lastSevenD = cols[3];
          if (!lastSevenDReset && cols[4]) lastSevenDReset = cols[4];
          if (lastFiveH && lastFiveHReset && lastSevenD && lastSevenDReset) break;
        }
      }
    } catch {}
  }
  const f5 = fiveH != null ? String(fiveH) : '';
  const f7 = sevenD != null ? String(sevenD) : '';
  if (f5 !== (lastFiveH || '') || f7 !== (lastSevenD || '')) {
    const r5 = (fiveHReset != null && String(fiveHReset) !== lastFiveHReset) ? fiveHReset : '';
    const r7 = (sevenDReset != null && String(sevenDReset) !== lastSevenDReset) ? sevenDReset : '';
    // 5H threshold crossing: warn (≥70%), danger (≥90%)
    let alert = '';
    const prev5h = Number(lastFiveH) || 0;
    const curr5h = Number(f5) || 0;
    if (curr5h >= 90 && prev5h < 90) alert = 'danger';
    else if (curr5h >= 70 && prev5h < 70) alert = 'warn';
    // version column: write "1" on first data row only (after header)
    const isFirstRow = fs.readFileSync(csvFile, 'utf8').trimEnd().split('\n').length === 1;
    fs.appendFileSync(csvFile, [ts, f5, r5, f7, r7, alert, isFirstRow ? '1' : ''].join(',') + '\n');
  }
}

// --- Status line output ---
const parts = [];
const isSubscriber = fiveH !== null;
const runCost = d.cost ? d.cost.total_cost_usd : null;

// RUN: per-turn accumulated cost / cumulative session cost
// turnCost persists across follow-up tool calls within the same turn so a
// warning stays visible. Resets on idle > TURN_IDLE_SEC or new session.
if (turnCost !== null && turnCost > 0 && runCost !== null) {
  const isFirstReq = lastCost === null;
  const dIcon = isFirstReq ? '🟢' : turnCost >= 1.0 ? '🔴' : turnCost >= 0.3 ? '🟡' : '🟢';
  parts.push('[RUN' + dIcon + '] \$' + turnCost.toFixed(2) + '/\$' + runCost.toFixed(2));
} else if (runCost !== null) {
  parts.push('[RUN] \$' + runCost.toFixed(2));
}

// 5h window (subscribers only)
if (isSubscriber) {
  const icon = fiveH >= 90 ? '🔴' : fiveH >= 70 ? '🟡' : '🟢';
  let remaining = '';
  if (fiveHReset) {
    const ms = fiveHReset * 1000 - Date.now();
    if (ms > 0) {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      remaining = h > 0 ? h + 'h' + (m > 0 ? m + 'm' : '') : m + 'm';
    }
  }
  parts.push('[5H' + icon + '] ' + Math.round(fiveH) + '%' + (remaining ? ' ⏳' + remaining : ''));
}

// 7-day weekly window (subscribers only, show when ≥60%)
if (sevenD !== null && sevenD >= 60) {
  const wIcon = sevenD >= 90 ? '🔴' : '🟡';
  let wRemaining = '';
  if (sevenDReset) {
    const ms = sevenDReset * 1000 - Date.now();
    if (ms > 0) {
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      wRemaining = (d > 0 ? d + 'd' : '') + (h > 0 ? h + 'h' : '') + (m > 0 ? m + 'm' : '');
    }
  }
  parts.push('[W' + wIcon + '] ' + Math.round(sevenD) + '%' + (wRemaining ? ' ⏳' + wRemaining : ''));
}

// Context
if (d.context_window) {
  const ctx = Math.round(d.context_window.used_percentage);
  const ctxIcon = ctx >= 70 ? '🔴' : ctx >= 35 ? '🟡' : '🟢';
  parts.push('[CTX' + ctxIcon + '] ' + ctx + '%');
}

// Hints: 5h red → /report-limit, other warnings → /usage-view current
if (isSubscriber && fiveH >= 90) {
  parts.push('→ /report-limit');
} else {
  const hasWarning = (currentDelta !== null && currentDelta >= 0.3 && lastCost !== null)
    || (isSubscriber && fiveH >= 70)
    || (d.context_window && d.context_window.used_percentage >= 35);
  if (hasWarning) {
    parts.push('→ /usage-view current');
  }
}

process.stdout.write(parts.join(' | '));
"
