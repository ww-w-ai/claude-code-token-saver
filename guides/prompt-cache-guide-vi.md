# Hướng dẫn Chi phí Cache — Tại sao Phần lớn Chi phí của Bạn đến từ Cache

Việc phần lớn chi phí công cụ AI coding đến từ các thao tác cache (write + read) là hoàn toàn bình thường. Tài liệu này giải thích lý do và cách quản lý.

## Bí mật: Mỗi Tin nhắn Gửi lại Toàn bộ Cuộc trò chuyện

LLM là **stateless**. Không giống con người, mô hình AI không "nhớ" cuộc trò chuyện trước — chúng nhận toàn bộ lịch sử trò chuyện làm input trong mọi yêu cầu.

Trông giống như chat, nhưng các lệnh gọi API thực tế hoạt động như thế này:

```
[ Yêu cầu 1 ]
→ System prompt + "Sửa bug này"
← Phản hồi AI

[ Yêu cầu 2 ]
→ System prompt + "Sửa bug này" + Phản hồi AI + "Thêm test nữa"
← Phản hồi AI

[ Yêu cầu 3 ]
→ System prompt + "Sửa bug này" + Phản hồi AI + "Thêm test nữa" + Phản hồi AI + "Commit đi"
← Phản hồi AI
```

Mỗi yêu cầu bao gồm **tất cả** nội dung trước đó. Ví dụ, yêu cầu thứ 50 chứa toàn bộ cuộc trò chuyện và tất cả phản hồi AI từ 49 yêu cầu trước. Đây là lý do token input tăng nhanh khi cuộc trò chuyện dài hơn.

Ngoài ra, các công cụ AI coding gửi system prompt (hướng dẫn tích hợp, file cấu hình, plugin, định nghĩa tool MCP, v.v.) cùng mỗi yêu cầu — nên ngay cả một tin nhắn một dòng cũng tạo ra hàng chục nghìn token input.

## Cache là gì?

**Prompt caching** giảm chi phí truyền lại lặp đi lặp lại này. Nó lưu trữ các phần không thay đổi của input trên server để các yêu cầu tiếp theo có thể tái sử dụng với mức giá ưu đãi.

- **Cache Write**: Chi phí lưu trữ nội dung trò chuyện trên server. Xảy ra ở yêu cầu đầu tiên hoặc sau khi cache hết hạn.
- **Cache Read**: Chi phí tái sử dụng nội dung đã lưu. Được tính với **giảm giá 90%** so với input tiêu chuẩn.

Các công cụ AI coding tự nhiên tạo ra cuộc trò chuyện dài và ngữ cảnh lớn, lên đến 1 triệu token mỗi yêu cầu. Dù câu hỏi mới của bạn ngắn, toàn bộ cuộc trò chuyện trước đó vẫn được tính phí kèm theo, nên chi phí tích lũy nhanh chóng khi cuộc trò chuyện dài hơn.

Để giảm gánh nặng này, các nhà cung cấp AI lớn áp dụng giảm giá 90% cho cache read, giảm đáng kể chi phí truyền lại nội dung đã xử lý.

## Tại sao Cache Chiếm phần lớn Tổng Chi phí?

| Danh mục | Token mỗi lần gọi | Ghi chú |
|---|---|---|
| Input người dùng (token mới) | Hàng chục đến hàng trăm | Những gì người dùng thực sự gõ |
| Output AI | Hàng trăm đến hàng nghìn | Phản hồi của AI |
| **Cache read** | **100K–hàng trăm K** | Toàn bộ cuộc trò chuyện tích lũy được tính mỗi lần gọi |

Khối lượng cache read mỗi lần gọi **lớn gấp hàng nghìn lần** so với input. Ngay cả với giảm giá 90%, cache read vẫn chiếm ưu thế về giá trị đô la tuyệt đối.

Và các lần gọi này không chỉ từ tin nhắn người dùng:

| Bên gọi | Tần suất | Cache Read mỗi lần gọi |
|---|---|---|
| Tin nhắn người dùng | Khi người dùng gửi tin nhắn | Toàn bộ cuộc trò chuyện tích lũy |
| **Quyết định của chính AI** | **Nhiều lần gọi cho mỗi tin nhắn người dùng** | Toàn bộ cuộc trò chuyện tích lũy |

