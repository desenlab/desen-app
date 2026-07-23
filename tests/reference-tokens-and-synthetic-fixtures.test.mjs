import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildReferenceTokensAndSyntheticFixturesEvidence,
  DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH,
  ReferenceTokensAndSyntheticFixturesEvidenceError,
  verifyReferenceTokensAndSyntheticFixturesEvidence,
  writeReferenceTokensAndSyntheticFixturesEvidence,
} from "../scripts/lib/reference-tokens-and-synthetic-fixtures-proof.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TEST_DIRECTORY, "..");
const TOKEN_CONSUMER_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/tokens-consumer.mjs",
);
const TESTKIT_CONSUMER_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/testkit/test/synthetic-fixtures-consumer.mjs",
);
const CATALOG_API_PATH = path.join(WORKSPACE_ROOT, "packages/catalog-sdk/dist/index.js");
const PREREQUISITE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-catalog-web-form-feedback.json",
);

async function loadApis() {
  const [tokenApi, testkitApi, catalogApi] = await Promise.all([
    import(`${pathToFileURL(TOKEN_CONSUMER_PATH).href}?root-test=${Date.now()}`),
    import(`${pathToFileURL(TESTKIT_CONSUMER_PATH).href}?root-test=${Date.now()}`),
    import(pathToFileURL(CATALOG_API_PATH).href),
  ]);
  return { tokenApi, testkitApi, catalogApi };
}

function injected(options = {}) {
  return buildReferenceTokensAndSyntheticFixturesEvidence({
    ...options,
    verifyPrerequisite: false,
  });
}

async function temporaryDirectory() {
  return mkdtemp(path.join(os.tmpdir(), "desen-m03-t07-proof-"));
}

async function mutatedCopy(sourcePath, directory, name, mutate) {
  const destination = path.join(directory, name);
  const source = await readFile(sourcePath, "utf8");
  await writeFile(destination, mutate(source));
  return destination;
}

function expectEvidenceFailure(error, code) {
  assert.ok(error instanceof ReferenceTokensAndSyntheticFixturesEvidenceError);
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

test("accepts the tracked deterministic M03-T07 evidence", async () => {
  const result = await verifyReferenceTokensAndSyntheticFixturesEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.provenanceMode, "tracked-defaults");
  assert.equal(result.tokens, 26);
  assert.equal(result.componentCssProperties, 26);
  assert.equal(result.packageTests, 19);
  assert.equal(result.rootTests, 16);
  assert.equal(result.typeNegativeCases, 20);
  assert.equal(result.trackedFiles, 25);
});

test("builds byte-identical evidence twice", async () => {
  const [first, second] = await Promise.all([injected(), injected()]);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.evidence.provenance.mode, "injected-test");
  assert.equal(first.artifact.prerequisite.result, "SKIPPED");
});

test("labels explicit build options as injected evidence", async () => {
  const { tokenApi } = await loadApis();
  const result = await injected({ tokenApi });
  assert.equal(result.artifact.evidence.provenance.mode, "injected-test");
  assert.deepEqual(result.artifact.evidence.provenance.overrides, [
    "tokenApi",
    "verifyPrerequisite",
  ]);
});

