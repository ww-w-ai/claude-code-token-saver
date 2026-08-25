# Opus 4.7 vs 4.6 비용 분석 리포트

**조사 기간**: 2026-04-17 ~ 2026-04-20
**환경**: Claude Code v2.1.88 및 v2.1.112, macOS, 한/영 혼합 대화
**샘플 크기**: 두 프로젝트 합계 8,563 calls (4-7: 3,477, 4-6: 5,086)

> English version: [opus-4-7-vs-4-6-cost-analysis.md](./opus-4-7-vs-4-6-cost-analysis.md)

---

## 0. 한눈에 보기 (Executive Summary)

### Opus 4.7이 4.6보다 42% 더 비싸다고?

4.7로 바꾼 뒤 사용량 소진이 눈에 띄게 빨라지는 게 체감되어서, 두 프로젝트에서 쌓인 API 호출 8,563개를 직접 뜯어봤습니다.¹ 같은 작업, 같은 프롬프트인데 비용이 **42% 더** 나옵니다.

이유가 하나가 아니더라고요. 세 가지가 동시에 터진 결과였습니다:

- **언어가 비싸졌다** — 같은 텍스트에 토큰을 최대 35% 더 씀 (tokenizer 팽창)
- **생각이 잦아졌다** — thinking 빈도 3.5배 (7.56% → 26.8%), effort 설정과 무관
- **말이 많아졌다** — 같은 답변을 27~34% 더 장황하게 설명

셋이 매 턴 곱셈 효과로 쌓이면서 context를 빨리 채우고 cache 비용까지 복리로 늘립니다. 하드하게 쓰던 분들은 보통 5시간 중 4시간 정도에 블록되고 1시간 쉬었다가 했을 텐데, 이제 **2시간 40~50분만에 블록**됩니다. "어? 내가 너무 빨리 바닥나는 것 같은데" 싶으셨다면, 기분 탓이 아니었던 거죠.

이 리포트는 왜 이런 일이 벌어지는지, 그리고 **어떻게 하면 되는지**를 정리한 것입니다.

---

¹ 측정 기준: super-token-saver + doooz 두 프로젝트 JSONL 기반, 영어/코드 위주 100턴 시뮬레이션. **한/영 혼합 사용 시 약 26%, 한글 위주 시 약 18%**. 작업 유형·언어 비율·세션 길이에 따라 달라질 수 있습니다. 자세한 시뮬레이션 조건은 §5 참조.

### 원인 상세: 세 가지 복합 효과

가장 큰 원인인 tokenizer부터 보겠습니다.

- **언어가 비싸졌다 — Tokenizer 팽창 (영어/코드 28~38%)**
  
  Anthropic 공식 발표에 따르면, 4.7에서는 새로운 tokenizer를 도입하여 같은 텍스트에 대해 토큰을 최대 35%까지 더 상세하게 쪼갭니다. 동일 텍스트 제어 실험으로 확인했습니다 (§4.3). 한글은 영향 없음 (~1%).

- **생각이 잦아졌다 — Thinking 빈도 3.5배**
  
  Main 세션 기준으로 4-6은 7.56%, 4-7은 26.8%에서 thinking이 발생합니다. "effort 레벨로 조절하면 되지 않나?" 생각하실 수 있는데, effort는 thinking의 **길이**를 조절하는 기능이지 **할지/말지**를 결정하는 스위치가 아닙니다. 실제로 effort를 low로 낮춰도 thinking 빈도는 줄지 않았습니다 (§4.1). 근거: JSONL 3,075 main calls.

- **말이 많아졌다 — Output verbosity 27~34% 증가**
  
  Thinking이 차단된 subagent 환경에서도 출력량이 1.34배였습니다 (tokenizer 보정 후). Thinking이나 tokenizer로 설명이 안 되는 4-7 고유 특성입니다.

세 요인이 **매 턴 output에 누적** → context 성장 가속 → cache read 비용 복리 증가.

### 그러면 어떻게 해야 할까요?

#### 방법 1 — 그냥 전체를 4.6으로 (대부분에게 권장)

이것만 해도 세션 시간의 20~40%를 돌려받을 수 있습니다.

```
/model claude-opus-4-6[1m]
```

(1M 컨텍스트가 필요 없으면 `claude-opus-4-6`만 써도 됩니다.)

