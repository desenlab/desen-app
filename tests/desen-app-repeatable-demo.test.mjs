import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import filesystem, { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { runInNewContext } from "node:vm";

import {
  DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PIN as PIN,
  DESEN_APP_REPEATABLE_DEMO_PARENT_PINS as PARENTS,
  DESEN_APP_REPEATABLE_DEMO_ROOT_TEST_NAMES as NAMES,
  DesenAppRepeatableDemoProofError,
  buildDesenAppRepeatableDemoEvidence as build,
  verifyDesenAppRepeatableDemoBrowserPolicy as browserPolicy,
  verifyDesenAppRepeatableDemoRootWiring as rootWiring,
  verifyDesenAppRepeatableDemoEvidence as verify,
  writeDesenAppRepeatableDemoEvidence as write,
} from "../scripts/lib/desen-app-repeatable-demo-proof.mjs";
import { projectM10AT01CurrentGraphAudit } from "../scripts/lib/desen-app-published-host-update-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json";
const REPORT = "docs/proof/DESEN-APP-REPEATABLE-DEMO.md";
const MODULE = "apps/desen-app/dev/local-demo-host.mjs";
const COMPILED = "packages/protocol/dist/index.js";
const temporaries = [];
let artifactBytes;
let proofDocument;
let browser;
let built;
let finalCompiledReadOrdinal = 0;
let finalModuleReadOrdinal = 0;
let m10aSuccessorReads = 0;
function errorCode(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppRepeatableDemoProofError);
    assert.equal(error.code, code);
    return true;
  };
}
function changed(bytes) {
  const copy = Buffer.from(bytes);
  copy[Math.floor(copy.length / 2)] ^= 1;
  return copy;
}
function replace(source, marker, replacement) {
  assert.ok(source.includes(marker), "The reviewed mutation marker is present.");
  return source.replace(marker, replacement);
}
async function temporary() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t08-reader-")));
  temporaries.push(root);
  return root;
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
        ["spec", "repeatable-demo.pw.ts"],
        ["authoring", "repeatable-demo-authoring.ts"],
        ["config", "repeatable-demo-playwright.config.ts"],
        ["server", "repeatable-demo-proof-server.mjs"],
      ].map(async ([key, name]) => [
        key,
        await readFile(path.join(ROOT, "apps/desen-app-browser-e2e", name), "utf8"),
      ]),
    ),
  );
  const original = filesystem.open;
  filesystem.open = async (...args) => {
    if (args[0] === path.join(ROOT, COMPILED)) finalCompiledReadOrdinal++;
    if (args[0] === path.join(ROOT, MODULE)) finalModuleReadOrdinal++;
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
  assert.ok(finalModuleReadOrdinal >= 3);
  assert.ok(m10aSuccessorReads >= 2);
});
after(async () => {
  for (const root of temporaries) await rm(root, { recursive: true, force: true });
});

