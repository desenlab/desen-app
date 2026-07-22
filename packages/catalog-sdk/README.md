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

## M03-T01 API

The first functional slice registers component contracts and composes a complete DESEN 0.1.0
Catalog root:

```ts
import { createCatalogManifest, registerComponent } from "@desen/catalog-sdk";

const button = registerComponent({
  id: "com.example.ui/Button",
  manifest: {
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        label: { type: "string" },
      },
    },
  },
});

const catalog = createCatalogManifest({
  id: "com.example.ui",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [button],
});
```

`registerComponent` is a pure data operation, not a global registry. It accepts only `id` and the
schema-derived `manifest`, then returns a detached, recursively frozen JSON snapshot. Equal JSON
objects produce the same canonical key order; array order remains significant. Accessors,
serialization hooks, functions, symbols, `undefined`, bigint, non-finite numbers, custom class
instances, `Date`, `Map`, `Set`, cycles, hidden properties, and malformed arrays fail with a
`TypeError` instead of being silently converted or dropped. Common built-in internal-slot objects
such as dates, collections, binary views, boxed primitives, regular expressions, and weak
collections remain rejected even if their prototype is deliberately replaced.

The returned value is immutable, while the input may naturally be a deeply readonly `as const`
manifest. Type-level exactness also rejects named wrapper objects carrying adapter fields; runtime
checks still protect JavaScript callers and callers that bypass TypeScript.
TypeScript can erase extra-property information from a union when one member structurally absorbs
another; runtime exact-key checks remain authoritative for that language-level edge case.

`createCatalogManifest` injects exact `kind: "desen.catalog"` and `desen: "0.1.0"` constants,
maps each registered component id to its one authoritative manifest, and rejects duplicate ids.
Until M03-T02, the resulting `behaviors`, `operations`, and `resources` maps are deliberately
empty. The supplied `target` remains open and exact rather than being hard-coded to Web.

## Validation boundary

These helpers enforce an inert, immutable authoring boundary; they do not duplicate the Catalog
JSON Schema or semantic validator. TypeScript types can be bypassed by untrusted JavaScript, and
the SDK intentionally does not reimplement identifier grammar, Semantic Version, schema, or
cross-capability rules. Pass untrusted or publication-bound Catalogs through `@desen/validator`.

JavaScript does not expose a universal, side-effect-free brand check for every internal-slot or
host-exotic object. A deliberately prototype-laundered `Promise`, generator, iterator, host object,
or general `Proxy` is therefore outside this authoring boundary; do not supply those values. The
SDK snapshots their observable enumerable data shape when they cannot be distinguished safely.

`packageDigest` is caller-supplied in this slice. The deterministic Web–React package byte profile
and digest calculation belong to M03-T04, while final artifact tuple proof belongs to M03-T10.
Executable production and authoring adapters remain target-renderer responsibilities and never
enter this package's JSON API.

## Explicit non-responsibilities

- Product-specific components or adapters
- React or native renderer registration
- Editor UI
- Package discovery or remote executable-code loading
- Runtime execution semantics

## Status

Private proof-phase package. M03-T01 component registration is implemented; later capability
categories, type/control derivation, digest tooling, reference components, and parity checks remain
tracked by M03-T02 through M03-T10.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Target: platform-neutral

## Quality

Use the root workspace quality gate and boundary fixture audit:

```bash
pnpm --filter @desen/catalog-sdk typecheck
pnpm --filter @desen/catalog-sdk test:manifest-registration
pnpm verify:catalog-manifest-registration
pnpm check
node scripts/verify-boundary-fixtures.mjs
```
