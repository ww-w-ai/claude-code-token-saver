# cc-token-saver

> **Claude Code cứ ngắt ngang hoài? Hết rồi.**
>
> Tiết kiệm hơn, code lâu hơn, biết rõ token đi đâu — không cần cấu hình gì cả.

Bằng cách nào? Tự động quản lý context, theo dõi chi phí thời gian thực, và điều khiển session nhận biết cache — tất cả gói gọn trong một plugin.

---

## 😤 Vấn đề: $200/tháng mà vẫn không làm được việc

Claude Code Max Plan ($200/tháng). Tưởng đủ. Nhưng không.

**Rate limit cửa sổ 5 giờ.** Bạn đang code ngon lành thì nó dừng. Không timer. Không ETA. Chỉ biết chờ.

**Cache hết hạn.** Bạn đi ăn trưa về. Đã hơn một giờ. Gửi một prompt và 900K token bị gửi lại nguyên giá. Chi phí? $9 cho một lần gửi.

**Chi phí vô hình.** Không có cách nào xem bạn đang tiêu bao nhiêu theo thời gian thực. Chỉ biết khi bị rate limit.

**Toàn phải làm tay.** Kích thước context, thời gian hết hạn cache, phân công SubTask, dọn dẹp session. Ai mà theo nổi hết trong khi đang code?

cc-token-saver xử lý tất cả tự động. **Cài một lần. Xong.**

---

