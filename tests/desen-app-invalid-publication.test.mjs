import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import filesystem, {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PIN,
  DESEN_APP_INVALID_PUBLICATION_PARENT_PINS,
  DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES,
  DesenAppInvalidPublicationProofError,
  buildDesenAppInvalidPublicationEvidence,
  verifyDesenAppInvalidPublicationBrowserPolicy,
  verifyDesenAppInvalidPublicationEvidence,
  verifyDesenAppInvalidPublicationSourcePolicy,
  writeDesenAppInvalidPublicationEvidence,
} from "../scripts/lib/desen-app-invalid-publication-proof.mjs";
import {
  DesenAppPublishedHostUpdateProofError,
  verifyDesenAppPublishedHostUpdateGraphPolicy,
} from "../scripts/lib/desen-app-published-host-update-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json";
const REPORT = "docs/proof/DESEN-APP-INVALID-PUBLICATION.md";
const SOURCE_PATHS = Object.freeze({
  draft: "apps/desen-app/src/authoring-source-draft.ts",
  draftControls: "apps/desen-app/src/source-draft-controls.tsx",
  application: "apps/desen-app/src/application.tsx",
  inspector: "apps/desen-app/src/inspector-panel.tsx",
  diagnostics: "apps/desen-app/src/authoring-diagnostics.ts",
  diagnosticsPanel: "apps/desen-app/src/diagnostics-panel.tsx",
  publication: "apps/desen-app/src/authoring-publication.ts",
  preview: "apps/desen-app/src/authoring-preview.ts",
  profile: "apps/desen-app/src/project-workspace-profile.ts",
  referenceProfile: "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
  parser: "apps/desen-app/src/structured-json.ts",
});
const BROWSER_PATHS = Object.freeze({
  spec: "apps/desen-app-browser-e2e/invalid-publication.pw.ts",
  config: "apps/desen-app-browser-e2e/invalid-publication-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/published-host-proof-server.mjs",
});
const temporaries = [];
let artifactBytes;
let proofDocument;
let sourceInput;
let browserInput;
let built;

async function temporary() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t06-reader-")));
  temporaries.push(directory);
  return directory;
}

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppInvalidPublicationProofError);
    assert.equal(error.code, code);
    return true;
  };
}

