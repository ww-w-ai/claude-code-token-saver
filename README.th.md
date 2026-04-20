# cc-token-saver

> **Claude Code ตัดจังหวะคุณบ่อยไหม? จบได้แล้ว**
>
> ใช้จ่ายน้อยลง เขียนโค้ดได้นานขึ้น และเห็นชัดว่า token ไปไหน — ไม่ต้องตั้งค่าอะไรเลย

ทำได้อย่างไร? จัดการ context อัตโนมัติ ติดตามค่าใช้จ่ายแบบเรียลไทม์ และควบคุม session โดยคำนึงถึง cache — ทั้งหมดรวมอยู่ในปลั๊กอินเดียว

---

## 😤 ปัญหา: จ่าย $200/เดือน แต่ยังทำงานไม่จบ

Claude Code Max Plan ($200/เดือน) ดูเหมือนจะพอ แต่ไม่พอ

**Rate limit แบบ 5-hour rolling window** คุณกำลังเขียนโค้ดอยู่ดีๆ แล้วมันก็หยุดไปเฉยๆ ไม่มีตัวจับเวลา ไม่มี ETA แค่รอ

**Cache หมดอายุ** คุณกลับมาจากพักกลางวัน ผ่านไปเกินหนึ่งชั่วโมง พิมพ์ prompt แค่ครั้งเดียว แต่ token 900K ถูกส่งซ้ำในราคาเต็ม ค่าใช้จ่าย? $9 ในครั้งเดียว

**ค่าใช้จ่ายที่มองไม่เห็น** ไม่มีทางดูได้ว่าตอนนี้ใช้จ่ายไปเท่าไหร่แบบเรียลไทม์ รู้ตัวอีกทีก็ตอนที่ rate limit โดนแล้ว

**ทุกอย่างต้องทำเอง** ขนาด context, จังหวะ cache หมดอายุ, การ delegate SubTask, การล้าง session ไม่มีใครตามทันทุกอย่างตอนที่กำลังเขียนโค้ดอยู่

cc-token-saver จัดการทั้งหมดให้อัตโนมัติ **ติดตั้งครั้งเดียว จบ**

---

## 🚀 การติดตั้ง

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

