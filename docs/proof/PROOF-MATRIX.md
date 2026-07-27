# Proof Matrix

Status values: `NOT_PROVEN`, `PARTIAL`, `PROVEN`, `FAILED`, `OUT_OF_SCOPE`.

The exact implementation target is `web-react`. `PARTIAL` means preliminary evidence exists but
the complete claim is not established. A visual demonstration alone cannot change a claim to
`PROVEN`. Evidence paths and hashes are populated by the owner task and reverified at G12.

| ID   | Claim                                                                                             | Owner task(s)                              | Current status | Current evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Required final evidence                                                                                                      | Artifact / hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Last verified |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| P-01 | The implementation consumes exact, immutable DESEN 0.1.0 bytes                                    | M02-T01                                    | PROVEN         | Complete 31-file upstream Git tree is vendored; pinned manifest, inventory, bytes, aggregate, modes, and drift tests pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Vendored-byte checksum test against exact upstream commit                                                                    | `protocol-0.1.0-snapshot.json` `sha256:aaf58f79bc95924fbaa0c2b278cc06f3d28b3986e5d168b5468e6432c04cd5a9`                                                                                                                                                                                                                                                                                                                                                                       | 2026-07-21    |
| P-02 | Official valid/negative cases and examples produce expected results                               | M02-T12, M02-T13                           | PROVEN         | Python and built TypeScript pass the exact 14-case starter suite; 34 positive/negative diagnostic pairs pass the complete declared validator scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Fulfilled: official parity plus one positive and one exact negative vector for every validator-emitted diagnostic            | `protocol-0.1.0-validation.txt` `sha256:d2c5e7e27a5a1f5ecc66f3aad4956451c81b420a60908be5c948071a7305aa86`; `protocol-0.1.0-checksums.txt` `sha256:6208ed37fa4da3b816e505c106be1801fcee504e1dde2ab4a4e4ceb5b0ca166f`; `protocol-0.1.0-official-suite-parity.json` `sha256:efa6b4ed014b942d45d621ffc77c47e76d82dd6965deb13cf677c6bebf7a76ae`; `protocol-0.1.0-validator-diagnostic-micro-vectors.json` `sha256:3214a26a683d46a3b20c6ca400de44faa2c5e394f706a6e3e8d3d3628da78718` | 2026-07-23    |
| P-03 | Publication is deterministic                                                                      | M06-T10                                    | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Same source/catalog twice produces byte-identical semantic bundle and revision                                               | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-04 | Source and bundle documents are inert data and cannot select executable code                      | M02-T06, M12-T03                           | PARTIAL        | M02-T06 returns detached deep-frozen snapshots; ahead-of-time validators and source/distribution audits reject runtime code loading and network access                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Exhaustive executable-content forms, markup interpretation, and remote code-selection proof under M12-T03                    | `protocol-0.1.0-structural-validation.json` `sha256:7e7662e6b20e29452f8c5092e37d2fefe1a416e787816693543b0c2c1a2e6536`                                                                                                                                                                                                                                                                                                                                                          | 2026-07-23    |
| P-05 | Capabilities are pinned by exact id/version/target/digest                                         | M03-T04, M03-T10, M06-T08, M07-T03         | PARTIAL        | The final `run.desen.reference.sign-in@0.1.0` Web–React tuple is reproduced from the exact Catalog and all 76 emitted distribution files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Package-mismatch publication, immutable distribution, resolution, and activation tests                                       | `reference-catalog-web-package-digest-v1.json` `sha256:e56c74696e8aa68c1d3ab71ac3ae087ed8c5df05f4a19b9a6d310da8758b0716`; `reference-catalog-web-capability-artifact.json` `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`                                                                                                                                                                                                                           | 2026-07-24    |
| P-06 | Desen App and the production-like host use the same real components                               | M03-T09, M09-T03                           | PARTIAL        | The exact sign-in reference slice binds both roles to the same five real component exports and now pins their complete logical package tuple                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Desen App registry identity and separately built host evidence                                                               | `reference-catalog-web-parity.json` `sha256:6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a`; `reference-catalog-web-capability-artifact.json` `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`                                                                                                                                                                                                                                      | 2026-07-24    |
| P-07 | Managed surfaces have no handwritten host component tree                                          | M05-T09, M10-T05                           | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Automated import/source audit and host E2E                                                                                   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-08 | A designer edits props, slots, state, bindings, and actions visually                              | M09-T05–M09-T09, M10-T01                   | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Desen App browser E2E from an empty project                                                                                  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-09 | Run Mode executes events, state, and operation lifecycle                                          | M09-T10, M10-T02–M10-T04                   | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Pending/success/failure observable trace and UI tests                                                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-10 | Real host operations remain outside design documents                                              | M03-T08, M10-T04                           | PARTIAL        | Exact fixtures and the final Catalog remain inert data; the exact package surface exposes no loader while the host binding retains application code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Production-like host execution plus fixture-versus-host-operation binding and source audit                                   | `reference-sign-in-fixtures-and-host-binding.json` `sha256:b0413687bd907b71509db52d3e22b6eda5a4150509ac323bf51e5f8425f897e2`; `reference-catalog-web-capability-artifact.json` `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`                                                                                                                                                                                                                       | 2026-07-24    |
| P-11 | Authoring-only state does not enter production bundles                                            | M06-T07–M06-T10                            | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Golden publication, source-digest, and authoring-removal tests                                                               | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-12 | Invalid activation preserves last-known-good across restart                                       | M07-T07–M07-T11, M10-T07                   | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Transactional active/previous-good record, boundary fault injection, A → invalid B → valid C, race, and restart tests        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-13 | Map integrates without changing runtime-core                                                      | M10-T09, M11-T06–M11-T07                   | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Map E2E and runtime-core tree hash equal to frozen G10 baseline                                                              | Future `docs/proof/artifacts/runtime-core-baseline.json` and Map comparison                                                                                                                                                                                                                                                                                                                                                                                                    | —             |
| P-14 | Sortable behavior integrates without changing runtime-core                                        | M10-T09, M11-T12                           | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Reorder E2E and runtime-core tree hash equal to frozen G10 baseline                                                          | Future `docs/proof/artifacts/runtime-core-baseline.json` and Sortable comparison                                                                                                                                                                                                                                                                                                                                                                                               | —             |
| P-15 | Existing complex capabilities build a second surface without screen code                          | M11-T13                                    | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Desen App runbook, published source/bundle, and host source audit                                                            | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-16 | Runtime diagnostics trace to stable source-node identity                                          | M05-T05, M09-T13                           | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Runtime-node ↔ source-node diagnostic tests                                                                                  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —             |
| P-17 | Runtime bounds execution and never guesses unknown semantics                                      | M02-T13, M04-T13–M04-T17, M05-T06, M07-T04 | PARTIAL        | Validator micro-vectors cover unknown and unsupported semantics; M04-T02–M04-T15 prove bounded fail-closed resolution, lifecycle, action, adapter-bridge, and reactive behavior. M04-T16 adds validated Bundle/Catalog ingress, exact revision verification, complete conditional/repeat materialization, plan and binding commitments, atomic binding reconciliation, coherent tree/binding/handler/trace ceilings, and terminal session disposal. M04-T17 adds generic operation/resource settlement notification, factory-authenticated bounded snapshot subscriptions, exact migration-ledger proof, and deterministic rollback/publication fault containment. | Concrete production-adapter unknown-capability behavior and activation finite-limit vectors remain with M05-T06 and M07-T04. | Prior M02–M04 artifacts listed below; `runtime-core-0.1.0-headless-sign-in.json` (M04-T16 initial G04 sign-in evidence); `runtime-core-0.1.0-audit-hardening.json` (M04-T17/G04 final audit evidence)                                                                                                                                                                                                                                                                          | 2026-07-27    |
| P-18 | Platform-neutral packages contain no React/Web dependencies and core traces are JSON-serializable | M01-T05, M04-T16–M04-T17, M08-T10          | PARTIAL        | Dependency rules and six boundary fixtures pass. M04-T16 source and distribution audits contain no React, DOM, CSS, browser, or application imports. Success/navigation, failure/retry, and stale-replacement scenarios each run in two independent sessions; every callback-free JSON pair and the combined six-session trace pass exact JSON round-trip, RFC 8785 canonicalization, and SHA-256 equality. M04-T17 re-audits the complete runtime source boundary after adding the generic settlement and public session-subscription APIs.                                                                                                                       | M08-T10 must still prove the independent editor-core artifact and React/DOM boundary before P-18 can become `PROVEN`.        | `tracked-foundation.json` `sha256:5c430da7e221dc37c9bdd4ca1c423f1a84d0aabe22cfe4465e40b67fa7d1529c`; `runtime-core-0.1.0-headless-sign-in.json` (M04-T16 initial G04 sign-in evidence); `runtime-core-0.1.0-audit-hardening.json` (M04-T17/G04 final audit evidence)                                                                                                                                                                                                           | 2026-07-27    |

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
`sha256:e3ec18d8e870e8bbfb8dbfb9958d35208c894519b6ba9af30b6b0bcc5c9e7b8b`.

