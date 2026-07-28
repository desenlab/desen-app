# Runtime React Reconciliation and Diagnostic Identity Proof

## Scope

M05-T05 proves the live Web–React identity boundary after M05-T04 established authenticated
adapter interactions. It answers four concrete questions:

1. how a committed React host observes exact runtime publications without polling or stale UI;
2. which changes preserve an adapter instance and which changes deliberately remount it;
3. how repeated runtime instances remain traceable to one authoring source node; and
4. whether that traceability can remain bounded, immutable, callback-free, and independent of
   React or platform-private objects.

This proof does not claim the M05-T06 adapter exception boundary, a guessed placeholder, the
separate reference host, or the official sign-in host run.

## Live session observation

`useRuntimeReactSessionSurface` composes React `useSyncExternalStore` only with
`readRuntimeHeadlessSession`, `subscribeRuntimeHeadlessSession`, and
`unsubscribeRuntimeHeadlessSession`. Repeated reads of one exact runtime snapshot reuse one frozen
result reference. A subscription is requested only after commit and its exact opaque ticket is
revoked during StrictMode replay, session replacement, or unmount. SSR and Suspense work that never
commits acquire no subscription. A publication notice rereads the current exact snapshot instead
of trusting an event payload.

`useRuntimeReactSurface` supplies that snapshot to the existing all-or-nothing renderer with the
same host-retained registry, exact execution Catalog set, and lower-only limits. It carries no old
surface through invalid-handle, disposal, subscription-limit, stale-server-snapshot, malformed
input, or renderer failure. A private boundary type is stable for one exact factory-created
session-and-registry pair and different when either trusted authority changes. The public renderer
owns that boundary at its output root, so direct renderer consumers and the live hook receive the
same isolation without double wrapping: ordinary generations preserve compatible instances, while
a session or registry switch remounts the complete managed tree. A queued notice or interaction
port from the old authority cannot restore its tree or acquire authority in the replacement.

## Stable reconciliation identity

Every component and behavior registry entry may declare a static `remountOnProps` list. The
factory captures it as detached, dense, duplicate-free, UTF-16-code-unit-sorted, recursively frozen
own data under explicit count and aggregate string limits. Its callback-free public snapshot
contains the exact policy, but executable React components remain private. A Bundle or Catalog
cannot provide, alter, or override the list.

For each completely validated adapter instance, `createRuntimeReactReconciliationKey` creates one
RFC 8785 canonical JSON key from:

- the stable materialized runtime-node identity;
- the exact selected capability id; and
- a presence-aware projection of only the trusted `remountOnProps`.

Missing and explicitly present `null` values are different. Object member source order is not.
Ordinary props, style maps, slots, Catalog metadata, Bundle metadata, callbacks, React values, DOM
objects, and native objects do not enter the key. Actual React mount/unmount tests prove:

- ordinary prop, style, and slot changes preserve a compatible component instance;
- a declared prop presence or value change creates a new component instance;
- semantically identical object values with different key order preserve the instance;
- a capability change changes the key even when two registrations use the same function;
- behavior wrappers use the same policy; and
- repeated siblings preserve keyed instances through reorder and unmount only a removed key.

The live test independently proves that a different session never shares those otherwise stable
component or behavior instances.

## Runtime-node and source-node diagnostics

The renderer constructs `surface.diagnosticIndex` only after complete plan preparation and exact
two-way binding parity, but before creating a React element. The build is all-or-nothing. Its
reference ceilings admit the renderer maximum of 5,000 components plus 20,000 behaviors, 115,000
identifier occurrences, and 4,194,304 UTF-16 code units across distinct retained identifiers.
Lower-only profiles, duplicate runtime identities, incoherent behavior ownership, hostile
reflection, or any limit crossing return `DIAGNOSTIC_INDEX_FAILED` and no partial surface.

The recursively frozen index contains:

- `byRuntimeNodeId`: exact component or behavior kind, runtime id, source id, capability id, and
  behavior/owner ids where applicable;
- `runtimeNodeIdsBySourceNodeId`: deterministic one-to-many sorted runtime ids, including repeated
  authoring nodes; and
- `runtimeNodeIdsByBehaviorId`: deterministic one-to-many sorted behavior instances.

Every lookup record has a null prototype and round-trips through JSON. The index retains no props,
styles, slots, React element, component function, DOM/native value, session, Catalog, registry, or
callback. Building a successor index cannot mutate an older one.

## Fail-closed and hostile cases

Package and root tests cover accessors without invocation, inherited and symbol properties, sparse
or non-enumerable arrays, Array subclasses, revoked proxies, duplicate policy names, invalid
Unicode, non-JSON selected values, canonicalization collisions, forged handles, subscription
limits, session disposal races, StrictMode replay, stale queued notices, SSR, abandoned and retried
Suspense work, prototype-sensitive diagnostic identifiers, duplicate runtime ids, behavior-owner
mismatch, and complete renderer-ceiling admission.

Reconciliation-key and diagnostic-index failures remain controlled renderer failures. Exceptions
thrown later by a trusted adapter React component are deliberately not caught here. M05-T06 owns
the explicit error boundary and host-visible unknown/adapter failure behavior; M05-T05 introduces
no placeholder guessing or case-specific fallback.

## Prerequisite integrity

The deterministic artifact pins and byte-verifies:

- M04-T06 local-state and stable-node identity evidence:
  `runtime-core-0.1.0-local-state-identity.json`
  `sha256:4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13`;
- M04-T07 repeat materialization evidence:
  `runtime-core-0.1.0-repeat-materialization.json`
  `sha256:45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d`;
  and
- immutable M05-T04 interaction evidence:
  `docs/proof/artifacts/runtime-react-0.1.0-interactions.json`
  `sha256:9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0`.

M05-T04 now uses a strict task-time compatibility reader, so current successor source cannot
retroactively rebuild or alter its 52,430 exact bytes.

## Coverage decision

M05-T05 completes the selected Web–React portion of R-104 by combining runtime stable identity,
repeat keys, trusted adapter compatibility, and declared prop-remount policy in real React
instances. P-16 advances from `NOT_PROVEN` to `PARTIAL`: runtime and source identities now have a
public immutable lookup, while M09-T13 still owns end-to-end diagnostic selection in Desen App.
N-021 remains `PLANNED` because the future publisher must still prove preservation of protocol
behavior and source-node traceability through publication. No proof gate changes in this task.

## Evidence artifact

`docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json`
`sha256:292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb`.
