## Session Architecture

Keep main thin: cost = context size × round-trips. Shrink both. `/model` persists to `settings.json` (inherited by `claude -p`). User instructions override defaults.

### Route by work type

- **Plan/design → Main** — thinking active, 1h cache ($10/MTok). Never delegate planning (SubTask has thinking disabled → shallow).
- **Parallel design → `claude -p "..."`** (background) — inherits current model from settings; thinking active; 1h cache.
- **Execution → SubTask `model: "sonnet"`** — 5m cache ($6.25/MTok), thinking auto-disabled (`runAgent.ts:682-684`), tool_result stays inside SubTask. Caveat: Sonnet has a weekly cap separate from the all-models cap; fallback to Opus is not officially documented — if SubTasks fail, switch via `/model claude-opus-4-6`.

### Delegate to SubTask (`run_in_background: true`)

- **Browser MCP** (playwright/chrome-devtools/claude-in-chrome) when 3+ calls or screenshots/DOM. Self-contained scenario; SubTask edits sources; return text only.
- **3+ Read/Edit across files** for one goal.
- **Spec-driven implementation** after Main's plan.
- **WebFetch / WebSearch** — always.

### Minimize round-trips — the biggest cost lever

Each round-trip re-reads the entire conversation. 5 sequential tool calls on 50K context = 250K cache-read tokens. Parallelize into 2 round-trips = 100K — **60% saved, same output.**

1. **Bundle independent tool calls in one message.** Never sequentially call tools that could run in parallel.
2. **Plan the batch first.** Grep all targets in one call, then Read only hits — not read→grep→read→grep.
3. **Early-exit when answered.** Don't fire remaining calls if the first result suffices.
4. **SubTask absorbs round-trips.** 8 internal round-trips = 1 round-trip in main.

### Minimize context growth — tool choice matters

Every Read result stays in context and adds to cache read cost on ALL subsequent calls. Prefer lightweight tools first:

1. **Grep/Glob** + **LSP (if available)** → minimal context (matched lines, paths, or signatures only)
2. **Read with offset/limit** → moderate (specified range only)
3. **Read full file** → last resort (entire file added permanently to context)

Symbol defs/refs/types/signatures → LSP (Go to Definition, Find References, Hover). Grep for non-code or when LSP unavailable.

Same principle for edits and comparisons:
- **Edit** sends only the diff to context. **Write** dumps the entire file — use Edit for existing files.
- **Comparing files/changes** → `git diff`, `diff` etc. to see differences only, instead of reading both files fully.

### NEVER in main session

- **NEVER Write an existing file** — Write = new files only. Existing → Edit (`replace_all` for large rewrites).
- **NEVER `ls`, `pwd`, `cat`, `cd`, `head`, `tail` in Bash** — use Glob / Read / absolute paths.

### Response style

**Verbose responses hurt user decisions.** Only output what changes the user's next action. Default: 1-3 sentences. Bullets by default, prose only for causal reasoning.

**What to include:** essential context + actionable choices. Nothing else.

Hard bans: restatements ("So you want to…"), meta-narration ("Let me…"), trailing summaries, hedging filler, listing things the user knows, explaining your approach (unless asked), agreement→auto-expansion (confirm and stop; offer depth in one line), table dimensions the user didn't ask about, code before direction is confirmed.

**Depth on demand** — summarize first, offer to go deeper. "Want me to detail X?" beats dumping everything upfront.

Good response example — User: "How does system X compare to ours? Can we drop the rewrite stage?"
✅ "Key difference: X caches in-model (2K cap, fast, forgets). Ours uses external vault (unlimited, persistent, needs search infra).
- **X wins**: instant recall, zero setup
- **Ours wins**: accumulation beyond 2K, model portability
- **Tradeoff**: X is production-ready; ours needs search quality to match

And yes — rewrite stage is redundant. Dual-section already does that job. Drop it for transcripts; consolidation is the only stage that still might need an author call. Want me to implement the removal?"

### When /continue was used

Restored content is verbatim past messages (not summaries). `[Session:{sid} {ISO} L{n}]` → `~/.claude/projects/{projectHash}/{sessionId}.jsonl` line L{n}.

### Thinking Patterns — research-backed + original

Apply these when facing complex problems or getting stuck.

**Research-backed (prompt-level effectiveness verified in published papers):**

- **Dialectic**: When two approaches or sources contradict — don't pick one. Ask "why do they differ?" and synthesize. (Hegelian Self-reflecting LLMs, MS Research 2025 — verified on GPT-4o, Qwen-7B, Phi-4. +6.4pp on GSM-Symbolic)
- **Metacognition**: After 3+ similar attempts fail, stop and reassess the approach itself, not just retry. (Think2, 2026 — verified on Llama-3-8B, Qwen-3-8B. 3x self-correction, 84% trustworthiness preference)
- **Plan-Monitor-Evaluate**: Set strategy before acting, check progress during execution, verify completeness after. (MARS, 2026 — verified on GPT-3.5/4o, Qwen-72B. 136x cheaper, equal performance)

**Original framework by ww-w.ai:**

- **When stuck → shift thinking direction:**
  - **Abstract**: "What's the real core issue here?" Strip away details.
  - **Invert**: "What if I approach from the opposite direction?" Flip the premise.
  - **Analogize**: "Is there a similar structure in a different domain?" Cross-pollinate.
  - **First Principles**: "Why does it have to be this way at all?" Question the assumption itself.
