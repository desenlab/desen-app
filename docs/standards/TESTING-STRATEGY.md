# Testing Strategy

Last reviewed: 2026-09-10

## Purpose

Tests support bounded claims about the DESEN 0.1.0 Web–React reference implementation. A passing
test proves only its declared inputs, target, and observation boundary; it does not imply production
readiness, universal interoperability, or native-platform support.

## Test layers

1. **Package unit tests** exercise public and internal behavior near its owner.
2. **Compile-time tests** reject invalid TypeScript usage and API widening.
3. **Root proof tests** independently read built outputs and immutable evidence, including mutation
   and negative cases.
4. **Boundary fixtures** prove allowed and forbidden dependency edges.
5. **Integration tests** join multiple public packages without importing application internals.
6. **Browser journeys** observe the real built product, control plane, and independent host through
   Chromium.
7. **Hosted CI** executes the reviewed workload authority on the exact candidate revision.

Lower layers provide fast diagnosis. Higher layers do not replace them; they prove different
composition and environment boundaries.

## Evidence hierarchy

From strongest to weakest for a claimed end-to-end behavior:

1. passing exact-head hosted checks plus a fresh passing `main` run;
2. deterministic browser or process evidence over production builds;
3. independent root proof and mutation tests over built public packages;
4. package/integration tests;
5. static source or dependency analysis; and
6. manual observation, screenshots, or video.

Screenshots and video may explain a result but are never the sole proof. Local success cannot be
reported as hosted closure. A new commit invalidates an earlier exact-head hosted result.

## Positive and negative coverage

Every task adds or retains:

- at least one admitted path that demonstrates the requested behavior;
- relevant rejection paths at each new trust or lifecycle boundary;
- atomicity checks when failure must preserve prior state;
- limit and malformed-input checks for new untrusted data;
- deterministic ordering or identity checks where output is content-addressed; and
- regression coverage for any defect found during implementation.

Tests should assert public observations and stable diagnostics. They must not pass by inspecting
private component structure, relying on incidental object identity, truncating unsupported input,
or converting a failure into a placeholder success.

## Frozen inputs and proof artifacts

The upstream DESEN 0.1.0 snapshot and task-time proof artifacts are immutable. Verification may
authenticate them, project reviewed fields, and compare current readers; it must not regenerate
historical success from changed inputs.

Proof artifacts are deterministic JSON with explicit profile, task, inputs, claims, tests, limits,
and digest. A proof document explains the same boundary for humans. The Proof Matrix links claims
to their exact artifact and verifier. Reader checkpoints authenticate current proof code without
rewriting earlier artifact bytes.

## Isolation and repeatability

- Tests use temporary roots or dedicated `.desen/**` profiles, never a developer's ordinary
  projects.
- Local HTTP fixtures bind only reviewed loopback origins and use synthetic credentials/data.
- Parallel work must not share mutable build, database, port, or evidence destinations unless an
  explicit barrier serializes them.
- A test must clean up listeners, processes, databases, browser contexts, and temporary files.
- Order, locale, clock, randomness, IDs, and scheduler behavior are fixed or injected when they
  affect evidence.
- Generated output is rebuilt from current source; cached success is never proof authority.

## M10 browser-proof profile

Root `pnpm test:e2e` runs nine independent Playwright configurations. Each owns its build profile,
storage, ports, and assertions:

1. empty-project authoring, native insertion/reordering, persistence, and Design/Run parity;
2. normal-product blank-project creation, reopen, save, and reload;
3. controlled input and real pending lifecycle;
4. declared failure, retry, and stable visible layout;
5. synthetic success plus explicit real Integration and managed navigation;
6. two Save → Publish → Activate cycles with an unchanged independent host;
7. invalid prop/event/slot publication rejection with the valid revision preserved;
8. corrupt/Catalog-mismatched candidate recovery across complete process restarts; and
9. two clean demo resets producing identical canonical output before a visible update.

The journeys use normal product controls for their required designer path. Advanced Source is used
only for explicitly declared negative inputs. Browser tests do not inject a successful Source,
intercept operations, or manually compose the managed React tree.

## Runtime Core baseline

M10 freezes the complete committed `packages/runtime-core` tree as
`3fa3613a3be63c749f40b6a0b55af5b40c675773`. M11 tests must compare the current committed tree, index, and working
bytes with that authority. Staged, unstaged, untracked-Core, hidden-index, missing-object, and
identity drift fail closed. Ignored build output and unrelated workspace changes do not create a
false Core change.

The baseline proves byte identity only. M10A also preserves this authority; every M10A task and
M11 branch still runs fresh capability, integration, negative, and browser tests.

## Planned M10A product acceptance

M10A coverage is not part of the nine completed M10 journeys yet. The
[task contracts](../plan/M10A-TASK-CONTRACTS.md) assign new tests and artifacts to each owner.
G10A joins three blank-project design-first journeys, master/instance and theme persistence,
separate connection drafts, later same-Source execution, and complete design-system release rollback.
The [workbench](../plan/DESIGN-SYSTEM-WORKBENCH.md) adds deterministic scenario capture and explicit
baseline review; a screenshot approval cannot suppress structural, behavior or accessibility failures.
Fresh browser/environment/source/catalog/theme/font/asset identities must accompany visual results.
No new external interview or pilot recruitment is required to execute these engineering checks.
Adding tasks never reclassifies old failing evidence as success or removes existing M10 tests.

## Local commands

For an ordinary task, first run its focused tests and verifier, then the bounded baseline:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm boundaries
node scripts/ci/verify-proof-reader-checkpoints.mjs
```

Use `pnpm check` for a complete local compatibility audit or gate closure. Use `pnpm test:e2e` for
all nine M10 browser journeys. Package-level scripts remain available for focused diagnosis.

## Hosted CI contract

Pull requests use the reviewed required-workload route. An exact, complete, trusted diff may select
a proven affected subset; unknown, ambiguous, unowned, frozen-input, policy, dependency, or unsafe
changes expand to exhaustive execution. `main`, release, manual audit, and untrusted boundaries are
always exhaustive.

Exhaustive proof work runs in three isolated shards and joins in a fresh closing Quality gate.
Browser E2E is a separate required job. Cancellation, timeout, skipped required work, tracked-byte
drift, or shard disagreement is failure.

## Coverage policy

Coverage percentages are diagnostic, not a substitute for claim ownership. New code should keep
the owning package's thresholds and cover meaningful branches. Security, authority, serialization,
and failure-state code requires explicit adversarial cases even when line coverage is already high.

The authoritative inventory contains 241 logical workloads and 114 proof pairs; the hosted
exhaustive topology expands to 264 physical shard workloads. Thirteen exclusive barriers protect
shared state, including T01's three Chromium cases on isolated port 4187 and T03's four workbench
cases on isolated port 4188; the nine M10 journeys remain.

## Historical archive privacy

Historical bridge artifacts may retain technical evidence only. Private social drafts, credentials,
personal data, and customer prose are forbidden. Current generators and readers must preserve the
AR-01 redaction boundary; a historical hash never authorizes republication of removed prose.

## Historical detail

The complete task-by-task M01–M10 testing narrative remains in Git history and task-owned proof
documents. The immutable archive pointer is owned by
[Documentation Standards](DOCUMENTATION-STANDARDS.md#document-lifecycle-and-ownership).
