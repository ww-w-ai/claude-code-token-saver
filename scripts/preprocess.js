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
 * Marker Reference (v1.4.0 — user-side only after compact-timeline-separation)
 * ─────────────────────────────────────────────
 * Generated here (preprocess.js), parsed in build-report.js.
 * Only USER-SIDE markers live in compact.txt. Cost/ctx/heuristic/rate-limit
 * markers are owned by analyze-usage.js → timeline.csv (see analyze-usage.js).
 *
 * Line format:
 *   [L{n} User MM-DDThh:mm:ss]{markers} {text}
 *   [L{n} Assistant MM-DDThh:mm:ss] {text}
 *   [Tools: {tool1}, {tool2}, ...]
 *
 * User-side markers (this file):
 *   @   New session start (first non-meta user message)
 *   @@  /clear restart
 *   +   Manual /compact (user-invoked; from <command-name>/compact</command-name> tag OR compact_boundary trigger=manual)
 *   ++  Auto-compact (system:compact_boundary trigger=auto; fired by context pressure)
 *   ~   /reload-plugins (system prompt change)
 *   !   /model change (cache invalidation)
 *   ^   /continue skill (single session restore)
 *   ^^  /continue skill (multi-session restore)
 *
 * Not here anymore (moved to analyze-usage.js → timeline.csv markers column):
 *   * **     cost bands
 *   # ##     context bands
 *   ?        --continue/--resume heuristic
 *   %5/%%/%W/%O/%S/%X  rate-limit markers
 *
 * Why moved: the previous accumulate-on-same-user-line logic produced literal
 * `****` artefacts on tool-heavy turns where multiple assistant API calls share
 * one user prompt. Now build-report.js joins compact.txt (user events) with
 * timeline.csv (per-call cost data) by JSONL line number and aggregates per
 * user turn.
 *
 * Note: /resume is NOT detected directly — CC's resume command uses display:'skip'
 *   and writes no transcript entry. The ? heuristic (now in analyze-usage.js)
 *   catches most --continue/--resume invocations retroactively.
 *
 * Marker assembly: sMark (from @ @@ + ++ ~ !) + contMark (from ^ ^^)
 * ─────────────────────────────────────────────
 */

const fs = require("fs");
const readline = require("readline");

// Compact.txt format version. Bump when the marker schema changes so
// build-report.js can detect stale caches and regenerate.
// v1: legacy — cost/ctx/?/% markers mixed on user lines (pre-v1.4.0)
// v2: user-side markers only (@ @@ + ++ ~ ! ^ ^^); see header doc above
// v3: signal-weighted truncation (smartTruncate, code block index, last-10 boost)
const COMPACT_FORMAT_VERSION = 3;

// Last-N turns to boost with higher HEAD/TAIL
const LAST_TURN_BOOST_COUNT = 10;

// Emoji set for attention signal scanning (20 emoji, v1.4.0 — ✅ removed)
const ATTENTION_EMOJIS = "❌🔴⚠🚨🔥🎯🐛🔧💡💥🎉🏆🚀🧪🤖💸💰📈📉📌🟡";

// Keyword set for attention signal scanning
const ATTENTION_KEYWORDS = /\b(root\s*cause|TL;DR|breakthrough|bug\s+found|wrong|CRITICAL|CONFIRMED|FATAL|fixed|verified|finding)\b/gi;

