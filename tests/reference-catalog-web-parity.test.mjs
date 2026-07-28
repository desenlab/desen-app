import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildReferenceCatalogWebParityEvidence,
  DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH,
  ReferenceCatalogWebParityEvidenceError,
  verifyReferenceCatalogWebParityNormativeCompatibility,
  verifyReferenceCatalogWebParityEvidence,
  writeReferenceCatalogWebParityEvidence,
} from "../scripts/lib/reference-catalog-web-parity-proof.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TEST_DIRECTORY, "..");
const PACKAGE_TEST_DIRECTORY = path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/test");

async function loadApis() {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [
    parityConsumer,
    componentApi,
    operationsApi,
    hostOperationsApi,
    packageRootApi,
    catalogSdkApi,
    validatorApi,
  ] = await Promise.all([
    import(
      `${pathToFileURL(path.join(PACKAGE_TEST_DIRECTORY, "parity-consumer.mjs")).href}?test=${stamp}`
    ),
    import(
      `${pathToFileURL(path.join(PACKAGE_TEST_DIRECTORY, "form-feedback-components-consumer.mjs")).href}?test=${stamp}`
    ),
    import(
      `${pathToFileURL(path.join(PACKAGE_TEST_DIRECTORY, "operations-consumer.mjs")).href}?test=${stamp}`
    ),
    import(
      `${pathToFileURL(path.join(PACKAGE_TEST_DIRECTORY, "host-operations-consumer.mjs")).href}?test=${stamp}`
    ),
    import(
      `${pathToFileURL(path.join(PACKAGE_TEST_DIRECTORY, "package-consumer.mjs")).href}?test=${stamp}`
    ),
    import(pathToFileURL(path.join(WORKSPACE_ROOT, "packages/catalog-sdk/dist/index.js")).href),
    import(pathToFileURL(path.join(WORKSPACE_ROOT, "packages/validator/dist/index.js")).href),
  ]);
  return {
    parityApi: parityConsumer.parityApi,
    componentApi,
    operationsApi,
    hostOperationsApi,
    packageRootApi,
    catalogSdkApi,
    validatorApi,
  };
}

function injected(options = {}) {
  return buildReferenceCatalogWebParityEvidence({
    ...options,
    verifyPrerequisites: false,
  });
}

function expectEvidenceFailure(error, code) {
  assert.ok(error instanceof ReferenceCatalogWebParityEvidenceError);
  if (code !== undefined) assert.equal(error.code, code);
  return true;
}

function deepFreeze(value) {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function") ||
    Object.isFrozen(value)
  ) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function mutableMetadata(parityApi) {
  return JSON.parse(JSON.stringify(parityApi.REFERENCE_WEB_IMPLEMENTATION_METADATA));
}

function parityApiFrom(metadata) {
  return Object.freeze({ REFERENCE_WEB_IMPLEMENTATION_METADATA: deepFreeze(metadata) });
}

async function temporaryDirectory() {
  return mkdtemp(path.join(os.tmpdir(), "desen-m03-t09-proof-"));
}

async function mutatedCopy(sourcePath, directory, name, mutate) {
  const destination = path.join(directory, name);
  await writeFile(destination, mutate(await readFile(sourcePath, "utf8")));
  return destination;
}

test("accepts the tracked deterministic M03-T09 evidence", async () => {
  const result = await verifyReferenceCatalogWebParityEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.provenanceMode, "tracked-defaults");
  assert.equal(result.components, 5);
  assert.equal(result.operations, 1);
  assert.equal(result.resolvedContractVectors, 3);
  assert.equal(result.packageTests, 26);
  assert.equal(result.rootTests, 14);
  assert.equal(result.typeNegativeCases, 10);
  assert.equal(result.trackedFiles, 23);
  assert.equal(result.proofMatrixStatus, "P-06 PARTIAL");
  assert.equal(result.normativeStatus, "S-004 TESTED");
});

test("builds byte-identical injected evidence twice", async () => {
  const [first, second] = await Promise.all([injected(), injected()]);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.evidence.provenance.mode, "injected-test");
  assert.equal(first.artifact.prerequisite.packageDigest.result, "SKIPPED");
  assert.equal(first.artifact.prerequisite.signIn.result, "SKIPPED");
  assert.equal(first.artifact.catalogScope.officialCatalogRepublished, false);
});

