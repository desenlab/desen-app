import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import { format } from "prettier";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";
import {
  RUNTIME_CORE_BASELINE_ARTIFACT_PATH,
  RUNTIME_CORE_BASELINE_CAPTURE,
  parseRuntimeCoreBaselineBytes,
  verifyRuntimeCoreBaseline,
} from "./runtime-core-baseline-proof.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t03.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/M10A-T03.md";
const T02_ARTIFACT_PATH = "docs/proof/artifacts/m10a-t02.json";
const SC01_DTCG_ARTIFACT_PATH = "docs/proof/artifacts/sc-01-dtcg-compatibility.json";
const PROTOCOL_SNAPSHOT_PATH = "packages/protocol/upstream/0.1.0/snapshot";
const AUTHORING_ROOT = "packages/design-system-authoring";
const AUTHORING_MANIFEST_PATH = `${AUTHORING_ROOT}/package.json`;
const WORKBENCH_ROOT = "apps/design-system-workbench-proof";
const WORKBENCH_MANIFEST_PATH = `${WORKBENCH_ROOT}/package.json`;
const WORKBENCH_GRAPH_PATH = `${WORKBENCH_ROOT}/dist/workbench-graph-proof.json`;
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_BROWSER_REPORT_BYTES = 256 * 1_024;
const MAX_BROWSER_OUTPUT_BYTES = 256 * 1_024;
const MAX_GRAPH_MODULES = 4_096;
const BROWSER_TIMEOUT_MS = 180_000;
const BROWSER_TERMINATION_GRACE_MS = 2_000;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const T02_ARTIFACT_PIN = Object.freeze({
  path: T02_ARTIFACT_PATH,
  bytes: 11_513,
  sha256: "135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2",
});

const SC01_DTCG_ARTIFACT_PIN = Object.freeze({
  path: SC01_DTCG_ARTIFACT_PATH,
  bytes: 31_286,
  sha256: "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
});

const SC01_VALID_UNSUPPORTED_FIXTURES = Object.freeze([
  Object.freeze({ id: "root-token-curly-alias", featureId: "ROOT_TOKEN_CURLY_ALIAS" }),
  Object.freeze({ id: "alias-infers-target-type", featureId: "ALIAS_TARGET_TYPE_INFERENCE" }),
  Object.freeze({ id: "whole-token-json-pointer", featureId: "JSON_POINTER_REF" }),
  Object.freeze({ id: "color-component-json-pointer", featureId: "PROPERTY_LEVEL_REF" }),
  Object.freeze({ id: "group-root-token", featureId: "ROOT_GROUP_TOKEN" }),
  Object.freeze({ id: "group-extends", featureId: "GROUP_EXTENDS" }),
  Object.freeze({ id: "empty-described-group", featureId: "EMPTY_GROUP" }),
  Object.freeze({ id: "token-vendor-extension", featureId: "EXTENSIONS" }),
  Object.freeze({ id: "deprecated-token", featureId: "DEPRECATED" }),
  Object.freeze({ id: "number-token", featureId: "ADDITIONAL_TOKEN_TYPES" }),
  Object.freeze({ id: "typography-token", featureId: "ADDITIONAL_TOKEN_TYPES" }),
  Object.freeze({ id: "display-p3-color", featureId: "ADDITIONAL_COLOR_SPACES" }),
  Object.freeze({ id: "oklch-color", featureId: "ADDITIONAL_COLOR_SPACES" }),
  Object.freeze({ id: "srgb-none-component", featureId: "NONE_COLOR_COMPONENTS" }),
  Object.freeze({
    id: "color-without-local-alpha-and-hex",
    featureId: "OPTIONAL_COLOR_ALPHA_AND_HEX",
  }),
  Object.freeze({ id: "resolver-theme-modifier", featureId: "RESOLVER_THEMES_AND_MODES" }),
]);

const SC01_INVALID_FIXTURE_IDS = Object.freeze([
  "name-containing-dot",
  "malformed-dimension-value",
  "alias-cycle",
  "malformed-json-pointer",
  "missing-json-pointer-target",
  "misplaced-json-pointer-under-value",
  "malformed-resolver-required-fields",
]);

const SC01_T02_PREVIEW_READY_FIXTURE_IDS = Object.freeze([
  "number-token",
  "typography-token",
  "color-without-local-alpha-and-hex",
]);

const SC01_T02_NATIVE_HISTORICAL_FIXTURE_IDS = Object.freeze([
  "root-token-curly-alias",
  "alias-infers-target-type",
  "token-vendor-extension",
  "deprecated-token",
  ...SC01_T02_PREVIEW_READY_FIXTURE_IDS,
]);

function expectedDisclosure(featureId, code, pointer, tokenPath) {
  return Object.freeze({ featureId, code, pointer, tokenPath });
}

const SC01_EXPECTED_DISCLOSURES = Object.freeze([
  Object.freeze({
    id: "root-token-curly-alias",
    disclosures: Object.freeze([
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/primary/$value/hex",
        "primary",
      ),
    ]),
  }),
  Object.freeze({
    id: "alias-infers-target-type",
    disclosures: Object.freeze([
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/palette/primary/$value/hex",
        "palette.primary",
      ),
    ]),
  }),
  Object.freeze({
    id: "whole-token-json-pointer",
    disclosures: Object.freeze([
      expectedDisclosure("JSON_POINTER_REF", "UNSUPPORTED_DTCG_MEMBER", "/alias/$ref", "alias"),
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/primary/$value/hex",
        "primary",
      ),
    ]),
  }),
  Object.freeze({
    id: "color-component-json-pointer",
    disclosures: Object.freeze([
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/base/$value/hex",
        "base",
      ),
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/derived/$value/hex",
        "derived",
      ),
      expectedDisclosure(
        "PROPERTY_LEVEL_REF",
        "UNSUPPORTED_PROPERTY_ALIAS",
        "/derived/$value/components/0/$ref",
        "derived",
      ),
    ]),
  }),
  Object.freeze({
    id: "group-root-token",
    disclosures: Object.freeze([
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/semantic/$root/$value/hex",
        "semantic.$root",
      ),
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/semantic/accent/$value/hex",
        "semantic.accent",
      ),
      expectedDisclosure(
        "ROOT_GROUP_TOKEN",
        "UNSUPPORTED_DTCG_MEMBER",
        "/semantic/$root",
        "semantic.$root",
      ),
    ]),
  }),
  Object.freeze({
    id: "group-extends",
    disclosures: Object.freeze([
      expectedDisclosure(
        "GROUP_EXTENDS",
        "UNSUPPORTED_DTCG_MEMBER",
        "/derived/$extends",
        "derived",
      ),
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/base/accent/$value/hex",
        "base.accent",
      ),
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/derived/accent/$value/hex",
        "derived.accent",
      ),
    ]),
  }),
  Object.freeze({
    id: "empty-described-group",
    disclosures: Object.freeze([
      expectedDisclosure("EMPTY_GROUP", "EMPTY_DTCG_GROUP", "/empty", "empty"),
    ]),
  }),
  Object.freeze({
    id: "token-vendor-extension",
    disclosures: Object.freeze([
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/primary/$value/hex",
        "primary",
      ),
    ]),
  }),
  Object.freeze({
    id: "deprecated-token",
    disclosures: Object.freeze([
      expectedDisclosure(
        "OPTIONAL_COLOR_ALPHA_AND_HEX",
        "UNSUPPORTED_DTCG_MEMBER",
        "/legacy/$value/hex",
        "legacy",
      ),
    ]),
  }),
  Object.freeze({ id: "number-token", disclosures: Object.freeze([]) }),
  Object.freeze({ id: "typography-token", disclosures: Object.freeze([]) }),
  Object.freeze({
    id: "display-p3-color",
    disclosures: Object.freeze([
      expectedDisclosure(
        "ADDITIONAL_COLOR_SPACES",
        "UNSUPPORTED_COLOR_SPACE",
        "/accent/$value/colorSpace",
        "accent",
      ),
    ]),
  }),
  Object.freeze({
    id: "oklch-color",
    disclosures: Object.freeze([
      expectedDisclosure(
        "ADDITIONAL_COLOR_SPACES",
        "UNSUPPORTED_COLOR_SPACE",
        "/accent/$value/colorSpace",
        "accent",
      ),
    ]),
  }),
  Object.freeze({
    id: "srgb-none-component",
    disclosures: Object.freeze([
      expectedDisclosure(
        "NONE_COLOR_COMPONENTS",
        "UNSUPPORTED_DTCG_MEMBER",
        "/accent/$value/components/0",
        "accent",
      ),
    ]),
  }),
  Object.freeze({
    id: "color-without-local-alpha-and-hex",
    disclosures: Object.freeze([]),
  }),
  Object.freeze({
    id: "resolver-theme-modifier",
    disclosures: Object.freeze([
      expectedDisclosure("RESOLVER_THEMES_AND_MODES", "UNSUPPORTED_DTCG_MEMBER", "", null),
    ]),
  }),
]);

const SC01_EXPECTED_INVALID_DIAGNOSTICS = Object.freeze([
  Object.freeze({
    id: "name-containing-dot",
    cause: "INVALID_DTCG_NAME",
    causePointer: "/bad.name",
  }),
  Object.freeze({
    id: "malformed-dimension-value",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/space/sm/$value/value",
  }),
  Object.freeze({
    id: "alias-cycle",
    cause: "ALIAS_CYCLE",
    causePointer: "/color/a/$value",
  }),
  Object.freeze({
    id: "malformed-json-pointer",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/alias/$ref",
  }),
  Object.freeze({
    id: "missing-json-pointer-target",
    cause: "ALIAS_TARGET_MISSING",
    causePointer: "/alias/$ref",
  }),
  Object.freeze({
    id: "misplaced-json-pointer-under-value",
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/alias/$value",
  }),
  Object.freeze({
    id: "malformed-resolver-required-fields",
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "",
  }),
]);

