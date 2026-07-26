# Runtime Core Reactive Reevaluation Proof

## Result

M04-T15 is **PASS** for the platform-neutral DESEN 0.1.0 runtime slice.

This proof establishes one bounded whole-surface reactive coordinator over the exact current
M04-T06 state, M04-T08 resource, and M04-T09 operation authorities. It also inserts a stale-safe,
detached settlement boundary in front of resource and operation lifecycle managers. Context and
environment subscriptions are invalidation notices only: every accepted reevaluation rereads all
seven runtime namespaces into one consistent immutable snapshot before invoking a trusted,
synchronous evaluator.

## What is proved

### Stale asynchronous settlements

- `createRuntimeReactiveHostPorts` first captures the complete M04-T01 aggregate through
  `createRuntimeHostPorts`, then wraps only operation and resource settlement callbacks.
- Each wrapped callback is invoked receiver-independently exactly once. Its synchronous or
  promise-like result is adopted by a native Promise before the lifecycle manager can inspect it.
- A successful value, candidate public-failure (`failed`), or denial crosses an exact closed
  envelope. Values are detached and recursively frozen; accessors, extra or symbol keys, malformed
  status values, cycles, reflection failures, throws, and rejection reasons fail without exposing
  host data. Catalog declaration of a candidate public error code remains the responsibility of
  the M04-T08/M04-T09 lifecycle manager.
- A settlement Proxy revoked before sanitization becomes a rejection with an undefined reason;
  its reflection exception is never exposed.
- A hostile Proxy may reenter while its result is being reflected. The older raw result cannot
  reach M04-T08 or M04-T09 until reflection and detachment finish, so the lower manager's existing
  current-attempt check observes a replacement generation first. The older resource or operation
  result therefore cannot overwrite the replacement.
- Every non-settlement port object remains the exact captured object. The wrapper adds no timer,
  transport cancellation, retry, cache, browser, framework, or native authority.

### One consistent whole-surface snapshot

- Mount requires factory-authenticated reactive host ports plus the exact current state, resource,
  and operation handles and snapshot objects for one document, revision, and surface.
- The T15 brand proves the stale-safe wrapper input and the documented correct integration
  pattern. Earlier public resource and operation managers do not expose their captured host-port
  identity, so T15 cannot authenticate that those managers were mounted with the same wrapper;
  the complete composed join and its proof belong to M04-T16.
- Each evaluator attempt samples complete state, context, resource, operation, unavailable-event,
  empty-item, and environment namespaces. It then samples the three manager identities and both
  detached host snapshots again. A mixed or regressed generation is never published.
- The evaluator receives only a frozen resolution snapshot, stable location/request metadata, and
  the token port needed by existing materialization. State mutation handles, lifecycle handles,
  the complete host aggregate, subscriptions, and adapter authority are absent.
- Evaluator output must be synchronous bounded JSON. Throws, Promise-like output, executable
  values, cycles, unsafe reflection, or over-budget data replace the prior active output with one
  controlled inactive result.

### Batching, stale-candidate rejection, and publication

- Multiple state, resource, or operation changes can be completed before one explicit
  action-turn invalidation. Context and environment callbacks likewise mark only a dirty bit; their
  callback arguments are never treated as snapshots.
- Reentrant invalidations coalesce while one synchronous drain is active. No timer, microtask
  scheduler, animation frame, DOM event loop, or platform queue is imported.
- The frozen 0.1.0 token port has no subscription. Token values are reread only when another
  admitted state, resource, operation, context, environment, or action-turn invalidation causes
  reevaluation; M04-T15 does not claim standalone token invalidation.
- Every evaluator attempt captures an invalidation epoch, exact state/resource/operation
  generations, and complete context/environment snapshot bytes. Authority is authenticated before
  callback entry, after callback return, and again after hostile result reflection. A candidate
  made stale at any of those points is discarded and reevaluated; it cannot become observable.
