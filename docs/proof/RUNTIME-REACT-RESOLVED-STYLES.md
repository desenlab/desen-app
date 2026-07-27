# Runtime React Resolved Styles Proof

## Result

M05-T03 proves that the Web–React renderer validates every final component and behavior style map
through the exact Catalog authority retained by the authenticated live headless session. The same
factory-created receiving scope used for props and named slots is reused for styles, so no node or
behavior can reset its validation or schema-work budget.

The validator returns a dedicated readonly
`visual state → semantic style part → property → resolved JSON` public type. The React renderer
delivers that exact successful value without an unchecked cast. Any malformed hierarchy,
undeclared state, part, or property, dynamically resolved schema mismatch, hostile value, or
receiving-budget crossing fails before the first React element is created.

## Component and behavior receiving boundary

Component and behavior styles follow separate exact capability lookups and retain separate stable
failure codes:

- `INVALID_COMPONENT_STYLE` with receiving channel `style`; and
- `INVALID_BEHAVIOR_STYLE` with receiving channel `style`.

Both paths preserve the validator's immutable normalized diagnostics and the nearest runtime-node,
source-node, and capability identities. A receiving limit retains the shared
`RECEIVING_VALIDATION_LIMIT_EXCEEDED` classification. No invalid or partial style map reaches a
component, behavior wrapper, fallback, or placeholder.

Execution-Catalog preparation caches each capability's declared visual-state set and prepared
style-part property schemas once. Final values are detached through the inert JSON boundary and
checked as complete resolved property objects. Successful maps are recursively immutable and do
not retain caller-owned aliases.

## Capability-owned state activation

`runtime-react` preserves the complete validated map but does not decide which visual state is
active. It does not merge `base` into another state, interpret property names, generate CSS, map
class names, query DOM/native nodes, expose refs, or inspect React-private structure. A statically
trusted capability adapter alone translates its declared semantic parts and decides which
production state is active.

This separation keeps the headless plan and receiving contract reusable by future native targets.
SwiftUI or Compose adapters may implement the same semantic hierarchy without importing React,
CSS, or Web DOM assumptions.

## Historical compatibility

The following prerequisite artifacts remain byte-identical:

- M02-T08 component contracts:
  `sha256:71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac`
- M04-T05 variant and style evaluation:
  `sha256:46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e`
- M05-T02 resolved props and named slots:
  `sha256:f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0`

M05-T03 transfers current ownership of the M05-T02 proof library and root mutation suite to a
strict immutable task-time compatibility reader. It authenticates the exact historical artifact
bytes and semantics and rejects successor source/runtime/prerequisite injection. The default
writer preserves the historical file rather than rebuilding it from current renderer code.

## Evidence coverage

Focused runtime tests cover:

- immutable component and behavior delivery for `base` and declared states;
- statically unknown states, parts, and properties rejected at authenticated session ingress;
- dynamically resolved component and behavior property mismatches;
- deep hostile style containment with zero adapter execution;
- render-wide style-validation and schema-evaluation budget exhaustion; and
- identical complete maps delivered while two trusted adapters choose different active states.

Compiler-negative tests reject flat, mutable, array-backed, or executable style contracts.
Hostile root mutations protect both renderer paths, exact capability category selection, validated
value delivery, shared budgets, semantic public types, source/import boundaries, traceability,
historical compatibility, artifact pins, and the atomic writer.

N-029 advances to `TESTED`. N-028 remains `TESTED` with capability-owned production activation
made explicit. N-030 remains `PLANNED`: schema-valid semantic delivery alone does not prove that
concrete target styling preserves host-enforced accessibility.

## Evidence artifact

`docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json`
`sha256:2b0e03e58116d161484cd3c309370ff1ee5003ee6158d4e941749faf0d6797eb`.

The production verifier rejects a pending, moved, duplicated, or mismatched reference and requires
the same exact SHA in the M05-T03 Proof Matrix section.

## Nonclaims

This proof does not claim concrete CSS or native-style translation, host-enforced accessibility
preservation, live events or commands, behavior attachment lifecycle, React instance
reconciliation, production error-boundary UI, reference-host separation, or a non-React
implementation. Those remain assigned to later M05, M09, and M12 tasks.
