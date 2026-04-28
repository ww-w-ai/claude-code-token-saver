# cc-token-saver

> **Claude Code keeps cutting you off? Not anymore.**
>
> Spend less, code longer, and see exactly where your tokens go — zero config.

How? Auto context management, real-time cost tracking, and cache-aware session control — all built into one plugin.

---

## 😤 The Problem: $200/mo and You Still Can't Get Work Done

Claude Code Max Plan ($200/mo). Should be enough. It's not.

**5-hour rolling window rate limit.** You're deep in a coding flow and it just stops. No timer. No ETA. Just wait.

**Cache expiry.** You come back from lunch. It's been over an hour. You send one prompt and 900K tokens are re-sent at full price. Cost? $9 in a single shot.

**Invisible costs.** There's no way to see how much you're spending in real time. You only find out after the rate limit hits.

**All manual.** Context size, cache expiry timing, SubTask delegation, session cleanup. Nobody can track all this while actually coding.

cc-token-saver handles all of it automatically. **Install once. Done.**

---

## 🚀 Installation

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Works automatically after install. Zero config. Requires [Claude Code](https://claude.ai/claude-code) v2.1.71+.

For live monitoring:

```
/setup-statusline install
```

---

## 🛡️ Feature 1: Token Guardian

**Detects cache expiry and automatically blocks expensive re-sends.**

Claude Code's prompt cache TTL is 1 hour. Step away for more than an hour and the cache expires. Your next message re-sends the entire context at full price. At 900K tokens, that's $9 in one shot.

Token Guardian tracks when the last response was received. If more than 3,590 seconds have passed (TTL minus 10-second buffer), it blocks the prompt and shows a warning.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Just re-send the same prompt after the warning -- it goes through. The warning only fires once per idle period, so it never nags. Warning messages display in 23 languages based on your OS locale.

**Result:** Expensive re-cache costs are prevented automatically. No effort required.

---

## 🧠 Feature 2: Smart Session Architecture

**Install it and cost-optimized work patterns kick in automatically.**

Most users do everything in the Main session. File reads, code generation, test runs. Every output piles into context and is re-sent with every message. The session bloats. Costs snowball.

Session Architect automatically injects a delegation strategy at session start.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Role             | Design, decisions, review         | Implementation, code gen, multi-file  |
| Cache tier       | 1 hour (ephemeral_1h)             | 5 min                                 |
| Cache write cost | ＄10/MTok                          | ＄6.25/MTok                            |
| Context size     | ~94K avg                          | ~33K avg                              |

SubTasks have **37.5% cheaper cache writes** than Main. Context is also much smaller. Delegating heavy work to SubTasks cuts costs dramatically.

**Result:** Claude automatically works in a cost-efficient pattern. You don't have to think about it.

---

## 🪶 Concise Mode

**Same content. Less padding. On by default.**

The SessionStart hook also injects a response-style rule that runs in **every session and every model** — no flags, no setup. Three things change:

- **Preamble out** — no "Let me check…", "I'll now…", restating your question, or recapping what the diff already shows
- **Right format for the content** — bullets for lists, prose for reasoning (tradeoffs, causation, rationale). Neither is forced
- **Tighter expression** — same point, fewer words. Clearer prose is shorter prose

Hard limit: never drop content, skip verification, or collapse nuance into a single sentence. Substance stays full; only the wrapper shrinks.

Install once, applies everywhere.

---

## 🔄 Feature 3: /continue — Context Restoration

**Replaces `/compact`. Zero LLM calls. Zero token cost.**

`/compact` sends your entire context (~1M tokens) to the LLM to compress it into a 3.3% summary. If the cache has expired, that alone triggers a full re-cache. Information loss is inevitable.

`/continue` takes a completely different approach. It preprocesses the previous session transcript and loads it directly. No LLM call. No cost. The original conversation is restored as-is.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| How it works            | Sends full context to LLM for summary | Preprocesses transcript, reads directly |
| LLM calls               | Required (typically 100K+ tokens) | 0                                |
| Token cost              | High                              | 0                                |
| Information loss        | Yes (3.3% summary)                | None (original preserved)        |
| Processing speed        | Tens of seconds                   | < 1 sec (even 60MB+ files)       |
| When cache is expired   | Full re-cache cost on top         | No impact                        |
| Multi-session restore   | Not possible                      | Supported                        |

Usage: `/clear` then `/continue`. You'll see a list of previous sessions. Pick one to restore. For quick recovery: `/continue last`.

**Result:** Resume previous work at zero cost. No information loss.

---

## 📊 Feature 4: Live Status Line

**Real-time token/cost monitoring. Under 50ms overhead.**

Run `/setup-statusline install` once and a persistent status bar appears at the bottom of Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indicator        | What it shows                       | 🟢 Normal | 🟡 Warning | 🔴 Critical |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Cost of the last API call           | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Cumulative cost for this folder     | —         | —          | —           |
| 5H               | 5-hour window usage + reset countdown | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context window usage                | < 35%     | >= 35%     | >= 70%      |

When any indicator hits warning or critical, a `→ /usage-view current` hint appears automatically.

To remove: `/setup-statusline uninstall` (previous config auto-restored).

**Result:** See your cost state at a glance. Act before it's too late.

---

## 📈 Usage Dashboard (/usage-view)

**Finally answer: "Why did I get rate limited?"**

Until now, hitting the rate limit just made you angry. No way to know the cause. Which session burned the most tokens? When did costs spike? What patterns exist in your usage? All invisible.

`/usage-view` shows everything. An interactive HTML dashboard opens in your browser, letting you analyze usage patterns and trace the root cause of cost spikes. No external dependencies. Works standalone. Shareable as a file.

What's included:

- Daily / hourly / day-of-week cost trends — spot when you burn the most tokens
- Token breakdown (input, output, cache write, cache read) — see what's driving costs
- Per-session cost analysis — pinpoint which tasks were expensive
- 5-hour window timeline (Max Plan subscribers) — trace rate limit triggers
- Context size distribution chart — 4-bucket breakdown of where your tokens land
- Cost by Context Size bubble chart — density clustering reveals cost hotspots
- Model-based coloring (Opus/Sonnet/Haiku) matching API pricing lines
- Theoretical pricing lines (1h/5m cache write, cache read) per model
- Dual average toggle: Avg (active days) / Avg (all days) / Max
- Per-user-turn cost view with $50 cap and star markers for outliers
- Cache read alert with context size and API call count
- AI-powered insight analysis — interprets data with API pricing reference for accurate insights
- 23 languages supported (RTL included; charts/tables stay LTR)

```
/usage-view                  # All time, all projects
/usage-view current          # Current 5-hour window only
/usage-view last 7 days      # Last 7 days
/usage-view locale ja        # Japanese
```

---

## 🔬 Rate Limit Research (/report-limit)

**Community-driven project to reverse-engineer the rate limit formula.**

Anthropic doesn't publish the exact formula for the 5-hour window. Let's figure it out together.

When you hit a rate limit, run `/report-limit`. Your current usage data is automatically submitted as a GitHub Discussion. The more data we collect, the clearer the formula becomes.

---

## ✂️ Feature 5: /setup-git-lite — Trim CC's Built-in Git Instructions

**The hidden 2,200 tokens per session you didn't know you were paying for.**

### The discovery

On 2026-04-12, a [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) revealed that Claude Code's built-in `includeGitInstructions` setting silently burns tokens every session. Independent reproduction via [this gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) confirmed the numbers: **+6,031 tokens in cache writes** per session after each git commit, **+1,690 tokens in cache reads** on every API call.

### CC source analysis — where the tokens go

We traced the tokens to two independent injection points in Claude Code source (v2.1.88):

**1. `gitStatus` snapshot (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` collects branch + main branch + user.name + full status (up to 2000 chars) + **recent 5 commits**
- Joined and appended to system prompt via `appendSystemContext` (`utils/api.ts:437`)
- Every new commit, every new modified file, every branch switch changes the text → prefix cache invalidation

**2. Commit/PR workflow instructions (~1,700 tok) — Bash tool description**
- `tools/BashTool/prompt.ts:53` appends 60+ lines of safety protocol, step-by-step commit procedure, HEREDOC examples, and PR creation templates to the `Bash` tool's description
- Cached alongside system prompt, but shipped as `tools[]` parameter

### Why it's expensive

The cache structure (`utils/api.ts:321` `splitSysPromptPrefix`) has three paths based on whether you have active MCP tools:

- **Path A** (MCP active — most users): `gitStatus` sits inside a `cacheScope: 'org'` block. Any change → whole block re-cached on next session start → 6K tok `cache_create` miss.
- **Path B** (no MCP): `gitStatus` goes to a `cacheScope: null` dynamic block, which means it's re-sent as fresh `input_tokens` every API call — no cache miss, but no cache savings either.
- **Path C** (3P provider / experimental betas disabled): same as Path A.

In typical interactive sessions, the commit/PR instructions (1.7K tok) accumulate **on every API call** via `cache_read`. Over a 100-call session at Opus 4.7 pricing, that's roughly **$0.08 per session** just for instructions Claude's training already mostly covers.

### How cc-token-saver handles it

`/setup-git-lite` disables the native path and injects a **curated 280-token replacement** via a SessionStart hook. We kept exactly the things that override Claude's default behavior (safety rules), and dropped everything that Claude already knows from training (step-by-step workflows, PR templates, gh usage patterns).

**Retained — 11 critical override rules** (the ones that flip Claude's default helpfulness into caution):
- Never commit/push/amend/PR/tag/merge without explicit user request
- Never skip hooks, force-push to main/master, run destructive ops, modify git config
- Never commit files matching `.env`, `credentials`, `*.pem`, `secret.*`
- Avoid `git add -A` / `git add .`
- HEREDOC for multi-line commit messages + `Co-Authored-By: Claude` trailer
- Never use interactive flags (-i), no empty commits
- If pre-commit hook fails → create a NEW commit (not `--amend`)

**Dropped** — step-by-step commit workflow (3 steps), step-by-step PR workflow (3 steps), PR title/body template, `gh` command references, `-uall` flag warning, `--no-edit` with rebase warning, `NEVER use TodoWrite or Agent tools during commit` constraint. These are workflow verbosity that Claude composes correctly from training alone.

**Added** — compact git state line: branch + HEAD short-sha + subject + current status (up to 20 modified files, else a count). No recent commits list (Claude can run `git log` on demand).

### Expected savings (Opus 4.7 pricing, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| Item | Original | With setup-git-lite | Saved |
| ---- | -------- | ------------------- | ----- |
| System prompt load (per new session) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| Repeat calls in same session | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100-call session (Opus 4.7) | — | — | **~$0.11 saved** |
| 20 sessions/day × 22 workdays | — | — | **~$48 saved/month** |

### Usage

```bash
/setup-git-lite status     # Read-only diagnostic — current state + what would change
/setup-git-lite install    # Disable CC native + enable our minimal hook
/setup-git-lite revert     # Restore default (aggressive; see below)
/setup-git-lite dismiss-banner    # Silence the occasional recommendation tip
/setup-git-lite undismiss-banner  # Re-enable the tip
/setup-git-lite help       # Full usage
```

### Install semantics

`install` modifies **two** places for robustness:

1. `~/.claude/settings.json` — adds `"includeGitInstructions": false`
2. Shell profile (`~/.zshrc`, `~/.bashrc`, etc.) — appends a marker block exporting `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Either one alone is enough to disable CC native; we set both so an environment override doesn't accidentally re-enable the native behavior. The shell change takes effect in new shells only.

### Revert semantics — aggressive

`revert` **removes ALL `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` exports from your shell profile**, including any you may have added manually before installing this skill. This is intentional — you ran `revert`, so we restore the clean default. We always create a timestamped backup of the shell profile first.

If you need the env var for unrelated reasons, note it down before running `revert` and re-add it after.

### Before uninstalling cc-token-saver

**Run `/setup-git-lite revert` first**, or you'll be left with `includeGitInstructions: false` in your settings.json but no replacement hook (Claude gets no git guidance at all). Claude Code currently has no plugin uninstall lifecycle hook, so we can't automate this.

### Trade-offs

What you lose (and why it's usually fine):
- Claude no longer receives a pre-computed `git status` / `git log -n 5` at session start. If you ask "what's changed?" in a new session, Claude will run those commands itself (one extra tool call, ~300 tok).
- Claude no longer sees CC's canonical 3-step commit procedure. In our testing across hundreds of commit flows, training-level knowledge handles the critical cases (HEREDOC formatting, no `--amend`, no force-push) because we keep those as explicit rules.
- PR body template (`## Summary` + `## Test plan`) is not injected. If you care about exactly that format, put it in your project's CLAUDE.md.

### Recommendation banner

When CC native git instructions are still active on your machine, cc-token-saver shows a one-paragraph tip at session start **~20% of the time** (plus in `/usage-view` and `/report-limit` outputs). Dismiss permanently with `/setup-git-lite dismiss-banner`.

---

## 💡 How Cache Actually Works

Claude Code sends the entire conversation history to the model on every API call. "API call" doesn't mean "one message you typed." A single prompt triggers internal tool calls — Grep, Read, Edit, Write — and each one is a separate API call. One prompt can easily cause 10+ API calls.

Prompt cache reduces this cost by 90%. But cache has a lifespan.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 hour (ephemeral_1h)                 | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| When cache expires  | Full context re-sent at full price    | Low impact (context is small)          |

Even with cache alive, costs accumulate. Here's an extreme scenario to show the difference.

### Scenario: Full-day coding (3h morning → 2h lunch/meeting → 3h afternoon)

Conditions: Opus 4 pricing, 1 prompt per minute, ~5 API calls per prompt (~300 calls/hour).

#### ❌ Without cc-token-saver

Most work happens in the Main session. Context grows fast.

| Phase       | Situation                         | Context size               | Cost                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Morning 3h  | Coding (mostly in Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0.50/M = ＄157.50  |
| Lunch/mtg   | Away for 2 hours                  | —                          | —                                      |
| Return      | Cache expired → full re-send      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Return      | /compact (summarize)              | 600K → sent to LLM        | 600K × ＄0.50/M + summary output = ~＄1.50 |
| Afternoon 3h | Coding continues (context regrows) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0.50/M = ＄157.50  |
|             | Total                             |                            | ~＄326                                  |

> At this usage level, you'll likely hit the 5-hour window rate limit. **Cost is bad, but the real problem is your work stopping completely. This is the exact moment Claude Code goes dark.**

#### ✅ With cc-token-saver

Heavy work is delegated to SubTasks. Main handles design/decisions only.

| Phase       | Situation                                    | Context size                | Cost                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Morning 3h  | Coding (Main: design, SubTask: implementation) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
| Lunch/mtg   | Away for 2 hours                             | —                           | —                                  |
| Return      | ⚡ Token Guardian blocks → /clear + /continue | —                           | ＄0 (no LLM calls)                 |
| Afternoon 3h | Coding continues                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 Result

> **＄326 → ＄180. ＄146 saved per day (45%).**
>
> It's not just about cost. Fewer tokens in the same time means **you don't hit the rate limit and can keep working.** That's the real difference.

### Where cc-token-saver steps in

```
[Session Start]
    │
    ├─ Session Architect → Auto-injects SubTask delegation pattern
    │                       Keeps Main context under 250K
    │
[Working]
    │
    ├─ Status Line → Real-time cost/context/rate limit monitoring
    │                  Instant alert when entering warning zone
    │
[1+ hour idle]
    │
    ├─ Token Guardian → Detects cache expiry, blocks before re-send
    │
[Session restart]
    │
    └─ /continue → Restores previous context at zero cost (no LLM calls)
```

---

## 🔧 Source Install & Customization

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver is fully open. The entire source is plain JavaScript + Bash scripts following the standard plugin structure. Modify anything you want.

- **hooks/** — Change cache expiry threshold, customize warning messages, modify session architecture rules
- **scripts/** — Analysis logic, report builder, status line formatting
- **skills/** — How /continue and /usage-view work, prompt templates
- **locales/** — Add/edit translations, add new languages
- **skills/usage-view/** — Dashboard UI/UX design changes

Make it yours. Fork it, experiment, and send a PR if you find something better.

---

## 🌐 Supported Languages

23 languages supported. Selected by cross-referencing the top 20 countries by Claude Code usage with the top 20 languages by global speaker count. The display language is auto-detected from your OS locale. You can also specify manually: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Current translations are AI-generated. Native speaker contributions are welcome — edit the JSON file for your language in `locales/` and submit a PR.

---

## 💡 Tips

### Understand cache and you'll see where the money goes

- **1 prompt ≠ 1 API call.** Every time Claude calls Grep, Read, or Edit, the entire context is re-sent. A single prompt easily triggers 10+ API calls. Write clear prompts to reduce unnecessary tool calls and cut costs.
- **The cache timer resets from the last API call, not your last prompt.** Keep working and the cache never expires. The danger is stepping away. Token Guardian auto-blocks once, so when you return you can choose: reset context or continue as-is.
- **Context size = cost multiplier.** The same API call at 200K vs 800K costs 4x more. When the status line [CTX] crosses 35% (🟡), that's your signal to delegate more to SubTasks.

### Habits that cut costs

- **Keep CLAUDE.md lean.** It loads into the system prompt on every API call. Every line costs money.
- **Delegate heavy work to SubTasks.** Code generation, multi-file edits, test runs don't belong in Main. SubTasks have smaller context and a cheaper cache tier.
- **Away for 1+ hours?** `/clear` → come back → `/continue`. Context restored at $0.
- **[5H] above 70% (🟡)?** Slow down. Switch to lightweight review tasks or increase SubTask delegation to reduce Main's API call count.
- **Use `/btw` for side questions.** It doesn't enter conversation history, so your context stays lean.

---

## 📚 Documentation

- [Prompt Cache Guide](guides/prompt-cache-guide.md) — Why most of your cost is cache, how caching works across providers (Anthropic, OpenAI, Gemini), and how to manage it ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Opus 4.7 vs 4.6 Cost Analysis](guides/opus-4-7-vs-4-6-cost-analysis.md) — Side-by-side cost comparison across 8,563 API calls
- [Opus 4.7 vs 4.6 Cost Analysis (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## License

Apache-2.0
