# Contributing

DESEN is implementation-first. Every contribution must strengthen a documented protocol claim,
an implementation milestone, or the reliability of the proof environment.

## Before changing code

1. Read [PROJECT-STATUS.md](PROJECT-STATUS.md).
2. Select exactly one task from [docs/plan/TASKS.md](docs/plan/TASKS.md).
3. Confirm its dependencies are `DONE`.
4. Mark only that task `IN_PROGRESS`.
5. Read the package README and relevant architecture decision records.

## Definition of done

A task is complete only when:

- the requested behavior works;
- positive and relevant negative tests exist;
- formatting, lint, typecheck, tests, and dependency boundaries pass;
- public exports have TSDoc;
- package and user documentation reflect the behavior;
- proof evidence is linked when the task supports a proof claim;
- protocol findings are recorded instead of silently changing the frozen specification; and
- no unrelated work is bundled into the change.

## Commit and review expectations

- Keep commits narrow and describe the outcome.
- Never include AI or tool co-author trailers.
- Do not commit secrets, real credentials, production data, or personal data.
- Architectural changes require an ADR.
- Protocol ambiguities require an entry in `docs/plan/PROTOCOL-FINDINGS.md`.
- Public API changes require a changeset once package publishing is enabled.

## Validation

For an ordinary task, run the bounded local baseline before review:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm boundaries
node scripts/ci/verify-proof-reader-checkpoints.mjs
```

This baseline is non-authoritative early feedback. The task-specific verifier and focused positive
and relevant negative tests are still mandatory. Merge or a completion report additionally
requires a passing hosted `Quality gate` attached to the exact current pull-request head; a new
commit invalidates the earlier result.

Use the exhaustive local `pnpm check` compatibility command for G closure, an explicit local
manual audit, or an explicit request. Hosted `main`, release, manual audit, and unsafe or untrusted
boundaries remain fresh exhaustive runs. Current checkpoints and seals authenticate identity and
impact; they never cache success or replace fresh selected workloads.
