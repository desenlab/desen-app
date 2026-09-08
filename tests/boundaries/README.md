# Dependency-boundary fixtures

These fixtures prove that the architecture gate fails for representative forbidden imports and
continues to accept a documented dependency. They are intentionally outside `apps/` and
`packages/`, so the normal workspace cruise does not treat their violations as product code.

The fixture set includes a direct `catalog-sdk` → `runtime-react` edge so the platform-neutral
manifest boundary remains executable rather than documentation-only.

The Desen App browser-proof fixtures separately prove its two deny-by-default boundaries: the
allowed case composes only `editor-core` plus the reviewed App application, empty-project, and
stylesheet entries; one negative case rejects an undeclared `publisher` package edge, and another
rejects an unreviewed App source entry.

The normal-product browser proof has two exact file-scoped composition edges. Its positive
fixtures accept only `product-proof-server.mjs` loading the built public Control Plane `index`
entry and the same `apps/desen-app/dev/local-operation-host.mjs` listener used by the normal
developer launcher. Reusing that listener keeps the real-host browser proof from supplying its
own substitute implementation. Negative fixtures reject both edges from other proof files,
deep/private Control Plane modules, neighboring unreviewed App dev modules, and
every other application root from the product server.
The exception grants no access to the App source tree or the rest of its dev directory.

The restart-recovery proof has a separate exact server entry. Only
`restart-recovery-proof-server.mjs` may combine the public built Protocol digest API, public
Control Plane and reference-host server roots, and the existing local publication bridge. Its
positive fixture covers those four edges. Negative fixtures reject private Control Plane,
reference-host and Protocol modules, Publisher, other App source/dev modules, and public Protocol
access from an ordinary browser-proof file. This does not give browser code publication or
storage authority. All 38 cases run against the real root configuration.

Run them after installing workspace dependencies:

```bash
node scripts/verify-boundary-fixtures.mjs
```

Adding or changing a boundary rule requires one fixture that would fail if that rule disappeared.
