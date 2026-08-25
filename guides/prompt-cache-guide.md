# Cache Cost Guide — Why Most of Your Cost Is Cache

It's normal for most of your AI coding tool costs to come from cache operations (writes + reads). This document explains why, and how to manage it.

## The Secret: Every Message Resends the Entire Conversation

LLMs are **stateless**. Unlike humans, AI models don't "remember" previous conversation — they receive the full conversation history as input on every single request.

It looks like a chat, but the actual API calls work like this:

```
[ Request 1 ]
→ System prompt + "Fix this bug"
← AI response

[ Request 2 ]
→ System prompt + "Fix this bug" + AI response + "Add tests too"
← AI response

[ Request 3 ]
→ System prompt + "Fix this bug" + AI response + "Add tests too" + AI response + "Commit it"
← AI response
```

Every request includes **all** previous content. For example, the 50th request contains the entire conversation and all AI responses from the previous 49 requests. This is why input tokens grow rapidly as the conversation gets longer.

On top of that, AI coding tools send the system prompt (built-in instructions, config files, plugins, MCP tool definitions, etc.) with every request — so even a one-line message results in tens of thousands of input tokens.

## What Is Caching?

**Prompt caching** reduces the cost of this repeated transmission. It stores unchanged portions of your input on the server so that subsequent requests can reuse them at a discounted rate.

- **Cache Write**: The cost of storing conversation content on the server. Occurs on the first request or after a cache expires.
- **Cache Read**: The cost of reusing already-stored conversation. Charged at a **90% discount** compared to standard input.

AI coding tools inevitably produce long conversations and large contexts, up to 1 million tokens per request. Even if your new question is short, the entire previous conversation is billed alongside it, so costs accumulate rapidly as the conversation grows longer.

To reduce this burden, major AI providers apply a 90% discount on cache reads, significantly lowering the cost of retransmitting already-processed content.

## Why Does Cache Dominate the Total Cost?

| Category | Tokens per Call | Note |
|---|---|---|
| User input (new tokens) | Tens to hundreds | What the user actually types |
| AI output | Hundreds to thousands | AI's response |
| **Cache read** | **100K–hundreds of K** | Entire accumulated conversation billed every call |

The volume of cache reads per call is **thousands of times** larger than input. Even with a 90% discount, cache reads still dominate in absolute dollar terms.

And these calls aren't just from user messages:

| Caller | Frequency | Cache Read per Call |
|---|---|---|
| User messages | When the user sends a message | Entire accumulated conversation |
| **AI's own decisions** | **Multiple calls per user message** | Entire accumulated conversation |

Invisibly, the AI performs multiple decisions in sequence for a single user message — deciding which tool to use, interpreting the tool's result, deciding the next action. Each of these decisions is a full LLM call that includes the entire context. Tool execution itself (file reads, searches) runs locally, but the decision-making before and after each tool use incurs cache read costs.

### Why Is Cache Write Cost Also Larger Than Expected?

For Anthropic, cache write costs are 1.25x input (5-min tier) or 2x input (1-hour tier). At those multipliers, it seems like cache write shouldn't exceed 2x the input+output cost — but in practice, cache write takes a much larger share.

Two reasons:

| Cause | Explanation |
|---|---|
| **System prompt** | Tens of thousands of tokens before the user types anything (with plugins/MCP). All of this is subject to cache write costs |
| **Re-creation after expiry** | After the TTL (5 min / 1 hour) expires, the entire accumulated conversation must be re-cached. The longer the conversation, the higher the re-creation cost |

In other words, cache write doesn't only occur for "new tokens the user typed." At session start, the entire system prompt is cached; after expiry, the entire accumulated conversation becomes a cache write target. If a 100K-token conversation's cache expires, a single message triggers a 100K-token cache write all at once.

**This is exactly why the super-token-saver plugin displays a cache expiry warning after 1 hour of inactivity.** When the warning appears, check your current context size:

- **Small context**: Cache re-creation cost is manageable. Just continue working — the cost is low.
- **Large context**: Cache cost will be significant. We recommend `/clear` followed by `/s-continue last` to resume in a new session. The continue skill automatically restores your previous conversation context, so your workflow isn't interrupted.

## Strategies to Reduce Cache Costs

The super-token-saver plugin is designed to automate or simplify all of these strategies.

### 1. Keep Context Small — `/clear` + `/s-continue` ⭐

**This is the single most important way to reduce costs.** High cache costs mean you're receiving the 90% discount — that's normal. But if context grows unnecessarily large and stays that way, the absolute cost per call increases even with the discount. **Keeping context size under control is the single most effective cost management strategy.**

When the topic changes or the conversation gets long, run `/clear` to reset, then `/s-continue last` to restore previous context. `/s-continue` restores previous conversations without any LLM calls, so the cost is zero.

`/compact` reduces context by summarizing the conversation, but the summarization process itself incurs LLM call costs and discards conversation detail. Not recommended.

### 2. Prevent Cache Expiry — Token Guardian (Automatic)

Anthropic's main session cache uses a **1-hour tier**. After expiry, the first request must re-create the entire conversation as a cache write, which is expensive.

super-token-saver detects 1-hour idle states and **automatically displays a warning**. When the warning appears, using method 1 above (`/clear` + `/s-continue`) to continue in a new session is the most economical approach.