ทำงานอัตโนมัติหลังติดตั้ง ไม่ต้องตั้งค่า ต้องใช้ [Claude Code](https://claude.ai/claude-code) v2.1.71+

สำหรับการมอนิเตอร์แบบเรียลไทม์:

```
/setup-statusline install
```

---

## 🛡️ ฟีเจอร์ 1: Token Guardian

**ตรวจจับ cache หมดอายุ และบล็อกการส่งซ้ำราคาแพงโดยอัตโนมัติ**

Prompt cache TTL ของ Claude Code คือ 1 ชั่วโมง ออกไปนานเกินหนึ่งชั่วโมง cache ก็หมดอายุ ข้อความถัดไปจะส่ง context ทั้งหมดซ้ำในราคาเต็ม ถ้า token อยู่ที่ 900K นั่นคือ $9 ในครั้งเดียว

Token Guardian ติดตามว่าได้รับ response ครั้งสุดท้ายเมื่อไหร่ ถ้าผ่านไปเกิน 3,590 วินาที (TTL ลบ buffer 10 วินาที) จะบล็อก prompt และแสดงคำเตือน

```
🚨 แคชหมดอายุ (ไม่ใช้งาน 68น. 23วิ.)

แคชหมดอายุแล้ว ดำเนินการต่อจะส่งบริบททั้งหมดใหม่
ค่าใช้จ่ายอาจเพิ่มขึ้นอย่างมาก

👉 /context — ตรวจสอบการใช้งานบริบทปัจจุบันก่อนตัดสินใจ
👉 /clear → /continue — รีเซ็ตแล้วกู้คืนบริบทก่อนหน้า (แนะนำ, ประหยัดที่สุด)
👉 ส่งอีกครั้ง — ดำเนินการต่อตามเดิม (เกิดค่าใช้จ่ายรีแคชเต็ม)
```

แค่ส่ง prompt เดิมซ้ำหลังจากคำเตือน — ก็จะผ่านไปได้ คำเตือนจะแสดงแค่ครั้งเดียวต่อช่วงที่ไม่ใช้งาน จึงไม่รบกวน ข้อความเตือนรองรับ 23 ภาษาตาม locale ของ OS

**ผลลัพธ์:** ป้องกันค่าใช้จ่ายรีแคชราคาแพงโดยอัตโนมัติ ไม่ต้องทำอะไรเลย

---

## 🧠 ฟีเจอร์ 2: Smart Session Architecture

**ติดตั้งแล้วรูปแบบการทำงานที่ประหยัดต้นทุนก็เริ่มทำงานอัตโนมัติ**

ผู้ใช้ส่วนใหญ่ทำทุกอย่างใน Main session — อ่านไฟล์ สร้างโค้ด รัน test ทุก output ถูกกองเข้าไปใน context และส่งซ้ำทุกข้อความ Session บวมขึ้น ค่าใช้จ่ายพุ่ง

Session Architect จะ inject กลยุทธ์ delegation อัตโนมัติตอนเริ่ม session

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| บทบาท            | ออกแบบ, ตัดสินใจ, รีวิว            | ลงมือทำ, สร้างโค้ด, แก้หลายไฟล์         |
| Cache tier       | 1 ชั่วโมง (ephemeral_1h)           | 5 นาที                                 |
| Cache write cost | ＄10/MTok                          | ＄6.25/MTok                            |
| ขนาด context      | เฉลี่ย ~94K                        | เฉลี่ย ~33K                             |

SubTask มี **cache write ถูกกว่า 37.5%** เมื่อเทียบกับ Main และ context ก็เล็กกว่ามาก การ delegate งานหนักไปยัง SubTask ช่วยลดค่าใช้จ่ายได้อย่างมาก

**ผลลัพธ์:** Claude ทำงานในรูปแบบที่ประหยัดต้นทุนโดยอัตโนมัติ คุณไม่ต้องคิดเรื่องนี้เลย

---

## 🔄 ฟีเจอร์ 3: /continue — การกู้คืน Context

**แทนที่ `/compact` ไม่เรียก LLM ไม่เสีย token**

`/compact` ส่ง context ทั้งหมด (~1M token) ไปให้ LLM สรุปเหลือ 3.3% ถ้า cache หมดอายุแล้ว แค่นั้นก็ทำให้เกิดรีแคชเต็มราคา การสูญเสียข้อมูลเป็นสิ่งที่หลีกเลี่ยงไม่ได้

`/continue` ใช้วิธีที่ต่างกันโดยสิ้นเชิง มันประมวลผล transcript ของ session ก่อนหน้าแล้วโหลดเข้ามาโดยตรง ไม่เรียก LLM ไม่มีค่าใช้จ่าย บทสนทนาเดิมถูกกู้คืนตามที่เป็น

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| วิธีการทำงาน               | ส่ง context ทั้งหมดให้ LLM สรุป       | ประมวลผล transcript แล้วอ่านโดยตรง   |
| การเรียก LLM              | ต้องใช้ (ปกติ 100K+ token)          | 0                                |
| ค่าใช้จ่าย token            | สูง                                | 0                                |
| การสูญเสียข้อมูล            | มี (สรุปเหลือ 3.3%)                 | ไม่มี (เก็บต้นฉบับครบ)               |
| ความเร็วในการประมวลผล       | หลายสิบวินาที                        | < 1 วินาที (แม้ไฟล์ 60MB+)         |
| เมื่อ cache หมดอายุ        | มีค่ารีแคชเต็มเพิ่มเข้ามา              | ไม่มีผลกระทบ                        |
| กู้คืนหลาย session         | ทำไม่ได้                            | รองรับ                             |

วิธีใช้: `/clear` แล้วตามด้วย `/continue` จะเห็นรายการ session ก่อนหน้า เลือกอันที่ต้องการกู้คืน สำหรับการกู้คืนแบบเร็ว: `/continue last`

**ผลลัพธ์:** กลับมาทำงานต่อได้โดยไม่เสียค่าใช้จ่าย ไม่สูญเสียข้อมูล

---

## 📊 ฟีเจอร์ 4: Live Status Line

**มอนิเตอร์ token/ค่าใช้จ่ายแบบเรียลไทม์ overhead ไม่ถึง 50ms**

รัน `/setup-statusline install` ครั้งเดียว จะมีแถบสถานะถาวรปรากฏที่ด้านล่างของ Claude Code

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| ตัวบ่งชี้          | แสดงอะไร                              | 🟢 ปกติ    | 🟡 เตือน    | 🔴 วิกฤต    |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | ค่าใช้จ่ายของ API call ล่าสุด            | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | ค่าใช้จ่ายสะสมสำหรับโฟลเดอร์นี้           | —         | —          | —           |
| 5H               | การใช้งาน 5-hour window + เวลารีเซ็ต    | < 70%     | >= 70%     | >= 90%      |
| CTX              | การใช้งาน context window              | < 35%     | >= 35%     | >= 70%      |

เมื่อตัวบ่งชี้ใดถึงระดับเตือนหรือวิกฤต คำแนะนำ `→ /usage-view current` จะปรากฏโดยอัตโนมัติ

ถอนการติดตั้ง: `/setup-statusline uninstall` (การตั้งค่าเดิมจะถูกกู้คืนอัตโนมัติ)

**ผลลัพธ์:** เห็นสถานะค่าใช้จ่ายได้ในพริบตา จัดการก่อนที่จะสายเกินไป

---

## 📈 Usage Dashboard (/usage-view)

**ตอบคำถามได้สักทีว่า: "ทำไมถึงโดน rate limit?"**

ก่อนหน้านี้ โดน rate limit แล้วก็ได้แต่หงุดหงิด ไม่มีทางรู้สาเหตุ Session ไหนเผา token มากที่สุด? ค่าใช้จ่ายพุ่งตอนไหน? รูปแบบการใช้งานเป็นยังไง? มองไม่เห็นเลย

`/usage-view` แสดงทุกอย่าง Dashboard แบบ interactive เปิดในเบราว์เซอร์ ให้คุณวิเคราะห์รูปแบบการใช้งานและหาสาเหตุของค่าใช้จ่ายที่พุ่ง ไม่ต้องพึ่ง dependency ภายนอก ทำงานแบบ standalone แชร์เป็นไฟล์ได้

สิ่งที่รวมอยู่:

- แนวโน้มค่าใช้จ่ายรายวัน / รายชั่วโมง / ตามวันในสัปดาห์ — ระบุช่วงเวลาที่เผา token มากที่สุด
- การแยกรายละเอียด token (input, output, cache write, cache read) — เห็นว่าอะไรเป็นตัวผลักค่าใช้จ่าย
- การวิเคราะห์ค่าใช้จ่ายต่อ session — ระบุว่างานไหนแพง
- Timeline ของ 5-hour window (สำหรับผู้ใช้ Max Plan) — ติดตามต้นตอของ rate limit
- การวิเคราะห์เชิงลึกด้วย AI — ตีความข้อมูลและแนะนำการปรับปรุง
- รองรับ 23 ภาษา (รวม RTL; ตาราง/กราฟยังคงเป็น LTR)

```
/usage-view                  # ทุกช่วงเวลา ทุกโปรเจกต์
/usage-view current          # เฉพาะ 5-hour window ปัจจุบัน
/usage-view last 7 days      # 7 วันย้อนหลัง
/usage-view locale th        # ภาษาไทย
```

---

## 🔬 Rate Limit Research (/report-limit)

**โปรเจกต์ของชุมชนเพื่อ reverse-engineer สูตรคำนวณ rate limit**

Anthropic ไม่เปิดเผยสูตรที่แน่ชัดของ 5-hour window มาช่วยกันหาคำตอบ

เมื่อคุณโดน rate limit ให้รัน `/report-limit` ข้อมูลการใช้งานปัจจุบันของคุณจะถูกส่งเป็น GitHub Discussion โดยอัตโนมัติ ยิ่งเก็บข้อมูลมากเท่าไหร่ สูตรก็จะยิ่งชัดเจนขึ้น

---

## ✂️ ฟีเจอร์ 5: /setup-git-lite — ตัด Git Instructions ในตัวของ CC ออก

**2,200 token ที่ซ่อนอยู่ต่อ session ที่คุณไม่รู้ว่ากำลังจ่ายอยู่**

### การค้นพบ

เมื่อวันที่ 2026-04-12 [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) เปิดเผยว่าการตั้งค่า `includeGitInstructions` ในตัวของ Claude Code เผา token ทุก session โดยไม่บอกกล่าว การทดสอบซ้ำผ่าน [gist นี้ (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) ยืนยันตัวเลข: **+6,031 token ใน cache write** ต่อ session หลังแต่ละ git commit และ **+1,690 token ใน cache read** ทุก API call

### การวิเคราะห์ซอร์สโค้ด CC — token ไปอยู่ที่ไหน

เราติดตาม token ไปยังจุด injection อิสระสองจุดในซอร์สโค้ด Claude Code (v2.1.88):

**1. `gitStatus` snapshot (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` เก็บ branch + main branch + user.name + status เต็ม (ไม่เกิน 2000 ตัวอักษร) + **5 commit ล่าสุด**
- เชื่อมต่อและผนวกเข้า system prompt ผ่าน `appendSystemContext` (`utils/api.ts:437`)
- ทุก commit ใหม่ ทุกไฟล์ที่แก้ไข ทุกการ switch branch เปลี่ยนข้อความ → prefix cache invalidation

**2. คำแนะนำ workflow Commit/PR (~1,700 tok) — Bash tool description**
- `tools/BashTool/prompt.ts:53` ผนวก 60+ บรรทัดของ safety protocol, ขั้นตอน commit แบบ step-by-step, ตัวอย่าง HEREDOC และ PR template เข้ากับ description ของ `Bash` tool
- Cache ไปพร้อมกับ system prompt แต่ส่งเป็น parameter `tools[]`

### ทำไมถึงแพง

โครงสร้าง cache (`utils/api.ts:321` `splitSysPromptPrefix`) มีสามเส้นทางขึ้นอยู่กับว่าคุณมี MCP tool ที่ใช้งานอยู่หรือไม่:

- **Path A** (MCP ใช้งานอยู่ — ผู้ใช้ส่วนใหญ่): `gitStatus` อยู่ใน block `cacheScope: 'org'` การเปลี่ยนแปลงใดก็ตาม → ทั้ง block ถูก re-cache ตอนเริ่ม session ถัดไป → cache_create miss 6K tok
- **Path B** (ไม่มี MCP): `gitStatus` ไปยัง dynamic block `cacheScope: null` หมายความว่าถูกส่งซ้ำเป็น `input_tokens` ใหม่ทุก API call — ไม่มี cache miss แต่ก็ไม่ได้ประโยชน์จาก cache เลย
- **Path C** (3P provider / experimental betas ปิดอยู่): เหมือน Path A

ใน session แบบ interactive ทั่วไป คำแนะนำ commit/PR (1.7K tok) สะสม **ทุก API call** ผ่าน `cache_read` ตลอด 100 call ต่อ session ในราคา Opus 4.7 นั่นคือประมาณ **$0.08 ต่อ session** เพียงสำหรับคำแนะนำที่ training ของ Claude ส่วนใหญ่ครอบคลุมอยู่แล้ว

### cc-token-saver จัดการอย่างไร

`/setup-git-lite` ปิดการทำงานของเส้นทางดั้งเดิมและ inject **replacement 280 token ที่คัดสรรแล้ว** ผ่าน SessionStart hook เราเก็บเฉพาะสิ่งที่ override พฤติกรรมเริ่มต้นของ Claude (safety rules) และตัดทุกอย่างที่ Claude รู้จาก training อยู่แล้วออก (workflow แบบ step-by-step, PR template, รูปแบบการใช้ gh)

**เก็บไว้ — 11 กฎ override ที่สำคัญ** (กฎที่เปลี่ยน helpfulness เริ่มต้นของ Claude ให้เป็นความระมัดระวัง):
- ห้าม commit/push/amend/PR/tag/merge หากไม่มีคำขอชัดเจนจากผู้ใช้
- ห้าม skip hooks, force-push ไปยัง main/master, รัน destructive ops, แก้ไข git config
- ห้าม commit ไฟล์ที่ match `.env`, `credentials`, `*.pem`, `secret.*`
- หลีกเลี่ยง `git add -A` / `git add .`
- HEREDOC สำหรับ commit message หลายบรรทัด + trailer `Co-Authored-By: Claude`
- ห้ามใช้ interactive flags (-i), ห้าม commit ว่าง
- ถ้า pre-commit hook ล้มเหลว → สร้าง commit ใหม่ (ไม่ใช่ `--amend`)

**ตัดออก** — workflow commit แบบ step-by-step (3 ขั้นตอน), workflow PR แบบ step-by-step (3 ขั้นตอน), PR title/body template, อ้างอิง `gh` command, คำเตือน flag `-uall`, คำเตือน `--no-edit` กับ rebase, constraint `NEVER use TodoWrite or Agent tools during commit` สิ่งเหล่านี้คือ workflow verbosity ที่ Claude เขียนได้ถูกต้องจาก training เพียงอย่างเดียว

**เพิ่มเข้ามา** — git state บรรทัดเดียวแบบกระชับ: branch + HEAD short-sha + subject + สถานะปัจจุบัน (ไม่เกิน 20 ไฟล์ที่แก้ไข หรือแสดงเป็นจำนวน) ไม่มีรายการ recent commit (Claude สามารถรัน `git log` เองได้ตามต้องการ)

### การประหยัดที่คาดหวัง (ราคา Opus 4.7, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| รายการ | เดิม | กับ setup-git-lite | ประหยัด |
| ------ | ---- | ------------------- | ------- |
| โหลด system prompt (ต่อ session ใหม่) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| การเรียกซ้ำใน session เดียวกัน | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100-call session (Opus 4.7) | — | — | **~$0.11 ประหยัด** |
| 20 session/วัน × 22 วันทำงาน | — | — | **~$48 ประหยัด/เดือน** |

### วิธีใช้

```bash
/setup-git-lite status     # Diagnostic แบบอ่านอย่างเดียว — สถานะปัจจุบัน + สิ่งที่จะเปลี่ยน
/setup-git-lite install    # ปิด CC native + เปิด minimal hook ของเรา
/setup-git-lite revert     # คืนค่าเริ่มต้น (aggressive; ดูด้านล่าง)
/setup-git-lite dismiss    # ปิดเสียง recommendation tip ที่แสดงเป็นครั้งคราว
/setup-git-lite undismiss  # เปิดใช้ tip อีกครั้ง
/setup-git-lite help       # วิธีใช้งานเต็มรูปแบบ
```

### ความหมายของ install

`install` แก้ไข **สองที่** เพื่อความมั่นใจ:

1. `~/.claude/settings.json` — เพิ่ม `"includeGitInstructions": false`
2. Shell profile (`~/.zshrc`, `~/.bashrc`, ฯลฯ) — ผนวก marker block ที่ export `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

อย่างใดอย่างหนึ่งเพียงพอที่จะปิด CC native เราตั้งค่าทั้งสองเพื่อไม่ให้ environment override เปิดใช้ native behavior กลับมาโดยไม่ตั้งใจ การเปลี่ยนแปลง shell จะมีผลใน shell ใหม่เท่านั้น

### ความหมายของ revert — aggressive

`revert` **ลบ export `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` ทั้งหมดออกจาก shell profile ของคุณ** รวมถึงที่คุณอาจเพิ่มเองก่อนติดตั้ง skill นี้ นี่เป็นเจตนา — คุณรัน `revert` ดังนั้นเราคืนค่าเริ่มต้นที่สะอาด เราสร้าง backup ของ shell profile พร้อม timestamp ก่อนเสมอ

ถ้าคุณต้องการ env var นี้ด้วยเหตุผลอื่น ให้จดไว้ก่อนรัน `revert` แล้วเพิ่มกลับเข้าไปภายหลัง

### ก่อนถอนการติดตั้ง cc-token-saver

**รัน `/setup-git-lite revert` ก่อน** ไม่เช่นนั้นจะเหลือ `includeGitInstructions: false` ใน settings.json แต่ไม่มี replacement hook (Claude จะไม่ได้รับคำแนะนำ git เลย) Claude Code ยังไม่มี plugin uninstall lifecycle hook ดังนั้นเราไม่สามารถทำให้เป็นอัตโนมัติได้

### Trade-offs

สิ่งที่คุณสูญเสีย (และทำไมมักจะไม่เป็นปัญหา):
- Claude จะไม่ได้รับ `git status` / `git log -n 5` ที่คำนวณไว้ล่วงหน้าตอนเริ่ม session ถ้าคุณถามว่า "มีอะไรเปลี่ยนแปลงบ้าง?" ใน session ใหม่ Claude จะรัน command เหล่านั้นเอง (tool call เพิ่มขึ้นหนึ่งครั้ง ~300 tok)
- Claude จะไม่เห็นขั้นตอน commit 3 ขั้นตอนของ CC ในการทดสอบของเราผ่าน commit flow หลายร้อยครั้ง ความรู้ระดับ training จัดการกรณีสำคัญได้ (การจัดรูปแบบ HEREDOC, ไม่มี `--amend`, ไม่มี force-push) เพราะเราเก็บกฎเหล่านั้นเป็น explicit rules
- PR body template (`## Summary` + `## Test plan`) ไม่ถูก inject ถ้าคุณต้องการรูปแบบนั้นพอดี ใส่ไว้ใน CLAUDE.md ของโปรเจกต์ของคุณ

### Recommendation banner

เมื่อ git instructions ของ CC native ยังเปิดใช้งานอยู่บนเครื่องของคุณ cc-token-saver จะแสดง tip หนึ่งย่อหน้าตอนเริ่ม session **ประมาณ 20% ของเวลา** (รวมถึงใน output ของ `/usage-view` และ `/report-limit`) ปิดถาวรด้วย `/setup-git-lite dismiss`

---

## 💡 Cache ทำงานอย่างไร

Claude Code ส่งประวัติบทสนทนาทั้งหมดไปยังโมเดลทุกครั้งที่เรียก API "API call" ไม่ได้หมายถึง "ข้อความหนึ่งครั้งที่คุณพิมพ์" prompt เดียวจะเรียก tool ภายใน — Grep, Read, Edit, Write — และแต่ละครั้งคือ API call แยกต่างหาก prompt เดียวอาจทำให้เกิด API call มากกว่า 10 ครั้งได้ง่ายๆ

Prompt cache ลดค่าใช้จ่ายนี้ได้ 90% แต่ cache มีอายุจำกัด

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 ชั่วโมง (ephemeral_1h)                | 5 นาที                                   |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| เมื่อ cache หมดอายุ   | ส่ง context ทั้งหมดซ้ำในราคาเต็ม           | ผลกระทบต่ำ (context เล็ก)                 |

แม้ cache ยังอยู่ ค่าใช้จ่ายก็ยังสะสม นี่คือสถานการณ์สุดขั้วเพื่อแสดงความแตกต่าง

### สถานการณ์: เขียนโค้ดทั้งวัน (เช้า 3 ชม. → พักกลางวัน/ประชุม 2 ชม. → บ่าย 3 ชม.)

เงื่อนไข: ราคา Opus 4, 1 prompt ต่อนาที, ~5 API call ต่อ prompt (~300 call/ชั่วโมง)

#### ❌ ไม่มี cc-token-saver

งานส่วนใหญ่อยู่ใน Main session ขนาด context โตเร็ว

| ช่วง          | สถานการณ์                           | ขนาด context              | ค่าใช้จ่าย                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| เช้า 3 ชม.    | เขียนโค้ด (ส่วนใหญ่อยู่ใน Main)        | 100K → 600K (เฉลี่ย 350K)   | 900 call × 350K × ＄0.50/M = ＄157.50  |
| พักกลางวัน/ประชุม | ออกไป 2 ชั่วโมง                      | —                          | —                                      |
| กลับมา       | Cache หมดอายุ → ส่งซ้ำราคาเต็ม        | 600K ราคาเต็ม                | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| กลับมา       | /compact (สรุป)                    | 600K → ส่งให้ LLM            | 600K × ＄0.50/M + output สรุป = ~＄1.50  |
| บ่าย 3 ชม.    | เขียนโค้ดต่อ (context โตกลับมา)       | 100K → 600K (เฉลี่ย 350K)   | 900 call × 350K × ＄0.50/M = ＄157.50  |
|             | รวม                               |                            | ~＄326                                  |

> ที่ระดับการใช้งานนี้ คุณน่าจะโดน rate limit ของ 5-hour window **ค่าใช้จ่ายแย่ แต่ปัญหาจริงคืองานคุณหยุดลงทั้งหมด นี่คือตอนที่ Claude Code ดับไปเลย**

#### ✅ มี cc-token-saver

งานหนักถูก delegate ไปยัง SubTask โดย Main จัดการแค่ออกแบบ/ตัดสินใจ

| ช่วง          | สถานการณ์                                   | ขนาด context                 | ค่าใช้จ่าย                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| เช้า 3 ชม.    | เขียนโค้ด (Main: ออกแบบ, SubTask: ลงมือทำ)      | Main 100K → 300K (เฉลี่ย 200K) | 900 call × 200K × ＄0.50/M = ＄90  |
| พักกลางวัน/ประชุม | ออกไป 2 ชั่วโมง                                | —                           | —                                  |
| กลับมา       | ⚡ Token Guardian บล็อก → /clear + /continue   | —                           | ＄0 (ไม่เรียก LLM)                  |
| บ่าย 3 ชม.    | เขียนโค้ดต่อ                                   | Main 100K → 300K (เฉลี่ย 200K) | 900 call × 200K × ＄0.50/M = ＄90  |
|             | รวม                                          |                             | ~＄180                              |

#### 💰 ผลลัพธ์

> **＄326 → ＄180 ประหยัดได้ ＄146 ต่อวัน (45%)**
>
> ไม่ใช่แค่เรื่องค่าใช้จ่าย token น้อยลงในเวลาเท่าเดิม หมายความว่า **คุณไม่โดน rate limit และทำงานต่อได้ นั่นคือความแตกต่างที่แท้จริง**

### จุดที่ cc-token-saver เข้ามาทำงาน

```
[เริ่ม Session]
    │
    ├─ Session Architect → Inject รูปแบบ SubTask delegation อัตโนมัติ
    │                       รักษา context ของ Main ให้ต่ำกว่า 250K
    │
[ทำงาน]
    │
    ├─ Status Line → มอนิเตอร์ค่าใช้จ่าย/context/rate limit แบบเรียลไทม์
    │                  แจ้งเตือนทันทีเมื่อเข้าสู่โซนเตือน
    │
[ไม่ใช้งาน 1+ ชั่วโมง]
    │
    ├─ Token Guardian → ตรวจจับ cache หมดอายุ บล็อกก่อนส่งซ้ำ
    │
[เริ่ม session ใหม่]
    │
    └─ /continue → กู้คืน context ก่อนหน้าโดยไม่เสียค่าใช้จ่าย (ไม่เรียก LLM)
```

---

## 🔧 ติดตั้งจากซอร์สโค้ดและปรับแต่ง

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver เป็นโอเพนซอร์สเต็มรูปแบบ ซอร์สโค้ดทั้งหมดเป็น JavaScript + Bash script ตามโครงสร้างปลั๊กอินมาตรฐาน แก้ไขอะไรก็ได้ตามต้องการ

- **hooks/** — เปลี่ยน threshold การหมดอายุ cache, ปรับแต่งข้อความเตือน, แก้ไขกฎ session architecture
- **scripts/** — ลอจิกการวิเคราะห์, ตัวสร้างรายงาน, การจัดรูปแบบ status line
- **skills/** — วิธีการทำงานของ /continue และ /usage-view, prompt template
- **locales/** — เพิ่ม/แก้ไขคำแปล, เพิ่มภาษาใหม่
- **skills/usage-view/** — เปลี่ยนแปลง UI/UX ของ dashboard

ปรับแต่งตามใจคุณ Fork, ทดลอง, และส่ง PR ถ้าคุณเจออะไรที่ดีกว่า

---

## 🌐 ภาษาที่รองรับ

รองรับ 23 ภาษา คัดเลือกจากการเปรียบเทียบ 20 ประเทศที่ใช้ Claude Code มากที่สุด กับ 20 ภาษาที่มีผู้พูดมากที่สุดในโลก ภาษาที่แสดงจะถูกตรวจจับอัตโนมัติจาก locale ของ OS หรือจะระบุเองก็ได้: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

คำแปลปัจจุบันสร้างด้วย AI ยินดีต้อนรับเจ้าของภาษาที่ต้องการมีส่วนร่วม — แก้ไขไฟล์ JSON สำหรับภาษาของคุณใน `locales/` แล้วส่ง PR

---

## 💡 เคล็ดลับ

### เข้าใจ cache แล้วจะเห็นว่าเงินไปไหน

- **1 prompt ≠ 1 API call** ทุกครั้งที่ Claude เรียก Grep, Read หรือ Edit จะส่ง context ทั้งหมดซ้ำ prompt เดียวทำให้เกิด API call มากกว่า 10 ครั้งได้ง่ายๆ เขียน prompt ให้ชัดเจนเพื่อลด tool call ที่ไม่จำเป็นและประหยัดค่าใช้จ่าย
- **ตัวจับเวลา cache รีเซ็ตจาก API call ล่าสุด ไม่ใช่ prompt ล่าสุดของคุณ** ทำงานต่อเนื่องแล้ว cache จะไม่มีวันหมดอายุ อันตรายคือการออกไป Token Guardian จะบล็อกอัตโนมัติหนึ่งครั้ง เมื่อคุณกลับมาจะเลือกได้: รีเซ็ต context หรือทำต่อ
- **ขนาด context = ตัวคูณค่าใช้จ่าย** API call เดียวกันที่ 200K กับ 800K ต่างกัน 4 เท่า เมื่อ [CTX] ใน status line ข้าม 35% (🟡) นั่นคือสัญญาณให้ delegate ไปยัง SubTask มากขึ้น

### นิสัยที่ช่วยลดค่าใช้จ่าย

- **ทำ CLAUDE.md ให้กระชับ** มันถูกโหลดเข้า system prompt ทุก API call ทุกบรรทัดมีค่าใช้จ่าย
- **Delegate งานหนักไปยัง SubTask** การสร้างโค้ด, การแก้ไขหลายไฟล์, การรัน test ไม่ควรอยู่ใน Main เพราะ SubTask มี context เล็กกว่าและ cache tier ถูกกว่า
- **ออกไปนานกว่า 1 ชั่วโมง?** `/clear` → กลับมา → `/continue` กู้คืน context ได้ที่ $0
- **[5H] เกิน 70% (🟡)?** ชะลอลง เปลี่ยนไปทำงานรีวิวที่เบาๆ หรือเพิ่มการ delegate SubTask เพื่อลดจำนวน API call ของ Main
- **ใช้ `/btw` สำหรับคำถามนอกเรื่อง** ไม่เข้าประวัติบทสนทนา context จึงยังกระชับ

---

## License

Apache-2.0
