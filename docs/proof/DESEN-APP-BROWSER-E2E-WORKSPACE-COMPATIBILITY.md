# Desen App browser E2E workspace compatibility

Task: M10-T01

Compatibility receipt: M10-T01-COMPAT

Status: DONE

P-08: PROVEN

T02+: NOT_PROVEN

Historical artifact: `sha256:959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77`

Compatibility artifact: `sha256:e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d`

## Corrective scope

This append-only receipt preserves the immutable task-time M10-T01 artifact and records the later
workspace-boundary correction. `M10-T01-COMPAT` is a checkpoint authority label, not a new plan
task, milestone increment, or expanded product claim.

The real-browser harness now lives in the dedicated private `@desen/app-browser-e2e` workspace.
That package exclusively owns Playwright `1.62.1`, Vite, React, React DOM, their exact type packages,
the Editor Core persistence dependency, and its explicit build dependency on `@desen/app-web`. The
root manifest retains its reserved pre-G10 `test:e2e` placeholder, while the product App manifest
retains its normal build, typecheck, lint, and Vitest surface without Playwright or harness scripts.

The compatibility reader authenticates the moved scenario, proof application, HTML, TypeScript,
Playwright, and Vite files; their exact import surface; `/` navigation; package-local `dist/`,
`test-results/`, and `playwright-report/` paths; the dedicated pnpm lock importer; and the exact-head
Browser E2E workflow commands. It also retains the task-time claims for empty-project visual
authoring, two native drag paths, forged-drag rejection, canonical persistence and re-admission,
and Design/Run static parity.

The 16,025-byte compatibility artifact authenticates 32 current files at
`sha256:e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d`. The explicit boundary
allowlist admits only `editor-core`; a separate rule permits only the reviewed App application,
empty-project, and stylesheet entries. The boundary fixture verifier passes 19/19, including one
positive composition and negative `publisher` and unreviewed-App-entry cases. The full boundary
run passes across 808 modules and 3,319 dependencies.

## Direct execution

```bash
pnpm --filter @desen/app-browser-e2e exec playwright install chromium
pnpm --filter @desen/app-browser-e2e test:e2e
node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs
node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs
pnpm boundaries
```

The deterministic verifier does not launch Chromium. The exact-head `Browser E2E` job runs the
package-filtered scenario separately, then invokes the compatibility verifier and mutation suite
directly with Node. Failure traces, screenshots, video, and the HTML report remain under the
dedicated workspace and are uploaded only when that hosted job fails.

## Explicit nonclaims

The correction does not add typed runtime input or pending-state coverage (M10-T02), invalid
credentials or visible public failure coverage (M10-T03), success/navigation or a real host
operation (M10-T04), remote deployment, or G10 closure. It does not change M10-T01's completed task
count or infer an exact-head hosted pass from local artifact bytes.
