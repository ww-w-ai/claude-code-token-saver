# v2.4.0: normalize skill trigger/description surfaces to English

- **Date(KST)**: 2026-07-22 09:26:20
- **Commit**: `fc49477`
- **Sessions**: `699b28b1`

---

## Conversation Log

> Verbatim, time order, **kept turns only** (SKILL.md Step 3a — sensitive/off-topic turns dropped whole, no placeholder). `>` = user prompt. 🤖 = preceding assistant (truncated, only when user responded to it).

---

**09:16 [699b28b1 L12]**
> 최근 업데이트 내용 살펴봐

**09:17 [699b28b1 L46]** — responding to assistant
- 🤖 *"super-token-saver의 최근 업데이트 내용입니다. … /s-compact 추가 + /continue → /s-continue 개명, shrink-img …"*
> 디스크립션에 한글이 들어가거나 업데이트 내용이 맞지 않는게 남아 있는 듯

**09:20 [699b28b1 L107]** — responding to assistant
- 🤖 *"정리했습니다. s-compact/SKILL.md — description·when_to_use의 개인 약어 한글 트리거 5개 제거(세핸프·ㅅㅎㅍ·핸드오프·인계·세션 마무리). … 추가로 report-limit 본문·usage-view·s-continue 예시에도 한글이 남아있음 — 판단 필요"*
> 모두 영어로 정리해줘

**09:24 [699b28b1 L183]** — responding to assistant
- 🤖 *"모두 영어로 정리 완료. s-compact / report-limit(💀 이모지+절차) / usage-view / s-continue 4개 파일. skills/ 한글 잔재 0 확인. 미커밋 상태 — 커밋할까요?"*
> 커밋, 배포, 마켓플레이스 마이너 버전 올리고 싱크 맞춰서 배포해

---

## Recap

| Item | Value |
|------|-------|
| Sessions | 1, ~0.7h |
| Messages | 8 (user 4 / assistant 4) |
| Tools | Edit, Bash, Read |
| Lines | +34 / -20 (6 files) |

**Summary**: 최근 업데이트를 살펴보던 중, 방금 추가된 `/s-compact` 스킬의 description·when_to_use에 개인 한국어 약어 트리거(`세핸프`·`ㅅㅎㅍ` 등)가 하드코딩돼 있는 걸 발견했다. 이 플러그인은 23개 로케일로 배포되므로 트리거 표면은 영어여야 하고 언어 감지는 런타임이 담당한다 — 나머지 5개 스킬은 이미 영어 규약을 따르는데 `s-compact`만 어긋나 있었다. 사용자 지시로 `s-compact`뿐 아니라 `report-limit`(미등록 모델 처리 절차 본문 + description `💀` 이모지), `usage-view`(에이전트 프롬프트 사용자 메시지), `s-continue`(topic 복원 예시 `PDCA 구현`)까지 Claude가 매칭·소비하는 모든 한글 텍스트를 영어로 정규화했다. 동작·스크립트 무변경, 트리거/description/지침 텍스트만 변경. 마이너 버전 2.3.0 → 2.4.0으로 올리고 별도 마켓플레이스 repo(`ww-w-ai/marketplace`)의 `marketplace.json` 버전도 싱크 후 두 repo 모두 배포했다.

**Friction**: 커밋을 먼저 실행한 탓에 이 세션의 핵심 결정 대화가 cowork-commit forward 모드의 window(마지막 커밋 이후) 밖으로 빠져, backfill 모드로 `fc49477`을 문서화함.

**Assessment**:
- **Goal**: 배포 스킬의 트리거/description 표면에서 개인 약어·한국어 잔재를 제거해 글로벌(23 로케일) 배포 규약에 맞추고, 마이너 버전업 + 마켓플레이스 싱크 배포.
- **Outcome**: fully_achieved
- **AI Helpfulness**: very_helpful
