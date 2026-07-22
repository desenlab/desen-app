# @desen/validator

## Responsibility

This platform-neutral package validates untrusted data against the exact frozen DESEN 0.1.0
Source, Bundle, and Catalog JSON Schemas. After a root passes, the package can apply six ordered,
cumulative boundaries against an explicitly prepared catalog set:

1. **T06 structural validation** checks the three frozen roots and all protocol-defined embedded
   JSON Schema locations.
2. **T07 semantic foundation** checks exact versions and catalog requirements, entry and identity
   rules, one capability namespace, and category-aware capability existence.
3. **T08 component contracts** checks component props, slots, accepted children, style parts, and
   visual states.
4. **T09 interaction contracts** adds behavior props, slots, styles, attachment and mutual-conflict
   rules, component and behavior event declarations, prepared event/command schemas, and known
   component-target command names.
5. **T10 binding contracts** validates state schemas and initial values, lexical references,
   immediate event scope, format placeholders, predicate operand types, and repeat alias/key rules.
6. **T11 execution contracts** validates operation and resource contract safety, resource policies
   and inputs, operation inputs and aliases, lifecycle references, navigation and refresh targets,
   component command targets and inputs, and statically decidable state writes.

The dedicated T09 event-payload API validates one resolved adapter payload. The T11 resolved-value
API applies one of five exact command, operation, or resource input/output contracts after dynamic
resolution or adapter settlement. All paths interpret documents and schemas as inert data. They do
not execute DESEN actions or capability implementations.

## Explicit non-responsibilities

A cumulative T11 success does not:

- resolve profile/host-owned `context.*`, `env.*`, or `$token` values, execute predicates, or
  materialize dynamic repeats; publisher/runtime stages discharge those dynamic responsibilities;
- carry an event payload into `operation.invoke` settlement handlers; T10/T11 reject `event.*`
  there, while actual payload lifetime and action-turn execution belong to M04-T14;
- execute a state write, mount or reload a resource, invoke or settle an operation, navigate a host,
  or call a component command;
- authorize operation effects, apply host event allowlists, enforce operation concurrency, run
  settlement handlers, or enforce the 64-action turn limit;
- prove that a conditional component is currently mounted, choose one repeated component instance,
  or guarantee command-target liveness at the moment of execution;
- automatically validate a future operation/resource output. The runtime must pass each resolved
  output through `validateDesenExecutionValue` before exposing it through a lifecycle reference;
- prove complete post-write validity for a nested state patch without the prior runtime state. Such
  writes remain explicit `state-write` obligations;
- prove that a production adapter validates every emitted payload or implements every declared
  command. T09 supplies bounded contract primitives, but the adapter guarantees in `N-033` and
  `N-034` remain assigned to later capability and runtime tasks;
- compare Source, Bundle, or package digests;
- acquire, install, or trust catalog packages from `location` or any network/filesystem input;
- render, publish, activate, store, or fetch a document; or
- prove the full protocol prohibition on every possible executable-content representation.

An execution-contract success is therefore not sufficient for publication, activation, or runtime
execution.

## Status

DESEN 0.1.0 structural validation is implemented for Source, Bundle, Catalog, and all 13 generic
embedded-schema locator patterns. The frozen valid conformance triplet contains 44 embedded schemas
across those locations.

The semantic foundation implements strict SemVer, exact catalog requirements, catalog and
surface-local identity namespaces, entry validation, extension opacity, and exact capability
existence for component, behavior, resource, and operation categories.

The M02-T08 component layer preserves dynamic ValueSpecs as explicit later-validation obligations
and prepares component prop and style schemas through the documented `PF-011` host-safe boundary.
Its public APIs remain available when a caller intentionally needs only the lower component stage.

The M02-T09 interaction layer is implemented cumulatively on top of T08. It:

- applies behavior prop and style schemas while retaining dynamic values as obligations;
- validates behavior slot presence, cardinality, accepted component IDs, and accepted categories;
- applies exact capability/category attachment rules;
- detects shared exclusive behavior channels unless both contracts declare compatibility;
- validates component and behavior handler names;
- validates a command name when its target is already known to be a component node;
- prepares behavior prop/style, component/behavior event-payload, and component/behavior command
  schemas through the same bounded schema profile; and
- exposes a separate bounded validator for resolved component and behavior event payloads.

The M02-T10 binding layer is implemented cumulatively on top of T09. It:

- applies the same bounded schema profile to state schemas and checks `initial` as inert resolved
  JSON, so `$ref`, `$token`, and `$format` property names inside state data stay ordinary data;
- validates surface-local `state.*`, lexically scoped `item.*`, and immediate-handler `event.*`
  references without inventing schemas for host context, environment, resources, or operations;
- enforces exact `$format` placeholder/value-key sets with a linear parser;
- reports only statically provable predicate type incompatibilities; and
- checks repeat arrays, active-alias collisions, direct-array limits, statically decidable
  string/number keys, missing keys, and duplicates while leaving dynamic instances to the runtime.

