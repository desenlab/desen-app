# DESEN Design-System Workbench

Status: Planned for M10A; no implementation or release claim<br>
Owners: M10A-T03, M10A-T15–M10A-T18, M10A-T23–M10A-T28<br>
Last reviewed: 2026-09-10

## Outcome

Desen App will provide one local-first place to define, present, exercise, and visually verify the
design system used by DESEN-managed surfaces. The Workbench is intended to replace the component
exploration, scenario documentation, and visual-regression duties for those surfaces that a team
would otherwise place in Storybook and Chromatic. It does not claim feature parity with either
product or replace them for non-DESEN components, arbitrary frameworks, or organization-wide
cloud collaboration.

The Workbench has no second component or story authority. Its visible inventory, controls,
documentation, scenarios, usage results, and test matrix are derived from validator-admitted DESEN
Catalogs, Source documents, exact capability-package identities, and separately authenticated test
fixtures. A documentation card or screenshot can never register executable code.

The governing decision is [ADR 0023](../adr/0023-design-first-authoring-and-design-system-workbench.md).
This contract refines the phase entry in [M10A Implementation Plan](M10A-IMPLEMENTATION-PLAN.md)
and the exact task boundaries in [M10A Task Contracts](M10A-TASK-CONTRACTS.md).

## Product and authority boundaries

- Desen App owns the Workbench navigation, presentation, local authoring state, and review flow.
- Catalogs own component, behavior, prop, slot, event, command, semantic style-part, visual-state,
  authoring-control, deprecation, and replacement declarations.
- Target capability packages own trusted implementations and state activation. The Workbench uses
  the same statically installed adapter registry as managed runtime surfaces.
- The App-owned editable project owns master recipes, instance relationships, override metadata,
  token drafts, and Workbench drafts. Canonical Source alone owns their materialized production
  nodes, props, slots, variants, bindings, actions, and safe style values.
- Component owners define contracts and defaults; designers compose and style admitted instances;
  designers or frontend engineers may wire declared behavior; application owners install resource,
  operation, release, and production authority.
- No document, scenario, style value, or baseline selects a module, endpoint, credential, callback,
  browser executable, or comparator implementation.

## Base UI foundation

M10A selects `@base-ui/react@1.8.0` as the Web–React primitive foundation. Base UI is unstyled,
composable, and designed around accessible interaction patterns, so DESEN can own its visual
language without forking keyboard, focus, popup, and form behavior. The exact dependency and
transitive bytes are installed and pinned only by their owning implementation task; this plan does
not install them.

Base UI remains behind reviewed DESEN capability adapters. It does not enter the frozen protocol,
platform-neutral packages, Source or Catalog data, and it is not a dynamic registry. Its built-in
behavior does not by itself prove accessible output: labels, contrast, visible focus, state styling,
composition, and browser behavior still require DESEN-owned evidence.

## Neutral default and free styling

The built-in **Neutral** theme is a polished black, white, and neutral-gray starting point with
light and dark modes. It uses semantic roles for canvas, surface, elevated surface, foreground,
muted foreground, border, focus, disabled content, and status feedback; a restrained type scale;
a consistent spacing rhythm; and quiet radii, borders, and elevation. Status never relies on color
alone.

Initial Neutral recipe: light canvas `#fafafa`, surface `#ffffff`, text/action `#171717`, muted
text `#525252`, border `#e5e5e5`; dark canvas `#0a0a0a`, surface `#171717`, text/action `#fafafa`,
muted text `#a3a3a3`, border `#404040`. Use a 4/8/12/16/24/32/48 spacing scale, 4/8/12 radii,
14/16/20/24/32 type sizes, 1 px default borders and 2 px visible focus with separation from the
control. Primary controls invert foreground/surface, with status colors reserved for meaning.
These are editable preset values, not maximum ranges; T03/T26 must verify contrast and focus in
every state before accepting the theme. Dark mode is not an automatic CSS color inversion.

Neutral is a default, not a palette constraint. Every Catalog-approved semantic style part exposes
the safe typed properties relevant to that part. At minimum the component program must deliberately
cover:

- foreground, solid/gradient background, border, focus-ring, and state colors;
- font family, size, weight, line height, letter spacing, alignment, and decoration;
- padding, margin, gap, dimensions, minimum and maximum dimensions, and overflow policy;
- border width/style/radius, shadow/elevation, and opacity; and
- declared positioning, transforms, component geometry, and motion tokens where bounded safely.

