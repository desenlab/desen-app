# Proof Matrix

Status values: `NOT_PROVEN`, `PARTIAL`, `PROVEN`, `FAILED`, `OUT_OF_SCOPE`.

The exact implementation target is `web-react`. `PARTIAL` means preliminary evidence exists but
the complete claim is not established. A visual demonstration alone cannot change a claim to
`PROVEN`. Evidence paths and hashes are populated by the owner task and reverified at G12.

| ID   | Claim                                                                                             | Owner task(s)                      | Current status | Current evidence                                                                                                                                       | Required final evidence                                                                                               | Artifact / hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Last verified |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| P-01 | The implementation consumes exact, immutable DESEN 0.1.0 bytes                                    | M02-T01                            | PROVEN         | Complete 31-file upstream Git tree is vendored; pinned manifest, inventory, bytes, aggregate, modes, and drift tests pass                              | Vendored-byte checksum test against exact upstream commit                                                             | `protocol-0.1.0-snapshot.json` `sha256:aaf58f79bc95924fbaa0c2b278cc06f3d28b3986e5d168b5468e6432c04cd5a9`                                                                                                                                                                                                                                                                                                                                                                       | 2026-07-21    |
| P-02 | Official valid/negative cases and examples produce expected results                               | M02-T12, M02-T13                   | PROVEN         | Python and built TypeScript pass the exact 14-case starter suite; 34 positive/negative diagnostic pairs pass the complete declared validator scope     | Fulfilled: official parity plus one positive and one exact negative vector for every validator-emitted diagnostic     | `protocol-0.1.0-validation.txt` `sha256:d2c5e7e27a5a1f5ecc66f3aad4956451c81b420a60908be5c948071a7305aa86`; `protocol-0.1.0-checksums.txt` `sha256:6208ed37fa4da3b816e505c106be1801fcee504e1dde2ab4a4e4ceb5b0ca166f`; `protocol-0.1.0-official-suite-parity.json` `sha256:9fd6c647d3548dfd18430ab2b77110ac2a732e0afaa6b0c1f1aa58c92c8a16e7`; `protocol-0.1.0-validator-diagnostic-micro-vectors.json` `sha256:104227f76404dabcd1d56b1b24c253226f24e08fa6054016ddb8e1840e1a357c` | 2026-07-22    |
| P-03 | Publication is deterministic                                                                      | M06-T10                            | NOT_PROVEN     | —                                                                                                                                                      | Same source/catalog twice produces byte-identical semantic bundle and revision                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-04 | Source and bundle documents are inert data and cannot select executable code                      | M02-T06, M12-T03                   | PARTIAL        | M02-T06 returns detached deep-frozen snapshots; ahead-of-time validators and source/distribution audits reject runtime code loading and network access | Exhaustive executable-content forms, markup interpretation, and remote code-selection proof under M12-T03             | `protocol-0.1.0-structural-validation.json` `sha256:da9760dc361e640ddb2080bd599285f97570ebe22bda08def283f4cb9412288c`                                                                                                                                                                                                                                                                                                                                                          | 2026-07-22    |
| P-05 | Capabilities are pinned by exact id/version/target/digest                                         | M03-T04, M03-T10, M06-T08, M07-T03 | NOT_PROVEN     | —                                                                                                                                                      | Deterministic artifact tuple plus package mismatch publication and activation tests                                   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-06 | Desen App and the production-like host use the same real components                               | M03-T09, M09-T03                   | NOT_PROVEN     | —                                                                                                                                                      | Registry identity, package digest, and separately built host evidence                                                 | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-07 | Managed surfaces have no handwritten host component tree                                          | M05-T09, M10-T05                   | NOT_PROVEN     | —                                                                                                                                                      | Automated import/source audit and host E2E                                                                            | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-08 | A designer edits props, slots, state, bindings, and actions visually                              | M09-T05–M09-T09, M10-T01           | NOT_PROVEN     | —                                                                                                                                                      | Desen App browser E2E from an empty project                                                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-09 | Run Mode executes events, state, and operation lifecycle                                          | M09-T10, M10-T02–M10-T04           | NOT_PROVEN     | —                                                                                                                                                      | Pending/success/failure observable trace and UI tests                                                                 | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-10 | Real host operations remain outside design documents                                              | M03-T08, M10-T04                   | NOT_PROVEN     | —                                                                                                                                                      | Fixture-versus-host-operation binding tests and source audit                                                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-11 | Authoring-only state does not enter production bundles                                            | M06-T07–M06-T10                    | NOT_PROVEN     | —                                                                                                                                                      | Golden publication, source-digest, and authoring-removal tests                                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-12 | Invalid activation preserves last-known-good across restart                                       | M07-T07–M07-T11, M10-T07           | NOT_PROVEN     | —                                                                                                                                                      | Transactional active/previous-good record, boundary fault injection, A → invalid B → valid C, race, and restart tests | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-13 | Map integrates without changing runtime-core                                                      | M10-T09, M11-T06–M11-T07           | NOT_PROVEN     | —                                                                                                                                                      | Map E2E and runtime-core tree hash equal to frozen G10 baseline                                                       | Future `docs/proof/artifacts/runtime-core-baseline.json` and Map comparison                                                                                                                                                                                                                                                                                                                                                                                                    | —             |
| P-14 | Sortable behavior integrates without changing runtime-core                                        | M10-T09, M11-T12                   | NOT_PROVEN     | —                                                                                                                                                      | Reorder E2E and runtime-core tree hash equal to frozen G10 baseline                                                   | Future `docs/proof/artifacts/runtime-core-baseline.json` and Sortable comparison                                                                                                                                                                                                                                                                                                                                                                                               | —             |
| P-15 | Existing complex capabilities build a second surface without screen code                          | M11-T13                            | NOT_PROVEN     | —                                                                                                                                                      | Desen App runbook, published source/bundle, and host source audit                                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-16 | Runtime diagnostics trace to stable source-node identity                                          | M05-T05, M09-T13                   | NOT_PROVEN     | —                                                                                                                                                      | Runtime-node ↔ source-node diagnostic tests                                                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-17 | Runtime bounds execution and never guesses unknown semantics                                      | M02-T13, M04-T13, M05-T06, M07-T04 | PARTIAL        | Validator micro-vectors cover unknown/unsupported semantics and bounded contract-schema and resolved-JSON validation; runtime execution is not built   | Runtime materialization, action-turn, Bundle-ingress, adapter, and activation finite-limit vectors                    | `protocol-0.1.0-validator-diagnostic-micro-vectors.json` `sha256:104227f76404dabcd1d56b1b24c253226f24e08fa6054016ddb8e1840e1a357c`                                                                                                                                                                                                                                                                                                                                             | 2026-07-22    |
| P-18 | Platform-neutral packages contain no React/Web dependencies and core traces are JSON-serializable | M01-T05, M04-T16, M08-T10          | PARTIAL        | Dependency rules and six boundary fixtures pass; functional JSON trace does not yet exist                                                              | Boundary tests over implemented packages plus JSON trace portability audit                                            | `tracked-foundation.json` `sha256:5c430da7e221dc37c9bdd4ca1c423f1a84d0aabe22cfe4465e40b67fa7d1529c`                                                                                                                                                                                                                                                                                                                                                                            | 2026-07-21    |

