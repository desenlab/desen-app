# @desen/validator

## Responsibility

This platform-neutral package validates untrusted data against the exact frozen DESEN 0.1.0
Source, Bundle, and Catalog JSON Schemas. After a root document passes, it also checks every
protocol-defined embedded JSON Schema location as JSON Schema Draft 2020-12 and can apply the
M02-T07 semantic foundation and the cumulative M02-T08 component-contract stage against a trusted
resolved-catalog set.

Structural validation answers: “Does this value have the shape and field-level constraints of a
DESEN 0.1.0 document?” It is the first trust boundary for parsed or programmatically constructed
input. Semantic-foundation validation then answers whether exact catalog requirements, entry,
identities, and category-aware capability references make sense together. Component-contract
validation then checks component props, named slots, accepted children, style parts, and visual
states without executing document content. It intentionally stops before behavior contracts,
dynamic runtime values, publication, and activation.

## Explicit non-responsibilities

The cumulative component-contract stage does not:

- validate event/command contracts, payloads, or any behavior-owned props, slots, styles,
  attachment, or conflict semantics;
- resolve state, predicate, repeat, alias, or ValueSpec binding semantics;
- validate resource/operation inputs, action behavior, navigation, refresh, or command targets;
- compare Source, Bundle, or package digests;
- acquire, install, or trust catalog packages from `location` or any other network/filesystem input;
- render, publish, activate, store, or fetch a document; or
- prove the full protocol prohibition on every possible executable-content representation.

Those checks remain owned by `M02-T09` and later validator, publisher, runtime, and activation
tasks. A component-contract success is still not sufficient for publication or activation.

## Status

DESEN 0.1.0 structural validation is implemented for Source, Bundle, Catalog, and all 13 generic
embedded-schema locator patterns. The frozen valid conformance triplet contains 44 embedded schemas
across those locations, all of which are exercised by the evidence suite.

The semantic foundation implements strict SemVer, exact catalog requirements, catalog and
surface-local identity namespaces, entry validation, extension opacity, and exact capability
existence for component, behavior, resource, and operation categories. It passes the frozen valid
triplet, all five examples, the two official M02-T07 invalid vectors, and explicit later-task scope
fences.

The M02-T08 layer is implemented for component contracts only. It preserves dynamic ValueSpecs as
explicit later validation obligations, prepares component schemas through the documented
`PF-011` host-safe boundary, and does not claim behavior, binding, runtime, publisher, or adapter
correctness. Its task-specific proof covers exact frozen examples, project mutation goldens,
dispatcher parity, immutable success/failure obligations, and the built platform-neutral package.

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

The cumulative component-contract API never bypasses the structural or semantic-foundation
boundaries:

| API                                                          | Purpose                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `validateDesenComponentCatalogSet(input)`                    | Build a trusted set whose component contracts are coherent |
| `validateDesenSourceComponentContracts(input, catalogSet)`   | Validate Source component props, slots, styles, and states |
| `validateDesenBundleComponentContracts(input, catalogSet)`   | Validate Bundle component props, slots, styles, and states |
| `validateDesenComponentContracts(target, input, catalogSet)` | Select the cumulative component-contract target explicitly |

It also exports the result, diagnostic, target-to-document, and recursive immutable-JSON types used
by those functions. Every public export has TSDoc.

```ts
import {
  validateDesenComponentCatalogSet,
  validateDesenSourceComponentContracts,
} from "@desen/validator";

const catalogs = validateDesenComponentCatalogSet(JSON.parse(untrustedCatalogsText) as unknown);
if (!catalogs.valid) {
  handleDiagnostics(catalogs.diagnostics);
  throw new Error("Catalog validation failed.");
}

const result = validateDesenSourceComponentContracts(
  JSON.parse(untrustedSourceText) as unknown,
  catalogs.value,
);

if (!result.valid) {
  for (const diagnostic of result.diagnostics) {
    console.error(diagnostic.code, diagnostic.pointer);
  }
} else {
  // `value` passed the cumulative T06 → T07 → T08 boundary.
  scheduleResolvedValueChecks(result.obligations);
  useValidatedSource(result.value);
}
```

