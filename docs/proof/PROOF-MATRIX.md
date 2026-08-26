# Proof Matrix

Status values: `NOT_PROVEN`, `PARTIAL`, `PROVEN`, `FAILED`, `OUT_OF_SCOPE`.

The exact implementation target is `web-react`. `PARTIAL` means preliminary evidence exists but
the complete claim is not established. A visual demonstration alone cannot change a claim to
`PROVEN`. Evidence paths and hashes are populated by the owner task and reverified at G12.

| ID   | Claim                                                                                             | Owner task(s)                               | Current status | Current evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Required final evidence                                                                                               | Artifact / hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Last verified |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| P-01 | The implementation consumes exact, immutable DESEN 0.1.0 bytes                                    | M02-T01                                     | PROVEN         | Complete 31-file upstream Git tree is vendored; pinned manifest, inventory, bytes, aggregate, modes, and drift tests pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Vendored-byte checksum test against exact upstream commit                                                             | `protocol-0.1.0-snapshot.json` `sha256:aaf58f79bc95924fbaa0c2b278cc06f3d28b3986e5d168b5468e6432c04cd5a9`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-07-21    |
| P-02 | Official valid/negative cases and examples produce expected results                               | M02-T12, M02-T13                            | PROVEN         | Python and built TypeScript pass the exact 14-case starter suite; 34 positive/negative diagnostic pairs pass the complete declared validator scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Fulfilled: official parity plus one positive and one exact negative vector for every validator-emitted diagnostic     | `protocol-0.1.0-validation.txt` `sha256:d2c5e7e27a5a1f5ecc66f3aad4956451c81b420a60908be5c948071a7305aa86`; `protocol-0.1.0-checksums.txt` `sha256:6208ed37fa4da3b816e505c106be1801fcee504e1dde2ab4a4e4ceb5b0ca166f`; `protocol-0.1.0-official-suite-parity.json` `sha256:efa6b4ed014b942d45d621ffc77c47e76d82dd6965deb13cf677c6bebf7a76ae`; `protocol-0.1.0-validator-diagnostic-micro-vectors.json` `sha256:3214a26a683d46a3b20c6ca400de44faa2c5e394f706a6e3e8d3d3628da78718`                                                                                                                                                                             | 2026-07-23    |
| P-03 | Publication is deterministic                                                                      | M06-T10                                     | PROVEN         | Two independently parsed official Sources and two independently cloned Catalog-package candidates cross only the public `publishDesenSource` root. They produce identity-disjoint immutable results with the same 2,173 RFC 8785 canonical UTF-8 Bundle bytes, revision, and Source digest; both byte sequences equal the frozen official Bundle after removing exactly its own root `publication` member.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Fulfilled: two fresh public publications are byte-identical to each other and the frozen official projection.         | `publisher-0.1.0-official-golden.json` `sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 2026-07-29    |
| P-04 | Source and bundle documents are inert data and cannot select executable code                      | M02-T06, M12-T03                            | PARTIAL        | M02-T06 returns detached deep-frozen snapshots; ahead-of-time validators and source/distribution audits reject runtime code loading and network access                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Exhaustive executable-content forms, markup interpretation, and remote code-selection proof under M12-T03             | `protocol-0.1.0-structural-validation.json` `sha256:7e7662e6b20e29452f8c5092e37d2fefe1a416e787816693543b0c2c1a2e6536`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-07-23    |
| P-05 | Capabilities are pinned by exact id/version/target/digest                                         | M03-T04, M03-T10, M05-T04, M06-T08, M07-T03 | PROVEN         | M03-T10 preserves the historical `run.desen.reference.sign-in@0.1.0` Web–React tuple over its exact 76-file distribution; M05-T04 independently pins the current 80-file successor plus projected Catalog after adding the executable `./react-adapters` subpath; M06-T08 authenticates the carried Source digest and positionally replaces every loose requirement with the exact selected package tuple without location, best-match, sorting, or deduplication authority; M07-T03 authenticates the M07-T02 Bundle authority, resolves each literal id/exact version/literal target tuple to exactly one installed candidate, snapshots the selected Catalog and 80 actual artifacts, and independently reproduces the required digest while missing, duplicate, substituted, stale, or mutated material yields no package authority                                                                                                                                                                                                                                                                                                                                                                             | —                                                                                                                     | `reference-catalog-web-package-digest-v1.json` `sha256:e56c74696e8aa68c1d3ab71ac3ae087ed8c5df05f4a19b9a6d310da8758b0716`; `reference-catalog-web-capability-artifact.json` `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`; `runtime-react-0.1.0-interactions.json` `sha256:9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0`; `publisher-0.1.0-catalog-pinning.json` `sha256:de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f`; `control-plane-api-0.1.0-package-preflight.json` `sha256:79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628`                                      | 2026-08-03    |
| P-06 | Desen App and the production-like host use the same real components                               | M03-T09, M05-T04, M05-T08, M09-T03          | PARTIAL        | M03-T09 preserves the historical five-export logical parity record; M05-T04 adds the current package's exact static five-component React registry and concrete command/event wiring; M05-T08 runs the controlled official-derived Bundle in the independent host through that public registry and all five real components. M05-T09 proves the actual Vite graph reaches that same public adapter factory without a host-local replacement. Desen App registry identity remains M09-T03.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Desen App registry identity and host-versus-App comparison evidence                                                   | `reference-catalog-web-parity.json` `sha256:6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a`; `reference-catalog-web-capability-artifact.json` `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`; `runtime-react-0.1.0-interactions.json` `sha256:9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0`; `reference-host-web-0.1.0-sign-in.json` `sha256:a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb`; `reference-host-web-0.1.0-source-audit.json` `sha256:cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89`                                                    | 2026-07-28    |
| P-07 | Managed surfaces have no handwritten host component tree                                          | M05-T09, M10-T05                            | PARTIAL        | M05-T09 discovers the complete independent-host production source inventory, resolves JSX and aliases through the TypeScript checker, and observes the real Vite production graph. Exact host-infrastructure JSX is allowlisted; the managed path reaches only the public generic runtime renderer and shared public adapter factory. Direct, aliased, namespace, helper-hidden, factory-created, plan-shaped, dynamically loaded, orphaned, and forbidden-data alternatives fail closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | M10-T05 must add Desen App host E2E and its corresponding source/import audit before the broader claim is `PROVEN`.   | `reference-host-web-0.1.0-source-audit.json` `sha256:cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2026-07-28    |
| P-08 | A designer edits props, slots, state, bindings, and actions visually                              | M09-T05–M09-T09, M10-T01                    | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Desen App browser E2E from an empty project                                                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —             |
| P-09 | Run Mode executes events, state, and operation lifecycle                                          | M09-T10, M10-T02–M10-T04                    | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Pending/success/failure observable trace and UI tests                                                                 | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —             |
| P-10 | Real host operations remain outside design documents                                              | M03-T08, M05-T08–M05-T09, M10-T04           | PARTIAL        | Exact fixtures and the final Catalog remain inert data; the exact package surface exposes no loader while application code retains the executable binding. M05-T08 executes the official-derived Bundle through a fixed same-origin host operation whose capability, alias, effect, input shape, response budget, and navigation policy are outside the Bundle and fail closed. M05-T09 proves that the real resolved host graph cannot replace that boundary with document-selected code or a handwritten managed tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Desen App Run Mode operation execution                                                                                | `reference-sign-in-fixtures-and-host-binding.json` `sha256:b0413687bd907b71509db52d3e22b6eda5a4150509ac323bf51e5f8425f897e2`; `reference-catalog-web-capability-artifact.json` `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`; `reference-host-web-0.1.0-sign-in.json` `sha256:a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb`; `reference-host-web-0.1.0-source-audit.json` `sha256:cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89`                                                                                                                                                        | 2026-07-28    |
| P-11 | Authoring-only state does not enter production bundles                                            | M06-T07–M06-T10                             | PROVEN         | M06-T07 calculates the exact authenticated Source digest with only root `authoring` excluded and removes that member from the production base. M06-T08 independently authenticates and carries the digest; M06-T09 validates and revision-closes the complete authoring-free Bundle. M06-T10 publishes two fresh official inputs through the public root, proves root-authoring changes leave the exact Source digest and terminal Bundle unchanged, proves neither output contains root `authoring`, and matches both outputs to the frozen official Bundle after removing only root `publication`; nested semantic content is not projected away.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Fulfilled: the complete public publication golden proves root authoring never enters production Bundle bytes.         | `publisher-0.1.0-source-normalization.json` `sha256:59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e`; `publisher-0.1.0-catalog-pinning.json` `sha256:de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f`; `publisher-0.1.0-bundle-publication.json` `sha256:2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df`; `publisher-0.1.0-official-golden.json` `sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`                                                                                                                                                                             | 2026-07-29    |
| P-12 | Invalid activation preserves last-known-good across restart                                       | M07-T07–M07-T11, M10-T07                    | NOT_PROVEN     | M07-T07 commits active, previous-good, and generation as one atomic record. M07-T08 reconstructs runtime authority only after both durable roles pass fresh authentication and complete-Bundle reclosure. M07-T09/T10 prove the closed precommit-fault, valid A → invalid B → valid C, concurrency, recovery, and restart matrices. M07-T11 proves that a separately built local Web host treats the mutable channel only as discovery, reruns the complete public activation chain, preserves mounted A when B fails, delivers C only after commit, and reauthenticates the durable winner before post-restart delivery. Invalid B never becomes memory, durable, server-delivery, or browser-mount authority. The application-owned local roots remain trusted; no hostile-admin mutation resistance, tamper-proof, anti-rollback, remote, native, or product-restart claim is made.                                                                                                                                                                                                                                                                                                                              | M10-T07 must prove Desen App product-level restart preservation.                                                      | `control-plane-api-0.1.0-runtime-activation.json` `sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`; `control-plane-api-0.1.0-runtime-recovery.json` `sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`; `control-plane-api-0.1.0-runtime-fault-injection.json` `sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`; `control-plane-api-0.1.0-runtime-transition-races.json` `sha256:f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39`; `reference-host-web-0.1.0-channel-consumption.json` `sha256:48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0` | 2026-08-12    |
| P-13 | Map integrates without changing runtime-core                                                      | M10-T09, M11-T06–M11-T07                    | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Map E2E and runtime-core tree hash equal to frozen G10 baseline                                                       | Future `docs/proof/artifacts/runtime-core-baseline.json` and Map comparison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —             |
| P-14 | Sortable behavior integrates without changing runtime-core                                        | M10-T09, M11-T12                            | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Reorder E2E and runtime-core tree hash equal to frozen G10 baseline                                                   | Future `docs/proof/artifacts/runtime-core-baseline.json` and Sortable comparison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —             |
| P-15 | Existing complex capabilities build a second surface without screen code                          | M11-T13                                     | NOT_PROVEN     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Desen App runbook, published source/bundle, and host source audit                                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —             |
| P-16 | Runtime diagnostics trace to stable source-node identity                                          | M05-T05, M09-T13                            | PARTIAL        | M05-T05 adds a bounded, deeply frozen, callback-free forward and one-to-many inverse identity index after exact renderer binding parity; repeated component and behavior instances remain traceable to their authoring source nodes across live publications                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | M09-T13 must prove end-to-end diagnostic selection in Desen App                                                       | `runtime-react-0.1.0-reconciliation-diagnostics.json` `sha256:292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 2026-07-28    |
| P-17 | Runtime bounds execution and never guesses unknown semantics                                      | M02-T13, M04-T13–M04-T17, M05-T06, M07-T04  | PROVEN         | Validator micro-vectors cover unknown and unsupported semantics; M04-T02–M04-T15 prove bounded fail-closed resolution, lifecycle, action, adapter-bridge, and reactive behavior; M04-T16 adds validated Bundle/Catalog ingress, exact revision verification, complete conditional/repeat materialization, plan and binding commitments, atomic binding reconciliation, coherent tree/binding/handler/trace ceilings, and terminal session disposal; M04-T17 adds generic operation/resource settlement notification, factory-authenticated bounded snapshot subscriptions, exact migration-ledger proof, and deterministic rollback/publication fault containment; M05-T06 proves finite all-or-nothing React capability preflight, no placeholder guessing, redacted whole-surface adapter containment, honest null attribution where React cannot expose origin, explicit retry authority, and host/managed failure provenance; M07-T04 authenticates the exact M07-T03 package authority, closes every surface, capability, event, command, and action target without placeholder or best-match guessing, and rejects every whole-activation finite-profile overflow before returning opaque preflight authority | Fulfilled: authenticated whole-activation reference closure and exact finite-limit vectors.                           | Prior M02–M04 artifacts listed below; `runtime-core-0.1.0-headless-sign-in.json` (M04-T16 initial G04 sign-in evidence); `runtime-core-0.1.0-audit-hardening.json` (M04-T17/G04 final audit evidence); `runtime-react-0.1.0-failure-boundary.json` `sha256:3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723`; `control-plane-api-0.1.0-reference-preflight.json` `sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`                                                                                                                                                                                                 | 2026-08-05    |
| P-18 | Platform-neutral packages contain no React/Web dependencies and core traces are JSON-serializable | M01-T05, M04-T16–M04-T17, M08-T10           | PARTIAL        | Dependency rules and six boundary fixtures pass. M04-T16 source and distribution audits contain no React, DOM, CSS, browser, or application imports. Success/navigation, failure/retry, and stale-replacement scenarios each run in two independent sessions; every callback-free JSON pair and the combined six-session trace pass exact JSON round-trip, RFC 8785 canonicalization, and SHA-256 equality. M04-T17 re-audits the complete runtime source boundary after adding the generic settlement and public session-subscription APIs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | M08-T10 must still prove the independent editor-core artifact and React/DOM boundary before P-18 can become `PROVEN`. | `tracked-foundation.json` `sha256:5c430da7e221dc37c9bdd4ca1c423f1a84d0aabe22cfe4465e40b67fa7d1529c`; `runtime-core-0.1.0-headless-sign-in.json` (M04-T16 initial G04 sign-in evidence); `runtime-core-0.1.0-audit-hardening.json` (M04-T17/G04 final audit evidence)                                                                                                                                                                                                                                                                                                                                                                                       | 2026-07-27    |

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
The DTCG audit passes 20 focused tests that preserve the immutable task-time receipt and cover its
26-token built reference document, 14 unsupported feature families, 16 exact
valid-but-unsupported fixtures, seven exact negative fixtures, proof-pin integrity, hostile inputs,
symlinks, and atomic-copy safety:
`sc-01-dtcg-compatibility.json`
`sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`.
Its strict compatibility reader never consults current successor package source or build output.
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

## M05-T04

M05-T04 requires exact two-way parity between the complete prepared React component/behavior tree
and the authenticated current session binding inventory before creating an element. Every adapter
then receives a private commit-scoped interaction port tied to its exact session, snapshot, runtime
identity, and component/behavior kind. Pre-commit, SSR, never-committed Suspense, and unmounted
lifetimes remain `unavailable`; after a commit has existed, an event or new attachment through a
stale exact-snapshot port is `rejected` fail-closed. Trusted adapters may use side-effecting methods
only from committed effects or platform callbacks; reference source and lifecycle tests enforce
that rule without a hidden React render-phase API. Bounded payload snapshotting and commit-epoch
rechecks prevent hostile reflection from carrying an event or attachment across synchronous
cleanup; revoked handles and ports retain only inert tombstones rather than component callbacks or
session graphs.

Component and behavior events use the existing schema-validating session dispatcher and carry only
inert payloads. Their public completion resolves to `void` without exposing lower action-turn state
or a newer snapshot. Only a committed component may attach one opaque command owner. Supersession,
binding replacement, navigation, unmount, and disposal revoke it; foreign, forged, reentrant,
throwing, malformed, or behavior-owned command paths fail closed without changing the lower
binding ticket. Ordinary snapshot publication intentionally preserves an existing attached command
callback when the exact lower binding remains stable, while the old React port rejects new work.

The separately imported reference `./react-adapters` subpath contains exactly five frozen static
registrations. Explicit field/slot mapping, the narrow TextField `focus` handle, and fresh
TextField `change` and Button `press` payloads prove the exact reference interaction parity without
arbitrary prop, style, DOM, native-event, or dynamic-loader authority. The reference Catalog
declares no behavior capability; generic behavior event and no-command lifecycle are tested with a
synthetic exact Catalog fixture.

Adding the executable subpath produces the current exact reference package digest
`sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0`
over 80 `dist/**` files and the projected Catalog: 81 framed entries and 252,072 bytes. The M03-T10,
M04-T17, and M05-T03 artifacts remain byte-identical prerequisites behind strict task-time
compatibility readers. M05-T04 also migrates the historical SC-01 DTCG receipt to the same immutable
reader boundary: its exact `sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`
bytes and task-time manifest ledger remain unchanged while the current successor package is owned
only by this task's interaction artifact.

N-034 becomes `TESTED` for the selected Web–React production profile; N-033 remains `TESTED` with
concrete adapter evidence. No P-claim status or proof gate changes.

`runtime-react-0.1.0-interactions.json`
`sha256:9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0`.

## M05-T05

M05-T05 observes exact headless-session publications through React's external-store lifecycle and
re-authenticates each successor snapshot before returning a managed element. A private
renderer-root component type is stable for one exact session-and-registry pair and distinct when
either authority changes, so compatible generations preserve local adapter state while equal
public runtime identities cannot carry state, refs, effects, interaction ports, or platform
instances across host lifetimes.

Trusted registry entries may declare a bounded static `remountOnProps` policy. Each completely
validated component and behavior receives an RFC 8785 canonical key combining its stable runtime
identity, exact capability id, and a presence-aware projection of only those declared props.
Ordinary props, style, slots, and repeat reorder preserve compatible instances; capability changes,
declared value changes, and missing-versus-null changes remount deliberately.

The renderer also builds one all-or-nothing immutable diagnostic index after exact two-way binding
parity and before element creation. Forward runtime identity and sorted one-to-many source/behavior
lookups retain no props, styles, slots, React/platform values, session, Catalog, registry, or
callback. Explicit ceilings, hostile reflection vectors, lifecycle tests, source-boundary pins,
and byte-exact prerequisite verification close the selected Web–React slice.

P-16 advances to `PARTIAL`; M09-T13 still owns end-to-end Desen App diagnostic selection. At the
M05-T05 checkpoint N-021 remained `PLANNED`; M06-T06 now supplies the Publisher-side preservation
evidence and advances it to `TESTED`. R-104's selected Web–React adapter-instance portion is
complete.

`runtime-react-0.1.0-reconciliation-diagnostics.json`
`sha256:292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb`.

## M05-T06

M05-T06 supplies the explicit production boundary for controlled React render failures and
committed adapter exceptions. Complete bounded capability preflight still happens before any
adapter executes. An unknown component or behavior creates no React element and can reach only
the mandatory, statically host-owned failure renderer; the runtime never chooses a generic
component, placeholder, module, export, or dynamic loader.

The selected Web–React profile is deliberately whole-surface. A safely attributable leaf
component failure exposes only one frozen six-field diagnostic identity. Behavior, non-leaf,
descendant-removal, and otherwise ambiguous failures use null identity because React does not
expose a trustworthy public origin. Two persistent sibling provenance boundaries distinguish
managed cleanup from host failure-UI cleanup during branch transitions. Private carriers preserve
the exact host-thrown value only as `cause`, survive nested boundaries without double wrapping,
and use trap-safe identity branding.

Adapter failure remains sticky until trusted host code changes `recoveryKey`; omission is the safe
never-retry policy. A dedicated DESEN root may use the exported no-inspection React 19
`onCaughtError` handler. Shared-root telemetry, full-root unmount cleanup, event handlers,
arbitrary asynchronous work, SSR containment, `onUncaughtError`, and `onRecoverableError` remain
explicit host-policy nonclaims. The boundary accepts trusted runtime results and one deduplicated
`runtime-react` module instance per React tree.

N-037 becomes `TESTED`. P-17 remains `PARTIAL` with only M07-T04 activation finite-limit evidence
outstanding. PF-055 records the conservative target-specific containment decision; D-009 retains
its M06-T11 invalid-publication slice.

`runtime-react-0.1.0-failure-boundary.json`
`sha256:3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723`.

## M05-T07

M05-T07 establishes `apps/reference-host-web` as a separately built, client-only React 19
application with a zero-configuration Vite 8 production build. Its production dependency graph
cannot import Desen App, editor, publisher, `testkit`, or the broad `desen` facade. The host
accepts only a closed `RuntimeReactLiveSurfaceInput`; it cannot receive an arbitrary React tree,
component implementation, capability-selected loader, or caller-selected recovery key.

Activation joins four independent factory authorities before ownership changes: runtime-core
proves that the exact original host-port aggregate mounted the session; it authenticates the exact
current snapshot and Catalog set; and runtime-web proves that the same Web host was configured for
that snapshot's document id and revision; runtime-react also recognizes the exact
factory-created executable registry handle. Every join result is closed and callback-free:
registry and session authentication may return immutable metadata snapshots, but no result exposes
an executable callback or host port. The root transition fence prevents cleanup-triggered
activation, retry, replacement, or disposal reentry from interleaving authority changes.

The dedicated root uses the exact no-inspection caught-error policy. Recoverable failures emit
only fixed frozen diagnostics; uncaught failures first tombstone the root and terminally revoke
the session and host, then report a fixed diagnostic without reading or forwarding raw React
values. Sticky recovery advances only for explicit retry or exact session, registry, Catalog, or
host-authority replacement. Ordinary publication, Bundle/revision data, snapshots, renderer
results, and reconciliation keys cannot select it. Browser environment reads preserve the last
valid bounded snapshot, every registered listener receives an independent cleanup attempt, and an
uncertain unmount retains the weak container claim.

The deterministic evidence covers two identical independent Vite builds, 42 tracked files, 92
focused runtime cases, 53 compiler-negative cases, 33 hostile root mutations, 902 source
assertions, and 113 production imports. It authenticates the existing `R-019`, `R-105`, and
`A-013` assignments without changing a BCP14 row or proof-claim status. At M05-T07 task time,
P-06 remained `PARTIAL`, P-07 remained `NOT_PROVEN`, P-17 remained `PARTIAL`, and G05 remained
open. M05-T08 later supplied the official-derived sign-in execution; M05-T09 supplies the final
source/import audit below.

`reference-host-web-0.1.0-shell.json`
`sha256:cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2`.

## M05-T08

M05-T08 runs a controlled official-derived sign-in Bundle through the separately built reference
host, exact current Catalog, real five-component adapter registry, framework-neutral headless
session, and trusted application-owned operation boundary. The derived Source and Bundle change
only the exact Catalog requirement and consequent identities; their managed surfaces remain
canonically identical to both frozen official examples, and the protocol Bundle has no top-level
authoring state.

The host fixes the document/revision, entry and destination surfaces, operation capability,
invocation alias, effect, input shape, and `/home` navigation policy. The same-origin HTTP binding
performs one `POST /api/sign-in` attempt, best-effort cancels unused HTTP-failure bodies, and
accepts successful UTF-8 JSON only within exact 64 KiB and 1,024-non-empty-chunk ceilings.
Cross-realm byte chunks are copied through captured intrinsic typed-array and ArrayBuffer brands;
spoofed DataView and shared-memory chunks fail closed. Runtime-core retains exact Catalog output
validation.

The executable evidence covers two identical independent Vite builds, 46 tracked files, 408
source assertions, 18 focused integration cases, 40 complete reference-host cases, 13
compiler-negative cases, 14 hostile root mutations, and 13 exact trace assignments. The
React/jsdom path includes initial-burst press suppression and the production HTTP binding composed
through runtime, real adapters, declared failure, retry, success, and navigation. Replacement and
disposal contain late results without claiming fetch-level transport cancellation. Persisted
`pagehide` keeps the production composition active for BFCache restoration; final page exit
disposes it.

At M05-T08 task time, this strengthened P-06 and P-10 but left both `PARTIAL`; P-07 remained
`NOT_PROVEN`, P-17 remained `PARTIAL`, N-036 remained `PLANNED`, and G05 remained open for the
M05-T09 AST and real resolved-import-graph audit below. The fixture is not claimed as M06
Publisher output, and this is not a real-browser, Desen App, backend, native-runtime, or
deployment-security proof.

`reference-host-web-0.1.0-sign-in.json`
`sha256:a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb`.

## M05-T09

M05-T09 closes G05 by auditing the complete dynamically discovered reference-host production
source set with the TypeScript parser/checker and the real Vite 8 resolved production graph.
Every source module is reachable from the production entry; orphan files, symbolic links,
unresolved imports, unknown assets, and unreviewed data edges fail closed.

The semantic JSX allowlist contains only honest host infrastructure. The managed branch reaches
the generic `@desen/runtime-react` surface renderer and the shared
`@desen/reference-catalog-web/react-adapters` factory through public exports. Direct, aliased,
namespace, helper-hidden, `createElement`, JSX-runtime, forged-element, plan-shaped, capability- or
source-node-selected, dynamically loaded, and private-package alternatives are rejected by
hostile mutations. The closed executable-call/property-write surface rejects indirect callable and
DOM-setter escapes; canonical HTML, the complete three-level PostCSS search envelope, transitive
graph packages, and local graph backing-file identity are checked independently. Dependency-cruiser
preserves package boundaries only after its exact rule and installed version are authenticated.

This advances P-07 to `PARTIAL`, strengthens P-06 and P-10 without changing their `PARTIAL`
status, and closes G05. M10-T05 still owns Desen App host E2E before P-07 can become `PROVEN`;
M09-T03 still owns Desen App registry identity for P-06; and M10-T04 still owns Desen App Run Mode
operation execution for P-10. P-17 remains `PARTIAL`, N-036 remains `PLANNED`, and no normative
status changes.

The proof applies to the current separately built Web–React reference host. It is not Publisher
provenance, a real-browser E2E result, dynamic capability installation, Desen App parity,
deployment-security evidence, or a native-runtime claim.

`reference-host-web-0.1.0-source-audit.json`
`sha256:cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89`.

## M06-T01

M06-T01 establishes the deterministic Publisher's closed terminal result and strict raw Source
boundary without exposing a partial publisher or emitting a Bundle. Success is reserved for a
fully validated immutable Bundle plus warnings; failure identifies the first blocking stage,
starts with an error diagnostic, and structurally contains no `bundle` member.

Before schema validation or hashing, the package-private parser rejects malformed input,
duplicate decoded member names, invalid Unicode, non-finite numeric outcomes, and explicit finite
budget crossings. Accepted JSON becomes a detached recursively frozen snapshot. Diagnostics retain
no caller Source fragment or native exception detail. Lazy pointer paths and hostile-profile
vectors cover long-path CPU behavior, accessors, non-finite limits, and revoked Proxies.

The evidence checks the exact sixteen-stage order, two task-owned diagnostic definitions, stable
classification/severity separation, source and built declaration exports, package entry metadata,
platform neutrality, derived test inventory, deterministic artifact bytes, and fail-closed
mutation behavior. Its export and diagnostic inventory is explicitly the historical M06-T01
slice; later modules remain owned by their successor proofs. No `P-*`, normative-coverage, or gate
status changes; M06-T02 owns exact Catalog resolution next.

`docs/proof/artifacts/publisher-0.1.0-publish-result.json`
`sha256:aefed86741562bfa0f4bcbe163af50c8471dd6bf5979b7da36d681728536ff63`.

## M06-T02

M06-T02 adds package-private exact Catalog resolution without exposing an unfinished public
Publisher or emitting a Bundle. Each already validated Source requirement matches exactly one
closed package observation by code-unit-equal `id`, `version`, and optional `target`; locations,
candidate order, ranges, normalization, and equal Catalog JSON remain non-authoritative. Duplicate
Source requirements preserve index alignment while sharing one uniquely selected package.

Selected Catalogs cross bounded inert capture, frozen structural validation, exact
candidate/Catalog identity and observed-digest consistency, and the Validator's immutable
single-namespace gate. Missing, ambiguous, malformed, inconsistent, over-budget, and conflicting
inputs return the M06-T01 terminal failure shell with no Bundle or partial Catalog authority. The
data-only stage compares a target-profile package observation but does not claim to authenticate
arbitrary package bytes itself.

The evidence contains 22 focused runtime cases, 10 compiler-negative cases, and 8 independent
proof/mutation cases. It pins four prerequisites, the current official-derived Source and current
Web–React Catalog tuple, package-root privacy, target neutrality, deterministic artifact bytes,
and the unique proof-document hash. No `P-*`, normative status, or gate changes; M06-T03 owns
complete Source preflight next.

`docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json`
`sha256:02c5c567c8603470f0f45515dfd1713e528147bcc15ed72daa580807388015f6`.

## M06-T03

M06-T03 composes strict raw Source JSON ingress, Source-root and embedded-schema validation,
intrinsic identity and entry semantics, M06-T02 Catalog authority, and category-aware static
capability references into one package-private nonterminal preflight. Success preserves the exact
immutable Source, Catalog set, selected package tuples, and requirement alignment without exposing
a public `publish` function or emitting a Bundle. Failure retains the M06-T01 closed shell and
exposes no partial Source, Catalog, package, alignment, or Bundle authority.

Source-local checks stop before any Catalog candidate observation. Catalog-dependent component,
behavior, resource, and nested-operation references run only after exact trusted Catalog
preparation; unknown and wrong-category references stop at `source-semantics` with
`UNKNOWN_CAPABILITY`, while invalid Catalog authority retains the earlier M06-T02 stopped stage.
The task-owned finite diagnostic wrapper also preserves under-budget inherited T01/T02 failures
and replaces over-budget reports with one redacted failure at the same stage.

The evidence contains 10 focused Publisher runtime cases, 16 compiler-negative cases, 4 Validator
foundation cases, and 10 independent proof/mutation cases. It pins four prerequisites, the current
official-derived Source and Web–React Catalog tuple, phase ordering, complete failure atomicity,
recursive immutability, repeated-byte determinism, package-root privacy, platform neutrality, and
the unique proof-document hash. No `P-*`, normative, or gate status changes; M06-T04 owns prop,
slot, style, event, command, and behavior contracts next.

`docs/proof/artifacts/publisher-0.1.0-source-preflight.json`
`sha256:07537cc034d99dec3cb887805381f58a550de3a0dcb694564ab6a20ac760a387`.

## M06-T04

M06-T04 composes the exact M06-T03 authority with the Validator's component and interaction
contract preparation. It blocks statically knowable component prop and Variant, slot and accepted
child, style and visual-state, event and command, behavior prop/slot/style/event, attachment, and
conflict violations at `capability-contracts`. Unsafe Catalog contract schemas fail before Source
capability values are observed. Success remains package-private and nonterminal, preserves exact
Source, Catalog, package, and requirement alignment identities, and exposes no dynamic obligations
or Bundle.

Only a complete static success may produce fixed deprecated-capability warnings at exact Source
use sites. Catalog deprecation prose and replacement hints remain non-authoritative and are never
disclosed or followed. The common finite diagnostic profile rejects an over-budget report rather
than truncating warnings. Own-data traversal and lower-stage discriminator checks prevent
inherited prototype values from fabricating Source structure, warning sites, or success.

The evidence contains 14 focused Publisher runtime cases, 20 compiler-negative cases, 32
component cases, 49 interaction cases, 4 diagnostic micro-vector cases, and 15 independent
proof/mutation cases. It pins four prerequisites and 33 current files, including exact authority
identity, static failure parity, warning safety, budget boundaries, package-root privacy, target
neutral static dependency edges, an enumerated direct-form source audit, deterministic generation,
and atomic-write behavior. The source audit is not a JavaScript sandbox and makes no exhaustive
metaprogramming or runtime-code-generation claim. `PIPE-032` remains partial:
M06-T05 owns resource/operation receiving contracts, dynamic compatibility, and recorded runtime
obligations. No `P-*`, normative, or gate status changes.

`docs/proof/artifacts/publisher-0.1.0-capability-preflight.json`
`sha256:2c55593b69fd5203d3fe2aeaeb8e59dc70cb4a89c4168605c581c17fd1aad56e`.

## M06-T05

M06-T05 composes M06-T04 internally and upgrades only its exact prepared Source, selected package,
Catalog, requirement-alignment, and safe-warning authorities. The exact Catalog array crosses the
Validator's execution-contract preparation, and one cumulative analysis retains diagnostic phase
ownership at each emission site. Resource/operation schema, policy, and statically known receiving
input failures stop at `capability-contracts`; predicate, repeat, state-write, navigation, refresh,
operation-alias, and command-target failures stop at `state-and-control-flow`; lexical, format,
lifecycle, and static binding failures stop at `binding-compatibility`. Independent simultaneous
defects prove exact stage 8 → 9 → 10 precedence without code/pointer reclassification or repeated
cumulative walks.

A complete package-private nonterminal success preserves all exact T04 authorities and warnings,
adds the runtime-authenticated execution Catalog authority, and records every unresolved receiving
check in one closed eight-kind vocabulary. Obligations are sorted, de-duplicated, deeply frozen,
and bounded by 4,096 entries, 4,096 UTF-16 units in one pointer, and 1,048,576 aggregate
kind/pointer/context units. Exact boundaries pass; one-below profiles reject the whole
intermediate at `binding-compatibility` with one redacted diagnostic. No failure exposes a Source,
Catalog, package, alignment, warning, obligation, partial value, or Bundle. Operation/resource
outputs remain runtime receiving checks rather than publication obligations.

Evidence includes 14 focused Publisher cases, 28 compiler-negative cases, 50 binding cases, 50
execution cases, 15 independent proof/mutation cases, 3 exact prerequisite pins, and 35
byte-tracked files. It also authenticates package-root privacy, source/declaration target
neutrality, deterministic artifact rebuilds, proof-document uniqueness, prerequisite and fixture
drift, exact authority, stage mapping, complete obligations, finite limits, atomic writing, and the
six-module Validator successor admitted by the immutable M05 host evidence.

The Publisher's resource/operation and dynamic-obligation portion completes `PIPE-032`;
`PIPE-033` and `PIPE-034` gain direct publication evidence. Together with M04-T02 safe dynamic
resolution and M05-T02 final receiving validation, this advances N-027 to `TESTED`. No `P-*`,
`S-*`, or gate status changes. M06-T06 owns extension/order preservation and source-node
traceability next.

`docs/proof/artifacts/publisher-0.1.0-execution-preflight.json`
`sha256:6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67`.

## M06-T06

M06-T06 composes the exact M06-T05 boundary internally from raw Source JSON and closed package
candidates. Its package-private nonterminal success preserves the authenticated Source, execution
Catalog set, selected packages, requirement alignment, warnings, and runtime obligations by exact
identity. A separate frozen production-field projection retains every Source-reachable opaque
extension and semantic Source array by exact parsed runtime reference while leaving actual
top-level authoring removal to M06-T07. Raw whitespace, escape spelling, number-token spelling, and
object-member lexical order are explicitly outside the parsed preservation claim.

One complete immutable trace records every schema-reachable component node through the document
id, surface id, unchanged Source node id, capability id, and exact RFC 6901 pointer. Identity is
surface-scoped, so equal node ids on different surfaces remain valid and independently traceable.
Behavior identities remain in the Source graph without being mislabeled as component nodes, and
node-shaped values inside extensions or authoring remain opaque.

The trace envelope admits 25,000 records, 4,096 UTF-16 units in one pointer, and 4,194,304
aggregate identity/pointer units. Three exact ceilings pass; three one-below crossings reject the
whole intermediate at `normalization` without truncation, inherited warnings, partial authority,
or a Bundle. The evidence derives 17 shared Source/Bundle extension declarations and 16 reachable
locations per document from the frozen schemas, exercises all 16 Source-reachable kinds and eight
semantic-array classes, and authenticates three exact prerequisites plus 20 byte-tracked files.
Fifteen focused Publisher cases, 46 compiler-negative cases, and 18 independent proof/mutation
cases pass. Package-root privacy, platform neutrality, deterministic evidence bytes, finite
limits, artifact tampering, proof-pin drift, authority cloning, extension loss, order drift,
trace loss, partial leakage, and selected successor-tolerant CI registration are mutation-tested.

This completes the Publisher side of the M05-T05 runtime/source relation and advances N-021 to
`TESTED`. N-012 remains `PLANNED` for the M08-T07 editor save/open round trip, and N-014 remains
`PLANNED` for M08-T03 editor reorder coverage. No `P-*`, `S-*`, or gate status changes. M06-T07
owns actual authoring removal and deterministic normalization next.

`docs/proof/artifacts/publisher-0.1.0-source-preservation.json`
`sha256:261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff`.

## M06-T07 — Source digest, authoring removal, and deterministic normalization

M06-T07 composes the exact M06-T06 preservation authority once, calculates the Source digest from
that authenticated Source before any production projection, removes only the root `authoring`
member, and performs one RFC 8785 serialization/parse round trip. The digest remains a separate
immutable result field and is intentionally absent from the nonterminal `normalizedDocument`.
M06-T08 subsequently authenticates and carries that exact value while replacing loose
requirements with exact Catalog tuples.

Root-authoring changes affect neither digest nor normalized canonical bytes. Nested `authoring`
members inside opaque extensions remain semantic, and changing any such extension changes the
digest. No defaults, empty-member deletion, hidden index, semantic-array sorting, or deduplication
occurs; object insertion order has no canonical-byte authority while semantic array order,
identifiers, conditions, literals, capability ids, and trace pointers remain unchanged.

The normalized intermediate admits at most 2,097,152 canonical UTF-8 bytes. Exact capacity and
the explicit zero profile are mutation-tested, while one-byte crossings stop atomically at
`normalization`. Digest-helper exceptions or malformed digest output stop at `source-digest`.
Neither task-owned failure exposes warnings, partial authority, a normalized document, a digest,
or a Bundle.

Seventeen focused Publisher cases, 52 compiler-negative cases, and 26 exact named independent
proof/mutation cases protect the boundary. The evidence authenticates two exact prerequisites,
18 byte-tracked files, the source and built-distribution statement order, and nine immutable
trace-ownership rows.

At this historical checkpoint P-11 advanced only to `PARTIAL`. P-03 remained `NOT_PROVEN`, P-05
remained `PARTIAL`, N-018 remained `PLANNED`, and no proof gate changed. M06-T08 subsequently
completed exact tuple pinning; terminal Bundle validation, revision, and golden double-publication
evidence remain M06-T09 through M06-T10.

`docs/proof/artifacts/publisher-0.1.0-source-normalization.json`
`sha256:59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e`.

## M06-T08 — Source-digest authentication and exact Catalog pinning

M06-T08 composes the exact M06-T07 authority once from raw Source JSON and the closed package
inventory. It independently recalculates the digest from the same authenticated pre-normalization
Source, requires exact lowercase SHA-256 syntax and byte equality, and refuses to replace a
malformed, thrown, or mismatched predecessor value. Digest failures stop at `source-digest`
without warnings, partial authority, or a Bundle.

Every Source requirement position maps through the exact M06-T02
`requirementPackageIndexes` authority. The selected immutable package supplies `id`, `version`,
`target`, and `packageDigest`; the output renames only the final field to `digest`. Requirement
order, duplicates, and exact optional extensions remain positional. A top-level Source
`location` remains digest-significant discovery data but never becomes selection authority or
enters `requires.catalogs`; a nested extension field with that spelling remains opaque data.

The recursively immutable `pinnedDocument` remains package-private and nonterminal. It adds only
the authenticated `sourceDigest` and exact requirements to the T07 normalized base, with no
`revision`, `publication`, terminal success, signing, runtime, host, adapter, activation, or
deployment authority. Thirteen focused Publisher cases, 52 compiler-negative cases, and 37
independent proof/mutation cases authenticate two exact prerequisites, 21 tracked files, and 12
trace-ownership rows.

P-05 and P-11 remain `PARTIAL`; P-03 remains `NOT_PROVEN`; N-016, N-018, and N-020 remain
`PLANNED` for their terminal Publisher, runtime, and editor owners; and no proof gate changes.
M06-T09 owns complete Bundle validation, the final byte envelope, and revision closure next.

`docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json`
`sha256:de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f`.

## M06-T09 — Complete Bundle validation and revision closure

M06-T09 composes the exact M06-T08 authority once through the first public terminal Publisher
operation. It calculates a provisional revision from the pinned revision-free document, builds an
explicit candidate by adding only that member, and enforces the complete 2,097,152-byte RFC 8785
canonical UTF-8 envelope before invoking the cumulative Bundle execution Validator.

The Validator receives the exact candidate and exact authenticated Catalog set once. Success
requires an independently allocated, recursively immutable Bundle graph whose canonical bytes
equal the candidate. The snapshot is remeasured and its revision is recalculated; provisional,
embedded, and closing values must be identical. The public result returns only that exact snapshot
and the exact M06-T08 warning array. Every inherited or terminal failure structurally contains no
Bundle or intermediate authority.

The proof authenticates source and built-distribution call order, exact public/private exports,
finite limits, immutable result shells, isolated execution of the actual built package root,
single-pass CI registration, and the seven live compatibility readers that preserve T02–T08
task-time artifacts without regenerating them. It deliberately does not compare with the frozen
official Bundle or claim two independent publications; M06-T10 owns that golden. The complete
invalid-source and precedence matrix remains M06-T11.

P-11 gains complete-Bundle and revision-closure evidence but remains `PARTIAL` until the M06-T10
golden. P-03 remains `NOT_PROVEN`; P-05 remains `PARTIAL`; N-016, N-018, and N-041 remain
`PLANNED` for later owners; and G06 remains open.

`docs/proof/artifacts/publisher-0.1.0-bundle-publication.json`
`sha256:2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df`.

### M06-T10 official golden closure

M06-T10 invokes only the built public Publisher root with two fresh official Source/Catalog
candidate graphs. Both publications produce separate recursively immutable success graphs with
the same revision, Source digest, and 2,173 RFC 8785 canonical UTF-8 Bundle bytes. Those bytes
equal the frozen official sign-in Bundle after removing exactly its own root `publication`
member. The proof also rejects any additional root or nested projection, shared identity,
fixture/prerequisite drift, private-API substitution, and canonical-byte or digest mismatch.

This closes P-03 and P-11 as `PROVEN`. P-05 remains `PARTIAL` until installed-package activation
verification, N-016 and N-018 remain `PLANNED` for their later runtime/editor owners, and G06
remains open only for M06-T11's complete invalid-source/no-Bundle matrix.

`docs/proof/artifacts/publisher-0.1.0-official-golden.json`
`sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`.

## M06-T11 and G06 — Public invalid-Source/no-Bundle closure

M06-T11 imports the built public Publisher root in one isolated process. All 127 reviewed
task-owned invalid cases invoke only `publishDesenSource(rawSource, catalogPackages)`, stop at their
exact earliest naturally reachable pipeline stage, and return a recursively immutable exact
`{ diagnostics, ok, stage }` shell. Every report is nonempty and error-first, its first diagnostic
stage equals the result stage, and no failure contains a Bundle or any partial Source, Catalog,
package, obligation, trace, normalized document, digest, revision, or publication authority.

Eight positive guards bring the focused matrix to 135 cases. They preserve the official golden,
dynamic `context.runtimeTitle`, the exact obligation count/pointer/aggregate boundaries, the exact
final-Bundle admission boundary, sanitized warnings, and deterministic replay. The invalid table
proves stage 8 → 9 → 10 precedence and independently crosses inherited parse/Catalog report
budgets; capability error and warning report budgets; execution error and obligation budgets;
Source-trace count, pointer, and aggregate budgets; and the naturally reachable normalization and
complete-Bundle byte limits. Discovery `location` cannot establish trust.

The evidence pins the ordered complete 14-code Publisher registry, 67 independent hostile root
cases, 31 exact task-applicability records, two task-local PF-047 applicability records, 12 trace
rows, frozen fixtures and prerequisites, built public files, and one-way successor hashes. The
complete Publisher package suite passes 292/292. No public negative is fabricated for
`source-digest`, `authoring-removal`, `catalog-pinning`, or `bundle-revision`; these deterministic
stages retain the exact successful M06-T07 through M06-T10 evidence.

M06-T11 and G06 are `DONE`. P-03 and P-11 remain `PROVEN`; P-05 and P-17 remain `PARTIAL`.
N-016, N-018, N-041, and the Publisher conformance target remain `PLANNED` for their later owners.
The gate proves reviewed deterministic valid publication plus atomic invalid rejection, not
signing, storage, activation, deployment, runtime execution, host, adapter, editor, network, or
control-plane behavior.

`docs/proof/artifacts/publisher-0.1.0-invalid-source-matrix.json`
`sha256:fc5904ea6ec4e6495629fc4de8009fee66155938013068b709dd1ff40c1e98d8`.

## M07-T01 — Immutable content-addressed Bundle storage

M07-T01 persists the 2,173-byte public Publisher golden once under its exact revision and reopens
the same byte sequence through the built `@desen/control-plane-api` package. A byte-identical retry
returns `unchanged` without replacing the inode; a different sequence, including the proven
publication-only same-revision variant, returns `conflict` and preserves the winner. Equal and
divergent concurrent writers linearize through one POSIX no-clobber hard-link commit without
exposing partial or mixed addressed bytes.

The focused suite additionally proves synchronous input snapshotting, fresh read copies, parent
directory durability across the concurrent shard-creation race, read-only single-link storage,
committed-temporary alias recovery, owned-temporary cleanup on handled pre-commit failure when
identity remains established, post-commit cleanup durability and indeterminate retry, strict
revision paths, exact `Uint8Array` branding, and fail-closed symlink, special-file, hard-link, and
hostile-authority behavior. The artifact authenticates 18 package cases, four compiler-negative
cases, 16 independent root proof/mutation cases, the task-owned generated distribution, and five
exact trace rows.

This is storage evidence only. `P-12` remains `NOT_PROVEN` because verified ingress, package
preflight, mutable channels, staging, transactional activation, last-known-good recovery, fault
injection, and separately built host consumption remain M07-T02 through M07-T11. `N-010` and
`N-019` remain `PLANNED` for their remaining owners, and no proof gate changes.

`docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json`
`sha256:698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795`.

## M07-T02 — Stored Bundle integrity verification

M07-T02 consumes untrusted stored bytes through the built `@desen/control-plane-api` package. A
bounded strict JSON parser enforces fatal UTF-8, duplicate-key, Unicode-scalar, finite-number,
depth, value, string, number-token, and separate raw/canonical byte limits. A deterministic
generated first-issue guard validates the exact frozen Source and Bundle schemas before the
established exhaustive Validator can allocate diagnostics. The committed 730,791-byte guard is
regenerated and compared byte for byte by mandatory proof.

The successful boundary closes the outer storage key, embedded Bundle revision, and independently
recalculated revision. Available Source evidence must contain real raw bytes and independently
match the embedded Source digest; explicit absence remains an honest `not-available` state. Only
complete success yields one frozen runtime-authenticated integrity authority. Failures expose one
closed stage and redacted diagnostic without raw bytes, parsed documents, digest detail, or partial
authority.

The executable evidence contains 17 runtime cases, six dedicated guard cases, nine
compiler-negative cases, and 16 independent root proof/mutation cases. Four 10,000-item hostile
fan-outs stop with one diagnostic and zero exhaustive-Validator calls. Six prerequisite artifacts,
nine exact trace rows, deterministic code generation, package exports, generated distribution,
and atomic artifact writing are pinned.

This advances `N-016` to `TESTED`. `N-038` and `N-041` remain `PLANNED`, and `P-12` remains
`NOT_PROVEN`: installed-package preflight, reference validation, channels, staging, transactional
activation, recovery, fault injection, and separately built host consumption remain M07-T03
through M07-T11.

`docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json`
`sha256:db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a`.

## M07-T03 — Exact installed-package preflight

M07-T03 consumes only an authentic M07-T02 integrity authority and rejects a forged authority
before observing installed-package material. Every Bundle requirement resolves by literal
package-id code units, exact Semantic Version, and literal target to exactly one physical
candidate. Duplicate requirement positions remain intact while sharing one verified package;
ranges, trimming, case/Unicode normalization, newest/best match, candidate ordering, locations,
callbacks, loaders, and network discovery grant no authority.

For the current static `web-react` profile, the boundary snapshots the selected enumerable
own-data Catalog plus 80 exact attached, nonshared artifact views, independently frames 81 entries
and 252,072 bytes, and requires Bundle requirement digest = Catalog self-digest = calculated
package digest. The production digest implementation has no reference-catalog dependency; proof
cross-checks the current public profile independently. Missing, duplicate, newer, aliased,
historical-digest, changed Catalog/artifact, hostile, or over-limit input returns no package
authority.

Thirty-four runtime cases, five generated-guard cases, nine compiler-negative cases, and 16 independent
root proof/mutation cases protect exact resolution, actual-byte digest closure, immutable
positional authority, finite limits, hostile-input precedence, redaction, registrations,
prerequisites, 15 trace rows, deterministic/atomic evidence, and honest nonclaims. Success exposes
only byte-free metadata; package-private snapshots confer no staging, channel, or activation
operation.

Finite-limit evidence uses representative exact/one-over public inputs plus immutable internal
ports that isolate aggregate Catalog, capability, and framed-preimage branches without exposing a
mutable caller limit or constructing a 64 MiB fixture. Object-member/value and
diagnostic/requirement dominance are recorded explicitly; this is not a claim that every ceiling
has an independently reachable exact/+1 public input.

This closes `P-05` as `PROVEN` and advances `N-011` and `N-020` to `TESTED`. `N-010` remains
`PLANNED` for packed external-distribution evidence; `N-038` and `N-041` remain `PLANNED` for
reference/activation and whole-system limit owners. `P-12` remains `NOT_PROVEN`: surface and
capability reference preflight, channels, staging, transactional activation, last-known-good
recovery, fault injection, concurrency, and separately built host consumption remain M07-T04
through M07-T11.

`docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json`
`sha256:79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628`.

## M07-T04 — Surface, capability, and finite-limit preflight

M07-T04 consumes only an authentic M07-T03 installed-package authority. Before any staging work,
it closes the Bundle entry, managed navigation targets, component and behavior capabilities,
resource aliases, operations, declared events, component command targets and names, and nested
settlement actions against the exact authenticated Bundle and selected Catalog snapshots. Unknown,
wrong-category, duplicated, or unresolved semantics fail the whole preflight without a placeholder,
best-match rule, partial authority, executable discovery, or caller-selected limit.

The fixed profile bounds surface and source-node totals, conservative materialized-node counts,
source depth, effective repeat cardinality, direct and aggregate actions, settlement depth,
predicate arguments and nodes, and aggregate reference occurrences. Exact boundaries are admitted;
every overflow rejects without truncation. A final cumulative semantic check must reproduce the
authenticated Bundle canonically, and thrown, malformed, or disagreeing trusted results become one
redacted internal failure.

Only complete success returns an opaque, immutable reference-preflight authority with per-surface
audit counts. It exposes no Bundle, Catalog, package bytes, obligations, runtime index, staging
operation, channel mutation, durable commit, active pointer, or activation operation. M07-T06 owns
execution-contract staging, and M07-T07 joins both independent branches before durable activation.

This closes `P-17` as `PROVEN`. `P-12` remains `NOT_PROVEN`; `N-038` and `N-041` remain `PLANNED`
for their later channel/activation and measured whole-system owners. Transactional activation,
last-known-good recovery, restart recovery, fault injection, concurrency, and separately built host
consumption remain M07-T05 through M07-T11.

`docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json`
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`.

## M07-T05 — Local control-plane transport and persistence

M07-T05 exposes one fixed-loopback, bearer-authenticated Fastify service over three separate
repositories. Editable Source bytes use SQLite-backed monotonic generations and compare-and-swap;
a stale generation cannot replace a newer winner. Immutable Bundle routes delegate unchanged to
the M07-T01 first-writer-wins repository. Mutable channel pointers persist discovery metadata only
and confer no integrity, package, reference, staging, commit, activation, or runtime authority.

Exact allowed origins receive CORS permission and can read the response `ETag`; all other origins
fail closed. Bounded strict JSON, fixed body limits, stable redacted error envelopes, and durable
SQLite transactions cover malformed input, oversize input, concurrent writers, restart, and
mutation cases. The server bounds inactive connections at 5 seconds, complete requests at 15
seconds, and keep-alive at 5 seconds; a real partial-body TCP case proves shutdown cannot wait
indefinitely. Native-addon import authority is isolated to this exact proof pair, and the reviewed
production dependency audit reports no known vulnerability.

The evidence contains 16 focused runtime cases, 18 compiler-negative cases, and 16 independent
root proof/mutation cases. The 41,945-byte artifact authenticates the public API contract,
transport, SQLite persistence, immutable Bundle delegation, generated distribution, exact
prerequisite receipts, lifecycle behavior, and nonclaims.

This advances `N-019` to `TESTED`. `P-12` remains `NOT_PROVEN`; transactional activation,
last-known-good and restart recovery, fault injection, concurrency, and separately built host
consumption remain M07-T06 through M07-T11. G07 remains open and `PF-074` remains `OPEN`.

`docs/proof/artifacts/control-plane-api-0.1.0-local-api.json`
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`.

## M07-T06 — Staged runtime indexes and active/staged separation

M07-T06 consumes only the exact opaque M07-T03 package authority. It takes a second immutable copy
of every authenticated artifact, recalculates per-artifact and complete Web–React package digests,
validates the exact execution Catalog and Bundle contracts, and prepares inert component/behavior
handler programs. Complete success builds deterministic package, capability, surface, source-node,
attached-behavior, state, resource-alias, operation-alias, and seven sorted dynamic-obligation
indexes for the official two-surface candidate.

The staging operation accepts no caller-selected Bundle, Catalog, artifacts, loaders, callbacks,
channels, active record, reference authority, target adapter, or limit override. It loads no package
code, renders nothing, invokes no effect, and writes no mutable staged slot, channel, active
revision, previous-good revision, generation, commit, recovery, or host notification. M07-T04 and
M07-T06 therefore remain independent pre-commit branches over one exact M07-T03 identity; M07-T07
must authenticate and join both authorities before a durable activation transaction.

All 14 staging-profile ceilings have exact/one-over or executable dominance evidence. Thirteen
focused runtime cases, 13 compiler-negative cases, and 17 independent root proof/mutation cases
cover package reclosure, handler selectors, nested operation aliases, the real nonzero
behavior/resource path, forged-authority precedence, byte drift, trusted-port disagreement,
mutation resistance, deterministic regeneration, no-follow reads, and atomic artifact writes. The
artifact also pins trace rows `PIPE-006`, `PIPE-015`, `R-124`, `R-126`, and `R-127` and the exact
M07-T03/T04/T05 predecessor artifacts plus the M02-T11 Validator execution-contract and M04-T13
runtime-core action-turn artifacts. Normative rows `N-038` and `N-041` now name and authenticate
their limited M07-T06 contributions while remaining `PLANNED` for later transactional and measured
owners.

Reviewed reader checkpoint sequence 15 links sequence 14 head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` to
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5`. It authenticates 15 frozen
artifacts and 30 live readers, including the 47,622-byte T06 artifact at the SHA-256 below; reseals
reader indexes `[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27]`; and
appends the T06 proof/root readers at `[28, 29]`. Reader index 14 is the final 105,203-byte M07-T01
proof reader at `sha256:fda6c679ce74201a90483f36d26702f5478bc67561ea632315541d542697f80b`;
reader index 15 is the final 27,154-byte M07-T01 root reader at
`sha256:ab25e94ed1880b79dfb22f98a3da67fa5b777fdfaa86b3f02739bed6af29a45c`. Sequences 1–14 and
predecessor artifact bytes remain unchanged. This is local-reader evidence and makes no hosted
M07-T06 claim. `DEBT-I07-009` and `DEBT-I07-013` record the temporary compatibility-reader bridges
under I07-04 for removal by G07.

`P-12` remains `NOT_PROVEN`; `N-038` and `N-041` remain `PLANNED`; G07 remains open; and `PF-075`
remains `OPEN` for the candidate consume/reject lifetime. Durable activation, last-known-good and
restart recovery, fault injection, concurrency, and separately built host consumption remain
M07-T07 through M07-T11.

`docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json`
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`.

## M07-T07 — Durable transactional runtime activation record

M07-T07 authenticates and joins the exact private M07-T04 reference-preflight and M07-T06
runtime-staging identities from one M07-T03 lineage. It rejects a forged, copied, consumed, or
equal-revision-but-unrelated pair before Bundle-store I/O. Once the exact join succeeds, it
synchronously consumes the staged identity before the first asynchronous read, so a later
reclosure rejection, stale compare-and-set result, generation exhaustion, or definite storage
failure cannot reuse the candidate.

The controller independently rereads the candidate revision from the same application-owned
M07-T01 store, repeats the M07-T02 integrity boundary with Source explicitly unavailable, and
requires the complete canonical Bundle—including `publication`—to equal both private candidate
snapshots. It then supplies the authenticated candidate revision, caller's expected generation,
and the complete authenticated current-record-or-absence baseline to a platform-neutral
repository. One atomic transition derives and commits
`{ activeRevision, previousGoodRevision, generation }`: the first commit is generation zero, a
different successor retains the former active revision as previous-good, a same-revision recommit
preserves the real fallback, stale caller expectations return the actual durable record without
writing, complete authenticated-baseline drift requires recovery, and generation exhaustion never
wraps. Deletion and same-generation external rewrite cannot become a fresh or matching state, and
recovery observed while Bundle I/O is pending is sticky.

The first Web repository is an application-internal, lazily loaded SQLite adapter using a
single-row `STRICT` schema, prepared statements, `BEGIN IMMEDIATE`, WAL,
`synchronous=FULL`, safe-integer generation constraints, and database/sidecar identity checks.
Schema/version are reauthenticated under the writer lock before DML, and the exact committed row
is checked before authority publication. A live trigger added after open therefore fails before
write. A certain durable commit precedes publication of the current in-process authority. A preexisting
record or indeterminate commit yields only `recovery-required`; persisted fields are not promoted
to authenticated runtime authority. M07-T08 therefore still owns restart revalidation and
reconstruction.

The evidence authenticates 21 focused runtime cases, 25 compiler-negative public-contract cases,
18 independent root proof/mutation classes, three exact direct prerequisite artifacts, and trace
rows `PIPE-007`, `PIPE-016`, `PIPE-017`, `R-008`, `R-102`, `R-126`, `A-008`, and `A-009`.

This is the exact atomic-record contribution to `N-004`, not completion of that clause. `N-004`,
`N-038`, and `N-041` remain `PLANNED`; M07-T09 still owns the complete precommit fault matrix,
M07-T10 owns invalid-candidate, concurrency, race, and restart matrices, and M12-T05 owns the final
measured cross-system limit profile. `P-12` remains `NOT_PROVEN` until restart recovery,
last-known-good fault/race behavior, separately built host consumption, and M10-T07 product-level
recovery behavior are complete. G07 remains open.

`docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json`
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`.

## M07-T08 — Exact restart recovery of an unchanged durable record

M07-T08 accepts only exact opaque M07-T03 package authorities matching the active and optional
previous-good revision roles already selected by the durable T07 record. Missing, unexpected,
forged, cloned, proxied, swapped, or revision-mismatched roles reject before Bundle-store I/O. A
raw record, caller-selected revision, T04 authority, T06 staged handle, loader, store, path,
channel, callback, repository, or SQLite handle cannot become recovery authority.

For every required role, recovery internally reruns M07-T04 reference and finite-limit admission
plus M07-T06 runtime staging, authenticates the exact private T03/T04/T06 lineage, and consumes all
internally created staged handles before asynchronous work. It then independently rereads and
recloses the active and previous-good Bundles from the same application-owned immutable store.
Either lineage failing publishes neither active nor fallback authority.

Immediately before publication, the controller rereads the repository and requires exact equality
of active revision, previous-good revision, and generation with the record that selected the
recovery roles. Success reconstructs only current active authority, retains the validated fallback
lineage privately, and performs no write, generation increment, pointer swap, rollback, or fallback
promotion. Drift in any field, row deletion, close, concurrent work, or an indeterminate null
record remains fail-closed and recovery-required.

The evidence authenticates 12 focused runtime cases, 14 compiler-negative public-contract cases,
9 independent root proof/mutation classes, four exact direct prerequisite artifacts, and trace rows
`PIPE-017` and `A-009`. P-12 remains `NOT_PROVEN`; N-004, N-038, and N-041 remain `PLANNED`; and
G07 remains open. M07-T09 still owns exhaustive boundary fault injection, M07-T10 owns complete
invalid-candidate and race matrices, and M07-T11 owns separately built host consumption.

The final evidence pins exact AST structures for the complete 105-entry package-root public-export
inventory, executable CI registrations, shared-state mappings, and direct 12-case runtime plus
9-case root test inventories. Code-owned exact source receipts bind executable test bodies and the
effective CI/shared-state flow; bounded identity-safe reads protect every proof authority. The
proof also checks the exact 36-key built runtime module surface and records identical durable rows
and SQLite database bytes before and after recovery. Reviewed reader checkpoint sequence 17 links exact
sequence 16 head `f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd`
to current head `cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e`. It authenticates 17 frozen
artifacts and 34 live readers, appends the 44,224-byte T08 artifact at the hash below, reseals
indexes `[14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31]`, and appends the 84,219-byte proof reader
at `[32]` (`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) and the 24,939-byte root
reader at `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`).
Sequences 1–16 and the previous 16 artifact files remain byte-identical. This is reviewed local
reader evidence and makes no hosted M07-T08 claim; `DEBT-I07-015` remains owned by I07-04 for
removal by G07.

Reviewed checkpoint sequence 18 links exact sequence 17 head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e` to sequence 18 head
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14]` after the final fail-closed T08 compatibility-reader
upgrade. Sequence 17 and every artifact byte remain unchanged. This is reviewed local-reader
evidence and makes no hosted M07-T08 claim; the temporary compatibility bridges remain registered
for I07-04 removal by G07.

Reviewed checkpoint sequence 19 links exact sequence 18 head
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45` to sequence 19 head
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing only reader index `[28]` to 93,916 bytes
(`sha256:d0b6ec50df131066283619a01fa41fffdbb2a68c409d3c8d1a816f625f658521`). The fail-closed staging
verifier caught equal-length final T08 N-038/N-041 normative wording with stale semantic hashes;
sequence 19 records the corrected reader receipt. Sequences 1–18 and every artifact byte remain
unchanged. This is reviewed local-reader evidence and makes no hosted M07-T08 claim; the temporary
compatibility bridges remain `DEBT-I07-015`, owned by I07-04 for removal by G07.

Reviewed checkpoint sequence 20 links exact sequence 19 head
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3` to sequence 20 head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing only reader index `[30]` to 106,509 bytes
(`sha256:d322bf867930215d0f9e0f532bdacbea4ba50145dfa5df38f2e559102cc080ef`). The fail-closed T07
activation reader exposed stale T08 successor receipts after terminal close-race hardening changed
the runtime-activation-internal source, focused tests, and generated JavaScript/source map. The
exact successor receipts were repaired; the activation verifier and 18/18 root tests pass, and
this receipt repair changed no production behavior. Sequences 1–19 and every artifact byte remain
unchanged. This is reviewed local-reader evidence and makes no hosted M07-T08 claim; the temporary
compatibility bridges remain `DEBT-I07-015`, owned by I07-04 for removal by G07.

Reviewed checkpoint sequence 21 links the exact sequence 20 head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` to current head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939`. Sequences 1–20 and every
predecessor artifact byte remain unchanged. It appends the 64,493-byte M07-T09 artifact
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`, reseals 27 historical
compatibility readers, and appends the 64,932-byte proof reader
`sha256:da3fed33227c78eef872d06a3aedaf98a4e87e91de12893a21aceb5a9365216f` plus the 17,341-byte root
reader `sha256:f50017b668eb7f4a60d596a2d87a7e5b067989a9e1fe9a00270e685c44a4b8f6`. The chain now
authenticates 18 frozen artifacts and 36 current readers. This is reviewed local-reader evidence,
not a hosted M07-T09 claim; `DEBT-I07-016` records the temporary successor bridges for I07-04
removal by G07.

Reviewed checkpoint sequence 22 preserves sequence 21 as history and links predecessor head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. It authenticates the
same 18 frozen artifacts and 36 reader identities, leaves every frozen byte unchanged, and reseals
only workflow-dependent reader indexes `[8, 10, 11, 12, 14]`.

The canonical local root remains application-owned and trusted. Without an external signature,
monotonic sentinel, or equivalent independently stored cryptographic commitment, an internally
consistent historical or fully replaced database plus matching Bundles cannot be distinguished
from legitimate state. This proof therefore makes no tamper-proof, hostile-administrator, or
anti-rollback claim.

`docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json`
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`.

## M07-T09 — Closed discovery-through-recovery fault matrix

M07-T09 exercises the real M07-T01 through M07-T08 chain rather than adding an alternate
activation path or public fault hook. Its evidence directly authenticates all eight predecessor
artifacts and establishes a generation-zero A record through the public Bundle-store, integrity,
package-preflight, reference-preflight, staging, and activation boundaries. Candidate work then
crosses channel discovery, immutable fetch, integrity, exact installed-package resolution,
reference admission, runtime staging, durable commit, and restart recovery under controlled
failures.

The closed executable matrix contains 19 unique fault identities plus one inventory guard. It
covers invalid channel discovery and a missing immutable target; raw-byte, malformed-JSON,
unsupported-protocol, revision, and available-Source integrity failures; missing-package and
package-digest failures; unknown-capability and reference-depth rejection; execution-contract
staging rejection; definite pre-COMMIT rollback and post-COMMIT indeterminate observation; and
swapped recovery roles, reference reconstruction failure, staging reconstruction failure,
missing previous-good bytes, and final-record drift. Exact AST inventories and source receipts
prove that all 19 registrations remain present, enabled, uniquely named, and executed by the
focused 20-test suite.

Every definite precommit failure publishes no candidate authority, leaves A as the authenticated
current authority, and preserves the exact durable A record observed through an independent SQLite
connection. The real SQLite transaction hook proves that a definite pre-COMMIT failure rolls back.
A post-COMMIT observation failure is intentionally classified differently: the commit may already
be durable, so the original controller publishes neither A nor the candidate as current authority
and enters recovery-required state. A fresh controller may publish only after it reconstructs the
complete durable winner through M07-T08.

The recovery matrix proves that swapped package roles, failed reference reconstruction, failed
runtime staging, a missing previous-good Bundle, or final durable-record drift cannot publish a
partial active or fallback lineage. Recovery performs no repair write, and the final durable
observation wins over stale asynchronous reconstruction. These results assume the canonical local
root is application-owned and trusted; they do not establish tamper resistance, a
hostile-administrator boundary, or independently anchored anti-rollback protection.

M07-T09 adds only test and proof infrastructure. The 105-entry package-root export inventory and
36-key built runtime surface remain unchanged; repository opening, SQLite handles, package
loaders, activation construction, transaction hooks, and fault callbacks remain package-private.
Ten compiler-negative cases enforce that boundary. Eleven independent root proof/mutation classes
cover exact construction, deterministic bytes, every prerequisite receipt, executable runtime
results, public-export and case-inventory drift, all 22 task assignments plus an extra-assignment
negative, committed-artifact bytes, atomic writing, hostile options and shared memory, unsafe
filesystem authorities, and recursive immutability.

The evidence authenticates trace rows `PIPE-006`, `PIPE-007`, `PIPE-009` through `PIPE-016`,
`R-008`, `R-016`, `R-031`, `R-102`, `R-126`, `R-127`, `R-138`, `A-008`, `D-030`, `D-031`,
`D-034`, and `D-035`. This advances N-004 to `TESTED`. P-12 remains `NOT_PROVEN`; M07-T10,
M07-T11, and M10-T07 still own the complete A → invalid B → valid C and concurrency/restart
matrix, separately built reference-host channel consumption, and product-level recovery proof.
N-038 remains `PLANNED` until M07-T10 closes its remaining sequence and race scope. N-041 remains
`PLANNED` until M12-T05 supplies the final measured cross-system limit profile. G07 remains open
until all M07 tasks and I07-04 complete. This is working-tree evidence and makes no hosted M07-T09
claim.

`docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json`
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9` (64,493 bytes).

## M07-T10 — Ordered activation transitions and two-way races

M07-T10 directly authenticates every M07-T01 through M07-T09 artifact and exercises the real
public control-plane chain. Its closed matrix contains 15 stable case identities plus one exact
inventory guard. Eight ordered cases establish a generation-zero valid A, reject invalid B at
protocol, revision, Source-digest, package-availability, package-digest, capability-reference,
finite reference-profile, and execution-contract boundaries, and then activate valid C through
the same controller.

Every B rejection produces no candidate authority and preserves both the exact authenticated A
authority and its durable SQLite record. B does not poison the controller. C commits generation 1
with A as previous-good, and fresh restart recovery reconstructs only that exact C-over-A durable
lineage.

Independent same-candidate and different-candidate controller races produce exactly one durable
compare-and-swap winner. The generation-fenced loser receives the exact current record, cannot
replay consumed staging authority, and may retry only from fresh staging against the successor
generation. Deterministic rendezvous cases cover both recovery/activation orders: a stale recovery
cannot publish A after C has committed, and already reconstructed A authority is revoked when a
delayed C commit becomes the durable current record. Final restart always reconstructs the exact
durable winner.

The Web SQLite adapter reauthenticates the complete connection profile inside the read transaction,
after `BEGIN IMMEDIATE` and before writer observation or DML, and after `COMMIT` before authority
publication. The real external `journal_mode` transition is rejected under the live lock profile;
a deterministic private drift seam proves that any transaction-time profile mismatch fails closed
before DML, preserves A, and is never silently repaired. SQLite remains only the Web persistence
adapter, not a protocol or future-native implementation requirement.

The exact 105-entry package-root export inventory and 36-key built runtime surface remain
unchanged. Nine compiler-negative cases keep concurrency controls, durable records, recovery
selection, repository opening, SQLite handles, profile hooks, and staging reset outside the public
API. Eleven independent root proof/mutation classes protect deterministic bytes, all nine
predecessor artifacts, the closed runtime inventory, production profile guards, the public
boundary, all 15 trace assignments plus an extra-assignment negative, artifact verification,
atomic writes, hostile structured inputs, safe filesystem authority, and recursive immutability.

The artifact authenticates `C-023`, `PIPE-005`, `PIPE-007`, `PIPE-011`, `PIPE-016`, `PIPE-017`,
`R-007`, `R-008`, `R-012`, `R-102`, `R-125`, `R-126`, `A-007`, `A-008`, and `A-009`. The completed
M07-T02–T10 sequence advances N-038 to `TESTED`. N-041 remains `PLANNED` for M12-T05's final
measured whole-system limits. P-12 remains `NOT_PROVEN` until M07-T11 separately built host
consumption and M10-T07 product-level restart evidence complete. G07 remains open until M07-T11
and I07-04 complete.

This is local working-tree evidence. It makes no hosted, mutable-channel-consumption, separately
built host, native-conformance, rollback-API, tamper-proof, hostile-administrator, or independently
anchored anti-rollback claim.

`docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json`
`sha256:f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39` (58,059 bytes).

## M07-T11 — Separately built reference-host channel consumption

M07-T11 composes the public M07 boundaries without adding a second activation authority. A
separately compiled Node host server reads one fixed mutable channel and immutable Bundle through
the bearer-authenticated loopback API, then reruns integrity, installed-package, reference,
staging, activation, and recovery checks. Only the exact authenticated active Bundle and its strong
durable generation/revision ETag cross the same-origin browser refresh route. The independently
compiled browser imports no control-plane, SQLite, bearer, filesystem, Desen App, Publisher, or
testkit surface.

Seven focused-suite files contain 46 runtime tests and two browser type-test files. The end-to-end
sequence has nine exact identities: valid A activation/delivery, invalid B preserving A,
valid C replacing A, restart recovery before delivery, stale-refresh fencing, post-close fencing,
loopback bearer enforcement, installed-inventory symlink rejection, and last-known-good browser
mounting. The root proof owns 13 closed mutation classes, pins 13 immutable predecessor artifacts,
and authenticates the sole `PIPE-009` trace assignment. Supporting suites reject hard links,
special files, file or parent identity drift, oversized material, wrong route media types,
BOM-prefixed JSON, unsafe refresh requests, and unreviewed static paths.

This closes all 11 M07 implementation tasks and keeps N-038 `TESTED`. P-12 remains `NOT_PROVEN`
only for M10-T07's Desen App product-level restart proof. N-041 remains `PLANNED` for M12-T05's
measured cross-system limit profile. I07-04 has authenticated `20 / 20` hosted comparisons with
zero false negatives. At the M07-T11 checkpoint, the G07-due reader/shadow bridges had been
removed locally but G07 still awaited required-affected cutover and post-merge hosted evidence;
that checkpoint did not pre-claim the later hosted result.

The local socket suite cannot bind `127.0.0.1` in this sandbox (`EPERM`), so this document does not
claim a hosted M07-T11 result. It also makes no remote/multi-tenant/TLS, credential-lifecycle,
hostile-admin concurrent-root mutation resistance, independently anchored anti-rollback,
real-browser performance, Desen App restart, Android, iOS, or other native-host claim.

`docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json`
`sha256:48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0`

## I07-03 — Shadow affected selector bootstrap

I07-03 does not advance a protocol claim or a proof gate. It freezes the fail-closed affected
selector at
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f`, binding 20 exact
comparison-authority sources, while leaving `REQUIRED + EXHAUSTIVE` as the sole pass/fail path.
Focused local contracts passed 91/91 and all CI infrastructure tests passed 203/203. The complete
local gate is `BLOCKED_BY_LOCAL_SANDBOX` because loopback `listen` returned `EPERM` in two
pre-existing TCP lifecycle tests; this is not a product regression.

At the I07-03 bootstrap checkpoint, the authoritative Quality gate passed. Its pull-request shadow returned
`NOT_ELIGIBLE` → `EXHAUSTIVE` for `UNSUPPORTED_CHANGE_KIND`, so no fresh strict-subset comparison
occurred and no observation was eligible. Promotion was false, the counter was `0 / 20`, and
I07-04 was `NOT_STARTED` at that checkpoint. I07-04 later authenticated `20 / 20` eligible hosted
comparisons with zero false negatives and completed required cutover and hosted closure. Exact
bootstrap run, job, revision, and receipt identifiers are in
[`i07-03-affected-selector-shadow.json`](baselines/i07-03-affected-selector-shadow.json).

## I07-04 / G07 — Required affected promotion and hosted closure

The independent campaign closed at `20 / 20` eligible same-revision hosted comparisons with zero
false negatives. [Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36) passed fresh
`REQUIRED + EXHAUSTIVE` in
[run 31674300000, job 94365383803](https://github.com/desenlab/desen-app/actions/runs/31674300000/job/94365383803),
with receipt `sha256:1b30b24e65a4cc601023a2abf2c46751fe85e2fed237bccd623ec36d3f08d1d9`.
Its landed `main` revision `6d87889bc088e45e219f430ee67e10c901c1a2fb` passed fresh
`REQUIRED + EXHAUSTIVE` again in
[run 31675234655, job 94368259305](https://github.com/desenlab/desen-app/actions/runs/31675234655/job/94368259305),
with receipt `sha256:36139e5d65643dae255ca1305abb492270e21ca4ef5c76ac1dfc022071f128e6`.

The exact one-file [canary PR #37](https://github.com/desenlab/desen-app/pull/37) then passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935),
with receipt `sha256:4ac6f159f1487a1f9a969f88bd26be575ecf28ce6c66574206395afb659518f2`.
It selected and closed exactly 10 workloads for one proof unit, remained a strict subset, and read
no cached success. At the I07-04/G07 closure checkpoint, sequence 28 at
`2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546` authenticates 25 frozen
artifacts and 50 current readers. All 17 G07-due debt entries are `CLOSED`; `DEBT-I07-007` remains
`OPEN` for I07-05. I07-04 and G07 are `DONE`, advancing proof gates to 8/13 without changing the
85/145 implementation count at that closure checkpoint. P-12 remains `NOT_PROVEN`.

## M08-T01 — Direct DESEN Source editor document model

The built `@desen/editor-core` root now admits unknown inert JSON through the frozen DESEN 0.1.0
Source and embedded-schema structural validator. Success returns the direct detached recursively
immutable Source graph without a wrapper, normalized production projection, hidden AST, node
index, executable authority, platform value, persistence handle, or publication state. Rejection
returns frozen structural diagnostics without a partial document. Structurally valid unresolved
Catalog semantics remain admissible for later continuous validation.

Seven focused package cases, ten built public-runtime contract cases, five source compiler
negatives, five emitted-declaration consumer negatives, and seven public proof-core cases cover
the reviewed behavior, type, package, distribution, and platform boundary. The independent root
proof authenticates the completed I07-04/G07 prerequisite, verifies 47 tracked-file receipts, and
uses 13 adversarial cases to fail closed on behavior, source, distribution, manifest,
test-inventory, prerequisite, artifact, and hostile proof-option drift. CI registers
`editor-core-source-document` after
`protocol-structural-validation` in the exact 153-workload/72-proof-pair successor. Exact evidence lives in
[`EDITOR-CORE-SOURCE-DOCUMENT.md`](EDITOR-CORE-SOURCE-DOCUMENT.md) and
`artifacts/editor-core-0.1.0-source-document.json`.

The receipts include the exact 24-file runtime closure: three manifests and 21 static ESM modules
totaling 1,392,921 bytes. Eleven still-current M02-T11 receipts plus eight disjoint reviewed M08
successor receipts authenticate all 19 dependency modules before import. The exact dependency
bytes, Node runtime, loader, and process remain trusted authorities; this is not a general
hostile-JavaScript capability sandbox.

At the M08-T01 checkpoint, the append-only reader successor was sequence 29 at
`ccd4a58913585da39e71ea360714c69e70a94188e0b5643e521d61bf246f1a2b`, authenticating 26 frozen
artifacts and 52 then-current readers. Historical sequence 28 and its I07-04/G07 closure receipts remain
unchanged.

M08-T01 is `DONE`, advancing implementation progress to 86/145 (59%) and M08 to 1/10. Proof gates
remain 8/13 and no `P-*`, `N-*`, or `S-*` status changes. Stable-ID allocation and editing commands
remain M08-T02–M08-T06, authoring isolation and unknown-extension preservation remain M08-T07,
persistence remains M08-T08, continuous semantic validation and invalid-node mapping remain
M08-T09, and the terminal independent editor-core React/DOM boundary remains M08-T10. At that
checkpoint, M08-T02 was next.

## M08-T02 — Stable-ID allocator and insert command

The built `@desen/editor-core` package now exposes one atomic `insertDesenEditorNode` command. It
allocates the exact preferred ID when free and otherwise the lowest free `-2`, `-3`, or later
ordinal, truncating only the preferred base needed to keep the 128-character identifier ceiling.
Allocation is case-sensitive and surface-local across the shared node and behavior-instance
namespace. The command inserts one minimal `{ id, use }` leaf at the requested component-node or
behavior-instance slot index, preserves every existing identity and semantic array order, and
creates an absent slot only at index zero. Structurally valid unresolved capability and slot
semantics remain admissible for M08-T09's catalog-backed continuous validation.

Success returns a fresh detached recursively frozen direct Source plus the allocated identity.
Failure returns neither a partial Source nor an allocated identity. The focused package suite
passes 16/16 across deterministic allocation, shared namespaces, slot and index boundaries,
ownership, atomicity, diagnostics, public types, and fixed limits; the cumulative built public
package suite passes 22/22; and the independent root proof passes 10/10. Those limits cover both
the exact ceiling and one-unit overflow for 4,096 capability-id code units, an 8,388,608-byte
canonical post-insert Source, 25,000 identity occurrences in the selected surface, and component
depth 64 with the surface root at depth zero. The proof also authenticates all five insert
diagnostic codes plus unchanged structural-diagnostic pass-through.

Behavior executes only after receipt collection from an isolated 25-file ESM graph copied from
exact bytes: four editor files plus 21 dependency files whose receipts match the frozen M08-T01
authority. Node, its ESM loader, and the process environment remain trusted; the proof does not
claim a general hostile-JavaScript sandbox.

Exact evidence lives in
[`EDITOR-CORE-STABLE-ID-INSERT.md`](EDITOR-CORE-STABLE-ID-INSERT.md) and the 19,561-byte
[`editor-core-0.1.0-stable-id-insert.json`](artifacts/editor-core-0.1.0-stable-id-insert.json) at
`sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`. The artifact directly
authenticates the frozen M08-T01 artifact rather than using sequence 29 as an input. After that
proof closes, append-only reader checkpoint sequence 30 at
`f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970` authenticates 27 frozen
artifacts and 54 current readers; historical sequence 29 remains unchanged.

M08-T02 is `DONE`, advancing implementation progress to 87/145 (60%) and M08 to 2/10. Proof gates
remain 8/13 and no `P-*`, `N-*`, or `S-*` status changes. Delete, move, and ordered reorder remain
M08-T03; M08-T04–M08-T08 retain the remaining authoring and persistence commands; M08-T09 retains
catalog semantics and continuous diagnostics; and M08-T10 retains terminal stable-identity and
React/DOM boundary evidence. This proof does not claim streaming or preallocation memory-DoS
resistance, a general hostile-JavaScript sandbox, P-18, or G08. M08-T03 is next.

## M08-T03 — Delete, slot move, and ordered reorder commands

The built `@desen/editor-core` package now exposes three separated atomic structural commands.
`deleteDesenEditorNode` removes exactly one selected non-root subtree and preserves the vacated
slot as an own key with `[]`. `moveDesenEditorNode` transfers one intact subtree only across owners
or slots, supporting node and behavior destinations and creating an absent destination only at
index zero. `reorderDesenEditorNode` applies only within one owner/slot and interprets `index` as
the child's final post-removal position. Existing IDs never change, target subtrees remain intact
for move/reorder, and unaffected semantic array order is preserved.

The proof covers exact no-op and forward/backward reorder, cross-owner and cross-slot move,
behavior-owned and prototype-overlapping destination slots, structurally valid unresolved
semantics, and deletion to an empty retained slot. It rejects root delete/move, cycles,
self-descendant destinations, missing or ambiguous targets, same-slot move, cross-slot reorder,
invalid indices, prototype-chain authority, accessor/inherited/symbol/extra command keys, and
structurally invalid inputs. Every failure returns frozen diagnostics and no partial document; each
success returns a fresh detached recursively frozen direct Source.

The focused package suite passes 16/16 behavior cases plus ten compiler-negative assertions, the
cumulative built public-package suite passes its exact 26 runtime/root cases, and the independent
root proof passes 10/10. The retained finite profile covers exact and overflowing 8,388,608-byte
canonical documents, 25,000 selected-surface identities, and component depth 64 with root at zero.
The 4,096-code-unit capability-ID discipline remains authenticated through M08-T02 because these
commands introduce no capability-ID input. Structural diagnostic pass-through is unchanged.

Exact evidence lives in
[`EDITOR-CORE-STRUCTURAL-EDITS.md`](EDITOR-CORE-STRUCTURAL-EDITS.md) and the 22,402-byte
[`editor-core-0.1.0-structural-edits.json`](artifacts/editor-core-0.1.0-structural-edits.json) at
`sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`. The artifact directly
authenticates the exact 19,561-byte M08-T02 artifact at
`sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`, verifies 60 current
tracked-file receipts, and executes behavior only after copying five editor files and twenty-one
authenticated dependencies into an isolated 26-file ESM graph. Node, its ESM loader, and the
process environment remain trusted; no general hostile-JavaScript sandbox is claimed.

CI registers `editor-core-structural-edits` after `editor-core-stable-id-insert` and the serial
public-package predecessor in the exact 157-workload/74-proof-pair successor: 63 ordinary pairs
and 11 exclusive barriers. Append-only reader checkpoint sequence 31 at
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d` authenticates 28 frozen
artifacts and 56 current readers; historical sequence 30 remains unchanged.

M08-T03 is `DONE`, advancing implementation progress to 88/145 (61%) and M08 to 3/10. Proof gates
remain 8/13. Exact structural ordering closes `N-014` as `TESTED`; `S-002` remains `PLANNED` until
M08-T10 closes terminal stable-identity integration. Prop, style-part, condition, and variant
commands remain M08-T04; M08-T05–M08-T09 retain later authoring, persistence, and validation work;
M08-T10 retains the independent terminal editor-core React/DOM boundary. This proof does not claim
streaming or preallocation memory-DoS resistance, a general hostile-JavaScript sandbox, P-18, or
G08. M08-T04 is next.

## M08-T04 — Prop, style-part, condition, and variant editing commands

The built `@desen/editor-core` package now exposes fourteen atomic immutable content commands.
Base node or behavior props and style leaves can be set or deleted; node conditions can be set or
cleared; and ordered node variants can be inserted, deleted, reordered, or updated at their
condition, prop, and style leaves. Variant reorder uses the final post-removal position. Deliberately
empty props, style, state, part, and variants containers remain own data. Every success returns a
fresh detached recursively frozen direct Source, preserves unrelated semantic order and all
existing identities, and keeps structurally valid Catalog-unresolved content and extension data
authorable.

Six content-edit diagnostic classes cover malformed commands, fixed-limit crossings, missing
paths, invalid positions, ambiguous targets, and missing targets. Underlying structural rejection
retains its original diagnostic authority. Exact command own-data capture, detached nested values,
prototype-sensitive names as own data, malformed Unicode, inheritance, accessors, symbols, extra
fields, function values, own `toJSON` hooks, sparse/decorated arrays, unsafe indexes, and every
atomic failure path are covered. Required command fields are exact enumerable own data; accessor
getters and `toJSON` hooks are not invoked. Necessary reflection may execute arbitrary `Proxy`
traps, and an admissible forwarding `Proxy` may be accepted; this is not a
hostile-JavaScript/no-code-execution membrane. The finite profile admits the exact 8,388,608-byte
canonical Source, 25,000 selected-surface identities, and root-at-zero depth 64 while rejecting
one-unit crossings. These bounds do not claim streaming or preallocation memory-DoS resistance.

The cumulative editor-core package suite passes 55/55, including 16/16 focused content-edit cases;
the cumulative built public-package suite passes 32/32; and the independent root proof passes
10/10. Exact evidence lives in
[`EDITOR-CORE-CONTENT-EDITS.md`](EDITOR-CORE-CONTENT-EDITS.md) and the 26,988-byte
[`editor-core-0.1.0-content-edits.json`](artifacts/editor-core-0.1.0-content-edits.json) at
`sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`. The proof directly
authenticates the exact frozen M08-T02 and M08-T03 artifacts and verifies 67 current tracked-file
receipts. Behavior begins only after six editor files and twenty-one authenticated dependencies are
copied into an isolated 27-file ESM graph. Node, its ESM loader, and the process environment remain
trusted; no general hostile-JavaScript sandbox is claimed.

CI registers `editor-core-content-edits` after the stable-ID and structural-edit prerequisites plus
the serial public-package contract in the exact 159-workload/75-proof-pair successor: 64 ordinary
pairs and 11 exclusive barriers. Its retained projection contains 519 prerequisite segments, 3,237
ordered leaf invocations, and 251 distinct leaves. Shared-state counts are 6
`GLOBAL_EXCLUSIVE`, 2 `WORKSPACE_OUTPUT_EXCLUSIVE`, 1 `PACKAGE_TEST_EXCLUSIVE`, 69
`PROOF_READ_ONLY`, 70 `PROOF_OS_TEMP_ISOLATED`, 10 `PROOF_TRACKED_ALIAS_EXCLUSIVE`, and 1
`PROOF_WORKSPACE_TEMP_EXCLUSIVE`; filesystem policies are 141 `NONE`, 2 `FIXTURE_COPY`, 15
`REVIEWED_SYMLINK`, and 1 combined policy. The neutral inventory is
`sha256:3879dcd4c9716b7f08746953c62170de7bd33c786f747849b8aed38e0fe1e62c`, and the required plan is
`sha256:30a193cbc27316792bd577dcecdc87c10e680e2e033698ceb90787c2cbcf1b51`. These are local
code-owned/current receipts and make no hosted M08-T04 claim.

Append-only reader checkpoint sequence 32 at
`112e966b350b019557274e1f76a915db15c04109793429b3b885ff7d18843574` authenticates 29 frozen
artifacts and 58 readers. Historical sequence 31 at
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d`, all earlier entries, and
every predecessor artifact byte remain unchanged.

M08-T04 is `DONE`, advancing implementation progress to 89/145 (61%) and M08 to 4/10. Proof gates
remain 8/13. `N-014` remains `TESTED`, and `S-002` remains `PLANNED` until terminal M08-T10
stable-identity integration. No `P-*`, `N-*`, `S-*`, or proof-gate status changes. State
declaration and binding commands remain M08-T05; M08-T06–M08-T09 retain later authoring,
persistence, and validation work; and M08-T10 retains the independent terminal editor-core
React/DOM boundary. This proof does not claim Catalog slot acceptance/cardinality, undo/redo,
selection, viewport, a hostile-JavaScript/no-code-execution membrane, P-18, or G08. M08-T05 is
next.
