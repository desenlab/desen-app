# @desen/reference-catalog-web

## Responsibility

Target-specific Web–React capability packaging, followed by the accessible real components and
exact capability manifests shared by Desen App and the reference host.

## Reference sign-in operation

M03-T08 exposes the frozen DESEN 0.1.0 sign-in contract as inert data at:

```ts
import {
  SIGN_IN_OPERATION_ID,
  signInOperationFixtures,
  signInOperationRegistration,
} from "@desen/reference-catalog-web/operations";
```

`signInOperationRegistration` exactly mirrors `com.example.auth/signIn` from the official Web
Catalog example. Its input and successful-output types derive from the same literal schemas. Its
public errors are `invalidCredentials` and `unavailable`; only `invalidCredentials` has an
authoring fixture. `signInOperationFixtures` is the same recursively frozen object held inside the
registration, so there is no parallel fixture authority.

The inert operation surface and the executable host-operation surface are available only from
their explicit subpaths; neither is re-exported from the package root.

The schema-derived TypeScript types are structural authoring aids, not runtime validation. In
particular, TypeScript cannot enforce `minLength`, and this validator profile treats
`format: email` as an annotation. M04 must validate resolved input before invocation and successful
output before exposure.

The controlled fixture inventory is deliberately small:

- success produces the synthetic output `{ userId: "user-1" }`;
- failure exposes the declared `invalidCredentials` code with an empty inert payload; and
- `unavailable` remains a declared error with no invented fixture.

There is no email, password, endpoint, token, personal record, production response, or
authorization decision in those fixtures. There is also no static `pending` fixture. Pending is a
runtime lifecycle state that M04 will create while an invocation awaits its fixture or host
result.

### Separate trusted host binding

Executable code is available only through a separate opt-in entry point:

```ts
import {
  bindReferenceSignInHostOperation,
  type SignInHostOperationHandler,
} from "@desen/reference-catalog-web/host-operations";

const handler: SignInHostOperationHandler = (input) => {
  // The application composition root owns the actual implementation.
  return applicationSignIn(input);
};

const binding = bindReferenceSignInHostOperation(handler);
```

The factory fixes the capability id, rejects non-functions, retains the handler by identity, and
returns a frozen `{ operationId, invoke }` object. It does not call or wrap the handler, register
global state, perform I/O, or accept a document-selected id, URL, SDK, database, credential, or
authorization policy.

The handler return type is deliberately `unknown`. M03-T08 does not invent a synchronous,
asynchronous, success, or failure transport envelope before the framework-neutral host port
exists. M04 must define that boundary, validate input and successful output, admit only declared
public error codes, implement pending and concurrency semantics, ignore stale results, map
settlements to lifecycle state, and prevent messages, stack traces, secrets, or raw responses from
reaching a design.

## Reference tokens

M03-T07 exposes the target-specific token contract at:

```ts
import {
  REFERENCE_TOKEN_DOCUMENT,
  REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
  REFERENCE_WEB_TOKEN_CSS_REFERENCES,
  resolveReferenceWebToken,
} from "@desen/reference-catalog-web/tokens";
```

`REFERENCE_TOKEN_DOCUMENT` is the single value authority. It uses a strict, documented subset of
the stable DTCG 2025.10 format:

- nested groups with inherited `color` or `dimension` types;
- complete sRGB color values with matching lowercase six-digit hexadecimal fallbacks;
- `px` or `rem` dimensions; and
- whole-token curly-brace aliases whose targets have the same effective type.

The Web provider validates the fixed document when its module initializes and derives immutable
token-value, CSS-custom-property, and CSS-reference maps. Its exact 26 CSS custom properties cover
every variable consumed by Stack, TextField, Button, and Alert. The M03-T07 evidence checks that
each pinned component fallback equals the corresponding DTCG-derived provider value, so standalone
rendering remains deterministic while a host can override the same property at its existing root.

`REFERENCE_WEB_TOKEN_CSS_PROPERTIES` can be assigned to an existing host root's React `style`
property. No provider component, extra DOM wrapper, global stylesheet mutation, network lookup, or
runtime-selected code is created. `resolveReferenceWebToken` returns a frozen discriminated
result; unknown names produce `{ ok: false, code: "UNKNOWN_TOKEN", token }` instead of a guessed
replacement.

