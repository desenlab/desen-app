# Desen App input and pending fixture

Task: M10-T02

Status: DONE

P-09: PARTIAL

P-10: PARTIAL

Predecessor artifact: `sha256:779434ca834b8d770c726d905408f0a3d0a7145abbc6eaf2b81f1e77466b46ac`

Historical bridge: `sha256:16f6ec332fb03368e617563560b9930a7608594907ce61d5d15554be4dc7523d`

Final artifact: `sha256:161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d`

## Scope

M10-T02 closes the dedicated complete-input and pending-fixture acceptance slice through the normal
Desen App product UI. A designer starts from the visible zero-project state, creates the admitted
blank project, adds two local states, inserts two TextFields and a Button, and uses no-code controls
to bind the fields and map the Button's Press event to one Catalog operation. The operation recipe
captures the selected Catalog capability, collision-free result alias, schema-compatible state
inputs, explicit concurrency, and `operation.<alias>.pending` Loading reference in one validated
Source mutation. An input gets an automatic state suggestion only when their names match exactly;
otherwise the designer must make the mapping explicitly.

The recipe defaults new connections to **Ignore while running** (`reject`) and supports an exact
repair of one existing root invocation while preserving unrelated actions, settlement branches,
guard, and extensions. An absent optional input remains absent, while an existing advanced input
that the visual state selector cannot represent blocks Repair with an explicit loss-prevention
message. Multiple root invocations are ambiguous and fail closed without exposing a candidate. The
concurrency label states that it governs another invocation of the same result rather than bypassing
the Button's Loading lock. The browser scenario deliberately selects `queue` after confirming the
default so a leaked Enter activation would become observable as another pending invocation after
settlement.

## Runtime and browser evidence

The shared TextField component emits the complete current native input string for every change;
plain and secure fields use that same controlled path. The shared Button maps Runtime Loading to
`aria-busy`, `aria-disabled`, and `data-loading` while remaining focused, and suppresses Press while
Loading. Runtime Core publishes `{ status: "pending", pending: true }` before scheduling host
transport. These are the same package components and lifecycle implementation used by the editor
preview, not a browser-test reconstruction.

The dedicated Chromium scenario sets Secure through the visible Inspector, verifies the resulting
native password input, types the email and password in multiple chunks, and observes the complete
accumulated values. It selects one exact Catalog-derived declared error outcome, invokes the Button,
and observes a real unresolved Promise through Runtime pending state, disabled outcome selection,
enabled explicit completion, and Button Loading semantics. Enter is pressed while the focused
Button is busy; the queue-enabled Source makes any leaked second Press observable. Pending state and
complete input values survive Design → Run presentation changes without a Runtime replacement or
Source mutation.

Explicit fixture completion produces only the generic terminal controller status required by this
task. The outcome selector re-enables, completion disables, Loading attributes clear, input values
remain intact, no Alert is asserted, and the route does not navigate. That intentionally proves
terminal cleanup without consuming M10-T03's visible failure-state scope or M10-T04's success and
navigation scope. The browser crosses two animation frames after settlement before asserting this
terminal state, so a delayed queued invocation would be visible rather than hidden by an immediate
assertion.

## Synthetic safety and direct authority

Run exposes only the synthetic fixture context. Integration and Production remain visibly
unavailable. Outcome inventory is derived from the current Source alias and authenticated Catalog
authoring fixtures. The controller verifies exact document, surface, revision, capability, alias,
and effect authority, but deliberately never reads or retains operation input. It keeps the call as
one unresolved Promise until explicit completion; deactivate, replacement, and dispose revoke
pending work with a controlled denial.

The deterministic artifact directly authenticates the immutable 19,299-byte M10-T01C predecessor
by exact byte length, SHA-256, JSON identity, and closed claims. It does not import or invoke the
T01C reader. The separately pinned T01C historical bridge is authenticated by compressed bytes and
hash before bounded gzip decompression, canonical dense JSON reconstruction, exact base commit,
sorted safe path inventory, canonical base64, decoded-byte budget, and byte-identical parent
projection. A factory-authenticated successor handle exposes defensive task-time file copies to the
historical T01C reader; task-time bridge bytes are materialized first and caller mutations override
only their exact paths.

The artifact binds exact receipts for the App connection and fixture sources, shared TextField and
Button implementations, Runtime operation lifecycle, focused positive and negative tests, the
dedicated browser scenario/configuration, package scripts, bridge reproduction/fixture files,
immutable parent and bridge, and passive proof entrypoints. The deterministic verifier starts no
product server, browser, listener, or external host.

```bash
pnpm --filter @desen/app-web exec vitest run test/authoring-connections.test.ts test/behavior-controls.test.tsx test/authoring-fixtures.test.ts
pnpm --filter @desen/reference-catalog-web exec vitest run test/interactive-components.test.tsx
pnpm --filter @desen/runtime-core exec vitest run test/operation-lifecycle.test.ts
pnpm --filter @desen/app-browser-e2e exec playwright test --config input-pending-playwright.config.ts
node scripts/verify-desen-app-input-pending-fixture.mjs
node --test tests/desen-app-input-pending-fixture.test.mjs
```

## Explicit nonclaims

The selected declared error is used only to demonstrate a generic terminal fixture cleanup. Visible
public failure presentation remains M10-T03. Success, navigation, and a separately authorized real
host operation remain M10-T04. Integration, Production, production execution, and N-036 are not
proven. P-09 and P-10 remain `PARTIAL`; G10 remains open. Local artifact, focused-test, and Chromium
results do not imply a hosted exact-head Quality gate pass.
