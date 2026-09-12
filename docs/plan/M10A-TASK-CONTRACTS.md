# M10A task contracts

Accepted planning baseline: 2026-09-10. No task below is implemented by this document.
[TASKS.md](TASKS.md) alone owns statuses/dependencies; the
[product plan](M10A-IMPLEMENTATION-PLAN.md) owns component and customization coverage.

## Common completion contract

Each task records scope, limitations, tests and exact reviewed identity in a new task-owned
`docs/proof/M10A-Tnn.md` report, with machine evidence at
`docs/proof/artifacts/m10a-tnn.json` (`nn` is the two-digit task number). These are planned paths,
not existing proof. A verifier must execute the claim, not merely search for test names or copy
another task's receipt. The task adds its positive/negative suites and verifier to the reviewed
CI inventory using existing infrastructure; it must not rewrite historical artifacts or weaken
proof selection. Named evidence and fresh exact-head hosted checks are required before DONE.

Every task runs the exact CI-02 local baseline in AGENTS.md, its focused suites, and the
current Runtime Core baseline verifier. Every new platform-neutral API has TSDoc and negative
dependency-boundary tests. App, workbench and host render the same reviewed adapters; samples are
explicit and cannot become live business data. New package edges are documented before use.

Task-level readiness distinguishes valid design, incomplete connection intent, fixture execution,
live integration, publication and activation. Missing optional connections never corrupt valid
Source or disable unrelated design. Invalid executable data never receives publication authority.
Changes require deterministic values, stable IDs, finite limits and atomic persistence; unknown
fields/extensions are preserved where their owning format permits, or explicitly rejected without
destructive import. No hidden CSS, arbitrary code, remote module selection or credentials in data.

## M10A-T01 — Base UI adapter boundary proof

- Owns: new private `@desen/starter-catalog-web`, reviewed Catalog/registry edge and bounded
  Button/Select/Dialog harnesses; exact Base UI 1.8.0 integrity/license/peer/dependency admission.
- Deliver: neutral styled parts, JSON event projection, declarative defaults and atomic required-slot
  subtree insertion through a bounded additive Editor Core transaction. The proof authoring surface
  and independent host harness consume the same static adapters.
- Prove: keyboard selection, Escape/focus return, overlay containment, disabled/loading states,
  bounded server-render/hydration smoke, StrictMode mount/unmount and identity preservation.
- Reject: unknown capability/part, callback or React-node injection, wrong event payload and portal
  escaping its approved preview boundary. No Runtime Core/protocol edits, normal App integration,
  complete library or old workspace migration.

## M10A-T02 — Project design-system model and token resolver

- Owns: platform-neutral `@desen/design-system-core`; versioned project envelope containing canonical
  Source, DTCG token documents, recipe metadata, assets and inert connection intent records.
- Deliver: finite schemas/migrations and typed color, dimension, number, typography, border, shadow
  and motion-value profiles; alias/mode resolution with explicit supported DTCG coverage.
- Prove: deterministic resolution, literal overrides and loss-aware round trips; keep the historical
  SC-01 profile unchanged. Reject cycles, missing/type-mismatched aliases, overflow and unsafe values.

## M10A-T03 — Theme and token authoring

- Owns: foundation/theme editor, color and typography controls, mode switching, token references,
  alias editing and validated import/export against T02's declared profile.
- Deliver: editable Neutral light/dark themes and arbitrary valid custom values; no forced palette,
  JSON-required ordinary edits or token-only restriction on capability-supported literals.
- Prove: preview, undoable edits and export/reimport round trips. Unsupported standard features are
  disclosed/preserved in the editable document; invalid imports never overwrite working data.

## M10A-T04 — Immutable design-system release identity

- Owns: detached release construction, digest identity, immutable token/font/image/recipe snapshots
  and the proposed host-profile release reference; T22 owns complete runtime activation integration.
- Deliver: finite content-addressed dependency manifest and atomic release-store port, separate from
  draft library versions. Unused metadata cannot become hidden production input.
