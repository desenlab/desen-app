# DESEN

This repository contains the Web–React reference implementation of the frozen DESEN 0.1.0
protocol, the Desen App product, and the developer tooling intended for `desen.run`.

## Implementation progress

<!-- task-progress:start -->
<!-- Source: docs/plan/TASKS.md. Update this block in the same commit whenever a task status changes. Milestone gates are tracked separately and excluded from task counts. -->

**Overall:** `█████████░░░░░░░░░░░░░░░░` **49 / 144 tasks complete (34%)**

**M02 complete:** `█████████████` **13 / 13 tasks complete (100%)**

**M03 complete:** `██████████` **10 / 10 tasks complete (100%)**

**M04 progress:** `████████████░░░░` **12 / 16 tasks complete (75%)**

**Proof gates:** **4 / 13 complete** · **Next:** `M04-T13`

[View the detailed task board](docs/plan/TASKS.md)

<!-- task-progress:end -->

**Strategic checkpoint:** `SC-01` is complete with the recommendation **`continue`**. DESEN
remains independent; A2UI is complementary, with only a deliberately narrow fail-closed bridge
spike retained as evidence.

## Product boundaries

- **DESEN** is the open, data-only executable design protocol.
- **Desen App** (`desen.app`) is the official visual authoring and publishing product built on
  DESEN. It is not the protocol itself.
- **DESEN Developer Platform** (`desen.run`) is the protocol, SDK, conformance, integration, and
  package documentation home. It is a domain and developer surface, not a second authoring product.
- **`desen` on npm** will become the developer entry package and CLI after the public-alpha proof
  gates pass.

## Current goal

Prove, with repeatable evidence, that a designer-authored surface can be validated, published as
an immutable DESEN bundle, and activated in a separately built host application without a
developer recreating that surface in React.

The first target is exactly `web-react`. Platform-neutral packages must remain free of React,
DOM, CSS, browser, and application dependencies so future native runtimes can implement the same
observable protocol semantics.

## Workspace map

```text
apps/
  desen-app/              Visual authoring and publishing product
  reference-host-web/     Separately built production-like proof host
  control-plane-api/      Source, bundle, and channel service
  desen-run/              Future DESEN Developer Platform site
packages/
  protocol/               Frozen 0.1.0 artifacts, types, diagnostics, digest helpers
  validator/              Structural and semantic validation
  publisher/              Pure source-to-bundle publication
  runtime-core/           Framework-neutral execution semantics
  runtime-react/          React render adapter
  runtime-web/            Browser host ports and last-known-good storage
  catalog-sdk/            Capability registration and manifest tooling
  editor-core/            Framework-neutral source editing commands
  editor-web/             Desen App canvas and inspector
  reference-catalog-web/  Real components shared by editor and host
  testkit/                Fixtures, trace assertions, and conformance helpers
  desen/                   Future public npm facade and CLI
```

## Non-negotiable rules

1. The frozen protocol repository is never silently edited to make the implementation pass.
2. The runtime and publisher are built before the visual editor.
3. The Desen App preview and reference host use the same registered component implementations.
4. The reference host contains no manually duplicated managed-screen component tree.
5. Production bundles contain data, never arbitrary executable code.
6. Unknown or incompatible capabilities fail explicitly; runtimes never guess replacements.
7. A failed activation leaves the last-known-good revision active.
8. Every public export has TSDoc and every package has a maintained README.
9. Comments explain invariants and reasoning, not syntax.
10. No external package or domain is published before the public-alpha release gate.

## Start here

