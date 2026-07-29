import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as publisherPublicApi from "../packages/publisher/dist/index.js";
import { preflightPublishCapabilities } from "../packages/publisher/dist/capability-preflight.js";
import { PUBLISH_SOURCE_PREFLIGHT_LIMITS } from "../packages/publisher/dist/source-preflight.js";
import * as validatorPublicApi from "../packages/validator/dist/index.js";
import {
  DEFAULT_PUBLISHER_CAPABILITY_PREFLIGHT_ARTIFACT_PATH,
  buildPublisherCapabilityPreflightEvidence,
  PublisherCapabilityPreflightEvidenceError,
  verifyPublisherCapabilityPreflightEvidence,
  writePublisherCapabilityPreflightEvidence,
} from "../scripts/lib/publisher-capability-preflight-proof.mjs";

const FIXTURE_PATHS = {
  officialSource: "../examples/sign-in/official-derived.source.desen.json",
  referenceCatalog: "../packages/reference-catalog-web/catalog.json",
  validSource: "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  validCatalog: "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
  exampleSignIn: "../packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json",
  exampleSortable:
    "../packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json",
  exampleStoreMap:
    "../packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json",
  exampleCatalog: "../packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
};

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherCapabilityPreflightEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

async function readFixtures() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(FIXTURE_PATHS).map(async ([key, relativePath]) => [
        key,
        JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8")),
      ]),
    ),
  );
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

test("accepts real deterministic M06-T04 capability-preflight evidence", async () => {
  const result = await verifyPublisherCapabilityPreflightEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 4);
  assert.equal(result.proofVectors, 11);
  assert.equal(result.acceptedFixtures, 5);
  assert.equal(result.staticFailureVectors, 8);
  assert.equal(result.warningVectors, 7);
  assert.equal(result.proofDocumentPinned, true);
  assert.equal(result.tests.publisherRuntimeCases, 14);
  assert.ok(result.tests.compilerNegativeCases >= 20);
  assert.ok(result.tests.validatorComponentCases > 20);
  assert.ok(result.tests.validatorInteractionCases > 20);
  assert.equal(result.tests.rootMutationCases, 15);
});

test("two independent builds are byte-identical and retain the exact PIPE-032 split", async () => {
  const first = await buildPublisherCapabilityPreflightEvidence();
  const second = await buildPublisherCapabilityPreflightEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.pipelineOwnership.trace, "PIPE-032");
  assert.equal(first.artifact.pipelineOwnership.m06T04ComponentAndInteractionSlice, "COMPLETE");
  assert.equal(
    first.artifact.pipelineOwnership.m06T05ResourceAndOperationContractSlice,
    "DEFERRED",
  );
  assert.match(first.artifact.nonclaims.join("\n"), /does not .*emit a Bundle/u);
  assert.match(first.artifact.nonclaims.join("\n"), /resource\/operation input/u);
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherCapabilityPreflightEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherCapabilityPreflightEvidence({
      artifactBytes: tampered,
      proofDocument: "",
    }),
    hasCode("PUBLISHER_CAPABILITY_ARTIFACT_DRIFT"),
  );
});

test("rejects Source/Catalog tuple mutation instead of changing the golden fixture corpus", async () => {
  const fixtures = await readFixtures();
  fixtures.exampleSortable.catalogs[0].version = "1.0.1";

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ fixtures }),
    hasCode("PUBLISHER_CAPABILITY_FIXTURE_DRIFT"),
  );
});

test("rejects a public Validator prerequisite that bypasses one static prop contract", async () => {
  const validatorApi = {
    ...validatorPublicApi,
    validateDesenSourceInteractionContracts(source, catalogSet) {
      const label = source?.surfaces?.["sign-in"]?.root?.slots?.default?.[4]?.props?.label;
      if (label === 42) {
        return deepFreeze({
          valid: true,
          target: "source",
          value: source,
          diagnostics: [],
          obligations: [],
        });
      }
      return validatorPublicApi.validateDesenSourceInteractionContracts(source, catalogSet);
    },
  };

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ validatorApi }),
    hasCode("PUBLISHER_CAPABILITY_VALIDATOR_PREREQUISITE_FAILED"),
  );
});

