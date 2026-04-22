# cc-token-saver

> **Claude Code बार-बार रुक जाता है? अब नहीं रुकेगा।**
>
> कम खर्च करें, ज़्यादा देर तक कोड करें, और देखें आपके token कहाँ जा रहे हैं — बिना किसी सेटअप के।

कैसे? स्वचालित context प्रबंधन, रियल-टाइम लागत ट्रैकिंग, और cache-aware session नियंत्रण — सब एक plugin में।

---

## 😤 समस्या: $200/महीना और फिर भी काम पूरा नहीं होता

Claude Code Max Plan ($200/महीना)। काफ़ी होना चाहिए। लेकिन नहीं है।

**5 घंटे का rolling window rate limit।** आप कोडिंग में डूबे हैं और अचानक सब रुक जाता है। कोई टाइमर नहीं। कोई ETA नहीं। बस इंतज़ार करो।

**Cache expiry।** आप लंच से लौटते हैं। एक घंटे से ज़्यादा हो गया। एक prompt भेजते हैं और 900K token पूरी कीमत पर दोबारा भेजे जाते हैं। लागत? एक बार में $9।

**छुपी हुई लागत।** रियल-टाइम में खर्च देखने का कोई तरीका नहीं। पता तब चलता है जब rate limit लग चुका होता है।

**सब कुछ मैन्युअल।** Context size, cache expiry टाइमिंग, SubTask delegation, session सफ़ाई। कोडिंग करते हुए यह सब ट्रैक करना नामुमकिन है।

cc-token-saver यह सब अपने-आप संभालता है। **एक बार इंस्टॉल करो। बस।**

---

## 🚀 इंस्टॉलेशन

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

