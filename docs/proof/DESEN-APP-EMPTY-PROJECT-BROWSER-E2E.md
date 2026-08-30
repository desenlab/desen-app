# Desen App empty-project browser E2E

Task: M10-T01

Status: DONE

P-08: PROVEN

T02+: NOT_PROVEN

Final artifact: `sha256:959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77`

## Scope

M10-T01 starts from an explicitly empty, structurally admitted `account-app/sign-in` Source that
retains only the exact reference Catalog requirement, one Stack root, and the declared 420 by 720
portrait authoring frame. The normal Desen App entry remains unchanged; the empty bootstrap and its
deterministic compare-and-set persistence adapter are wired only through the isolated browser-proof
bundle.

One Playwright Chromium scenario opens that production-built proof bundle and verifies the empty
layer tree before authoring. It creates local state, inserts and configures Text, Text field, and
Button components, binds the two fields, adds their change actions, reorders a layer, deletes a
temporary Alert, and then observes the same static sign-in content and frame in Design and Run. The
scenario saves through the public persistence port, reads the exact stored Source back, and
re-admits it through the public editor validator.

The two positive drag paths use Playwright's native `locator.dragTo`: one from Components to the
selected Stack slot and one from a Layers row to an insertion boundary. A separate negative case
first saves the exact canonical empty Source as generation 1, then dispatches forged `DataTransfer`
drag events without Desen's in-memory drag intent. The complete saved document, canonical dirty
projection, disabled Save affordance, and persistence write count all remain unchanged afterward.
This synthetic event is only an adversarial negative input; it is not used to claim either
successful drag path.

## Direct authority and execution

The frozen artifact authenticates the completed M09-T14/G09 predecessor at
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b`. It also records exact
receipts for the empty Source, the injected application boundary, the isolated proof application,
the browser scenario and configuration, the workspace package contracts, the exact Playwright
`1.62.1` lockfile closure, and every proof reader.

The deterministic artifact verifier deliberately does not launch a browser. Browser execution is a
separate exact-head CI responsibility so it can run in parallel with the existing Quality job rather
than extending that already long serial path. A T01 close therefore requires both layers:

- `pnpm test:e2e` — builds the isolated production bundle and runs the one Chromium scenario;
- `node --test tests/desen-app-empty-project-browser-e2e.test.mjs` — exercises the independent
  proof reader and its mutation containment;
- `node scripts/verify-desen-app-empty-project-browser-e2e.mjs` — authenticates the frozen artifact,
  visible digest, exact inputs, and explicit claim boundary without rerunning Playwright.

## Explicit nonclaims

This evidence does not exercise typed runtime input or pending state (M10-T02), invalid credentials
or public failure rendering (M10-T03), or successful navigation and one real host operation
(M10-T04). It does not prove a remote deployment or close G10. A locally generated artifact alone
does not imply that the hosted Browser E2E job passed; the exact-head hosted result is required
before merge.