test("rejects a Publisher preflight that bypasses one static prop contract", async () => {
  function propBypassPreflight(rawSource, candidates, limits) {
    const source = JSON.parse(rawSource);
    const label = source?.surfaces?.["sign-in"]?.root?.slots?.default?.[4]?.props?.label;
    if (label === 42) {
      source.surfaces["sign-in"].root.slots.default[4].props.label = "Sign in";
      return preflightPublishCapabilities(JSON.stringify(source), candidates, limits);
    }
    return preflightPublishCapabilities(rawSource, candidates, limits);
  }

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ preflight: propBypassPreflight }),
    hasCode("PUBLISHER_CAPABILITY_STATIC_CONTRACT_FAILED"),
  );
});

test("rejects a detached Source clone that cannot retain M06-T03 runtime authority", async () => {
  function clonedSourcePreflight(...args) {
    const result = preflightPublishCapabilities(...args);
    if (!("capabilityPreflighted" in result)) return result;
    const source = deepFreeze(JSON.parse(JSON.stringify(result.source)));
    return deepFreeze({ ...result, source });
  }

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ preflight: clonedSourcePreflight }),
    hasCode("PUBLISHER_CAPABILITY_AUTHORITY_FAILED"),
  );
});

test("rejects warnings that disclose Catalog prose or imply a replacement", async () => {
  function leakingWarningPreflight(...args) {
    const result = preflightPublishCapabilities(...args);
    if (!("capabilityPreflighted" in result) || result.diagnostics.length === 0) return result;
    const diagnostics = result.diagnostics.map((diagnostic, index) =>
      index === 0
        ? deepFreeze({
            ...diagnostic,
            message: "PRIVATE BEHAVIOR RETIREMENT TEXT",
            replacement: "com.example.interactions/Replacement",
          })
        : diagnostic,
    );
    return deepFreeze({ ...result, diagnostics });
  }

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ preflight: leakingWarningPreflight }),
    hasCode("PUBLISHER_CAPABILITY_DEPRECATION_FAILED"),
  );
});

test("rejects a warning collector that drops nested component or behavior-slot use sites", async () => {
  function nestedWarningBypassPreflight(...args) {
    const result = preflightPublishCapabilities(...args);
    if (!("capabilityPreflighted" in result) || result.diagnostics.length === 0) return result;
    const diagnostics = result.diagnostics.filter(
      ({ pointer }) =>
        pointer !== "/surfaces/tasks/root/slots/default/0/use" &&
        pointer !== "/surfaces/tasks/root/behaviors/0/slots/dragPreview/0/use",
    );
    return deepFreeze({ ...result, diagnostics });
  }

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ preflight: nestedWarningBypassPreflight }),
    hasCode("PUBLISHER_CAPABILITY_SUCCESS_VECTOR_FAILED"),
  );
});

test("rejects any failure that leaks partial Source, Catalog authority, obligations, or Bundle", async () => {
  function partialFailurePreflight(...args) {
    const result = preflightPublishCapabilities(...args);
    if ("capabilityPreflighted" in result) return result;
    return deepFreeze({
      ...result,
      bundle: {},
      source: {},
      catalogSet: [],
      packages: [],
      requirementPackageIndexes: [],
      obligations: [],
    });
  }

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ preflight: partialFailurePreflight }),
    hasCode("PUBLISHER_CAPABILITY_PARTIAL_FAILURE"),
  );
});

test("rejects a preflight that truncates or ignores exact diagnostic ceilings", async () => {
  function unboundedPreflight(rawSource, candidates) {
    return preflightPublishCapabilities(rawSource, candidates, PUBLISH_SOURCE_PREFLIGHT_LIMITS);
  }

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({ preflight: unboundedPreflight }),
    hasCode("PUBLISHER_CAPABILITY_LIMIT_VECTOR_FAILED"),
  );
});

