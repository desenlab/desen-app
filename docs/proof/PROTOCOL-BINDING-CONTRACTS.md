# DESEN 0.1.0 Binding Contract Evidence Contract

## Status and claim boundary

This document defines and records the evidence produced by M02-T10. Its deterministic artifact is
tracked at the path below, while task completion and the final artifact hash are recorded in the
task board, project status, and Proof Matrix. This evidence does not change any `P-*` claim status;
runtime execution, publication, activation, and their final proofs remain with later owner tasks.

The intended M02-T10 boundary is cumulative: **T06 structural → T07 semantic foundation → T08
component contracts → T09 interaction contracts → T10 binding contracts**. It is limited to
statically decidable state, reference, predicate, format, repeat, alias, and event-scope rules. It
must not resolve runtime values or execute a predicate, repeat, action, adapter, resource,
operation, publication, or activation.

The evidence contract covers:

- state-schema preparation and complete validation of inert initial values;
- lexical `state`, `item`, and immediate-handler `event` references;
- the missing-versus-`null` distinction and T10-consumer fallback compatibility where decidable;
- conservative schema-path proof without guessing through open or ambiguous schemas;
- predicate argument and operator compatibility where types are statically certain;
- exact deterministic `$format` placeholder parsing;
- repeat evaluation order, alias scope, statically known item and key validity, and explicit limits;
- the narrow first-segment state-action target check assigned to T10; and
- immutable carry-forward of the four T09 dynamic obligation kinds, without inventing T10 kinds.

## Reviewed ownership

The future deterministic artifact must bind the implementation to the complete reviewed T10
route. Shared schema families are counted at their reviewed family size, matching the existing
traceability convention.

| Evidence class       | Exact ownership                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema families      | `SC-035` (12), `SC-036` (14), `SC-037` (12), `SC-038` (28), `SC-039` (18), `SC-040` (76), `SC-045` (22), `SC-046` (70), `SC-047` (12), `SC-049` (36) |
| Schema constraints   | 300                                                                                                                                                  |
| Prose rules          | `R-026`, `R-039`, `R-040`, `R-044`, `R-045`, `R-047`, `R-049`, `R-050`, `R-051`, `R-052`, `R-054`, `R-061`                                           |
| Core diagnostics     | `D-019`, `D-020`, `D-021`, `D-022`, `D-023`                                                                                                          |
| Conformance rules    | None assigned directly to M02-T10                                                                                                                    |
| BCP 14 clauses       | None assigned directly to M02-T10                                                                                                                    |
| Official T10 invalid | None in the frozen conformance corpus                                                                                                                |

The five core diagnostic identities are:

| Trace ID | Code                      | Narrow T10 use                                       |
| -------- | ------------------------- | ---------------------------------------------------- |
| `D-019`  | `STATE_WRITE_INVALID`     | Undeclared first state-action path segment           |
| `D-020`  | `REFERENCE_UNRESOLVED`    | Definite missing or lexically out-of-scope reference |
| `D-021`  | `PREDICATE_TYPE_MISMATCH` | Definite static predicate operand incompatibility    |
| `D-022`  | `REPEAT_ITEMS_INVALID`    | Statically non-array repeat items                    |
| `D-023`  | `REPEAT_KEY_INVALID`      | Statically missing, invalid, or duplicate repeat key |

The artifact must not invent a conformance vector or BCP 14 owner to make the evidence appear
broader. Negative T10 documents are project mutation goldens. The Appendix B classifications
remain registry metadata and are not reinterpreted as validator execution stages.

## Exact prerequisite and trust boundary

1. Unknown Catalog, Source, and Bundle data must enter through the existing inert structural
   boundary.
2. Identity, exact catalog, component, behavior, event, command-name, and payload-contract checks
   must re-enter their T07–T09 layers without being copied or bypassed.
3. T10 document validation accepts the existing `DesenValidatedInteractionCatalogSet`; it creates
   no parallel catalog-set API and no weaker trust brand.
4. The complete M02-T09 verifier must pass before any T10 evidence is built. The T10 artifact must
   hash the exact verified T09 artifact bytes and record the verifier's matching hash.
