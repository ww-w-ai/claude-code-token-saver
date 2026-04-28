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

## 🪶 Concise Mode

**같은 내용, 줄어든 군더더기. 기본 ON.**

같은 SessionStart 훅이 응답 스타일 규칙도 함께 주입한다 — **모든 세션, 모든 모델**에 적용. 별도 설정·플래그 없음. 세 가지가 바뀐다:

- **잡담 컷** — "확인해볼게요…", "이제 ~하겠습니다…", 질문 되풀이, diff에 이미 있는 내용 다시 요약하기 같은 것 모두 제거
- **내용에 맞는 형식** — 리스트엔 불릿, 추론(트레이드오프·인과·근거)엔 prose. 어느 쪽도 강제하지 않음
- **표현 자체를 압축** — 같은 요점, 더 적은 단어. 명료한 문장이 짧은 문장이다

다만 안전선: **내용 누락·검증 생략·뉘앙스를 한 줄로 뭉개기는 금지**. 본질은 그대로, 포장지만 줄어든다.

한 번 설치하면 어디서나 적용.

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
| RUN (delta)      | 마지막 API 호출 비용          | < ＄0.30 | >= ＄0.30 | >= ＄1.00 |
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
- Context 크기 분포 차트 — 4단계 버킷으로 토큰이 어디에 집중되는지 한눈에 파악
- Context 크기별 비용 버블 차트 — 밀집 클러스터링으로 비용 핫스팟 시각화
- 모델별 색상 구분 (Opus/Sonnet/Haiku) + API 가격 라인 매칭
- 이론적 가격 라인 (1h/5m cache write, cache read) 모델별 표시
- 이중 평균 토글: Avg (활동일) / Avg (전체일) / Max
- 사용자 턴별 비용 뷰 — $50 상한선 + 이상치 별표 마커
- Cache read 경고 — context 크기 및 API 호출 횟수 포함
- AI 기반 인사이트 분석 — API 가격 참조를 포함해 정확한 인사이트 제공
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

## ✂️ Feature 5: /setup-git-lite — CC 내장 Git 지침 다이어트

**당신이 모르고 냈던 세션당 숨겨진 2,200 토큰.**

### 발견 경위

