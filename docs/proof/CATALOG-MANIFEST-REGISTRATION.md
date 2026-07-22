# Catalog Manifest Registration Evidence

## Result

`M03-T01` passes. `@desen/catalog-sdk` now exposes a framework-neutral JSON authoring API for
component contracts and complete DESEN 0.1.0 Catalog roots. The Catalog schema remains the only
contract authority, and executable renderer adapters remain outside this package.

Last verified: 2026-07-22.

## Public contract

`registerComponent` accepts exactly `id` and `manifest`. It returns a detached, canonical-key-
ordered, recursively frozen JSON snapshot without retaining or freezing caller-owned objects.
Readonly `as const` manifests are accepted. Type-level checks reject executable values, symbol
members, augmented arrays, unknown component fields, and target-adapter wrapper fields; runtime
checks preserve the boundary for JavaScript and type-bypassing callers.

`createCatalogManifest` injects exact `kind: "desen.catalog"` and `desen: "0.1.0"` values, maps
component ids to their authoritative manifests, rejects distinct registrations with duplicate ids,
and emits empty `behaviors`, `operations`, and `resources` maps until M03-T02. The caller supplies
the exact open `target` and provisional `packageDigest` values.

The public runtime entrypoint exports only:

- `registerComponent`
- `createCatalogManifest`

The public type entrypoint exposes seven JSON-focused types. Source, emitted declarations, and
built JavaScript are audited for platform imports and types. The package has one runtime
dependency: `@desen/protocol`.

## Deterministic and mutation evidence

The evidence executes 8 package tests, 21 compile-time negative cases, and 29 independent root
tests. Contract vectors verify:

- all 12 component-manifest fields through the schema-derived type;
- two insertion-order variants with byte-identical canonical snapshots;
- 8 successful component registrations and 3 successful Catalog compositions;
- exact value composition, caller graph preservation, detachment, deep freezing, and stored
  canonical property order for all 11 successful outputs;
- distinct-object duplicate rejection, case-sensitive ids, and safe `__proto__`/`constructor`
  map keys;
- rejection of 35 hostile JSON values, including recognized prototype-laundered built-ins;
- exact Catalog semantic acceptance through the completed G02 validator; and
- exact source, declaration, distribution, test-inventory, command-wiring, and trace ownership.

Independent mutations prove that the verifier rejects substituted Catalog fields, mutable or
noncanonical outputs, caller descriptor changes, skipped tests, computed/dynamic implementation
imports, undeclared public exports, missing or early-exit quality commands, source-inventory drift,
artifact tampering, and temporary-file replacement during evidence writing.

## Reproducible artifact

```bash
pnpm generate:catalog-manifest-registration
pnpm verify:catalog-manifest-registration
pnpm test:catalog-manifest-registration
pnpm check
```

- Artifact: `docs/proof/artifacts/catalog-sdk-0.1.0-manifest-registration.json`
- Artifact SHA-256: `2f97bdd57c26e8922836464d3415b55b10eac034c359e8363a8ed68d1002d030`
- Direct trace rules: `R-013`, `R-084`
- Prerequisite gate: `G02`

The writer uses a same-directory exclusive temporary file, syncs it, verifies its open-handle
identity and exact bytes, atomically renames it, and verifies the committed inode and bytes.

## Boundaries and limitations

- Full Catalog structural and semantic validation remains in `@desen/validator`.
- Behavior, operation, and resource registration belongs to M03-T02.
- Type and inspector-control derivation belongs to M03-T03.
- Deterministic Web–React package digest construction belongs to M03-T04.
- Renderer implementation parity and final immutable artifact proof belong to M03-T09/M03-T10.
- JavaScript cannot side-effect-freely identify every deliberately prototype-laundered exotic or
  general Proxy. These are excluded authoring inputs; recognized built-ins are rejected, and the
  package documents the remaining observable-shape limitation.
- TypeScript can erase extra-property information in structurally absorbed union members. Runtime
  exact-key checks remain authoritative for that language-level edge case.
- The artifact writer assumes its resolved parent directory is not concurrently attacker-owned in
  the final verified rename window.

No `P-*` proof claim changes status at M03-T01. `G03` remains open until M03-T01 through M03-T10 are
complete.
