// Reviewed inverse hunks reconstruct the exact T19 inputs from the current T20 working tree.
// They are historical data only; current execution always uses the live tree and its own checks.
export const M10A_T20_LEGACY_INPUT_SUCCESSORS = Object.freeze([
  {
    path: "scripts/lib/m10a-t15-execution.mjs",
    current: {
      bytes: 18322,
      sha256: "a932a68411df616d9142ba4564cb429104ce6b6b8dc4183519685b56419b3bcd",
    },
    predecessor: {
      bytes: 18207,
      sha256: "3c5828f2531d301dd756418ec3dde697aa5431c98a069e7273b8f56d52d812ef",
    },
    inverseHunks: [
      { start: 19, remove: 1, restore: [] },
      {
        start: 248,
        remove: 1,
        restore: ["    const successorTests = M10A_T17_SUCCESSOR_TESTS.filter("],
      },
    ],
  },
  {
    path: "apps/desen-app/src/application.tsx",
    current: {
      bytes: 229067,
      sha256: "6ed4be212ee9df71988a5993d1272561e8b16625de07b69ac25e01fca531d3ac",
    },
    predecessor: {
      bytes: 222701,
      sha256: "0adf3f30fc94f8b38781112187f0a09803482634385fed730f8b4f33f3f478cf",
    },
    inverseHunks: [
      { start: 40, remove: 2, restore: [] },
      { start: 121, remove: 1, restore: [] },
      { start: 236, remove: 1, restore: [] },
      { start: 3393, remove: 9, restore: [] },
      { start: 3594, remove: 5, restore: [] },
      { start: 3611, remove: 5, restore: [] },
      {
        start: 3857,
        remove: 4,
        restore: [
          "  function isDesignMode(allowSourceDraft = false): boolean {",
          '    if (modeRef.current !== "design") return false;',
        ],
      },
      { start: 3879, remove: 9, restore: [] },
      { start: 4359, remove: 1, restore: ["    if (!isDesignMode() || selection === null) {"] },
      { start: 4384, remove: 1, restore: ["    if (!isDesignMode() || selection === null) {"] },
      { start: 4406, remove: 24, restore: [] },
      { start: 4431, remove: 1, restore: ["    if (!isDesignMode() || selection === null) {"] },
      {
        start: 4464,
        remove: 1,
        restore: [
          '    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });',
        ],
      },
      {
        start: 4481,
        remove: 1,
        restore: [
          '    if (!isDesignMode()) return Object.freeze({ ok: false, reason: "edit-rejected" });',
        ],
      },
      { start: 4708, remove: 1, restore: ["    if (!isDesignMode()) return;"] },
      { start: 4716, remove: 1, restore: ["      selectOne(null);"] },
      { start: 4750, remove: 1, restore: ["    selectOne(null);"] },
      {
        start: 4835,
        remove: 8,
        restore: [
          "  const canUndo = designEditsAvailable && historyState !== null && historyState.past.length > 0;",
          "  const canRedo = designEditsAvailable && historyState !== null && historyState.future.length > 0;",
        ],
      },
      {
        start: 4886,
        remove: 1,
        restore: [
          '              ? "Connections workspace · drafts are inert until a later wiring task."',
        ],
      },
      {
        start: 5073,
        remove: 1,
        restore: ['                  ? "Inert intent metadata · no executable writes"'],
      },
      {
        start: 5083,
        remove: 1,
        restore: [
          '                ? "Connections forms are persisted as separate inert project metadata. Source, host calls, and behavior handlers remain unchanged."',
        ],
      },
      {
        start: 5087,
        remove: 1,
        restore: [
          '                    ? "Only explicitly connected host operations can execute. Navigation stays within this authored Source. Storage, resources, publication, activation and production remain blocked; Run never saves inputs or results."',
        ],
      },
      {
        start: 5100,
        remove: 1,
        restore: [
          '              ? "Connections workspace · incomplete intents are durable metadata; executable wiring is not available."',
        ],
      },
      { start: 5151, remove: 80, restore: [] },
      { start: 5235, remove: 1, restore: [] },
    ],
  },
  {
    path: "apps/desen-app/src/application.module.css",
    current: {
      bytes: 148714,
      sha256: "ec4175a6aa38ace7fc451d7f91528aab4686ee1d18c03a46b5c27b6eb3cc25bd",
    },
    predecessor: {
      bytes: 148006,
      sha256: "41597c9873927c9ff37031a90222b374b7652edb322de9764f01c9a6855fd2cb",
    },
    inverseHunks: [{ start: 5613, remove: 33, restore: [] }],
  },
  {
    path: "apps/desen-app/src/connections-workspace.tsx",
    current: {
      bytes: 12330,
      sha256: "f9dbe005a219b7d8817e9ca0b8a3d34465ce1bb8058a6595f00cfac55cdf4bda",
    },
    predecessor: {
      bytes: 11104,
      sha256: "c7efedc2f113aa33d2d7ce28c24cfc3cccabdcdbff705036e5a3c94b628809bc",
    },
    inverseHunks: [
      { start: 17, remove: 1, restore: [] },
      { start: 26, remove: 3, restore: [] },
      {
        start: 87,
        remove: 2,
        restore: [
          " * Project-scoped Connections workspace. Forms are durable project metadata and never become",
          " * executable Source until a later, explicitly-owned task introduces behavior wiring.",
        ],
      },
      { start: 91, remove: 2, restore: [] },
      {
        start: 202,
        remove: 3,
        restore: [
          "            Prepare node-linked intent for {surfaceName}. Incomplete forms persist beside the valid",
          "            Source and never execute host or behavior code.",
        ],
      },
      { start: 326, remove: 19, restore: [] },
    ],
  },
  {
    path: "apps/desen-app/test/application.test.tsx",
    current: {
      bytes: 136881,
      sha256: "8ffa1623644fe28ceee08b8bc1ef69c2fbeebba485e3a1509bc8727cf74c3ad6",
    },
    predecessor: {
      bytes: 135418,
      sha256: "bff5f6493b37428832692df3e69c880fb3164bf1c9d0238412338cdf9dfd5007",
    },
    inverseHunks: [{ start: 2561, remove: 28, restore: [] }],
  },
  {
    path: "apps/desen-app/test/connections-workspace.test.tsx",
    current: {
      bytes: 3034,
      sha256: "9cdf88164a01b1b7977a205f5e5894a7126e0533a228d9d900c7f1b580a4029f",
    },
    predecessor: {
      bytes: 1991,
      sha256: "ffaedd387207211bfdab4a41bb7a8dd871bd193bbf49d000bb809d6b005715ae",
    },
    inverseHunks: [{ start: 55, remove: 25, restore: [] }],
  },
  {
    path: "scripts/lib/m10a-t15-proof.mjs",
    current: {
      bytes: 14366,
      sha256: "3debe890ed907b21e324b70620013c348ab16e3adb0d61f4a83b1f2265281360",
    },
    predecessor: {
      bytes: 14230,
      sha256: "94f554898c6bd8206978b4f50a89d179bb63d97f8d043953212028405dd100b1",
    },
    inverseHunks: [
      { start: 18, remove: 1, restore: [] },
      { start: 128, remove: 1, restore: [] },
    ],
  },
  {
    path: "scripts/lib/desen-app-published-host-update-proof.mjs",
    current: {
      bytes: 287290,
      sha256: "1f1b84c4f24f70769fe9681226a35f8fa50961864cc1c45a07424be99b519281",
    },
    predecessor: {
      bytes: 285186,
      sha256: "132eab741a747794247e1334eed156f9616d29851e0c6f2b5bccc408b2ada37e",
    },
    inverseHunks: [
      { start: 27, remove: 1, restore: [] },
      { start: 1405, remove: 1, restore: ["    staticEdges: 3_055,"] },
      {
        start: 1407,
        remove: 1,
        restore: [
          '    graphSha256: "sha256:8371b57ad8fddffe3ad1ef96e1d9c4441be2898aabdb983336dedb005f0005ad",',
        ],
      },
      { start: 1413, remove: 1, restore: ['        fileName: "assets/index-B0mWo1Lc.js",'] },
      {
        start: 1416,
        remove: 2,
        restore: [
          "        bytes: 3_718_560,",
          '        sha256: "sha256:150217af0808c11d8394a5bc4d02ee17b908de2cb8d0b84aac05ed2640209df8",',
        ],
      },
      { start: 1420, remove: 1, restore: ['        fileName: "assets/index-CRCoOyS9.css",'] },
      {
        start: 1423,
        remove: 2,
        restore: [
          "        bytes: 157_832,",
          '        sha256: "sha256:6862654fab9917620a0fdc540068b163bd6a93a0a6d2bcc2e62d4433dc82c741",',
        ],
      },
      {
        start: 1431,
        remove: 1,
        restore: [
          '        sha256: "sha256:5ce3d05ef84d98193df1dce1739f432d2188c42d8f9a52f42c8a04dabffe894e",',
        ],
      },
      {
        start: 1434,
        remove: 1,
        restore: [
          '    identitySha256: "sha256:92571884c8136614a711653478dd65f85414e938ad9dc24f5c2c3831c6335104",',
        ],
      },
      {
        start: 1437,
        remove: 1,
        restore: [
          '  backingSnapshotSha256: "sha256:c91be6845aeb215b6e4e62f3b4004d5d96dbbee9785ab32a05895323ca8ff0f9",',
        ],
      },
      { start: 2416, remove: 36, restore: [] },
      { start: 3501, remove: 19, restore: [] },
    ],
  },
]);

export const M10A_T20_SUCCESSOR_TESTS = Object.freeze([
  {
    path: "apps/desen-app/test/application.test.tsx",
    title: "keeps typed behavior wiring Source-backed in the separate Connections workspace",
  },
  {
    path: "apps/desen-app/test/connections-workspace.test.tsx",
    title: "renders Source-backed visual behavior controls beside inert intent notes",
  },
]);