- [Project status](PROJECT-STATUS.md)
- [Master implementation plan](docs/plan/MASTER-PLAN.md)
- [Task board](docs/plan/TASKS.md)
- [Strategic validation checkpoints](docs/plan/STRATEGIC-VALIDATION.md)
- [SC-01 DESEN–A2UI comparison](docs/proof/SC-01-DESEN-A2UI-COMPARISON.md)
- [DTCG 2025.10 compatibility profile](docs/profiles/DTCG-2025.10-COMPATIBILITY.md)
- [ADR 0009: protocol positioning and interoperability](docs/adr/0009-sc-01-protocol-positioning-and-interoperability.md)
- [Proof matrix](docs/proof/PROOF-MATRIX.md)
- [Structural-validation proof](docs/proof/PROTOCOL-STRUCTURAL-VALIDATION.md)
- [Semantic-foundation proof](docs/proof/PROTOCOL-SEMANTIC-FOUNDATION.md)
- [Component-contract proof](docs/proof/PROTOCOL-COMPONENT-CONTRACTS.md)
- [Interaction-contract proof](docs/proof/PROTOCOL-INTERACTION-CONTRACTS.md)
- [Binding-contract proof](docs/proof/PROTOCOL-BINDING-CONTRACTS.md)
- [Execution-contract proof](docs/proof/PROTOCOL-EXECUTION-CONTRACTS.md)
- [Official-suite parity proof](docs/proof/PROTOCOL-OFFICIAL-SUITE-PARITY.md)
- [Validator diagnostic micro-vector proof](docs/proof/PROTOCOL-VALIDATOR-DIAGNOSTIC-MICRO-VECTORS.md)
- [Catalog registration and derivation proof](docs/proof/CATALOG-MANIFEST-REGISTRATION.md)
- [Web–React package digest proof](docs/proof/WEB-REACT-PACKAGE-DIGEST.md)
- [Reference Web component proof](docs/proof/REFERENCE-CATALOG-WEB-COMPONENTS.md)
- [Reference Web form and feedback proof](docs/proof/REFERENCE-CATALOG-WEB-FORM-FEEDBACK.md)
- [Reference token and synthetic fixture proof](docs/proof/REFERENCE-TOKENS-AND-SYNTHETIC-FIXTURES.md)
- [Reference sign-in fixture and host-binding proof](docs/proof/REFERENCE-SIGN-IN-FIXTURES-AND-HOST-BINDING.md)
- [Reference Web implementation-parity proof](docs/proof/REFERENCE-CATALOG-WEB-PARITY.md)
- [Reference Web capability-artifact proof](docs/proof/REFERENCE-CATALOG-WEB-CAPABILITY-ARTIFACT.md)
- [Runtime core host-port proof](docs/proof/RUNTIME-CORE-HOST-PORTS.md)
- [Runtime core value-resolution proof](docs/proof/RUNTIME-CORE-VALUE-RESOLUTION.md)
- [Runtime core token and format-resolution proof](docs/proof/RUNTIME-CORE-TOKEN-FORMAT-RESOLUTION.md)
- [Runtime core predicate-evaluation proof](docs/proof/RUNTIME-CORE-PREDICATE-EVALUATION.md)
- [Runtime core Variant and style-override proof](docs/proof/RUNTIME-CORE-VARIANT-STYLE-EVALUATION.md)
- [Runtime core local-state and base-identity proof](docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md)
- [Runtime core repeat-materialization proof](docs/proof/RUNTIME-CORE-REPEAT-MATERIALIZATION.md)
- [Runtime core resource-lifecycle proof](docs/proof/RUNTIME-CORE-RESOURCE-LIFECYCLE.md)
- [Runtime core operation-lifecycle proof](docs/proof/RUNTIME-CORE-OPERATION-LIFECYCLE.md)
- [Runtime core state and navigation-action proof](docs/proof/RUNTIME-CORE-STATE-NAVIGATION-ACTIONS.md)
- [Runtime core operation and resource-action proof](docs/proof/RUNTIME-CORE-OPERATION-RESOURCE-ACTIONS.md)
- [Runtime core command and host-event action proof](docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Technology stack](docs/architecture/TECHNOLOGY-STACK.md)
- [Engineering standards](docs/standards/ENGINEERING-STANDARDS.md)
- [Documentation standards](docs/standards/DOCUMENTATION-STANDARDS.md)
- [Protocol findings](docs/plan/PROTOCOL-FINDINGS.md)

## Local quality commands

```bash
pnpm install
pnpm verify:protocol-snapshot
pnpm check
```

`pnpm proof` and `pnpm test:e2e` deliberately return `NOT_IMPLEMENTED` until their G10 runners
exist; an absent proof runner is never treated as a successful proof.

The exact DESEN 0.1.0 input snapshot is vendored and checksum-enforced. Schema-derived types,
canonical JSON and SHA-256 primitives, the 36-code diagnostic registry, and RFC 6901 JSON Pointer
support are implemented. Structural validation now checks unknown input against the exact frozen
Source, Bundle, and Catalog roots and validates all protocol-defined embedded JSON Schema locations.
It returns an independent immutable snapshot and stable pointer diagnostics; runtime validation
does not compile document schemas, evaluate document content, or access the network.

