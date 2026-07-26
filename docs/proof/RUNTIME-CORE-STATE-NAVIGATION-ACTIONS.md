# Runtime Core State and Navigation Actions Proof

## Result

M04-T10 is **PASS** for the framework-neutral DESEN 0.1.0 runtime slice.

The proof establishes a fail-closed primitive for exactly one guarded `state.set`,
`state.toggle`, or managed-surface `navigate` action. It proves action-local observation order,
schema-safe state mutation, same-Bundle navigation containment, and the terminal lifetime created
by successful navigation. It does not claim the ordered multi-action program, operation/resource
settlement dispatch, rendering, or a complete application session.

## What is proved

### Mounted authority and snapshot provenance

- One executor captures an active document, exact Bundle revision, current surface, the trusted
  caller-supplied same-Bundle surface inventory declared complete, M04-T06 local-state authority,
  and framework-neutral host ports.
- Mount is inert: it validates and detaches the closed input without reading state values,
  resolving tokens, evaluating actions, calling navigation, or reporting diagnostics.
- Host-port capture is treated as a hostile reflection boundary. The exact T06 state authority is
  rechecked after capture, so a nested port Proxy descriptor trap that mutates or disposes state
  makes mount fail `invalid-state-authority` without invoking a host callback.
- Every execution requires the exact current manager-issued state snapshot object and a
  factory-created resolution snapshot whose complete `state` namespace equals that snapshot.
- Stale, foreign, and structurally ABA-equal state snapshots fail closed without action effects.
- M04-T10 proves only the state authority it owns. M04-T16 retains responsibility for complete
  same-turn provenance across context, resource, operation, event, item, and environment.

### Guard-first observation

- The executor safely reads and evaluates `when` before inspecting any action-specific payload.
- The busy transition guard is published before the first `when` property descriptor is observed.
  A Proxy descriptor trap can neither reenter a second action nor dispose the executor and let the
  outer action continue.
- A false guard returns `skipped` without observing hostile `path`, `value`, `surface`, `params`,
  extension, or type-specific accessors.
- A false guard cannot resolve a payload token, call navigation, perform an action-owned state
  mutation, or invoke the diagnostic callback. If a guard-token callback itself mutates state,
  exact-snapshot drift wins and the action cannot be reported as `skipped`.
- Invalid, unresolved, deferred, or token-failed guards return controlled inert results without
  payload effects.
- A false guard never invokes the diagnostic host callback, including when predicate evaluation
  returns controlled type-mismatch diagnostics as inert result data. When a later true-guard
  payload or type boundary does report, the diagnostic callback is observational: reentrant
  execution is controlled, and any state mutation or disposal performed by that callback is
  caught by the final exact-snapshot check before a write or navigation effect.
- A true guard proceeds using one action-local memoized token observation session. Repeated token
  names shared by guard and payload invoke the host token provider once and preserve deterministic
  first-observation order.
- Each token result is detached before caching, and the complete sorted set of distinct retained
  token results is rechecked against the M04-T02 aggregate JSON budget. When that action-wide
  budget is exhausted, the guard or payload phase returns `guard-rejected`/`payload-rejected` with
  runtime-safety reason `invalid`, later token providers are not called, and the condition is not
  mislabeled as an `ADAPTER_FAILURE`.
- Under the frozen M04-T03 boundary, a malformed or individually over-budget provider result
  remains an `ADAPTER_FAILURE` in either guard or payload. Evaluation stops at that token; later
  token providers and the action effect are not invoked. Only accumulation of multiple
  individually valid cached results is the T10 `invalid` aggregate-safety outcome.
- The package-internal `action-evaluation` seam owns safe `when` capture, bounded detached token
  caching, prepared-guard execution, shared-session ValueSpec materialization, sorted named-map
  materialization, and parameter-pointer remapping. It is imported by the action manager but is
  intentionally absent from the package root API; manager lifetime, effects, and final TOCTOU
  authorization remain the caller's responsibility.
- Token callbacks are hostile reentry points: immediately before a state write or navigation host
  call, the executor revalidates that the supplied M04-T06 snapshot is still the exact current
  state snapshot. A token callback that mutates or disposes state makes the prepared candidate
  stale; it cannot write over newer state or reach navigation.
- The same recheck applies before a false-guard result is accepted: a token used while evaluating
  a false guard cannot mutate state and leave the outer action reported as an ordinary `skipped`.
- Predicate preparation and evaluation remain the exact M04-T04 profile; token and string-format
  materialization remains the exact M04-T03 profile.

### Schema-safe `state.set`

- The action path and ValueSpec are captured only after the guard succeeds.
- The ValueSpec is materialized against the exact supplied resolution snapshot through the shared
  action token session.
- Invalid, unresolved, deferred, unsafe, cyclic, accessor-bearing, or over-budget values cannot
  reach the write boundary.
- The resolved candidate is delegated to M04-T06 `writeRuntimeSurfaceState`.
- Root replacement and nested object-property writes remain atomic. Missing parents, non-object
  parents, malformed paths, unknown entries, and schema-invalid complete post-write values are
  rejected without partial mutation.
- Canonically equal writes preserve the current generation; changed schema-valid writes publish
  the exact next immutable state snapshot.

### Exact-boolean `state.toggle`

- Toggle reads its leaf from the exact current state snapshot only after a true guard.
- The target must exist and be exactly a JSON boolean. Truthy strings, numbers, null, objects,
  arrays, missing paths, and inherited properties are not coerced.
- The inverse boolean is delegated through the same M04-T06 complete-entry validation and atomic
  write boundary.
- Toggle cannot bypass a conditional schema or mutate a detached historical snapshot.

### Same-Bundle navigation

