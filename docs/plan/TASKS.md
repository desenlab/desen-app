# Implementation Task Board

Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

Every task inherits the repository definition of done in `CONTRIBUTING.md`. A task may be closed
only when its named evidence exists and its dependencies are `DONE`. Gate dependencies use full
task IDs so the required order is unambiguous. Milestones execute in numeric order; only the two
explicitly parallel branches inside M11 may progress independently.

## M00 — Frozen protocol and proof contract

| ID      | Status | Depends on      | Deliverable                                                                                         | Evidence                                                                            |
| ------- | ------ | --------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| M00-T01 | DONE   | —               | Exact upstream repository, commit, intended tag, and manifest checksum recorded                     | `packages/protocol/upstream/0.1.0/baseline.json`                                    |
| M00-T02 | DONE   | M00-T01         | Official suite rerun archived: 14/14 cases = 9 vectors + 5 examples                                 | `docs/proof/baselines/protocol-0.1.0-validation.txt`                                |
| M00-T03 | DONE   | M00-T01         | Numbered mandatory and recommended BCP 14 clause inventory                                          | `docs/proof/NORMATIVE-COVERAGE.md`                                                  |
| M00-T04 | DONE   | M00-T01         | Product/domain/web-first/package decisions recorded                                                 | `docs/adr/0001-product-and-domain-boundaries.md` through `0005-npm-distribution.md` |
| M00-T05 | DONE   | M00-T01         | Proof Matrix and Protocol Findings initialized                                                      | `docs/proof/PROOF-MATRIX.md`, `docs/plan/PROTOCOL-FINDINGS.md`                      |
| M00-T06 | DONE   | M00-T03–M00-T05 | Planned `web-react` conformance targets and every inventoried BCP 14 clause assigned to owner tasks | `docs/proof/NORMATIVE-COVERAGE.md`                                                  |
| G00     | DONE   | M00-T01–M00-T06 | Frozen baseline and proof contract review passes                                                    | M00 evidence set above                                                              |

## M01 — Professional workspace foundation

| ID      | Status | Depends on                               | Deliverable                                                                                                 | Evidence                                          |
| ------- | ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| M01-T01 | DONE   | G00                                      | Monorepo apps/packages structure and documented placeholder entry points                                    | `apps/*/README.md`, `packages/*/README.md`        |
| M01-T02 | DONE   | M01-T01                                  | Pinned local Node, pnpm, lockfile, and local frozen-lockfile install                                        | `.node-version`, `package.json`, `pnpm-lock.yaml` |
| M01-T03 | DONE   | M01-T02                                  | Build, lint, typecheck, test, boundary, and format commands; proof command reserved for evidence milestones | `package.json`, `turbo.json`                      |
| M01-T04 | DONE   | M01-T03                                  | CI workflow configured; remote execution explicitly unverified until an authorized commit/push              | `.github/workflows/ci.yml`                        |
| M01-T05 | DONE   | M01-T01                                  | Automated dependency-boundary rules                                                                         | `dependency-cruiser.config.cjs`                   |
| M01-T06 | DONE   | M01-T01                                  | Engineering, TSDoc, README, ADR, and testing standards                                                      | `docs/standards/*`                                |
| G01     | DONE   | M01-T01–M01-T06                          | Current local scaffold installs and passes `pnpm check`; no clean-checkout or remote-CI claim               | `docs/proof/baselines/foundation-quality.json`    |
| M01-T07 | DONE   | G01                                      | Create the Selman-authored local baseline commit and verify install/check from a temporary clean clone      | `docs/proof/baselines/tracked-foundation.json`    |
| M01-T08 | DONE   | M01-T07, explicit external authorization | Configure/push a remote and archive the first verified remote CI run                                        | `docs/proof/baselines/remote-ci.json`             |

`M01-T07` closes the local preparation baseline before functional implementation. `M01-T08` is
external release hygiene and does not block local implementation. Until each task is complete, no
document may claim the corresponding clean-checkout or remote-CI evidence.

## M02 — Protocol package and validator

