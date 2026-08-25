/**
 * cache-paths.js — Single source of truth for all cache path resolution.
 *
 * Structure:
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/timeline.csv
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/summary.json
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/ratelimit.csv
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/compact.txt
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/compact.aggressive.txt
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/subagents/{agentId}/timeline.csv
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/subagents/{agentId}/summary.json
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const CACHE_BASE = path.join(os.homedir(), '.claude', 'super-token-saver-data');

// Auto-migrate from previous names (rename only, no cross-device copy)
const _legacyDirs = [
  path.join(os.homedir(), '.claude', 'claude-code-token-saver-data'), // v1.6.0–v2.5.0
  path.join(os.homedir(), '.claude', 'claude-code-upgrader-data'), // v1.5.x
  path.join(os.homedir(), '.claude', 'cc-token-saver-data'), // v1.1.1–v1.4.x
  path.join(os.homedir(), '.claude', 'cc-token-saver'),      // pre-v1.1.1
];
if (!fs.existsSync(CACHE_BASE)) {
  for (const old of _legacyDirs) {
    if (fs.existsSync(old)) {
      try { fs.renameSync(old, CACHE_BASE); } catch (_) {}
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Project name helpers
// ---------------------------------------------------------------------------

/**
 * Derive projectName from CWD — same algorithm as Claude Code.
 * e.g. /Users/foo/myproject → -Users-foo-myproject
 */
