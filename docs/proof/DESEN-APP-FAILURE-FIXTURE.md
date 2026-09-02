# Desen App failure fixture

Task: M10-T03

Status: DONE

P-09: PARTIAL

P-10: PARTIAL

Predecessor artifact: `sha256:161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d`

Historical bridge: `sha256:a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10`

Final artifact: `sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`

## Scope

M10-T03 closes the dedicated visible public-failure acceptance slice through the ordinary Desen App
product. Starting from the current authenticated profile's visible blank project, a designer uses
normal controls to create controlled email and secure-password state, connect a Button to the exact
Catalog operation, and author a critical Alert whose complete visibility predicate follows
`operation.signIn.status == "failed"`. The journey uses no Advanced JSON, direct DOM mutation,
network shortcut, or proof-only product route.

The only admitted failure outcome is the authenticated Catalog fixture
`error:invalidCredentials`. `unavailable` remains a declared public error but has no invented
fixture. Integration and Production remain visibly disabled, and the synthetic fixture controller
neither reads nor retains operation input.

## Runtime and browser evidence

The Alert is absent before invocation and throughout a real unresolved Runtime pending interval.
Explicit fixture completion publishes the exact declared public failure, reveals the managed
critical `role="alert"` surface through normal predicate reevaluation, clears accessible Button
Loading, preserves both complete input values, and keeps the App on the sign-in route.

A second Button activation is a real retry. Its pending lifecycle hides the previous failure Alert
and restores Loading; a second explicit `invalidCredentials` settlement reveals the same Alert
again. The exact `420 × 720` portrait frame and horizontal document geometry remain stable across
idle, pending, first failure, retry pending, and repeated failure. Browser code uses no direct
network request or managed-DOM mutation to create either result.

Focused positive and negative coverage also binds the generic product-composition guard, public
Editor condition projection, Catalog fixture inventory, declared-failure versus technical-failure
containment, managed conditional remove/restore behavior, controlled reference components, and
Runtime pending/failure semantics. The reusable App path does not contain an
`invalidCredentials`-specific execution branch.

## Deterministic authority

The 16,868-byte immutable artifact contains 34 exact tracked receipts and is pinned at
`sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`. It directly
authenticates the immutable M10-T02 input/pending artifact before deriving the T03 successor.

The separately pinned 2,491,742-byte canonical gzip bridge is
`docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz` at
`sha256:a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10`. Bounded
decompression yields 3,728,371 bytes and 25 task-time files from exact base commit
`d2c632f2cacab5d316d57aa3d51758d2a76d3cd2`; it reconstructs the historical T02 reader inputs
without rewriting the immutable predecessor artifact.

The deterministic verifier starts no Chromium, Vite server, listener, network request, or external
host. Real-browser execution remains a separate authority:

```bash
pnpm --filter @desen/app-web exec vitest run test/evergreen-product-composition.test.tsx test/authoring-behavior-projection.test.ts test/authoring-conditions.test.ts test/authoring-connections.test.ts test/behavior-controls.test.tsx test/authoring-fixtures.test.ts
pnpm --filter @desen/reference-catalog-web exec vitest run test/interactive-components.test.tsx
pnpm --filter @desen/runtime-core exec vitest run test/operation-lifecycle.test.ts test/headless-session.test.ts
pnpm --filter @desen/app-browser-e2e exec playwright test --config failure-playwright.config.ts
node scripts/verify-desen-app-failure-fixture.mjs
node --test tests/desen-app-failure-fixture.test.mjs
```

The deterministic reader binds 139 focused `it`/`it.each` declaration sites. Actual focused Vitest
execution passes 144/144 (App 52, reference components 11, Runtime 81); the dedicated Chromium
configuration passes 1/1, and the independent root mutation reader passes 10/10.

## CI successor authority

The neutral CI inventory contains 214 workloads / 102 proof units at
`sha256:c1cec82a944152060e00caa1ad6f500c7f7e391d7056fe84f61967aef62ef947`, split into 91
ordinary pairs and 11 barrier pairs. Its prerequisite authority binds 735 segments at
`sha256:c1e1319ae65ec34b30f5b8817f5e6396271756bbdd95d4a964b858d7f7dd3c95`, 4,535 leaf
invocations at `sha256:752e23e301be0554677726de380410fca522ef97ad3e72dbbe37321985d58de8`, and
325 distinct leaves at `sha256:2ef89a9ee2dc93cd70edfa71be2cda15628094bb03da8ac56a4e310d6870c0dd`.

The impact graph is
`sha256:91645dd903e4ade7f10f54dd6b07c65a49b355921a35946ee305ee9782aad0ee`. Its M10-T03
closure contains 70 proof units / 150 workloads at
`sha256:52619a1053d46d20e6efedc7e5e1b17dee372fe63c5438dd14c768ac7ff25cfa`. Exact-one
ownership covers 1,377 tracked paths / 204 proof-owned paths, with path-set
`sha256:c7c9fe627f39e1fc10ccb5e6aec133ede0eb3f19c6bb7df89caa9023e9d1b48e` and authority
`sha256:903c1fabc314e2558e05aff85b810d279b045efdfd52494c2f08b281808533db`. The promoted selector
is `sha256:cb0638a65d9ba9bfcfecb780921a195da4c19de5af9512fb2a5169ecbf18fb2f`; its runner authority
is `sha256:ba00d7c81ca4392d50b0fc869434d531acd82a949cde376de051f93261e6f723`.

Checkpoint sequence 68 preserves sequences 1–67 and closes 56 artifacts / 112 current readers at
`sha256:e685779412ca17b76c78a56ff545bbff5a7fc5efc8bc564247cc49e7c54eeca8`. Its checkpoint suite
passes 91/91.

## Explicit nonclaims

M10-T03 proves one authored visible public failure and retry matrix over the exact M10-T02
input/pending predecessor. It does not prove success, navigation, or a separately authorized real
host operation; those remain M10-T04. Integration and Production execution, production credentials,
N-036, remote or multi-user deployment, P-09/P-10 closure, and G10 remain unproven. Local artifact,
focused-test, and Chromium results do not imply a hosted exact-head `Quality gate` pass.
