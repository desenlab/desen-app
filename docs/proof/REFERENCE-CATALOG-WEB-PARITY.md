# Reference Web Catalog-to-Implementation Parity Evidence

## Claim

M03-T09 proves that the exact reference sign-in slice has complete, executable-free parity
metadata and real component-side Web–React implementations for every component it declares.

The slice contains exactly:

- `com.example.ui/Stack`;
- `com.example.ui/Text`;
- `com.example.ui/TextField`;
- `com.example.ui/Button`;
- `com.example.ui/Alert`; and
- the explicitly delegated `com.example.auth/signIn` operation.

It declares no behavior or resource. The frozen official Web Catalog additionally contains Map,
Sortable, two other operations, and two resources. This evidence compares the six selected entries
with their official entries exactly; it does not claim to implement or republish the complete
example Catalog. `PF-029` records that boundary.

## Inert parity surface

The public entry point is:

```text
@desen/reference-catalog-web/parity
```

`REFERENCE_WEB_IMPLEMENTATION_METADATA` is canonical, detached, recursively frozen JSON. It
contains no React value, function, handler, module path, URL, selector, loader, endpoint,
credential, SDK, database query, authorization policy, or application code.

For every selected component, the metadata derives the complete prop, slot, event, command,
style-part, and visual-state name inventory from its exact registered manifest. Trusted binding
names are separate from designer-visible props. A missing, extra, wrong-category, or renamed
surface makes the parity proof fail.

The authoring and production roles name the same statically imported real component export and
agree with the Catalog's exact `adapterFidelity: "same"` value. The export labels are evidence
keys, not dynamic module selectors. The operation entry records
`binding: "application-supplied"` and the fixed-id host factory from M03-T08 without carrying an
executable handler.

ADR 0007 keeps this metadata separate from the executable component registry, render-plan
renderer, generic interaction bridge, and command dispatcher assigned to M05.

## Component-side contracts

The cumulative proof re-executes the real built component package rather than trusting the
metadata alone.

- TextField emits a fresh frozen exact `{ value: string }` payload.
- Button emits a fresh frozen exact `{}` payload.
- Both outputs pass their declared Catalog payload schemas; wrong types and extra members fail.
- Native events, targets, current targets, and DOM nodes never cross the callback boundary.
- Disabled TextField and disabled/loading Button states suppress their bridges.
- The exact empty TextField `focus` input passes its command schema; an extra member fails.
- The frozen TextField handle exposes only `focus()` and no DOM ref. It focuses the enabled
  control and leaves a disabled control unfocused.

These checks provide local component-side evidence for `N-033` and `N-034`. They do not implement
the generic runtime allowlist, event bridge, command dispatch, or live-instance selection owned by
M04/M05, so both normative rows remain `PLANNED`.

## Accessibility and style-part boundary

The cumulative accessibility suite preserves:

- Stack's neutral DOM and declared child/reading order;
- Text's native `p`, `h2`, and `small` semantics plus inert text rendering;
- TextField's visible unique label, native input, password, disabled, and invalid semantics;
- Button's native non-submit activation and focus-preserving loading behavior; and
- Alert's polite status versus assertive alert semantics without a fabricated focus surface.

Forged arbitrary DOM props, roles, tab stops, links, raw HTML, native callbacks, and refs do not
become public DESEN surfaces.

Every declared style part has a stable semantic description. `message`, `leadingIcon`, and `icon`
are conditional; the implementation does not fabricate empty content merely to create a node.
M03-T09 does not yet apply resolved design styles or visual-state patches. Therefore `N-030`
retains only local base-semantics evidence and remains `PLANNED` until M05/M09/M12 complete the
resolved-style boundary.

All five selected public prop schemas remain closed, so `S-004` advances to `TESTED`.
`S-001` remains `PLANNED`: shared export identity is only the local prerequisite; actual Desen App
use and fidelity disclosure remain M09 work.

## Trace and claim effect

The artifact binds the exact M03-T09 trace assignments without rewriting the frozen M02-T02
ledger. Strong local package evidence covers `C-017`, `C-019`, `R-006`, `R-020`, `R-066`, `R-084`,
`R-086`, and `A-005`. `R-068` and the remaining routed rows are recorded explicitly as partial or
later editor/runtime responsibilities.

`P-06` advances only to `PARTIAL`: the package proves that authoring and production roles resolve
to the same real component identities, but Desen App, the executable React registry, and the
separately built host do not yet exist. `P-05` and `P-10` remain `PARTIAL`. M03-T10 still owns the
final Catalog identity, real build inventory, package digest, and exact tuple.

## Evidence commands

```text
pnpm generate:reference-catalog-web-parity
pnpm verify:reference-catalog-web-parity
pnpm test:reference-catalog-web-parity
```

Tracked artifact:

```text
docs/proof/artifacts/reference-catalog-web-parity.json
```

The verifier reports the artifact SHA-256. `PROJECT-STATUS.md` records that value so this document
does not create a self-referential hash.

## Scope

This evidence proves inert parity metadata plus direct component-side behavior for one exact
reference slice. It does not prove:

- the complete frozen example Catalog;
- a generic React adapter registry, render-plan renderer, or runtime dispatch;
- resolved style-part or visual-state application;
- a final package tuple or distributable archive;
- npm publication, distributor immutability, package activation, or authenticity;
- Desen App or independently built host identity; or
- native-platform parity.
