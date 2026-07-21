# @desen/protocol

## Responsibility

This platform-neutral package owns the frozen DESEN protocol inputs and the TypeScript structures
derived from them. It also owns the universal RFC 8785 canonicalization and SHA-256 primitives
used by later validation, publication, and activation packages. The complete upstream 0.1.0 Git
tree remains vendored as opaque input under `upstream/0.1.0/snapshot/` and protected by byte-level
integrity tests.

## Explicit non-responsibilities

No editor, runtime, React, DOM, network, application behavior, or executable adapter code belongs
here. The generated TypeScript structures are not runtime validators: untrusted JSON must remain
`unknown` until the future validator package accepts it. The digest helpers do not validate DESEN
document structure, compare stored digests, emit diagnostics, or define capability-package archive
hashing.

## Status

The exact upstream snapshot, integrity gate, complete protocol traceability inventory, and
schema-derived TypeScript root types are implemented. RFC 8785 canonical JSON, platform-neutral
SHA-256, DESEN digest formatting, Source projection, and Bundle revision projection are also
implemented. Runtime validation and stable diagnostics remain assigned to later tasks.

## Public entry point

The package root exports three documented types:

- `DesenSource` — editable DESEN 0.1.0 source documents;
- `DesenBundle` — published DESEN 0.1.0 bundles; and
- `DesenCatalog` — DESEN 0.1.0 capability catalogs.

Generated helper declarations remain internal so a generator detail does not accidentally become
public API. The three public aliases recursively narrow unconstrained schema positions to
JSON-compatible TypeScript values, rejecting functions, `undefined`, `bigint`, and symbols.

It also exports these one-shot runtime functions:

- `canonicalizeJson` and `canonicalizeJsonBytes` — RFC 8785 text and UTF-8 bytes;
- `sha256Bytes`, `sha256Hex`, and `sha256Digest` — universal SHA-256 output forms;
- `digestCanonicalJson` — canonicalize and hash any inert JSON data tree;
- `calculateDesenSourceDigest` — omit only top-level `authoring`, then canonicalize and hash;
- `calculateDesenBundleRevision` — omit only top-level `revision` and `publication`, then hash; and
- `isSha256Digest` — check the exact `sha256:<64 lowercase hex>` lexical form.

```ts
import { calculateDesenSourceDigest, type DesenSource } from "@desen/protocol";

const source = {
  kind: "desen.source",
  desen: "0.1.0",
  id: "sign-in",
  catalogs: [{ id: "desen.core", version: "1.0.0" }],
  entry: "main",
  surfaces: {
    main: {
      id: "main",
      state: {},
      resources: {},
      root: { id: "root", use: "desen.core/Stack" },
    },
  },
} satisfies DesenSource;

const sourceDigest = calculateDesenSourceDigest(source);
```

The `satisfies` check helps while authoring trusted TypeScript. It must not be used as evidence that
parsed JSON is valid. Likewise, obtaining `sourceDigest` proves only that the supplied data can be
canonically hashed; it does not prove that the Source is structurally or semantically valid.

## Canonicalization and digest contract

Canonicalization recursively sorts object properties by raw UTF-16 code units, preserves array
order and Unicode spelling, emits no whitespace, uses ECMAScript finite-number serialization, and
encodes the result as UTF-8. Lone surrogates, non-finite numbers, sparse or extended arrays,
cycles, accessors, serialization hooks, custom object prototypes, and values outside the JSON data
model are rejected rather than silently rewritten.

SHA-256 is implemented with ECMAScript numeric and typed-array operations only. Production package
code does not use Node crypto, Web Crypto, `Buffer`, `TextEncoder`, React, DOM, or browser globals.
The digest functions do not mutate or retain their inputs.

DESEN 0.1.0 defines two document projections here:

- Source digest excludes only the top-level `authoring` member. `extensions` and nested members
  named `authoring` remain semantic.
- Bundle revision excludes only the top-level `revision` and `publication` members. All other
  content, including `sourceDigest` and `extensions`, remains semantic.

Raw Catalog canonicalization is available through the generic API, but its result is **not** a
capability `packageDigest`. The package archive procedure includes adapter artifacts and remains a
separate M03 responsibility.

## Generation contract

Three tracked declaration files under `src/generated/0.1.0/` are regenerated from the three full,
frozen JSON Schema roots. The build-only generator and formatter versions, their options, input
hashes, output hashes, and reviewed projection rules are recorded in
`docs/proof/artifacts/protocol-0.1.0-types.json`.

Generation uses an in-memory clone and never changes frozen bytes. Two reviewed adjustments retain
useful TypeScript structure without pretending to be runtime validation:

- the shared object shape is distributed into `anyOf(required ...)` branches for Variant and
  behavior attachment unions; and
- predicate `if/then` argument-count refinements are left to semantic validation so the base
  predicate remains a closed TypeScript interface.

TypeScript cannot express every JSON Schema rule. Patterns, formats, uniqueness, property-name
rules, most cardinalities, `oneOf` exclusivity, and some `additionalProperties` interactions remain
validator responsibilities. TypeScript's `number` also cannot distinguish finite JSON numbers from
`NaN` or infinity, so runtime validation is still required.

## Failure behavior

The read-only verifier rejects a changed schema identity, unexpected projection shape,
non-deterministic generation, missing or extra generated file, symlink, one-byte output drift, tool
version drift, or stale evidence artifact. The writer also rejects symlinked destination directory
chains before writing. It never repairs files automatically. The explicit generation command is
the only supported writer.

Canonicalization functions throw `TypeError` for data that cannot be represented as the accepted
RFC 8785/I-JSON value tree. SHA-256 functions throw `TypeError` when a JavaScript caller supplies
something other than a genuine `Uint8Array`. These are primitive API failures, not the stable DESEN
diagnostic model scheduled for M02-T05. Because this API accepts an already-created value tree, it
cannot recover duplicate property names that a permissive parser discarded; parsing and validation
must enforce I-JSON before canonicalization.

## Protocol, target, and dependencies

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral
- Package runtime dependencies: none
- Build-only generator: root-pinned `json-schema-to-typescript` 15.0.4
- Test-only runner: package-pinned `vitest` 4.1.10

No Node, React, DOM, CSS, or browser API enters this package's public surface. Future Web, iOS, and
Android adapters may consume the same document types while using target-specific catalogs.

## Quality commands

```bash
pnpm generate:protocol-types
pnpm verify:protocol-types
pnpm test:protocol-types
pnpm generate:protocol-canonicalization
pnpm verify:protocol-canonicalization
pnpm test:protocol-canonicalization
pnpm check
```

`generate:protocol-types` intentionally writes tracked declarations and evidence. The verifier and
tests are read-only. `generate:protocol-canonicalization` writes only its deterministic evidence
artifact; its verifier and tests are read-only. Snapshot and traceability checks remain available
as `pnpm verify:protocol-snapshot`, `pnpm test:protocol-snapshot`,
`pnpm verify:protocol-traceability`, and `pnpm test:protocol-traceability`.