### 3. Delegate Heavy Work to SubTasks

Heavy tasks like code generation or multi-file edits can be delegated to SubTasks instead of running them directly in the main session. SubTasks use the 5-min cache tier, making **cache writes 37.5% cheaper**, and run in an isolated smaller context, reducing cache read volume per call.

super-token-saver automatically guides this work-separation pattern at session start.

### 4. Real-Time Cost Monitoring — `/setup-statusline`

Install `/setup-statusline` to display real-time cost/token status at the bottom of your CLI: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. You can spot abnormally high per-call costs or growing context immediately, allowing you to act before costs spike.

### 5. Cost Pattern Analysis — `/usage-view`

Use `/usage-view` to review your full usage history as a dashboard. Visualize daily/hourly cost trends, per-session token composition, and cache efficiency. See at a glance which tasks caused cost spikes and which patterns are inefficient.

### 6. System Prompt Optimization

The more plugins, MCP servers, and skills loaded into the system prompt, the higher the initial cache write cost. Remove anything you're not using.

super-token-saver's `/setup-git-lite` reduces Claude Code's default Git instructions (~2,200 tokens) to a core 280 tokens — an approximately 88% reduction in Git-related system prompt per session.

### 7. Tool Selection — Context Impact Varies by Tool

Once a file is read, its content stays in context and accumulates in cache reads for all subsequent calls. Reading a single file in full adds thousands to tens of thousands of tokens to the context, and that amount is billed on every subsequent call.

Coding tasks often involve multiple files simultaneously — reading just 3-4 files in full can cause context to grow dramatically. Choosing the right tool makes a significant difference in context growth.

| Tool | Purpose | Context Impact | When to Use |
|---|---|---|---|
| **Grep** | Search code by pattern | **Minimal** — returns only matching lines | Finding specific function names, variables, strings |
| **Glob** | Search files by name pattern | **Minimal** — returns only file paths | Finding file locations like `*.ts`, `src/**/*.test.js` |
| **LSP** | Symbol definitions, references, types | **Minimal** — returns only definitions/signatures | Go to definition, find references, check types |
| **Read** (offset/limit) | Read specific part of a file | **Moderate** — returns only specified range | When you need a specific line range |
| **Read** (full) | Read entire file | **Large** — entire file added to context | Only when you need to understand the full file structure |

"Read this entire file" uses tens to hundreds of times more context than "Find this function."

The same principle applies to editing and comparing:

| Tool | Purpose | Context Impact |
|---|---|---|
| **Edit** | Modify existing file | **Minimal** — only the diff is added to context |
| **Write** | Create new file / full rewrite | **Large** — entire file added to context |
| **git diff / diff** | Compare files/folders | **Minimal** — only differences returned |
| Read both files separately | Compare files/folders | **Large** — both full files added to context |

super-token-saver automatically injects this tool selection guide to the AI at session start, encouraging the use of lightweight tools first.

## Appendix: Cache Comparison Across AI Providers

### Cache Costs

| Provider | Cache Write Cost | Cache Read Discount | Cache Storage Cost |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5-min tier: 1.25x input<br/>1-hour tier: 2x input | 90% discount | None |
| **OpenAI**<br/>(Codex) | No premium (same as input) | 90% discount | None |
| **Google Gemini**<br/>(Gemini CLI) | No premium (same as input) | 90% discount | None |

> **Note**: Cache read discount rates vary by model. These figures reflect each provider's latest flagship models.

### Cache Time-to-Live (TTL)

| Provider | TTL | Guarantee |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minutes or 1 hour | **Explicitly defined** |
| **OpenAI**<br/>(Codex) | Typically evicted after 5-10 min of inactivity; may persist up to 1 hour during off-peak periods | **Not guaranteed** — official docs use "generally", "up to" |
| **Google Gemini**<br/>(Gemini CLI) | Undisclosed | **Not guaranteed** — explicit caching with guaranteed TTL is available via API (paid) |

> **Note**: Based on our experiments with Claude Code, main sessions typically use the 1-hour tier, while SubTasks use the 5-minute tier.

### Additional Cache Control Options via Direct API Calls

The comparison above is from the perspective of AI coding tool users (Claude Code, Codex, Gemini CLI). Developers calling the APIs directly have finer-grained cache control.

**Anthropic**

- `cache_control`: Set breakpoints to explicitly define cache boundaries. Auto-determined if not specified.
- TTL tier (5 min / 1 hour) can be selected per request.

**OpenAI**

- `prompt_cache_key`: Routes requests with the same key to the same server, improving cache hit rates. Codex internally sets this to `conversation_id` automatically.
- `prompt_cache_retention: "24h"`: Extended cache retention. Extends the default 5-10 min to up to 24 hours (no additional cost, not guaranteed). Codex does not use this option.

**Google Gemini**

- Explicit caching (`CachedContent`): Set TTL from 1 min to 48 hours to guarantee cache hits. Storage fee applies (\$4.50/MTok/hour for Pro). Cache content updates require manually creating a new CachedContent. Gemini CLI does not use this feature.

> **Note**: These options are not exposed in AI coding tools and cannot be directly controlled by users. AI coding tool users should refer to the "Strategies to Reduce Cache Costs" section in the main text.

### Sources

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
