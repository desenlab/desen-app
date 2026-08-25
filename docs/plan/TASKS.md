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

## Operational and infrastructure work — excluded from the 145 implementation-task count

| ID     | Status      | Depends on                           | Deliverable                                                                                                                                       | Evidence                                                           |
| ------ | ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| CI-01  | DONE        | M04-T02, explicit user authorization | Secure single-pass CI orchestration that preserves every proof while removing recursive repetition                                                | `docs/proof/baselines/ci-01-single-pass.json`                      |
| I07-01 | DONE        | M07-T01, explicit user authorization | Current-reader checkpoint, machine-enforced cleanup register, and a non-authoritative `SHADOW + EXHAUSTIVE` modular candidate                     | `docs/proof/baselines/i07-01-modular-proof-shadow.json`            |
| I07-02 | DONE        | I07-01                               | Exact legacy/modular equivalence, shared-state classification, and required-CI cutover to `REQUIRED + EXHAUSTIVE` execution                       | `docs/proof/baselines/i07-02-required-exhaustive-equivalence.json` |
| I07-03 | DONE        | I07-02                               | Fail-closed `SHADOW + AFFECTED` selector with complete tracked-path ownership, unknown-to-exhaustive fallback, and a frozen observation threshold | `docs/proof/baselines/i07-03-affected-selector-shadow.json`        |
| I07-04 | DONE        | I07-03                               | Promote proven PR selection, retain exhaustive main/release/manual coverage, and remove all G07-due current-reader compatibility shims            | `docs/proof/baselines/i07-04-affected-selector-promotion.json`     |
| I07-05 | NOT_STARTED | I07-04                               | Retire the legacy sequential runner only after rollback, failure, cancellation, hosted, and zero-reference gates pass                             | `docs/proof/baselines/i07-05-legacy-retirement.json`               |

`CI-01` temporarily precedes `M04-T03` in the working order but does not change the protocol task
dependency graph, milestone totals, or proof-gate counts. It must keep the existing task-specific
commands available, run every frozen-snapshot, proof-artifact, negative, mutation, and boundary
check from fresh inputs, and must not trust path filters or cached proof success.

`I07-01` and `I07-02` preceded `M07-T02` in the working order without changing the 145-task
implementation total or proof-gate counts. Both infrastructure tasks are complete. I07-02 froze
and proved the 130-workload, 61-proof-pair cutover baseline. The historical M07-T09 successor
contained 146 workloads and 69 proof pairs. At the M07-T11 checkpoint, its working-tree successor
contained 150 workloads and 71 proof pairs as `REQUIRED + EXHAUSTIVE`; neither successor rewrote that frozen
cutover evidence. Its 60 ordinary pairs and 11 exclusive barriers project to 479 legacy
prerequisite segments, 3,113 ordered leaf invocations, and 236 distinct leaf workloads. The retained
sequential runner is available only through explicit manual `legacy-rollback`. Exact cutover
workload, result, cancellation, tracked-workspace, hosted, and shared-state equivalence remains
archived in the unchanged I07-02 baseline. M07-T09, M07-T10, M07-T11, and I07-03 are `DONE`.
G07 and I07-04 are `DONE`. The authenticated campaign completed `20 / 20` comparisons with zero
false negatives; cleanup PR 36 removed every G07-due bridge and passed fresh
`REQUIRED + EXHAUSTIVE` execution, the landed main revision passed another fresh exhaustive run,
and PR 37 proved the promoted fresh `REQUIRED + AFFECTED` strict subset. No standalone hosted
M07-T11 completion result is claimed. Exact identities are recorded in the I07-04 baseline.

