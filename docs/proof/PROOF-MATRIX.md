# Proof Matrix

Status values: `NOT_PROVEN`, `PARTIAL`, `PROVEN`, `FAILED`, `OUT_OF_SCOPE`.

The exact implementation target is `web-react`. `PARTIAL` means preliminary evidence exists but
the complete claim is not established. A visual demonstration alone cannot change a claim to
`PROVEN`. Evidence paths and hashes are populated by the owner task and reverified at G12.

| ID   | Claim                                                                                             | Owner task(s)                      | Current status | Current evidence                                                                                                                                       | Required final evidence                                                                                               | Artifact / hash                                                                                                       | Last verified |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| P-01 | The implementation consumes exact, immutable DESEN 0.1.0 bytes                                    | M02-T01                            | PROVEN         | Complete 31-file upstream Git tree is vendored; pinned manifest, inventory, bytes, aggregate, modes, and drift tests pass                              | Vendored-byte checksum test against exact upstream commit                                                             | `protocol-0.1.0-snapshot.json` `sha256:aaf58f79bc95924fbaa0c2b278cc06f3d28b3986e5d168b5468e6432c04cd5a9`              | 2026-07-21    |
| P-02 | Official valid/negative cases and examples produce expected results                               | M02-T12, M02-T13                   | PARTIAL        | Python suite passes 14/14 cases: 9 vectors + 5 examples; no TypeScript parity yet                                                                      | TypeScript parity report plus project micro-vectors                                                                   | `protocol-0.1.0-validation.txt` `sha256:d2c5e7e2…`; checksums evidence `sha256:6208ed37…`                             | 2026-07-21    |
| P-03 | Publication is deterministic                                                                      | M06-T10                            | NOT_PROVEN     | —                                                                                                                                                      | Same source/catalog twice produces byte-identical semantic bundle and revision                                        | —                                                                                                                     | —             |
| P-04 | Source and bundle documents are inert data and cannot select executable code                      | M02-T06, M12-T03                   | PARTIAL        | M02-T06 returns detached deep-frozen snapshots; ahead-of-time validators and source/distribution audits reject runtime code loading and network access | Exhaustive executable-content forms, markup interpretation, and remote code-selection proof under M12-T03             | `protocol-0.1.0-structural-validation.json` `sha256:1abb36f0a9f7ff233bf7077f818135a912b3b87999a359cf9b51233df590eafc` | 2026-07-22    |
| P-05 | Capabilities are pinned by exact id/version/target/digest                                         | M03-T04, M03-T10, M06-T08, M07-T03 | NOT_PROVEN     | —                                                                                                                                                      | Deterministic artifact tuple plus package mismatch publication and activation tests                                   | —                                                                                                                     | —             |
| P-06 | Desen App and the production-like host use the same real components                               | M03-T09, M09-T03                   | NOT_PROVEN     | —                                                                                                                                                      | Registry identity, package digest, and separately built host evidence                                                 | —                                                                                                                     | —             |
| P-07 | Managed surfaces have no handwritten host component tree                                          | M05-T09, M10-T05                   | NOT_PROVEN     | —                                                                                                                                                      | Automated import/source audit and host E2E                                                                            | —                                                                                                                     | —             |
| P-08 | A designer edits props, slots, state, bindings, and actions visually                              | M09-T05–M09-T09, M10-T01           | NOT_PROVEN     | —                                                                                                                                                      | Desen App browser E2E from an empty project                                                                           | —                                                                                                                     | —             |
| P-09 | Run Mode executes events, state, and operation lifecycle                                          | M09-T10, M10-T02–M10-T04           | NOT_PROVEN     | —                                                                                                                                                      | Pending/success/failure observable trace and UI tests                                                                 | —                                                                                                                     | —             |
| P-10 | Real host operations remain outside design documents                                              | M03-T08, M10-T04                   | NOT_PROVEN     | —                                                                                                                                                      | Fixture-versus-host-operation binding tests and source audit                                                          | —                                                                                                                     | —             |
| P-11 | Authoring-only state does not enter production bundles                                            | M06-T07–M06-T10                    | NOT_PROVEN     | —                                                                                                                                                      | Golden publication, source-digest, and authoring-removal tests                                                        | —                                                                                                                     | —             |
| P-12 | Invalid activation preserves last-known-good across restart                                       | M07-T07–M07-T11, M10-T07           | NOT_PROVEN     | —                                                                                                                                                      | Transactional active/previous-good record, boundary fault injection, A → invalid B → valid C, race, and restart tests | —                                                                                                                     | —             |
| P-13 | Map integrates without changing runtime-core                                                      | M10-T09, M11-T06–M11-T07           | NOT_PROVEN     | —                                                                                                                                                      | Map E2E and runtime-core tree hash equal to frozen G10 baseline                                                       | Future `docs/proof/artifacts/runtime-core-baseline.json` and Map comparison                                           | —             |
| P-14 | Sortable behavior integrates without changing runtime-core                                        | M10-T09, M11-T12                   | NOT_PROVEN     | —                                                                                                                                                      | Reorder E2E and runtime-core tree hash equal to frozen G10 baseline                                                   | Future `docs/proof/artifacts/runtime-core-baseline.json` and Sortable comparison                                      | —             |
| P-15 | Existing complex capabilities build a second surface without screen code                          | M11-T13                            | NOT_PROVEN     | —                                                                                                                                                      | Desen App runbook, published source/bundle, and host source audit                                                     | —                                                                                                                     | —             |
| P-16 | Runtime diagnostics trace to stable source-node identity                                          | M05-T05, M09-T13                   | NOT_PROVEN     | —                                                                                                                                                      | Runtime-node ↔ source-node diagnostic tests                                                                           | —                                                                                                                     | —             |
| P-17 | Runtime bounds execution and never guesses unknown semantics                                      | M02-T13, M04-T13, M05-T06, M07-T04 | NOT_PROVEN     | —                                                                                                                                                      | Unknown-capability, finite-limit, and activation vectors                                                              | —                                                                                                                     | —             |
| P-18 | Platform-neutral packages contain no React/Web dependencies and core traces are JSON-serializable | M01-T05, M04-T16, M08-T10          | PARTIAL        | Dependency rules and six boundary fixtures pass; functional JSON trace does not yet exist                                                              | Boundary tests over implemented packages plus JSON trace portability audit                                            | `tracked-foundation.json` `sha256:5c430da7e221dc37c9bdd4ca1c423f1a84d0aabe22cfe4465e40b67fa7d1529c`                   | 2026-07-21    |

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
`sha256:48a3b2d7d5ac336a70f4c58d9ef485a5340305528b5ba777af612703a0df7bb5`.

