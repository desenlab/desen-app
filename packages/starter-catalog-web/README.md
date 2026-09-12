# @desen/starter-catalog-web

## Scope and current status

`@desen/starter-catalog-web` is the private, target-specific DESEN Neutral capability package for
`web-react`. It provides inert Catalog registrations, schema-derived prop types, deterministic
Source-node templates, and one explicit React-adapter subpath. Base UI remains an internal
implementation detail of the existing Button, Select, and Dialog adapters; layout and semantic
content use ordinary Web semantics where a Base UI primitive is unnecessary.

**M10A-T05 is `IN_PROGRESS`.** The package now has an in-progress layout/content extension, but
that work has local evidence only. It is not a normal Desen App integration, a complete component
library, a design-system explorer, a persisted project, a publish/activation path, or a hosted
closure claim.

The M10A-T01 receipt at
[`docs/proof/artifacts/m10a-t01.json`](../../docs/proof/artifacts/m10a-t01.json) remains immutable
historical evidence for its original three-capability slice. T05 owns evidence for the expanded
starter Catalog; it must not rewrite the T01 artifact or present it as fresh T05 evidence.
The current additive Catalog is `run.desen.starter.web@0.2.0#web-react`; T01's original
`0.1.0` Catalog remains a historical receipt.

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

T01 retains Button, Select, and Dialog. The in-progress T05 slice adds the following bounded
capabilities:

| Group            | Capabilities             | Admitted boundary                                                                                                                     |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Layout           | Box, Stack, Grid         | One required, ordered managed slot (1–100 children); finite Stack direction/wrap and Grid columns (1–12); logical LTR/RTL properties. |
| Semantic content | Text, Heading, Separator | Inert text only; bounded heading level; semantic output without HTML parsing or executable markup.                                    |
| Trusted media    | Image, Icon              | Closed image-source and icon-name sets; required accessible text where applicable; no caller-supplied URL, SVG, font, or renderer.    |

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

## Dependencies and non-claims

Production edges remain Protocol, Catalog SDK, Runtime React, and the package-local Base UI/CSS
implementation. The package does not import Editor Core, Desen App, Publisher, Runtime Core
internals, testkit, or the reference capability package. React and React DOM 19 are peers.

T05 does not introduce arbitrary asset import, local asset storage, font admission, a library
management UI, custom variants, raw CSS, remote requests, package publication, or production
deployment. Those boundaries remain with their designated later tasks, including T13 for assets
and fonts and T17 for the integrated explorer/documentation surface.

## Local verification

The following are local candidate checks while T05 is in progress; successful local execution is
not exact-head hosted or fresh-`main` closure evidence.

```bash
pnpm --filter @desen/starter-catalog-web typecheck
pnpm --filter @desen/starter-catalog-web test
pnpm --filter @desen/starter-catalog-web test:public-package
pnpm --filter @desen/starter-catalog-web-proof test:e2e
pnpm generate:m10a-t05
pnpm verify:m10a-t05
pnpm test:m10a-t05
```

See [the T05 contract](../../docs/plan/M10A-TASK-CONTRACTS.md#m10a-t05--layout-and-content-capabilities),
[the implementation plan](../../docs/plan/M10A-IMPLEMENTATION-PLAN.md), and the
[in-progress T05 proof report](../../docs/proof/M10A-T05.md).
