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
- Follow the CI-02 per-task quality contract below.
- Update `docs/plan/TASKS.md` and `PROJECT-STATUS.md` only after evidence passes.
- When a task becomes `DONE`, update the README task-progress block from `docs/plan/TASKS.md` in
  the same commit.
- Do not include AI or tool co-author trailers in commits.

## Per-task quality contract (CI-02)

For an ordinary `T` task, run this exact bounded local baseline:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm boundaries
node scripts/ci/verify-proof-reader-checkpoints.mjs
```

This baseline is non-authoritative early feedback; it does not complete a task and it does not
replace the task-specific verifier or focused positive and relevant negative tests. A task may be
merged or reported complete only after the hosted `Quality gate` passes for the exact current
pull-request head. Any new commit invalidates that result.

The full `pnpm check` remains the local exhaustive compatibility and gate-closure command for G
closure, an explicit local manual audit, or an explicit request. Hosted `main`, release, manual
audit, and unsafe or untrusted boundaries remain fresh exhaustive runs. A checkpoint or seal is
identity and impact authority, never cached success; every hosted selected workload still runs
fresh.

## Private build-log handoff

For implementation-task completion, include two ready-to-review social drafts only in the private
conversation with the user, never in repository files or public GitHub metadata:

- X: English, no more than 280 characters, with a designer-first hook that developers can also
  understand.
- LinkedIn: one post containing an `[EN]` section followed by a natural `[TR]` adaptation.

Both drafts must state only evidence-backed outcomes, distinguish what is not proven yet, and end
with a useful question or invitation to inspect the public repository. Prefer two to four restrained
hashtags on LinkedIn. Never publish a draft or imply that the user published it without explicit
approval. Committing or pushing a draft to this public repository is publication, even if it is
labeled "draft" or "not published". Normal code commit/push/merge authorization does not authorize
publishing social copy. Keep drafts out of `PROJECT-STATUS.md`, task boards, proof documents,
commit messages, pull-request bodies/comments, and issues; do not relocate them to another tracked
file. Public documentation contains technical status, decisions, and evidence only. Publishing a
particular draft requires separate explicit approval for that content and destination.

The public build log starts with `Day 1` on 2026-07-24, the date the repository became public.
Future day numbers follow the user's confirmed publication sequence; producing a draft alone does
not increment the number.

Comments must explain invariants and reasoning. Do not add comments that merely restate the code.
