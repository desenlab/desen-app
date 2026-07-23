# DESEN

This repository contains the Web–React reference implementation of the frozen DESEN 0.1.0
protocol, the Desen App product, and the developer tooling intended for `desen.run`.

## Implementation progress

<!-- task-progress:start -->
<!-- Source: docs/plan/TASKS.md. Update this block in the same commit whenever a task status changes. Milestone gates are tracked separately and excluded from task counts. -->

**Overall:** `█████░░░░░░░░░░░░░░░░░░░` **30 / 144 tasks complete (21%)**

**M02 complete:** `█████████████` **13 / 13 tasks complete (100%)**

**M03 in progress:** `███░░░░░░░` **3 / 10 tasks complete (30%)**

**Proof gates:** **3 / 13 complete** · **Next:** `M03-T04`

[View the detailed task board](docs/plan/TASKS.md)

<!-- task-progress:end -->

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
P-02 is now `PROVEN` and G02 is `DONE`. P-17 advances only to `PARTIAL`: runtime materialization,
action-turn, bundle, and activation limits remain assigned to later milestones.

## License

Apache License 2.0. See [LICENSE](LICENSE).