The M02-T11 execution layer is implemented cumulatively on top of T10. It:

- prepares operation and resource input/output schemas through the same bounded, code-free schema
  profile and stores their indexes behind a private T11 catalog brand;
- validates declared resource policies and statically known resource/operation/component-command
  inputs, preserving dynamic members as exact later-validation obligations;
- resolves the closed resource and operation lifecycle paths `status`, `pending`, `value[.*]`, and
  `error.code`, with `value` paths inspected conservatively against the declared output schema;
- indexes operation aliases per surface, checks navigation and refresh targets, and requires a
  component-command target to be a declared component node on that same surface;
- checks statically decidable root and nested `state.set` values and boolean `state.toggle` targets,
  preserving post-write checks that need runtime state; and
- exposes one detached resolved-value API for component command input and operation/resource input
  and output contracts.

The package remains private while the wider proof application is under construction. No npm
package is published by these commands.

## Public entry point

### Structural and semantic APIs

| API                                                           | Purpose                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `validateDesenSource(input)`                                  | Validate unknown input as a DESEN 0.1.0 editable Source    |
| `validateDesenBundle(input)`                                  | Validate unknown input as a DESEN 0.1.0 published Bundle   |
| `validateDesenCatalog(input)`                                 | Validate unknown input as a DESEN 0.1.0 capability Catalog |
| `validateDesenStructure(target, input)`                       | Select `source`, `bundle`, or `catalog` explicitly         |
| `isExactSemanticVersion(value)`                               | Guard exact Semantic Versioning 2.0.0 syntax               |
| `validateDesenCatalogSet(input)`                              | Build a trusted immutable T07 catalog set                  |
| `validateDesenCatalogSemantics(input)`                        | Validate Catalog version and namespace semantics           |
| `validateDesenSourceSemantics(input, catalogSet)`             | Validate Source identity and declared capabilities         |
| `validateDesenBundleSemantics(input, catalogSet)`             | Validate Bundle identity and exact requirements            |
| `validateDesenSemanticFoundation(target, input, catalogSet?)` | Select the semantic target explicitly                      |

### Component-contract APIs

| API                                                          | Purpose                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `validateDesenComponentCatalogSet(input)`                    | Build a trusted set whose component contracts are coherent |
| `validateDesenSourceComponentContracts(input, catalogSet)`   | Validate Source component props, slots, styles, and states |
| `validateDesenBundleComponentContracts(input, catalogSet)`   | Validate Bundle component props, slots, styles, and states |
| `validateDesenComponentContracts(target, input, catalogSet)` | Select the cumulative T06–T08 target explicitly            |

### Interaction-contract and resolved-payload APIs

| API                                                            | Purpose                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `validateDesenInteractionCatalogSet(input)`                    | Prepare a trusted cumulative T09 catalog set                    |
| `validateDesenSourceInteractionContracts(input, catalogSet)`   | Validate a Source cumulatively through T09                      |
| `validateDesenBundleInteractionContracts(input, catalogSet)`   | Validate a Bundle cumulatively through T09                      |
| `validateDesenInteractionContracts(target, input, catalogSet)` | Select the cumulative Source or Bundle interaction target       |
| `validateDesenEventPayload(payload, selector, catalogSet)`     | Validate one detached resolved payload against a declared event |
| `EVENT_PAYLOAD_SAFETY_LIMITS`                                  | Expose the exact immutable limits used by the payload boundary  |

### Binding-contract APIs

| API                                                        | Purpose                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `validateDesenSourceBindingContracts(input, catalogSet)`   | Validate a Source cumulatively through T10                  |
| `validateDesenBundleBindingContracts(input, catalogSet)`   | Validate a Bundle cumulatively through T10                  |
| `validateDesenBindingContracts(target, input, catalogSet)` | Select the cumulative Source or Bundle binding target       |
| `INVALID_BINDING_CONTRACT_CODE`                            | Identify a project-owned incoherent static binding contract |

### Execution-contract and resolved-value APIs

| API                                                          | Purpose                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `validateDesenExecutionCatalogSet(input)`                    | Prepare the exact cumulative T11 catalog set                    |
| `validateDesenSourceExecutionContracts(input, catalogSet)`   | Validate a Source cumulatively through T11                      |
| `validateDesenBundleExecutionContracts(input, catalogSet)`   | Validate a Bundle cumulatively through T11                      |
| `validateDesenExecutionContracts(target, input, catalogSet)` | Select the cumulative Source or Bundle execution target         |
| `validateDesenExecutionValue(value, selector, catalogSet)`   | Validate one detached resolved execution value                  |
| `EXECUTION_VALUE_SAFETY_LIMITS`                              | Expose the immutable limits used by the detached value boundary |
| `INVALID_EXECUTION_CONTRACT_CODE`                            | Identify a project-owned incoherent execution contract          |

