#!/usr/bin/env node
/**
 * report-limit.js — Standalone rate-limit reporter (zero LLM involvement)
 *
 * 1. Runs analyze-usage.js to ensure timeline CSVs exist
 * 2. Scans timeline CSVs for rate-limited windows
 * 3. Collects all rows within each 5h window
 * 4. Uploads to GitHub gist + opens pre-filled Discussion URL
 * 5. Prints JSON summary to stdout
 *
 * Usage: node report-limit.js [--plan <plan>]
 *   --plan  pro|max100|max200|team|team_premium|enterprise|bedrock|foundry|vertex
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { mergeWindows, FIVE_HOURS_S } = require('./lib/window-utils');
const { CACHE_DIR } = require('./lib/constants');
const { PLAN_INFO, VALID_PLANS } = require('./lib/plan-info');
const { fmtTokens, fmtDate, fmtTime } = require('./lib/format');

const SCRIPTS_DIR = __dirname;
const REPO = 'ww-w-ai/cc-token-saver';
const WINDOW_SECS = FIVE_HOURS_S;

function log(msg) {
  process.stderr.write(msg + '\n');
}


// Parse --plan argument
let plan = null;
const planIdx = process.argv.indexOf('--plan');
if (planIdx !== -1 && process.argv[planIdx + 1]) {
  const val = process.argv[planIdx + 1];
  if (VALID_PLANS.includes(val)) {
    plan = val;
  } else {
    log('Invalid plan: ' + val + '. Valid: ' + VALID_PLANS.join(', '));
    process.exit(1);
  }
}

// ── Step 1: Run analyze-usage.js to ensure timeline CSVs exist ──
log('Running analyze-usage.js to ensure timeline CSVs exist...');
try {
  execFileSync('node', [path.join(SCRIPTS_DIR, 'analyze-usage.js')], {
    stdio: ['pipe', 'pipe', 'inherit'],
    maxBuffer: 100 * 1024 * 1024,
  });
} catch (e) {
  log('Warning: analyze-usage.js failed, continuing with existing CSVs');
}

// ── Step 2: Scan timeline CSVs for rate-limited windows ─────────
if (!fs.existsSync(CACHE_DIR)) {
  log('No cache directory found. Run /usage-view first.');
  process.exit(1);
}

const yymms = fs.readdirSync(CACHE_DIR).filter(d => /^\d{4}$/.test(d));
if (yymms.length === 0) {
  log('No YYMM directories found. Run /usage-view first.');
  process.exit(1);
}

// Map: winTs (string) -> { sessions: Set<sessionId> }
// Deduplicate: only take FIRST occurrence of limit_hit per unique win value
const windowMap = new Map();

for (const ym of yymms) {
  const dir = path.join(CACHE_DIR, ym);
  if (!fs.statSync(dir).isDirectory()) continue;
  const csvs = fs.readdirSync(dir).filter(f => f.startsWith('timeline-') && f.endsWith('.csv'));

  for (const csv of csvs) {
    const sessionId = csv.replace('timeline-', '').replace('.csv', '');
    const content = fs.readFileSync(path.join(dir, csv), 'utf8').trim();
    if (!content) continue;
    const lines = content.split('\n');
    let prevWin = '';

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 11) continue;
      const win = cols[9] !== '' ? cols[9] : prevWin;
      if (cols[9] !== '') prevWin = cols[9];
      const rl = cols[10] || '';
      if (rl.startsWith('limit_hit_5h') || rl.startsWith('limit_hit_unknown')) {
        // Only register this window once (first hit); skip repeated rejections in same window
        if (!windowMap.has(win)) windowMap.set(win, { sessions: new Set(), hasUnknown: false });
        windowMap.get(win).sessions.add(sessionId);
        if (rl.startsWith('limit_hit_unknown')) windowMap.get(win).hasUnknown = true;
      }
    }
  }
}

if (windowMap.size === 0) {
  log('No rate-limited windows found in cached data. Run /usage-view first to analyze all sessions, then try again.');
  process.exit(0);
}

log('Found ' + windowMap.size + ' raw rate-limited window(s).');

// ── Step 3: Merge overlapping windows ─────────────────────────────
const windowStarts = [...windowMap.keys()].map(Number);
const mergedWindows = mergeWindows(windowStarts, WINDOW_SECS);

log('After merging: ' + mergedWindows.length + ' window(s).');

// ── Step 4: For each merged window, collect ALL rows within the range ──
const results = [];
const fmtD = fmtDate;
const fmtT = fmtTime;

for (const merged of mergedWindows) {
  const winStart = merged.start;
  const winEnd = merged.end;
  const rows = [];
  const touchedFiles = { timeline: new Set(), ratelimit: new Set() };
  // Token aggregation per window
  let sumInput = 0, sumOutput = 0, sumCacheWrite = 0, sumCacheRead = 0;

  // Collect sessions and hasUnknown from all constituent windowMap entries
  const mergedSessions = new Set();
  let hasUnknown = false;
  for (const [winTs, info] of windowMap) {
    const ws = Number(winTs);
    if (ws >= winStart && ws < winEnd) {
      for (const s of info.sessions) mergedSessions.add(s);
      if (info.hasUnknown) hasUnknown = true;
    }
  }

  for (const ym of yymms) {
    const dir = path.join(CACHE_DIR, ym);
    if (!fs.statSync(dir).isDirectory()) continue;
    const csvs = fs.readdirSync(dir).filter(f => f.startsWith('timeline-') && f.endsWith('.csv'));

    for (const csv of csvs) {
      const sessionId = csv.replace('timeline-', '').replace('.csv', '');
      const filePath = path.join(dir, csv);
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (!content) continue;
      const lines = content.split('\n');
      let hasRows = false;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 11) continue;
        const ts = Number(cols[0]);
        if (ts < winStart || ts >= winEnd) continue;
        rows.push(lines[i] + ',' + sessionId);
        hasRows = true;
        // cols: ts(0),model(1),input(2),cc(3),cc5m(4),cc1h(5),cr(6),out(7),cost(8),win(9),rl(10),evt(11)
        sumInput += Number(cols[2]) || 0;
        sumOutput += Number(cols[7]) || 0;
        sumCacheWrite += (Number(cols[3]) || 0) + (Number(cols[4]) || 0) + (Number(cols[5]) || 0);
        sumCacheRead += Number(cols[6]) || 0;
      }

      if (hasRows) {
        touchedFiles.timeline.add(filePath);
        // Include corresponding ratelimit CSV for this session
        const rlPath = path.join(dir, 'ratelimit-' + sessionId + '.csv');
        if (fs.existsSync(rlPath)) {
          touchedFiles.ratelimit.add(rlPath);
        }
      }
    }
  }

  rows.sort((a, b) => Number(a.split(',')[0]) - Number(b.split(',')[0]));

  const startD = new Date(winStart * 1000);
  const endD = new Date(winEnd * 1000);
  const totalCost = rows.reduce((s, r) => s + Number(r.split(',')[8]), 0);

  results.push({
    winTs: String(winStart),
    date: fmtD(startD),
    start: fmtT(startD),
    end: fmtT(endD),
    sessions: mergedSessions.size,
    requests: rows.length,
    cost: Math.round(totalCost * 100) / 100,
    input: sumInput,
    output: sumOutput,
    cacheWrite: sumCacheWrite,
    cacheRead: sumCacheRead,
    csvHeader: 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,session',
    csvRows: rows,
    touchedFiles,
    hasUnknown,
  });
}

// ── Step 5: Build session index & write per-window CSV files ────
const reportDir = path.join(os.tmpdir(), 'report-limit-' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 15));
fs.mkdirSync(reportDir, { recursive: true });
log('Report directory: ' + reportDir);

// Build global session index (full sessionId -> sequential 1-based number)
const sessionIndex = new Map();
let sessionCounter = 0;

for (const w of results) {
  for (const row of w.csvRows) {
    const cols = row.split(',');
    const sessionId = cols[cols.length - 1]; // last column is session
    if (!sessionIndex.has(sessionId)) {
      sessionIndex.set(sessionId, ++sessionCounter);
    }
  }
}

// Determine parent for agent sessions
// For each window, group sessions by YYMM folder. If an agent session shares a
// window with exactly one main session in the same folder, that main is its parent.
const sessionParent = new Map(); // sessionId -> parent sessionId or ''

for (const w of results) {
  // Group touched timeline files by YYMM folder
  const folderSessions = new Map(); // folder -> { main: [], agent: [] }
  for (const f of w.touchedFiles.timeline) {
    const folder = path.basename(path.dirname(f));
    const sid = path.basename(f).replace('timeline-', '').replace('.csv', '');
    if (!folderSessions.has(folder)) folderSessions.set(folder, { main: [], agent: [] });
    const group = folderSessions.get(folder);
    if (sid.startsWith('agent-')) {
      group.agent.push(sid);
    } else {
      group.main.push(sid);
    }
  }

  for (const [, group] of folderSessions) {
    for (const agentSid of group.agent) {
      // Only assign parent if not already assigned and exactly one main session in folder
      if (!sessionParent.has(agentSid) && group.main.length === 1) {
        sessionParent.set(agentSid, group.main[0]);
      }
    }
  }
}

// Write sessions.csv
let sessionsCsv = 'num,id,type,parent\n';
for (const [sid, num] of sessionIndex) {
  const type = sid.startsWith('agent-') ? 'agent' : 'main';
  const parentSid = sessionParent.get(sid) || '';
  const parentNum = parentSid ? String(sessionIndex.get(parentSid) || '') : '';
  sessionsCsv += num + ',' + sid + ',' + type + ',' + parentNum + '\n';
}
fs.writeFileSync(path.join(reportDir, 'sessions.csv'), sessionsCsv);

// Write per-window CSV files with numeric session IDs
for (const w of results) {
  const mappedRows = w.csvRows.map(row => {
    const cols = row.split(',');
    const sessionId = cols[cols.length - 1];
    cols[cols.length - 1] = String(sessionIndex.get(sessionId) || 0);
    return cols.join(',');
  });
  const csvContent = w.csvHeader + '\n' + mappedRows.join('\n') + '\n';
  const fileName = 'window-' + w.date + '-' + w.start.replace(':', '') + '.csv';
  fs.writeFileSync(path.join(reportDir, fileName), csvContent);
}

// ── Step 6: Copy relevant timeline and ratelimit CSVs ───────────
const allRatelimitFiles = new Set();
for (const w of results) {
  for (const f of w.touchedFiles.timeline) {
    const dest = path.join(reportDir, path.basename(f));
    if (!fs.existsSync(dest)) fs.copyFileSync(f, dest);
  }
  for (const f of w.touchedFiles.ratelimit) {
    if (!allRatelimitFiles.has(f)) allRatelimitFiles.add(f);
  }
}

// Merge all ratelimit CSVs into a single ratelimit.csv (dedup + sort by ts)
if (allRatelimitFiles.size > 0) {
  const allRows = new Set();
  for (const f of allRatelimitFiles) {
    const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]) allRows.add(lines[i]);
    }
  }
  const sorted = [...allRows].sort((a, b) => Number(a.split(',')[0]) - Number(b.split(',')[0]));
  // Dedup: keep only rows where 5h or 7d changed from previous
  const deduped = [];
  let prev5h = null, prev7d = null;
  for (const row of sorted) {
    const cols = row.split(',');
    const cur5h = cols[1] || '';
    const cur7d = cols[3] || '';
    if (cur5h !== prev5h || cur7d !== prev7d) {
      deduped.push(row);
      if (cur5h) prev5h = cur5h;
      if (cur7d) prev7d = cur7d;
    }
  }
  fs.writeFileSync(path.join(reportDir, 'ratelimit.csv'),
    'ts,5h,5h_reset,7d,7d_reset,alert\n' + deduped.join('\n') + '\n');
}

// ── Step 7: Compress files into zip ─────────────────────────────
const zipFile = reportDir + '.zip';
let zipCreated = false;
try {
  const allFiles = fs.readdirSync(reportDir).filter(f => f.endsWith('.csv')).map(f => path.join(reportDir, f));
  if (allFiles.length > 0) {
    execFileSync('zip', ['-j', zipFile].concat(allFiles), {
      stdio: 'pipe',
      timeout: 30000,
    });
    zipCreated = true;
    log('Zip created: ' + zipFile);
  }
} catch (e) {
  log('Warning: zip compression failed — ' + e.message);
}

// ── Step 8: Try uploading zip to GitHub gist ────────────────────
let gistUrl = null;
let ghAuthenticated = false;
try {
  execFileSync('gh', ['auth', 'status'], { stdio: 'pipe' });
  ghAuthenticated = true;
} catch (e) {
  log('GitHub CLI not authenticated. Run "gh auth login" to authenticate.');
}

if (ghAuthenticated) {
  try {
    // Gist only supports text files — upload window + ratelimit CSVs
    const gistFiles = fs.readdirSync(reportDir)
      .filter(f => (f.startsWith('window-') || f === 'ratelimit.csv' || f === 'sessions.csv') && f.endsWith('.csv'))
      .map(f => path.join(reportDir, f));
    if (gistFiles.length > 0) {
      const result = execFileSync('gh', ['gist', 'create', '--public'].concat(gistFiles), {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      }).trim();
      if (result.startsWith('http')) {
        gistUrl = result;
        log('Gist created: ' + gistUrl);
      }
    }
  } catch (e) {
    log('Gist upload failed: ' + (e.stderr ? e.stderr.toString().trim() : e.message));
  }
}

// ── Step 9: Build Discussion URL ────────────────────────────────

// Get Claude Code version
let ccVersion = 'unknown';
try {
  ccVersion = execFileSync('claude', ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
} catch (e) { /* ignore */ }

