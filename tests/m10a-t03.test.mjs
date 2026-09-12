import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import * as authoring from "../packages/design-system-authoring/dist/index.js";
import * as designSystemCore from "../packages/design-system-core/dist/index.js";
import {
  M10A_T03_ROOT_TEST_NAMES,
  M10AT03ProofError,
  buildM10AT03Evidence,
  verifyM10AT03Evidence,
  writeM10AT03Evidence,
} from "../scripts/lib/m10a-t03-proof.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const PROOF_DOCUMENT = "docs/proof/M10A-T03.md";
const GRAPH_RECEIPT = "apps/design-system-workbench-proof/dist/workbench-graph-proof.json";
const AUTHORING_MANIFEST = "packages/design-system-authoring/package.json";
const WORKBENCH_MANIFEST = "apps/design-system-workbench-proof/package.json";
const AUTHORING_INDEX = "packages/design-system-authoring/src/index.ts";
const T02_ARTIFACT = "docs/proof/artifacts/m10a-t02.json";
const SC01_DTCG_ARTIFACT = "docs/proof/artifacts/sc-01-dtcg-compatibility.json";
const RUNTIME_CORE_ARTIFACT = "docs/proof/artifacts/runtime-core-baseline.json";
const EXPECTED_ARTIFACT_BYTES = 80_054;
const EXPECTED_ARTIFACT_SHA256 = "530efe5d80d78a722c1832ad5b95086c2fd97bc2f1a4bd275b9a1924394b1e2b";

