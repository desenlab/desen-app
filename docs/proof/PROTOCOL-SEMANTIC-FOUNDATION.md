# DESEN 0.1.0 Semantic Foundation Proof

## Claim boundary

M02-T07 proves a platform-neutral semantic foundation on top of the exact M02-T06 structural
boundary. It validates the relationships that must be known before component contracts, runtime
values, publication, or activation can be trusted:

- exact Semantic Versioning 2.0.0 syntax;
- exact catalog requirement identity and target matching;
- entry and surface identity;
- one node/behavior-instance identity namespace per surface;
- one capability namespace across a resolved catalog set;
- category-aware component, behavior, resource, and operation existence; and
- opaque preservation of unknown extensions without assigning core meaning.

This is deliberately named a _semantic foundation_. It does not claim complete semantic
validation, full official-suite parity, a conformance target, or any Proof Matrix `P-*` result.
The component, event, binding, resource/action, publication, and activation layers remain assigned
to later tasks.

## Result

The implementation accepts unknown data only through the M02-T06 inert structural boundary. A
catalog array becomes usable by Source or Bundle validation only after
`validateDesenCatalogSet` returns a recursively immutable, nominally branded value backed by a
private runtime trust registry. A TypeScript cast, copied array, or serialized/deserialized value
cannot forge that trust.

The semantic layer is deterministic and platform-neutral. Production source and the built package
contain no Node, filesystem, network, React, DOM, CSS, browser, dynamic-import, `eval`, or
`Function` dependency. A Source catalog `location` remains data and is never fetched.

## Reviewed ownership

The deterministic evidence binds this implementation to the exact M02-T07 routes in the reviewed
protocol trace:

| Evidence class    | Reviewed ownership                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema families   | 19 families, 201 constraints: `SC-004`, `SC-005`, `SC-006`, `SC-007`, `SC-009`, `SC-013`, `SC-016`, `SC-017`, `SC-018`, `SC-020`, `SC-024`, `SC-025`, `SC-026`, `SC-027`, `SC-034`, `SC-046`, `SC-049`, `SC-050`, `SC-051` |
| Conformance       | `C-003`                                                                                                                                                                                                                    |
| Prose rules       | `R-014`, `R-015`, `R-016`, `R-017`, `R-023`, `R-024`, `R-033`, `R-069`, `R-083`, `R-147`                                                                                                                                   |
| Mandatory clauses | `N-006`, `N-007`, `N-008`, `N-009`, `N-012`, `N-017`, `N-022`, `N-025`                                                                                                                                                     |
| Recommendation    | `S-003`                                                                                                                                                                                                                    |
| Core diagnostics  | `D-003` through `D-007`                                                                                                                                                                                                    |

The 201 schema constraints are not reimplemented. M02-T06 continues to execute the exact frozen
schemas; M02-T07 adds only their relational and prose-defined semantic obligations.

## Validation flow

1. Source, Bundle, Catalog, and every catalog-set member re-enter M02-T06 structural validation.
2. Any structural failure short-circuits semantic inspection and preserves the structural code and
   RFC 6901 pointer.
3. Catalog versions and document requirements pass a non-coercing exact SemVer grammar check.
4. Catalog requirements match literal `id`, `version`, and applicable `target` strings. No trim,
   case folding, Unicode normalization, range matching, precedence substitution, or best match is
   used.
5. Only catalogs explicitly matched by the document requirements authorize capability references.
   Additional catalogs in a trusted shared set are inert for that document.
6. Entry, surface, node, and behavior identities are checked in deterministic order.
7. Component, behavior, resource, and nested `operation.invoke` references are checked against
   their exact capability category.

Node, behavior-slot, node-slot, and nested operation-action traversal uses explicit work stacks.
Extensions and ValueSpec payloads are not recursively interpreted as core semantics.

## Public API

The `@desen/validator` package root exports:

| API                                                           | Responsibility                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `isExactSemanticVersion(value)`                               | Exact, non-coercing SemVer 2.0.0 syntax guard                  |
| `validateDesenCatalogSet(input)`                              | Build the only trusted immutable resolved-catalog set          |
| `validateDesenCatalogSemantics(input)`                        | Structural, exact-version, and single-catalog namespace checks |
| `validateDesenSourceSemantics(input, catalogSet)`             | Source semantic foundation against declared catalogs           |
| `validateDesenBundleSemantics(input, catalogSet)`             | Bundle semantic foundation against exact requirements          |
| `validateDesenSemanticFoundation(target, input, catalogSet?)` | Explicit generic dispatcher for the three roots                |

Success returns an independent recursively frozen snapshot and an empty diagnostics array. Failure
returns immutable, sorted diagnostics and no trusted `value`.

## Strict SemVer and PF-009

The frozen schema regexes are broader than Semantic Versioning 2.0.0. The semantic guard therefore
checks the exact grammar without parsing numeric identifiers into JavaScript numbers. It accepts
arbitrarily long numeric identifiers and valid prerelease/build metadata while rejecting leading
zeros in core numbers or numeric prerelease identifiers, empty identifiers, prefixes, ranges,
partial versions, whitespace, and non-ASCII identifier characters.

