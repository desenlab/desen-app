# DESEN 0.1.0 Reference Implementation Master Plan

Last reviewed: 2026-09-10

## Objective

Produce evidence that DESEN 0.1.0 can author, validate, publish, activate, and execute a managed
Web–React surface without a developer manually recreating its component tree.

This project proves a reference implementation and its declared conformance coverage. It does not
claim universal interoperability, production security certification, or mobile support.

Desen App must also make interface design useful before behavior wiring: ready real components,
an editable design language, reusable component sets and an integrated design-system workbench.
The [M10A product plan](M10A-IMPLEMENTATION-PLAN.md) owns this additional product acceptance scope.

## Delivery rules

- Milestones run in order: M00–M10, M10A, M11, M12. Each preceding gate must pass.
- Only one task may be `IN_PROGRESS`.
- Every proof claim requires an automated test, reproducible artifact, or source audit.
- Screenshots and videos may explain evidence but cannot be the only evidence.
- Protocol ambiguities are recorded; the frozen upstream is never silently patched.
- Public package and domain publishing remains disabled until `G12`.

Product and interoperability assumptions are checked through the non-counted
[Strategic Validation Checkpoints](STRATEGIC-VALIDATION.md). `SC-01` runs after `G03` and before
`M04`; `SC-02` runs after `G10` and before `M11`. These checkpoints do not change task numbering or
the README progress denominator. SC-02 concluded `adapt`; M10A adds 28 real implementation tasks
and G10A, making the explicit plan total 176 tasks and 14 gates. Existing completed work is retained.

## Milestones and gates

### M00 — Frozen protocol and proof contract

Lock the exact upstream commit, verify its checksums and the 14-case baseline (9 conformance
vectors plus 5 public examples), inventory the normative obligations used by the implementation,
and initialize findings and proof tracking.

**Gate G00:** The implemented protocol bytes and proof scope are unambiguous.

### M01 — Professional workspace foundation

Establish reproducible tools, CI, package boundaries, documentation rules, and a single-command
quality gate.

**Gate G01:** A clean checkout installs and passes every empty-workspace quality check.

### M02 — Protocol package and validator

Vendor a checksum-verified upstream snapshot, derive or check TypeScript types against JSON
Schema, implement canonical digests and stable diagnostics, then match and extend the official
conformance vectors.

**Gate G02:** The TypeScript validator reproduces the official baseline and covers the protocol
features required by the proof.

### M03 — Catalog SDK and reference capability package

Register components, behaviors, operations, and resources from manifest authority. Build the
accessible Stack, Text, TextField, Button, and Alert components and controlled sign-in fixtures.

**Gate G03:** One exact `web-react` reference slice resolves real component implementations,
inert authoring/production parity metadata, and explicit delegated bindings in an immutable tuple.
Executable React adapter registration remains M05 work.

### M04 — Framework-neutral runtime core

Implement resolution, predicates, state, repeats, resources, operations, actions, behaviors,
limits, and protocol-observable traces without React, DOM, browser, or application imports.

**Gate G04:** A headless sign-in surface behaves deterministically from a bundle and event trace,
and post-audit hardening proves generic nested-settlement publication, exact evidence locations,
and deterministic completion-fault containment before React integration begins.

### M05 — React runtime and separate reference host

Render runtime plans through registered React adapters in an independently built host. Preserve
stable identity and source-node diagnostics.

**Gate G05:** The official sign-in bundle works in the host and no manual sign-in tree exists.

### M06 — Deterministic publisher

Validate a source, resolve exact catalogs, strip authoring state, normalize deterministically,
pin package tuples, and produce a self-validating immutable bundle.

**Gate G06:** The same source produces the same revision; invalid sources produce no bundle.

### M07 — Atomic activation and last-known-good

Separate staged and active revisions, preflight exact packages, atomically swap the active pointer,
and persist the previous good revision across restart.

**Gate G07:** An invalid publication never breaks the currently active surface.

### M08 — Framework-neutral editor core

Edit the DESEN source directly using stable, deterministic commands. Keep selection and viewport
state under `authoring` so it does not change the production digest.

**Gate G08:** A UI-independent editor model creates and updates valid sources while preserving
stable node identities.

### M09 — Desen App Web MVP

