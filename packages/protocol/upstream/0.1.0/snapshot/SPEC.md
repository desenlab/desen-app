---
title: "DESEN: Executable Design Protocol"
version: "0.1.0"
date: "2026-07-21"
status: "Working Draft"
editor: "Selman Ay"
license: "Apache-2.0"
---

# DESEN: Executable Design Protocol

> **Design is the source. The application executes the published design.**

## Abstract

DESEN defines an open, data-only protocol for designing and publishing production user interfaces without translating a static design into a second, developer-authored implementation.

A DESEN-compatible editor does not draw an imitation of an application. It authors a **Design Source Document** by composing real, registered application capabilities: components, behaviors, resources, and operations. A publisher validates that source and emits an immutable **Published Design Bundle**. A host application loads the bundle at runtime and realizes it through its own installed, version-pinned **Capability Packages**.

The protocol makes the published design authoritative for:

- surface composition and hierarchy;
- component configuration and exposed style parts;
- responsive and conditional variants;
- local interaction state;
- resource-to-property bindings;
- event-to-action orchestration;
- loading, success, empty, and failure experiences; and
- navigation between DESEN-managed surfaces.

The protocol does **not** place arbitrary executable code in design documents, implement third-party libraries, generate backend services, or transfer ownership of component internals and domain logic to designers. Developers create and maintain capabilities; designers compose and configure those capabilities into the product experience. This ownership boundary replaces implementation handoff with a shared executable contract.

DESEN 0.1.0 intentionally targets visual, component-based application surfaces first. Voice, spatial interfaces, telemetry, experimentation, deployment governance, collaboration, and general-purpose code generation are outside this core release.

---

## Contents

1. Status of This Document
2. Plain-Language Summary
3. Conventions and Normative Language
4. Scope
5. Design Principles
6. Architecture
7. Conformance Targets
8. Identifiers, Namespaces, and Versions
9. Authority and Ownership Model
10. Common Data Conventions
11. Digests and Canonicalization
12. Design Source Document
13. Published Design Bundle
14. Values and Bindings
15. Predicates
16. Surfaces
17. Component Nodes
18. Styles and Visual States
19. Behavior Capabilities
20. Actions
21. Capability Catalog
22. Operations and Resources
23. Authoring Runtime and Editor Semantics
24. Production Runtime Semantics
25. Publishing
26. Failure Semantics
27. Security Model
28. Performance and Scalability
29. Complex Capability Integration
30. Versioning and Compatibility
31. Media Types, Files, and Discovery
32. Reference Web–React Profile
33. Worked Example: Sign-In Surface
34. Open Questions for 0.2

Appendices: Protocol Invariants; Core Diagnostic Codes; Normative Schema Registry; Related Systems and Deliberate Boundaries.

---

## 1. Status of This Document

This document is a **Working Draft** of DESEN 0.1.0. It is suitable for prototypes, reference implementations, interoperability experiments, and public review. It is not yet a stable standard and must not be represented as one.

The goals of this draft are to:

1. establish a small and implementable executable-design core;
2. make the design document the authoritative source for managed surfaces;
3. prove that editors and production runtimes can share the same capability contracts;
4. support complex components and behaviors without embedding their implementation in the protocol; and
5. create a testable foundation that multiple open-source implementations can target.

Normative changes may occur before 1.0.0. Implementers are encouraged to publish feedback as reproducible examples, conformance vectors, schema issues, or implementation reports.

---

## 2. Plain-Language Summary

### 2.1 The problem

In a conventional workflow, a designer creates an interface representation and a frontend developer recreates that representation in application code. Even when inspection tools, generated snippets, or AI-assisted code reduce the work, two independently editable artifacts remain:

```text
Design artifact  →  interpretation and handoff  →  frontend implementation
```

The two artifacts can diverge. The implemented product, rather than the design, becomes the practical source of truth.

### 2.2 The DESEN model

DESEN replaces that translation boundary with a runtime contract:

```text
Capability Packages created by developers
                    ↓
DESEN Editor → Design Source Document
                    ↓ publish
          Published Design Bundle
                    ↓ load
     Application's DESEN Runtime
                    ↓
        Real production interface
```

The designer works with capabilities that already exist in the product environment. A `Button` on the canvas is not a rectangle that resembles a button; it is an authoring adapter for the registered production `Button` capability. A map is not flattened into an image; its capability exposes supported properties, slots, events, commands, style parts, visual states, and authoring scenarios. A sortable interaction is represented by a behavior capability backed by the application's chosen drag-and-drop implementation.

### 2.3 What “single source of truth” means

For a DESEN-managed surface:

- the Design Source Document is the editable authority;
- the Published Design Bundle is its immutable deployment form;
- generated source code, screenshots, previews, and inspection output are derived artifacts;
- a conforming host does not keep a separate, manually maintained copy of the same surface composition; and
- changes to the managed composition are made through a producer of conforming DESEN documents.

This authority does not mean that the design controls all software. Developers continue to own component implementations, third-party integrations, operations, resources, security, accessibility foundations, and performance-sensitive algorithms.

### 2.4 Why runtime execution instead of mandatory code generation

DESEN does not require a React, Swift, or other source-code export for each design revision. Publication produces an optimized, validated data bundle. The application already contains or can securely resolve the implementation packages required by that bundle. At runtime, the bundle is materialized through those packages.

This makes a design revision deployable without recreating the surface in source code, while avoiding arbitrary downloaded executable code. A runtime may create platform-specific caches or ahead-of-time indexes, but those are derivative and never replace the bundle as the design authority.

### 2.5 The central ownership boundary

| Designer-owned contract | Developer-owned implementation |
|---|---|
| Surface tree and slots | Component internals |
| Exposed props and style-part values | Third-party libraries and wrappers |
| Conditional and responsive variants | Domain services and API clients |
| Local experience state | Authentication and authorization |
| Data presentation bindings | Resource and operation implementations |
| Event-to-action orchestration | Performance-critical algorithms |
| Loading, empty, success, error presentation | Platform integration and infrastructure |

Neither side may silently alter the other side's contract and remain conforming. A design cannot invoke an undeclared operation or style an undeclared internal part. A capability implementation cannot claim compatibility after breaking its pinned catalog contract.

---

## 3. Conventions and Normative Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described by BCP 14 when, and only when, they appear in capitals as shown.

Unless explicitly marked informative, Sections 3 through 31 and Appendices A through D are normative.

DESEN 0.1.0 uses:

- JSON as its interchange encoding;
- JSON Schema Draft 2020-12 for machine-readable structural validation;
- Semantic Versioning 2.0.0 for protocol, catalog, and package versions; and
- RFC 8785 JSON Canonicalization Scheme (JCS) before SHA-256 digest calculation.

Examples are informative unless stated otherwise. The JSON Schema files in `schemas/` are normative for document structure. Where prose and a schema conflict in this Working Draft, the stricter requirement applies and the conflict must be reported as a specification defect.

---

## 4. Scope

### 4.1 Goals

DESEN 0.1.0 is designed to support:

1. visual authoring with real application capabilities;
2. production execution from published design bundles;
3. deterministic, data-only composition;
4. component properties and named child slots;
5. explicitly exposed style parts and visual states;
6. local interaction state;
7. resource reads and named operation invocations;
8. event-to-action orchestration;
9. conditional rendering, variants, and repeated content;
10. complex components such as maps and data grids;
11. attachable behaviors such as sorting and drag-and-drop;
12. design-time fixtures and scenarios;
13. immutable catalog and bundle version pinning;
14. atomic runtime activation and last-known-good fallback; and
15. independent producers, publishers, validators, editors, packages, and runtimes.

### 4.2 Non-goals

The following are out of scope for 0.1.0:

- a vector illustration or freeform drawing format;
- arbitrary JavaScript, native code, template code, CSS selectors, or executable expressions in documents;
- automatic implementation of unknown components or third-party libraries;
- backend, database, authentication, or API generation;
- a general workflow or business-process language;
- direct mutation of external data without a declared operation;
- telemetry, experimentation, feature rollout, audit, or organizational governance protocols;
- real-time multiplayer editing;
- plugin marketplace and distribution policy;
- voice, augmented reality, virtual reality, or general multimodal adaptation;
- mandatory source-code generation;
- lossless import of arbitrary existing application code;
- pixel-identical rendering across platforms; and
- allowing designers to edit capability internals that the capability contract does not expose.

