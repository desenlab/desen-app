# ADR 0007: Inert parity metadata before runtime adapter registration

- Status: Accepted
- Date: 2026-07-24

## Context

M03 must prove that the selected `web-react` Catalog contracts have real implementations and that
their declared props, slots, events, commands, style parts, visual states, authoring fidelity, and
delegated bindings are complete. The generic React registry, render-plan materialization, event
dispatch, command dispatch, and resolved style application belong to M05.

Moving a React component map or lookup API into M03 would make the Catalog package a premature
runtime renderer. Keeping all parity knowledge only in proof scripts would make the package tuple
omit the public contract that later consumers need to audit.

## Decision

Each target capability package publishes recursively frozen, JSON-only parity metadata from a
dedicated subpath. The metadata:

- derives public surface names from the authoritative registered manifests;
- names statically reviewed package exports without carrying module paths or executable values;
- records whether the authoring role is the same, equivalent, or approximate;
- documents semantic style-part meaning without exposing selectors or private structure; and
- records explicit operation/resource delegation without embedding host implementations.

Independent evidence resolves the named exports through static imports and exercises the real
component-side primitives. The metadata is not a registry and no DESEN document can use it to
select code. `runtime-react` remains the owner of executable registration and dispatch in M05.

## Consequences

G03 can prove Catalog-to-implementation completeness and commit the metadata into an immutable
package tuple without claiming that runtime rendering exists. Event, command, style, and visual
state wiring remain open until their M04/M05 owners execute them generically.

The same separation applies to future native targets. Each target publishes its own parity
metadata and later binds trusted platform implementations through its own renderer.