The M02-T07 semantic foundation now adds strict Semantic Versioning, exact declared-catalog
matching, entry and identity rules, one catalog capability namespace, category-aware component,
behavior, resource, and operation existence, and opaque extension preservation. Trusted catalog
pools may contain extra packages, but an undeclared package never authorizes a document capability.

The M02-T08 component-contract stage now validates statically knowable component props and Variant
patches, slot declarations and children, visual states, style parts, and style properties. Dynamic
ValueSpecs remain inert and become explicit later-validation obligations. Component schemas pass a
documented host-safe preparation profile before the code-free interpreter can apply them.

The M02-T09 interaction stage extends that boundary to behavior props, slots, styles, attachment
and exclusive-channel conflicts; declared component and behavior events; and command names for
already-known component targets. Its separate resolved-event API copies and freezes adapter
payloads, applies explicit depth/size limits, and validates them as ordinary JSON rather than DESEN
bindings. Event-reference resolution, command targets and inputs, and resource/operation contracts
are completed by the later T10/T11 validator boundaries; digests, publication, adapters, and
runtime execution remain later tasks. The first product proof is still `web-react`, while the
protocol and validator packages remain independent of React, DOM, and browser APIs so future iOS
and Android runtimes can reuse the same contract.

The M02-T10 binding stage now validates each surface's state schema and inert initial value,
surface-local `state.*`, lexical `item.*`, and immediate-turn `event.*` references, exact `$format`
placeholders, statically decidable predicate operand types, and repeat item/alias/key contracts. It
preserves every unresolved component and behavior obligation from T09 instead of guessing dynamic
host values. T11 now consumes that binding foundation; runtime predicate evaluation and dynamic
repeat materialization remain deliberately assigned to the runtime.

The M02-T11 execution-contract stage now prepares bounded operation/resource schemas; validates
resource policies and inputs, operation inputs and surface-scoped aliases, lifecycle references,
navigation and refresh targets, component-command targets and inputs, and statically decidable
state writes; and preserves four new dynamic execution obligations alongside the four inherited
binding obligations. Its detached five-kind resolved-value API checks command input and
operation/resource input or output as immutable inert JSON. This proves the validator handoff, not
host authorization, mounted-component liveness, adapter invocation, lifecycle settlement, or
action-turn execution.

M02-T12 proves built TypeScript parity with the frozen DESEN 0.1.0 starter suite: all 9 official
conformance vectors and all 5 public examples produce the outcomes required by the manifest, just
as the archived Python baseline passes 14/14. M02-T13 closes the declared validator scope with one
positive and one negative project micro-vector for each of 28 emitted core diagnostics and 6
validator-namespaced extension diagnostics. All 68 executions pass with exact code,
classification, pointer, and context checks where those fields apply, without adding a public API.
P-02 is now `PROVEN` and G02 is `DONE`. P-17 advances only to `PARTIAL`: the remaining runtime
materialization stages, action-turn, bundle, and activation limits stay assigned to later
milestones.

M03-T04 now defines the target-separated Web–React package digest profile. It commits a projected
canonical Catalog and exact artifact bytes through versioned, length-delimited framing, then hashes
that preimage with SHA-256. Its 18 package tests and 16 independent proof tests cover 269 pinned
mutation vectors, Catalog self-reference verification, caller ownership, immutable audit output,
portable paths, hostile inputs, and an independent cryptographic oracle. This makes P-05
`PARTIAL`; the complete artifact inventory, reproducible final tuple, distribution, and activation
remain later tasks.

M03-T05 now implements the first real reference capabilities. The frozen official Stack and Text
manifests are exposed with schema-derived React props; Stack preserves slot/reading order without
inventing ARIA semantics, while Text emits native paragraph, heading, or caption elements and
escapes markup-like strings as inert text. The deterministic evidence checks exact manifest
equality, closed public props, validator acceptance, negative contract cases, built-package
semantics, 420 pinned Stack cross-product vectors, 56 Text/escaping vectors, exact source-shape
checks, 5 focused component tests, 7 compiler-negative cases, and 18 independent proof/mutation
tests. Its proof remains the verified prerequisite for the later component slices.

M03-T06 now adds the official TextField, Button, and Alert capabilities without widening their
closed Catalog contracts. TextField uses a real label/input relationship and exact frozen change
payloads; Button preserves native non-submit activation and suppresses disabled/loading presses;
Alert maps critical feedback to `role="alert"` and ordinary feedback to `role="status"`. A narrow
TextField focus handle exposes no DOM node. The cumulative evidence validates a five-component
Catalog and controlled Source through all six validator layers, executes 256 server-rendered and
23 real React interaction vectors, fixes 11 component tests, 22 compiler-negative cases, and 18
independent mutation tests, and records the frozen prose/Catalog tone conflict as `PF-027`.

