# Desen App real-adapter canvas proof

Task: `M09-T03`

Status: `DONE`

Proof ID: `desen-app-real-adapter-canvas`

Artifact: `docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json`

Final artifact: `sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`

## Proven boundary

The Desen App sign-in canvas mounts the exact controlled official-derived Bundle through the
public `@desen/reference-catalog-web/react-adapters` registry input and the public
`@desen/runtime-react` rendering boundary. A semantic TypeScript audit and two independent real
Vite 8 `build({ write: false })` observations prove that the App reaches the same transformed
registry, runtime, and five real component modules authenticated by the frozen M05-T09 reference
host source-audit artifact. Direct, aliased, helper-hidden, factory-created, dynamic, private-path,
local-registry, private-DOM, and unsupported-route substitution mutations fail closed.

The canvas is a disabled read-only design preview. Unsupported project/surface tuples do not mount
or substitute sign-in, stale sessions are disposed before replacement, and StrictMode replay plus
final unmount have balanced session-disposal receipts.

This closes the Desen App registry-identity slice and advances `P-06` to `PROVEN`.

## Explicit nonclaims

- `S-001` remains `PLANNED` until M09-T11 supplies fixtures, scenarios, and visible
  approximate-fidelity disclosure.
- `PF-059` remains `OPEN` for the M10-T05 browser-E2E/P-07 slice; `P-07` remains `PARTIAL`.
- No selection overlay, inspector, private-DOM authoring, Source mutation, undo, persistence,
  Design/Run switch, publish, or activation is claimed.
- No native-target or arbitrary-future-catalog registry identity is claimed.

## Reproduction

```sh
pnpm --filter @desen/app-web build
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:canvas
node scripts/verify-desen-app-real-adapter-canvas.mjs
node --test tests/desen-app-real-adapter-canvas.test.mjs
```