The implementation report must preserve failed and partial results. `PROVEN` requires all owner
tasks to be `DONE`, final evidence to exist at a stable path, and the artifact hash to be recorded.

M02-T02's traceability artifact is planning evidence rather than a behavior claim and therefore
does not change any `P-*` status:
`protocol-0.1.0-traceability.json`
`sha256:749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514`.

M02-T03's deterministic type-generation artifact is compile-time structural evidence and likewise
does not change any `P-*` status:
`protocol-0.1.0-types.json`
`sha256:e21826f5d171aefbed2e3fd833e6f0dc10de1bac71e7b74f51a255f43bb37971`.

M02-T04's canonicalization artifact proves RFC 8785, SHA-256, and the two Section 11 projection
primitives. It does not yet prove official-suite parity, publisher determinism, or activation-time
verification, so no `P-*` status changes:
`protocol-0.1.0-canonicalization.json`
`sha256:8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6`.

M02-T05's diagnostic artifact proves the exact Appendix B registry, shared portable diagnostic
data, and RFC 6901 JSON Pointer primitives. It does not prove that later validators, runtimes,
publishers, activation code, or editor surfaces emit those diagnostics, so no `P-*` status changes:
`protocol-0.1.0-diagnostics.json`
`sha256:daaa4009d8e7a868f5cbe351b75d49fa7dbe4283f4eb60ad2fed2c56d89dd037`.

