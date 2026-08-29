import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readFile, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH,
  verifyReferenceSignInFixturesAndHostBindingEvidence,
} from "./reference-sign-in-fixtures-and-host-binding-proof.mjs";
import {
  DEFAULT_WEB_REACT_PACKAGE_DIGEST_ARTIFACT_PATH,
  verifyWebReactPackageDigestEvidence,
} from "./web-react-package-digest-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const FIXTURES_SCENARIOS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json",
);
const FIXTURES_SCENARIOS_ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const AUTHORITY_READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Absolute path to the deterministic M03-T09 parity artifact. */
export const DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-catalog-web-parity.json",
);

const DEFAULT_PATHS = Object.freeze({
  parityConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/parity-consumer.mjs",
  ),
  componentsConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/form-feedback-components-consumer.mjs",
  ),
  operationsConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/operations-consumer.mjs",
  ),
  hostOperationsConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/host-operations-consumer.mjs",
  ),
  packageRootConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/package-consumer.mjs",
  ),
  metadataSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
  ),
  parityIndexSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/parity/index.ts",
  ),
  packageRootIndexSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/index.ts",
  ),
  componentContractsSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/components/contracts.ts",
  ),
  interactiveContractsSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/components/interactive-contracts.ts",
  ),
  operationSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/operations/sign-in.ts",
  ),
  parityDeclarationPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/parity/index.d.ts",
  ),
  referencePackagePath: path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/package.json"),
  rootPackagePath: path.join(WORKSPACE_ROOT, "package.json"),
  officialCatalogPath: path.join(
    WORKSPACE_ROOT,
    "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
  ),
  traceabilityPath: path.join(WORKSPACE_ROOT, "docs/proof/protocol-0.1.0-traceability.json"),
  proofDocumentPath: path.join(WORKSPACE_ROOT, "docs/proof/REFERENCE-CATALOG-WEB-PARITY.md"),
  normativeCoveragePath: path.join(WORKSPACE_ROOT, "docs/proof/NORMATIVE-COVERAGE.md"),
  proofMatrixPath: path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md"),
  foundationTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/foundation-components.test.tsx",
  ),
  interactiveTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/interactive-components.test.tsx",
  ),
  metadataTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/parity-metadata.test.ts",
  ),
  contractTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/parity-contracts.test.tsx",
  ),
  typeTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/parity-metadata.types.ts",
  ),
  rootTestPath: path.join(WORKSPACE_ROOT, "tests/reference-catalog-web-parity.test.mjs"),
  packageDigestArtifactPath: DEFAULT_WEB_REACT_PACKAGE_DIGEST_ARTIFACT_PATH,
  signInArtifactPath: DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH,
  fixturesScenariosArtifactPath: FIXTURES_SCENARIOS_ARTIFACT_PATH,
});

const BUILD_OPTION_NAMES = Object.freeze([
  "parityApi",
  "componentApi",
  "operationsApi",
  "hostOperationsApi",
  "packageRootApi",
  "catalogSdkApi",
  "validatorApi",
  ...Object.keys(DEFAULT_PATHS),
  "verifyPrerequisites",
]);

const COMPONENT_IDS = Object.freeze([
  "com.example.ui/Alert",
  "com.example.ui/Button",
  "com.example.ui/Stack",
  "com.example.ui/Text",
  "com.example.ui/TextField",
]);
const OPERATION_ID = "com.example.auth/signIn";

const COMPONENT_EXPORTS = Object.freeze({
  "com.example.ui/Alert": "Alert",
  "com.example.ui/Button": "Button",
  "com.example.ui/Stack": "Stack",
  "com.example.ui/Text": "Text",
  "com.example.ui/TextField": "TextField",
});

const COMPONENT_REGISTRATION_EXPORTS = Object.freeze({
  "com.example.ui/Alert": "alertComponentRegistration",
  "com.example.ui/Button": "buttonComponentRegistration",
  "com.example.ui/Stack": "stackComponentRegistration",
  "com.example.ui/Text": "textComponentRegistration",
  "com.example.ui/TextField": "textFieldComponentRegistration",
});

const EXPECTED_BINDINGS = Object.freeze({
  "com.example.ui/Alert": Object.freeze({ slots: {}, events: {}, commands: {} }),
  "com.example.ui/Button": Object.freeze({
    slots: {},
    events: { press: "onPress" },
    commands: {},
  }),
  "com.example.ui/Stack": Object.freeze({
    slots: { default: "children" },
    events: {},
    commands: {},
  }),
  "com.example.ui/Text": Object.freeze({ slots: {}, events: {}, commands: {} }),
  "com.example.ui/TextField": Object.freeze({
    slots: {},
    events: { change: "onChange" },
    commands: { focus: "ref.focus" },
  }),
});

const EXPECTED_STYLE_PARTS = Object.freeze({
  "com.example.ui/Alert": Object.freeze({
    icon: {
      meaning: "Decorative tone indicator when trusted icon content exists.",
      presence: "conditional",
    },
    root: { meaning: "Feedback live-region container.", presence: "always" },
    text: { meaning: "Visible inert feedback text.", presence: "always" },
  }),
  "com.example.ui/Button": Object.freeze({
    label: { meaning: "Visible native button label.", presence: "always" },
    leadingIcon: {
      meaning: "Decorative leading-icon surface when trusted icon content exists.",
      presence: "conditional",
    },
    root: { meaning: "Native non-submit button control.", presence: "always" },
  }),
  "com.example.ui/Stack": Object.freeze({
    root: { meaning: "Neutral linear-layout container.", presence: "always" },
  }),
  "com.example.ui/Text": Object.freeze({
    text: { meaning: "Native semantic text element containing inert text.", presence: "always" },
  }),
  "com.example.ui/TextField": Object.freeze({
    control: { meaning: "Native text input control.", presence: "always" },
    label: {
      meaning: "Visible label associated with the native text input.",
      presence: "always",
    },
    message: {
      meaning: "Validation-message surface when trusted message content exists.",
      presence: "conditional",
    },
    root: { meaning: "Text-field layout container.", presence: "always" },
  }),
});

const EXPECTED_ACCESSIBILITY = Object.freeze({
  "com.example.ui/Alert": "native-feedback-live-region",
  "com.example.ui/Button": "native-non-submit-action",
  "com.example.ui/Stack": "neutral-layout-reading-order",
  "com.example.ui/Text": "native-semantic-text",
  "com.example.ui/TextField": "native-labelled-text-input",
});

const EXPECTED_COMPONENT_API_EXPORTS = Object.freeze([
  "ALERT_CAPABILITY_ID",
  "Alert",
  "BUTTON_CAPABILITY_ID",
  "Button",
  "STACK_CAPABILITY_ID",
  "Stack",
  "TEXT_CAPABILITY_ID",
  "TEXT_FIELD_CAPABILITY_ID",
  "Text",
  "TextField",
  "alertComponentRegistration",
  "buttonComponentRegistration",
  "stackComponentRegistration",
  "textComponentRegistration",
  "textFieldComponentRegistration",
]);
const EXPECTED_PACKAGE_ROOT_EXPORTS = Object.freeze([
  "WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER",
  "WEB_REACT_PACKAGE_DIGEST_PROFILE",
  "createWebReactPackageDigest",
  "encodeWebReactPackageDigestPreimage",
  "verifyWebReactPackageDigest",
]);
const EXPECTED_PARITY_TYPE_EXPORTS = Object.freeze([
  "ReferenceWebAccessibilityContract",
  "ReferenceWebComponentImplementationContract",
  "ReferenceWebDeclaredComponentSurfaces",
  "ReferenceWebImplementationMetadata",
  "ReferenceWebOperationImplementationContract",
  "ReferenceWebStylePartContract",
  "ReferenceWebStylePartPresence",
  "ReferenceWebTrustedComponentBindings",
]);

const EXPECTED_PACKAGE_TESTS = Object.freeze({
  foundation: Object.freeze([
    "registers exact closed public contracts as detached immutable data",
    "renders Stack as a neutral flex container while preserving child order",
    "keeps Stack defaults deterministic and does not invent spacing",
    "maps Text roles to native non-interactive semantics",
    "renders hostile markup-like text as inert escaped content",
  ]),
  interaction: Object.freeze([
    "registers the three exact closed interaction contracts as immutable data",
    "associates every visible TextField label with one unique native input",
    "maps TextField invalid and disabled states without inventing error content",
    "emits a fresh frozen exact TextField change payload and no DOM event",
    "suppresses TextField change and focus bridges while disabled",
    "exposes only the narrow frozen TextField focus command handle",
    "emits fresh frozen empty Button press payloads from native activation",
    "suppresses Button press while preserving focus during loading",
    "maps every Button variant without creating toggle or submit semantics",
    "uses polite status roles for ordinary Alert tones and alert only for critical",
    "keeps TextField, Button, and Alert strings inert",
  ]),
  metadata: Object.freeze([
    "publishes frozen executable-free metadata for only the exact sign-in reference slice",
    "matches every selected official component and operation entry without claiming the full example Catalog",
    "covers every declared component surface and only that surface",
    "binds same-fidelity authoring and production roles to the same real component export",
    "documents every style part as a semantic hook without inventing always-present content",
    "records the exact explicitly delegated sign-in binding without carrying a handler",
  ]),
  contracts: Object.freeze([
    "guarantees exact fresh frozen event payloads without native-event leakage",
    "implements only the declared focus command through a narrow frozen handle",
    "preserves cumulative native accessibility semantics and declared content order",
    "keeps undeclared DOM, raw-HTML, and executable values outside component output",
  ]),
});

