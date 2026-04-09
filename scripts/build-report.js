#!/usr/bin/env node
/**
 * build-report.js — HTML dashboard builder
 *
 * Reads analyze-usage.js output (JSON) + timeline CSVs + ratelimit CSVs,
 * constructs REPORT_DATA, and injects it into the template.html dashboard.
 * Also generates an AI analysis prompt for LLM-powered insights.
 *
 * Win correction: Uses actual 5h window boundaries from ratelimit CSVs
 * (5h_reset column) to correct hourFloor-based wins in timeline CSVs.
 *
 * ALERT_LINE_RE: Simplified regex — all markers captured as one group,
 * then parsed individually via string matching.
 *
 * Usage: node build-report.js [options]
 *   --data <path>           analyze-usage.js JSON output (required)
 *   --output <path>         Output HTML file path (required)
 *   --current               Current 5-hour window mode (session detail pre-opened)
 *   --ai-data <path>        AI analysis JSON to inject into report
 *   --export-prompt <path>  Export AI analysis prompt to file (for agent consumption)
 *   --export-data <path>    Export REPORT_DATA as JSON (for --import-data)
 *   --import-data <path>    Import pre-built REPORT_DATA instead of building from CSVs
 *   --locale <code>         Force locale (default: system language → en fallback)
 *
 * Input:
 *   - analyze-usage.js JSON output (--data)
 *   - ~/.claude/cc-token-saver/{projectName}/{sessionId}/timeline.csv   (per-API-call data)
 *   - ~/.claude/cc-token-saver/{projectName}/{sessionId}/ratelimit.csv  (statusline rate limit logs)
 *   - skills/usage-view/template.html                              (dashboard template)
 *   - locales/{code}.json                                          (i18n strings)
 *
 * Output:
 *   - Self-contained HTML file with inline CSS/JS, Chart.js CDN
 *   - REPORT_DATA object: windows (5h buckets), calendar, cost/token aggregates
 *     - windows[].rlHours: hours within window where limit_hit occurred (renders as skulls on calendar)
 *     - windows[].alertMessages: from ratelimit CSVs (5h threshold crossings)
 *
 * Supported locales (23): en ko ja zh es fr de pt it ru ar hi bn id ms th vi tr pl nl he sv no
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanRatelimitWindows, mergeWindows, FIVE_HOURS_S } = require('./lib/window-utils');
const { listProjects, listSessions, listSubagents, getTimelinePath, getSummaryPath, getRatelimitPath, getSubagentTimelinePath, getSubagentSummaryPath, getCompactPath, migrateFromYYMM, CACHE_BASE: CACHE_DIR } = require('./lib/cache-paths');
const { PLAN_INFO: PLAN_INFO_ALL } = require('./lib/plan-info');
const { round2 } = require('./lib/format');
const { SUPPORTED_LOCALES, resolveLocale } = require('./lib/locale');
const { MODEL_PRICING, DEFAULT_PRICING, getRates } = require('./lib/pricing');
const TEMPLATE_PATH = path.join(__dirname, '..', 'skills', 'usage-view', 'template.html');
const LOCALES_DIR = path.join(__dirname, '..', 'locales');

// ── Args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let dataPath = null, outputPath = null, currentMode = false, aiDataPath = null, exportPromptPath = null, exportDataPath = null, importDataPath = null, localeArg = null, planArg = null, projectFilter = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--data' && args[i + 1]) { dataPath = args[++i]; }
  else if (args[i] === '--output' && args[i + 1]) { outputPath = args[++i]; }
  else if (args[i] === '--current') { currentMode = true; }
  else if (args[i] === '--ai-data' && args[i + 1]) { aiDataPath = args[++i]; }
  else if (args[i] === '--export-prompt' && args[i + 1]) { exportPromptPath = args[++i]; }
  else if (args[i] === '--export-data' && args[i + 1]) { exportDataPath = args[++i]; }
  else if (args[i] === '--import-data' && args[i + 1]) { importDataPath = args[++i]; }
  else if (args[i] === '--locale' && args[i + 1]) { localeArg = args[++i]; }
  else if (args[i] === '--plan' && args[i + 1]) { planArg = args[++i]; }
  else if (args[i] === '--project' && args[i + 1]) { projectFilter = args[++i]; }
}
const resolvedLocale = resolveLocale(localeArg);
let localeData;
try {
  localeData = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, resolvedLocale + '.json'), 'utf8'));
} catch (e) {
  localeData = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
}
// Force technical content to English (prevents mixed-language bidi issues in charts/tables/alerts)
// Only section headings (header.title, token.detail, token.costRatio, chart titles, calendar.title, ai.*) stay localized
if (resolvedLocale !== 'en') {
  const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
  // Token data labels — appear in charts & tables
  Object.assign(localeData.token, {
    input: en.token.input, output: en.token.output,
    cacheWrite: en.token.cacheWrite, cacheRead: en.token.cacheRead,
    cache1hTier: en.token.cache1hTier, cache5mTier: en.token.cache5mTier,
    total: en.token.total, type: en.token.type, tokens: en.token.tokens, cost: en.token.cost
  });
  // Chart data labels (day names, avg/max, hour suffix, legend, efficiency notes)
  Object.assign(localeData.chart, {
    days: en.chart.days, hourSuffix: en.chart.hourSuffix,
    avg: en.chart.avg, max: en.chart.max,
    avgCost: en.chart.avgCost, maxCost: en.chart.maxCost,
    legendAverage: en.chart.legendAverage,
    effTotalPerOutput: en.chart.effTotalPerOutput,
    effCachePerOutput: en.chart.effCachePerOutput,
    effNote: en.chart.effNote
  });
  // Alert & session: use bidi marks in locale files instead (he.json, ar.json)
}

// Bidi post-processor: wrap English terms with LRM/RLM in RTL text
const isRTL = localeData.meta && localeData.meta.direction === 'rtl';
function addBidiMarks(text) {
  if (!isRTL || typeof text !== 'string') return text;
  // Match: /commands, English words (incl. hyphenated/dotted like cc-token-saver, c0d.run)
  return text.replace(/(\/[\w-]+|[A-Za-z][\w.-]*(?:\s+[A-Za-z][\w.-]*)*)/g, '\u200E$1\u200F');
}
function addBidiToAI(aiAnalysis) {
  if (!aiAnalysis) return;
  for (const key of ['section1', 'section2', 'section3', 'section4']) {
    if (typeof aiAnalysis[key] === 'string') {
      aiAnalysis[key] = addBidiMarks(aiAnalysis[key]);
    }
  }
}

if ((!dataPath && !importDataPath) || !outputPath) {
  console.error('Usage: node build-report.js --data <results.json> --output <report.html>');
  process.exit(1);
}

// ── i18n injection helper ──────────────────────────────────────
function injectI18N(html) {
  const i18nStart = '/*<!-- I18N_START -->*/';
  const i18nEnd = '/*<!-- I18N_END -->*/';
  const si = html.indexOf(i18nStart);
  const ei = html.indexOf(i18nEnd);
  if (si === -1 || ei === -1) return html;
  return html.slice(0, si) +
    i18nStart + '\nconst I18N = ' + JSON.stringify(localeData, null, 0) + ';\n' + i18nEnd +
    html.slice(ei + i18nEnd.length);
}

function injectHtmlLang(html) {
  const dir = localeData.meta && localeData.meta.direction === 'rtl' ? ' dir="rtl"' : '';
  return html.replace(/<html lang="[^"]*"[^>]*>/, `<html lang="${resolvedLocale}"${dir}>`);
}

