import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import validSource from "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json" with { type: "json" };
import * as editorCore from "../packages/editor-core/dist/index.js";
import {
  DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH,
  EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN,
  EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES,
  EditorCoreSourceDocumentProofError,
  buildEditorCoreSourceDocumentEvidence,
  verifyEditorCoreSourceDocumentEvidence,
  writeEditorCoreSourceDocumentEvidence,
} from "../scripts/lib/editor-core-source-document-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/editor-core-0.1.0-source-document.json";
const PREREQUISITE = "docs/proof/baselines/i07-04-affected-selector-promotion.json";
const PACKAGE_TEST = "packages/editor-core/test/source-document.test.ts";
const PUBLIC_TEST = "packages/editor-core/test/public-package.mjs";
const ROOT_TEST = "tests/editor-core-source-document.test.mjs";

let built;
const temporaryDirectories = [];

function cloneFixture() {
  return structuredClone(validSource);
}

function expectedError(code) {
  return (error) => error instanceof EditorCoreSourceDocumentProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\nArtifact: \`${ARTIFACT}\`\n\nFinal receipt: \`sha256:${artifactSha256}\`\n`;
}

function replaceLast(source, search, replacement) {
  const index = source.lastIndexOf(search);
  assert.notEqual(index, -1);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

async function workspaceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

function assertDeepFrozen(value, visited = new Set()) {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    visited.has(value)
  ) {
    return;
  }
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, visited);
}

before(async () => {
  built = await buildEditorCoreSourceDocumentEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds final M08-T01 evidence from the exact G07/I07-04 prerequisite", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-source-document");
  assert.equal(built.artifact.profile, "desen.editor-core.source-document-proof.v1");
  assert.equal(built.artifact.task, "M08-T01");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisite, {
    ...built.artifact.prerequisite,
    ...EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN,
    result: "PASS",
    status: "DONE",
  });
  assert.equal(built.artifact.prerequisite.authority.observations, 20);
  assert.equal(built.artifact.prerequisite.authority.falseNegatives, 0);
  assert.equal(built.artifact.prerequisite.authority.promotion, "PROMOTION_AUTHORIZED");
  assert.equal(built.artifact.prerequisite.authority.cutover, "HOSTED_CUTOVER_VERIFIED");
  assert.equal(built.artifact.prerequisite.authority.cleanup.result, "PASS");
  assert.equal(built.artifact.prerequisite.authority.main.result, "PASS");
  assert.equal(built.artifact.prerequisite.authority.affectedCanary.freshExecution, true);
  assert.equal(built.artifact.prerequisite.authority.affectedCanary.cachedSuccessRead, false);
  assert.equal(built.artifact.prerequisite.authority.infrastructureDebt.status, "CLOSED");
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.prerequisiteGate, "G07");
  assert.equal(built.artifact.claim.prerequisiteStatus, "DONE");
  assert.equal(built.artifact.evidence.tests.packageRuntimeCases, 7);
  assert.equal(built.artifact.evidence.tests.publicRuntimeContractCases, 10);
  assert.equal(built.artifact.evidence.tests.publicProofCoreCases, 7);
  assert.equal(built.artifact.evidence.tests.rootProofCases, 13);
  assert.deepEqual(
    built.artifact.evidence.tests.rootTestNames,
    EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES,
  );
  assert.equal(built.artifact.evidence.trackedFiles.length, 24);
});

test("[determinism] two final evidence builds are byte-identical", async () => {
  const first = await buildEditorCoreSourceDocumentEvidence();
  const second = await buildEditorCoreSourceDocumentEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifact, second.artifact);
});

test("[prerequisite] rejects changed I07-04 bytes and incomplete hosted closure", async () => {
  const bytes = await workspaceBytes(PREREQUISITE);
  const incomplete = JSON.parse(bytes.toString("utf8"));
  incomplete.cutover.status = "PENDING_HOSTED_CUTOVER";
  incomplete.cutover.cleanup = null;
  incomplete.cutover.main = null;
  incomplete.cutover.affectedCanary = null;

  for (const prerequisiteBytes of [
    changedByte(bytes),
    Buffer.from(`${JSON.stringify(incomplete, null, 2)}\n`),
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ prerequisiteBytes }),
      expectedError("EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT"),
    );
  }
});

