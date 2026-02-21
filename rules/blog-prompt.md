# buildPrompt Rule

## Role

블로그 에이전트가 실제 작성에 사용할 `GenerationService.buildPrompt()`의 기본 지시 텍스트를 표준화한다.

## Input Parameters

- `title`: 세션 제목
- `tone`: 톤/문체
- `format`: 글 형식
- `items`: 수집된 소스 항목(`repo/notion` commit, notion)
- `userInstruction?`: 사용자 추가 지시사항
- `refinePostBody?`: refine 모드용 기존 초안

## Output Block Order

1. `[EXISTING DRAFT — REFINE MODE]` (refinePostBody 존재 시)
2. `[USER INSTRUCTION]` (userInstruction 존재 시)
3. 기본 프롬프트 본문
4. `[KEY POINTS INPUT]`
5. `[THEME INPUT]`
6. `[EVIDENCE INPUT]`

compact 모드일 때는 6의 자리에 `[COMPACT EVIDENCE INPUT]`을 사용한다.

## Base prompt body

```text
블로그 제목: {title}
톤/문체 요청: {tone}
형식 요청: {format}
목표: 엔지니어링 회고형 테크 블로그를 작성합니다.
규칙: 반드시 입력된 소스를 기반으로 글을 작성하고, 소스에 없는 내용을 추가하지 않습니다.
제목은 반드시 주어진 제목만 사용할 필요는 없고, 내용에 어울리는 제목으로 수정되어도 괜찮습니다.
각 섹션은 내용에 어울리는 부제를 붙이고, 블로그 글 이므로 지나친 요약대신 독자가 이탈하지 않고 읽을 수 있도록 내용 전개가 필요합니다.
[WRITING GUIDELINES]
- 내부 문서와 커밋을 기반으로 작성하고 있으므로, 출처는 절대로 명시하지 마세요.
- chronology를 유지하되, 독자가 이해하기 쉽게 문제-시도-결과-학습의 흐름으로 재구성합니다.
- 단, 각 사건을 문제,시도,결과,학습의 단순 요약으로 끝내지 말고, 그 사건이 어떻게 해결되었는지 풀어서 설명해야 합니다.
  예를 들면 '사건 A에 어떤 문제가 발생 했을때, 우리는 우선 B를 시도했고, 그 결과 C가 발생했다/해결되었습니다. 이 과정을 통해 우리는 D를 학습하게 되었습니다.' 라는 흐름을 커밋 내용을 기반으로 가능한 길게 풀어서 설명해줘야 합니다.
- 전체 내용을 모두 활용하지 말고, 사용자가 요구한 instruction을 기반으로 알맞은 내용을 선택적으로 포함할 수 있도록 작성하세요.
- commit/notion 원문을 복붙하지 말고 의미를 통합 요약합니다.
- 출력 형식은 아래 순서와 내용을 따르고, 반드시 Markdown 문법을 따라야 합니다.
- 1) Executive Summary
- 2) Key Events Review
- 3) Thematic Insights
- 4) Decisions & Trade-offs
- 5) Conclusion
- 우리의 내부 문서가 아니라 블로그이므로, 블로그의 톤과 문체를 유지해야 합니다. 주 대상 독자는 개발자이지만, 비개발자도 흥미있게 읽을 수 있도록 글이 너무 딱딱하거나, 지나치게 기술 설명 중심으로 흘러가지 않도록 주의해야 합니다.
- 마지막 Conclusion은 해낸것과 얻은것, 그리고 미숙했던 점을 정리하며 글을 자연스럽게 마무리합니다.
- 잘 모르는 내용이 있거나 내용 보완이 필요한 경우 웹 검색을 시도 해서 추가 정보를 찾아도 됩니다. 단, medium, reddit 등 개인 블로그나 커뮤니티의 정보는 탐색하지 말고 관련 기술의 공식 문서 또는 github README 등을 참고하세요.
- 블로그를 작성하면서 사용자에게 입력받은 데이터 소스가 실제 요구사항을 달성하는데 부족하다면, 사용자에게 부족한 부분을 보완할 수 있도록 질문해야 합니다. 스스로 내용을 지어내어 덧붙이지 마세요.
- 당신이 파일을 생성할 필요는 전혀 없습니다. 당신이 작성한 글은 사용자가 stdout을 통해 전달받아 웹 에디터로 확인하고 직접 편집할 것이므로, 별도로 파일을 생성하지 마세요.
```

## Refine mode

- refine 모드에서는 다음 목표 문구로 바뀐다.

```text
목표: 제공된 엔지니어링 회고형 테크 블로그 초안을 소스 데이터와 사용자 지시사항을 반영하여 개선합니다.
```

- refine 모드 프리앰블은 기존 초안을 그대로 포함하고, 임의의 새 문장 추가를 금지한다.

```text
[EXISTING DRAFT — REFINE MODE]
아래는 이미 작성된 블로그 초안입니다.
이 초안을 기반으로 개선 및 수정 작업을 수행하세요.
초안에 없는 내용을 임의로 추가하지 말고, 아래 소스 데이터와 사용자 지시사항을 반영하여 다듬어 주세요.
```

## Compact mode

- 길이 임계값: `PROMPT_MAX_CHARS` (기본값 `32000`)
- full prompt 길이가 임계값을 넘으면 compact 모드로 전환한다.
- compact 본문은 timeline/theme/evidence 대신 증거 라인 목록을 축약해 `[COMPACT EVIDENCE INPUT]`으로 교체한다.
- compact 모드에서도 refine/user instruction 블록은 유지한다.

```text
[COMPACT EVIDENCE INPUT]
입력 데이터가 길어 압축 모드로 전환되었습니다.
입력 데이터가 다소 압축된 점을 감안하여 핵심 내용을 놓치지 않도록 주의하세요.
```