## 🚀 Cài đặt

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Tự chạy ngay sau khi cài. Không cần cấu hình. Yêu cầu [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Để theo dõi trực tiếp:

```
/setup-statusline install
```

---

## 🛡️ Tính năng 1: Token Guardian

**Phát hiện cache hết hạn và tự động chặn gửi lại tốn kém.**

TTL cache prompt của Claude Code là 1 giờ. Rời máy hơn một giờ thì cache hết hạn. Tin nhắn tiếp theo gửi lại toàn bộ context nguyên giá. Với 900K token, đó là $9 một phát.

Token Guardian theo dõi thời điểm nhận phản hồi cuối cùng. Nếu đã qua 3.590 giây (TTL trừ 10 giây đệm), nó chặn prompt và hiện cảnh báo.

```
🚨 Bộ nhớ đệm hết hạn (không hoạt động 68p 23g)

Bộ nhớ đệm đã hết hạn. Tiếp tục sẽ gửi lại toàn bộ ngữ cảnh.
Chi phí có thể tăng đáng kể.

👉 /context — Kiểm tra mức sử dụng ngữ cảnh hiện tại trước khi quyết định
👉 /clear → /continue — Đặt lại rồi khôi phục ngữ cảnh trước đó (khuyến nghị, tiết kiệm nhất)
👉 Gửi lại — Tiếp tục như hiện tại (chi phí re-cache đầy đủ phát sinh)
```

Chỉ cần gửi lại prompt đó sau cảnh báo — nó sẽ đi qua. Cảnh báo chỉ hiện một lần mỗi lần idle, nên không bao giờ làm phiền. Tin nhắn cảnh báo hiển thị bằng 23 ngôn ngữ dựa trên locale hệ điều hành.

**Kết quả:** Chi phí re-cache đắt đỏ được ngăn chặn tự động. Không cần làm gì.

---

## 🧠 Tính năng 2: Smart Session Architecture

**Cài vào là mô hình làm việc tối ưu chi phí tự động chạy.**

Hầu hết người dùng làm mọi thứ trong Main session. Đọc file, sinh code, chạy test. Mọi output chất đống vào context và bị gửi lại với mỗi tin nhắn. Session phình to. Chi phí cứ tăng.

Session Architect tự động đưa chiến lược phân công vào đầu mỗi session.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Vai trò          | Thiết kế, quyết định, review      | Triển khai, sinh code, multi-file     |
| Cache tier       | 1 giờ (ephemeral_1h)              | 5 phút                               |
| Chi phí cache write | ＄10/MTok                       | ＄6.25/MTok                            |
| Kích thước context | ~94K trung bình                 | ~33K trung bình                       |

SubTask có **chi phí cache write rẻ hơn 37.5%** so với Main. Context cũng nhỏ hơn nhiều. Phân công việc nặng cho SubTask cắt giảm chi phí đáng kể.

**Kết quả:** Claude tự động làm việc theo mô hình tiết kiệm chi phí. Bạn không cần nghĩ gì.

---

## 🪶 Chế Độ Súc Tích

**Cùng nội dung. Ít đệm hơn. Bật mặc định.**

Cùng hook SessionStart cũng tiêm một quy tắc phong cách phản hồi chạy trong **mọi phiên và mọi model** — không cờ, không cài đặt. Ba điều thay đổi:

- **Bỏ phần mở đầu** — không "Để tôi kiểm tra…", "Giờ tôi sẽ…", lặp lại câu hỏi của bạn, hay tóm tắt những gì diff đã hiển thị
- **Định dạng phù hợp với nội dung** — bullet cho danh sách, văn xuôi cho lập luận (tradeoff, nhân quả, lý do). Không ép buộc bên nào
- **Diễn đạt chặt chẽ hơn** — cùng ý, ít từ hơn. Văn xuôi rõ ràng hơn là văn xuôi ngắn hơn

Giới hạn cứng: không bao giờ bỏ nội dung, bỏ qua xác minh, hay nén sắc thái thành một câu duy nhất. Bản chất giữ nguyên; chỉ vỏ bọc co lại.

Cài đặt một lần, áp dụng mọi nơi.

---


## 🔄 Tính năng 3: /continue — Khôi phục Context

**Thay thế `/compact`. Không gọi LLM. Không tốn token.**

`/compact` gửi toàn bộ context (~1M token) cho LLM để nén thành bản tóm tắt 3.3%. Nếu cache đã hết hạn, chỉ riêng việc đó đã kích hoạt re-cache toàn bộ. Mất thông tin là không tránh khỏi.

`/continue` dùng cách hoàn toàn khác. Nó tiền xử lý bản ghi session trước và nạp trực tiếp. Không gọi LLM. Không tốn chi phí. Cuộc hội thoại gốc được khôi phục nguyên vẹn.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Cách hoạt động          | Gửi toàn bộ context cho LLM để tóm tắt | Tiền xử lý bản ghi, đọc trực tiếp |
| Gọi LLM                | Bắt buộc (thường 100K+ token)    | 0                                |
| Chi phí token           | Cao                               | 0                                |
| Mất thông tin           | Có (bản tóm tắt 3.3%)            | Không (giữ nguyên bản gốc)      |
| Tốc độ xử lý           | Hàng chục giây                    | < 1 giây (kể cả file 60MB+)     |
| Khi cache hết hạn       | Thêm chi phí re-cache toàn bộ    | Không ảnh hưởng                  |
| Khôi phục multi-session | Không hỗ trợ                      | Hỗ trợ                          |

Cách dùng: `/clear` rồi `/continue`. Bạn sẽ thấy danh sách các session trước. Chọn một cái để khôi phục. Khôi phục nhanh: `/continue last`.

**Kết quả:** Tiếp tục công việc trước với chi phí bằng không. Không mất thông tin.

---

## 📊 Tính năng 4: Live Status Line

**Theo dõi token/chi phí thời gian thực. Overhead dưới 50ms.**

Chạy `/setup-statusline install` một lần và thanh trạng thái cố định xuất hiện ở cuối Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Chỉ số          | Hiển thị                            | 🟢 Bình thường | 🟡 Cảnh báo | 🔴 Nguy hiểm |
| ---------------- | ----------------------------------- | -------------- | ------------ | ------------- |
| RUN (delta)      | Chi phí lần gọi API cuối            | < ＄0.30       | >= ＄0.30     | >= ＄1.00      |
| RUN (tích lũy)   | Chi phí tích lũy cho thư mục này    | —              | —            | —             |
| 5H               | Mức dùng cửa sổ 5 giờ + đếm ngược reset | < 70%     | >= 70%       | >= 90%        |
| CTX              | Mức dùng context window             | < 35%          | >= 35%       | >= 70%        |

Khi bất kỳ chỉ số nào chạm mức cảnh báo hoặc nguy hiểm, gợi ý `→ /usage-view current` tự động xuất hiện.

Để gỡ: `/setup-statusline uninstall` (cấu hình trước được tự động khôi phục).

**Kết quả:** Nắm trạng thái chi phí trong nháy mắt. Hành động trước khi quá muộn.

---

## 📈 Bảng điều khiển sử dụng (/usage-view)

**Cuối cùng cũng trả lời được: "Tại sao tôi bị rate limit?"**

Trước giờ, bị rate limit chỉ biết bực. Không biết nguyên nhân. Session nào đốt nhiều token nhất? Chi phí tăng vọt khi nào? Có pattern gì trong cách dùng? Tất cả đều vô hình.

`/usage-view` cho thấy mọi thứ. Một bảng điều khiển HTML tương tác mở trong trình duyệt, cho bạn phân tích pattern sử dụng và truy tìm nguyên nhân tăng chi phí. Không phụ thuộc bên ngoài. Chạy độc lập. Chia sẻ được dưới dạng file.

Bao gồm:

- Xu hướng chi phí theo ngày / giờ / thứ — phát hiện khi nào bạn đốt nhiều token nhất
- Phân tích token (input, output, cache write, cache read) — xem cái gì đang tốn tiền
- Phân tích chi phí theo session — xác định task nào đắt
- Dòng thời gian cửa sổ 5 giờ (thuê bao Max Plan) — truy vết nguyên nhân rate limit
- Phân tích insight bằng AI — diễn giải dữ liệu và đề xuất cải thiện
- Hỗ trợ 23 ngôn ngữ (bao gồm RTL; biểu đồ/bảng giữ nguyên LTR)

```
/usage-view                  # Toàn bộ thời gian, tất cả project
/usage-view current          # Chỉ cửa sổ 5 giờ hiện tại
/usage-view last 7 days      # 7 ngày gần nhất
/usage-view locale vi        # Tiếng Việt
```

---

## 🔬 Nghiên cứu Rate Limit (/report-limit)

**Dự án cộng đồng nhằm dịch ngược công thức rate limit.**

Anthropic không công bố công thức chính xác cho cửa sổ 5 giờ. Hãy cùng tìm ra.

Khi bạn bị rate limit, chạy `/report-limit`. Dữ liệu sử dụng hiện tại được tự động gửi dưới dạng GitHub Discussion. Càng nhiều dữ liệu, công thức càng rõ.

---

## ✂️ Tính năng 5: /setup-git-lite — Cắt bỏ Hướng dẫn Git Tích hợp của CC

**2.200 token ẩn mỗi session mà bạn không biết mình đang trả.**

### Phát hiện

Ngày 2026-04-12, một [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) tiết lộ rằng cài đặt `includeGitInstructions` tích hợp của Claude Code âm thầm đốt token mỗi session. Tái hiện độc lập qua [gist này (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) xác nhận con số: **+6.031 token trong cache writes** mỗi session sau mỗi git commit, **+1.690 token trong cache reads** ở mỗi lần gọi API.

### Phân tích source CC — token đi đâu

Chúng tôi truy nguồn token tới hai điểm chèn độc lập trong source Claude Code (v2.1.88):

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` thu thập branch + main branch + user.name + full status (tối đa 2000 ký tự) + **5 commit gần nhất**
- Được nối và thêm vào system prompt qua `appendSystemContext` (`utils/api.ts:437`)
- Mỗi commit mới, file sửa đổi mới, chuyển branch đều thay đổi nội dung → vô hiệu hóa prefix cache

**2. Hướng dẫn quy trình commit/PR (~1.700 tok) — mô tả Bash tool**
- `tools/BashTool/prompt.ts:53` thêm 60+ dòng quy trình an toàn, hướng dẫn commit từng bước, ví dụ HEREDOC, và template tạo PR vào mô tả của `Bash` tool
- Được cache cùng system prompt, nhưng gửi dưới dạng tham số `tools[]`

### Tại sao lại tốn kém

Cấu trúc cache (`utils/api.ts:321` `splitSysPromptPrefix`) có ba path tùy theo việc bạn có MCP tools đang hoạt động hay không:

- **Path A** (MCP đang chạy — đa số người dùng): `gitStatus` nằm trong block `cacheScope: 'org'`. Bất kỳ thay đổi nào → toàn bộ block được cache lại ở lần khởi đầu session tiếp theo → 6K tok `cache_create` miss.
- **Path B** (không có MCP): `gitStatus` vào block dynamic `cacheScope: null`, nghĩa là nó được gửi lại dưới dạng `input_tokens` mới ở mỗi lần gọi API — không miss cache, nhưng cũng không có cache savings.
- **Path C** (nhà cung cấp 3P / experimental betas bị tắt): giống Path A.

Trong các session tương tác thông thường, hướng dẫn commit/PR (1,7K tok) tích lũy **ở mỗi lần gọi API** qua `cache_read`. Qua 100 lần gọi với giá Opus 4.7, đó là khoảng **$0,08 mỗi session** chỉ cho những hướng dẫn mà training của Claude đã phần lớn bao phủ.

### cc-token-saver xử lý thế nào

`/setup-git-lite` vô hiệu hóa path tích hợp và chèn một **bản thay thế 280 token được tinh chỉnh** qua SessionStart hook. Chúng tôi giữ lại đúng những gì ghi đè hành vi mặc định của Claude (quy tắc an toàn), và bỏ đi những gì Claude đã biết từ training (quy trình từng bước, PR template, pattern sử dụng gh).

**Giữ lại — 11 quy tắc ghi đè quan trọng** (những quy tắc chuyển tính hữu ích mặc định của Claude thành thận trọng):
- Không bao giờ commit/push/amend/PR/tag/merge nếu không có yêu cầu rõ ràng từ người dùng
- Không bao giờ bỏ qua hooks, force-push lên main/master, chạy các lệnh destructive, sửa git config
- Không bao giờ commit file khớp với `.env`, `credentials`, `*.pem`, `secret.*`
- Tránh `git add -A` / `git add .`
- HEREDOC cho commit message nhiều dòng + trailer `Co-Authored-By: Claude`
- Không dùng interactive flags (-i), không commit rỗng
- Nếu pre-commit hook thất bại → tạo commit MỚI (không dùng `--amend`)

**Bỏ đi** — quy trình commit từng bước (3 bước), quy trình PR từng bước (3 bước), template tiêu đề/nội dung PR, tham chiếu lệnh `gh`, cảnh báo flag `-uall`, cảnh báo `--no-edit` với rebase, ràng buộc `NEVER use TodoWrite or Agent tools during commit`. Đây là những quy trình dài dòng mà Claude tổng hợp đúng từ training.

**Thêm vào** — dòng trạng thái git compact: branch + HEAD short-sha + subject + trạng thái hiện tại (tối đa 20 file sửa đổi, hoặc một số đếm). Không có danh sách commit gần đây (Claude có thể chạy `git log` khi cần).

### Tiết kiệm dự kiến (giá Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Mục | Gốc | Với setup-git-lite | Tiết kiệm |
| ---- | -------- | ------------------- | ----- |
| Tải system prompt (mỗi session mới) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Các lần gọi lặp lại trong cùng session | ~1.700 tok cache_read/lần | ~280 tok cache_read/lần | ~1.420 tok/lần |
| Session 100 lần gọi (Opus 4.7) | — | — | **~$0,11 tiết kiệm** |
| 20 session/ngày × 22 ngày làm việc | — | — | **~$48 tiết kiệm/tháng** |

### Cách dùng

```bash
/setup-git-lite status     # Chẩn đoán chỉ đọc — trạng thái hiện tại + những gì sẽ thay đổi
/setup-git-lite install    # Vô hiệu hóa CC native + bật hook tối giản của chúng tôi
/setup-git-lite revert     # Khôi phục mặc định (aggressive; xem bên dưới)
/setup-git-lite dismiss-banner    # Tắt gợi ý đề xuất thỉnh thoảng xuất hiện
/setup-git-lite undismiss-banner  # Bật lại gợi ý
/setup-git-lite help       # Toàn bộ hướng dẫn sử dụng
```

### Ngữ nghĩa install

`install` sửa đổi **hai** nơi để đảm bảo tính ổn định:

1. `~/.claude/settings.json` — thêm `"includeGitInstructions": false`
2. Shell profile (`~/.zshrc`, `~/.bashrc`, v.v.) — thêm vào một marker block export `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Chỉ một trong hai là đủ để vô hiệu hóa CC native; chúng tôi đặt cả hai để env override không vô tình bật lại hành vi native. Thay đổi shell chỉ có hiệu lực ở shell mới.

### Ngữ nghĩa revert — aggressive

`revert` **xóa TẤT CẢ export `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` khỏi shell profile của bạn**, bao gồm cả những cái bạn có thể đã thêm thủ công trước khi cài skill này. Điều này là cố ý — bạn đã chạy `revert`, vậy chúng tôi khôi phục về mặc định sạch. Chúng tôi luôn tạo backup có timestamp của shell profile trước.

Nếu bạn cần biến env này cho lý do không liên quan, hãy ghi chú lại trước khi chạy `revert` và thêm lại sau.

### Trước khi gỡ cài đặt cc-token-saver

**Chạy `/setup-git-lite revert` trước**, nếu không bạn sẽ bị kẹt với `includeGitInstructions: false` trong settings.json nhưng không có hook thay thế (Claude không nhận được hướng dẫn git nào cả). Claude Code hiện không có lifecycle hook gỡ cài đặt plugin, nên chúng tôi không thể tự động hóa điều này.

### Đánh đổi

Những gì bạn mất (và tại sao thường không sao):
- Claude không còn nhận `git status` / `git log -n 5` được tính toán sẵn khi bắt đầu session. Nếu bạn hỏi "có gì thay đổi?" trong session mới, Claude sẽ tự chạy các lệnh đó (thêm một lần gọi tool, ~300 tok).
- Claude không còn thấy quy trình commit 3 bước chính thức của CC. Qua thử nghiệm của chúng tôi trên hàng trăm commit flow, kiến thức training-level xử lý được các trường hợp quan trọng (định dạng HEREDOC, không `--amend`, không force-push) vì chúng tôi giữ những cái đó như quy tắc rõ ràng.
- Template nội dung PR (`## Summary` + `## Test plan`) không được chèn. Nếu bạn quan tâm đến đúng định dạng đó, hãy đặt nó trong CLAUDE.md của project.

### Banner khuyến nghị

Khi hướng dẫn git native của CC vẫn đang hoạt động trên máy bạn, cc-token-saver hiển thị một đoạn gợi ý khi bắt đầu session **~20% số lần** (cộng thêm trong các output `/usage-view` và `/report-limit`). Tắt vĩnh viễn bằng `/setup-git-lite dismiss-banner`.

---

## 💡 Cache hoạt động thế nào

Claude Code gửi toàn bộ lịch sử hội thoại cho model ở mỗi lần gọi API. "Gọi API" không có nghĩa là "một tin nhắn bạn gõ." Một prompt kích hoạt các tool call nội bộ — Grep, Read, Edit, Write — và mỗi cái là một lần gọi API riêng. Một prompt dễ dàng gây ra 10+ lần gọi API.

Cache prompt giảm chi phí này 90%. Nhưng cache có thời hạn.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 giờ (ephemeral_1h)                  | 5 phút                                |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Khi cache hết hạn   | Toàn bộ context gửi lại nguyên giá   | Ảnh hưởng thấp (context nhỏ)          |

Kể cả khi cache còn sống, chi phí vẫn tích lũy. Dưới đây là kịch bản cực đoan để thấy sự khác biệt.

### Kịch bản: Code cả ngày (3h sáng → 2h trưa/họp → 3h chiều)

Điều kiện: Bảng giá Opus 4, 1 prompt mỗi phút, ~5 lần gọi API mỗi prompt (~300 lần/giờ).

#### ❌ Không có cc-token-saver

Hầu hết công việc diễn ra trong Main session. Context phình nhanh.

| Giai đoạn   | Tình huống                        | Kích thước context             | Chi phí                                |
| ----------- | --------------------------------- | ------------------------------ | -------------------------------------- |
| Sáng 3h     | Code (chủ yếu trong Main)        | 100K → 600K (trung bình 350K) | 900 lần × 350K × ＄0.50/M = ＄157.50   |
| Trưa/họp    | Rời máy 2 tiếng                  | —                              | —                                      |
| Quay lại    | Cache hết hạn → gửi lại toàn bộ  | 600K nguyên giá                | 600K × ＄5/M + 600K × ＄10/M = ＄9      |
| Quay lại    | /compact (tóm tắt)               | 600K → gửi cho LLM            | 600K × ＄0.50/M + output tóm tắt = ~＄1.50 |
| Chiều 3h    | Tiếp tục code (context phình lại) | 100K → 600K (trung bình 350K) | 900 lần × 350K × ＄0.50/M = ＄157.50   |
|             | Tổng                              |                                | ~＄326                                 |

> Với mức sử dụng này, bạn gần như chắc chắn sẽ bị rate limit cửa sổ 5 giờ. **Chi phí đã tệ, nhưng vấn đề thật sự là công việc bị dừng hoàn toàn. Đây chính là lúc Claude Code tắt ngúm.**

#### ✅ Có cc-token-saver

Việc nặng được phân công cho SubTask. Main chỉ lo thiết kế/quyết định.

| Giai đoạn   | Tình huống                                   | Kích thước context              | Chi phí                            |
| ----------- | -------------------------------------------- | ------------------------------- | ---------------------------------- |
| Sáng 3h     | Code (Main: thiết kế, SubTask: triển khai)   | Main 100K → 300K (trung bình 200K) | 900 lần × 200K × ＄0.50/M = ＄90 |
| Trưa/họp    | Rời máy 2 tiếng                              | —                               | —                                  |
| Quay lại    | ⚡ Token Guardian chặn → /clear + /continue  | —                               | ＄0 (không gọi LLM)               |
| Chiều 3h    | Tiếp tục code                                | Main 100K → 300K (trung bình 200K) | 900 lần × 200K × ＄0.50/M = ＄90 |
|             | Tổng                                         |                                 | ~＄180                              |

#### 💰 Kết quả

> **＄326 → ＄180. Tiết kiệm ＄146 mỗi ngày (45%).**
>
> Không chỉ về chi phí. Ít token hơn trong cùng khoảng thời gian nghĩa là **bạn không bị rate limit và có thể tiếp tục làm việc.** Đó mới là sự khác biệt thật sự.

### cc-token-saver can thiệp ở đâu

```
[Bắt đầu Session]
    │
    ├─ Session Architect → Tự động đưa vào mô hình phân công SubTask
    │                       Giữ context Main dưới 250K
    │
[Đang làm việc]
    │
    ├─ Status Line → Theo dõi chi phí/context/rate limit thời gian thực
    │                  Cảnh báo ngay khi vào vùng nguy hiểm
    │
[Idle 1+ giờ]
    │
    ├─ Token Guardian → Phát hiện cache hết hạn, chặn trước khi gửi lại
    │
[Khởi động lại session]
    │
    └─ /continue → Khôi phục context trước với chi phí bằng không (không gọi LLM)
```

---

## 🔧 Cài đặt từ source & Tùy chỉnh

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver hoàn toàn mở. Toàn bộ source là JavaScript thuần + Bash script theo cấu trúc plugin tiêu chuẩn. Muốn sửa gì thì sửa.

- **hooks/** — Thay đổi ngưỡng hết hạn cache, tùy chỉnh tin nhắn cảnh báo, sửa quy tắc session architecture
- **scripts/** — Logic phân tích, trình tạo báo cáo, định dạng status line
- **skills/** — Cách /continue và /usage-view hoạt động, prompt template
- **locales/** — Thêm/sửa bản dịch, thêm ngôn ngữ mới
- **skills/usage-view/** — Thay đổi UI/UX bảng điều khiển

Biến nó thành của bạn. Fork, thử nghiệm, và gửi PR nếu bạn tìm được cách tốt hơn.

---

## 🌐 Ngôn ngữ hỗ trợ

Hỗ trợ 23 ngôn ngữ. Được chọn bằng cách đối chiếu 20 quốc gia dùng Claude Code nhiều nhất với 20 ngôn ngữ có số người nói lớn nhất toàn cầu. Ngôn ngữ hiển thị được tự động phát hiện từ locale hệ điều hành. Bạn cũng có thể chỉ định thủ công: `/usage-view locale vi`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Bản dịch hiện tại được tạo bởi AI. Đóng góp từ người bản ngữ luôn được chào đón — chỉnh sửa file JSON cho ngôn ngữ của bạn trong `locales/` và gửi PR.

---

## 💡 Mẹo hay

### Hiểu cache là hiểu tiền đi đâu

- **1 prompt ≠ 1 lần gọi API.** Mỗi khi Claude gọi Grep, Read, hay Edit, toàn bộ context được gửi lại. Một prompt dễ dàng kích hoạt 10+ lần gọi API. Viết prompt rõ ràng để giảm tool call không cần thiết và cắt chi phí.
- **Bộ đếm cache reset từ lần gọi API cuối, không phải prompt cuối của bạn.** Cứ làm việc liên tục thì cache không bao giờ hết hạn. Nguy hiểm là khi rời máy. Token Guardian tự chặn một lần, nên khi quay lại bạn có thể chọn: reset context hoặc tiếp tục.
- **Kích thước context = hệ số chi phí.** Cùng một lần gọi API ở 200K so với 800K tốn gấp 4 lần. Khi status line [CTX] vượt 35% (🟡), đó là tín hiệu để phân công thêm cho SubTask.

### Thói quen giúp tiết kiệm

- **Giữ CLAUDE.md gọn nhẹ.** Nó được nạp vào system prompt ở mỗi lần gọi API. Mỗi dòng đều tốn tiền.
- **Phân công việc nặng cho SubTask.** Sinh code, sửa nhiều file, chạy test không nên nằm trong Main. SubTask có context nhỏ hơn và cache tier rẻ hơn.
- **Rời máy 1+ giờ?** `/clear` → quay lại → `/continue`. Context được khôi phục với $0.
- **[5H] trên 70% (🟡)?** Chậm lại. Chuyển sang task review nhẹ hoặc tăng phân công SubTask để giảm số lần gọi API của Main.
- **Dùng `/btw` cho câu hỏi phụ.** Nó không vào lịch sử hội thoại, nên context của bạn được giữ gọn.

---

## License

Apache-2.0
