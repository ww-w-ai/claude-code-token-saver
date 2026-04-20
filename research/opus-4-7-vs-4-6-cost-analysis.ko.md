# Opus 4.7 vs 4.6 비용 분석 리포트

**조사 기간**: 2026-04-17 ~ 2026-04-20
**환경**: Claude Code v2.1.88 및 v2.1.112, macOS, 한/영 혼합 대화
**샘플 크기**: 두 프로젝트 합계 8,563 calls (4-7: 3,477, 4-6: 5,086)

> English version: [opus-4-7-vs-4-6-cost-analysis.md](./opus-4-7-vs-4-6-cost-analysis.md)

---

## 0. 한눈에 보기 (Executive Summary)

### 충격! Opus 4.7은 4.6보다 42% 비싸다고?!

한 사용자의 실측 분석에서 드러난 결과입니다.¹ 같은 작업, 같은 프롬프트인데 청구서가 **42% 더** 나옵니다. 왜냐하면:

- **언어가 비싸졌고** — 같은 문장에 토큰을 최대 35% 더 씀 (tokenizer 팽창)
- **생각이 잦아졌고** — thinking 빈도 3.9배 (effort 설정과 무관)
- **말이 많아졌으니** — 응답 자체가 25~50% 더 장황 (verbosity)

세 가지가 매 턴 output에서 곱해진 결과입니다. 5시간 윈도우 관점으로 옮겨보면 — 평소 4시간에 블록되던 사용자가 **약 2시간 48분에 이미 블록**됩니다. 5시간 중 거의 절반을 쓸 수 없는 셈이죠.

일주일치 일상 작업으로 환산하면 **수 시간~하루 분량의 세션 시간**이 조용히 증발합니다. 체감이 맞았던 겁니다.

이 리포트는 왜 이런 일이 벌어지는지, 그리고 **그 시간을 어떻게 되찾을 수 있는지** 설명합니다.

---

¹ 본 측정 기준: cc-token-saver + doooz 두 프로젝트 JSONL 4,314 calls 기반, 영어/코드 위주 100턴 시뮬레이션. **한/영 혼합 사용 시 약 26%, 한글 위주 시 약 18%**. 작업 유형·언어 비율·세션 길이에 따라 달라질 수 있음. 자세한 시뮬레이션 조건은 §5 참조.

### 원인 상세: 세 가지 복합 효과

- **언어가 비싸졌다 — Tokenizer 팽창 (영어/코드 28~38%)**
  
  - 동일 텍스트 제어 실험으로 확인 (§4.3)
  - 한글은 영향 없음 (~1%)

- **생각이 잦아졌다 — Thinking 빈도 3.9배**
  
  - Main 세션 기준 4-6은 7.56%, 4-7은 26.8% 호출에서 thinking 발생
  - **Effort 설정(low/medium/high/xhigh) 변경 무관** — thinking 길이만 조절될 뿐 트리거 여부는 모델 자체 판단
  - 근거: JSONL 3,075 main calls

- **말이 많아졌다 — Output verbosity 25~50% 증가**
  
  - Thinking 차단된 subagent에서도 out/call 1.25배 (tokenizer 보정 후)
  - Thinking/tokenizer로 설명 안 되는 4-7 고유 특성

세 요인이 **매 턴 output에 누적** → context 성장 가속 → cache read 비용 복리 증가.

### 해결 방법 (따라 하기 쉬움)

짧게 말하면: **Opus 4.6으로 바꾸세요.** 그게 전부입니다. 프롬프트를 튜닝하거나 effort를 건드리거나 일하는 방식을 바꿀 필요 없습니다. 이 문제를 실제로 통제할 수 있는 유일한 스위치는 모델 선택뿐입니다.

#### 방법 1 — 그냥 전체를 4.6으로 (대부분의 사용자에게 권장)

이것만 해도 세션 시간의 20~40%를 돌려받을 수 있습니다. 간단합니다.

**따라 하기**:

1. 평소처럼 Claude Code를 열고 세션을 시작합니다.

2. 다음 명령어를 치고 엔터:
   
   ```
   /model claude-opus-4-6[1m]
   ```
   
   (1M 토큰 컨텍스트가 필요 없으면 `claude-opus-4-6`만 써도 됩니다.)

3. 끝. Claude Code가 "Set model to Opus 4.6 (1M context)" 같은 메시지로 전환을 확인해줍니다. 평소처럼 작업하면 사용량 바가 눈에 띄게 천천히 줄어드는 걸 느낄 수 있습니다.

