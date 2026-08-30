# Desen App publish and activation

Task: M09-T14

Gate: G09

Status: DONE

P-08: NOT_PROVEN

PF-085: OPEN

PF-086: OPEN

PF-089: OPEN

## Scope

M09-T14 closes the Desen App publication path for the fixed `account-app/sign-in` surface. The App
admits publication only when the current authored Source is exactly equal to the last successfully
saved Source generation. It reruns the public Publisher from that Source, requires the fresh Bundle
revision to equal the current session-preview revision, and forwards the exact canonical Bundle
bytes to a trusted host port. Scenario projections, synthetic fixtures, runtime operation inputs,
secrets, and rejected-candidate diagnostics are not fields of the publication snapshot or request.

The browser App does not import Node control-plane or reference-host packages. Its injected host port
is composed from the public `@desen/editor-web` fixed-channel adapter and the server-owned reference
host. The adapter reads one configured channel snapshot, stores immutable Bundle bytes by their exact
revision, and then performs one `If-None-Match` or `If-Match` compare-and-set against the fixed
`preview` channel. Channel movement remains discovery metadata rather than activation authority.

Visible Active state requires a separate reference-host receipt for the same revision. Source,
channel, and durable activation generations remain distinct. Conflicts never invoke activation;
failed or mismatched activation preserves the last-known-good revision; stale completions are
fenced; and indeterminate mutation outcomes cannot authorize blind retry or current success.

## Direct authorities

The artifact authenticates nine exact immutable parents:

- M09-T10 Design/Run modes —
  `sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`;
- M09-T11 fixtures/scenarios fidelity —
  `sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`;
- M09-T12 Source persistence —
  `sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`;
- M09-T13 node-linked diagnostics —
  `sha256:8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972`;
- M06-T10 Publisher official golden —
  `sha256:a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2`;
- M06-T09 public Bundle publication —
  `sha256:2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df`;
- M07-T05 local control-plane API —
  `sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`;
- M07-T11 separately built reference-host channel consumption —
  `sha256:48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0`;
- I07-04/G07 required-affected hosted cutover —
  `sha256:76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549`.

## Focused evidence

- `pnpm --filter @desen/app-web test:publication` — 4 files, 31/31 passed; this includes the
  2/2 real public control-plane → fixed channel → reference-host integration cases.
- `pnpm --filter @desen/editor-web test:publication` — 1 file, 10/10 passed.
- `pnpm --filter @desen/editor-web test:public-package` — emitted runtime and type surfaces passed,
  including 4 runtime cases.
- `node --test tests/desen-app-publish-activation.test.mjs` — 12/12 independent reader and mutation
  cases passed.
- `node scripts/verify-desen-app-publish-activation.mjs` — deterministic artifact and visible digest
  passed.

The six focused source-level files contain exactly 45 reviewed test declarations. The artifact
tracks 33 current files, including every direct parent, production source, focused test, package
contract, and proof-reader file. These local receipts make no required-gate or hosted-CI claim.

## Current-reader closure

Compatibility sequence 54 remains the immutable predecessor at
`sha256:0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638`, preserving 49 frozen
artifacts and 98 reader identities after resealing only M08-T08 reader indexes `[64, 65]`. Current
sequence 55 preserves those same artifact and reader identities, links that exact predecessor to
`sha256:f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17`, and reseals only
M09-T01–T14 proof-library/root-test reader indexes `[70..97]`.

The current T14 readers authenticate the exact `10,000 ms` per-test timeout successor at the full
live `sha256:5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901` hash. Reversing that
single timeout edit reproduces the frozen 24,485-byte test receipt at
`sha256:52e29b84745ff331556529612015b95b581bf3007118352ebad796ca9541e0e3`; the frozen 24,763-byte
T14 artifact remains
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b` unchanged.

Checkpoint, promotion, selector, and fourteen M09 root reader suites pass 78/78, 20/20, 23/23,
and 179/179. Promotion pins the selector at
`sha256:2855cbeedb55ede5d9db18a6b186ac07796afbc4d512f5a0aa9197bc5f177fd1`, the required-affected
runner at `sha256:b77b35a81915ec41554ab3505895fe98c0a4299ec9bf7d680dec320bbf3fb744`, and the T10 affected
plan at `sha256:e3cced8e1a9cbe6f1f5c296aa3992b07ef030c81ac9267c2deff714953ce0e39`. The integrated CI
policy regression passes 330/330.

## Explicit nonclaims

This proof covers the local saved-Source publication and fixed preview-channel activation profile;
it does not prove remote deployment, a general channel-selection UI, automated real-browser E2E, or
the later M10 invalid-publication/recovery campaign. P-08 therefore remains `NOT_PROVEN`, while
PF-085, PF-086, and PF-089 remain `OPEN`. A mutable channel never substitutes for the server-owned
durable activation receipt.

## Reproduction

```bash
pnpm --filter @desen/editor-web build
pnpm --filter @desen/editor-web typecheck
pnpm --filter @desen/editor-web test:publication
pnpm --filter @desen/editor-web test:public-package
pnpm --filter @desen/app-web build
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:publication
node --test tests/desen-app-publish-activation.test.mjs
node scripts/verify-desen-app-publish-activation.mjs
```

Final artifact: `sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b`
