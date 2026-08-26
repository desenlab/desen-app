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

## Structural edits

`deleteDesenEditorNode(document, command)` removes the addressed non-root node and its complete
subtree while preserving the vacated slot as an own key with `[]`.
`moveDesenEditorNode(document, command)` moves one intact subtree only to a different owner or
slot; a missing destination slot may be created only at index zero.
`reorderDesenEditorNode(document, command)` applies only within one owner and slot, and its `index`
is the child's final position after removal from the original array.

All three commands preserve every surviving ID and the exact order of unaffected children. Node
and behavior instances may own destination slots, including own-data slot names such as
`constructor`. Move rejects root targets, cycles, self-descendant destinations, missing or
ambiguous identities, and same-slot use; reorder rejects cross-owner/slot use. Structurally valid
unresolved semantics remain authorable. Success is a fresh detached recursively frozen direct
Source; every command or structural failure is atomic and returns only frozen diagnostics.

The structural commands reuse the 8 MiB canonical Source, 25,000 selected-surface identities, and
root-at-zero depth-64 profile. They carry no capability-ID input, so the authenticated
4,096-code-unit capability ceiling is retained without being widened. Command objects must be
exact inert own data: inherited, accessor, symbol, and extra fields fail closed.

## Content edits

M08-T04 adds fourteen commands over the same direct Source boundary:

- `setDesenEditorOwnerProp` and `deleteDesenEditorOwnerProp` edit base props on a uniquely
  identified component node or behavior;
- `setDesenEditorOwnerStyleProperty` and `deleteDesenEditorOwnerStyleProperty` edit one exact
  visual-state/style-part/property leaf on a node or behavior;
- `setDesenEditorNodeCondition` and `clearDesenEditorNodeCondition` edit component-node conditional
  presence; and
- `insertDesenEditorVariant`, `deleteDesenEditorVariant`, `reorderDesenEditorVariant`,
  `setDesenEditorVariantCondition`, `setDesenEditorVariantProp`,
  `deleteDesenEditorVariantProp`, `setDesenEditorVariantStyleProperty`, and
  `deleteDesenEditorVariantStyleProperty` provide complete indexed variant lifecycle and leaf
  updates.

Variant insertion addresses an existing array boundary and may create an absent `variants` array
only at index zero. Reorder uses the selected variant's final index after removal. Set commands
create missing prop/style containers. Delete commands require the selected leaf to exist and retain
own empty `props`, nested style state/part, and `variants` containers; condition clear removes the
existing `when` member. Every success preserves all node and behavior IDs plus unaffected semantic
array order and returns a fresh detached recursively frozen Source. Required fields must be exposed
by JavaScript reflection as enumerable own data descriptors. Inherited, accessor, symbol,
extra-field, function-valued, own-`toJSON`, sparse-array, malformed-Unicode, and unsafe-index shapes
are rejected; accessor getters and `toJSON` hooks are not invoked. Reflection over an arbitrary
JavaScript `Proxy` may execute traps. A forwarding Proxy that exposes the admissible shape may be
accepted; a throwing reflection trap becomes `CONTENT_EDIT_COMMAND_INVALID`, exposes no partial document,
and leaves the prior Source unchanged. This is an inert captured-data boundary, not a
hostile-JavaScript or no-code-execution membrane. Missing or ambiguous targets, missing paths,
invalid positions, limit overflow, and structural re-admission failure are likewise atomic.

These are structural authoring commands. Prop names, style parts, visual states, tokens, bindings,
and other Catalog-backed meanings may remain unresolved until M08-T09 supplies continuous semantic
validation and invalid-node mapping. The content commands reuse the fixed 8 MiB canonical-document,
25,000 selected-surface identity, and root-at-zero depth-64 profile. `PF-081` records the exact path,
empty-container, ordering, atomicity, and diagnostic choices that DESEN 0.1.0 leaves open.

## Explicit non-responsibilities

No React, DOM, canvas UI, production activation, Catalog-semantic validation, state/binding/event/
action editing, persistence, authoring selection/viewport policy, or hidden document model.

## Status

Private. M08-T01's direct Source document model, M08-T02 stable-ID allocation/insertion, M08-T03
delete/move/ordered-reorder commands, and M08-T04 prop/style/condition/variant commands are present.
The remaining editor commands stay assigned to their tracked M08 tasks. `N-014` is `TESTED`;
`S-002` remains `PLANNED` through terminal M08-T10 integration.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral unless explicitly adapted

## Quality

Run the direct model suite with
`pnpm --filter @desen/editor-core test:source-document` and the insert suite with
`pnpm --filter @desen/editor-core test:stable-id-insert`. The separate
`pnpm --filter @desen/editor-core test:public-package` check builds the package, resolves the
public root through its export map, runs the exact current 32 runtime/root cases, and compiles the
reviewed `@ts-expect-error` assertions against the emitted declarations. The proof cores audit the
exact source, distribution, manifest, TSDoc, test inventory, and platform boundary. After
authenticating the exact completed
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

For M08-T03, run `pnpm --filter @desen/editor-core test:structural-edits`, then
`node scripts/generate-editor-core-structural-edits-proof.mjs`,
`node scripts/verify-editor-core-structural-edits.mjs`, and
`node --test tests/editor-core-structural-edits.test.mjs`. The focused suite has sixteen behavior
cases plus ten compiler-negative assertions; the independent root proof has ten cases. It verifies
60 exact tracked-file receipts and runs behavior only from an isolated authenticated 26-file ESM
graph. The 22,402-byte artifact is
`docs/proof/artifacts/editor-core-0.1.0-structural-edits.json` at
`sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`; its evidence document is
`docs/proof/EDITOR-CORE-STRUCTURAL-EDITS.md`.

For M08-T04, run `pnpm --filter @desen/editor-core test:content-edits` and
`pnpm --filter @desen/editor-core test:public-package`. The cumulative emitted-package suite has 32
runtime/root cases and 36 compiler-negative assertions. It executes all fourteen public content
commands across base node/behavior edits, node conditions, ordered variant lifecycle and updates,
empty-container deletion, missing/ambiguous/invalid failures, exact own-data rejection, controlled
throwing-Proxy failure, forwarding-Proxy admission, immutability, deterministic output, stable
identity, and unresolved Catalog semantics. The completed task-specific generator, verifier, root
proof, final artifact hash, and exact receipt inventory are recorded in
`docs/proof/EDITOR-CORE-CONTENT-EDITS.md` and the referenced frozen artifact.