const SC01_PREVIEW_READY_UNDER_T02 = Object.freeze([
  "number-token",
  "typography-token",
  "color-without-local-alpha-and-hex",
]);
const SC01_HISTORICAL_FEATURES_SUPPORTED_BY_T02 = Object.freeze([
  "root-token-curly-alias",
  "alias-infers-target-type",
  "token-vendor-extension",
  "deprecated-token",
  ...SC01_PREVIEW_READY_UNDER_T02,
]);
const SC01_PRESERVED_UNSUPPORTED = Object.freeze([
  "root-token-curly-alias",
  "alias-infers-target-type",
  "whole-token-json-pointer",
  "color-component-json-pointer",
  "group-root-token",
  "group-extends",
  "empty-described-group",
  "token-vendor-extension",
  "deprecated-token",
  "display-p3-color",
  "oklch-color",
  "srgb-none-component",
  "resolver-theme-modifier",
]);
const SC01_EXACT_DISCLOSURES = Object.freeze([
  [
    "root-token-curly-alias",
    [["OPTIONAL_COLOR_ALPHA_AND_HEX", "UNSUPPORTED_DTCG_MEMBER", "/primary/$value/hex", "primary"]],
  ],
  [
    "alias-infers-target-type",
    [
      [
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/palette/primary/$value/hex",
        "palette.primary",
      ],
    ],
  ],
  [
    "whole-token-json-pointer",
    [
      ["JSON_POINTER_REF", "UNSUPPORTED_DTCG_MEMBER", "/alias/$ref", "alias"],
      ["OPTIONAL_COLOR_ALPHA_AND_HEX", "UNSUPPORTED_DTCG_MEMBER", "/primary/$value/hex", "primary"],
    ],
  ],
  [
    "color-component-json-pointer",
    [
      ["OPTIONAL_COLOR_ALPHA_AND_HEX", "UNSUPPORTED_DTCG_MEMBER", "/base/$value/hex", "base"],
      ["OPTIONAL_COLOR_ALPHA_AND_HEX", "UNSUPPORTED_DTCG_MEMBER", "/derived/$value/hex", "derived"],
      [
        "PROPERTY_LEVEL_REF",
        "UNSUPPORTED_PROPERTY_ALIAS",
        "/derived/$value/components/0/$ref",
        "derived",
      ],
    ],
  ],
  [
    "group-root-token",
    [
      [
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/semantic/$root/$value/hex",
        "semantic.$root",
      ],
      [
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/semantic/accent/$value/hex",
        "semantic.accent",
      ],
      ["ROOT_GROUP_TOKEN", "UNSUPPORTED_DTCG_MEMBER", "/semantic/$root", "semantic.$root"],
    ],
  ],
  [
    "group-extends",
    [
      ["GROUP_EXTENDS", "UNSUPPORTED_DTCG_MEMBER", "/derived/$extends", "derived"],
      [
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/base/accent/$value/hex",
        "base.accent",
      ],
      [
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/derived/accent/$value/hex",
        "derived.accent",
      ],
    ],
  ],
  ["empty-described-group", [["EMPTY_GROUP", "EMPTY_DTCG_GROUP", "/empty", "empty"]]],
  [
    "token-vendor-extension",
    [["OPTIONAL_COLOR_ALPHA_AND_HEX", "UNSUPPORTED_DTCG_MEMBER", "/primary/$value/hex", "primary"]],
  ],
  [
    "deprecated-token",
    [["OPTIONAL_COLOR_ALPHA_AND_HEX", "UNSUPPORTED_DTCG_MEMBER", "/legacy/$value/hex", "legacy"]],
  ],
  ["number-token", []],
  ["typography-token", []],
  [
    "display-p3-color",
    [["ADDITIONAL_COLOR_SPACES", "UNSUPPORTED_COLOR_SPACE", "/accent/$value/colorSpace", "accent"]],
  ],
  [
    "oklch-color",
    [["ADDITIONAL_COLOR_SPACES", "UNSUPPORTED_COLOR_SPACE", "/accent/$value/colorSpace", "accent"]],
  ],
  [
    "srgb-none-component",
    [["NONE_COLOR_COMPONENTS", "UNSUPPORTED_DTCG_MEMBER", "/accent/$value/components/0", "accent"]],
  ],
  ["color-without-local-alpha-and-hex", []],
  ["resolver-theme-modifier", [["RESOLVER_THEMES_AND_MODES", "UNSUPPORTED_DTCG_MEMBER", "", null]]],
]);
const SC01_EXACT_INVALID_DIAGNOSTICS = Object.freeze([
  ["name-containing-dot", "INVALID_DTCG_NAME", "/bad.name"],
  ["malformed-dimension-value", "INVALID_DTCG_VALUE", "/space/sm/$value/value"],
  ["alias-cycle", "ALIAS_CYCLE", "/color/a/$value"],
  ["malformed-json-pointer", "INVALID_DTCG_STRUCTURE", "/alias/$ref"],
  ["missing-json-pointer-target", "ALIAS_TARGET_MISSING", "/alias/$ref"],
  ["misplaced-json-pointer-under-value", "INVALID_DTCG_VALUE", "/alias/$value"],
  ["malformed-resolver-required-fields", "INVALID_DTCG_STRUCTURE", ""],
]);
const T02_RECOGNIZED_UNSUPPORTED = Object.freeze([
  Object.freeze({
    id: "complex-border-stroke-style",
    disclosures: Object.freeze([
      Object.freeze({
        featureId: "ADDITIONAL_TOKEN_TYPES",
        code: "UNSUPPORTED_STROKE_STYLE",
        pointer: "/border/$value/style",
        tokenPath: "border",
      }),
    ]),
  }),
  Object.freeze({
    id: "typography-composite-token-reference",
    disclosures: Object.freeze([
      Object.freeze({
        featureId: "ADDITIONAL_TOKEN_TYPES",
        code: "UNSUPPORTED_DTCG_TYPE",
        pointer: "/family/$type",
        tokenPath: "family",
      }),
      Object.freeze({
        featureId: "PROPERTY_LEVEL_REF",
        code: "UNSUPPORTED_PROPERTY_ALIAS",
        pointer: "/typography/$value/fontFamily",
        tokenPath: "typography",
      }),
    ]),
  }),
  Object.freeze({
    id: "font-family-token",
    disclosures: Object.freeze([
      Object.freeze({
        featureId: "ADDITIONAL_TOKEN_TYPES",
        code: "UNSUPPORTED_DTCG_TYPE",
        pointer: "/family/$type",
        tokenPath: "family",
      }),
    ]),
  }),
  Object.freeze({
    id: "font-weight-token",
    disclosures: Object.freeze([
      Object.freeze({
        featureId: "ADDITIONAL_TOKEN_TYPES",
        code: "UNSUPPORTED_DTCG_TYPE",
        pointer: "/weight/$type",
        tokenPath: "weight",
      }),
    ]),
  }),
  Object.freeze({
    id: "gradient-token-with-references",
    disclosures: Object.freeze([
      Object.freeze({
        featureId: "ADDITIONAL_TOKEN_TYPES",
        code: "UNSUPPORTED_DTCG_TYPE",
        pointer: "/gradient/$type",
        tokenPath: "gradient",
      }),
      Object.freeze({
        featureId: "ADDITIONAL_TOKEN_TYPES",
        code: "UNSUPPORTED_DTCG_TYPE",
        pointer: "/singleton/$type",
        tokenPath: "singleton",
      }),
      Object.freeze({
        featureId: "PROPERTY_LEVEL_REF",
        code: "UNSUPPORTED_PROPERTY_ALIAS",
        pointer: "/gradient/$value/0",
        tokenPath: "gradient",
      }),
      Object.freeze({
        featureId: "PROPERTY_LEVEL_REF",
        code: "UNSUPPORTED_PROPERTY_ALIAS",
        pointer: "/gradient/$value/1/color",
        tokenPath: "gradient",
      }),
      Object.freeze({
        featureId: "PROPERTY_LEVEL_REF",
        code: "UNSUPPORTED_PROPERTY_ALIAS",
        pointer: "/gradient/$value/1/position",
        tokenPath: "gradient",
      }),
    ]),
  }),
  Object.freeze({
    id: "stroke-style-token-with-reference",
    disclosures: Object.freeze([
      Object.freeze({
        featureId: "ADDITIONAL_TOKEN_TYPES",
        code: "UNSUPPORTED_DTCG_TYPE",
        pointer: "/style/$type",
        tokenPath: "style",
      }),
      Object.freeze({
        featureId: "PROPERTY_LEVEL_REF",
        code: "UNSUPPORTED_PROPERTY_ALIAS",
        pointer: "/style/$value/dashArray/0",
        tokenPath: "style",
      }),
    ]),
  }),
]);
const T02_RECOGNIZED_MALFORMED = Object.freeze([
  Object.freeze({
    id: "complex-border-line-cap",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/border/$value/style",
  }),
  Object.freeze({
    id: "typography-reference-type",
    cause: "ALIAS_TYPE_MISMATCH",
    causePointer: "/typography/$value/fontFamily",
  }),
  Object.freeze({
    id: "font-family-value",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/family/$value",
  }),
  Object.freeze({
    id: "font-weight-value",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/weight/$value",
  }),
  Object.freeze({
    id: "gradient-stop-value",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/gradient/$value/0",
  }),
  Object.freeze({
    id: "empty-gradient-value",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/gradient/$value",
  }),
  Object.freeze({
    id: "stroke-style-value",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/style/$value",
  }),
  Object.freeze({
    id: "empty-stroke-dash-array",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/style/$value",
  }),
  Object.freeze({
    id: "gradient-array-ref-wrong-shape",
    cause: "ALIAS_TYPE_MISMATCH",
    causePointer: "/gradient/$value/0/$ref",
  }),
  Object.freeze({
    id: "shadow-array-ref-wrong-shape",
    cause: "ALIAS_TYPE_MISMATCH",
    causePointer: "/shadow/$value/0/$ref",
  }),
]);
const RESOLVER_MALFORMED = Object.freeze([
  Object.freeze({
    id: "empty-resolver-resolution-order",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "",
  }),
  Object.freeze({
    id: "resolver-source-ref-space",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/sets/base/sources/0/$ref",
  }),
  Object.freeze({
    id: "resolver-source-ref-bad-percent",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/sets/base/sources/0/$ref",
  }),
  Object.freeze({
    id: "resolver-source-ref-non-pointer-fragment",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/sets/base/sources/0/$ref",
  }),
  Object.freeze({
    id: "resolver-sets-wrong-type",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "",
  }),
  Object.freeze({
    id: "resolver-modifiers-wrong-type",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "",
  }),
  Object.freeze({
    id: "resolver-modifier-single-context",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/modifiers/theme",
  }),
  Object.freeze({
    id: "nested-resolver-inline-source",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/sets/base/sources/0",
  }),
]);
const SHADOW_INSET_DISCLOSURES = Object.freeze([
  Object.freeze({
    featureId: "PROPERTY_LEVEL_REF",
    code: "UNSUPPORTED_PROPERTY_ALIAS",
    pointer: "/derived/$value/inset/$ref",
    tokenPath: "derived",
  }),
  Object.freeze({
    featureId: "SHADOW_INSET",
    code: "UNSUPPORTED_DTCG_MEMBER",
    pointer: "/base/$value/inset",
    tokenPath: "base",
  }),
  Object.freeze({
    featureId: "SHADOW_INSET",
    code: "UNSUPPORTED_DTCG_MEMBER",
    pointer: "/derived/$value/inset",
    tokenPath: "derived",
  }),
  Object.freeze({
    featureId: "SHADOW_INSET",
    code: "UNSUPPORTED_DTCG_MEMBER",
    pointer: "/layered/$value/0/inset",
    tokenPath: "layered",
  }),
]);
const SHADOW_MALFORMED = Object.freeze([
  Object.freeze({
    id: "shadow-inset-non-boolean",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/shadow/$value/inset",
  }),
  Object.freeze({
    id: "shadow-inset-ref-wrong-shape",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/shadow/$value/inset",
  }),
  Object.freeze({
    id: "empty-shadow-array",
    cause: "LIMIT_EXCEEDED",
    causePointer: "/shadow/$value",
  }),
]);

