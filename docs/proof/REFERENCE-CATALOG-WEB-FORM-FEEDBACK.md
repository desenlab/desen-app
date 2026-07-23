# Reference Web Form and Feedback Component Evidence

## Claim

M03-T06 extends the M03-T05 Stack/Text foundation with the frozen DESEN 0.1.0 Web Catalog's
`com.example.ui/TextField`, `com.example.ui/Button`, and `com.example.ui/Alert` capabilities as
real accessible Web–React components.

The tracked proof requires:

- the M03-T05 evidence verifier and exact predecessor artifact to pass before this cumulative
  result is built;
- all five component registrations to equal the corresponding frozen official Catalog entries;
- every public prop schema and both declared interaction payload schemas to remain closed;
- a cumulative five-component Catalog and controlled Source to pass the built structural,
  semantic, component, interaction, binding, and execution validators;
- every new component to reject one undeclared prop, every required new prop to fail at its exact
  pointer when absent, and Alert `danger` to fail as a prop type mismatch;
- TextField `change`, Button `press`, and TextField `focus` inputs to pass only through their exact
  detached validator contracts;
- the built component package, declaration surface, React peer boundary, focused tests, and
  compiler-negative inventory to remain fixed;
- TextField to retain a visible unique native label, Button to retain native non-submit semantics,
  and Alert to avoid a fabricated focus surface; and
- independent server-rendering and interaction oracles to execute 279 fixed vectors.

The evidence uses the official capability identifiers because the frozen sign-in Source and Bundle
refer to those exact values. It introduces no Desen-specific alias or translation layer.

## Exact contracts

TextField requires `label` and controlled `value` strings. Its optional `placeholder`, `secure`,
`disabled`, and `invalid` values remain schema-derived booleans or strings. It declares a
`change` event with exact `{ value: string }` payload and a `focus` command with exact empty-object
input.

Button requires `label`, permits only the `primary`, `secondary`, and `danger` variants, and has
optional `loading` and `disabled` booleans. Its `press` payload is exactly `{}`.

Alert requires `tone` and `text`. Its tone is exactly `info | success | warning | critical`;
`danger` remains a Button variant and is not an Alert alias. `PF-027` records the conflicting
spelling in the abbreviated protocol prose without modifying the frozen DESEN 0.1.0 snapshot.

All Catalog properties derive from the literal registered schemas through `@desen/catalog-sdk`.
React callbacks and refs are trusted host bindings and never become DESEN document values.

The controlled proof Source connects TextField `change` to
`state.set(fieldValue <- event.value)` and Button `press` to
`component.command(main.field.focus, {})`. The execution validator retains exactly one runtime
obligation for the event-derived state write, with its pointer and context pinned. The proof does
not misrepresent that dynamic value as statically resolved.

## Accessibility interpretation

- TextField renders one real `<label>` associated through a React-generated unique identifier with
  one controlled native `<input>`. `secure` selects password mode, `disabled` uses native disabled
  semantics, and `invalid` adds only `aria-invalid` because the Catalog declares no field-level
  error message.
- Button renders `<button type="button">`. Native click and keyboard activation share one path,
  and there is no extra keyboard handler or toggle/submit behavior. Loading preserves focus,
  reports busy and disabled semantics, and suppresses the trusted press bridge.
- Alert maps `critical` to `role="alert"` and lower-urgency tones to `role="status"`. It adds no
  tab stop, focus movement, explicit live-region attribute, or raw-HTML path.
- Every user-controlled string remains an ordinary escaped React text or attribute value.

These are explicit Web–React target policies, not a claim that the framework-neutral protocol
mandates a particular HTML tree. Complete resolved style-part and adapter parity remains assigned
to M03-T09.

## Interaction boundary

TextField emits a new frozen `{ value }` object and Button emits a new frozen `{}` object for each
accepted native activation. Neither surface exposes a native React event, event target, or DOM
element. Disabled TextField bridges and disabled/loading Button bridges are suppressed.

The narrow frozen `TextFieldHandle` contains only `focus()` and is nominally distinct from
`HTMLInputElement`. A renderer adapter must validate the schema-derived empty command input before
calling that trusted method. This task proves the component-side event and command primitives; it
does not claim the M05 production adapter exists.

## Deterministic evidence

The fixed vector inventory contains:

- 108 TextField state render vectors, 42 TextField string vectors, and 14 change-payload vectors;
- 36 Button state render vectors, 14 Button string vectors, and 9 press-payload vectors; and
- 56 Alert tone/string render vectors.

That is 279 vectors in total: 256 independently server-rendered vectors and 23 interaction
vectors. The focused package layer adds 11 behavior tests and 22 compiler-negative API cases. The
independent root suite fixes its complete test-title inventory and mutates manifests, public APIs,
native semantics, source files, declarations, package exports, commands, provenance, prerequisite
evidence, and validation outcomes.

Production evidence accepts only own, plain, fixed-default options. Explicit API or path
substitution is labeled injected evidence and cannot verify or write the tracked artifact. Realpath
and symlink checks prevent an alternate file from claiming the production result. Tracked source
hashes and syntax-tree audits close the reviewed implementation and public API inventories without
making the M03-T05 foundation proof own later-growing files.

## Evidence commands

```text
pnpm generate:reference-catalog-web-form-feedback
pnpm verify:reference-catalog-web-form-feedback
pnpm test:reference-catalog-web-form-feedback
```

Tracked artifact:

```text
docs/proof/artifacts/reference-catalog-web-form-feedback.json
```

The verifier reports the artifact SHA-256. `PROJECT-STATUS.md` records that value so this proof
document does not create a self-referential hash.

## Scope

M03-T06 supplies three interaction-capable components and their exact Catalog contracts on top of
the proven M03-T05 foundation. It does not complete G03 or advance a `P-*` claim. Reference tokens
remain M03-T07, sign-in success/failure fixtures and host operation binding remain M03-T08,
complete manifest/implementation parity remains M03-T09, and the reproducible final package tuple
remains M03-T10. Runtime materialization and command dispatch remain M05 responsibilities.