- Canonically byte-equal output retains the exact prior snapshot object and generation. A changed
  active or inactive result advances monotonically. Explicit ceilings prevent evaluator,
  observable-snapshot, invalidation, and synchronous-transition generation wraparound.
- DESEN 0.1.0 permits full-surface reevaluation when its observable result and finite limits are
  equivalent to a dependency-indexed implementation. M04-T15 deliberately proves that simpler
  strategy; it does not claim a dependency-index performance optimization or indexed-oracle
  equivalence. The end-to-end oracle belongs to M04-T16 and performance comparison remains
  M12-T05.

### Subscription and terminal ownership

- Context and environment are each subscribed exactly once. If the second subscription fails, the
  centralized revocation boundary clears every evaluator, host, manager, snapshot, and unsubscribe
  graph reference before the established first subscription is cleaned and mount returns an
  invalid result. Even a notice retained by the failed second subscription remains inert.
- Disposal uses the same boundary to mark authority revoked and clear that complete retained graph,
  installs a minimal private tombstone, and only then invokes the two cleanup callbacks. Cleanup
  throws and reentrant or late notices cannot restore authority.
- Repeated disposal is idempotent. The coordinator does not dispose state, resource, operation,
  action-turn, or adapter authorities; M04-T16 owns their complete session lifetime and order.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json`.
Its SHA-256 is `7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67`.

Generation refuses to run unless the reviewed M04-T05 through M04-T14 artifacts match their exact
SHA-256 bytes. The artifact byte-owns both M04-T15 source modules, both focused runtime test files,
the compiler-only type test, both modules' generated JavaScript/declaration/map files, and the
proof library, generator, verifier, and root hostile-mutation test.

Shared package indexes and manifest, traceability, normative coverage, findings, this proof
document, and the frozen reference Catalog are checked semantically rather than claimed as
task-owned bytes.

The evidence builder and verifier enforce:

- exact source-module and generated-module exports, exact package-root public export parity, no
  alias/wildcard/internal-authenticator leak, and forward-compatible unrelated root exports;
- TSDoc on every exported M04-T15 runtime and type declaration;
- 54 focused runtime cases from 39 registrations, 11 compiler-negative cases, deterministic
  double generation, and 30 independent root hostile-mutation tests;
- exact import allowlists plus zero React, DOM, browser, Node-global, native-framework, timer,
  dynamic-import, or dynamic-evaluation coupling;
- exact trace owners for `PIPE-023`, `R-046`, `R-053`, `R-059`, `R-103`, and `R-129`;
- live probes for detached success and failed settlements, revoked-Proxy redaction, revoked mount
  and invalidation inputs, batched state updates, complete context/environment rereads, stale
  reentry rejection, byte-equal snapshot retention, failed-subscription graph cleanup, retained
  notice inertness, and terminal exact-once unsubscribe.

M04-T15 changes no frozen protocol byte, Proof Matrix status, or normative status. At its
task-time boundary, `N-003`, `N-034`, and `N-041` were `PLANNED`; M04-T16 later advances N-003
monotonically to `TESTED`, while N-034 and N-041 remain `PLANNED`. P-17 and P-18 remain `PARTIAL`.
The required implementation profile decision is recorded by `PF-045`.

## Deferred composition

M04-T16 still owns complete validated surface traversal and materialization, the sign-in
tree/session, the M04-T14 handler-selector to M04-T13 prepared-program join, seven-namespace
event/item provenance, a public joint action-turn/reactive coordinator, complete descendant
resource/behavior/event/command inactivity, deterministic JSON sign-in traces, session disposal,
and the whole-surface observable reference oracle. Dependency-index equivalence and performance
comparison remain M12-T05, together with the remaining P-18 optimization evidence.

M05 owns React reconciliation, concrete component-instance preservation or remount behavior
including `use`, key, and remount-required prop changes, DOM/CSS/accessibility/focus behavior, and
production-adapter parity for N-034. Android and iOS adapters remain future platform
implementations over this framework-neutral contract. Dependency-index optimization and
cross-strategy performance comparison remain M12-T05.
