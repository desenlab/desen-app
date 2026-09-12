# ADR 0023: Design-first authoring and design-system workbench

- Status: Accepted; M10A-T01 through M10A-T05 `DONE`, M10A-T06 dependency-ready `NOT_STARTED`
- Date: 2026-09-10
- Decision owner: user-authorized M10A planning / SC-02 adaptation, closed by G10A

## Context

M10 proves one bounded Web–React design-to-runtime path, but its reference catalog, fixed tokens,
single-document persistence, and mixed Inspector/Actions workflow are not yet a broad product
authoring foundation. M11 would add Map and Sortable capabilities before designers have a coherent
component library, design-language workflow, reusable compositions, or a separate place to finish
connections.

The product direction is design first: a designer must be able to compose and style a complete
static experience before a frontend engineer supplies application behavior. That freedom cannot
weaken DESEN 0.1.0. Source and Bundle remain data-only, capability surfaces remain explicit,
authoring adapters remain honest, and unknown runtime semantics still fail closed.

This decision creates the M10A prerequisite milestone and its G10A gate. M10A-T01 through M10A-T05
are `DONE`; the other 23 tasks remain `NOT_STARTED`. T05's exact-head and fresh-`main` closure is
task-owned; acceptance is not a release or production-readiness claim. The canonical sequence is in
[M10A Implementation Plan](../plan/M10A-IMPLEMENTATION-PLAN.md), with detailed acceptance contracts
in [M10A Task Contracts](../plan/M10A-TASK-CONTRACTS.md) and product behavior in the
[Design-System Workbench](../plan/DESIGN-SYSTEM-WORKBENCH.md).

## Decision

### Add a target-specific starter capability family

M10A uses `@desen/starter-catalog-web` rather than expanding or replacing the M10 reference
catalog. M10A-T01 establishes its bounded initial foundation on pinned `@base-ui/react@1.8.0` with
an authored **DESEN Neutral** design language. That completed slice contains Button, Select, and
Dialog only. “Starter” names the intended broad, ready default for the declared `web-react` target;
T01 does not claim that full library, create a lowest-common-denominator protocol widget set, or
promise identical components on other targets.

Base UI is trusted package implementation code. A Source may select only a DESEN capability id,
never a Base UI module, callback, DOM selector, class name, or arbitrary prop. Each admitted
primitive must have finite Catalog-declared props, slots, events, commands, style parts, visual
states, schemas, scenarios, and immutable package identity. The starter package's production and
authoring adapters use the same implementation. Any later exception needs an explicit fidelity
declaration and cannot inherit the exact-preview claim.
Native event objects, refs, internal state, and unreviewed prop spreading do not cross the adapter
boundary.

Reusable design-system data that is independent of React belongs in
`@desen/design-system-core`, not in `editor-core` or `runtime-core`. The completed T02 slice admits a
finite App-owned v1 project envelope, canonical Source, inert authoring metadata, and the bounded
DTCG profile. Later tasks may add recipe-graph, stable-identity, materialization, and release contracts.
The package remains platform-neutral and cannot import Base UI, React, DOM, CSS, browser APIs, the
App, or executable host bindings; its current internal dependencies are `protocol` and `editor-core`.
Desen App remains the composition root. `@desen/starter-catalog-web` follows the existing
target-package direction to `protocol`, `catalog-sdk`, and `runtime-react`, plus the pinned external
Base UI dependency. Publisher and Runtime packages do not depend on `design-system-core` and gain no
recipe semantics.

The completed T03 adds platform-neutral `@desen/design-system-authoring` plus an isolated browser
workbench. It exposes structured theme, mode, token, and whole-alias controls with exact sRGB and
px/rem handling, atomic history/import, and bounded loss-aware transfer. The frozen SC-01 inventory's
16 valid fixtures split into three T02-supported normal edit/preview paths and 13 losslessly
preserved, disclosed unsupported paths that block partial preview only for their selected overlay;
seven invalid fixtures reject atomically. A separate closed T02-recognized unsupported matrix
preserves/discloses six valid fixtures and atomically rejects ten malformed fixtures. Unreviewed or
invalid forms fail closed without silent loss. T03 does not enter the normal App or add persistence,
release, materialization, Publisher, Runtime, or protocol authority.

The completed T04 adds platform-neutral `@desen/design-system-release`: finite content-addressed
token, asset, and inert-recipe snapshots; exact host-profile release references; and an atomic
exact-digest store port with no mutable `latest` lookup. It grants no Runtime activation, normal App
integration, durable production storage, Publisher authority, or protocol change.

