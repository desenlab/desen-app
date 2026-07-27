# Runtime React Adapter Registry Proof

## Result

M05-T01 proves the first web-target adapter boundary for DESEN 0.1.0. A host statically registers
trusted React component and behavior implementations. A bundle may select only an exact capability
identifier already present in that finite registry.

The registry handle is factory-authenticated and opaque. Its immutable public snapshot contains
only sorted capability identifiers. Registration never executes or exposes an adapter callback.
Live command attachment is represented by an opaque owner-bound handle and controlled detachment
result; no raw detach callback is exposed through the public adapter contract.

## Complete render preflight

`renderRuntimeReactSurface` applies the same exact registry lookup to ordinary surface roots,
descendants, and behaviors. It validates the complete finite plan before React executes any
adapter. Unknown capabilities, duplicate runtime identities, malformed own-data boundaries,
forged handles, and node/depth/slot/behavior limit crossings return explicit callback-free
failures with no placeholder element.

All JSON delivered to an adapter is captured into a detached, recursively frozen snapshot during
preflight. Aggregate JSON-depth, JSON-occurrence, string, node, depth, slot-name/entry, and behavior
budgets bound the work before React can execute an adapter. Revoked proxies and hostile accessors
become controlled failures rather than escaping exceptions.

The executable proof imports `packages/runtime-react/dist/index.js` and renders a representative
root, descendants, and behavior with React's server renderer. It also injects hostile accessors,
proxies, altered runtime exports, eager factories, fallback renderers, source imports, package
boundaries, declaration drift, test-inventory drift, prerequisite tampering, documentation-pin
movement, symlink destinations, and temporary-file tampering.

## Authority boundary

- Production source imports only React, public `@desen/runtime-core` types, and its own registry
  module.
- No DOM node, selector, native event, component instance, remote module name, dynamic import,
  executable loader, application code, validator, or reference catalog crosses the adapter API.
- Adapter props contain stable diagnostic identity, resolved semantic JSON, named React slots,
  inert behavior descriptions, and the least-authority interaction seam.
- The package exports only its root entry; React is a peer and runtime-core is its sole production
  dependency.

## Evidence artifact

`docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json`
`sha256:b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42`

## Nonclaims

This proof does not claim receiving-schema validation, capability-driven visual-state resolution,
live event or command routing, behavior lifecycle, DOM reconciliation, a production error
boundary, or a non-React target. Those remain assigned to later M05 tasks.
