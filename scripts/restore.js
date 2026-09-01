#!/usr/bin/env node
/**
 * restore.js — turn one transcript into the restore text, at a chosen level.
 *
 * This is the single implementation of the level slicing. Both callers use it:
 * the s-continue skill, and the after-compact hook that runs unattended. The
 * slicing used to live as an inline Python block inside SKILL.md, which meant
 * the hook could not call it — only copy it — and a copy is exactly how the
 * after-compact hook once derived a cache path nothing wrote and died quietly
 * for months.
 *
 * Levels differ in how much of each turn is read and how far back they reach.
 * No reply is ever dropped at any level: the middle of a long turn is shortened
 * to 50 characters, and the `-> N AI responses at lines X-Y` pointer above each
 * turn still locates the originals in the transcript.
 *
 *   1  headline  last 30 user turns, replies at 100/50 chars
 *   2  recent    same 30 turns, full stored width at each end
 *   3  full      every turn
 *
 * Usage:
 *   node restore.js <transcript.jsonl> [--level 1|2|3] [--before-boundary]
 *                   [--original <rollout>] [--out <file>]
 *
 * --before-boundary cuts everything from the last compaction onward. That is
 * what an after-compact caller wants: the turns after the boundary are the ones
 * still in the model's context, and the turns before it are the ones that were
 * dropped. Without it the whole session is rendered.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { deriveCachePath } = require("./preprocess.js");
const codex = require("./lib/codex-transcript.js");

/** Replies kept at full width at each end of one user turn. */
const EDGE_BY_LEVEL = { 1: 6, 2: 12 };
const EDGE_DEFAULT = 24;
/** Width a reply in the middle of a turn is shortened to. */
const MID = 50;
/** User turns a bounded level reaches back over. */
const TURN_WINDOW = 30;

/**
 * A compaction boundary as preprocess.js writes it: a System turn whose whole
 * body is the marker. Both spellings appear — auto-compact fires on its own, a
 * person types /compact.
 *
 * It is anchored to the header line and to the System role on purpose. Matching
 * the marker anywhere in a block finds every turn that merely TALKS about
 * compaction, and a session about this feature is full of them — measured, the
 * unanchored form picked a user message as the last boundary and cut away
 * nothing.
 */
const BOUNDARY = /^\[Session:[^\]]*\][^ ]* System: "\[(auto|manual)-compact boundary\]"\s*$/;

const REPLY = /^(\d+)\. "/;
const HEADER = "[Session:";

/** One block is a header line plus everything under it until the next header. */
function splitBlocks(text) {
  const blocks = [];
  let cur = [];
  for (const line of text.split("\n")) {
    if (line.startsWith(HEADER) && cur.length > 0) {
      blocks.push(cur.join("\n"));
      cur = [];
    }
    cur.push(line);
  }
  if (cur.length > 0) blocks.push(cur.join("\n"));
  return blocks;
}

function firstLine(block) {
  const i = block.indexOf("\n");
  return i === -1 ? block : block.slice(0, i);
}

function isUser(block) {
  return block.length > 0 && firstLine(block).includes('User: "');
}

/** Keep the head and tail of a long value, with the middle elided. */
function cut(s, head, tail) {
  const t = s.trim();
  if (t.length <= head + tail) return t;
  return t.slice(0, head).trimEnd() + " … " + t.slice(t.length - tail).trimStart();
}

/**
 * The number and the readable body of one reply line, with the preprocessor's
 * own truncation marker and trailing bracketed annotations removed — those are
 * bookkeeping, not something a reader needs inside a shortened line.
 */
function bodyOf(line) {
  const m = line.match(/^(\d+)\. "(.*)$/);
  if (!m) return null;
  let rest = m[2].split("[...truncated...]")[0];
  rest = rest.replace(/(\s*\[[^\]]*\])+\s*$/, "").trimEnd().replace(/"$/, "");
  return { num: m[1], body: rest.trim() };
}

/**
 * Everything before the last compaction boundary.
 *
 * The LAST one, not the first: a long session compacts repeatedly, and only the
 * most recent boundary separates "gone from context" from "still in context".
 */
function beforeLastBoundary(blocks) {
  let lastBoundary = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (BOUNDARY.test(firstLine(blocks[i]))) lastBoundary = i;
  }
  return lastBoundary === -1 ? blocks : blocks.slice(0, lastBoundary);
}

/** Which blocks a level reads, before any per-reply shortening. */
function selectBlocks(blocks, level) {
  if (level === 3) return blocks;
  if (level === 1) return blocks.filter(isUser).slice(-TURN_WINDOW);

  const userIdx = [];
  for (let i = 0; i < blocks.length; i++) if (isUser(blocks[i])) userIdx.push(i);
  return userIdx.length > TURN_WINDOW ? blocks.slice(userIdx[userIdx.length - TURN_WINDOW]) : blocks;
}

/**
 * One block, rendered at the given level.
 *
 * Every level caps replies per turn, level 3 included. Without that cap a
 * single user turn is unbounded — during an autonomous run the assistant
 * answers dozens of times under one message, and level 1 could come out larger
 * than level 3.
 */