M02-T06's structural-validation artifact proves the exact three frozen root validators, all 13
embedded-schema locator families, an independent immutable input boundary, stable structural
diagnostics, deterministic standalone generation, and a production-source/distribution audit with
no runtime compilation, dynamic loading, or network access. P-04 becomes `PARTIAL`, not `PROVEN`,
because exhaustive prohibited-content and remote-selection coverage remains assigned to M12-T03:
`protocol-0.1.0-structural-validation.json`
`sha256:da9760dc361e640ddb2080bd599285f97570ebe22bda08def283f4cb9412288c`.

M02-T07's semantic-foundation artifact proves strict SemVer syntax, exact declared-catalog
matching, entry and identity namespaces, set-wide capability uniqueness, category-aware component,
behavior, resource, and operation existence, extension opacity, and the two official T07 invalid
vectors. No claim changed at M02-T07: P-05 still requires publication/activation digest work, and
P-17 required the later M02-T13 evidence plus runtime and activation bounds:
`protocol-0.1.0-semantic-foundation.json`
`sha256:565278a4c66a2d672eb3570f4df28adc8d45b8cacfdb01735ce94319d41b4d3b`.

M02-T08's component-contract artifact proves statically knowable base and Variant props,
slot presence/cardinality/acceptance, visual states, style parts, dynamic validation obligations,
five core diagnostic identities, and the project-owned host-safe schema boundary. It covers 7
reviewed schema families with 191 constraints, 15 project mutation goldens, and 7 schema-safety
goldens. No official invalid vector is assigned specifically to T08, and no `P-*` status changes:
official-suite parity remains M02-T12/M02-T13 and complete bounded-runtime behavior remains later
work:
`protocol-0.1.0-component-contracts.json`
`sha256:f587375f0da3bf9ec061a2c67d39b8319487afb3387fe29363b2c9980201295a`.

M02-T09's interaction-contract artifact proves behavior props, slots, styles, attachment and
exclusive-channel conflicts; declared component and behavior events; command names for statically
known component targets; and detached bounded resolved-event payload validation. It covers 7
reviewed schema families with 246 constraints, 5 owned and 5 reused core diagnostics, the official
T09 unknown-event vector, 15 behavior goldens, 6 attachment goldens, 7 conflict goldens, 8
schema-safety goldens, and 10 payload-safety goldens. `N-033` and `N-034` remain `PLANNED` because
production adapter enforcement and command parity belong to M03/M04; no `P-*` status changes:
`protocol-0.1.0-interaction-contracts.json`
`sha256:d3a3b5248475705b001c169bf8f62b0174c89c238a7a69f6a08aa888f8d90178`.

