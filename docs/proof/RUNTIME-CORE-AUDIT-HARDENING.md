# Runtime Core Audit-Hardening Proof

## Result

M04-T17 evidence proves the post-audit G04 hardening boundary. `M04-T17` and `G04` are `DONE`.

The runtime now emits one bounded package-internal settlement-completion notice after accepted T13
operation and resource settlements finalize. The headless session consumes that notice through its
existing T15 invalidation/publication path, without recognizing the reference sign-in operation or
observing an application-specific promise.

## Runtime boundary

- `subscribeRuntimeActionTurnSettlements` and its publication types remain module-visible only and
  are absent from the package root.
- `subscribeRuntimeHeadlessSession` and `unsubscribeRuntimeHeadlessSession` are public,
  receiver-independent snapshot-store seams. Their factory-authenticated subscriptions are finite,
  idempotently revocable, callback-free in public snapshots, and bounded by `maxSubscriptions`.
- Focused runtime fault injection covers recursive success, declared failure, stale replacement,
  callback reentry, duplicate and late notification, disposal, failed publication, finalization,
  generation limits, and retained-listener limits.
- All runtime production imports remain confined to relative runtime modules, `@desen/protocol`,
  and `@desen/validator`; no React, DOM, or browser module enters the package.
- The focused audit inventory passes 77 cases from 69 registrations, including 14 negative cases;
  the cumulative runtime-core package suite passes 649/649.

## Historical compatibility migration

The following historical task-time artifacts remain byte-identical:

- M02-T08 component contracts:
  `sha256:71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac`
- M04-T13 action turns:
  `sha256:5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87`
- M04-T14 adapter bridges:
  `sha256:bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7`
- M04-T15 reactive reevaluation:
  `sha256:7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67`
- M04-T16 headless sign-in:
  `sha256:bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4`

M04-T17 owns the current compatibility verifiers and hostile root tests for the transferred
M02-T08 and M04-T13 through M04-T16 boundaries without rewriting their task-time artifacts. The
T17 verifier independently hashes all five current artifact files before accepting its own proof.
The component compatibility projection remains N-026/N-028/N-029 `TESTED` at the M02-T08
boundary, while current truth is N-026 `PLANNED`, N-028 `TESTED`, and N-029 `PLANNED`. PF-049
binds both corrections to 2026-07-27 and leaves M05-T02 for N-026 and M05-T03 for N-029 as the
final receiving-boundary owners.

## Evidence artifact

`docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json`
`sha256:cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa`.

The final SHA is accepted only in this exact section and in the exact
`M04-T17 / G04 audit hardening` Proof Matrix section. The builder and atomic generator may use the
pending marker; the production verifier rejects pending, moved, duplicated, or mismatched pins.

## Nonclaims

This proof does not rewrite historical artifacts, close M05 receiving-schema work, add a framework
adapter, claim DOM/React behavior, or change the frozen DESEN 0.1.0 protocol bytes.