Một cách vô hình, AI thực hiện nhiều quyết định liên tiếp cho một tin nhắn người dùng — quyết định dùng tool nào, diễn giải kết quả tool, quyết định hành động tiếp theo. Mỗi quyết định là một lần gọi LLM đầy đủ bao gồm toàn bộ ngữ cảnh. Việc thực thi tool (đọc file, tìm kiếm) chạy cục bộ, nhưng quá trình ra quyết định trước và sau mỗi lần sử dụng tool phát sinh chi phí cache read.

### Tại sao Chi phí Cache Write cũng Lớn hơn Dự kiến?

Đối với Anthropic, chi phí cache write là 1,25x input (tier 5 phút) hoặc 2x input (tier 1 giờ). Với hệ số nhân đó, có vẻ cache write không nên vượt quá 2x chi phí input+output — nhưng thực tế, cache write chiếm tỷ trọng lớn hơn nhiều.

Hai lý do:

| Nguyên nhân | Giải thích |
|---|---|
| **System prompt** | Hàng chục nghìn token trước khi người dùng gõ bất cứ gì (với plugin/MCP). Tất cả đều chịu chi phí cache write |
| **Tạo lại sau khi hết hạn** | Sau khi TTL (5 phút / 1 giờ) hết, toàn bộ cuộc trò chuyện tích lũy phải được cache lại. Cuộc trò chuyện càng dài, chi phí tạo lại càng cao |

Nói cách khác, cache write không chỉ xảy ra cho "token mới mà người dùng gõ." Khi bắt đầu phiên, toàn bộ system prompt được cache; sau khi hết hạn, toàn bộ cuộc trò chuyện tích lũy trở thành mục tiêu cache write. Nếu cache của cuộc trò chuyện 100K token hết hạn, một tin nhắn duy nhất kích hoạt cache write 100K token cùng lúc.

**Đây chính xác là lý do plugin super-token-saver hiển thị cảnh báo hết hạn cache sau 1 giờ không hoạt động.** Khi cảnh báo xuất hiện, hãy kiểm tra kích thước ngữ cảnh hiện tại:

- **Ngữ cảnh nhỏ**: Chi phí tạo lại cache còn chấp nhận được. Cứ tiếp tục làm việc — chi phí thấp.
- **Ngữ cảnh lớn**: Chi phí cache sẽ đáng kể. Chúng tôi khuyến nghị `/clear` rồi `/s-continue last` để tiếp tục trong phiên mới. Skill continue tự động khôi phục ngữ cảnh trò chuyện trước đó, nên quy trình làm việc không bị gián đoạn.

## Chiến lược Giảm Chi phí Cache

Plugin super-token-saver được thiết kế để tự động hóa hoặc đơn giản hóa tất cả các chiến lược này.

### 1. Giữ Ngữ cảnh Nhỏ — `/clear` + `/s-continue` ⭐

**Đây là cách quan trọng nhất để giảm chi phí.** Chi phí cache cao có nghĩa bạn đang được giảm giá 90% — đó là bình thường. Nhưng nếu ngữ cảnh phình to không cần thiết và cứ giữ nguyên vậy, chi phí tuyệt đối mỗi lần gọi sẽ tăng dù có giảm giá. **Kiểm soát kích thước ngữ cảnh là chiến lược quản lý chi phí hiệu quả nhất.**

Khi chủ đề thay đổi hoặc cuộc trò chuyện trở nên dài, chạy `/clear` để đặt lại, rồi `/s-continue last` để khôi phục ngữ cảnh trước. `/s-continue` khôi phục cuộc trò chuyện trước mà không cần bất kỳ lần gọi LLM nào, nên chi phí bằng không.

`/compact` giảm ngữ cảnh bằng cách tóm tắt cuộc trò chuyện, nhưng quá trình tóm tắt chính nó phát sinh chi phí gọi LLM và mất đi chi tiết cuộc trò chuyện. Không khuyến nghị.

### 2. Ngăn Cache Hết hạn — Token Guardian (Tự động)