### 4.3 Future compatibility

Out-of-scope features may later be expressed by profiles, extensions, or future protocol versions. Implementations **MUST NOT** assume that an omitted feature is permanently prohibited unless it would violate the invariants in Appendix A.

---

## 5. Design Principles

### 5.1 Design authority

The editable DESEN source is the authority for the composition and experience behavior of DESEN-managed surfaces. Production runtimes execute published revisions derived from that source.

### 5.2 Real capabilities, not visual surrogates

An editor **SHOULD** render the same capability adapter used by production. When that is impossible, it must use a declared equivalent adapter and disclose the fidelity level. A static screenshot is not a conforming interactive authoring adapter.

### 5.3 Data-only execution

DESEN documents are data. They **MUST NOT** contain or cause evaluation of arbitrary executable code. All executable behavior originates from capabilities installed or otherwise trusted by the host application.

### 5.4 Explicit capability boundaries

A capability controls what designers can configure through schemas for props, slots, events, commands, style parts, visual states, and authoring scenarios. Undeclared internals remain inaccessible.

### 5.5 Publish before production execution

A source document is not directly activated in production. A conforming publisher validates and normalizes it into a Published Design Bundle. Production runtimes consume bundles, not authoring state.

### 5.6 Determinism

Given the same bundle, exact capability packages, host context, resource values, event sequence, and environment values, a conforming runtime **MUST** produce the same protocol-observable composition, state transitions, and operation requests.

### 5.7 Fail safely and preserve the last known good revision

A new bundle is activated atomically only after preflight checks pass. Failure to activate a new revision **MUST NOT** invalidate a previously active compatible revision.

### 5.8 Portability without a lowest-common-denominator UI

The core protocol is platform-neutral, but capability catalogs are target-specific. DESEN does not pretend that every platform has identical components. Portability is achieved by explicit catalog contracts and profiles, not by reducing all products to a small universal widget set.

### 5.9 No hidden handoff artifact

An implementation that requires a developer to manually recreate the same managed surface after every design publication defeats the primary purpose of DESEN. Optional exports are permitted, but a conforming runtime-driven workflow must not depend on manual reimplementation.

---

## 6. Architecture

### 6.1 Normative artifacts

DESEN defines three primary JSON document types.

#### 6.1.1 Design Source Document

A `desen.source` document is the editable, producer-owned representation of one design project. It contains surfaces, nodes, state declarations, resource instances, bindings, interactions, authoring metadata, and catalog requirements.

#### 6.1.2 Published Design Bundle

A `desen.bundle` document is the immutable production representation emitted by a publisher. It excludes editor-only authoring state, pins exact capability package digests, and carries reproducible source and bundle digests.

#### 6.1.3 Capability Catalog

A `desen.catalog` document declares the public contract of an immutable capability package for one target. It describes components, behaviors, operations, resources, and authoring metadata. The implementation code is outside the JSON document but is identified by the package digest.

### 6.2 Runtime actors

A complete ecosystem may contain:

- **Producer** — creates or edits Design Source Documents;
- **Editor** — a Producer with an interactive authoring runtime;
- **Publisher** — validates a source and emits a Published Design Bundle;
- **Validator** — performs structural and semantic conformance checks;
- **Capability Package** — ships a catalog plus target adapters and implementations;
- **Authoring Runtime** — realizes capabilities in the editor;
- **Production Runtime** — realizes bundles inside the host application; and
- **Host Application** — provides context, capability implementations, resources, operations, navigation integration, and security policy.

### 6.3 Lifecycle

```text
1. Developer publishes immutable Capability Packages.
2. Editor resolves their Capability Catalogs.
3. Designer composes and tests a Design Source Document.
4. Publisher validates the source against the exact catalogs.
5. Publisher emits and stores a Published Design Bundle.
6. Host stages the bundle and resolves exact package digests.
7. Runtime preflights and atomically activates the revision.
8. Runtime materializes surfaces from the bundle on demand.
```

A host may keep multiple revisions available for rollback or cohort selection, but rollout policy itself is outside this specification.

---

## 7. Conformance Targets

An implementation **MUST** state which target or targets it conforms to.

### 7.1 Source Producer

A conforming Source Producer:

- emits structurally valid `desen.source` documents;
- preserves stable node and surface identifiers across ordinary edits;
- targets declared catalog versions;
- does not place executable code in documents; and
- distinguishes authoring-only metadata from production semantics.

### 7.2 Editor

A conforming Editor is a Source Producer and:

- resolves catalog authoring contracts;
- validates capability usage continuously or before publication;
- provides Design Mode and Run Mode, or equivalent workflows;
- discloses adapter fidelity; and
- can preview declared scenarios, state, resources, and operation outcomes.

### 7.3 Publisher

A conforming Publisher:

- performs the checks in Section 25;
- emits a structurally and semantically valid `desen.bundle`;
- pins exact capability package versions, targets, and digests;
- calculates digests as specified in Section 11; and
- does not require production runtime execution of authoring-only fields.

### 7.4 Capability Package

A conforming Capability Package:

- includes a valid `desen.catalog` manifest;
- provides a production implementation for every declared component and behavior for its target;
- provides host bindings for declared resources and operations, or clearly marks them as application-supplied;
- exposes only contract-declared props, slots, events, commands, and style parts to DESEN;
- provides an authoring adapter or declares the absence and fidelity consequences; and
- is immutable for a given `id`, `version`, `target`, and `packageDigest` tuple.

### 7.5 Authoring Runtime

A conforming Authoring Runtime satisfies Section 23 and never executes production side effects unless the editor explicitly enters an authorized integration-preview mode.

### 7.6 Production Runtime

A conforming Production Runtime satisfies Sections 24, 26, and 27, including exact package resolution, atomic activation, deterministic action processing, and last-known-good behavior.

### 7.7 Validator

A conforming Validator supports the published schemas and the semantic error classes in Appendix B. A schema-only validator must identify itself as such and must not claim full protocol validation.

---

## 8. Identifiers, Namespaces, and Versions

### 8.1 Local identifiers

Surface, node, behavior-instance, state, resource-instance, operation-alias, and scenario identifiers use the following grammar:

```text
^[A-Za-z][A-Za-z0-9._:-]{0,127}$
```

Within a surface, all node and behavior-instance identifiers **MUST** be unique. Surface identifiers **MUST** be unique within a source or bundle.

Identifiers are semantic identity, not display labels. Producers **SHOULD NOT** change an identifier when only a label, position, style, or property value changes.

### 8.2 Capability identifiers

Component, behavior, operation, and resource capabilities use a reverse-domain package namespace followed by `/` and a local name:

```text
<package-namespace>/<local-name>
```

Examples:

```text
com.example.ui/Button
com.example.maps/Map
com.example.interactions/Sortable
com.example.auth/signIn
```

The map key in a catalog's `components`, `behaviors`, `operations`, or `resources` object is the capability identifier. A capability identifier **MUST NOT** occur in more than one category in the same resolved catalog set.

### 8.3 Versions

`desen` carries the protocol version and is exactly `0.1.0` in this release.

Catalog and package `version` values **MUST** be exact Semantic Versions. Version ranges are not supported in 0.1.0 source or bundle documents.

### 8.4 Target

A catalog `target` identifies one runtime environment such as `web-react`. Target strings are open but exact. A bundle requirement and the installed package **MUST** use the same target string.

### 8.5 Immutable package identity

The tuple below uniquely identifies a capability package:

```text
(id, version, target, packageDigest)
```

A distributor **MUST NOT** serve different implementation artifacts under the same tuple.

---

## 9. Authority and Ownership Model

### 9.1 Managed surfaces

A surface is **DESEN-managed** when the host declares that its composition is loaded from an active Published Design Bundle.

For a managed surface, the bundle is authoritative for:

- node existence and hierarchy;
- slot assignment and child order;
- configured component and behavior capabilities;
- property and style-part values;
- conditions, variants, and repeats;
- local state declarations;
- resource instances;
- event handlers and action order; and
- navigation requests between managed surfaces.

