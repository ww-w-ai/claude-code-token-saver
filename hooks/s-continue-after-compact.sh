#!/bin/bash
# SessionStart(source=compact) — put back what compaction dropped, without asking the model to.
#
# Auto-compact keeps the session id and keeps writing the SAME transcript, so the pre-compact
# turns are still on disk; the model just cannot see them any more. The compact summary is a
# paraphrase, and during an autonomous run (cowork-sprint, pdca-wf, a Workflow) that is not
# enough — decisions, measured numbers and file:line anchors get flattened out of it.
#
# This hook USED to emit an instruction telling the model to run the s-continue skill. That was
# not enough: the instruction landed in context, said "there is no exception", and was skipped
# anyway — measured, in a real autonomous run. An instruction the model may decline is not a
# guarantee. So the hook now does the restore itself and injects the RESULT. There is nothing
# left to comply with.
#
# It calls scripts/restore.js, which owns the level slicing and is the same code path the
# s-continue skill uses. The slicing is NOT reimplemented here: a second copy is exactly how this
# hook once derived a cache path nothing wrote and died silently for months.
#
# Level 1 is forced. Compaction happens because context ran short, so refilling it is a cost that
# must stay bounded: level 1 is the last 30 user turns with every reply present but shortened —
# nothing is discarded, and the `-> N AI responses at lines X-Y` pointers locate the originals.
# If more is needed the model can call the skill for level 2 or 3 on its own.
#
# additionalContext is the ONLY compaction-adjacent hook output that reaches the model. On Claude
# Code, PostCompact is absent from the hookSpecificOutput union. On Codex, PostCompact returns a
# StatelessHookOutcome with no context field, while SessionStart carries additional_contexts —
# so SessionStart(source=compact) is the one event that works on both.
#
# Fails open, always. Any failure falls back to the old instruction text, and any error at all
# prints nothing and exits 0 — a broken hook must never block a session.

set -uo pipefail

payload="$(cat)"
[ -n "$payload" ] || exit 0

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTORE="${HERE}/../scripts/restore.js"

python3 - "$payload" "$RESTORE" <<'PY' 2>/dev/null
import json, os, subprocess, sys

try:
    payload = json.loads(sys.argv[1])
    if payload.get("source") != "compact":
        sys.exit(0)
except Exception:
    sys.exit(0)

restore_js = sys.argv[2]
sid = payload.get("session_id") or ""
transcript = payload.get("transcript_path") or ""


def restored():
    """The pre-compact turns at level 1, or None if anything at all went wrong."""
    if not transcript or not os.path.isfile(transcript):
        return None
    try:
        run = subprocess.run(
            ["node", restore_js, transcript, "--level", "1", "--before-boundary"],
            capture_output=True, text=True, timeout=30,
        )
    except Exception:
        return None
    if run.returncode != 0:
        return None
    text = run.stdout.strip()
    # An empty restore is a failure, not a result: announcing one that carried
    # nothing is worse than falling back to asking for it.
    return text if text else None


def instruction():
    """Fallback: ask for the restore, naming the session when we know it."""
    how = (
        f"""**Before your first substantive action, invoke the s-continue skill and restore session
`{sid}` at level 1.** That is this session: auto-compact keeps the id and keeps writing the same
transcript. Pick it from the list the skill prints; do not pass `last`, which resolves "current"
by whichever transcript was written most recently and lands on the wrong one when two sessions
share a project folder."""
        if sid else
        """**Before your first substantive action, invoke the s-continue skill with the argument
`last --level 1`.** It auto-picks a compacted current session, so it runs without asking the user
anything."""
    )
    return f"""# This session was just compacted — the automatic restore did not run

The restore that normally runs here failed, so the pre-compact turns are NOT in context. The
summary above is a paraphrase written by a model, and a paraphrase of an instruction is not that
instruction: standing orders ("keep going until morning", "do not narrow the scope"), the exact
wording of a decision, and the numbers behind a finding are precisely what it flattens.

{how}

Then prefer those turns over the summary wherever they disagree, and do NOT re-derive findings
that appear in them. If you were mid-run on an autonomous task, resume from them rather than
re-planning."""


def delivered(text):
    """The restored turns, framed so they are not mistaken for a new request."""
    return f"""# Restored: the turns this session lost to compaction

Everything below was read back from this session's own transcript on disk. It is the real
conversation — the user's own words and your own replies — not a summary and **not a new request**.
Nothing here is the user asking for something now.

Prefer it over the compact summary wherever the two disagree, and do NOT re-derive findings that
already appear in it. If you were mid-run on an autonomous task (cowork-sprint, pdca-wf, a
Workflow), resume from these turns rather than re-planning. Standing orders stated here still
govern the work.

This is level 1: the last 30 user turns, every reply present but shortened — long messages are
cut and mid-turn replies drop to 50 characters. Nothing was discarded. The
`-> N AI responses at lines X-Y` line above each turn locates the originals in the transcript, so
read a range back the moment a shortened line turns out to matter. For a wider or longer restore,
invoke the s-continue skill at level 2 or 3.

---

{text}"""


text = restored()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": delivered(text) if text else instruction(),
    }
}))
PY
exit 0