const EXPECTED_TYPE_NEGATIVE_CASES = Object.freeze(
  Array.from({ length: 10 }, (_, index) => `M03-T09-N${String(index + 1).padStart(2, "0")}`),
);

const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T09 evidence",
  "builds byte-identical injected evidence twice",
  "keeps unrelated normative and root-script growth outside task-owned evidence bytes",
  "rejects unsafe or unknown build options without invoking accessors",
  "rejects stale and one-byte-tampered evidence",
  "rejects missing mismatched and skipped prerequisites for tracked evidence",
  "rejects missing extra wrong-category and renamed component surfaces",
  "rejects authoring-production identity and operation-binding drift",
  "rejects executable or loader-bearing parity metadata",
  "rejects official registration and validator-contract drift",
  "rejects public export and transitive source-boundary drift",
  "rejects package-test type-negative trace and command-wiring drift",
  "rejects tracked-artifact verification through a symlink alias",
  "writes injected evidence atomically and detects temporary-byte tampering",
]);

const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  generate:
    "pnpm verify:reference-sign-in-fixtures-and-host-binding && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:parity && node scripts/generate-reference-catalog-web-parity-proof.mjs",
  verify:
    "pnpm verify:reference-sign-in-fixtures-and-host-binding && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:parity && node scripts/verify-reference-catalog-web-parity.mjs",
  test: "pnpm verify:reference-sign-in-fixtures-and-host-binding && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:parity && node --test tests/reference-catalog-web-parity.test.mjs",
});

const HISTORICAL_NORMATIVE_STATUSES = Object.freeze([
  Object.freeze({ id: "N-030", status: "PLANNED" }),
  Object.freeze({ id: "N-033", status: "PLANNED" }),
  Object.freeze({ id: "N-034", status: "PLANNED" }),
  Object.freeze({ id: "S-001", status: "PLANNED" }),
  Object.freeze({ id: "S-004", status: "TESTED" }),
]);
const NORMATIVE_STATUS_RANK = Object.freeze({
  NOT_STARTED: -1,
  PLANNED: 0,
  TESTED: 1,
});
const PROOF_MATRIX_STATUS_RANK = Object.freeze({
  PARTIAL: 0,
  PROVEN: 1,
});
const HISTORICAL_P06_STATUS = "PARTIAL";
const MONOTONIC_NORMATIVE_STATUS_IDS = new Set(["N-033", "N-034"]);
const FIXTURES_SCENARIOS_ARTIFACT_PIN = Object.freeze({
  task: "M09-T11",
  proofId: "desen-app-fixtures-scenarios-fidelity",
  profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
  result: "PASS",
  bytes: 29_407,
  sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
});
const HISTORICAL_PARITY_ARTIFACT_PIN = Object.freeze({
  task: "M03-T09",
  path: "docs/proof/artifacts/reference-catalog-web-parity.json",
  bytes: 18_146,
  sha256: "6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a",
  result: "PASS",
  immutable: true,
});
const HISTORICAL_SELF_RECORD = Object.freeze({
  path: "scripts/lib/reference-catalog-web-parity-proof.mjs",
  bytes: 69_947,
  sha256: "499260f8df96c457562c36f52e45f01c8cc7bcf0d096844196253d99afa4d31d",
});
const HISTORICAL_ROOT_TEST_RECORD = Object.freeze({
  path: "tests/reference-catalog-web-parity.test.mjs",
  bytes: 26_148,
  sha256: "e5dfc582b0743522db9e7ed2fa29df0a41dade40890a8ed950a4a8b220e55951",
});

const STRONG_TRACE_IDS = Object.freeze([
  "A-005",
  "C-017",
  "C-019",
  "R-006",
  "R-020",
  "R-066",
  "R-084",
  "R-086",
]);
const PARTIAL_TRACE_IDS = Object.freeze([
  "A-011",
  "A-013",
  "C-006",
  "C-018",
  "C-020",
  "R-004",
  "R-013",
  "R-068",
  "R-072",
  "R-087",
  "R-088",
  "R-089",
  "R-090",
  "R-131",
]);

const TRACKED_EVIDENCE_PATHS = Object.freeze([
  "docs/adr/0007-inert-parity-metadata-before-runtime-registration.md",
  "docs/proof/REFERENCE-CATALOG-WEB-PARITY.md",
  "packages/reference-catalog-web/src/components/alert.tsx",
  "packages/reference-catalog-web/src/components/button.tsx",
  "packages/reference-catalog-web/src/components/contracts.ts",
  "packages/reference-catalog-web/src/components/interactive-contracts.ts",
  "packages/reference-catalog-web/src/components/stack.tsx",
  "packages/reference-catalog-web/src/components/text-field.tsx",
  "packages/reference-catalog-web/src/components/text.tsx",
  "packages/reference-catalog-web/src/host-operations/sign-in.ts",
  "packages/reference-catalog-web/src/operations/sign-in.ts",
  "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
  "packages/reference-catalog-web/test/form-feedback-components-consumer.mjs",
  "packages/reference-catalog-web/test/foundation-components.test.tsx",
  "packages/reference-catalog-web/test/interactive-components.test.tsx",
  "packages/reference-catalog-web/test/parity-consumer.mjs",
  "packages/reference-catalog-web/test/parity-contracts.test.tsx",
  "packages/reference-catalog-web/test/parity-metadata.test.ts",
  "packages/reference-catalog-web/test/parity-metadata.types.ts",
  "scripts/generate-reference-catalog-web-parity-proof.mjs",
  "scripts/verify-reference-catalog-web-parity.mjs",
  "scripts/lib/reference-catalog-web-parity-proof.mjs",
  "tests/reference-catalog-web-parity.test.mjs",
]);

const FORBIDDEN_METADATA_KEYS = new Set([
  "authorization",
  "credential",
  "database",
  "endpoint",
  "execute",
  "handler",
  "invoke",
  "loader",
  "module",
  "modulePath",
  "sdk",
  "selector",
  "url",
]);

const EXPECTED_METADATA_SOURCE_CALLS = Object.freeze({
  "Array.isArray": 3,
  "JSON.parse": 1,
  "JSON.stringify": 2,
  "Object.create": 1,
  "Object.freeze": 43,
  "Object.hasOwn": 1,
  "Object.keys": 2,
  "Object.keys(implemented).sort": 1,
  "Object.keys(requireRecord(value, label)).sort": 1,
  "Object.values": 1,
  assertExactNames: 4,
  buildComponentContracts: 1,
  canonicalNames: 5,
  canonicalizeJson: 1,
  "codes.some": 1,
  componentSurfaces: 1,
  "declared.some": 1,
  declaredVisualStates: 1,
  deepFreeze: 2,
  "errors.map": 1,
  "errors.some": 1,
  fail: 9,
  immutableMetadata: 1,
  isRecord: 2,
  requireRecord: 3,
  signInPublicErrors: 1,
  "value.some": 1,
});

/** Stable M03-T09 proof failure with a machine-readable code. */
export class ReferenceCatalogWebParityEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceCatalogWebParityEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceCatalogWebParityEvidenceError(code, message, details);
}

