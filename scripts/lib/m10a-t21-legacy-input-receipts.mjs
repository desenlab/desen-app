// Reviewed T21 successor receipts. These inverse hunks are historical identity data only:
// they reconstruct the exact T20 source bytes before the T21 resource wiring was added.
export const M10A_T21_LEGACY_INPUT_SUCCESSORS = Object.freeze([
  {
    path: "apps/desen-app/src/authoring-connections.ts",
    current: {
      bytes: 40169,
      sha256: "2b5ffd61e32b5d7695ab09e4d51dc85e0ef3ae81ae0969437cc7d918d5beaa4b",
    },
    predecessor: {
      bytes: 27291,
      sha256: "e23337ebb85fdf43bb6c8370addd26526ecdf96a5b5afdf68ecd8f751b0767b2",
    },
    inverseHunks: [
      { start: 4, remove: 1, restore: [] },
      { start: 8, remove: 1, restore: [] },
      { start: 64, remove: 14, restore: [] },
      {
        start: 82,
        remove: 1,
        restore: ['  readonly operation: "connect-input" | "connect-operation-trigger";'],
      },
      { start: 92, remove: 1, restore: [] },
      { start: 114, remove: 6, restore: [] },
      { start: 310, remove: 42, restore: [] },
      { start: 416, remove: 145, restore: [] },
      { start: 562, remove: 1, restore: ["  authority: PreparedConnectionAuthority,"] },
      {
        start: 574,
        remove: 4,
        restore: [
          "function surfaceHasState(authority: PreparedConnectionAuthority, stateName: string): boolean {",
        ],
      },
      {
        start: 741,
        remove: 2,
        restore: [
          "  authority: PreparedConnectionAuthority,",
          '  category: "components" | "operations",',
        ],
      },
      { start: 854, remove: 40, restore: [] },
      { start: 896, remove: 7, restore: [] },
      { start: 1012, remove: 65, restore: [] },
    ],
  },
  {
    path: "apps/desen-app/src/authoring-integration.ts",
    current: {
      bytes: 30729,
      sha256: "d2275c68190e264edb8dc8f39ef2c315755682475789b7083189455e750a79b4",
    },
    predecessor: {
      bytes: 20932,
      sha256: "c189d7ca2dd855eda6202f5ec9b8d9c1d57f19579cad3fdec7bea757d1a85601",
    },
    inverseHunks: [
      { start: 5, remove: 1, restore: [] },
      { start: 18, remove: 2, restore: [] },
      { start: 49, remove: 11, restore: [] },
      { start: 72, remove: 2, restore: [] },
      {
        start: 88,
        remove: 1,
        restore: ['      reason: "input-invalid" | "profile-invalid" | "operation-invalid";'],
      },
      { start: 103, remove: 8, restore: [] },
      { start: 117, remove: 1, restore: [] },
      { start: 128, remove: 1, restore: [] },
      { start: 158, remove: 2, restore: ['        | "operation-model-invalid";'] },
      { start: 166, remove: 1, restore: [] },
      { start: 181, remove: 8, restore: [] },
      { start: 212, remove: 32, restore: [] },
      { start: 292, remove: 26, restore: [] },
      {
        start: 332,
        remove: 5,
        restore: [
          "  const captured = exactDataRecord(input, [",
          '    "profile",',
          '    "bindingId",',
          '    "label",',
          '    "description",',
          '    "operations",',
          "  ]);",
        ],
      },
      { start: 352, remove: 5, restore: [] },
      { start: 386, remove: 26, restore: [] },
      {
        start: 414,
        remove: 1,
        restore: [
          "  BINDING_AUTHORITIES.set(binding, { profile: profileHandle, descriptor, operations });",
        ],
      },
      { start: 468, remove: 38, restore: [] },
      { start: 564, remove: 8, restore: [] },
      { start: 580, remove: 10, restore: [] },
      { start: 616, remove: 10, restore: [] },
      { start: 639, remove: 2, restore: [] },
      { start: 708, remove: 63, restore: [] },
      { start: 782, remove: 8, restore: [] },
      { start: 793, remove: 1, restore: [] },
    ],
  },
  {
    path: "apps/desen-app/src/authoring-run-navigation.ts",
    current: {
      bytes: 7107,
      sha256: "eead527b6bdd4e9ddd3f16aaee0d9216189ddc46a02ab39b0bbcba2a4238fbb5",
    },
    predecessor: {
      bytes: 7049,
      sha256: "5c617f21a6df377d94318b708ba74e6b60e4e200793a219e6ff9003be892d2a8",
    },
    inverseHunks: [
      { start: 10, remove: 1, restore: [] },
      { start: 169, remove: 1, restore: [] },
      { start: 191, remove: 1, restore: ["    resources: { load: () => DENIED },"] },
    ],
  },
  {
    path: "apps/desen-app/src/authoring-style-preview-runtime.ts",
    current: {
      bytes: 5507,
      sha256: "bdfb1af25717fe41f55b85d73a6156797f9bd44fd66427389cf49e9192ab2d18",
    },
    predecessor: {
      bytes: 5449,
      sha256: "7ab842b881d4ccfcc5f769dc80bd06f79d23b6e419848ce17ec179c3c142c8a5",
    },
    inverseHunks: [
      { start: 8, remove: 1, restore: [] },
      { start: 113, remove: 1, restore: [] },
      { start: 130, remove: 1, restore: ["    resources: { load: () => DENIED },"] },
    ],
  },
  {
    path: "apps/desen-app/src/behavior-controls.tsx",
    current: {
      bytes: 44781,
      sha256: "85f3a1808a66757e0ba2d261179a6e1bf9fcc5a9ba19dec6b9ef07121e2acb2b",
    },
    predecessor: {
      bytes: 36553,
      sha256: "5a26dde1c4a65071979421fdf36ecf5b738376e3692849bbda86d420052d4e8e",
    },
    inverseHunks: [
      { start: 13, remove: 2, restore: [] },
      { start: 33, remove: 207, restore: [] },
    ],
  },
]);
