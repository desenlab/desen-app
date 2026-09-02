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
| CI-02  | DONE        | I07-04, explicit user authorization  | Bounded non-authoritative per-task local feedback plus exact PR-head hosted completion authority; exhaustive compatibility coverage retained      | `AGENTS.md`, `scripts/test/ci-quality-gate.test.mjs`, ADR 0011     |
| I07-01 | DONE        | M07-T01, explicit user authorization | Current-reader checkpoint, machine-enforced cleanup register, and a non-authoritative `SHADOW + EXHAUSTIVE` modular candidate                     | `docs/proof/baselines/i07-01-modular-proof-shadow.json`            |
| I07-02 | DONE        | I07-01                               | Exact legacy/modular equivalence, shared-state classification, and required-CI cutover to `REQUIRED + EXHAUSTIVE` execution                       | `docs/proof/baselines/i07-02-required-exhaustive-equivalence.json` |
| I07-03 | DONE        | I07-02                               | Fail-closed `SHADOW + AFFECTED` selector with complete tracked-path ownership, unknown-to-exhaustive fallback, and a frozen observation threshold | `docs/proof/baselines/i07-03-affected-selector-shadow.json`        |
| I07-04 | DONE        | I07-03                               | Promote proven PR selection, retain exhaustive main/release/manual coverage, and remove all G07-due current-reader compatibility shims            | `docs/proof/baselines/i07-04-affected-selector-promotion.json`     |
| I07-05 | NOT_STARTED | I07-04                               | Retire the legacy sequential runner only after rollback, failure, cancellation, hosted, and zero-reference gates pass                             | `docs/proof/baselines/i07-05-legacy-retirement.json`               |

`CI-01` temporarily precedes `M04-T03` in the working order but does not change the protocol task
dependency graph, milestone totals, or proof-gate counts. It must keep the existing task-specific
commands available, run every frozen-snapshot, proof-artifact, negative, mutation, and boundary
check from fresh inputs, and must not trust path filters or cached proof success.

`CI-02` is a separate explicitly authorized operational task and does not change the 145-task
implementation total or any proof-gate count. It makes the exact six-command local baseline
non-authoritative, keeps the exact task-specific verifier and focused positive/relevant negative
tests mandatory, and requires the hosted `Quality gate` on the exact current pull-request head
before merge or a completion report. The full `pnpm check` remains the local exhaustive
compatibility and gate-closure command for G closure, an explicit local manual audit, or an
explicit request. Hosted `main`, release, manual audit, and unsafe/untrusted boundaries remain
fresh exhaustive runs. Checkpoints and seals remain identity/impact authority rather than cached
success, and selected hosted workloads remain fresh. CI-02 adds no local affected selector, changes
no hosted dispatcher/workflow, and leaves I07-05 plus the legacy rollback path unchanged.

