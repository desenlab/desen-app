import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { buildM10AT01PackageIdentity, verifyM10AT01Evidence } from "./m10a-t01-proof.mjs";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t05.json";
const CATALOG_RELATIVE_PATH = "packages/starter-catalog-web/catalog.json";
const ARTIFACT_LIMIT = 1_024 * 1_024;
const REPORT_LIMIT = 256 * 1_024;
const BROWSER_TIMEOUT_MS = 120_000;
const BROWSER_OUTPUT_LIMIT = 256 * 1_024;
const BROWSER_PORT = 4_187;
const PROCESS_GROUP_CLOSE_TIMEOUT_MS = 2_000;
const PROCESS_GROUP_POLL_INTERVAL_MS = 25;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact browser command which typechecks and freshly builds the two-renderer M10A-T05 proof. */
export const M10A_T05_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:e2e"]),
});

/** Exact task-owned M10A-T05 proof-artifact destination. */
export const M10A_T05_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Exact capability inventory admitted by the T05 starter-library extension. */
export const M10A_T05_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Box",
  "run.desen.starter/Button",
  "run.desen.starter/Dialog",
  "run.desen.starter/Grid",
  "run.desen.starter/Heading",
  "run.desen.starter/Icon",
  "run.desen.starter/Image",
  "run.desen.starter/Select",
  "run.desen.starter/Separator",
  "run.desen.starter/Stack",
  "run.desen.starter/Text",
]);

/** Exact browser test inventory expected in a passing T05 browser receipt. */
export const M10A_T05_BROWSER_TEST_TITLES = Object.freeze(
  [
    "keeps Select and Dialog interactions inside the approved boundary",
    "preserves protocol identity with session isolation, survives StrictMode remount, and isolates the host graph",
    "publishes four Source surfaces and rejects undeclared capability data",
    "renders nested logical layout and safe semantic content in authoring and independent host graphs",
  ].sort(),
);

/** Exact all-true browser assertions emitted by the T05 custom reporter. */
export const M10A_T05_BROWSER_ASSERTION_NAMES = Object.freeze(
  [
    "atomicRequiredSlotInsertion",
    "compatibleLiveRerenderIdentity",
    "compatiblePublicationIdentity",
    "disabledAndLoadingButton",
    "escapeFocusReturn",
    "focusTrap",
    "independentHostGraph",
    "invalidDimensionsRejected",
    "keyboardSelect",
    "logicalRtlAlignment",
    "visibleBorderProjection",
    "nestedLayoutSlots",
    "nestedPortalContainment",
    "portalContainment",
    "privateSelectorsRejected",
    "publisherDerivedAuthoring",
    "sameStaticAdapterRegistry",
    "semanticContent",
    "strictModeUnmountRemount",
    "trustedLocalMedia",
    "unsupportedImageColorRejected",
    "unknownCapabilityRejected",
    "unknownStylePartRejected",
    "visibleVerticalSeparator",
    "wrongEventPayloadRejected",
  ].sort(),
);

/** Stable root mutation-test declarations embedded in T05 evidence. */
export const M10A_T05_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T05 builds the exact expanded starter Catalog deterministically",
  "M10A-T05 admits only the declared layout and semantic-content capability contracts",
  "M10A-T05 authenticates all-positive authoring and independent-host browser observations",
  "M10A-T05 rejects invalid dimensions, executable content, remote media, and private selectors",
  "M10A-T05 keeps T01 historical evidence immutable while the starter Catalog evolves",
  "M10A-T05 rejects artifact, catalog, and browser-receipt drift",
  "M10A-T05 writer is atomic, leaves the Catalog read-only, and runs the browser in owned temporary authority",
]);

/** Stable error class raised at the bounded M10A-T05 proof boundary. */
export class M10AT05ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT05ProofError";
    this.code = `M10A_T05_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT05ProofError(code, message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (
    value !== null &&
    typeof value === "object" &&
    !ArrayBuffer.isView(value) &&
    !Object.isFrozen(value)
  ) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function prettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function exactRecord(value, keys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert plain record.`);
  }
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    fail("OPTIONS_INVALID", `${label} fields drifted.`);
  }
  const captured = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor))
      fail("OPTIONS_INVALID", `${label}.${key} must be inert own data.`);
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureOptions(rawOptions) {
  const value = rawOptions === undefined ? {} : rawOptions;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", "Options must be one inert plain record.");
  }
  const allowed = new Set([
    "artifactBytes",
    "artifactPath",
    "beforeAtomicRename",
    "browserObservation",
    "workspaceRoot",
  ]);
  const captured = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowed.has(key) ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", "Unknown or executable proof option.");
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

