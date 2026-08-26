# Editor Core Structural Edits Proof

## Result

Task: `M08-T03`

Result: `PASS`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-structural-edits.json`

Final artifact: `sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`

## Direct frozen prerequisite

The proof authenticates the exact frozen 19,561-byte M08-T02 stable-ID insertion artifact directly
at `sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`.
The read is bounded, no-follow, canonical-parent, single-link, and checked for stable file identity
before and after acquisition. No live proof-reader checkpoint or sequence-30 head is an input to
this successor claim. Forty-one still-applicable predecessor receipts must also remain byte-exact.

## Delete, move, and ordered-reorder boundary

`deleteDesenEditorNode` removes one uniquely addressed non-root component subtree, including nested
nodes and behaviors, while retaining its source slot key and an empty array when the last child is
removed. `moveDesenEditorNode` transfers the complete subtree only across owners or named slots and
rewrites no node or behavior identity. A node or behavior can own the destination slot; an absent
destination is created only at index zero. Own-data slot names such as `constructor` never fall
through to `Object.prototype`.

Same-owner, same-slot movement is reserved for `reorderDesenEditorNode`. Its index is the final
position after removing the selected direct child. Even a semantic no-op yields a fresh detached
Source. Surface roots cannot be deleted, moved, or reordered, and moving into the target itself or
any descendant node or behavior fails before mutation. Missing and duplicate target/owner
identities fail closed rather than selecting a first match.

## Stable identities, atomicity, and fixed limits

Success returns a fresh detached recursively frozen direct Source. Delete removes exactly the
selected subtree; move and reorder preserve every node and behavior identity plus the order of all
unaffected children. Failure returns a frozen diagnostic result without a partial Source. Exact,
extra-authority, inherited, accessor, symbol, and malformed command inputs are separated at the
runtime boundary, while invalid current Sources retain the frozen `SCHEMA_INVALID` diagnostic.

The evidence exercises the 8,388,608-byte canonical Source, 25,000 target-surface identity, and
root-at-zero depth-64 ceilings plus one-unit crossings. The retained 4,096-code-unit capability-ID
discipline remains authenticated through M08-T02; M08-T03 commands carry no capability-ID input, so
they neither widen nor independently reinterpret that limit. These are canonical admission/output
limits, not streaming or preallocation memory-DoS guarantees.

## Public package and isolated execution authority

The evidence pins the source, emitted JavaScript/declarations/maps, focused and public tests,
compiler-negative assertions, package boundary, proof harness, official fixture, atomic writer,
and complete protocol/validator runtime closure with exact byte receipts. It requires five exact
runtime exports, eighteen type exports, eleven documented structural declarations, sixteen focused
behavior cases, ten focused compiler negatives, and the exact current twenty-six public
runtime/root cases rather than a dynamic count.

Behavior probes never import the workspace package graph. After every byte receipt is acquired,
five exact editor files and twenty-one exact dependency files are copied into a fresh isolated
twenty-six-file ESM package graph. The retained Source and insert runtimes plus all dependency bytes
must match their direct M08-T02 authorities. Only then is the public package entry imported. Node,
its ESM loader, and the process environment remain trusted; this is not a hostile-JavaScript
sandbox.

## Deterministic fail-closed evidence

Generation formats one deterministic JSON value and writes it through the shared exclusive
same-directory atomic writer. The open temporary inode and bytes are rechecked before rename, and
committed bytes are read back. Failed pre-rename hooks preserve the previous complete destination;
symlink, hard-link, and non-file destinations fail closed.

Verification rebuilds independently, compares exact artifact bytes, and requires this document to
contain exactly one final SHA-256 pin. Build, write, and verify options accept only exact own
enumerable data properties. Unknown, inherited, accessor, symbol, Proxy, and shared-byte authority
is rejected, and a caller-supplied runtime cannot execute or issue PASS.

## Honest remaining scope

This closes only platform-neutral structural delete, move, and ordered reorder. It does not prove
Catalog slot acceptance or cardinality, cross-surface movement, undo/redo, selection, viewport, the
M08-T04 through M08-T08 authoring/persistence commands, M08-T09 continuous semantic diagnostics, or
the M08-T10/G08 React/DOM boundary. It advances neither P-18 nor G08 and changes no frozen DESEN
0.1.0 byte.

## Reproduction

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:structural-edits
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-structural-edits-proof.mjs
node scripts/verify-editor-core-structural-edits.mjs
node --test tests/editor-core-structural-edits.test.mjs
```
