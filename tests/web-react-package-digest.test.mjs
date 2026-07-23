import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

import {
  buildWebReactPackageDigestEvidence,
  verifyWebReactPackageDigestEvidence,
  WebReactPackageDigestEvidenceError,
  writeWebReactPackageDigestEvidence,
} from "../scripts/lib/web-react-package-digest-proof.mjs";

const realProfileApi = await import("../packages/reference-catalog-web/dist/index.js");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof WebReactPackageDigestEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function profileApiWith(overrides = {}) {
  return { ...realProfileApi, ...overrides };
}

function minimalCatalog(packageDigest = realProfileApi.WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER) {
  return {
    kind: "desen.catalog",
    desen: "0.1.0",
    id: "com.example.test",
    version: "1.0.0",
    target: "web-react",
    packageDigest,
    components: {},
    behaviors: {},
    operations: {},
    resources: {},
  };
}

async function createVariant(context, sourcePath, mutate, prefix) {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const variantPath = path.join(directory, path.basename(sourcePath));
  const source = await readFile(new URL(sourcePath, import.meta.url), "utf8");
  await writeFile(variantPath, mutate(source));
  return variantPath;
}

test("accepts the tracked deterministic M03-T04 evidence", async () => {
  const result = await verifyWebReactPackageDigestEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.provenanceMode, "tracked-defaults");
  assert.equal(result.runtimeExports, 5);
  assert.equal(result.typeExports, 5);
  assert.equal(result.packageTests, 18);
  assert.equal(result.rootTests, 16);
  assert.equal(result.typeNegativeCases, 5);
  assert.equal(result.directTraceRules, 5);
  assert.equal(result.goldenEntries, 5);
  assert.equal(result.mutationVectors, 269);
  assert.equal(result.trackedFiles, 17);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent package-digest evidence builds are byte-identical", async () => {
  const first = await buildWebReactPackageDigestEvidence({ verifyPrerequisite: false });
  const second = await buildWebReactPackageDigestEvidence({ verifyPrerequisite: false });

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const pristine = await buildWebReactPackageDigestEvidence({ verifyPrerequisite: false });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyWebReactPackageDigestEvidence({
      artifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_ARTIFACT_DRIFT"),
  );
});

test("accepts exact Uint8Array bytes created in another JavaScript realm", () => {
  const crossRealmBytes = vm.runInNewContext("new Uint8Array([1, 2, 3, 4])");
  const localBytes = Uint8Array.of(1, 2, 3, 4);
  const crossRealm = realProfileApi.createWebReactPackageDigest({
    catalog: minimalCatalog(),
    artifacts: [{ path: "adapters/a.js", bytes: crossRealmBytes }],
  });
  const local = realProfileApi.createWebReactPackageDigest({
    catalog: minimalCatalog(),
    artifacts: [{ path: "adapters/a.js", bytes: localBytes }],
  });

  assert.deepEqual(crossRealm, local);
});

test("matches an independent Node SHA-256 oracle over the exact returned preimage", () => {
  const input = {
    catalog: minimalCatalog(),
    artifacts: [{ path: "adapters/a.js", bytes: Uint8Array.of(0, 1, 2, 255) }],
  };
  const preimage = realProfileApi.encodeWebReactPackageDigestPreimage(input);
  const expected = `sha256:${createHash("sha256").update(preimage).digest("hex")}`;

  assert.equal(realProfileApi.createWebReactPackageDigest(input).packageDigest, expected);
});

