# Desen App Catalog panel and layer tree

Task: M09-T02

Status: DONE

M09-T02 extends the authenticated M09-T01 application shell with a read-only authoring panel. The
component library is projected from the exact `@desen/reference-catalog-web/catalog.json` export,
and the Layers view preserves the exact component and slot order from
`examples/sign-in/official-derived.source.desen.json`. Component labels, authoring categories,
semantic categories, descriptions, and slot acceptance metadata are Catalog-owned data rather than
a parallel App list.

The read model is issued only after `validateDesenInteractionCatalogSet` accepts the cumulative
Catalog set and `validateDesenSourceInteractionContracts` accepts the official Source against that
set. Catalog rejection, unresolved Source capabilities, and bounded-projection limit failures return
no partial authoring model. The exact M03-T10 capability artifact remains the immutable historical
package authority; the live Catalog receipt records its reviewed successor bytes without rewriting
that historical evidence.

The authoring panel exposes keyboard-operable Layers and Components tabs, an inert local component
filter, and a read-only labelled-list hierarchy. A surface without an exact Source fixture reports
that absence explicitly and never substitutes the sign-in tree. The hierarchy deliberately does not
claim interactive ARIA tree semantics.

## Closed boundary

The App source graph admits only two DESEN package surfaces: inert
`@desen/reference-catalog-web/catalog.json` and the two named cumulative-validation APIs from
`@desen/validator`. It rejects Editor Core, Catalog SDK, Runtime React, adapter registries, dynamic
imports, platform I/O, drag/drop mutation handlers, canvas elements, and inspector elements.

This slice does not claim a real adapter canvas, selection, inspector controls, insertion, move,
delete, undo/redo, Source mutation, persistence, Design/Run execution, diagnostics, save/open,
publication, or activation. Those remain assigned to later M09 tasks.

## Verification

Focused application coverage:

```sh
pnpm --filter @desen/app-web test:authoring
```

Deterministic root evidence:

```sh
pnpm generate:desen-app-catalog-panel-layer-tree
pnpm verify:desen-app-catalog-panel-layer-tree
pnpm test:desen-app-catalog-panel-layer-tree
```

Artifact:
`docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json`

Final artifact: 25,375 bytes at
`sha256:cdcb1cf0caf55ebac13f9affb122da52c6c8ba58a1bda7eb030ac1641bcbed73`.

The focused App authoring suite passes 18/18 and the independent root proof passes 8/8. The live
local CI authority contains 176 workloads and 83 proof pairs, split into 72 ordinary pairs and 11
barriers. The formal impact entry has the exact M09-T01 shell and M03-T10 reference capability as
parents, producing a 66-workload affected closure. The local task wrapper invokes those two
artifact verifiers directly and does not recursively replay their predecessor chains.

Append-only checkpoint sequence 41 passes 64/64 and closes at
`sha256:9b591c7a4c1e1e723cc587e5f8958f356a3a1e0e6f6d7088447d7d9aec08796e`, authenticating 37
frozen artifacts and 74 readers while preserving exact sequence 40 at
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e` and every predecessor.
These are local task and CI-infrastructure receipts; they make no required-gate or hosted-CI claim.