A host that replaces, reorders, or injects product UI inside the managed root for non-policy reasons does not conform for that surface. A host may wrap the root with platform infrastructure such as navigation containers, error boundaries, safe-area handling, accessibility infrastructure, or security gates, provided it does not misrepresent the managed composition.

### 9.2 Capability authority

Capability Packages are authoritative for:

- internal component structure;
- rendering algorithms;
- third-party library selection;
- platform-specific interaction mechanics;
- accessibility primitives and semantic mappings;
- performance behavior;
- resource and operation implementation; and
- the configurable surface exposed to DESEN.

A design cannot address an internal DOM node, native view, map layer, drag sensor, or library option unless the capability contract exposes it as a property, slot, event, command, style part, visual state, or behavior property.

### 9.3 Contract changes

A change that breaks an existing capability contract requires a major package version. Runtimes **MUST** either retain the exact compatible package required by an active bundle or refuse activation of that bundle. Silent fallback to an incompatible version is prohibited.

### 9.4 Derived artifacts

Screenshots, generated source files, rendered HTML, test snapshots, design thumbnails, and platform caches are derived artifacts. They do not become authoritative merely because they are committed to a repository.

---

## 10. Common Data Conventions

### 10.1 Closed core objects

Core schema objects use `additionalProperties: false` unless deliberately open. New semantic fields must be added through a protocol version or under the `extensions` object.

### 10.2 Extensions

Every top-level document and most semantic objects may contain `extensions`, an object reserved for namespaced extension keys. Extension keys **SHOULD** use reverse-domain names, for example:

```json
{
  "extensions": {
    "com.example.editor.selectionColor": "accent"
  }
}
```

An implementation that does not understand an extension **MUST** preserve it when round-tripping a source document and **MUST NOT** assign it core semantics. A production runtime may ignore unknown extensions unless the active profile declares them required.

### 10.3 JSON Schema fragments

Schemas embedded in catalogs or state declarations use JSON Schema Draft 2020-12. A publisher **MUST** reject an embedded schema that is not a valid Draft 2020-12 schema.

### 10.4 Missing versus null

A missing reference is distinct from a resolved JSON `null` value. `fallback` applies only when resolution fails, not when the resolved value is `null`.

### 10.5 Ordered arrays

Array order is semantic for slots, actions, variants, catalogs, and repeated output. Implementations **MUST** preserve it.

---

## 11. Digests and Canonicalization

### 11.1 Digest format

Digests use lowercase hexadecimal SHA-256 with the prefix `sha256:`.

```text
sha256:<64 lowercase hexadecimal characters>
```

### 11.2 Source digest

The source digest is calculated over the Design Source Document after removing the top-level `authoring` member and before publication-specific normalization:

```text
sourceDigest = "sha256:" + SHA-256(JCS(source_without_authoring))
```

The `extensions` member remains included because extensions may carry semantic information.

### 11.3 Bundle revision

The bundle revision is calculated after publication normalization over the bundle with the top-level `revision` and `publication` members removed:

```text
revision = "sha256:" + SHA-256(JCS(bundle_without_revision_and_publication))
```

`publication` may contain timestamps, storage metadata, signatures, or pipeline information and therefore does not alter the semantic revision.

### 11.4 Package digest

`packageDigest` identifies the immutable distributable capability package, including its catalog and target adapter artifacts. The byte-level packaging format is outside 0.1.0. A package ecosystem **MUST** document a deterministic digest procedure and **MUST NOT** reuse a digest for different bytes.

### 11.5 Verification

Publishers and production runtimes **MUST** verify source and bundle digests when the corresponding material is available. A mismatch is an integrity error and prevents activation.

---

## 12. Design Source Document

A Design Source Document conforms to `schemas/desen-source.schema.json`.

### 12.1 Required shape

```json
{
  "kind": "desen.source",
  "desen": "0.1.0",
  "id": "com.example.product",
  "catalogs": [
    {
      "id": "com.example.web-catalog",
      "version": "1.0.0",
      "target": "web-react"
    }
  ],
  "entry": "sign-in",
  "surfaces": {},
  "authoring": {},
  "extensions": {}
}
```

### 12.2 Catalog requirements

Each source catalog requirement names an exact catalog `id` and `version`, with optional `target` and discovery `location`. A publisher resolves it to one immutable package and records the exact `target` and `digest` in the bundle.

Source `location` is a discovery hint only. It does not grant trust and is not copied into the bundle unless a profile specifies otherwise.

### 12.3 Entry surface

`entry` **MUST** identify a key in `surfaces`. The surface value's internal `id` **MUST** equal its map key.

### 12.4 Authoring member

`authoring` may contain editor layout, selections, scenario choices, viewport settings, annotations, or other non-production data. It is excluded from `sourceDigest` and **MUST NOT** be copied into a production bundle.

A producer may use its own authoring schema, but should namespace high-value interoperable additions through extensions until standardized.

---

## 13. Published Design Bundle

A Published Design Bundle conforms to `schemas/desen-bundle.schema.json`.

### 13.1 Required shape

```json
{
  "kind": "desen.bundle",
  "desen": "0.1.0",
  "id": "com.example.product",
  "revision": "sha256:...",
  "sourceDigest": "sha256:...",
  "requires": {
    "catalogs": [
      {
        "id": "com.example.web-catalog",
        "version": "1.0.0",
        "target": "web-react",
        "digest": "sha256:..."
      }
    ]
  },
  "entry": "sign-in",
  "surfaces": {},
  "publication": {},
  "extensions": {}
}
```

### 13.2 Immutability

A bundle is immutable by revision. Storage systems **MUST NOT** replace the bytes or semantic content associated with a revision. A new publication creates a new revision.

### 13.3 Exact requirements

Every catalog requirement in a bundle contains exact `id`, `version`, `target`, and `digest` values. A runtime **MUST NOT** use a best-match or newer compatible package in place of the exact tuple.

### 13.4 Publication member

`publication` is non-semantic pipeline metadata. Profiles may define signatures or attestations within it. Unknown publication fields do not affect revision calculation.

### 13.5 Source and bundle relationship

A bundle may normalize or remove source material but must preserve its protocol-observable experience. A publisher **MUST** provide traceability from bundle node identifiers to source node identifiers; in 0.1.0 this is achieved by preserving the identifiers unchanged.

---

## 14. Values and Bindings

A `ValueSpec` is one of:

- a JSON scalar;
- an array of values;
- a literal object;
- a reference object;
- a token reference; or
- a deterministic string-format object.

### 14.1 Literal objects

A literal object's property names **MUST NOT** begin with `$`, which reserves that namespace for protocol value forms.

### 14.2 References

```json
{
  "$ref": "state.email",
  "fallback": ""
}
```

References are read-only. They never cause a write.

The first segment identifies a namespace:

| Namespace | Meaning |
|---|---|
| `state` | Surface-local state declared in `surface.state` |
| `context` | Host-provided application context |
| `resource` | A declared resource instance and its lifecycle |
| `operation` | A named operation invocation lifecycle |
| `event` | Payload of the event currently being handled |
| `item` | Local value introduced by `repeat.as` |
| `env` | Runtime environment values |

#### 14.2.1 State references

`state.<name>` resolves the current state value. Additional segments address object properties or array-free nested paths.

#### 14.2.2 Context references

`context.*` is provided by the host. Its schema and update policy are profile-specific. Context may include non-secret user capabilities, route parameters, locale context, or feature availability. Secrets **MUST NOT** be exposed to design bindings.

#### 14.2.3 Resource references

For a resource instance named `stores`, runtimes expose:

```text
resource.stores.status        idle | pending | succeeded | failed
resource.stores.pending       boolean
resource.stores.value.*       validated output on success
resource.stores.error.code    declared public error code on failure
```

Unlisted response fields are inaccessible unless permitted by the resource's output schema.

#### 14.2.4 Operation references

For an invocation alias named `saveProfile`, runtimes expose:

```text
operation.saveProfile.status       idle | pending | succeeded | failed
operation.saveProfile.pending      boolean
operation.saveProfile.value.*      validated output on success
operation.saveProfile.error.code   declared public error code on failure
```

The alias is created by an `operation.invoke` action and is scoped to its surface.

#### 14.2.5 Event references

`event.*` is valid only while evaluating handlers for the current component or behavior event. It resolves against the event's declared `payloadSchema`.

#### 14.2.6 Item references

