# super-token-saver

**Claude Code 소스를 직접 뜯어서, 당신 돈이 어디서 새는지 찾아냈습니다. 자동으로 막아주고, 더 싸게, 더 오래 쓰게 해줍니다.**

> 실측: $326/일 쓰던 워크로드가 **$180/일로. 45% 절감.** 캐시 만료 방지, SubTask 자동 위임, 무비용 컨텍스트 복원, AI 분석 대시보드까지 — 설치 한 줄이면 끝입니다.

**Max Plan ($200/월)**, **API 종량제** 모두 동작합니다. 모든 사용자에게 더 강력합니다 — 월정액 버퍼 없이, 새는 토큰이 곧 청구서니까요.

![사용 대시보드 — 토큰이 어디로 가는지 한눈에](docs/images/usage-view-overview.png)

### 30초 요약

| 기능 | 설명 | 효과 |
| ------- | ------------ | ------ |
| 🛡️ Token Guardian | 캐시 만료 감지, $9짜리 재전송 사전 차단 | 가장 큰 무음 비용 급등 방지 |
| 🧠 Session Architect | 무거운 작업을 SubTask에 자동 위임 (37.5% 저렴한 캐시) | 컨텍스트 축소, 비용 절감 |
| 🪶 Concise Mode | 응답 패딩 제거, 내용은 그대로 | 응답당 출력 토큰 감소 |
| 🔄 /s-continue | /compact 대체 — LLM 호출 0, 비용 0, 정보 손실 0, **Codex** 세션도 복원 | 두 도구 모두 무료로 컨텍스트 복원 |
| 🤝 /s-compact | /s-continue가 자동으로 불러오는 세션 인계 기록을 작성 — transcript가 놓치는 서브에이전트 발견·도구 결과를 포착 | 다음 세션이 숨겨진 컨텍스트까지 이어받음 |
| 📊 Status Line | 실시간 비용·컨텍스트·요금 한도 — 50ms 이하 | 비용 터지기 전에 먼저 확인 |
| 📈 /usage-view | AI 분석이 포함된 인터랙티브 HTML 대시보드 | 클릭 한 번으로 비용 전체 추적 |
| ✂️ /setup-git-lite | 매 세션마다 몰래 주입되는 2,200개 숨겨진 토큰 제거 | git 지침만으로 월 ~$48 절감 |

---

## 😤 문제

**캐시 만료.** 점심 먹고 돌아왔더니 캐시가 사라졌습니다. 다음 프롬프트 하나가 900K 토큰을 전부 전가로 재전송합니다. 한 방에 $9.

**보이지 않는 비용.** 실시간 가시성이 없습니다. "컨텍스트가 800K입니다" 경고도, "3분 전에 캐시가 만료됐습니다" 알림도 없습니다. 피해를 입고 나서야 알게 됩니다.

**컨텍스트 비대.** 200K vs 800K 컨텍스트에서 같은 프롬프트의 비용 차이는 4배. Read, Grep, Edit을 할 때마다 전체 컨텍스트가 재전송됩니다. 복잡한 프롬프트 하나가 API 호출 15회 이상을 유발하고, 각각이 컨텍스트 크기만큼 곱해집니다.

**전부 수동.** 컨텍스트 관리, 캐시 만료 타이밍, SubTask 위임, 세션 정리. 코딩하면서 이 모든 걸 추적하는 건 불가능합니다.

**Max Plan ($200/월)?** 위의 모든 것에 더해, 타이머도 ETA도 없이 흐름을 끊는 5시간 요금 한도까지.

**API 종량제?** 위의 모든 것에, 상한선도 없습니다. 캐시 미스 한 번 = 실제 돈 $9. 일주일에 열 번 = 사고만으로 월 $360. 컨텍스트가 부풀어 오른 나쁜 화요일 하루가 Max Plan 구독자의 한 달치 요금보다 더 나올 수 있습니다.

super-token-saver가 이 모든 것을 자동으로 처리합니다. **한 번 설치. 끝.**

---

## 🚀 설치

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

