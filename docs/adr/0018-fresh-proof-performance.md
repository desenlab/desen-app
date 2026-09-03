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