async function canonicalWorkspaceRoot(candidate = WORKSPACE_ROOT) {
  if (
    typeof candidate !== "string" ||
    !path.isAbsolute(candidate) ||
    path.resolve(candidate) !== candidate ||
    candidate.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  const entry = await lstat(candidate).catch(() => undefined);
  if (!entry?.isDirectory() || entry.isSymbolicLink() || (await realpath(candidate)) !== candidate)
    fail("AUTHORITY_UNSAFE", "Workspace root must be one canonical directory.");
  return candidate;
}

function sameEntry(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function readRegularAuthority(workspaceRoot, relativePath, limit) {
  const target = path.join(workspaceRoot, relativePath);
  let handle;
  try {
    const before = await lstat(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size > BigInt(limit)
    )
      throw new Error("unsafe authority");
    handle = await open(target, "r", READ_FLAGS);
    const [linked, fromHandle, bytes] = await Promise.all([
      lstat(target, { bigint: true }),
      handle.stat({ bigint: true }),
      handle.readFile(),
    ]);
    const [after, pathAfter] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(target, { bigint: true }),
    ]);
    if (
      !linked.isFile() ||
      linked.isSymbolicLink() ||
      linked.nlink !== 1n ||
      !sameEntry(before, linked) ||
      !sameEntry(before, fromHandle) ||
      !sameEntry(fromHandle, after) ||
      !sameEntry(after, pathAfter) ||
      bytes.byteLength > limit ||
      BigInt(bytes.byteLength) !== after.size
    ) {
      throw new Error("authority changed while read");
    }
    return Buffer.from(bytes);
  } catch {
    fail("AUTHORITY_UNSAFE", `Required authority is unavailable: ${relativePath}`);
  } finally {
    await handle?.close();
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("BROWSER_OBSERVATION_INVALID", `${label} must be valid UTF-8 JSON.`);
  }
}

function captureBrowserObservation(rawObservation) {
  const observation = exactRecord(
    rawObservation,
    ["assertions", "graphReceipts", "profile", "result", "tests"],
    "Browser observation",
  );
  if (
    observation.profile !== "desen.m10a-t05.browser-proof.v1" ||
    observation.result !== "PASS" ||
    !Array.isArray(observation.graphReceipts) ||
    JSON.stringify(observation.graphReceipts) !== JSON.stringify(["authoring", "host"]) ||
    !Array.isArray(observation.tests) ||
    observation.assertions === null ||
    typeof observation.assertions !== "object" ||
    Array.isArray(observation.assertions)
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser receipt identity drifted.");
  }
  const titles = observation.tests
    .map((candidate, index) => {
      const item = exactRecord(candidate, ["result", "title"], `Browser test ${index}`);
      if (item.result !== "PASS" || typeof item.title !== "string")
        fail("BROWSER_OBSERVATION_INVALID", "Browser test receipt contains a non-passing case.");
      return item.title;
    })
    .sort();
  if (JSON.stringify(titles) !== JSON.stringify(M10A_T05_BROWSER_TEST_TITLES))
    fail("BROWSER_OBSERVATION_INVALID", "Browser test inventory drifted.");
  const assertionNames = Object.keys(observation.assertions).sort();
  if (
    JSON.stringify(assertionNames) !== JSON.stringify(M10A_T05_BROWSER_ASSERTION_NAMES) ||
    assertionNames.some((name) => observation.assertions[name] !== true)
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser assertion inventory drifted.");
  }
  return deepFreeze(structuredClone(observation));
}

