# cc-token-saver

> **Claude Code가 자꾸 끊긴다고? 이제 그만.**
>
> 덜 쓰고, 더 오래 코딩하고, 토큰이 어디로 가는지 정확히 확인하자 — 설정 필요 없음.

자동 context 관리, 실시간 비용 추적, cache 기반 session 제어. 플러그인 하나에 전부 들어있다.

---

## 😤 문제: $200 내고도 일을 못 한다

Claude Code Max Plan ($200/mo). 충분할 줄 알았다. 현실은 다르다.

**5시간 rolling window rate limit.** 한창 코드 짜다가 갑자기 멈춘다. 언제 풀리는지도 모른다. 타이머도 없다. 그냥 기다려야 한다.

**Cache expiry.** 점심 먹고 돌아왔더니 1시간이 넘었다. 프롬프트 하나 보냈을 뿐인데 900K token이 전부 재전송된다. 비용? 한 번에 $9.

**보이지 않는 비용.** 지금 얼마나 쓰고 있는지 어디에도 안 보인다. Rate limit 걸리고 나서야 "아, 너무 많이 썼구나" 깨닫는다.

**전부 수동 관리.** context 크기, cache 만료 시점, SubTask 위임, session 정리. 이걸 코딩하면서 동시에 신경 쓸 사람은 없다.

cc-token-saver는 이 모든 걸 자동으로 해결한다. **설치 한 번이면 끝.**

---

## 🚀 Installation

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