5. Because T09 verifies T08, T08 verifies T05 and T07, and T07 verifies T06, one-byte predecessor
   drift anywhere in that chain must prevent T10 evidence.
6. T09 document diagnostics and the four existing obligation kinds must be preserved. T10 must not
   erase, reorder, relabel, or replace them with a successful value.
7. Success and failure results must be detached, recursively frozen JSON data. A failure exposes no
   trusted document `value`.

The direct evidence dependency is therefore:

```text
M02-T10 → M02-T09 → M02-T08 → {M02-T05, M02-T07 → M02-T06}
```

Metadata shaped like a prerequisite is insufficient. Verification must execute the predecessor
verifier and compare the actual regular-file bytes.

## State declarations and state-action fence

State initial values are resolved inert JSON. An object containing `$ref`, `$token`, or `$format`
inside `initial` is ordinary initial data if the state schema permits it; it is not executed as a
DESEN binding. Each initial value must pass its state schema in complete resolved-value mode.

Before application, state schemas must pass the same code-free Draft 2020-12 graph, regex, and
evaluation-safety boundary already used by T08 and T09. A schema that is structurally valid but
unsafe to apply, or an initial value that violates its prepared schema, uses
`run.desen.validator/INVALID_BINDING_CONTRACT` at the applicable schema or initial-value pointer.
This project-owned distinction is recorded in `PF-019`; it must not be mislabeled as a frozen root
schema failure.

The identifier/path mismatch in `PF-019` is resolved without longest-prefix guessing. A reference's
second segment and a state action's first dot-delimited segment are treated as the complete state
entry name. T10 checks only that first action-path segment and applies its ordinary static predicate
rules to an action guard. It does not validate the nested write, the complete post-write value,
boolean-only toggle behavior, complete action semantics, or runtime mutation; those responsibilities
remain M02-T11 and M04.

## References, fallback, and event scope

T10 applies the lexical profile in `PF-015`:

- `state.<name>` resolves only against declarations on the current surface;
- `item.<alias>` requires an alias active at the exact document location;
- `event.*` is available only in the immediate ordered action turn of the declaring component or
  behavior handler;
- `operation.invoke.onSuccess` and `onFailure` are new turns and cannot inherit the originating
  event payload;
- resource and operation lifecycle reference contracts remain M02-T11;
- context, environment, token, and other host-supplied values remain runtime inputs; and
- fallback may discharge a missing value only for a lexically legal reference; T10-owned
  predicate/repeat consumers apply their decidable type rules, while general compatibility remains
  M06/runtime work.

JSON `null` is resolved and therefore does not select fallback. A definite missing or illegal
lexical reference reports `REFERENCE_UNRESOLVED` at its exact `$ref` member. A path is rejected only
when all applicable locally resolvable schema branches prove it impossible. Open objects,
conditionals, recursive branches, runtime providers, and other uncertain cases are accepted for
later validation. They do not create a new T10 obligation kind.

The frozen sign-in Source and Bundle provide positive state and immediate-event references. The
T09 `event.missing` scope fence becomes a required T10 rejection. Separate project mutations must
cover a reference outside every handler and references inside both settlement arrays.

## Predicate compatibility

T10 validates predicate structure, lexical references, and statically certain operand types under
`PF-016`; it does not evaluate runtime truth.

- A nested predicate has boolean result type.
- `all`, `any`, and `not` accept nested predicates or statically boolean ValueSpecs.
- `truthy` is the explicit DESEN truth conversion for arbitrary resolved JSON values.
- `exists` accepts a reference and tests original resolution, including JSON `null`; fallback does
  not change the existence of the original reference.
- `eq` and `neq` accept any two resolved JSON values and use canonical JSON equality.
- `gt`, `gte`, `lt`, and `lte` require two numbers or two strings.
- `in` and `contains` retain the array/string operand directions in the protocol table.

A definitely incompatible pair reports `PREDICATE_TYPE_MISMATCH`. If schema unions or runtime
inputs cannot establish one certain type, T10 must defer rather than silently pick a branch; it
does not add a predicate obligation kind. Complete runtime truth tables, consistent input
snapshots, dynamic mismatch diagnostics, and reactive reevaluation remain M04.

## Deterministic formatting

