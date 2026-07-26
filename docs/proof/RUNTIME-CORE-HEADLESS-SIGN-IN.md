# Runtime Core Headless Sign-In Proof

## Result

M04-T16 and proof gate G04 are **PASS** for the platform-neutral DESEN 0.1.0 runtime
slice.

This proof composes the independently proved M04-T03 through M04-T15 authorities into one
bounded headless session. The frozen sign-in bundle is validated at unknown ingress,
matched to the exact validated Catalog contracts and Bundle revision, materialized without
a renderer, exercised through its declared adapter events, and observed only through
deterministic JSON snapshots and trace entries.

## What is proved

### Validated ingress and authenticated package identity

- Unknown bundle and Catalog inputs cross the validator boundary before any runtime
  authority is created. The document, surface, Catalog ID, and revision must match exactly.
- The bundle's compact commitment and opaque evaluation-bound sidecar are authenticated before the
  materializer can use component, behavior, handler, action, resource, or operation
  declarations.
- The reference Catalog package digest is treated as an illustrative frozen fixture. This
  task does not claim a production package-signature or registry-trust implementation.

### Complete headless materialization

- The complete validated surface is traversed under finite node, depth, repeat, JSON, and
  transition ceilings. Conditional absence excludes the entire descendant subtree before
  state, resource, behavior, event, or command work can become active.
- The session uses one factory-authenticated reactive host aggregate for resource,
  operation, and reactive lifetimes. A second structurally equivalent aggregate cannot
  satisfy that join.
- Every incoming handled event derives its origin from the exact current component or
  behavior binding. State, context, resource, operation, event, item, and environment
  namespaces are assembled from their respective authenticated owners; caller-supplied
  namespace or runtime-instance claims are not accepted.
- The inert M04-T14 handler selector is resolved against the validated sidecar and joined
  to exactly one M04-T13 prepared action program. Raw programs, sidecar tables, host ports,
  lifecycle handles, tickets, and callbacks never enter the public snapshot or trace.

### Sign-in behavior

- The frozen sign-in surface begins with its failure subtree absent and both text fields
  materialized from local state.
- Email and password change events update the exact local-state paths. A press event
  invokes only the declared sign-in operation with detached values from the current
  seven-namespace scope.
- Success publishes loading and then performs one atomic settlement-to-home handoff; it
  does not expose an intermediate succeeded sign-in snapshot. Failure publishes the
  declared public error and activates only the failure subtree. Retry clears/replaces the
  older failure attempt without admitting an older stale settlement.
- Replacement and reentrant settlement races cannot overwrite newer state, output, or
  navigation. A settlement that cannot be observed through M04-T13 still requires an
  explicit admitted invalidation; this task does not claim generic automatic invalidation
  for arbitrary future nested settlement programs.

### Deterministic observable boundary

- The observable snapshot and trace are detached, recursively frozen bounded JSON.
  Round-tripping through JSON preserves them exactly and finds no executable value,
  symbol, bigint, platform object, DOM node, React value, native handle, or authority
  object.
- Success, failure-then-retry, and stale-replacement each run in two fresh independent
  sessions. Every scenario pair produces byte-identical RFC 8785 canonical trace bytes and
  the same per-scenario SHA-256 digest; their combined six-run callback-free JSON trace is
  independently canonicalized and hashed. Trace ordering comes from admitted runtime
  transitions rather than timers, wall-clock time, browser queues, or framework
  scheduling.
- Hostile mutation, accessor, Proxy, stale-ticket, foreign-handle, invalid-limit,
  post-disposal, and retained-callback cases fail closed without partial publication.
  Current terminal T15 faults dispose the session.
- Coordinated disposal revokes T15 first, then T14 (deferred until callback unwind when
  busy), then T13, while clearing the composed authority graph and disposing child
  managers exactly once. Repeated disposal is idempotent and late callbacks remain inert.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json`.
Its SHA-256 is `bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4`.

Generation refuses to run unless the reviewed M04-T03 through M04-T15 proof artifacts
match their exact SHA-256 bytes. The artifact byte-owns the M04-T16 source modules,
focused runtime and compiler-negative tests, their generated JavaScript/declaration/map
outputs, and this proof package's library, generator, verifier, and root hostile-mutation
test.

Shared package indexes and manifests, traceability, normative coverage, findings, proof
matrix, this proof document, and the frozen reference bundle and Catalog are checked
semantically instead of being claimed as task-owned bytes.

PF-047 keeps the frozen M02 traceability ledger as a historical planning baseline instead
of rewriting it as completion truth. The artifact inventories all 72 baseline rules (6
owner assignments and 70 test assignments), then classifies 67 as currently applicable to
M04-T16 and defers five overassignments: R-048 to M05-T02, R-104 to M05-T05, R-129 to
M12-T05, A-011 to M05-T08/M06-T11/M12-T08, and D-009 to M05-T06/M06-T11.

PF-048 preserves the byte-identical M02-T09 interaction artifact at
`sha256:981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208`.
That historical artifact continues to project N-033 and N-034 as they stood at M02-T09,
while its current verifier accepts only monotonic `PLANNED` to `TESTED` progression and
rejects unknown or regressive status. The same ownership transfer preserves the
byte-identical M03-T09 reference-parity artifact at
`sha256:6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a`;
its historical projection remains `PLANNED` for N-033 while its current verifier admits
only the exact N-033 `PLANNED` to `TESTED` advance. M04-T16 explicitly takes byte
ownership of both current compatibility verifiers and both historical root tests, so
preserving either old artifact never creates an unowned verification exception.

The evidence builder and verifier enforce:

- 7 public runtime exports, 22 public type exports, 35 source-module declarations with
  TSDoc, 34 focused runtime tests from 34 registrations, 11 compiler-negative cases, and
  24 independent root proof/mutation tests;
- exact source-module and package-root exports with TSDoc on every exported M04-T16
  runtime and type declaration;
- exact import allowlists and zero React, DOM, browser, Node-global, native-framework,
  timer, dynamic-import, or dynamic-evaluation coupling;
- unknown-ingress validation, exact revision/Catalog matching, same-host aggregation,
  compact-commitment and sidecar authentication, seven-namespace event provenance,
  selector-to-program joining, absent-subtree inactivity, finite limits, and centralized
  disposal;
- live success, failure, retry, stale-race, navigation, hostile-mutation, deterministic
  trace, JSON round-trip, and post-disposal probes;
- an exact 72-rule audited M04-T16 trace-assignment baseline, its corrected 67-rule current
  applicability projection, and explicit classification as M04-T03–T15 prerequisite,
  M04-T16 integration, or future-deferred evidence;
- four explicit historical-verifier ownership transfers, the immutable M02-T09 and
  M03-T09 artifact bytes, and hostile mutations of both current transferred verifier/test
  boundaries;
- byte-identical evidence generation and independent root mutations covering every
  task-owned or semantic boundary.

## Status decisions and nonclaims

M04-T16 and G04 become `DONE`. `N-003` becomes `TESTED`, because the headless runtime now
demonstrates deterministic reevaluation, action dispatch, asynchronous replacement
fencing, and JSON-observable output over the frozen sign-in flow.

P-17 and P-18 remain `PARTIAL`. P-18 cannot become `PROVEN` until the independent M08-T10
artifact round-trip gate is complete. The proof does not claim a renderer, Web–React
adapter, DOM/CSS output, accessibility tree, focus behavior, or production adapter
command parity; those belong to M05. React instance reconciliation and remount semantics,
along with Android and iOS adapters, remain later platform work.
