# Editor Core Content Edits Proof

## Result

Task: `M08-T04`

Result: `PASS`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-content-edits.json`

Final artifact: `sha256:eb79a60f2454f8a15044abd920fc87b24b068b6b42088c39b5af2c7214594e34`

## Direct frozen prerequisites

The proof independently authenticates the exact frozen M08-T02 stable-ID artifact at
`sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547` and the exact
frozen M08-T03 structural-edit artifact at
`sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`. Both reads are
bounded, no-follow, canonical-parent, single-link reads whose named path, file identity, and root
and parent directory identities are rechecked after acquisition. M08-T03 must retain its exact
embedded M08-T02 link. Neither a live proof reader nor a checkpoint head can substitute for these
artifact bytes.

## Fourteen immutable content commands

The public package exposes fourteen content commands for base node or behavior props, base style
leaves, component-node conditions, and ordered node variants. Variant insert, delete, reorder,
condition, prop, and style operations preserve post-removal final-position semantics and retain
deliberately emptied own containers. Catalog-unresolved values, predicates, variants, style parts,
and extension data remain structurally admissible; Catalog declarations and cardinality remain a
later continuous-validation concern.

Every success returns a fresh detached recursively frozen direct Source. Content edits rewrite no
node or behavior identity and preserve unrelated ordering. Prototype-sensitive valid names such as
`constructor` and `toString` are created and addressed as own data. Caller commands and nested
values are copied before mutation, so later caller changes cannot alter the result.

## Atomic diagnostics and fixed limits

Missing and ambiguous surface-local identities, missing paths, invalid variant positions, malformed
Unicode, extra authority, inherited properties, symbols, sparse values, accessors, and non-plain
commands fail closed. Accessors are rejected without invocation. Failure returns a frozen diagnostic
result and never exposes a partial Source. Structurally invalid output retains the underlying
`SCHEMA_INVALID` authority rather than being relabeled as a content-command failure.

The evidence exercises the exact 8,388,608-byte canonical Source, 25,000 target-surface identity,
and root-at-zero depth-64 ceilings plus one-unit crossings. These are canonical input/output bounds,
not streaming or preallocation memory-DoS guarantees.

## Public package and isolated execution authority

The proof pins the source, emitted JavaScript, declarations and maps, focused and public tests,
compiler-negative assertions, package boundary, proof harness, official fixture, atomic writer, and
complete protocol/validator runtime closure with exact byte receipts. It requires nineteen runtime
exports, forty type exports, thirty-six documented content declarations, sixteen focused behavior
cases, six focused compiler-negative assertions, thirty-two public runtime/root cases, thirty-six
public compiler-negative assertions, and ten root proof cases.

Behavior probes copy six exact editor files and twenty-one exact dependency files into a fresh
twenty-seven-file ESM graph only after all byte receipts are acquired. The retained Source,
stable-ID, and structural runtimes plus all dependency bytes must match their frozen predecessor
authorities. The current package entry then authenticates the Source, stable-ID, structural, and
content modules together. The emitted graph has eleven reviewed static edges, no unknown edge, and
no browser, React, dynamic-import, or evaluation authority. Node, its ESM loader, and the process
environment remain trusted.

## Deterministic fail-closed evidence

Generation formats one deterministic JSON value and commits it through the shared exclusive
same-directory atomic writer. The open temporary inode and bytes are rechecked before rename, and
the committed bytes are read back. Symlink, hard-link, and non-file destinations fail closed; a
failed pre-rename hook preserves the previous complete destination.

Verification rebuilds independently, compares exact artifact bytes, and requires exactly one
visible exact final SHA-256 line. Pins hidden in HTML comments or fenced code blocks and duplicate
visible pins do not issue PASS. Build, write, and verify options accept only exact own enumerable
data properties. Unknown, inherited, accessor, symbol, Proxy, shared-byte, replacement-race, and
caller-supplied runtime authority is rejected.

## Honest remaining scope

This closes only platform-neutral immutable content editing. It does not prove Catalog slot
acceptance or cardinality, undo/redo, selection, viewport, M08-T05 through M08-T08 authoring and
persistence, M08-T09 Catalog semantics and continuous diagnostics, or the M08-T10/G08 React/DOM
boundary. It advances neither P-18 nor G08 and changes no frozen DESEN 0.1.0 byte.

## Reproduction

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:content-edits
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-content-edits-proof.mjs
node scripts/verify-editor-core-content-edits.mjs
node --test tests/editor-core-content-edits.test.mjs
```
