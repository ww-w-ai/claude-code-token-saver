# Opus 4.7 vs 4.6 Cost Analysis Report

**Research period**: 2026-04-17 ~ 2026-04-20
**Environment**: Claude Code v2.1.88 and v2.1.112, macOS, mixed Korean/English dialog
**Sample size**: 8,563 calls across two projects (4-7: 3,477, 4-6: 5,086)

> Korean version: [opus-4-7-vs-4-6-cost-analysis.ko.md](./opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## 0. Executive Summary

### Opus 4.7 costs 42% more than 4.6?

After switching to 4.7, I noticed usage draining noticeably faster. So I dug into 8,563 API calls across two projects.¹ Same work, same prompts — but **42% more** expensive.

It wasn't just one thing. Three factors hit at the same time:

- **The language got more expensive** — up to 35% more tokens for the same text (tokenizer inflation)
- **It thinks more often** — thinking frequency 3.5× (7.56% → 26.8%), independent of effort setting
- **It talks more** — same answers are 27~34% more verbose

These three multiply every turn, filling up context faster and compounding cache costs. Heavy users who typically got blocked around 4 hours into the 5-hour window now get blocked at **2 hours 40~50 minutes**. If you've been feeling like "I'm running out way faster than before" — it wasn't your imagination.

This report explains why it happens and **what you can do about it**.

---

¹ Measurement basis: super-token-saver + doooz JSONL data, simulated over 100 turns of English/code-heavy dialog. **Mixed Korean/English: ~26%; Korean-heavy: ~18%**. Varies by task type, language ratio, and session length. See §5 for full simulation conditions.

### The three causes in detail

Let's start with the biggest factor — the tokenizer.

- **The language got more expensive — Tokenizer inflation (English/code 28~38%)**
  
  Per Anthropic's official announcement, 4.7 introduced a new tokenizer that breaks the same text into up to 35% more tokens. Confirmed via controlled experiment with identical inputs (§4.3). Korean shows no effect (~1%).

- **It thinks more often — Thinking frequency 3.5×**
  
  In main-session calls, 4.6 triggers thinking in 7.56% of calls; 4.7 triggers it in 26.8%. You might think "can't I just lower the effort level?" — but effort controls thinking **length**, not **whether it happens**. Even at low effort, thinking frequency didn't decrease (§4.1). Evidence: 3,075 main calls.

- **It talks more — Output verbosity 27~34% higher**
  
  Even in the subagent environment where thinking is disabled, output volume was 1.34× (tokenizer-adjusted). This is a 4.7-intrinsic trait not explained by thinking or tokenizer.

These three factors **accumulate every turn** → context grows faster → cache read cost compounds.

### What should you do?

#### Option 1 — Just use 4.6 for everything (recommended for most)

This alone gets you back 20~40% of your session time.

```
/model claude-opus-4-6[1m]
```

(If you don't need the 1M context window, `claude-opus-4-6` works too.)

What this does: pins your session to Opus 4.6. It thinks less often, responds more concisely, and uses a more efficient tokenizer. 95%+ of coding/debugging/refactoring work shows no noticeable quality difference from 4.7.

**Note**: `/model` only applies to the current session. New terminal → run it again.

#### Option 2 — Keep 4.7 for design, delegate execution to Sonnet subagents (advanced)

Still want 4.7's improved capabilities? Keep 4.7 in the main session but delegate execution to subagents. Claude Code **automatically disables thinking in subagents**, so they run cheaply.

- **Main (Opus 4.7)**: architecture decisions, exploring bug hypotheses, multi-step planning — where deep reasoning matters
- **Subagent (Sonnet)**: implementing specs you already wrote, batch file edits, codebase search, routine Q&A

Tell Claude "launch a subagent with sonnet to do X", or set `model: sonnet` in agent frontmatter.

**Pitfall to avoid**: don't delegate planning itself to subagents. They can't think, so plans come out shallow. Design in main, execute in subagents — that's the key division.

#### Option 3 — super-token-saver plugin (Option 2 + automated token management)

For those who find manual management tedious. [super-token-saver](https://github.com/ww-w-ai/super-token-saver) is an open-source Claude Code plugin that automatically tracks and reduces token costs.

- Design via `claude -p` (main, thinking active), execution via SubTask + Sonnet — automatic distribution
- Warns on prompt cache expiry to prevent unnecessary re-caching costs
- `/usage-view` for real-time cost dashboard
- `/s-continue` to restore context between sessions at zero LLM cost

The analysis data in this report was collected using super-token-saver.

If you're unsure, **start with Option 1.** One command, reversible anytime.

---

## 1. Background

### Problem

After switching to Opus 4.7, I noticed the **5-hour usage window draining faster than before**. Same amount of work, quota depleting quicker. Was it just my imagination, or was it real?

### Hypotheses

- Is the model upgrade (4.6 → 4.7) driving the cost increase?
- Is it a Claude Code version bug?
- Is the tokenizer change affecting costs?
- Has the model's thinking behavior changed?

### Research objectives

- Quantify whether window exhaustion is actually faster
- Separate model effects from CC version effects
- Provide evidence for practical mitigation choices

---

## 2. Data Sources

### 2.1 JSONL transcripts (observational data)

Session JSONL files from two projects I actually worked on (since 2026-04-17, main + subagent):

- **doooz** (personal project, design refactoring — [github.com/taekim34/doooz](https://github.com/taekim34/doooz)): 4.7 = 1,847 calls (main 728 / sub 1,119), 4.6 = 4,899 calls (main 1,749 / sub 3,150)
- **super-token-saver** (analysis/debugging): 4.7 = 1,630 calls (main 1,589 / sub 41), 4.6 = 187 calls (main 169 / sub 18)
- **Total**: 4.7 = 3,477 calls, 4.6 = 5,086 calls (8,563 total)

Fields extracted from JSONL:

- `message.model` — model used for the call
- `message.usage.output_tokens` — output token count
- `message.usage.input_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens`
- `message.content[].type === "thinking"` — thinking block presence
- `message.content[].signature` — thinking signature (encrypted blob)

### 2.2 Controlled experiment (experimental data)

**Tokenizer inflation measurement**: sent the same text to 4.6 and 4.7 subtasks simultaneously to compare `input_tokens`.

- **System prompt (English/code)**: 4.6 = 11,526 tokens, 4.7 = 15,846 tokens
- **Genesis 1 (English)**: 4,087 chars, cl100k 949 tok → 4.6 = 982, 4.7 = 1,258
- **Genesis 1 (Korean)**: 1,673 chars, cl100k 1,633 tok → 4.6 = 1,801, 4.7 = 1,809

I used Genesis passages to test pure English and Korean prose. Identical prompts sent at the same moment to both models to isolate pure tokenizer difference.

---

## 3. Analysis Framework

I broke down "why did it get more expensive?" into **4 independent variables**, verifying each separately:

- **Thinking frequency**: Does 4.7 "think" more often than 4.6? → Ratio of calls containing thinking blocks
- **Visible output verbosity**: Are responses longer even without thinking? → Compare avg `output_tokens` in no-thinking calls
- **Tokenizer efficiency**: Does 4.7 use more tokens for the same text? → Identical text controlled experiment
- **Context accumulation effect**: Does thinking persist in subsequent turns' context? → JSONL signature inspection

---

## 4. Key Findings

### 4.1 Thinking frequency difference

**Since 2026-04-17, both projects combined (main + subagent)**:

- **opus-4-7**: 3,477 calls, 621 thinking → **17.9%**
- **opus-4-6**: 5,086 calls, 145 thinking → **2.85%**
- **Overall ratio: 6.3×**

Same period, same work environment, subtasks included. 4.6 processes most calls without thinking; 4.7 triggers thinking roughly 1 in every 5~6 calls.

#### Thinking rate by effort level (4.7, subtask included)

- **Low**: 32 calls, 12 thinking → **37.5%** (small sample, out/call 590)
- **Medium**: 335 calls, 101 thinking → **30.1%** (out/call 1,867)
- **High**: 212 calls, 36 thinking → **17.0%** (out/call 1,796)
- **Xhigh (4.7 default)**: 2,898 calls, 472 thinking → **16.3%** (out/call 829, largest sample at 83%)
- **Overall**: 3,477 calls, 621 thinking → **17.9%**

(default merged into xhigh, which is 4.7's default effort)

#### The real role of effort — length cap, not trigger switch

Here's the interesting part: think rate fluctuates in the 16~38% range with **no monotonic relationship** to effort level. Counter to intuition, low (37.5%) is the highest and xhigh (16.3%) is the lowest — completely reversed.

What this means: effort sets the **upper bound on how deep** a thinking block can go when triggered. It does **not** control whether thinking starts in the first place. The thinking trigger is the model's own judgment after reading input — independent of effort.

So opus-4-7 **produces significant thinking cost regardless of effort setting**. Only the length per block changes. Effort can't fundamentally solve this — **switching models (to 4.6) is the only effective response**.

### 4.2 Visible Output Verbosity

If you've noticed responses getting more verbose, that's a fact. I compared pure output with thinking effects removed.

#### Environment 1: Subagent (most controlled condition)

CC explicitly disables thinking in subagents (§4.5). Both models under **same role, same constraints** — the fairest comparison.

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

Both environments show 4.7 is more verbose:

- Subagent: 1.34× (strongest control, same short execution tasks)
- Main no-think: 2.26× (some task-complexity bias — super-token-saver's analytical work concentrated on 4.7)

Even with maximum tokenizer correction, 1.27× remains in the subagent condition. **The residual after thinking-disabled + tokenizer-corrected = 4.7's intrinsic verbosity increase.** Controlled-condition range: **27~34%**; less-controlled conditions show more.

### 4.3 Tokenizer Inflation

Sent identical text to both models' subtasks at the same time, compared input_tokens:

- **English/code (system prompt)**: 4.7 / 4.6 = **1.375×** (37.5% inflation)
- **English prose (Genesis EN)**: 1.281× (28% inflation)
- **Korean (Genesis KO)**: 1.004× (no difference)

Code-heavy input showed the largest increase. Matches Anthropic's official "up to 1.35×" announcement — my test showed up to 37.5%.

Korean was virtually identical because Korean's jamo composition system (initial + medial + final consonant) already provides a systematic decomposition structure, leaving little room for the new tokenizer to split further. English has ambiguous morpheme boundaries (e.g., `tokenizer` → `token` + `izer`) that invite re-tokenization, but Korean doesn't.

Why did they split tokens more finely? The old tokenizer was optimized for general English prose. Recent LLMs are strengthening performance on code, structured documents, and math — so the tokenization was re-tuned to match.

### 4.4 Context Accumulation Mechanism

I verified whether thinking actually accumulates in context:

- Thinking blocks arrive from the API with an encrypted `signature` blob
- JSONL stores only the `signature`; the `thinking` field is empty
- Every subsequent API call transmits **all prior turns' thinking signatures**, which the server decrypts
- On the server side, the decrypted thinking content counts as context tokens
- By default, all thinking is preserved

In other words, thinking is invisible to the user but **actually accumulates in context and incurs cost every turn**. That's what makes thinking scary — you can't see it, but you're paying for it.

### 4.5 Main Session vs Subagent Structural Difference

Separating main and subagent:

- **4.7 main**: 2,317 calls, 621 thinking → **26.8%**, out/call 1,339
- **4.7 subagent**: 1,160 calls, **0** thinking → **0.0%**, out/call 279
- **4.6 main**: 1,918 calls, 145 thinking → **7.56%**, out/call 468
- **4.6 subagent**: 3,168 calls, **0** thinking → **0.0%**, out/call 163

**Key finding: Thinking is completely blocked in subagents for both models (0 occurrences).**

Claude Code already recognizes thinking as a cost driver and explicitly disables it for regular subagents. The internal comments confirm this is intentional for cost control.

#### What this means

- **Thinking cost occurs only in the main session** — 4.7's cost explosion is concentrated in main-session thinking frequency
- **Subagent is a safe zone** — regardless of model, thinking is disabled and output stays concise
- **4.7 main vs 4.6 main ratio**: 26.8% / 7.56% = **3.5×** (distinct from the overall 6.3× which includes subagent 0s)
- **Out/call gap also narrows in subagent**: main 1,339/468 = 2.86× → subagent 279/163 = 1.71×
- The subagent comparison (1.71×) represents the lower bound of pure verbosity difference. After tokenizer correction: 1.27~1.34× → **4.7 intrinsically generates 27~34% more tokens for the same task**

**One caveat**: no thinking in subagents also means **delegating complex reasoning to subagents will degrade quality**. Design in main using 4.7's thinking, execute in subagents — that's the optimal division.

### 4.6 Per-turn Cost (Empirical)

In real dollar terms:

- **Output per call (overall average)**: 4.7 = 985 tok vs 4.6 = 278 tok → 3.54× (tokenizer-adjusted 2.77×)
- **Cache create per turn**: 4.7 = $0.103 vs 4.6 = $0.031 → **3.37×**
- **Cache read per turn**: 4.7 = $0.405 vs 4.6 = $0.432 → 0.94× (nearly equal)
- **Total per turn**: 4.7 = $0.587 vs 4.6 = $0.497 → 1.18×

Cache read is proportional to context size, so model-independent. As sessions grow longer, cache read dominates and model differences dilute — but the per-turn output difference keeps growing the context faster, compounding back.

---

## 5. Compound Effect Simulation

I simulated what happens when all three effects (thinking frequency, verbosity, tokenizer inflation) act simultaneously.

### 5.1 Per-turn cost ratio by scenario

100-turn cumulative token consumption. How much more expensive is 4.7 per turn compared to 4.6 for the same work?

- **English/code-heavy (tokenizer 1.28×)**: 4.7 per-turn cost ×**1.43** → **43% more expensive per turn**; a 4h user hits the block at ~2h 48m
- **Mixed Korean/English (tokenizer 1.10×)**: ×1.23 (23% more expensive; a 4h user hits the block at ~3h 15m)
- **Pure Korean (tokenizer 1.00×)**: ×1.12 (12% more expensive; a 4h user hits the block at ~3h 34m)

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

### 6.1 Summary

- **4.7 is more expensive than 4.6. Three factors compounding simultaneously**:
  
  - Thinking frequency **3.5× higher** (main: 7.56% → 26.8%)
  - Same answers are **27~34% more verbose** (tokenizer/thinking adjusted)
  - Tokenizer **28~38% inflation** on English/code

- **Korean dialog is largely unaffected** (tokenizer inflation ~1%)

- **Thinking is invisible but accumulates in context and compounds cost every turn**

- **User control is limited**:
  
  - `budget_tokens` can cap thinking length, but the model decides whether to think
  - **Changing effort doesn't reduce thinking frequency** — empirically, low (37.5%) was actually the highest and xhigh (16.3%) the lowest
  - Subagent models accept aliases only, no version pinning

### 6.2 Cost reduction levers (by impact)

- **Session length management** (context size) — biggest impact
- **Model selection** (use 4.6) — 10~40% savings depending on work type
- **Dialog language** (Korean) — avoids tokenizer inflation
- **Thinking frequency** — model-intrinsic, cannot control directly

### 6.3 What should you do?

#### Strategy A: Use 4.6 everywhere (recommended for most)

- `/model claude-opus-4-6[1m]` — one command
- Simplest, most consistent 20~40% cost savings
- 95% of work shows no noticeable quality difference

#### Strategy B: 4.7 for design only, Sonnet subagents for execution (advanced)

If you want 4.7's improved capabilities, leverage CC's structural characteristic — **subagent has thinking disabled, main keeps thinking**.

- **Main 4.7 (design)**: architecture design, complex debugging, multi-step planning
- **Subagent Sonnet (execution)**: spec-driven implementation, batch file edits, code search, simple Q&A

Design in main, execute in subagents — that's the key division.

**Mistakes to avoid**:

- ❌ Delegating planning to subagents → no thinking, shallow designs
- ❌ Doing simple repetitive work in main → wasted 4.7 thinking cost
- ❌ Setting `model: opus` on subagents → thinking is blocked anyway, but token price is higher

#### Common habits

- **Session management**: use `/s-continue` to keep initial context light; compress long sessions periodically

---

## 7. Limitations

This analysis may have limitations:

- **Small tokenizer sample**: controlled-experiment deltas (982 vs 1,258) leave ±5% noise
- **My work pattern bias**: both projects reflect one person's (my) work patterns. More contributors' data would improve accuracy

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
super-token-saver: 4-7 main=1,589(28.7%) / sub=41     / 4-6 main=169(9.5%)  / sub=18
doooz:          4-7 main=728(22.7%)   / sub=1,119  / 4-6 main=1,749(7.4%) / sub=3,150
```

---

## Methodology: Data Collection Scripts

All numbers in this report are reproducible. Run the two Python scripts below to get the same results. Python 3 + standard library only.

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
    "super-token-saver": HOME / ".claude/projects/{super-token-saver-project-hash}",
    "doooz":          HOME / ".claude/projects/{doooz-project-hash}",
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
    """Yield assistant entries with effort tracking."""
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
            effort = "xhigh" if model == "opus-4-7" else None
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

---

## Closing

This report started from a simple question: "why am I running out of usage so fast lately?" Digging in, I found three factors — tokenizer change, thinking frequency increase, and response verbosity — all acting simultaneously, adding up to a 42% difference.

It's natural for cost structures to shift as models evolve. But when users don't notice the change and only see higher bills — that's a problem. I hope this report helps bridge that gap.

I'll update as more data comes in. If you'd like to contribute your own usage data, you can do so anonymously through [super-token-saver's /report-limit](https://github.com/ww-w-ai/super-token-saver).
