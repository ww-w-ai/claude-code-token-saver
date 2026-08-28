#!/bin/bash
# SessionStart(source=compact) — tell the model to restore what compaction dropped.
#
# Auto-compact keeps the session id and keeps writing the SAME transcript, so the pre-compact
# turns are still on disk; the model just cannot see them any more. The compact summary is a
# paraphrase, and during an autonomous run (cowork-sprint, pdca-wf, a Workflow) that is not
# enough — decisions, measured numbers and file:line anchors get flattened out of it.
#
# This hook does NOT restore anything itself. It emits one instruction: run the s-continue skill.
# That skill already owns the whole job (find the session, preprocess, filter to the pre-boundary
# turns, read them in chunks, optional topic-based original restoration), and it is maintained.
# Reimplementing any of it here means two copies that drift — which already happened once: this
# hook derived the cache path differently from the skill and died silently for months.
#
# It DOES pass the session id through. Auto-compact keeps the same session id and keeps writing
# the same transcript, so the payload's id names the exact session to restore. (/clear differs:
# it starts a NEW transcript under a new id, and the /clear invocation is recorded at the top of
# that new file — measured, 17 of 17 occurrences in this project.)
# The skill's `last` cannot be trusted to find it on its own: list-sessions picks "current" by
# smallest lastMsgAgeSeconds, so with two sessions open in one project folder it lands on
# whichever wrote most recently — which may be the other one.
#
# additionalContext is the ONLY compaction-adjacent hook output Claude Code feeds back to the
# model. PostCompact cannot do this: it is absent from the hookSpecificOutput union, so its
# output only reaches the display.
#
# Fails open. Any error prints nothing and exits 0 — a broken hook must never block a session.

set -uo pipefail

payload="$(cat)"
[ -n "$payload" ] || exit 0

python3 - "$payload" <<'PY' 2>/dev/null
import json, sys

try:
    d = json.loads(sys.argv[1])
    if d.get("source") != "compact":
        sys.exit(0)
except Exception:
    sys.exit(0)

sid = d.get("session_id") or ""

# With an id, name the target outright. Without one, fall back to the skill's own auto-pick.
how = (
    f"""**Before your first substantive action, invoke the s-continue skill and restore session
`{sid}` at a level of your choosing.** That is this session: auto-compact keeps the id and keeps
writing the same transcript. Pick it from the list the skill prints; do not pass `last`, which
resolves "current" by whichever transcript was written most recently and lands on the wrong one
when two sessions share a project folder."""
    if sid else
    """**Before your first substantive action, invoke the s-continue skill with the argument
`last` and a level of your choosing.** It auto-picks a compacted current session, so it runs
without asking the user anything."""
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": f"""# This session was just compacted \u2014 restore the lost turns first

The summary above is a paraphrase. The ACTUAL pre-compact user and assistant turns are still on
disk in this session's own transcript, and the s-continue skill reads them back verbatim at no
LLM cost.

{how}

Then prefer those turns over the summary wherever they disagree, and do NOT re-derive findings
that appear in them. If you were mid-run on an autonomous task (cowork-sprint, pdca-wf, a
Workflow), resume from them rather than re-planning.

## Pick a level \u2014 the choice is which one, not whether

`--level 1|2|3`. **After auto-compact, level 1 is the right answer here.** A summary is already in
context; what you are missing is the actual thread \u2014 what the user asked, in their words, and
what you answered. Level 1 gives the last 30 user turns with every reply under them, shortened:
about 6 K tokens.

Nothing is discarded at any level. Long messages are cut and the middle of a long turn drops to
50 characters, but every turn and every reply is present, and the `-> N AI responses at lines X-Y`
pointer above each turn locates the originals in the transcript. Read one back in full the moment
a 50-character line turns out to matter.

The levels differ in width, then in reach:
- **2** \u2014 same 30 turns, wider. Full stored width for the user message and the replies at each
  end. Take it when a 100-character reply preview is too thin to resume on.
- **3** \u2014 every turn in the session, not just the last 30. Take it when the work depends on
  early-session decisions, or the user asks for a full restore.

Starting at 1 and reading one range back is cheaper than starting at 3.

**Do not skip the restore.** The only case for skipping is the user\u2019s own next message changing the
subject entirely, and even then say so in one line rather than silently proceeding on the summary.""",
    }
}))
PY
exit 0
