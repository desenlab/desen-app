# @desen/starter-catalog-web-proof

## Purpose and status

This private app is the isolated browser harness for the in-progress M10A-T05 starter-catalog
extension. It is not Desen App product UI and is not a general design canvas. Its authoring graph
turns four fixed Source fixtures into Bundles through `@desen/publisher`; its separately built host
graph accepts only those serialized Bundles and mounts them through the same static starter adapter
registry. The host graph contains no Editor or Publisher authority.

The four fixtures cover the existing Button, Select, and Dialog surfaces plus one nested
Box/Stack/Grid layout surface containing Heading, Text, Image, Icon, and Separator. They are
deterministic proof data, not Catalog discovery, application state, business content, package
delivery, activation, or a replacement for the normal DESEN App flow.

**T05 is `IN_PROGRESS`; this harness produces local candidate evidence only.** It makes no
exact-head hosted, fresh-`main`, merge, release, or product-readiness claim.

## What the browser proof checks

The exact Playwright inventory contains four cases:

- publishing four Source surfaces and rejecting undeclared capability, style-part, dimension,
  remote-image-source, and private-selector data;
- rendering nested logical RTL layout and semantic content in both the authoring and independent
  host graphs;
- keeping Select and Dialog interactions within the approved portal/focus boundary; and
- preserving protocol identity through session isolation, StrictMode remount, and host-graph
  isolation.

The layout case verifies declared logical style projection, nested slots, semantic heading/text/
separator output, including a visibly measured default vertical Separator in ordinary vertical
layout, trusted local SVG-data image output, labelled icon output, and browser-native Grid flow.
The publication case also proves that Image foreground `color` is rejected rather than silently
accepted: that CSS property cannot tint a replaced data-URI image, while Icon retains its trusted
inline-SVG foreground color surface. It does not prove arbitrary CSS, arbitrary HTML/SVG, user
asset import, responsive authoring, normal App integration, or runtime activation.

Each Vite graph emits a disposable module-closure receipt. The task verifier writes both graph
outputs only under its owned temporary directory; an ad-hoc package build uses `dist`. The authoring
graph must retain its Publisher edge; the host graph must exclude Editor and Publisher authority. The custom
`browser-proof.json` receipt is duration-free and derives only from those four completed cases;
Playwright's detailed `browser-report.json` remains a separate diagnostic record.

## Running locally

From the repository root, install the pinned browser once and build the public dependencies:

```bash
pnpm --filter @desen/starter-catalog-web-proof exec playwright install --with-deps chromium
pnpm --filter @desen/starter-catalog-web-proof... build
pnpm --filter @desen/starter-catalog-web-proof test:e2e
```

T05's verifier uses `test:e2e`: it typechecks and builds both graphs afresh while
`DESEN_M10A_T05_PROOF_TEMP` points to an existing, canonical, runner-owned absolute directory.
Those graph outputs, `browser-proof.json`, `browser-report.json`, and failure diagnostics stay
under that temporary directory. Playwright owns strict localhost port `4187`. For an ad-hoc local
run without the variable, the normal package build uses `dist` and Playwright creates an isolated
operating-system temporary report directory.

Use `pnpm generate:m10a-t05`, `pnpm verify:m10a-t05`, and `pnpm test:m10a-t05` for the task-owned
local evidence path. The candidate artifact is
[`docs/proof/artifacts/m10a-t05.json`](../../docs/proof/artifacts/m10a-t05.json); it is not a
hosted-closure receipt while T05 remains in progress.

## Historical boundary

M10A-T01's original artifact remains an immutable historical receipt. This harness now belongs to
T05's expanded browser observation and must not regenerate, overwrite, or relabel the historical
T01 artifact as current evidence.
