# Rename: claude-code-token-saver → super-token-saver

Decided 2026-08-25. Not yet executed — the dual-host structure shipped first, deliberately.

## Why

The plugin now serves Claude Code and Codex from one tree, so a name that says "claude-code" tells a
Codex user the product is not for them. `super-` was chosen for the same reason `superpowers` and
`superdesign` read well: it is short, it is recognisable across the plugin ecosystem, and it keeps
`token-saver`, which is the part users already search for.

## What a rename actually costs

The name is the **install identity**: the marketplace key, the GitHub repository, and the directory
under both hosts' plugin caches. An installed user does not get an upgrade — they get nothing, until
they remove the old plugin and add the new one. That is the reason this is a release-sized job and
not an edit.

## Surfaces (all must move in one release)

| Surface | Where |
|---|---|
| Claude Code manifest | `.claude-plugin/plugin.json` → `name` |
| Codex manifest | `.codex-plugin/plugin.json` → `name`, `interface.displayName` |
| Marketplace manifest | `manifest.json` → `name` |
| Parity gate | `scripts/test_product_parity.py` → the `codex plugin add …@ww-w-ai` line |
| Codex READMEs | `README-CODEX.md` + `.ko` `.ja` `.zh-Hans` — title and install command |
| READMEs | `README.md` + 22 locales — title, install command, badges, repo links |
| CHANGELOG | rename entry + a migration note for existing users |
| Marketplace repo (CC) | `.claude-plugin/marketplace.json` → entry name + git URL |
| Marketplace repo (Codex) | `.agents/plugins/marketplace.json` → entry name, and the vendored copy under `plugins/<name>/` |
| GitHub | rename `ww-w-ai/claude-code-token-saver` (GitHub redirects the old URL, so existing clones keep working) |
| Skill directories | `skills/cc-continue` → `skills/s-continue`, `skills/cc-compact` → `skills/s-compact` |
| Skill frontmatter | each renamed `SKILL.md` → `name:`, and every `/cc-…` string in its own body |
| Cross-references | the two skills name each other; `README.md` + 22 locales, `README-CODEX.*`, `CLAUDE.md`, `CHANGELOG.md` |
| Parity gate | `scripts/test_product_parity.py` → `EXPECTED_SKILLS` and `DUAL_HOST_SKILLS` |
| Plugin keywords | `.claude-plugin/plugin.json` lists `cc-continue`/`cc-compact` as search keywords |
| Cache dir | `~/.claude/claude-code-token-saver-data/` — see the decision below |

`docs/CONVENTION.md` §3 owns the release-surface list; update it in the same change.

## Skill names — decided

`cc-continue` / `cc-compact` carry the Claude Code initials into a product that now serves both
hosts, so they move with the plugin:

| Now | After |
|---|---|
| `/cc-continue` | `/s-continue` |
| `/cc-compact` | `/s-compact` |

The `s-` prefix is the plugin's own initial, so it reads the same on either host and stays short
enough to type. Renaming a skill breaks a user's typed command exactly the way the plugin rename
breaks their install, which is why both happen in ONE release rather than in sequence.

The three Claude Code-only skills (`usage-view`, `report-limit`, `setup-statusline`) keep their
names — they are not part of the dual-host surface and their names never claimed a host.

## One decision still open

1. **The cache directory.** `~/.claude/claude-code-token-saver-data/` holds every user's existing
   `compact.txt` and their `handoff.md`. Moving it means a migration step like the one
   `scripts/lib/cache-paths.js` already performs for three earlier names — that helper is the place
   to add it, and it must be a rename, not a copy, so a large cache is not duplicated.

## Order

The plugin rename and the skill rename land in the SAME commit. Splitting them gives users two
separate breaks for one migration, and a release where `super-token-saver` still answers to
`/cc-continue` invites the assumption that the old names survived.

Do the rename as one commit per repo, plugin repo first, marketplace second, GitHub rename last —
the marketplace points at the git URL, so renaming the repository before the marketplace entry
leaves the listing pointing at a redirect for as long as it takes to push.
