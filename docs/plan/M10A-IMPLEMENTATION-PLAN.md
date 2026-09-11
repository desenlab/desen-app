# M10A — Design-first product foundation

Decision date: 2026-09-10. Planning is complete; M10A-T01 and M10A-T02 are `DONE`. M10A-T03 is
`IN_PROGRESS`: local implementation/evidence is a candidate and exact-head hosted checks are
pending. The canonical statuses and dependencies are in [TASKS.md](TASKS.md).

## Product promise

A designer starts with useful, real components, creates a design language and reusable components,
and designs an interface before connecting application behavior. A designer or frontend developer
then makes the same Source functional; nobody recreates the managed screen in application code.
Desen App is both the DESEN reference authoring product and a usable design tool, not only a
protocol demonstration. The protocol and developer platform remain usable without Desen App.

SC-02 concluded with an [adaptation decision](STRATEGIC-VALIDATION.md#sc-02--problem-and-pilot-validation).
The user explicitly chose product development without another external interview or pilot round.
This is an investment decision, not a claim of validated demand, conversion, or product-market fit.

## Delivery sequence and accounting

The sequence is G10 → M10A → G10A → M11 → G11 → M12 → G12. M10A adds 28 implementation tasks
and one gate; the total becomes 176 tasks and 14 gates. The 123 completed tasks and 11 completed
gates remain completed. T01 and T02 are the two completed M10A tasks, T03 is `IN_PROGRESS`, and the
other 25 remain `NOT_STARTED`. Nothing is renumbered, erased, or counted as implemented by this plan.
At most one implementation task may be active at a time; task dependencies do not grant parallel
implementation authority. M11 retains its two explicitly permitted capability branches after G10A.
Dependencies, not numeric order, select the next eligible task: T26 acceptance precedes T25's
combined review/release checks so accessibility evidence cannot be replaced with a placeholder.

M10A is an internal, local-first Web–React product foundation. It does not deploy a hosted service.
M12 remains the public-alpha packaging/security/documentation checkpoint, including I07-05.
The first beta must include this foundation, M11 extension proof, and G12 release evidence, plus
an explicit beta release decision. It must not be declared merely by renaming an alpha artifact.
Hosted accounts, organizations, authorization and collaboration require a separately scoped
delivery plan before a hosted beta; they are not silently promised by a local review workflow.
Existing npm version/dist-tag and external-release approval rules remain unchanged.

## Selected component foundation

Use **Base UI, `@base-ui/react` 1.8.0**, wrapped by a new private `@desen/starter-catalog-web`
capability package. T01 installed and proved this baseline; later component families remain
unimplemented. M10A-T01 authenticated the exact package integrity, license, peer compatibility,
dependency audit, and committed lockfile. A material incompatibility requires an explicit ADR amendment,
not silently switching libraries or widening DESEN semantics.

Reasons for selecting Base UI:

- Its unstyled React components let DESEN own a complete, changeable visual language.
- Its component parts, interaction states, keyboard support and focus management suit controlled
  adapters; DOM events, callbacks, render functions and selectors stay inside reviewed code.
- Its React 19 peer range matches the repository. CSS Modules and token-backed CSS variables fit
  the existing Web styling boundary without introducing a second styling framework.
- Its overlay/selection controls exercise the difficult adapter seams early, not after a large
  library has been implemented.

React Aria was considered for its accessibility and internationalization-oriented collection and
date controls. Those strengths do not require a second overlapping primitive library for the
initial screen set. A pre-styled library such as shadcn/ui was considered, but DESEN must own its
public styling contract and default appearance in either case; it is not added as another layer.
Base UI does not supply every layout/content component. Simple semantic HTML-backed capabilities
and compositions are owned by DESEN, with the same Catalog and accessibility obligations.

Decision sources, checked 2026-09-10:

- [Base UI quick start](https://base-ui.com/react/overview/quick-start)
- [Base UI styling](https://base-ui.com/react/handbook/styling)
- [Base UI accessibility responsibilities](https://base-ui.com/react/overview/accessibility)
- [Base UI 1.8.0 release](https://base-ui.com/react/overview/releases)
- [React Aria](https://react-aria.adobe.com/)

## Default appearance and customization

Ship **DESEN Neutral**: white/off-white surfaces, near-black text and primary actions, quiet gray
borders, restrained shadows, clear typography, consistent spacing and modest radii. Semantic
success/warning/error colors communicate meaning; color is never their only signal. The intended
look is polished and calm, not a placeholder wireframe. Light and dark modes share semantic tokens.
No remote font, analytics or asset fetch is required to open a blank local project.

Neutral is a preset, not a styling restriction. Designers may create named themes, new token
values, aliases, literal overrides, component variants and reusable compositions. The design
inspector must expose the following supported Web profile without raw JSON in ordinary use:

| Customization area | Required coverage                                                                                                                      | Owner         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Layout             | Stack/Grid, flow, alignment, distribution, gap, padding, margins, fill/hug/fixed sizes, min/max and overflow                           | T05, T11, T12 |
| Responsive design  | Editable viewport frames and breakpoints, ordered responsive overrides, portrait/landscape checks                                      | T10, T12, T26 |
| Appearance         | Arbitrary valid colors, alpha, solid/gradient fills, borders, per-corner radii, shadows, opacity, supported transforms and positioning | T02, T05, T12 |
| Typography         | Font family/weight/size, line height, letter spacing, alignment, decoration and text styles                                            | T02, T12, T13 |
| Content            | Text, approved images/icons/fonts, cropping/fit and accessible labels                                                                  | T05, T13      |
| Components         | Named parts/slots, nested composition, master/instance editing, overrides, reset/detach and variants                                   | T15, T16      |
| States             | Base, hover, focus, disabled, selected, loading, error and other declared states; design-time forced previews                          | T06–T09, T16  |

The long-term benchmark is Figma-like freedom for interface customization. G10A proves the table
above on declared Web capabilities, not all Figma features or arbitrary vector illustration.
Freeform vector drawing, arbitrary private DOM/CSS inspection, executable markup and unknown
component implementation are outside frozen DESEN 0.1.0. An unsupported control must explain its
boundary; it must not silently ignore a designer's edit or reduce all choices to preset enums.
Structural changes are compositions/conditional nodes, not illegal child-changing Source variants.

## Starter library admission

Every listed capability needs declared props, slots, style parts, states, events, defaults,
accessible names, safe authoring scenarios and the same real adapter in canvas and host. Palette
insertion supplies required child slots atomically; no ordinary item ends at "Needs template".

| Owner | Required family                                                                               |
| ----- | --------------------------------------------------------------------------------------------- |
| T05   | Box, Stack, Grid, Text/Heading, Image, Icon, Separator                                        |
| T06   | Button, TextField, TextArea, Checkbox, RadioGroup, Switch; field label/help/error composition |
| T07   | Select, Combobox, Tabs, Slider, NumberField                                                   |
| T08   | Dialog, Popover, Tooltip, Menu, Accordion                                                     |
| T09   | Card, Badge, Avatar, Alert, List, basic Table, Skeleton, Progress                             |

A basic Table is not an enterprise data grid. Date pickers, rich-text/vector editors, charts and
advanced grids are future Catalog additions. Map and Sortable retain their M11 owners. Component
coverage is acceptance-driven, not a promise to wrap every upstream component. Existing M10
reference profiles remain available for regression and are not silently migrated or overwritten.
Existing-company component mapping is an advanced integration route, never first-use onboarding.

## Four work areas, one managed design

1. **Design:** pages, content, layout, style, themes, components and visual states. Defaults and
   explicit sample presentation allow design without operations or production credentials.
2. **Connections:** typed state, data presentation, events, actions, navigation, resources and
   operations. Incomplete intentions are durable inert drafts, not invalid executable Source.
3. **Run:** static preview, synthetic scenarios and explicitly selected live integration have
   separate readiness and authority. Missing live bindings do not disable design or fixture tests.
4. **Design System:** foundations, component documentation, variants/scenarios, usage, versions
   and visual review. It uses the actual Catalog/Source/adapters rather than a duplicate story tree.

Publish is an explicit release action, not a fifth editing mode. Save, apply connection, approve
visual baseline, create design-system release and activate a host are distinct operations.
An unconnected static Source can be valid and publishable. Incomplete intended interactions are
shown as such; there is no fake successful backend, undisclosed fixture data or inferred endpoint.
The frontend role can wire an existing design sequentially in the same local project. This does
not require a new profession, multiplayer editing, or unimplemented role-based access control.

## Ownership and persistence

[ADR 0023](../adr/0023-design-first-authoring-and-design-system-workbench.md) owns the architecture.
The application project document stores canonical DESEN Source plus separately versioned design
system and inert authoring records. Atomic generation checks protect edits, imports, component
updates, history and persistence. Source remains independently exportable and can be previewed or
published with its exact Catalogs and authenticated design-system release. Production executes the
derived Bundle, not the editable Source or project record.

The completed T02 slice establishes platform-neutral `@desen/design-system-core` with finite v1
project admission and deterministic DTCG token resolution. It retains canonical Source plus inert
token, recipe, asset, and connection metadata without granting persistence, materialization,
release, App, Publisher, or Runtime authority. Later tasks own those capabilities. Web adapters may
eventually project admitted data into styles, but React, DOM, CSS, arbitrary code, private selectors,
endpoint/credential selection, and remote package loading stay outside this package. Runtime Core
and the frozen protocol remain byte-identical. The [T02 proof](../proof/M10A-T02.md) owns the finite
profile, rejection matrix, and hosted closure receipts.

## Design-system workbench and visual review

The [workbench contract](DESIGN-SYSTEM-WORKBENCH.md) defines the supported replacement for
Storybook/Chromatic workflows on DESEN-managed Web content: live catalog, documentation, controls,
scenarios, theme/viewport matrices, interaction/accessibility checks, visual diff and explicit
baseline review. Designers do not maintain another screen or story implementation to obtain these.
The implementation uses the existing Playwright foundation and a pinned pixel-diff engine; no
Storybook or Chromatic service dependency is required for these workflows. Arbitrary framework
stories, SaaS hosting, team identity and external CI integrations are not claimed as already covered.

## Acceptance gate

G10A requires fresh automated artifacts and visible ordinary-product journeys, not screenshots
alone and not another external user recruitment round:

- A settings form, a list/detail workspace and a dashboard are authored from blank projects using
  different component families, custom themes and desktop/mobile layouts, without behavior wiring.
- Create a named component with two variants and multiple instances; update the master, preserve
  instance overrides, detach one instance, undo/redo and reopen without drift or lost bindings.
- Save/reopen two themes, change typography/assets, preview every declared component state, and
  inspect usages/deprecation from the built-in design-system area.
- A frontend workflow adds declared data/actions later; the same design runs with fixtures and a
  real bounded local integration, then activates in the independent host without screen-code edits.
- A visual change produces a stable diff; an unreviewed or stale baseline cannot authorize a
  reviewed release. A structural/accessibility failure cannot be hidden by screenshot acceptance.
- Corrupt bundles, missing token/assets, incompatible Catalogs, stale project writes and restart
  failures preserve the complete last-known-good design and design-system release.
- Existing M10 browser/proof coverage remains fresh and passing; Runtime Core and upstream identity
  checks pass. All new claims name their browser, viewport, fixture and resource-limit scope.

## Active task candidate

**M10A-T03 — Theme and token authoring** is `IN_PROGRESS`. The local candidate adds platform-neutral
`@desen/design-system-authoring` and an isolated workbench: structured theme, mode, token, and
whole-alias controls; exact sRGB and px/rem handling; atomic history/import; and validated,
loss-aware transfer against T02's declared DTCG profile. It supports editable DESEN Neutral
light/dark themes and arbitrary valid custom values without a forced palette or raw JSON for
ordinary edits. Frozen SC-01 covers 16 valid fixtures: three T02-supported normal edit/preview paths
and 13 losslessly preserved/disclosed unsupported paths with partial preview blocked only for their
selected overlay; seven invalid fixtures reject atomically. A separate closed T02-recognized
unsupported matrix preserves/discloses six valid fixtures and atomically rejects six malformed
fixtures. Unreviewed or invalid forms fail closed without silent loss.

T03 evidence must cover live preview, undoable edits, and deterministic export/reimport round trips.
An invalid import must never overwrite working data. T03 remains open until exact-head hosted
checks pass and does not authorize T04 or later tasks, immutable releases, normal App integration,
persistence, recipe or asset execution, starter-library expansion, Publisher or Runtime authority,
Core/protocol changes, or M11. T04 is dependency-ready but remains `NOT_STARTED` and unselected
while T03 is active.

Every task uses the [task contracts](M10A-TASK-CONTRACTS.md), the CI-02 baseline, focused positive
and negative tests, a fresh exact-head hosted Quality gate, and task-owned evidence before DONE.
G10A additionally requires exhaustive closure. Planning completion is not implementation completion.
