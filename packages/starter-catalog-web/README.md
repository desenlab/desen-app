# @desen/starter-catalog-web

## Scope and current status

`@desen/starter-catalog-web` is the private, target-specific DESEN Neutral capability package for
`web-react`. It provides inert Catalog registrations, schema-derived prop types, deterministic
Source-node templates, and one explicit React-adapter subpath. Base UI remains an internal
implementation detail of the interactive adapters; layout and semantic content use ordinary Web
semantics where a Base UI primitive is unnecessary.

**M10A-T09, T08, T07, and T06 are `DONE`; M10A-T12 is `IN_PROGRESS`.** T09 adds bounded data-display
and feedback adapters; its [task-owned proof](../../docs/proof/M10A-T09.md) records local
browser/contract evidence plus exact-head hosted/fresh-`main` closure as a historical receipt.
T08 adds bounded Popover, Tooltip, Menu, and Accordion adapters on the same contained portal
boundary; its [task-owned proof](../../docs/proof/M10A-T08.md) records completed hosted closure.
T07's [task-owned proof](../../docs/proof/M10A-T07.md) records completed selection/numeric-control
closure. T12 owns the current 0.7.0 Catalog capture, closed visual style profiles, and normal-App
typed visual-authoring integration; its [local proof](../../docs/proof/M10A-T12.md) is not a hosted
closure. This package is not a complete component library, a design-system explorer, a persisted
project model, or a publish/activation path.

The M10A-T01 receipt at
[`docs/proof/artifacts/m10a-t01.json`](../../docs/proof/artifacts/m10a-t01.json) remains immutable
historical evidence for its original three-capability slice. T05's sealed `0.2.0`, T06's completed
`0.3.0`, T07's completed `0.4.0`, T08's completed `0.5.0`, and T09's completed `0.6.0` receipts are
immutable historical evidence. T12 owns the current `run.desen.starter.web@0.7.0#web-react` Catalog
capture and must not rewrite or relabel the predecessor artifacts.

## Public boundary

The root entry is inert: it exports Catalog registrations, contract-derived types, capability IDs,
and complete deterministic templates. Executable React adapters are available only through the
explicit `@desen/starter-catalog-web/react-adapters` subpath. Both proof renderers use the same
static registry input and `StarterSurfaceBoundary`; neither may select an adapter, callback,
selector, DOM target, or arbitrary React prop from Source data.

```tsx
import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";
import {
  STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT,
  StarterSurfaceBoundary,
} from "@desen/starter-catalog-web/react-adapters";

const registry = createRuntimeReactAdapterRegistry(STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT);
// A trusted host still admits a Bundle and mounts its managed surface:
// <StarterSurfaceBoundary>{surface.element}</StarterSurfaceBoundary>
```

Registry creation grants no runtime authority. A managed surface still needs an admitted Bundle,
its exact Catalog requirement, and a live headless session. The package does not export Base UI
internals or make them selectable from authored data.

## Capability inventory

T01 retains Button, Select, and Dialog. The completed historical T05 slice adds the following
bounded capabilities:

| Group            | Capabilities             | Admitted boundary                                                                                                                     |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Layout           | Box, Stack, Grid         | One required, ordered managed slot (1–100 children); finite Stack direction/wrap and Grid columns (1–12); logical LTR/RTL properties. |
| Semantic content | Text, Heading, Separator | Inert text only; bounded heading level; semantic output without HTML parsing or executable markup.                                    |
| Trusted media    | Image, Icon              | Closed image-source and icon-name sets; required accessible text where applicable; no caller-supplied URL, SVG, font, or renderer.    |

The active T06 slice retains and reviews the existing Button, including its disabled/loading
behavior, and adds the following bounded form controls:

| Group        | Capabilities                 | Admitted boundary                                                                                                             |
| ------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Text input   | TextField, TextArea          | Native field semantics with required label and optional help/error composition; `change:{value:string}` only.                 |
| Choice input | Checkbox, RadioGroup, Switch | Native/ARIA choice semantics with label/help/error composition; closed checked/value declarations and controlled events only. |

All field controls preserve their native or ARIA label and described-message relationships. Invalid
form values and malformed event payloads reject before rendering or dispatch; styles remain
presentation only and cannot substitute private selectors, callbacks, arbitrary DOM props, or
executable markup.

The active T07 slice extends Select and adds the following bounded selection and numeric controls:

| Group     | Capabilities           | Admitted boundary                                                                                                     |
| --------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Selection | Select, Combobox, Tabs | Data-only options with stable identities; finite `contains`/`startsWith` filtering; one ordered public `panels` slot. |
| Numeric   | Slider, NumberField    | Finite values from -100000 to 100000 and a positive finite step; declared controlled event payloads only.             |

Select accepts its retained legacy `value` spelling or `id`, then normalizes to a stable selected
identity. Combobox admits no custom filter or renderer; duplicate IDs, function values, and malformed
selection/numeric data reject before rendering or dispatch. Tabs preserves public ordered panel
content rather than accepting an adapter-private tree.

The T08 slice extends Dialog's contained overlay boundary with Popover, Tooltip, Menu, and
Accordion. Overlay portals are owned by `StarterSurfaceBoundary`; no Source prop can provide a
selector, DOM node, callback, renderer, or external portal authority. Dialog and Popover require a
bounded content slot, Accordion requires ordered panel slots, and Menu/Accordion identities are
validated before Base UI receives them. Escape, pointer/keyboard parity, focus return, and
unmount-safe interactions are covered by the task proof.

