# Desen App

The visual authoring and publishing product intended for `desen.app`. Desen App is one product
built on DESEN; the protocol and App-independent developer ecosystem live separately on the
DESEN Developer Platform at `desen.run`.

## Status

M09-T02 extends the application-owned shell with a Catalog-driven, read-only authoring structure.
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

This slice does not render a managed adapter canvas, select or inspect nodes, expose prop/schema or
slot-cardinality controls, drag, insert, reorder or otherwise mutate Source, persist project data,
create user projects, execute Design/Run behavior, calculate user-facing diagnostics, publish a
revision, or activate a channel. The central frame remains an explicit placeholder for M09-T03;
selection belongs to M09-T04, inspector controls to M09-T05, and insertion/cardinality UI to
M09-T07.

M09-T02 imports only the inert Catalog JSON subpath and the two required public validator APIs. It
does not import `editor-core`, `catalog-sdk`, `runtime-react`, React adapters, or concrete Catalog
components, so the panel carries no premature mutation, inspector, or canvas authority.

## Local commands

```bash
pnpm --filter @desen/app-web dev
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:authoring
pnpm --filter @desen/app-web test:shell
pnpm --filter @desen/app-web build
```

Task evidence is generated and verified separately. A command appearing here is not a recorded
pass result.
