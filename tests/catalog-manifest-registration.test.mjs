import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CatalogManifestRegistrationEvidenceError,
  buildCatalogManifestRegistrationEvidence,
  verifyCatalogManifestRegistration,
  writeCatalogManifestRegistrationEvidence,
} from "../scripts/lib/catalog-manifest-registration-proof.mjs";

const realCatalogApi = await import("../packages/catalog-sdk/dist/index.js");
const realValidatorApi = await import("../packages/validator/dist/index.js");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof CatalogManifestRegistrationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

test("accepts the tracked deterministic M03-T01 evidence", async () => {
  const result = await verifyCatalogManifestRegistration();

  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 2);
  assert.equal(result.typeExports, 7);
  assert.equal(result.hostileValues, 35);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent Catalog registration evidence builds are byte-identical", async () => {
  const first = await buildCatalogManifestRegistrationEvidence({ verifyG02: false });
  const second = await buildCatalogManifestRegistrationEvidence({ verifyG02: false });

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const pristine = await buildCatalogManifestRegistrationEvidence({ verifyG02: false });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyCatalogManifestRegistration({ artifactBytes: tampered, verifyG02: false }),
    hasEvidenceCode("CATALOG_REGISTRATION_ARTIFACT_DRIFT"),
  );
});

test("rejects direct protocol trace ownership drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t01-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.proseRules.find(({ id }) => id === "R-084").owners = ["M03-T03"];
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({ tracePath, verifyG02: false }),
    hasEvidenceCode("CATALOG_REGISTRATION_TRACE_DRIFT"),
  );
});

test("rejects a forged mutable registration implementation", async () => {
  const catalogApi = {
    createCatalogManifest(input) {
      return {
        kind: "desen.catalog",
        desen: "0.1.0",
        ...input,
        components: {},
        behaviors: {},
        operations: {},
        resources: {},
      };
    },
    registerComponent(input) {
      return input;
    },
  };
  const validatorApi = {
    validateDesenCatalogSemantics() {
      return { valid: true, diagnostics: [] };
    },
  };

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({ catalogApi, validatorApi, verifyG02: false }),
    hasEvidenceCode("CATALOG_REGISTRATION_OUTPUT_MUTABLE"),
  );
});

test("checks every successful registration output for deep immutability", async () => {
  let registrationCalls = 0;
  const catalogApi = {
    createCatalogManifest: realCatalogApi.createCatalogManifest,
    registerComponent(input) {
      const result = realCatalogApi.registerComponent(input);
      registrationCalls += 1;
      return registrationCalls === 2 ? JSON.parse(JSON.stringify(result)) : result;
    },
  };

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_OUTPUT_MUTABLE"),
  );
});

test("rejects descriptor-only mutation of caller-owned nested input", async () => {
  let registrationCalls = 0;
  const catalogApi = {
    createCatalogManifest: realCatalogApi.createCatalogManifest,
    registerComponent(input) {
      registrationCalls += 1;
      if (registrationCalls === 1) Object.freeze(input.manifest.authoring);
      return realCatalogApi.registerComponent(input);
    },
  };

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_CALLER_MUTATED"),
  );
});

test("rejects an implementation that accepts distinct objects with a duplicate id", async () => {
  const catalogApi = {
    createCatalogManifest(input) {
      const [first, second] = input.components;
      if (
        input.components.length === 2 &&
        first !== second &&
        first?.id !== undefined &&
        first.id === second?.id
      ) {
        return realCatalogApi.createCatalogManifest({ ...input, components: [second] });
      }
      return realCatalogApi.createCatalogManifest(input);
    },
    registerComponent: realCatalogApi.registerComponent,
  };

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_REJECTION_MISSING"),
  );
});

test("rejects Catalog field substitution by a forged composer", async () => {
  const catalogApi = {
    createCatalogManifest(input) {
      return realCatalogApi.createCatalogManifest({
        ...input,
        id: "com.example.substituted",
        version: "9.9.9",
        target: "native-forged",
        description: "Substituted",
      });
    },
    registerComponent: realCatalogApi.registerComponent,
  };

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_GOLDEN_MISMATCH"),
  );
});

