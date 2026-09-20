// Reviewed inverse hunks reconstruct the exact T16 App inputs from the current T17 working tree.
// They are historical data only; every application is fenced by both current and predecessor receipts.
export const M10A_T17_LEGACY_INPUT_SUCCESSORS = Object.freeze([
  {
    path: "apps/desen-app/src/application.module.css",
    current: {
      bytes: 144916,
      sha256: "66e4df3fa6853260c6ff67f318e4ffa18436b9e0e1581148467a1bd50345524f",
    },
    predecessor: {
      bytes: 133589,
      sha256: "00d8dd17c6737795a968d89f092589af637ce597850c43fe9228a65f9607098c",
    },
    inverseHunks: [{ start: 42, remove: 558, restore: [] }],
  },
  {
    path: "apps/desen-app/src/application.tsx",
    current: {
      bytes: 215150,
      sha256: "61decf6b44386537692e90dd0cebf5c49fd60b16cc0ddc76dafc9edff4d364a3",
    },
    predecessor: {
      bytes: 199207,
      sha256: "d0456c3cdcecba4f942026ad576197867bd311d390f2ce38ec86cd911f046243",
    },
    inverseHunks: [
      { start: 25, remove: 1, restore: [] },
      { start: 145, remove: 1, restore: [] },
      { start: 242, remove: 1, restore: [] },
      {
        start: 545,
        remove: 3,
        restore: [
          '    route.kind === "project" ? findDesenAppProject(route.projectId, projects) : undefined;',
        ],
      },
      {
        start: 600,
        remove: 14,
        restore: ["            {surface === undefined ? ("],
      },
      { start: 646, remove: 9, restore: [] },
      { start: 826, remove: 333, restore: [] },
      { start: 5206, remove: 8, restore: [] },
      { start: 5302, remove: 1, restore: [] },
      { start: 5368, remove: 56, restore: [] },
    ],
  },
  {
    path: "apps/desen-app/src/project-navigation.ts",
    current: {
      bytes: 8386,
      sha256: "5864a103fa96f481291991b5efb7153d96f00aa978e2ee5b054da8ada432a991",
    },
    predecessor: {
      bytes: 7692,
      sha256: "c07848bfda7a23e7e948b8e22864835ec7644acdfacb253ab7b4c1c103f1d2e7",
    },
    inverseHunks: [
      { start: 18, remove: 5, restore: [] },
      { start: 76, remove: 11, restore: [] },
      { start: 119, remove: 5, restore: [] },
    ],
  },
]);

/** Exact additive T17 App source, admitted to the current source audit without historical graph authority. */
export const M10A_T17_ADDED_APP_SOURCE_RECEIPTS = Object.freeze([
  {
    path: "apps/desen-app/src/design-system-explorer.ts",
    bytes: 17173,
    sha256: "94d4807a9b1c308fce575edf05e45c272315a7a15d2ba377389efbe3d47a0370",
  },
]);
