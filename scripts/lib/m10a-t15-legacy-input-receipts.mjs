// These reviewed inverse hunks reconstruct only exact pre-T15 inputs from main 70c8d652.
// They are historical data, never executable source or substitutes for fresh current graph checks.
// Full current and predecessor digests fence every application of an inverse.
function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Exact T15 input receipts and bounded inverse hunks for immutable predecessor readers. */
export const M10A_T15_LEGACY_INPUT_SUCCESSORS = freeze([
  {
    path: "apps/desen-app/README.md",
    current: {
      bytes: 60089,
      sha256: "85fdd108b8ef14268f4e18d7e1074d064a266baa109fed63f88f403a2f71fd19",
    },
    predecessor: {
      bytes: 57363,
      sha256: "cdd84d677bbfa3f1c4f8f183eed2af78beff8498b1099e65082339a5ffa52608",
    },
    inverseHunks: [
      {
        start: 3,
        remove: 35,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app-browser-e2e/README.md",
    current: {
      bytes: 12913,
      sha256: "0a6c6348440706305a0ddaafc11087370663e4a6e423487f2ad50c85ba514d9a",
    },
    predecessor: {
      bytes: 11437,
      sha256: "590ad3afffb1fee95c80e104b710a027be0754e5b01aa9c26f84e39fbdb21cac",
    },
    inverseHunks: [
      {
        start: 11,
        remove: 1,
        restore: [
          "reference host, then typechecks and builds the harness before running all ten Chromium journeys.",
        ],
      },
      {
        start: 39,
        remove: 1,
        restore: ["The ten independently configured journeys cover:"],
      },
      {
        start: 79,
        remove: 21,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app-browser-e2e/package.json",
    current: {
      bytes: 2075,
      sha256: "b4ea1a4b7bd0c160108df7d779587d13a599247cb47f751bf8516386d52ea548",
    },
    predecessor: {
      bytes: 1819,
      sha256: "a811cf3d7ec960796ab47baee69524888a59efc0ab26e81a7eeeaf1968547c66",
    },
    inverseHunks: [
      {
        start: 12,
        remove: 1,
        restore: [],
      },
      {
        start: 14,
        remove: 1,
        restore: [
          '    "test:e2e": "pnpm --filter @desen/app-web... build && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts && playwright test --config input-pending-playwright.config.ts && playwright test --config failure-playwright.config.ts && playwright test --config success-host-playwright.config.ts && playwright test --config published-host-playwright.config.ts && playwright test --config invalid-publication-playwright.config.ts && playwright test --config restart-recovery-playwright.config.ts && playwright test --config repeatable-demo-playwright.config.ts && playwright test --config t12-playwright.config.ts"',
        ],
      },
    ],
  },
  {
    path: "apps/desen-app/src/application.module.css",
    current: {
      bytes: 133589,
      sha256: "00d8dd17c6737795a968d89f092589af637ce597850c43fe9228a65f9607098c",
    },
    predecessor: {
      bytes: 133516,
      sha256: "12d0647cb988870dfe77f4e348e0cf57eb201df0eb8fe8e5845ae37e018504bc",
    },
    inverseHunks: [
      {
        start: 4647,
        remove: 4,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app/src/application.tsx",
    current: {
      bytes: 196864,
      sha256: "f27bc881bde7e8fb2e5d841355f8b4b5299552ae44d0385df3d364d488161ef4",
    },
    predecessor: {
      bytes: 184768,
      sha256: "4fcc90c0c7af787cefd2a02af795789d9eb89aee139366ba9e4b328e153f7e58",
    },
    inverseHunks: [
      {
        start: 25,
        remove: 5,
        restore: [],
      },
      {
        start: 2114,
        remove: 1,
        restore: [],
      },
      {
        start: 2128,
        remove: 1,
        restore: [],
      },
      {
        start: 2432,
        remove: 1,
        restore: [],
      },
      {
        start: 2556,
        remove: 28,
        restore: [],
      },
      {
        start: 2634,
        remove: 1,
        restore: ["  const [authoringSession, setAuthoringSession] = useState(() =>"],
      },
      {
        start: 2643,
        remove: 1,
        restore: [],
      },
      {
        start: 2645,
        remove: 1,
        restore: ["  if (authoringHistory.current === null) {"],
      },
      {
        start: 2716,
        remove: 10,
        restore: [
          "  const persistenceProjection = useMemo(",
          "    () => projectPersistenceControls(persistenceState, inMemoryDirtyProjection),",
          "    [inMemoryDirtyProjection, persistenceState],",
          "  );",
        ],
      },
      {
        start: 2786,
        remove: 3,
        restore: [],
      },
      {
        start: 2790,
        remove: 1,
        restore: ["      document,"],
      },
      {
        start: 2794,
        remove: 3,
        restore: [
          "      previewRevision: preview.ok ? preview.revision : UNAVAILABLE_PREVIEW_REVISION,",
        ],
      },
      {
        start: 2798,
        remove: 1,
        restore: ["  }, [document, persistenceController, preview]);"],
      },
      {
        start: 3202,
        remove: 1,
        restore: [],
      },
      {
        start: 3205,
        remove: 2,
        restore: [],
      },
      {
        start: 3213,
        remove: 1,
        restore: [],
      },
      {
        start: 3215,
        remove: 4,
        restore: [],
      },
      {
        start: 3239,
        remove: 7,
        restore: ["    const removeNavigationGuard = installDesenAppNavigationGuard(() => {"],
      },
      {
        start: 3252,
        remove: 9,
        restore: [],
      },
      {
        start: 3264,
        remove: 3,
        restore: [
          '          "Discard unsaved changes? Leaving this surface will permanently discard the current authored Source draft.",',
        ],
      },
      {
        start: 3271,
        remove: 2,
        restore: [],
      },
      {
        start: 3301,
        remove: 3,
        restore: [],
      },
      {
        start: 3308,
        remove: 1,
        restore: [],
      },
      {
        start: 3316,
        remove: 1,
        restore: ["  }, [document, persistenceController]);"],
      },
      {
        start: 3326,
        remove: 13,
        restore: [],
      },
      {
        start: 3471,
        remove: 8,
        restore: [],
      },
      {
        start: 3479,
        remove: 0,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: result.preview }));",
        ],
      },
      {
        start: 3482,
        remove: 5,
        restore: [
          '    setSourceDraftNotice("Source applied locally. Save source, then Publish to update the host.");',
        ],
      },
      {
        start: 3490,
        remove: 1,
        restore: ["    nextSession: typeof authoringSession,"],
      },
      {
        start: 3493,
        remove: 16,
        restore: ["  ): void {"],
      },
      {
        start: 3530,
        remove: 1,
        restore: [],
      },
      {
        start: 3535,
        remove: 1,
        restore: [],
      },
      {
        start: 3557,
        remove: 65,
        restore: [],
      },
      {
        start: 3639,
        remove: 2,
        restore: ["    if (!isDesignMode() || persistenceController === null) return;"],
      },
      {
        start: 3651,
        remove: 1,
        restore: ["    commitAuthoringSession(result.session, true, true);"],
      },
      {
        start: 3657,
        remove: 2,
        restore: ["    if (!isDesignMode() || persistenceController === null) return;"],
      },
      {
        start: 3664,
        remove: 1,
        restore: [],
      },
      {
        start: 3723,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3752,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3778,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3801,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3826,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3849,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3876,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3902,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3928,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3971,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 3989,
        remove: 2,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));",
        ],
      },
      {
        start: 4087,
        remove: 6,
        restore: [
          "    commitAuthoringSession(Object.freeze({ document: result.document, preview: admitted.preview }));",
        ],
      },
      {
        start: 4094,
        remove: 1,
        restore: [
          '      `Pasted ${result.insertedNodeIds.length} fresh layer${result.insertedNodeIds.length === 1 ? "" : "s"}.`,',
        ],
      },
      {
        start: 4110,
        remove: 19,
        restore: [],
      },
      {
        start: 4213,
        remove: 26,
        restore: [
          "  const historyState = authoringHistory.current;",
          '  const canUndo = mode === "design" && historyState !== null && historyState.past.length > 0;',
          '  const canRedo = mode === "design" && historyState !== null && historyState.future.length > 0;',
          '  const canReuseSelection = mode === "design" && selectedSourceNodeIds.length > 0;',
        ],
      },
      {
        start: 4247,
        remove: 19,
        restore: [
          '      <header aria-label="Workspace commands" className={styles.workspaceCommandBar}>',
        ],
      },
      {
        start: 4323,
        remove: 1,
        restore: [],
      },
      {
        start: 4395,
        remove: 1,
        restore: [],
      },
      {
        start: 4397,
        remove: 1,
        restore: [],
      },
      {
        start: 4403,
        remove: 1,
        restore: ["                confirmationScope={persistenceController}"],
      },
      {
        start: 4414,
        remove: 1,
        restore: [],
      },
      {
        start: 4477,
        remove: 24,
        restore: [],
      },
      {
        start: 4502,
        remove: 1,
        restore: [
          '        interactive={mode === "design" && !publicationPending && sourceDraft === null}',
        ],
      },
      {
        start: 4535,
        remove: 1,
        restore: [
          '            disabled={mode !== "design" || publicationPending || sourceDraft !== null}',
        ],
      },
    ],
  },
  {
    path: "apps/desen-app/src/authoring-persistence.ts",
    current: {
      bytes: 32034,
      sha256: "716c9b95fcdfa4dbb1696f803ceabfe9c4f946ecefddd6424fd278f82c8ff517",
    },
    predecessor: {
      bytes: 34441,
      sha256: "fcf3d6731cdcaf4bc8ab180a50042d060437c7a08004b47346dd5061fbe1043c",
    },
    inverseHunks: [
      {
        start: 0,
        remove: 0,
        restore: [
          "/* eslint-disable @typescript-eslint/no-invalid-void-type -- The controller is an external-store",
          " * boundary whose callbacks are deliberately receiver-independent. */",
        ],
      },
      {
        start: 8,
        remove: 4,
        restore: [],
      },
      {
        start: 20,
        remove: 0,
        restore: ['import type { AuthoringPreviewBundleSuccess } from "./authoring-preview.js";'],
      },
      {
        start: 43,
        remove: 0,
        restore: ['type PersistencePendingOperation = "opening" | "saving";'],
      },
      {
        start: 46,
        remove: 24,
        restore: [
          "/** Exact App route that selects one project-owned persistence identity and surface admission. */",
          "export interface AuthoringPersistenceRoute {",
          "  readonly projectId: string;",
          "  readonly surfaceId: string;",
          "}",
          "",
          "/** Atomically admitted authored Source and its matching publishable preview. */",
          "export interface AuthoringPersistenceSession {",
          "  readonly document: DesenEditorDocument;",
          "  readonly preview: AuthoringPreviewBundleSuccess;",
          "}",
          "",
          "/** Stable local reason why an authored Source could not cross the App persistence boundary. */",
          "export type AuthoringPersistenceFailureReason =",
          '  | "catalog-invalid"',
          '  | "disposed"',
          '  | "document-invalid"',
          '  | "document-mismatch"',
          '  | "operation-in-progress"',
          '  | "persistence-failed"',
          '  | "port-invalid"',
          '  | "preview-unavailable"',
          '  | "profile-invalid"',
          '  | "projection-limit"',
          '  | "reopen-required"',
          '  | "route-invalid"',
          '  | "stale-operation";',
          "",
          "/** Controlled open failure with an optional redacted Editor Core persistence diagnostic. */",
          "export interface AuthoringPersistenceOpenFailure {",
          '  readonly status: "failed";',
          "  readonly reason: AuthoringPersistenceFailureReason;",
          "  readonly diagnostic: DesenEditorPersistenceDiagnostic | null;",
          "}",
          "",
          "/** Exact successful open after route, document, Catalog, and preview admission. */",
          "export interface AuthoringPersistenceOpenSuccess {",
          '  readonly status: "opened";',
          "  readonly generation: number;",
          "  readonly session: AuthoringPersistenceSession;",
          "}",
          "",
          "/** Open outcome kept distinct from every save settlement. */",
          "export type AuthoringPersistenceOpenResult =",
          "  | AuthoringPersistenceOpenSuccess",
          '  | Readonly<{ readonly status: "missing" }>',
          "  | AuthoringPersistenceOpenFailure;",
          "",
          "/** Controlled save failure with an optional redacted Editor Core persistence diagnostic. */",
          "export interface AuthoringPersistenceSaveFailure {",
          '  readonly status: "failed";',
          "  readonly reason: AuthoringPersistenceFailureReason;",
          "  readonly diagnostic: DesenEditorPersistenceDiagnostic | null;",
          "}",
          "",
          "/** App-owned save settlement retaining every distinct Editor Core persistence outcome. */",
          "export type AuthoringPersistenceSaveResult =",
          '  | Readonly<{ readonly status: "created"; readonly generation: 1 }>',
          '  | Readonly<{ readonly status: "updated"; readonly generation: number }>',
          '  | Readonly<{ readonly status: "unchanged"; readonly generation: number }>',
          '  | Readonly<{ readonly status: "conflict"; readonly currentGeneration: number | null }>',
          '  | Readonly<{ readonly status: "generation-exhausted"; readonly generation: number }>',
          "  | Readonly<{",
          '      readonly status: "indeterminate";',
          "      readonly diagnostic: DesenEditorPersistenceDiagnostic;",
          "    }>",
          "  | AuthoringPersistenceSaveFailure;",
          "",
          "/** Immutable external-store snapshot for authored Source persistence UI. */",
          "export interface AuthoringPersistenceState {",
          "  readonly route: AuthoringPersistenceRoute;",
          "  readonly sourceKey: string;",
          "  readonly session: AuthoringPersistenceSession;",
          "  readonly generation: number | null;",
          "  readonly savedDocument: DesenEditorDocument | null;",
          "  readonly dirty: boolean;",
          "  readonly reopenRequired: boolean;",
          "  readonly pending: PersistencePendingOperation | null;",
          "  readonly openResult: AuthoringPersistenceOpenResult | null;",
          "  readonly saveResult: AuthoringPersistenceSaveResult | null;",
          "  readonly disposed: boolean;",
          "}",
          "",
          "/** Result of replacing only the controller's authored Source session. */",
          "export type AuthoringPersistenceDocumentReplacementResult =",
          "  | Readonly<{ readonly ok: true; readonly session: AuthoringPersistenceSession }>",
          "  | Readonly<{",
          "      readonly ok: false;",
          "      readonly reason: Extract<",
          "        AuthoringPersistenceFailureReason,",
          '        | "catalog-invalid"',
          '        | "disposed"',
          '        | "document-invalid"',
          '        | "document-mismatch"',
          '        | "preview-unavailable"',
          '        | "projection-limit"',
          "      >;",
          "    }>;",
          "",
          "/** Receiver-independent, React-free controller suitable for `useSyncExternalStore`. */",
          "export interface AuthoringPersistenceController {",
          "  readonly read: (this: void) => AuthoringPersistenceState;",
          "  readonly subscribe: (this: void, listener: () => void) => () => void;",
          "  readonly replaceAuthoredDocument: (",
          "    this: void,",
          "    document: DesenEditorDocument,",
          "  ) => AuthoringPersistenceDocumentReplacementResult;",
          "  readonly open: (this: void) => Promise<AuthoringPersistenceOpenResult>;",
          "  readonly save: (this: void) => Promise<AuthoringPersistenceSaveResult>;",
          "  readonly dispose: (this: void) => void;",
          "}",
        ],
      },
      {
        start: 104,
        remove: 2,
        restore: [],
      },
      {
        start: 542,
        remove: 3,
        restore: [
          "  const values = exactOwnData(options, CONFIGURATION_KEYS);",
          '  if (values === undefined) return Object.freeze({ ok: false, reason: "route-invalid" });',
        ],
      },
      {
        start: 559,
        remove: 18,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app/src/main.tsx",
    current: {
      bytes: 7728,
      sha256: "2a714ea98366f4f210b9972214c828275ff6a2bce993d57ff9754181a0c5028b",
    },
    predecessor: {
      bytes: 6793,
      sha256: "03f4c3040c67c4d3644c71835b347ea96fc861a155b217ab87b8ff8277973393",
    },
    inverseHunks: [
      {
        start: 26,
        remove: 3,
        restore: [],
      },
      {
        start: 72,
        remove: 1,
        restore: [],
      },
      {
        start: 96,
        remove: 1,
        restore: [],
      },
      {
        start: 98,
        remove: 1,
        restore: ["    const bridge ="],
      },
      {
        start: 100,
        remove: 8,
        restore: [],
      },
      {
        start: 115,
        remove: 1,
        restore: [],
      },
      {
        start: 119,
        remove: 1,
        restore: [],
      },
      {
        start: 121,
        remove: 3,
        restore: [],
      },
      {
        start: 168,
        remove: 1,
        restore: [],
      },
      {
        start: 183,
        remove: 1,
        restore: [],
      },
    ],
  },
  {
    path: "apps/desen-app/src/persistence-controls.tsx",
    current: {
      bytes: 9958,
      sha256: "38e14c0c2ca259951aa3795d361a3f23f369fb52299702cea467b26c0b9c1397",
    },
    predecessor: {
      bytes: 9272,
      sha256: "478578110307b00e0caeb7bef395a32e59bda4b0624f1b1ce2af430436a13d1e",
    },
    inverseHunks: [
      {
        start: 41,
        remove: 2,
        restore: [],
      },
      {
        start: 114,
        remove: 1,
        restore: [],
      },
      {
        start: 138,
        remove: 3,
        restore: ["  const status = statusText(projection);"],
      },
      {
        start: 183,
        remove: 1,
        restore: ['      aria-label="Source persistence"'],
      },
      {
        start: 186,
        remove: 1,
        restore: [],
      },
      {
        start: 202,
        remove: 1,
        restore: ["          Open source"],
      },
      {
        start: 210,
        remove: 1,
        restore: ["          Save source"],
      },
      {
        start: 235,
        remove: 3,
        restore: ['            : "Open and save affect only the authored Source."'],
      },
      {
        start: 250,
        remove: 3,
        restore: [
          "            Opening the stored Source will replace the current authored Source in this session.",
        ],
      },
    ],
  },
  {
    path: "apps/desen-app/src/product-bootstrap.tsx",
    current: {
      bytes: 16434,
      sha256: "94842fcf3837bd110013856850ab072bf45b33c734a10ab2a014f35a85ab51c6",
    },
    predecessor: {
      bytes: 16148,
      sha256: "ec5519ca8ca6053f8bce80665b1636d4ce962acd1b3c6208178fca7c19c3aab8",
    },
    inverseHunks: [
      {
        start: 5,
        remove: 1,
        restore: [],
      },
      {
        start: 285,
        remove: 1,
        restore: [],
      },
      {
        start: 300,
        remove: 1,
        restore: [],
      },
      {
        start: 302,
        remove: 1,
        restore: ["    [persistencePort, profile, workspaceProfile],"],
      },
    ],
  },
  {
    path: "apps/desen-app/src/project-lifecycle.ts",
    current: {
      bytes: 43184,
      sha256: "9b35cae46001f0fe7bb4c688983640c76317d91416315e6e9fa4e9d69e2cebfb",
    },
    predecessor: {
      bytes: 40345,
      sha256: "d797e98dd28edae64277ffb13fc1a6e4830063b4d5edd6b529f70aacee482fbd",
    },
    inverseHunks: [
      {
        start: 53,
        remove: 1,
        restore: ["  /** Exact T02 editable-project envelope; this layer never rewrites it. */"],
      },
      {
        start: 269,
        remove: 6,
        restore: [],
      },
      {
        start: 541,
        remove: 1,
        restore: ['    : Object.freeze({ status: "failed" });'],
      },
      {
        start: 569,
        remove: 3,
        restore: [
          '  const capturedOptions = ownRecord(options, ["initialWorkspace", "storagePort"]);',
        ],
      },
      {
        start: 575,
        remove: 15,
        restore: [],
      },
      {
        start: 613,
        remove: 6,
        restore: ['    if (state.pending !== null) return resultFailure("operation-in-progress");'],
      },
      {
        start: 638,
        remove: 2,
        restore: [
          '      if (state.pending !== null) return resultFailure("operation-in-progress");',
        ],
      },
      {
        start: 641,
        remove: 1,
        restore: [],
      },
      {
        start: 648,
        remove: 1,
        restore: [],
      },
      {
        start: 660,
        remove: 1,
        restore: [],
      },
      {
        start: 666,
        remove: 7,
        restore: [],
      },
      {
        start: 688,
        remove: 2,
        restore: [
          '      if (state.pending !== null) return resultFailure("operation-in-progress");',
        ],
      },
      {
        start: 693,
        remove: 4,
        restore: [],
      },
      {
        start: 698,
        remove: 1,
        restore: [],
      },
      {
        start: 701,
        remove: 1,
        restore: [
          "        outcome = captureSaveResult(",
          "          await saveWorkspace(",
          "            Object.freeze({ expectedGeneration: state.generation, workspace: state.workspace }),",
          "          ),",
          "        );",
        ],
      },
      {
        start: 703,
        remove: 2,
        restore: ['        outcome = { status: "failed" };'],
      },
      {
        start: 706,
        remove: 1,
        restore: [],
      },
      {
        start: 711,
        remove: 11,
        restore: ["        generation(outcome.generation) !== undefined"],
      },
      {
        start: 729,
        remove: 1,
        restore: ["          savedWorkspace: state.workspace,"],
      },
      {
        start: 745,
        remove: 1,
        restore: ["        replace({ ...state, pending: null, result });"],
      },
      {
        start: 748,
        remove: 1,
        restore: ['      if (outcome.status === "indeterminate") {'],
      },
      {
        start: 759,
        remove: 2,
        restore: [
          '      if (state.pending !== null) return resultFailure("operation-in-progress");',
        ],
      },
      {
        start: 1061,
        remove: 3,
        restore: [
          '      if (state.pending !== null) return resultFailure("operation-in-progress");',
        ],
      },
    ],
  },
  {
    path: "apps/desen-app/src/project-workspace-authoring-persistence.ts",
    current: {
      bytes: 12890,
      sha256: "988efd9ecc26bc1769398639c28c5427e107b88fdcd9691499a6b435546e0f68",
    },
    predecessor: {
      bytes: 10796,
      sha256: "895ee4af157f7f8191a95376e98d8cb7756816c348649cf410071b44673df830",
    },
    inverseHunks: [
      {
        start: 2,
        remove: 1,
        restore: [],
      },
      {
        start: 12,
        remove: 1,
        restore: [],
      },
      {
        start: 20,
        remove: 13,
        restore: [],
      },
      {
        start: 52,
        remove: 2,
        restore: [],
      },
      {
        start: 132,
        remove: 4,
        restore: [
          " * @remarks The bridge never writes a Source key independently. Each editor compare-and-set first",
          " * replaces the selected `record.source` inside the admitted aggregate workspace, then commits the",
          " * complete workspace at the generation observed by the lifecycle controller. Thus a stored Source",
          " * and its design-system token sources cannot diverge into two local truth stores.",
        ],
      },
      {
        start: 141,
        remove: 8,
        restore: [
          "  const { initialProject, lifecycle, projectName, sourceKey, surfaceNames } = options;",
        ],
      },
      {
        start: 224,
        remove: 26,
        restore: [
          "      if (current === undefined) {",
          "        if (request.expectedGeneration !== null) {",
          "          return Object.freeze({",
          '            status: "conflict" as const,',
          "            currentGeneration: snapshot.generation,",
          "          });",
        ],
      },
      {
        start: 251,
        remove: 3,
        restore: [
          "        const created = lifecycle.createProject(",
          "          Object.freeze({ ...initialProject, source }),",
          "          projectName,",
          "          surfaceNames,",
          "        );",
          '        if (created !== null) return failure("source-invalid");',
          "      } else {",
          "        const replaced = lifecycle.replaceProjectRecord(",
          "          projectId,",
          "          Object.freeze({ ...current, source }),",
          "        );",
          '        if (replaced !== null) return failure("source-invalid");',
          "      }",
          "      const settlement = await lifecycle.save();",
          '      if (createsSourceInExistingAggregate && settlement.status === "updated") {',
          "        if (settlement.generation !== snapshot.generation + 1)",
          '          return failure("storage-unavailable");',
          "        sourceGenerationAlias = Object.freeze({",
          "          sourceGeneration: 1,",
          "          aggregateGeneration: settlement.generation,",
          "        });",
          '        return Object.freeze({ status: "created" as const, generation: 1 });',
          "      }",
          "      if (matchingAlias !== undefined && request.expectedGeneration !== null) {",
          '        if (settlement.status === "updated") {',
          "          if (settlement.generation !== matchingAlias.aggregateGeneration + 1) {",
        ],
      },
      {
        start: 254,
        remove: 0,
        restore: [
          "          }",
          "          const nextSourceGeneration = request.expectedGeneration + 1;",
        ],
      },
      {
        start: 256,
        remove: 1,
        restore: ["            sourceGeneration: nextSourceGeneration,"],
      },
      {
        start: 259,
        remove: 1,
        restore: [
          '          return Object.freeze({ status: "updated" as const, generation: nextSourceGeneration });',
        ],
      },
      {
        start: 261,
        remove: 20,
        restore: [
          '        if (settlement.status === "unchanged") {',
          "          if (settlement.generation !== matchingAlias.aggregateGeneration) {",
          '            return failure("storage-unavailable");',
        ],
      },
      {
        start: 281,
        remove: 0,
        restore: [
          "          return Object.freeze({",
          '            status: "unchanged" as const,',
          "            generation: request.expectedGeneration,",
          "          });",
        ],
      },
      {
        start: 283,
        remove: 5,
        restore: ["      }", "      return writeSettlement(settlement);"],
      },
      {
        start: 292,
        remove: 4,
        restore: [
          "    return Object.freeze({ ok: true, persistencePort: createDesenEditorPersistencePort(adapter) });",
        ],
      },
    ],
  },
  {
    path: "apps/desen-app/src/starter-project.ts",
    current: {
      bytes: 4160,
      sha256: "f5d79aeaee47ac25f675b7113fd270bb36426c1d9f00e2fc41a8d79e358f14d7",
    },
    predecessor: {
      bytes: 4000,
      sha256: "00c43f860cc94e5f8dd97b4de5b9a65e55ce6116bf881d31b670713b7a54afa5",
    },
    inverseHunks: [
      {
        start: 1,
        remove: 4,
        restore: ['import { admitEditableProjectRecord } from "@desen/design-system-core";'],
      },
      {
        start: 53,
        remove: 1,
        restore: ["  /** Exact T02 envelope with one DESEN Neutral surface. */"],
      },
      {
        start: 62,
        remove: 1,
        restore: [
          " * @remarks The returned T02 envelope contains ordinary Source data only: a Stack root, one",
        ],
      },
      {
        start: 72,
        remove: 1,
        restore: ["    schemaVersion: 1,"],
      },
      {
        start: 104,
        remove: 6,
        restore: [
          "    designSystem: { tokenSources: STARTER_NEUTRAL_TOKEN_SOURCES, recipes: [], assets: [] },",
        ],
      },
    ],
  },
  {
    path: "apps/desen-app/src/starter-workspace-product.tsx",
    current: {
      bytes: 2527,
      sha256: "7e8da51344b4558b6fdcb0c3e52c776359ad651429b422c0f0fe833bbabdfa0f",
    },
    predecessor: {
      bytes: 1774,
      sha256: "7cab34f631ba051ff04e5797a9c27367c5fb88b9a29be942852c59f908b1a587",
    },
    inverseHunks: [
      {
        start: 5,
        remove: 1,
        restore: [],
      },
      {
        start: 10,
        remove: 4,
        restore: [],
      },
      {
        start: 17,
        remove: 2,
        restore: [],
      },
      {
        start: 25,
        remove: 2,
        restore: [
          " * Renders the ordinary DESEN Neutral product while keeping its visible Style token selection tied",
          " * to the current persisted aggregate project record.",
        ],
      },
      {
        start: 29,
        remove: 2,
        restore: [
          " * that through the same lifecycle controller. This external-store subscription merely prevents a",
          " * stale profile default from becoming the Style panel's token authority after a saved/reopened",
          " * project supplies a different admitted design-system selection.",
        ],
      },
      {
        start: 33,
        remove: 1,
        restore: [],
      },
      {
        start: 39,
        remove: 5,
        restore: [],
      },
      {
        start: 46,
        remove: 7,
        restore: [
          "    <DesenAppProduct",
          "      authoringProjectRecord={project ?? initialProject}",
          "      persistencePort={persistencePort}",
          "      workspaceProfile={STARTER_NEUTRAL_WORKSPACE_PROFILE}",
          "    />",
        ],
      },
    ],
  },
]);

/** Exact additive T15 App sources, including the non-executable type-only module. */
export const M10A_T15_ADDED_APP_SOURCE_RECEIPTS = freeze([
  {
    path: "apps/desen-app/src/authoring-persistence-types.ts",
    bytes: 4707,
    sha256: "9380b9cd0fea2f14fbbc786a7b9f59dc018bdadc77fc61cecf8c26684b51729c",
  },
  {
    path: "apps/desen-app/src/master-draft-banner.module.css",
    bytes: 734,
    sha256: "fd72d6623fa37f3df2cc1c08d55463647fb0024bc4cffcd34a8fcba2180d03ed",
  },
  {
    path: "apps/desen-app/src/master-draft-banner.tsx",
    bytes: 1637,
    sha256: "10ba75b6f35173ed6652a906652673142e7e8e708330a3fe91c1ffc1a4ba1c3f",
  },
  {
    path: "apps/desen-app/src/master-instance-panel.module.css",
    bytes: 1147,
    sha256: "bc9fbe1f3c36f741ef0fc61de025dac1f01b5a3d9fd277896bd21e0076e9ed14",
  },
  {
    path: "apps/desen-app/src/master-instance-panel.tsx",
    bytes: 14054,
    sha256: "d5fc12181e65454fe3b5440239d2c98d2b329aebca8533ce1cd90890ef16102a",
  },
  {
    path: "apps/desen-app/src/project-authoring-context.tsx",
    bytes: 1027,
    sha256: "1e47c5a86ef1a33aaa17792985f0535561a3738345dc0261ada7c9530a13cf98",
  },
  {
    path: "apps/desen-app/src/project-authoring-controller.ts",
    bytes: 16636,
    sha256: "20e89bb2b46a05fd37cffb14db2f6f5d3267952f178884b27792a64188acc417",
  },
  {
    path: "apps/desen-app/src/project-authoring-session.ts",
    bytes: 4400,
    sha256: "e82f6caf985c63c95c69d4eaf9db50f2e9af51f8e9ace534c4e6342c6d2f8e40",
  },
  {
    path: "apps/desen-app/src/project-authoring-source-controller.ts",
    bytes: 8885,
    sha256: "a4312f1807c226538c15653c632adf08ea0de14fa7eab924c4e9bd674b657bef",
  },
  {
    path: "apps/desen-app/src/project-master-draft-controller.ts",
    bytes: 11707,
    sha256: "a5b91d48955637d8c1449a3ff6fc17a6f1126cc43e3e710f10758712f173f07b",
  },
]);
