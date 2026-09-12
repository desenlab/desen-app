/* global console */

import assert from "node:assert/strict";
import { createDesignSystemRelease } from "../dist/index.js";

const packageRoot = await import("../dist/index.js");
const exported = Object.keys(packageRoot).sort();
assert.deepEqual(exported, [
  "DESIGN_SYSTEM_RELEASE_KIND",
  "DESIGN_SYSTEM_RELEASE_LIMITS",
  "DESIGN_SYSTEM_RELEASE_REFERENCE_KIND",
  "DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION",
  "DesignSystemReleaseError",
  "createDesignSystemRelease",
  "createDesignSystemReleaseStore",
  "createHostProfileReleaseReference",
  "readDesignSystemRelease",
  "verifyDesignSystemRelease",
]);

const result = createDesignSystemRelease({
  tokenSources: [
    {
      id: "base",
      document: {
        color: {
          $type: "color",
          action: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
        },
      },
    },
  ],
  assets: [],
  recipes: [],
});
assert.equal(result.ok, true);
assert.match(result.release.digest, /^sha256:[0-9a-f]{64}$/u);
console.log(`✔ built public release package exports ${exported.length} reviewed members`);