const T02_RECOGNIZED_UNSUPPORTED_FIXTURES = Object.freeze([
  Object.freeze({
    id: "complex-border-stroke-style",
    document: Object.freeze({
      border: Object.freeze({
        $type: "border",
        $value: Object.freeze({
          color: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
          style: Object.freeze({
            dashArray: Object.freeze([
              Object.freeze({ unit: "px", value: 1 }),
              Object.freeze({ unit: "rem", value: 0.25 }),
            ]),
            lineCap: "round",
          }),
          width: Object.freeze({ unit: "px", value: 1 }),
        }),
      }),
    }),
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
    document: Object.freeze({
      family: Object.freeze({ $type: "fontFamily", $value: "Inter" }),
      typography: Object.freeze({
        $type: "typography",
        $value: Object.freeze({
          fontFamily: "{family}",
          fontSize: Object.freeze({ unit: "px", value: 16 }),
          fontWeight: 400,
          letterSpacing: Object.freeze({ unit: "px", value: 0 }),
          lineHeight: 1.5,
        }),
      }),
    }),
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
    document: Object.freeze({
      family: Object.freeze({
        $type: "fontFamily",
        $value: Object.freeze(["Inter", "sans-serif"]),
      }),
    }),
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
    document: Object.freeze({
      weight: Object.freeze({ $type: "fontWeight", $value: 450.5 }),
    }),
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
    document: Object.freeze({
      black: Object.freeze({
        $type: "color",
        $value: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
      }),
      end: Object.freeze({ $type: "number", $value: 1 }),
      singleton: Object.freeze({
        $type: "gradient",
        $value: Object.freeze([
          Object.freeze({
            color: Object.freeze({
              colorSpace: "srgb",
              components: Object.freeze([1, 1, 1]),
            }),
            position: 0,
          }),
        ]),
      }),
      gradient: Object.freeze({
        $type: "gradient",
        $value: Object.freeze([
          "{singleton}",
          Object.freeze({ color: "{black}", position: "{end}" }),
        ]),
      }),
    }),
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
    document: Object.freeze({
      dash: Object.freeze({
        $type: "dimension",
        $value: Object.freeze({ unit: "px", value: 2 }),
      }),
      style: Object.freeze({
        $type: "strokeStyle",
        $value: Object.freeze({
          dashArray: Object.freeze(["{dash}", Object.freeze({ unit: "px", value: 1 })]),
          lineCap: "square",
        }),
      }),
    }),
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

const PROTOTYPE_SAFE_EXTENDS_FIXTURE = Object.freeze({
  id: "prototype-safe-group-extends",
  document: Object.freeze({
    base: Object.freeze({
      inherited: Object.freeze({ $type: "number", $value: 1 }),
    }),
    derived: Object.freeze({
      $extends: "{base}",
      ["__proto__"]: Object.freeze({ $type: "number", $value: 2 }),
    }),
  }),
  disclosures: Object.freeze([
    Object.freeze({
      featureId: "GROUP_EXTENDS",
      code: "UNSUPPORTED_DTCG_MEMBER",
      pointer: "/derived/$extends",
      tokenPath: "derived",
    }),
  ]),
});

const T02_RECOGNIZED_MALFORMED_FIXTURES = Object.freeze([
  Object.freeze({
    id: "complex-border-line-cap",
    document: Object.freeze({
      border: Object.freeze({
        $type: "border",
        $value: Object.freeze({
          color: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
          style: Object.freeze({
            dashArray: Object.freeze([Object.freeze({ unit: "px", value: 1 })]),
            lineCap: "rounded",
          }),
          width: Object.freeze({ unit: "px", value: 1 }),
        }),
      }),
    }),
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/border/$value/style",
  }),
  Object.freeze({
    id: "typography-reference-type",
    document: Object.freeze({
      dimension: Object.freeze({
        $type: "dimension",
        $value: Object.freeze({ unit: "px", value: 16 }),
      }),
      typography: Object.freeze({
        $type: "typography",
        $value: Object.freeze({
          fontFamily: "{dimension}",
          fontSize: Object.freeze({ unit: "px", value: 16 }),
          fontWeight: 400,
          letterSpacing: Object.freeze({ unit: "px", value: 0 }),
          lineHeight: 1.5,
        }),
      }),
    }),
    cause: "ALIAS_TYPE_MISMATCH",
    causePointer: "/typography/$value/fontFamily",
  }),
  Object.freeze({
    id: "font-family-value",
    document: Object.freeze({ family: Object.freeze({ $type: "fontFamily", $value: [] }) }),
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/family/$value",
  }),
  Object.freeze({
    id: "font-weight-value",
    document: Object.freeze({
      weight: Object.freeze({ $type: "fontWeight", $value: 1_001 }),
    }),
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/weight/$value",
  }),
  Object.freeze({
    id: "gradient-stop-value",
    document: Object.freeze({
      gradient: Object.freeze({
        $type: "gradient",
        $value: Object.freeze([
          Object.freeze({
            color: Object.freeze({
              colorSpace: "srgb",
              components: Object.freeze([0, 0, 0]),
            }),
          }),
        ]),
      }),
    }),
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/gradient/$value/0",
  }),
  Object.freeze({
    id: "empty-gradient-value",
    document: Object.freeze({
      gradient: Object.freeze({ $type: "gradient", $value: Object.freeze([]) }),
    }),
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/gradient/$value",
  }),
  Object.freeze({
    id: "stroke-style-value",
    document: Object.freeze({
      style: Object.freeze({
        $type: "strokeStyle",
        $value: Object.freeze({
          dashArray: Object.freeze([Object.freeze({ unit: "em", value: 1 })]),
          lineCap: "round",
        }),
      }),
    }),
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/style/$value",
  }),
  Object.freeze({
    id: "empty-stroke-dash-array",
    document: Object.freeze({
      style: Object.freeze({
        $type: "strokeStyle",
        $value: Object.freeze({ dashArray: Object.freeze([]), lineCap: "round" }),
      }),
    }),
    cause: "INVALID_DTCG_VALUE",
    causePointer: "/style/$value",
  }),
  Object.freeze({
    id: "gradient-array-ref-wrong-shape",
    document: Object.freeze({
      gradient: Object.freeze({
        $type: "gradient",
        $value: Object.freeze([Object.freeze({ $ref: "#/typography/$value/fontSize" })]),
      }),
      typography: Object.freeze({
        $type: "typography",
        $value: Object.freeze({
          fontFamily: "Inter",
          fontSize: Object.freeze({ unit: "px", value: 16 }),
          fontWeight: 400,
          letterSpacing: Object.freeze({ unit: "px", value: 0 }),
          lineHeight: 1.5,
        }),
      }),
    }),
    cause: "ALIAS_TYPE_MISMATCH",
    causePointer: "/gradient/$value/0/$ref",
  }),
  Object.freeze({
    id: "shadow-array-ref-wrong-shape",
    document: Object.freeze({
      shadow: Object.freeze({
        $type: "shadow",
        $value: Object.freeze([Object.freeze({ $ref: "#/typography/$value/fontSize" })]),
      }),
      typography: Object.freeze({
        $type: "typography",
        $value: Object.freeze({
          fontFamily: "Inter",
          fontSize: Object.freeze({ unit: "px", value: 16 }),
          fontWeight: 400,
          letterSpacing: Object.freeze({ unit: "px", value: 0 }),
          lineHeight: 1.5,
        }),
      }),
    }),
    cause: "ALIAS_TYPE_MISMATCH",
    causePointer: "/shadow/$value/0/$ref",
  }),
]);

const RESOLVER_MALFORMED_FIXTURES = Object.freeze([
  Object.freeze({
    id: "empty-resolver-resolution-order",
    document: Object.freeze({
      modifiers: Object.freeze({
        theme: Object.freeze({
          contexts: Object.freeze({
            dark: Object.freeze([
              Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
            ]),
            light: Object.freeze([
              Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
            ]),
          }),
          default: "light",
        }),
      }),
      resolutionOrder: Object.freeze([]),
      version: "2025-11-01",
    }),
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "",
  }),
  ...Object.freeze([
    Object.freeze({ id: "resolver-source-ref-space", reference: "bad ref with space" }),
    Object.freeze({ id: "resolver-source-ref-bad-percent", reference: "bad%ZZ" }),
    Object.freeze({
      id: "resolver-source-ref-non-pointer-fragment",
      reference: "#not-a-json-pointer",
    }),
  ]).map(({ id, reference }) =>
    Object.freeze({
      id,
      document: Object.freeze({
        resolutionOrder: Object.freeze([Object.freeze({ $ref: "#/sets/base" })]),
        sets: Object.freeze({
          base: Object.freeze({
            sources: Object.freeze([Object.freeze({ $ref: reference })]),
          }),
        }),
        version: "2025-11-01",
      }),
      cause: "INVALID_DTCG_STRUCTURE",
      causePointer: "/sets/base/sources/0/$ref",
    }),
  ),
  Object.freeze({
    id: "resolver-sets-wrong-type",
    document: Object.freeze({
      modifiers: Object.freeze({
        theme: Object.freeze({
          contexts: Object.freeze({
            dark: Object.freeze([
              Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
            ]),
            light: Object.freeze([
              Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
            ]),
          }),
          default: "light",
        }),
      }),
      resolutionOrder: Object.freeze([Object.freeze({ $ref: "#/modifiers/theme" })]),
      sets: Object.freeze([]),
      version: "2025-11-01",
    }),
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "",
  }),
  Object.freeze({
    id: "resolver-modifiers-wrong-type",
    document: Object.freeze({
      modifiers: "bad",
      resolutionOrder: Object.freeze([Object.freeze({ $ref: "#/sets/base" })]),
      sets: Object.freeze({
        base: Object.freeze({
          sources: Object.freeze([
            Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
          ]),
        }),
      }),
      version: "2025-11-01",
    }),
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "",
  }),
  Object.freeze({
    id: "resolver-modifier-single-context",
    document: Object.freeze({
      modifiers: Object.freeze({
        theme: Object.freeze({
          contexts: Object.freeze({
            light: Object.freeze([
              Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
            ]),
          }),
          default: "light",
        }),
      }),
      resolutionOrder: Object.freeze([Object.freeze({ $ref: "#/modifiers/theme" })]),
      version: "2025-11-01",
    }),
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/modifiers/theme",
  }),
  Object.freeze({
    id: "nested-resolver-inline-source",
    document: Object.freeze({
      resolutionOrder: Object.freeze([Object.freeze({ $ref: "#/sets/base" })]),
      sets: Object.freeze({
        base: Object.freeze({
          sources: Object.freeze([
            Object.freeze({
              modifiers: Object.freeze({
                theme: Object.freeze({
                  contexts: Object.freeze({
                    dark: Object.freeze([
                      Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
                    ]),
                    light: Object.freeze([
                      Object.freeze({ marker: Object.freeze({ $type: "number", $value: 0 }) }),
                    ]),
                  }),
                  default: "light",
                }),
              }),
              resolutionOrder: Object.freeze([Object.freeze({ $ref: "#/modifiers/theme" })]),
              version: "2025-11-01",
            }),
          ]),
        }),
      }),
      version: "2025-11-01",
    }),
    cause: "INVALID_DTCG_STRUCTURE",
    causePointer: "/sets/base/sources/0",
  }),
]);

const SHADOW_INSET_FIXTURE = Object.freeze({
  id: "shadow-inset-preservation",
  document: Object.freeze({
    base: Object.freeze({
      $type: "shadow",
      $value: Object.freeze({
        blur: Object.freeze({ unit: "px", value: 4 }),
        color: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
        inset: true,
        offsetX: Object.freeze({ unit: "px", value: 0 }),
        offsetY: Object.freeze({ unit: "px", value: 2 }),
        spread: Object.freeze({ unit: "px", value: 0 }),
      }),
    }),
    layered: Object.freeze({
      $type: "shadow",
      $value: Object.freeze([
        Object.freeze({
          blur: Object.freeze({ unit: "px", value: 4 }),
          color: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
          inset: false,
          offsetX: Object.freeze({ unit: "px", value: 0 }),
          offsetY: Object.freeze({ unit: "px", value: 2 }),
          spread: Object.freeze({ unit: "px", value: 0 }),
        }),
        Object.freeze({
          blur: Object.freeze({ unit: "px", value: 4 }),
          color: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
          offsetX: Object.freeze({ unit: "px", value: 0 }),
          offsetY: Object.freeze({ unit: "px", value: 2 }),
          spread: Object.freeze({ unit: "px", value: 0 }),
        }),
      ]),
    }),
    derived: Object.freeze({
      $type: "shadow",
      $value: Object.freeze({
        blur: Object.freeze({ unit: "px", value: 4 }),
        color: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
        inset: Object.freeze({ $ref: "#/base/$value/inset" }),
        offsetX: Object.freeze({ unit: "px", value: 0 }),
        offsetY: Object.freeze({ unit: "px", value: 2 }),
        spread: Object.freeze({ unit: "px", value: 0 }),
      }),
    }),
  }),
  disclosures: Object.freeze([
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
  ]),
});

const SHADOW_MALFORMED_FIXTURES = Object.freeze([
  ...Object.freeze([
    Object.freeze({ id: "shadow-inset-non-boolean", inset: "yes" }),
    Object.freeze({
      id: "shadow-inset-ref-wrong-shape",
      inset: Object.freeze({ $ref: "#/weight/$value" }),
    }),
  ]).map(({ id, inset }) =>
    Object.freeze({
      id,
      document: Object.freeze({
        shadow: Object.freeze({
          $type: "shadow",
          $value: Object.freeze({
            blur: Object.freeze({ unit: "px", value: 4 }),
            color: Object.freeze({ colorSpace: "srgb", components: Object.freeze([0, 0, 0]) }),
            inset,
            offsetX: Object.freeze({ unit: "px", value: 0 }),
            offsetY: Object.freeze({ unit: "px", value: 2 }),
            spread: Object.freeze({ unit: "px", value: 0 }),
          }),
        }),
        weight: Object.freeze({ $type: "number", $value: 1 }),
      }),
      cause: "INVALID_DTCG_VALUE",
      causePointer: "/shadow/$value/inset",
    }),
  ),
  Object.freeze({
    id: "empty-shadow-array",
    document: Object.freeze({
      shadow: Object.freeze({ $type: "shadow", $value: Object.freeze([]) }),
    }),
    cause: "LIMIT_EXCEEDED",
    causePointer: "/shadow/$value",
  }),
]);

const RUNTIME_CORE_ARTIFACT_PIN = Object.freeze({
  path: RUNTIME_CORE_BASELINE_ARTIFACT_PATH,
  bytes: 271,
  sha256: "fbda58d72ccff36d530368422dd7fd82c73dcca359c29e3a6667e8ae4b9b424b",
});

const AUTHORING_AUTHORITY_PATHS = Object.freeze([
  `${AUTHORING_ROOT}/package.json`,
  `${AUTHORING_ROOT}/README.md`,
  `${AUTHORING_ROOT}/src/index.ts`,
  `${AUTHORING_ROOT}/src/inert-json.ts`,
  `${AUTHORING_ROOT}/src/neutral-theme.ts`,
  `${AUTHORING_ROOT}/src/reviewed-dtcg-compatibility.ts`,
  `${AUTHORING_ROOT}/src/theme-authoring.ts`,
  `${AUTHORING_ROOT}/test/public-package.mjs`,
  `${AUTHORING_ROOT}/test/public-package.types.mts`,
  `${AUTHORING_ROOT}/test/theme-authoring.test.ts`,
  `${AUTHORING_ROOT}/tsconfig.build.json`,
  `${AUTHORING_ROOT}/tsconfig.json`,
  `${AUTHORING_ROOT}/tsconfig.public-package.json`,
]);

const WORKBENCH_AUTHORITY_PATHS = Object.freeze([
  `${WORKBENCH_ROOT}/package.json`,
  `${WORKBENCH_ROOT}/README.md`,
  `${WORKBENCH_ROOT}/design-system-workbench.pw.ts`,
  `${WORKBENCH_ROOT}/index.html`,
  `${WORKBENCH_ROOT}/playwright.config.ts`,
  `${WORKBENCH_ROOT}/proof-contract.ts`,
  `${WORKBENCH_ROOT}/proof-reporter.ts`,
  `${WORKBENCH_ROOT}/src/main.tsx`,
  `${WORKBENCH_ROOT}/src/workbench-application.tsx`,
  `${WORKBENCH_ROOT}/src/workbench.css`,
  `${WORKBENCH_ROOT}/tsconfig.json`,
  `${WORKBENCH_ROOT}/vite.config.ts`,
]);

const AUTHORING_RUNTIME_EXPORTS = Object.freeze([
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

const AUTHORING_FUNCTION_EXPORTS = Object.freeze(
  AUTHORING_RUNTIME_EXPORTS.filter((name) => /^[a-z]/u.test(name)),
);

const CORE_RUNTIME_EXPORTS = Object.freeze([
  "DESIGN_TOKEN_PROFILE",
  "EDITABLE_PROJECT_KIND",
  "EDITABLE_PROJECT_LIMITS",
  "EDITABLE_PROJECT_SCHEMA_VERSION",
  "SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS",
  "admitDtcgTokenDocument",
  "admitEditableProjectRecord",
  "getDesignTokenValueFamily",
  "getDtcgAliasTarget",
  "isDtcgTokenAlias",
  "migrateEditableProjectRecord",
  "resolveDesignTokens",
]);

const CORE_FUNCTION_EXPORTS = Object.freeze([
  "admitDtcgTokenDocument",
  "admitEditableProjectRecord",
  "getDesignTokenValueFamily",
  "getDtcgAliasTarget",
  "isDtcgTokenAlias",
  "migrateEditableProjectRecord",
  "resolveDesignTokens",
]);

const AUTHORING_LIMIT_KEYS = Object.freeze([
  "maxHistoryEntries",
  "maxIdentifierCodeUnits",
  "maxImportBytes",
  "maxLabelCodeUnits",
  "maxModesPerTheme",
  "maxThemes",
  "maxUnsupportedFeaturesPerOverlay",
]);

const EXPECTED_BROWSER_TEST_TITLES = Object.freeze(
  [
    "applies a color literal to live preview and supports undo and redo",
    "edits typography atomically and redirects a whole-token alias",
    "round-trips deterministic export and retains working data after invalid import",
    "shows the editable Neutral foundation and switches light and dark modes",
  ].sort(),
);

const EXPECTED_BROWSER_ASSERTIONS = Object.freeze([
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

const EXPECTED_FORBIDDEN_GRAPH_AUTHORITIES = Object.freeze([
  "desenApp",
  "editor",
  "publisher",
  "runtime",
  "starterCatalog",
]);

/** Exact task-owned browser command used after the proof application has been built. */
export const M10A_T03_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze([
    "--filter",
    "@desen/design-system-workbench-proof",
    "run",
    "test:e2e:built",
  ]),
});

/** Capture command which typechecks, rebuilds, and executes the isolated Chromium proof. */
export const M10A_T03_BROWSER_CAPTURE_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/design-system-workbench-proof", "run", "test:e2e"]),
});

/** Stable root-test declarations embedded in the deterministic T03 artifact. */
export const M10A_T03_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T03 builds deterministic evidence through the built public package",
  "M10A-T03 proves editable Neutral modes arbitrary values and live preview",
  "M10A-T03 proves atomic typography alias edits and bounded undo redo",
  "M10A-T03 preserves the exact SC-01 compatibility matrix and rejects invalid imports atomically",
  "M10A-T03 preserves T02 Protocol and Runtime Core authorities exactly",
  "M10A-T03 rejects public API package application and browser observation mutations",
  "M10A-T03 verifier rejects artifact and visible-report drift",
  "M10A-T03 writer is atomic and rejects unsafe destinations",
]);

/** Stable redacted failure emitted by the T03 evidence boundary. */
export class M10AT03ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT03ProofError";
    this.code = `M10A_T03_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT03ProofError(code, message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string") ||
    !isDeepStrictEqual([...keys].sort(), [...expected].sort())
  ) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function ordinaryArray(value) {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" && (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length)),
    ) ||
    keys.length !== value.length + 1
  ) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, "value");
  });
}

function captureOptions(rawOptions, allowedKeys) {
  const value = rawOptions === undefined ? {} : rawOptions;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", "Options must be one inert plain own-data record.");
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      fail("OPTIONS_INVALID", "Options contain an unknown or executable field.");
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function captureWorkspaceRoot(rawRoot = WORKSPACE_ROOT) {
  if (
    typeof rawRoot !== "string" ||
    rawRoot.length === 0 ||
    rawRoot.length > 4_096 ||
    !path.isAbsolute(rawRoot) ||
    path.resolve(rawRoot) !== rawRoot ||
    rawRoot.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  try {
    const entry = await lstat(rawRoot, { bigint: true });
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      entry.nlink < 1n ||
      (await realpath(rawRoot)) !== rawRoot
    ) {
      throw new Error("unsafe root");
    }
  } catch {
    fail("AUTHORITY_UNSAFE", "Workspace authority is not one canonical directory.");
  }
  return rawRoot;
}

function captureBytes(rawBytes, label) {
  if (!Buffer.isBuffer(rawBytes) || utilTypes.isProxy(rawBytes)) {
    fail("OPTIONS_INVALID", `${label} must be one Buffer.`);
  }
  return Buffer.from(rawBytes);
}

function captureOverrides(rawOverrides) {
  if (rawOverrides === undefined) return new Map();
  if (
    !(rawOverrides instanceof Map) ||
    utilTypes.isProxy(rawOverrides) ||
    Object.getPrototypeOf(rawOverrides) !== Map.prototype
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one ordinary Map.");
  }
  const allowed = new Set([
    T02_ARTIFACT_PATH,
    SC01_DTCG_ARTIFACT_PATH,
    RUNTIME_CORE_BASELINE_ARTIFACT_PATH,
    ...AUTHORING_AUTHORITY_PATHS,
    ...WORKBENCH_AUTHORITY_PATHS,
  ]);
  const captured = new Map();
  for (const [relativePath, rawBytes] of rawOverrides) {
    if (typeof relativePath !== "string" || !allowed.has(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unreviewed path.");
    }
    captured.set(relativePath, captureBytes(rawBytes, "file override"));
  }
  return captured;
}

async function readRegularAuthority(
  workspaceRoot,
  relativePath,
  overrides = new Map(),
  limit = MAX_AUTHORITY_BYTES,
) {
  const override = overrides.get(relativePath);
  if (override !== undefined) {
    if (override.byteLength === 0 || override.byteLength > limit) {
      fail("AUTHORITY_UNSAFE", `Required authority is unavailable: ${relativePath}`);
    }
    return Buffer.from(override);
  }
  const target = path.join(workspaceRoot, relativePath);
  let handle;
  try {
    const before = await lstat(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size <= 0n ||
      before.size > BigInt(limit) ||
      (await realpath(target)) !== target
    ) {
      throw new Error("unsafe authority");
    }
    handle = await open(target, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size ||
      opened.mode !== before.mode
    ) {
      throw new Error("authority changed before open");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const linked = await lstat(target, { bigint: true });
    if (
      bytes.byteLength !== Number(before.size) ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mode !== before.mode ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      linked.dev !== before.dev ||
      linked.ino !== before.ino
    ) {
      throw new Error("authority changed while read");
    }
    return bytes;
  } catch {
    fail("AUTHORITY_UNSAFE", `Required authority is unavailable: ${relativePath}`);
  } finally {
    await handle?.close();
  }
}

async function listAuthorityFiles(workspaceRoot, relativeRoot) {
  const files = [];
  const visit = async (relativeDirectory) => {
    const absoluteDirectory = path.join(workspaceRoot, relativeDirectory);
    let entries;
    try {
      const directory = await lstat(absoluteDirectory, { bigint: true });
      if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error();
      entries = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch {
      fail("AUTHORITY_UNSAFE", `Authority inventory is unavailable: ${relativeRoot}`);
    }
    for (const entry of entries.toSorted((left, right) =>
      left.name.localeCompare(right.name, "en"),
    )) {
      if (
        relativeDirectory === relativeRoot &&
        [".turbo", "dist", "node_modules"].includes(entry.name)
      ) {
        continue;
      }
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(relativePath);
      else if (entry.isFile() && !entry.isSymbolicLink()) files.push(relativePath);
      else
        fail("AUTHORITY_UNSAFE", `Authority inventory contains an unsafe entry: ${relativePath}`);
    }
  };
  await visit(relativeRoot);
  return Object.freeze(files.sort());
}

async function authenticateInventory(workspaceRoot, relativeRoot, expectedPaths) {
  const actual = await listAuthorityFiles(workspaceRoot, relativeRoot);
  if (!isDeepStrictEqual(actual, [...expectedPaths].sort())) {
    fail("PACKAGE_DRIFT", `${relativeRoot} source inventory drifted.`);
  }
}

function parseJson(bytes, label) {
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    fail("AUTHORITY_INVALID", `${label} must be one valid UTF-8 JSON object.`);
  }
}

function receipt(relativePath, bytes) {
  return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
}

function receiptAggregate(receipts) {
  const payload = receipts
    .map(
      ({ path: relativePath, bytes, sha256: digest }) => `${relativePath}\0${bytes}\0${digest}\n`,
    )
    .join("");
  return sha256(Buffer.from(payload, "utf8"));
}

function captureRuntime(rawRuntime, expectedExports, functionExports, label) {
  if (
    rawRuntime === null ||
    typeof rawRuntime !== "object" ||
    Array.isArray(rawRuntime) ||
    utilTypes.isProxy(rawRuntime)
  ) {
    fail("OPTIONS_INVALID", `${label} must expose inert own-data exports.`);
  }
  const ownKeys = Reflect.ownKeys(rawRuntime);
  const names = ownKeys.filter((key) => typeof key === "string").sort();
  const unexpectedSymbol = ownKeys.find(
    (key) => typeof key === "symbol" && key !== Symbol.toStringTag,
  );
  if (unexpectedSymbol !== undefined || !isDeepStrictEqual(names, expectedExports)) {
    fail("PUBLIC_API_DRIFT", `${label} runtime export set drifted.`);
  }
  const captured = Object.create(null);
  for (const name of expectedExports) {
    const descriptor = Object.getOwnPropertyDescriptor(rawRuntime, name);
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail("PUBLIC_API_DRIFT", `${label} export ${name} is unavailable.`);
    }
    if (
      functionExports.includes(name) &&
      (typeof descriptor.value !== "function" || utilTypes.isProxy(descriptor.value))
    ) {
      fail("PUBLIC_API_DRIFT", `${label} export ${name} is not callable.`);
    }
    captured[name] = descriptor.value;
  }
  return Object.freeze(captured);
}

function call(runtime, name, ...args) {
  try {
    return Reflect.apply(runtime[name], undefined, args);
  } catch {
    fail("BEHAVIOR_DRIFT", `Built public operation ${name} threw unexpectedly.`);
  }
}

function assertDeepFrozen(value, label) {
  const pending = [value];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || visited.has(current)) continue;
    if (utilTypes.isProxy(current)) fail("BEHAVIOR_DRIFT", `${label} contains a Proxy.`);
    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) {
      fail("BEHAVIOR_DRIFT", `${label} contains a custom object prototype.`);
    }
    visited.add(current);
    if (!Object.isFrozen(current)) fail("BEHAVIOR_DRIFT", `${label} is not recursively immutable.`);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (
        typeof key !== "string" ||
        descriptor === undefined ||
        !Object.hasOwn(descriptor, "value")
      ) {
        fail("BEHAVIOR_DRIFT", `${label} contains executable or symbolic state.`);
      }
      pending.push(descriptor.value);
    }
  }
}

function expectSuccess(result, label) {
  if (result?.ok !== true || result.session === undefined) {
    fail("BEHAVIOR_DRIFT", `${label} did not return one complete successful session.`);
  }
  assertDeepFrozen(result, label);
  return result.session;
}

function tokenValue(session, tokenPath) {
  if (session?.preview?.ok !== true || session.preview.tokens?.[tokenPath] === undefined) {
    fail("BEHAVIOR_DRIFT", `Live preview omitted ${tokenPath}.`);
  }
  return session.preview.tokens[tokenPath].value;
}

function linearSrgb(component) {
  if (
    typeof component !== "number" ||
    !Number.isFinite(component) ||
    component < 0 ||
    component > 1
  ) {
    fail("BEHAVIOR_DRIFT", "Neutral contrast evidence contains an invalid sRGB component.");
  }
  return component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(value) {
  if (
    !exactKeys(value, ["colorSpace", "components"]) ||
    value.colorSpace !== "srgb" ||
    !ordinaryArray(value.components) ||
    value.components.length !== 3
  ) {
    fail("BEHAVIOR_DRIFT", "Neutral contrast evidence requires one exact opaque sRGB color.");
  }
  const [red, green, blue] = value.components.map(linearSrgb);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(left, right) {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
}

function neutralAccessibilityReceipt(session) {
  const receipt = {
    modeId: session.selection.modeId,
    contrast: {
      foregroundCanvas: contrastRatio(
        tokenValue(session, "color.foreground"),
        tokenValue(session, "color.canvas"),
      ),
      mutedSurface: contrastRatio(
        tokenValue(session, "color.muted"),
        tokenValue(session, "color.surface"),
      ),
      actionOnAction: contrastRatio(
        tokenValue(session, "color.action"),
        tokenValue(session, "color.onAction"),
      ),
      focusCanvas: contrastRatio(
        tokenValue(session, "color.focus"),
        tokenValue(session, "color.canvas"),
      ),
    },
    stroke: {
      default: cloneJson(tokenValue(session, "stroke.default")),
      focus: cloneJson(tokenValue(session, "stroke.focus")),
    },
  };
  if (
    receipt.contrast.foregroundCanvas < 7 ||
    receipt.contrast.mutedSurface < 4.5 ||
    receipt.contrast.actionOnAction < 7 ||
    receipt.contrast.focusCanvas < 3 ||
    !isDeepStrictEqual(receipt.stroke.default, { unit: "px", value: 1 }) ||
    !isDeepStrictEqual(receipt.stroke.focus, { unit: "px", value: 2 })
  ) {
    fail("BEHAVIOR_DRIFT", "Neutral contrast or focus-signal evidence fell below its exact floor.");
  }
  return Object.freeze({
    ...receipt,
    thresholds: Object.freeze({
      foregroundCanvas: 7,
      mutedSurface: 4.5,
      actionOnAction: 7,
      focusCanvas: 3,
    }),
    passed: true,
  });
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    fail("BEHAVIOR_DRIFT", "Built authoring data was not inert JSON.");
  }
}

function canonicalJsonBytes(value) {
  function normalize(current) {
    if (Array.isArray(current)) return current.map(normalize);
    if (current !== null && typeof current === "object") {
      return Object.fromEntries(
        Object.keys(current)
          .sort()
          .map((key) => [key, normalize(current[key])]),
      );
    }
    return current;
  }
  try {
    return Buffer.from(JSON.stringify(normalize(value)), "utf8");
  } catch {
    fail("BEHAVIOR_DRIFT", "A compatibility subtree was not canonical inert JSON.");
  }
}

function compatibilityThemeDocument(document, index) {
  const suffix = String(index).padStart(2, "0");
  return {
    kind: "desen.theme-authoring",
    schemaVersion: 1,
    themes: [
      {
        base: { document: cloneJson(document), id: `compatibility.${suffix}.base` },
        id: `compatibility-${suffix}`,
        modes: [
          {
            id: "default",
            name: "Default",
            source: {
              document: { m10aProofMarker: { $type: "number", $value: 0 } },
              id: `compatibility.${suffix}.default`,
            },
          },
        ],
        name: `Compatibility ${suffix}`,
      },
    ],
  };
}

function compatibilitySubtree(document) {
  const subtree = document?.themes?.[0]?.base?.document;
  if (subtree === null || typeof subtree !== "object" || Array.isArray(subtree)) {
    fail("BEHAVIOR_DRIFT", "A compatibility document lost its opaque base subtree.");
  }
  return subtree;
}

function fixtureCanonicalSha256(fixture) {
  const computed = `sha256:${sha256(canonicalJsonBytes(fixture.document))}`;
  if (fixture.canonicalJsonSha256 !== undefined && fixture.canonicalJsonSha256 !== computed) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} canonical fixture identity drifted.`);
  }
  return computed;
}

