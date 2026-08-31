# Desen App user-created blank project

Task: M10-T01A

Status: DONE

P-08: PROVEN

T02+: NOT_PROVEN

Predecessor artifact: `sha256:e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d`

Final artifact: `sha256:6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e`

## Scope

M10-T01A closes the reachability gap left by the isolated M10-T01 browser harness. The normal
Desen App entry now starts with zero projects and exposes a visible **New project** flow. Choosing
the exact **Blank sign-in project** profile creates `account-app/sign-in` at generation 1 and opens
its 420 by 720 portrait frame in the ordinary product shell. The normal entry injects neither a
Source document nor a proof-only route.

The product owns a durable local persistence composition. Its launcher creates a fresh bearer
secret, admits only fixed-loopback origins, starts the real local control-plane adapter, stores data
under the private `.desen/desen-app/control-plane` namespace outside the served App root, and passes
only the runtime origin and secret into the browser build. Direct, encoded, case-varying, and
`/@fs/` state paths receive `403` before SPA fallback. The missing or malformed runtime case
remains controlled and fixture-free; no browser storage fallback silently substitutes for
persistence.

One real Chromium scenario starts at `/`, observes **0 projects**, and uses only visible product
controls to create the project. It then authors the sign-in Source through Components, Layers,
Inspector, State, and Actions: Text, two Text fields, and Button remain in the saved order; email
and password state bindings are present; a temporary Alert is deleted; and the two positive drag
paths use Playwright's native `dragTo`. A forged `DataTransfer` drag remains rejected. Saving the
authored Source advances the record to generation 2. A hard reload and a later Projects-card reopen
both restore the exact authored Source through the real persistence port.

The browser proof server's Control Plane composition is now part of this proof's own fail-closed
authority. The exact dependency-cruiser configuration admits only
`product-proof-server.mjs` importing the built public `apps/control-plane-api/dist/index.js`
entry. Four fixture cases cover that admitted edge and reject the same import from another proof
file, a deep/private Control Plane module, and every other application root. The root boundary
command, fixture verifier, fixture documentation, `.gitignore` state/fixture rules, and all eight
fixture source files receive exact receipts.

Design and Run retain the same static Source and portrait frame. Runtime typing, pending state,
invalid credentials, visible public failure, successful navigation, and a real host operation are
deliberately deferred to M10-T02 through M10-T04.

## Direct authority and execution

The deterministic artifact preserves the immutable 16,025-byte M10-T01-COMPAT predecessor at
`sha256:e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d`. It records exact receipts
for the normal product entry and bootstrap, local runtime adapter and launcher, production proof
server, dedicated Playwright project and scenario, application behavior and presentation, package
and lockfile contracts, focused tests, workflow commands, and every proof reader.
It additionally records the root `pnpm boundaries` command and its complete 13-file policy and
fixture authority. The deterministic reader authenticates those bytes and semantics without
executing dependency-cruiser itself.

The browser run and deterministic proof reader remain separate authorities. The reader never starts
Chromium, Vite, or a listener; the Browser E2E command builds the production application and runs
both the immutable historical scenario and the new normal-product scenario:

```bash
pnpm --filter @desen/app-web test:product-bootstrap
pnpm --filter @desen/app-web test:local-runtime
pnpm boundaries
pnpm --filter @desen/app-browser-e2e test:e2e
node scripts/verify-desen-app-user-created-blank-project.mjs
node --test tests/desen-app-user-created-blank-project.test.mjs
```

The normal-product Chromium scenario passes 1/1 locally, alongside the immutable historical
scenario. A local artifact does not infer a hosted exact-head pass; the Browser E2E job remains the
merge authority for that execution.

## Explicit nonclaims

This append-only task does not rewrite either M10-T01 artifact. It proves only the admitted Account
app sign-in blank profile, not arbitrary project schemas or identities. M10-T02 typed input and
pending state, M10-T03 invalid credentials and public failure rendering, and M10-T04 successful
navigation and one real host operation remain not proven. Remote deployment, multi-user
persistence, and G10 closure also remain outside this evidence.
