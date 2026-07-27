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

`renderRuntimeReactSurface` preflights the complete public headless plan before any adapter
component executes. Ordinary surface roots and descendants use the same exact lookup. Unknown
component or behavior capabilities, duplicate runtime identities, hostile reflection, and finite
tree-limit crossings return explicit callback-free failures and no placeholder React element.
Every retained string, named slot, and JSON occurrence consumes a finite render budget. Resolved
JSON is captured only through enumerable own-data properties, detached from the caller, and deeply
frozen before it enters a React element. The first declared behavior is the outermost wrapper.

Adapter inputs contain only public semantic data: stable runtime/source identities, resolved JSON
props, named slot nodes, semantic visual-state/style-part maps, inert behavior descriptions, and a
least-authority interaction port. No DOM node, selector, native event, component instance, or
private React structure crosses this contract.

The standalone renderer authenticates its registry but deliberately accepts a structurally valid
public plan. It does not by itself prove which session produced that plan. A production host must
read the plan from its exact current authenticated headless session; M05-T04 binds interactions to
that session and M05-T09 audits the independent reference host's complete production import graph.

M05-T01 establishes the registry and plan renderer. M05-T02 and M05-T03 add exact receiving-schema
validation for props and styles; M05-T04 activates session events, component commands, and behavior
lifecycle; M05-T05 proves real React instance reconciliation and diagnostic identity; M05-T06 adds
the production error boundary.

## Public entry points

- `createRuntimeReactAdapterRegistry` captures exact static component and behavior registrations.
- `readRuntimeReactAdapterRegistry` exposes only the immutable callback-free id inventory.
- `renderRuntimeReactSurface` compiles one complete public plan into a React element or one
  identity-linked failure.
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
    plan: currentHeadlessSessionSnapshot.plan,
  });
  if (result.status === "rendered") {
    reactRoot.render(result.surface.element);
  }
}
```

`currentHeadlessSessionSnapshot` and `reactRoot` are host-owned values. Bundle data never supplies
the component function or an import path.

## Failure behavior

Registry creation and rendering return discriminated results instead of guessing a fallback.
Malformed data, revoked proxies, unknown capabilities, duplicate identities, forged handles, and
limit crossings create no placeholder managed tree. The T01 interaction port returns
`unavailable`; its command contract already reserves an opaque attachment identity and a
controlled detach result for the authenticated M05-T04 implementation.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: web-react

## Quality

Run `pnpm --filter @desen/runtime-react lint`, `typecheck`, `test`, and `build` for the focused
package checks. Use the root workspace quality gate, `pnpm check`, for cumulative proof.