test("rejects inherited accessor-backed symbolic and unknown options", async () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "tokenApi", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  const inherited = Object.create({ tokenApi: {} });
  const symbolic = { [Symbol("tokenApi")]: {} };
  for (const options of [accessor, inherited, symbolic, { unknown: true }]) {
    await assert.rejects(buildReferenceTokensAndSyntheticFixturesEvidence(options), (error) =>
      expectEvidenceFailure(error, "TOKEN_FIXTURE_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const result = await injected();
  const tampered = Buffer.from(result.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyReferenceTokensAndSyntheticFixturesEvidence({
      artifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    (error) => expectEvidenceFailure(error, "TOKEN_FIXTURE_ARTIFACT_DRIFT"),
  );
});

test("rejects missing mismatched or skipped M03-T06 prerequisite evidence", async () => {
  const directory = await temporaryDirectory();
  const missingPath = path.join(directory, "missing.json");
  await assert.rejects(
    buildReferenceTokensAndSyntheticFixturesEvidence({
      prerequisiteArtifactPath: missingPath,
    }),
    (error) => expectEvidenceFailure(error, "TOKEN_FIXTURE_PREREQUISITE_DRIFT"),
  );

  const prerequisite = JSON.parse(await readFile(PREREQUISITE_PATH, "utf8"));
  prerequisite.task = "M03-T05";
  const mismatchedPath = path.join(directory, "mismatched.json");
  await writeFile(mismatchedPath, `${JSON.stringify(prerequisite)}\n`);
  await assert.rejects(
    buildReferenceTokensAndSyntheticFixturesEvidence({
      prerequisiteArtifactPath: mismatchedPath,
    }),
    (error) => expectEvidenceFailure(error, "TOKEN_FIXTURE_PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    verifyReferenceTokensAndSyntheticFixturesEvidence({
      verifyPrerequisite: false,
    }),
    (error) => expectEvidenceFailure(error, "TOKEN_FIXTURE_NONDEFAULT_TRACKED_VERIFY"),
  );
});

test("rejects token path value property and reference inventory drift", async () => {
  const { tokenApi } = await loadApis();
  const valueDrift = Object.freeze({
    ...tokenApi,
    REFERENCE_WEB_TOKEN_VALUES: Object.freeze({
      ...tokenApi.REFERENCE_WEB_TOKEN_VALUES,
      "space.md": "9rem",
    }),
  });
  const propertyDrift = Object.freeze({
    ...tokenApi,
    REFERENCE_WEB_TOKEN_CSS_PROPERTIES: Object.freeze({
      ...tokenApi.REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
      "--desen-space-md": "9rem",
    }),
  });
  const referenceDrift = Object.freeze({
    ...tokenApi,
    REFERENCE_WEB_TOKEN_CSS_REFERENCES: Object.freeze({
      ...tokenApi.REFERENCE_WEB_TOKEN_CSS_REFERENCES,
      "space.md": "var(--desen-space-lg)",
    }),
  });
  for (const mutatedApi of [valueDrift, propertyDrift, referenceDrift]) {
    await assert.rejects(injected({ tokenApi: mutatedApi }), (error) =>
      expectEvidenceFailure(error, "TOKEN_FIXTURE_INVENTORY_DRIFT"),
    );
  }
});

test("rejects malformed or mutable DTCG and provider surfaces", async () => {
  const { tokenApi } = await loadApis();
  const mutableDocument = JSON.parse(JSON.stringify(tokenApi.REFERENCE_TOKEN_DOCUMENT));
  const documentDrift = Object.freeze({
    ...tokenApi,
    REFERENCE_TOKEN_DOCUMENT: mutableDocument,
  });
  const mutableProvider = {
    ...tokenApi.REFERENCE_WEB_TOKEN_PROVIDER,
  };
  const providerDrift = Object.freeze({
    ...tokenApi,
    REFERENCE_WEB_TOKEN_PROVIDER: mutableProvider,
  });
  await assert.rejects(injected({ tokenApi: documentDrift }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_MUTABILITY_DRIFT"),
  );
  await assert.rejects(injected({ tokenApi: providerDrift }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_MUTABILITY_DRIFT"),
  );
});

test("rejects a resolver that accepts unknown or prototype token names", async () => {
  const { tokenApi } = await loadApis();
  const permissive = Object.freeze({
    ...tokenApi,
    resolveReferenceWebToken(token) {
      if (token === "__proto__") {
        return Object.freeze({
          ok: true,
          token: "color.action.primary",
          value: "#1d4ed8",
          cssProperty: "--desen-color-action-primary",
          cssReference: "var(--desen-color-action-primary)",
        });
      }
      return tokenApi.resolveReferenceWebToken(token);
    },
  });
  await assert.rejects(injected({ tokenApi: permissive }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_UNKNOWN_TOKEN_DRIFT"),
  );
});

test("rejects component CSS reference or fallback drift", async () => {
  const directory = await temporaryDirectory();
  const stackSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/components/stack.tsx"),
    directory,
    "stack.tsx",
    (source) => source.replace("var(--desen-space-xs, 0.25rem)", "var(--desen-space-xs, 9rem)"),
  );
  await assert.rejects(injected({ stackSourcePath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_COMPONENT_CSS_DRIFT"),
  );

  const alertSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/components/alert.tsx"),
    directory,
    "alert.tsx",
    (source) => source.replace("--desen-color-info-surface", "--desen-color-unknown"),
  );
  await assert.rejects(injected({ alertSourcePath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_COMPONENT_CSS_DRIFT"),
  );
});

test("rejects fixture projections that leak bindings endpoints or executable values", async () => {
  const { testkitApi } = await loadApis();
  const endpointLeak = Object.freeze({
    ...testkitApi,
    createSyntheticFixtureSnapshot(input) {
      const snapshot = testkitApi.createSyntheticFixtureSnapshot(input);
      return deepFreeze({
        ...snapshot,
        endpoint: "https://production.invalid",
      });
    },
  });
  const executableLeak = Object.freeze({
    ...testkitApi,
    createSyntheticFixtureSnapshot(input) {
      const snapshot = testkitApi.createSyntheticFixtureSnapshot(input);
      return deepFreeze({
        ...snapshot,
        execute: () => undefined,
      });
    },
  });
  for (const mutatedApi of [endpointLeak, executableLeak]) {
    await assert.rejects(injected({ testkitApi: mutatedApi }), (error) =>
      expectEvidenceFailure(error, "TOKEN_FIXTURE_BINDING_LEAK"),
    );
  }

  const forgedSnapshotAcceptance = Object.freeze({
    ...testkitApi,
    lookupSyntheticOperationSuccess(snapshot, operationId) {
      try {
        return testkitApi.lookupSyntheticOperationSuccess(snapshot, operationId);
      } catch {
        return deepFreeze({
          context: testkitApi.SYNTHETIC_FIXTURE_CONTEXT,
          status: "missing",
        });
      }
    },
  });
  await assert.rejects(injected({ testkitApi: forgedSnapshotAcceptance }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_GUARDRAIL_DRIFT"),
  );
});

test("rejects public declaration package-export and platform-boundary drift", async () => {
  const directory = await temporaryDirectory();
  const tokenDeclarationPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist/tokens/index.d.ts"),
    directory,
    "tokens.d.ts",
    (source) => source.replace("REFERENCE_TOKEN_DOCUMENT", "REFERENCE_TOKEN_DOCUMENT_REMOVED"),
  );
  await assert.rejects(injected({ tokenDeclarationPath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_DECLARATION_DRIFT"),
  );

  const referencePackage = JSON.parse(
    await readFile(
      path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/package.json"),
      "utf8",
    ),
  );
  referencePackage.exports["./tokens"].import = "./dist/not-tokens.js";
  const referencePackagePath = path.join(directory, "reference-package.json");
  await writeFile(referencePackagePath, `${JSON.stringify(referencePackage)}\n`);
  await assert.rejects(injected({ referencePackagePath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_PACKAGE_EXPORT_DRIFT"),
  );

  const testkitSourcePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/testkit/src/synthetic-fixtures.ts"),
    directory,
    "synthetic-fixtures.ts",
    (source) => `import React from "react";\nvoid React;\n${source}`,
  );
  await assert.rejects(injected({ testkitSourcePath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_PLATFORM_BOUNDARY_DRIFT"),
  );

  const referenceReadmePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/README.md"),
    directory,
    "reference-readme.md",
    (source) => source.replace("stable DTCG 2025.10 format", "unversioned token format"),
  );
  await assert.rejects(injected({ referenceReadmePath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_DOCUMENTATION_DRIFT"),
  );

  const testkitReadmePath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/testkit/README.md"),
    directory,
    "testkit-readme.md",
    (source) => source.replace("64 nested levels", "unbounded nested levels"),
  );
  await assert.rejects(injected({ testkitReadmePath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_DOCUMENTATION_DRIFT"),
  );
});

test("rejects package-test and compiler-negative inventory drift", async () => {
  const directory = await temporaryDirectory();
  const tokenTestPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/test/reference-tokens.test.ts"),
    directory,
    "reference-tokens.test.ts",
    (source) =>
      source.replace(
        "keeps the complete nested DTCG document recursively immutable",
        "renamed token test",
      ),
  );
  await assert.rejects(injected({ tokenTestPath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_TEST_INVENTORY_DRIFT"),
  );

  const fixtureTypeTestPath = await mutatedCopy(
    path.join(WORKSPACE_ROOT, "packages/testkit/test/public-api.types.ts"),
    directory,
    "fixture-types.ts",
    (source) => source.replace("M03-T07-N10", "M03-T07-N99"),
  );
  await assert.rejects(injected({ fixtureTypeTestPath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_TYPE_INVENTORY_DRIFT"),
  );
});

test("rejects inert or incomplete root command wiring", async () => {
  const directory = await temporaryDirectory();
  const rootPackage = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  rootPackage.scripts["verify:reference-tokens-and-synthetic-fixtures"] =
    "node scripts/verify-reference-tokens-and-synthetic-fixtures.mjs";
  const rootPackagePath = path.join(directory, "package.json");
  await writeFile(rootPackagePath, `${JSON.stringify(rootPackage)}\n`);
  await assert.rejects(injected({ rootPackagePath }), (error) =>
    expectEvidenceFailure(error, "TOKEN_FIXTURE_ROOT_WIRING_DRIFT"),
  );
});

test("rejects tracked-artifact verification through a symlink alias", async () => {
  const directory = await temporaryDirectory();
  const alias = path.join(directory, "alias.json");
  await symlink(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH, alias);
  await assert.rejects(
    verifyReferenceTokensAndSyntheticFixturesEvidence({ artifactPath: alias }),
    (error) => expectEvidenceFailure(error, "TOKEN_FIXTURE_TRACKED_ALIAS_REJECTED"),
  );
});

test("writes and verifies an injected artifact atomically and detects pre-rename tampering", async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "evidence.json");
  await writeReferenceTokensAndSyntheticFixturesEvidence({
    artifactPath,
    buildOptions: { verifyPrerequisite: false },
  });
  const verified = await verifyReferenceTokensAndSyntheticFixturesEvidence({
    artifactPath,
    verifyPrerequisite: false,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.provenanceMode, "injected-test");

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writeReferenceTokensAndSyntheticFixturesEvidence({
      artifactPath: tamperedPath,
      buildOptions: { verifyPrerequisite: false },
      async beforeAtomicRename({ temporaryPath }) {
        await writeFile(temporaryPath, "{}\n");
      },
    }),
    (error) => expectEvidenceFailure(error, "TOKEN_FIXTURE_ARTIFACT_WRITE_FAILED"),
  );

  const copiedPath = path.join(directory, "copied.json");
  await copyFile(artifactPath, copiedPath);
  const copied = await verifyReferenceTokensAndSyntheticFixturesEvidence({
    artifactPath: copiedPath,
    verifyPrerequisite: false,
  });
  assert.equal(copied.artifactSha256, verified.artifactSha256);
});