M02-T06's structural-validation artifact proves the exact three frozen root validators, all 13
embedded-schema locator families, an independent immutable input boundary, stable structural
diagnostics, deterministic standalone generation, and a production-source/distribution audit with
no runtime compilation, dynamic loading, or network access. P-04 becomes `PARTIAL`, not `PROVEN`,
because exhaustive prohibited-content and remote-selection coverage remains assigned to M12-T03:
`protocol-0.1.0-structural-validation.json`
`sha256:1abb36f0a9f7ff233bf7077f818135a912b3b87999a359cf9b51233df590eafc`.

M02-T07's semantic-foundation artifact proves strict SemVer syntax, exact declared-catalog
matching, entry and identity namespaces, set-wide capability uniqueness, category-aware component,
behavior, resource, and operation existence, extension opacity, and the two official T07 invalid
vectors. No `P-*` status changes: P-05 still requires publication/activation digest work, and P-17
still requires complete M02-T13 diagnostics plus runtime and activation bounds:
`protocol-0.1.0-semantic-foundation.json`
`sha256:df0bb50f1a8ac6a4e071458e13deccb2693db19cbed0c8514ac3560caee97561`.

M02-T08's component-contract artifact proves statically knowable base and Variant props,
slot presence/cardinality/acceptance, visual states, style parts, dynamic validation obligations,
five core diagnostic identities, and the project-owned host-safe schema boundary. It covers 7
reviewed schema families with 191 constraints, 15 project mutation goldens, and 7 schema-safety
goldens. No official invalid vector is assigned specifically to T08, and no `P-*` status changes:
official-suite parity remains M02-T12/M02-T13 and complete bounded-runtime behavior remains later
work:
`protocol-0.1.0-component-contracts.json`
`sha256:75d6fad78b763ab74182f4bdfdac034d6dce382f5c842856dbedf1de1b6ce3b5`.

M02-T09's interaction-contract artifact proves behavior props, slots, styles, attachment and
exclusive-channel conflicts; declared component and behavior events; command names for statically
known component targets; and detached bounded resolved-event payload validation. It covers 7
reviewed schema families with 246 constraints, 5 owned and 5 reused core diagnostics, the official
T09 unknown-event vector, 15 behavior goldens, 6 attachment goldens, 7 conflict goldens, 8
schema-safety goldens, and 10 payload-safety goldens. `N-033` and `N-034` remain `PLANNED` because
production adapter enforcement and command parity belong to M03/M04; no `P-*` status changes:
`protocol-0.1.0-interaction-contracts.json`
`sha256:e9de90164dd7c80a7cb49568b96276771de7c14c9fa5bf2f4e26101458a286fe`.