M02-T06's structural-validation artifact proves the exact three frozen root validators, all 13
embedded-schema locator families, an independent immutable input boundary, stable structural
diagnostics, deterministic standalone generation, and a production-source/distribution audit with
no runtime compilation, dynamic loading, or network access. P-04 becomes `PARTIAL`, not `PROVEN`,
because exhaustive prohibited-content and remote-selection coverage remains assigned to M12-T03:
`protocol-0.1.0-structural-validation.json`
`sha256:7e7662e6b20e29452f8c5092e37d2fefe1a416e787816693543b0c2c1a2e6536`.

M02-T07's semantic-foundation artifact proves strict SemVer syntax, exact declared-catalog
matching, entry and identity namespaces, set-wide capability uniqueness, category-aware component,
behavior, resource, and operation existence, extension opacity, and the two official T07 invalid
vectors. No claim changed at M02-T07: P-05 still requires publication/activation digest work, and
P-17 required the later M02-T13 evidence plus runtime and activation bounds:
`protocol-0.1.0-semantic-foundation.json`
`sha256:96048882670a6c23629ff686f61e14105a51bc6bcf287fff7ee372045782caa7`.

M02-T08's component-contract artifact proves statically knowable base and Variant props,
slot presence/cardinality/acceptance, visual states, style parts, dynamic validation obligations,
five core diagnostic identities, and the project-owned host-safe schema boundary. It covers 7
reviewed schema families with 191 constraints, 15 project mutation goldens, and 7 schema-safety
goldens. No official invalid vector is assigned specifically to T08, and no `P-*` status changes:
official-suite parity remains M02-T12/M02-T13 and complete bounded-runtime behavior remains later
work:
`protocol-0.1.0-component-contracts.json`
`sha256:71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac`.

M02-T09's interaction-contract artifact proves behavior props, slots, styles, attachment and
exclusive-channel conflicts; declared component and behavior events; command names for statically
known component targets; and detached bounded resolved-event payload validation. It covers 7
reviewed schema families with 246 constraints, 5 owned and 5 reused core diagnostics, the official
T09 unknown-event vector, 15 behavior goldens, 6 attachment goldens, 7 conflict goldens, 8
schema-safety goldens, and 10 payload-safety goldens. `N-033` and `N-034` remain `PLANNED` because
production adapter enforcement and command parity belong to M03/M04; no `P-*` status changes:
`protocol-0.1.0-interaction-contracts.json`
`sha256:981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208`.

M02-T10's binding-contract artifact proves inert state initialization, surface-local and lexical
state/item/event references, fallback-versus-`null` behavior, statically decidable predicate
types, exact linear formatting, repeat array/alias/key/direct-limit rules, and narrow state-action
roots. It covers 10 reviewed schema families with 300 constraints, 12 prose rules, 5 core
diagnostic identities, 48 project mutation goldens, all 5 frozen examples, and exact carry-forward
of all 4 T09 obligation kinds. No official invalid vector, BCP 14 clause, or conformance rule is
assigned directly to T10. No `P-*` status changes: complete official parity, runtime execution,
finite runtime bounds, publication, and activation remain with their assigned later owners:
`protocol-0.1.0-binding-contracts.json`
`sha256:2ffa1b874bae23df8ba3e0e0334b3f0b6739ec4dfd6acc9e2aabf1c87ce9c39c`.

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
`sha256:f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`.

M02-T12's official-suite artifact proves that the built TypeScript implementation and archived
Python reference both pass all 14 exact frozen starter-suite cases: 9 official conformance vectors
and 5 public examples. The proof-only runner composes T04 canonicalization with the cumulative T11
validator and adds no public API. Together with the completed M02-T13 exhaustive project vectors,
this closes P-02 and G02:
`protocol-0.1.0-official-suite-parity.json`
`sha256:efa6b4ed014b942d45d621ffc77c47e76d82dd6965deb13cf677c6bebf7a76ae`.