| ID      | Status      | Depends on      | Deliverable / evidence                                                                                                 |
| ------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| M02-T01 | DONE        | M01-T07         | Checksum-verified upstream 0.1.0 snapshot vendored read-only; P-01 evidence                                            |
| M02-T02 | DONE        | M02-T01         | 269 prose traces and all 989 schema constraints assigned to exact owner/test tasks; deterministic checker and artifact |
| M02-T03 | DONE        | M02-T01–M02-T02 | Types generated from or mechanically checked against JSON Schema                                                       |
| M02-T04 | DONE        | M02-T01         | RFC 8785-compatible canonicalization and SHA-256 golden tests                                                          |
| M02-T05 | DONE        | M02-T03         | Stable diagnostic model and JSON Pointer support                                                                       |
| M02-T06 | DONE        | M02-T03–M02-T05 | Source, Bundle, Catalog, and embedded-schema structural validation                                                     |
| M02-T07 | DONE        | M02-T06         | Identity, SemVer, entry, catalog namespace, extension, and reference validation                                        |
| M02-T08 | DONE        | M02-T07         | Component prop, slot, style-part, and visual-state contract validation                                                 |
| M02-T09 | DONE        | M02-T07         | Event, command, behavior attachment, conflict, and payload-contract validation                                         |
| M02-T10 | DONE        | M02-T07         | State, predicate, repeat, alias, and static binding validation                                                         |
| M02-T11 | DONE        | M02-T10         | Resource, operation, action, navigation, and command-target validation                                                 |
| M02-T12 | DONE        | M02-T04–M02-T11 | TypeScript parity for official 14-case suite: 9 vectors + 5 examples                                                   |
| M02-T13 | NOT_STARTED | M02-T08–M02-T12 | Positive and negative project micro-vectors for every validator-owned diagnostic                                       |
| G02     | NOT_STARTED | M02-T01–M02-T13 | Validator baseline and declared validator-scope coverage pass                                                          |

## M03 — Catalog SDK and reference capability package

| ID      | Status      | Depends on       | Deliverable / evidence                                                                                                      |
| ------- | ----------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| M03-T01 | NOT_STARTED | G02              | Framework-neutral JSON manifest/contract registration API with no React or platform types                                   |
| M03-T02 | NOT_STARTED | M03-T01          | Behavior, operation, and resource registration APIs                                                                         |
| M03-T03 | NOT_STARTED | M03-T01          | Manifest-authoritative TypeScript and inspector-control derivation                                                          |
| M03-T04 | NOT_STARTED | M03-T02          | Documented deterministic Web–React package digest profile and immutability tests                                            |
| M03-T05 | NOT_STARTED | M03-T01          | Accessible Stack and Text capabilities with catalog contracts                                                               |
| M03-T06 | NOT_STARTED | M03-T01, M03-T05 | Accessible TextField, Button, and Alert capabilities with catalog contracts                                                 |
| M03-T07 | NOT_STARTED | M03-T02          | Token provider and synthetic fixture infrastructure                                                                         |
| M03-T08 | NOT_STARTED | M03-T06–M03-T07  | Sign-in success/failure fixtures and separate host operation binding                                                        |
| M03-T09 | NOT_STARTED | M03-T04–M03-T08  | Catalog/implementation parity metadata, event payload, command, and accessibility contract tests                            |
| M03-T10 | NOT_STARTED | M03-T03–M03-T09  | Build final capability artifact and exact tuple; same bytes yield same digest and any byte change yields a different digest |
| G03     | NOT_STARTED | M03-T01–M03-T10  | Exact reference catalog and immutable artifact tuple resolve complete contracts; React adapter registration remains in M05  |

## M04 — Framework-neutral runtime core

