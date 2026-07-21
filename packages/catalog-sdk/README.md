# @desen/catalog-sdk

## Responsibility

Framework-neutral helpers for authoring and checking DESEN Capability Catalog documents. This
package owns manifest builders, schema-derived contract types, deterministic manifest checks, and
parity rules between a declared catalog and a target registry supplied by another package.

The JSON catalog remains authoritative. TypeScript helpers may derive or verify that contract but
cannot replace it with a second schema system.

## Public boundary

`catalog-sdk` may depend only on `protocol`. Its public and emitted declaration files must remain
JSON-serializable and must not mention React, React Native, DOM, browser, Node, or application
types.

Executable adapter registration is target-owned:

- `runtime-react` defines React component and behavior adapter registries;
- a future native renderer defines its own registry; and
- a target catalog package combines its framework-neutral manifest with the applicable registry.

This package may compare registry keys and declared contracts through generic or opaque values,
but it never accepts `React.ComponentType`, `ReactNode`, native view classes, or executable values
inside a catalog document.

## Explicit non-responsibilities

- Product-specific components or adapters
- React or native renderer registration
- Editor UI
- Package discovery or remote executable-code loading
- Runtime execution semantics

## Status

Scaffolded and private. Functional APIs will be added only by their tracked implementation tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Target: platform-neutral

## Quality

Use the root workspace quality gate and boundary fixture audit:

```bash
pnpm check
node scripts/verify-boundary-fixtures.mjs
```
