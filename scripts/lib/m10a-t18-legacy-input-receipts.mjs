// Reviewed inverse hunks reconstruct the exact T17 App inputs from the current T18 working tree.
// They are historical data only; every application is fenced by both current and predecessor receipts.
export const M10A_T18_LEGACY_INPUT_SUCCESSORS = Object.freeze([
  {
    path: "apps/desen-app/src/application.tsx",
    current: {
      bytes: 220762,
      sha256: "01c2d76822d9abe1629b00cf7e2445a548f5f393882744ff77192b0292f96b5e",
    },
    predecessor: {
      bytes: 215150,
      sha256: "61decf6b44386537692e90dd0cebf5c49fd60b16cc0ddc76dafc9edff4d364a3",
    },
    inverseHunks: [
      { start: 26, remove: 1, restore: [] },
      { start: 244, remove: 1, restore: [] },
      { start: 1012, remove: 100, restore: [] },
      { start: 1114, remove: 1, restore: [] },
      { start: 1118, remove: 1, restore: [] },
      { start: 1171, remove: 2, restore: [] },
      {
        start: 5528,
        remove: 37,
        restore: ["    return <DesignSystemArea model={explorerResult.model} project={project} />;"],
      },
    ],
  },
  {
    path: "apps/desen-app/src/application.module.css",
    current: {
      bytes: 145565,
      sha256: "f314cf00c56d2aad942a70bc6d7a2a9426487af1d7cb18bc4fb5598e206986b3",
    },
    predecessor: {
      bytes: 144916,
      sha256: "66e4df3fa6853260c6ff67f318e4ffa18436b9e0e1581148467a1bd50345524f",
    },
    inverseHunks: [
      { start: 73, remove: 1, restore: [] },
      { start: 149, remove: 32, restore: [] },
      { start: 628, remove: 2, restore: ["  .designSystemDetailGrid {"] },
    ],
  },
  {
    path: "apps/desen-app/test/application.test.tsx",
    current: {
      bytes: 135418,
      sha256: "bff5f6493b37428832692df3e69c880fb3164bf1c9d0238412338cdf9dfd5007",
    },
    predecessor: {
      bytes: 135154,
      sha256: "a5ca47d41b9f402e8b02848040153d13be2cb03f122bb0a38897386c658d6aa9",
    },
    inverseHunks: [{ start: 259, remove: 3, restore: [] }],
  },
  {
    path: "scripts/lib/m10a-t15-proof.mjs",
    current: {
      bytes: 14094,
      sha256: "543c64bcbfe83b9eff8944c27803b27143a10addb8e5400cccae474999827b9d",
    },
    predecessor: {
      bytes: 13958,
      sha256: "c679bc117c899b6f67d136899898337ffd98561ea4d6b53868c0082dae20ee17",
    },
    inverseHunks: [
      { start: 16, remove: 1, restore: [] },
      { start: 126, remove: 1, restore: [] },
    ],
  },
]);

/** Exact additive T18 App source, admitted to the current source audit without historical graph authority. */
export const M10A_T18_ADDED_APP_SOURCE_RECEIPTS = Object.freeze([
  {
    path: "apps/desen-app/src/design-system-library.ts",
    bytes: 25678,
    sha256: "599b197168c67e105443abbaab41f99e196fa815d1f8ccdb954c2a28d43b394f",
  },
]);

/**
 * T18 successor assertions that execute as part of historical suites. They remain required green
 * tests, but are excluded from immutable predecessor assertion-count projections.
 */
export const M10A_T18_SUCCESSOR_TESTS = Object.freeze([]);
