# ADR 0008: Fingerprint the complete logical capability artifact before npm packaging

- Status: Accepted
- Date: 2026-07-24
- Owners: M03-T10, G03

## Context

DESEN identifies a target capability package by `{ id, version, target, packageDigest }`, but the
frozen 0.1.0 protocol intentionally does not prescribe an npm, tar, zip, or platform archive
format. The M03 reference package needs one exact tuple before the publisher, distributor,
activation system, and public release pipeline exist.

Hashing only selected JavaScript files would leave shipped declarations and source maps mutable
under the same tuple. Hashing a final tuple constant inside emitted JavaScript would instead create
an unsolvable self-reference. Treating the workspace package manifest or dependency tree as part of
the current digest would also claim release guarantees M03 does not yet implement.

## Decision

The `run.desen.reference.sign-in@0.1.0` Web–React package uses the versioned M03-T04 logical digest
profile over:

1. the canonical Catalog projection with the reserved top-level digest placeholder; and
2. every regular file under a clean `packages/reference-catalog-web/dist/**` build, with its exact
   portable `dist/...` path and bytes.

Two independently built inventories and the workspace inventory must be byte-identical and
extras-free. JavaScript, source maps, declarations, declaration maps, hidden files, and any future
regular output are included without an extension allowlist. Symbolic links and non-regular entries
are rejected.

The final digest and exact tuple live in the generated `catalog.json` and deterministic proof
receipt, outside the fingerprinted TypeScript/JavaScript output. The on-disk Catalog is exported as
inert data and must equal the generated representation exactly.

## Consequences

- Any accepted target-output byte, path, addition, removal, or rename participates in the package
  digest.
- Valid Catalog semantic changes participate through canonicalization; formatting-only variants
  do not define a new semantic digest and are rejected as noncanonical package output.
- Stale workspace build files fail verification rather than being silently cleaned.
- Runtime adapter registration remains in M05; no executable selector is introduced by this
  artifact.
- The tuple does not yet attest to `package.json`, dependency bytes, filesystem metadata, an npm
  archive, public publication, authenticity, distributor retention, or activation.
- M12 must define public package-envelope and supply-chain evidence before release without
  retroactively overstating the M03 tuple.
