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
const PREFS_DIR = path.join(HOME, '.claude', 'super-token-saver-data');
const PREFS_PATH = path.join(PREFS_DIR, 'preferences.json');

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

// ── Effective state resolution ─────────────────────────────────
function computeEffectiveState() {
  const settingValue = readSettingsInclude();
  const effective = settingValue === false ? false : true;
  const source = typeof settingValue === 'boolean' ? 'settings.json' : 'default';
  return { effective, source, settingValue };
}

// ── Runtime gating & install state ─────────────────────────────
//
// `shouldInjectReplacement()` — runtime gate for the hook. True whenever CC's
// native git instructions are disabled by ANY mechanism (env, settings, etc.),
// regardless of whether WE disabled it or the user did manually.
function shouldInjectReplacement() {
  return computeEffectiveState().effective === false;
}

function isInstalled() { return shouldInjectReplacement(); }

// ── Recommendation tip string (single source of truth) ─────────
// Fallback in case the locale file is missing or unreadable.
const TIP_FALLBACK_EN =
  "Tip: CC's built-in git instructions consume ~2,200 tok/session + " +
  '~1,700 tok/call. `/setup-git-lite install` replaces them with a ' +
  'curated 280-tok minimum. `/setup-git-lite dismiss-banner` hides this tip.';

function getRecommendationTip(locale) {
  if (shouldInjectReplacement()) return null;
  if (isRecommendationDismissed()) return null;
  let resolved;
  try {
    const { resolveLocale } = require('./locale');
    resolved = resolveLocale(locale);
  } catch {
    resolved = 'en';
  }
  try {
    const localePath = path.join(__dirname, '..', '..', 'locales', `${resolved}.json`);
    const data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    if (data && data.gitLite && typeof data.gitLite.tip === 'string') {
      return data.gitLite.tip;
    }
  } catch { /* fall through to English fallback */ }
  return TIP_FALLBACK_EN;
}


module.exports = {
  // paths
  GLOBAL_SETTINGS_PATH,
  PREFS_PATH,
  // prefs
  readPrefs,
  writePrefs,
  isRecommendationDismissed,
  setRecommendationDismissed,
  // settings
  readSettingsInclude,
  setSettingsInclude,
  // effective state
  computeEffectiveState,
  shouldInjectReplacement,
  isInstalled,
  getRecommendationTip,
};
