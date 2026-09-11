# Proof infrastructure

Last reviewed: 2026-09-11

## Purpose

This directory contains the fail-closed CI authorities that inventory proof work, classify tracked
paths, select an affected or exhaustive plan, isolate shared state, execute workloads, authenticate
reader checkpoints, and join hosted results for one exact revision.

The implementation is intentionally data-driven: DESEN documents and pull-request input cannot
invent commands, choose executables, weaken prerequisites, or redirect evidence destinations.

## Entry points

| File                                       | Responsibility                                         |
| ------------------------------------------ | ------------------------------------------------------ |
| `run-required-affected-quality-gate.mjs`   | Trusted PR diff → affected plan or exhaustive fallback |
| `run-required-exhaustive-quality-gate.mjs` | Complete isolated exhaustive execution                 |
| `run-required-sharded-quality-gate.mjs`    | Hosted `shard` execution and same-revision `join` mode |
| `affected-workload-selector.mjs`           | Fail-closed selection decision                         |
| `affected-workload-ownership.mjs`          | Exact-one owner for every tracked path                 |
| `affected-impact-graph.mjs`                | Package/proof change → required workload closure       |
| `exhaustive-workload-inventory.mjs`        | Canonical logical workload and proof-unit inventory    |
| `proof-reader-checkpoints.mjs`             | Artifact and current-reader identity authority         |
| `shared-state-authority.mjs`               | Isolation, barrier, and resource policy                |
| `required-exhaustive-equivalence.mjs`      | Modular/legacy logical equivalence                     |
| `affected-selector-promotion-evidence.mjs` | Historical 20/20 promotion evidence and live successor |
| `infrastructure-debt.mjs`                  | Cleanup owner, trigger, deadline, and closure checks   |

The root `.github/workflows/ci.yml` selects the hosted entry point. `package.json` exposes focused
local verification commands.

## Execution modes

### Pull requests

An exact trusted diff enters `REQUIRED + AFFECTED`. Every changed path must resolve through the
reviewed ownership table. Proof-reader entry points select their proof unit; package/application
changes expand through the impact graph. Policy, dependency, frozen-input, shared infrastructure,
project documentation, unknown, ambiguous, or unowned changes force exhaustive execution.

If the base/head cannot be authenticated or the diff is incomplete, the result is exhaustive—not
an empty or partial plan.

### Main, release, and manual audit

These boundaries execute `REQUIRED + EXHAUSTIVE` from fresh inputs. Hosted exhaustive work is
distributed across three isolated shards and joined only when every expected result names the same
revision and succeeds. The join reruns closing boundaries.

### Legacy rollback

The sequential runner remains available only through the explicit manual rollback path. It is not
used by normal PR or main execution. `I07-05` owns retirement after the G12-due rollback, failure,
cancellation, hosted, and zero-reference checks pass.

## Current authority

- 235 logical workloads, including separate Editor Core, Editor Web, and Design System Core
  public-package contracts
- 112 proof pairs: 100 ordinary and 12 exclusive barriers
- 254 hosted physical shard workloads
- proof-reader checkpoint sequence 84
- 66 immutable artifacts and 132 current readers
- nine M10 Chromium journeys in the separate Browser E2E job; three T01 cases in its proof barrier

Exact counts are reviewed invariants, not targets to reduce. A performance change may redistribute
fresh work but cannot omit a workload, cache proof success, increase the deadline silently, or
weaken failure/cancellation semantics.

## Proof-unit anatomy

Each ordinary proof unit owns one verifier and one root test. The inventory records their stable
commands, prerequisites, isolation class, and dependency closure. A verifier authenticates existing
evidence; generators and writers never count as successful proof workloads.

Barrier units serialize work that can touch Git state, fixed ports, shared build output, process
listeners, generated evidence paths, or another reviewed mutable resource. Ordinary units run only
inside bounded isolated workspaces and worker budgets.

## Tracked-path ownership

The ownership table classifies every Git-tracked path exactly once:

- proof unit;
- CI policy;
- dependency policy;
- frozen input;
- package or application;
- shared proof infrastructure;
- project documentation; or
- repository policy.

Only exact verifier/root-test paths have `SELECT_PROOF_UNIT`. All other categories either expand
through the impact graph or force exhaustive execution. A path-set change requires a reviewed count,
ordered path-set digest, ownership digest, and mutation-test update.

## Reader checkpoints

The append-only checkpoint JSON contains artifact receipts and current proof-library/root-test
receipts. Verification authenticates the complete reviewed chain, then reads each current path under
regular-file, no-symlink, bounded-size, stable-identity rules.

Checkpoints and seals authenticate identity and impact, never cached test success. An append
candidate has no authority until its code-owned task generation, predecessor, counts, digests, and
tests are reviewed. Historical artifacts remain byte-identical; a changed current reader is resealed
only in a reviewed successor.

## Shared-state and process safety

- Each selected workload receives an authenticated temporary root and bounded environment.
- Permission policies allow only reviewed source, output, and temporary paths.
- Listener, signal, child-process, and filesystem compatibility guards fail closed.
- Cancellation reaches the active process group and starts no later step.
- A primary failure never suppresses cleanup or final tracked-workspace verification.
- Symlinks, hard links, path escapes, inode replacement, and unsafe authority parents are rejected.
- Tests cannot write the tracked workspace unless their reviewed contract explicitly owns output.

## Adding or changing CI work

1. Add or update the focused verifier and independent root test.
2. Register the exact proof unit and prerequisites in the exhaustive inventory.
3. Classify its shared-state and barrier requirements.
4. Extend the impact graph and affected-selector mutation coverage.
5. Recalculate tracked-path ownership when files are added, moved, or removed.
6. Append/reseal reader checkpoints only when a checkpoint-owned reader changes.
7. Preserve required/exhaustive equivalence and the manual rollback route.
8. Run focused CI contracts, the bounded baseline, and any task-specific proof.
9. Require exact-head hosted checks and a fresh main run when the task contract closes externally.

Never hand-edit frozen evidence to match changed code. Never treat a skipped, timed-out, cancelled,
or earlier-revision run as passing authority.

## CI-02 compatibility contract

CI-02 adds only a per-task completion policy. It keeps the six-command local baseline
non-authoritative and requires task-specific positive/negative evidence plus exact-head hosted
completion. It does not add a local affected selector or alter the hosted dispatcher,
and leaves I07-05 plus the manual legacy rollback path unchanged.

## Historical migrations

I07-01 introduced current-reader checkpoints and a shadow modular candidate. I07-02 proved
required/exhaustive equivalence and moved required CI to modular execution. I07-03 observed a
fail-closed shadow affected selector. I07-04 authenticated 20/20 eligible same-revision comparisons
with zero false negatives, promoted affected PR routing, and removed every G07-due compatibility
bridge. CI-03 and CI-04 improved fresh-proof runtime without dropping logical work.

Those task-time measurements, source digests, campaign receipts, and intermediate counts remain in
the immutable baselines and the pre-consolidation snapshot. They are evidence history, not current
operating instructions.

## Historical detail

The complete I07/CI/M10 narrative remains in Git history and `docs/proof/baselines/**`. The
immutable archive pointer is owned by the
[documentation standard](../../docs/standards/DOCUMENTATION-STANDARDS.md#document-lifecycle-and-ownership).
