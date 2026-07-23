# Project Status

Last updated: 2026-07-23

## Plain-language status

Local implementation preparation is complete and the private GitHub repository is active at
`desenlab/desen-app`. M02-T01 proved that the implementation consumes an exact, checksum-enforced
DESEN 0.1.0 input snapshot. M02-T02 then assigned all 269 reviewed prose entries and all 989
machine-enumerated JSON Schema constraints to future implementation and test owners. M02-T03 now
derives the Source, Bundle, and Catalog TypeScript roots deterministically from those frozen
schemas. M02-T04 now provides RFC 8785 canonical JSON, platform-neutral SHA-256, and the exact
Source-digest and Bundle-revision projections. M02-T05 now provides the exact 36-code core
diagnostic registry, inert shared diagnostic data, and RFC 6901 JSON Pointer primitives. M02-T06
now provides exact frozen-root structural validation for Source, Bundle, Catalog, and all 13
embedded-schema locator families, returning an independent immutable snapshot. M02-T07 now adds
the platform-neutral semantic foundation: strict SemVer, exact declared-catalog matching, entry and
identity namespaces, set-wide capability uniqueness, category-aware capability existence, and
opaque extension preservation. M02-T08 now applies component prop and Variant schemas, slot
contracts, accepted-child rules, visual states, and style-part contracts while preserving dynamic
values as explicit later-validation obligations. M02-T09 now adds behavior prop/slot/style
contracts, attachment and conflict rules, declared event and known-target command names, plus a
bounded resolved-event-payload validator. M02-T10 now validates state schemas and initial values,
lexical references and event turns, predicate operand types, formatting placeholders, repeat
arrays, aliases, keys, direct limits, and narrow state-action roots while preserving all dynamic
runtime responsibilities for their assigned later tasks. M02-T11 now validates resource and
operation schemas, lifecycle value references, navigation and refresh actions, command targets and
inputs, and state writes while preserving resolved-value checks as explicit bounded obligations.
M02-T12 now proves that the built TypeScript implementation matches the archived Python baseline
across the exact frozen 14-case starter suite: 9 conformance vectors and 5 public examples pass.
M02-T13 now proves one accepted and one exact rejected micro-vector for every diagnostic the
validator currently emits: 28 core codes and 6 validator-namespaced extension codes. The proof
checks both runs, both caller inputs, complete inert-result equality, deep immutability, and exact
diagnostic identity. This closes G02 without adding a public validator API. Runtime adapter
execution has not started and is not claimed as proven. M03-T01 through M03-T03 now provide the
cumulative Catalog SDK registration and derivation slice: component, behavior, operation, and
resource contracts register as exact, detached, canonical-key-ordered, deeply frozen JSON and
compose into one validator-accepted four-map Catalog. Component prop types and inspector metadata
derive from the same literal `propsSchema`; unsupported schema features remain visible through an
explicit structured-JSON fallback. Its 33 package tests, 71 compile-time negative cases, and 43
independent evidence tests cover 26 successful registrations, 7 Catalog compositions, all 6
cross-category collision pairs, 24 inspector fallback cases, exact depth/width limits, caller
isolation, platform neutrality, exact public exports, 140 hostile registration combinations, and
35 hostile inspector values. `PF-024` keeps inert manifest registration separate from trusted
executable host bindings, while `PF-025` keeps undefined control hints opaque and
non-authoritative. M03-T04 now adds the target-specific Web–React package digest profile without
moving executable concerns into the framework-neutral Catalog SDK. Versioned length framing commits
the projected canonical Catalog and exact artifact bytes; 18 package tests, 16 independent proof
tests, 5 compiler-negative cases, and 269 pinned mutations cover deterministic identity,
self-reference verification, path and byte boundaries, caller ownership, immutable output, and an
independent Node.js SHA-256 oracle. `PF-026` records the explicit Catalog self-field projection.
P-05 advances to `PARTIAL`, while the final real package tuple and G03 remain open. M03-T05 now
implements the official Stack and Text manifests as real accessible Web–React components. Their
props derive from the closed Catalog schemas, Stack preserves declared child/reading order without
fabricated ARIA semantics, and Text maps inert strings to native paragraph, heading, or caption
elements. Exact fixture equality, validator acceptance, semantic rendering, hostile text escaping,
public-package boundaries, and mutation detection are now reproducible evidence. M03-T06 now adds
the official TextField, Button, and Alert manifests with schema-derived props, native accessible
semantics, exact frozen event payloads, and a narrow focus-command handle that exposes no DOM node.
Its cumulative proof exercises a controlled five-component Source through all six validator
layers and executes real built-package render, event, and focus behavior. M03-T07 now adds one
DTCG 2025.10 reference document and a DOM-free Web provider for the exact 26 CSS custom properties
used by those components. Framework-neutral testkit infrastructure separately projects only inert
synthetic operation/resource fixtures, rejects wrong categories and host bindings, enforces
deterministic depth/node/byte bounds, and permits lookup only on factory-created snapshots. The
evidence preserves the earlier component artifacts and changes no `P-*` status.

