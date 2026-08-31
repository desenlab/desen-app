# Desen App visual behavior authoring

Task: M10-T01B

Status: DONE

P-08: PROVEN

P-09: PARTIAL

Predecessor artifact: `sha256:6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e`

Final artifact: `sha256:cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8`

## Scope

M10-T01B makes the normal editor's behavior-authoring path usable without teaching a designer the
DESEN action and predicate JSON shapes. **Connect input** applies the controlled value binding and
the matching `change → state.set(event.value)` action as one App-owned recipe, then exposes only a
complete Source that passes the exact Catalog-bound continuous validator. Existing unrelated
actions retain their order; incompatible states, conflicting writes, stale selections, and invalid
endpoints fail closed.

The visual action composer projects current Source state, component event payloads, and Catalog
operations. A designer can select an operation, map required inputs to compatible local state, and
choose result identity and concurrency without entering JSON. The complete closed action union and
an explicit **Advanced JSON** escape hatch remain available to power users; no new Source action
kind or executable extension mechanism is introduced.

Layer visibility now offers always-visible, operation-status, local-state, and advanced-predicate
choices. Set and clear transitions use only public Editor Core commands and are validated before
session publication. Operation result names are projected by a bounded traversal of authored
`operation.invoke` actions; conflicting or reference-unsafe aliases are excluded instead of
guessed.

Run controls no longer assume a sign-in product. The App derives only the operation aliases used by
the current Source surface, authenticates their declarations and inert fixtures from the admitted
Catalog, and exposes independent pending lifecycles and declared outcomes for each alias. Request
input is neither read nor retained, and integration or production host bindings are not created by
this authoring preview.

The real Chromium authoring scenario deliberately reproduces the incorrect placeholder-only
binding, repairs it with **Connect input**, types complete multi-character email and password
values, authors a Catalog operation action and failed-operation visibility without JSON, observes
the generic pending fixture lifecycle, and validates the saved Source. This is usability evidence
for the intermediate authoring task; it does not mark the separately planned M10-T02 or M10-T03
tasks complete.

## Direct authority and execution

The deterministic artifact authenticates the immutable M10-T01A predecessor and exact receipts for
the connection and condition boundaries, behavior projection and controls, visual action composer,
generic fixture projection/controller, Run controls, App composition, focused tests, Catalog
manifest, browser scenario, hosted evidence commands, and passive proof entrypoints.

The deterministic reader never starts Chromium, Vite, or a listener. Browser execution remains a
separate exact-head authority:

```bash
pnpm --filter @desen/app-web test:behavior-authoring
pnpm --filter @desen/app-browser-e2e test:e2e
node scripts/verify-desen-app-visual-behavior-authoring.mjs
node --test tests/desen-app-visual-behavior-authoring.test.mjs
```

## Checkpoint and CI authority

Append-only reader checkpoint sequence 64 advances sequence 63 head
`sha256:7245d3334dfaf801692783ed8a500ecc124ed259291ccf433cbc6fab21c76da7` to
`sha256:2590f7ebf99b927ccded490e511748e8e5abcf0a49108f67c78061aa021da5f0` across 53 frozen
artifacts and 106 current readers. Historical bridge receipts advance at indexes `[70..97, 102,
103]`; the new proof library and mutation reader append at `[104, 105]`.

The neutral CI authority contains 208 workloads and 99 proof pairs. M10-T01B owns an exact
67-proof-unit / 144-workload affected closure behind M10-T01A; unknown paths, policy inputs, and
authority drift still force exhaustive execution.

## Explicit nonclaims

M10-T02 input/pending closure, M10-T03 invalid-credentials closure, and M10-T04 success,
navigation, and one real host-operation binding remain separate planned tasks. Synthetic Catalog
fixtures are not production integrations. Arbitrary project schemas, remote deployment,
multi-user persistence, and G10 closure remain outside this evidence. A local artifact does not
infer a hosted exact-head `Quality gate` or `Browser E2E` pass.