An exposed color property accepts any validator-admitted color literal or token reference, not only
Neutral swatches. The same principle applies to other typed values. Freedom does not mean raw CSS:
unknown properties, selectors, pseudo-selectors, declarations, executable expressions, remote URLs,
and unreviewed asset or font references fail explicitly. Shared values should use host-owned tokens;
literal values remain available where the frozen protocol and exact style-part schema admit them.

Base plus every applicable declared visual state—such as hover, focus-visible, pressed, selected,
checked, open, disabled, loading, invalid, dragging, and drop target—must be previewable. A state is
shown only when its Catalog contract declares it. Forced authoring previews never impersonate
production state activation.

## Definitions, instances, variants, and lifecycle

A Workbench capability entry joins one exact Catalog contract, one exact target adapter, its Neutral
recipe, documentation, and deterministic scenario set. Separately, a reusable local master is a
bounded App-project recipe composed from such capabilities. Its instances materialize ordinary
Source nodes with exact capability identities instead of copying implementation or contract data.
Publisher and Runtime never resolve the master relationship.

Variant controls expose only combinations admitted by prop schemas, predicates, semantic parts,
and visual states. The Workbench must show default, non-default, boundary, empty, long-content,
disabled, pending, failure, success, and interaction states where applicable. Impossible or unsafe
cross-products are declared exclusions, not silently skipped tests.

Each installed library version retains its exact `{id, version, target, packageDigest}` identity.
Component pages show status, replacement, compatibility, and migration guidance. Deprecation never
silently rewrites Source. A local usage index derives references from admitted saved Source
revisions and reports exact project, surface, node, and version; it is not telemetry and does not
claim usage outside the inspected workspace.

## Explorer and scenario model

| Familiar duty      | Built-in DESEN behavior                                                                             | Authority                                             |
| ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Component explorer | Search and browse installed capabilities, variants, parts, states, and exact versions               | Catalog plus package tuple                            |
| Stories            | Named deterministic scenarios render isolated components or bounded compositions                    | Catalog authoring data plus test-owned Source/fixture |
| Controls           | Schema-derived prop, slot, state, token, and safe style editors with live preview                   | Exact Catalog schemas                                 |
| Docs               | Anatomy, guidance, contract tables, defaults, events, commands, accessibility, status, and examples | Catalog plus reviewed prose                           |
| Interaction tests  | Declared events/actions run through Synthetic fixtures and normal Runtime boundaries                | Source, Catalog, Runtime, fixture authority           |
| Usage/deprecation  | Local reverse references and explicit replacements                                                  | Saved Source set plus Catalog identity                |
| Visual tests       | Hermetic browser captures compare every required scenario and mode with an approved baseline        | Exact candidate and approval receipt                  |

Scenarios are data, not arbitrary setup scripts. Each scenario has a stable ID, purpose, exact
component or composition identity, initial Source fragment, fixture inputs, forced authoring state
when needed, viewport/theme mode, ordered interaction trace, expected diagnostics, and terminal
assertions. Component scenarios and composed-surface scenarios are distinct. M10A-T23 owns the
finite required matrix and proves that every declared variant/state is covered or has an explicit
reviewed exclusion.

## Hermetic visual evidence

M10A-T24 owns a local deterministic capture and diff engine based on pinned Playwright, Chromium,
and `pixelmatch`. It must not call Storybook, Chromatic, a remote browser, or a mutable CDN. Capture
runs with fixed viewport, device scale, color/contrast scheme, reduced-motion mode, locale,
timezone, clock, data, focus/hover state, and network policy. Animations, carets, randomized IDs,
and asynchronous layout must settle under explicit finite rules. Fonts and assets are admitted
local bytes before capture; missing, late, remote, or substituted resources fail the scenario.

Every candidate manifest binds at least:

- canonical Source and scenario digests;
- ordered Catalog fingerprints and exact capability-package tuples;
- immutable design-system release, theme/token bytes, and adapter/application build identity;
- every font and visual asset path plus byte digest;
- Playwright, browser executable, platform image, and comparator versions;
- viewport, device scale, media, locale, timezone, clock, and capture policy; and
- the versioned `pixelmatch` options, image dimensions, and diff policy.