## Current milestone

- Completed gates: `G00`, `G01` (`G01` is explicitly local-only), `G02`
- Completed preparation tasks: `M01-T07 — Local tracked baseline`, `M01-T08 — Remote and CI`
- Current milestone: `M03 — Catalog SDK and reference capability package`
- Completed implementation tasks: `M02-T01 — Frozen snapshot and checksum enforcement`,
  `M02-T02 — Complete protocol traceability`, `M02-T03 — Schema-derived types`,
  `M02-T04 — RFC 8785-compatible canonicalization and SHA-256 golden tests`,
  `M02-T05 — Stable diagnostic model and JSON Pointer support`,
  `M02-T06 — Structural validation`,
  `M02-T07 — Identity, SemVer, entry, catalog namespace, extension, and reference validation`,
  `M02-T08 — Component prop, slot, style-part, and visual-state contract validation`,
  `M02-T09 — Event, command, behavior attachment, conflict, and payload-contract validation`,
  `M02-T10 — State, predicate, repeat, alias, and static binding validation`,
  `M02-T11 — Resource, operation, action, navigation, and command-target validation`,
  `M02-T12 — TypeScript parity for the official 14-case suite`,
  `M02-T13 — Validator diagnostic micro-vectors`,
  `M03-T01 — Framework-neutral catalog registration API`,
  `M03-T02 — Behavior, operation, and resource registration APIs`,
  `M03-T03 — Manifest-authoritative TypeScript and inspector-control derivation`,
  `M03-T04 — Deterministic Web–React package digest profile`,
  `M03-T05 — Accessible Stack and Text capabilities`,
  `M03-T06 — Accessible TextField, Button, and Alert capabilities`,
  `M03-T07 — Reference tokens and synthetic fixture infrastructure`
- Active task: None
- Ready next task: `M03-T08 — Sign-in success/failure fixtures and separate host operation binding`
- Status: `DONE`

## Completed preparation

- Product naming and domain responsibilities are defined.
- Web-first and future-native architecture boundaries are defined.
- The current npm `desen` package state is recorded without destructive changes.
- The workspace quality toolchain, exact lockfile, and package boundaries work locally.
- The local baseline commit is authored and committed only as Selman Ay, and a temporary clean clone
  passes the locked install and full quality gate.
- The private `desenlab/desen-app` remote is configured and its first `main` CI run passed.
- The implementation milestones, exact `web-react` conformance targets, clause owners, and proof
  claims are defined.
- The frozen protocol baseline was rerun with 14/14 suite cases passing: 9 vectors + 5 examples.
- The complete protocol trace reviews 196 normative headings, assigns 269 prose entries, and maps
  all 989 schema constraints exactly once across 61 families; 11 verifier mutation tests pass.
