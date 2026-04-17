/**
 * git-lite-state.js — Shared state/preferences helpers for setup-git-lite.
 * Used by scripts/setup-git-lite.js, hooks/git-context-lite.sh (via node -e),
 * scripts/run-usage-view.js, scripts/report-limit.js.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const GLOBAL_SETTINGS_PATH = path.join(HOME, '.claude', 'settings.json');
const PREFS_DIR = path.join(HOME, '.claude', 'cc-token-saver-data');
const PREFS_PATH = path.join(PREFS_DIR, 'preferences.json');
const MARKER_BEGIN = '# BEGIN cc-token-saver:setup-git-lite';
const MARKER_END = '# END cc-token-saver:setup-git-lite';

// ── Preferences ────────────────────────────────────────────────
function readPrefs() {
  try {
    return JSON.parse(fs.readFileSync(PREFS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writePrefs(prefs) {
  fs.mkdirSync(PREFS_DIR, { recursive: true });
  const tmp = PREFS_PATH + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2) + '\n');
  fs.renameSync(tmp, PREFS_PATH);
}

function isRecommendationDismissed() {
  return readPrefs().git_lite_recommendation_dismissed === true;
}

function setRecommendationDismissed(dismissed) {
  const prefs = readPrefs();
  if (dismissed) {
    prefs.git_lite_recommendation_dismissed = true;
    prefs.git_lite_dismissed_at = new Date().toISOString();
  } else {
    delete prefs.git_lite_recommendation_dismissed;
    delete prefs.git_lite_dismissed_at;
  }
  writePrefs(prefs);
}

// ── Settings.json inspection ───────────────────────────────────
function readSettingsInclude() {
  try {
    const s = JSON.parse(fs.readFileSync(GLOBAL_SETTINGS_PATH, 'utf8'));
    return s.includeGitInstructions;
  } catch {
    return undefined;
  }
}

function setSettingsInclude(value) {
  // Distinguish "file missing" from "file exists but unreadable/corrupt".
  // In the corrupt case, refuse to write — otherwise we'd silently overwrite
  // with {} and clobber the user's other CC settings.
  let settings = {};
  let existed = false;
  let raw = null;
  try {
    raw = fs.readFileSync(GLOBAL_SETTINGS_PATH, 'utf8');
    existed = true;
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      fs.mkdirSync(path.dirname(GLOBAL_SETTINGS_PATH), { recursive: true });
    } else {
      throw new Error(
        `Cannot read ${GLOBAL_SETTINGS_PATH}: ${e.message || e}`
      );
    }
  }
  if (existed) {
    try {
      settings = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `${GLOBAL_SETTINGS_PATH} exists but is not valid JSON: ${e.message}. ` +
        `Refusing to overwrite to avoid clobbering your settings. ` +
        `Fix the JSON manually and re-run.`
      );
    }
  }
  if (value === 'remove') {
    delete settings.includeGitInstructions;
  } else {
    settings.includeGitInstructions = value;
  }
  const tmp = GLOBAL_SETTINGS_PATH + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n');
  fs.renameSync(tmp, GLOBAL_SETTINGS_PATH);
}

// ── Environment variable resolution (matches CC's logic) ───────
function resolveEnvVar() {
  const v = process.env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS;
  if (v === undefined) return null;
  if (v === '') return null; // empty string = unset, fall through to settings
  if (/^(1|true|yes|on)$/i.test(v)) return 'disabled';
  if (/^(0|false|no|off)$/i.test(v)) return 'enabled';
  return null;
}

// ── Shell profile detection ────────────────────────────────────
function detectShellProfile() {
  const shell = process.env.SHELL || '';
  const candidates = [];
  if (shell.endsWith('/zsh')) {
    candidates.push(path.join(HOME, '.zshrc'));
  } else if (shell.endsWith('/bash')) {
    // macOS interactive login shells typically read .bash_profile first
    if (process.platform === 'darwin') {
      const bp = path.join(HOME, '.bash_profile');
      if (fs.existsSync(bp)) candidates.push(bp);
    }
    candidates.push(path.join(HOME, '.bashrc'));
  } else if (shell.endsWith('/fish')) {
    candidates.push(path.join(HOME, '.config', 'fish', 'config.fish'));
  } else {
    candidates.push(path.join(HOME, '.profile'));
  }
  // Return first existing or first candidate (will be created on write)
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

// ── Effective state resolution ─────────────────────────────────
// Matches CC's shouldIncludeGitInstructions() logic:
//   env truthy → disabled
//   env falsy (explicit) → enabled
//   settings.includeGitInstructions ?? true
function computeEffectiveState() {
  const envState = resolveEnvVar();
  const settingValue = readSettingsInclude();
  let effective;
  let source;
  if (envState === 'disabled') {
    effective = false;
    source = 'env (CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS)';
  } else if (envState === 'enabled') {
    effective = true;
    source = 'env (CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=0)';
  } else if (typeof settingValue === 'boolean') {
    effective = settingValue;
    source = 'settings.json';
  } else {
    effective = true;
    source = 'default';
  }
  return { effective, source, envState, settingValue };
}

// ── Runtime gating & install state ─────────────────────────────
//
// `shouldInjectReplacement()` — runtime gate for the hook. True whenever CC's
// native git instructions are disabled by ANY mechanism (env, settings, etc.),
// regardless of whether WE disabled it or the user did manually.
function shouldInjectReplacement() {
  return computeEffectiveState().effective === false;
}

// `ourMarkerPresent()` — tracks whether OUR /setup-git-lite install left its
// marker block in the shell profile. Used by `status` to detect the orphan
// case: setting says disabled but our marker is gone (user removed it or
// plugin was uninstalled without revert).
function ourMarkerPresent() {
  return hasMarkerBlock(detectShellProfile());
}

// Back-compat alias (kept so external callers don't break if any exist).
function isInstalled() { return shouldInjectReplacement(); }

// ── Recommendation tip string (single source of truth) ─────────
function getRecommendationTip() {
  if (shouldInjectReplacement()) return null;
  if (isRecommendationDismissed()) return null;
  return (
    "Tip: CC's built-in git instructions consume ~2,200 tok/session + " +
    '~1,700 tok/call. `/setup-git-lite install` replaces them with a ' +
    'curated 280-tok minimum. `/setup-git-lite dismiss` hides this tip.'
  );
}

// ── Shell profile marker operations ────────────────────────────
function hasMarkerBlock(profilePath) {
  try {
    const content = fs.readFileSync(profilePath, 'utf8');
    return content.includes(MARKER_BEGIN);
  } catch {
    return false;
  }
}

function addMarkerBlock(profilePath) {
  let existing = '';
  try {
    existing = fs.readFileSync(profilePath, 'utf8');
  } catch {
    fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  }
  if (existing.includes(MARKER_BEGIN)) return false; // idempotent
  const block = [
    '',
    MARKER_BEGIN,
    '# cc-token-saver: disables Claude Code built-in git instructions',
    '# to save ~2200 tokens per session. Remove this block to revert.',
    'export CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1',
    MARKER_END,
    '',
  ].join('\n');
  const needsLeadingNewline = existing.length > 0 && !existing.endsWith('\n');
  const newContent = existing + (needsLeadingNewline ? '\n' : '') + block;
  const tmp = profilePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, newContent);
  fs.renameSync(tmp, profilePath);
  return true;
}

// Aggressive cleanup: remove our marker block AND any other
// CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS export lines (per explicit revert intent).
function removeFromShellProfile(profilePath) {
  if (!fs.existsSync(profilePath)) {
    return { removed: [], backupPath: null };
  }
  const content = fs.readFileSync(profilePath, 'utf8');
  const lines = content.split('\n');
  const removed = [];
  const kept = [];
  let inMarkerBlock = false;

  for (const line of lines) {
    if (line.includes(MARKER_BEGIN)) {
      inMarkerBlock = true;
      removed.push({ line, reason: 'marker block' });
      continue;
    }
    if (line.includes(MARKER_END)) {
      inMarkerBlock = false;
      removed.push({ line, reason: 'marker block' });
      continue;
    }
    if (inMarkerBlock) {
      removed.push({ line, reason: 'marker block' });
      continue;
    }
    // Aggressive: also remove any export line for this env var (not in marker)
    if (/^\s*export\s+CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS\s*=/.test(line)) {
      removed.push({ line, reason: 'pre-existing export (removed per explicit revert)' });
      continue;
    }
    kept.push(line);
  }

  if (removed.length === 0) {
    return { removed: [], backupPath: null };
  }

  // Backup before modifying
  const backupPath = profilePath + '.cc-token-saver-backup.' + Date.now();
  fs.copyFileSync(profilePath, backupPath);
  // Preserve the original file's trailing-newline state to avoid tripping
  // shell-profile lint warnings or tools that rely on terminating newline.
  const trailingNewline = content.endsWith('\n') ? '\n' : '';
  const tmp = profilePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, kept.join('\n').replace(/\n$/, '') + trailingNewline);
  fs.renameSync(tmp, profilePath);

  return { removed, backupPath };
}

module.exports = {
  // paths
  GLOBAL_SETTINGS_PATH,
  PREFS_PATH,
  MARKER_BEGIN,
  MARKER_END,
  // prefs
  readPrefs,
  writePrefs,
  isRecommendationDismissed,
  setRecommendationDismissed,
  // settings
  readSettingsInclude,
  setSettingsInclude,
  // env + effective state
  resolveEnvVar,
  computeEffectiveState,
  shouldInjectReplacement, // preferred: for runtime hook gating
  ourMarkerPresent,        // for status/orphan detection
  isInstalled,             // back-compat alias
  getRecommendationTip,    // single source of truth for the tip string
  // shell profile
  detectShellProfile,
  hasMarkerBlock,
  addMarkerBlock,
  removeFromShellProfile,
};
