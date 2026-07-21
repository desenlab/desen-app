# @desen/validator

## Responsibility

This platform-neutral package validates untrusted data against the exact frozen DESEN 0.1.0
Source, Bundle, and Catalog JSON Schemas. After a root document passes, it also checks every
protocol-defined embedded JSON Schema location as JSON Schema Draft 2020-12 and can apply the
M02-T07 semantic foundation against a trusted resolved-catalog set.

Structural validation answers: “Does this value have the shape and field-level constraints of a
DESEN 0.1.0 document?” It is the first trust boundary for parsed or programmatically constructed
input. Semantic-foundation validation then answers whether exact catalog requirements, entry,
identities, and category-aware capability references make sense together. It intentionally stops
before capability contracts, runtime values, publication, and activation.

## Explicit non-responsibilities

The semantic foundation does not:

- validate component props, slots, style parts, or visual states;
- validate event/command contracts, behavior attachment/conflicts, or payloads;
- resolve state, predicate, repeat, alias, or ValueSpec binding semantics;
- validate resource/operation inputs, action behavior, navigation, refresh, or command targets;
- compare Source, Bundle, or package digests;
- acquire, install, or trust catalog packages from `location` or any other network/filesystem input;
- render, publish, activate, store, or fetch a document; or
- prove the full protocol prohibition on every possible executable-content representation.

Those checks remain owned by `M02-T08` and later validator, publisher, runtime, and activation
tasks. A semantic-foundation success is still not sufficient for publication or activation.

## Status

DESEN 0.1.0 structural validation is implemented for Source, Bundle, Catalog, and all 13 generic
embedded-schema locator patterns. The frozen valid conformance triplet contains 44 embedded schemas
across those locations, all of which are exercised by the evidence suite.

The semantic foundation implements strict SemVer, exact catalog requirements, catalog and
surface-local identity namespaces, entry validation, extension opacity, and exact capability
existence for component, behavior, resource, and operation categories. It passes the frozen valid
triplet, all five examples, the two official M02-T07 invalid vectors, and explicit later-task scope
fences.

The package is private while the wider proof application is under construction. No npm package is
published by these commands.

## Public entry point

The package root retains four structural functions:

| API                                     | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `validateDesenSource(input)`            | Validate unknown input as a DESEN 0.1.0 editable Source    |
| `validateDesenBundle(input)`            | Validate unknown input as a DESEN 0.1.0 published Bundle   |
| `validateDesenCatalog(input)`           | Validate unknown input as a DESEN 0.1.0 capability Catalog |
| `validateDesenStructure(target, input)` | Select `source`, `bundle`, or `catalog` explicitly         |

It also exports the semantic-foundation API:

| API                                                           | Purpose                                            |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `isExactSemanticVersion(value)`                               | Guard exact Semantic Versioning 2.0.0 syntax       |
| `validateDesenCatalogSet(input)`                              | Build a trusted immutable resolved-catalog set     |
| `validateDesenCatalogSemantics(input)`                        | Validate Catalog version and namespace semantics   |
| `validateDesenSourceSemantics(input, catalogSet)`             | Validate Source identity and declared capabilities |
| `validateDesenBundleSemantics(input, catalogSet)`             | Validate Bundle identity and exact requirements    |
| `validateDesenSemanticFoundation(target, input, catalogSet?)` | Select the semantic target explicitly              |

It also exports the result, diagnostic, target-to-document, and recursive immutable-JSON types used
by those functions. Every public export has TSDoc.

```ts
import { validateDesenCatalogSet, validateDesenSourceSemantics } from "@desen/validator";

const catalogs = validateDesenCatalogSet(JSON.parse(untrustedCatalogsText) as unknown);
if (!catalogs.valid) {
  handleDiagnostics(catalogs.diagnostics);
  throw new Error("Catalog validation failed.");
}

const result = validateDesenSourceSemantics(
  JSON.parse(untrustedSourceText) as unknown,
  catalogs.value,
);

if (!result.valid) {
  for (const diagnostic of result.diagnostics) {
    console.error(diagnostic.code, diagnostic.pointer);
  }
} else {
  // `value` passed structural checks and the M02-T07 semantic foundation.
  useValidatedSource(result.value);
}
```

Callers must branch on `valid` before using `value`. A successful result has an empty diagnostics
array. A failed result deliberately has no trusted `value` member.

## Validation flow

Validation has ordered structural and semantic stages:

1. The input is converted to RFC 8785-compatible canonical JSON, parsed into an independent plain
   data tree, and recursively frozen. Unsupported JavaScript values, accessors, custom prototypes,
   cycles, sparse arrays, invalid Unicode, and non-finite numbers fail before a schema validator
   can inspect caller-controlled state.
2. The snapshot is checked by the generated standalone validator for the selected frozen Source,
   Bundle, or Catalog root.
3. Only after the root passes, embedded schemas are found in deterministic pointer order and checked
   against Draft 2020-12 plus the documented DESEN embedded-schema profile.
4. Catalog-set members are independently validated, recursively frozen, and admitted to a private
   runtime trust registry only when their strict versions and set-wide capability namespace pass.
5. Source and Bundle requirements match literal catalog `id`, `version`, and applicable `target`
   strings. Additional catalogs may share the trusted pool but do not authorize undeclared
   capabilities.
6. Entry, surface, node, and behavior identities and component/behavior/resource/operation
   capability references are traversed deterministically with explicit work stacks.

The caller's input is neither mutated nor retained. The successful `value` is safe to share as
immutable JSON data; later contract and integrity stages must still pass before treating it as
publishable or activatable.

## Embedded-schema coverage

The validator recognizes these 13 protocol-defined generic locations. `*` means every member of
the surrounding map, not one hardcoded name.

