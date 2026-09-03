# Desen App browser E2E

`@desen/app-browser-e2e` is the isolated real-browser proof workspace for Desen App. It owns the
Playwright, Vite, Chromium, and failure-artifact lifecycle without adding those concerns to the
product App manifest or normal App build.

The original T01 harness imports the production `DesenAppApplication`, its styles, and the admitted
empty reference project directly from `@desen/app-web` source. The later journeys use the ordinary
product entry with temporary instances of its local persistence service. Its package-level
`test:e2e` command first builds the complete product dependency closure, then typechecks and builds
the harness before running all five Chromium journeys. The original in-memory compare-and-set
adapter is test-only and is never imported by the product entry.

Install the package-pinned browser once:

```bash
pnpm --filter @desen/app-browser-e2e exec playwright install chromium
```

Run the complete browser proof:

```bash
pnpm --filter @desen/app-browser-e2e test:e2e
```

Run individual harness checks when diagnosing a failure:

```bash
pnpm --filter @desen/app-browser-e2e lint
pnpm --filter @desen/app-browser-e2e typecheck
pnpm --filter @desen/app-browser-e2e build
```

Playwright writes retained failure traces, screenshots, and video under `test-results/`, with its
HTML report under `playwright-report/`. Both directories and the production proof bundle in
`dist/` are generated outputs and must not be committed.

The five independently configured journeys cover:

- M10-T01: empty-project visual authoring, authenticated native drag, canonical persistence,
  structural re-admission, and exact Design/Run static parity.
- M10-T01A: the ordinary product's visible new-project, reopen, save, and reload flow.
- M10-T02: visually connected controlled inputs and the real Runtime pending lifecycle.
- M10-T03: declared failure, conditional Alert, retry, and stable frame geometry.
- M10-T04: visual two-surface authoring, synthetic success with zero host requests, and explicit
  Integration through a real local HTTP operation. A real 401 leaves the origin mounted; a real
  200 mounts the authored destination through the same Publisher and Runtime adapters. Run does
  not save transient input, response data, or navigation into Source.

The T04 server uses `product-proof-server.mjs --with-operations` on port 4176. It starts the same
bounded loopback operation service used by the normal developer launcher, with fresh credentials
separate from Source persistence. The test observes requests and responses; it never intercepts or
fulfills them. It authors the operation alias and Success → Navigate action through visible
controls without injected Source or required JSON. The local account service is explicitly a test
binding, not production authentication. Account app remains a separate saved workspace; Flow app
starts from its own blank `start` and `result` surfaces.

Publish/activation without host edits (T05), last-known-good recovery (T07), production identity,
remote deployment, and G10 closure remain outside these browser journeys.
