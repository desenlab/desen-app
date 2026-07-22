# DESEN 0.1.0 Component Contract Proof

## Claim boundary

M02-T08 applies component capability contracts after the exact M02-T06 structural boundary and
M02-T07 semantic foundation. It validates:

- component base and Variant properties against `propsSchema` when their values are statically
  knowable;
- declared property names even when their values remain dynamic;
- component slot names, required/minimum/maximum cardinality, accepted capability identifiers,
  accepted categories, and leaf boundaries;
- the logical-OR rule when both slot acceptance lists exist;
- `base` and declared visual states;
- declared style parts and their statically knowable property values; and
- immutable deterministic obligations for dynamic `$ref`, `$token`, and `$format` values.

Unknown visual states, style parts, and closed style properties use the protocol's
`UNKNOWN_PROP` code. A statically known value that violates a component or style-part schema uses
`PROP_TYPE_MISMATCH`.

This task does not validate behavior contracts, resolve references, execute variants, validate
runtime values, publish, activate, or claim complete official-suite parity.

## Reviewed ownership

The deterministic evidence binds the implementation to the complete reviewed M02-T08 route:

| Evidence class     | Exact ownership                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Schema families    | `SC-029` (5), `SC-042` (26), `SC-043` (26), `SC-046` (70), `SC-052` (18), `SC-055` (7), and `SC-057` (39) |
| Schema constraints | 191                                                                                                       |
| Prose rules        | `R-057`, `R-058`, `R-060`, `R-064`, `R-085`, `R-120`, and `R-148`                                         |
| Mandatory clauses  | `N-026`, `N-028`, and `N-029`                                                                             |
| Core diagnostics   | `D-008` through `D-012`                                                                                   |
| Official vectors   | No official invalid vector is assigned specifically to M02-T08                                            |

The 191 schema constraints remain executed by the frozen structural boundary. T08 adds the
cross-document relationship between a resolved component capability and each component node that
uses it.

The proof also binds the implementation to reviewed findings `PF-010` and `PF-011`. Required-slot
presence, explicit effective minima, empty acceptance unions, impossible slot ranges, the
host-safe component-schema profile, its 50,000-step evaluation budget, and the
`run.desen.validator/INVALID_COMPONENT_CONTRACT` implementation diagnostic cannot drift silently.
Both findings remain `OPEN`; they document project-owned fail-closed decisions where DESEN 0.1.0
is underspecified. The three owned BCP 14 rows must be in final `TESTED` status.

## Validation flow

1. Catalog, Source, and Bundle inputs re-enter structural validation.
2. Catalog requirements, capability namespaces, identities, and component existence re-enter the
   T07 semantic foundation.
3. `validateDesenComponentCatalogSet` creates the trusted component-contract catalog set and
   rejects internally contradictory slot contracts.
4. Component nodes are traversed without interpreting behavior contracts or action semantics.
5. Literal prop and style values are checked by the platform-neutral, code-free Draft 2020-12
   interpreter. It performs no runtime code generation, type coercion, default insertion, property
   removal, filesystem access, or network resolution. Component prop and style-part schemas first
   pass the `PF-011` host-safe regex/schema preparation profile; unsafe patterns fail closed before
   native `RegExp` execution, and the bounded interpreter stops when its deterministic evaluation
   budget is exhausted.
6. Dynamic values remain inert and produce frozen obligations containing their kind, RFC 6901
   pointer, document/surface/node identity, and capability ID.
7. Source and Bundle failures retain the same mandatory, deeply frozen, JSON-only obligation
   channel even though they expose no trusted value.
8. Diagnostics and obligations are sorted deterministically and remain JSON-serializable.

## Public API

The built `@desen/validator` package root exposes:

| Export                                  | Responsibility                                      |
| --------------------------------------- | --------------------------------------------------- |
| `validateDesenComponentCatalogSet`      | Build the trusted component-contract catalog set    |
| `validateDesenSourceComponentContracts` | Validate Source component contracts                 |
| `validateDesenBundleComponentContracts` | Validate Bundle component contracts                 |
| `validateDesenComponentContracts`       | Dispatch explicitly to Source or Bundle validation  |
| `INVALID_COMPONENT_CONTRACT_CODE`       | Report an internally contradictory catalog contract |

Source and Bundle success/failure results both carry deeply frozen deterministic obligations.
Document failure has no trusted `value`; catalog-set results do not need an obligation channel.
For both targets and both success/failure paths, the generic dispatcher must return an exact
data-equivalent result to its specialized API, including target, diagnostics, value when present,
and obligations.

## Project mutation goldens

The frozen DESEN suite has no official T08-invalid vector. Negative T08 evidence is therefore
labelled `projectMutationGoldens`, never “official conformance”. The evidence covers:

- unknown, missing-required, wrong-type, nested, and Variant props;
- unresolved dynamic props and partial Variant overrides;
- unknown/leaf slots, required slots, min/max cardinality, category rejection, exact-ID acceptance,
  category acceptance, and ID-or-category rejection;
- contradictory catalog slot contracts;
- unknown visual states, style parts, and style properties;
- wrong static style values and Variant style overrides; and
- exact stable diagnostic codes and RFC 6901 pointers for every mutation.