At its checkpoint, I07-03 left the exact `REQUIRED + EXHAUSTIVE` runner unchanged as the sole
pass/fail authority and added a separate pull-request-only `SHADOW + AFFECTED` observation job. Exact ownership covered
the complete tracked path set. Unknown, ambiguous, untrusted, policy, dependency, frozen-input,
unowned-path, incomplete-diff, or unsupported changes expanded to `EXHAUSTIVE`. A strict subset still
ran every selected workload from fresh inputs and could not reuse cached proof success. The frozen
promotion threshold required zero false negatives, mutation coverage for every selector category,
and at least 20 consecutive eligible same-revision hosted strict-subset affected/exhaustive
comparisons. The independently authenticated campaign reached `20 / 20` with zero false negatives;
the promoted REQUIRED authority, sequence-28 checkpoint cleanup, and hosted cutover evidence are
complete. The exact GitHub run/job/revision/receipt provenance is pinned in the I07-04 baseline.
The pure I07-03 ledger measures threshold arithmetic but cannot itself authorize promotion from
caller-supplied data. Fresh `EXHAUSTIVE` verification remains mandatory on `main` and manual
audits, including the release process routed through those authorities. At the I07-03 bootstrap
checkpoint, the frozen baseline selector was pinned at
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f` and its historical
comparison authority contained 20 sources. The pre-promotion M07-T11 successor selector digest was
`sha256:ee0cda5b4871ce2e169a958eefd60299197dbf261c0163335cd759e814067dbf`. The hosted bootstrap
succeeded, while the shadow correctly returned
`NOT_ELIGIBLE → EXHAUSTIVE` with `UNSUPPORTED_CHANGE_KIND`; this was not an eligible strict-subset
observation, so the counter was `0 / 20` at that checkpoint. The subsequent independently
authenticated I07-04 campaign reached `20 / 20` with zero false negatives; the promoted comparison
authority and hosted cutover are `DONE`. The authoritative bootstrap Quality gate passed. Local
evidence is 91/91 focused contracts and 203/203 CI-infrastructure tests. The full local
`REQUIRED + EXHAUSTIVE` run is `BLOCKED_BY_LOCAL_SANDBOX` because `127.0.0.1` listen returned
`EPERM` in two pre-existing control-plane TCP lifecycle cases; the hosted gate passed the same
repository authority. Exact hosted run and job identifiers live in the
[I07-03 baseline](../proof/baselines/i07-03-affected-selector-shadow.json). `DEBT-I07-017` assigns
the shadow-only job, wrapper, and test wiring to I07-04 for removal by G07.

Every temporary compatibility reader, receipt bridge, legacy runner, or shadow-only component
created or retained by this migration must have an exact owner, removal trigger, deadline, and
closure check in `docs/plan/DEBT-REGISTER.md`. I07-04 must close every G07-due entry before G07 may
close. I07-05 owns the later sequential-runner retirement and must close its G12-due entry before
G12 may close. A generic “clean up later” note is not an acceptable owner.

## M02 — Protocol package and validator

| ID      | Status | Depends on      | Deliverable / evidence                                                                                                 |
| ------- | ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| M02-T01 | DONE   | M01-T07         | Checksum-verified upstream 0.1.0 snapshot vendored read-only; P-01 evidence                                            |
| M02-T02 | DONE   | M02-T01         | 269 prose traces and all 989 schema constraints assigned to exact owner/test tasks; deterministic checker and artifact |
| M02-T03 | DONE   | M02-T01–M02-T02 | Types generated from or mechanically checked against JSON Schema                                                       |
| M02-T04 | DONE   | M02-T01         | RFC 8785-compatible canonicalization and SHA-256 golden tests                                                          |
| M02-T05 | DONE   | M02-T03         | Stable diagnostic model and JSON Pointer support                                                                       |
| M02-T06 | DONE   | M02-T03–M02-T05 | Source, Bundle, Catalog, and embedded-schema structural validation                                                     |
| M02-T07 | DONE   | M02-T06         | Identity, SemVer, entry, catalog namespace, extension, and reference validation                                        |
| M02-T08 | DONE   | M02-T07         | Component prop, slot, style-part, and visual-state contract validation                                                 |
| M02-T09 | DONE   | M02-T07         | Event, command, behavior attachment, conflict, and payload-contract validation                                         |
| M02-T10 | DONE   | M02-T07         | State, predicate, repeat, alias, and static binding validation                                                         |
| M02-T11 | DONE   | M02-T10         | Resource, operation, action, navigation, and command-target validation                                                 |
| M02-T12 | DONE   | M02-T04–M02-T11 | TypeScript parity for official 14-case suite: 9 vectors + 5 examples                                                   |
| M02-T13 | DONE   | M02-T08–M02-T12 | Positive and negative project micro-vectors for every validator-owned diagnostic                                       |
| G02     | DONE   | M02-T01–M02-T13 | Validator baseline and declared validator-scope coverage pass                                                          |

## M03 — Catalog SDK and reference capability package

| ID      | Status | Depends on       | Deliverable / evidence                                                                                                      |
| ------- | ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| M03-T01 | DONE   | G02              | Framework-neutral JSON manifest/contract registration API with no React or platform types                                   |
| M03-T02 | DONE   | M03-T01          | Behavior, operation, and resource registration APIs                                                                         |
| M03-T03 | DONE   | M03-T01          | Manifest-authoritative TypeScript and inspector-control derivation                                                          |
| M03-T04 | DONE   | M03-T02          | Documented deterministic Web–React package digest profile and immutability tests                                            |
| M03-T05 | DONE   | M03-T01          | Accessible Stack and Text capabilities with catalog contracts                                                               |
| M03-T06 | DONE   | M03-T01, M03-T05 | Accessible TextField, Button, and Alert capabilities with catalog contracts                                                 |
| M03-T07 | DONE   | M03-T02          | Token provider and synthetic fixture infrastructure                                                                         |
| M03-T08 | DONE   | M03-T06–M03-T07  | Sign-in success/failure fixtures and separate host operation binding                                                        |
| M03-T09 | DONE   | M03-T04–M03-T08  | Catalog/implementation parity metadata, event payload, command, and accessibility contract tests                            |
| M03-T10 | DONE   | M03-T03–M03-T09  | Build final capability artifact and exact tuple; same bytes yield same digest and any byte change yields a different digest |
| G03     | DONE   | M03-T01–M03-T10  | Exact reference catalog and immutable artifact tuple resolve complete contracts; React adapter registration remains in M05  |

## M04 — Framework-neutral runtime core

| ID      | Status | Depends on               | Deliverable / evidence                                                                                                                                                                                          |
| ------- | ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M04-T01 | DONE   | G03                      | Host ports for navigation, storage, operations, resources, tokens, environment, clock, diagnostics                                                                                                              |
| M04-T02 | DONE   | M04-T01                  | Literal/reference/fallback resolver for state, context, resource, operation, event, item, and env                                                                                                               |
| M04-T03 | DONE   | M04-T02                  | Token and deterministic string-format resolution                                                                                                                                                                |
| M04-T04 | DONE   | M04-T02                  | Predicate evaluation and conditional presence                                                                                                                                                                   |
| M04-T05 | DONE   | M04-T03–M04-T04          | Ordered variant and style override evaluation                                                                                                                                                                   |
| M04-T06 | DONE   | M04-T02                  | Local state lifecycle, schema-safe writes, and stable node identity                                                                                                                                             |
| M04-T07 | DONE   | M04-T02, M04-T06         | Repeat scopes, aliases, keys, instance identity, and limits                                                                                                                                                     |
| M04-T08 | DONE   | M04-T02–M04-T03          | Resource mount/once/manual lifecycle and refresh                                                                                                                                                                |
| M04-T09 | DONE   | M04-T02                  | Operation lifecycle and reject/replace/queue concurrency                                                                                                                                                        |
| M04-T10 | DONE   | M04-T03–M04-T04, M04-T06 | `state.set`, `state.toggle`, and `navigate` actions                                                                                                                                                             |
| M04-T11 | DONE   | M04-T08–M04-T10          | `operation.invoke` settlement actions and `resource.refresh`                                                                                                                                                    |
| M04-T12 | DONE   | M04-T10                  | `component.command` and allowlisted, schema-validated `event.emit`                                                                                                                                              |
| M04-T13 | DONE   | M04-T10–M04-T12          | Action-turn, settlement-depth, and repeated-transition limits                                                                                                                                                   |
| M04-T14 | DONE   | M04-T07, M04-T12         | Generic component/behavior event and command bridges with payload validation                                                                                                                                    |
| M04-T15 | DONE   | M04-T05–M04-T14          | Reactive re-evaluation and stale asynchronous-result protection                                                                                                                                                 |
| M04-T16 | DONE   | M04-T03–M04-T15          | Headless sign-in determinism and JSON-serializable observable trace tests                                                                                                                                       |
| M04-T17 | DONE   | M04-T16                  | G04 audit hardening: authenticated session-completion notification, generic nested-settlement publication, exact-location proof validation, N-026/N-029 correction migration, and deterministic fault injection |
| G04     | DONE   | M04-T01–M04-T17          | Framework-neutral sign-in runtime and post-audit hardening pass                                                                                                                                                 |

`M04-T16` remains a valid historical proof of the exact frozen sign-in profile. `M04-T17` reclosed
`G04` after the audit found that the initial profile observed its official operation promise
directly and did not yet prove generic publication after every internally nested settlement. The
gate returned to `DONE` after all of the following were proven:

- one factory-authenticated internal completion notice covers every accepted T13 settlement turn,
  and the session publishes the resulting current T15 observation without a sign-in-specific
  promise hook;
- proof checks bind each corrected status and completion claim to its exact file, heading, table
  row, field, and task owner, rejecting duplicates, moved text, and substring-only matches;
- the current `N-026` and `N-029` corrections remain distinct from immutable task-time artifacts,
  while `M05-T02` and `M05-T03` retain final receiving-schema ownership; and
- deterministic fault injection covers notification admission, nested success/failure,
  replacement and stale settlement, callback reentry, finalization, disposal, and failed
  publication without partial or duplicate observation.

With `M04-T17` complete and `G04` closed again, M05 may now begin in dependency order.

## M05 — React runtime and separate reference host

| ID      | Status | Depends on       | Deliverable / evidence                                                                             |
| ------- | ------ | ---------------- | -------------------------------------------------------------------------------------------------- |
| M05-T01 | DONE   | G04              | React adapter registry and render-plan renderer                                                    |
| M05-T02 | DONE   | M05-T01          | Resolved props and named slots wired without private structure inspection                          |
| M05-T03 | DONE   | M05-T01–M05-T02  | Style parts and visual states wired through public adapter contracts                               |
| M05-T04 | DONE   | M05-T01–M05-T03  | Component events, commands, and behavior adapters wired                                            |
| M05-T05 | DONE   | M05-T02–M05-T04  | Stable keys and runtime-node ↔ source-node diagnostics                                             |
| M05-T06 | DONE   | M05-T05          | Error boundaries and explicit failure for unknown capabilities; no production placeholder guessing |
| M05-T07 | DONE   | M05-T01, M05-T06 | Independently built reference-host shell with host ports                                           |
| M05-T08 | DONE   | M05-T04–M05-T07  | Official sign-in bundle running through real adapters                                              |
| M05-T09 | DONE   | M05-T07–M05-T08  | Automated source/import audit preventing handwritten managed-screen composition                    |
| G05     | DONE   | M05-T01–M05-T09  | Bundle-driven sign-in runs in separate host                                                        |

`M05-T01` creates a finite, factory-authenticated static React adapter registry and an
all-or-nothing public headless-plan renderer. Ordinary roots and descendants use the same exact
capability lookup. The renderer resolves the complete node/slot/behavior graph before an adapter
component executes; malformed own-data boundaries, forged handles, duplicate identities, unknown
component or behavior capabilities, and lower-only limit crossings return explicit callback-free
failures with no placeholder element. Adapter JSON is accessor-free, detached, deeply frozen, and
aggregate-bounded; revoked proxies fail closed and every named slot consumes finite budget.
Standalone plan provenance remains a host responsibility, while `M05-T02` now owns exact Catalog
receiving-schema validation for resolved props and named-slot delivery.

`M05-T03` applies the same exact Catalog-authenticated receiving scope to every final component
and behavior style map before any React element is created. Adapters receive only a detached,
recursively immutable visual-state → semantic-part → property map whose declared states, parts,
and complete resolved property values pass their exact prepared Catalog schemas. Validation work
shares the existing render-wide lower-only budgets. The runtime preserves the complete map but
never selects or merges active states, creates CSS, inspects DOM/private component structure, or
interprets property names; production state activation and target translation remain capability
adapter responsibilities.

`M05-T04` authenticates the complete render plan against the exact current session binding
inventory before creating React elements, then commit-gates each adapter's interaction port.
Component and behavior events enter only through the exact captured session, snapshot, and runtime
identity. A committed component may attach one opaque command owner to its current binding;
supersession, binding replacement, navigation, unmount, and disposal revoke that authority, while
behaviors never receive component-command authority. The separately imported reference adapter
subpath maps all five static components field by field, implements the Catalog's only declared
`focus` command, forwards only inert `change` and `press` payloads, and exposes no DOM, native
event, arbitrary React prop, or dynamic loader. Its changed `dist/**` bytes produce a successor
package digest while every M03 artifact remains byte-identical historical evidence.

`M05-T05` observes authenticated headless-session publications through React's external-store
lifecycle, then re-runs complete renderer authentication for every exact successor snapshot.
Session-and-registry-scoped private roots prevent compatible public identities from leaking state
between executable authorities. Trusted `remountOnProps` metadata produces presence-aware RFC 8785
keys without letting Bundle or Catalog data control remount policy. The same all-or-nothing
preflight builds a bounded, callback-free runtime/source/behavior diagnostic index with sorted
one-to-many inverse lookups.

`M05-T06` composes controlled preflight failures and committed adapter exceptions through a
mandatory host-owned failure renderer. Unknown capabilities never execute an adapter or select a
placeholder. Safely attributable leaf-component crashes retain only frozen diagnostic identity;
behavior, non-leaf, descendant-removal, and otherwise ambiguous failures use null identity rather
than blaming a live ancestor. Containment is whole-surface, retry requires an explicit host
`recoveryKey`, and persistent managed/host sibling boundaries preserve cleanup provenance during
branch transitions. A dedicated DESEN React root may suppress raw React 19 caught-error telemetry
with the exported no-inspection policy; root unmount, event, async, and SSR error policy remains
host-owned.

`M05-T07` builds the Web-only reference host independently with React 19 and zero-configuration
Vite 8. Its browser authority captures all nine host ports and fourteen callbacks without
invocation. Root activation succeeds only after exact session-to-host-port identity, exact current
snapshot/Catalog authority, matching Web-host document/revision authority, and the factory-created
executable registry all authenticate. One transaction fence closes replacement, retry, and disposal reentry; an uncaught root failure
terminally revokes session and host authority before emitting only a fixed redacted diagnostic.
Recovery changes only for explicit retry or exact session, registry, Catalog, or host replacement.
Desen App, editor, publisher, testkit, and facade imports are forbidden. The task does not claim
official sign-in execution or the final no-handwritten-tree audit; those remain M05-T08 and
M05-T09.

`M05-T08` derives a controlled Source and Bundle from the frozen official sign-in example by
changing only the current exact reference-Catalog requirement and recalculating the Source digest
and Bundle revision; managed surfaces remain canonically identical. The independent host mounts
that Bundle with the shared five-component React registry and a fixed-capability same-origin
`/api/sign-in` binding. Exact document/revision, source surface, capability, alias, effect,
destination, and empty navigation params are fail-closed host policy. React/jsdom DOM integration
tests prove controlled input, pending state, declared failure, edited retry, success, navigation,
rapid pending-press suppression, rejected-handler redaction, disposal, and same-document
session/host replacement with late-result containment. A persisted `pagehide` preserves the
composition for BFCache restoration, while final page exit disposes it. Started transports are not
claimed cancellable, the fixture is not claimed as M06 Publisher output, real-browser BFCache E2E
is not claimed, and, at M05-T08 task time, M05-T09 still owned the exhaustive
no-handwritten-managed-tree AST and resolved-import audit.

`M05-T09` closes G05 with three independent views of the current production boundary. A
TypeScript parser/checker audit resolves JSX tags, import aliases, namespaces, and symbol origins
across every dynamically discovered reference-host source file; the complete-source JSX policy
and exact composition fingerprints reject helper-hidden trees. Two programmatic Vite 8
production builds observe the real resolved module graph and require every host source to be
reachable, while local graph backing files remain byte-and-identity stable and dependency-cruiser
independently enforces one authenticated application/package rule. Exact host-infrastructure JSX
and the current executable-call/property-write authority surface are allowlisted; direct or hidden
reference-component trees, React factory bypasses, structural render plans,
capability/source-node selection, indirect executable extraction, DOM replacement, HTML/PostCSS
or stylesheet visual injection, private or forbidden transitive package paths, authoring Source
data, orphan modules, symlinks, and unknown assets fail closed under hostile mutation. The managed
path reaches only the public generic runtime renderer and shared public adapter factory. This
advances P-07 to `PARTIAL` and strengthens P-06/P-10 without completing their later Desen App
evidence.

## M06 — Deterministic publisher

| ID      | Status | Depends on       | Deliverable / evidence                                                                  |
| ------- | ------ | ---------------- | --------------------------------------------------------------------------------------- |
| M06-T01 | DONE   | G05              | Staged `PublishResult` and diagnostics API                                              |
| M06-T02 | DONE   | M06-T01          | Exact catalog resolution, package immutability, and namespace-conflict checks           |
| M06-T03 | DONE   | M06-T02          | Source, embedded-schema, identity, entry, and static-reference preflight                |
| M06-T04 | DONE   | M06-T03          | Prop, slot, style, event, command, and behavior preflight                               |
| M06-T05 | DONE   | M06-T04          | Resource/operation contracts, dynamic compatibility, and runtime obligations            |
| M06-T06 | DONE   | M06-T03–M06-T05  | Extension preservation, array-order preservation, and source-node identity traceability |
| M06-T07 | DONE   | M06-T06          | Source digest, authoring removal, and deterministic normalization                       |
| M06-T08 | DONE   | M06-T02, M06-T07 | Source-digest authentication/carry and exact package tuple pinning                      |
| M06-T09 | DONE   | M06-T08          | Bundle validation and revision calculation                                              |
| M06-T10 | DONE   | M06-T09          | Official source-to-bundle golden and double-publish determinism tests                   |
| M06-T11 | DONE   | M06-T03–M06-T10  | Invalid-source matrix proves no bundle is emitted                                       |
| G06     | DONE   | M06-T01–M06-T11  | Valid source publishes; invalid source emits no bundle                                  |

M06-T01 defines the Publisher's closed terminal success/failure union, exact sixteen-stage
vocabulary, stable task-owned diagnostic definitions, and strict package-private raw Source JSON
boundary. Success is reserved for a complete immutable Bundle plus warnings; failure starts with a
blocking error, identifies the stopped stage, and structurally exposes no Bundle or partial parsed
value. Duplicate decoded names, invalid Unicode, non-finite numbers, malformed syntax, and bounded
ingress exhaustion fail with controlled redacted diagnostics. Lazy JSON Pointer paths, hostile
limit profiles, source and built declaration checks, package-entry verification, derived test
inventory, deterministic evidence, and atomic-write mutations protect the boundary. This task
emits no Bundle and changes no Proof Matrix claim, normative status, or gate; M06-T02 owns exact
Catalog resolution next.

M06-T02 now resolves every already validated Source Catalog requirement against one closed,
caller-supplied package-observation inventory by exact `id`, `version`, and optional `target`.
Discovery locations, candidate order, SemVer ranges, Unicode normalization, and equal Catalog JSON
cannot create authority. Missing or ambiguous requirements fail before Catalog inspection; every
unique selection then crosses bounded inert capture, frozen structural validation, exact
candidate/Catalog tuple and observed-digest consistency, and one immutable set-wide capability
namespace. Duplicate Source requirements retain their own positions while sharing one uniquely
selected package. All failures use the M06-T01 no-Bundle shell and expose no candidate index,
partial Catalog set, selected tuple, or Bundle. The package observation is explicitly preverified
input rather than a claim that this data-only stage hashed arbitrary package bytes. Twenty-two
focused runtime cases, ten compiler-negative cases, eight independent proof/mutation cases, four
pinned prerequisites, and the reviewed single-pass CI inventory protect the boundary. `PF-061`
records the trust and target-omission profile. No Proof Matrix claim, normative status, or gate
changes; M06-T03 owns complete Source preflight next.

M06-T03 now composes strict raw JSON ingress, exact Source-root validation, all embedded state
schemas, catalog-independent Source identity and entry semantics, M06-T02 Catalog authority, and
category-aware component, behavior, resource, and nested-operation references into one immutable
package-private preflight result. Root, embedded, and intrinsic semantic failures retain distinct
stopped stages; Catalog candidates remain unobserved until Source-local checks pass. Catalog-backed
references run only after a valid, digest-consistent, namespace-clean Catalog authority exists.
Under-budget T01/T02 failures pass through unchanged, while the common diagnostic ceiling replaces
an inherited over-budget report with one redacted error at the same stage. Every failure exposes no
Source, Catalog set, package, alignment, partial value, or Bundle. Ten focused Publisher cases,
sixteen compiler-negative cases, four Validator-foundation cases, ten independent proof/mutation
cases, four prerequisite pins, twenty tracked files, and the reviewed single-pass CI inventory
protect the boundary. `PF-062` records the phase and authority ordering. No Proof Matrix claim,
normative status, or gate changes; M06-T04 owns capability contracts next.

M06-T04 now upgrades the exact M06-T03 authorities through the Validator's component and
interaction contract preparation before checking every statically knowable component prop,
Variant prop, slot, accepted child, style, visual state, event, command, behavior prop, behavior
slot, behavior style, attachment, and conflict rule. Static failures stop at
`capability-contracts`, suppress warning discovery, retain exact Validator diagnostics, and expose
no Source, Catalog, package, alignment, dynamic obligation, partial value, or Bundle. Successful
preflight preserves the exact authenticated Source and selected package authority, carries only
safe deterministic deprecated-capability warnings, and remains package-private and nonterminal.
Inherited optional data and success discriminators cannot fabricate traversal or authority, and
the shared finite report profile fails closed without truncating warnings. Fourteen focused
Publisher cases, twenty compiler-negative cases, eighty-five focused Validator cases, fifteen
independent proof/mutation cases, four prerequisite pins, and thirty-three tracked files protect
the boundary. `PF-063` records why M06-T04 completes only the static component/interaction slice of
publication step 8. No Proof Matrix claim, normative status, or gate changes; M06-T05 owns
resource/operation receiving contracts, dynamic binding compatibility, and recorded runtime
obligations next.

M06-T05 now runs M06-T04 internally and upgrades only its exact authenticated Source, selected
package, Catalog, requirement-alignment, and warning authorities. Resource and operation schemas,
resource policies, and statically known resource/operation/component-command inputs stop at
`capability-contracts`; predicate, repeat, state-write, navigation, refresh, operation-alias, and
command-target failures stop at `state-and-control-flow`; lexical, format, lifecycle, and other
provable binding failures stop at `binding-compatibility`. Validator assigns that phase at each
diagnostic emission site, so Publisher neither repeats the cumulative walk nor guesses a stage
from a code or pointer. Simultaneous failures retain the exact 8 → 9 → 10 precedence.

A complete success preserves the exact T04 authorities and warnings while adding the exact
execution Catalog authority plus all normalized dynamic obligations. The eight-kind vocabulary is
closed, sorted, deduplicated, deeply frozen, and excludes future operation/resource outputs. The
project-owned envelope admits 4,096 obligations, 4,096 UTF-16 units in one pointer, and 1,048,576
aggregate obligation/context units; a crossing rejects at `binding-compatibility` without
truncation or partial authority. Fourteen focused Publisher cases, twenty-eight compiler-negative
cases, one hundred focused Validator cases, fifteen independent proof/mutation cases, three
prerequisite pins, and thirty-five tracked files protect the boundary. `PF-063` records the
completed T04/T05 step-8 split, while `PF-064` records emission-site phase provenance and warning
suppression. The Publisher-side runtime-obligation part completes the composed `N-027` evidence.

M06-T06 now composes M06-T05 internally and carries its exact Source, execution Catalog, package
selection, requirement alignment, warning, and obligation authorities without accepting a
caller-reconstructed intermediate. A separate frozen production-field projection preserves every
Source-reachable opaque extension and semantic Source array by exact parsed runtime reference while
leaving top-level authoring intact on the authenticated Source for the next task. The complete
component-node trace uses unchanged identifiers and exact RFC 6901 pointers, treats identity as
surface-scoped, and grants no behavior, extension, authoring, Catalog, executable, runtime, host, or
platform authority. The same node id may therefore remain traceable on different surfaces without
being falsely rejected.

The additional finite envelope admits 25,000 trace records, 4,096 UTF-16 units in one pointer, and
4,194,304 aggregate identity/pointer units; exact boundaries pass and a one-below crossing rejects
the whole intermediate at `normalization` without truncation, inherited warnings, partial
authority, or a Bundle. Fifteen focused Publisher cases, forty-six compiler-negative cases,
eighteen independent proof/mutation cases, three exact prerequisite pins, twenty byte-tracked
files, all sixteen Source-reachable extension kinds, eight semantic-array classes, and the reviewed
single-pass CI registration protect the boundary. `PF-065` records the exact parsed-value versus
raw lexical-byte scope and the broader preservation surface required by `R-107`/`N-021`. The
Publisher half completes `N-021`, which advances to `TESTED`; `N-014` and `N-012` remain open for
their editor owners.

M06-T07 now composes M06-T06 exactly once, calculates `sourceDigest` from the exact authenticated
Source before any publication-specific transformation, removes only the root `authoring` member,
and minimally normalizes one detached production-document base through RFC 8785. The digest helper
omits only root authoring, so authoring-only changes leave both digest and normalized bytes
unchanged while nested extension data remains semantic. Every T06 authority crosses by exact
identity; `sourceDigest` remains a separate success field and never enters the normalized document.

The selected profile inserts no default, removes no empty optional member, creates no hidden
index, and never sorts or deduplicates a semantic array. A 2,097,152-canonical-UTF-8-byte
intermediate envelope accepts the exact boundary and rejects a one-byte crossing atomically.
Digest failures stop at `source-digest`; projection and byte-limit failures stop at
`normalization`; neither exposes warnings, partial authority, or a Bundle. Seventeen focused
Publisher cases, fifty-two compiler-negative cases, twenty-six independently authenticated
proof/mutation cases, two exact prerequisites, eighteen byte-tracked files, and the reviewed
single-pass CI registration protect the boundary. `PF-066` records the minimal profile and the
required digest → authoring-removal → normalization order. At the T07 checkpoint, P-11 advanced
only to `PARTIAL`; P-03, P-05, and G06 remained open, and M06-T08 retained the next integration
ownership for authenticating the digest and pinning exact Catalog tuples.

M06-T08 now composes M06-T07 exactly once, recalculates the digest from the same authenticated
pre-normalization Source, and refuses malformed, thrown, or unequal digest authority at
`source-digest` without silently replacing it. Only after that check does it map every loose
Source requirement position through M06-T02's exact `requirementPackageIndexes` authority.
`id`, `version`, `target`, and `digest` come from the selected immutable package; an omitted Source
target is filled only from that package. Requirement order and duplicates remain positional, so
the independently exercised `A, B, A` input produces indexes `0, 1, 0` and three output tuples.
Discovery `location` remains digest-significant Source data but never becomes tuple or selection
authority; optional requirement extensions cross by exact opaque identity.

The new `pinnedDocument` is recursively immutable and remains package-private and nonterminal. It
adds only `sourceDigest` and exact `requires.catalogs` to the T07 normalized base; `revision`,
`publication`, terminal Bundle success, signing, runtime, host, adapter, activation, and deployment
remain absent. Thirteen focused Publisher cases, fifty-two compiler-negative cases, thirty-seven
independent proof/mutation cases, two exact prerequisite pins, twenty-one tracked files, and twelve
trace-ownership rows protect the boundary. `PF-067` records the positional and discovery-hint
rules. P-05 and P-11 remain `PARTIAL`, P-03 remains `NOT_PROVEN`, and G06 remains open. M06-T09
owns complete Bundle validation, final-size enforcement, and revision closure next.

M06-T09 now exposes the first complete public Publisher operation. It composes M06-T08 exactly
once, calculates a provisional revision from the exact pinned document, adds only `revision`, and
enforces the complete 2,097,152-byte RFC 8785 canonical UTF-8 envelope. The exact candidate and
exact authenticated Catalog set cross the cumulative Bundle execution Validator exactly once. A
success is admitted only when the Validator returns an independent recursively immutable snapshot
whose canonical bytes equal the candidate, whose complete bytes remain within the same ceiling,
and whose embedded revision equals both the provisional value and a fresh closure calculation.

Only that exact Validator Bundle and the exact M06-T08 warnings cross the terminal success
boundary. Every inherited, authority, canonicalization, limit, Validator, or revision failure
retains the closed no-Bundle shell; malformed or shared stage objects and thrown helpers are
contained. The operation adds no publication metadata and performs no signing, storage,
activation, runtime, host, adapter, editor, or deployment work. `PF-068` records the
provisional → validate → recompute revision profile and the local canonical-byte interpretation of
“2 MiB uncompressed.” P-03 remains `NOT_PROVEN` until M06-T10's official double-publication
golden; P-05 and P-11 remain `PARTIAL`; N-016, N-018, and N-041 remain `PLANNED` for their later
owners; and G06 remains open. M06-T10 owns the official source-to-bundle golden next.

M06-T10 adds no production path. It invokes only the public `publishDesenSource` root with two
fresh copies of the frozen official sign-in Source and web Catalog candidate. Both calls produce
separate recursively immutable result graphs with identical 2,173-byte RFC 8785 canonical Bundle
output, revision, and Source digest. Those bytes exactly equal the frozen official Bundle after
removing only its own root `publication` member; every other root and nested member remains part
of the golden.

The proof pins the exact official fixture/vector bytes and direct T09, snapshot,
canonicalization, and official-suite artifacts. It also authenticates the six-case public package
test and rejects shared identities, private-path substitution, extra projection, fixture or
prerequisite drift, canonical-byte mismatch, malformed receipts, unsafe filesystem authority, and
non-atomic evidence output. P-03 and P-11 become `PROVEN`; P-05 remains `PARTIAL`; N-016 and N-018
remain `PLANNED` for their later runtime/editor owners; and G06 remains open for M06-T11's complete
invalid-source/no-Bundle matrix.

`docs/proof/artifacts/publisher-0.1.0-official-golden.json`
`sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`.

M06-T11 closes the public rejection side of publication without adding an alternate Publisher or
private test-only entry point. All 127 reviewed invalid cases call only the built public
two-argument `publishDesenSource` root and stop at their exact earliest naturally reachable stage.
Every failure is a recursively immutable, nonempty, error-first
`{ diagnostics, ok, stage }` result with no Bundle or partial Source, Catalog, package,
normalization, obligation, trace, digest, revision, or publication authority.

The 135 focused cases include eight positive guards for the official golden, dynamic obligations,
exact obligation and final-size boundaries, sanitized deprecation warnings, and deterministic
replay. They prove stage 8 → 9 → 10 precedence, all three blocking-report budgets at the execution
boundary, all three deprecation-warning budgets, inherited parse and Catalog report limits, the
complete Source-trace profile, and the naturally reachable normalization and final-Bundle limits.
The public Publisher registry is now a complete ordered 14-code inventory. Discovery `location`
remains digest-significant Source data but never establishes package trust.

The artifact authenticates 67 independent root proof/mutation cases, 31 exact
task-applicability records, two task-local PF-047 applicability records, 12 trace rows, frozen
fixtures, built public files, and one-way successor hashes. It deliberately invents no public
negative for deterministic `source-digest`, `authoring-removal`, `catalog-pinning`, or
`bundle-revision` stages. The full Publisher suite passes 292/292. P-03 and P-11 remain `PROVEN`;
P-05 and P-17 remain `PARTIAL`; N-016, N-018, N-041, and the Publisher conformance target remain
`PLANNED` for their later owners. M06-T11 and G06 are `DONE`; at that checkpoint M07-T01 owned
immutable content-addressed Bundle storage, whose completed evidence appears below.

`docs/proof/artifacts/publisher-0.1.0-invalid-source-matrix.json`
`sha256:fc5904ea6ec4e6495629fc4de8009fee66155938013068b709dd1ff40c1e98d8`.

## M07 — Atomic activation, last-known-good, and local control plane

| ID      | Status | Depends on              | Deliverable / evidence                                                                                               |
| ------- | ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| M07-T01 | DONE   | G06                     | Content-addressed bundle store with immutable revision entries                                                       |
| M07-T02 | DONE   | M07-T01, I07-02         | Protocol, revision, available source digest, and bundle-size verification                                            |
| M07-T03 | DONE   | M07-T02                 | Exact package target/version/digest resolution and preflight                                                         |
| M07-T04 | DONE   | M07-T02–M07-T03         | Surface/capability reference and finite-limit preflight                                                              |
| M07-T05 | DONE   | M07-T01                 | Local control-plane API for editable sources, immutable bundles, and mutable channel pointers                        |
| M07-T06 | DONE   | M07-T03–M07-T05         | Staged runtime indexes and active/staged state separation                                                            |
| M07-T07 | DONE   | M07-T04, M07-T06        | Durable transactional commit of `{activeRevision, previousGoodRevision, generation}` as one consistent record        |
| M07-T08 | DONE   | M07-T07                 | Restart recovery validates and restores the transactional active/previous-good record                                |
| M07-T09 | DONE   | M07-T07–M07-T08         | Fault injection at fetch, integrity, package resolution, preflight, staging, durable commit, and recovery boundaries |
| M07-T10 | DONE   | M07-T09                 | A → invalid B → valid C, concurrent activation, and restart behavior tests                                           |
| M07-T11 | DONE   | M07-T05, M07-T10        | Control-plane channel consumed by separately built reference host                                                    |
| G07     | DONE   | M07-T01–M07-T11, I07-04 | Every pre-commit fault preserves a valid durable activation record and invalid revision never becomes active         |

M07-T01 adds the built `@desen/control-plane-api` package root and one local POSIX repository that
stores exact complete Bundle bytes under a strict lowercase SHA-256 revision path. The first
writer commits through an exclusive same-shard temporary and no-clobber hard link; identical
retries preserve the inode as `unchanged`, different bytes return `conflict`, and readers receive
fresh copies. Parent-directory flushes, read-only single-link checks, committed-temporary alias
recovery, redacted failure codes, and post-link indeterminate retry semantics make concurrent and
crash-adjacent outcomes explicit.

The official 2,173-byte Publisher golden, a same-revision publication-only conflict, eight equal
writers, divergent writers, pre-link visibility, temporary truncation, hard links, symlinks,
special files, path keys, typed-array brands, hostile inputs, and package-root consumption pass 18
focused cases plus four compiler-negative and 16 independent proof/mutation cases. This proves
storage only; channels, package preflight, activation, last-known-good recovery, and host
consumption remain later M07 tasks. `N-010` remains
`PLANNED` for the remaining M12-T12 packed-distribution evidence; M07-T03 now proves the local
installed-package byte and tuple boundary without claiming external packed-distribution integrity;
`N-019` remains `PLANNED` for M07-T05 control-plane integration, P-12 remains `NOT_PROVEN`, and G07
remains open.

M07-T02 adds a separate built-package integrity verifier over untrusted stored bytes. It enforces
the exact raw and complete RFC 8785 canonical 2 MiB Bundle ceilings with bounded strict JSON,
uses a deterministic fail-fast guard before exhaustive structural validation, validates exact
DESEN 0.1.0 structure, and closes the outer storage key, embedded revision, and independently
recalculated revision. Available Source evidence must be real raw Source bytes and must pass its
own finite parser, raw and canonical 8 MiB ceilings, exact schema, and independent digest
calculation; absence remains explicitly `not-available`.

Success yields only a frozen runtime-authenticated authority containing the immutable Bundle and
safe integrity metadata. Rejections expose a closed stage and redacted diagnostics without raw
bytes, parsed documents, or partial authority. The official golden passes with matched and absent
Source evidence; noncanonical stored JSON, exact limit boundaries, canonical numeric expansion,
publication-preserving same-revision input, malformed UTF-8/JSON, revision mismatches, Source
mismatches, hostile records, shared memory, and forged authority fail or pass at their exact
assigned boundary. At the M07-T02 checkpoint, M07-T03 still owned exact installed-package
preflight; M07-T04 through M07-T11 owned references, channels, activation, recovery, faults, and
host consumption. P-12 remained `NOT_PROVEN`, while `N-038` and `N-041` remained `PLANNED` for
their later activation and limit owners.

Evidence: `docs/proof/CONTROL-PLANE-BUNDLE-VERIFICATION.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json`
`sha256:db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a`.

M07-T03 adds a separate built-package preflight over an authentic M07-T02 integrity authority and
an untrusted installed-package inventory. It matches literal code units for package id and target,
requires one exact SemVer and exactly one physical candidate, preserves duplicate requirement
positions, and grants no trimming, case folding, Unicode normalization, range, newest/best-match,
candidate-order, location, callback, loader, or network authority. The current dispatch table is
deliberately static and supports only `web-react`.

The selected Catalog and its enumerable own-data JSON graph plus every exact attached, nonshared
`Uint8Array` artifact view are synchronously snapshotted under fixed finite ceilings. A generated
first-issue Catalog guard and capability-namespace ambiguity precheck run before exhaustive
validation. The independent Web–React v1 framer then requires the Bundle digest, Catalog
self-digest, and digest calculated from one Catalog plus the 80 actual distribution artifacts to
be identical. Only complete success yields one frozen, runtime-authenticated, byte-free public
authority; package-private snapshots are retained for M07-T04 and later staging work.

The official package tuple, missing/duplicate/newer/alias candidates, historical digest,
Catalog/artifact mutation, hostile records and memory, representative exact/one-over boundaries
plus branch-isolating aggregate tests and explicit dominance evidence for every finite ceiling,
10,000-entry structural fan-outs, forged authority precedence, positional duplicates, and
independent public digest-profile parity are executable evidence. `P-05` becomes `PROVEN`; `N-011`
and `N-020`
become `TESTED`. `N-010`, `N-038`, and `N-041` remain `PLANNED`, P-12 remains `NOT_PROVEN`, and G07
remains open. M07-T04 owns surface/capability reference and whole-activation finite-limit
preflight next; M07-T05 through M07-T11 still own channels, staging, activation, recovery, faults,
and host consumption.

Evidence: `docs/proof/CONTROL-PLANE-PACKAGE-PREFLIGHT.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json`
`sha256:79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628`.

M07-T04 adds one separate bounded pre-staging authority over the exact M07-T03 identity. A
deterministic iterative scan closes entry and navigation surfaces, surface identity, the shared
node/behavior identity namespace, category-correct component/behavior/resource/operation
capabilities, declared events, resource-refresh aliases, command targets/names, and nested
operation settlement programs. Unknown semantics never fall back to placeholders, another
category, similarly spelled ids, dynamic discovery, or executable code.

The immutable Reference Profile enforces all 13 public ceilings without caller overrides or
truncation: 256 surfaces; 25,000 aggregate and 5,000 per-surface source nodes; 5,000 conservatively
possible materialized nodes; zero-based depth 64; 1,000 effective repeat instances; 64 actions per
turn and 25,000 overall; settlement depth 16; predicate arity/expression/aggregate budgets; and
25,000 total reference occurrences. Every ceiling has an executable exact/one-over vector or an
explicit executable dominance proof. Only a successful bounded scan reaches one independent
semantic Validator agreement over the same authenticated snapshots; throws, malformed results,
and canonical-content disagreement become one redacted internal rejection.

Complete success returns only a frozen revision/profile/per-surface audit identity. Bundle,
Catalog, artifacts, obligations, runtime indexes, callbacks, staging, channel, commit, and
activation authority remain absent. M07-T06 owns the parallel staging branch, and M07-T07 must join
the exact T04 and T06 identities. The built official two-surface chain, 22 focused runtime cases,
12 compiler-negative cases, and 16 independent proof/mutation cases pass. P-17 becomes `PROVEN`;
P-12 remains `NOT_PROVEN`; N-038 and N-041 remain `PLANNED` for their later owners. Overall
progress is 78/145, and M07-T05 owns the local editable-Source/immutable-Bundle/channel API next.

Evidence: `docs/proof/CONTROL-PLANE-REFERENCE-PREFLIGHT.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json`
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`.

M07-T05 adds one local fixed-loopback Fastify boundary with explicit bearer authentication and
exact-origin CORS. Editable Source bytes live in SQLite behind monotonic generations and
compare-and-swap writes; stale generations fail without replacing the winner. Exact successful
origins can read the `ETag` generation header. Immutable Bundle routes delegate to the already
proved M07-T01 first-writer-wins repository, while mutable channel pointers expose discovery
metadata only: they do not verify, stage, commit, activate, or confer runtime authority.

Strict JSON, bounded request bodies, stable redacted errors, and SQLite durability keep malformed,
oversized, concurrent, restart, and mutation cases fail closed. The service binds only to its
fixed loopback profile and bounds inactive connections at 5 seconds, complete requests at 15
seconds, and keep-alive at 5 seconds so a partial-body client cannot block shutdown indefinitely.
Native `better-sqlite3` imports are isolated to the exact local-API proof pair, and the production
dependency audit reports no known vulnerability in the reviewed lockfile.

The executable evidence contains 16 focused runtime cases, 18 compiler-negative cases, and 16
independent root proof/mutation cases. The 41,945-byte artifact authenticates the public contract,
transport and persistence implementation, generated distribution, prerequisite receipts, exact
nonclaims, and timeout behavior at
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`.
`N-019` becomes `TESTED`; `P-12` remains `NOT_PROVEN`, `G07` remains open, and `PF-074` remains
`OPEN`. Overall progress is 79/145, and M07-T06 owns staged runtime indexes and active/staged state
separation next.

Evidence: `docs/proof/CONTROL-PLANE-LOCAL-API.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-local-api.json`
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`.

M07-T06 adds one bounded execution-staging branch over the exact opaque M07-T03 package authority.
It independently recloses the retained package bytes, validates execution Catalogs and Bundle
contracts, prepares inert component and behavior action programs, and constructs deterministic
package, capability, surface, source-node, behavior, state, resource-alias, operation-alias, and
dynamic-obligation indexes. It neither consumes the parallel M07-T04 reference authority nor
loads package code, invokes a target adapter, renders, mutates a channel, or writes active,
previous-good, generation, or durable-commit state.

All 14 implementation-owned staging limits have exact/one-over or executable dominance evidence.
The registered suites pass 13 focused runtime cases, 13 compiler-negative cases, and 17 independent
root proof/mutation cases. The official candidate closes to the exact M07-T03 package identity and
seven sorted dynamic obligations; forged authorities, byte drift, contract disagreement, limit
crossings, public mutation, and partial/active authority all fail closed. P-12 remains
`NOT_PROVEN`; N-038 and N-041 remain `PLANNED`; G07 remains open; and `PF-075` remains `OPEN` for
the M07-T07 consume/reject lifetime. Overall progress is 80/145, M07 is 6/11, and M07-T07 owns the
authenticated T04/T06 join plus one durable activation transaction next.

Evidence: `docs/proof/CONTROL-PLANE-RUNTIME-STAGING.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json`
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`.

M07-T07 joins only the exact private M07-T04 reference authority and exact private M07-T06 staging
authority for the same package and Bundle identity. A valid join consumes the staging candidate
before the first await or I/O; mismatched or already-busy attempts leave it unconsumed, while a
later terminal failure cannot replay it. The controller independently rereads and recloses the
complete Bundle from the same-root BundleStore and requires exact Bundle equality before any
durable write.

One atomic compare-and-swap record commits `activeRevision`, `previousGoodRevision`, and
`generation` together. The first activation starts at generation 0, later activations retain the
true previous-good revision, same-revision commits still advance the generation, and the safe
integer ceiling cannot wrap. The Web adapter stores that record in a separate SQLite database and
loads its native dependency lazily. A pre-existing or indeterminate record becomes explicit
recovery-required state; raw durable data is never accepted as authenticated runtime authority.
The repository atomically distinguishes a normal stale caller generation from drift against the
controller's complete authenticated current record. A disappeared or same-generation rewritten
row cannot reset or replace authority, and recovery discovered while Bundle I/O is pending is
sticky. Exact schema/version checks run under the SQLite writer lock before DML, so live trigger
drift cannot produce false publication. All statement acquisition stays inside the guarded SQLite
open/cleanup boundary. Durable commit precedes in-memory publication, and one controller permits
only one in-flight activation.

The registered suites pass 21 focused runtime cases, 25 compiler-negative cases, and 18 independent
root proof/mutation cases. P-12 remains `NOT_PROVEN`; N-004, N-038, and N-041 remain `PLANNED` for
their remaining owners; G07 remains open; and PF-075/PF-076 remain `OPEN`. At this checkpoint,
restart recovery, fault injection, activation matrices, and separately built host consumption
remain M07-T08 through M07-T11. Overall progress is 81/145, M07 is 7/11, and M07-T08 owns restart
validation and restore next.

At the M07-T07 checkpoint, M07-T10 was assigned the remaining non-blocking storage-profile race:
whether a live external mutation of database-level `journal_mode` requires rechecking the complete
SQLite connection profile inside the writer transaction. M07-T10 resolves that question by
requiring full profile reauthentication under the writer lock and again after commit; drift fails
closed and is never silently repaired.

Evidence: `docs/proof/CONTROL-PLANE-RUNTIME-ACTIVATION.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json`
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`.

M07-T08 reconstructs authority only for the exact record already chosen by the durable T07
transaction. The caller supplies one opaque M07-T03 package authority matching the durable active
revision and supplies a second only when the record names a previous-good revision. Recovery
rejects missing, extra, forged, cloned, proxied, swapped, or revision-mismatched roles before
Bundle-store I/O. It accepts no raw record, caller-selected revision, T04 authority, T06 handle,
path, loader, callback, repository, channel, or SQLite handle.

For every required role, the controller internally reruns M07-T04 reference and finite-limit
preflight plus M07-T06 runtime-index staging. It authenticates the exact private T03/T04/T06
lineage and consumes all internally created staging handles before the first asynchronous read.
It then rereads and recloses each complete Bundle from the same immutable store. Only after both
lineages succeed does it reread the repository and require exact equality of active revision,
previous-good revision, and generation with the record that selected the roles. Success publishes
the reconstructed active authority, keeps the validated previous-good lineage private, and writes
nothing: no generation increment, pointer swap, rollback, or fallback promotion occurs.

An empty or already active controller reports that recovery is not required without inspecting
inputs. A null indeterminate record remains recovery-required and must be resolved by reopening the
same local root. Close, concurrent activation/recovery, missing or unsafe Bundles, failed T04/T06
reconstruction, repository drift, row deletion, impossible generation-zero previous-good state,
and the safe-integer ceiling all fail closed without partial authority. Twelve focused runtime
cases, 14 compiler-negative cases, and 9 independent root proof/mutation cases pass. P-12 remains
`NOT_PROVEN`; N-004, N-038, and N-041 remain `PLANNED`; G07 and PF-076 remain open. The local root
remains application-trusted: no external cryptographic anchor means this task makes no
tamper-proof, hostile-administrator, or anti-rollback claim. Overall progress at this checkpoint
was 82/145 and M07 was 8/11. The final evidence pins exact AST
structures for the 105-entry package-root export inventory, executable CI registrations,
shared-state mappings, and the direct 12-case runtime plus 9-case root test inventories. Code-owned
exact source receipts bind executable test bodies and effective CI/shared-state flow. The same
evidence verifies the exact 36-key built runtime module surface, bounded identity-safe authority
reads, and byte-identical durable state before and after recovery.

Evidence: `docs/proof/CONTROL-PLANE-RUNTIME-RECOVERY.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json`
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`.

The M07-T08 CI registration produces the exact 144-workload, 68-proof-pair successor: 57 ordinary
pairs, 11 exclusive barriers, 447 retained prerequisite segments, 2,617 ordered legacy leaf
invocations, and 224 distinct leaves. The nine official CI contract commands pass 128/128 locally;
the broader combined contract run passes 152/152. At that checkpoint, this was local working-tree
evidence; no hosted M07-T08 result is claimed.

M07-T09 closes a bounded, named fault matrix across channel discovery, immutable Bundle fetch,
integrity, package resolution, reference admission, staging, durable commit, restart recovery, and
final durable-record publication. Nineteen stable fault ids plus one exact-inventory test prove
that faults before `COMMIT` preserve the authenticated baseline and publish no partial authority.
A post-`COMMIT` fault is explicitly indeterminate: it consumes the attempt and requires full
reauthentication of the durable winner before publication. Recovery faults expose neither active
nor fallback lineage, and an external final-record change is never overwritten. Twenty focused
runtime cases, 10 compiler-negative cases, and 11 root proof/mutation cases pass. The proof pins
eight exact predecessor prerequisites, 22 ordered trace rows, the 105 package-root exports, and the
36-key built runtime module surface without adding a public fault-injection API. N-004 becomes
`TESTED`; P-12 remains `NOT_PROVEN`; N-038/N-041 and G07 remain open. At that checkpoint, M07-T10
still owned all ordered-sequence and race claims, including the database-level `journal_mode`
decision; M07-T11 owned separately built host consumption. Historical progress at that checkpoint
was 83/145 and M07 was 9/11.

Evidence: `docs/proof/CONTROL-PLANE-RUNTIME-FAULT-INJECTION.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json`
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9` (64,493 bytes).

The M07-T09 CI registration produces the exact 146-workload, 69-proof-pair successor: 58 ordinary
pairs, 11 exclusive barriers, 455 retained prerequisite segments, 2,769 ordered legacy leaf
invocations, and 227 distinct leaves. These are local code-owned successor values; no hosted
M07-T09 result is claimed.

M07-T10 closes the ordered transition and race slice. The activation controller authenticates the
complete SQLite profile—WAL, `synchronous=FULL`, foreign keys enabled, trusted schema disabled, and
the exact busy timeout—after acquiring the writer lock and again after commit before publication.
The write remains lock-before-DML; any profile drift fails closed without repair. Fifteen named
transition cases cover A → invalid B → valid C, same- and different-candidate races, activation and
recovery orderings, restart, a real journal transition, and deterministic writer-profile drift.
The executable evidence passes 16 runtime tests, 9 compiler-negative tests, 12 independent root
mutation classes, 9 exact prerequisites, and 15 ordered trace rows. The root proof has no native
addon authority and proves a real `ERR_DLOPEN_DISABLED` denial; only the verifier receives narrow
SQLite native authority. The proof binds the exact single public `.` package export and captured
CI/distribution bytes to digest-bound pre/post live equality, and rejects receipt-only overrides.
At the T10 checkpoint N-038 became `TESTED`; N-041 remained `PLANNED`; P-12 remained
`NOT_PROVEN`; G07 remained open; and M07-T11 owned the next slice. T10 made no tamper-proof,
anti-rollback, hosted, host-channel, or native-conformance claim. Historical progress there was
84/145 and M07 was 10/11.

Evidence: `docs/proof/CONTROL-PLANE-RUNTIME-TRANSITION-RACES.md` and
`docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json`
`sha256:f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39` (58,059 bytes).

The M07-T10 CI registration produces the exact 148-workload, 70-proof-pair successor: 59 ordinary
pairs, 11 exclusive barriers, 463 retained prerequisite segments, 2,929 ordered legacy leaf
invocations, and 230 distinct leaves. At that historical checkpoint, the selector digest was
`sha256:010ef43efb4f4414d315ef4702324ae111c4666c38b3290f1a4891bebb3b98ea`; the frozen I07-03
baseline selector digest remains historical and unchanged. These are local code-owned successor
values; no hosted M07-T10 result is claimed.

M07-T11 closes the implementation milestone with a distinct Node composition server and browser
build. The server owns the fixed channel, bearer-authenticated loopback client, installed-package
inventory, durable activation root, and same-origin refresh route. It treats channel data only as
discovery, reruns the public M07 integrity-through-recovery chain, and delivers only the exact
authenticated active Bundle with a strong durable generation/revision ETag. The browser keeps an
already mounted valid surface when refresh or mount fails and fences stale and post-disposal work.
Seven focused-suite files contain 46 runtime tests plus two browser type-test files. The nine-case
sequence proves valid A, invalid B preserving A, valid C replacing A, restart
recovery before delivery, two lifetime fences, bearer enforcement, installed-inventory symlink
rejection, and last-known-good browser mounting. Hard links, special files, parent/file identity
drift, oversized material, invalid media types, BOM-prefixed JSON, and unsafe static requests fail
closed in the supporting suites.

This completes M07's 11 implementation tasks and advances overall progress to 85/145 (59%). The
I07-04 campaign satisfied the frozen `20 / 20` hosted strict-subset threshold with zero false
negatives. The promoted cutover, sequence-28 zero-reference checkpoint cleanup, cleanup/main
required-exhaustive runs, and fresh required-affected canary close G07. P-12 remains
`NOT_PROVEN` until M10-T07 proves Desen App product-level restart preservation, and N-041 remains
`PLANNED` until M12-T05. The local proof claims neither remote/multi-tenant/TLS deployment,
hostile-admin concurrent mutation resistance, independent anti-rollback, real-browser
performance, Android/iOS conformance, nor a hosted M07-T11 pass.

Evidence: `docs/proof/REFERENCE-HOST-WEB-CHANNEL-CONSUMPTION.md` and
`docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json`
`sha256:48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0` (39,307 bytes).

The M07-T11 CI registration produces the exact 150-workload, 71-proof-pair successor: 60 ordinary
pairs, 11 exclusive barriers, 479 retained prerequisite segments, 3,113 ordered legacy leaf
invocations, and 236 distinct leaves. Its pre-promotion selector digest was
`sha256:ee0cda5b4871ce2e169a958eefd60299197dbf261c0163335cd759e814067dbf`; the frozen I07-03
baseline selector digest remains historical and unchanged. These are local code-owned successor
values; no hosted M07-T11 result is claimed.

Reviewed reader checkpoint sequence 7 links predecessor head
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` to
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` and authenticates 13 frozen
artifacts plus 26 live readers. It adds the 34,612-byte T04 artifact, live T04 proof/root and current
M05-T06 compatibility readers. It seals the exact final receipts of the complete 26-reader live
set after all T04 compatibility bridges and the reviewed CI timeout calibration, including current
M05-T09, M06-T01/T05/T08/T09/T10/T11, and M07-T01/T02/T03 readers. The frozen M05-T06 artifact
remains byte-identical and historically
`PARTIAL`; live P-17 is `PROVEN`. Sequences 1–6 remain unchanged. This reviewed local checkpoint
makes no new hosted CI claim.

Reviewed reader checkpoint sequence 8 links the exact sequence 7 head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` to
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` and authenticates 14 frozen
artifacts plus 28 live readers. It adds the 41,945-byte M07-T05 artifact
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`, its 73,915-byte proof
reader `sha256:f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3`, and its 17,291-byte root
reader `sha256:490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65`. Prior live receipts,
including current M07-T01 through M07-T04 and reference-host source-audit compatibility readers,
are resealed after the T05 compatibility changes. Sequences 1–7 and every predecessor frozen
artifact remain unchanged. This is a reviewed local checkpoint and makes no new hosted CI claim;
I07-04 still owns the remaining compatibility-reader debt.

Reviewed reader checkpoint sequence 9 links the exact sequence 8 head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` to
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[16, 17, 18, 19]` change: M07-T02 proof
94,612 bytes / `sha256:4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9`;
M07-T02 root 20,959 bytes / `sha256:fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed`;
M07-T03 proof 86,174 bytes / `sha256:5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab`;
and M07-T03 root 21,119 bytes /
`sha256:10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11`.
The minimal T05 compatibility bridges authenticate the current shared strict-JSON internal
source/distribution and exact T03 → T04 → T05 aggregate adjacency while continuing to project the
unchanged frozen T02/T03 artifacts. Sequences 1–8 and every frozen artifact remain unchanged. This
is reviewed local evidence only, not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by
I07-04.

Reviewed reader checkpoint sequence 10 links the exact sequence 9 head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` to
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[7, 14, 15]` change: the M06-T08 catalog root
`tests/publisher-catalog-pinning.test.mjs` is 38,530 bytes at
`sha256:bb3038a8c5bb241c863daa6c7f41c1d8ab210da81fdbe52697f33a3c14909116`; the M07-T01 proof reader
is 99,672 bytes at `sha256:d9d9edd6379357dde229999ce461a0dc66bf58dc0d7900eb6f5ece177a9b3fba`;
and the M07-T01 root reader is 26,679 bytes at
`sha256:6b3a7869962046a3594a788095faad640c76fec660a59aee7b26844e831851ff`. These minimal test-fixture
successors recognize the local-API aggregate tail and updated catalog-root receipt while the frozen
catalog and T01 artifacts remain unchanged. The final strictly sequential local catalog and T01
checks pass 51/51 and 16/16. Sequences 1–9 remain immutable. This is reviewed local evidence only,
not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04.

Reviewed reader checkpoint sequence 11 links the exact sequence 10 head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` to
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,034
bytes at `sha256:c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f`,
and its root reader is 17,578 bytes at
`sha256:4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389`. Sequences 1–10 and every
frozen artifact remain unchanged. This is a reviewed local-reader checkpoint and makes no hosted
CI claim.

Reviewed reader checkpoint sequence 12 links the exact sequence 11 head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to its then-current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,507
bytes at `sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`,
and its root reader is 17,716 bytes at
`sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`. This successor authenticates
the exact ADR token-bound documentation update while the M07-T05 artifact and every other frozen
artifact remain unchanged. This is reviewed local-reader evidence; hosted CI has not yet been
claimed, and I07-04 still owns the compatibility-reader debt.

Reviewed reader checkpoint sequence 13 links the exact sequence 12 head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to its then-current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` with the same 14 unchanged
frozen artifacts and 28 readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04.

Reviewed reader checkpoint sequence 14 links the exact sequence 13 head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` to current head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[10, 11, 14]` change: the M06-T11 proof reader is
166,563 bytes at `sha256:06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802`,
its root reader is 60,572 bytes at
`sha256:29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531`, and the M07-T01 proof
reader is 99,672 bytes at
`sha256:888d5e81bda7ca2cdcc58bb063d49409cad5f5d73bdd9baaa16dc199e566e5c6`. This narrow CI-reader
successor changes no frozen artifact. Subsequent M07-T05 pull-request and `main`
required-exhaustive runs passed in hosted CI; sequence 14 itself remains local-reader evidence, and
I07-04 still owns the compatibility-reader debt.

Reviewed checkpoint sequence 15 links exact sequence 14 head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` to current head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` and authenticates 15 frozen
artifacts plus 30 live readers. It appends the 47,622-byte M07-T06 artifact
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`, reseals indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27]`, and appends the T06
proof/root readers at `[28, 29]`.
Sequences 1–14 and predecessor artifact bytes remain unchanged. This is reviewed local-reader
evidence and claims no hosted M07-T06 result. `DEBT-I07-009` and `DEBT-I07-013` record the temporary
compatibility-reader bridges under I07-04 for removal by G07.

Reviewed checkpoint sequence 16 links exact sequence 15 head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` to current head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` and authenticates 16 frozen
artifacts plus 32 live readers. It appends the 49,892-byte M07-T07 artifact
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`, reseals indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31]`, and
appends the T07 proof/root readers at `[30, 31]`. Sequences 1–15 and predecessor artifact bytes
remain unchanged. This is reviewed local-reader evidence and claims no hosted M07-T07 result; the
historical activation-reader compatibility bridges remain owned by I07-04 for removal by G07.

Reviewed checkpoint sequence 17 links exact sequence 16 head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` to current head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e` and authenticates 17 frozen
artifacts plus 34 live readers. It appends the 44,224-byte M07-T08 artifact
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`, reseals indexes
`[14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31]`, and appends the 84,219-byte T08 proof reader at
`[32]` (`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) and the 24,939-byte T08
root reader at `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`).
Sequences 1–16 and the prior 16 artifact files remain byte-identical. This is reviewed local-reader
evidence and makes no hosted M07-T08 claim. `DEBT-I07-015` records the temporary recovery-reader
bridges under I07-04 for removal by G07.

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
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` to its then-current head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939`. It preserves sequences
1–20 and every predecessor artifact byte, appends the 64,493-byte M07-T09 artifact
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`, reseals 27 historical
compatibility readers, and appends the 64,932-byte proof reader
`sha256:da3fed33227c78eef872d06a3aedaf98a4e87e91de12893a21aceb5a9365216f` plus the 17,341-byte root
reader `sha256:f50017b668eb7f4a60d596a2d87a7e5b067989a9e1fe9a00270e685c44a4b8f6`. The chain now
authenticates 18 frozen artifacts and 36 current readers. This is reviewed local-reader evidence,
not a hosted M07-T09 claim; `DEBT-I07-016` records the temporary successor bridges for I07-04
removal by G07.

Reviewed checkpoint sequence 22 links that exact sequence 21 head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to its then-current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. It preserves all 18
frozen artifacts and all 36 reader identities while resealing only workflow-dependent reader
indexes `[8, 10, 11, 12, 14]`; every frozen artifact remains byte-identical. This append records
the exact I07-03 CI-workflow receipt propagation without changing any proof claim.

Reviewed checkpoint sequence 23 links that exact sequence 22 head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e` to current head
`3308da059b521c2b5f5fe75d036303221cace805094445f2d64383384831d45d`. It preserves sequences
1–22 and every predecessor artifact byte, appends the exact 58,059-byte M07-T10 artifact, and
authenticates 19 frozen artifacts plus 38 live readers. The T10 proof/root readers are the two new
reader identities. Historical bridges required by the append are registered as `DEBT-I07-018`,
owned by I07-04 for removal no later than G07. This is reviewed local-reader evidence and makes no
hosted M07-T10 claim.

## M08 — Framework-neutral editor core

| ID      | Status      | Depends on      | Deliverable / evidence                                               |
| ------- | ----------- | --------------- | -------------------------------------------------------------------- |
| M08-T01 | DONE        | G07             | Direct DESEN Source editor document model                            |
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

M08-T01 is `DONE` after authenticating its completed I07-04/G07 prerequisite. The built package
admits unknown inert JSON through the frozen Source and embedded-schema structural validator and
returns the direct detached recursively immutable Source root. It adds no wrapper, normalized
projection, hidden AST, node index, executable authority, or partial document on rejection. Seven
focused behavior cases, ten built public-runtime contract cases, five source compiler negatives,
five emitted-declaration consumer negatives, and seven fail-closed public proof-core cases cover
success, failure, ownership, unresolved semantics, package/distribution boundaries, and hostile
input or proof drift. The independent root proof adds 13 adversarial cases and 47 tracked-file
receipts, including an exact 24-file static ESM runtime closure. Its 19 dependency modules are
authenticated before import by 11 still-current M02-T11 receipts plus 8 disjoint M08 successor
receipts; the exact dependency bytes, Node runtime, loader, and process remain trusted rather than
claiming a general hostile-JavaScript sandbox. The exact 153-workload/72-proof-pair CI successor
registers that proof. Together they pin
the reviewed scope in `docs/proof/EDITOR-CORE-SOURCE-DOCUMENT.md` and
`docs/proof/artifacts/editor-core-0.1.0-source-document.json`. Append-only reader checkpoint
sequence 29 at `95c175c67352c3fc0d2fbe420446a3e5283087eb00c5d0ff4c3313703489eb58`
authenticates 26 frozen artifacts and 52 current readers; the historical I07-04/G07 sequence-28
closure remains unchanged.

This task proves structural admission and the direct immutable Source graph only. Stable-ID and
mutation commands remain M08-T02–M08-T06, authoring isolation and unknown-extension preservation
remain M08-T07, persistence remains M08-T08, continuous semantic validation and invalid-node
mapping remain M08-T09, and the terminal editor-core React/DOM and deterministic-command boundary
remains M08-T10. No `P-*`, `N-*`, `S-*`, or proof-gate status changes. Overall implementation
progress is 86/145 (59%), M08 is 1/10, proof gates remain 8/13, and M08-T02 is next.

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

| ID      | Status      | Depends on              | Deliverable / evidence                                                                                                                  |
| ------- | ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| M12-T01 | NOT_STARTED | G11                     | Every mandatory and recommended BCP 14 clause updated to TESTED or justified status                                                     |
| M12-T02 | NOT_STARTED | M12-T01                 | Proof Matrix generated from test and artifact results                                                                                   |
| M12-T03 | NOT_STARTED | G11                     | Data-only, no-eval, no-executable-markup, and no-remote-code-selection checks                                                           |
| M12-T04 | NOT_STARTED | G11                     | Secret and personal-data fixture audit                                                                                                  |
| M12-T05 | NOT_STARTED | G11                     | Bundle, node, depth, repeat, predicate, action, and settlement limits measured                                                          |
| M12-T06 | NOT_STARTED | G11                     | Public TSDoc and package README audit                                                                                                   |
| M12-T07 | NOT_STARTED | M12-T06                 | Compatibility documentation and Desen App-independent integration quickstart                                                            |
| M12-T08 | NOT_STARTED | M12-T01–M12-T07         | Final validation, conformance-target, and implementation report                                                                         |
| M12-T09 | NOT_STARTED | M12-T08                 | Public-alpha demo runbook and release-candidate inventory                                                                               |
| M12-T10 | NOT_STARTED | M12-T07–M12-T09         | Versioned DESEN Developer Platform content for `desen.run`, including a byte-identical protocol 0.1.0 mirror with checksum verification |
| M12-T11 | NOT_STARTED | M12-T07                 | Public `desen` facade with documented subpath exports and a functional CLI rather than placeholder entry points                         |
| M12-T12 | NOT_STARTED | M12-T10–M12-T11         | `npm pack` artifacts pass fresh-consumer install/import/CLI smoke tests and declared compatibility checks                               |
| M12-T13 | NOT_STARTED | M12-T08–M12-T12         | Final external-release checklist requiring explicit approval before domain deployment, npm publication, push, or release creation       |
| G12     | NOT_STARTED | M12-T01–M12-T13, I07-05 | Repeatable Web–React public alpha artifacts are ready for explicit external release approval                                            |
