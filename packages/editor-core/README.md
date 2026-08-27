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
and invalid-node mapping belong to M08-T09, while persistence belongs to M08-T08. M08-T07 now
proves authoring isolation across this factory and the complete existing mutation surface without
adding another runtime command. Structural rejection returns the frozen protocol diagnostics and
no partial document.

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

## State declaration and binding edits

M08-T05 adds eight whole-value commands:

- `insertDesenEditorStateDeclaration` and `deleteDesenEditorStateDeclaration` manage complete
  surface-local declarations without renaming or cascading into references and actions;
- `setDesenEditorStateSchema` and `setDesenEditorStateInitial` replace one existing declaration's
  complete schema or inert initial JSON value;
- `setDesenEditorNodeRepeatItems` and `setDesenEditorNodeRepeatKey` replace the corresponding
  ValueSpec roots on a uniquely identified component node with an existing repeat; and
- `setDesenEditorResourceInput` and `deleteDesenEditorResourceInput` create, replace, or remove one
  complete resource-input ValueSpec while retaining the required input map.

Dotted state names remain literal declaration keys. Marker-shaped state initial objects remain
inert JSON rather than becoming executable bindings. Repeat commands preserve the coupled alias,
limit, extensions, and untouched value; resource-input names, including prototype-sensitive names,
are created as own data. The same exact-command, detached immutable success, atomic failure, stable
identity, Proxy-reflection honesty, and 8 MiB/25,000/depth-64 profile applies. Structural schema and
ValueSpec rejection is preserved as frozen protocol diagnostics. Initial/schema compatibility,
dotted reference reachability, repeat semantics, and Catalog resource-input contracts remain
M08-T09 continuous-validation responsibilities. `PF-082` records these lifecycle and whole-value
decisions.

## Event and closed-action edits

M08-T06 adds six whole-value and ordered-list commands:

- `insertDesenEditorEventHandler` and `deleteDesenEditorEventHandler` manage one exact owner event
  key on a uniquely identified component node or behavior;
- `insertDesenEditorAction`, `replaceDesenEditorAction`, and `deleteDesenEditorAction` edit one
  complete closed `ActionSpec` in a root event list or nested operation settlement list; and
- `reorderDesenEditorAction` moves an existing action to its final post-removal index.

Action lists use an owner-relative typed RFC 6901 pointer. A root list is `/on/<event>`; nested
`onSuccess` or `onFailure` steps descend only through `operation.invoke` actions. Event-handler
insertion may create an absent own `on` map. Generic action insertion requires an existing root
handler and may create an absent settlement list only at index zero. Deletion retains empty own
event, `onSuccess`, and `onFailure` arrays; deleting the handler retains an own empty `on` map.

Whole-action replacement atomically covers all seven frozen variants, including guards,
navigation params, operation input/concurrency/settlements, component input, event payload, and
extensions. The editor neither executes these values nor resolves, rewrites, normalizes, or
cascades their references. Structurally valid unknown state paths, surfaces, operations,
resources, component targets, commands, and emitted events remain authorable until M08-T09. The
same exact-command, detached immutable success, atomic failure, stable-identity, and
Proxy-reflection boundary applies. Recursive settlement addressing has an independent 64-step
mechanical cap in addition to the shared 8 MiB/25,000/depth-64 Source profile; runtime action-turn
budgets are not treated as authoring-list limits. `PF-083` records the exact lifecycle, pointer,
ordering, replacement, limit, and diagnostic decisions.

## Authoring isolation and extension round trips

M08-T07 is a proof-only profile over the existing factory and all 32 immutable mutation commands;
it adds no runtime API or export. Root `authoring` remains detached, recursively immutable,
producer-owned parsed data through every successful transition. Two otherwise identical Sources
that differ only in root `authoring` produce identical authoring-excluded transition projections
and identical protocol Source digests. Root authoring values that resemble nodes, actions, or
special JavaScript property names remain inert and are not interpreted as core Source structure.

