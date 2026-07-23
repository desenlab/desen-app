# @desen/testkit

## Responsibility

Synthetic fixtures, host fakes, conformance helpers, trace assertions, and proof artifact utilities.

## Synthetic authoring fixtures

`createSyntheticFixtureSnapshot` consumes the public immutable registrations produced by
`@desen/catalog-sdk`. Callers must opt into the package's single frozen
`SYNTHETIC_FIXTURE_CONTEXT`; there is no production or integration context in this API.
The creation boundary requires that exact singleton by identity. Returned snapshots and lookup
results contain a detached canonical JSON value equal to the singleton, so consumers should use
its fields rather than rely on reference identity. The context records the caller's explicit
classification; it is not a secret, credential, or personal-data detector.

The snapshot:

- projects only `manifest.authoring.fixtures` into its capability maps;
- uses `{ success, errors }` for operation fixtures and rejects error keys that the operation does
  not publicly declare;
- preserves named resource outputs without binding a reader, URL, SDK, or database;
- is detached, canonical-key-ordered, recursively frozen inert JSON; and
- provides explicit `found` or `missing` lookup results instead of using `undefined` as an outcome.

Operation and resource registrations must retain their required frozen Catalog fields and remain
in the correct category. The same capability id cannot be projected in both maps. Inputs are
bounded to 64 nested levels, 20,000 traversed values, and 1,048,576 canonical UTF-8 bytes. Lookup
helpers accept only snapshots created by this process, preventing a forged object from introducing
property getters at the lookup boundary.

```ts
import {
  createSyntheticFixtureSnapshot,
  lookupSyntheticOperationSuccess,
  SYNTHETIC_FIXTURE_CONTEXT,
} from "@desen/testkit";

const fixtures = createSyntheticFixtureSnapshot({
  context: SYNTHETIC_FIXTURE_CONTEXT,
  operations: [registeredOperation],
  resources: [registeredResource],
});

const result = lookupSyntheticOperationSuccess(fixtures, registeredOperation.id);
if (result.status === "found") {
  // result.value is detached, inert, and recursively frozen synthetic JSON.
}
```

The operation and resource registrations in this example are created separately with
`registerOperation` and `registerResource`. M03-T08 passes the exact reference sign-in registration
through this same generic API and proves its synthetic success and `invalidCredentials` outcomes.
There is no sign-in-specific production export or trusted host binding in `@desen/testkit`.
Actual sign-in values and trusted host bindings are not part of this infrastructure.

## Explicit non-responsibilities

- No production runtime dependency on this package.
- Callers must supply no real credentials, personal data, live records, or secrets. M03-T07 uses
  only reviewed generic examples; repository-wide detection remains M12-T04.
- No endpoint, callback, transport, SDK, database, authentication, or authorization binding.
- Runtime-forged top-level manifest binding fields such as `execute`, `handler`, `endpoint`, and
  `read` are rejected; they are never copied or silently activated.
- No production or integration-preview execution mode.
- No output-schema validation; the validator/runtime boundaries own resolved-value validation.

## Status

Private implementation support. The platform-neutral synthetic fixture projection is implemented;
host fakes, trace helpers, and proof utilities remain assigned to their tracked tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral unless explicitly adapted

## Quality

Run the focused checks with:

```bash
pnpm --filter @desen/testkit typecheck
pnpm --filter @desen/testkit test:reference-sign-in-fixtures
pnpm --filter @desen/testkit test:synthetic-fixtures
pnpm --filter @desen/testkit build
```

Use the root workspace quality gate before merging: `pnpm check`.
