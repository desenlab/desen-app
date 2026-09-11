# Architecture

Last reviewed: 2026-09-11

## Purpose

DESEN separates human-authored design data from host-owned executable code. The reference
implementation proves one bounded `web-react` lifecycle: author a Source, validate and publish an
immutable Bundle, activate it transactionally, then execute it in a separately built host through
registered capabilities.

This document is the living system map. Detailed task-time decisions live in
[ADRs](../adr/), ambiguities in
[Protocol Findings](../plan/PROTOCOL-FINDINGS.md), and executable claims in the
[Proof Matrix](../proof/PROOF-MATRIX.md).

## System authorities

Four authorities remain separate:

1. The frozen protocol defines valid data and observable semantics.
2. Capability packages define trusted component, behavior, operation, and resource contracts.
3. Desen App owns editable Source for managed surfaces.
4. A host owns executable adapters, integrations, authorization, and activation policy.

```mermaid
flowchart LR
  C["Capability packages"] --> A["Desen App"]
  A --> S["DESEN Source"]
  S --> P{"Publisher"}
  P -->|"valid"| B["Immutable Bundle store"]
  P -->|"invalid"| D["Node-linked diagnostics"]
  B --> CH["Mutable channel pointer"]
  CH --> H["Independent host"]
  C --> H
  H --> LKG["Last-known-good revision"]
```

No DESEN document selects an endpoint, credential, callback, package loader, executable module, or
arbitrary code. These remain host or application configuration.

## Dependency direction

Cross-package imports are deny-by-default. `dependency-cruiser.config.cjs` is the executable
authority for this table.

| Package                 | Allowed internal dependencies                                                          |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `protocol`              | none                                                                                   |
| `validator`             | `protocol`                                                                             |
| `publisher`             | `protocol`, `validator`                                                                |
| `catalog-sdk`           | `protocol`                                                                             |
| `runtime-core`          | `protocol`, `validator`                                                                |
| `runtime-react`         | `protocol`, `validator`, `runtime-core`                                                |
| `runtime-web`           | `protocol`, `validator`, `runtime-core`                                                |
| `editor-core`           | `protocol`, `validator`                                                                |
| `editor-web`            | `protocol`, `validator`, `catalog-sdk`, `editor-core`, `runtime-core`, `runtime-react` |
| `reference-catalog-web` | `protocol`, `catalog-sdk`, `runtime-react`                                             |
| `starter-catalog-web`   | `protocol`, `catalog-sdk`, `runtime-react`                                             |
| `testkit`               | implementation package public APIs, except the `desen` facade                          |
| `desen`                 | protocol, validation, publication, runtime, catalog, and dedicated test APIs           |

Packages never import applications. Production packages never import `testkit`. Applications are
composition roots with explicit allowlists:

- the reference host cannot import Desen App, editor, publisher, `testkit`, or the broad facade;
- the control plane cannot import renderer or editor packages; and
- Desen App may compose public package APIs but cannot become a hidden protocol/runtime owner.

A new dependency edge requires architecture review, a matching documentation change, and a
negative boundary fixture.

## Data lifecycle

### Authoring

`editor-core` edits the admitted `desen.source` graph directly through immutable deterministic
commands. Stable IDs live in Source; selection, viewport, drafts, and other editor-only state live
under root `authoring`. The production digest excludes exactly root `authoring`, while unknown
extensions remain inert Source data.

`editor-web` supplies platform transport and UI integration. Desen App owns routing, panels,
selection overlay, Design/Run mode, fixture controls, persistence composition, diagnostics, and the
visible publish action. Managed component rendering still passes through the same public Runtime
React and capability adapters used by the independent host.

### Validation and publication

The validator has separate structural and semantic stages. It returns stable diagnostics and
dynamic obligations; it never repairs unknown semantics silently.

The publisher:

1. captures finite Source bytes;
2. parses and structurally admits one Source;
3. resolves exact Catalog/package requirements;
4. validates static capability and execution contracts;
5. removes root `authoring` from the production projection;
6. canonicalizes the result deterministically; and
7. emits a complete immutable Bundle or no Bundle at all.

Failure returns diagnostics without partial publication authority. Source preservation is exact at
the parsed-value boundary; lexical whitespace and member ordering are not an authoring guarantee.

### Storage and activation

The control plane keeps three data classes distinct:

- editable Source bytes under compare-and-set generations;
- immutable Bundle bytes addressed by revision; and
- mutable channel pointers used only for discovery.

A channel is not activation authority. Activation independently verifies stored bytes, exact
packages, references, execution contracts, and finite limits before any durable state changes.