test("[behavior] rejects wrappers, mutation authority, partial failure, and semantic overreach", async () => {
  const runtimes = [
    {
      createDesenEditorDocument(input) {
        const result = editorCore.createDesenEditorDocument(input);
        if (!result.ok) return result;
        return Object.freeze({
          ok: true,
          document: Object.freeze({ source: result.document }),
          diagnostics: Object.freeze([]),
        });
      },
    },
    {
      createDesenEditorDocument(input) {
        const result = editorCore.createDesenEditorDocument(input);
        if (!result.ok) return result;
        return { ok: true, document: cloneFixture(), diagnostics: [] };
      },
    },
    {
      createDesenEditorDocument(input) {
        if (input?.kind !== "desen.source") return editorCore.createDesenEditorDocument(input);
        Object.freeze(input);
        return Object.freeze({ ok: true, document: input, diagnostics: Object.freeze([]) });
      },
    },
    {
      createDesenEditorDocument(input) {
        const result = editorCore.createDesenEditorDocument(input);
        return result.ok ? result : Object.freeze({ ...result, document: Object.freeze({}) });
      },
    },
    {
      createDesenEditorDocument(input) {
        if (input?.surfaces?.["sign-in"]?.root?.use === "com.example.unresolved/Unknown") {
          return Object.freeze({
            ok: false,
            diagnostics: Object.freeze([
              Object.freeze({
                code: "SCHEMA_INVALID",
                message: "Capability is unresolved.",
                pointer: "/surfaces/sign-in/root/use",
              }),
            ]),
          });
        }
        return editorCore.createDesenEditorDocument(input);
      },
    },
  ];

  for (const runtimeApi of runtimes) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ runtimeApi }),
      expectedError("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT"),
    );
  }
});

test("[boundary] rejects source, TSDoc, import, distribution, and manifest drift", async () => {
  const [source, index, distSource, declaration, manifestBytes] = await Promise.all([
    workspaceBytes("packages/editor-core/src/source-document.ts"),
    workspaceBytes("packages/editor-core/src/index.ts"),
    workspaceBytes("packages/editor-core/dist/source-document.js"),
    workspaceBytes("packages/editor-core/dist/source-document.d.ts"),
    workspaceBytes("packages/editor-core/package.json"),
  ]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  manifest.dependencies.react = "19.0.0";
  const mutations = [
    ["packages/editor-core/src/source-document.ts", source.toString("utf8").replace("/**", "/*")],
    ["packages/editor-core/src/source-document.ts", `import "node:fs";\n${source}`],
    ["packages/editor-core/src/index.ts", `${index}\nexport const hiddenAuthority = true;\n`],
    ["packages/editor-core/dist/source-document.js", `${distSource}\nwindow.document;\n`],
    [
      "packages/editor-core/dist/source-document.d.ts",
      declaration
        .toString("utf8")
        .replace("export type DesenEditorDocument", "type DesenEditorDocument"),
    ],
    ["packages/editor-core/package.json", JSON.stringify(manifest)],
  ];
  for (const [relativePath, value] of mutations) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ fileOverrides: { [relativePath]: value } }),
      EditorCoreSourceDocumentProofError,
    );
  }
});

test("[inventory] rejects package, public, and root test-authority drift", async () => {
  const [packageTest, publicTest, rootTest] = await Promise.all([
    workspaceBytes(PACKAGE_TEST),
    workspaceBytes(PUBLIC_TEST),
    workspaceBytes(ROOT_TEST),
  ]);
  const mutations = [
    [
      PACKAGE_TEST,
      packageTest
        .toString("utf8")
        .replace('  it("admits the official Source', '  test.skip("admits the official Source'),
    ],
    [
      PUBLIC_TEST,
      publicTest.toString("utf8").replace('test("[proof-core] two fresh', 'test("two fresh'),
    ],
    [
      ROOT_TEST,
      replaceLast(
        rootTest.toString("utf8"),
        "[immutability] freezes final evidence and keeps later M08 scope explicit",
        "[immutability] renamed authority",
      ),
    ],
  ];
  for (const [relativePath, value] of mutations) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ fileOverrides: { [relativePath]: value } }),
      expectedError("EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("[artifact] verifies exact bytes and the exact proof-document pin", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyEditorCoreSourceDocumentEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.deepEqual(verified, {
    task: "M08-T01",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisiteTask: "I07-04",
    prerequisiteGate: "G07",
    trackedFiles: 24,
    rootProofCases: 13,
  });
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_PROOF_PIN_DRIFT"),
  );
});

