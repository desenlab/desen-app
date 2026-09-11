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
import { gunzipSync } from "node:zlib";

import {
  DESEN_APP_PUBLISHED_HOST_UPDATE_APP_CANVAS_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_HOST_AUDIT_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES,
  DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_T14_PIN,
  DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN,
  DesenAppPublishedHostUpdateProofError,
  authenticateM10AT01LockfileSuccessor,
  authenticateM10AT02LockfileSuccessor,
  authenticateDesenAppPublishedHostUpdateSuccessor,
  buildCurrentDesenAppPublishedHostUpdateGraphAudit,
  buildDesenAppPublishedHostUpdateEvidence,
  materializeDesenAppT04HistoricalReaderFileOverrides,
  projectDesenAppT04HistoricalReaderPathInventory,
  projectM10AT02T01Input,
  readDesenAppT01aHistoricalReaderGapFile,
  readDesenAppT04HistoricalReaderTaskTimeFile,
  verifyDesenAppPublishedHostUpdateBrowserPolicy,
  verifyDesenAppPublishedHostUpdateEvidence,
  verifyDesenAppPublishedHostUpdateGraphPolicy,
  verifyDesenAppPublishedHostUpdateSourcePolicy,
  writeDesenAppPublishedHostUpdateEvidence,
} from "../scripts/lib/desen-app-published-host-update-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json";
const REPORT_PATH = "docs/proof/DESEN-APP-PUBLISHED-HOST-UPDATE.md";
const T01A_APP_PACKAGE_PATH = "apps/desen-app/package.json";
const T01A_APP_PACKAGE_RECEIPT = Object.freeze({
  bytes: 4_122,
  sha256: "7038647aa1809f07ee5131d0df8d0bee75bf1f2cdf0358be738b2c3603b64577",
});
const T04_APP_PACKAGE_RECEIPT = Object.freeze({
  bytes: 4_546,
  sha256: "c634b5ee1e2d2af0ffd6db8d4841215664591a31999210a8e0b388b71509eb32",
});
const SEC_02_LOCKFILE_PACKAGE_UPDATES = Object.freeze([
  [
    "brace-expansion",
    "5.0.7",
    "5.0.9",
    "sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==",
    "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
  ],
  [
    "js-yaml",
    "3.15.0",
    "3.15.2",
    "sha512-ttBQIIQPDeLjpPOohtUdXuXUVoA2uIB6fEH9HyJ7234s5mBJ5wTx20njxplLZQgLaOfpmPQA7X2t5AX6tIPbog==",
    "sha512-6EuL879VkRA+1Cz578mKMiKvjPNEuk6+r1JaFzoSWejZmtf7xWbIyw1e3KkxlkzTIt9Taw6JBhEppG7utc1P+w==",
  ],
  [
    "js-yaml",
    "4.3.0",
    "4.3.2",
    "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
    "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
  ],
  [
    "nanoid",
    "3.3.16",
    "3.3.18",
    "sha512-bzlKTyNJ7+LdGIIwy8ijFpIqEQIvafahV7eYykJ8Cvh42EdJeODoJ6gUJXpQJvej1BddH8OqTXZNE/KfbWAu8Q==",
    "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
  ],
  [
    "postcss",
    "8.5.20",
    "8.5.28",
    "sha512-lW616l85ucIQL+FocMmL7pQFPqBmwejrCMg+iPxyImlrANNJG9NHq/RkyCZopDhd8C3LA03PHRJDjkbGu8vvug==",
    "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
  ],
  [
    "undici",
    "7.28.0",
    "7.29.1",
    "sha512-cRZYrTDwWznlnRiPjggAGxZXanty6M8RV1ff8Wm4LWXBp7/IG8v5DnOm74DtUBp9OONpK75YlPnIjQqX0dBDtA==",
    "sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==",
  ],
]);
const M10A_T01_LOCKFILE_RECEIPT = Object.freeze({
  bytes: 138_171,
  sha256: "2d7d284b3f32e1dedc94161aef6f012f7e86913c9f50437edb64630ba14bc31f",
});
const M10A_T02_LOCKFILE_RECEIPT = Object.freeze({
  bytes: 138_555,
  sha256: "686319cce7bafbfcb62750dbc02abcc23ce95b13a760cb496974a5f129690b76",
});
const M10_T08_LOCKFILE_RECEIPT = Object.freeze({
  bytes: 132_210,
  sha256: "f2ba3d3f38b1cee1ef369f8ea138f476bbf4574931262563b9f550937c9cae6c",
});
const M10A_T01_T08_INPUT_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_189,
    sha256: "e78d9f77c35eae01ea145944fc17f4f416aed89505ffdc96836d5fc6457cf069",
    predecessor: Object.freeze({
      bytes: 15_181,
      sha256: "9d1b7d5f78fd4e0d356183b21f237b8e4e98b8df9d5ad625fdd73fe4f357cb60",
    }),
  }),
  Object.freeze({
    path: "scripts/verify-boundary-fixtures.mjs",
    bytes: 9_606,
    sha256: "b80b30a52db67ba93c9d705566e3c7db453c98bc42e6cc7b0e7a68bb8efaee62",
    predecessor: Object.freeze({
      bytes: 9_049,
      sha256: "03b0c558fc9803726c09b03ca3c31b4df0f2f44acf3f9f18b8c64dc2d8f3856d",
    }),
  }),
]);
const M10A_T02_T01_INPUT_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_261,
    sha256: "4c70efb8588360fd51722e0ea0dc507ae006d2628daccbd26277785b2f91c3ec",
  }),
  Object.freeze({
    path: "scripts/verify-boundary-fixtures.mjs",
    bytes: 10_148,
    sha256: "9a6b89593d2d215bb2bc2fb835400497f156fa9a29858a87af312c920410d0a8",
  }),
]);
const M10A_T01_LOCKFILE_ADDED_ENTRIES = Object.freeze([
  Object.freeze({
    section: "importers",
    headers: Object.freeze([
      "  apps/starter-catalog-web-proof:\n",
      "  packages/starter-catalog-web:\n",
    ]),
  }),
  Object.freeze({
    section: "packages",
    headers: Object.freeze([
      "  '@base-ui/react@1.8.0':\n",
      "  '@base-ui/utils@0.4.0':\n",
      "  '@floating-ui/core@1.8.0':\n",
      "  '@floating-ui/dom@1.8.0':\n",
      "  '@floating-ui/react-dom@2.1.9':\n",
      "  '@floating-ui/utils@0.2.12':\n",
      "  reselect@5.3.0:\n",
      "  use-sync-external-store@1.6.0:\n",
    ]),
  }),
  Object.freeze({
    section: "snapshots",
    headers: Object.freeze([
      "  '@base-ui/react@1.8.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)':\n",
      "  '@base-ui/utils@0.4.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)':\n",
      "  '@floating-ui/core@1.8.0':\n",
      "  '@floating-ui/dom@1.8.0':\n",
      "  '@floating-ui/react-dom@2.1.9(react-dom@19.2.8(react@19.2.8))(react@19.2.8)':\n",
      "  '@floating-ui/utils@0.2.12': {}\n",
      "  reselect@5.3.0: {}\n",
      "  use-sync-external-store@1.6.0(react@19.2.8):\n",
    ]),
  }),
]);
const M10A_T02_LOCKFILE_ADDED_ENTRIES = Object.freeze([
  Object.freeze({
    section: "importers",
    headers: Object.freeze(["  packages/design-system-core:\n"]),
  }),
]);
const SOURCE_PATHS = Object.freeze({
  runtimePublication: "apps/desen-app/src/local-runtime-publication.ts",
  main: "apps/desen-app/src/main.tsx",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  publicationHost: "apps/desen-app/dev/local-publication-host.mjs",
  localDevHost: "apps/desen-app/dev/local-dev-host.mjs",
  referenceServer: "apps/reference-host-web-server/src/server.ts",
  referenceServerIndex: "apps/reference-host-web-server/src/index.ts",
});
const BROWSER_PATHS = Object.freeze({
  config: "apps/desen-app-browser-e2e/published-host-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/published-host-proof-server.mjs",
  spec: "apps/desen-app-browser-e2e/published-host-update.pw.ts",
});

