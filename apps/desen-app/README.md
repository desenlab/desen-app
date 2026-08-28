# Desen App

The visual authoring and publishing product intended for `desen.app`. Desen App is one product
built on DESEN; the protocol and App-independent developer ecosystem live separately on the
DESEN Developer Platform at `desen.run`.

## Status

M09-T06 extends the selected Source component's schema-derived Inspector with recursive
closed-object controls and an honest structured-JSON fallback while keeping every authoring
control in the application-owned shell outside the exact React adapter canvas.
The current product surface contains:

- a full-viewport `/projects` gallery over two fixed inert project fixtures;
- a project-level surface gallery and a centered, inert surface frame that preserve the route
  hierarchy without claiming editor behavior;
- exact project and surface routes at `/projects/:projectId` and
  `/projects/:projectId/surfaces/:surfaceId`;
- same-origin History API transitions, browser back/forward observation, and canonical replacement
  of the bare `/` entry with `/projects`;
- fixture-only project search with an explicit empty result and recovery action;
- a compact authoring panel whose Layers view preserves the official sign-in Source node, named
  slot, child order, conditional marker, and attached-behavior structure;
- a Components view derived from the exact `@desen/reference-catalog-web/catalog.json` component
  inventory, display names, categories, descriptions, identity, version, and target;
- local component filtering that changes only the visible list and never mutates Catalog or Source
  data;
- an explicit no-substitution state for Recovery and Profile, which have no exact Source tree in
  the official fixture;
- a sign-in canvas mounted from the official-derived Bundle through the same public
  `REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT` used by the reference host;
- exact runtime document, revision, surface, Catalog-set, registry, and snapshot authority checks
  before the managed tree becomes visible;
- a native disabled fieldset that keeps the real heading and labels accessible while preventing
  this Design preview from dispatching input or action events;
- route-local Source-node selection admitted only from the validated authoring model and projected
  through the public callback-free Runtime React diagnostic index;
- native layer buttons with pressed state, Select/Deselect names, conditional context, wrapped
  keyboard navigation, and immediate live selection status;
- a compact pointer-inert selection card that is a DOM sibling outside the disabled managed
  capability fieldset and exposes no component geometry or private capability structure;
- one App-owned Inspector whose labels, descriptions, requiredness, primitive types, enum options,
  and current value states come from the exact validated Catalog schema and selected Source node;
- native string, boolean, number, integer, and exact primitive-enum controls;
- recursive closed-object fieldsets with qualified names, canonical child order, and exact RFC
  6901 value pointers;
- an explicit structured-JSON fallback for arrays, open objects, unions, references, combinators,
  unsupported schemas, and derivation-limit results, with visible reasons and explicit Apply,
  Reset, and eligible Unset actions;
- Publisher-profile strict JSON capture, deterministic formatting, dynamic `$` locks, bounded
  changed-only root transitions, and focus handoff when an edit changes control kind;
- public Editor Core set/delete commands followed by continuous Catalog validation, with no
  partial Source returned for stale identity, invalid value, or failed validation;
- Publisher preflight for every accepted edit and one atomic session-local `{document, preview}`
  replacement, so a failed publication keeps both the prior Source and prior working preview;
- explicit not-found states for unknown routes, projects, and surfaces; and
- semantic landmarks, a skip link, visible keyboard focus, route-heading focus, reduced-motion
  support, and responsive layouts.

Route identifiers are bounded lowercase kebab-case segments. App-owned transitions reject unknown,
cross-origin, credential-bearing, query-bearing, and fragment-bearing destinations instead of
guessing aliases or silently choosing a nearby project or surface. This route helper is internal to
the application; it is not a DESEN protocol rule or a public package contract.

Two Figma sources have distinct roles. The M09 UX wireframe (`2:7` Projects Home and `2:92` Design
Mode) informs information hierarchy, wording, task boundaries, and the future editor proportions.
The earlier Desen product exploration (`533:4004` App Start, `501:2829` Projects in Workspace,
`498:2594` Page List, and `488:2567` Page Canvas Editor) defines the visual language: a `#fafafa`
working plane, floating corner tools, a compact centered context path, and quiet white objects with
thin borders. Neither file is proof authority, runtime data, or a source of executable application
behavior.

## Deliberate boundary

The authoring read model first prepares the exact Catalog with
`validateDesenInteractionCatalogSet`, then validates the official-derived Source against that exact
prepared set with `validateDesenSourceInteractionContracts`. It projects UI data only from the two
detached, recursively immutable success values. Validation or bounded-projection failure exposes no
partial panel or tree. Component and behavior identity occurrences are bounded to 25,000 per
surface and Source depth to 64; own empty slots remain distinct from absent optional slots.

