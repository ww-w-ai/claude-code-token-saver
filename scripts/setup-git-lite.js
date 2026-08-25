#!/usr/bin/env node
/**
 * setup-git-lite.js — subcommand dispatcher for /setup-git-lite skill.
 *
 * Subcommands:
 *   install     Disable CC's built-in git instructions and enable our hook.
 *               Modifies ~/.claude/settings.json.
 *   revert      Restore default (removes includeGitInstructions from settings).
 *   status      Read-only diagnostic of current state.
 *   dismiss-banner     Suppress the random recommendation banner.
 *   undismiss-banner   Re-enable the recommendation banner.
 *   help        Print usage summary.
 *
 * Output: human-readable to stdout. Exits non-zero on user error.
 */

const state = require('./lib/git-lite-state');

function log(msg) { process.stdout.write(msg + '\n'); }
function err(msg) { process.stderr.write(msg + '\n'); }

function cmdStatus() {
  const eff = state.computeEffectiveState();
  const dismissed = state.isRecommendationDismissed();

  log('super-token-saver setup-git-lite — status');
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
  log('Recommendation banner: ' + (dismissed ? 'dismissed' : 'enabled'));

  log('');
  log('Next step:');
  if (eff.effective) {
    log('  Run `/setup-git-lite install` to disable native and enable our minimal hook.');
  } else {
    log('  You are all set. Run `/setup-git-lite revert` to restore defaults anytime.');
  }
  log('');
  log('Subcommands: install, revert, status, dismiss-banner, undismiss-banner, help');
}

function cmdInstall() {
  log('Installing setup-git-lite...');

  const before = state.readSettingsInclude();
  state.setSettingsInclude(false);
  log('✓ settings.json: includeGitInstructions = false (was ' +
    (before === undefined ? 'unset' : JSON.stringify(before)) + ')');

  log('');
  log('Done. Run `/setup-git-lite status` to verify.');
  log('See README for how the minimal replacement works.');
  log('');
  log('⚠️  Before uninstalling super-token-saver, run `/setup-git-lite revert` first.');
  log('    Otherwise the settings remain but our replacement hook is gone.');
}

function cmdRevert() {
  log('Reverting setup-git-lite...');

  const before = state.readSettingsInclude();
  if (before !== undefined) {
    state.setSettingsInclude('remove');
    log('✓ settings.json: removed includeGitInstructions key (was ' + JSON.stringify(before) + ')');
  } else {
    log('• settings.json: no includeGitInstructions key (nothing to remove)');
  }

  log('');
  log('Done. CC will use its built-in git instructions again from the next session.');
}

function cmdDismiss() {
  state.setRecommendationDismissed(true);
  log('✓ Recommendation banner dismissed.');
  log('  You will not see the occasional /setup-git-lite recommendation anymore.');
  log('  Re-enable anytime with `/setup-git-lite undismiss-banner`.');
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
  log('              and enable super-token-saver\'s minimal replacement hook.');
  log('              Modifies: ~/.claude/settings.json.');
  log('');
  log('  revert      Restore CC default behavior.');
  log('              Removes includeGitInstructions from settings.json.');
  log('');
  log('  status      Show current effective state (read-only).');
  log('');
  log('  dismiss-banner     Suppress the occasional recommendation banner.');
  log('  undismiss-banner   Re-enable the recommendation banner.');
  log('');
  log('  help        Print this help.');
  log('');
  log('Trade-offs and details: see super-token-saver README (Git instructions section).');
}

// ── Dispatch ────────────────────────────────────────────────────
const sub = process.argv[2] || 'status';
try {
  switch (sub) {
    case 'install': cmdInstall(); break;
    case 'revert': cmdRevert(); break;
    case 'status': cmdStatus(); break;
    case 'dismiss-banner': cmdDismiss(); break;
    case 'undismiss-banner': cmdUndismiss(); break;
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
