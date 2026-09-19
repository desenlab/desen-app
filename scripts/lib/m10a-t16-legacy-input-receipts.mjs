// Reviewed inverse hunks reconstruct the exact T15 App inputs from the current T16 working tree.
// They are historical data only; every application is fenced by both current and predecessor receipts.
export const M10A_T16_LEGACY_INPUT_SUCCESSORS = Object.freeze([
  {
    path: "scripts/lib/m10a-t15-proof.mjs",
    current: {
      bytes: 13668,
      sha256: "720c5f7d6ca95fd34f485d79d6b9295c177e3650d2fb9ad583c3c3429187c623",
    },
    predecessor: {
      bytes: 12250,
      sha256: "cc323d418ddd435a5a3eb2b6b015ac7838ea5fbc825e5c323b468c4d2a743a56",
    },
    inverseHunks: [
      { start: 14, remove: 1, restore: [] },
      { start: 116, remove: 30, restore: [] },
      {
        start: 216,
        remove: 1,
        restore: ["    const bytes = await regular(relative);"],
      },
    ],
  },
  {
    path: "apps/desen-app/src/application.tsx",
    current: {
      bytes: 199207,
      sha256: "d0456c3cdcecba4f942026ad576197867bd311d390f2ce38ec86cd911f046243",
    },
    predecessor: {
      bytes: 196864,
      sha256: "f27bc881bde7e8fb2e5d841355f8b4b5299552ae44d0385df3d364d488161ef4",
    },
    inverseHunks: [
      {
        start: 56,
        remove: 7,
        restore: [
          'import { applyAuthoringStyleEdit, prepareAuthoringStyleModel } from "./authoring-styles.js";',
        ],
      },
      {
        start: 176,
        remove: 7,
        restore: [
          'import type { AuthoringStyleEdit, AuthoringStyleTarget } from "./authoring-styles.js";',
        ],
      },
      {
        start: 2607,
        remove: 5,
        restore: ['    styleTarget.kind === "base" ? "desktop" : styleTarget.breakpoint;'],
      },
      {
        start: 2839,
        remove: 7,
        restore: [],
      },
      {
        start: 2861,
        remove: 3,
        restore: ['      : styleTarget.kind === "base"'],
      },
      {
        start: 2871,
        remove: 1,
        restore: ['    (styleTarget.kind !== "base" ||'],
      },
      {
        start: 2992,
        remove: 1,
        restore: ["  const effectivePreview ="],
      },
      {
        start: 2998,
        remove: 1,
        restore: ["  const effectivePreviewDocument ="],
      },
      {
        start: 3004,
        remove: 18,
        restore: [],
      },
      {
        start: 3124,
        remove: 1,
        restore: [
          '            styleTarget.kind === "base" ? (effectiveCanvasFrame ?? undefined) : undefined,',
        ],
      },
      {
        start: 3800,
        remove: 26,
        restore: [],
      },
      {
        start: 4620,
        remove: 5,
        restore: [
          '              if (!isDesignMode() || canvasFrame.status !== "ready" || styleTarget.kind !== "base")',
        ],
      },
      {
        start: 4752,
        remove: 1,
        restore: [],
      },
      {
        start: 4773,
        remove: 1,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app/src/authoring-styles.ts",
    current: {
      bytes: 72542,
      sha256: "78cba18afa09bbb0609bbe653ea84c63929ce109d916af941893633fcd768aaa",
    },
    predecessor: {
      bytes: 50494,
      sha256: "766adea2e706dd03fe443788bf0b76c070b90c8dfca358b0aad6537cf1a9d03e",
    },
    inverseHunks: [
      {
        start: 2,
        remove: 1,
        restore: [],
      },
      {
        start: 9,
        remove: 1,
        restore: [],
      },
      {
        start: 21,
        remove: 1,
        restore: [],
      },
      {
        start: 41,
        remove: 2,
        restore: [],
      },
      {
        start: 77,
        remove: 2,
        restore: [],
      },
      {
        start: 133,
        remove: 11,
        restore: [],
      },
      {
        start: 240,
        remove: 2,
        restore: [],
      },
      {
        start: 526,
        remove: 15,
        restore: [],
      },
      {
        start: 730,
        remove: 1,
        restore: [],
      },
      {
        start: 734,
        remove: 3,
        restore: [
          "  const state =",
          "    style === undefined ? undefined : ownDataObject(ownDataValue(style, BASE_STYLE_STATE));",
          "  const stylePart = state === undefined ? undefined : ownDataObject(ownDataValue(state, part));",
        ],
      },
      {
        start: 790,
        remove: 19,
        restore: [],
      },
      {
        start: 930,
        remove: 30,
        restore: [],
      },
      {
        start: 1038,
        remove: 77,
        restore: [],
      },
      {
        start: 1130,
        remove: 8,
        restore: [
          '  return target.kind === "base"',
          "    ? control.base",
          "    : control.responsive.find(({ breakpoint }) => breakpoint.id === target.breakpoint)?.value;",
        ],
      },
      {
        start: 1179,
        remove: 39,
        restore: [],
      },
      {
        start: 1355,
        remove: 11,
        restore: [],
      },
      {
        start: 1441,
        remove: 6,
        restore: [],
      },
      {
        start: 1496,
        remove: 47,
        restore: [],
      },
      {
        start: 1623,
        remove: 288,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app/src/inspector-panel.tsx",
    current: {
      bytes: 43977,
      sha256: "c249c66188478e7a0517ab127c299d52d2b9fd11709e21f21acffc2587e717c3",
    },
    predecessor: {
      bytes: 35107,
      sha256: "f5f63d93e0d4a5a73fa652d6b07b3b068fc3b0015aaec385f26085932a3d6bc8",
    },
    inverseHunks: [
      {
        start: 24,
        remove: 3,
        restore: [],
      },
      {
        start: 56,
        remove: 4,
        restore: [],
      },
      {
        start: 62,
        remove: 1,
        restore: ['type InspectorTab = "inspector" | "style" | "state" | "actions";'],
      },
      {
        start: 88,
        remove: 204,
        restore: [],
      },
      {
        start: 1006,
        remove: 2,
        restore: [],
      },
      {
        start: 1018,
        remove: 1,
        restore: [],
      },
      {
        start: 1039,
        remove: 3,
        restore: ["          : actionsTab"],
      },
      {
        start: 1048,
        remove: 1,
        restore: [
          '    const tabs: readonly InspectorTab[] = ["inspector", "style", "state", "actions"];',
        ],
      },
      {
        start: 1103,
        remove: 13,
        restore: [],
      },
      {
        start: 1144,
        remove: 10,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app/src/style-panel.tsx",
    current: {
      bytes: 68341,
      sha256: "9d74485acbff40f4b8dd8337df4c9d9e6287a80e88b3aa3d3c42ba143a61b263",
    },
    predecessor: {
      bytes: 65544,
      sha256: "424abb192f510104aca344d6cdef48b466df4aae15bb9bdb9943638b5bc9f191",
    },
    inverseHunks: [
      {
        start: 63,
        remove: 13,
        restore: [],
      },
      {
        start: 89,
        remove: 2,
        restore: [],
      },
      {
        start: 99,
        remove: 8,
        restore: [],
      },
      {
        start: 240,
        remove: 14,
        restore: [],
      },
      {
        start: 265,
        remove: 9,
        restore: [
          '              (target.kind === "breakpoint" && layer.target.breakpoint === target.breakpoint))',
        ],
      },
      {
        start: 1838,
        remove: 2,
        restore: [],
      },
      {
        start: 1845,
        remove: 2,
        restore: [],
      },
      {
        start: 1853,
        remove: 12,
        restore: [],
      },
      {
        start: 1877,
        remove: 9,
        restore: [
          '              (target.kind === "breakpoint" && layer.target.breakpoint === target.breakpoint));',
        ],
      },
      {
        start: 1942,
        remove: 1,
        restore: [],
      },
      {
        start: 1991,
        remove: 4,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app/README.md",
    current: {
      bytes: 60700,
      sha256: "85c5064006023159b3c552e68b379edfcb8d500bf7721b244ab6c913251f4d7f",
    },
    predecessor: {
      bytes: 60089,
      sha256: "85fdd108b8ef14268f4e18d7e1074d064a266baa109fed63f88f403a2f71fd19",
    },
    inverseHunks: [
      {
        start: 3,
        remove: 1,
        restore: ["## M10A-T15 aggregate integration in progress"],
      },
      {
        start: 29,
        remove: 12,
        restore: [
          "Source or a hidden mutation API. These are local checks, not T15 completion: task-owned evidence,",
          "hosted CI and merge closure remain in progress.",
        ],
      },
    ],
  },
]);