The comparator accepts only equal-dimension images and one reviewed configuration. Any reported
changed pixel is a visual change; tolerance configuration may suppress known rendering noise but
cannot permit an unreviewed changed-pixel budget. A configuration change creates a different
candidate identity and invalidates inherited approval.

M10A-T25 owns baseline review. A missing baseline, identity mismatch, capture failure, new scenario,
changed or removed scenario, or non-zero diff is `REVIEW_REQUIRED` or failure—never automatic
success. Acceptance requires an explicit human action over one exact candidate manifest and stores
a content-addressed baseline plus an immutable receipt binding prior authority, candidate identity,
declared local reviewer label, decision, and time. That label is audit data, not authenticated RBAC
identity. Tests, generators, merge position, file replacement, and a generic update command cannot
auto-accept. Rejection changes no baseline.

A required readiness check reruns fresh for the exact candidate head. Any later Source, Catalog,
theme, font, asset, adapter, scenario, browser, capture, or comparator change invalidates the result.
An unavailable runner or unverifiable receipt fails closed. Approval records review intent; they do
not replace fresh rendering, diffing, interaction, accessibility, or product tests.

## Interaction, accessibility, responsive, and performance coverage

- Interaction checks use visible controls and declared event/action/command paths; no scenario can
  call private adapters or mutate Runtime state directly.
- Keyboard traversal, focus entry/return, accessible name and description, roles, error association,
  disabled semantics, and pointer/keyboard equivalence are checked per applicable component state.
- Automated accessibility analysis is regression evidence, not a WCAG certification. Custom style
  changes recheck contrast, focus visibility, target visibility, zoom/reflow, and forced colors.
- A finite responsive matrix binds named viewport dimensions to each applicable scenario. Cropping,
  overflow, reflow, and zoom failures remain visible rather than being masked from screenshots.
- Performance uses fixed hardware/runtime classes, fixtures, warm-up, sample count, and budgets.
  Measurements never justify skipping functional, accessibility, or visual checks.

M10A-T26 owns these matrices and budgets; M10A-T27 proves the complete designer-visible workflow
from definition and styling through scenarios, evidence, explicit approval, reuse, publication, and
independent managed rendering. M10A-T28 assembles the fresh task evidence and closure report;
G10A then evaluates the complete gate contract. This document alone closes nothing.

## Local-first and beta limits

The M10A Workbench foundation is local, single-user, and Web–React only. It may make DESEN-managed
component work independent of Storybook/Chromatic, but M10A alone is not a beta release. The first
beta additionally requires the later M11/G11 and M12/G12 evidence plus an explicit beta decision.
Hosted sharing, comments, organization membership, RBAC, reviewer assignment, SSO, remote asset
hosting, and cloud baseline retention require separate security, identity, storage, and product
decisions. This plan also does not claim arbitrary existing-library ingestion, Figma round-trip,
cross-framework rendering, native parity, production readiness, or replacement of an organization's
general UI test stack.

## Research basis

The following current primary sources define the comparison behaviors; they are references, not new
runtime dependencies:

- Base UI: [purpose and boundaries](https://base-ui.com/react/overview/about),
  [release history](https://base-ui.com/react/overview/releases),
  [styling hooks](https://base-ui.com/react/handbook/styling), and
  [accessibility responsibilities](https://base-ui.com/react/overview/accessibility)
- Storybook: [component-state explorer](https://storybook.js.org/docs/get-started/browse-stories),
  [Controls](https://storybook.js.org/docs/essentials/controls),
  [Docs](https://storybook.js.org/docs/writing-docs),
  [lifecycle tags](https://storybook.js.org/docs/writing-stories/tags),
  [interaction play functions](https://storybook.js.org/docs/writing-stories/play-function), and
  [UI testing](https://storybook.js.org/docs/writing-tests)
- Chromatic: [visual testing](https://www.chromatic.com/docs/visual),
  [branch baselines](https://www.chromatic.com/docs/branching-and-baselines),
  [viewports](https://www.chromatic.com/docs/viewports),
  [accessibility regression](https://www.chromatic.com/docs/accessibility), and
  [mandatory review checks](https://www.chromatic.com/docs/mandatory-pr-checks)
- Capture engine references: [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
  and the official [`pixelmatch` repository](https://github.com/mapbox/pixelmatch)