test("keeps unrelated normative and root-script growth outside task-owned evidence bytes", async () => {
  const directory = await temporaryDirectory();
  const { parityApi, componentApi, operationsApi, hostOperationsApi, packageRootApi } =
    await loadApis();
  const normativeCoverage = await readFile(
    path.join(WORKSPACE_ROOT, "docs/proof/NORMATIVE-COVERAGE.md"),
    "utf8",
  );
  const rootPackage = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  const parityIndex = await readFile(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/parity/index.ts"),
    "utf8",
  );
  const baselineNormativePath = path.join(directory, "normative-baseline.md");
  const grownNormativePath = path.join(directory, "normative-grown.md");
  const baselineRootPackagePath = path.join(directory, "root-package-baseline.json");
  const grownRootPackagePath = path.join(directory, "root-package-grown.json");
  const baselineParityIndexPath = path.join(directory, "parity-index-baseline.ts");
  const grownParityIndexPath = path.join(directory, "parity-index-grown.ts");
  await Promise.all([
    writeFile(baselineNormativePath, normativeCoverage),
    writeFile(
      grownNormativePath,
      `${normativeCoverage}\n| N-999 | Future owner | PLANNED | M99-T99 |\n`,
    ),
    writeFile(baselineRootPackagePath, `${JSON.stringify(rootPackage)}\n`),
    writeFile(baselineParityIndexPath, parityIndex),
    writeFile(
      grownParityIndexPath,
      `${parityIndex}\nexport { FUTURE_PARITY_HELPER } from "./future-parity.js";\n`,
    ),
  ]);
  rootPackage.scripts["future:unrelated-root-task"] = "node future-root-task.mjs";
  await writeFile(grownRootPackagePath, `${JSON.stringify(rootPackage)}\n`);

  const [baseline, grown] = await Promise.all([
    injected({
      componentApi,
      hostOperationsApi,
      normativeCoveragePath: baselineNormativePath,
      operationsApi,
      packageRootApi,
      parityApi,
      parityIndexSourcePath: baselineParityIndexPath,
      rootPackagePath: baselineRootPackagePath,
    }),
    injected({
      componentApi: Object.freeze({
        ...componentApi,
        futureComponentRegistration: Object.freeze({}),
      }),
      hostOperationsApi: Object.freeze({
        ...hostOperationsApi,
        bindFutureHostOperation: () => undefined,
      }),
      normativeCoveragePath: grownNormativePath,
      operationsApi: Object.freeze({
        ...operationsApi,
        futureOperationRegistration: Object.freeze({}),
      }),
      packageRootApi: Object.freeze({
        ...packageRootApi,
        futurePackageHelper: () => undefined,
      }),
      parityApi: Object.freeze({
        ...parityApi,
        FUTURE_PARITY_HELPER: () => undefined,
      }),
      parityIndexSourcePath: grownParityIndexPath,
      rootPackagePath: grownRootPackagePath,
    }),
  ]);
  assert.deepEqual(grown.artifactBytes, baseline.artifactBytes);
  assert.equal(
    Object.hasOwn(baseline.artifact.evidence.claimDocuments, "normativeCoverage"),
    false,
  );
  const trackedPaths = baseline.artifact.evidence.trackedFiles.map(
    ({ path: trackedPath }) => trackedPath,
  );
  for (const excludedPath of [
    "docs/architecture/ARCHITECTURE.md",
    "docs/plan/PROTOCOL-FINDINGS.md",
    "docs/proof/NORMATIVE-COVERAGE.md",
    "packages/reference-catalog-web/README.md",
    "packages/reference-catalog-web/package.json",
    "packages/reference-catalog-web/src/components/index.ts",
    "packages/reference-catalog-web/src/host-operations/index.ts",
    "packages/reference-catalog-web/src/operations/index.ts",
    "packages/reference-catalog-web/src/parity/index.ts",
    "package.json",
    "pnpm-lock.yaml",
  ]) {
    assert.equal(trackedPaths.includes(excludedPath), false);
  }
});

