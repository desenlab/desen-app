import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-interactions.json";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-INTERACTIONS.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const NORMATIVE_COVERAGE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const MATRIX_M05_TERMINAL_ANCHOR =
  "concrete adapter evidence. No P-claim status or proof gate changes.";
const PENDING_ARTIFACT_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";
const REFERENCE_PACKAGE_ROOT = "packages/reference-catalog-web";
const REFERENCE_DIST_ROOT = `${REFERENCE_PACKAGE_ROOT}/dist`;
const REFERENCE_CATALOG_PATH = `${REFERENCE_PACKAGE_ROOT}/catalog.json`;
const PACKAGE_DIGEST_PLACEHOLDER = `sha256:${"0".repeat(64)}`;
const EXPECTED_SUCCESSOR_PACKAGE_DIGEST =
  "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0";
const EXPECTED_SUCCESSOR_DIST_FILES = 80;
const EXPECTED_SUCCESSOR_FRAMED_ENTRIES = 81;
const EXPECTED_SUCCESSOR_FRAMED_BYTES = 252_072;
const SC01_DTCG_ARTIFACT_PATH = "docs/proof/artifacts/sc-01-dtcg-compatibility.json";
const SC01_DTCG_PROFILE_PATH = "docs/profiles/DTCG-2025.10-COMPATIBILITY.md";
const SC01_COMPARISON_PATH = "docs/proof/SC-01-DESEN-A2UI-COMPARISON.md";
const STRATEGIC_VALIDATION_PATH = "docs/plan/STRATEGIC-VALIDATION.md";
const PROJECT_STATUS_PATH = "PROJECT-STATUS.md";
const EXPECTED_SC01_DTCG_ARTIFACT_SHA256 =
  "sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6";
const EXPECTED_SC01_DTCG_MANIFEST_SHA256 =
  "sha256:455025526691234369626b96281ba6522a0d90340adcfcd67ffea2d53be167fa";
const EXPECTED_SC01_DTCG_COMPATIBILITY_MODE = "immutable-task-time-artifact";
const COMMAND_EVENT_ARTIFACT_PATH =
  "docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json";
const COMMAND_EVENT_PROOF_PATH = "docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md";
const EXPECTED_COMMAND_EVENT_ARTIFACT_SHA256 =
  "sha256:8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4";
const EXPECTED_COMMAND_EVENT_ARTIFACT_BYTES = 23_466;
const EXPECTED_COMMAND_EVENT_COMPATIBILITY_MODE = "immutable-task-time-artifact";
const REACTIVE_REEVALUATION_ARTIFACT_PATH =
  "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json";
const REACTIVE_REEVALUATION_PROOF_PATH = "docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md";
const EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_SHA256 =
  "sha256:7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67";
const EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_BYTES = 11_212;
const EXPECTED_REACTIVE_REEVALUATION_COMPATIBILITY_MODE = "immutable-task-time-artifact";
const LOCAL_STATE_IDENTITY_ARTIFACT_PATH =
  "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json";
const LOCAL_STATE_IDENTITY_PROOF_PATH = "docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md";
const EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_SHA256 =
  "sha256:4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13";
const EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_BYTES = 15_575;
const EXPECTED_LOCAL_STATE_IDENTITY_COMPATIBILITY_MODE = "immutable-task-time-artifact";

/** Absolute destination of the deterministic M05-T04 interaction evidence artifact. */
export const DEFAULT_RUNTIME_REACT_INTERACTIONS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute location of the human-readable M05-T04 proof. */
export const DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute location of the M05-T04 Proof Matrix pin. */
export const DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

const DEFAULT_RUNTIME_REACT_INTERACTIONS_NORMATIVE_COVERAGE_PATH = path.join(
  WORKSPACE_ROOT,
  NORMATIVE_COVERAGE_PATH,
);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "referenceCapabilityArtifact",
    task: "M03-T10",
    path: "docs/proof/artifacts/reference-catalog-web-capability-artifact.json",
    sha256: "4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0",
  }),
  Object.freeze({
    key: "runtimeCoreAudit",
    task: "M04-T17",
    gate: "G04",
    path: "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json",
    sha256: "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa",
    profile: "desen-runtime-core-audit-hardening-v1",
  }),
  Object.freeze({
    key: "resolvedStyles",
    task: "M05-T03",
    path: "docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json",
    sha256: "2b0e03e58116d161484cd3c309370ff1ee5003ee6158d4e941749faf0d6797eb",
    profile: "desen-runtime-react-resolved-styles-v1",
  }),
]);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
  "RUNTIME_REACT_RENDER_LIMITS",
  "createRuntimeReactAdapterRegistry",
  "readRuntimeReactAdapterRegistry",
  "renderRuntimeReactSurface",
]);

const EXPECTED_RUNTIME_TYPE_EXPORTS = Object.freeze([
  "RuntimeReactAdapterRegistryCreateInput",
  "RuntimeReactAdapterRegistryCreateResult",
  "RuntimeReactAdapterRegistryHandle",
  "RuntimeReactAdapterRegistryInvalidReason",
  "RuntimeReactAdapterRegistryLimitProfile",
  "RuntimeReactAdapterRegistryReadResult",
  "RuntimeReactAdapterRegistrySnapshot",
  "RuntimeReactBehaviorAdapterComponent",
  "RuntimeReactBehaviorAdapterProps",
  "RuntimeReactBehaviorAdapterRegistration",
  "RuntimeReactCommandAttachmentHandle",
  "RuntimeReactCommandAttachmentResult",
  "RuntimeReactCommandDetachmentResult",
  "RuntimeReactComponentAdapterComponent",
  "RuntimeReactComponentAdapterProps",
  "RuntimeReactComponentAdapterRegistration",
  "RuntimeReactComponentCommandPort",
  "RuntimeReactDiagnosticIdentity",
  "RuntimeReactEventDispatchResult",
  "RuntimeReactInteractionPort",
  "RuntimeReactNamedSlots",
  "RuntimeReactRenderFailure",
  "RuntimeReactRenderFailureChannel",
  "RuntimeReactRenderFailureCode",
  "RuntimeReactRenderInput",
  "RuntimeReactRenderLimitProfile",
  "RuntimeReactRenderResult",
  "RuntimeReactRenderedSurface",
  "RuntimeReactSemanticStyle",
  "RuntimeReactStyleParts",
  "RuntimeReactStyleProperties",
]);

const EXPECTED_CORE_HEADLESS_EXPORTS = Object.freeze([
  "RUNTIME_HEADLESS_SESSION_LIMITS",
  "attachRuntimeHeadlessSessionComponentCommands",
  "authenticateRuntimeHeadlessSessionAdapterAuthority",
  "detachRuntimeHeadlessSessionComponentCommands",
  "dispatchRuntimeHeadlessSessionEvent",
  "disposeRuntimeHeadlessSession",
  "mountRuntimeHeadlessSession",
  "readRuntimeHeadlessSession",
  "subscribeRuntimeHeadlessSession",
  "unsubscribeRuntimeHeadlessSession",
]);

const EXPECTED_CORE_HEADLESS_TYPE_EXPORTS = Object.freeze([
  "RuntimeHeadlessBindingSnapshot",
  "RuntimeHeadlessSessionAdapterAuthorityInput",
  "RuntimeHeadlessSessionAdapterAuthorityResult",
  "RuntimeHeadlessSessionComponentCommandsAttachResult",
  "RuntimeHeadlessSessionComponentCommandsAttachment",
  "RuntimeHeadlessSessionComponentCommandsDetachResult",
  "RuntimeHeadlessSessionComponentCommandsInput",
  "RuntimeHeadlessSessionDisposeResult",
  "RuntimeHeadlessSessionEventCompletion",
  "RuntimeHeadlessSessionEventInput",
  "RuntimeHeadlessSessionEventResult",
  "RuntimeHeadlessSessionHandle",
  "RuntimeHeadlessSessionLimitProfile",
  "RuntimeHeadlessSessionListener",
  "RuntimeHeadlessSessionMountInput",
  "RuntimeHeadlessSessionMountInvalidReason",
  "RuntimeHeadlessSessionMountResult",
  "RuntimeHeadlessSessionReadResult",
  "RuntimeHeadlessSessionSnapshot",
  "RuntimeHeadlessSessionSubscribeResult",
  "RuntimeHeadlessSessionSubscription",
  "RuntimeHeadlessSessionUnsubscribeResult",
]);

const EXPECTED_RUNTIME_REGISTRY_EXPORTS = Object.freeze([
  "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
  "createRuntimeReactAdapterRegistry",
  "readRuntimeReactAdapterRegistry",
  "readRuntimeReactAdapterRegistryAuthority",
]);

const EXPECTED_RUNTIME_REGISTRY_TYPE_EXPORTS = Object.freeze([
  "RuntimeReactAdapterRegistryAuthority",
  "RuntimeReactAdapterRegistryCreateInput",
  "RuntimeReactAdapterRegistryCreateResult",
  "RuntimeReactAdapterRegistryHandle",
  "RuntimeReactAdapterRegistryInvalidReason",
  "RuntimeReactAdapterRegistryLimitProfile",
  "RuntimeReactAdapterRegistryReadResult",
  "RuntimeReactAdapterRegistrySnapshot",
  "RuntimeReactBehaviorAdapterComponent",
  "RuntimeReactBehaviorAdapterProps",
  "RuntimeReactBehaviorAdapterRegistration",
  "RuntimeReactCommandAttachmentHandle",
  "RuntimeReactCommandAttachmentResult",
  "RuntimeReactCommandDetachmentResult",
  "RuntimeReactComponentAdapterComponent",
  "RuntimeReactComponentAdapterProps",
  "RuntimeReactComponentAdapterRegistration",
  "RuntimeReactComponentCommandPort",
  "RuntimeReactDiagnosticIdentity",
  "RuntimeReactEventDispatchResult",
  "RuntimeReactInteractionPort",
  "RuntimeReactNamedSlots",
  "RuntimeReactSemanticStyle",
  "RuntimeReactStyleParts",
  "RuntimeReactStyleProperties",
]);

const EXPECTED_REFERENCE_ADAPTER_EXPORTS = Object.freeze([
  "AlertReactAdapter",
  "ButtonReactAdapter",
  "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
  "REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS",
  "StackReactAdapter",
  "TextFieldReactAdapter",
  "TextReactAdapter",
  "alertReactAdapterRegistration",
  "buttonReactAdapterRegistration",
  "stackReactAdapterRegistration",
  "textFieldReactAdapterRegistration",
  "textReactAdapterRegistration",
]);

const EXPECTED_REFERENCE_PACKAGE_EXPORTS = Object.freeze([
  ".",
  "./catalog.json",
  "./components",
  "./host-operations",
  "./operations",
  "./parity",
  "./react-adapters",
  "./tokens",
]);

const EXPECTED_RUNTIME_CORE_MANIFEST = {
  name: "@desen/runtime-core",
  version: "0.0.0",
  private: true,
  description:
    "Framework-neutral state, binding, predicate, action, resource, operation, behavior, and lifecycle semantics.",
  license: "Apache-2.0",
  type: "module",
  sideEffects: false,
  files: ["dist"],
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
  },
  scripts: {
    build: "tsc -p tsconfig.build.json",
    lint: "eslint src test --max-warnings=0",
    typecheck: "tsc -p tsconfig.json --noEmit",
    test: "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:host-ports": "vitest run test/host-ports.test.ts",
    "test:predicate-evaluation": "vitest run test/predicate-evaluation.test.ts",
    "test:repeat-materialization": "vitest run test/repeat-materialization.test.ts",
    "test:resource-lifecycle": "vitest run test/resource-lifecycle.test.ts",
    "test:token-format-resolution": "vitest run test/token-format-resolution.test.ts",
    "test:value-resolution": "vitest run test/value-resolution.test.ts",
    "test:variant-style-evaluation": "vitest run test/variant-style-evaluation.test.ts",
    "test:local-state-identity": "vitest run test/local-state-identity.test.ts",
    "test:operation-lifecycle": "vitest run test/operation-lifecycle.test.ts",
    "test:state-navigation-actions": "vitest run test/state-navigation-actions.test.ts",
    "test:operation-resource-actions": "vitest run test/operation-resource-actions.test.ts",
    "test:command-event-actions": "vitest run test/command-event-actions.test.ts",
    "test:action-turns": "vitest run test/action-turns.test.ts",
    "test:adapter-bridges": "vitest run test/adapter-bridges.test.ts",
    "test:reactive-reevaluation":
      "vitest run test/reactive-host-ports.test.ts test/reactive-reevaluation.test.ts",
    "test:headless-sign-in":
      "vitest run test/headless-materialization.test.ts test/headless-session.test.ts",
  },
  dependencies: {
    "@desen/protocol": "workspace:*",
    "@desen/validator": "workspace:*",
  },
  devDependencies: {
    vitest: "4.1.10",
  },
};

const EXPECTED_RUNTIME_REACT_MANIFEST = {
  name: "@desen/runtime-react",
  version: "0.0.0",
  private: true,
  description:
    "React renderer that materializes runtime-core render plans through registered adapters.",
  license: "Apache-2.0",
  type: "module",
  sideEffects: false,
  files: ["dist"],
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
  },
  scripts: {
    build: "tsc -p tsconfig.build.json",
    lint: "eslint src test --max-warnings=0",
    typecheck: "tsc -p tsconfig.json --noEmit",
    test: "vitest run",
    "test:adapter-registry": "vitest run test/adapter-registry.test.tsx",
    "test:resolved-props-slots": "vitest run test/resolved-props-slots.test.tsx",
    "test:style-parts-states": "vitest run test/style-parts-states.test.tsx",
    "test:interactions": "vitest run test/interaction-wiring.test.tsx test/binding-parity.test.tsx",
    "test:coverage": "vitest run --coverage",
  },
  dependencies: {
    "@desen/runtime-core": "workspace:*",
    "@desen/validator": "workspace:*",
  },
  peerDependencies: {
    react: ">=19.0.0 <20.0.0",
  },
  devDependencies: {
    "@desen/protocol": "workspace:*",
    "@testing-library/react": "16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    jsdom: "29.1.1",
    react: "19.2.8",
    "react-dom": "19.2.8",
    vitest: "4.1.10",
  },
};

const EXPECTED_REFERENCE_MANIFEST = {
  name: "@desen/reference-catalog-web",
  version: "0.0.0",
  private: true,
  description:
    "Accessible real Web-React components and exact capability manifests shared by Desen App and the reference host.",
  license: "Apache-2.0",
  type: "module",
  sideEffects: false,
  files: ["catalog.json", "dist"],
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
    "./catalog.json": "./catalog.json",
    "./components": {
      types: "./dist/components/index.d.ts",
      import: "./dist/components/index.js",
    },
    "./host-operations": {
      types: "./dist/host-operations/index.d.ts",
      import: "./dist/host-operations/index.js",
    },
    "./operations": {
      types: "./dist/operations/index.d.ts",
      import: "./dist/operations/index.js",
    },
    "./parity": {
      types: "./dist/parity/index.d.ts",
      import: "./dist/parity/index.js",
    },
    "./react-adapters": {
      types: "./dist/react-adapters/index.d.ts",
      import: "./dist/react-adapters/index.js",
    },
    "./tokens": {
      types: "./dist/tokens/index.d.ts",
      import: "./dist/tokens/index.js",
    },
  },
  scripts: {
    build: "tsc -p tsconfig.build.json",
    lint: "eslint src test --max-warnings=0",
    typecheck: "tsc -p tsconfig.json --noEmit",
    test: "vitest run",
    "test:components": "vitest run test/foundation-components.test.tsx",
    "test:interactive-components": "vitest run test/interactive-components.test.tsx",
    "test:parity":
      "vitest run test/foundation-components.test.tsx test/interactive-components.test.tsx test/parity-metadata.test.ts test/parity-contracts.test.tsx",
    "test:react-adapters":
      "vitest run test/react-adapters.test.tsx test/react-adapters-consumer.test.mjs",
    "test:sign-in-operation": "vitest run test/sign-in-operation.test.ts",
    "test:package-digest-profile": "vitest run test/package-digest-profile.test.ts",
    "test:tokens": "vitest run test/reference-tokens.test.ts",
    "test:coverage": "vitest run --coverage",
  },
  dependencies: {
    "@desen/catalog-sdk": "workspace:*",
    "@desen/protocol": "workspace:*",
    "@desen/runtime-react": "workspace:*",
  },
  peerDependencies: {
    react: ">=19.0.0 <20.0.0",
  },
  devDependencies: {
    "@testing-library/react": "16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    jsdom: "29.1.1",
    react: "19.2.8",
    "react-dom": "19.2.8",
    vitest: "4.1.10",
  },
};

const EXPECTED_REFERENCE_COMPONENT_IDS = Object.freeze([
  "com.example.ui/Alert",
  "com.example.ui/Button",
  "com.example.ui/Stack",
  "com.example.ui/Text",
  "com.example.ui/TextField",
]);

const EXPECTED_COMPONENT_BINDING_PARITY_CASES = Object.freeze([
  "component-missing",
  "component-duplicate",
  "component-kind",
  "component-runtime-instance-id",
  "component-source-node-id",
  "component-capability-id",
]);

const EXPECTED_BEHAVIOR_BINDING_PARITY_CASES = Object.freeze([
  "behavior-missing",
  "behavior-duplicate",
  "behavior-kind",
  "behavior-runtime-instance-id",
  "behavior-source-node-id",
  "behavior-capability-id",
  "behavior-behavior-id",
  "behavior-owner-runtime-instance-id",
]);

const EXPECTED_INTERACTION_TEST_TITLES = Object.freeze([
  "keeps server rendering callback-free and grants no command authority without a commit",
  "rejects initial pre-commit command capture, then attaches in the committed passive effect",
  "routes exact component events and command callbacks without leaking a newer snapshot",
  "rejects malformed and foreign command authority while supersession stays owner-safe",
  "does not admit authority when hostile reflection synchronously unmounts its commit",
  "detaches surviving command ownership on unmount even when the adapter omits cleanup",
  "dispatches behavior events but never grants behavior command authority",
  "reattaches safely under StrictMode without leaving the simulated mount live",
  "creates no command authority for a suspended render that never commits",
  "fails closed before adapter execution for exact component case %s",
  "fails closed before adapter execution for exact behavior case %s",
]);

const EXPECTED_REFERENCE_TEST_TITLES = Object.freeze([
  "exports one frozen static five-component factory input",
  "renders all five real components through explicit schema and slot mappings",
  "dispatches fresh inert Button press payloads without native-event authority",
  "dispatches fresh inert TextField change payloads without input or event leakage",
  "attaches the narrow focus command only after commit and denies every other input",
  "detaches each exact attachment on disabled and interaction-port supersession and unmount",
  "balances StrictMode replay without retaining superseded command authority",
  "creates no command authority during SSR or an abandoned Suspense render",
  "never spreads semantic style or undeclared props onto native elements",
  "loads the exact public react-adapters package subpath through the consumer fixture",
]);

const EXPECTED_CORE_TEST_TITLES = Object.freeze([
  "retains one stable T14 binding while snapshots publish and detaches idempotently",
  "rejects copied, foreign, stale, behavior, unknown, and malformed authorities",
  "supersedes atomically and makes reentrant ownership changes fail the active call closed",
  "contains throwing callbacks and rejects executable or malformed callback results",
  "revokes attachments on binding replacement, navigation, and terminal disposal",
]);

const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "builds deterministic M05-T04 interaction evidence from the reviewed workspace",
  "produces byte-identical evidence in two independent builds",
  "rejects every exact prerequisite artifact tamper",
  "rejects core command attachment and public export drift",
  "rejects React commit-gating, event, command, and binding-parity drift",
  "rejects reference adapter inventory, focus command, and platform leakage",
  "rejects focused test and compiler-negative inventory drift",
  "rejects successor package omission, addition, mutation, and Catalog tuple drift",
  "rejects traceability and historical compatibility drift",
  "rejects immutable SC-01 DTCG migration drift",
  "rejects immutable M04-T06 local-state migration drift",
  "rejects immutable M04-T12 command/event migration drift",
  "rejects immutable M04-T15 reactive reevaluation migration drift",
  "rejects package scripts and optimized CI inventory drift",
  "verifies exact artifact bytes and final proof pins",
  "rejects hostile, inherited, symbol, Proxy, and unknown options without hooks",
  "rejects unsafe proof and Proof Matrix paths",
  "atomic writer rejects symlink destinations and temporary-byte substitution",
]);