The T09 slice adds bounded data-display and feedback capabilities:

| Group                | Capabilities                     | Admitted boundary                                                                                                     |
| -------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Data display         | Card, Badge, Avatar, List, Table | Ordered managed `List.items`/`Table.rows` slots, stable row identities, semantic native table output, no data source. |
| Feedback and loading | Alert, Skeleton, Progress        | Finite role/status, inert text, bounded geometry, and finite determinate progress; no callbacks or timers.            |

Avatar uses a closed trusted source set and required text alternative; Card and Alert retain bounded
managed content slots. Table is deliberately basic: it admits declared columns and public rows but
no query, sort, filter, virtualizer, renderer, or arbitrary cell markup. Skeleton and Progress make
loading state visible without introducing asynchronous authority. The T09 proof covers empty,
loading, error, and ready states in both isolated authoring and independent-host graphs.

Each registration has a closed root style-part schema. Layout/style inputs permit only bounded,
typed values such as six/eight-digit hex colors, finite spacing and box dimensions, finite
alignment/distribution values, `fill`/`hug` where declared, and explicit typography or media
properties. Unknown style properties, private selectors, invalid/negative dimensions, executable
content, and remote media values are rejected before rendering.

When a layout, typography, or media component admits `borderColor` or `borderWidth`, the adapter
also projects a visible solid border. Separator is deliberately narrower: its visible line uses
`backgroundColor`, finite dimensions, radii, margins, and opacity rather than ineffective border
controls. A vertical Separator has a visible 24px minimum default height in ordinary root and
vertical-Stack contexts, while a finite explicit dimension can still be supplied. Image deliberately
does not admit a foreground `color`, because its trusted data-URI source is a replaced image and
would otherwise silently ignore it; Icon retains its finite foreground color control through
trusted inline SVG. Column-flow Grid calculates its explicit row count from the declared managed children,
so it keeps the declared 1–12 column bound instead of creating implicit overflow columns.

`start`/`end`, `paddingInline`, `marginInline`, and text alignment remain logical rather than
physical properties. Layout children stay managed Source nodes: adapters render them but do not
inspect, rewrite, or create unadmitted child structure.

## Styling, portals, and accessibility

The package ships DESEN Neutral CSS Module defaults: off-white canvas, white surfaces, near-black
text/actions, quiet borders, visible focus, system typography, and modest radii. It fetches no
remote stylesheet or font. Neutral is a default appearance, not the later freeform theme editor
or complete styling system.

`StarterSurfaceBoundary` owns its root and portal container. It never accepts an authored DOM
target; a missing or escaping target fails rather than falling back to `body`. The existing Select
and Dialog adapters therefore retain their bounded overlay, focus, Escape, and focus-return
behavior, while the T05 semantic content adapters add no overlay authority.

Text is rendered as text, Heading is bounded to a semantic level, Image uses a closed trusted
in-package source set with an alternative text requirement, Icon has a closed name set and
label/decorative boundary, and Separator has a finite orientation. These are component contracts,
not an arbitrary HTML, asset, or icon-import facility.

T06 field composition keeps label, help, and error relationships attached to the rendered control
in both isolated authoring and independent-host graphs. Keyboard focus and controlled form changes
remain adapter behavior; Source data cannot select an event handler, DOM target, or private Base UI
part.

## Dependencies and non-claims

Production edges remain Protocol, Catalog SDK, Runtime React, and the package-local Base UI/CSS
implementation. The package does not import Editor Core, Desen App, Publisher, Runtime Core
internals, testkit, or the reference capability package. React and React DOM 19 are peers.

T05–T09 do not introduce arbitrary asset import, local asset storage, font admission, a library
management UI, custom variants, raw CSS, remote requests, package publication, production
deployment, business actions, application-state wiring, normal-App integration/persistence,
Publisher authority, Runtime activation, Core/protocol changes, G10A, or M11. Those boundaries
remain with their designated later tasks, including T13 for assets/fonts and T17 for the integrated
explorer/documentation surface.

## Verification

The following commands authenticate the T12 local boundary; exact-head hosted and fresh-`main`
closure remain pending in [the T12 report](../../docs/proof/M10A-T12.md).

```bash
pnpm --filter @desen/starter-catalog-web typecheck
pnpm --filter @desen/starter-catalog-web test
pnpm --filter @desen/starter-catalog-web test:public-package
pnpm --filter @desen/app-web exec vitest run test/authoring-design-tokens.test.ts test/authoring-styles.test.ts test/authoring-style-preview-runtime.test.ts test/style-panel.test.tsx test/starter-neutral-workspace-profile.test.ts test/project-workspace-authoring-persistence.test.ts test/local-project-workspace-persistence.test.ts
pnpm --filter @desen/app-browser-e2e run test:m10a-t12
pnpm generate:m10a-t12
pnpm verify:m10a-t12
pnpm test:m10a-t12
```

Authenticate historical closure without recapturing it with `pnpm verify:m10a-t05` through
`pnpm verify:m10a-t09` and their matching `test:m10a-tNN` commands. See [the T12 contract](../../docs/plan/M10A-TASK-CONTRACTS.md#m10a-t12--rich-styling-and-responsive-authoring),
[the implementation plan](../../docs/plan/M10A-IMPLEMENTATION-PLAN.md), [the T12 local report](../../docs/proof/M10A-T12.md),
and the immutable [T09 proof](../../docs/proof/M10A-T09.md).