2026년 4월 12일, [GitHub 이슈](https://github.com/anthropics/claude-code/issues/47107)를 통해 Claude Code의 내장 `includeGitInstructions` 설정이 매 세션마다 조용히 토큰을 소모하고 있다는 사실이 밝혀졌다. [이 gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98)로 독립 재현한 결과 수치가 확인됐다: git commit 이후 매 세션마다 **cache write +6,031 토큰**, 모든 API 호출마다 **cache read +1,690 토큰**.

### CC 소스 분석 — 토큰이 어디로 가는가

토큰은 Claude Code 소스(v2.1.88)의 독립된 두 주입 지점에서 발생한다:

**1. `gitStatus` 스냅샷 (~500 tok) — system prompt**

- `context.ts:36-111` `getGitStatus()`가 branch + main branch + user.name + 전체 status (최대 2000자) + **최근 커밋 5개**를 수집
- `appendSystemContext` (`utils/api.ts:437`)를 통해 system prompt에 추가
- 새 커밋, 수정 파일, branch 전환 시마다 텍스트가 바뀌어 prefix cache가 무효화됨

**2. Commit/PR 워크플로우 지침 (~1,700 tok) — Bash tool description**

- `tools/BashTool/prompt.ts:53`에서 안전 규칙 60줄 이상, 단계별 commit 절차, HEREDOC 예시, PR 생성 템플릿을 `Bash` tool description에 추가
- system prompt와 함께 cache되지만 `tools[]` 파라미터로 전송됨

### 왜 비싼가

cache 구조 (`utils/api.ts:321` `splitSysPromptPrefix`)는 MCP tool 활성화 여부에 따라 세 경로로 나뉜다:

- **Path A** (MCP 활성 — 대부분의 사용자): `gitStatus`가 `cacheScope: 'org'` 블록에 위치. 변경 시 → 다음 세션 시작 시 블록 전체 재캐시 → 6K tok `cache_create` 미스.
- **Path B** (MCP 없음): `gitStatus`가 `cacheScope: null` 동적 블록으로 이동. 매 API 호출마다 신규 `input_tokens`으로 전송 — cache 미스 없지만, cache 절약도 없음.
- **Path C** (3P provider / experimental betas 비활성): Path A와 동일.

일반적인 인터랙티브 세션에서 commit/PR 지침 (1.7K tok)은 `cache_read`를 통해 **모든 API 호출마다** 누적된다. Opus 4.7 가격 기준 100회 호출 세션이면, Claude의 훈련 데이터로 이미 대부분 커버되는 지침에 **세션당 ~$0.08**을 쓰는 셈이다.

### cc-token-saver의 해결 방식

`/setup-git-lite`는 CC 기본 경로를 비활성화하고, SessionStart hook을 통해 **280토큰짜리 교체 지침**을 주입한다. Claude의 기본 동작을 오버라이드하는 안전 규칙은 유지하고, 훈련 데이터로 이미 아는 내용(단계별 워크플로우, PR 템플릿, gh 사용 패턴 등)은 제거했다.

**유지됨 — 핵심 오버라이드 규칙 11개** (Claude의 기본 친절함을 신중함으로 전환하는 규칙들):

- 명시적 요청 없이 commit/push/amend/PR/tag/merge 금지
- hooks 생략, main/master force-push, 파괴적 명령, git config 수정 금지
- `.env`, `credentials`, `*.pem`, `secret.*` 파일 commit 금지
- `git add -A` / `git add .` 지양
- 여러 줄 commit message에 HEREDOC + `Co-Authored-By: Claude` trailer
- interactive 플래그(-i) 금지, 빈 commit 금지
- pre-commit hook 실패 시 → `--amend` 말고 새 commit 생성

**제거됨** — 단계별 commit 워크플로우 (3단계), 단계별 PR 워크플로우 (3단계), PR title/body 템플릿, `gh` 명령 참조, `-uall` 플래그 경고, rebase의 `--no-edit` 경고, `NEVER use TodoWrite or Agent tools during commit` 제약. 훈련 데이터만으로 Claude가 충분히 올바르게 수행하는 워크플로우 설명들이다.

**추가됨** — 간결한 git 상태 한 줄: branch + HEAD short-sha + subject + 현재 status (수정 파일 최대 20개, 초과 시 개수만 표시). 최근 commit 목록 없음 (필요 시 Claude가 `git log`를 직접 실행).

### 예상 절감 효과 (Opus 4.7 기준, output $25/MTok, input $5/MTok, cache read $0.50/MTok)

| 항목                        | 기존                         | setup-git-lite 적용 후      | 절감              |
| ------------------------- | -------------------------- | ------------------------ | --------------- |
| System prompt 로드 (새 세션마다) | ~2,200 tok cache_create    | ~280 tok cache_create    | ~1,920 tok      |
| 같은 세션 내 반복 호출             | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100회 호출 세션 (Opus 4.7)     | —                          | —                        | **~$0.11 절감**   |
| 20 sessions/day × 22 근무일  | —                          | —                        | **월 ~$48 절감**   |

### 사용법

```bash
/setup-git-lite status     # 읽기 전용 진단 — 현재 상태 + 변경될 내용 확인
/setup-git-lite install    # CC 기본 비활성화 + 최소화 hook 활성화
/setup-git-lite revert     # 기본값 복원 (공격적 방식, 아래 참조)
/setup-git-lite dismiss-banner    # 가끔 표시되는 권장 팁 숨기기
/setup-git-lite undismiss-banner  # 팁 다시 활성화
/setup-git-lite help       # 전체 사용법
```

### install 동작 방식

`install`은 안정성을 위해 **두 곳**을 수정한다:

1. `~/.claude/settings.json` — `"includeGitInstructions": false` 추가
2. Shell 프로필 (`~/.zshrc`, `~/.bashrc` 등) — `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` export 마커 블록 추가

둘 중 하나만으로도 CC 기본을 비활성화할 수 있지만, 환경 변수 오버라이드로 기본 동작이 실수로 재활성화되지 않도록 둘 다 설정한다. Shell 변경은 새 shell에서만 적용된다.

### revert 동작 방식 — 공격적

`revert`는 **shell 프로필에서 `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` export를 모두 제거한다**. 이 설치 전에 수동으로 추가한 것도 포함된다. 의도된 동작이다 — `revert`를 실행했다는 건 초기 상태로 복원하겠다는 뜻이다. shell 프로필의 타임스탬프 백업은 항상 먼저 생성된다.

이 환경 변수가 다른 용도로 필요하다면, `revert` 실행 전에 따로 메모해두고 이후에 다시 추가하면 된다.

### cc-token-saver 제거 전에

**먼저 `/setup-git-lite revert`를 실행하자.** 그렇지 않으면 settings.json에 `includeGitInstructions: false`만 남고 교체 hook은 없는 상태가 된다 (Claude가 git 안내를 전혀 받지 못함). Claude Code에는 현재 플러그인 제거 lifecycle hook이 없어서 자동화가 불가능하다.

### 트레이드오프

잃는 것 (그리고 대체로 괜찮은 이유):

- Claude가 세션 시작 시 미리 계산된 `git status` / `git log -n 5`를 받지 않는다. 새 세션에서 "뭐가 바뀌었지?"라고 물으면 Claude가 직접 해당 명령을 실행한다 (tool call 1회 추가, ~300 tok).
- Claude가 CC의 정식 3단계 commit 절차를 받지 않는다. 수백 건의 commit 플로우 테스트 결과, 핵심 케이스 (HEREDOC 포맷, `--amend` 금지, force-push 금지)는 명시적 규칙으로 유지하기 때문에 훈련 지식으로 충분히 처리된다.
- PR body 템플릿 (`## Summary` + `## Test plan`)이 주입되지 않는다. 해당 포맷이 꼭 필요하다면 프로젝트의 CLAUDE.md에 직접 추가하면 된다.

### 권장 배너

CC 기본 git 지침이 아직 활성화된 상태라면, cc-token-saver가 세션 시작 시 **약 20% 확률**로 안내 문구를 표시한다 (`/usage-view`와 `/report-limit` 출력에도 표시됨). `/setup-git-lite dismiss-banner`로 영구적으로 숨길 수 있다.

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
