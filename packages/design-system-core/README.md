# @desen/design-system-core

Platform-neutral editable-project and design-token contracts for DESEN authoring.

## Editable project

`admitEditableProjectRecord` admits the App-owned, versioned `desen.editable-project` envelope. The
current schema is exactly version `1` and retains:

- one structurally admitted canonical DESEN `Source`;
- ordered inert DTCG token documents;
- recipe and asset metadata without materialization or byte-loading authority; and
- draft connection-intent notes that cannot execute, bind a host, or block design admission.

The envelope is not part of frozen DESEN Protocol `0.1.0`. `migrateEditableProjectRecord` uses a
closed migration registry: version 1 has a deterministic lossless identity path, while unknown,
legacy, and future versions fail explicitly. Successful records are detached and recursively
immutable. Token documents in a project are preserved as safe JSON; selecting one for computation
requires separate DTCG admission and never silently strips an unsupported feature.

## DTCG profile and resolution

The machine-readable `DESIGN_TOKEN_PROFILE` targets DTCG `2025.10` and resolves these exact types:

| Family     | Supported types                              |
| ---------- | -------------------------------------------- |
| color      | `color` in `srgb`                            |
| dimension  | `dimension` in `px` or `rem`                 |
| number     | `number`                                     |
| typography | `typography`                                 |
| border     | `border` with a supported named stroke style |
| shadow     | `shadow`                                     |
| motion     | `duration`, `cubicBezier`, `transition`      |

Modes and contexts are ordered external sources, not invented `$mode` members inside DTCG. A
resolution fully captures and structurally validates every selected source, overlays declarations
in caller order with later declarations winning, resolves whole-token aliases against the completed
overlay, then applies explicit literal overrides as the final layer. An untyped alias in the base
source may therefore infer its type from a target introduced by a later mode source; standalone
document admission still requires its own alias graph to close. Results include declaration origin
and alias provenance and are deterministic, detached, and deeply frozen.

```ts
import { resolveDesignTokens } from "@desen/design-system-core";

const result = resolveDesignTokens({
  sources: [
    { id: "base", document: baseTokens },
    { id: "dark", document: darkModeTokens },
  ],
});
```

The bounded profile rejects alias cycles, missing or type-changing aliases, source type changes,
duplicate sources or overrides, overflow, unsafe JavaScript containers, property-level aliases,
unsupported token types, wide-gamut color spaces, and unsupported complex stroke styles. A safely
captured unsupported document is returned only as rejection context; no partial token map is
authorized.

## Boundary

This package contains no React, DOM, browser, CSS, storage, network, persistence, renderer,
publisher, or runtime authority. App UI and theme authoring start in M10A-T03; project persistence,
asset import, recipe/master materialization, connection execution, release packaging, and App
integration remain their explicitly assigned later tasks. Publisher and Runtime do not depend on
this package.

The historical SC-01 artifact remains the closed 26-token color/dimension interoperability proof.
The broader project profile here coexists with it and does not reinterpret or expand that evidence.