A repeat with `"as": "task"` exposes the current item as `item.task`. Nested repeats add another alias. Reusing an active alias in a nested scope is invalid.

#### 14.2.7 Environment references

The core reserves these environment paths:

```text
env.viewport.width
env.viewport.height
env.viewport.orientation
env.pointer
env.colorScheme
env.reducedMotion
env.locale
env.platform
```

Profiles may define additional paths. Environment changes may trigger predicate and value re-evaluation.

### 14.3 Fallback

When reference resolution fails, `fallback` is used if present and type-valid for its target. Without a valid fallback, the consumer property is unresolved and the runtime follows Section 26.

### 14.4 Token references

```json
{ "$token": "color.action.primary" }
```

A token reference is resolved by the host's token provider. DESEN does not redefine token storage. A capability style-part or prop schema determines the expected resolved type. Catalog packages and projects are encouraged to use the stable Design Tokens Community Group format for token documents.

### 14.5 Formatting

```json
{
  "$format": {
    "template": "Selected store: {id}",
    "values": {
      "id": { "$ref": "state.selectedStoreId", "fallback": "none" }
    }
  }
}
```

Formatting performs placeholder substitution only. It is not an expression language. Placeholders use `{name}` and must match keys in `values`. The output is a string. Profiles may define locale-aware formatting as explicit capabilities; it is not implicit in 0.1.0.

---

## 15. Predicates

Predicates provide deterministic, side-effect-free conditions for `when`, variants, and action guards.

```json
{
  "op": "all",
  "args": [
    { "op": "truthy", "args": [{ "$ref": "state.formValid" }] },
    { "op": "not", "args": [
      { "op": "truthy", "args": [{ "$ref": "operation.signIn.pending" }] }
    ] }
  ]
}
```

### 15.1 Operators

| Operator | Arity | Semantics |
|---|---:|---|
| `all` | 1–64 | true when every argument is true |
| `any` | 1–64 | true when at least one argument is true |
| `not` | 1 | boolean negation |
| `eq`, `neq` | 2 | canonical JSON equality / inequality |
| `gt`, `gte`, `lt`, `lte` | 2 | order comparison for two numbers or two strings |
| `in` | 2 | left value occurs in right array, or left string occurs in right string |
| `contains` | 2 | left array/string contains right value/string |
| `exists` | 1 | reference resolved, including to `null` |
| `truthy` | 1 | explicit DESEN truth conversion |

For `truthy`, `null`, `false`, numeric zero, an empty string, an empty array, and an empty object are false; all other resolved values are true. An unresolved argument without fallback makes the predicate false.

Ordering operands of different types is invalid. A publisher should detect statically provable type errors; a runtime treats a dynamic type mismatch as false and reports a diagnostic.

### 15.2 Evaluation and merging

Predicates are evaluated against one consistent snapshot of state, context, resources, operations, environment, event payload, and repeat scope. They cannot invoke operations, modify state, or access capability internals.

---

## 16. Surfaces

A surface is a navigable, independently materialized product experience.

```json
{
  "id": "sign-in",
  "state": {},
  "resources": {},
  "root": {
    "id": "sign-in.root",
    "use": "com.example.ui/Stack"
  }
}
```

### 16.1 State

Each state entry contains:

- `schema` — the value's JSON Schema; and
- `initial` — its initial value, which must validate against the schema.

State is surface-local and runtime-ephemeral. It is not written back to the Design Source Document. Navigation away from a surface disposes state unless a profile explicitly provides preservation.

All state writes **MUST** leave the complete state entry valid against its schema. Invalid writes are rejected.

### 16.2 Resource instances

A resource instance binds a declared resource capability to input values and a load policy:

```json
{
  "use": "com.example.stores/list",
  "input": {},
  "policy": "mount"
}
```

Policies are:

- `mount` — load whenever the surface instance mounts;
- `once` — load at most once for the lifetime of that surface instance; and
- `manual` — load only after `resource.refresh`.

The capability catalog determines which policies a resource supports.

### 16.3 Root

`root` is a normal component node. The protocol has no separate universal page, frame, or layout primitive. A target catalog supplies suitable root and layout capabilities.

---

## 17. Component Nodes

A node is an instance of a component capability.

```json
{
  "id": "sign-in.submit",
  "use": "com.example.ui/Button",
  "props": {
    "label": "Sign in",
    "variant": "primary"
  }
}
```

### 17.1 Capability resolution

`use` **MUST** resolve to exactly one component capability in the bundle's catalog set. Unknown or ambiguous capabilities are publication errors.

### 17.2 Properties

`props` maps property names to `ValueSpec` values. The resolved property object **MUST** validate against the component's `propsSchema`.

A publisher validates literal values immediately and validates dynamic references using available source schemas. When exact static validation is impossible, it records or emits a runtime validation obligation. A production runtime **MUST** validate untrusted dynamic data before passing it to a capability.

### 17.3 Slots

`slots` assigns ordered child-node arrays to named component slots. A publisher enforces:

- declared slot names;
- `required`, `minItems`, and `maxItems` cardinality;
- accepted capability identifiers; and
- accepted capability categories.

Children cannot be placed into an undeclared slot. A component with no declared slots is a leaf from the protocol's perspective, even if its internal implementation contains children.

### 17.4 Conditional presence

`when` determines whether the node is instantiated. A false condition means the node and its descendants are absent, not merely visually hidden. Their resources, behaviors, events, and commands are not active.

### 17.5 Variants

Variants conditionally override `props` and `style`:

```json
{
  "when": {
    "op": "lt",
    "args": [{ "$ref": "env.viewport.width" }, 640]
  },
  "props": { "direction": "vertical" }
}
```

Base props and style are applied first. All matching variants are applied in array order; later matching variants override earlier values at the same property path. Variants do not add or remove children in 0.1.0. Structural changes use conditional nodes.

### 17.6 Repeated nodes

`repeat` materializes a node for each item in an array:

```json
{
  "items": { "$ref": "resource.tasks.value" },
  "as": "task",
  "key": { "$ref": "item.task.id" },
  "limit": 100
}
```

Requirements:

- `items` must resolve to an array;
- `key` must resolve to a unique string or number for each item;
- `as` introduces the item alias;
- `limit` bounds materialized instances; and
- duplicate or missing keys invalidate the repeated subtree.

The runtime instance identifier is the source node id plus a canonical encoding of the repeat key. The source node id remains the authoring and diagnostic identity.

### 17.7 Event handlers

`on` maps declared component event names to ordered action arrays. An undeclared event is a catalog error.

Actions run against an immutable event-payload snapshot in array order. Asynchronous operation settlement is handled through `onSuccess` and `onFailure`, not by implicitly blocking the remaining event actions.

### 17.8 Stable identity

Within one surface, node ids remain stable across revisions whenever the conceptual node remains the same. Stable identity enables editor selection, diagnostics, state preservation during compatible updates, and future diff protocols.

---

## 18. Styles and Visual States

DESEN never grants general access to a component's internal implementation. Styling occurs through declared **style parts**.

### 18.1 Style shape

A node's style map is structured as:

```text
visual state → style part → property → ValueSpec
```

Example:

```json
{
  "style": {
    "base": {
      "marker": {
        "fill": { "$token": "color.marker.default" }
      },
      "selectedMarker": {
        "fill": { "$token": "color.marker.selected" }
      }
    }
  }
}
```

### 18.2 Base and declared states

`base` is the default state. Other top-level keys **MUST** be listed in the capability's `visualStates`, such as `hover`, `focus`, `disabled`, `loading`, `dragging`, `dropTarget`, or `selectedMarker`.

A capability determines when production visual states are active. An authoring runtime may force a state for preview.

### 18.3 Style parts

Each style-part name **MUST** be declared by the capability. Its property object must validate against the part's `propertiesSchema` after value resolution.

Style parts are semantic styling hooks, not DOM selectors. A package may change its internal structure without breaking the contract as long as the declared style part retains its documented meaning.

### 18.4 Design tokens

Token references are preferred for shared design-system values, but the protocol does not require every style value to be a token in 0.1.0. A project or profile may enforce stronger token policies.

### 18.5 Accessibility

Design styling **MUST NOT** suppress host-enforced accessibility behavior. Capability implementations remain responsible for platform semantics. Editors should expose accessibility-relevant props declared by capabilities and should report invalid combinations.

