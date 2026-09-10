# Project Status

Last updated: 2026-09-10

## Current state

M10 and its terminal `G10` gate are complete. PR #85 merged the M10 closure as `70ac046` and its
fresh `main` validation passed. Implementation progress remains **121/148 tasks (82%)**, M10 is
**12/12**, and proof gates are **11/13**. Gates are excluded from the task count.

The requested M10-to-M11 repository and documentation consolidation is complete. It changed no
protocol, runtime, publisher, editor, application behavior, frozen proof artifact, workflow,
lockfile, or Runtime Core byte. M11 has not started.

## M10 closure

[PR #85](https://github.com/desenlab/desen-app/pull/85) passed the exact-head hosted checks at
`7820fbe9bc1045a25d0eafe669d3d4752edbfb69`, including the joined Quality gate and Browser E2E,
then merged as [`70ac046`](https://github.com/desenlab/desen-app/commit/70ac046). The resulting
[fresh main run](https://github.com/desenlab/desen-app/actions/runs/34287634835) passed all three
exhaustive proof shards, the joined Quality gate, and all nine Chromium journeys. The exact-head
[PR run](https://github.com/desenlab/desen-app/actions/runs/34286064936) and fresh-main run are the
closure authorities; earlier failed candidates remain failures.

The terminal evidence proves the bounded Web–React profile: a design authored through Desen App is
validated, published, activated, updated in a separately built host without host-source changes,
rejected safely when invalid, and recovered from the last-known-good revision across full process
restarts. It does not claim production readiness, native targets, remote multi-user deployment, or
general interoperability.

- [G10 proof](docs/proof/DESEN-APP-M10-GATE.md)
- [Repeatable demo](docs/proof/DESEN-APP-REPEATABLE-DEMO.md)
- [Runtime Core baseline](docs/proof/RUNTIME-CORE-BASELINE.md)
- [Proof Matrix](docs/proof/PROOF-MATRIX.md)

## Consolidation boundary

The four living entry documents now have one job each:

- `README.md` introduces the product, repository, and first successful commands.
- `PROJECT-STATUS.md` reports only the current transition, closure receipts, and next authority.
- `docs/plan/START-HERE.tr.md` is the Turkish contributor onboarding path.
- `docs/plan/TASKS.md` is the canonical task/status/dependency board.

Task-time narratives remain available in their proof documents, ADRs, and registries. The
immutable pre-consolidation pointer and retrieval command have one canonical owner in the
[documentation standard](docs/standards/DOCUMENTATION-STANDARDS.md#document-lifecycle-and-ownership).
No Git history is rewritten.

## Consolidation verification

The eight governed entry and standards documents were reduced from 18,467 to 1,477 lines (92.0%)
while retaining every canonical task row, immutable proof-reader pin, and historical snapshot
through its explicit owner. The documentation contract passes 46/46 tests, all 61 local links in
the changed documents resolve, and the proof-reader checkpoint remains 64 artifacts / 128 readers.

All exhaustive proof stages, including the M10 gate, passed. On this host the default-parallel
package aggregation hit Vitest's five-second timeout under saturation; every timed-out package
passed independently, and the complete executable graph passed in a serialized Turbo run. The
dependency boundary audit reports no violation across 879 modules and 3,787 dependencies.

## Next authority

`SC-02` is `NOT_STARTED` and remains the decision checkpoint after G10 and before either M11
branch. It requires observed workflow evidence and at least two credible bounded pilot commitments;
repository activity, test volume, or social interest do not satisfy it. See
[Strategic Validation](docs/plan/STRATEGIC-VALIDATION.md).

If SC-02 authorizes continuation, `M11-T01` (Map) and `M11-T08` (Sortable) are the two permitted
parallel branch starts. Every M11 task must compare the complete `packages/runtime-core` tree with
the frozen M10 baseline. No M11 implementation, package publication, release, or deployment is
authorized by this cleanup.

## Frozen transition authorities

- Runtime Core tree: `3fa3613a3be63c749f40b6a0b55af5b40c675773`
- G10 artifact: `sha256:7005292247b0e4965eaf0bca12d3b1204be9d821f7ba2339257b6bc586ec3ca3`
- Proof-reader checkpoint 80: 64 artifacts / 128 readers at
  `sha256:49e9354e03e31d9e8767aac82832759f1d32397434b0952392b6d2f6218d24fe`
- CI inventory: 230 logical workloads / 110 proof pairs / 247 physical shard workloads
- Browser authority: nine independent Chromium journeys

## Working order

1. Read `AGENTS.md`, this document, `docs/plan/START-HERE.tr.md`, and the relevant task row.
2. Confirm the selected task's dependencies and applicable ADR/proof boundaries.
3. Implement exactly one task, with positive and relevant negative tests.
4. Run the bounded local baseline and the task-specific verifier.
5. Use `pnpm check` for a gate closure, explicit exhaustive audit, or explicit request.
6. Update living status only after evidence passes; place detailed receipts in the owning proof
   document rather than appending another chronological block here.

## Historical CI-02 compatibility pin

The following paragraph is retained verbatim for immutable reader compatibility. It describes
CI-02's historical pre-merge state, not the current repository state.

Conditional operational completion: CI-02's `DONE` entry in this unmerged change is a closure
candidate; it is not yet canonical. The implementation candidate at
`921fd54c406f22fb6da25b0fdd29598ac8950750` passed PR #56's hosted `Quality gate` in
[run 33196876164 / job 98936152886](https://github.com/desenlab/desen-app/actions/runs/33196876164/job/98936152886)
in `14m53s`. That receipt proves only that prior exact head and does not authorize this new head.
Canonical CI-02 remains `IN_PROGRESS` until the hosted `Quality gate` attached to this exact
current head passes. The historical task adds no local affected selector.

It changes no hosted dispatcher/workflow and leaves I07-05 plus the manual legacy rollback path
unchanged.

## Historical proof-reader pins

These three compact pins keep immutable M05 proof readers valid. Detailed task-time narratives
live in the linked proof documents and in the canonical Git snapshot recorded by the documentation
standard.

M05-T07 evidence:

- `docs/proof/artifacts/reference-host-web-0.1.0-shell.json`
- artifact SHA-256:
  `cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2`

M05-T08 evidence:

- `docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json`
- artifact SHA-256:
  `a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb`

M05-T09 evidence:

- `docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json`
- artifact SHA-256:
  `cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89`

## Status vocabulary

- `NOT_STARTED`: no implementation work has begun.
- `IN_PROGRESS`: exactly one authorized task or non-counted interlude is active.
- `BLOCKED`: an explicit dependency or external authority prevents progress.
- `DONE`: implementation and required evidence have passed; hosted closure is included when the
  task contract requires it.
