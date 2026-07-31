# CI Quality Gate

## Purpose

The hosted CI gate must prove the same safety properties as the cumulative task commands without
restarting identical builds and tests through every historical prerequisite wrapper.

The task-specific `verify:*`, `test:*`, aggregate `test`, and aggregate `check` scripts remain the
reviewed compatibility surface. GitHub Actions invokes `scripts/run-ci-quality-gate.mjs`, which
audits that legacy surface before running its single-pass equivalent.

## Single-pass order

The gate runs from a fresh workspace in this order:

1. validate the frozen CI inventory and the orchestrator's own mutation tests;
2. check formatting and lint the complete repository;
3. verify generated structural-validator bytes;
4. build and typecheck the workspace once through a cache-read-disabled Turbo graph;
5. run every package's complete test suite once with controlled concurrency;
6. run all 61 proof verifiers directly in the reviewed order, ending with the M07-T01 immutable
   Bundle-store proof;
7. run all 61 root proof and mutation files as separate fail-fast processes; and
8. run the dependency graph and hostile boundary fixtures.

The current legacy expansion contains 1,781 leaf process invocations but only 202 distinct
workloads. The optimized gate covers all 202 distinct workloads. Repeated prerequisite checks
inside proof builders remain intact because those checks are evidence, not orchestration overhead.
The measurement recursively expands exact root-level `pnpm <script>` references beginning at
`check`; commands with no further local root-script indirection are leaves, and the distinct
inventory is sorted before hashing.

## Fail-closed invariants

The gate refuses to run when any of these conditions changes without an explicit review:

- the 61 task IDs, verifier files, root test files, or their order;
- any of the 387 legacy prerequisite command segments;
- the exact 130-step normalized execution plan;
- a focused package test that is no longer included by its full package suite;
- any drift in the reviewed `test` command of any workspace package, including packages without a
  focused prerequisite;
- any byte or package-glob drift in `pnpm-workspace.yaml`; the reviewed graph roots are exactly
  `apps/*` and `packages/*`;
- a root or app/package `vite.config.*`, `vitest.config.*`, or `vitest.workspace.*` file, or a
  `vitest` field in the root or any workspace package manifest;
- an unknown package, task, prerequisite, executable, or shell expression;
- shell metacharacters, operators, quoting, or escaping hidden inside a workspace package test
  command;
- a generator, writer, changed-file filter, or affected-only shortcut; or
- the tracked working-tree bytes, executable modes, tracked-file count, or Git index object IDs
  before and after the gate.

Proof generators and evidence writers are never CI inputs. Proof output and success are never read
from cache. Timing data is observational and cannot influence pass or fail.

The reviewed legacy prerequisite inventory is pinned as
`sha256:bfce7beb80d98b29a21c43263c422e87218738ed0c040e6a45c60a35fb8f8290`.
The ordered 1,781-entry legacy leaf-invocation inventory is pinned as
`sha256:3c6ae8ee7f034a5e6204e2996f096b475fbef38ea34417effab6850794fc3fa2`; its sorted
202-entry distinct-workload inventory is pinned as
`sha256:6825adfa7c2569fdfd9dbae167f980960469c47e187a7a26423d2e0ec1d74fef`. The normalized
single-pass plan is pinned as
`sha256:448102bdfc5e0ed331f09038a2c554dcb930300ec560d35ac94469fc89d5897f`.

The reviewed workspace package-test inventory contains 14 Vitest commands and is pinned as
`sha256:5f3ee5e9ff2b0f09c06578db7ecf48c7c8a9eafd679c98a6e3af20318c4943c4`. Two
application packages currently have no package-level test command; that absence is part of the
same exact inventory rather than an implicit exemption.

The workspace manifest itself is pinned as
`sha256:c9729b90c41f345a60acacc3a4d38826183777f57798b4f076aa4b876a3d99ba`; this
prevents an otherwise valid package manifest from being omitted from pnpm and Turbo discovery.

