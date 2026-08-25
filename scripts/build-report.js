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
 * v1.4.0 compact-timeline-separation — user-turn aggregation:
 *   1. compact.txt (preprocess.js) supplies user-side markers only
 *   2. timeline.csv (analyze-usage.js) supplies per-API-call cost + markers
 *   3. buildAlertsFromUserTurns joins the two streams by JSONL line number,
 *      aggregating ALL assistant rows between user line Lu and Lu+1 into a
 *      single alert with totalCost, turnCount, and turnBreakdown. This fixes
 *      the nearest-timestamp 1:1 underreporting bug for tool-heavy turns.
 *   4. generateMissingCompacts now checks mtime (not just existence) so
 *      stale compact.txt from mid-session runs is regenerated.
 *
 * ALERT_LINE_RE: Simplified regex — all markers captured as one group,
 * then parsed individually via string matching.
 *
 * Usage: node build-report.js [options]
 *   --data <path>           analyze-usage.js JSON output (required unless --import-data)
 *   --output <path>         Output HTML file path (required)
 *   --current               Current 5-hour window mode (session detail pre-opened)
 *   --ai-data <path>        AI analysis JSON to inject into report
 *   --export-prompt <path>  Export AI analysis prompt to file (for agent consumption)
 *   --export-data <path>    Export REPORT_DATA as JSON (for --import-data)
 *   --import-data <path>    Import pre-built REPORT_DATA instead of building from CSVs
 *   --locale <code>         Force locale (default: system language → en fallback)
 *   --plan <plan>           Plan tier for AI prompt context (pro|max100|max200|...)
 *   --project <name>        Project name (hashed CWD) to scope report to single project
 *
 * Input:
 *   - analyze-usage.js JSON output (--data)
 *   - ~/.claude/super-token-saver-data/{projectName}/{sessionId}/timeline.csv   (per-API-call data)
 *   - ~/.claude/super-token-saver-data/{projectName}/{sessionId}/ratelimit.csv  (statusline rate limit logs)
 *   - skills/usage-view/template.html                              (dashboard template)
 *   - locales/{code}.json                                          (i18n strings)
 *
 * Output:
 *   - Self-contained HTML file with inline CSS/JS, Chart.js CDN
 *   - REPORT_DATA object: windows (5h buckets), calendar, cost/token aggregates
 *     - windows[].rlHours: hours within window where limit_hit occurred (renders as skulls on calendar)
 *     - windows[].alertMessages: from ratelimit CSVs (5h threshold crossings)
 *
 * v1.4.1: report-limit fixes, hourly avg by active days, cache read alert i18n
 * v1.4.2: bubble chart, model colors, price lines, dual avg
 * v1.4.3: partial-hour normalization, DOW boundary merge, cost thresholds centralized
 * v1.4.4: Korean text translated, LLM prompt accuracy improvements
 *
 * Supported locales (23): en ko ja zh es fr de pt it ru ar hi bn id ms th vi tr pl nl he sv no
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildGlobalWindowMap, buildGlobalTsMapper, FIVE_HOURS_S } = require('./lib/window-utils');
const { listProjects, listSessions, listSubagents, getTimelinePath, getSummaryPath, getRatelimitPath, getSubagentTimelinePath, getSubagentSummaryPath, getCompactPath, migrateFromYYMM, CACHE_BASE: CACHE_DIR } = require('./lib/cache-paths');
const { PLAN_INFO: PLAN_INFO_ALL } = require('./lib/plan-info');
const { round2 } = require('./lib/format');
const { SUPPORTED_LOCALES, resolveLocale } = require('./lib/locale');
const { MODEL_PRICING, DEFAULT_PRICING, getRates } = require('./lib/pricing');
const _subagentSep = /[/\\]subagents[/\\]/;
const TEMPLATE_PATH = path.join(__dirname, '..', 'skills', 'usage-view', 'template.html');
const LOCALES_DIR = path.join(__dirname, '..', 'locales');

// ── Cost thresholds (used in alerts + AI prompt) ────────────────
const TURN_COST_WARN = 0.80;   // per-user-turn cost warning
const TURN_COST_DANGER = 2.50; // per-user-turn cost danger
const DEFAULT_COST_FILTER = 0.80; // calendar detail panel default filter

// ── Args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let dataPath = null, outputPath = null, currentMode = false, aiDataPath = null, exportPromptPath = null, exportDataPath = null, importDataPath = null, localeArg = null, planArg = null, projectFilter = null, privateMode = false;
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
  else if (args[i] === '--private') { privateMode = true; }
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
    cache1hTier: en.token.cache1hTier, cache5mTier: en.token.cache5mTier
  });
  // Chart data labels (day names, avg/max, hour suffix, legend, efficiency notes)
  Object.assign(localeData.chart, {
    hourSuffix: en.chart.hourSuffix,
  });
  // Alert & session: use bidi marks in locale files instead (he.json, ar.json)
}

// Bidi post-processor: wrap English terms with LRM/RLM in RTL text
const isRTL = localeData.meta && localeData.meta.direction === 'rtl';
function addBidiMarks(text) {
  if (!isRTL || typeof text !== 'string') return text;
  // Match: /commands, English words (incl. hyphenated/dotted like super-token-saver, c0d.run)
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
  if (!filePath || !_subagentSep.test(filePath)) return null;
  return path.basename(filePath.split(_subagentSep)[0] + '.jsonl', '.jsonl');
}

function isProgrammatic(session) {
  if (session.filePath && session.filePath.match(_subagentSep)) return false;
  if (session.userMsgs !== 1) return false;
  if (!session.firstUserMsg) return true;
  const patterns = [/^You are generating/, /^Read the /, /^Run the /, /^CRITICAL:/, /^Write the word/, /^Compare the /, /^This session is being continued/];
  return patterns.some(p => p.test(session.firstUserMsg));
}

// Acompact: auto-compact runs as a separate subagent under the parent session's
// subagents/ dir. Its directory name starts with "acompact-" (no "agent-" prefix).
// The transcript file name is agent-acompact-<id>.jsonl.
function isAcompactAgent(agentDirName) {
  return !!(agentDirName && agentDirName.startsWith('acompact-'));
}
function isAcompactSessionId(sessionId) {
  return !!(sessionId && (sessionId.startsWith('agent-acompact-') || sessionId.startsWith('acompact-')));
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
  const jsonStr = JSON.stringify(reportData, null, 0).replace(/<\//g, '<\\/');
  const output = template.slice(0, startIdx) +
    marker_start + '\nconst REPORT_DATA = ' + jsonStr + ';\n' + marker_end +
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
const _sessionProjectMap = new Map(); // sessionId|agentId → { proj, parentSessionId? }

// Acompact cost attribution:
//   acompactCostByParent: Map<parentSessionId, Map<ctxSize, {cost, input, cc5m, cc1h, cr, out, callCount}>>
// Populated BEFORE main parent timelines are read so that compact:auto:<ctx> marker
// rows in parent timeline.csv can be enriched with the acompact subagent's total.
const acompactCostByParent = new Map();
// Fallback: parentSessionId -> [{firstTs, lastTs, totals, agentDirName}] for acompact
// subagents whose ctxSize couldn't be extracted. These are matched to parent marker
// rows by timestamp proximity during readTimelineCsv enrichment.
const acompactByParentNoCtx = new Map();

// ── Universal subagent cost dedup (v1.4.x) ─────────────────────
// CC's runForkedAgent writes parent conversation history into the subagent's
// sidechain. Replayed rows retain their ORIGINAL requestId, causing cost
// double-counting when subagents are summed. We drop any subagent timeline row
// whose requestId already appears in its parent's timeline. Handles acompact,
// aside_question, agentSummary, worktree forks uniformly.
// parentReqIdSets: Map<parentSessionId, Set<reqId>>  — populated lazily.
const parentReqIdSets = new Map();
function getParentReqIds(parentSessionId) {
  if (parentReqIdSets.has(parentSessionId)) return parentReqIdSets.get(parentSessionId);
  const info = _sessionProjectMap.get(parentSessionId);
  if (!info) { parentReqIdSets.set(parentSessionId, null); return null; }
  const csvPath = getTimelinePath(info.proj, parentSessionId);
  if (!csvPath || !fs.existsSync(csvPath)) { parentReqIdSets.set(parentSessionId, null); return null; }
  const set = new Set();
  try {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 14) continue;
      const req = cols[13];
      if (req) set.add(req);
    }
  } catch {}
  parentReqIdSets.set(parentSessionId, set);
  return set;
}