M02-T13's diagnostic micro-vector artifact proves one valid zero-diagnostic case and one exact
single-diagnostic case for all 28 core diagnostics emitted by the validator and all 6 current
validator-namespaced extension diagnostics. The 34 pairs cover exact code, Appendix B
classification where applicable, RFC 6901 pointer, available context, both caller inputs, both
complete inert result graphs, and repeated-run equality. The evidence binds 53 reviewed trace
responsibilities, the global 61-family/989-constraint schema route, and all five T08–T12 prerequisite
artifacts. The remaining 8 core diagnostics belong to runtime, publisher, resolution, or activation
tasks. P-02 becomes `PROVEN` and G02 becomes `DONE`; P-17 becomes only `PARTIAL`. M04-T13 now
covers the action-turn slice, while N-041 stays `PLANNED` until final materialization,
Bundle-ingress, adapter, and activation limits are implemented:
`protocol-0.1.0-validator-diagnostic-micro-vectors.json`
`sha256:3214a26a683d46a3b20c6ca400de44faa2c5e394f706a6e3e8d3d3628da78718`.

M03-T01 through M03-T03's cumulative Catalog SDK artifact proves a framework-neutral six-function
JSON API for exact component, behavior, operation, and resource contract snapshots, complete
four-map Catalog composition, and deterministic component inspector metadata. TypeScript props,
control kind, requiredness, enum options, and honest fallback all derive from the same literal
`propsSchema`; `authoring.controls` remains an opaque non-authoritative sidecar under `PF-025`.
The evidence covers 34 direct constraints in `SC-033`/`SC-056`, 33 package tests, 71 compiler
negative cases, 43 independent proof/mutation tests, 24 fallback forms, 35 hostile inspector
values, RFC 6901 pointers, canonical integer-like key order, and exact 16-level/512-control limits,
alongside all cumulative registration, validator-acceptance, platform-boundary, and safe-writer
checks. `PF-024` keeps manifest APIs distinct from executable host binding. Deterministic package
digests are covered separately by M03-T04; host operation binding, implementation parity, the
final immutable artifact tuple, concrete editor widgets, and renderer adapters remain assigned to
M03-T08, M03-T09, M03-T10, M09, and M05. Therefore this M03-T01–M03-T03 artifact itself changes no
`P-*` status and G03 remains open:
`catalog-sdk-0.1.0-manifest-registration.json`
`sha256:062ec5656ca507c79fef0ce97e87931b54fa23a038a8862b2532b6e7e9ba3432`.

M03-T04 defines the separately versioned `desen.web-react.package-digest` binary profile in
`@desen/reference-catalog-web`. It frames a projected RFC 8785-compatible `catalog.json` entry and
every exact target artifact behind a target-specific domain-separation header, canonical
lowercase-ASCII path order, and unambiguous big-endian lengths. The evidence covers 18 package
tests, 5 compiler-negative API cases, 16 independent proof/mutation tests, 269 fixed mutation
vectors, an independent Node.js framing and SHA-256 oracle, caller ownership, bounded inputs,
fresh preimage bytes, frozen audit metadata, and published Catalog self-digest verification.
`N-015` becomes `TESTED`. `P-05` advances only to `PARTIAL`: the real complete adapter inventory,
manifest parity, final exact package tuple, distributor immutability, publication, resolution, and
activation remain assigned to M03-T09/M03-T10, M06, and M07:
`reference-catalog-web-package-digest-v1.json`
`sha256:e56c74696e8aa68c1d3ab71ac3ae087ed8c5df05f4a19b9a6d310da8758b0716`.

M03-T05 adds the first real `web-react` component slice without changing a `P-*` status. The
frozen official `com.example.ui/Stack` and `com.example.ui/Text` manifests now resolve to
schema-derived React props and native HTML semantics through the dedicated component subpath.
Evidence covers exact fixture equality, deep immutability, two closed public prop schemas, one
validator-accepted Catalog and Source, exact unknown/missing-prop diagnostics, preserved Stack
reading order, Text semantic elements, escaped markup-like content, 420 pinned Stack cross-product
vectors, 56 Text/escaping vectors, exact source-shape checks, 5 focused package tests, 7
compiler-negative cases, and 18 independent proof/mutation tests. Strict tracked-default
provenance rejects injected APIs, alternate web exports, and path aliases. M03-T06 now verifies
this artifact as its exact prerequisite; S-004 remains `PLANNED` only for M03-T09's final parity
work, and G03 remains open:
`reference-catalog-web-components.json`
`sha256:788b68af9520ebf49fac1d39a505bc11e153f6a1d7a5ab89f57c9207b251cc51`.

M03-T06 extends the `web-react` reference slice with the frozen official TextField, Button, and
Alert contracts without changing a `P-*` status. All five public component prop schemas are
closed. The cumulative controlled Source connects `change` to a state write and `press` to the
TextField `focus` command, passes all six validator layers, and preserves one exact dynamic
state-write obligation. Evidence covers exact official manifests, deep immutability, 256
independent server-render vectors, 23 real built-package event vectors, 2 focus scenarios, 11
focused package tests, 22 compiler-negative cases, and 18 independent proof/mutation tests.
Adversarial checks reject dropped or extra callback arguments, DOM event or focus-handle leakage,
disabled focus redirection, inert tests, declaration injection, alternate exports, prerequisite
tampering, and path aliases. `PF-027` records the abbreviated-prose Alert tone conflict. Tokens,
controlled sign-in fixtures, final implementation parity, and the immutable package tuple remain
M03-T07 through M03-T10; G03 remains open:
`reference-catalog-web-form-feedback.json`
`sha256:553a48cb95aa2a9e6c2ee4e860aea7aedea92499c977b093c1c515c0ad9d75f2`.

M03-T07 adds the bounded reference-token and synthetic-fixture foundations without changing a
`P-*` status. A strict DTCG 2025.10 subset supplies exactly 26 token paths, CSS custom properties,
resolved Web values, and fallback-bearing CSS references. The independent evidence proves exact
coverage and fallback parity for every current reference-component variable, a real React
host-style application, explicit unknown-token failure, immutable public data, and no Web runtime
import in the built provider. Framework-neutral testkit evidence separately proves canonical
detached fixture projection, required operation errors, operation/resource category separation,
cross-category uniqueness, binding exclusion, factory-only lookups, string-only lookup names, and
the exact 64-level, 20,000-node, and 1,048,576-byte limits. The 19 package tests, 20
compiler-negative cases, and 16 independent mutation tests preserve the exact M03-T06 artifact as
a prerequisite. `N-036` and `N-040` receive only partial local evidence and remain `PLANNED`; the
sign-in fixtures, trusted operation binding, complete parity, and final package tuple remain
M03-T08 through M03-T10, so G03 remains open:
`reference-tokens-and-synthetic-fixtures.json`
`sha256:5510336a4098af065e8e39ffc54b257cc3b0e024aef5967de056f9221025fe0f`.

