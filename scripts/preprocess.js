#!/usr/bin/env node
/**
 * Transcript preprocessor for /continue skill.
 * Reads JSONL transcript, outputs truncated text to stdout.
 *
 * Usage: node preprocess.js <transcript.jsonl>
 *
 * Aggressive filtering: boilerplate, system tags, short confirmations, consecutive tools merged.
 * Truncation: user/assistant HEAD+TAIL (default 200+100).
 *
 * Usage: node preprocess.js <transcript.jsonl> [HEAD] [TAIL]
 *   HEAD  Max chars from start of each message (default: 200)
 *   TAIL  Max chars from end of each message (default: 100)
 *
 * Input:
 *   ~/.claude/projects/{PROJECT_HASH}/{SESSION_ID}.jsonl   (CC transcript file)
 *
 * Output (stdout):
 *   Compact text transcript with [L{n}] line references and markers.
 *   First line: "# {lines} lines, {bytes} bytes" (meta header for chunked reading)
 *
 * Cache (managed by /continue skill, not by this script):
 *   ~/.claude/cc-token-saver-data/{projectName}/{sessionId}/compact.txt              (default truncation)
 *   ~/.claude/cc-token-saver-data/{projectName}/{sessionId}/compact.aggressive.txt   (50/20 truncation)
 *
 * Marker Reference (v2.0)
 * ─────────────────────────────────────────────
 * Generated here (preprocess.js), parsed in build-report.js (ALERT_LINE_RE),
 * rendered in template.html (showWindowDetail).
 *
 * Line format:
 *   [L{n} User MM-DDThh:mm:ss]{markers} {text}
 *   [L{n} Assistant MM-DDThh:mm:ss] {text}
 *   [Tools: {tool1}, {tool2}, ...]
 *
 * Regex (build-report.js ALERT_LINE_RE):
 *   /^\[L(\d+) User ((?:\d{2}-\d{2}T)?\d+:\d+(?::\d+)?)\]([^\s]*)\s*(.*)/
 *
 * Session markers (position: after [L# User HH:MM:SS], can accumulate e.g. @@! for /clear + /model)
 *   @   New session start (first non-meta user message)
 *   @@  /clear restart
 *   +   /resume slash command
 *   ++  /compact or auto-compact (system:compact_boundary)
 *   ~   /reload-plugins (system prompt change)
 *   !   /model change (cache invalidation)
 *   ?   --continue/--resume heuristic (cc>=10K, cc>=input*2, <1h gap, no session marker)
 *   ^   /continue skill (single session restore)
 *   ^^  /continue skill (multi-session restore)
 *
 * Cost markers (retroactive, on previous user line)
 *   *   Cost ≥ $0.50
 *   **  Cost ≥ $1.00
 *
 * Context markers
 *   #   Context window ≥ 35%
 *   ##  Context window ≥ 70%
 *
 * Rate limit markers (from obj.error === "rate_limit" assistant messages; also flush pending session markers)
 *   %%              Unknown/generic rate limit ("You've hit your limit")
 *   %5              5-hour session limit ("You've hit your session limit")
 *   %W              Weekly limit ("You've hit your weekly limit")
 *   %O              Opus limit ("You've hit your Opus limit")
 *   %S              Sonnet limit ("You've hit your Sonnet limit")
 *   %X              Extra usage exhausted ("You're out of extra usage")
 *   {time@timezone}  Optional reset info appended (e.g. %5{1am@Asia/Seoul})
 *
 * Marker order: @ * # + ~ ! ? ^ % (session markers accumulate until flushed by user line or rate limit)
 * ─────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Load model pricing for cost-based user message markers
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
  if (!MODEL_PRICING[model] && model && model !== 'unknown' && model !== '<synthetic>' && !_unknownModels.has(model)) {
    _unknownModels.add(model);
    process.stderr.write(`⚠️  Unknown model "${model}" — using default pricing. Add it to ${path.join(__dirname, 'model-pricing.json')} then re-run with --force\n`);
  }
  const rates = MODEL_PRICING[model] || DEFAULT_PRICING;
  return (
    (input * rates.input +
      cc5m * rates.cacheCreate5m +
      cc1h * rates.cacheCreate1h +
      cacheRead * rates.cacheRead +
      output * rates.output) /
    1_000_000
  );
}

function ctxMarker(totalContextTokens, model) {
  const modelInfo = MODEL_PRICING[model];
  const ctxWindow = modelInfo ? modelInfo.contextWindow : (DEFAULT_PRICING.contextWindow || 200000);
  const pct = totalContextTokens / ctxWindow;
  if (pct >= 0.70) return "##";
  if (pct >= 0.35) return "#";
  return "";
}

function costMarker(cost) {
  if (cost >= 1.0) return "**";
  if (cost >= 0.5) return "*";
  return "";
}

// Accept optional HEAD/TAIL from CLI args: node preprocess.js <file> [HEAD] [TAIL]
const USER_HEAD = parseInt(process.argv[3]) || 200;
const USER_TAIL = parseInt(process.argv[4]) || 100;
const ASST_HEAD = USER_HEAD,
  ASST_TAIL = USER_TAIL;

// Strip these patterns from all text before processing
const STRIP_PATTERNS = [
  // bkit feature usage blocks (any variation, including inside code fences)
  /─{3,}[\s\S]*?bkit Feature Usage[\s\S]*?─{3,}/g,
  /✅ Used:.*$/gm,
  /⏭️? Not Used:.*$/gm,
  /💡 Recommended:.*$/gm,
  // Insight blocks (all variations: backtick, plain, or partial)
  /[`]?★ Insight[^\n]*[\s\S]*?─{3,}[`]?/g,
  /★ Insight\s*\n/g,
  // local-command-caveat blocks
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  // command-name/message/args/stdout tags
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  // system-reminder blocks
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  // task-notification blocks
  /<task-notification>[\s\S]*?<\/task-notification>/g,
  // markdown code fences with file trees (repeated project structure dumps)
  /```\n[\s\S]*?├[\s\S]*?```/g,
  // stray code fence blocks containing only bkit usage remnants
  /```\s*\n\s*```/g,
];

// (Removed: SKIP_PATTERNS for short assistant messages — even "Done" carries
//  completion-state context needed by AI analysis and /continue restoration)

// Skip user messages that are just local commands
const SKIP_USER_PATTERNS = [/^\s*$/, /^<local-command/, /^Base directory for this skill:/];

function truncate(text, head, tail) {
  if (text.length <= head + tail) return text;
  const omitted = text.length - head - tail;
  return `${text.slice(0, head)} [...${omitted} chars omitted...] ${text.slice(-tail)}`;
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function cleanText(text) {
  let cleaned = text;
  for (const pat of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pat, "");
  }
  // Collapse multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

function shouldSkipAsst() {
  return false;
}

function shouldSkipUser(text) {
  return SKIP_USER_PATTERNS.some((pat) => pat.test(text.trim()));
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write("Usage: node preprocess.js <transcript.jsonl>\n");
    process.exit(1);
  }

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const output = [];
  let pendingTools = [];
  let lineNum = 0;
  let lastUserIdx = -1; // index into output[] of last user message line
  const _seenReqIds = new Set();
  let prevCtxLevel = 0; // track CTX threshold crossings: 0=normal, 1=#, 2=##
  let pendingSessionMarker = ""; // session markers — applied to next user message
  function addSessionMarker(mark) {
    if (!pendingSessionMarker.includes(mark)) {
      // Prevent "+++" when "+" exists and "++" is added: replace "+" with "++"
      if (mark === "++" && pendingSessionMarker.includes("+")) {
        pendingSessionMarker = pendingSessionMarker.replace("+", "++");
      } else {
        pendingSessionMarker += mark;
      }
    }
  }
  let isFirstUserMessage = true; // track first non-meta user message for @ marker
  let lastAssistantTs = 0; // epoch seconds of last assistant response (for ? heuristic)
  let inContinueSkill = false; // track /continue skill execution for compact file detection
  const continueCompactFiles = new Set();
  let pendingContinueMark = ""; // ^ or ^^ — applied separately to maintain regex order
  // Rate limit markers are applied immediately (not deferred) since they are
  // independent blocking events with no usage data. See rate limit detection below.
  function flushContinueMarker() {
    if (inContinueSkill) {
      // ^ for single session restore, ^^ for multi-session
      pendingContinueMark = continueCompactFiles.size > 1 ? "^^" : "^";
      continueCompactFiles.clear();
    }
    inContinueSkill = false;
  }
  function flushTools() {
    if (pendingTools.length === 0) return;
    output.push(`[Tools: ${pendingTools.join(", ")}]`);
    pendingTools = [];
  }

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const type = obj.type;
    const content = obj.message?.content ?? obj.content;
    const ts = obj.timestamp || obj.message?.timestamp || "";
    const tsTag = ts ? ts.slice(5, 19) : "";
    const loc = `L${lineNum}`;

    // Detect compact events (auto or manual)
    if (type === "system" && obj.subtype === "compact_boundary") {
      addSessionMarker("++");
      continue;
    }

    if (type === "user") {
      // Detect cache-affecting slash commands from ANY user message (meta or not)
      const rawForCmd = extractText(content);
      const cmdMatch = rawForCmd.match(/<command-name>\/([\w-]+)<\/command-name>/);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        if (cmd === "clear") addSessionMarker("@@");
        else if (cmd === "resume") addSessionMarker("+");
        else if (cmd === "reload-plugins") addSessionMarker("~");
        else if (cmd === "model") addSessionMarker("!");
      }
      // Detect /continue skill invocation (uses <command-message> tag, not <command-name>)
      if (rawForCmd.includes("<command-message>cc-token-saver:continue</command-message>")) {
        inContinueSkill = true;
      } else if (inContinueSkill && !obj.isMeta) {
        flushContinueMarker();
      }

      if (obj.isMeta) {
        continue;
      }

      flushTools();
      const raw = extractText(content);
      const text = cleanText(raw);
      if (text && !shouldSkipUser(text)) {
        // Session markers are NOT applied here — they are applied retroactively
        // when the assistant responds with usage data (= real API call).
        // This prevents markers from being wasted on dead-end user messages
        // that never get an API response (e.g., failed skill invocations).
        output.push(
          `[${loc} User${tsTag ? " " + tsTag : ""}] ${truncate(text, USER_HEAD, USER_TAIL)}`,
        );
        lastUserIdx = output.length - 1;
      }
    } else if (type === "assistant") {
      // Detect rate limit synthetic messages (obj.error === "rate_limit")
      if (obj.error === "rate_limit") {
        const rlText = extractText(obj.message?.content ?? obj.content ?? "");
        let rlType = "%%"; // fallback unknown
        if (/session limit/i.test(rlText)) rlType = "%5";
        else if (/weekly limit/i.test(rlText)) rlType = "%W";
        else if (/Opus limit/i.test(rlText)) rlType = "%O";
        else if (/Sonnet limit/i.test(rlText)) rlType = "%S";
        else if (/You're out of extra usage/i.test(rlText)) rlType = "%X";
        else if (/limit/i.test(rlText)) rlType = "%%";

        // Extract optional reset time: "· resets {time} ({timezone})" or "· resets {time}"
        const resetMatch = rlText.match(/·\s*resets\s+(\S+?)(?:\s+\(([^)]+)\))?(?:\s|$)/i);
        if (resetMatch) {
          const resetTime = resetMatch[1];
          const resetTz = resetMatch[2];
          rlType += resetTz ? `{${resetTime}@${resetTz}}` : `{${resetTime}}`;
        }
        // Apply immediately to the user message that triggered this rate limit.
        // Unlike cost markers (deferred until usage data arrives), rate limit is a
        // blocking event with no usage data — must apply now before lastUserIdx moves.
        if (lastUserIdx >= 0) {
          let sMark = pendingSessionMarker;
          if (isFirstUserMessage && !sMark) sMark = "@";
          if (sMark) { pendingSessionMarker = ""; isFirstUserMessage = false; }
          output[lastUserIdx] = output[lastUserIdx].replace(
            /^(\[L\d+ User[^\]]*\])/,
            `$1${sMark}${rlType}`,
          );
        }
        continue; // skip normal assistant processing for synthetic rate limit messages
      }

      // Calculate cost from usage data and retroactively mark the previous user message
      const usage = obj.usage || (obj.message && obj.message.usage);
      const reqId = obj.requestId || (obj.message && obj.message.id) || null;
      if (usage && lastUserIdx >= 0 && (!reqId || !_seenReqIds.has(reqId))) {
        if (reqId) _seenReqIds.add(reqId);
        const inp = usage.input_tokens || 0;
        const ccTotal = usage.cache_creation_input_tokens || 0;
        const cr = usage.cache_read_input_tokens || 0;
        const out = usage.output_tokens || 0;
        const cacheDetail = usage.cache_creation || {};
        const cc5m = cacheDetail.ephemeral_5m_input_tokens || 0;
        const cc1h = cacheDetail.ephemeral_1h_input_tokens || 0;
        const cc5mFinal = cc5m || 0;
        const cc1hFinal = cc1h || (cc5m ? 0 : ccTotal);
        const model =
          (obj.message && obj.message.model) || obj.model || "";
        const cost = calcCost(inp, cc5mFinal, cc1hFinal, cr, out, model);
        const currentTs = ts ? new Date(ts).getTime() / 1000 : 0;

        // ── Build all markers at once, then apply in one replace ──
        // Session marker: @ (startup), @@ (clear), + (resume), ++ (compact), ~ (reload), ! (model)
        let sMark = pendingSessionMarker;
        if (isFirstUserMessage && !sMark) sMark = "@";
        if (sMark) {
          pendingSessionMarker = "";
          isFirstUserMessage = false;
        }

        // Cost marker: * (≥$0.50) or ** (≥$1.00)
        const cMark = costMarker(cost);
        // CTX marker: # (≥35%) or ## (≥70%) — only on first crossing
        const xMark = ctxMarker(inp + ccTotal + cr, model);
        const xMarkLevel = xMark.length;
        const xMarkApply = xMarkLevel > prevCtxLevel ? xMark : "";
        if (xMarkLevel > prevCtxLevel) prevCtxLevel = xMarkLevel;

        // ? heuristic: large cache creation, no session marker, <1h gap → likely --continue/--resume
        let hMark = "";
        if (
          !sMark &&
          ccTotal >= 10000 &&
          ccTotal >= inp * 2 &&
          lastAssistantTs > 0 &&
          currentTs > 0 &&
          (currentTs - lastAssistantTs) < 3600
        ) {
          hMark = "?";
        }

        // Apply all markers in one shot: order must match ALERT_LINE_RE: @ * # + ~ ! ? ^ %
        const contMark = pendingContinueMark;
        if (contMark) pendingContinueMark = "";
        const allMarks = sMark + cMark + xMarkApply + hMark + contMark;
        if (allMarks) {
          output[lastUserIdx] = output[lastUserIdx].replace(
            /^(\[L\d+ User[^\]]*\])/,
            `$1${allMarks}`,
          );
        }

        if (currentTs > 0) lastAssistantTs = currentTs;
      }
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            flushTools();
            const cleaned = cleanText(block.text);
            if (cleaned && !shouldSkipAsst(cleaned)) {
              output.push(
                `[${loc} Assistant${tsTag ? " " + tsTag : ""}] ${truncate(cleaned, ASST_HEAD, ASST_TAIL)}`,
              );
            }
          } else if (block.type === "tool_use" && block.name) {
            pendingTools.push(block.name);
            // Track compact file reads during /continue skill
            if (inContinueSkill && block.name === "Read" && block.input && block.input.file_path) {
              const fp = block.input.file_path;
              // New structure: {projectName}/{sessionId}/compact.txt
              const mNew = fp.match(/\/([0-9a-f-]+)\/compact(?:\.aggressive)?\.txt$/);
              // Old structure: compact-{sessionId}.txt
              const mOld = fp.match(/compact-([0-9a-f-]+)\.(?:aggressive\.)?txt$/);
              const m = mNew || mOld;
              if (m) continueCompactFiles.add(m[1]);
            }
          }
        }
      } else if (typeof content === "string" && content) {
        flushTools();
        const cleaned = cleanText(content);
        if (cleaned && !shouldSkipAsst(cleaned)) {
          output.push(
            `[${loc} Assistant${tsTag ? " " + tsTag : ""}] ${truncate(cleaned, ASST_HEAD, ASST_TAIL)}`,
          );
        }
      }
    }
  }

  flushTools();
  flushContinueMarker();
  // Apply any remaining continue mark to the last user line
  if (pendingContinueMark && lastUserIdx >= 0) {
    output[lastUserIdx] = output[lastUserIdx].replace(
      /^(\[L\d+ User[^\]]*\])/,
      `$1${pendingContinueMark}`,
    );
    pendingContinueMark = "";
  }
  // Note: rate limit markers are applied immediately when detected (no pending cleanup needed)

  // Post-process: merge consecutive [Tools:] lines
  const merged = [];
  for (const line of output) {
    if (
      line.startsWith("[Tools: ") &&
      merged.length > 0 &&
      merged[merged.length - 1].startsWith("[Tools: ")
    ) {
      const prevTools = merged[merged.length - 1].slice(8, -1);
      const curTools = line.slice(8, -1);
      merged[merged.length - 1] = `[Tools: ${prevTools}, ${curTools}]`;
    } else {
      merged.push(line);
    }
  }

  const body = merged.join("\n") + "\n";
  const lines = merged.length;
  const bytes = Buffer.byteLength(body, "utf8");
  process.stdout.write(`# ${lines} lines, ${bytes} bytes\n${body}`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
