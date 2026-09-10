# CI Quality Gate

Last reviewed: 2026-09-10

## Purpose

The quality gate turns the repository's test, proof, build, type, formatting, and dependency
contracts into one fail-closed execution authority. It distinguishes fast local feedback from task
completion, exact affected selection from exhaustive fallback, and identity checkpoints from fresh
test success.

## CI-02 per-task completion contract

CI-02 is an explicitly user-authorized operational task.

For an ordinary task, run this exact bounded local baseline:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm boundaries
node scripts/ci/verify-proof-reader-checkpoints.mjs
```

The baseline is deliberately non-authoritative early feedback. Task-specific verification and
focused positive and relevant negative tests remain mandatory.

Hosted completion binds to the exact current pull-request head; any new commit invalidates the earlier result.
`pnpm check` remains the local exhaustive compatibility and gate-closure command for G closure, an
explicit local manual audit, or an explicit request. Hosted `main`, release, manual audit, and
unsafe or untrusted boundaries execute fresh exhaustive work.

Checkpoints and seals are identity and impact authority, never cached success or task completion.
CI-02 does not add a local affected selector. The hosted dispatcher and workflow are unchanged.
I07-05 and the legacy rollback path remain unchanged.

## Execution modes

### Bounded local baseline

Used during an ordinary task for quick feedback. It verifies formatting, lint, types, builds,
dependency boundaries, and exact current proof-reader identities. It does not execute every proof
artifact, root mutation suite, or browser journey.

### Required affected

Used for eligible pull requests. The selector receives an exact trusted diff and resolves every
changed path through the reviewed ownership table and impact graph. It runs each selected workload
fresh.

Any missing base/head, incomplete diff, rename ambiguity, unknown path, unowned path, unsupported
change kind, policy input, dependency input, frozen evidence, unsafe repository state, or selector
error expands to exhaustive execution. There is no optimistic partial plan.

### Exhaustive

Used for `main`, release, manual audit, unsafe/untrusted boundaries, selector fallback, and explicit
requests. It executes the complete logical workload inventory from current source.

### Legacy rollback

The retained sequential runner is available only through the explicit manual rollback path. It is
not a normal PR or main authority. `I07-05` owns its final retirement after rollback, failure,
cancellation, hosted, and zero-reference gates pass.

## Hosted topology

The current exhaustive graph contains 232 logical workloads and 111 proof pairs. Hosted execution
uses three isolated exhaustive proof shards plus a fresh joining Quality gate, producing 249
physical shard workloads. Each workspace builds and tests from current inputs; shards do not share
mutable build output or test success.

The join requires every expected shard result for the exact same revision. Missing, failed,
cancelled, timed-out, skipped, duplicated, stale, or mismatched results fail the gate. Closing
boundaries execute again in the join rather than trusting a summary alone.

Browser E2E is a separate required job. Root `pnpm test:e2e` executes all nine independent M10
Chromium journeys; no proof shard impersonates browser success.

## Logical order

The exhaustive command performs these categories in reviewed order:

1. formatting and frozen protocol integrity;
2. protocol types, canonicalization, diagnostics, and validation proofs;
3. Catalog and reference capability proofs;
4. Runtime Core and Runtime React proofs;
5. independent-host proofs;
6. Publisher and control-plane proofs;
7. Editor Core and Desen App proofs;
8. M10 terminal and Runtime Core baseline proofs;
9. workspace lint, typecheck, build, package tests, and dependency boundaries.

`scripts/run-ci-quality-gate.mjs` owns the legacy single-pass inventory. The modular hosted runners
own selection, isolation, shard authority, and joining without changing the logical proof set.

## Proof-unit contract

An ordinary proof unit has exactly:

- one stable ID;
- one verifier command;
- one independent root-test command;
- declared prerequisites and shared-state classification; and
- exact path ownership for the verifier and root-test entry points.

Generators and writers are never selected as proof success. Frozen artifacts are inputs, not
commands. A verifier may authenticate an artifact only under its code-owned task, path, byte, and
digest authority.

Twelve barrier units retain exclusive execution where filesystem, Git, ports, generated output, or
other shared state cannot be safely parallelized. Ordinary units may run concurrently only inside
their explicit isolated workspace and resource budget.

M10A-T01's barrier executes three real Chromium cases on its own port 4187 and runner-owned temp.
It does not replace the separate Browser E2E job's nine M10 journeys or weaken ordinary isolation.

## Tracked-workspace integrity

The gate snapshots tracked bytes and index identity before execution and checks them again before a
pass. Tests may write only reviewed generated outputs and temporary locations. A primary test
failure does not suppress the closing drift check.

Untracked generated output cannot substitute for a tracked source. Index-only changes, mode drift,
missing files, added tracked files, or changed tracked bytes fail. Current source is always the
execution authority; checkpoints do not restore or rewrite it.

## Proof-reader checkpoints

The append-only checkpoint ledger authenticates immutable artifacts and their current proof-library
and root-test readers. The current reviewed head is sequence 82 with 65 artifacts and 130 readers at
`sha256:67a72d107af76982c0aa5bab6907f0634de3f9754b46dd2799891d9f5169f53e`.

A successor must preserve the full reviewed prefix and add exactly one reviewed generation. Reader
reseals acknowledge current code changes; they never mutate historical artifacts or cache passing
tests. Candidate bytes have no authority until their constants, tests, and evidence are reviewed.

## Affected ownership and impact

Every tracked path belongs to exactly one category. Repository/CI policy, dependency policy,
frozen inputs, shared proof infrastructure, and project documentation force exhaustive execution.
Only exact proof verifier/root-test inputs may select proof units, and package/application changes
expand through the reviewed impact graph.

The ownership table and impact graph are fail-closed code-owned authorities. Adding, moving, or
removing a tracked file requires recalculating the reviewed path set and updating mutation tests;
changing content alone never changes a path's category.

## Cancellation and failure

- Steps are sequential within one workload and fail fast.
- Cancellation is a failure and is forwarded to the active process group.
- No later step starts after failure or cancellation.
- Cleanup failure cannot turn a failed run into success.
- A passing primary command plus tracked-workspace drift is failure.
- A timed-out or missing hosted result is not a receipt.
- Earlier passing shards do not authorize a corrected later commit.

## Updating CI safely

When adding or changing a proof unit:

1. keep its focused verifier and root test independently runnable;
2. register the exact commands and prerequisite ownership;
3. classify shared-state and barrier needs;
4. update exhaustive inventory and affected impact closure;
5. update tracked-path ownership for any path-set change;
6. append or reseal the proof-reader checkpoint only when required;
7. add positive and adversarial CI contract tests;
8. run the focused CI suites and bounded baseline; and
9. require exact-head hosted success followed by fresh `main` validation when the task contract
   closes externally.

Do not raise timeouts, drop workloads, reuse cached test success, weaken mutation cases, or broaden
permissions to make a candidate pass. Performance work must preserve the complete logical
inventory and record measured before/after evidence.

## Security boundary

Hosted workflows use pinned actions, least-privilege permissions, exact repository/revision
identity, bounded artifacts, and isolated temporary roots. Pull-request code does not choose
secrets, credentials, runners, commands, or publication destinations. External publishing and
release remain separate explicit user-authorized operations.

## Historical detail

The full I07/CI-01–CI-04/M10 task-time narrative remains in Git history and the linked baseline/proof
artifacts. The immutable archive pointer is owned by
[Documentation Standards](DOCUMENTATION-STANDARDS.md#document-lifecycle-and-ownership).