test("rejects forged mutable, profile, or audit metadata", async () => {
  const profileApi = profileApiWith({
    createWebReactPackageDigest(input) {
      return JSON.parse(JSON.stringify(realProfileApi.createWebReactPackageDigest(input)));
    },
  });

  await assert.rejects(
    buildWebReactPackageDigestEvidence({ profileApi, verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_OUTPUT_MUTABLE"),
  );

  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      profileApi: profileApiWith({
        WEB_REACT_PACKAGE_DIGEST_PROFILE: Object.freeze({
          ...realProfileApi.WEB_REACT_PACKAGE_DIGEST_PROFILE,
          id: "forged.profile",
        }),
      }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT"),
  );

  const statefulProfileApi = profileApiWith();
  statefulProfileApi.encodeWebReactPackageDigestPreimage = (input) => {
    statefulProfileApi.WEB_REACT_PACKAGE_DIGEST_PROFILE = Object.freeze({
      ...realProfileApi.WEB_REACT_PACKAGE_DIGEST_PROFILE,
      id: "forged.after-check",
    });
    return realProfileApi.encodeWebReactPackageDigestPreimage(input);
  };
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      profileApi: statefulProfileApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PROFILE_SURFACE_MUTATED"),
  );

  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      profileApi: profileApiWith({
        createWebReactPackageDigest(input) {
          const actual = realProfileApi.createWebReactPackageDigest(input);
          return Object.freeze({
            ...actual,
            entries: Object.freeze(
              actual.entries.map((entry) =>
                Object.freeze({
                  ...entry,
                  contentDigest: `sha256:${"0".repeat(64)}`,
                }),
              ),
            ),
          });
        },
      }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT"),
  );
});

test("rejects a forged encoder that changes the profile framing", async () => {
  const profileApi = profileApiWith({
    encodeWebReactPackageDigestPreimage(input) {
      return realProfileApi.encodeWebReactPackageDigestPreimage(input).slice(1);
    },
  });

  await assert.rejects(
    buildWebReactPackageDigestEvidence({ profileApi, verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_FRAMING_MISMATCH"),
  );

  for (const convert of [
    (bytes) => [...bytes],
    (bytes) => Buffer.from(bytes),
    (bytes) => new Uint8ClampedArray(bytes),
  ]) {
    await assert.rejects(
      buildWebReactPackageDigestEvidence({
        profileApi: profileApiWith({
          encodeWebReactPackageDigestPreimage(input) {
            return convert(realProfileApi.encodeWebReactPackageDigestPreimage(input));
          },
        }),
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_OUTPUT_BYTE_VIEW"),
    );
  }

  let cachedPreimage;
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      profileApi: profileApiWith({
        encodeWebReactPackageDigestPreimage(input) {
          const current = realProfileApi.encodeWebReactPackageDigestPreimage(input);
          if (cachedPreimage === undefined) cachedPreimage = current;
          else cachedPreimage.set(current);
          return cachedPreimage;
        },
      }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_OUTPUT_ALIAS"),
  );
});

test("rejects a forged verifier that accepts a wrong published self-digest", async () => {
  const profileApi = profileApiWith({
    verifyWebReactPackageDigest(input) {
      const template = {
        ...input,
        catalog: {
          ...input.catalog,
          packageDigest: realProfileApi.WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
        },
      };
      return realProfileApi.createWebReactPackageDigest(template);
    },
  });

  await assert.rejects(
    buildWebReactPackageDigestEvidence({ profileApi, verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_VERIFICATION_MISSING"),
  );
});

test("rejects a forged implementation that mutates caller-owned bytes", async () => {
  const profileApi = profileApiWith({
    createWebReactPackageDigest(input) {
      input.artifacts[0].bytes[0] ^= 1;
      return realProfileApi.createWebReactPackageDigest(input);
    },
  });

  await assert.rejects(
    buildWebReactPackageDigestEvidence({ profileApi, verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED"),
  );

  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      profileApi: profileApiWith({
        createWebReactPackageDigest(input) {
          Object.freeze(input.artifacts);
          Object.freeze(input);
          return realProfileApi.createWebReactPackageDigest(input);
        },
      }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED"),
  );
});

test("rejects direct package-digest trace ownership drift", async (context) => {
  const tracePath = await createVariant(
    context,
    "../docs/proof/protocol-0.1.0-traceability.json",
    (source) => {
      const trace = JSON.parse(source);
      trace.proseRules.find(({ id }) => id === "R-030").owners = ["M03-T10"];
      return `${JSON.stringify(trace)}\n`;
    },
    "desen-m03-t04-trace-",
  );

  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      tracePath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_TRACE_DRIFT"),
  );
});

test("rejects an incomplete package-digest profile document", async (context) => {
  const profileDocumentPath = await createVariant(
    context,
    "../docs/profiles/WEB-REACT-PACKAGE-DIGEST-V1.md",
    (source) => source.replace("Catalog self-reference projection", "Catalog projection"),
    "desen-m03-t04-profile-",
  );

  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      profileDocumentPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PROFILE_DOCUMENT_DRIFT"),
  );
});

test("rejects Node or framework behavior injected into the shipped digest module", async (context) => {
  const sourcePath = await createVariant(
    context,
    "../packages/reference-catalog-web/src/package-digest-profile.ts",
    (source) => `${source}\nimport fs from "node:fs";\nvoid fs;\n`,
    "desen-m03-t04-source-",
  );

  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      sourcePath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT"),
  );

  const bareBuiltinSourcePath = await createVariant(
    context,
    "../packages/reference-catalog-web/src/package-digest-profile.ts",
    (source) => `${source}\nimport { createHash } from "crypto";\nvoid createHash;\n`,
    "desen-m03-t04-bare-node-source-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      sourcePath: bareBuiltinSourcePath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT"),
  );

  const relativeHelperSourcePath = await createVariant(
    context,
    "../packages/reference-catalog-web/src/package-digest-profile.ts",
    (source) => `${source}\nimport "./node-helper.js";\n`,
    "desen-m03-t04-relative-helper-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      sourcePath: relativeHelperSourcePath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT"),
  );
});

test("rejects skipped package tests and fake compiler-negative inventory", async (context) => {
  const testPath = await createVariant(
    context,
    "../packages/reference-catalog-web/test/package-digest-profile.test.ts",
    (source) => source.replace('it("exposes a deeply frozen', 'it.skip("exposes a deeply frozen'),
    "desen-m03-t04-test-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({ testPath, verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT"),
  );

  const reboundTestPath = await createVariant(
    context,
    "../packages/reference-catalog-web/test/package-digest-profile.test.ts",
    (source) =>
      source.replace(
        'import { describe, expect, it } from "vitest";',
        'import { describe, expect, it as vitestIt } from "vitest";\nconst it = vitestIt.skip;',
      ),
    "desen-m03-t04-test-binding-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      testPath: reboundTestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT"),
  );

  const typeTestPath = await createVariant(
    context,
    "../packages/reference-catalog-web/test/public-api.types.ts",
    (source) => source.replace("M03-T04-N05", "M03-T04-X05"),
    "desen-m03-t04-types-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({ typeTestPath, verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_TYPE_INVENTORY_DRIFT"),
  );

  const rootTestPath = await createVariant(
    context,
    "../tests/web-react-package-digest.test.mjs",
    (source) =>
      source.replace(
        'test("accepts the tracked deterministic',
        'test.skip("accepts the tracked deterministic',
      ),
    "desen-m03-t04-root-test-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({ rootTestPath, verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT"),
  );

  const reboundRootTestPath = await createVariant(
    context,
    "../tests/web-react-package-digest.test.mjs",
    (source) =>
      source.replace(
        'import test from "node:test";',
        'import nodeTest from "node:test";\nconst test = nodeTest.skip;',
      ),
    "desen-m03-t04-root-binding-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      rootTestPath: reboundRootTestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects runtime and declaration public-surface drift", async (context) => {
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      profileApi: profileApiWith({ hiddenAdapter: true }),
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT"),
  );

  const declarationPath = await createVariant(
    context,
    "../packages/reference-catalog-web/dist/index.d.ts",
    (source) =>
      `${source}\nexport type { WebReactPackageDigestCalculationInput as HiddenType } from "./package-digest-profile.js";\n`,
    "desen-m03-t04-declaration-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      declarationPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT"),
  );

  const packageManifestPath = await createVariant(
    context,
    "../packages/reference-catalog-web/package.json",
    (source) => {
      const packageJson = JSON.parse(source);
      packageJson.exports["."].import = "./dist/hidden.js";
      return `${JSON.stringify(packageJson)}\n`;
    },
    "desen-m03-t04-package-manifest-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      packageManifestPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_PACKAGE_BOUNDARY_DRIFT"),
  );

  const tsconfigPath = await createVariant(
    context,
    "../packages/reference-catalog-web/tsconfig.json",
    (source) => {
      const tsconfig = JSON.parse(source);
      tsconfig.include = ["src/**/*.ts", "src/**/*.tsx"];
      return `${JSON.stringify(tsconfig)}\n`;
    },
    "desen-m03-t04-tsconfig-",
  );
  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      tsconfigPath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_TYPECHECK_BOUNDARY_DRIFT"),
  );
});

