# @desen/reference-catalog-web

## Responsibility

Target-specific Web–React capability packaging, followed by the accessible real components and
exact capability manifests shared by Desen App and the reference host.

## Final reference capability artifact

M03-T10 ships the exact DESEN 0.1.0 reference sign-in slice as the data-only package subpath
`@desen/reference-catalog-web/catalog.json`. It has this distinct Catalog identity:

```text
id      = run.desen.reference.sign-in
version = 0.1.0
target  = web-react
```

The fourth tuple member is the exact lowercase `sha256:` value in the shipped Catalog's
`packageDigest` field. Together, `{ id, version, target, packageDigest }` is the immutable
capability-package tuple. The generated
`docs/proof/artifacts/reference-catalog-web-capability-artifact.json` record is the machine-readable
audit authority for that tuple, its exhaustive inventory, and the result of rebuilding it; the
companion `docs/proof/REFERENCE-CATALOG-WEB-CAPABILITY-ARTIFACT.md` explains the boundary and
evidence for people.

The logical artifact covered by that digest is exactly:

1. the Catalog represented as RFC 8785-compatible canonical `catalog.json` bytes under the
   documented self-digest projection; and
2. every regular file beneath `dist/`, using its package-relative path and exact file bytes.

No file in `dist/` may be silently omitted, and no file outside that boundary is silently added.
The shipped `catalog.json` is inert data: this package adds no Catalog loader, executable registry,
dynamic import route, or registration side effect. React adapter registration and runtime
materialization remain assigned to M05.

This logical digest does not claim that dependency packages, a workspace lockfile, source files,
`package.json`, filesystem metadata, or npm/tar archive bytes are recursively covered or
reproducible. The explicit JSON export makes the proved Catalog available to package consumers; it
does not turn npm resolution, dependency integrity, publication, signature verification, remote
retention, or activation policy into M03 responsibilities.

## Implementation parity metadata

M03-T09 exposes the exact sign-in reference-slice contract at:

```ts
import { REFERENCE_WEB_IMPLEMENTATION_METADATA } from "@desen/reference-catalog-web/parity";
```

This recursively frozen value is inert JSON. It covers exactly the five implemented UI
capabilities plus `com.example.auth/signIn`; its behavior and resource maps are deliberately
empty. The frozen official Web Catalog also contains Map, Sortable, additional operations, and
resources, so this package claims exact equality only for the selected entries. `PF-029` prevents
the partial slice from impersonating the complete example Catalog.

For every component, the metadata derives the exact prop, slot, event, command, style-part, and
visual-state names from the registered manifest. It separately records trusted component-side
bindings such as `default → children`, `change → onChange`, `press → onPress`, and
`focus → ref.focus`. Those binding names are not DESEN props.

The production and authoring roles name the same statically exported component and agree with
`adapterFidelity: "same"`. Export names are audit labels, not module specifiers or a dynamic code
loader. The metadata carries no React value, callback, handler, URL, selector, endpoint, SDK,
database operation, credential, or authorization policy.

Every declared style part has stable semantic documentation. `message`, `leadingIcon`, and `icon`
are conditional because no empty placeholder content is fabricated when their trusted content is
absent. M03-T09 does not apply resolved design styles or visual states; M05-T03 remains responsible
for that adapter behavior and for proving that styling cannot suppress host-enforced accessibility.

The parity evidence resolves the named exports through static imports and exercises the real
component-side event, command, and accessibility primitives. It does not create a component lookup
map, render-plan renderer, generic event bridge, command dispatcher, style applicator, or React
adapter registry. Those runtime responsibilities remain in M04 and M05 under ADR 0007.

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
values while preserving accessibility is intentionally deferred to the M05 React adapter.
M03-T09 documents parity metadata but does not apply styles. The reference token contract changes
no component prop or style-part schema.

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
- Dependency-tree, source-tree, package-manager-metadata, or archive-byte reproducibility
- Distributor immutability, exact-package retention, publication, resolution, or activation
- Executable React adapter registration, lookup, materialization, or dispatch
- Native package profiles

## Status

Private proof-phase package. The deterministic Web–React package digest profile, the accessible
Stack, Text, TextField, Button, and Alert capabilities, and the DTCG-backed reference Web token
provider are implemented. The exact controlled sign-in fixtures and separately delegated trusted
host binding are also implemented. Inert Catalog-to-implementation parity metadata and cumulative
component-side contract tests are implemented by M03-T09. M03-T10 now ships the distinct
`run.desen.reference.sign-in@0.1.0` Catalog, exhaustive logical artifact inventory, and exact
immutable `web-react` tuple. Executable React adapter registration remains M05.

The M03-T07 planning baseline recorded that the controlled sign-in fixtures, complete adapter
parity, and final package tuple remain assigned to M03-T08 through M03-T10 and M05. M03-T08 and
M03-T09 completed the first two scoped slices; M03-T10 completes the inert capability artifact
without moving runtime registration out of M05.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Implemented digest-profile target: `web-react`
- Future native targets: separate, explicitly versioned profiles

## Quality

```bash
pnpm --filter @desen/reference-catalog-web typecheck
pnpm --filter @desen/reference-catalog-web test:components
pnpm --filter @desen/reference-catalog-web test:interactive-components
pnpm --filter @desen/reference-catalog-web test:parity
pnpm --filter @desen/reference-catalog-web test:package-digest-profile
pnpm --filter @desen/reference-catalog-web test:sign-in-operation
pnpm --filter @desen/reference-catalog-web test:tokens
pnpm verify:reference-catalog-web-components
pnpm test:reference-catalog-web-components
pnpm verify:reference-catalog-web-form-feedback
pnpm test:reference-catalog-web-form-feedback
pnpm verify:reference-sign-in-fixtures-and-host-binding
pnpm test:reference-sign-in-fixtures-and-host-binding
pnpm verify:reference-catalog-web-parity
pnpm test:reference-catalog-web-parity
pnpm verify:reference-catalog-web-capability-artifact
pnpm test:reference-catalog-web-capability-artifact
pnpm verify:web-react-package-digest
pnpm test:web-react-package-digest
pnpm check
```