const BROWSER_TEST_TITLES = Object.freeze([
  "applies a color literal to live preview and supports undo and redo",
  "edits typography atomically and redirects a whole-token alias",
  "round-trips deterministic export and retains working data after invalid import",
  "shows the editable Neutral foundation and switches light and dark modes",
]);
const BROWSER_ASSERTIONS = Object.freeze([
  "visibleNeutralFoundation",
  "lightDarkModeSelection",
  "literalColorAuthoring",
  "exactColorAlpha",
  "livePreview",
  "atomicTypographyComposite",
  "unitAwareTypography",
  "wholeTokenAliasAuthoring",
  "tokenCreation",
  "structuredThemeModeAuthoring",
  "undoRedoInteraction",
  "deterministicExportReimport",
  "invalidImportRetention",
  "unsupportedModePreviewBlocked",
  "isolatedProofGraph",
]);

let built;
let graphObservation;
let proofDocumentTemplate;
const temporaryDirectories = [];

function passingBrowserObservation() {
  return {
    profile: "desen.m10a-t03.browser-proof.v1",
    result: "PASS",
    tests: BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    graphReceipts: ["theme-workbench"],
    assertions: Object.fromEntries(BROWSER_ASSERTIONS.map((name) => [name, true])),
  };
}

function expectProofError(code) {
  return (error) => error instanceof M10AT03ProofError && error.code === `M10A_T03_${code}`;
}

function exactProofDocument(artifactSha256) {
  const artifactMarker = /Final artifact: `sha256:[0-9a-f]{64}`/gu;
  assert.equal(proofDocumentTemplate.match(artifactMarker)?.length, 1);
  return Buffer.from(
    proofDocumentTemplate.replace(artifactMarker, `Final artifact: \`sha256:${artifactSha256}\``),
  );
}

const DONE_RECEIPT = Object.freeze({
  prNumber: "321",
  headSha: "1".repeat(40),
  pullRunId: "3001",
  pullQualityJobId: "4001",
  pullBrowserJobId: "4002",
  mergeSha: "2".repeat(40),
  freshRunId: "3002",
  freshQualityJobId: "4003",
  freshBrowserJobId: "4004",
});

