# cc-token-saver

> **Claude Code 老是把你限速？这事到此为止。**
>
> 花更少的钱，写更久的代码，清楚看到每个 token 的去向——零配置。

怎么做到的？自动 context 管理、实时费用追踪、cache 感知的 session 控制——全部整合在一个插件里。

---

## 😤 问题：每月 $200，你还是干不完活

Claude Code Max Plan（$200/月）。应该够了吧。然而并不够。

**5 小时滚动窗口 rate limit。** 你正在专注写代码，它突然停了。没有倒计时，没有预计恢复时间。只能等。

**Cache 过期。** 你去吃个午饭回来，已经超过一小时。你发一条 prompt，900K token 按原价重新发送。费用？一次 $9。

**费用不可见。** 没有任何方式能实时看到你在花多少钱。直到撞上 rate limit 你才知道。

**全靠手动。** Context 大小、cache 过期时间、SubTask 委派、session 清理。没人能在写代码的同时追踪这一切。

cc-token-saver 自动处理所有这些。**安装一次，搞定。**

---

## 🚀 安装

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

安装后自动生效。零配置。需要 [Claude Code](https://claude.ai/claude-code) v2.1.71+。

实时监控：

```
/setup-statusline install
```

---

## 🛡️ 功能 1：Token Guardian

**检测 cache 过期，自动阻止高价重发。**

Claude Code 的 prompt cache TTL 是 1 小时。离开超过一小时，cache 就过期了。你的下一条消息会按原价重新发送整个 context。在 900K token 的情况下，一次就是 $9。

Token Guardian 追踪上一次响应的时间。如果超过 3,590 秒（TTL 减去 10 秒缓冲），它会阻止 prompt 并显示警告。

```
🚨 缓存已过期 (已空闲68分23秒)

提示缓存已过期，继续将重新发送全部上下文。
费用可能大幅增加。

👉 /context — 查看当前上下文使用量后再决定
👉 /clear → /continue — 重置后恢复之前的上下文（推荐，费用最低）
👉 直接重新发送 — 继续当前状态（全量重新缓存费用产生）
```

警告后再次发送同一条 prompt，它就会放行。警告每次空闲期只触发一次，不会反复打扰。警告消息支持 23 种语言，根据操作系统语言环境自动显示。

**效果：** 自动防止昂贵的重新缓存费用。无需任何操作。

---

## 🧠 功能 2：Smart Session Architecture

**安装即生效，自动进入成本优化的工作模式。**

大多数用户把所有事情都放在 Main session 里做。读文件、生成代码、跑测试。所有输出堆积到 context 中，每条消息都会被重新发送。Session 越来越臃肿，费用滚雪球式增长。

Session Architect 在 session 启动时自动注入委派策略。

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| 角色             | 设计、决策、审查                   | 实现、代码生成、多文件操作             |
| Cache 级别       | 1 小时 (ephemeral_1h)             | 5 分钟                                |
| Cache 写入费用   | ＄10/MTok                          | ＄6.25/MTok                            |
| Context 大小     | 平均约 94K                         | 平均约 33K                             |

SubTask 的 **cache 写入费用比 Main 便宜 37.5%**。Context 也小得多。把重活委派给 SubTask 可以大幅降低费用。

**效果：** Claude 自动按成本高效的模式工作。你不需要操心。

---

## 🔄 功能 3：/continue — Context 恢复

**替代 `/compact`。零 LLM 调用。零 token 费用。**

`/compact` 会把你的整个 context（约 1M token）发送给 LLM 生成 3.3% 的摘要。如果 cache 已过期，光这一步就会触发全量重新缓存。信息丢失不可避免。

`/continue` 采用完全不同的方式。它预处理之前的 session 记录并直接读入。不调用 LLM，不产生费用。原始对话原样恢复。

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| 工作方式                | 将完整 context 发送给 LLM 生成摘要 | 预处理记录，直接读入              |
| LLM 调用                | 需要（通常 100K+ token）           | 0                                |
| Token 费用              | 高                                | 0                                |
| 信息丢失                | 有（3.3% 摘要）                    | 无（原始内容保留）                |
| 处理速度                | 数十秒                             | < 1 秒（即使 60MB+ 文件）        |
| Cache 过期时              | 额外产生全量重新缓存费用           | 无影响                            |
| 多 session 恢复          | 不支持                             | 支持                              |

用法：先 `/clear`，再 `/continue`。你会看到之前的 session 列表，选择想恢复的即可。快速恢复：`/continue last`。

**效果：** 零费用恢复之前的工作。无信息丢失。

---

## 📊 功能 4：Live Status Line

**实时 token/费用监控。开销低于 50ms。**

运行一次 `/setup-statusline install`，Claude Code 底部就会出现一个常驻状态栏。

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| 指标             | 显示内容                             | 🟢 正常   | 🟡 警告    | 🔴 危险     |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (增量)       | 上一次 API 调用的费用                | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (累计)       | 当前文件夹的累计费用                 | —         | —          | —           |
| 5H               | 5 小时窗口使用率 + 重置倒计时        | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context 窗口使用率                   | < 35%     | >= 35%     | >= 70%      |

当任何指标进入警告或危险状态时，会自动出现 `→ /usage-view current` 提示。

卸载：`/setup-statusline uninstall`（自动恢复之前的配置）。

**效果：** 一眼看清费用状态。在为时已晚之前采取行动。

---

## 📈 使用仪表盘 (/usage-view)

**终于能回答："我为什么被 rate limit 了？"**

以前撞上 rate limit 只能生闷气。没法知道原因。哪个 session 烧了最多 token？费用什么时候飙升的？使用模式有什么规律？全是黑箱。

`/usage-view` 把一切展示出来。交互式 HTML 仪表盘会在浏览器中打开，让你分析使用模式、追踪费用飙升的根因。无外部依赖。独立运行。可作为文件分享。

包含内容：

- 每日/每小时/按星期统计的费用趋势——找出什么时候烧 token 最多
- Token 分类明细（输入、输出、cache 写入、cache 读取）——看清费用驱动因素
- 按 session 的费用分析——精确定位哪些任务最贵
- 5 小时窗口时间线（Max Plan 订阅用户）——追踪 rate limit 触发点
- AI 驱动的洞察分析——解读数据并给出改进建议
- 支持 23 种语言（包括 RTL；图表/表格保持 LTR）

```
/usage-view                  # 所有时间，所有项目
/usage-view current          # 仅当前 5 小时窗口
/usage-view last 7 days      # 最近 7 天
/usage-view locale zh        # 中文显示
```

---

## 🔬 Rate Limit 研究 (/report-limit)

**社区驱动的项目，逆向工程 rate limit 公式。**

Anthropic 没有公开 5 小时窗口的确切公式。让我们一起把它搞清楚。

当你撞上 rate limit 时，运行 `/report-limit`。你当时的使用数据会自动提交为 GitHub Discussion。收集的数据越多，公式就越清晰。

---

## 💡 Cache 的实际工作原理

Claude Code 每次 API 调用都会发送完整的对话历史。"API 调用"不等于"你输入的一条消息"。一条 prompt 会触发内部工具调用——Grep、Read、Edit、Write——每一个都是独立的 API 调用。一条 prompt 轻松产生 10+ 次 API 调用。

Prompt cache 将这个费用降低 90%。但 cache 有生命周期。

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 小时 (ephemeral_1h)                 | 5 分钟                                 |
| Cache 写入          | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache 读取          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Cache 过期时         | 全量 context 按原价重发               | 影响小（context 本身就小）              |

即使 cache 还活着，费用也在累积。以下是一个极端场景来展示差异。

### 场景：全天编码（上午 3 小时 → 午休/会议 2 小时 → 下午 3 小时）

条件：Opus 4 定价，每分钟 1 条 prompt，每条 prompt 约 5 次 API 调用（约 300 次/小时）。

#### ❌ 不使用 cc-token-saver

大部分工作在 Main session 中进行。Context 快速膨胀。

| 阶段        | 情况                               | Context 大小                | 费用                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| 上午 3 小时  | 编码（主要在 Main 中）             | 100K → 600K（平均 350K）    | 900 次 × 350K × ＄0.50/M = ＄157.50    |
| 午休/会议    | 离开 2 小时                        | —                          | —                                      |
| 回来        | Cache 过期 → 全量重发              | 600K 按原价                 | 600K × ＄5/M + 600K × ＄10/M = ＄9      |
| 回来        | /compact（生成摘要）               | 600K → 发送给 LLM           | 600K × ＄0.50/M + 摘要输出 = 约 ＄1.50   |
| 下午 3 小时  | 继续编码（context 重新膨胀）        | 100K → 600K（平均 350K）    | 900 次 × 350K × ＄0.50/M = ＄157.50    |
|             | 合计                               |                            | 约 ＄326                                |

> 在这个使用强度下，你很可能撞上 5 小时窗口 rate limit。**费用是一方面，真正的问题是你的工作被完全中断。这就是 Claude Code 突然罢工的那个瞬间。**

#### ✅ 使用 cc-token-saver

重活委派给 SubTask。Main 只处理设计/决策。

| 阶段        | 情况                                          | Context 大小                 | 费用                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| 上午 3 小时  | 编码（Main：设计，SubTask：实现）               | Main 100K → 300K（平均 200K）| 900 次 × 200K × ＄0.50/M = ＄90    |
| 午休/会议    | 离开 2 小时                                    | —                           | —                                  |
| 回来        | ⚡ Token Guardian 拦截 → /clear + /continue    | —                           | ＄0（无 LLM 调用）                  |
| 下午 3 小时  | 继续编码                                       | Main 100K → 300K（平均 200K）| 900 次 × 200K × ＄0.50/M = ＄90    |
|             | 合计                                           |                             | 约 ＄180                            |

#### 💰 结果

> **＄326 → ＄180。每天节省 ＄146（45%）。**
>
> 不仅仅是省钱。同样的时间内消耗更少的 token 意味着**你不会撞上 rate limit，可以持续工作。** 这才是真正的区别。

### cc-token-saver 在哪些环节介入

```
[Session 开始]
    │
    ├─ Session Architect → 自动注入 SubTask 委派模式
    │                       保持 Main context 低于 250K
    │
[工作中]
    │
    ├─ Status Line → 实时费用/context/rate limit 监控
    │                  进入警告区域时立即提醒
    │
[空闲 1 小时以上]
    │
    ├─ Token Guardian → 检测 cache 过期，在重发前拦截
    │
[Session 重启]
    │
    └─ /continue → 零费用恢复之前的 context（无 LLM 调用）
```

---

## 🔧 源码安装与自定义

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver 完全开源。整个源码由纯 JavaScript + Bash 脚本组成，遵循标准插件结构。随意修改。

- **hooks/** — 修改 cache 过期阈值、自定义警告消息、调整 session 架构规则
- **scripts/** — 分析逻辑、报告生成器、状态栏格式化
- **skills/** — /continue 和 /usage-view 的工作方式、prompt 模板
- **locales/** — 添加/编辑翻译、添加新语言
- **skills/usage-view/** — 仪表盘 UI/UX 设计调整

随意改造。Fork 它，实验，发现更好的方案就提 PR。

---

## 🌐 支持语言

支持 23 种语言。通过交叉对比 Claude Code 使用量前 20 的国家和全球使用人数前 20 的语言来选定。显示语言根据操作系统语言环境自动检测。也可以手动指定：`/usage-view locale zh`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

当前翻译由 AI 生成。欢迎母语使用者贡献——编辑 `locales/` 中对应语言的 JSON 文件，然后提交 PR。

---

## 💡 使用技巧

### 理解 cache，你就能看清钱花在哪里

- **1 条 prompt ≠ 1 次 API 调用。** 每次 Claude 调用 Grep、Read 或 Edit，整个 context 都会被重新发送。一条 prompt 轻松触发 10+ 次 API 调用。写清晰的 prompt 来减少不必要的工具调用，从而降低费用。
- **Cache 从上一次 API 调用开始计时，不是上一条 prompt。** 持续工作，cache 就永远不会过期。危险的是中途离开。Token Guardian 会自动拦截一次，所以你回来时可以选择：重置 context 或继续。
- **Context 大小 = 费用乘数。** 同样的 API 调用，200K 和 800K 的费用差 4 倍。当状态栏 [CTX] 超过 35%（🟡）时，就是你该增加 SubTask 委派的信号。

### 省钱好习惯

- **保持 CLAUDE.md 精简。** 它在每次 API 调用时都会加载到 system prompt 中。每一行都要花钱。
- **把重活委派给 SubTask。** 代码生成、多文件编辑、测试运行不应该在 Main 中进行。SubTask 的 context 更小，cache 级别更便宜。
- **离开 1 小时以上？** `/clear` → 回来 → `/continue`。$0 恢复 context。
- **[5H] 超过 70%（🟡）？** 放慢节奏。切换到轻量审查任务，或增加 SubTask 委派来减少 Main 的 API 调用次数。
- **用 `/btw` 提附带问题。** 它不会进入对话历史，所以你的 context 保持精简。

---

## License

Apache-2.0
