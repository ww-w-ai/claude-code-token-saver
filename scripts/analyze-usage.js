#!/usr/bin/env node
/**
 * Analyze transcript JSONL files for token usage and cost data.
 * Outputs JSON to stdout. Caches results per session.
 *
 * Usage: node analyze-usage.js [options]
 *   --days N        Only analyze last N days (default: all)
 *   --project PATH  Analyze specific project directory (default: all projects)
 *   --force         Force re-analyze, ignore cached results
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");

const CACHE_DIR = path.join(os.homedir(), ".claude", "cc-token-saver");
const CACHE_VERSION = 6; // Bump when cache format changes
const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

// Load model pricing from external file (easy to update when new models launch)
const PRICING_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "model-pricing.json"), "utf8"),
);
const MODEL_PRICING = { ...PRICING_DATA.models };
for (const [alias, target] of Object.entries(PRICING_DATA.aliases)) {
  MODEL_PRICING[alias] = MODEL_PRICING[target];
}
const DEFAULT_PRICING = MODEL_PRICING[PRICING_DATA.default];

const _unknownModels = new Set();
function calcCost(input, cc5m, cc1h, cacheRead, output, model) {
  const rates = MODEL_PRICING[model];
  if (!rates && model && model !== 'unknown' && model !== '<synthetic>' && !_unknownModels.has(model)) {
    _unknownModels.add(model);
    const pricingPath = path.join(__dirname, "model-pricing.json");
    process.stderr.write(
`⚠️  Unknown model "${model}" — using default pricing (${PRICING_DATA.default}).

   Paste this into Claude Code to fix:

   Read ${pricingPath} and add "${model}" to the "models" object.
   Match the existing row format: { "input": N, "cacheCreate5m": N, "cacheCreate1h": N, "cacheRead": N, "output": N, "contextWindow": N }
   Look up pricing at ${PRICING_DATA._source}
   Then re-run /usage-view with --force to regenerate caches.

`);
  }
  const r = rates || DEFAULT_PRICING;
  return (
    (input * r.input +
      cc5m * r.cacheCreate5m +
      cc1h * r.cacheCreate1h +
      cacheRead * r.cacheRead +
      output * r.output) /
    1_000_000
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let days = -1; // -1 = 1 month (default)
  let project = null; // null = all projects
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && i + 1 < args.length) {
      days = parseInt(args[i + 1], 10);
      if (isNaN(days)) days = -1;
      i++;
    } else if (args[i] === "--project" && i + 1 < args.length) {
      project = args[i + 1];
      i++;
    } else if (args[i] === "--force") {
      force = true;
    }
  }

  return { days, project, force };
}

function projectHash(dir) {
  return dir.replace(/[^a-zA-Z0-9]/g, "-");
}

function findTranscriptDirs(opts) {
  if (opts.project) {
    const hash = projectHash(opts.project);
    const dir = path.join(PROJECTS_DIR, hash);
    if (!fs.existsSync(dir)) {
      process.stderr.write(`Warning: transcripts dir not found: ${dir}\n`);
      return [];
    }
    return [dir];
  }
  // Default: all projects
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .map((d) => path.join(PROJECTS_DIR, d))
    .filter((d) => {
      try {
        return fs.statSync(d).isDirectory();
      } catch {
        return false;
      }
    });
}

function listJsonlFiles(dirs, cutoffDate) {
  const files = [];

  function scanDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const f of entries) {
      const fullPath = path.join(dir, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (f.endsWith(".jsonl") && stat.mtime >= cutoffDate) {
          // Skip orphaned subagent transcripts (main session deleted)
          if (fullPath.includes("/subagents/")) {
            const parts = fullPath.split("/subagents/");
            const mainJsonl = parts[0] + ".jsonl";
            if (!fs.existsSync(mainJsonl)) continue;
          }
          files.push({ path: fullPath, mtime: stat.mtime });
        }
      } catch {
        continue;
      }
    }
  }

  for (const dir of dirs) {
    scanDir(dir);
  }
  return files;
}

function getYearMonth(filePath) {
  // Read first few lines to find the earliest timestamp
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    const chunk = buf.toString("utf8", 0, bytesRead);
    const match = chunk.match(/"timestamp"\s*:\s*"(\d{4})-(\d{2})/);
    if (match) return match[1].slice(2) + match[2]; // e.g., "2604"
  } catch {}
  // Fallback: use file mtime
  const d = fs.statSync(filePath).mtime;
  return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0");
}

function getCachePath(sessionId, yearMonth) {
  return path.join(CACHE_DIR, yearMonth, `summary-${sessionId}.json`);
}

function getTimelineCsvPath(sessionId, yearMonth) {
  return path.join(CACHE_DIR, yearMonth, `timeline-${sessionId}.csv`);
}

function isCacheValid(cachePath, transcriptMtime) {
  try {
    const cacheStat = fs.statSync(cachePath);
    if (cacheStat.mtime < transcriptMtime) return false;
    // Check cache version
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return data.cacheVersion === CACHE_VERSION;
  } catch {
    return false;
  }
}

function readCache(cachePath) {
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(cachePath, data) {
  try {
    const dir = path.dirname(cachePath);
    fs.mkdirSync(dir, { recursive: true });

    // Split: JSON metadata (without usageTimeline)
    const { usageTimeline, ...metadata } = data;
    metadata.cacheVersion = CACHE_VERSION;
    fs.writeFileSync(cachePath, JSON.stringify(metadata));

    // CSV timeline
    const sessionId = metadata.sessionId;
    const ym = path.basename(dir);
    const csvPath = getTimelineCsvPath(sessionId, ym);
    const header = "ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt";
    const lines = [header];
    let prevModel = null;
    let prevWin = null;
    for (const e of usageTimeline) {
      const ts = Math.floor(new Date(e.ts).getTime() / 1000);
      const model = e.model !== prevModel ? (e.model || "") : "";
      const win = e.win != null && e.win !== prevWin ? e.win : "";
      const rl = e.rl || "";
      const evt = e.evt || "";
      lines.push(`${ts},${model},${e.input},${e.cacheCreation},${e.cacheCreate5m},${e.cacheCreate1h},${e.cacheRead},${e.output},${e.cost},${win},${rl},${evt}`);
      if (e.model) prevModel = e.model;
      if (e.win != null) prevWin = e.win;
    }
    fs.writeFileSync(csvPath, lines.join("\n") + "\n");
  } catch (err) {
    process.stderr.write(`Warning: failed to write cache: ${err.message}\n`);
  }
}

async function analyzeSession(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let firstTs = null;
  let lastTs = null;
  let firstUserMsg = null;
  let lastUserMsg = null;
  let skillSignature = null; // "Base directory for this skill:..." line for skill session detection
  const userMessageLog = []; // {ts, text} for window-level first/last msg
  let userMsgs = 0;
  let asstMsgs = 0;
  let input = 0;
  let cacheCreation = 0;
  let cacheCreate5m = 0;
  let cacheCreate1h = 0;
  let cacheRead = 0;
  let output = 0;
  let costUSD = 0;
  const usageTimeline = [];
  const rateLimitEvents = [];
  const contextEvents = [];

  // /continue detection state
  let continueStartTs = null;
  let continueReads = [];
  let inContinueSequence = false;

  function flushContinueEvent() {
    if (!inContinueSequence || continueReads.length === 0) return;
    const uniqueFiles = new Set(continueReads.map(r => r.filePath.replace(/\.aggressive\.txt$/, '.txt')));
    const restoredSessionIds = [...uniqueFiles].map(f => {
      const m = f.match(/compact-([0-9a-f-]+)\.txt$/);
      return m ? m[1] : null;
    }).filter(Boolean);
    contextEvents.push({
      type: "continue",
      ts: continueStartTs,
      sessionCount: uniqueFiles.size,
      readCount: continueReads.length,
      lastReadTs: continueReads[continueReads.length - 1].ts,
      restoredSessionIds,
    });
    inContinueSequence = false;
    continueStartTs = null;
    continueReads = [];
  }

  // Rate limit message patterns -> status mapping
  const RATE_LIMIT_PATTERNS = [
    { prefix: "You've hit your", status: "limit_hit" },
    { prefix: "You've used", status: "limit_warning" },
    { prefix: "You're now using extra usage", status: "extra_start" },
    { prefix: "You're close to your extra usage", status: "extra_warning" },
    { prefix: "You're out of extra usage", status: "extra_exhausted" },
  ];

  // Track per-requestId to deduplicate streaming chunks
  const requestUsage = new Map();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const ts =
      obj.timestamp || (obj.message && obj.message.timestamp) || null;
    if (ts) {
      if (!firstTs) firstTs = ts;
      lastTs = ts;
    }

    // Detect /compact events: system messages with subtype "compact_boundary"
    if (obj.type === "system" && obj.subtype === "compact_boundary") {
      const meta = obj.compactMetadata || {};
      contextEvents.push({
        type: "compact",
        ts,
        trigger: meta.trigger || "unknown",
        preTokens: meta.preTokens || 0,
      });
    }

    // Detect /continue skill invocation in user meta messages
    if (obj.type === "user" && obj.isMeta) {
      const content = obj.message && obj.message.content;
      let text = "";
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) text = content.filter(b => b.type === "text" && b.text).map(b => b.text).join(" ");
      if (text.includes("skills/continue")) {
        inContinueSequence = true;
        continueStartTs = ts;
        continueReads = [];
      }
    }

    if (obj.type === "user") {
      userMsgs++;
      // Extract first/last user message text
      if (!obj.isMeta) {
        const content = obj.message && obj.message.content;
        let text = '';
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) text = content.filter(b => b.type === 'text' && b.text).map(b => b.text).join(' ');
        // Strip system tags
        text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
                   .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
                   .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
                   .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, '')
                   .trim();
        // Capture skill signature for session type detection
        if (!skillSignature && text.startsWith('Base directory for this skill:')) {
          skillSignature = text.slice(0, 200);
        }
        // Skip non-genuine messages
        if (text.startsWith('<')) continue;          // any XML/HTML tag
        if (text.startsWith('{') && text.endsWith('}')) continue;  // pure JSON
        if (text.startsWith('/')) continue;           // slash commands
        if (text.startsWith('[User ')) continue;      // subtask prefixes
        if (text.startsWith('This session is being continued')) continue;  // /continue prompts
        if (text.startsWith('Read the preprocessed transcript')) continue;
        if (text.startsWith('CRITICAL:')) continue;   // system prompts
        if (text.startsWith('Write the word')) continue;
        if (text.startsWith('Base directory for this skill:')) continue;  // skill content injection
        if (text.length > 0) {
          if (!firstUserMsg) firstUserMsg = text.slice(0, 80);
          lastUserMsg = text.slice(0, 80);
          userMessageLog.push({ ts, text: text.slice(0, 80) });
        }
      }
    }

    if (obj.type === "assistant") {
      asstMsgs++;

      // Detect rate limit messages in assistant text content
      // and /continue Read calls for compact-*.txt files
      const content = obj.message && obj.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            for (const pat of RATE_LIMIT_PATTERNS) {
              if (block.text.startsWith(pat.prefix)) {
                const rateLimitType = detectRateLimitType(block.text);
                const resetsAt = parseResetsAt(block.text, ts);
                rateLimitEvents.push({
                  ts,
                  status: pat.status,
                  message: block.text,
                  rateLimitType,
                  resetsAt,
                });
                break;
              }
            }
          }
          // Detect Read tool_use calls to compact-*.txt (part of /continue)
          if (inContinueSequence && block.type === "tool_use" && block.name === "Read") {
            const filePath = block.input && block.input.file_path;
            if (filePath && /compact-[0-9a-f-]+\.(txt|aggressive\.txt)$/.test(filePath)) {
              continueReads.push({ ts, filePath });
            }
          }
        }
      }

      // End /continue sequence: non-meta user message or assistant with no Read calls to compact files
      // Actually, the sequence ends when we see a non-Read-compact assistant message after reads started
      if (inContinueSequence && continueReads.length > 0) {
        let hasCompactRead = false;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_use" && block.name === "Read") {
              const fp = block.input && block.input.file_path;
              if (fp && /compact-[0-9a-f-]+\.(txt|aggressive\.txt)$/.test(fp)) {
                hasCompactRead = true;
              }
            }
          }
        }
        if (!hasCompactRead) {
          flushContinueEvent();
        }
      }

      const usage = obj.usage || (obj.message && obj.message.usage);
      const reqId = obj.requestId || (obj.message && obj.message.id);
      const model = obj.message && obj.message.model;
      if (usage && reqId) {
        // Skip synthetic messages (rate limit blocks, login prompts, etc.)
        if (model === "<synthetic>") continue;
        const inp = usage.input_tokens || 0;
        const ccTotal = usage.cache_creation_input_tokens || 0;
        const cr = usage.cache_read_input_tokens || 0;
        const out = usage.output_tokens || 0;
        // Split cache creation into 5m and 1h tiers
        const cacheDetail = usage.cache_creation || {};
        const cc5m = cacheDetail.ephemeral_5m_input_tokens || 0;
        const cc1h = cacheDetail.ephemeral_1h_input_tokens || 0;
        const cc5mFinal = cc5m || 0;
        const cc1hFinal = cc1h || (cc5m ? 0 : ccTotal);
        const msgCost = calcCost(inp, cc5mFinal, cc1hFinal, cr, out, model);
        requestUsage.set(reqId, {
          ts,
          model: model || "unknown",
          input: inp,
          cacheCreation: ccTotal,
          cacheCreate5m: cc5mFinal,
          cacheCreate1h: cc1hFinal,
          cacheRead: cr,
          output: out,
          cost: Math.round(msgCost * 1000000) / 1000000,
        });
      }
    }
  }

  // Flush any pending /continue sequence at end of file
  flushContinueEvent();

  // Aggregate deduplicated usage
  for (const entry of requestUsage.values()) {
    input += entry.input;
    cacheCreation += entry.cacheCreation;
    cacheCreate5m += entry.cacheCreate5m;
    cacheCreate1h += entry.cacheCreate1h;
    cacheRead += entry.cacheRead;
    output += entry.output;
    costUSD += entry.cost;
    usageTimeline.push(entry);
  }

  // rl/evt fields — win is assigned globally in assignGlobalWindows()
  for (const e of usageTimeline) {
    e.win = null;
    e.rl = "";
    e.evt = "";
  }

  // Insert rate limit events into the timeline
  for (const rle of rateLimitEvents) {
    const win = null; // assigned globally in assignGlobalWindows()

    usageTimeline.push({
      ts: rle.ts,
      model: "",
      input: 0,
      cacheCreation: 0,
      cacheCreate5m: 0,
      cacheCreate1h: 0,
      cacheRead: 0,
      output: 0,
      cost: 0,
      win,
      rl: rle.rateLimitType ? `${rle.status}:${rle.rateLimitType}` : rle.status,
      evt: "",
    });
  }

  // Insert context events into the timeline
  for (const ce of contextEvents) {
    usageTimeline.push({
      ts: ce.ts,
      model: "",
      input: 0,
      cacheCreation: 0,
      cacheCreate5m: 0,
      cacheCreate1h: 0,
      cacheRead: 0,
      output: 0,
      cost: 0,
      win: null,
      rl: "",
      evt: ce.type === "compact"
        ? `compact:${ce.trigger}:${ce.preTokens}`
        : `continue:${ce.sessionCount}`,
    });
  }

  // Re-sort after inserting rate limit and context events
  usageTimeline.sort((a, b) => (a.ts > b.ts ? 1 : -1));

  // Determine primary model (most frequent in timeline)
  const modelCounts = {};
  for (const e of usageTimeline) {
    if (e.model && e.model !== "unknown") modelCounts[e.model] = (modelCounts[e.model] || 0) + 1;
  }
  const primaryModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const sessionId = path.basename(filePath, ".jsonl");
  return {
    sessionId,
    filePath,
    firstTs,
    lastTs,
    firstUserMsg,
    lastUserMsg,
    skillSignature,
    userMsgs,
    asstMsgs,
    model: primaryModel,
    tokens: { input, cacheCreation, cacheCreate5m, cacheCreate1h, cacheRead, output },
    costUSD: Math.round(costUSD * 10000) / 10000,
    usageTimeline,
    rateLimitEvents,
    contextEvents,
    userMessageLog,
  };
}

function detectRateLimitType(message) {
  if (!message) return "unknown";
  const lower = message.toLowerCase();
  if (lower.includes("session limit")) return "five_hour";
  if (lower.includes("weekly limit")) return "seven_day";
  if (lower.includes("opus limit")) return "seven_day_opus";
  if (lower.includes("sonnet limit")) return "seven_day_sonnet";
  if (lower.includes("usage limit")) return "unknown";
  if (lower.includes("extra usage")) return "overage";
  return "unknown";
}

function parseResetsAt(message, eventTs) {
  if (!message || !eventTs) return null;
  const m = message.match(/resets\s+(\d{1,2})(am|pm)\s*\(([^)]+)\)/i);
  if (!m) return null;
  let hour = parseInt(m[1]);
  if (m[2].toLowerCase() === 'pm' && hour !== 12) hour += 12;
  if (m[2].toLowerCase() === 'am' && hour === 12) hour = 0;
  const tz = m[3];
  try {
    const evtDate = new Date(eventTs);
    // Get event time in the specified timezone
    const evtLocalMs = new Date(evtDate.toLocaleString('en-US', { timeZone: tz })).getTime();
    const offsetMs = evtLocalMs - evtDate.getTime();
    // Build reset time in local timezone
    const resetLocal = new Date(evtLocalMs);
    resetLocal.setHours(hour, 0, 0, 0);
    // Reset is always after event time
    if (resetLocal.getTime() <= evtLocalMs) resetLocal.setDate(resetLocal.getDate() + 1);
    // Convert back to UTC unix seconds
    return Math.floor((resetLocal.getTime() - offsetMs) / 1000);
  } catch {
    return null;
  }
}

function assignGlobalWindows(files) {
  const FIVE_HOURS_S = 5 * 3600;

  function hourFloor(ts) {
    return ts - (ts % 3600);
  }

  // ========== Phase 1: Build hourly presence map ==========
  const CACHE_DIR_BASE = path.join(os.homedir(), '.claude', 'cc-token-saver');
  const hourMap = new Map(); // hourFloor -> 0|1|2

  function markHour(h, value) {
    const cur = hourMap.get(h) || 0;
    if (value > cur) hourMap.set(h, value);
  }

  // --- 1a. Scan ratelimit CSVs (highest priority) ---
  let rlYymms;
  try { rlYymms = fs.readdirSync(CACHE_DIR_BASE).filter(d => /^\d{4}$/.test(d)); } catch { rlYymms = []; }
  for (const ym of rlYymms) {
    const rlDir = path.join(CACHE_DIR_BASE, ym);
    let rlCsvs;
    try { rlCsvs = fs.readdirSync(rlDir).filter(f => f.startsWith('ratelimit-') && f.endsWith('.csv')); } catch { continue; }
    for (const csv of rlCsvs) {
      const lines = fs.readFileSync(path.join(rlDir, csv), 'utf8').trim().split('\n');
      let lastH5Reset = null;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols[2]) lastH5Reset = Number(cols[2]);
        if (lastH5Reset && lastH5Reset > 0) {
          const winStart = lastH5Reset - FIVE_HOURS_S;
          for (let h = hourFloor(winStart); h < lastH5Reset; h += 3600) {
            markHour(h, 2);
          }
        }
      }
    }
  }

  // --- 1b. Scan all main-session timeline CSVs ---
  // Build summary cache for rl enrichment lookups
  const summaryCache = new Map(); // sessionId:ym -> summary
  function getSummary(sessionId, ym) {
    const key = `${sessionId}:${ym}`;
    if (summaryCache.has(key)) return summaryCache.get(key);
    const cachePath = getCachePath(sessionId, ym);
    let summary = null;
    try { summary = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
    summaryCache.set(key, summary);
    return summary;
  }

  const mainFiles = files.filter(f => !f.path.includes('/subagents/'));
  for (const file of mainFiles) {
    const sessionId = path.basename(file.path, '.jsonl');
    const ym = getYearMonth(file.path);
    const csvPath = getTimelineCsvPath(sessionId, ym);
    if (!fs.existsSync(csvPath)) continue;
    const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');

    // Collect rl events from this CSV
    let lastRl = '';
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const ts = Number(cols[0]);
      if (ts <= 0) continue;

      // Mark hour as having activity
      markHour(hourFloor(ts), 1);

      // Delta-decode rl column
      let rl = cols.length >= 11 ? (cols[10] || '') : '';
      if (!rl && lastRl) rl = lastRl;
      if (rl) lastRl = rl;
      if (!rl) continue;

      // Check for limit_hit or limit_warning (with or without :type suffix)
      const rlBase = rl.split(':')[0];
      if (rlBase !== 'limit_hit' && rlBase !== 'limit_warning') continue;

      const rlParts = rl.split(':');
      const rlType = rlParts.length > 1 ? rlParts.slice(1).join(':') : null;

      let is5h = false;
      let windowResetTs = null;

      if (rlType === 'five_hour') {
        is5h = true;
      } else if (rlType === 'seven_day' || rlType === 'seven_day_opus' || rlType === 'seven_day_sonnet') {
        continue; // skip weekly events
      } else {
        // Old format (no type suffix) or :unknown — look up summary JSON
        const summary = getSummary(sessionId, ym);
        if (summary && Array.isArray(summary.rateLimitEvents)) {
          // Find closest event by timestamp
          let bestEvt = null;
          let bestDist = Infinity;
          for (const evt of summary.rateLimitEvents) {
            const evtUnix = Math.floor(new Date(evt.ts).getTime() / 1000);
            const dist = Math.abs(evtUnix - ts);
            if (dist < bestDist) { bestDist = dist; bestEvt = evt; }
          }
          if (bestEvt && bestDist < 60) {
            const resetsAt = parseResetsAt(bestEvt.message, bestEvt.ts);
            if (resetsAt != null) {
              const gap = resetsAt - ts;
              if (gap > 0 && gap <= FIVE_HOURS_S) {
                is5h = true;
                windowResetTs = resetsAt;
              }
            }
          }
        }
      }

      if (is5h) {
        // Determine the 5h window and mark all hour slots as 2
        let resetTs = windowResetTs;
        if (!resetTs) {
          // For confirmed :five_hour, try to get exact reset from summary
          const summary = getSummary(sessionId, ym);
          if (summary && Array.isArray(summary.rateLimitEvents)) {
            let bestEvt = null;
            let bestDist = Infinity;
            for (const evt of summary.rateLimitEvents) {
              const evtUnix = Math.floor(new Date(evt.ts).getTime() / 1000);
              const dist = Math.abs(evtUnix - ts);
              if (dist < bestDist) { bestDist = dist; bestEvt = evt; }
            }
            if (bestEvt && bestDist < 60) {
              resetTs = parseResetsAt(bestEvt.message, bestEvt.ts);
            }
          }
          // Fallback: round up ts to next 5h boundary
          if (!resetTs) resetTs = ts + FIVE_HOURS_S;
        }
        const wStart = resetTs - FIVE_HOURS_S;
        for (let h = hourFloor(wStart); h < resetTs; h += 3600) {
          markHour(h, 2);
        }
      }
    }
  }

  // ========== Phase 2: Compute windows from the presence map ==========

  const sortedHours = [...hourMap.keys()].sort((a, b) => a - b);
  if (sortedHours.length === 0) return;

  // --- 2a. Anchor windows from `2` slots ---
  // Group contiguous `2` slots
  const anchorWins = []; // [{start, end}]
  let curAnchorStart = null;
  let curAnchorEnd = null;
  for (const h of sortedHours) {
    if (hourMap.get(h) !== 2) continue;
    if (curAnchorStart === null) {
      curAnchorStart = h;
      curAnchorEnd = h + 3600;
    } else if (h <= curAnchorEnd) {
      curAnchorEnd = h + 3600;
    } else {
      anchorWins.push({ start: curAnchorStart, end: curAnchorEnd });
      curAnchorStart = h;
      curAnchorEnd = h + 3600;
    }
  }
  if (curAnchorStart !== null) {
    anchorWins.push({ start: curAnchorStart, end: curAnchorEnd });
  }

  // Collect all windows (start -> end)
  const allWindows = new Map();
  for (const aw of anchorWins) {
    allWindows.set(aw.start, aw.end);
  }

  // --- 2b. Extend anchors backward ---
  for (const anchor of anchorWins) {
    let curStart = anchor.start;
    while (true) {
      const candStart = curStart - FIVE_HOURS_S;
      const candEnd = curStart;

      // Check if another anchor already covers this range
      let inOtherAnchor = false;
      for (const aw of anchorWins) {
        if (aw === anchor) continue;
        if (candStart < aw.end && candEnd > aw.start) {
          inOtherAnchor = true;
          break;
        }
      }
      if (inOtherAnchor) break;

      // Check if any hour in [candStart, candEnd) has real activity (value=1),
      // not just anchor-derived marks (value=2) from other anchors
      let found = false;
      for (let h = candStart; h < candEnd; h += 3600) {
        if (hourMap.get(h) >= 1) { found = true; break; }
      }
      if (found) {
        allWindows.set(candStart, candEnd);
        curStart = candStart;
      } else {
        break;
      }
    }
  }

  // --- 2c. Extend anchors forward ---
  for (const anchor of anchorWins) {
    let curEnd = anchor.end;
    while (true) {
      // Find first hour >= curEnd with any activity
      let nextHour = null;
      for (const h of sortedHours) {
        if (h >= curEnd && hourMap.get(h) >= 1) {
          nextHour = h;
          break;
        }
      }
      if (nextHour == null) break;

      // Check if this hour is already in another anchor's territory
      let inAnchorTerritory = false;
      for (const aw of anchorWins) {
        if (aw === anchor) continue;
        if (nextHour >= aw.start && nextHour < aw.end) {
          inAnchorTerritory = true;
          break;
        }
      }
      if (inAnchorTerritory) break;

      // Check if this hour is already covered by a window we added
      if (allWindows.has(nextHour) && nextHour !== curEnd) {
        // Already handled by another extension
        break;
      }

      const newStart = nextHour;
      const newEnd = newStart + FIVE_HOURS_S;

      // Check we're not overlapping an existing anchor
      let hitsAnchor = false;
      for (const aw of anchorWins) {
        if (aw === anchor) continue;
        if (newStart < aw.end && newEnd > aw.start) {
          hitsAnchor = true;
          break;
        }
      }
      if (hitsAnchor) break;

      allWindows.set(newStart, newEnd);
      curEnd = newEnd;
    }
  }

  // --- 2d. Fill remaining: from first `1` to earliest anchor-derived window ---
  const derivedStarts = [...allWindows.keys()].sort((a, b) => a - b);
  const earliestDerived = derivedStarts.length > 0 ? derivedStarts[0] : Infinity;

  // Chain windows for all activity before earliest derived window
  let chainEnd = 0;
  for (const h of sortedHours) {
    if (h >= earliestDerived) break;
    if (hourMap.get(h) < 1) continue;
    if (chainEnd > 0 && h < chainEnd) continue; // inside existing window
    const winStart = h;
    const winEnd = h + FIVE_HOURS_S;
    if (winEnd > earliestDerived) break; // would overlap anchor territory
    allWindows.set(winStart, winEnd);
    chainEnd = winEnd;
  }

  // Also fill after the last anchor-derived window
  const latestDerivedEnd = derivedStarts.length > 0
    ? Math.max(...[...allWindows.entries()].map(([s, e]) => e))
    : 0;
  chainEnd = latestDerivedEnd;
  for (const h of sortedHours) {
    if (h < latestDerivedEnd) continue;
    if (hourMap.get(h) < 1) continue;
    if (chainEnd > 0 && h < chainEnd) continue;
    const winStart = h;
    const winEnd = h + FIVE_HOURS_S;
    allWindows.set(winStart, winEnd);
    chainEnd = winEnd;
  }

  // ========== Final: Collect, sort, deduplicate, assign ==========
  let windows = [...allWindows.entries()].map(([s, e]) => ({ start: s, end: e }));
  windows.sort((a, b) => a.start - b.start);

  // Merge overlapping windows
  const merged = [];
  for (const w of windows) {
    if (merged.length > 0 && w.start < merged[merged.length - 1].end) {
      // Overlapping — keep the earlier start, extend end if needed
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, w.end);
    } else {
      merged.push({ ...w });
    }
  }

  // Split merged ranges back into non-overlapping 5h windows
  const finalWindows = [];
  for (const m of merged) {
    let s = m.start;
    while (s < m.end) {
      // Ensure no overlap with previous window
      if (finalWindows.length > 0) {
        const prevEnd = finalWindows[finalWindows.length - 1] + FIVE_HOURS_S;
        if (s < prevEnd) s = prevEnd;
        if (s >= m.end) break;
      }
      finalWindows.push(s);
      s += FIVE_HOURS_S;
    }
  }

  const windowStarts = finalWindows;



  // Find window for any timestamp (binary search)
  function findWindow(ts) {
    let lo = 0, hi = windowStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (windowStarts[mid] <= ts) lo = mid + 1;
      else hi = mid - 1;
    }
    return hi >= 0 ? windowStarts[hi] : hourFloor(ts);
  }

  // Build rateLimitEvent lookup by timestamp for rl column enrichment
  const rlByTs = new Map(); // unix_seconds -> { status, type }
  for (const file of files) {
    const sessionId = path.basename(file.path, '.jsonl');
    const ym = getYearMonth(file.path);
    const summary = getSummary(sessionId, ym);
    if (!summary) continue;
    const events = summary.rateLimitEvents;
    if (!Array.isArray(events)) continue;
    for (const evt of events) {
      const evtTs = Math.floor(new Date(evt.ts).getTime() / 1000);
      const type = detectRateLimitType(evt.message);
      rlByTs.set(evtTs, { status: evt.status, type });
    }
  }

  // Rewrite a single timeline CSV with correct win and enriched rl
  function rewriteCsv(csvPath) {
    if (!fs.existsSync(csvPath)) return;
    const content = fs.readFileSync(csvPath, 'utf8').trim();
    const lines = content.split('\n');
    if (lines.length < 2) return;
    const header = lines[0];
    const newLines = [header];
    let prevWin = null;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 11) { newLines.push(lines[i]); continue; }
      const ts = Number(cols[0]);
      const win = findWindow(ts);
      cols[9] = (win !== prevWin) ? String(win) : '';
      prevWin = win;
      // Enrich rl column: if old format (no colon), try to add type
      let rl = cols[10] || '';
      if (rl && !rl.includes(':')) {
        const match = rlByTs.get(ts);
        if (match && match.type) {
          rl = `${match.status}:${match.type}`;
        }
      }
      cols[10] = rl;
      newLines.push(cols.join(','));
    }
    fs.writeFileSync(csvPath, newLines.join('\n') + '\n');
  }

  // Update CSVs from transcript files
  const rewrittenPaths = new Set();
  for (const file of files) {
    const sessionId = path.basename(file.path, '.jsonl');
    const ym = getYearMonth(file.path);
    const csvPath = getTimelineCsvPath(sessionId, ym);
    rewriteCsv(csvPath);
    rewrittenPaths.add(csvPath);
  }

  // Also rewrite any orphaned timeline CSVs not covered by files list
  let allYymms;
  try { allYymms = fs.readdirSync(CACHE_DIR_BASE).filter(d => /^\d{4}$/.test(d)); } catch { allYymms = []; }
  for (const ym of allYymms) {
    const dir = path.join(CACHE_DIR_BASE, ym);
    let csvFiles;
    try { csvFiles = fs.readdirSync(dir).filter(f => f.startsWith('timeline-') && f.endsWith('.csv')); } catch { continue; }
    for (const csv of csvFiles) {
      const csvPath = path.join(dir, csv);
      if (!rewrittenPaths.has(csvPath)) {
        rewriteCsv(csvPath);
      }
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  let cutoff;
  if (opts.days > 0) {
    // Explicit --days N
    cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
  } else if (opts.days === -1) {
    // Default: 1 month ago (same date last month)
    cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 1);
    cutoff.setHours(0, 0, 0, 0);
  } else {
    // --days 0 = all
    cutoff = new Date(0);
  }

  const dirs = findTranscriptDirs(opts);
  if (dirs.length === 0) {
    process.stdout.write(
      JSON.stringify({
        sessions: [],
        summary: {
          totalCost: 0,
          totalTokens: 0,
          sessionCount: 0,
          dateRange: { from: null, to: null },
        },
      }) + "\n",
    );
    return;
  }

  const files = listJsonlFiles(dirs, cutoff);
  process.stderr.write(`Found ${files.length} transcript files\n`);

  // Ensure cache dir exists
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const sessions = [];

  for (const file of files) {
    const sessionId = path.basename(file.path, ".jsonl");
    const ym = getYearMonth(file.path);
    const cachePath = getCachePath(sessionId, ym);

    // Check cache
    if (!opts.force && isCacheValid(cachePath, file.mtime)) {
      const cached = readCache(cachePath);
      if (cached) {
        sessions.push(cached);
        continue;
      }
    }

    // Analyze and cache
    const result = await analyzeSession(file.path);
    writeCache(cachePath, result);
    // Push metadata only (without usageTimeline)
    const { usageTimeline, ...metadata } = result;
    sessions.push(metadata);
  }

  // Assign global 5h windows across all sessions (main sessions define boundaries)
  assignGlobalWindows(files);

  // Filter sessions that have timestamps and are within cutoff, sort by firstTs descending
  // Also exclude /continue skill invocation sessions (their first user message
  // starts with "Base directory for this skill:" and contains "skills/continue")
  const valid = sessions
    .filter((s) => s.firstTs && s.lastTs && new Date(s.firstTs) >= cutoff)
    .filter((s) => {
      const sig = s.skillSignature || '';
      return !(sig.includes('skills/continue'));
    })
    .sort((a, b) => new Date(b.firstTs) - new Date(a.firstTs));

  // Remove internal-only fields from output
  for (const s of valid) delete s.skillSignature;

  // Build summary inline
  const totalCost = Math.round(valid.reduce((s, x) => s + x.costUSD, 0) * 100) / 100;
  const totalTokens = valid.reduce(
    (s, x) =>
      s +
      x.tokens.input +
      x.tokens.cacheCreation +
      x.tokens.cacheRead +
      x.tokens.output,
    0,
  );
  const dates = valid
    .filter((s) => s.firstTs)
    .flatMap((s) => [s.firstTs, s.lastTs])
    .sort();
  const dateRange = dates.length > 0
    ? { from: dates[0], to: dates[dates.length - 1] }
    : { from: null, to: null };

  const output = {
    sessions: valid,
    summary: {
      totalCost,
      totalTokens,
      sessionCount: valid.length,
      dateRange,
    },
  };

  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
