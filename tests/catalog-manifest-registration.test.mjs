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

function catalogApiWith(overrides = {}) {
  return {
    createCatalogManifest: realCatalogApi.createCatalogManifest,
    deriveComponentInspectorControls: realCatalogApi.deriveComponentInspectorControls,
    registerBehavior: realCatalogApi.registerBehavior,
    registerComponent: realCatalogApi.registerComponent,
    registerOperation: realCatalogApi.registerOperation,
    registerResource: realCatalogApi.registerResource,
    ...overrides,
  };
}

const NEW_CATEGORY_REGISTRATIONS = Object.freeze([
  Object.freeze({ catalogField: "behaviors", registerName: "registerBehavior" }),
  Object.freeze({ catalogField: "operations", registerName: "registerOperation" }),
  Object.freeze({ catalogField: "resources", registerName: "registerResource" }),
]);
const CATALOG_REGISTRATION_FIELDS = Object.freeze([
  "components",
  "behaviors",
  "operations",
  "resources",
]);
const CROSS_CATEGORY_PAIRS = Object.freeze(
  CATALOG_REGISTRATION_FIELDS.flatMap((left, leftIndex) =>
    CATALOG_REGISTRATION_FIELDS.slice(leftIndex + 1).map((right) => Object.freeze([left, right])),
  ),
);

test("accepts the tracked deterministic M03-T01 through M03-T03 evidence", async () => {
  const result = await verifyCatalogManifestRegistration();

  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 6);
  assert.equal(result.typeExports, 23);
  assert.equal(result.hostileValues, 140);
  assert.equal(result.inspectorHostileValues, 35);
  assert.equal(result.inspectorFallbacks, 24);
  assert.equal(result.packageTests, 33);
  assert.equal(result.schemaConstraints, 34);
  assert.equal(result.trackedFiles, 22);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent Catalog registration evidence builds are byte-identical", async () => {
  const first = await buildCatalogManifestRegistrationEvidence({ verifyG02: false });
  const second = await buildCatalogManifestRegistrationEvidence({ verifyG02: false });
  const rootPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  rootPackage.scripts.test = rootPackage.scripts.test.replace(
    " && turbo run test",
    " && pnpm test:future-milestone-proof && turbo run test",
  );
  rootPackage.scripts.check = rootPackage.scripts.check.replace(
    " && pnpm lint",
    " && pnpm verify:future-milestone-proof && pnpm lint",
  );
  const withFutureMilestone = await buildCatalogManifestRegistrationEvidence({
    verifyG02: false,
    fileOverrides: { "package.json": `${JSON.stringify(rootPackage)}\n` },
  });

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(
    first.artifactBytes.toString("hex"),
    withFutureMilestone.artifactBytes.toString("hex"),
  );
  assert.equal(first.artifactSha256, withFutureMilestone.artifactSha256);
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

test("rejects direct prose and conformance trace ownership drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t02-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const baselineTrace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );

  for (const { collection, id, owners } of [
    { collection: "conformanceRules", id: "C-006", owners: ["M09-T02"] },
    { collection: "proseRules", id: "R-084", owners: ["M03-T03"] },
    { collection: "proseRules", id: "R-087", owners: ["M09-T05", "M09-T06"] },
    { collection: "proseRules", id: "R-096", owners: ["M09-T05", "M09-T06"] },
    { collection: "conformanceRules", id: "C-018", owners: ["M03-T08"] },
  ]) {
    const trace = structuredClone(baselineTrace);
    trace[collection].find((rule) => rule.id === id).owners = owners;
    const tracePath = path.join(directory, `${id}.json`);
    await writeFile(tracePath, `${JSON.stringify(trace)}\n`);

    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({ tracePath, verifyG02: false }),
      hasEvidenceCode("CATALOG_REGISTRATION_TRACE_DRIFT"),
    );
  }

  const findingsPath = "docs/plan/PROTOCOL-FINDINGS.md";
  const findings = await readFile(new URL(`../${findingsPath}`, import.meta.url), "utf8");
  const changedFindings = findings.replace(
    "## PF-025 — Authoring control hints have no normative vocabulary",
    "## PF-025 — Changed finding title",
  );
  assert.notEqual(changedFindings, findings);
  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: { [findingsPath]: changedFindings },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_FINDING_DRIFT"),
  );
});

