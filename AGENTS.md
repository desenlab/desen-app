# Repository instructions for coding agents

## Before work

1. Read `PROJECT-STATUS.md`, `docs/plan/START-HERE.tr.md`, and `docs/plan/TASKS.md`.
2. Work on exactly one task ID whose dependencies are complete.
3. If no task is explicitly provided, use the active task in `PROJECT-STATUS.md`; do not jump ahead.
4. Read the relevant package README, architecture document, ADRs, and proof claims.

## Non-negotiable boundaries

- Never edit the frozen DESEN 0.1.0 upstream bytes to make implementation tests pass.
- Record ambiguity in `docs/plan/PROTOCOL-FINDINGS.md`.
- Build runtime and publisher milestones before Desen App editor milestones.
- Platform-neutral packages cannot import React, DOM, CSS, browser APIs, or app code.
- Applications may depend on packages; packages never depend on applications.
- The reference host cannot contain a manually recreated managed-screen component tree.
- DESEN documents contain data only and never select arbitrary executable code.
- Unknown or incompatible semantics fail explicitly.
- A failed activation preserves the last-known-good revision.
- Do not publish packages, releases, domains, or external services without explicit user approval.

## Completion requirements

- Implement only the selected task's scope.
- Add positive and relevant negative tests.
- Add TSDoc to every public export.
- Update the package README and any affected ADR, finding, or proof evidence.
- Run `pnpm check` and task-specific verification.
- Update `docs/plan/TASKS.md` and `PROJECT-STATUS.md` only after evidence passes.
- Do not include AI or tool co-author trailers in commits.

Comments must explain invariants and reasoning. Do not add comments that merely restate the code.