const windowList = results.map(w => w.date + ' ' + w.start + '-' + w.end).join(', ');
const totalCostAll = Math.round(results.reduce((s, w) => s + w.cost, 0) * 100) / 100;
const totalRequests = results.reduce((s, w) => s + w.requests, 0);
const totalSessions = new Set(results.flatMap(w => [...w.touchedFiles.timeline].map(f => path.basename(f)))).size;
const totalInput = results.reduce((s, w) => s + w.input, 0);
const totalOutput = results.reduce((s, w) => s + w.output, 0);
const totalCacheWrite = results.reduce((s, w) => s + w.cacheWrite, 0);
const totalCacheRead = results.reduce((s, w) => s + w.cacheRead, 0);
const today = new Date();
const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

// Discussion title (short — details go in body)
const title = '\u{1F480} Rate Limit Report (' + results.length + ' window' + (results.length > 1 ? 's' : '') + ') \u2014 $' + totalCostAll;

// Discussion body — per-window table
function buildWindowTable() {
  let table = '| Window | Cost | Requests | Sessions | Input | Output | Cache Write | Cache Read |\n'
    + '|--------|------|----------|----------|-------|--------|-------------|------------|\n';
  for (const w of results) {
    table += '| ' + w.date + ' ' + w.start + '-' + w.end
      + ' | $' + w.cost
      + ' | ' + w.requests
      + ' | ' + w.sessions
      + ' | ' + fmtTokens(w.input)
      + ' | ' + fmtTokens(w.output)
      + ' | ' + fmtTokens(w.cacheWrite)
      + ' | ' + fmtTokens(w.cacheRead)
      + ' |\n';
  }
  table += '| **Total** | **$' + totalCostAll
    + '** | **' + totalRequests
    + '** | **' + totalSessions
    + '** | **' + fmtTokens(totalInput)
    + '** | **' + fmtTokens(totalOutput)
    + '** | **' + fmtTokens(totalCacheWrite)
    + '** | **' + fmtTokens(totalCacheRead)
    + '** |\n';
  return table;
}