The canvas mounts only for the exact `account-app:sign-in` route tuple. It creates a public
`runtime-core` headless session with explicit inert/denying host ports, preflights that session
through `runtime-react`, and renders it through `useRuntimeReactSurface` plus
`RuntimeReactSurfaceBoundary`. Recovery, Profile, and every other tuple report that no exact
adapter preview is available; they never borrow the sign-in Bundle or retain its managed tree.
StrictMode replay, route replacement, and unmount dispose the exact session they created.

Selection stores only exact project, surface, Source-node, capability, display, and conditional
primitives. The current route and validated authoring model must admit that identity before the App
consults the public diagnostic index. Repeated component instances remain distinct, attached
behavior runtime identities are excluded, and only a selected conditional Source node may report
an honest non-materialized state. Unknown, stale, cross-route, and forged same-route selections
fail closed. Route replacement resets the route-owned selection synchronously.

Inspector derivation uses the public Catalog SDK over the exact validator-admitted component
manifest. An edit command is reduced to an exact own enumerable data snapshot before authority is
checked; proxy-backed inputs are read through captured own data without invoking property getters,
while accessor, extra-field, and symbol-bearing commands are rejected. Route, selection, node,
capability, control, requiredness, current value kind, and primitive type are re-derived from the
current immutable Source and Catalog before the public Editor Core command runs. The resulting
Source must pass the public continuous validator and a public Publisher preflight before the App
replaces the current document and preview together. An accepted revision replaces the Runtime
session and disposes its predecessor.

M09-T06 consumes the complete recursive control plan. Present closed-object groups retain canonical
child order and exact RFC 6901 value and schema pointers, including escaped property names. Nested
edits rebuild only the complete top-level owner prop. An absent optional group is staged as one
complete JSON object and set atomically. A root fallback diffs the complete props object, counts
only changed props, permits at most 256 public transitions and 32 MiB of aggregate snapshot work,
and applies deletions and shrinking replacements before growth. Every successful Editor Core
transition remains provisional until complete validation and Publisher preflight succeed.

Structured text is scanned against the Publisher Source JSON profile before `JSON.parse`.
Malformed or non-finite JSON, decoded duplicate members, unpaired Unicode, profile overflows, and
every decoded object key beginning with `$` fail closed without a partial value. Successful values
are detached and recursively frozen. Formatting sorts object keys while preserving array order;
when indentation alone would exceed the same profile, formatting stops accumulating pretty output
early and falls back to canonical compact JSON. Dynamic-containing groups stay locked as a whole,
while literal siblings retain their own edit authority.

This slice does not expose component rectangles, hit testing, canvas picking, private DOM/native
structure, slot-cardinality controls, drag, insert, move, or reorder. It does not edit local state,
bindings, events, or actions; persist project data; create user projects; execute interactive
Design/Run behavior; navigate diagnostics; publish to the control plane; or activate a channel.
Dynamic binding editing belongs to M09-T08, insertion/cardinality UI to M09-T07, and interactive
Design/Run behavior to M09-T10. Catalog control hints remain opaque under PF-025 and cannot widen
schema authority.

The App imports only public package entry points for Catalog derivation, Editor Core mutation and
validation, Publisher preflight, runtime composition, and the exact static reference adapter
registry. It does not import concrete Catalog components, private package files, editor internals,
or control-plane code. Bundle data never selects a module, component, fallback tree, or executable
host binding.

The focused structured-Inspector suite passes 73/73, the complete App suite passes 118/118, the
independent root proof passes 10/10, the complete structural CI glob passes 323/323, and App
typecheck, lint, and production build pass locally.
The exact 26,133-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json` at
`sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`. The live local CI
authority registers 184 workloads and 87 proof pairs—76 ordinary and 11 barriers—with a
54-proof-unit/118-workload connected closure and ownership over 1,184 tracked paths, including 174
proof-owned paths. Sequence 45 contains 41 artifacts and 82 readers. No required-gate or hosted-CI
pass is claimed.

## Local commands

```bash
pnpm --filter @desen/app-web dev
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:authoring
pnpm --filter @desen/app-web test:canvas
pnpm --filter @desen/app-web test:selection
pnpm --filter @desen/app-web test:inspector
pnpm --filter @desen/app-web test:structured-inspector
pnpm --filter @desen/app-web test:shell
pnpm --filter @desen/app-web build
```

Task evidence is generated and verified separately. A command appearing here is not a recorded
pass result.