- Three schema-root declarations are generated with a pinned build-only tool, exposed as three
  documented package types, and protected by 10 deterministic drift tests plus strict compile-time
  positive and negative fixtures.
- RFC 8785 canonicalization, UTF-8 encoding, pure ECMAScript SHA-256, exact digest formatting,
  Source authoring exclusion, and Bundle revision/publication exclusion pass 12 package tests and
  8 root evidence/differential tests. All 24 finite RFC number samples, 8 SHA-256 goldens, and 5
  frozen DESEN documents are content-addressed in the M02-T04 artifact.
- All 36 Appendix B diagnostic definitions, their exact classifications and meanings, portable
  frozen diagnostic data, and RFC 6901 JSON Pointer primitives pass 17 package tests and 8 root
  evidence/mutation tests. The complete 12-example RFC table, hostile caller-owned inputs, public
  exports, command wiring, and tracked implementation hashes are covered by the M02-T05 artifact.
- The three exact DESEN roots and all 44 embedded schemas in the frozen valid corpus pass
  structural validation. All 13 generic embedded-schema locator families are guarded by 14
  mutation cases; 63 package tests and 8 root evidence/mutation tests also cover immutable input
  isolation, stable diagnostics, malformed URI references, no external resolution, deterministic
  standalone generation, and the built platform-neutral distribution.
- The semantic foundation passes 85 focused package tests and 9 independent evidence/mutation
  tests. It covers 19 reviewed schema-owner families with 201 constraints, 28 strict SemVer
  goldens, exact requirement and target matching, entry and shared identity namespaces, all four
  capability categories, undeclared-catalog isolation, extension opacity, the two official T07
  invalid vectors, and explicit T08–T11 scope fences.
- The component-contract layer passes 58 focused package tests and 21 independent evidence/mutation
  tests over 7 reviewed schema families with 191 constraints. It checks base and Variant props,
  slot presence/cardinality/acceptance, visual states, style parts, dynamic obligations,
  dispatcher parity, immutable results, depth and regex safety boundaries, and explicit T09–T11
  fences. A separate post-fix review reran all four safety/semantics reproducers and found no
  remaining P1/P2 issue.
- The cumulative interaction-contract layer passes 114 focused package tests and 10 independent
  evidence/mutation tests over 7 T09-owned schema families with 246 constraints. It covers 15
  behavior, 6 attachment, 7 conflict, 8 schema-safety, and 10 payload-safety goldens; the official
  T09 unknown-event vector; R-069 behavior identity; private trust branding; exact diagnostic
  pointers; prototype-inherited declaration rejection; and explicit T10/T11 scope fences.
- The cumulative binding-contract layer passes 173 focused package tests and 48 deterministic
  project mutation goldens over 10 reviewed schema families with 300 constraints and 12 prose
  rules. It validates inert state initials, fallback/null distinctions, lexical state/item/event
  scopes, predicate types, exact linear formatting, repeat arrays/aliases/keys/direct limits,
  narrow state-action roots, immutable results, dispatcher parity, all five frozen binding
  diagnostic identities, and byte-for-byte preservation of all four T09 obligation kinds. Two
  independent post-fix reviews found no remaining open source issue.
- The cumulative execution-contract layer passes 220 focused package tests over 9 reviewed schema
  families with 383 constraints, 11 prose rules, and 2 invariants. Its independent artifact covers
  42 negative project mutations, 1 accepted and 5 rejected schema-safety cases, 4 accepted and 6
  rejected bounded resolved-value safety cases, 4 separately executed hostile-value rejections, 3
  forged lower-stage catalog entry-point rejections, all 5 frozen examples, 4 inherited plus 4 new
  obligation kinds, and all 5 resolved-value selectors. It validates static operation/resource
  inputs, lifecycle references, navigation, refresh, component commands, and state actions without
  claiming runtime execution.