const COMPATIBILITY_PATHS = Object.freeze([
  "scripts/lib/reference-catalog-web-parity-proof.mjs",
  "scripts/lib/reference-catalog-web-capability-artifact-proof.mjs",
  "scripts/lib/reference-tokens-and-synthetic-fixtures-proof.mjs",
  "scripts/lib/runtime-core-headless-sign-in-proof.mjs",
  "scripts/lib/runtime-core-audit-hardening-proof.mjs",
  "scripts/lib/runtime-react-resolved-styles-proof.mjs",
  "scripts/lib/sc-01-dtcg-audit.mjs",
  "scripts/generate-sc-01-dtcg-proof.mjs",
  "scripts/verify-sc-01-dtcg.mjs",
  "scripts/lib/runtime-core-local-state-identity-proof.mjs",
  "scripts/generate-runtime-core-local-state-identity-proof.mjs",
  "scripts/verify-runtime-core-local-state-identity.mjs",
  "scripts/lib/runtime-core-command-event-actions-proof.mjs",
  "scripts/generate-runtime-core-command-event-actions-proof.mjs",
  "scripts/verify-runtime-core-command-event-actions.mjs",
  "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/generate-runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/verify-runtime-core-reactive-reevaluation.mjs",
  "tests/reference-catalog-web-capability-artifact.test.mjs",
  "tests/reference-catalog-web-parity.test.mjs",
  "tests/reference-tokens-and-synthetic-fixtures.test.mjs",
  "tests/runtime-core-headless-sign-in.test.mjs",
  "tests/runtime-core-audit-hardening.test.mjs",
  "tests/runtime-react-resolved-styles.test.mjs",
  "tests/sc-01-dtcg-audit.test.mjs",
  "tests/runtime-core-local-state-identity.test.mjs",
  "tests/runtime-core-command-event-actions.test.mjs",
  "tests/runtime-core-reactive-reevaluation.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  "README.md",
  PROJECT_STATUS_PATH,
  "dependency-cruiser.config.cjs",
  "docs/adr/0010-m05-react-runtime-and-reference-host-boundaries.md",
  "docs/architecture/ARCHITECTURE.md",
  "docs/plan/PROTOCOL-FINDINGS.md",
  STRATEGIC_VALIDATION_PATH,
  "docs/plan/TASKS.md",
  SC01_DTCG_PROFILE_PATH,
  "docs/proof/NORMATIVE-COVERAGE.md",
  SC01_COMPARISON_PATH,
  SC01_DTCG_ARTIFACT_PATH,
  LOCAL_STATE_IDENTITY_ARTIFACT_PATH,
  LOCAL_STATE_IDENTITY_PROOF_PATH,
  COMMAND_EVENT_ARTIFACT_PATH,
  COMMAND_EVENT_PROOF_PATH,
  REACTIVE_REEVALUATION_ARTIFACT_PATH,
  REACTIVE_REEVALUATION_PROOF_PATH,
  PROOF_MATRIX_PATH,
  PROOF_DOCUMENT_PATH,
  "package.json",
  "pnpm-lock.yaml",
  "packages/runtime-core/README.md",
  "packages/runtime-core/package.json",
  "packages/runtime-core/src/headless-session.ts",
  "packages/runtime-core/src/index.ts",
  "packages/runtime-core/src/runtime-json-snapshot.ts",
  "packages/runtime-core/test/headless-session.test.ts",
  "packages/runtime-core/test/headless-session.types.ts",
  "packages/runtime-core/dist/index.d.ts",
  "packages/runtime-core/dist/index.d.ts.map",
  "packages/runtime-core/dist/index.js",
  "packages/runtime-core/dist/index.js.map",
  "packages/runtime-core/dist/headless-session.d.ts",
  "packages/runtime-core/dist/headless-session.d.ts.map",
  "packages/runtime-core/dist/headless-session.js",
  "packages/runtime-core/dist/headless-session.js.map",
  "packages/runtime-core/dist/runtime-json-snapshot.d.ts",
  "packages/runtime-core/dist/runtime-json-snapshot.d.ts.map",
  "packages/runtime-core/dist/runtime-json-snapshot.js",
  "packages/runtime-core/dist/runtime-json-snapshot.js.map",
  "packages/runtime-react/README.md",
  "packages/runtime-react/package.json",
  "packages/runtime-react/src/index.ts",
  "packages/runtime-react/src/interactions.tsx",
  "packages/runtime-react/src/registry.ts",
  "packages/runtime-react/src/render-plan.tsx",
  "packages/runtime-react/test/adapter-registry.test.tsx",
  "packages/runtime-react/test/binding-parity.test.tsx",
  "packages/runtime-react/test/interaction-wiring.test.tsx",
  "packages/runtime-react/test/interaction-wiring.types.ts",
  "packages/runtime-react/test/session-fixture.ts",
  "packages/runtime-react/dist/index.d.ts",
  "packages/runtime-react/dist/index.d.ts.map",
  "packages/runtime-react/dist/index.js",
  "packages/runtime-react/dist/index.js.map",
  "packages/runtime-react/dist/interactions.d.ts",
  "packages/runtime-react/dist/interactions.d.ts.map",
  "packages/runtime-react/dist/interactions.js",
  "packages/runtime-react/dist/interactions.js.map",
  "packages/runtime-react/dist/registry.d.ts",
  "packages/runtime-react/dist/registry.d.ts.map",
  "packages/runtime-react/dist/registry.js",
  "packages/runtime-react/dist/registry.js.map",
  "packages/runtime-react/dist/render-plan.d.ts",
  "packages/runtime-react/dist/render-plan.d.ts.map",
  "packages/runtime-react/dist/render-plan.js",
  "packages/runtime-react/dist/render-plan.js.map",
  "packages/reference-catalog-web/README.md",
  REFERENCE_CATALOG_PATH,
  "packages/reference-catalog-web/package.json",
  "packages/reference-catalog-web/src/index.ts",
  "packages/reference-catalog-web/src/react-adapters/index.tsx",
  "packages/reference-catalog-web/src/components/button.tsx",
  "packages/reference-catalog-web/src/components/text-field.tsx",
  "packages/reference-catalog-web/test/react-adapters-consumer.mjs",
  "packages/reference-catalog-web/test/react-adapters-consumer.test.mjs",
  "packages/reference-catalog-web/test/react-adapters.test.tsx",
  "packages/reference-catalog-web/test/react-adapters.types.tsx",
  "scripts/generate-runtime-react-interactions-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/runtime-react-interactions-proof.mjs",
  "scripts/run-ci-quality-gate.mjs",
  "scripts/test/ci-quality-gate.test.mjs",
  "scripts/verify-runtime-react-interactions.mjs",
  "tests/runtime-react-interactions.test.mjs",
  ...COMPATIBILITY_PATHS,
]);

const SOURCE_PATHS = Object.freeze({
  core: "packages/runtime-core/src/headless-session.ts",
  coreIndex: "packages/runtime-core/src/index.ts",
  coreReadme: "packages/runtime-core/README.md",
  corePackage: "packages/runtime-core/package.json",
  runtimeJsonSnapshot: "packages/runtime-core/src/runtime-json-snapshot.ts",
  coreDistIndexJs: "packages/runtime-core/dist/index.js",
  coreDistIndexTypes: "packages/runtime-core/dist/index.d.ts",
  coreDistHeadlessJs: "packages/runtime-core/dist/headless-session.js",
  coreDistHeadlessTypes: "packages/runtime-core/dist/headless-session.d.ts",
  coreDistSnapshotJs: "packages/runtime-core/dist/runtime-json-snapshot.js",
  coreDistSnapshotTypes: "packages/runtime-core/dist/runtime-json-snapshot.d.ts",
  coreTests: "packages/runtime-core/test/headless-session.test.ts",
  coreTypes: "packages/runtime-core/test/headless-session.types.ts",
  runtimeIndex: "packages/runtime-react/src/index.ts",
  runtimeRegistry: "packages/runtime-react/src/registry.ts",
  interactions: "packages/runtime-react/src/interactions.tsx",
  renderer: "packages/runtime-react/src/render-plan.tsx",
  interactionTests: "packages/runtime-react/test/interaction-wiring.test.tsx",
  parityTests: "packages/runtime-react/test/binding-parity.test.tsx",
  interactionTypes: "packages/runtime-react/test/interaction-wiring.types.ts",
  runtimeDistIndexJs: "packages/runtime-react/dist/index.js",
  runtimeDistIndexTypes: "packages/runtime-react/dist/index.d.ts",
  runtimeDistInteractionsJs: "packages/runtime-react/dist/interactions.js",
  runtimeDistInteractionsTypes: "packages/runtime-react/dist/interactions.d.ts",
  runtimeDistRegistryJs: "packages/runtime-react/dist/registry.js",
  runtimeDistRegistryTypes: "packages/runtime-react/dist/registry.d.ts",
  runtimeDistRendererJs: "packages/runtime-react/dist/render-plan.js",
  runtimeDistRendererTypes: "packages/runtime-react/dist/render-plan.d.ts",
  referenceIndex: "packages/reference-catalog-web/src/index.ts",
  referenceAdapters: "packages/reference-catalog-web/src/react-adapters/index.tsx",
  referenceTests: "packages/reference-catalog-web/test/react-adapters.test.tsx",
  referenceConsumerTests: "packages/reference-catalog-web/test/react-adapters-consumer.test.mjs",
  referenceTypes: "packages/reference-catalog-web/test/react-adapters.types.tsx",
  referenceConsumer: "packages/reference-catalog-web/test/react-adapters-consumer.mjs",
  referencePackage: "packages/reference-catalog-web/package.json",
  runtimePackage: "packages/runtime-react/package.json",
  compatibilityParityProof: "scripts/lib/reference-catalog-web-parity-proof.mjs",
  compatibilityParityTests: "tests/reference-catalog-web-parity.test.mjs",
  rootPackage: "package.json",
  ciRunner: "scripts/run-ci-quality-gate.mjs",
  ciTests: "scripts/test/ci-quality-gate.test.mjs",
  rootTests: "tests/runtime-react-interactions.test.mjs",
  sc01DtcgAudit: "scripts/lib/sc-01-dtcg-audit.mjs",
  sc01DtcgTests: "tests/sc-01-dtcg-audit.test.mjs",
  sc01DtcgGenerate: "scripts/generate-sc-01-dtcg-proof.mjs",
  sc01DtcgVerify: "scripts/verify-sc-01-dtcg.mjs",
  sc01DtcgArtifact: SC01_DTCG_ARTIFACT_PATH,
  localStateIdentityAudit: "scripts/lib/runtime-core-local-state-identity-proof.mjs",
  localStateIdentityTests: "tests/runtime-core-local-state-identity.test.mjs",
  localStateIdentityGenerate: "scripts/generate-runtime-core-local-state-identity-proof.mjs",
  localStateIdentityVerify: "scripts/verify-runtime-core-local-state-identity.mjs",
  localStateIdentityArtifact: LOCAL_STATE_IDENTITY_ARTIFACT_PATH,
  localStateIdentityProof: LOCAL_STATE_IDENTITY_PROOF_PATH,
  commandEventAudit: "scripts/lib/runtime-core-command-event-actions-proof.mjs",
  commandEventTests: "tests/runtime-core-command-event-actions.test.mjs",
  commandEventGenerate: "scripts/generate-runtime-core-command-event-actions-proof.mjs",
  commandEventVerify: "scripts/verify-runtime-core-command-event-actions.mjs",
  commandEventArtifact: COMMAND_EVENT_ARTIFACT_PATH,
  commandEventProof: COMMAND_EVENT_PROOF_PATH,
  reactiveReevaluationAudit: "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
  reactiveReevaluationTests: "tests/runtime-core-reactive-reevaluation.test.mjs",
  reactiveReevaluationGenerate: "scripts/generate-runtime-core-reactive-reevaluation-proof.mjs",
  reactiveReevaluationVerify: "scripts/verify-runtime-core-reactive-reevaluation.mjs",
  reactiveReevaluationArtifact: REACTIVE_REEVALUATION_ARTIFACT_PATH,
  reactiveReevaluationProof: REACTIVE_REEVALUATION_PROOF_PATH,
  sc01DtcgProfile: SC01_DTCG_PROFILE_PATH,
  sc01Comparison: SC01_COMPARISON_PATH,
  strategicValidation: STRATEGIC_VALIDATION_PATH,
  projectStatus: PROJECT_STATUS_PATH,
  tasks: "docs/plan/TASKS.md",
  normative: NORMATIVE_COVERAGE_PATH,
  findings: "docs/plan/PROTOCOL-FINDINGS.md",
  proof: PROOF_DOCUMENT_PATH,
  matrix: PROOF_MATRIX_PATH,
});

const ALLOWED_OVERRIDE_PATHS = new Set([
  ...TRACKED_PATHS,
  ...Object.values(SOURCE_PATHS),
  ...PREREQUISITES.map(({ path: prerequisitePath }) => prerequisitePath),
]);

