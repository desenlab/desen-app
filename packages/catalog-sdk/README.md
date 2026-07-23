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

Executable binding is target- or host-owned:

- renderer packages define executable component and behavior adapter registries;
- trusted hosts bind operation handlers and resource readers;
- a future native renderer defines its own registry; and
- a target catalog package combines its framework-neutral manifest with the applicable registry.

This package may compare registry keys and declared contracts through generic or opaque values,
but it never accepts `React.ComponentType`, `ReactNode`, native view classes, or executable values
inside a catalog document.

## M03-T01–M03-T03 API

The first three functional slices register all four capability contract categories, compose a
complete DESEN 0.1.0 Catalog root, and derive TypeScript props plus platform-neutral inspector
metadata from the same component `propsSchema`:

```ts
import {
  createCatalogManifest,
  deriveComponentInspectorControls,
  registerBehavior,
  registerComponent,
  registerOperation,
  registerResource,
} from "@desen/catalog-sdk";
import type { ComponentPropsOf } from "@desen/catalog-sdk";

const button = registerComponent({
  id: "com.example.ui/Button",
  manifest: {
    propsSchema: {
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string" },
        tone: { enum: ["primary", "secondary"] },
      },
    },
    authoring: {
      controls: {
        tone: { presentation: "segmented" },
      },
    },
  },
});

type ButtonProps = ComponentPropsOf<typeof button>;

const props: ButtonProps = {
  label: "Continue",
  tone: "primary",
};

const inspectorPlan = deriveComponentInspectorControls(button);

const sortable = registerBehavior({
  id: "com.example.interactions/Sortable",
  manifest: {
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        axis: { enum: ["vertical", "horizontal"] },
      },
    },
    attachTo: {
      capabilities: ["com.example.ui/Button"],
    },
    composition: {
      exclusiveChannels: ["pointer-drag"],
    },
  },
});

const signIn = registerOperation({
  id: "com.example.auth/signIn",
  manifest: {
    inputSchema: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { type: "string" },
      },
    },
    errors: [],
    effect: "network",
  },
});

const stores = registerResource({
  id: "com.example.stores/list",
  manifest: {
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string" },
      },
    },
    outputSchema: {
      type: "array",
      items: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
    },
    errors: [],
    policies: ["manual"],
  },
});

const catalog = createCatalogManifest({
  id: "com.example.ui",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [button],
  behaviors: [sortable],
  operations: [signIn],
  resources: [stores],
});

void props;
void inspectorPlan;
```

Every `register*` helper is a pure data operation, not a global or executable registry. Each
accepts only `id` and the schema-derived `manifest`, then returns a detached, recursively frozen
JSON snapshot. Equal JSON objects produce the same canonical key order; array order remains
significant. Accessors, serialization hooks, functions, symbols, `undefined`, bigint, non-finite
numbers, custom class instances, `Date`, `Map`, `Set`, cycles, hidden properties, and malformed
arrays fail with a `TypeError` instead of being silently converted or dropped. Common built-in
internal-slot objects such as dates, collections, binary views, boxed primitives, regular
expressions, and weak collections remain rejected even if their prototype is deliberately
replaced.

The returned value is immutable, while the input may naturally be a deeply readonly `as const`
manifest. Type-level exactness also rejects named wrapper objects carrying adapter fields; runtime
checks protect JavaScript callers and callers that bypass TypeScript by enforcing the exact
registration wrapper and inert JSON. Complete nested manifest structure and semantics remain the
validator's responsibility.
TypeScript can erase extra-property information from a union when one member structurally absorbs
another; Catalog structural validation remains authoritative for nested manifest shape in that
language-level edge case.

`createCatalogManifest` injects exact `kind: "desen.catalog"` and `desen: "0.1.0"` constants and
maps each registration into its authoritative `components`, `behaviors`, `operations`, or
`resources` map. Capability ids share one exact, case-sensitive namespace across all four maps;
same-category and cross-category duplicates are rejected instead of producing a semantically
invalid Catalog. `components` remains required. The three newer registration lists are optional,
so the M03-T01 component-only call shape remains compatible and emits empty maps for omitted
categories. The supplied `target` remains open and exact rather than being hard-coded to Web.

As recorded in `PF-024`, manifest registration and executable host binding are deliberately
separate APIs. `registerBehavior` does not install a renderer adapter, `registerOperation` does not
bind an endpoint or handler, and `registerResource` does not bind a service or reader. Catalog
manifests remain inert data; trusted renderer and host packages supply executable bindings later.

## Manifest-authoritative derivation

`ComponentPropsOf<typeof registration>` and `JsonSchemaValue<typeof schema>` project literal JSON
Schema information into readonly TypeScript values. Exact `const` and `enum` choices, primitive
types, closed object properties, required names, homogeneous arrays, and safe
`additionalProperties` forms are retained. Unsupported applicators, widened schemas, ambiguous
open-object shapes, and subtrees deeper than 16 levels deliberately widen to the JSON-only
`JsonValue` type. A boolean `false` schema produces `never`.

This type projection is an authoring convenience, not a second validator. It cannot enforce every
numeric, string, cross-field, reference, or runtime constraint. Publication-bound and untrusted
values still pass through `@desen/validator`; adapters still validate resolved values at their
assigned runtime boundary.

`deriveComponentInspectorControls(registration)` accepts only a registered component snapshot. It
returns a second detached, recursively frozen JSON plan containing:

- the exact authoritative `propsSchema`;
- the complete component `authoring` contract when present, including scenarios;
- deterministic RFC 6901 pointers for each derived property; and
- primitive, enum, closed-object group, or explicit `structured-json` descriptors.

The reference profile derives control kind, requiredness, and enum options only from
`propsSchema`. DESEN 0.1.0 does not define a control-hint vocabulary, so
`authoring.controls[property]` is retained only as an opaque top-level sidecar. It cannot invent a
property or change schema-derived facts. Nested hint semantics are intentionally not guessed.

Arrays, open objects, references, combinators, conditionals, patterns, unknown keywords, and other
unsupported schema forms remain visible through an honest structured-JSON fallback. A derivation
deeper than 16 control levels or wider than 512 controls produces one root fallback instead of a
partial plan. Actual widgets, validation messages, binding editors, and dynamic-value UI remain
editor responsibilities under M09.

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
Executable production and authoring adapters remain target-renderer responsibilities. Operation
handlers and resource readers remain trusted-host responsibilities. M03-T08, the M04 runtime
tasks, and M05 will define those binding boundaries; executable values never enter this package's
JSON API.

## Explicit non-responsibilities

- Product-specific components or adapters
- React or native renderer registration
- Editor UI
- Package discovery or remote executable-code loading
- Runtime execution semantics

## Status

Private proof-phase package. M03-T01 component registration, M03-T02 behavior/operation/resource
registration, and M03-T03 manifest-authoritative type/control derivation are implemented. Digest
tooling, reference capabilities, executable host bindings, parity checks, and final artifact proof
remain tracked by M03-T04 through M03-T10; renderer adapter registration remains deferred to M05.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Target: platform-neutral

## Quality

Use the root workspace quality gate and boundary fixture audit:

```bash
pnpm --filter @desen/catalog-sdk typecheck
pnpm --filter @desen/catalog-sdk test:manifest-registration
pnpm --filter @desen/catalog-sdk test:manifest-derivation
pnpm verify:catalog-manifest-registration
pnpm check
node scripts/verify-boundary-fixtures.mjs
```
