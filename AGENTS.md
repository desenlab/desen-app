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
- When a task becomes `DONE`, update the README task-progress block from `docs/plan/TASKS.md` in
  the same commit.
- Do not include AI or tool co-author trailers in commits.

## Public build-log handoff

Every report that marks a task `DONE` must include two ready-to-review social drafts:

- X: English, no more than 280 characters, with a designer-first hook that developers can also
  understand.
- LinkedIn: one post containing an `[EN]` section followed by a natural `[TR]` adaptation.

Both drafts must state only evidence-backed outcomes, distinguish what is not proven yet, and end
with a useful question or invitation to inspect the public repository. Prefer two to four restrained
hashtags on LinkedIn. Never publish a draft or imply that the user published it without explicit
approval.

The public build log starts with `Day 1` on 2026-07-24, the date the repository became public.
Future day numbers follow the user's confirmed publication sequence; producing a draft alone does
not increment the number.

Comments must explain invariants and reasoning. Do not add comments that merely restate the code.