이게 뭘 하냐면, 현재 세션을 Opus 4.6으로 고정합니다. 4.6은 thinking 빈도가 낮고, 응답도 더 간결하며, tokenizer도 더 효율적입니다. 95% 이상의 코딩/디버깅/리팩토링 작업에서 4.7과 체감 품질 차이 거의 없습니다.

**주의**: `/model`은 현재 세션에만 적용됩니다. 새 터미널을 열면 다시 실행해야 합니다.

#### 방법 2 — 4.7은 설계에만, 실행은 Sonnet 서브태스크로 (고급)

그래도 4.7의 향상된 성능을 쓰고 싶다면? main 세션은 4.7을 유지하되, 실행은 서브태스크로 위임하세요. Claude Code가 **서브태스크에서는 thinking을 자동으로 끄기 때문에** 저렴하게 돌아갑니다.

- **Main (Opus 4.7)**: 아키텍처 결정, 버그 가설 탐색, 다단계 계획 수립 — 깊이 있는 추론이 필요한 일
- **서브태스크 (Sonnet)**: 이미 작성한 명세 구현, 여러 파일 일괄 수정, 코드베이스 검색, 단순 질문 응답

Claude에게 "sonnet으로 서브태스크 띄워서 X 해줘"라고 말하면 됩니다. 또는 agent frontmatter에 `model: sonnet`을 명시해둘 수도 있고요.

**피해야 할 실수**: 계획 작업 자체를 서브태스크로 위임하지 마세요. 서브태스크는 thinking이 꺼져 있어서 계획이 얕게 나옵니다. 설계는 main에서, 실행은 서브태스크에서 — 이 분업이 핵심입니다.

#### 방법 3 — super-token-saver 플러그인 사용 (방법 2 + 토큰 관리 자동화)

