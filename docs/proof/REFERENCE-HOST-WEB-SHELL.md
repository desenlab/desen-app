# Reference Host Web shell proof

M05-T07 proves that the first DESEN Web–React production composition root is an independently
built browser application with explicit host ports, a dedicated React root, redacted root-error
policy, and host-owned sticky-failure recovery authority.

## Proven boundary

- `apps/reference-host-web` produces a zero-config Vite application independently of Desen App.
  Each proof build runs twice in fresh output directories and compares the complete regular-file
  inventory and every SHA-256 digest.
- The application accepts one closed `RuntimeReactLiveSurfaceInput`. It reaches the managed tree
  only through `useRuntimeReactSurface` and `RuntimeReactSurfaceBoundary`; its application and
  activation props cannot carry arbitrary React children or a caller-selected recovery key.
- The dedicated React root uses `ignoreRuntimeReactRootCaughtError`. Uncaught, recoverable, and
  whole-root-unmount failures produce only fixed frozen host diagnostics; raw thrown values,
  causes, stacks, and React component stacks are neither inspected nor forwarded.
- An uncaught root failure first tombstones the root and terminally revokes its session and Web
  host authority, then emits the fixed diagnostic. A failed React unmount remains tombstoned and
  keeps the container claim, preventing a second root from attaching to uncertain React state.
- Recovery observes exactly the authenticated session, executable registry, validated Catalog
  set, and browser host authority. Ordinary runtime publication preserves the recovery key.
  Explicit retry or replacement of one of those authorities advances a root-local epoch.
- Runtime-core authenticates the session and original mounted host-port aggregate by exact object
  identity before the host can activate that surface. The closed result exposes no port or
  callback, never reflects into either aggregate, short-circuits dead or forged handles, and
  rechecks live session authority after hostile request-envelope reflection.
- `@desen/runtime-web` captures all nine `RuntimeHostPorts` and fourteen callbacks through
  `createRuntimeHostPorts` without invoking them. Its browser environment is bounded, detached,
  immutable JSON; its epoch clock is finite and nondecreasing; and disposal terminally fences all
  callbacks and subscriptions.
- Navigation receives an additional exact active document/revision assertion before the trusted
  application delegate can run. Root activation joins four independent facts before it accepts
  ownership: the session owns the exact host-port aggregate, the current snapshot owns the exact
  Catalog set, the Web host was configured for that snapshot's exact document and revision, and
  runtime-react recognizes the factory-created executable registry handle. Replacement is fenced
  against cleanup-triggered reentry. Runtime-core still owns active-target validation and
  controlled denial semantics.

The evidence authenticates the existing `R-019`, `R-105`, and `A-013` trace assignments. It does
not change a BCP14 row, proof-claim status, or conformance target.

## Verification

```sh
pnpm --filter @desen/runtime-core typecheck
pnpm --filter @desen/runtime-core test:headless-sign-in
pnpm --filter @desen/runtime-web test:host-authority
pnpm --filter @desen/reference-host-web test:shell
pnpm --filter @desen/reference-host-web build
node --test tests/reference-host-web-shell.test.mjs
node scripts/verify-reference-host-web-shell.mjs
```

The root hostile suite mutation-tests exact production seams, terminal root fencing, reentrant
replacement, all four executable-authority joins, raw-error redaction, recovery authority,
document and host-port identity authentication, dynamic loading, forbidden imports, dependency
allowlists, test and script inventory, canonical trace locations, immutable prerequisites,
symlinks, bounded hostile inputs, deterministic artifact bytes, atomic writing, and the unique
human-readable digest location.

## Scope boundary

This task does not run the official-derived sign-in Bundle, construct the shared reference React
adapter registry, bind the real sign-in operation, or claim pending/failure/retry/success/navigation
execution. M05-T08 owns that integration.

This task also does not make the final “no handwritten managed tree” claim. M05-T09 owns the
TypeScript AST and resolved-import-graph audit, hostile source mutations, and G05 closure.
Channel fetching, package installation, IndexedDB activation, transactional commit, restart
recovery, and last-known-good behavior remain M07 responsibilities. Browser E2E, Desen App parity,
and native runtimes remain later gates.

## Evidence artifact

`docs/proof/artifacts/reference-host-web-0.1.0-shell.json`

`sha256:cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2`