function assertCompatibilitySubtree(document, fixture, label) {
  const bytes = canonicalJsonBytes(compatibilitySubtree(document));
  if (
    bytes.byteLength !== canonicalJsonBytes(fixture.document).byteLength ||
    `sha256:${sha256(bytes)}` !== fixtureCanonicalSha256(fixture)
  ) {
    fail("BEHAVIOR_DRIFT", `${label} changed an opaque compatibility subtree.`);
  }
}

function compatibilityDisclosureReceipt(features, fixture, previewReadyUnderT02) {
  if (!ordinaryArray(features)) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} omitted its compatibility disclosure inventory.`);
  }
  if (
    (previewReadyUnderT02 && features.length !== 0) ||
    (!previewReadyUnderT02 && features.length === 0)
  ) {
    fail(
      "BEHAVIOR_DRIFT",
      `${fixture.id} drifted between native T02 support and preserved unsupported data.`,
    );
  }
  return features.map((feature) => {
    const diagnostic = feature?.diagnostic;
    if (
      feature?.preserved !== true ||
      typeof feature.featureId !== "string" ||
      diagnostic?.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
      typeof diagnostic.code !== "string" ||
      typeof diagnostic.pointer !== "string" ||
      (diagnostic.tokenPath !== undefined && typeof diagnostic.tokenPath !== "string") ||
      typeof feature.sourceId !== "string" ||
      typeof feature.themeId !== "string"
    ) {
      fail("BEHAVIOR_DRIFT", `${fixture.id} emitted an invalid unsupported-feature disclosure.`);
    }
    return Object.freeze({
      featureId: feature.featureId,
      code: diagnostic.code,
      pointer: diagnostic.pointer,
      tokenPath: diagnostic.tokenPath ?? null,
      sourceId: feature.sourceId,
      themeId: feature.themeId,
      modeId: feature.modeId ?? null,
      preserved: true,
    });
  });
}

function exerciseCompatibilityFixture(
  runtime,
  initialSession,
  fixture,
  index,
  expected = undefined,
) {
  const input = compatibilityThemeDocument(fixture.document, index);
  const previewReadyUnderT02 =
    expected?.previewReadyUnderT02 ?? SC01_T02_PREVIEW_READY_FIXTURE_IDS.includes(fixture.id);
  const admission = call(runtime, "admitThemeAuthoringDocument", input);
  if (admission?.ok !== true || admission.report?.losses?.length !== 0) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} was not admitted without loss.`);
  }
  assertDeepFrozen(admission, `${fixture.id} admission`);
  assertCompatibilitySubtree(admission.document, fixture, `${fixture.id} admission`);
  const disclosures = compatibilityDisclosureReceipt(
    admission.report.preservedUnsupportedFeatures,
    fixture,
    previewReadyUnderT02,
  );
  if (
    expected?.disclosures !== undefined &&
    !isDeepStrictEqual(
      disclosures.map(({ featureId, code, pointer, tokenPath }) => ({
        featureId,
        code,
        pointer,
        tokenPath,
      })),
      expected.disclosures,
    )
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} exact unsupported-feature disclosure drifted.`);
  }
  if (
    !previewReadyUnderT02 &&
    typeof fixture.featureId === "string" &&
    !disclosures.some(({ featureId }) => featureId === fixture.featureId) &&
    !SC01_T02_NATIVE_HISTORICAL_FIXTURE_IDS.includes(fixture.id)
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} lost its reviewed compatibility feature identity.`);
  }

  const createdResult = call(runtime, "createThemeAuthoringSession", admission.document);
  const created = expectSuccess(createdResult, `${fixture.id} session creation`);
  if (created.preview?.ok !== previewReadyUnderT02 || created.revision !== 0) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} preview authority drifted.`);
  }
  assertCompatibilitySubtree(created.document, fixture, `${fixture.id} session creation`);

  const editedResult = call(runtime, "applyThemeAuthoringEdit", created, {
    kind: "set-literal",
    path: "m10aProofMarker",
    sourceId: created.document.themes[0].modes[0].source.id,
    themeId: created.document.themes[0].id,
    type: "number",
    value: index + 1,
  });
  const edited = expectSuccess(editedResult, `${fixture.id} supported sibling edit`);
  if (
    editedResult.changed !== true ||
    edited.revision !== 1 ||
    edited.document.themes[0]?.modes?.[0]?.source?.document?.m10aProofMarker?.$value !==
      index + 1 ||
    edited.preview?.ok !== previewReadyUnderT02
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} did not permit one isolated supported edit.`);
  }
  assertCompatibilitySubtree(edited.document, fixture, `${fixture.id} supported sibling edit`);

  const undoResult = call(runtime, "undoThemeAuthoringEdit", edited);
  const undone = expectSuccess(undoResult, `${fixture.id} undo`);
  if (
    undoResult.changed !== true ||
    undone.revision !== 2 ||
    undone.document !== created.document ||
    undone.selection.themeId !== created.selection.themeId ||
    undone.selection.modeId !== created.selection.modeId
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} undo lost exact document or selection identity.`);
  }
  assertCompatibilitySubtree(undone.document, fixture, `${fixture.id} undo`);

  const redoResult = call(runtime, "redoThemeAuthoringEdit", undone);
  const redone = expectSuccess(redoResult, `${fixture.id} redo`);
  if (
    redoResult.changed !== true ||
    redone.revision !== 3 ||
    redone.document !== edited.document ||
    redone.selection.themeId !== edited.selection.themeId ||
    redone.selection.modeId !== edited.selection.modeId ||
    redone.preview?.ok !== previewReadyUnderT02
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} redo lost exact document or selection identity.`);
  }
  assertCompatibilitySubtree(redone.document, fixture, `${fixture.id} redo`);

  const exported = call(runtime, "exportThemeAuthoringDocument", redone);
  if (
    typeof exported?.text !== "string" ||
    exported.text.endsWith("\n") ||
    exported.report?.canonicalBytes !== Buffer.byteLength(exported.text, "utf8") ||
    exported.report?.losses?.length !== 0 ||
    !sameJson(
      exported.report?.preservedUnsupportedFeatures,
      admission.report.preservedUnsupportedFeatures,
    )
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} export receipt drifted or reported a loss.`);
  }
  const exportedDocument = parseJson(Buffer.from(exported.text, "utf8"), `${fixture.id} export`);
  assertCompatibilitySubtree(exportedDocument, fixture, `${fixture.id} export`);
  const reimportResult = call(
    runtime,
    "importThemeAuthoringDocument",
    initialSession,
    exported.text,
  );
  const reimported = expectSuccess(reimportResult, `${fixture.id} reimport`);
  assertCompatibilitySubtree(reimported.document, fixture, `${fixture.id} reimport`);
  const reexported = call(runtime, "exportThemeAuthoringDocument", reimported);
  if (
    reimportResult.changed !== true ||
    reexported?.text !== exported.text ||
    !sameJson(reexported?.report, exported.report)
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} did not reimport with exact canonical bytes.`);
  }

  const maskedInput = compatibilityThemeDocument(fixture.document, index);
  maskedInput.themes[0].modes[0].source.document.zzInvalidAlias = {
    $type: "color",
    $value: "{missing.compatibility.target}",
  };
  const maskedResult = call(
    runtime,
    "importThemeAuthoringDocument",
    initialSession,
    JSON.stringify(maskedInput),
  );
  assertRetainedFailure(maskedResult, initialSession, "DTCG_REJECTED", `${fixture.id} masking`);
  if (
    maskedResult.diagnostics[0]?.cause?.classification !== "INVALID_DTCG" ||
    maskedResult.diagnostics[0]?.cause?.code !== "ALIAS_TARGET_MISSING"
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} masked a later invalid alias.`);
  }

  const subtreeBytes = canonicalJsonBytes(fixture.document);
  return deepFreeze({
    id: fixture.id,
    ...(typeof fixture.featureId === "string"
      ? {
          historicalFeatureId: fixture.featureId,
          historicalFeatureStatus: SC01_T02_NATIVE_HISTORICAL_FIXTURE_IDS.includes(fixture.id)
            ? "SUPPORTED_BY_T02"
            : "STILL_UNSUPPORTED_BY_T02",
        }
      : {}),
    currentAuthoringStatus: previewReadyUnderT02 ? "T02_PREVIEW_READY" : "PRESERVED_UNSUPPORTED",
    previewStatus: previewReadyUnderT02 ? "READY" : "BLOCKED",
    fixtureCanonicalBytes: subtreeBytes.byteLength,
    fixtureCanonicalSha256: sha256(subtreeBytes),
    disclosures,
    supportedSiblingEdit: true,
    undoRestoredExactDocumentAndSelection: true,
    redoRestoredExactDocumentAndSelection: true,
    exactSubtreeAfterEditUndoRedo: true,
    exactSubtreeAfterExportReimport: true,
    canonicalExportBytes: exported.report.canonicalBytes,
    canonicalExportSha256: sha256(Buffer.from(exported.text, "utf8")),
    exactExportReimport: true,
    losses: 0,
    partialPreviewAuthority: false,
    invalidMaskingRejectedAtomically: true,
  });
}

function exerciseInvalidCompatibilityFixture(
  runtime,
  initialSession,
  fixture,
  index,
  expected = undefined,
) {
  const input = compatibilityThemeDocument(fixture.document, index + 100);
  const result = call(
    runtime,
    "importThemeAuthoringDocument",
    initialSession,
    JSON.stringify(input),
  );
  assertRetainedFailure(result, initialSession, "DTCG_REJECTED", `${fixture.id} invalid import`);
  const cause = result.diagnostics[0]?.cause;
  if (
    cause?.classification !== "INVALID_DTCG" ||
    typeof cause.code !== "string" ||
    typeof cause.pointer !== "string" ||
    (expected?.cause !== undefined && cause.code !== expected.cause) ||
    (expected?.causePointer !== undefined && cause.pointer !== expected.causePointer)
  ) {
    fail("BEHAVIOR_DRIFT", `${fixture.id} lost its exact invalid-DTCG classification.`);
  }
  return deepFreeze({
    id: fixture.id,
    fixtureCanonicalBytes: canonicalJsonBytes(fixture.document).byteLength,
    fixtureCanonicalSha256: fixtureCanonicalSha256(fixture).slice("sha256:".length),
    code: "DTCG_REJECTED",
    cause: cause.code,
    causePointer: cause.pointer,
    retainedExactSession: true,
    partialResult: false,
  });
}

function exercisePrototypeSafeExtends(runtime, initialSession, index) {
  const derived = PROTOTYPE_SAFE_EXTENDS_FIXTURE.document.derived;
  if (!Object.hasOwn(derived, "__proto__") || Object.getPrototypeOf(derived) !== Object.prototype) {
    fail("BEHAVIOR_DRIFT", "The prototype-safety fixture did not retain an own token key.");
  }
  const exercised = exerciseCompatibilityFixture(
    runtime,
    initialSession,
    PROTOTYPE_SAFE_EXTENDS_FIXTURE,
    index,
    {
      previewReadyUnderT02: false,
      disclosures: PROTOTYPE_SAFE_EXTENDS_FIXTURE.disclosures,
    },
  );
  return deepFreeze({
    ...exercised,
    ownPrototypeTokenKey: "__proto__",
    ownTokenPreserved: true,
    ordinaryObjectPrototypeUnchanged: true,
    admissionDidNotThrow: true,
  });
}

function sameJson(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function assertRetainedFailure(result, session, code, label) {
  if (
    result?.ok !== false ||
    result.session !== session ||
    result.diagnostics?.length !== 1 ||
    result.diagnostics[0]?.code !== code
  ) {
    fail("BEHAVIOR_DRIFT", `${label} did not fail atomically with ${code}.`);
  }
  assertDeepFrozen(result, label);
}

function authenticateLimits(runtime) {
  const limits = runtime.THEME_AUTHORING_LIMITS;
  if (!exactKeys(limits, AUTHORING_LIMIT_KEYS)) {
    fail("PUBLIC_API_DRIFT", "Theme authoring limits drifted from their closed field set.");
  }
  for (const name of AUTHORING_LIMIT_KEYS) {
    if (!Number.isSafeInteger(limits[name]) || limits[name] <= 0) {
      fail(
        "PUBLIC_API_DRIFT",
        "Every theme authoring limit must be a finite safe positive integer.",
      );
    }
  }
  if (
    limits.maxHistoryEntries !== 100 ||
    limits.maxIdentifierCodeUnits !== 128 ||
    limits.maxImportBytes !== 8_388_608 ||
    limits.maxLabelCodeUnits !== 512 ||
    limits.maxModesPerTheme !== 16 ||
    limits.maxThemes !== 16 ||
    limits.maxUnsupportedFeaturesPerOverlay !== 64
  ) {
    fail("PUBLIC_API_DRIFT", "Theme authoring limit values drifted.");
  }
  return Object.freeze(Object.fromEntries(AUTHORING_LIMIT_KEYS.map((key) => [key, limits[key]])));
}

function exerciseAuthoring(runtime, sc01Fixtures, sc01InvalidFixtures) {
  if (runtime.THEME_AUTHORING_KIND !== "desen.theme-authoring") {
    fail("PUBLIC_API_DRIFT", "Theme authoring kind drifted.");
  }
  if (runtime.THEME_AUTHORING_SCHEMA_VERSION !== 1) {
    fail("PUBLIC_API_DRIFT", "Theme authoring schema version drifted.");
  }
  const limits = authenticateLimits(runtime);
  assertDeepFrozen(runtime.DESEN_NEUTRAL_THEME_DOCUMENT, "DESEN Neutral document");

  const admission = call(
    runtime,
    "admitThemeAuthoringDocument",
    runtime.DESEN_NEUTRAL_THEME_DOCUMENT,
  );
  assertDeepFrozen(admission, "DESEN Neutral admission");
  const theme = admission?.ok === true ? admission.document?.themes?.[0] : undefined;
  if (
    admission?.ok !== true ||
    admission.diagnostics?.length !== 0 ||
    admission.report?.canonicalBytes !== 5_710 ||
    !isDeepStrictEqual(admission.report?.losses, []) ||
    !isDeepStrictEqual(admission.report?.preservedUnsupportedFeatures, []) ||
    admission.document?.kind !== "desen.theme-authoring" ||
    admission.document?.schemaVersion !== 1 ||
    admission.document?.themes?.length !== 1 ||
    theme?.id !== "desen-neutral" ||
    theme?.name !== "DESEN Neutral" ||
    theme?.base?.id !== "neutral.base" ||
    !isDeepStrictEqual(
      theme?.modes?.map((mode) => ({ id: mode.id, name: mode.name, sourceId: mode.source.id })),
      [
        { id: "light", name: "Light", sourceId: "neutral.light" },
        { id: "dark", name: "Dark", sourceId: "neutral.dark" },
      ],
    )
  ) {
    fail("BEHAVIOR_DRIFT", "DESEN Neutral admission drifted.");
  }

  const created = call(
    runtime,
    "createThemeAuthoringSession",
    runtime.DESEN_NEUTRAL_THEME_DOCUMENT,
  );
  const initial = expectSuccess(created, "Neutral session creation");
  const expectedTokenPaths = [
    "color.action",
    "color.border",
    "color.canvas",
    "color.caution",
    "color.danger",
    "color.disabled",
    "color.elevated",
    "color.focus",
    "color.foreground",
    "color.muted",
    "color.onAction",
    "color.positive",
    "color.surface",
    "elevation.card",
    "opacity.disabled",
    "palette.action",
    "palette.border",
    "palette.canvas",
    "palette.caution",
    "palette.danger",
    "palette.disabled",
    "palette.elevated",
    "palette.focus",
    "palette.foreground",
    "palette.muted",
    "palette.onAction",
    "palette.positive",
    "palette.surface",
    "radius.large",
    "radius.medium",
    "radius.small",
    "space.1",
    "space.12",
    "space.2",
    "space.3",
    "space.4",
    "space.6",
    "space.8",
    "stroke.default",
    "stroke.focus",
    "typography.body",
    "typography.display",
    "typography.label",
    "typography.subtitle",
    "typography.title",
  ];
  if (
    initial.kind !== "desen.theme-authoring-session" ||
    initial.revision !== 0 ||
    !isDeepStrictEqual(initial.selection, { modeId: "light", themeId: "desen-neutral" }) ||
    initial.preview?.ok !== true ||
    !isDeepStrictEqual(initial.preview.sourceIds, ["neutral.base", "neutral.light"]) ||
    !isDeepStrictEqual(initial.preview.tokenPaths, expectedTokenPaths) ||
    initial.preview.controls?.length !== 45 ||
    initial.past?.length !== 0 ||
    initial.future?.length !== 0
  ) {
    fail("BEHAVIOR_DRIFT", "Initial Neutral live preview drifted.");
  }
  const lightCanvas = tokenValue(initial, "color.canvas");
  const lightAction = tokenValue(initial, "color.action");

  const selectedDark = call(runtime, "selectThemeAuthoringMode", initial, {
    modeId: "dark",
    themeId: "desen-neutral",
  });
  const dark = expectSuccess(selectedDark, "Dark-mode selection");
  const darkCanvas = tokenValue(dark, "color.canvas");
  if (
    selectedDark.changed !== true ||
    dark.revision !== 1 ||
    dark.selection.modeId !== "dark" ||
    !isDeepStrictEqual(dark.preview.sourceIds, ["neutral.base", "neutral.dark"]) ||
    dark.past.length !== 0 ||
    dark.future.length !== 0 ||
    isDeepStrictEqual(lightCanvas, darkCanvas) ||
    initial.selection.modeId !== "light"
  ) {
    fail("BEHAVIOR_DRIFT", "Explicit light/dark mode selection drifted.");
  }
  const neutralAccessibility = Object.freeze([
    neutralAccessibilityReceipt(initial),
    neutralAccessibilityReceipt(dark),
  ]);

  const customColor = Object.freeze({
    alpha: 0.75,
    colorSpace: "srgb",
    components: Object.freeze([0.125, 0.625, 0.875]),
  });
  const colorEdit = call(runtime, "applyThemeAuthoringEdit", initial, {
    kind: "set-literal",
    path: "palette.action",
    sourceId: "neutral.light",
    themeId: "desen-neutral",
    type: "color",
    value: customColor,
  });
  const colored = expectSuccess(colorEdit, "Arbitrary color edit");
  if (
    colorEdit.changed !== true ||
    colored.revision !== 1 ||
    colored.past.length !== 1 ||
    !sameJson(tokenValue(colored, "color.action"), customColor) ||
    !sameJson(tokenValue(colored, "palette.action"), customColor)
  ) {
    fail("BEHAVIOR_DRIFT", "Arbitrary color edit did not reach live alias-aware preview.");
  }

  const undoneResult = call(runtime, "undoThemeAuthoringEdit", colored);
  const undone = expectSuccess(undoneResult, "Undo");
  if (
    undoneResult.changed !== true ||
    undone.revision !== 2 ||
    undone.document !== initial.document ||
    undone.future.length !== 1 ||
    !isDeepStrictEqual(tokenValue(undone, "color.action"), lightAction)
  ) {
    fail("BEHAVIOR_DRIFT", "Undo did not restore the exact preceding document.");
  }
  const redoneResult = call(runtime, "redoThemeAuthoringEdit", undone);
  const redone = expectSuccess(redoneResult, "Redo");
  if (
    redoneResult.changed !== true ||
    redone.revision !== 3 ||
    redone.document !== colored.document ||
    redone.future.length !== 0 ||
    !sameJson(tokenValue(redone, "color.action"), customColor)
  ) {
    fail("BEHAVIOR_DRIFT", "Redo did not restore the exact undone document.");
  }

  const customTypography = deepFreeze({
    fontFamily: ["Avenir Next", "ui-sans-serif"],
    fontSize: { unit: "px", value: 19 },
    fontWeight: 575,
    letterSpacing: { unit: "px", value: 0.25 },
    lineHeight: 1.45,
  });
  const typographyResult = call(runtime, "applyThemeAuthoringEdit", redone, {
    kind: "set-literal",
    path: "typography.body",
    sourceId: "neutral.base",
    themeId: "desen-neutral",
    type: "typography",
    value: customTypography,
  });
  const typed = expectSuccess(typographyResult, "Composite typography edit");
  if (
    typographyResult.changed !== true ||
    typed.revision !== 4 ||
    !sameJson(tokenValue(typed, "typography.body"), customTypography)
  ) {
    fail("BEHAVIOR_DRIFT", "Composite typography edit was not one atomic transition.");
  }

  const aliasResult = call(runtime, "applyThemeAuthoringEdit", typed, {
    kind: "set-alias",
    path: "color.action",
    sourceId: "neutral.base",
    targetPath: "palette.focus",
    themeId: "desen-neutral",
    type: "color",
  });
  const aliased = expectSuccess(aliasResult, "Whole-token alias edit");
  const aliasControl = aliased.preview.controls.find(
    ({ path: tokenPath }) => tokenPath === "color.action",
  );
  if (
    aliasResult.changed !== true ||
    aliased.revision !== 5 ||
    aliasControl?.kind !== "alias" ||
    aliasControl.aliasTarget !== "palette.focus" ||
    !isDeepStrictEqual(tokenValue(aliased, "color.action"), tokenValue(aliased, "palette.focus"))
  ) {
    fail("BEHAVIOR_DRIFT", "Whole-token alias edit drifted.");
  }

  const structuralLiteralValue = Object.freeze({
    colorSpace: "srgb",
    components: Object.freeze([0.2, 0.4, 0.8]),
  });
  const createdLiteralResult = call(runtime, "applyThemeAuthoringEdit", initial, {
    kind: "create-literal",
    path: "palette.brand",
    sourceId: "neutral.base",
    themeId: "desen-neutral",
    type: "color",
    value: structuralLiteralValue,
  });
  const createdLiteral = expectSuccess(createdLiteralResult, "Literal-token creation");
  if (
    createdLiteralResult.changed !== true ||
    createdLiteral.revision !== 1 ||
    !sameJson(tokenValue(createdLiteral, "palette.brand"), structuralLiteralValue)
  ) {
    fail("BEHAVIOR_DRIFT", "Literal-token creation drifted.");
  }
  const createdAliasResult = call(runtime, "applyThemeAuthoringEdit", createdLiteral, {
    kind: "create-alias",
    path: "color.brand",
    sourceId: "neutral.base",
    targetPath: "palette.brand",
    themeId: "desen-neutral",
    type: "color",
  });
  const createdAlias = expectSuccess(createdAliasResult, "Alias-token creation");
  if (
    createdAliasResult.changed !== true ||
    createdAlias.revision !== 2 ||
    !sameJson(tokenValue(createdAlias, "color.brand"), structuralLiteralValue)
  ) {
    fail("BEHAVIOR_DRIFT", "Alias-token creation drifted.");
  }
  const deletedTokenResult = call(runtime, "applyThemeAuthoringEdit", createdAlias, {
    kind: "delete-token",
    path: "color.brand",
    sourceId: "neutral.base",
    themeId: "desen-neutral",
  });
  const deletedToken = expectSuccess(deletedTokenResult, "Token deletion");
  if (
    deletedTokenResult.changed !== true ||
    deletedToken.revision !== 3 ||
    deletedToken.preview.controls.some(({ path: tokenPath }) => tokenPath === "color.brand") ||
    !sameJson(tokenValue(deletedToken, "palette.brand"), structuralLiteralValue)
  ) {
    fail("BEHAVIOR_DRIFT", "Token deletion drifted.");
  }

  const duplicatedModeResult = call(runtime, "applyThemeAuthoringEdit", deletedToken, {
    fromModeId: "light",
    kind: "duplicate-mode",
    modeId: "contrast",
    name: "High contrast",
    themeId: "desen-neutral",
  });
  const duplicatedMode = expectSuccess(duplicatedModeResult, "Mode duplication");
  if (
    duplicatedModeResult.changed !== true ||
    duplicatedMode.revision !== 4 ||
    !isDeepStrictEqual(duplicatedMode.selection, {
      modeId: "contrast",
      themeId: "desen-neutral",
    }) ||
    duplicatedMode.document.themes[0]?.modes?.length !== 3
  ) {
    fail("BEHAVIOR_DRIFT", "Mode duplication or selection drifted.");
  }
  const modeUndoResult = call(runtime, "undoThemeAuthoringEdit", duplicatedMode);
  const modeUndone = expectSuccess(modeUndoResult, "Structural mode undo");
  if (
    modeUndoResult.changed !== true ||
    modeUndone.revision !== 5 ||
    modeUndone.document !== deletedToken.document ||
    !isDeepStrictEqual(modeUndone.selection, { modeId: "light", themeId: "desen-neutral" })
  ) {
    fail("BEHAVIOR_DRIFT", "Mode undo did not restore its exact document and selection.");
  }
  const modeRedoResult = call(runtime, "redoThemeAuthoringEdit", modeUndone);
  const modeRedone = expectSuccess(modeRedoResult, "Structural mode redo");
  if (
    modeRedoResult.changed !== true ||
    modeRedone.revision !== 6 ||
    modeRedone.document !== duplicatedMode.document ||
    !isDeepStrictEqual(modeRedone.selection, {
      modeId: "contrast",
      themeId: "desen-neutral",
    })
  ) {
    fail("BEHAVIOR_DRIFT", "Mode redo did not restore its exact document and selection.");
  }
  const renamedModeResult = call(runtime, "applyThemeAuthoringEdit", modeRedone, {
    kind: "rename-mode",
    modeId: "contrast",
    name: "Accessible contrast",
    themeId: "desen-neutral",
  });
  const renamedMode = expectSuccess(renamedModeResult, "Mode rename");
  if (
    renamedModeResult.changed !== true ||
    renamedMode.revision !== 7 ||
    renamedMode.document.themes[0]?.modes?.[2]?.name !== "Accessible contrast"
  ) {
    fail("BEHAVIOR_DRIFT", "Mode rename drifted.");
  }
  const deletedModeResult = call(runtime, "applyThemeAuthoringEdit", renamedMode, {
    kind: "delete-mode",
    modeId: "contrast",
    themeId: "desen-neutral",
  });
  const deletedMode = expectSuccess(deletedModeResult, "Mode deletion");
  if (
    deletedModeResult.changed !== true ||
    deletedMode.revision !== 8 ||
    deletedMode.document.themes[0]?.modes?.length !== 2 ||
    !isDeepStrictEqual(deletedMode.selection, { modeId: "light", themeId: "desen-neutral" })
  ) {
    fail("BEHAVIOR_DRIFT", "Mode deletion or fallback selection drifted.");
  }

  const duplicatedThemeResult = call(runtime, "applyThemeAuthoringEdit", deletedMode, {
    fromThemeId: "desen-neutral",
    kind: "duplicate-theme",
    name: "Brand system",
    themeId: "brand",
  });
  const duplicatedTheme = expectSuccess(duplicatedThemeResult, "Theme duplication");
  if (
    duplicatedThemeResult.changed !== true ||
    duplicatedTheme.revision !== 9 ||
    !isDeepStrictEqual(duplicatedTheme.selection, { modeId: "light", themeId: "brand" }) ||
    duplicatedTheme.document.themes?.length !== 2 ||
    duplicatedTheme.document.themes[1]?.base?.id !== "brand:base-source"
  ) {
    fail("BEHAVIOR_DRIFT", "Theme duplication or selection drifted.");
  }
  const themeUndoResult = call(runtime, "undoThemeAuthoringEdit", duplicatedTheme);
  const themeUndone = expectSuccess(themeUndoResult, "Structural theme undo");
  if (
    themeUndoResult.changed !== true ||
    themeUndone.revision !== 10 ||
    themeUndone.document !== deletedMode.document ||
    !isDeepStrictEqual(themeUndone.selection, { modeId: "light", themeId: "desen-neutral" })
  ) {
    fail("BEHAVIOR_DRIFT", "Theme undo did not restore its exact document and selection.");
  }
  const themeRedoResult = call(runtime, "redoThemeAuthoringEdit", themeUndone);
  const themeRedone = expectSuccess(themeRedoResult, "Structural theme redo");
  if (
    themeRedoResult.changed !== true ||
    themeRedone.revision !== 11 ||
    themeRedone.document !== duplicatedTheme.document ||
    !isDeepStrictEqual(themeRedone.selection, { modeId: "light", themeId: "brand" })
  ) {
    fail("BEHAVIOR_DRIFT", "Theme redo did not restore its exact document and selection.");
  }
  const renamedThemeResult = call(runtime, "applyThemeAuthoringEdit", themeRedone, {
    kind: "rename-theme",
    name: "Brand foundations",
    themeId: "brand",
  });
  const renamedTheme = expectSuccess(renamedThemeResult, "Theme rename");
  if (
    renamedThemeResult.changed !== true ||
    renamedTheme.revision !== 12 ||
    renamedTheme.document.themes[1]?.name !== "Brand foundations"
  ) {
    fail("BEHAVIOR_DRIFT", "Theme rename drifted.");
  }
  const deletedThemeResult = call(runtime, "applyThemeAuthoringEdit", renamedTheme, {
    kind: "delete-theme",
    themeId: "desen-neutral",
  });
  const deletedTheme = expectSuccess(deletedThemeResult, "Theme deletion");
  if (
    deletedThemeResult.changed !== true ||
    deletedTheme.revision !== 13 ||
    deletedTheme.document.themes?.length !== 1 ||
    deletedTheme.document.themes[0]?.id !== "brand" ||
    deletedTheme.document.themes[0]?.name !== "Brand foundations" ||
    !isDeepStrictEqual(deletedTheme.selection, { modeId: "light", themeId: "brand" })
  ) {
    fail("BEHAVIOR_DRIFT", "Theme deletion or retained selection drifted.");
  }

  const exported = call(runtime, "exportThemeAuthoringDocument", aliased);
  if (
    typeof exported?.text !== "string" ||
    exported.text.endsWith("\n") ||
    Buffer.byteLength(exported.text, "utf8") !== 5_747 ||
    exported.report?.canonicalBytes !== 5_747 ||
    !isDeepStrictEqual(exported.report?.losses, []) ||
    !isDeepStrictEqual(exported.report?.preservedUnsupportedFeatures, [])
  ) {
    fail("BEHAVIOR_DRIFT", "Canonical lossless export drifted.");
  }
  const importedResult = call(runtime, "importThemeAuthoringDocument", initial, exported.text);
  const imported = expectSuccess(importedResult, "Export reimport");
  const reexported = call(runtime, "exportThemeAuthoringDocument", imported);
  if (
    importedResult.changed !== true ||
    imported.revision !== 1 ||
    reexported?.text !== exported.text ||
    !isDeepStrictEqual(reexported?.report, exported.report)
  ) {
    fail("BEHAVIOR_DRIFT", "Export/reimport did not reproduce exact canonical bytes.");
  }

  const invalidMatrix = [];
  for (const [id, input, code] of [
    ["malformed-json", "{", "IMPORT_JSON_INVALID"],
    [
      "duplicate-key-json",
      '{"kind":"desen.theme-authoring","kind":"desen.theme-authoring"}',
      "IMPORT_JSON_INVALID",
    ],
  ]) {
    const result = call(runtime, "importThemeAuthoringDocument", aliased, input);
    assertRetainedFailure(result, aliased, code, id);
    invalidMatrix.push(Object.freeze({ id, code, retainedExactSession: true }));
  }
  const invalidDocument = JSON.parse(exported.text);
  invalidDocument.themes[0].base.document.color.action = {
    $type: "color",
    $value: "{palette.missing}",
  };
  const invalidAliasImport = call(
    runtime,
    "importThemeAuthoringDocument",
    aliased,
    JSON.stringify(invalidDocument),
  );
  assertRetainedFailure(invalidAliasImport, aliased, "DTCG_REJECTED", "Missing-alias import");
  invalidMatrix.push(
    Object.freeze({
      id: "missing-alias-import",
      code: "DTCG_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      retainedExactSession: true,
    }),
  );
  if (invalidAliasImport.diagnostics[0]?.cause?.code !== "ALIAS_TARGET_MISSING") {
    fail("BEHAVIOR_DRIFT", "Invalid import omitted its DTCG alias cause.");
  }

  const brokenEdit = call(runtime, "applyThemeAuthoringEdit", aliased, {
    kind: "set-alias",
    path: "color.action",
    sourceId: "neutral.base",
    targetPath: "palette.missing",
    themeId: "desen-neutral",
    type: "color",
  });
  assertRetainedFailure(brokenEdit, aliased, "TOKEN_EDIT_REJECTED", "Broken alias edit");
  if (brokenEdit.diagnostics[0]?.cause?.code !== "ALIAS_TARGET_MISSING") {
    fail("BEHAVIOR_DRIFT", "Rejected alias edit omitted its DTCG cause.");
  }
  invalidMatrix.push(
    Object.freeze({
      id: "missing-alias-edit",
      code: "TOKEN_EDIT_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      retainedExactSession: true,
    }),
  );

  const hiddenModeDocument = cloneJson(runtime.DESEN_NEUTRAL_THEME_DOCUMENT);
  hiddenModeDocument.themes[0].modes[0].source.document.palette.lightOnly = {
    $value: { colorSpace: "srgb", components: [0.2, 0.3, 0.4] },
  };
  const hiddenModeCreated = call(runtime, "createThemeAuthoringSession", hiddenModeDocument);
  const hiddenModeSession = expectSuccess(hiddenModeCreated, "Hidden-mode alias fixture");
  const hiddenModeFailure = call(runtime, "applyThemeAuthoringEdit", hiddenModeSession, {
    kind: "set-alias",
    path: "color.action",
    sourceId: "neutral.base",
    targetPath: "palette.lightOnly",
    themeId: "desen-neutral",
    type: "color",
  });
  assertRetainedFailure(
    hiddenModeFailure,
    hiddenModeSession,
    "TOKEN_EDIT_REJECTED",
    "Hidden-mode alias edit",
  );
  if (hiddenModeFailure.diagnostics[0]?.cause?.code !== "ALIAS_TARGET_MISSING") {
    fail("BEHAVIOR_DRIFT", "A base alias was not checked against the unselected dark mode.");
  }
  invalidMatrix.push(
    Object.freeze({
      id: "hidden-mode-missing-alias-edit",
      code: "TOKEN_EDIT_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      retainedExactSession: true,
      allModesChecked: true,
    }),
  );

  let getterInvocations = 0;
  const executable = Object.defineProperty({}, "kind", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return "desen.theme-authoring";
    },
  });
  const unsafeAdmission = call(runtime, "admitThemeAuthoringDocument", executable);
  if (
    unsafeAdmission?.ok !== false ||
    unsafeAdmission.diagnostics?.[0]?.code !== "UNSAFE_THEME_VALUE" ||
    getterInvocations !== 0
  ) {
    fail("BEHAVIOR_DRIFT", "Unsafe accessor admission was not inert and fail-closed.");
  }
  invalidMatrix.push(
    Object.freeze({
      id: "unsafe-accessor",
      code: "UNSAFE_THEME_VALUE",
      getterInvoked: false,
      partialResult: false,
    }),
  );

  const unsupportedDocument = cloneJson(runtime.DESEN_NEUTRAL_THEME_DOCUMENT);
  unsupportedDocument.themes[0].modes[1].source.document.palette.focus.$value.colorSpace =
    "display-p3";
  const unsupportedAdmission = call(runtime, "admitThemeAuthoringDocument", unsupportedDocument);
  const unsupportedFeature = unsupportedAdmission?.report?.preservedUnsupportedFeatures?.[0];
  if (
    unsupportedAdmission?.ok !== true ||
    unsupportedAdmission.report.losses?.length !== 0 ||
    unsupportedAdmission.report.preservedUnsupportedFeatures?.length !== 1 ||
    unsupportedFeature?.preserved !== true ||
    unsupportedFeature?.themeId !== "desen-neutral" ||
    unsupportedFeature?.modeId !== "dark" ||
    unsupportedFeature?.sourceId !== "neutral.dark" ||
    unsupportedFeature?.diagnostic?.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
    unsupportedFeature?.diagnostic?.code !== "UNSUPPORTED_COLOR_SPACE"
  ) {
    fail("BEHAVIOR_DRIFT", "Unsupported standard data was not preserved and disclosed exactly.");
  }
  const mixedInvalidDocument = cloneJson(unsupportedDocument);
  mixedInvalidDocument.themes[0].modes[1].source.document.zzBroken = {
    $type: "color",
    $value: "{palette.missing}",
  };
  const mixedInvalidAdmission = call(runtime, "admitThemeAuthoringDocument", mixedInvalidDocument);
  assertDeepFrozen(mixedInvalidAdmission, "Mixed unsupported and invalid admission");
  if (
    mixedInvalidAdmission?.ok !== false ||
    mixedInvalidAdmission.diagnostics?.length !== 1 ||
    mixedInvalidAdmission.diagnostics[0]?.code !== "DTCG_REJECTED" ||
    mixedInvalidAdmission.diagnostics[0]?.cause?.classification !== "INVALID_DTCG" ||
    mixedInvalidAdmission.diagnostics[0]?.cause?.code !== "ALIAS_TARGET_MISSING"
  ) {
    fail("BEHAVIOR_DRIFT", "Unsupported data masked a later invalid token member.");
  }
  invalidMatrix.push(
    Object.freeze({
      id: "unsupported-does-not-mask-invalid",
      code: "DTCG_REJECTED",
      cause: "ALIAS_TARGET_MISSING",
      partialResult: false,
      unsupportedMaskedInvalid: false,
    }),
  );
  const unsupportedCreated = call(
    runtime,
    "createThemeAuthoringSession",
    unsupportedAdmission.document,
  );
  const unsupportedLight = expectSuccess(unsupportedCreated, "Unsupported-data session");
  const unsupportedDarkResult = call(runtime, "selectThemeAuthoringMode", unsupportedLight, {
    modeId: "dark",
    themeId: "desen-neutral",
  });
  const unsupportedDark = expectSuccess(unsupportedDarkResult, "Unsupported dark selection");
  const unsupportedExport = call(runtime, "exportThemeAuthoringDocument", unsupportedDark);
  if (
    unsupportedLight.preview?.ok !== true ||
    unsupportedDark.preview?.ok !== false ||
    unsupportedDark.preview?.diagnostics?.[0]?.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
    !unsupportedExport?.text?.includes('"display-p3"') ||
    unsupportedExport.report?.losses?.length !== 0 ||
    unsupportedExport.report?.preservedUnsupportedFeatures?.length !== 1
  ) {
    fail("BEHAVIOR_DRIFT", "Unsupported data acquired partial preview authority or was lost.");
  }

  const wideGamutNoneDocument = cloneJson(runtime.DESEN_NEUTRAL_THEME_DOCUMENT);
  wideGamutNoneDocument.themes[0].modes[1].source.document.wideWithNone = {
    $type: "color",
    $value: { colorSpace: "display-p3", components: ["none", 0.5, "none"] },
  };
  const wideGamutNoneAdmission = call(
    runtime,
    "admitThemeAuthoringDocument",
    wideGamutNoneDocument,
  );
  const noneFeatures = wideGamutNoneAdmission?.report?.preservedUnsupportedFeatures;
  if (
    wideGamutNoneAdmission?.ok !== true ||
    wideGamutNoneAdmission.report.losses?.length !== 0 ||
    noneFeatures?.length !== 3 ||
    !isDeepStrictEqual(
      noneFeatures.map(({ diagnostic }) => ({
        classification: diagnostic.classification,
        code: diagnostic.code,
        pointer: diagnostic.pointer,
        tokenPath: diagnostic.tokenPath,
      })),
      [
        {
          classification: "UNSUPPORTED_DTCG_FEATURE",
          code: "UNSUPPORTED_COLOR_SPACE",
          pointer: "/wideWithNone/$value/colorSpace",
          tokenPath: "wideWithNone",
        },
        {
          classification: "UNSUPPORTED_DTCG_FEATURE",
          code: "UNSUPPORTED_DTCG_MEMBER",
          pointer: "/wideWithNone/$value/components/0",
          tokenPath: "wideWithNone",
        },
        {
          classification: "UNSUPPORTED_DTCG_FEATURE",
          code: "UNSUPPORTED_DTCG_MEMBER",
          pointer: "/wideWithNone/$value/components/2",
          tokenPath: "wideWithNone",
        },
      ],
    )
  ) {
    fail("BEHAVIOR_DRIFT", "The reviewed wide-gamut/none-color matrix drifted.");
  }
  const wideGamutNoneCreated = call(
    runtime,
    "createThemeAuthoringSession",
    wideGamutNoneAdmission.document,
  );
  const wideGamutNoneLight = expectSuccess(wideGamutNoneCreated, "Wide-gamut/none-color session");
  const wideGamutNoneDarkResult = call(runtime, "selectThemeAuthoringMode", wideGamutNoneLight, {
    modeId: "dark",
    themeId: "desen-neutral",
  });
  const wideGamutNoneDark = expectSuccess(
    wideGamutNoneDarkResult,
    "Wide-gamut/none-color dark selection",
  );
  const wideGamutNoneExport = call(runtime, "exportThemeAuthoringDocument", wideGamutNoneDark);
  const wideGamutNoneReimportResult = call(
    runtime,
    "importThemeAuthoringDocument",
    initial,
    wideGamutNoneExport?.text,
  );
  const wideGamutNoneReimport = expectSuccess(
    wideGamutNoneReimportResult,
    "Wide-gamut/none-color reimport",
  );
  if (
    wideGamutNoneDark.preview?.ok !== false ||
    wideGamutNoneDark.preview?.diagnostics?.[0]?.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
    !wideGamutNoneExport?.text?.includes('"components":["none",0.5,"none"]') ||
    wideGamutNoneExport.report?.losses?.length !== 0 ||
    wideGamutNoneExport.report?.preservedUnsupportedFeatures?.length !== 3 ||
    call(runtime, "exportThemeAuthoringDocument", wideGamutNoneReimport)?.text !==
      wideGamutNoneExport.text
  ) {
    fail(
      "BEHAVIOR_DRIFT",
      "The reviewed wide-gamut/none-color matrix was lost or acquired preview authority.",
    );
  }

  const officialRootDocument = cloneJson(runtime.DESEN_NEUTRAL_THEME_DOCUMENT);
  officialRootDocument.themes[0].modes[1].source.document.futureGroup = {
    $root: { $type: "number", $value: 1 },
  };
  officialRootDocument.themes[0].modes[1].source.document.futureRootAlias = {
    $type: "number",
    $value: "{futureGroup.$root}",
  };
  const officialRootAdmission = call(runtime, "admitThemeAuthoringDocument", officialRootDocument);
  const officialRootFeature = officialRootAdmission?.report?.preservedUnsupportedFeatures?.[0];
  if (
    officialRootAdmission?.ok !== true ||
    officialRootAdmission.report.losses?.length !== 0 ||
    officialRootAdmission.report.preservedUnsupportedFeatures?.length !== 1 ||
    officialRootFeature?.diagnostic?.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
    officialRootFeature?.diagnostic?.code !== "UNSUPPORTED_DTCG_MEMBER" ||
    officialRootFeature?.diagnostic?.pointer !== "/futureGroup/$root" ||
    officialRootFeature?.diagnostic?.tokenPath !== "futureGroup.$root"
  ) {
    fail("BEHAVIOR_DRIFT", "The reviewed official-$root matrix drifted.");
  }
  const officialRootCreated = call(
    runtime,
    "createThemeAuthoringSession",
    officialRootAdmission.document,
  );
  const officialRootLight = expectSuccess(officialRootCreated, "Official-$root session");
  const officialRootDarkResult = call(runtime, "selectThemeAuthoringMode", officialRootLight, {
    modeId: "dark",
    themeId: "desen-neutral",
  });
  const officialRootDark = expectSuccess(officialRootDarkResult, "Official-$root dark selection");
  const officialRootExport = call(runtime, "exportThemeAuthoringDocument", officialRootDark);
  const officialRootReimportResult = call(
    runtime,
    "importThemeAuthoringDocument",
    initial,
    officialRootExport?.text,
  );
  const officialRootReimport = expectSuccess(officialRootReimportResult, "Official-$root reimport");
  if (
    officialRootDark.preview?.ok !== false ||
    officialRootDark.preview?.diagnostics?.[0]?.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
    !officialRootExport?.text?.includes('"$value":"{futureGroup.$root}"') ||
    !officialRootExport?.text?.includes('"$root"') ||
    officialRootExport.report?.losses?.length !== 0 ||
    officialRootExport.report?.preservedUnsupportedFeatures?.length !== 1 ||
    call(runtime, "exportThemeAuthoringDocument", officialRootReimport)?.text !==
      officialRootExport.text
  ) {
    fail(
      "BEHAVIOR_DRIFT",
      "The reviewed official-$root matrix was lost or acquired preview authority.",
    );
  }

  const sc01CompatibilityMatrix = sc01Fixtures.map((fixture, index) => {
    const expected = SC01_EXPECTED_DISCLOSURES[index];
    if (expected?.id !== fixture.id) {
      fail("BEHAVIOR_DRIFT", "The frozen SC-01 disclosure inventory drifted.");
    }
    return exerciseCompatibilityFixture(runtime, initial, fixture, index, {
      previewReadyUnderT02: SC01_T02_PREVIEW_READY_FIXTURE_IDS.includes(fixture.id),
      disclosures: expected.disclosures,
    });
  });
  const sc01InvalidMatrix = sc01InvalidFixtures.map((fixture, index) => {
    const expected = SC01_EXPECTED_INVALID_DIAGNOSTICS[index];
    if (expected?.id !== fixture.id) {
      fail("BEHAVIOR_DRIFT", "The frozen SC-01 invalid-diagnostic inventory drifted.");
    }
    return exerciseInvalidCompatibilityFixture(runtime, initial, fixture, index, expected);
  });
  const t02RecognizedUnsupportedMatrix = T02_RECOGNIZED_UNSUPPORTED_FIXTURES.map((fixture, index) =>
    exerciseCompatibilityFixture(runtime, initial, fixture, sc01Fixtures.length + index, {
      previewReadyUnderT02: false,
      disclosures: fixture.disclosures,
    }),
  );
  const prototypeSafeGroupInheritance = exercisePrototypeSafeExtends(
    runtime,
    initial,
    sc01Fixtures.length + T02_RECOGNIZED_UNSUPPORTED_FIXTURES.length,
  );
  const shadowInsetCompatibility = exerciseCompatibilityFixture(
    runtime,
    initial,
    SHADOW_INSET_FIXTURE,
    sc01Fixtures.length + T02_RECOGNIZED_UNSUPPORTED_FIXTURES.length + 1,
    {
      previewReadyUnderT02: false,
      disclosures: SHADOW_INSET_FIXTURE.disclosures,
    },
  );
  const t02RecognizedMalformedMatrix = T02_RECOGNIZED_MALFORMED_FIXTURES.map((fixture, index) =>
    exerciseInvalidCompatibilityFixture(
      runtime,
      initial,
      fixture,
      sc01InvalidFixtures.length + index,
      fixture,
    ),
  );
  const resolverMalformedMatrix = RESOLVER_MALFORMED_FIXTURES.map((fixture, index) =>
    exerciseInvalidCompatibilityFixture(
      runtime,
      initial,
      fixture,
      sc01InvalidFixtures.length + T02_RECOGNIZED_MALFORMED_FIXTURES.length + index,
      fixture,
    ),
  );
  const shadowMalformedMatrix = SHADOW_MALFORMED_FIXTURES.map((fixture, index) =>
    exerciseInvalidCompatibilityFixture(
      runtime,
      initial,
      fixture,
      sc01InvalidFixtures.length +
        T02_RECOGNIZED_MALFORMED_FIXTURES.length +
        RESOLVER_MALFORMED_FIXTURES.length +
        index,
      fixture,
    ),
  );
  const sc01PreviewReadyUnderT02 = sc01CompatibilityMatrix.filter(
    ({ currentAuthoringStatus }) => currentAuthoringStatus === "T02_PREVIEW_READY",
  ).length;
  const sc01PreservedUnsupported = sc01CompatibilityMatrix.filter(
    ({ currentAuthoringStatus }) => currentAuthoringStatus === "PRESERVED_UNSUPPORTED",
  ).length;
  const sc01HistoricalFeaturesSupportedByT02 = sc01CompatibilityMatrix.filter(
    ({ historicalFeatureStatus }) => historicalFeatureStatus === "SUPPORTED_BY_T02",
  ).length;
  const sc01HistoricalFeaturesStillUnsupported = sc01CompatibilityMatrix.filter(
    ({ historicalFeatureStatus }) => historicalFeatureStatus === "STILL_UNSUPPORTED_BY_T02",
  ).length;
  if (
    sc01CompatibilityMatrix.length !== 16 ||
    sc01PreviewReadyUnderT02 !== 3 ||
    sc01PreservedUnsupported !== 13 ||
    sc01HistoricalFeaturesSupportedByT02 !== 7 ||
    sc01HistoricalFeaturesStillUnsupported !== 9 ||
    sc01InvalidMatrix.length !== 7 ||
    t02RecognizedUnsupportedMatrix.length !== 6 ||
    t02RecognizedMalformedMatrix.length !== 10 ||
    resolverMalformedMatrix.length !== 8 ||
    shadowMalformedMatrix.length !== 3
  ) {
    fail("BEHAVIOR_DRIFT", "A closed DTCG compatibility classification count drifted.");
  }

  return deepFreeze({
    kind: runtime.THEME_AUTHORING_KIND,
    schemaVersion: runtime.THEME_AUTHORING_SCHEMA_VERSION,
    limits,
    neutral: {
      id: theme.id,
      name: theme.name,
      baseSourceId: theme.base.id,
      modes: theme.modes.map((mode) => ({
        id: mode.id,
        name: mode.name,
        sourceId: mode.source.id,
      })),
      canonicalBytes: admission.report.canonicalBytes,
      tokenCount: expectedTokenPaths.length,
      tokenPaths: expectedTokenPaths,
      defaultSelection: initial.selection,
      lightSourceIds: initial.preview.sourceIds,
      darkSourceIds: dark.preview.sourceIds,
      lightCanvas,
      darkCanvas,
      recursivelyImmutable: true,
      accessibility: {
        modes: neutralAccessibility,
        browserVisibleFocusOutlinePx: 2,
        everyModePassed: true,
      },
    },
    editing: {
      arbitraryColor: customColor,
      aliasAwareLivePreview: true,
      compositeTypography: customTypography,
      wholeTokenAliasTarget: aliasControl.aliasTarget,
      revisionAfterEdits: aliased.revision,
      undoRestoresExactDocument: true,
      redoRestoresExactDocument: true,
      historyLimit: limits.maxHistoryEntries,
      structuredAuthoring: {
        createdLiteralPath: "palette.brand",
        createdAliasPath: "color.brand",
        deletedTokenPath: "color.brand",
        duplicatedModeSelection: duplicatedMode.selection,
        modeUndoSelection: modeUndone.selection,
        modeRedoSelection: modeRedone.selection,
        renamedMode: "Accessible contrast",
        modeDeleteSelection: deletedMode.selection,
        duplicatedThemeSelection: duplicatedTheme.selection,
        themeUndoSelection: themeUndone.selection,
        themeRedoSelection: themeRedone.selection,
        renamedTheme: "Brand foundations",
        themeDeleteSelection: deletedTheme.selection,
        modeUndoRestoresExactDocument: true,
        modeRedoRestoresExactDocument: true,
        themeUndoRestoresExactDocument: true,
        themeRedoRestoresExactDocument: true,
        finalRevision: deletedTheme.revision,
      },
    },
    transfer: {
      canonicalBytes: exported.report.canonicalBytes,
      canonicalSha256: sha256(Buffer.from(exported.text, "utf8")),
      canonicalTerminalNewline: false,
      deterministicReimport: true,
      losses: 0,
      reviewedUnsupportedMatrix: {
        representativeModeOverlay: {
          wideGamutColor: {
            classification: unsupportedFeature.diagnostic.classification,
            code: unsupportedFeature.diagnostic.code,
            preserved: true,
            partialPreviewAuthority: false,
          },
          wideGamutNoneColor: {
            preservedFeatureCodes: noneFeatures.map(({ diagnostic }) => diagnostic.code),
            preservedFeaturePointers: noneFeatures.map(({ diagnostic }) => diagnostic.pointer),
            exactReimport: true,
            partialPreviewAuthority: false,
          },
          officialRoot: {
            preservedFeatureCode: officialRootFeature.diagnostic.code,
            pointer: officialRootFeature.diagnostic.pointer,
            tokenPath: officialRootFeature.diagnostic.tokenPath,
            aliasTarget: "futureGroup.$root",
            exactReimport: true,
            partialPreviewAuthority: false,
          },
        },
        frozenSc01: {
          featureFamilies: 14,
          validFixtures: 16,
          historicalFeaturesSupportedByT02: sc01HistoricalFeaturesSupportedByT02,
          historicalFeaturesStillUnsupported: sc01HistoricalFeaturesStillUnsupported,
          previewReadyUnderT02: sc01PreviewReadyUnderT02,
          preservedUnsupported: sc01PreservedUnsupported,
          invalidFixtures: 7,
          fixtures: sc01CompatibilityMatrix,
          invalid: sc01InvalidMatrix,
          everyFixtureSurvivedSupportedEditUndoRedoAndReimport: true,
          everyUnsupportedRemainderDisclosed: true,
          everyInvalidAndMaskingImportRetainedExactSession: true,
        },
        t02RecognizedUnsupported: {
          validFixtures: 6,
          malformedFixtures: 10,
          fixtures: t02RecognizedUnsupportedMatrix,
          malformed: t02RecognizedMalformedMatrix,
          everyFixtureSurvivedSupportedEditUndoRedoAndReimport: true,
          everyFeatureWasDisclosedAndPreviewBlocked: true,
          everyMalformedAndMaskingImportRetainedExactSession: true,
        },
        resolverMalformed: {
          malformedFixtures: 8,
          malformed: resolverMalformedMatrix,
          everyImportRetainedExactSession: true,
        },
        shadowInset: {
          validFixtures: 1,
          malformedFixtures: 3,
          fixture: shadowInsetCompatibility,
          malformed: shadowMalformedMatrix,
          survivedSupportedEditUndoRedoAndReimport: true,
          everyMalformedImportRetainedExactSession: true,
        },
        prototypeSafeGroupInheritance,
      },
      invalidMatrix,
    },
  });
}

function authenticateManifest(bytes, kind) {
  const manifest = parseJson(
    bytes,
    kind === "package" ? AUTHORING_MANIFEST_PATH : WORKBENCH_MANIFEST_PATH,
  );
  if (kind === "package") {
    const dependencies = {
      "@desen/design-system-core": "workspace:*",
      "@desen/protocol": "workspace:*",
    };
    if (
      manifest.name !== "@desen/design-system-authoring" ||
      manifest.version !== "0.0.0" ||
      manifest.private !== true ||
      manifest.type !== "module" ||
      manifest.sideEffects !== false ||
      !isDeepStrictEqual(manifest.exports, {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      }) ||
      !isDeepStrictEqual(manifest.dependencies, dependencies) ||
      Object.hasOwn(manifest, "peerDependencies")
    ) {
      fail("PACKAGE_DRIFT", "Authoring package boundary drifted.");
    }
    return Object.freeze({
      name: manifest.name,
      private: manifest.private,
      type: manifest.type,
      sideEffects: manifest.sideEffects,
      exportRoot: Object.freeze({ ...manifest.exports["."] }),
      productionDependencies: Object.freeze(Object.keys(dependencies).sort()),
      onlyReviewedInternalDependencies: true,
    });
  }
  const dependencies = {
    "@desen/design-system-authoring": "workspace:*",
    react: "19.2.8",
    "react-dom": "19.2.8",
  };
  const developmentDependencies = {
    "@playwright/test": "1.62.1",
    "@types/node": "24.13.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    vite: "8.1.5",
  };
  if (
    manifest.name !== "@desen/design-system-workbench-proof" ||
    manifest.version !== "0.0.0" ||
    manifest.private !== true ||
    manifest.type !== "module" ||
    !isDeepStrictEqual(manifest.dependencies, dependencies) ||
    !isDeepStrictEqual(manifest.devDependencies, developmentDependencies) ||
    manifest.scripts?.["test:e2e:built"] !== "playwright test --config playwright.config.ts"
  ) {
    fail("PACKAGE_DRIFT", "Isolated workbench package boundary drifted.");
  }
  return Object.freeze({
    name: manifest.name,
    private: manifest.private,
    type: manifest.type,
    productionDependencies: Object.freeze(Object.keys(dependencies).sort()),
    browserDependency: "@playwright/test@1.62.1",
  });
}

function captureBrowserObservation(rawObservation) {
  if (!exactKeys(rawObservation, ["profile", "result", "tests", "graphReceipts", "assertions"])) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser observation shape drifted.");
  }
  if (
    rawObservation.profile !== "desen.m10a-t03.browser-proof.v1" ||
    rawObservation.result !== "PASS" ||
    !ordinaryArray(rawObservation.tests) ||
    !ordinaryArray(rawObservation.graphReceipts) ||
    !isDeepStrictEqual(rawObservation.graphReceipts, ["theme-workbench"]) ||
    !exactKeys(rawObservation.assertions, EXPECTED_BROWSER_ASSERTIONS)
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser observation identity drifted.");
  }
  const tests = rawObservation.tests.map((item) => {
    if (!exactKeys(item, ["title", "result"]) || item.result !== "PASS") {
      fail("BROWSER_OBSERVATION_INVALID", "Browser result inventory contains a failing case.");
    }
    return Object.freeze({ title: item.title, result: item.result });
  });
  tests.sort((left, right) => left.title.localeCompare(right.title, "en"));
  if (
    !isDeepStrictEqual(
      tests.map(({ title }) => title),
      EXPECTED_BROWSER_TEST_TITLES,
    ) ||
    EXPECTED_BROWSER_ASSERTIONS.some((name) => rawObservation.assertions[name] !== true)
  ) {
    fail(
      "BROWSER_OBSERVATION_INVALID",
      "Browser cases or assertions are missing, widened, or failing.",
    );
  }
  return deepFreeze({
    profile: rawObservation.profile,
    result: rawObservation.result,
    tests,
    graphReceipts: ["theme-workbench"],
    assertions: Object.fromEntries(EXPECTED_BROWSER_ASSERTIONS.map((name) => [name, true])),
  });
}

function captureGraphObservation(rawObservation) {
  if (
    !exactKeys(rawObservation, [
      "schemaVersion",
      "graph",
      "entry",
      "result",
      "assertions",
      "modules",
    ])
  ) {
    fail("GRAPH_OBSERVATION_INVALID", "Workbench graph observation shape drifted.");
  }
  const assertions = rawObservation.assertions;
  if (
    rawObservation.schemaVersion !== 1 ||
    rawObservation.graph !== "theme-workbench" ||
    rawObservation.entry !== "index.html" ||
    rawObservation.result !== "PASS" ||
    !exactKeys(assertions, [
      "designSystemAuthoringPresent",
      "isolatedProofGraph",
      "forbiddenAuthorities",
    ]) ||
    assertions.designSystemAuthoringPresent !== true ||
    assertions.isolatedProofGraph !== true ||
    !exactKeys(assertions.forbiddenAuthorities, EXPECTED_FORBIDDEN_GRAPH_AUTHORITIES) ||
    EXPECTED_FORBIDDEN_GRAPH_AUTHORITIES.some(
      (name) => assertions.forbiddenAuthorities[name] !== false,
    ) ||
    !ordinaryArray(rawObservation.modules) ||
    rawObservation.modules.length === 0 ||
    rawObservation.modules.length > MAX_GRAPH_MODULES
  ) {
    fail(
      "GRAPH_OBSERVATION_INVALID",
      "Workbench graph receipt is missing its closed isolation claims.",
    );
  }
  const modules = rawObservation.modules.map((modulePath) => {
    if (
      typeof modulePath !== "string" ||
      modulePath.length === 0 ||
      modulePath.length > 4_096 ||
      path.isAbsolute(modulePath) ||
      modulePath.includes("\\") ||
      modulePath.split("/").includes("..")
    ) {
      fail("GRAPH_OBSERVATION_INVALID", "Workbench graph contains an unsafe module identity.");
    }
    return modulePath;
  });
  if (
    new Set(modules).size !== modules.length ||
    !isDeepStrictEqual(modules, [...modules].sort()) ||
    !modules.includes(`${WORKBENCH_ROOT}/src/main.tsx`) ||
    !modules.includes(`${WORKBENCH_ROOT}/src/workbench-application.tsx`) ||
    !modules.includes(`${AUTHORING_ROOT}/dist/theme-authoring.js`) ||
    modules.some(
      (modulePath) =>
        modulePath.includes("apps/desen-app/") ||
        modulePath.includes("packages/editor-core/") ||
        modulePath.includes("packages/editor-web/") ||
        modulePath.includes("packages/publisher/") ||
        modulePath.includes("packages/runtime-core/") ||
        modulePath.includes("packages/runtime-react/") ||
        modulePath.includes("packages/runtime-web/") ||
        modulePath.includes("packages/starter-catalog-web/"),
    )
  ) {
    fail(
      "GRAPH_OBSERVATION_INVALID",
      "Workbench graph module inventory is missing, widened, or unordered.",
    );
  }
  return deepFreeze({
    schemaVersion: 1,
    graph: "theme-workbench",
    entry: "index.html",
    result: "PASS",
    assertions: {
      designSystemAuthoringPresent: true,
      isolatedProofGraph: true,
      forbiddenAuthorities: Object.fromEntries(
        EXPECTED_FORBIDDEN_GRAPH_AUTHORITIES.map((name) => [name, false]),
      ),
    },
    modules,
  });
}

function authenticateSc01Compatibility(bytes) {
  const artifactReceipt = receipt(SC01_DTCG_ARTIFACT_PATH, bytes);
  if (
    artifactReceipt.bytes !== SC01_DTCG_ARTIFACT_PIN.bytes ||
    artifactReceipt.sha256 !== SC01_DTCG_ARTIFACT_PIN.sha256
  ) {
    fail("SC01_DRIFT", "Frozen SC-01 DTCG compatibility artifact bytes drifted.");
  }
  const artifact = parseJson(bytes, SC01_DTCG_ARTIFACT_PATH);
  const families = artifact.compatibility?.reviewedValidButUnsupportedFeatures;
  const invalid = artifact.compatibility?.reviewedInvalidFixtures;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.checkpoint !== "SC-01" ||
    artifact.result !== "PASS" ||
    artifact.classification !== "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE" ||
    artifact.claim?.auditScope !==
      "CURRENT_BUILT_REFERENCE_DOCUMENT_AND_REVIEWED_EXACT_FIXTURE_MATRIX" ||
    artifact.claim?.arbitraryInputConformanceVerdict !== false ||
    !ordinaryArray(families) ||
    families.length !== 14 ||
    invalid?.reviewScope !== "EXACT_EMBEDDED_FIXTURES_ONLY" ||
    invalid?.expectedClassification !== "INVALID_DTCG" ||
    !ordinaryArray(invalid.fixtures) ||
    invalid.fixtures.length !== 7
  ) {
    fail("SC01_DRIFT", "Frozen SC-01 compatibility identity drifted.");
  }
  const fixtures = [];
  for (const family of families) {
    if (
      typeof family?.id !== "string" ||
      family.dtcgStatus === undefined ||
      family.localStatus !== "UNSUPPORTED" ||
      family.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
      !ordinaryArray(family.executableFixtures) ||
      family.executableFixtures.length === 0
    ) {
      fail("SC01_DRIFT", "Frozen SC-01 valid-but-unsupported family drifted.");
    }
    for (const fixture of family.executableFixtures) {
      if (
        fixture?.featureId !== family.id ||
        fixture.classification !== "UNSUPPORTED_DTCG_FEATURE" ||
        typeof fixture.id !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(fixture.canonicalJsonSha256) ||
        fixture.document === null ||
        typeof fixture.document !== "object" ||
        Array.isArray(fixture.document) ||
        `sha256:${sha256(canonicalJsonBytes(fixture.document))}` !== fixture.canonicalJsonSha256
      ) {
        fail("SC01_DRIFT", "Frozen SC-01 valid-but-unsupported fixture drifted.");
      }
      fixtures.push(
        deepFreeze({
          id: fixture.id,
          featureId: fixture.featureId,
          canonicalJsonSha256: fixture.canonicalJsonSha256,
          document: fixture.document,
        }),
      );
    }
  }
  if (
    !isDeepStrictEqual(
      fixtures.map(({ id, featureId }) => ({ id, featureId })),
      SC01_VALID_UNSUPPORTED_FIXTURES,
    ) ||
    !isDeepStrictEqual(
      invalid.fixtures.map(({ id, classification }) => ({ id, classification })),
      SC01_INVALID_FIXTURE_IDS.map((id) => ({ id, classification: "INVALID_DTCG" })),
    )
  ) {
    fail("SC01_DRIFT", "Frozen SC-01 fixture inventory drifted.");
  }
  const invalidFixtures = invalid.fixtures.map((fixture) => {
    if (
      !/^sha256:[0-9a-f]{64}$/u.test(fixture.canonicalJsonSha256) ||
      fixture.document === null ||
      typeof fixture.document !== "object" ||
      Array.isArray(fixture.document) ||
      `sha256:${sha256(canonicalJsonBytes(fixture.document))}` !== fixture.canonicalJsonSha256
    ) {
      fail("SC01_DRIFT", "Frozen SC-01 invalid fixture drifted.");
    }
    return deepFreeze({
      id: fixture.id,
      canonicalJsonSha256: fixture.canonicalJsonSha256,
      document: fixture.document,
    });
  });
  return deepFreeze({
    fixtures,
    invalidFixtures,
    evidence: {
      artifact: artifactReceipt,
      classification: artifact.classification,
      featureFamilies: families.map(({ id }) => id),
      validButUnsupportedFixtures: fixtures.map(({ id }) => id),
      invalidFixtures: invalidFixtures.map(({ id }) => id),
      unchanged: true,
    },
  });
}

async function authenticateT02(workspaceRoot, bytes, coreRuntime) {
  const artifactReceipt = receipt(T02_ARTIFACT_PATH, bytes);
  if (
    artifactReceipt.bytes !== T02_ARTIFACT_PIN.bytes ||
    artifactReceipt.sha256 !== T02_ARTIFACT_PIN.sha256
  ) {
    fail("T02_DRIFT", "Frozen M10A-T02 artifact bytes drifted.");
  }
  const artifact = parseJson(bytes, T02_ARTIFACT_PATH);
  if (
    artifact.task !== "M10A-T02" ||
    artifact.profile !== "desen.design-system-core.proof.v1" ||
    artifact.result !== "PASS" ||
    !isDeepStrictEqual(artifact.publicPackage?.requiredRuntimeExports, CORE_RUNTIME_EXPORTS) ||
    !Array.isArray(artifact.publicPackage?.files) ||
    artifact.publicPackage.files.length === 0
  ) {
    fail("T02_DRIFT", "Frozen M10A-T02 evidence identity drifted.");
  }
  const capturedCore = captureRuntime(
    coreRuntime,
    CORE_RUNTIME_EXPORTS,
    CORE_FUNCTION_EXPORTS,
    "Design System Core",
  );
  if (!isDeepStrictEqual(Object.keys(capturedCore).sort(), CORE_RUNTIME_EXPORTS)) {
    fail("T02_DRIFT", "Frozen T02 public runtime surface drifted.");
  }
  const currentReceipts = [];
  for (const expected of artifact.publicPackage.files) {
    if (
      !exactKeys(expected, ["path", "bytes", "sha256"]) ||
      typeof expected.path !== "string" ||
      typeof expected.bytes !== "number" ||
      typeof expected.sha256 !== "string"
    ) {
      fail("T02_DRIFT", "Frozen T02 authority inventory is invalid.");
    }
    const actual = receipt(expected.path, await readRegularAuthority(workspaceRoot, expected.path));
    if (!isDeepStrictEqual(actual, expected)) {
      fail("T02_DRIFT", "Frozen T02 package authority drifted.");
    }
    currentReceipts.push(actual);
  }
  return deepFreeze({
    artifact: artifactReceipt,
    profile: artifact.profile,
    result: artifact.result,
    publicRuntimeExports: CORE_RUNTIME_EXPORTS,
    authorityFiles: currentReceipts.length,
    authorityBytes: currentReceipts.reduce((total, item) => total + item.bytes, 0),
    authorityAggregateSha256: receiptAggregate(currentReceipts),
    unchanged: true,
  });
}

async function authenticateProtocol(workspaceRoot) {
  let observation;
  try {
    observation = await verifyProtocolSnapshot(path.join(workspaceRoot, PROTOCOL_SNAPSHOT_PATH));
  } catch {
    fail("PROTOCOL_DRIFT", "Frozen DESEN Protocol snapshot verification failed.");
  }
  for (const key of [
    "protocol",
    "sourceCommit",
    "sourceTree",
    "snapshotFiles",
    "manifestEntries",
    "totalBytes",
    "manifestSha256",
    "aggregateSha256",
  ]) {
    if (observation[key] !== EXPECTED_PROTOCOL_SNAPSHOT[key]) {
      fail("PROTOCOL_DRIFT", "Frozen DESEN Protocol snapshot identity drifted.");
    }
  }
  return deepFreeze({
    protocol: observation.protocol,
    sourceCommit: observation.sourceCommit,
    sourceTree: observation.sourceTree,
    manifestSha256: observation.manifestSha256,
    aggregateSha256: observation.aggregateSha256,
    snapshotFiles: observation.snapshotFiles,
    manifestEntries: observation.manifestEntries,
    totalBytes: observation.totalBytes,
    unchanged: true,
  });
}

async function authenticateRuntimeCore(workspaceRoot, bytes) {
  const artifactReceipt = receipt(RUNTIME_CORE_BASELINE_ARTIFACT_PATH, bytes);
  if (!isDeepStrictEqual(artifactReceipt, RUNTIME_CORE_ARTIFACT_PIN)) {
    fail("RUNTIME_CORE_DRIFT", "Frozen Runtime Core artifact bytes drifted.");
  }
  let baseline;
  let observation;
  try {
    baseline = parseRuntimeCoreBaselineBytes(bytes);
    if (!isDeepStrictEqual(baseline, RUNTIME_CORE_BASELINE_CAPTURE)) throw new Error();
    observation = await verifyRuntimeCoreBaseline({ workspaceRoot, baseline });
  } catch {
    fail("RUNTIME_CORE_DRIFT", "Frozen Runtime Core tree verification failed.");
  }
  if (
    observation.tree !== RUNTIME_CORE_BASELINE_CAPTURE.tree ||
    observation.objectFormat !== "sha1" ||
    observation.path !== "packages/runtime-core" ||
    observation.clean !== true ||
    !Number.isSafeInteger(observation.trackedFiles) ||
    observation.trackedFiles <= 0
  ) {
    fail("RUNTIME_CORE_DRIFT", "Frozen Runtime Core observation drifted.");
  }
  return deepFreeze({
    artifact: artifactReceipt,
    profile: baseline.profile,
    objectFormat: baseline.objectFormat,
    tree: baseline.tree,
    trackedFiles: observation.trackedFiles,
    clean: observation.clean,
    unchanged: true,
  });
}

async function serializeArtifact(artifact) {
  return Buffer.from(
    await format(JSON.stringify(artifact), { parser: "json", printWidth: 100 }),
    "utf8",
  );
}

async function loadDefaultRuntime(relativePath) {
  try {
    return await import(new URL(relativePath, import.meta.url).href);
  } catch {
    fail("PUBLIC_API_DRIFT", "A required built public package root is unavailable.");
  }
}

/** Build deterministic T03 evidence from authenticated browser and graph observations. */
export async function buildM10AT03Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, [
    "workspaceRoot",
    "fileOverrides",
    "runtime",
    "coreRuntime",
    "browserObservation",
    "graphObservation",
  ]);
  if (options.browserObservation === undefined || options.graphObservation === undefined) {
    fail("OPTIONS_INVALID", "T03 evidence requires browser and graph observations.");
  }
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const overrides = captureOverrides(options.fileOverrides);
  await Promise.all([
    authenticateInventory(workspaceRoot, AUTHORING_ROOT, AUTHORING_AUTHORITY_PATHS),
    authenticateInventory(workspaceRoot, WORKBENCH_ROOT, WORKBENCH_AUTHORITY_PATHS),
  ]);
  const authorityPaths = [
    T02_ARTIFACT_PATH,
    SC01_DTCG_ARTIFACT_PATH,
    RUNTIME_CORE_BASELINE_ARTIFACT_PATH,
    ...AUTHORING_AUTHORITY_PATHS,
    ...WORKBENCH_AUTHORITY_PATHS,
  ];
  const entries = await Promise.all(
    authorityPaths.map(async (relativePath) => [
      relativePath,
      await readRegularAuthority(workspaceRoot, relativePath, overrides),
    ]),
  );
  const files = new Map(entries);
  const [rawRuntime, rawCoreRuntime] = await Promise.all([
    options.runtime ?? loadDefaultRuntime("../../packages/design-system-authoring/dist/index.js"),
    options.coreRuntime ?? loadDefaultRuntime("../../packages/design-system-core/dist/index.js"),
  ]);
  const runtime = captureRuntime(
    rawRuntime,
    AUTHORING_RUNTIME_EXPORTS,
    AUTHORING_FUNCTION_EXPORTS,
    "Design System Authoring",
  );
  const packageBoundary = authenticateManifest(files.get(AUTHORING_MANIFEST_PATH), "package");
  const workbenchBoundary = authenticateManifest(files.get(WORKBENCH_MANIFEST_PATH), "app");
  const sc01 = authenticateSc01Compatibility(files.get(SC01_DTCG_ARTIFACT_PATH));
  const behavior = exerciseAuthoring(runtime, sc01.fixtures, sc01.invalidFixtures);
  const browser = captureBrowserObservation(options.browserObservation);
  const graph = captureGraphObservation(options.graphObservation);
  const [t02, protocol, runtimeCore] = await Promise.all([
    authenticateT02(workspaceRoot, files.get(T02_ARTIFACT_PATH), rawCoreRuntime),
    authenticateProtocol(workspaceRoot),
    authenticateRuntimeCore(workspaceRoot, files.get(RUNTIME_CORE_BASELINE_ARTIFACT_PATH)),
  ]);
  const packageFiles = Object.freeze(
    AUTHORING_AUTHORITY_PATHS.map((relativePath) => receipt(relativePath, files.get(relativePath))),
  );
  const workbenchFiles = Object.freeze(
    WORKBENCH_AUTHORITY_PATHS.map((relativePath) => receipt(relativePath, files.get(relativePath))),
  );
  const artifact = deepFreeze({
    schemaVersion: 1,
    task: "M10A-T03",
    proofId: "m10a-t03",
    profile: "desen.theme-token-authoring.proof.v1",
    result: "PASS",
    claim: {
      implementationEvidence: "PASS",
      taskCompletionRequiresHostedExactHead: true,
      platformNeutralAuthoring: true,
      editableNeutralLightDark: true,
      arbitraryProfileValidColorAndTypographyValues: true,
      aliasAndModeAuthoring: true,
      boundedUndoRedo: true,
      livePreviewProjection: true,
      neutralContrastAndFocus: true,
      structuredThemeModeCrud: true,
      literalAndAliasCreation: true,
      lossAwareTransfer: true,
      invalidImportAtomicity: true,
      sc01CompatibilityPreservation: true,
      t02RecognizedUnsupportedPreservation: true,
      unsupportedSelectedModePreviewBlocked: true,
      partialPreviewAuthority: false,
      isolatedWorkbenchProof: true,
    },
    publicPackage: {
      ...packageBoundary,
      requiredRuntimeExports: AUTHORING_RUNTIME_EXPORTS,
      exercisedBuiltPublicRoot: true,
      files: packageFiles,
      authorityAggregateSha256: receiptAggregate(packageFiles),
    },
    authoring: behavior,
    workbench: {
      ...workbenchBoundary,
      files: workbenchFiles,
      authorityAggregateSha256: receiptAggregate(workbenchFiles),
      browser,
      browserJourneyCoverage: {
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
      },
      graph,
      exactBrowserCases: browser.tests.length,
      exactBrowserAssertions: Object.keys(browser.assertions).length,
      graphModuleCount: graph.modules.length,
      normalDesenAppIntegrated: false,
    },
    frozenAuthorities: { t02, sc01: sc01.evidence, protocol, runtimeCore },
    tests: {
      rootTestNames: M10A_T03_ROOT_TEST_NAMES,
      packageBehaviorRunsSeparately: true,
      publicPackageRunsSeparately: true,
      browserExecutedByVerifier: true,
      verifierUsesNetwork: false,
      verifierSpawnsBoundedLocalChildren: true,
      hostedExactHeadRequired: true,
    },
    nonClaims: [
      "T03 does not integrate the theme workbench into the normal Desen App.",
      "T03 does not persist projects, create immutable releases, publish or activate token data, or change Runtime semantics.",
      "The isolated browser workbench is implementation evidence, not a production application or visual-regression system.",
      "The frozen SC-01 matrix bounds the standards claim to 14 reviewed feature families, 16 exact valid-but-unsupported fixtures, and seven exact invalid fixtures; it is not a general DTCG parser, resolver, or arbitrary-input conformance verdict.",
      "All 16 historical SC-01 fixtures are preserved without silent loss. The three complete documents now fully supported by T02 are preview-ready and emit no false disclosure; the 13 documents with a remaining unsupported member are disclosed, inert, and preview-blocked without partial or production authority.",
      "Local deterministic evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
  const artifactBytes = await serializeArtifact(artifact);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function captureEnvironment(rawEnvironment) {
  if (
    rawEnvironment === null ||
    typeof rawEnvironment !== "object" ||
    Array.isArray(rawEnvironment) ||
    utilTypes.isProxy(rawEnvironment) ||
    (rawEnvironment !== process.env &&
      Object.getPrototypeOf(rawEnvironment) !== Object.prototype &&
      Object.getPrototypeOf(rawEnvironment) !== null)
  ) {
    fail("OPTIONS_INVALID", "Browser environment must be one inert string map.");
  }
  const captured = Object.create(null);
  let totalBytes = 0;
  const keys = Reflect.ownKeys(rawEnvironment);
  if (keys.length > 4_096) {
    fail("OPTIONS_INVALID", "Browser environment contains too many fields.");
  }
  for (const key of keys) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(rawEnvironment, key) : undefined;
    if (
      typeof key !== "string" ||
      descriptor === undefined ||
      !Object.hasOwn(descriptor, "value") ||
      key.length > 1_024 ||
      key.includes("\0") ||
      key.includes("=")
    ) {
      fail("OPTIONS_INVALID", "Browser environment contains an unsafe field.");
    }
    if (descriptor.value === undefined) continue;
    if (
      typeof descriptor.value !== "string" ||
      descriptor.value.length > 65_536 ||
      descriptor.value.includes("\0")
    ) {
      fail("OPTIONS_INVALID", "Browser environment contains an unsafe value.");
    }
    totalBytes += Buffer.byteLength(key) + Buffer.byteLength(descriptor.value);
    if (totalBytes > 262_144)
      fail("OPTIONS_INVALID", "Browser environment exceeds its byte budget.");
    captured[key] = descriptor.value;
  }
  return captured;
}

function runChild(command, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const ownsProcessGroup = process.platform !== "win32";
    const child = spawn(command, args, { ...options, detached: ownsProcessGroup });
    let settled = false;
    let timedOut = false;
    let outputExceeded = false;
    let parentSignal = null;
    let terminating = false;
    let outputBytes = 0;
    const stdout = [];
    const stderr = [];
    let closeResult;
    let unexpectedSurvivors = false;
    let escalation;
    let terminalTimer;
    let releasePoll;
    const processGroupAlive = () => {
      if (!ownsProcessGroup || !Number.isSafeInteger(child.pid)) {
        return child.exitCode === null && child.signalCode === null;
      }
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch (error) {
        if (error?.code === "ESRCH") return false;
        if (error?.code === "EPERM") return true;
        throw error;
      }
    };
    const result = (processGroupReleased) => ({
      code: closeResult?.code ?? null,
      signal:
        closeResult === undefined ? (processGroupReleased ? "SIGKILL" : null) : closeResult.signal,
      timedOut,
      outputExceeded,
      parentSignal,
      processGroupReleased,
      unexpectedSurvivors,
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
    });
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(escalation);
      clearTimeout(terminalTimer);
      clearInterval(releasePoll);
      process.off("SIGINT", onParentSigint);
      process.off("SIGTERM", onParentSigterm);
      callback();
    };
    const signal = (name) => {
      try {
        if (ownsProcessGroup && Number.isSafeInteger(child.pid)) process.kill(-child.pid, name);
        else child.kill(name);
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    };
    const terminate = () => {
      if (terminating) return;
      terminating = true;
      try {
        signal("SIGTERM");
        escalation = setTimeout(() => {
          try {
            signal("SIGKILL");
            releasePoll = setInterval(() => {
              try {
                if (!processGroupAlive()) finish(() => resolvePromise(result(true)));
              } catch (error) {
                finish(() => rejectPromise(error));
              }
            }, 20);
          } catch (error) {
            finish(() => rejectPromise(error));
          }
        }, BROWSER_TERMINATION_GRACE_MS);
        terminalTimer = setTimeout(() => {
          try {
            signal("SIGKILL");
            const released = !processGroupAlive();
            finish(() => resolvePromise(result(released)));
          } catch (error) {
            finish(() => rejectPromise(error));
          }
        }, BROWSER_TERMINATION_GRACE_MS * 3);
      } catch (error) {
        finish(() => rejectPromise(error));
      }
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, BROWSER_TIMEOUT_MS);
    const capture = (target, chunk) => {
      if (outputExceeded) return;
      const bytes = Buffer.from(chunk);
      outputBytes += bytes.byteLength;
      if (outputBytes > MAX_BROWSER_OUTPUT_BYTES) {
        outputExceeded = true;
        terminate();
        return;
      }
      target.push(bytes);
    };
    const onParentSigint = () => {
      parentSignal = "SIGINT";
      terminate();
    };
    const onParentSigterm = () => {
      parentSignal = "SIGTERM";
      terminate();
    };
    process.once("SIGINT", onParentSigint);
    process.once("SIGTERM", onParentSigterm);
    child.stdout?.on("data", (chunk) => capture(stdout, chunk));
    child.stderr?.on("data", (chunk) => capture(stderr, chunk));
    child.once("error", (error) => finish(() => rejectPromise(error)));
    child.once("close", (code, signalName) => {
      closeResult = { code, signal: signalName };
      try {
        if (!terminating && processGroupAlive()) {
          unexpectedSurvivors = true;
          terminate();
        } else if (!processGroupAlive()) {
          finish(() => resolvePromise(result(true)));
        }
      } catch (error) {
        finish(() => rejectPromise(error));
      }
    });
  });
}

/** Execute the isolated built Chromium journey and authenticate its graph receipt. */
export async function executeM10AT03BrowserProof(rawOptions = undefined) {
  const options = captureOptions(rawOptions, [
    "workspaceRoot",
    "command",
    "environment",
    "runChild",
  ]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const selectedCommand =
    options.command === undefined || options.command === "built"
      ? M10A_T03_BROWSER_COMMAND
      : options.command === "capture"
        ? M10A_T03_BROWSER_CAPTURE_COMMAND
        : undefined;
  if (selectedCommand === undefined) fail("OPTIONS_INVALID", "Browser command is not reviewed.");
  const environment = captureEnvironment(options.environment ?? process.env);
  const runner = options.runChild ?? runChild;
  if (typeof runner !== "function" || utilTypes.isProxy(runner)) {
    fail("OPTIONS_INVALID", "runChild must be one non-Proxy function.");
  }
  const providedTempRoot = environment.DESEN_M10A_T03_PROOF_TEMP;
  const ownsTempRoot = providedTempRoot === undefined;
  const tempRoot = ownsTempRoot
    ? await realpath(await mkdtemp(path.join(tmpdir(), "desen-m10a-t03-browser-")))
    : providedTempRoot;
  if (
    typeof tempRoot !== "string" ||
    !path.isAbsolute(tempRoot) ||
    path.resolve(tempRoot) !== tempRoot
  ) {
    fail("BROWSER_ENVIRONMENT_INVALID", "Browser proof requires an absolute temp root.");
  }
  try {
    const tempEntry = await lstat(tempRoot).catch(() => undefined);
    if (
      !tempEntry?.isDirectory() ||
      tempEntry.isSymbolicLink() ||
      (await realpath(tempRoot)) !== tempRoot
    ) {
      fail("BROWSER_ENVIRONMENT_INVALID", "Browser proof temp authority is unsafe.");
    }
    const reportPath = path.join(tempRoot, "browser-proof.json");
    if ((await lstat(reportPath).catch(() => undefined)) !== undefined) {
      fail("BROWSER_OBSERVATION_STALE", "Browser proof refuses a pre-existing receipt.");
    }
    let result;
    try {
      result = await runner(selectedCommand.command, selectedCommand.args, {
        cwd: workspaceRoot,
        env: { ...environment, DESEN_M10A_T03_PROOF_TEMP: tempRoot },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      fail("BROWSER_EXECUTION_FAILED", "The isolated Chromium proof could not start safely.");
    }
    if (
      result?.code !== 0 ||
      result.signal !== null ||
      result.timedOut !== false ||
      result.outputExceeded !== false ||
      result.parentSignal !== null ||
      result.processGroupReleased !== true ||
      result.unexpectedSurvivors !== false
    ) {
      fail("BROWSER_EXECUTION_FAILED", "The isolated Chromium proof did not close successfully.");
    }
    const [browserBytes, graphBytes] = await Promise.all([
      readAbsoluteStableFile(reportPath, "Browser proof report", MAX_BROWSER_REPORT_BYTES),
      readRegularAuthority(
        workspaceRoot,
        WORKBENCH_GRAPH_PATH,
        new Map(),
        MAX_BROWSER_REPORT_BYTES,
      ),
    ]);
    return Object.freeze({
      browserObservation: captureBrowserObservation(
        parseJson(browserBytes, "Browser proof report"),
      ),
      graphObservation: captureGraphObservation(parseJson(graphBytes, WORKBENCH_GRAPH_PATH)),
    });
  } finally {
    if (ownsTempRoot) await rm(tempRoot, { recursive: true, force: false });
  }
}

async function readAbsoluteStableFile(target, label, limit) {
  let handle;
  try {
    const before = await lstat(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size <= 0n ||
      before.size > BigInt(limit) ||
      (await realpath(target)) !== target
    ) {
      throw new Error();
    }
    handle = await open(target, READ_FLAGS);
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const linked = await lstat(target, { bigint: true });
    if (
      bytes.byteLength !== Number(before.size) ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      linked.dev !== before.dev ||
      linked.ino !== before.ino ||
      linked.size !== before.size
    ) {
      throw new Error();
    }
    return bytes;
  } catch {
    fail("BROWSER_OBSERVATION_INVALID", `${label} is not one stable bounded regular file.`);
  } finally {
    await handle?.close();
  }
}

/** Execute the real browser proof and build fresh deterministic T03 evidence in memory. */
export async function executeM10AT03Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot", "command", "environment"]);
  const observed = await executeM10AT03BrowserProof({
    ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
    ...(options.command === undefined ? {} : { command: options.command }),
    ...(options.environment === undefined ? {} : { environment: options.environment }),
  });
  return buildM10AT03Evidence({
    ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
    ...observed,
  });
}

async function readVisibleProof(workspaceRoot, rawOverride) {
  if (rawOverride !== undefined) return captureBytes(rawOverride, "proofDocumentBytes");
  return readRegularAuthority(workspaceRoot, PROOF_DOCUMENT_RELATIVE_PATH);
}

function proofBlock(...lines) {
  return lines.join("\n");
}

function pendingProofDocumentMarkerInventory(artifactSha256) {
  return Object.freeze([
    "# M10A-T03 — Theme and token authoring",
    "**Last verified:** YYYY-MM-DD",
    proofBlock(
      "**Status:** implementation evidence passes locally; exact-head hosted closure is pending. This",
      "report does not integrate the normal Desen App, start M10A-T04, or advance G10A.",
    ),
    "## Delivered boundary",
    proofBlock(
      "`@desen/design-system-authoring` is a private platform-neutral package layered only on the",
      "frozen public `@desen/design-system-core` and DESEN Protocol APIs. Its built public root has",
      "exactly 12 reviewed runtime exports. Seven closed finite limits bound identifier, import, label,",
      "mode, theme, unsupported-feature-per-overlay, and in-memory history sizes; missing, additional,",
      "non-finite, fractional, zero, negative, or unsafe-integer limits fail closed.",
    ),
    proofBlock(
      "The package ships an editable DESEN Neutral foundation with explicit light and dark source",
      "overlays, 45 deterministic preview tokens, ordinary arbitrary profile-valid color and composite",
      "typography edits, whole-token alias edits, explicit mode selection, and bounded immutable",
      "undo/redo. Neutral is a starting point, not a forced palette or a token-only restriction on",
      "capability-supported literal values. Both modes meet exact 7:1 foreground, 4.5:1 muted, 7:1",
      "action, and 3:1 focus contrast floors; the token receipt keeps 1px default and 2px focus strokes,",
      "and the Chromium journey observes the 2px visible keyboard-focus outline. This is T03 evidence",
      "only and does not start or claim T26.",
    ),
    proofBlock(
      "`@desen/design-system-workbench-proof` is an isolated React/Vite browser harness, not normal App",
      "integration. Four exact Chromium journeys exercise the visible Neutral foundation, light/dark",
      "selection, rendered sRGB-alpha preview, px/rem and named-to-numeric CSS typography, alias",
      "redirection, undo/redo, byte-stable transfer, and invalid-import retention. Its emitted graph",
      "receipt rejects Desen App, Editor, Publisher, Runtime, and starter-catalog modules.",
    ),
    "## Executed evidence",
    proofBlock(
      "The proof calls all eight operations through the built package root. A color edit reaches its",
      "semantic alias in live preview; one composite typography edit advances one revision; alias edits",
      "are checked across both modes; undo and redo restore the exact immutable document objects. Export",
      "is canonical JSON with matching reported byte count, and reimport reproduces exactly the same text",
      "with zero silent losses. The same built edit surface creates and deletes literal and alias tokens,",
      "duplicates, renames, and deletes modes and themes, and restores exact structural selections across",
      "undo and redo.",
    ),
    proofBlock(
      "The frozen SC-01 compatibility inventory's 14 feature families and all 16 exact",
      "historical valid-but-unsupported fixtures are retained with zero loss across an ordinary",
      "supported sibling edit, undo/redo, and byte-stable export/reimport. Seven historical feature",
      "rows are now T02-native and nine remain unsupported; because four native-feature fixture",
      "documents also carry an unsupported standard hex member, exactly three complete fixtures are",
      "preview-ready and 13 are disclosed and preview-blocked without partial authority. A separate",
      "closed six-valid/ten-malformed token-and-composite matrix",
      "proves complex border strokeStyle, composite-property references, and the fontFamily, fontWeight,",
      "gradient, and strokeStyle token types which T02 recognizes but does not resolve. Eight supplemental",
      "Resolver malformed fixtures reject empty resolution order, malformed source references, invalid",
      "member shapes, a single-context modifier, and a nested Resolver source atomically. One valid",
      "shadow-inset fixture is preserved, disclosed, edited, and round-tripped without loss while three",
      "malformed shadow fixtures fail atomically. A valid `__proto__` token inside an inherited group also",
      "survives exact edit, undo/redo, and export/reimport without prototype mutation. Malformed JSON,",
      "duplicate keys, a missing alias",
      "target, a target missing only from an unselected mode, a broken alias edit, and an accessor-bearing",
      "value fail closed; every import/edit failure returns the exact preceding session without invoking",
      "the accessor. An unsupported member cannot mask a later invalid token member.",
    ),
    proofBlock(
      "The predecessor and frozen foundations remain exact: M10A-T02 is 11,513 bytes at",
      "`sha256:135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2` with its",
      "12-export public runtime and full package authority unchanged; DESEN Protocol 0.1.0 remains at",
      "snapshot aggregate `afe8fc359465ce891f4325fcdeca4b2f12bca48f1aa54a34c4f3a97985f7e060`;",
      "Runtime Core remains the clean Git SHA-1 tree `3fa3613a3be63c749f40b6a0b55af5b40c675773`.",
      "The immutable SC-01 DTCG compatibility artifact remains 31,286 bytes at",
      "`sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`.",
    ),
    proofBlock(
      "The verifier creates a fresh evidence observation from the built public package and exact source",
      "inventories, executes the bounded local Chromium journey, authenticates its graph receipt, verifies",
      "Protocol and Runtime Core independently, and compares the result with the checkpointed artifact.",
      "It performs no network access. The generator alone writes the task artifact through the shared",
      "same-directory atomic writer.",
    ),
    `Final artifact: \`sha256:${artifactSha256}\``,
    "## Verification",
    proofBlock(
      "- Authoring package build, typecheck, unit tests, and built public-package contract: pass.",
      "- Isolated workbench typecheck, build, graph isolation, and four Chromium journeys: pass. The",
      "  journeys cover exact sRGB alpha authoring, px/rem and numeric/named-weight typography, literal and alias",
      "  creation, structured theme/mode duplicate-and-rename operations, and fail-closed unsupported-mode",
      "  preview with no partial preview authority.",
      "- Root deterministic, mutation, report-drift, and atomic-writer evidence: pass before final",
      "  checkpoint seal.",
      "- Dependency boundaries and exhaustive repository checks: pending final local seal.",
      "- Exact-head hosted Quality gate and fresh-main evidence: pending; no hosted receipt is claimed.",
    ),
    proofBlock(
      "Primary commands are `pnpm generate:m10a-t03`, `pnpm verify:m10a-t03`, and",
      "`pnpm test:m10a-t03` once their root wiring is sealed.",
    ),
    "## Hosted closure",
    proofBlock(
      "Exact-head pull-request Quality gate and Browser E2E receipts, squash-merge identity, and a fresh",
      "`main` run at the exact merge SHA are pending. This local artifact makes no hosted-success claim.",
    ),
    proofBlock(
      "M10A-T04 is dependency-ready but remains `NOT_STARTED`, unselected, and unauthorized while T03 is",
      "active.",
    ),
    "## Non-claims",
    proofBlock(
      "T03 provides no normal Desen App integration, project persistence, immutable design-system",
      "release, token publication or activation, runtime behavior, component-library expansion, visual",
      "regression platform, remote or multi-user workflow, production-readiness claim, M10A-T04 work, or",
      "G10A advancement or T26 work. The compatibility claim is bounded to the frozen SC-01 exact",
      "fixture inventory plus the closed six-valid/ten-malformed T02-recognized matrix, eight malformed",
      "Resolver fixtures, one-valid/three-malformed shadow-inset matrix, and one prototype-safe inherited",
      "group fixture; it is not a general DTCG parser, resolver, or arbitrary-input validity verdict.",
      "Preserved unsupported data remains inert and acquires no partial preview, publication, or",
      "production authority.",
    ),
  ]);
}