function exactDoneProofDocument(artifactSha256, overrides = {}) {
  const receipt = { ...DONE_RECEIPT, ...overrides };
  const canonical = exactProofDocument(artifactSha256).toString("utf8").slice(0, -1).split("\n\n");
  const hostedClosureIndex = canonical.indexOf("## Hosted closure");
  const nonClaimsIndex = canonical.indexOf("## Non-claims");
  assert.ok(hostedClosureIndex > 0);
  assert.ok(
    nonClaimsIndex === hostedClosureIndex + 3 || nonClaimsIndex === hostedClosureIndex + 4,
    "proof template must contain either the pending or closed hosted-closure inventory",
  );
  const pullRunUrlId = receipt.pullRunUrlId ?? receipt.pullRunId;
  const freshRunUrlId = receipt.freshRunUrlId ?? receipt.freshRunId;
  const freshSha = receipt.freshSha ?? receipt.mergeSha;
  const doneStatus = [
    "**Status:** `DONE`. Exact-head pull-request checks, squash merge, and fresh-main checks pass. This",
    "report does not integrate the normal Desen App, start M10A-T04, or advance G10A.",
  ].join("\n");
  const verificationIndex = canonical.indexOf("## Verification");
  const doneVerification = [
    "- Authoring package build, typecheck, unit tests, and built public-package contract: pass.",
    "- Isolated workbench typecheck, build, graph isolation, and four Chromium journeys: pass. The",
    "  journeys cover exact sRGB alpha authoring, px/rem and numeric/named-weight typography, literal and alias",
    "  creation, structured theme/mode duplicate-and-rename operations, and fail-closed unsupported-mode",
    "  preview with no partial preview authority.",
    "- Root deterministic, mutation, report-drift, and atomic-writer evidence: pass with the final",
    "  repository proof-reader seal.",
    "- Dependency boundaries and exhaustive repository checks: pass.",
    "- Exact-head pull-request and fresh-main Quality gate and Browser E2E checks: pass; exact receipts",
    "  are recorded below.",
  ].join("\n");
  const beforeHosted = [...canonical.slice(0, hostedClosureIndex)];
  beforeHosted[2] = doneStatus;
  beforeHosted[verificationIndex + 1] = doneVerification;
  return Buffer.from(
    `${[
      ...beforeHosted,
      "## Hosted closure",
      [
        `[PR #${receipt.prNumber}](https://github.com/desenlab/desen-app/pull/${receipt.prUrlNumber ?? receipt.prNumber}) at exact head`,
        `\`${receipt.headSha}\` passed`,
        `[run ${receipt.pullRunId}](https://github.com/desenlab/desen-app/actions/runs/${pullRunUrlId}):`,
        `[Quality gate job ${receipt.pullQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullQualityJobId}) and`,
        `[Browser E2E job ${receipt.pullBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullBrowserJobId})`,
        "both completed successfully. The pull request was squash-merged as",
        `[\`${receipt.mergeSha}\`](https://github.com/desenlab/desen-app/commit/${receipt.mergeUrlSha ?? receipt.mergeSha}).`,
      ].join("\n"),
      [
        "The resulting fresh",
        `[\`main\` run ${receipt.freshRunId}](https://github.com/desenlab/desen-app/actions/runs/${freshRunUrlId}) passed at exact merge SHA`,
        `\`${freshSha}\`:`,
        `[Quality gate job ${receipt.freshQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshQualityJobId}) and`,
        `[Browser E2E job ${receipt.freshBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshBrowserJobId})`,
        "both completed successfully.",
      ].join("\n"),
      "M10A-T04 is ready but remains `NOT_STARTED`.",
      ...canonical.slice(nonClaimsIndex),
    ].join("\n\n")}\n`,
  );
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function runtimeWithLimit(limitName, value) {
  return {
    ...authoring,
    THEME_AUTHORING_LIMITS: Object.freeze({
      ...authoring.THEME_AUTHORING_LIMITS,
      [limitName]: value,
    }),
  };
}

before(async () => {
  const [graphBytes, proofDocument] = await Promise.all([
    readFile(path.join(WORKSPACE_ROOT, GRAPH_RECEIPT)),
    readFile(path.join(WORKSPACE_ROOT, PROOF_DOCUMENT), "utf8"),
  ]);
  graphObservation = JSON.parse(graphBytes.toString("utf8"));
  proofDocumentTemplate = proofDocument;
  built = await buildM10AT03Evidence({
    browserObservation: passingBrowserObservation(),
    graphObservation,
  });
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(M10A_T03_ROOT_TEST_NAMES[0], async () => {
  const second = await buildM10AT03Evidence({
    browserObservation: passingBrowserObservation(),
    graphObservation,
  });
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.task, "M10A-T03");
  assert.equal(built.artifact.proofId, "m10a-t03");
  assert.equal(built.artifact.profile, "desen.theme-token-authoring.proof.v1");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.publicPackage.name, "@desen/design-system-authoring");
  assert.equal(built.artifact.publicPackage.exercisedBuiltPublicRoot, true);
  assert.equal(built.artifact.workbench.name, "@desen/design-system-workbench-proof");
  assert.equal(built.artifact.workbench.exactBrowserCases, 4);
  assert.equal(built.artifact.workbench.exactBrowserAssertions, 15);
  assert.deepEqual(built.artifact.workbench.browserJourneyCoverage, {
    exactSrgbAlphaAuthoring: true,
    browserObservedActionColorCss: {
      before: "color(srgb 0.0901961 0.0901961 0.0901961)",
      after: "color(srgb 0.427451 0.156863 0.85098 / 0.42)",
    },
    pxAndRemTypography: true,
    numericAndNamedFontWeights: true,
    browserObservedNamedFontWeightCss: { name: "semi-bold", computed: 600 },
    undoRedoInteraction: true,
    literalAndAliasCreation: true,
    structuredThemeModeDuplicateRename: true,
    unsupportedSelectedModePreviewBlocked: true,
    partialPreviewAuthority: false,
    visibleFocusOutlinePx: 2,
  });
  assert.equal(built.artifact.workbench.graphModuleCount, 24);
  assert.equal(built.artifactBytes.byteLength, EXPECTED_ARTIFACT_BYTES);
  assert.equal(built.artifactSha256, EXPECTED_ARTIFACT_SHA256);
  assert.ok(
    built.artifact.nonClaims.includes(
      "All 16 historical SC-01 fixtures are preserved without silent loss. The three complete documents now fully supported by T02 are preview-ready and emit no false disclosure; the 13 documents with a remaining unsupported member are disclosed, inert, and preview-blocked without partial or production authority.",
    ),
  );
  assert.ok(Object.isFrozen(built.artifact));
});

test(M10A_T03_ROOT_TEST_NAMES[1], () => {
  const { limits, neutral, editing } = built.artifact.authoring;
  assert.deepEqual(limits, {
    maxHistoryEntries: 100,
    maxIdentifierCodeUnits: 128,
    maxImportBytes: 8_388_608,
    maxLabelCodeUnits: 512,
    maxModesPerTheme: 16,
    maxThemes: 16,
    maxUnsupportedFeaturesPerOverlay: 64,
  });
  assert.equal(neutral.id, "desen-neutral");
  assert.deepEqual(neutral.modes, [
    { id: "light", name: "Light", sourceId: "neutral.light" },
    { id: "dark", name: "Dark", sourceId: "neutral.dark" },
  ]);
  assert.equal(neutral.canonicalBytes, 5_710);
  assert.equal(neutral.tokenCount, 45);
  assert.equal(neutral.tokenPaths.length, 45);
  assert.deepEqual(neutral.defaultSelection, { modeId: "light", themeId: "desen-neutral" });
  assert.deepEqual(neutral.lightSourceIds, ["neutral.base", "neutral.light"]);
  assert.deepEqual(neutral.darkSourceIds, ["neutral.base", "neutral.dark"]);
  assert.notDeepEqual(neutral.lightCanvas, neutral.darkCanvas);
  assert.equal(neutral.recursivelyImmutable, true);
  assert.equal(neutral.accessibility.everyModePassed, true);
  assert.equal(neutral.accessibility.browserVisibleFocusOutlinePx, 2);
  assert.deepEqual(
    neutral.accessibility.modes.map(({ modeId }) => modeId),
    ["light", "dark"],
  );
  for (const mode of neutral.accessibility.modes) {
    assert.equal(mode.passed, true);
    assert.deepEqual(mode.thresholds, {
      foregroundCanvas: 7,
      mutedSurface: 4.5,
      actionOnAction: 7,
      focusCanvas: 3,
    });
    assert.ok(mode.contrast.foregroundCanvas >= mode.thresholds.foregroundCanvas);
    assert.ok(mode.contrast.mutedSurface >= mode.thresholds.mutedSurface);
    assert.ok(mode.contrast.actionOnAction >= mode.thresholds.actionOnAction);
    assert.ok(mode.contrast.focusCanvas >= mode.thresholds.focusCanvas);
    assert.deepEqual(mode.stroke, {
      default: { unit: "px", value: 1 },
      focus: { unit: "px", value: 2 },
    });
  }
  assert.deepEqual(editing.arbitraryColor, {
    alpha: 0.75,
    colorSpace: "srgb",
    components: [0.125, 0.625, 0.875],
  });
  assert.equal(editing.aliasAwareLivePreview, true);
});

test(M10A_T03_ROOT_TEST_NAMES[2], () => {
  const editing = built.artifact.authoring.editing;
  assert.deepEqual(editing.compositeTypography, {
    fontFamily: ["Avenir Next", "ui-sans-serif"],
    fontSize: { unit: "px", value: 19 },
    fontWeight: 575,
    letterSpacing: { unit: "px", value: 0.25 },
    lineHeight: 1.45,
  });
  assert.equal(editing.wholeTokenAliasTarget, "palette.focus");
  assert.equal(editing.revisionAfterEdits, 5);
  assert.equal(editing.undoRestoresExactDocument, true);
  assert.equal(editing.redoRestoresExactDocument, true);
  assert.equal(editing.historyLimit, 100);
  assert.deepEqual(editing.structuredAuthoring, {
    createdLiteralPath: "palette.brand",
    createdAliasPath: "color.brand",
    deletedTokenPath: "color.brand",
    duplicatedModeSelection: { modeId: "contrast", themeId: "desen-neutral" },
    modeUndoSelection: { modeId: "light", themeId: "desen-neutral" },
    modeRedoSelection: { modeId: "contrast", themeId: "desen-neutral" },
    renamedMode: "Accessible contrast",
    modeDeleteSelection: { modeId: "light", themeId: "desen-neutral" },
    duplicatedThemeSelection: { modeId: "light", themeId: "brand" },
    themeUndoSelection: { modeId: "light", themeId: "desen-neutral" },
    themeRedoSelection: { modeId: "light", themeId: "brand" },
    renamedTheme: "Brand foundations",
    themeDeleteSelection: { modeId: "light", themeId: "brand" },
    modeUndoRestoresExactDocument: true,
    modeRedoRestoresExactDocument: true,
    themeUndoRestoresExactDocument: true,
    themeRedoRestoresExactDocument: true,
    finalRevision: 13,
  });
});

test(M10A_T03_ROOT_TEST_NAMES[3], () => {
  const transfer = built.artifact.authoring.transfer;
  assert.equal(transfer.canonicalBytes, 5_747);
  assert.equal(
    transfer.canonicalSha256,
    "e962ddaf354c290a4ec107a1e2c155e4450fc8dbdd4335179f58b0cbd7330903",
  );
  assert.equal(transfer.canonicalTerminalNewline, false);
  assert.equal(transfer.deterministicReimport, true);
  assert.equal(transfer.losses, 0);
  assert.deepEqual(transfer.reviewedUnsupportedMatrix.representativeModeOverlay, {
    wideGamutColor: {
      classification: "UNSUPPORTED_DTCG_FEATURE",
      code: "UNSUPPORTED_COLOR_SPACE",
      preserved: true,
      partialPreviewAuthority: false,
    },
    wideGamutNoneColor: {
      preservedFeatureCodes: [
        "UNSUPPORTED_COLOR_SPACE",
        "UNSUPPORTED_DTCG_MEMBER",
        "UNSUPPORTED_DTCG_MEMBER",
      ],
      preservedFeaturePointers: [
        "/wideWithNone/$value/colorSpace",
        "/wideWithNone/$value/components/0",
        "/wideWithNone/$value/components/2",
      ],
      exactReimport: true,
      partialPreviewAuthority: false,
    },
    officialRoot: {
      preservedFeatureCode: "UNSUPPORTED_DTCG_MEMBER",
      pointer: "/futureGroup/$root",
      tokenPath: "futureGroup.$root",
      aliasTarget: "futureGroup.$root",
      exactReimport: true,
      partialPreviewAuthority: false,
    },
  });
  const sc01Matrix = transfer.reviewedUnsupportedMatrix.frozenSc01;
  assert.equal(sc01Matrix.featureFamilies, 14);
  assert.equal(sc01Matrix.validFixtures, 16);
  assert.equal(sc01Matrix.historicalFeaturesSupportedByT02, 7);
  assert.equal(sc01Matrix.historicalFeaturesStillUnsupported, 9);
  assert.equal(sc01Matrix.previewReadyUnderT02, 3);
  assert.equal(sc01Matrix.preservedUnsupported, 13);
  assert.equal(sc01Matrix.invalidFixtures, 7);
  assert.equal(sc01Matrix.fixtures.length, 16);
  assert.equal(sc01Matrix.invalid.length, 7);
  assert.equal(sc01Matrix.everyFixtureSurvivedSupportedEditUndoRedoAndReimport, true);
  assert.equal(sc01Matrix.everyUnsupportedRemainderDisclosed, true);
  assert.equal(sc01Matrix.everyInvalidAndMaskingImportRetainedExactSession, true);
  assert.deepEqual(
    sc01Matrix.fixtures
      .filter(({ historicalFeatureStatus }) => historicalFeatureStatus === "SUPPORTED_BY_T02")
      .map(({ id }) => id),
    SC01_HISTORICAL_FEATURES_SUPPORTED_BY_T02,
  );
  assert.deepEqual(
    sc01Matrix.fixtures
      .filter(({ currentAuthoringStatus }) => currentAuthoringStatus === "T02_PREVIEW_READY")
      .map(({ id }) => id),
    SC01_PREVIEW_READY_UNDER_T02,
  );
  assert.deepEqual(
    sc01Matrix.fixtures
      .filter(({ currentAuthoringStatus }) => currentAuthoringStatus === "PRESERVED_UNSUPPORTED")
      .map(({ id }) => id),
    SC01_PRESERVED_UNSUPPORTED,
  );
  assert.deepEqual(
    sc01Matrix.fixtures.map(({ id, disclosures }) => [
      id,
      disclosures.map(({ featureId, code, pointer, tokenPath }) => [
        featureId,
        code,
        pointer,
        tokenPath,
      ]),
    ]),
    SC01_EXACT_DISCLOSURES,
  );
  for (const fixture of sc01Matrix.fixtures) {
    assert.equal(fixture.supportedSiblingEdit, true);
    assert.equal(fixture.undoRestoredExactDocumentAndSelection, true);
    assert.equal(fixture.redoRestoredExactDocumentAndSelection, true);
    assert.equal(fixture.exactSubtreeAfterEditUndoRedo, true);
    assert.equal(fixture.exactSubtreeAfterExportReimport, true);
    assert.equal(fixture.exactExportReimport, true);
    assert.equal(fixture.losses, 0);
    assert.equal(fixture.partialPreviewAuthority, false);
    assert.equal(fixture.invalidMaskingRejectedAtomically, true);
    if (fixture.currentAuthoringStatus === "T02_PREVIEW_READY") {
      assert.equal(fixture.previewStatus, "READY");
      assert.deepEqual(fixture.disclosures, []);
    } else {
      assert.equal(fixture.currentAuthoringStatus, "PRESERVED_UNSUPPORTED");
      assert.equal(fixture.previewStatus, "BLOCKED");
      assert.ok(fixture.disclosures.length > 0);
    }
  }
  for (const fixture of sc01Matrix.invalid) {
    assert.equal(fixture.code, "DTCG_REJECTED");
    assert.equal(fixture.retainedExactSession, true);
    assert.equal(fixture.partialResult, false);
  }
  assert.deepEqual(
    sc01Matrix.invalid.map(({ id, cause, causePointer }) => [id, cause, causePointer]),
    SC01_EXACT_INVALID_DIAGNOSTICS,
  );
  const t02Matrix = transfer.reviewedUnsupportedMatrix.t02RecognizedUnsupported;
  assert.equal(t02Matrix.validFixtures, 6);
  assert.equal(t02Matrix.malformedFixtures, 10);
  assert.equal(t02Matrix.fixtures.length, 6);
  assert.equal(t02Matrix.malformed.length, 10);
  assert.equal(t02Matrix.everyFixtureSurvivedSupportedEditUndoRedoAndReimport, true);
  assert.equal(t02Matrix.everyFeatureWasDisclosedAndPreviewBlocked, true);
  assert.equal(t02Matrix.everyMalformedAndMaskingImportRetainedExactSession, true);
  assert.deepEqual(
    t02Matrix.fixtures.map(({ id, disclosures }) => ({
      id,
      disclosures: disclosures.map(({ featureId, code, pointer, tokenPath }) => ({
        featureId,
        code,
        pointer,
        tokenPath,
      })),
    })),
    T02_RECOGNIZED_UNSUPPORTED,
  );
  for (const fixture of t02Matrix.fixtures) {
    assert.equal(fixture.currentAuthoringStatus, "PRESERVED_UNSUPPORTED");
    assert.equal(fixture.previewStatus, "BLOCKED");
    assert.equal(fixture.supportedSiblingEdit, true);
    assert.equal(fixture.undoRestoredExactDocumentAndSelection, true);
    assert.equal(fixture.redoRestoredExactDocumentAndSelection, true);
    assert.equal(fixture.exactSubtreeAfterEditUndoRedo, true);
    assert.equal(fixture.exactSubtreeAfterExportReimport, true);
    assert.equal(fixture.exactExportReimport, true);
    assert.equal(fixture.losses, 0);
    assert.equal(fixture.partialPreviewAuthority, false);
    assert.equal(fixture.invalidMaskingRejectedAtomically, true);
  }
  assert.deepEqual(
    t02Matrix.malformed.map(({ id, cause, causePointer }) => ({ id, cause, causePointer })),
    T02_RECOGNIZED_MALFORMED,
  );
  for (const fixture of t02Matrix.malformed) {
    assert.equal(fixture.code, "DTCG_REJECTED");
    assert.equal(fixture.retainedExactSession, true);
    assert.equal(fixture.partialResult, false);
  }
  const resolverMalformed = transfer.reviewedUnsupportedMatrix.resolverMalformed;
  assert.equal(resolverMalformed.malformedFixtures, 8);
  assert.equal(resolverMalformed.malformed.length, 8);
  assert.equal(resolverMalformed.everyImportRetainedExactSession, true);
  assert.deepEqual(
    resolverMalformed.malformed.map(({ id, cause, causePointer }) => ({
      id,
      cause,
      causePointer,
    })),
    RESOLVER_MALFORMED,
  );
  for (const fixture of resolverMalformed.malformed) {
    assert.equal(fixture.code, "DTCG_REJECTED");
    assert.equal(fixture.retainedExactSession, true);
    assert.equal(fixture.partialResult, false);
  }
  const shadowInset = transfer.reviewedUnsupportedMatrix.shadowInset;
  assert.equal(shadowInset.validFixtures, 1);
  assert.equal(shadowInset.malformedFixtures, 3);
  assert.equal(shadowInset.survivedSupportedEditUndoRedoAndReimport, true);
  assert.equal(shadowInset.everyMalformedImportRetainedExactSession, true);
  assert.equal(shadowInset.fixture.id, "shadow-inset-preservation");
  assert.equal(shadowInset.fixture.previewStatus, "BLOCKED");
  assert.equal(shadowInset.fixture.exactSubtreeAfterEditUndoRedo, true);
  assert.equal(shadowInset.fixture.exactSubtreeAfterExportReimport, true);
  assert.equal(shadowInset.fixture.losses, 0);
  assert.deepEqual(
    shadowInset.fixture.disclosures.map(({ featureId, code, pointer, tokenPath }) => ({
      featureId,
      code,
      pointer,
      tokenPath,
    })),
    SHADOW_INSET_DISCLOSURES,
  );
  assert.deepEqual(
    shadowInset.malformed.map(({ id, cause, causePointer }) => ({ id, cause, causePointer })),
    SHADOW_MALFORMED,
  );
  for (const fixture of shadowInset.malformed) {
    assert.equal(fixture.code, "DTCG_REJECTED");
    assert.equal(fixture.retainedExactSession, true);
    assert.equal(fixture.partialResult, false);
  }
  const prototypeSafe = transfer.reviewedUnsupportedMatrix.prototypeSafeGroupInheritance;
  assert.equal(prototypeSafe.id, "prototype-safe-group-extends");
  assert.deepEqual(
    prototypeSafe.disclosures.map(({ featureId, code, pointer, tokenPath }) => ({
      featureId,
      code,
      pointer,
      tokenPath,
    })),
    [
      {
        featureId: "GROUP_EXTENDS",
        code: "UNSUPPORTED_DTCG_MEMBER",
        pointer: "/derived/$extends",
        tokenPath: "derived",
      },
    ],
  );
  assert.equal(prototypeSafe.previewStatus, "BLOCKED");
  assert.equal(prototypeSafe.ownPrototypeTokenKey, "__proto__");
  assert.equal(prototypeSafe.ownTokenPreserved, true);
  assert.equal(prototypeSafe.ordinaryObjectPrototypeUnchanged, true);
  assert.equal(prototypeSafe.admissionDidNotThrow, true);
  assert.equal(prototypeSafe.exactSubtreeAfterEditUndoRedo, true);
  assert.equal(prototypeSafe.exactSubtreeAfterExportReimport, true);
  assert.deepEqual(transfer.invalidMatrix, [
    { id: "malformed-json", code: "IMPORT_JSON_INVALID", retainedExactSession: true },
    { id: "duplicate-key-json", code: "IMPORT_JSON_INVALID", retainedExactSession: true },
    {
      id: "missing-alias-import",
      code: "DTCG_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      retainedExactSession: true,
    },
    {
      id: "missing-alias-edit",
      code: "TOKEN_EDIT_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      retainedExactSession: true,
    },
    {
      id: "hidden-mode-missing-alias-edit",
      code: "TOKEN_EDIT_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      retainedExactSession: true,
      allModesChecked: true,
    },
    {
      id: "unsafe-accessor",
      code: "UNSAFE_THEME_VALUE",
      getterInvoked: false,
      partialResult: false,
    },
    {
      id: "unsupported-does-not-mask-invalid",
      code: "DTCG_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      partialResult: false,
      unsupportedMaskedInvalid: false,
    },
  ]);
});

test(M10A_T03_ROOT_TEST_NAMES[4], () => {
  const { t02, sc01, protocol, runtimeCore } = built.artifact.frozenAuthorities;
  assert.deepEqual(t02.artifact, {
    path: T02_ARTIFACT,
    bytes: 11_513,
    sha256: "135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2",
  });
  assert.equal(t02.publicRuntimeExports.length, 12);
  assert.equal(t02.authorityFiles, 23);
  assert.equal(t02.unchanged, true);
  assert.deepEqual(sc01.artifact, {
    path: SC01_DTCG_ARTIFACT,
    bytes: 31_286,
    sha256: "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
  });
  assert.equal(sc01.classification, "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE");
  assert.equal(sc01.featureFamilies.length, 14);
  assert.equal(sc01.validButUnsupportedFixtures.length, 16);
  assert.equal(sc01.invalidFixtures.length, 7);
  assert.equal(sc01.unchanged, true);
  assert.equal(protocol.protocol, "0.1.0");
  assert.equal(
    protocol.aggregateSha256,
    "afe8fc359465ce891f4325fcdeca4b2f12bca48f1aa54a34c4f3a97985f7e060",
  );
  assert.equal(protocol.unchanged, true);
  assert.deepEqual(runtimeCore.artifact, {
    path: RUNTIME_CORE_ARTIFACT,
    bytes: 271,
    sha256: "fbda58d72ccff36d530368422dd7fd82c73dcca359c29e3a6667e8ae4b9b424b",
  });
  assert.equal(runtimeCore.tree, "3fa3613a3be63c749f40b6a0b55af5b40c675773");
  assert.equal(runtimeCore.clean, true);
  assert.equal(runtimeCore.unchanged, true);
});

test(M10A_T03_ROOT_TEST_NAMES[5], async () => {
  assert.deepEqual(built.artifact.publicPackage.requiredRuntimeExports, [
    "DESEN_NEUTRAL_THEME_DOCUMENT",
    "THEME_AUTHORING_KIND",
    "THEME_AUTHORING_LIMITS",
    "THEME_AUTHORING_SCHEMA_VERSION",
    "admitThemeAuthoringDocument",
    "applyThemeAuthoringEdit",
    "createThemeAuthoringSession",
    "exportThemeAuthoringDocument",
    "importThemeAuthoringDocument",
    "redoThemeAuthoringEdit",
    "selectThemeAuthoringMode",
    "undoThemeAuthoringEdit",
  ]);

  const missingRuntimeExport = { ...authoring };
  delete missingRuntimeExport.redoThemeAuthoringEdit;
  await assert.rejects(
    buildM10AT03Evidence({
      runtime: missingRuntimeExport,
      browserObservation: passingBrowserObservation(),
      graphObservation,
    }),
    expectProofError("PUBLIC_API_DRIFT"),
  );
  await assert.rejects(
    buildM10AT03Evidence({
      runtime: { ...authoring, unreviewedExport: true },
      browserObservation: passingBrowserObservation(),
      graphObservation,
    }),
    expectProofError("PUBLIC_API_DRIFT"),
  );
  await assert.rejects(
    buildM10AT03Evidence({
      runtime: {
        ...authoring,
        applyThemeAuthoringEdit(session) {
          return Object.freeze({ diagnostics: Object.freeze([]), ok: false, session });
        },
      },
      browserObservation: passingBrowserObservation(),
      graphObservation,
    }),
    expectProofError("BEHAVIOR_DRIFT"),
  );
  for (const limitName of Object.keys(authoring.THEME_AUTHORING_LIMITS)) {
    await assert.rejects(
      buildM10AT03Evidence({
        runtime: runtimeWithLimit(limitName, Infinity),
        browserObservation: passingBrowserObservation(),
        graphObservation,
      }),
      expectProofError("PUBLIC_API_DRIFT"),
    );
  }
  for (const invalidLimit of [Number.NaN, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    await assert.rejects(
      buildM10AT03Evidence({
        runtime: runtimeWithLimit("maxHistoryEntries", invalidLimit),
        browserObservation: passingBrowserObservation(),
        graphObservation,
      }),
      expectProofError("PUBLIC_API_DRIFT"),
    );
  }

  const authoringManifest = JSON.parse(
    await readFile(path.join(WORKSPACE_ROOT, AUTHORING_MANIFEST), "utf8"),
  );
  authoringManifest.dependencies["@desen/runtime-core"] = "workspace:*";
  await assert.rejects(
    buildM10AT03Evidence({
      fileOverrides: new Map([
        [AUTHORING_MANIFEST, Buffer.from(`${JSON.stringify(authoringManifest)}\n`)],
      ]),
      browserObservation: passingBrowserObservation(),
      graphObservation,
    }),
    expectProofError("PACKAGE_DRIFT"),
  );

  const workbenchManifest = JSON.parse(
    await readFile(path.join(WORKSPACE_ROOT, WORKBENCH_MANIFEST), "utf8"),
  );
  workbenchManifest.dependencies["@desen/runtime-react"] = "workspace:*";
  await assert.rejects(
    buildM10AT03Evidence({
      fileOverrides: new Map([
        [WORKBENCH_MANIFEST, Buffer.from(`${JSON.stringify(workbenchManifest)}\n`)],
      ]),
      browserObservation: passingBrowserObservation(),
      graphObservation,
    }),
    expectProofError("PACKAGE_DRIFT"),
  );

  const failedBrowser = passingBrowserObservation();
  failedBrowser.tests[0].result = "FAIL";
  await assert.rejects(
    buildM10AT03Evidence({ browserObservation: failedBrowser, graphObservation }),
    expectProofError("BROWSER_OBSERVATION_INVALID"),
  );
  const widenedBrowser = passingBrowserObservation();
  widenedBrowser.tests.push({ title: "unreviewed case", result: "PASS" });
  await assert.rejects(
    buildM10AT03Evidence({ browserObservation: widenedBrowser, graphObservation }),
    expectProofError("BROWSER_OBSERVATION_INVALID"),
  );
  let observationGetterInvocations = 0;
  const executableBrowser = passingBrowserObservation();
  Object.defineProperty(executableBrowser, "result", {
    enumerable: true,
    get() {
      observationGetterInvocations += 1;
      return "PASS";
    },
  });
  await assert.rejects(
    buildM10AT03Evidence({ browserObservation: executableBrowser, graphObservation }),
    expectProofError("BROWSER_OBSERVATION_INVALID"),
  );
  assert.equal(observationGetterInvocations, 0);
  const widenedGraph = structuredClone(graphObservation);
  widenedGraph.assertions.forbiddenAuthorities.runtime = true;
  widenedGraph.modules.push("packages/runtime-web/dist/index.js");
  widenedGraph.modules.sort();
  await assert.rejects(
    buildM10AT03Evidence({
      browserObservation: passingBrowserObservation(),
      graphObservation: widenedGraph,
    }),
    expectProofError("GRAPH_OBSERVATION_INVALID"),
  );
  const proxiedGraph = structuredClone(graphObservation);
  proxiedGraph.modules = new Proxy(proxiedGraph.modules, {});
  await assert.rejects(
    buildM10AT03Evidence({
      browserObservation: passingBrowserObservation(),
      graphObservation: proxiedGraph,
    }),
    expectProofError("GRAPH_OBSERVATION_INVALID"),
  );

  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  await assert.rejects(
    verifyM10AT03Evidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes,
      browserObservation: passingBrowserObservation(),
      graphObservation,
      fileOverrides: new Map([
        [AUTHORING_INDEX, changedByte(await readFile(path.join(WORKSPACE_ROOT, AUTHORING_INDEX)))],
      ]),
    }),
    expectProofError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    buildM10AT03Evidence({
      browserObservation: passingBrowserObservation(),
      graphObservation,
      fileOverrides: new Map([
        [T02_ARTIFACT, changedByte(await readFile(path.join(WORKSPACE_ROOT, T02_ARTIFACT)))],
      ]),
    }),
    expectProofError("T02_DRIFT"),
  );
  await assert.rejects(
    buildM10AT03Evidence({
      browserObservation: passingBrowserObservation(),
      graphObservation,
      fileOverrides: new Map([
        [
          SC01_DTCG_ARTIFACT,
          changedByte(await readFile(path.join(WORKSPACE_ROOT, SC01_DTCG_ARTIFACT))),
        ],
      ]),
    }),
    expectProofError("SC01_DRIFT"),
  );
  await assert.rejects(
    buildM10AT03Evidence({
      browserObservation: passingBrowserObservation(),
      graphObservation,
      fileOverrides: new Map([
        [
          RUNTIME_CORE_ARTIFACT,
          changedByte(await readFile(path.join(WORKSPACE_ROOT, RUNTIME_CORE_ARTIFACT))),
        ],
      ]),
    }),
    expectProofError("RUNTIME_CORE_DRIFT"),
  );

  let getterInvocations = 0;
  const unsafeOptions = Object.defineProperty({}, "runtime", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return authoring;
    },
  });
  await assert.rejects(buildM10AT03Evidence(unsafeOptions), expectProofError("OPTIONS_INVALID"));
  assert.equal(getterInvocations, 0);
  await assert.rejects(
    buildM10AT03Evidence(new Proxy({}, {})),
    expectProofError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildM10AT03Evidence({
      coreRuntime: { ...designSystemCore, unexpected: true },
      browserObservation: passingBrowserObservation(),
      graphObservation,
    }),
    expectProofError("PUBLIC_API_DRIFT"),
  );
});

test(M10A_T03_ROOT_TEST_NAMES[6], async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const verified = await verifyM10AT03Evidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
    browserObservation: passingBrowserObservation(),
    graphObservation,
  });
  assert.equal(verified.status, "PASS");
  assert.equal(verified.checkpointHeadSha256, "TEST_OVERRIDE");
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.equal(verified.externalNetwork, false);
  assert.equal(
    verified.sc01ArtifactSha256,
    "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
  );
  assert.equal(verified.sc01ValidFixtures, 16);
  assert.equal(verified.sc01PreviewReadyUnderT02, 3);
  assert.equal(verified.sc01PreservedUnsupported, 13);
  assert.equal(verified.t02RecognizedUnsupportedFixtures, 6);
  assert.equal(verified.t02RecognizedMalformedFixtures, 10);

  const doneProofDocumentBytes = exactDoneProofDocument(built.artifactSha256);
  const doneVerified = await verifyM10AT03Evidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes: doneProofDocumentBytes,
    browserObservation: passingBrowserObservation(),
    graphObservation,
  });
  assert.equal(doneVerified.status, "PASS");

  for (const driftedProof of [
    Buffer.concat([proofDocumentBytes, Buffer.from("\nContradictory closure claim.\n")]),
    Buffer.from(
      proofDocumentBytes
        .toString("utf8")
        .replace(
          "all 16 exact\nhistorical valid-but-unsupported fixtures are retained",
          "only some historical valid-but-unsupported fixtures are retained",
        ),
    ),
    exactDoneProofDocument(built.artifactSha256, { freshSha: "3".repeat(40) }),
    exactDoneProofDocument(built.artifactSha256, { pullRunUrlId: "9999" }),
    Buffer.from("# substituted\n"),
  ]) {
    await assert.rejects(
      verifyM10AT03Evidence({
        artifactBytes: built.artifactBytes,
        proofDocumentBytes: driftedProof,
        browserObservation: passingBrowserObservation(),
        graphObservation,
      }),
      expectProofError("REPORT_DRIFT"),
    );
  }
  await assert.rejects(
    verifyM10AT03Evidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
      browserObservation: passingBrowserObservation(),
      graphObservation,
    }),
    expectProofError("ARTIFACT_DRIFT"),
  );
});

test(M10A_T03_ROOT_TEST_NAMES[7], async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t03-proof-"));
  temporaryDirectories.push(directory);
  const artifactPath = path.join(directory, "artifact.json");
  const observations = {
    browserObservation: passingBrowserObservation(),
    graphObservation,
  };
  const first = await writeM10AT03Evidence({ artifactPath, ...observations });
  assert.equal(first.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  await assert.rejects(
    writeM10AT03Evidence({
      artifactPath,
      ...observations,
      beforeAtomicRename() {
        throw new Error("injected failure");
      },
    }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const symlinkPath = path.join(directory, "symlink.json");
  await symlink(artifactPath, symlinkPath);
  await assert.rejects(
    writeM10AT03Evidence({ artifactPath: symlinkPath, ...observations }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );

  const linkedSource = path.join(directory, "linked-source.json");
  const hardlinkPath = path.join(directory, "hardlink.json");
  await writeFile(linkedSource, "existing\n");
  await link(linkedSource, hardlinkPath);
  await assert.rejects(
    writeM10AT03Evidence({ artifactPath: hardlinkPath, ...observations }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );

  const directoryPath = path.join(directory, "directory.json");
  await mkdir(directoryPath);
  await assert.rejects(
    writeM10AT03Evidence({ artifactPath: directoryPath, ...observations }),
    expectProofError("ARTIFACT_WRITE_UNSAFE"),
  );
});