- The target must be a declared managed surface in the captured active Bundle, including the
  current surface itself.
- An unknown, external, malformed, or non-local target is rejected before any parameter member,
  parameter token, or navigation callback is observed.
- That missing local entry is reported as the exact frozen core diagnostic `ENTRY_NOT_FOUND` at
  `/surface`; it is not reclassified as a host-policy denial or an adapter failure.
- If hostile action/type/target reflection disposes the executor while those fields are captured,
  disposal wins and the outer action returns `disposed` rather than publishing a stale validation
  result.
- After target authorization, parameter names are sorted and their ValueSpecs are materialized as
  one synthetic array. This gives the complete parameter object one atomic boundary and keeps a
  protocol-legal dollar-prefixed parameter name as ordinary data.
- The host receives a detached, recursively frozen request containing the active document,
  revision, current surface, deterministic runtime request identity, exact local target, and
  resolved inert parameters.
- Navigation and diagnostic callbacks are invoked without a receiver.
- Host denial reports `run.desen.runtime/NAVIGATION_DENIED` and never substitutes another target.
- A throw, Promise-like return, malformed closed result, accessor, or other adapter failure becomes
  a redacted `ADAPTER_FAILURE`; raw host data cannot escape.
- Navigation-result capture is itself a hostile reflection boundary. If a result Proxy disposes
  the executor, the outer result is `disposed`; if it mutates M04-T06 state, the outer result is
  `invalid-snapshot` and cannot publish success.
- Denial and technical failure leave the current executor and local state active.

### Terminal success and disposal

- A successful host navigation result becomes terminal for both this state/navigation executor
  and its captured M04-T06 state lifetime.
- Terminal transition occurs for same-surface navigation as well as navigation to another managed
  surface.
- State disposal and executor disposal are observable before successful completion is returned.
- A reentrant host callback cannot execute a second action during the transition.
- Explicit disposal is terminal and idempotent, clears retained authority, and prevents later
  action, token, navigation, or diagnostic effects.
- Successful navigation and explicit disposal replace the live WeakMap authority with a frozen
  minimal tombstone. The tombstone retains no host callbacks, state snapshot, state handle, or
  surface inventory while preserving deterministic late-execute and repeated-dispose results.
- M04-T13 later composes T10–T12 action, resource, operation, command, and event lifetimes into
  ordered turns. Node/behavior bridge, reactive, and complete session disposal remain distributed
  across M04-T14–T16, with the complete coordinator owned by M04-T16.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json`.

Generation refuses to proceed unless all four reviewed prerequisites match their exact bytes:

- M04-T03 token and format materialization:
  `be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f`
- M04-T04 predicate evaluation:
  `14b74cd4f0c35e76edd77858443edf8515b3a60a247afe75131095d5a0c3bcf1`
- M04-T06 local state and identity:
  `4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13`
- M02-T11 execution contracts:
  `f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`

The byte-owned evidence set contains the state/navigation manager, its package-internal
`action-evaluation` seam, focused tests, compiler-negative tests, both modules' four distribution
outputs, three task proof scripts, and the root mutation suite. Shared manifests, package indexes,
traceability ledgers, findings, and this explanatory document are verified semantically but
deliberately are not byte-owned by M04-T10.

The evidence builder derives focused cases from test syntax, including every `it.each` row, and
derives compiler-negative cases from described `@ts-expect-error` directives. It also checks:

- exact public runtime and type exports in source, declarations, distribution, and package
  indexes, plus exact internal seam exports that never leak from the package root;
- TSDoc on every public declaration;
- exact source imports and focused package command;
- absence of framework, browser, Node-host, native-host, timer, randomness, network, and dynamic
  evaluation dependencies;
- byte-identical generation and atomic artifact replacement;
- live hostile probes for mount authority, exact snapshot identity, guard-first non-observation,
  shared token memoization, schema-safe set, exact-boolean toggle, local-target-before-params,
  post-token TOCTOU revalidation, closed host requests, denial, adapter containment, receiver
  independence, reentry, successful terminal navigation, explicit disposal, and late calls; and
- root hostile mutations of semantic ordering, callbacks, exports, TSDoc, portability, and test
  inventory.

## Trace ownership

M04-T10 directly verifies its exact ownership in:

- `R-074` — `state.set` leaves the complete declared entry schema-valid;
- `R-075` — `state.toggle` accepts only an exact boolean state path;
- `R-076` — core navigation targets an existing managed surface in the same Bundle;
- `R-105` — local navigation uses host policy and denial cannot substitute success; and
- `R-122` — every navigation remains subject to current host policy.

Guard evaluation is exercised through the M04-T04 prerequisite and runtime composition, but its
existing trace ownership is not reassigned to M04-T10.

PF-040 remains **OPEN** because DESEN 0.1.0 does not normatively define guard/payload observation
order, action-local token sessions, exact snapshot composition, navigation request identity,
denial/failure result shapes, same-surface navigation, or the terminal disposal boundary selected
by this deterministic profile. The proof preserves the related OPEN boundaries in PF-017,
PF-019, PF-031, and PF-039.

## Deliberate non-claims

This proof does not yet establish:

- ordered action arrays, batching, rollback, or the 64-action limit;
- repeated synchronous transition limits or nested settlement depth;
- operation invocation, settlement handler selection, or resource refresh action integration;
- component command, outbound event, or behavior dispatch;
- complete same-turn cross-manager provenance;
- remaining manager disposal after navigation;
- adapter rendering, history, focus, animation, accessibility, deep links, or external URLs;
- redirect, retry, persistence, or physical routing cancellation; or
- normative resolution of PF-017, PF-019, PF-031, PF-039, or PF-040.

Those boundaries keep a single guarded action primitive from being presented as the complete
DESEN action runtime.
