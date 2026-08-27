# Desen App selection-overlay proof

Task: M09-T04

Status: DONE

Proof ID: `desen-app-selection-overlay`

Artifact: `docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json`

Artifact size: 11,997 bytes

Final artifact: `sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1`

N-042: TESTED

Direct parent: the exact 73,111-byte M09-T03 real-adapter canvas artifact at
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`

## Proven boundary

Desen App owns one route-local, immutable selection primitive containing only exact project,
surface, Source-node, capability, display, and conditional data. A selection is admitted only when
its project and surface match the current route and its Source identity is present in the validated
authoring model. Unknown, cross-route, stale-capability, and forged same-route identities fail
closed instead of being treated as conditional nodes.

The runtime projection reads only the public callback-free Runtime React diagnostic index. It maps
the selected Source node through `runtimeNodeIdsBySourceNodeId`, confirms each candidate against
`byRuntimeNodeId`, preserves repeated component instances, and excludes attached behavior runtime
identities. A selected conditional Source component with no current runtime instance remains an
explicit, honest non-materialized selection; an ordinary missing component does not gain that
fallback.

The managed runtime remains inside its disabled capability fieldset. Selection chrome is a
pointer-inert DOM sibling owned by Desen App, outside both the fieldset and the marked managed
capability subtree. The chrome is a compact identity/status card, not a component perimeter or
measurement box, and it receives no managed child, DOM handle, geometry, registry, session, or
callback authority. Source and CSS audits reject private DOM lookup, React-tree access, geometry
measurement, managed-tree substitution, overlay nesting, and perimeter-box mutations.

Layer selection uses native buttons with dynamic Select/Deselect accessible names, `aria-pressed`,
conditional context, wrapped tab-key navigation, and a live panel status. Route replacement resets
selection synchronously. Desktop and mobile interaction checks confirmed selection, deselection,
conditional feedback, and route reset against the local App; these are manual browser checks, not
browser-E2E evidence.

This closes `N-042` as `TESTED` for the exact controlled Web–React profile. `P-06` remains
`PROVEN`; `P-07` and `P-16` remain `PARTIAL` for their later browser-E2E and end-to-end diagnostic
selection owners.

## Evidence

- The focused App selection suite passes 27/27.
- The independent root proof passes 10/10, including deterministic rebuild, parent authentication,
  mutation rejection, visible proof-pin drift, and non-regular filesystem authority cases.
- App typecheck, lint, and production build pass locally.
- The 15-file tracked boundary is recorded in the artifact together with its exact source,
  ownership, accessibility, package-command, and hostile-mutation receipts.
- The live local CI authority contains 180 workloads and 85 proof pairs: 74 ordinary and 11
  barriers. The selection-overlay connected closure contains 52 proof units and 114 workloads.
- Complete affected ownership covers 1,164 tracked paths, including 170 proof-owned paths.
- Sequence 43 passes 66/66 at
  `sha256:0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58`. It preserves sequence
  42 and all 38 predecessor artifacts, appends T04 artifact index 38, reseals predecessor
  compatibility readers `[70, 71, 72, 73, 74, 75]`, and appends the T04 proof/root readers at
  `[76, 77]`; the current chain contains 39 artifacts and 78 readers.
- The complete structural CI suite passes 317/317 locally.
- No required-gate or hosted-CI result is inferred by this report.

## Explicit nonclaims

- No per-component rectangle, hit testing, canvas picking, geometry, or private DOM/native
  structure is exposed.
- No inspector, Source mutation, insertion, move, reorder, cardinality, drag/drop, binding, event,
  or action authoring is implemented.
- No Design/Run switch, diagnostic navigation, selectable invalid placeholder, persistence,
  publication, or activation is implemented.
- No arbitrary future Catalog, native target, cross-target, or pixel-fidelity guarantee is made.
- Manual desktop/mobile interaction verification is not a browser-E2E claim.

## Reproduction

```sh
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:selection
pnpm --filter @desen/app-web build
node scripts/verify-desen-app-selection-overlay.mjs
node --test tests/desen-app-selection-overlay.test.mjs
```