- The official-suite proof passes all 14 exact frozen cases through built TypeScript distributions:
  9 conformance vectors and 5 public examples, comprising 8 valid and 6 invalid outcomes across 8
  Source, 4 Bundle, and 2 Catalog executions. It matches the archived Python runner's 14/14 result,
  passes 4 focused package tests and 11 independent root proof/mutation tests, composes T04 and T11
  only inside the proof boundary, and exports no new validator API.
- The diagnostic micro-vector proof passes 34 positive/negative pairs: all 28 core diagnostics the
  validator emits plus all 6 current validator-namespaced extension diagnostics. Its 4 focused
  package tests and 9 independent root proof/mutation tests cover exact diagnostic data, 53 trace
  responsibilities, complete two-run inert-result equality, hidden-property and caller-input
  mutation, internal-slot rejection, prerequisite tampering, deterministic artifacts, and safe
  writes. Eight later-owner core diagnostics stay explicitly excluded. P-02 is `PROVEN`, G02 is
  `DONE`, and P-17 is only `PARTIAL`; N-041 remains `PLANNED` until runtime, Bundle-ingress, and
  activation limits are implemented.
- The cumulative Catalog SDK slice passes 33 package tests, 71 compile-time negative cases, and 43
  independent evidence/mutation tests. It preserves all 12 component, 14 behavior, 9 operation,
  and 10 resource manifest fields; readonly authoring inputs; literal inference; recursive
  exactness for closed nested records and array items; canonical property order; caller ownership;
  deep immutability; case-sensitive and prototype-like ids; distinct-object duplicate rejection in
  all four categories; all 6 cross-category collision pairs; and 140 hostile category/value
  rejections. The same literal `propsSchema` now yields conservative readonly TypeScript props and
  a detached inspector plan covering all 10 authoring fields, all 5 scenario fields, 7 control
  kinds, 24 honest fallback cases, 35 hostile inspector values, RFC 6901 pointers, whole-object
  enums, integer-like canonical key order, and exact 16-level/512-control limits. Source, emitted
  declarations, and built JavaScript remain framework-neutral with only `@desen/protocol` as a
  runtime dependency. Manifest registration carries no executable renderer or host binding.
  Independent post-fix review found no remaining P1/P2 issue.
- The Web–React package digest profile passes 18 focused package tests, 5 compiler-negative cases,
  and 16 independent proof/mutation tests. Its five-entry golden commits a projected RFC
  8785-compatible Catalog plus exact authoring-adapter, production-adapter, host-binding, and token
  bytes through a versioned big-endian frame. The fixed 1,640-byte preimage hashes to
  `sha256:bb22ecc7a2849fe7466d9b5cba7d2c99dc7f8c3bd17b7c505244b2c308359589`;
  all 269 pinned byte, path, Catalog, inventory, and declared-digest mutations are detected. The
  API remains browser-portable, returns detached immutable audit data, rejects shared memory and
  hostile structural inputs, and agrees with an independent Node.js cryptographic oracle. P-05 is
  only `PARTIAL`; reference tokens, fixtures, complete parity, and the final package remain M03-T07
  through M03-T10.
- The foundational reference component slice passes 5 focused component tests, 7 compiler-negative
  cases, and 18 independent evidence/mutation tests. Its Stack and Text registrations equal the
  frozen official Web Catalog entries, are deeply immutable, and keep both public prop schemas
  closed. A composed two-component Catalog and controlled Source pass the built validator, while
  an undeclared Stack prop and missing Text content fail at exact pointers. Server-rendered
  evidence checks 420 pinned Stack cross-product vectors and 56 Text/escaping vectors while exact
  source-shape checks cover continuous width behavior. It confirms neutral Stack semantics,
  preserved child order, native `p`/`h2`/`small` Text elements, and inert hostile markup. Strict
  provenance prevents injected APIs, inherited options, alternate web exports, or symlink aliases
  from claiming the tracked result. It remains the independently verified prerequisite for later
  component slices.