/** Controlled deterministic M05-T04 evidence failure. */
export class RuntimeReactInteractionsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactInteractionsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactInteractionsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function prefixedSha256(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function sorted(values) {
  return [...values].sort();
}

function exactArray(actual, expected) {
  return (
    actual.length === expected.length && actual.every((entry, index) => entry === expected[index])
  );
}

function captureExactRecord(value, expectedKeys, code, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail(code, `${label} must be a plain own-data object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(code, `${label} could not be captured safely.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string") ||
    !exactArray(sorted(keys), sorted(expectedKeys))
  ) {
    fail(code, `${label} own-key inventory changed.`, { actual: keys, expected: expectedKeys });
  }
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(code, `${label}.${key} must be an enumerable own data property.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail("RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID", `${label} must be a plain own-data object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
      `${label} contains unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
        `${label}.${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
        `${label}.${key} must be an enumerable own data property.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function isPortableDistOverride(relativePath) {
  if (!relativePath.startsWith(`${REFERENCE_DIST_ROOT}/`)) return false;
  const suffix = relativePath.slice(REFERENCE_DIST_ROOT.length + 1);
  return (
    suffix.length > 0 &&
    !suffix.includes("\\") &&
    suffix.split("/").every((segment) => /^[a-z0-9][a-z0-9._-]*$/u.test(segment))
  );
}

function captureFileOverrides(value) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
      "fileOverrides must be a plain own-data object.",
    );
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
      "fileOverrides could not be captured safely.",
    );
  }
  const captured = captureOwnDataOptions(
    value,
    keys.filter((key) => typeof key === "string"),
    "fileOverrides",
  );
  const overrides = Object.create(null);
  for (const [relativePath, entry] of Object.entries(captured)) {
    if (!ALLOWED_OVERRIDE_PATHS.has(relativePath) && !isPortableDistOverride(relativePath)) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
        `fileOverrides contains an unconsumed path: ${relativePath}.`,
      );
    }
    if (
      entry !== null &&
      typeof entry !== "string" &&
      (!Buffer.isBuffer(entry) || utilTypes.isProxy(entry))
    ) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
        `fileOverrides.${relativePath} must be text, a non-Proxy Buffer, or null.`,
      );
    }
    overrides[relativePath] = Buffer.isBuffer(entry) ? Buffer.from(entry) : entry;
  }
  return Object.freeze(overrides);
}

function capturePrerequisiteBytes(value) {
  if (value === undefined) return undefined;
  const allowedKeys = PREREQUISITES.map(({ key }) => key);
  const captured = captureOwnDataOptions(value, allowedKeys, "prerequisiteBytes");
  const overrides = Object.create(null);
  for (const [key, bytes] of Object.entries(captured)) {
    if (!Buffer.isBuffer(bytes) || utilTypes.isProxy(bytes)) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID",
        `prerequisiteBytes.${key} must be a non-Proxy Buffer.`,
      );
    }
    overrides[key] = Buffer.from(bytes);
  }
  return Object.freeze(overrides);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID", `${label} must be a non-empty string.`);
  }
  return value;
}

function optionalBuffer(value, label) {
  if (value === undefined) return undefined;
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value)) {
    fail("RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID", `${label} must be a non-Proxy Buffer.`);
  }
  return Buffer.from(value);
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("RUNTIME_REACT_INTERACTIONS_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularBytes(absolutePath, missingCode, unsafeCode, label) {
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail(missingCode, `${label} is missing.`, { cause: String(error) });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(unsafeCode, `${label} must be a regular non-symlink file.`);
  }
  return readFile(absolutePath);
}

async function workspaceBytes(relativePath, overrides) {
  if (overrides !== undefined && Object.hasOwn(overrides, relativePath)) {
    const override = overrides[relativePath];
    if (override === null) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_TRACKED_FILE_MISSING",
        `Tracked file was removed: ${relativePath}.`,
      );
    }
    return Buffer.isBuffer(override) ? Buffer.from(override) : Buffer.from(override, "utf8");
  }
  return readRegularBytes(
    path.join(WORKSPACE_ROOT, relativePath),
    "RUNTIME_REACT_INTERACTIONS_TRACKED_FILE_MISSING",
    "RUNTIME_REACT_INTERACTIONS_TRACKED_FILE_UNSAFE",
    `Tracked file ${relativePath}`,
  );
}

async function workspaceText(relativePath, overrides) {
  return (await workspaceBytes(relativePath, overrides)).toString("utf8");
}

function requireFragments(text, fragments, code, label) {
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      fail(code, `${label} lost a reviewed semantic anchor.`, { fragment });
    }
  }
}

function rejectFragments(text, fragments, code, label) {
  for (const fragment of fragments) {
    if (text.includes(fragment)) {
      fail(code, `${label} gained forbidden authority.`, { fragment });
    }
  }
}

function sourceFile(relativePath, text) {
  return ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function namedExportInventory(relativePath, text) {
  const values = [];
  const types = [];
  const file = sourceFile(relativePath, text);
  for (const statement of file.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        (statement.isTypeOnly || element.isTypeOnly ? types : values).push(element.name.text);
      }
      continue;
    }
    const modifiers = statement.modifiers ?? [];
    if (!modifiers.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      const target =
        ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
          ? types
          : values;
      target.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) values.push(declaration.name.text);
      }
    }
  }
  return Object.freeze({
    values: Object.freeze(sorted(values)),
    types: Object.freeze(sorted(types)),
  });
}

function importInventory(relativePath, text) {
  const imports = [];
  const file = sourceFile(relativePath, text);
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    }
  }
  return Object.freeze(sorted(new Set(imports)));
}

function referenceInteractionCallSiteInventory(relativePath, text) {
  const file = sourceFile(relativePath, text);
  const sideEffectingMethods = new Set(["attachCommands", "detachCommands", "dispatchEvent"]);
  const initialInteractionRoots = new Set();
  const interactionRoots = new Set();
  const methodAliases = new Map();
  const calls = [];
  const unsafe = [];

  function enclosingJsxAttribute(node) {
    let current = node;
    while (current.parent !== undefined) {
      current = current.parent;
      if (ts.isJsxAttribute(current)) return current.name.getText(file);
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isClassDeclaration(current) ||
        ts.isSourceFile(current)
      ) {
        return undefined;
      }
    }
    return undefined;
  }

  function isInsideUseEffectCallback(node) {
    let current = node;
    while (current.parent !== undefined) {
      current = current.parent;
      if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
        const parent = current.parent;
        if (
          ts.isCallExpression(parent) &&
          ts.isIdentifier(parent.expression) &&
          parent.expression.text === "useEffect" &&
          parent.arguments[0] === current
        ) {
          return true;
        }
      }
      if (ts.isSourceFile(current)) return false;
    }
    return false;
  }

  function unwrapped(node) {
    let current = node;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  }

  function bindingPropertyName(element) {
    const candidate = element.propertyName ?? element.name;
    return ts.isIdentifier(candidate) || ts.isStringLiteralLike(candidate)
      ? candidate.text
      : undefined;
  }

  function collectInteractionParameters(node) {
    if (ts.isParameter(node) && ts.isObjectBindingPattern(node.name)) {
      for (const element of node.name.elements) {
        if (bindingPropertyName(element) === "interactions" && ts.isIdentifier(element.name)) {
          initialInteractionRoots.add(element.name.text);
          interactionRoots.add(element.name.text);
        }
      }
    }
    ts.forEachChild(node, collectInteractionParameters);
  }
  collectInteractionParameters(file);

  function methodAccess(node) {
    const expression = unwrapped(node);
    if (
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      interactionRoots.has(expression.expression.text) &&
      sideEffectingMethods.has(expression.name.text)
    ) {
      return Object.freeze({
        expression,
        method: expression.name.text,
        computed: false,
      });
    }
    if (
      ts.isElementAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      interactionRoots.has(expression.expression.text)
    ) {
      const argument = expression.argumentExpression;
      if (argument !== undefined && ts.isStringLiteralLike(argument)) {
        if (sideEffectingMethods.has(argument.text)) {
          return Object.freeze({
            expression,
            method: argument.text,
            computed: true,
          });
        }
      }
    }
    return undefined;
  }

  const variableDeclarations = [];
  function collectVariableDeclarations(node) {
    if (ts.isVariableDeclaration(node)) variableDeclarations.push(node);
    ts.forEachChild(node, collectVariableDeclarations);
  }
  collectVariableDeclarations(file);

  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of variableDeclarations) {
      const initializer =
        declaration.initializer === undefined ? undefined : unwrapped(declaration.initializer);
      if (initializer === undefined) continue;
      if (ts.isIdentifier(declaration.name)) {
        if (
          ts.isIdentifier(initializer) &&
          interactionRoots.has(initializer.text) &&
          !interactionRoots.has(declaration.name.text)
        ) {
          interactionRoots.add(declaration.name.text);
          changed = true;
        }
        const access = methodAccess(initializer);
        const aliasedMethod =
          ts.isIdentifier(initializer) && methodAliases.has(initializer.text)
            ? methodAliases.get(initializer.text)
            : access?.method;
        if (
          aliasedMethod !== undefined &&
          methodAliases.get(declaration.name.text) !== aliasedMethod
        ) {
          methodAliases.set(declaration.name.text, aliasedMethod);
          changed = true;
        }
      } else if (
        ts.isObjectBindingPattern(declaration.name) &&
        ts.isIdentifier(initializer) &&
        interactionRoots.has(initializer.text)
      ) {
        for (const element of declaration.name.elements) {
          const method = bindingPropertyName(element);
          if (
            method !== undefined &&
            sideEffectingMethods.has(method) &&
            ts.isIdentifier(element.name) &&
            methodAliases.get(element.name.text) !== method
          ) {
            methodAliases.set(element.name.text, method);
            changed = true;
          }
        }
      }
    }
  }

  for (const root of interactionRoots) {
    if (!initialInteractionRoots.has(root)) unsafe.push(`interaction-object-alias:${root}`);
  }
  for (const [alias, method] of methodAliases) {
    unsafe.push(`interaction-method-alias:${alias}:${method}`);
  }

  function isUseEffectDependency(node) {
    const array = node.parent;
    if (!ts.isArrayLiteralExpression(array)) return false;
    const call = array.parent;
    return (
      ts.isCallExpression(call) &&
      ts.isIdentifier(call.expression) &&
      call.expression.text === "useEffect" &&
      call.arguments[1] === array
    );
  }

  function visit(node) {
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      interactionRoots.has(node.expression.text)
    ) {
      unsafe.push(`computed-interaction-access:${node.expression.text}`);
    }
    if (
      ts.isIdentifier(node) &&
      interactionRoots.has(node.text) &&
      !(
        (ts.isBindingElement(node.parent) && node.parent.name === node) ||
        (ts.isVariableDeclaration(node.parent) && node.parent.name === node) ||
        ((ts.isPropertyAccessExpression(node.parent) ||
          ts.isElementAccessExpression(node.parent)) &&
          node.parent.expression === node) ||
        isUseEffectDependency(node)
      )
    ) {
      unsafe.push(`interaction-object-escape:${node.text}`);
    }

    const access =
      ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
        ? methodAccess(node)
        : undefined;
    if (access !== undefined) {
      const directCall =
        ts.isCallExpression(access.expression.parent) &&
        access.expression.parent.expression === access.expression;
      if (!directCall || access.computed) {
        unsafe.push(
          `${access.computed ? "computed" : "detached"}-interaction-method:${access.method}`,
        );
      }
    }

    if (
      ts.isCallExpression(node) &&
      (methodAccess(node.expression) !== undefined ||
        (ts.isIdentifier(node.expression) && methodAliases.has(node.expression.text)))
    ) {
      const accessCall = methodAccess(node.expression);
      const method =
        accessCall?.method ??
        (ts.isIdentifier(node.expression) ? methodAliases.get(node.expression.text) : undefined);
      if (method !== undefined) {
        const eventName = method === "dispatchEvent" ? node.arguments[0] : undefined;
        calls.push(
          Object.freeze({
            method,
            event:
              eventName === undefined
                ? null
                : ts.isStringLiteralLike(eventName)
                  ? eventName.text
                  : "<dynamic>",
            committedEffect: isInsideUseEffectCallback(node),
            platformCallback: enclosingJsxAttribute(node) ?? null,
          }),
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return Object.freeze({
    calls: Object.freeze(calls),
    aliases: Object.freeze(
      sorted([
        ...[...interactionRoots]
          .filter((root) => !initialInteractionRoots.has(root))
          .map((root) => `object:${root}`),
        ...[...methodAliases].map(([alias, method]) => `method:${alias}:${method}`),
      ]),
    ),
    unsafe: Object.freeze(sorted(new Set(unsafe))),
  });
}

function testTitleInventory(relativePath, text) {
  const titles = [];
  const file = sourceFile(relativePath, text);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const direct =
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "it" || node.expression.text === "test");
      const parameterized =
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === "each" &&
        ts.isIdentifier(node.expression.expression.expression) &&
        (node.expression.expression.expression.text === "it" ||
          node.expression.expression.expression.text === "test");
      const title = node.arguments[0];
      if ((direct || parameterized) && title !== undefined && ts.isStringLiteralLike(title)) {
        titles.push(title.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return Object.freeze(titles);
}

function unwrapStaticExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function staticStringArray(file, expression) {
  const declarations = new Map();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer !== undefined) {
        declarations.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  const resolving = new Set();
  function resolve(candidate) {
    let current = unwrapStaticExpression(candidate);
    if (ts.isIdentifier(current)) {
      if (resolving.has(current.text)) return undefined;
      const initializer = declarations.get(current.text);
      if (initializer === undefined) return undefined;
      resolving.add(current.text);
      const resolved = resolve(initializer);
      resolving.delete(current.text);
      return resolved;
    }
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      ts.isIdentifier(current.expression.expression) &&
      current.expression.expression.text === "Object" &&
      current.expression.name.text === "freeze" &&
      current.arguments.length === 1
    ) {
      current = unwrapStaticExpression(current.arguments[0]);
    }
    if (
      !ts.isArrayLiteralExpression(current) ||
      current.elements.some((element) => !ts.isStringLiteralLike(unwrapStaticExpression(element)))
    ) {
      return undefined;
    }
    return Object.freeze(current.elements.map((element) => unwrapStaticExpression(element).text));
  }
  return resolve(expression);
}

function focusedTestRegistrationIntegrity(relativePath, text) {
  const file = sourceFile(relativePath, text);
  if (file.parseDiagnostics.length !== 0) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
      `${relativePath} no longer parses as a focused test source.`,
    );
  }
  const roots = new Set(["describe", "it", "test"]);
  const disabledRoots = new Set(["xdescribe", "xit", "xtest"]);
  const parameterized = [];
  let directCases = 0;
  let describeRegistrations = 0;

  function propertyName(expression) {
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (
      ts.isElementAccessExpression(expression) &&
      expression.argumentExpression !== undefined &&
      ts.isStringLiteralLike(expression.argumentExpression)
    ) {
      return expression.argumentExpression.text;
    }
    return undefined;
  }

  function rootedName(expression) {
    let current = unwrapStaticExpression(expression);
    while (true) {
      if (ts.isIdentifier(current)) {
        return roots.has(current.text) || disabledRoots.has(current.text)
          ? current.text
          : undefined;
      }
      if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
        current = unwrapStaticExpression(current.expression);
        continue;
      }
      if (ts.isCallExpression(current)) {
        current = unwrapStaticExpression(current.expression);
        continue;
      }
      return undefined;
    }
  }

  function callbackAndTitleAreExact(call, allowedIdentifier = undefined) {
    return (
      call.arguments.length === 2 &&
      ts.isStringLiteralLike(call.arguments[0]) &&
      (ts.isArrowFunction(call.arguments[1]) ||
        ts.isFunctionExpression(call.arguments[1]) ||
        (allowedIdentifier !== undefined &&
          ts.isIdentifier(call.arguments[1]) &&
          call.arguments[1].text === allowedIdentifier))
    );
  }

  function isEachBuilder(call) {
    return (
      (ts.isPropertyAccessExpression(call.expression) ||
        ts.isElementAccessExpression(call.expression)) &&
      propertyName(call.expression) === "each" &&
      ts.isIdentifier(call.expression.expression) &&
      (call.expression.expression.text === "it" || call.expression.expression.text === "test")
    );
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const root = rootedName(node.expression);
      if (root !== undefined) {
        if (disabledRoots.has(root)) {
          fail(
            "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
            `${relativePath} contains disabled ${root} test registration.`,
          );
        }
        if (ts.isIdentifier(node.expression) && roots.has(node.expression.text)) {
          if (!callbackAndTitleAreExact(node)) {
            fail(
              "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
              `${relativePath} uses non-direct or option-bearing ${node.expression.text} registration.`,
            );
          }
          if (node.expression.text === "describe") describeRegistrations += 1;
          else directCases += 1;
        } else if (isEachBuilder(node)) {
          const cases =
            node.arguments.length === 1 ? staticStringArray(file, node.arguments[0]) : undefined;
          if (cases === undefined || cases.length === 0) {
            fail(
              "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
              `${relativePath} has a non-literal or empty parameterized test table.`,
            );
          }
        } else if (ts.isCallExpression(node.expression) && isEachBuilder(node.expression)) {
          if (!callbackAndTitleAreExact(node, "expectBindingParityDriftFailure")) {
            fail(
              "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
              `${relativePath} has a modified parameterized test registration.`,
            );
          }
          const cases = staticStringArray(file, node.expression.arguments[0]);
          if (cases === undefined || cases.length === 0) {
            fail(
              "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
              `${relativePath} has an unresolved parameterized test table.`,
            );
          }
          parameterized.push(
            Object.freeze({
              title: node.arguments[0].text,
              cases,
            }),
          );
        } else {
          fail(
            "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
            `${relativePath} uses a conditional, disabled, concurrent, or chained ${root} registration.`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return Object.freeze({
    directCases,
    describeRegistrations,
    parameterized: Object.freeze(parameterized),
    executedCases:
      directCases + parameterized.reduce((total, entry) => total + entry.cases.length, 0),
  });
}

function matchesPreparedBindingInventory(relativePath, text) {
  const file = sourceFile(relativePath, text);
  const declarations = file.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "matchesPreparedBinding",
  );
  if (declarations.length !== 1) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
      `${relativePath} must contain one exact matchesPreparedBinding function.`,
    );
  }
  const declaration = declarations[0];
  if (
    declaration.body === undefined ||
    declaration.parameters.length !== 2 ||
    !ts.isIdentifier(declaration.parameters[0].name) ||
    declaration.parameters[0].name.text !== "prepared" ||
    !ts.isIdentifier(declaration.parameters[1].name) ||
    declaration.parameters[1].name.text !== "binding" ||
    declaration.body.statements.length !== 2
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
      `${relativePath} changed the exact binding comparator boundary.`,
    );
  }

  function flattenLogical(expression, operator) {
    const current = unwrapStaticExpression(expression);
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === operator) {
      return [
        ...flattenLogical(current.left, operator),
        ...flattenLogical(current.right, operator),
      ];
    }
    return [current];
  }

  function operand(expression) {
    const current = unwrapStaticExpression(expression);
    if (
      ts.isPropertyAccessExpression(current) &&
      ts.isIdentifier(current.expression) &&
      (current.expression.text === "prepared" || current.expression.text === "binding")
    ) {
      return `${current.expression.text}.${current.name.text}`;
    }
    if (ts.isStringLiteralLike(current)) return JSON.stringify(current.text);
    return undefined;
  }

  function comparison(expression, operator) {
    const current = unwrapStaticExpression(expression);
    if (!ts.isBinaryExpression(current) || current.operatorToken.kind !== operator) {
      return undefined;
    }
    const left = operand(current.left);
    const right = operand(current.right);
    return left === undefined || right === undefined
      ? undefined
      : `${left} ${current.operatorToken.getText(file)} ${right}`;
  }

  const [guard, result] = declaration.body.statements;
  if (
    !ts.isIfStatement(guard) ||
    guard.elseStatement !== undefined ||
    !ts.isBlock(guard.thenStatement) ||
    guard.thenStatement.statements.length !== 1 ||
    !ts.isReturnStatement(guard.thenStatement.statements[0]) ||
    guard.thenStatement.statements[0].expression?.kind !== ts.SyntaxKind.FalseKeyword ||
    !ts.isReturnStatement(result) ||
    result.expression === undefined
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
      `${relativePath} changed the fail-closed binding comparator control flow.`,
    );
  }
  const shared = flattenLogical(guard.expression, ts.SyntaxKind.BarBarToken).map((entry) =>
    comparison(entry, ts.SyntaxKind.ExclamationEqualsEqualsToken),
  );
  const conditional = unwrapStaticExpression(result.expression);
  if (shared.some((entry) => entry === undefined) || !ts.isConditionalExpression(conditional)) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
      `${relativePath} changed the exact shared binding comparisons.`,
    );
  }
  const discriminator = comparison(conditional.condition, ts.SyntaxKind.EqualsEqualsEqualsToken);
  const component = comparison(conditional.whenTrue, ts.SyntaxKind.EqualsEqualsEqualsToken);
  const behavior = flattenLogical(conditional.whenFalse, ts.SyntaxKind.AmpersandAmpersandToken).map(
    (entry) => comparison(entry, ts.SyntaxKind.EqualsEqualsEqualsToken),
  );
  if (
    discriminator === undefined ||
    component === undefined ||
    behavior.some((entry) => entry === undefined)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
      `${relativePath} changed the component/behavior discriminator comparisons.`,
    );
  }
  return Object.freeze({
    shared: Object.freeze(shared),
    discriminator,
    component,
    behavior: Object.freeze(behavior),
  });
}

function exactConsumerReexportInventory(relativePath, text) {
  const file = sourceFile(relativePath, text);
  if (
    file.parseDiagnostics.length !== 0 ||
    file.statements.length !== 1 ||
    !ts.isExportDeclaration(file.statements[0])
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_CONSUMER_DRIFT",
      "The public React-adapter consumer must remain one inert exact named re-export.",
    );
  }
  const declaration = file.statements[0];
  if (
    declaration.isTypeOnly ||
    declaration.exportClause === undefined ||
    !ts.isNamedExports(declaration.exportClause) ||
    declaration.moduleSpecifier === undefined ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "@desen/reference-catalog-web/react-adapters" ||
    declaration.exportClause.elements.some(
      (element) => element.isTypeOnly || element.propertyName !== undefined,
    )
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_CONSUMER_DRIFT",
      "The public React-adapter consumer subpath or exact named export form changed.",
    );
  }
  const exports = sorted(declaration.exportClause.elements.map((element) => element.name.text));
  if (!exactArray(exports, EXPECTED_REFERENCE_ADAPTER_EXPORTS)) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_CONSUMER_DRIFT",
      "The public React-adapter consumer export inventory changed.",
      { exports },
    );
  }
  return Object.freeze(exports);
}

async function executeReferenceConsumer(sourceText) {
  const consumerUrl = pathToFileURL(path.join(WORKSPACE_ROOT, SOURCE_PATHS.referenceConsumer));
  consumerUrl.searchParams.set("m05-t04", sha256(Buffer.from(sourceText, "utf8")));
  let namespace;
  try {
    namespace = await import(consumerUrl.href);
  } catch {
    fail(
      "RUNTIME_REACT_INTERACTIONS_CONSUMER_DRIFT",
      "The built public React-adapter package subpath could not be imported through its consumer.",
    );
  }
  const exports = sorted(Object.keys(namespace));
  if (!exactArray(exports, EXPECTED_REFERENCE_ADAPTER_EXPORTS)) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_CONSUMER_DRIFT",
      "The executed public React-adapter consumer namespace changed.",
      { exports },
    );
  }
  return Object.freeze(exports);
}

function markdownRow(markdown, id, expectedCells, code, label) {
  const rows = markdown.split(/\r?\n/u).filter((line) => line.startsWith(`| ${id} `));
  const cells =
    rows.length === 1
      ? rows[0]
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim())
      : [];
  if (cells.length !== expectedCells || cells[0] !== id) {
    fail(code, `${label} must contain one exact ${id} row.`);
  }
  return Object.freeze(cells);
}

function normativeCompatibilityTransferInventory(proofText, testText, normativeText) {
  const file = sourceFile(SOURCE_PATHS.compatibilityParityProof, proofText);
  const declarations = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "MONOTONIC_NORMATIVE_STATUS_IDS"
      ) {
        declarations.push(declaration);
      }
    }
  }
  const initializer =
    declarations.length === 1 && declarations[0].initializer !== undefined
      ? unwrapStaticExpression(declarations[0].initializer)
      : undefined;
  const monotonicIds =
    initializer !== undefined &&
    ts.isNewExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === "Set" &&
    initializer.arguments?.length === 1
      ? staticStringArray(file, initializer.arguments[0])
      : undefined;
  const functions = file.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "verifyReferenceCatalogWebParityNormativeCompatibility",
  );
  const compatibilityFunction = functions.length === 1 ? functions[0] : undefined;
  const semanticComparisons = new Set();
  const semanticCalls = new Set();
  if (compatibilityFunction?.body !== undefined) {
    function visit(node) {
      if (ts.isBinaryExpression(node)) {
        semanticComparisons.add(
          `${node.left.getText(file)} ${node.operatorToken.getText(file)} ${node.right.getText(file)}`,
        );
      }
      if (ts.isCallExpression(node)) semanticCalls.add(node.expression.getText(file));
      ts.forEachChild(node, visit);
    }
    visit(compatibilityFunction.body);
  }
  const n034 = markdownRow(
    normativeText,
    "N-034",
    6,
    "RUNTIME_REACT_INTERACTIONS_COMPATIBILITY_DRIFT",
    "Normative coverage",
  );
  if (
    monotonicIds === undefined ||
    !exactArray(monotonicIds, ["N-033", "N-034"]) ||
    !proofText.includes('Object.freeze({ id: "N-034", status: "PLANNED" })') ||
    !semanticComparisons.has("currentRank !== undefined") ||
    !semanticComparisons.has("currentRank >= historicalRank") ||
    !semanticComparisons.has("currentStatus === historicalStatus") ||
    !semanticCalls.has("MONOTONIC_NORMATIVE_STATUS_IDS.has") ||
    !testText.includes('for (const id of ["N-033", "N-034"])') ||
    !testText.includes(
      'compatibility.currentStatuses.find(({ id }) => id === "N-034")?.status, "TESTED"',
    ) ||
    n034[4] !== "TESTED"
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_COMPATIBILITY_DRIFT",
      "The exact N-034 PLANNED-to-TESTED monotonic compatibility transfer changed.",
    );
  }
  return Object.freeze({
    id: "N-034",
    historicalStatus: "PLANNED",
    currentStatus: "TESTED",
    monotonicIds: Object.freeze(monotonicIds),
  });
}

function sc01DtcgCompatibilityInventory(source, rootManifest) {
  const code = "RUNTIME_REACT_INTERACTIONS_DTCG_COMPATIBILITY_DRIFT";
  const libraryFile = sourceFile(SOURCE_PATHS.sc01DtcgAudit, source.sc01DtcgAudit);
  if (libraryFile.parseDiagnostics.length !== 0) {
    fail(code, "The strict SC-01 DTCG compatibility reader no longer parses.");
  }

  function stringConstant(name) {
    const declarations = [];
    for (const statement of libraryFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          declarations.push(declaration);
        }
      }
    }
    const initializer =
      declarations.length === 1 && declarations[0].initializer !== undefined
        ? unwrapStaticExpression(declarations[0].initializer)
        : undefined;
    return initializer !== undefined && ts.isStringLiteralLike(initializer)
      ? initializer.text
      : undefined;
  }

  function exactFunction(name) {
    const declarations = libraryFile.statements.filter(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
    );
    if (declarations.length !== 1 || declarations[0].body === undefined) {
      fail(code, `The strict SC-01 DTCG reader lost its exact ${name} function.`);
    }
    return declarations[0];
  }

  function callInventory(declaration) {
    const calls = [];
    function visit(node) {
      if (ts.isCallExpression(node)) calls.push(node.expression.getText(libraryFile));
      ts.forEachChild(node, visit);
    }
    visit(declaration.body);
    return Object.freeze(calls);
  }

  if (
    stringConstant("ARTIFACT_SHA256") !== EXPECTED_SC01_DTCG_ARTIFACT_SHA256.slice(7) ||
    stringConstant("HISTORICAL_PACKAGE_MANIFEST_SHA256") !== EXPECTED_SC01_DTCG_MANIFEST_SHA256
  ) {
    fail(code, "The immutable SC-01 artifact or task-time package-manifest pin changed.");
  }

  const expectedLibraryImports = [
    "./atomic-proof-artifact.mjs",
    "node:crypto",
    "node:fs/promises",
    "node:path",
    "node:url",
    "node:util",
    "typescript",
  ];
  const libraryImports = importInventory(SOURCE_PATHS.sc01DtcgAudit, source.sc01DtcgAudit);
  if (!exactArray(libraryImports, sorted(expectedLibraryImports))) {
    fail(code, "The immutable SC-01 DTCG reader gained a current-package module edge.", {
      libraryImports,
    });
  }

  const buildFunction = exactFunction("buildSc01DtcgEvidence");
  const buildStatements = buildFunction.body.statements;
  const buildOptionsDeclaration =
    buildStatements.length === 2 &&
    ts.isVariableStatement(buildStatements[0]) &&
    buildStatements[0].declarationList.declarations.length === 1
      ? buildStatements[0].declarationList.declarations[0]
      : undefined;
  const buildOptionsCall =
    buildOptionsDeclaration?.initializer !== undefined &&
    ts.isCallExpression(unwrapStaticExpression(buildOptionsDeclaration.initializer))
      ? unwrapStaticExpression(buildOptionsDeclaration.initializer)
      : undefined;
  const buildReturn =
    buildStatements.length === 2 && ts.isReturnStatement(buildStatements[1])
      ? buildStatements[1]
      : undefined;
  const buildReturnCall =
    buildReturn?.expression !== undefined &&
    ts.isCallExpression(unwrapStaticExpression(buildReturn.expression))
      ? unwrapStaticExpression(buildReturn.expression)
      : undefined;
  if (
    buildFunction.parameters.length !== 1 ||
    !ts.isIdentifier(buildFunction.parameters[0].name) ||
    buildFunction.parameters[0].name.text !== "rawOptions" ||
    buildOptionsDeclaration === undefined ||
    !ts.isIdentifier(buildOptionsDeclaration.name) ||
    buildOptionsDeclaration.name.text !== "options" ||
    buildOptionsCall === undefined ||
    !ts.isIdentifier(buildOptionsCall.expression) ||
    buildOptionsCall.expression.text !== "normalizeOptions" ||
    buildOptionsCall.arguments.length !== 3 ||
    !ts.isIdentifier(buildOptionsCall.arguments[0]) ||
    buildOptionsCall.arguments[0].text !== "rawOptions" ||
    !exactArray(staticStringArray(libraryFile, buildOptionsCall.arguments[1]) ?? [], [
      "artifactPath",
      "artifactBytes",
    ]) ||
    !ts.isStringLiteralLike(buildOptionsCall.arguments[2]) ||
    buildOptionsCall.arguments[2].text !== "Build" ||
    buildReturnCall === undefined ||
    !ts.isIdentifier(buildReturnCall.expression) ||
    buildReturnCall.expression.text !== "readHistoricalArtifact" ||
    buildReturnCall.arguments.length !== 1 ||
    !ts.isIdentifier(buildReturnCall.arguments[0]) ||
    buildReturnCall.arguments[0].text !== "options" ||
    !exactArray(callInventory(buildFunction), ["normalizeOptions", "readHistoricalArtifact"])
  ) {
    fail(
      code,
      "The SC-01 build entry is no longer an exact artifactPath/artifactBytes historical reader.",
    );
  }

  const historicalReader = exactFunction("readHistoricalArtifact");
  if (
    !exactArray(callInventory(historicalReader), [
      "optionalString",
      "optionalBytes",
      "readRegularBytes",
      "path.resolve",
      "parseHistoricalArtifact",
      "Object.freeze",
    ]) ||
    !source.sc01DtcgAudit.includes(
      `compatibilityMode: "${EXPECTED_SC01_DTCG_COMPATIBILITY_MODE}"`,
    ) ||
    !source.sc01DtcgAudit.includes(
      "Reads exact SC-01 task-time evidence without consulting successor package source or build output.",
    )
  ) {
    fail(code, "The default SC-01 reader regained successor-package or rebuild authority.");
  }

  const verifyFunction = exactFunction("verifySc01DtcgEvidence");
  const verifyCalls = callInventory(verifyFunction);
  if (
    verifyCalls.filter((entry) => entry === "readHistoricalArtifact").length !== 1 ||
    verifyCalls.filter((entry) => entry === "verifyProofMatrixPin").length !== 1 ||
    verifyCalls.some((entry) =>
      ["buildCurrentSuccessorEvidence", "import", "require", "writeSc01DtcgEvidence"].includes(
        entry,
      ),
    )
  ) {
    fail(code, "The SC-01 verifier no longer reads immutable bytes and verifies their proof pin.");
  }

  let artifact;
  const artifactBytes = Buffer.from(source.sc01DtcgArtifact, "utf8");
  try {
    artifact = JSON.parse(source.sc01DtcgArtifact);
  } catch {
    fail(code, "The immutable SC-01 DTCG artifact is not valid JSON.");
  }
  const sourceLedger = artifact.evidence?.sourceFiles;
  const packageLedgerEntries = Array.isArray(sourceLedger)
    ? sourceLedger.filter((entry) => entry?.path === "packages/reference-catalog-web/package.json")
    : [];
  if (
    prefixedSha256(artifactBytes) !== EXPECTED_SC01_DTCG_ARTIFACT_SHA256 ||
    artifact.checkpoint !== "SC-01" ||
    artifact.result !== "PASS" ||
    artifact.classification !== "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE" ||
    artifact.auditedReferenceDocument?.leafCount !== 26 ||
    artifact.evidence?.provenance?.mode !== "tracked-defaults" ||
    artifact.evidence?.provenance?.overrides?.length !== 0 ||
    artifact.evidence?.builtTokenBinding?.packageSelfExport?.manifestSha256 !==
      EXPECTED_SC01_DTCG_MANIFEST_SHA256 ||
    packageLedgerEntries.length !== 1 ||
    packageLedgerEntries[0].sha256 !== EXPECTED_SC01_DTCG_MANIFEST_SHA256
  ) {
    fail(code, "The immutable SC-01 DTCG bytes lost their exact task-time semantics.");
  }

  const rootScriptInventory = Object.freeze({
    generate: rootManifest.scripts?.["generate:sc-01-dtcg-compatibility"],
    verify: rootManifest.scripts?.["verify:sc-01-dtcg-compatibility"],
    test: rootManifest.scripts?.["test:sc-01-dtcg-compatibility"],
  });
  if (
    rootScriptInventory.generate !== "node scripts/generate-sc-01-dtcg-proof.mjs" ||
    rootScriptInventory.verify !== "node scripts/verify-sc-01-dtcg.mjs" ||
    rootScriptInventory.test !== "node --test tests/sc-01-dtcg-audit.test.mjs"
  ) {
    fail(
      code,
      "SC-01 DTCG root scripts must remain independent of the current reference-package build.",
      rootScriptInventory,
    );
  }

  if (
    !exactArray(importInventory(SOURCE_PATHS.sc01DtcgGenerate, source.sc01DtcgGenerate), [
      "./lib/sc-01-dtcg-audit.mjs",
    ]) ||
    !exactArray(importInventory(SOURCE_PATHS.sc01DtcgVerify, source.sc01DtcgVerify), [
      "./lib/sc-01-dtcg-audit.mjs",
    ])
  ) {
    fail(code, "SC-01 DTCG command wrappers gained a successor-package dependency.");
  }
  requireFragments(
    source.sc01DtcgGenerate,
    [
      "writeSc01DtcgEvidence()",
      "compatibilityMode: result.compatibilityMode",
      "preserved: result.preserved",
      "Preserved the immutable task-time SC-01 DTCG compatibility proof.",
    ],
    code,
    "SC-01 DTCG generator wrapper",
  );
  requireFragments(
    source.sc01DtcgVerify,
    ["verifySc01DtcgEvidence()", 'status: "PASS"'],
    code,
    "SC-01 DTCG verifier wrapper",
  );

  const dtcgTestTitles = testTitleInventory(SOURCE_PATHS.sc01DtcgTests, source.sc01DtcgTests);
  const dtcgTestIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.sc01DtcgTests,
    source.sc01DtcgTests,
  );
  for (const requiredTitle of [
    "accepts the tracked deterministic SC-01 DTCG compatibility evidence",
    "reads byte-identical immutable task-time evidence twice",
    "rejects every current-successor source build or API injection",
    "rejects stale or one-byte-tampered evidence",
    "rejects moved duplicated or mismatched Proof Matrix pins",
    "preserves the tracked inode through the default and symlink-parent alias no-op",
  ]) {
    if (!dtcgTestTitles.includes(requiredTitle)) {
      fail(code, `The strict SC-01 DTCG test inventory lost: ${requiredTitle}.`);
    }
  }
  if (
    dtcgTestTitles.length !== 20 ||
    dtcgTestIntegrity.directCases !== 20 ||
    dtcgTestIntegrity.executedCases !== 20 ||
    dtcgTestIntegrity.parameterized.length !== 0
  ) {
    fail(code, "The strict SC-01 DTCG migration test inventory changed.", {
      dtcgTestTitles,
      dtcgTestIntegrity,
    });
  }

  requireFragments(
    source.sc01DtcgProfile,
    [
      EXPECTED_SC01_DTCG_ARTIFACT_SHA256,
      "This receipt is not regenerated from the evolving `@desen/reference-catalog-web` package.",
      "The SC-01 verifier reads only",
      "the exact historical artifact",
      "current successor source is deliberately not used",
    ],
    code,
    "DTCG 2025.10 compatibility profile",
  );
  requireFragments(
    source.sc01Comparison,
    [
      EXPECTED_SC01_DTCG_ARTIFACT_SHA256,
      "immutable task-time receipt",
      "Current\n  successor package bytes are owned independently by M05.",
    ],
    code,
    "SC-01 comparison",
  );
  requireFragments(
    source.strategicValidation,
    [
      EXPECTED_SC01_DTCG_ARTIFACT_SHA256,
      "immutable task-time receipt",
      "Successor package bytes are not inputs to this\n  historical checkpoint.",
    ],
    code,
    "strategic validation ledger",
  );
  requireFragments(
    source.matrix,
    [
      "`sc-01-dtcg-compatibility.json`\n" + `\`${EXPECTED_SC01_DTCG_ARTIFACT_SHA256}\`.`,
      "immutable task-time receipt",
      "M05-T04 also migrates the historical SC-01 DTCG receipt to the same immutable\nreader boundary",
      "bytes and task-time manifest ledger remain unchanged while the current successor package is owned\nonly by this task's interaction artifact.",
    ],
    code,
    "Proof Matrix SC-01 migration record",
  );
  requireFragments(
    source.projectStatus,
    [
      EXPECTED_SC01_DTCG_ARTIFACT_SHA256.slice(7),
      "20 focused tests preserve the immutable task-time receipt",
      "proof pins, hostile inputs, symlinks, and atomic-copy safety",
    ],
    code,
    "project status SC-01 migration record",
  );

  return Object.freeze({
    artifactSha256: EXPECTED_SC01_DTCG_ARTIFACT_SHA256,
    taskTimeManifestSha256: EXPECTED_SC01_DTCG_MANIFEST_SHA256,
    compatibilityMode: EXPECTED_SC01_DTCG_COMPATIBILITY_MODE,
    currentSuccessorSourceInputs: false,
    rootScripts: rootScriptInventory,
    focusedTests: dtcgTestIntegrity.executedCases,
  });
}

function localStateIdentityCompatibilityInventory(source, rootManifest) {
  const code = "RUNTIME_REACT_INTERACTIONS_LOCAL_STATE_COMPATIBILITY_DRIFT";
  const libraryFile = sourceFile(
    SOURCE_PATHS.localStateIdentityAudit,
    source.localStateIdentityAudit,
  );
  if (libraryFile.parseDiagnostics.length !== 0) {
    fail(code, "The strict M04-T06 local-state compatibility reader no longer parses.");
  }

  function stringConstant(name) {
    const declarations = [];
    for (const statement of libraryFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          declarations.push(declaration);
        }
      }
    }
    const initializer =
      declarations.length === 1 && declarations[0].initializer !== undefined
        ? unwrapStaticExpression(declarations[0].initializer)
        : undefined;
    return initializer !== undefined && ts.isStringLiteralLike(initializer)
      ? initializer.text
      : undefined;
  }

  function exactFunction(name) {
    const declarations = libraryFile.statements.filter(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
    );
    if (declarations.length !== 1 || declarations[0].body === undefined) {
      fail(code, `The strict M04-T06 reader lost its exact ${name} function.`);
    }
    return declarations[0];
  }

  function callInventory(declaration) {
    const calls = [];
    function visit(node) {
      if (ts.isCallExpression(node)) calls.push(node.expression.getText(libraryFile));
      ts.forEachChild(node, visit);
    }
    visit(declaration.body);
    return Object.freeze(calls);
  }

  if (
    stringConstant("HISTORICAL_ARTIFACT_SHA256") !==
      EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_SHA256.slice(7) ||
    stringConstant("COMPATIBILITY_MODE") !== EXPECTED_LOCAL_STATE_IDENTITY_COMPATIBILITY_MODE
  ) {
    fail(code, "The immutable M04-T06 artifact or compatibility-mode pin changed.");
  }
  const expectedImports = [
    "./atomic-proof-artifact.mjs",
    "node:crypto",
    "node:fs/promises",
    "node:path",
    "node:url",
    "node:util",
  ];
  const libraryImports = importInventory(
    SOURCE_PATHS.localStateIdentityAudit,
    source.localStateIdentityAudit,
  );
  if (!exactArray(libraryImports, sorted(expectedImports))) {
    fail(code, "The immutable M04-T06 reader gained a current-source or build module edge.", {
      libraryImports,
    });
  }
  requireFragments(
    source.localStateIdentityAudit,
    [
      "const HISTORICAL_ARTIFACT_BYTES = 15_575;",
      "const MAX_PROOF_DOCUMENT_BYTES = 500_000;",
      "const MAX_PROOF_MATRIX_BYTES = 2_000_000;",
      "prototype !== Uint8Array.prototype && prototype !== Buffer.prototype",
      "utilTypes.isSharedArrayBuffer(backingBuffer)",
      "if (byteLength !== exactBytes)",
      'handle = await open(filePath, "r");',
      "openedEntry.dev !== currentEntry.dev",
      "openedEntry.ino !== currentEntry.ino",
      "async function readBoundedHandle(handle, maximumBytes)",
      "const captured = Buffer.allocUnsafe(maximumBytes + 1);",
      "const bytes = await readBoundedHandle(handle, maximumBytes);",
      "const authenticatedTracked = await buildRuntimeCoreLocalStateIdentityEvidence({",
      "artifactPath: trackedArtifactPath,",
      "optionalBoundedText(",
    ],
    code,
    "M04-T06 bounded immutable reader",
  );

  const buildCalls = callInventory(exactFunction("buildRuntimeCoreLocalStateIdentityEvidence"));
  const verifyCalls = callInventory(exactFunction("verifyRuntimeCoreLocalStateIdentityEvidence"));
  for (const requiredCall of [
    "captureOptions",
    "optionalString",
    "optionalBytes",
    "readRegularBytes",
    "inspectHistoricalArtifact",
  ]) {
    if (!buildCalls.includes(requiredCall)) {
      fail(code, `The immutable M04-T06 build reader lost ${requiredCall}.`);
    }
  }
  if (
    !verifyCalls.includes("buildRuntimeCoreLocalStateIdentityEvidence") ||
    !verifyCalls.includes("verifyHistoricalProofPins") ||
    [...buildCalls, ...verifyCalls].some((entry) =>
      [
        "import",
        "require",
        "buildCurrentEvidence",
        "probeRuntimeBehavior",
        "verifyPrerequisite",
        "writeRuntimeCoreLocalStateIdentityEvidence",
      ].includes(entry),
    ) ||
    !source.localStateIdentityAudit.includes(
      "Reads exact M04-T06 task-time evidence without consulting current source, documentation,",
    ) ||
    !source.localStateIdentityAudit.includes(
      "generated output, package exports, prerequisites, runtime probes, or successor task state.",
    )
  ) {
    fail(
      code,
      "The M04-T06 reader regained current-source, prerequisite, probe, or rebuild authority.",
    );
  }

  let artifact;
  const artifactBytes = Buffer.from(source.localStateIdentityArtifact, "utf8");
  try {
    artifact = JSON.parse(source.localStateIdentityArtifact);
  } catch {
    fail(code, "The immutable M04-T06 local-state artifact is not valid JSON.");
  }
  if (
    artifactBytes.length !== EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_BYTES ||
    prefixedSha256(artifactBytes) !== EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_SHA256 ||
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M04-T06" ||
    artifact.result !== "PASS" ||
    artifact.claim?.target !== "platform-neutral" ||
    !exactArray(artifact.claim?.normativeStatusChanges?.map(({ id }) => id) ?? [], ["N-024"]) ||
    !exactArray(artifact.publicApi?.runtimeExports ?? [], [
      "createRuntimeNodeIdentity",
      "disposeRuntimeSurfaceState",
      "mountRuntimeSurfaceState",
      "readRuntimeSurfaceState",
      "reconcileRuntimeNodeIdentity",
      "writeRuntimeSurfaceState",
    ]) ||
    !exactArray(artifact.publicApi?.internalExports ?? [], [
      "isRuntimeJsonObject",
      "snapshotRuntimeJsonValue",
    ]) ||
    artifact.publicApi?.typeExports?.length !== 20 ||
    artifact.runtime?.platformEffects !== 0 ||
    artifact.runtime?.sourceWriteBacks !== 0 ||
    artifact.runtime?.partialOutputs !== false ||
    artifact.stateSemantics?.schemaApplication !== "complete resolved-value" ||
    artifact.nodeIdentitySemantics?.repeatKey !== "deferred to M04-T07" ||
    artifact.nodeIdentitySemantics?.adapterRemountPolicy !== "deferred to M05-T05" ||
    artifact.evidence?.packageTests !== 33 ||
    artifact.evidence?.compilerNegativeCases !== 7 ||
    artifact.evidence?.rootMutationTests !== 13 ||
    artifact.evidence?.traceRules?.length !== 4 ||
    artifact.evidence?.trackedFiles?.length !== 23 ||
    artifact.evidence.trackedFiles[19]?.path !==
      "scripts/lib/runtime-core-local-state-identity-proof.mjs" ||
    artifact.evidence.trackedFiles[19]?.sha256 !==
      "25077e553ac1ce15889dc925c81445c4cdea8d5295d0fde917b8e72f5cf87e83"
  ) {
    fail(code, "The immutable M04-T06 bytes lost their exact task-time semantics.");
  }

  const rootScriptInventory = Object.freeze({
    generate: rootManifest.scripts?.["generate:runtime-core-local-state-identity"],
    verify: rootManifest.scripts?.["verify:runtime-core-local-state-identity"],
    test: rootManifest.scripts?.["test:runtime-core-local-state-identity"],
  });
  if (
    rootScriptInventory.generate !==
      "node scripts/generate-runtime-core-local-state-identity-proof.mjs" ||
    rootScriptInventory.verify !== "node scripts/verify-runtime-core-local-state-identity.mjs" ||
    rootScriptInventory.test !== "node --test tests/runtime-core-local-state-identity.test.mjs"
  ) {
    fail(
      code,
      "M04-T06 local-state root scripts must remain independent of current runtime-core builds.",
      rootScriptInventory,
    );
  }
  if (
    !exactArray(
      importInventory(SOURCE_PATHS.localStateIdentityGenerate, source.localStateIdentityGenerate),
      ["./lib/runtime-core-local-state-identity-proof.mjs"],
    ) ||
    !exactArray(
      importInventory(SOURCE_PATHS.localStateIdentityVerify, source.localStateIdentityVerify),
      ["./lib/runtime-core-local-state-identity-proof.mjs"],
    )
  ) {
    fail(code, "M04-T06 local-state wrappers gained a current-source dependency.");
  }
  requireFragments(
    source.localStateIdentityGenerate,
    [
      "writeRuntimeCoreLocalStateIdentityEvidence()",
      "compatibilityMode: result.compatibilityMode",
      "preserved: result.preserved",
      "Preserved immutable task-time M04-T06 local-state and node-identity evidence.",
    ],
    code,
    "M04-T06 generator wrapper",
  );
  requireFragments(
    source.localStateIdentityVerify,
    ["verifyRuntimeCoreLocalStateIdentityEvidence()", 'status: "PASS"'],
    code,
    "M04-T06 verifier wrapper",
  );

  const testTitles = testTitleInventory(
    SOURCE_PATHS.localStateIdentityTests,
    source.localStateIdentityTests,
  );
  const testIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.localStateIdentityTests,
    source.localStateIdentityTests,
  );
  for (const requiredTitle of [
    "accepts immutable task-time M04-T06 local-state and identity evidence",
    "reads exact historical M04-T06 bytes and frozen semantics twice",
    "rejects every current source build prerequisite runtime or probe injection",
    "pins open-handle TOCTOU checks and current-source independence in the reader",
    "default M04-T06 generation preserves exact bytes inode and mtime",
    "keeps root M04-T06 scripts independent of current source and builds",
  ]) {
    if (!testTitles.includes(requiredTitle)) {
      fail(code, `The strict M04-T06 compatibility test inventory lost: ${requiredTitle}.`);
    }
  }
  if (
    testTitles.length !== 20 ||
    testIntegrity.directCases !== 20 ||
    testIntegrity.executedCases !== 20 ||
    testIntegrity.parameterized.length !== 0
  ) {
    fail(code, "The strict M04-T06 compatibility test inventory changed.", {
      testTitles,
      testIntegrity,
    });
  }

  requireFragments(
    source.localStateIdentityProof,
    [
      `docs/proof/artifacts/${path.basename(LOCAL_STATE_IDENTITY_ARTIFACT_PATH)}`,
      "M04-T06 does not prove:",
      "adapter registration, actual component-instance preservation, React reconciliation",
    ],
    code,
    "M04-T06 proof document",
  );
  requireFragments(
    source.matrix,
    [
      `\`${path.basename(LOCAL_STATE_IDENTITY_ARTIFACT_PATH)}\`\n` +
        `\`${EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_SHA256}\`.`,
      "M04-T06 defines and proves a bounded, fail-closed surface-local state lifecycle",
      "Repeat instance identity, actions, reactivity, final materialization, Bundle",
    ],
    code,
    "Proof Matrix M04-T06 task-time receipt",
  );

  return Object.freeze({
    artifactSha256: EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_SHA256,
    artifactBytes: EXPECTED_LOCAL_STATE_IDENTITY_ARTIFACT_BYTES,
    compatibilityMode: EXPECTED_LOCAL_STATE_IDENTITY_COMPATIBILITY_MODE,
    currentRuntimeSourceInputs: false,
    rootScripts: rootScriptInventory,
    focusedTests: testIntegrity.executedCases,
  });
}