test("rejects unsafe or unknown build options without invoking accessors", async () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "parityApi", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  for (const options of [
    accessor,
    Object.create({ parityApi: {} }),
    { [Symbol("parityApi")]: {} },
    { unknown: true },
  ]) {
    await assert.rejects(buildReferenceCatalogWebParityEvidence(options), (error) =>
      expectEvidenceFailure(error, "REFERENCE_PARITY_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
});

test("rejects stale and one-byte-tampered evidence", async () => {
  const result = await injected();
  const tampered = Buffer.from(result.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyReferenceCatalogWebParityEvidence({
      artifactBytes: tampered,
      verifyPrerequisites: false,
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_ARTIFACT_DRIFT"),
  );
});

test("rejects missing mismatched and skipped prerequisites for tracked evidence", async () => {
  const directory = await temporaryDirectory();
  await assert.rejects(
    buildReferenceCatalogWebParityEvidence({
      packageDigestArtifactPath: path.join(directory, "missing.json"),
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_PREREQUISITE_DRIFT"),
  );

  const source = path.join(
    WORKSPACE_ROOT,
    "docs/proof/artifacts/reference-sign-in-fixtures-and-host-binding.json",
  );
  const mismatched = JSON.parse(await readFile(source, "utf8"));
  mismatched.task = "M03-T07";
  const mismatchedPath = path.join(directory, "mismatched.json");
  await writeFile(mismatchedPath, `${JSON.stringify(mismatched)}\n`);
  await assert.rejects(
    buildReferenceCatalogWebParityEvidence({ signInArtifactPath: mismatchedPath }),
    (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    verifyReferenceCatalogWebParityEvidence({ verifyPrerequisites: false }),
    (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_NONDEFAULT_TRACKED_VERIFY"),
  );
});

test("rejects missing extra wrong-category and renamed component surfaces", async () => {
  const { parityApi } = await loadApis();
  const mutations = [
    (metadata) => {
      metadata.components["com.example.ui/Button"].declared.events = [];
    },
    (metadata) => {
      metadata.components["com.example.ui/Button"].declared.props.push("forged");
    },
    (metadata) => {
      metadata.behaviors["com.example.ui/Button"] = metadata.components["com.example.ui/Button"];
    },
    (metadata) => {
      metadata.components["com.example.ui/TextField"].trustedBindings.events.change = "onInput";
    },
  ];
  for (const mutate of mutations) {
    const metadata = mutableMetadata(parityApi);
    mutate(metadata);
    await assert.rejects(injected({ parityApi: parityApiFrom(metadata) }), (error) =>
      expectEvidenceFailure(error),
    );
  }
});

test("rejects authoring-production identity and operation-binding drift", async () => {
  const { parityApi, componentApi, hostOperationsApi } = await loadApis();
  const fidelity = mutableMetadata(parityApi);
  fidelity.components["com.example.ui/Button"].authoringExport = "Text";
  await assert.rejects(injected({ parityApi: parityApiFrom(fidelity) }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_FIDELITY_DRIFT"),
  );

  const detachedComponentApi = Object.freeze({
    ...componentApi,
    Button: function ButtonReplacement() {
      return undefined;
    },
  });
  const identity = mutableMetadata(parityApi);
  identity.components["com.example.ui/Button"].productionExport = "Button";
  identity.components["com.example.ui/Button"].authoringExport = "Text";
  await assert.rejects(
    injected({
      parityApi: parityApiFrom(identity),
      componentApi: detachedComponentApi,
    }),
    (error) => expectEvidenceFailure(error),
  );

  const operation = mutableMetadata(parityApi);
  operation.operations["com.example.auth/signIn"].binding = "embedded";
  await assert.rejects(injected({ parityApi: parityApiFrom(operation) }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_OPERATION_BINDING_DRIFT"),
  );
  await assert.rejects(
    injected({
      hostOperationsApi: Object.freeze({
        ...hostOperationsApi,
        bindReferenceSignInHostOperation: "not-a-function",
      }),
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_OPERATION_BINDING_DRIFT"),
  );
});

test("rejects executable or loader-bearing parity metadata", async () => {
  const { parityApi } = await loadApis();
  const loader = mutableMetadata(parityApi);
  loader.components["com.example.ui/Button"].loader = "./forged.js";
  await assert.rejects(injected({ parityApi: parityApiFrom(loader) }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXECUTABLE_METADATA"),
  );

  const synonymousLoader = mutableMetadata(parityApi);
  synonymousLoader.components["com.example.ui/Button"].importSpecifier = "../components/index.js";
  await assert.rejects(injected({ parityApi: parityApiFrom(synonymousLoader) }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_METADATA_DRIFT"),
  );

  const hiddenExecutable = mutableMetadata(parityApi);
  Object.defineProperty(hiddenExecutable.components["com.example.ui/Button"], "hiddenHandler", {
    value: () => undefined,
    enumerable: false,
  });
  await assert.rejects(injected({ parityApi: parityApiFrom(hiddenExecutable) }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXECUTABLE_METADATA"),
  );

  const symbolExecutable = mutableMetadata(parityApi);
  symbolExecutable.components["com.example.ui/Button"][Symbol("hiddenHandler")] = () => undefined;
  await assert.rejects(injected({ parityApi: parityApiFrom(symbolExecutable) }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXECUTABLE_METADATA"),
  );

  let getterCalls = 0;
  const accessorExecutable = mutableMetadata(parityApi);
  Object.defineProperty(accessorExecutable.components["com.example.ui/Button"], "computedHandler", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return () => undefined;
    },
  });
  const accessorApi = parityApiFrom(accessorExecutable);
  getterCalls = 0;
  await assert.rejects(injected({ parityApi: accessorApi }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXECUTABLE_METADATA"),
  );
  assert.equal(getterCalls, 0);

  let proxyTrapCalls = 0;
  const proxiedMetadata = new Proxy(parityApi.REFERENCE_WEB_IMPLEMENTATION_METADATA, {
    getPrototypeOf(target) {
      proxyTrapCalls += 1;
      return Reflect.getPrototypeOf(target);
    },
  });
  await assert.rejects(
    injected({
      parityApi: Object.freeze({
        REFERENCE_WEB_IMPLEMENTATION_METADATA: proxiedMetadata,
      }),
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_EXECUTABLE_METADATA"),
  );
  assert.equal(proxyTrapCalls, 0);

  const executable = mutableMetadata(parityApi);
  executable.operations["com.example.auth/signIn"].handler = () => undefined;
  await assert.rejects(injected({ parityApi: parityApiFrom(executable) }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXECUTABLE_METADATA"),
  );
});

test("rejects official registration and validator-contract drift", async () => {
  const { componentApi, validatorApi } = await loadApis();
  const registration = componentApi.buttonComponentRegistration;
  const registrationDrift = deepFreeze({
    ...componentApi,
    buttonComponentRegistration: {
      ...registration,
      manifest: {
        ...registration.manifest,
        propsSchema: {
          ...registration.manifest.propsSchema,
          properties: {
            ...registration.manifest.propsSchema.properties,
            forged: { type: "string" },
          },
        },
      },
    },
  });
  await assert.rejects(injected({ componentApi: registrationDrift }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_OFFICIAL_DRIFT"),
  );

  const weakenedValidator = Object.freeze({
    validateDesenExecutionCatalogSet: validatorApi.validateDesenExecutionCatalogSet,
    validateDesenExecutionValue: validatorApi.validateDesenExecutionValue,
    validateDesenEventPayload(payload, selector, prepared) {
      if (payload?.extra === true) {
        return Object.freeze({
          valid: true,
          target: "event-payload",
          value: Object.freeze({ ...payload }),
          diagnostics: Object.freeze([]),
        });
      }
      return validatorApi.validateDesenEventPayload(payload, selector, prepared);
    },
  });
  await assert.rejects(injected({ validatorApi: weakenedValidator }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_VALIDATOR_DRIFT"),
  );
});

test("rejects public export and transitive source-boundary drift", async () => {
  const directory = await temporaryDirectory();
  const metadataSourcePath = await mutatedCopy(
    path.join(
      WORKSPACE_ROOT,
      "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
    ),
    directory,
    "metadata.ts",
    (source) => source.replace('"../components/contracts.js"', '"../components/index.js"'),
  );
  await assert.rejects(injected({ metadataSourcePath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_SOURCE_DRIFT"),
  );

  const sideEffectSourcePath = await mutatedCopy(
    path.join(
      WORKSPACE_ROOT,
      "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
    ),
    directory,
    "side-effect.ts",
    (source) =>
      `${source}\nObject.defineProperty(globalThis, "__desenParitySideEffect", { value: true });\n`,
  );
  await assert.rejects(injected({ metadataSourcePath: sideEffectSourcePath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_SOURCE_DRIFT"),
  );

  const initializerSideEffectPath = await mutatedCopy(
    path.join(
      WORKSPACE_ROOT,
      "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
    ),
    directory,
    "initializer-side-effect.ts",
    (source) => `${source}\nconst observableSideEffect = console.log("desen-proof-bypass");\n`,
  );
  await assert.rejects(injected({ metadataSourcePath: initializerSideEffectPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_SOURCE_DRIFT"),
  );

  const assignmentSideEffectPath = await mutatedCopy(
    path.join(
      WORKSPACE_ROOT,
      "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
    ),
    directory,
    "assignment-side-effect.ts",
    (source) =>
      source.replace(
        "function immutableMetadata<Value>(value: Value): Value {",
        "function immutableMetadata<Value>(value: Value): Value {\n  Math.random = () => 0;",
      ),
  );
  await assert.rejects(injected({ metadataSourcePath: assignmentSideEffectPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_SOURCE_DRIFT"),
  );

  const reExportSourcePath = await mutatedCopy(
    path.join(
      WORKSPACE_ROOT,
      "packages/reference-catalog-web/src/parity/reference-web-implementation-metadata.ts",
    ),
    directory,
    "react-reexport.ts",
    (source) => `${source}\nexport { createElement as hidden } from "react";\n`,
  );
  await assert.rejects(injected({ metadataSourcePath: reExportSourcePath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_SOURCE_DRIFT"),
  );

  const parityIndexSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/parity/index.ts"),
    directory,
    "index.ts",
    (source) => `${source}\nexport * from "../components/index.js";\n`,
  );
  await assert.rejects(injected({ parityIndexSourcePath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXPORT_DRIFT"),
  );

  const localExecutableExportPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/parity/index.ts"),
    directory,
    "local-export.ts",
    (source) => `${source}\nexport function forgedExecutableExport() {}\n`,
  );
  await assert.rejects(injected({ parityIndexSourcePath: localExecutableExportPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXPORT_DRIFT"),
  );

  const aliasedTypeExportPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/parity/index.ts"),
    directory,
    "aliased-type-export.ts",
    (source) =>
      source.replace(
        "ReferenceWebStylePartPresence,",
        "ReferenceWebAccessibilityContract as ReferenceWebStylePartPresence,",
      ),
  );
  await assert.rejects(injected({ parityIndexSourcePath: aliasedTypeExportPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_EXPORT_DRIFT"),
  );

  const packageRootIndexSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/index.ts"),
    directory,
    "root.ts",
    (source) =>
      `${source}\nexport { REFERENCE_WEB_IMPLEMENTATION_METADATA } from "./parity/index.js";\n`,
  );
  await assert.rejects(injected({ packageRootIndexSourcePath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_ROOT_LEAK"),
  );
});

test("rejects package-test type-negative trace and command-wiring drift", async () => {
  const directory = await temporaryDirectory();
  const normativeCoverage = await readFile(
    path.join(WORKSPACE_ROOT, "docs/proof/NORMATIVE-COVERAGE.md"),
    "utf8",
  );
  const compatibility = verifyReferenceCatalogWebParityNormativeCompatibility(normativeCoverage);
  assert.deepEqual(compatibility.historicalProjection, [
    { id: "N-030", status: "PLANNED" },
    { id: "N-033", status: "PLANNED" },
    { id: "N-034", status: "PLANNED" },
    { id: "S-001", status: "PLANNED" },
    { id: "S-004", status: "TESTED" },
  ]);
  assert.equal(compatibility.currentStatuses.find(({ id }) => id === "N-033")?.status, "TESTED");
  assert.equal(compatibility.currentStatuses.find(({ id }) => id === "N-034")?.status, "TESTED");
  const withNormativeStatus = (id, status) =>
    normativeCoverage
      .split("\n")
      .map((line) => {
        if (!line.startsWith(`| ${id} `)) return line;
        const cells = line.split("|");
        cells[5] = ` ${status} `;
        return cells.join("|");
      })
      .join("\n");
  for (const id of ["N-033", "N-034"]) {
    assert.doesNotThrow(() =>
      verifyReferenceCatalogWebParityNormativeCompatibility(withNormativeStatus(id, "PLANNED")),
    );
    for (const invalidStatus of ["NOT_STARTED", "IMPLEMENTED"]) {
      assert.throws(
        () =>
          verifyReferenceCatalogWebParityNormativeCompatibility(
            withNormativeStatus(id, invalidStatus),
          ),
        (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_CLAIM_DRIFT"),
      );
    }
  }
  const foundationTestPath = await mutatedCopy(
    path.join(PACKAGE_TEST_DIRECTORY, "foundation-components.test.tsx"),
    directory,
    "foundation.test.tsx",
    (source) =>
      source.replace("registers exact closed public contracts", "registers widened contracts"),
  );
  await assert.rejects(injected({ foundationTestPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_TEST_INVENTORY_DRIFT"),
  );

  const typeTestPath = await mutatedCopy(
    path.join(PACKAGE_TEST_DIRECTORY, "parity-metadata.types.ts"),
    directory,
    "parity.types.ts",
    (source) => source.replace("M03-T09-N10", "M03-T09-N99"),
  );
  await assert.rejects(injected({ typeTestPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_TYPE_INVENTORY_DRIFT"),
  );

  const traceabilityPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "docs/proof/protocol-0.1.0-traceability.json"),
    directory,
    "traceability.json",
    (source) => source.replace('"C-017"', '"C-999"'),
  );
  await assert.rejects(injected({ traceabilityPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_TRACE_DRIFT"),
  );

  const proofDocumentPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "docs/proof/REFERENCE-CATALOG-WEB-PARITY.md"),
    directory,
    "proof.md",
    (source) =>
      source.replace("both normative rows remain `PLANNED`", "both normative rows become `TESTED`"),
  );
  await assert.rejects(injected({ proofDocumentPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_CLAIM_DRIFT"),
  );

  const normativeCoveragePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "docs/proof/NORMATIVE-COVERAGE.md"),
    directory,
    "normative.md",
    (source) =>
      source
        .split("\n")
        .map((line) => (line.startsWith("| S-001 ") ? line.replace("| PLANNED", "| TESTED") : line))
        .join("\n"),
  );
  await assert.rejects(injected({ normativeCoveragePath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_CLAIM_DRIFT"),
  );

  const proofMatrixPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md"),
    directory,
    "proof-matrix.md",
    (source) =>
      source
        .split("\n")
        .map((line) => (line.startsWith("| P-06 ") ? line.replace("| PARTIAL", "| PROVEN") : line))
        .join("\n"),
  );
  await assert.rejects(injected({ proofMatrixPath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_CLAIM_DRIFT"),
  );

  const rootPackagePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "package.json"),
    directory,
    "package.json",
    (source) => {
      const parsed = JSON.parse(source);
      parsed.scripts["verify:reference-catalog-web-parity"] = "node forged.mjs";
      return `${JSON.stringify(parsed)}\n`;
    },
  );
  await assert.rejects(injected({ rootPackagePath }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_COMMAND_DRIFT"),
  );
});

test("rejects tracked-artifact verification through a symlink alias", async () => {
  const directory = await temporaryDirectory();
  const alias = path.join(directory, "alias.json");
  await symlink(DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH, alias);
  await assert.rejects(verifyReferenceCatalogWebParityEvidence({ artifactPath: alias }), (error) =>
    expectEvidenceFailure(error, "REFERENCE_PARITY_TRACKED_ALIAS_REJECTED"),
  );
});

test("writes injected evidence atomically and detects temporary-byte tampering", async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeReferenceCatalogWebParityEvidence({
    artifactPath,
    buildOptions: { verifyPrerequisites: false },
  });
  assert.deepEqual(await readFile(artifactPath), result.artifactBytes);
  const verified = await verifyReferenceCatalogWebParityEvidence({
    artifactPath,
    verifyPrerequisites: false,
  });
  assert.equal(verified.result, "PASS");

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writeReferenceCatalogWebParityEvidence({
      artifactPath: tamperedPath,
      buildOptions: { verifyPrerequisites: false },
      async beforeAtomicRename({ temporaryPath }) {
        await writeFile(temporaryPath, "{}\n");
      },
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_PARITY_ARTIFACT_WRITE_FAILED"),
  );
});