M02-T10's binding-contract artifact proves inert state initialization, surface-local and lexical
state/item/event references, fallback-versus-`null` behavior, statically decidable predicate
types, exact linear formatting, repeat array/alias/key/direct-limit rules, and narrow state-action
roots. It covers 10 reviewed schema families with 300 constraints, 12 prose rules, 5 core
diagnostic identities, 48 project mutation goldens, all 5 frozen examples, and exact carry-forward
of all 4 T09 obligation kinds. No official invalid vector, BCP 14 clause, or conformance rule is
assigned directly to T10. No `P-*` status changes: complete official parity, runtime execution,
finite runtime bounds, publication, and activation remain with their assigned later owners:
`protocol-0.1.0-binding-contracts.json`
`sha256:acec8add9cd54ff0d8ec37174d1f06d494d9b818976f97d80ea722c6049b64f5`.

M02-T11's execution-contract artifact proves statically knowable resource and operation inputs;
resource and operation lifecycle references; navigation and refresh actions; component command
targets and inputs; narrow state writes; and detached, bounded validation of resolved execution
values. It covers 9 reviewed schema families with 383 constraints, 11 prose rules, 2 invariants, 5
owned core diagnostics, 42 project mutation goldens, 1 accepted and 5 rejected schema-safety
cases, 4 accepted and 6 rejected bounded resolved-value safety cases, 4 separately executed
hostile-value rejections, 3 forged lower-stage catalog entry-point rejections, all 5 frozen
examples, 4 inherited plus 4 new obligation kinds, and all 5 resolved-value selectors. No official
invalid vector, BCP 14 clause, or conformance responsibility is assigned directly to T11. No
`P-*` status changes: official-suite parity, runtime execution, finite runtime bounds, publication,
and activation remain with their assigned later owners:
`protocol-0.1.0-execution-contracts.json`
`sha256:f0f6852e7ec9bc6a37dd3d31475a421454ca2a39ea473627038e1f053ccdb6b3`.

M02-T12's official-suite artifact proves that the built TypeScript implementation and archived
Python reference both pass all 14 exact frozen starter-suite cases: 9 official conformance vectors
and 5 public examples. The proof-only runner composes T04 canonicalization with the cumulative T11
validator and adds no public API. Together with the completed M02-T13 exhaustive project vectors,
this closes P-02 and G02:
`protocol-0.1.0-official-suite-parity.json`
`sha256:9fd6c647d3548dfd18430ab2b77110ac2a732e0afaa6b0c1f1aa58c92c8a16e7`.

M02-T13's diagnostic micro-vector artifact proves one valid zero-diagnostic case and one exact
single-diagnostic case for all 28 core diagnostics emitted by the validator and all 6 current
validator-namespaced extension diagnostics. The 34 pairs cover exact code, Appendix B
classification where applicable, RFC 6901 pointer, available context, both caller inputs, both
complete inert result graphs, and repeated-run equality. The evidence binds 53 reviewed trace
responsibilities, the global 61-family/989-constraint schema route, and all five T08–T12 prerequisite
artifacts. The remaining 8 core diagnostics belong to runtime, publisher, resolution, or activation
tasks. P-02 becomes `PROVEN` and G02 becomes `DONE`; P-17 becomes only `PARTIAL`, while N-041 stays
`PLANNED` until runtime materialization, action-turn, Bundle-ingress, adapter, and activation limits
are implemented:
`protocol-0.1.0-validator-diagnostic-micro-vectors.json`
`sha256:104227f76404dabcd1d56b1b24c253226f24e08fa6054016ddb8e1840e1a357c`.

M03-T01's Catalog registration artifact proves a framework-neutral two-function JSON API for exact
component contract snapshots and complete Catalog root composition. It covers schema-authoritative
component fields, readonly and exact compile-time inputs, detached canonical-key-ordered deep-frozen
outputs, distinct-object duplicate rejection, validator acceptance, source/declaration/distribution
platform audits, and mutation-resistant evidence writing. Behavior, operation, and resource
registration; deterministic package digests; implementation parity; and the final immutable
artifact tuple remain assigned to M03-T02 through M03-T10. Therefore no `P-*` status changes and
G03 remains open:
`catalog-sdk-0.1.0-manifest-registration.json`
`sha256:2f97bdd57c26e8922836464d3415b55b10eac034c359e8363a8ed68d1002d030`.