This provider is the reference `web-react` package projection. It is not the framework-neutral
DESEN `$token` resolver, does not validate a resolved value against its receiving capability
schema, and does not define token storage for other projects or future native targets. Those
runtime responsibilities remain assigned to M04.

## Accessible component entry point

M03-T05 and M03-T06 expose the first five real Web–React capabilities at:

```ts
import {
  Alert,
  Button,
  Stack,
  Text,
  TextField,
  alertComponentRegistration,
  buttonComponentRegistration,
  stackComponentRegistration,
  textComponentRegistration,
  textFieldComponentRegistration,
} from "@desen/reference-catalog-web/components";
```

The exported registrations mirror the frozen official Web Catalog example exactly:

- `com.example.ui/Stack` is a neutral linear layout container;
- `com.example.ui/Text` is an inert semantic text leaf;
- `com.example.ui/TextField` is a controlled labelled text input with `change` and `focus`
  contracts;
- `com.example.ui/Button` is a native action control with a `press` contract; and
- `com.example.ui/Alert` is an inert feedback message.

All five public prop schemas are closed with `additionalProperties: false`. Their Catalog prop
types derive from those schemas through `@desen/catalog-sdk`; there is no parallel handwritten
Catalog prop contract. Stack adds React `children` only as the target-specific materialization of
its declared `default` slot. The other four capabilities have no declared slot and expose no
arbitrary DOM prop, raw HTML, or executable document value surface.

### Accessibility behavior

- Stack renders a neutral `<div>` with no fabricated ARIA role, landmark, tab stop, reverse flex
  direction, or CSS ordering. Declared child order therefore remains DOM and reading order.
- Stack maps only the declared direction, gap, maximum-width, and cross-axis alignment values.
  Spacing uses `--desen-space-*` variables with pinned provider-compatible fallbacks.
- Text maps `body` → `<p>`, `heading` → `<h2>` beneath the host application's top-level heading,
  and `caption` → `<small>`.
- Text creates an ordinary React text node and never uses `dangerouslySetInnerHTML`, so
  markup-like strings remain inert escaped content.
- TextField uses a real `<label>` and one uniquely associated native `<input>`. It remains
  controlled by the declared `value`, maps `secure` to password mode, uses native `disabled`, and
  maps `invalid` only to `aria-invalid` because the Catalog declares no field-level error text.
- Button uses `<button type="button">`, preserving native pointer and keyboard activation without
  an extra key handler. Native `disabled` prevents activation. Loading remains focusable, reports
  `aria-busy` and `aria-disabled`, and suppresses `press` so an in-flight action cannot be
  duplicated.
- Alert maps `critical` to the assertive `role="alert"` semantic and `info`, `success`, and
  `warning` to the polite `role="status"` semantic. It adds no tab stop, focus movement,
  redundant live-region attribute, or HTML interpretation.

These are documented Web–React target policies, not claims that DESEN 0.1.0 mandates a particular
HTML tree. The policies follow native semantics and keep assistive reading order aligned with
declared content order.

### Trusted interaction boundary

TextField `onChange` and Button `onPress` are trusted adapter bindings, not Catalog props. Each
activation creates a fresh frozen payload containing only the declared inert data: `{ value }` for
`change` and `{}` for `press`. Native React events and DOM nodes never cross this boundary.

TextField exposes a narrow, frozen `TextFieldHandle` for the declared `focus` command. It contains
only `focus()` and is nominally separated from `HTMLInputElement`; a future renderer adapter must
still validate the schema-derived empty command input before calling it. M03-T06 proves this
component-side primitive, not a complete runtime adapter.

The exact Alert contract uses `critical`. `PF-027` records that the abbreviated prose example's
`danger` spelling conflicts with the authoritative Catalog and complete sign-in fixtures; this
package rejects that spelling rather than widening the frozen contract.

All declared style parts remain present in the exact manifests. Applying resolved style-part
values while preserving accessibility is intentionally deferred to M03-T09 and the M05 React
adapter. The reference token contract changes no component prop or style-part schema.

## Web–React package digest profile

M03-T04 defines the versioned `desen.web-react.package-digest` profile here rather than in the
framework-neutral Catalog SDK. The public API:

- exposes the fixed profile metadata and Catalog digest placeholder;
- encodes one deterministic binary preimage from a projected canonical `catalog.json` entry and
  exact target-artifact bytes;
