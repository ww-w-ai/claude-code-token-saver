# cc-token-saver

> **Claude Code বারবার আটকে যাচ্ছে? আর নয়।**
>
> কম খরচে, বেশিক্ষণ কোড করুন, এবং দেখুন আপনার token কোথায় যাচ্ছে — কোনো সেটআপ ছাড়াই।

কীভাবে? স্বয়ংক্রিয় context ব্যবস্থাপনা, রিয়েল-টাইম খরচ ট্র্যাকিং, এবং cache-সচেতন session নিয়ন্ত্রণ — সব একটি plugin-এ।

---

## 😤 সমস্যা: মাসে $200 দিয়েও কাজ শেষ হয় না

Claude Code Max Plan ($200/মাস)। যথেষ্ট হওয়ার কথা। কিন্তু হয় না।

**5 ঘণ্টার rolling window rate limit।** আপনি কোডিং-এ মগ্ন, হঠাৎ সব বন্ধ। কোনো টাইমার নেই। কোনো আনুমানিক সময় নেই। শুধু অপেক্ষা।

**Cache expiry।** দুপুরের খাবার থেকে ফিরলেন। এক ঘণ্টার বেশি হয়ে গেছে। একটা prompt পাঠালেন আর 900K token পুরো দামে আবার পাঠানো হলো। খরচ? এক শটে $9।

**অদৃশ্য খরচ।** রিয়েল-টাইমে কত খরচ হচ্ছে তা দেখার কোনো উপায় নেই। Rate limit না লাগা পর্যন্ত বুঝতেই পারবেন না।

**সব ম্যানুয়াল।** Context-এর আকার, cache expiry-এর সময়, SubTask delegation, session পরিষ্কার — কোডিং করতে করতে এসব কে ট্র্যাক করবে?

cc-token-saver এই সবকিছু স্বয়ংক্রিয়ভাবে সামলায়। **একবার ইনস্টল করুন। ব্যস।**

---

## 🚀 ইনস্টলেশন

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