Build the component panel, layer tree, real-component canvas, schema-driven inspector, named-slot
editing, state/binding/action editing, Design/Run modes, fixtures, persistence, diagnostics, and
publish action.

**Gate G09:** A user creates, tests, saves, and publishes the sign-in surface without editing code
or raw JSON.

### M10 — First end-to-end proof

Automate and document the full Desen App → Publisher → separate host workflow, including invalid
publication and last-known-good cases. The automated path must remain reproducible through the
visible no-code behavior controls; raw JSON may be an advanced escape hatch, never the required
designer journey. Before the lifecycle matrices continue, the product composition must also be
evergreen: a trusted application root selects one authenticated project-workspace profile, while
generic editor, preview, persistence, runtime, and publication modules remain independent of the
reference sign-in example.

**Gate G10:** The managed sign-in surface has no handwritten React counterpart and can change in
the host without changing host source code.

No Map, Sortable, domain deployment, or npm publication may start before `G10`.

### M10A — Design-first product foundation

Build the selected Base UI-backed Web starter Catalog with DESEN Neutral styling, theme/token
management, rich layout/style authoring, reusable masters/instances/variants, separate Connections
and Run workspaces, and built-in component documentation/scenarios/visual review. Designers can
create and save complete visual designs before a frontend developer or designer wires behavior.
The workbench removes the need for separate Storybook/Chromatic workflows for the declared DESEN
surface set; it does not claim a replacement for arbitrary framework stories or hosted team services.

**Gate G10A:** Three ordinary-product design-first journeys, design-system management, reproducible
visual review and later same-Source functionalization pass; existing M10 proofs and the complete
frozen Runtime Core identity remain intact. See the [task contracts](M10A-TASK-CONTRACTS.md).
No further external user recruitment is required for this founder-directed product investment.

### M11 — Capability extensibility proof

Integrate a real Map component and Sortable behavior as capability packages without modifying
runtime-core. After G10A, use them through the M10A authoring and workbench model to author a
second store-operations surface.

**Gate G11:** Complex capabilities are integrated once by a developer and then reused by Desen
App without new screen implementation code.

### M12 — Evidence report and public-alpha preparation

Complete conformance coverage, proof artifact generation, integration quickstarts, documentation,
package audits, release runbook, and an honest implementation report.

**Gate G12:** The Web–React reference implementation is repeatable by another developer and ready
for an explicitly labeled public alpha.

M10A is local product groundwork toward the first beta, not an external beta release. A beta label
requires the M10A acceptance scope, M11/G11 and M12/G12 evidence plus an explicit release decision.
Hosted multi-user beta requires its own security/identity/operations scope; npm prerelease policy
remains [ADR 0005](../adr/0005-npm-distribution.md). No existing alpha gate is silently renamed.

## Product demonstration

The final demonstration contains three managed surfaces in one coherent Store Operations product:

1. Sign-in: local state, validation, operation pending/failure/success, and navigation.
2. Store map: resource data, marker composition, popup slot, visual states, and component command.
3. Priority list: repeat scope, sortable behavior, reorder event, and host operation.

Before this extension demo, G10A also proves blank-to-settings, list/detail and dashboard design
journeys with custom themes/components, built-in documentation and visual review, then later wiring.

## Mobile readiness contract

Mobile is deferred, but these constraints apply from the first implementation task:

- `protocol`, `validator`, `publisher`, `runtime-core`, and `editor-core` cannot import React,
  React Native, DOM, browser APIs, CSS, or application code.
- Navigation, storage, operations, resources, tokens, environment, clock, and diagnostics enter
  through host ports.
- Core values and traces remain JSON-serializable.
- Capability contracts use semantic concepts rather than class names, selectors, HTML, or
  framework node values.
- Future native targets receive exact sibling catalogs and must run the same observable trace
  tests; pixel-identical cross-platform output is not promised.

## Explicitly deferred

- iOS, Android, React Native, SwiftUI, and Compose runtimes
- second independent implementation and interoperability certification
- arbitrary existing-code round trip or source-code export
- general vector design tools and arbitrary CSS/DOM inspection
- production authentication, organizations, roles, and permissions
- multiplayer, comments, plugin marketplace, telemetry, experiments, and rollout control
- AI-generated production capability implementations
- signed-publication standard and production security certification
