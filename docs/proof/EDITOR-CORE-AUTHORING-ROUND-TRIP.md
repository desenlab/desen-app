# Editor Core Authoring and Unknown-Extension Round-Trip Proof

## Result

Task: `M08-T07`

Result: `PASS`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json` (62,304 bytes)

Final artifact: `sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`

## Frozen authority

The proof directly authenticates the exact frozen M08-T01 through M08-T06 editor artifacts. Their
task IDs and SHA-256 receipts are:

- `M08-T01` `sha256:aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025`
- `M08-T02` `sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`
- `M08-T03` `sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`
- `M08-T04` `sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`
- `M08-T05` `sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`
- `M08-T06` `sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`

All six reads are bounded, no-follow, canonical-parent, single-link authority reads with named-file
and directory identity rechecks. Caller-supplied prerequisite bytes, paths, runtimes, tracked-file
overrides, and authority hooks cannot issue PASS. The frozen historical artifact bytes remain
unchanged; live M08-T01 through M08-T06 readers advance to authenticate the proof-only M08-T07
successor and are resealed by CI sequence 35.

The proof also authenticates the frozen protocol baseline, checksum manifest, SPEC, Source schema,
Bundle schema, and Catalog schema bytes. The complete snapshot remains 31 files and 306,604 bytes
at aggregate
`sha256:afe8fc359465ce891f4325fcdeca4b2f12bca48f1aa54a34c4f3a97985f7e060`.
The schemas declare seventeen Source/Bundle extension points and expose sixteen reachable points in
each document graph. The reviewed SPEC requires unknown extensions to survive round trips without
core semantics, makes reverse-domain naming guidance, and excludes root authoring from the Source
digest and production Bundle.

For `N-018`, the proof additionally authenticates the exact frozen M06-T07 through M06-T10
publisher artifacts at their reviewed hashes: source normalization
`sha256:59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e`,
catalog pinning
`sha256:de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f`,
Bundle publication
`sha256:2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df`,
and the official golden
`sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`.
Those artifacts prove root-authoring digest and terminal-Bundle exclusion; the current evidence adds
the editor transition and parsed-value round-trip half of that clause.

## Exact package and execution authority

M08-T07 is proof-only. The public package retains exactly 33 runtime and 69 type exports and adds no
runtime command, public type, source module, or export-map root. The emitted graph remains
platform-neutral across 28 emitted files and seventeen exact static ESM edges, with no unknown
edge. The zero-export delta is derived by exact-comparing the current source index, emitted runtime
index, and emitted declaration index against the authenticated M08-T06 artifact's 33 runtime and
69 type export arrays; the local allowlists remain an independent shape check.

Behavior runs only after exact receipted bytes are copied into an isolated 29-file ESM graph: eight
editor files and 21 protocol/validator dependency files. All seven retained editor JavaScript files
and every dependency runtime file match the frozen M08-T06 receipts before import. The artifact
records 95 exact current tracked-file receipts, including both the focused runtime test and its
compiler-negative source. Node.js, its ESM loader, and the process environment remain trusted
authorities.

## Root authoring isolation

The factory and every one of the 32 immutable commands preserve two distinct complete root
`authoring` values as detached, recursively frozen producer-owned parsed data. For each paired
transition, deleting only root authoring yields canonical-equal Source projections and equal
protocol Source digests. Changing a root extension value changes the digest, so the exclusion does
not widen beyond root authoring.

Authoring and extension payloads contain node IDs, capability names, references, and actions that
look like core data. The stable-ID allocator still chooses exact `sign-in.inserted`; fake authoring
and extension owner IDs remain not-found to owner scans. Separate authoring, root-extension, and
deep nested-action-extension fixtures each contain 25,001 action-shaped values—one over the 25,000
core action ceiling—yet an unrelated real owner edit succeeds. A separate owner-shaped object in
that deep action extension remains `CONTENT_EDIT_TARGET_NOT_FOUND`. These values therefore do not
enter stable-ID, owner-identity, or action scans and receive no core semantics.

The complete Source byte ceiling still includes root authoring. A fixture whose authoring padding
brings the canonical Source to 8,388,609 bytes is rejected as exactly one byte over the 8 MiB
profile; the same 1,903-byte Source without root authoring admits the control edit. Authoring is
digest-excluded production metadata, not limit-exempt input.

## Unknown-extension preservation and lifecycle

The fixture reaches all sixteen Source locations: the Source root, seven closed action variants,
variant, behavior, repeat, node, state declaration, resource instance, surface, and Source catalog
requirement. Every location contains both the recommended reverse-domain
`com.example.editor-roundtrip` marker and the legal non-namespaced `legacy-marker`. Nested arrays,
duplicate ordered values, Unicode, null and empty values, own `__proto__`, `constructor`, and
`prototype` keys, and apparent core fields remain exact inert parsed data. The package README
retains reverse-domain guidance without turning it into a hard validation rule.

The factory, all 32 command results against both authoring variants, and the extension-differential
factory result are serialized with `JSON.stringify`, parsed, and re-admitted through
`createDesenEditorDocument`. All 67 reopened Sources are canonical-equal, detached, recursively
frozen, and retain the expected authoring and extension values.

Lifecycle-specific vectors prove the owner-aware boundary:

- inserting an action carries its supplied marker exactly;
- moving and reordering nodes carry their markers to new JSON Pointers without changing values;
- deleting a node removes only its target-owned marker;
- whole-action replacement removes the old target marker and carries the supplied replacement;
- unrelated node and action markers remain exact through every lifecycle operation.

This deliberately does not claim survival for an extension owned by a node that is deleted or a
whole value that is replaced. Preservation applies to retained Source values and owners.

## Test authority and honest remaining scope

The focused suite passes 33 runtime cases—one factory case and one for each of 32 commands—plus six
compiler-negative assertions. The cumulative built public-package contract passes 46 runtime/root
cases and 75 emitted-declaration compiler-negative assertions. The independent root proof passes
ten authority, determinism, behavior, mutation, artifact, writer, filesystem, options, and
immutability cases.

This is parsed JSON value preservation, not lexical whitespace, original member-order, or input
byte preservation. M08-T08 owns persistence ports, storage I/O, save/open behavior, and durability.
M08-T09 owns Catalog-backed continuous semantic diagnostics and invalid-node mapping. M08-T10 owns
terminal React/DOM integration, cross-command terminal determinism, and G08. Unknown extensions do
not gain core semantics here. Action execution, undo/redo, selection/viewport policy, a hostile
JavaScript sandbox, streaming/preallocation memory-DoS bounds, P-18 advancement, and G08 advancement
remain outside this evidence.

`N-012`, `N-018`, and `S-003` are `TESTED`. `N-014` remains `TESTED`; `S-002` remains assigned to
terminal M08-T10 integration. No `P-*` or proof-gate status changes.

## Reproduction

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:authoring-round-trip
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-authoring-round-trip-proof.mjs
node scripts/verify-editor-core-authoring-round-trip.mjs
node --test tests/editor-core-authoring-round-trip.test.mjs
```