// Patterns for smartTruncate atom detection in the middle window
const SMART_PATTERNS = [
  /https?:\/\/[^\s`"')<>]+/g,
  /`[^`\n]{3,150}`/g,
  new RegExp("^.{0,200}[" + ATTENTION_EMOJIS + "].{0,200}(?:\\n|$)", "gmu"),
  /^.{0,200}\b(?:root\s*cause|TL;DR|breakthrough|bug\s+found|wrong|CRITICAL|CONFIRMED|FATAL|fixed|verified|finding)\b.{0,200}(?:\n|$)/gmi,
];

// Note: cost/ctx markers are now computed in analyze-usage.js and written to
// timeline.csv. This file only emits user-side session markers; no pricing lookup needed.

// Accept optional HEAD/TAIL from CLI args: node preprocess.js <file> [HEAD] [TAIL]
// v1.4.0 defaults: 300/200 (default mode), 100/100 (aggressive mode).
const USER_HEAD = parseInt(process.argv[3]) || 300;
const USER_TAIL = parseInt(process.argv[4]) || 200;

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

function formatBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

// Extract a name for a table/list block by scanning preceding text.
function sanitizeName(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\n\r\t]/g, " ")
    .replace(/[|"\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50)
    .trim();
  return cleaned || null;
}

function extractName(content, blockStart) {
  const prefix = content.slice(Math.max(0, blockStart - 500), blockStart);
  const lines = prefix.split("\n").filter((l) => l.trim());
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    const line = lines[i].trim();
    const h = line.match(/^#{1,4}\s+(.{3,60})/);
    if (h) return sanitizeName(h[1]);
    const c = line.match(/^(.{5,60}):\s*$/);
    if (c) return sanitizeName(c[1]);
    const b = line.match(/^\*\*([^*]{5,60})\*\*/);
    if (b) return sanitizeName(b[1]);
    if (line.length > 20) break;
  }
  return null;
}

// Replace fenced code blocks with [C{n} | NL | NB] tags. Short blocks masked
// with a sentinel placeholder so subsequent table/list/TOC extraction cannot
// treat their contents as prose. Call restoreKeptCodeBlocks() after all
// extraction passes (and BEFORE smartTruncate) to restore the originals.
function extractCodeBlocks(text, codeIndex, lineRef, keptBlocks) {
  return text.replace(/```[^\n]*\n([\s\S]*?)```/g, (full, body) => {
    const lines = body.split("\n").length;
    const bytes = Buffer.byteLength(full, "utf8");
    if (lines <= 5 || bytes <= 200) {
      const idx = keptBlocks.length;
      keptBlocks.push(full);
      return `\x00KEPT_CODE_${idx}\x00`;
    }
    const n = codeIndex.length + 1;
    codeIndex.push({ n, lineRef, lines, bytes });
    return `[C${n} | ${lines}L | ${formatBytes(bytes)}]`;
  });
}

// Restore sentinel placeholders emitted by extractCodeBlocks with their
// original short code blocks.
function restoreKeptCodeBlocks(text, keptBlocks) {
  return text.replace(/\x00KEPT_CODE_(\d+)\x00/g, (_, idx) => keptBlocks[parseInt(idx, 10)] || "");
}

// Replace markdown tables with [T{n} | NR | "name"] tags.
function extractTables(text, tableIndex, lineRef) {
  const re = /(?:^\|[^\n]+\|\n\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|\n(?:\|[^\n]+\|\n?)*)/gm;
  return text.replace(re, (match, offset) => {
    const rows = match.split("\n").filter((l) => l.trim().startsWith("|")).length;
    const dataRows = Math.max(0, rows - 2); // subtract header + separator
    const name = extractName(text, offset);
    const n = tableIndex.length + 1;
    tableIndex.push({ n, lineRef, rows: dataRows, name });
    return name ? `[T${n} | ${dataRows}R | "${name}"]` : `[T${n} | ${dataRows}R | ]`;
  });
}

// Replace markdown lists (≥3 items) with [B{n} | N# | "name"] tags.
function extractLists(text, listIndex, lineRef) {
  const re = /(?:^[\s]{0,4}(?:[-*+](?![*_])|\d+[.)])\s+[^\n]{1,500}(?:\n|$)){3,}/gm;
  return text.replace(re, (match, offset) => {
    const items = match.split("\n").filter((l) => /^[\s]{0,4}(?:[-*+](?![*_])|\d+[.)])\s+/.test(l));
    const count = items.length;
    const firstItem = items[0] || "";
    const type = /^\s*\d+[.)]/.test(firstItem) ? "#" : "*";
    const name = extractName(text, offset);
    const n = listIndex.length + 1;
    listIndex.push({ n, lineRef, count, type, name });
    return name ? `[B${n} | ${count}${type} | "${name}"]` : `[B${n} | ${count}${type} | ]`;
  });
}

