# M06-T06 — Source preservation proof

## Decision

M06-T06 is `PASS` for its bounded claim. The package-private Publisher successor composes the
exact M06-T05 authority internally and proves that Source extensions, semantic array order, and
source-node identities can cross the publication boundary without receiving new core meaning.

The intermediate remains nonterminal. It emits no Bundle, removes no authoring data, performs no
publication normalization, and calculates no digest or revision. M06-T07 owns authoring removal
and deterministic normalization.

## Exact predecessor authority

The evidence authenticates three independent prerequisites:

- M06-T05 for the exact prepared Source, Catalog, selected package, requirement alignment,
  warning, and runtime-obligation authority;
- M02-T07 for opaque extension handling at the trusted Validator boundary; and
- M05-T05 for the selected Web–React runtime/source identity relationship that publication must
  preserve.

The M06-T06 function accepts raw Source JSON and package candidates rather than a caller-created
M06-T05-shaped object. It invokes M06-T05 internally and retains its Source, Catalog, package,
alignment, warning, and obligation objects by exact runtime identity. A detached clone cannot
substitute for that authenticated authority.

## Frozen schema extension surface

The frozen Source and Bundle schemas declare the same 17 extension locations: the document root,
seven action variants, variant, behavior, repeat, node, state, resource instance, surface, Source
catalog requirement, and exact Bundle catalog requirement. Exactly 16 are reachable from either
document root: Source reaches its loose catalog requirement and Bundle reaches its exact catalog
requirement.

The proof derives these locations from the frozen schemas rather than maintaining a second
handwritten schema list. A comprehensive valid Source exercises every Source-reachable location.
Each opaque detached JSON value has identical canonical JSON bytes after parsing and crosses the
M06-T06 boundary by exact runtime object reference, including ordered arrays, apparent
core-looking keys, and own `__proto__`, `constructor`, and `prototype` keys. Raw whitespace and
object-member lexical order are already outside the parsed authority. No extension changes
validation, package selection, runtime obligations, or source-node traceability.

## Semantic order

The exact Source authority crosses unchanged, so no semantic array is sorted, deduplicated,
materialized, or reconstructed. Independent projections cover catalog requirements, nested slots,
event actions, operation settlement actions, variants, behavior attachments, and literal repeat
items. The caller projection, authenticated Source projection, and preserved production projection
remain exactly equal, and repeated identical runs remain byte-identical.

This task preserves repeat declarations and their ordered Source values. It does not materialize
runtime repeat instances or claim runtime scheduling behavior.

## Source-node traceability

Every reachable component node produces one immutable trace record with:

- the Source document id;
- the owning surface id;
- the unchanged Source node id;
- the selected capability id; and
- the exact RFC 6901 Source pointer.

The strategy discriminator is `unchanged-node-identifiers`. Records are complete,
deterministically ordered, recursively frozen, unique by Source pointer and by the
surface-scoped `(surfaceId, sourceNodeId)` identity, and contain no props, styles, slots, actions,
extensions, authoring data, Catalog objects, executable values, callbacks, runtime handles, or
platform objects. The same node id remains legal in different surfaces. Behavior instances retain
their existing Source identity in the preserved Source but are not falsely reclassified as
component nodes in this index.

## Finite and atomic boundary

The preservation report has explicit positive-integer ceilings of 25,000 complete source-node
records, 4,096 UTF-16 code units in one trace pointer, and 4,194,304 aggregate trace identity and
pointer code units. Exact observed boundaries pass. Lowering any observed boundary by one rejects
the whole intermediate at exact stage `normalization` with one redacted diagnostic. Trace records
are never truncated. Opaque extensions and state-schema data remain bounded by the inherited raw
Source limits rather than a new T06 payload budget.

Every failure exposes only the closed Publisher failure shell. It cannot expose Source, Catalog,
package, alignment, warning, obligation, trace record, preservation metadata, partial value, or
Bundle data.

## Package and platform boundary

The preservation function, limit profile, result types, task-owned diagnostics, and intermediate
remain absent from the package root and every package export subpath. The evidence imports only
the built package-private distribution module.

TypeScript-AST inspection limits production imports to protocol, Validator, and package-local
Publisher modules. It rejects enumerated browser, DOM, Node, worker, storage, dynamic-loader,
dynamic-constructor, ambient-runtime, suppression, and triple-slash forms in source and built
declarations. The audit is a direct-form architecture check, not a JavaScript sandbox.

## Deterministic and mutation evidence

The evidence builder:

- regenerates byte-identical formatted JSON across independent builds;
- authenticates all three prerequisite hashes;
- derives Source/Bundle extension parity and reachability from frozen schemas;
- byte-tracks production source, built JavaScript and declarations, focused tests, frozen schemas,
  and proof tooling in a sorted unique inventory;
- semantically authenticates only the selected focused-package script, root
  generate/verify/test/check registrations, and single-pass CI proof tuple so unrelated successor
  additions do not enter M06-T06's direct byte inventory;
- detects extension loss or interpretation, semantic array reordering, missing or changed source
  identity, authority cloning, limit bypass, partial failure leakage, public export leakage,
  target-specific source/declaration forms, prerequisite drift, artifact tampering, and proof-pin
  drift; and
- writes through an exclusive same-directory temporary, rechecks inode and bytes, performs an
  atomic rename, and rejects destination symlinks or pre-rename tampering.

## Evidence artifact

`docs/proof/artifacts/publisher-0.1.0-source-preservation.json`

`sha256:261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff`

## Scope limits

M06-T06 does not remove authoring data, normalize Source data, calculate a Source digest, replace
loose catalog requirements with exact Bundle tuples, validate or emit a Bundle, calculate a
revision, or prove double-publish determinism. Those remain M06-T07 through M06-T11.

It also makes no editor save/open, storage, network discovery, package download, activation,
rendering, native-runtime, signing, authenticity, npm-publication, or deployment claim.
