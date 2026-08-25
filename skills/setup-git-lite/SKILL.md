---
name: setup-git-lite
description: 'Disable Claude Code built-in git instructions and inject a curated 280-tok minimum via SessionStart hook. Saves ~2,200 tok/session + ~1,700 tok/call.'
when_to_use: |
  AI may auto-invoke for SAFE subcommands only — dismiss-banner, undismiss-banner, status, help.
  AI MUST NOT auto-invoke DESTRUCTIVE subcommands — install, revert.
  Destructive subcommands require the user to explicitly type the slash command.
---

Manage Claude Code's built-in `includeGitInstructions` token consumption.

## Subcommand routing

Parse the first argument from `$ARGUMENTS`:

| Subcommand | Risk | AI-allowed | Behavior |
| ---------- | ---- | ---------- | -------- |
| `install`   | 🔴 destructive | ❌ user-only | Modifies ~/.claude/settings.json + shell profile. Requires explicit `<command-name>super-token-saver:setup-git-lite</command-name>` tag with `<command-args>install</command-args>` |
| `revert`    | 🔴 destructive | ❌ user-only | Aggressive cleanup. Same gating as install |
| `status`    | 🟢 safe | ✅ allowed | Read-only diagnostic |
| `dismiss-banner`   | 🟢 safe | ✅ allowed | Suppresses the recommendation banner (preferences.json flag) |
| `undismiss-banner` | 🟢 safe | ✅ allowed | Re-enables the banner |
| `help`      | 🟢 safe | ✅ allowed | Prints usage |
| (empty)     | 🟢 safe | ✅ allowed | Run `status`, then append one-line usage hint: "Subcommands: install, revert, status, dismiss-banner, undismiss-banner, help" |

## Invocation guard — enforce for destructive subcommands only

If the subcommand is `install` or `revert`:

1. **Verify explicit invocation**: the triggering user message MUST contain `<command-name>super-token-saver:setup-git-lite</command-name>` along with `<command-args>install</command-args>` (or `revert`). If these tags are absent (i.e., you inferred the intent from natural-language context), STOP and respond:

   > "This action modifies your global Claude Code settings and shell profile. Please invoke explicitly by typing `/setup-git-lite install` (or `revert`)."

2. **User confirmation before execution**: even when the tag is present, print a one-line summary and ask for a literal "yes":

   > "Install will:
   >   - Set `includeGitInstructions: false` in ~/.claude/settings.json
   >   - Append a marker block to your shell profile exporting CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1
   > Proceed? (type yes to confirm)"

   Only proceed on a literal `yes`. Any other response — cancel.

Safe subcommands (`status`, `dismiss-banner`, `undismiss-banner`, `help`) skip the guard entirely.

## Execution

After (if required) passing the guard + confirmation, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/setup-git-lite.js <subcommand>
```

Relay stdout verbatim to the user. On non-zero exit, surface stderr.

## Language

Detect the user's language from the conversation. Translate ALL user-facing output into that language. The script outputs English — you MUST translate before relaying. Keep technical identifiers verbatim (file paths, env var names, command names, setting keys).

## Output conventions

- `status`: translate stdout into the user's language, then relay.
- `install`: translate stdout, then add a **short** line pointing to README for the rationale.
- `revert`: translate stdout, then note "Your current shell env may still have the variable set — restart the shell or run `unset CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`." (in the user's language).
- `dismiss`/`undismiss`: translate stdout, then relay.
- `help`: translate stdout, then relay.

## Error handling

- Exit code 1 (general error): print stderr, suggest running `status`.
- Exit code 2 (unknown subcommand): surface the hint from the script, no further work.

## Design reference

The hook content and behavior are documented in the super-token-saver README (Git instructions section). Key points for the user if they ask:

- Original CC built-in injects ~2,200 tokens per session (git status snapshot + full commit/PR workflow).
- Our replacement is ~280 tokens (11 override rules + compact git state line with file list).
- 88% token reduction, 95%+ of the safety rules preserved.
- Other style/workflow guidance is dropped because Claude's training already covers it (e.g., PR title conventions, HEREDOC format awareness, gh usage).
