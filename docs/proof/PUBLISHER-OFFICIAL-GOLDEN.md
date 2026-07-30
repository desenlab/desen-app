# M06-T10 — Official Source-to-Bundle golden

M06-T10 is `PASS` for the official Source-to-Bundle golden and double-publication determinism
claim.

## Proven boundary

The proof invokes only the public two-argument `publishDesenSource` package-root API. It parses two
fresh copies of the frozen official sign-in Source and web Catalog, constructs two independent
Catalog-package candidate graphs, and publishes them independently. The inputs, results, Bundle
graphs, and diagnostic arrays do not share identity.

Both successful Bundles are recursively immutable, contain neither root `authoring` nor root
`publication`, and have identical RFC 8785 canonical UTF-8 bytes, revision, and Source digest. The
same bytes equal the frozen official sign-in Bundle after removing exactly its own root
`publication` member. No other root or nested member is projected away.

The resulting golden is 2,173 canonical bytes with SHA-256
`fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247`,
revision
`sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601`,
and Source digest
`sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878`.
Changing only root Source member order, Catalog member order, or root authoring state does not
change the published Bundle.

## Executable evidence

The evidence pins the exact frozen Source, Catalog, Bundle, and official vector-manifest bytes,
the M06-T09 terminal Publisher artifact, the frozen protocol snapshot, RFC 8785
canonicalization, and official-suite parity. An isolated process imports the actual built
`packages/publisher/dist/index.js` root and performs both publications; it does not import a
private preflight, limit seam, or alternate production implementation.

The package test independently checks the public API, official projection, two fresh publications,
graph separation, recursive immutability, canonical byte/digest constants, revision closure,
root-order neutrality, and authoring exclusion. Root mutation tests reject fixture, prerequisite,
runtime-receipt, projection, byte, registration, artifact, option, and filesystem-authority drift.
Evidence files use no-follow regular-file reads, fatal UTF-8 decoding, bounded inert byte
snapshots, and the shared atomic writer.

`docs/proof/artifacts/publisher-0.1.0-official-golden.json`

`sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`

## Explicit non-claims

This task proves the valid official golden and two-publication equality. It does not claim the
complete invalid-source/no-Bundle matrix or close G06; M06-T11 owns both. It does not produce
publication metadata, signatures, storage, activation, deployment, runtime, host, adapter, editor,
or network authority.

## Reproduction after the final pin

```sh
pnpm verify:publisher-bundle-publication
pnpm --filter @desen/publisher... build
pnpm --filter @desen/publisher typecheck
pnpm --filter @desen/publisher test:official-golden
node scripts/generate-publisher-official-golden-proof.mjs
node scripts/verify-publisher-official-golden.mjs
node --test tests/publisher-official-golden.test.mjs
```
