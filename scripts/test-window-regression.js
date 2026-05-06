#!/usr/bin/env node
/**
 * Regression test: verify ts-precision window mapping vs legacy hourFloor mapping.
 *
 * For each row in real timeline data:
 *  - Compute legacy win (hourFloor → buildGlobalWindowMap)
 *  - Compute new win (ts → buildGlobalTsMapper)
 *  - Compare assignments
 *
 * Pass criteria:
 *  - For ts NOT in boundary hour (window.start % 3600 == 0), legacy and new must match
 *  - For ts in boundary hour (post-4/23 minute-precise window), differences must show
 *    the row moving to the correct window per its actual ts
 */

const { collectActiveHours, scanRatelimitWindows, mergeWindows, buildHourToWindowMap, buildGlobalTsMapper, FIVE_HOURS_S } = require('./lib/window-utils');
const { listProjects, listSessions, getTimelinePath } = require('./lib/cache-paths');
const fs = require('fs');

function loadAllTimelineRows() {
  const rows = [];
  for (const proj of listProjects()) {
    for (const sess of listSessions(proj)) {
      const csv = getTimelinePath(proj, sess);
      if (!fs.existsSync(csv)) continue;
      const lines = fs.readFileSync(csv, 'utf8').trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const ts = Number(cols[0]);
        const cost = Number(cols[8]) || 0;
        if (ts > 0) rows.push({ ts, cost, proj, sess });
      }
    }
  }
  return rows;
}

function legacyMap(rows) {
  const allHours = collectActiveHours();
  const rlStarts = scanRatelimitWindows();
  const rlWindows = mergeWindows(rlStarts, FIVE_HOURS_S);
  const hourToWin = buildHourToWindowMap(allHours, rlWindows);
  return rows.map(r => {
    const hf = Math.floor(r.ts / 3600) * 3600;
    const win = hourToWin.get(hf);
    return { ...r, win: win ?? null };
  });
}

function newMap(rows) {
  const { tsToWindow } = buildGlobalTsMapper();
  const out = rows.map(r => ({ ...r, win: tsToWindow(r.ts) }));
  // Apply fallback grouping for uncovered rows (mirror build-report.js logic)
  const uncovered = [];
  out.forEach((r, i) => { if (r.win === null) uncovered.push({ idx: i, ts: r.ts }); });
  uncovered.sort((a, b) => a.ts - b.ts);
  let groupStart = null;
  for (const { idx, ts } of uncovered) {
    if (groupStart === null || ts >= groupStart + FIVE_HOURS_S) groupStart = ts;
    out[idx].win = groupStart;
  }
  return out;
}

const rows = loadAllTimelineRows();
console.log(`Loaded ${rows.length} timeline rows from ${new Set(rows.map(r => r.sess)).size} sessions`);

const legacy = legacyMap(rows);
const newer = newMap(rows);

let same = 0, moved = 0, lostInLegacy = 0, lostInNew = 0;
const movements = [];
for (let i = 0; i < rows.length; i++) {
  const L = legacy[i].win;
  const N = newer[i].win;
  if (L === N) same++;
  else if (L === null) lostInLegacy++;
  else if (N === null) lostInNew++;
  else {
    moved++;
    if (movements.length < 20) {
      const r = rows[i];
      const lDate = new Date(L * 1000).toISOString();
      const nDate = new Date(N * 1000).toISOString();
      const tDate = new Date(r.ts * 1000).toISOString();
      movements.push({ ts: tDate, cost: r.cost, legacyWin: lDate, newWin: nDate });
    }
  }
}

console.log(`\n=== Comparison ===`);
console.log(`Same window:           ${same}`);
console.log(`Moved (legacy→new):    ${moved}`);
console.log(`Lost in legacy (null): ${lostInLegacy}`);
console.log(`Lost in new (null):    ${lostInNew}`);

if (movements.length) {
  console.log(`\n=== Sample movements (first ${movements.length}) ===`);
  for (const m of movements) {
    console.log(`ts=${m.ts} cost=$${m.cost.toFixed(4)}  legacy=${m.legacyWin}  →  new=${m.newWin}`);
  }
}

// Verify: each moved row must have moved to a window that contains its ts
const { tsToWindow } = buildGlobalTsMapper();
let invariantFails = 0;
for (let i = 0; i < rows.length; i++) {
  const N = newer[i].win;
  if (N === null) continue;
  if (rows[i].ts < N || rows[i].ts >= N + FIVE_HOURS_S) {
    invariantFails++;
  }
}
console.log(`\n=== Invariant check ===`);
console.log(`new mapping ts ∈ [winStart, winStart+5h):  ${invariantFails === 0 ? 'PASS' : 'FAIL ('+invariantFails+' violations)'}`);

// Ratelimit-covered subset: rows whose ts is inside any ratelimit window
const { tsToWindow: rlCheck } = buildGlobalTsMapper();
let coveredSame = 0, coveredDiff = 0, coveredDiffPre423 = 0, coveredDiffPost423 = 0;
const CUTOFF_RL = 1777190400; // 2026-04-23 12:00 KST = 03:00 UTC
for (let i = 0; i < rows.length; i++) {
  if (rlCheck(rows[i].ts) === null) continue; // skip uncovered (fallback grouping diff is separate)
  if (legacy[i].win === newer[i].win) coveredSame++;
  else {
    coveredDiff++;
    if (rows[i].ts < CUTOFF_RL) coveredDiffPre423++;
    else coveredDiffPost423++;
  }
}
console.log(`\n=== Ratelimit-covered rows only ===`);
console.log(`Same:                 ${coveredSame}`);
console.log(`Diff (boundary fix):  ${coveredDiff}`);
console.log(`  Pre-4/23 diff:      ${coveredDiffPre423}  (should be 0 — pre-4/23 was hour-aligned)`);
console.log(`  Post-4/23 diff:     ${coveredDiffPost423}  (boundary-hour reattribution)`);

// 4/23 cutoff comparison: pre-4/23 should be 100% same, post-4/23 may differ
const CUTOFF = 1777862400; // 2026-04-23 12:00 UTC ~ 21:00 KST
let preSame = 0, preDiff = 0, postSame = 0, postDiff = 0;
for (let i = 0; i < rows.length; i++) {
  const isPre = rows[i].ts < CUTOFF;
  if (legacy[i].win === newer[i].win) {
    if (isPre) preSame++; else postSame++;
  } else {
    if (isPre) preDiff++; else postDiff++;
  }
}
console.log(`\n=== Pre/Post 4/23 split ===`);
console.log(`Pre-4/23  same: ${preSame}  diff: ${preDiff}`);
console.log(`Post-4/23 same: ${postSame}  diff: ${postDiff}`);
console.log(`Pre-4/23 should be ~100% same: ${preDiff < preSame * 0.01 ? 'PASS' : 'WARN'}`);