ইনস্টলের পর স্বয়ংক্রিয়ভাবে কাজ করে। কোনো সেটআপ লাগে না। [Claude Code](https://claude.ai/claude-code) v2.1.71+ প্রয়োজন।

লাইভ মনিটরিং-এর জন্য:

```
/setup-statusline install
```

---

## 🛡️ Feature 1: Token Guardian

**Cache expiry শনাক্ত করে এবং স্বয়ংক্রিয়ভাবে ব্যয়বহুল পুনঃপ্রেরণ ব্লক করে।**

Claude Code-এর prompt cache TTL হলো 1 ঘণ্টা। এক ঘণ্টার বেশি সময় দূরে থাকলে cache মেয়াদোত্তীর্ণ হয়। পরের বার্তায় পুরো context পূর্ণ দামে আবার পাঠানো হয়। 900K token-এ তা $9 এক শটে।

Token Guardian ট্র্যাক করে শেষ কবে response এসেছিল। 3,590 সেকেন্ডের বেশি হলে (TTL বিয়োগ 10 সেকেন্ড বাফার), prompt ব্লক করে সতর্কতা দেখায়।

```
🚨 ক্যাশ মেয়াদোত্তীর্ণ (68মি 23সে নিষ্ক্রিয়)

ক্যাশ মেয়াদোত্তীর্ণ হয়েছে। চালিয়ে যেতে পুরো প্রসঙ্গ পুনরায় পাঠাতে হবে।

👉 /context — সিদ্ধান্ত নেওয়ার আগে বর্তমান প্রসঙ্গ ব্যবহার পরীক্ষা করুন
👉 /clear → /continue — রিসেট করে পূর্ববর্তী প্রসঙ্গ পুনরুদ্ধার করুন (প্রস্তাবিত, সর্বনিম্ন খরচ)
👉 পুনরায় পাঠান — যেমন আছে চালিয়ে যান (সম্পূর্ণ রি-ক্যাশ খরচ হবে)
```

সতর্কতার পর একই prompt আবার পাঠালেই তা চলে যায়। প্রতি নিষ্ক্রিয় পর্বে সতর্কতা মাত্র একবার আসে, তাই বিরক্তিকর হয় না। আপনার OS locale অনুসারে 23টি ভাষায় সতর্কতা বার্তা দেখায়।

**ফলাফল:** ব্যয়বহুল রি-cache খরচ স্বয়ংক্রিয়ভাবে রোধ হয়। কোনো চেষ্টা লাগে না।

---

## 🧠 Feature 2: Smart Session Architecture

**ইনস্টল করলেই খরচ-সাশ্রয়ী কাজের ধরন স্বয়ংক্রিয়ভাবে চালু হয়।**

বেশিরভাগ ব্যবহারকারী সব কাজ Main session-এ করেন। ফাইল পড়া, কোড তৈরি, টেস্ট চালানো। প্রতিটি আউটপুট context-এ জমা হয় এবং প্রতিটি বার্তায় আবার পাঠানো হয়। Session ফুলে যায়। খরচ বাড়তেই থাকে।

Session Architect স্বয়ংক্রিয়ভাবে session শুরুতে একটি delegation কৌশল ইনজেক্ট করে।

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| ভূমিকা           | ডিজাইন, সিদ্ধান্ত, রিভিউ         | বাস্তবায়ন, কোড তৈরি, মাল্টি-ফাইল এডিট |
| Cache tier       | 1 ঘণ্টা (ephemeral_1h)           | 5 মিনিট                               |
| Cache write খরচ  | ＄10/MTok                          | ＄6.25/MTok                            |
| Context আকার     | ~94K গড়                          | ~33K গড়                              |

SubTask-এ Main-এর তুলনায় **37.5% সস্তা cache write**। Context-ও অনেক ছোট। ভারী কাজ SubTask-এ দিলে খরচ নাটকীয়ভাবে কমে।

**ফলাফল:** Claude স্বয়ংক্রিয়ভাবে খরচ-সাশ্রয়ী প্যাটার্নে কাজ করে। আপনাকে ভাবতে হবে না।

---

## 🪶 সংক্ষিপ্ত মোড

**একই বিষয়বস্তু। কম প্যাডিং। ডিফল্টে চালু।**

একই SessionStart হুক একটি প্রতিক্রিয়া-শৈলীর নিয়মও ইনজেক্ট করে যা **প্রতিটি সেশন এবং প্রতিটি মডেলে** চলে — কোনো ফ্ল্যাগ নেই, কোনো সেটআপ নেই। তিনটি জিনিস পরিবর্তন হয়:

- **প্রস্তাবনা বাদ** — "চেক করে দেখি…", "এখন আমি…", আপনার প্রশ্ন পুনরাবৃত্তি, বা diff-এ ইতিমধ্যে দেখানো বিষয় পুনরায় সারসংক্ষেপ করা — কিছুই নয়
- **বিষয়বস্তুর জন্য সঠিক ফর্ম্যাট** — তালিকার জন্য বুলেট, যুক্তির জন্য গদ্য (ট্রেডঅফ, কার্যকারণ, যুক্তি)। কোনোটাই জোর করে চাপানো নয়
- **আরও আঁটসাঁট অভিব্যক্তি** — একই বিষয়, কম শব্দ। স্পষ্ট গদ্যই ছোট গদ্য

কঠোর সীমা: কখনো বিষয়বস্তু বাদ দেবেন না, যাচাই এড়াবেন না, বা সূক্ষ্মতাকে এক বাক্যে চাপিয়ে দেবেন না। মূল বিষয় অক্ষত থাকে; শুধু মোড়ক সংকুচিত হয়।

একবার ইনস্টল করুন, সর্বত্র প্রযোজ্য।

---


## 🔄 Feature 3: /continue — Context পুনরুদ্ধার

**`/compact`-এর বিকল্প। শূন্য LLM কল। শূন্য token খরচ।**

`/compact` আপনার পুরো context (~1M token) LLM-এ পাঠিয়ে 3.3% সারাংশে সংকুচিত করে। Cache মেয়াদোত্তীর্ণ হলে, শুধু এটাই পুরো রি-cache ট্রিগার করে। তথ্য হারানো অনিবার্য।

`/continue` সম্পূর্ণ ভিন্ন পদ্ধতি নেয়। আগের session transcript প্রিপ্রসেস করে সরাসরি লোড করে। কোনো LLM কল নেই। কোনো খরচ নেই। আসল কথোপকথন যেমন ছিল তেমনই ফিরে আসে।

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| কীভাবে কাজ করে          | পুরো context LLM-এ পাঠিয়ে সারাংশ করে | transcript প্রিপ্রসেস করে সরাসরি পড়ে |
| LLM কল                  | প্রয়োজন (সাধারণত 100K+ token)    | 0                                |
| Token খরচ               | বেশি                              | 0                                |
| তথ্য হারানো              | হ্যাঁ (3.3% সারাংশ)               | নেই (আসল সংরক্ষিত)               |
| প্রক্রিয়ার গতি           | কয়েক সেকেন্ড                   | < 1 সেকেন্ড (60MB+ ফাইলেও)       |
| Cache মেয়াদোত্তীর্ণ হলে  | উপরে পূর্ণ রি-cache খরচ যোগ       | কোনো প্রভাব নেই                  |
| মাল্টি-session পুনরুদ্ধার | সম্ভব নয়                          | সমর্থিত                          |

ব্যবহার: `/clear` তারপর `/continue`। আগের session-এর তালিকা দেখাবে। একটি বেছে নিন। দ্রুত পুনরুদ্ধার: `/continue last`।

**ফলাফল:** শূন্য খরচে আগের কাজ পুনরায় শুরু করুন। কোনো তথ্য হারাবে না।

---

## 📊 Feature 4: Live Status Line

**রিয়েল-টাইম token/খরচ মনিটরিং। 50ms-এর কম ওভারহেড।**

একবার `/setup-statusline install` চালান, Claude Code-এর নিচে একটি স্থায়ী status bar দেখাবে।

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| সূচক              | কী দেখায়                           | 🟢 স্বাভাবিক | 🟡 সতর্কতা  | 🔴 বিপদ      |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | শেষ API call-এর খরচ                | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | এই ফোল্ডারের মোট খরচ               | —         | —          | —           |
| 5H               | 5 ঘণ্টার window ব্যবহার + রিসেট কাউন্টডাউন | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context window ব্যবহার              | < 35%     | >= 35%     | >= 70%      |

কোনো সূচক সতর্কতা বা বিপদে পৌঁছালে স্বয়ংক্রিয়ভাবে `→ /usage-view current` পরামর্শ দেখাবে।

সরাতে: `/setup-statusline uninstall` (আগের কনফিগ স্বয়ংক্রিয়ভাবে পুনরুদ্ধার হবে)।

**ফলাফল:** এক নজরে খরচের অবস্থা দেখুন। দেরি হওয়ার আগেই ব্যবস্থা নিন।

---

## 📈 Usage Dashboard (/usage-view)

**অবশেষে উত্তর পান: "কেন আমি rate limit-এ আটকালাম?"**

এতদিন rate limit লাগলে শুধু রাগই হতো। কারণ জানার উপায় ছিল না। কোন session সবচেয়ে বেশি token পোড়ালো? কখন খরচ হঠাৎ বেড়ে গেল? ব্যবহারের কোনো প্যাটার্ন আছে? সব অদৃশ্য।

`/usage-view` সব দেখায়। একটি ইন্টারেক্টিভ HTML dashboard আপনার ব্রাউজারে খোলে, যেখানে ব্যবহারের প্যাটার্ন বিশ্লেষণ এবং খরচ বৃদ্ধির মূল কারণ খুঁজে বের করা যায়। কোনো বাহ্যিক নির্ভরতা নেই। একা কাজ করে। ফাইল হিসেবে শেয়ার করা যায়।

যা অন্তর্ভুক্ত:

- দৈনিক / ঘণ্টাভিত্তিক / সাপ্তাহিক খরচের ধারা — কখন সবচেয়ে বেশি token খরচ হচ্ছে তা চিহ্নিত করুন
- Token বিভাজন (input, output, cache write, cache read) — খরচের কারণ দেখুন
- প্রতি-session খরচ বিশ্লেষণ — কোন কাজগুলো ব্যয়বহুল ছিল তা চিহ্নিত করুন
- 5 ঘণ্টার window টাইমলাইন (Max Plan ব্যবহারকারীদের জন্য) — rate limit ট্রিগার ট্রেস করুন
- AI-চালিত বিশ্লেষণ — ডেটা ব্যাখ্যা করে এবং উন্নতির পরামর্শ দেয়
- 23টি ভাষা সমর্থিত (RTL সহ; চার্ট/টেবিল LTR থাকে)

```
/usage-view                  # সব সময়, সব প্রজেক্ট
/usage-view current          # শুধু বর্তমান 5 ঘণ্টার window
/usage-view last 7 days      # গত 7 দিন
/usage-view locale bn        # বাংলা
```

---

## 🔬 Rate Limit গবেষণা (/report-limit)

**Rate limit-এর সূত্র রিভার্স-ইঞ্জিনিয়ার করার কমিউনিটি-চালিত প্রকল্প।**

Anthropic 5 ঘণ্টার window-এর সঠিক সূত্র প্রকাশ করে না। আসুন সবাই মিলে বের করি।

Rate limit-এ আটকালে `/report-limit` চালান। আপনার বর্তমান ব্যবহারের ডেটা স্বয়ংক্রিয়ভাবে GitHub Discussion হিসেবে জমা হয়। যত বেশি ডেটা জমা হবে, সূত্র তত স্পষ্ট হবে।

---

## ✂️ Feature 5: /setup-git-lite — CC-এর বিল্ট-ইন Git নির্দেশনা ছাঁটাই করুন

**প্রতি session-এ লুকানো 2,200 token — যা আপনি জানতেনই না আপনি দিচ্ছেন।**

### আবিষ্কার

2026-04-12 তারিখে একটি [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) প্রকাশ করে যে Claude Code-এর বিল্ট-ইন `includeGitInstructions` সেটিং প্রতি session-এ নীরবে token পুড়িয়ে দেয়। [এই gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98)-এর মাধ্যমে স্বাধীনভাবে সংখ্যাগুলো নিশ্চিত হয়েছে: প্রতি git commit-এর পর প্রতি session-এ cache write-এ **+6,031 token**, এবং প্রতিটি API call-এ cache read-এ **+1,690 token**।

### CC সোর্স বিশ্লেষণ — token কোথায় যায়

আমরা token-গুলো Claude Code সোর্সে (v2.1.88) দুটি স্বাধীন injection point-এ ট্রেস করেছি:

**1. `gitStatus` snapshot (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` branch + main branch + user.name + full status (সর্বোচ্চ 2000 অক্ষর) + **সাম্প্রতিক 5টি commit** সংগ্রহ করে
- `appendSystemContext` (`utils/api.ts:437`) দিয়ে system prompt-এ যুক্ত করা হয়
- প্রতিটি নতুন commit, প্রতিটি নতুন modified ফাইল, প্রতিটি branch switch টেক্সট পরিবর্তন করে → prefix cache invalidation

**2. Commit/PR workflow নির্দেশনা (~1,700 tok) — Bash tool description**
- `tools/BashTool/prompt.ts:53` `Bash` tool-এর description-এ 60+ লাইনের safety protocol, ধাপে ধাপে commit পদ্ধতি, HEREDOC উদাহরণ এবং PR তৈরির টেমপ্লেট যুক্ত করে
- System prompt-এর সাথে cache করা হয়, কিন্তু `tools[]` parameter হিসেবে পাঠানো হয়

### কেন এটি ব্যয়বহুল

Cache কাঠামো (`utils/api.ts:321` `splitSysPromptPrefix`) MCP tool সক্রিয় আছে কি না তার উপর ভিত্তি করে তিনটি path রয়েছে:

- **Path A** (MCP সক্রিয় — বেশিরভাগ ব্যবহারকারী): `gitStatus` একটি `cacheScope: 'org'` ব্লকে থাকে। যেকোনো পরিবর্তন → পরের session শুরুতে পুরো ব্লক পুনরায় cache হয় → 6K tok `cache_create` miss।
- **Path B** (MCP নেই): `gitStatus` একটি `cacheScope: null` dynamic ব্লকে যায়, অর্থাৎ প্রতিটি API call-এ তাজা `input_tokens` হিসেবে পাঠানো হয় — cache miss নেই, কিন্তু cache সাশ্রয়ও নেই।
- **Path C** (3P provider / experimental betas নিষ্ক্রিয়): Path A-এর মতোই।

সাধারণ interactive session-এ, commit/PR নির্দেশনা (1.7K tok) প্রতিটি API call-এ `cache_read` হিসেবে **জমতে থাকে**। Opus 4.7 মূল্যে 100-call session-এ এটি শুধু নির্দেশনার জন্যই প্রায় **$0.08 প্রতি session** — যা Claude-এর training-ই বেশিরভাগ ক্ষেত্রে জানে।

### cc-token-saver কীভাবে এটি সামলায়

`/setup-git-lite` native path নিষ্ক্রিয় করে এবং একটি SessionStart hook-এর মাধ্যমে **280-token-এর একটি বাছাই করা প্রতিস্থাপন** ইনজেক্ট করে। আমরা ঠিক সেই জিনিসগুলো রেখেছি যা Claude-এর default helpfulness-কে সতর্কতায় পরিণত করে (safety rules), এবং বাদ দিয়েছি যা Claude training থেকেই জানে (ধাপে ধাপে workflow, PR টেমপ্লেট, gh usage pattern)।

**রাখা হয়েছে — 11টি গুরুত্বপূর্ণ override rule** (যেগুলো Claude-এর default helpfulness-কে সতর্কতায় পরিণত করে):
- স্পষ্ট user request ছাড়া কখনো commit/push/amend/PR/tag/merge করবে না
- কখনো hook skip করবে না, main/master-এ force-push করবে না, destructive op চালাবে না, git config পরিবর্তন করবে না
- `.env`, `credentials`, `*.pem`, `secret.*` মেলে এমন ফাইল কখনো commit করবে না
- `git add -A` / `git add .` এড়িয়ে চলবে
- Multi-line commit message-এর জন্য HEREDOC + `Co-Authored-By: Claude` trailer
- Interactive flag (-i) কখনো ব্যবহার করবে না, empty commit করবে না
- Pre-commit hook ব্যর্থ হলে → একটি NEW commit তৈরি করবে (`--amend` নয়)

**বাদ দেওয়া হয়েছে** — ধাপে ধাপে commit workflow (3 ধাপ), ধাপে ধাপে PR workflow (3 ধাপ), PR title/body টেমপ্লেট, `gh` command রেফারেন্স, `-uall` flag সতর্কতা, rebase-এর সাথে `--no-edit` সতর্কতা, commit-এর সময় `NEVER use TodoWrite or Agent tools` constraint। এগুলো workflow verbosity যা Claude training থেকেই সঠিকভাবে করতে পারে।

**যোগ করা হয়েছে** — compact git state লাইন: branch + HEAD short-sha + subject + বর্তমান status (সর্বোচ্চ 20টি modified ফাইল, তার বেশি হলে count)। সাম্প্রতিক commit তালিকা নেই (Claude প্রয়োজনে `git log` চালাতে পারে)।

### প্রত্যাশিত সাশ্রয় (Opus 4.7 মূল্য, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| আইটেম | মূল | setup-git-lite সহ | সাশ্রয় |
| ----- | --- | ----------------- | ------- |
| System prompt লোড (প্রতি নতুন session) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| একই session-এ পুনরাবৃত্তি call | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100-call session (Opus 4.7) | — | — | **~$0.11 সাশ্রয়** |
| 20 sessions/day × 22 কার্যদিবস | — | — | **~$48 সাশ্রয়/মাস** |

### ব্যবহার

```bash
/setup-git-lite status     # শুধু পড়ার জন্য diagnostic — বর্তমান অবস্থা + কী পরিবর্তন হবে
/setup-git-lite install    # CC native নিষ্ক্রিয় + আমাদের minimal hook সক্রিয়
/setup-git-lite revert     # ডিফল্ট পুনরুদ্ধার (aggressive; নিচে দেখুন)
/setup-git-lite dismiss-banner    # মাঝে মাঝে দেখানো recommendation tip বন্ধ করুন
/setup-git-lite undismiss-banner  # tip পুনরায় সক্রিয় করুন
/setup-git-lite help       # সম্পূর্ণ ব্যবহারবিধি
```

### Install semantics

`install` দুটি জায়গা পরিবর্তন করে:

1. `~/.claude/settings.json` — `"includeGitInstructions": false` যোগ করে
2. Shell profile (`~/.zshrc`, `~/.bashrc`, ইত্যাদি) — `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` export করা একটি marker block যুক্ত করে

যেকোনো একটিই CC native নিষ্ক্রিয় করার জন্য যথেষ্ট; আমরা দুটোই সেট করি যাতে কোনো environment override ভুলে native behavior পুনরায় সক্রিয় না করে। Shell পরিবর্তন কেবল নতুন shell-এ কার্যকর হবে।

### Revert semantics — aggressive

`revert` **আপনার shell profile থেকে সব `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` export মুছে দেয়**, install করার আগে নিজে যোগ করা কোনোটিও বাদ নেই। এটি ইচ্ছাকৃত — আপনি `revert` চালিয়েছেন, তাই আমরা পরিষ্কার ডিফল্ট পুনরুদ্ধার করি। Shell profile-এর একটি timestamped backup সবসময় তৈরি করা হয়।

অন্য কারণে এই env var দরকার হলে, `revert` চালানোর আগে লিখে রাখুন এবং পরে আবার যোগ করুন।

### cc-token-saver আনইনস্টলের আগে

**আগে `/setup-git-lite revert` চালান**, নাহলে settings.json-এ `includeGitInstructions: false` থেকে যাবে কিন্তু replacement hook থাকবে না (Claude কোনো git guidance পাবে না)। Claude Code-এ বর্তমানে কোনো plugin uninstall lifecycle hook নেই, তাই আমরা এটি স্বয়ংক্রিয় করতে পারছি না।

### Trade-off

কী হারাবেন (এবং কেন সাধারণত ঠিক আছে):
- Claude আর session শুরুতে pre-computed `git status` / `git log -n 5` পাবে না। নতুন session-এ "কী পরিবর্তন হয়েছে?" জিজ্ঞেস করলে Claude নিজেই সেই command চালাবে (একটি অতিরিক্ত tool call, ~300 tok)।
- Claude আর CC-এর canonical 3-step commit পদ্ধতি দেখবে না। শত শত commit flow-এ আমাদের পরীক্ষায়, training-level knowledge গুরুত্বপূর্ণ ক্ষেত্রগুলো (HEREDOC formatting, `--amend` নয়, force-push নয়) সামলায় কারণ আমরা সেগুলো explicit rule হিসেবে রাখি।
- PR body টেমপ্লেট (`## Summary` + `## Test plan`) inject করা হয় না। ঠিক সেই format চাইলে আপনার project-এর CLAUDE.md-তে রাখুন।

### Recommendation banner

আপনার মেশিনে CC native git instructions এখনো সক্রিয় থাকলে, cc-token-saver session শুরুতে **~20% সময়** একটি এক-অনুচ্ছেদের tip দেখায় (এছাড়া `/usage-view` এবং `/report-limit` output-এও)। `/setup-git-lite dismiss-banner` দিয়ে স্থায়ীভাবে বন্ধ করুন।

---

## 💡 Cache আসলে কীভাবে কাজ করে

Claude Code প্রতিটি API call-এ পুরো কথোপকথনের ইতিহাস মডেলে পাঠায়। "API call" মানে "আপনার টাইপ করা একটা বার্তা" নয়। একটি prompt অভ্যন্তরীণ tool call ট্রিগার করে — Grep, Read, Edit, Write — এবং প্রতিটি আলাদা API call। একটি prompt সহজেই 10+ API call ঘটাতে পারে।

Prompt cache এই খরচ 90% কমায়। কিন্তু cache-এর একটি আয়ুষ্কাল আছে।

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 ঘণ্টা (ephemeral_1h)               | 5 মিনিট                                |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Cache মেয়াদোত্তীর্ণ হলে | পুরো context পূর্ণ দামে পুনঃপ্রেরণ     | কম প্রভাব (context ছোট)                |

Cache সক্রিয় থাকলেও খরচ জমতে থাকে। পার্থক্য বোঝাতে একটি চরম পরিস্থিতি দেখুন।

### পরিস্থিতি: পুরো দিন কোডিং (সকালে 3 ঘণ্টা → 2 ঘণ্টা দুপুরের বিরতি/মিটিং → বিকেলে 3 ঘণ্টা)

শর্ত: Opus 4 মূল্য, প্রতি মিনিটে 1 prompt, প্রতি prompt-এ ~5 API call (~300 কল/ঘণ্টা)।

#### ❌ cc-token-saver ছাড়া

বেশিরভাগ কাজ Main session-এ হয়। Context দ্রুত বাড়ে।

| পর্ব         | পরিস্থিতি                          | Context আকার               | খরচ                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| সকাল 3 ঘণ্টা | কোডিং (বেশিরভাগ Main-এ)           | 100K → 600K (গড় 350K)     | 900 কল × 350K × ＄0.50/M = ＄157.50  |
| দুপুর/মিটিং  | 2 ঘণ্টা দূরে                       | —                          | —                                      |
| ফেরত         | Cache মেয়াদোত্তীর্ণ → পূর্ণ দামে পুনঃপ্রেরণ | 600K পূর্ণ দাম              | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| ফেরত         | /compact (সারাংশ)                  | 600K → LLM-এ পাঠানো        | 600K × ＄0.50/M + সারাংশ আউটপুট = ~＄1.50 |
| বিকেল 3 ঘণ্টা | কোডিং চলতে থাকে (context আবার বাড়ে) | 100K → 600K (গড় 350K)    | 900 কল × 350K × ＄0.50/M = ＄157.50  |
|             | মোট                               |                            | ~＄326                                  |

> এই মাত্রার ব্যবহারে আপনি সম্ভবত 5 ঘণ্টার window rate limit-এ আটকাবেন। **খরচ তো খারাপই, কিন্তু আসল সমস্যা হলো আপনার কাজ পুরোপুরি থেমে যাওয়া। ঠিক এই সময়েই Claude Code বন্ধ হয়ে যায়।**

#### ✅ cc-token-saver সহ

ভারী কাজ SubTask-এ delegated। Main শুধু ডিজাইন/সিদ্ধান্ত সামলায়।

| পর্ব         | পরিস্থিতি                                    | Context আকার                | খরচ                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| সকাল 3 ঘণ্টা | কোডিং (Main: ডিজাইন, SubTask: বাস্তবায়ন)     | Main 100K → 300K (গড় 200K)  | 900 কল × 200K × ＄0.50/M = ＄90 |
| দুপুর/মিটিং  | 2 ঘণ্টা দূরে                                 | —                           | —                                  |
| ফেরত         | ⚡ Token Guardian ব্লক করে → /clear + /continue | —                           | ＄0 (কোনো LLM কল নেই)              |
| বিকেল 3 ঘণ্টা | কোডিং চলতে থাকে                              | Main 100K → 300K (গড় 200K)  | 900 কল × 200K × ＄0.50/M = ＄90 |
|             | মোট                                         |                             | ~＄180                              |

#### 💰 ফলাফল

> **＄326 → ＄180। প্রতিদিন ＄146 সাশ্রয় (45%)।**
>
> শুধু খরচের ব্যাপার নয়। একই সময়ে কম token মানে **আপনি rate limit-এ আটকাবেন না এবং কাজ চালিয়ে যেতে পারবেন।** এটাই আসল পার্থক্য।

### কোথায় cc-token-saver কাজ করে

```
[Session শুরু]
    │
    ├─ Session Architect → স্বয়ংক্রিয়ভাবে SubTask delegation প্যাটার্ন ইনজেক্ট করে
    │                       Main context 250K-এর নিচে রাখে
    │
[কাজ চলছে]
    │
    ├─ Status Line → রিয়েল-টাইম খরচ/context/rate limit মনিটরিং
    │                  সতর্কতা জোনে ঢুকলে তাৎক্ষণিক সতর্কতা
    │
[1+ ঘণ্টা নিষ্ক্রিয়]
    │
    ├─ Token Guardian → cache expiry শনাক্ত করে, পুনঃপ্রেরণের আগে ব্লক করে
    │
[Session পুনরায় শুরু]
    │
    └─ /continue → শূন্য খরচে আগের context পুনরুদ্ধার (কোনো LLM কল নেই)
```

---

## 🔧 সোর্স ইনস্টল ও কাস্টমাইজেশন

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver সম্পূর্ণ ওপেন সোর্স। পুরো সোর্স প্লেইন JavaScript + Bash script, স্ট্যান্ডার্ড plugin কাঠামো অনুসরণ করে। যেকোনো কিছু পরিবর্তন করুন।

- **hooks/** — cache expiry থ্রেশহোল্ড পরিবর্তন, সতর্কতা বার্তা কাস্টমাইজ, session architecture নিয়ম পরিবর্তন
- **scripts/** — বিশ্লেষণ লজিক, রিপোর্ট বিল্ডার, status line ফরম্যাটিং
- **skills/** — /continue এবং /usage-view কীভাবে কাজ করে, prompt টেমপ্লেট
- **locales/** — অনুবাদ যোগ/সম্পাদনা, নতুন ভাষা যোগ
- **skills/usage-view/** — Dashboard UI/UX ডিজাইন পরিবর্তন

নিজের মতো করে বানান। Fork করুন, পরীক্ষা করুন, আরো ভালো কিছু পেলে PR পাঠান।

---

## 🌐 সমর্থিত ভাষাসমূহ

23টি ভাষা সমর্থিত। Claude Code ব্যবহারে শীর্ষ 20 দেশ এবং বিশ্বব্যাপী বক্তা সংখ্যায় শীর্ষ 20 ভাষার ক্রস-রেফারেন্স করে নির্বাচিত। প্রদর্শন ভাষা আপনার OS locale থেকে স্বয়ংক্রিয়ভাবে শনাক্ত হয়। ম্যানুয়ালিও নির্দিষ্ট করতে পারেন: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

বর্তমান অনুবাদগুলো AI-জেনারেটেড। নেটিভ স্পিকারদের অবদান স্বাগত — `locales/`-এ আপনার ভাষার JSON ফাইল সম্পাদনা করে PR জমা দিন।

---

## 💡 টিপস

### Cache বুঝলেই দেখবেন টাকা কোথায় যাচ্ছে

- **1 prompt ≠ 1 API call।** প্রতিবার Claude Grep, Read বা Edit কল করলে পুরো context আবার পাঠানো হয়। একটি prompt সহজেই 10+ API call ট্রিগার করে। পরিষ্কার prompt লিখুন, অপ্রয়োজনীয় tool call কমান, খরচ বাঁচান।
- **Cache টাইমার আপনার শেষ prompt থেকে নয়, শেষ API call থেকে রিসেট হয়।** কাজ চালিয়ে গেলে cache কখনো মেয়াদোত্তীর্ণ হয় না। বিপদ হলো দূরে থাকা। Token Guardian একবার স্বয়ংক্রিয়ভাবে ব্লক করে, তাই ফিরে এসে আপনি বেছে নিতে পারেন: context রিসেট করবেন নাকি চালিয়ে যাবেন।
- **Context আকার = খরচ গুণক।** একই API call 200K-তে বনাম 800K-তে 4 গুণ বেশি খরচ। Status line-এ [CTX] যখন 35% (🟡) পার করে, তখনই SubTask-এ আরো বেশি delegate করার সংকেত।

### খরচ কমানোর অভ্যাস

- **CLAUDE.md সংক্ষিপ্ত রাখুন।** প্রতিটি API call-এ এটি system prompt-এ লোড হয়। প্রতিটি লাইনে টাকা খরচ হয়।
- **ভারী কাজ SubTask-এ delegate করুন।** কোড তৈরি, মাল্টি-ফাইল সম্পাদনা, টেস্ট চালানো Main-এ করার দরকার নেই। SubTask-এর context ছোট এবং cache tier সস্তা।
- **1+ ঘণ্টা দূরে ছিলেন?** `/clear` → ফিরে আসুন → `/continue`। Context $0 খরচে পুনরুদ্ধার।
- **[5H] 70%-এর (🟡) উপরে?** ধীরে চলুন। হালকা রিভিউ কাজে যান অথবা SubTask delegation বাড়িয়ে Main-এর API call সংখ্যা কমান।
- **পার্শ্ব প্রশ্নে `/btw` ব্যবহার করুন।** এটি কথোপকথনের ইতিহাসে যায় না, তাই context ছোট থাকে।

---

## License

Apache-2.0