At the M07-T01 checkpoint, the frozen inventory contains 61 proofs, 387 prerequisite segments,
1,781 ordered leaf invocations, 202 distinct leaf workloads, and 130 normalized single-pass
steps. Twenty-four independent orchestrator contract tests protect that exact profile. The
prerequisite inventory is pinned as
`sha256:bfce7beb80d98b29a21c43263c422e87218738ed0c040e6a45c60a35fb8f8290`; the other
three digests are recorded above.

`SIGINT` and `SIGTERM` become permanent cancellation state, are forwarded to the active process
group, stop later steps, and preserve exit codes 130 and 143. This prevents a superseded workflow
from leaving child or grandchild processes behind or turning cancellation into success.

## GitHub Actions trust boundary

The workflow:

- uses immutable full commit SHAs for GitHub-owned actions;
- grants only read access to repository contents;
- does not persist checkout credentials;
- cancels superseded work for the same branch or pull request;
- prevents external forks from reading or writing the trusted dependency cache;
- allows same-repository pull requests to restore but not save that cache; and
- saves the dependency cache only after a successful `main` push.

The pnpm store is a dependency download cache only. Builds, typechecks, package tests, verifiers,
mutation tests, and boundary checks run fresh.

## Updating the gate

When a proof task or prerequisite is added:

1. keep its task-specific root scripts intact;
2. add its verifier and root test to the frozen proof inventory;
3. classify every prerequisite and prove focused tests remain inside the full package suite;
4. review every workspace package's exhaustive Vitest command and keep test configuration absent;
5. review the normalized plan for generators, writers, filters, duplication, and missing work;
6. intentionally update the prerequisite, leaf-invocation, distinct-workload, workspace-test, and
   plan SHA-256 pins;
7. run the orchestrator contract tests and the complete single-pass gate; and
8. record the hosted run URL and timing before reducing the timeout.

Changing a pinned digest without reviewing the corresponding readable inventory is not an
acceptable update.

## I07 modular migration

I07-01 adds a non-authoritative `SHADOW + EXHAUSTIVE` candidate beside this gate. The candidate
imports this gate's validated proof inventory and exact normalized plan rather than maintaining a
second command list. It executes every global step and every verifier/root-test pair from fresh
inputs. Candidate proof pairs may run with concurrency two only while the legacy result remains
authoritative. It does not select by changed paths, read cached proof success, generate evidence,
or write tracked files.

The shadow also validates one hash-chained current-reader checkpoint whose genesis digest is pinned
outside the manifest by the I07-01 baseline. Frozen task artifacts remain the historical claim
authority; the checkpoint records reviewed live proof/test readers that can legitimately receive
security hardening after task completion. The checkpoint never chooses a command. Executable
verifier/test ownership remains in reviewed code.

During I07-01 the existing sequential gate remains the sole pass/fail authority. The `CI v2 shadow`
workflow must not be configured as required before I07-02. I07-02 may promote modular execution to
`REQUIRED + EXHAUSTIVE` only after the same revision proves:

- exact plan and workload-set equality;
- exactly-once coverage for every global step and proof pair;
- identical pass/fail outcomes with no tracked-byte or index drift;
- safe cancellation and sibling-process termination; and
- code-owned shared-state, build-output, port, and temporary-path classification; and
- a recorded local and hosted timing comparison.

I07-03 may calculate an `AFFECTED` plan only in shadow. Unknown paths, statuses, file modes,
dependency or policy changes, missing Git authority, and any ambiguous classification must expand
to `EXHAUSTIVE`. Promotion is reserved for I07-04 after ADR 0011's frozen threshold passes.
`EXHAUSTIVE` fresh execution remains mandatory on `main`, release candidates, and manual audits.
The current-reader bridges remain owned by I07-04, and the sequential runner remains owned by
I07-05, until their exact machine-checked removal conditions in
`docs/plan/DEBT-REGISTER.md` are satisfied.