T10 intentionally introduces no second catalog preparation API or nominal catalog brand. The
binding APIs require the exact `DesenValidatedInteractionCatalogSet` returned by T09 and first run
the complete T09 boundary. This preserves the private `WeakMap` trust check instead of duplicating
catalog indexes.

`validateDesenExecutionCatalogSet` first runs T06 through T09 catalog preparation, then prepares
all operation and resource input/output schemas through the `PF-011` profile. Its nominal
`DesenValidatedExecutionCatalogSet` brand is backed by private `WeakMap` metadata. A cast from a
lower-stage catalog set cannot forge the indexes required by document or detached-value validation.

The package root also exports the associated target, success, failure, result, obligation, event
reference, resolved-JSON, and validated-catalog-set types. The central T09–T11 types are:

- `DesenValidatedInteractionCatalogSet`;
- `DesenInteractionCatalogSetValidationResult` and its success/failure variants;
- `DesenInteractionContractValidationResult<Target>` and its success/failure variants;
- `DesenInteractionContractObligation` and `DesenInteractionContractObligationKind`;
- `DesenEventContractReference` and `DesenEventCapabilityKind`;
- `DesenEventPayloadValidationResult` and its success/failure variants;
- `DesenResolvedJsonValue`;
- `DesenBindingContractValidationResult<Target>` and its success/failure variants;
- `DesenBindingContractObligation` and `DesenBindingContractObligationKind`;
- `DesenValidatedExecutionCatalogSet`, `DesenExecutionCatalogSetValidationSuccess`,
  `DesenExecutionCatalogSetValidationFailure`, and `DesenExecutionCatalogSetValidationResult`;
- `DesenExecutionContractTarget`, `DesenExecutionContractValidationSuccess<Target>`,
  `DesenExecutionContractValidationFailure<Target>`, and
  `DesenExecutionContractValidationResult<Target>`;
- `DesenExecutionContractObligation` and `DesenExecutionContractObligationKind`;
- `DesenExecutionValueContractKind` and `DesenExecutionValueContractReference`; and
- `DesenExecutionValueValidationSuccess`, `DesenExecutionValueValidationFailure`, and
  `DesenExecutionValueValidationResult`.

Every public export has TSDoc.

## Cumulative execution example

```ts
import {
  validateDesenExecutionCatalogSet,
  validateDesenSourceExecutionContracts,
} from "@desen/validator";

const catalogs = validateDesenExecutionCatalogSet(JSON.parse(untrustedCatalogsText) as unknown);
if (!catalogs.valid) {
  handleDiagnostics(catalogs.diagnostics);
  throw new Error("Catalog validation failed.");
}

const result = validateDesenSourceExecutionContracts(
  JSON.parse(untrustedSourceText) as unknown,
  catalogs.value,
);

if (!result.valid) {
  handleDiagnostics(result.diagnostics);
} else {
  // `value` passed the cumulative T06 → T07 → T08 → T09 → T10 → T11 boundary.
  scheduleResolvedValueChecks(result.obligations);
  useValidatedSource(result.value);
}
```

Callers must branch on `valid` before using `value`. A success has an empty diagnostics array. A
failure deliberately has no trusted `value` member. Source and Bundle execution results always
contain a deterministic, immutable `obligations` array, including on a contract failure where
independently discoverable obligations remain useful.

T11 inherits the four interaction obligation kinds:

- `component-prop`;
- `style-part-property`;
- `behavior-prop`; and
- `behavior-style-part-property`.

It adds four execution obligation kinds, for eight total:

- `component-command-input`;
- `operation-input`;
- `resource-input`; and
- `state-write`.

Each obligation carries an RFC 6901 document pointer plus the available immutable document,
surface, node-or-behavior, and capability context. An obligation means the static validator did not
guess a resolved value or complete post-write state. A later publisher or runtime still must
resolve and validate it before executable capability code receives the data or the write becomes
observable.

Lower-stage APIs remain intentional escape hatches for callers that need only structural,
semantic-foundation, component, interaction, or binding guarantees. A caller needing T11
guarantees uses the exact `.value` returned by `validateDesenExecutionCatalogSet`; casting a lower
catalog brand cannot forge the private runtime trust metadata.

## Resolved event-payload example

```ts
import { validateDesenEventPayload } from "@desen/validator";

const payloadResult = validateDesenEventPayload(
  adapterPayload,
  {
    capabilityKind: "component",
    capabilityId: "com.example.ui/TextField",
    eventName: "change",
  },
  catalogs.value,
);

if (!payloadResult.valid) {
  handleDiagnostics(payloadResult.diagnostics);
} else {
  dispatchFrozenPayload(payloadResult.value);
}
```

The selector has the exact shape `{ capabilityKind: "component" | "behavior", capabilityId,
eventName }`. A wrong kind, capability ID, event name, malformed selector, or untrusted catalog set
fails as diagnostic data; it does not invoke an adapter.