| Document      | Embedded-schema locator                       |
| ------------- | --------------------------------------------- |
| Source/Bundle | `/surfaces/*/state/*/schema`                  |
| Catalog       | `/components/*/propsSchema`                   |
| Catalog       | `/components/*/events/*/payloadSchema`        |
| Catalog       | `/components/*/commands/*/inputSchema`        |
| Catalog       | `/components/*/styleParts/*/propertiesSchema` |
| Catalog       | `/behaviors/*/propsSchema`                    |
| Catalog       | `/behaviors/*/events/*/payloadSchema`         |
| Catalog       | `/behaviors/*/commands/*/inputSchema`         |
| Catalog       | `/behaviors/*/styleParts/*/propertiesSchema`  |
| Catalog       | `/operations/*/inputSchema`                   |
| Catalog       | `/operations/*/outputSchema`                  |
| Catalog       | `/resources/*/inputSchema`                    |
| Catalog       | `/resources/*/outputSchema`                   |

An omitted embedded `$schema` inherits Draft 2020-12 from the DESEN 0.1.0 containing contract. The
exact Draft 2020-12 URI is accepted when present. An explicitly different dialect, an invalid
regular expression, a malformed RFC 3986 identifier, or a non-local `$ref`/`$dynamicRef` is
rejected. References beginning with `#` remain document-local; no schema resource is fetched from
a network or filesystem. Unknown annotation keywords remain legal JSON Schema and receive no
invented DESEN meaning.

This stage validates the embedded schemas themselves. It does not yet validate state or capability
data _against_ those schemas.

## Diagnostic contract

Structural failures use only these protocol core codes:

| Code                   | Structural meaning                                                      |
| ---------------------- | ----------------------------------------------------------------------- |
| `SCHEMA_INVALID`       | Input, root structure, or an embedded schema violates its contract      |
| `UNKNOWN_CORE_FIELD`   | A field occurs in a frozen core object closed by `additionalProperties` |
| `UNSUPPORTED_PROTOCOL` | A string `desen` value explicitly selects a version other than `0.1.0`  |

The semantic foundation emits the five protocol-owned codes
`DUPLICATE_SURFACE_ID`, `DUPLICATE_NODE_ID`, `ENTRY_NOT_FOUND`, `UNKNOWN_CAPABILITY`, and
`AMBIGUOUS_CAPABILITY`. `PF-009` records that Appendix B has no matching core codes for strict
SemVer or exact requirement failures, so this implementation additionally exports and emits:

| Namespaced code                                    | Meaning                                      |
| -------------------------------------------------- | -------------------------------------------- |
| `run.desen.validator/INVALID_SEMVER`               | A required exact version is not SemVer 2.0.0 |
| `run.desen.validator/CATALOG_REQUIREMENT_MISMATCH` | A requirement does not resolve exactly once  |

Namespaced diagnostics deliberately have no invented Appendix B classification.

Diagnostics are immutable, JSON-serializable, sorted, and de-duplicated independently of Ajv's
internal error order. Their `code` and RFC 6901 `pointer` are the machine contract. Human-readable
`message` text is safe for display but is not a compatibility key. Pointer construction appends
missing or offending property names and escapes `~` and `/` exactly.

Malformed programmatic input is reported as `SCHEMA_INVALID` at the document root. Passing an
unsupported JavaScript target string directly to a generic dispatcher is API misuse and throws
`TypeError`; document-validation failures are returned as data.

## Generated-validator and security boundary

The three exact frozen root schemas and the Draft 2020-12 meta-schema are compiled ahead of time by
pinned Ajv 8.20.0 into one tracked ESM module. Generation is deterministic and audits the schema
identities, input hashes, four expected exports, two reviewed local helper bindings, and the single
relative ESM import that supplies those helpers.

The shipped validation path does not compile document-supplied schemas and contains no `eval`,
`new Function`, CommonJS `require`, dynamic import, absolute workspace path, network access, or
filesystem access. Development-time generation uses Node, but the runtime API does not depend on
Node, React, DOM, CSS, browser globals, or application code.

The semantic layer uses own-property traversal, `Map`, `Set`, private `WeakMap`/`WeakSet` trust
metadata, and fixed messages that never echo caller values. It does not inspect extension payloads
or use Source `location` for I/O. This establishes that validation itself does not execute document
content; complete executable-content conformance remains a later cross-cutting proof.

## Protocol, target, and dependencies

- Protocol baseline: DESEN 0.1.0 only
- Runtime target: platform-neutral
- First product/runtime target: `web-react`
- Runtime dependencies: `@desen/protocol`; generated validation uses two reviewed local helpers
- Build-time generator: pinned Ajv 8.20.0 standalone generation and root-pinned Prettier

The web application is the first proof target, but this validator contains no Web or React
behavior. A future iOS, Android, or other native runtime can consume the same validated protocol
snapshot and add its own target catalog and adapter layer.

## Reproducible quality commands

```bash
pnpm generate:protocol-structural-validation
pnpm verify:protocol-structural-validation
pnpm test:protocol-structural-validation
pnpm generate:protocol-semantic-foundation
pnpm verify:protocol-semantic-foundation
pnpm test:protocol-semantic-foundation
pnpm check
```

The explicit generation commands are the only writers. Verification regenerates code or evidence
in memory, then rejects tool-version drift, schema-byte drift, trace ownership, SemVer goldens,
unexpected code-loading constructs, non-deterministic bytes, changed tracked artifacts, or unsafe
output paths. Tests cover public behavior, frozen vectors and examples, locator families, identity
and catalog boundaries, scope fences, hostile inputs, mutation resistance, and built-distribution
loading.
