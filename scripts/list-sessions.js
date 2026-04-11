#!/usr/bin/env node
/**
 * List JSONL transcript sessions, filtering to "main" sessions only.
 * A main session has at least 1 genuine user message (not subtask/meta).
 *
 * Usage: node list-sessions.js <transcripts-dir> [--limit N] [--offset N] [--exclude SESSION_ID]
 *
 * Default: latest 10 main sessions, sorted by mtime descending.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Tags to strip before checking user message content
const STRIP_PATTERNS = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<task-notification>[\s\S]*?<\/task-notification>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
];

// Subtask message prefixes to exclude
const SUBTASK_PREFIXES = [
  "Read the preprocessed transcript",
  "Read the file /tmp/preprocessed",
  "Read the file /tmp/continue-",
  "CRITICAL: Respond with TEXT ONLY",
  "Write the word",
];

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

function stripTags(text) {
  let cleaned = text;
  for (const pat of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pat, "");
  }
  return cleaned.trim();
}

function isGenuineUserMessage(text) {
  if (text.length === 0) return false;
  for (const prefix of SUBTASK_PREFIXES) {
    if (text.startsWith(prefix)) return false;
  }
  if (text.startsWith("[User ")) return false;
  return true;
}

function detectContextLoss(jsonlPath) {
  const content = fs.readFileSync(jsonlPath, "utf8");
  const events = { clear: false, compactManual: false, compactAuto: false };

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      // auto-compact: isCompactSummary flag on user message
      if (msg.message?.isCompactSummary === true) events.compactAuto = true;
      // compact_boundary system event (more reliable)
      if (msg.type === "system" && msg.subtype === "compact_boundary") {
        if (msg.compactMetadata?.trigger === "auto") events.compactAuto = true;
        if (msg.compactMetadata?.trigger === "manual") events.compactManual = true;
      }
      // /clear command
      if (
        msg.type === "user" &&
        typeof msg.message?.content === "string" &&
        /^\/clear\b/.test(msg.message.content)
      ) {
        events.clear = true;
      }
      // /compact manual command
      if (
        msg.type === "user" &&
        typeof msg.message?.content === "string" &&
        /^\/compact\b/.test(msg.message.content)
      ) {
        events.compactManual = true;
      }
    } catch (e) {}
  }

  return {
    hasContextLoss: events.clear || events.compactManual || events.compactAuto,
    events,
  };
}

function formatLocalTime(date) {
  const now = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `today ${hh}:${mm}`;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()} ${hh}:${mm}`;
}

function truncateMsg(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

async function analyzeSession(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const genuineMessages = [];
  let firstActiveTimestamp = null;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (obj.type !== "user") continue;
    if (obj.isMeta === true) continue;

    const content = obj.message?.content ?? obj.content;
    const raw = extractText(content);
    const stripped = stripTags(raw);

    if (isGenuineUserMessage(stripped)) {
      if (firstActiveTimestamp === null && obj.timestamp) {
        firstActiveTimestamp = obj.timestamp;
      }
      genuineMessages.push(stripped);
    }
  }

  return { genuineMessages, firstActiveTimestamp };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let dir = null;
  let limit = 10;
  let offset = 0;
  let exclude = null;
  let all = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10) || 10;
      i++;
    } else if (args[i] === "--offset" && i + 1 < args.length) {
      offset = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (args[i] === "--exclude" && i + 1 < args.length) {
      exclude = args[i + 1];
      i++;
    } else if (args[i] === "--all") {
      all = true;
    } else if (!args[i].startsWith("--")) {
      dir = args[i];
    }
  }

  return { dir, limit, offset, exclude, all };
}

async function main() {
  const { dir, limit, offset, exclude, all } = parseArgs(process.argv);

  if (!dir) {
    process.stderr.write(
      "Usage: node list-sessions.js <transcripts-dir> [--limit N] [--offset N] [--exclude SESSION_ID] [--all]\n",
    );
    process.exit(1);
  }

  if (!fs.existsSync(dir)) {
    process.stderr.write(`Error: directory not found: ${dir}\n`);
    process.exit(1);
  }

  // List .jsonl files with stat info
  const entries = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      return { name: f, path: fullPath, mtime: stat.mtime, size: stat.size };
    })
    .sort((a, b) => b.mtime - a.mtime);

  // Collect all main sessions first
  const mainSessions = [];

  for (const entry of entries) {
    const id = path.basename(entry.name, ".jsonl");

    // Filter out excluded session
    if (exclude && id === exclude) continue;

    const { genuineMessages, firstActiveTimestamp } = await analyzeSession(
      entry.path,
    );
    const isMain = genuineMessages.length >= 1;

    if (!all && !isMain) continue;

    let firstActive = null;
    if (firstActiveTimestamp) {
      firstActive = formatLocalTime(new Date(firstActiveTimestamp));
    }

    const { hasContextLoss, events: contextLossEvents } = detectContextLoss(
      entry.path,
    );

    mainSessions.push({
      id,
      path: entry.path,
      firstActive,
      lastActive: formatLocalTime(entry.mtime),
      size: entry.size,
      firstMsg: genuineMessages.length > 0 ? truncateMsg(genuineMessages[0], 100) : "",
      lastMsg: genuineMessages.length > 0 ? truncateMsg(genuineMessages[genuineMessages.length - 1], 100) : "",
      userMsgCount: genuineMessages.length,
      isMain,
      hasContextLoss,
      contextLossEvents,
    });
  }

  // Apply offset, then limit
  const results = mainSessions.slice(offset, offset + limit);

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
