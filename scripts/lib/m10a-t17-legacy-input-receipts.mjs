// Reviewed inverse hunks reconstruct the exact T16 App inputs from the current T17 working tree.
// They are historical data only; every application is fenced by both current and predecessor receipts.
export const M10A_T17_LEGACY_INPUT_SUCCESSORS = Object.freeze([
  {
    path: "apps/desen-app/test/application.test.tsx",
    current: {
      bytes: 135154,
      sha256: "a5ca47d41b9f402e8b02848040153d13be2cb03f122bb0a38897386c658d6aa9",
    },
    predecessor: {
      bytes: 133879,
      sha256: "9b8b412488b2eb5b0c1dd385e21ffa5c1857be5d32bfd94b3d9da1971d22392a",
    },
    inverseHunks: [{ start: 250, remove: 23, restore: [] }],
  },
  {
    path: "scripts/lib/m10a-t15-proof.mjs",
    current: {
      bytes: 13958,
      sha256: "c679bc117c899b6f67d136899898337ffd98561ea4d6b53868c0082dae20ee17",
    },
    predecessor: {
      bytes: 13668,
      sha256: "720c5f7d6ca95fd34f485d79d6b9295c177e3650d2fb9ad583c3c3429187c623",
    },
    inverseHunks: [
      { start: 15, remove: 1, restore: [] },
      {
        start: 122,
        remove: 29,
        restore: [
          "function projectM10AT15CurrentBytes(relative, bytes) {",
          "  const successor = M10A_T16_LEGACY_INPUT_SUCCESSORS.find(({ path: owned }) => owned === relative);",
          "  if (successor === undefined) return bytes;",
          "  if (",
          "    !Buffer.isBuffer(bytes) ||",
          "    bytes.byteLength !== successor.current.bytes ||",
          "    sha256(bytes) !== successor.current.sha256",
          "  )",
          '    fail("SOURCE_DRIFT", "The T16 successor differs from its reviewed current receipt.");',
          '  const lines = bytes.toString("utf8").split("\\n");',
          "  for (const hunk of [...successor.inverseHunks].reverse()) {",
          "    const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;",
          "    if (start < 0 || start + hunk.remove > lines.length)",
          '      fail("SOURCE_DRIFT", "The reviewed T16 inverse is out of bounds.");',
          "    lines.splice(start, hunk.remove, ...hunk.restore);",
          "  }",
          '  const predecessor = Buffer.from(lines.join("\\n"));',
          "  if (",
          "    predecessor.byteLength !== successor.predecessor.bytes ||",
          "    sha256(predecessor) !== successor.predecessor.sha256",
          "  )",
          '    fail("SOURCE_DRIFT", "The reviewed T16 inverse does not reproduce its predecessor.");',
          "  return predecessor;",
        ],
      },
    ],
  },
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
