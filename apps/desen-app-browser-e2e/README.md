# Desen App browser E2E

`@desen/app-browser-e2e` is the isolated real-browser proof workspace for Desen App. It owns the
Playwright, Vite, Chromium, and failure-artifact lifecycle without adding those concerns to the
product App manifest or normal App build.

The harness imports the production `DesenAppApplication`, its styles, and the admitted empty
reference project directly from `@desen/app-web` source. Its package-level `test:e2e` command first
builds the complete product dependency closure, then typechecks and builds the harness before
running the single Chromium scenario. The in-memory compare-and-set adapter is test-only and is
never imported by the product entry.

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

M10-T01 proves empty-project visual authoring, authenticated native drag, canonical persistence,
structural re-admission, and exact Design/Run static parity. Runtime input/pending, failure,
success/navigation, remote deployment, and G10 closure remain outside this harness slice.