function commandEventCompatibilityInventory(source, rootManifest) {
  const code = "RUNTIME_REACT_INTERACTIONS_COMMAND_EVENT_COMPATIBILITY_DRIFT";
  const libraryFile = sourceFile(SOURCE_PATHS.commandEventAudit, source.commandEventAudit);
  if (libraryFile.parseDiagnostics.length !== 0) {
    fail(code, "The strict M04-T12 command/event compatibility reader no longer parses.");
  }

  function stringConstant(name) {
    const declarations = [];
    for (const statement of libraryFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          declarations.push(declaration);
        }
      }
    }
    const initializer =
      declarations.length === 1 && declarations[0].initializer !== undefined
        ? unwrapStaticExpression(declarations[0].initializer)
        : undefined;
    return initializer !== undefined && ts.isStringLiteralLike(initializer)
      ? initializer.text
      : undefined;
  }

  function exactFunction(name) {
    const declarations = libraryFile.statements.filter(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
    );
    if (declarations.length !== 1 || declarations[0].body === undefined) {
      fail(code, `The strict M04-T12 reader lost its exact ${name} function.`);
    }
    return declarations[0];
  }

  function callInventory(declaration) {
    const calls = [];
    function visit(node) {
      if (ts.isCallExpression(node)) calls.push(node.expression.getText(libraryFile));
      ts.forEachChild(node, visit);
    }
    visit(declaration.body);
    return Object.freeze(calls);
  }

  if (
    stringConstant("ARTIFACT_SHA256") !== EXPECTED_COMMAND_EVENT_ARTIFACT_SHA256.slice(7) ||
    stringConstant("COMPATIBILITY_MODE") !== EXPECTED_COMMAND_EVENT_COMPATIBILITY_MODE
  ) {
    fail(code, "The immutable M04-T12 artifact or compatibility-mode pin changed.");
  }
  const expectedImports = [
    "./atomic-proof-artifact.mjs",
    "node:crypto",
    "node:fs/promises",
    "node:path",
    "node:url",
    "node:util",
  ];
  const libraryImports = importInventory(SOURCE_PATHS.commandEventAudit, source.commandEventAudit);
  if (!exactArray(libraryImports, sorted(expectedImports))) {
    fail(code, "The immutable M04-T12 reader gained a current-source or build module edge.", {
      libraryImports,
    });
  }

  const buildFunction = exactFunction("buildRuntimeCoreCommandEventActionsEvidence");
  const buildCalls = callInventory(buildFunction);
  if (
    !exactArray(buildCalls, ["normalizeOptions", "readHistoricalArtifact"]) ||
    !source.commandEventAudit.includes(
      "Reads exact M04-T12 task-time evidence without consulting current source, docs, or build output.",
    )
  ) {
    fail(code, "The M04-T12 build entry regained current-source or rebuild authority.");
  }
  const historicalReaderCalls = callInventory(exactFunction("readHistoricalArtifact"));
  if (
    !exactArray(historicalReaderCalls, [
      "optionalString",
      "optionalBytes",
      "readRegularBytes",
      "path.resolve",
      "parseHistoricalArtifact",
      "Object.freeze",
    ]) ||
    !source.commandEventAudit.includes(`compatibilityMode: ${"COMPATIBILITY_MODE"}`)
  ) {
    fail(code, "The M04-T12 default reader no longer reads only immutable task-time bytes.");
  }
  const verifyCalls = callInventory(exactFunction("verifyRuntimeCoreCommandEventActionsEvidence"));
  if (
    verifyCalls.filter((entry) => entry === "readHistoricalArtifact").length !== 1 ||
    verifyCalls.filter((entry) => entry === "verifyHistoricalProofPins").length !== 1 ||
    verifyCalls.some((entry) =>
      [
        "import",
        "require",
        "buildCurrentEvidence",
        "writeRuntimeCoreCommandEventActionsEvidence",
      ].includes(entry),
    )
  ) {
    fail(code, "The M04-T12 verifier lost immutable-byte or historical-pin isolation.");
  }

  let artifact;
  const artifactBytes = Buffer.from(source.commandEventArtifact, "utf8");
  try {
    artifact = JSON.parse(source.commandEventArtifact);
  } catch {
    fail(code, "The immutable M04-T12 command/event artifact is not valid JSON.");
  }
  if (
    artifactBytes.length !== EXPECTED_COMMAND_EVENT_ARTIFACT_BYTES ||
    prefixedSha256(artifactBytes) !== EXPECTED_COMMAND_EVENT_ARTIFACT_SHA256 ||
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M04-T12" ||
    artifact.result !== "PASS" ||
    !exactArray(artifact.normative?.tested ?? [], ["N-031"]) ||
    !exactArray(artifact.normative?.planned ?? [], ["N-034"]) ||
    artifact.semantics?.productionAdapterCommandParity !== null ||
    artifact.evidence?.focusedTests !== 58 ||
    artifact.evidence?.rootMutationTests !== 21 ||
    artifact.evidence?.trackedFiles?.length !== 16 ||
    artifact.evidence.trackedFiles[12]?.path !==
      "scripts/lib/runtime-core-command-event-actions-proof.mjs" ||
    artifact.evidence.trackedFiles[12]?.sha256 !==
      "bd86f68715eb1eb61372179ffda4a12ce51c69c981ffce44b4fb8d4fd4286ae1"
  ) {
    fail(code, "The immutable M04-T12 bytes lost their exact task-time semantics.");
  }

  const rootScriptInventory = Object.freeze({
    generate: rootManifest.scripts?.["generate:runtime-core-command-event-actions"],
    verify: rootManifest.scripts?.["verify:runtime-core-command-event-actions"],
    test: rootManifest.scripts?.["test:runtime-core-command-event-actions"],
  });
  if (
    rootScriptInventory.generate !==
      "node scripts/generate-runtime-core-command-event-actions-proof.mjs" ||
    rootScriptInventory.verify !== "node scripts/verify-runtime-core-command-event-actions.mjs" ||
    rootScriptInventory.test !== "node --test tests/runtime-core-command-event-actions.test.mjs"
  ) {
    fail(
      code,
      "M04-T12 command/event root scripts must remain independent of current runtime-core builds.",
      rootScriptInventory,
    );
  }
  if (
    !exactArray(importInventory(SOURCE_PATHS.commandEventGenerate, source.commandEventGenerate), [
      "./lib/runtime-core-command-event-actions-proof.mjs",
    ]) ||
    !exactArray(importInventory(SOURCE_PATHS.commandEventVerify, source.commandEventVerify), [
      "./lib/runtime-core-command-event-actions-proof.mjs",
    ])
  ) {
    fail(code, "M04-T12 command/event wrappers gained a current-source dependency.");
  }
  requireFragments(
    source.commandEventGenerate,
    [
      "writeRuntimeCoreCommandEventActionsEvidence()",
      "compatibilityMode: result.compatibilityMode",
      "preserved: result.preserved",
      "Preserved the immutable task-time M04-T12 command/event action proof.",
    ],
    code,
    "M04-T12 command/event generator wrapper",
  );
  requireFragments(
    source.commandEventVerify,
    ["verifyRuntimeCoreCommandEventActionsEvidence()", 'status: "PASS"'],
    code,
    "M04-T12 command/event verifier wrapper",
  );

  const testTitles = testTitleInventory(SOURCE_PATHS.commandEventTests, source.commandEventTests);
  const testIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.commandEventTests,
    source.commandEventTests,
  );
  for (const requiredTitle of [
    "accepts the tracked immutable M04-T12 command/event evidence",
    "reads byte-identical immutable task-time evidence twice",
    "preserves historical N-034 semantics without consulting current coverage",
    "rejects every current source build prerequisite or runtime injection",
    "rejects moved duplicated mismatched or over-budget historical proof pins",
    "preserves the tracked inode and mtime through default generation",
    "keeps root command/event scripts independent of current source and builds",
  ]) {
    if (!testTitles.includes(requiredTitle)) {
      fail(code, `The strict M04-T12 compatibility test inventory lost: ${requiredTitle}.`);
    }
  }
  if (
    testTitles.length !== 16 ||
    testIntegrity.directCases !== 16 ||
    testIntegrity.executedCases !== 16 ||
    testIntegrity.parameterized.length !== 0
  ) {
    fail(code, "The strict M04-T12 compatibility test inventory changed.", {
      testTitles,
      testIntegrity,
    });
  }

  requireFragments(
    source.commandEventProof,
    [
      EXPECTED_COMMAND_EVENT_ARTIFACT_SHA256,
      "This is an immutable task-time receipt.",
      "historical `N-034: PLANNED` status",
      "selected Web–React `N-034: TESTED` evidence without rewriting this artifact",
      "M05-T04 later advances `N-034` to **TESTED** for the\nselected Web–React profile through a separate current proof receipt",
    ],
    code,
    "M04-T12 proof document",
  );
  requireFragments(
    source.matrix,
    [
      `\`${path.basename(COMMAND_EVENT_ARTIFACT_PATH)}\`\n` +
        `\`${EXPECTED_COMMAND_EVENT_ARTIFACT_SHA256}\`.`,
      "N-034 remains `PLANNED` until concrete\nproduction adapters prove complete declared-command implementation parity.",
      "N-034 becomes `TESTED` for the selected Web–React production profile",
    ],
    code,
    "Proof Matrix M04-T12 historical/current distinction",
  );

  return Object.freeze({
    artifactSha256: EXPECTED_COMMAND_EVENT_ARTIFACT_SHA256,
    artifactBytes: EXPECTED_COMMAND_EVENT_ARTIFACT_BYTES,
    compatibilityMode: EXPECTED_COMMAND_EVENT_COMPATIBILITY_MODE,
    currentRuntimeSourceInputs: false,
    historicalN034Status: "PLANNED",
    currentSelectedWebReactN034Status: "TESTED",
    rootScripts: rootScriptInventory,
    focusedTests: testIntegrity.executedCases,
  });
}

