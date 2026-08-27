# Desen App

The visual authoring and publishing product intended for `desen.app`. Desen App is one product
built on DESEN; the protocol and App-independent developer ecosystem live separately on the
DESEN Developer Platform at `desen.run`.

## Status

M09-T01 implements the first application-owned shell and project-navigation slice. The current
product surface contains:

- a guided `/projects` home over two fixed inert project fixtures;
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

The M09 wireframe informed information hierarchy, wording, and user guidance only. It is not proof
authority, runtime data, or a source of executable application behavior. The implemented visual
language deliberately refines the wireframe into quieter neutral surfaces, restrained accent use,
clear focus states, and responsive spacing rather than reproducing its sketch styling literally.

## Deliberate boundary

This slice does not connect a Catalog, render a managed adapter canvas, expose a component panel or
layer tree, select or inspect nodes, mutate an editor-core Source, persist project data, create user
projects, execute Design/Run behavior, calculate diagnostics, publish a revision, or activate a
channel. Disabled future actions explain their unavailable state and do not simulate later M09
tasks.

In particular, the M09-T02 Catalog-driven panel and layer tree are not implemented. The workspace
placeholder and fixture surface links are navigation guidance only.

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