function hostedPullRequestMarker(receipt) {
  return proofBlock(
    `[PR #${receipt.prNumber}](https://github.com/desenlab/desen-app/pull/${receipt.prNumber}) at exact head`,
    `\`${receipt.headSha}\` passed`,
    `[run ${receipt.pullRunId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}):`,
    `[Quality gate job ${receipt.pullQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullQualityJobId}) and`,
    `[Browser E2E job ${receipt.pullBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullBrowserJobId})`,
    "both completed successfully. The pull request was squash-merged as",
    `[\`${receipt.mergeSha}\`](https://github.com/desenlab/desen-app/commit/${receipt.mergeSha}).`,
  );
}

function hostedFreshMainMarker(receipt) {
  return proofBlock(
    "The resulting fresh",
    `[\`main\` run ${receipt.freshRunId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}) passed at exact merge SHA`,
    `\`${receipt.mergeSha}\`:`,
    `[Quality gate job ${receipt.freshQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshQualityJobId}) and`,
    `[Browser E2E job ${receipt.freshBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshBrowserJobId})`,
    "both completed successfully.",
  );
}

function doneProofDocumentMarkerInventory(artifactSha256, receipt) {
  const pending = pendingProofDocumentMarkerInventory(artifactSha256);
  return Object.freeze([
    ...pending.slice(0, 2),
    proofBlock(
      "**Status:** `DONE`. Exact-head pull-request checks, squash merge, and fresh-main checks pass. This",
      "report does not integrate the normal Desen App, start M10A-T04, or advance G10A.",
    ),
    ...pending.slice(3, 14),
    proofBlock(
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
    ),
    pending[15],
    "## Hosted closure",
    hostedPullRequestMarker(receipt),
    hostedFreshMainMarker(receipt),
    "M10A-T04 is ready but remains `NOT_STARTED`.",
    ...pending.slice(19),
  ]);
}