M03-T07 now adds a DTCG 2025.10-backed reference Web token provider and framework-neutral
synthetic fixture infrastructure. The provider resolves an exact 26-token inventory to 26 existing
CSS custom properties without adding a DOM wrapper or generic runtime token policy. Testkit
projects only inert `manifest.authoring.fixtures`, enforces operation/resource category and
bounded-data rules, and permits lookups only on factory-created snapshots. Its deterministic
evidence covers exact component fallback parity, real React host-style application, 19 package
tests, 20 compiler-negative cases, and 16 independent proof/mutation tests.

M03-T08 now adds the exact official sign-in operation and controlled authoring outcomes. Its
success fixture is `{ userId: "user-1" }`; `invalidCredentials` has an empty synthetic failure
payload, while `unavailable` deliberately has no invented fixture. `pending` remains runtime
lifecycle state, not static fixture data. Inert operation data and executable host code live behind
separate package subpaths. The host binding fixes the operation id and preserves only an
application-supplied callable by identity; its return stays opaque so M04 can define validation,
settlement, concurrency, and diagnostics without an early result envelope. Five focused package
tests, 10 compiler-negative cases, and 14 independent proof/mutation tests cover official-manifest
equality, successful-output schema validation, immutable/detached fixtures, missing outcomes,
binding exclusion, exact exports, source boundaries, and deterministic evidence. P-10 advances
only to `PARTIAL`; real reference-host execution remains M10-T04.

M03-T09 now proves complete Catalog-to-implementation parity for the deliberately narrow sign-in
reference slice: five exact official component entries and the explicitly delegated sign-in
operation. Canonical frozen metadata covers every declared prop, slot, event, command, style part,
visual state, real component export, and trusted component-side binding without carrying a module
selector, React value, or host handler. The cumulative suite passes 26 package tests, 10
compiler-negative cases, and 14 independent proof/mutation tests, including exact event and focus
schemas, native accessibility semantics, hostile DOM-prop exclusion, same-identity authoring and
production exports, public-subpath boundaries, and prerequisite drift. S-004 is `TESTED`; P-06 is
only `PARTIAL`. Generic runtime bridging, resolved style application, Desen App, and the final
immutable tuple remain later work.

M04-T01 now defines the first framework-neutral runtime integration boundary: nine exact ports and
fourteen stable callbacks for navigation, immutable Bundle/activation storage, operations,
resources, tokens, context, environment, clock, and diagnostics. The factory captures
receiver-independent callables without executing or wrapping them, rejects accessor, inherited,
extra, missing, and reflection-hostile shapes. Its task-scoped API contributes one runtime export
and thirty documented types while allowing later runtime-core exports to grow deliberately. Ten
focused package tests, nine compiler-negative cases, and ten independent proof/mutation tests
protect the exact M04-T01 source/distribution subset, platform neutrality, direct test registration,
package entry points, prerequisite integrity, and safe atomic evidence writes across eleven tracked
files. This is a reference implementation profile, not a new frozen-protocol transport.

M04-T02 now adds the bounded, read-only value resolver used by the future runtime. It takes one
immutable snapshot of `state`, `context`, `resource`, `operation`, `event`, `item`, and `env`;
keeps missing distinct from `null`, `false`, `0`, and empty text; applies fallback only when the
primary reference is missing; and never executes host callbacks or reinterprets resolved data as a
second reference. Hostile, cyclic, executable, accessor-backed, malformed, or over-budget values
fail closed without exposing a partial result. Token and string-format forms are recognized but
remain deliberately deferred to M04-T03. The task contributes three runtime exports and seventeen
types with complete TSDoc. Its evidence passes 34 package tests, 10 compiler-negative cases, 13
independent proof/mutation tests, 9 trace assignments, and 11 byte-tracked files. No Proof Matrix,
normative-coverage, or proof-gate status changes.

