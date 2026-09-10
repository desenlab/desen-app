# @desen/starter-catalog-web-proof

This private app is a bounded M10A-T01 browser harness, not DESEN App product UI. Its authoring
graph turns three fixed Source fixtures into Bundles through `@desen/publisher`; its separately
built host graph accepts only those serialized Bundles and mounts them through the same static
starter adapter registry. The host graph contains no Editor or Publisher authority.

From the repository root, install the pinned browser once and build the public dependencies:

```bash
pnpm --filter @desen/starter-catalog-web-proof exec playwright install --with-deps chromium
pnpm --filter @desen/starter-catalog-web-proof... build
pnpm --filter @desen/starter-catalog-web-proof test:e2e
```

Proof verifiers that already own the exhaustive prefix build use `test:e2e:built` and supply
`DESEN_M10A_T01_PROOF_TEMP` as an existing, canonical, runner-owned absolute directory.
Playwright owns the fixed, strict localhost port `4187`
and writes `browser-report.json` plus failure artifacts only below that runner-owned temporary
directory. The custom `browser-proof.json` receipt is duration-free and derived from the three
exact completed Playwright cases; Playwright's detailed report is retained separately as
`browser-report.json`. Each Vite graph emits a disposable module-closure receipt in `dist` that
fails the build if the authoring Publisher edge or independent-host exclusion is lost.
When the variable is omitted for an ad-hoc local run, the config creates an isolated operating-
system temporary directory instead; it never writes Playwright results into the workspace.

The fixtures are deterministic proof data. They are not Catalog discovery, application state,
business content, package delivery, activation, or a substitute for the normal DESEN App flow.