function assertT05Catalog(identity) {
  const components = identity.catalog.components;
  const ids = Object.keys(components).sort();
  if (JSON.stringify(ids) !== JSON.stringify(M10A_T05_CAPABILITY_IDS))
    fail("CATALOG_INVALID", "Starter Catalog capability inventory drifted.");
  for (const id of ["run.desen.starter/Box", "run.desen.starter/Stack", "run.desen.starter/Grid"]) {
    const component = components[id];
    const slot = component?.slots?.default;
    if (
      component?.category !== "layout" ||
      slot?.required !== true ||
      slot?.minItems !== 1 ||
      slot?.maxItems !== 100 ||
      !Array.isArray(slot?.acceptsCategories) ||
      component?.styleParts?.root?.propertiesSchema?.additionalProperties !== false
    ) {
      fail("CATALOG_INVALID", "Starter layout contract drifted.");
    }
  }
  for (const id of [
    "run.desen.starter/Text",
    "run.desen.starter/Heading",
    "run.desen.starter/Image",
    "run.desen.starter/Icon",
    "run.desen.starter/Separator",
  ]) {
    const component = components[id];
    if (
      component?.category !== "content" ||
      component?.styleParts?.root?.propertiesSchema?.additionalProperties !== false
    ) {
      fail("CATALOG_INVALID", "Starter content contract drifted.");
    }
  }
  const layoutProperties =
    components["run.desen.starter/Stack"]?.styleParts?.root?.propertiesSchema?.properties;
  const imageStyleProperties =
    components["run.desen.starter/Image"]?.styleParts?.root?.propertiesSchema?.properties;
  const iconStyleProperties =
    components["run.desen.starter/Icon"]?.styleParts?.root?.propertiesSchema?.properties;
  const imageSources = components["run.desen.starter/Image"]?.propsSchema?.properties?.source?.enum;
  const iconNames = components["run.desen.starter/Icon"]?.propsSchema?.properties?.name?.enum;
  if (
    !Object.hasOwn(layoutProperties ?? {}, "paddingInline") ||
    !Object.hasOwn(layoutProperties ?? {}, "marginInline") ||
    !Object.hasOwn(layoutProperties ?? {}, "width") ||
    Object.hasOwn(imageStyleProperties ?? {}, "color") ||
    !Object.hasOwn(iconStyleProperties ?? {}, "color") ||
    JSON.stringify(imageSources) !== JSON.stringify(["neutral-horizon", "neutral-grid"]) ||
    !Array.isArray(iconNames) ||
    !iconNames.includes("info") ||
    !iconNames.includes("search")
  ) {
    fail("CATALOG_INVALID", "Starter layout/content property boundary drifted.");
  }
  return ids;
}

function executeChild(command, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const ownsGroup = process.platform !== "win32";
    const child = spawn(command, args, { ...options, detached: ownsGroup });
    const output = [];
    let outputBytes = 0;
    let settled = false;
    let timedOut = false;
    let outputExceeded = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolvePromise(result);
    };
    const reject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectPromise(error);
    };
    const signalGroup = (signal) => {
      try {
        if (ownsGroup && Number.isSafeInteger(child.pid)) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    };
    const groupExists = () => {
      if (!ownsGroup || !Number.isSafeInteger(child.pid)) return false;
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch (error) {
        if (error?.code === "ESRCH") return false;
        if (error?.code === "EPERM") return true;
        throw error;
      }
    };
    const waitForGroupExit = async () => {
      if (!ownsGroup || !Number.isSafeInteger(child.pid)) return true;
      const deadline = Date.now() + PROCESS_GROUP_CLOSE_TIMEOUT_MS;
      while (groupExists()) {
        if (Date.now() >= deadline) {
          signalGroup("SIGKILL");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, PROCESS_GROUP_POLL_INTERVAL_MS));
      }
      const killDeadline = Date.now() + PROCESS_GROUP_CLOSE_TIMEOUT_MS;
      while (groupExists()) {
        if (Date.now() >= killDeadline) return false;
        await new Promise((resolve) => setTimeout(resolve, PROCESS_GROUP_POLL_INTERVAL_MS));
      }
      return true;
    };
    const terminate = () => {
      try {
        signalGroup("SIGTERM");
      } catch (error) {
        reject(error);
      }
      setTimeout(() => {
        try {
          signalGroup("SIGKILL");
        } catch (error) {
          reject(error);
        }
      }, PROCESS_GROUP_CLOSE_TIMEOUT_MS).unref();
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, BROWSER_TIMEOUT_MS);
    const capture = (chunk) => {
      const bytes = Buffer.from(chunk);
      outputBytes += bytes.byteLength;
      if (outputBytes <= BROWSER_OUTPUT_LIMIT) output.push(bytes);
      if (outputBytes > BROWSER_OUTPUT_LIMIT && !outputExceeded) {
        outputExceeded = true;
        terminate();
      }
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.once("error", reject);
    child.once("close", (code, signal) => {
      void waitForGroupExit()
        .then((processGroupClosed) => {
          finish({
            code,
            signal,
            timedOut,
            outputExceeded,
            outputBytes: Buffer.concat(output).byteLength,
            processGroupClosed,
          });
        })
        .catch(reject);
    });
  });
}

