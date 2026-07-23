# Reference Sign-In Fixtures and Trusted Host Binding Evidence

## Claim

M03-T08 adds one deliberately narrow reference slice:

- the exact inert `com.example.auth/signIn` operation registration and its authoring-only success
  and public-error fixtures are exposed from
  `@desen/reference-catalog-web/operations`; and
- an application may explicitly import
  `@desen/reference-catalog-web/host-operations` to bind that fixed capability identifier to
  trusted executable code that the application supplies.

These are separate package subpaths with separate responsibilities. The `operations` subpath is
data-only. The `host-operations` subpath is executable and opt-in. A DESEN Source, Bundle, Catalog,
manifest, fixture, or design document cannot import the executable subpath, provide a handler, or
select an endpoint, SDK call, database query, authentication mechanism, or other implementation
detail. Neither subpath is re-exported from the package root.

This task is a bounded delegation proof, not a complete production authentication implementation
or a complete operation runtime.

## Exact inert operation and fixture boundary

The registration mirrors the frozen DESEN 0.1.0 example Catalog:

- capability id: `com.example.auth/signIn`;
- input: a closed object requiring an `email` string annotated with `format: email` and a
  non-empty `password` string;
- successful output: a closed object requiring a string `userId`;
- declared public errors: `invalidCredentials` and `unavailable`;
- effect: `network`;
- successful authoring fixture: `{ "userId": "user-1" }`; and
- failure authoring fixture: `invalidCredentials` with the empty payload `{}`.

The successful fixture is checked against the declared output schema. Failure fixtures are keyed
only by declared public error codes; they do not carry an exception, message, stack, transport
response, provider payload, or private diagnostic detail. The official example does not provide an
`unavailable` fixture, so the reference package does not invent one.

There is intentionally no `pending` fixture. `pending` is runtime lifecycle state entered while an
invocation is unresolved, not a static success or failure payload permitted by the frozen Catalog
fixture schema. M04-T09 owns that lifecycle transition and its later evidence.

The registration declares the required email/password input shape, but the fixture data contains
no credential values or secrets. The fixtures are inert, recursively immutable, synthetic
authoring data projected through `@desen/testkit`; they do not call or stand in for a production
service.

## Trusted host binding boundary

`bindReferenceSignInHostOperation(handler)` produces a frozen object with exactly:

```text
{ operationId, invoke }
```

`operationId` is fixed to `com.example.auth/signIn`. `invoke` is the exact
application-supplied handler retained by identity. The handler accepts the schema-derived sign-in
input and has a deliberately opaque `unknown` return type.

The factory validates only that a JavaScript caller supplied a function. It performs no I/O, does
not call the handler, does not wrap it, and creates no global registry. Invocation happens only
when trusted application code later calls `binding.invoke(...)`; any returned value comes directly
from the supplied handler without being interpreted at this boundary.

The package does not provide a real authentication handler, backend, authorization policy,
endpoint, credential source, secret, SDK integration, database query, or production fake. A future
host application composition root must supply those concerns under its own trust and authorization
policy.

## The opaque handler is not a runtime port

M03-T08 intentionally does not choose a synchronous-versus-asynchronous return policy or invent a
success/failure transport envelope. DESEN 0.1.0 does not define that host API shape, and M04 owns
the generic port. A handler return is therefore untrusted and uninterpreted until that future
boundary validates and sanitizes it.

In particular, M03-T08 does not implement:

- synchronous entry into `pending`;
- operation aliases or lifecycle references;
- reject, replace, or queue concurrency;
- cancellation, retries, timeouts, or stale-result protection;
- runtime diagnostics or settlement actions; or
- runtime validation and safe exposure of a host-produced result.

M04 must validate a successful candidate value against the declared output schema before exposing
it to a running design. It must also reject or sanitize undeclared runtime failures and must not
expose private messages, raw responses, or implementation details. M04-T01 defines the generic
host port, M04-T09 defines operation lifecycle and concurrency, and M04-T11 owns settlement
actions.

