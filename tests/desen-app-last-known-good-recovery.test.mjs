import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import filesystem, { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PIN as PIN,
  DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS as PARENTS,
  DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ROOT_TEST_NAMES as NAMES,
  DesenAppLastKnownGoodRecoveryProofError,
  buildDesenAppLastKnownGoodRecoveryEvidence as build,
  buildCurrentDesenAppLastKnownGoodRecoveryObservation as observe,
  runDesenAppLastKnownGoodRecoveryPublicMatrix as matrix,
  verifyDesenAppLastKnownGoodRecoveryBrowserPolicy as browserPolicy,
  verifyDesenAppLastKnownGoodRecoveryEvidence as verify,
  writeDesenAppLastKnownGoodRecoveryEvidence as write,
} from "../scripts/lib/desen-app-last-known-good-recovery-proof.mjs";
import { projectM10AT01CurrentGraphAudit } from "../scripts/lib/desen-app-published-host-update-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-last-known-good-recovery.json";
const REPORT = "docs/proof/DESEN-APP-LAST-KNOWN-GOOD-RECOVERY.md";
const SOURCE = "examples/sign-in/official-derived.source.desen.json";
const SUCCESSOR = "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json";
const temporaries = [];
let artifactBytes;
let proofDocument;
let browser;
let built;
let finalCompiledReadOrdinal = 0;
let m10aSuccessorReads = 0;

function errorCode(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppLastKnownGoodRecoveryProofError);
    assert.equal(error.code, code);
    return true;
  };
}
function changed(bytes) {
  const copy = Buffer.from(bytes);
  copy[Math.floor(copy.length / 2)] ^= 1;
  return copy;
}
async function temporary() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t07-reader-")));
  temporaries.push(root);
  return root;
}
function replace(source, marker, replacement) {
  assert.ok(source.includes(marker), `Missing reviewed mutation marker ${marker}`);
  return source.replace(marker, replacement);
}
async function substituteRead(relativePath, occurrence, operation) {
  const original = filesystem.open;
  let count = 0;
  filesystem.open = async (...args) => {
    const handle = await Reflect.apply(original, filesystem, args);
    if (args[0] !== path.join(ROOT, relativePath) || ++count !== occurrence) return handle;
    return {
      stat: (...values) => handle.stat(...values),
      read: async (...values) => {
        const result = await handle.read(...values);
        if (result.bytesRead > 0 && values[3] === 0) values[0][0] ^= 1;
        return result;
      },
      close: () => handle.close(),
    };
  };
  syncBuiltinESMExports();
  try {
    return await operation();
  } finally {
    filesystem.open = original;
    syncBuiltinESMExports();
  }
}

before(async () => {
  artifactBytes = await readFile(path.join(ROOT, ARTIFACT));
  proofDocument = await readFile(path.join(ROOT, REPORT));
  browser = Object.fromEntries(
    await Promise.all(
      [
        ["spec", "restart-recovery.pw.ts"],
        ["config", "restart-recovery-playwright.config.ts"],
        ["server", "restart-recovery-proof-server.mjs"],
      ].map(async ([key, name]) => [
        key,
        await readFile(path.join(ROOT, "apps/desen-app-browser-e2e", name), "utf8"),
      ]),
    ),
  );
  const original = filesystem.open;
  filesystem.open = async (...args) => {
    if (args[0] === path.join(ROOT, "packages/protocol/dist/index.js")) finalCompiledReadOrdinal++;
    if (args[0] === path.join(ROOT, "docs/proof/artifacts/m10a-t01.json")) {
      m10aSuccessorReads++;
    }
    return Reflect.apply(original, filesystem, args);
  };
  syncBuiltinESMExports();
  try {
    built = await build();
  } finally {
    filesystem.open = original;
    syncBuiltinESMExports();
  }
  assert.ok(finalCompiledReadOrdinal >= 3);
  assert.ok(m10aSuccessorReads >= 2);
});
after(async () => {
  for (const root of temporaries) await rm(root, { recursive: true, force: true });
});

test(NAMES[0], async () => {
  assert.equal(PARENTS.length, 4);
  assert.deepEqual(built.artifact.prerequisites, PARENTS);
  for (const pin of PARENTS) {
    const bytes = await readFile(path.join(ROOT, pin.path));
    assert.equal(bytes.length, pin.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.sha256);
    await assert.rejects(
      build({ fileOverrides: new Map([[pin.path, changed(bytes)]]) }),
      errorCode("PARENT_DRIFT"),
    );
  }
});