// Parse image dimensions from base64 header bytes.
function parseImageDimensions(mediaType, base64) {
  try {
    const head = Buffer.from(base64.slice(0, 200), "base64");
    if (mediaType.includes("png")) {
      // PNG IHDR: bytes 16-24 = width/height BE uint32
      if (head.length >= 24 && head[0] === 0x89 && head[1] === 0x50) {
        const w = head.readUInt32BE(16);
        const h = head.readUInt32BE(20);
        if (w > 0 && h > 0 && w < 100000 && h < 100000) return { w, h };
      }
    } else if (mediaType.includes("gif")) {
      // GIF: bytes 6-10 = width/height LE uint16
      if (head.length >= 10 && head[0] === 0x47 && head[1] === 0x49) {
        const w = head.readUInt16LE(6);
        const h = head.readUInt16LE(8);
        if (w > 0 && h > 0) return { w, h };
      }
    } else if (mediaType.includes("webp")) {
      // WebP VP8: bytes 26-30, but only trust if RIFF + WEBP signature present
      if (
        head.length >= 30 &&
        head.slice(0, 4).toString() === "RIFF" &&
        head.slice(8, 12).toString() === "WEBP"
      ) {
        const w = (head.readUInt16LE(26) & 0x3fff) + 1;
        const h = (head.readUInt16LE(28) & 0x3fff) + 1;
        if (w > 0 && h > 0) return { w, h };
      }
    } else if (mediaType.includes("jpeg") || mediaType.includes("jpg")) {
      // JPEG: scan for SOF0/1/2/3 (0xFFC0..0xFFC3). Widen scan window to
      // 8192 bytes (base64-decoded) to tolerate large EXIF/APP1 headers.
      const jpegHead = Buffer.from(base64.slice(0, 8192), "base64");
      for (let i = 2; i < jpegHead.length - 9; i++) {
        if (
          jpegHead[i] === 0xff &&
          (jpegHead[i + 1] === 0xc0 ||
            jpegHead[i + 1] === 0xc1 ||
            jpegHead[i + 1] === 0xc2 ||
            jpegHead[i + 1] === 0xc3)
        ) {
          const h = jpegHead.readUInt16BE(i + 5);
          const w = jpegHead.readUInt16BE(i + 7);
          if (w > 0 && h > 0) return { w, h };
        }
      }
    }
  } catch {}
  return null;
}

function formatMediaType(mt) {
  if (!mt) return "img";
  const m = mt.match(/image\/(\w+)/);
  return m ? m[1] : "img";
}