| ID      | Status      | Depends on       | Deliverable / evidence                                                                             |
| ------- | ----------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| M04-T01 | NOT_STARTED | G03              | Host ports for navigation, storage, operations, resources, tokens, environment, clock, diagnostics |
| M04-T02 | NOT_STARTED | M04-T01          | Literal/reference/fallback resolver for state, context, resource, operation, event, item, and env  |
| M04-T03 | NOT_STARTED | M04-T02          | Token and deterministic string-format resolution                                                   |
| M04-T04 | NOT_STARTED | M04-T02          | Predicate evaluation and conditional presence                                                      |
| M04-T05 | NOT_STARTED | M04-T03–M04-T04  | Ordered variant and style override evaluation                                                      |
| M04-T06 | NOT_STARTED | M04-T02          | Local state lifecycle, schema-safe writes, and stable node identity                                |
| M04-T07 | NOT_STARTED | M04-T02, M04-T06 | Repeat scopes, aliases, keys, instance identity, and limits                                        |
| M04-T08 | NOT_STARTED | M04-T02          | Resource mount/once/manual lifecycle and refresh                                                   |
| M04-T09 | NOT_STARTED | M04-T02          | Operation lifecycle and reject/replace/queue concurrency                                           |
| M04-T10 | NOT_STARTED | M04-T04, M04-T06 | `state.set`, `state.toggle`, and `navigate` actions                                                |
| M04-T11 | NOT_STARTED | M04-T08–M04-T10  | `operation.invoke` settlement actions and `resource.refresh`                                       |
| M04-T12 | NOT_STARTED | M04-T10          | `component.command` and allowlisted, schema-validated `event.emit`                                 |
| M04-T13 | NOT_STARTED | M04-T10–M04-T12  | Action-turn, settlement-depth, and repeated-transition limits                                      |
| M04-T14 | NOT_STARTED | M04-T07, M04-T12 | Generic component/behavior event and command bridges with payload validation                       |
| M04-T15 | NOT_STARTED | M04-T05–M04-T14  | Reactive re-evaluation and stale asynchronous-result protection                                    |
| M04-T16 | NOT_STARTED | M04-T03–M04-T15  | Headless sign-in determinism and JSON-serializable observable trace tests                          |
| G04     | NOT_STARTED | M04-T01–M04-T16  | Framework-neutral sign-in runtime passes                                                           |

## M05 — React runtime and separate reference host

| ID      | Status      | Depends on      | Deliverable / evidence                                                                             |
| ------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------- |
| M05-T01 | NOT_STARTED | G04             | React adapter registry and render-plan renderer                                                    |
| M05-T02 | NOT_STARTED | M05-T01         | Resolved props and named slots wired without private structure inspection                          |
| M05-T03 | NOT_STARTED | M05-T01–M05-T02 | Style parts and visual states wired through public adapter contracts                               |
| M05-T04 | NOT_STARTED | M05-T01–M05-T03 | Component events, commands, and behavior adapters wired                                            |
| M05-T05 | NOT_STARTED | M05-T02–M05-T04 | Stable keys and runtime-node ↔ source-node diagnostics                                             |
| M05-T06 | NOT_STARTED | M05-T05         | Error boundaries and explicit failure for unknown capabilities; no production placeholder guessing |
| M05-T07 | NOT_STARTED | M05-T01         | Independently built reference-host shell with host ports                                           |
| M05-T08 | NOT_STARTED | M05-T04–M05-T07 | Official sign-in bundle running through real adapters                                              |
| M05-T09 | NOT_STARTED | M05-T07–M05-T08 | Automated source/import audit preventing handwritten managed-screen composition                    |
| G05     | NOT_STARTED | M05-T01–M05-T09 | Bundle-driven sign-in runs in separate host                                                        |

## M06 — Deterministic publisher