function projectNameFromCwd(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Extract projectName from a CC transcript path.
 * e.g. ~/.claude/projects/-Users-foo-myproject/abc123.jsonl → -Users-foo-myproject
 */
function extractProjectName(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/projects/');
  if (parts.length < 2) return null;
  return parts[1].split('/')[0];
}

// ---------------------------------------------------------------------------
// Path getters — session level
// ---------------------------------------------------------------------------

function getProjectDir(projectName) {
  return path.join(CACHE_BASE, projectName);
}

function getSessionDir(projectName, sessionId) {
  return path.join(getProjectDir(projectName), sessionId);
}

function getTimelinePath(projectName, sessionId) {
  return path.join(getSessionDir(projectName, sessionId), 'timeline.csv');
}

function getSummaryPath(projectName, sessionId) {
  return path.join(getSessionDir(projectName, sessionId), 'summary.json');
}

function getRatelimitPath(projectName, sessionId) {
  return path.join(getSessionDir(projectName, sessionId), 'ratelimit.csv');
}

function getCompactPath(projectName, sessionId, aggressive = false) {
  const name = aggressive ? 'compact.aggressive.txt' : 'compact.txt';
  return path.join(getSessionDir(projectName, sessionId), name);
}

// ---------------------------------------------------------------------------
// Path getters — subagent level
// ---------------------------------------------------------------------------

function getSubagentDir(projectName, sessionId, agentId) {
  return path.join(getSessionDir(projectName, sessionId), 'subagents', agentId);
}

function getSubagentTimelinePath(projectName, sessionId, agentId) {
  return path.join(getSubagentDir(projectName, sessionId, agentId), 'timeline.csv');
}

function getSubagentSummaryPath(projectName, sessionId, agentId) {
  return path.join(getSubagentDir(projectName, sessionId, agentId), 'summary.json');
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash, first 8 hex chars. Used for privacy in report-limit.
 */
function hashId(id) {
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 8);
}

// ---------------------------------------------------------------------------
// Listing helpers
// ---------------------------------------------------------------------------

/**
 * List all project directories under CACHE_BASE.
 * Excludes non-directory entries and internal dirs like 'lib'.
 * Also excludes YYMM dirs (4-digit) and .migrated dirs.
 */
function listProjects() {
  if (!fs.existsSync(CACHE_BASE)) return [];
  return fs.readdirSync(CACHE_BASE).filter(d => {
    if (/^\d{4}$/.test(d)) return false;           // old YYMM dirs
    if (d.endsWith('.migrated')) return false;       // migrated YYMM dirs
    if (d === 'lib') return false;
    const full = path.join(CACHE_BASE, d);
    return fs.statSync(full).isDirectory();
  });
}

/**
 * List session directories inside a project.
 */
function listSessions(projectName) {
  const dir = getProjectDir(projectName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(d => {
    return fs.statSync(path.join(dir, d)).isDirectory();
  });
}

/**
 * List subagent directories inside a session.
 */
function listSubagents(projectName, sessionId) {
  const dir = path.join(getSessionDir(projectName, sessionId), 'subagents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(d => {
    return fs.statSync(path.join(dir, d)).isDirectory();
  });
}

// ---------------------------------------------------------------------------
// Migration — YYMM flat structure → project/session hierarchy
// ---------------------------------------------------------------------------

/**
 * Migrate old YYMM cache directories to new project/session structure.
 *
 * 1. Scan YYMM dirs (match /^\d{4}$/)
 * 2. For each summary-{sessionId}.json, read filePath to get projectName
 * 3. For timeline-{sessionId}.csv without summary, scan ~/.claude/projects/
 * 4. For agent files, find parent session via CC's subagents/ folder
 * 5. Copy files to new structure (mkdir -p, then copy)
 * 6. After all files in YYMM dir are migrated, rename to {YYMM}.migrated
 * 7. Unresolvable projectName → _unknown
 *
 * Logs actions to stderr.
 */
function migrateFromYYMM() {
  if (!fs.existsSync(CACHE_BASE)) return;

  const ccProjectsDir = path.join(os.homedir(), '.claude', 'projects');
  const yymmDirs = fs.readdirSync(CACHE_BASE).filter(d => {
    return /^\d{4}$/.test(d) && fs.statSync(path.join(CACHE_BASE, d)).isDirectory();
  });

  if (yymmDirs.length === 0) return;

  process.stderr.write(`[cache-paths] migrating ${yymmDirs.length} YYMM dir(s)\n`);

  // Build lookup: sessionId → projectName from summary files
  const sessionProjectMap = {};       // sessionId → projectName
  // Build lookup: agentId → { projectName, sessionId }
  const agentParentMap = {};

  // --- Pass 1: Collect projectNames from summary files ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const sumMatch = f.match(/^summary-([^.]+)\.json$/);
      if (!sumMatch) continue;
      if (f.startsWith('summary-agent-')) continue; // skip agent summaries
      const sid = sumMatch[1];
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const data = JSON.parse(raw);
        if (data.filePath) {
          const proj = extractProjectName(data.filePath);
          if (proj) {
            sessionProjectMap[sid] = proj;
          }
        }
      } catch (_) { /* ignore parse errors */ }
    }
  }

  // --- Pass 2: For sessions without summary, scan CC projects dirs ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);
    for (const f of files) {
      // Match timeline-{sid}.csv, ratelimit-{sid}.csv, compact-{sid}.*
      const tlMatch = f.match(/^timeline-([^.]+)\.csv$/);
      const rlMatch = f.match(/^ratelimit-([^.]+)\.csv$/);
      const cpMatch = f.match(/^compact-([^.]+?)(?:\.aggressive)?\.txt$/);

      // Skip agent files in this pass
      if (f.startsWith('timeline-agent-') || f.startsWith('summary-agent-')) continue;

      let sid = null;
      if (tlMatch) sid = tlMatch[1];
      else if (rlMatch) sid = rlMatch[1];
      else if (cpMatch) sid = cpMatch[1];

      if (!sid || sessionProjectMap[sid]) continue;

      // Try to find in CC projects
      const proj = _findProjectForSession(ccProjectsDir, sid);
      if (proj) {
        sessionProjectMap[sid] = proj;
      }
    }
  }

  // --- Pass 3: Resolve agent → parent session mapping ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const agentTlMatch = f.match(/^timeline-agent-([^.]+)\.csv$/);
      const agentSumMatch = f.match(/^summary-agent-([^.]+)\.json$/);
      const aid = agentTlMatch ? agentTlMatch[1] : (agentSumMatch ? agentSumMatch[1] : null);
      if (!aid || agentParentMap[aid]) continue;

      const parent = _findParentSession(ccProjectsDir, aid, sessionProjectMap);
      if (parent) {
        agentParentMap[aid] = parent;
      }
    }
  }

  // --- Pass 4: Copy files to new structure ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);

    for (const f of files) {
      const srcPath = path.join(dir, f);

      // Skip directories
      if (fs.statSync(srcPath).isDirectory()) continue;

      let destPath = null;

      // Session-level files
      const sumMatch = f.match(/^summary-([^.]+)\.json$/);
      const tlMatch = f.match(/^timeline-([^.]+)\.csv$/);
      const rlMatch = f.match(/^ratelimit-([^.]+)\.csv$/);
      const cpMatch = f.match(/^compact-([^.]+)\.txt$/);
      const cpAggMatch = f.match(/^compact-([^.]+)\.aggressive\.txt$/);
      const agentTlMatch = f.match(/^timeline-agent-([^.]+)\.csv$/);
      const agentSumMatch = f.match(/^summary-agent-([^.]+)\.json$/);

      if (agentSumMatch) {
        const aid = agentSumMatch[1];
        const parent = agentParentMap[aid];
        const proj = parent ? parent.projectName : '_unknown';
        const parentSid = parent ? parent.sessionId : '_unknown';
        destPath = getSubagentSummaryPath(proj, parentSid, aid);
      } else if (agentTlMatch) {
        const aid = agentTlMatch[1];
        const parent = agentParentMap[aid];
        const proj = parent ? parent.projectName : '_unknown';
        const parentSid = parent ? parent.sessionId : '_unknown';
        destPath = getSubagentTimelinePath(proj, parentSid, aid);
      } else if (sumMatch && !f.startsWith('summary-agent-')) {
        const sid = sumMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getSummaryPath(proj, sid);
      } else if (cpAggMatch) {
        const sid = cpAggMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getCompactPath(proj, sid, true);
      } else if (cpMatch && !cpAggMatch) {
        // Non-aggressive compact — but skip if already handled by cpAggMatch
        const sid = cpMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getCompactPath(proj, sid, false);
      } else if (tlMatch && !f.startsWith('timeline-agent-')) {
        const sid = tlMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getTimelinePath(proj, sid);
      } else if (rlMatch) {
        const sid = rlMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getRatelimitPath(proj, sid);
      }

      if (!destPath) {
        process.stderr.write(`[cache-paths] skip unknown file: ${f}\n`);
        continue;
      }

      // Copy
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      process.stderr.write(`[cache-paths] copied ${ym}/${f} → ${path.relative(CACHE_BASE, destPath)}\n`);
    }

    // Rename YYMM dir to YYMM.migrated (may fail if new files appeared during migration)
    const migratedPath = path.join(CACHE_BASE, `${ym}.migrated`);
    try {
      fs.renameSync(dir, migratedPath);
      process.stderr.write(`[cache-paths] renamed ${ym} → ${ym}.migrated\n`);
    } catch {
      process.stderr.write(`[cache-paths] warning: ${ym} not empty after migration, will retry next run\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers for migration
// ---------------------------------------------------------------------------

/**
 * Scan ~/.claude/projects/ for a transcript matching sessionId.
 * Returns projectName or null.
 */
function _findProjectForSession(ccProjectsDir, sessionId) {
  if (!fs.existsSync(ccProjectsDir)) return null;

  const projects = fs.readdirSync(ccProjectsDir);
  for (const proj of projects) {
    const projDir = path.join(ccProjectsDir, proj);
    if (!fs.statSync(projDir).isDirectory()) continue;

    // Check for {sessionId}.jsonl directly in project dir
    if (fs.existsSync(path.join(projDir, `${sessionId}.jsonl`))) {
      return proj;
    }

    // Check for session subdirectory (newer CC structure)
    if (fs.existsSync(path.join(projDir, sessionId))) {
      return proj;
    }
  }
  return null;
}

/**
 * Find parent session for a given agentId.
 * Checks CC's subagents/ folder structure under each known project/session.
 * Returns { projectName, sessionId } or null.
 */
function _findParentSession(ccProjectsDir, agentId, sessionProjectMap) {
  if (!fs.existsSync(ccProjectsDir)) return null;

  const projects = fs.readdirSync(ccProjectsDir);
  for (const proj of projects) {
    const projDir = path.join(ccProjectsDir, proj);
    if (!fs.statSync(projDir).isDirectory()) continue;

    const entries = fs.readdirSync(projDir);
    for (const entry of entries) {
      const entryPath = path.join(projDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      // entry could be a sessionId directory
      const subagentsDir = path.join(entryPath, 'subagents');
      if (!fs.existsSync(subagentsDir)) continue;

      // Check for agent-{agentId}.jsonl or agent-{agentId}.meta.json
      if (
        fs.existsSync(path.join(subagentsDir, `agent-${agentId}.jsonl`)) ||
        fs.existsSync(path.join(subagentsDir, `agent-${agentId}.meta.json`))
      ) {
        return { projectName: proj, sessionId: entry };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  CACHE_BASE,
  projectNameFromCwd,
  extractProjectName,
  getProjectDir,
  getSessionDir,
  getTimelinePath,
  getSummaryPath,
  getRatelimitPath,
  getCompactPath,
  getSubagentDir,
  getSubagentTimelinePath,
  getSubagentSummaryPath,
  hashId,
  listProjects,
  listSessions,
  listSubagents,
  migrateFromYYMM,
};
