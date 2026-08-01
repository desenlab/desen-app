# CI Quality Gate

## Purpose

The hosted CI gate must prove the same safety properties as the cumulative task commands without
restarting identical builds and tests through every historical prerequisite wrapper.

The task-specific `verify:*`, `test:*`, aggregate `test`, and aggregate `check` scripts remain the
reviewed compatibility surface. GitHub Actions first verifies the required-exhaustive contracts,
then invokes `scripts/ci/run-required-exhaustive-quality-gate.mjs` as the official
`REQUIRED + EXHAUSTIVE` authority. `scripts/run-ci-quality-gate.mjs` is retained only behind the
explicit manual `legacy-rollback` workflow mode.

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
The scheduler-neutral I07-02 inventory is independently pinned as
`sha256:bc8644fc1147166f98f905ec5fef1e6d81ef6e639008de9bd53e7256825abb94`.

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

### Historical I07-01 checkpoint

I07-01 added a non-authoritative `SHADOW + EXHAUSTIVE` candidate beside this gate. The candidate
imported this gate's validated proof inventory and exact normalized plan rather than maintaining a
second command list. It executed every global step and every verifier/root-test pair from fresh
inputs. Candidate proof pairs could run with concurrency two only while the sequential result
remained authoritative. It did not select by changed paths, read cached proof success, generate
evidence, or write tracked files.

The shadow also validates one hash-chained current-reader checkpoint whose genesis digest is pinned
outside the manifest by the I07-01 baseline. Frozen task artifacts remain the historical claim
authority; the checkpoint records reviewed live proof/test readers that can legitimately receive
security hardening after task completion. The checkpoint never chooses a command. Executable
verifier/test ownership remains in reviewed code.

The existing sequential gate remained the sole pass/fail authority throughout that checkpoint.
The archived I07-01 local and hosted comparisons are historical evidence, not I07-02 cutover
evidence.

### I07-02 required-exhaustive architecture and completed cutover

`exhaustive-workload-inventory.mjs` is now the neutral executable authority. It validates the
repository inputs and owns all 130 ids, labels, shell-free command/argument vectors, dependencies,
execution classes, and inert shared-state records without importing either scheduler. The retained
legacy sequential implementation is a rollback mirror. The rollback-only
`required-exhaustive-equivalence.mjs` adapter compares its exact ordered plan against the neutral
inventory, proves set equality and exactly-once ownership, and retains the reviewed plan digest.
It cannot turn either source into executable authority.

The equivalence adapter also normalizes terminal receipts. PASS requires all 130 exact workloads
to report PASS after an observed close and requires the tracked-workspace digest to remain
unchanged. Missing, duplicated, skipped, not-run, cancelled, timed-out, failed, or unclosed work
fails closed. Inventory, workload, workspace, cancellation, and timeout are distinct terminal
authorities; timing and concurrent sibling completion order are observational only.

The exhaustive plan factory accepts no scope except `EXHAUSTIVE`, defaults to `REQUIRED`, and
requires `SHADOW` to be explicit. The official pull-request and `main` workflow now invokes that
runner without an authority override, so its fail-closed default is `REQUIRED`. The exact 4,994-byte
workflow is pinned as
`sha256:4146f610ce30a973a84c02279254058a7f044eb4415619c09addb577d9f11fb0`.
The retained sequential runner is not an automatic peer: it runs only when a trusted operator
manually dispatches `legacy-rollback`. Event name and mode are part of the concurrency key, so a
rollback exercise cannot cancel a pull-request or `main` authority run.

All 130 workloads have one exact shared-state class:

| Execution class                  | Count | Scheduling rule                                      |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Drained repository-wide barrier                      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     1 | Sole workspace build/typecheck writer                |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Drained complete package-test barrier                |
| `PROOF_READ_ONLY`                |    66 | No shared workspace writes                           |
| `PROOF_OS_TEMP_ISOLATED`         |    45 | Writes only to a workload-owned OS temp root         |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases under a drained scheduler       |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | Direct source-audit workspace-temp root-test barrier |

Fifty proof pairs may overlap pair-by-pair at concurrency two after their predecessors pass. A
pair's root test still follows its verifier. Ten real tracked-alias pairs and the
`reference-host-web-source-audit` pair are the eleven exclusive barriers.

Only these verifier proofs receive both runner-owned temp-write and child-runtime-probe authority:

- `publisher-catalog-pinning`;
- `publisher-bundle-publication`;
- `publisher-official-golden`;
- `publisher-invalid-source-matrix`; and
- `control-plane-bundle-store`.

Native-addon authority is limited to the exact `reference-host-web-source-audit`
verifier/root-test pair and the `publisher-invalid-source-matrix` root test, whose nested
programmatic probe loads the reviewed Rolldown binding. The source-audit verifier remains
workspace-read-only; its root test owns the single exclusive workspace-temp exception.

Every proof process gets a fresh, identity-checked temp root and generated Node permissions.
Direct workspace-write grants, child processes, and addons are absent unless the code-owned
workload record grants them. Inherited `NODE_OPTIONS` is rejected, and a mandatory preload denies
TCP and UDP listener binding. The runner authenticates temp identity again before cleanup.