---

## 19. Behavior Capabilities

A behavior capability adds interaction mechanics to a component without turning those mechanics into core protocol primitives.

Examples include:

- sortable lists;
- drag sources and drop targets;
- resizable panels;
- keyboard roving focus;
- selectable regions;
- virtualized scrolling; and
- gesture recognition.

### 19.1 Behavior instance

```json
{
  "id": "tasks.sort",
  "use": "com.example.interactions/Sortable",
  "props": {
    "axis": "vertical",
    "handle": "item"
  },
  "on": {
    "reorder": []
  }
}
```

Behavior ids are unique in the surface identity space.

### 19.2 Attachment validation

A behavior catalog declares compatible component capabilities or categories through `attachTo`. A publisher rejects an invalid attachment.

### 19.3 Composition and conflicts

A behavior may declare `exclusiveChannels`, such as `pointer-drag`, and explicit compatibility with other behavior capabilities. Two behaviors requiring the same exclusive channel cannot be attached to the same node unless their contracts declare compatibility.

### 19.4 Behavior slots, events, commands, and styles

Behaviors may expose the same contract surfaces as components: props, slots, events, commands, style parts, visual states, and authoring scenarios. This allows a designer to define drag previews, drop indicators, handles, or invalid-target states without exposing the underlying library.

---

## 20. Actions

Actions are the only protocol-defined responses to component or behavior events. They are data-only and closed in 0.1.0.

Every action may include a `when` predicate. A false guard skips the action without error.

### 20.1 `state.set`

Writes a value to a state path. The first path segment names a declared state entry. The resulting complete state value must validate against its schema.

### 20.2 `state.toggle`

Toggles a boolean state path. Non-boolean targets are invalid.

### 20.3 `navigate`

Requests navigation to another surface in the same bundle. The target must exist. Optional `params` are supplied to the host's navigation context; their lifecycle is profile-defined.

External URL navigation is deliberately absent from the 0.1.0 core and should be exposed through a trusted operation or extension profile.

### 20.4 `operation.invoke`

Invokes a declared operation capability:

```json
{
  "type": "operation.invoke",
  "operation": "com.example.auth/signIn",
  "as": "signIn",
  "input": {
    "email": { "$ref": "state.email" },
    "password": { "$ref": "state.password" }
  },
  "concurrency": "reject",
  "onSuccess": [
    { "type": "navigate", "surface": "home" }
  ],
  "onFailure": []
}
```

The runtime validates resolved input against `inputSchema` before invocation and validates successful output against `outputSchema` before exposing it.

The `as` alias owns one observable lifecycle. Concurrency modes are:

- `reject` — refuse a new invocation while one is pending;
- `replace` — cancel or logically supersede the pending invocation; stale settlement is ignored; and
- `queue` — run invocations serially in request order.

An invocation enters `pending` synchronously. Settlement enters `succeeded` or `failed`. Only declared public error codes are exposed to the design. Internal messages, stack traces, secrets, and raw server responses are never exposed.

`onSuccess` and `onFailure` execute in a new action turn after lifecycle state is updated. A failure inside a settlement handler does not retroactively change the operation result.

### 20.5 `resource.refresh`

Requests a declared surface resource instance to load again using its current resolved input.

### 20.6 `component.command`

Invokes a declared command on a currently instantiated component node. The command input is validated against the capability's `inputSchema`.

Commands are intended for imperative component operations that are still part of the public design contract, such as `fitBounds`, `focus`, `scrollToItem`, or `open`. They must not become a generic escape hatch to arbitrary methods.

### 20.7 `event.emit`

Emits a named event to the host application. Host applications **MUST** allowlist accepted names and validate payloads according to a profile or application contract. This action is for shell integration, not analytics telemetry.

### 20.8 Action turn limits

A runtime **MUST** bound action depth and repeated synchronous state transitions. The default maximum is 64 actions per event turn. Profiles may lower this value. Exceeding the limit terminates the turn and reports `ACTION_LIMIT_EXCEEDED`.

---

## 21. Capability Catalog

A Capability Catalog conforms to `schemas/desen-catalog.schema.json`.

```json
{
  "kind": "desen.catalog",
  "desen": "0.1.0",
  "id": "com.example.web-catalog",
  "version": "1.0.0",
  "target": "web-react",
  "packageDigest": "sha256:...",
  "components": {},
  "behaviors": {},
  "operations": {},
  "resources": {}
}
```

### 21.1 Catalog set

A source or bundle may require multiple catalogs. The resolved set is treated as one namespace. Duplicate capability identifiers across the set are invalid, even when they occur in the same category.

### 21.2 Component capability

A component capability declares:

- `propsSchema` — complete public property contract;
- `slots` — child composition contract;
- `events` — event names and payload schemas;
- `commands` — imperative public commands;
- `styleParts` — named customization surfaces;
- `visualStates` — previewable and styleable states;
- `authoring` — editor metadata and scenarios;
- `deprecated` — deprecation state or message; and
- `replacement` — optional replacement capability id.

Catalog schemas **SHOULD** set `additionalProperties: false` for public prop objects unless openness is intentional.

### 21.3 Slot contract

A slot may constrain cardinality and accepted child capability ids or categories. When both `accepts` and `acceptsCategories` are present, a child is accepted if it matches either list.

### 21.4 Event contract

Every event declares a `payloadSchema`. Production adapters **MUST** validate or guarantee emitted payloads against this schema. Editors use it to validate `event.*` references.

### 21.5 Command contract

Every command declares an `inputSchema`. A production adapter **MUST** implement every command it declares.

### 21.6 Style-part contract

Every style part declares a `propertiesSchema`. Documentation should describe the part's semantic role and cross-version stability.

### 21.7 Authoring contract

The authoring object may declare:

- display name, category, and icon;
- default props;
- editor control hints;
- named scenarios and fixtures;
- horizontal and vertical resizing behavior;
- adapter fidelity; and
- known preview differences.

Control hints guide editor UI but do not override `propsSchema` validation.

### 21.8 Adapter fidelity

`adapterFidelity` values mean:

- `same` — authoring and production use the same implementation artifact or a formally identical build;
- `equivalent` — a dedicated authoring adapter implements the same public contract and observable behavior; and
- `approximate` — the preview intentionally omits or approximates behavior.

Editors **MUST** visibly disclose `approximate` fidelity and list known `differences`. An approximate adapter may be useful for unavailable native services but cannot support a claim of exact visual or behavioral preview.

---

## 22. Operations and Resources

### 22.1 Operations

An operation capability declares:

- input schema;
- output schema;
- public error codes;
- side-effect class; and
- optional authoring fixtures.

Side-effect classes are:

- `none` — pure or read-only calculation;
- `local` — modifies host-local state or storage;
- `network` — communicates with a remote service; and
- `external` — invokes another platform or application capability.

The effect class is descriptive and may support host policy. It does not grant permission. Host authorization always governs execution.

### 22.2 Resources

A resource capability declares:

- input schema;
- output schema;
- public errors;
- supported load policies;
- optional cache hints; and
- authoring fixtures.

Resources are read-oriented. A capability that modifies domain data must be an operation.

### 22.3 Fixtures

Authoring fixtures are synthetic data for editor preview. They **MUST NOT** contain production secrets or personal data and **MUST NOT** be shipped as live user data. A production runtime ignores authoring fixtures.

### 22.4 Implementation binding

The protocol does not specify HTTP endpoints, SDK calls, database queries, or authentication methods. The host binds a capability id to trusted implementation code. This keeps design documents stable when infrastructure changes and prevents direct access to arbitrary services.

---

## 23. Authoring Runtime and Editor Semantics

### 23.1 Real rendering

An editor must instantiate the capability's authoring adapter, not reconstruct it from screenshots or guessed CSS. The adapter may be the production component itself or an explicitly declared equivalent or approximate implementation.

### 23.2 Design Mode

Design Mode prioritizes selection and composition. The editor may intercept pointer, keyboard, drag, or gesture input to support authoring. It must still render current resolved props, slots, style parts, conditions, repeats, and selected visual states.

### 23.3 Run Mode

Run Mode routes interaction to the capability adapters and executes DESEN state, resources, events, actions, and operation fixtures. Designers must be able to experience the surface as a user would, subject to authoring safety.