- The cumulative form-and-feedback slice passes 11 focused component tests, 22 compiler-negative
  cases, and 18 independent evidence/mutation tests. TextField, Button, and Alert registrations
  equal the frozen official Catalog entries and complete the five closed public component prop
  schemas. A controlled Source binds `change` to a state write and `press` to the TextField
  `focus` command, passing structural, semantic, component, interaction, binding, and execution
  validation while preserving one exact runtime state-write obligation. Independent evidence
  executes 256 server-rendered and 23 real React/JSDOM interaction vectors, including exact
  single-argument frozen payloads, disabled/loading suppression, unique label association, native
  button semantics, inert hostile strings, and enabled/disabled focus-handle behavior without DOM
  or return-value leakage. `PF-027` records the frozen abbreviated-prose Alert tone conflict.
  S-004 remains `PLANNED` only for M03-T09's final implementation-parity gate; no `P-*` status
  changes.
- The reference token and synthetic fixture slice passes 19 package tests, 20 compiler-negative
  cases, and 16 independent proof/mutation tests. One fixed DTCG 2025.10 subset resolves exactly 26
  token paths to the 26 CSS custom properties already consumed by the reference components, with
  exact fallback parity and a real React host-style check. The provider adds no wrapper, global
  style mutation, or generic DESEN token policy. Testkit projects only
  `manifest.authoring.fixtures`, preserves canonical detached immutable data, rejects missing
  operation error declarations, wrong or duplicate categories, host-binding fields, forged
  snapshots, non-string lookup names, and inputs beyond the 64-level, 20,000-node, and
  1,048,576-byte limits. Its context records caller classification rather than claiming to detect
  secrets or personal data; N-036 and N-040 remain `PLANNED` for their later audits.
- Proof artifact ownership is now task-scoped: growing root orchestration, shared ledgers, package
  manifests, and later export barrels are checked semantically instead of being claimed as earlier
  tasks' byte-owned files. Required commands, dependencies, findings, clause rows, API subsets,
  prerequisite artifacts, and security mutations remain enforced.
- The cumulative implementation passes formatting, lint, strict typecheck, build, protocol
  integrity tests, protocol traceability and type-generation tests, remaining scaffold test
  runners, and dependency-boundary checks.

## Current blocker

No technical blocker. The following release-hygiene item remains and does not block implementation:

- The upstream repository still lacks a `v0.1.0` Git tag, but the exact commit and checksum are
  sufficient for deterministic local work. Tag creation remains release hygiene under `PF-004`.

## Next task

Complete only `M03-T08`: add controlled sign-in success/failure fixtures and a separate trusted
host operation binding without placing executable code, endpoints, credentials, or authorization
inside Catalog or fixture data.

M02-T02 evidence:

- `docs/proof/artifacts/protocol-0.1.0-traceability.json`
- artifact SHA-256: `749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514`

M02-T03 evidence:

- `docs/proof/PROTOCOL-TYPES.md`
- `docs/proof/artifacts/protocol-0.1.0-types.json`
- artifact SHA-256: `e21826f5d171aefbed2e3fd833e6f0dc10de1bac71e7b74f51a255f43bb37971`

M02-T04 evidence:

- `docs/proof/PROTOCOL-CANONICALIZATION.md`
- `docs/proof/artifacts/protocol-0.1.0-canonicalization.json`
- artifact SHA-256: `8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6`

M02-T05 evidence:

- `docs/proof/PROTOCOL-DIAGNOSTICS.md`
- `docs/proof/artifacts/protocol-0.1.0-diagnostics.json`
- artifact SHA-256: `e3ec18d8e870e8bbfb8dbfb9958d35208c894519b6ba9af30b6b0bcc5c9e7b8b`

M02-T06 evidence:

