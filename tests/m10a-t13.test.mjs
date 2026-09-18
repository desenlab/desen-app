import assert from "node:assert/strict";
import test from "node:test";

import { captureM10AT13Evidence, verifyM10AT13Evidence } from "../scripts/lib/m10a-t13-proof.mjs";

test("M10A-T13 captures the safe local asset boundary", async () => {
  const evidence = await captureM10AT13Evidence();
  assert.equal(evidence.result, "PASS");
  assert.equal(evidence.claims.contentAddressedOpaqueHandles, true);
  assert.equal(evidence.claims.runtimeCoreChanged, false);
  assert.equal(evidence.bundledDefaultFont.license, "OFL-1.1");
  assert.equal(evidence.source.length, 12);
});

test("M10A-T13 rejects artifact drift", async () => {
  const result = await verifyM10AT13Evidence();
  assert.deepEqual(result, {
    status: "PASS",
    task: "M10A-T13",
    profile: "desen.m10a-t13.safe-local-assets.v1",
    sourceFiles: 12,
  });
});
