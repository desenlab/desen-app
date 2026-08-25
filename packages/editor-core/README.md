# @desen/editor-core

## Responsibility

Framework-neutral immutable commands for editing a DESEN Source with stable identity.

## Direct Source document model

`createDesenEditorDocument(input)` admits inert JSON through the frozen DESEN 0.1.0 Source and
embedded-schema structural validator. A success returns `document`, which is the direct
recursively immutable `desen.source` root—not a wrapper, normalized projection, hidden AST, or
node index. The caller input is never retained or frozen.

```ts
import { createDesenEditorDocument } from "@desen/editor-core";

const result = createDesenEditorDocument(sourceInput);
if (result.ok) {
  result.document.kind; // "desen.source"
}
```

Creation deliberately does not require Catalog-backed semantic validity. Continuous validation
and invalid-node mapping belong to M08-T09, while mutation commands, stable-ID allocation,
authoring isolation, and persistence belong to their later tracked M08 tasks. Structural rejection
returns the frozen protocol diagnostics and no partial document.

## Explicit non-responsibilities

No React, DOM, canvas UI, production activation, or hidden document model.

## Status

Private. M08-T01's direct Source document model is complete; stable-ID allocation and insert
commands remain next under M08-T02, followed by the other tracked editor command tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral unless explicitly adapted

## Quality

Run the direct model suite with
`pnpm --filter @desen/editor-core test:source-document`. The separate
`pnpm --filter @desen/editor-core test:public-package` check builds the package, resolves the
public root through its export map, runs ten emitted-JavaScript contract cases, compiles five
negative assertions against the emitted declarations, and exercises seven fail-closed in-memory
proof-core cases. The proof core audits the exact source, distribution, manifest, TSDoc, test
inventory, and platform boundary. After authenticating the exact completed I07-04/G07 prerequisite,
`node scripts/generate-editor-core-source-document-proof.mjs` writes the tracked artifact,
`node scripts/verify-editor-core-source-document.mjs` verifies it, and
`node --test tests/editor-core-source-document.test.mjs` runs 13 independent adversarial cases over
47 tracked-file receipts. Those receipts include the exact 24-file editor/validator/protocol
runtime closure executed from an isolated temporary package graph. A composed frozen authority
uses the M02-T11 baseline plus eight reviewed M08 successor receipts to authenticate its 19
dependency modules. `pnpm check` includes the same proof. The evidence document is
`docs/proof/EDITOR-CORE-SOURCE-DOCUMENT.md`.
