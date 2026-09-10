# Desen App M10 Gate Evidence

Gate: G10
Status: DONE
Date: 2026-09-08

Final artifact: `sha256:7005292247b0e4965eaf0bca12d3b1204be9d821f7ba2339257b6bc586ec3ca3`

## Hosted closure authority

[PR #85](https://github.com/desenlab/desen-app/pull/85) passed the exact-head hosted checks at
`7820fbe9bc1045a25d0eafe669d3d4752edbfb69`, including the joined Quality gate and Browser E2E.
That unchanged head merged as
[`70ac046c693b91fabba4c67cdaca6c5e33330d6a`](https://github.com/desenlab/desen-app/commit/70ac046c693b91fabba4c67cdaca6c5e33330d6a).
The [exact-head PR run](https://github.com/desenlab/desen-app/actions/runs/34286064936) and the
resulting [fresh `main` run](https://github.com/desenlab/desen-app/actions/runs/34287634835) both
passed the required exhaustive proof shards, joined Quality gate, and all nine Chromium journeys.
These hosted receipts finalize the local gate artifact above and are the canonical G10 closure
authority.

## Proven scope

G10 joins the exact completed M10-T01C through M10-T09 evidence into one terminal milestone
authority. A fresh current-source and Vite graph audit confirms that the independent reference host
owns no handwritten managed component tree: it resolves the public Catalog registry and runtime
surface, while the authored Source controls the visible managed surface. The current host graph has
104 modules, shares 22 managed modules with Desen App, and has no dynamic or unresolved edges.

The gate also freshly compares the complete committed Runtime Core tree with the M10-T09 baseline.
Both are `3fa3613a3be63c749f40b6a0b55af5b40c675773`; the comparison rejects staged, unstaged,
untracked-Core, object-loss, and identity drift.

## Required live execution

`pnpm test:e2e` now delegates to the package-owned complete Chromium suite. It preserves all nine
independent Playwright configurations: initial empty-project authoring, workspace compatibility,
user-created blank project, visual behavior authoring, pending input, failure, success through a
real host operation, published-host update and rejection, restart recovery, and two-cycle demo.

`pnpm proof` now delegates to the real exhaustive `pnpm check` graph. The root test and check chains
contain the G10 test and verifier exactly once and reject omission, substitution, duplication, or
recursive wiring. The hosted Browser E2E job must continue to invoke the same package-owned suite.
The deterministic verifier does not pretend to run Chromium; the separate live command and hosted
checks remain mandatory completion evidence.

## Negative evidence

Ten root groups cover every exact parent, command substitution and recursion, browser journey
omission/duplication/reordering, hosted-command bypass, deterministic immutable output, unsafe
options and destinations, artifact mutation, checkpoint drift, visible-report drift, fresh host
graph failure, and Runtime Core baseline failure. Checkpoint 80 appends only G10 while preserving
all 79 predecessors; it authenticates 64 artifacts and 128 current readers at
`sha256:49e9354e03e31d9e8767aac82832759f1d32397434b0952392b6d2f6218d24fe`.

## Completion boundary

This evidence proves the reviewed local Web–React reference composition. It does not claim remote
or multi-user deployment, production authentication, native targets, Map, Sortable, domains,
package publication, or release. The seal proves exact identity and fresh source/Core observations;
it never substitutes for live Chromium or exhaustive execution. G10 required the unchanged
pull-request head to pass every required hosted check, merge, and then pass a fresh `main` run. The
hosted closure authority above records that all three conditions were satisfied.