function assertCondition(condition, code, message, details = undefined) {
  if (!condition) fail(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function canonicalComparable(value) {
  if (Array.isArray(value)) return value.map(canonicalComparable);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    sorted(Object.keys(value)).map((key) => [key, canonicalComparable(value[key])]),
  );
}

function jsonText(value) {
  return JSON.stringify(canonicalComparable(value));
}

function assertJsonEqual(actual, expected, code, message) {
  assertCondition(jsonText(actual) === jsonText(expected), code, message, { actual, expected });
}

function assertExactKeys(value, expected, code, message) {
  assertCondition(
    value !== null && typeof value === "object" && !Array.isArray(value),
    code,
    message,
  );
  const keys = Reflect.ownKeys(value);
  assertCondition(
    keys.every((key) => typeof key === "string"),
    code,
    message,
  );
  assertJsonEqual(sorted(keys), sorted(expected), code, message);
}

function normalizeOptions(options, allowedNames, label) {
  if (options === undefined) return Object.freeze({});
  assertCondition(
    options !== null && typeof options === "object" && !Array.isArray(options),
    "REFERENCE_PARITY_OPTIONS_INVALID",
    `${label} options must be a plain record.`,
  );
  const prototype = Object.getPrototypeOf(options);
  assertCondition(
    prototype === Object.prototype || prototype === null,
    "REFERENCE_PARITY_OPTIONS_INVALID",
    `${label} options must not inherit values.`,
  );
  const descriptors = Object.getOwnPropertyDescriptors(options);
  assertCondition(
    Reflect.ownKeys(descriptors).every((key) => typeof key === "string"),
    "REFERENCE_PARITY_OPTIONS_INVALID",
    `${label} options must not use symbol keys.`,
  );
  const normalized = Object.create(null);
  for (const [name, descriptor] of Object.entries(descriptors)) {
    assertCondition(
      allowedNames.includes(name) &&
        descriptor.enumerable &&
        Object.hasOwn(descriptor, "value") &&
        !Object.hasOwn(descriptor, "get") &&
        !Object.hasOwn(descriptor, "set"),
      "REFERENCE_PARITY_OPTIONS_INVALID",
      `${label} option ${JSON.stringify(name)} is unknown or accessor-backed.`,
    );
    normalized[name] = descriptor.value;
  }
  return Object.freeze(normalized);
}

function validateBuildOptions(options) {
  for (const name of Object.keys(DEFAULT_PATHS)) {
    if (!Object.hasOwn(options, name)) continue;
    assertCondition(
      typeof options[name] === "string" && options[name].length > 0,
      "REFERENCE_PARITY_OPTIONS_INVALID",
      `${name} must be a non-empty path string.`,
    );
  }
  if (Object.hasOwn(options, "verifyPrerequisites")) {
    assertCondition(
      typeof options.verifyPrerequisites === "boolean",
      "REFERENCE_PARITY_OPTIONS_INVALID",
      "verifyPrerequisites must be boolean.",
    );
  }
}

function captureApi(module, names, label, exact = false) {
  assertCondition(
    module !== null &&
      (typeof module === "object" || typeof module === "function") &&
      !utilTypes.isProxy(module),
    "REFERENCE_PARITY_API_DRIFT",
    `${label} must be a module-like object.`,
  );
  const expected = sorted(names);
  const ownKeys = Reflect.ownKeys(module);
  assertCondition(
    ownKeys.every((key) => typeof key === "string" || key === Symbol.toStringTag),
    "REFERENCE_PARITY_EXPORT_DRIFT",
    `${label} contains an unexpected symbol export.`,
  );
  const actual = sorted(ownKeys.filter((key) => typeof key === "string"));
  const descriptors = Object.getOwnPropertyDescriptors(module);
  assertCondition(
    actual.every((name) => {
      const descriptor = descriptors[name];
      return (
        descriptor.enumerable &&
        Object.hasOwn(descriptor, "value") &&
        !Object.hasOwn(descriptor, "get") &&
        !Object.hasOwn(descriptor, "set")
      );
    }),
    "REFERENCE_PARITY_EXPORT_DRIFT",
    `${label} exports must be enumerable data properties.`,
  );
  if (exact) {
    assertJsonEqual(actual, expected, "REFERENCE_PARITY_EXPORT_DRIFT", `${label} exports drifted.`);
  } else {
    assertCondition(
      expected.every((name) => actual.includes(name)),
      "REFERENCE_PARITY_API_DRIFT",
      `${label} is missing a required export.`,
      { actual, expected },
    );
  }
  const snapshot = Object.fromEntries(expected.map((name) => [name, descriptors[name]?.value]));
  return Object.freeze({
    api: Object.freeze(snapshot),
    assertStable() {
      for (const name of expected) {
        assertCondition(
          module[name] === snapshot[name],
          "REFERENCE_PARITY_API_MUTATED",
          `${label} export ${name} changed during proof construction.`,
        );
      }
    },
  });
}

function enumerableDataEntries(value, label) {
  assertCondition(
    !utilTypes.isProxy(value),
    "REFERENCE_PARITY_EXECUTABLE_METADATA",
    `${label} must not be a Proxy.`,
  );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  assertCondition(
    ownKeys.every((key) => typeof key === "string"),
    "REFERENCE_PARITY_EXECUTABLE_METADATA",
    `${label} must not contain symbol keys.`,
  );
  if (Array.isArray(value)) {
    const expectedIndexes = [...value.keys()].map(String);
    assertJsonEqual(
      sorted(ownKeys.filter((key) => key !== "length")),
      sorted(expectedIndexes),
      "REFERENCE_PARITY_EXECUTABLE_METADATA",
      `${label} must be a dense JSON array without hidden properties.`,
    );
    const lengthDescriptor = descriptors.length;
    assertCondition(
      lengthDescriptor !== undefined &&
        Object.hasOwn(lengthDescriptor, "value") &&
        lengthDescriptor.value === value.length,
      "REFERENCE_PARITY_EXECUTABLE_METADATA",
      `${label} has an invalid array length descriptor.`,
    );
    return expectedIndexes.map((key) => {
      const descriptor = descriptors[key];
      assertCondition(
        descriptor.enumerable &&
          Object.hasOwn(descriptor, "value") &&
          !Object.hasOwn(descriptor, "get") &&
          !Object.hasOwn(descriptor, "set"),
        "REFERENCE_PARITY_EXECUTABLE_METADATA",
        `${label}.${key} must be an enumerable data property.`,
      );
      return [key, descriptor.value];
    });
  }
  assertCondition(
    Object.getPrototypeOf(value) === Object.prototype &&
      ownKeys.every((key) => {
        const descriptor = descriptors[key];
        return (
          descriptor.enumerable &&
          Object.hasOwn(descriptor, "value") &&
          !Object.hasOwn(descriptor, "get") &&
          !Object.hasOwn(descriptor, "set")
        );
      }),
    "REFERENCE_PARITY_EXECUTABLE_METADATA",
    `${label} must contain only enumerable plain-data string properties.`,
  );
  return ownKeys.map((key) => [key, descriptors[key].value]);
}

function assertDeeplyFrozen(value, label, active = new Set()) {
  if (value === null || typeof value !== "object") return;
  assertCondition(!active.has(value), "REFERENCE_PARITY_METADATA_INVALID", `${label} is cyclic.`);
  assertCondition(
    Object.isFrozen(value),
    "REFERENCE_PARITY_METADATA_INVALID",
    `${label} must be recursively frozen.`,
  );
  active.add(value);
  for (const [key, nested] of enumerableDataEntries(value, label)) {
    assertDeeplyFrozen(nested, `${label}.${key}`, active);
  }
  active.delete(value);
}

function inspectExecutableFreeJson(value, label, active = new Set()) {
  const valueType = typeof value;
  assertCondition(
    value !== undefined &&
      valueType !== "function" &&
      valueType !== "symbol" &&
      valueType !== "bigint",
    "REFERENCE_PARITY_EXECUTABLE_METADATA",
    `${label} contains a non-JSON or executable value.`,
  );
  if (value === null || valueType !== "object") return;
  assertCondition(
    !utilTypes.isProxy(value),
    "REFERENCE_PARITY_EXECUTABLE_METADATA",
    `${label} must not be a Proxy.`,
  );
  assertCondition(
    !active.has(value) &&
      (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype),
    "REFERENCE_PARITY_EXECUTABLE_METADATA",
    `${label} must be acyclic plain JSON.`,
  );
  active.add(value);
  for (const [key, nested] of enumerableDataEntries(value, label)) {
    assertCondition(
      !FORBIDDEN_METADATA_KEYS.has(key),
      "REFERENCE_PARITY_EXECUTABLE_METADATA",
      `${label} contains forbidden executable-selection key ${JSON.stringify(key)}.`,
    );
    inspectExecutableFreeJson(nested, `${label}.${key}`, active);
  }
  active.delete(value);
}

function exactManifestSurface(manifest, key) {
  if (key === "props") return sorted(Object.keys(manifest.propsSchema?.properties ?? {}));
  if (key === "visualStates") return [...(manifest.visualStates ?? [])];
  return sorted(Object.keys(manifest[key] ?? {}));
}

function inspectMetadata({
  metadata,
  componentApi,
  operationsApi,
  hostOperationsApi,
  officialCatalog,
}) {
  inspectExecutableFreeJson(metadata, "parity metadata");
  assertDeeplyFrozen(metadata, "parity metadata");
  assertJsonEqual(
    sorted(Object.keys(metadata)),
    [
      "behaviors",
      "components",
      "operations",
      "protocol",
      "resources",
      "schemaVersion",
      "scope",
      "target",
    ],
    "REFERENCE_PARITY_METADATA_DRIFT",
    "Top-level parity metadata fields drifted.",
  );
  assertCondition(
    metadata.schemaVersion === 1 &&
      metadata.protocol === "0.1.0" &&
      metadata.target === "web-react" &&
      metadata.scope === "reference-sign-in-slice",
    "REFERENCE_PARITY_METADATA_DRIFT",
    "Parity identity or scope drifted.",
  );
  assertJsonEqual(
    sorted(Object.keys(metadata.components)),
    COMPONENT_IDS,
    "REFERENCE_PARITY_SURFACE_DRIFT",
    "The exact component slice drifted.",
  );
  assertJsonEqual(
    metadata.behaviors,
    {},
    "REFERENCE_PARITY_CATEGORY_DRIFT",
    "Behaviors must be empty.",
  );
  assertJsonEqual(
    metadata.resources,
    {},
    "REFERENCE_PARITY_CATEGORY_DRIFT",
    "Resources must be empty.",
  );

  const componentEvidence = [];
  for (const capabilityId of COMPONENT_IDS) {
    const registrationName = COMPONENT_REGISTRATION_EXPORTS[capabilityId];
    const exportName = COMPONENT_EXPORTS[capabilityId];
    const registration = componentApi[registrationName];
    const contract = metadata.components[capabilityId];
    assertExactKeys(
      contract,
      [
        "accessibilityContract",
        "adapterFidelity",
        "authoringExport",
        "capabilityId",
        "declared",
        "differences",
        "productionExport",
        "trustedBindings",
      ],
      "REFERENCE_PARITY_METADATA_DRIFT",
      `${capabilityId} implementation contract fields drifted.`,
    );
    assertExactKeys(
      contract.declared,
      ["commands", "events", "props", "slots", "styleParts", "visualStates"],
      "REFERENCE_PARITY_METADATA_DRIFT",
      `${capabilityId} declared surface fields drifted.`,
    );
    assertExactKeys(
      contract.trustedBindings,
      ["commands", "events", "slots"],
      "REFERENCE_PARITY_METADATA_DRIFT",
      `${capabilityId} trusted-binding fields drifted.`,
    );
    assertCondition(
      registration?.id === capabilityId && contract?.capabilityId === capabilityId,
      "REFERENCE_PARITY_REGISTRATION_DRIFT",
      `${capabilityId} registration identity drifted.`,
    );
    assertJsonEqual(
      registration.manifest,
      officialCatalog.components[capabilityId],
      "REFERENCE_PARITY_OFFICIAL_DRIFT",
      `${capabilityId} no longer equals the selected official entry.`,
    );
    for (const surface of ["props", "slots", "events", "commands", "visualStates"]) {
      assertJsonEqual(
        contract.declared[surface],
        exactManifestSurface(registration.manifest, surface),
        "REFERENCE_PARITY_SURFACE_DRIFT",
        `${capabilityId} ${surface} surface drifted.`,
      );
    }
    assertJsonEqual(
      contract.declared.styleParts,
      EXPECTED_STYLE_PARTS[capabilityId],
      "REFERENCE_PARITY_STYLE_DRIFT",
      `${capabilityId} style-part semantics drifted.`,
    );
    assertJsonEqual(
      contract.trustedBindings,
      EXPECTED_BINDINGS[capabilityId],
      "REFERENCE_PARITY_BINDING_DRIFT",
      `${capabilityId} trusted binding map drifted.`,
    );
    assertCondition(
      contract.productionExport === exportName &&
        contract.authoringExport === exportName &&
        contract.adapterFidelity === registration.manifest.authoring?.adapterFidelity &&
        contract.adapterFidelity === "same" &&
        Array.isArray(contract.differences) &&
        contract.differences.length === 0,
      "REFERENCE_PARITY_FIDELITY_DRIFT",
      `${capabilityId} authoring/production fidelity drifted.`,
    );
    assertCondition(
      typeof componentApi[exportName] === "function" &&
        componentApi[contract.authoringExport] === componentApi[contract.productionExport],
      "REFERENCE_PARITY_IMPLEMENTATION_IDENTITY_DRIFT",
      `${capabilityId} roles no longer resolve to the same real component export.`,
    );
    assertCondition(
      contract.accessibilityContract === EXPECTED_ACCESSIBILITY[capabilityId],
      "REFERENCE_PARITY_ACCESSIBILITY_DRIFT",
      `${capabilityId} accessibility policy drifted.`,
    );
    componentEvidence.push({
      capabilityId,
      implementationExport: exportName,
      adapterFidelity: "same",
      props: contract.declared.props,
      slots: contract.declared.slots,
      events: contract.declared.events,
      commands: contract.declared.commands,
      styleParts: Object.keys(contract.declared.styleParts),
      visualStates: contract.declared.visualStates,
      accessibilityContract: contract.accessibilityContract,
    });
  }

  assertCondition(
    Object.keys(officialCatalog.components).length > COMPONENT_IDS.length &&
      Object.keys(officialCatalog.behaviors).length > 0 &&
      Object.keys(officialCatalog.resources).length > 0,
    "REFERENCE_PARITY_SCOPE_OVERCLAIM",
    "The proof guard can no longer distinguish the selected slice from the full official Catalog.",
  );
  assertJsonEqual(
    sorted(Object.keys(metadata.operations)),
    [OPERATION_ID],
    "REFERENCE_PARITY_CATEGORY_DRIFT",
    "The exact delegated operation slice drifted.",
  );
  assertJsonEqual(
    operationsApi.signInOperationRegistration.manifest,
    officialCatalog.operations[OPERATION_ID],
    "REFERENCE_PARITY_OFFICIAL_DRIFT",
    "The sign-in registration no longer equals the selected official entry.",
  );
  assertJsonEqual(
    metadata.operations[OPERATION_ID],
    {
      binding: "application-supplied",
      bindingFactoryExport: "bindReferenceSignInHostOperation",
      capabilityId: OPERATION_ID,
      publicErrors: ["invalidCredentials", "unavailable"],
    },
    "REFERENCE_PARITY_OPERATION_BINDING_DRIFT",
    "The delegated sign-in parity contract drifted.",
  );
  assertCondition(
    typeof hostOperationsApi.bindReferenceSignInHostOperation === "function",
    "REFERENCE_PARITY_OPERATION_BINDING_DRIFT",
    "The named host binding factory is not a real public function.",
  );
  return Object.freeze({
    components: Object.freeze(componentEvidence),
    operation: Object.freeze({
      capabilityId: OPERATION_ID,
      binding: "application-supplied",
      bindingFactoryExport: "bindReferenceSignInHostOperation",
      publicErrors: ["invalidCredentials", "unavailable"],
    }),
  });
}

function inspectResolvedContracts({ catalogSdkApi, validatorApi, componentApi, operationsApi }) {
  const registrations = COMPONENT_IDS.map(
    (capabilityId) => componentApi[COMPONENT_REGISTRATION_EXPORTS[capabilityId]],
  );
  const catalog = catalogSdkApi.createCatalogManifest({
    id: "run.desen.reference.sign-in-parity-proof",
    version: "0.1.0",
    target: "web-react",
    packageDigest: `sha256:${"0".repeat(64)}`,
    components: registrations,
    operations: [operationsApi.signInOperationRegistration],
  });
  const prepared = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  assertCondition(
    prepared.valid,
    "REFERENCE_PARITY_VALIDATOR_DRIFT",
    "The exact selected Catalog slice failed cumulative validator preparation.",
    { diagnostics: prepared.diagnostics },
  );

  const vectors = [
    {
      channel: "TextField.change",
      validate: (payload) =>
        validatorApi.validateDesenEventPayload(
          payload,
          {
            capabilityKind: "component",
            capabilityId: "com.example.ui/TextField",
            eventName: "change",
          },
          prepared.value,
        ),
      positive: { value: "synthetic@example.invalid" },
      negatives: [{ value: 1 }, { value: "synthetic@example.invalid", extra: true }],
    },
    {
      channel: "Button.press",
      validate: (payload) =>
        validatorApi.validateDesenEventPayload(
          payload,
          {
            capabilityKind: "component",
            capabilityId: "com.example.ui/Button",
            eventName: "press",
          },
          prepared.value,
        ),
      positive: {},
      negatives: [{ extra: true }],
    },
    {
      channel: "TextField.focus",
      validate: (input) =>
        validatorApi.validateDesenExecutionValue(
          input,
          {
            kind: "component-command-input",
            capabilityId: "com.example.ui/TextField",
            commandName: "focus",
          },
          prepared.value,
        ),
      positive: {},
      negatives: [{ extra: true }],
    },
  ];
  const evidence = [];
  for (const vector of vectors) {
    const positive = vector.validate(vector.positive);
    assertCondition(
      positive.valid && Object.isFrozen(positive.value),
      "REFERENCE_PARITY_VALIDATOR_DRIFT",
      `${vector.channel} positive contract or frozen snapshot drifted.`,
    );
    for (const negative of vector.negatives) {
      assertCondition(
        !vector.validate(negative).valid,
        "REFERENCE_PARITY_VALIDATOR_DRIFT",
        `${vector.channel} accepted a closed-schema negative vector.`,
      );
    }
    evidence.push({
      channel: vector.channel,
      positiveAccepted: true,
      negativeVectorsRejected: vector.negatives.length,
    });
  }
  return Object.freeze(evidence);
}

function parseSource(source, relativePath) {
  const parsed = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  assertCondition(
    parsed.parseDiagnostics.length === 0,
    "REFERENCE_PARITY_SOURCE_DRIFT",
    `${relativePath} no longer parses.`,
  );
  return parsed;
}

function inspectModuleBoundary(
  source,
  relativePath,
  expectedImports,
  {
    allowNamedReExports = false,
    expectedAssignmentCounts = {},
    expectedCallCounts = {},
    expectedNewExpressionCounts = {},
  } = {},
) {
  const parsed = parseSource(source, relativePath);
  const assignmentCounts = {};
  const imports = [];
  const callCounts = {};
  const newExpressionCounts = {};
  let unsafe = false;
  const allowedTopLevel = (statement) =>
    ts.isImportDeclaration(statement) ||
    ts.isExportDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isVariableStatement(statement);
  if (parsed.statements.some((statement) => !allowedTopLevel(statement))) unsafe = true;
  function initializerHasDirectEffect(node) {
    let effect = false;
    function inspect(nested) {
      if (
        (ts.isBinaryExpression(nested) &&
          nested.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          nested.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
        ts.isDeleteExpression(nested) ||
        ts.isAwaitExpression(nested) ||
        ts.isYieldExpression(nested) ||
        ts.isTaggedTemplateExpression(nested) ||
        ((ts.isPrefixUnaryExpression(nested) || ts.isPostfixUnaryExpression(nested)) &&
          [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(nested.operator))
      ) {
        effect = true;
      }
      ts.forEachChild(nested, inspect);
    }
    inspect(node);
    return effect;
  }
  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        declaration.initializer !== undefined &&
        initializerHasDirectEffect(declaration.initializer)
      ) {
        unsafe = true;
      }
    }
  }
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const assignment = `${node.left.getText(parsed)} ${node.operatorToken.getText(parsed)}`;
      assignmentCounts[assignment] = (assignmentCounts[assignment] ?? 0) + 1;
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
    ) {
      const assignment = `${node.operand.getText(parsed)} ${ts.tokenToString(node.operator)}`;
      assignmentCounts[assignment] = (assignmentCounts[assignment] ?? 0) + 1;
    }
    if (
      ts.isDeleteExpression(node) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      ts.isTaggedTemplateExpression(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      unsafe = true;
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(parsed);
      callCounts[expression] = (callCounts[expression] ?? 0) + 1;
    }
    if (ts.isNewExpression(node)) {
      const expression = node.expression.getText(parsed);
      newExpressionCounts[expression] = (newExpressionCounts[expression] ?? 0) + 1;
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          ["eval", "Function", "require"].includes(node.expression.text)))
    ) {
      unsafe = true;
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["Function", "Proxy"].includes(node.expression.text)
    ) {
      unsafe = true;
    }
    if (
      ts.isIdentifier(node) &&
      ["document", "fetch", "globalThis", "process", "window"].includes(node.text)
    ) {
      unsafe = true;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["assign", "defineProperties", "defineProperty", "setPrototypeOf"].includes(
        node.expression.name.text,
      )
    ) {
      unsafe = true;
    }
    if (ts.isImportDeclaration(node)) {
      assertCondition(
        node.importClause !== undefined && ts.isStringLiteral(node.moduleSpecifier),
        "REFERENCE_PARITY_SOURCE_DRIFT",
        `${relativePath} contains a side-effect or non-literal import.`,
      );
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isExportAssignment(node)) unsafe = true;
    if (
      ts.isExportDeclaration(node) &&
      (!allowNamedReExports ||
        node.exportClause === undefined ||
        !ts.isNamedExports(node.exportClause))
    ) {
      unsafe = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assertCondition(
    !unsafe,
    "REFERENCE_PARITY_SOURCE_DRIFT",
    `${relativePath} contains an unapproved top-level effect, global access, dynamic loading, evaluation, default export, or export-star syntax.`,
  );
  assertJsonEqual(
    imports,
    expectedImports,
    "REFERENCE_PARITY_SOURCE_DRIFT",
    `${relativePath} import boundary drifted.`,
  );
  assertJsonEqual(
    assignmentCounts,
    expectedAssignmentCounts,
    "REFERENCE_PARITY_SOURCE_DRIFT",
    `${relativePath} assignment graph drifted.`,
  );
  assertJsonEqual(
    callCounts,
    expectedCallCounts,
    "REFERENCE_PARITY_SOURCE_DRIFT",
    `${relativePath} call graph drifted.`,
  );
  assertJsonEqual(
    newExpressionCounts,
    expectedNewExpressionCounts,
    "REFERENCE_PARITY_SOURCE_DRIFT",
    `${relativePath} constructor graph drifted.`,
  );
  assertCondition(
    !imports.some((specifier) => specifier === "react" || specifier === "react-dom"),
    "REFERENCE_PARITY_SOURCE_DRIFT",
    `${relativePath} must not transitively select the React component barrel.`,
  );
  return Object.freeze({
    path: relativePath,
    imports: Object.freeze(imports),
    assignmentCounts: Object.freeze(assignmentCounts),
    callCounts: Object.freeze(callCounts),
    newExpressionCounts: Object.freeze(newExpressionCounts),
  });
}