test(NAMES[1], () => {
  const matrix = built.liveSuccessorAuthority.publicApiMatrix;
  assert.equal(built.liveSuccessorAuthority.task, "M10-T08");
  assert.deepEqual(built.liveSuccessorAuthority.m10aT01, {
    task: "M10A-T01",
    path: "docs/proof/artifacts/m10a-t01.json",
    bytes: 13_910,
    sha256: "711f74398fb1d250d392dd4ff1145527cdaa7ca8673e811c7f753d211554cc74",
  });
  assert.equal(built.liveSuccessorAuthority.currentObservationsAreNotHistoricalResults, true);
  const historical = built.artifact.authority.publicApiMatrix;
  assert.deepEqual(
    {
      ...matrix,
      freshEmission: historical.freshEmission,
      compiledModuleReceipts: historical.compiledModuleReceipts,
    },
    historical,
  );
  assert.equal(matrix.result, "PASS");
  assert.deepEqual(
    matrix.invalidCandidates.map(({ id, stage, diagnostics }) => ({ id, stage, diagnostics })),
    [
      {
        id: "corrupt-revision",
        stage: "bundle-revision",
        diagnostics: [{ code: "REVISION_MISMATCH", pointer: "/revision" }],
      },
      {
        id: "catalog-mismatch",
        stage: "package-digest",
        diagnostics: [{ code: "CATALOG_DIGEST_MISMATCH", pointer: "/requires/catalogs/0/digest" }],
      },
    ],
  );
  assert.deepEqual(matrix.firstActivation, matrix.recoveredA);
  assert.deepEqual(matrix.finalActivation, matrix.recoveredC);
  assert.equal(matrix.finalActivation.previousGoodRevision, matrix.firstActivation.activeRevision);
  assert.equal(matrix.finalActivation.generation, 1);
  assert.equal(matrix.serviceReopenCount, 2);
  assert.deepEqual(matrix.recoveryNegatives, [
    "cloned-active-authority",
    "missing-previous-good-authority",
    "swapped-durable-role-authorities",
  ]);
  assert.equal(matrix.rejectedCandidatesNeverActivated, true);
  assert.equal(matrix.immutableValidBundlesPreserved, true);
  assert.equal(matrix.listenerStarted, false);
  assert.equal(matrix.productProcessRestartExecuted, false);
  assert.equal(matrix.browserExecuted, false);
  assert.equal(matrix.freshEmission.typecheckExecuted, false);
  assert.equal(matrix.freshEmission.workspaceWrites, false);
  assert.equal(matrix.freshEmission.rootCount, 6);
  assert.equal(matrix.freshEmission.moduleCount, matrix.compiledModuleCount);
  assert.equal(matrix.freshEmission.sourceCount, matrix.compiledModuleCount);
  for (const name of [
    "tsconfig.base.json",
    "tsconfig.node.json",
    "apps/control-plane-api/tsconfig.build.json",
    "apps/reference-host-web-server/tsconfig.build.json",
  ])
    assert.ok(matrix.freshEmission.inputReceipts.some((receipt) => receipt.path === name));
});

test(NAMES[2], () => {
  const checked = browserPolicy(browser);
  assert.equal(checked.declarationOnly, true);
  assert.equal(checked.browserExecutedByVerifier, false);
  assert.equal(checked.productProcessRestartExecutedByVerifier, false);
  assert.equal(checked.traceConfigurationIsNotSecretsAudit, true);
  const mutations = [
    [
      "spec",
      "const evidence: unknown[] = [RESTART_RECOVERY_EVIDENCE, composition.initial];",
      "return; const evidence: unknown[] = [RESTART_RECOVERY_EVIDENCE, composition.initial];",
    ],
    ["spec", "const revisionD = await saveAndPublish(page, 4);", "const revisionD = revisionC;"],
    [
      "spec",
      "expect(final.builds.host).toBe(baseline.builds.host);",
      "expect(final.builds.host).toBeDefined();",
    ],
    ["spec", 'test("preserves last-known-good', 'test.skip("preserves last-known-good'],
    [
      "spec",
      "const restarted = await composition.restart();",
      "const restarted = composition.initial;",
    ],
    [
      "spec",
      "expect(restarted.pid).not.toBe(beforeRestart.pid);",
      "expect(restarted.pid).toBe(beforeRestart.pid);",
    ],
    [
      "spec",
      "expect(afterRestart.channel).toEqual(rejected.channel);",
      "expect(afterRestart.channel).toBeDefined();",
    ],
    [
      "spec",
      "expect(afterRestart.activeRecord).toEqual(baseline.activeRecord);",
      "expect(afterRestart.activeRecord).toBeDefined();",
    ],
    [
      "spec",
      "expect(afterRestart.source).toEqual(baseline.source);",
      "expect(afterRestart.source).toBeDefined();",
    ],
    [
      "spec",
      "expect(afterRestart.candidate).toEqual(rejected.candidate);",
      "expect(afterRestart.candidate).toBeDefined();",
    ],
    ["spec", "await context.close();", "await page.evaluate(() => undefined);"],
    ["config", "retries: 0", "retries: 2"],
    ["config", "workers: 1", "workers: 2"],
    ["server", 'from "@desen/protocol"', 'from "../../packages/protocol/src/revision.ts"'],
    ["server", "message.id === lastRequestId + 1", "message.id >= lastRequestId"],
  ];
  for (const [key, marker, replacement] of mutations)
    assert.throws(
      () => browserPolicy({ ...browser, [key]: replace(browser[key], marker, replacement) }),
      errorCode("BROWSER_POLICY_VIOLATION"),
    );
  assert.deepEqual(
    browserPolicy({ ...browser, spec: browser.spec + "\n// inert review comment\n" }),
    checked,
  );
});

