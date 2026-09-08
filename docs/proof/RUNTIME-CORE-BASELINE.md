# Committed Runtime Core baseline

Task: M10-T09

Status: DONE (conditional closure candidate; exact-head hosted checks remain required)

## Scope

Record the complete committed Git tree at `packages/runtime-core` for comparison during the two
M11 capability branches. The capture revision is the completed M10-T08 main commit
`61bfda591a25558193c94e1d0d6a9bb95af6d00d`; its Git SHA-1 tree is
`3fa3613a3be63c749f40b6a0b55af5b40c675773`.

This includes source, tests, README and package configuration, not just public exports or a
selection of source files. No Runtime Core file is changed by this task. The exact Git tree is the
comparison baseline; it is not a new runtime implementation, generated code snapshot or cached
test result. The write-once artifact is `artifacts/runtime-core-baseline.json`.

The actual capture contains seven closed fields in 271 canonical UTF-8 bytes, with artifact
`sha256:fbda58d72ccff36d530368422dd7fd82c73dcca359c29e3a6667e8ae4b9b424b`.
Its profile is `desen.runtime-core-baseline.v1`; it records identity only, without a timestamp or
a test-success field. The current Core tree has 61 tracked files. The capture, its independent
generic Git comparison and the default checkpoint-authenticated verifier pass.

## Verification boundary

The current checkout must have the same committed Core tree, stage-zero index identities/modes,
and freshly checked working bytes. Staged edits, unstaged edits, deleted or new source files,
index flags hiding changes and source files hidden by ignore rules cannot claim an unchanged core.
Ordinary ignored build output and dependencies remain allowed, as do unrelated changes outside
Core. Read-only Git commands use fixed argument structure, bounded output/time and sanitized
environment configuration; no fetch, checkout, reset or index update is part of verification.

The original capture commit is provenance authenticated by the frozen artifact, not an ancestry
dependency. A later shallow checkout verifies its own current Core tree without fetching that
historical commit. Fresh identity checks before and after acquisition reject observed changes
during verification. This is an owned developer-checkout boundary, not a security guarantee
against a hostile administrator controlling the running process or its filesystem.

## Evidence and limits

The final twelve real-Git test groups pass in 27.997 seconds with zero skips or cancellations.
An initial twelve-group run also passed in 30.54 seconds before the final missing-blob and hostile
byte-view negatives were added. Tests cover the whole committed tree, unrelated changes, a shallow
checkout whose capture commit is unavailable, content/add/delete/mode changes, index-only edits,
hidden flags, ignored source, strict artifacts and immutable writes, missing Git/objects, an actual
five-second Git deadline, environment isolation, and observed HEAD/index/working-file races.
Every fixture is an owned OS-temporary repository; no production Core file is mutated by the tests.

Independent review tightened bounded artifact reads, rejected byte-view getters without invoking
them, added existence/type checks for committed blobs, and normalized missing writer-parent errors.
The final tested reader is 21,423 bytes at
`sha256:21246b72a424cf673aa0d704560df7d0f481719e5cde195161eb3477ef9c5aad`; its root is 24,648
bytes at `sha256:808b2d7cab335b65e0041ecc09b2483bc60bb6563a83e9c28c1498f544f0de78`.
An initial exact guarded root run failed before Git spawned: Node's permission-aware test harness
adds inherited process options to the child environment, while the reader passed its frozen
sanitized record directly. The private process boundary now supplies a fresh copy of that same
record; the public sanitizer remains immutable. No environment allowlist, filesystem permission,
child-process grant, timeout, assertion or test group was widened or removed. The earlier failed
guarded observation is not a successful receipt. The corrected default verifier and all twelve
roots pass under exact CI permissions (31.872 seconds for the roots), with compiled outputs
unchanged. Formatting, lint, typecheck, build and all 52 boundary fixtures pass (879 modules /
3,787 edges). The complete current CI/retained-runner batch passes 507/507 in 28.952 seconds,
with zero skips, cancellations or failures. All preceding 498 contracts remain; nine new contracts
cover the added baseline authority. The focused impact/selector suites pass 81/81.

Checkpoint 79 appends only the new baseline artifact and reader/root pair at
`sha256:06fa67b106c1a8056e5c26cfcc1a78e29a00cc1b793217b1c48c60fbec9bce8e`.
All 78 merged predecessors, 62 earlier artifacts and 124 earlier readers remain unchanged.
The candidate first requires review against trusted checkpoint 78 and is refused as live authority
before the explicit reviewed pin. The live checkpoint passes with 63 artifacts / 126 readers;
all 113 checkpoint contracts pass in 3.53 seconds. The corrected reader replaced only the
unmerged candidate's T09 receipt; no merged checkpoint was rewritten.
CI preserves all preceding work and adds two logical workloads: 228 workloads / 109 proof pairs,
245 physical workloads, 98 ordinary pairs and eleven exclusive barriers. All nine browser journeys,
two workers per shard, and hosted deadlines remain unchanged. This task does not replace the
full G10 run with a seal check.

Exact-head PR checks, merge and fresh main are required for task completion. M11 capability
extensibility is not yet proven; G10 remains open and separately requires the complete local
quality gate. No protocol or runtime semantics change.

The task remains active until that hosted closure succeeds. The user requested a pause immediately
after T09 closes: do not start G10 or its long local run without a new instruction.

The T09 root-command additions and T08 closure documentation passed all four existing direct
T05/T06/T07/T08 verifiers without changing any of their readers or frozen artifacts. Those fresh
compatibility observations are not a substitute for this task's new tests or hosted completion.