- Prove: equal inputs/equal digest, changed production dependency/new identity, missing/tampered
  asset rejection and interrupted-write recovery. Never fall back to a mutable latest theme.

## M10A-T05 — Layout and content capabilities

- Owns: Box/Stack/Grid, Text/Heading, Image/Icon and Separator contracts plus Web adapters.
- Deliver: typed public layout/appearance parts, sensible Neutral defaults, accessible semantics and
  slot/category schemas. The additive current Catalog line is `0.2.0`; T01's original `0.1.0`
  artifact remains historical. Use semantic HTML where a Base UI primitive is unnecessary.
- Prove: all plan-listed layouts/styles in both renderers, logical RTL alignment and nested slots.
  Reject unknown style properties, invalid dimensions, executable content and private selectors.

## M10A-T06 — Form controls

- Owns: Button, TextField, TextArea, Checkbox, RadioGroup and Switch; label/help/error compositions.
- Deliver: editable visual parts/states and default presentation without required business actions;
  review and extend the T01 Button rather than duplicating a second implementation.
- Prove: label association, keyboard/focus, controlled input events and disabled/loading behavior.
  Reject invalid values/payloads; styling must not remove semantic input/label relationships.

## M10A-T07 — Selection and numeric controls

- Owns: Select, Combobox, Tabs, Slider and NumberField; extend the T01 Select implementation.
- Deliver: data-only options, public content slots, bounded filtering and stable selected identities.
- Prove: keyboard/typeahead, empty/disabled cases, tab selection and numeric bounds in canvas/host.
  Reject duplicate option IDs, non-finite values and functions as renderers or filter expressions.

## M10A-T08 — Overlays and disclosures

- Owns: Dialog, Popover, Tooltip, Menu and Accordion; extend the T01 Dialog implementation.
- Deliver: atomic insertion templates, safe preview portal roots, public parts and visual scenarios.
- Prove: open/close, nested focus return, Escape, pointer/keyboard parity and design-selection access.
  Reject missing required slots, forged portal authority and stale interactions after unmount.

## M10A-T09 — Data display and feedback

- Owns: Card, Badge, Avatar, Alert, List, basic Table, Skeleton and Progress.
- Deliver: empty/loading/error/ready examples, explicit item slots, text alternatives and row identity.
- Prove: sample-data design without an operation and later real data presentation; enforce repeat
  bounds and table semantics. No enterprise-grid, chart, server pagination or Sortable claim.

## M10A-T10 — Project and surface lifecycle

- Owns: ordinary project creation and add/rename/delete/reorder surfaces, frames and entry selection;
  generation-checked persistence of the T02 envelope through explicit application storage ports.
- Deliver: blank starter workspace with full admitted registry, autosave/explicit-save status,
  export/reopen and recoverable deletion. Preserve existing M10 profile identities and stored bytes.
- Prove: round-trip all project data; entry/reference validation, dirty navigation guards, stale-write
  conflict, interrupted save and unsupported version rejection without losing the last good project.

## M10A-T11 — Direct-manipulation canvas

- Owns: selection/multi-selection, layers, zoom/pan, drag/reparent/reorder, resize and keyboard equivalents.
- Deliver: predictable slot-aware manipulation and coordinate/viewport handling outside adapter internals.
- Prove: nested layout operations on large trees; required-slot/cardinality and stable IDs preserved.
  Reject cyclic moves and invalid drops atomically; overlays never mutate private capability DOM.

## M10A-T12 — Rich styling and responsive authoring

- Owns: all visual controls in the plan's customization table, including layout sizing, fills,
  gradients, borders, radii, shadows, typography, supported positioning/transforms and breakpoints.
- Deliver: typed controls, token-or-literal values, reset/inheritance indicators and responsive previews.
- Prove: two distinct brands and mobile/desktop layouts without JSX/CSS/JSON editing; preserve
  override order. Reject unsupported parts/unsafe style values rather than silently dropping them.

## M10A-T13 — Assets and fonts

- Owns: bounded image/icon/font import, local content-addressed storage, crop/fit controls, font
  metadata and export dependencies; documents record inert handles, not executable URLs.
