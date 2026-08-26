# Editor Core State and Binding Edits Proof

## Result

Task: `M08-T05`

Result: `PASS`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json` (30,014 bytes)

Final artifact: `sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`

## Direct frozen prerequisite

The proof directly authenticates only the exact frozen M08-T02 stable-ID artifact: 19,561 bytes at
`sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`. The read is bounded,
no-follow, canonical-parent, and single-link; its named path, file identity, and root and parent
directory identities are rechecked after acquisition. A live reader or checkpoint head cannot
substitute for these bytes.

## Current graph compatibility

Separately from the task prerequisite, the proof authenticates the exact 26,988-byte frozen M08-T04
content-edit artifact at
`sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`. It requires that
artifact's embedded M08-T02 and M08-T03 chain and uses its receipts to authenticate the retained
Source, insert, structural-edit, content-edit, protocol, and validator runtime bytes. This
compatibility authority does not widen M08-T05's official prerequisite beyond M08-T02.

## Exact package and execution authority

The reviewed public root now exposes 27 runtime exports and 55 type exports. M08-T05 contributes
exactly eight runtime commands and fifteen public types; all 23 task-owned declarations retain
TSDoc in source and emitted declarations. The emitted package graph remains platform-neutral and
has fourteen exact static ESM edges with no unknown edge.

Behavior is imported only after copying authenticated bytes into an isolated 28-file ESM graph:
seven editor files and 21 dependency files. The proof records 74 exact tracked-file receipts and
does not use the workspace module cache as execution authority. Node.js, its ESM loader, and the
process environment remain trusted rather than being claimed as a hostile-code sandbox.

The focused suite passes 14/14 runtime cases and retains fourteen compiler-negative assertions;
the cumulative editor-core package suite passes 69/69. The cumulative emitted-package suite
passes 38/38 runtime/root cases and retains 48
compiler-negative assertions. The independent root proof passes 10/10 authority, determinism,
behavior, mutation, artifact, writer, filesystem, options, and immutability cases.

## Eight immutable state and binding commands

The public package exposes exactly eight commands: state declaration insert/delete,
state schema/initial replacement, node repeat items/key replacement, and resource-input set/delete.
State deletion retains the required empty state map and does not rewrite references or actions.
Repeat edits require an existing repeat and preserve its alias, limit, and extensions. Resource
input deletion retains the required empty input map; arbitrary valid JSON member names are handled
as own data. Binding values and state data are captured whole rather than interpreted or rewritten.

Every success must return a fresh detached recursively frozen direct Source while preserving every
node and behavior identity plus unrelated semantic order. Missing, existing, and ambiguous targets,
missing paths, malformed input, profile overflow, and structural re-admission failure must be
atomic and expose no partial document.

## Defensive JavaScript boundary and fixed limits

Commands require exact enumerable own data descriptors. Accessors and own `toJSON` hooks are
rejected without invocation. JavaScript reflection over an arbitrary `Proxy` may execute traps; a
forwarding Proxy may be admitted and a throwing reflection trap must be contained as
`STATE_BINDING_EDIT_COMMAND_INVALID`. This is not a hostile-JavaScript or no-code-execution
membrane.

The profile retains the 8,388,608-byte canonical Source, 25,000 target-surface identity, and
root-at-zero depth-64 ceilings. Structural failures retain frozen protocol diagnostics rather than
being relabeled as editor diagnostics. These are canonical input/output limits, not streaming or
preallocation memory-DoS guarantees.

## Honest remaining scope

M08-T06 retains event and closed-action editing. M08-T07 retains authoring isolation and unknown
extension preservation; M08-T08 retains persistence. Structural admission already rejects an
invalid Draft 2020-12 state schema; initial/schema compatibility, dotted-state reachability,
repeat semantics, Catalog resource-input
contracts, continuous diagnostics, and invalid-node mapping remain M08-T09. M08-T10 and G08 retain
the terminal React/DOM and integration boundary. No P-18 or G08 advancement is claimed.

## Reproduction

The commands below reproduce the finalized implementation, focused/public tests, and exact
artifact pin.

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:state-binding-edits
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-state-binding-edits-proof.mjs
node scripts/verify-editor-core-state-binding-edits.mjs
node --test tests/editor-core-state-binding-edits.test.mjs
```
