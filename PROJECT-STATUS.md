# Project Status

Last updated: 2026-09-11

## Current state

M10 and its terminal `G10` gate remain complete. Implementation progress is **123/176 tasks (70%)**:
M10 is **12/12**, M10A is **2/28 (7%)**, and proof gates are **11/14**. Gates are excluded from the
task count.

SC-02 concluded `adapt`; the user-authorized M10A product plan adds 28 tasks and G10A before M11.
**M10A-T01 and M10A-T02 are DONE**. M10A-T03 is `IN_PROGRESS`: its local implementation/evidence
is a candidate and exact-head hosted checks are pending. M11 has not started. The frozen protocol,
Runtime Core, SC-01 profile, and completed T02 authority are unchanged.

## Current closure

The task-owned [M10A-T02 proof](docs/proof/M10A-T02.md) records the full receipt. [PR
#92](https://github.com/desenlab/desen-app/pull/92) exact head `d3563f84` passed [run
34593058216](https://github.com/desenlab/desen-app/actions/runs/34593058216), including [Quality
103246842519](https://github.com/desenlab/desen-app/actions/runs/34593058216/job/103246842519) and
[Browser 103242508169](https://github.com/desenlab/desen-app/actions/runs/34593058216/job/103242508169),
then squash-merged as [`194b6eb`](https://github.com/desenlab/desen-app/commit/194b6eb36312f850d8f91ae1bbbf141408195dcd).
The [fresh-`main` run 34594715063](https://github.com/desenlab/desen-app/actions/runs/34594715063)
at that merge also passed [Quality
103251786647](https://github.com/desenlab/desen-app/actions/runs/34594715063/job/103251786647) and
[Browser 103247681073](https://github.com/desenlab/desen-app/actions/runs/34594715063/job/103247681073).
The [M10A-T01 proof](docs/proof/M10A-T01.md) retains its own exact-head, merge, and fresh-`main`
receipts. These authorities close only the bounded T01 and T02 scopes; earlier failed candidates
remain failures.

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

## Documentation verification

The eight governed entry and standards documents are reduced from 18,467 to 1,693 lines (90.8%)
while retaining historical task rows, immutable proof-reader pins, and the historical snapshot
through its explicit owner. The earlier consolidation passed 47/47 documentation tests and 96 local
link checks, with checkpoint 80 at 64 artifacts / 128 readers; these are historical receipts.

At the earlier consolidation, exhaustive proof stages including M10 passed. The default-parallel
package aggregation hit Vitest's five-second timeout under saturation; every timed-out package
passed independently, and the complete executable graph passed in a serialized Turbo run. The
dependency boundary audit reports no violation across 879 modules and 3,787 dependencies.

## Next authority

**M10A-T03 is the active `IN_PROGRESS` task.** The
[product plan](docs/plan/M10A-IMPLEMENTATION-PLAN.md) and
[T03 task contract](docs/plan/M10A-TASK-CONTRACTS.md#m10a-t03--theme-and-token-authoring) own the
bounded scope. The local candidate provides structured theme/mode/token/whole-alias editing,
exact sRGB and px/rem handling, deterministic transfer, and atomic undo/redo/import in a
platform-neutral package; an isolated workbench exercises preview without entering the normal App.
Frozen SC-01's 16 valid fixtures split into three T02-supported normal edit/preview paths and 13 preserved/disclosed unsupported paths; affected-overlay partial preview is blocked and seven invalid fixtures reject atomically.
A separate closed T02-recognized unsupported matrix preserves/discloses six valid fixtures and atomically rejects six malformed fixtures.
Unreviewed or invalid forms fail closed without silent loss.

G10A must pass before the M11 Map/Sortable branches. M10A and M11 preserve the complete frozen
Runtime Core tree and fresh proof requirements. T03 authorizes no publication, persistence,
deployment, normal App integration, immutable design-system release, Runtime, Publisher, or
protocol change. M10A-T04 is dependency-ready but remains `NOT_STARTED` and unselected while T03 is
active. No further external user/team recruitment is required; pilot demand remains unproven.

## Frozen G10 transition authorities

- Runtime Core tree: `3fa3613a3be63c749f40b6a0b55af5b40c675773`
- G10 artifact: `sha256:7005292247b0e4965eaf0bca12d3b1204be9d821f7ba2339257b6bc586ec3ca3`
- Proof-reader checkpoint 80: 64 artifacts / 128 readers at
  `sha256:49e9354e03e31d9e8767aac82832759f1d32397434b0952392b6d2f6218d24fe`
- CI candidate inventory: 238 logical workloads / 113 proof pairs / 259 physical shard workloads
- Browser authority: nine independent Chromium journeys

## Working order

1. Read `AGENTS.md`, this document, `docs/plan/START-HERE.tr.md`, and the relevant task row.
2. Confirm the selected task's dependencies and applicable ADR/proof boundaries.
3. Implement exactly one task, with positive and relevant negative tests.
4. Run the bounded local baseline and the task-specific verifier.
5. Use `pnpm check` for a gate closure, explicit exhaustive audit, or explicit request.
6. Update living status only after evidence passes; keep detailed receipts in the owning proof.

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
- `DONE`: implementation and required local/hosted evidence have passed.
