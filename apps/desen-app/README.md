# Desen App

The visual authoring and publishing product intended for `desen.app`. Desen App is one product
built on DESEN; the protocol and App-independent developer ecosystem live separately on the
DESEN Developer Platform at `desen.run`.

## Status

M09-T01 implements the first application-owned shell and project-navigation slice. The current
product surface contains:

- a full-viewport `/projects` gallery over two fixed inert project fixtures;
- a project-level surface gallery and a centered, inert surface frame that preserve the route
  hierarchy without claiming editor behavior;
- exact project and surface routes at `/projects/:projectId` and
  `/projects/:projectId/surfaces/:surfaceId`;
- same-origin History API transitions, browser back/forward observation, and canonical replacement
  of the bare `/` entry with `/projects`;
- fixture-only project search with an explicit empty result and recovery action;
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

This slice does not connect a Catalog, render a managed adapter canvas, expose a component panel or
layer tree, select or inspect nodes, mutate an editor-core Source, persist project data, create user
projects, execute Design/Run behavior, calculate diagnostics, publish a revision, or activate a
channel. Disabled future actions explain their unavailable state and do not simulate later M09
tasks.

In particular, the M09-T02 Catalog-driven panel and layer tree are not implemented. The project
tiles, surface tiles, central frame placeholder, and fixture links are navigation guidance only.

Later slices may consume `editor-web`, `runtime-react`, and capability catalogs through their public
package APIs. M09-T01 itself depends only on React and React DOM at runtime and keeps its project
inventory as inert local fixtures.

## Local commands

```bash
pnpm --filter @desen/app-web dev
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:shell
pnpm --filter @desen/app-web build
```

Task evidence is generated and verified separately. A command appearing here is not a recorded
pass result.