test(NAMES[3], async () => {
  const graph = built.liveSuccessorAuthority.currentGraphAudit;
  const predecessor = JSON.parse(await readFile(path.join(ROOT, PARENTS[1].path), "utf8"));
  const successor = JSON.parse(await readFile(path.join(ROOT, SUCCESSOR), "utf8"));
  assert.deepEqual(
    built.artifact.authority.currentGraphAudit,
    predecessor.authority.currentGraphAudit,
  );
  assert.notDeepEqual(graph, predecessor.authority.currentGraphAudit);
  assert.notDeepEqual(graph, successor.authority.currentGraphAudit);
  assert.deepEqual(
    projectM10AT01CurrentGraphAudit(graph, successor.authority.currentGraphAudit),
    successor.authority.currentGraphAudit,
  );
  const unrelatedGraphDrift = structuredClone(graph);
  unrelatedGraphDrift.runtimeResolution.host.moduleCount += 1;
  assert.throws(() =>
    projectM10AT01CurrentGraphAudit(unrelatedGraphDrift, successor.authority.currentGraphAudit),
  );
  assert.deepEqual(await observe(), {
    publicApiMatrix: built.liveSuccessorAuthority.publicApiMatrix,
    currentGraphAudit: graph,
  });
  assert.equal(graph.runtimeResolution.write, false);
  assert.equal(graph.runtimeResolution.independentBuildsPerApplication, 2);
  assert.equal(graph.runtimeResolution.noHandwrittenHostManagedTreePreservedByFreshHostAudit, true);
  assert.equal(built.artifact.boundary.currentGraphHasNoHistoricalProjection, true);
  assert.ok(
    graph.appSourceAudit.inventory.includes("apps/desen-app/src/authoring-source-draft.ts"),
  );
  assert.ok(
    graph.appSourceAudit.inventory.includes("apps/desen-app/src/source-draft-controls.tsx"),
  );
});

test(NAMES[4], async () => {
  let called = 0;
  const hostile = [
    null,
    [],
    new Proxy(
      {},
      {
        ownKeys() {
          called++;
          throw new Error("trap");
        },
      },
    ),
    Object.create({ workspaceRoot: ROOT }),
    {
      get workspaceRoot() {
        called++;
        return ROOT;
      },
    },
    { workspaceRoot: ROOT + "\0" },
    { unknown: true },
    { [Symbol("hidden")]: true },
  ];
  for (const value of hostile)
    for (const method of [build, matrix, observe, verify, write])
      await assert.rejects(method(value), errorCode("OPTIONS_INVALID"));
  for (const value of [
    null,
    new Proxy(new Map(), {}),
    new Map([["../foreign", "x"]]),
    new Map([[SOURCE, new Uint8Array(new SharedArrayBuffer(8))]]),
  ])
    await assert.rejects(build({ fileOverrides: value }), errorCode("OPTIONS_INVALID"));
  assert.throws(
    () =>
      browserPolicy(
        new Proxy(
          {},
          {
            ownKeys() {
              called++;
              return [];
            },
          },
        ),
      ),
    errorCode("OPTIONS_INVALID"),
  );
  assert.equal(called, 0);
  for (const value of [
    { fileOverrides: new Map() },
    { artifactBytes },
    { currentGraphAudit: built.liveSuccessorAuthority.currentGraphAudit },
  ])
    await assert.rejects(observe(value), errorCode("OPTIONS_INVALID"));
});

