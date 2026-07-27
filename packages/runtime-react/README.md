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
identifiers; executable React components remain private. Duplicate identifiers, malformed
registrations, and lower-only limit violations reject the whole registry.

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
to adapters are detached from their source and recursively immutable. The first declared behavior
remains the outermost wrapper.

Adapter inputs contain only public semantic data: stable runtime/source identities, validated
resolved JSON props, validated named slot nodes, semantic visual-state/style-part maps, and a
least-authority interaction port. A component adapter does not receive raw behavior plans. No raw
headless plan, Catalog metadata, DOM node, selector, native event, component instance, or private
React structure crosses this contract.

M05-T01 establishes the registry and bounded renderer. M05-T02 authenticates session/Catalog
authority and adds exact receiving validation for props and materialized named slots. M05-T03 adds
exact receiving validation for semantic styles; M05-T04 activates session events, component
commands, and behavior lifecycle; M05-T05 proves real React instance reconciliation and diagnostic
identity; M05-T06 adds the production error boundary.

## Public entry points

- `createRuntimeReactAdapterRegistry` captures exact static component and behavior registrations.
- `readRuntimeReactAdapterRegistry` exposes only the immutable callback-free id inventory.
- `renderRuntimeReactSurface` authenticates and compiles one exact current session snapshot into a
  React element or one identity-linked failure with a receiving channel and immutable diagnostics.
- `RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS` and `RUNTIME_REACT_RENDER_LIMITS` publish the reference
  ceilings that trusted callers may only lower.

## Minimal usage

```tsx
import {
  createRuntimeReactAdapterRegistry,
  renderRuntimeReactSurface,
  type RuntimeReactComponentAdapterProps,
} from "@desen/runtime-react";

function TextAdapter({ props }: RuntimeReactComponentAdapterProps) {
  return <p>{String(props.text)}</p>;
}

const registry = createRuntimeReactAdapterRegistry({
  components: [{ capabilityId: "run.desen.example/Text", component: TextAdapter }],
});

if (registry.status === "created") {
  const result = renderRuntimeReactSurface({
    registry: registry.handle,
    session: currentHeadlessSessionHandle,
    snapshot: currentHeadlessSessionSnapshot,
    catalogSet: exactSessionCatalogSet,
  });
  if (result.status === "rendered") {
    reactRoot.render(result.surface.element);
  }
}
```

`currentHeadlessSessionHandle`, `currentHeadlessSessionSnapshot`, and `exactSessionCatalogSet`
correspond to the successful mount result's `handle`, `snapshot`, and `catalogSet`; `reactRoot` is
host-owned. Bundle data never supplies the component function or an import path.

## Failure behavior

Registry creation and rendering return discriminated results instead of guessing a fallback.
Malformed data, revoked proxies, unknown capabilities, duplicate identities, forged or stale
session authority, invalid resolved props or slots, and limit crossings create no placeholder
managed tree. Receiving failures preserve the validator's exact frozen diagnostics and attach
`props` or `slots` as their public channel. The interaction port still returns `unavailable`; its
command contract already reserves an opaque attachment identity and a controlled detach result for
the authenticated M05-T04 implementation.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: web-react

## Quality

Run `pnpm --filter @desen/runtime-react lint`, `typecheck`, `test:adapter-registry`,
`test:resolved-props-slots`, and `build` for the focused package checks. Use the root workspace
quality gate, `pnpm check`, for cumulative proof.