const temporaryDirectories = [];
let artifactBytes;
let bridgeManifest;
let browserPolicyInput;
let built;
let sourcePolicyInput;
let successor;
let verified;

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppPublishedHostUpdateProofError);
    assert.equal(error.code, code);
    return true;
  };
}

function replaceOnce(source, marker, replacement) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Missing mutation marker ${marker}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + marker.length)}`;
}

function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}

function removeLockfileEntry(source, section, header) {
  const sectionMarker = `\n${section}:\n`;
  assert.equal(occurrenceCount(source, sectionMarker), 1);
  const sectionStart = source.indexOf(sectionMarker) + sectionMarker.length;
  const nextSectionPattern = /^\S[^\r\n]*:\r?$/gmu;
  nextSectionPattern.lastIndex = sectionStart;
  const nextSection = nextSectionPattern.exec(source);
  const sectionEnd = nextSection?.index ?? source.length;
  const sectionText = source.slice(sectionStart, sectionEnd);
  assert.equal(occurrenceCount(sectionText, header), 1);
  const entryStart = sectionStart + sectionText.indexOf(header);
  const nextEntryPattern = /^ {2}\S[^\r\n]*$/gmu;
  nextEntryPattern.lastIndex = entryStart + header.length;
  const nextEntry = nextEntryPattern.exec(source);
  const entryEnd =
    nextEntry !== null && nextEntry.index < sectionEnd ? nextEntry.index : sectionEnd;
  return source.slice(0, entryStart) + source.slice(entryEnd);
}

function projectLockfileEntries(lockfile, additions) {
  let projected = lockfile.toString("utf8");
  for (const { section, headers } of additions) {
    for (const header of headers) projected = removeLockfileEntry(projected, section, header);
  }
  return Buffer.from(projected);
}

function projectM10AT01Lockfile(liveLockfile) {
  return projectLockfileEntries(liveLockfile, M10A_T02_LOCKFILE_ADDED_ENTRIES);
}

function projectM10T08Lockfile(m10aT01Lockfile) {
  let projected = m10aT01Lockfile.toString("utf8");
  for (const { section, headers } of M10A_T01_LOCKFILE_ADDED_ENTRIES) {
    for (const header of headers) projected = removeLockfileEntry(projected, section, header);
  }
  return Buffer.from(projected);
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function graphPolicyInput() {
  const current = built.liveSuccessorAuthority.currentGraphAudit;
  const runtime = current.runtimeResolution;
  const fixtureOnly = new Set(runtime.appFixtureOnlySourceFiles);
  return {
    appGraph: runtime.appModules,
    appSourcePaths: current.appSourceAudit.sourceReceipts
      .map(({ path: relativePath }) => relativePath)
      .filter((relativePath) => !fixtureOnly.has(relativePath)),
    hostGraph: runtime.hostModules,
    hostSourcePaths: current.referenceHostSourceAudit.sourceReceipts.map(
      ({ path: relativePath }) => relativePath,
    ),
  };
}

async function observeProofFilesystem(operation, beforeBuild) {
  const originalOpen = filesystem.open;
  const originalOpendir = filesystem.opendir;
  const observations = { opens: new Map(), buildInventories: 0 };
  try {
    filesystem.open = async (...args) => {
      const entryPath = String(args[0]);
      observations.opens.set(entryPath, (observations.opens.get(entryPath) ?? 0) + 1);
      return Reflect.apply(originalOpen, filesystem, args);
    };
    filesystem.opendir = async (...args) => {
      if (String(args[0]) === path.join(ROOT, "apps/desen-app/src")) {
        observations.buildInventories += 1;
        if (observations.buildInventories === 1) await beforeBuild?.();
      }
      return Reflect.apply(originalOpendir, filesystem, args);
    };
    syncBuiltinESMExports();
    return await operation(observations);
  } finally {
    filesystem.open = originalOpen;
    filesystem.opendir = originalOpendir;
    syncBuiltinESMExports();
  }
}

async function expectExactOverrideCannotMaskBacking(relativePath, mode) {
  const absolutePath = path.join(ROOT, relativePath);
  const exactBytes = await readFile(absolutePath);
  const originalOpen = filesystem.open;
  let intercepted = 0;
  try {
    filesystem.open = async (...args) => {
      if (String(args[0]) !== absolutePath) {
        return Reflect.apply(originalOpen, filesystem, args);
      }
      intercepted += 1;
      if (mode === "missing") {
        const error = new Error("simulated missing backing authority");
        error.code = "ENOENT";
        throw error;
      }
      const handle = await Reflect.apply(originalOpen, filesystem, args);
      const originalReadFile = handle.readFile.bind(handle);
      handle.readFile = async (...readArgs) => changedByte(await originalReadFile(...readArgs));
      return handle;
    };
    syncBuiltinESMExports();
    await assert.rejects(
      buildDesenAppPublishedHostUpdateEvidence({
        fileOverrides: new Map([[relativePath, exactBytes]]),
      }),
      expectedError(mode === "missing" ? "AUTHORITY_UNSAFE" : "SOURCE_SNAPSHOT_DRIFT"),
    );
    assert.ok(intercepted >= (mode === "missing" ? 1 : 2), `${mode}: ${relativePath}`);
  } finally {
    filesystem.open = originalOpen;
    syncBuiltinESMExports();
  }
}

before(async () => {
  [sourcePolicyInput, browserPolicyInput] = await Promise.all([
    Object.fromEntries(
      await Promise.all(
        Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
          key,
          await readFile(path.join(ROOT, relativePath), "utf8"),
        ]),
      ),
    ),
    Object.fromEntries(
      await Promise.all(
        Object.entries(BROWSER_PATHS).map(async ([key, relativePath]) => [
          key,
          await readFile(path.join(ROOT, relativePath), "utf8"),
        ]),
      ),
    ),
  ]);
  artifactBytes = await readFile(path.join(ROOT, ARTIFACT_PATH));
  bridgeManifest = JSON.parse(
    gunzipSync(
      await readFile(path.join(ROOT, DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path)),
    ).toString("utf8"),
  );
  built = await buildDesenAppPublishedHostUpdateEvidence();
  verified = await observeProofFilesystem(async (observations) => {
    const result = await verifyDesenAppPublishedHostUpdateEvidence();
    assert.ok(observations.buildInventories > 0);
    // The fresh build additionally authenticates the historical projection target.
    assert.equal(observations.opens.get(path.join(ROOT, ARTIFACT_PATH)), 3);
    assert.equal(observations.opens.get(path.join(ROOT, REPORT_PATH)), 2);
    return result;
  });
  successor = await authenticateDesenAppPublishedHostUpdateSuccessor();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[0], async () => {
  assert.deepEqual(built.artifact.prerequisites, [
    DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN,
    DESEN_APP_PUBLISHED_HOST_UPDATE_T14_PIN,
    DESEN_APP_PUBLISHED_HOST_UPDATE_HOST_AUDIT_PIN,
    DESEN_APP_PUBLISHED_HOST_UPDATE_APP_CANVAS_PIN,
  ]);
  assert.equal(built.artifact.authority.historicalReaderBridge.fileEntries, 51);
  assert.equal(built.artifact.authority.historicalReaderBridge.predecessorGapFiles, 2);
  assert.equal(built.artifact.authority.historicalReaderBridge.successorAddedPaths, 7);
  assert.equal(built.artifact.authority.historicalReaderBridge.approvedAr01ReceiptAmendments, 2);
  assert.deepEqual(
    built.artifact.authority.historicalReaderBridge.t01aAncestor,
    DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.t01aAncestor,
  );
  assert.deepEqual(Object.keys(bridgeManifest.t01aAncestor.files), [T01A_APP_PACKAGE_PATH]);
  assert.equal(successor.task, "M10-T05");
  assert.equal(successor.artifact.sha256, DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256);

  const historical = materializeDesenAppT04HistoricalReaderFileOverrides(successor, new Map());
  assert.equal(historical.size, 54);
  const historicalInspector = historical.get("apps/desen-app/src/inspector-panel.tsx");
  assert.equal(historicalInspector.byteLength, 32_591);
  assert.equal(
    createHash("sha256").update(historicalInspector).digest("hex"),
    "ad2543377377e8d5ae99fbd110a0cf1c63710620e972db388feca95ef7ae7d26",
  );
  const t04AppPackage = historical.get(T01A_APP_PACKAGE_PATH);
  assert.equal(t04AppPackage.byteLength, T04_APP_PACKAGE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(t04AppPackage).digest("hex"),
    T04_APP_PACKAGE_RECEIPT.sha256,
  );
  const t04AppPackageDirect = readDesenAppT04HistoricalReaderTaskTimeFile(
    successor,
    T01A_APP_PACKAGE_PATH,
  );
  assert.equal(t04AppPackageDirect.byteLength, T04_APP_PACKAGE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(t04AppPackageDirect).digest("hex"),
    T04_APP_PACKAGE_RECEIPT.sha256,
  );
  const firstT01aAppPackage = readDesenAppT01aHistoricalReaderGapFile(
    successor,
    T01A_APP_PACKAGE_PATH,
  );
  const secondT01aAppPackage = readDesenAppT01aHistoricalReaderGapFile(
    successor,
    T01A_APP_PACKAGE_PATH,
  );
  assert.equal(firstT01aAppPackage.byteLength, T01A_APP_PACKAGE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(firstT01aAppPackage).digest("hex"),
    T01A_APP_PACKAGE_RECEIPT.sha256,
  );
  firstT01aAppPackage[0] ^= 1;
  assert.notDeepEqual(firstT01aAppPackage, secondT01aAppPackage);
  assert.throws(
    () => readDesenAppT01aHistoricalReaderGapFile(Object.freeze({}), T01A_APP_PACKAGE_PATH),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  assert.throws(
    () => readDesenAppT01aHistoricalReaderGapFile(successor, "pnpm-lock.yaml"),
    expectedError("OPTIONS_INVALID"),
  );
  assert.throws(
    () => readDesenAppT01aHistoricalReaderGapFile(Object.freeze({}), "../escape"),
    expectedError("OPTIONS_INVALID"),
  );
  const taskTimePath = "apps/desen-app/src/main.tsx";
  const firstCopy = readDesenAppT04HistoricalReaderTaskTimeFile(successor, taskTimePath);
  const secondCopy = readDesenAppT04HistoricalReaderTaskTimeFile(successor, taskTimePath);
  firstCopy[0] ^= 1;
  assert.notDeepEqual(firstCopy, secondCopy);
  const addedT06Paths = [
    "apps/desen-app/src/authoring-source-draft.ts",
    "apps/desen-app/src/source-draft-controls.tsx",
  ];
  const inventory = [
    ...Object.keys(bridgeManifest.files),
    ...bridgeManifest.successorAddedPaths,
    ...addedT06Paths,
  ];
  assert.deepEqual(
    projectDesenAppT04HistoricalReaderPathInventory(successor, inventory),
    Object.keys(bridgeManifest.files),
  );
  assert.throws(
    () => materializeDesenAppT04HistoricalReaderFileOverrides(Object.freeze({}), new Map()),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );

  assert.doesNotMatch(
    authenticateDesenAppPublishedHostUpdateSuccessor.toString(),
    /(?:verify|build)DesenAppPublishedHostUpdateEvidence|buildDualViteAudit|viteBuild/u,
  );
  const lightweightWorkspace = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-app-t05-lightweight-successor-")),
  );
  temporaryDirectories.push(lightweightWorkspace);
  const report = await readFile(path.join(ROOT, REPORT_PATH));
  const parent = await readFile(path.join(ROOT, DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path));
  const bridge = await readFile(path.join(ROOT, DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path));
  const lightweightAuthorities = new Map([
    [ARTIFACT_PATH, artifactBytes],
    [REPORT_PATH, report],
    [DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path, parent],
    [DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path, bridge],
  ]);
  const t06ArtifactPath = "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json";
  const currentT06Paths = [...addedT06Paths, "apps/desen-app/src/inspector-panel.tsx"];
  for (const relativePath of [t06ArtifactPath, ...currentT06Paths]) {
    lightweightAuthorities.set(relativePath, await readFile(path.join(ROOT, relativePath)));
  }
  for (const relativePath of [
    "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json",
    "apps/desen-app/dev/local-demo-host.mjs",
    "apps/desen-app/dev/local-demo-host.test.mjs",
    "apps/desen-app/dev/local-demo.mjs",
  ]) {
    lightweightAuthorities.set(relativePath, await readFile(path.join(ROOT, relativePath)));
  }
  for (const [relativePath, bytes] of lightweightAuthorities) {
    const absolutePath = path.join(lightweightWorkspace, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
  }
  const lightweightSuccessor = await authenticateDesenAppPublishedHostUpdateSuccessor({
    workspaceRoot: lightweightWorkspace,
  });
  assert.equal(lightweightSuccessor.task, "M10-T05");
  assert.equal(
    lightweightSuccessor.artifact.sha256,
    DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256,
  );
  assert.deepEqual(
    readDesenAppT01aHistoricalReaderGapFile(lightweightSuccessor, T01A_APP_PACKAGE_PATH),
    secondT01aAppPackage,
  );
  for (const relativePath of [t06ArtifactPath, ...currentT06Paths]) {
    const absolutePath = path.join(lightweightWorkspace, relativePath);
    const original = lightweightAuthorities.get(relativePath);
    await writeFile(absolutePath, changedByte(original));
    await assert.rejects(
      authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
    await writeFile(absolutePath, original);
  }

  const artifactPath = path.join(lightweightWorkspace, ARTIFACT_PATH);
  await writeFile(artifactPath, changedByte(artifactBytes));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await writeFile(artifactPath, artifactBytes);

  const reportPath = path.join(lightweightWorkspace, REPORT_PATH);
  await writeFile(reportPath, replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  await writeFile(reportPath, report);

  const parentPath = path.join(lightweightWorkspace, DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path);
  await writeFile(parentPath, changedByte(parent));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("PARENT_DRIFT"),
  );
  await writeFile(parentPath, parent);

  const bridgePath = path.join(
    lightweightWorkspace,
    DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path,
  );
  await writeFile(bridgePath, changedByte(bridge));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("HISTORICAL_BRIDGE_DRIFT"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[1], () => {
  assert.deepEqual(verifyDesenAppPublishedHostUpdateSourcePolicy(sourcePolicyInput), {
    exactInjectedProfile: true,
    independentControlPlaneAndActivationAuthorities: true,
    fixedChannelAndHostDestination: true,
    sourceCannotSelectEndpointHandlerCredentialOrHostModule: true,
    browserCredentialsOmitted: true,
    boundedBrowserTransport: true,
    exactActivationRevisionRequired: true,
    normalProductBootstrapReceivesOptionalPort: true,
    flowWorkspaceCannotReceivePublicationPort: false,
    serverOwnsChannelRereadAndActivation: true,
    activationBridgeStrictAndLoopbackOnly: true,
    callbackSettlementClosedAndRedacted: true,
    lifecycleIdempotentAndCredentialsZeroed: true,
  });
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        runtimePublication: sourcePolicyInput.runtimePublication.replaceAll(
          "MAX_RESPONSE_CHUNKS",
          "REMOVED_RESPONSE_CHUNK_BOUND",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  const branchSwappedMain = replaceOnce(
    sourcePolicyInput.main,
    "workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}",
    "workspaceProfile={REFERENCE_FLOW_WORKSPACE_PROFILE}",
  );
  for (const invalidMain of [
    sourcePolicyInput.main.replace("publicationPort={publicationPort}", "publicationPort={null}"),
    sourcePolicyInput.main.replaceAll(
      "publicationPort={publicationPort}",
      "publicationPort={untrustedPort}",
    ),
  ]) {
    assert.throws(
      () =>
        verifyDesenAppPublishedHostUpdateSourcePolicy({ ...sourcePolicyInput, main: invalidMain }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  for (const runtimePublication of [
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      "    config?.profile !== DESEN_APP_LOCAL_PUBLICATION_PROFILE ||\n",
      "",
    ),
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      "`${config.activation.origin}${ACTIVATION_PATH}`",
      "`${config.activation.origin}/${request.revision}`",
    ),
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      "          authorization: `Bearer ${config.activation.apiToken}`",
      "          authorization: `Bearer ${config.controlPlane.apiToken}`",
    ),
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      [
        "  return createFixedDestinationAuthoringPublicationPort({",
        "    channelName: config.destination.channelName,",
      ].join("\n"),
      [
        "  return createFixedDestinationAuthoringPublicationPort({",
        "    channelName: config.destination.hostId,",
      ].join("\n"),
    ),
  ]) {
    assert.throws(
      () =>
        verifyDesenAppPublishedHostUpdateSourcePolicy({
          ...sourcePolicyInput,
          runtimePublication,
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        main: branchSwappedMain,
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  for (const publicationHost of [
    replaceOnce(
      sourcePolicyInput.publicationHost,
      "server.listen({ host: LOOPBACK, port: 0, exclusive: true }",
      'server.listen({ host: "::", port: 0, exclusive: true }',
    ),
    replaceOnce(
      sourcePolicyInput.publicationHost,
      "    closePromise ??= (async () => {",
      "    closePromise = (async () => {",
    ),
  ]) {
    assert.throws(
      () =>
        verifyDesenAppPublishedHostUpdateSourcePolicy({
          ...sourcePolicyInput,
          publicationHost,
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        referenceServer: replaceOnce(
          sourcePolicyInput.referenceServer,
          "const channelAfterRefresh = await readPublicationChannel(controlPlaneClient);",
          "const channelAfterRefresh = channelBeforeRefresh;",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[2], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.independentControlPlaneAndActivationAuthorities, true);
  assert.equal(source.browserCredentialsOmitted, true);
  assert.equal(source.boundedBrowserTransport, true);
  assert.equal(source.callbackSettlementClosedAndRedacted, true);
  assert.equal(source.lifecycleIdempotentAndCredentialsZeroed, true);
  assert.equal(built.artifact.authority.focusedTests.totalDeclarationSites, 66);
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        publicationHost: replaceOnce(
          sourcePolicyInput.publicationHost,
          "timingSafeEqual(candidate, expected)",
          "candidate.equals(expected)",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[3], () => {
  const host = built.artifact.authority.referenceHostSourceAudit;
  assert.equal(host.sourceFiles, 13);
  assert.equal(host.executableSourceFiles, 12);
  assert.equal(host.exactJsxOwnershipAllowlistEnforced, true);
  assert.equal(host.directOrHiddenHandwrittenManagedTreesRejected, true);
  assert.equal(host.currentAuditUsesFreshSourceAndBuild, true);
  assert.equal(host.runtimeResolution.moduleCount, 104);
  assert.equal(host.runtimeResolution.staticEdges, 299);
  assert.equal(host.runtimeResolution.dynamicEdges, 0);
  assert.equal(host.runtimeResolution.unresolvedEdges, 0);
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[4], async () => {
  const runtime = built.artifact.authority.runtimeResolution;
  assert.equal(runtime.tool, "vite@8.1.5");
  assert.equal(runtime.write, false);
  assert.equal(runtime.independentBuildsPerApplication, 2);
  assert.equal(runtime.app.moduleCount, 168);
  assert.equal(runtime.app.staticEdges, 510);
  assert.equal(runtime.host.moduleCount, 104);
  assert.equal(runtime.host.staticEdges, 299);
  assert.equal(runtime.sharedManagedModuleCount, 22);
  const current = built.liveSuccessorAuthority.currentGraphAudit;
  assert.equal(built.liveSuccessorAuthority.currentObservationsAreNotHistoricalResults, true);
  for (const addedPath of [
    "apps/desen-app/src/authoring-source-draft.ts",
    "apps/desen-app/src/source-draft-controls.tsx",
  ]) {
    assert.ok(current.appSourceAudit.inventory.includes(addedPath));
    assert.ok(!built.artifact.authority.appSourceAudit.inventory.includes(addedPath));
  }
  for (const options of [
    { fileOverrides: new Map() },
    { currentGraphAudit: current },
    { workspaceRoot: 1 },
  ]) {
    await assert.rejects(
      buildCurrentDesenAppPublishedHostUpdateGraphAudit(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  const graph = verifyDesenAppPublishedHostUpdateGraphPolicy(graphPolicyInput());
  assert.deepEqual(graph.app, current.runtimeResolution.app);
  assert.deepEqual(graph.host, current.runtimeResolution.host);
  assert.equal(graph.sharedManagedModuleCount, current.runtimeResolution.sharedManagedModuleCount);
  assert.deepEqual(graph.sharedManagedIdentity, current.runtimeResolution.sharedManagedIdentity);

  let accessorReads = 0;
  const accessorGraph = structuredClone(graphPolicyInput());
  const firstEntry = accessorGraph.appGraph[0];
  Object.defineProperty(accessorGraph.appGraph, "0", {
    configurable: true,
    enumerable: true,
    get() {
      accessorReads += 1;
      return firstEntry;
    },
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(accessorGraph),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(accessorReads, 0);

  const sparseGraph = structuredClone(graphPolicyInput());
  delete sparseGraph.appGraph[0];
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(sparseGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const extraKeyGraph = structuredClone(graphPolicyInput());
  Object.defineProperty(extraKeyGraph.appGraph, "unexpected", {
    configurable: true,
    value: "authority",
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(extraKeyGraph),
    expectedError("OPTIONS_INVALID"),
  );

  let proxyTrapReads = 0;
  const proxyGraph = structuredClone(graphPolicyInput());
  proxyGraph.appGraph = new Proxy(proxyGraph.appGraph, {
    get() {
      proxyTrapReads += 1;
      throw new Error("graph proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      proxyTrapReads += 1;
      throw new Error("graph proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      proxyTrapReads += 1;
      throw new Error("graph proxy prototype trap must not execute");
    },
    ownKeys() {
      proxyTrapReads += 1;
      throw new Error("graph proxy ownKeys trap must not execute");
    },
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(proxyGraph),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(proxyTrapReads, 0);

  let outOfRangeAccessorReads = 0;
  const outOfRangeGraph = structuredClone(graphPolicyInput());
  const outOfRangeImports = outOfRangeGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  ).imports;
  Object.defineProperty(outOfRangeImports, "4294967295", {
    configurable: true,
    enumerable: true,
    get() {
      outOfRangeAccessorReads += 1;
      return "caller-owned-authority";
    },
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(outOfRangeGraph),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(outOfRangeAccessorReads, 0);

  const sparseImportsGraph = structuredClone(graphPolicyInput());
  const sparseImports = sparseImportsGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  ).imports;
  delete sparseImports[0];
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(sparseImportsGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const symbolImportsGraph = structuredClone(graphPolicyInput());
  const symbolImports = symbolImportsGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  ).imports;
  Object.defineProperty(symbolImports, Symbol("caller-owned-authority"), {
    value: "caller-owned-authority",
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(symbolImportsGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const revokedImportsGraph = structuredClone(graphPolicyInput());
  const revokedImportsEntry = revokedImportsGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  );
  const revokedImports = Proxy.revocable(revokedImportsEntry.imports, {});
  revokedImportsEntry.imports = revokedImports.proxy;
  revokedImports.revoke();
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(revokedImportsGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const mutated = structuredClone(graphPolicyInput());
  const main = mutated.appGraph.find(({ id }) => id === "apps/desen-app/src/main.tsx");
  main.imports = main.imports.filter(
    (relativePath) => relativePath !== "apps/desen-app/src/local-runtime-publication.ts",
  );
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(mutated),
    expectedError("VITE_GRAPH_DRIFT"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[5], () => {
  const browser = verifyDesenAppPublishedHostUpdateBrowserPolicy(browserPolicyInput);
  assert.deepEqual(browser, built.artifact.authority.browser);
  assert.equal(browser.visibleSourceGenerationA, 2);
  assert.equal(browser.visibleSourceGenerationB, 3);
  assert.equal(browser.visibleChannelGenerationA, 1);
  assert.equal(browser.visibleChannelGenerationB, 2);
  assert.equal(browser.hostBuildFingerprintStableAcrossAAndB, true);
  assert.equal(browser.directDomOrNetworkMutationUsed, false);
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: replaceOnce(
          browserPolicyInput.spec,
          "const buildBefore = await hostBuildFingerprint(request);",
          "const buildBefore = 'unobserved';",
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  const callbackOpening = ["}) => {", "  const appErrors: string[] = [];"].join("\n");
  for (const bypass of [
    "  return;",
    "  if (Date.now() > 0) return;",
    "  test.skip();",
    '  test.describe.skip("disabled", () => undefined);',
  ]) {
    assert.throws(
      () =>
        verifyDesenAppPublishedHostUpdateBrowserPolicy({
          ...browserPolicyInput,
          spec: replaceOnce(
            browserPolicyInput.spec,
            callbackOpening,
            ["}) => {", bypass, "  const appErrors: string[] = [];"].join("\n"),
          ),
        }),
      expectedError("BROWSER_POLICY_VIOLATION"),
    );
  }
  const nestedScenario = replaceOnce(
    replaceOnce(
      browserPolicyInput.spec,
      callbackOpening,
      ["}) => {", "  if (false) {", "    const appErrors: string[] = [];"].join("\n"),
    ),
    [
      '  await host.screenshot({ path: test.info().outputPath("published-layout-update.png") });',
      "});",
    ].join("\n"),
    [
      '  await host.screenshot({ path: test.info().outputPath("published-layout-update.png") });',
      "  }",
      "});",
    ].join("\n"),
  );
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: nestedScenario,
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  const finalRevisionReloadBlock = [
    "  await host.reload();",
    "  await expect(host.getByText(UPDATED_LABEL, { exact: true })).toBeVisible();",
    "  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();",
  ].join("\n");
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: replaceOnce(
          browserPolicyInput.spec,
          finalRevisionReloadBlock,
          "  await host.reload();",
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  const withoutFinalReload = replaceOnce(
    browserPolicyInput.spec,
    `\n${finalRevisionReloadBlock}`,
    "",
  );
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: replaceOnce(
          withoutFinalReload,
          "  const updatedReceipt = await publish(page);",
          `${finalRevisionReloadBlock}\n  const updatedReceipt = await publish(page);`,
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        server: replaceOnce(
          browserPolicyInput.server,
          [
            "  activationBridge = await openDesenAppLocalPublicationHost({",
            "    apiToken: activationToken,",
          ].join("\n"),
          [
            "  activationBridge = await openDesenAppLocalPublicationHost({",
            "    apiToken: controlPlaneToken,",
          ].join("\n"),
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[6], async () => {
  const boundary = built.artifact.authority.dependencyBoundary;
  assert.equal(boundary.cases.length, 4);
  assert.equal(boundary.publicControlPlaneEntryOnly, true);
  assert.equal(boundary.publicReferenceHostServerEntryOnly, true);
  assert.equal(boundary.exactLocalActivationBridgeOnly, true);
  assert.equal(boundary.neighboringDevModulesDenied, true);
  assert.equal(boundary.otherBrowserImportersDenied, true);
  const configurationPath = "dependency-cruiser.config.cjs";
  const configuration = await readFile(path.join(ROOT, configurationPath));
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [
          configurationPath,
          Buffer.from(
            replaceOnce(
              configuration.toString("utf8"),
              "desen-app-browser-e2e-published-server-reference-host-public-root-only",
              "removed-reference-host-public-root-rule",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const browserPackagePath = "apps/desen-app-browser-e2e/package.json";
  const browserPackage = await readFile(path.join(ROOT, browserPackagePath), "utf8");
  const parsedBrowserPackage = JSON.parse(browserPackage);
  const finalCommand = "playwright test --config repeatable-demo-playwright.config.ts";
  const recoveryCommand = "playwright test --config restart-recovery-playwright.config.ts";
  const suite = parsedBrowserPackage.scripts["test:e2e"];
  assert.equal(suite.endsWith(` && ${finalCommand}`), true);
  const invalidPackages = [
    { command: suite.replace(` && ${finalCommand}`, ""), code: "SOURCE_POLICY_VIOLATION" },
    {
      command: `${finalCommand} && ${suite.replace(` && ${finalCommand}`, "")}`,
      code: "SOURCE_POLICY_VIOLATION",
    },
    { command: `${suite} && ${finalCommand}`, code: "SOURCE_POLICY_VIOLATION" },
    { command: suite.replace(` && ${recoveryCommand}`, ""), code: "SOURCE_POLICY_VIOLATION" },
    {
      command: `${recoveryCommand} && ${suite.replace(` && ${recoveryCommand}`, "")}`,
      code: "SOURCE_POLICY_VIOLATION",
    },
    { command: `${suite} && ${recoveryCommand}`, code: "SOURCE_POLICY_VIOLATION" },
  ];
  for (const { command, code } of invalidPackages) {
    const changed = structuredClone(parsedBrowserPackage);
    changed.scripts["test:e2e"] = command;
    await assert.rejects(
      buildDesenAppPublishedHostUpdateEvidence({
        fileOverrides: new Map([[browserPackagePath, Buffer.from(JSON.stringify(changed))]]),
      }),
      expectedError(code),
    );
  }
  const noProtocol = structuredClone(parsedBrowserPackage);
  delete noProtocol.devDependencies["@desen/protocol"];
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([[browserPackagePath, Buffer.from(JSON.stringify(noProtocol))]]),
    }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  const changedMetadata = structuredClone(parsedBrowserPackage);
  changedMetadata.description += " unreviewed";
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([[browserPackagePath, Buffer.from(JSON.stringify(changedMetadata))]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const unchangedOverrides = new Map();
  for (const relativePath of built.liveSuccessorAuthority.compositionSuccessor
    .reviewedChangedInputs) {
    unchangedOverrides.set(relativePath, await readFile(path.join(ROOT, relativePath)));
  }
  const unchanged = await buildDesenAppPublishedHostUpdateEvidence({
    fileOverrides: unchangedOverrides,
  });
  assert.deepEqual(unchanged.artifactBytes, artifactBytes);
  assert.equal(unchanged.liveSuccessorAuthority.compositionSuccessor.task, "M10-T08");
  assert.equal(unchanged.liveSuccessorAuthority.compositionSuccessor.productSourceUnchanged, false);
  assert.equal(
    unchanged.liveSuccessorAuthority.currentSourcePolicy.flowWorkspaceCannotReceivePublicationPort,
    false,
  );
  assert.equal(unchanged.artifact.authority.source.flowWorkspaceCannotReceivePublicationPort, true);
  // Substitute only bytes returned by an owned read, not repository files. Both initial admission
  // and post-build reauthentication must reject; an already captured successor cannot cache trust.
  const t08Path = "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json";
  for (const [relativePath, changedRead] of [
    [t08Path, 1],
    [t08Path, 2],
    [browserPackagePath, 2],
  ]) {
    const originalOpen = filesystem.open;
    let reads = 0;
    try {
      filesystem.open = async (...args) => {
        const handle = await Reflect.apply(originalOpen, filesystem, args);
        if (String(args[0]) === path.join(ROOT, relativePath)) {
          reads += 1;
          if (reads === changedRead) {
            const originalReadFile = handle.readFile.bind(handle);
            handle.readFile = async (...readArgs) =>
              changedByte(await originalReadFile(...readArgs));
          }
        }
        return handle;
      };
      syncBuiltinESMExports();
      await assert.rejects(
        buildDesenAppPublishedHostUpdateEvidence(),
        expectedError("SUCCESSOR_POLICY_VIOLATION"),
      );
      assert.equal(reads, changedRead, relativePath);
    } finally {
      filesystem.open = originalOpen;
      syncBuiltinESMExports();
    }
  }
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [
          browserPackagePath,
          Buffer.from(
            replaceOnce(
              browserPackage,
              "pnpm --filter @desen/reference-host-web... build",
              "pnpm --filter @desen/reference-host-web build",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[7], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.taskStatus, "DONE");
  assert.equal(claim.p07Status, "PROVEN");
  assert.equal(claim.m10T05Closed, true);
  assert.equal(claim.visibleNormalProductAuthoring, true);
  assert.equal(claim.twoSavedPublishedAndActivatedRevisions, true);
  assert.equal(claim.productionDeploymentCovered, false);
  assert.equal(claim.remoteHostCovered, false);
  assert.equal(claim.invalidPublicationCovered, false);
  assert.equal(claim.lastKnownGoodRecoveryCovered, false);
  assert.equal(claim.m10T06Closed, false);
  assert.equal(claim.m10T07Closed, false);
  assert.equal(claim.m10T08Closed, false);
  assert.equal(claim.m10T09Closed, false);
  assert.equal(claim.g10Closed, false);
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppPublishedHostUpdateEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.equal(verified.artifactSha256, DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256);
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.equal(verified.deterministicReaderStartsListener, false);
  assert.equal(verified.viteBuildsExecutedByVerifier, true);
  assert.equal(verified.viteBuildOutputWritten, false);
  assert.deepEqual(second.dependencySecurityCompatibility, built.dependencySecurityCompatibility);
  const liveLockfile = await readFile(path.join(ROOT, "pnpm-lock.yaml"));
  const compatibility = built.dependencySecurityCompatibility;
  assert.equal(compatibility.authority, "SEC-02");
  assert.equal(compatibility.currentBytes, liveLockfile.byteLength);
  assert.equal(compatibility.currentBytes, M10A_T02_LOCKFILE_RECEIPT.bytes);
  assert.equal(compatibility.currentSha256, M10A_T02_LOCKFILE_RECEIPT.sha256);
  assert.deepEqual(compatibility.t02LockfileSuccessor, {
    task: "M10A-T02",
    ...M10A_T02_LOCKFILE_RECEIPT,
    additivePredecessor: {
      authority: "M10A-T01",
      ...M10A_T01_LOCKFILE_RECEIPT,
    },
  });
  assert.deepEqual(compatibility.lockfileSuccessor, {
    task: "M10A-T01",
    ...M10A_T01_LOCKFILE_RECEIPT,
    additivePredecessor: {
      authority: "M10-T08",
      ...M10_T08_LOCKFILE_RECEIPT,
    },
  });
  assert.equal(compatibility.compositionSuccessor.task, "M10-T08");
  assert.deepEqual(compatibility.compositionLockfile, {
    authority: "M10-T08",
    ...M10_T08_LOCKFILE_RECEIPT,
  });
  assert.deepEqual(compatibility.securityTaskLockfile, {
    bytes: 132_006,
    sha256: "0f968b0c6622f6bfe732d5ec9a2b6a49268e171a64fae6caf9501f6d25f8f074",
  });
  assert.equal(compatibility.historicalBytes, 132_012);
  assert.deepEqual(compatibility.predecessor, {
    authority: "SEC-01",
    bytes: 132_012,
    sha256: "49f1d521ebd2e097508d22f8235e111bfb7e6bdc26a039b517a4a19aba7b2735",
  });
  assert.equal(compatibility.fastify, "5.12.2");
  assert.deepEqual(compatibility.fastUri, ["3.1.7", "4.1.4"]);
  assert.deepEqual(compatibility.developmentDependencies, {
    undici: "7.29.1",
    postcss: "8.5.28",
    "js-yaml": ["3.15.2", "4.3.2"],
    "brace-expansion": "5.0.9",
    nanoid: "3.3.18",
  });
  assert.equal(compatibility.projectedReceipts, 2);
  assert.equal(compatibility.immutableArtifactPreserved, true);
  assert.equal(
    createHash("sha256").update(liveLockfile).digest("hex"),
    compatibility.currentSha256,
  );
  const historicalLockfile = built.artifact.boundary.trackedReceipts.find(
    (receipt) => receipt.path === "pnpm-lock.yaml",
  );
  assert.equal(historicalLockfile.sha256, compatibility.historicalSha256);
  assert.equal(historicalLockfile.bytes, compatibility.historicalBytes);
  assert.notEqual(historicalLockfile.sha256, compatibility.currentSha256);
  assert.deepEqual(built.artifactBytes, artifactBytes);
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[9], async () => {
  const liveLockfile = await readFile(path.join(ROOT, "pnpm-lock.yaml"));
  const liveLockfileText = liveLockfile.toString("utf8");
  assert.equal(liveLockfile.byteLength, M10A_T02_LOCKFILE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(liveLockfile).digest("hex"),
    M10A_T02_LOCKFILE_RECEIPT.sha256,
  );
  const m10aT01Lockfile = projectM10AT01Lockfile(liveLockfile);
  assert.equal(m10aT01Lockfile.byteLength, M10A_T01_LOCKFILE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(m10aT01Lockfile).digest("hex"),
    M10A_T01_LOCKFILE_RECEIPT.sha256,
  );
  assert.deepEqual(
    authenticateM10AT02LockfileSuccessor(liveLockfile).predecessorBytes,
    m10aT01Lockfile,
  );
  const compositionLockfile = projectM10T08Lockfile(m10aT01Lockfile);
  assert.equal(compositionLockfile.byteLength, M10_T08_LOCKFILE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(compositionLockfile).digest("hex"),
    M10_T08_LOCKFILE_RECEIPT.sha256,
  );
  assert.deepEqual(
    authenticateM10AT01LockfileSuccessor(
      authenticateM10AT02LockfileSuccessor(liveLockfile).predecessorBytes,
    ).predecessorBytes,
    compositionLockfile,
  );
  assert.deepEqual(
    authenticateM10AT01LockfileSuccessor(m10aT01Lockfile).predecessorBytes,
    compositionLockfile,
  );
  assert.throws(
    () => authenticateM10AT01LockfileSuccessor(liveLockfile),
    expectedError("DEPENDENCY_SUCCESSOR_DRIFT"),
  );
  let priorLockfileText = compositionLockfile.toString("utf8");
  const protocolLink =
    "      '@desen/protocol':\n        specifier: workspace:*\n        version: link:../../packages/protocol\n";
  for (const importerName of ["apps/desen-app-browser-e2e", "apps/reference-host-web"]) {
    const importerStart = priorLockfileText.indexOf(`  ${importerName}:\n`);
    const importerEnd = priorLockfileText.indexOf("\n  apps/", importerStart + 1);
    const importer = priorLockfileText.slice(importerStart, importerEnd);
    assert.ok(importerStart >= 0 && importerEnd > importerStart);
    priorLockfileText =
      priorLockfileText.slice(0, importerStart) +
      replaceOnce(importer, protocolLink, "") +
      priorLockfileText.slice(importerEnd);
  }
  const securityTaskLockfile = Buffer.from(priorLockfileText);
  assert.equal(securityTaskLockfile.byteLength, 132_006);
  assert.equal(
    createHash("sha256").update(securityTaskLockfile).digest("hex"),
    "0f968b0c6622f6bfe732d5ec9a2b6a49268e171a64fae6caf9501f6d25f8f074",
  );
  for (const [
    name,
    priorVersion,
    currentVersion,
    priorIntegrity,
    currentIntegrity,
  ] of SEC_02_LOCKFILE_PACKAGE_UPDATES) {
    assert.ok(priorLockfileText.includes(`${name}@${currentVersion}:`));
    priorLockfileText = replaceOnce(priorLockfileText, currentIntegrity, priorIntegrity)
      .replaceAll(`${name}@${currentVersion}:`, `${name}@${priorVersion}:`)
      .replaceAll(`${name}: ${currentVersion}`, `${name}: ${priorVersion}`);
  }
  const priorBraceHeader = [
    "  brace-expansion@5.0.7:",
    `    resolution: {integrity: ${SEC_02_LOCKFILE_PACKAGE_UPDATES[0][3]}}`,
  ].join("\n");
  priorLockfileText = replaceOnce(
    priorLockfileText,
    `${priorBraceHeader}\n    engines: {node: 20 || >=22}`,
    `${priorBraceHeader}\n    engines: {node: 18 || 20 || >=22}`,
  );
  const priorLockfile = Buffer.from(priorLockfileText);
  assert.equal(priorLockfile.byteLength, built.dependencySecurityCompatibility.predecessor.bytes);
  assert.equal(
    createHash("sha256").update(priorLockfile).digest("hex"),
    "49f1d521ebd2e097508d22f8235e111bfb7e6bdc26a039b517a4a19aba7b2735",
  );
  const t02DependencyOrder = [
    "      '@desen/editor-core':\n        specifier: workspace:*\n        version: link:../editor-core\n",
    "      '@desen/protocol':\n        specifier: workspace:*\n        version: link:../protocol\n",
  ];
  const t02SuccessorMutations = Object.freeze([
    Object.freeze(["tampered", changedByte(liveLockfile)]),
    Object.freeze([
      "extra",
      Buffer.from(
        replaceOnce(
          liveLockfileText,
          "  packages/design-system-core:\n    dependencies:\n",
          "  packages/design-system-core:\n    dependencies:\n      unreviewed-package:\n        specifier: 1.0.0\n        version: 1.0.0\n",
        ),
      ),
    ]),
    Object.freeze(["missing", m10aT01Lockfile]),
    Object.freeze([
      "reordered",
      Buffer.from(
        replaceOnce(
          liveLockfileText,
          t02DependencyOrder.join(""),
          [...t02DependencyOrder].reverse().join(""),
        ),
      ),
    ]),
  ]);
  for (const [mutation, rejectedLockfile] of t02SuccessorMutations) {
    assert.notDeepEqual(rejectedLockfile, liveLockfile, mutation);
    await assert.rejects(
      buildDesenAppPublishedHostUpdateEvidence({
        fileOverrides: new Map([["pnpm-lock.yaml", rejectedLockfile]]),
      }),
      expectedError("DEPENDENCY_SUCCESSOR_DRIFT"),
      mutation,
    );
  }
  for (const rejectedLockfile of [
    compositionLockfile,
    securityTaskLockfile,
    priorLockfile,
    Buffer.from(replaceOnce(liveLockfileText, "specifier: 1.8.0", "specifier: ^1.8.0")),
    Buffer.from(
      replaceOnce(
        liveLockfileText,
        "  packages/starter-catalog-web:\n    dependencies:\n",
        "  packages/starter-catalog-web:\n    dependencies:\n      unreviewed-package:\n        specifier: 1.0.0\n        version: 1.0.0\n",
      ),
    ),
    Buffer.from(liveLockfileText.replaceAll("picocolors: 1.1.1", "picocolors: 1.1.2")),
    ...SEC_02_LOCKFILE_PACKAGE_UPDATES.map(([name, priorVersion, currentVersion]) =>
      Buffer.from(
        liveLockfileText.replaceAll(`${name}@${currentVersion}:`, `${name}@${priorVersion}:`),
      ),
    ),
    Buffer.from(liveLockfileText.replaceAll("fastify@5.12.2", "fastify@5.11.2")),
    Buffer.from(liveLockfileText.replaceAll("fast-uri@3.1.7", "fast-uri@3.1.5")),
    Buffer.from(liveLockfileText.replaceAll("fast-uri@4.1.4", "fast-uri@4.1.2")),
  ]) {
    assert.notDeepEqual(rejectedLockfile, liveLockfile);
    await assert.rejects(
      buildDesenAppPublishedHostUpdateEvidence({
        fileOverrides: new Map([["pnpm-lock.yaml", rejectedLockfile]]),
      }),
      expectedError("DEPENDENCY_SUCCESSOR_DRIFT"),
    );
  }
  const t08Artifact = JSON.parse(
    await readFile(path.join(ROOT, "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json")),
  );
  const currentT08Inputs = new Map();
  for (const currentReceipt of M10A_T02_T01_INPUT_RECEIPTS) {
    const bytes = await readFile(path.join(ROOT, currentReceipt.path));
    currentT08Inputs.set(currentReceipt.path, bytes);
    assert.equal(bytes.byteLength, currentReceipt.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), currentReceipt.sha256);
    const receipt = M10A_T01_T08_INPUT_RECEIPTS.find(
      ({ path: receiptPath }) => receiptPath === currentReceipt.path,
    );
    assert.ok(receipt);
    const m10aT01Bytes = projectM10AT02T01Input(currentReceipt.path, bytes);
    assert.equal(m10aT01Bytes.byteLength, receipt.bytes);
    assert.equal(createHash("sha256").update(m10aT01Bytes).digest("hex"), receipt.sha256);
    assert.throws(
      () => projectM10AT02T01Input(currentReceipt.path, m10aT01Bytes),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
    assert.deepEqual(
      t08Artifact.boundary.trackedReceipts.find(
        ({ path: receiptPath }) => receiptPath === currentReceipt.path,
      ),
      { path: currentReceipt.path, ...receipt.predecessor },
    );
  }
  const dependencyPolicy = currentT08Inputs.get("dependency-cruiser.config.cjs").toString("utf8");
  const fixturePolicy = currentT08Inputs
    .get("scripts/verify-boundary-fixtures.mjs")
    .toString("utf8");
  for (const [relativePath, rejectedBytes] of [
    [
      "dependency-cruiser.config.cjs",
      changedByte(currentT08Inputs.get("dependency-cruiser.config.cjs")),
    ],
    [
      "dependency-cruiser.config.cjs",
      Buffer.from(
        replaceOnce(
          dependencyPolicy,
          '  "starter-catalog-web": ["protocol", "catalog-sdk", "runtime-react"],',
          '  "starter-catalog-web-unreviewed": ["protocol", "catalog-sdk", "runtime-react"],',
        ),
      ),
    ],
    [
      "dependency-cruiser.config.cjs",
      Buffer.from(
        replaceOnce(
          dependencyPolicy,
          '  "starter-catalog-web": ["protocol", "catalog-sdk", "runtime-react"],',
          '  "starter-catalog-web": ["protocol", "catalog-sdk", "runtime-react", "editor-core"],',
        ),
      ),
    ],
    [
      "scripts/verify-boundary-fixtures.mjs",
      changedByte(currentT08Inputs.get("scripts/verify-boundary-fixtures.mjs")),
    ],
    [
      "scripts/verify-boundary-fixtures.mjs",
      Buffer.from(
        replaceOnce(
          fixturePolicy,
          '  { name: "allowed-starter-runtime-react", expectedRule: null },\n',
          "",
        ),
      ),
    ],
    [
      "scripts/verify-boundary-fixtures.mjs",
      Buffer.from(
        replaceOnce(
          fixturePolicy,
          '  { name: "starter-imports-app", expectedRule: "packages-never-import-apps" },',
          '  { name: "starter-imports-app", expectedRule: null },',
        ),
      ),
    ],
  ]) {
    await assert.rejects(
      buildDesenAppPublishedHostUpdateEvidence({
        fileOverrides: new Map([[relativePath, rejectedBytes]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  const parentBytes = await readFile(path.join(ROOT, DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path));
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path, changedByte(parentBytes)],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );
  const bridgeBytes = await readFile(
    path.join(ROOT, DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path),
  );
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path, changedByte(bridgeBytes)],
      ]),
    }),
    expectedError("HISTORICAL_BRIDGE_DRIFT"),
  );
  const backingFenceRepresentatives = [
    DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path,
    "docs/adr/0020-desen-app-fixed-destination-publication-and-host-activation.md",
    BROWSER_PATHS.spec,
    BROWSER_PATHS.config,
    DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path,
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-published-server-imports-local-publication-host/apps/desen-app-browser-e2e/proof-application.mjs",
  ];
  for (const relativePath of backingFenceRepresentatives) {
    await expectExactOverrideCannotMaskBacking(relativePath, "same-byte-mutation");
    await expectExactOverrideCannotMaskBacking(relativePath, "missing");
  }
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes: changedByte(artifactBytes) }),
    expectedError("ARTIFACT_DRIFT"),
  );
  const report = await readFile(path.join(ROOT, REPORT_PATH));
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: Buffer.from(
        replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"),
      ),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const unbuiltWorkspace = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-app-t05-preflight-")),
  );
  temporaryDirectories.push(unbuiltWorkspace);
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes: changedByte(artifactBytes),
      proofDocument: report,
      buildOptions: { workspaceRoot: unbuiltWorkspace },
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: Buffer.from(
        replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"),
      ),
      buildOptions: { workspaceRoot: unbuiltWorkspace },
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  const invalidBuildOptions = { workspaceRoot: unbuiltWorkspace };
  const invalidBuildVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes,
    proofDocument: report,
    buildOptions: invalidBuildOptions,
  });
  invalidBuildOptions.workspaceRoot = ROOT;
  await assert.rejects(invalidBuildVerification, expectedError("SOURCE_INVENTORY_DRIFT"));

  let artifactBytesProxyTrapReads = 0;
  const artifactBytesProxy = new Proxy(Buffer.from(artifactBytes), {
    get() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy prototype trap must not execute");
    },
    ownKeys() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes: artifactBytesProxy }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(artifactBytesProxyTrapReads, 0);

  let proofDocumentProxyTrapReads = 0;
  const proofDocumentProxy = new Proxy(Buffer.from(report), {
    get() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy prototype trap must not execute");
    },
    ownKeys() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: proofDocumentProxy,
    }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(proofDocumentProxyTrapReads, 0);

  let byteAccessorReads = 0;
  const accessorArtifactBytes = new Uint8Array(artifactBytes);
  Object.defineProperty(accessorArtifactBytes, "valueOf", {
    configurable: true,
    get() {
      byteAccessorReads += 1;
      throw new Error("byte valueOf getter must not execute");
    },
  });
  Object.defineProperty(accessorArtifactBytes, Symbol.iterator, {
    configurable: true,
    get() {
      byteAccessorReads += 1;
      throw new Error("byte iterator getter must not execute");
    },
  });
  const accessorByteVerification = await verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes: accessorArtifactBytes,
    proofDocument: report,
  });
  assert.equal(accessorByteVerification.result, "PASS");
  assert.equal(byteAccessorReads, 0);

  const detachedArtifactBytes = new Uint8Array(artifactBytes);
  structuredClone(detachedArtifactBytes.buffer, {
    transfer: [detachedArtifactBytes.buffer],
  });
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes: detachedArtifactBytes }),
    expectedError("OPTIONS_INVALID"),
  );

  const initiallyInvalidArtifactBytes = changedByte(artifactBytes);
  const initiallyInvalidArtifactVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes: initiallyInvalidArtifactBytes,
    proofDocument: report,
  });
  initiallyInvalidArtifactBytes.set(artifactBytes);
  await assert.rejects(initiallyInvalidArtifactVerification, expectedError("ARTIFACT_DRIFT"));

  const initiallyInvalidProofDocument = Buffer.from(
    replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"),
  );
  const initiallyInvalidProofVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes,
    proofDocument: initiallyInvalidProofDocument,
  });
  initiallyInvalidProofDocument.set(report);
  await assert.rejects(initiallyInvalidProofVerification, expectedError("PROOF_DOCUMENT_DRIFT"));

  const initiallyValidArtifactBytes = Buffer.from(artifactBytes);
  const initiallyValidProofDocument = Buffer.from(report);
  const initiallyValidParentBytes = Buffer.from(parentBytes);
  const initiallyValidBuildOptions = {
    workspaceRoot: ROOT,
    fileOverrides: new Map([
      [DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path, initiallyValidParentBytes],
    ]),
  };
  const capturedVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes: initiallyValidArtifactBytes,
    proofDocument: initiallyValidProofDocument,
    buildOptions: initiallyValidBuildOptions,
  });
  initiallyValidArtifactBytes[0] ^= 1;
  initiallyValidProofDocument[0] ^= 1;
  initiallyValidBuildOptions.workspaceRoot = unbuiltWorkspace;
  initiallyValidParentBytes[0] ^= 1;
  initiallyValidBuildOptions.fileOverrides.set(SOURCE_PATHS.main, Buffer.from("invalid source"));
  assert.equal((await capturedVerification).result, "PASS");

  let fileOverridesProxyTrapReads = 0;
  const fileOverridesProxy = new Proxy(new Map(), {
    get() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy prototype trap must not execute");
    },
    ownKeys() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({ fileOverrides: fileOverridesProxy }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: report,
      buildOptions: { fileOverrides: fileOverridesProxy },
    }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(fileOverridesProxyTrapReads, 0);

  let outerOptionsProxyTrapReads = 0;
  const outerOptionsProxy = new Proxy(Object.create(null), {
    get() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy prototype trap must not execute");
    },
    ownKeys() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence(outerOptionsProxy),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(outerOptionsProxyTrapReads, 0);

  const revokedOuterOptions = Proxy.revocable(Object.create(null), {});
  revokedOuterOptions.revoke();
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence(revokedOuterOptions.proxy),
    expectedError("OPTIONS_INVALID"),
  );

  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactPath: 1 }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ proofDocumentPath: 1 }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: 1 }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeDesenAppPublishedHostUpdateEvidence({ artifactPath: 1 }),
    expectedError("OPTIONS_INVALID"),
  );

  let overrideBytesProxyTrapReads = 0;
  const overrideBytesProxy = new Proxy(Buffer.from(sourcePolicyInput.main), {
    get() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy prototype trap must not execute");
    },
    ownKeys() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([[SOURCE_PATHS.main, overrideBytesProxy]]),
    }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(overrideBytesProxyTrapReads, 0);

  let historicalOverridesProxyTrapReads = 0;
  const historicalOverridesProxy = new Proxy(new Map(), {
    get() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy prototype trap must not execute");
    },
    ownKeys() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy ownKeys trap must not execute");
    },
  });
  assert.throws(
    () => materializeDesenAppT04HistoricalReaderFileOverrides(successor, historicalOverridesProxy),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(historicalOverridesProxyTrapReads, 0);

  let historicalBytesProxyTrapReads = 0;
  const historicalBytesProxy = new Proxy(Buffer.from(sourcePolicyInput.main), {
    get() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy prototype trap must not execute");
    },
    ownKeys() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy ownKeys trap must not execute");
    },
  });
  assert.throws(
    () =>
      materializeDesenAppT04HistoricalReaderFileOverrides(
        successor,
        new Map([[SOURCE_PATHS.main, historicalBytesProxy]]),
      ),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(historicalBytesProxyTrapReads, 0);

  let accessorReads = 0;
  const accessorOptions = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return ROOT;
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence(accessorOptions),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(accessorReads, 0);

  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-app-t05-proof-")));
  temporaryDirectories.push(directory);
  const target = path.join(directory, "retained-artifact.json");
  await writeFile(target, artifactBytes);
  const destination = path.join(directory, "artifact.json");
  await symlink(target, destination);
  await observeProofFilesystem(async (observations) => {
    for (const artifactPath of [
      destination,
      directory,
      path.join(directory, "missing", "out.json"),
    ]) {
      await assert.rejects(
        writeDesenAppPublishedHostUpdateEvidence({ artifactPath }),
        expectedError("ARTIFACT_WRITE_UNSAFE"),
      );
    }
    for (const unsafePath of [destination, directory, path.join(directory, "missing.md")]) {
      await assert.rejects(
        verifyDesenAppPublishedHostUpdateEvidence({
          artifactPath: unsafePath,
          proofDocument: report,
        }),
        expectedError("AUTHORITY_UNSAFE"),
      );
      await assert.rejects(
        verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes, proofDocumentPath: unsafePath }),
        expectedError("AUTHORITY_UNSAFE"),
      );
    }
    assert.equal(observations.buildInventories, 0);
  });
  assert.deepEqual(await readFile(target), artifactBytes);

  const proofPath = path.join(directory, "report.md");
  await writeFile(proofPath, report);
  await observeProofFilesystem(
    async (observations) => {
      await assert.rejects(
        verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes, proofDocumentPath: proofPath }),
        expectedError("PROOF_DOCUMENT_DRIFT"),
      );
      assert.ok(observations.buildInventories > 0);
      assert.equal(observations.opens.get(proofPath), 2);
    },
    () =>
      writeFile(
        proofPath,
        Buffer.from(replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN")),
      ),
  );

  const racedDestination = path.join(directory, "raced-artifact.json");
  const writerOptions = { workspaceRoot: ROOT };
  await observeProofFilesystem(
    async (observations) => {
      const writing = writeDesenAppPublishedHostUpdateEvidence({
        artifactPath: racedDestination,
        buildOptions: writerOptions,
      });
      writerOptions.workspaceRoot = unbuiltWorkspace;
      await assert.rejects(writing, expectedError("ARTIFACT_WRITE_UNSAFE"));
      assert.ok(observations.buildInventories > 0);
    },
    () => symlink(target, racedDestination),
  );
  assert.deepEqual(await readFile(target), artifactBytes);
});