function captureDoneProofReceipts(observed) {
  if (
    observed.length !== 22 ||
    observed[16] !== "## Hosted closure" ||
    observed[19] !== "M10A-T04 is ready but remains `NOT_STARTED`."
  ) {
    return undefined;
  }
  const pullLines = observed[17].split("\n");
  const freshLines = observed[18].split("\n");
  if (
    pullLines.length !== 7 ||
    freshLines.length !== 6 ||
    pullLines[5] !== "both completed successfully. The pull request was squash-merged as" ||
    freshLines[0] !== "The resulting fresh" ||
    freshLines[5] !== "both completed successfully."
  ) {
    return undefined;
  }
  const pullRequest =
    /^\[PR #([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/pull\/([1-9][0-9]*)\) at exact head$/u.exec(
      pullLines[0],
    );
  const head = /^`([0-9a-f]{40})` passed$/u.exec(pullLines[1]);
  const pullRun =
    /^\[run ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\):$/u.exec(
      pullLines[2],
    );
  const pullQuality =
    /^\[Quality gate job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\) and$/u.exec(
      pullLines[3],
    );
  const pullBrowser =
    /^\[Browser E2E job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\)$/u.exec(
      pullLines[4],
    );
  const merge =
    /^\[`([0-9a-f]{40})`\]\(https:\/\/github\.com\/desenlab\/desen-app\/commit\/([0-9a-f]{40})\)\.$/u.exec(
      pullLines[6],
    );
  const freshRun =
    /^\[`main` run ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\) passed at exact merge SHA$/u.exec(
      freshLines[1],
    );
  const freshSha = /^`([0-9a-f]{40})`:$/u.exec(freshLines[2]);
  const freshQuality =
    /^\[Quality gate job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\) and$/u.exec(
      freshLines[3],
    );
  const freshBrowser =
    /^\[Browser E2E job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\)$/u.exec(
      freshLines[4],
    );
  if (
    pullRequest === null ||
    head === null ||
    pullRun === null ||
    pullQuality === null ||
    pullBrowser === null ||
    merge === null ||
    freshRun === null ||
    freshSha === null ||
    freshQuality === null ||
    freshBrowser === null ||
    pullRequest[1] !== pullRequest[2] ||
    pullRun[1] !== pullRun[2] ||
    pullQuality[1] !== pullQuality[3] ||
    pullQuality[2] !== pullRun[1] ||
    pullBrowser[1] !== pullBrowser[3] ||
    pullBrowser[2] !== pullRun[1] ||
    merge[1] !== merge[2] ||
    freshRun[1] !== freshRun[2] ||
    freshQuality[1] !== freshQuality[3] ||
    freshQuality[2] !== freshRun[1] ||
    freshBrowser[1] !== freshBrowser[3] ||
    freshBrowser[2] !== freshRun[1] ||
    freshSha[1] !== merge[1] ||
    head[1] === merge[1] ||
    pullRun[1] === freshRun[1] ||
    new Set([pullQuality[1], pullBrowser[1], freshQuality[1], freshBrowser[1]]).size !== 4
  ) {
    return undefined;
  }
  return Object.freeze({
    prNumber: pullRequest[1],
    headSha: head[1],
    pullRunId: pullRun[1],
    pullQualityJobId: pullQuality[1],
    pullBrowserJobId: pullBrowser[1],
    mergeSha: merge[1],
    freshRunId: freshRun[1],
    freshQualityJobId: freshQuality[1],
    freshBrowserJobId: freshBrowser[1],
  });
}