설치 후 자동 동작한다. Zero config. [Claude Code](https://claude.ai/claude-code) v2.1.71+ 필요.

실시간 모니터링을 원하면:

```
/setup-statusline install
```

---

## 🛡️ Feature 1: Token Guardian

**Cache 만료를 감지하고, 비싼 재전송을 자동으로 막아준다.**

Claude Code의 prompt cache TTL은 1시간이다. 1시간 넘게 자리를 비우면 cache가 만료되고, 다음 메시지에서 전체 context가 full price로 재전송된다. 900K token이면 한 번에 $9.

Token Guardian은 마지막 응답 시점을 추적한다. 3590초(TTL - 10초 buffer) 이상 경과하면 프롬프트 전송을 차단하고 경고를 보여준다.

```
🚨 캐시 만료 (68분 23초 경과)

프롬프트 캐시가 만료되어 이대로 실행하면 전체 컨텍스트를 다시 전송합니다.
비용이 크게 증가할 수 있습니다.

👉 /context — 현재 컨텍스트 사용량 확인 후 판단
👉 /clear → /continue — 초기화 후 이전 컨텍스트 복원 (권장, 최저비용)
👉 그냥 다시 보내기 — 현재 상태로 계속 진행 (전체 재캐시 비용 발생)
```

한 번 경고 후 같은 프롬프트를 다시 보내면 통과한다. 같은 경고가 반복되지 않아 작업 흐름을 방해하지 않는다. 경고 메시지는 OS 언어 설정에 따라 23개 언어로 표시된다.

**결과:** 신경 안 써도 비싼 재캐시 비용이 자동으로 방지된다.

---

## 🧠 Feature 2: Smart Session Architecture

**설치만 하면 자동으로 비용 최적화된 작업 패턴이 적용된다.**

대부분의 사용자는 Main session에서 모든 걸 한다. 파일 읽기, 코드 생성, 테스트 실행. 모든 output이 context에 쌓이고, 매 메시지마다 전부 재전송된다. Session이 비대해지고, 비용이 눈덩이처럼 불어난다.

Session Architect는 세션 시작 시 자동으로 작업 위임 전략을 주입한다.

|                | Main Session       | SubTask            |
| -------------- | ------------------ | ------------------ |
| 역할             | 설계, 판단, 리뷰         | 구현, 코드 생성, 멀티파일 작업 |
| Cache tier     | 1시간 (ephemeral_1h) | 5분                 |
| Cache write 비용 | ＄10/MTok           | ＄6.25/MTok         |
| Context 크기     | ~94K avg           | ~33K avg           |

SubTask는 Main 대비 **37.5% 저렴한 cache write** 비용이 적용된다. 게다가 context도 훨씬 작다. 무거운 작업을 SubTask에 위임하는 것만으로 비용이 대폭 절감된다.

**결과:** 사용자가 의식하지 않아도, Claude가 자동으로 비용 효율적인 패턴으로 작업한다.

---

## 🔄 Feature 3: /continue — Context Restoration

**`/compact`를 대체한다. LLM 호출 0, 토큰 비용 0.**

`/compact`은 전체 context (~1M token)를 LLM에 보내서 3.3% 분량으로 요약한다. Cache가 만료된 상태라면 이것만으로 전체 재캐시 비용이 발생한다. 요약 과정에서 정보 손실도 피할 수 없다.

`/continue`는 완전히 다른 방식이다. 이전 session transcript를 전처리해서 직접 읽어들인다. LLM 호출이 없다. 비용이 없다. 원본 대화가 그대로 복원된다.

|            | /compact                | /continue              |
| ---------- | ----------------------- | ---------------------- |
| 작동 방식      | LLM에 전체 context 전송 후 요약 | Transcript 전처리 후 직접 읽기 |
| LLM 호출     | 필요 (보통 수십만 token 소모)    | 0                      |
| 토큰 비용      | 높음                      | 0                      |
| 정보 손실      | 있음 (3.3% 요약)            | 없음 (원본 보존)             |
| 처리 속도      | 수십 초                    | < 1초 (60MB+ 파일도)       |
| Cache 만료 시 | 전체 재캐시 비용 추가 발생         | 영향 없음                  |
| 복수 세션 복원   | 불가                      | 가능                     |

사용법: `/clear` 후 `/continue`. 이전 session 목록이 표시되고, 복원할 세션을 선택하면 된다. 빠른 복원이 필요하면 `/continue last`.

**결과:** 비용 0으로 이전 작업을 이어간다. 정보 손실도 없다.

---

## 📊 Feature 4: Live Status Line

**실시간 토큰/비용 모니터링. 50ms 이하 오버헤드.**

`/setup-statusline install` 한 번이면 Claude Code 하단에 상시 상태바가 표시된다.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| 표시               | 의미                     | 🟢 정상   | 🟡 경고    | 🔴 위험    |
| ---------------- | ---------------------- | ------- | -------- | -------- |
| RUN (delta)      | 마지막 API 호출 비용          | < ＄0.50 | >= ＄0.50 | >= ＄1.00 |
| RUN (cumulative) | 이 폴더의 누적 비용            | —       | —        | —        |
| 5H               | 5시간 윈도우 사용률 + 리셋 카운트다운 | < 70%   | >= 70%   | >= 90%   |
| CTX              | Context window 사용률     | < 35%   | >= 35%   | >= 70%   |

경고/위험 상태에서는 `→ /usage-view current` 힌트가 자동으로 표시된다.

제거: `/setup-statusline uninstall` (이전 설정 자동 복원).

**결과:** 비용 상태를 한눈에 파악하고, 위험 전에 대응할 수 있다.

---

## 📈 Usage Dashboard (/usage-view)

**"왜 막혔지?"에 답할 수 있게 된다.**

지금까지는 rate limit에 걸리면 그냥 화만 났다. 원인을 알 수 없었다. 어떤 세션에서 토큰을 많이 썼는지, 언제 비용이 급증했는지, 내 사용 습관에 어떤 패턴이 있는지 — 아무것도 보이지 않았다.

`/usage-view`는 이 모든 걸 보여준다. 브라우저에서 열리는 interactive HTML 대시보드로, 내 사용 패턴을 분석하고 비용 급증의 원인을 추적할 수 있다. 외부 의존성 없이 단독 동작하고, 파일로 공유도 가능하다.

포함되는 분석:

- 일별 / 시간별 / 요일별 비용 트렌드 — 언제 토큰을 많이 쓰는지 패턴이 보인다
- Token breakdown (input, output, cache write, cache read) — 비용의 원인이 보인다
- 세션별 비용 분석 — 어떤 작업이 비쌌는지 특정할 수 있다
- 5시간 윈도우 타임라인 (Max Plan subscriber) — rate limit 원인을 역추적할 수 있다
- AI 기반 인사이트 분석 — 데이터를 해석해서 개선 방향을 제안한다
- 23개 언어 지원 (RTL 포함, charts/tables는 LTR 유지)

```
/usage-view                  # 전체 기간, 모든 프로젝트
/usage-view current          # 현재 5시간 윈도우만
/usage-view last 7 days      # 최근 7일
/usage-view locale ko        # 한국어로 표시
```

---

## 🔬 Rate Limit Research (/report-limit)

**커뮤니티 기반 rate limit 공식 역추적 프로젝트.**

Anthropic은 5시간 윈도우의 정확한 공식을 공개하지 않는다. 우리가 함께 밝혀내자.

Rate limit에 걸렸을 때 `/report-limit`를 실행하면 해당 시점의 사용 데이터가 GitHub Discussion으로 자동 제출된다. 데이터가 모일수록 공식이 명확해진다.

---

## 💡 Cache는 어떻게 작동하는가

Claude Code는 매 API 호출마다 전체 대화 기록을 모델에 전송한다. "API 호출"은 사용자가 보낸 메시지 하나가 아니다. 프롬프트 하나에 Grep, Read, Edit, Write 같은 내부 tool call이 발생하고, 각각이 별도의 API 호출이다. 프롬프트 하나가 10번 이상의 API 호출을 유발하기도 한다.

Prompt cache가 이 비용을 90% 줄여준다. 하지만 cache에는 수명이 있다.

|             | Main Session              | SubTask                |
| ----------- | ------------------------- | ---------------------- |
| Cache TTL   | 1시간 (ephemeral_1h)        | 5분                     |
| Cache write | ＄10/MTok                  | ＄6.25/MTok             |
| Cache read  | ＄0.50/MTok                | ＄0.50/MTok             |
| Cache 만료 시  | 전체 context full price 재전송 | 영향 작음 (context가 작기 때문) |

Cache가 살아있어도 비용은 쌓인다. 극단적인 시나리오로 차이를 보자.

### 시나리오: 하루 종일 코딩 (오전 3시간 → 점심/미팅 2시간 → 오후 3시간)

조건: Opus 4 기준, 1분마다 프롬프트, 프롬프트당 평균 5회 API 호출 (시간당 ~300 호출).

#### ❌ cc-token-saver 없이

대부분의 작업이 Main session에서 일어난다. Context가 빠르게 비대해진다.

| 구간    | 상황                    | Context 크기             | 비용                                   |
| ----- | --------------------- | ---------------------- | ------------------------------------ |
| 오전 3h | 코딩 (대부분 Main에서 처리)    | 100K → 600K (avg 350K) | 900 calls × 350K × ＄0.50/M = ＄157.50 |
| 점심/미팅 | 2시간 자리 비움             | —                      | —                                    |
| 복귀    | Cache 만료 → 전체 재전송     | 600K full price        | 600K × ＄5/M + 600K × ＄10/M = ＄9      |
| 복귀    | /compact 실행 (요약)      | 600K → LLM 전송          | 600K × ＄0.50/M + 요약 output = ~＄1.50  |
| 오후 3h | 코딩 계속 (context 다시 성장) | 100K → 600K (avg 350K) | 900 calls × 350K × ＄0.50/M = ＄157.50 |
|       | 합계                    |                        | ~＄326                                |

> 이 정도 사용량이면 5시간 윈도우 rate limit에 걸릴 수 있다. **비용도 비용이지만, 작업이 멈추는 게 진짜 문제다. 당신의 Claude Code 사용이 막히는 순간이 바로 이때다.**

#### ✅ cc-token-saver 사용

무거운 작업이 SubTask로 위임된다. Main은 설계/판단만.

| 구간    | 상황                                       | Context 크기                  | 비용                               |
| ----- | ---------------------------------------- | --------------------------- | -------------------------------- |
| 오전 3h | 코딩 (Main: 설계, SubTask: 구현)               | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
| 점심/미팅 | 2시간 자리 비움                                | —                           | —                                |
| 복귀    | ⚡ Token Guardian 차단 → /clear + /continue | —                           | ＄0 (LLM 호출 없음)                   |
| 오후 3h | 코딩 계속                                    | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
|       | 합계                                       |                             | ~＄180                            |

#### 💰 결과

> **＄326 → ＄180. 하루 ＄146 절약 (45%).**
> 
> 비용만 줄어드는 게 아니다. 같은 시간에 더 적은 토큰을 쓰니까 **rate limit에 걸리지 않고 계속 작업할 수 있다.** 이게 진짜 차이다.

### cc-token-saver가 각 포인트에서 개입한다

```
[Session Start]
    │
    ├─ Session Architect → 자동으로 SubTask 위임 패턴 주입
    │                       Main context 250K 이하 유지
    │
[작업 중]
    │
    ├─ Status Line → 실시간 비용/context/rate limit 모니터링
    │                  경고 구간 진입 시 즉시 알림
    │
[1시간+ 자리 비움]
    │
    ├─ Token Guardian → cache 만료 감지, 재전송 전 차단
    │
[Session 재시작]
    │
    └─ /continue → 비용 0으로 이전 context 복원 (LLM 호출 없음)
```

---

## 🔧 Source 설치 & 커스터마이징

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver는 완전히 오픈되어 있다. 소스 전체가 plain JavaScript + Bash 스크립트이고, 플러그인 구조를 그대로 따르기 때문에 어떤 부분이든 자유롭게 수정할 수 있다.

- **hooks/** — cache 만료 threshold 변경, 경고 메시지 커스터마이징, session architecture 규칙 수정
- **scripts/** — 분석 로직, 리포트 빌더, status line 포맷 변경
- **skills/** — /continue와 /usage-view의 동작 방식, 프롬프트 템플릿 수정
- **locales/** — 번역 추가/수정, 새 언어 추가
- **skills/usage-view/** — 대시보드 UI/UX 디자인 변경

이 플러그인의 철학을 살려서 자신만의 token 관리 전략을 만들어보자. Fork하고, 실험하고, 더 좋은 방법을 찾으면 PR을 보내달라.

---

## 🌐 Supported Languages

23개 언어를 지원한다. Claude Code 사용량 상위 20개국 + 세계 인구 기준 사용자 수 상위 20개 언어를 교차 분석하여 선정했다. OS 언어 설정에 따라 자동으로 해당 언어로 표시된다. `/usage-view locale ko`처럼 직접 지정할 수도 있다.

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

현재 번역은 AI 기반이다. 각 언어 native 사용자의 자연스러운 번역 기여를 적극 환영한다. `locales/` 디렉토리에서 해당 언어 JSON 파일을 수정하여 PR을 보내주면 된다.

---

## 💡 Tips

### Cache를 이해하면 비용이 보인다

- **프롬프트 1개 ≠ API 호출 1개.** Claude가 Grep, Read, Edit를 호출할 때마다 전체 context가 재전송된다. 프롬프트 하나가 10회 이상의 API 호출을 만든다. 프롬프트를 명확하게 쓰면 불필요한 tool call이 줄고, 비용이 줄어든다.
- **Cache는 "마지막 API 호출"로부터 1시간.** 계속 작업하면 cache는 만료되지 않는다. 위험한 건 자리를 비울 때다. 다행히 Token Guardian이 자동으로 1회 블록해주기 때문에, 돌아왔을 때 context를 초기화할지 그대로 진행할지 선택할 수 있다.
- **Context 크기 = 비용 승수.** context가 200K일 때와 800K일 때, 같은 API 호출이 4배 비싸다. Status line의 [CTX]가 35% (🟡)를 넘기면 SubTask 위임을 늘려야 한다는 신호다.

### 비용을 줄이는 습관

- **CLAUDE.md를 간결하게 유지.** 매 API 호출마다 system prompt에 로드된다. 한 줄 한 줄이 비용이다.
- **큰 작업은 SubTask에 위임.** 코드 생성, 멀티파일 편집, 테스트 실행은 Main에서 하지 않는다. SubTask는 context가 작고 cache tier가 저렴하다.
- **1시간 이상 자리 비울 때:** `/clear` → 돌아와서 `/continue`. 재캐시 비용 ＄0으로 복원.
- **[5H] 70% (🟡) 이상이면 속도 조절.** 가벼운 리뷰 작업으로 전환하거나, SubTask 비중을 높여서 Main의 API 호출을 줄인다.
- **`/btw`로 사이드 질문.** 대화 기록에 남지 않아 context가 안 늘어난다.

---

## License

Apache-2.0    
