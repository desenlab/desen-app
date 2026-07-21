# Engineering Standards

## Correctness before optimization

Implement protocol-observable behavior in the simplest complete form. A first runtime may
re-evaluate an entire surface after a state change. Optimize only after deterministic behavior and
trace tests exist.

## TypeScript

- Use strict TypeScript with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Do not use `any` at protocol, host-port, capability, or public API boundaries.
- Parse and validate untrusted values before narrowing them.
- Prefer discriminated unions for state machines and result types.
- Keep DESEN document values JSON-serializable.
- JSON Schema is authoritative. TypeScript or runtime schemas must be generated from or checked
  against it; they cannot become a second independent contract.

## Public APIs

- Every public export has TSDoc describing purpose, invariants, errors, and lifecycle.
- Public APIs use stable diagnostic codes and JSON Pointers where applicable.
- Do not expose framework types from platform-neutral packages.
- Breaking API changes require an ADR and, after publishing is enabled, a changeset.

## Architecture boundaries

- Packages never import applications.
- Internal package and application dependencies are deny-by-default and must match the allowlist
  in `docs/architecture/ARCHITECTURE.md`.
- `protocol`, `validator`, `publisher`, `catalog-sdk`, `runtime-core`, and `editor-core` never
  import React, React Native, DOM, CSS, Node built-ins, browser storage, fetch, or app code.
- `publisher` never depends on runtime or editor packages.
- `catalog-sdk` never exposes framework adapter types; target adapter registries belong to the
  corresponding renderer package.
- Production source never imports `testkit`, and the reference host never imports authoring or
  publisher packages.
- Bundles never name code that the host fetches and executes dynamically.
- Capability implementations remain black boxes behind their declared contracts.
- Active and staged revisions are separate states.
- Durable activation commits active, previous-good, and generation pointers in one transaction
  before the new revision becomes visible in memory.

TypeScript environment configurations reinforce these boundaries:

- `tsconfig.base.json` is ECMAScript-only;
- `tsconfig.react.json` adds JSX without DOM;
- `tsconfig.browser.json` and `tsconfig.react-web.json` add browser APIs; and
- `tsconfig.node.json` adds Node APIs only for server and tooling entry points.

## Tests

Every behavior task includes:

- one positive test;
- relevant negative and boundary tests;
- stable, deterministic fixtures;
- no real credentials or personal data; and
- proof evidence when the behavior supports a public claim.

Use unit tests for pure semantics, property tests for invariants and determinism, integration tests
for package boundaries, and Playwright for the Desen App-to-host proof.

Every dependency-boundary rule has a representative negative fixture. Run the fixture audit with:

```bash
node scripts/verify-boundary-fixtures.mjs
```

An architecture change is incomplete until both the normal workspace cruise and the negative
fixture audit pass.

## Comments

Write comments for:

- why an invariant exists;
- why a tempting alternative is unsafe;
- ordering or concurrency guarantees;
- protocol language that is easy to misread; and
- intentional implementation-profile decisions.

Do not comment obvious assignments, loops, or function names.

## Error handling

- Never silently recover by changing protocol meaning.
- Unknown capabilities, properties, slots, events, or actions fail with stable diagnostics.
- Public errors contain no secrets, stack traces, raw provider errors, or private response data.
- Production activation preserves last-known-good on every preflight or staging failure.

## Dependencies

- Add a dependency only when it meaningfully reduces correctness or maintenance risk.
- Pin exact development-tool versions in the root workspace.
- Review licenses and package contents before public release.
- Avoid dependencies that evaluate code from DESEN documents.

## Required local gate

```bash
pnpm check
```

Task-specific gates may add coverage, browser, conformance, artifact, or security checks.