function renderBlock(block, level, edge) {
  const out = [];
  const lines = block.split("\n");

  if (level === 1) {
    const head = lines[0];
    const at = head.indexOf('User: "');
    if (at === -1) {
      out.push(head);
    } else {
      const pre = head.slice(0, at);
      const msg = head.slice(at + 'User: "'.length).replace(/"$/, "");
      out.push(`${pre}User: "${cut(msg, 150, 100)}"`);
    }
  } else {
    out.push(lines[0]);
  }

  const replies = [];
  let pointer = null;
  const others = [];
  for (const line of lines.slice(1)) {
    if (REPLY.test(line)) replies.push(line);
    else if (line.startsWith("->")) pointer = line;
    // The trailing "# Session references:" footer lands here. On a Codex
    // session it names the original rollout — the only line saying which file
    // an L{n} marker addresses — so it is never dropped.
    else if (line.trim() !== "") others.push(line);
  }

  if (pointer) out.push(pointer);
  replies.forEach((line, i) => {
    const atEdge = i < edge || i >= replies.length - edge;
    if (atEdge && level > 1) {
      out.push(line);
      return;
    }
    const parsed = bodyOf(line);
    if (!parsed) {
      out.push(line);
      return;
    }
    out.push(`${parsed.num}. "${parsed.body.slice(0, atEdge ? 100 : MID)}"`);
  });

  return out.concat(others).join("\n");
}

/** The restore text for one already-preprocessed compact file. */
function render(text, { level, beforeBoundary }) {
  let blocks = splitBlocks(text);
  if (beforeBoundary) blocks = beforeLastBoundary(blocks);

  // Anything before the first header is the "# compact-format:" preamble, not
  // a turn. It survives every level.
  let preamble = "";
  if (blocks.length > 0 && !isUser(blocks[0]) && !blocks[0].startsWith(HEADER)) {
    preamble = blocks.shift();
  }

  const edge = EDGE_BY_LEVEL[level] ?? EDGE_DEFAULT;
  const rendered = selectBlocks(blocks, level).map((b) => renderBlock(b, level, edge));
  const head = preamble.trim() === "" ? "" : preamble.replace(/\n+$/, "") + "\n";
  return head + rendered.join("\n") + "\n";
}

/**
 * The file to parse, and the file its L{n} markers address.
 *
 * A Codex rollout is not in the shape the preprocessor reads, so it is
 * normalized to a copy first — but the line numbers stay the ORIGINAL's,
 * because that is the file a reader opens. `readSessionMeta` returning null is
 * the test for "this is not a Codex rollout": it parses the first line and
 * looks for a session_meta row, so it cannot mistake a Claude Code transcript
 * for one.
 */
function resolveSource(transcriptPath) {
  let meta = null;
  try {
    meta = codex.readSessionMeta(transcriptPath);
  } catch {
    meta = null;
  }
  if (!meta) return { parsePath: transcriptPath, originalPath: null };
  return {
    parsePath: codex.normalizeCodexTranscript(transcriptPath, meta),
    originalPath: transcriptPath,
  };
}

/** Refresh the compact cache for this transcript, and return its path. */
function ensureCache(transcriptPath, originalOverride) {
  const { parsePath, originalPath } = resolveSource(transcriptPath);
  const original = originalOverride || originalPath;

  const args = [path.join(__dirname, "preprocess.js"), parsePath];
  if (original) args.push("--original", original);
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (run.status !== 0) {
    throw new Error(`preprocess failed: ${(run.stderr || "").trim() || `exit ${run.status}`}`);
  }
  return deriveCachePath(path.resolve(parsePath)).cachePath;
}

/** Flags that take a value, so the value is never mistaken for the transcript. */
const VALUED = new Set(["--level", "--original", "--out"]);

function parseArgs(argv) {
  const opts = { transcript: null, level: 3, beforeBoundary: false, original: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUED.has(arg)) {
      const value = argv[++i];
      if (arg === "--level") {
        const n = Number(value);
        opts.level = [1, 2, 3].includes(n) ? n : 3;
      } else if (arg === "--original") opts.original = value;
      else opts.out = value;
    } else if (arg === "--before-boundary") {
      opts.beforeBoundary = true;
    } else if (!arg.startsWith("--") && opts.transcript === null) {
      opts.transcript = arg;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.transcript) {
    process.stderr.write(
      "Usage: node restore.js <transcript.jsonl> [--level 1|2|3] [--before-boundary] [--original <path>] [--out <file>]\n",
    );
    process.exit(1);
  }
  const abs = path.resolve(opts.transcript);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`Error: file not found: ${abs}\n`);
    process.exit(1);
  }

  const cachePath = ensureCache(abs, opts.original);
  const text = fs.readFileSync(cachePath, "utf8");
  const out = render(text, { level: opts.level, beforeBoundary: opts.beforeBoundary });

  // An empty render is a failure, not a result. A caller that prints it would
  // announce a restore that carried nothing.
  if (out.trim() === "") {
    process.stderr.write("restore.js: nothing to restore (no turns before the boundary)\n");
    process.exit(2);
  }

  if (opts.out) fs.writeFileSync(opts.out, out);
  else process.stdout.write(out);
}

module.exports = { render, splitBlocks, beforeLastBoundary, cut, bodyOf };

if (require.main === module) main();