- Deliver: licensed bundled defaults and explicit missing-asset diagnostics, with no remote request
  required for ordinary local authoring. Font readiness becomes a visual-capture prerequisite.
- Prove: reopen and exact release restoration; reject active SVG/HTML, path traversal, invalid MIME,
  unbounded decoded images/fonts and unauthorized network access. Preserve source files on rejection.

## M10A-T14 — History and identity-safe reuse operations

- Owns: undo/redo transactions, duplicate, copy/paste and multi-node edits across admitted surfaces.
- Deliver: ID allocation/reference remapping for nested nodes and bindings; crash-safe save boundaries.
- Prove: undo/redo restores exact authored values and links; duplication does not alias another
  instance's state. Reject hostile clipboard data, foreign capabilities and partial remapping.

## M10A-T15 — Masters and instances

- Owns: named reusable definitions, nested composition, instance relationships, explicit overrides,
  reset and detach, all managed by editor transactions rather than new runtime semantics.
- Deliver: atomic deterministic updates of ordinary Source subtrees before Publisher admission;
  conceptual nodes retain IDs and wiring, unaffected overrides survive master updates.
- Prove: update two instances, preserve a local override, detach a third, undo/reopen and compare.
  Reject recursive definitions, stale definitions and conflicting structural updates without data loss.

## M10A-T16 — Variants and visual states

- Owns: named component-set axes/presets, per-instance selection, responsive overrides and declared
  visual-state styling/forced preview. This exceeds an existing Button enum dropdown.
- Deliver: editor variants materialized as valid props/styles/conditional Source; no new live macro.
- Prove: author size/tone/custom brand variants, compose/nest and persist them; state preview needs
  no business wiring. Reject undeclared states and child mutation through Source `variants`.

## M10A-T17 — Design-system explorer and documentation

- Owns: built-in searchable component gallery, token/type scales, examples, usage guidance, controls,
  slots/events/parts and scenario presentation generated from the same Catalog/Source authorities.
- Deliver: an integrated Design System area; users need no handwritten Storybook story tree.
- Prove: changing a component contract updates docs/controls, real scenarios render consistently and
  schema/adapter mismatches fail visibly. Documentation content cannot execute scripts or components.

## M10A-T18 — Library management and impact

- Owns: library draft/version/release views, usage index, deprecation/replacement metadata, change
  comparison and explicit adoption of reviewed releases across local projects.
- Deliver: references to exact library versions; no unannounced propagation into published designs.
- Prove: discover affected instances/projects, inspect an upgrade, reject incompatible adoption and
  restore the prior release. Local authorship labels are not authenticated organization identities.

## M10A-T19 — Connections workspace and safe drafts

- Owns: separate Connections navigation, node-linked connection intents and durable incomplete forms.
- Deliver: design/save/reopen remain available while intent is unfinished; valid Source and pending
  intent are distinguished. Existing Advanced Source review keeps its explicit safety boundary.
- Prove: leave/reopen a half-written connection, continue styling and discard/apply it independently.
  Reject stale node targets and malformed executable candidates; unrelated design is unchanged.

## M10A-T20 — Visual local behavior wiring

- Owns: typed state and initial values, declared events, closed actions, conditions and navigation
  through visual controls. Frontend and designer workflows operate on the same managed Source.
- Deliver: all normal plan scenarios without raw JSON; missing intent never creates fake handlers.
- Prove: attach behavior after design, undo it without losing appearance, handle pending/success/error
  presentation and preserve dataflow types. Reject dangling references and incompatible action inputs.

## M10A-T21 — Data and integration wiring

- Owns: resource/operation browsing, schema-driven value binding and explicit trusted host readiness;
  a developer installation guide binds implementations outside Source and editor metadata.
- Deliver: separate sample/fixture/live indicators and finite local test integrations. No arbitrary
  endpoint, secret, fetch callback or package loader can be selected by a design document.
- Prove: sample design before host binding, fixture runs without network, then real bounded host
  data/action execution. Reject missing authority, wrong workspace, bad output and stale settlement.

