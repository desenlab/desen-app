# DESEN 0.1.0 Reference Implementation Master Plan

## Objective

Produce evidence that DESEN 0.1.0 can author, validate, publish, activate, and execute a managed
Web–React surface without a developer manually recreating its component tree.

This project proves a reference implementation and its declared conformance coverage. It does not
claim universal interoperability, production security certification, or mobile support.

## Delivery rules

- Milestones run in order. A gate must pass before work starts on the next milestone.
- Only one task may be `IN_PROGRESS`.
- Every proof claim requires an automated test, reproducible artifact, or source audit.
- Screenshots and videos may explain evidence but cannot be the only evidence.
- Protocol ambiguities are recorded; the frozen upstream is never silently patched.
- Public package and domain publishing remains disabled until `G12`.

Product and interoperability assumptions are checked through the non-counted
[Strategic Validation Checkpoints](STRATEGIC-VALIDATION.md). `SC-01` runs after `G03` and before
`M04`; `SC-02` runs after `G10` and before `M11`. These checkpoints do not change task numbering or
the README progress denominator.

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

**Gate G04:** A headless sign-in surface behaves deterministically from a bundle and event trace.

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
publication and last-known-good cases.

**Gate G10:** The managed sign-in surface has no handwritten React counterpart and can change in
the host without changing host source code.

No Map, Sortable, domain deployment, or npm publication may start before `G10`.

### M11 — Capability extensibility proof

Integrate a real Map component and Sortable behavior as capability packages without modifying
runtime-core. Use them to author a second store-operations surface.

**Gate G11:** Complex capabilities are integrated once by a developer and then reused by Desen
App without new screen implementation code.

### M12 — Evidence report and public-alpha preparation

Complete conformance coverage, proof artifact generation, integration quickstarts, documentation,
package audits, release runbook, and an honest implementation report.

**Gate G12:** The Web–React reference implementation is repeatable by another developer and ready
for an explicitly labeled public alpha.

## Product demonstration

The final demonstration contains three managed surfaces in one coherent Store Operations product:

1. Sign-in: local state, validation, operation pending/failure/success, and navigation.
2. Store map: resource data, marker composition, popup slot, visual states, and component command.
3. Priority list: repeat scope, sortable behavior, reorder event, and host operation.

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
