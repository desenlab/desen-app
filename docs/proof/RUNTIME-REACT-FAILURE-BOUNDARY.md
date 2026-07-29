# Runtime React failure-boundary proof

M05-T06 proves a conservative Web–React production boundary for DESEN 0.1.0. The selected profile
is whole-surface fail-closed: it preserves exact diagnostic identity only for a safely attributable
leaf component and uses a redacted `ADAPTER_FAILURE` with null identity whenever React does not
expose a trustworthy origin.

## Proven behavior

- Unknown component and behavior capabilities fail during bounded all-or-nothing preflight. No
  adapter executes, no React element is returned, and the runtime supplies no placeholder.
- A safely attributable leaf component failure exposes only the frozen six-field diagnostic
  payload. Raw values, stacks, causes, and React component stacks do not cross the public boundary.
- Behavior, non-leaf, descendant-removal, and ambiguous lifecycle failures receive null identity.
  The runtime does not blame the nearest surviving ancestor or claim unsafe sibling continuation.
- The managed tree and trusted host failure UI have two always-mounted sibling provenance
  boundaries during managed-to-failure and failure-to-managed transitions. Host failure UI errors
  retain the exact host-thrown value as the private carrier's `cause` and never become an adapter
  failure.
- Adapter failure remains sticky until trusted host code changes `recoveryKey`. Omitting
  `recoveryKey` is the safe never-retry policy; ordinary results, publications, and reconciliation
  keys cannot silently retry executable code.
- `ignoreRuntimeReactRootCaughtError` is the explicit raw-telemetry suppression policy for a
  dedicated DESEN root. It does not inspect either React callback argument.

## Integration boundary and nonclaims

`RuntimeReactSurfaceBoundary.result` is trusted output from the DESEN runtime, not an arbitrary
untrusted-object parser. Nested DESEN surfaces in one React tree require one deduplicated
`@desen/runtime-react` module instance so private carrier provenance is shared.

React event handlers, arbitrary asynchronous work, SSR boundary containment, shared-root raw
telemetry, `onUncaughtError`, and `onRecoverableError` are not claimed. Failure-UI cleanup
classification is guaranteed only while the containing provenance branch remains mounted; cleanup
during full React-root unmount has no surviving component boundary and remains the M05-T07 host
root policy.

## Verification

```sh
pnpm --filter @desen/runtime-react test:failure-boundary
node --test tests/runtime-react-failure-boundary.test.mjs
node scripts/verify-runtime-react-failure-boundary.mjs
```

At task time, the proof authenticated the exact production source/package boundary, five immutable
prerequisites, 22 focused cases, 9 compiler-negative cases, 25 hostile root mutations, 64 source
assertions, and 16 byte-pinned files. The compatibility verifier pins the immutable task-time M05-T06
artifact—the original task output—and does not rebuild evidence from current successor source or
tests. It cannot refresh task-time tracked-file hashes to later source bytes. It accepts one unambiguous input
source per document, performs bounded canonical regular-file reads with complete before/after file
state checks, authenticates the exact reviewed semantics and globally unique pins, and rejects
additive contradictions in the N-037, P-17, and PF-055 projections. The default write is a true
no-op; an explicit alternate destination receives only an exact authenticated atomic copy.
Successor production-seam mutation coverage belongs to M05-T07 and later evidence.

## Evidence artifact

`docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json`

`sha256:3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723`