Cache phiên chính của Anthropic sử dụng **tier 1 giờ**. Sau khi hết hạn, yêu cầu đầu tiên phải tạo lại toàn bộ cuộc trò chuyện dưới dạng cache write, rất tốn kém.

super-token-saver phát hiện trạng thái idle 1 giờ và **tự động hiển thị cảnh báo**. Khi cảnh báo xuất hiện, sử dụng phương pháp 1 ở trên (`/clear` + `/s-continue`) để tiếp tục trong phiên mới là cách tiết kiệm nhất.

### 3. Ủy thác Công việc Nặng cho SubTask

Các tác vụ nặng như tạo code hoặc chỉnh sửa nhiều file có thể ủy thác cho SubTask thay vì chạy trực tiếp trong phiên chính. SubTask sử dụng tier cache 5 phút, giúp **cache write rẻ hơn 37,5%**, và chạy trong ngữ cảnh cô lập nhỏ hơn, giảm khối lượng cache read mỗi lần gọi.

super-token-saver tự động hướng dẫn mô hình phân tách công việc này khi bắt đầu phiên.

### 4. Theo dõi Chi phí Thời gian thực — `/setup-statusline`

Cài đặt `/setup-statusline` để hiển thị trạng thái chi phí/token thời gian thực ở cuối CLI: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Bạn có thể phát hiện ngay chi phí mỗi lần gọi cao bất thường hoặc ngữ cảnh đang phình to, cho phép hành động trước khi chi phí tăng vọt.

### 5. Phân tích Mẫu Chi phí — `/usage-view`

Sử dụng `/usage-view` để xem lại toàn bộ lịch sử sử dụng dưới dạng dashboard. Trực quan hóa xu hướng chi phí theo ngày/giờ, thành phần token mỗi phiên, và hiệu quả cache. Xem ngay tác vụ nào gây đột biến chi phí và mẫu nào không hiệu quả.

### 6. Tối ưu hóa System Prompt

Càng nhiều plugin, server MCP, và skill được tải vào system prompt, chi phí cache write ban đầu càng cao. Loại bỏ những gì bạn không sử dụng.

`/setup-git-lite` của super-token-saver giảm hướng dẫn Git mặc định của Claude Code (~2.200 token) xuống còn 280 token cốt lõi — giảm khoảng 88% system prompt liên quan đến Git mỗi phiên.

### 7. Chọn Tool — Tác động Ngữ cảnh Khác nhau theo Tool

Khi file được đọc, nội dung của nó ở lại trong ngữ cảnh và tích lũy trong cache read cho tất cả lần gọi tiếp theo. Đọc một file đầy đủ thêm hàng nghìn đến hàng chục nghìn token vào ngữ cảnh, và số lượng đó được tính phí ở mọi lần gọi tiếp theo.

Các tác vụ coding thường liên quan đến nhiều file đồng thời — chỉ đọc đầy đủ 3-4 file có thể khiến ngữ cảnh phình to đáng kể. Chọn đúng tool tạo ra sự khác biệt lớn trong việc tăng trưởng ngữ cảnh.

| Tool | Mục đích | Tác động Ngữ cảnh | Khi nào Sử dụng |
|---|---|---|---|
| **Grep** | Tìm code theo mẫu | **Tối thiểu** — chỉ trả về dòng khớp | Tìm tên hàm, biến, chuỗi cụ thể |
| **Glob** | Tìm file theo mẫu tên | **Tối thiểu** — chỉ trả về đường dẫn file | Tìm vị trí file như `*.ts`, `src/**/*.test.js` |
| **LSP** | Định nghĩa symbol, tham chiếu, kiểu | **Tối thiểu** — chỉ trả về định nghĩa/signature | Go to definition, find references, kiểm tra kiểu |
| **Read** (offset/limit) | Đọc phần cụ thể của file | **Vừa phải** — chỉ trả về phạm vi chỉ định | Khi cần một đoạn dòng cụ thể |
| **Read** (đầy đủ) | Đọc toàn bộ file | **Lớn** — toàn bộ file được thêm vào ngữ cảnh | Chỉ khi cần hiểu cấu trúc toàn bộ file |

"Đọc toàn bộ file này" sử dụng ngữ cảnh nhiều gấp hàng chục đến hàng trăm lần so với "Tìm hàm này."

