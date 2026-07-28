# @desen/runtime-react

## Responsibility

React renderer that materializes runtime-core render plans through registered adapters.

## Explicit non-responsibilities

No protocol reinterpretation, remote code loading, editor behavior, or activation storage.

## Static adapter registry

Applications and capability packages statically import trusted implementations, then register
their exact capability identifiers. Bundle data can select only an identifier already present in
that registry; it cannot name a module, import executable code, or request a fallback.

The returned handle is factory-authenticated. Its public snapshot contains only sorted capability
identifiers and callback-free reconciliation policies; executable React components remain private.
Duplicate identifiers or remount-sensitive prop names, malformed registrations, and lower-only
limit violations reject the whole registry.

`renderRuntimeReactSurface` accepts only the exact current snapshot and exact execution Catalog set
retained by one live `runtime-core` session. It authenticates those references even for an empty
root, creates one Catalog-authenticated receiving scope, and preflights the complete public
headless plan before creating any React element. A copied plan, reconstructed snapshot,
structurally equal Catalog set, stale generation, or forged session cannot authorize rendering.
Applications obtain both exact references directly from a successful
`mountRuntimeHeadlessSession` result as `snapshot` and `catalogSet`; this also works when mount
received raw Catalog JSON.

Ordinary surface roots and descendants use the same exact registry lookup. Resolved component and
behavior props are checked as complete `resolved-value` maps against their exact Catalog schemas.
Named slots are projected only as `{ capabilityId }` child identities, checked after runtime
materialization, and converted to React nodes without inspecting React-private or DOM structure.
Unknown adapters, invalid receiving values, hostile reflection, and finite tree or aggregate
receiving-budget crossings return explicit callback-free failures and no placeholder React
element. Every retained string, named slot, JSON occurrence, prop validation, slot validation, and
schema evaluation consumes a finite shared render budget. Required-slot, slot-contract lookup, and
child-acceptance work is independently capped by `maxSlotContractEvaluationSteps`. Values admitted
to adapters are detached from their source and recursively immutable. A successful surface also
contains one bounded, callback-free, deeply frozen diagnostic index with exact forward
runtime-node lookup and sorted one-to-many source-node and behavior inverse lookups. The first
declared behavior remains the outermost wrapper.

Adapter inputs contain only public semantic data: stable runtime/source identities, validated
resolved JSON props, validated named slot nodes, semantic visual-state/style-part maps, and a
least-authority interaction port. A component adapter does not receive raw behavior plans. No raw
headless plan, Catalog metadata, DOM node, selector, native event, component instance, or private
React structure crosses this contract.

M05-T01 establishes the registry and bounded renderer. M05-T02 authenticates session/Catalog
authority and adds exact receiving validation for props and materialized named slots. M05-T03
adds exact receiving validation and immutable delivery for complete visual-state → semantic-part
→ property style maps while leaving state activation inside each capability adapter. M05-T04
authenticates two-way plan-to-binding parity and activates commit-scoped session events, component
commands, and behavior lifecycle. M05-T05 adds live external-store observation, trusted
presence-aware remount policy, real React instance reconciliation, and immutable diagnostic
identity. M05-T06 remains responsible for the production error boundary and explicit adapter
exception surface.

## Live reconciliation and diagnostic identity

`useRuntimeReactSurface` is the complete live host seam. It observes one headless session only
through `readRuntimeHeadlessSession`, `subscribeRuntimeHeadlessSession`, and
`unsubscribeRuntimeHeadlessSession`. React acquires the subscription after commit and revokes the
exact opaque ticket during StrictMode replay, session replacement, or unmount. Server rendering
and abandoned Suspense work read an exact server snapshot but acquire no subscription. A
subscription limit, invalid handle, disposal, stale server snapshot, or render authentication
failure returns an explicit discriminated result without retaining the previous managed element.

Each component and behavior registry entry may declare `remountOnProps`. This is static trusted
host metadata: a Catalog or Bundle cannot provide or override it. The registry captures a detached,
duplicate-free, sorted, bounded list. The renderer creates an RFC 8785 canonical key from the
stable runtime identity, exact capability id, and a presence-aware projection of only those named
resolved props. Missing and explicit `null` are different. Semantically identical object values
with different source key order are equal. Ordinary props, styles, and slots do not remount a
compatible adapter instance; a capability or declared remount-sensitive value change does.
Repeated siblings keep their runtime identities through reorder and remove only the missing key.
Every successful public renderer result also owns a private root component type that is stable for
the exact session-and-registry pair and different when either authority changes. Thus compatible
generations using one trusted host configuration can reconcile, while another session or
executable registry with identical public runtime ids cannot share adapter state, refs, effects,
interaction ports, or platform instances—even when the renderer is used without the live hook.

`surface.diagnosticIndex` contains only immutable strings and callback-free records:

- `byRuntimeNodeId` maps every component and behavior runtime identity to its exact kind,
  source-node id, capability id, and behavior ownership fields;
- `runtimeNodeIdsBySourceNodeId` preserves repeated authoring nodes as sorted one-to-many lists;
- `runtimeNodeIdsByBehaviorId` preserves repeated behavior attachments the same way.

The index retains no props, styles, slots, React elements, platform objects, session, Catalog,
registry, or executable callback. A malformed or over-limit index rejects the complete render
before any React element is created.

## Interaction lifetime

