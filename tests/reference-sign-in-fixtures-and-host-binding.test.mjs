import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildReferenceSignInFixturesAndHostBindingEvidence,
  DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH,
  ReferenceSignInFixturesAndHostBindingEvidenceError,
  verifyReferenceSignInFixturesAndHostBindingEvidence,
  writeReferenceSignInFixturesAndHostBindingEvidence,
} from "../scripts/lib/reference-sign-in-fixtures-and-host-binding-proof.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TEST_DIRECTORY, "..");
const OPERATIONS_CONSUMER_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/operations-consumer.mjs",
);
const HOST_OPERATIONS_CONSUMER_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/host-operations-consumer.mjs",
);
const TESTKIT_CONSUMER_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/testkit/test/synthetic-fixtures-consumer.mjs",
);
const VALIDATOR_API_PATH = path.join(WORKSPACE_ROOT, "packages/validator/dist/index.js");
const PREREQUISITE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-tokens-and-synthetic-fixtures.json",
);

async function loadApis() {
  const [operationsApi, hostOperationsApi, testkitApi, validatorApi] = await Promise.all([
    import(`${pathToFileURL(OPERATIONS_CONSUMER_PATH).href}?root-test=${Date.now()}`),
    import(`${pathToFileURL(HOST_OPERATIONS_CONSUMER_PATH).href}?root-test=${Date.now()}`),
    import(`${pathToFileURL(TESTKIT_CONSUMER_PATH).href}?root-test=${Date.now()}`),
    import(pathToFileURL(VALIDATOR_API_PATH).href),
  ]);
  return { operationsApi, hostOperationsApi, testkitApi, validatorApi };
}

function injected(options = {}) {
  return buildReferenceSignInFixturesAndHostBindingEvidence({
    ...options,
    verifyPrerequisite: false,
  });
}

async function temporaryDirectory() {
  return mkdtemp(path.join(os.tmpdir(), "desen-m03-t08-proof-"));
}

async function mutatedCopy(sourcePath, directory, name, mutate) {
  const destination = path.join(directory, name);
  const source = await readFile(sourcePath, "utf8");
  await writeFile(destination, mutate(source));
  return destination;
}

function expectEvidenceFailure(error, code) {
  assert.ok(error instanceof ReferenceSignInFixturesAndHostBindingEvidenceError);
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

function createAliasingTestkitApi(testkitApi, aliasKind) {
  function createSyntheticFixtureSnapshot(input) {
    const registration = input.operations[0];
    const fixtures = registration.manifest.authoring.fixtures;
    const success =
      aliasKind === "success" ? fixtures.success : deepFreeze({ ...fixtures.success });
    const invalidCredentials =
      aliasKind === "error"
        ? fixtures.errors.invalidCredentials
        : deepFreeze({ ...fixtures.errors.invalidCredentials });
    return deepFreeze({
      context: input.context,
      operations: {
        [registration.id]: {
          errors: { invalidCredentials },
          success,
        },
      },
      resources: {},
    });
  }

  function lookupSyntheticOperationSuccess(snapshot, operationId) {
    const value = snapshot.operations[operationId]?.success;
    return value === undefined
      ? deepFreeze({ context: snapshot.context, status: "missing" })
      : deepFreeze({ context: snapshot.context, status: "found", value });
  }

  function lookupSyntheticOperationError(snapshot, operationId, errorCode) {
    const errors = snapshot.operations[operationId]?.errors;
    return errors !== undefined && Object.hasOwn(errors, errorCode)
      ? deepFreeze({
          context: snapshot.context,
          status: "found",
          value: errors[errorCode],
        })
      : deepFreeze({ context: snapshot.context, status: "missing" });
  }

  return Object.freeze({
    SYNTHETIC_FIXTURE_CONTEXT: testkitApi.SYNTHETIC_FIXTURE_CONTEXT,
    createSyntheticFixtureSnapshot,
    lookupSyntheticOperationError,
    lookupSyntheticOperationSuccess,
  });
}

test("accepts the tracked deterministic M03-T08 evidence", async () => {
  const result = await verifyReferenceSignInFixturesAndHostBindingEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.provenanceMode, "tracked-defaults");
  assert.equal(result.operationId, "com.example.auth/signIn");
  assert.equal(result.packageTests, 5);
  assert.equal(result.rootTests, 13);
  assert.equal(result.typeNegativeCases, 10);
  assert.equal(result.trackedFiles, 21);
  assert.equal(result.proofMatrixStatus, "P-10 PARTIAL");
});

