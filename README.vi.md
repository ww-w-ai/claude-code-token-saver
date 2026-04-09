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