The `$format` profile in `PF-017` uses a single-pass linear parser, never a general template engine.
A placeholder is exactly `{name}` where `name` matches `[A-Za-z_][A-Za-z0-9_]*`. Repeated valid
placeholders are allowed; bare, unmatched, empty, or nested braces are not. DESEN 0.1.0 defines no
escape syntax.

The set of placeholder names must equal the own-property keys in `values`. A missing mapped value
fails at the template and an unused mapped value fails at that value member. Every mapped member is
then traversed as a normal ValueSpec in the same lexical scope. Formatting must not evaluate
expressions, traverse property chains from template text, consult object prototypes, execute code,
or infer locale behavior.

## Repeat and alias semantics

The static repeat profile is fixed by `PF-018`:

1. `items` is analyzed in the incoming outer scope before the new alias exists.
2. The new alias becomes active for `key` and the repeated node's own values and descendants.
3. The alias does not leak to siblings or ancestors.
4. A nested repeat can see outer aliases but cannot shadow one, and its `items` cannot use its own
   not-yet-created alias. Shadowing uses `run.desen.validator/INVALID_BINDING_CONTRACT` at `as`.
5. A statically known non-array uses `REPEAT_ITEMS_INVALID`.
6. For statically enumerable items, every key must resolve to a finite number or string and be
   unique using type-sensitive canonical JSON identity.
7. Missing, non-scalar, or duplicate static keys use `REPEAT_KEY_INVALID`.
8. A key fallback is selected statically only when its primary item path is definitely missing; a
   dynamic primary remains runtime work and cannot create a static duplicate claim.
9. A known direct item array longer than an explicit `limit` uses
   `run.desen.validator/INVALID_BINDING_CONTRACT` at `limit`.

The sortable example is the strongest frozen positive: its `items` resource remains a dynamic
later-stage value, while `item.task.id` and `item.task.title` prove the alias locations that T10
must accept. Runtime collection changes, global limits, canonical instance identifiers, mounted
identity, and asynchronous alias lifetime remain M04, M05, and M12 work.

## Expected public API contract

The intended package-root runtime exports are:

| Export                                | Responsibility                                      |
| ------------------------------------- | --------------------------------------------------- |
| `validateDesenSourceBindingContracts` | Validate a Source cumulatively through T10          |
| `validateDesenBundleBindingContracts` | Validate a Bundle cumulatively through T10          |
| `validateDesenBindingContracts`       | Dispatch explicitly to Source or Bundle validation  |
| `INVALID_BINDING_CONTRACT_CODE`       | Identify project-owned incoherent binding contracts |

The expected public type surface includes the target, success, failure, result, and obligation
types for binding-contract validation. The obligation-kind union remains the same four kinds
inherited from T09: `component-prop`, `style-part-property`, `behavior-prop`, and
`behavior-style-part-property`. T10 must not invent a runtime-resolution result type or a parallel
validated catalog-set type.

For Source and Bundle, the generic dispatcher must be data-equivalent to the specialized API on
success and failure, including target, diagnostics, value when present, and obligation order.
Unsupported dispatcher targets are API misuse; validation failures are returned as inert data.

## Required project mutation goldens

The deterministic artifact must label all T10 negatives as project-owned mutations and pin exact
diagnostic codes and RFC 6901 pointers. At minimum it must cover:

- safe and unsafe state-schema preparation plus valid and invalid state initial values;
- ValueSpec-shaped initial JSON remaining inert;
- declared, missing, nested, open, closed, ambiguous, `null`, and fallback state references;
- immediate component and behavior event references, unknown payload paths, outside-handler use,
  and both settlement-handler exclusions;
- valid outer and inner repeat aliases, self-reference in `items`, sibling leakage, generic nested
  shadowing, non-array items, invalid key kinds, missing keys, duplicate keys, and generic explicit
  limit overflow;
- every predicate operator's accepted static types and every definitely invalid type pairing;
- valid, repeated, missing, unused, malformed, inherited, and non-expression format placeholders;
- the narrow known and unknown first state-action segment; and
- preservation of predecessor diagnostics and obligations on both Source and Bundle failures.

Public-API mutations that admit one of these invalid cases, add a `value` to failure, remove or
reorder obligations, weaken the prerequisite, or alter dispatcher parity must fail the proof.