| ID      | Status      | Depends on       | Deliverable / evidence                                                                  |
| ------- | ----------- | ---------------- | --------------------------------------------------------------------------------------- |
| M06-T01 | NOT_STARTED | G05              | Staged `PublishResult` and diagnostics API                                              |
| M06-T02 | NOT_STARTED | M06-T01          | Exact catalog resolution, package immutability, and namespace-conflict checks           |
| M06-T03 | NOT_STARTED | M06-T02          | Source, embedded-schema, identity, entry, and static-reference preflight                |
| M06-T04 | NOT_STARTED | M06-T03          | Prop, slot, style, event, command, and behavior preflight                               |
| M06-T05 | NOT_STARTED | M06-T03          | Dynamic binding compatibility and recorded runtime validation obligations               |
| M06-T06 | NOT_STARTED | M06-T03–M06-T05  | Extension preservation, array-order preservation, and source-node identity traceability |
| M06-T07 | NOT_STARTED | M06-T06          | Authoring removal and deterministic normalization                                       |
| M06-T08 | NOT_STARTED | M06-T02, M06-T07 | Source digest and exact package tuple pinning                                           |
| M06-T09 | NOT_STARTED | M06-T08          | Bundle validation and revision calculation                                              |
| M06-T10 | NOT_STARTED | M06-T09          | Official source-to-bundle golden and double-publish determinism tests                   |
| M06-T11 | NOT_STARTED | M06-T03–M06-T10  | Invalid-source matrix proves no bundle is emitted                                       |
| G06     | NOT_STARTED | M06-T01–M06-T11  | Valid source publishes; invalid source emits no bundle                                  |

## M07 — Atomic activation, last-known-good, and local control plane

| ID      | Status      | Depends on       | Deliverable / evidence                                                                                               |
| ------- | ----------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| M07-T01 | NOT_STARTED | G06              | Content-addressed bundle store with immutable revision entries                                                       |
| M07-T02 | NOT_STARTED | M07-T01          | Protocol, revision, available source digest, and bundle-size verification                                            |
| M07-T03 | NOT_STARTED | M07-T02          | Exact package target/version/digest resolution and preflight                                                         |
| M07-T04 | NOT_STARTED | M07-T02–M07-T03  | Surface/capability reference and finite-limit preflight                                                              |
| M07-T05 | NOT_STARTED | M07-T01          | Local control-plane API for editable sources, immutable bundles, and mutable channel pointers                        |
| M07-T06 | NOT_STARTED | M07-T03–M07-T05  | Staged runtime indexes and active/staged state separation                                                            |
| M07-T07 | NOT_STARTED | M07-T04, M07-T06 | Durable transactional commit of `{activeRevision, previousGoodRevision}` as one consistent record                    |
| M07-T08 | NOT_STARTED | M07-T07          | Restart recovery validates and restores the transactional active/previous-good record                                |
| M07-T09 | NOT_STARTED | M07-T07–M07-T08  | Fault injection at fetch, integrity, package resolution, preflight, staging, durable commit, and recovery boundaries |
| M07-T10 | NOT_STARTED | M07-T09          | A → invalid B → valid C, concurrent activation, and restart behavior tests                                           |
| M07-T11 | NOT_STARTED | M07-T05, M07-T10 | Control-plane channel consumed by separately built reference host                                                    |
| G07     | NOT_STARTED | M07-T01–M07-T11  | Every pre-commit fault preserves a valid durable activation record and invalid revision never becomes active         |

## M08 — Framework-neutral editor core

| ID      | Status      | Depends on      | Deliverable / evidence                                               |
| ------- | ----------- | --------------- | -------------------------------------------------------------------- |
| M08-T01 | NOT_STARTED | G07             | Direct DESEN Source editor document model                            |
| M08-T02 | NOT_STARTED | M08-T01         | Stable-ID allocator and insert command                               |
| M08-T03 | NOT_STARTED | M08-T02         | Delete, slot move, and ordered reorder commands                      |
| M08-T04 | NOT_STARTED | M08-T02–M08-T03 | Prop, style-part, condition, and variant editing commands            |
| M08-T05 | NOT_STARTED | M08-T02         | State declaration and binding editing commands                       |
| M08-T06 | NOT_STARTED | M08-T05         | Event and closed-action editing commands                             |
| M08-T07 | NOT_STARTED | M08-T01–M08-T06 | Authoring isolation and unknown-extension round-trip preservation    |
| M08-T08 | NOT_STARTED | M08-T01         | Persistence port and local source adapter                            |
| M08-T09 | NOT_STARTED | M08-T03–M08-T07 | Continuous validation and invalid-node mapping                       |
| M08-T10 | NOT_STARTED | M08-T01–M08-T09 | React/DOM boundary, stable identity, and deterministic command tests |
| G08     | NOT_STARTED | M08-T01–M08-T10 | UI-independent editor core produces valid sources                    |