- `docs/proof/PROTOCOL-STRUCTURAL-VALIDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-structural-validation.json`
- artifact SHA-256: `7e7662e6b20e29452f8c5092e37d2fefe1a416e787816693543b0c2c1a2e6536`
- generated validator SHA-256: `d608147be42cfcc683a4427212fe6714c6ff85fba07f031b61b418ddcba019cd`

M02-T07 evidence:

- `docs/proof/PROTOCOL-SEMANTIC-FOUNDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json`
- artifact SHA-256: `96048882670a6c23629ff686f61e14105a51bc6bcf287fff7ee372045782caa7`

M02-T08 evidence:

- `docs/proof/PROTOCOL-COMPONENT-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-component-contracts.json`
- artifact SHA-256: `71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac`

M02-T09 evidence:

- `docs/proof/PROTOCOL-INTERACTION-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json`
- artifact SHA-256: `981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208`

M02-T10 evidence:

- `docs/proof/PROTOCOL-BINDING-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-binding-contracts.json`
- artifact SHA-256: `2ffa1b874bae23df8ba3e0e0334b3f0b6739ec4dfd6acc9e2aabf1c87ce9c39c`

M02-T11 evidence:

- `docs/proof/PROTOCOL-EXECUTION-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-execution-contracts.json`
- artifact SHA-256: `f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`

M02-T12 evidence:

- `docs/proof/PROTOCOL-OFFICIAL-SUITE-PARITY.md`
- `docs/proof/artifacts/protocol-0.1.0-official-suite-parity.json`
- artifact SHA-256: `efa6b4ed014b942d45d621ffc77c47e76d82dd6965deb13cf677c6bebf7a76ae`

M02-T13 evidence:

- `docs/proof/PROTOCOL-VALIDATOR-DIAGNOSTIC-MICRO-VECTORS.md`
- `docs/proof/artifacts/protocol-0.1.0-validator-diagnostic-micro-vectors.json`
- artifact SHA-256: `3214a26a683d46a3b20c6ca400de44faa2c5e394f706a6e3e8d3d3628da78718`

M03-T01 through M03-T03 cumulative evidence:

- `docs/proof/CATALOG-MANIFEST-REGISTRATION.md`
- `docs/proof/artifacts/catalog-sdk-0.1.0-manifest-registration.json`
- artifact SHA-256: `062ec5656ca507c79fef0ce97e87931b54fa23a038a8862b2532b6e7e9ba3432`

M03-T04 evidence:

- `docs/proof/WEB-REACT-PACKAGE-DIGEST.md`
- `docs/profiles/WEB-REACT-PACKAGE-DIGEST-V1.md`
- `docs/proof/artifacts/reference-catalog-web-package-digest-v1.json`
- artifact SHA-256: `e56c74696e8aa68c1d3ab71ac3ae087ed8c5df05f4a19b9a6d310da8758b0716`

M03-T05 evidence:

- `docs/proof/REFERENCE-CATALOG-WEB-COMPONENTS.md`
- `docs/proof/artifacts/reference-catalog-web-components.json`
- artifact SHA-256: `788b68af9520ebf49fac1d39a505bc11e153f6a1d7a5ab89f57c9207b251cc51`

M03-T06 evidence:

- `docs/proof/REFERENCE-CATALOG-WEB-FORM-FEEDBACK.md`
- `docs/proof/artifacts/reference-catalog-web-form-feedback.json`
- artifact SHA-256: `553a48cb95aa2a9e6c2ee4e860aea7aedea92499c977b093c1c515c0ad9d75f2`

M03-T07 evidence:

- `docs/proof/REFERENCE-TOKENS-AND-SYNTHETIC-FIXTURES.md`
- `docs/proof/artifacts/reference-tokens-and-synthetic-fixtures.json`
- artifact SHA-256: `f6345186537abec56540f83156e01f0900f11e6aa1592c13517171c193bcb34f`

## Status vocabulary

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

Only one implementation task may be `IN_PROGRESS` at a time.
