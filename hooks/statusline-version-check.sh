#!/bin/bash
# statusline-version-check.sh — Auto-patch statusline path on plugin update
#
# Registered as SessionStart hook (hooks.json). Runs once per session.
# If settings.json statusLine points to an older claude-code-token-saver version,
# silently patches it to ${CLAUDE_PLUGIN_ROOT} (current version).
#
# Zero LLM involvement. No stdout output (silent).

SETTINGS="$HOME/.claude/settings.json"
[ ! -f "$SETTINGS" ] && exit 0

EXPECTED_CMD="${CLAUDE_PLUGIN_ROOT}/scripts/statusline-logger.sh"
[ -z "$CLAUDE_PLUGIN_ROOT" ] && exit 0

node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$SETTINGS', 'utf8'));
const current = settings.statusLine && settings.statusLine.command;
if (!current) process.exit(0);
if (!current.includes('claude-code-token-saver') || !current.endsWith('statusline-logger.sh')) process.exit(0);
if (current === '$EXPECTED_CMD') process.exit(0);
settings.statusLine.command = '$EXPECTED_CMD';
fs.writeFileSync('$SETTINGS', JSON.stringify(settings, null, 2) + '\n');
" 2>/dev/null
