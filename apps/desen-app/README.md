# Desen App

The visual authoring and publishing product intended for `desen.app`. Desen App is one product
built on DESEN; the protocol and App-independent developer ecosystem live separately on the
DESEN Developer Platform at `desen.run`.

## Status

M09-T11 adds transient Catalog scenarios, exact synthetic operation fixtures, and visible adapter
fidelity disclosure while keeping scenario, fixture, mode, event, state, binding, selection, and
every other authoring control in the application-owned shell outside the exact React adapter
canvas.
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
- stable, enlarged, non-overlapping slot boundaries plus the upper and lower half of each visible
  layer row as before/after targets, retaining the last valid row projection through drop without
  moving the tree while a drag is active;
- one sticky Components placement target that resolves to the selected compatible slot or a safe
  root default, with visible drag grips, click guidance, and an explicit Layers target-change action;
- App-owned inert drag intent plus native keyboard and click placement controls for component
  insertion, cross-slot move, and same-slot reorder;
- a visible selection-bound Delete control plus guarded Delete/Backspace shortcuts outside editable
  controls; both explain root and effective-minimum restrictions, automatically target a newly
  inserted component, clear a successfully deleted selection, and return focus to Layers;
- a third State view that projects the exact current surface-local declarations, bounded usage
  counts, and controlled String, Boolean, Number, and Integer initial values;
- stable add, atomic type-and-initial update, and unused-state deletion controls that preserve used
  declarations without cascading into references or actions;
- an explicit no-substitution state for Recovery and Profile, which have no exact Source tree in
  the official fixture;
- a sign-in canvas mounted from the official-derived Bundle through the same public
  `REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT` used by the reference host;
- exact runtime document, revision, surface, Catalog-set, registry, and snapshot authority checks
  before the managed tree becomes visible;
- one accessible App-owned Design/Run control over the same immutable Source, Publisher Bundle,
  Runtime session, and managed Runtime React subtree;
- a native disabled fieldset in Design that keeps the real heading and labels accessible while
  preventing the preview from dispatching input or action events;
- a Run presentation that hides App-owned authoring and selection chrome, centrally rejects stale
  authoring callbacks, and enables only the exact real adapter interactions;
- exact Email adapter event → Runtime React → Runtime Core → `state.set` → same-subtree rerender
  behavior without changing Source or Bundle revision or remounting Runtime authority;
- Catalog-declared props-only scenarios prepared as separate transient Source/Bundle previews,
  with the authored Source and publishable preview unchanged;
- one explicitly synthetic fixture controller exposing only exact success and declared
  `invalidCredentials` settlement after a real Runtime pending lifecycle;
- visible but unavailable Integration and Production contexts that cannot start a real service;
- synchronous cleanup and preview-replacement revocation, with operation input and password data
  never read, logged, or retained;
- persistent `same`, `equivalent`, `approximate`, or `undeclared` adapter-fidelity disclosure that
  lists every known approximate difference;
- deny-only navigation, operation, and resource ports plus missing, conflicting, or inert storage,
  token, diagnostics, clock, context, and environment boundaries;
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
- Inspector value-source controls that construct only exact direct `state.<name>` references for
  primitive declarations whose type is provably compatible with the selected Catalog control;
- explicit change-binding and use-state-initial transitions, while operation bindings, fallbacks,
  tokens, formats, nested paths, and other advanced dynamic values remain visible and read-only;
- a fourth Events & Actions view that projects only the exact selected Source component and its
  Catalog-declared events, with absent, present-empty, and present-nonempty handlers kept distinct;
- handler add/delete plus ordered root and recursive `operation.invoke` success/failure action
  lists with insert, edit, delete, and move controls;
- all seven closed action types captured through inert whole-action JSON drafts that stay local
  until explicit Apply, with `$ref` values preserved as data;
- public Editor Core property set/delete commands and all six event/action mutations followed by
  complete continuous Catalog validation, with no partial Source returned for stale identity,
  invalid value, or failed validation;
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
`RuntimeReactSurfaceBoundary`. Design and Run share that exact session and managed subtree because
mode is excluded from mount identity. Recovery, Profile, and every other tuple report that no exact
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

Named-slot authoring reauthorizes the exact current route, Source identity, Catalog-declared slot,
component capability, and edit before every operation. Slot acceptance and effective minimum and
maximum cardinality are checked before public Editor Core insert, move, reorder, or delete
commands run. Declared-but-absent slots stay distinct from present empty slots; root deletion,
owning-slot minimum violations, stale identities, invalid cycles, and incompatible placements fail
closed. Each complete candidate must pass continuous validation and Publisher preflight before one
atomic session-local `{document, preview}` commit. A failed mutation or publication preserves the
prior Source, preview, selection, and focus.

