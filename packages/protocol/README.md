# @desen/protocol

## Responsibility

This platform-neutral package owns the frozen DESEN protocol inputs and the TypeScript structures
derived from them. The complete upstream 0.1.0 Git tree remains vendored as opaque input under
`upstream/0.1.0/snapshot/` and protected by byte-level integrity tests.

## Explicit non-responsibilities

No editor, runtime, React, DOM, network, application behavior, or executable adapter code belongs
here. The generated TypeScript structures are not runtime validators: untrusted JSON must remain
`unknown` until the future validator package accepts it.

## Status

The exact upstream snapshot, integrity gate, complete protocol traceability inventory, and
schema-derived TypeScript root types are implemented. Runtime validation, stable diagnostics, and
digest APIs remain unimplemented until their tracked tasks.

## Public entry point

The package root exports three documented types and no runtime values:

- `DesenSource` — editable DESEN 0.1.0 source documents;
- `DesenBundle` — published DESEN 0.1.0 bundles; and
- `DesenCatalog` — DESEN 0.1.0 capability catalogs.

Generated helper declarations remain internal so a generator detail does not accidentally become
public API. The three public aliases recursively narrow unconstrained schema positions to
JSON-compatible TypeScript values, rejecting functions, `undefined`, `bigint`, and symbols.

```ts
import type { DesenSource } from "@desen/protocol";

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
```

The `satisfies` check helps while authoring trusted TypeScript. It must not be used as evidence that
parsed JSON is valid.

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

## Protocol, target, and dependencies

- Protocol baseline: DESEN 0.1.0
- Initial target of these types: platform-neutral
- Package runtime dependencies: none
- Build-only generator: root-pinned `json-schema-to-typescript` 15.0.4

No Node, React, DOM, CSS, or browser API enters this package's public surface. Future Web, iOS, and
Android adapters may consume the same document types while using target-specific catalogs.

## Quality commands

```bash
pnpm generate:protocol-types
pnpm verify:protocol-types
pnpm test:protocol-types
pnpm check
```

`generate:protocol-types` intentionally writes tracked declarations and evidence. The verifier and
tests are read-only. Snapshot and traceability checks remain available as
`pnpm verify:protocol-snapshot`, `pnpm test:protocol-snapshot`,
`pnpm verify:protocol-traceability`, and `pnpm test:protocol-traceability`.
