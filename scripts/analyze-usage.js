#!/usr/bin/env node
/**
 * Analyze transcript JSONL files for token usage and cost data.
 * Outputs JSON to stdout. Caches results per session in project/session hierarchy.
 *
 * Usage: node analyze-usage.js [options]
 *   --days N        Only analyze last N days (default: all)
 *   --project PATH  Analyze specific project directory (default: all projects)
 *   --force         Force re-analyze, ignore cached results
 *
 * Timeline CSV columns: ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt
 *   win: 5h window start (sparse, simple hourFloor+5h per session)
 *   rl: rate limit event (limit_hit_5h, limit_hit_weekly, limit_hit_opus, limit_hit_sonnet, limit_hit_extra, limit_hit_unknown) + reset info
 *   evt: context/cost events, pipe-separated (startup, compact, cost_warn, ctx_danger, etc.)
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");

const {
  CACHE_BASE: CACHE_DIR,
  extractProjectName,
  getSessionDir,
  getTimelinePath,
  getSummaryPath,
  getSubagentDir,
  getSubagentTimelinePath,
  getSubagentSummaryPath,
  migrateFromYYMM,
} = require("./lib/cache-paths");
const { MODEL_PRICING, DEFAULT_PRICING, calcCost } = require("./lib/pricing");
const CACHE_VERSION = 7; // Bump when cache format changes
const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

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

/**
 * Resolve cache paths for a transcript file.
 * Main sessions:  {projectName}/{sessionId}/summary.json, timeline.csv
 * Agent sessions:  {projectName}/{mainSessionId}/subagents/{agentId}/summary.json, timeline.csv
 *
 * @param {string} filePath - transcript .jsonl path
 * @returns {{ summaryPath: string, timelinePath: string, sessionDir: string, isAgent: boolean, agentId: string|null, mainSessionId: string|null, projectName: string }}
 */
