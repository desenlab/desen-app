# Editor Core Event and Closed-Action Edits Proof

## Result

Task: `M08-T06`

Result: `PASS`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json` (31,310 bytes)

Final artifact: `sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`

## Direct frozen prerequisite

The proof directly authenticates only the exact frozen M08-T05 state-and-binding edit artifact:
30,014 bytes at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`. The read is bounded,
no-follow, canonical-parent, and single-link; the named path, file identity, and root and parent
directory identities are rechecked after acquisition. Caller-supplied bytes cannot issue PASS.
The proof also confirms the frozen artifact's reviewed M08-T02 prerequisite and M08-T04 embedded
compatibility chain without widening M08-T06's sole official dependency beyond M08-T05.

## Exact package and execution authority

The public root exposes 33 runtime exports and 69 type exports. M08-T06 contributes six runtime
commands and fourteen public types; all twenty task-owned declarations retain TSDoc in source and
emitted declarations. The emitted package graph remains platform-neutral across 28 emitted files
and seventeen exact static ESM edges, with no unknown edge.

Behavior is imported only after copying authenticated bytes into an isolated 29-file ESM graph:
eight editor files and 21 dependency files. Five retained editor runtime files and every dependency
runtime file must match the M08-T05 receipts before import. The proof records 81 exact tracked-file
receipts and does not use the workspace module cache as execution authority. Node.js, its ESM
loader, and the process environment remain trusted authorities.

The focused suite contains 16 runtime cases and nineteen compiler-negative assertions. The
cumulative emitted-package contract contains 44 runtime/root cases and 69 compiler-negative
assertions. The independent root proof contains ten authority, determinism, behavior, mutation,
artifact, writer, filesystem, options, and immutability cases.

## Six immutable event and action commands

The public package exposes event-handler insert/delete and action insert/replace/delete/reorder.
Commands address a unique surface-local node or behavior owner. Root event lists and recursive
`operation.invoke` settlement lists use canonical owner-relative RFC 6901 pointers. Reorder uses a
post-removal final index; deleting final handlers or actions deliberately retains empty event maps,
event action arrays, and settlement arrays.

All seven DESEN 0.1.0 action variants are captured whole as inert data. Guards, navigation params,
operation and component inputs, event payloads, nested success/failure actions, and extensions are
neither executed nor semantically resolved. Prototype-sensitive event and payload member names
remain own data. Missing or duplicate targets, ambiguous owners, invalid positions or pointers,
malformed commands, finite-profile overflow, and structural re-admission failures are atomic and
expose no partial Source.

## Defensive JavaScript boundary and fixed limits

Commands require exact enumerable own data descriptors. Accessors and `toJSON` hooks are rejected
without invocation. JavaScript reflection over an arbitrary `Proxy` may execute traps; an honest
forwarding Proxy may be admitted and a throwing trap is contained as
`EVENT_ACTION_EDIT_COMMAND_INVALID`. This is not a hostile-JavaScript or no-code-execution
membrane.

The profile admits exactly 8,388,608 canonical Source bytes, 25,000 identities per selected
surface, 25,000 action occurrences per selected owner, source-tree depth 64 with root at zero, and
action nesting depth 64 with root actions at zero. Each exact ceiling passes and its one-unit
crossing fails before mutation. These are canonical input/output limits, not streaming or
preallocation memory-DoS guarantees.

## Honest remaining scope

M08-T07 retains authoring isolation and the complete unknown-extension round-trip proof. M08-T08
retains persistence. Event/action reference resolution, Catalog compatibility, state/operation/
resource/component semantics, continuous diagnostics, and invalid-node mapping remain M08-T09.
Action execution and runtime turns are outside this editor command proof. Undo/redo, selection,
viewport policy, the terminal React/DOM boundary, M08-T10, and G08 remain unclaimed. No P-18 or G08
advancement is claimed.

## Reproduction

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:event-action-edits
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-event-action-edits-proof.mjs
node scripts/verify-editor-core-event-action-edits.mjs
node --test tests/editor-core-event-action-edits.test.mjs
```
