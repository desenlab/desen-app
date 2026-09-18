import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  M10A_T12_BROWSER_ASSERTION_NAMES,
  M10A_T12_BROWSER_TEST_TITLES,
  M10A_T12_ARTIFACT_PATH,
  M10A_T12_FOCUSED_APP_TEST_FILES,
  M10A_T12_ROOT_TEST_NAMES,
  M10A_T12_TIMEOUT_CONFIG_SUCCESSOR,
  M10AT12ProofError,
  buildM10AT12Evidence,
  parseM10AT12BrowserObservation,
  projectM10AT12TimeoutConfigSuccessor,
  verifyM10AT12Evidence,
  writeM10AT12Evidence,
} from "../scripts/lib/m10a-t12-proof.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(M10A_T12_ARTIFACT_PATH), "../../..");

function browserObservation() {
  return {
    profile: "desen.m10a-t12.browser-proof.v1",
    result: "PASS",
    tests: M10A_T12_BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    assertions: Object.fromEntries(M10A_T12_BROWSER_ASSERTION_NAMES.map((name) => [name, true])),
  };
}

function errorCode(expected) {
  return (error) => {
    assert.ok(error instanceof M10AT12ProofError);
    assert.equal(error.code, `M10A_T12_${expected}`);
    return true;
  };
}

test("M10A-T12 binds the normal Starter profile, closed visual Catalog, and focused application authorities", async () => {
  const first = await buildM10AT12Evidence({ browserObservation: browserObservation() });
  const second = await buildM10AT12Evidence({ browserObservation: browserObservation() });

  assert.equal(first.artifact.profile, "desen.m10a-t12.rich-styling-responsive.v1");
  assert.equal(first.artifact.source.catalog.version, "0.7.0");
  assert.equal(first.artifact.source.catalog.target, "web-react");
  assert.ok(first.artifact.source.catalog.componentCount >= 32);
  assert.equal(
    first.artifact.source.predecessors.m10aT03.artifact.sha256,
    "530efe5d80d78a722c1832ad5b95086c2fd97bc2f1a4bd275b9a1924394b1e2b",
  );
  assert.equal(first.artifact.source.predecessors.m10aT03.neutral.id, "desen-neutral");
  assert.equal(first.artifact.source.predecessors.m10aT09.catalog.version, "0.6.0");
  assert.equal(
    first.artifact.source.predecessors.m10aT09.artifact.sha256,
    "7fecf6a1b5eebb4a132f55e9641b6137b772bd1bb0df7fb380ef9c1f68289d09",
  );
  assert.deepEqual(first.artifact.focusedTests.appFiles, M10A_T12_FOCUSED_APP_TEST_FILES);
  assert.equal(first.artifact.claims.normalStarterProfile, true);
  assert.equal(first.artifact.claims.typedTokenOrLiteralControls, true);
  assert.equal(first.artifact.claims.normalAggregatePersistence, true);
  assert.equal(first.artifact.claims.namedThemeManagementClaimed, false);
  assert.equal(first.artifactBytes.equals(second.artifactBytes), true);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal((await readFile(M10A_T12_ARTIFACT_PATH)).equals(first.artifactBytes), true);
});

test("M10A-T12 authenticates only a passed normal-product browser observation", async () => {
  const observation = browserObservation();
  const parsed = parseM10AT12BrowserObservation(observation);
  assert.deepEqual(parsed.tests, [{ title: M10A_T12_BROWSER_TEST_TITLES[0], result: "PASS" }]);
  assert.deepEqual(
    Object.keys(parsed.assertions).sort(),
    [...M10A_T12_BROWSER_ASSERTION_NAMES].sort(),
  );

  const built = await buildM10AT12Evidence({ browserObservation: observation });
  const verified = await verifyM10AT12Evidence({
    artifactBytes: built.artifactBytes,
    browserObservation: observation,
  });
  assert.equal(verified.status, "PASS");
  assert.equal(verified.task, "M10A-T12");
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.equal(verified.focusedAppExecutedByVerifier, false);
});