M03-T08 adds the exact frozen `com.example.auth/signIn` registration and its controlled success
and `invalidCredentials` authoring fixtures, then keeps them separate from one explicit trusted
host-code binding. The inert `operations` subpath exposes no executable value; the opt-in
`host-operations` subpath fixes the capability id and preserves an application-supplied handler by
identity without invoking, wrapping, or globally registering it. Its return remains `unknown`, so
M04 retains ownership of the generic host port, asynchronous settlement, successful-output
validation, public-error sanitization, lifecycle, concurrency, and diagnostics. The evidence
compares the complete registration with the official Catalog, validates the successful fixture
against the declared output schema, proves `invalidCredentials` found and `unavailable` missing,
and rejects a host binding as synthetic fixture data. Three reference-package tests, two testkit
tests, 10 compiler-negative cases, and 14 independent proof/mutation tests cover exact exports,
immutability, handler identity, non-function rejection, subpath separation, source boundaries,
prerequisite drift, deterministic artifacts, and atomic writes. `PF-028` records why `pending` is
runtime lifecycle state rather than a static fixture key. `P-10` advances only to `PARTIAL`;
production-like host execution remains M10-T04. C-018, R-092, and R-100 receive only local partial
evidence, while N-036 and N-040 remain `PLANNED`:
`reference-sign-in-fixtures-and-host-binding.json`
`sha256:b0413687bd907b71509db52d3e22b6eda5a4150509ac323bf51e5f8425f897e2`.

M03-T09 adds complete inert Catalog-to-implementation parity for the exact five-component sign-in
reference slice without presenting it as the complete frozen example Catalog. Every selected
registration equals its official entry, and canonical recursively frozen metadata covers every
declared prop, slot, event, command, style part, visual state, accessibility policy, and trusted
component-side binding. Authoring and production roles resolve to the same real component export
identity under exact `adapterFidelity: "same"`. The delegated sign-in entry records only its fixed
application-supplied binding factory label and public errors; no handler or loader enters metadata.
The cumulative package suite executes 26 tests, 10 compiler-negative cases, and 14 independent
proof/mutation tests. It validates exact TextField/Button event payloads and TextField focus input
against the prepared Catalog schemas, rejects missing/extra/wrong-category surfaces, executable
metadata, public-root leakage, transitive React-barrel selection, validator weakening, trace drift,
and prerequisite drift. `S-004` becomes `TESTED`; `P-06` advances only to `PARTIAL`. `N-030`,
`N-033`, and `N-034` remain `PLANNED` because resolved styling, the generic runtime bridge,
executable registry, Desen App, and separately built host remain later owners:
`reference-catalog-web-parity.json`
`sha256:6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a`.

M03-T10 composes the final distinct `run.desen.reference.sign-in@0.1.0` Catalog for `web-react`
from the already verified five component registrations and delegated sign-in operation. The
generated Catalog contains exactly five components, no behavior, one operation, and no resource.
Its exact package digest is
`sha256:4ebfc6209d4874f3798009c72c634d2f65e60f8b59d4a517f269380a8cec6d9e`.
One compiler-input snapshot drives two isolated clean builds; both match the workspace distribution
byte-for-byte across all 76 files and 224,069 bytes. Six Catalog validation stages, an independent
binary-frame and Node SHA-256 oracle, exact inert package exports, self-reference exclusion, and
236 byte/path/inventory/Catalog mutation vectors and 19 independent root tests pass. This closes
G03 while leaving executable
React registration in M05. `P-05`, `P-06`, and `P-10` remain `PARTIAL`; `N-010` and `N-011`
remain `PLANNED`, while `N-015` remains `TESTED`. M04 was gated by the separately recorded SC-01
DESEN–A2UI and DTCG strategic checkpoint:
`reference-catalog-web-capability-artifact.json`
`sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`.

SC-01 is complete with recommendation `continue`. The proof-only `SC01_STATIC_TEXT_V1` bridge
passes 27 focused tests across 1,029 deterministic positive vectors, 1,029 exact JSON structural
round-trips in each direction, 2,058 A2UI message schema validations, and 34 stable rejection cases:
`sc-01-a2ui-bridge.json`
`sha256:2f927afee4ec50d8191fd2d44db93e35ff89f64856d0ae7bbc4be14193588902`.
The DTCG audit passes 16 focused tests over the 26-token built reference document, 14 unsupported
feature families, 16 exact valid-but-unsupported fixtures, and seven exact negative fixtures:
`sc-01-dtcg-compatibility.json`
`sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`.
These are strategic compatibility receipts, not runtime or renderer conformance evidence; no
`P-*`, `N-*`, or `S-*` status changes.

M04-T01 defines and proves the first framework-neutral runtime integration slice without changing
a `P-*` status. Nine exact ports expose fourteen stable callbacks for navigation, immutable
Bundle/activation storage, operations, resources, tokens, context, environment, clock, and
diagnostics. The factory preserves receiver-independent callback identities without invocation,
rejects missing, extra, inherited, accessor-backed, non-callable, and reflection-hostile shapes,
and freezes only its own snapshots. The task-scoped source, declaration, distribution,
package-entry, and named-root-export inventories contribute one runtime value and thirty types with
complete TSDoc while permitting later task-owned named exports. Ten
focused package tests, nine compiler-negative cases, and ten independent proof/mutation tests
cover platform/global/evaluation exclusions, direct test registration, prerequisite drift,
deterministic artifacts, symlink rejection, and atomic-write substitution across eleven tracked
files. `R-041`, `R-046`, `R-089`, `R-105`, `R-106`, `R-122`, and `D-026` receive only
contract-level evidence: reference resolution, lifecycle, action execution, adapter bridges,
storage behavior, and complete observable traces remain later owners. `N-023` stays `PLANNED`
because a JSON-only non-secret context contract does not classify caller data:
`runtime-core-0.1.0-host-ports.json`
`sha256:5a53cfc9698339a2e9da72c496c1b204e0da138da3d3c1efdc1fe0b5c0e4f190`.

M04-T02 defines and proves the framework-neutral value-resolution primitive without changing a
`P-*`, `N-*`, or `S-*` status. One factory-created immutable snapshot contains the exact `state`,
`context`, `resource`, `operation`, `event`, `item`, and `env` namespaces. Resolution preserves
missing-versus-null and falsy values, applies fallback only to a missing primary reference, treats
arrays atomically, and never evaluates resolved reference-shaped data a second time. Three runtime
exports and seventeen types have complete TSDoc. Thirty-four focused package tests, ten
compiler-negative cases, and thirteen independent proof/mutation tests enforce exact lifecycle
envelopes, RFC 6901 paths, complete outcomes, hostile-input rejection, composed-output budgets,
platform/effect exclusions, nine trace assignments, prerequisite integrity, and atomic writes
across eleven tracked files. Token and format execution remains M04-T03; target-schema and adapter
composition remain M05:
`runtime-core-0.1.0-value-resolution.json`
`sha256:73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea`.