설치 후 자동으로 작동합니다. 설정 불필요. [Claude Code](https://claude.ai/claude-code) v2.1.71+ 필요.

실시간 모니터링을 원한다면:

```
/setup-statusline install
```

CC 내장 git 지침의 숨겨진 토큰 2,200개를 제거하려면 ([상세](#%EF%B8%8F-기능-5-setup-git-lite--cc-내장-git-지침-축소)):

```
/setup-git-lite install
```

---

## 🛡️ 기능 1: Token Guardian

**$9짜리 실수가 일어나기 직전에 잡아냅니다. 자동으로.**

Claude Code의 프롬프트 캐시 TTL은 1시간입니다. 한 시간 이상 자리를 비우면 캐시가 만료됩니다. 다음 메시지를 보내는 순간 전체 컨텍스트가 전가로 재전송됩니다. 900K 토큰이면 한 방에 $9입니다.

Token Guardian은 마지막 응답을 받은 시점을 추적합니다. 3,590초(TTL에서 10초 버퍼를 뺀 값) 이상 경과하면 프롬프트를 차단하고 경고를 표시합니다.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

경고 후 같은 프롬프트를 다시 보내면 통과됩니다. 경고는 유휴 기간당 한 번만 발생하므로 반복해서 귀찮게 하지 않습니다. 경고 메시지는 OS 로케일에 따라 23개 언어로 표시됩니다.

**백그라운드 에이전트는 절대 막히지 않습니다.** 경고는 사람이 직접 입력한 프롬프트에만 붙습니다. 백그라운드 에이전트·태스크의 완료 보고는 — 이제 실행한 지 한 시간 넘게 지나서 도착하는 일이 흔한데 — 그대로 통과되므로, 오래 걸리는 에이전트의 결과가 막히거나 유실되는 일이 없습니다.

**결과:** 캐시 만료 한 번 잡을 때마다 $9 절약. 하루 한 번 기준 월 순 낭비 $270 제거.

> **API 종량제라면 타격이 더 큽니다.** Max Plan 구독자는 $200 버퍼 안에서 $9를 잃습니다. 당신은 실제 돈 $9를 — 조용히, 반복적으로, 자리를 비울 때마다 — 잃는 겁니다. Token Guardian이 매번 잡아냅니다.

---

## 🧠 기능 2: Smart Session Architecture

**설치하면 비용 최적화 작업 패턴이 자동으로 적용됩니다.**

대부분의 사용자는 Main 세션에서 모든 작업을 합니다. 파일 읽기, 코드 생성, 테스트 실행. 출력물이 모두 컨텍스트에 쌓이고 메시지마다 재전송됩니다. 세션이 비대해지고 비용이 눈덩이처럼 불어납니다.

Session Architect는 세션 시작 시 위임 전략을 자동으로 주입합니다.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| 역할             | 설계, 의사결정, 검토              | 구현, 코드 생성, 다중 파일            |
| Cache 티어       | 1시간 (ephemeral_1h)              | 5분                                   |
| Cache write 비용 | ＄10/MTok                          | ＄6.25/MTok                            |
| 컨텍스트 크기    | 평균 ~94K                         | 평균 ~33K                             |

SubTask는 Main보다 **cache write가 37.5% 저렴**합니다. 컨텍스트도 훨씬 작습니다. 무거운 작업을 SubTask에 위임하면 비용이 크게 줄어듭니다.

**결과:** 컨텍스트가 600K+ 이상 늘어나는 대신 250K 이하로 유지됩니다. 같은 작업 결과, 토큰 비용은 절반. 완전 자동.

---

## 🪶 Concise Mode

**내용은 그대로. 패딩만 줄어듭니다. 기본 활성화.**

SessionStart 훅이 응답 스타일 규칙을 **모든 세션과 모든 모델**에 주입합니다 — 별도 설정 없이. 세 가지가 달라집니다:

- **서두 제거** — "살펴볼게요…", "이제 하겠습니다…", 질문 재진술, diff에 이미 보이는 내용 요약 없음
- **내용에 맞는 형식** — 목록은 불릿, 추론은 산문 (트레이드오프, 인과관계, 근거). 둘 중 어느 쪽도 강제하지 않음
- **더 간결한 표현** — 같은 요점, 더 적은 단어. 명확한 산문이 더 짧습니다

엄격한 제한: 내용 누락, 검증 생략, 뉘앙스를 한 문장으로 뭉개는 행위는 절대 금지. 내용은 그대로, 포장지만 줄어듭니다.

한 번 설치하면 어디서나 적용됩니다.

---

## 🔄 기능 3: /s-continue — 컨텍스트 복원

**`/compact` 필요 없습니다. LLM 호출 0번. 비용 $0. 날아가는 정보 0.**

`/compact`는 전체 컨텍스트(~1M 토큰)를 LLM에 전송해 3.3% 요약본으로 압축합니다. 캐시가 만료된 상태라면 이것만으로 전체 재캐시가 발생합니다. 정보 손실은 피할 수 없습니다.

`/s-continue`는 완전히 다른 방식으로 작동합니다. 이전 세션 트랜스크립트를 전처리해서 직접 로드합니다. LLM 호출 없음. 비용 없음. 원본 대화가 그대로 복원됩니다.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| 작동 방식               | 전체 컨텍스트를 LLM에 전송해 요약 | 트랜스크립트 전처리 후 직접 로드 |
| LLM 호출                | 필요 (일반적으로 100K+ 토큰)      | 0                                |
| 토큰 비용               | 높음                              | 0                                |
| 정보 손실               | 있음 (3.3% 요약)                  | 없음 (원본 보존)                 |
| 처리 속도               | 수십 초                           | 1초 미만 (60MB+ 파일도)          |
| 캐시 만료 시            | 위에 전체 재캐시 비용 추가        | 영향 없음                        |
| 다중 세션 복원          | 불가                              | 지원                             |

사용법: `/clear` 후 `/s-continue`. 이전 세션 목록이 표시됩니다. 복원할 세션을 선택하세요. 빠른 복원: `/s-continue last`.

**결과:** 이전 작업을 무료로 재개. 정보 손실 없음. 60MB+ 트랜스크립트도 1초 이내 처리.

### 🤝 짝을 이루는 기능: `/s-compact` — 숨겨진 레이어까지 인계

`/s-continue`는 트랜스크립트 — 여러분과 Claude가 나눈 대화 — 를 복원합니다. 하지만 작업 세션에서 가장 유용한 지식은 종종 그 대화 밖에 있습니다: 서브에이전트가 찾아낸 것(그 트랜스크립트는 별도 파일이라 복원 시 로드되지 않습니다), 도구 출력 속의 결정적인 숫자(테스트 개수, 벤치마크 수치), 작업 과정에서 얻은 교훈("헤드리스에서 재현이 안 됐던 건 코드가 아니라 빌드 문제였다").

세션을 마칠 때 `/s-compact`를 실행하면 바로 이 숨겨진 레이어를 인계 기록으로 압축해 `~/.claude/super-token-saver-data/<project>/handoff.md`에 저장합니다. 다음 세션에서는 `/s-continue`가 복원된 트랜스크립트 위에 이 기록을 자동으로 불러옵니다 — 따로 붙여넣을 필요가 없습니다.

|                     | `/s-continue` 단독            | `/s-compact` + `/s-continue` (세트)          |
| 복원 범위            | 트랜스크립트(나눈 대화)  | 트랜스크립트 + 숨겨진 레이어             |
| 서브에이전트 발견   | 유실(별도 파일)           | 인계 기록에 압축되어 보존                       |
| 도구 출력 숫자 | 대화에 직접 언급된 경우만    | 의도적으로 추출                            |
| 작업 과정의 교훈     | 없음                               | 막다른 길을 반복하지 않도록 기록              |

**작업 흐름:** 세션을 `/s-compact`로 마치고 → 다음 세션을 `/s-continue`로 시작하세요.

### 🔀 두 도구, 하나의 히스토리 — Codex 세션도 여기서 복원됩니다

Codex는 세션을 `~/.codex/sessions/`에 쓰고, Claude Code는 `~/.claude/projects/`에 씁니다. 서로 상대방의 파일을 읽지 못해서, Codex에서 예산을 다 쓰고 중단된 작업을 Claude Code에서 이어받을 방법이 없었습니다. 반대 방향도 마찬가지였습니다.

이제 `/s-continue`는 두 히스토리를 함께 목록에 띄우고 복원합니다. Codex의 rollout 파일을 별도 파서로 처리하는 게 아니라, Claude Code가 쓰는 형식으로 **입력 한 줄당 출력 한 줄**씩 그대로 재작성합니다 — 그래서 파이프라인이 하나로 통일되고, `L{n}` 마커는 여전히 원본 Codex 파일의 정확한 줄을 가리킵니다. 실측: 12 MB, 1,540줄짜리 rollout을 전처리하는 데 **0.13 s**가 걸렸습니다.

|                        | Claude Code 세션 | Codex 세션 |
| ---------------------- | ------------------- | ------------- |
| `/s-continue`에 표시됨 | O | O, 현재 프로젝트로 범위 제한 |
| LLM 비용 0으로 복원 | O | O |
| `L{n}`으로 원본 위치 이동 | O | O — 줄 번호는 rollout 자체의 것 |
| 컨텍스트 손실(`#0`) 복원 | `/compact`, 자동 compact | Codex의 compaction과 스레드 롤백 |
| `/s-compact` 인계 기록 | 프로젝트 단위로 공유 — 한 도구에서 쓰고 다른 도구에서 불러옵니다 |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

정확한 목록과 그럴듯해 보이지만 틀린 목록을 가르는 것은 이 두 가지입니다. Codex의 `session_id`는 서브에이전트가 그대로 물려받는 **스레드** id라서, 세션은 `payload.id`로 구분하고 서브에이전트의 rollout은 Claude Code가 subtask 트랜스크립트를 걸러내는 것과 같은 방식으로 제외합니다. 그리고 `<codex_internal_context source="goal">`는 시스템이 주입한 것이라 복원된 컨텍스트에는 남지만 사용자가 입력한 턴으로는 세지 않습니다.

이 플러그인은 Codex에도 설치됩니다 — **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md))를 참고하세요. `usage-view`, `report-limit`, `setup-statusline`은 아직 Claude Code 전용입니다.

---

## 📊 기능 4: 실시간 Status Line

**실시간 토큰/비용 모니터링. 50ms 이하 오버헤드.**

`/setup-statusline install`을 한 번 실행하면 Claude Code 하단에 상태 표시줄이 고정됩니다.

**정상 작동 상태** — 모든 지표를 한눈에, 컨텍스트 전환 없이:

![Status line in normal state](docs/images/statusline-normal.png)

**요금 한도 도달** — 5H가 102%에서 빨갛게 변하고, 복구까지 정확한 카운트다운이 표시되며, `/report-limit` 액션이 자동으로 올라옵니다:

![Status line when rate limited](docs/images/statusline-rate-limited.png)

| 지표              | 표시 내용                           | 🟢 정상   | 🟡 경고    | 🔴 위험     |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (증분)       | 마지막 API 호출 비용                | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (누적)       | 이 폴더의 누적 비용                 | —         | —          | —           |
| 5H               | 5시간 윈도우 사용량 + 리셋 카운트다운 | < 70%     | >= 70%     | >= 90%      |
| CTX              | 컨텍스트 윈도우 사용량              | < 35%     | >= 35%     | >= 70%      |

지표 중 하나라도 경고 또는 위험에 도달하면 `→ /usage-view current` 힌트가 자동으로 표시됩니다.

제거하려면: `/setup-statusline uninstall` (이전 설정이 자동으로 복원됩니다).

**결과:** 모든 비용 문제를 실시간으로 확인. 50ms 이하 오버헤드 — 체감 지연 없음.

> **API 종량제라면?** 5H와 W 지표는 자동으로 숨겨집니다 — 요금 한도 윈도우가 없으니까요. 남는 건 중요한 것뿐: RUN(턴별 실시간 비용)과 CTX(컨텍스트 크기). 청구서를 결정하는 두 가지 레버, 항상 눈에 보입니다.

---

## 📈 사용 대시보드 (/usage-view)

**드디어 답을 얻습니다: "그 돈이 다 어디 갔지?"**

Max Plan 사용자는 요금 한도에 걸리고 왜인지 궁금해합니다. API 사용자는 Anthropic 청구서를 열고 어떻게 이렇게 됐는지 궁금해합니다. 어느 쪽이든 질문은 같습니다: 어느 세션이 가장 많은 토큰을 태웠나? 언제 비용이 급등했나? 내 사용 패턴은 어떤가? 지금까지는 전부 보이지 않았습니다.

`/usage-view`가 모든 것을 보여줍니다. 브라우저에서 인터랙티브 HTML 대시보드가 열리며 사용 패턴을 분석하고 비용 급등의 근본 원인을 추적할 수 있습니다. 외부 의존성 없음. 독립 실행. 파일로 공유 가능.

**31일 동안 $4,196. 다 어디 갔을까요?** 한눈에 — 총 비용, 유형별 토큰 분류, 캐시 효율 비율, 세션 수. 도넛 차트로 지출의 65%가 cache read임을 즉시 확인할 수 있습니다(이는 정상적이고 건강한 상태입니다):

![Usage dashboard overview](docs/images/usage-view-overview.png)

**전후 비교 — 추측이 아닌 실측.** 주황색 점선 "Plugin installed" 마커가 비용 타임라인을 둘로 나눕니다. 일별 막대는 토큰 유형(Input/Output/Cache Write/Cache Read)별로 쌓여 있어 설치 후 어느 구성 요소가 달라졌는지 정확히 볼 수 있습니다. 평균 선이 추세를 보여줍니다:

![Daily cost trend](docs/images/usage-view-daily-trend.png)

**언제 가장 많이 태울까요?** 시간대별 비용과 요일별 분류. 활성일 평균, 전일 평균, 최대값으로 전환 가능. 불꽃 아이콘이 가장 비싼 시간을 표시합니다 — 패턴(늦은 밤 집중, 수요일 급등)이 즉시 눈에 띕니다:

![Hourly and day-of-week cost pattern](docs/images/usage-view-hourly-pattern.png)

**효율이 올라가고 있나요?** Total/Output 비율은 출력 토큰 하나를 만드는 데 얼마나 많은 토큰이 소비되는지를 측정합니다. 낮을수록 좋습니다. "Plugin installed" 마커로 전후를 비교할 수 있습니다. 급등 = 캐시 미스 또는 세션 재시작:

![Efficiency trend](docs/images/usage-view-efficiency.png)

**모든 API 호출을 컨텍스트 크기와 비용으로 플롯.** 비용 구조를 직관적으로 이해할 수 있는 차트입니다. 점 하나가 API 호출 하나. 빨간색 = Opus, 파란색 = Sonnet, 초록색 = Haiku. 점선이 이론적 가격 — 점이 선 위에 있다면 과지출입니다. **User Turn** 뷰로 전환하면 API 호출이 아닌 대화 턴별 비용을 볼 수 있습니다.
점에 마우스를 올리면 실제 프롬프트 텍스트, 토큰 수, 전체 비용 분류(Input/Output/Cache Write/Cache Read)가 표시됩니다:

![Cost by Context Size — scatter chart](docs/images/usage-view-cost-scatter.png)

**컨텍스트가 얼마나 큰가요?** 대부분의 호출이 250K 이하에 몰려 있습니다. 350K 이상의 긴 꼬리가 비용이 폭발하는 구간 — 이 차트로 얼마나 자주 위험 구간에 있는지 정확히 파악할 수 있습니다:

![Context Size Distribution](docs/images/usage-view-context-dist.png)

**시간당 가격이 매겨진 코딩 스케줄.** 30일에 걸친 5시간 윈도우 히트맵. 초록색(시간당 $15 미만), 주황색($15-30), 빨간색($30 이상). 해골 아이콘(💀)은 요금 한도에 걸린 윈도우를 표시합니다. 상단의 비용 슬라이더로 저렴한 윈도우를 필터링해 비싼 날을 즉시 찾을 수 있습니다. 5시간 윈도우와 1시간 블록 뷰를 전환할 수 있습니다:

![Hourly usage calendar heatmap](docs/images/usage-view-calendar.png)

**셀을 클릭하면 해당 윈도우의 세션을 드릴다운합니다.** 해당 시간대의 모든 세션, 비용, 메시지 수, 토큰 분류, 각 대화의 실제 첫/마지막 메시지가 표시됩니다. "Top Token Conversations"를 펼치면 어떤 대화가 가장 많이 태웠는지 확인할 수 있습니다 — 각 항목에 프롬프트 텍스트, 비용 경고 태그, 최적화 힌트가 있습니다:

![Session detail panel](docs/images/usage-view-session-drilldown.png)

**AI 분석 (선택).** `--no-ai` 없이 `/usage-view`를 실행하면 AI 애널리스트가 API 가격 참조 정보가 내장된 전체 대시보드 데이터를 읽고 보고서를 작성합니다: 비용 동인, 이상 패턴, 최적화 권장 사항. OS 언어로 자동 표시됩니다(23개 언어, RTL 포함; 차트/표는 항상 LTR 유지):

**돈이 어디 갔는지** — 총 지출, 토큰 유형별 비용 동인, 주간 추세, 실제 수치로 측정된 플러그인 효과:

![AI analysis — cost breakdown](docs/images/usage-view-ai-report-1.png)

**언제, 어떻게 일하는지** — 피크 시간, 가장 바쁜 날, API 호출 분포, 최적화 기회를 드러내는 요금 한도 패턴:

![AI analysis — work patterns](docs/images/usage-view-ai-report-2.png)

**무엇을 해야 하는지** — 실제 사용량에 맞춰진 구체적이고 데이터 기반의 권장 사항. 모델 전환, 컨텍스트 관리, 세션 전략:

![AI analysis — recommendations](docs/images/usage-view-ai-report-3.png)

**공유하세요.** 전체 대시보드가 독립적인 HTML 파일 하나입니다 — 모든 데이터가 내장되어 있어 서버가 필요 없습니다. 팀원, 관리자, 회계 담당자에게 보내세요. 외부 의존성 없음. 오프라인 작동. `private` 모드를 사용하면 공유 전 프롬프트 텍스트를 제거합니다 — 비용 분석은 그대로 두고 대화 내용만 제거됩니다.

```
/usage-view                  # 전체 기간, 전체 프로젝트
/usage-view current          # 현재 5시간 윈도우만
/usage-view last 7 days      # 최근 7일
/usage-view locale ja        # 일본어
/usage-view --no-ai          # AI 분석 건너뜀 (빠름)
/usage-view private          # 프롬프트 텍스트 제거 (공유 안전)
```

---

## 🔬 요금 한도 연구 (/report-limit)

**요금 한도 공식을 역산하는 커뮤니티 프로젝트.**

Anthropic은 5시간 윈도우의 정확한 공식을 공개하지 않습니다. 함께 알아봅시다.

요금 한도에 걸리면 `/report-limit`을 실행하세요. 현재 사용 데이터가 GitHub Discussion으로 자동 제출됩니다. 데이터가 쌓일수록 공식이 더 명확해집니다.

---

## ✂️ 기능 5: /setup-git-lite — CC 내장 Git 지침 축소

**소스를 뜯었더니 나왔습니다. 매 세션마다 몰래 끼워넣어지는 토큰 2,200개 — 당신이 모르는 사이에 돈을 내고 있었습니다.**

### 발견 경위

2026-04-12, [GitHub 이슈](https://github.com/anthropics/claude-code/issues/47107)에서 Claude Code의 내장 `includeGitInstructions` 설정이 매 세션마다 토큰을 몰래 소모한다는 사실이 공개됐습니다. [이 gist(spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98)로 독립 재현해 수치를 확인했습니다: git 커밋 후 세션당 **cache write +6,031 토큰**, 모든 API 호출에서 **cache read +1,690 토큰**.

### CC 소스 분석 — 토큰이 어디로 가는가

토큰이 Claude Code 소스(v2.1.88)의 두 개의 독립된 주입 지점으로 이동함을 추적했습니다:

**1. `gitStatus` 스냅샷 (~500 tok) — 시스템 프롬프트**
- `context.ts:36-111` `getGitStatus()`가 브랜치 + 메인 브랜치 + user.name + 전체 상태(최대 2000자) + **최근 커밋 5개**를 수집
- `appendSystemContext`(`utils/api.ts:437`)를 통해 시스템 프롬프트에 추가
- 새 커밋, 새 수정 파일, 브랜치 전환마다 텍스트가 바뀜 → 프리픽스 캐시 무효화

**2. 커밋/PR 워크플로우 지침 (~1,700 tok) — Bash 도구 설명**
- `tools/BashTool/prompt.ts:53`이 안전 프로토콜 60줄 이상, 단계별 커밋 절차, HEREDOC 예제, PR 생성 템플릿을 `Bash` 도구 설명에 추가
- 시스템 프롬프트와 함께 캐시되지만 `tools[]` 파라미터로 전달

### 왜 비싼가

캐시 구조(`utils/api.ts:321` `splitSysPromptPrefix`)는 활성 MCP 도구 유무에 따라 세 가지 경로를 갖습니다:

- **Path A** (MCP 활성 — 대부분의 사용자): `gitStatus`가 `cacheScope: 'org'` 블록 안에 위치. 변경 발생 → 다음 세션 시작 시 전체 블록 재캐시 → 6K tok `cache_create` 미스.
- **Path B** (MCP 없음): `gitStatus`가 `cacheScope: null` 동적 블록으로 이동, 즉 모든 API 호출에서 신선한 `input_tokens`로 재전송 — 캐시 미스는 없지만 캐시 절약도 없음.
- **Path C** (3P 프로바이더 / 실험적 베타 비활성): Path A와 동일.

일반적인 인터랙티브 세션에서 커밋/PR 지침(1.7K tok)은 `cache_read`를 통해 **모든 API 호출에 누적**됩니다. Opus 4.7 가격 기준 100회 호출 세션이라면, Claude의 학습 데이터가 이미 대부분 커버하는 지침에 **세션당 ~$0.08**이 소모됩니다.

### super-token-saver의 처리 방식

`/setup-git-lite`는 네이티브 경로를 비활성화하고 SessionStart 훅을 통해 **280 토큰 맞춤형 대체 지침**을 주입합니다. Claude의 기본 행동을 재정의하는 것(안전 규칙)만 남기고, Claude가 학습으로 이미 아는 것(단계별 워크플로우, PR 템플릿, gh 사용 패턴)은 제거했습니다.

**유지됨 — 핵심 재정의 규칙 11개** (Claude의 기본 도움 성향을 주의 모드로 전환하는 것들):
- 명시적 사용자 요청 없이 커밋/push/amend/PR/tag/merge 금지
- 훅 건너뛰기, main/master 강제 push, 파괴적 작업, git 설정 수정 금지
- `.env`, `credentials`, `*.pem`, `secret.*`에 해당하는 파일 커밋 금지
- `git add -A` / `git add .` 사용 금지
- 멀티라인 커밋 메시지에 HEREDOC + `Co-Authored-By: Claude` 트레일러
- 인터랙티브 플래그(-i) 사용 금지, 빈 커밋 금지
- pre-commit 훅 실패 시 → 새 커밋 생성(`--amend` 아님)

**제거됨** — 단계별 커밋 워크플로우(3단계), 단계별 PR 워크플로우(3단계), PR 제목/본문 템플릿, `gh` 명령어 참조, `-uall` 플래그 경고, rebase와 함께 `--no-edit` 경고, `커밋 중 TodoWrite 또는 Agent 도구 절대 사용 금지` 제약. 이것들은 Claude가 학습만으로도 올바르게 처리하는 워크플로우 세부 사항입니다.

**추가됨** — 간결한 git 상태 라인: 브랜치 + HEAD short-sha + 제목 + 현재 상태 (수정 파일 최대 20개, 이상이면 카운트). 최근 커밋 목록 없음(Claude가 필요 시 `git log`를 직접 실행할 수 있습니다).

### 예상 절감액 (Opus 4.7 가격, output $25/MTok, input $5/MTok, cache read $0.50/MTok)

| 항목 | 원본 | setup-git-lite 적용 후 | 절감 |
| ---- | -------- | ------------------- | ----- |
| 시스템 프롬프트 로드 (새 세션당) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| 같은 세션 내 반복 호출 | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100회 호출 세션 (Opus 4.7) | — | — | **~$0.11 절감** |
| 하루 20세션 × 22 근무일 | — | — | **월 ~$48 절감** |

### 사용법

```bash
/setup-git-lite status     # 읽기 전용 진단 — 현재 상태 + 변경될 사항
/setup-git-lite install    # CC 네이티브 비활성화 + 최소 훅 활성화
/setup-git-lite revert     # 기본 복원 (강력; 아래 참고)
/setup-git-lite dismiss-banner    # 가끔 뜨는 추천 팁 숨기기
/setup-git-lite undismiss-banner  # 팁 다시 활성화
/setup-git-lite help       # 전체 사용법
```

### 설치 동작

`install`은 안정성을 위해 **두 곳**을 수정합니다:

1. `~/.claude/settings.json` — `"includeGitInstructions": false` 추가
2. 셸 프로파일(`~/.zshrc`, `~/.bashrc` 등) — `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`을 내보내는 마커 블록 추가

둘 중 하나만으로도 CC 네이티브를 비활성화할 수 있습니다; 환경 변수 오버라이드가 실수로 네이티브 동작을 다시 활성화하지 않도록 둘 다 설정합니다. 셸 변경은 새 셸에서만 적용됩니다.

### revert 동작 — 강력

`revert`는 **셸 프로파일에서 모든 `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` export를 제거**합니다. 이 스킬을 설치하기 전에 직접 추가한 것도 포함됩니다. 이는 의도된 동작입니다 — `revert`를 실행했으니 깔끔한 기본값으로 복원합니다. 셸 프로파일의 타임스탬프 백업은 항상 먼저 생성합니다.

다른 이유로 해당 환경 변수가 필요하다면, `revert` 실행 전에 기록해 두고 이후에 다시 추가하세요.

### super-token-saver 제거 전

**먼저 `/setup-git-lite revert`를 실행하세요.** 그렇지 않으면 settings.json에 `includeGitInstructions: false`만 남고 대체 훅은 없는 상태가 됩니다(Claude가 git 지침을 전혀 받지 못합니다). Claude Code는 현재 플러그인 제거 라이프사이클 훅을 지원하지 않아 자동화할 수 없습니다.

### 트레이드오프

잃는 것(그리고 대부분 괜찮은 이유):
- Claude는 세션 시작 시 미리 계산된 `git status` / `git log -n 5`를 받지 않습니다. 새 세션에서 "뭐가 바뀌었나요?"라고 물으면 Claude가 직접 그 명령어를 실행합니다(추가 도구 호출 1회, ~300 tok).
- Claude는 CC의 공식 3단계 커밋 절차를 받지 않습니다. 수백 번의 커밋 플로우를 테스트한 결과, 명시적 규칙으로 중요한 케이스(HEREDOC 형식, `--amend` 금지, 강제 push 금지)를 유지하기 때문에 학습 수준의 지식으로 충분합니다.
- PR 본문 템플릿(`## Summary` + `## Test plan`)이 주입되지 않습니다. 해당 형식이 꼭 필요하다면 프로젝트의 CLAUDE.md에 추가하세요.

### 추천 배너

CC 네이티브 git 지침이 아직 활성화된 상태라면, super-token-saver가 세션 시작 시 **~20% 확률**로 한 단락짜리 팁을 표시합니다(`/usage-view`와 `/report-limit` 출력에도 포함). `/setup-git-lite dismiss-banner`로 영구적으로 숨길 수 있습니다.

---

## 💡 캐시가 실제로 작동하는 방식 (그리고 대부분의 사용자가 40% 이상을 낭비하는 이유)

Claude Code는 모든 API 호출에서 전체 대화 기록을 모델에 전송합니다. "API 호출"은 "직접 입력한 메시지 한 개"를 의미하지 않습니다. 프롬프트 하나가 내부 도구 호출 — Grep, Read, Edit, Write — 을 유발하고, 각각이 별도의 API 호출입니다. 프롬프트 하나로 쉽게 10회 이상의 API 호출이 발생합니다.

프롬프트 캐시는 이 비용을 90% 줄여줍니다. 하지만 캐시에는 수명이 있습니다.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1시간 (ephemeral_1h)                  | 5분                                    |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| 캐시 만료 시        | 전체 컨텍스트가 전가로 재전송         | 영향 낮음 (컨텍스트가 작음)            |

캐시가 살아있어도 비용은 쌓입니다. 차이를 보여주기 위한 극단적인 시나리오입니다.

### 시나리오: 하루 종일 코딩 (오전 3시간 → 점심/회의 2시간 → 오후 3시간)

조건: Opus 4 가격, 분당 프롬프트 1개, 프롬프트당 API 호출 ~5회(시간당 ~300회).

#### ❌ super-token-saver 없이

대부분의 작업이 Main 세션에서 이루어집니다. 컨텍스트가 빠르게 늘어납니다.

| 구간        | 상황                              | 컨텍스트 크기               | 비용                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| 오전 3시간  | 코딩 (주로 Main에서)              | 100K → 600K (평균 350K)    | 900회 × 350K × ＄0.50/M = ＄157.50  |
| 점심/회의   | 2시간 자리 비움                   | —                          | —                                      |
| 복귀        | 캐시 만료 → 전체 재전송           | 600K 전가                  | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| 복귀        | /compact (요약)                   | 600K → LLM에 전송          | 600K × ＄0.50/M + 요약 출력 = ~＄1.50 |
| 오후 3시간  | 코딩 계속 (컨텍스트 다시 증가)    | 100K → 600K (평균 350K)   | 900회 × 350K × ＄0.50/M = ＄157.50  |
|             | 합계                              |                            | ~＄326                                  |

> 이 사용량 수준에서는 5시간 윈도우 요금 한도에 걸릴 가능성이 높습니다. **비용도 문제지만, 진짜 문제는 작업이 완전히 멈추는 것입니다. 바로 이 순간 Claude Code가 암흑 속으로 들어갑니다.**

#### ✅ super-token-saver로

무거운 작업은 SubTask에 위임됩니다. Main은 설계/의사결정만 처리합니다.

| 구간        | 상황                                         | 컨텍스트 크기                | 비용                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| 오전 3시간  | 코딩 (Main: 설계, SubTask: 구현)             | Main 100K → 300K (평균 200K) | 900회 × 200K × ＄0.50/M = ＄90 |
| 점심/회의   | 2시간 자리 비움                              | —                           | —                                  |
| 복귀        | ⚡ Token Guardian 차단 → /clear + /s-continue | —                           | ＄0 (LLM 호출 없음)                 |
| 오후 3시간  | 코딩 계속                                    | Main 100K → 300K (평균 200K) | 900회 × 200K × ＄0.50/M = ＄90 |
|             | 합계                                         |                             | ~＄180                              |

#### 💰 결과

> **＄326 → ＄180. 하루 ＄146 절약. 45% 비용 절감.**
>
> **Max Plan:** 토큰이 줄어들면 요금 한도에 걸리지 않습니다. 작업이 멈추지 않습니다. 이것이 진짜 차이입니다.
>
> **API 종량제:** ＄146/일 × 22 근무일 = **청구서에서 월 ＄3,200 절감.** 이 플러그인 없이 무거운 달은 ＄7,000을 넘습니다. 있으면 ＄4,000 미만. 같은 출력.

### super-token-saver가 개입하는 지점

```
[세션 시작]
    │
    ├─ Session Architect → SubTask 위임 패턴 자동 주입
    │                       Main 컨텍스트를 250K 이하로 유지
    │
[작업 중]
    │
    ├─ Status Line → 실시간 비용/컨텍스트/요금 한도 모니터링
    │                  경고 구간 진입 시 즉시 알림
    │
[1시간 이상 유휴]
    │
    ├─ Token Guardian → 캐시 만료 감지, 재전송 전에 차단
    │
[세션 재시작]
    │
    └─ /s-continue → 무비용으로 이전 컨텍스트 복원 (LLM 호출 없음)
```

---

## 🔧 소스 설치 및 커스터마이징

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver는 완전한 오픈소스(Apache-2.0)입니다. 순수 JavaScript + Bash — 컴파일된 바이너리, 외부 API 호출, 텔레메트리 없음. 모든 라인이 감사 가능합니다. 이 README의 모든 주장은 직접 읽을 수 있는 특정 파일에 매핑됩니다.

- **hooks/** — 캐시 만료 임계값 변경, 경고 메시지 커스터마이징, 세션 아키텍처 규칙 수정
- **scripts/** — 분석 로직, 리포트 빌더, 상태 표시줄 형식
- **skills/** — /s-continue와 /usage-view 작동 방식, 프롬프트 템플릿
- **locales/** — 번역 추가/편집, 새 언어 추가
- **skills/usage-view/** — 대시보드 UI/UX 디자인 변경

마음껏 바꾸세요. 포크하고, 실험하고, 더 나은 것을 찾으면 PR을 보내주세요.

---

## 🌐 지원 언어

23개 언어 지원. Claude Code 사용량 기준 상위 20개 국가와 글로벌 화자 수 기준 상위 20개 언어를 교차 참조해 선정했습니다. 표시 언어는 OS 로케일에서 자동 감지됩니다. 수동으로 지정할 수도 있습니다: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

현재 번역은 AI가 생성했습니다. 원어민의 기여를 환영합니다 — `locales/`에서 해당 언어의 JSON 파일을 수정하고 PR을 보내주세요.

---

## ⚖️ 이 플러그인의 비용

플러그인은 세션 시작 시 컨텍스트를 주입합니다. 정확한 양은 다음과 같습니다:

| 주입 항목 | 시점 | 토큰 수 | 목적 |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (1회) | ~1,100 | SubTask 위임 전략 + Concise Mode 규칙 |
| Git 컨텍스트 (git-lite 활성 시) | SessionStart (1회) | ~280 | CC 기본 ~2,200 tok git 지침 대체 |
| 캐시 만료 경고 | 59분 이상 유휴 시 (1회) | ~200 | 비싼 재전송 차단, 복구 옵션 표시 |
| Status Line | 모든 API 호출 | 0 | 터미널 상태 표시줄에 렌더링, 대화 컨텍스트 아님 |

**세션당 순 오버헤드: ~1,400 토큰 (최초 호출 후 캐시됨).**

Opus 가격($0.50/MTok cache read) 기준 **API 호출당 $0.0007** — 0.1센트 미만. 100회 호출 세션에서: $0.07.

git-lite가 활성화된 경우, 플러그인은 세션당 ~1,920 토큰을 **절약**합니다(2,200을 280으로 대체). 순 효과는 마이너스 — 플러그인이 제거하는 것보다 덜 소모합니다.

**API 종량제 사용자:** 월 $3,000 지출 기준, 플러그인 오버헤드는 월 $2 미만입니다. 캐시 만료 방지만으로(주 1회 $9 재전송 차단) 단 한 번의 캐치로 1년 치 오버헤드를 충당합니다.

---

## 💡 팁

### 캐시를 이해하면 돈이 어디 가는지 보입니다

- **프롬프트 1개 ≠ API 호출 1회.** Claude가 Grep, Read, Edit을 호출할 때마다 전체 컨텍스트가 재전송됩니다. 프롬프트 하나로 API 호출 10회 이상이 쉽게 발생합니다. 명확한 프롬프트를 작성해 불필요한 도구 호출을 줄이고 비용을 낮추세요.
- **캐시 타이머는 마지막 입력이 아닌 마지막 API 호출부터 리셋됩니다.** 계속 작업하면 캐시가 만료되지 않습니다. 위험은 자리를 비울 때입니다. Token Guardian이 한 번 자동 차단하므로 복귀 시 컨텍스트 초기화 또는 그대로 계속 중 선택할 수 있습니다.
- **컨텍스트 크기 = 비용 배수.** 같은 API 호출이 200K vs 800K에서 4배 차이입니다. 상태 표시줄 [CTX]가 35% (🟡)를 넘으면 SubTask에 더 많이 위임할 신호입니다.

### 비용을 줄이는 습관

- **CLAUDE.md를 간결하게 유지하세요.** 모든 API 호출에서 시스템 프롬프트로 로드됩니다. 한 줄 한 줄이 돈입니다.
- **무거운 작업은 SubTask에 위임하세요.** 코드 생성, 다중 파일 편집, 테스트 실행은 Main에 있을 필요가 없습니다. SubTask는 컨텍스트가 작고 캐시 티어가 저렴합니다.
- **1시간 이상 자리를 비우나요?** `/clear` → 복귀 → `/s-continue`. 컨텍스트가 $0에 복원됩니다.
- **[5H]가 70% (🟡) 이상?** 속도를 줄이세요. 가벼운 리뷰 작업으로 전환하거나 SubTask 위임을 늘려 Main의 API 호출 수를 줄이세요.
- **간단한 질문에는 `/btw`를 사용하세요.** 대화 기록에 들어가지 않아 컨텍스트가 가볍게 유지됩니다.

### API 종량제: 가장 중요한 습관

위의 모든 것에 더해 API 전용 우선순위:

- **[CTX]를 속도계처럼 주시하세요.** 요금 한도는 여러분을 멈추지 않습니다 — 하지만 500K+ 컨텍스트는 모든 API 호출이 적정 비용의 2-3배가 됨을 의미합니다. `/clear` → `/s-continue`는 무료이고 비용 배수를 기본값으로 리셋합니다.
- **주 1회 `/usage-view`를 실행하세요.** Max Plan 사용자는 요금 한도에 걸릴 때 자연스러운 "아야" 순간이 있습니다. 여러분에게는 없습니다 — 비용이 조용히 올라갑니다. 대시보드가 조기 경보 시스템입니다.
- **하루 예산을 머릿속에 설정하세요.** 상한선 없이는 $200짜리 날이 알아채기 전에 발생합니다. 상태 표시줄의 RUN 지표가 턴별 비용을 눈에 보이게 합니다. 한 턴이 $1 (🔴)을 넘으면 컨텍스트가 너무 큰 겁니다.

---

## 📚 문서

- [Prompt Cache Guide](guides/prompt-cache-guide.md) — 비용의 대부분이 캐시인 이유, 프로바이더별 캐싱 작동 방식(Anthropic, OpenAI, Gemini), 관리 방법 ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Opus 4.7 vs 4.6 Cost Analysis](guides/opus-4-7-vs-4-6-cost-analysis.md) — 8,563회 API 호출 기준 비용 비교
- [Opus 4.7 vs 4.6 Cost Analysis (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## License

Apache-2.0
