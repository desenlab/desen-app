# M06-T07 — Source normalization proof

## Decision

M06-T07 is `PASS` for its bounded claim.

The authenticated Source digest precedes root authoring removal and RFC 8785 normalization.

The package-private Publisher successor composes the exact M06-T06 preservation authority,
calculates the DESEN Source digest without mutating that Source, removes only the root Source
`authoring` member from production content, and produces one detached, deeply frozen document
whose canonical bytes are deterministic.

The result carries that one digest but remains nonterminal. It is not yet a valid DESEN Bundle and
grants no exact Catalog requirement, Bundle revision, publication metadata, signing, runtime, host,
adapter, or activation authority. M06-T08 owns authenticating and carrying this digest while
pinning the exact Catalog tuples.

## Exact predecessor authority

The evidence authenticates two independent prerequisites:

- M02-T04 for the RFC 8785 canonicalization and SHA-256 primitives; and
- M06-T06 for the exact authenticated Source, Catalog set, selected package, requirement
  alignment, warning, runtime-obligation, production-field, and source-node-trace authorities.

The M06-T07 function accepts raw Source JSON and closed package candidates rather than a
caller-created M06-T06-shaped object. It invokes M06-T06 exactly once and carries every predecessor
authority field by exact runtime identity. The authenticated pre-normalization Source remains
unchanged; T07 calculates `sourceDigest` from that exact value before creating the normalized
production document.

## Root-only authoring removal

The detached production document has the exact root shape `{ kind, desen, id, entry, surfaces,
extensions? }`. Source `kind`, loose Catalog requirements, discovery locations, root `authoring`,
exact `requires`, `sourceDigest`, `revision`, and `publication` do not enter that document.
`sourceDigest` remains a separate authenticated field on the nonterminal success.

Removal is structural and root-only. The implementation never reads the authenticated Source's
`authoring` value and never recursively filters a property by name. An opaque extension member
named `authoring`, integer-like extension keys, own `__proto__` data, identifiers, conditions,
literals, capability ids, and semantic array order therefore retain their parsed JSON meaning.
Two otherwise identical Sources with different and differently sized root authoring data produce
the same Source digest and identical normalized canonical bytes. Changing a nested extension
changes the digest because only the top-level `authoring` member is excluded.

## Minimal deterministic profile

DESEN 0.1.0 permits optional publication normalizations without prescribing one universal
normalized byte representation. The selected Publisher profile deliberately performs only one
RFC 8785 serialization/parse round trip:

- no schema default is inserted;
- no empty optional member is removed;
- no hidden dependency index is materialized;
- no semantic array is sorted or deduplicated; and
- no JavaScript object-enumeration order is treated as protocol authority.

Objects created with different insertion orders therefore produce byte-identical canonical JSON,
while arrays and opaque values retain their original semantics.

## Finite and atomic boundary

The intermediate admits at most 2,097,152 RFC 8785 canonical UTF-8 bytes. Exact capacity passes,
one byte over rejects, and an explicit zero ceiling rejects every nonempty normalized document.
The limit is an early envelope only: M06-T09 must measure the complete Bundle again after exact
requirements, digest, and revision fields exist.

A digest-authority failure stops at `source-digest`; a projection or byte-limit failure stops at
`normalization`. Both expose the closed Publisher failure shell, retain no inherited warning, and
leak no Source, Catalog, package, obligation, trace, normalized document, digest, revision,
publication, partial value, or Bundle authority. Representative inherited M06-T06 failures pass
through unchanged.

## Package and platform boundary

The normalization function, limit profile, result types, task-owned diagnostics, and intermediate
remain absent from the package root and every package export subpath. The evidence imports only
the built package-private distribution module.

TypeScript-AST inspection covers both production source and built JavaScript. It limits imports to
protocol, Validator, and package-local Publisher modules; requires exactly one call to M06-T06;
authenticates digest-before-normalization statement order and exact inputs; rejects direct access
to `authoring`; rejects enumerated browser, DOM, worker, storage, dynamic-loader, suppression, and
ambient-runtime forms; and authenticates exact predecessor-field carry. This is a direct-form
architecture audit, not a JavaScript sandbox.

Exact cross-stage object identity is an intensional source-and-distribution claim: both ASTs must
return every inherited field directly from the single named M06-T06 result. Runtime vectors
separately authenticate observable alias, alignment, freeze, and semantic behavior. An injected
test implementation may exercise those mutation vectors, but only the exact imported production
function may mint the official PASS artifact.

## Deterministic and mutation evidence

The evidence builder:

- regenerates byte-identical formatted JSON across independent builds;
- authenticates both prerequisite hashes;
- proves the digest matches the exact authenticated Source projection and executes before
  normalization; root-authoring independence; nested-authoring preservation; canonical
  insertion-order equivalence; minimal normalization; trace-pointer resolution; deep
  immutability; exact and one-below observed limits; zero rejection; and the exact 2 MiB boundary;
- byte-tracks eighteen production, distribution, schema, fixture, focused-test, root-test, and
  proof-tool files in one sorted unique inventory;
- byte-authenticates the exact reviewed focused, compiler-negative, and root mutation test bodies,
  then independently authenticates every root case name and executable assertion shape;
- semantically authenticates the package/root scripts, single-pass CI tuple, frozen schema scope,
  and nine owned protocol-traceability rows;
- detects recursive deletion, semantic-array reordering, default injection, limit bypass,
  predecessor remapping or cloning, partial leakage, public export leakage, target-specific forms,
  prerequisite drift, artifact tampering, registration drift, and proof-pin drift; and
- writes through an exclusive same-directory temporary, rechecks inode and bytes, performs an
  atomic rename, and rejects destination symlinks or pre-rename tampering.

Seventeen focused Publisher cases, fifty-two compiler-negative cases, and twenty-six independent
proof/mutation cases protect the boundary.

## Evidence artifact

`docs/proof/artifacts/publisher-0.1.0-source-normalization.json`

`sha256:59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e`

## Scope limits

M06-T07 does not replace loose requirements with exact Catalog tuples, validate or emit a terminal
Bundle, calculate a revision, attach publication metadata, or prove official-golden and
double-publish determinism. Those remain M06-T08 through M06-T11.

It also makes no editor save/open, storage, network discovery, package download, activation,
rendering, native-runtime, signing, authenticity, npm-publication, or deployment claim.