// Tag regexes used to mark atomic ranges that must not be split by
// smartTruncate's head/tail/window boundaries.
const TAG_REGEXES_FOR_SNAP = [
  /\[C(\d+) \| (\d+)L \| ([\d.]+(?:K|M)?B)\]/g,
  /\[T(\d+) \| (\d+)R \| (?:"([^"]*)")?\]/g,
  /\[B(\d+) \| (\d+)[#*] \| (?:"([^"]*)")?\]/g,
  /\[I(\d+) \| (\w+) \| (?:(\d+)×(\d+))?\]/g,
];

// Signal-preserving truncation. Keeps head/tail verbatim, extracts natural
// context windows around preserved atoms in the middle. Tag-aware: any slice
// boundary that would land inside an atomic [C|T|B|I...] tag is snapped to
// that tag's nearest edge so tags never get split.
function smartTruncate(content, head, tail) {
  if (content.length <= head + tail) return content;

  // Collect tag ranges (sorted by start).
  const tagRanges = [];
  for (const src of TAG_REGEXES_FOR_SNAP) {
    const re = new RegExp(src.source, src.flags);
    let m;
    while ((m = re.exec(content)) !== null) {
      tagRanges.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  tagRanges.sort((a, b) => a.start - b.start);

  // If pos lands strictly inside a tag, return the tag's end (extend forward).
  function snapForward(pos) {
    for (const tr of tagRanges) {
      if (tr.start >= pos) break;
      if (pos > tr.start && pos < tr.end) return tr.end;
    }
    return pos;
  }
  // If pos lands strictly inside a tag, return the tag's start (retract back).
  function snapBackward(pos) {
    for (const tr of tagRanges) {
      if (tr.start >= pos) break;
      if (pos > tr.start && pos < tr.end) return tr.start;
    }
    return pos;
  }

  const headEnd = snapForward(head);
  const tailStart = snapBackward(content.length - tail);

  // Head and tail now overlap (or would invert) — keep whole message verbatim.
  if (headEnd >= tailStart) return content;

  const headPart = content.slice(0, headEnd);
  const tailPart = content.slice(tailStart);
  const midStart = headEnd;
  const midEnd = tailStart;

  const atoms = [];
  for (const src of SMART_PATTERNS) {
    const re = new RegExp(src.source, src.flags);
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m.index >= midStart && m.index + m[0].length <= midEnd) {
        atoms.push({ start: m.index, end: m.index + m[0].length });
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  if (atoms.length === 0) {
    // Silent continuity — no legacy [...chars omitted...] marker.
    return headPart + "\n\n" + tailPart;
  }

  const WINDOW = 60;
  const windows = atoms.map((a) => {
    let ws = Math.max(midStart, a.start - WINDOW);
    let we = Math.min(midEnd, a.end + WINDOW);
    // Snap window boundaries so they never straddle a tag.
    ws = snapBackward(ws);
    we = snapForward(we);
    // Re-clamp to mid range after snapping.
    ws = Math.max(midStart, ws);
    we = Math.min(midEnd, we);
    return { start: ws, end: we };
  });
  windows.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && last.end >= w.start) {
      last.end = Math.max(last.end, w.end);
    } else {
      merged.push({ ...w });
    }
  }

  // Helper: is `absPos` strictly inside any tag range (not on boundary)?
  function insideTag(absPos) {
    for (const tr of tagRanges) {
      if (tr.start >= absPos) break;
      if (absPos > tr.start && absPos < tr.end) return true;
    }
    return false;
  }
  const snippets = merged
    .map((w) => {
      let s = content.slice(w.start, w.end);
      // Head partial-word trim: only if walking forward to the first space
      // keeps us OUTSIDE any tag. Prevents eating `[X123 ` tag header or
      // cutting mid-tag when the slice starts inside a tag.
      if (/^\S/.test(s) && w.start > midStart) {
        const firstSpace = s.indexOf(" ");
        if (firstSpace > 0 && firstSpace < 20) {
          const absSpace = w.start + firstSpace;
          if (!insideTag(w.start + 1) && !insideTag(absSpace)) {
            s = s.slice(firstSpace + 1);
          }
        }
      }
      // Tail partial-word trim: only if walking backward to the last space
      // keeps us OUTSIDE any tag. Prevents eating `..."name"]` tag closer
      // when the slice ends slightly past a tag.
      if (/\S$/.test(s) && w.end < midEnd) {
        const lastSpace = s.lastIndexOf(" ");
        if (lastSpace > s.length - 20) {
          const absSpace = w.start + lastSpace;
          if (!insideTag(w.end - 1) && !insideTag(absSpace)) {
            s = s.slice(0, lastSpace);
          }
        }
      }
      return s.trim();
    })
    .filter((s) => s.length > 10);

  if (snippets.length === 0) {
    return headPart + "\n\n" + tailPart;
  }

  return headPart + "\n\n" + snippets.join("\n\n") + "\n\n" + tailPart;
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

// Process content array for images. Returns text with image tags inline,
// mutates imageIndex. For images whose dimensions fail to parse, replaces
// with plain "[Image]" marker (no index entry).
function extractTextWithImages(content, imageIndex, lineRef) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  let contextText = "";
  // Pre-scan to capture context text for footer
  for (const b of content) {
    if (b.type === "text" && b.text) {
      contextText = b.text.slice(0, 60).replace(/\s+/g, " ").trim();
      break;
    }
  }
  for (const b of content) {
    if (b.type === "text" && b.text) {
      parts.push(b.text);
    } else if (b.type === "image" && b.source) {
      const src = b.source;
      const mediaType = src.media_type || src.mediaType || "";
      const fmt = formatMediaType(mediaType);
      const base64 = src.data || "";
      const filesize = Math.floor((base64.length * 3) / 4);
      const dims = parseImageDimensions(mediaType, base64);
      if (dims) {
        const n = imageIndex.length + 1;
        imageIndex.push({
          n,
          lineRef,
          format: fmt,
          w: dims.w,
          h: dims.h,
          filesize,
          contextText,
        });
        parts.push(`[I${n} | ${fmt} | ${dims.w}×${dims.h}]`);
      } else {
        parts.push("[Image]");
      }
    }
  }
  return parts.join("\n");
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

  // Global index collectors (footer data)
  const codeIndex = [];
  const tableIndex = [];
  const listIndex = [];
  const imageIndex = [];
  const tocEntries = []; // { lineRef, level, text }

  // Records: { kind: 'user'|'asst'|'tools', raw, loc, tsTag, markers, tools }
  // Rendered to strings at end (after last-10-turn boost decision).
  const output = [];
  let pendingTools = [];
  let lineNum = 0;
  let lastUserIdx = -1; // index into output[] of last user message record
  let pendingSessionMarker = ""; // session markers — applied to next user message
  function addSessionMarker(mark) {
    if (!pendingSessionMarker.includes(mark)) {
      pendingSessionMarker += mark;
    }
  }
  let isFirstUserMessage = true; // track first non-meta user message for @ marker
  let inContinueSkill = false; // track /continue skill execution for compact file detection
  const continueCompactFiles = new Set();
  let pendingContinueMark = ""; // ^ or ^^ — applied separately to maintain regex order
  // Cost/ctx/heuristic/rate-limit markers are NOT handled here — see analyze-usage.js
  // which writes them to timeline.csv's `markers` column. build-report.js joins the
  // two streams by JSONL line number.
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
    output.push({ kind: "tools", tools: pendingTools.slice() });
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

    // Detect compact events (auto or manual) via compact_boundary system event.
    // Split by compactMetadata.trigger:
    //   - trigger === 'auto'   → ++ (auto-compact from context pressure)
    //   - trigger === 'manual' → +  (manual /compact; also covered by tag detection below,
    //                                 addSessionMarker dedups if both are seen)
    //   - missing trigger      → + (default: treat as manual since auto always sets 'auto')
    if (type === "system" && obj.subtype === "compact_boundary") {
      const trigger = obj.compactMetadata && obj.compactMetadata.trigger;
      if (trigger === "auto") {
        addSessionMarker("++");
      } else {
        addSessionMarker("+");
      }
      continue;
    }

    if (type === "user") {
      // Detect cache-affecting slash commands from ANY user message (meta or not)
      const rawForCmd = extractText(content);
      const cmdMatch = rawForCmd.match(/<command-name>\/([\w-]+)<\/command-name>/);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        if (cmd === "clear") addSessionMarker("@@");
        // Manual /compact — tag detection covers cases where compact_boundary
        // is NOT emitted (e.g., compact failed or was skipped mid-run). Normal
        // successful runs also emit compact_boundary trigger=manual; addSessionMarker
        // dedups so we never get "++" from a single manual compact.
        else if (cmd === "compact") addSessionMarker("+");
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
      const raw = extractTextWithImages(content, imageIndex, loc);
      const text = cleanText(raw);
      if (text && !shouldSkipUser(text)) {
        // Session markers are NOT applied here — they are applied retroactively
        // when the assistant responds with usage data (= real API call).
        // This prevents markers from being wasted on dead-end user messages
        // that never get an API response (e.g., failed skill invocations).
        output.push({ kind: "user", raw: text, loc, tsTag, markers: "" });
        lastUserIdx = output.length - 1;
      }
    } else if (type === "assistant") {
      // Rate-limit synthetic messages: skip here (detection + markers live in
      // analyze-usage.js → timeline.csv markers column). We still skip normal
      // processing to avoid emitting them as assistant text.
      if (obj.error === "rate_limit") {
        continue;
      }

      // Apply pending user-side session markers on the first assistant turn
      // that follows a user prompt (real API call = usage data present).
      // Subsequent assistant turns for the same user prompt see empty pending
      // markers and become no-ops, so there is no string-accumulation bug.
      const usage = obj.usage || (obj.message && obj.message.usage);
      if (usage && lastUserIdx >= 0) {
        let sMark = pendingSessionMarker;
        if (isFirstUserMessage && !sMark) sMark = "@";
        if (sMark) {
          pendingSessionMarker = "";
          isFirstUserMessage = false;
        }
        const contMark = pendingContinueMark;
        if (contMark) pendingContinueMark = "";
        const allMarks = sMark + contMark;
        if (allMarks && output[lastUserIdx] && output[lastUserIdx].kind === "user") {
          output[lastUserIdx].markers += allMarks;
        }
      }
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            flushTools();
            const cleaned = cleanText(block.text);
            if (cleaned && !shouldSkipAsst(cleaned)) {
              output.push({ kind: "asst", raw: cleaned, loc, tsTag });
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
          output.push({ kind: "asst", raw: cleaned, loc, tsTag });
        }
      }
    }
  }

  flushTools();
  flushContinueMarker();
  // Apply any remaining continue mark to the last user record
  if (pendingContinueMark && lastUserIdx >= 0 && output[lastUserIdx] && output[lastUserIdx].kind === "user") {
    output[lastUserIdx].markers += pendingContinueMark;
    pendingContinueMark = "";
  }
  // Flush any remaining session marker (e.g., /clear at EOF with no follow-up)
  // onto the most recent user message so it is not silently lost.
  if (pendingSessionMarker && lastUserIdx >= 0 && output[lastUserIdx] && output[lastUserIdx].kind === "user") {
    output[lastUserIdx].markers += pendingSessionMarker;
    pendingSessionMarker = "";
  }
  // Note: rate-limit markers are handled in analyze-usage.js now (timeline.csv markers column)

  // Post-process: merge consecutive tools records
  const merged = [];
  for (const rec of output) {
    if (rec.kind === "tools" && merged.length > 0 && merged[merged.length - 1].kind === "tools") {
      merged[merged.length - 1].tools = merged[merged.length - 1].tools.concat(rec.tools);
    } else {
      merged.push(rec);
    }
  }

  // Last-10-turn boost: identify indices of last LAST_TURN_BOOST_COUNT
  // user+assistant turns (tools records do not count).
  const boostSet = new Set();
  let seenTurns = 0;
  for (let i = merged.length - 1; i >= 0 && seenTurns < LAST_TURN_BOOST_COUNT; i--) {
    if (merged[i].kind === "user" || merged[i].kind === "asst") {
      boostSet.add(i);
      seenTurns++;
    }
  }

  // Base head/tail from CLI args. Mode detection: head<=150 = aggressive.
  // Last-10-turn boost: base * 1.5 for both modes.
  const BASE_HEAD = USER_HEAD;
  const BASE_TAIL = USER_TAIL;
  const BOOST_HEAD = Math.floor(BASE_HEAD * 1.5);
  const BOOST_TAIL = Math.floor(BASE_TAIL * 1.5);

  const renderedLines = [];

  for (let i = 0; i < merged.length; i++) {
    const rec = merged[i];
    if (rec.kind === "tools") {
      renderedLines.push(`[Tools: ${rec.tools.join(", ")}]`);
      continue;
    }
    const boosted = boostSet.has(i);
    const head = boosted ? BOOST_HEAD : BASE_HEAD;
    const tail = boosted ? BOOST_TAIL : BASE_TAIL;
    const tsPart = rec.tsTag ? " " + rec.tsTag : "";

    // Unified pipeline: code (with short-block masking) → tables → lists →
    // TOC scan → restore masked short code blocks → smartTruncate.
    // Masking prevents shell/python/script-like content in short inline code
    // blocks from being misread as tables, lists, or headers.
    const keptBlocks = [];
    let processed = extractCodeBlocks(rec.raw, codeIndex, rec.loc, keptBlocks);
    processed = extractTables(processed, tableIndex, rec.loc);
    processed = extractLists(processed, listIndex, rec.loc);

    // Collect TOC entries (H1-H2 only) from processed text BEFORE restoring
    // short code blocks — so `##` comments inside a kept shell block never
    // get scraped as a header.
    const headerRe = /^(#{1,2})\s+(.{1,100})$/gm;
    let hm;
    while ((hm = headerRe.exec(processed)) !== null) {
      tocEntries.push({ lineRef: rec.loc, level: hm[1].length, text: hm[2].trim() });
    }

    processed = restoreKeptCodeBlocks(processed, keptBlocks);
    const body = smartTruncate(processed, head, tail);

    if (rec.kind === "user") {
      renderedLines.push(`[${rec.loc} User${tsPart}]${rec.markers} ${body}`);
    } else {
      renderedLines.push(`[${rec.loc} Assistant${tsPart}] ${body}`);
    }
  }

  const bodyText = renderedLines.join("\n") + "\n";
  const lines = renderedLines.length;

  // Scan full body text for attention signals (emojis + keywords)
  const emojiCounts = {};
  const emojiRe = new RegExp("[" + ATTENTION_EMOJIS + "]", "gu");
  let em;
  while ((em = emojiRe.exec(bodyText)) !== null) {
    emojiCounts[em[0]] = (emojiCounts[em[0]] || 0) + 1;
  }
  const keywordCounts = {};
  const kwRe = new RegExp(ATTENTION_KEYWORDS.source, "gi");
  let km;
  while ((km = kwRe.exec(bodyText)) !== null) {
    const k = km[1].toLowerCase().replace(/\s+/g, " ");
    keywordCounts[k] = (keywordCounts[k] || 0) + 1;
  }

  // Build meta footer
  const footer = buildMetaFooter({
    lines,
    bytes: 0, // filled after
    codeIndex,
    tableIndex,
    listIndex,
    imageIndex,
    emojiCounts,
    keywordCounts,
    tocEntries,
  });

  // Compute final size (body + footer)
  const footerPlaceholder = footer.replace("__BYTES__", "0");
  const totalBytes = Buffer.byteLength(bodyText + footerPlaceholder, "utf8");
  const finalFooter = footer.replace("__BYTES__", String(totalBytes));

  process.stdout.write(bodyText + finalFooter);
}

function buildMetaFooter(data) {
  const { lines, codeIndex, tableIndex, listIndex, imageIndex, emojiCounts, keywordCounts, tocEntries } = data;
  const parts = [];
  parts.push("");
  parts.push("# ===== META FOOTER =====");
  parts.push(`# compact-format: ${COMPACT_FORMAT_VERSION}`);
  parts.push(`# ${lines} lines, __BYTES__ bytes`);
  parts.push("#");

  // Code blocks
  if (codeIndex.length > 0) {
    parts.push(`# ─── Code Blocks (${codeIndex.length} total) ───`);
    for (const c of codeIndex) {
      parts.push(`# [C${c.n}]   ${c.lineRef}   ${c.lines}L   ${formatBytes(c.bytes)}`);
    }
  } else {
    parts.push(`# ─── Code Blocks (0 total) ─── (none)`);
  }
  parts.push("#");

  // Tables
  if (tableIndex.length > 0) {
    parts.push(`# ─── Tables (${tableIndex.length} total) ───`);
    for (const t of tableIndex) {
      const nm = t.name ? `   "${t.name}"` : "";
      parts.push(`# [T${t.n}]   ${t.lineRef}   ${t.rows}R${nm}`);
    }
  } else {
    parts.push(`# ─── Tables (0 total) ─── (none)`);
  }
  parts.push("#");

  // Lists
  if (listIndex.length > 0) {
    parts.push(`# ─── Lists (${listIndex.length} total) ───`);
    for (const l of listIndex) {
      const nm = l.name ? `   "${l.name}"` : "";
      parts.push(`# [B${l.n}]   ${l.lineRef}   ${l.count}${l.type}${nm}`);
    }
  } else {
    parts.push(`# ─── Lists (0 total) ─── (none)`);
  }
  parts.push("#");

  // Images
  if (imageIndex.length > 0) {
    parts.push(`# ─── Images (${imageIndex.length} total) ───`);
    for (const im of imageIndex) {
      const ctx = im.contextText ? `   "${im.contextText}"` : "";
      parts.push(`# [I${im.n}]   ${im.lineRef}   ${im.format}   ${im.w}×${im.h}   ${formatBytes(im.filesize)}${ctx}`);
    }
  } else {
    parts.push(`# ─── Images (0 total) ─── (none)`);
  }
  parts.push("#");

  // Attention signals
  parts.push(`# ─── Attention Signals ───`);
  const emojiEntries = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]);
  if (emojiEntries.length > 0) {
    parts.push(`# Emojis: ${emojiEntries.map(([e, n]) => `${e}×${n}`).join(" ")}`);
  } else {
    parts.push(`# Emojis: (none)`);
  }
  const kwEntries = Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]);
  if (kwEntries.length > 0) {
    parts.push(`# Keywords: ${kwEntries.map(([k, n]) => `"${k}"×${n}`).join(" ")}`);
  } else {
    parts.push(`# Keywords: (none)`);
  }
  parts.push("#");

  // TOC (last for LLM attention weight)
  if (tocEntries.length > 0) {
    parts.push(`# ─── Table of Contents (Headers) ───`);
    for (const t of tocEntries) {
      const hashes = "#".repeat(t.level);
      parts.push(`# ${t.lineRef}   ${hashes}   ${t.text}`);
    }
  } else {
    parts.push(`# ─── Table of Contents (Headers) ─── (none)`);
  }

  return parts.join("\n") + "\n";
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