DESEN 0.1.0 Appendix B has no core diagnostic for an invalid strict SemVer value or an exact
catalog-requirement mismatch. `PF-009` records the non-normative gap. The implementation uses:

- `run.desen.validator/INVALID_SEMVER`
- `run.desen.validator/CATALOG_REQUIREMENT_MISMATCH`

They use the shared portable diagnostic envelope but have no invented Appendix B classification.
The five M02-T07 core failures retain their exact protocol codes:
`DUPLICATE_SURFACE_ID`, `DUPLICATE_NODE_ID`, `ENTRY_NOT_FOUND`, `UNKNOWN_CAPABILITY`, and
`AMBIGUOUS_CAPABILITY`.

## Identity and capability rules

- `entry` must name a surface map member.
- Every surface map key must equal its internal `id`.
- Node and behavior-instance IDs share one namespace inside each surface.
- The same node or behavior ID may occur in different surfaces.
- Capability IDs share one namespace across all four categories and all members of a trusted
  catalog set. A repeated declaration invalidates the set even if no document uses it.
- A node `use` resolves only to a component, behavior `use` only to a behavior, resource-instance
  `use` only to a resource, and `operation.invoke.operation` only to an operation.
- Finding a capability ID in the wrong category produces `UNKNOWN_CAPABILITY`; the validator never
  guesses a substitution.

Catalog-set ambiguity pointers are array-local and deterministic. They identify the later
declaration and RFC 6901-escape capability IDs containing `~` or `/`.

## Extensions and inert data

Unknown extensions remain present in the successful immutable snapshot, including nested
extension points and keys such as `__proto__`, `constructor`, or `prototype`. They are never merged
into configuration objects and their nested `id`, `use`, `$ref`, `entry`, or `version` fields have
no core effect. The implementation uses own-property traversal plus `Map` and `Set`, avoiding
prototype-sensitive indexing.

`S-003` recommends reverse-domain extension keys but does not require them. A non-namespaced key is
therefore not a validation failure. Actual editor save/open round-trip behavior remains M08-T07;
this task proves validator-side preservation, isolation, and opacity only.

## Frozen vectors and scope fence

The exact frozen valid Source, Bundle, and Catalog roots and all five public examples pass this
stage. The two official M02-T07 invalid vectors fail at their reviewed pointers:

| Frozen vector                    | Diagnostic           | Exact pointer                             |
| -------------------------------- | -------------------- | ----------------------------------------- |
| `source-duplicate-node-id.json`  | `DUPLICATE_NODE_ID`  | `/surfaces/home/root/slots/default/1/id`  |
| `source-unknown-capability.json` | `UNKNOWN_CAPABILITY` | `/surfaces/home/root/slots/default/0/use` |

The unknown-event, Bundle-revision-mismatch, and catalog-digest-mismatch vectors intentionally
pass M02-T07. Their responsibilities remain M02-T09 and M06/M07. Structural unknown-core-field
failure continues to short-circuit with the unchanged M02-T06 diagnostic.

## Deterministic evidence

- Artifact: `docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json`
- Artifact SHA-256: `565278a4c66a2d672eb3570f4df28adc8d45b8cacfdb01735ce94319d41b4d3b`
- Prerequisite: exact tracked bytes and SHA-256 of the passing M02-T06 artifact
- Frozen input: exact DESEN 0.1.0 commit, tree, and aggregate snapshot hash
- Evidence inputs: trace ownership, BCP 14 ledger, `PF-009`, frozen vectors/examples, SemVer
  goldens, tracked implementation hashes, source audit, and built-distribution audit

Reproduce the evidence with:

```bash
pnpm generate:protocol-semantic-foundation
pnpm verify:protocol-semantic-foundation
pnpm test:protocol-semantic-foundation
pnpm check
```

Generation is the only writer. Verification rebuilds the artifact in memory and rejects byte,
trace, finding, prerequisite, public-export, command-wiring, platform-boundary, or tracked-file
drift. Independent root tests also mutate the trace, BCP 14 ownership, `PF-009`, SemVer behavior,
the prerequisite artifact, the tracked evidence bytes, and the artifact destination type.

## Remaining work

- M02-T08 applies component prop, slot, style-part, and visual-state contracts.
- M02-T09 validates event, command, behavior attachment/conflict, and payload contracts.
- M02-T10 validates state, predicate, repeat, alias, and ValueSpec reference semantics.
- M02-T11 validates resource/operation inputs, actions, navigation, refresh, and command targets.
- M02-T12 and M02-T13 complete official-suite parity and diagnostic micro-vectors.
- M06/M07 own catalog acquisition, package trust, digest integrity, publication, and activation.
- M08-T07 owns actual editor extension round-trip behavior.
- Finite ingress/resource limits and raw duplicate JSON-member detection remain later boundaries.

No G02 or Proof Matrix behavior claim becomes proven from this semantic foundation alone.
