# DESEN Roadmap

This roadmap is implementation-first. A protocol feature should enter the core only after at least one editor and one runtime have demonstrated it with conformance tests.

## North-star outcome

A product designer creates a production sign-in or account-management flow with the application's real components, states, bindings, and operations. The design is published as a bundle and activated by the application without a developer recreating the surface.

## Phase 0 — Freeze the contract (0.1.x)

Deliverables:

- Working Draft specification;
- source, bundle, and catalog schemas;
- sign-in, map, and sortable-list examples;
- starter semantic validator;
- conformance vectors;
- public issue template and contribution process.

Exit criteria:

- all package examples validate;
- digests reproduce deterministically;
- every normative term maps to a schema or runtime rule;
- no telemetry, governance, or multimodal scope leaks into the core.

## Phase 1 — Vertical reference implementation

Build one end-to-end Web–React slice:

- package registry for 5–8 real components;
- one resource and one operation;
- editor component panel and property inspector;
- named slots and drag composition;
- Design Mode and Run Mode;
- source persistence;
- publisher producing an immutable bundle;
- production runtime rendering the same bundle;
- atomic activation and last-known-good cache.

Reference surface:

- email/password form;
- validation presentation;
- loading, failure, and success states;
- successful navigation.

Exit criterion: no manual React implementation of the managed surface.

## Phase 2 — Capability extensibility proof

Add:

- one complex component: map or data grid;
- one behavior: sortable list or Kanban;
- style-part editor;
- visual-state/scenario selector;
- component commands;
- authoring fixtures;
- capability compatibility diagnostics.

Exit criterion: integrating the capability requires developer work once; creating a second surface with it requires no new screen implementation.

## Phase 3 — Production hardening

Add:

- signed publication profile;
- immutable package distribution format;
- performance budgets and profiler;
- accessibility diagnostics;
- error boundaries and runtime diagnostics;
- source/bundle debugger with node-id traceability;
- server rendering or pre-render support;
- automated visual and behavioral regression tests;
- package migration tooling.

Exit criterion: a real product team can run a limited production pilot.

## Phase 4 — Interoperability

Add a second independent implementation for at least two conformance targets:

- a second editor or source producer;
- a second publisher or validator;
- a second runtime target, likely native mobile or another web framework.

Exit criterion: one source/bundle/capability contract works across independently built implementations without private coordination.

## Phase 5 — Protocol stabilization (1.0)

Requirements:

- at least two production pilots;
- documented compatibility and migration evidence;
- complete conformance suite;
- security review;
- package/signature profile;
- stable media-type and registry strategy;
- resolved 0.2 open questions or explicit deferral;
- no known ambiguity in digest or runtime semantics.

## Explicitly deferred

Do not pull these into the core before the vertical slice is successful:

- telemetry and experimentation;
- deployment governance and approval workflows;
- collaboration and multiplayer;
- plugin marketplace;
- voice and spatial modalities;
- general expression language;
- arbitrary existing-code round trip;
- full vector design tooling;
- AI-generated capability implementations.