M04-T03 now completes the two value forms deliberately deferred by that primitive. Tokens resolve
only through one explicit host port, with one lookup per unique token in each top-level call;
missing, resolved JSON `null`, and redacted provider failure remain distinct. Formatting accepts
only the closed PF-017 `{name}` grammar: strings are inserted unchanged and every other JSON value
uses RFC 8785 canonical text, with no expression, locale, markup, or platform evaluation. Nested
reference, fallback, token, and format values preserve exact pointers, complete-result behavior,
and the same safety limits. The additive API contributes one runtime export and four types with
complete TSDoc. Its evidence passes 7 focused package tests, 7 compiler-negative cases, 13
independent proof/mutation tests, 2 direct trace assignments, and 11 byte-tracked files. Consumer
schema validation remains M05; no Proof Matrix, normative-coverage, or proof-gate status changes.

M04-T04 now evaluates the protocol's thirteen closed predicate operators over one immutable
seven-namespace snapshot and converts an optional `when` into an explicit instantiation decision.
It processes arguments left-to-right and never short-circuits a completed boolean evaluation,
preserves ordered dynamic type diagnostics, uses RFC 8785 equality and exact UTF-16 string
semantics, and keeps a direct unresolved operand distinct from a nested predicate that evaluated
false. Resolved operands are charged to one shared budget immediately, so the first terminal keeps
document order and later values cannot amplify retained copies. `exists` performs a status-only
original-reference probe, including JSON `null`, without evaluating fallback or copying a large
referenced value. At the M04-T04 checkpoint, token and format operands were deferred for M04-T05
composition. The public API adds two functions and ten types; 53 focused tests, 13 compiler-negative
cases, and 14 independent proof/mutation tests protect exact arities, the 64-predicate-node bound,
true conditional absence, platform neutrality, and eleven tracked files. P-17 remains `PARTIAL`;
no proof-gate status changes.

M04-T05 now applies base props and style first, evaluates every Variant condition in document
order, and lets each later matching Variant replace only the exact prop or style-property leaf it
declares. All sibling conditions share the same immutable snapshot and one turn-scoped token
session, while matching indexes and winning source pointers preserve ordered provenance. The
selected ValueSpecs remain raw and inert for M05 materialization and receiving-schema validation;
M04-T05 does not claim adapter delivery, CSS behavior, or child-tree mutation. Hostile,
over-budget, or incompletely materialized conditions fail closed without exposing partial maps.
The public API adds one function and nine types with ten complete TSDoc declarations. Evidence
passes 30 focused package tests, 25 compiler-negative cases, and 14 root proof/mutation tests,
including 13 artifact-independent mutation checks, two direct trace assignments, and eleven
tracked files; the cumulative runtime-core suite passes 134/134. P-17 remains `PARTIAL`, N-014
remains `PLANNED`, and no proof-gate status changes.

M04-T06 now mounts fresh surface-local state atomically, validates every initial and complete
post-write entry against its prepared Draft 2020-12 schema, and exposes values only through
immutable generation snapshots behind an opaque handle. Invalid writes return
`STATE_WRITE_INVALID` without partial state; canonical no-ops keep the exact snapshot and
generation. Explicit unsupported schema vocabularies fail closed. A separate repeat-free node
identity primitive uses the exact document/surface/node tuple, preserves compatible identities by
reference, and classifies capability changes as remounts and tuple changes as replacements.
Evidence passes 33 focused package tests, 7 compiler-negative cases, and 13 root proof/mutation
tests across 23 task-owned source and distribution files; the cumulative runtime-core suite passes
167/167. N-024 is now `TESTED`; repeat keys, action execution, reactivity, and actual adapter
instance preservation remain later work. P-17 stays `PARTIAL`, and no proof-gate status changes.

M04-T07 now materializes repeats through lexical, isolated alias scopes without duplicating the
complete runtime snapshot for every item. Items remain in source order; string and finite-number
keys use type-sensitive RFC 8785 identity, with duplicate, missing, malformed, or over-budget
inputs rejecting the whole repeated subtree without truncation or partial output. The Reference
Profile's exact 1,000-instance limit is executable. Repeated node identity composes the complete
outer-to-inner key path onto M04-T06's document/surface/node identity, preserving reorder-stable
instances while classifying key changes as replacements and capability changes as remounts.
Evidence passes 34 focused package tests, 7 compiler-negative cases, and 15 root proof/mutation
tests across 11 task-owned files; the cumulative runtime-core suite passes 201/201. N-014 and
N-041 gain executable repeat evidence but remain `PLANNED` for their other owners. P-17 stays
`PARTIAL`, and no proof-gate status changes.

