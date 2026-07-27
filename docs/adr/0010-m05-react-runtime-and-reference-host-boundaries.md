# ADR 0010: M05 React runtime and independent reference-host boundaries

- Status: Accepted
- Date: 2026-07-27
- Owners: M05-T01–M05-T09, G05

## Context

G04 produces an authenticated, framework-neutral headless session whose observable snapshot
contains an immutable JSON render plan, stable runtime identities, current state and lifecycle
namespaces, and callback-free binding summaries. M05 must turn that plan into real React
instances, deliver resolved values only after their receiving Catalog schemas accept them, connect
trusted events and commands, and run the sign-in surface in an independently built host.

This integration creates several authority risks:

- a Bundle capability id could accidentally become a JavaScript module or export selector;
- TypeScript adapter props could become a second contract beside the exact Catalog schemas;
- React command handles could bypass the authenticated headless-session lifetime;
- style implementation could expose private DOM selectors or component structure;
- the reference host could recreate the sign-in tree manually while appearing bundle-driven; and
- adding executable React adapters to the reference package changes the logical package bytes
  proven at M03.

The frozen upstream sign-in Bundle also requires the illustrative complete
`com.example.web-catalog@1.0.0` tuple. The real M03 reference package deliberately implements only
the sign-in slice under `run.desen.reference.sign-in@0.1.0`. Executing the frozen Bundle against
that different implementation tuple would contradict the exact-package boundary recorded by
PF-029.

## Decision

### Static trusted React registry

`runtime-react` owns a factory-authenticated registry that maps exact capability ids to statically
imported, host-trusted React adapter definitions. Registry construction occurs only in trusted
application or capability-package code. A Source, Bundle, Catalog, render plan, host response, or
URL cannot provide:

- a module specifier;
- an export name;
- a dynamic import target;
- a component function;
- a registry mutation; or
- a fallback implementation.

The standalone renderer reads the capability id from a structurally captured public headless plan
and performs an exact lookup in the already constructed registry. It authenticates registry
authority but does not independently claim which session produced an otherwise valid plan.
Missing, duplicated, incompatible, or stale registrations fail explicitly. Production rendering
never guesses a generic component and never loads executable code selected by document data.

The G05 production path must obtain that plan from the exact current factory-authenticated
headless session. M05-T04 binds events and command attachments to that session's exact runtime
instance and generation; M05-T09 proves by resolved import/source audit that the independent host
does not replace the session output with a handwritten structural plan.

### Exact receiving-schema authority

The Catalog remains the sole runtime authority for component props, behavior props, style parts,
style properties, visual states, events, and commands. TypeScript adapter types improve trusted
implementation ergonomics but do not validate untrusted runtime values and do not become an
independent contract.

`runtime-react` therefore gains an explicitly reviewed dependency on `validator`. The architecture
allowlist and documentation must be updated with that edge. Receiving-boundary validation is
provided through public validator APIs backed by the exact authenticated Catalog schemas; the
React package does not copy schemas or introduce an adapter-local schema language.

Before an adapter is invoked:

1. the renderer selects the exact component or behavior contract for the plan capability;
2. the complete resolved prop object is validated against its Catalog schema;
3. every resolved style value is validated against the exact declared style-part property schema;
4. omitted unresolved optional props remain omitted only when the receiving schema permits it;
   and
5. any invalid required value or closed-schema mismatch fails before the adapter observes a
   partial prop or style object.

This boundary supplies the remaining production evidence for N-026 and N-029. Validation outcomes
retain stable source-node identity and JSON Pointer provenance without exposing private adapter
state.

### Authenticated command attachment

M05-T04 may add a narrow attach/detach seam to the headless-session composition root so a mounted
React instance can supply its trusted command port to the exact current component binding. The
seam must:

- authenticate the session, current snapshot, runtime instance, and binding generation;
- accept only commands declared by that binding's exact Catalog component;
- return an opaque, owner-bound attachment ticket;
- make detach idempotent and reject foreign, reconstructed, stale, or superseded tickets;
- detach before or during React unmount without leaving a callable lower registration; and
- preserve the existing command input validation, reentry fence, diagnostics, and disposal order.

The attachment callback never enters a render plan, session snapshot, DESEN document, Catalog, or
proof trace. React does not receive the lower M04 adapter-bridge authority or command registry.
Events continue to enter through the authenticated session event API and carry only detached,
schema-validated inert payloads.

### Semantic style-part boundary

React adapters expose semantic style-part contracts, not DOM structure. A style adapter may map a
declared part and visual state to trusted target-specific styling inputs, but the public boundary
contains no:

- CSS selector;
- class-name lookup contract;
- DOM node or ref;
- query API;
- implementation-library option; or
- assumption about a component's private element hierarchy.

The component implementation remains free to refactor its DOM as long as the declared semantic
part behavior remains equivalent. Production visual-state activation is capability-owned. An
authoring tool may later force only declared states under its separately disclosed preview
contract.

### Shared reference React adapters and M03 compatibility migration

`@desen/reference-catalog-web` publishes one explicit `./react-adapters` subpath. That subpath
statically imports the five real reference component implementations and returns their exact
trusted `runtime-react` registrations. Both the independent reference host and, later, Desen App
consume this same public factory. Neither application owns a parallel Stack/Text/TextField/Button/
Alert registry or imports those component exports to compose a managed screen.

Adding this subpath changes the complete `dist/**` inventory covered by the M03 logical package
digest. The M03 artifacts and their exact tuple remain immutable historical evidence; they are not
rewritten to pretend the executable registry existed at G03. M05 creates a successor current
logical capability artifact after the adapter subpath is complete, records its new exact digest,
and explicitly transfers current package-verifier ownership while pinning the M03 artifact as a
prerequisite.

The old digest is never used to identify the new bytes. The current `catalog.json`, M05 proof
receipt, and controlled host fixture must agree on the successor exact
`{ id, version, target, packageDigest }` tuple. This migration changes implementation-artifact
identity, not the frozen DESEN protocol or the existing component contracts.

### Controlled official-derived sign-in fixture

M05 uses a committed, deterministic proof fixture derived from the frozen official sign-in Source
and Bundle. Its managed `surfaces` value must remain canonically identical to the frozen example,
including node hierarchy, slot order, state, bindings, actions, conditions, and navigation.

Only the package requirement is migrated from the illustrative complete Web Catalog to the exact
current reference sign-in tuple. The fixture's Source digest and Bundle revision are then
recalculated with the existing DESEN 0.1.0 projection functions. Independent evidence must verify:

- canonical equality of the managed surfaces to the frozen official example;
- cumulative Source, Bundle, and Catalog validation;
- exact agreement with the current reference-package tuple;
- absence of top-level authoring state from the Bundle; and
- deterministic fixture bytes, Source digest, and Bundle revision.

This is an `official-derived` M05 integration fixture, not a claim that the M06 Publisher produced
it and not a replacement for the frozen upstream example. Production host source does not import
authoring fixtures or use synthetic operation results. T08 supplies a controlled trusted sign-in
handler through the host-operation boundary and exercises pending, declared failure, retry, stale
replacement protection, success, and navigation through real adapters.

### Independent host and source audit

`apps/reference-host-web` is an independent application build and may wrap the managed root only
with honest platform infrastructure such as bootstrapping, token provision, navigation policy,
error containment, and accessibility infrastructure. It cannot import Desen App, editor,
publisher, testkit, or authoring-only production code.

M05-T09 implements a TypeScript AST and resolved-import-graph audit over the reference host's
complete production entry graph. The audit is fail-closed and verifies at least that:

- no reference capability component is directly imported or instantiated by host source;
- the managed root is supplied only to the generic runtime renderer;
- no host object or JSX tree recreates plan-shaped node hierarchy, slot order, capability ids, or
  source-node identities;
- no `import()`, `require`, `eval`, `Function`, or equivalent path turns document data into code
  selection;
- no host-to-Desen-App, editor, publisher, testkit, or authoring-fixture edge exists; and
- the production build graph reaches the shared `./react-adapters` factory and the generic runtime
  through their public package exports.

Dependency-cruiser rules separately reject host-to-application and forbidden production-package
edges. Mutation fixtures must prove that direct JSX, aliased imports, `createElement`, helper-module
trees, dynamic loading, Desen App imports, and testkit/authoring imports are each detected.
Substring searches or a fixed list of current filenames are not sufficient evidence.

The M05-T09 artifact pins the T07 host-build/port evidence and the T08 real sign-in execution
evidence. It is the final G05 closure artifact; no separate uncounted gate proof is introduced.

### Native-runtime direction

The headless plan and observable runtime semantics remain framework-neutral. `runtime-react`,
`runtime-web`, React adapter definitions, CSS, DOM integration, and browser host behavior remain
outside `runtime-core`.

A future SwiftUI or Compose implementation will define its own statically trusted registry,
target-specific Catalog, receiving-boundary adapter contracts, and conformance evidence while
reusing the protocol-observable headless vectors. It will not import React registrations or assume
Web DOM structure. Cross-platform pixel identity is not required.