test("rejects noncanonical property storage order in registration output", async () => {
  const catalogApi = {
    createCatalogManifest: realCatalogApi.createCatalogManifest,
    registerComponent(input) {
      realCatalogApi.registerComponent(input);
      return deepFreeze(JSON.parse(JSON.stringify(input)));
    },
  };

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_OUTPUT_ORDER_DRIFT"),
  );
});

test("rejects a prototype-laundered exotic registration output", async () => {
  let registrationCalls = 0;
  const catalogApi = {
    createCatalogManifest: realCatalogApi.createCatalogManifest,
    registerComponent(input) {
      registrationCalls += 1;
      if (registrationCalls !== 3) return realCatalogApi.registerComponent(input);
      const exoticSchema = new Map([["hidden", 1]]);
      Object.setPrototypeOf(exoticSchema, Object.prototype);
      Object.freeze(exoticSchema);
      return deepFreeze({
        id: input.id,
        manifest: { ...input.manifest, propsSchema: exoticSchema },
      });
    },
  };

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_OUTPUT_EXOTIC"),
  );
});

test("rejects a framework import injected into neutral catalog source", async () => {
  const relativePath = "packages/catalog-sdk/src/index.ts";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: { [relativePath]: `${source}\nimport React from "react";\n` },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_PLATFORM_LEAK"),
  );
});

test("rejects a dynamic implementation import injected into neutral catalog source", async () => {
  const relativePath = "packages/catalog-sdk/src/index.ts";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        [relativePath]: `${source}\nconst lazyAdapter = () => import("@desen/runtime-react");\nvoid lazyAdapter;\n`,
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_IMPORT_BOUNDARY_DRIFT"),
  );
});

test("rejects a computed dynamic import injected into neutral catalog source", async () => {
  const relativePath = "packages/catalog-sdk/src/index.ts";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        [relativePath]: `${source}\nconst platformModule = "@desen/runtime-react";\nconst lazyPlatform = () => import(platformModule);\nvoid lazyPlatform;\n`,
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_IMPORT_BOUNDARY_DRIFT"),
  );
});

test("rejects an undeclared public type export in source and declarations", async () => {
  const sourcePath = "packages/catalog-sdk/src/index.ts";
  const declarationPath = "packages/catalog-sdk/dist/index.d.ts";
  const [source, declaration] = await Promise.all([
    readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8"),
    readFile(new URL(`../${declarationPath}`, import.meta.url), "utf8"),
  ]);

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        [sourcePath]: `${source}\nexport type UndeclaredPublicType = string;\n`,
        [declarationPath]: `${declaration}\nexport type UndeclaredPublicType = string;\n`,
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_PUBLIC_API_DRIFT"),
  );
});

test("rejects an exported namespace or ambient declaration", async () => {
  const sourcePath = "packages/catalog-sdk/src/index.ts";
  const declarationPath = "packages/catalog-sdk/dist/index.d.ts";
  const [source, declaration] = await Promise.all([
    readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8"),
    readFile(new URL(`../${declarationPath}`, import.meta.url), "utf8"),
  ]);
  const namespace = "export declare namespace ExtraPublicApi { type Value = string; }";

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        [sourcePath]: `${source}\n${namespace}\n`,
        [declarationPath]: `${declaration}\n${namespace}\n`,
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_PUBLIC_API_DRIFT"),
  );
});

test("rejects triple-slash ambient reference directives", async () => {
  const sourcePath = "packages/catalog-sdk/src/index.ts";
  const declarationPath = "packages/catalog-sdk/dist/index.d.ts";
  const [source, declaration] = await Promise.all([
    readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8"),
    readFile(new URL(`../${declarationPath}`, import.meta.url), "utf8"),
  ]);

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        [sourcePath]: `/// <reference lib="dom" />\n${source}`,
        [declarationPath]: `/// <reference types="node" />\n${declaration}`,
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_PLATFORM_LEAK"),
  );
});

test("rejects an unaudited source file added to the shipped package", async () => {
  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        "packages/catalog-sdk/src/extra.ts": "export const extra = true;\n",
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_SOURCE_INVENTORY_DRIFT"),
  );
});

