# Fable 5.1이 Opus 5보다 24~38% 싸다

**조사 기간**: 2026-08-03 ~ 2026-09-02 (31일)
**환경**: Claude Code, macOS, Max 20x 플랜, 한국어/영어 혼용 대화
**표본 규모**: 2,802개 세션(메인 1,331개 + 서브에이전트 1,451개), 148.6억 토큰, 청구액 $7,646
**방법**: `/usage-view`(super-token-saver v3.3.0), 서브에이전트 재생 데이터 중복 제거 적용

> English: [fable-5-1-vs-opus-5-cost-analysis.md](./fable-5-1-vs-opus-5-cost-analysis.md)

---

## 0. 핵심 요약

### 같은 품질이면 24~38% 쌉니다. 같은 토큰이면 11% 비쌉니다. 둘 다 맞는 말입니다.

Fable 5.1은 Anthropic이 공개한 **모든 벤치마크**에서 Opus 5보다 점수가 높습니다(§1). 그래서 비용을
비교하면서 품질을 양보할 필요가 없습니다.

모델이 더 좋으니 같은 점수를 **더 낮은 effort 설정**에서 냅니다. effort가 낮으면 턴마다 생각하는
양이 줄고, 그만큼 토큰도 덜 씁니다.

같은 점수를 기준으로 놓으면 Anthropic의 CursorBench effort 곡선에서 Fable 5.1이 Opus 5보다
**24~38% 쌉니다.** 이 값은 각 모델의 가격표로 계산한 작업당 달러 금액이라, Fable 5.1의 비싼 입력·출력
단가가 이미 들어가 있는 최종 숫자입니다.

그런데 이 벤치마크는 태스크 하나를 짧게 돌린 결과입니다. 장시간 자율 실행에서는 캐시 읽기가
**청구액에서 가장 큰 항목**이 되고, Fable 5.1의 캐시 읽기 단가는 Opus 5의 절반입니다. 실제 31일 사용량의
토큰 구성으로 계산하면 Fable 5에서 Fable 5.1로 넘어갈 때 44.5%가 줄어드는데, 이는 Anthropic이 "매우
에이전틱한 작업에서 최대 약 45%"라고 밝힌 수치와 맞습니다.

가장 보수적인 계산은 토큰 수와 effort를 그대로 두고 가격표만 바꾸는 것입니다. 그렇게 해도 Fable 5.1은
+100%가 아니라 **1.11배**, 즉 **+10.9%**입니다. 갈림선은 캐시 읽기 비중 66.7%이고, 이 +11%는 effort를
낮춰 얻는 절감을 0으로 잡은 값입니다.

그 11%가 더 나쁜 모델에 내는 값도 아닙니다. 두 질문의 답이 다른 이유는 하나는 품질을, 다른 하나는
토큰 수를 고정했기 때문입니다.

| 질문 | 답 | 근거 |
|---|---|---|
| **"같은 품질을 원합니다. 비용은 얼마입니까?"** | Fable 5.1이 **24~38% 쌉니다** | Anthropic의 CursorBench effort 곡선(§1) |
| "모델만 바꾸고 나머지는 그대로 둡니다" | Fable 5.1이 **11% 비쌉니다** | 31일간의 실제 청구 데이터(§3~§4) |

---

## 1. 모델이 더 좋아서 effort가 덜 듭니다

Anthropic이 공개한 벤치마크 표에서는 **실린 모든 항목**에서 Fable 5.1이 Opus 5를 앞섭니다.

| 벤치마크 | Fable 5.1 | Opus 5 |
|---|---|---|
| Terminal-Bench-Science 0.1 | **52.6%** | 29.0% |
| Terminal-Bench 4.0 | **55.8%** | 52.3% |
| GDPval-AA v2 | **1853** | 1824 |
| OSWorld 2.0 (strict) | **41.7%** | 39.6% |
| Humanity's Last Exam (도구 없음) | **60.9%** | 56.6% |
| Humanity's Last Exam (도구 사용) | **65.0%** | 63.6% |
| AutomationBench | **31.4%** | 26.9% |
| CursorBench 3.2.0 | **73.4%** | 70.0% |

