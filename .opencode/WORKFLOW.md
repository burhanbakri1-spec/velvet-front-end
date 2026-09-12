# Cursor → OpenCode workers

Cursor is the Parent Agent / Orchestrator.

OpenCode workers execute delegated tasks only.

Canonical OS: `docs/CURSOR_DEVELOPMENT_OPERATING_SYSTEM.md`
Always-on Cursor rule: `.cursor/rules/project-workflow.mdc`

## Normal implementation

Agent: `imkan-coder`

```text
opencode run --agent imkan-coder --auto --print-logs --log-level INFO --dir "<repo-root>" -- "<scoped task>"
```

If OpenCode is unavailable → **BLOCKED**. Do not silently fall back to Cursor premium models.

## Browser / UI evidence

Agent: `browser-worker` (when browser/UI inspection is needed)

```text
opencode run --agent browser-worker --auto --print-logs --log-level INFO --dir "<repo-root>" -- "<scoped task>"
```

## Workflow

1. User asks Cursor for work.
2. Cursor classifies mode/category and gathers the smallest relevant context.
3. Cursor inspects the repository and dirty worktree.
4. For normal bounded implementation, Cursor delegates to `imkan-coder` with explicit scope.
5. Worker returns changed files, evidence, and focused test results.
6. Cursor reviews, verifies, and reports. User approval is required before commit/push.

## Defaults

- `imkan-coder`: scoped local file changes only; never git add/commit/push/reset/stash/restore/clean; never create or switch branches.
- `browser-worker`: read-only inspection; never edits the repo.
- Hard/risky work follows Master Workflow routing (Codex and specialists only when justified).