test("derives and enforces the executable test inventory", async () => {
  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        "packages/catalog-sdk/test/catalog-manifest-registration.test.ts":
          "// Deliberately empty test module.\n",
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects skipped package suites in the test inventory", async () => {
  const relativePath = "packages/catalog-sdk/test/catalog-manifest-registration.test.ts";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: { [relativePath]: source.replaceAll("describe(", "describe.skip(") },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects option-skipped root tests in the test inventory", async () => {
  const relativePath = "tests/catalog-manifest-registration.test.mjs";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const skipped = source.replace(
    'test("accepts the tracked deterministic M03-T01 evidence", async () => {',
    'test("accepts the tracked deterministic M03-T01 evidence", { skip: true }, async () => {',
  );

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: { [relativePath]: skipped },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects fake negative-case labels outside compiler directives", async () => {
  const labels = Array.from(
    { length: 21 },
    (_, index) => `@ts-expect-error M03-T01-N${String(index + 1).padStart(2, "0")}`,
  );

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        "packages/catalog-sdk/test/public-api.types.ts": `export const fakeEvidenceLabels = ${JSON.stringify(labels.join("\\n"))};\n`,
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects missing root command wiring", async () => {
  const rootPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  delete rootPackage.scripts["verify:catalog-manifest-registration"];

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: { "package.json": `${JSON.stringify(rootPackage)}\n` },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_COMMAND_WIRING_DRIFT"),
  );
});

test("rejects early-exit command wiring", async () => {
  const rootPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  rootPackage.scripts.check = `exit 0 && ${rootPackage.scripts.check}`;

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: { "package.json": `${JSON.stringify(rootPackage)}\n` },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_COMMAND_WIRING_DRIFT"),
  );
});

test("writes byte-identical evidence through the safe atomic writer", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t01-writer-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "evidence.json");

  const result = await writeCatalogManifestRegistrationEvidence({
    artifactPath,
    buildOptions: { verifyG02: false },
  });
  assert.deepEqual(await readFile(artifactPath), result.artifactBytes);
});

test("rejects a symlinked evidence destination before writing", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t01-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const externalPath = path.join(directory, "external.json");
  const artifactPath = path.join(directory, "evidence.json");
  await writeFile(externalPath, "unchanged\n");
  await symlink(externalPath, artifactPath);

  await assert.rejects(
    writeCatalogManifestRegistrationEvidence({
      artifactPath,
      buildOptions: { verifyG02: false },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
  assert.equal(await readFile(externalPath, "utf8"), "unchanged\n");
});

test("rejects replacement of the reserved temporary file", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t01-temp-replace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "evidence.json");
  await writeFile(artifactPath, "original\n");

  await assert.rejects(
    writeCatalogManifestRegistrationEvidence({
      artifactPath,
      buildOptions: { verifyG02: false },
      async beforeAtomicRename({ temporaryPath }) {
        await unlink(temporaryPath);
        await writeFile(temporaryPath, "forged\n");
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CHANGED"),
  );
  assert.equal(await readFile(artifactPath, "utf8"), "original\n");
});

test("rejects symlink replacement of the reserved temporary file", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t01-temp-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "evidence.json");
  const externalPath = path.join(directory, "external.json");
  await writeFile(artifactPath, "original\n");
  await writeFile(externalPath, "external\n");

  await assert.rejects(
    writeCatalogManifestRegistrationEvidence({
      artifactPath,
      buildOptions: { verifyG02: false },
      async beforeAtomicRename({ temporaryPath }) {
        await unlink(temporaryPath);
        await symlink(externalPath, temporaryPath);
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CHANGED"),
  );
  assert.equal(await readFile(artifactPath, "utf8"), "original\n");
  assert.equal(await readFile(externalPath, "utf8"), "external\n");
});

test("rejects same-inode overwrite of the reserved temporary file", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t01-temp-overwrite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "evidence.json");
  await writeFile(artifactPath, "original\n");

  await assert.rejects(
    writeCatalogManifestRegistrationEvidence({
      artifactPath,
      buildOptions: { verifyG02: false },
      async beforeAtomicRename({ temporaryPath }) {
        await writeFile(temporaryPath, "forged\n");
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CHANGED"),
  );
  assert.equal(await readFile(artifactPath, "utf8"), "original\n");
});
