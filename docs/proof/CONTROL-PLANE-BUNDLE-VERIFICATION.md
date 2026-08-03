# M07-T02 — Stored Bundle integrity verification

M07-T02 is `PASS` for bounded, fail-closed integrity verification of one untrusted stored DESEN
0.1.0 Bundle entry and explicitly available or unavailable Source evidence.

## Proven boundary

The built `@desen/control-plane-api` package snapshots exact non-shared `Uint8Array` views before
the caller can mutate them. Stored Bundle JSON must fit the 2,097,152-byte raw ceiling, decode as
fatal UTF-8 without a BOM, and pass duplicate-key, Unicode-scalar, finite-number, depth, value,
decoded-string, and number-token guards. Noncanonical whitespace is accepted and storage bytes are
not rewritten.

Before structural validation can allocate its immutable snapshot, the parsed complete Bundle is
measured against a separate 2,097,152-byte RFC 8785 canonical ceiling. A generated first-issue
guard then validates the exact frozen Bundle root, Draft 2020-12 embedded schemas, and the existing
embedded-schema dialect/reference/regular-expression profile. Only guard-successful data reaches
the established exhaustive Validator. Its immutable snapshot is measured again and compared with
the real canonical bytes, so compact numeric notation cannot bypass the allocation boundary.

The guard is deterministic standalone output from the exact frozen Source and Bundle schemas under
pinned Ajv 8.20.0 and Prettier 3.9.6. The mandatory proof regenerates and exact-compares all 730,791
committed bytes with `allErrors: false`. Runtime verification performs no schema compilation,
dynamic loading, schema-file resolution, or network access.

Integrity closes three independent values: the outer store key, the Bundle's embedded `revision`,
and the revision recalculated from the validated Bundle. They must be exactly equal. The official
Publisher projection passes at 2,173 canonical bytes with revision
`sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601` and Source digest
`sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878`.

The frozen official fixture's root `publication` member is preserved and independently passes as a
2,270-byte complete Bundle with the same revision. This is expected because DESEN 0.1.0 excludes
root `publication` from the revision projection; it does not make the two complete byte sequences
interchangeable in the immutable store.

## Available Source evidence

Source evidence is an exact closed union. `{ status: "not-available" }` records that the embedded
digest was not independently corroborated. `{ status: "available", sourceBytes }` requires real
raw Source JSON bytes, not a caller-selected digest string.

Available Source receives separate 8,388,608-byte raw and complete canonical ceilings, the same
strict bounded parser, the generated first-issue guard, exact exhaustive Source validation, a
post-snapshot canonical-byte equality fence, and an independent Source-digest calculation. Source
resource exhaustion uses
`run.desen.control-plane/SOURCE_MATERIAL_LIMIT_EXCEEDED`; it does not redefine the protocol's
Bundle-only size diagnostic. Exact-capacity Source passes, while compact input whose canonical form
is one byte over the cap fails before schema allocation or digest calculation.

## Authority and rejection semantics

Only complete success returns a frozen `BundleIntegrityAuthority`. It exposes the independent
immutable Bundle, protocol version, closed revision, Source digest, explicit
`matched`/`not-available` status, and stored/canonical Bundle byte lengths. It exposes no raw Bundle
or Source bytes. Package-private consumers authenticate the exact object identity through a
`WeakMap`; copying visible fields or forcing a TypeScript cast cannot create runtime authority.

Every rejection returns one closed stage and immutable redacted diagnostics with no parsed
document, claimed/calculated digest detail, raw byte view, or partial authority. Unsupported
protocol wins before general schema diagnostics. Canonical allocation guards win before
structural validation. Revision failure wins before Source material is observed.

## Executable evidence

Seventeen runtime cases and six dedicated guard cases cover matched/unavailable Source, publication
preservation, noncanonical and offset byte views, exact Bundle and Source boundaries, canonical
numeric expansion, malformed UTF-8/JSON, duplicate decoded keys, unsupported protocol, structural
diagnostics, triple revision closure, Source mismatch, hostile records and typed-array views,
immutability, and authority forgery. Nine compiler-negative cases close the public type boundary.

The guard suite proves that 10,000 invalid root children, 10,000 invalid Draft schemas, 10,000
external-reference schemas, and one embedded schema containing 10,000 independent custom-profile
issues each stop with one diagnostic before the exhaustive Validator is called. Sixteen independent
root proof/mutation cases protect deterministic generation, artifact bytes, prerequisites,
implementation and distribution files, codegen/schema/tool options, public exports, exact tests,
trace ownership, filesystem authority, and atomic evidence writes.

The artifact pins six direct prerequisites (`M07-T01`, `I07-02`, `M06-T10`, and `M02-T04` through
`M02-T06`) plus nine exact trace rows: `PIPE-010`, `PIPE-011`, `R-007`, `R-031`, `R-138`, `D-030`,
`D-031`, `D-034`, and `D-035`. The live required-exhaustive CI successor contains 63 proof pairs
and 134 workloads; the immutable I07-02 cutover baseline remains 61/130.

Evidence: `docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json`
`sha256:db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a`.

## Explicit non-claims

This task proves integrity of supplied bytes, not their signer, network origin, tenant authorization,
or storage provenance. It does not verify installed package target/version/digest tuples, surface
or capability references, activation-wide limits, editable Source storage, channels, transport,
staging, atomic activation, last-known-good state, recovery, fault behavior, or reference-host
consumption. M07-T03 through M07-T11 retain those responsibilities, and P-12 remains
`NOT_PROVEN`.

## Reproduction

```sh
pnpm --filter @desen/control-plane-api verify:bundle-verification-guards
pnpm --filter @desen/control-plane-api build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:bundle-verification
pnpm verify:control-plane-bundle-verification
pnpm test:control-plane-bundle-verification
```