function namedExports(source, relativePath, expectedModuleSpecifier) {
  const parsed = parseSource(source, relativePath);
  const runtime = [];
  const types = [];
  let unsafe = false;
  for (const statement of parsed.statements) {
    if (ts.isExportAssignment(statement)) {
      unsafe = true;
      continue;
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (
      modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      !ts.isExportDeclaration(statement)
    ) {
      unsafe = true;
      continue;
    }
    if (!ts.isExportDeclaration(statement)) continue;
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.exportClause.elements.length === 0
    ) {
      unsafe = true;
      continue;
    }
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined && element.propertyName.text !== element.name.text) {
        unsafe = true;
      }
      if (statement.moduleSpecifier.text !== expectedModuleSpecifier) continue;
      const target = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
      target.push(element.name.text);
    }
  }
  assertCondition(
    !unsafe,
    "REFERENCE_PARITY_EXPORT_DRIFT",
    `${relativePath} contains a non-explicit re-export.`,
  );
  return Object.freeze({ runtime: sorted(runtime), types: sorted(types) });
}

function inspectParityConsumer(source) {
  const parsed = parseSource(source, "packages/reference-catalog-web/test/parity-consumer.mjs");
  assertCondition(
    parsed.statements.length === 1 &&
      ts.isExportDeclaration(parsed.statements[0]) &&
      parsed.statements[0].exportClause !== undefined &&
      ts.isNamespaceExport(parsed.statements[0].exportClause) &&
      parsed.statements[0].exportClause.name.text === "parityApi" &&
      parsed.statements[0].moduleSpecifier !== undefined &&
      ts.isStringLiteral(parsed.statements[0].moduleSpecifier) &&
      parsed.statements[0].moduleSpecifier.text === "@desen/reference-catalog-web/parity",
    "REFERENCE_PARITY_EXPORT_DRIFT",
    "The parity consumer must capture the complete public parity namespace.",
  );
}

