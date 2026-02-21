# AGENTS

This document defines how AI agents should work consistently for both **code work** and **blog-writing work** in this repository.

## 1. Global Rules (All Agents)

- Prefer the project structure baseline: `apps/web`, `apps/api`, `packages/shared`, and avoid isolating changes to a single file when a domain-level split is required.
- Preserve behavior by default: keep API endpoints, SSE contract (`type/status/chunk/complete/error`), and DB schema/storage behavior unchanged unless explicitly required.
- Type safety is mandatory: avoid `as any`, `@ts-ignore`, `@ts-expect-error`, and `@ts-nocheck`.
- Verify by default: run `npm run typecheck -w apps/web`, `npm run typecheck -w apps/api`, `npm run build -w apps/web`, `npm run build -w apps/api`, and impact-based tests where applicable.
- Favor reusability: move duplicated logic into shared types/utilities (`packages/shared`, `apps/web/lib`, `apps/web/features`).
- Commit discipline: use single-purpose commits and avoid mixing unrelated changes.
- Documentation first: when adding new rules/skills/scope, update `AGENTS.md` immediately.

## 2. Mandatory Handoff Workflow (Input Analysis -> Writing -> Review)

All work should follow this default sequence.

1. **Input Analysis Agent**: structure user intent, context, constraints.
2. **Blog Writing Agent**: produce content based on the structured input.
3. **Review Agent**: validate correctness, format, scope, and risks.

When handing off, include:

- `scope`: what changes were requested/produced
- `assumptions`: unresolved points and assumptions
- `risks`: regression/compatibility risks
- `next_step`: actions required by the next agent

## 3. Input Analysis Agent

### Role
Interpret request context into explicit implementation requirements.

### Rules
- Classify into scope, constraints, and success criteria.
- Distinguish refactor vs new feature, and whether policy docs need updates.
- Check dependencies across existing files (especially `apps/web/features/workspace/*`, `apps/api/src/...`) before coding.
- Flag SSE/API/state-flow scope explicitly.

## 4. Code Agent

### Role
Modify code and stabilize behavior.

### Rules
- Primary targets: `apps/web`, `apps/api`, `packages/shared`, and root scripts.
- Align new code with existing boundaries (service/controller, shared types, API client, feature components).
- Split by feature domain (Menu, Source, Session, Post, Generation) and keep UI architecture in `apps/web/features/workspace/*`.
- Replace temporary or legacy patterns with cleaner implementations.
- For API or route changes, check `apps/api/src/app.module.ts` and service wiring first.

### Skills
- **Backend Navigation**: trace dependencies between controllers and services (`sessions`, `sources`, `generation`, `posts`).
- **Frontend Refactoring**: separate orchestrator logic from presentation components.
- **API Contract Hygiene**: verify payload/response contracts through `packages/shared/src/index.ts`.
- **Streaming Safety**: keep `GenerationController.generateStream` SSE contract intact.
- **Static Safety Checks**: use typecheck/build outcomes as regression gates.

### Working Context Map
- Key web entry: `apps/web/app/page.tsx`
- Key workspace modules: `apps/web/features/workspace/workspace-ui.tsx`, `apps/web/features/workspace/use-workspace-controller.ts`, `apps/web/features/workspace/types.ts`, `apps/web/features/workspace/constants.ts`, `apps/web/features/workspace/utils.ts`
- Key API modules: `apps/api/src/sessions/sessions.controller.ts`, `apps/api/src/sessions/posts.controller.ts`, `apps/api/src/sources/sources.controller.ts`, `apps/api/src/generation/generation.controller.ts`, `apps/api/src/sessions/sessions.service.ts`
- Shared types: `packages/shared/src/index.ts`

## 5. Blog Agent

### Role
Create and refine blog draft content.

### Rules
- Use `buildPrompt` as the canonical source of section and constraint mapping.
- Follow requested `tone` and `format` first.
- If `refinePostBody` exists, preserve continuity of the existing draft.
- Always output sections in this order:
  1. `Executive Summary`
  2. `Timeline Review`
  3. `Thematic Insights`
  4. `Decisions & Trade-offs`
  5. `Next Iteration Plan`
- Do not invent facts beyond provided sources; prioritize `userInstruction`.
- Keep writing accessible for non-specialists while targeting developers.

## 6. Review Agent

### Role
Validate delivered outputs for correctness, quality, and contract safety.

### Rules
- Include the flow evidence: input analysis → writing → review.
- Clearly separate behavior changes vs contract/schema changes.
- Document concrete risk paths (file entry point → impact).

## 7. buildPrompt Reference (for Blog Agent)

- Implementation: `apps/api/src/generation/generation.service.ts`
- Method: `private buildPrompt(title, tone, format, items, userInstruction?, refinePostBody?): string`
- Inputs: `title`, `tone`, `format`, `items`, `userInstruction?`, `refinePostBody?`
- Composition blocks:
  - `[EXISTING DRAFT — REFINE MODE]` (optional)
  - `[USER INSTRUCTION]` (optional)
  - base prompt rules
  - `[TIMELINE INPUT]`
  - `[THEME INPUT]`
  - `[EVIDENCE INPUT]`
- Guardrail: `PROMPT_MAX_CHARS` default `32000`; if exceeded, fallback to compact evidence mode.

## 8. Code Review Template

```text
Scope:
- Feature scope:
- Affected files:

Checks:
- [ ] Requirement alignment (what/why is changed)
- [ ] Type-safety compliance (`as any`/`@ts-*` absent)
- [ ] API + SSE contract unchanged or explicit justification/impact logged
- [ ] Core state flow preserved (`selectedSessionId`, `selectedPostId`, `generatedPost`, `isGenerating`)
- [ ] Shared type and layer boundaries respected (`packages/shared`, controller/service/component separation)
- [ ] Validation evidence captured (typecheck/build/test)

Findings:
- Risks:
- Improvement points:
- Approval:
```

## 9. Blog Review Template

```text
Scope:
- Post / session:
- `tone`/`format`:
- refine mode: [ ]ON [ ]OFF

Checklist:
- [ ] Section order `Executive Summary` -> `Next Iteration Plan`
- [ ] Source-backed evidence in `Timeline Review` and `Thematic Insights`
- [ ] `userInstruction` reflected
- [ ] Draft continuity maintained when refine mode is enabled
- [ ] No hallucinations beyond evidence
- [ ] `Next Iteration Plan` is actionable and not just a todo-list dump

Risk:
- Factual/terminology issues:
- Required revisions:
- Approval:
```