function replaceOnce(source, marker, replacement) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Missing reviewed mutation marker ${marker}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + marker.length)}`;
}

function changedByte(bytes) {
  const copy = Buffer.from(bytes);
  copy[Math.floor(copy.byteLength / 2)] ^= 1;
  return copy;
}

async function inputFiles(paths) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, relativePath]) => [
        key,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
}

async function observeOpens(operation) {
  const original = filesystem.open;
  const observations = new Map();
  try {
    filesystem.open = async (...args) => {
      const key = String(args[0]);
      observations.set(key, (observations.get(key) ?? 0) + 1);
      return Reflect.apply(original, filesystem, args);
    };
    syncBuiltinESMExports();
    return await operation(observations);
  } finally {
    filesystem.open = original;
    syncBuiltinESMExports();
  }
}

before(async () => {
  [sourceInput, browserInput, artifactBytes, proofDocument] = await Promise.all([
    inputFiles(SOURCE_PATHS),
    inputFiles(BROWSER_PATHS),
    readFile(path.join(ROOT, ARTIFACT)),
    readFile(path.join(ROOT, REPORT)),
  ]);
  built = await buildDesenAppInvalidPublicationEvidence();
});

after(async () => {
  await Promise.all(
    temporaries.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[0], async () => {
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_INVALID_PUBLICATION_PARENT_PINS);
  for (const pin of DESEN_APP_INVALID_PUBLICATION_PARENT_PINS) {
    const bytes = await readFile(path.join(ROOT, pin.path));
    assert.equal(bytes.byteLength, pin.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.sha256);
    await assert.rejects(
      buildDesenAppInvalidPublicationEvidence({
        fileOverrides: new Map([[pin.path, changedByte(bytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }
  assert.equal(built.artifact.claim.lastKnownGoodCorruptionRecovery, false);
  assert.equal(built.artifact.claim.m10T07Closed, false);
  assert.equal(built.artifact.claim.g10Closed, false);
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[1], () => {
  const matrix = built.artifact.authority.publicApiMatrix;
  assert.deepEqual(matrix.publicRoots, [
    "@desen/publisher",
    "@desen/editor-core",
    "@desen/protocol",
  ]);
  assert.equal(matrix.invalidCases, 3);
  assert.equal(matrix.repairedCases, 3);
  assert.equal(matrix.publicPublisherCalls, 10);
  assert.equal(matrix.listenerStarted, false);
  assert.equal(matrix.publicationPortsSupplied, false);
  assert.equal(matrix.browserExecuted, false);
  assert.equal(matrix.compiledFiles, 43);
  assert.equal(matrix.compiledReceipts.length, matrix.compiledFiles);
  for (const name of ["editor-core", "protocol", "publisher", "validator"]) {
    assert.ok(
      matrix.compiledReceipts.some((receipt) => receipt.path === `packages/${name}/dist/index.js`),
    );
  }
  assert.deepEqual(
    matrix.cases.map((entry) => entry.kind),
    ["prop", "event", "slot"],
  );
  assert.deepEqual(
    matrix.cases.map((entry) => entry.diagnostic.code),
    ["PROP_TYPE_MISMATCH", "UNKNOWN_EVENT", "UNKNOWN_SLOT"],
  );
  const expectedTargets = ["sign-in.title", "sign-in.title", "sign-in.layout"];
  for (const [index, entry] of matrix.cases.entries()) {
    assert.equal(entry.stage, "capability-contracts");
    assert.equal(entry.structurallyAdmitted, true);
    assert.deepEqual(entry.rejectedResultKeys, ["diagnostics", "ok", "stage"]);
    assert.equal(entry.invalidSubjects.length, 1);
    assert.equal(entry.invalidSubjects[0].subject.id, expectedTargets[index]);
    assert.equal(entry.invalidSubjects[0].subject.kind, "node");
    assert.deepEqual(entry.invalidSubjects[0].diagnosticIndexes, [0]);
    assert.equal(entry.repaired.valid, true);
    assert.equal(entry.repaired.diagnostics, 0);
    assert.equal(entry.repaired.deterministicPublications, 2);
    assert.notEqual(entry.repaired.revision, matrix.baselineRevision);
    assert.ok(Object.isFrozen(entry.invalidSubjects[0]));
  }
  assert.equal(new Set(matrix.cases.map((entry) => entry.repaired.revision)).size, 3);
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[2], () => {
  const accepted = verifyDesenAppInvalidPublicationSourcePolicy(sourceInput);
  assert.equal(accepted.productCallbacksExecutedByPolicy, false);
  assert.equal(accepted.invalidSubjectsOwnNodeLinks, true);
  assert.equal(accepted.validRepairStillRequiresOrdinarySaveAndPublish, true);
  const mutations = [
    [
      "draft",
      "publishDesenSource(rawText, authority.profile.catalogPackages)",
      "acceptWithoutPublication(rawText, authority.profile.catalogPackages)",
    ],
    ["draft", "!publication.ok || !candidate.ok || report?.valid !== true", "false"],
    ["draft", 'reason: "invalid-source",', 'reason: "invalid-source", document: currentDocument,'],
    [
      "draft",
      "const parsed = parseInertJsonText(rawText);",
      "saveSource(); const parsed = parseInertJsonText(rawText);",
    ],
    ["draft", "digestCanonicalJson(current.document) !== baselineFingerprint", "false"],
    [
      "application",
      "if (!result.ok) {\n      replaceSourceDraft",
      "if (result.ok) {\n      replaceSourceDraft",
    ],
    [
      "application",
      "if (!allowSourceDraft && sourceDraftRef.current !== null) return false;",
      "if (!allowSourceDraft && sourceDraftRef.current !== null) return true;",
    ],
    ["diagnostics", "report.invalidSubjects", "report.diagnostics"],
    ["diagnosticsPanel", "onSelect(occurrence.selectionKey)", "onSelect(diagnostic.pointer)"],
  ];
  for (const [key, marker, replacement] of mutations) {
    assert.throws(
      () =>
        verifyDesenAppInvalidPublicationSourcePolicy({
          ...sourceInput,
          [key]: replaceOnce(sourceInput[key], marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  const commentLaundered =
    replaceOnce(sourceInput.draft, "parseInertJsonText(rawText)", "JSON.parse(rawText)") +
    "\n// parseInertJsonText(rawText)\n";
  assert.throws(
    () => verifyDesenAppInvalidPublicationSourcePolicy({ ...sourceInput, draft: commentLaundered }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[3], () => {
  const accepted = verifyDesenAppInvalidPublicationBrowserPolicy(browserInput);
  assert.equal(accepted.chromiumScenarios, 1);
  assert.equal(accepted.browserExecutedByVerifier, false);
  assert.equal(accepted.advancedInputIsNotVisualAuthoringProof, true);
  const mutations = [
    ["config", "reuseExistingServer: false", "reuseExistingServer: true"],
    ["config", "workers: 1", "workers: 2"],
    ["spec", 'test("rejects advanced', 'test.skip("rejects advanced'],
    [
      "spec",
      "const pageErrors: string[] = [];",
      "await page.evaluate(() => undefined); const pageErrors: string[] = [];",
    ],
    [
      "spec",
      "const pageErrors: string[] = [];",
      "await page.route('**/*', () => undefined); const pageErrors: string[] = [];",
    ],
    ["spec", "expect(writes).toEqual(writesBefore)", "expect(writes).toEqual(writes)"],
    ["spec", "await save(page, index + 3)", "await save(page, 1)"],
    [
      "spec",
      "expect(await hostBuildFingerprint(request)).toBe(buildIdentity)",
      "expect(buildIdentity).toBe(buildIdentity)",
    ],
  ];
  for (const [key, marker, replacement] of mutations) {
    assert.throws(
      () =>
        verifyDesenAppInvalidPublicationBrowserPolicy({
          ...browserInput,
          [key]: replaceOnce(browserInput[key], marker, replacement),
        }),
      expectedError("BROWSER_POLICY_VIOLATION"),
    );
  }
  assert.equal(built.artifact.authority.focusedTests.executedByVerifier, false);
  assert.equal(built.artifact.tests.publicApiMatrixExecutedByVerifier, true);
  assert.equal(built.artifact.tests.focusedTestsExecutedByVerifier, false);
  assert.equal(built.artifact.tests.browserExecutedByVerifier, false);
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[4], () => {
  const current = built.liveSuccessorAuthority.currentGraphAudit;
  assert.equal(built.liveSuccessorAuthority.task, "M10-T08");
  assert.equal(built.liveSuccessorAuthority.parentArtifactUnchanged, true);
  assert.deepEqual(built.liveSuccessorAuthority.historicalProjectionPaths, [
    "apps/desen-app-browser-e2e/package.json",
    "authority.currentGraphAudit",
  ]);
  assert.notDeepEqual(built.artifact.authority.currentGraphAudit, current);
  const historicalPackage = built.artifact.boundary.trackedReceipts.find(
    ({ path: name }) => name === "apps/desen-app-browser-e2e/package.json",
  );
  assert.notDeepEqual(built.liveSuccessorAuthority.currentBrowserPackageReceipt, historicalPackage);
  assert.equal(
    current.referenceHostSourceAudit.directOrHiddenHandwrittenManagedTreesRejected,
    true,
  );
  assert.equal(current.referenceHostSourceAudit.currentAuditUsesFreshSourceAndBuild, true);
  assert.equal(current.runtimeResolution.write, false);
  assert.equal(current.runtimeResolution.independentBuildsPerApplication, 2);
  assert.ok(current.appSourceAudit.inventory.includes(SOURCE_PATHS.draft));
  assert.ok(current.appSourceAudit.inventory.includes(SOURCE_PATHS.draftControls));
  assert.equal(built.artifact.boundary.currentGraphHasNoHistoricalProjection, true);
  assert.equal(
    built.artifact.boundary.trackedReceipts.some(
      ({ path: relativePath }) =>
        relativePath === "scripts/lib/desen-app-published-host-update-proof.mjs",
    ),
    false,
  );
  const graphInput = {
    appGraph: current.runtimeResolution.appModules,
    appSourcePaths: current.appSourceAudit.sourceReceipts
      .map((receipt) => receipt.path)
      .filter(
        (relativePath) => !current.appSourceAudit.fixtureOnlySourceFiles.includes(relativePath),
      ),
    hostGraph: current.runtimeResolution.hostModules,
    hostSourcePaths: current.referenceHostSourceAudit.sourceReceipts.map((receipt) => receipt.path),
  };
  assert.equal(
    verifyDesenAppPublishedHostUpdateGraphPolicy(graphInput).sharedManagedModuleCount,
    current.runtimeResolution.sharedManagedModuleCount,
  );
  for (const mutate of [
    (input) => {
      input.appGraph[0].dynamicImports.push("untrusted-runtime-module");
    },
    (input) => {
      input.hostGraph.push(structuredClone(input.hostGraph[0]));
    },
    (input) => {
      input.appSourcePaths = input.appSourcePaths.filter((entry) => entry !== SOURCE_PATHS.draft);
    },
  ]) {
    const changed = structuredClone(graphInput);
    mutate(changed);
    assert.throws(
      () => verifyDesenAppPublishedHostUpdateGraphPolicy(changed),
      (error) => {
        assert.ok(error instanceof DesenAppPublishedHostUpdateProofError);
        assert.equal(error.code, "VITE_GRAPH_DRIFT");
        return true;
      },
    );
  }
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[5], async () => {
  let traps = 0;
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        traps += 1;
        return [];
      },
      getPrototypeOf() {
        traps += 1;
        return Object.prototype;
      },
    },
  );
  const getter = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      traps += 1;
      return ROOT;
    },
  });
  for (const input of [
    null,
    proxy,
    getter,
    Object.create({ workspaceRoot: ROOT }),
    { extra: true },
    { [Symbol("authority")]: ROOT },
  ]) {
    await assert.rejects(
      buildDesenAppInvalidPublicationEvidence(input),
      expectedError("OPTIONS_INVALID"),
    );
  }
  for (const operation of [
    verifyDesenAppInvalidPublicationEvidence,
    writeDesenAppInvalidPublicationEvidence,
  ]) {
    for (const input of [
      null,
      proxy,
      { buildOptions: getter },
      { artifactPath: `${ROOT}/bad\0path` },
    ]) {
      await assert.rejects(operation(input), expectedError("OPTIONS_INVALID"));
    }
  }
  for (const map of [
    new Proxy(new Map(), {}),
    Object.assign(new Map(), { extra: true }),
    new Map([["../escape", Buffer.from("x")]]),
    new Map([[SOURCE_PATHS.draft, new Uint8Array(new SharedArrayBuffer(8))]]),
  ]) {
    await assert.rejects(
      buildDesenAppInvalidPublicationEvidence({ fileOverrides: map }),
      expectedError("OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    buildDesenAppInvalidPublicationEvidence({
      fileOverrides: new Map([[SOURCE_PATHS.draft, "x".repeat(2_097_153)]]),
    }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyDesenAppInvalidPublicationEvidence({ artifactBytes: proxy }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.throws(
    () => verifyDesenAppInvalidPublicationSourcePolicy(proxy),
    expectedError("OPTIONS_INVALID"),
  );
  assert.throws(
    () => verifyDesenAppInvalidPublicationBrowserPolicy(proxy),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(traps, 0);
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[6], async () => {
  const callerBytes = Buffer.from(sourceInput.draft);
  const packagePath = "apps/desen-app-browser-e2e/package.json";
  const packageBytes = await readFile(path.join(ROOT, packagePath));
  const callerMap = new Map([
    [SOURCE_PATHS.draft, callerBytes],
    [packagePath, packageBytes],
  ]);
  const again = await observeOpens(async (opens) => {
    const pending = buildDesenAppInvalidPublicationEvidence({ fileOverrides: callerMap });
    callerBytes.fill(0);
    callerMap.clear();
    const result = await pending;
    assert.ok(opens.get(path.join(ROOT, "packages/publisher/dist/index.js")) >= 2);
    assert.ok(opens.get(path.join(ROOT, SOURCE_PATHS.application)) >= 2);
    assert.ok(opens.get(path.join(ROOT, DESEN_APP_INVALID_PUBLICATION_PARENT_PINS[0].path)) >= 2);
    assert.ok(
      opens.get(path.join(ROOT, "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json")) >= 2,
    );
    return result;
  });
  assert.deepEqual(again.artifact, built.artifact);
  assert.deepEqual(again.artifactBytes, built.artifactBytes);
  assert.deepEqual(again.liveSuccessorAuthority, built.liveSuccessorAuthority);
  for (const mutate of [
    (value) => {
      value.scripts["test:e2e"] = value.scripts["test:e2e"].replace(
        " && playwright test --config repeatable-demo-playwright.config.ts",
        "",
      );
    },
    (value) => {
      value.scripts["test:e2e"] = value.scripts["test:e2e"].replace(
        " && playwright test --config restart-recovery-playwright.config.ts",
        "",
      );
    },
    (value) => {
      delete value.devDependencies["@desen/protocol"];
    },
  ]) {
    const value = JSON.parse(packageBytes);
    mutate(value);
    await assert.rejects(
      buildDesenAppInvalidPublicationEvidence({
        fileOverrides: new Map([[packagePath, JSON.stringify(value)]]),
      }),
      expectedError("TEST_AUTHORITY_DRIFT"),
    );
  }
  const metadataChange = JSON.parse(packageBytes);
  metadataChange.description += " unreviewed metadata";
  await assert.rejects(
    buildDesenAppInvalidPublicationEvidence({
      fileOverrides: new Map([[packagePath, JSON.stringify(metadataChange)]]),
    }),
    expectedError("SUCCESSOR_DRIFT"),
  );
  assert.notEqual(again.artifact, built.artifact);
  assert.notEqual(
    again.artifact.authority.publicApiMatrix,
    built.artifact.authority.publicApiMatrix,
  );
  const missingTest = replaceOnce(
    await readFile(path.join(ROOT, "apps/desen-app/test/authoring-source-draft.test.ts"), "utf8"),
    "rejects invalid %s through the real Publisher with exact node-linked diagnostics and no partial authority",
    "an unrelated test",
  );
  await assert.rejects(
    buildDesenAppInvalidPublicationEvidence({
      fileOverrides: new Map([["apps/desen-app/test/authoring-source-draft.test.ts", missingTest]]),
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[7], async () => {
  assert.equal(artifactBytes.byteLength, DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PIN.bytes);
  assert.equal(
    createHash("sha256").update(artifactBytes).digest("hex"),
    DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PIN.sha256,
  );
  assert.deepEqual(built.artifactBytes, artifactBytes);
  await assert.rejects(
    verifyDesenAppInvalidPublicationEvidence({ artifactBytes: changedByte(artifactBytes) }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppInvalidPublicationEvidence({
      artifactBytes: JSON.stringify({ ...built.artifact, result: "FAIL" }),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppInvalidPublicationEvidence({
      artifactBytes,
      proofDocument: replaceOnce(
        proofDocument.toString("utf8"),
        "Status: DONE",
        "Status: PASS WITHOUT TESTS",
      ),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppInvalidPublicationEvidence({
      artifactBytes,
      proofDocument: `${proofDocument.toString("utf8")}\nFinal artifact: forged\n`,
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  const verified = await verifyDesenAppInvalidPublicationEvidence();
  assert.equal(verified.result, "PASS");
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.equal(verified.publicApiMatrixExecutedByVerifier, true);
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[8], async () => {
  const directory = await temporary();
  const link = path.join(directory, "evidence-link.json");
  const copiedArtifact = path.join(directory, "evidence.json");
  await writeFile(copiedArtifact, artifactBytes);
  await symlink(copiedArtifact, link);
  for (const artifactPath of [link, directory, path.join(directory, "missing.json")]) {
    await assert.rejects(
      verifyDesenAppInvalidPublicationEvidence({ artifactPath }),
      expectedError("AUTHORITY_UNSAFE"),
    );
  }
  await assert.rejects(
    buildDesenAppInvalidPublicationEvidence({ workspaceRoot: directory }),
    expectedError("AUTHORITY_UNSAFE"),
  );
  const originalOpen = filesystem.open;
  let replaced = false;
  try {
    filesystem.open = async (...args) => {
      if (String(args[0]) === path.join(ROOT, SOURCE_PATHS.application) && !replaced) {
        replaced = true;
        await writeFile(copiedArtifact, changedByte(artifactBytes));
      }
      return Reflect.apply(originalOpen, filesystem, args);
    };
    syncBuiltinESMExports();
    await assert.rejects(
      verifyDesenAppInvalidPublicationEvidence({ artifactPath: copiedArtifact }),
      expectedError("ARTIFACT_DRIFT"),
    );
  } finally {
    filesystem.open = originalOpen;
    syncBuiltinESMExports();
  }
  assert.equal(replaced, true);
  assert.deepEqual(await readFile(path.join(ROOT, ARTIFACT)), artifactBytes);
});

test(DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES[9], async () => {
  const directory = await temporary();
  const destination = path.join(directory, "evidence.json");
  const written = await writeDesenAppInvalidPublicationEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), artifactBytes);
  await assert.rejects(
    writeDesenAppInvalidPublicationEvidence({
      artifactPath: destination,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "changed temporary bytes");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), artifactBytes);
  const link = path.join(directory, "frozen-link.json");
  await symlink(destination, link);
  await assert.rejects(
    writeDesenAppInvalidPublicationEvidence({ artifactPath: link }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), artifactBytes);
  const badDirectory = path.join(directory, "directory.json");
  await mkdir(badDirectory);
  await assert.rejects(
    writeDesenAppInvalidPublicationEvidence({ artifactPath: badDirectory }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(path.join(ROOT, ARTIFACT)), artifactBytes);
});