### 23.4 Property controls

Editors derive property controls from `propsSchema` plus optional catalog control hints. Unsupported schema features should fall back to a structured JSON editor rather than silently hiding configurable properties.

### 23.5 Slots and direct manipulation

Editors should expose named slots as drop targets and enforce slot contracts during manipulation. The editor may provide canvas affordances, but those affordances are authoring-only and cannot alter runtime semantics.

### 23.6 Style-part editing

Editors expose declared style parts and state selectors. They must not discover or edit private implementation selectors. Token pickers may be connected to the project's token provider.

### 23.7 Scenarios

Catalog scenarios let the editor preview states such as:

- default;
- loading;
- empty;
- error;
- selected marker;
- drag in progress; or
- permission denied.

A scenario may supply props, fixtures, and state. Scenario activation is authoring-only and never copied into the Published Design Bundle.

### 23.8 Side-effect safety

By default, Authoring Runtimes use fixtures and do not call production operations or resources. A separate integration-preview mode may invoke non-production environments after explicit user and host authorization. The editor must clearly distinguish fixture, integration, and production contexts.

### 23.9 Diagnostics

Diagnostics must identify at least:

- source document id;
- surface id;
- node or behavior id;
- capability id;
- property, slot, event, command, or action path; and
- stable error code.

Invalid subtrees should remain selectable in Design Mode through diagnostic placeholders.

---

## 24. Production Runtime Semantics

### 24.1 Activation pipeline

A Production Runtime activates a bundle through these stages:

1. fetch or receive the immutable bundle;
2. verify document syntax and supported protocol version;
3. verify `revision` and optional publication integrity;
4. resolve exact capability package tuples;
5. verify package digests;
6. preflight surface and capability references;
7. stage runtime indexes and lazy-load plans;
8. atomically mark the revision active; and
9. preserve the previous active revision as last known good according to host policy.

A failure before step 8 leaves the current active revision unchanged.

### 24.2 Materialization

When a surface is opened, the runtime:

1. creates its local state;
2. initializes resource lifecycles;
3. resolves the root node;
4. evaluates conditions, repeats, variants, values, and styles;
5. instantiates component and behavior adapters;
6. subscribes to declared events and environment dependencies; and
7. starts `mount` and `once` resources.

This is runtime materialization, not arbitrary code compilation.

### 24.3 Reactive updates

A state, context, resource, operation, or environment change invalidates dependent values and predicates. The runtime may use a dependency graph or re-evaluate a surface, but the observable result must be equivalent.

Updates from one action turn are batched into a consistent snapshot where supported by the host platform. Stale asynchronous resource or operation results must not overwrite a newer generation.

### 24.4 Component lifecycle

The runtime uses stable node identity and repeat keys to preserve compatible component instances across re-evaluation. It may remount when the `use` capability changes, the repeat key changes, or the adapter declares remount-required property changes.

### 24.5 Navigation

`navigate` requests are delegated to the host's DESEN navigation integration. The requested target must exist in the active bundle. Access control may deny navigation; denial is reported without substituting another target.

### 24.6 Host policy

A host may deny a resource, operation, command, or emitted event for security or platform reasons. Denial becomes a controlled failure state visible through diagnostics or declared public errors. A host must not falsify success.

### 24.7 No silent semantic substitution

A runtime **MUST NOT** silently replace an unknown capability with a generic placeholder in production. It may display a host-defined safe failure surface, preserve the last known good revision, or fail only an optional subtree when the active profile explicitly permits that behavior.

---

## 25. Publishing

### 25.1 Publication pipeline

A conforming publisher performs at least:

1. JSON parsing;
2. source schema validation;
3. embedded JSON Schema validation;
4. source-level identifier and reference validation;
5. exact catalog resolution;
6. catalog schema and digest validation;
7. capability namespace conflict detection;
8. prop, slot, event, command, behavior, resource, and operation validation;
9. predicate, repeat, and state validation;
10. static binding compatibility checks where provable;
11. source digest calculation;
12. removal of `authoring`;
13. deterministic normalization;
14. exact catalog pinning;
15. bundle schema and semantic validation;
16. bundle revision calculation; and
17. optional signing and publication metadata attachment.

### 25.2 Deterministic normalization

Normalization may:

- apply explicit schema defaults;
- remove redundant empty optional members;
- order non-semantic maps canonically;
- pre-index dependency paths;
- resolve catalog discovery metadata to exact requirements; and
- add non-semantic publication data after revision calculation.

Normalization must not change child order, action order, variant order, identifiers, literal values, conditions, capability ids, or other observable behavior.

### 25.3 Publication failure

A publisher rejects a source when correctness cannot be proven under its target catalogs. It must not emit a bundle that relies on a production runtime to guess missing semantics.

### 25.4 Optional platform artifacts

A publisher may additionally emit source code, server-rendering manifests, binary indexes, thumbnails, or platform caches. These artifacts are non-normative. The Published Design Bundle remains the authority.

---

## 26. Failure Semantics

### 26.1 Error classes

Appendix B defines stable core error codes. Implementations may add namespaced diagnostic codes.

### 26.2 Publication versus runtime errors

Errors involving known source structure or catalog contracts should be caught at publication. Runtime errors are reserved for changing or external conditions such as unavailable resources, denied operations, corrupt delivery, dynamic data mismatch, or adapter failure.

### 26.3 Property failure

When a dynamic value does not resolve and has no valid fallback:

- if the capability prop schema permits omission, the prop is omitted;
- otherwise the affected node fails to instantiate.

The runtime must not pass an invalid value to the capability.

### 26.4 Node failure

A failed node is replaced by a host-defined safe boundary or omitted according to profile policy. Sibling nodes remain active when isolation is safe. In authoring, a selectable diagnostic placeholder is preferred.

### 26.5 Resource and operation failure

Resource and operation failures update their declared lifecycle and expose only a public error code. Designs express the visible failure state through conditions, variants, and bindings.

### 26.6 Bundle activation failure

A bundle with an unsupported protocol, invalid digest, missing exact package, or preflight catalog mismatch **MUST NOT** become active. The runtime continues to use the last known good revision when available.

### 26.7 Adapter crash

Hosts should isolate capability failures with platform-appropriate error boundaries. An adapter crash must not be interpreted as a successful operation or resource result.

---

## 27. Security Model

### 27.1 Threat assumptions

DESEN assumes that source documents, published bundles, remote delivery, resource data, operation output, and capability packages may be attacked or corrupted.

### 27.2 No executable document content

Documents **MUST NOT** contain:

- scripts;
- functions;
- eval-able expressions;
- arbitrary HTML or markup execution;
- dynamic imports;
- executable URLs;
- code templates; or
- direct references to private application methods.

Text-like values are inert data. Rich content must be provided by a trusted capability with its own schema and sanitization guarantees.

### 27.3 Trusted capability code

Only host-approved capability packages execute code. Loading or updating package code is governed by the platform and application distribution model, not by a design bundle.

### 27.4 Integrity and authenticity

SHA-256 digests detect accidental or malicious alteration but do not prove publisher identity. Production deployments **SHOULD** use authenticated transport and a signed publication profile. Signature standardization is deferred from the 0.1.0 core.

### 27.5 Least authority

- references are read-only;
- external writes occur only through named operations;
- component imperative access occurs only through declared commands;
- host events are allowlisted;
- navigation is limited to declared surfaces in core; and
- capability schemas constrain all data crossing the design–implementation boundary.

### 27.6 Secrets and personal data

Bundles and catalogs **MUST NOT** contain secrets. Authoring fixtures must use synthetic data. The protocol does not standardize telemetry or persistence of user input; hosts remain responsible for privacy and data protection.

### 27.7 Host authorization

A valid design request is not authorization. Resource reads, operation calls, navigation, commands, and event emissions remain subject to current user, tenant, device, and application policy.

### 27.8 Denial-of-service limits

Runtimes and publishers **MUST** enforce finite limits. Default limits for the Reference Profile are:

| Limit | Default |
|---|---:|
| Bundle size | 2 MiB uncompressed |
| Nodes per surface after repeats | 5,000 |
| Source tree depth | 64 |
| Repeat instances per repeat | 1,000 |
| Actions per event turn | 64 |
| Nested action settlement depth | 16 |
| Predicate arguments | 64 |

