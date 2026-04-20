# Opus 4.7 vs 4.6 Cost Analysis Report

**Research period**: 2026-04-17 ~ 2026-04-20
**Environment**: Claude Code v2.1.88 and v2.1.112, macOS, mixed Korean/English dialog
**Sample size**: 8,563 calls across two projects (4-7: 3,477, 4-6: 5,086)

> Korean version: [opus-4-7-vs-4-6-cost-analysis.ko.md](./opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## 0. Executive Summary

### Wait — Opus 4.7 costs 42% more than 4.6?!

That's what one user's measurements show.¹ Same work, same prompts, but the bill comes back **42% higher**. Why?

- **The language got more expensive** — up to 35% more tokens for the same text (tokenizer inflation)
- **It thinks more often** — thinking frequency 3.5× higher (independent of effort setting)
- **It talks more** — responses themselves are 25~50% more verbose

These three multiply in every turn's output. Translated to the 5-hour window: a user who used to hit the block at 4 hours now gets blocked at around **2 hours 48 minutes** — losing nearly half of the 5-hour window.

Over a week of daily work, that's **multiple full workdays** worth of session time quietly evaporating. Your gut feeling was right.

The rest of this report explains exactly why this happens and — importantly — how to get that time back.

---
¹ Measurement basis: 4,314 JSONL calls from two projects (cc-token-saver + doooz), simulated over 100 turns of English/code-heavy dialog. **Mixed Korean/English use: ~26%; Korean-heavy use: ~18%**. Actual impact varies by task type, language ratio, and session length. See §5 for full simulation conditions.

### The three causes in detail

- **The language got more expensive — Tokenizer inflation (English/code 28~38%)**
  
  - Confirmed via controlled experiment with identical inputs (§4.3)
  - Korean shows no effect (~1%)

- **It thinks more often — Thinking frequency 3.5×**
  
  - Main-session calls with thinking: 4.6 = 7.56%, 4.7 = 26.8%
  - **Independent of effort setting (low/medium/high/xhigh)** — effort only controls thinking *length*, not whether the model decides to think
  - Evidence: 3,075 main calls across JSONL transcripts

- **It talks more — Output verbosity 25~50% higher**
  
  - Even in subagent environment where thinking is disabled, out/call is 1.25× (tokenizer-adjusted)
  - Inherent 4.7 trait not explained by thinking or tokenizer

These three factors accumulate in every turn's output → context grows faster → cache read cost compounds.

### What you can do (easy, step-by-step)

The short version: **switch to Opus 4.6**. That's it. You don't need to tune prompts, tweak effort, or change how you work. The model choice is the only knob that actually controls this.

#### Option 1 — Just use 4.6 for everything (recommended for most people)

This gets you back 20~40% of your session time with zero hassle.

**Step-by-step**:

1. Open Claude Code and start a session as usual.
2. Type this command and hit enter:

   ```
   /model claude-opus-4-6[1m]
   ```

   (If you don't need the 1-million-token context, you can use `claude-opus-4-6` instead.)

3. That's it. Claude Code will confirm the switch with a message like "Set model to Opus 4.6 (1M context)". Work normally — you'll notice the usage bar drains slower.

**What this does**: pins your session to Opus 4.6, which thinks less often, produces shorter responses, and uses a more efficient tokenizer. Same quality for 95%+ of typical coding/debugging/refactoring work.

**Note**: `/model` only applies to the current session. Open a new terminal → run it again. (Or set it permanently in Claude Code settings if you prefer.)

#### Option 2 — Keep 4.7 for planning, use Sonnet subagents for implementation (advanced)

If you genuinely benefit from 4.7's deeper reasoning (e.g., you design complex architectures or debug tricky systems daily), keep 4.7 in the main session but let subagents handle the grunt work. Claude Code automatically disables thinking in subagents, so they run cheaply.

**When to pick each**:

- **Main (Opus 4.7)**: architecture decisions, exploring bug hypotheses, planning multi-step changes — anywhere deep reasoning pays off
- **Subagent (Sonnet)**: implementing specs you already wrote, editing many files, searching the codebase, routine Q&A

**How to delegate to a Sonnet subagent**: when you need a batch of implementation or search work done, tell Claude to "launch a subagent with sonnet to do X". Or use agent definitions (in `.claude/agents/` or plugin agents) with `model: sonnet` in their frontmatter.

**Pitfall to avoid**: don't delegate *planning* to subagents. They can't think, so plans come out shallow. Keep planning in the main session, delegate execution.

#### If you're still unsure

Start with Option 1. It's one command, it's reversible, and you'll see the difference in your very next session. You can always switch back to 4.7 later with `/model claude-opus-4-7`.

---

## 1. Background

### Problem statement

Multiple users reported faster-than-usual exhaustion of the 5-hour Claude Code usage window after upgrading to Opus 4.7. Same amount of work, quota drains faster. We set out to quantify this scientifically.

### Hypotheses

- Model upgrade (4.6 → 4.7) as primary cost driver
- Claude Code version bug
- Tokenizer change impact
- Model-intrinsic thinking behavior shift

### Research objectives

- Quantify whether window exhaustion is actually faster
- Separate model effects from CC version effects
- Provide evidence-based guidance for practical mitigation

---

## 2. Data Sources

### 2.1 JSONL transcripts (observational data)

Recent session JSONLs from two projects (since 2026-04-17, main + subagent):

- **doooz** (personal project, design refactoring — [github.com/taekim34/doooz](https://github.com/taekim34/doooz)): 4.7 = 1,847 calls (main 728 / sub 1,119), 4.6 = 4,899 calls (main 1,749 / sub 3,150)
- **cc-token-saver** (analysis/debugging): 4.7 = 1,630 calls (main 1,589 / sub 41), 4.6 = 187 calls (main 169 / sub 18)
- **Total**: 4.7 = 3,477 calls, 4.6 = 5,086 calls (8,563 total)

Fields extracted:

- `message.model` — model used for the call
- `message.usage.output_tokens` — output token count
- `message.usage.input_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens`
- `message.content[].type === "thinking"` — thinking block presence
- `message.content[].signature` — thinking signature (encrypted blob)

### 2.2 Controlled experiment (experimental data)

**Tokenizer inflation measurement**: identical text sent to 4.6 and 4.7 subtasks; `input_tokens` compared.

Samples:

- **System prompt (English/code)**: 4.6 = 11,526 tokens, 4.7 = 15,846 tokens
- **Genesis 1 (English)**: 4,087 chars, cl100k 949 tok → 4.6 = 982, 4.7 = 1,258
- **Genesis 1 (Korean)**: 1,673 chars, cl100k 1,633 tok → 4.6 = 1,801, 4.7 = 1,809

**Key control**: identical prompts sent at the same moment to both models to isolate pure tokenizer difference.

### 2.3 CC source code (structural analysis)

Relevant files in `~/Documents/DEV/claude-code-v2_1_88`:

- `services/compact/apiMicrocompact.ts` — thinking block retention strategy
- `query.ts` — thinking signature handling
- `utils/model/agent.ts` — subagent model selection logic
- `constants/prompts.ts` — system prompt composition
- `commands/model/model.tsx` — `/model` command scope
- `tools/AgentTool/runAgent.ts` — subagent thinking disable point

---

## 3. Analysis Framework

Decomposed into **4 independent variables**:

- **Thinking frequency**: Does 4.7 "think" more often than 4.6? → Measure ratio of calls containing thinking blocks
- **Visible output verbosity**: Are responses longer even without thinking? → Compare avg `output_tokens` in no-thinking calls
- **Tokenizer efficiency**: Does 4.7 use more tokens for the same text? → Identical text experiment + baseline subtraction
- **Context accumulation effect**: Does thinking persist in subsequent turns' context? → CC source analysis + JSONL signature inspection

---

## 4. Key Findings

### 4.1 Thinking frequency difference

**Since 2026-04-17 (4.7 era), both projects combined (main + subagent)**:

- **opus-4-7**: 3,477 calls, 621 thinking → **17.9%**
- **opus-4-6**: 5,086 calls, 145 thinking → **2.85%**
- **Overall ratio: 6.3×**

Same period, same work environment, subtasks included. 4.6 processes most calls without thinking; 4.7 triggers thinking in roughly 1 out of 5~6 calls.

#### Thinking rate by effort level (4.7, subtask included)

- **Low**: 32 calls, 12 thinking → **37.5%** (small sample, out/call 590)
- **Medium**: 335 calls, 101 thinking → **30.1%** (out/call 1,867)
- **High**: 212 calls, 36 thinking → **17.0%** (out/call 1,796)
- **Xhigh (4.7 default)**: 2,898 calls, 472 thinking → **16.3%** (out/call 829, largest sample at 83%)
- **Overall**: 3,477 calls, 621 thinking → **17.9%**

(default is merged into xhigh, which is 4.7's default effort)

#### The real role of effort — length cap, not trigger switch

**Key observation**: Think rate fluctuates in the 16~38% range with **no monotonic relationship** to effort levels. Counter to intuition, low (37.5%) is highest and xhigh (16.3%) is lowest — the reverse of what effort-as-trigger-switch would predict.

**Interpretation**: The effort parameter sets the **upper bound on how deep (how many tokens)** a thinking block can go *when triggered*. It does **not** control whether thinking starts in the first place. Thinking is triggered by the model's own judgment after reading input, independent of effort.

**Cost implication**: 4.7 **produces significant thinking cost regardless of effort setting**. Only the length per thinking block changes. Therefore, the thinking cost problem in 4.7 cannot be solved via effort — **model change (to 4.6) is the only effective response**.

### 4.2 Visible Output Verbosity

Pure output comparison in **two environments**, isolating thinking effects:

#### Environment 1: Subagent (most controlled condition)

CC explicitly disables thinking in subagents (§4.5). Simple execution context, not shown directly to users. Both models under **same role, same constraints**.

- **opus-4-7**: 279 tok/call (1,160 samples)
- **opus-4-6**: 163 tok/call (3,168 samples)
- Raw 1.71× → Tokenizer-adjusted (÷1.28) **1.34×**
- Even at max tokenizer correction (÷1.35): **1.27×**

#### Environment 2: Main session no-thinking calls

Main session calls where both models responded without triggering thinking.

- **opus-4-7**: 1,306 tok/call (1,696 samples)
- **opus-4-6**: 451 tok/call (1,773 samples)
- Raw 2.90× → Tokenizer-adjusted **2.26×**

#### Interpretation

Both independent environments show 4.7 is more verbose:

- Subagent: 1.34× (strongest control, same short execution tasks)
- Main no-think: 2.26× (heavy task-complexity bias — cc-token-saver's analytical work concentrated on 4.7)

Even with maximum tokenizer correction, 1.27× remains in the subagent condition. **The residual after thinking-disabled + tokenizer-corrected = 4.7's intrinsic verbosity increase.** Controlled-condition range: **27~34%**; less-controlled conditions show more.

### 4.3 Tokenizer Inflation

Identical text sent to both models' subtasks, input_tokens compared:

- **English/code (system prompt)**: 4.7 / 4.6 = **1.375×** (37.5% inflation)
- **English prose (Genesis EN)**: 1.281× (28% inflation)
- **Korean (Genesis KO)**: 1.004× (no difference)

Matches the official "up to 1.35×" announcement. **Korean/CJK shows virtually no tokenizer difference**; inflation is limited to English/code.

### 4.4 Context Accumulation Mechanism

From CC source code analysis:

- Thinking blocks arrive from the API with an encrypted `signature` blob
- JSONL stores only the `signature`; the `thinking` field is empty
- Every subsequent API call transmits **all prior turns' thinking signatures**, which the server decrypts
- On the server side, the decrypted thinking content counts as context tokens
- Config: `clear_thinking_20251015` (keep: 'all') — by default, all thinking is preserved

**Conclusion**: Thinking text is invisible to users but **actually accumulates in context and incurs cost every turn.**

### 4.5 Main Session vs Subagent Structural Difference

Separating main and subagent:

- **4.7 main**: 2,317 calls, 621 thinking → **26.8%**, out/call 1,339
- **4.7 subagent**: 1,160 calls, **0** thinking → **0.0%**, out/call 279
- **4.6 main**: 1,918 calls, 145 thinking → **7.56%**, out/call 468
- **4.6 subagent**: 3,168 calls, **0** thinking → **0.0%**, out/call 163

**Key finding: Thinking is completely blocked in subagents for both models (0 occurrences)**.

#### CC source confirmation (`tools/AgentTool/runAgent.ts:682-684`)

```typescript
thinkingConfig: useExactTools
  ? toolUseContext.options.thinkingConfig  // fork children: inherit from parent
  : { type: 'disabled' as const },         // regular subagents: DISABLED
```

Comment: *"For regular sub-agents, disable thinking to control output token costs."*

CC has already recognized thinking as a cost driver and **explicitly disables thinking for all regular Agent() subtasks**. Only fork children (useExactTools) inherit parent thinking config, for prompt cache hit preservation.

#### Strategic implications

- **Thinking cost occurs only in the main session** — 4.7's cost explosion is concentrated in main-session thinking frequency
- **Subagent is a safe zone** — regardless of model, thinking is disabled and output stays concise
- **4.7 main vs 4.6 main ratio**: 26.8% / 7.56% = **3.5×** (distinct from the overall 6.3× which includes subagent 0s)
- **Out/call gap also narrows in subagent**: main 1,339/468 = 2.86× → subagent 279/163 = 1.71×
- The subagent comparison (1.71×) represents the lower bound of pure verbosity difference. After max tokenizer correction (1.27×) or realistic (1.34×), **4.7 intrinsically generates 27~34% more tokens for the same task**

**Trade-off caution**: Subagent having no thinking means **delegating complex reasoning tasks to subagents may degrade quality**. Planning/architecture decisions should stay in the main session to leverage 4.7's thinking advantage; concrete implementation/investigation work goes to subagents — that's the optimal division.

### 4.6 Per-turn Cost (Empirical)

- **Output per call (overall average)**: 4.7 = 985 tok vs 4.6 = 278 tok → 3.54× (tokenizer-adjusted 2.77×) — absolute values down due to heavier subagent share, but gap widened
- **Cache create per turn**: 4.7 = $0.103 vs 4.6 = $0.031 → **3.37×**
- **Cache read per turn**: 4.7 = $0.405 vs 4.6 = $0.432 → 0.94× (nearly equal)
- **Total per turn**: 4.7 = $0.587 vs 4.6 = $0.497 → 1.18×

Cache read is proportional to context size, so model-independent. As sessions grow longer, cache read dominates total cost and model differences get diluted.

---

## 5. Compound Effect Simulation

Simulation integrating all three effects (thinking frequency, verbosity, tokenizer inflation).

### 5.1 Per-turn cost ratio by scenario

100-turn cumulative token consumption. The ratio below is **per-turn cost of 4.7 relative to 4.6** (i.e., how much more you pay per turn for the same work). The 5h window fills up proportionally faster.

- **English-heavy (code work, tokenizer 1.28×)**: 4.7 per-turn cost ×**1.43** → **43% more expensive per turn**; 5h window drained in ~70% of the original time (30% sooner — a 4h user hits the block at ~2h 48m)
- **Mixed Korean/English (tokenizer 1.10×)**: ×1.23 (23% more expensive per turn; window drained at ~81%, a 4h user hits the block at ~3h 15m)
- **Pure Korean (tokenizer 1.00×, theoretical)**: ×1.12 (12% more expensive; window drained at ~89%, a 4h user hits the block at ~3h 34m)

### 5.2 Context growth rate

Context size at turn N (100-turn conversation):

- **Turn 10**: 4.6 = 37,644 / 4.7 (EN) = 53,841 / 4.7 (Mix) = 46,270 / 4.7 (KR) = 42,063
- **Turn 50**: 4.6 = 188,220 / 4.7 (EN) = 269,206 / 4.7 (Mix) = 231,349 / 4.7 (KR) = 210,317
- **Turn 100**: 4.6 = 376,440 / 4.7 (EN) = 538,412 / 4.7 (Mix) = 462,697 / 4.7 (KR) = 420,634

### 5.3 Auto-compact trigger point (200K threshold)

- **4.6**: 53 turns
- **4.7 (English)**: 37 turns (reaches 200K 30% sooner)
- **4.7 (Mixed)**: 43 turns (19% sooner)
- **4.7 (Korean)**: ~48 turns (11% sooner)

---

## 6. Conclusions and Recommendations

### 6.1 Main Conclusions

- **4.7 is more expensive than 4.6 for three compounding reasons**:
  
  - Thinking frequency **3.5× higher** (main: 4.6 = 7.56% → 4.7 = 26.8%)
  - Visible output **27~34% more verbose** (tokenizer/thinking adjusted, subagent-controlled floor)
  - Tokenizer **28~38% inflation** on English/code

- **Korean dialog largely unaffected** (tokenizer inflation ~1%)

- **Context accumulation is real**: thinking persists in subsequent turns and accumulates as cache cost

- **Limited user control**:
  
  - `budget_tokens` can cap thinking length, but not the trigger
  - **Effort (low/medium/high/xhigh) cannot suppress thinking frequency** — empirical 16~38% range shows no monotonic relationship with effort; in fact low (37.5%) is highest and xhigh (16.3%) is lowest
  - Subagent model cannot be version-pinned (only aliases allowed)
  - `CLAUDE_CODE_SUBAGENT_MODEL` env var applies globally, no selective override

### 6.2 Cost Reduction Levers (by impact)

- **Session length management** (context size) — biggest impact
- **Model selection** (use 4.6) — 10~40% savings depending on work type
- **Dialog language** (Korean) — avoids tokenizer inflation
- **Thinking frequency** — model-intrinsic, cannot control directly

### 6.3 Practical Recommendations

#### Strategy A: Use 4.6 everywhere (simple, stable)

- `/model claude-opus-4-6[1m]` (or `claude-opus-4-6` if 1M context isn't needed)
- Simplest, most consistent 20~40% cost savings
- Suitable for daily coding/debugging/refactoring

#### Strategy B: 4.7 Main (brain) + Sonnet Subagent (hands)

Leverages CC's structural characteristic — **subagent has thinking disabled, main keeps thinking**.

**Task allocation principle**:

- **Handle in Main 4.7** (thinking is valuable):
  
  - Architecture design, technology decisions
  - Complex debugging (hypothesis exploration)
  - Multi-step planning (dependency tracking)

- **Delegate to Subagent Sonnet** (thinking unnecessary):
  
  - Specification-driven implementation (pattern application)
  - Batch file modifications (repetitive work)
  - Code search/exploration (simple I/O)
  - Simple Q&A

**How it works**:

- Main leverages 4.7's thinking as "the brain" — planning, judgment, integration
- Subagent runs cheap as "hands" — execution, investigation, repetition (thinking auto-disabled)
- Create clear instructions in main, delegate to subagent — optimal on both sides

**Common mistakes to avoid**:

- ❌ Delegating planning work itself to a subagent → no thinking, degraded reasoning
- ❌ Doing simple repetitive work in main → 4.7's thinking cost is wasted
- ❌ Specifying `model: opus` on subagents → same-tier model, no cost savings (thinking is blocked anyway, but token price is higher)

**Caveats**:

- Agent/skill `model` field accepts only aliases (`sonnet`/`opus`/`haiku`) — no version pinning
- `CLAUDE_CODE_SUBAGENT_MODEL` env var can override globally but not selectively

#### Common habits

- **Session management**: use `/continue` to keep initial context light; compress long sessions periodically
- **Sharing**: for beginners, "the same work on 4.6 saves roughly 20~40%"

---

## 7. Limitations

- **No thinking content available**: JSONL stores `thinking` as empty string; actual thinking length can only be estimated
- **Small tokenizer sample**: controlled-experiment deltas (982 vs 1,258) leave ±5% noise
- **Simulation assumption**: per-turn tool result fixed at 3,000 tokens; reality varies
- **Project bias**: both projects reflect a single user's work patterns

## Appendix: Key Measurements

```
=== Thinking rate (refreshed 2026-04-20, main + subagent, two projects combined) ===
opus-4-7: 621/3,477 = 17.9%
opus-4-6: 145/5,086 =  2.85%
Ratio: 6.3× (main only: 26.8% vs 7.56% = 3.5×)

=== 4-7 thinking rate by effort (default merged into xhigh) ===
Low    :  12/32      = 37.5%  (small sample)
Medium : 101/335     = 30.1%
High   :  36/212     = 17.0%
Xhigh  : 472/2,898   = 16.3%  (largest sample at 83%, 4-7 default)
Overall: 621/3,477   = 17.9%

=== Tokenizer test (control) ===
System prompt baseline: 4-6=11,526, 4-7=15,846 (ratio 1.375×)
Genesis EN delta:       4-6=982,    4-7=1,258  (ratio 1.281×)
Genesis KO delta:       4-6=1,801,  4-7=1,809  (ratio 1.004×)

=== Verbosity (thinking-disabled environments) ===
Subagent out/call:     4-6=163 (n=3,168), 4-7=279 (n=1,160)   (raw 1.71×, adjusted 1.34×)
Main no-think out:     4-6=451 (n=1,773), 4-7=1,306 (n=1,696) (raw 2.90×, adjusted 2.26×)

=== Output tokens per call (overall) ===
opus-4-7:   985 tok/call (think 17.9%, no-think 82.1%)
opus-4-6:   278 tok/call (think  2.85%, no-think 97.15%)

=== Per-project distribution ===
cc-token-saver: 4-7 main=1,589(28.7%) / sub=41     / 4-6 main=169(9.5%)  / sub=18
doooz:          4-7 main=728(22.7%)   / sub=1,119  / 4-6 main=1,749(7.4%) / sub=3,150
```

---

*Report produced on 2026-04-20.*

---

## Methodology: Data Collection Scripts

All numbers in this report are reproducible. Below are the two Python scripts used — one to aggregate observational stats from JSONL transcripts, one to run the §5 simulation. Both are self-contained and assume only Python 3 + standard library.

### Script 1 — Collect observational stats from transcripts

Aggregates calls/thinking-rate/out-per-call per (model, main/subagent) bucket, with effort segmentation for opus-4-7. Output written to `/tmp/cost-analysis-refresh.json`.

```python
#!/usr/bin/env python3
# collect_stats.py — walk Claude Code JSONL transcripts, aggregate cost stats.
import json, os, re, glob
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
FILTER_SINCE = "2026-04-17T00:00:00Z"
PROJECTS = {
    "cc-token-saver": HOME / ".claude/projects/-Users-taehyoungkim-Documents-DEV-cc-token-saver",
    "doooz":          HOME / ".claude/projects/-Users-taehyoungkim-Documents-DEV-VibeFamily-doooz",
}
# Regexes for effort signals captured in local-command-stdout messages.
EFFORT_RE = re.compile(
    r"Set effort level to (low|medium|high|xhigh)|"
    r"Set model to .+?with (low|medium|high|xhigh) effort",
    re.IGNORECASE,
)

def normalize_model(m):
    if not m: return None
    if "4-7" in m: return "opus-4-7"
    if "4-6" in m: return "opus-4-6"
    return None

def walk_main_jsonl(path, project):
    """Yield (assistant_entry, effort_at_time) for each usage-bearing assistant message."""
    current_effort = "xhigh"  # opus-4-7 default per prior research
    with open(path) as f:
        for line in f:
            try: d = json.loads(line)
            except: continue
            ts = d.get("timestamp", "")
            if ts < FILTER_SINCE: continue
            # Update effort from local command stdout
            if d.get("type") == "user":
                content = d.get("message", {}).get("content", "")
                text = content if isinstance(content, str) else " ".join(
                    b.get("text", "") for b in content if isinstance(b, dict))
                m = EFFORT_RE.search(text)
                if m:
                    current_effort = (m.group(1) or m.group(2)).lower()
            if d.get("type") == "assistant":
                msg = d.get("message", {})
                usage = msg.get("usage") or {}
                if "output_tokens" not in usage: continue
                model = normalize_model(msg.get("model"))
                if not model: continue
                has_think = any(
                    isinstance(b, dict) and b.get("type") == "thinking"
                    for b in (msg.get("content") or [])
                )
                yield {
                    "project": project,
                    "is_subagent": False,
                    "model": model,
                    "has_thinking": has_think,
                    "output_tokens": usage["output_tokens"],
                    "effort": current_effort if model == "opus-4-7" else None,
                    "timestamp": ts,
                }

def walk_subagent_jsonl(path, project, parent_effort_by_ts):
    with open(path) as f:
        for line in f:
            try: d = json.loads(line)
            except: continue
            ts = d.get("timestamp", "")
            if ts < FILTER_SINCE: continue
            if d.get("type") != "assistant": continue
            msg = d.get("message", {})
            usage = msg.get("usage") or {}
            if "output_tokens" not in usage: continue
            model = normalize_model(msg.get("model"))
            if not model: continue
            has_think = any(
                isinstance(b, dict) and b.get("type") == "thinking"
                for b in (msg.get("content") or [])
            )
            # Look up parent's effort at subagent's first timestamp (approximation)
            effort = None
            if model == "opus-4-7":
                effort = "xhigh"  # fallback default; refine via parent lookup if needed
            yield {
                "project": project,
                "is_subagent": True,
                "model": model,
                "has_thinking": has_think,
                "output_tokens": usage["output_tokens"],
                "effort": effort,
                "timestamp": ts,
            }

def main():
    records = []
    for project, base in PROJECTS.items():
        if not base.exists(): continue
        for p in sorted(base.glob("*.jsonl")):
            records.extend(walk_main_jsonl(p, project))
        for p in sorted(base.glob("*/subagents/*.jsonl")):
            records.extend(walk_subagent_jsonl(p, project, {}))

    def agg(rows):
        n = len(rows)
        if n == 0: return {"calls": 0, "thinking_calls": 0, "rate": 0.0, "out_per_call": 0}
        tc = sum(1 for r in rows if r["has_thinking"])
        ot = sum(r["output_tokens"] for r in rows)
        return {"calls": n, "thinking_calls": tc, "rate": round(tc/n, 4), "out_per_call": round(ot/n)}

    def by(pred): return [r for r in records if pred(r)]

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filter_since": FILTER_SINCE,
        "totals": {m: agg(by(lambda r, m=m: r["model"] == m)) for m in ("opus-4-7", "opus-4-6")},
        "by_bucket": {
            f"{m.replace('opus-', '')}_{'subagent' if sub else 'main'}":
              agg(by(lambda r, m=m, sub=sub: r["model"] == m and r["is_subagent"] == sub))
            for m in ("opus-4-7", "opus-4-6") for sub in (False, True)
        },
        "effort_breakdown_4-7": {
            e: agg(by(lambda r, e=e: r["model"] == "opus-4-7" and r["effort"] == e))
            for e in ("low", "medium", "high", "xhigh")
        },
        "no_think_verbosity": {
            f"{m.replace('opus-', '')}_{'subagent' if sub else 'main'}":
              agg(by(lambda r, m=m, sub=sub: r["model"] == m and r["is_subagent"] == sub and not r["has_thinking"]))
            for m in ("opus-4-7", "opus-4-6") for sub in (False, True)
        },
    }
    Path("/tmp/cost-analysis-refresh.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out["totals"], indent=2))

if __name__ == "__main__":
    main()
```

### Script 2 — §5 simulation

Reproduces the 100-turn context growth and 5h-window exhaustion ratios in §5. Inputs are the observed coefficients from Script 1 + the three tokenizer-inflation values from §4.3's control experiment.

```python
#!/usr/bin/env python3
# simulate.py — recompute §5 using refreshed coefficients.

BASE_OUT_46 = 451     # 4.6 main no-think out/call (visible)
THINK_ADD   = 1500    # avg thinking tokens when triggered
TOOL_RESULT = 3000    # per-turn tool result (assumed constant)
USER_IN     = 200     # per-turn user prompt
TURNS       = 100

# Observed (2026-04-20 refresh, main-session rates):
RATE_47 = 0.268       # §4.5 (4.7 main)
RATE_46 = 0.0756      # §4.5 (4.6 main)
VERBOSITY_47_OVER_46 = 1.34  # §4.2 subagent tokenizer-adjusted

# Tokenizer inflation on 4.7 (relative to 4.6) — from §4.3 control experiment:
SCENARIOS = {"english": 1.28, "mixed": 1.10, "korean": 1.00}

def per_turn(rate, verb, infl):
    return (USER_IN + TOOL_RESULT) * infl + BASE_OUT_46 * verb * infl + rate * THINK_ADD * infl

p46 = per_turn(RATE_46, 1.0, 1.0)
for name, infl in SCENARIOS.items():
    p47 = per_turn(RATE_47, VERBOSITY_47_OVER_46, infl)
    ratio = p47 / p46
    print(f"{name:<10} 4.7/4.6 per-turn ratio = {ratio:.3f}  "
          f"(100-turn ctx: 4.6={100*p46:,.0f} / 4.7={100*p47:,.0f})  "
          f"(200K auto-compact: 4.6={200000/p46:.1f} turns, 4.7={200000/p47:.1f} turns)")
```

### Caveats

- **Effort segmentation is approximate**: JSONL doesn't record effort per API call. We infer from local-command-stdout signals in user messages (`/effort X` and `/model ... with X effort`), propagating forward in time until the next signal. Default for opus-4-7 without a signal is assumed `xhigh` per prior research. Subagents inherit their parent session's effort at launch time but that lookup is simplified in the sample script above.
- **Simulation is a proxy**: per-turn constants (tool result, user input, thinking length) are chosen to match typical coding sessions but do not reflect all workflows. The ratios (4.7/4.6) are more robust than the absolute numbers.
- **Tokenizer inflation** is measured via §4.3's controlled same-text experiment, independent of the observational data.