A separate seven-case public `schemaSafetyGoldens` set accepts depth 128, unanchored fixed width
16, and an anchored final variable-width atom; it rejects depth 129, unanchored fixed width 17, a
fixed suffix after a variable-width quantifier, and the reviewed pathological quantified-prefix
suffix. Public-API mutations that admit either depth 129 or the fixed-suffix pattern must fail the
proof.

The failure-result mutation suite removes the obligation channel independently from Source and
Bundle failures. A separate dispatcher mutation preserves a valid result while changing its
obligation ordering; both changes must fail the proof.

The official unknown-event vector, invalid behavior props, unresolved references, operation input,
navigation, Bundle revision, and catalog digest cases remain accepted as explicit later-task scope
fences. Structural, duplicate-identity, and unknown-capability failures preserve their earlier
diagnostics instead of being relabelled as T08 failures.

## Frozen positive corpus

The exact valid Catalog, Source, Bundle, and all five public example paths are checked. The proof
records that three example paths are byte-identical aliases of their conformance counterparts so
they are not presented as independent behavioral implementations.

The store-map example provides the strongest frozen T08 positive evidence: nested Map props,
named popup and empty-state slots, category acceptance, maximum cardinality, base styling, and
declared marker parts. Its exact dynamic golden contains one `$format` `component-prop` obligation
for popup text and two `$token` `style-part-property` obligations for marker fills, including their
full pointers and document/surface/node/capability contexts. A mutation that removes obligations
only from store-map must fail. Sign-in covers three mixed static/dynamic prop obligations on both
success and failure; Sortable is also the behavior-contract scope fence.

## Deterministic and security evidence

The proof requires:

- byte-identical independent evidence builds;
- identical diagnostics and obligations after recursively reversing every object-member order;
- immutable JSON-only results and obligations;
- complete passing calls to the predecessor T05 diagnostic and T07 semantic-foundation verifiers,
  followed by exact prerequisite-byte hashing;
- exact trace and BCP 14 ownership;
- exact per-family constraint counts, final `TESTED` clause status, and reviewed `PF-010`/`PF-011`
  anchors;
- exact runtime exports and command wiring;
- no runtime dependency other than `@desen/protocol`;
- validator and transitive `@desen/protocol` source/distribution inventories that match one-to-one;
- import allowlists restricted to relative specifiers plus exact `@desen/protocol` only in the
  validator, with the protocol restricted to relative imports; and
- source/distribution audits rejecting `require`, `eval`, `Function(`, dynamic import, Node or
  other bare dependencies, browser network APIs, frozen-upstream access, and workspace-absolute
  paths. The four protocol runtime source files and their four built counterparts are byte-tracked
  by the evidence inventory.

The project-owned `PF-011` profile caps each pattern at 256 UTF-16 code units and 128 tokens,
quantifiers at 1,024, and expanded fixed width at 4,096. An unanchored fixed-width pattern is capped
at 16 expanded atoms. The sole permitted variable-width quantifier requires both edge anchors and
must be the final consuming atom; only terminal `$` may follow, so pathological quantified prefixes
with fixed suffixes fail before native matching. Schema graph/evaluation depth is capped at 128,
schema nodes and local-reference edges at 4,096 each, patterns at 64, aggregate pattern code units
at 4,096, and evaluation at 50,000 steps. These exact values are parsed from the reviewed
`SCHEMA_CONTRACT_SAFETY_LIMITS` source object without executing it, and public catalog-set goldens
exercise both sides of the depth and regex boundaries.

The profile is intentionally scoped to component props and style-part properties;
behavior/event/command schemas remain T09. This proves fail-closed behavior for the documented
profile, not that DESEN 0.1.0 defines a portable regex engine or universal complexity bound.

## Reproduction

The tracked artifact destination is:

`docs/proof/artifacts/protocol-0.1.0-component-contracts.json`

Its final SHA-256 is recorded in `PROJECT-STATUS.md` and `PROOF-MATRIX.md` after the implementation,
predecessor artefacts, documentation, and all mutation tests are final. Generate and verify it
with:

```bash
pnpm generate:protocol-component-contracts
pnpm verify:protocol-component-contracts
pnpm test:protocol-component-contracts
pnpm check
```

Generation is the only writer. It resolves a real parent directory, rejects symlink/special-file
destinations, writes and syncs an exclusive temporary file in that same directory, then atomically
renames it over the destination; every failure path removes the temporary file. Verification
rebuilds the evidence in memory and rejects byte, prerequisite, trace, BCP 14, public API, command,
dependency, platform, distribution, frozen-vector, mutation-golden, obligation, dispatcher,
scope-fence, finding, or tracked-file drift.

## Remaining work

- M02-T09 owns behavior props/slots/style, attachment/conflict, events, commands, and payloads.
- M02-T10 owns state, predicate, repeat, alias, and ValueSpec reference semantics.
- M02-T11 owns resource, operation, action, navigation, refresh, and command targets.
- M02-T12 and M02-T13 own official-suite parity and exhaustive diagnostic micro-vectors.
- M04–M06 own dynamic resolution and validation before data reaches a capability implementation.
- `PF-011` remains open until a protocol revision standardizes a portable regex engine or
  schema-complexity profile; T08's host-safe profile is a documented implementation boundary.

No G02 or Proof Matrix `P-*` result becomes proven from T08 alone.