The payload is copied through the inert JSON boundary, bounded, recursively frozen, and then
checked in complete `resolved-value` mode against the selected `payloadSchema`. In this mode,
properties named `$ref`, `$token`, or `$format` are ordinary resolved JSON data. They never become
DESEN bindings and never produce dynamic obligations. A success exposes a detached
`DesenResolvedJsonValue`; a failure exposes no `value`.

`EVENT_PAYLOAD_INVALID` pointers are relative to the detached payload root. The empty JSON Pointer
`""` identifies a root snapshot, limit, or schema failure. The exact public limits are:

| Limit                                        |     Value |
| -------------------------------------------- | --------: |
| Maximum depth, with the payload root at zero |       128 |
| Maximum total JSON value nodes               |     4,096 |
| Maximum aggregate UTF-16 string code units   | 1,048,576 |

The string budget includes both string values and object property names. The public constant is
deeply frozen and its accept/reject boundaries are exercised through `validateDesenEventPayload`.

This API is a validation primitive for the later adapter boundary. Its existence does not prove
that every production adapter actually calls it or independently guarantees equivalent behavior.

## Resource and operation lifecycle paths

T11 recognizes only these closed lifecycle shapes:

| Reference shape                       | Static contract                                              |
| ------------------------------------- | ------------------------------------------------------------ |
| `resource.<name>.status`              | Present lifecycle string                                     |
| `resource.<name>.pending`             | Present lifecycle boolean                                    |
| `resource.<name>.value[.<path>...]`   | Optional value inspected against the resource output schema  |
| `resource.<name>.error.code`          | Optional public error-code string                            |
| `operation.<alias>.status`            | Optional lifecycle string                                    |
| `operation.<alias>.pending`           | Optional lifecycle boolean                                   |
| `operation.<alias>.value[.<path>...]` | Optional value inspected against the operation output schema |
| `operation.<alias>.error.code`        | Optional public error-code string                            |

A resource name must be declared in the current surface. An operation alias is collected from all
`operation.invoke` actions in that surface before references are checked, so document order does
not change visibility. Reusing one alias for the same exact operation shares one lifecycle;
reusing it for a different operation fails execution validation at the later `/as`. Aliases never
cross a surface boundary.

Unknown roots and aliases fail even when a fallback is present. A fallback may cover a missing
optional or definitely closed deeper path only after the root is valid. Open, conditional,
recursive, or otherwise uncertain output-schema paths remain runtime decisions. No other lifecycle
field is invented.

The frozen local-identifier grammar permits `.` and `:`, but reference segments provide no dot
escape and do not admit colons. Such resource names and operation aliases remain structurally legal
but cannot be addressed as one lifecycle root; `PF-023` records the exact no-guess profile.

## Resolved execution-value example

```ts
import { validateDesenExecutionValue } from "@desen/validator";

const output = validateDesenExecutionValue(
  adapterResult,
  {
    kind: "operation-output",
    capabilityId: "com.example.auth/signIn",
  },
  catalogs.value,
);

if (!output.valid) {
  handleDiagnostics(output.diagnostics);
} else {
  exposeLifecycleValue(output.value);
}
```

The exact selector union has five kinds:

- `{ kind: "component-command-input", capabilityId, commandName }`;
- `{ kind: "operation-input", capabilityId }`;
- `{ kind: "operation-output", capabilityId }`;
- `{ kind: "resource-input", capabilityId }`; and
- `{ kind: "resource-output", capabilityId }`.

Both selector and value cross a detached JSON boundary. The value is copied, bounded by
`EXECUTION_VALUE_SAFETY_LIMITS`, recursively frozen, and checked in complete `resolved-value`
mode. The limits are the same 128-depth, 4,096-node, and 1,048,576-code-unit limits used for event
payloads. ValueSpec-shaped property names are ordinary data and cannot create obligations. A
success returns an independent `DesenResolvedJsonValue`; a failure exposes no value.

Diagnostic pointers are relative to the detached value root, including `""` for a root snapshot,
selector, safety-limit, or contract failure. Unknown capability and command selectors fail as
diagnostic data and never call an adapter. This API is the runtime handoff for the three input
obligation kinds and for operation/resource outputs that do not exist in the Source or Bundle. It
does not itself prove that a production runtime calls the boundary at every required lifecycle
transition.

## Validation flow

Validation has ordered, non-skippable stages: **T06 structural → T07 semantic foundation → T08
component contracts → T09 interaction contracts → T10 binding contracts → T11 execution
contracts**.

1. Input is converted to RFC 8785-compatible canonical JSON, parsed into an independent plain-data
   tree, and recursively frozen. Unsupported JavaScript values, accessors, custom prototypes,
   cycles, sparse arrays, invalid Unicode, and non-finite numbers fail before semantic inspection.
2. The snapshot is checked by the generated standalone validator for the selected frozen Source,
   Bundle, or Catalog root.
3. Embedded schemas are found in deterministic pointer order and checked against Draft 2020-12
   plus the documented DESEN embedded-schema profile.