test("builds byte-identical evidence twice", async () => {
  const [first, second] = await Promise.all([injected(), injected()]);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.evidence.provenance.mode, "injected-test");
  assert.equal(first.artifact.prerequisite.result, "SKIPPED");
  assert.equal(first.artifact.operation.pendingFixtureClaimed, false);
});

test("labels explicit build options as injected evidence", async () => {
  const { operationsApi } = await loadApis();
  const result = await injected({ operationsApi });
  assert.equal(result.artifact.evidence.provenance.mode, "injected-test");
  assert.deepEqual(result.artifact.evidence.provenance.overrides, [
    "operationsApi",
    "verifyPrerequisite",
  ]);
});

test("rejects inherited accessor-backed symbolic and unknown options", async () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "operationsApi", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  const inherited = Object.create({ operationsApi: {} });
  const symbolic = { [Symbol("operationsApi")]: {} };
  for (const options of [accessor, inherited, symbolic, { unknown: true }]) {
    await assert.rejects(buildReferenceSignInFixturesAndHostBindingEvidence(options), (error) =>
      expectEvidenceFailure(error, "SIGN_IN_BINDING_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const result = await injected();
  const tampered = Buffer.from(result.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyReferenceSignInFixturesAndHostBindingEvidence({
      artifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    (error) => expectEvidenceFailure(error, "SIGN_IN_BINDING_ARTIFACT_DRIFT"),
  );
});

test("rejects missing mismatched or skipped M03-T07 prerequisite evidence", async () => {
  const directory = await temporaryDirectory();
  const missingPath = path.join(directory, "missing.json");
  await assert.rejects(
    buildReferenceSignInFixturesAndHostBindingEvidence({
      prerequisiteArtifactPath: missingPath,
    }),
    (error) => expectEvidenceFailure(error, "SIGN_IN_BINDING_PREREQUISITE_DRIFT"),
  );

  const prerequisite = JSON.parse(await readFile(PREREQUISITE_PATH, "utf8"));
  prerequisite.task = "M03-T06";
  const mismatchedPath = path.join(directory, "mismatched.json");
  await writeFile(mismatchedPath, `${JSON.stringify(prerequisite)}\n`);
  await assert.rejects(
    buildReferenceSignInFixturesAndHostBindingEvidence({
      prerequisiteArtifactPath: mismatchedPath,
    }),
    (error) => expectEvidenceFailure(error, "SIGN_IN_BINDING_PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    verifyReferenceSignInFixturesAndHostBindingEvidence({
      verifyPrerequisite: false,
    }),
    (error) => expectEvidenceFailure(error, "SIGN_IN_BINDING_NONDEFAULT_TRACKED_VERIFY"),
  );
});

test("rejects official manifest or fixture drift", async () => {
  const { operationsApi, testkitApi } = await loadApis();
  const manifestDrift = deepFreeze({
    ...operationsApi,
    signInOperationRegistration: {
      ...operationsApi.signInOperationRegistration,
      manifest: {
        ...operationsApi.signInOperationRegistration.manifest,
        effect: "local",
      },
    },
  });
  await assert.rejects(injected({ operationsApi: manifestDrift }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_MANIFEST_DRIFT"),
  );

  const fixtureDrift = deepFreeze({
    ...operationsApi,
    signInOperationFixtures: {
      ...operationsApi.signInOperationFixtures,
      success: { userId: "user-2" },
    },
  });
  await assert.rejects(injected({ operationsApi: fixtureDrift }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_FIXTURE_IDENTITY_DRIFT"),
  );

  const detachedFixtureExport = deepFreeze({
    ...operationsApi,
    signInOperationFixtures: {
      errors: {
        invalidCredentials: {},
      },
      success: {
        userId: "user-1",
      },
    },
  });
  await assert.rejects(injected({ operationsApi: detachedFixtureExport }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_FIXTURE_IDENTITY_DRIFT"),
  );

  for (const aliasKind of ["success", "error"]) {
    await assert.rejects(
      injected({ testkitApi: createAliasingTestkitApi(testkitApi, aliasKind) }),
      (error) => expectEvidenceFailure(error, "SIGN_IN_BINDING_FIXTURE_ALIAS_DRIFT"),
    );
  }

  const directory = await temporaryDirectory();
  const officialCatalogPath = await mutatedCopy(
    path.join(
      WORKSPACE_ROOT,
      "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
    ),
    directory,
    "catalog.json",
    (source) => source.replace('"userId": "user-1"', '"userId": "user-9"'),
  );
  await assert.rejects(injected({ officialCatalogPath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_MANIFEST_DRIFT"),
  );
});

test("rejects host binding identity invocation or guardrail drift", async () => {
  const { hostOperationsApi } = await loadApis();
  const wrapped = Object.freeze({
    ...hostOperationsApi,
    bindReferenceSignInHostOperation(handler) {
      return Object.freeze({
        operationId: "com.example.auth/signIn",
        invoke: (...args) => handler(...args),
      });
    },
  });
  const wrongId = Object.freeze({
    ...hostOperationsApi,
    bindReferenceSignInHostOperation(handler) {
      return Object.freeze({
        operationId: "com.example.auth/other",
        invoke: handler,
      });
    },
  });
  const permissive = Object.freeze({
    ...hostOperationsApi,
    bindReferenceSignInHostOperation(handler) {
      return Object.freeze({
        operationId: "com.example.auth/signIn",
        invoke: handler,
      });
    },
  });
  for (const mutatedApi of [wrapped, wrongId, permissive]) {
    await assert.rejects(injected({ hostOperationsApi: mutatedApi }), (error) =>
      expectEvidenceFailure(
        error,
        mutatedApi === permissive
          ? "SIGN_IN_BINDING_HANDLER_GUARD_DRIFT"
          : "SIGN_IN_BINDING_HANDLER_DRIFT",
      ),
    );
  }

  const eager = Object.freeze({
    ...hostOperationsApi,
    bindReferenceSignInHostOperation(handler) {
      void handler({
        email: "synthetic@example.invalid",
        password: "synthetic-passphrase",
      });
      return Object.freeze({
        operationId: "com.example.auth/signIn",
        invoke: handler,
      });
    },
  });
  await assert.rejects(injected({ hostOperationsApi: eager }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_HANDLER_DRIFT"),
  );
});

test("rejects public export package and source-boundary drift", async () => {
  const directory = await temporaryDirectory();
  const operationDeclarationPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist/operations/index.d.ts"),
    directory,
    "operations.d.ts",
    (source) => source.replace("signInOperationFixtures", "signInFixturesRemoved"),
  );
  await assert.rejects(injected({ operationDeclarationPath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_EXPORT_DRIFT"),
  );

  const operationIndexSource = path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/operations/index.ts",
  );
  for (const [name, mutate] of [
    ["operation-export-star.ts", (source) => `${source}\nexport * from "./sign-in.js";\n`],
    ["operation-default.ts", (source) => `${source}\nexport default function () {}\n`],
    ["operation-extra.ts", (source) => `${source}\nexport const executableLeak = () => {};\n`],
    ["operation-side-effect.ts", (source) => `import "./sign-in.js";\n${source}`],
    [
      "operation-hidden-edge.ts",
      (source) => `${source}\nexport {} from "./executable-relative-module.js";\n`,
    ],
  ]) {
    const operationIndexSourcePath = await mutatedCopy(
      operationIndexSource,
      directory,
      name,
      mutate,
    );
    await assert.rejects(injected({ operationIndexSourcePath }), (error) =>
      expectEvidenceFailure(error, "SIGN_IN_BINDING_EXPORT_DRIFT"),
    );
  }

  const operationsConsumerSource = path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/operations-consumer.mjs",
  );
  const { operationsApi } = await loadApis();
  for (const [name, mutate] of [
    [
      "operations-consumer-star.mjs",
      () => 'export * from "@desen/reference-catalog-web/operations";\n',
    ],
    [
      "operations-consumer-side-effect.mjs",
      (source) => `import "@desen/reference-catalog-web/operations";\n${source}`,
    ],
  ]) {
    const operationsConsumerPath = await mutatedCopy(
      operationsConsumerSource,
      directory,
      name,
      mutate,
    );
    await assert.rejects(injected({ operationsApi, operationsConsumerPath }), (error) =>
      expectEvidenceFailure(error, "SIGN_IN_BINDING_PACKAGE_CONSUMER_DRIFT"),
    );
  }

  for (const operationsApiDrift of [
    Object.freeze({ ...operationsApi, default: () => undefined }),
    Object.freeze({ ...operationsApi, executableLeak: () => undefined }),
  ]) {
    await assert.rejects(injected({ operationsApi: operationsApiDrift }), (error) =>
      expectEvidenceFailure(error, "SIGN_IN_BINDING_PUBLIC_API_DRIFT"),
    );
  }

  const referencePackageSource = await readFile(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/package.json"),
    "utf8",
  );
  const referencePackage = JSON.parse(referencePackageSource);
  referencePackage.exports["./host-operations"].import = "./dist/operations/index.js";
  const referencePackagePath = path.join(directory, "package.json");
  await writeFile(referencePackagePath, `${JSON.stringify(referencePackage)}\n`);
  await assert.rejects(injected({ referencePackagePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_PACKAGE_EXPORT_DRIFT"),
  );

  const rootLeakingPackage = JSON.parse(referencePackageSource);
  rootLeakingPackage.exports["."].import = "./dist/operations/index.js";
  const rootLeakingPackagePath = path.join(directory, "root-leaking-package.json");
  await writeFile(rootLeakingPackagePath, `${JSON.stringify(rootLeakingPackage)}\n`);
  await assert.rejects(injected({ referencePackagePath: rootLeakingPackagePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_PACKAGE_EXPORT_DRIFT"),
  );

  const alternateConditionPackage = JSON.parse(referencePackageSource);
  alternateConditionPackage.exports["./operations"].default = "./dist/operations/index.js";
  const alternateConditionPackagePath = path.join(directory, "alternate-condition-package.json");
  await writeFile(alternateConditionPackagePath, `${JSON.stringify(alternateConditionPackage)}\n`);
  await assert.rejects(injected({ referencePackagePath: alternateConditionPackagePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_PACKAGE_EXPORT_DRIFT"),
  );

  const packageRootIndexSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/index.ts"),
    directory,
    "package-root-index.ts",
    (source) =>
      `${source}\nexport { signInOperationRegistration } from "./operations/sign-in.js";\n`,
  );
  await assert.rejects(injected({ packageRootIndexSourcePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_PACKAGE_ROOT_LEAK"),
  );

  const operationSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/operations/sign-in.ts"),
    directory,
    "sign-in.ts",
    (source) => `import "@desen/testkit";\n${source}`,
  );
  await assert.rejects(injected({ operationSourcePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_IMPORT_BOUNDARY_DRIFT"),
  );

  const relativeOperationSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/operations/sign-in.ts"),
    directory,
    "sign-in-relative-import.ts",
    (source) =>
      `import { bindReferenceSignInHostOperation } from "../host-operations/sign-in.js";\n${source}`,
  );
  await assert.rejects(injected({ operationSourcePath: relativeOperationSourcePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT"),
  );

  const reExportingOperationSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/operations/sign-in.ts"),
    directory,
    "sign-in-relative-re-export.ts",
    (source) => `${source}\nexport {} from "./executable-relative-module.js";\n`,
  );
  await assert.rejects(injected({ operationSourcePath: reExportingOperationSourcePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT"),
  );

  const hostDeclarationPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist/host-operations/index.d.ts"),
    directory,
    "host-operations.d.ts",
    (source) => `${source}\nexport declare const signInOperationRegistration: unknown;\n`,
  );
  await assert.rejects(injected({ hostDeclarationPath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_EXPORT_DRIFT"),
  );

  const hostBindingSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/host-operations/sign-in.ts"),
    directory,
    "host-sign-in.ts",
    (source) => source.replace(") => unknown;", ") => Promise<unknown>;"),
  );
  await assert.rejects(injected({ hostBindingSourcePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_HOST_TYPE_DRIFT"),
  );
});

test("rejects package-test compiler-negative and root-test inventory drift", async () => {
  const directory = await temporaryDirectory();
  const packageTestPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/test/sign-in-operation.test.ts"),
    directory,
    "sign-in-operation.test.ts",
    (source) =>
      source.replace(
        "registers the exact inert sign-in contract and controlled authoring fixtures",
        "renamed sign-in test",
      ),
  );
  await assert.rejects(injected({ packageTestPath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_TEST_INVENTORY_DRIFT"),
  );

  const packageTypeTestPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/test/sign-in-operation.types.ts"),
    directory,
    "sign-in-operation.types.ts",
    (source) => source.replace("M03-T08-N10", "M03-T08-N99"),
  );
  await assert.rejects(injected({ packageTypeTestPath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_TYPE_INVENTORY_DRIFT"),
  );

  const rootTestPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "tests/reference-sign-in-fixtures-and-host-binding.test.mjs"),
    directory,
    "root.test.mjs",
    (source) =>
      source.replace("rejects official manifest or fixture drift", "renamed root mutation test"),
  );
  await assert.rejects(injected({ rootTestPath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects inert or incomplete root command wiring", async () => {
  const directory = await temporaryDirectory();
  const rootPackage = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  rootPackage.scripts["verify:reference-sign-in-fixtures-and-host-binding"] =
    "node scripts/verify-reference-sign-in-fixtures-and-host-binding.mjs";
  const rootPackagePath = path.join(directory, "package.json");
  await writeFile(rootPackagePath, `${JSON.stringify(rootPackage)}\n`);
  await assert.rejects(injected({ rootPackagePath }), (error) =>
    expectEvidenceFailure(error, "SIGN_IN_BINDING_ROOT_WIRING_DRIFT"),
  );
});

test("rejects tracked-artifact verification through a symlink alias", async () => {
  const directory = await temporaryDirectory();
  const alias = path.join(directory, "alias.json");
  await symlink(DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH, alias);
  await assert.rejects(
    verifyReferenceSignInFixturesAndHostBindingEvidence({ artifactPath: alias }),
    (error) => expectEvidenceFailure(error, "SIGN_IN_BINDING_TRACKED_ALIAS_REJECTED"),
  );
});

test("writes and verifies an injected artifact atomically and detects pre-rename tampering", async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "evidence.json");
  await writeReferenceSignInFixturesAndHostBindingEvidence({
    artifactPath,
    buildOptions: { verifyPrerequisite: false },
  });
  const verified = await verifyReferenceSignInFixturesAndHostBindingEvidence({
    artifactPath,
    verifyPrerequisite: false,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.provenanceMode, "injected-test");

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writeReferenceSignInFixturesAndHostBindingEvidence({
      artifactPath: tamperedPath,
      buildOptions: { verifyPrerequisite: false },
      async beforeAtomicRename({ temporaryPath }) {
        await writeFile(temporaryPath, "{}\n");
      },
    }),
    (error) => expectEvidenceFailure(error, "SIGN_IN_BINDING_ARTIFACT_WRITE_FAILED"),
  );

  const copiedPath = path.join(directory, "copied.json");
  await copyFile(artifactPath, copiedPath);
  const copied = await verifyReferenceSignInFixturesAndHostBindingEvidence({
    artifactPath: copiedPath,
    verifyPrerequisite: false,
  });
  assert.equal(copied.artifactSha256, verified.artifactSha256);
});