async function assertBrowserPortReleased() {
  await new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(
      () => finish(() => rejectPromise(new Error("Browser proof port stayed occupied."))),
      PROCESS_GROUP_CLOSE_TIMEOUT_MS,
    );
    server.once("error", (error) => finish(() => rejectPromise(error)));
    server.listen(BROWSER_PORT, "127.0.0.1", () => {
      server.close((error) => {
        if (error === undefined) finish(resolvePromise);
        else finish(() => rejectPromise(error));
      });
    });
  });
}

/** Executes the real, bounded T05 Playwright proof in one owned temporary directory. */
export async function executeM10AT05BrowserProof() {
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "desen-m10a-t05-browser-")),
  );
  try {
    const result = await executeChild(
      M10A_T05_BROWSER_COMMAND.command,
      M10A_T05_BROWSER_COMMAND.args,
      {
        cwd: WORKSPACE_ROOT,
        env: { ...process.env, DESEN_M10A_T05_PROOF_TEMP: temporaryRoot },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (
      result.code !== 0 ||
      result.signal !== null ||
      result.timedOut ||
      result.outputExceeded ||
      !result.processGroupClosed
    )
      fail("BROWSER_EXECUTION_FAILED", "The real T05 Chromium proof did not close successfully.");
    try {
      await assertBrowserPortReleased();
    } catch {
      fail("BROWSER_EXECUTION_FAILED", "The T05 browser process retained its fixed proof port.");
    }
    const bytes = await readRegularAuthority(temporaryRoot, "browser-proof.json", REPORT_LIMIT);
    return captureBrowserObservation(parseJson(bytes, "Browser proof report"));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function buildArtifact(identity, browserObservation, historicalT01) {
  const capabilityIds = assertT05Catalog(identity);
  return deepFreeze({
    schemaVersion: 1,
    task: "M10A-T05",
    proofId: "m10a-t05",
    profile: "desen.m10a-t05.layout-content.v1",
    result: "PASS",
    package: {
      name: "@desen/starter-catalog-web",
      catalog: {
        id: identity.catalog.id,
        version: identity.catalog.version,
        target: identity.catalog.target,
        sha256: sha256(identity.catalogBytes),
        bytes: identity.catalogBytes.byteLength,
      },
      packageDigest: identity.packageIdentity.packageDigest,
      digestProfile: identity.packageIdentity.profile,
      distFiles: identity.inventory.distFiles,
      distBytes: identity.inventory.distBytes,
    },
    capabilities: {
      ids: capabilityIds,
      layout: ["Box", "Stack", "Grid"],
      content: ["Text", "Heading", "Image", "Icon", "Separator"],
      logicalProperties: ["paddingInline", "marginInline", "textAlign", "fill", "hug"],
      trustedImageSources: ["neutral-horizon", "neutral-grid"],
    },
    browser: browserObservation,
    historical: {
      m10aT01ArtifactSha256: historicalT01.artifactSha256,
      m10aT01CatalogSha256: historicalT01.catalogSha256,
    },
    claims: {
      layoutAndContentCapabilities: true,
      semanticHtmlWhereBaseUiIsUnnecessary: true,
      logicalRtlAlignment: true,
      nestedLayoutSlots: true,
      trustedBuiltInMediaOnly: true,
      unknownStylePropertiesRejected: true,
      invalidDimensionsRejected: true,
      unsupportedImageColorRejected: true,
      visibleVerticalSeparator: true,
      executableContentRejected: true,
      privateSelectorsRejected: true,
      sameStaticAdaptersInCanvasAndHost: true,
      historicalArtifactsRewritten: false,
      runtimeCoreChanged: false,
    },
    tests: {
      rootTestNames: M10A_T05_ROOT_TEST_NAMES,
      packageCommand: "pnpm --filter @desen/starter-catalog-web test",
      browserCommand: `${M10A_T05_BROWSER_COMMAND.command} ${M10A_T05_BROWSER_COMMAND.args.join(" ")}`,
      browserExecutedByVerifier: true,
    },
    nonClaims: [
      "T05 does not add arbitrary user asset import, local asset storage, or font admission; T13 owns those boundaries.",
      "T05 does not add normal-App design editing, draft-library persistence, Publisher authority, or Runtime activation.",
      "T05 does not add freeform CSS selectors, executable markup, private DOM access, or remote media URLs.",
      "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
}

/** Builds deterministic T05 evidence from one exact passing browser observation. */
export async function buildM10AT05Evidence(rawOptions) {
  const options = captureOptions(rawOptions);
  if (options.browserObservation === undefined)
    fail("OPTIONS_INVALID", "T05 evidence requires one browser observation.");
  const [identity, historicalT01] = await Promise.all([
    buildM10AT01PackageIdentity(
      options.workspaceRoot === undefined ? undefined : { workspaceRoot: options.workspaceRoot },
    ),
    verifyM10AT01Evidence(),
  ]);
  const browser = captureBrowserObservation(options.browserObservation);
  const artifact = buildArtifact(identity, browser, historicalT01);
  const artifactBytes = prettyBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes), identity });
}

function captureArtifactBytes(value) {
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value) || value.byteLength > ARTIFACT_LIMIT)
    fail("OPTIONS_INVALID", "artifactBytes must be one bounded non-Proxy Buffer.");
  return Buffer.from(value);
}

/** Writes one newly captured T05 proof artifact through its exact atomic destination. */
export async function writeM10AT05Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const artifactPath = options.artifactPath ?? path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (
    typeof artifactPath !== "string" ||
    !path.isAbsolute(artifactPath) ||
    path.resolve(artifactPath) !== artifactPath ||
    artifactPath.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "artifactPath must be one canonical absolute path.");
  }
  const browser =
    options.browserObservation === undefined
      ? await executeM10AT05BrowserProof()
      : captureBrowserObservation(options.browserObservation);
  const built = await buildM10AT05Evidence({ workspaceRoot, browserObservation: browser });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic T05 evidence write failed.");
  }
  return deepFreeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: sha256(built.identity.catalogBytes),
    packageDigest: built.identity.packageIdentity.packageDigest,
  });
}

