#!/usr/bin/env node
/**
 * test-cache-migration.js — gate for the legacy cache move.
 *
 * The defect this exists to prevent: `statusline-logger.sh` is a Bash hook that
 * writes into the cache base with `mkdir -p`, without going through
 * cache-paths.js. It fires on the first prompt after an upgrade, so the new
 * base already exists — and a migration guarded by "only if the new base is
 * missing" then strands the entire real cache under the old name, silently.
 * Measured once for real: 140 MB, 2,864 compact caches and 8 handoffs orphaned.
 *
 * Usage: node test-cache-migration.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

let failures = 0;
function check(name, actual, expected) {
  let v;
  try { v = typeof actual === "function" ? actual() : actual; } catch (e) { v = `threw: ${e.message}`; }
  const ok = JSON.stringify(v) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(v)}`}`);
}

const NEW = "super-token-saver-data";
const OLD = "claude-code-token-saver-data";

/** Run cache-paths.js with HOME pointed at a throwaway tree. */
function migrate(home) {
  execFileSync("node", ["-e", `require(${JSON.stringify(path.join(__dirname, "lib", "cache-paths.js"))})`],
    { env: { ...process.env, HOME: home }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function tree(home, base) {
  const root = path.join(home, ".claude", base);
  const out = [];
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, e);
      if (fs.statSync(full).isDirectory()) walk(full, `${prefix}${e}/`);
      else out.push(`${prefix}${e}`);
    }
  };
  walk(root, "");
  return out;
}

function scenario(build) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cache-migration-"));
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  build(home);
  migrate(home);
  return home;
}

function write(home, base, rel, body) {
  const p = path.join(home, ".claude", base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

// --- 1. the real failure: the hook created the new base first ----------------
let home = scenario((h) => {
  write(h, OLD, "projA/sess1/compact.txt", "the real cache");
  write(h, OLD, "projA/sess1/handoff.md", "the handoff");
  write(h, OLD, "projB/sess2/compact.txt", "more cache");
  // what statusline-logger.sh does, bypassing cache-paths.js entirely
  write(h, NEW, "projA/sess9/ratelimit.csv", "from the bash hook");
});
check("the cache moves even though the hook made the new base", tree(home, NEW).sort(), [
  "projA/sess1/compact.txt", "projA/sess1/handoff.md", "projA/sess9/ratelimit.csv", "projB/sess2/compact.txt",
].sort());
check("the hook's own file survives", () => fs.readFileSync(path.join(home, ".claude", NEW, "projA/sess9/ratelimit.csv"), "utf8"), "from the bash hook");
check("nothing is left behind under the old name", fs.existsSync(path.join(home, ".claude", OLD)), false);
fs.rmSync(home, { recursive: true, force: true });

// --- 2. plain case: no new base yet -----------------------------------------
home = scenario((h) => write(h, OLD, "projA/sess1/compact.txt", "x"));
check("a plain move still works", tree(home, NEW), ["projA/sess1/compact.txt"]);
fs.rmSync(home, { recursive: true, force: true });

// --- 3. a colliding session is never overwritten ----------------------------
home = scenario((h) => {
  write(h, OLD, "projA/sess1/compact.txt", "OLD content");
  write(h, NEW, "projA/sess1/compact.txt", "NEW content");
});
check("an existing session is not overwritten", () => fs.readFileSync(path.join(home, ".claude", NEW, "projA/sess1/compact.txt"), "utf8"), "NEW content");
check("the unmovable copy is kept, not destroyed", fs.existsSync(path.join(home, ".claude", OLD, "projA/sess1/compact.txt")), true);
fs.rmSync(home, { recursive: true, force: true });

// --- 4. idempotent --------------------------------------------------------
home = scenario((h) => write(h, OLD, "projA/sess1/compact.txt", "x"));
migrate(home); migrate(home);
check("running it again changes nothing", tree(home, NEW), ["projA/sess1/compact.txt"]);
fs.rmSync(home, { recursive: true, force: true });

// --- 5. older predecessors still carried ------------------------------------
home = scenario((h) => write(h, "cc-token-saver-data", "projA/sess1/compact.txt", "ancient"));
check("a pre-v1.5 cache is still carried forward", tree(home, NEW), ["projA/sess1/compact.txt"]);
fs.rmSync(home, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