function authenticateProofDocument(proofDocument, artifactSha256) {
  if (!proofDocument.endsWith("\n") || proofDocument.endsWith("\n\n")) {
    fail("REPORT_DRIFT", "Visible T03 proof is not one canonical marker inventory.");
  }
  const observed = proofDocument.slice(0, -1).split("\n\n");
  const pending = pendingProofDocumentMarkerInventory(artifactSha256);
  const dateIsCanonical = /^\*\*Last verified:\*\* \d{4}-\d{2}-\d{2}$/u.test(observed[1]);
  if (dateIsCanonical) observed[1] = pending[1];
  if (isDeepStrictEqual(observed, pending)) return;
  const receipt = captureDoneProofReceipts(observed);
  if (
    receipt !== undefined &&
    isDeepStrictEqual(observed, doneProofDocumentMarkerInventory(artifactSha256, receipt))
  ) {
    return;
  }
  fail("REPORT_DRIFT", "Visible T03 proof marker inventory drifted.");
}

/** Verify checkpointed T03 evidence against fresh built-package and Chromium observations. */
export async function verifyM10AT03Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, [
    "workspaceRoot",
    "artifactBytes",
    "proofDocumentBytes",
    "runtime",
    "coreRuntime",
    "fileOverrides",
    "browserObservation",
    "graphObservation",
    "environment",
  ]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  let artifactBytes;
  let checkpointHeadSha256 = "TEST_OVERRIDE";
  if (options.artifactBytes === undefined) {
    const frozen = await readCheckpointedFrozenArtifact("M10A-T03", { workspaceRoot });
    if (frozen.path !== ARTIFACT_RELATIVE_PATH) {
      fail("ARTIFACT_DRIFT", "Checkpointed T03 artifact path drifted.");
    }
    artifactBytes = Buffer.from(frozen.bytes);
    checkpointHeadSha256 = frozen.checkpointHeadSha256;
  } else {
    artifactBytes = captureBytes(options.artifactBytes, "artifactBytes");
  }
  let browserObservation = options.browserObservation;
  let graphObservation = options.graphObservation;
  if (browserObservation === undefined || graphObservation === undefined) {
    if (browserObservation !== undefined || graphObservation !== undefined) {
      fail("OPTIONS_INVALID", "Browser and graph observations must be supplied together.");
    }
    const observed = await executeM10AT03BrowserProof({
      workspaceRoot,
      command: "built",
      ...(options.environment === undefined ? {} : { environment: options.environment }),
    });
    browserObservation = observed.browserObservation;
    graphObservation = observed.graphObservation;
  }
  const built = await buildM10AT03Evidence({
    workspaceRoot,
    browserObservation,
    graphObservation,
    ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    ...(options.coreRuntime === undefined ? {} : { coreRuntime: options.coreRuntime }),
    ...(options.fileOverrides === undefined ? {} : { fileOverrides: options.fileOverrides }),
  });
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Stored T03 artifact differs from fresh evidence.");
  }
  const proofBytes = await readVisibleProof(workspaceRoot, options.proofDocumentBytes);
  let proofDocument;
  try {
    proofDocument = new TextDecoder("utf-8", { fatal: true }).decode(proofBytes);
  } catch {
    fail("REPORT_DRIFT", "Visible T03 proof is not valid UTF-8.");
  }
  authenticateProofDocument(proofDocument, built.artifactSha256);
  return Object.freeze({
    status: "PASS",
    task: "M10A-T03",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    checkpointHeadSha256,
    authoringRuntimeExports: built.artifact.publicPackage.requiredRuntimeExports.length,
    neutralTokens: built.artifact.authoring.neutral.tokenCount,
    browserCases: built.artifact.workbench.exactBrowserCases,
    browserAssertions: built.artifact.workbench.exactBrowserAssertions,
    t02ArtifactSha256: built.artifact.frozenAuthorities.t02.artifact.sha256,
    sc01ArtifactSha256: built.artifact.frozenAuthorities.sc01.artifact.sha256,
    sc01ValidFixtures:
      built.artifact.authoring.transfer.reviewedUnsupportedMatrix.frozenSc01.validFixtures,
    sc01PreviewReadyUnderT02:
      built.artifact.authoring.transfer.reviewedUnsupportedMatrix.frozenSc01.previewReadyUnderT02,
    sc01PreservedUnsupported:
      built.artifact.authoring.transfer.reviewedUnsupportedMatrix.frozenSc01.preservedUnsupported,
    t02RecognizedUnsupportedFixtures:
      built.artifact.authoring.transfer.reviewedUnsupportedMatrix.t02RecognizedUnsupported
        .validFixtures,
    t02RecognizedMalformedFixtures:
      built.artifact.authoring.transfer.reviewedUnsupportedMatrix.t02RecognizedUnsupported
        .malformedFixtures,
    protocolAggregateSha256: built.artifact.frozenAuthorities.protocol.aggregateSha256,
    runtimeCoreTree: built.artifact.frozenAuthorities.runtimeCore.tree,
    browserExecutedByVerifier:
      options.browserObservation === undefined && options.graphObservation === undefined,
    externalNetwork: false,
  });
}