Unknown `extensions` parsed values are preserved exactly at all 16 Source-reachable extension
locations: the Source root, all seven closed action variants, variants, behaviors, repeats, nodes,
state declarations, resource instances, surfaces, and Source catalog requirements. Their nested
arrays, duplicate ordered values, Unicode, null/empty values, dangerous own-data keys, apparent
core IDs/actions, and order remain data; editor-core assigns them no core semantics. Extension keys
**SHOULD** use a reverse-domain name such as
`com.example.editor.selectionColor`. This is guidance rather than a hard naming error: a legal
unknown non-namespaced key is also retained when the Source passes structural admission.

The proof serializes every factory and command result with `JSON.stringify`, parses it again, and
re-admits it through `createDesenEditorDocument`. The reopened Source is canonical-equal, detached,
recursively frozen, and retains exact authoring and extension parsed values. This remains an
in-memory parsed-value round trip; it does not claim preservation of input JSON whitespace or
object-member byte order. M08-T08 owns storage I/O, save/open behavior, and durability; M08-T09 owns
continuous semantic diagnostics; M08-T10 owns terminal React/DOM integration and its independent
determinism evidence.

## Explicit non-responsibilities

No React, DOM, canvas UI, production activation, Catalog-semantic validation, action execution,
persistence, authoring selection/viewport policy, or hidden document model.

## Status

Private. M08-T01's direct Source document model, M08-T02 stable-ID allocation/insertion, M08-T03
delete/move/ordered-reorder commands, M08-T04 prop/style/condition/variant commands, and M08-T05
state-declaration/repeat/resource-input commands, M08-T06 event/closed-action commands, and M08-T07
authoring-isolation/extension-round-trip proof are present. The remaining persistence, validation,
and terminal integration work stays assigned to M08-T08 through M08-T10. `N-012`, `N-014`,
`N-018`, and `S-003` are `TESTED`;
`S-002` remains `PLANNED` through terminal M08-T10 integration.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral unless explicitly adapted

## Quality

Run the direct model suite with
`pnpm --filter @desen/editor-core test:source-document` and the insert suite with
`pnpm --filter @desen/editor-core test:stable-id-insert`. The separate
`pnpm --filter @desen/editor-core test:public-package` check builds the package, resolves the
public root through its export map, runs the exact current 46 runtime/root cases, and compiles 75
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

For M08-T05, run `pnpm --filter @desen/editor-core test:state-binding-edits`, then
`node scripts/generate-editor-core-state-binding-edits-proof.mjs`,
`node scripts/verify-editor-core-state-binding-edits.mjs`, and
`node --test tests/editor-core-state-binding-edits.test.mjs`. The focused suite has fourteen
behavior cases and fourteen compiler-negative assertions; the cumulative public suite has 38
runtime/root cases and 48 compiler-negative assertions. The ten-case root proof authenticates the
formal M08-T02 prerequisite separately from the frozen M08-T04 current-graph compatibility
authority, executes an isolated 28-file ESM graph, and records 74 exact tracked-file receipts. The
30,014-byte artifact is
`docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json` at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`; its evidence document is
`docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md`.

For M08-T06, run `pnpm --filter @desen/editor-core test:event-action-edits`, then
`node scripts/generate-editor-core-event-action-edits-proof.mjs`,
`node scripts/verify-editor-core-event-action-edits.mjs`, and
`node --test tests/editor-core-event-action-edits.test.mjs`. The focused suite exercises node and
behavior handlers, all seven closed action variants, recursively nested operation settlement
lists, exact pointer/index semantics, whole-value replacement, immutable atomic ownership, hostile
command shapes, and finite limits. The final case counts, receipt inventory, artifact size/hash,
and isolated runtime closure are pinned in `docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md` and its
referenced frozen artifact.

For M08-T07, run `pnpm --filter @desen/editor-core test:authoring-round-trip` and
`pnpm --filter @desen/editor-core test:public-package`. The focused suite has 33 runtime cases—one
factory/root-digest case and one case for each of the 32 existing commands—plus six source
compiler-negative assertions. The cumulative emitted-package suite has 46 runtime/root cases and
75 compiler-negative assertions. It proves root-authoring isolation and exact parsed-value
preservation for all 16 Source-reachable extension locations, including both recommended
reverse-domain and legal non-namespaced unknown keys, without adding runtime authority or claiming
storage, semantic, or terminal behavior.