function readTimelineCsv(sessionId) {
  // New structure: look up project from _sessionProjectMap
  const info = _sessionProjectMap.get(sessionId);
  if (!info) return [];
  let csvPath = null;
  if (info.parentSessionId) {
    // Subagent: timeline lives under parent session's subagents/ dir
    // Use agentDirName (without "agent-" prefix) for the actual directory path
    csvPath = getSubagentTimelinePath(info.proj, info.parentSessionId, info.agentDirName);
  } else {
    csvPath = getTimelinePath(info.proj, sessionId);
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
      evt: cols[11] || '',
      // v10: line column — no markers column (all event info lives in evt + rl).
      line: cols[12] ? Number(cols[12]) : 0,
      // v11: req column — API requestId used for universal subagent cost dedup.
      req: cols[13] || ''
    });
  }

  // Universal subagent cost dedup: drop rows whose requestId already appears
  // in the parent session's timeline. Zero-cost rows (events like compact
  // markers, rate limits) are ALWAYS kept since they have no req. Independent
  // subagents have 0 reqId overlap → no-op. Replay forks (acompact, aside_q,
  // worktree) retain only their NEW calls.
  if (info.parentSessionId) {
    const parentSet = getParentReqIds(info.parentSessionId);
    if (parentSet && parentSet.size > 0) {
      const kept = [];
      for (const r of rows) {
        if (r.req && parentSet.has(r.req)) continue;
        kept.push(r);
      }
      rows.length = 0;
      for (const r of kept) rows.push(r);
    }
  }

  // Enrich parent timeline rows: merge acompact subagent cost into
  // compact:auto:<ctxSize> marker rows (which have cost=0 in the parent).
  // Only runs for non-subagent reads. Subagent timelines are parsed as-is.
  if (!info.parentSessionId) {
    const byCtx = acompactCostByParent.get(sessionId);
    const noCtxList = acompactByParentNoCtx.get(sessionId);
    const usedNoCtx = new Set();
    const markerRe = /^compact:(?:auto|manual):(\d+)/;

    function mergeAgg(row, agg) {
      row.input += agg.input;
      row.cc += (agg.cc5m + agg.cc1h);
      row.cc5m += agg.cc5m;
      row.cc1h += agg.cc1h;
      row.cr += agg.cr;
      row.out += agg.out;
      row.cost += agg.cost;
      row.model = row.model || agg.model;
      row.mergedFromAcompact = true;
      row.acompactCallCount = (row.acompactCallCount || 0) + agg.callCount;
      row.acompactCost = (row.acompactCost || 0) + agg.cost;
    }

    // Pass 1: ctxSize-keyed exact match
    for (const row of rows) {
      if (!row.evt) continue;
      const m = row.evt.match(markerRe);
      if (!m) continue;
      if (byCtx) {
        const ctxSize = Number(m[1]);
        const agg = byCtx.get(ctxSize);
        if (agg) { mergeAgg(row, agg); continue; }
      }
    }

    // Pass 2: timestamp-proximity fallback for acompact agents with no ctxSize.
    // For each unmerged compact:auto row, pick the nearest no-ctx acompact
    // whose firstTs is within ±5min of the marker row's ts.
    if (noCtxList && noCtxList.length > 0) {
      for (const row of rows) {
        if (row.mergedFromAcompact) continue;
        if (!row.evt || !markerRe.test(row.evt)) continue;
        let bestIdx = -1, bestDelta = Infinity;
        for (let i = 0; i < noCtxList.length; i++) {
          if (usedNoCtx.has(i)) continue;
          const entry = noCtxList[i];
          const delta = Math.abs((entry.firstTs || 0) - row.ts);
          if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
        }
        if (bestIdx >= 0 && bestDelta <= 600) {
          mergeAgg(row, noCtxList[bestIdx]);
          usedNoCtx.add(bestIdx);
        }
      }
      // Pass 3: any remaining unmatched no-ctx entries — attach to the closest
      // real timeline row by timestamp (any row, not just compact markers).
      // This preserves cost totals even when the parent has no marker row.
      for (let i = 0; i < noCtxList.length; i++) {
        if (usedNoCtx.has(i)) continue;
        const entry = noCtxList[i];
        if (!entry.firstTs) continue;
        let bestIdx = -1, bestDelta = Infinity;
        for (let r = 0; r < rows.length; r++) {
          const delta = Math.abs(rows[r].ts - entry.firstTs);
          if (delta < bestDelta) { bestDelta = delta; bestIdx = r; }
        }
        if (bestIdx >= 0) {
          mergeAgg(rows[bestIdx], entry);
          usedNoCtx.add(i);
        }
      }
    }
  }
  return rows;
}

// Read a subagent's timeline.csv and return {ctxSize, model, totals}.
// Used for acompact attribution: aggregates the subagent's deduped cost and
// attaches it to the parent session's compact:auto:<ctxSize> marker row so
// the dashboard shows "compact summary call: $X.XX" on the compact event.
//
// v1.4.x: universal subagent cost dedup runs via parent reqId filtering in
// readTimelineCsv. Here we apply the same filter to eliminate parent-replay
// rows (CC's runForkedAgent writes FULL parent history into acompact sidechain).
// Remaining rows = genuinely new calls (usually the single summary call).
function readAcompactAggregate(proj, parentSessionId, agentDirName) {
  const csvPath = getSubagentTimelinePath(proj, parentSessionId, agentDirName);
  if (!csvPath || !fs.existsSync(csvPath)) return null;
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = content.split('\n');
  if (lines.length < 2) return null;
  const parentSet = getParentReqIds(parentSessionId);
  let ctxSize = null;
  let model = '';
  let firstTs = null, lastTs = null;
  const markerRe = /^compact:(?:auto|manual):(\d+)/;
  let input = 0, cc5m = 0, cc1h = 0, cr = 0, out = 0, cost = 0, callCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 11) continue;
    const evt = cols[11] || '';
    if (ctxSize === null) {
      const m = evt.match(markerRe);
      if (m) ctxSize = Number(m[1]);
    }
    if (cols[1]) model = cols[1];
    const ts = Number(cols[0]);
    if (ts) {
      if (firstTs === null || ts < firstTs) firstTs = ts;
      if (lastTs === null || ts > lastTs) lastTs = ts;
    }
    const req = cols[13] || '';
    // Drop parent-replay rows via reqId dedup.
    if (req && parentSet && parentSet.has(req)) continue;
    const rowCost = Number(cols[8]) || 0;
    const rowInput = Number(cols[2]) || 0;
    if (rowCost <= 0 && rowInput <= 0) continue; // skip event-only rows
    input += rowInput;
    cc5m += Number(cols[4]) || 0;
    cc1h += Number(cols[5]) || 0;
    cr += Number(cols[6]) || 0;
    out += Number(cols[7]) || 0;
    cost += rowCost;
    callCount++;
  }
  if (callCount === 0) return { ctxSize, model, totals: null, firstTs, lastTs };
  return {
    ctxSize,
    model,
    totals: { input, cc5m, cc1h, cr, out, cost, callCount },
    firstTs,
    lastTs,
  };
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
      _sessionProjectMap.set(sess, { proj });
      // Also map subagent IDs with parent session reference
      // listSubagents() returns directory names (e.g. "a3f8c62d612b97b5a")
      // but raw.sessions uses "agent-{id}" as sessionId — map both forms
      const agents = listSubagents(proj, sess);
      for (const agent of agents) {
        const info = { proj, parentSessionId: sess, agentDirName: agent };
        _sessionProjectMap.set(agent, info);
        _sessionProjectMap.set('agent-' + agent, info);

        // Acompact aggregation: for each acompact-* subagent, sum its timeline
        // totals and key by (parentSessionId, ctxSize) so readTimelineCsv can
        // merge this into the parent's compact:auto:<ctxSize> marker row.
        if (isAcompactAgent(agent)) {
          const agg = readAcompactAggregate(proj, sess, agent);
          if (agg && agg.totals && agg.totals.callCount > 0) {
            const entry = {
              input: agg.totals.input,
              cc5m: agg.totals.cc5m,
              cc1h: agg.totals.cc1h,
              cr: agg.totals.cr,
              out: agg.totals.out,
              cost: agg.totals.cost,
              callCount: agg.totals.callCount,
              model: agg.model,
              agentDirName: agent,
              firstTs: agg.firstTs,
              lastTs: agg.lastTs
            };
            if (agg.ctxSize !== null) {
              if (!acompactCostByParent.has(sess)) acompactCostByParent.set(sess, new Map());
              const byCtx = acompactCostByParent.get(sess);
              const existing = byCtx.get(agg.ctxSize);
              if (!existing || agg.totals.cost > existing.cost) byCtx.set(agg.ctxSize, entry);
            } else {
              // Fallback: no ctxSize — match by timestamp proximity later
              if (!acompactByParentNoCtx.has(sess)) acompactByParentNoCtx.set(sess, []);
              acompactByParentNoCtx.get(sess).push(entry);
            }
          }
        }
      }
    }
  }
}

// Collect all timeline rows, keyed by sessionId
// Skip acompact subagent sessions — their cost is now attributed to the
// parent's compact:auto marker row (merged in readTimelineCsv).
const allTimelines = new Map();
for (const s of raw.sessions) {
  if (isAcompactSessionId(s.sessionId)) continue;
  const rows = readTimelineCsv(s.sessionId);
  if (rows.length > 0) allTimelines.set(s.sessionId, rows);
}

// Flatten all rows for aggregation
const allRows = [];
for (const [, rows] of allTimelines) {
  for (const row of rows) allRows.push(row);
}