function inspectPublicApi({
  parityIndexSource,
  parityConsumerSource,
  packageRootIndexSource,
  parityDeclaration,
  referencePackage,
}) {
  const indexExports = namedExports(
    parityIndexSource,
    "packages/reference-catalog-web/src/parity/index.ts",
    "./reference-web-implementation-metadata.js",
  );
  assertJsonEqual(
    indexExports.runtime,
    ["REFERENCE_WEB_IMPLEMENTATION_METADATA"],
    "REFERENCE_PARITY_EXPORT_DRIFT",
    "Parity runtime exports drifted.",
  );
  assertJsonEqual(
    indexExports.types,
    EXPECTED_PARITY_TYPE_EXPORTS,
    "REFERENCE_PARITY_EXPORT_DRIFT",
    "Parity type exports drifted.",
  );
  inspectParityConsumer(parityConsumerSource);
  assertCondition(
    !packageRootIndexSource.includes("parity") &&
      !packageRootIndexSource.includes("REFERENCE_WEB_IMPLEMENTATION_METADATA"),
    "REFERENCE_PARITY_ROOT_LEAK",
    "Parity metadata leaked through the package root source.",
  );
  const declarationExports = namedExports(
    parityDeclaration,
    "packages/reference-catalog-web/dist/parity/index.d.ts",
    "./reference-web-implementation-metadata.js",
  );
  assertJsonEqual(
    declarationExports.runtime,
    ["REFERENCE_WEB_IMPLEMENTATION_METADATA"],
    "REFERENCE_PARITY_EXPORT_DRIFT",
    "Built parity runtime declarations drifted.",
  );
  assertJsonEqual(
    declarationExports.types,
    EXPECTED_PARITY_TYPE_EXPORTS,
    "REFERENCE_PARITY_EXPORT_DRIFT",
    "Built parity type declarations drifted.",
  );
  assertJsonEqual(
    referencePackage.exports?.["./parity"],
    { types: "./dist/parity/index.d.ts", import: "./dist/parity/index.js" },
    "REFERENCE_PARITY_EXPORT_DRIFT",
    "The package parity subpath drifted.",
  );
  assertCondition(
    referencePackage.sideEffects === false &&
      referencePackage.scripts?.["test:parity"] ===
        "vitest run test/foundation-components.test.tsx test/interactive-components.test.tsx test/parity-metadata.test.ts test/parity-contracts.test.tsx",
    "REFERENCE_PARITY_PACKAGE_DRIFT",
    "Parity package safety or cumulative test wiring drifted.",
  );
  return Object.freeze({
    subpath: "@desen/reference-catalog-web/parity",
    runtimeExports: indexExports.runtime,
    typeExports: indexExports.types,
    packageRootLeak: false,
    sideEffects: false,
  });
}