test(NAMES[0], async () => {
  assert.equal(PARENTS.length, 8);
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
test(NAMES[1], async () => {
  const matrix = built.artifact.authority.normalResetMatrix;
  assert.equal(matrix.api, "acquireDesenAppDemoState");
  assert.equal(matrix.resets, 2);
  for (const key of [
    "initialEmpty",
    "exclusiveLease",
    "reopenPreserves",
    "previousGenerationRetained",
    "olderBackupPruned",
    "unownedMarkerRejected",
    "symlinkRejected",
    "siblingPreserved",
    "noSourceSeed",
    "noListener",
    "leaseReleased",
    "freshProcess",
    "ownedOsTemporaryWorkspace",
    "noProductionHostStarted",
  ])
    assert.equal(matrix[key], true, key);
  assert.equal(matrix.moduleReceipts.length, 4);
  for (const receipt of matrix.moduleReceipts)
    assert.deepEqual(
      receipt,
      built.artifact.boundary.trackedReceipts.find((row) => row.path === receipt.path),
    );
  assert.equal(built.artifact.tests.normalResetMatrixExecutedByVerifier, true);
  assert.equal(built.artifact.tests.productHostStartedByVerifier, false);
  // Exercise the exact child guard fragment against inert stand-ins. These never construct a
  // Server or call the real network implementation, and do not substitute the product reset API.
  const reader = await readFile(
    path.join(ROOT, "scripts/lib/desen-app-repeatable-demo-proof.mjs"),
    "utf8",
  );
  const fragments = [...reader.matchAll(/const RESET_LISTENER_GUARD = String.raw`([^`]+)`;/gu)];
  assert.equal(fragments.length, 1);
  const fragment = fragments[0][1];
  const marker = Symbol.for("desen.ci.no-proof-listener.v2");
  const deny = () => {
    const error = new Error("Proof workloads may not bind network listeners.");
    error.code = "DESEN_CI_LISTENER_FORBIDDEN";
    throw error;
  };
  function guardContext(listen, frozen, markerDescriptor) {
    const prototype = {};
    Object.defineProperty(prototype, "listen", {
      value: listen,
      writable: !frozen,
      configurable: !frozen,
      enumerable: true,
    });
    const context = { assert, Error, Server: { prototype } };
    if (markerDescriptor !== undefined) Object.defineProperty(context, marker, markerDescriptor);
    return context;
  }
  const exactMarker = { value: true, writable: false, enumerable: false, configurable: false };
  const direct = guardContext(
    () => assert.fail("A replaced mutable method must never execute."),
    false,
  );
  runInNewContext(fragment, direct, { timeout: 1_000 });
  assert.equal(Object.getOwnPropertyDescriptor(direct.Server.prototype, "listen").writable, false);
  const inherited = guardContext(deny, true, exactMarker);
  runInNewContext(fragment, inherited, { timeout: 1_000 });
  assert.equal(inherited.Server.prototype.listen, deny);
  for (const context of [
    guardContext(deny, true),
    guardContext(deny, true, { ...exactMarker, value: false }),
    guardContext(deny, true, { ...exactMarker, writable: true }),
    guardContext(() => undefined, true, exactMarker),
    guardContext(
      () => {
        throw new TypeError("Native listener needs a receiver.");
      },
      true,
      exactMarker,
    ),
    guardContext(
      () => {
        const error = new Error("different denial");
        error.code = "DESEN_CI_LISTENER_FORBIDDEN";
        throw error;
      },
      true,
      exactMarker,
    ),
  ])
    assert.throws(() => runInNewContext(fragment, context, { timeout: 1_000 }));
  let getterCalls = 0;
  const accessor = { assert, Error, Server: { prototype: {} } };
  Object.defineProperty(accessor.Server.prototype, "listen", {
    get() {
      getterCalls++;
      return deny;
    },
  });
  assert.throws(() => runInNewContext(fragment, accessor, { timeout: 1_000 }));
  assert.equal(getterCalls, 0);
});
test(NAMES[2], () => {
  const checked = browserPolicy(browser);
  assert.equal(checked.declarationOnly, true);
  assert.equal(checked.browserExecutedByVerifier, false);
  assert.equal(checked.declaredCycles, 2);
  assert.equal(checked.operationAlias, "submitCredentials");
  assert.equal(checked.equalityNormalizesInputs, false);
  assert.equal(checked.traceNetworkSnapshots, false);
  assert.equal(checked.traceSources, false);
  assert.equal(checked.traceAttachments, false);
  assert.equal(checked.traceScreenshots, true);
  const mutations = [
    ["spec", "for (const cycle of [1, 2])", "for (const cycle of [1])"],
    ["spec", "const evidence: {", "return; const evidence: {"],
    ["spec", 'test("recreates one visible', 'test.skip("recreates one visible'],
    ["spec", "await context.close();", "await page.evaluate(() => undefined);"],
    [
      "spec",
      "expect(exact[0]?.initial.sourceBytes === exact[1]?.initial.sourceBytes).toBe(true);",
      "expect(true).toBe(true);",
    ],
    [
      "spec",
      "expect(exact[0]?.updated.bundleBytes === exact[1]?.updated.bundleBytes).toBe(true);",
      "expect(exact[0]?.updated.bundleBytes?.trim() === exact[1]?.updated.bundleBytes?.trim()).toBe(true);",
    ],
    ["spec", "expect(gapB).toBeGreaterThan(gapA + 8);", "expect(gapB).toBeDefined();"],
    [
      "spec",
      "expect(await readDemoHostFingerprint(request, composition.hostOrigin)).toBe(hostBuild);",
      "expect(hostBuild).toBeDefined();",
    ],
    [
      "authoring",
      'export const DEMO_OPERATION_ALIAS = "submitCredentials";',
      'export const DEMO_OPERATION_ALIAS = "signIn";',
    ],
    [
      "authoring",
      "canonicalizeJson(source) === sourceBytes",
      "canonicalizeJson(source) === canonicalizeJson(source)",
    ],
    [
      "authoring",
      "await title.locator(\"[data-component-drag-handle='true']\").dragTo(target);",
      "await title.click();",
    ],
    [
      "authoring",
      "expect(writes.operationCalls()).toBe(0);",
      "expect(writes.operationCalls()).toBeGreaterThanOrEqual(0);",
    ],
    [
      "authoring",
      "expect((await denied).status()).toBe(401);",
      "expect((await denied).status()).toBeDefined();",
    ],
    [
      "authoring",
      "expect((await succeeded).status()).toBe(200);",
      "expect((await succeeded).status()).toBeDefined();",
    ],
    ["config", "retries: 0", "retries: 2"],
    ["config", "workers: 1", "workers: 2"],
    ["config", "snapshots: false", "snapshots: true"],
    ["server", "reset: true", "reset: false"],
    ["server", "await starting;", "await Promise.resolve();"],
    [
      "server",
      'from "../desen-app/dev/local-demo-host.mjs"',
      'from "../desen-app/src/application.js"',
    ],
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
test(NAMES[3], () => {
  const { publicApiMatrix: matrix, currentGraphAudit: historicalGraph } = built.artifact.authority;
  const graph = built.liveSuccessorAuthority.currentGraphAudit;
  assert.equal(built.liveSuccessorAuthority.task, "M10A-T01");
  assert.equal(built.liveSuccessorAuthority.predecessorTask, "M10-T08");
  assert.equal(built.liveSuccessorAuthority.currentObservationsAreNotHistoricalResults, true);
  assert.notDeepEqual(graph, historicalGraph);
  assert.deepEqual(projectM10AT01CurrentGraphAudit(graph, historicalGraph), historicalGraph);
  assert.equal(matrix.result, "PASS");
  assert.equal(matrix.listenerStarted, false);
  assert.equal(matrix.browserExecuted, false);
  assert.equal(matrix.rejectedCandidatesNeverActivated, true);
  assert.deepEqual(
    matrix.invalidCandidates.map((row) => row.diagnostics[0].code),
    ["REVISION_MISMATCH", "CATALOG_DIGEST_MISMATCH"],
  );
  assert.equal(matrix.freshEmission.workspaceWrites, false);
  assert.equal(matrix.freshEmission.typecheckExecuted, false);
  assert.equal(matrix.freshEmission.rootCount, 6);
  assert.equal(matrix.freshEmission.moduleCount, matrix.compiledModuleCount);
  assert.equal(matrix.freshEmission.inputReceipts.length, 442);
  assert.equal(graph.runtimeResolution.write, false);
  assert.equal(graph.runtimeResolution.independentBuildsPerApplication, 2);
  assert.equal(graph.runtimeResolution.noHandwrittenHostManagedTreePreservedByFreshHostAudit, true);
  assert.equal(built.artifact.boundary.currentGraphHasNoHistoricalProjection, true);
  assert.equal(built.artifact.tests.browserExecutedByVerifier, false);
  assert.equal(built.artifact.tests.deterministicReaderStartsListener, false);
  assert.equal(built.artifact.claim.g10Closed, false);
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
    { unknown: true },
    { [Symbol("hidden")]: true },
  ];
  for (const value of hostile)
    for (const method of [build, verify, write])
      await assert.rejects(method(value), errorCode("OPTIONS_INVALID"));
  for (const value of [
    null,
    new Proxy(new Map(), {}),
    new Map([["../foreign", "x"]]),
    new Map([[MODULE, new Uint8Array(new SharedArrayBuffer(8))]]),
  ])
    await assert.rejects(build({ fileOverrides: value }), errorCode("OPTIONS_INVALID"));
  await assert.rejects(build({ workspaceRoot: ROOT + "\0" }), errorCode("OPTIONS_INVALID"));
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
});
test(NAMES[5], async () => {
  const original = await readFile(path.join(ROOT, MODULE));
  const supplied = Buffer.from(original);
  const overrides = new Map([[MODULE, supplied]]);
  const pending = build({ fileOverrides: overrides });
  supplied.fill(0);
  overrides.clear();
  assert.deepEqual((await pending).artifactBytes, artifactBytes);
  await assert.rejects(
    build({
      fileOverrides: new Map([
        [MODULE, Buffer.concat([original, Buffer.from("\n// changed module")])],
      ]),
    }),
    errorCode("SOURCE_SNAPSHOT_DRIFT"),
  );
  // Capture and final post-graph re-read independently reject same-size substituted bytes.
  await substituteRead(MODULE, 2, () =>
    assert.rejects(build(), errorCode("SOURCE_SNAPSHOT_DRIFT")),
  );
  await substituteRead(MODULE, finalModuleReadOrdinal, () =>
    assert.rejects(build(), errorCode("SOURCE_SNAPSHOT_DRIFT")),
  );
  await substituteRead(COMPILED, 1, () =>
    assert.rejects(build(), errorCode("CURRENT_OBSERVATION_FAILED")),
  );
  await substituteRead(COMPILED, finalCompiledReadOrdinal, () =>
    assert.rejects(build(), errorCode("CURRENT_OBSERVATION_FAILED")),
  );
  for (const ordinal of [1, 2]) {
    await substituteRead("docs/proof/artifacts/m10a-t01.json", ordinal, () =>
      assert.rejects(build(), errorCode("SUCCESSOR_DRIFT")),
    );
  }
  for (const name of [
    "pnpm-lock.yaml",
    "dependency-cruiser.config.cjs",
    "scripts/verify-boundary-fixtures.mjs",
    "docs/plan/DEMO-RUNBOOK.md",
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
  const result = await verify({ artifactBytes, proofDocument });
  assert.equal(result.result, "PASS");
  assert.equal(result.normalResetMatrixExecutedByVerifier, true);
  assert.equal(result.browserExecutedByVerifier, false);
  await assert.rejects(
    verify({ artifactBytes: changed(artifactBytes), proofDocument }),
    errorCode("ARTIFACT_DRIFT"),
  );
  for (const document of [
    proofDocument.toString().replace("Status: DONE", "Status: IN_PROGRESS"),
    proofDocument.toString() + "\nFinal artifact: duplicate\n",
    proofDocument.toString().replace(PARENTS[0].sha256, "0".repeat(64)),
  ])
    await assert.rejects(
      verify({ artifactBytes, proofDocument: document }),
      errorCode("PROOF_DOCUMENT_DRIFT"),
    );
});
test(NAMES[7], async () => {
  const root = await temporary(),
    copy = path.join(root, "copy.json"),
    link = path.join(root, "link.json");
  await writeFile(copy, artifactBytes);
  await symlink(copy, link);
  await assert.rejects(
    verify({ artifactPath: link, proofDocument }),
    errorCode("AUTHORITY_UNSAFE"),
  );
  await writeFile(copy, changed(artifactBytes));
  await assert.rejects(verify({ artifactPath: copy, proofDocument }), errorCode("ARTIFACT_DRIFT"));
  assert.deepEqual(await readFile(path.join(ROOT, ARTIFACT)), artifactBytes);
});
test(NAMES[8], async () => {
  const root = await temporary(),
    destination = path.join(root, "evidence.json"),
    link = path.join(root, "link.json");
  const original = Buffer.from("recoverable temporary destination\n");
  await writeFile(destination, original);
  await symlink(destination, link);
  await assert.rejects(write({ artifactPath: link }), errorCode("ARTIFACT_WRITE_UNSAFE"));
  assert.deepEqual(await readFile(destination), original);
  await assert.rejects(
    write({
      artifactPath: destination,
      beforeAtomicRename: () => {
        throw new Error("bounded interruption");
      },
    }),
    errorCode("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), original);
  const result = await write({ artifactPath: destination });
  assert.equal(result.artifactSha256, PIN.sha256);
  assert.deepEqual(await readFile(destination), artifactBytes);
  // A different byte at the already-frozen target cannot be replaced; this is a read-only
  // substitution and never corrupts the actual tracked artifact. The historical authority
  // authentication now rejects it before the writer can reach its destination comparison.
  await substituteRead(ARTIFACT, 1, () => assert.rejects(write(), errorCode("ARTIFACT_DRIFT")));
  assert.deepEqual(await readFile(path.join(ROOT, ARTIFACT)), artifactBytes);
});
test(NAMES[9], async () => {
  const wiring = built.artifact.authority.packageWiring;
  assert.equal(wiring.browserCommands, 9);
  assert.equal(wiring.normalResetCommand, "pnpm demo:reset");
  assert.equal(wiring.normalLifecycle, MODULE);
  const browserPath = "apps/desen-app-browser-e2e/package.json";
  const packageJson = JSON.parse(await readFile(path.join(ROOT, browserPath), "utf8"));
  for (const script of [
    packageJson.scripts["test:e2e"].replace(
      " && playwright test --config repeatable-demo-playwright.config.ts",
      "",
    ),
    packageJson.scripts["test:e2e"] + " && true",
  ])
    await assert.rejects(
      build({
        fileOverrides: new Map([
          [
            browserPath,
            JSON.stringify({
              ...packageJson,
              scripts: { ...packageJson.scripts, "test:e2e": script },
            }),
          ],
        ]),
      }),
      errorCode("TEST_AUTHORITY_DRIFT"),
    );
  const rootPackage = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  await assert.rejects(
    build({
      fileOverrides: new Map([
        [
          "package.json",
          JSON.stringify({
            ...rootPackage,
            scripts: { ...rootPackage.scripts, "demo:reset": "true" },
          }),
        ],
      ]),
    }),
    errorCode("TEST_AUTHORITY_DRIFT"),
  );
  for (const name of [
    "pnpm-lock.yaml",
    "dependency-cruiser.config.cjs",
    "scripts/verify-boundary-fixtures.mjs",
    "docs/plan/DEMO-RUNBOOK.md",
    "apps/desen-app/dev/local-demo-host.test.mjs",
  ])
    assert.ok(built.artifact.boundary.trackedReceipts.some((receipt) => receipt.path === name));
  assert.deepEqual(built.artifact.boundary.semanticAuthorityPaths, ["package.json"]);
  assert.equal(
    built.artifact.boundary.trackedReceipts.some((receipt) => receipt.path === "package.json"),
    false,
  );
  const projected = rootWiring(JSON.stringify(rootPackage));
  for (const malformed of ["null", "[]", "42", "{}"])
    assert.throws(() => rootWiring(malformed), errorCode("TEST_AUTHORITY_DRIFT"));
  const later = structuredClone(rootPackage);
  later.scripts["test:unrelated-later-task"] = "node --test tests/unrelated-later-task.test.mjs";
  later.scripts.test += " && pnpm test:unrelated-later-task";
  assert.deepEqual(rootWiring(JSON.stringify(later)), projected);
  for (const [name, value] of [
    ["demo", "node apps/desen-app/dev/local-demo.mjs --reset"],
    ["test:desen-app-repeatable-demo", "true"],
    ["test", rootPackage.scripts.test.replace(" && pnpm test:desen-app-repeatable-demo", "")],
    ["check", rootPackage.scripts.check + " && pnpm verify:desen-app-repeatable-demo"],
    ["check", rootPackage.scripts.check + " || true"],
  ])
    assert.throws(
      () =>
        rootWiring(
          JSON.stringify({ ...rootPackage, scripts: { ...rootPackage.scripts, [name]: value } }),
        ),
      errorCode("TEST_AUTHORITY_DRIFT"),
    );
});