let body;
if (gistUrl) {
  body = '## Rate Limit Data Point\n\n'
    + buildWindowTable() + '\n'
    + '## Raw Data\n'
    + '\u{1F4CE} ' + gistUrl + '\n\n'
    + '## Context\n'
    + '- Plan: ' + (plan ? PLAN_INFO[plan].label : 'unknown') + '\n'
    + '- Claude Code version: ' + ccVersion + '\n'
    + '- Date: ' + dateStr;
} else {
  const zipNote = zipCreated
    ? '\u{1F4CE} Please attach: `' + zipFile + '`'
    : '\u{1F4CE} Please attach CSV files from: `' + reportDir + '/`';
  body = '## Rate Limit Data Point\n\n'
    + buildWindowTable() + '\n'
    + '## Raw Data\n'
    + zipNote + '\n\n'
    + '## Context\n'
    + '- Plan: ' + (plan ? PLAN_INFO[plan].label : 'unknown') + '\n'
    + '- Claude Code version: ' + ccVersion + '\n'
    + '- Date: ' + dateStr;
}

// Note about unknown rate limit types (only if any window has them)
if (results.some(w => w.hasUnknown)) {
  body += '\n\n> **Note:** Some rows contain `limit_hit_unknown` — the rate limit type could not be classified. Most likely 5h window limits, but may be weekly. Data is scoped to 5h windows regardless.';
}