## Automated evidence expectations

The tracked evidence requires the completed M03-T07 artifact as a verified prerequisite and checks
the built package rather than relying only on source imports. It covers:

- byte-exact agreement with the frozen sign-in operation manifest;
- schema validity of the successful fixture and declared-code validity of the failure fixture;
- absence of `pending`, credential values, secrets, executable values, and host binding data from
  synthetic fixture snapshots;
- recursively immutable registration and fixture data;
- exact, non-wildcard public exports for inert operations and executable host operations, with no
  default export, side-effect import, extra runtime export, or package-root leakage;
- the fixed operation id, frozen binding shape, preserved handler identity, and absence of eager
  handler invocation or wrapping;
- rejection of non-function handlers;
- closed TypeScript input, output, error, and binding contracts without a premature result
  envelope;
- exact local import-graph plus source/distribution audits for forbidden document-selected
  implementation details and platform leakage; and
- deterministic evidence generation plus mutation checks for manifest, fixture, public API,
  package-boundary, test-inventory, command-wiring, prerequisite, and artifact drift.

No passing test count is asserted in this document. The deterministic artifact is the authority for
the exact evidence inventory and its hash.

## Evidence commands

```text
pnpm generate:reference-sign-in-fixtures-and-host-binding
pnpm verify:reference-sign-in-fixtures-and-host-binding
pnpm test:reference-sign-in-fixtures-and-host-binding
```

Tracked artifact:

```text
docs/proof/artifacts/reference-sign-in-fixtures-and-host-binding.json
```

The verifier reports the artifact SHA-256. The project status ledger records that value after the
tracked artifact has been generated and independently verified.

## Coverage status after M03-T08

- `C-018` — `PARTIAL`: the exact sign-in operation is explicitly delegated to a separately
  imported trusted host binding. Complete manifest-to-binding agreement for every declared
  capability remains M03-T09 and M10-T04.
- `R-092` — `PARTIAL`: the binding fixes a capability id and accepts trusted code outside design
  data; no document-selected endpoint, SDK, database, service, or authentication mechanism exists.
  Final host and repository source audits remain M10-T04 and M12-T03.
- `R-100` — `PARTIAL`: authoring uses synthetic fixtures while executable host integration stays
  separate and opt-in. There is no integration-preview mode, real production call, explicit
  preview authorization flow, or visible context labeling yet; those remain M09-T11 and M12-T04.
- `P-10` — `PARTIAL`: this reference slice demonstrates that its real host operation stays outside
  design documents. The production-like host proof and complete source audit remain M10-T04.
- `N-036` — `PLANNED`: the local fixtures contain reviewed synthetic data and no credential values
  or secrets, but authoring disclosure and repository-wide secret, personal-data, and live-data
  audits remain M09-T11 and M12-T04.
- `N-040` — `PLANNED`: this local Catalog fixture slice is synthetic and inert, but complete
  Bundle/Catalog secret scanning and the repository-wide synthetic-data audit remain M12-T04.

`PARTIAL` records bounded evidence, not protocol conformance for the complete application.
`N-036` and `N-040` remain `PLANNED`; this task must not relabel either mandatory clause as tested
or complete.

## Honest non-claims and next ownership

M03-T08 does not complete Catalog-to-implementation parity, the final immutable capability
artifact tuple, the framework-neutral runtime, the React runtime, the reference host, Desen App,
or an end-to-end sign-in flow.

- M03-T09 owns complete Catalog/implementation parity.
- M03-T10 owns the final immutable capability artifact and exact tuple.
- M04 owns host ports, runtime resolution, lifecycle, validation, concurrency, settlement, and
  deterministic headless sign-in behavior.
- M05 owns the independently built reference host and the real adapter-driven sign-in surface.
- M09 owns authoring scenarios, visible context labels, and explicit integration-preview
  authorization.
- M10-T04 and M12 own the production-like host, source, secret, and fixture audits required to
  close the remaining proof claims.