## Alternatives considered

### Let the Bundle select a module or export

Rejected. It turns inert document data into an executable loader configuration, weakens package
pinning, and makes deterministic security review dependent on runtime module resolution.

### Validate only with TypeScript component props

Rejected. TypeScript is erased at runtime and the hand-maintained prop type would become a second,
potentially divergent schema. Exact Catalog schemas must validate every untrusted receiving value.

### Put receiving-schema validation back into `runtime-core`

Rejected. The headless core correctly materializes platform-neutral JSON and preserves candidate
provenance. Concrete receiving contracts and adapter delivery belong together at the target
renderer boundary. Reusing public validator primitives avoids both schema duplication and React
leakage into the core.

### Expose command registries or adapter-bridge handles to React

Rejected. Lower authority would let stale component instances register or invoke commands outside
the exact current session generation. A narrow session-authenticated attachment ticket provides
the required lifetime without widening the public authority surface.

### Address style parts with selectors or DOM refs

Rejected. Private implementation structure would become designer-addressable and refactors could
silently change protocol behavior. Semantic adapter contracts preserve capability ownership.

### Build the reference registry inside each application

Rejected. Separate host and Desen App copies could drift while both appeared to implement the same
Catalog. A public capability-package adapter factory gives both applications one reviewed static
registration source.

### Rewrite the M03 artifact to include the new adapter files

Rejected. Retroactive rewriting would invalidate historical proof and obscure when executable
registration became real. M05 records a successor artifact and an explicit compatibility
migration.

### Run the frozen Bundle against the narrow M03 implementation tuple

Rejected. The frozen Bundle requires a different illustrative Catalog id, version, and digest.
Ignoring that mismatch would make the G05 demonstration visually convincing but nonconforming.

### Handwrite the sign-in screen in the reference host

Rejected. It would prove only that the reference components work in React, not that a Bundle owns
managed composition. Automated source and import mutation tests protect this boundary.

### Put React registry concepts into the platform-neutral core

Rejected. It would make future native renderers depend on React types and lifecycle assumptions,
contradicting the Web-first, platform-neutral architecture.

## Consequences

### Positive

- Executable selection remains static, reviewed, and host-owned.
- Resolved props and styles cross their exact Catalog schemas before reaching React.
- Event and command lifetimes remain tied to authenticated runtime instances.
- Reference host and Desen App can reuse one public adapter factory.
- M03 historical evidence remains auditable while M05 truthfully records changed package bytes.
- The G05 sign-in proof uses the real package tuple without mutating the frozen upstream example.
- AST, import-graph, dependency, build, and runtime evidence jointly protect the no-handwritten-tree
  claim.
- Future native renderers retain an independent target boundary.

### Costs

- `runtime-react` gains a reviewed `validator` dependency and the architecture allowlist must
  change.
- The validator needs narrow public receiving-schema APIs rather than target packages reaching
  into validation internals.
- Command attachment adds one carefully bounded API seam and lifecycle test matrix.
- Adding `./react-adapters` requires a new capability-artifact digest and compatibility-verifier
  migration.
- The reference-host application adds its own independent build, package tests, proof entry, and
  CI inventory updates.
- The AST audit must evolve when legitimate host infrastructure changes, with every allowlist
  change reviewed and mutation-tested.

## Non-claims

This decision does not claim:

- that M05 implements the M06 deterministic Publisher;
- that the controlled official-derived fixture is Publisher output;
- channel fetching, exact package installation, atomic activation, persistence, restart recovery,
  or last-known-good behavior assigned to M07;
- a real authentication backend, credential store, production authorization policy, or external
  service;
- arbitrary runtime installation or remote loading of capability packages;
- Desen App authoring, preview, publishing, or host-parity completion assigned to M08–M10;
- complete browser E2E evidence assigned to G10;
- npm archive reproducibility, package signatures, public release, or supply-chain provenance;
- a native runtime implementation;
- pixel-identical Web, iOS, Android, SwiftUI, or Compose output; or
- any change to the frozen DESEN 0.1.0 Source, Bundle, Catalog, or protocol semantics.

## Review triggers

Reopen this ADR if a public dynamic capability loader is proposed, receiving validation moves away
from the exact Catalog, a command lifetime cannot be represented by the authenticated attachment
seam, semantic style parts require private structure, the shared adapter subpath cannot remain
application-independent, or a native target demonstrates that the headless plan omits a required
protocol-observable distinction.