function reactiveReevaluationCompatibilityInventory(source, rootManifest) {
  const code = "RUNTIME_REACT_INTERACTIONS_REACTIVE_COMPATIBILITY_DRIFT";
  const libraryFile = sourceFile(
    SOURCE_PATHS.reactiveReevaluationAudit,
    source.reactiveReevaluationAudit,
  );
  if (libraryFile.parseDiagnostics.length !== 0) {
    fail(code, "The strict M04-T15 reactive compatibility reader no longer parses.");
  }

  function stringConstant(name) {
    const declarations = [];
    for (const statement of libraryFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          declarations.push(declaration);
        }
      }
    }
    const initializer =
      declarations.length === 1 && declarations[0].initializer !== undefined
        ? unwrapStaticExpression(declarations[0].initializer)
        : undefined;
    return initializer !== undefined && ts.isStringLiteralLike(initializer)
      ? initializer.text
      : undefined;
  }

  function exactFunction(name) {
    const declarations = libraryFile.statements.filter(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
    );
    if (declarations.length !== 1 || declarations[0].body === undefined) {
      fail(code, `The strict M04-T15 reader lost its exact ${name} function.`);
    }
    return declarations[0];
  }

  function callInventory(declaration) {
    const calls = [];
    function visit(node) {
      if (ts.isCallExpression(node)) calls.push(node.expression.getText(libraryFile));
      ts.forEachChild(node, visit);
    }
    visit(declaration.body);
    return Object.freeze(calls);
  }

  if (
    stringConstant("HISTORICAL_ARTIFACT_SHA256") !==
      EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_SHA256.slice(7) ||
    stringConstant("COMPATIBILITY_MODE") !== EXPECTED_REACTIVE_REEVALUATION_COMPATIBILITY_MODE
  ) {
    fail(code, "The immutable M04-T15 artifact or compatibility-mode pin changed.");
  }
  const expectedImports = [
    "./atomic-proof-artifact.mjs",
    "node:crypto",
    "node:fs/promises",
    "node:path",
    "node:url",
    "node:util",
  ];
  const libraryImports = importInventory(
    SOURCE_PATHS.reactiveReevaluationAudit,
    source.reactiveReevaluationAudit,
  );
  if (!exactArray(libraryImports, sorted(expectedImports))) {
    fail(code, "The immutable M04-T15 reader gained a current-source or build module edge.", {
      libraryImports,
    });
  }
  requireFragments(
    source.reactiveReevaluationAudit,
    [
      "const HISTORICAL_ARTIFACT_BYTES = 11_212;",
      "const MAX_PROOF_DOCUMENT_BYTES = 500_000;",
      "const MAX_PROOF_MATRIX_BYTES = 2_000_000;",
      "prototype !== Uint8Array.prototype && prototype !== Buffer.prototype",
      "utilTypes.isSharedArrayBuffer(backingBuffer)",
      'handle = await open(filePath, "r");',
      "openedEntry.dev !== currentEntry.dev",
      "openedEntry.ino !== currentEntry.ino",
      "optionalBoundedText(",
    ],
    code,
    "M04-T15 bounded immutable reader",
  );

  const buildCalls = callInventory(exactFunction("buildRuntimeCoreReactiveReevaluationEvidence"));
  const verifyCalls = callInventory(exactFunction("verifyRuntimeCoreReactiveReevaluationEvidence"));
  for (const requiredCall of [
    "captureOptions",
    "optionalString",
    "optionalBuffer",
    "readRegularFile",
    "inspectHistoricalArtifact",
  ]) {
    if (!buildCalls.includes(requiredCall)) {
      fail(code, `The immutable M04-T15 build reader lost ${requiredCall}.`);
    }
  }
  if (
    !verifyCalls.includes("buildRuntimeCoreReactiveReevaluationEvidence") ||
    !verifyCalls.includes("verifyProofDocument") ||
    !verifyCalls.includes("verifyProofMatrix") ||
    [...buildCalls, ...verifyCalls].some((entry) =>
      [
        "import",
        "require",
        "buildCurrentEvidence",
        "probeRuntimeBehavior",
        "verifyPrerequisite",
        "writeRuntimeCoreReactiveReevaluationEvidence",
      ].includes(entry),
    ) ||
    !source.reactiveReevaluationAudit.includes(
      "Current runtime source, generated output, package exports, prerequisites, probes, and\n * documentation state can never be rebuilt into historical M04-T15 evidence through this reader.",
    )
  ) {
    fail(
      code,
      "The M04-T15 reader regained current-source, prerequisite, probe, or rebuild authority.",
    );
  }

  let artifact;
  const artifactBytes = Buffer.from(source.reactiveReevaluationArtifact, "utf8");
  try {
    artifact = JSON.parse(source.reactiveReevaluationArtifact);
  } catch {
    fail(code, "The immutable M04-T15 reactive artifact is not valid JSON.");
  }
  if (
    artifactBytes.length !== EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_BYTES ||
    prefixedSha256(artifactBytes) !== EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_SHA256 ||
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M04-T15" ||
    artifact.result !== "PASS" ||
    artifact.claim?.target !== "platform-neutral" ||
    !exactArray(artifact.claim?.normativeStatusChanges ?? [], []) ||
    artifact.publicApi?.runtimeExports !== 6 ||
    artifact.publicApi?.typeExports !== 17 ||
    artifact.runtime?.evaluatorAuthorityLeaks !== 0 ||
    artifact.runtime?.requestLeaks !== 0 ||
    artifact.runtime?.platformEffects !== 0 ||
    artifact.evidence?.focusedTests !== 54 ||
    artifact.evidence?.rootMutationTests !== 30 ||
    artifact.evidence?.traceRules !== 6 ||
    artifact.evidence?.trackedFiles?.length !== 17 ||
    artifact.evidence.trackedFiles[13]?.path !==
      "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs" ||
    artifact.evidence.trackedFiles[13]?.sha256 !==
      "d30bc915dfc90435951a9ffdd277c2c63be9c9e42b98a82f77d25d3d412a254c"
  ) {
    fail(code, "The immutable M04-T15 bytes lost their exact task-time semantics.");
  }

  const rootScriptInventory = Object.freeze({
    generate: rootManifest.scripts?.["generate:runtime-core-reactive-reevaluation"],
    verify: rootManifest.scripts?.["verify:runtime-core-reactive-reevaluation"],
    test: rootManifest.scripts?.["test:runtime-core-reactive-reevaluation"],
  });
  if (
    rootScriptInventory.generate !==
      "node scripts/generate-runtime-core-reactive-reevaluation-proof.mjs" ||
    rootScriptInventory.verify !== "node scripts/verify-runtime-core-reactive-reevaluation.mjs" ||
    rootScriptInventory.test !== "node --test tests/runtime-core-reactive-reevaluation.test.mjs"
  ) {
    fail(
      code,
      "M04-T15 reactive root scripts must remain independent of current runtime-core builds.",
      rootScriptInventory,
    );
  }
  if (
    !exactArray(
      importInventory(
        SOURCE_PATHS.reactiveReevaluationGenerate,
        source.reactiveReevaluationGenerate,
      ),
      ["./lib/runtime-core-reactive-reevaluation-proof.mjs"],
    ) ||
    !exactArray(
      importInventory(SOURCE_PATHS.reactiveReevaluationVerify, source.reactiveReevaluationVerify),
      ["./lib/runtime-core-reactive-reevaluation-proof.mjs"],
    )
  ) {
    fail(code, "M04-T15 reactive wrappers gained a current-source dependency.");
  }
  requireFragments(
    source.reactiveReevaluationGenerate,
    ["writeRuntimeCoreReactiveReevaluationEvidence()", 'status: "PASS"', "...result"],
    code,
    "M04-T15 reactive generator wrapper",
  );
  requireFragments(
    source.reactiveReevaluationVerify,
    ["verifyRuntimeCoreReactiveReevaluationEvidence()", 'status: "PASS"', "...result"],
    code,
    "M04-T15 reactive verifier wrapper",
  );

  const testTitles = testTitleInventory(
    SOURCE_PATHS.reactiveReevaluationTests,
    source.reactiveReevaluationTests,
  );
  const testIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.reactiveReevaluationTests,
    source.reactiveReevaluationTests,
  );
  for (const requiredTitle of [
    "accepts immutable task-time M04-T15 reactive reevaluation evidence",
    "two independent historical reactive builds preserve exact bytes and semantics",
    "rejects successor source, runtime, prerequisite, probe, or build injection",
    "rejects moved, duplicated, pending, or mismatched reactive proof pins",
    "rejects moved, duplicated, pending, or mismatched reactive Proof Matrix pins",
    "default reactive compatibility write is a byte and inode preserving no-op",
    "symlink-parent alias to the tracked reactive artifact remains a no-op",
    "writer rejects a tampered reactive source before creating a destination",
  ]) {
    if (!testTitles.includes(requiredTitle)) {
      fail(code, `The strict M04-T15 compatibility test inventory lost: ${requiredTitle}.`);
    }
  }
  if (
    testTitles.length !== 20 ||
    testIntegrity.directCases !== 20 ||
    testIntegrity.executedCases !== 20 ||
    testIntegrity.parameterized.length !== 0
  ) {
    fail(code, "The strict M04-T15 compatibility test inventory changed.", {
      testTitles,
      testIntegrity,
    });
  }

  requireFragments(
    source.reactiveReevaluationProof,
    [
      EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_SHA256.slice(7),
      "At its\ntask-time boundary, `N-003`, `N-034`, and `N-041` were `PLANNED`",
      "M05 owns React reconciliation",
      "production-adapter parity for N-034",
    ],
    code,
    "M04-T15 proof document",
  );
  requireFragments(
    source.matrix,
    [
      `\`${path.basename(REACTIVE_REEVALUATION_ARTIFACT_PATH)}\`\n` +
        `\`${EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_SHA256}\`.`,
      "At the T15 boundary, P-17 and P-18 remained `PARTIAL`, while N-003, N-034, and N-041 remained\n`PLANNED`",
      "N-034 becomes `TESTED` for the selected Web–React production profile",
    ],
    code,
    "Proof Matrix M04-T15 historical/current distinction",
  );

  return Object.freeze({
    artifactSha256: EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_SHA256,
    artifactBytes: EXPECTED_REACTIVE_REEVALUATION_ARTIFACT_BYTES,
    compatibilityMode: EXPECTED_REACTIVE_REEVALUATION_COMPATIBILITY_MODE,
    currentRuntimeSourceInputs: false,
    historicalN034Status: "PLANNED",
    currentSelectedWebReactN034Status: "TESTED",
    rootScripts: rootScriptInventory,
    focusedTests: testIntegrity.executedCases,
  });
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function artifactPinInventory(markdown, allowPending) {
  const artifactName = path.basename(ARTIFACT_RELATIVE_PATH);
  const escapedArtifactName = artifactName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pinValue = `([0-9a-f]{64}|${PENDING_ARTIFACT_SHA256.replace(
    /[.*+?^${}()|[\]\\]/gu,
    "\\$&",
  )})`;
  const inlinePattern = new RegExp(
    "`[^`\\r\\n]*" + escapedArtifactName + "`[ \\t]+`sha256:" + pinValue + "`",
    "gu",
  );
  const lines = markdown.split(/\r?\n/u);
  const references = [];
  const coveredLines = new Set();
  for (const match of markdown.matchAll(inlinePattern)) {
    const prefix = markdown.slice(0, match.index);
    const line = countMatches(prefix, /\n/gu);
    references.push(Object.freeze({ line, value: match[1], kind: "inline" }));
    coveredLines.add(line);
  }
  const adjacentPinPattern = new RegExp("^`sha256:" + pinValue + "`\\.$", "u");
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes(artifactName) || coveredLines.has(index)) continue;
    const pathOccurrences = countMatches(lines[index], new RegExp(escapedArtifactName, "gu"));
    const adjacent = lines[index + 1]?.match(adjacentPinPattern);
    if (
      pathOccurrences !== 1 ||
      !/^`[^`\r\n]+`$/u.test(lines[index]) ||
      adjacent === null ||
      adjacent === undefined
    ) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
        `Every ${artifactName} reference must carry one exact inline or adjacent SHA-256 pin.`,
      );
    }
    references.push(Object.freeze({ line: index + 1, value: adjacent[1], kind: "adjacent" }));
    coveredLines.add(index);
  }
  const artifactOccurrences = lines.reduce(
    (total, line) => total + countMatches(line, new RegExp(escapedArtifactName, "gu")),
    0,
  );
  if (references.length === 0 || references.length !== artifactOccurrences) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
      `Every ${artifactName} occurrence must have one unambiguous SHA-256 pin.`,
    );
  }
  if (!allowPending && references.some(({ value }) => value === PENDING_ARTIFACT_SHA256)) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
      "Production verification rejects pending artifact pins.",
    );
  }
  return Object.freeze(references);
}

function exactInlineArtifactPin(fragment, exactPath, allowPending) {
  const escapedPath = exactPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedPending = PENDING_ARTIFACT_SHA256.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(
    "`" + escapedPath + "`[ \\t]+`sha256:([0-9a-f]{64}|" + escapedPending + ")`",
    "gu",
  );
  const matches = [...fragment.matchAll(pattern)];
  if (
    matches.length !== 1 ||
    countMatches(
      fragment,
      new RegExp(
        path.basename(ARTIFACT_RELATIVE_PATH).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
        "gu",
      ),
    ) !== 1 ||
    (!allowPending && matches[0][1] === PENDING_ARTIFACT_SHA256)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
      `Expected one exact inline ${exactPath} artifact pin.`,
    );
  }
  return Object.freeze({ value: matches[0][1] });
}

function normalizeArtifactPins(markdown) {
  const references = artifactPinInventory(markdown, true);
  const lines = markdown.split(/\r?\n/u);
  for (const reference of references) {
    lines[reference.line] = lines[reference.line].replace(
      `sha256:${reference.value}`,
      `sha256:${PENDING_ARTIFACT_SHA256}`,
    );
  }
  return lines.join("\n");
}

function parseArtifactReference(markdown, heading, artifactPath, allowPending, placement) {
  const lines = markdown.split(/\r?\n/u);
  const headings = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headings.length !== 1) {
    fail("RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT", `Expected one exact ${heading} section.`);
  }
  const start = headings[0];
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = next === -1 ? lines.length : next;
  const section = lines.slice(start, end);
  const pathLine = `\`${artifactPath}\``;
  const pathIndexes = section.flatMap((line, index) => (line === pathLine ? [index] : []));
  const shaPattern = /^`sha256:([0-9a-f]{64}|\[PENDING_FINAL_ARTIFACT_SHA256\])`\.$/u;
  const shas = section.flatMap((line, index) => {
    const match = line.match(shaPattern);
    return match === null ? [] : [{ index, value: match[1] }];
  });
  const pathIndex = pathIndexes[0];
  const shaIndex = shas[0]?.index;
  const canonicalOpening =
    placement === "opening" &&
    pathIndex === 2 &&
    shaIndex === 3 &&
    section[1] === "" &&
    section[4] === "";
  const canonicalTerminal =
    placement === "terminal" &&
    pathIndex === section.length - 3 &&
    shaIndex === section.length - 2 &&
    section.at(-1) === "" &&
    section[pathIndex - 1] === "" &&
    section[pathIndex - 2] === MATRIX_M05_TERMINAL_ANCHOR;
  if (
    pathIndexes.length !== 1 ||
    shas.length !== 1 ||
    shaIndex !== pathIndex + 1 ||
    (!canonicalOpening && !canonicalTerminal)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
      `${heading} must contain one unique adjacent path/SHA pair in its exact canonical ${placement} position.`,
    );
  }
  if (!allowPending && shas[0].value === PENDING_ARTIFACT_SHA256) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
      "Production verification rejects pending artifact pins.",
    );
  }
  return Object.freeze({
    value: shas[0].value,
    absoluteLine: start + shas[0].index,
  });
}