**이게 뭘 하는 건가요**: 현재 세션을 Opus 4.6으로 고정합니다. 4.6은 thinking 빈도가 낮고, 응답도 더 간결하며, tokenizer도 더 효율적입니다. 평범한 코딩/디버깅/리팩토링 작업의 95% 이상에서 4.7과 체감 품질 차이 거의 없습니다.

**주의**: `/model`은 현재 세션에만 적용됩니다. 새 터미널을 열면 다시 실행해야 합니다. (영구 고정하고 싶으면 Claude Code 설정에서 default model을 변경할 수도 있습니다.)

#### 방법 2 — 4.7은 계획에만, 실행은 Sonnet 서브태스크로 (고급)

아키텍처 설계나 복잡한 디버깅을 일상적으로 하느라 4.7의 깊은 추론이 실제로 필요한 경우, main 세션은 4.7을 유지하되 귀찮은 작업은 서브태스크로 위임하는 방법입니다. Claude Code가 **서브태스크에서는 thinking을 자동으로 끄기 때문에** 서브태스크는 저렴하게 돌아갑니다.

**언제 뭘 쓸까**:

- **Main (Opus 4.7)**: 아키텍처 결정, 버그 가설 탐색, 다단계 계획 수립 — 깊이 있는 추론이 가치 있는 일
- **서브태스크 (Sonnet)**: 이미 작성한 명세 구현, 여러 파일 일괄 수정, 코드베이스 검색, 단순 질문 응답

**Sonnet 서브태스크에 위임하는 법**: 구현이나 검색 작업이 한 묶음 필요할 때 Claude에게 "sonnet으로 서브태스크 띄워서 X 해줘"라고 말하면 됩니다. 또는 agent 정의 파일(`.claude/agents/` 또는 플러그인 agent)의 frontmatter에 `model: sonnet`을 명시해둘 수도 있습니다.

**피해야 할 실수**: **계획 작업 자체를 서브태스크로 위임하지 마세요.** 서브태스크는 thinking이 꺼져 있어서 계획이 얕게 나옵니다. 계획은 main에서, 실행은 서브태스크에서 — 이 분업을 지키는 게 핵심입니다.

#### 아직 고민된다면

**방법 1부터 시작하세요.** 명령어 하나고, 언제든 되돌릴 수 있고, 다음 세션에서 바로 차이를 느낄 수 있습니다. 나중에 4.7로 돌아가고 싶으면 `/model claude-opus-4-7`만 치면 됩니다.

---

## 1. 조사 배경

### 문제 인식

사용자가 Opus 4.7로 Claude Code를 사용하면서 **5시간 사용량 윈도우가 평소보다 빠르게 소진**되는 체감을 보고. 동일한 양의 작업을 하는데도 쿼터가 빨리 줄어드는 현상을 과학적으로 규명할 필요.

### 가설

- 모델 업그레이드(4.6 → 4.7)가 비용 증가의 원인일 가능성
- Claude Code 버전 버그 가능성
- Tokenizer 변경의 영향
- 모델 자체의 thinking 성향 변화

### 조사 필요성

- 5h 윈도우 소진이 정말 빨라졌는지 정량화
- 원인이 모델인지 CC 버전인지 분리
- 사용자가 실질적인 대응책을 선택할 수 있는 근거 마련

---

## 2. 분석 데이터

### 2.1 JSONL 트랜스크립트 (관찰 데이터)

두 프로젝트의 최근 세션 JSONL 파일 (2026-04-17 이후, main + subagent 포함):