function resolveSessionPaths(filePath) {
  const projectName = extractProjectName(filePath) || "_unknown";
  const basename = path.basename(filePath, ".jsonl");

  // Agent transcript: .../{mainSessionId}/subagents/agent-{agentId}.jsonl
  if (filePath.includes("/subagents/")) {
    const parts = filePath.split("/subagents/");
    const mainSessionId = path.basename(parts[0]); // directory name = mainSessionId
    // basename is "agent-{agentId}" — strip "agent-" prefix
    const agentId = basename.startsWith("agent-") ? basename.slice(6) : basename;
    return {
      summaryPath: getSubagentSummaryPath(projectName, mainSessionId, agentId),
      timelinePath: getSubagentTimelinePath(projectName, mainSessionId, agentId),
      sessionDir: getSubagentDir(projectName, mainSessionId, agentId),
      isAgent: true,
      agentId,
      mainSessionId,
      projectName,
    };
  }

  // Main session transcript
  const sessionId = basename;
  return {
    summaryPath: getSummaryPath(projectName, sessionId),
    timelinePath: getTimelinePath(projectName, sessionId),
    sessionDir: getSessionDir(projectName, sessionId),
    isAgent: false,
    agentId: null,
    mainSessionId: null,
    projectName,
  };
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

function writeCache(summaryPath, timelinePath, data) {
  try {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.mkdirSync(path.dirname(timelinePath), { recursive: true });

    // Split: JSON metadata (without usageTimeline)
    const { usageTimeline, ...metadata } = data;
    metadata.cacheVersion = CACHE_VERSION;
    fs.writeFileSync(summaryPath, JSON.stringify(metadata));

    // CSV timeline
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
    fs.writeFileSync(timelinePath, lines.join("\n") + "\n");
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

  // Rate limit message patterns (prefix matching)
  const RATE_LIMIT_PATTERNS = [
    { prefix: "You've hit your" },
    { prefix: "You've used" },
    { prefix: "You're now using extra usage" },
    { prefix: "You're close to your extra usage" },
    { prefix: "You're out of extra usage" },
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

      // Detect rate_limit error on assistant messages
      if (obj.error === "rate_limit") {
        let msgText = "";
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) msgText += block.text;
          }
        }
        const rateLimitType = detectRateLimitType(msgText);
        const resetsAt = parseResetsAt(msgText, ts);
        rateLimitEvents.push({
          ts,
          message: msgText,
          rateLimitType,
          resetsAt,
        });
      }

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            for (const pat of RATE_LIMIT_PATTERNS) {
              if (block.text.startsWith(pat.prefix)) {
                const rateLimitType = detectRateLimitType(block.text);
                const resetsAt = parseResetsAt(block.text, ts);
                // Only push if not already captured via obj.error
                if (obj.error !== "rate_limit") {
                  rateLimitEvents.push({
                    ts,
                    message: block.text,
                    rateLimitType,
                    resetsAt,
                  });
                }
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

  // Initialize rl/evt fields on usage entries
  for (const e of usageTimeline) {
    e.win = null;
    e.rl = "";
    e.evt = "";
  }

  // Insert rate limit events into the timeline
  for (const rle of rateLimitEvents) {
    // Format: %5{1am@Asia/Seoul} or %% (no reset info)
    const rlValue = rle.resetsAt ? `${rle.rateLimitType}${rle.resetsAt}` : rle.rateLimitType;
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
      win: null,
      rl: rlValue,
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

  // Compute per-session 5h windows (simple: hourFloor + 5h)
  let currentWinStart = null;
  let currentWinEnd = null;
  for (const e of usageTimeline) {
    const ts = Math.floor(new Date(e.ts).getTime() / 1000);
    if (currentWinStart === null || ts >= currentWinEnd) {
      currentWinStart = hourFloor(ts);
      currentWinEnd = currentWinStart + 5 * 3600;
    }
    e.win = currentWinStart;
  }

  // Add cost/context events to evt column
  // Track current model for contextWindow lookup
  let curModel = null;
  for (const e of usageTimeline) {
    if (e.model && e.model !== "unknown" && e.model !== "") curModel = e.model;
    if (e.cost <= 0 && e.input <= 0) continue; // skip event-only rows

    const evts = e.evt ? [e.evt] : [];

    // Cost thresholds
    if (e.cost >= 1.0) {
      evts.push("cost_danger");
    } else if (e.cost >= 0.5) {
      evts.push("cost_warn");
    }

    // Context % thresholds
    if (curModel) {
      const rates = MODEL_PRICING[curModel];
      const contextWindow = rates ? rates.contextWindow : (DEFAULT_PRICING ? DEFAULT_PRICING.contextWindow : 200000);
      if (contextWindow > 0) {
        const contextTokens = e.input + e.cacheCreation + e.cacheRead;
        const contextPct = contextTokens / contextWindow;
        if (contextPct >= 0.70) {
          evts.push("ctx_danger");
        } else if (contextPct >= 0.35) {
          evts.push("ctx_warn");
        }
      }
    }

    e.evt = evts.join("|");
  }

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
  if (!message) return "limit_hit_unknown";
  const lower = message.toLowerCase();
  if (lower.includes("session limit")) return "limit_hit_5h";
  if (lower.includes("weekly limit")) return "limit_hit_weekly";
  if (lower.includes("opus limit")) return "limit_hit_opus";
  if (lower.includes("sonnet limit")) return "limit_hit_sonnet";
  if (lower.includes("you're out of extra usage")) return "limit_hit_extra";
  if (lower.includes("extra usage")) return "limit_hit_extra";
  return "limit_hit_unknown";
}

function parseResetsAt(message, eventTs) {
  if (!message || !eventTs) return null;
  const m = message.match(/·\s*resets\s+(\S+?)(?:\s+\(([^)]+)\))?(?:\s|$)/i);
  if (!m) return null;
  const timeStr = m[1]; // e.g. "1am", "10:30am"
  const tz = m[2]; // e.g. "Asia/Seoul" (optional)
  return tz ? `{${timeStr}@${tz}}` : `{${timeStr}}`;
}


function hourFloor(ts) {
  return ts - (ts % 3600);
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

  // Auto-migrate old YYMM cache structure (idempotent, runs once)
  migrateFromYYMM();

  const sessions = [];

  for (const file of files) {
    const paths = resolveSessionPaths(file.path);

    // Check cache
    if (!opts.force && isCacheValid(paths.summaryPath, file.mtime)) {
      const cached = readCache(paths.summaryPath);
      if (cached) {
        sessions.push(cached);
        continue;
      }
    }

    // Analyze and cache
    const result = await analyzeSession(file.path);

    // For agent sessions, read CC's meta.json if available
    if (paths.isAgent && paths.mainSessionId && paths.agentId) {
      const ccMetaPath = path.join(
        PROJECTS_DIR,
        paths.projectName,
        paths.mainSessionId,
        "subagents",
        `agent-${paths.agentId}.meta.json`,
      );
      try {
        if (fs.existsSync(ccMetaPath)) {
          const meta = JSON.parse(fs.readFileSync(ccMetaPath, "utf8"));
          if (meta.agentType) result.agentType = meta.agentType;
          if (meta.description) result.agentDescription = meta.description;
        }
      } catch (_) { /* ignore meta read errors */ }
    }

    writeCache(paths.summaryPath, paths.timelinePath, result);
    // Push metadata only (without usageTimeline)
    const { usageTimeline, ...metadata } = result;
    sessions.push(metadata);
  }

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
