# DESEN 0.1.0 Reference Implementation Guide

This guide is informative. It translates the protocol into the smallest useful editor–publisher–runtime architecture.

## 1. Build one vertical slice

Do not begin with a general Figma replacement. Begin with one managed surface and one exact Web–React catalog.

Reference flow:

```text
TextField(email)
TextField(password)
Button(sign in)
Alert(failure)
Navigate(home)
```

The slice must prove:

1. the editor renders the registered React components;
2. the designer changes props, slots, and local state bindings;
3. Run Mode executes component events and operation fixtures;
4. the publisher creates a valid immutable bundle;
5. the production runtime loads that bundle;
6. the application supplies the real `signIn` operation; and
7. no developer recreates the sign-in component tree.

## 2. Suggested packages

```text
@desen/schema          Canonical schemas and TypeScript types
@desen/validator       Structural and semantic validation
@desen/publisher       Source → bundle publication
@desen/runtime-core    State, bindings, predicates, actions, lifecycle
@desen/runtime-react   React capability adapter and renderer
@desen/editor-core     Source editing model and commands
@desen/editor-react    Canvas, inspector, scenarios, Design/Run modes
@desen/catalog-sdk     Capability registration and manifest generation
@desen/devtools        Node-id diagnostics and bundle inspector
```

Keep package boundaries practical. They are not protocol requirements.

## 3. Minimal host registration API

A reference SDK could expose a registration API similar to:

```ts
registerComponent({
  id: "com.example.ui/Button",
  manifest: buttonCapability,
  production: Button,
  authoring: Button,
});

registerOperation({
  id: "com.example.auth/signIn",
  execute: signIn,
});

registerResource({
  id: "com.example.stores/list",
  read: listStores,
});
```

The manifest remains the authority. TypeScript types and editor controls should be generated from, or checked against, the manifest rather than maintained independently.

## 4. Editor architecture

### 4.1 Document model

Store the Design Source Document directly. Editor selection, panel state, canvas position, comments, and scenario choices belong under `authoring` and therefore do not affect the source digest.

### 4.2 Canvas

The canvas should render the same React adapter that production uses whenever possible. Place selection overlays outside the component subtree. Do not inject editor handles into component slots or inspect private DOM as design structure.

### 4.3 Inspector

Generate controls from `propsSchema`:

- enum → select or segmented control;
- boolean → switch;
- string → text input;
- number → numeric field;
- object → nested property group;
- `$token`-capable style value → token picker;
- dynamic value → binding editor.

Catalog `authoring.controls` may improve presentation but cannot change validity.

### 4.4 Slots

Render named slot boundaries and enforce accepted capabilities and cardinality during drag-and-drop. A drag operation should generate a deterministic source-document edit, not absolute canvas geometry unless a component contract explicitly models it.

### 4.5 Design and Run modes

- **Design Mode:** editor owns selection, movement, insertion, and resizing gestures.
- **Run Mode:** adapters own interaction; the runtime executes state, resources, events, actions, and fixtures.

Switching modes must not create a different source tree.

## 5. Publisher architecture

A publisher should produce a diagnostic report before emitting a bundle:

```ts
type PublishResult =
  | { ok: true; bundle: DesenBundle; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };
```

Recommended stages:

1. source schema;
2. catalog resolution;
3. semantic identity checks;
4. capability contract validation;
5. static binding/type checks;
6. authoring-field removal;
7. catalog tuple pinning;
8. canonical digests;
9. bundle schema;
10. final semantic validation.

Never publish on unresolved errors. Warnings may cover deprecation, approximate authoring fidelity, or non-token style values when policy permits them.

## 6. Runtime architecture

Suggested internal services:

```text
BundleStore
CatalogRegistry
ActivationManager
SurfaceRuntime
DependencyIndex
ValueResolver
PredicateEvaluator
ActionRunner
ResourceManager
OperationManager
AdapterRegistry
DiagnosticSink
```

### 6.1 Activation

Keep `activeRevision` separate from `stagedRevision`.

```text
fetch → verify → resolve packages → preflight → stage → atomic pointer swap
```

A failed stage never changes the active pointer.

### 6.2 Surface execution

A surface runtime owns:

- local state;
- operation aliases;
- resource instances;
- repeat scopes;
- node instances;
- event subscriptions; and
- dependency invalidation.

The first implementation may re-evaluate a complete surface after every change. Optimize with dependency indexing only after behavior is correct.

### 6.3 React adapter

A React renderer conceptually performs:

```tsx
const Adapter = registry.component(node.use);
return (
  <Adapter
    {...resolvedProps}
    desenStyle={resolvedStyleParts}
    desenCommands={commandBridge}
    {...eventBridge}
  >
    {resolvedSlots}
  </Adapter>
);
```

Actual APIs should match the application's design system. DESEN does not require a special component base class.

## 7. Complex capabilities

### 7.1 Map

Wrap the selected map library in one product capability. Keep API keys, map instances, clustering, layers, and provider events inside the implementation. Expose only stable product concepts through the catalog.

Use slots for designer-composed popup and empty-state content. Use commands for imperative actions such as fitting bounds. Use style parts for contractually stable surfaces such as markers and controls.

### 7.2 Sortable behavior

Wrap the chosen drag-and-drop engine as a behavior. The behavior should translate library events into the catalog's stable `reorder` payload. A later library migration should not require design-document changes when the public contract remains compatible.

## 8. Debugging contract

Every adapter and runtime diagnostic should carry:

```text
bundle revision
surface id
source node id
repeat key path, when applicable
capability id
property/event/action path
stable diagnostic code
```

Devtools should support:

```text
runtime node → source node
source node → active runtime instance(s)
```

This traceability replaces screenshot-based design QA with direct inspection of the authoritative design node.

## 9. MVP acceptance tests

The first reference implementation is successful only when all are true:

- a designer can build the sign-in surface without editing React source;
- the editor and production app render the same registered components;
- local input state updates in Run Mode;
- operation fixtures cover pending, success, and failure;
- the published bundle passes the included validator;
- changing a label or layout prop requires no frontend implementation change;
- a catalog-breaking change prevents activation instead of silently degrading;
- an invalid new bundle leaves the prior revision active;
- the map or sortable extension can be installed without changing runtime core; and
- the application contains no manually duplicated sign-in composition.

## 10. What not to build yet

Avoid these until the vertical slice works in a real product repository:

- custom vector engine;
- general expression language;
- arbitrary CSS/DOM inspector;
- AI-generated production capability code;
- multi-framework code export;
- code-to-design round trip;
- multiplayer collaboration;
- plugin marketplace;
- telemetry and rollout control plane;
- voice or XR compilers.

The reference implementation should make the protocol credible by doing one narrow workflow exceptionally well.