## M09 — Desen App Web MVP

| ID      | Status      | Depends on               | Deliverable / evidence                                                          |
| ------- | ----------- | ------------------------ | ------------------------------------------------------------------------------- |
| M09-T01 | NOT_STARTED | G08                      | Desen App shell and project navigation                                          |
| M09-T02 | NOT_STARTED | M09-T01                  | Catalog-driven component panel and layer tree                                   |
| M09-T03 | NOT_STARTED | M09-T01, G05             | Canvas uses the exact React adapters used by the reference host                 |
| M09-T04 | NOT_STARTED | M09-T03                  | Selection overlays remain outside capability subtrees; no private-DOM authoring |
| M09-T05 | NOT_STARTED | M09-T02–M09-T03          | Schema-driven primitive/enum inspector controls                                 |
| M09-T06 | NOT_STARTED | M09-T05                  | Nested-object controls and honest structured-JSON fallback                      |
| M09-T07 | NOT_STARTED | M09-T02–M09-T06          | Named-slot drop, move, reorder, cardinality, and acceptance UI                  |
| M09-T08 | NOT_STARTED | M09-T05                  | Local state and binding editor UI                                               |
| M09-T09 | NOT_STARTED | M09-T08                  | Sign-in event and closed-action editor UI                                       |
| M09-T10 | NOT_STARTED | M09-T03, M09-T08–M09-T09 | Design/Run modes on the same source tree                                        |
| M09-T11 | NOT_STARTED | M09-T10                  | Fixtures, scenarios, and visible approximate-fidelity disclosure                |
| M09-T12 | NOT_STARTED | M09-T01, M08-T08         | Save/open UI through editor persistence port                                    |
| M09-T13 | NOT_STARTED | M09-T04–M09-T11          | Node-linked diagnostics and selectable invalid placeholders                     |
| M09-T14 | NOT_STARTED | M09-T10–M09-T13, G07     | Publish to control plane and reference-host channel activation                  |
| G09     | NOT_STARTED | M09-T01–M09-T14          | User authors, tests, saves, and publishes sign-in visually                      |

## M10 — First end-to-end proof

| ID      | Status      | Depends on      | Deliverable / evidence                                                        |
| ------- | ----------- | --------------- | ----------------------------------------------------------------------------- |
| M10-T01 | NOT_STARTED | G09             | Empty-project-to-sign-in browser E2E                                          |
| M10-T02 | NOT_STARTED | M10-T01         | Input and pending fixture test                                                |
| M10-T03 | NOT_STARTED | M10-T02         | Failure fixture and visible failure-state test                                |
| M10-T04 | NOT_STARTED | M10-T02         | Success fixture, navigation, and real host-operation binding test             |
| M10-T05 | NOT_STARTED | M10-T03–M10-T04 | Label/layout change published and activated without host source change        |
| M10-T06 | NOT_STARTED | M10-T05         | Invalid prop/event/slot publication rejected with node-linked diagnostics     |
| M10-T07 | NOT_STARTED | M10-T05, G07    | Corrupt revision and catalog mismatch preserve last-known-good                |
| M10-T08 | NOT_STARTED | M10-T01–M10-T07 | One-command seed/reset and repeatable sign-in demo runbook                    |
| M10-T09 | NOT_STARTED | M10-T08         | Record committed `packages/runtime-core` tree hash as M11 comparison baseline |
| G10     | NOT_STARTED | M10-T01–M10-T09 | Complete no-manual-reimplementation proof passes and core baseline is frozen  |

## M11 — Capability extensibility proof

Map and Sortable branches may proceed independently after G10. Each branch compares against the
exact runtime-core tree hash captured by M10-T09.