test("rejects a forged mutable registration implementation", async () => {
  const catalogApi = catalogApiWith({
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
  });
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
  const catalogApi = catalogApiWith({
    registerComponent(input) {
      const result = realCatalogApi.registerComponent(input);
      registrationCalls += 1;
      return registrationCalls === 2 ? JSON.parse(JSON.stringify(result)) : result;
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_OUTPUT_MUTABLE"),
  );
});

test("checks every new-category registration output for deep immutability", async () => {
  for (const { registerName } of NEW_CATEGORY_REGISTRATIONS) {
    const catalogApi = catalogApiWith({
      [registerName](input) {
        return JSON.parse(JSON.stringify(realCatalogApi[registerName](input)));
      },
    });

    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({
        catalogApi,
        validatorApi: realValidatorApi,
        verifyG02: false,
      }),
      hasEvidenceCode("CATALOG_REGISTRATION_OUTPUT_MUTABLE"),
    );
  }
});

test("rejects descriptor-only mutation of caller-owned nested input", async () => {
  let registrationCalls = 0;
  const catalogApi = catalogApiWith({
    registerComponent(input) {
      registrationCalls += 1;
      if (registrationCalls === 1) Object.freeze(input.manifest.authoring);
      return realCatalogApi.registerComponent(input);
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_CALLER_MUTATED"),
  );
});

test("rejects caller-owned manifest aliases in every new category map", async () => {
  for (const { catalogField } of NEW_CATEGORY_REGISTRATIONS) {
    const catalogApi = catalogApiWith({
      createCatalogManifest(input) {
        const catalog = JSON.parse(JSON.stringify(realCatalogApi.createCatalogManifest(input)));
        const registration = input[catalogField]?.[0];
        if (registration !== undefined) {
          catalog[catalogField][registration.id] = registration.manifest;
        }
        return deepFreeze(catalog);
      },
    });

    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({
        catalogApi,
        validatorApi: realValidatorApi,
        verifyG02: false,
      }),
      hasEvidenceCode("CATALOG_REGISTRATION_CALLER_ALIAS"),
    );
  }
});

test("rejects identity-based duplicate checks in every category", async () => {
  for (const catalogField of CATALOG_REGISTRATION_FIELDS) {
    const catalogApi = catalogApiWith({
      createCatalogManifest(input) {
        const [first, second] = input[catalogField] ?? [];
        if (
          input[catalogField]?.length === 2 &&
          first !== second &&
          first?.id !== undefined &&
          first.id === second?.id
        ) {
          return realCatalogApi.createCatalogManifest({
            ...input,
            [catalogField]: [second],
          });
        }
        return realCatalogApi.createCatalogManifest(input);
      },
    });

    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({
        catalogApi,
        validatorApi: realValidatorApi,
        verifyG02: false,
      }),
      hasEvidenceCode("CATALOG_REGISTRATION_REJECTION_MISSING"),
    );
  }
});

test("rejects a forged composer that drops any new category map", async () => {
  for (const { catalogField } of NEW_CATEGORY_REGISTRATIONS) {
    const catalogApi = catalogApiWith({
      createCatalogManifest(input) {
        const catalog = JSON.parse(JSON.stringify(realCatalogApi.createCatalogManifest(input)));
        catalog[catalogField] = {};
        return deepFreeze(catalog);
      },
    });

    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({
        catalogApi,
        validatorApi: realValidatorApi,
        verifyG02: false,
      }),
      hasEvidenceCode("CATALOG_REGISTRATION_GOLDEN_MISMATCH"),
    );
  }
});

test("rejects a forged composer that accepts cross-category duplicate ids", async () => {
  for (const [leftField, rightField] of CROSS_CATEGORY_PAIRS) {
    const catalogApi = catalogApiWith({
      createCatalogManifest(input) {
        const leftRegistration = input[leftField]?.[0];
        const rightRegistration = input[rightField]?.[0];
        if (
          input[leftField]?.length === 1 &&
          input[rightField]?.length === 1 &&
          leftRegistration?.id !== undefined &&
          leftRegistration.id === rightRegistration?.id
        ) {
          return realCatalogApi.createCatalogManifest({
            ...input,
            [leftField]: [],
          });
        }
        return realCatalogApi.createCatalogManifest(input);
      },
    });

    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({
        catalogApi,
        validatorApi: realValidatorApi,
        verifyG02: false,
      }),
      hasEvidenceCode("CATALOG_REGISTRATION_REJECTION_MISSING"),
    );
  }
});