Callers must branch on `valid` before using `value`. A successful result has an empty diagnostics
array. A failed result deliberately has no trusted `value` member.

Component-document results additionally expose a deterministic, immutable `obligations` array.
Each entry identifies a dynamic component prop or style-part property by RFC 6901 pointer and
document/surface/node/capability context; an empty diagnostics array does not discharge those
later resolved-value checks.

The semantic-foundation functions remain available as an intentionally lower-level boundary.
Callers that need component-contract guarantees use the cumulative component APIs above instead of
treating a T07 success as a T08 success.

## Validation flow

Validation has ordered, non-skippable stages: **T06 structural → T07 semantic foundation → T08
component contracts**.

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
7. Component prop and style-part schema graphs are prepared before trust. Unresolved local
   references, duplicate same-resource anchors, unsafe regular expressions, excessive graph
   complexity, and impossible evaluation fan-out fail at the catalog schema pointer.
8. Component slot declarations are checked for coherent presence, effective minimum, maximum, and
   acceptance rules before a catalog set becomes trusted for component-contract use.
9. Every resolved component node is checked against its declared prop, named-slot, accepted-child,
   style-part, and visual-state contracts. Base values and variant patches retain their distinct
   meanings; behavior instances remain fenced to M02-T09.

The caller's input is neither mutated nor retained. The successful `value` is safe to share as
immutable JSON data. Component property and style schemas are interpreted as data by a code-free,
platform-neutral Draft 2020-12 path; document-supplied schemas are never compiled or executed as
JavaScript. A ValueSpec containing `$ref`, `$token`, `$format`, or a nested dynamic value is not
guessed: its static contract checks are preserved where decidable, and final resolved-value
validation remains an explicit publisher/runtime obligation. Later contract and integrity stages
must still pass before treating the value as publishable or activatable.

Slot edge behavior follows the documented `PF-010` profile. A `required` slot must exist; a present
slot uses `minItems ?? (required ? 1 : 0)`, so explicit `required: true, minItems: 0` permits an
empty-but-present array. If both acceptance fields are absent, children are unrestricted. If either
field is present, exact capability-ID/category OR-union membership is required, including the
reject-all meaning of an explicitly empty union. `maxItems` below the effective minimum invalidates
the component catalog contract.

Schema application follows the documented `PF-011` host-safe profile. T06 continues to validate
embedded Draft 2020-12 schemas under the DESEN structural profile, while T08 fails closed before
applying a component prop or style-part schema whose execution cannot be bounded portably. Each
pattern is limited to 256 UTF-16 code units, 128 tokens, a maximum quantifier of 1,024, and an
expanded fixed width of 4,096; without a leading anchor, fixed expanded width is limited to 16.
Groups, alternation, lookaround, backreferences, Unicode-property escapes, interior zero-width
assertions, lazy repetition, and multiple variable-width quantifiers are rejected. One
variable-width quantifier is allowed only with both edge anchors and as the final consuming atom;
only the terminal `$` may follow it. This rejects pathological quantified prefixes followed by a
fixed suffix before native matching. A schema is additionally limited to a maximum graph/evaluation
depth of 128, 4,096 nodes, 4,096 local-reference edges, 64 patterns, 4,096 aggregate pattern code
units, and a 50,000-step evaluation budget. This is a deliberately narrower implementation safety
profile, not a claim that every valid ECMA-262 pattern has equivalent support. `PF-011` remains open
until the protocol standardizes a portable linear-time regex and schema-complexity profile.

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

The structural stage validates the embedded schemas themselves. M02-T08 additionally applies only
component `propsSchema` and component style-part `propertiesSchema` contracts to statically
decidable node data. State, behavior, event, command, resource, and operation schema application
remains assigned to later tasks.

## Diagnostic contract

Structural failures use only these protocol core codes:

| Code                   | Structural meaning                                                      |
| ---------------------- | ----------------------------------------------------------------------- |
| `SCHEMA_INVALID`       | Input, root structure, or an embedded schema violates its contract      |
| `UNKNOWN_CORE_FIELD`   | A field occurs in a frozen core object closed by `additionalProperties` |
| `UNSUPPORTED_PROTOCOL` | A string `desen` value explicitly selects a version other than `0.1.0`  |

