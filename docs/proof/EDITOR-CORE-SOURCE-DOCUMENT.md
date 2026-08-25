# Editor-core direct Source document proof

## Result

M08-T01 proves that `@desen/editor-core` admits one inert DESEN 0.1.0 `desen.source` graph as the
editor document itself. A successful admission returns a detached, recursively immutable direct
Source snapshot. It adds no wrapper, normalized projection, hidden AST, node index, storage
authority, executable hook, React value, or DOM value. A structural failure exposes the exact
frozen diagnostic shell and no partial document.

Artifact: `docs/proof/artifacts/editor-core-0.1.0-source-document.json`

Final receipt: `sha256:4f1ca45f9e7a4bee96dcd3acef8a3b7c390d7cf16f7a669f4ec4ed68f9ae435c`

## Exact prerequisite authority

The proof authenticates the complete 88,341-byte I07-04 promotion baseline at
`sha256:76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549`. The repository's
frozen baseline is then independently projected as 20 hosted comparisons with zero false
negatives, `PROMOTION_AUTHORIZED`, and `HOSTED_CUTOVER_VERIFIED`. The final projection also
requires the exact cleanup and post-merge `REQUIRED + EXHAUSTIVE` receipts, the fresh non-cached
`REQUIRED + AFFECTED` canary, the live sequence-28 reader checkpoint, and closed zero-reference
infrastructure debt. M08-T01 therefore cannot claim `DONE` from a caller-provided status value or
from a partial historical campaign; its formal G07 prerequisite is a byte-pinned PASS authority.

## Direct document and admission boundary

The public factory delegates root and embedded-schema admission to the existing frozen structural
validator. The official sign-in Source passes twice with byte-equivalent JSON values but disjoint
object identities. Mutating caller input after admission cannot change either result, and the
factory does not freeze or retain any caller-owned object.

Catalog-backed references are intentionally unresolved at this boundary. A structurally valid
Source with an unknown capability reference is admitted because M08-T09 owns continuous semantic
diagnostics and invalid-node mapping. Invalid root identity, invalid embedded schema syntax,
functions, accessors, and serialization hooks fail without invoking caller code or exposing a
partial document.

## Public package and platform boundary

The evidence audits the exact source declarations, TSDoc inventory, emitted JavaScript and
declarations, package export map, and production dependencies. The only runtime export is
`createDesenEditorDocument`; the four reviewed type exports stay declaration-only. Runtime code
imports only `@desen/validator`, while protocol and validator types remain type-only. React, DOM,
CSS, browser, application, dynamic-import, and executable-evaluation authority are absent.

Seven package behavior cases, five package compiler-negative assertions, ten built public runtime
cases, five built declaration compiler-negative assertions, and seven public proof-core cases are
authenticated by exact inventory. Thirteen root proof cases independently cover final authority,
determinism, prerequisite drift, behavior overreach, source/distribution drift, test inventory,
artifact bytes, atomic writing, hostile options, linked filesystem authorities, invalid UTF-8,
and recursive immutability.

## Deterministic and fail-closed evidence

Twenty-four task files are recorded by path, byte count, and SHA-256 digest. Authority reads are
bounded, no-follow, canonical-parent, single-link reads whose file identity is checked before and
after acquisition. Options must be own enumerable data; inherited, accessor, symbol, Proxy, and
shared-memory inputs fail before executable hooks or mutable byte aliases can become authority.

Generation writes already deterministic bytes through an exclusive same-directory temporary,
syncs and rechecks the open inode and bytes, then atomically renames and reads the committed file
back. A failed build or pre-rename hook preserves the previous complete destination. Verification
rebuilds independently, compares exact artifact bytes, and requires this document to contain one
and only one exact final digest pin.

## Honest remaining scope

This proof closes only M08-T01's direct Source admission and immutable ownership boundary. It does
not claim mutation commands or stable-ID allocation (M08-T02 onward), authoring-extension and
persistence round trips (M08-T07 and M08-T08), continuous semantic validation (M08-T09), or the
terminal React/DOM and deterministic-command boundary (M08-T10 and G08). It changes no frozen
DESEN 0.1.0 byte and does not advance P-18 or G08 by itself.

## Reproduction

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:source-document
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-source-document-proof.mjs
node scripts/verify-editor-core-source-document.mjs
node --test tests/editor-core-source-document.test.mjs
```