इंस्टॉल के बाद अपने-आप काम करता है। कोई सेटअप नहीं। [Claude Code](https://claude.ai/claude-code) v2.1.71+ ज़रूरी है।

लाइव मॉनिटरिंग के लिए:

```
/setup-statusline install
```

---

## 🛡️ फ़ीचर 1: Token Guardian

**Cache expiry का पता लगाता है और महंगे re-send को अपने-आप रोकता है।**

Claude Code का prompt cache TTL 1 घंटा है। एक घंटे से ज़्यादा दूर रहें तो cache समाप्त हो जाता है। आपका अगला मैसेज पूरे context को पूरी कीमत पर दोबारा भेजता है। 900K token पर, यह एक बार में $9 है।

Token Guardian ट्रैक करता है कि आखिरी response कब मिला था। अगर 3,590 सेकंड से ज़्यादा बीत गए (TTL माइनस 10 सेकंड बफ़र), तो यह prompt को रोकता है और चेतावनी दिखाता है।

```
🚨 कैश समाप्त (68मि 23से निष्क्रिय)

कैश समाप्त हो गया है। जारी रखने पर पूरा संदर्भ दोबारा भेजा जाएगा।
लागत काफी बढ़ सकती है।

👉 /context — निर्णय लेने से पहले वर्तमान संदर्भ उपयोग जांचें
👉 /clear → /continue — रीसेट करें, फिर पिछला संदर्भ पुनर्स्थापित करें (अनुशंसित, सबसे सस्ता)
👉 दोबारा भेजें — जारी रखें जैसा है (पूर्ण री-कैश लागत लगेगी)
```

चेतावनी के बाद वही prompt दोबारा भेजें — यह चला जाएगा। चेतावनी हर idle अवधि में सिर्फ़ एक बार आती है, इसलिए कभी परेशान नहीं करती। चेतावनी संदेश आपके OS locale के अनुसार 23 भाषाओं में दिखाई देते हैं।

**नतीजा:** महंगी re-cache लागत अपने-आप रुक जाती है। कोई मेहनत नहीं।

---

## 🧠 फ़ीचर 2: Smart Session Architecture

**इंस्टॉल करें और लागत-अनुकूलित कार्यशैली अपने-आप शुरू हो जाती है।**

ज़्यादातर यूज़र सब कुछ Main session में करते हैं। फ़ाइल पढ़ना, कोड जनरेशन, टेस्ट रन। हर आउटपुट context में जुड़ता जाता है और हर मैसेज के साथ दोबारा भेजा जाता है। Session फूलता है। लागत बढ़ती जाती है।

Session Architect session शुरू होते ही अपने-आप एक delegation रणनीति इंजेक्ट करता है।

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| भूमिका           | डिज़ाइन, निर्णय, समीक्षा          | कार्यान्वयन, कोड जनरेशन, multi-file  |
| Cache tier       | 1 घंटा (ephemeral_1h)             | 5 मिनट                                |
| Cache write लागत | ＄10/MTok                          | ＄6.25/MTok                            |
| Context size     | ~94K औसत                          | ~33K औसत                              |

SubTask में Main की तुलना में **37.5% सस्ता cache write** होता है। Context भी बहुत छोटा होता है। भारी काम SubTask को सौंपने से लागत नाटकीय रूप से कम होती है।

**नतीजा:** Claude अपने-आप लागत-कुशल तरीके से काम करता है। आपको सोचने की ज़रूरत नहीं।

---

## 🔄 फ़ीचर 3: /continue — Context Restoration

**`/compact` की जगह। शून्य LLM कॉल। शून्य token लागत।**

`/compact` आपका पूरा context (~1M token) LLM को भेजकर 3.3% सारांश बनाता है। अगर cache समाप्त हो चुका है, तो इससे पूरा re-cache ट्रिगर होता है। जानकारी का नुकसान अनिवार्य है।

`/continue` बिलकुल अलग तरीका अपनाता है। यह पिछले session transcript को प्रीप्रोसेस करके सीधे लोड करता है। कोई LLM कॉल नहीं। कोई लागत नहीं। मूल बातचीत जैसी-की-तैसी बहाल होती है।

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| कैसे काम करता है        | पूरा context LLM को भेजकर सारांश | Transcript प्रीप्रोसेस, सीधे पढ़ें |
| LLM कॉल                | ज़रूरी (आमतौर पर 100K+ token)     | 0                                |
| Token लागत              | ज़्यादा                            | 0                                |
| जानकारी का नुकसान       | हाँ (3.3% सारांश)                 | कोई नहीं (मूल संरक्षित)          |
| प्रोसेसिंग गति          | दसियों सेकंड                      | < 1 सेकंड (60MB+ फ़ाइलों पर भी)  |
| Cache समाप्त होने पर    | ऊपर से पूरी re-cache लागत         | कोई प्रभाव नहीं                  |
| Multi-session restore   | संभव नहीं                         | समर्थित                          |

उपयोग: `/clear` फिर `/continue`। पिछले session की सूची दिखेगी। कोई एक चुनें। तेज़ रिकवरी के लिए: `/continue last`।

**नतीजा:** पिछला काम शून्य लागत पर फिर शुरू करें। कोई जानकारी नहीं खोती।

---

## 📊 फ़ीचर 4: Live Status Line

**रियल-टाइम token/लागत मॉनिटरिंग। 50ms से कम ओवरहेड।**

एक बार `/setup-statusline install` चलाएँ और Claude Code के नीचे एक स्थायी status bar दिखने लगेगा।

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| इंडिकेटर         | क्या दिखाता है                      | 🟢 सामान्य | 🟡 चेतावनी  | 🔴 गंभीर    |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | आखिरी API call की लागत              | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | इस फ़ोल्डर की कुल लागत              | —         | —          | —           |
| 5H               | 5-घंटे window उपयोग + रीसेट काउंटडाउन | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context window उपयोग                | < 35%     | >= 35%     | >= 70%      |

जब कोई भी इंडिकेटर चेतावनी या गंभीर स्तर पर पहुँचे, तो अपने-आप `→ /usage-view current` संकेत दिखता है।

हटाने के लिए: `/setup-statusline uninstall` (पिछली config अपने-आप बहाल हो जाती है)।

**नतीजा:** लागत की स्थिति एक नज़र में देखें। बहुत देर होने से पहले कदम उठाएँ।

---

## 📈 Usage Dashboard (/usage-view)

**आखिरकार इसका जवाब: "Rate limit क्यों लगा?"**

अब तक, rate limit लगने पर बस गुस्सा आता था। कारण जानने का कोई तरीका नहीं था। किस session ने सबसे ज़्यादा token जलाए? लागत कब बढ़ी? आपके उपयोग में कौन-से pattern हैं? सब अदृश्य।

`/usage-view` सब दिखाता है। एक इंटरैक्टिव HTML dashboard आपके ब्राउज़र में खुलता है, जिससे आप उपयोग pattern का विश्लेषण कर सकते हैं और लागत बढ़ने की असली वजह पता लगा सकते हैं। कोई बाहरी dependency नहीं। अकेले काम करता है। फ़ाइल के रूप में साझा किया जा सकता है।

क्या-क्या शामिल है:

- दैनिक / प्रति घंटा / साप्ताहिक लागत रुझान — पता लगाएँ कब सबसे ज़्यादा token खर्च होते हैं
- Token विभाजन (input, output, cache write, cache read) — देखें लागत किससे बढ़ रही है
- हर session की लागत विश्लेषण — पहचानें कौन-से काम महंगे पड़े
- 5-घंटे window timeline (Max Plan सदस्यों के लिए) — rate limit ट्रिगर का पता लगाएँ
- AI-संचालित insight विश्लेषण — डेटा की व्याख्या करता है और सुधार सुझाता है
- 23 भाषाओं का समर्थन (RTL शामिल; charts/tables LTR रहते हैं)

```
/usage-view                  # सभी समय, सभी प्रोजेक्ट
/usage-view current          # केवल वर्तमान 5-घंटे window
/usage-view last 7 days      # पिछले 7 दिन
/usage-view locale hi        # हिन्दी
```

---

## 🔬 Rate Limit शोध (/report-limit)

**Rate limit फ़ॉर्मूला रिवर्स-इंजीनियर करने के लिए समुदाय-संचालित प्रोजेक्ट।**

Anthropic 5-घंटे window का सटीक फ़ॉर्मूला प्रकाशित नहीं करता। चलो मिलकर पता लगाते हैं।

जब rate limit लगे, `/report-limit` चलाएँ। आपका वर्तमान उपयोग डेटा अपने-आप GitHub Discussion के रूप में जमा हो जाता है। जितना ज़्यादा डेटा इकट्ठा होगा, फ़ॉर्मूला उतना साफ़ होता जाएगा।

---

## ✂️ फ़ीचर 5: /setup-git-lite — CC की बिल्ट-इन Git Instructions को छोटा करें

**वो छुपे हुए 2,200 token प्रति session जिनके बारे में आपको पता नहीं था।**

### खोज

2026-04-12 को एक [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) से पता चला कि Claude Code की बिल्ट-इन `includeGitInstructions` सेटिंग हर session में चुपचाप token जलाती है। [इस gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) के ज़रिए स्वतंत्र रूप से इसकी पुष्टि हुई: हर git commit के बाद प्रति session **cache writes में +6,031 token**, और हर API call पर **cache reads में +1,690 token**।

### CC सोर्स विश्लेषण — token कहाँ जाते हैं

हमने token को Claude Code source (v2.1.88) के दो स्वतंत्र injection points तक ट्रेस किया:

**1. `gitStatus` snapshot (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` branch + main branch + user.name + full status (2000 chars तक) + **हाल के 5 commits** इकट्ठा करता है
- `appendSystemContext` (`utils/api.ts:437`) के ज़रिए system prompt में जोड़ा जाता है
- हर नया commit, हर नई modified file, हर branch switch text बदलता है → prefix cache invalidation

**2. Commit/PR workflow instructions (~1,700 tok) — Bash tool description**
- `tools/BashTool/prompt.ts:53` `Bash` tool की description में 60+ lines का safety protocol, step-by-step commit procedure, HEREDOC examples, और PR creation templates जोड़ता है
- System prompt के साथ cache होता है, लेकिन `tools[]` parameter के रूप में भेजा जाता है

### यह महंगा क्यों है

Cache structure (`utils/api.ts:321` `splitSysPromptPrefix`) में MCP tools की सक्रियता के आधार पर तीन paths हैं:

- **Path A** (MCP active — ज़्यादातर users): `gitStatus` एक `cacheScope: 'org'` block में होता है। कोई भी बदलाव → अगले session start पर पूरा block दोबारा cache → 6K tok `cache_create` miss।
- **Path B** (no MCP): `gitStatus` एक `cacheScope: null` dynamic block में जाता है, यानी हर API call पर fresh `input_tokens` के रूप में भेजा जाता है — कोई cache miss नहीं, लेकिन कोई cache बचत भी नहीं।
- **Path C** (3P provider / experimental betas disabled): Path A जैसा।

सामान्य interactive sessions में, commit/PR instructions (1.7K tok) हर API call पर `cache_read` के ज़रिए जमा होते हैं। Opus 4.7 pricing पर 100-call session में, यह सिर्फ़ instructions के लिए **~$0.08 प्रति session** है — जो Claude की training पहले से ज़्यादातर जानती है।

### cc-token-saver इसे कैसे संभालता है

`/setup-git-lite` native path को disable करके एक SessionStart hook के ज़रिए **280-token का curated replacement** inject करता है। हमने सिर्फ़ वही चीज़ें रखी हैं जो Claude के default behavior को override करती हैं (safety rules), और वो सब हटा दिया जो Claude training से पहले से जानता है (step-by-step workflows, PR templates, gh usage patterns)।

**रखे गए — 11 critical override rules** (जो Claude की default helpfulness को सावधानी में बदलते हैं):
- बिना explicit user request के commit/push/amend/PR/tag/merge कभी नहीं
- Hooks कभी skip नहीं, force-push to main/master नहीं, destructive ops नहीं, git config modify नहीं
- `.env`, `credentials`, `*.pem`, `secret.*` से मिलती files कभी commit नहीं
- `git add -A` / `git add .` से बचें
- Multi-line commit messages के लिए HEREDOC + `Co-Authored-By: Claude` trailer
- Interactive flags (-i) कभी नहीं, empty commits नहीं
- Pre-commit hook fail हो → NEW commit बनाएँ (`--amend` नहीं)

**हटाए गए** — step-by-step commit workflow (3 steps), step-by-step PR workflow (3 steps), PR title/body template, `gh` command references, `-uall` flag warning, `--no-edit` with rebase warning, `NEVER use TodoWrite or Agent tools during commit` constraint। ये workflow verbosity है जो Claude training से खुद सही तरीके से compose करता है।

**जोड़ा गया** — compact git state line: branch + HEAD short-sha + subject + current status (20 modified files तक, वरना count)। Recent commits list नहीं (Claude ज़रूरत पर `git log` खुद चला सकता है)।

### अपेक्षित बचत (Opus 4.7 pricing, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| Item | मूल | setup-git-lite के साथ | बचत |
| ---- | --- | --------------------- | --- |
| System prompt load (प्रति नया session) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| Same session में repeat calls | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100-call session (Opus 4.7) | — | — | **~$0.11 बचत** |
| 20 sessions/day × 22 workdays | — | — | **~$48 बचत/महीना** |

### उपयोग

```bash
/setup-git-lite status     # Read-only diagnostic — वर्तमान स्थिति + क्या बदलेगा
/setup-git-lite install    # CC native disable + हमारा minimal hook enable करें
/setup-git-lite revert     # Default वापस लाएँ (aggressive; नीचे देखें)
/setup-git-lite dismiss-banner    # कभी-कभार आने वाला recommendation tip बंद करें
/setup-git-lite undismiss-banner  # Tip दोबारा चालू करें
/setup-git-lite help       # पूरा उपयोग
```

### Install semantics

`install` मज़बूती के लिए **दो** जगह बदलाव करता है:

1. `~/.claude/settings.json` — `"includeGitInstructions": false` जोड़ता है
2. Shell profile (`~/.zshrc`, `~/.bashrc`, आदि) — `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` export करने वाला marker block जोड़ता है

कोई भी एक अकेला native disable करने के लिए काफ़ी है; हम दोनों सेट करते हैं ताकि environment override गलती से native behavior दोबारा चालू न करे। Shell का बदलाव नए shells में ही लागू होगा।

### Revert semantics — aggressive

`revert` **आपके shell profile से सभी `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` exports हटा देता है**, चाहे वो इस skill को install करने से पहले मैन्युअली जोड़े गए हों। यह जानबूझकर है — आपने `revert` चलाया, तो हम clean default वापस लाते हैं। Shell profile का timestamped backup पहले बना लिया जाता है।

अगर यह env var किसी और कारण से चाहिए, तो `revert` चलाने से पहले नोट कर लें और बाद में वापस जोड़ें।

### cc-token-saver uninstall करने से पहले

**पहले `/setup-git-lite revert` चलाएँ**, वरना आपके settings.json में `includeGitInstructions: false` रह जाएगा लेकिन replacement hook नहीं होगा (Claude को कोई git guidance नहीं मिलेगी)। Claude Code में फ़िलहाल कोई plugin uninstall lifecycle hook नहीं है, इसलिए हम इसे automate नहीं कर सकते।

### Trade-offs

क्या खोते हैं (और क्यों आमतौर पर ठीक है):
- Session शुरू होने पर Claude को pre-computed `git status` / `git log -n 5` नहीं मिलता। नए session में "क्या बदला है?" पूछने पर Claude खुद वो commands चलाएगा (एक extra tool call, ~300 tok)।
- Claude को CC का canonical 3-step commit procedure नहीं मिलता। सैकड़ों commit flows में हमारे testing से पता चला कि training-level knowledge critical cases संभाल लेती है (HEREDOC formatting, no `--amend`, no force-push) क्योंकि वो rules हम explicit रखते हैं।
- PR body template (`## Summary` + `## Test plan`) inject नहीं होता। अगर आपको exactly वही format चाहिए, तो अपने project के CLAUDE.md में डालें।

### Recommendation banner

जब आपकी machine पर CC native git instructions अभी भी active हों, cc-token-saver session start पर **~20% बार** एक paragraph का tip दिखाता है (साथ ही `/usage-view` और `/report-limit` outputs में भी)। `/setup-git-lite dismiss-banner` से स्थायी रूप से बंद करें।

---

## 💡 Cache असल में कैसे काम करता है

Claude Code हर API call पर पूरा बातचीत इतिहास model को भेजता है। "API call" का मतलब "आपका एक मैसेज" नहीं है। एक prompt आंतरिक tool calls ट्रिगर करता है — Grep, Read, Edit, Write — और हर एक अलग API call है। एक prompt आसानी से 10+ API call करता है।

Prompt cache इस लागत को 90% कम करता है। लेकिन cache की उम्र सीमित है।

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 घंटा (ephemeral_1h)                 | 5 मिनट                                 |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Cache समाप्त होने पर | पूरा context पूरी कीमत पर दोबारा भेजा | कम प्रभाव (context छोटा होता है)        |

Cache चालू रहने पर भी लागत जमा होती है। अंतर दिखाने के लिए यहाँ एक चरम परिदृश्य है।

### परिदृश्य: पूरे दिन कोडिंग (3 घंटे सुबह → 2 घंटे लंच/मीटिंग → 3 घंटे दोपहर)

शर्तें: Opus 4 मूल्य निर्धारण, 1 prompt प्रति मिनट, ~5 API call प्रति prompt (~300 call/घंटा)।

#### ❌ cc-token-saver के बिना

ज़्यादातर काम Main session में होता है। Context तेज़ी से बढ़ता है।

| चरण          | स्थिति                            | Context size               | लागत                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| सुबह 3 घंटे  | कोडिंग (ज़्यादातर Main में)         | 100K → 600K (औसत 350K)    | 900 call × 350K × ＄0.50/M = ＄157.50  |
| लंच/मीटिंग   | 2 घंटे दूर                        | —                          | —                                      |
| वापसी        | Cache समाप्त → पूरा re-send       | 600K पूरी कीमत             | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| वापसी        | /compact (सारांश)                 | 600K → LLM को भेजा         | 600K × ＄0.50/M + summary output = ~＄1.50 |
| दोपहर 3 घंटे | कोडिंग जारी (context फिर बढ़ता है) | 100K → 600K (औसत 350K)    | 900 call × 350K × ＄0.50/M = ＄157.50  |
|             | कुल                               |                            | ~＄326                                  |

> इस उपयोग स्तर पर, आप 5-घंटे window rate limit से टकराएँगे। **लागत बुरी है, लेकिन असली समस्या यह है कि आपका काम पूरी तरह रुक जाता है। यही वह पल है जब Claude Code बंद हो जाता है।**

#### ✅ cc-token-saver के साथ

भारी काम SubTask को सौंपा जाता है। Main सिर्फ़ डिज़ाइन/निर्णय संभालता है।

| चरण          | स्थिति                                        | Context size                | लागत                               |
| ----------- | --------------------------------------------- | --------------------------- | ---------------------------------- |
| सुबह 3 घंटे  | कोडिंग (Main: डिज़ाइन, SubTask: कार्यान्वयन)   | Main 100K → 300K (औसत 200K) | 900 call × 200K × ＄0.50/M = ＄90 |
| लंच/मीटिंग   | 2 घंटे दूर                                    | —                           | —                                  |
| वापसी        | ⚡ Token Guardian रोकता है → /clear + /continue | —                           | ＄0 (कोई LLM call नहीं)            |
| दोपहर 3 घंटे | कोडिंग जारी                                    | Main 100K → 300K (औसत 200K) | 900 call × 200K × ＄0.50/M = ＄90 |
|             | कुल                                           |                             | ~＄180                              |

#### 💰 नतीजा

> **＄326 → ＄180। प्रतिदिन ＄146 की बचत (45%)।**
>
> यह सिर्फ़ लागत की बात नहीं है। कम समय में कम token का मतलब है **rate limit नहीं लगता और आप काम जारी रख सकते हैं।** यही असली फ़र्क है।

### cc-token-saver कहाँ काम आता है

```
[Session शुरू]
    │
    ├─ Session Architect → SubTask delegation pattern अपने-आप इंजेक्ट करता है
    │                       Main context को 250K से नीचे रखता है
    │
[काम चल रहा है]
    │
    ├─ Status Line → रियल-टाइम लागत/context/rate limit मॉनिटरिंग
    │                  चेतावनी ज़ोन में प्रवेश पर तुरंत सूचना
    │
[1+ घंटा निष्क्रिय]
    │
    ├─ Token Guardian → Cache expiry का पता लगाता है, re-send से पहले रोकता है
    │
[Session पुनः शुरू]
    │
    └─ /continue → शून्य लागत पर पिछला context बहाल करता है (कोई LLM call नहीं)
```

---

## 🔧 सोर्स इंस्टॉल और कस्टमाइज़ेशन

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver पूरी तरह ओपन है। पूरा सोर्स सादा JavaScript + Bash scripts है, मानक plugin संरचना का पालन करता है। जो चाहे बदलें।

- **hooks/** — Cache expiry threshold बदलें, चेतावनी संदेश कस्टमाइज़ करें, session architecture नियम संशोधित करें
- **scripts/** — विश्लेषण लॉजिक, रिपोर्ट बिल्डर, status line फ़ॉर्मेटिंग
- **skills/** — /continue और /usage-view कैसे काम करते हैं, prompt templates
- **locales/** — अनुवाद जोड़ें/संपादित करें, नई भाषाएँ जोड़ें
- **skills/usage-view/** — Dashboard UI/UX डिज़ाइन बदलाव

इसे अपना बनाइए। Fork करें, प्रयोग करें, और कुछ बेहतर मिले तो PR भेजें।

---

## 🌐 समर्थित भाषाएँ

23 भाषाएँ समर्थित। Claude Code उपयोग के शीर्ष 20 देशों और वैश्विक वक्ताओं की संख्या के अनुसार शीर्ष 20 भाषाओं को क्रॉस-रेफ़रेंस करके चुनी गई हैं। प्रदर्शन भाषा आपके OS locale से अपने-आप पहचानी जाती है। मैन्युअली भी निर्दिष्ट कर सकते हैं: `/usage-view locale hi`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

वर्तमान अनुवाद AI-जनित हैं। मूल भाषी योगदान का स्वागत है — `locales/` में अपनी भाषा की JSON फ़ाइल संपादित करें और PR सबमिट करें।

---

## 💡 सुझाव

### Cache को समझें और आपको दिखेगा पैसा कहाँ जा रहा है

- **1 prompt ≠ 1 API call।** हर बार जब Claude Grep, Read, या Edit कॉल करता है, पूरा context दोबारा भेजा जाता है। एक prompt आसानी से 10+ API call ट्रिगर करता है। स्पष्ट prompt लिखें ताकि अनावश्यक tool call कम हों और लागत घटे।
- **Cache टाइमर आपके आखिरी prompt से नहीं, बल्कि आखिरी API call से रीसेट होता है।** काम करते रहें तो cache कभी समाप्त नहीं होता। खतरा तब है जब आप दूर जाते हैं। Token Guardian एक बार अपने-आप रोकता है, ताकि लौटने पर आप चुन सकें: context रीसेट करें या जारी रखें।
- **Context size = लागत गुणक।** वही API call 200K बनाम 800K पर 4 गुना ज़्यादा महंगी है। जब status line [CTX] 35% (🟡) पार करे, तो यह संकेत है कि SubTask को ज़्यादा काम सौंपें।

### लागत घटाने की आदतें

- **CLAUDE.md को हल्का रखें।** यह हर API call पर system prompt में लोड होता है। हर लाइन की कीमत है।
- **भारी काम SubTask को सौंपें।** कोड जनरेशन, multi-file edits, टेस्ट रन Main में नहीं होने चाहिए। SubTask का context छोटा और cache tier सस्ता होता है।
- **1+ घंटे दूर रहें?** `/clear` → वापस आएँ → `/continue`। Context $0 पर बहाल।
- **[5H] 70% (🟡) से ऊपर?** रफ़्तार धीमी करें। हल्के review कार्यों पर जाएँ या SubTask delegation बढ़ाएँ ताकि Main के API call कम हों।
- **साइड सवालों के लिए `/btw` इस्तेमाल करें।** यह बातचीत इतिहास में नहीं जाता, इसलिए context हल्का रहता है।

---

## License

Apache-2.0
