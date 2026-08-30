#!/usr/bin/env node
/**
 * test-sessionstart-hook-guard.js — regression test for compact-time SessionStart
 * hook warnings (exit 1 / 127).
 *
 * History: the SessionStart registry in hooks/hooks.json used to invoke each
 * hook command directly, with no fail-open wrapper. Any missing runtime
 * (node not on PATH), missing plugin root, or missing referenced file made
 * the command exit non-zero — Claude Code surfaced that as a hook warning at
 * every SessionStart, including the one that fires right after compaction.
 * Each command is now wrapped at the registry boundary with
 * `2>/dev/null || true`, so this must hold going forward.
 *
 * This test parses hooks/hooks.json, extracts every SessionStart command,
 * and runs each one through /bin/sh under hostile conditions that are known
 * to have reproduced exit 1 and exit 127 pre-fix:
 *   - CLAUDE_PLUGIN_ROOT unset (path resolves under "/hooks/...")
 *   - CLAUDE_PLUGIN_ROOT pointing at a directory that has no hook files
 *   - PATH stripped of node (matches "node: command not found" -> 127)
 * Every command must exit 0 with empty stderr under every hostile
 * condition. A happy-path run (real plugin root, full PATH) must still
 * exit 0, and the sed-based command must still emit its file content on
 * stdout.
 *
 * Usage: node test-sessionstart-hook-guard.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const HOOKS_JSON_PATH = path.join(REPO_ROOT, "hooks", "hooks.json");

let failures = 0;
function check(name, cond, detail) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : detail ? `\n       ${detail}` : ""}`);
}

// --- JSON parse of the registry (also the "JSON parse" gate check) ---
const raw = fs.readFileSync(HOOKS_JSON_PATH, "utf8");
let registry;
try {
  registry = JSON.parse(raw);
} catch (e) {
  console.log(`FAIL hooks.json parses as JSON\n       ${e.message}`);
  process.exit(1);
}
check("hooks.json parses as JSON", registry && typeof registry === "object");

const sessionStartEntries = (registry.hooks && registry.hooks.SessionStart) || [];
check("hooks.json has a non-empty SessionStart array", sessionStartEntries.length > 0);

const commands = [];
for (const entry of sessionStartEntries) {
  for (const h of entry.hooks || []) {
    if (h.type === "command" && typeof h.command === "string") {
      commands.push({ matcher: entry.matcher || null, command: h.command });
    }
  }
}
check("extracted at least one SessionStart command", commands.length > 0, `found ${commands.length}`);

// --- Hostile scenarios known to reproduce exit 1 / exit 127 ---
const emptyPluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sessionstart-empty-root-"));
const minimalPath = "/usr/bin:/bin"; // excludes node (installed outside these dirs on this machine)

const scenarios = [
  {
    name: "CLAUDE_PLUGIN_ROOT unset",
    env: { CLAUDE_PLUGIN_ROOT: "" },
  },
  {
    name: "CLAUDE_PLUGIN_ROOT points at a directory with no hook files",
    env: { CLAUDE_PLUGIN_ROOT: emptyPluginRoot },
  },
  {
    name: "PATH stripped of node (simulates missing runtime)",
    env: { CLAUDE_PLUGIN_ROOT: REPO_ROOT, PATH: minimalPath },
  },
];

function stdinFor(matcher) {
  if (matcher === "compact") {
    return JSON.stringify({ source: "compact", session_id: "test-session" });
  }
  return "";
}

function run(command, env, stdin) {
  const fullEnv = { ...process.env, ...env };
  // Scenario objects only set the vars they want overridden; anything not
  // in `env` inherits the real process.env (e.g. PATH stays full unless a
  // scenario explicitly shrinks it).
  return spawnSync("/bin/sh", ["-c", command], {
    env: fullEnv,
    input: stdin,
    encoding: "utf8",
    timeout: 10000,
  });
}

for (const { matcher, command } of commands) {
  for (const scenario of scenarios) {
    const result = run(command, scenario.env, stdinFor(matcher));
    const label = `SessionStart[${matcher || "*"}] "${command.slice(0, 60)}..." under: ${scenario.name}`;
    check(
      `${label} exits 0`,
      result.status === 0,
      `exit=${result.status} stderr=${(result.stderr || "").slice(0, 200)}`
    );
    check(
      `${label} suppresses stderr`,
      (result.stderr || "") === "",
      `stderr=${(result.stderr || "").slice(0, 200)}`
    );
  }
}

// --- Happy path: real plugin root, full PATH, must still exit 0 and, for
// the sed command, still print the file content (stdout must survive the
// fail-open wrapper on success). ---
for (const { matcher, command } of commands) {
  const result = run(command, { CLAUDE_PLUGIN_ROOT: REPO_ROOT }, stdinFor(matcher));
  check(
    `SessionStart[${matcher || "*"}] "${command.slice(0, 60)}..." exits 0 on happy path`,
    result.status === 0,
    `exit=${result.status} stderr=${(result.stderr || "").slice(0, 200)}`
  );
  if (command.includes("session-architecture.md")) {
    check(
      "happy-path sed command preserves stdout (non-empty file content)",
      typeof result.stdout === "string" && result.stdout.includes("__PLUGIN_ROOT__") === false && result.stdout.length > 0,
      `stdout length=${(result.stdout || "").length}`
    );
  }
}

fs.rmSync(emptyPluginRoot, { recursive: true, force: true });

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