function normalizeSelfPinnedDocument(relativePath, text) {
  const specification =
    relativePath === PROOF_DOCUMENT_PATH
      ? { heading: "## Evidence artifact", artifactPath: ARTIFACT_RELATIVE_PATH }
      : relativePath === PROOF_MATRIX_PATH
        ? {
            heading: "## M05-T04",
            artifactPath: path.basename(ARTIFACT_RELATIVE_PATH),
            placement: "terminal",
          }
        : undefined;
  if (specification === undefined && relativePath !== NORMATIVE_COVERAGE_PATH) {
    return text;
  }
  const normalized = normalizeArtifactPins(text);
  if (specification === undefined) return normalized;
  const parsed = parseArtifactReference(
    normalized,
    specification.heading,
    specification.artifactPath,
    true,
    specification.placement ?? "opening",
  );
  const lines = normalized.split(/\r?\n/u);
  lines[parsed.absoluteLine] = `\`sha256:${PENDING_ARTIFACT_SHA256}\`.`;
  return lines.join("\n");
}

async function inspectPrerequisites(prerequisiteOverrides, fileOverrides) {
  const records = [];
  for (const prerequisite of PREREQUISITES) {
    const bytes =
      prerequisiteOverrides?.[prerequisite.key] ??
      (await workspaceBytes(prerequisite.path, fileOverrides));
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== prerequisite.sha256) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite bytes changed.`,
        { expected: prerequisite.sha256, actual: actualSha256 },
      );
    }
    let artifact;
    try {
      artifact = JSON.parse(bytes.toString("utf8"));
    } catch {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite is not valid JSON.`,
      );
    }
    if (
      artifact.schemaVersion !== 1 ||
      artifact.task !== prerequisite.task ||
      artifact.result !== "PASS" ||
      (prerequisite.profile !== undefined && artifact.profile !== prerequisite.profile)
    ) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite semantics changed.`,
      );
    }
    records.push(
      Object.freeze({
        task: prerequisite.task,
        ...(prerequisite.gate === undefined ? {} : { gate: prerequisite.gate }),
        path: prerequisite.path,
        sha256: `sha256:${prerequisite.sha256}`,
        ...(prerequisite.profile === undefined ? {} : { profile: prerequisite.profile }),
        result: "PASS",
      }),
    );
  }
  return Object.freeze(records);
}

async function recursiveRegularInventory(absoluteRoot, relativeRoot = "") {
  let entries;
  try {
    entries = await readdir(path.join(absoluteRoot, relativeRoot), { withFileTypes: true });
  } catch (error) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_INVENTORY_DRIFT",
      "Reference distribution inventory could not be read.",
      { cause: String(error) },
    );
  }
  const paths = [];
  for (const directoryEntry of entries) {
    const relativePath = relativeRoot
      ? `${relativeRoot}/${directoryEntry.name}`
      : directoryEntry.name;
    const absolutePath = path.join(absoluteRoot, relativePath);
    let entry;
    try {
      entry = await lstat(absolutePath);
    } catch (error) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PACKAGE_INVENTORY_DRIFT",
        `Reference distribution entry disappeared: ${relativePath}.`,
        { cause: String(error) },
      );
    }
    if (entry.isSymbolicLink()) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PACKAGE_INVENTORY_UNSAFE",
        `Reference distribution contains a symlink: ${relativePath}.`,
      );
    }
    if (entry.isDirectory()) {
      paths.push(...(await recursiveRegularInventory(absoluteRoot, relativePath)));
    } else if (entry.isFile()) {
      paths.push(relativePath);
    } else {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PACKAGE_INVENTORY_UNSAFE",
        `Reference distribution contains a special file: ${relativePath}.`,
      );
    }
  }
  return sorted(paths);
}

async function readDistributionArtifacts(fileOverrides) {
  const absoluteRoot = path.join(WORKSPACE_ROOT, REFERENCE_DIST_ROOT);
  let rootEntry;
  try {
    rootEntry = await lstat(absoluteRoot);
  } catch (error) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_INVENTORY_DRIFT",
      "Reference distribution directory is missing.",
      { cause: String(error) },
    );
  }
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_INVENTORY_UNSAFE",
      "Reference distribution root must be a regular directory.",
    );
  }
  const diskPaths = await recursiveRegularInventory(absoluteRoot);
  const allPaths = new Set(
    diskPaths.map((relativePath) => `${REFERENCE_DIST_ROOT}/${relativePath}`),
  );
  if (fileOverrides !== undefined) {
    for (const [relativePath, value] of Object.entries(fileOverrides)) {
      if (!isPortableDistOverride(relativePath)) continue;
      if (value === null) allPaths.delete(relativePath);
      else allPaths.add(relativePath);
    }
  }
  const artifacts = [];
  for (const workspaceRelativePath of sorted(allPaths)) {
    const packageRelativePath = workspaceRelativePath.slice(REFERENCE_PACKAGE_ROOT.length + 1);
    const bytes = await workspaceBytes(workspaceRelativePath, fileOverrides);
    artifacts.push(
      Object.freeze({
        path: packageRelativePath,
        bytes,
      }),
    );
  }
  return Object.freeze(artifacts);
}

function canonicalizeIndependent(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT",
        "Reference Catalog contains a non-finite number.",
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeIndependent(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalizeIndependent(value[key])}`)
      .join(",")}}`;
  }
  fail(
    "RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT",
    "Reference Catalog left the JSON data model.",
  );
}

function requireExactReviewedManifest(actual, expected, label) {
  if (canonicalizeIndependent(actual) !== canonicalizeIndependent(expected)) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_WIRING_DRIFT",
      `${label} differs from its complete reviewed identity, shipping, script, or dependency policy.`,
    );
  }
  return actual;
}

function frameIndependentPackage(catalog, artifacts) {
  const projectedCatalog = structuredClone(catalog);
  projectedCatalog.packageDigest = PACKAGE_DIGEST_PLACEHOLDER;
  const entries = [
    Object.freeze({
      path: "catalog.json",
      bytes: Buffer.from(canonicalizeIndependent(projectedCatalog), "utf8"),
    }),
    ...artifacts,
  ].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const magic = Buffer.from("DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n", "ascii");
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(entries.length);
  const chunks = [magic, header];
  for (const entry of entries) {
    const pathBytes = Buffer.from(entry.path, "ascii");
    const pathLength = Buffer.allocUnsafe(2);
    pathLength.writeUInt16BE(pathBytes.length);
    const contentLength = Buffer.allocUnsafe(4);
    contentLength.writeUInt32BE(entry.bytes.length);
    chunks.push(pathLength, pathBytes, contentLength, entry.bytes);
  }
  const bytes = Buffer.concat(chunks);
  return Object.freeze({
    bytes,
    entries: Object.freeze(
      entries.map((entry) =>
        Object.freeze({
          path: entry.path,
          byteLength: entry.bytes.length,
          contentDigest: prefixedSha256(entry.bytes),
        }),
      ),
    ),
    packageDigest: prefixedSha256(bytes),
  });
}

async function inspectSuccessorPackage(fileOverrides) {
  const catalogBytes = await workspaceBytes(REFERENCE_CATALOG_PATH, fileOverrides);
  let catalog;
  try {
    catalog = JSON.parse(catalogBytes.toString("utf8"));
  } catch {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT",
      "Current reference Catalog is not valid JSON.",
    );
  }
  const catalogRoot = captureExactRecord(
    catalog,
    [
      "behaviors",
      "components",
      "desen",
      "id",
      "kind",
      "operations",
      "packageDigest",
      "resources",
      "target",
      "version",
    ],
    "RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT",
    "Current reference Catalog",
  );
  const componentRecord = captureExactRecord(
    catalogRoot.components,
    EXPECTED_REFERENCE_COMPONENT_IDS,
    "RUNTIME_REACT_INTERACTIONS_REFERENCE_PARITY_DRIFT",
    "Current reference Catalog components",
  );
  captureExactRecord(
    catalogRoot.behaviors,
    [],
    "RUNTIME_REACT_INTERACTIONS_REFERENCE_PARITY_DRIFT",
    "Current reference Catalog behaviors",
  );
  const interactionParity = [];
  for (const capabilityId of EXPECTED_REFERENCE_COMPONENT_IDS) {
    const component = componentRecord[capabilityId];
    if (component === null || typeof component !== "object" || Array.isArray(component)) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_REFERENCE_PARITY_DRIFT",
        `Catalog component ${capabilityId} is not an own-data contract.`,
      );
    }
    const componentKeys = Reflect.ownKeys(component);
    if (componentKeys.some((key) => typeof key !== "string")) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_REFERENCE_PARITY_DRIFT",
        `Catalog component ${capabilityId} contains a symbol key.`,
      );
    }
    const commandsDescriptor = Object.getOwnPropertyDescriptor(component, "commands");
    const eventsDescriptor = Object.getOwnPropertyDescriptor(component, "events");
    const expectedCommands =
      capabilityId === "com.example.ui/TextField" ? Object.freeze(["focus"]) : Object.freeze([]);
    const expectedEvents =
      capabilityId === "com.example.ui/TextField"
        ? Object.freeze(["change"])
        : capabilityId === "com.example.ui/Button"
          ? Object.freeze(["press"])
          : Object.freeze([]);
    if (
      (commandsDescriptor === undefined && expectedCommands.length !== 0) ||
      (commandsDescriptor !== undefined &&
        (!commandsDescriptor.enumerable || !("value" in commandsDescriptor))) ||
      (eventsDescriptor === undefined && expectedEvents.length !== 0) ||
      (eventsDescriptor !== undefined &&
        (!eventsDescriptor.enumerable || !("value" in eventsDescriptor)))
    ) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_REFERENCE_PARITY_DRIFT",
        `Catalog component ${capabilityId} commands/events are not exact enumerable own data.`,
      );
    }
    const commands = captureExactRecord(
      commandsDescriptor?.value ?? {},
      expectedCommands,
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_PARITY_DRIFT",
      `${capabilityId} commands`,
    );
    const events = captureExactRecord(
      eventsDescriptor?.value ?? {},
      expectedEvents,
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_PARITY_DRIFT",
      `${capabilityId} events`,
    );
    interactionParity.push(
      Object.freeze({
        capabilityId,
        commands: Object.freeze(sorted(Object.keys(commands))),
        events: Object.freeze(sorted(Object.keys(events))),
      }),
    );
  }
  const artifacts = await readDistributionArtifacts(fileOverrides);
  const independent = frameIndependentPackage(catalog, artifacts);

  let api;
  try {
    api = await import(
      `${
        pathToFileURL(path.join(WORKSPACE_ROOT, REFERENCE_DIST_ROOT, "index.js")).href
      }?m05-t04=${encodeURIComponent(sha256(artifacts.find(({ path: entryPath }) => entryPath === "dist/index.js")?.bytes ?? Buffer.alloc(0)))}`
    );
  } catch (error) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_API_DRIFT",
      "Built reference package digest API could not be loaded.",
      { cause: String(error) },
    );
  }
  if (
    typeof api.createWebReactPackageDigest !== "function" ||
    typeof api.verifyWebReactPackageDigest !== "function"
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_API_DRIFT",
      "Built reference package lost its public digest calculation or verification API.",
    );
  }

  const publicArtifacts = artifacts.map(({ path: entryPath, bytes }) => ({
    path: entryPath,
    bytes: Uint8Array.from(bytes),
  }));
  const projectedCatalog = structuredClone(catalog);
  projectedCatalog.packageDigest = PACKAGE_DIGEST_PLACEHOLDER;
  let calculated;
  let verified;
  try {
    calculated = api.createWebReactPackageDigest({
      catalog: projectedCatalog,
      artifacts: publicArtifacts,
    });
    verified = api.verifyWebReactPackageDigest({
      catalog,
      artifacts: publicArtifacts,
    });
  } catch (error) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT",
      "Current reference package tuple failed its public digest profile.",
      { cause: String(error) },
    );
  }

  const expectedEntryProjection = independent.entries.map(
    ({ path: entryPath, byteLength, contentDigest }) => ({
      path: entryPath,
      byteLength,
      contentDigest,
    }),
  );
  if (
    catalog.kind !== "desen.catalog" ||
    catalog.id !== "run.desen.reference.sign-in" ||
    catalog.version !== "0.1.0" ||
    catalog.target !== "web-react" ||
    catalog.packageDigest !== EXPECTED_SUCCESSOR_PACKAGE_DIGEST ||
    artifacts.length !== EXPECTED_SUCCESSOR_DIST_FILES ||
    independent.entries.length !== EXPECTED_SUCCESSOR_FRAMED_ENTRIES ||
    independent.bytes.length !== EXPECTED_SUCCESSOR_FRAMED_BYTES ||
    independent.packageDigest !== EXPECTED_SUCCESSOR_PACKAGE_DIGEST ||
    calculated.packageDigest !== EXPECTED_SUCCESSOR_PACKAGE_DIGEST ||
    verified.packageDigest !== EXPECTED_SUCCESSOR_PACKAGE_DIGEST ||
    calculated.byteLength !== EXPECTED_SUCCESSOR_FRAMED_BYTES ||
    verified.byteLength !== EXPECTED_SUCCESSOR_FRAMED_BYTES ||
    JSON.stringify(calculated.entries) !== JSON.stringify(expectedEntryProjection) ||
    JSON.stringify(verified.entries) !== JSON.stringify(expectedEntryProjection)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_TUPLE_DRIFT",
      "Current reference package no longer matches the reviewed successor tuple.",
      {
        expectedDigest: EXPECTED_SUCCESSOR_PACKAGE_DIGEST,
        independentDigest: independent.packageDigest,
        calculatedDigest: calculated?.packageDigest,
        verifiedDigest: verified?.packageDigest,
        distFiles: artifacts.length,
        framedEntries: independent.entries.length,
        framedBytes: independent.bytes.length,
      },
    );
  }

  const reread = await readDistributionArtifacts(undefined);
  if (
    fileOverrides === undefined &&
    JSON.stringify(reread.map(({ path: entryPath, bytes }) => [entryPath, sha256(bytes)])) !==
      JSON.stringify(artifacts.map(({ path: entryPath, bytes }) => [entryPath, sha256(bytes)]))
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_INVENTORY_DRIFT",
      "Reference distribution changed while its package identity was inspected.",
    );
  }

  return Object.freeze({
    identity: Object.freeze({
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      packageDigest: catalog.packageDigest,
    }),
    profile: calculated.profile,
    profileVersion: calculated.profileVersion,
    distributionFiles: artifacts.length,
    distributionBytes: artifacts.reduce((total, { bytes }) => total + bytes.length, 0),
    framedEntries: independent.entries.length,
    framedBytes: independent.bytes.length,
    entries: independent.entries,
    interpretations: Object.freeze({
      independentFrame: independent.packageDigest,
      publicCalculation: calculated.packageDigest,
      publicVerification: verified.packageDigest,
    }),
    catalogAdapterParity: Object.freeze({
      direction: "exact-two-way",
      catalogComponents: Object.freeze(EXPECTED_REFERENCE_COMPONENT_IDS),
      registrationComponents: Object.freeze(EXPECTED_REFERENCE_COMPONENT_IDS),
      behaviors: Object.freeze([]),
      interactions: Object.freeze(interactionParity),
    }),
  });
}

async function inspectImplementation(fileOverrides) {
  const entries = await Promise.all(
    Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
      key,
      await workspaceText(relativePath, fileOverrides),
    ]),
  );
  const source = Object.fromEntries(entries);

  requireFragments(
    source.core,
    [
      "export interface RuntimeHeadlessSessionComponentCommandsInput",
      "export interface RuntimeHeadlessSessionComponentCommandsAttachment",
      "export type RuntimeHeadlessSessionComponentCommandsAttachResult",
      "export type RuntimeHeadlessSessionComponentCommandsDetachResult",
      "export function attachRuntimeHeadlessSessionComponentCommands(",
      "export function detachRuntimeHeadlessSessionComponentCommands(",
      "SESSION_COMPONENT_COMMAND_ATTACHMENTS.set(attachment, attachmentAuthority);",
      "if (previous !== undefined) revokeComponentCommandsAttachment(previous);",
      "current.componentCommandsMutation = Object.freeze({});",
      "if (!attachmentOwnsCurrentComponent(authority))",
      "attachment.owner = undefined;",
      "attachment.lifetime = undefined;",
      "attachment.binding = undefined;",
      "attachment.holder = undefined;",
      "attachment.invoke = undefined;",
    ],
    "RUNTIME_REACT_INTERACTIONS_CORE_DRIFT",
    "runtime-core component-command seam",
  );
  if (
    countMatches(
      source.core,
      /if \(holder\.activeInvocation !== invocation \|\| !attachmentOwnsCurrentComponent\(attachment\)\)/gu,
    ) !== 2
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_CORE_DRIFT",
      "Component-command authority must be rechecked both before and after hostile result capture.",
    );
  }
  requireFragments(
    source.coreIndex,
    [
      "attachRuntimeHeadlessSessionComponentCommands,",
      "detachRuntimeHeadlessSessionComponentCommands,",
      "RuntimeHeadlessSessionComponentCommandsAttachResult,",
      "RuntimeHeadlessSessionComponentCommandsAttachment,",
      "RuntimeHeadlessSessionComponentCommandsDetachResult,",
      "RuntimeHeadlessSessionComponentCommandsInput,",
      "export { snapshotRuntimeJsonValue } from",
    ],
    "RUNTIME_REACT_INTERACTIONS_CORE_DRIFT",
    "runtime-core package root",
  );
  const snapshotExports = namedExportInventory(
    SOURCE_PATHS.runtimeJsonSnapshot,
    source.runtimeJsonSnapshot,
  );
  const snapshotImports = importInventory(
    SOURCE_PATHS.runtimeJsonSnapshot,
    source.runtimeJsonSnapshot,
  );
  if (
    !exactArray(snapshotExports.values, ["isRuntimeJsonObject", "snapshotRuntimeJsonValue"]) ||
    snapshotExports.types.length !== 0 ||
    !exactArray(snapshotImports, ["./host-ports.js", "./value-resolution.js"])
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_SNAPSHOT_SEAM_DRIFT",
      "The public inert JSON snapshot seam import/export inventory changed.",
      { snapshotExports, snapshotImports },
    );
  }
  requireFragments(
    source.runtimeJsonSnapshot,
    [
      "Copies one unknown value through the existing bounded, data-only runtime snapshot boundary.",
      "The small scope envelope is counted against the same aggregate",
      "limits, invokes no accessors, rejects Proxy/reflection failure, and returns only recursively",
      "export function snapshotRuntimeJsonValue(input: unknown): RuntimeJsonValue | undefined {",
      "const snapshot = createRuntimeResolutionSnapshot({",
      "state: { captured: input as RuntimeJsonValue },",
      "context: EMPTY_OBJECT,",
      "resource: EMPTY_LIFECYCLE_MAP,",
      "operation: EMPTY_LIFECYCLE_MAP,",
      "event: UNAVAILABLE_EVENT,",
      "item: EMPTY_OBJECT,",
      "env: EMPTY_OBJECT,",
      "return snapshot.state.captured;",
      "} catch {",
      "return undefined;",
    ],
    "RUNTIME_REACT_INTERACTIONS_SNAPSHOT_SEAM_DRIFT",
    "runtime-core inert JSON snapshot seam",
  );
  if (
    countMatches(source.runtimeJsonSnapshot, /createRuntimeResolutionSnapshot\(\{/gu) !== 1 ||
    !/\/\*\*\n \* Copies one unknown value through the existing bounded, data-only runtime snapshot boundary\.[\s\S]*?\*\/\nexport function snapshotRuntimeJsonValue\(/u.test(
      source.runtimeJsonSnapshot,
    )
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_SNAPSHOT_SEAM_DRIFT",
      "The inert snapshot seam lost its single bounded implementation or public TSDoc.",
    );
  }
  requireFragments(
    source.coreReadme,
    [
      "`snapshotRuntimeJsonValue` exposes the existing pure, bounded M04-T02 inert snapshot boundary",
      "rejects hostile reflection and limit crossings, and returns only recursively frozen JSON.",
      "React adapter uses it before event admission so a Proxy cannot cross a commit/unmount epoch",
    ],
    "RUNTIME_REACT_INTERACTIONS_SNAPSHOT_SEAM_DRIFT",
    "runtime-core inert snapshot documentation",
  );

  const coreHeadlessExports = namedExportInventory(SOURCE_PATHS.core, source.core);
  const coreDistHeadlessJsExports = namedExportInventory(
    SOURCE_PATHS.coreDistHeadlessJs,
    source.coreDistHeadlessJs,
  );
  const coreDistHeadlessTypeExports = namedExportInventory(
    SOURCE_PATHS.coreDistHeadlessTypes,
    source.coreDistHeadlessTypes,
  );
  if (
    !exactArray(coreHeadlessExports.values, EXPECTED_CORE_HEADLESS_EXPORTS) ||
    !exactArray(coreHeadlessExports.types, EXPECTED_CORE_HEADLESS_TYPE_EXPORTS) ||
    !exactArray(coreDistHeadlessJsExports.values, EXPECTED_CORE_HEADLESS_EXPORTS) ||
    coreDistHeadlessJsExports.types.length !== 0 ||
    !exactArray(coreDistHeadlessTypeExports.values, EXPECTED_CORE_HEADLESS_EXPORTS) ||
    !exactArray(coreDistHeadlessTypeExports.types, EXPECTED_CORE_HEADLESS_TYPE_EXPORTS) ||
    countMatches(
      source.coreDistHeadlessJs,
      /holder\.activeInvocation !== invocation \|\| !attachmentOwnsCurrentComponent\(attachment\)/gu,
    ) !== 2
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
      "runtime-core built headless-session public seam differs from its exact reviewed source surface.",
      {
        source: coreHeadlessExports,
        javascript: coreDistHeadlessJsExports,
        declarations: coreDistHeadlessTypeExports,
      },
    );
  }
  requireFragments(
    source.coreDistHeadlessJs,
    [
      "SESSION_COMPONENT_COMMAND_ATTACHMENTS.set(attachment, attachmentAuthority);",
      "current.componentCommandsMutation = Object.freeze({});",
      "attachment.owner = undefined;",
      "attachment.invoke = undefined;",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-core built component-command ownership seam",
  );

  requireFragments(
    source.coreDistIndexJs,
    ['export { snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";'],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-core built JavaScript index",
  );
  requireFragments(
    source.coreDistIndexTypes,
    [
      'export { snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";',
      "RuntimeHeadlessSessionComponentCommandsAttachResult",
      "RuntimeHeadlessSessionComponentCommandsAttachment",
      "RuntimeHeadlessSessionComponentCommandsDetachResult",
      "RuntimeHeadlessSessionComponentCommandsInput",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-core built declaration index",
  );
  requireFragments(
    source.coreDistSnapshotJs,
    [
      'import { createRuntimeResolutionSnapshot } from "./value-resolution.js";',
      "export function snapshotRuntimeJsonValue(input) {",
      "const snapshot = createRuntimeResolutionSnapshot({",
      "return snapshot.state.captured;",
      "catch {",
      "return undefined;",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-core built inert snapshot JavaScript",
  );
  requireFragments(
    source.coreDistSnapshotTypes,
    [
      "Copies one unknown value through the existing bounded, data-only runtime snapshot boundary.",
      "export declare function snapshotRuntimeJsonValue(input: unknown): RuntimeJsonValue | undefined;",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-core built inert snapshot declarations",
  );

  const runtimeExports = namedExportInventory(SOURCE_PATHS.runtimeIndex, source.runtimeIndex);
  if (
    !exactArray(runtimeExports.values, EXPECTED_RUNTIME_EXPORTS) ||
    !exactArray(runtimeExports.types, EXPECTED_RUNTIME_TYPE_EXPORTS)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PUBLIC_API_DRIFT",
      "runtime-react public export inventory changed.",
      { actual: runtimeExports },
    );
  }
  const runtimeRegistryExports = namedExportInventory(
    SOURCE_PATHS.runtimeRegistry,
    source.runtimeRegistry,
  );
  const runtimeDistRegistryJsExports = namedExportInventory(
    SOURCE_PATHS.runtimeDistRegistryJs,
    source.runtimeDistRegistryJs,
  );
  const runtimeDistRegistryTypeExports = namedExportInventory(
    SOURCE_PATHS.runtimeDistRegistryTypes,
    source.runtimeDistRegistryTypes,
  );
  if (
    !exactArray(runtimeRegistryExports.values, EXPECTED_RUNTIME_REGISTRY_EXPORTS) ||
    !exactArray(runtimeRegistryExports.types, EXPECTED_RUNTIME_REGISTRY_TYPE_EXPORTS) ||
    !exactArray(runtimeDistRegistryJsExports.values, EXPECTED_RUNTIME_REGISTRY_EXPORTS) ||
    runtimeDistRegistryJsExports.types.length !== 0 ||
    !exactArray(runtimeDistRegistryTypeExports.values, EXPECTED_RUNTIME_REGISTRY_EXPORTS) ||
    !exactArray(runtimeDistRegistryTypeExports.types, EXPECTED_RUNTIME_REGISTRY_TYPE_EXPORTS)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
      "runtime-react built registry public seam differs from its exact reviewed source surface.",
      {
        source: runtimeRegistryExports,
        javascript: runtimeDistRegistryJsExports,
        declarations: runtimeDistRegistryTypeExports,
      },
    );
  }
  requireFragments(
    source.runtimeDistRegistryTypes,
    [
      "export interface RuntimeReactInteractionPort",
      "readonly dispatchEvent:",
      "readonly attachCommands:",
      "readonly detachCommands:",
      "readonly interactions: RuntimeReactInteractionPort;",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-react built registry interaction declarations",
  );
  requireFragments(
    source.runtimeDistIndexJs,
    [
      "createRuntimeReactAdapterRegistry",
      "renderRuntimeReactSurface",
      "RUNTIME_REACT_RENDER_LIMITS",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-react built JavaScript index",
  );
  requireFragments(
    source.runtimeDistIndexTypes,
    [
      "RuntimeReactInteractionPort",
      "RuntimeReactCommandAttachmentHandle",
      "RuntimeReactRenderFailureCode",
      "renderRuntimeReactSurface",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-react built declaration index",
  );
  requireFragments(
    source.runtimeDistInteractionsJs,
    [
      "snapshotRuntimeJsonValue",
      "controller.currentAuthority !== authority",
      "controller.lifecycleEpoch !== lifecycleEpoch",
      "controller.currentAuthority = undefined;",
      "createRuntimeReactComponentAdapterElement",
      "createRuntimeReactBehaviorAdapterElement",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-react built interaction JavaScript",
  );
  requireFragments(
    source.runtimeDistInteractionsTypes,
    [
      "Creates one commit-gated component adapter element after complete renderer preflight.",
      "createRuntimeReactComponentAdapterElement",
      "createRuntimeReactBehaviorAdapterElement",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-react built interaction declarations",
  );
  requireFragments(
    source.runtimeDistRendererJs,
    [
      'return failure("RUNTIME_BINDING_MISMATCH"',
      "const parityFailure = validateBindingParity(state.bindings, authenticated.snapshot.bindings);",
      "createRuntimeReactComponentAdapterElement({",
      "createRuntimeReactBehaviorAdapterElement({",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-react built renderer JavaScript",
  );
  requireFragments(
    source.runtimeDistRendererTypes,
    [
      '"RUNTIME_BINDING_MISMATCH"',
      "export declare function renderRuntimeReactSurface",
      "commit-gated least-authority interaction seam",
    ],
    "RUNTIME_REACT_INTERACTIONS_DISTRIBUTION_DRIFT",
    "runtime-react built renderer declarations",
  );
  requireFragments(
    source.runtimeRegistry,
    [
      "export type RuntimeReactEventDispatchResult =",
      "export interface RuntimeReactComponentCommandPort",
      "export interface RuntimeReactCommandAttachmentHandle",
      "export type RuntimeReactCommandAttachmentResult =",
      "export type RuntimeReactCommandDetachmentResult =",
      "export interface RuntimeReactInteractionPort",
      "readonly interactions: RuntimeReactInteractionPort;",
      'readonly status: "unavailable" | "rejected"',
    ],
    "RUNTIME_REACT_INTERACTIONS_PUBLIC_API_DRIFT",
    "runtime-react interaction contract",
  );
  requireFragments(
    source.interactions,
    [
      "snapshotRuntimeJsonValue,",
      "const detachedPayload = snapshotRuntimeJsonValue(payload);",
      "const authority = controller.currentAuthority;",
      "const lifecycleEpoch = controller.lifecycleEpoch;",
      "controller.currentAuthority !== authority",
      "controller.lifecycleEpoch !== lifecycleEpoch",
      'if (!controller.committed || authority?.kind !== "component")',
      "snapshot: authority.snapshot,",
      "runtimeInstanceId: authority.runtimeInstanceId,",
      "dispatchRuntimeHeadlessSessionEvent(authority.session,",
      "attachRuntimeHeadlessSessionComponentCommands(authority.session,",
      "detachRuntimeHeadlessSessionComponentCommands(coreAttachment);",
      'previous.status = "detached";',
      "previous.coreAttachment = undefined;",
      "controller.attachments.clear();",
      "controller.attachments.add(attachmentAuthority);",
      "controller.committed = false;",
      "controller.attachments.clear();",
      "controller.currentAuthority = undefined;",
      "const completion = result.completion.then(",
      "const controller = useMemo(() => createInteractionController(), [authority]);",
      "() => activateInteractionController(controller, authority),",
      "createRuntimeReactComponentAdapterElement(",
      "createRuntimeReactBehaviorAdapterElement(",
    ],
    "RUNTIME_REACT_INTERACTIONS_REACT_LIFECYCLE_DRIFT",
    "runtime-react commit-scoped interaction implementation",
  );
  if (countMatches(source.interactions, /snapshot: authority\.snapshot,/gu) !== 2) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_REACT_LIFECYCLE_DRIFT",
      "Component/behavior interaction dispatch and attachment must retain exact captured snapshots.",
    );
  }
  requireFragments(
    source.renderer,
    [
      '| "RUNTIME_BINDING_MISMATCH"',
      "function validateBindingParity(",
      "matched.has(binding.runtimeInstanceId)",
      "for (const expected of prepared.values())",
      "const parityFailure = validateBindingParity(state.bindings, authenticated.snapshot.bindings);",
      "if (parityFailure !== undefined) return parityFailure;",
      "snapshot: authenticated.snapshot,",
      "createRuntimeReactComponentAdapterElement({",
      "createRuntimeReactBehaviorAdapterElement({",
    ],
    "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
    "runtime-react two-way binding preflight",
  );
  const bindingComparator = matchesPreparedBindingInventory(SOURCE_PATHS.renderer, source.renderer);
  const builtBindingComparator = matchesPreparedBindingInventory(
    SOURCE_PATHS.runtimeDistRendererJs,
    source.runtimeDistRendererJs,
  );
  const expectedBindingComparator = Object.freeze({
    shared: Object.freeze([
      "prepared.kind !== binding.kind",
      "prepared.runtimeInstanceId !== binding.runtimeInstanceId",
      "prepared.sourceNodeId !== binding.sourceNodeId",
      "prepared.capabilityId !== binding.capabilityId",
    ]),
    discriminator: 'prepared.kind === "component"',
    component: 'binding.kind === "component"',
    behavior: Object.freeze([
      'binding.kind === "behavior"',
      "prepared.behaviorId === binding.behaviorId",
      "prepared.ownerRuntimeInstanceId === binding.ownerRuntimeInstanceId",
    ]),
  });
  if (
    JSON.stringify(bindingComparator) !== JSON.stringify(expectedBindingComparator) ||
    JSON.stringify(builtBindingComparator) !== JSON.stringify(expectedBindingComparator)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_BINDING_PARITY_DRIFT",
      "Source and built binding comparators must retain every exact component/behavior identity field.",
      { source: bindingComparator, built: builtBindingComparator },
    );
  }

  const interactionImports = importInventory(SOURCE_PATHS.interactions, source.interactions);
  const rendererImports = importInventory(SOURCE_PATHS.renderer, source.renderer);
  if (
    !exactArray(interactionImports, ["./registry.js", "@desen/runtime-core", "react"]) ||
    !exactArray(rendererImports, [
      "./interactions.js",
      "./registry.js",
      "@desen/runtime-core",
      "@desen/validator",
      "react",
    ])
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_IMPORT_DRIFT",
      "runtime-react interaction import boundary changed.",
      { interactionImports, rendererImports },
    );
  }
  rejectFragments(
    `${source.interactions}\n${source.renderer}`,
    ["react-dom", "document.", "window.", "HTMLElement", "SyntheticEvent", "dynamic import("],
    "RUNTIME_REACT_INTERACTIONS_PLATFORM_LEAK",
    "runtime-react production boundary",
  );

  const referenceExports = namedExportInventory(
    SOURCE_PATHS.referenceAdapters,
    source.referenceAdapters,
  );
  if (
    !exactArray(referenceExports.values, EXPECTED_REFERENCE_ADAPTER_EXPORTS) ||
    referenceExports.types.length !== 0
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
      "Reference React adapter export inventory changed.",
      { actual: referenceExports },
    );
  }
  requireFragments(
    source.referenceAdapters,
    [
      "export const REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS = Object.freeze([",
      "stackReactAdapterRegistration,",
      "textReactAdapterRegistration,",
      "textFieldReactAdapterRegistration,",
      "buttonReactAdapterRegistration,",
      "alertReactAdapterRegistration,",
      "const textFieldHandle = useRef<TextFieldHandle>(null);",
      'commandName !== "focus"',
      "textFieldHandle.current.focus();",
      'interactions.dispatchEvent("change", payload);',
      'interactions.dispatchEvent("press", payload);',
      "interactions.attachCommands(commands);",
      "interactions.detachCommands(attachment);",
    ],
    "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
    "reference React adapter inventory",
  );
  const referenceInteractionCallSites = referenceInteractionCallSiteInventory(
    SOURCE_PATHS.referenceAdapters,
    source.referenceAdapters,
  );
  if (
    JSON.stringify(referenceInteractionCallSites.calls) !==
      JSON.stringify([
        {
          method: "attachCommands",
          event: null,
          committedEffect: true,
          platformCallback: null,
        },
        {
          method: "detachCommands",
          event: null,
          committedEffect: true,
          platformCallback: null,
        },
        {
          method: "dispatchEvent",
          event: "change",
          committedEffect: false,
          platformCallback: "onChange",
        },
        {
          method: "dispatchEvent",
          event: "press",
          committedEffect: false,
          platformCallback: "onPress",
        },
      ]) ||
    referenceInteractionCallSites.aliases.length !== 0 ||
    referenceInteractionCallSites.unsafe.length !== 0
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
      "Side-effecting reference interaction calls left committed effects or platform callbacks.",
      referenceInteractionCallSites,
    );
  }
  rejectFragments(
    source.referenceAdapters,
    [
      "...props",
      "...style",
      "dangerouslySetInnerHTML",
      "document.",
      "window.",
      "HTMLElement",
      "SyntheticEvent",
      "import(",
      "require(",
    ],
    "RUNTIME_REACT_INTERACTIONS_REFERENCE_PLATFORM_LEAK",
    "reference React adapters",
  );
  if (source.referenceIndex.includes("react-adapters")) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_REFERENCE_ADAPTER_DRIFT",
      "The inert reference package root unexpectedly exports executable React adapters.",
    );
  }
  const referenceConsumerExports = exactConsumerReexportInventory(
    SOURCE_PATHS.referenceConsumer,
    source.referenceConsumer,
  );
  const executedReferenceConsumerExports = await executeReferenceConsumer(source.referenceConsumer);
  if (!exactArray(executedReferenceConsumerExports, referenceConsumerExports)) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_CONSUMER_DRIFT",
      "The exact consumer source and executed public package namespace disagree.",
    );
  }

  let referenceManifest;
  let coreManifest;
  let runtimeManifest;
  let rootManifest;
  try {
    referenceManifest = JSON.parse(source.referencePackage);
    coreManifest = JSON.parse(source.corePackage);
    runtimeManifest = JSON.parse(source.runtimePackage);
    rootManifest = JSON.parse(source.rootPackage);
  } catch {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PACKAGE_WIRING_DRIFT",
      "A tracked package manifest is not valid JSON.",
    );
  }
  requireExactReviewedManifest(
    coreManifest,
    EXPECTED_RUNTIME_CORE_MANIFEST,
    "runtime-core package manifest",
  );
  requireExactReviewedManifest(
    runtimeManifest,
    EXPECTED_RUNTIME_REACT_MANIFEST,
    "runtime-react package manifest",
  );
  requireExactReviewedManifest(
    referenceManifest,
    EXPECTED_REFERENCE_MANIFEST,
    "reference-catalog-web package manifest",
  );
  const sc01DtcgCompatibility = sc01DtcgCompatibilityInventory(source, rootManifest);
  const localStateIdentityCompatibility = localStateIdentityCompatibilityInventory(
    source,
    rootManifest,
  );
  const commandEventCompatibility = commandEventCompatibilityInventory(source, rootManifest);
  const reactiveReevaluationCompatibility = reactiveReevaluationCompatibilityInventory(
    source,
    rootManifest,
  );

  const interactionTitles = [
    ...testTitleInventory(SOURCE_PATHS.interactionTests, source.interactionTests),
    ...testTitleInventory(SOURCE_PATHS.parityTests, source.parityTests),
  ];
  const referenceTitles = [
    ...testTitleInventory(SOURCE_PATHS.referenceTests, source.referenceTests),
    ...testTitleInventory(SOURCE_PATHS.referenceConsumerTests, source.referenceConsumerTests),
  ];
  const coreTitles = testTitleInventory(SOURCE_PATHS.coreTests, source.coreTests).filter((title) =>
    EXPECTED_CORE_TEST_TITLES.includes(title),
  );
  const rootTitles = testTitleInventory(SOURCE_PATHS.rootTests, source.rootTests);
  const interactionTestIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.interactionTests,
    source.interactionTests,
  );
  const parityTestIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.parityTests,
    source.parityTests,
  );
  const referenceTestIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.referenceTests,
    source.referenceTests,
  );
  const referenceConsumerTestIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.referenceConsumerTests,
    source.referenceConsumerTests,
  );
  focusedTestRegistrationIntegrity(SOURCE_PATHS.coreTests, source.coreTests);
  const rootTestIntegrity = focusedTestRegistrationIntegrity(
    SOURCE_PATHS.rootTests,
    source.rootTests,
  );
  const expectedParameterizedCases = [
    {
      title: "fails closed before adapter execution for exact component case %s",
      cases: EXPECTED_COMPONENT_BINDING_PARITY_CASES,
    },
    {
      title: "fails closed before adapter execution for exact behavior case %s",
      cases: EXPECTED_BEHAVIOR_BINDING_PARITY_CASES,
    },
  ];
  const referenceConsumerTestImports = importInventory(
    SOURCE_PATHS.referenceConsumerTests,
    source.referenceConsumerTests,
  );
  requireFragments(
    source.referenceConsumerTests,
    [
      'import * as publicReactAdapters from "@desen/reference-catalog-web/react-adapters";',
      'import * as consumerReactAdapters from "./react-adapters-consumer.mjs";',
      "expect(Object.keys(consumerReactAdapters).sort()).toEqual(",
      "expect(Object.keys(publicReactAdapters).sort()).toEqual(EXPECTED_PUBLIC_REACT_ADAPTER_EXPORTS);",
      "expect(consumerReactAdapters[exportName]).toBe(publicReactAdapters[exportName]);",
    ],
    "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
    "public React-adapter consumer execution test",
  );
  if (
    !exactArray(interactionTitles, EXPECTED_INTERACTION_TEST_TITLES) ||
    !exactArray(referenceTitles, EXPECTED_REFERENCE_TEST_TITLES) ||
    !exactArray(coreTitles, EXPECTED_CORE_TEST_TITLES) ||
    !exactArray(rootTitles, EXPECTED_ROOT_TEST_TITLES) ||
    interactionTestIntegrity.executedCases !== 9 ||
    interactionTestIntegrity.parameterized.length !== 0 ||
    JSON.stringify(parityTestIntegrity.parameterized) !==
      JSON.stringify(expectedParameterizedCases) ||
    parityTestIntegrity.executedCases !== 14 ||
    referenceTestIntegrity.executedCases !== 9 ||
    referenceConsumerTestIntegrity.executedCases !== 1 ||
    rootTestIntegrity.executedCases !== EXPECTED_ROOT_TEST_TITLES.length ||
    !exactArray(referenceConsumerTestImports, [
      "./react-adapters-consumer.mjs",
      "@desen/reference-catalog-web/react-adapters",
      "vitest",
    ])
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
      "Focused or root interaction test inventory changed.",
      {
        interactionTitles,
        referenceTitles,
        coreTitles,
        rootTitles,
        interactionTestIntegrity,
        parityTestIntegrity,
        referenceTestIntegrity,
        referenceConsumerTestIntegrity,
        rootTestIntegrity,
        referenceConsumerTestImports,
      },
    );
  }
  const compilerNegativeCases = Object.freeze({
    runtimeReact: countMatches(source.interactionTypes, /@ts-expect-error/gu),
    referenceAdapters: countMatches(source.referenceTypes, /@ts-expect-error/gu),
    runtimeCoreCommandAttachment: [
      "command attachment inputs are immutable",
      "an attachment requires the exact current snapshot",
      "a callback is required; inert metadata cannot become command authority",
      "command results are a closed succeeded/denied classification",
      "executable attachment envelopes accept no extra authority",
      "command attachments carry factory-only authority",
      "a session handle cannot be detached as a command attachment",
    ].filter((marker) => source.coreTypes.includes(marker)).length,
  });
  if (
    compilerNegativeCases.runtimeReact !== 3 ||
    compilerNegativeCases.referenceAdapters !== 10 ||
    compilerNegativeCases.runtimeCoreCommandAttachment !== 7
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_TEST_INVENTORY_DRIFT",
      "Compiler-negative interaction inventory changed.",
      compilerNegativeCases,
    );
  }

  requireFragments(
    source.tasks,
    [
      "| M05-T04 | DONE",
      "`M05-T04` authenticates the complete render plan against the exact current session binding",
    ],
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "M05 task ledger",
  );
  requireFragments(
    source.projectStatus,
    [
      "- Overall implementation progress: `58 / 145 tasks complete (40%)`",
      "- M05 progress: `4 / 9 tasks complete (44%)`",
      "`M05-T02 — Resolved props and named slots`",
      "`M05-T03 — Style parts and visual states`",
      "`M05-T04 — Component events, commands, and behavior adapters`",
      "- Next implementation task: `M05-T05 — Stable keys and runtime-node ↔ source-node diagnostics`",
      "- Status: M05-T04 is complete; M05-T05 is ready to start",
      "Begin `M05-T05 — Stable keys and runtime-node ↔ source-node diagnostics`.",
      "M05-T04 evidence:",
      "this byte-owned status ledger deliberately does not create a circular sixth self-pin",
      "20 compiler-negative cases, 18 root proof/mutation tests",
      "immutable historical SC-01 DTCG, M04-T06,\n  M04-T12, and M04-T15 evidence",
    ],
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "project status task ledger",
  );
  requireFragments(
    source.normative,
    ["| N-033 ", "| N-034 ", "M05-T04 closes the selected Web–React profile end to end."],
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "normative coverage",
  );
  const n033 = markdownRow(
    source.normative,
    "N-033",
    6,
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "Normative coverage",
  );
  const p05 = markdownRow(
    source.matrix,
    "P-05",
    8,
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "Proof Matrix",
  );
  const p06 = markdownRow(
    source.matrix,
    "P-06",
    8,
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "Proof Matrix",
  );
  if (
    n033[3] !== "M02-T09, M03-T09, M04-T14, M05-T04" ||
    n033[4] !== "TESTED" ||
    !n033[5].includes("TextField emits only a fresh inert `{ value }` payload") ||
    !n033[5].includes("Button emits only a fresh inert `{}` payload") ||
    !n033[5].includes("platform `change` callback") ||
    !n033[5].includes("platform `press` callback") ||
    p05[2] !== "M03-T04, M03-T10, M05-T04, M06-T08, M07-T03" ||
    p05[3] !== "PARTIAL" ||
    !p05[4].includes("historical `run.desen.reference.sign-in@0.1.0` Web–React tuple") ||
    !p05[4].includes("exact 76-file distribution") ||
    !p05[4].includes("current 80-file successor") ||
    !p05[4].includes("executable `./react-adapters` subpath") ||
    p06[2] !== "M03-T09, M05-T04, M09-T03" ||
    p06[3] !== "PARTIAL" ||
    !p06[4].includes("historical five-export logical parity record") ||
    !p06[4].includes("current package's exact static five-component React registry") ||
    !p06[4].includes("without yet claiming Desen App or separately built host execution")
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
      "N-033 or the P-05/P-06 successor evidence rows lost their exact M05-T04 ownership and scope.",
    );
  }
  requireFragments(
    source.findings,
    [
      "## PF-053 — React interaction authority is commit-scoped and package executables require a successor digest",
      EXPECTED_SUCCESSOR_PACKAGE_DIGEST,
      "81\n  entries and 252,072 bytes",
    ],
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "protocol findings",
  );
  requireFragments(
    source.proof,
    [
      "# Runtime React Interactions Proof",
      "## Commit-scoped interaction authority",
      "## Component command ownership",
      "## Static reference adapters",
      "## Successor package identity",
      "## Historical compatibility",
      "This immutable-reader boundary covers SC-01 DTCG,\nM04-T06 local state and node identity, M04-T12 command/event actions, and M04-T15 reactive\nreevaluation.",
      "## Evidence artifact",
    ],
    "RUNTIME_REACT_INTERACTIONS_TRACEABILITY_DRIFT",
    "M05-T04 proof document",
  );
  parseArtifactReference(
    source.proof,
    "## Evidence artifact",
    ARTIFACT_RELATIVE_PATH,
    true,
    "opening",
  );
  parseArtifactReference(
    source.matrix,
    "## M05-T04",
    path.basename(ARTIFACT_RELATIVE_PATH),
    true,
    "terminal",
  );
  const selfPinDocuments = [
    ["proof", artifactPinInventory(source.proof, true), 1],
    ["Proof Matrix", artifactPinInventory(source.matrix, true), 3],
    ["Normative Coverage", artifactPinInventory(source.normative, true), 1],
  ];
  const contextualRowPins = [
    [
      "P-05 artifact cell",
      [exactInlineArtifactPin(p05[6], path.basename(ARTIFACT_RELATIVE_PATH), true)],
    ],
    [
      "P-06 artifact cell",
      [exactInlineArtifactPin(p06[6], path.basename(ARTIFACT_RELATIVE_PATH), true)],
    ],
    ["N-033 evidence cell", [exactInlineArtifactPin(n033[5], ARTIFACT_RELATIVE_PATH, true)]],
  ];
  const allSelfPinValues = selfPinDocuments.flatMap(([, pins]) => pins.map(({ value }) => value));
  if (
    selfPinDocuments.some(
      ([, pins, expectedCount]) =>
        pins.length !== expectedCount || new Set(pins.map(({ value }) => value)).size !== 1,
    ) ||
    contextualRowPins.some(([, pins]) => pins.length !== 1) ||
    new Set(allSelfPinValues).size !== 1
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
      "The five exact M05-T04 self-pins must remain identical and in P-05, P-06, N-033, and their canonical sections.",
    );
  }

  const normativeCompatibilityTransfer = normativeCompatibilityTransferInventory(
    source.compatibilityParityProof,
    source.compatibilityParityTests,
    source.normative,
  );

  for (const compatibilityPath of COMPATIBILITY_PATHS.filter(
    (entry) => entry.startsWith("scripts/lib/") && entry !== SOURCE_PATHS.compatibilityParityProof,
  )) {
    const compatibilityText = await workspaceText(compatibilityPath, fileOverrides);
    if (!compatibilityText.includes("immutable-task-time-artifact")) {
      fail(
        "RUNTIME_REACT_INTERACTIONS_COMPATIBILITY_DRIFT",
        `Historical compatibility reader changed: ${compatibilityPath}.`,
      );
    }
  }

  for (const key of [
    "generate:runtime-react-interactions",
    "verify:runtime-react-interactions",
    "test:runtime-react-interactions",
  ]) {
    const command = rootManifest.scripts?.[key];
    if (
      typeof command !== "string" ||
      command.indexOf("pnpm --filter @desen/reference-catalog-web... build") === -1 ||
      command.indexOf("pnpm --filter @desen/reference-catalog-web test:react-adapters") === -1 ||
      command.indexOf("pnpm --filter @desen/reference-catalog-web... build") >
        command.indexOf("pnpm --filter @desen/reference-catalog-web test:react-adapters")
    ) {
      fail("RUNTIME_REACT_INTERACTIONS_CI_DRIFT", `Root package script is missing: ${key}.`);
    }
  }
  requireFragments(
    source.rootPackage,
    [
      "scripts/generate-runtime-react-interactions-proof.mjs",
      "scripts/verify-runtime-react-interactions.mjs",
      "tests/runtime-react-interactions.test.mjs",
    ],
    "RUNTIME_REACT_INTERACTIONS_CI_DRIFT",
    "root package proof wiring",
  );
  requireFragments(
    source.ciRunner,
    [
      '"runtime-react-interactions"',
      '"scripts/verify-runtime-react-interactions.mjs"',
      '"tests/runtime-react-interactions.test.mjs"',
    ],
    "RUNTIME_REACT_INTERACTIONS_CI_DRIFT",
    "optimized CI inventory",
  );
  requireFragments(
    source.ciTests,
    ["proofCount: 44", "verifierCount: 44", "rootTestCount: 44"],
    "RUNTIME_REACT_INTERACTIONS_CI_DRIFT",
    "optimized CI inventory tests",
  );

  return Object.freeze({
    publicApi: Object.freeze({
      runtimeExports: runtimeExports.values,
      runtimeTypeExports: runtimeExports.types,
      coreCommandFunctions: Object.freeze([
        "attachRuntimeHeadlessSessionComponentCommands",
        "detachRuntimeHeadlessSessionComponentCommands",
      ]),
      coreCommandTypes: Object.freeze([
        "RuntimeHeadlessSessionComponentCommandsInput",
        "RuntimeHeadlessSessionComponentCommandsAttachment",
        "RuntimeHeadlessSessionComponentCommandsAttachResult",
        "RuntimeHeadlessSessionComponentCommandsDetachResult",
      ]),
    }),
    imports: Object.freeze({
      interactions: interactionImports,
      renderer: rendererImports,
    }),
    tests: Object.freeze({
      runtimeReactDeclarations: interactionTitles.length,
      runtimeReactExecutedCases:
        interactionTestIntegrity.executedCases + parityTestIntegrity.executedCases,
      referenceAdapterTests: referenceTitles.length,
      runtimeCoreCommandTests: coreTitles.length,
      rootMutationTests: rootTitles.length,
      compilerNegativeCases: Object.freeze({
        ...compilerNegativeCases,
        total:
          compilerNegativeCases.runtimeReact +
          compilerNegativeCases.referenceAdapters +
          compilerNegativeCases.runtimeCoreCommandAttachment,
      }),
    }),
    referenceAdapterExports: referenceExports.values,
    referencePackageExports: Object.freeze(EXPECTED_REFERENCE_PACKAGE_EXPORTS),
    referenceConsumerExports,
    normativeCompatibilityTransfer,
    sc01DtcgCompatibility,
    localStateIdentityCompatibility,
    commandEventCompatibility,
    reactiveReevaluationCompatibility,
  });
}

async function trackedEvidence(fileOverrides) {
  const records = [];
  for (const relativePath of sorted(new Set(TRACKED_PATHS))) {
    const originalBytes = await workspaceBytes(relativePath, fileOverrides);
    const selfPinnedDocument =
      relativePath === PROOF_DOCUMENT_PATH ||
      relativePath === PROOF_MATRIX_PATH ||
      relativePath === NORMATIVE_COVERAGE_PATH;
    const bytes = selfPinnedDocument
      ? Buffer.from(
          normalizeSelfPinnedDocument(relativePath, originalBytes.toString("utf8")),
          "utf8",
        )
      : originalBytes;
    records.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: prefixedSha256(bytes),
        ...(selfPinnedDocument ? { selfPinNormalizedTo: `sha256:${PENDING_ARTIFACT_SHA256}` } : {}),
      }),
    );
  }
  return Object.freeze(records);
}

async function formatArtifact(artifact) {
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  return Buffer.from(artifactText, "utf8");
}

/**
 * Builds deterministic M05-T04 evidence from reviewed source, tests, docs, immutable
 * prerequisites, and the complete current reference-package distribution inventory.
 */
export async function buildRuntimeReactInteractionsEvidence(rawOptions = undefined) {
  const options = captureOwnDataOptions(
    rawOptions,
    ["fileOverrides", "prerequisiteBytes"],
    "build options",
  );
  const fileOverrides = captureFileOverrides(options.fileOverrides);
  const prerequisiteBytes = capturePrerequisiteBytes(options.prerequisiteBytes);
  const [prerequisites, implementation, successorPackage, trackedFiles] = await Promise.all([
    inspectPrerequisites(prerequisiteBytes, fileOverrides),
    inspectImplementation(fileOverrides),
    inspectSuccessorPackage(fileOverrides),
    trackedEvidence(fileOverrides),
  ]);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M05-T04",
    result: "PASS",
    profile: "desen-runtime-react-interactions-v1",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites,
    claim: Object.freeze({
      exactTwoWayBindingParityBeforeElementCreation: true,
      interactionAuthorityCommitScoped: true,
      exactCapturedSessionSnapshotAndRuntimeIdentity: true,
      behaviorEventsSupported: true,
      behaviorComponentCommandAuthority: false,
      componentCommandOwnershipOpaqueAndRevocable: true,
      nativeOrDomAuthorityExposed: false,
      referenceDeclaredCommandsImplemented: true,
    }),
    componentCommands: Object.freeze({
      functions: implementation.publicApi.coreCommandFunctions,
      types: implementation.publicApi.coreCommandTypes,
      stableLowerBindingTicket: true,
      supersession: "newest-owner-wins",
      staleCleanupRevokesReplacement: false,
      automaticRevocation: Object.freeze([
        "binding-replacement",
        "navigation",
        "react-unmount",
        "session-disposal",
      ]),
      hostileOutcomes: "fail-closed-denied-or-controlled-status",
    }),
    runtimeReact: Object.freeze({
      exports: implementation.publicApi.runtimeExports,
      typeExports: implementation.publicApi.runtimeTypeExports,
      imports: implementation.imports,
      commitMechanism: "private-layout-effect-controller",
      preFirstCommitAuthority: "unavailable",
      serverRenderAuthority: "unavailable",
      neverCommittedSuspenseAuthority: "unavailable",
      cleanupAuthority: "unavailable",
      postCommitRenderPhasePubliclyDistinguishable: false,
      trustedAdapterUsageRule:
        "side-effecting ports are called only from committed effects or platform callbacks",
      eventCompletionExposure: "void-only",
      bindingParityFailure: "RUNTIME_BINDING_MISMATCH",
    }),
    referenceAdapters: Object.freeze({
      subpath: "@desen/reference-catalog-web/react-adapters",
      staticComponentRegistrations: 5,
      exports: implementation.referenceAdapterExports,
      packageExports: implementation.referencePackageExports,
      consumerExports: implementation.referenceConsumerExports,
      builtPublicSubpathExecuted: true,
      declaredCommandImplementations: Object.freeze([
        Object.freeze({
          capabilityId: "com.example.ui/TextField",
          command: "focus",
          privatePrimitive: "TextFieldHandle.focus",
        }),
      ]),
      forwardedEvents: Object.freeze([
        Object.freeze({ capabilityId: "com.example.ui/TextField", event: "change" }),
        Object.freeze({ capabilityId: "com.example.ui/Button", event: "press" }),
      ]),
      commandAttachmentCallSite: "committed-useEffect",
      eventDispatchCallSites: Object.freeze(["onChange", "onPress"]),
      arbitraryPropOrSemanticStyleSpread: false,
      domOrNativeHandleLeak: false,
      dynamicExecutableLoading: false,
    }),
    successorPackage,
    evidence: Object.freeze({
      tests: implementation.tests,
      trackedFiles,
      compatibilityPaths: Object.freeze(COMPATIBILITY_PATHS),
      normativeCompatibilityTransfer: implementation.normativeCompatibilityTransfer,
      sc01DtcgCompatibility: implementation.sc01DtcgCompatibility,
      localStateIdentityCompatibility: implementation.localStateIdentityCompatibility,
      commandEventCompatibility: implementation.commandEventCompatibility,
      reactiveReevaluationCompatibility: implementation.reactiveReevaluationCompatibility,
      proofPinNormalization: Object.freeze({
        token: PENDING_ARTIFACT_SHA256,
        allowlistedDocuments: Object.freeze([
          PROOF_DOCUMENT_PATH,
          PROOF_MATRIX_PATH,
          NORMATIVE_COVERAGE_PATH,
        ]),
        exactReferenceCount: 5,
        productionVerifierAcceptsPending: false,
      }),
      verifierExecutionProfile: "static-evidence-and-built-package-tuple",
    }),
    nonclaims: Object.freeze([
      "No stable React reconciliation or runtime-to-source lookup API claim.",
      "No public detector that distinguishes a post-commit trusted child render phase.",
      "No committed adapter exception-containment claim.",
      "No concrete semantic-style, CSS, or accessibility-preservation claim.",
      "No independently built reference host or complete sign-in execution claim.",
      "No iOS, Android, SwiftUI, Compose, or other native renderer claim.",
    ]),
  });
  const artifactBytes = await formatArtifact(artifact);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

async function verifyFinalPins(artifactSha256, options) {
  const proofText =
    options.proofDocumentText ??
    (
      await readRegularBytes(
        options.proofPath ?? DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_PATH,
        "RUNTIME_REACT_INTERACTIONS_PROOF_MISSING",
        "RUNTIME_REACT_INTERACTIONS_PROOF_UNSAFE",
        "M05-T04 proof document",
      )
    ).toString("utf8");
  const matrixText =
    options.proofMatrixText ??
    (
      await readRegularBytes(
        options.proofMatrixPath ?? DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_MATRIX_PATH,
        "RUNTIME_REACT_INTERACTIONS_PROOF_MISSING",
        "RUNTIME_REACT_INTERACTIONS_PROOF_UNSAFE",
        "M05-T04 Proof Matrix",
      )
    ).toString("utf8");
  const normativeText =
    options.normativeCoverageText ??
    (
      await readRegularBytes(
        options.normativeCoveragePath ?? DEFAULT_RUNTIME_REACT_INTERACTIONS_NORMATIVE_COVERAGE_PATH,
        "RUNTIME_REACT_INTERACTIONS_PROOF_MISSING",
        "RUNTIME_REACT_INTERACTIONS_PROOF_UNSAFE",
        "M05-T04 Normative Coverage",
      )
    ).toString("utf8");
  const proofPin = parseArtifactReference(
    proofText,
    "## Evidence artifact",
    ARTIFACT_RELATIVE_PATH,
    false,
    "opening",
  ).value;
  const matrixPin = parseArtifactReference(
    matrixText,
    "## M05-T04",
    path.basename(ARTIFACT_RELATIVE_PATH),
    false,
    "terminal",
  ).value;
  const documentPins = [
    ["proof", artifactPinInventory(proofText, false), 1],
    ["Proof Matrix", artifactPinInventory(matrixText, false), 3],
    ["Normative Coverage", artifactPinInventory(normativeText, false), 1],
  ];
  const verificationP05 = markdownRow(
    matrixText,
    "P-05",
    8,
    "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    "Proof Matrix",
  );
  const verificationP06 = markdownRow(
    matrixText,
    "P-06",
    8,
    "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    "Proof Matrix",
  );
  const verificationN033 = markdownRow(
    normativeText,
    "N-033",
    6,
    "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
    "Normative Coverage",
  );
  const contextualPins = [
    [exactInlineArtifactPin(verificationP05[6], path.basename(ARTIFACT_RELATIVE_PATH), false)],
    [exactInlineArtifactPin(verificationP06[6], path.basename(ARTIFACT_RELATIVE_PATH), false)],
    [exactInlineArtifactPin(verificationN033[5], ARTIFACT_RELATIVE_PATH, false)],
  ];
  if (
    proofPin !== artifactSha256 ||
    matrixPin !== artifactSha256 ||
    documentPins.some(
      ([, pins, expectedCount]) =>
        pins.length !== expectedCount || pins.some(({ value }) => value !== artifactSha256),
    ) ||
    contextualPins.some((pins) => pins.length !== 1 || pins[0].value !== artifactSha256)
  ) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_PROOF_PIN_DRIFT",
      "Every exact Proof, Proof Matrix, and Normative Coverage reference must pin the same deterministic M05-T04 artifact SHA-256.",
      {
        expected: artifactSha256,
        proofPin,
        matrixPin,
        documents: documentPins.map(([label, pins]) => ({
          label,
          pins: pins.map(({ value }) => value),
        })),
      },
    );
  }
}

/** Atomically writes deterministic M05-T04 evidence after complete inspection. */
export async function writeRuntimeReactInteractionsEvidence(rawOptions = undefined) {
  const options = captureOwnDataOptions(
    rawOptions,
    ["artifactPath", "buildOptions", "beforeAtomicRename"],
    "write options",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_INTERACTIONS_ARTIFACT_PATH;
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOwnDataOptions(
          options.buildOptions,
          ["fileOverrides", "prerequisiteBytes"],
          "buildOptions",
        );
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeReactInteractionsEvidence(buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_ARTIFACT_UNSAFE",
      "Atomic M05-T04 artifact write failed safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    successorPackageDigest: built.artifact.successorPackage.identity.packageDigest,
  });
}

/** Rebuilds, byte-compares, and verifies exact final M05-T04 documentation pins. */
export async function verifyRuntimeReactInteractionsEvidence(rawOptions = undefined) {
  const options = captureOwnDataOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofPath",
      "proofDocumentText",
      "proofMatrixPath",
      "proofMatrixText",
      "normativeCoveragePath",
      "normativeCoverageText",
      "buildOptions",
    ],
    "verify options",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_INTERACTIONS_ARTIFACT_PATH;
  const artifactBytes = optionalBuffer(options.artifactBytes, "artifactBytes");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalString(options.proofDocumentText, "proofDocumentText");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalString(options.proofMatrixText, "proofMatrixText");
  const normativeCoveragePath = optionalString(
    options.normativeCoveragePath,
    "normativeCoveragePath",
  );
  const normativeCoverageText = optionalString(
    options.normativeCoverageText,
    "normativeCoverageText",
  );
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOwnDataOptions(
          options.buildOptions,
          ["fileOverrides", "prerequisiteBytes"],
          "buildOptions",
        );
  const built = await buildRuntimeReactInteractionsEvidence(buildOptions);
  await verifyFinalPins(built.artifactSha256, {
    proofPath,
    proofDocumentText,
    proofMatrixPath,
    proofMatrixText,
    normativeCoveragePath,
    normativeCoverageText,
  });
  const actualBytes =
    artifactBytes ??
    (await readRegularBytes(
      artifactPath,
      "RUNTIME_REACT_INTERACTIONS_ARTIFACT_MISSING",
      "RUNTIME_REACT_INTERACTIONS_ARTIFACT_UNSAFE",
      "M05-T04 artifact",
    ));
  if (!actualBytes.equals(built.artifactBytes)) {
    fail(
      "RUNTIME_REACT_INTERACTIONS_ARTIFACT_DRIFT",
      "Tracked M05-T04 artifact differs from its deterministic rebuild.",
      { expected: built.artifactSha256, actual: sha256(actualBytes) },
    );
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    runtimeExports: built.artifact.runtimeReact.exports.length,
    runtimeTypeExports: built.artifact.runtimeReact.typeExports.length,
    runtimeReactExecutedCases: built.artifact.evidence.tests.runtimeReactExecutedCases,
    referenceAdapterTests: built.artifact.evidence.tests.referenceAdapterTests,
    runtimeCoreCommandTests: built.artifact.evidence.tests.runtimeCoreCommandTests,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases.total,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
    successorPackageDigest: built.artifact.successorPackage.identity.packageDigest,
    framedEntries: built.artifact.successorPackage.framedEntries,
    framedBytes: built.artifact.successorPackage.framedBytes,
  });
}
