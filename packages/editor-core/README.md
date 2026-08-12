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

Private. The direct Source document model is implemented under M08-T01; editor commands remain
tracked by M08-T02 through M08-T07.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral unless explicitly adapted

## Quality

Use the root workspace quality gate: `pnpm check`.