/**
 * Rebuilds current package evidence, executes the real browser proof, and authenticates the exact
 * checkpointed T05 artifact without permitting a source or receipt rewrite.
 */
export async function verifyM10AT05Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  let artifactBytes;
  let checkpointHeadSha256 = "TEST_OVERRIDE";
  if (options.artifactBytes === undefined) {
    const frozen = await readCheckpointedFrozenArtifact("M10A-T05", { workspaceRoot });
    if (frozen.path !== ARTIFACT_RELATIVE_PATH)
      fail("ARTIFACT_DRIFT", "Checkpointed T05 artifact path drifted.");
    artifactBytes = Buffer.from(frozen.bytes);
    checkpointHeadSha256 = frozen.checkpointHeadSha256;
  } else {
    artifactBytes = captureArtifactBytes(options.artifactBytes);
  }
  const currentCatalog = await readRegularAuthority(
    workspaceRoot,
    CATALOG_RELATIVE_PATH,
    ARTIFACT_LIMIT,
  );
  const browser =
    options.browserObservation === undefined
      ? await executeM10AT05BrowserProof()
      : captureBrowserObservation(options.browserObservation);
  const built = await buildM10AT05Evidence({ workspaceRoot, browserObservation: browser });
  if (!currentCatalog.equals(built.identity.catalogBytes))
    fail("CATALOG_DRIFT", "Tracked starter Catalog differs from the current package identity.");
  if (!artifactBytes.equals(built.artifactBytes))
    fail("ARTIFACT_DRIFT", "Checkpointed T05 evidence differs from current authorities.");
  return deepFreeze({
    status: "PASS",
    task: "M10A-T05",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: sha256(built.identity.catalogBytes),
    packageDigest: built.identity.packageIdentity.packageDigest,
    browserTests: built.artifact.browser.tests,
    checkpointHeadSha256,
    browserExecutedByVerifier: options.browserObservation === undefined,
  });
}
