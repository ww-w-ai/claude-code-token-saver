# fix(hook): exempt machine-injected prompts from the cache-expiry block (v2.4.1)

- **Date(KST)**: 2026-07-27 16:56:47
- **Sessions**: `26654d80`

---

## Conversation Log

> Verbatim, time order, **kept turns only** (SKILL.md Step 3a — sensitive/off-topic turns dropped whole, no placeholder). `>` = user prompt. 🤖 = preceding assistant (truncated, only when user responded to it).

---

**16:43 [26654d80 L43]**
> 울트라코드 등의 기능이 생기면서 한시간 이상 서브태스크가 돌고 보고를 받는 경우가 잦아졌는데 그게 우리 기능 때문에 막히네? <task-notification> 일 때는 예외처리로 풀어줘야 할 것 같아. 혹은 json 포맷은 모두 다 풀어줄까? 유저가 json 포맷으로 입력할 일은 없으니 자연어만 막아도 될 듯

**16:47 [26654d80 L128]** — responding to assistant
- 🤖 *"수정 완료 — `hooks/cache-expiry-check.sh`. 동작: 프롬프트가 XML 태그(`<task-notification>`, `<tick>`, `<local-command-stdout>` …)로 시작하면 즉시 approve. 자연어만 기존대로 1시간 경과 시 block. 예외 처리를 WARN_FLAG 로직보다 앞에 뒀습니다 — 뒤에 있으면 알림이 플래그를 대신 소비해, 사용자가 실제로 재전송할 때 또 막힙니다. 태그 목록 열거 대신 '태그로 시작하는가'로 판정 — 새 알림 종류가 생겨도 자동 커버."*
> 그냥 < .. > 로 시작하는 경우를 모두 열어줘 나중에 새로운 타입이 생길 수도 있잖아

**16:48 [26654d80 L147]**
> 조건이 < + 영문자 -> 이거면 됨 ㅇㅋ

**16:49 [26654d80 L167]** — responding to assistant
- 🤖 *"원복 완료. 최종 조건 = `<` + 영문자. 새로 생기는 알림 타입(예시로 넣어본 `<ultracode-report>`)도 훅 수정 없이 자동 통과. `< 5분이면 되나?` 같은 자연어는 그대로 block. 변경은 `hooks/cache-expiry-check.sh` 한 파일(+42/-1)."*
> cowork-doc-sync, cowork-commit, 버전 맞춰서 마켓플레이스와 함께 푸시 배포

---

## Recap

| Item | Value |
|------|-------|
| Sessions | 2, 1.5h |
| Messages | 23 |
| Tools | Bash 49 / Edit 23 / Read 12 |
| Lines | +130 / -0 |

**Summary**: 한 시간 넘게 도는 백그라운드 에이전트가 늘면서, 그 완료 보고(`<task-notification>`)가 우리 캐시 만료 훅에 막히는 문제를 고쳤다. CC 소스(`LocalAgentTask.tsx` → `executeQueuedInput` → `processUserInput` → `executeUserPromptSubmitHooks`)로 알림이 실제로 `UserPromptSubmit`을 타는 것을 확인했고, 막을 경우 알림이 큐에서 소비돼 **보고가 유실**된다는 점이 예외 처리의 결정적 근거였다. 판정 방식은 태그 이름 열거가 아니라 **모양**(`<` + 영문자)으로 — 사용자가 "나중에 새로운 타입이 생길 수도 있잖아"라고 지적한 대로, 앞으로 CC가 추가하는 알림 종류가 훅 수정 없이 자동 통과하게 했다. 처음엔 `<` 전부를 열었다가 `<` + 영문자로 좁히는 것으로 최종 확정.

**Friction**: 예외 조건 범위를 `<` 전부 → `<` + 영문자로 한 차례 넓혔다 되돌림. 최종안은 초안과 동일.

**Assessment**:
- **Goal**: 1시간 이상 도는 서브태스크의 완료 보고가 캐시 만료 훅에 막히지 않게 하고, 버전·마켓플레이스까지 맞춰 배포
- **Outcome**: fully_achieved
- **AI Helpfulness**: very_helpful
