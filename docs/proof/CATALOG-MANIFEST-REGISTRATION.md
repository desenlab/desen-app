# Catalog Manifest Registration and Derivation Evidence

## Result

`M03-T01` through `M03-T03` pass. `@desen/catalog-sdk` now exposes a framework-neutral JSON
authoring API for all four capability contracts and complete DESEN 0.1.0 Catalog roots, then
derives component prop types and inspector metadata from the same literal `propsSchema`. The
Catalog schema remains the only contract authority. Executable renderer adapters, concrete editor
widgets, operation handlers, and resource readers remain outside this package.

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
The separate M03-T04 Web–React profile now consumes such a provisional Catalog plus target
artifact bytes to calculate and verify a package digest; that target-specific byte API remains
outside this framework-neutral evidence slice.

`PF-024` records the deliberate distinction between manifest registration and trusted executable
binding. The four public registration functions snapshot only inert `{ id, manifest }` data. They
do not install React or native adapters, execute operations, read resources, select endpoints,
choose SDK calls, perform database queries, or carry credentials and authorization mechanisms.

`ComponentPropsOf<Registration>` projects readonly component props directly from the registered
literal schema. Exact `const` and `enum` choices, primitive types, closed properties, required
names, homogeneous arrays, and safe additional-property forms are retained. Widened, complex,
unsupported, or over-depth schemas fall back to the JSON-only `JsonValue`; `false` becomes
`never`. This is a compile-time convenience, not runtime validation.

`deriveComponentInspectorControls` accepts the immutable result of `registerComponent` and returns
a second detached, recursively frozen JSON plan. It preserves the complete `propsSchema` and
authoring/scenario contract, derives deterministic RFC 6901 pointers, and emits primitive, enum,
closed-object group, or explicit `structured-json` descriptors. Integer-like property names use
the same canonical UTF-16 order as the protocol canonicalizer.

`PF-025` records that DESEN 0.1.0 defines no `authoring.controls` vocabulary. Top-level hints are
therefore copied only as opaque sidecars. They cannot create properties or change kind,
requiredness, or enum options. Unsupported and unknown schema features remain visible through an
honest fallback; a plan deeper than 16 control levels or wider than 512 controls becomes one root
fallback rather than a partial result.

The public runtime entrypoint exports only:

- `createCatalogManifest`
- `deriveComponentInspectorControls`
- `registerBehavior`
- `registerComponent`
- `registerOperation`
- `registerResource`

The public type entrypoint exposes 23 JSON-focused types, including `JsonValue`,
`JsonSchemaValue`, `ComponentPropsOf`, and the inspector plan/control unions. Source, emitted
declarations, and built JavaScript are audited for platform imports and types. The package has one
runtime dependency: `@desen/protocol`.

## Deterministic and mutation evidence

The evidence executes 33 package tests, 71 compile-time negative cases, and 43 independent root
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
- all 10 authoring and 5 scenario fields, 7 control kinds, 24 explicit fallback cases, 35 hostile
  inspector values, and accessor rejection without getter invocation;
- schema authority under misleading and nonexistent hints, canonical numeric-looking property
  order, whole-object enum visibility, honest undeclared-required fallbacks, pointer escaping,
  caller ownership, deep freezing, and exact 16-level/512-control limits;
- 34 direct constraints from `SC-033` and `SC-056`, plus direct `C-006`, `R-084`, `R-087`, and
  `R-096` ownership alongside the cumulative registration traces;
- exact Catalog semantic acceptance through the completed G02 validator; and
- exact source, declaration, distribution, test-inventory, command-wiring, and trace ownership.

Independent mutations prove that the verifier rejects substituted Catalog fields, mutable or
noncanonical registration outputs, omitted or substituted category maps, accepted cross-category
collisions, caller descriptor changes, skipped tests, computed/dynamic implementation imports,
undeclared public exports, missing or early-exit quality commands, source-inventory drift, artifact
tampering, temporary-file replacement during evidence writing, schema-authority drift, omitted
fallbacks, mutable or aliased plans, pointer substitution, partial over-limit output, hostile input
acceptance, schema-family drift, and skipped or fabricated M03-T03 tests.

## Reproducible artifact

```bash
pnpm generate:catalog-manifest-registration
pnpm verify:catalog-manifest-registration
pnpm test:catalog-manifest-registration
pnpm check
```

- Artifact: `docs/proof/artifacts/catalog-sdk-0.1.0-manifest-registration.json`
- Artifact SHA-256: `d7dccc41ad65f3bd7b3f5da0af336c9bf67e8dcf124af55a28474c3f3fd8a829`
- Direct schema families: `SC-033` (1 constraint), `SC-056` (33 constraints)
- Direct trace rules: `C-006`, `C-018`, `R-013`, `R-071`, `R-072`, `R-084`, `R-087`, `R-089`,
  `R-090`, `R-092`, `R-096`, `R-149`
- Prerequisite gate: `G02`

The writer uses a same-directory exclusive temporary file, syncs it, verifies its open-handle
identity and exact bytes, atomically renames it, and verifies the committed inode and bytes.

## Boundaries and limitations

- Full Catalog structural and semantic validation remains in `@desen/validator`.
- Deterministic Web–React package digest construction is separately implemented and evidenced by
  M03-T04 in `@desen/reference-catalog-web`; it does not change this Catalog SDK API.
- Reference capabilities and synthetic fixtures belong to M03-T05 through M03-T07.
- Separate trusted-host operation binding belongs to M03-T08.
- Catalog/implementation parity belongs to M03-T09.
- Final immutable artifact tuple proof belongs to M03-T10.
- Executable component and behavior adapter registration remains renderer-owned and deferred to
  M05.
- Concrete widgets, binding editors, validation messages, and hint interpretation remain assigned
  to M09.
- JavaScript cannot side-effect-freely identify every deliberately prototype-laundered exotic or
  general Proxy. These are excluded authoring inputs; recognized built-ins are rejected, and the
  package documents the remaining observable-shape limitation.
- TypeScript can erase extra-property information in structurally absorbed union members. Catalog
  structural validation remains authoritative for nested manifest shape in that language-level
  edge case.
- The artifact writer assumes its resolved parent directory is not concurrently attacker-owned in
  the final verified rename window.

No `P-*` proof claim changes status at M03-T01 through M03-T03. `G03` remains open until M03-T01
through M03-T10 are complete.