Eighteen root-test records also own an orthogonal schema-v2 Node-permission compatibility policy:
112 workloads are `NONE`, two are `FIXTURE_COPY`, fifteen are `REVIEWED_SYMLINK`, and one is
`FIXTURE_COPY_AND_REVIEWED_SYMLINK`. Fixture copy is limited to the exact code-owned workspace
source, a no-follow destination inside the workload's own temp root, two reviewed recursive option
shapes, bounded regular trees, and matching source/destination fingerprints. Symlink handling
keeps ordinary targets in the same temp root and pins fourteen workspace-target workloads to
eighteen exact target-and-kind rules. Eight unsafe-input targets are mirrored into the caller's
temp root; ten historical canonical-path or inode checks retain their exact tracked alias.

The generated grant list still adds no workspace-write, shared-parent, or sibling-temp path. This
adapter is defense in depth for fixed trusted repository tests, not a security sandbox for
adversarial JavaScript or child processes. Its real tracked aliases are covered by reviewed test
behavior, exclusive scheduling, and the complete gate's closing tracked-workspace seal. Unlisted
workloads, sources, workspace targets, target kinds, symlink-parent traversal, and copy options
fail closed.

`REQUIRED` rejects injected success observations and every injected runner, Git reader, workspace
capture, guard, process, environment, signal, or timeout seam. Those seams exist only for
non-authoritative contract tests. Its opening clean-input proof binds HEAD to the authenticated
revision and requires empty porcelain-v2 status, including staged, unstaged, non-ignored untracked,
and submodule state. The hosted `SHADOW` candidate uses the same real clean-input proof; only
focused non-authoritative tests may inject that boundary.

One first-terminal record is shared by the host handlers, scheduler, and child-process registry.
The first timeout, process error, nonzero close, execution error, SIGINT, or SIGTERM fixes the
primary reason and exit code, immediately terminates every active group, and prevents later
launches. Later signals may escalate but cannot replace that record. Every active child `close` and
isolation cleanup is still awaited before the gate settles.

The runner owns a 15-minute soft complete-gate deadline and a five-second child-termination grace.
Because authentic settlement still awaits child `close`, cleanup, and boundary capture, the Phase A
command also has an 18-minute operating-system ceiling with a 30-second kill grace. GitHub's
25-minute job ceiling remains outside both. An outer-ceiling failure is red and cannot serve as
promotion evidence; setup, contract checks, receipt emission, and hosted variance retain their own
headroom.

The required execution design layers three closing guards:

- a no-follow seal across the 33 reviewed build and Turbo output roots around the proof phase;
- a bounded digest of every non-ignored untracked entry around the full 130-step region; and
- a tracked-workspace boundary covering bytes, executable modes, file count, and Git index object
  ids around the full run, including failure and cancellation paths.

No proof-result cache is admitted. The pnpm store may cache immutable dependency downloads only;
every build, test, verifier, mutation, checkpoint, and boundary result is recomputed.

I07-02 promoted execution to hosted `REQUIRED + EXHAUSTIVE` only after the same revision proved:

- exact plan and workload-set equality;
- exactly-once coverage for every global step and proof pair;
- identical pass/fail outcomes with no tracked-byte or index drift;
- safe cancellation and sibling-process termination;
- code-owned shared-state, build-output, port, and temporary-path classification; and
- a recorded local and hosted timing comparison.

The accepted pre-cutover comparison at commit
`077560fe81d0fcf4560554dd7511413bad5bc30e` passed the 130-workload required runner and retained
legacy runner on the same pull-request revision. The official cutover at commit
`3cf72552ee3ea23a0b5e99f782f837bc6237f78b` passed hosted run
[`30699616361`](https://github.com/desenlab/desen-app/actions/runs/30699616361): the required
`Quality gate` completed in 10 minutes 33 seconds, the manual rollback job was skipped, and no
shadow workflow ran. The exact program, including an earlier rejected common-drift attempt, is
archived in
[`i07-02-required-exhaustive-equivalence.json`](../proof/baselines/i07-02-required-exhaustive-equivalence.json).

I07-03 may calculate an `AFFECTED` plan only in shadow. Unknown paths, statuses, file modes,
dependency or policy changes, missing Git authority, and any ambiguous classification must expand
to `EXHAUSTIVE`. Promotion is reserved for I07-04 after ADR 0011's frozen threshold passes.
`EXHAUSTIVE` fresh execution remains mandatory on `main`, release candidates, and manual audits.
I07-02 implements no affected selector. Its completed promotion closed `DEBT-I07-008` by removing
the temporary shadow workflow and modular comparison adapter/test. The current-reader bridges
remain owned by I07-04. `DEBT-I07-007` keeps the sequential runner, rollback-only equivalence
adapter, and other rollback references under I07-05 until their exact machine-checked removal
conditions in `docs/plan/DEBT-REGISTER.md` are satisfied.