test("rejects Catalog field substitution by a forged composer", async () => {
  const catalogApi = catalogApiWith({
    createCatalogManifest(input) {
      return realCatalogApi.createCatalogManifest({
        ...input,
        id: "com.example.substituted",
        version: "9.9.9",
        target: "native-forged",
        description: "Substituted",
      });
    },
  });

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
  const catalogApi = catalogApiWith({
    registerComponent(input) {
      realCatalogApi.registerComponent(input);
      return deepFreeze(JSON.parse(JSON.stringify(input)));
    },
  });

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
  const catalogApi = catalogApiWith({
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
  });

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
    'test("accepts the tracked deterministic M03-T01 through M03-T03 evidence", async () => {',
    'test("accepts the tracked deterministic M03-T01 through M03-T03 evidence", { skip: true }, async () => {',
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
  const labels = [
    ...Array.from(
      { length: 21 },
      (_, index) => `@ts-expect-error M03-T01-N${String(index + 1).padStart(2, "0")}`,
    ),
    ...Array.from(
      { length: 32 },
      (_, index) => `@ts-expect-error M03-T02-N${String(index + 1).padStart(2, "0")}`,
    ),
  ];

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
  const baseline = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const mutations = [
    (rootPackage) => delete rootPackage.scripts["verify:catalog-manifest-registration"],
    (rootPackage) => {
      rootPackage.scripts.test = rootPackage.scripts.test.replace(
        "pnpm test:catalog-manifest-registration && ",
        "",
      );
    },
    (rootPackage) => {
      rootPackage.scripts.check = rootPackage.scripts.check.replace(
        "pnpm verify:catalog-manifest-registration && ",
        "",
      );
    },
    (rootPackage) => {
      rootPackage.scripts.test = rootPackage.scripts.test.replace(
        "pnpm test:protocol-snapshot && pnpm test:protocol-traceability",
        "pnpm test:protocol-traceability && pnpm test:protocol-snapshot",
      );
    },
    (rootPackage) => {
      rootPackage.scripts.check = rootPackage.scripts.check.replace(
        "pnpm verify:protocol-snapshot && pnpm verify:protocol-traceability",
        "pnpm verify:protocol-traceability && pnpm verify:protocol-snapshot",
      );
    },
  ];

  for (const mutate of mutations) {
    const rootPackage = structuredClone(baseline);
    mutate(rootPackage);
    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({
        verifyG02: false,
        fileOverrides: { "package.json": `${JSON.stringify(rootPackage)}\n` },
      }),
      hasEvidenceCode("CATALOG_REGISTRATION_COMMAND_WIRING_DRIFT"),
    );
  }
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t02-writer-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "evidence.json");

  const result = await writeCatalogManifestRegistrationEvidence({
    artifactPath,
    buildOptions: { verifyG02: false },
  });
  assert.deepEqual(await readFile(artifactPath), result.artifactBytes);
});