test("rejects root preflight exposure and target-specific production dependencies", async () => {
  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({
      publicApi: {
        ...publisherPublicApi,
        preflightPublishCapabilities,
      },
    }),
    hasCode("PUBLISHER_CAPABILITY_PUBLIC_API_EXPOSED"),
  );

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({
      publicApi: {
        ...publisherPublicApi,
        DEPRECATED_CAPABILITY_CODE: "run.desen.publisher/WRONG",
      },
    }),
    hasCode("PUBLISHER_CAPABILITY_WARNING_API_DRIFT"),
  );

  const source = await readFile(
    new URL("../packages/publisher/src/capability-preflight.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({
      capabilitySource: `import "node:fs";\n${source}`,
    }),
    hasCode("PUBLISHER_CAPABILITY_TARGET_BOUNDARY_DRIFT"),
  );
});

test("rejects enumerated direct globals, ambient authorities, suppressions, and loaders", async () => {
  const source = await readFile(
    new URL("../packages/publisher/src/capability-preflight.ts", import.meta.url),
    "utf8",
  );
  const targetSpecificMutations = [
    'void Reflect.get(globalThis, "fetch");',
    'void globalThis["fetch"];',
    'void document.createElement("div");',
    'void import("node:fs");',
    "declare const chrome: { readonly runtime: unknown };\nvoid chrome.runtime;",
    "// @ts-expect-error: intentional browser dependency probe\nvoid chrome.runtime;",
    'const indirectEval = eval;\nvoid indirectEval("void globalThis.fetch");',
    'const DynamicFunction = Function;\nvoid new DynamicFunction("return globalThis")();',
    'void (() => {}).constructor("return globalThis")();',
  ];

  for (const mutation of targetSpecificMutations) {
    await assert.rejects(
      buildPublisherCapabilityPreflightEvidence({
        capabilitySource: `${source}\n${mutation}\n`,
      }),
      hasCode("PUBLISHER_CAPABILITY_TARGET_BOUNDARY_DRIFT"),
    );
  }

  await assert.rejects(
    buildPublisherCapabilityPreflightEvidence({
      capabilitySource: `/// <reference lib="dom" />\n${source}\nvoid caches;\n`,
    }),
    hasCode("PUBLISHER_CAPABILITY_TARGET_BOUNDARY_DRIFT"),
  );
});

test("rejects a missing, stale, duplicated, or pending proof-document artifact pin", async () => {
  const built = await buildPublisherCapabilityPreflightEvidence();
  const validDocument = [
    "# Proof",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-capability-preflight.json`",
    "",
    `\`sha256:${built.artifactSha256}\``,
    "",
  ].join("\n");

  for (const proofDocument of [
    validDocument.replace("publisher-0.1.0-capability-preflight.json", "wrong.json"),
    validDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${validDocument}\n\`sha256:${built.artifactSha256}\`\n`,
    `${validDocument}\nPENDING_M06_T04_ARTIFACT_SHA256\n`,
  ]) {
    await assert.rejects(
      verifyPublisherCapabilityPreflightEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument,
      }),
      hasCode("PUBLISHER_CAPABILITY_PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects destination symlinks and pre-rename byte tampering", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-capability-preflight-proof-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const symlinkTarget = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact-link.json");
  await writeFile(symlinkTarget, "{}\n");
  await symlink(symlinkTarget, symlinkPath);
  await assert.rejects(
    writePublisherCapabilityPreflightEvidence({ artifactPath: symlinkPath }),
    TypeError,
  );

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writePublisherCapabilityPreflightEvidence({
      artifactPath: tamperedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    TypeError,
  );
  await assert.rejects(readFile(tamperedPath), { code: "ENOENT" });

  assert.equal(
    path.basename(DEFAULT_PUBLISHER_CAPABILITY_PREFLIGHT_ARTIFACT_PATH),
    "publisher-0.1.0-capability-preflight.json",
  );
});