test("M10A-T12 rejects missing source semantics, malformed observations, and artifact drift", async () => {
  const malformed = browserObservation();
  malformed.assertions.noJsxCssJsonAuthoring = false;
  assert.throws(
    () => parseM10AT12BrowserObservation(malformed),
    errorCode("BROWSER_OBSERVATION_INVALID"),
  );
  await assert.rejects(
    buildM10AT12Evidence({ browserObservation: browserObservation(), unexpected: true }),
    errorCode("OPTIONS_INVALID"),
  );

  const emptyWorkspace = await mkdtemp(path.join(tmpdir(), "desen-m10a-t12-missing-source-"));
  try {
    await assert.rejects(
      buildM10AT12Evidence({
        browserObservation: browserObservation(),
        workspaceRoot: path.resolve(emptyWorkspace),
      }),
      errorCode("SOURCE_MISSING"),
    );
  } finally {
    await rm(emptyWorkspace, { recursive: true, force: true });
  }

  const timeoutSuccessor = M10A_T12_TIMEOUT_CONFIG_SUCCESSOR;
  const liveTimeoutConfig = await readFile(path.join(WORKSPACE_ROOT, timeoutSuccessor.path));
  const projectedTimeoutConfig = projectM10AT12TimeoutConfigSuccessor(liveTimeoutConfig);
  assert.equal(projectedTimeoutConfig.byteLength, timeoutSuccessor.predecessor.bytes);
  assert.equal(
    projectedTimeoutConfig.equals(
      Buffer.from(
        liveTimeoutConfig
          .toString("utf8")
          .replace(timeoutSuccessor.currentTimeoutBlock, timeoutSuccessor.predecessorTimeoutBlock),
        "utf8",
      ),
    ),
    true,
  );
  const oneByteTimeoutDrift = Buffer.from(liveTimeoutConfig);
  oneByteTimeoutDrift[0] ^= 1;
  assert.throws(
    () => projectM10AT12TimeoutConfigSuccessor(oneByteTimeoutDrift),
    errorCode("CONFIG_SUCCESSOR_DRIFT"),
  );
  assert.throws(
    () =>
      projectM10AT12TimeoutConfigSuccessor(
        Buffer.from(
          liveTimeoutConfig
            .toString("utf8")
            .replace(
              timeoutSuccessor.currentTimeoutBlock,
              "  workers: 1,\n  timeout: 121_000,\n  expect: { timeout: 10_000 },\n",
            ),
          "utf8",
        ),
      ),
    errorCode("CONFIG_SUCCESSOR_DRIFT"),
  );
  assert.throws(
    () => projectM10AT12TimeoutConfigSuccessor(projectedTimeoutConfig),
    errorCode("CONFIG_SUCCESSOR_DRIFT"),
  );

  const built = await buildM10AT12Evidence({ browserObservation: browserObservation() });
  assert.deepEqual(
    built.artifact.source.files.find(
      ({ path: relativePath }) => relativePath === timeoutSuccessor.path,
    ),
    {
      path: timeoutSuccessor.path,
      bytes: timeoutSuccessor.predecessor.bytes,
      sha256: timeoutSuccessor.predecessor.sha256,
    },
  );
  const drifted = Buffer.from(built.artifactBytes);
  drifted[drifted.byteLength - 2] ^= 1;
  await assert.rejects(
    verifyM10AT12Evidence({ artifactBytes: drifted, browserObservation: browserObservation() }),
    errorCode("ARTIFACT_DRIFT"),
  );
});

test("M10A-T12 writer is atomic and does not invent named-theme management authority", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "desen-m10a-t12-root-test-"));
  try {
    const artifactPath = path.resolve(temporaryRoot, "m10a-t12.json");
    const written = await writeM10AT12Evidence({
      artifactPath,
      browserObservation: browserObservation(),
    });
    const built = await buildM10AT12Evidence({ browserObservation: browserObservation() });
    assert.equal(written.artifactPath, artifactPath);
    assert.equal(written.artifactSha256, built.artifactSha256);
    assert.equal((await readFile(artifactPath)).equals(built.artifactBytes), true);
    assert.match(
      built.artifact.nonClaims[0],
      /not named-theme CRUD, switching, or persistence management/u,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("M10A-T12 keeps its scoped root-test declaration inventory", () => {
  assert.equal(M10A_T12_BROWSER_TEST_TITLES.length, 1);
  assert.equal(M10A_T12_BROWSER_ASSERTION_NAMES.length, 11);
  assert.equal(M10A_T12_FOCUSED_APP_TEST_FILES.length, 11);
  assert.equal(M10A_T12_ROOT_TEST_NAMES.length, 4);
});