## Frozen positive corpus

The exact frozen valid Catalog, Source, Bundle, and all five public example paths must pass the
cumulative boundary. The artifact must distinguish byte-identical aliases from independent
behavioral examples.

The most relevant positives are:

- sign-in Source and Bundle: state references, immediate `event.value`, fallbacks, and a predicate
  containing an operation lifecycle value that remains a T11/runtime responsibility;
- store-map Source: deterministic `$format`, state fallback, and immediate `event.id`; and
- sortable-list Source: behavior event references plus the outer `items`, introduced `task` alias,
  key, and descendant item binding.

No frozen negative is assigned specifically to T10. The artifact must record an empty official
T10-invalid list rather than promoting a project mutation to official conformance.

## Deterministic, security, and mutation evidence

The proof must require:

- two independent in-memory evidence builds with byte-identical output;
- identical diagnostics and obligations after recursively reversing object-member order while
  preserving arrays;
- deterministic diagnostic sorting/de-duplication and exact obligation ordering;
- deeply frozen, JSON-serializable results with no retained caller-owned objects;
- complete T09 verifier success followed by exact prerequisite-byte hashing;
- exact 10-family/300-constraint, 12-prose, five-diagnostic, zero-conformance, and zero-BCP-14
  ownership;
- reviewed anchors for `PF-014` through `PF-019`;
- exact runtime exports, type declarations, package/root command wiring, and built-distribution
  inventory;
- one-to-one validator and transitive protocol source/distribution inventories;
- only relative runtime imports plus the validator's exact `@desen/protocol` dependency;
- no Node, React, DOM, CSS, browser, filesystem, network, runtime schema compilation, `require`,
  `eval`, `Function`, or dynamic import in production modules; and
- safe evidence writing through a real parent directory, exclusive same-directory temporary file,
  file sync, atomic rename, and cleanup on every failure path.

The root mutation suite must independently reject artifact-byte drift, trace ownership or count
drift, false BCP 14 ownership, finding drift, one-field predecessor drift, public-API weakening,
schema-safety weakening, distribution drift, and symlink or special-file evidence destinations.

## Scope fences and non-claims

M02-T10 must leave the following work explicit:

- resource and operation declarations, lifecycle paths, policy, input, output, and aliases:
  M02-T11/M04;
- nested `state.set`, complete post-write schema validity, boolean `state.toggle`, navigation,
  refresh, command targets/inputs, and all remaining action semantics: M02-T11/M04;
- context, environment, token, resource, operation, and other host-value resolution: M04;
- runtime predicate truth, repeat materialization, keys over dynamic collections, instance
  identity, event and item lifetime, and reactive reevaluation: M04/M05;
- publication-time obligation discharge and full static binding compatibility: M06;
- document-wide and runtime finite-limit proof: M02-T13/M04/M12;
- official 14-case TypeScript parity and exhaustive diagnostic micro-vectors: M02-T12/M02-T13;
- Bundle revision and catalog-digest verification: M06/M07; and
- adapter execution, publication, activation, G02, and every final Proof Matrix claim: later gates.

No T10 artifact alone can prove runtime execution, adapter payload lifetime, publication
determinism, safe activation, a Validator conformance target, G02, or a new `P-*` status.

## Reproducible evidence contract

The expected tracked artifact destination is:

`docs/proof/artifacts/protocol-0.1.0-binding-contracts.json`

The implementation and evidence are reproduced with:

```bash
pnpm generate:protocol-binding-contracts
pnpm verify:protocol-binding-contracts
pnpm test:protocol-binding-contracts
pnpm check
```

Generation must be the only writer. Verification must rebuild evidence in memory and reject
prerequisite, trace, finding, public API, frozen-corpus, project-mutation, obligation, dispatcher,
scope-fence, command-wiring, platform, distribution, tracked-file, or artifact-byte drift.

The final artifact SHA-256 is recorded in `PROJECT-STATUS.md` and `PROOF-MATRIX.md`, not here, so
this tracked evidence definition does not create a self-referential hash. Task completion still
requires the predecessor artifact cascade, focused tests, full workspace gate, clean-clone check,
and remote CI pass.
