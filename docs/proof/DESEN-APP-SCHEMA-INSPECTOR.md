# Desen App schema-inspector proof

Task: M09-T05

Status: DONE

Proof ID: `desen-app-schema-inspector`

Artifact: `docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json`

Artifact size: 22,998 bytes

Final artifact: `sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`

P-08: NOT_PROVEN

M09-T06: NOT_PROVEN

M09-T08: NOT_PROVEN

M09-T10: NOT_PROVEN

M09-T12: NOT_PROVEN

M09-T14: NOT_PROVEN

Direct parents:

- the exact 25,375-byte M09-T02 Catalog-panel/layer-tree artifact at
  `sha256:85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61`;
- the exact 11,997-byte M09-T04 selection-overlay artifact at
  `sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1`;
- the exact 13,179-byte M06-T10 Publisher official-golden artifact at
  `sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`.

## Proven boundary

Desen App projects each exact validated component `propsSchema` through the public Catalog SDK
inspector derivation. The controlled reference surface exposes the exact boolean, enum, number,
and string controls present in its five component contracts. A synthetic Catalog/Source test adds
integer and mixed-primitive enum schemas and proves that integer values remain integral and enum
options retain their exact JSON primitive types. Labels and descriptions are presentation only;
the schema descriptor remains the mutation authority.

Each edit command is captured as an exact own enumerable data object before authorization.
Proxy-backed commands are consumed only through that captured own data without invoking property
getters; missing, extra, symbol, and accessor-bearing commands fail closed. Route, Source identity,
capability identity, control identity, requiredness, current value kind, and primitive type are then
re-derived from the supplied immutable document and Catalog.
Accepted set/delete operations use only the public Editor Core prop commands and produce a fresh
document. The complete changed Source must pass the public continuous Catalog validator before any
success is returned; failure exposes no partial document and preserves the current session.

Literal enum, boolean, string, number, and integer fields are editable. Dynamic `$ref` values are
shown as bound and have no T05 mutation control. Group and structured-JSON descriptors remain
visible but locked. Stale routes, forged selections, invalid enums, non-finite numbers, fractional
integers, required deletion, absent deletion, and schema-invalid values all fail closed.

After an Editor Core success, the App publishes the complete candidate Source through the public
Publisher with the exact reference Catalog package candidate. The App commits `{document,
preview}` as one session transaction only after Publisher success. Publisher rejection, including
the oversized-valid-string regression, retains both the prior Source and prior working preview.
An accepted Bundle revision replaces the exact Runtime session and disposes its predecessor.
Session preview grants no storage, control-plane publication, activation, deployment, or host
authority.

Inspector chrome is an App-owned `aside` composed by the route-keyed `SurfaceEditor`. It imports no
runtime or adapter authority and remains outside the managed capability subtree. The Runtime React
tree stays in the disabled adapter fieldset, and the M09-T04 App-owned selection-overlay sibling
boundary is retained. App CSS does not target managed capability descendants.

## Evidence

- The focused App inspector suite passes 41/41, and the complete App suite passes 86/86.
- The independent root proof passes 10/10, including positive source-policy admission, hostile
  source mutations, three exact parent pins, deterministic rebuild, artifact/proof-pin drift, and
  non-regular filesystem authority cases.
- App typecheck, lint, and production build pass locally.
- The artifact records 27 tracked files, exact source/package/input receipts, the
  reference control matrix, public mutation/validation/preview calls, UI ownership, and explicit
  nonclaims.
- Local receipts make no required-gate or hosted-CI claim.

## Explicit nonclaims

- M09-T06 remains unproven: no nested-object editor or structured-JSON mutation UI is implemented.
- M09-T08 remains unproven: no local-state or binding editor is implemented; dynamic values stay
  locked.
- M09-T10 remains unproven: no Design/Run mode is implemented.
- M09-T12 remains unproven: no save/open or durable persistence UI is implemented.
- M09-T14 remains unproven: a session-local Publisher Bundle is not control-plane publication or
  activation.
- P-08 remains `NOT_PROVEN`; its remaining visual-authoring tasks and browser E2E owner have not
  passed.
- No private DOM/native structure, component geometry, hit testing, canvas picking, arbitrary
  future Catalog, native-target, or pixel-fidelity guarantee is claimed.

## Reproduction

```sh
node scripts/verify-desen-app-catalog-panel-layer-tree.mjs
node scripts/verify-desen-app-selection-overlay.mjs
node scripts/verify-publisher-official-golden.mjs
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:inspector
pnpm --filter @desen/app-web build
node scripts/verify-desen-app-schema-inspector.mjs
node --test tests/desen-app-schema-inspector.test.mjs
```