M04-T03 defines and proves the additive token and deterministic string-format materialization
layer without changing a `P-*`, `N-*`, or `S-*` status. Tokens resolve only through an exact
least-authority host context, once per unique name in each top-level call; missing, resolved JSON
`null`, and redacted provider failure remain distinct. The closed PF-017 `{name}` grammar performs
no expression, locale, markup, or platform evaluation. Raw strings remain unchanged and every
other JSON value uses RFC 8785 canonical text. Nested references, fallbacks, tokens, and formats
preserve exact pointers, aggregate fallback use, complete outcomes, and final safety bounds. One
runtime export and four types have complete TSDoc. Seven focused package tests, seven
compiler-negative cases, thirteen independent proof/mutation tests, nineteen behavior/safety
probes, two direct trace assignments, and eleven byte-tracked files enforce the boundary.
Receiving-schema validation remains M05, so `R-048` is only partially implemented and no Proof
Matrix status advances:
`runtime-core-0.1.0-token-format-resolution.json`
`sha256:be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f`.

M04-T04 defines and proves the framework-neutral closed predicate and conditional-presence
primitive without changing a `P-*`, `N-*`, or `S-*` status. Two public runtime functions and ten
types evaluate thirteen exact operators over one factory-branded snapshot; three data-only
composition helpers remain outside the package root. Fifty-three focused package tests, thirteen
compiler-negative cases, and fourteen independent proof/mutation tests preserve depth-first
left-to-right evaluation, no short-circuiting, ordered `PREDICATE_TYPE_MISMATCH` pointers, direct
unresolved versus nested false behavior, RFC 8785 equality, exact UTF-16 order and substring
membership, original-reference `exists` across all seven namespaces, fallback bypass, explicit
token/format deferral, ordered terminal precedence, early aggregate cutoff, true conditional
absence, and the 64-predicate-node bound. Eight direct trace assignments and eleven tracked files
protect the platform-neutral boundary. Variant and materialized-operand composition was assigned
to M04-T05 and is proven in the next entry; reactive absent-subtree lifecycle remains
M04-T15/M04-T16, so P-17 remains `PARTIAL` and no proof gate advances:
`runtime-core-0.1.0-predicate-evaluation.json`
`sha256:14b74cd4f0c35e76edd77858443edf8515b3a60a247afe75131095d5a0c3bcf1`.

M04-T05 defines and proves bounded, fail-closed ordered Variant and style-override evaluation
without closing P-17 or changing any proof gate. One public runtime function and nine public types
apply base prop and style ValueSpecs first, evaluate every Variant predicate in document order over
one immutable snapshot and one turn-scoped token session, and let later matching Variants replace
only exact prop or style-property leaves. Successful results retain matching indexes and exact
winning source pointers; JSON `null` remains a value, omitted paths remain unchanged, and nested
objects or arrays replace as whole ValueSpecs rather than recursively merging. Thirty focused
package tests, twenty-five compiler-negative cases, and fourteen root proof/mutation tests,
including thirteen artifact-independent mutation checks, enforce the ordered semantics, hostile
input boundaries, terminal precedence, immutable detached outcomes, public API, platform
neutrality, prerequisite integrity, two direct trace assignments, and eleven tracked files. M04-T13
now covers action-turn limits; final selected-value materialization, receiving-schema validation,
Bundle ingress, adapter behavior, and activation limits remain later work, so P-17 stays `PARTIAL`:
`runtime-core-0.1.0-variant-style-evaluation.json`
`sha256:46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e`.

M04-T06 defines and proves a bounded, fail-closed surface-local state lifecycle and repeat-free
base node identity without closing P-17 or changing any proof gate. Six public runtime functions
and twenty runtime types mount every declaration atomically from fresh initials, expose complete
immutable generation snapshots behind opaque handles, validate every accepted complete post-write
entry in `complete` and `resolved-value` mode, preserve the exact current snapshot after rejection
or canonical no-op, and dispose live authority terminally. Draft 2020-12 meta-schema checks,
fail-closed vocabulary handling, bounded schema-graph interpretation, a structured
document/surface/node identity tuple, and an equivalent linear capability-ID parser prevent
unsupported semantics or hostile data from being guessed. Thirty-three focused package tests,
seven compiler-negative cases, and thirteen root proof/mutation tests enforce atomicity,
generation behavior, `PF-019`, disposal, preservation/remount/replacement eligibility, public API,
platform neutrality, prerequisite integrity, four direct trace assignments, and twenty-three
task-owned tracked files. Repeat instance identity, actions, reactivity, final materialization, Bundle
ingress, adapter behavior, and activation limits remain later work, so P-17 stays `PARTIAL`:
`runtime-core-0.1.0-local-state-identity.json`
`sha256:4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13`.

M04-T07 defines and proves lexical repeat scopes, bounded atomic materialization, and repeated
node identity without closing P-17 or changing any proof gate. Six public runtime functions and
sixteen public types evaluate `items` before activating the declaration's alias, isolate every item
scope, preserve outer aliases without active shadowing, and retain source-array order. Keys are
strings or finite numbers with type-sensitive RFC 8785 identity; missing, malformed, duplicate,
hostile, or over-budget keys reject the complete repeated subtree without partial output.
The exact 1,000-instance Reference Profile ceiling rejects overflow rather than truncating.
Repeated identities compose the complete outer-to-inner key path onto the stable
document/surface/node tuple, preserving reorder-stable instances and distinguishing replacement
from capability remount. Thirty-four focused package tests, seven compiler-negative cases, and
fifteen root proof/mutation tests enforce the semantics, public API, platform neutrality,
prerequisite integrity, seven direct trace assignments, and eleven task-owned tracked files.
N-014 and N-041 gain executable repeat evidence but remain `PLANNED` for their other owners; P-17
stays `PARTIAL`:
`runtime-core-0.1.0-repeat-materialization.json`
`sha256:45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d`.

M04-T08 defines and proves a bounded surface-local resource lifecycle without closing P-17 or
changing any proof gate. Six public runtime functions and twenty-two public types atomically mount
idle declarations, start `mount` and `once` policies from one pre-start snapshot, keep `manual`
idle until refresh, and materialize one complete named input through M04-T03 before exact Catalog
schema validation. The exact current manager-issued snapshot rejects stale, foreign, and
structurally ABA-equal refresh views. Valid refresh is latest-wins; stale or disposed settlements
are rejected before hostile envelopes are inspected. Output and declared public errors are
validated and detached while denial, malformed envelopes, exceptions, and undeclared codes remain
redacted technical outcomes. Terminal snapshot capacity is reserved before pending publication,
at most 64 host transports run concurrently, and a bounded queue replaces obsolete queued attempts
for the same instance. Fifty-two focused package tests, nine compiler-negative cases, and
twenty-three root proof/mutation tests enforce these semantics, public API, portability, ten direct
trace assignments, and eleven task-owned files. M04-T09 and M04-T13 now cover operation and action
turns; full cross-manager provenance, final materialization, Bundle ingress, adapters, and
activation remain later work. N-041 stays `PLANNED` and P-17 stays `PARTIAL`:
`runtime-core-0.1.0-resource-lifecycle.json`
`sha256:2d6ab2e5b6a480e922425faa109e13cc5d388a5de00b2604cbfec62345b01c82`.

