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
and invalid-node mapping belong to M08-T09, while broader mutation commands, authoring isolation,
and persistence belong to their later tracked M08 tasks. Structural rejection returns the frozen
protocol diagnostics and no partial document.

## Stable-ID insertion

`insertDesenEditorNode(document, command)` inserts one minimal `{ id, use }` leaf into the exact
named-slot boundary addressed by `surfaceId`, `parentId`, `slot`, and `index`. The command supplies
an `idBase`, not an explicit identity: the editor uses the exact base when free or the lowest free
`-2`, `-3`, ... suffix in the selected surface's shared node-and-behavior identity namespace. A
suffix truncates the base from the right only as needed to preserve the protocol's 128-character
local-ID ceiling.

The transition is atomic and deterministic. Success returns a fresh detached recursively frozen
direct Source document plus `insertedNodeId`; failure returns a nonempty frozen diagnostic list and
no partial document or allocated identity. Existing identities and semantic array order are
preserved. A node or behavior may own the target slot, and a missing slot may be created only at
index zero. Structurally valid slot names that overlap `Object.prototype` are resolved and created
only as own data. Unresolved capability and slot semantics remain representable for M08-T09.

The fixed finite profile admits at most 25,000 node/behavior identity occurrences per surface,
target-surface component depth 64 with the root at depth zero, a 4,096-code-unit capability ID, and
an 8 MiB canonical editor document. `PF-079` records the editor-specific allocation, target,
atomicity, limit, and
diagnostic choices that DESEN 0.1.0 leaves open.

## Explicit non-responsibilities

No React, DOM, canvas UI, production activation, or hidden document model.

## Status

Private. M08-T01's direct Source document model and M08-T02 stable-ID allocation/insertion are
complete. Delete, move, and ordered reorder commands are next under M08-T03; the remaining editor
commands stay assigned to their tracked M08 tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral unless explicitly adapted

## Quality

Run the direct model suite with
`pnpm --filter @desen/editor-core test:source-document` and the insert suite with
`pnpm --filter @desen/editor-core test:stable-id-insert`. The separate
`pnpm --filter @desen/editor-core test:public-package` check builds the package, resolves the
public root through its export map, runs fifteen emitted-JavaScript contract cases plus seven
fail-closed in-memory proof-core cases for 22 Node tests, and compiles eleven `@ts-expect-error`
assertions against the emitted declarations. The proof cores audit the exact source, distribution,
manifest, TSDoc, test inventory, and platform boundary. After authenticating the exact completed
I07-04/G07 prerequisite,
`node scripts/generate-editor-core-source-document-proof.mjs` writes the tracked artifact,
`node scripts/verify-editor-core-source-document.mjs` verifies it, and
`node --test tests/editor-core-source-document.test.mjs` runs 13 independent adversarial cases over
47 tracked-file receipts. Those receipts include the exact 24-file editor/validator/protocol
runtime closure executed from an isolated temporary package graph. A composed frozen authority
uses the M02-T11 baseline plus eight reviewed M08 successor receipts to authenticate its 19
dependency modules. `pnpm check` includes the same proof. The evidence document is
`docs/proof/EDITOR-CORE-SOURCE-DOCUMENT.md`.

For M08-T02, `node scripts/generate-editor-core-stable-id-insert-proof.mjs` writes the stable-ID
artifact, `node scripts/verify-editor-core-stable-id-insert.mjs` verifies its exact bytes and final
document pin, and `node --test tests/editor-core-stable-id-insert.test.mjs` runs ten independent root
cases. Its behavior probes execute an isolated 25-file ESM graph copied only from authenticated
editor-core, protocol, and validator bytes; the Node runtime, ESM loader, and process environment
remain trusted authorities rather than a hostile-JavaScript sandbox. The artifact records 53 exact
tracked-file receipts, including the 21-file protocol/validator dependency closure authenticated
against the frozen M08-T01 artifact. The evidence document is
`docs/proof/EDITOR-CORE-STABLE-ID-INSERT.md`.