*Terminal-Bench-Science 0.1은 모델당 표준오차 ±3.5~4.5pt입니다. 출처: [anthropic.com/claude-fable-and-mythos-5-1](https://www.anthropic.com/claude-fable-and-mythos-5-1)*

장시간 실행의 비용을 좌우하는 것은 effort 축입니다. Claude Code는 Fable 5.1을 High로 기본 설정합니다.

> "when set to Low or Medium effort, Fable 5.1 achieves results similar to or better than Fable 5's
> at a much lower cost. (Note that Fable 5.1 defaults to High effort in Claude Code, and to Medium
> in Claude Cowork and on Claude.ai.)"
>
> (Low 또는 Medium effort에서 Fable 5.1은 훨씬 낮은 비용으로 Fable 5와 비슷하거나 더 나은 결과를
> 냅니다. Fable 5.1은 Claude Code에서 High, Claude Cowork과 Claude.ai에서 Medium이 기본값입니다.)

이 effort 비교의 상대는 **Opus 5가 아니라 Fable 5**입니다. Anthropic이 effort 수준별(low / med / high /
xhigh / max) 정확도 대 비용 곡선을 공개한 것은 Fable 5.1 대 Fable 5뿐이고, effort 수준별로 Fable 5.1과
Opus 5를 직접 비교한 수치는 공개하지 않았습니다.

### Opus 5가 출시 당시 내세운 논리

Opus 5 발표문([2026-07-24](https://www.anthropic.com/news/claude-opus-5))은 이 모델을 Fable 5 대비
가격 경쟁력으로 소개했습니다.

> "It's a thoughtful and proactive model that comes close to the frontier intelligence of Claude
> Fable 5 **at half the price**."
>
> (Claude Fable 5의 프런티어 지능에 근접하면서 **가격은 절반**입니다.)

> "On CursorBench 3.2, at max effort, the model performs within 0.5% of Fable 5's peak score, but
> **at half the cost per task**; it also achieves greater performance at a given cost than all other
> models on **high, xhigh, and max effort**."
>
> (CursorBench 3.2에서 max effort일 때 Fable 5 최고점과 0.5% 이내로 붙으면서 **작업당 비용은
> 절반**입니다. high·xhigh·max effort에서는 같은 비용 대비 다른 모든 모델보다 성능이 높습니다.)

두 발표문의 CursorBench 수치는 서로 정확히 맞물립니다.

| CursorBench 3.2 | 점수 |
|---|---|
| Fable 5 (최고점) | 70.5% |
| Opus 5 | 70.0% — *"Fable 5 최고점과 0.5% 이내"* |
| **Fable 5.1** | **73.4%** |

정리하면 Opus 5가 내세운 것은 **Fable에 가까운 품질을 절반 값에**였습니다. 지금은 두 축이 다
움직였습니다. Fable 5.1은 더 이상 근접 수준이 아니라 공개된 모든 벤치마크에서 앞서고, "절반 값"의
기준이던 Fable 5의 캐시 읽기 단가는 100만 토큰당 $1.00에서 $0.25가 됐습니다.

Anthropic은 새 캐시 읽기 가격으로 이 effort별 정확도 대 비용 곡선을 다시 내지 않았습니다. 이 리포트는
그 재가격이 실제 작업의 비용 축을 어떻게 바꾸는지 실측한 답입니다. **절반이 아니라 1.11배입니다.**

### Fable 5.1과 Opus 5를 한 축에서 비교하기

어느 발표문에도 Fable 5.1과 Opus 5를 직접 비교한 그래프는 없습니다. 다만 두 발표문 모두 같은 축에서
**Fable 5**의 **CursorBench 3.2.0** 결과를 보여줍니다. 축은 점수와 작업당 비용(USD, 로그 스케일)이고
effort 단계는 low→max입니다. 두 차트의 Fable 5 곡선이 같으므로 이를 연결 기준으로 쓸 수 있습니다.

두 차트를 겹친 결과입니다. 수치는 공개 차트에서 읽었고 오차 범위는 점수 ±0.2pt, 비용 ±5%입니다.

| Effort | Opus 5 | Fable 5.1 | Fable 5 *(연결 기준)* |
|---|---|---|---|
| low | $2.45 / 62.8 | $2.9 / **66.2** | $4.5 / 62.1 |
| med | $3.2 / 64.2 | $3.5 / **68.1** | $6.9 / 65.1 |
| high | $4.0 / 66.7 | $4.8 / **69.4** | $8.7 / 66.5 |
| **xhigh** | $7.3 / 69.3 | **$7.2 / 72.7** | $11.8 / 68.4 |
| max | $8.5 / 70.1 | $9.5 / **73.4** | $17.5 / 70.5 |

모든 effort 단계에서 Fable 5.1이 Opus 5보다 점수가 높습니다. 비용 차이도 작아서, 같은 effort가 아니라
같은 점수로 비교하면 순서가 뒤집힙니다.

- **xhigh에서는 비용이 같고 점수만 다릅니다.** $7.2와 $7.3으로 차이가 $0.10인데 점수는 **+3.4pt**입니다.
  이 단계에서는 가격을 이유로 Opus 5를 고르기 어렵습니다.
- **Opus 5 high의 66.7점을 Fable 5.1은 low의 66.2점으로 따라잡습니다. 비용은 약 27% 낮습니다.**
- **Opus 5의 최고점은 max에서 70.1점($8.5)입니다.** Fable 5.1은 high와 xhigh 사이, 약 $5.3에서 이 점수를
  넘습니다. **Opus 5 최고 성능보다 약 38% 쌉니다.**
- **73.4점은 Opus 5가 어떤 effort 설정으로도 내지 못합니다.**

Fable 5에서 Fable 5.1로 곡선이 얼마나 움직였는지도 보십시오. low는 $4.5 → $2.9(−36%), max는 $17.5 →
$9.5(−46%)입니다. 새 캐시 읽기 가격은 이 차트에 이미 반영돼 있고, 그 −46%는 Anthropic이 "매우 에이전틱한
작업에서 최대 약 45%"라고 말한 그 숫자입니다. 이 리포트가 청구 데이터에서 독립적으로 계산한 값과도
같습니다(§3).

#### 같은 점수를 기준으로 계산한 비용

품질 목표를 정해 놓고 각 모델이 그 점수를 내는 데 얼마를 받는지 비교한 것입니다. Fable 5.1의 비용은
공개된 effort 지점 사이를 선형 보간한 값입니다. (기하 보간으로 바꾸면 0.3~1.5% 차이가 나는데, 차트 판독
오차 ±5%보다 작습니다.)

| 목표 점수 | Opus 5 | Fable 5.1 | 절감 |
|---|---|---|---|
| 66.7 | $4.00 (high) | ~$3.06 | **−24%** |
| 69.3 | $7.30 (xhigh) | ~$4.70 | **−36%** |
| 70.1 *(Opus 5 최고점)* | $8.50 (max) | ~$5.31 | **−38%** |
| 70.1 초과 | 도달 불가 | $5.31 → $9.50 | — |

**품질 기준을 높일수록 격차가 벌어지고**, 70.1 위로는 비교 자체가 없어집니다.

이 달러 수치는 Anthropic이 각 모델의 가격표로 계산한 작업당 비용입니다. Fable 5.1의 2배 입력·출력
단가와 $0.25 캐시 읽기가 이미 안에 들어 있습니다. 여기에 §4의 +11%를 다시 얹으면 안 됩니다.

**이 연결은 벤치마크 하나에서만 성립합니다.** CursorBench 3.2.0은 양쪽 페이지에 Fable 5가 완전한 effort
단계로 실린 유일한 차트입니다. Fable 5.1 페이지의 Terminal-Bench 4.0은 Mythos 5.1 / Fable 5.1 / Mythos 5를
그려서 Opus 5 페이지와 공통 모델이 없고, 그래서 이을 수 없습니다. Frontier-Bench v0.1은 Opus 5 페이지에만
있는데, 거기서는 **Opus 5가 모든 effort 단계에서 Fable 5를 크게 이겼습니다**(시도당 비용은 더 낮으면서
약 10pt 높음). Fable 5.1은 이 벤치마크로 공개된 적이 없어서 그 격차는 여기서 다시 평가할 수 없습니다.

얼리액세스 파트너 한 곳이 이 리포트의 결론을 그대로 말합니다.

> "We're moving our Opus 5 traffic in Devin to Claude Fable 5.1 on launch day. It matched or edged
> out Fable 5 in our testing at a lower cost per task, and with the new cache read pricing a
> Fable-class model is finally economical for the workloads we'd kept on Opus, starting with code
> review."
> — Walden Yan, Co-founder and CPO, Cognition
>
> (출시일에 Devin의 Opus 5 트래픽을 Fable 5.1로 옮깁니다. 테스트에서 작업당 비용은 더 낮으면서
> Fable 5와 같거나 조금 앞섰고, 새 캐시 읽기 가격 덕분에 Fable급 모델이 우리가 Opus에 남겨 뒀던 작업에
> 드디어 수지가 맞습니다. 코드 리뷰부터 시작합니다.)

**Anthropic이 공개하지 않은 것이 Opus 5와의 가격 비교입니다.** 발표문의 절감폭, 즉 "전형적인 워크로드에서
Fable 5보다 약 25% 저렴"과 매우 에이전틱한 작업의 "최대 약 45%"는 전부 Fable 5.1 **대 Fable 5**입니다.
이 리포트는 다른 축을 잽니다. 실제 31일치 청구서로 잰 Fable 5.1 대 Opus 5입니다.

---

## 2. 더 빠르고 읽기 쉽습니다

effort를 낮추면 그 자체로 빨라집니다. 턴마다 생각하는 양이 줄기 때문입니다. 토큰을 줄이는 effort 조정이
실행 시간도 같이 줄입니다.

얼리액세스 파트너들은 같은 effort에서도 Fable 5.1이 Opus 5보다 빠르고 토큰을 덜 쓰며, 긴 작업에서도
출력이 읽기 쉽다고 보고했습니다.

> "It's friendly Fable. Fable-level intelligence, Opus-level price, Sonnet-speed. In our tests it was about twice as fast as Opus 5 and used half as many tokens, so for anyone used to using Opus as their daily driver it's an obvious upgrade."
> — Every / Dan Shipper, CEO
>
> (친근한 Fable입니다. Fable급 지능, Opus급 가격, Sonnet급 속도. 우리 테스트에서는 Opus 5보다 약 2배
> 빠르고 토큰은 절반을 썼습니다. Opus를 매일 쓰던 사람이라면 당연한 업그레이드입니다.)

> "On our hardest browser-agent benchmark, Claude Fable 5.1 completed 82% of tasks in about 10 minutes each, against 74% for Opus 5 and 57% for Fable 5, while using fewer tokens than either."
> — Browserbase / Miguel Gonzalez, Technical Lead
>
> (가장 어려운 브라우저 에이전트 벤치마크에서 Claude Fable 5.1은 태스크당 약 10분에 82%를 완료했습니다.
> Opus 5는 74%, Fable 5는 57%였고, 토큰은 둘보다 적게 썼습니다.)

> "While prior models became hard to follow the longer they worked, Fable 5.1 remains readable over long, multi-step tasks."
> — Jane Street Capital / Craig Falls, Head of Quantitative Research
>
> (이전 모델은 오래 일할수록 따라가기 어려워졌는데, Fable 5.1은 길고 여러 단계로 된 작업에서도 읽을 만합니다.)

이 셋은 파트너가 보고한 관찰이지 이 리포트가 직접 잰 값이 아닙니다. 출처는 모두
[Anthropic 고객 인용](https://www.anthropic.com/claude-fable-and-mythos-5-1)입니다.

---

## 3. 세션이 길수록 격차가 벌어집니다: 캐시 읽기

위 벤치마크는 태스크 하나를 짧게 돌린 것이라 캐시 읽기 비중이 작습니다. 실제 에이전트 작업은 긴
세션이고, 거기서는 캐시 읽기가 가장 큰 항목이 됩니다.

### 돈이 실제로 어디로 가나

31일 전체 사용량을 Opus 5 단가로 다시 계산한 것입니다.

| 토큰 종류 | 토큰 | 비용 | 비중 |
|---|---|---|---|
| **캐시 읽기** | 142.8억 | **$7,140** | **59.4%** |
| 캐시 쓰기 (5분) | 4.03억 | $2,519 | 21.0% |
| 캐시 쓰기 (1시간) | 1.32억 | $1,320 | 11.0% |
| 출력 | 4,140만 | $1,035 | 8.6% |
| 입력 | 27.4만 | $1.37 | 0.0% |
| **합계** | 148.6억 | **$12,015** | 100% |

캐시 읽기가 전체 토큰의 96.1%, 전체 비용의 59.4%입니다. 새로 넣는 입력은 **0.0%**입니다.

코딩 에이전트의 비용 구조가 원래 이렇습니다. 매 턴 대화 전체를 다시 보내고, 캐시가 그 비용이 걷잡을 수
없이 커지는 것을 막습니다. 실행이 길고 자율적일수록 청구액은 이 한 항목으로 쏠립니다.

그리고 그 한 항목이 Fable 5.1이 유일하게 싸게 만드는 항목입니다.

### 항목별 배수

| 토큰 종류 | Opus 5 | Fable 5.1 | 배수 |
|---|---|---|---|
| 입력 | $5.00 | $10.00 | 2.0× |
| 출력 | $25.00 | $50.00 | 2.0× |
| 캐시 쓰기 (5분) | $6.25 | $12.50 | 2.0× |
| 캐시 쓰기 (1시간) | $10.00 | $20.00 | 2.0× |
| **캐시 읽기** | **$0.50** | **$0.25** | **0.5×** |

*100만 토큰당 USD. 출처: [platform.claude.com/docs/ko/about-claude/pricing](https://platform.claude.com/docs/ko/about-claude/pricing)*

가격표상 Fable 5.1은 Opus 5의 2배입니다. 입력, 출력, 캐시 쓰기가 전부 정확히 2배입니다. 다른 모델은
모두 캐시 읽기를 입력 단가의 0.1배로 매기는데, Fable 5.1은 0.025배입니다.

같은 31일에 적용하면 이렇습니다.

| 토큰 종류 | Opus 5 | Fable 5.1 | 차이 |
|---|---|---|---|
| 캐시 읽기 | $7,140 | $3,570 | **−$3,570** |
| 캐시 쓰기 (5분) | $2,519 | $5,038 | +$2,519 |
| 캐시 쓰기 (1시간) | $1,320 | $2,640 | +$1,320 |
| 출력 | $1,035 | $2,070 | +$1,035 |
| 입력 | $1.37 | $2.74 | +$1.37 |
| **합계** | **$12,015** | **$13,321** | **+$1,305** |

캐시 읽기 한 항목이 $3,570을 돌려주고, 나머지 네 항목이 $4,875를 가져갑니다. 결과는 $12,015 청구액에
+$1,305입니다.

Fable 5는 캐시 읽기($1.00)까지 포함해 모든 항목이 정확히 Opus 5의 2배였습니다. Fable 5.1은 그중 캐시
읽기만 $0.25로 바꿨습니다. 따라서 이렇게 됩니다.

```
Fable 5.1 비용 = (1 − 0.75 × 캐시 읽기 비중) × Fable 5 비용
```

실측 비중 59.4%를 넣으면 0.555, 즉 44.5% 절감입니다. Anthropic이 매우 에이전틱한 작업에 대해 "최대 약
45%"라고 한 그 숫자를, 독립적인 청구 데이터에서 다시 얻은 것입니다.

> "Fable 5.1 will cost an estimated 25% less than Fable 5 for typical workloads, wherever usage is
> billed by token. This is because we're reducing our pricing on cache reads (where the model reads
> inputs that have already been processed and stored). For highly agentic work, the savings will
> often be much larger—up to approximately 45%."
>
> (토큰 단위로 과금되는 곳이라면 Fable 5.1은 전형적인 워크로드에서 Fable 5보다 약 25% 저렴할 것으로
> 추정합니다. 캐시 읽기, 즉 이미 처리되어 저장된 입력을 모델이 읽는 부분의 가격을 내렸기 때문입니다.
> 매우 에이전틱한 작업에서는 절감폭이 훨씬 커서 최대 약 45%에 이르는 경우가 많을 것입니다.)

방향은 확실합니다. 세션이 길어지면 캐시 읽기 비중이 올라가고, 그러면 Fable 5.1이 상대적으로 더 싸집니다.
벤치마크 수치를 넘어서는 크기까지는 여기서 재지 않았습니다.

---

## 4. 보수적인 하한선: 같은 토큰이면 +11%

### 같은 148.6억 토큰을 두 가격표에 넣으면

| | Opus 5 | Fable 5.1 | 차이 |
|---|---|---|---|
| 같은 토큰, 같은 작업 | **$12,015** | **$13,321** | **+10.9%** |
| "가격이 2배"라는 가정에 따른 예상 | — | $24,031 | +100% |

**단순 추정은 비용을 $10,710 과대평가합니다.** Fable 5.1은 2배가 아니라 1.11배입니다. 이 에이전트
워크로드에서 실측값은 1.1배에 가깝습니다.

장시간 자율 실행에서는 이것이 비용 비교를 바꿉니다. 2배와 11%는 예산에 미치는 영향이 전혀 다릅니다.
11%도 무시할 금액은 아니지만, 모델이 재실행을 얼마나 줄여 주는지와 함께 놓고 봐야 합니다. 이 +11%는
보수적인 하한선이지 예상치가 아닙니다.

### 갈림선은 숫자 하나입니다: 66.7%

캐시 읽기를 뺀 모든 항목이 정확히 2배이므로 조건이 식 하나로 정리됩니다.

Fable 5.1이 더 싸려면 다음을 만족해야 합니다.

```
0.25·R  >  5·I + 6.25·W5m + 10·W1h + 25·O
```

Opus 5의 캐시 읽기 비용이 캐시 읽기를 뺀 나머지 비용의 2배를 넘어야 한다는 뜻입니다. 쉽게 말하면
이렇습니다.

> **Opus 5 청구액에서 캐시 읽기가 3분의 2(66.7%)를 넘으면 Fable 5.1이 더 쌉니다.**

토큰 구성이 어떻든 성립합니다. 근사치가 아니라 정확한 값입니다.

**실측은 59.4%입니다.** 선에 가깝지만 비싼 쪽에 있습니다.

넘어가려면 다른 사용량이 같을 때 캐시 읽기가 약 195억 토큰까지 늘어야 합니다. 실측 142.8억의
1.37배입니다. 드문 일이 아닙니다. 세션이 길어지고 캐시 재사용이 촘촘해지면 자연히 그렇게 되고, 자율
작업은 원래 그 방향으로 갑니다.

### 선에 가까워지게 하는 것과 멀어지게 하는 것

**Fable 5.1이 싸지는 쪽:**

- 캐시 재사용이 많은 긴 단일 세션
- 같은 맥락을 계속 다시 읽는 여러 시간짜리 자율 실행
- 읽기 위주 작업: 코드베이스 파악, 감사, 대형 저장소 리팩토링
- 많이 생각하고 적게 쓰는 작업 전반

**비싸지는 쪽:**

- 짧은 단발 세션 (캐시가 데워질 틈이 없음)
- 생성 위주 작업: 출력 항목이 2배가 되는데 상쇄할 것이 없음
- **1시간 캐시 쓰기.** 100만 토큰당 $10 → $20이고 청구액의 11.0%였는데, 이것이 2배가 됩니다.
  66.7%를 넘는 데 가장 큰 걸림돌입니다.

같은 데이터에서 나온 대비 하나를 들겠습니다. 짧고 산발적으로 돌린 세션들은 캐시 읽기 비중이 25.9%에
그쳐 Fable 5.1이었다면 **+61%**였습니다. 긴 세션들은 59.9%로 **+10.1%**였습니다. 같은 가격표, 같은 계정,
같은 달입니다. 불이익이 6배 차이 나는데, 전부 세션 모양이 만든 차이입니다.

---

## 5. 방법, 그리고 짚고 갈 함정 하나

데이터는 super-token-saver v3.3.0의 `/usage-view`에서 나왔습니다. Claude Code 트랜스크립트를 직접 읽어
토큰 종류별 비용을 공개 가격표로 계산합니다.

**함정: 서브에이전트 이중 계산.** Claude Code의 `runForkedAgent`는 부모 세션의 히스토리를 서브에이전트
사이드체인에 재생합니다. 재생된 행은 원래 `requestId`를 그대로 갖고 있어서 그냥 더하면 두 번
세어집니다. super-token-saver는 부모 타임라인에 이미 있는 `requestId`를 가진 서브에이전트 행을 버립니다.

이 보정이 결과를 바꿉니다. 재생된 행은 **거의 전부 캐시 읽기**라서, 중복 제거를 건너뛰면 이 분석이 걸려
있는 바로 그 항목이 부풀려집니다.

| | 캐시 읽기 비중 | 판정 |
|---|---|---|
| 중복 제거 전 | 70.3% | Fable 5.1이 **더 쌈** |
| 중복 제거 후 | 59.4% | Fable 5.1이 **10.9% 더 비쌈** |

보정하지 않은 숫자는 66.7% 갈림선을 넘겨 결론을 뒤집습니다. 직접 자기 데이터로 이 분석을 돌린다면
중복 제거를 먼저 하십시오. 안 그러면 확신에 찬 채로 틀린 답에 도착합니다.

**한계.** 계정 하나, 31일, 워크로드 성격 하나입니다. 긴 세션 위주의 자율 멀티에이전트 스프린트입니다.
갈림선 위치는 사람마다 다릅니다. 66.7%라는 규칙은 다르지 않습니다.

---

## 6. 그래서 무엇을 하면 되나

1. **Fable 5.1을 2배로 계산하지 마십시오.** Anthropic 자체 차트에서 같은 품질 기준으로 24~38% 쌉니다.
2. **Opus 5를 쓰던 설정에서 effort를 한두 단계 낮추십시오.** 절감은 거기서 나옵니다.
3. **세션이 길다면 벤치마크 수치보다 더 좋을 것으로 보고, `/usage-view`로 자기 캐시 읽기 비중을
   재십시오.** 66.7%를 넘으면 토큰이 같아도 Fable 5.1이 더 쌉니다.
4. **최악의 경우, 즉 토큰도 effort도 그대로일 때가 +11%입니다.** 예산은 2배가 아니라 여기에 맞추십시오.

가격표는 2배라고 합니다. 실측 청구서는 1.11배라고 합니다. 이 워크로드에서 기준이 되는 것은 실측
청구서입니다.

---

*super-token-saver `/usage-view`로 생성: [github.com/ww-w-ai/cc-token-saver](https://github.com/ww-w-ai/cc-token-saver)*