function extractTestTitles(source) {
  return [...source.matchAll(/\b(?:it|test)\("([^"]+)"/g)].map((match) => match[1]);
}

function extractNegativeCases(source) {
  return sorted([...source.matchAll(/\b(M03-T09-N\d{2})\b/g)].map((match) => match[1]));
}

function inspectInventories(text) {
  const packageTests = {
    foundation: extractTestTitles(text.foundationTestPath),
    interaction: extractTestTitles(text.interactiveTestPath),
    metadata: extractTestTitles(text.metadataTestPath),
    contracts: extractTestTitles(text.contractTestPath),
  };
  for (const [group, expected] of Object.entries(EXPECTED_PACKAGE_TESTS)) {
    assertJsonEqual(
      packageTests[group],
      expected,
      "REFERENCE_PARITY_TEST_INVENTORY_DRIFT",
      `${group} package-test inventory drifted.`,
    );
  }
  const rootTests = extractTestTitles(text.rootTestPath);
  assertJsonEqual(
    rootTests,
    EXPECTED_ROOT_TEST_TITLES,
    "REFERENCE_PARITY_TEST_INVENTORY_DRIFT",
    "Root parity-test inventory drifted.",
  );
  const negatives = extractNegativeCases(text.typeTestPath);
  assertJsonEqual(
    negatives,
    EXPECTED_TYPE_NEGATIVE_CASES,
    "REFERENCE_PARITY_TYPE_INVENTORY_DRIFT",
    "Compiler-negative parity inventory drifted.",
  );
  return Object.freeze({ packageTests, rootTests, typeNegativeCases: negatives });
}

function collectTraceRows(value, rows = new Map()) {
  if (Array.isArray(value)) {
    for (const item of value) collectTraceRows(item, rows);
  } else if (value !== null && typeof value === "object") {
    if (typeof value.id === "string") rows.set(value.id, value);
    for (const nested of Object.values(value)) collectTraceRows(nested, rows);
  }
  return rows;
}

function inspectTraceability(traceability) {
  const rows = collectTraceRows(traceability);
  for (const id of [...STRONG_TRACE_IDS, ...PARTIAL_TRACE_IDS]) {
    const row = rows.get(id);
    assertCondition(
      row !== undefined && [...(row.owners ?? []), ...(row.tests ?? [])].includes("M03-T09"),
      "REFERENCE_PARITY_TRACE_DRIFT",
      `${id} is missing or no longer routed to M03-T09.`,
    );
  }
  return Object.freeze({
    strongLocal: STRONG_TRACE_IDS,
    partialOrLater: PARTIAL_TRACE_IDS,
    ledgerMutated: false,
  });
}

async function authenticateFixturesScenariosSuccessor(artifactPath) {
  let bytes;
  let artifact;
  try {
    const workspace = await realpath(WORKSPACE_ROOT);
    const exactArtifactPath = path.join(workspace, FIXTURES_SCENARIOS_ARTIFACT_RELATIVE_PATH);
    assertCondition(
      path.resolve(artifactPath) === path.resolve(FIXTURES_SCENARIOS_ARTIFACT_PATH),
      "REFERENCE_PARITY_CLAIM_DRIFT",
      "The M09-T11 S-001 successor must use its exact workspace authority path.",
    );
    let cursor = workspace;
    for (const segment of FIXTURES_SCENARIOS_ARTIFACT_RELATIVE_PATH.split("/")) {
      cursor = path.join(cursor, segment);
      const entry = await lstat(cursor);
      assertCondition(
        !entry.isSymbolicLink(),
        "REFERENCE_PARITY_CLAIM_DRIFT",
        "The M09-T11 S-001 successor authority may not traverse a symlink.",
      );
    }
    assertCondition(
      (await realpath(artifactPath)) === exactArtifactPath,
      "REFERENCE_PARITY_CLAIM_DRIFT",
      "The M09-T11 S-001 successor escaped its exact workspace authority root.",
    );
    const handle = await open(exactArtifactPath, AUTHORITY_READ_FLAGS);
    try {
      const before = await handle.stat();
      bytes = await handle.readFile();
      const after = await handle.stat();
      assertCondition(
        before.isFile() &&
          after.isFile() &&
          before.dev === after.dev &&
          before.ino === after.ino &&
          before.size === after.size &&
          before.mtimeMs === after.mtimeMs &&
          before.ctimeMs === after.ctimeMs &&
          after.size === bytes.length,
        "REFERENCE_PARITY_CLAIM_DRIFT",
        "The M09-T11 S-001 successor authority changed while it was read.",
      );
    } finally {
      await handle.close();
    }
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof ReferenceCatalogWebParityEvidenceError) throw error;
    fail(
      "REFERENCE_PARITY_CLAIM_DRIFT",
      "The exact M09-T11 S-001 successor authority is unavailable or invalid.",
    );
  }
  assertCondition(
    bytes.length === FIXTURES_SCENARIOS_ARTIFACT_PIN.bytes &&
      sha256(bytes) === FIXTURES_SCENARIOS_ARTIFACT_PIN.sha256,
    "REFERENCE_PARITY_CLAIM_DRIFT",
    "The exact M09-T11 S-001 successor artifact receipt drifted.",
  );
  const historicalParent = artifact.prerequisites?.find(
    (candidate) => candidate?.task === HISTORICAL_PARITY_ARTIFACT_PIN.task,
  );
  assertCondition(
    artifact?.schemaVersion === 1 &&
      artifact.task === FIXTURES_SCENARIOS_ARTIFACT_PIN.task &&
      artifact.proofId === FIXTURES_SCENARIOS_ARTIFACT_PIN.proofId &&
      artifact.profile === FIXTURES_SCENARIOS_ARTIFACT_PIN.profile &&
      artifact.result === FIXTURES_SCENARIOS_ARTIFACT_PIN.result &&
      jsonText(historicalParent) === jsonText(HISTORICAL_PARITY_ARTIFACT_PIN) &&
      artifact.claim?.taskStatus === "DONE" &&
      artifact.claim?.s001Status === "TESTED" &&
      artifact.claim?.publicSyntheticFixtureProjection === true &&
      artifact.claim?.pendingRuntimeLifecycleExercised === true &&
      jsonText(artifact.claim?.visibleExecutionContexts) ===
        jsonText(["synthetic", "integration", "production"]) &&
      artifact.claim?.visibleApproximateFidelityDifferences === true &&
      artifact.claim?.sameProductionAdapterDisclosure === true,
    "REFERENCE_PARITY_CLAIM_DRIFT",
    "The exact M09-T11 artifact no longer proves the reviewed S-001 advance.",
  );
  return Object.freeze({
    task: FIXTURES_SCENARIOS_ARTIFACT_PIN.task,
    artifactBytes: FIXTURES_SCENARIOS_ARTIFACT_PIN.bytes,
    artifactSha256: FIXTURES_SCENARIOS_ARTIFACT_PIN.sha256,
    historicalParityParentAuthenticated: true,
    s001Status: "TESTED",
  });
}

/**
 * Validates current M03-T09 normative ownership while preserving its task-time artifact
 * projection.
 *
 * @remarks Later tasks may monotonically advance a row from `PLANNED` to `TESTED`. The immutable
 * M03-T09 artifact must continue to describe the status observed when that artifact was produced.
 * N-033 advanced under M04 and N-034 advances under M05 without rewriting historical evidence.
 */
export function verifyReferenceCatalogWebParityNormativeCompatibility(
  normativeCoverage,
  fixturesScenariosSuccessor = undefined,
) {
  const currentStatuses = HISTORICAL_NORMATIVE_STATUSES.map(({ id, status: historicalStatus }) => {
    const rows = normativeCoverage.split("\n").filter((line) => line.startsWith(`| ${id} `));
    const cells =
      rows.length === 1
        ? rows[0]
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim())
        : [];
    const ownerTasks = (cells[3] ?? "")
      .split(",")
      .map((owner) => owner.trim())
      .filter(Boolean);
    assertCondition(
      cells[0] === id && ownerTasks.includes("M03-T09"),
      "REFERENCE_PARITY_CLAIM_DRIFT",
      `${id} must retain M03-T09 in its exact Owner task(s) cell.`,
    );
    const currentStatus = cells[4] ?? "";
    const historicalRank = NORMATIVE_STATUS_RANK[historicalStatus];
    const currentRank = NORMATIVE_STATUS_RANK[currentStatus];
    const exactS001SuccessorAdvance =
      id === "S-001" &&
      historicalStatus === "PLANNED" &&
      currentStatus === "TESTED" &&
      fixturesScenariosSuccessor?.task === FIXTURES_SCENARIOS_ARTIFACT_PIN.task &&
      fixturesScenariosSuccessor?.artifactSha256 === FIXTURES_SCENARIOS_ARTIFACT_PIN.sha256 &&
      fixturesScenariosSuccessor?.historicalParityParentAuthenticated === true &&
      fixturesScenariosSuccessor?.s001Status === "TESTED" &&
      ownerTasks.includes("M09-T11") &&
      (cells[5] ?? "").includes(
        "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json",
      ) &&
      (cells[5] ?? "").includes(FIXTURES_SCENARIOS_ARTIFACT_PIN.sha256);
    assertCondition(
      currentRank !== undefined &&
        (MONOTONIC_NORMATIVE_STATUS_IDS.has(id)
          ? currentRank >= historicalRank
          : currentStatus === historicalStatus || exactS001SuccessorAdvance),
      "REFERENCE_PARITY_CLAIM_DRIFT",
      `${id} status regressed or became unknown after M03-T09.`,
    );
    return Object.freeze({ id, status: currentStatus });
  });
  return Object.freeze({
    historicalProjection: HISTORICAL_NORMATIVE_STATUSES,
    currentStatuses: Object.freeze(currentStatuses),
  });
}

function inspectClaimDocuments(
  proofDocument,
  normativeCoverage,
  proofMatrix,
  fixturesScenariosSuccessor,
) {
  const proof = proofDocument.replace(/\s+/g, " ").trim();
  const requiredProofClaims = [
    "it does not claim to implement or republish the complete example Catalog",
    "`N-033` and `N-034`",
    "both normative rows remain `PLANNED`",
    "`N-030` retains only local base-semantics evidence and remains `PLANNED`",
    "`S-004` advances to `TESTED`",
    "`S-001` remains `PLANNED`",
    "`P-06` advances only to `PARTIAL`",
    "generic React adapter registry",
  ];
  assertCondition(
    requiredProofClaims.every((claim) => proof.includes(claim)),
    "REFERENCE_PARITY_CLAIM_DRIFT",
    "The user-facing M03-T09 proof lost a required scope or status boundary.",
  );

  const normativeCompatibility = verifyReferenceCatalogWebParityNormativeCompatibility(
    normativeCoverage,
    fixturesScenariosSuccessor,
  );

  // The matrix embeds this artifact's digest, so hashing the whole document here
  // would create a self-reference. Validate the governing row semantically instead.
  const proofMatrixRows = proofMatrix
    .split("\n")
    .filter((line) => line.startsWith("| P-06 "))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const [proofMatrixRow] = proofMatrixRows;
  const currentP06Status = proofMatrixRow?.[3] ?? "";
  assertCondition(
    proofMatrixRows.length === 1 &&
      proofMatrixRow?.[0] === "P-06" &&
      proofMatrixRow[2]
        .split(",")
        .map((owner) => owner.trim())
        .includes("M03-T09") &&
      Object.hasOwn(PROOF_MATRIX_STATUS_RANK, currentP06Status) &&
      PROOF_MATRIX_STATUS_RANK[currentP06Status] >= PROOF_MATRIX_STATUS_RANK[HISTORICAL_P06_STATUS],
    "REFERENCE_PARITY_CLAIM_DRIFT",
    "P-06 must retain at least its historical PARTIAL status and M03-T09 ownership in the proof matrix.",
  );

  return Object.freeze({
    proofScopeBoundaries: requiredProofClaims.length,
    normativeStatuses: normativeCompatibility.historicalProjection,
    // Keep immutable M03-T09 evidence projected at task time even after a successor proves P-06.
    proofMatrixStatuses: Object.freeze([
      { id: "P-06", owner: "M03-T09", status: HISTORICAL_P06_STATUS },
    ]),
  });
}

