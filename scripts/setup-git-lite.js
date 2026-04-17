#!/usr/bin/env node
/**
 * setup-git-lite.js — subcommand dispatcher for /setup-git-lite skill.
 *
 * Subcommands:
 *   install     Disable CC's built-in git instructions and enable our hook.
 *               Modifies ~/.claude/settings.json + shell profile.
 *   revert      Restore default. Aggressive cleanup (removes ANY
 *               CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS export from shell profile).
 *   status      Read-only diagnostic of current state.
 *   dismiss     Suppress the random recommendation banner.
 *   undismiss   Re-enable the recommendation banner.
 *   help        Print usage summary.
 *
 * Output: human-readable to stdout. Exits non-zero on user error.
 */

const state = require('./lib/git-lite-state');

function log(msg) { process.stdout.write(msg + '\n'); }
function err(msg) { process.stderr.write(msg + '\n'); }

function cmdStatus() {
  const eff = state.computeEffectiveState();
  const profilePath = state.detectShellProfile();
  const profileHasMarker = state.hasMarkerBlock(profilePath);
  const dismissed = state.isRecommendationDismissed();

  log('cc-token-saver setup-git-lite — status');
  log('');
  log('Effective state:       ' + (eff.effective
    ? 'CC native git instructions ENABLED (~2,200 tok/session in use)'
    : 'CC native git instructions DISABLED (our minimal hook active)'));
  log('Source of truth:       ' + eff.source);
  log('');
  log('Settings.json:         includeGitInstructions = ' +
    (eff.settingValue === undefined ? '(not set — default true)' : JSON.stringify(eff.settingValue)));
  log('  file: ' + state.GLOBAL_SETTINGS_PATH);
  log('');
  log('Shell profile:         ' + profilePath);
  log('  marker block:        ' + (profileHasMarker ? 'present (installed by us)' : 'absent'));
  log('  current env var:     CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=' +
    (process.env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS ?? '(unset)'));
  log('');
  log('Recommendation banner: ' + (dismissed ? 'dismissed' : 'enabled'));

  // Orphan detection: native is disabled but our marker is gone.
  // Usually means: user previously installed, then uninstalled the plugin
  // (or removed the marker manually) without running revert. Their Claude
  // now has no git guidance at all.
  const orphan = !eff.effective && !profileHasMarker &&
    eff.settingValue === false;
  if (orphan) {
    log('');
    log('⚠️  ORPHAN STATE DETECTED');
    log('    settings.json says includeGitInstructions=false, but our marker');
    log('    block is missing from the shell profile AND we cannot verify');
    log('    that cc-token-saver is still installed.');
    log('    Claude may have no git guidance at all in this state.');
    log('    Recommended: run `/setup-git-lite revert` to restore CC default,');
    log('    OR re-run `/setup-git-lite install` if you want our replacement.');
  }

  log('');
  log('Next step:');
  if (orphan) {
    log('  See ORPHAN STATE above.');
  } else if (eff.effective) {
    log('  Run `/setup-git-lite install` to disable native and enable our minimal hook.');
  } else {
    log('  You are all set. Run `/setup-git-lite revert` to restore defaults anytime.');
  }
}

function cmdInstall() {
  log('Installing setup-git-lite...');

  // 1) settings.json
  const before = state.readSettingsInclude();
  state.setSettingsInclude(false);
  log('✓ settings.json: includeGitInstructions = false (was ' +
    (before === undefined ? 'unset' : JSON.stringify(before)) + ')');

  // 2) shell profile
  const profilePath = state.detectShellProfile();
  const added = state.addMarkerBlock(profilePath);
  if (added) {
    log('✓ Shell profile: appended env export block');
    log('  path: ' + profilePath);
    log('  (takes effect in new shells; current shell unchanged)');
  } else {
    log('• Shell profile: already had our marker block (skipped)');
    log('  path: ' + profilePath);
  }

  log('');
  log('Done. Run `/setup-git-lite status` to verify.');
  log('See README for how the minimal replacement works.');
  log('');
  log('⚠️  Before uninstalling cc-token-saver, run `/setup-git-lite revert` first.');
  log('    Otherwise the settings remain but our replacement hook is gone.');
}

function cmdRevert() {
  log('Reverting setup-git-lite...');

  // 1) settings.json
  const before = state.readSettingsInclude();
  if (before !== undefined) {
    state.setSettingsInclude('remove');
    log('✓ settings.json: removed includeGitInstructions key (was ' + JSON.stringify(before) + ')');
  } else {
    log('• settings.json: no includeGitInstructions key (nothing to remove)');
  }

  // 2) shell profile (aggressive)
  const profilePath = state.detectShellProfile();
  const result = state.removeFromShellProfile(profilePath);
  if (result.removed.length > 0) {
    log('✓ Shell profile: removed ' + result.removed.length + ' line(s)');
    log('  path: ' + profilePath);
    log('  backup: ' + result.backupPath);
    for (const r of result.removed) {
      log('    - (' + r.reason + ') ' + r.line);
    }
  } else {
    log('• Shell profile: nothing to remove');
    log('  path: ' + profilePath);
  }

  // 3) warn if env var is still live in current shell
  if (process.env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS !== undefined) {
    log('');
    log('⚠️  Env var still active in CURRENT shell:');
    log('    CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=' +
      process.env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS);
    log('    Run in your current shell: `unset CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`');
    log('    New shells will be clean (profile already updated above).');
  }

  log('');
  log('Done. CC will use its built-in git instructions again from the next session.');
}

function cmdDismiss() {
  state.setRecommendationDismissed(true);
  log('✓ Recommendation banner dismissed.');
  log('  You will not see the occasional /setup-git-lite recommendation anymore.');
  log('  Re-enable anytime with `/setup-git-lite undismiss`.');
}

function cmdUndismiss() {
  state.setRecommendationDismissed(false);
  log('✓ Recommendation banner re-enabled.');
  log('  The banner will re-appear at ~20% probability per new session.');
}

function cmdHelp() {
  log('/setup-git-lite — manage Claude Code\'s built-in git instructions');
  log('');
  log('Usage: /setup-git-lite <subcommand>');
  log('');
  log('Subcommands:');
  log('  install     Disable CC\'s native git instructions (~2,200 tok/session saved)');
  log('              and enable cc-token-saver\'s minimal replacement hook.');
  log('              Modifies: ~/.claude/settings.json + shell profile.');
  log('');
  log('  revert      Restore CC default behavior. Aggressive cleanup:');
  log('              removes ANY CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS export');
  log('              from your shell profile (creates a backup first).');
  log('');
  log('  status      Show current effective state (read-only).');
  log('');
  log('  dismiss     Suppress the occasional recommendation banner.');
  log('  undismiss   Re-enable the recommendation banner.');
  log('');
  log('  help        Print this help.');
  log('');
  log('Trade-offs and details: see cc-token-saver README (Git instructions section).');
}

// ── Dispatch ────────────────────────────────────────────────────
const sub = process.argv[2] || 'help';
try {
  switch (sub) {
    case 'install': cmdInstall(); break;
    case 'revert': cmdRevert(); break;
    case 'status': cmdStatus(); break;
    case 'dismiss': cmdDismiss(); break;
    case 'undismiss': cmdUndismiss(); break;
    case 'help':
    case '--help':
    case '-h': cmdHelp(); break;
    default:
      err('Unknown subcommand: ' + sub);
      err('Run `/setup-git-lite help` for usage.');
      process.exit(2);
  }
} catch (e) {
  err('Error: ' + (e.message || e));
  process.exit(1);
}
