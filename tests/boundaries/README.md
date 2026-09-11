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
storage authority.

The repeatable-demo proof has one separate exact edge: `repeatable-demo-proof-server.mjs`
may invoke `apps/desen-app/dev/local-demo-host.mjs`, the same seed/reset lifecycle as the
human CLI. It cannot compose another App dev module, the App source tree, even the public
Control Plane root, or any workspace package. An ordinary browser proof cannot import the
launcher. One positive and five negative cases exercise that narrow exception.

Two exact non-production observers (`reference-host-web/test/official-sign-in.test.tsx` and
`desen-app-browser-e2e/repeatable-demo-authoring.ts`) may use the built public Protocol entry to
authenticate actual canonical bytes and recompute revisions. The host test retains its preexisting
host-package allowlist. Private Protocol imports, other unreviewed workspace package edges, and
Protocol access from neighboring observers remain forbidden.
Two positives and six negatives preserve that boundary; all 52 cases run against the real root
configuration. No production host dependency allowlist is expanded.

M10A-T01 adds four starter-boundary fixtures: its reviewed Runtime React edge succeeds; imports
from starter into Editor Core or an application fail; a neutral package cannot import starter.
These extend the historical 52-case set without changing its existing expected rules.
Two additional fixtures reject Publisher in the independent starter host and another App in the
starter proof harness; both browser entry graphs retain explicit dependency boundaries.

Run them after installing workspace dependencies:

```bash
node scripts/verify-boundary-fixtures.mjs
```

Adding or changing a boundary rule requires one fixture that would fail if that rule disappeared.