// ── Scan compact caches for alert messages ─────────────────────
// Simplified format: [L{n} User HH:MM:SS]{allMarkers} {text}
// Groups: 1=lineNum, 2=time (HH:MM or HH:MM:SS, optionally prefixed MM-DDT), 3=allMarkers (entire marker string), 4=text
// v1.4.0 compact-timeline-separation: compact.txt holds ONLY user-side markers:
//   @ / @@ (startup/clear)  + / ++ (manual/auto compact)  ~ (reload-plugins)
//   ! (model-change)        ^ / ^^ (/continue skill)
// Cost * / **, ctx # / ##, heuristic ?, rate-limit % are in timeline.csv's
// `markers` column and joined here by buildAlertsFromUserTurns.
// v6 compact format: [Session:{sid8} {ISO} L{lineNum}]{markers} User: "{text}"
// Groups: 1=ISO timestamp, 2=lineNum, 3=markers, 4=text (may contain inner quotes)
const ALERT_LINE_RE = /^\[Session:\w+ (\S+) L(\d+)\]([^\s]*)\s+User:\s*"(.*)/;

const { execFile } = require('child_process');
const PREPROCESS_PATH = path.join(__dirname, 'preprocess.js');
const PARALLEL_LIMIT = 5;

// Ensure compact caches are fresh. preprocess.js self-manages (version + mtime
// check, skip if fresh, write to cache if stale). We just call it for each session.
function ensureCompactCaches(sessionIds) {
  const tasks = [];
  for (const sid of sessionIds) {
    const sess = sessionMap.get(sid);
    if (!sess) continue;
    if (sess.filePath && sess.filePath.match(_subagentSep)) continue;
    if (!sess.filePath || !fs.existsSync(sess.filePath)) continue;
    tasks.push(sess.filePath);
  }
  if (tasks.length === 0) return Promise.resolve();

  let idx = 0;
  let running = 0;
  return new Promise((resolve) => {
    function next() {
      while (running < PARALLEL_LIMIT && idx < tasks.length) {
        const fp = tasks[idx++];
        running++;
        execFile('node', [PREPROCESS_PATH, fp], { timeout: 30000 }, () => {
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
  const info = _sessionProjectMap.get(sessionId);
  if (!info) return [];
  const compactPath = getCompactPath(info.proj, sessionId, false);
  if (!fs.existsSync(compactPath)) return [];

  // Old-format compacts are regenerated by generateMissingCompacts (version check).
  const content = fs.readFileSync(compactPath, 'utf8');
  const lines = content.split('\n');
  const alerts = [];

  // v1.4.0 compact-timeline-separation: compact.txt now holds only USER-SIDE
  // markers (@ @@ + ++ ~ ! ^ ^^). We emit ONE alert per USER line (even unmarked
  // ones) so that buildAlertsFromUserTurns can attach aggregated cost data from
  // timeline.csv. Unmarked user turns with no interesting cost aggregation are
  // filtered out inside buildAlertsFromUserTurns (it returns a pruned list).
  for (const line of lines) {
    const m = ALERT_LINE_RE.exec(line);
    if (!m) continue;
    // v6 groups: 1=ISO timestamp, 2=lineNum, 3=markers, 4=text (trailing quote stripped)
    const markers = m[3] || '';
    const sessionMark = (markers.match(/@{1,2}/) || [''])[0];
    const compactMark = (markers.match(/\+{1,2}/) || [''])[0];
    const reloadMark = markers.includes('~') ? '~' : '';
    const modelMark = markers.includes('!') ? '!' : '';
    const contMark = (markers.match(/\^{1,2}/) || [''])[0];
    const text = (m[4] || '').replace(/"$/, '');

    const alertTypes = [];
    if (compactMark === '+') alertTypes.push('compact-manual');
    else if (compactMark === '++') alertTypes.push('compact-auto');
    if (reloadMark === '~') alertTypes.push('reload-plugins');
    if (modelMark === '!') alertTypes.push('model-change');
    if (contMark === '^') alertTypes.push('continue-1');
    else if (contMark === '^^') alertTypes.push('continue-n');
    if (sessionMark === '@') alertTypes.push('startup');
    else if (sessionMark === '@@') alertTypes.push('clear');

    alerts.push({
      sessionId,
      lineNum: Number(m[2]),
      time: m[1],
      markers: markers,
      text: text.slice(0, 300),
      alertType: alertTypes.join('+') || 'info',
      tokens: null,
      isInfoOnly: true,
      turnBreakdown: null,
      hasUserSideMarker: alertTypes.length > 0
    });
  }
  return alerts;
}

// v1.4.0 compact-timeline-separation — per user-turn aggregation.
//
// Joins user-side alerts (from compact.txt, via readCompactAlerts) with
// timeline.csv rows that fall into the same user turn (line-number range).
//
// For a user alert at JSONL line Lu, aggregates ALL timeline rows with
// row.line in [Lu+1, nextUserLine-1]. Total cost/tokens and the union of
// assistant-side markers are applied to the alert.
//
// This replaces the old nearest-timestamp 1:1 match that underreported
// multi-turn prompts (see docs/01-plan/features/compact-timeline-separation.plan.md).
// Per-session user turn aggregation cache.
// Key: sessionId. Value: Map<lineNum, turnAggregate> where turnAggregate has
// the aggregated tokens/cost/flags for one user turn.
// Single source of truth shared by buildAlertsFromUserTurns (alerts/badges) and
// buildContextCostScatters (per-user-turn chart). Computed once per session.
const _sessionUserTurnCache = new Map();

function computeSessionUserTurns(sessionId, userAlerts, timelineRows) {
  if (_sessionUserTurnCache.has(sessionId)) return _sessionUserTurnCache.get(sessionId);
  if (!userAlerts || userAlerts.length === 0 || !timelineRows || timelineRows.length === 0) {
    _sessionUserTurnCache.set(sessionId, { sortedAlerts: userAlerts || [], aggregates: new Map() });
    return _sessionUserTurnCache.get(sessionId);
  }
  const sortedAlerts = userAlerts.slice().sort((a, b) => a.lineNum - b.lineNum);
  const turnIdx = new Map();
  for (const a of sortedAlerts) turnIdx.set(a.lineNum, []);

  // For each timeline row, find the user alert that owns its turn via binary search.
  // Special case: compact:auto marker rows (merged from acompact) are emitted at
  // the line BEFORE the triggering user turn. Attribute them to the NEXT user
  // alert (the continuation prompt) so acompact cost shows up on the right turn.
  for (const row of timelineRows) {
    let rline = row.line || 0;
    if (rline <= 0) continue;
    if (row.mergedFromAcompact) rline = rline + 1;
    let lo = 0, hi = sortedAlerts.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sortedAlerts[mid].lineNum <= rline) { found = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (found < 0) continue;
    turnIdx.get(sortedAlerts[found].lineNum).push(row);
  }

  const aggregates = new Map();
  for (const alert of sortedAlerts) {
    const rows = turnIdx.get(alert.lineNum) || [];
    if (rows.length === 0) continue;
    const agg = { input: 0, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 0, cost: 0 };
    let hasCtxWarn = false, hasCtxDanger = false, hasHeuristic = false;
    const rlTypes = new Set();
    const breakdown = [];
    let acompactCostSum = 0, acompactCallSum = 0;
    let firstCtx = null;
    let maxCrRow = null; // track single API call with largest cache read
    let apiCallCount = 0;
    for (const row of rows) {
      if (row.mergedFromAcompact) {
        acompactCostSum += row.acompactCost || 0;
        acompactCallSum += row.acompactCallCount || 0;
      }
      if (row.cost > 0 || row.input > 0) {
        apiCallCount++;
        if (firstCtx === null) {
          firstCtx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
        }
        agg.input += row.input || 0;
        agg.cc += row.cc || 0;
        agg.cc5m += row.cc5m || 0;
        agg.cc1h += row.cc1h || 0;
        agg.cr += row.cr || 0;
        agg.out += row.out || 0;
        agg.cost += row.cost || 0;
        // Track the single API call with the largest context (input + cc + cr)
        const rowCtx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
        if (!maxCrRow || rowCtx > maxCrRow.ctx) {
          maxCrRow = { ctx: rowCtx, cr: row.cr || 0, cost: row.cost || 0 };
        }
        breakdown.push({ line: row.line, ts: row.ts, cost: row.cost, evt: row.evt || '', rl: row.rl || '', model: row.model || '' });
      }
      const evt = row.evt || '';
      if (evt.includes('ctx_danger')) hasCtxDanger = true;
      else if (evt.includes('ctx_warn')) hasCtxWarn = true;
      if (evt.includes('heuristic_resume')) hasHeuristic = true;
      if (row.rl) {
        const m = row.rl.match(/^limit_hit_(5h|weekly|opus|sonnet|extra|unknown)/);
        if (m) rlTypes.add(m[1]);
      }
    }
    aggregates.set(alert.lineNum, {
      alert, agg, hasCtxWarn, hasCtxDanger, hasHeuristic, rlTypes,
      breakdown, acompactCostSum, acompactCallSum, firstCtx, apiCallCount, maxCrRow
    });
  }
  const result = { sortedAlerts, aggregates };
  _sessionUserTurnCache.set(sessionId, result);
  return result;
}

function buildAlertsFromUserTurns(sessionId, userAlerts, timelineRows) {
  if (!userAlerts || userAlerts.length === 0) return userAlerts || [];
  if (!timelineRows || timelineRows.length === 0) {
    return userAlerts.filter(a => a.hasUserSideMarker);
  }
  const { sortedAlerts, aggregates } = computeSessionUserTurns(sessionId, userAlerts, timelineRows);

  for (const alert of sortedAlerts) {
    const turn = aggregates.get(alert.lineNum);
    if (!turn) continue;
    const { agg, hasCtxWarn, hasCtxDanger, hasHeuristic, rlTypes, breakdown, acompactCostSum, acompactCallSum, apiCallCount, maxCrRow } = turn;

    // Per-user-turn aggregated cost thresholds (higher than per-row because a
    // single user prompt can fan out to many assistant turns; $0.80/$2.50 cuts
    // noise vs the per-row $0.50/$1.00 banding).
    // TURN_COST_WARN, TURN_COST_DANGER defined at file top
    let hasCostWarn = false, hasCostDanger = false;
    if (agg.cost >= TURN_COST_DANGER) hasCostDanger = true;
    else if (agg.cost >= TURN_COST_WARN) hasCostWarn = true;

    const types = alert.alertType === 'info' ? [] : alert.alertType.split('+');
    if (hasCostDanger) types.push('cost-danger');
    else if (hasCostWarn) types.push('cost-warn');
    if (hasCtxDanger) types.push('ctx-danger');
    else if (hasCtxWarn) types.push('ctx-warn');
    if (hasHeuristic) types.push('resume-heuristic');
    for (const rl of rlTypes) types.push('rate-limit-' + rl);
    if (types.length > 0) {
      alert.alertType = types.join('+');
      if (hasCostWarn || hasCostDanger || hasCtxWarn || hasCtxDanger || rlTypes.size > 0) {
        alert.isInfoOnly = false;
      }
    }

    alert.tokens = {
      input: agg.input,
      cc: agg.cc,
      cc5m: agg.cc5m,
      cc1h: agg.cc1h,
      cr: agg.cr,
      out: agg.out,
      cost: Math.round(agg.cost * 10000) / 10000
    };
    alert.apiCallCount = apiCallCount;
    if (maxCrRow) {
      alert.peak = { ctx: maxCrRow.ctx, cr: maxCrRow.cr, cost: Math.round(maxCrRow.cost * 10000) / 10000 };
    }
    alert.turnBreakdown = breakdown;
    alert.turnCount = breakdown.length;
    if (acompactCostSum > 0) {
      alert.acompactCost = Math.round(acompactCostSum * 10000) / 10000;
      alert.acompactCallCount = acompactCallSum;
    }

    // Build short-form badge string from aggregated evt/rl state for template
    // rendering. alert.markers originally held compact.txt user-side markers
    // only; we append the assistant-side display badges here.
    const rlBadgeMap = { '5h':'%5', 'weekly':'%W', 'opus':'%O', 'sonnet':'%S', 'extra':'%X', 'unknown':'%%' };
    const assistMarks = [];
    if (hasCostDanger) assistMarks.push('**');
    else if (hasCostWarn) assistMarks.push('*');
    if (hasCtxDanger) assistMarks.push('##');
    else if (hasCtxWarn) assistMarks.push('#');
    if (hasHeuristic) assistMarks.push('?');
    for (const rl of rlTypes) assistMarks.push(rlBadgeMap[rl] || '%%');
    if (assistMarks.length > 0) {
      alert.markers = (alert.markers || '') + assistMarks.join('');
    }

    // Build readable prefix from both user-side and assistant-side markers.
    // Dual-encoding: short-form markers stay in alert.markers for rule-based
    // processing; readablePrefix provides human/LLM-readable labels for display.
    const prefixParts = [];
    // Re-parse user-side markers from alert.markers (set by readCompactAlerts)
    const um = alert.markers || '';
    if (um.includes('@@')) prefixParts.push('/clear');
    else if (um.includes('@')) prefixParts.push('(session start)');
    if (um.includes('++')) prefixParts.push('(autocompact)');
    else if (um.includes('+')) prefixParts.push('/compact');
    if (um.includes('~')) prefixParts.push('/reload-plugins');
    if (um.includes('!')) prefixParts.push('/model');
    if (um.includes('^^')) prefixParts.push('/continue (multi)');
    else if (um.includes('^') && !um.includes('^^')) prefixParts.push('/continue');
    // Assistant-side markers (from aggregated timeline data)
    if (hasCostDanger) prefixParts.push('💸$2.50+');
    else if (hasCostWarn) prefixParts.push('💸$0.80+');
    if (hasCtxDanger) prefixParts.push('📏ctx70%+');
    else if (hasCtxWarn) prefixParts.push('📏ctx35%+');
    if (hasHeuristic) prefixParts.push('?resume');
    for (const rl of rlTypes) {
      prefixParts.push('%' + ({ '5h':'5h', 'weekly':'W', 'opus':'O', 'sonnet':'S', 'extra':'X' }[rl] || rl));
    }
    if (prefixParts.length > 0) {
      alert.readablePrefix = prefixParts.join(' & ');
    }
  }

  // Prune: keep an alert if it has a user-side marker OR if aggregation
  // produced a cost/ctx/heuristic/rate-limit marker (isInfoOnly=false).
  // Unmarked turns with no interesting cost would otherwise flood the dashboard.
  return sortedAlerts.filter(a => a.hasUserSideMarker || a.isInfoOnly === false);
}

// Deprecated — replaced by buildAlertsFromUserTurns. Kept as a no-op shim
// because the window-building loop calls this per-alert; enrichment now
// happens in a single batch call earlier in the pipeline.
function matchAlertWithTimeline(_alert, _timelineRows) {
  // No-op: alerts are already enriched by buildAlertsFromUserTurns.
  return;
}

// Build context-vs-cost analysis data:
//   perAssistant    — scatter of every API call with cost >= $1 (shows clear slope)
//   perUserTurn     — scatter of every user turn with aggregated cost >= $4
//                     (shows the same pattern at turn-level granularity)
// dominantBreakdown — counts of $1+ API calls by dominant cost contributor,
//                     used by the AI prompt to highlight that cache_write drives
//                     nearly 100% of expensive calls.
//
// Each point carries marker badge, time, sid, text, token breakdown.
function buildContextCostScatters(allTimelines, sessionMap) {
  const USER_TURN_COST_FLOOR = 0;
  const points = [];        // per assistant API call
  const userTurnPoints = [];  // per user turn (aggregated)
  // Dominant-type counts across ALL $1+ calls (used by AI prompt, not chart).
  const dominantBreakdown = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
  let maxX = 0;

  // Compose a short badge string from evt + rl for display (mirrors template.html).
  function evtRlToBadge(evt, rl) {
    const parts = (evt || '').split('|').filter(Boolean);
    let s = '';
    if (parts.indexOf('cost_danger') >= 0) s += '**';
    else if (parts.indexOf('cost_warn') >= 0) s += '*';
    if (parts.indexOf('ctx_danger') >= 0) s += '##';
    else if (parts.indexOf('ctx_warn') >= 0) s += '#';
    if (parts.indexOf('heuristic_resume') >= 0) s += '?';
    if (rl) {
      const m = rl.match(/^limit_hit_(5h|weekly|opus|sonnet|extra|unknown)/);
      if (m) {
        const map = { '5h':'%5','weekly':'%W','opus':'%O','sonnet':'%S','extra':'%X','unknown':'%%' };
        s += map[m[1]] || '%%';
      }
    }
    return s;
  }

  // Format MM-DD HH:MM from epoch seconds (local time).
  function fmtLocalTime(epochSec) {
    if (!epochSec) return '';
    const d = new Date(epochSec * 1000);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${mi}`;
  }

  for (const [sessionId, rows] of allTimelines) {
    const sess = sessionMap.get(sessionId);
    if (!sess) continue;
    const shortSid = sessionId.replace(/^agent-/, '').slice(0, 8);

    // For per-assistant tooltips we want the enclosing user prompt's text
    // so the user can see "what prompt triggered this expensive call".
    // Subagents have no compact.txt → we'll fall back to the row's own data.
    const isSubagent = sess.filePath && sess.filePath.match(_subagentSep);
    let sortedUsers = [];
    let userAlerts = [];
    if (!isSubagent) {
      userAlerts = readCompactAlerts(sessionId) || [];
      sortedUsers = userAlerts.slice().sort((a, b) => a.lineNum - b.lineNum);
    }

    function findEnclosingUser(rline) {
      if (!sortedUsers.length || rline <= 0) return null;
      let lo = 0, hi = sortedUsers.length - 1, found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sortedUsers[mid].lineNum <= rline) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return found >= 0 ? sortedUsers[found] : null;
    }

    // Per-assistant: every real-turn row with cost >= $1 becomes a scatter point.
    // Separately, we count the dominant cost contributor for AI reporting.
    for (const row of rows) {
      if (row.cost <= 0 || row.input <= 0) continue;
      // Skip merged acompact rows — they aggregate 100-200 subagent calls into
      // a single synthetic row, which breaks the "cost per API call" semantics
      // (produces billion-token x-axis and hundreds-of-dollars y-axis outliers).
      if (row.mergedFromAcompact) continue;
      const ctx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
      if (ctx <= 0) continue;
      if (ctx > maxX) maxX = ctx;

      // Compute cost breakdown per token type using model pricing to classify
      // the dominant contributor — used ONLY for the breakdown counts fed to AI.
      const rates = getRates(row.model);
      const inputCost = (row.input || 0) * rates.input / 1e6;
      const outputCost = (row.out || 0) * rates.output / 1e6;
      const ccWriteCost =
        (row.cc5m || 0) * rates.cacheCreate5m / 1e6 +
        (row.cc1h || 0) * rates.cacheCreate1h / 1e6;
      const crReadCost = (row.cr || 0) * rates.cacheRead / 1e6;
      let dom = 'input', domCost = inputCost;
      if (outputCost > domCost) { dom = 'output'; domCost = outputCost; }
      if (ccWriteCost > domCost) { dom = 'cacheCreate'; domCost = ccWriteCost; }
      if (crReadCost > domCost) { dom = 'cacheRead'; domCost = crReadCost; }
      dominantBreakdown[dom]++;
      // CW: $0.05 floor; Non-CW: no floor (include all)
      const parent = findEnclosingUser(row.line || 0);
      points.push({
        x: ctx,
        y: Math.round(row.cost * 10000) / 10000,
        badge: evtRlToBadge(row.evt, row.rl),
        // Always use row.ts for accurate local-time conversion (parent.time is UTC text from compact.txt)
        time: fmtLocalTime(row.ts),
        sid: shortSid,
        text: parent ? (parent.text || '') : '',
        input: row.input,
        out: row.out,
        cc: (row.cc5m || 0) + (row.cc1h || 0),
        cr: row.cr,
        dom: dom,
        cw1hCost: Math.round((row.cc1h || 0) * rates.cacheCreate1h / 1e6 * 10000) / 10000,
        cw5mCost: Math.round((row.cc5m || 0) * rates.cacheCreate5m / 1e6 * 10000) / 10000,
        crCost: Math.round(crReadCost * 10000) / 10000,
        mdl: (row.model || '').includes('opus') ? 'O' : (row.model || '').includes('haiku') ? 'H' : 'S'
      });
    }

    // Per-user-turn chart points — reuse the shared cache (single source of
    // truth with buildAlertsFromUserTurns). Avoids re-computing the same
    // per-user-turn aggregates twice.
    if (isSubagent || sortedUsers.length === 0) continue;
    const sessionTurns = computeSessionUserTurns(sessionId, userAlerts, rows);
    for (const turn of sessionTurns.aggregates.values()) {
      if (turn.agg.cost < USER_TURN_COST_FLOOR) continue;
      if (turn.firstCtx === null || turn.firstCtx <= 0) continue;
      // Build display badge from per-turn aggregated state (mirrors what
      // buildAlertsFromUserTurns puts on alert.markers).
      const cost = turn.agg.cost;
      const badgeParts = [];
      if (cost >= 10.0) badgeParts.push('**');
      else if (cost >= USER_TURN_COST_FLOOR) badgeParts.push('*');
      if (turn.hasCtxDanger) badgeParts.push('##');
      else if (turn.hasCtxWarn) badgeParts.push('#');
      if (turn.hasHeuristic) badgeParts.push('?');
      for (const rl of turn.rlTypes) {
        const map = { '5h':'%5','weekly':'%W','opus':'%O','sonnet':'%S','extra':'%X','unknown':'%%' };
        badgeParts.push(map[rl] || '%%');
      }
      // Use the FIRST row's epoch ts for accurate local-time conversion.
      // turn.alert.time is the raw UTC text from compact.txt — not displayable.
      const firstRowTs = (turn.breakdown[0] && turn.breakdown[0].ts) || 0;
      userTurnPoints.push({
        x: turn.firstCtx,
        y: Math.round(turn.agg.cost * 10000) / 10000,
        badge: badgeParts.join(''),
        time: fmtLocalTime(firstRowTs),
        sid: shortSid,
        text: turn.alert.text || '',
        input: turn.agg.input,
        out: turn.agg.out,
        cc: turn.agg.cc,
        cr: turn.agg.cr,
        callCount: turn.breakdown.length,
        mdl: (() => { const m = (turn.breakdown[0] || {}).model || ''; return m.includes('opus') ? 'O' : m.includes('haiku') ? 'H' : 'S'; })()
      });
    }
  }

  // Simple least-squares linear regression over a point list.
  // Returns { slope, intercept, x0, x1 } for frontend to plot as a 2-point line.
  function linearTrend(points) {
    if (!points || points.length < 2) return null;
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    let x0 = Infinity, x1 = -Infinity;
    for (const p of points) {
      n++; sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y;
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
    }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    return { slope, intercept, x0, x1 };
  }

  // Grid-based density clustering: merge nearby points into bubbles.
  // N=100 grid cells per axis. Each bubble: {x, y, r, n, avgCost, minCost, maxCost, dom, texts[]}.
  // Single-point bubbles retain full detail for tooltip.
  function clusterPoints(pts, gridN) {
    if (!pts || pts.length === 0) return { bubbles: [], trend: null, totalCount: 0 };
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const p of pts) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 0.01;
    const cellW = xRange / gridN;
    const cellH = yRange / gridN;
    const cells = new Map();
    for (const p of pts) {
      const cx = Math.floor((p.x - xMin) / cellW);
      const cy = Math.floor((p.y - yMin) / cellH);
      const key = cx + ',' + cy;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(p);
    }
    const bubbles = [];
    for (const group of cells.values()) {
      const n = group.length;
      let sx = 0, sy = 0, minC = Infinity, maxC = -Infinity;
      const mdlCount = {};
      for (const p of group) {
        sx += p.x; sy += p.y;
        if (p.y < minC) minC = p.y; if (p.y > maxC) maxC = p.y;
        if (p.mdl) mdlCount[p.mdl] = (mdlCount[p.mdl] || 0) + 1;
      }
      const bx = Math.round(sx / n);
      const by = Math.round(sy / n * 10000) / 10000;
      const r = n <= 1 ? 2 : n <= 5 ? 4 : n <= 20 ? 7 : 10;
      // Dominant model in cluster
      let domMdl = 'O';
      let domMdlN = 0;
      for (const [m, c] of Object.entries(mdlCount)) { if (c > domMdlN) { domMdl = m; domMdlN = c; } }
      let totalCalls = 0;
      for (const p of group) totalCalls += (p.callCount || 1);
      const bubble = { x: bx, y: by, r, n, minCost: Math.round(minC * 100) / 100, maxCost: Math.round(maxC * 100) / 100, mdl: domMdl, calls: totalCalls };
      if (n === 1) {
        // Single-point: retain full detail
        const p = group[0];
        bubble.badge = p.badge; bubble.time = p.time; bubble.sid = p.sid;
        bubble.text = p.text; bubble.input = p.input; bubble.out = p.out;
        bubble.cc = p.cc; bubble.cr = p.cr;
      } else {
        // Multi-point: top 3 texts by cost
        const sorted = group.slice().sort((a, b) => b.y - a.y);
        bubble.topTexts = sorted.slice(0, 3)
          .map(p => ({ cost: Math.round(p.y * 100) / 100, text: (p.text || '').slice(0, 60), input: p.input, out: p.out, cc: p.cc, cr: p.cr, calls: p.callCount || 1 }));
      }
      bubbles.push(bubble);
    }
    return { bubbles, totalCount: pts.length };
  }

  // Split perAssistant points by dom for pre-clustered export
  const cwPoints = points.filter(p => p.dom === 'cacheCreate');
  const nonCwPoints = points.filter(p => p.dom !== 'cacheCreate');

  // Trend from a specific cost field (cwCost or crCost) instead of total y
  function componentTrend(pts, costField) {
    const mapped = pts.filter(p => p[costField] > 0).map(p => ({ x: p.x, y: p[costField] }));
    return linearTrend(mapped);
  }

  const cwClustered = clusterPoints(cwPoints, 50);
  const nonCwClustered = clusterPoints(nonCwPoints, 50);

  // Model pricing for reference lines — pass all 3 models so template can switch
  const pricingJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-pricing.json'), 'utf8'));
  const modelPricing = {};
  for (const [key, label] of [['claude-opus-4-6', 'Opus'], ['claude-sonnet-4-6', 'Sonnet'], ['claude-haiku-4-5-20251001', 'Haiku']]) {
    const m = pricingJson.models[key];
    if (m) modelPricing[label] = { cw1h: m.cacheCreate1h, cw5m: m.cacheCreate5m, cr: m.cacheRead };
  }
  cwClustered.modelPricing = modelPricing;
  nonCwClustered.modelPricing = modelPricing;

  // User Turn: also cluster
  const utClustered = clusterPoints(userTurnPoints, 50);

  return {
    perAssistant: {
      cw: cwClustered,
      nonCW: nonCwClustered,
      totalCount: points.length,
      dominantBreakdown
    },
    perUserTurn: {
      ...utClustered,
      totalCount: userTurnPoints.length,
      costFloor: USER_TURN_COST_FLOOR
    },
    maxX: Math.ceil(maxX * 1.1)
  };
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
// Exclude acompact subagents from subCount — they're attributed to parent's compact marker.
const subCount = raw.sessions.filter(s => s.filePath && s.filePath.match(_subagentSep) && !isAcompactSessionId(s.sessionId)).length;
const summary = {
  totalCost: 0,
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
// Align summary.totalCost with tokenBreakdown (dedup-corrected source of truth)
summary.totalCost = round2(tb.input.cost + tb.output.cost + tb.cacheCreate1h.cost + tb.cacheCreate5m.cost + tb.cacheRead.cost);

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

// 2c. Ensure compact caches are fresh (parallel, skip subagents)
const allSessionIds = [...sessionMap.keys()];
await ensureCompactCaches(allSessionIds);

// 3. windows

// ── 5h window construction from ratelimit data (ts-precision) ──
// Anthropic switched 5h reset from hour-aligned to first-message+5h on
// ~2026-04-23, so boundaries are now minute-precise. Map each row's raw
// ts (second precision) to a window start using ratelimit 5h_reset values.
// Pre-4/23 hour-aligned data is handled by the same algorithm naturally
// because :00 boundaries are still valid ts values.

const { tsToWindow } = buildGlobalTsMapper();

// First pass: assign covered rows directly via ts-precision mapping.
// Collect uncovered rows for fallback grouping.
const uncoveredRows = [];
for (const [, rows] of allTimelines) {
  for (const row of rows) {
    const ts = typeof row.ts === 'number' ? row.ts : Math.floor(new Date(row.ts).getTime() / 1000);
    row.ts = ts;
    const win = tsToWindow(ts);
    if (win !== null) {
      row.win = win;
    } else {
      uncoveredRows.push({ row, ts });
    }
  }
}

// Fallback: group uncovered rows into 5h blocks anchored by earliest ts.
// Used when timeline activity exists without ratelimit coverage.
uncoveredRows.sort((a, b) => a.ts - b.ts);
let groupStart = null;
for (const { row, ts } of uncoveredRows) {
  if (groupStart === null || ts >= groupStart + FIVE_HOURS_S) {
    groupStart = ts;
  }
  row.win = groupStart;
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
    if (row.cost > 0) activeHoursSet.add(h);
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
      endTime: meta.lastTs ? fsd(new Date(meta.lastTs)) + ' ' + ft(new Date(meta.lastTs)) : '',
      activeHours: Object.keys(hourly).map(Number).sort((a, b) => a - b),
      hourly: hourly
    };

    if (isProgrammatic(meta)) {
      detail.type = 'claude-p';
      programmaticDetails.push(detail);
    } else if (meta.filePath && meta.filePath.match(_subagentSep)) {
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
      endTime: mainMeta && mainMeta.lastTs ? fsd(new Date(mainMeta.lastTs)) + ' ' + ft(new Date(mainMeta.lastTs)) : '',
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

  // Note: do NOT skip here — alertMessages need to be built even for $0-cost
  // windows. Filter happens after alertMessages are constructed.

  // Build alertMessages for this window
  const alertMessages = [];
  const windowDateStr = fsd(winDate);
  const seenSessionIds = new Set();
  for (const [sessionId] of sessionEntries) {
    if (seenSessionIds.has(sessionId)) continue;
    seenSessionIds.add(sessionId);
    if (!compactAlertCache.has(sessionId)) {
      const userAlerts = readCompactAlerts(sessionId);
      // v1.4.0: join with timeline rows for per user-turn aggregation (pruned list returned)
      const tl = allTimelines.get(sessionId) || [];
      const joined = buildAlertsFromUserTurns(sessionId, userAlerts, tl);
      compactAlertCache.set(sessionId, joined);
    }
    const compactAlerts = compactAlertCache.get(sessionId);
    const tlRows = allTimelines.get(sessionId) || [];
    for (const srcAlert of compactAlerts) {
      // Clone alert to prevent mutation across windows (alert.time gets overwritten to local HH:MM)
      const alert = { ...srcAlert };
      // Alert time is UTC. New format: MM-DDTHH:MM, old format: HH:MM
      const sessMeta = sessionMap.get(sessionId);
      const sessDate = new Date(sessMeta ? sessMeta.firstTs : Date.now());
      const timeParts = alert.time.split('T');
      let alertDate;
      if (timeParts.length === 2) {
        // v6 format: YYYY-MM-DDTHH:MM:SSZ or MM-DDTHH:MM:SS
        const [md, hm] = timeParts;
        const dateParts = md.split('-').map(Number);
        let year, mon, day;
        if (dateParts.length === 3) {
          // Full ISO: YYYY-MM-DD
          [year, mon, day] = dateParts;
        } else {
          // Short: MM-DD (use session year)
          [mon, day] = dateParts;
          year = sessDate.getUTCFullYear();
        }
        const hmParts = hm.replace('Z', '').split(':').map(Number);
        const [ah, am] = hmParts;
        const as = hmParts[2] || 0;
        alertDate = new Date(Date.UTC(year, mon - 1, day, ah, am, as));
      } else {
        // Old format: HH:MM or HH:MM:SS — reconstruct from session date, try ±1 day for midnight-crossing sessions
        const hmParts = alert.time.split(':').map(Number);
        const [ah, am] = hmParts;
        const as = hmParts[2] || 0;
        const baseDate = new Date(Date.UTC(sessDate.getUTCFullYear(), sessDate.getUTCMonth(), sessDate.getUTCDate(), ah, am, as));
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

  // Skip windows with no sessions AND no alerts (pure $0 windows with no user activity)
  if (finalSessions.length === 0 && alertMessages.length === 0 && continueEvents.length === 0) continue;

  windows.push({
    date: fsd(winDate),
    start: ft(winDate),
    end: ft(winEndDate),
    // Raw second-precise boundaries from ratelimit data — preferred over
    // re-parsing start/end strings in the renderer.
    startTs: winStart,
    endTs: winEnd,
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
      if (isAcompactSessionId(sid)) continue;
      const sess = sessionMap.get(sid);
      if (sess && sess.filePath && sess.filePath.match(_subagentSep)) subCount2++;
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
    dailyTokenMap.set(key, { date: fsd(d), total: 0, input: 0, cc: 0, out: 0 });
  }
  const entry = dailyTokenMap.get(key);
  entry.total += row.input + row.cc + row.cr + row.out;
  entry.input += row.input;
  entry.cc += row.cc;
  entry.out += row.out;
}
const dailyTokens = [...dailyTokenMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);

// 5. hourlyStats
const hourCostsByDay = {}; // hour -> { dateKey -> cost }
const daySetByHour = {}; // hour -> Set of date strings
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const h = d.getHours();
  const dateKey = fsdKey(d);
  if (!hourCostsByDay[h]) { hourCostsByDay[h] = {}; daySetByHour[h] = new Set(); }
  daySetByHour[h].add(dateKey);
  hourCostsByDay[h][dateKey] = (hourCostsByDay[h][dateKey] || 0) + row.cost;
}

// Boundary timestamps for partial-hour weighting
// Note: uses local time (getHours). DST transitions may cause ±1h per year — negligible.
const firstTs = allRows.length > 0 ? Math.min(...allRows.map(r => r.ts)) : 0;
const lastTs = allRows.length > 0 ? Math.max(...allRows.map(r => r.ts)) : 0;
const firstD = new Date(firstTs * 1000);
const lastD = new Date(lastTs * 1000);
const firstHour = firstD.getHours();
const firstMin = firstD.getMinutes();
const lastHour = lastD.getHours();
const lastMin = lastD.getMinutes() || 1; // avoid /0
const firstDateKey = fsdKey(firstD);
const lastDateKey = fsdKey(lastD);

// Total calendar days in range
const totalCalDays = days;

// For each hour, how many calendar days include it?
function calendarDaysForHour(h) {
  let count = totalCalDays;
  // First day: if h < firstHour, that hour wasn't active on first day
  if (h < firstHour) count--;
  // Last day: if h > lastHour, that hour hasn't happened yet today
  if (h > lastHour) count--;
  return Math.max(count, 1);
}

const hourlyStats = [];
for (let h = 0; h < 24; h++) {
  if (!hourCostsByDay[h]) {
    hourlyStats.push({ hour: h, avg: 0, max: 0, calAvg: 0 });
    continue;
  }
  // Normalize partial-hour costs at boundaries to full-hour equivalent
  // e.g., if only 30 min of data in that hour → cost * 60/30
  // Skip normalization for long periods (30+ days) where boundary effect is negligible
  const shouldNormalize = days <= 14;
  const normalizedCosts = Object.entries(hourCostsByDay[h]).map(([dateKey, cost]) => {
    if (!shouldNormalize) return cost;
    if (h === firstHour && dateKey === firstDateKey && firstMin > 0) {
      return cost * 60 / Math.max(60 - firstMin, 1);
    }
    if (h === lastHour && dateKey === lastDateKey && lastMin < 60) {
      return cost * 60 / Math.max(lastMin, 1);
    }
    return cost;
  });
  const activeDays = daySetByHour[h].size || 1;
  const activeAvg = round2(normalizedCosts.reduce((s, c) => s + c, 0) / activeDays);
  const max = round2(Math.max(...normalizedCosts));
  // Calendar avg: normalized total / calendar days for this hour
  const normalizedTotal = normalizedCosts.reduce((s, c) => s + c, 0);
  const calDays = calendarDaysForHour(h);
  const calAvg = round2(normalizedTotal / calDays);
  hourlyStats.push({ hour: h, avg: activeAvg, max, calAvg });
}

// 6. dowStats
const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowCostsByWeek = {}; // dow -> { weekKey -> cost }
const dowRawCosts = {}; // dow -> total raw cost
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const dow = d.getDay();
  // Use ISO week as key for grouping
  const weekKey = Math.floor(row.ts / (7 * 86400));
  if (!dowCostsByWeek[dow]) { dowCostsByWeek[dow] = {}; dowRawCosts[dow] = 0; }
  dowCostsByWeek[dow][weekKey] = (dowCostsByWeek[dow][weekKey] || 0) + row.cost;
  dowRawCosts[dow] += row.cost;
}

// Count calendar occurrences of each DOW in [fromDate, toDate]
// If first and last day are the same DOW, they represent partial days
// that together make ~24h, so count them as 1 instead of 2.
const firstDow = firstD.getDay();
const lastDow = lastD.getDay();
function calendarDowCount(dow) {
  let count = 0;
  const d = new Date(fromDate);
  while (d <= toDate) {
    if (d.getDay() === dow) count++;
    d.setDate(d.getDate() + 1);
  }
  // First+last day same DOW: partial days combine to ~1 full day
  if (firstDow === lastDow && dow === firstDow && count >= 2) count--;
  return Math.max(count, 1);
}

const dowStats = [];
for (let dow = 0; dow < 7; dow++) {
  if (!dowCostsByWeek[dow]) {
    dowStats.push({ dow, label: dowLabels[dow], avg: 0, max: 0, calAvg: 0 });
    continue;
  }
  // If first+last day are same DOW, merge their week entries into one
  const weekEntries = { ...dowCostsByWeek[dow] };
  if (firstDow === lastDow && dow === firstDow) {
    const firstWeekKey = Math.floor(firstTs / (7 * 86400));
    const lastWeekKey = Math.floor(lastTs / (7 * 86400));
    if (firstWeekKey !== lastWeekKey && weekEntries[firstWeekKey] != null && weekEntries[lastWeekKey] != null) {
      weekEntries[lastWeekKey] += weekEntries[firstWeekKey];
      delete weekEntries[firstWeekKey];
    }
  }
  const costs = Object.values(weekEntries);
  const avg = round2(costs.reduce((s, c) => s + c, 0) / costs.length);
  const max = round2(Math.max(...costs));
  const calCount = Math.max(calendarDowCount(dow), 1);
  const calAvg = round2(dowRawCosts[dow] / calCount);
  dowStats.push({ dow, label: dowLabels[dow], avg, max, calAvg });
}

// 7. Plugin installed date — read CC's authoritative tracking from
// ~/.claude/plugins/installed_plugins.json (`installedAt` field).
// CC writes this on first install and preserves it across version updates.
// Falls back to cache directory birthtime if the file is unavailable.
let pluginInstalledAt = null;
try {
  const installedJsonPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (fs.existsSync(installedJsonPath)) {
    const installed = JSON.parse(fs.readFileSync(installedJsonPath, 'utf8'));
    const entries = installed && installed.plugins && installed.plugins['super-token-saver@ww-w-ai'];
    if (Array.isArray(entries) && entries.length > 0) {
      // Pick the earliest installedAt across scopes (user/project)
      for (const e of entries) {
        if (e && e.installedAt && (!pluginInstalledAt || e.installedAt < pluginInstalledAt)) {
          pluginInstalledAt = e.installedAt;
        }
      }
    }
  }
} catch(e) {}
// Fallback: oldest birthtime across cached version directories
if (!pluginInstalledAt) {
  try {
    const pluginMeta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
    const repoUrl = pluginMeta.repository || '';
    const repoMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (repoMatch) {
      const cacheBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', ...repoMatch[1].split('/'));
      if (fs.existsSync(cacheBase)) {
        for (const ver of fs.readdirSync(cacheBase)) {
          const verDir = path.join(cacheBase, ver);
          try {
            if (!fs.statSync(verDir).isDirectory() && !fs.lstatSync(verDir).isSymbolicLink()) continue;
          } catch(e) { continue; }
          for (const candidate of ['.claude-plugin/plugin.json', 'plugin.json']) {
            try {
              const bt = fs.statSync(path.join(verDir, candidate)).birthtime.toISOString();
              if (!pluginInstalledAt || bt < pluginInstalledAt) pluginInstalledAt = bt;
            } catch(e) {}
          }
        }
      }
    }
  } catch(e) {}
}
// Final fallback: local plugin.json birthtime
if (!pluginInstalledAt) {
  for (const p of [
    path.join(__dirname, '..', '.claude-plugin', 'plugin.json'),
    path.join(__dirname, '..', 'plugin.json'),
  ]) {
    try {
      const bt = fs.statSync(p).birthtime.toISOString();
      if (!pluginInstalledAt || bt < pluginInstalledAt) pluginInstalledAt = bt;
    } catch(e) {}
  }
}

// ── Plan info for REPORT_DATA and AI prompt ────────────────────
const PLAN_INFO = PLAN_INFO_ALL;
const planData = planArg && PLAN_INFO[planArg] ? PLAN_INFO[planArg] : null;

// Context-vs-cost scatter data (two charts: per-assistant, per-user-turn)
const contextCostScatter = buildContextCostScatters(allTimelines, sessionMap);

// Context size distribution — how efficiently is the user managing context?
const ctxBuckets = [
  { label: '~250K', min: 0, max: 250000, count: 0, cost: 0 },
  { label: '250~350K', min: 250000, max: 350000, count: 0, cost: 0 },
  { label: '350~500K', min: 350000, max: 500000, count: 0, cost: 0 },
  { label: '500K+', min: 500000, max: Infinity, count: 0, cost: 0 },
];
for (const row of allRows) {
  const ctx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
  const cost = row.cost || 0;
  for (const b of ctxBuckets) {
    if (ctx >= b.min && ctx < b.max) { b.count++; b.cost += cost; break; }
  }
}
const ctxDistribution = ctxBuckets.map(b => ({
  label: b.label, count: b.count, cost: round2(b.cost),
  avgCost: b.count > 0 ? round2(b.cost / b.count) : 0,
  pct: allRows.length > 0 ? round2(b.count / allRows.length * 100) : 0,
}));

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
  contextCostScatter,
  ctxDistribution,
  pluginInstalledAt,
  currentMode,
  plan: planData ? { key: planData.key, name: planData.name, price: planData.price } : null,
  costThresholds: { turnWarn: TURN_COST_WARN, turnDanger: TURN_COST_DANGER, defaultFilter: DEFAULT_COST_FILTER }
};

// Compute before/after plugin install cost averages (must be before export)
if (reportData.pluginInstalledAt && reportData.dailyTokens) {
  const installDate = new Date(reportData.pluginInstalledAt).toISOString().slice(0, 10);
  const installIdx = reportData.dailyCosts.findIndex(d => {
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
    // Cost averages
    let beforeCost = 0, afterCost = 0, beforeDays = 0, afterDays = 0;
    for (let i = 0; i < reportData.dailyCosts.length; i++) {
      const dc = reportData.dailyCosts[i];
      const dayCost = round2(dc.input + dc.cacheCreate + dc.cacheRead + dc.output);
      if (i < installIdx) { beforeCost += dayCost; beforeDays++; }
      else { afterCost += dayCost; afterDays++; }
    }
    if (beforeDays > 0) reportData._costAvgBefore = round2(beforeCost / beforeDays);
    if (afterDays > 0) reportData._costAvgAfter = round2(afterCost / afterDays);
    // Efficiency: weighted average (sum total / sum output)
    let beforeTotal = 0, beforeOut = 0, afterTotal = 0, afterOut = 0;
    for (let i = 0; i < reportData.dailyTokens.length; i++) {
      const dt = reportData.dailyTokens[i];
      if (dt.out < 1000) continue;
      if (i < installIdx) { beforeTotal += dt.total; beforeOut += dt.out; }
      else { afterTotal += dt.total; afterOut += dt.out; }
    }
    if (beforeOut > 0) reportData._effBefore = round2(beforeTotal / beforeOut);
    if (afterOut > 0) reportData._effAfter = round2(afterTotal / afterOut);
    reportData._installIdx = installIdx;
  }
}

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

  // Continue events: from marker counts (preprocess detects <command-message>super-token-saver:continue)
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

  // Efficiency before/after plugin install (already computed above, before export)
  const effBefore = reportData._effBefore ? reportData._effBefore.toString() : '';
  const effAfter = reportData._effAfter ? reportData._effAfter.toString() : '';
  const costComparison = (reportData._costAvgBefore && reportData._costAvgAfter)
    ? `Daily avg cost — Before plugin: $${reportData._costAvgBefore}/day, After plugin: $${reportData._costAvgAfter}/day` +
      (reportData._costAvgBefore > reportData._costAvgAfter
        ? ` (${round2((1 - reportData._costAvgAfter / reportData._costAvgBefore) * 100)}% reduced)`
        : '')
    : 'Not enough data for cost before/after comparison';
  const effComparison = (effBefore && effAfter)
    ? `Before plugin: ${effBefore}x, After plugin: ${effAfter}x (lower is better, ${effBefore > effAfter ? round2((1 - effAfter / effBefore) * 100) + '% improved' : 'no improvement yet'})`
    : 'Not enough data for before/after comparison';

  // Load model pricing for AI prompt
  const pricingData = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-pricing.json'), 'utf8'));
  const pricingTable = Object.entries(pricingData.models)
    .filter(([k]) => ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'].includes(k))
    .map(([k, v]) => `${k}: input=$${v.input}/MTok, cw5m=$${v.cacheCreate5m}, cw1h=$${v.cacheCreate1h}, cr=$${v.cacheRead}, output=$${v.output}`)
    .join('\n');

  const prompt = `## Usage Data (THESE ARE THE ONLY NUMBERS YOU MAY USE)
(Summary stats shown at the top of the dashboard)
- Period: ${s.dateFrom} ~ ${s.dateTo} (${s.days} days)
- Total cost: $${s.totalCost}, Sessions: ${s.sessionCount} main + ${s.subtaskCount || 0} subtasks
- Plan: ${pi.label}

## API Pricing (per million tokens — use these exact numbers when discussing costs)
(Reference pricing for the models used. Shown as price lines in the "Cost by Context Size" chart)
${pricingTable}
- RULE: Monthly cost extrapolation is ONLY allowed when report period <= 15 days. This report covers ${reportDays} days${shouldExtrapolate ? ' — extrapolation is allowed.' : ' (>15) — do NOT extrapolate or mention monthly projections at all. Simply omit it — do NOT say "extrapolation is not needed" or similar.'}
${planLine}
- Plugin installed: ${reportData.pluginInstalledAt ? new Date(reportData.pluginInstalledAt).toISOString().slice(0, 10) : 'not detected'}

## Token Breakdown
(Shown in the "Token Details" table and "Cost Breakdown" pie chart)
- Input (non-cached new tokens): ${tb.input.tokens.toLocaleString()} tokens ($${tb.input.cost})
- Output (AI response tokens): ${tb.output.tokens.toLocaleString()} tokens ($${tb.output.cost})
- Cache Create 1h (re-storing conversation, 1h tier — main sessions): ${tb.cacheCreate1h.tokens.toLocaleString()} tokens ($${tb.cacheCreate1h.cost})
- Cache Create 5m (re-storing conversation, 5m tier — subtasks): ${tb.cacheCreate5m.tokens.toLocaleString()} tokens ($${tb.cacheCreate5m.cost})
- Cache Read (reusing previously stored conversation): ${tb.cacheRead.tokens.toLocaleString()} tokens ($${tb.cacheRead.cost})

## Hourly Cost Pattern
(Shown in the "Hourly Cost Pattern" bar chart. Avg = active days only, CalAvg = all calendar days)
${hourly}

## Day-of-Week Cost Pattern
(Shown in the "Day-of-Week Cost Pattern" bar chart)
${dow}

## Weekly Costs
(Same data as the "Daily Cost Trend" line chart, grouped by week)
${weeks.join('\n')}

## Rate Limit & Blocking
(Skull icons on the calendar heatmap = rate limit hit)
- Rate-limited windows: ${markerCounts.blockedWindows}
- 5H window alerts: ${rlCount}

## /continue Skill Usage
(super-token-saver plugin feature — restores previous sessions with ZERO API cost)
- Times used: ${markerCounts.continue}

## Session Activity Summary
(Event counts detected from calendar alert markers)
- Session starts/clears: ${markerCounts.startup}
- Cost warnings (per-user-turn ≥$${TURN_COST_WARN}): ${markerCounts.cost}
- Context size warnings (context window ≥35%): ${markerCounts.context}
- Resume/compact events (cache regeneration): ${markerCounts.resume}
- Model changes: ${markerCounts.modelChange}

## Plugin Before/After Comparison
Cost: ${costComparison}
Efficiency (Total/Output ratio, lower = better): ${effComparison}

## API Calls — Dominant Token Type Breakdown
(From the "Cost by Context Size" bubble chart. Each API call is classified by its most expensive token type)
${(() => {
  const pa = reportData.contextCostScatter && reportData.contextCostScatter.perAssistant;
  if (!pa) return 'No scatter data available';
  const bd = pa.dominantBreakdown || { input:0, output:0, cacheCreate:0, cacheRead:0 };
  const total = pa.totalCount;
  function pct(n) { return total > 0 ? (100 * n / total).toFixed(1) + '%' : '0%'; }
  const cwData = pa.cw || { totalCount: 0 };
  const nonCwData = pa.nonCW || { totalCount: 0 };
  return 'Total API calls analyzed: ' + total + '\n'
    + 'CW (cache_write dominant, $1+): ' + cwData.totalCount + ' calls\n'
    + 'Non-CW (input+output+cache_read dominant): ' + nonCwData.totalCount + ' calls\n'
    + '\nBreakdown by dominant cost contributor:\n'
    + '- input dominant:        ' + bd.input        + ' calls (' + pct(bd.input) + ')\n'
    + '- output dominant:       ' + bd.output       + ' calls (' + pct(bd.output) + ')\n'
    + '- cache_write dominant:  ' + bd.cacheCreate  + ' calls (' + pct(bd.cacheCreate) + ')\n'
    + '- cache_read dominant:   ' + bd.cacheRead    + ' calls (' + pct(bd.cacheRead) + ')\n'
    + '\nModel breakdown (CW / Non-CW):\n'
    + (() => {
      const models = { O: 'Opus', S: 'Sonnet', H: 'Haiku' };
      const cwBubbles = (cwData.bubbles || []);
      const ncBubbles = (nonCwData.bubbles || []);
      const counts = {};
      for (const b of cwBubbles) { const m = models[b.mdl] || 'Other'; if (!counts[m]) counts[m] = { cw: 0, ncw: 0 }; counts[m].cw += b.n; }
      for (const b of ncBubbles) { const m = models[b.mdl] || 'Other'; if (!counts[m]) counts[m] = { cw: 0, ncw: 0 }; counts[m].ncw += b.n; }
      return Object.entries(counts).map(([m, c]) => '- ' + m + ': CW=' + c.cw + ', Non-CW=' + c.ncw).join('\n');
    })()
    + '\n\nKEY INSIGHT: Opus cache write is the most expensive per-call cost. '
    + 'Non-CW calls are cheaper individually but accumulate — context size management keeps their total down.';
})()}

## Context Size Efficiency
(From the "Context Size Distribution" bar chart. Shows how many API calls fall into each context size bucket)
${(() => {
  const dist = reportData.ctxDistribution;
  if (!dist || dist.length === 0 || dist.every(b => b.count === 0)) return 'NO DATA — do not mention context distribution in the analysis.';
  return dist.map(b =>
    b.label + ': ' + b.count + ' calls (' + b.pct + '%), total $' + b.cost + ', avg $' + b.avgCost + '/call'
  ).join('\n') + '\nKEY INSIGHT: Lower context = cheaper per call. 500K+ calls are disproportionately expensive. Guide users to /clear then /continue before context grows past 350K.';
})()}

## Calendar Cost Threshold
- Cost warnings shown in calendar use per-user-turn threshold: ≥$${TURN_COST_WARN} (warning), ≥$${TURN_COST_DANGER} (danger)
- Calendar default filter: $${DEFAULT_COST_FILTER} (adjustable by user via slider)
- IMPORTANT: Only mention data that IS shown in the report. If a section says "NO DATA", do NOT fabricate numbers or analysis for it.

## Top Cost Sessions
${top10}

## Plugin: super-token-saver
super-token-saver is a Claude Code plugin that:
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

super-token-saver's /continue skill:
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

// ── Private mode: strip user prompt text from REPORT_DATA ──────
if (privateMode) {
  for (const w of reportData.windows) {
    w.firstMsg = '';
    w.lastMsg = '';
    for (const s of (w.windowSessions || [])) {
      s.firstMsg = '';
      s.lastMsg = '';
    }
    for (const a of (w.alertMessages || [])) {
      a.text = '';
    }
  }
  if (reportData.contextCostScatter) {
    const stripBubbles = (dataset) => {
      if (!dataset || !dataset.bubbles) return;
      for (const b of dataset.bubbles) {
        b.text = '';
        if (b.topTexts) {
          for (const t of b.topTexts) t.text = '';
        }
      }
    };
    const pa = reportData.contextCostScatter.perAssistant;
    if (pa) { stripBubbles(pa.cw); stripBubbles(pa.nonCW); }
    stripBubbles(reportData.contextCostScatter.perUserTurn);
  }
  if (reportData.fiveHAlerts) {
    for (const a of reportData.fiveHAlerts) a.text = '';
  }
  reportData.privateMode = true;
  console.error('Private mode: user prompt text stripped from report data');
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

const jsonStr = JSON.stringify(reportData, null, 0).replace(/<\//g, '<\\/');
const output = template.slice(0, startIdx) +
  marker_start + '\nconst REPORT_DATA = ' + jsonStr + ';\n' + marker_end +
  template.slice(endIdx);

fs.writeFileSync(outputPath, output);
console.error(`Report written to ${outputPath} (${output.length} bytes)`);

})();
