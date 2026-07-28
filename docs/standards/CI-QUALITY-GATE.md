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
6. run all 50 proof verifiers directly in the reviewed order, ending with the M06-T01 strict
   raw-source JSON and closed publisher-result proof;
7. run all 50 root proof and mutation files as separate fail-fast processes; and
8. run the dependency graph and hostile boundary fixtures.

The current legacy expansion contains 1,309 leaf process invocations but only 167 distinct
workloads. The optimized gate covers all 167 distinct workloads. Repeated prerequisite checks
inside proof builders remain intact because those checks are evidence, not orchestration overhead.
The measurement recursively expands exact root-level `pnpm <script>` references beginning at
`check`; commands with no further local root-script indirection are leaves, and the distinct
inventory is sorted before hashing.

## Fail-closed invariants

The gate refuses to run when any of these conditions changes without an explicit review:

- the 50 task IDs, verifier files, root test files, or their order;
- any of the 291 legacy prerequisite command segments;
- the exact 108-step normalized execution plan;
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
`sha256:761129e4dd83bae165f4ad18f8d91f9f598e085c7adaf5737305207892c5a523`.
The ordered 1,309-entry legacy leaf-invocation inventory is pinned as
`sha256:a3215013e50abb15071e49795bb27e4819be5ce011972f708744d514c4d8c91f`; its sorted
167-entry distinct-workload inventory is pinned as
`sha256:c3f90f11a02d4de0e18e408ad1e8c8c2a09bcf90097f4beaac9a96ed45c22fe3`. The normalized
single-pass plan is pinned as
`sha256:6d7bc8a7370e6dadcc70d965fe7be4dcf063cf82f461e2f72a2a10e3484dcef4`.

The reviewed workspace package-test inventory contains 13 Vitest commands and is pinned as
`sha256:6dc7cae96692feb13650a06f3b8733da6f6c431a0cad777e08a8d0d567880c3d`. Three
application packages currently have no package-level test command; that absence is part of the
same exact inventory rather than an implicit exemption.

The workspace manifest itself is pinned as
`sha256:c9729b90c41f345a60acacc3a4d38826183777f57798b4f076aa4b876a3d99ba`; this
prevents an otherwise valid package manifest from being omitted from pnpm and Turbo discovery.

At the M06-T01 checkpoint, the frozen inventory contains 50 proofs, 291 prerequisite segments,
1,309 ordered leaf invocations, 167 distinct leaf workloads, and 108 normalized single-pass
steps. The prerequisite inventory is pinned as
`sha256:761129e4dd83bae165f4ad18f8d91f9f598e085c7adaf5737305207892c5a523`; the other
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
