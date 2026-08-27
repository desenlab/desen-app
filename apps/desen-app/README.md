# Desen App

The visual authoring and publishing product intended for `desen.app`. Desen App is one product
built on DESEN; the protocol and App-independent developer ecosystem live separately on the
DESEN Developer Platform at `desen.run`.

## Status

M09-T03 extends the application-owned shell with an exact, read-only React adapter canvas.
The current product surface contains:

- a full-viewport `/projects` gallery over two fixed inert project fixtures;
- a project-level surface gallery and a centered, inert surface frame that preserve the route
  hierarchy without claiming editor behavior;
- exact project and surface routes at `/projects/:projectId` and
  `/projects/:projectId/surfaces/:surfaceId`;
- same-origin History API transitions, browser back/forward observation, and canonical replacement
  of the bare `/` entry with `/projects`;
- fixture-only project search with an explicit empty result and recovery action;
- a compact authoring panel whose Layers view preserves the official sign-in Source node, named
  slot, child order, conditional marker, and attached-behavior structure;
- a Components view derived from the exact `@desen/reference-catalog-web/catalog.json` component
  inventory, display names, categories, descriptions, identity, version, and target;
- local component filtering that changes only the visible list and never mutates Catalog or Source
  data;
- an explicit no-substitution state for Recovery and Profile, which have no exact Source tree in
  the official fixture;
- a sign-in canvas mounted from the official-derived Bundle through the same public
  `REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT` used by the reference host;
- exact runtime document, revision, surface, Catalog-set, registry, and snapshot authority checks
  before the managed tree becomes visible;
- a native disabled fieldset that keeps the real heading and labels accessible while preventing
  this Design preview from dispatching input or action events;
- explicit not-found states for unknown routes, projects, and surfaces; and
- semantic landmarks, a skip link, visible keyboard focus, route-heading focus, reduced-motion
  support, and responsive layouts.

Route identifiers are bounded lowercase kebab-case segments. App-owned transitions reject unknown,
cross-origin, credential-bearing, query-bearing, and fragment-bearing destinations instead of
guessing aliases or silently choosing a nearby project or surface. This route helper is internal to
the application; it is not a DESEN protocol rule or a public package contract.

Two Figma sources have distinct roles. The M09 UX wireframe (`2:7` Projects Home and `2:92` Design
Mode) informs information hierarchy, wording, task boundaries, and the future editor proportions.
The earlier Desen product exploration (`533:4004` App Start, `501:2829` Projects in Workspace,
`498:2594` Page List, and `488:2567` Page Canvas Editor) defines the visual language: a `#fafafa`
working plane, floating corner tools, a compact centered context path, and quiet white objects with
thin borders. Neither file is proof authority, runtime data, or a source of executable application
behavior.

## Deliberate boundary

The authoring read model first prepares the exact Catalog with
`validateDesenInteractionCatalogSet`, then validates the official-derived Source against that exact
prepared set with `validateDesenSourceInteractionContracts`. It projects UI data only from the two
detached, recursively immutable success values. Validation or bounded-projection failure exposes no
partial panel or tree. Component and behavior identity occurrences are bounded to 25,000 per
surface and Source depth to 64; own empty slots remain distinct from absent optional slots.

The canvas mounts only for the exact `account-app:sign-in` route tuple. It creates a public
`runtime-core` headless session with explicit inert/denying host ports, preflights that session
through `runtime-react`, and renders it through `useRuntimeReactSurface` plus
`RuntimeReactSurfaceBoundary`. Recovery, Profile, and every other tuple report that no exact
adapter preview is available; they never borrow the sign-in Bundle or retain its managed tree.
StrictMode replay, route replacement, and unmount dispose the exact session they created.

This slice does not select or inspect nodes, expose prop/schema or slot-cardinality controls, drag,
insert, reorder or otherwise mutate Source, persist project data, create user projects, execute
interactive Design/Run behavior, calculate user-facing diagnostics, publish a revision, or activate
a channel. Selection belongs to M09-T04, inspector controls to M09-T05, insertion/cardinality UI to
M09-T07, and interactive Design/Run behavior to M09-T10.

The App imports only public package entry points for runtime composition and the exact static
reference adapter registry. It does not import concrete Catalog components, private package files,
`editor-core`, `catalog-sdk`, Publisher, or control-plane code. Bundle data never selects a
module, component, fallback tree, or executable host binding.

## Local commands

```bash
pnpm --filter @desen/app-web dev
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:authoring
pnpm --filter @desen/app-web test:canvas
pnpm --filter @desen/app-web test:shell
pnpm --filter @desen/app-web build
```

Task evidence is generated and verified separately. A command appearing here is not a recorded
pass result.