test(NAMES[5], async () => {
  const source = await readFile(path.join(ROOT, SOURCE));
  const supplied = Buffer.from(source);
  const overrides = new Map([[SOURCE, supplied]]);
  const pending = build({ fileOverrides: overrides });
  supplied.fill(0);
  overrides.clear();
  assert.deepEqual((await pending).artifactBytes, artifactBytes);
  await substituteRead(SOURCE, 2, () =>
    assert.rejects(build(), errorCode("SOURCE_SNAPSHOT_DRIFT")),
  );
  // A stale/tampered compiled receipt is rejected against fresh current TS emission before import.
  await substituteRead("packages/protocol/dist/index.js", 1, () =>
    assert.rejects(matrix(), errorCode("PUBLIC_API_DRIFT")),
  );
  await substituteRead("packages/protocol/dist/index.js", finalCompiledReadOrdinal, () =>
    assert.rejects(build(), errorCode("PUBLIC_API_DRIFT")),
  );
  for (const ordinal of [1, 2]) {
    await substituteRead(SUCCESSOR, ordinal, () =>
      assert.rejects(build(), errorCode("SUCCESSOR_DRIFT")),
    );
  }
  for (const ordinal of [1, 2]) {
    await substituteRead("docs/proof/artifacts/m10a-t01.json", ordinal, () =>
      assert.rejects(build(), errorCode("SUCCESSOR_DRIFT")),
    );
  }
  const packagePath = "apps/desen-app-browser-e2e/package.json";
  const packageBytes = await readFile(path.join(ROOT, packagePath));
  const packageJson = JSON.parse(packageBytes);
  for (const script of [
    packageJson.scripts["test:e2e"].replace(
      " && playwright test --config repeatable-demo-playwright.config.ts",
      "",
    ),
    packageJson.scripts["test:e2e"] + " && true",
  ]) {
    await assert.rejects(
      build({
        fileOverrides: new Map([
          [
            packagePath,
            Buffer.from(
              JSON.stringify({
                ...packageJson,
                scripts: { ...packageJson.scripts, "test:e2e": script },
              }),
            ),
          ],
        ]),
      }),
      errorCode("TEST_AUTHORITY_DRIFT"),
    );
  }
  for (const name of [
    "pnpm-lock.yaml",
    "dependency-cruiser.config.cjs",
    "scripts/verify-boundary-fixtures.mjs",
  ]) {
    await assert.rejects(
      build({ fileOverrides: new Map([[name, Buffer.from("forged M10A-T01 successor")]]) }),
      errorCode("SUCCESSOR_DRIFT"),
    );
  }
});

test(NAMES[6], async () => {
  assert.equal(artifactBytes.length, PIN.bytes);
  assert.equal(createHash("sha256").update(artifactBytes).digest("hex"), PIN.sha256);
  assert.deepEqual(built.artifactBytes, artifactBytes);
  const positive = await verify({ artifactBytes, proofDocument });
  assert.equal(positive.result, "PASS");
  assert.equal(positive.productProcessRestartExecutedByVerifier, false);
  assert.equal(positive.freshTypeScriptEmissionCompared, true);
  await assert.rejects(
    verify({ artifactBytes: changed(artifactBytes), proofDocument }),
    errorCode("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verify({
      artifactBytes,
      proofDocument: proofDocument.toString().replace("Status: DONE", "Status: IN_PROGRESS"),
    }),
    errorCode("PROOF_DOCUMENT_DRIFT"),
  );
});

test(NAMES[7], async () => {
  const root = await temporary();
  const copy = path.join(root, "copy.json");
  const link = path.join(root, "link.json");
  await writeFile(copy, artifactBytes);
  await symlink(copy, link);
  await assert.rejects(
    verify({ artifactPath: link, proofDocument }),
    errorCode("AUTHORITY_UNSAFE"),
  );
  await writeFile(copy, changed(artifactBytes));
  await assert.rejects(verify({ artifactPath: copy, proofDocument }), errorCode("ARTIFACT_DRIFT"));
});

test(NAMES[8], async () => {
  const root = await temporary();
  const destination = path.join(root, "evidence.json");
  const link = path.join(root, "link.json");
  const initial = Buffer.from("original recoverable destination\n");
  await writeFile(destination, initial);
  await symlink(destination, link);
  await assert.rejects(write({ artifactPath: link }), errorCode("ARTIFACT_WRITE_UNSAFE"));
  await assert.rejects(
    write({
      artifactPath: destination,
      beforeAtomicRename: () => {
        throw new Error("bounded interruption");
      },
    }),
    errorCode("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), initial);
  const result = await write({ artifactPath: destination });
  assert.equal(result.artifactSha256, PIN.sha256);
  assert.deepEqual(await readFile(destination), artifactBytes);
  assert.deepEqual(await readFile(path.join(ROOT, ARTIFACT)), artifactBytes);
  await assert.rejects(
    write({
      buildOptions: {
        fileOverrides: new Map([
          [
            "apps/desen-app-browser-e2e/restart-recovery.pw.ts",
            browser.spec + "\n// changed candidate receipt\n",
          ],
        ]),
      },
    }),
    // Current successor admission rejects an unreviewed historical input before any write.
    errorCode("SUCCESSOR_DRIFT"),
  );
  assert.deepEqual(await readFile(path.join(ROOT, ARTIFACT)), artifactBytes);
});