```text
fetch channel
  -> fetch immutable Bundle bytes
  -> verify protocol, revision, and Source corroboration
  -> resolve exact capability packages
  -> preflight references, execution contracts, and limits
  -> stage immutable runtime indexes
  -> atomically commit {active revision, previous-good revision, generation}
  -> expose the committed active snapshot in memory
```

The durable record and previous-good pointer are one transaction. Failure before commit leaves the
old record untouched. An uncertain outcome grants no new in-memory authority and requires recovery.
A crash after commit rebuilds the exact committed revision from the immutable store. Recovery never
guesses, silently repairs, or automatically promotes the previous-good revision.

### Runtime execution

`runtime-core` receives an authenticated Bundle, exact Catalog set, and explicit host ports. It
produces JSON-serializable state, diagnostics, and render plans. It owns resolution, predicates,
state, repeats, resources, operations, actions, limits, reactive publication, and stale-result
containment without importing React, DOM, CSS, browser, filesystem, or application code.

`runtime-react` translates a fully authenticated plan through a static adapter registry. It does
not inspect private component structure or invent unknown components. Adapter interaction authority
is commit-scoped and revoked by replacement, navigation, unmount, or disposal.

`runtime-web` provides browser-shaped ports and local recovery storage. The separately built host
fixes its Catalog, adapters, host bindings, channel, and integration policy outside DESEN data.

## Platform-neutral host ports

Core behavior enters through explicit interfaces for:

- operations and resources;
- navigation;
- tokens, context, and environment values;
- storage and active-revision persistence;
- clock and scheduling;
- diagnostics; and
- target adapter lookup.

No Core API accepts `ReactNode`, DOM events, selectors, class names, arbitrary HTML, or executable
functions inside a DESEN document.

## Application responsibilities

### Desen App

The visual authoring and publishing product. It owns application navigation, project bootstrap,
workspace layout, editor state, local integration choice, and user-visible lifecycle. Generic
Source editing, validation, publication, runtime, persistence, and managed rendering remain package
responsibilities.

### Reference Host Web

The independent proof host. Its browser bundle has no editor, publisher, testkit, control-plane, or
Desen App dependency. A separate application-owned server may consume the fixed local channel and
compose public verification/activation APIs, but the browser can request only a same-origin refresh
and cannot select authority inputs.

### Control Plane API

The bounded local Source, Bundle, channel, and activation service. It is not a remotely exposed
multi-tenant platform and provides no production authorization or package discovery claim.

### DESEN Developer Platform

The future `desen.run` documentation and integration surface. It is not a second visual authoring
product. External deployment and package publication remain blocked until G12 and explicit user
approval.

## Security and failure invariants

- Frozen protocol bytes are immutable.
- All untrusted inputs are finite and fail closed.
- Catalog identities and package digests are exact; there is no newest/best-match rule.
- Unknown capabilities never select placeholders.
- Publication is all-or-nothing.
- Staging is not activation.
- Failed activation preserves the last-known-good revision.
- Diagnostics are data and redact raw internal failures, credentials, and response bodies.
- Managed UI comes only from host-approved capability adapters.

These are engineering properties of the declared reference profile, not a production security
certification.

## M10 proven profile

G10 joins the complete Source → Publisher → control plane → independent-host path. Nine independent
Chromium journeys prove authoring, persistence, fixtures, success/failure/pending behavior,
publication, an unchanged-host update, invalid-candidate rejection, process-restart recovery, and
repeatable demo reset. The independent host source graph contains no handwritten managed-screen
tree. See [the terminal proof](../proof/DESEN-APP-M10-GATE.md).

The complete committed `packages/runtime-core` tree is frozen as
`3fa3613a3be63c749f40b6a0b55af5b40c675773`. This is an identity baseline for M11, not cached test
success.

## M10A design-first workbench

M10A inserts 28 tasks and the G10A gate before M11. T01's bounded starter adapter slice and T02's
platform-neutral project/token foundation are `DONE`; the other 26 tasks remain `NOT_STARTED`.
T03 is selected next and its dependency is complete, but no implementation task is active. Later
workbench features remain planned; no publication or production authority follows from this text.
[ADR 0023](../adr/0023-design-first-authoring-and-design-system-workbench.md) owns the decision,
while the [implementation plan](../plan/M10A-IMPLEMENTATION-PLAN.md),
[task contracts](../plan/M10A-TASK-CONTRACTS.md), and
[Workbench contract](../plan/DESIGN-SYSTEM-WORKBENCH.md) own execution detail.

The package boundary is additive. T01 delivers the starter package and its dependency direction;
T02 adds `@desen/design-system-core`, while normal App composition remains later work:

- `@desen/starter-catalog-web` supplies target-specific DESEN capabilities through trusted,
  statically registered production and authoring adapters built on pinned Base UI and the DESEN
  Neutral theme;