test("rejects missing root verifier, generator, test, or quality-gate wiring", async (context) => {
  const rootPackagePath = await createVariant(
    context,
    "../package.json",
    (source) => {
      const packageJson = JSON.parse(source);
      delete packageJson.scripts["verify:web-react-package-digest"];
      return `${JSON.stringify(packageJson)}\n`;
    },
    "desen-m03-t04-package-",
  );

  await assert.rejects(
    buildWebReactPackageDigestEvidence({
      rootPackagePath,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_COMMAND_WIRING_DRIFT"),
  );
});

test("writes exact bytes atomically and rejects destination or temporary substitution", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t04-writer-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  await assert.rejects(
    writeWebReactPackageDigestEvidence({
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_NONDEFAULT_TRACKED_WRITE"),
  );
  await assert.rejects(
    writeWebReactPackageDigestEvidence({
      buildOptions: Object.create({ verifyPrerequisite: false }),
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_NONDEFAULT_TRACKED_WRITE"),
  );
  await assert.rejects(
    verifyWebReactPackageDigestEvidence({ verifyPrerequisite: false }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_NONDEFAULT_TRACKED_VERIFY"),
  );

  const artifactPath = path.join(directory, "evidence.json");
  const written = await writeWebReactPackageDigestEvidence({
    artifactPath,
    buildOptions: { verifyPrerequisite: false },
  });
  assert.deepEqual(await readFile(artifactPath), written.artifactBytes);

  const targetPath = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "symlink.json");
  await writeFile(targetPath, "target");
  await symlink(targetPath, symlinkPath);
  await assert.rejects(
    writeWebReactPackageDigestEvidence({
      artifactPath: symlinkPath,
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_ARTIFACT_WRITE_FAILED"),
  );
  assert.equal(await readFile(targetPath, "utf8"), "target");

  await assert.rejects(
    writeWebReactPackageDigestEvidence({
      artifactPath: path.join(directory, "temporary-tamper.json"),
      buildOptions: { verifyPrerequisite: false },
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    hasEvidenceCode("WEB_REACT_PACKAGE_DIGEST_ARTIFACT_WRITE_FAILED"),
  );
});