M04-T09 defines and proves a bounded surface-local operation lifecycle without closing P-17 or
changing any proof gate. Six public runtime exports and twenty-two public types atomically mount
the validated alias inventory, keep the Catalog as sole capability authority, validate the
action's operation identifier as a non-selecting assertion, and detach exact input/output
contracts. Accepted identities are deterministic; omitted concurrency defaults to `reject`;
replacement validates before newest-wins supersession; and queue mode preserves FIFO order under
surface-global retention and active-transport ceilings. Terminal lifecycle publication precedes
an opaque manager-bound acknowledgement lease. A same-alias settlement-handler invocation may
become visibly staged pending, but no staged or queued host transport starts before the predecessor
turn acknowledges. Thirty-six focused package tests, ten compiler-negative cases, and nineteen
root proof/mutation tests enforce these semantics, exact diagnostics, hostile-envelope
containment, public API, portability, fourteen direct trace assignments, and eleven task-owned
files. Action execution, complete turn provenance, final materialization, Bundle ingress,
adapters, and activation remain later work; N-041 stays `PLANNED` and P-17 stays `PARTIAL`:
`runtime-core-0.1.0-operation-lifecycle.json`
`sha256:7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301`.

M04-T10 defines and proves one guard-first state/navigation action primitive without closing P-17
or changing any proof gate. Four package-root runtime exports and eighteen package-root types bind
an exact M04-T06 state lifetime to a trusted complete same-Bundle surface inventory, evaluate
`when` before type-specific payload observation, and share one bounded detached token session
across a true guard and its payload. One internal runtime export and one internal type provide a
callback-free exact-current authority read without widening the package root. State set/toggle
delegate complete schema-safe writes to M04-T06; toggle accepts only an exact boolean. Navigation
authorizes the local target before parameters, emits exact `ENTRY_NOT_FOUND`, `NAVIGATION_DENIED`,
and redacted `ADAPTER_FAILURE` outcomes, and terminally disposes the old executor and local state
on success, including same-surface success. Every hostile reflection and callback boundary rechecks
both lifetime and exact state authority. Forty-four focused package tests, fourteen
compiler-negative cases, and twenty root proof/mutation tests enforce these semantics, API
containment, portability, five direct trace assignments, and sixteen task-owned files. M04-T11
through M04-T13 now compose settlement dispatch and multi-action turns; component/event bridges,
reactivity, complete cross-manager provenance, Bundle ingress, adapters, and activation remain
later work. N-041 stays `PLANNED` and P-17 stays `PARTIAL`:
`runtime-core-0.1.0-state-navigation-actions.json`
`sha256:f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140`.

M04-T11 defines and proves guarded operation/resource action composition without closing P-17 or
changing any proof gate. Four package-root runtime exports and sixteen package-root types bind exact
current M04-T08 and M04-T09 authorities, authorize aliases and resource instances before
materialization, share one bounded token session across a true operation guard and input, and
preserve an independent M04-T08 session for current resource input. Two internal runtime exports
and three internal types provide the callback-free current compositor read and one-shot settlement
finalizer. Settlement branches are detached at acceptance and retained behind finite pending,
action-count, and handler-string ceilings. Started, queued, staged, and refreshed effects remain
nonblocking. Terminal operation outcomes select immutable success or failure work while a private
raw lease remains hidden behind one opaque ticket; mapping alone does not release cumulative
capacity or promote queued work. Eighty-nine focused package tests, twenty-six compiler-negative
cases, and twenty root proof/mutation tests enforce these semantics, exact manager snapshots,
direct lower-handle drift, terminal ownership, disposal, public/internal API separation,
portability, two direct trace assignments, and eleven task-owned files. M04-T13 now proves ordered
handler execution and `finally` finalization, while M04-T16 owns full cross-manager joint-origin
provenance; N-041 stays `PLANNED` and P-17 stays `PARTIAL`:
`runtime-core-0.1.0-operation-resource-actions.json`
`sha256:b955cc9f3399d2dbb1895036828c6ab01dbd78ac198c3be5824720f2802295a7`.

M04-T12 defines and proves guarded component-command and outbound host-event actions without
closing P-17 or changing a proof gate. Eight package-root runtime exports and twenty-six
package-root types add a receiver-independent synchronous bridge and callback-free exact-current
registry read without changing M04-T01's frozen ports; seven runtime exports and three types remain
internal composition helpers. The root-hidden adapter seams return the exact manager Catalog,
command/event ports, and registry snapshot, authenticate the exact captured component-command
callback, and bind each normalized request to its exact port owner in a private one-shot `WeakMap`.
Direct, replayed, foreign-port, and post-callback requests fail closed. The prepared Catalog remains
the sole command authority; static target, declared command, and exactly one live runtime instance
are selected before input observation. Multiple repeated instances are retained but never guessed.
Exact resolved command input validates before dispatch, while allowlisted host events select an
application contract and validate detached payload before emission. False guards observe no action
payload or callback, and true guards share one bounded token session with command input or event
payload.

Finite component, event, identifier, registration, request, and snapshot ceilings include reserved
unregister capacity and the reachable 5,000-static-component boundary. Separate descriptor capture
removes a second bridge-envelope tax: the exact existing 4,096-node M04-T02 aggregate boundary
(4,086 visible payload properties in the tested object) crosses command and event ports, while one
additional node is rejected before any callback. Fifty-eight focused package tests, twenty-seven
compiler-negative cases, and twenty-one root proof/mutation tests enforce these semantics, six
direct trace assignments, API containment, portability, callback reentry, disposal, and sixteen
task-owned byte paths. N-031 advances to `TESTED`; N-034 remains `PLANNED` until concrete
production adapters prove complete declared-command implementation parity. M04-T13 now proves
ordered multi-action turns; incoming adapter events, full cross-manager provenance, Bundle ingress,
activation, and final finite-limit evidence remain later work. P-17 stays `PARTIAL`:
`runtime-core-0.1.0-command-event-actions.json`
`sha256:8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4`.

M04-T13 defines and proves bounded, deterministic action-turn composition without closing P-17 or
changing a proof gate. Five package-root runtime exports and sixteen package-root types prepare
hostile arrays into detached, immutable, factory-authenticated programs; retain action-family
routes only in private authority; and claim the exact current M04-T10–M04-T12 child executors under
one exclusive surface-local coordinator. Started event turns, reentrant admissions, and
asynchronous operation settlements share a finite FIFO. Every slot refreshes the four current
manager snapshots, delegates at most once, preserves action order and fixed lexical event context,
and stops before later observation on controlled failure or successful navigation.