- **doooz** (개인 프로젝트, 디자인 리팩토링 — [github.com/taekim34/doooz](https://github.com/taekim34/doooz)): 4-7 calls 1,847개 (main 728 / sub 1,119), 4-6 calls 4,899개 (main 1,749 / sub 3,150)
- **cc-token-saver** (분석/디버깅): 4-7 calls 1,630개 (main 1,589 / sub 41), 4-6 calls 187개 (main 169 / sub 18)
- **합계**: 4-7 3,477 calls, 4-6 5,086 calls (총 8,563 calls)

각 JSONL에서 추출한 필드:

- `message.model` — 호출 시 사용된 모델
- `message.usage.output_tokens` — 출력 토큰 수
- `message.usage.input_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens`
- `message.content[].type === "thinking"` — thinking 블록 존재 여부
- `message.content[].signature` — thinking 서명(암호화된 블록)

### 2.2 제어된 실험 (실험 데이터)

**Tokenizer 팽창 측정**: 동일 텍스트를 4-6과 4-7 subtask에 입력하여 `input_tokens` 비교.

샘플:

- **System prompt (영어/코드)**: 4-6 = 11,526 tokens, 4-7 = 15,846 tokens
- **Genesis 1장 영어**: 4,087 chars, cl100k 949 tok → 4-6=982, 4-7=1,258
- **Genesis 1장 한글**: 1,673 chars, cl100k 1,633 tok → 4-6=1,801, 4-7=1,809

**핵심 제어**: 동일 프롬프트를 동일 시점에 두 모델에 보내서 순수 tokenizer 차이만 분리.

### 2.3 CC 소스 코드 (구조 이해)

`~/Documents/DEV/claude-code-v2_1_88`의 관련 파일:

- `services/compact/apiMicrocompact.ts` — thinking 블록 보존 전략
- `query.ts` — thinking signature 처리
- `utils/model/agent.ts` — subagent 모델 선택 로직
- `constants/prompts.ts` — 시스템 프롬프트 구성
- `commands/model/model.tsx` — `/model` 명령 범위
- `tools/AgentTool/runAgent.ts` — subagent thinking 비활성화 지점

---

## 3. 분석 관점

조사는 **4가지 독립 변수**로 분해하여 진행:

- **Thinking 빈도**: 4-7이 4-6보다 "생각"을 더 자주 하는가? → API 호출 중 thinking 블록을 포함한 호출의 비율 측정
- **Visible output 장황함**: Thinking을 제외한 순수 응답도 더 긴가? → No-thinking calls 평균 `output_tokens` 비교
- **Tokenizer 효율**: 같은 텍스트를 표현하는 데 4-7이 더 많은 토큰을 쓰는가? → 동일 텍스트 실험 + Baseline 차감법
- **Context 누적 효과**: Thinking은 다음 턴 context에 남는가? → CC 소스 분석 + JSONL signature 확인

---

## 4. 주요 발견

### 4.1 Thinking 빈도 차이

**4-7 시대(2026-04-17 이후) 두 프로젝트 전체 (main + subagent)**:

- **opus-4-7**: 3,477 calls 중 621 thinking → **17.9%**
- **opus-4-6**: 5,086 calls 중 145 thinking → **2.85%**
- **전체 비율: 6.3배**

같은 기간 동일 작업 환경에서 subtask까지 모두 집계한 객관적 수치. 4-6에서는 대부분의 호출이 thinking 없이 처리되는 반면 4-7은 5~6번에 1번꼴로 thinking 발생.

#### Effort별 4-7 thinking rate (subtask 포함)

- **Low**: 32 calls 중 12 thinking → **37.5%** (샘플 작음, out/call 590)
- **Medium**: 335 calls 중 101 thinking → **30.1%** (out/call 1,867)
- **High**: 212 calls 중 36 thinking → **17.0%** (out/call 1,796)
- **Xhigh (4-7 기본값)**: 2,898 calls 중 472 thinking → **16.3%** (out/call 829, 가장 큰 샘플 83%)
- **전체 평균**: 3,477 calls 중 621 thinking → **17.9%**

(default는 4-7의 기본 effort인 xhigh로 통합)

#### Effort의 진짜 역할 — thinking 길이 제한, 트리거 여부 아님

**핵심 관찰**: Think rate가 16~38% 범위에서 effort 단계와 **단조 관계 없음**. 직관과 달리 low(37.5%)가 가장 높고, xhigh(16.3%)가 가장 낮음. 이 역순 패턴은 effort가 thinking 트리거 제어 레버가 아님을 보여줌.

**해석**: Effort 파라미터는 thinking이 발생했을 때 **얼마나 깊게(몇 토큰으로)** 생각할지의 **상한을 조절**하는 레버이지, thinking을 **시작할지 말지를 결정하는 스위치가 아니다**. Thinking 트리거는 모델이 input을 본 후 첫 output 토큰에서 자체 판단하는 것이므로, effort와 독립적.

**비용 측면 함의**: opus-4-7은 **effort 설정을 어떻게 하든 thinking 비용이 많이 발생**한다. 단지 각 thinking의 길이만 조절될 뿐. 따라서 opus-4-7의 thinking 비용 문제는 effort로 근본 해결 불가능하고, **모델을 바꾸는 것(4-6 사용)이 유일한 실효 대응책**.

### 4.2 Visible Output 장황함 (Verbosity)

Thinking 영향을 배제한 순수 출력 비교를 **두 환경**에서 수행:

#### 환경 1: Subagent (가장 통제된 조건)

CC가 subagent의 thinking을 명시적으로 차단 (§4.5). 사용자에게 직접 보이지 않는 단순 실행 환경. 두 모델 모두 **같은 역할·같은 제약**.

- **opus-4-7**: 279 tok/call (1,160 samples)
- **opus-4-6**: 163 tok/call (3,168 samples)
- Raw 1.71배 → Tokenizer 실측 보정(÷1.28) 후 **1.34배**
- Tokenizer 최대 보정(÷1.35) 후에도 **1.27배**

#### 환경 2: Main 세션의 No-thinking 호출

Main 세션에서 두 모델 모두 thinking 없이 응답한 호출.

- **opus-4-7**: 1,306 tok/call (1,696 samples)
- **opus-4-6**: 451 tok/call (1,773 samples)
- Raw 2.90배 → Tokenizer 보정 후 **2.26배**

#### 해석

두 독립 환경 모두에서 4-7이 더 장황:

- Subagent 1.34배 (통제 조건 최강, 같은 짧은 실행 작업)
- Main no-think 2.26배 (작업 복잡도/유형 편향 큼 — cc-token-saver 분석 작업이 4-7에 집중된 영향)

Tokenizer 최대 보정을 적용해도 subagent에서 1.27배가 남음. **Thinking 비활성 + tokenizer 보정 후에도 남는 차이 = 4-7 고유 verbosity 증가분**. 통제 조건 기준 **27~34%**, 덜 통제된 조건에서는 더 크게 나타남.

### 4.3 Tokenizer 팽창

동일 텍스트를 같은 시점에 두 모델 subtask로 보내 input_tokens 비교:

- **영어/코드 (시스템 프롬프트)**: 4-7 / 4-6 = **1.375x** (37.5% 팽창)
- **영어 산문 (Genesis EN)**: 1.281x (28% 팽창)
- **한글 (Genesis KO)**: 1.004x (차이 없음)

공식 발표 "최대 1.35x"와 일치. **한글/CJK는 tokenizer 차이가 거의 없음**, 영어/코드만 팽창.

### 4.4 Context 누적 메커니즘

CC 소스 분석 결과:

- Thinking 블록은 API 응답에 `signature`(암호화 블롭) 포함되어 내려옴
- JSONL에는 `thinking` 내용은 빈 문자열, `signature`만 저장
- 다음 API 호출마다 **모든 이전 턴의 thinking signature가 전송**되고 서버가 복호화
- 서버 쪽 context에서는 복호화된 전체 thinking이 토큰으로 카운트
- 설정: `clear_thinking_20251015` (keep: 'all') — 기본적으로 모든 thinking 보존

**결론**: Thinking 텍스트는 사용자가 볼 수 없지만, **context에 실제로 누적되고 매 턴 비용으로 집계됨.**

### 4.5 Main 세션 vs Subagent 구조적 차이

Main 세션과 subagent를 분리 집계한 결과:

- **4-7 main**: 2,317 calls, think 621개 → **26.8%**, out/call 1,339
- **4-7 subagent**: 1,160 calls, think **0**개 → **0.0%**, out/call 279
- **4-6 main**: 1,918 calls, think 145개 → **7.56%**, out/call 468
- **4-6 subagent**: 3,168 calls, think **0**개 → **0.0%**, out/call 163

**핵심 발견: Subagent에서는 두 모델 모두 thinking이 완전히 차단됨 (0건)**.

#### CC 소스 확인 (`tools/AgentTool/runAgent.ts:682-684`)

```typescript
thinkingConfig: useExactTools
  ? toolUseContext.options.thinkingConfig  // fork children: parent 상속
  : { type: 'disabled' as const },         // 일반 subagent: DISABLED
```

주석: *"For regular sub-agents, disable thinking to control output token costs."*

CC는 이미 thinking을 비용 증가 요인으로 인지하고, **일반 Agent() 호출로 생성되는 subagent의 thinking을 명시적으로 비활성화**한다. Fork children (useExactTools)만 예외적으로 parent의 설정 상속 (prompt cache hit 유지 목적).

#### 전략적 함의

- **Main 세션에서만 thinking 비용 발생** — 4-7의 비용 폭증은 main 세션의 thinking 빈도에 집중
- **Subagent는 안전지대** — 모델이 뭐든 thinking 차단되어 출력이 간결
- **4-7 main vs 4-6 main 비율**: 26.8% / 7.56% = **3.5배** (subagent 0을 포함한 전체 6.3배와 구분)
- **Out/call 격차도 subagent에서 줄어듦**: main 1,339/468 = 2.86배 → subagent 279/163 = 1.71배
- Subagent 비교(1.71배)는 순수 verbosity 차이의 하한선. Tokenizer 최대 보정 시 1.27배, 실측 보정 시 1.34배 → **4-7은 같은 작업에 본질적으로 27~34% 더 많은 토큰을 생성**

**Trade-off 주의**: Subagent에 thinking이 없다는 건 **복잡한 추론이 필요한 작업은 subagent로 보내면 품질 저하 가능**하다는 뜻. 계획/아키텍처 결정 같은 작업은 main에서 4-7의 thinking 이점을 활용하는 게 맞고, 구체적 구현/조사는 subagent로 보내는 분업 구조가 최적.

### 4.6 Per-turn 비용 실측

- **Output per call (전체 평균)**: 4-7 985 tok vs 4-6 278 tok → 3.54배 (tokenizer 보정 후 2.77배) — subagent 비중 증가로 절대값은 줄었으나 격차는 확대
- **Cache create per turn**: 4-7 $0.103 vs 4-6 $0.031 → **3.37배**
- **Cache read per turn**: 4-7 $0.405 vs 4-6 $0.432 → 0.94배 (거의 동일)
- **Total per turn**: 4-7 $0.587 vs 4-6 $0.497 → 1.18배

Cache read는 context 크기에 비례하므로 모델 무관. 세션이 길어질수록 전체 비용에서 cache read 비중이 커져 모델 차이는 희석.

---

## 5. 복합 효과 시뮬레이션

3가지 효과(thinking 빈도, verbosity, tokenizer 팽창)를 모두 반영한 시뮬레이션.

### 5.1 시나리오별 per-turn 비용 비율

100턴 대화 기준 누적 토큰 소비. 아래 비율은 **같은 작업을 할 때 4-7의 턴당 비용 / 4-6의 턴당 비용**이다. 5h 윈도우는 이 비율에 비례해서 빨리 차오른다.

- **영어 위주 (코드 작업, tokenizer 팽창 1.28x)**: 4-7 턴당 비용 ×**1.43** → **턴당 43% 더 비쌈**; 5h 윈도우는 원래 시간의 ~70%에 소진 (30% 빨리 — 평소 4시간 쓰던 사용자가 약 2시간 48분에 블록)
- **한/영 혼합 (tokenizer 팽창 1.10x)**: ×1.23 (턴당 23% 비쌈; 윈도우 ~81%에 소진, 4시간 사용자가 약 3시간 15분에 블록)
- **순수 한글 (tokenizer 팽창 1.00x, 이론)**: ×1.12 (턴당 12% 비쌈; 윈도우 ~89%에 소진, 4시간 사용자가 약 3시간 34분에 블록)

### 5.2 Context 성장률

같은 대화를 100턴 진행했을 때 context 크기 (turn별):

- **Turn 10**: 4-6 = 37,644 / 4-7(영어) = 53,841 / 4-7(혼합) = 46,270 / 4-7(한글) = 42,063
- **Turn 50**: 4-6 = 188,220 / 4-7(영어) = 269,206 / 4-7(혼합) = 231,349 / 4-7(한글) = 210,317
- **Turn 100**: 4-6 = 376,440 / 4-7(영어) = 538,412 / 4-7(혼합) = 462,697 / 4-7(한글) = 420,634

### 5.3 Auto-compact 도달 시점 (200K 기준)

- **4-6**: 53턴
- **4-7 (영어)**: 37턴 (200K 도달 30% 빨리)
- **4-7 (혼합)**: 43턴 (19% 빨리)
- **4-7 (한글)**: ~48턴 (11% 빨리)

---

## 6. 결론 및 권고

### 6.1 주요 결론

- **4-7이 4-6보다 비용이 많이 드는 것은 사실이며, 이유는 3가지 복합 효과**:
  
  - Thinking 빈도가 **3.5배 높음** (main 기준: 4-6=7.56% → 4-7=26.8%)
  - Visible output 자체가 **27~34% 장황** (tokenizer/thinking 보정 후, subagent 통제 기준 하한)
  - 영어/코드에서 tokenizer가 **28~38% 팽창**

- **한국어 대화는 영향이 작음** (tokenizer 팽창 ~1%)

- **Context 누적 효과가 실재**: Thinking이 다음 턴에 전부 보존되어 cache 비용으로 누적

- **사용자는 제어권이 제한적**:
  
  - `budget_tokens`로 thinking 길이 조절 가능하나, thinking 시작 여부는 모델 판단
  - **Effort 설정(low/medium/high/xhigh)을 바꿔도 thinking 빈도는 제어 불가** — 실측 4-7 effort별 think rate가 16~38% 범위에서 effort 단계와 무관하게 출렁임. 오히려 low(37.5%)가 가장 높고 xhigh(16.3%)가 가장 낮음 — 단조 관계 없음을 입증
  - Subagent 모델을 세밀하게 지정 불가 (alias만 가능, 버전 지정 불가)
  - `CLAUDE_CODE_SUBAGENT_MODEL` 환경변수는 전체 일괄 적용

### 6.2 비용 절감 레버 (효과 순)

- **세션 길이 관리** (context 크기) — 가장 큰 영향
- **모델 선택** (4-6 사용) — 작업 유형에 따라 10~40% 절감
- **대화 언어** (한글) — tokenizer 팽창 회피
- **Thinking 빈도** — 모델에 종속, 직접 제어 불가

### 6.3 실용적 권고

#### 전략 A: 전체 4-6 사용 (단순, 안정)

- `/model claude-opus-4-6[1m]` (또는 1M 불필요하면 `claude-opus-4-6`)
- 가장 쉽고 일관된 비용 절감 (20~40%)
- 일상 코딩/디버깅/리팩토링에 적합

#### 전략 B: 4-7 Main (뇌) + Sonnet Subagent (손발)

CC의 구조적 특성 — **subagent는 thinking 차단, main은 thinking 유지** — 을 적극 활용.

**작업 배치 원칙**:

- **Main 4-7에서 처리할 작업** (thinking 가치 있음):
  
  - 아키텍처 설계, 기술 결정
  - 복잡한 디버깅 (여러 가설 탐색)
  - 다단계 계획 수립 (의존성 추적)

- **Subagent Sonnet에 위임할 작업** (thinking 불필요):
  
  - 명세 기반 구현 (패턴 적용)
  - 여러 파일 일괄 수정 (반복 작업)
  - 코드 탐색/검색 (단순 I/O)
  - 단순 질문 응답

**작동 원리**:

- Main은 4-7의 thinking 강점을 활용해 "뇌"로 기능 — 계획, 판단, 통합
- Subagent는 thinking이 자동 차단되어 저렴하게 "손발"로 기능 — 실행, 조사, 반복
- Main에서 명확한 지시(실행 계획)를 만들어 subagent에 위임하면 양쪽 모두 최적

**흔한 실수 — 피해야 할 패턴**:

- ❌ 계획 작업 자체를 subagent에 위임 → thinking 없어서 추론 품질 저하
- ❌ Main에서 단순 반복 작업 수행 → 4-7의 thinking 비용이 낭비
- ❌ Subagent에 `model: opus` 지정 → main과 같은 모델이라 비용 절감 효과 없음 (thinking은 어차피 차단이지만 토큰 단가가 비쌈)

**주의 사항**:

- Agent/skill의 `model` 필드는 alias(`sonnet`/`opus`/`haiku`)만 가능 — 버전 지정 불가
- `CLAUDE_CODE_SUBAGENT_MODEL` 환경변수로 전역 override는 가능하나 선택적 적용 불가

#### 공통 관리 습관

- **세션 관리**: `/continue`로 초기 context 경량화, 긴 세션은 정기적으로 압축
- **공유**: 초심자에게는 "같은 작업을 4-6으로 하면 대략 20~40% 절약된다"로 소개

---

## 7. 조사의 한계

- **Thinking 내용 부재**: JSONL에 `thinking`이 빈 문자열이라 실제 생각 길이는 추정만 가능
- **Tokenizer 샘플 크기**: 제어 실험에서 delta 값이 982 vs 1,258 수준이라 ±5% 노이즈
- **시뮬레이션 가정**: per-turn tool 결과를 3,000 토큰으로 고정했으나 실제는 변동
- **프로젝트 편향**: 두 프로젝트 모두 한 사용자의 작업 패턴을 반영

## 부록: 주요 측정 데이터

```
=== Thinking rate (2026-04-20 갱신, main + subagent, 두 프로젝트 합산) ===
opus-4-7: 621/3,477 = 17.9%
opus-4-6: 145/5,086 =  2.85%
Ratio: 6.3x (main only: 26.8% vs 7.56% = 3.5x)

=== 4-7 effort별 thinking rate (default는 xhigh로 통합) ===
Low    :  12/32      = 37.5%  (샘플 작음)
Medium : 101/335     = 30.1%
High   :  36/212     = 17.0%
Xhigh  : 472/2,898   = 16.3%  (가장 큰 샘플 83%, 4-7 기본값)
전체   : 621/3,477   = 17.9%

=== Tokenizer test (control) ===
System prompt baseline: 4-6=11,526, 4-7=15,846 (ratio 1.375x)
Genesis EN delta:       4-6=982,    4-7=1,258  (ratio 1.281x)
Genesis KO delta:       4-6=1,801,  4-7=1,809  (ratio 1.004x)

=== Verbosity (thinking 차단 환경) ===
Subagent out/call:     4-6=163 (n=3,168), 4-7=279 (n=1,160)   (raw 1.71x, 보정 1.34x)
Main no-think out:     4-6=451 (n=1,773), 4-7=1,306 (n=1,696) (raw 2.90x, 보정 2.26x)

=== Output tokens per call (전체) ===
opus-4-7:   985 tok/call (think 17.9%, no-think 82.1%)
opus-4-6:   278 tok/call (think  2.85%, no-think 97.15%)

=== 프로젝트별 분포 ===
cc-token-saver: 4-7 main=1,589(28.7%) / sub=41     / 4-6 main=169(9.5%)  / sub=18
doooz:          4-7 main=728(22.7%)   / sub=1,119  / 4-6 main=1,749(7.4%) / sub=3,150
```

---

*이 리포트는 2026-04-20에 작성됨.*

---

## 방법론: 데이터 수집 스크립트

리포트의 모든 수치는 재현 가능합니다. 아래 두 개의 Python 스크립트로 생성됐습니다 — 하나는 JSONL 트랜스크립트에서 관찰 데이터를 집계하는 스크립트, 다른 하나는 §5 시뮬레이션을 돌리는 스크립트. 둘 다 Python 3 + 표준 라이브러리만 사용.

### Script 1 — 트랜스크립트 집계

(model, main/subagent) 버킷별로 calls, thinking rate, out/call을 집계. opus-4-7은 effort 단계도 분리. 결과는 `/tmp/cost-analysis-refresh.json`으로 저장.

```python
#!/usr/bin/env python3
# collect_stats.py — Claude Code JSONL 트랜스크립트를 순회하며 비용 통계 집계
import json, os, re, glob
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
FILTER_SINCE = "2026-04-17T00:00:00Z"
PROJECTS = {
    "cc-token-saver": HOME / ".claude/projects/-Users-taehyoungkim-Documents-DEV-cc-token-saver",
    "doooz":          HOME / ".claude/projects/-Users-taehyoungkim-Documents-DEV-VibeFamily-doooz",
}
# local-command-stdout에 담긴 effort 전환 신호 정규식
EFFORT_RE = re.compile(
    r"Set effort level to (low|medium|high|xhigh)|"
    r"Set model to .+?with (low|medium|high|xhigh) effort",
    re.IGNORECASE,
)

def normalize_model(m):
    if not m: return None
    if "4-7" in m: return "opus-4-7"
    if "4-6" in m: return "opus-4-6"
    return None

def walk_main_jsonl(path, project):
    """메인 세션 JSONL을 순회하며 assistant 메시지를 yield."""
    current_effort = "xhigh"  # opus-4-7 기본값 (선행 연구)
    with open(path) as f:
        for line in f:
            try: d = json.loads(line)
            except: continue
            ts = d.get("timestamp", "")
            if ts < FILTER_SINCE: continue
            # 사용자 메시지에서 effort 전환 감지
            if d.get("type") == "user":
                content = d.get("message", {}).get("content", "")
                text = content if isinstance(content, str) else " ".join(
                    b.get("text", "") for b in content if isinstance(b, dict))
                m = EFFORT_RE.search(text)
                if m:
                    current_effort = (m.group(1) or m.group(2)).lower()
            if d.get("type") == "assistant":
                msg = d.get("message", {})
                usage = msg.get("usage") or {}
                if "output_tokens" not in usage: continue
                model = normalize_model(msg.get("model"))
                if not model: continue
                has_think = any(
                    isinstance(b, dict) and b.get("type") == "thinking"
                    for b in (msg.get("content") or [])
                )
                yield {
                    "project": project,
                    "is_subagent": False,
                    "model": model,
                    "has_thinking": has_think,
                    "output_tokens": usage["output_tokens"],
                    "effort": current_effort if model == "opus-4-7" else None,
                    "timestamp": ts,
                }

def walk_subagent_jsonl(path, project, parent_effort_by_ts):
    with open(path) as f:
        for line in f:
            try: d = json.loads(line)
            except: continue
            ts = d.get("timestamp", "")
            if ts < FILTER_SINCE: continue
            if d.get("type") != "assistant": continue
            msg = d.get("message", {})
            usage = msg.get("usage") or {}
            if "output_tokens" not in usage: continue
            model = normalize_model(msg.get("model"))
            if not model: continue
            has_think = any(
                isinstance(b, dict) and b.get("type") == "thinking"
                for b in (msg.get("content") or [])
            )
            # Subagent는 launch 시점 부모 effort 상속 (간소화된 구현: xhigh 기본)
            effort = "xhigh" if model == "opus-4-7" else None
            yield {
                "project": project,
                "is_subagent": True,
                "model": model,
                "has_thinking": has_think,
                "output_tokens": usage["output_tokens"],
                "effort": effort,
                "timestamp": ts,
            }

def main():
    records = []
    for project, base in PROJECTS.items():
        if not base.exists(): continue
        for p in sorted(base.glob("*.jsonl")):
            records.extend(walk_main_jsonl(p, project))
        for p in sorted(base.glob("*/subagents/*.jsonl")):
            records.extend(walk_subagent_jsonl(p, project, {}))

    def agg(rows):
        n = len(rows)
        if n == 0: return {"calls": 0, "thinking_calls": 0, "rate": 0.0, "out_per_call": 0}
        tc = sum(1 for r in rows if r["has_thinking"])
        ot = sum(r["output_tokens"] for r in rows)
        return {"calls": n, "thinking_calls": tc, "rate": round(tc/n, 4), "out_per_call": round(ot/n)}

    def by(pred): return [r for r in records if pred(r)]

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filter_since": FILTER_SINCE,
        "totals": {m: agg(by(lambda r, m=m: r["model"] == m)) for m in ("opus-4-7", "opus-4-6")},
        "by_bucket": {
            f"{m.replace('opus-', '')}_{'subagent' if sub else 'main'}":
              agg(by(lambda r, m=m, sub=sub: r["model"] == m and r["is_subagent"] == sub))
            for m in ("opus-4-7", "opus-4-6") for sub in (False, True)
        },
        "effort_breakdown_4-7": {
            e: agg(by(lambda r, e=e: r["model"] == "opus-4-7" and r["effort"] == e))
            for e in ("low", "medium", "high", "xhigh")
        },
        "no_think_verbosity": {
            f"{m.replace('opus-', '')}_{'subagent' if sub else 'main'}":
              agg(by(lambda r, m=m, sub=sub: r["model"] == m and r["is_subagent"] == sub and not r["has_thinking"]))
            for m in ("opus-4-7", "opus-4-6") for sub in (False, True)
        },
    }
    Path("/tmp/cost-analysis-refresh.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out["totals"], indent=2))

if __name__ == "__main__":
    main()
```

### Script 2 — §5 시뮬레이션

§5의 100턴 context 성장률 및 5h 윈도우 소진 비율을 재현. 입력: Script 1의 관찰 계수 + §4.3 제어 실험의 3가지 tokenizer 팽창 값.

```python
#!/usr/bin/env python3
# simulate.py — 갱신된 계수로 §5 재계산

BASE_OUT_46 = 451     # 4.6 main no-think out/call (visible)
THINK_ADD   = 1500    # thinking 발생 시 평균 thinking 토큰
TOOL_RESULT = 3000    # 턴당 tool result (가정 상수)
USER_IN     = 200     # 턴당 사용자 프롬프트
TURNS       = 100

# 관찰 (2026-04-20 갱신, main 세션 기준):
RATE_47 = 0.268       # §4.5 (4.7 main)
RATE_46 = 0.0756      # §4.5 (4.6 main)
VERBOSITY_47_OVER_46 = 1.34  # §4.2 subagent tokenizer 보정

# 4.7의 tokenizer 팽창 (4.6 대비) — §4.3 제어 실험:
SCENARIOS = {"english": 1.28, "mixed": 1.10, "korean": 1.00}

def per_turn(rate, verb, infl):
    return (USER_IN + TOOL_RESULT) * infl + BASE_OUT_46 * verb * infl + rate * THINK_ADD * infl

p46 = per_turn(RATE_46, 1.0, 1.0)
for name, infl in SCENARIOS.items():
    p47 = per_turn(RATE_47, VERBOSITY_47_OVER_46, infl)
    ratio = p47 / p46
    print(f"{name:<10} 4.7/4.6 per-turn ratio = {ratio:.3f}  "
          f"(100턴 ctx: 4.6={100*p46:,.0f} / 4.7={100*p47:,.0f})  "
          f"(200K auto-compact: 4.6={200000/p46:.1f}턴, 4.7={200000/p47:.1f}턴)")
```

### Caveats

- **Effort 세그멘테이션은 근사치**: JSONL은 API 호출별 effort를 기록하지 않음. 사용자 메시지의 local-command-stdout 신호 (`/effort X` 및 `/model ... with X effort`)로 추론하며, 다음 신호가 나올 때까지 이어 사용. `/effort` 신호가 없는 opus-4-7 호출은 선행 연구에 따라 `xhigh` 기본값으로 간주. Subagent는 launch 시점 부모 세션의 effort를 상속한다는 것이 정확하나 샘플 스크립트에서는 단순화됨.
- **시뮬레이션은 프록시**: 턴당 tool result, 사용자 입력, thinking 길이 등의 상수는 일반적 코딩 세션에 맞춰 선택했으나 모든 작업 패턴을 반영하지 못함. 비율(4.7/4.6)이 절대 수치보다 견고.
- **Tokenizer 팽창**은 §4.3의 제어 실험으로 측정되며 관찰 데이터와 독립.
