# Project Status

Last updated: 2026-07-22

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
execution has not started and is not claimed as proven.

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
  `M02-T13 — Validator diagnostic micro-vectors`
- Active task: None
- Ready next task: `M03-T01 — Framework-neutral catalog registration API`
- Status: `READY_TO_START`

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
- The cumulative implementation passes formatting, lint, strict typecheck, build, protocol
  integrity tests, protocol traceability and type-generation tests, remaining scaffold test
  runners, and dependency-boundary checks.

## Current blocker

No technical blocker. The following release-hygiene item remains and does not block implementation:

- The upstream repository still lacks a `v0.1.0` Git tag, but the exact commit and checksum are
  sufficient for deterministic local work. Tag creation remains release hygiene under `PF-004`.

## Next task

Begin only `M03-T01`: build the framework-neutral JSON manifest and contract registration API with
no React, DOM, browser, iOS, or Android types in its public boundary.

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
- artifact SHA-256: `4e869c1451352857a4b221c367446f0e185f22c81b6991cbba364555da9cdbd1`

M02-T06 evidence:

- `docs/proof/PROTOCOL-STRUCTURAL-VALIDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-structural-validation.json`
- artifact SHA-256: `7b3a8ca36b3c4191c5691a4c19c1ac086acfd05142ab54f8a6caad08638210c8`
- generated validator SHA-256: `d608147be42cfcc683a4427212fe6714c6ff85fba07f031b61b418ddcba019cd`

M02-T07 evidence:

- `docs/proof/PROTOCOL-SEMANTIC-FOUNDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json`
- artifact SHA-256: `8703bb3a664b70fef2055d0d1821d3a7259e7e7e38a41f2076aa9b3460e44947`

M02-T08 evidence:

- `docs/proof/PROTOCOL-COMPONENT-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-component-contracts.json`
- artifact SHA-256: `c158b9b982bb52011760c81f0ad305919c461ea66f019ed83438e0e39aeddd93`

M02-T09 evidence:

- `docs/proof/PROTOCOL-INTERACTION-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json`
- artifact SHA-256: `4a4a62ee9b64f448bcb1612b1ece89cf9007dc8f4112c6fd1a8a2b3e1e3e98b6`

M02-T10 evidence:

- `docs/proof/PROTOCOL-BINDING-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-binding-contracts.json`
- artifact SHA-256: `33f83c126b5f8ae292997f11e0cf9e3ef4a52fb47c485a2f8700b39f198957ae`

M02-T11 evidence:

- `docs/proof/PROTOCOL-EXECUTION-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-execution-contracts.json`
- artifact SHA-256: `30a1c69430f316e90a2dcee1f12bdf4dec971b54edf6cfcacf975442479e352c`

M02-T12 evidence:

- `docs/proof/PROTOCOL-OFFICIAL-SUITE-PARITY.md`
- `docs/proof/artifacts/protocol-0.1.0-official-suite-parity.json`
- artifact SHA-256: `b8515a277bc3f26bcee4c09172ae95fb90aeb461be3a261a11bcac7e27a22aa8`

M02-T13 evidence:

- `docs/proof/PROTOCOL-VALIDATOR-DIAGNOSTIC-MICRO-VECTORS.md`
- `docs/proof/artifacts/protocol-0.1.0-validator-diagnostic-micro-vectors.json`
- artifact SHA-256: `a59b2a1bdb727c882e47171b38a68c11b0f5f5f320a40044f387d2ca1f67c306`

## Status vocabulary

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

Only one implementation task may be `IN_PROGRESS` at a time.