Settlement work retains its captured ancestry, runs with `event` unavailable, and crosses exactly
one ticket-keyed finalization attempt from a `finally` path. Admission reserves a native
fulfillment-only Promise and immutable emergency completion; operation/resource fulfillment,
rejection, returned-Promise, attachment, drain, and lower-finalizer throws remain contained. The
64th action, 16th settlement level, and 64th synchronous transition are accepted; the next boundary
emits exactly one `ACTION_LIMIT_EXCEEDED` diagnostic without retry or silent truncation. Queue,
retained-action, retained-code-unit, and safe-integer generation ceilings are finite and may only
be lowered. Forty-three focused package tests, eleven compiler-negative cases, and thirty-two root
proof/mutation tests enforce these semantics, five direct trace assignments, public API and TSDoc
parity, portability, hostile reflection and callback containment, disposal, and eleven task-owned
files.
N-032 advances to `TESTED`; N-014 and N-041 remain `PLANNED` for their other owners, while incoming
adapter events, reactive composition, full joint provenance, Bundle ingress, activation, and final
finite-limit evidence remain later work. P-17 stays `PARTIAL`:
`runtime-core-0.1.0-action-turns.json`
`sha256:5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87`.

M04-T14 defines and proves the generic component/behavior adapter boundary without changing a
proof gate. Eight package-root runtime exports and twenty-seven types create a bridge before
M04-T12, bind it afterward only to the exact current Catalog, registry snapshot, port owner, and
callback owner, and register platform-free component or behavior instances under opaque
generation tickets. The root-hidden M04-T12 normalized-command marker is exact-owner and one-shot,
so direct, replayed, foreign-port, stale, and post-callback requests fail closed while an adapter
receives only the declared command and detached input.

Incoming event admission proves the exact bridge snapshot, ticket generation, behavior owner,
current M04-T12 authority, and Catalog event declaration before payload observation. It validates
the detached payload once against the exact selector, rechecks every authority afterward, and
passes only an inert handler selector, identity, validated JSON, and detached item/repeat keys to
the later event-turn sink. Behavior `attachTo`, factory repeat identity, scope sharing, aggregate
retention, future-unregister snapshot reservation, hostile reentry, newer same-origin lower
cleanup, revocation, ticket tombstones, and terminal disposal are finite and executable.

Twenty-eight focused package tests, eleven compiler-negative cases, and twenty-one root proof/mutation
tests enforce these semantics, four direct trace assignments, all thirty-five documented public
declarations, eleven task-owned files, deterministic evidence, zero request leaks, and zero
platform effects. N-033 advances to `TESTED`; N-034 remains `PLANNED` for production adapter
parity. M04-T15 still owns reactive stale-result protection and M04-T16 owns the selector-to-action
join, full joint provenance, and deterministic sign-in trace. P-17 stays `PARTIAL`:
`runtime-core-0.1.0-adapter-bridges.json`
`sha256:bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7`.

M04-T15 defines and proves one platform-neutral reactive publication boundary without changing a
proof-gate status. A branded host aggregate natively adopts resource and operation settlements,
reduces them to exact detached envelopes, redacts every thrown or rejected reason, and completes
hostile Proxy reflection before a lifecycle manager can observe the result. Existing lower-manager
attempt identities then reject an older settlement when reflection reentry has already started a
newer one.

The whole-surface coordinator authenticates exact state/resource/operation generations plus
complete context/environment snapshots, creates all seven value namespaces, grants the evaluator
only token materialization authority, and rechecks the complete authority before and after hostile
output reflection. Explicit action-turn invalidation and host notices coalesce through one bounded
synchronous dirty-bit drain. Equal output bytes retain the exact snapshot; current invalid output
becomes inactive; generations never wrap; revoked Proxy inputs fail controlled; and failed mount
or disposal clears the retained authority graph before host cleanup.

Fifty-four focused package tests from thirty-nine registrations, eleven compiler-negative cases,
and thirty root proof/mutation tests enforce these semantics, six direct trace assignments, all
twenty-four documented module declarations, seventeen task-owned files, ten exact prerequisite
artifacts, zero authority/request/platform leaks, and a cumulative 605/605 runtime-core suite.
At the T15 boundary, P-17 and P-18 remained `PARTIAL`, while N-003, N-034, and N-041 remained
`PLANNED`. M04-T16 now proves the authenticated same-wrapper composition, selector-to-program join,
full materialization, descendant inactivity, whole-surface observable reference oracle,
coordinated disposal, and JSON sign-in trace; dependency-index equivalence remains M12-T05:
`runtime-core-0.1.0-reactive-reevaluation.json`
`sha256:7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67`.

## M04-T16 / G04

M04-T16 closes the framework-neutral G04 sign-in profile without introducing React, DOM, CSS,
browser, or application dependencies. The materializer traverses one execution-validated immutable
surface, evaluates repeat and conditional presence before descendants become active, resolves
tokens and deterministic formats through one attempt-local cache, preserves stable repeated
identity, and emits one deeply immutable JSON-only plan. Exact plan and binding projections receive
separate SHA-256 commitments, while event selectors, action programs, and repeat scopes remain
behind an evaluation-bound private sidecar.

The session validates unknown Bundle and Catalog ingress, verifies the exact Bundle revision, and
composes M04-T06 through M04-T15 over one authenticated host aggregate. Complete desired component
and behavior bindings reconcile atomically; stale candidates, partial registry mutations,
generation exhaustion, hostile reflection, repeated-scope replacement, back-to-back events, and
reentrant disposal fail closed. Current events join an exact T14 binding to one preprepared T13
program and all seven value namespaces. The frozen sign-in profile proves state input, pending
operation lifecycle, declared failure, retry, newest-wins stale settlement fencing, atomic
successful settlement-to-home handoff, and coordinated terminal cleanup.

Thirty-four focused tests, eleven compiler-negative cases, twenty-four root proof/mutation tests,
and the cumulative 639-test runtime-core suite protect the implementation boundary.
Success/navigation, failure/retry, and stale-replacement scenarios each run in two independent
sessions, for six sessions total. Every callback-free scenario pair and the combined six-session
trace survive exact JSON round trips and produce byte-identical RFC 8785 canonical bytes and
SHA-256 commitments. The frozen 72-record M02 assignment baseline remains byte-exact; PF-047
classifies five broader future rules and pins the 67 records applicable at this gate.

