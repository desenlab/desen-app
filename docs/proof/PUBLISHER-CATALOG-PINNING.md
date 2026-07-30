# M06-T08 — Source-digest authentication and exact Catalog pinning

M06-T08 is `PASS` for its bounded nonterminal claim.

## Proven boundary

The Publisher calls the complete M06-T07 normalization boundary exactly once from raw Source JSON
and the closed package-candidate inventory. It independently recalculates the digest from the exact
authenticated pre-normalization Source, requires that value to be a valid SHA-256 digest, and
requires byte-for-byte equality with the digest carried by M06-T07. A missing, malformed, thrown, or
different digest stops at `source-digest`; the recomputed value is never silently substituted.

Only after that authentication succeeds does the Publisher build `requires.catalogs`. Each Source
requirement position is mapped through the exact M06-T02 `requirementPackageIndexes` authority.
The emitted tuple contains:

- `id`, `version`, and `target` from the exact selected package;
- `digest` from that package's authenticated `packageDigest`; and
- the optional Source requirement `extensions` value by exact immutable identity.

Requirement order and repeated positions are preserved. The proof exercises the positional pattern
`A, B, A` with indexes `0, 1, 0`, reversed candidate allocation, omitted target, independent object
allocation, and distinct extensions at repeated positions. There is no range, newest-version,
case-folding, trimming, Unicode-normalization, sorting, or deduplication fallback.

## Discovery and extension semantics

A top-level Source requirement `location` remains part of the authenticated Source and therefore
correctly affects `sourceDigest`. It is still only a discovery hint: it is neither read as selection
authority nor copied into an exact tuple. A nested field named `location` inside an opaque extension
is preserved as data. The same distinction applies to opaque nested fields named `authoring`,
`digest`, `target`, `constructor`, or `prototype`.

Changing only root `authoring` changes neither the carried Source digest nor the pinned document.
Changing a semantic nested extension does. Changing a selected package digest for the same
id/version/target leaves the Source digest unchanged but requires explicit adoption in the exact
tuple and changes the pinned document.

## Atomicity and authority

The package-private success carries every M06-T07 authority by exact runtime identity and adds only
one recursively immutable `pinnedDocument`. A later digest, alignment, package, Catalog, or
extension-authority failure suppresses inherited warnings and returns only the closed
`ok: false`/`stage`/`diagnostics` shell. Earlier authenticated failures pass through unchanged.

The pinned document deliberately has no `revision`, `publication`, terminal `bundle`, `ok: true`,
signature, runtime, host, adapter, activation, or deployment authority. M06-T09 owns complete
Bundle construction, final-size enforcement, structural/semantic validation, and revision closure.

## Executable evidence

The evidence replays 13 focused Publisher cases, 52 compiler-negative cases, and 37 independent
root proof/mutation cases. It authenticates the exact M06-T02 and M06-T07 prerequisite artifacts,
21 task-owned, compatibility, registration, or frozen files, source and built-distribution call
order, exact package-root privacy, executable single-pass CI registration, atomic evidence
writing, and 12 immutable traceability ownership rows.

`docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json`

`sha256:de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f`

## Reproduction

```sh
pnpm verify:publisher-source-normalization
pnpm --filter @desen/publisher build
pnpm --filter @desen/publisher typecheck
pnpm --filter @desen/publisher test:catalog-pinning
node scripts/generate-publisher-catalog-pinning-proof.mjs
node scripts/verify-publisher-catalog-pinning.mjs
node --test tests/publisher-catalog-pinning.test.mjs
```
