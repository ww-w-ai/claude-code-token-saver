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

const SCRIPTS_DIR = __dirname;
const CACHE_BASE = path.join(os.homedir(), '.claude', 'cc-token-saver');
const REPO = 'ww-w-ai/cc-token-saver';
const WINDOW_SECS = 5 * 3600; // 18000

function log(msg) {
  process.stderr.write(msg + '\n');
}

const VALID_PLANS = ['pro', 'max100', 'max200', 'team', 'team_premium', 'enterprise', 'bedrock', 'foundry', 'vertex'];
const PLAN_LABELS = {
  pro: 'Pro ($20/mo)',
  max100: 'Max 5x ($100/mo)',
  max200: 'Max 20x ($200/mo)',
  team: 'Team Standard ($20/seat/mo)',
  team_premium: 'Team Premium ($100/seat/mo)',
  enterprise: 'Enterprise',
  bedrock: 'Amazon Bedrock',
  foundry: 'Microsoft Foundry',
  vertex: 'Google Vertex AI',
};

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
if (!fs.existsSync(CACHE_BASE)) {
  log('No cache directory found. Run /usage-view first.');
  process.exit(1);
}

const yymms = fs.readdirSync(CACHE_BASE).filter(d => /^\d{4}$/.test(d));
if (yymms.length === 0) {
  log('No YYMM directories found. Run /usage-view first.');
  process.exit(1);
}

// Map: winTs (string) -> { sessions: Set<sessionId> }
const windowMap = new Map();

for (const ym of yymms) {
  const dir = path.join(CACHE_BASE, ym);
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

log('Found ' + windowMap.size + ' rate-limited window(s).');

// ── Step 3-4: For each window, collect ALL rows within the 5h range ──
const results = [];

for (const [winTs, info] of windowMap) {
  const winStart = Number(winTs);
  const winEnd = winStart + WINDOW_SECS;
  const rows = [];
  const touchedFiles = { timeline: new Set(), ratelimit: new Set() };

  for (const ym of yymms) {
    const dir = path.join(CACHE_BASE, ym);
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
        if (ts < winStart || ts > winEnd) continue;
        rows.push(lines[i] + ',' + sessionId);
        hasRows = true;
      }

      if (hasRows) {
        touchedFiles.timeline.add(filePath);
        // Check for corresponding ratelimit CSV
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
  const fmtD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fmtT = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const totalCost = rows.reduce((s, r) => s + Number(r.split(',')[8]), 0);

  results.push({
    winTs,
    date: fmtD(startD),
    start: fmtT(startD),
    end: fmtT(endD),
    sessions: info.sessions.size,
    requests: rows.length,
    cost: Math.round(totalCost * 100) / 100,
    csvHeader: 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,session',
    csvRows: rows,
    touchedFiles,
    hasUnknown: info.hasUnknown,
  });
}

// ── Step 5: Write per-window CSV files to temp dir ──────────────
const reportDir = path.join(os.tmpdir(), 'report-limit-' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 15));
fs.mkdirSync(reportDir, { recursive: true });
log('Report directory: ' + reportDir);

for (const w of results) {
  const csvContent = w.csvHeader + '\n' + w.csvRows.join('\n') + '\n';
  const fileName = 'window-' + w.date + '-' + w.start.replace(':', '') + '.csv';
  fs.writeFileSync(path.join(reportDir, fileName), csvContent);
}

// ── Step 6: Copy relevant timeline and ratelimit CSVs ───────────
for (const w of results) {
  for (const f of w.touchedFiles.timeline) {
    const dest = path.join(reportDir, path.basename(f));
    if (!fs.existsSync(dest)) fs.copyFileSync(f, dest);
  }
  for (const f of w.touchedFiles.ratelimit) {
    const dest = path.join(reportDir, path.basename(f));
    if (!fs.existsSync(dest)) fs.copyFileSync(f, dest);
  }
}

// ── Step 7: Try uploading to GitHub gist ────────────────────────
let gistUrl = null;
try {
  execFileSync('gh', ['auth', 'status'], { stdio: 'pipe' });
  const csvFiles = fs.readdirSync(reportDir).filter(f => f.endsWith('.csv')).map(f => path.join(reportDir, f));
  if (csvFiles.length > 0) {
    const ghArgs = ['gist', 'create', '--public'].concat(csvFiles);
    const result = execFileSync('gh', ghArgs, {
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
  log('Gist upload failed (gh not available or not authenticated). Will open temp folder instead.');
}

// ── Step 8-9: Build Discussion URL ──────────────────────────────

// Get Claude Code version
let ccVersion = 'unknown';
try {
  ccVersion = execFileSync('claude', ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
} catch (e) { /* ignore */ }

const windowList = results.map(w => w.date + ' ' + w.start + '-' + w.end).join(', ');
const totalCostAll = Math.round(results.reduce((s, w) => s + w.cost, 0) * 100) / 100;
const totalRequests = results.reduce((s, w) => s + w.requests, 0);
const totalSessions = new Set(results.flatMap(w => [...w.touchedFiles.timeline].map(f => path.basename(f)))).size;
const today = new Date();
const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

// Discussion title
const title = '[Usage Data] \u{1F480} Window: ' + windowList + ' \u2014 $' + totalCostAll;

// Discussion body
let body;
if (gistUrl) {
  body = '## Rate Limit Data Point\n\n'
    + '| Field | Value |\n'
    + '|-------|-------|\n'
    + '| Window(s) | ' + windowList + ' |\n'
    + '| Total Cost | $' + totalCostAll + ' |\n'
    + '| API Requests | ' + totalRequests + ' |\n'
    + '| Sessions | ' + totalSessions + ' |\n\n'
    + '## Raw Data\n'
    + '\u{1F4CE} ' + gistUrl + '\n\n'
    + '## Context\n'
    + '- Plan: ' + (plan ? PLAN_LABELS[plan] : 'unknown') + '\n'
    + '- Claude Code version: ' + ccVersion + '\n'
    + '- Date: ' + dateStr;
} else {
  const fileList = fs.readdirSync(reportDir).filter(f => f.endsWith('.csv')).map(f => '- ' + f).join('\n');
  body = '## Rate Limit Data Point\n\n'
    + '| Field | Value |\n'
    + '|-------|-------|\n'
    + '| Window(s) | ' + windowList + ' |\n'
    + '| Total Cost | $' + totalCostAll + ' |\n'
    + '| API Requests | ' + totalRequests + ' |\n'
    + '| Sessions | ' + totalSessions + ' |\n\n'
    + '## Raw Data\n'
    + '\u{1F4CE} Please attach CSV files from: ' + reportDir + '/\n'
    + 'Files prepared:\n'
    + fileList + '\n\n'
    + '## Context\n'
    + '- Plan: ' + (plan ? PLAN_LABELS[plan] : 'unknown') + '\n'
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

// ── Step 10: Open Discussion URL in browser ─────────────────────
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

// ── Step 11: If gist failed, open temp dir in Finder ────────────
if (!gistUrl) {
  try {
    execFileSync('open', [reportDir], { stdio: 'pipe' });
    log('Opened report directory in Finder: ' + reportDir);
  } catch (e) {
    log('Could not open Finder. Files at: ' + reportDir);
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
  })),
  totalCost: totalCostAll,
  gistUrl: gistUrl,
  reportDir: reportDir,
  discussionOpened: discussionOpened,
};

console.log(JSON.stringify(summary, null, 2));