Profiles may adjust these values but must not make them unbounded.

---

## 28. Performance and Scalability

### 28.1 Publish-time work

Expensive work belongs in publication or activation, not the render hot path. Publishers should resolve catalogs, validate literals, build dependency metadata, and remove authoring state before delivery.

### 28.2 Immutable caching

Bundles are content-addressed by revision and packages by digest. Hosts and CDNs should cache them immutably. A mutable channel may point to a current revision, but the revision artifact itself never changes.

### 28.3 Atomic updates

A runtime stages a new revision separately and switches an active pointer only after preflight. Users never observe a half-applied bundle.

### 28.4 Lazy capability loading

Large capability implementations such as maps, rich-text editors, charts, or 3D viewers may be lazy-loaded. The exact package must still be known during preflight. Runtime code is loaded from trusted application/package distribution, never embedded in the bundle.

### 28.5 Surface materialization

Runtimes should instantiate only the active surface and may prefetch likely next surfaces. Bundle splitting and delta transport are future profile work; a 0.1.0 bundle remains logically complete.

### 28.6 Dependency tracking

Implementations may index `$ref` paths at publication or activation. A state change should not require rebuilding unrelated subtrees, although whole-surface reevaluation is conforming if observable behavior and performance limits are met.

### 28.7 Server rendering and hydration

A target profile may support server rendering or native precomposition. The server and client must use the same bundle revision and exact catalog contract. Hydration must preserve node identity and state semantics.

### 28.8 Performance responsibility

The protocol cannot make an inefficient component efficient. Capability packages remain responsible for virtualization, canvas/WebGL rendering, gesture engines, map tiles, image loading, and other implementation-specific performance behavior.

---

## 29. Complex Capability Integration

### 29.1 General rule

DESEN does not standardize every UI library. It standardizes how any trusted library-backed capability is made safely authorable.

A developer integrates a complex capability once by providing:

1. a production adapter;
2. an authoring adapter or fidelity declaration;
3. a component or behavior contract;
4. props and payload schemas;
5. named slots;
6. explicit style parts and visual states;
7. events and commands;
8. authoring scenarios and fixtures; and
9. an immutable package identity.

Designers can then compose and configure the capability repeatedly without a new screen-by-screen implementation handoff.

### 29.2 Map example

A map capability may expose:

- `center`, `zoom`, `mapStyle`, and control props;
- `marker`, `popup`, `controls`, and `emptyState` slots;
- `markerSelect` and `viewportChange` events;
- `fitBounds` and `flyTo` commands;
- `surface`, `marker`, `selectedMarker`, `popup`, and `controls` style parts; and
- `loading`, `empty`, and `selectedMarker` authoring scenarios.

The map engine, credentials, tile loading, clustering algorithm, and rendering internals remain developer-owned.

### 29.3 Sortable example

A sortable behavior may expose:

- axis, handle, activation-distance, and collision-strategy props;
- drag-preview and drop-indicator slots;
- dragging, drop-target, and invalid-target visual states;
- reorder and drag-cancel events; and
- compatibility rules for scroll and selection behaviors.

The host may implement it with any suitable library while preserving the contract.

### 29.4 Black-box rule

A capability is a black box except for its declared contract. Editors **MUST NOT** inspect private implementation structure and offer it as editable merely because it is technically discoverable.

When designers need additional control, the correct evolution is to:

- add a prop;
- add a slot;
- add a style part;
- add a visual state;
- add an event or command;
- add a behavior capability; or
- publish a new capability.

This preserves maintainability and prevents designs from depending on unstable internals.

---

## 30. Versioning and Compatibility

### 30.1 Protocol versions

DESEN follows Semantic Versioning.

- Patch versions clarify text and fix non-semantic defects.
- Minor versions add backward-compatible optional constructs.
- Major versions may introduce breaking document or runtime semantics.

Because 0.x releases are developmental, minor versions may still contain breaking changes. Every such change must be documented in `CHANGELOG.md` with migration guidance.

### 30.2 Capability package versions

Capability packages also use Semantic Versioning:

- patch — implementation fixes without contract change;
- minor — backward-compatible contract additions; and
- major — removal, renaming, changed meaning, narrowed schemas, incompatible rendering behavior, or other breaking changes.

A package patch still produces a different digest. A bundle pins both version and digest, so adoption is explicit.

### 30.3 Deprecation

Catalog capabilities may set `deprecated` and `replacement`. Publishers should warn on deprecated usage but may continue publishing while the exact package is available. Removal requires a breaking package version.

### 30.4 Protocol negotiation

A runtime supports an explicit set of DESEN protocol versions. It must reject unsupported versions before activation. Guessing forward compatibility is prohibited.

### 30.5 Catalog negotiation

Bundles use exact packages; there is no runtime negotiation to a different version. Discovery and upgrade tooling belong to editors and publishers.

---

## 31. Media Types, Files, and Discovery

### 31.1 File suffixes

Recommended suffixes are:

```text
*.source.desen.json   Design Source Document
*.bundle.desen.json   Published Design Bundle
*.catalog.desen.json  Capability Catalog
```

### 31.2 Media types

No media type is registered by this Working Draft. Implementations should use `application/json`. A future standards action may request `application/desen+json` or more specific media types.

### 31.3 Schema identifiers

The included schemas use identifiers under `https://schemas.desen.dev/0.1/`. These are canonical identifiers for this draft and are not guaranteed to be network-resolvable. Implementations may vendor exact copies.

### 31.4 Catalog discovery

Catalog registry, package transport, authentication, and repository layout are outside the core. A source `location` may help a publisher discover a package, but trust must be established independently.

### 31.5 IANA considerations

This Working Draft requests no IANA actions.

---

## 32. Reference Web–React Profile

This section defines an informative first implementation profile, not a restriction on the core protocol.

### 32.1 Target

```text
target: web-react
```

### 32.2 Package model

A package contains:

- a DESEN catalog JSON file;
- React production adapters;
- editor adapters, ideally the same React components;
- an operation/resource registration module;
- token-provider integration; and
- an immutable package manifest used to calculate `packageDigest`.

### 32.3 Editor

The editor hosts adapters in an isolated preview frame or equivalent boundary. Design Mode overlays selection controls without replacing the rendered component. Run Mode disables authoring overlays and routes events to the DESEN runtime.

### 32.4 Production runtime

The runtime maps capability ids to registered React adapters and materializes the bundle as a React tree. It must not fetch arbitrary component code named by the bundle. Capability modules are part of the trusted host deployment or trusted package distribution.

### 32.5 Styling

React/CSS implementation details stay inside packages. Designers configure semantic props and declared style parts. Private class names, DOM selectors, and component internals are not part of the DESEN contract.

### 32.6 Optional export

A web implementation may export React source for debugging, static hosting, or migration. Exported code is a derived artifact unless an external profile explicitly changes the authority model.

---

## 33. Worked Example: Sign-In Surface

This abbreviated example demonstrates local state, component props, event bindings, operation lifecycle, conditional error rendering, and navigation. The complete example in `examples/sign-in.source.desen.json` also defines the referenced `home` surface.

```json
{
  "kind": "desen.source",
  "desen": "0.1.0",
  "id": "com.example.auth-experience",
  "catalogs": [
    {
      "id": "com.example.web-catalog",
      "version": "1.0.0",
      "target": "web-react"
    }
  ],
  "entry": "sign-in",
  "surfaces": {
    "sign-in": {
      "id": "sign-in",
      "state": {
        "email": { "schema": { "type": "string" }, "initial": "" },
        "password": { "schema": { "type": "string" }, "initial": "" }
      },
      "resources": {},
      "root": {
        "id": "sign-in.form",
        "use": "com.example.ui/Stack",
        "props": { "direction": "vertical", "gap": "md" },
        "slots": {
          "default": [
            {
              "id": "sign-in.email",
              "use": "com.example.ui/TextField",
              "props": {
                "label": "Email",
                "value": { "$ref": "state.email" }
              },
              "on": {
                "change": [
                  {
                    "type": "state.set",
                    "path": "email",
                    "value": { "$ref": "event.value" }
                  }
                ]
              }
            },
            {
              "id": "sign-in.submit",
              "use": "com.example.ui/Button",
              "props": {
                "label": "Sign in",
                "loading": {
                  "$ref": "operation.signIn.pending",
                  "fallback": false
                }
              },
              "on": {
                "press": [
                  {
                    "type": "operation.invoke",
                    "operation": "com.example.auth/signIn",
                    "as": "signIn",
                    "input": {
                      "email": { "$ref": "state.email" },
                      "password": { "$ref": "state.password" }
                    },
                    "onSuccess": [
                      { "type": "navigate", "surface": "home" }
                    ]
                  }
                ]
              }
            },
            {
              "id": "sign-in.error",
              "use": "com.example.ui/Alert",
              "when": {
                "op": "eq",
                "args": [
                  { "$ref": "operation.signIn.status", "fallback": "idle" },
                  "failed"
                ]
              },
              "props": {
                "tone": "danger",
                "text": "Sign-in failed. Check your details and try again."
              }
            }
          ]
        }
      }
    }
  }
}
```

