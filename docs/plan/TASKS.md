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
| I07-01 | IN_PROGRESS | M07-T01, explicit user authorization | Current-reader checkpoint, machine-enforced cleanup register, and a non-authoritative `SHADOW + EXHAUSTIVE` modular candidate                     | `docs/proof/baselines/i07-01-modular-proof-shadow.json`            |
| I07-02 | NOT_STARTED | I07-01                               | Exact legacy/modular equivalence, shared-state classification, and required-CI cutover to `REQUIRED + EXHAUSTIVE` execution                       | `docs/proof/baselines/i07-02-required-exhaustive-equivalence.json` |
| I07-03 | NOT_STARTED | I07-02                               | Fail-closed `SHADOW + AFFECTED` selector with complete tracked-path ownership, unknown-to-exhaustive fallback, and a frozen observation threshold | `docs/proof/baselines/i07-03-affected-selector-shadow.json`        |
| I07-04 | NOT_STARTED | I07-03                               | Promote proven PR selection, retain exhaustive main/release/manual coverage, and remove all G07-due current-reader compatibility shims            | `docs/proof/baselines/i07-04-affected-selector-promotion.json`     |
| I07-05 | NOT_STARTED | I07-04                               | Retire the legacy sequential runner only after rollback, failure, cancellation, hosted, and zero-reference gates pass                             | `docs/proof/baselines/i07-05-legacy-retirement.json`               |

`CI-01` temporarily precedes `M04-T03` in the working order but does not change the protocol task
dependency graph, milestone totals, or proof-gate counts. It must keep the existing task-specific
commands available, run every frozen-snapshot, proof-artifact, negative, mutation, and boundary
check from fresh inputs, and must not trust path filters or cached proof success.

`I07-01` and `I07-02` temporarily precede `M07-T02` in the working order without changing the
145-task implementation total or proof-gate counts. M07-T02 remains `NOT_STARTED` and is
intentionally paused by its explicit I07-02 dependency. The legacy gate remains the sole pass/fail
authority while the candidate runs as `SHADOW + EXHAUSTIVE`. I07-02 may switch the modular path to
`REQUIRED + EXHAUSTIVE` only after exact workload, result, cancellation, tracked-workspace, hosted,
and shared-state equivalence passes.

I07-03 may observe later real task changes without selecting the required workload. Its threshold
must be frozen before observation begins and must include every selector category, zero false
negatives, and at least 20 consecutive same-revision hosted comparisons. I07-04 may then promote
`AFFECTED` selection for eligible pull requests. Unknown, ambiguous, policy, dependency,
frozen-input, unowned-path, or incomplete-diff changes must always expand to `EXHAUSTIVE`. Fresh
`EXHAUSTIVE` verification remains mandatory on `main`, releases, and manual audits.

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

| ID      | Status      | Depends on              | Deliverable / evidence                                                                                               |
| ------- | ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| M07-T01 | DONE        | G06                     | Content-addressed bundle store with immutable revision entries                                                       |
| M07-T02 | NOT_STARTED | M07-T01, I07-02         | Protocol, revision, available source digest, and bundle-size verification                                            |
| M07-T03 | NOT_STARTED | M07-T02                 | Exact package target/version/digest resolution and preflight                                                         |
| M07-T04 | NOT_STARTED | M07-T02–M07-T03         | Surface/capability reference and finite-limit preflight                                                              |
| M07-T05 | NOT_STARTED | M07-T01                 | Local control-plane API for editable sources, immutable bundles, and mutable channel pointers                        |
| M07-T06 | NOT_STARTED | M07-T03–M07-T05         | Staged runtime indexes and active/staged state separation                                                            |
| M07-T07 | NOT_STARTED | M07-T04, M07-T06        | Durable transactional commit of `{activeRevision, previousGoodRevision}` as one consistent record                    |
| M07-T08 | NOT_STARTED | M07-T07                 | Restart recovery validates and restores the transactional active/previous-good record                                |
| M07-T09 | NOT_STARTED | M07-T07–M07-T08         | Fault injection at fetch, integrity, package resolution, preflight, staging, durable commit, and recovery boundaries |
| M07-T10 | NOT_STARTED | M07-T09                 | A → invalid B → valid C, concurrent activation, and restart behavior tests                                           |
| M07-T11 | NOT_STARTED | M07-T05, M07-T10        | Control-plane channel consumed by separately built reference host                                                    |
| G07     | NOT_STARTED | M07-T01–M07-T11, I07-04 | Every pre-commit fault preserves a valid durable activation record and invalid revision never becomes active         |

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
storage only: M07-T02 still owns integrity and size verification; channels, package preflight,
activation, last-known-good recovery, and host consumption remain later M07 tasks. `N-010` remains
`PLANNED` for M07-T03 installed-package verification and M12-T12 packed-distribution evidence;
`N-019` remains `PLANNED` for M07-T05 control-plane integration, P-12 remains `NOT_PROVEN`, and G07
remains open.

`docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json`
`sha256:698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795`.

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