### Make the durable editable project the authoring aggregate

M10A workspaces use a versioned, App-owned `EditableProjectRecord`; it is not a new DESEN protocol
document. One finite record aggregates:

- the exact admitted canonical Source;
- the editable DTCG token document and references to immutable design-system releases;
- the bounded master, instance, override, and stable-node-id recipe graph; and
- inert connection drafts, workbench state, annotations, and other non-production metadata.

The record contains JSON data only. Connection drafts may name intended capabilities and contract
shapes, but not credentials, callbacks, executable modules, or authority to choose a live endpoint.
Host bindings remain trusted application configuration.

Save uses generation compare-and-set over one complete project snapshot. Referenced immutable
objects must be durably present and digest-verified before the project generation advances. Open
re-admits every member, verifies every digest and reference, and proves that managed recipe regions
materialize to the stored Source exactly. A mismatch, partial write, stale generation, or corrupt
member exposes no mixed project. The exact preceding complete generation remains recoverable;
recovery never guesses, merges, or silently repairs data.

The project record is the durable editable-workspace authority. Within it, canonical Source is
still the sole authority for DESEN production composition and behavior. Recipe and draft metadata
cannot acquire runtime meaning merely because it is durable.

### Release, bind, and recover design tokens explicitly

Designers edit a DTCG-compatible draft and may create aliases, semantic roles, themes, and modes.
Production never reads that mutable draft. Releasing a design system validates finite token data,
canonicalizes it, calculates a content digest, and stores an immutable
`DesignSystemReleaseSnapshot`. A released digest is never rebound to different bytes.

Source continues to contain only protocol `$token` references. The project manifest binds the exact
canonical Source fingerprint and production Source digest to one design-system release digest.
Publication records the Source digest, Bundle revision, exact capability-package tuples, and
design-system release digest without adding a field to the frozen Bundle schema. The host constructs
its token provider from that authenticated release and activates the Bundle revision and token
release as one application-owned deployment tuple. Last-known-good rollback restores the same
tuple, so changing a mutable theme cannot alter the appearance of an older active revision.

The trusted host profile selects the exact release and projects its already validated finite token
map through the existing token-provider port. Source and Bundle values cannot select a release
loader, module, filesystem location, or network destination, and Runtime does not interpret the
project or recipe graph.

Every production-affecting token value must therefore exist in the immutable release available to
the host. It must not exist only in root `authoring`, a recipe graph, a preview stylesheet, or local
workbench state. Missing tokens, type mismatches, release mismatches, and unavailable historical
snapshots fail before activation and preserve the previous good tuple.

### Treat masters, instances, and variants as authoring conveniences

A local component master is a bounded recipe made from existing Catalog capabilities. An instance
stores authoring identity, an explicit override set, and a persistent mapping to ordinary Source
node ids. It never introduces a new Source `use` value or a live `instanceOf`, import, symbol, or
macro understood by Publisher or Runtime.

Creating, updating, detaching, or deleting a master or instance is one App project transaction.
The materializer expands every affected recipe into ordinary DESEN 0.1.0 nodes, slots, props,
styles, conditions, and ordered variants in that same transaction. Conceptually unchanged nodes
retain their ids; new nodes receive deterministic collision-safe ids. Overrides are finite and may
address only exposed capability contracts. Cycles, stale masters, invalid overrides, unresolved
capabilities, and limit overflow reject the whole transaction.

The resulting complete Source must pass structural and continuous semantic validation and be the
same canonical Source persisted by the project and handed to Publisher. Publisher never expands a
recipe or rewrites an instance. Detach removes the authoring relationship without changing the
already materialized Source. A reusable abstraction that needs runtime-private behavior must
instead become a real versioned Capability Package.

Node conditional variants and Catalog-declared component variants remain the executable model.
App presets may make them easier to author, but cannot change ordered-variant semantics. Structural
alternatives materialize as conditional nodes rather than children hidden inside a variant.

### Separate Design, Connections, Run, and Workbench

The product exposes four explicit spaces:

- **Design** composes valid capabilities and edits declared props, slots, style parts, states,
  variants, responsive conditions, tokens, and reusable recipes.
- **Connections** turns inert intent into declared events, actions, operations, resources, and host
  binding requirements. Incomplete forms save as project draft data and do not enter Source.
- **Run** offers Static, Synthetic, and explicitly authorized Integration contexts without exposing
  authoring controls or silently selecting a live service.