test("[writer] atomically writes exact bytes and preserves an existing destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeEditorCoreSourceDocumentEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const sentinel = Buffer.from("preserve-existing-destination\n");
  await writeFile(artifactPath, sentinel);
  await assert.rejects(
    writeEditorCoreSourceDocumentEvidence({
      artifactPath,
      beforeAtomicRename: () => {
        throw new Error("controlled pre-rename failure");
      },
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED"),
  );
  assert.deepEqual(await readFile(artifactPath), sentinel);

  await assert.rejects(
    writeEditorCoreSourceDocumentEvidence({
      artifactPath,
      buildOptions: { prerequisiteBytes: changedByte(await workspaceBytes(PREREQUISITE)) },
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT"),
  );
  assert.deepEqual(await readFile(artifactPath), sentinel);
});

test("[writer-filesystem] rejects linked and non-file artifact destinations", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-writer-authority-");
  const target = path.join(directory, "target.json");
  const symbolic = path.join(directory, "symbolic.json");
  const hard = path.join(directory, "hard.json");
  const directoryTarget = path.join(directory, "directory.json");
  await writeFile(target, "existing target\n");
  await symlink(target, symbolic);
  await link(target, hard);
  await mkdir(directoryTarget);
  for (const artifactPath of [symbolic, hard, directoryTarget]) {
    await assert.rejects(
      writeEditorCoreSourceDocumentEvidence({ artifactPath }),
      expectedError("EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED"),
    );
  }
  assert.equal(await readFile(target, "utf8"), "existing target\n");
});

test("[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "runtimeApi", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return editorCore;
    },
  });
  const inherited = Object.create({ runtimeApi: editorCore });
  const symbol = { [Symbol("runtimeApi")]: editorCore };
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  for (const options of [{ unexpected: true }, accessor, inherited, symbol, proxy]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence(options),
      expectedError("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
  }
  if (typeof SharedArrayBuffer === "function") {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({
        prerequisiteBytes: new Uint8Array(new SharedArrayBuffer(8)),
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("[filesystem] rejects linked prerequisite, artifact, and proof authorities", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-authority-");
  const prerequisiteTarget = path.join(directory, "prerequisite-target.json");
  const prerequisiteSymbolic = path.join(directory, "prerequisite-symbolic.json");
  const prerequisiteHard = path.join(directory, "prerequisite-hard.json");
  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactSymbolic = path.join(directory, "artifact-symbolic.json");
  const artifactHard = path.join(directory, "artifact-hard.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofSymbolic = path.join(directory, "proof-symbolic.md");
  const proofHard = path.join(directory, "proof-hard.md");
  await writeFile(prerequisiteTarget, await workspaceBytes(PREREQUISITE));
  await symlink(prerequisiteTarget, prerequisiteSymbolic);
  await link(prerequisiteTarget, prerequisiteHard);
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactSymbolic);
  await link(artifactTarget, artifactHard);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(proofTarget, proofSymbolic);
  await link(proofTarget, proofHard);

  for (const prerequisitePath of [prerequisiteSymbolic, prerequisiteHard]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ prerequisitePath }),
      expectedError("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE"),
    );
  }
  for (const artifactPath of [artifactSymbolic, artifactHard]) {
    await assert.rejects(
      verifyEditorCoreSourceDocumentEvidence({
        artifactPath,
        proofDocument: exactProofDocument(built.artifactSha256),
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE"),
    );
  }
  for (const proofDocumentPath of [proofSymbolic, proofHard]) {
    await assert.rejects(
      verifyEditorCoreSourceDocumentEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentPath,
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE"),
    );
  }
});

test("[utf8] rejects invalid proof UTF-8 without normalization", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-utf8-");
  const proofDocumentPath = path.join(directory, "invalid-proof.md");
  await writeFile(proofDocumentPath, Uint8Array.of(0xff));
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath,
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_UTF8_INVALID"),
  );
});

test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {
  assertDeepFrozen(built.artifact);
  assert.equal(built.artifact.claim.semanticValidation, false);
  assert.equal(built.artifact.documentModel.directSourceRoot, true);
  assert.equal(built.artifact.documentModel.detached, true);
  assert.equal(built.artifact.boundary.platformImports, 0);
  assert.equal(built.artifact.boundary.executableAuthority, 0);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T02/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T07/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T08/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T09/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T10/u);
  assert.match(built.artifact.nonclaims.join("\n"), /G08/u);
  assert.equal(DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH, path.join(ROOT, ARTIFACT));
  assert.throws(() => {
    built.artifact.claim.taskStatus = "IN_PROGRESS";
  }, TypeError);
});
