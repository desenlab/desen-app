// Reviewed inverse hunks reconstruct the exact T18 App inputs from the current T19 working tree.
// They are historical data only; every application is fenced by both current and predecessor receipts.
export const M10A_T19_LEGACY_INPUT_SUCCESSORS = Object.freeze([
  {
    path: "scripts/lib/m10a-t15-proof.mjs",
    current: {
      bytes: 14230,
      sha256: "94f554898c6bd8206978b4f50a89d179bb63d97f8d043953212028405dd100b1",
    },
    predecessor: {
      bytes: 14094,
      sha256: "543c64bcbfe83b9eff8944c27803b27143a10addb8e5400cccae474999827b9d",
    },
    inverseHunks: [
      { start: 17, remove: 1, restore: [] },
      { start: 127, remove: 1, restore: [] },
    ],
  },
  {
    path: "apps/desen-app/src/application.tsx",
    current: {
      bytes: 222701,
      sha256: "0adf3f30fc94f8b38781112187f0a09803482634385fed730f8b4f33f3f478cf",
    },
    predecessor: {
      bytes: 220762,
      sha256: "01c2d76822d9abe1629b00cf7e2445a548f5f393882744ff77192b0292f96b5e",
    },
    inverseHunks: [
      { start: 136, remove: 1, restore: [] },
      {
        start: 1266,
        remove: 1,
        restore: ['type SurfaceEditorMode = "design" | "run";'],
      },
      { start: 3149, remove: 1, restore: [] },
      {
        start: 4052,
        remove: 1,
        restore: ['    if (nextMode === "design") {'],
      },
      {
        start: 4063,
        remove: 7,
        restore: [
          '    (nextMode === "design" ? designModeButton : runModeButton).current?.focus({',
          "      preventScroll: true,",
          "    });",
        ],
      },
      {
        start: 4821,
        remove: 7,
        restore: [
          '            {mode === "design"',
          '              ? "Design preview · controls are disabled."',
          '              : executionContext === "integration"',
          '                ? "Run preview · connected host operations are enabled."',
          '                : "Run preview · real adapter controls use the selected synthetic fixture."}',
        ],
      },
      {
        start: 4862,
        remove: 15,
        restore: [],
      },
      {
        start: 5000,
        remove: 7,
        restore: [
          '              <strong>{mode === "design" ? "Preview boundary" : "Runtime boundary"}</strong>',
        ],
      },
      {
        start: 5008,
        remove: 7,
        restore: [
          '                {mode === "design"',
          '                  ? "Catalog fixture · no live calls"',
          '                  : executionContext === "integration"',
          '                    ? "Explicit host connection"',
          '                    : "Synthetic fixture only"}',
        ],
      },
      {
        start: 5018,
        remove: 7,
        restore: [
          '              {mode === "design"',
          '                ? "Catalog-backed edits change only the authored Source and persist only through Save source. Scenarios are transient previews and never change the authored Source. Selection, placement, and Inspector chrome never enter the managed component tree."',
          '                : executionContext === "integration"',
          '                  ? "Only explicitly connected host operations can execute. Navigation stays within this authored Source. Storage, resources, publication, activation and production remain blocked; Run never saves inputs or results."',
          '                  : "Controls use authenticated Catalog fixtures and local managed-surface navigation. Resources, storage, publication, activation, integration, and production calls remain blocked; Run never changes the authored Source."}',
        ],
      },
      {
        start: 5035,
        remove: 7,
        restore: [
          '            {mode === "design"',
          '              ? "Design mode · managed controls are disabled; authored changes remain local until Save source succeeds."',
          '              : executionContext === "integration"',
          '                ? "Run mode · explicitly connected host operations are enabled; production remains blocked."',
          '                : "Run mode · controls are interactive against synthetic fixtures; live effects remain blocked."}',
        ],
      },
      { start: 5071, remove: 1, restore: ['        hidden={mode === "run"}'] },
      { start: 5085, remove: 9, restore: [] },
      { start: 5099, remove: 1, restore: [] },
      { start: 5195, remove: 1, restore: ["                  mode={mode}"] },
      { start: 5257, remove: 1, restore: ['        hidden={mode === "run"}'] },
    ],
  },
  {
    path: "apps/desen-app/src/application.module.css",
    current: {
      bytes: 148006,
      sha256: "41597c9873927c9ff37031a90222b374b7652edb322de9764f01c9a6855fd2cb",
    },
    predecessor: {
      bytes: 145565,
      sha256: "f314cf00c56d2aad942a70bc6d7a2a9426487af1d7cb18bc4fb5598e206986b3",
    },
    inverseHunks: [{ start: 5491, remove: 128, restore: [] }],
  },
]);

/** Exact additive T19 App source, admitted to the current source audit without historical graph authority. */
export const M10A_T19_ADDED_APP_SOURCE_RECEIPTS = Object.freeze([
  {
    path: "apps/desen-app/src/connection-intent-drafts.ts",
    bytes: 11507,
    sha256: "429b93574a9f1ca507da0a0ee45071b6d2e89327bf14e54492ceb0d1a386b7f8",
  },
  {
    path: "apps/desen-app/src/connections-workspace.tsx",
    bytes: 11104,
    sha256: "c7efedc2f113aa33d2d7ce28c24cfc3cccabdcdbff705036e5a3c94b628809bc",
  },
]);

export const M10A_T19_SUCCESSOR_TESTS = Object.freeze([]);
