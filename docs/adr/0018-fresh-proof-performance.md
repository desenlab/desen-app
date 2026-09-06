# ADR 0018 — Reduce fresh-proof cost without weakening evidence

Status: Accepted. CI-03 closure requires hosted verification of the exact final PR head.

## Context

M10-T04's required Quality gate exceeded the existing exhaustive deadline twice. Measurements
showed substantial cost before the App proof region, repeated pure checkpoint work, expensive
runtime setup before rejection of malformed proof requests, and a long independent proof pair
starting near the end of an otherwise concurrent region.

The user authorized a bounded CI performance interlude. This does not authorize retiring the
legacy runner, skipping selected workloads, treating an old pass as current evidence, increasing
time limits, weakening process isolation, or changing DESEN product behavior.

## Decision

Optimize work within a fresh invocation and its validated schedule:

- Normalize and hash a checkpoint once inside its private validation call. Apply every schema,
  canonical-byte, chain, history, and reviewed-anchor check to that captured result. No mutable
  caller input or previous invocation can supply a trusted normalized result.
- Admit proof requests cheaply before running expensive positive probes. Structurally malformed
  proof documents and unsafe writer destinations fail explicitly. A preflight can reject but can
  never produce PASS. Every admitted candidate still crosses the complete fresh runtime,
  artifact-byte, exact-pin, and final filesystem checks.
- Preserve captured option authority and no-follow reads. Recheck path-based proof documents
  after the fresh build, and preserve atomic writer rechecks after preflight. No preflight
  filesystem result becomes a reusable write capability.
- Prioritize the one measured long, independent package-digest proof pair inside its existing
  ordinary segment. Preserve the exact inventory, dependencies, canonical receipt order, two
  workers, eleven drained barriers, cancellation, and failure authority.

Frozen task artifacts do not change. Any changed historical proof reader is admitted only through
the existing reviewed, append-only current-reader checkpoint procedure. Current-reader identity
is not a cache of test success. I07-05 retains its separate legacy-retirement scope.

## Verification and consequences

Negative regression tests must establish that malformed requests do not reach expensive build
work, while well-formed and positive requests still do. Timing assertions are not correctness
authority: deterministic call counts, exact outputs, hostile inputs, same-size file mutations,
filesystem races, cancellation, and unchanged workload sets are tested independently.

Before/after local focused timings and historical hosted timing analysis live in
[CI-03 evidence](../proof/CI-FRESH-PROOF-PERFORMANCE.md). Completion still requires the exact final
PR head's hosted Quality gate. Main performs a separate fresh exhaustive run after merge.

## CI-04 extension — isolated exhaustive shards

The user authorized a separate performance interlude on 2026-09-07 after SEC-02's merged main
timed out twice. The unchanged logical workload set has grown to 220 workloads / 105 proof pairs.
Measured single-workspace packing offers only about nine seconds of potential margin, so the
single-workspace performance approach is no longer sufficient by itself.

CI-04 adds three fixed exhaustive proof shards on separate hosted checkouts. Each independently
runs the full original prefix and uses the existing two-worker runner, eleven total exclusive
barriers, process isolation, cancellation, and unchanged execution deadlines. Aggregate hosted
concurrency increases; shared-workspace concurrency does not. Every verifier/root pair has exactly
one shard owner. No build-output transfer, test-result cache, or shared mutable workspace is used.
The retained affected path and its measured selection semantics remain available for eligible PRs;
fresh routing is not execution authority. The monolithic exhaustive and manual legacy runners are
retained, and I07-05 is not consumed.

An always-evaluated final Quality gate requires exact same-workflow, same-execution-revision and
same-PR-head shard results plus complete static coverage. It independently builds local outputs
and executes the two suffix workloads only after every remote prerequisite succeeds. Remote
GitHub job authority is explicitly different from local observed process-close authority; JSON
receipts alone cannot invent successful child execution. Failed-job reruns may retain a passing
producer from an earlier attempt of the same exact run/revisions, with its actual attempt recorded.
Unknown, missing, failed, cancelled, skipped, foreign, or future producer authority fails closed.
Replicated prefixes and join preparation are recorded as additional work; the 220-node logical
inventory and every existing test remain intact.

Deterministic tests cover exact partition/coverage, barriers, two-worker bounds, isolated fresh
preparation, child failures and cancellation, workspace/output guards, and hostile join inputs.
Hosted completion requires the exact final PR head and a fresh successful main run. Historical
timeouts remain failures. The [CI-04 evidence](../proof/CI-FRESH-PROOF-PERFORMANCE.md) separates
focused local measurements and fixed-duration scheduling estimates from actual hosted results.
