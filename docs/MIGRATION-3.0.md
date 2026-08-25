# Migrating to super-token-saver 3.0

The plugin was `claude-code-token-saver` through 2.5.0. It now runs on Claude Code AND Codex, so a
name claiming one host was telling half its users the product was not for them.

Nothing about how it works changed in 3.0. Only names did.

## What changed

| Was | Is |
|---|---|
| plugin `claude-code-token-saver` | `super-token-saver` |
| `/cc-continue` | `/s-continue` |
| `/cc-compact` | `/s-compact` |
| `github.com/ww-w-ai/claude-code-token-saver` | `github.com/ww-w-ai/super-token-saver` |
| `~/.claude/claude-code-token-saver-data/` | `~/.claude/super-token-saver-data/` |

`usage-view`, `report-limit`, `setup-statusline` and `setup-git-lite` keep their names — they never
claimed a host.

## What you have to do

A plugin's name is its **install identity**, so this is not an upgrade you receive — you reinstall.

Claude Code:

```
claude plugin remove claude-code-token-saver
claude plugin marketplace update ww-w-ai
claude plugin install super-token-saver@ww-w-ai
```

Codex:

```
codex plugin remove claude-code-token-saver
codex plugin marketplace upgrade ww-w-ai
codex plugin add super-token-saver@ww-w-ai
```

Then type `/s-continue` where you used to type `/cc-continue`. The old command is gone rather than
deprecated: a skill that answers to a name the product no longer has invites the assumption that
the old name still works everywhere, which it does not.

## Your cached sessions move themselves

`~/.claude/claude-code-token-saver-data/` holds every `compact.txt` this plugin has built and any
`handoff.md` you wrote. On first run the new version **renames** that directory to
`~/.claude/super-token-saver-data/` — a rename, not a copy, so a large cache is not duplicated and
nothing is re-derived. This is the same mechanism that carried the cache through three earlier
renames; `scripts/lib/cache-paths.js` lists them all.

If you had already started the new version before reading this, the move has happened. Check with
`ls ~/.claude/super-token-saver-data/`.

## If you kept a statusline

`/setup-statusline` writes an absolute path into your `settings.json`, and that path contains the
old plugin name. Re-run `/setup-statusline` after reinstalling, or the status line silently stops
updating — the hook is still registered, it just points at a directory that no longer exists.

## What did NOT change

Cache format, transcript handling, the compact-format version, pricing data, and every skill's
behaviour. `CHANGELOG.md` entries from before 3.0 keep the names they shipped under; they are
history and were not rewritten.