The designer owns the form composition, labels, states, loading presentation, error presentation, and successful navigation. The developer owns the `TextField`, `Button`, `Alert`, `Stack`, and `signIn` implementations and their contracts.

---

## 34. Open Questions for 0.2

The following require implementation evidence before standardization:

1. a portable signed-publication profile;
2. deterministic capability package archive format and digest procedure;
3. bundle chunking, surface-level delivery, and delta updates;
4. reusable source compositions and imports;
5. derived/computed state without a general expression language;
6. animation and transition contracts;
7. form grouping and validation orchestration;
8. cross-surface state preservation;
9. locale-aware messages and formatting;
10. runtime capability permissions and user-consent prompts;
11. catalog registry and package discovery;
12. source-to-runtime differential testing; and
13. native mobile reference profiles.

These are intentionally not solved speculatively in 0.1.0.

---

# Appendix A — Protocol Invariants

The following are non-negotiable for DESEN 0.1.x. Weakening one requires explicit reconsideration and, after 1.0, a major version.

1. **Design authority:** a DESEN-managed surface is composed from the active Published Design Bundle, not a manually maintained duplicate.
2. **Data-only documents:** source, bundle, and catalog documents contain no arbitrary executable code.
3. **Trusted execution:** executable behavior comes only from host-approved capability packages.
4. **Exact package pinning:** production bundles require exact package id, version, target, and digest tuples.
5. **Closed capability boundary:** designers can configure only declared props, slots, events, commands, style parts, states, behaviors, resources, and operations.
6. **Read-only bindings:** references never write; external effects occur through named operations.
7. **Immutable revisions:** the content associated with a bundle revision or package digest never changes.
8. **Atomic activation:** a new bundle becomes active only after successful preflight.
9. **Last-known-good safety:** activation failure does not destroy a compatible active revision.
10. **Stable identity:** producers preserve surface and node ids for conceptually unchanged entities.
11. **Schema-enforced boundaries:** data crossing between design and capabilities is validated.
12. **No silent substitution:** runtimes do not guess unknown capabilities or incompatible versions.
13. **Developer implementation ownership:** component internals, third-party integrations, resources, operations, security, and performance remain capability/host concerns.
14. **Authoring honesty:** editors disclose when preview adapters are not the production implementation.

---

# Appendix B — Core Diagnostic Codes

| Code | Class | Meaning |
|---|---|---|
| `SCHEMA_INVALID` | schema | Document failed its normative JSON Schema |
| `UNKNOWN_CORE_FIELD` | schema | Closed core object contains an unknown field |
| `DUPLICATE_SURFACE_ID` | semantic | Surface identity is duplicated or key/id differ |
| `DUPLICATE_NODE_ID` | semantic | Node or behavior identity is duplicated in a surface |
| `ENTRY_NOT_FOUND` | semantic | Entry surface does not exist |
| `UNKNOWN_CAPABILITY` | catalog | Component, behavior, operation, or resource is undeclared |
| `AMBIGUOUS_CAPABILITY` | catalog | Capability id resolves more than once |
| `UNKNOWN_PROP` | catalog | Property is not accepted by the capability schema |
| `PROP_TYPE_MISMATCH` | catalog/runtime | Resolved property is invalid for its schema |
| `UNKNOWN_SLOT` | catalog | Slot is undeclared |
| `SLOT_CARDINALITY` | catalog | Slot item count is invalid |
| `SLOT_CHILD_REJECTED` | catalog | Child capability/category is not accepted |
| `UNKNOWN_EVENT` | catalog | Event handler targets an undeclared event |
| `EVENT_PAYLOAD_INVALID` | runtime | Adapter emitted invalid event payload |
| `UNKNOWN_COMMAND` | catalog | Component command is undeclared |
| `COMMAND_INPUT_INVALID` | runtime | Resolved command input is invalid |
| `BEHAVIOR_ATTACHMENT_INVALID` | catalog | Behavior cannot attach to target component |
| `BEHAVIOR_CONFLICT` | catalog | Attached behaviors have incompatible channels |
| `STATE_WRITE_INVALID` | runtime | State write violates its state schema |
| `REFERENCE_UNRESOLVED` | runtime | Required reference has no value or fallback |
| `PREDICATE_TYPE_MISMATCH` | runtime | Predicate operands are incompatible |
| `REPEAT_ITEMS_INVALID` | runtime | Repeat items are not an array |
| `REPEAT_KEY_INVALID` | runtime | Repeat key is missing, invalid, or duplicated |
| `OPERATION_INPUT_INVALID` | runtime | Operation input violates its schema |
| `OPERATION_OUTPUT_INVALID` | runtime | Operation output violates its schema |
| `OPERATION_DENIED` | runtime | Host policy denied an invocation |
| `RESOURCE_INPUT_INVALID` | runtime | Resource input violates its schema |
| `RESOURCE_OUTPUT_INVALID` | runtime | Resource output violates its schema |
| `ACTION_LIMIT_EXCEEDED` | runtime | Action turn exceeded configured bound |
| `REVISION_MISMATCH` | integrity | Bundle revision does not match canonical content |
| `SOURCE_DIGEST_MISMATCH` | integrity | Bundle source digest does not match source |
| `CATALOG_DIGEST_MISMATCH` | activation | Required package digest differs from installed package |
| `CATALOG_VERSION_UNAVAILABLE` | activation | Exact package tuple cannot be resolved |
| `UNSUPPORTED_PROTOCOL` | activation | Runtime does not support the document version |
| `BUNDLE_LIMIT_EXCEEDED` | activation | Bundle violates resource limits |
| `ADAPTER_FAILURE` | runtime | Capability adapter failed unexpectedly |

Diagnostics should include a JSON Pointer to the failing location when available.

---

# Appendix C — Normative Schema Registry

| Schema | Identifier |
|---|---|
| Design Source Document | `https://schemas.desen.dev/0.1/desen-source.schema.json` |
| Published Design Bundle | `https://schemas.desen.dev/0.1/desen-bundle.schema.json` |
| Capability Catalog | `https://schemas.desen.dev/0.1/desen-catalog.schema.json` |

The files distributed with this draft are the canonical schema text for 0.1.0.

---

# Appendix D — Related Systems and Deliberate Boundaries

This appendix is informative.

DESEN builds on established formats rather than exposing them as separate user workflows:

- JSON Schema supplies structural and capability-value validation.
- Semantic Versioning supplies version rules.
- RFC 8785 supplies canonical JSON for digests.
- DTCG token documents can supply token values behind `$token` references.

DESEN is complementary to, not a replacement for:

- design systems and component libraries;
- application frameworks such as React or native UI frameworks;
- component workshops and documentation tools;
- remote/declarative UI transports;
- API description formats;
- application security and distribution systems; and
- deployment, telemetry, experimentation, and governance platforms.

The distinct responsibility of DESEN is to make **the designer-authored composition and experience behavior directly executable as the production surface**, through real, explicitly contracted application capabilities.

---

# Normative References

1. BCP 14 — RFC 2119 and RFC 8174, requirement levels.
2. JSON Schema, Draft 2020-12.
3. RFC 8785 — JSON Canonicalization Scheme.
4. Semantic Versioning 2.0.0.

# Informative References

1. Design Tokens Community Group Format, Final Community Group Report 2025.10.
2. Apache License 2.0.