The renderer compares every prepared component and behavior identity with the exact current
headless-session binding inventory in both directions. A missing, duplicated, mismatched, or
foreign binding returns `RUNTIME_BINDING_MISMATCH` before any React element or adapter executes.

Each successful adapter element owns a private interaction controller. Rendering alone grants no
authority to a new instance: calls before its first commit, server rendering, never-committed
Suspense work, and calls after cleanup return `unavailable`. A layout commit activates the
controller before trusted adapter passive effects. Component and behavior events first copy their
payload through the bounded inert runtime-core snapshot boundary and recheck the exact commit
epoch, then use only the captured session, snapshot, runtime instance, event name, and detached
JSON. Admission returns a `Promise<void>` that reveals no snapshot or lower action-turn result and
never propagates a rejected session completion.

React has no supported public API that tells a generic callback whether a previously committed
child is currently performing a child-local rerender. Static trusted adapters therefore have one
explicit conformance rule: side-effecting interaction methods are called only from committed
effects or platform event callbacks, never from a component render body. The reference adapters
follow and test this rule. Untrusted DESEN data cannot provide or replace adapter code.

Only a committed component adapter may attach a command callback. The headless session
authenticates the exact component binding and returns an opaque owner-bound attachment. A newer
owner atomically supersedes the old one; stale cleanup cannot detach its replacement. Unmount
cleanup, binding replacement, navigation, and session disposal revoke surviving authority.
Callbacks are receiver-independent and fail closed when they throw, return a malformed result,
reenter, or lose ownership while running. Behavior adapters can dispatch declared behavior events
but always receive `unavailable` for component command attachment.

Cleanup replaces each command attachment with a minimal inert tombstone, clears superseded
controller entries, and removes the current session/snapshot authority from the controller. A
stale opaque handle or interaction port retained by adapter code therefore cannot keep a live
component callback or complete session graph reachable after unmount. Reflection-time unmount is
also guarded before and after command capture; a lower attachment created across such a boundary
is detached immediately and is never returned.

## Public entry points

- `createRuntimeReactAdapterRegistry` captures exact static component and behavior registrations.
- `readRuntimeReactAdapterRegistry` exposes only the immutable callback-free id and reconciliation
  policy inventory.
- `renderRuntimeReactSurface` authenticates and compiles one exact current session snapshot into a
  React element or one identity-linked failure with a receiving channel and immutable diagnostics.
- `useRuntimeReactSessionSurface` exposes the lower exact-snapshot React store result without
  widening renderer authority.
- `useRuntimeReactSurface` composes that store with authenticated all-or-nothing rendering.
- `createRuntimeReactReconciliationKey` exposes pure canonical key derivation for adapter
  conformance tests.
- `buildRuntimeReactDiagnosticIndex` exposes the bounded callback-free identity-index builder.
- `RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS`, `RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS`, and
  `RUNTIME_REACT_RENDER_LIMITS` publish reference ceilings that trusted callers may only lower.

## Minimal usage

```tsx
import {
  createRuntimeReactAdapterRegistry,
  useRuntimeReactSurface,
  type RuntimeReactComponentAdapterProps,
} from "@desen/runtime-react";

function TextAdapter({ props }: RuntimeReactComponentAdapterProps) {
  return <p>{String(props.text)}</p>;
}

const registry = createRuntimeReactAdapterRegistry({
  components: [
    {
      capabilityId: "run.desen.example/Text",
      component: TextAdapter,
      remountOnProps: ["mode"],
    },
  ],
});
if (registry.status !== "created") throw new Error("Static adapter registry is invalid.");

function ManagedSurface() {
  const result = useRuntimeReactSurface({
    registry: registry.handle,
    session: currentHeadlessSessionHandle,
    serverSnapshot: initialHeadlessSessionSnapshot,
    catalogSet: exactSessionCatalogSet,
  });
  return result.status === "rendered" ? result.surface.element : null;
}

reactRoot.render(<ManagedSurface />);
```

`currentHeadlessSessionHandle`, `initialHeadlessSessionSnapshot`, and `exactSessionCatalogSet`
correspond to the successful mount result's `handle`, initial `snapshot`, and `catalogSet`;
`reactRoot` is host-owned. A real host renders its own failure shell for a failed result; it must
not substitute a guessed managed component. Bundle data never supplies the component function,
remount policy, store callback, or import path.

## Failure behavior

Registry creation and rendering return discriminated results instead of guessing a fallback.
Malformed data, revoked proxies, unknown capabilities, duplicate identities, forged or stale
session authority, invalid resolved props or slots, and limit crossings create no placeholder
managed tree. Receiving failures preserve the validator's exact frozen diagnostics and attach
`props`, `slots`, or `style` as their public channel. Binding parity drift fails explicitly before
React element creation. Interaction calls reject stale or malformed authority without upgrading
the adapter to a newer snapshot; uncommitted lifetimes remain explicitly unavailable.
Reconciliation-key or diagnostic-index construction failure is also all-or-nothing. This task
does not catch exceptions thrown by adapter React components or invent a production error UI; that
boundary remains M05-T06.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: web-react

## Quality

Run `pnpm --filter @desen/runtime-react lint`, `typecheck`, `test:adapter-registry`,
`test:resolved-props-slots`, `test:style-parts-states`, `test:interactions`,
`test:reconciliation-diagnostics`, and `build` for the focused package checks. Use the root
workspace quality gate, `pnpm check`, for cumulative proof.