// Sanitize: replace $HOME with ~, redact API keys
const homeDir = os.homedir();
const homeRegex = new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
body = body.replace(homeRegex, '~');
body = body.replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED]');
body = body.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
body = body.replace(/(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*\S+/gi, '$1=[REDACTED]');

// ── Step 10: Open Discussion URL in browser ────────────────────
const discussionUrl = 'https://github.com/' + REPO + '/discussions/new'
  + '?category=rate-limits'
  + '&title=' + encodeURIComponent(title)
  + '&body=' + encodeURIComponent(body);

let discussionOpened = false;
try {
  execFileSync('open', [discussionUrl], { stdio: 'pipe' });
  discussionOpened = true;
  log('Discussion opened in browser.');
} catch (e) {
  log('Could not open browser. Discussion URL:\n' + discussionUrl);
}

// ── Step 11: If gist failed, open containing directory in Finder ────────────
if (!gistUrl) {
  const openTarget = zipCreated ? path.dirname(zipFile) : reportDir;
  try {
    execFileSync('open', [openTarget], { stdio: 'pipe' });
    log('Opened directory in Finder: ' + openTarget);
  } catch (e) {
    log('Could not open Finder. Files at: ' + openTarget);
  }
}

// ── Step 12: Print JSON summary to stdout ───────────────────────
const summary = {
  windows: results.map(w => ({
    date: w.date,
    start: w.start,
    end: w.end,
    cost: w.cost,
    requests: w.requests,
    sessions: w.sessions,
    input: w.input,
    output: w.output,
    cacheWrite: w.cacheWrite,
    cacheRead: w.cacheRead,
  })),
  totalCost: totalCostAll,
  ghAuthenticated: ghAuthenticated,
  gistUrl: gistUrl,
  zipFile: zipCreated ? zipFile : null,
  reportDir: reportDir,
  discussionOpened: discussionOpened,
};

console.log(JSON.stringify(summary, null, 2));
