# M06-T09 — Bundle validation and revision closure

M06-T09 is `PASS` for its bounded complete-Bundle validation and revision-closure claim.

## Proven boundary

The terminal Publisher calls the complete M06-T08 Catalog-pinning boundary exactly once. It adds
only a provisional `revision` to that authenticated pinned document; it does not add
`publication`. The complete candidate is measured as RFC 8785 canonical UTF-8 and must fit the
fixed 2,097,152-byte envelope before Validator work begins.

The Publisher then calls the Validator exactly once with that candidate and M06-T08's exact
`catalogSet`. A successful Validator result is accepted only when it is a separate recursively
immutable JSON graph, its canonical bytes exactly equal the candidate bytes, and the complete
validated snapshot still fits the same 2 MiB envelope. The revision helper is called a second
time over that snapshot. The provisional revision, validated `revision`, and recalculated revision
must be the same valid SHA-256 digest.

Success exposes only the immutable Validator Bundle snapshot and inherited safe warnings through
the exact `{ ok, bundle, diagnostics }` shell. Every controlled failure exposes only
`{ ok, stage, diagnostics }`; no Bundle or intermediate Source, Catalog, package, obligation,
digest, candidate, or Validator authority is returned.

## Executable evidence

The proof parses both the TypeScript source and emitted JavaScript with the TypeScript AST. It
authenticates the exact call cardinalities and ordering, revision-only candidate, exact Catalog-set
argument, two complete byte measurements, graph-separation and byte-equality guards, closure
checks, fixed public API, package declarations, focused tests, root scripts, and executable
single-pass CI registration.

One isolated process imports the actual `packages/publisher/dist/index.js` package root and
publishes the reviewed valid Source/Catalog input once. It checks the exact immutable success
surface, revision closure, finite byte envelope, input isolation, lack of authoring/publication
members, and one controlled atomic failure. The proof also pins the exact M06-T08, M02-T04, and
M02-T11 artifacts and externally tracks all seven current M06-T02 through M06-T08 proof readers.
All textual evidence inputs use fatal UTF-8 decoding, all filesystem reads require regular
non-symbolic files with no-follow opens, and evidence output uses the shared atomic writer.

The current M06-T05 execution-preflight reader must match its exact approved successor receipt in
the live worktree, any supplied mutation candidate, and the captured tracked inventory. The proof
then emits its original task-time M06-T05 receipt, preserving this frozen T09 artifact and SHA.
M07-T01 separately pins the current T09 reader and root-test bytes so the compatibility code itself
remains inside current evidence authority.

`docs/proof/artifacts/publisher-0.1.0-bundle-publication.json`

`sha256:2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df`

## Explicit non-claims

This task does not compare the result with an official frozen Bundle, prove repeated-publication
byte equality, or establish a golden Source-to-Bundle artifact. M06-T10 owns those claims. The
single controlled failure proves the terminal no-partial shell, not M06-T11's invalid-source
matrix or the G06 no-emission gate. Publication metadata, signing, storage, activation, deployment,
runtime, host, and adapter behavior are also outside this proof.

## Reproduction after the final pin

```sh
pnpm verify:publisher-catalog-pinning
pnpm --filter @desen/publisher... build
pnpm --filter @desen/validator test:execution-contracts
pnpm --filter @desen/publisher typecheck
pnpm --filter @desen/publisher test:bundle-publication
node scripts/generate-publisher-bundle-publication-proof.mjs
node scripts/verify-publisher-bundle-publication.mjs
node --test tests/publisher-bundle-publication.test.mjs
```