The browser drag payload is an inert hint and is never read as authority. Enlarged stable slot
boundaries and the upper or lower half of each visible row expose the nearest before/after placement
without overlap or drag-time layout movement. The last valid admitted row projection survives the
drop event when browser coordinates are absent, while exact placement semantics still come from the
App-owned drag intent and current validated model. The Components target remains visible while its
list scrolls, resolves to a safe root target until the user chooses another compatible slot, and
provides an explicit target-change action. Successful insertion immediately selects the new node so
the visible Delete control and guarded Delete/Backspace shortcuts are available; shortcuts ignore
editable controls. Components whose insertion would require inventing a private required child
subtree remain unavailable. These affordances do not claim arbitrary canvas geometry, hit testing,
or native-browser drag E2E, and they do not change named-slot, cardinality, or validator authority.

Local-state projection re-admits the exact current Source and Catalog, authenticates the current
surface route, and scans at most 100,000 inert values to count direct state references plus
`state.set` and `state.toggle` targets. Declaration edits accept only directly addressable names
matching `^[A-Za-z][A-Za-z0-9_-]{0,127}$`. Existing richer or non-addressable protocol-valid
declarations stay visible but cannot be rewritten by the primitive controls. Type changes stage
the schema and initial commands on a private candidate, then continuously validate only the
complete endpoint so no incompatible intermediate Source becomes observable.

Property binding is a separate boundary from the structured-JSON prop editor. It reauthorizes the
route, selection, node, control, current value, and local declaration before constructing one exact
`{ $ref: "state.<name>" }` ValueSpec through the public owner-prop command. Primitive compatibility
is conservative: String and Boolean must match exactly, Integer may feed Number, Number never
feeds Integer, and enum binding requires a proven subset. Detaching a direct binding restores the
declaration's validated primitive initial value. Runtime namespaces and advanced ValueSpecs remain
read-only rather than being silently simplified.

Event/action projection reauthorizes the exact current route, Source component identity, and
Catalog capability before exposing only that component's declared events. Behavior-owner UI is
outside this slice, and forged behavior selections fail closed. Absent, present-empty, and
present-nonempty handlers remain distinct. Exact canonical escaped owner-relative pointers address
handler insert/delete and action insert/replace/delete/reorder through the six public Editor Core
mutations.

The action editor accepts only the closed `component.command`, `event.emit`, `navigate`,
`operation.invoke`, `resource.refresh`, `state.set`, and `state.toggle` union. Operation success and
failure lists remain recursively addressable. Whole-action JSON is parsed as inert data, preserves
valid `$ref` members, and remains a local draft until explicit Apply. Every complete candidate must
pass continuous Source validation and Publisher preflight before one atomic session-local
`{document, preview}` replacement; failure preserves the prior document, event projection, canvas,
selection overlay, and managed capability subtree.

Design/Run is one App-owned closed mode over that same immutable session-local
`{document, preview}`. Switching modes does not rewrite Source, regenerate the Bundle, remount the
Runtime session, or replace the managed Runtime React subtree. Runtime local state, Source
selection, the active authoring tab and component search, and unapplied Inspector drafts remain in
place; the App clears only transient drag intent. A new surface route starts in Design.

Design disables managed controls and admits selection and authoring. Run hides the authoring
panels and selection overlay, retains their local drafts, and checks the current mode again inside
all seven authoring callback paths before any edit or Publisher preflight. The real Email adapter
event then crosses public Runtime React and Runtime Core, executes the Source's closed `state.set`
action, updates Runtime-local state, and rerenders the same managed subtree. Navigation,
operations, and resources remain denied; storage and token access remains missing, conflicting, or
inert. Run adds no executable host binding.

Scenario selection is admitted only for the exact current route, selected node, capability, Source
revision, and preview revision. A selected Catalog scenario produces a props-only overlay in a
separate transient preview; scenario state or fixture overrides fail closed. Synthetic fixture
execution binds one controller to that effective preview identity. Cleanup synchronously closes
request admission and revokes pending work, StrictMode may reactivate only the same still-live
controller, and preview replacement prevents a predecessor from publishing late settlement.