4. Catalog-set members are independently validated and admitted to private runtime trust metadata
   only when strict versions and the set-wide capability namespace pass.
5. Source and Bundle requirements match literal catalog `id`, `version`, and applicable `target`
   strings. Additional catalogs in the trusted pool do not authorize undeclared capabilities.
6. Entry, surface, node, behavior, resource, operation, and nested-action capability references
   owned by the semantic foundation are traversed deterministically with explicit work stacks.
7. T08 prepares component prop and style-part schemas and rejects incoherent component slots before
   producing its own private catalog brand.
8. T08 checks every resolved component node, including components nested in behavior slots. Base
   values and Variant patches keep their distinct complete/patch meanings.
9. T09 first prepares behavior prop/style schemas and component/behavior event-payload and command
   schemas. Unsafe graphs cannot enter the interaction catalog set.
10. T09 checks behavior props, slots, accepted children, visual states, style parts, and attachment
    rules while preserving dynamic behavior values as obligations.
11. T09 evaluates direct behavior pairs on each component for mutually authorized exclusive-channel
    compatibility, validates component and behavior handler names, and checks command names only
    for targets already indexed as component nodes.
12. T10 applies every state schema to its inert initial value, then walks nodes, behaviors,
    predicates, actions, and values with explicit stacks and surface-local lexical scopes.
13. T10 conservatively inspects prepared state/event schema paths. Only a definitely impossible
    path or type produces a static failure; unsupported or dynamic cases remain later work.
14. T11 prepares operation/resource input and output schemas and builds private component,
    operation, resource, catalog-requirement, and surface-scope indexes.
15. T11 validates resource policies/inputs and action contracts, then supplies resource/operation
    lifecycle schemas back to the T10 lexical reference and predicate analysis.
16. T11 checks static state writes while preserving dynamic and incomplete post-write work as
    obligations. Inputs that contain dynamic ValueSpecs are inspected member-by-member instead of
    being treated as wholly valid or invalid.
17. The separate payload and execution-value boundaries copy resolved caller data into bounded
    immutable snapshots before applying the selected schema in resolved-value mode.

Diagnostics and obligations are sorted and de-duplicated independently of object insertion order.
Caller-owned input is never mutated or retained.

## Documented edge and safety profiles

The frozen DESEN 0.1.0 text leaves several edge cases open. `PF-010` onward record the
implementation profiles below without rewriting the frozen protocol.

### PF-010: component and behavior slots

The same slot rules apply to component and behavior capabilities:

- a `required` slot must be present;
- a present slot uses `minItems ?? (required ? 1 : 0)`;
- explicit `required: true, minItems: 0` permits an empty-but-present slot;
- when both acceptance fields are absent, children are unrestricted;
- when either field is present, capability IDs and categories form an exact OR union;
- an explicitly present empty union rejects every child; and
- `maxItems` below the effective minimum invalidates catalog preparation.

An impossible component slot uses `INVALID_COMPONENT_CONTRACT`; an impossible behavior slot uses
`INVALID_INTERACTION_CONTRACT`.

### PF-011: bounded Draft 2020-12 contract application

T06 validates embedded schema syntax. T08 through T11 additionally fail closed before applying a
contract schema whose execution cannot be bounded portably. The same profile covers component
props/styles, behavior props/styles, component/behavior event and command schemas, and state
schemas before their initial values or paths are inspected. T11 extends it to operation and
resource input/output schemas before they enter either document or detached-value validation.

Each pattern is limited to 256 UTF-16 code units, 128 tokens, a maximum quantifier of 1,024, and an
expanded fixed width of 4,096. An unanchored fixed-width pattern is limited to 16 expanded atoms.
Groups, alternation, lookaround, backreferences, Unicode-property escapes, interior zero-width
assertions, lazy repetition, and multiple variable-width quantifiers are rejected. One
variable-width quantifier is allowed only with both edge anchors and as the final consuming atom;
only terminal `$` may follow it.

A schema is additionally limited to depth 128, 4,096 nodes, 4,096 local-reference edges, 64
patterns, 4,096 aggregate pattern code units, and a 50,000-step evaluation budget. Unresolved local
references, duplicate same-resource anchors, unsafe patterns, excessive graphs, and impossible
evaluation fan-out fail at the catalog schema pointer. Unsafe patterns are never passed to native
`RegExp`.

This is a deliberately narrower host-safe profile, not a claim that every valid ECMA-262 pattern
has equivalent support. It does not complete `N-033` or `N-034`.

### PF-012: behavior attachment and mutual conflicts

Attachment comparison is exact and case-sensitive. A behavior attaches when the parent component
ID occurs in `attachTo.capabilities` **or** the component category occurs in `attachTo.categories`.
An explicitly present empty union rejects all attachments.

`exclusiveChannels` is treated as a set. Two direct behavior instances on the same component may
share a channel only when each contract lists the other's exact capability ID in `compatibleWith`.
Two instances of one behavior therefore require self-compatibility. A conflict points to `/use` on
the later behavior in document order. Dangling attachment or compatibility declarations do not
invent a new capability diagnostic; they simply cannot authorize a relationship that is absent
from the resolved pair.