The semantic foundation emits the five protocol-owned codes
`DUPLICATE_SURFACE_ID`, `DUPLICATE_NODE_ID`, `ENTRY_NOT_FOUND`, `UNKNOWN_CAPABILITY`, and
`AMBIGUOUS_CAPABILITY`. The component-contract layer adds these existing Appendix B codes:

| Core code             | Component-contract meaning                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| `UNKNOWN_PROP`        | Component prop, visual state, style part, or style property is not accepted |
| `PROP_TYPE_MISMATCH`  | A statically resolved prop or style value violates its embedded schema      |
| `UNKNOWN_SLOT`        | A node uses a slot that its component does not declare                      |
| `SLOT_CARDINALITY`    | Required presence, effective minimum, or maximum is violated                |
| `SLOT_CHILD_REJECTED` | A resolved child matches neither an accepted component ID nor category      |

Unknown visual states and style parts intentionally use `UNKNOWN_PROP`, matching the frozen
starter validator; M02-T08 does not invent narrower codes. `PF-009` records that Appendix B has no
matching core codes for strict SemVer or exact requirement failures. `PF-010` similarly records
that an impossible component slot range passes the frozen JSON Schema and therefore is not
accurately described by `SCHEMA_INVALID`. This implementation additionally exports and emits:

| Namespaced code                                    | Meaning                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `run.desen.validator/INVALID_SEMVER`               | A required exact version is not SemVer 2.0.0                          |
| `run.desen.validator/CATALOG_REQUIREMENT_MISMATCH` | A requirement does not resolve exactly once                           |
| `run.desen.validator/INVALID_COMPONENT_CONTRACT`   | A component schema/slot contract cannot enter the bounded trusted set |

Namespaced diagnostics deliberately have no invented Appendix B classification.

Diagnostics are immutable, JSON-serializable, sorted, and de-duplicated independently of Ajv's
internal error order. Their `code` and RFC 6901 `pointer` are the machine contract. Human-readable
`message` text is safe for display but is not a compatibility key. Pointer construction appends
missing or offending property names and escapes `~` and `/` exactly.

For a component-node pointer `P`, contract locations are stable: props use `P/props/{name}`, slots
use `P/slots/{name}`, rejected children use `P/slots/{name}/{index}/use`, and styles use
`P/style/{state}/{part}/{property}`. Variant paths insert `P/variants/{index}` before `props` or
`style`. A missing required slot uses the deterministic expected location `P/slots/{name}` even
though that member is absent from the input.

Malformed programmatic input is reported as `SCHEMA_INVALID` at the document root. Passing an
unsupported JavaScript target string directly to a generic dispatcher is API misuse and throws
`TypeError`; document-validation failures are returned as data.

## Generated-validator and security boundary

The three exact frozen root schemas and the Draft 2020-12 meta-schema are compiled ahead of time by
pinned Ajv 8.20.0 into one tracked ESM module. Generation is deterministic and audits the schema
identities, input hashes, four expected exports, two reviewed local helper bindings, and the single
relative ESM import that supplies those helpers.

The shipped validation path does not compile document-supplied schemas and contains no `eval`,
`Function(`, CommonJS `require`, dynamic import, absolute workspace path, network access, or
filesystem access. The component-schema path never passes a pattern to native `RegExp` before it
passes the host-safe profile. Development-time generation uses Node, but the runtime API does not
depend on Node, React, DOM, CSS, browser globals, or application code.

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
pnpm generate:protocol-component-contracts
pnpm verify:protocol-component-contracts
pnpm test:protocol-component-contracts
pnpm check
```

The explicit generation commands are the only writers. Verification regenerates code or evidence
in memory, then rejects tool-version drift, schema-byte drift, trace ownership, SemVer goldens,
unexpected code-loading constructs, non-deterministic bytes, changed tracked artifacts, or unsafe
output paths. Tests cover public behavior, frozen vectors and examples, locator families, identity
and catalog boundaries, scope fences, hostile inputs, mutation resistance, and built-distribution
loading.
