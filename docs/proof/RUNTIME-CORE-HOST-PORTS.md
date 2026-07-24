# Runtime Core Host-Port Evidence

## Claim

M04-T01 defines one explicit, framework-neutral boundary between the DESEN runtime core and
trusted host application code. The boundary contains nine ports and fourteen callbacks for:

- local managed-surface navigation;
- immutable Bundle and atomic activation storage;
- trusted operation and resource implementations;
- target-owned token resolution;
- non-secret context and runtime environment snapshots;
- deterministic host time; and
- safe diagnostic observation.

This TypeScript API is a narrow DESEN 0.1.0 reference implementation profile. The frozen protocol
assigns these responsibilities to the host but does not standardize this transport API, its
settlement envelope, or the repository's activation generation record.

## Public boundary

`@desen/runtime-core` exposes exactly one runtime value, `createRuntimeHostPorts`, and thirty
public types. All thirty-one public declarations have TSDoc. The source entry point, built entry
point, declarations, source maps, package export map, and actual runtime module export keys are
checked as exact inventories rather than substring matches.

| Port          | M04-T01 contract                                                                   |
| ------------- | ---------------------------------------------------------------------------------- |
| `navigation`  | Synchronous success or policy denial after runtime target validation               |
| `storage`     | Immutable Bundle bytes and one compare-and-swap activation record                  |
| `operations`  | Candidate success JSON, candidate declared public failure, or policy denial        |
| `resources`   | The same controlled result envelope for a trusted read implementation              |
| `tokens`      | Synchronous exact-name resolution, distinguishing missing from resolved JSON null  |
| `context`     | Complete non-secret JSON snapshot plus an invalidation subscription                |
| `environment` | Complete JSON snapshot for reserved and profile-defined `env.*` paths              |
| `clock`       | Injected Unix-epoch millisecond observation without a platform-global clock read   |
| `diagnostics` | Portable inert `DesenDiagnostic` observation without raw errors or provider values |

Operation and resource success values remain untrusted until later runtime tasks detach and
validate them against the exact capability schema. A candidate public error code must likewise be
checked against the Catalog. Host policy denial is a distinct outcome and cannot be converted into
success.

## Stable composition

`createRuntimeHostPorts` requires exactly the documented ports and callbacks as own data
properties. It rejects missing, extra, inherited, accessor-backed, non-callable, and
reflection-hostile shapes without executing getters. It captures all fourteen callback identities
without invoking them, returns frozen port snapshots, and does not freeze or mutate caller-owned
objects.

Identity preservation means the factory does not wrap methods to restore an object receiver. Every
callback therefore has an explicit `this: void` contract: applications must provide an arrow
function, a receiver-independent function, or a function bound before composition.

## Data and persistence boundaries

Requests, controlled outcomes, context, environment, diagnostics, and later observable state are
restricted to JSON-compatible data. TypeScript is not treated as a trust boundary; later execution
tasks still own runtime detachment, hostile-value rejection, schema validation, exception
containment, and trace redaction.

Bundle storage is the one deliberate binary transport. It is restricted to revision-addressed
immutable bytes. Activation persistence is one atomic
`{ activeRevision, previousGoodRevision, generation }` record guarded by compare-and-swap. The port
cannot store arbitrary design-selected keys or user-input state. Concrete storage, byte
verification, staging, restart recovery, and fault injection remain M07 responsibilities.

The environment reserves these paths without inventing protocol value enums:

```text
env.viewport.width
env.viewport.height
env.viewport.orientation
env.pointer
env.colorScheme
env.reducedMotion
env.locale
env.platform
```

## Portability and security evidence

The source has no runtime dependency and imports only `DesenDiagnostic` as an erased type from
`@desen/protocol`. Source, declarations, and built JavaScript reject React, React Native, DOM, CSS,
browser, Node, platform-global, dynamic-import, and executable-evaluation surfaces. The exact
package export map prevents an alternate root or undeclared subpath from bypassing the reviewed
entry point. No A2UI dependency enters the runtime core.

The deterministic evidence suite covers:

- 10 focused package tests, including the five expanded invalid aggregate cases;
- 9 compiler-negative cases for JSON, result-envelope, complete-port, and callback-receiver
  boundaries;
- 10 independent root tests for deterministic evidence, tampering, forged factories, exact
  exports, TSDoc, forbidden imports/evaluation, package wiring, trace ownership, prerequisite
  drift, symlinks, and atomic-write substitution;
- 7 trace responsibilities: `R-041`, `R-046`, `R-089`, `R-105`, `R-106`, `R-122`, and `D-026`;
  and
- exact SHA-256 records for 16 task-owned source, test, distribution, and proof files.

Test inventory is derived from direct, unconditional test registrations. Removed, skipped,
renamed, nested, or conditionally disabled registrations cannot retain the previous evidence
count.

## Evidence commands

```text
pnpm generate:runtime-core-host-ports
pnpm verify:runtime-core-host-ports
pnpm test:runtime-core-host-ports
```

The commands first verify the exact M03-T10 capability artifact, then build and typecheck
`runtime-core`, run the focused package suite, and generate, verify, or mutation-test the M04-T01
receipt.

Tracked receipt:

```text
docs/proof/artifacts/runtime-core-0.1.0-host-ports.json
```

Verified prerequisite:

```text
docs/proof/artifacts/reference-catalog-web-capability-artifact.json
sha256:247e90b57b673a079da2ea95fe168637ee7f09f2681005746f7a9ab76721bb45
```

The verifier reports the M04-T01 receipt SHA-256. `PROJECT-STATUS.md` and `PROOF-MATRIX.md`
record that final value without duplicating task-owned file hashes here.

## Boundaries

M04-T01 proves the host contracts and their stable composition. It does not yet prove:

- literal/reference/fallback or token-format resolution;
- state, repeat, predicate, variant, or style evaluation;
- resource and operation lifecycle, concurrency, or settlement actions;
- navigation execution or diagnostic behavior;
- allowlisted `event.emit`, component commands, or generic adapter bridges;
- storage implementation, Bundle activation, rollback, or last-known-good recovery;
- React, browser, iOS, or Android adapters; or
- a complete framework-neutral sign-in runtime.

Those responsibilities remain assigned to M04-T02 through M04-T16, M05, and M07. The exact
nine-port aggregate is the M04-T01 slice; M04-T12/M04-T14 must make any event/command bridge
extension intentional and reviewed. No Proof Matrix, normative-coverage, or proof-gate status
changes in this task.
