# /cc-compact

Write a **session handoff** for the next session — the write-side pair of `/cc-continue`.

## Usage

```
/cc-compact          # generate the handoff, save it, print it, copy to clipboard
/cc-compact help     # usage
```

Pairs with `/cc-continue`: **end a session with `/cc-compact`, start the next with `/cc-continue`.**

## Why it exists

`/cc-continue` restores the transcript — the messages you and Claude exchanged. But a working
session's most useful knowledge often lives OUTSIDE that dialogue:

- **Subagent findings** — subagent transcripts are separate files the restorer never loads.
- **Decisive numbers in tool output** — a test count, a benchmark, a grep result.
- **Lessons from the process** — "couldn't reproduce headless → it was the build, not the code."

`/cc-compact` distills exactly those into a handoff, so the next session doesn't re-derive them.

## How It Works

1. Accounts for processes this session spawned (hand off the ones the next session reuses; reclaim one-offs).
2. Composes a six-part handoff: read-first pointers · entry state + verify · this-session-done ·
   **non-dialogue distillation** (the heart) · next-session work (paste-ready) · first move.
3. Saves it to `~/.claude/claude-code-token-saver-data/<project>/handoff.md` — the exact path
   `/cc-continue` auto-loads.
4. Copies it to the clipboard (macOS `pbcopy`) and prints it in the conversation.

The handoff is **ephemeral and per-project** — it is never committed to the repo. Truth stays in
source (plan docs, as-built, commits); the handoff points to those and only writes out facts that
live nowhere but a tool result or a subagent reply.

## The pair

| | |
|---|---|
| End of session | `/cc-compact` — write the handoff |
| Start of next session | `/cc-continue` — restore transcript **+ auto-load the handoff** |