async function assertWritableArtifactDestination(artifactPath) {
  try {
    const entry = await lstat(artifactPath, { bigint: true });
    if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) {
      fail("ARTIFACT_WRITE_UNSAFE", "Artifact destination must be one unlinked regular file.");
    }
  } catch (error) {
    if (error instanceof M10AT03ProofError) throw error;
    if (error?.code !== "ENOENT") {
      fail("ARTIFACT_WRITE_UNSAFE", "Artifact destination could not be inspected safely.");
    }
  }
}

/** Execute and atomically write exact deterministic T03 evidence. */
export async function writeM10AT03Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, [
    "workspaceRoot",
    "artifactPath",
    "beforeAtomicRename",
    "browserObservation",
    "graphObservation",
  ]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const artifactPath = options.artifactPath ?? path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (
    typeof artifactPath !== "string" ||
    !path.isAbsolute(artifactPath) ||
    path.resolve(artifactPath) !== artifactPath ||
    artifactPath.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "artifactPath must be one canonical absolute path.");
  }
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  if ((options.browserObservation === undefined) !== (options.graphObservation === undefined)) {
    fail("OPTIONS_INVALID", "Browser and graph observations must be supplied together.");
  }
  const canonicalArtifactPath = path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (options.browserObservation !== undefined && artifactPath === canonicalArtifactPath) {
    fail("OPTIONS_INVALID", "The canonical artifact requires a fresh real browser capture.");
  }
  let built;
  if (options.browserObservation === undefined) {
    const observed = await executeM10AT03BrowserProof({ workspaceRoot, command: "capture" });
    built = await buildM10AT03Evidence({ workspaceRoot, ...observed });
  } else {
    built = await buildM10AT03Evidence({
      workspaceRoot,
      browserObservation: options.browserObservation,
      graphObservation: options.graphObservation,
    });
  }
  await assertWritableArtifactDestination(artifactPath);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    if (error instanceof M10AT03ProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic T03 evidence write failed.");
  }
  return Object.freeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
  });
}

/** Relative tracked path of the deterministic T03 evidence artifact. */
export const M10A_T03_ARTIFACT_PATH = ARTIFACT_RELATIVE_PATH;