function inspectRootWiring(rootPackage) {
  const scripts = rootPackage.scripts ?? {};
  for (const [kind, expected] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    assertCondition(
      scripts[`${kind}:reference-catalog-web-parity`] === expected,
      "REFERENCE_PARITY_COMMAND_DRIFT",
      `Root ${kind} parity command drifted.`,
    );
  }
  assertCondition(
    scripts.test?.includes("pnpm test:reference-catalog-web-parity") &&
      scripts.check?.includes("pnpm verify:reference-catalog-web-parity"),
    "REFERENCE_PARITY_COMMAND_DRIFT",
    "Root test/check no longer includes the M03-T09 parity boundary.",
  );
}

async function importFresh(modulePath) {
  return import(
    `${pathToFileURL(modulePath).href}?reference-parity=${Date.now()}-${Math.random()}`
  );
}

async function readInputs(paths) {
  const entries = await Promise.all(
    Object.entries(paths)
      .filter(([name]) => name.endsWith("Path") && !name.endsWith("ArtifactPath"))
      .map(async ([name, inputPath]) => [name, await readFile(inputPath)]),
  );
  return Object.freeze(Object.fromEntries(entries));
}

async function verifyPrerequisites(paths) {
  try {
    const [packageDigest, signIn] = await Promise.all([
      verifyWebReactPackageDigestEvidence({ artifactPath: paths.packageDigestArtifactPath }),
      verifyReferenceSignInFixturesAndHostBindingEvidence({
        artifactPath: paths.signInArtifactPath,
      }),
    ]);
    return Object.freeze({
      packageDigest: {
        task: "M03-T04",
        result: packageDigest.result,
        artifactSha256: packageDigest.artifactSha256,
      },
      signIn: {
        task: "M03-T08",
        result: signIn.result,
        artifactSha256: signIn.artifactSha256,
      },
    });
  } catch (error) {
    fail("REFERENCE_PARITY_PREREQUISITE_DRIFT", "An M03-T09 prerequisite failed verification.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

async function trackedFileHashes() {
  const workspace = await realpath(WORKSPACE_ROOT);
  return Promise.all(
    TRACKED_EVIDENCE_PATHS.map(async (relativePath) => {
      if (relativePath === HISTORICAL_SELF_RECORD.path) return HISTORICAL_SELF_RECORD;
      if (relativePath === HISTORICAL_ROOT_TEST_RECORD.path) return HISTORICAL_ROOT_TEST_RECORD;
      const absolutePath = path.join(workspace, relativePath);
      const [entry, resolved] = await Promise.all([lstat(absolutePath), realpath(absolutePath)]);
      assertCondition(
        entry.isFile() && !entry.isSymbolicLink() && resolved.startsWith(`${workspace}${path.sep}`),
        "REFERENCE_PARITY_TRACKED_FILE_UNSAFE",
        `${relativePath} must be a regular in-workspace file.`,
      );
      const bytes = await readFile(resolved);
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
}

async function canonicalArtifactTarget(artifactPath) {
  const absolute = path.resolve(artifactPath);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    try {
      const entry = await lstat(absolute);
      if (entry.isSymbolicLink()) {
        return canonicalArtifactTarget(
          path.resolve(path.dirname(absolute), await readlink(absolute)),
        );
      }
    } catch (linkError) {
      if (linkError?.code !== "ENOENT") throw linkError;
    }
    return path.join(await realpath(path.dirname(absolute)), path.basename(absolute));
  }
}

async function targetsTrackedArtifact(artifactPath) {
  const [actual, expected] = await Promise.all([
    canonicalArtifactTarget(artifactPath),
    canonicalArtifactTarget(DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH),
  ]);
  return actual === expected;
}

function assertCanonicalTrackedSpelling(artifactPath) {
  assertCondition(
    path.resolve(artifactPath) === path.resolve(DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH),
    "REFERENCE_PARITY_TRACKED_ALIAS_REJECTED",
    "The tracked M03-T09 artifact may not be accessed through an alternate or symlink path.",
  );
}

/**
 * Builds deterministic M03-T09 evidence from built public package APIs and tracked sources.
 */
export async function buildReferenceCatalogWebParityEvidence(options = undefined) {
  const normalized = normalizeOptions(options, BUILD_OPTION_NAMES, "Build");
  validateBuildOptions(normalized);
  const overrides = Object.freeze(sorted(Object.keys(normalized)));
  const paths = Object.freeze(
    Object.fromEntries(
      Object.entries(DEFAULT_PATHS).map(([name, defaultPath]) => [
        name,
        normalized[name] ?? defaultPath,
      ]),
    ),
  );

  const [
    fixturesScenariosSuccessor,
    loadedParityConsumer,
    loadedComponentApi,
    loadedOperationsApi,
    loadedHostOperationsApi,
    loadedPackageRootApi,
    loadedCatalogSdkApi,
    loadedValidatorApi,
  ] = await Promise.all([
    authenticateFixturesScenariosSuccessor(paths.fixturesScenariosArtifactPath),
    normalized.parityApi === undefined ? importFresh(paths.parityConsumerPath) : undefined,
    normalized.componentApi ?? importFresh(paths.componentsConsumerPath),
    normalized.operationsApi ?? importFresh(paths.operationsConsumerPath),
    normalized.hostOperationsApi ?? importFresh(paths.hostOperationsConsumerPath),
    normalized.packageRootApi ?? importFresh(paths.packageRootConsumerPath),
    normalized.catalogSdkApi ??
      import(pathToFileURL(path.join(WORKSPACE_ROOT, "packages/catalog-sdk/dist/index.js")).href),
    normalized.validatorApi ??
      import(pathToFileURL(path.join(WORKSPACE_ROOT, "packages/validator/dist/index.js")).href),
  ]);
  const loadedParityApi =
    normalized.parityApi ??
    captureApi(loadedParityConsumer, ["parityApi"], "parity consumer API", true).api.parityApi;
  const parityCapture = captureApi(
    loadedParityApi,
    ["REFERENCE_WEB_IMPLEMENTATION_METADATA"],
    "parity API",
  );
  const componentCapture = captureApi(
    loadedComponentApi,
    EXPECTED_COMPONENT_API_EXPORTS,
    "component API",
  );
  const operationsCapture = captureApi(
    loadedOperationsApi,
    ["SIGN_IN_OPERATION_ID", "signInOperationFixtures", "signInOperationRegistration"],
    "operation API",
  );
  const hostCapture = captureApi(
    loadedHostOperationsApi,
    ["bindReferenceSignInHostOperation"],
    "host-operation API",
  );
  const rootCapture = captureApi(
    loadedPackageRootApi,
    EXPECTED_PACKAGE_ROOT_EXPORTS,
    "package-root API",
  );
  const catalogSdkCapture = captureApi(
    loadedCatalogSdkApi,
    ["createCatalogManifest"],
    "Catalog SDK API",
  );
  const validatorCapture = captureApi(
    loadedValidatorApi,
    [
      "validateDesenEventPayload",
      "validateDesenExecutionCatalogSet",
      "validateDesenExecutionValue",
    ],
    "validator API",
  );

  const prerequisite =
    normalized.verifyPrerequisites === false
      ? Object.freeze({
          packageDigest: { task: "M03-T04", result: "SKIPPED", artifactSha256: null },
          signIn: { task: "M03-T08", result: "SKIPPED", artifactSha256: null },
        })
      : await verifyPrerequisites(paths);
  assertCondition(
    overrides.length > 0 ||
      (prerequisite.packageDigest.result === "PASS" && prerequisite.signIn.result === "PASS"),
    "REFERENCE_PARITY_PREREQUISITE_UNPROVEN",
    "Tracked-default M03-T09 evidence requires passing M03-T04 and M03-T08 prerequisites.",
  );

  const inputs = await readInputs(paths);
  const text = Object.fromEntries(
    Object.entries(inputs).map(([name, bytes]) => [name, bytes.toString("utf8")]),
  );
  let officialCatalog;
  let referencePackage;
  let rootPackage;
  let traceability;
  try {
    officialCatalog = JSON.parse(text.officialCatalogPath);
    referencePackage = JSON.parse(text.referencePackagePath);
    rootPackage = JSON.parse(text.rootPackagePath);
    traceability = JSON.parse(text.traceabilityPath);
  } catch {
    fail("REFERENCE_PARITY_INPUT_DRIFT", "A required tracked JSON input is invalid.");
  }

  const parity = inspectMetadata({
    metadata: parityCapture.api.REFERENCE_WEB_IMPLEMENTATION_METADATA,
    componentApi: componentCapture.api,
    operationsApi: operationsCapture.api,
    hostOperationsApi: hostCapture.api,
    officialCatalog,
  });
  const resolvedContracts = inspectResolvedContracts({
    catalogSdkApi: catalogSdkCapture.api,
    validatorApi: validatorCapture.api,
    componentApi: componentCapture.api,
    operationsApi: operationsCapture.api,
  });
  const publicApi = inspectPublicApi({
    parityIndexSource: text.parityIndexSourcePath,
    parityConsumerSource: text.parityConsumerPath,
    packageRootIndexSource: text.packageRootIndexSourcePath,
    parityDeclaration: text.parityDeclarationPath,
    referencePackage,
  });
  const sourceAudit = Object.freeze([
    inspectModuleBoundary(
      text.metadataSourcePath,
      "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
      [
        "@desen/protocol",
        "../components/contracts.js",
        "../components/interactive-contracts.js",
        "../operations/sign-in.js",
      ],
      {
        expectedAssignmentCounts: { "components[capabilityId] =": 1 },
        expectedCallCounts: EXPECTED_METADATA_SOURCE_CALLS,
        expectedNewExpressionCounts: { Set: 1, TypeError: 1 },
      },
    ),
    inspectModuleBoundary(
      text.parityIndexSourcePath,
      "packages/reference-catalog-web/src/parity/index.ts",
      [],
      { allowNamedReExports: true },
    ),
    inspectModuleBoundary(
      text.componentContractsSourcePath,
      "packages/reference-catalog-web/src/components/contracts.ts",
      ["@desen/catalog-sdk", "@desen/catalog-sdk"],
      { expectedCallCounts: { registerComponent: 2 } },
    ),
    inspectModuleBoundary(
      text.interactiveContractsSourcePath,
      "packages/reference-catalog-web/src/components/interactive-contracts.ts",
      ["@desen/catalog-sdk", "@desen/catalog-sdk"],
      { expectedCallCounts: { registerComponent: 3 } },
    ),
    inspectModuleBoundary(
      text.operationSourcePath,
      "packages/reference-catalog-web/src/operations/sign-in.ts",
      ["@desen/catalog-sdk", "@desen/catalog-sdk"],
      { expectedCallCounts: { registerOperation: 1 } },
    ),
  ]);
  const inventories = inspectInventories(text);
  const traceCoverage = inspectTraceability(traceability);
  const claimDocuments = inspectClaimDocuments(
    text.proofDocumentPath,
    text.normativeCoveragePath,
    text.proofMatrixPath,
    fixturesScenariosSuccessor,
  );
  inspectRootWiring(rootPackage);
  const trackedFiles = await trackedFileHashes();

  parityCapture.assertStable();
  componentCapture.assertStable();
  operationsCapture.assertStable();
  hostCapture.assertStable();
  rootCapture.assertStable();
  catalogSdkCapture.assertStable();
  validatorCapture.assertStable();

  const artifact = {
    schemaVersion: 1,
    task: "M03-T09",
    result: "PASS",
    claim: {
      summary:
        "Five exact official component entries have complete inert parity metadata and real same-identity Web-React implementations; the exact sign-in operation is explicitly application-supplied.",
      protocol: "0.1.0",
      target: "web-react",
      scope: "reference-sign-in-slice",
      normativeEffects: [
        {
          id: "S-004",
          from: "PLANNED",
          to: "TESTED",
          note: "All five selected public component prop schemas remain closed.",
        },
      ],
      normativeUnchanged: ["S-001", "N-030", "N-033", "N-034"],
      proofMatrixEffects: [
        {
          id: "P-06",
          from: "NOT_PROVEN",
          to: "PARTIAL",
          note: "Authoring and production roles resolve to the same real component exports; the executable registry and Desen App remain later work.",
        },
      ],
    },
    prerequisite,
    catalogScope: {
      identity: "run.desen.reference.sign-in-parity-proof@0.1.0",
      officialCatalogRepublished: false,
      components: COMPONENT_IDS,
      behaviors: [],
      operations: [OPERATION_ID],
      resources: [],
    },
    parity,
    resolvedContracts,
    publicApi,
    traceCoverage,
    evidence: {
      provenance: {
        mode: overrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides,
      },
      officialInput: {
        path: "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
        bytes: inputs.officialCatalogPath.length,
        sha256: sha256(inputs.officialCatalogPath),
      },
      sourceAudit,
      claimDocuments: {
        ...claimDocuments,
        proof: {
          path: "docs/proof/REFERENCE-CATALOG-WEB-PARITY.md",
          bytes: inputs.proofDocumentPath.length,
          sha256: sha256(inputs.proofDocumentPath),
        },
      },
      packageTests: inventories.packageTests,
      rootTests: inventories.rootTests,
      typeNegativeCases: inventories.typeNegativeCases,
      trackedFiles,
      commands: [
        "generate:reference-catalog-web-parity",
        "verify:reference-catalog-web-parity",
        "test:reference-catalog-web-parity",
      ],
    },
    boundaries: [
      "The proof covers an exact sign-in reference slice, not the complete frozen example Catalog.",
      "Parity metadata is inert, recursively frozen JSON and contains no executable selection or host handler.",
      "Event and command evidence is component-side plus schema validation; generic runtime bridging remains M04/M05.",
      "Style parts are documented semantic hooks; resolved style application remains M05.",
      "Accessibility evidence is a narrow cumulative Web component contract, not universal certification.",
      "The final Catalog identity, real package inventory, digest, and immutable tuple remain M03-T10.",
    ],
    deferred: [
      "M03-T10 final distinct Catalog, real build inventory, package digest, and exact tuple",
      "M04 generic event lifecycle and operation orchestration",
      "M05 executable React registry, render bridge, commands, and resolved styles",
      "M09 Desen App editor and preview evidence",
      "M12 cross-platform and repository-wide hardening",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  parityCapture.assertStable();
  componentCapture.assertStable();
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    fixturesScenariosSuccessor,
  });
}

/** Verifies an artifact against a fresh deterministic M03-T09 evidence build. */
export async function verifyReferenceCatalogWebParityEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "artifactBytes", ...BUILD_OPTION_NAMES],
    "Verify",
  );
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "REFERENCE_PARITY_OPTIONS_INVALID",
    "Verify artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "artifactBytes")) {
    assertCondition(
      normalized.artifactBytes instanceof Uint8Array,
      "REFERENCE_PARITY_OPTIONS_INVALID",
      "Verify artifactBytes must be a byte array.",
    );
  }
  const buildOptions = Object.create(null);
  for (const name of BUILD_OPTION_NAMES) {
    if (Object.hasOwn(normalized, name)) buildOptions[name] = normalized[name];
  }
  const tracked =
    normalized.artifactBytes === undefined && (await targetsTrackedArtifact(artifactPath));
  if (tracked) {
    assertCanonicalTrackedSpelling(artifactPath);
    assertCondition(
      Object.keys(buildOptions).length === 0,
      "REFERENCE_PARITY_NONDEFAULT_TRACKED_VERIFY",
      "The tracked M03-T09 artifact can only be verified from fixed defaults.",
    );
  }
  const expected = await buildReferenceCatalogWebParityEvidence(buildOptions);
  const actualBytes = Buffer.from(normalized.artifactBytes ?? (await readFile(artifactPath)));
  assertCondition(
    actualBytes.equals(expected.artifactBytes),
    "REFERENCE_PARITY_ARTIFACT_DRIFT",
    "The M03-T09 artifact differs from a fresh deterministic build.",
    { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
  );
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    packageDigestPrerequisiteSha256: expected.artifact.prerequisite.packageDigest.artifactSha256,
    signInPrerequisiteSha256: expected.artifact.prerequisite.signIn.artifactSha256,
    provenanceMode: expected.artifact.evidence.provenance.mode,
    components: expected.artifact.catalogScope.components.length,
    operations: expected.artifact.catalogScope.operations.length,
    resolvedContractVectors: expected.artifact.resolvedContracts.length,
    packageTests: Object.values(expected.artifact.evidence.packageTests).flat().length,
    rootTests: expected.artifact.evidence.rootTests.length,
    typeNegativeCases: expected.artifact.evidence.typeNegativeCases.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    proofMatrixStatus: `${expected.artifact.evidence.claimDocuments.proofMatrixStatuses[0].id} ${expected.artifact.evidence.claimDocuments.proofMatrixStatuses[0].status}`,
    normativeStatus: "S-004 TESTED",
    successorNormativeStatus: `S-001 ${expected.fixturesScenariosSuccessor.s001Status}`,
  });
}