### PF-013: detached resolved event payloads

Adapter payloads are detached JSON values, not Source or Bundle subtrees. Their diagnostic pointer
base is therefore the payload root. ValueSpec-shaped property names remain ordinary JSON in this
boundary. Snapshot failures and the exact depth/node/string limits fail closed with
`EVENT_PAYLOAD_INVALID`; unsafe payload schemas fail earlier during interaction catalog preparation
with `INVALID_INTERACTION_CONTRACT`.

### PF-014: command reachability and event scope

Behavior command schemas are prepared, but DESEN 0.1.0 defines no behavior-command action. T09 does
not redirect `component.command` to a behavior or invent `behavior.command` semantics.

For `component.command`, T09 reports `UNKNOWN_COMMAND` only when the action target is already known
to be a component node and that component does not declare the name. T11 completes the static
boundary by requiring the target ID to resolve to a component node on the same surface and by
applying the command input schema. A missing, behavior, or cross-surface target uses
`UNKNOWN_COMMAND` at `/target`; a dynamic input member becomes a `component-command-input`
obligation. A declared conditional target remains statically legal because only the runtime knows
whether it is currently mounted, and selecting one repeated instance remains runtime work. T10/T11
accept `event.*` only in the immediate declared component/behavior handler action turn and check its
path against the prepared payload schema. `onSuccess` and `onFailure` start a new turn, so `event.*`
is rejected there. Runtime payload lifetime remains M04-T14 work.

### PF-015–PF-019: static binding decisions

T10 uses lexical validity before fallback: fallback cannot make an undeclared state, inactive item
alias, or out-of-turn event reference legal. A fallback may rescue a definitely absent nested path
under a valid root, but it is type-checked independently wherever it can become the consumer's
value; a resolved primary, including `null`, never selects fallback. Schema-path inspection is
conservative and rejects only proved impossibility. Inside predicates, a lexically valid missing
argument follows the protocol's `false` rule instead of becoming an unresolved required value.

T11 applies the same rule to declared surface resources and surface-wide operation aliases. It
admits only `status`, `pending`, `value[.*]`, and `error.code`; output-schema paths below `value`
are rejected only when definitely closed. A fallback cannot invent a resource instance or
operation alias. Reusing an alias for the same exact operation is allowed; reusing it for a
different capability is an incoherent execution contract.

Nested `{ op, args }` objects in predicate arguments are predicates, and `exists` requires a direct
reference. Ordering and collection operators reject only definite type incompatibility. `$format`
uses a linear brace parser and requires exact equality between its placeholder-name set and the
own keys of `values`.

Repeat `items` is evaluated in the parent scope; its `as` alias becomes active for `key` and the
entire repeated node body. Reusing an active ancestor alias is invalid, while disjoint siblings may
reuse a name. Direct arrays permit deterministic length and independently inspectable
missing/non-scalar/duplicate key proof even when unrelated item fields are dynamic; dynamic
collection length and keys remain runtime work. Because state identifiers allow dots while action
paths use dot segments, the first action path segment remains the complete state name. T11 rejects
definitely missing nested paths and incompatible static `state.set` values, requires a definitely
known `state.toggle` target to be boolean, and emits `state-write` obligations for dynamic values,
every accepted toggle, and nested patches whose complete post-write state needs the runtime. A
dotted declaration remains legal but cannot be addressed as one state name under 0.1.0's segment
grammar; no longest-prefix interpretation is invented.

### PF-020–PF-023: static execution decisions

Operation aliases are surface-scoped and indexed before reference inspection. Reusing an alias for
the same exact operation shares one static lifecycle contract; a different operation at the same
alias uses `INVALID_EXECUTION_CONTRACT`. The frozen starter mappings are retained for unsupported
resource policy (`RESOURCE_INPUT_INVALID`), missing core navigation (`ENTRY_NOT_FOUND`), missing
refresh resource (`REFERENCE_UNRESOLVED`), and missing/wrong-kind/cross-surface command target
(`UNKNOWN_COMMAND`).

Resolved command/operation/resource values cross the detached five-kind boundary described above;
outputs create no document obligation before they exist. Resource names and operation aliases that
contain `.` or `:` remain structurally legal but cannot be addressed as one `$ref` lifecycle root.
The validator does not invent escaping or longest-prefix matching.

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

An omitted embedded `$schema` inherits Draft 2020-12 from the containing DESEN 0.1.0 contract. The
exact Draft 2020-12 URI is accepted when present. An explicitly different dialect, invalid regular
expression, malformed RFC 3986 identifier, or non-local `$ref`/`$dynamicRef` is rejected.
References beginning with `#` remain document-local; no schema resource is fetched from a network
or filesystem. Unknown annotation keywords remain legal JSON Schema and receive no invented DESEN
meaning.

