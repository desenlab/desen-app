import assert from "node:assert/strict";
import test from "node:test";

import { captureM10AT14Evidence, verifyM10AT14Evidence } from "../scripts/lib/m10a-t14-proof.mjs";

test("M10A-T14 captures bounded history and identity-safe reuse", async () => {
  const evidence = await captureM10AT14Evidence();
  assert.equal(evidence.result, "PASS");
  assert.equal(evidence.claims.freshIdentityRemapping, true);
  assert.equal(evidence.claims.hostileClipboardRejectedAtomically, true);
  assert.equal(evidence.claims.runtimePublisherProtocolUnchanged, true);
});

test("M10A-T14 rejects artifact source drift", async () => {
  assert.deepEqual(await verifyM10AT14Evidence(), {
    status: "PASS",
    task: "M10A-T14",
    profile: "desen.m10a-t14.history-identity-safe-reuse.v1",
    sourceFiles: 6,
  });
});