| ID      | Status      | Depends on       | Deliverable / evidence                                        |
| ------- | ----------- | ---------------- | ------------------------------------------------------------- |
| M11-T01 | NOT_STARTED | G10              | Map capability contract in a separate package                 |
| M11-T02 | NOT_STARTED | M11-T01          | Real map provider behind adapter boundary                     |
| M11-T03 | NOT_STARTED | M11-T01–M11-T02  | Store resource and schema-bound marker data                   |
| M11-T04 | NOT_STARTED | M11-T02–M11-T03  | `fitBounds` command bridge                                    |
| M11-T05 | NOT_STARTED | M11-T03–M11-T04  | Map fixtures, slots, visual states, and style parts           |
| M11-T06 | NOT_STARTED | M11-T05          | Map integration core-tree hash equals M10-T09 baseline        |
| M11-T07 | NOT_STARTED | M11-T06          | Map surface authored and published in Desen App               |
| M11-T08 | NOT_STARTED | G10              | Sortable behavior contract in a separate package              |
| M11-T09 | NOT_STARTED | M11-T08          | Real drag-and-drop adapter behind behavior boundary           |
| M11-T10 | NOT_STARTED | M11-T08–M11-T09  | Task resource and repeated task presentation                  |
| M11-T11 | NOT_STARTED | M11-T09–M11-T10  | Reorder event payload and host operation                      |
| M11-T12 | NOT_STARTED | M11-T11          | Sortable integration core-tree hash equals M10-T09 baseline   |
| M11-T13 | NOT_STARTED | M11-T07, M11-T12 | Second surface uses existing capabilities with no screen code |
| M11-T14 | NOT_STARTED | M11-T13          | Version mismatch and invalid behavior-attachment diagnostics  |
| G11     | NOT_STARTED | M11-T01–M11-T14  | Complex capabilities prove extension boundary                 |

## M12 — Evidence report and public-alpha preparation

| ID      | Status      | Depends on      | Deliverable / evidence                                                                                                                  |
| ------- | ----------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| M12-T01 | NOT_STARTED | G11             | Every mandatory and recommended BCP 14 clause updated to TESTED or justified status                                                     |
| M12-T02 | NOT_STARTED | M12-T01         | Proof Matrix generated from test and artifact results                                                                                   |
| M12-T03 | NOT_STARTED | G11             | Data-only, no-eval, no-executable-markup, and no-remote-code-selection checks                                                           |
| M12-T04 | NOT_STARTED | G11             | Secret and personal-data fixture audit                                                                                                  |
| M12-T05 | NOT_STARTED | G11             | Bundle, node, depth, repeat, predicate, action, and settlement limits measured                                                          |
| M12-T06 | NOT_STARTED | G11             | Public TSDoc and package README audit                                                                                                   |
| M12-T07 | NOT_STARTED | M12-T06         | Compatibility documentation and Desen App-independent integration quickstart                                                            |
| M12-T08 | NOT_STARTED | M12-T01–M12-T07 | Final validation, conformance-target, and implementation report                                                                         |
| M12-T09 | NOT_STARTED | M12-T08         | Public-alpha demo runbook and release-candidate inventory                                                                               |
| M12-T10 | NOT_STARTED | M12-T07–M12-T09 | Versioned DESEN Developer Platform content for `desen.run`, including a byte-identical protocol 0.1.0 mirror with checksum verification |
| M12-T11 | NOT_STARTED | M12-T07         | Public `desen` facade with documented subpath exports and a functional CLI rather than placeholder entry points                         |
| M12-T12 | NOT_STARTED | M12-T10–M12-T11 | `npm pack` artifacts pass fresh-consumer install/import/CLI smoke tests and declared compatibility checks                               |
| M12-T13 | NOT_STARTED | M12-T08–M12-T12 | Final external-release checklist requiring explicit approval before domain deployment, npm publication, push, or release creation       |
| G12     | NOT_STARTED | M12-T01–M12-T13 | Repeatable Web–React public alpha artifacts are ready for explicit external release approval                                            |