This advances N-003 to `TESTED` and closes M04-T16/G04. P-17 remains `PARTIAL` for concrete
production-adapter and activation limits. P-18 remains `PARTIAL` because the independent M08-T10
editor-core artifact and React/DOM boundary are not yet proven. Dependency-index equivalence and
performance remain M12-T05; concrete resolved-prop validation, framework instance preservation,
DOM/CSS/accessibility/focus behavior, and production Web–React parity remain M05:
`runtime-core-0.1.0-headless-sign-in.json`
`sha256:bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4`.

## M04-T17 / G04 audit hardening

M04-T17 recloses G04 after proving the five post-audit boundaries that the exact sign-in profile
did not establish generically. Every accepted T13 operation or resource settlement now reserves
one finite FIFO publication before execution and emits exactly one package-internal completion
notice after finalization. The factory-authenticated headless session consumes that notice through
the existing T15 invalidation path, so nested operation and resource completion publishes the
current snapshot without recognizing a sign-in operation or directly observing an
application-specific promise. Same-tick settlements retain their observed order, while public
snapshot notifications may still coalesce.

The public session subscription is factory-authenticated, finite, asynchronously delivered,
idempotently revocable, callback-failure contained, and terminally disposed. Generic nested
success and declared failure, replacement and stale results, listener reentry, duplicate or late
notification, registration rollback, resource publication failure, finalization, disposal,
generation exhaustion, and listener retention limits are deterministic test boundaries. The
focused audit inventory passes 77 cases from 69 registrations, including 14 negative cases, and
the cumulative runtime-core suite passes 649/649.

Exact-location proof parsing binds task and gate status, PF-049, N-026/N-028/N-029, artifact pins,
and owner cells to unique reviewed sections and rows. N-026 and N-029 correctly remain `PLANNED`
for M05-T02 and M05-T03 receiving-boundary evidence. M02-T08 and M04-T13 through M04-T16 historical
artifacts remain byte-identical; M04-T17 transfers only their current compatibility
verifier-and-hostile-test ownership. The frozen DESEN 0.1.0 protocol bytes are unchanged:
`docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json`
`sha256:cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa`.

## M05-T01

M05-T01 establishes the first Web–React adapter boundary without changing G04 or a protocol proof
status. A factory-authenticated static registry retains only exact trusted component and behavior
implementations while its public snapshot exposes sorted capability identifiers and no callback.
The standalone renderer applies the same lookup to roots, descendants, and behaviors, and
preflights the complete structural public plan before React executes an adapter.

The preflight rejects malformed own-data boundaries, revoked proxies, unknown capabilities,
duplicate runtime identities, forged registry handles, non-linear identifier inputs, and lower-only
node, depth, slot, behavior, JSON-depth, JSON-occurrence, retained-string, and registry limits.
Every adapter JSON input is detached and deeply frozen; slot names including `status` remain data
rather than control flow. Declared behavior order is deterministic, no placeholder tree is
created, and the command seam reserves an opaque attachment identity with controlled detachment
instead of exposing a raw callback.

Ten focused package tests, four compiler-negative cases, and eleven hostile root
proof/mutation tests protect the implementation and its deterministic 25-file artifact. The
standalone compiler authenticates registry authority but deliberately does not claim the
provenance of an otherwise valid structural plan. M05-T02/M05-T04 add exact Catalog/session
authority, and M05-T09 audits the independent production host path. N-026 and N-029 remain
`PLANNED`; no P-claim or proof gate changes:
`runtime-react-0.1.0-adapter-registry.json`
`sha256:b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42`.

## M05-T02

M05-T02 binds the Web–React renderer to one exact live headless-session snapshot and the exact
execution Catalog set retained by that session. A copied or stale snapshot, structurally equal or
lower-stage Catalog value, forged handle, disposed generation, hostile input envelope, or
reentrant disposal during limit reflection fails before an adapter executes. The renderer no
longer accepts a raw plan.

Every final component and behavior prop map is detached and validated in complete resolved-value
mode against its exact prepared receiving schema. Final named slots are projected only as slot
names plus child component capability identifiers, then checked for required presence,
effective minimum and maximum cardinality, exact-id/category acceptance, explicit reject-all
unions, and unknown capabilities. One factory-authenticated scope shares monotonically consumed
prop, slot, detached-JSON, retained-string, and schema-evaluation budgets across the complete
render. Successful adapter inputs are recursively immutable; any deep failure returns exact
identity-linked diagnostics and creates no React element.

Components receive no raw behavior plan, session, Catalog, DOM/native object, or React-private
structure. The successor artifact also authenticates the unchanged M02-T06 through M02-T13 and
M04-T06, M04-T16, M04-T17, and M05-T01 task-time artifacts while explicitly owning the
compatibility verifier paths changed by the current validator, session, and renderer. Successful
raw-Catalog mount returns the exact retained validated Catalog authority outside the JSON-only
snapshot. Actual schema comparison/loop work and precomputed slot-contract evaluation now consume
shared lower-only budgets. Fifty-seven focused schema/receiving tests, twelve focused React
receiving tests, the cumulative 406-test validator, 655-test runtime-core, and 22-test runtime-react
suites, compiler-negative cases, hostile root mutations, exact boundary fixtures, and
deterministic 109-file artifact rebuilding protect the claim.

N-026 advances to `TESTED`. N-027 and N-042 remain `PLANNED` for publisher/editor composition;
N-029 remains `PLANNED` for M05-T03 style delivery. No P-claim or proof gate changes:
`runtime-react-0.1.0-resolved-props-slots.json`
`sha256:f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0`.

## M05-T03

M05-T03 validates every final component and behavior style map through the same exact
Catalog-authenticated receiving scope used by M05-T02 before any React element is created. The
public successful value preserves the readonly visual-state → semantic-part → property → resolved
JSON hierarchy. Component and behavior failures use distinct stable codes and the `style`
receiving channel while preserving exact immutable validator diagnostics.

Declared visual states and prepared style-part schemas are cached once with the authenticated
execution Catalog. Style validation, detached JSON, retained strings, and schema evaluation share
render-wide lower-only budgets. A deep mismatch or budget crossing executes no adapter and returns
no partial tree.

The renderer delivers the complete immutable map but never selects or merges a state, interprets a
property, creates CSS, or inspects DOM/native/React-private structure. State activation and target
translation remain inside the statically trusted capability adapter. N-029 becomes `TESTED`;
N-030 remains `PLANNED`, and no P-claim or proof gate changes.

The M02-T08, M04-T05, and M05-T02 artifacts remain byte-identical prerequisites. M05-T03 owns the
strict M05-T02 compatibility-reader migration plus current renderer, validator, focused test,
documentation, package, CI, and proof paths.

`runtime-react-0.1.0-resolved-styles.json`
`sha256:2b0e03e58116d161484cd3c309370ff1ee5003ee6158d4e941749faf0d6797eb`.