T08 applies component prop and style-part schemas to statically decidable document values. T09 adds
behavior prop and style-part application and safe preparation of component/behavior event and
command schemas. `validateDesenEventPayload` applies an event schema to one resolved payload.
T10 applies state schemas to resolved initial JSON and uses prepared state/event shapes for
conservative static references. T11 prepares operation/resource schemas, applies statically
decidable command, resource, operation, and state-action contracts, and exposes the detached
resolved-value boundary. Host effects, complete lifecycle execution, mounted target liveness, and
dynamic obligation discharge remain runtime responsibilities.

## Diagnostic contract

Structural failures use only these protocol core codes:

| Code                   | Structural meaning                                                      |
| ---------------------- | ----------------------------------------------------------------------- |
| `SCHEMA_INVALID`       | Input, root structure, or an embedded schema violates its contract      |
| `UNKNOWN_CORE_FIELD`   | A field occurs in a frozen core object closed by `additionalProperties` |
| `UNSUPPORTED_PROTOCOL` | A string `desen` value explicitly selects a version other than `0.1.0`  |

The semantic foundation emits `DUPLICATE_SURFACE_ID`, `DUPLICATE_NODE_ID`, `ENTRY_NOT_FOUND`,
`UNKNOWN_CAPABILITY`, and `AMBIGUOUS_CAPABILITY`.

Component and behavior prop/slot/style validation reuse these Appendix B codes:

| Core code             | Contract meaning                                                          |
| --------------------- | ------------------------------------------------------------------------- |
| `UNKNOWN_PROP`        | A prop, visual state, style part, or style property is undeclared         |
| `PROP_TYPE_MISMATCH`  | A statically known prop or style value violates its schema                |
| `UNKNOWN_SLOT`        | A component or behavior instance uses an undeclared slot                  |
| `SLOT_CARDINALITY`    | Required presence, effective minimum, or maximum is violated              |
| `SLOT_CHILD_REJECTED` | A child matches neither an accepted component ID nor an accepted category |

T09 additionally emits:

| Core code                     | T09 meaning                                                     |
| ----------------------------- | --------------------------------------------------------------- |
| `UNKNOWN_EVENT`               | A component/behavior handler or payload selector is undeclared  |
| `EVENT_PAYLOAD_INVALID`       | A detached resolved payload fails snapshot, limits, or schema   |
| `UNKNOWN_COMMAND`             | A known component target does not declare the requested command |
| `BEHAVIOR_ATTACHMENT_INVALID` | A behavior cannot attach by exact component ID or category      |
| `BEHAVIOR_CONFLICT`           | Direct behaviors share a channel without mutual compatibility   |

Unknown visual states and style parts intentionally use `UNKNOWN_PROP`, matching the frozen
starter behavior rather than inventing narrower codes. T11 emits `COMMAND_INPUT_INVALID` after a
same-surface component target and declared command have selected one exact input schema.

T10 adds the five Appendix B binding diagnostics at exact ValueSpec, predicate, repeat, or action
pointers:

| Core code                 | T10 static meaning                                                 |
| ------------------------- | ------------------------------------------------------------------ |
| `STATE_WRITE_INVALID`     | A state action's first path segment is not a declared local state  |
| `REFERENCE_UNRESOLVED`    | A state/item/event reference is lexically or definitely unresolved |
| `PREDICATE_TYPE_MISMATCH` | Predicate operands are definitely incompatible                     |
| `REPEAT_ITEMS_INVALID`    | Repeat items are definitely non-array                              |
| `REPEAT_KEY_INVALID`      | A known repeat key is missing, invalid, or duplicated              |

Static direct-array limit overflow and active-alias collisions use the project-owned
`run.desen.validator/INVALID_BINDING_CONTRACT` code because Appendix B does not assign either case
to `REPEAT_ITEMS_INVALID` or `REPEAT_KEY_INVALID`.

T11 adds or completes these execution mappings:

| Core code                  | T11 meaning                                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| `COMMAND_INPUT_INVALID`    | A static or detached resolved component-command input violates its schema |
| `OPERATION_INPUT_INVALID`  | A static or detached resolved operation input violates its schema         |
| `OPERATION_OUTPUT_INVALID` | A detached resolved operation output violates its schema                  |
| `RESOURCE_INPUT_INVALID`   | A policy or static/detached resource input violates its contract          |
| `RESOURCE_OUTPUT_INVALID`  | A detached resolved resource output violates its schema                   |
| `STATE_WRITE_INVALID`      | A definite state path, value, or toggle type is incompatible              |
| `ENTRY_NOT_FOUND`          | A core navigation target is not a surface in the document                 |
| `REFERENCE_UNRESOLVED`     | A lifecycle root/path or refresh resource is definitely unavailable       |
| `UNKNOWN_COMMAND`          | A command target is missing, wrong-kind, or outside the current surface   |
| `UNKNOWN_CAPABILITY`       | A detached selector names no capability of the required category          |