Local CI-02 evidence is the passing six-command bounded baseline, the 2/2 focused CI-02 contract
tests, unchanged 45-checkpoint/41-artifact/82-reader authority, passing infrastructure-debt and
I07-04 promotion verifiers, and clean formatting. The complete legacy CI contract file passes
28/28 on its final local rerun. One earlier attempt observed this host intermittently deny the
pre-existing process-group probe `process.kill(-pid, 0)` with `EPERM`; the test remained unchanged
and enabled and passed on the final rerun. The implementation candidate at
`921fd54c406f22fb6da25b0fdd29598ac8950750` passed PR #56's hosted `Quality gate` in
[run 33196876164 / job 98936152886](https://github.com/desenlab/desen-app/actions/runs/33196876164/job/98936152886)
in `14m53s`. That receipt proves only that prior exact head. The `DONE` row in this unmerged pull
request is a conditional closure candidate, not evidence that the prior receipt authorizes this new
head. Canonical CI-02 remains `IN_PROGRESS` until the hosted `Quality gate` attached to this exact
current head passes. If it passes, this same unchanged commit becomes the authoritative `DONE`
revision; until then merge and a completion report remain blocked.

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

| ID      | Status | Depends on                | Deliverable / evidence                                               |
| ------- | ------ | ------------------------- | -------------------------------------------------------------------- |
| M08-T01 | DONE   | G07                       | Direct DESEN Source editor document model                            |
| M08-T02 | DONE   | M08-T01                   | Stable-ID allocator and insert command                               |
| M08-T03 | DONE   | M08-T02                   | Delete, slot move, and ordered reorder commands                      |
| M08-T04 | DONE   | M08-T02–M08-T03           | Prop, style-part, condition, and variant editing commands            |
| M08-T05 | DONE   | M08-T02                   | State declaration and binding editing commands                       |
| M08-T06 | DONE   | M08-T05                   | Event and closed-action editing commands                             |
| M08-T07 | DONE   | M08-T01–M08-T06           | Authoring isolation and unknown-extension round-trip preservation    |
| M08-T08 | DONE   | M07-T05, M08-T01, M08-T07 | Persistence port and local source adapter                            |
| M08-T09 | DONE   | M08-T03–M08-T07           | Continuous validation and invalid-node mapping                       |
| M08-T10 | DONE   | M08-T01–M08-T09           | React/DOM boundary, stable identity, and deterministic command tests |
| G08     | DONE   | M08-T01–M08-T10           | UI-independent editor core produces valid sources                    |

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
`docs/proof/artifacts/editor-core-0.1.0-source-document.json`. At the M08-T01 checkpoint, append-only reader
sequence 29 at `ccd4a58913585da39e71ea360714c69e70a94188e0b5643e521d61bf246f1a2b`
authenticates 26 frozen artifacts and 52 then-current readers; the historical I07-04/G07 sequence-28
closure remains unchanged.

This task proves structural admission and the direct immutable Source graph only. Stable-ID and
mutation commands remain M08-T02–M08-T06, authoring isolation and unknown-extension preservation
remain M08-T07, persistence remains M08-T08, continuous semantic validation and invalid-node
mapping remain M08-T09, and the terminal editor-core React/DOM and deterministic-command boundary
remains M08-T10. No `P-*`, `N-*`, `S-*`, or proof-gate status changes. Overall implementation
progress at the M08-T01 checkpoint was 86/145 (59%), M08 was 1/10, proof gates remained 8/13, and
M08-T02 was next.

M08-T02 is `DONE`. The emitted `insertDesenEditorNode` command allocates the preferred ID when it
is free and otherwise the lowest free ordinal suffix in the selected surface's case-sensitive
shared node/behavior namespace. It inserts one minimal `{ id, use }` leaf at the exact requested
component-node or behavior-instance slot boundary, preserves every prior identity and the order of
all existing children, and creates an absent slot only at index zero. Success returns a fresh
detached recursively frozen direct Source and the allocated ID; all five insert diagnostic classes
plus unchanged structural diagnostics fail atomically without a partial document or allocated ID.
The reviewed profile fixes capability IDs at 4,096 code units, canonical post-insert Sources at
8,388,608 bytes, surface-local identity occurrences at 25,000, and component depth at 64 with the
surface root at depth zero. The focused stable-ID package suite passes 16/16, the cumulative public
package suite passes 22/22, and the independent root proof passes 10/10. Behavior executes only
after loading an isolated 25-file ESM graph copied from authenticated bytes; its 21 dependency
files match the frozen M08-T01 receipts while Node, the ESM loader, and process remain trusted.
Exact evidence is pinned
in `docs/proof/EDITOR-CORE-STABLE-ID-INSERT.md` and the 19,561-byte artifact
`docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json` at
`sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`.
Append-only reader checkpoint sequence 30 at
`f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970` authenticates 27 frozen
artifacts and 54 current readers while leaving historical sequence 29 unchanged.

Delete, move, and ordered-reorder commands remain M08-T03; the other authoring and persistence
commands remain M08-T04–M08-T08; continuous semantic diagnostics remain M08-T09; and terminal
stable-identity plus React/DOM boundary evidence remains M08-T10. This task does not claim
streaming or preallocation memory-DoS resistance, a hostile-JavaScript sandbox, P-18, or G08. No
`P-*`, `N-*`, `S-*`, or proof-gate status changes. Overall implementation progress is 87/145
(60%), M08 is 2/10, proof gates remain 8/13, and M08-T03 is next.

M08-T03 is `DONE`. The emitted `deleteDesenEditorNode`, `moveDesenEditorNode`, and
`reorderDesenEditorNode` commands remove one selected subtree, move it across owners or slots, or
place it at a post-removal final index within the same slot. Delete preserves the emptied slot key
and empty array; move creates an absent destination only at index zero. Node and behavior owners,
prototype-overlapping slot names, structurally valid unresolved semantics, root/cycle/ambiguity/
missing-target rejection, same-slot command separation, stable surviving identities, and exact
array order are covered. Success returns a fresh detached recursively frozen direct Source;
failure is atomic and returns only frozen diagnostics. The fixed 8 MiB, 25,000-identity, depth-64,
and 4,096-code-unit limits remain fail-closed, and command inputs reject accessor, prototype,
symbol, or extra-key authority.

The focused structural-edit suite passes 16/16, the cumulative built public-package suite passes
26/26, and the independent root proof passes 10/10. Exact evidence is pinned in
`docs/proof/EDITOR-CORE-STRUCTURAL-EDITS.md` and the 22,402-byte artifact
`docs/proof/artifacts/editor-core-0.1.0-structural-edits.json` at
`sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`. The proof directly
authenticates the frozen M08-T02 artifact, verifies 60 tracked-file receipts, and executes behavior
from an isolated authenticated 26-file ESM graph. CI registers the pair in the exact
157-workload/74-proof-pair successor: 63 ordinary pairs and 11 exclusive barriers. The current
append-only reader successor is sequence 31 at
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d`, authenticating 28 frozen
artifacts and 56 readers; historical sequence 30 remains unchanged.

This closes editor semantic-array ordering coverage, so `N-014` is `TESTED`. `S-002` remains
`PLANNED`: M08-T03 proves surviving identity preservation for delete/move/reorder, while terminal
stable-identity integration remains M08-T10. Prop, style-part, condition, and variant commands
remain M08-T04; the later authoring/persistence/validation/integration work remains M08-T05–M08-T10.
No P-18, G08, hostile-JavaScript sandbox, streaming, or preallocation memory-DoS claim is made.
Overall implementation progress is 88/145 (61%), M08 is 3/10, proof gates remain 8/13, and M08-T04
is next.

M08-T04 is `DONE`. The public package exposes fourteen atomic immutable content commands for node
or behavior props and base style leaves plus node conditions and ordered node variants. Variant
insert, delete, reorder, condition, prop, and style commands use exact post-removal positions,
retain deliberately emptied own containers, preserve unrelated semantic order and every existing
identity, and keep structurally valid Catalog-unresolved content authorable. All six content-edit
diagnostic classes, unchanged structural-diagnostic pass-through, exact command ownership,
prototype-sensitive names as own data, detached caller values, missing/ambiguous targets and paths,
invalid positions, malformed Unicode, inherited/accessor/symbol/extra fields, function values, own
`toJSON` hooks, sparse/decorated arrays, unsafe indexes, and the fixed 8 MiB, 25,000-identity, and
depth-64 limits fail closed without exposing a partial Source. Required command fields are exact
enumerable own data; accessor getters and `toJSON` hooks are not invoked. Necessary reflection may
execute arbitrary `Proxy` traps, and an admissible forwarding `Proxy` may be accepted; this is not
a hostile-JavaScript/no-code-execution membrane.

The cumulative editor-core package suite passes 55/55, including the 16/16 focused content-edit
cases; the built public-package suite passes 32/32; and the independent root proof passes 10/10.
Exact evidence is pinned in `docs/proof/EDITOR-CORE-CONTENT-EDITS.md` and the 26,988-byte artifact
`docs/proof/artifacts/editor-core-0.1.0-content-edits.json` at
`sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`. The proof directly
authenticates the exact frozen M08-T02 and M08-T03 artifacts, verifies 67 tracked-file receipts, and
executes behavior from an isolated authenticated 27-file ESM graph. CI registers the new pair in
the exact 159-workload/75-proof-pair successor: 64 ordinary pairs and 11 exclusive barriers, with
519 prerequisite segments, 3,237 ordered leaf invocations, and 251 distinct leaves. The neutral
inventory is `sha256:3879dcd4c9716b7f08746953c62170de7bd33c786f747849b8aed38e0fe1e62c`; the required plan is
`sha256:30a193cbc27316792bd577dcecdc87c10e680e2e033698ceb90787c2cbcf1b51`.

Append-only reader successor sequence 32 at
`9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424` authenticates 29 frozen
artifacts and 58 readers while historical sequence 31 and every predecessor artifact remain
unchanged. This is local code-owned/current evidence and makes no hosted M08-T04 claim. `N-014`
remains `TESTED`; `S-002` remains `PLANNED` for terminal M08-T10 integration; no `P-*`, `N-*`,
`S-*`, or proof-gate status changes. M08-T04 does not claim Catalog slot acceptance/cardinality,
undo/redo, selection, viewport, streaming/preallocation memory-DoS resistance, a hostile-JavaScript
sandbox or no-code-execution membrane, P-18, or G08. Overall implementation progress is 89/145
(61%), M08 is 4/10, proof gates remain 8/13, and M08-T05 state declaration and binding editing is
next.

M08-T05 is `DONE`. The public package exposes eight atomic immutable commands for inserting and
deleting state declarations, replacing state schemas and initial values, replacing node repeat
items and keys, and setting or deleting named resource inputs. State deletion deliberately does
not cascade into references or actions and retains the required empty state map. Repeat edits
require an existing repeat and preserve its alias, limit, and extensions. Resource-input deletion
retains the required empty input map, while prototype-sensitive declaration and input names remain
own data. Binding values, state schemas, and initial values are captured whole without evaluation,
reference rewriting, or semantic normalization. Every success returns a fresh detached recursively
frozen direct Source while preserving every existing identity and unrelated semantic order;
failure is atomic and exposes no partial document.

The focused state-and-binding suite passes 14/14, with 14 focused compiler-negative assertions.
The cumulative built public-package suite passes 38/38, with 48 public consumer compiler-negative
assertions, and the independent root proof passes 10/10. Exact evidence is pinned in
`docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md` and the 30,014-byte artifact
`docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json` at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`. The proof directly
authenticates the exact frozen M08-T02 artifact, separately authenticates the frozen M08-T04
artifact for current-graph compatibility without widening the official prerequisite, verifies 74
tracked-file receipts, and executes behavior from an isolated authenticated 28-file ESM graph.

CI registers the verifier/root pair in the exact 161-workload/76-proof-pair successor: 65 ordinary
pairs and 11 barriers, with 529 prerequisite segments, 3,293 ordered leaf invocations, and 254
distinct leaves. The scheduler-neutral inventory is
`sha256:ae790f14c376a1fb449e34877a08abba164677ef413583248e5f609f3c7bb292`; the required plan is
`sha256:9f7ef05e606afb293b42c650acfcf043d638cd429e07fdee55d01d241f06bf1b`. Append-only reader
checkpoint sequence 33 at
`64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871` authenticates 30 frozen
artifacts and 60 current readers while preserving sequence 32 and every earlier byte. Its dedicated
checkpoint suite passes 56/56. These are local code-owned/current receipts and make no hosted
M08-T05 claim.

Exact enumerable own-data command fields are required. Accessors and own `toJSON` hooks are
rejected without invocation. Necessary reflection may execute arbitrary `Proxy` traps, an
admissible forwarding `Proxy` may pass, and a throwing reflection trap is contained as a command
failure; no hostile-JavaScript or no-code-execution membrane is claimed. The fixed 8 MiB,
25,000-identity, and depth-64 limits remain fail-closed. Structural admission rejects an invalid
Draft 2020-12 state schema; initial/schema compatibility, dotted-state reachability, repeat semantics, Catalog resource-input
contracts, continuous diagnostics, and invalid-node mapping remain M08-T09. Event and closed-action
editing remains M08-T06; later authoring, persistence, and terminal integration work remains
M08-T07–M08-T10. No `P-*`, `N-*`, `S-*`, or proof-gate status changes. Overall implementation
progress is 90/145 (62%), M08 is 5/10, proof gates remain 8/13, and M08-T06 event and closed-action
editing is next.

M08-T06 is `DONE`. The public package exposes six atomic immutable commands for inserting and
deleting event handlers and inserting, replacing, deleting, and reordering closed actions. They
address one unique surface-local node or behavior owner. Canonical owner-relative RFC 6901
pointers select root event lists and recursive `operation.invoke` `onSuccess`/`onFailure` lists;
reorder uses the post-removal final index. Removing a final entry deliberately retains empty event
maps, action arrays, and settlement arrays. All seven DESEN 0.1.0 action variants are captured
whole as inert data, including guards, parameters, inputs, payloads, nested actions, and
extensions. No action is executed or semantically resolved. Every success returns a fresh detached
recursively frozen direct Source; malformed commands, missing or ambiguous targets, invalid paths
or positions, profile overflow, and structural re-admission failures remain atomic and expose no
partial document.

The focused event/action suite passes 16/16, with 19 focused compiler-negative assertions. The
cumulative editor-core package suite passes 85/85; the built public-package suite passes 44/44,
with 69 public consumer compiler-negative assertions; and the independent root proof passes
10/10. The public package exposes 33 runtime and 69 type exports. M08-T06 contributes six runtime
commands and fourteen public types, and all 20 task-owned declarations retain TSDoc in source and
emitted declarations. Exact evidence is pinned in
`docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md` and the 31,310-byte artifact
`docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json` at
`sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`.

The proof's sole direct official prerequisite is the exact frozen M08-T05 artifact. It verifies 81
exact tracked-file receipts and executes behavior only after copying authenticated bytes into an
isolated 29-file ESM graph: eight editor files and 21 dependency files, connected by 17 exact
static edges. The historical M08-T06 CI successor contained 163 workloads and 77 proof pairs: 66
ordinary pairs and 11 barriers. Its retained quality plan is
`sha256:bc3a2cdc47a430b8c08fc80714fc043a877ced3a0cc62b13ce14743e0d66401d`; the neutral inventory,
impact graph, workload set, and ordered projection are respectively
`sha256:e9ec8cad80932a2e1ced17f72525c3e36351fc020eca342791feb0d02cfc1f53`,
`sha256:f7be1ee5bc35a7b0ea2cdcdabacf13f4525fcdabeb97e8854513ed4343e4aab3`,
`sha256:56c04c534906197d7597c7854ba792d0c96001612f13346a1a104371910fc22a`, and
`sha256:868d2a59cdf5e95badd7d0cce601003e26280609f44167c831e251595779e6e4`. Required and shadow
plans are `sha256:7e6afbee5323e174f7507827a69785d8189cb27c1c99fb64b3def258111b3ff3` and
`sha256:533bdab2a511433e0c1bdb4fab1be27430914489d722918d7d789bdf294d4caf`.

Affected ownership covers 1,080 tracked paths at
`sha256:6ea7a544be7ed7817c59b1d723f3a7f4d584e0c8a37def99ed70c375276cd9b8`, including 154
proof-owned paths, with complete projection
`sha256:53d18a28d028ea98406e4ded063f42e408e39bfd692761a8ca53c73c9177d828`. The then-current selector
and required-runner authorities were
`sha256:19d0f2c281bccf26e941c9440e18a7015d281224eed8bdf71c92ee0b5a497975` and
`sha256:6aef41c5155e041d3fd3f9f0343b1a8aefc66d530378b6e6f402f503cec4fe6d`; the promotion artifact
is `sha256:76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549`. Append-only checkpoint
sequence 34 at `f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674` authenticates 31 frozen
artifacts and 62 then-current readers while preserving sequence 33 and every earlier byte. It reseals
reader indexes `[50, 51, 52, 53, 54, 56, 58]`, appends new readers at `[60, 61]`, and its
dedicated suite passes 57/57. Targeted CI infrastructure passes 235/235, required-affected passes
27/27, and promotion contracts pass 19/19. These are local code-owned receipts and make no hosted
M08-T06-success claim.

Exact enumerable own-data command fields are required. Accessors and own `toJSON` hooks are
rejected without invocation. Necessary reflection may execute arbitrary `Proxy` traps; an honest
forwarding `Proxy` may pass, and a throwing reflection trap is contained as a command failure. No
hostile-JavaScript or no-code-execution membrane is claimed. The profile admits exactly 8 MiB of
canonical Source data, 25,000 identities per selected surface, 25,000 action occurrences per
selected owner, source depth 64 with the root at zero, and action nesting depth 64 with root
actions at zero. M08-T07 retains authoring isolation and complete unknown-extension round-trip
proof, M08-T08 retains persistence, M08-T09 retains action/event semantics and continuous
diagnostic mapping, and M08-T10 retains the terminal React/DOM boundary and G08. No `P-*`, `N-*`,
`S-*`, or proof-gate status changes. Overall implementation progress is 91/145 (63%), M08 is 6/10,
proof gates remain 8/13, and M08-T07 is next.

M08-T07 is `DONE`. This proof-only task adds no runtime command or public export. The existing
factory and all 32 immutable commands preserve root `authoring` as detached recursively immutable
producer-owned parsed data. Otherwise identical Sources that differ only in root authoring retain
equal authoring-excluded projections and equal protocol Source digests, while a root extension
change still changes the digest. Unknown parsed extension values remain exact inert data at all 16
Source-reachable locations, including both recommended reverse-domain keys and legal
non-namespaced keys. Apparent core fields receive no core semantics, and the naming recommendation
does not become a hard validator rule. Fake authoring/extension IDs and actions do not enter
allocator, identity, or action scans; root authoring is charged to the full 8 MiB Source limit.
Insert-supplied markers enter, move/reorder carry them, delete removes only the target, and
whole-value replacement replaces that target's old extension while unrelated markers survive.
The proof does not claim preservation of an owner deliberately deleted or replaced.

The focused authoring-round-trip suite passes 33/33, with six focused compiler-negative
assertions. The cumulative built public-package suite passes 46/46, with 75 public consumer
compiler-negative assertions, and the independent root proof passes 10/10. The exact 62,304-byte
artifact is `docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json` at
`sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`; its verifier tracks 95
receipts and an isolated 29-file/17-edge graph. The current CI successor contains 165 workloads,
78 proof pairs, 549 prerequisite segments, 3,435 ordered leaf invocations, and 260 distinct leaves.
Sequence 35 at `a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3`
authenticates 32 frozen artifacts and 64 current readers, with sequence 34 and every earlier byte
unchanged; its checkpoint suite passes 58/58. The full current CI infrastructure suite passes
265/265, with separate required-affected, promotion, and retained legacy-gate receipts of 27/27,
19/19, and 25/25. These are local code-owned receipts and make no hosted M08-T07 claim. This proves
parsed JSON value preservation rather than lexical whitespace or
object-member byte-order preservation. `N-012`,
`N-018`, and `S-003` advance to `TESTED`; `N-014` remains `TESTED`, `S-002` remains `PLANNED`,
and no `P-*` or proof-gate status changes. M08-T08 retains storage I/O, save/open durability, and
the persistence adapter; M08-T09 retains continuous semantic diagnostics and invalid-node mapping;
M08-T10 retains the terminal React/DOM boundary and G08. Overall implementation progress is
92/145 (63%), M08 is 7/10, proof gates remain 8/13, and M08-T08 is next.

M08-T08 is `DONE`. `@desen/editor-core` now owns a platform-neutral persistence adapter contract
whose storage edge reads one Source and performs generation-guarded compare-and-set writes; its
public port exposes open and save without importing browser, React, DOM, Node, SQLite, filesystem,
or transport authority. Every save canonicalizes the complete Source, including root `authoring`
and all extension values, enforces the 8 MiB ceiling, and re-admits the stored or returned bytes
before exposing a detached recursively frozen result. Missing, created, unchanged, updated,
conflict, exhausted, definite-failure, and indeterminate outcomes remain explicit. An uncertain
write is never retried or merged automatically and is resolved only by reopening.

`@desen/editor-web` supplies the local adapter for the exact lexical origin
`http://127.0.0.1:<port>`. It requires an explicitly injected fetch-shaped callback, bearer token,
redirect rejection, bounded strict JSON, and the M07-T05 generation headers. It has no implicit
global-fetch fallback, retry, merge, filesystem, or SQLite authority. The existing
`openLocalControlPlane` SQLite/filesystem implementation remains the unchanged durability
authority. Real integration opens two control-plane instances against one OS-temporary native
SQLite database, proves one CAS winner and one conflict, closes and reopens at generation 3, and
preserves the canonical complete Source with root authoring and all 16 extension locations. A
durably dispatched PUT whose response is hidden returns `indeterminate`; reopening resolves the
winner.

The focused core persistence suite passes 10/10. The cumulative built core public-package suite
passes 49/49 with 96 compiler-negative assertions. The Web adapter passes 12/12 focused cases and
3/3 public-package cases with six compiler-negative assertions. The independent root proof passes
10/10 and authenticates 218 tracked receipts, including 180 emitted distribution receipts. Exact
evidence is the 49,785-byte
`docs/proof/artifacts/editor-core-0.1.0-persistence.json` at
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe` and
`docs/proof/EDITOR-CORE-PERSISTENCE.md`. The current CI successor contains 168 workloads and 79
proof pairs. Append-only checkpoint sequence 36 authenticates 33 frozen artifacts and 66 current
readers while preserving every M08-T07 and earlier artifact byte; historical T01–T07 hashes remain
unchanged. These are local code-owned results and make no hosted M08-T08 claim.

`N-012`, `N-018`, and `S-003` remain `TESTED`; `P-17`, `P-18`, and every other proof or normative
status remain unchanged, and proof gates remain 8/13. Catalog semantic diagnostics and invalid-node
mapping remain M08-T09. Terminal React/DOM integration, cross-command determinism, and G08 remain
M08-T10. Overall implementation progress is 93/145 (64%), M08 is 8/10, and M08-T09 is next.

M08-T09 is `DONE`. `@desen/editor-core` now exposes a pure synchronous Catalog-bound continuous
validator. The factory captures one detached immutable Catalog set and returns no partial validator
when Catalog admission fails. Each validation call re-admits the direct editor Source once and uses
that single immutable snapshot for cumulative execution-contract diagnostics, complete dynamic
obligations, an RFC 8785 document fingerprint that includes root `authoring`, and deterministic
invalid-subject mapping. The Catalog-set fingerprint is array-order-sensitive.

Invalid mapping uses only the Validator's explicit `context.surfaceId` and `context.subject`.
Pointers, codes, messages, and capability identifiers never infer identity. Every matching node or
behavior occurrence is retained in stable order, cross-kind text matches remain separate, and a
diagnostic without an explicit current subject remains a controlled unmapped index. Obligations do
not make an otherwise valid Source invalid. The boundary is platform-neutral and adds no React,
DOM, timer, worker, adapter, persistence generation, filesystem, network, or execution authority.

The focused continuous-validation suite passes 12/12 with nine compiler-negative assertions. The
cumulative editor-core suite passes 140/140; the built public-package contract passes 50/50 with
102 compiler-negative assertions; and the independent root proof passes 8/8. Exact evidence is
recorded in `docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md` and the exact 40,099-byte
`docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json` at
`sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a`. The proof directly
authenticates the frozen M08-T03 through M08-T07 artifacts; M08-T08 remains a tested current-package
compatibility sibling rather than a formal prerequisite. The current CI successor contains 170
workloads and 80 proof pairs: 69 ordinary pairs and 11 barriers. Append-only checkpoint sequence 37
authenticates 34 frozen artifacts and 68 current readers while preserving every sequence-36 and
earlier artifact byte.

`N-012`, `N-014`, `N-018`, and `S-003` remain `TESTED`; `S-002` remains `PLANNED` for terminal
integration, `P-18` remains `PARTIAL`, and no proof-gate or other normative status changes. Overall
implementation progress is 94/145 (65%), M08 is 9/10, proof gates remain 8/13, and M08-T10 is next.

M08-T10 and G08 are `DONE`. This terminal proof adds no production helper or public export. It
authenticates every exact frozen M08-T01–M08-T09 artifact plus the M01-T05, M04-T16, and M04-T17
platform/JSON-trace authorities, copies the exact emitted editor-core dependency graph into two
independent temporary ESM graphs, and runs the same ordered 32-step transcript in each. The
transcript covers the insert command, all three structural commands, all fourteen content
commands, all eight state/binding commands, and all six event/action commands. Every successful
transition returns a fresh recursively frozen direct Source and leaves its predecessor unchanged.
Insertion adds only `sign-in.terminal`, deletion removes only the prepared
`sign-in.terminal-delete` subtree, and the other thirty transitions preserve the complete
node/behavior identity multiset. One interleaved missing-target command fails atomically without a
partial document and the next valid command resumes from the byte-exact snapshot.

The terminal Source passes the frozen M08-T09 Catalog-bound validator with zero diagnostics, seven
retained dynamic obligations, and no invalid or unmapped subjects. An injected in-memory
compare-and-set adapter exercises the M08-T08 port through generation-one save/open with exact
canonical Source bytes. Two Sources that differ only in root `authoring` retain the same protocol
Source digest and receive distinct complete-document fingerprints. Both independent graphs produce
byte-identical terminal Sources, identity ledgers, validation reports, persistence receipts, and
callback-free JSON/RFC 8785 trace commitments.

The focused terminal suite passes 4/4; the full editor-core package passes 144/144; the public
package remains 50/50 with 102 compiler-negative assertions; and the independent root proof passes
10/10 with its exact verifier. TypeScript AST inspection covers all nine editor-core source files,
all nine emitted JavaScript files, and all nine emitted declaration files. The accepted graph has
only relative, `@desen/protocol`, and `@desen/validator` static edges and no React, ReactDOM,
DOM/browser, Node-platform, CSS, dynamic-import, `eval`, or function-constructor authority. Exact
evidence is the 325,549-byte
`docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json` at
`sha256:5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b` and the reviewed
`docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md` report.

This completes the UI-independent editor core and advances `S-002` to `TESTED`, P-18 to `PROVEN`,
and G08 to `DONE`. It does not claim a React renderer or DOM behavior, selection/viewport/undo
policy, multi-user synchronization, concrete durable storage or network transport, dynamic
obligation execution, a hostile-JavaScript sandbox, or streaming/preallocation memory-DoS bounds.
Overall implementation progress is 95/145 (66%), M08 is 10/10, proof gates are 9/13, and M09-T01
is next.

## M09 — Desen App Web MVP

| ID      | Status | Depends on               | Deliverable / evidence                                                          |
| ------- | ------ | ------------------------ | ------------------------------------------------------------------------------- |
| M09-T01 | DONE   | G08                      | Desen App shell and project navigation                                          |
| M09-T02 | DONE   | M09-T01                  | Catalog-driven component panel and layer tree                                   |
| M09-T03 | DONE   | M09-T01, G05             | Canvas uses the exact React adapters used by the reference host                 |
| M09-T04 | DONE   | M09-T03                  | Selection overlays remain outside capability subtrees; no private-DOM authoring |
| M09-T05 | DONE   | M09-T02–M09-T04          | Schema-driven primitive/enum inspector controls                                 |
| M09-T06 | DONE   | M09-T05                  | Nested-object controls and honest structured-JSON fallback                      |
| M09-T07 | DONE   | M09-T02–M09-T06          | Named-slot drop, move, reorder, cardinality, and acceptance UI                  |
| M09-T08 | DONE   | M09-T05                  | Local state and binding editor UI                                               |
| M09-T09 | DONE   | M09-T08                  | Sign-in event and closed-action editor UI                                       |
| M09-T10 | DONE   | M09-T03, M09-T08–M09-T09 | Design/Run modes on the same source tree                                        |
| M09-T11 | DONE   | M09-T10                  | Fixtures, scenarios, and visible approximate-fidelity disclosure                |
| M09-T12 | DONE   | M09-T01, M08-T08         | Save/open UI through editor persistence port                                    |
| M09-T13 | DONE   | M09-T04–M09-T11          | Node-linked diagnostics and selectable invalid placeholders                     |
| M09-T14 | DONE   | M09-T10–M09-T13, G07     | Publish to control plane and reference-host channel activation                  |
| G09     | DONE   | M09-T01–M09-T14          | User authors, tests, saves, and publishes sign-in visually                      |

M09-T01 establishes the first application-owned React/Vite shell behind the exact completed G08
prerequisite. It provides a full-viewport project gallery, project-level surface galleries, a
centered inert surface frame, the closed `/projects`, `/projects/:projectId`, and
`/projects/:projectId/surfaces/:surfaceId` route profile, same-origin History API navigation,
browser traversal, fixed inert fixture search, explicit fail-closed not-found recovery, responsive
presentation, and keyboard/accessibility behavior. The M09 UX wireframe informed information
architecture and task boundaries, while the earlier Desen product exploration informed the visual
language. Neither Figma source is executable input, architecture, or proof authority.

The application build, typecheck, and lint pass locally; the focused application suite passes
43/43 and the independent mutation suite passes 8/8. The exact 12,118-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json` at
`sha256:c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220`, covering 24 tracked
files, including five repository-owned SVG assets, and 43 runtime cases. Append-only checkpoint
sequence 40 passes 63/63 and closes at
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e`, authenticating 36
frozen artifacts and 72 readers. The historical M09-T01 CI successor contained 174 workloads and
82 proof pairs, split into 71 ordinary pairs and 11 barriers. These local receipts make no
required-gate or hosted-CI claim.

This slice does not implement a Catalog-driven component panel, layer tree, real adapter canvas,
selection or inspector state, Source mutation, diagnostics, persistence UI, user-created project
persistence, Design/Run execution, publication, or channel activation. It changes no frozen DESEN
0.1.0 byte and advances no `P-*`, `N-*`, `S-*`, or proof-gate status. M09-T01 is `DONE`; overall
implementation progress is 96/145 (66%), M09 is 1/14, proof gates remain 9/13, and M09-T02 is next.

M09-T02 adds a read-only Components/Layers panel to the authenticated shell. The Components view
projects the exact five-component `@desen/reference-catalog-web/catalog.json` library with
Catalog-owned labels and authoring categories. The Layers view preserves the exact validated
`home` and `sign-in` Source trees, component and behavior identities, named slots, conditional
markers, and child-array order. Local component filtering does not insert or mutate anything, and
the nested layer navigation does not claim interactive tree or selection semantics.

The app first calls `validateDesenInteractionCatalogSet`, then validates the official Source with
`validateDesenSourceInteractionContracts` against that accepted cumulative set. Catalog rejection,
Source rejection, and bounded-projection failures return no partial model. A surface without an
exact Source tree reports the absence and never substitutes the sign-in tree. The exact 25,375-byte
artifact is `docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json` at
`sha256:85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61`; the focused app
authoring suite passes 18/18 and the independent root proof passes 8/8.

The live local M09-T02 CI authority contains 176 workloads and 83 proof pairs, split into 72
ordinary pairs and 11 barriers. Its formal impact entry has the exact M09-T01 shell and M03-T10
reference capability as parents and selects 66 affected workloads; the local task wrapper verifies
those prerequisite artifacts directly instead of recursively replaying their predecessor chains.
Append-only checkpoint sequence 41 passes 64/64 and closes at
`sha256:b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68`, authenticating 37
frozen artifacts and 74 readers while preserving exact sequence 40 at
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e` and every predecessor.
These are local task and CI-infrastructure receipts; they make no required-gate or hosted-CI claim.
The first hosted PR run exposed a workspace-target symlink denied by Node's permission model. The
resealed fixture now uses only absolute runner-temporary targets, and its exact isolation suite
passes 8/8 without widening permissions; no hosted pass is claimed yet.

This slice adds no real adapter canvas, selection, inspector, insertion, drag/drop, Source mutation,
persistence, Design/Run execution, diagnostics, publication, or activation. It changes no frozen
DESEN 0.1.0 byte and advances no `P-*`, `N-*`, `S-*`, `G*`, or proof-gate status. M09-T02 is
`DONE`; overall implementation progress is 97/145 (67%), M09 is 2/14, proof gates remain 9/13, and
M09-T03 is next.

M09-T03 replaces the inert sign-in placeholder with an exact managed Web–React canvas. The App
mounts the controlled official-derived Bundle through the public Runtime Core session boundary,
preflights the public static `@desen/reference-catalog-web/react-adapters` registry, and renders
the committed live surface through the public Runtime React hook and boundary. The route must
match the exact `account-app` / `sign-in` tuple, `com.example.account-app` document, and
`sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb` revision. All
managed controls remain disabled behind inert all-deny host ports. Unsupported tuples do not mount
or substitute sign-in, and route replacement, Strict Mode replay, and final unmount dispose the
exact session.

The exact 73,111-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json` at
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`. The focused canvas
suite passes 20/20, the complete App suite passes 56/56, the independent root proof passes 11/11,
and App typecheck, lint, and production build pass locally. Two deterministic Vite
`build({ write: false })` observations each contain 102 modules, 290 static imports, no dynamic or
unresolved imports, and 101 backing files. The controlled managed slice shares exactly 19
transformed runtime/component module identities with the frozen host source audit and reaches all
five real components.

The live local M09-T03 CI authority contains 178 workloads and 84 proof pairs, split into 73
ordinary pairs and 11 barriers. Its formal impact parents are exactly the M09-T01 shell and M05-T09
reference-host source audit, producing a closure of 51 proof units and 112 workloads. Append-only
checkpoint sequence 42 passes 65/65 and closes at
`sha256:40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5`, authenticating 38
frozen artifacts and 76 readers while preserving exact sequence 41 at
`sha256:b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68` and every predecessor.
These are local task and CI-infrastructure receipts; they make no required-gate or hosted-CI claim.

M09-T03 is `DONE`, advancing P-06 to `PROVEN`, implementation progress to 98/145 (68%), M09 to
3/14, and proof gates to 10/13. `S-001` remains `PLANNED` because M09-T11 owns the visible
approximate-fidelity disclosure. PF-059 remains `OPEN` and P-07 remains `PARTIAL` pending the
M10-T05 browser-E2E proof. Selection/private-DOM overlays, inspector editing, insertion, structural
mutation, drag/drop, state/action editing, Design/Run mode, fidelity disclosure, persistence,
diagnostics, publication, and activation remain M09-T04 and later tasks. M09-T04 is next.

M09-T04 adds route-local Source-identity selection without placing authoring state or chrome inside
the managed capability subtree. Selection contains only exact primitive project, surface,
Source-node, capability, display, and conditional data minted from the validated authoring model.
Its runtime projection reads only the public callback-free diagnostic index, preserves repeated
component instances, filters attached behavior identities, represents an absent runtime instance
only for an explicitly conditional Source component, and rejects unknown, stale, cross-route, or
forged identities without an overlay.

The Runtime React boundary remains inside the disabled managed fieldset. Desen App renders one
compact pointer-inert identity/status card as its DOM sibling, outside the marked capability
subtree, with no managed child, DOM/native handle, private React value, registry, session, callback,
hit-test, or geometry authority. Native layer buttons expose dynamic Select/Deselect names,
`aria-pressed`, conditional context, wrapped keyboard navigation, and immediate live feedback;
route replacement resets selection synchronously. Desktop and mobile interaction checks are
manual product verification rather than browser-E2E evidence.

The exact 11,997-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json` at
`sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1`, authenticated against
the exact 73,111-byte M09-T03 parent at
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`. The focused App
selection suite passes 27/27, the independent root proof passes 10/10, and App typecheck, lint, and
production build pass locally. The live local CI authority contains 180 workloads and 85 proof
pairs, split into 74 ordinary pairs and 11 barriers. The selection-overlay connected closure
contains 52 proof units and 114 workloads; complete ownership covers 1,164 tracked paths and 170
proof-owned paths. Sequence 43 passes 66/66 at
`sha256:0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58`, preserves sequence 42
and all 38 predecessor artifacts, appends T04 artifact index 38, reseals predecessor compatibility
readers `[70, 71, 72, 73, 74, 75]`, and appends T04 proof/root readers `[76, 77]`. The current
chain contains 39 artifacts and 78 readers, and the structural CI suite passes 317/317 locally.
No required-gate or hosted-CI pass is claimed.

M09-T04 is `DONE`, advancing implementation progress to 99/145 (68%) and M09 to 4/14 while proof
gates remain 10/13. `N-042` advances to `TESTED` for this exact controlled Web–React profile;
P-06 remains `PROVEN`, and P-07/P-16 remain `PARTIAL`. No component geometry, hit testing, canvas
picking, inspector, Source mutation, insertion/cardinality/drag-drop, state/action authoring,
Design/Run mode, diagnostics navigation or placeholders, persistence, browser E2E, publication, or
activation is claimed. M09-T05 is next.

M09-T05 adds one App-owned Inspector for the exact selected Source component. The control plan is
derived through the public Catalog SDK from the exact validator-admitted component `propsSchema`;
string, boolean, number, integer, and primitive-enum descriptors receive native controls. Dynamic
`$ref` values remain visible but locked for M09-T08, while group and structured descriptors remain
visible but locked for M09-T06. Labels and descriptions are presentation metadata only; the schema
descriptor remains mutation authority.

Each requested edit is first captured as an exact own enumerable data snapshot. Proxy-backed
commands are consumed only through that captured own data without invoking property getters, while
accessor, extra-field, and symbol-bearing commands are rejected. Route, selection, Source node,
capability, control identity, requiredness, current value kind, and primitive type are re-derived
from the current immutable document and Catalog. Accepted set/delete operations use public Editor
Core commands, and the complete resulting Source must pass the public continuous Catalog validator
before success can be returned. Stale or forged identities, invalid enum and numeric forms,
required or absent deletion, dynamic/structured edits, and schema-invalid values fail closed with
no partial Source.

Every Editor Core success remains provisional until the public Publisher accepts the complete
candidate Source against the exact reference Catalog package candidate. The App replaces one
session-owned `{document, preview}` state only after that preflight succeeds. A Publisher rejection,
including an oversized but schema-valid string, retains both the prior Source and working preview;
an accepted Bundle revision replaces the exact Runtime session and disposes its predecessor. The
Inspector is an App-owned `aside` outside the disabled managed fieldset and marked capability
subtree, with no private DOM/native, geometry, hit-test, canvas-picking, registry, session, or
runtime-callback authority.

The exact 22,998-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json` at
`sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`. It authenticates exact
M09-T02 Catalog-panel, M09-T04 selection-overlay, and M06-T10 Publisher official-golden parents.
The focused App Inspector suite passes 41/41, the complete App suite passes 86/86, the independent
root proof passes 10/10, and App typecheck, lint, and production build pass locally. The live local
CI inventory registers 182
workloads and 86 proof pairs—75 ordinary and 11 barriers—with a 53-proof-unit/116-workload
connected closure and complete ownership over 1,175 tracked paths, including 172 proof-owned paths.
Sequence 44 passes 67/67 at
`sha256:f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c`, preserving its first
43 checkpoints while extending the chain to 40 artifacts and 80 readers. The complete structural
CI suite passes 320/320 locally. These are local task and CI-infrastructure receipts; no
required-gate or hosted-CI pass is claimed.

M09-T05 is `DONE`, advancing implementation progress to 100/145 (69%) and M09 to 5/14 (36%) while
proof gates remain 10/13. P-08 remains `NOT_PROVEN`: nested-object/structured-JSON editing,
state/binding and event/action authoring, Design/Run, persistence, browser E2E, control-plane
publication, and activation remain later owners. M09-T06 is next.

M09-T06 consumes the complete recursive Catalog SDK control plan. Present closed-object groups
retain canonical child order, qualified accessible names, and exact RFC 6901 value and schema
pointers, including escaped `/` and `~` property names. Nested edits rebuild only the complete
top-level owner prop through public Editor Core commands. An absent optional group is staged as one
complete JSON object and set atomically. Arrays, open objects, unions, references, combinators,
conditionals, pattern properties, unsupported schemas, and derivation-limit results remain editable
through an explicit structured-JSON textarea with a visible reason and Apply, Reset, and eligible
Unset actions. Catalog control hints remain opaque presentation metadata under PF-025.

Structured input is scanned under the Publisher Source JSON profile before `JSON.parse`. Malformed
or non-finite JSON, decoded duplicate members, unpaired Unicode, finite-limit overflow, and every
decoded object key beginning with `$` fail closed without a partial value. Successful values are
detached and recursively frozen. Formatting sorts object keys while preserving array order; if
pretty indentation would exceed the same admitted profile, accumulation stops early and falls back
to compact canonical JSON.

Route, selection, and edit inputs are captured as exact own enumerable data before authorization.
Mutation starts from the exact validator-admitted Source and Catalog snapshots, closing hostile
caller and time-of-check/time-of-use drift. Root replacement counts only changed props, rejects
more than 256 public transitions or 32 MiB of aggregate snapshot work, and performs deletions and
shrinking replacements before growth. Complete continuous validation and Publisher preflight still
precede the atomic session-local `{document, preview}` replacement. Recursive fieldsets, inline
errors, pointer-keyed focus handoff, and structured actions remain App-owned outside the managed
capability subtree.

The exact 26,133-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json` at
`sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`. It authenticates the
exact frozen 22,998-byte M09-T05 schema-Inspector parent and records 28 tracked-file receipts. The
focused structured-Inspector suite passes 73/73, the complete App suite passes 118/118, the
independent root proof passes 10/10, the complete structural CI glob passes 323/323, and App
typecheck, lint, and production build pass locally.
The live local CI inventory registers 184 workloads and 87 proof pairs—76 ordinary and 11
barriers—with a 54-proof-unit/118-workload connected closure and complete ownership over 1,184
tracked paths, including 174 proof-owned paths. Sequence 45 preserves all predecessors and contains
41 artifacts and 82 readers. These are local task and CI-infrastructure receipts; no required-gate
or hosted-CI pass is claimed.

M09-T06 is `DONE`, advancing implementation progress to 101/145 (70%) and M09 to 6/14 (43%) while
proof gates remain 10/13. P-08 remains `NOT_PROVEN`, PF-025 remains `OPEN`, dynamic-value editing
remains M09-T08, and slot/cardinality, state/action, Design/Run, persistence, browser-E2E,
publication, and activation owners remain outstanding. M09-T07 is next.

M09-T07 turns the Catalog-declared named slots already projected by the App into one bounded
authoring surface. Layers expose every valid insertion boundary for click/keyboard placement and
App-owned drag intent. The compatibility patch makes neighboring boundary targets non-overlapping
and lets each row's top and bottom halves resolve to the adjacent deterministic boundary, so a
narrow inter-row gap is not the only target. Components retains a sticky target card naming the
selected owner, slot, cardinality, and next position. Successful insertion auto-selects the new
component and exposes the existing safe Delete action. Browser `DataTransfer` contains only an
inert hint and is never mutation authority.

Every insert, cross-slot move, same-slot reorder, and selected-subtree delete is re-authorized
against the exact current route, Source, Catalog capability identity, slot acceptance rule, and
effective minimum/maximum. Root deletion, a source-slot minimum violation, stale or cross-route
selection, cycle, invalid index, rejected capability/category, oversized default staging, and
complete-validation failure produce no partial Source. Accepted operations use only public Editor
Core commands, preserve stable Source identities and slot order, pass complete continuous
validation, then require Publisher preflight before the App atomically replaces its session-owned
`{document, preview}`. Successful deletion clears the stale selection and returns focus to Layers;
a rejected deletion preserves selection, preview, and control focus.

The focused named-slot suite passes 70/70, including 27/27 pure slot cases; the complete App suite
passes 151/151, the independent root proof passes 9/9, and the complete structural CI glob passes
329/329. The exact 24,830-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json` at
`sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f`. It authenticates the
exact frozen M09-T06 structured-Inspector parent and the current compatibility readers for
M09-T01–M09-T06. Append-only checkpoint sequence 46 passes 69/69 at
`sha256:f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f`, preserving every
predecessor while extending the chain to 42 artifacts and 84 readers.

The live local CI inventory contains 186 workloads and 88 proof pairs—77 ordinary pairs and 11
barriers. M09-T07's connected closure contains 55 proof units and 120 workloads; complete
ownership covers 1,192 tracked paths, including 176 proof-owned paths. The in-app browser was used
to inspect the targetless guide, explicit selected-slot target, click/keyboard insertion, enabled
delete affordance, root-delete explanation, and an error-free console. Native browser drag-event
automation was not observed, so the real-browser E2E claim remains explicitly open; the complete
dragStart/dragEnter/dragOver/drop chain is covered by the focused App tests.

M09-T07 is `DONE`, advancing implementation progress to 102/145 (70%) and M09 to 7/14 (50%) while
proof gates remain 10/13. P-08 remains `NOT_PROVEN`, PF-025 remains `OPEN`, and dynamic
state/binding editing, event/action authoring, Design/Run, durable save/open, real-browser E2E,
publication, and activation remain later owners. M09-T08 was the next owner.

M09-T08 adds one bounded surface-local primitive-state and direct-binding authoring profile. The
State panel deterministically lists directly addressable declarations and supports add,
initial-value update, and unused delete for string, boolean, number, and integer state. A bounded
conservative usage scan displays reference counts and prevents deletion of referenced declarations;
the exact current Source is rechecked when the edit is applied. Unsupported and non-preset schema
shapes remain visible but read-only rather than being guessed into editable controls.

The Inspector can attach a compatible property to one exact direct `state.<name>` reference,
change that reference, or detach it back to the declaration's validated primitive initial value.
Compatibility comes from the authenticated Catalog `propsSchema`, not opaque authoring hints.
Operation, context, event, item, environment, and resource references plus fallback, token, format,
nested, or otherwise advanced dynamic values remain read-only. State schema and initial documents
use inert JSON capture, so marker-shaped `$` members remain state data rather than being interpreted
as `ValueSpec` authority.

Accepted edits use public Editor Core state/binding commands, complete continuous validation, and
Publisher preflight before one atomic session-local `{document, preview}` replacement. Rejected,
stale, incompatible, in-use, malformed, or over-budget requests expose no partial Source or
preview. The focused `test:state-bindings` suite passes 109/109. The final structural receipt is
`278/278`; exact evidence is the
`28,766`-byte
`docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json` at
`sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a`.

The live local CI inventory contains 188 workloads and 89 proof pairs—78 ordinary pairs and 11
barriers. M09-T08's connected closure contains 56 proof units and 122 workloads; complete ownership
covers 1,202 tracked paths, including 178 proof-owned paths. Append-only checkpoint sequence 47
contains 43 artifacts and 86 readers at `sha256:c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7`. These are local receipts;
no required-gate, hosted-CI, native-drag, or real-browser E2E pass is claimed.

M09-T08 is `DONE`, advancing implementation progress to 103/145 (71%) and M09 to 8/14 (57%) while
proof gates remain 10/13. P-08 remains `NOT_PROVEN`, PF-025 remains `OPEN`, and event/action
authoring, Design/Run, durable save/open, real-browser E2E, publication, and activation remain later
owners. M09-T09 is next.

M09-T09 adds one component-scoped Events & Actions view for the exact selected Source component.
The projection exposes only events declared by that component's authenticated Catalog contract and
keeps absent, present-empty, and present-nonempty handler states distinct. Behavior-owner UI is not
claimed; forged behavior selections fail closed. Handler creation/deletion and complete action
insert, replace, reorder, and delete operations use exact canonical escaped owner-relative pointers.

The editor covers the closed seven-action union: `component.command`, `event.emit`, `navigate`,
`operation.invoke`, `resource.refresh`, `state.set`, and `state.toggle`. Operation success and
failure lists remain recursively addressable. Whole-action JSON is captured as inert data and
committed only on explicit Apply; intermediate drafts do not mutate Source. Every accepted edit
uses a public Editor Core transition, complete Source revalidation, and Publisher preflight before
one atomic session-local `{document, preview}` replacement. A failed edit or preview preflight
preserves the prior handler projection, canvas, selection overlay, and managed capability subtree.

The pure projection suite passes 12/12, the panel suite passes 7/7, the focused
`test:event-actions` suite passes 84/84, the complete App suite passes 202/202, and the independent
root proof passes 10/10. The complete structural CI receipt passes 282/282. Exact evidence is the `23,812`-byte
`docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json` at
`sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`.

The live local CI inventory contains 190 workloads and 90 proof pairs—79 ordinary pairs and 11
barriers. M09-T09's connected closure contains 57 proof units and 124 workloads; complete ownership
covers 1,212 tracked paths, including 180 proof-owned paths. Append-only checkpoint sequence 48
contains 44 artifacts and 88 readers at
`sha256:5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90`; its checkpoint suite
passes 71/71. These are local receipts; no required-gate, hosted-CI,
real-browser E2E, action-execution, Design/Run, persistence, publication, or activation pass is
claimed.

M09-T09 is `DONE`, advancing implementation progress to 104/145 (72%) and M09 to 9/14 (64%) while
proof gates remain 10/13. P-08 remains `NOT_PROVEN`; PF-025 and PF-083 remain `OPEN`; Design/Run,
durable save/open, diagnostics navigation, real-browser E2E, publication, and activation remain
later owners. M09-T10 is next.

M09-T10 adds one App-owned closed Design/Run mode to the controlled sign-in editor. The toggle
changes only presentation and interaction admission: both modes retain one immutable session-local
`{document, preview}`, the same Source and Bundle revisions, the same Runtime session, and the same
managed Runtime React subtree. Mode is absent from Runtime mount identity, so toggling neither
remounts nor disposes the Runtime and preserves Runtime local state, current Source selection,
active authoring view and search, and unapplied Inspector drafts. Transient drag intent is cleared,
and a newly mounted surface route starts in Design.

Design disables managed adapter controls while admitting App-owned selection and authoring. Run
hides the App-owned panels and selection overlay, centrally rejects all seven retained authoring
callback paths, enables the real adapter, and exercises the exact adapter event → Runtime React →
Runtime Core → closed `state.set` action → same-subtree rerender path. Navigation, operation, and
resource ports remain deny-only; storage and token reads are missing, writes conflict, and the
remaining local host surfaces stay bounded and inert. The mode control exposes one named group,
pressed-state buttons, focus recovery, and a live safety status.

The closure retains M09-T07 interaction hardening without widening its proof boundary. Components
drag resolves to a root-safe default target and exposes an explicit Layers target-change action;
Layers uses enlarged drop lanes and retains the last valid row projection through drop; the
selected layer exposes a visible Delete action and guarded Delete/Backspace shortcuts outside
editable controls. Named-slot, cardinality, continuous-validator, and Publisher-preflight
authority remain unchanged. No arbitrary canvas geometry, hit-testing, or native-drag E2E is
claimed.

The adapter suite passes 9/9, the application suite passes 35/35, focused `test:design-run` passes
44/44, the complete App suite passes 210/210, and the independent root proof passes 10/10. Exact
evidence is the `17,900`-byte
`docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json` at
`sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`. The checkpoint,
promotion, and complete serial structural suites pass 72/72, 19/19, and 339/339.

The live local CI inventory contains 192 workloads and 91 proof pairs—80 ordinary and 11 barriers.
M09-T10's connected closure contains 58 proof units and 126 workloads; complete ownership covers
1,218 tracked paths, including 182 proof-owned paths. Append-only checkpoint sequence 49
contains 45 artifacts and 90 readers at
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e`.
These are local receipts. Manual browser QA exercised the Design/Run switch and Run interaction
plus the automatic default placement target, visible Delete action, editable-control Backspace
guard, and successful Delete shortcut, but it is not an automated real-browser or native-drag E2E
result; no required-gate or hosted-CI pass is inferred.

M09-T10 is `DONE`, advancing implementation progress to 105/145 (72%) and M09 to 10/14 (71%) while
proof gates remain 10/13. P-09 is only `PARTIAL` for the exact controlled `state.set` path; P-08
remains `NOT_PROVEN`; S-001 remains `PLANNED`; and PF-025, PF-028, and PF-083 remain `OPEN`.
Fixtures, scenarios, visible approximate-fidelity disclosure, durable save/open, diagnostics
navigation and placeholders, publication, activation, and automated real-browser E2E remain later
owners. M09-T11 is next.

M09-T11 adds Catalog-declared props-only scenarios as separate transient previews without changing
the authored Source or its publishable preview. Scenario admission rechecks the exact route, node,
capability, Source revision, and preview revision; authored values and Catalog scenarios remain
distinct, while scenario state or fixture overrides fail closed. Design/Run changes preserve the
active scenario because mode remains presentation-only.

The Run chrome now exposes the public testkit sign-in fixture projection through one explicitly
synthetic App-owned controller. Only exact success and declared `invalidCredentials` outcomes are
selectable. The real adapter action publishes Runtime pending before explicit settlement; request
input and password data are neither read nor retained. Integration and production contexts remain
visible but unavailable. Cleanup synchronously closes admission and revokes pending transport,
StrictMode may reactivate only the same live controller, and preview replacement revokes its
predecessor before late settlement can publish.

Persistent App-owned chrome discloses `same`, `equivalent`, `approximate`, or `undeclared` adapter
fidelity and lists every known approximate difference. Missing or invalid metadata resolves
conservatively to `undeclared`; the exact reference sign-in slice reports the already authenticated
production adapter. The retained authoring compatibility patch gives Components one real drag
handle and a panel-wide insertion target, Layers one stable global nested-slot projection with
midpoint hysteresis, and a newly inserted selection an immediately visible guarded Delete action.
Browser transfer bytes and managed-tree geometry remain non-authoritative.

The focused App suite passes 86/86, the complete App suite passes 252/252, and the independent root
proof passes 11/11. Exact evidence is
the `29,407`-byte
`docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json` at
`sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`. It authenticates the
exact M09-T10 Design/Run, M03-T08 sign-in fixture, and M03-T09 reference-parity parents and binds 28
tracked files. These are local task receipts; no required-gate, hosted-CI, real-browser, or
native-drag result is inferred.

The live local CI authority contains 194 workloads and 92 proof pairs—81 ordinary and 11 barriers.
M09-T11's connected closure contains 59 proof units and 128 workloads; complete ownership covers
1,232 tracked paths, including 184 proof-owned paths. These CI inventory and ownership receipts are
local and make no hosted result claim.

Append-only proof-reader sequence 50 advances exact predecessor
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 frozen
artifacts and 92 current readers. The checkpoint, promotion, selector plus required-affected,
ownership, and remaining touched-CI regression suites pass 73/73, 19/19, 56/56, 15/15, and 127/127.

Manual in-app browser inspection confirms the explicit Components insert target, dedicated grip,
click-to-add path, immediate visible Delete control, and stable Layers gaps. The available browser
client exposes no native drag automation method, so this inspection is not promoted to automated
real-browser/native-drag E2E; the complete drag event chain remains focused-test evidence.

M09-T11 is `DONE`, advancing implementation progress to 106/145 (73%) and M09 to 11/14 (79%) while
proof gates remain 10/13. N-035 and S-001 advance to `TESTED`; P-09 and P-10 remain `PARTIAL`, P-08
remains `NOT_PROVEN`, and N-036 remains `PLANNED`. PF-028 closes because pending is now exercised
as Runtime lifecycle rather than static fixture data; PF-025, PF-083, and the new non-blocking
PF-089 remain `OPEN`. Durable save/open, diagnostic navigation and invalid placeholders,
publication, activation, and automated real-browser E2E remain later owners. M09-T12 is next.

M09-T12 consumes only the public Editor Core `DesenEditorPersistencePort` through one App-owned,
Design-only persistence controller. The exact `account-app/sign-in` route derives one fixed
`account-app-source` key independently of `Source.id`; the App imports no concrete Editor Web,
control-plane, browser-storage, native-storage, or filesystem adapter.

Open publishes a replacement only after the complete stored Source, exact document identity,
Catalog projection, surface, and publishable preview are admitted together. Missing, failed,
rejected, wrong-document, edited-in-flight, disposed, and stale-lifetime results preserve the
current authored draft. Save dispatches only the immutable authored Source snapshot and exact
expected generation. Create, update, and unchanged remain distinct; conflict, exhausted
generation, and indeterminate commit require explicit reopen with no retry or merge. Complete
admitted authored Source canonical content—not identity or document version—determines dirty state.
Same-value replacements and canonical reverts are clean; successful Open/Save establish baselines,
current-vs-dispatched-snapshot comparison preserves newer edits, and `reopenRequired` remains
authoritative until an admitted Open.

Awaited Open/Save results are captured from exact own enumerable data without accessor invocation.
Valid optional diagnostic pointer/context/subject data is copied into fresh frozen values, and every
CAS result must satisfy the dispatched generation relationship. Malformed Open remains a retryable
failure with the draft intact; malformed Save becomes indeterminate and reopen-required. Token
rechecks after settlement reflection and opened-document admission prevent reentrant edit/dispose
from publishing stale authority.

Dirty Open requires explicit cancelable inline confirmation. One centralized authored-session
commit path updates surface-owned canonical baseline/current refs and a rerender-safe no-port dirty
projection. The current surface/controller guard admits pristine no-port navigation. Its exact
clean label is `Local draft unchanged`. Edited no-port and port-backed dirty drafts require
admission across App navigation and browser traversal. Owner-safe cleanup cannot revoke a newer surface, and `beforeunload` protects
dirty page exit. Generation, dirty, pending, definite failure, conflict/uncertainty, exhaustion, and
reopen-required state remain visible without color-only meaning. Scenario previews, fixture
lifecycle, Runtime input, and secrets never enter persistence.

The retained authoring UX gives each compatible Components card a dedicated dotted native-drag
grip and keeps click insertion on a separate `Add` button. The complete authenticated Components
panel accepts the drop for the target summarized by the sticky `Add to` card. Layers starts
movement only from a dedicated dotted grip, fences the innermost nested-slot owner and drag epoch,
applies midpoint hysteresis, keeps compact insertion lanes layout-stable while each visible row
projects its before/after half, shows accepted and current-position feedback, and retains the last
admitted placement through coordinate-less or rejected release drift. A successful insert switches
to Layers, focuses the new node, and exposes the guarded `Remove layer` control plus
Delete/Backspace shortcuts.

The focused five-file persistence suite passes 142/142, the complete twenty-two-file App suite
passes 324/324, and the independent root mutation proof passes 12/12. Exact evidence is the
27,053-byte `docs/proof/artifacts/desen-app-0.1.0-source-persistence.json` at
`sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`. It authenticates exact
M09-T01, M08-T08, and M09-T11 parents and binds 35 current files without tracking historical App
readers.

The live local CI inventory contains 196 workloads and 93 proof pairs—82 ordinary and 11 barriers.
M09-T12's connected closure contains 60 proof units and 130 workloads. Complete ownership covers
1,243 tracked paths, including 186 proof-owned paths, split into 186 proof-unit, 45 CI-policy, 31
dependency-policy, 137 frozen-input, 481 package/application, 223 shared-proof-infrastructure, 129
project-documentation, and 11 repository-policy paths. These are local inventory receipts and make
no required-gate or hosted-CI claim.

Append-only proof-reader sequence 51 advances exact sequence-50 predecessor
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` to
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` across 47 frozen
artifacts and 94 current readers. Checkpoint, promotion, selector plus required-affected,
ownership, and remaining touched-CI suites pass 74/74, 19/19, 58/58 (21 + 37), 15/15, and
128/128—294/294 combined.

M09-T12 is `DONE`, advancing implementation progress to 107/145 (74%) and M09 to 12/14 (86%) while
proof gates remain 10/13. `N-012`, `N-018`, and `S-003` remain `TESTED` with App-consumption
evidence. P-08 remains `NOT_PROVEN`, P-09/P-10 remain `PARTIAL`, and PF-085/PF-089 remain `OPEN`.
Diagnostics navigation and invalid placeholders, publication/activation, a concrete App storage
adapter, and automated real-browser E2E remain later owners. M09-T13 is next.

M09-T13 retains only the exact frozen continuous-validation report from a rejected edit candidate;
the invalid document never replaces the admitted authored Source, publishable preview, managed
Runtime session, dirty state, Save request, or persistence generation. The transient report is
fenced by exact candidate document and Catalog-set fingerprints, project/surface route, and the
still-current committed-document owner. The canvas independently reprojects it against the current
public Runtime React diagnostic index, and every stale or inconsistent identity fails closed
without partial navigation authority.

Only explicit `invalidSubjects` mappings from `context.surfaceId` plus `subject.kind` and
`subject.id` create selectable targets. Diagnostic pointer, code, message, capability, and
incidental context text never infer identity. Original order, duplicate occurrence pointers,
node/behavior distinction, unmapped diagnostics, and out-of-route diagnostics are preserved;
dynamic obligations remain visible inert metadata and are never executed. Selection stores only
an opaque snapshot-bound key and re-admits it from the current ready projection.

The compact App-owned Inspector section exposes mapped occurrences as native buttons, announces the
diagnostic count, marks the selected target with `aria-current`, and supports explicit dismissal
without autofocus. A selected occurrence renders an App-owned invalid-change placeholder outside
the managed Runtime subtree while preserving the current valid preview. Diagnostics and placeholder
interaction are Design-only; Run hides and inerts them, returning to Design does not steal focus,
and a successful edit or session replacement clears the rejected report.

The focused nine-file diagnostics suite passes 161/161, the complete twenty-four-file App suite
passes 339/339, and the root mutation proof passes 12/12. Exact task evidence is the 29,208-byte
`docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json` at
`sha256:8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972`, binding 39 current
files and eleven exact proof parents. The local CI inventory contains 198 workloads and 94 proof
pairs—83 ordinary and eleven barriers. The connected T13 closure contains 62 proof units and 134
workloads; ownership covers 1,253 tracked paths, including 188 proof-owned paths. The append-only
current-reader checkpoint advances sequence 51 head
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` to sequence 52 head
`sha256:c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9` across 48 frozen
artifacts and 96 current readers. Promotion pins the selector at
`sha256:872a061aeea1afe9f82f7578f0fa3cbcfe037a982fde40116e2c88c7e366e2e7` and the required-affected
runner authority at `sha256:1e08a5db4dc33d684a1e119a88dc5bd4f99e5b98cd0e468a81327c709c3ac2bb`.
Checkpoint, promotion, selector, required-affected, and CI quality-gate regression suites pass
75/75, 20/20, 22/22, 38/38, and 28/28 locally—183/183 combined. M09-T13 is `DONE`, advancing
implementation progress to 108/145 (74%) and M09 to 13/14 (93%). P-16 is `PROVEN`, PF-086 remains
`OPEN`, proof gates remain 10/13, and M09-T14 is next. These local receipts make no required-gate
or hosted-CI claim.

M09-T14 publishes only the exact current authored Source that is both clean and canonically equal
to the last successfully saved Source generation. The App reruns the public Publisher from that
Source, requires the resulting Bundle revision to equal the current publishable-preview revision,
and sends only the canonical Bundle bytes plus revision through a trusted-host-injected port.
Scenario projections, synthetic fixtures, Runtime operation inputs, secrets, and
rejected-candidate diagnostics never enter the publication snapshot or request.

The public Editor Web adapter stores the immutable Bundle under its exact revision and uses
compare-and-set to move only the fixed `preview` channel. Channel discovery remains distinct from
activation authority. Active becomes visible only after a separate server-owned reference-host
receipt names the same revision and its durable activation generation. Channel conflicts never
invoke activation; failed or mismatched activation preserves the last-known-good revision; stale
settlements are fenced; and indeterminate mutations authorize neither blind retry nor current
success. Synchronous external-store delivery keeps visible stages current, while same-tick
host-port replacement revokes the predecessor lifetime before late settlements can reach the new
UI. The browser App imports no Node control-plane composition or reference-host server.

The user-requested authoring compatibility repair enlarges the dedicated Layers and Components
grips to `28 × 32 px` and `32 × 32 px`, respectively, without layout shift. Stable,
non-overlapping, full-width `20 px` Layers lanes directly own boundary events, with row-half
fallback and innermost-slot fencing. The sticky Components `Drop target` directly owns the drop,
while the authenticated panel remains a same-target fallback. `Add` immediately selects the new
node, leaving the existing visible guarded `Remove layer` and Delete/Backspace paths available.

The focused four-file App publication suite passes 31/31, including 2/2 real public
control-plane → fixed-channel → reference-host integration cases. The Editor Web publication suite
passes 10/10, the emitted public-package runtime cases pass 4/4, and the independent root mutation
proof passes 12/12. Exact evidence is the 24,763-byte
`docs/proof/artifacts/desen-app-0.1.0-publish-activation.json` at
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b`; it authenticates nine
exact parents, 33 current tracked receipts, and 45 focused declarations. The local exhaustive
authority contains 200 workloads and 95 proof pairs—84 ordinary and 11 barriers—with a
63-proof-unit/136-workload T14 closure and ownership over 1,267 tracked paths, including 190
proof-owned paths. Neutral inventory, impact graph, path-set, and ownership pins are
`sha256:c6655119e0b24594bced92b6b916917e0f336351c19cf338ee21d3b8d141f684`,
`sha256:4a2e2d7d4d15a8f3d563aee7b248b14bba6ce44c27b464773a825d9c44fc58bf`,
`sha256:e8e1841e828a63bf84d57e457047ffaef7e6ca1998b6e7c89201758d44dec5f5`, and
`sha256:18497e4c50dd0dfa8f8dd7adaf9b6130779db7c0799798ef99e3de8bcf764486`.

Append-only current-reader sequence 53 historically advances exact sequence-52 head
`sha256:c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9` to
`sha256:48a1457317c593b846cd4750eb309e846c33248824559d27810441584f0144d8` across 49 frozen
artifacts and 98 current readers. Compatibility sequence 54 is the immutable predecessor: it
preserves those artifact and reader identities, advances the exact sequence-53 head to
`sha256:0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638`, and reseals only
M08-T08 proof-library/root-test readers `[64, 65]`. The frozen 49,785-byte M08-T08 artifact remains
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`. Current sequence 55
preserves the same 49 frozen artifacts and 98 reader identities, links that exact sequence-54
predecessor head to `sha256:f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17`,
and reseals only M09-T01–T14 proof-library/root-test reader indexes `[70..97]`. The current T14
readers authenticate the exact `10,000 ms` per-test timeout successor at
`sha256:5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901`; reversing that one
edit reproduces the frozen 24,485-byte test receipt, while the frozen T14 artifact remains
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b` unchanged. Checkpoint,
promotion, selector, and fourteen M09 root reader suites pass 78/78, 20/20, 23/23, and 179/179.
Promotion pins the selector at
`sha256:2855cbeedb55ede5d9db18a6b186ac07796afbc4d512f5a0aa9197bc5f177fd1`, required-affected
runner authority at `sha256:b77b35a81915ec41554ab3505895fe98c0a4299ec9bf7d680dec320bbf3fb744`, and the T10 affected
plan at `sha256:e3cced8e1a9cbe6f1f5c296aa3992b07ef030c81ac9267c2deff714953ce0e39`. The integrated CI
policy regression passes 330/330. These local receipts make no required-gate or hosted-CI claim.

M09-T14 and G09 are `DONE`, advancing implementation progress to 109/145 (75%), M09 to 14/14, and
proof gates to 11/13. P-07, P-09, and P-10 remain `PARTIAL`; P-08 remains `NOT_PROVEN`; P-12
remains `NOT_PROVEN` until M10-T07; N-036 remains `PLANNED`; and PF-085, PF-086, and PF-089 remain
`OPEN`. Automated real-browser E2E and native drag remain unproven by this compatibility evidence
and move to M10-T01.

## M10 — First end-to-end proof

| ID       | Status      | Depends on                | Deliverable / evidence                                                        |
| -------- | ----------- | ------------------------- | ----------------------------------------------------------------------------- |
| M10-T01  | DONE        | G09                       | Empty-project-to-sign-in browser E2E                                          |
| M10-T01A | DONE        | M10-T01                   | User-created blank project and durable normal-App authoring                   |
| M10-T01B | DONE        | M10-T01A                  | Visual behavior authoring and Catalog-derived Run controls                    |
| M10-T01C | DONE        | M10-T01B                  | Evergreen product composition through an authenticated workspace profile      |
| M10-T02  | DONE        | M10-T01C                  | Input and pending fixture test                                                |
| M10-T03  | DONE        | M10-T02                   | Failure fixture and visible failure-state test                                |
| M10-T04  | NOT_STARTED | M10-T02                   | Success fixture, navigation, and real host-operation binding test             |
| M10-T05  | NOT_STARTED | M10-T03–M10-T04           | Label/layout change published and activated without host source change        |
| M10-T06  | NOT_STARTED | M10-T05                   | Invalid prop/event/slot publication rejected with node-linked diagnostics     |
| M10-T07  | NOT_STARTED | M10-T05, G07              | Corrupt revision and catalog mismatch preserve last-known-good                |
| M10-T08  | NOT_STARTED | M10-T01B–M10-T07          | One-command seed/reset and repeatable sign-in demo runbook                    |
| M10-T09  | NOT_STARTED | M10-T08                   | Record committed `packages/runtime-core` tree hash as M11 comparison baseline |
| G10      | NOT_STARTED | M10-T01C, M10-T02–M10-T09 | Complete no-manual-reimplementation proof passes and core baseline is frozen  |

M10-T01 is `DONE`. The dedicated `@desen/app-browser-e2e` workspace owns Playwright, Vite,
Chromium, and failure artifacts while the root and product App manifests retain no M10 browser-E2E
ownership. Its isolated production browser-proof bundle starts from an explicitly empty,
structurally admitted `account-app/sign-in` Source/project with the exact reference Catalog, one
Stack root, and the declared `420 × 720` portrait frame. In one Playwright Chromium scenario, a
user authors the sign-in surface through the visible browser UI: state, components, slots, props,
bindings, actions, layer order, and deletion all cross the same public editor paths used by the
product. The successful Components and Layers gestures use native `locator.dragTo`; a separate
forged-`DataTransfer` negative case proves that unauthenticated drag events cannot mutate Source.
It first persists the exact canonical empty Source as Generation 1, then proves that the canonical
document, persisted document, save count, and disabled Save state remain identical after the
forged drop; the completed authored Source is the distinct Generation 2 save.
The completed Source is saved through the public persistence port, read back from its deterministic
compare-and-set adapter, re-admitted by the public validator, and checked for exact managed static
subtree plus frame parity across Design and Run.

The Playwright spec is isolated from Vitest discovery as
`apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts`; the complete App suite passes 377/377
and the browser scenario passes 1/1 locally. The immutable task-time evidence remains the
10,259-byte
`docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json` at
`sha256:959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77`; the artifact and
sequence-57 authority remain byte-identical, while sequence 58 reseals the current task-time
reader without depending on the relocated live E2E source paths. The append-only 16,025-byte
current-workspace compatibility receipt is
`docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json` at
`sha256:e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d`. Its direct verifier
passes, its mutation suite passes 11/11, and its 32 exact current-file receipts cover the dedicated
package ownership, filtered browser workflow, package-local artifacts, root/product-manifest
non-ownership, lock importer, and deny-by-default dependency boundaries. The focused boundary
fixture verifier passes 19/19 and the full boundary graph passes across 808 modules and 3,319
dependencies. `M10-T01-COMPAT` is only a unique corrective-receipt label, not a new plan task or a
second M10-T01 completion.

Historical append-only reader checkpoint sequence 57 advances sequence 56 to
`sha256:690c73294f6926822fb1535ac60ea40636545890031db72b7a8d63930a27cc57` across 50 frozen
artifacts and 100 current readers. Corrective sequence 58 preserves sequences 1–57 and advances
that exact head to `sha256:08396f779b0c1c63cf56d9a9292dcd0a103228c57fe39e1173d95a4a106a92e5`
across 51 frozen artifacts and 102 current readers. The permission-model fixture correction
preserves sequences 1–58 and appends sequence 59 at
`sha256:349a292c9137f0f66c5cd58f384aa2175082613500905fdb723f15b246cbd2e8`, resealing only the
changed M10-T01 root-test reader while retaining those 51 artifacts and 102 reader identities; the
dedicated checkpoint suite passes 82/82.
The current neutral CI universe contains 204 workloads and 97
proof units; its inventory and impact graph are pinned at
`sha256:bc71b712811d517e2de08c153ab8dc3ac5fe688fa1b7aafea84ee68636e79292` and
`sha256:755972e86cde34527c842cb6769202163675c2e179466d1cc2b474c1a9725d9b`, while the 65-proof-unit /
140-workload current compatibility closure is
`sha256:99b33b797b32ecf72c35ffe5160e1f89bdc7b96b0bd156b7e14895193116f3e4`; shared-state,
inventory, and impact regression cases pass 66/66 locally. P-08 advances to `PROVEN`; P-07, P-09,
and P-10 remain `PARTIAL`. Typed input and pending state (M10-T02), invalid credentials and visible
failure (M10-T03), and success, navigation, and a real host operation (M10-T04) remain unproven.
G10 stays open, proof gates remain 11/13, and these local receipts make no exact-head hosted-CI
claim. Implementation progress advances to 110/145 (76%), M10 to 1/9 (11%), and M10-T02 is next.

M10-T01A is `DONE`. The normal product entry now starts from an honest zero-project state and
offers one visible Blank sign-in project profile. Creating it writes the exact
`account-app/sign-in` Source as Generation 1 through the real loopback control-plane adapter, then
opens the ordinary editor with the same prepared compare-and-set controller. No proof document,
proof-only route, or fixture fallback is injected. Local state is outside Vite's served App root;
fixed-loopback origin, fresh bearer, explicit response bounds, and pre-fallback `.desen` / `@fs`
denials protect the trusted local profile. Conflict, indeterminate-save, pending-save, and discard
lifecycle paths fail closed.

The normal-product Chromium scenario uses only visible controls for project creation, native
Components and Layers drag, state, bindings, actions, order, deletion, Generation 2 save, hard
reload, and Projects-card reopen. The complete App suite passes 407/407; product/lifecycle and
local-runtime suites pass 16/16 and 17/17; the immutable historical and normal-product browser
scenarios each pass 1/1. The dependency graph covers 818 modules / 3,373 dependencies without a
violation and all 23 boundary fixtures pass. The independent task reader passes 11/11 over the
20,173-byte, 43-receipt artifact at
`sha256:6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e`. Sequence 61 advances
the exact sequence-60 checkpoint head to
`sha256:a80e008bf0f383ab46d097abfec17710131a47656040ec07dc7cc60f965666fb` across 52 artifacts
and 104 readers. Sequence 62 preserves sequences 1–61 and advances that exact head to
`sha256:15ede557b4167cb7bc0cce89b02cf0e9d9f0f7e92c4c5fdc2d799cb3bcf0be55` by resealing only the
M10-T01-COMPAT root reader for runner-owned temp isolation; its suite passes 85/85. The current CI
universe contains 206 workloads / 98 proof units, and the M10-T01A affected closure contains 66
proof units / 142 workloads. Ownership covers 1,323 tracked paths / 196 proof-owned paths. Overall
progress is 111/146 (76%), M10 is 2/10, and M10-T02 remains `NOT_STARTED` and next. Typed input/pending,
invalid credentials, success/navigation/real host operation, remote deployment, multi-user
persistence, and G10 remain unproven. These local receipts make no exact-head hosted claim.

`M10-T01A-SECURE-SCROLL-COMPAT` is an append-only corrective receipt, not another plan task. The
optional `Secure` boolean now keeps its invisible native input inside the switch label, replacement
Inspector controls receive focus with `preventScroll`, and the desktop editor workplane clips outer
programmatic scrolling without changing the responsive document-flow layout. The normal-product
Chromium scenario deliberately contracts to `1600 × 840`, requires zero initial window, document,
and editor scroll, and preserves the exact vertical bounds of the command bar, authoring shell,
canvas, Inspector, and `420 × 720` frame through **Set Secure** and the native switch interaction.
The immutable 20,173-byte M10-T01A artifact and all historical artifacts remain unchanged. Fifteen
direct verifiers, 218/218 combined historical reader cases, the 1/1 product Chromium scenario, and
the 86/86 checkpoint suite pass locally. Sequence 63 preserves all 52 frozen artifacts and 104
reader identities, reseals only `[70..97, 102, 103]`, and advances the exact sequence-62 head to
`sha256:7245d3334dfaf801692783ed8a500ecc124ed259291ccf433cbc6fab21c76da7`. No task, gate,
progress, or M10-T02 status changes, and no hosted exact-head result is inferred.

M10-T01B is `DONE`. It closes the usability gap between a structurally editable Source and a
designer-operable behavior flow without adding a sign-in-specific editor mode. A selected input now
offers one atomic **Input connection** control: the same compatible local state becomes the
component's controlled `Value` and the target of its `change → state.set(event.value)` action. A
half-bound input, a second write to the bound state, or a conditional/extended imitation cannot be
reported as connected, while unrelated actions retain their order and conflicting writes fail
closed.

The Actions tab now creates all seven closed Source action kinds through Catalog- and Source-derived
visual fields. A Button can select a Catalog operation, give its result a reference-safe name, map
declared inputs to compatible local states, and choose concurrency without writing JSON. Advanced
JSON remains an explicit lossless escape hatch. Structured state/event/input mappings require the
same canonical schema identity, so an object cannot be offered for an array; structured fixed
values remain advanced-only until a schema-driven visual editor exists. Inspector visibility can be **Always**, follow a
local-state comparison, or follow an authored operation result status; the resulting `when`
predicate is written through the public Editor Core condition commands and complete Source
validation.

Run controls are projected from the exact current surface's authored `operation.invoke` actions and
authenticated Catalog fixtures. Zero, one, or multiple operation aliases are represented honestly;
alias conflicts, missing operations, malformed fixtures, stale Runtime context, and undeclared
outcomes fail closed. The UI no longer assumes a sign-in operation or invents “success user-1” and
“invalid credentials” options. Synthetic execution remains visibly separate from unavailable
Integration and Production contexts, and operation input values are neither read nor retained by
the fixture controller.

The dedicated behavior-authoring profile passes 135/135, the complete App suite excluding the
deliberately occupied local launcher port passes 427/427, and
the real Chromium scenario passes 1/1. That scenario starts from the visible blank-project UI,
demonstrates why a placeholder-only binding retains one character, repairs both TextFields through
the atomic control, authors the Button operation and Alert condition without JSON, types full values,
observes a real pending Promise, explicitly settles the Catalog-derived error fixture, and sees the
conditional Alert. The dedicated M10-T01B artifact and verifier are
`docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json` and
`scripts/verify-desen-app-visual-behavior-authoring.mjs`.

The append-only hosted-browser correction does not reopen M10-T01B. PR #69 run `33437877845` / job
`99638637740` exposed a historical spec that still waited for the removed JSON-first action UI;
the exact 15,143-byte successor
(`sha256:5fcdc7f312bb2ef45e747499e50bf31f2dfae8e1c1b82963176d99eb8bb8395b`) uses the visible atomic
**Connect input** flow and passes both Chromium configurations 1/1 + 1/1 locally. Fifteen historical
reader families pass 233/233. Corrective checkpoint sequence 65 preserves all 53 artifacts and 106
reader identities, reseals only `[70..97, 102, 103]`, and passes 88/88 at
`sha256:fad195aa82484ec15e347e3681ba6be64e6f1e28d5f724bf1fabeb892a7afe14`. M10-T01B remains
`DONE`, M10-T02 remains `NOT_STARTED`, and no hosted exact-head success is inferred.

M10-T01B is an authoring-usability prerequisite, not a renaming of later proof slices. M10-T02 still
owns its dedicated typed-input and pending fixture acceptance matrix; M10-T03 still owns the full
failure-state proof; M10-T04 still owns success, navigation, and a separately authorized real host
operation. P-09/P-10, remote deployment, multi-user persistence, and G10 therefore remain open.
Overall progress advances to 112/147 (76%), M10 advances to 3/11, and M10-T02 remains
`NOT_STARTED` and next.

M10-T01C is `DONE`. The product root now requires one factory-authenticated
`ProjectWorkspaceProfile` instead of letting generic application code inherit the reference
sign-in example. That profile captures the exact project inventory, independent App route slug and
Source surface identity, Source document and storage identities, complete Catalog set and package
candidates, runtime adapter/token/port authority, and optional publication channel/host binding.
The normal `main.tsx` composition selects sign-in explicitly; editor, preview, fixture, scenario,
persistence, publication, runtime-canvas, and product-bootstrap modules carry only the selected
profile authority and contain no account/sign-in/reference defaults.

The App, persistence, and publication boundaries now share exact current-document admission. The
document id, authored entry, complete surface inventory, complete Catalog requirements, and
interaction contracts must still match the selected profile; prepared controllers and editor
mounts remain tied to that exact opaque handle even when public ids match another profile. Static
project inventories use a separate opaque, bounded, detached fixture handle and stay inert: they
cannot be combined with Source, persistence, publication, mutation, project creation, or an
editable/runnable surface.

Synthetic authoring replaces all nine captured profile host-port families with inert behavior and
uses only its explicit local Catalog fixture operation controller. Selecting a non-entry surface
publishes a transient canvas-only preview candidate; the base authored document, Save request,
Publish revision, and published Bundle preserve the profile entry. Publication itself crosses only
a factory-authenticated fixed-destination port for the profile's exact channel and installed host;
publish bytes/requests and activation requests are validated, cloned, and reconstructed before
side effects.

The focused product evidence admits an authentication-independent two-surface feedback profile
whose App route slugs differ from its Source surface ids and whose Source resolves two Catalogs.
A complete App render independently opens a feedback surface through the ordinary project,
authoring-model, real-adapter canvas, and layer-tree path. Negative coverage rejects forged profile
handles, route-to-Source drift, incomplete Catalog-package sets, forged adapter registries,
cross-profile persistence routes, and mismatched publication hosts before they receive downstream
authority. The deterministic evidence is
`docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json`; its verifier is
`scripts/verify-desen-app-evergreen-product-composition.mjs`.

This task changes composition authority, not the M10 lifecycle acceptance scope. M10-T02 still owns
the dedicated input/pending matrix, M10-T03 owns visible failure, M10-T04 owns separately authorized
real-host success/navigation, and G10 remains open. Overall progress advances to 113/148 (76%),
M10 advances to 4/12, and M10-T02 remains `NOT_STARTED` and next. Local evidence alone makes no
hosted exact-head `Quality gate` claim.

Append-only reader checkpoint sequence 66 preserves sequences 1–65 and all 53 predecessor
artifacts, adds the exact 19,299-byte M10-T01C artifact
(`sha256:779434ca834b8d770c726d905408f0a3d0a7145abbc6eaf2b81f1e77466b46ac`), reseals only
reader indexes `[70..97, 102, 103, 104, 105]`, and appends the T01C proof/root pair at `[106, 107]`.
It authenticates 54 artifacts and 108 current readers, passes 89/89 at
`sha256:3bf2c27ca51f8ab6751dd0d026bbbf461ac2c6acea6fcc3088f7d011ae96fb83`, and leaves every
historical checkpoint intact. The sixteen bridged historical App reader/root pairs pass 242/242;
neither receipt implies hosted exact-head success.

M10-T02 is `DONE`. The normal product now closes the dedicated complete-input and pending-fixture
acceptance slice through visible no-code controls. A designer starts from the zero-project screen,
creates the admitted blank project, adds local state, TextFields, and a Button, connects both
controlled inputs, and maps Press to one Catalog operation. The operation recipe writes the exact
capability, collision-free result alias, schema-compatible state inputs, explicit concurrency, and
`operation.<alias>.pending` Loading reference through one validated Source mutation. Automatic
state suggestion occurs only for an exact input/state name match; schema compatibility alone never
guesses designer intent.

New connections default to **Ignore while running** (`reject`). Exact repair of one existing root
invocation preserves unrelated action order, settlement branches, guard, and extensions. Missing
optional inputs remain absent. Existing declared or additional input values that the visual state
selector cannot represent stop Repair with an explicit loss-prevention message, and multiple root
invocations fail closed as ambiguous. The concurrency copy distinguishes another invocation of the
same result from the Button's own Loading lock.

The real Chromium scenario uses visible **Set Secure**, verifies that control is checked and the
rendered password input is native `type=password`, types both complete values in multiple chunks,
authors the
operation connection without JSON, and observes one unresolved synthetic Promise as
Runtime pending. Catalog-derived outcome selection disables while pending, explicit completion
stays available, and Button Loading maps to accessible busy/disabled state while retaining focus.
The scenario confirms the default repeat policy, then selects `queue` so a leaked Enter activation
would become a second observable pending invocation. Values and pending survive Design → Run
without Source mutation or Runtime replacement. Terminal completion remains stable across two
animation frames, clears Loading, and re-enables the outcome selector without asserting an Alert or
navigation.

Focused positive and negative coverage passes 82/82, the dedicated Chromium configuration passes
1/1, and the independent root reader passes 10/10. The deterministic 14,261-byte / 25-receipt
evidence is
`docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json` at
`sha256:161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d`. A separately pinned,
bounded 2,307,407-byte historical-reader bridge at
`sha256:16f6ec332fb03368e617563560b9930a7608594907ce61d5d15554be4dc7523d` authenticates the exact
M10-T01C task-time inputs without rewriting its immutable artifact.

The neutral CI universe contains 212 workloads / 101 proof units. The M10-T02 App closure contains
69 proof units / 148 workloads, and exact-one ownership covers 1,366 tracked paths / 202
proof-owned paths. Append-only checkpoint sequence 67 preserves sequences 1–66, contains 55
artifacts / 110 readers, and closes at
`sha256:9ee6909c0f11ed7149cb9bf6ce1c7943ed99aac2d2c6f9138caea8f5dd2044b7`; its suite passes
90/90. P-09 and P-10 remain `PARTIAL`; the selected declared error proves only generic
fixture settlement and terminal cleanup. Visible public failure remains M10-T03; success,
navigation, and a separately authorized real host operation remain M10-T04; Integration,
Production, N-036, and G10 remain open. Overall progress advances to 114/148 (77%), M10 advances to
5/12 (42%), and M10-T03 is next. Local receipts alone make no hosted exact-head `Quality gate`
claim.

M10-T03 is `DONE`. The dedicated failure-fixture acceptance slice starts from the current
authenticated profile's visible blank project. A designer uses ordinary no-code controls to create
controlled email and secure-password state, connect one Button to the Catalog-declared operation,
and author a critical Alert whose complete visibility predicate follows
`operation.signIn.status == "failed"`. The browser uses no Advanced JSON, direct DOM mutation,
network shortcut, or proof-only product route.

The dedicated Chromium journey selects only the exact Catalog-derived
`error:invalidCredentials` outcome. The Alert is absent while idle and throughout one real
unresolved Runtime pending lifecycle. Explicit settlement publishes the declared public failure,
reveals the managed critical Alert, clears accessible Button Loading, preserves both complete input
values, and keeps the App on the sign-in route. A second Button activation is a real retry: pending
hides the previous Alert and restores Loading; the second explicit declared settlement reveals the
Alert again. The `420 × 720` portrait frame and horizontal document geometry remain unchanged across
idle, pending, failure, retry pending, and repeated failure.

The deterministic reader binds 139 focused `it`/`it.each` declaration sites, while actual focused
Vitest execution passes 144/144 (App 52, reference components 11, Runtime 81). The dedicated
Chromium configuration passes 1/1, and the independent root mutation reader passes 10/10. The
deterministic 16,868-byte / 34-receipt evidence is
`docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json` at
`sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`. A separately pinned,
bounded 2,491,742-byte T02 historical-reader bridge at
`sha256:a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10` reconstructs 25 exact
task-time files from base `d2c632f2cacab5d316d57aa3d51758d2a76d3cd2` without rewriting the
immutable predecessor artifact.

The neutral CI inventory contains 214 workloads / 102 proof units. The M10-T03 closure contains 70
proof units / 150 workloads, and exact-one ownership covers 1,377 tracked paths / 204 proof-owned
paths. Checkpoint sequence 68 preserves sequences 1–67 and closes 56 artifacts / 112 readers at
`sha256:e685779412ca17b76c78a56ff545bbff5a7fc5efc8bc564247cc49e7c54eeca8`; its suite passes
91/91.

M10-T03 closes only visible public failure. P-09 and P-10 remain `PARTIAL`; success, navigation, and
a separately authorized real host operation remain M10-T04. Integration, Production, N-036, and
G10 remain open. Overall progress advances to 115/148 (78%), M10 advances to 6/12 (50%), and
M10-T04 is next. Local receipts alone make no hosted exact-head `Quality gate` claim.

### M10-T01 public build-log drafts

**X (EN, 280 characters)**

> Desen App can now build a sign-in surface from an empty project in a real browser—using native component/layer drag, visual state, bindings, actions, exact Design/Run parity, and validated persistence. Input/pending is next. What should we test next? github.com/desenlab/desen-app

**LinkedIn**

> [EN]
>
> A blank canvas is now an executable proof in Desen App. A real Chromium test starts from an empty
> Source/project, authors a sign-in surface through the visible UI, uses native Components and
> Layers drag, saves through the public persistence boundary, validates the stored Source, and
> checks exact Design/Run static parity.
>
> This proves the visual-authoring path. Typed input/pending, failure, and success/navigation with a
> real host operation are still the next slices; G10 is not closed.
>
> [TR]
>
> Desen App'te boş bir tuval artık çalıştırılabilir bir kanıta dönüşüyor. Gerçek Chromium testi boş
> bir Source/proje ile başlıyor; görünür arayüzden giriş ekranını tasarlıyor, Components ve Layers
> alanlarında doğal sürükle-bırak kullanıyor, public persistence sınırından kaydediyor, saklanan
> Source'u doğruluyor ve Design/Run statik eşliğini birebir kontrol ediyor.
>
> Bu kanıt görsel üretim yolunu kapatıyor. Yazılı girdi/pending, hata ve gerçek host operasyonuyla
> başarı/navigasyon akışları sıradaki kapsam; G10 henüz kapanmadı.
>
> #DesignTools #WebDevelopment #OpenSource

### M10-T01A public build-log drafts

**X (EN, 250 characters)**

> A blank canvas now survives the real Desen App journey: New project → visual authoring → save → reload → reopen, through the normal UI and durable CAS storage in Chromium. Input/pending is next. What should we test next? github.com/desenlab/desen-app

**LinkedIn**

> [EN]
>
> Desen App's blank canvas now lives in the normal product journey. A real Chromium test starts at
> zero projects, creates the supported sign-in profile from the visible New project flow, authors it
> through Components, Layers, Inspector, State, and Actions, then saves, hard reloads, returns to
> Projects, and reopens the same durable Source.
>
> The local composition uses generation-guarded storage and fails closed on conflicts, uncertain
> saves, and unavailable persistence. Typed input/pending, failure, and success/navigation remain
> the next slices; this is not yet a remote or multi-user deployment claim.
>
> Inspect the evidence in the public repository. Which part of the product journey should we test
> next?
>
> [TR]
>
> Desen App'in boş tuvali artık normal ürün akışında yaşıyor. Gerçek Chromium testi sıfır projeden
> başlıyor; görünür New project akışından desteklenen giriş projesini oluşturuyor, Components,
> Layers, Inspector, State ve Actions üzerinden tasarlıyor; ardından kaydediyor, sayfayı yeniliyor,
> Projects'e dönüyor ve aynı kalıcı Source'u kartından yeniden açıyor.
>
> Yerel kompozisyon nesil korumalı depolama kullanıyor; çakışma, belirsiz kayıt ve erişilemeyen
> persistence durumlarında güvenli biçimde kapanıyor. Yazılı girdi/pending, hata ve
> başarı/navigasyon sıradaki kapsam; bu henüz uzak veya çok kullanıcılı deployment iddiası değil.
>
> Kanıtları açık repoda inceleyin. Sizce ürün yolculuğunun hangi bölümünü sırada test etmeliyiz?
>
> #DesignTools #WebDevelopment #OpenSource
>
> Hangi üretim akışını sırada sınamamızı istersiniz? Kanıtı public repoda inceleyebilirsiniz:
> https://github.com/desenlab/desen-app

### M10-T01B public build-log drafts

**X (EN, ≤280 characters)**

> Desen App behavior authoring is now no-code by default: atomic controlled inputs, visual operation mapping, conditional visibility, and Catalog-derived generic Run outcomes—proven in Chromium. Advanced JSON stays optional; M10-T02 is next. github.com/desenlab/desen-app

**LinkedIn**

> [EN]
>
> A visual editor becomes useful when behavior is as direct as layout. Desen App now connects a
> controlled input to state in one atomic action, maps Button events to Catalog operations through
> visual fields, and makes layers conditional on local state or authored operation status.
>
> Run mode no longer knows about “sign in.” It derives operation cards and synthetic outcomes from
> the exact current Source and authenticated Catalog. A real Chromium flow types complete values,
> observes pending, settles a declared error, and reveals the conditional Alert. Advanced JSON
> remains available, but it is no longer the designer's required path.
>
> This is the authoring-usability prerequisite. Dedicated M10-T02/T03 lifecycle matrices and the
> M10-T04 real-host success/navigation proof remain next.
>
> [TR]
>
> Görsel bir editör, davranış tanımlamak da yerleşim kadar doğrudan olduğunda gerçekten işe yarar.
> Desen App artık kontrollü bir input'u state'e tek atomik işlemle bağlıyor, Button event'ini görsel
> alanlarla Catalog operation'ına eşliyor ve katmanları local state ya da yazılmış operation
> status'una göre koşullu gösterebiliyor.
>
> Run modu artık “sign in” diye özel bir akış bilmiyor. Operation kartlarını ve sentetik sonuçları
> güncel Source ile doğrulanmış Catalog'dan türetiyor. Gerçek Chromium akışı tam metin giriyor,
> pending durumunu görüyor, tanımlı hatayı sonuçlandırıyor ve koşullu Alert'i gösteriyor. Advanced
> JSON korunuyor ama tasarımcının zorunlu yolu değil.
>
> Bu, authoring kullanılabilirliği önkoşulu. M10-T02/T03 yaşam döngüsü matrisleri ile M10-T04 gerçek
> host başarı/navigasyon kanıtı sırada.
>
> #DesignTools #NoCode #WebDevelopment #OpenSource

### M10-T01C public build-log drafts

**X (EN, ≤280 characters)**

> Design tools shouldn't inherit yesterday's demo. Desen App now selects an authenticated project profile at its root; generic paths carry exact route, Source, Catalog, runtime, storage, and host authority. A non-auth flow proves it. M10-T02 is next. github.com/desenlab/desen-app

**LinkedIn**

> [EN]
>
> A product editor should not quietly turn its first demo into permanent architecture. Desen App
> now selects one authenticated project workspace profile at its trusted root. Generic authoring,
> persistence, runtime, and publication paths receive exact project, Source, Catalog-set, storage,
> adapter, token, port, and optional host authority from that profile—without knowing about the
> reference sign-in example. Synthetic Run replaces every captured profile port with an inert host
> and permits only its explicit local Catalog fixture operation controller.
>
> Focused local evidence admits a non-authentication, multi-surface feedback project with different
> route slugs and Source ids, two Catalogs, and the ordinary real-component App canvas. Forged
> profiles, identity drift, incomplete Catalog packages, and mismatched host bindings fail closed.
> A non-entry canvas is transient, Save and Publish preserve the authored entry, and publication can
> target only the profile's factory-authenticated fixed channel and host.
>
> This prepares the product for new workflows; it does not yet close M10's input/pending, failure,
> real-host success/navigation, or G10 acceptance work. Inspect the evidence in the public
> repository: which non-auth workflow should we test next?
>
> [TR]
>
> Bir ürün editörü, ilk demosunu fark ettirmeden kalıcı mimariye dönüştürmemeli. Desen App artık
> güvenilen kökünde doğrulanmış tek bir proje çalışma alanı profili seçiyor. Genel authoring,
> persistence, runtime ve publication yolları; kesin proje, Source, Catalog seti, storage, adapter,
> token, port ve isteğe bağlı host yetkisini bu profilden alıyor; referans sign-in örneğini bilmiyor.
> Sentetik Run, profilden yakalanan tüm portları inert bir host ile değiştiriyor ve yalnızca açıkça
> seçilen yerel Catalog fixture operation controller'ına izin veriyor.
>
> Odaklı yerel kanıt; route slug'ları ile Source id'leri farklı, iki Catalog kullanan, kimlik
> doğrulamadan bağımsız ve çok yüzeyli bir feedback projesini normal gerçek-bileşen App tuvalinde
> açıyor. Sahte profiller, kimlik kayması, eksik Catalog paketleri ve uyuşmayan host bağları güvenli
> biçimde reddediliyor. Entry olmayan tuval geçici kalıyor, Save ve Publish yazılmış entry'yi
> koruyor ve publication yalnızca profilin factory ile doğrulanmış sabit kanal ve host'una gidebiliyor.
>
> Bu çalışma ürünü yeni akışlara hazırlıyor; M10'un input/pending, failure, gerçek host
> başarı/navigasyon ve G10 kabul işlerini henüz kapatmıyor. Kanıtı açık repoda inceleyin: sırada
> hangi auth-dışı akışı test etmeliyiz?
>
> #DesignTools #ProductEngineering #WebDevelopment #OpenSource

### M10-T02 public build-log drafts

Drafts only. Do not publish automatically.

**X (EN, 279 characters)**

> Desen App now proves complete typed input and an unresolved Runtime pending lifecycle through visible no-code controls in Chromium. Loading blocks repeat activation; Design/Run preserves values and pending. Failure and real-host success remain next. github.com/desenlab/desen-app

**LinkedIn**

> [EN]
>
> Desen App now closes its dedicated input and pending acceptance slice through the normal product
> UI. A designer starts from a blank project, connects complete controlled TextField values to local
> state, and maps a Button to a Catalog operation without writing JSON. The same atomic recipe owns
> compatible input mappings, a collision-free result name, explicit concurrency, and Button Loading.
>
> A real Chromium journey types email and secure-password values in multiple chunks, observes an
> unresolved Runtime Promise as accessible pending feedback, and proves that repeated activation is
> blocked. Values and pending state survive Design/Run presentation changes. Explicit fixture
> completion then clears Loading without claiming a visible error or navigation.
>
> Repair is deliberately lossless: optional inputs can stay absent, advanced values block visual
> replacement until the designer chooses a safe mapping, and ambiguous operation actions fail
> closed. M10-T03 still owns visible failure; M10-T04 still owns success, navigation, and a real host
> operation.
>
> [TR]
>
> Desen App artık normal ürün arayüzü üzerinden özel input ve pending kabul kapsamını kapatıyor.
> Tasarımcı boş projeden başlayıp kontrollü TextField değerlerini local state'e bağlıyor ve Button'ı
> JSON yazmadan Catalog operation'ına eşliyor. Aynı atomik işlem; uyumlu input eşlemelerini,
> çakışmayan sonuç adını, açık concurrency seçimini ve Button Loading durumunu birlikte kuruyor.
>
> Gerçek Chromium yolculuğu e-posta ve güvenli şifre değerlerini parça parça yazıyor, çözülmemiş
> Runtime Promise'ini erişilebilir pending geri bildirimi olarak görüyor ve tekrar aktivasyonun
> engellendiğini kanıtlıyor. Değerler ile pending durumu Design/Run görünüm değişiminde korunuyor.
> Fixture açıkça tamamlandığında Loading temizleniyor; görünür hata veya navigasyon iddiası
> taşınmıyor.
>
> Repair akışı veri kaybına izin vermiyor: isteğe bağlı input boş kalabiliyor, görsel alanların
> temsil edemediği gelişmiş değerler güvenli bir eşleme seçilene kadar değişikliği durduruyor ve
> belirsiz operation aksiyonları güvenli biçimde reddediliyor. Görünür hata M10-T03'te; başarı,
> navigasyon ve gerçek host operation M10-T04'te kapanacak.
>
> #DesignTools #NoCode #WebDevelopment #OpenSource

### M10-T03 public build-log drafts

Drafts only. Do not publish automatically.

**X (EN, ≤280 characters)**

> Failure should be visible without hidden shortcuts. Desen App now proves a Catalog-declared invalid-credentials Alert through its normal no-code Chromium flow, including pending, retry, and stable input, route, and layout. Real-host success is next. github.com/desenlab/desen-app

**LinkedIn**

> [EN]
>
> A designer should be able to prove a product's failure state without code, private service data,
> or a test-only UI. Desen App now starts from the normal visible blank project, connects controlled
> email and secure-password state to the Catalog operation, and authors a critical Alert conditioned
> on the operation's public failed status.
>
> In real Chromium, the Alert is absent while idle and pending. Settling the exact Catalog-declared
> invalid-credentials fixture reveals it, clears accessible Loading, and preserves the route and
> complete input values. A real retry hides the old Alert while pending and restores it only after
> the second declared failure. The 420 × 720 frame and horizontal layout remain stable throughout.
>
> This closes the visible synthetic-failure slice, not success, navigation, or a real host
> operation; those remain M10-T04. Integration, Production, and G10 also remain open. Inspect the
> evidence in the public repository: which failure-state invariant would you test next?
>
> [TR]
>
> Bir tasarımcı ürünün hata durumunu kod, özel servis verisi veya yalnız teste ait bir arayüz
> olmadan kanıtlayabilmeli. Desen App artık normal görünür boş projeden başlıyor; kontrollü e-posta
> ve güvenli şifre state'ini Catalog operation'ına bağlıyor ve operation'ın public failed durumuna
> koşullu kritik bir Alert yazıyor.
>
> Gerçek Chromium akışında Alert idle ve pending sırasında görünmüyor. Catalog'da tanımlı exact
> invalid-credentials fixture'ı tamamlandığında Alert görünüyor, accessible Loading temizleniyor,
> route ve tam input değerleri korunuyor. Gerçek retry sırasında eski Alert yeniden gizleniyor ve
> ancak ikinci tanımlı hata tamamlandığında geri geliyor. 420 × 720 frame ile yatay yerleşim bütün
> akış boyunca sabit kalıyor.
>
> Bu çalışma görünür sentetik failure kapsamını kapatıyor; success, navigation ve gerçek host
> operation M10-T04'te kalıyor. Integration, Production ve G10 da açık. Kanıtı public repoda
> inceleyin: sırada hangi failure-state invariant'ını test etmeliyiz?
>
> #DesignTools #NoCode #WebDevelopment #OpenSource

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