- **Design-System Workbench** manages token drafts/releases, capability inventory, public states,
  scenarios, recipe masters, instance matrices, and bounded visual review.

Managed Run always uses the last admitted canonical Source. A visual or connection draft may render
in clearly labeled Design chrome, but it cannot replace the managed Runtime subtree until its
complete materialized candidate passes validation and Publisher preflight.

Readiness is capability-based rather than one global “connected” flag:

| State               | Required authority                                                                         | Permitted outcome                                    |
| ------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Saved design draft  | Valid project record; incomplete intent remains inert                                      | Save, reopen, edit, and Design preview               |
| Static Source ready | Valid Source, exact components and validated token snapshot; immutable release for Publish | Static Run and Publish even with no Connections      |
| Synthetic ready     | All referenced contracts validate and declared fixtures exist                              | Fixture-backed Run; no live host claim               |
| Bundle ready        | Publisher accepts the exact stored Source and package set                                  | Store immutable Bundle; no activation claim          |
| Live-host ready     | Exact adapters, token release, host bindings, authorization, and preflight                 | Explicit Integration or atomic production activation |

An event with no handler needs no connection. A surface with no external actions, resources, or
operations must not be blocked merely because the Connections panel is empty. Conversely, a
partially authored binding is never smuggled into Source or ignored by Runtime. Declared
application-supplied bindings may produce a valid Bundle, but the target host cannot activate it
until its own readiness preflight resolves them.

### Provide rich styling only through public contracts

The Workbench should feel as direct and expressive as modern visual design tools, with token-aware
color, typography, spacing, sizing, layout, border, elevation, responsive, state, and component
variant controls wherever the capability contract exposes them. This is not permission for
arbitrary CSS, selectors, DOM inspection, private component parts, or executable expressions.

When a requested visual control cannot be represented by a declared prop, style part, visual
state, ValueSpec, or existing condition/variant rule, the App names the unsupported boundary. The
gap is recorded in Protocol Findings when it is a frozen-protocol ambiguity or limit; otherwise the
capability evolves through an explicit versioned contract. The App never silently injects CSS or
claims unsupported “unlimited” styling.

### Bound the component workshop claim

For DESEN-managed Web capabilities, the Workbench replaces the bounded needs that would otherwise
drive Storybook/Chromatic adoption: inventory, declared scenarios and states, token and theme
matrices, recipe/instance review, accessibility checks, deterministic screenshots, and visual
regression evidence. It does not execute arbitrary JavaScript story files, inspect private DOM,
host non-DESEN application components, provide a public review SaaS, or replace general library
unit, interaction, browser, and accessibility tests.

The initial workflow is local-first and sequential across design-system author, designer, and
frontend integration responsibilities. M10A does not introduce accounts, organization roles,
multiplayer editing, remote review, or SaaS authorization.

### Preserve M10 and the frozen runtime

The starter catalog, design-system core, project schema, Workbench, and new workspace profiles are
additive. The M10 reference catalog, profiles, fixtures, routes, immutable artifacts, and browser
journeys remain regression authorities. No M10 artifact is relabeled as M10A evidence.

M10A must not modify the frozen `packages/runtime-core` tree or the DESEN 0.1.0 upstream snapshot.
Neither design-system metadata nor Base UI becomes a Runtime Core dependency. Every task checks its
declared affected surface; G10A re-runs the complete M10 proof set and authenticates the unchanged
Runtime Core identity before M11 can start.

## Verification and consequences

G10A requires evidence for exact project save/open/CAS/recovery, immutable token releases and
deployment-tuple rollback, stable master/instance updates and detach, override and cycle rejection,
byte-identical materialization before publication, safe persistence of incomplete connections,
and successful static save/Run/Publish with no live bindings.

Adapter verification covers Catalog completeness, authoring fidelity, schema filtering, keyboard
and focus behavior, SSR/hydration, StrictMode replacement, accessibility, and rejection of refs,
native event leakage, arbitrary prop spreading, dynamic imports, callbacks, selectors, and private
Base UI internals. Visual matrices are evidence only when their exact Source, Catalog packages,
token release, viewport, scenario, and renderer identity are recorded.

M10 regressions, dependency boundaries, protocol snapshot checks, and the Runtime Core tree
comparison remain mandatory. A failed M10A candidate preserves the prior complete editable project,
published Bundle, active deployment tuple, and last-known-good host. M11 stays blocked until all 28
M10A tasks and G10A are complete with current evidence.