- `@desen/design-system-core` admits the App-owned v1 envelope, canonical Source, inert token,
  recipe, asset, and connection metadata, and a bounded deterministic DTCG resolver. It imports only
  `protocol` and `editor-core`; it cannot import React, DOM, CSS, Base UI, browser APIs, App code, or
  host bindings, and owns no persistence, release, materialization, Publisher, or Runtime authority;
- `@desen/starter-catalog-web` follows the existing target-package edges to `protocol`,
  `catalog-sdk`, and `runtime-react`, plus its pinned external Base UI dependency; and
- Desen App will compose those packages with existing Editor, Validator, Publisher, and Runtime
  public APIs. Neither new package becomes a hidden Runtime Core or protocol owner. Publisher and
  Runtime packages do not depend on `design-system-core` or interpret its recipe graph.

T03 may now begin the theme/token editor, mode and alias authoring, loss-aware import/export,
preview, undo, and round-trip proof against T02's finite profile. T03 remains `NOT_STARTED`; it does
not authorize T04 or later work, normal App integration, persistence, design-system releases,
Publisher or Runtime changes, or M11.

Across later M10A tasks, an App-owned versioned editable-project record becomes the durable
authoring aggregate. It atomically
stores one exact canonical Source, editable DTCG data, immutable design-system release references,
the bounded master/instance/override graph, and inert connection and Workbench drafts under
generation compare-and-set. It is not a DESEN protocol document. Every open verifies the complete
record and every save advances one complete generation; partial or inconsistent state exposes no
authority, and the exact preceding generation remains recoverable without guessing or repair.

Canonical Source remains the production composition and behavior authority. A master or instance
is local App metadata that must materialize, with stable ordinary node ids and exact Catalog `use`
values, into the same valid canonical Source before persistence or Publisher preflight. There is no
runtime `instanceOf`, import, symbol, or Publisher-side recipe expansion. Incomplete Connections
forms persist only as inert project drafts until one complete declared binding can be applied
atomically.

Token drafts are also non-production. A production-affecting DTCG document becomes an immutable,
content-addressed design-system release. The project binds the canonical Source fingerprint and
production Source digest to that release, and the application publication/activation receipt binds
Source digest, Bundle revision, exact capability packages, and token release without changing the
frozen Bundle schema. The host token provider is constructed from the authenticated release;
activation and last-known-good recovery treat Bundle and token release as one deployment tuple.
The trusted host profile selects that release and supplies only its validated finite value map
through the existing token-provider port; documents cannot select a loader, module, or destination.

The App separates Design, Connections, Run, and Design-System Workbench. Static Source with exact
components and a validated token snapshot may Run without live bindings; Publish additionally
requires an immutable design-system release. Synthetic Run requires declared fixtures; Integration requires explicit
non-production authorization; production activation additionally requires exact host bindings and
deployment preflight. An empty Connections panel is not an error when Source references no external
effect, while incomplete binding drafts never weaken Source, Publisher, or Runtime validation.

For DESEN-managed Web content, the Workbench owns bounded component-workshop needs: capability
inventory, declared states and scenarios, token/theme and instance matrices, accessibility review,
deterministic screenshots, and visual regression. It does not run arbitrary story code, inspect
private DOM, host unrelated application components, or claim a public review service. Styling may
be broad only through declared props, style parts, states, tokens, and frozen Source variants;
unsupported control is explicit and cannot fall back to arbitrary CSS or selectors.

The existing M10 catalog, workspace profiles, fixtures, artifacts, host path, and browser journeys
remain regression authorities. M10A may add packages, profiles, App services, and host bindings but
must preserve the frozen Runtime Core baseline above. G10A proves project recovery, token-release
rollback, recipe materialization, disconnected static publication, adapter trust, and the complete
M10 regression set before either M11 branch may begin.

## M11 extension contract

After the recorded SC-02 adaptation and G10A closure, Map and Sortable may add target capability
packages, adapters, resource/operation bindings, fixtures, and authored surfaces. They must not
modify Runtime Core. Each branch independently proves its capability boundary before both join in
the second surface. See the [task board](../plan/TASKS.md).

## Future native targets

DESEN 0.1.0 currently proves exactly `web-react`. A future native implementation adds a
target-specific Catalog and renderer while reusing protocol-observable trace vectors and the
platform-neutral packages. Pixel-identical Web/iOS/Android output is not promised.

## Historical detail

The full task-by-task M01–M10 architecture narrative remains in Git history and the linked
ADR/proof records. The immutable archive pointer is owned by the
[documentation standard](../standards/DOCUMENTATION-STANDARDS.md#document-lifecycle-and-ownership).
