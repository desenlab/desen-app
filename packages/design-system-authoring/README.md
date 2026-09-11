# @desen/design-system-authoring

Private, platform-neutral M10A-T03 foundation authoring for DESEN. The package provides immutable
theme selection, structured token and whole-alias edits, live preview, bounded undo/redo, and
deterministic loss-aware import/export over the frozen `@desen/design-system-core` token model.

It does not integrate with the normal Desen App, persist projects, publish immutable releases,
materialize recipes, interpret runtime behavior, or change DESEN Protocol 0.1.0. Those concerns
belong to later M10A tasks.

## Public entry point

Import the package through `@desen/design-system-authoring`; internal files are not public exports.
The root exports:

- `DESEN_NEUTRAL_THEME_DOCUMENT` and the authoring kind, schema-version, and finite-limit constants;
- document admission and session creation;
- theme, mode, literal-token, whole-token-alias, and delete edits;
- mode selection plus bounded undo and redo; and
- canonical JSON import and export with transfer reports.

The same entry point exports the immutable document, edit, session, preview, diagnostic,
compatibility-feature ID, and transfer-report TypeScript contracts.

## Minimal use

```ts
import {
  DESEN_NEUTRAL_THEME_DOCUMENT,
  applyThemeAuthoringEdit,
  createThemeAuthoringSession,
  exportThemeAuthoringDocument,
} from "@desen/design-system-authoring";

const created = createThemeAuthoringSession(DESEN_NEUTRAL_THEME_DOCUMENT);
if (!created.ok) throw new Error(created.diagnostics[0].message);

const changed = applyThemeAuthoringEdit(created.session, {
  kind: "set-literal",
  path: "palette.action",
  sourceId: "neutral.light",
  themeId: "desen-neutral",
  type: "color",
  value: { colorSpace: "srgb", components: [0.12, 0.34, 0.56] },
});
if (!changed.ok) throw new Error(changed.diagnostics[0].message);

const { report, text } = exportThemeAuthoringDocument(changed.session);
```

## Boundaries and compatibility

- Runtime target: side-effect-free ES2023 ESM. Production code has no React, DOM, CSS, browser,
  persistence, network, or Node API dependency.
- Dependencies: `@desen/design-system-core` owns the closed token model and resolver;
  `@desen/protocol` supplies deterministic canonical JSON primitives. This package does not own or
  weaken either boundary.
- Protocol: additive reference-application tooling beside frozen DESEN Protocol 0.1.0; the
  `desen.theme-authoring` envelope is not a new DESEN protocol document.
- Token profile: the frozen DTCG 2025.10 reference profile declared by
  `@desen/design-system-core`, including its supported types, sRGB colors, px/rem dimensions,
  ordered source overlays, whole-token aliases, and finite limits.
- Integration targets: trusted browser/App and Node-based tooling can consume the public ESM API.
  Normal Desen App composition and durable storage are not part of T03.

## Guarantees and failures

- DESEN Neutral starts as editable light and dark source overlays; valid custom values are not
  restricted to the default palette.
- Every base edit is checked against every mode before commit. Invalid edits and imports return a
  failure result containing one stable diagnostic and the exact prior session object.
- Imports reject duplicate members, unsafe values, malformed structure, invalid DTCG, and configured
  size/depth/count overflow atomically.
- A closed, validated DTCG 2025.10 preservation matrix covers standard color spaces and color
  options; group `$root`, empty-group, extension, and group-reference forms; same-document JSON
  Pointer and typed composite references; the standard `fontFamily`, `fontWeight`, `gradient`, and
  `strokeStyle` types; valid object stroke styles and optional shadow inset values; and the reviewed
  inline/same-document Resolver fixture. Data outside frozen T02 is retained byte-semantically and
  reported with an explicit feature ID and diagnostic. It never receives partial preview authority,
  so affected previews return `ok: false`.
- This compatibility layer is not a general DTCG or Resolver validator. Unknown types and reserved
  members, malformed values or references, missing targets, reference cycles, unsafe input, and
  recognized forms outside the closed matrix fail closed without replacing working data.
- Undo/redo history and revision growth are bounded. Export re-admits the package-created session,
  emits canonical JSON, and reports zero silent losses.
- Public operations accept only package-created session objects. Passing a forged session is a
  programmer error and throws `TypeError`; expected document, edit, selection, and import failures
  use result diagnostics instead.

## Verification

Run from the repository root:

```sh
pnpm --filter @desen/design-system-authoring build
pnpm --filter @desen/design-system-authoring typecheck
pnpm --filter @desen/design-system-authoring test
pnpm --filter @desen/design-system-authoring test:public-package
pnpm --filter @desen/design-system-authoring lint
```