test("rejects a symlinked evidence destination before writing", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t02-symlink-"));
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t02-temp-replace-"));
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t02-temp-symlink-"));
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t02-temp-overwrite-"));
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

test("rejects schema-authority drift in inspector controls", async () => {
  const catalogApi = catalogApiWith({
    deriveComponentInspectorControls(input) {
      const plan = JSON.parse(
        JSON.stringify(realCatalogApi.deriveComponentInspectorControls(input)),
      );
      const tone = plan.controls.find(({ property }) => property === "tone");
      if (tone !== undefined) {
        tone.kind = "number";
        tone.required = false;
        tone.options = ["invented"];
      }
      return deepFreeze(plan);
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_INSPECTOR_GOLDEN_DRIFT"),
  );
});

test("rejects omission of structured-JSON inspector fallbacks", async () => {
  const catalogApi = catalogApiWith({
    deriveComponentInspectorControls(input) {
      const plan = JSON.parse(
        JSON.stringify(realCatalogApi.deriveComponentInspectorControls(input)),
      );
      const properties = input.manifest.propsSchema.properties ?? {};
      const hidesUndeclaredRequiredName = input.manifest.propsSchema.required?.some(
        (name) => !Object.hasOwn(properties, name),
      );
      if (hidesUndeclaredRequiredName) plan.controls = [];
      return deepFreeze(plan);
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_INSPECTOR_FALLBACK_DRIFT"),
  );
});

test("rejects mutable inspector plans", async () => {
  const catalogApi = catalogApiWith({
    deriveComponentInspectorControls(input) {
      return JSON.parse(JSON.stringify(realCatalogApi.deriveComponentInspectorControls(input)));
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_OUTPUT_MUTABLE"),
  );
});

test("rejects inspector retention of caller-owned manifest aliases", async () => {
  const catalogApi = catalogApiWith({
    deriveComponentInspectorControls(input) {
      const plan = JSON.parse(
        JSON.stringify(realCatalogApi.deriveComponentInspectorControls(input)),
      );
      plan.propsSchema = input.manifest.propsSchema;
      return deepFreeze(plan);
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_CALLER_ALIAS"),
  );
});

test("rejects inspector pointer substitution", async () => {
  const catalogApi = catalogApiWith({
    deriveComponentInspectorControls(input) {
      const plan = JSON.parse(
        JSON.stringify(realCatalogApi.deriveComponentInspectorControls(input)),
      );
      if (plan.controls[0] !== undefined) plan.controls[0].valuePointer = "/substituted";
      return deepFreeze(plan);
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_INSPECTOR_GOLDEN_DRIFT"),
  );
});

test("rejects partial inspector output beyond derivation limits", async () => {
  const catalogApi = catalogApiWith({
    deriveComponentInspectorControls(input) {
      const plan = JSON.parse(
        JSON.stringify(realCatalogApi.deriveComponentInspectorControls(input)),
      );
      const [control] = plan.controls;
      if (control?.fallbackReason === "derivation-limit") {
        control.fallbackReason = "unsupported-schema";
      }
      return deepFreeze(plan);
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_INSPECTOR_LIMIT_DRIFT"),
  );
});

test("rejects hostile inspector input acceptance", async () => {
  const catalogApi = catalogApiWith({
    deriveComponentInspectorControls(input) {
      if (input.manifest?.authoring?.controls?.value !== undefined) {
        return deepFreeze({
          controls: [],
          propsSchema: {},
        });
      }
      return realCatalogApi.deriveComponentInspectorControls(input);
    },
  });

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      catalogApi,
      validatorApi: realValidatorApi,
      verifyG02: false,
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_REJECTION_MISSING"),
  );
});

test("rejects M03-T03 schema-family trace drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t03-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const trackedTrace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  const mutations = [
    ["SC-033", (family) => (family.semanticOwners = [])],
    ["SC-056", (family) => (family.expectedConstraints = 32)],
  ];

  for (const [id, mutate] of mutations) {
    const trace = structuredClone(trackedTrace);
    mutate(trace.schemaFamilies.find((family) => family.id === id));
    const tracePath = path.join(directory, `${id}.json`);
    await writeFile(tracePath, `${JSON.stringify(trace)}\n`);

    await assert.rejects(
      buildCatalogManifestRegistrationEvidence({ tracePath, verifyG02: false }),
      hasEvidenceCode("CATALOG_REGISTRATION_TRACE_DRIFT"),
    );
  }
});

test("rejects skipped inspector fallback matrix", async () => {
  const relativePath = "packages/catalog-sdk/test/component-inspector-control.test.ts";
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const skipped = source.replace(
    'it("keeps every unsupported schema subtree visible through a reasoned fallback", () => {',
    'it.skip("keeps every unsupported schema subtree visible through a reasoned fallback", () => {',
  );

  assert.notEqual(skipped, source);
  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: { [relativePath]: skipped },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects fake M03-T03 negative-case labels outside compiler directives", async () => {
  const labels = Array.from(
    { length: 18 },
    (_, index) => `@ts-expect-error M03-T03-N${String(index + 1).padStart(2, "0")}`,
  );

  await assert.rejects(
    buildCatalogManifestRegistrationEvidence({
      verifyG02: false,
      fileOverrides: {
        "packages/catalog-sdk/test/schema-type-derivation.types.ts": `export const fakeEvidenceLabels = ${JSON.stringify(labels.join("\\n"))};\n`,
      },
    }),
    hasEvidenceCode("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT"),
  );
});