The policy, navigation, refresh, and missing-command-target mappings follow the frozen starter
validator where Appendix B does not define a narrower action-specific code. An operation alias
reused for a different capability and an unsafe operation/resource schema use the project-owned
`run.desen.validator/INVALID_EXECUTION_CONTRACT` code.

The implementation also exports these project-owned namespaced codes:

| Namespaced code                                    | Meaning                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `run.desen.validator/INVALID_SEMVER`               | A required exact version is not SemVer 2.0.0                           |
| `run.desen.validator/CATALOG_REQUIREMENT_MISMATCH` | A requirement does not resolve exactly once                            |
| `run.desen.validator/INVALID_COMPONENT_CONTRACT`   | A component schema/slot contract cannot enter its trusted set          |
| `run.desen.validator/INVALID_INTERACTION_CONTRACT` | A behavior/event/command contract cannot enter the T09 trusted set     |
| `run.desen.validator/INVALID_BINDING_CONTRACT`     | A state schema/initial or static format contract is incoherent         |
| `run.desen.validator/INVALID_EXECUTION_CONTRACT`   | A T11 schema, alias, selector, or catalog trust contract is incoherent |

Namespaced diagnostics deliberately have no invented Appendix B classification. `PF-009` records
the earlier SemVer/requirement diagnostic gap; `PF-010` onward documents the T08–T11 edge profiles.

Diagnostics are immutable, JSON-serializable, sorted, and de-duplicated independently of Ajv's
internal error order. Their `code` and RFC 6901 `pointer` are the machine contract. Human-readable
messages are safe for display but are not compatibility keys. Pointer construction escapes `~` and
`/` exactly.

For an owner pointer `P`, props use `P/props/{name}`, slots use `P/slots/{name}`, rejected children
use `P/slots/{name}/{index}/use`, styles use `P/style/{state}/{part}/{property}`, and handlers use
`P/on/{event}`. Behavior attachment/conflict diagnostics point to the applicable behavior `/use`.
Known-target command-name failures point to the action `/command`. Payload pointers are relative to
the detached payload root. Missing command targets point to `/target`; command, operation, and
resource input diagnostics are relative to the document `/input` owner. State-path failures point
to `/path`, while state value failures point within `/value`. Detached execution-value pointers are
relative to their own root.

Malformed programmatic document input is reported as `SCHEMA_INVALID` at the document root.
Unsupported target strings passed directly to a generic dispatcher are API misuse and throw
`TypeError`; validation failures are otherwise returned as data.

## Generated-validator and security boundary

The three exact frozen root schemas and Draft 2020-12 meta-schema are compiled ahead of time by
pinned Ajv 8.20.0 into a tracked ESM module. Document-supplied contract schemas are interpreted as
data by the bounded platform-neutral path; they are never compiled into executable JavaScript.

The shipped validation path contains no `eval`, `Function(`, CommonJS `require`, dynamic import,
absolute workspace path, network access, or filesystem access. Unsafe patterns are rejected before
native matching. Event payloads, execution values, and their selectors pass through independent
inert JSON snapshots before their members are read. Accessors, custom prototypes, cycles, sparse
arrays, invalid Unicode, non-finite numbers, and values beyond the documented detached-data limits
fail closed.

The semantic and contract layers use own-property traversal, `Map`, `Set`, and private
`WeakMap`/`WeakSet` trust metadata. They use fixed messages that never echo caller values, do not
inspect extension payloads for invented meaning, and never use Source `location` for I/O.

Development-time generation uses Node, but the runtime API does not depend on Node, React, DOM,
CSS, browser globals, or application code. Validation does not render a UI, invoke an adapter,
execute actions, load arbitrary code, or produce side effects. Complete executable-content and
adapter conformance remain later cross-cutting proofs.

## Protocol, target, and dependencies

- Protocol baseline: DESEN 0.1.0 only
- Runtime target: platform-neutral
- First product/runtime target: `web-react`
- Runtime dependency: `@desen/protocol`; generated validation uses reviewed local helpers
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
pnpm generate:protocol-interaction-contracts
pnpm verify:protocol-interaction-contracts
pnpm test:protocol-interaction-contracts
pnpm generate:protocol-binding-contracts
pnpm verify:protocol-binding-contracts
pnpm test:protocol-binding-contracts
pnpm generate:protocol-execution-contracts
pnpm verify:protocol-execution-contracts
pnpm test:protocol-execution-contracts
pnpm check
```

Generation commands are the only evidence/code writers. Verification regenerates code or evidence
in memory and rejects tool-version drift, schema-byte drift, trace ownership, SemVer goldens,
unexpected code-loading constructs, non-deterministic bytes, changed tracked artifacts, or unsafe
output paths. Tests cover public behavior, frozen vectors and examples, locator families, identity
and catalog boundaries, interaction/binding/execution contracts, detached resolved-value limits,
lifecycle scope fences, hostile inputs, mutation resistance, and built-distribution loading.
