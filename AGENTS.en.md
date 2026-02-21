# AGENTS

This repository helps developers write technical blog posts from work history (commits, Notion pages, generated drafts) and move toward an automated content workflow.

## Project Objective

- Improve modularity and handoff quality so humans and AI agents can understand, maintain, and extend the codebase consistently.
- Preserve core behavior while clearly separating shared operating rules.
- Keep common standards in one place and move role-specific rules into dedicated files.

## Global Principles

- Use `apps/web`, `apps/api`, and `packages/shared` as domain boundaries.
- Preserve behavior by default: API endpoints, SSE contract (`type/status/chunk/complete/error`), and storage contracts stay unchanged unless explicitly required.
- Type safety is mandatory: avoid `as any`, `@ts-ignore`, `@ts-expect-error`, and `@ts-nocheck`.
- Documentation first: add rule updates to `AGENTS.md`/`AGENTS.en.md` immediately when scope changes.
- Verify where possible: typecheck/build/tests for impacted scope.

## Rule Documents

- Code rules: `./rules/code.md`
- Code input analysis: `./rules/code-analysis.md`
- Code review: `./rules/code-review.md`
- Blog input analysis: `./rules/blog-input-analysis.md`
- Blog writing: `./rules/blog.md`
- Blog review: `./rules/blog-review.md`
- Review templates: `./review-guide/code.md`, `./review-guide/blog.md`