- calculates the DESEN-formatted SHA-256 package digest; and
- verifies a published Catalog by rebuilding the same preimage and comparing its declared digest.

`encodeWebReactPackageDigestPreimage` and `createWebReactPackageDigest` accept
`WebReactPackageDigestCalculationInput`, whose Catalog carries the placeholder.
`verifyWebReactPackageDigest` accepts the separate
`WebReactPackageDigestVerificationInput`, whose Catalog carries the published digest. This keeps
the two operations named explicitly in the public type surface. Because both inputs contain the
protocol-wide `DesenCatalog` type, the placeholder-versus-published distinction is enforced at
runtime rather than claimed as a compile-time refinement.

The preimage starts with a versioned Web–React domain-separation header. It then frames the
canonically ordered entries with explicit big-endian path and content lengths. Artifact paths use
a restricted lowercase-ASCII relative-path grammar and reject Windows device names, while artifact
contents receive no text, newline, minification, source-map, compression, or archive normalization.
Caller array order and Catalog object insertion order do not affect the result; every accepted
path, every Catalog value other than the projected self-digest field, and every artifact byte
does.

A Catalog contains the digest of the package that also contains that Catalog, so hashing its
literal published bytes would be circular. Under the documented `PF-026` decision, calculation
requires a fixed zero-digest placeholder. Verification replaces only a published Catalog's
top-level `packageDigest` with that placeholder before rebuilding the preimage, then requires the
declared value to equal the result. This is a DESEN reference-project profile for the exact
`web-react` target, not a universal DESEN 0.1.0 archive rule.

The implementation copies caller byte views, rejects shared mutable backing memory, returns fresh
preimage bytes, and exposes only detached, recursively frozen audit metadata. Its deterministic
limits are 1,024 target artifacts, 128 Catalog value levels below the root, 100,000 Catalog value
occurrences, 240 path bytes, 16 MiB per entry, and 64 MiB for the complete framed preimage. An
iterative descriptor-based Catalog snapshot enforces depth, node, and canonical-byte budgets
before canonicalization; repeated aliases are counted at every serialized occurrence.

The focused evidence comprises 18 package tests, 5 compiler-negative API cases, 16 independent
root proof/mutation tests, and 269 fixed mutation vectors. It compares the complete preimage with
an independent Node.js framing and SHA-256 oracle.

## Explicit non-responsibilities

- Runtime-core changes, application screens, or protocol extensions
- Generic DESEN `$token` resolution, receiving-schema validation, or project token storage
- Tar, zip, npm archive, signature, authenticity, or remote-code-loading formats
- Catalog/adapter parity or proof that a supplied artifact inventory is complete
- Distributor immutability, exact-package retention, publication, resolution, or activation
- Native package profiles

## Status

Private proof-phase package. The deterministic Web–React package digest profile, the accessible
Stack, Text, TextField, Button, and Alert capabilities, and the DTCG-backed reference Web token
provider are implemented. The exact controlled sign-in fixtures and separately delegated trusted
host binding are also implemented. Complete adapter parity and the final package tuple remain
assigned to M03-T09, M03-T10, and M05.

The M03-T07 evidence recorded that the controlled sign-in fixtures, complete adapter parity, and
final package tuple remain assigned to M03-T08 through M03-T10 and M05. M03-T08 now completes only
the first of those assignments.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Implemented digest-profile target: `web-react`
- Future native targets: separate, explicitly versioned profiles

## Quality

```bash
pnpm --filter @desen/reference-catalog-web typecheck
pnpm --filter @desen/reference-catalog-web test:components
pnpm --filter @desen/reference-catalog-web test:interactive-components
pnpm --filter @desen/reference-catalog-web test:package-digest-profile
pnpm --filter @desen/reference-catalog-web test:sign-in-operation
pnpm --filter @desen/reference-catalog-web test:tokens
pnpm verify:reference-catalog-web-components
pnpm test:reference-catalog-web-components
pnpm verify:reference-catalog-web-form-feedback
pnpm test:reference-catalog-web-form-feedback
pnpm verify:reference-sign-in-fixtures-and-host-binding
pnpm test:reference-sign-in-fixtures-and-host-binding
pnpm verify:web-react-package-digest
pnpm test:web-react-package-digest
pnpm check
```