위 방법들을 수동으로 관리하기 번거로운 분들에게 추천합니다. [super-token-saver](https://github.com/ww-w-ai/super-token-saver)는 Claude Code 세션의 토큰/비용을 자동으로 추적하고 절감하는 오픈소스 플러그인입니다.

- 설계는 `claude -p`(main, thinking 활성)로, 실행은 SubTask + Sonnet으로 자동 분산
- 프롬프트 캐시 만료 시 경고해서 불필요한 재캐시 비용을 방지
- `/usage-view`로 실시간 비용 대시보드 확인
- `/s-continue`로 세션 간 context를 LLM 호출 없이(= 비용 0) 복원

이 리포트의 분석 데이터도 super-token-saver로 수집한 것입니다.

고민된다면 **방법 1부터 시작하세요.** 명령어 하나고, 언제든 되돌릴 수 있습니다.

---

## 1. 조사 배경

### 문제 인식

Opus 4.7로 Claude Code를 쓰면서 **5시간 윈도우가 평소보다 빨리 소진**되는 게 느껴졌습니다. 같은 양의 작업을 하는데도 쿼터가 빨리 줄어드는 게 기분 탓인지 진짜인지 확인이 필요했습니다.

### 가설

- 모델 업그레이드(4.6 → 4.7)가 비용 증가의 원인인가?
- Claude Code 버전 자체의 버그인가?
- Tokenizer가 바뀐 영향인가?
- 모델 자체의 thinking 성향이 달라진 건가?

### 조사 목적

- 5h 윈도우 소진이 정말 빨라졌는지 정량화
- 원인이 모델인지 CC 버전인지 분리
- 실질적인 대응책 선택을 위한 근거 마련

---

## 2. 분석 데이터

### 2.1 JSONL 트랜스크립트 (관찰 데이터)

제가 실제로 작업한 두 프로젝트의 세션 JSONL 파일입니다 (2026-04-17 이후, main + subagent 포함):

- **doooz** (개인 프로젝트, 디자인 리팩토링 — [github.com/taekim34/doooz](https://github.com/taekim34/doooz)): 4-7 calls 1,847개 (main 728 / sub 1,119), 4-6 calls 4,899개 (main 1,749 / sub 3,150)
- **super-token-saver** (분석/디버깅): 4-7 calls 1,630개 (main 1,589 / sub 41), 4-6 calls 187개 (main 169 / sub 18)
- **합계**: 4-7 3,477 calls, 4-6 5,086 calls (총 8,563 calls)

JSONL에서 뽑은 필드들:

- `message.model` — 호출 시 사용된 모델
- `message.usage.output_tokens` — 출력 토큰 수
- `message.usage.input_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens`
- `message.content[].type === "thinking"` — thinking 블록 존재 여부
- `message.content[].signature` — thinking 서명(암호화된 블록)

### 2.2 제어된 실험 (실험 데이터)

**Tokenizer 팽창 측정**: 같은 텍스트를 4-6과 4-7 subtask에 동시에 보내서 `input_tokens`가 얼마나 다른지 비교했습니다.

- **System prompt (영어/코드)**: 4-6 = 11,526 tokens, 4-7 = 15,846 tokens
- **Genesis 1장 영어**: 4,087 chars, cl100k 949 tok → 4-6=982, 4-7=1,258
- **Genesis 1장 한글**: 1,673 chars, cl100k 1,633 tok → 4-6=1,801, 4-7=1,809

순수한 영어 문장과 한글 문장을 테스트하기 위해 성경의 창세기 구절을 입력해봤습니다. 동일 프롬프트를 동일 시점에 두 모델에 보내서 순수 tokenizer 차이만 분리한 것입니다.

---

## 3. 분석 관점

"왜 비싸졌을까?"를 **4가지 독립 변수**로 쪼개서 각각 따로 확인했습니다:

- **Thinking 빈도**: 4-7이 4-6보다 "생각"을 더 자주 하는가? → thinking 블록을 포함한 호출의 비율
- **Visible output 장황함**: Thinking을 빼고 봐도 순수 응답이 더 긴가? → No-thinking calls 평균 `output_tokens` 비교
- **Tokenizer 효율**: 같은 텍스트를 표현하는 데 4-7이 더 많은 토큰을 쓰는가? → 동일 텍스트 제어 실험
- **Context 누적 효과**: Thinking이 다음 턴 context에 남는가? → CC 소스 분석 + JSONL signature 확인

---

## 4. 주요 발견

### 4.1 Thinking 빈도 차이

**2026-04-17 이후 두 프로젝트 전체 (main + subagent)**:

- **opus-4-7**: 3,477 calls 중 621 thinking → **17.9%**
- **opus-4-6**: 5,086 calls 중 145 thinking → **2.85%**
- **전체 비율: 6.3배**

같은 기간, 같은 작업 환경에서 subtask까지 전부 집계한 수치입니다. 4-6에서는 대부분의 호출이 thinking 없이 처리되는 반면, 4-7은 5~6번에 1번꼴로 thinking이 발생합니다.

#### Effort별 4-7 thinking rate (subtask 포함)

- **Low**: 32 calls 중 12 thinking → **37.5%** (샘플 작음, out/call 590)
- **Medium**: 335 calls 중 101 thinking → **30.1%** (out/call 1,867)
- **High**: 212 calls 중 36 thinking → **17.0%** (out/call 1,796)
- **Xhigh (4-7 기본값)**: 2,898 calls 중 472 thinking → **16.3%** (out/call 829, 가장 큰 샘플 83%)
- **전체 평균**: 3,477 calls 중 621 thinking → **17.9%**

(default는 4-7의 기본 effort인 xhigh로 통합)

#### Effort의 진짜 역할 — thinking 길이 제한, 트리거 여부 아님

여기서 재밌는 건, think rate가 16~38% 범위에서 effort 단계와 **단조 관계가 없다**는 겁니다. 직관과 달리 low(37.5%)가 가장 높고, xhigh(16.3%)가 가장 낮아요. 완전 역순이죠.

이게 의미하는 건 이겁니다: effort는 thinking이 발생했을 때 **얼마나 깊게 생각할지의 상한**을 조절하는 레버이지, thinking을 **할지/말지를 결정하는 스위치가 아닙니다**. Thinking 트리거는 모델이 input을 보고 자체 판단하는 것이므로 effort와는 무관합니다.

그러니까 opus-4-7은 **effort를 어떻게 바꿔도 thinking 비용이 많이 발생**합니다. 각 thinking의 길이만 조절될 뿐이죠. effort로는 근본 해결이 안 되고, **모델을 바꾸는 것(4-6 사용)이 유일한 실효 대응책**입니다.

### 4.2 Visible Output 장황함 (Verbosity)

이미 답변이 장황해진거 느끼신 분들 많을 텐데, 이것도 fact입니다. Thinking 영향을 배제하고 순수 출력만 비교해봤습니다.

#### 환경 1: Subagent (가장 통제된 조건)

CC가 subagent의 thinking을 명시적으로 차단합니다 (§4.5). 두 모델 모두 **같은 역할·같은 제약** 아래에서 비교한 거라 가장 공정합니다.

- **opus-4-7**: 279 tok/call (1,160 samples)
- **opus-4-6**: 163 tok/call (3,168 samples)
- Raw 1.71배 → Tokenizer 보정(÷1.28) 후 **1.34배**
- Tokenizer 최대 보정(÷1.35) 후에도 **1.27배**

#### 환경 2: Main 세션의 No-thinking 호출

Main 세션에서 두 모델 모두 thinking 없이 응답한 호출만 골라봤습니다.

- **opus-4-7**: 1,306 tok/call (1,696 samples)
- **opus-4-6**: 451 tok/call (1,773 samples)
- Raw 2.90배 → Tokenizer 보정 후 **2.26배**

#### 해석

두 환경 모두에서 4-7이 더 장황합니다:

- Subagent 1.34배 (가장 통제된 조건, 같은 짧은 실행 작업)
- Main no-think 2.26배 (작업 복잡도 편향이 있긴 하지만 — super-token-saver 분석 작업이 4-7에 집중)

Tokenizer 최대 보정을 적용해도 subagent에서 1.27배가 남습니다. **Thinking도 끄고, tokenizer 차이도 보정한 뒤에 남는 차이 = 4-7 고유 verbosity 증가분**입니다. 통제 조건 기준 **27~34%**, 덜 통제된 조건에서는 더 크게 나타납니다.

### 4.3 Tokenizer 팽창

같은 텍스트를 같은 시점에 두 모델 subtask로 보내서 input_tokens를 비교했습니다:

- **영어/코드 (시스템 프롬프트)**: 4-7 / 4-6 = **1.375x** (37.5% 팽창)
- **영어 산문 (Genesis EN)**: 1.281x (28% 팽창)
- **한글 (Genesis KO)**: 1.004x (차이 없음)

코드 기반 입력에서 특히 많이 늘었습니다. Anthropic 공식 발표 "최대 1.35x"와 일치하며, 제 테스트에서는 37.5%까지 나왔습니다.

한글은 거의 동일했는데, 한글 자체가 자모 조합 체계(초성+중성+종성)로 이미 체계적인 분해 구조를 갖추고 있어서 새 토크나이저가 더 쪼갤 부분이 거의 없기 때문입니다. 영어는 `tokenizer` → `token` + `izer`처럼 형태소 경계가 모호해서 재조정할 여지가 크지만, 한글은 그렇지 않은 거죠.

왜 토큰을 더 쪼갰을까요? 기존 tokenizer는 일반 영어 문장에 최적화되어 있었는데, 최근 LLM은 코딩, 구조화된 문서, 수식 등에서 성능 강화를 하고 있기 때문에 그에 맞춰 토큰화를 재조정한 것으로 보입니다.

### 4.4 Context 누적 메커니즘

Thinking이 실제로 context에 쌓이는지 확인해봤습니다:

- Thinking 블록은 API 응답에 `signature`(암호화 블롭)로 포함되어 내려옵니다
- JSONL에는 `thinking` 내용은 빈 문자열, `signature`만 저장됩니다
- 다음 API 호출마다 **모든 이전 턴의 thinking signature가 전송**되고 서버가 복호화합니다
- 서버 쪽 context에서는 복호화된 전체 thinking이 토큰으로 카운트됩니다
- 기본 설정상 모든 thinking이 보존됩니다

즉, thinking은 사용자 눈에는 안 보이지만, **context에 실제로 쌓이고 매 턴 비용으로 집계**됩니다. 이게 thinking이 무서운 이유예요 — 보이지 않는데 돈은 나가는 거죠.

### 4.5 Main 세션 vs Subagent 구조적 차이

Main과 subagent를 분리해서 집계해봤습니다:

- **4-7 main**: 2,317 calls, think 621개 → **26.8%**, out/call 1,339
- **4-7 subagent**: 1,160 calls, think **0**개 → **0.0%**, out/call 279
- **4-6 main**: 1,918 calls, think 145개 → **7.56%**, out/call 468
- **4-6 subagent**: 3,168 calls, think **0**개 → **0.0%**, out/call 163

**핵심 발견: Subagent에서는 두 모델 모두 thinking이 완전히 차단됩니다 (0건).**

Claude Code는 이미 thinking을 비용 증가 요인으로 인지하고 있어서, 일반 subagent의 thinking을 명시적으로 비활성화합니다. 비용 절감 목적이라고 내부 주석에도 적혀 있습니다.

#### 이게 의미하는 것

- **Thinking 비용은 main 세션에서만 발생** — 4-7의 비용 폭증은 main 세션의 thinking 빈도에 집중되어 있습니다
- **Subagent는 안전지대** — 모델이 뭐든 thinking이 차단되어 출력이 간결합니다
- **4-7 main vs 4-6 main 비율**: 26.8% / 7.56% = **3.5배** (subagent 0을 포함한 전체 6.3배와 구분)
- **Out/call 격차도 subagent에서 줄어듦**: main 1,339/468 = 2.86배 → subagent 279/163 = 1.71배
- Subagent 비교(1.71배)가 순수 verbosity 차이의 하한선입니다. Tokenizer 보정하면 1.27~1.34배 → **4-7은 같은 작업에 본질적으로 27~34% 더 많은 토큰을 생성**합니다

**다만 주의할 점**: subagent에 thinking이 없다는 건 **복잡한 추론이 필요한 작업을 subagent에 맡기면 품질이 떨어진다**는 뜻이기도 합니다. 설계는 main에서 4-7의 thinking을 활용하고, 실행은 subagent로 — 이 분업이 최적입니다.

### 4.6 Per-turn 비용 실측

실제 돈으로 환산하면 이렇습니다:

- **Output per call (전체 평균)**: 4-7 985 tok vs 4-6 278 tok → 3.54배 (tokenizer 보정 후 2.77배)
- **Cache create per turn**: 4-7 $0.103 vs 4-6 $0.031 → **3.37배**
- **Cache read per turn**: 4-7 $0.405 vs 4-6 $0.432 → 0.94배 (거의 동일)
- **Total per turn**: 4-7 $0.587 vs 4-6 $0.497 → 1.18배

Cache read는 context 크기에 비례해서 모델과 무관합니다. 세션이 길어질수록 cache read 비중이 커지면서 모델 차이가 희석되긴 하지만, 그래도 매 턴 쌓이는 output 차이가 context를 빨리 키우는 구조라 결국 복리로 돌아옵니다.

---

## 5. 복합 효과 시뮬레이션

세 가지 효과(thinking 빈도, verbosity, tokenizer 팽창)가 동시에 작용하면 실제로 얼마나 차이가 나는지 시뮬레이션해봤습니다.

### 5.1 시나리오별 per-turn 비용 비율

100턴 대화 기준 누적 토큰 소비입니다. 같은 작업을 할 때 4-7이 4-6 대비 턴당 얼마나 더 비싼지를 나타냅니다.

- **영어/코드 위주 (tokenizer 팽창 1.28x)**: 4-7 턴당 비용 ×**1.43** → **턴당 43% 더 비쌈**; 평소 4시간 쓰던 분이 약 2시간 48분에 블록
- **한/영 혼합 (tokenizer 팽창 1.10x)**: ×1.23 (턴당 23% 비쌈; 4시간 쓰던 분이 약 3시간 15분에 블록)
- **순수 한글 (tokenizer 팽창 1.00x)**: ×1.12 (턴당 12% 비쌈; 4시간 쓰던 분이 약 3시간 34분에 블록)

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

### 6.1 정리하면

- **4-7이 4-6보다 비용이 많이 드는 건 사실입니다. 이유는 3가지가 동시에 터진 결과**:
  
  - Thinking 빈도가 **3.5배 높음** (main 기준: 7.56% → 26.8%)
  - 같은 답변이 **27~34% 더 장황** (tokenizer/thinking 보정 후)
  - 영어/코드에서 tokenizer가 **28~38% 팽창**

- **한글 대화는 영향이 작습니다** (tokenizer 팽창 ~1%)

- **Thinking은 보이지 않지만 실제로 context에 쌓이고 매 턴 비용으로 누적됩니다**

- **사용자가 제어할 수 있는 건 제한적입니다**:
  
  - `budget_tokens`로 thinking 길이 조절은 가능하지만, thinking 자체를 할지/말지는 모델이 판단
  - **Effort 설정을 바꿔도 thinking 빈도는 안 줄어듭니다** — 실측 결과 low(37.5%)가 오히려 가장 높고 xhigh(16.3%)가 가장 낮았습니다
  - Subagent 모델은 alias만 가능하고 버전 지정 불가

### 6.2 비용 절감 레버 (효과 순)

- **세션 길이 관리** (context 크기) — 가장 큰 영향
- **모델 선택** (4-6 사용) — 작업 유형에 따라 10~40% 절감
- **대화 언어** (한글) — tokenizer 팽창 회피
- **Thinking 빈도** — 모델에 종속, 직접 제어 불가

### 6.3 그러면 어떻게 해야 할까요?

#### 전략 A: 전체 4-6 사용 (대부분에게 권장)

- `/model claude-opus-4-6[1m]` 한 줄이면 됩니다
- 가장 쉽고 일관된 비용 절감 (20~40%)
- 95% 작업에서 품질 차이 체감 없습니다

#### 전략 B: 4-7은 설계에만, 실행은 Sonnet 서브태스크로 (고급)

4-7의 향상된 성능을 쓰고 싶다면, CC의 구조적 특성을 활용하세요 — **subagent는 thinking이 차단되고, main만 thinking이 유지됩니다**.

- **Main 4-7 (설계용)**: 아키텍처 설계, 복잡한 디버깅, 다단계 계획 수립
- **Subagent Sonnet (실행용)**: 명세 기반 구현, 여러 파일 일괄 수정, 코드 탐색, 단순 Q&A

설계는 main에서, 실행은 subagent에서 — 이 분업이 핵심입니다.

**피해야 할 실수**:

- ❌ 계획 자체를 subagent에 위임 → thinking 없어서 설계가 얕아집니다
- ❌ Main에서 단순 반복 작업 → 4-7의 thinking 비용 낭비
- ❌ Subagent에 `model: opus` 지정 → thinking은 어차피 차단이지만 토큰 단가가 비쌉니다

#### 공통 습관

- **세션 관리**: `/s-continue`로 초기 context 경량화, 긴 세션은 정기적으로 압축

---

## 7. 한계

이 분석에는 한계가 있을 수 있습니다:

- **Tokenizer 샘플이 작습니다**: 제어 실험에서 delta 값이 982 vs 1,258 수준이라 ±5% 노이즈가 있음
- **제 작업 패턴의 편향**: 두 프로젝트 모두 한 사람(저)의 작업 패턴입니다. 다른 분들의 데이터가 추가되면 더 정확해질 겁니다

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
super-token-saver: 4-7 main=1,589(28.7%) / sub=41     / 4-6 main=169(9.5%)  / sub=18
doooz:          4-7 main=728(22.7%)   / sub=1,119  / 4-6 main=1,749(7.4%) / sub=3,150
```

---

## 방법론: 데이터 수집 스크립트

이 리포트의 모든 수치는 재현 가능합니다. 아래 두 개의 Python 스크립트를 돌리면 동일한 결과를 얻을 수 있습니다. Python 3 + 표준 라이브러리만 사용합니다.

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
    "super-token-saver": HOME / ".claude/projects/{super-token-saver-project-hash}",
    "doooz":          HOME / ".claude/projects/{doooz-project-hash}",
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

---

## 마치며

이 리포트는 "왜 요즘 사용량이 빨리 바닥나지?"라는 단순한 의문에서 시작했습니다. 뜯어보니 tokenizer 변경, thinking 빈도 증가, 응답 장황화라는 세 가지가 동시에 작용하고 있었고, 그 결과가 42%라는 꽤 큰 숫자로 나왔습니다.

모델이 발전하면서 비용 구조가 바뀌는 건 자연스러운 일이지만, 사용자가 그 변화를 인지하지 못한 채 비용만 늘어나는 건 문제라고 생각합니다. 이 리포트가 그 격차를 메우는 데 도움이 되었으면 합니다.

데이터가 더 쌓이면 업데이트하겠습니다. 혹시 본인의 사용 데이터를 공유해주실 분이 있다면, [super-token-saver의 /report-limit](https://github.com/ww-w-ai/super-token-saver)을 통해 익명으로 기여하실 수 있습니다.