Nguyên tắc tương tự áp dụng cho chỉnh sửa và so sánh:

| Tool | Mục đích | Tác động Ngữ cảnh |
|---|---|---|
| **Edit** | Sửa file hiện có | **Tối thiểu** — chỉ diff được thêm vào ngữ cảnh |
| **Write** | Tạo file mới / viết lại toàn bộ | **Lớn** — toàn bộ file được thêm vào ngữ cảnh |
| **git diff / diff** | So sánh file/thư mục | **Tối thiểu** — chỉ trả về khác biệt |
| Đọc cả hai file riêng biệt | So sánh file/thư mục | **Lớn** — cả hai file đầy đủ được thêm vào ngữ cảnh |

super-token-saver tự động chèn hướng dẫn chọn tool này cho AI khi bắt đầu phiên, khuyến khích sử dụng tool nhẹ trước.

## Phụ lục: So sánh Cache Giữa các Nhà cung cấp AI

### Chi phí Cache

| Nhà cung cấp | Chi phí Cache Write | Giảm giá Cache Read | Chi phí Lưu trữ Cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Tier 5 phút: 1,25x input<br/>Tier 1 giờ: 2x input | Giảm 90% | Không có |
| **OpenAI**<br/>(Codex) | Không phụ phí (bằng input) | Giảm 90% | Không có |
| **Google Gemini**<br/>(Gemini CLI) | Không phụ phí (bằng input) | Giảm 90% | Không có |

> **Lưu ý**: Tỷ lệ giảm giá cache read khác nhau tùy model. Các con số này phản ánh model flagship mới nhất của mỗi nhà cung cấp.

### Cache Time-to-Live (TTL)

| Nhà cung cấp | TTL | Cam kết |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 phút hoặc 1 giờ | **Được định nghĩa rõ ràng** |
| **OpenAI**<br/>(Codex) | Thường bị xóa sau 5-10 phút không hoạt động; có thể tồn tại đến 1 giờ trong giờ thấp điểm | **Không cam kết** — tài liệu chính thức dùng từ "generally", "up to" |
| **Google Gemini**<br/>(Gemini CLI) | Không công bố | **Không cam kết** — explicit caching với TTL đảm bảo có sẵn qua API (trả phí) |

> **Lưu ý**: Dựa trên thử nghiệm của chúng tôi với Claude Code, phiên chính thường sử dụng tier 1 giờ, trong khi SubTask sử dụng tier 5 phút.

### Tùy chọn Kiểm soát Cache Bổ sung qua Gọi API Trực tiếp

So sánh trên đây từ góc nhìn người dùng công cụ AI coding (Claude Code, Codex, Gemini CLI). Lập trình viên gọi API trực tiếp có quyền kiểm soát cache chi tiết hơn.

**Anthropic**

- `cache_control`: Đặt breakpoint để xác định ranh giới cache rõ ràng. Tự động xác định nếu không chỉ định.
- Tier TTL (5 phút / 1 giờ) có thể chọn theo từng yêu cầu.

**OpenAI**

- `prompt_cache_key`: Điều hướng các yêu cầu có cùng key đến cùng server, cải thiện tỷ lệ cache hit. Codex nội bộ đặt giá trị này thành `conversation_id` tự động.
- `prompt_cache_retention: "24h"`: Giữ cache lâu hơn. Kéo dài mặc định 5-10 phút lên đến 24 giờ (không phí thêm, không cam kết). Codex không sử dụng tùy chọn này.

**Google Gemini**

- Explicit caching (`CachedContent`): Đặt TTL từ 1 phút đến 48 giờ để đảm bảo cache hit. Có phí lưu trữ (\$4,50/MTok/giờ cho Pro). Cập nhật nội dung cache yêu cầu tạo CachedContent mới thủ công. Gemini CLI không sử dụng tính năng này.

> **Lưu ý**: Các tùy chọn này không được hiển thị trong công cụ AI coding và người dùng không thể kiểm soát trực tiếp. Người dùng công cụ AI coding nên tham khảo phần "Chiến lược Giảm Chi phí Cache" trong nội dung chính.

### Nguồn tham khảo

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