## M10A-T22 — Run, publish and complete-release activation

- Owns: static/synthetic/live Run readiness, explicit publication and atomic host activation using
  Bundle/Catalog/design-system release tuples; extend host/control-plane ports, never Runtime Core.
- Deliver: save, review approval, publish and activate are distinct; static valid Source needs no action.
- Prove: same design before/after wiring, immutable theme/asset activation and complete-set rollback
  across restart. Reject missing assets/tokens, corrupt releases and partial durable commits.

## M10A-T23 — Reproducible scenario matrix

- Owns: data-only component/page scenarios for supported states, two themes, viewports and fixtures.
- Deliver: the same scenario identity powers the explorer, interaction tests and visual capture.
- Prove: matrix coverage for every starter component and selected composed screens; repeat runs
  settle deterministically. Missing adapter, unresolved font, unfinished scenario or unsupported
  fixture is a failed test, not an omitted/successful story.

## M10A-T24 — Visual capture and difference engine

- Owns: hermetic Playwright capture and pinned pixel-diff implementation, masks with explicit scope,
  candidate/baseline/diff artifacts and finite rendering/capture limits.
- Deliver: identities cover Source, Catalog, design-system/asset/font bytes, scenario, browser build,
  viewport, locale and capture policy. Disable animations and freeze time/network fixtures explicitly.
- Prove: unchanged captures compare consistently and seeded changes produce expected diffs. Reject
  missing/truncated screenshots, environment mismatches and capture errors; never auto-update baselines.

## M10A-T25 — Visual review and release checks

- Owns: side-by-side/overlay diff UI, explicit accept/reject with reason, persisted review history and
  machine-readable readiness for the exact candidate and complete selected matrix.
- Deliver: first baseline requires explicit acceptance; any identity change invalidates old approval.
  Optional draft saves remain possible; a reviewed release requires all mandatory checks, including
  the completed T26 acceptance output. Execute T26 before T25 despite their numeric labels.
- Prove: stale approval, missing cases, failed capture and schema/a11y failures block reviewed release.
  A local single-user acknowledgment is not a cryptographic signature or enterprise approval system.

## M10A-T26 — Accessibility and performance acceptance

- Owns: keyboard/focus and accessibility assertions, responsive overflow/text zoom, RTL and reduced
  motion checks plus measured editor, matrix-render and release-size limits.
- Deliver: checked-in budgets for a named benchmark fixture: 500 nodes, 50 component instances,
  two themes and three viewports; record machine/browser, repetitions and p50/p95 results.
- Prove: all critical controls work without pointer, no critical/serious automated accessibility
  violations in the admitted matrix, no unintended overflow at 360/768/1440 widths. Set latency/size
  budgets from measured baseline before optimizing, not from invented results or relaxed timeouts.

## M10A-T27 — Design-first product journeys

- Owns: independent browser journeys for blank-to-settings form, list/detail workspace and dashboard.
- Deliver: theme edits, custom master/variants, instance overrides, responsive design, assets,
  save/reopen and workbench review first; later wiring and independent-host publication second.
- Prove: no JSON, hidden seed tree, handwritten host screen or external service needed for these
  workflows. Cover interrupted drafts, wrong bindings, rejected visual changes and complete rollback.

## M10A-T28 — Closure and handoff

- Owns: joined verifier/report, fresh M10 regressions, all M10A receipts and runnable local demo.
- Deliver: exact limitations, supported customization/component matrix, developer integration guide,
  project backup/migration instructions and named evidence for every new claim.
- Prove: clean-checkout reproducibility, complete current CI inventory, immutable protocol/Core trees
  and all positive/negative/browser suites. Do not promote prior task receipts to fresh success.

## G10A closure

Run exhaustive local compatibility and fresh exact-head hosted closure; every M10A task must be DONE.
Produce `docs/proof/M10A-GATE.md` and `docs/proof/artifacts/m10a-gate.json` as new evidence, not
replacements for G10. Check the product plan acceptance scenarios and workbench scope explicitly.
Only then may M11's Map/Sortable branches start. No external release follows automatically.
