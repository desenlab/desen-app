# @desen/validator

## Responsibility

This platform-neutral package validates untrusted data against the exact frozen DESEN 0.1.0
Source, Bundle, and Catalog JSON Schemas. After a root document passes, it also checks every
protocol-defined embedded JSON Schema location as JSON Schema Draft 2020-12.

Structural validation answers: “Does this value have the shape and field-level constraints of a
DESEN 0.1.0 document?” It is the first trust boundary for parsed or programmatically constructed
input. It does not answer whether the identifiers, references, capabilities, revisions, or runtime
values make sense together.

## Explicit non-responsibilities

This task does not implement semantic validation. In particular, it does not:

- prove that `entry` exists or that a map key equals the object's internal `id`;
- detect duplicate identifiers or resolve node, surface, behavior, capability, or catalog
  references;
- enforce the complete Semantic Versioning grammar beyond the frozen schema patterns;
- assign meaning to extensions or resolve catalog namespaces and capability contracts;
- compare Source, Bundle, or package digests;
- apply embedded schemas to state, props, style values, events, commands, operations, or resources;
- render, publish, activate, store, or fetch a document; or
- prove the full protocol prohibition on every possible executable-content representation.

Those checks remain owned by `M02-T07` and later validator, publisher, runtime, and activation
tasks. A structurally valid result is therefore necessary, but not sufficient, for publication or
activation.

## Status

DESEN 0.1.0 structural validation is implemented for Source, Bundle, Catalog, and all 13 generic
embedded-schema locator patterns. The frozen valid conformance triplet contains 44 embedded schemas
across those locations, all of which are exercised by the evidence suite.

The package is private while the wider proof application is under construction. No npm package is
published by these commands.

## Public entry point

The package root exports four validation functions:

| API                                     | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `validateDesenSource(input)`            | Validate unknown input as a DESEN 0.1.0 editable Source    |
| `validateDesenBundle(input)`            | Validate unknown input as a DESEN 0.1.0 published Bundle   |
| `validateDesenCatalog(input)`           | Validate unknown input as a DESEN 0.1.0 capability Catalog |
| `validateDesenStructure(target, input)` | Select `source`, `bundle`, or `catalog` explicitly         |

It also exports the result, diagnostic, target-to-document, and recursive immutable-JSON types used
by those functions. Every public export has TSDoc.

```ts
import { validateDesenSource } from "@desen/validator";

const result = validateDesenSource(JSON.parse(untrustedText) as unknown);

if (!result.valid) {
  for (const diagnostic of result.diagnostics) {
    console.error(diagnostic.code, diagnostic.pointer);
  }
} else {
  // `value` is an independent, recursively frozen DESEN 0.1.0 Source snapshot.
  useValidatedSource(result.value);
}
```

Callers must branch on `valid` before using `value`. A successful result has an empty diagnostics
array. A failed result deliberately has no trusted `value` member.

## Validation flow

Validation has three ordered stages:

1. The input is converted to RFC 8785-compatible canonical JSON, parsed into an independent plain
   data tree, and recursively frozen. Unsupported JavaScript values, accessors, custom prototypes,
   cycles, sparse arrays, invalid Unicode, and non-finite numbers fail before a schema validator
   can inspect caller-controlled state.
2. The snapshot is checked by the generated standalone validator for the selected frozen Source,
   Bundle, or Catalog root.
3. Only after the root passes, embedded schemas are found in deterministic pointer order and checked
   against Draft 2020-12 plus the documented DESEN embedded-schema profile.

The caller's input is neither mutated nor retained. The successful `value` is safe to share as
immutable JSON data; later stages must still perform their own semantic checks before treating it
as publishable or activatable.

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

Diagnostics are immutable, JSON-serializable, sorted, and de-duplicated independently of Ajv's
internal error order. Their `code` and RFC 6901 `pointer` are the machine contract. Human-readable
`message` text is safe for display but is not a compatibility key. Pointer construction appends
missing or offending property names and escapes `~` and `/` exactly.

Malformed programmatic input is reported as `SCHEMA_INVALID` at the document root. Passing an
unsupported JavaScript target string directly to `validateDesenStructure` is API misuse and throws
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

This establishes that validation itself does not execute document content. It does not claim that
M02-T06 alone recognizes every prohibited executable-looking string or extension shape; complete
executable-content conformance remains a later cross-cutting proof.

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
pnpm check
```

The explicit generation command is the writer. Verification regenerates the standalone module and
evidence in memory, then rejects tool-version drift, schema-byte drift, unexpected code-loading
constructs, non-deterministic bytes, a changed tracked artifact, or unsafe output paths. The test
command covers public behavior, the frozen corpus, all locator families, scope boundaries,
mutation resistance, and built-distribution loading.
