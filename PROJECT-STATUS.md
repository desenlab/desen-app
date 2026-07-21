# Project Status

Last updated: 2026-07-21

## Plain-language status

Local implementation preparation is complete and the private GitHub repository is active at
`desenlab/desen-app`. The first remote CI run passed. M02-T01 also completed the first narrowly
scoped proof claim: the implementation now consumes an exact, checksum-enforced DESEN 0.1.0 input
snapshot. Validator and runtime semantics have not started and are not claimed as proven.

## Current milestone

- Completed gates: `G00`, `G01` (`G01` is explicitly local-only)
- Completed preparation tasks: `M01-T07 — Local tracked baseline`, `M01-T08 — Remote and CI`
- Current milestone: `M02 — Protocol package and validator`
- Completed implementation task: `M02-T01 — Frozen snapshot and checksum enforcement`
- Active task: None
- Ready next task: `M02-T02 — Trace remaining normative prose and schema constraints`
- Status: `READY_TO_START`

## Completed preparation

- Product naming and domain responsibilities are defined.
- Web-first and future-native architecture boundaries are defined.
- The current npm `desen` package state is recorded without destructive changes.
- The workspace quality toolchain, exact lockfile, and package boundaries work locally.
- The local baseline commit is authored and committed only as Selman Ay, and a temporary clean clone
  passes the locked install and full quality gate.
- The private `desenlab/desen-app` remote is configured and its first `main` CI run passed.
- The implementation milestones, exact `web-react` conformance targets, clause owners, and proof
  claims are defined.
- The frozen protocol baseline was rerun with 14/14 suite cases passing: 9 vectors + 5 examples.
- The foundation passes formatting, lint, strict typecheck, build, protocol integrity tests,
  remaining scaffold test runners, and dependency-boundary checks.

## Current blocker

No technical blocker. The following release-hygiene item remains and does not block implementation:

- The upstream repository still lacks a `v0.1.0` Git tag, but the exact commit and checksum are
  sufficient for deterministic local work. Tag creation remains release hygiene under `PF-004`.

## Next task

Complete only `M02-T02`: trace every in-scope schema constraint and normative prose rule not
represented by the BCP 14 ledger to an owning task and future test. Do not generate types or begin
validator implementation in the same task.

## Status vocabulary

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

Only one implementation task may be `IN_PROGRESS` at a time.
