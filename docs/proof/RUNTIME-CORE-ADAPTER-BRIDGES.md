# Runtime Core Adapter Bridges Proof

## Result

M04-T14 is **PASS** for the platform-neutral DESEN 0.1.0 runtime slice.

The proof establishes a two-phase generic adapter boundary. A bridge is created before M04-T12 so
its component-command callback can be captured by one exact command/event port owner, and it binds
after M04-T12 only when the same Catalog object, current snapshot, port aggregate, callback owner,
document, revision, and surface all match. Component commands and incoming component or behavior
events can then cross this boundary without exposing a DOM node, component object, ref, method
table, raw action program, or platform API.

## What is proved

### Exact T12 command authority

- Binding reads the package-internal M04-T12 authority and accepts only its exact Catalog,
  command/event ports, current snapshot, identity tuple, and captured component callback owner.
- A normalized component-command request carries a private one-shot `WeakMap` authority owned by
  the exact M04-T12 port aggregate. Direct invocation, replay, a second foreign port owner that
  shares the callback, or use after the producer's `finally` cleanup is denied.
- The adapter receives only `{ command, input }`. Runtime context, source identifiers, tickets,
  host ports, component targets, and normalization markers do not leak into its request.
- Input is detached before callback entry. Throws, Promise-like results, malformed results,
  disposal attempts, and mutation reentry are contained as controlled M04-T12 outcomes.

### Catalog-declared incoming events

- Event admission first checks the exact current bridge snapshot, opaque ticket generation,
  behavior owner, M04-T12 authority, and Catalog event declaration. An unknown event is rejected
  before its hostile payload property is observed.
- A known payload is read once and passed once to `validateDesenEventPayload` with the exact
  Catalog selector. `EVENT_PAYLOAD_INVALID` diagnostics are preserved, and no invalid payload
  reaches the event-turn sink.
- After validation, the bridge rechecks its own lifetime, exact M04-T12 authority, registry
  snapshot, binding identity, and behavior owner. Validation-time drift therefore wins over a
  nominal validator success.
- A handled event crosses the sink as detached JSON plus an inert component/behavior handler
  selector, exact runtime instance, detached item aliases, and repeat keys. The public result
  exposes only a closed status and event ID. The frozen sink request has an exact eleven-key
  own-data inventory; tickets, snapshots, handles, ports, callbacks, and raw action programs never
  enter it or leak back to the caller.
- A declared but unhandled event is still schema-validated, then returned as detached validated
  data without allocating an event ID or invoking the sink.
- Nested incoming events remain allowed so M04-T16 can retain FIFO admission. Registry mutation
  and disposal remain `busy` during hostile event reflection, validation, and dispatch.

### Component, behavior, identity, and scope ownership

- Component runtime identity comes only from the exact M04-T06/M04-T07 factory identity and repeat
  scope. Caller-chosen runtime-instance identifiers are not accepted.
- Every binding receives an opaque ticket backed by a private owner-and-generation `WeakMap`.
  Forged, foreign, stale, or structurally ABA-equivalent tickets cannot act on a current binding.
- Behavior authority comes from the Catalog. Its capability must be declared, and its `attachTo`
  rule must match the exact live owner by capability or component category. A behavior shares its
  owner's detached item and repeat-key projection and cannot float after the owner leaves.
- Unregistering a component cascades every owned behavior before publishing the next snapshot.
- Only item aliases and repeat keys are retained from a repeat scope. They are detached and charged
  against aggregate JSON-occurrence and canonical-code-unit budgets. Each individual projection
  remains inside the shared 4,096-occurrence JSON safety boundary, while the 262,144-occurrence
  lifetime aggregate allows the public 5,000-binding ceiling to remain reachable for many small
  scopes. Behaviors share their owner's frozen projection without charging it a second time.

### Finite admission and disposal

- Live bindings, handled-event names, registration generations, event generations, snapshot
  generations, retained identifiers, retained scope occurrences, retained scope code units, and
  runtime-instance identifier length all have finite defaults. Trusted profiles may lower but
  cannot raise them.
- Registration reserves its publication snapshot and enough future snapshot capacity for every
  accepted live binding to unregister. A low ceiling cannot create a binding that the same
  lifetime is unable to remove.
- Transition, active command, event reflection, and event dispatch counters close all unsafe
  mutation/disposal reentry. Rejected admission consumes no ticket, target, retained budget, or
  generation.
- Disposal rereads M04-T12. It may adopt a newer same-origin lower snapshot for cleanup, rejects a
  foreign Catalog/port/identity lifetime, and tolerates an already disposed lower manager.
- Local disposal first marks the old authority `revoked`, tombstones every ticket, clears binding,
  owner, callback, and scope graphs, then replaces the handle entry with a minimal frozen
  `disposed` tombstone. Late event or command work remains denied, and repeated disposal is
  idempotent.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json`.
Its SHA-256 is `bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7`.

Generation refuses to run unless these reviewed prerequisite bytes match exactly:

- M04-T07 repeat materialization:
  `45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d`
- M04-T12 command/event actions:
  `8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4`

The artifact owns eleven implementation, distribution, proof, and root-mutation files. Shared
package indexes/manifests, traceability, normative coverage, findings, this proof document, and
the frozen reference Catalog are checked semantically rather than claimed as task-owned bytes.

The evidence builder and verifier enforce:

- 8 runtime exports, 27 type exports, and TSDoc on all 35 public declarations;
- 28 focused runtime cases from 26 registrations and 11 compiler-negative cases, including an
  exact 5,000-binding success/5,001-binding rejection boundary;
- 21 independent root proof and hostile-mutation tests;
- exact source/test/type-test reviewed bytes and deterministic double generation;
- exact M04-T14 trace ownership for `R-044`, `R-062`, `D-014`, and the declared-event half of
  `PIPE-023`; environment subscription/reactive composition remains M04-T15 and the composed
  end-to-end test remains M04-T16;
- no package-root leak of the three trusted M04-T12 adapter seams;
- an exact nine-module import allowlist plus zero React, DOM, browser, Node-global,
  native-framework, timer, dynamic-import, or dynamic-evaluation coupling;
- live probes for exact binding, Catalog payload validation, inert selectors, least-authority
  command requests, opaque tickets, behavior `attachTo`, stale denial, cascading cleanup, and
  terminal disposal.

`N-033` advances from `PLANNED` to `TESTED`: every generic incoming adapter event is either rejected
before dispatch or validated against its exact declared Catalog payload schema. `N-034` remains
`PLANNED` because complete production adapter command implementation belongs to M05. No frozen
protocol byte or Proof Matrix status changes in M04-T14; P-17 remains `PARTIAL`.

## Deferred composition

M04-T14 deliberately transports an inert handler selector rather than importing M04-T13 action
program types. M04-T16 owns the exact join from that selector and validated immediate payload to a
prepared action program, seven-namespace event scope, deterministic sign-in trace, and composed
lifetime. M04-T15 owns reactive reevaluation and stale asynchronous-result protection. M05 owns
real Web–React adapter implementation and complete command parity; future Android and iOS
adapters can implement the same platform-neutral contract.

The protocol ambiguity and Reference Profile decision are recorded in `PF-044`.
