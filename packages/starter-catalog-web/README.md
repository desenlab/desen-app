# @desen/starter-catalog-web

## Responsibility

Private, target-specific DESEN Neutral capabilities backed by pinned `@base-ui/react@1.8.0`.
M10A-T01 implements a bounded Button, Select and Dialog adapter slice. The full starter library,
theme editor, design-system releases, master/instance model and normal App integration belong to
later M10A tasks. This package does not replace the M10 reference catalog or migrate workspaces.

## Public boundary

The root entry exports inert Catalog registrations, schema-derived prop types and deterministic
complete Source-node templates. `./react-adapters` exports the exact static
`STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT`, its three adapters and `StarterSurfaceBoundary`.
The proof authoring surface and independent host harness use those same adapters, not duplicate
screen JSX. This task does not integrate them into the normal Desen App canvas.

```tsx
import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";
import {
  STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT,
  StarterSurfaceBoundary,
} from "@desen/starter-catalog-web/react-adapters";

const registry = createRuntimeReactAdapterRegistry(STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT);
// Mount an authenticated Runtime React surface with this registry, then wrap its managed element:
// <StarterSurfaceBoundary>{surface.element}</StarterSurfaceBoundary>
```

Registry creation alone grants no runtime authority. A real managed surface still requires an
admitted Bundle, its exact Catalog set and a live headless session. Documents can select only
`run.desen.starter/Button`, `run.desen.starter/Select` or `run.desen.starter/Dialog`; they cannot
name a Base UI import, callback, DOM target, render function, class name or arbitrary React prop.
The pre-release Catalog template is not an authenticated package identity. The task proof's build
step seals the actual implementation artifacts before constructing its exact fixture Catalog.

| Capability | Contract                                                                                                       | Local behavior                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Button     | `label`, optional `disabled`/`loading`; `press: {}`                                                            | Native button; loading remains focusable and suppresses activation   |
| Select     | `label`, finite inert `options`, optional `defaultValue`/`disabled`; `change: {value}`                         | Single local selection; keyboard, disabled items and contained popup |
| Dialog     | Named trigger/title/description/close text, optional `disabled`; required `content` slot; `openChange: {open}` | Internal trigger/close, focus trap, Escape and focus return          |

An unconnected Select is explicitly local component interaction, not saved business state or a
simulated backend. Option/default-value changes are trusted remount-sensitive props. Compatible
label/style edits preserve the component instance and local selection. Later connection tasks own
controlled application state; T01 makes no live backend claim. Dialog children are real rendered
Source nodes in its Catalog-declared content slot. Insertion supplies the complete child subtree
in one editor transition; no intermediate missing-required-slot state is committed.

## Styling and overlays

The package ships a CSS Module with DESEN Neutral light defaults: off-white canvas, white surfaces,
near-black actions/text, quiet borders, modest radii, system typography and visible keyboard focus.
No remote font or stylesheet is fetched. The theme is not a new protocol requirement or a claim of
the later freeform theme editor.

Only declared public part/state maps can modify appearance. T01 admits bounded numeric
`borderRadius`, `padding` and `fontSize`, plus six/eight-digit hex `color`, `backgroundColor` and
`borderColor`. The adapter projects these field by field. Source cannot replace focus outlines,
position overlays, inject URLs or acquire a private DOM selector. Runtime React validates the exact
Catalog receiving schema; a defensive adapter check also rejects unknown props, parts and states.

`StarterSurfaceBoundary` owns both its root and portal container. It accepts children, never a DOM
target. A missing boundary or a target found outside its root during render fails explicitly; an uncommitted
target produces no portal rather than falling back to `body`. The boundary clips overlays to its
surface. Nested content gets a popup-local portal scope so selection controls remain within the
dialog's focus region. Dialog uses Base UI's `trap-focus` mode: it traps keyboard focus without
locking the entire authoring page's scroll. This bounded host policy is identical in both harness
roles, not a general fullscreen/window manager. The backdrop, close control and Escape dismiss it.

State precedence is base → interaction → disabled → loading for Button, base → interaction → open
→ disabled for Select, and base → focus → open → disabled for Dialog. Select item states use base
→ selected → highlighted → disabled. Actual native interaction activates states; arbitrary forced
state preview belongs to later workbench tasks. Semantic roles/names and focus remain host-owned.

## Dependencies and limits

Production internal edges are only Protocol, Catalog SDK and Runtime React. Base UI and CSS remain
inside this Web package; neutral packages cannot import it. It does not import Editor Core, App,
Publisher, Runtime Core internals, testkit or the reference capability package. React and React DOM
19 are peers. No package publication, remote loading or external service is configured.

Catalog schemas bound strings, option count and slot cardinality; templates bound IDs and reject
unknown capabilities/collisions. Runtime React's existing finite data and receiving limits still
apply. Template and package metadata are JSON-only, while executable registration is an explicit
trusted import. The frozen DESEN 0.1.0 snapshot and Runtime Core remain unchanged.

## Verification and status

```bash
pnpm --filter @desen/starter-catalog-web typecheck
pnpm --filter @desen/starter-catalog-web test:adapters
pnpm --filter @desen/starter-catalog-web-proof test:e2e
pnpm verify:m10a-t01
```

See [the T01 contract](../../docs/plan/M10A-TASK-CONTRACTS.md#m10a-t01--base-ui-adapter-boundary-proof)
and [ADR 0023](../../docs/adr/0023-design-first-authoring-and-design-system-workbench.md). M10A-T01
is `DONE` after exact-head and fresh-main hosted verification. M10A-T02 is `IN_PROGRESS`; its local
design-system-core candidate does not change this package. This package still makes no claim for
the later complete library, theme editor, design-system releases, normal App integration, package
publication, or production deployment.