M04-T08 now gives every declared resource one atomic, immutable lifecycle. `mount` and `once`
requests start from one pre-start snapshot, `manual` waits for explicit refresh, and every input
is materialized through the shared token/format resolver before exact Catalog schema validation.
Refresh accepts only the current manager-issued snapshot, so stale, foreign, and structurally
ABA-equal views fail closed. Output, public errors, adapter failures, policy denial, supersession,
and disposal remain separated without exposing hostile values or raw exceptions. Terminal
snapshot capacity is reserved before a request starts, active host transports are capped at 64,
and later work waits in a bounded replacement queue. Evidence passes 52 focused package tests,
9 compiler-negative cases, and 23 root proof/mutation tests across 11 task-owned files; the
cumulative runtime-core suite passes 253/253. N-041 gains resource-limit evidence but remains
`PLANNED`; full cross-manager snapshot provenance remains M04-T16. P-17 stays `PARTIAL`, and no
proof-gate status changes.

M04-T09 now gives every predeclared operation alias one Catalog-authoritative lifecycle. Resolved
input and successful output cross exact schema boundaries; only declared public error codes are
exposed, and host denial uses the exact core `OPERATION_DENIED` diagnostic. Accepted identities are
deterministic, omitted concurrency defaults to `reject`, replacement is validated before
newest-wins supersession, and FIFO queueing is bounded across the whole surface. Terminal
settlements publish before an opaque acknowledgement lease is issued. A settlement handler may
start the same alias as a visible staged `pending` invocation, but its host transport cannot begin
until the predecessor turn acknowledges the lease. Evidence passes 36 focused package tests, 10
compiler-negative cases, and 19 root proof/mutation tests across 11 task-owned files; the
cumulative runtime-core suite passes 289/289. N-041 gains operation queue/transport evidence but
remains `PLANNED`; action dispatch remains M04-T10–M04-T13, P-17 stays `PARTIAL`, and no proof-gate
status changes.

M04-T10 now executes one guarded state or managed-surface navigation action against the exact
current M04-T06 state lifetime. The optional guard is evaluated before action-specific payload
observation; a true guard and its payload share one detached, bounded token session. Every hostile
reflection, token, diagnostic, and navigation boundary rechecks lifetime and exact state
authority. Set and toggle reuse complete-entry schema validation, toggle accepts only an exact
boolean, and unknown navigation targets fail before parameters. Host denial remains distinct from
redacted adapter failure. Successful navigation, including same-surface success, terminally
disposes the old executor and local state and leaves only a minimal tombstone. Evidence passes 42
focused package tests, 11 compiler-negative cases, and 19 root proof/mutation tests across 16
task-owned files; the cumulative runtime-core suite passes 331/331. N-041 remains `PLANNED`;
ordered turns and settlement dispatch remain M04-T11–M04-T13, full provenance remains M04-T16,
P-17 stays `PARTIAL`, and no proof-gate status changes.

M04-T11 now composes guarded `operation.invoke` and `resource.refresh` actions without blocking the
originating turn. Operation success and declared-failure handlers are selected and detached at
acceptance time, then exposed only through an immutable settlement descriptor and opaque one-shot
finalization ticket; raw lifecycle leases never enter the public API. Resource refresh preserves
the exact current lifecycle authority. False guards observe no action-specific payload, and true
guards share one bounded token session with the selected input. Evidence passes 87 focused package
tests, 24 compiler-negative cases, and 19 root proof/mutation tests across 11 task-owned files; the
cumulative runtime-core suite passes 418/418. M04-T13 still owns ordered settlement turns and
mandatory finalization, full joint provenance remains M04-T16, P-17 stays `PARTIAL`, and no
proof-gate status changes.

M04-T12 now routes Catalog-authorized component commands only to one unambiguous live runtime
instance and validates allowlisted application-shell events before emission through a separate
synchronous host bridge. Registration exposes only inert identity under opaque generation
tickets—never a DOM node, component object, ref, method table, or callback. Unknown commands and
events fail before hostile payload observation; valid command input and event payload are detached
under the same bounded resolution rules, and adapter failures remain redacted. Exact finite
registry, request, generation, reentry, disposal, and shared 4,096-node boundaries are executable.
Evidence passes 53 focused package tests, 21 compiler-negative cases, and 19 root proof/mutation
tests across 16 task-owned files; the cumulative runtime-core suite passes 471/471. N-031 is now
`TESTED`; incoming adapter events remain M04-T14, ordered turns remain M04-T13, production adapter
parity remains M05, P-17 stays `PARTIAL`, and no proof-gate status changes.

## License

Apache License 2.0. See [LICENSE](LICENSE).