This slice does not expose component rectangles, hit testing, canvas picking, private DOM/native
structure, or managed-tree inspection. It does not edit repeat/resource bindings or behavior-owned
event handlers; persist project data; create user projects; navigate diagnostics; publish to the
control plane; or activate a channel. Durable save/open belongs to M09-T12, diagnostics to M09-T13,
and publication or activation to M09-T14. Catalog control hints remain opaque under PF-025 and
cannot widen schema authority. P-09 and P-10 are only `PARTIAL`; P-08 remains `NOT_PROVEN`, N-035
and S-001 are `TESTED`, N-036 remains `PLANNED`, PF-028 is `CLOSED`, PF-025, PF-083, and PF-089
remain `OPEN`, and no automated real-browser E2E or native-drag automation result is claimed.

The App imports only public package entry points for Catalog derivation, Editor Core mutation and
validation, Publisher preflight, runtime composition, and the exact static reference adapter
registry. It does not import concrete Catalog components, private package files, editor internals,
or control-plane code. Bundle data never selects a module, component, fallback tree, or executable
host binding.

The focused event/action suite passes 84/84, the complete App suite passes 202/202, and the
independent root proof passes 10/10. Exact evidence is the `23,812`-byte
`docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json` at
`sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`. The live local CI
authority contains 190 workloads and 90 proof pairs—79 ordinary and 11 barriers—with a
57-proof-unit/124-workload closure and 1,212 tracked/180 proof-owned paths. Sequence 48 contains 44
artifacts and 88 readers at
`sha256:5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90`. These measured receipts
make no required-gate, hosted-CI, action-execution, Design/Run, persistence, real-browser E2E,
publication, activation, or native-drag automation claim. M09-T09 is `DONE`, implementation
progress is 104/145 (72%), M09 is 9/14 (64%), proof gates remain 10/13, and M09-T10 is next.

The M09-T10 adapter and application suites pass 9/9 and 35/35, the focused Design/Run suite passes
44/44, the complete App suite passes 210/210, and the independent root proof passes 10/10. Exact
evidence is the `17,900`-byte
`docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json` at
`sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`. The live local CI
authority contains 192 workloads and 91 proof pairs—80 ordinary and 11 barriers—with a
58-proof-unit/126-workload closure and 1,218 tracked/182 proof-owned paths. Sequence 49 contains
45 artifacts and 90 readers at
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e`. The checkpoint,
promotion, and complete serial structural suites pass 72/72, 19/19, and 339/339.

Manual browser QA exercised the Design/Run switch and Run interaction plus the automatic default
placement target, visible Delete action, editable-control Backspace guard, and successful Delete
shortcut. It is not automated real-browser or native-drag E2E evidence. M09-T10 is `DONE`,
implementation progress is 105/145 (72%), M09 is 10/14 (71%), and proof gates remain 10/13. P-09
is only `PARTIAL`; P-08 remains `NOT_PROVEN`; S-001 remains `PLANNED`; PF-025, PF-028, and PF-083
remain `OPEN`; and M09-T11 is next.

The M09-T11 focused fixtures/scenarios/fidelity suite passes 86/86, the complete App suite passes
252/252, and the independent root proof passes 11/11. Exact evidence is the `29,407`-byte
`docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json` at
`sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`. It authenticates the
exact M09-T10, M03-T08, and M03-T09 parents and binds 28 tracked files. These local task receipts
make no required-gate, hosted-CI, durable-persistence, diagnostic-navigation,
publication/activation, real-browser E2E, or native-drag claim. M09-T11 is `DONE`, implementation
progress is 106/145 (73%), M09 is 11/14 (79%), proof gates remain 10/13, and M09-T12 is next.

The live local CI authority contains 194 workloads and 92 proof pairs—81 ordinary and 11 barriers—
with a 59-proof-unit/128-workload closure and ownership over 1,232 tracked paths, including 184
proof-owned paths. Those inventory receipts likewise make no hosted-CI claim.

Append-only proof-reader sequence 50 advances
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 artifacts and
92 readers. Checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI regression suites pass 73/73, 19/19, 56/56, 15/15, and 127/127 locally.

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
pnpm --filter @desen/app-web test:named-slots
pnpm --filter @desen/app-web test:state-bindings
pnpm --filter @desen/app-web test:event-actions
pnpm --filter @desen/app-web test:design-run
pnpm --filter @desen/app-web test:fixtures-scenarios
pnpm --filter @desen/app-web test:shell
pnpm --filter @desen/app-web build
```

Task evidence is generated and verified separately. A command appearing here is not a recorded
pass result.
