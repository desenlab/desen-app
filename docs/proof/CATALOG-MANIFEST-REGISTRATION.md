# Catalog Manifest Registration Evidence

## Result

`M03-T01` and `M03-T02` pass. `@desen/catalog-sdk` now exposes a framework-neutral JSON authoring
API for component, behavior, operation, and resource contracts plus complete DESEN 0.1.0 Catalog
roots. The Catalog schema remains the only contract authority. Executable renderer adapters,
operation handlers, and resource readers remain outside this package.

Last verified: 2026-07-23.

## Public contract

`registerComponent`, `registerBehavior`, `registerOperation`, and `registerResource` each accept
exactly `id` and the corresponding schema-derived `manifest`. They return detached,
canonical-key-ordered, recursively frozen JSON snapshots without retaining or freezing caller-owned
objects. Readonly `as const` manifests are accepted. Recursive type-level checks reject executable
values, symbol members, augmented arrays, unknown fields in closed manifest objects, and target or
host adapter wrapper fields while preserving schema-authoritative open JSON records. Runtime checks
enforce exact registration wrappers and inert JSON for JavaScript and type-bypassing callers;
complete nested manifest structure and semantics remain the validator's responsibility.

`createCatalogManifest` injects exact `kind: "desen.catalog"` and `desen: "0.1.0"` values, maps
registrations into the authoritative `components`, `behaviors`, `operations`, and `resources`
maps, and rejects duplicate ids within or across categories. All four maps share the protocol's
single exact, case-sensitive capability namespace. The behavior, operation, and resource lists are
optional, preserving the M03-T01 component-only input shape and emitting empty maps for omitted
categories. The caller supplies the exact open `target` and provisional `packageDigest` values.

`PF-024` records the deliberate distinction between manifest registration and trusted executable
binding. The four public registration functions snapshot only inert `{ id, manifest }` data. They
do not install React or native adapters, execute operations, read resources, select endpoints,
choose SDK calls, perform database queries, or carry credentials and authorization mechanisms.

The public runtime entrypoint exports only:

- `createCatalogManifest`
- `registerBehavior`
- `registerComponent`
- `registerOperation`
- `registerResource`

The public type entrypoint exposes 16 JSON-focused types for the four schema-authoritative manifest
families, exact registration inputs, immutable registration outputs, Catalog composition, and
shared inert-JSON projections. Source, emitted declarations, and built JavaScript are audited for
platform imports and types. The package has one runtime dependency: `@desen/protocol`.

## Deterministic and mutation evidence

The evidence executes 17 package tests, 53 compile-time negative cases, and 33 independent root
tests. Contract vectors verify:

- all 12 component, 14 behavior, 9 operation, and 10 resource manifest fields through
  schema-derived types;
- insertion-order variants with byte-identical canonical snapshots while preserving array order;
- 26 successful registrations and 7 successful Catalog compositions across every capability
  category;
- exact value composition, caller graph preservation, detachment, deep freezing, and stored
  canonical property order;
- M03-T01 component-only composition compatibility with empty omitted-category maps;
- same-category and cross-category duplicate rejection, case-sensitive ids, and safe
  `__proto__`/`constructor` map keys;
- rejection of 140 hostile category/value combinations, including recognized
  prototype-laundered built-ins, through every registration category;
- exact Catalog semantic acceptance through the completed G02 validator; and
- exact source, declaration, distribution, test-inventory, command-wiring, and trace ownership.

Independent mutations prove that the verifier rejects substituted Catalog fields, mutable or
noncanonical registration outputs, omitted or substituted category maps, accepted cross-category
collisions, caller descriptor changes, skipped tests, computed/dynamic implementation imports,
undeclared public exports, missing or early-exit quality commands, source-inventory drift, artifact
tampering, and temporary-file replacement during evidence writing.

## Reproducible artifact

```bash
pnpm generate:catalog-manifest-registration
pnpm verify:catalog-manifest-registration
pnpm test:catalog-manifest-registration
pnpm check
```

- Artifact: `docs/proof/artifacts/catalog-sdk-0.1.0-manifest-registration.json`
- Artifact SHA-256: `0823832e8a85a94d9a1f8e4dafa332e6ef53f29e6630a3039c2e895fa62fed00`
- Direct trace rules: `C-018`, `R-013`, `R-071`, `R-072`, `R-084`, `R-089`, `R-090`, `R-092`,
  `R-149`
- Prerequisite gate: `G02`

The writer uses a same-directory exclusive temporary file, syncs it, verifies its open-handle
identity and exact bytes, atomically renames it, and verifies the committed inode and bytes.

## Boundaries and limitations

- Full Catalog structural and semantic validation remains in `@desen/validator`.
- Type and inspector-control derivation belongs to M03-T03.
- Deterministic Web–React package digest construction belongs to M03-T04.
- Reference capabilities and synthetic fixtures belong to M03-T05 through M03-T07.
- Separate trusted-host operation binding belongs to M03-T08.
- Catalog/implementation parity belongs to M03-T09.
- Final immutable artifact tuple proof belongs to M03-T10.
- Executable component and behavior adapter registration remains renderer-owned and deferred to
  M05.
- JavaScript cannot side-effect-freely identify every deliberately prototype-laundered exotic or
  general Proxy. These are excluded authoring inputs; recognized built-ins are rejected, and the
  package documents the remaining observable-shape limitation.
- TypeScript can erase extra-property information in structurally absorbed union members. Catalog
  structural validation remains authoritative for nested manifest shape in that language-level
  edge case.
- The artifact writer assumes its resolved parent directory is not concurrently attacker-owned in
  the final verified rename window.

No `P-*` proof claim changes status at M03-T01 or M03-T02. `G03` remains open until M03-T01 through
M03-T10 are complete.