/** Writes deterministic M03-T09 evidence through the shared atomic proof writer. */
export async function writeReferenceCatalogWebParityEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "REFERENCE_PARITY_OPTIONS_INVALID",
    "Write artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "beforeAtomicRename")) {
    assertCondition(
      typeof normalized.beforeAtomicRename === "function",
      "REFERENCE_PARITY_OPTIONS_INVALID",
      "Write beforeAtomicRename must be a function.",
    );
  }
  if (Object.hasOwn(normalized, "buildOptions")) {
    assertCondition(
      normalized.buildOptions !== null &&
        typeof normalized.buildOptions === "object" &&
        !Array.isArray(normalized.buildOptions),
      "REFERENCE_PARITY_OPTIONS_INVALID",
      "Write buildOptions must be a record.",
    );
  }
  const tracked = await targetsTrackedArtifact(artifactPath);
  if (tracked) {
    assertCanonicalTrackedSpelling(artifactPath);
    assertCondition(
      !Object.hasOwn(normalized, "beforeAtomicRename") &&
        !Object.hasOwn(normalized, "buildOptions"),
      "REFERENCE_PARITY_NONDEFAULT_TRACKED_WRITE",
      "The tracked M03-T09 artifact can only be generated from fixed defaults.",
    );
  }
  const result = await buildReferenceCatalogWebParityEvidence(normalized.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: result.artifactBytes,
      beforeAtomicRename: normalized.beforeAtomicRename,
    });
  } catch (error) {
    fail("REFERENCE_PARITY_ARTIFACT_WRITE_FAILED", "The artifact could not be written safely.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
}

/** Exact root script strings required by the M03-T09 proof wiring audit. */
export const REFERENCE_CATALOG_WEB_PARITY_ROOT_SCRIPTS = EXPECTED_ROOT_SCRIPTS;