// ── Helpers ─────────────────────────────────────────────────────
function fsd(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
function fsdKey(d) { return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0'); }
function ft(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function ym(ts) { const d = new Date(ts); return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0'); }
function getParentId(filePath) {
  if (!filePath || !filePath.includes('/subagents/')) return null;
  return path.basename(filePath.split('/subagents/')[0] + '.jsonl', '.jsonl');
}

function isProgrammatic(session) {
  if (session.filePath && session.filePath.includes('/subagents/')) return false;
  if (session.userMsgs !== 1) return false;
  if (!session.firstUserMsg) return true;
  const patterns = [/^You are generating/, /^Read the /, /^Run the /, /^CRITICAL:/, /^Write the word/, /^Compare the /, /^This session is being continued/];
  return patterns.some(p => p.test(session.firstUserMsg));
}

// ── Import mode: skip all processing, just inject into template ─
if (importDataPath) {
  const reportData = JSON.parse(fs.readFileSync(importDataPath, 'utf8'));
  if (aiDataPath) {
    try {
      const aiAnalysis = JSON.parse(fs.readFileSync(aiDataPath, 'utf8'));
      if (aiAnalysis.section1 || aiAnalysis.section2 || aiAnalysis.section3 || aiAnalysis.section4) {
        addBidiToAI(aiAnalysis);
        reportData.aiAnalysis = aiAnalysis;
        const count = [aiAnalysis.section1, aiAnalysis.section2, aiAnalysis.section3, aiAnalysis.section4].filter(Boolean).length;
        console.error('AI analysis: ' + count + ' sections loaded from ' + aiDataPath);
      }
    } catch (e) {
      console.error('AI analysis: failed to read ' + aiDataPath + ' - ' + e.message);
    }
  }
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  template = injectI18N(template);
  template = injectHtmlLang(template);
  const marker_start = '/*<!-- REPORT_DATA_START -->*/';
  const marker_end = '/*<!-- REPORT_DATA_END -->*/';
  const startIdx = template.indexOf(marker_start);
  const endRaw = template.indexOf(marker_end);
  if (startIdx === -1 || endRaw === -1) {
    console.error('Error: REPORT_DATA markers not found in template');
    process.exit(1);
  }
  const endIdx = endRaw + marker_end.length;
  const output = template.slice(0, startIdx) +
    marker_start + '\nconst REPORT_DATA = ' + JSON.stringify(reportData, null, 0) + ';\n' + marker_end +
    template.slice(endIdx);
  fs.writeFileSync(outputPath, output);
  console.error(`Report written to ${outputPath} (${output.length} bytes)`);
  process.exit(0);
}

// ── Load data ───────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ── Read all timeline CSVs ──────────────────────────────────────
// CSV header: ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl
// sessionId may be passed with project context via _sessionProjectMap
const _sessionProjectMap = new Map(); // sessionId → projectName (populated during scanning)

function readTimelineCsv(sessionId) {
  // New structure: look up project from _sessionProjectMap
  const proj = _sessionProjectMap.get(sessionId);
  let csvPath = null;
  if (proj) {
    csvPath = getTimelinePath(proj, sessionId);
  }
  if (!csvPath || !fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const rows = [];
  let prevModel = '';
  let prevWin = '';
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 11) continue;
    const model = cols[1] || prevModel;
    const win = cols[9] || prevWin;
    if (cols[1]) prevModel = cols[1];
    if (cols[9]) prevWin = cols[9];
    rows.push({
      ts: Number(cols[0]),
      model,
      input: Number(cols[2]),
      cc: Number(cols[3]),
      cc5m: Number(cols[4]),
      cc1h: Number(cols[5]),
      cr: Number(cols[6]),
      out: Number(cols[7]),
      cost: Number(cols[8]),
      win: Number(win),
      rl: cols[10] || '',
      evt: cols[11] || ''
    });
  }
  return rows;
}

// Build session lookup
const sessionMap = new Map();
for (const s of raw.sessions) {
  sessionMap.set(s.sessionId, s);
}

// Migrate old YYMM structure (idempotent)
migrateFromYYMM();

// Populate _sessionProjectMap by scanning new project/session structure
{
  const projects = projectFilter ? [projectFilter] : listProjects();
  for (const proj of projects) {
    const sessions = listSessions(proj);
    for (const sess of sessions) {
      _sessionProjectMap.set(sess, proj);
      // Also map subagent IDs
      const agents = listSubagents(proj, sess);
      for (const agent of agents) {
        _sessionProjectMap.set(agent, proj);
      }
    }
  }
}

// Collect all timeline rows, keyed by sessionId
const allTimelines = new Map();
for (const s of raw.sessions) {
  const rows = readTimelineCsv(s.sessionId);
  if (rows.length > 0) allTimelines.set(s.sessionId, rows);
}

// Flatten all rows for aggregation
const allRows = [];
for (const [, rows] of allTimelines) {
  for (const row of rows) allRows.push(row);
}

// ── Scan compact caches for alert messages ─────────────────────
// Simplified format: [L{n} User HH:MM]{allMarkers} {text}
// Groups: 1=lineNum, 2=time, 3=allMarkers (entire marker string), 4=text
// Individual markers are parsed from group 3 via string matching.
// Marker chars: @ (startup/clear) * (cost) # (context) + (resume/compact) ~ (reload-plugins)
//   ! (model-change) ? (resume-heuristic) ^ (/continue skill) % (rate-limit)
const ALERT_LINE_RE = /^\[L(\d+) User ((?:\d{2}-\d{2}T)?\d+:\d+)\]([^\s]*)\s*(.*)/;

const { execFile } = require('child_process');
const PREPROCESS_PATH = path.join(__dirname, 'preprocess.js');
const PARALLEL_LIMIT = 5;

// Batch-generate missing compact caches in parallel
function generateMissingCompacts(sessionIds) {
  const tasks = [];
  for (const sid of sessionIds) {
    const sess = sessionMap.get(sid);
    if (!sess) continue;
    const isSubagent = sess.filePath && sess.filePath.includes('/subagents/');
    if (isSubagent) continue;
    if (!sess.filePath || !fs.existsSync(sess.filePath)) continue;
    const proj = _sessionProjectMap.get(sid);
    if (!proj) continue;
    const compactFilePath = getCompactPath(proj, sid, false);
    if (fs.existsSync(compactFilePath)) continue;
    fs.mkdirSync(path.dirname(compactFilePath), { recursive: true });
    tasks.push({ sid, filePath: sess.filePath, compactPath: compactFilePath });
  }
  if (tasks.length === 0) return Promise.resolve();

  let idx = 0;
  let running = 0;
  return new Promise((resolve) => {
    function next() {
      while (running < PARALLEL_LIMIT && idx < tasks.length) {
        const t = tasks[idx++];
        running++;
        execFile('node', [PREPROCESS_PATH, t.filePath], { timeout: 30000 }, (err, stdout) => {
          if (!err && stdout) {
            try { fs.writeFileSync(t.compactPath, stdout); } catch(e) {}
          }
          running--;
          if (idx >= tasks.length && running === 0) resolve();
          else next();
        });
      }
    }
    next();
  });
}

function readCompactAlerts(sessionId) {
  const sess = sessionMap.get(sessionId);
  if (!sess) return [];
  const proj = _sessionProjectMap.get(sessionId);
  if (!proj) return [];
  const compactPath = getCompactPath(proj, sessionId, false);
  if (!fs.existsSync(compactPath)) return [];

  const content = fs.readFileSync(compactPath, 'utf8');
  const lines = content.split('\n');
  const alerts = [];

  for (const line of lines) {
    const m = ALERT_LINE_RE.exec(line);
    if (!m) continue;
    // Groups: 1=lineNum, 2=time, 3=allMarkers, 4=text
    const markers = m[3] || '';
    const sessionMark = (markers.match(/@{1,2}/) || [''])[0];
    const costMark = (markers.match(/\*{1,2}/) || [''])[0];
    const ctxMark = (markers.match(/#{1,2}/) || [''])[0];
    const resumeMark = (markers.match(/\+{1,2}/) || [''])[0];
    const reloadMark = markers.includes('~') ? '~' : '';
    const modelMark = markers.includes('!') ? '!' : '';
    const heuristicMark = markers.includes('?') ? '?' : '';
    const contMark = (markers.match(/\^{1,2}/) || [''])[0];
    const rlMark = (markers.match(/%[%5WOSX](?:\{[^}]+\})?/) || [''])[0];
    const text = m[4] || '';
    if (!markers) continue;
    // Session markers alone (no cost/ctx/continue/ratelimit) are not alerts — skip
    if (!costMark && !ctxMark && !contMark && !rlMark) continue;

    const alertTypes = [];
    if (costMark === '**') alertTypes.push('cost-danger');
    else if (costMark === '*') alertTypes.push('cost-warn');
    if (ctxMark === '##') alertTypes.push('ctx-danger');
    else if (ctxMark === '#') alertTypes.push('ctx-warn');
    if (resumeMark === '+') alertTypes.push('resume');
    else if (resumeMark === '++') alertTypes.push('compact');
    if (reloadMark === '~') alertTypes.push('reload-plugins');
    if (modelMark === '!') alertTypes.push('model-change');
    if (heuristicMark === '?') alertTypes.push('resume-heuristic');
    if (contMark === '^') alertTypes.push('continue-1');
    else if (contMark === '^^') alertTypes.push('continue-n');
    if (sessionMark === '@') alertTypes.push('startup');
    else if (sessionMark === '@@') alertTypes.push('clear');
    if (rlMark) {
      if (rlMark.startsWith('%%')) alertTypes.push('rate-limit-unknown');
      else if (rlMark.startsWith('%5')) alertTypes.push('rate-limit-5h');
      else if (rlMark.startsWith('%W')) alertTypes.push('rate-limit-weekly');
      else if (rlMark.startsWith('%O')) alertTypes.push('rate-limit-opus');
      else if (rlMark.startsWith('%S')) alertTypes.push('rate-limit-sonnet');
      else if (rlMark.startsWith('%X')) alertTypes.push('rate-limit-extra');
    }

    alerts.push({
      sessionId,
      lineNum: Number(m[1]),
      time: m[2],
      markers: markers,
      text: text.slice(0, 120),
      alertType: alertTypes.join('+') || 'unknown',
      tokens: null
    });
  }
  return alerts;
}

function matchAlertWithTimeline(alert, timelineRows) {
  if (!timelineRows || timelineRows.length === 0 || !alert.ts) return;
  let bestRow = null;
  let bestDiff = Infinity;
  for (const row of timelineRows) {
    if (row.evt) continue; // skip event rows (continue, compact) — no real token data
    const diff = Math.abs(row.ts - alert.ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestRow = row;
    }
  }
  if (bestRow && bestDiff < 7200) {
    alert.tokens = {
      input: bestRow.input,
      cc: bestRow.cc,
      cc5m: bestRow.cc5m,
      cc1h: bestRow.cc1h,
      cr: bestRow.cr,
      out: bestRow.out,
      cost: bestRow.cost
    };
  }
}

// ── Build REPORT_DATA ───────────────────────────────────────────
(async () => {

// 1. summary
const sm = raw.summary;
const fromD = new Date(sm.dateRange.from);
const toD = new Date(sm.dateRange.to);
const fromDate = new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate());
const toDate = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate());
const days = Math.round((toDate - fromDate) / 86400000) + 1;
const subCount = raw.sessions.filter(s => s.filePath && s.filePath.includes('/subagents/')).length;
const summary = {
  totalCost: sm.totalCost,
  sessionCount: sm.sessionCount,
  subtaskCount: subCount,
  dateFrom: fsd(fromD),
  dateTo: fsd(toD),
  days
};

// 2. tokenBreakdown
const tb = {
  input: { tokens: 0, cost: 0 },
  output: { tokens: 0, cost: 0 },
  cacheCreate1h: { tokens: 0, cost: 0 },
  cacheCreate5m: { tokens: 0, cost: 0 },
  cacheRead: { tokens: 0, cost: 0 }
};
for (const row of allRows) {
  const rates = getRates(row.model);
  tb.input.tokens += row.input;
  tb.input.cost += row.input * rates.input / 1e6;
  tb.output.tokens += row.out;
  tb.output.cost += row.out * rates.output / 1e6;
  tb.cacheCreate1h.tokens += row.cc1h;
  tb.cacheCreate1h.cost += row.cc1h * rates.cacheCreate1h / 1e6;
  tb.cacheCreate5m.tokens += row.cc5m;
  tb.cacheCreate5m.cost += row.cc5m * rates.cacheCreate5m / 1e6;
  tb.cacheRead.tokens += row.cr;
  tb.cacheRead.cost += row.cr * rates.cacheRead / 1e6;
}
// Round costs
for (const key of Object.keys(tb)) {
  tb[key].cost = round2(tb[key].cost);
}

// 2b. 5H alerts from ratelimit CSVs (optional, statusline users only)
const fiveHAlerts = [];
try {
  const rlProjects = projectFilter ? [projectFilter] : listProjects();
  for (const proj of rlProjects) {
    const rlSessions = listSessions(proj);
    for (const sess of rlSessions) {
      const rlPath = getRatelimitPath(proj, sess);
      if (!fs.existsSync(rlPath)) continue;
      const lines = fs.readFileSync(rlPath, 'utf8').trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const alert = cols[5];
        if (alert === 'warn' || alert === 'danger') {
          fiveHAlerts.push({
            ts: Number(cols[0]),
            pct: Number(cols[1]),
            level: alert,
            sessionId: sess
          });
        }
      }
    }
  }
  fiveHAlerts.sort((a, b) => a.ts - b.ts);
} catch {}

// 2c. Pre-generate missing compact caches (parallel, skip subagents)
const allSessionIds = [...sessionMap.keys()];
await generateMissingCompacts(allSessionIds);

// 3. windows

// ── Win correction: adjust timeline wins using ratelimit CSV data ──
// Ratelimit CSVs have the actual 5h window boundaries from Anthropic (5h_reset column).
// Timeline CSVs have simple hourFloor-based wins. Correct them where ratelimit data exists.

// Step 1: Collect actual windows from ratelimit CSVs (using shared utility)
const rlStarts = scanRatelimitWindows(CACHE_DIR);
const actualWindows = mergeWindows(rlStarts, FIVE_HOURS_S);

// Step 2: Expand actual windows as anchors — chain forward/backward where activity exists
if (actualWindows.length > 0) {
  // Collect all activity timestamps from all timelines
  const allTimestamps = new Set();
  for (const [, rows] of allTimelines) {
    for (const row of rows) {
      const ts = typeof row.ts === 'number' ? row.ts : Math.floor(new Date(row.ts).getTime() / 1000);
      if (ts > 0) allTimestamps.add(Math.floor(ts / 3600) * 3600); // hourFloor
    }
  }

  // Expand anchors backward
  for (const anchor of [...actualWindows]) {
    let curStart = anchor.start;
    while (true) {
      const candStart = curStart - FIVE_HOURS_S;
      const candEnd = curStart;
      // Check overlap with existing windows
      if (actualWindows.some(w => w !== anchor && candStart < w.end && candEnd > w.start)) break;
      // Check if any activity in candidate range
      let found = false;
      for (let h = candStart; h < candEnd; h += 3600) {
        if (allTimestamps.has(h)) { found = true; break; }
      }
      if (found) {
        actualWindows.push({ start: candStart, end: candEnd });
        curStart = candStart;
      } else break;
    }
  }

  // Expand anchors forward
  for (const anchor of [...actualWindows]) {
    let curEnd = anchor.end;
    while (true) {
      const candStart = curEnd;
      const candEnd = curEnd + FIVE_HOURS_S;
      if (actualWindows.some(w => w !== anchor && candStart < w.end && candEnd > w.start)) break;
      let found = false;
      for (let h = candStart; h < candEnd; h += 3600) {
        if (allTimestamps.has(h)) { found = true; break; }
      }
      if (found) {
        actualWindows.push({ start: candStart, end: candEnd });
        curEnd = candEnd;
      } else break;
    }
  }

  actualWindows.sort((a, b) => a.start - b.start);

  // Step 3: Correct timeline row wins where they overlap with actual windows
  for (const [, rows] of allTimelines) {
    for (const row of rows) {
      const ts = typeof row.ts === 'number' ? row.ts : Math.floor(new Date(row.ts).getTime() / 1000);
      for (const w of actualWindows) {
        if (ts >= w.start && ts < w.end) {
          row.win = w.start;
          break;
        }
      }
    }
  }
}

// Group timeline rows by win column
const winRowsMap = new Map(); // winStart -> [{row, sessionId}]
for (const [sessionId, rows] of allTimelines) {
  for (const row of rows) {
    if (!winRowsMap.has(row.win)) winRowsMap.set(row.win, []);
    winRowsMap.get(row.win).push({ row, sessionId });
  }
}

// Sort windows by start time
const winStarts = [...winRowsMap.keys()].sort((a, b) => a - b);

const windows = [];
const compactAlertCache = new Map();
for (const winStart of winStarts) {
  const entries = winRowsMap.get(winStart);
  const winEnd = winStart + 5 * 3600;
  const winDate = new Date(winStart * 1000);
  const winEndDate = new Date(winEnd * 1000);

  // Hourly costs within this window
  const hourlyCosts = {};
  const activeHoursSet = new Set();
  const rlHoursSet = new Set();

  for (const { row } of entries) {
    const h = new Date(row.ts * 1000).getHours();
    hourlyCosts[h] = (hourlyCosts[h] || 0) + row.cost;
    activeHoursSet.add(h);
    if (row.rl && (row.rl.startsWith('limit_hit') || row.rl.startsWith('limit_warning'))) {
      rlHoursSet.add(h);
    }
  }

  // Round hourly costs
  for (const h of Object.keys(hourlyCosts)) {
    hourlyCosts[h] = round2(hourlyCosts[h]);
  }

  const activeHours = [...activeHoursSet].sort((a, b) => a - b);
  const rlHours = [...rlHoursSet].sort((a, b) => a - b);

  // Total cost for window
  let winCost = 0;
  for (const { row } of entries) {
    winCost += row.cost;
  }

  // Group by session
  const sessionEntries = new Map(); // sessionId -> [row]
  for (const { row, sessionId } of entries) {
    if (!sessionEntries.has(sessionId)) sessionEntries.set(sessionId, []);
    sessionEntries.get(sessionId).push(row);
  }

  // Build session details for this window
  const programmaticDetails = [];
  const mainGroups = new Map(); // parentId -> { main: sessionMeta, subs: [sessionMeta] }

  for (const [sessionId, rows] of sessionEntries) {
    const meta = sessionMap.get(sessionId);
    if (!meta) continue;

    const sessionCost = round2(rows.reduce((s, r) => s + r.cost, 0));
    const sessionInput = rows.reduce((s, r) => s + r.input, 0);
    const sessionOutput = rows.reduce((s, r) => s + r.out, 0);
    const sessionCache1h = rows.reduce((s, r) => s + r.cc1h, 0);
    const sessionCache5m = rows.reduce((s, r) => s + r.cc5m, 0);
    const sessionCacheRead = rows.reduce((s, r) => s + r.cr, 0);
    const sessionMessages = rows.length;

    // Per-hour breakdown for 1h block view
    const hourly = {};
    for (const r of rows) {
      const h = new Date(r.ts * 1000).getHours();
      if (!hourly[h]) hourly[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
      hourly[h].messages += 1;
      hourly[h].input += r.input;
      hourly[h].output += r.out;
      hourly[h].cache1h += r.cc1h;
      hourly[h].cache5m += r.cc5m;
      hourly[h].cacheRead += r.cr;
      hourly[h].cost += r.cost;
    }
    // Round costs
    for (const h of Object.keys(hourly)) hourly[h].cost = round2(hourly[h].cost);

    const detail = {
      id: sessionId,
      type: 'main',
      messages: sessionMessages,
      input: sessionInput,
      output: sessionOutput,
      cache1h: sessionCache1h,
      cache5m: sessionCache5m,
      cacheRead: sessionCacheRead,
      cost: sessionCost,
      startTime: meta.firstTs ? fsd(new Date(meta.firstTs)) + ' ' + ft(new Date(meta.firstTs)) : '',
      activeHours: Object.keys(hourly).map(Number).sort((a, b) => a - b),
      hourly: hourly
    };

    if (isProgrammatic(meta)) {
      detail.type = 'claude-p';
      programmaticDetails.push(detail);
    } else if (meta.filePath && meta.filePath.includes('/subagents/')) {
      detail.type = 'sub';
      const parentId = getParentId(meta.filePath);
      if (parentId) {
        if (!mainGroups.has(parentId)) {
          mainGroups.set(parentId, { main: null, subs: [] });
        }
        mainGroups.get(parentId).subs.push(detail);
      }
    } else {
      // Main session
      if (!mainGroups.has(sessionId)) {
        mainGroups.set(sessionId, { main: null, subs: [] });
      }
      mainGroups.get(sessionId).main = { meta, detail };
    }
  }

  // Build windowSessions
  const windowSessions = [];

  // Programmatic bundle
  if (programmaticDetails.length > 0) {
    const pSum = {
      messages: programmaticDetails.reduce((s, d) => s + d.messages, 0),
      input: programmaticDetails.reduce((s, d) => s + d.input, 0),
      output: programmaticDetails.reduce((s, d) => s + d.output, 0),
      cache1h: programmaticDetails.reduce((s, d) => s + d.cache1h, 0),
      cache5m: programmaticDetails.reduce((s, d) => s + d.cache5m, 0),
      cacheRead: programmaticDetails.reduce((s, d) => s + d.cacheRead, 0),
      cost: round2(programmaticDetails.reduce((s, d) => s + d.cost, 0))
    };
    if (pSum.cost > 0) {
      const earliestProg = programmaticDetails.reduce((earliest, d) => (!earliest || d.startTime < earliest) ? d.startTime : earliest, '');
      const progHourly = {};
      for (const d of programmaticDetails) {
        for (const [h, st] of Object.entries(d.hourly || {})) {
          if (!progHourly[h]) progHourly[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
          progHourly[h].messages += st.messages; progHourly[h].input += st.input; progHourly[h].output += st.output;
          progHourly[h].cache1h += st.cache1h; progHourly[h].cache5m += st.cache5m; progHourly[h].cacheRead += st.cacheRead;
          progHourly[h].cost = round2(progHourly[h].cost + st.cost);
        }
      }
      windowSessions.push({
        id: 'programmatic', type: 'programmatic',
        firstMsg: '', lastMsg: '',
        startTime: earliestProg,
        ...pSum,
        details: programmaticDetails,
        activeHours: Object.keys(progHourly).map(Number).sort((a, b) => a - b),
        hourly: progHourly
      });
    }
  }

  // Main sessions with their subtasks
  for (const [groupId, group] of mainGroups) {
    const allDetails = [];
    let totalMessages = 0, totalInput = 0, totalOutput = 0;
    let totalCache1h = 0, totalCache5m = 0, totalCacheRead = 0, totalCost = 0;

    if (group.main) {
      allDetails.push(group.main.detail);
      totalMessages += group.main.detail.messages;
      totalInput += group.main.detail.input;
      totalOutput += group.main.detail.output;
      totalCache1h += group.main.detail.cache1h;
      totalCache5m += group.main.detail.cache5m;
      totalCacheRead += group.main.detail.cacheRead;
      totalCost += group.main.detail.cost;
    }

    for (const sub of group.subs) {
      allDetails.push(sub);
      totalMessages += sub.messages;
      totalInput += sub.input;
      totalOutput += sub.output;
      totalCache1h += sub.cache1h;
      totalCache5m += sub.cache5m;
      totalCacheRead += sub.cacheRead;
      totalCost += sub.cost;
    }

    totalCost = round2(totalCost);

    if (totalCost <= 0) continue; // Filter out $0 sessions

    const mainMeta = group.main ? group.main.meta : null;
    // Window-scoped first/last user message
    let winFirstMsg = '', winLastMsg = '';
    if (mainMeta && mainMeta.userMessageLog) {
      const winMsgs = mainMeta.userMessageLog.filter(m => {
        const mts = new Date(m.ts).getTime() / 1000;
        return mts >= winStart && mts < winEnd;
      });
      // Skip /continue skill output messages (start with 💚 /continue)
      const realMsgs = winMsgs.filter(m => !m.text.startsWith('\u{1F49A} /continue'));
      if (realMsgs.length > 0) {
        winFirstMsg = realMsgs[0].text;
        winLastMsg = realMsgs[realMsgs.length - 1].text;
      } else if (winMsgs.length > 0) {
        winFirstMsg = winMsgs[0].text;
        winLastMsg = winMsgs[winMsgs.length - 1].text;
      }
    }
    // Merge hourly stats from all details
    const groupHourly = {};
    for (const d of allDetails) {
      for (const [h, st] of Object.entries(d.hourly || {})) {
        if (!groupHourly[h]) groupHourly[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
        groupHourly[h].messages += st.messages;
        groupHourly[h].input += st.input;
        groupHourly[h].output += st.output;
        groupHourly[h].cache1h += st.cache1h;
        groupHourly[h].cache5m += st.cache5m;
        groupHourly[h].cacheRead += st.cacheRead;
        groupHourly[h].cost = round2(groupHourly[h].cost + st.cost);
      }
    }
    windowSessions.push({
      id: groupId,
      type: 'main',
      firstMsg: winFirstMsg,
      lastMsg: winLastMsg,
      startTime: mainMeta && mainMeta.firstTs ? fsd(new Date(mainMeta.firstTs)) + ' ' + ft(new Date(mainMeta.firstTs)) : '',
      messages: totalMessages,
      input: totalInput,
      output: totalOutput,
      cache1h: totalCache1h,
      cache5m: totalCache5m,
      cacheRead: totalCacheRead,
      cost: totalCost,
      details: allDetails,
      activeHours: Object.keys(groupHourly).map(Number).sort((a, b) => a - b),
      hourly: groupHourly
    });
  }

  // Remove zero-cost sessions (e.g. /continue restoration with no real work)
  for (let i = windowSessions.length - 1; i >= 0; i--) {
    if (windowSessions[i].cost === 0 && windowSessions[i].type === 'main') {
      windowSessions.splice(i, 1);
    }
  }

  // Group sessions with same firstMsg (2+ = batch/programmatic)
  const msgGroups = new Map(); // firstMsg -> [indices]
  for (let i = 0; i < windowSessions.length; i++) {
    const s = windowSessions[i];
    if (s.type !== 'main' || !s.firstMsg) continue;
    const key = s.firstMsg.slice(0, 80).replace(/\d+/g, '#'); // normalize: strip numbers for structural match
    if (!msgGroups.has(key)) msgGroups.set(key, []);
    msgGroups.get(key).push(i);
  }
  const removeIndices = new Set();
  for (const [msgKey, indices] of msgGroups) {
    if (indices.length < 2) continue;
    // Merge these sessions into one batch group
    const batchDetails = [];
    let tMsg = 0, tIn = 0, tOut = 0, tC1h = 0, tC5m = 0, tCr = 0, tCost = 0;
    for (const idx of indices) {
      const s = windowSessions[idx];
      tMsg += s.messages; tIn += s.input; tOut += s.output;
      tC1h += s.cache1h; tC5m += s.cache5m; tCr += s.cacheRead; tCost += s.cost;
      // Flatten all details into batch
      for (const d of s.details) batchDetails.push(d);
      removeIndices.add(idx);
    }
    const earliestBatch = indices.reduce((earliest, idx) => {
      const st = windowSessions[idx].startTime;
      return (!earliest || (st && st < earliest)) ? st : earliest;
    }, '');
    windowSessions.push({
      id: 'batch-' + indices.length,
      type: 'batch',
      firstMsg: windowSessions[indices[0]].firstMsg,
      lastMsg: '',
      startTime: earliestBatch,
      messages: tMsg, input: tIn, output: tOut,
      cache1h: tC1h, cache5m: tC5m, cacheRead: tCr,
      cost: round2(tCost),
      details: batchDetails,
      activeHours: [...new Set(batchDetails.flatMap(d => d.activeHours || []))].sort((a, b) => a - b),
      hourly: (function() {
        const bh = {};
        for (const d of batchDetails) {
          for (const [h, st] of Object.entries(d.hourly || {})) {
            if (!bh[h]) bh[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
            bh[h].messages += st.messages; bh[h].input += st.input; bh[h].output += st.output;
            bh[h].cache1h += st.cache1h; bh[h].cache5m += st.cache5m; bh[h].cacheRead += st.cacheRead;
            bh[h].cost = round2(bh[h].cost + st.cost);
          }
        }
        return bh;
      })()
    });
  }
  // Remove merged sessions (reverse order to preserve indices)
  const finalSessions = windowSessions.filter((_, i) => !removeIndices.has(i))
    .sort((a, b) => {
      // main first, then batch, then programmatic last
      const order = { main: 0, batch: 1, programmatic: 2 };
      const oa = order[a.type] ?? 1, ob = order[b.type] ?? 1;
      if (oa !== ob) return oa - ob;
      return b.cost - a.cost;
    });

  // Filter out $0 windows
  if (finalSessions.length === 0) continue;

  // Build alertMessages for this window
  const alertMessages = [];
  const windowDateStr = fsd(winDate);
  const seenSessionIds = new Set();
  for (const [sessionId] of sessionEntries) {
    if (seenSessionIds.has(sessionId)) continue;
    seenSessionIds.add(sessionId);
    if (!compactAlertCache.has(sessionId)) {
      compactAlertCache.set(sessionId, readCompactAlerts(sessionId));
    }
    const compactAlerts = compactAlertCache.get(sessionId);
    const tlRows = allTimelines.get(sessionId) || [];
    for (const alert of compactAlerts) {
      // Alert time is UTC. New format: MM-DDTHH:MM, old format: HH:MM
      const sessMeta = sessionMap.get(sessionId);
      const sessDate = new Date(sessMeta ? sessMeta.firstTs : Date.now());
      const timeParts = alert.time.split('T');
      let alertDate;
      if (timeParts.length === 2) {
        // New format: MM-DDTHH:MM — use exact date
        const [md, hm] = timeParts;
        const [mon, day] = md.split('-').map(Number);
        const [ah, am] = hm.split(':').map(Number);
        alertDate = new Date(Date.UTC(sessDate.getUTCFullYear(), mon - 1, day, ah, am));
      } else {
        // Old format: HH:MM — reconstruct from session date, try ±1 day for midnight-crossing sessions
        const [ah, am] = alert.time.split(':').map(Number);
        const baseDate = new Date(Date.UTC(sessDate.getUTCFullYear(), sessDate.getUTCMonth(), sessDate.getUTCDate(), ah, am));
        const candidates = [baseDate.getTime(), baseDate.getTime() + 86400000, baseDate.getTime() - 86400000];
        const sessEnd = new Date(sessMeta ? sessMeta.lastTs : Date.now()).getTime();
        const sessStart = sessDate.getTime();
        // Pick the candidate that falls within session time range (with some margin)
        let best = baseDate.getTime();
        for (const c of candidates) {
          if (c >= sessStart - 3600000 && c <= sessEnd + 3600000) {
            best = c;
            break;
          }
        }
        alertDate = new Date(best);
      }
      alert.ts = Math.floor(alertDate.getTime() / 1000);
      // Check if alert falls within window time range
      if (alert.ts < winStart || alert.ts >= winEnd) continue;
      // Convert display time to local
      alert.time = ft(new Date(alert.ts * 1000));
      matchAlertWithTimeline(alert, tlRows);
      alertMessages.push(alert);
    }
  }

  // Add 5H alerts that fall within this window's time range
  for (const fa of fiveHAlerts) {
    if (fa.ts >= winStart && fa.ts < winEnd) {
      alertMessages.push({
        sessionId: fa.sessionId,
        lineNum: 0,
        time: ft(new Date(fa.ts * 1000)),
        ts: fa.ts,
        markers: '',
        text: '5H ' + fa.pct + '%',
        alertType: '5h-' + fa.level,
        tokens: null
      });
    }
  }

  // Sort by time
  alertMessages.sort((a, b) => a.ts - b.ts);

  // Build continueEvents for this window
  const continueEvents = [];
  for (const [sessionId] of sessionEntries) {
    const sess = sessionMap.get(sessionId);
    if (!sess || !sess.contextEvents) continue;
    for (const ce of sess.contextEvents) {
      if (ce.type !== 'continue') continue;
      // Check if this continue event falls within the window
      if (ce.ts < winStart || ce.ts >= winEnd) continue;

      const restoredIds = ce.restoredSessionIds || [];
      let restoredContextTokens = 0;
      for (const rid of restoredIds) {
        const ridRows = allTimelines.get(rid);
        if (ridRows && ridRows.length > 0) {
          // Get the last row's cr (cache read) — represents session's context size at end
          const lastRow = ridRows[ridRows.length - 1];
          restoredContextTokens += lastRow.cr || 0;
        }
      }

      // Determine model for pricing (use the session's first timeline row model)
      const sessRows = allTimelines.get(sessionId) || [];
      const model = sessRows.length > 0 ? sessRows[0].model : '';
      const rates = getRates(model);

      // Estimated compact output = ~10% of input
      const estimatedOutput = Math.round(restoredContextTokens * 0.1);

      // Best case (cache hit): cacheRead rate
      const compactCostMin = round2(
        restoredContextTokens * rates.cacheRead / 1e6 +
        estimatedOutput * rates.output / 1e6
      );

      // Worst case (cache miss >1h): cacheCreate1h rate
      const compactCostMax = round2(
        restoredContextTokens * rates.cacheCreate1h / 1e6 +
        estimatedOutput * rates.output / 1e6
      );

      // Skip empty continue events (no restored context)
      if (restoredContextTokens === 0) continue;
      const eventTime = ft(new Date(ce.ts * 1000));
      if (eventTime.includes('NaN')) continue;

      continueEvents.push({
        time: eventTime,
        sessionCount: ce.sessionCount || restoredIds.length,
        restoredContextTokens,
        compactCostMin,
        compactCostMax,
        actualCost: 0
      });
    }
  }

  windows.push({
    date: fsd(winDate),
    start: ft(winDate),
    end: ft(winEndDate),
    usage: 0, // Cannot compute usage % without rate limit data
    cost: round2(winCost),
    eventCount: entries.length,
    rlHours,
    hourlyCosts,
    activeHours,
    windowSessions: finalSessions,
    alertMessages,
    continueEvents
  });
}

// 3b. current mode: keep only the latest window and filter allRows to match
if (currentMode && windows.length > 0) {
  const latest = windows[windows.length - 1];
  windows.length = 0;
  windows.push(latest);
  // Filter allRows to only the latest 5H window so sections 4-6 match
  const latestWinStart = winStarts[winStarts.length - 1];
  const latestWinEnd = latestWinStart + 5 * 3600;
  const filtered = allRows.filter(r => r.ts >= latestWinStart && r.ts < latestWinEnd);
  allRows.length = 0;
  for (const r of filtered) allRows.push(r);

  // Recalculate summary to match filtered 5H window
  if (allRows.length > 0) {
    const minTs = Math.min(...allRows.map(r => r.ts));
    const maxTs = Math.max(...allRows.map(r => r.ts));
    const cfrom = new Date(minTs * 1000);
    const cto = new Date(maxTs * 1000);
    summary.dateFrom = fsd(cfrom) + ' ' + ft(cfrom);
    summary.dateTo = fsd(cto) + ' ' + ft(cto);
    const cfromDate = new Date(cfrom.getFullYear(), cfrom.getMonth(), cfrom.getDate());
    const ctoDate = new Date(cto.getFullYear(), cto.getMonth(), cto.getDate());
    summary.days = Math.round((ctoDate - cfromDate) / 86400000) + 1;
    // Recalculate totalCost from filtered rows
    let filteredCost = 0;
    for (const row of allRows) {
      const rates = getRates(row.model);
      filteredCost += row.input * rates.input / 1e6
        + (row.cc1h * rates.cacheCreate1h + row.cc5m * rates.cacheCreate5m) / 1e6
        + row.cr * rates.cacheRead / 1e6
        + row.out * rates.output / 1e6;
    }
    summary.totalCost = round2(filteredCost);
    // Recalculate session counts: find sessions with activity in the window
    const windowSessionIds = new Set();
    for (const [sid, rows] of allTimelines) {
      if (rows.some(r => r.ts >= latestWinStart && r.ts < latestWinEnd)) {
        windowSessionIds.add(sid);
      }
    }
    let mainCount = 0, subCount2 = 0;
    for (const sid of windowSessionIds) {
      const sess = sessionMap.get(sid);
      if (sess && sess.filePath && sess.filePath.includes('/subagents/')) subCount2++;
      else mainCount++;
    }
    summary.sessionCount = mainCount;
    summary.subtaskCount = subCount2;
  }

  // Recalculate tokenBreakdown from filtered allRows
  for (const key of Object.keys(tb)) { tb[key].tokens = 0; tb[key].cost = 0; }
  for (const row of allRows) {
    const rates = getRates(row.model);
    tb.input.tokens += row.input;
    tb.input.cost += row.input * rates.input / 1e6;
    tb.output.tokens += row.out;
    tb.output.cost += row.out * rates.output / 1e6;
    tb.cacheCreate1h.tokens += row.cc1h;
    tb.cacheCreate1h.cost += row.cc1h * rates.cacheCreate1h / 1e6;
    tb.cacheCreate5m.tokens += row.cc5m;
    tb.cacheCreate5m.cost += row.cc5m * rates.cacheCreate5m / 1e6;
    tb.cacheRead.tokens += row.cr;
    tb.cacheRead.cost += row.cr * rates.cacheRead / 1e6;
  }
  for (const key of Object.keys(tb)) { tb[key].cost = round2(tb[key].cost); }
}

// 4. dailyCosts
const dailyCostMap = new Map(); // dateKey -> { date (display), input, cacheCreate, cacheRead, output }
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const key = fsdKey(d);
  if (!dailyCostMap.has(key)) {
    dailyCostMap.set(key, { date: fsd(d), input: 0, cacheCreate: 0, cacheRead: 0, output: 0 });
  }
  const entry = dailyCostMap.get(key);
  const rates = getRates(row.model);
  entry.input += row.input * rates.input / 1e6;
  entry.cacheCreate += (row.cc1h * rates.cacheCreate1h + row.cc5m * rates.cacheCreate5m) / 1e6;
  entry.cacheRead += row.cr * rates.cacheRead / 1e6;
  entry.output += row.out * rates.output / 1e6;
}
const dailyCosts = [...dailyCostMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
for (const dc of dailyCosts) {
  dc.input = round2(dc.input);
  dc.cacheCreate = round2(dc.cacheCreate);
  dc.cacheRead = round2(dc.cacheRead);
  dc.output = round2(dc.output);
}

// 4b. dailyTokens (token counts for efficiency trend, same dates as dailyCosts)
const dailyTokenMap = new Map();
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const key = fsdKey(d);
  if (!dailyTokenMap.has(key)) {
    dailyTokenMap.set(key, { date: fsd(d), total: 0, cc: 0, out: 0 });
  }
  const entry = dailyTokenMap.get(key);
  entry.total += row.input + row.cc + row.cr + row.out;
  entry.cc += row.cc;
  entry.out += row.out;
}
const dailyTokens = [...dailyTokenMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);

// 5. hourlyStats
const hourCostsByDay = {}; // hour -> [cost per day]
const daySetByHour = {}; // hour -> Set of date strings
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const h = d.getHours();
  const dateKey = fsdKey(d);
  if (!hourCostsByDay[h]) { hourCostsByDay[h] = {}; daySetByHour[h] = new Set(); }
  daySetByHour[h].add(dateKey);
  hourCostsByDay[h][dateKey] = (hourCostsByDay[h][dateKey] || 0) + row.cost;
}

const hourlyStats = [];
for (let h = 0; h < 24; h++) {
  if (!hourCostsByDay[h]) {
    hourlyStats.push({ hour: h, avg: 0, max: 0 });
    continue;
  }
  const costs = Object.values(hourCostsByDay[h]);
  const totalDays = days > 0 ? days : 1;
  const avg = round2(costs.reduce((s, c) => s + c, 0) / totalDays);
  const max = round2(Math.max(...costs));
  hourlyStats.push({ hour: h, avg, max });
}

// 6. dowStats
const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowCostsByWeek = {}; // dow -> { weekKey -> cost }
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const dow = d.getDay();
  // Use ISO week as key for grouping
  const weekKey = Math.floor(row.ts / (7 * 86400));
  if (!dowCostsByWeek[dow]) dowCostsByWeek[dow] = {};
  dowCostsByWeek[dow][weekKey] = (dowCostsByWeek[dow][weekKey] || 0) + row.cost;
}

const dowStats = [];
for (let dow = 0; dow < 7; dow++) {
  if (!dowCostsByWeek[dow]) {
    dowStats.push({ dow, label: dowLabels[dow], avg: 0, max: 0 });
    continue;
  }
  const costs = Object.values(dowCostsByWeek[dow]);
  const avg = round2(costs.reduce((s, c) => s + c, 0) / costs.length);
  const max = round2(Math.max(...costs));
  dowStats.push({ dow, label: dowLabels[dow], avg, max });
}

// 7. Plugin installed date (birthtime of plugin.json, most stable indicator)
const pluginJsonPaths = [
  path.join(__dirname, '..', '.claude-plugin', 'plugin.json'),
  path.join(__dirname, '..', 'plugin.json'),
  path.join(os.homedir(), '.claude', 'plugins', 'cc-token-saver', 'plugin.json'),
  path.join(os.homedir(), '.claude', 'cc-token-saver', 'plugin.json'),
];
let pluginInstalledAt = null;
for (const p of pluginJsonPaths) {
  try { pluginInstalledAt = fs.statSync(p).birthtime.toISOString(); break; } catch(e) {}
}

// ── Plan info for REPORT_DATA and AI prompt ────────────────────
const PLAN_INFO = PLAN_INFO_ALL;
const planData = planArg && PLAN_INFO[planArg] ? PLAN_INFO[planArg] : null;

// ── Assemble REPORT_DATA ────────────────────────────────────────
const reportData = {
  summary,
  tokenBreakdown: tb,
  windows,
  dailyCosts,
  dailyTokens,
  hourlyStats,
  dowStats,
  fiveHAlerts,
  pluginInstalledAt,
  currentMode,
  plan: planData ? { key: planData.key, name: planData.name, price: planData.price } : null
};

if (exportDataPath) {
  fs.writeFileSync(exportDataPath, JSON.stringify(reportData));
  console.error('Report data exported to ' + exportDataPath);
}

// ── AI Analysis (optional, from external file) ────────────────
if (aiDataPath) {
  try {
    const aiAnalysis = JSON.parse(fs.readFileSync(aiDataPath, 'utf8'));
    if (aiAnalysis.section1 || aiAnalysis.section2 || aiAnalysis.section3 || aiAnalysis.section4) {
      addBidiToAI(aiAnalysis);
      reportData.aiAnalysis = aiAnalysis;
      const count = [aiAnalysis.section1, aiAnalysis.section2, aiAnalysis.section3, aiAnalysis.section4].filter(Boolean).length;
      console.error('AI analysis: ' + count + ' sections loaded from ' + aiDataPath);
    }
  } catch (e) {
    console.error('AI analysis: failed to read ' + aiDataPath + ' - ' + e.message);
  }
}

// ── Export AI prompt (optional, from reportData) ───────────────
if (exportPromptPath) {
  const s = reportData.summary;
  const tb = reportData.tokenBreakdown;
  const hourly = reportData.hourlyStats.filter(h => h.avg > 0)
    .sort((a, b) => b.avg - a.avg)
    .map(h => h.hour + 'h: avg=$' + h.avg + ', max=$' + h.max)
    .join('\n');
  const dow = reportData.dowStats.map(d => d.label + ': avg=$' + d.avg + ', max=$' + d.max).join('\n');
  // Weekly grouping from dailyCosts
  const weeks = []; let wCost = 0, wDays = [], wn = 1;
  for (const d of reportData.dailyCosts) {
    const total = round2(d.input + d.cacheCreate + d.cacheRead + d.output);
    wCost += total; wDays.push(d.date + ':$' + total);
    if (wDays.length === 7) {
      weeks.push('Week' + wn + ': total=$' + round2(wCost) + ' [' + wDays.join(', ') + ']');
      wCost = 0; wDays = []; wn++;
    }
  }
  if (wDays.length > 0) weeks.push('Week' + wn + ': total=$' + round2(wCost) + ' [' + wDays.join(', ') + ']');
  // Top sessions
  const topSessions = [];
  for (const w of reportData.windows) {
    if (!w.windowSessions) continue;
    for (const ws of w.windowSessions) {
      if (ws.cost > 0) topSessions.push({ date: w.date, cost: ws.cost, msg: (ws.firstMsg || '').slice(0, 80), type: ws.type });
    }
  }
  topSessions.sort((a, b) => b.cost - a.cost);
  const top10 = topSessions.slice(0, 15).map(t => '$' + t.cost.toFixed(1) + ' [' + t.type + '] (' + t.date + ') ' + t.msg).join('\n');
  // Rate limit & continue events
  const rlCount = reportData.fiveHAlerts ? reportData.fiveHAlerts.length : 0;
  const pi = planData ? { label: planData.label, price: planData.priceNum, type: planData.type } : { label: 'unknown', price: null, type: 'unknown' };
  const reportDays = s.days || 1;
  const shouldExtrapolate = reportDays <= 15;
  const projectedMonthly = shouldExtrapolate ? round2((s.totalCost / reportDays) * 30) : null;
  let planLine;
  if (pi.type === 'flat') {
    if (shouldExtrapolate) {
      const multiple = (projectedMonthly / pi.price).toFixed(1);
      planLine = `- Projected monthly API value: $${projectedMonthly} (${multiple}x of $${pi.price} subscription)
- Billing: flat-rate. User pays $${pi.price}/mo regardless of usage. Higher multiple = more value extracted.`;
    } else {
      planLine = `- Total API value: $${s.totalCost} over ${reportDays} days on a $${pi.price}/mo subscription.
- Billing: flat-rate. User pays $${pi.price}/mo regardless of usage.`;
    }
    planLine += `\n- Rate limit management is key: spread usage across 5h windows, avoid bursts, use cache efficiently, use /continue instead of /compact.
- If frequently hitting limits, suggest upgrading plan OR optimizing usage patterns to stay within the ceiling.`;
  } else if (pi.type === 'usage') {
    if (shouldExtrapolate) {
      planLine = `- Projected monthly cost: $${projectedMonthly} — this is the actual projected bill.`;
    } else {
      planLine = `- Total cost: $${s.totalCost} over ${reportDays} days.`;
    }
    planLine += `\n- Billing: usage-based (pay per token). Every token costs real money.
- Prioritize cost optimization: cache reuse, /continue over /compact, shorter prompts, model selection (Haiku for simple tasks).`;
  } else {
    if (shouldExtrapolate) {
      planLine = `- Projected monthly API value: $${projectedMonthly}`;
    } else {
      planLine = `- Total API value: $${s.totalCost} over ${reportDays} days.`;
    }
    planLine += `\n- Billing: unknown plan.`;
  }
  planLine += '\n\n## Plan Comparison (for upgrade/downgrade advice)\n'
    + '| Plan | Monthly | Rate Limit | Type |\n'
    + '|------|---------|------------|------|\n'
    + '| Pro | $20/mo | 1x (baseline) | flat |\n'
    + '| Max 5x | $100/mo | 5x of Pro | flat |\n'
    + '| Max 20x | $200/mo | 20x of Pro | flat |\n'
    + '| Team Standard | $20/seat/mo | >1x of Pro (exact unknown) | flat |\n'
    + '| Team Premium | $100/seat/mo | 5x of Team Standard | flat |\n'
    + '| Enterprise | $20/seat + API | usage-based pooled | usage |\n'
    + '| Bedrock/Foundry/Vertex | API pricing | no rate limit ceiling | usage |';

  // Continue events: from marker counts (preprocess detects <command-message>cc-token-saver:continue)
  // markerCounts.continue is populated from alertMessages which come from compact caches

  // Alert marker summary (from all windows)
  const markerCounts = { startup: 0, cost: 0, context: 0, resume: 0, continue: 0, modelChange: 0, blockedWindows: 0 };
  for (const w of reportData.windows) {
    if (w.rlHours && w.rlHours.length > 0) markerCounts.blockedWindows++;
    if (!w.alertMessages) continue;
    for (const a of w.alertMessages) {
      const t = a.alertType || '';
      if (t.includes('startup') || t.includes('clear')) markerCounts.startup++;
      if (t.includes('cost-')) markerCounts.cost++;
      if (t.includes('ctx-')) markerCounts.context++;
      if (t.includes('resume') || t.includes('compact')) markerCounts.resume++;
      if (t.includes('continue-')) markerCounts.continue++;
      if (t.includes('model-change')) markerCounts.modelChange++;
    }
  }

  // Efficiency before/after plugin install
  let effBefore = '', effAfter = '';
  if (reportData.pluginInstalledAt && reportData.dailyTokens) {
    const installDate = new Date(reportData.pluginInstalledAt).toISOString().slice(0, 10);
    const installIdx = reportData.dailyCosts.findIndex(d => {
      // Match by finding the first date >= install date
      const parts = d.date.split('/');
      if (parts.length === 2) {
        const m = parseInt(parts[0]), dy = parseInt(parts[1]);
        const year = toD.getFullYear();
        const dStr = year + '-' + String(m).padStart(2, '0') + '-' + String(dy).padStart(2, '0');
        return dStr >= installDate;
      }
      return false;
    });
    if (installIdx > 0 && installIdx < reportData.dailyTokens.length) {
      // Compute avg efficiency (total/output) before and after
      let beforeTotal = 0, beforeOut = 0, afterTotal = 0, afterOut = 0;
      for (let i = 0; i < reportData.dailyTokens.length; i++) {
        const dt = reportData.dailyTokens[i];
        if (dt.out < 1000) continue; // skip low-output days
        if (i < installIdx) { beforeTotal += dt.total; beforeOut += dt.out; }
        else { afterTotal += dt.total; afterOut += dt.out; }
      }
      if (beforeOut > 0) effBefore = round2(beforeTotal / beforeOut).toString();
      if (afterOut > 0) effAfter = round2(afterTotal / afterOut).toString();
      // Daily avg cost before/after
      let beforeCost = 0, afterCost = 0, beforeDays = 0, afterDays = 0;
      for (let i = 0; i < reportData.dailyCosts.length; i++) {
        const dc = reportData.dailyCosts[i];
        const dayCost = round2(dc.input + dc.cacheCreate + dc.cacheRead + dc.output);
        if (i < installIdx) { beforeCost += dayCost; beforeDays++; }
        else { afterCost += dayCost; afterDays++; }
      }
      if (beforeDays > 0) reportData._costAvgBefore = round2(beforeCost / beforeDays);
      if (afterDays > 0) reportData._costAvgAfter = round2(afterCost / afterDays);
    }
  }
  const costComparison = (reportData._costAvgBefore && reportData._costAvgAfter)
    ? `Daily avg cost — Before plugin: $${reportData._costAvgBefore}/day, After plugin: $${reportData._costAvgAfter}/day` +
      (reportData._costAvgBefore > reportData._costAvgAfter
        ? ` (${round2((1 - reportData._costAvgAfter / reportData._costAvgBefore) * 100)}% reduced)`
        : '')
    : 'Not enough data for cost before/after comparison';
  const effComparison = (effBefore && effAfter)
    ? `Before plugin: ${effBefore}x, After plugin: ${effAfter}x (lower is better, ${effBefore > effAfter ? round2((1 - effAfter / effBefore) * 100) + '% improved' : 'no improvement yet'})`
    : 'Not enough data for before/after comparison';

  const prompt = `## Usage Data (THESE ARE THE ONLY NUMBERS YOU MAY USE)
- Period: ${s.dateFrom} ~ ${s.dateTo} (${s.days} days)
- Total cost: $${s.totalCost}, Sessions: ${s.sessionCount} main + ${s.subtaskCount || 0} subtasks
- Plan: ${pi.label}
- RULE: Monthly cost extrapolation is ONLY allowed when report period <= 15 days. This report covers ${reportDays} days${shouldExtrapolate ? ' — extrapolation is allowed.' : ' (>15) — do NOT extrapolate or mention monthly projections at all. Simply omit it — do NOT say "extrapolation is not needed" or similar.'}
${planLine}
- Plugin installed: ${reportData.pluginInstalledAt ? new Date(reportData.pluginInstalledAt).toISOString().slice(0, 10) : 'not detected'}

## Token Breakdown
- Input: ${tb.input.tokens.toLocaleString()} tokens ($${tb.input.cost})
- Output: ${tb.output.tokens.toLocaleString()} tokens ($${tb.output.cost})
- Cache Create 1h: ${tb.cacheCreate1h.tokens.toLocaleString()} tokens ($${tb.cacheCreate1h.cost})
- Cache Create 5m: ${tb.cacheCreate5m.tokens.toLocaleString()} tokens ($${tb.cacheCreate5m.cost})
- Cache Read: ${tb.cacheRead.tokens.toLocaleString()} tokens ($${tb.cacheRead.cost})

## Hourly Cost Pattern (avg per day)
${hourly}

## Day-of-Week Cost Pattern (avg per week)
${dow}

## Weekly Costs (same data as the daily chart)
${weeks.join('\n')}

## Rate Limit & Blocking
- Rate-limited windows (skulls on calendar): ${markerCounts.blockedWindows}
- 5H window alerts: ${rlCount}

## /continue Skill Usage
- Times used: ${markerCounts.continue}

## Session Activity Summary
- Session starts/clears: ${markerCounts.startup}
- Cost alerts triggered: ${markerCounts.cost}
- Context size alerts triggered: ${markerCounts.context}
- Resume/compact events: ${markerCounts.resume}
- Model changes: ${markerCounts.modelChange}

## Plugin Before/After Comparison
Cost: ${costComparison}
Efficiency (Total/Output ratio, lower = better): ${effComparison}

## Top Cost Sessions
${top10}

## Plugin: cc-token-saver
cc-token-saver is a Claude Code plugin that:
- Shows real-time token usage in the CLI statusline (input/output/cache tokens per message)
- Tracks 5-hour rate-limit window consumption with visual alerts at 80%/95%
- Provides /continue skill to restore previous sessions WITHOUT any LLM API calls (zero cost)
- Generates interactive HTML usage dashboards for cost visibility and pattern analysis
- Has 2 automatic hooks: context size monitoring + cost tracking per message
- /setup-statusline: real-time token counter in CLI
- /report-limit: report rate limit data to community (reverse-engineering the formula)

### /continue Skill (Key Feature)
Unlike Claude Code's built-in /compact which:
- Calls the LLM to generate a summary -> costs cache_write + output tokens
- Next session: input + output + cache_write tokens again
- Loses original conversation nuance in summarization

cc-token-saver's /continue skill:
- Uses only the Read tool to restore previous session transcripts — ZERO LLM API calls
- Preserves the ORIGINAL user+assistant conversation text verbatim (not a summary)
- For long conversations, uses (...) to abbreviate middle sections but includes line numbers pointing to the original transcript, so full context is always recoverable
- Can selectively restore from MULTIPLE previous sessions (not just the last one)
- As long as transcripts exist, 100% of original context is recoverable
- Much faster than /compact (no LLM round-trip)
- Only costs input + cache_write tokens when the restored context enters the next conversation turn — no output or summarization cost`;

  // Current mode: strip section2/3 data from AI prompt to save tokens
  let finalPrompt = prompt;
  if (currentMode) {
    // Remove sections that feed section2 (work patterns) and section3 (window analysis)
    finalPrompt = finalPrompt
      .replace(/## Hourly Cost Pattern[\s\S]*?(?=## |$)/, '')
      .replace(/## Day-of-Week Cost Pattern[\s\S]*?(?=## |$)/, '')
      .replace(/## Weekly Costs[\s\S]*?(?=## |$)/, '')
      .replace(/## Rate Limit & Blocking[\s\S]*?(?=## |$)/, '')
      .replace(/## Session Activity Summary[\s\S]*?(?=## |$)/, '')
      .replace(/## Plugin Before\/After Comparison[\s\S]*?(?=## |$)/, '')
      .replace(/## \/continue Skill Usage[\s\S]*?(?=## |$)/, '');
  }

  fs.writeFileSync(exportPromptPath, finalPrompt);
  console.error('AI prompt exported to ' + exportPromptPath);
}

// ── Template injection ──────────────────────────────────────────
let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
template = injectI18N(template);
template = injectHtmlLang(template);
const marker_start = '/*<!-- REPORT_DATA_START -->*/';
const marker_end = '/*<!-- REPORT_DATA_END -->*/';
const startIdx = template.indexOf(marker_start);
const endRaw = template.indexOf(marker_end);

if (startIdx === -1 || endRaw === -1) {
  console.error('Error: REPORT_DATA markers not found in template');
  process.exit(1);
}
const endIdx = endRaw + marker_end.length;

const output = template.slice(0, startIdx) +
  marker_start + '\nconst REPORT_DATA = ' + JSON.stringify(reportData, null, 0) + ';\n' + marker_end +
  template.slice(endIdx);

fs.writeFileSync(outputPath, output);
console.error(`Report written to ${outputPath} (${output.length} bytes)`);

})();
