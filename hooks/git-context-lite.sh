#!/bin/bash
# git-context-lite.sh — SessionStart hook.
#
# Two independent behaviors, both gated by super-token-saver preferences:
#
# 1) If CC's built-in git instructions are disabled (via settings.json OR
#    env var), inject a ~280 tok minimal replacement (static commit rules
#    + dynamic git state) so Claude still has safety guardrails and current
#    branch/status awareness.
#
# 2) If CC's built-in git instructions are ENABLED and the user hasn't
#    dismissed the banner, show a 20% random recommendation to run
#    `/setup-git-lite install`.
#
# CC wraps the stdout in <system-reminder>...</system-reminder> automatically
# and prepends it as a user message (isMeta:true). Plain text output is fine —
# no JSON wrapping needed.
#
# Skip entirely for subagent contexts to avoid spamming (subagents bring
# their own SessionStart; we only want main-session injection).

set -eu

# ── Subagent guard via stdin JSON ───────────────────────────────
# CC passes hook metadata as JSON on stdin (utils/hooks.ts in CC source).
# agent_type present → subagent context; skip to avoid spam.
HOOK_INPUT=$(cat 2>/dev/null || printf '')
if [ -n "$HOOK_INPUT" ]; then
  SKIP=$(printf '%s' "$HOOK_INPUT" | node -e '
    let d="";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(d);
        if (j.agent_type) { process.stdout.write("1"); return; }
      } catch {}
      process.stdout.write("0");
    });
  ' 2>/dev/null || printf '0')
  [ "$SKIP" = "1" ] && exit 0
fi
if [ -n "${CLAUDE_CODE_REMOTE:-}" ]; then exit 0; fi

# ── State resolution via shared node lib ────────────────────────
# Returns a JSON line: {"installed":bool,"dismissed":bool}
if ! STATE_JSON=$(node -e "
  const s = require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/git-lite-state.js');
  process.stdout.write(JSON.stringify({
    installed: s.shouldInjectReplacement(),
    dismissed: s.isRecommendationDismissed(),
  }));
" 2>/dev/null); then
  # State lib failed (plugin path issue, node missing) — fail silent
  exit 0
fi

INSTALLED=$(printf '%s' "$STATE_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(String(JSON.parse(d).installed)))' 2>/dev/null)
DISMISSED=$(printf '%s' "$STATE_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(String(JSON.parse(d).dismissed)))' 2>/dev/null)

# ── Branch A: Installed → inject minimal replacement ────────────
if [ "$INSTALLED" = "true" ]; then
  cat <<'STATIC_EOF'
## Git essentials (super-token-saver minimum ruleset — replaces CC built-in)

### Never without explicit user request
- Commit, push, amend, create a PR, tag, or merge
- Skip hooks (--no-verify, --no-gpg-sign)
- Destructive ops (git reset --hard, checkout ., clean -f, branch -D, restore .)
- Force push to main/master (warn if requested; feature branches OK on request)
- Modify git config

### Secrets & safety
- Never commit files matching .env, credentials, *.pem, secret.*
  without explicit user approval
- Avoid `git add -A` / `git add .` — stage files by name

### When committing (on user's request)
- Commit message: focus on WHY not WHAT (1-2 sentences)
- Pass multi-line messages via HEREDOC to preserve formatting
- Append Co-Authored-By: Claude trailer
- Never use interactive flags (-i)
- If pre-commit hook fails, create a NEW commit (don't --amend)
- No empty commits (if nothing to commit, skip)
STATIC_EOF

  # Dynamic git state (only if in a git repo)
  if git rev-parse --git-dir >/dev/null 2>&1; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')
    HEAD_INFO=$(git log -1 --oneline 2>/dev/null || echo 'no commits yet')
    DIRTY=$(git status --porcelain 2>/dev/null || true)
    # Use wc -l on non-empty strings only; grep -c . returns 1 on clean repo
    # which, combined with set -e, can kill the script via $(...) subshell.
    if [ -z "$DIRTY" ]; then
      COUNT=0
    else
      COUNT=$(printf '%s\n' "$DIRTY" | wc -l | tr -d ' ')
    fi

    printf '\n### Git state at session start (snapshot; may be stale)\n'
    printf 'Branch: %s | HEAD: %s\n' "$BRANCH" "$HEAD_INFO"

    if [ "$COUNT" -eq 0 ]; then
      printf 'Status: clean\n'
    elif [ "$COUNT" -le 20 ]; then
      printf 'Status (%s files):\n%s\n' "$COUNT" "$DIRTY"
    else
      TRUNCATED=$(printf '%s\n' "$DIRTY" | head -20)
      REMAINING=$((COUNT - 20))
      printf 'Status (%s files, showing 20):\n%s\n ... and %s more (run git status for full list)\n' \
        "$COUNT" "$TRUNCATED" "$REMAINING"
    fi
  fi
  exit 0
fi

# ── Branch B: Not installed → maybe show recommendation (20% random) ─
if [ "$DISMISSED" = "true" ]; then
  exit 0
fi

# Random 20% — awk for portable random
RAND=$(awk 'BEGIN{srand();print int(rand()*100)}')
if [ "$RAND" -ge 20 ]; then
  exit 0
fi

# Locale-aware short tip — pulls from locales/{LANG}.json via shared lib.
# Returns English fallback if the locale file is missing/unreadable.
TIP=$(node -e "
  const s = require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/git-lite-state.js');
  const t = s.getRecommendationTip();
  if (t) process.stdout.write(t);
" 2>/dev/null)

if [ -n "$TIP" ]; then
  printf '💡 %s\n' "$TIP"
fi
