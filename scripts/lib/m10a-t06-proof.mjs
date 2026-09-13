import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { buildM10AT01PackageIdentity } from "./m10a-t01-proof.mjs";
import { verifyM10AT05Evidence } from "./m10a-t05-proof.mjs";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t06.json";
const CATALOG_RELATIVE_PATH = "packages/starter-catalog-web/catalog.json";
const ARTIFACT_LIMIT = 1_024 * 1_024;
const REPORT_LIMIT = 256 * 1_024;
const BROWSER_TIMEOUT_MS = 180_000;
const BROWSER_OUTPUT_LIMIT = 256 * 1_024;
const BROWSER_PORT = 4_189;
const PROCESS_GROUP_CLOSE_TIMEOUT_MS = 2_000;
const PROCESS_GROUP_POLL_INTERVAL_MS = 25;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact browser command which typechecks, builds, and runs the isolated M10A-T06 proof. */
export const M10A_T06_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t06"]),
});

/** Exact task-owned M10A-T06 proof-artifact destination. */
export const M10A_T06_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Exact current 0.3.0 starter Catalog capability inventory. */
export const M10A_T06_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Box",
  "run.desen.starter/Button",
  "run.desen.starter/Checkbox",
  "run.desen.starter/Dialog",
  "run.desen.starter/Grid",
  "run.desen.starter/Heading",
  "run.desen.starter/Icon",
  "run.desen.starter/Image",
  "run.desen.starter/RadioGroup",
  "run.desen.starter/Select",
  "run.desen.starter/Separator",
  "run.desen.starter/Stack",
  "run.desen.starter/Switch",
  "run.desen.starter/Text",
  "run.desen.starter/TextArea",
  "run.desen.starter/TextField",
]);

/** Exact M10A-T06 form-control additions to the existing starter Catalog. */
export const M10A_T06_FORM_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Checkbox",
  "run.desen.starter/RadioGroup",
  "run.desen.starter/Switch",
  "run.desen.starter/TextArea",
  "run.desen.starter/TextField",
]);

/** Exact browser case inventory emitted by the isolated M10A-T06 custom reporter. */
export const M10A_T06_BROWSER_TEST_TITLES = Object.freeze(
  [
    "publishes the T06 form surfaces through the reviewed starter Catalog",
    "preserves native labels and described messages in authoring and independent host graphs",
    "projects controlled form changes through the Runtime event boundary",
    "retains Button disabled/loading behavior and rejects malformed form payloads",
  ].sort(),
);

/** Exact all-true browser assertion inventory emitted by the isolated M10A-T06 reporter. */
export const M10A_T06_BROWSER_ASSERTION_NAMES = Object.freeze(
  [
    "allFormCapabilitiesPublished",
    "controlledCheckboxChange",
    "controlledRadioGroupChange",
    "controlledSwitchChange",
    "controlledTextAreaChange",
    "controlledTextFieldChange",
    "disabledAndLoadingButton",
    "helpAndErrorAssociation",
    "independentHostGraph",
    "invalidFormValueRejected",
    "keyboardFocus",
    "malformedFormPayloadRejected",
    "nativeLabelAssociation",
    "publisherDerivedAuthoring",
    "safeStyleProjectionRetainsSemantics",
    "sameStaticAdapterRegistry",
  ].sort(),
);

/** Stable root mutation-test declarations embedded in M10A-T06 evidence. */
export const M10A_T06_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T06 builds the exact 0.3.0 starter Catalog deterministically",
  "M10A-T06 admits only the declared form-control contracts and controlled event payloads",
  "M10A-T06 authenticates all-positive authoring and independent-host form browser observations",
  "M10A-T06 rejects malformed form observations, artifact drift, and unsafe injected data",
  "M10A-T06 preserves the checkpointed T05 receipt while the starter Catalog evolves",
  "M10A-T06 writer is atomic, leaves the Catalog read-only, and runs Chromium in owned temporary authority",
]);

const FORM_CONTRACTS = Object.freeze([
  Object.freeze({
    id: "run.desen.starter/TextField",
    properties: Object.freeze([
      "disabled",
      "error",
      "helpText",
      "label",
      "placeholder",
      "required",
      "value",
    ]),
    required: Object.freeze(["label"]),
    payloadKey: "value",
    styleParts: Object.freeze(["control", "error", "help", "label", "root"]),
    visualStates: Object.freeze(["hover", "focus", "disabled", "required", "invalid"]),
  }),
  Object.freeze({
    id: "run.desen.starter/TextArea",
    properties: Object.freeze([
      "disabled",
      "error",
      "helpText",
      "label",
      "placeholder",
      "required",
      "rows",
      "value",
    ]),
    required: Object.freeze(["label"]),
    payloadKey: "value",
    styleParts: Object.freeze(["control", "error", "help", "label", "root"]),
    visualStates: Object.freeze(["hover", "focus", "disabled", "required", "invalid"]),
  }),
  Object.freeze({
    id: "run.desen.starter/Checkbox",
    properties: Object.freeze(["checked", "disabled", "error", "helpText", "label", "required"]),
    required: Object.freeze(["label"]),
    payloadKey: "checked",
    styleParts: Object.freeze(["control", "error", "help", "indicator", "label", "root"]),
    visualStates: Object.freeze(["hover", "focus", "checked", "disabled", "required", "invalid"]),
  }),
  Object.freeze({
    id: "run.desen.starter/RadioGroup",
    properties: Object.freeze([
      "disabled",
      "error",
      "helpText",
      "label",
      "options",
      "required",
      "value",
    ]),
    required: Object.freeze(["label", "options"]),
    payloadKey: "value",
    styleParts: Object.freeze([
      "control",
      "error",
      "help",
      "indicator",
      "label",
      "option",
      "optionLabel",
      "root",
    ]),
    visualStates: Object.freeze(["hover", "focus", "selected", "disabled", "required", "invalid"]),
  }),
  Object.freeze({
    id: "run.desen.starter/Switch",
    properties: Object.freeze(["checked", "disabled", "error", "helpText", "label", "required"]),
    required: Object.freeze(["label"]),
    payloadKey: "checked",
    styleParts: Object.freeze(["control", "error", "help", "label", "root", "thumb", "track"]),
    visualStates: Object.freeze(["hover", "focus", "checked", "disabled", "required", "invalid"]),
  }),
]);

/** Stable error class raised at the bounded M10A-T06 proof boundary. */
export class M10AT06ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT06ProofError";
    this.code = "M10A_T06_" + code;
  }
}

function fail(code, message) {
  throw new M10AT06ProofError(code, message);
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
  // JSON.stringify expands every array, while the repository's pinned JSON formatter compacts
  // these two fixed, short evidence enumerations. Keep the writer and verifier deterministic
  // without adding the formatter itself to the proof reader's runtime authority.
  const serialized = JSON.stringify(value, null, 2)
    .replace(
      '    "accessibleParts": [\n      "label",\n      "help",\n      "error"\n    ]',
      '    "accessibleParts": ["label", "help", "error"]',
    )
    .replace(
      '    "graphReceipts": [\n      "authoring",\n      "host"\n    ]',
      '    "graphReceipts": ["authoring", "host"]',
    );
  return Buffer.from(serialized + "\n", "utf8");
}

function exactRecord(value, keys, label, failureCode = "OPTIONS_INVALID") {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(failureCode, label + " must be one inert plain record.");
  }
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    fail(failureCode, label + " fields drifted.");
  }
  const captured = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail(failureCode, label + "." + key + " must be inert own data.");
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureOptions(rawOptions, allowed, label) {
  const value = rawOptions === undefined ? {} : rawOptions;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", label + " must be one inert plain record.");
  }
  const captured = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowed.includes(key) ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", label + " contains an unknown or executable option.");
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
  try {
    const entry = await lstat(candidate);
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      (await realpath(candidate)) !== candidate
    ) {
      fail("AUTHORITY_UNSAFE", "Workspace root must be one canonical directory.");
    }
  } catch (error) {
    if (error instanceof M10AT06ProofError) throw error;
    fail("AUTHORITY_UNSAFE", "Workspace root is not readable.");
  }
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
    ) {
      throw new Error("unsafe authority");
    }
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
  } catch (error) {
    if (error instanceof M10AT06ProofError) throw error;
    fail("AUTHORITY_UNSAFE", "Required authority is unavailable: " + relativePath);
  } finally {
    await handle?.close();
  }
}

function assertExactStringArray(value, expected, label, failureCode) {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    value.length !== expected.length ||
    value.some((item, index) => typeof item !== "string" || item !== expected[index])
  ) {
    fail(failureCode, label + " drifted.");
  }
}

function parseJson(bytes, label, failureCode) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(failureCode, label + " must be valid UTF-8 JSON.");
  }
}

function captureBrowserObservation(rawObservation) {
  const observation = exactRecord(
    rawObservation,
    ["assertions", "graphReceipts", "profile", "result", "tests"],
    "Browser observation",
    "BROWSER_OBSERVATION_INVALID",
  );
  if (
    observation.profile !== "desen.m10a-t06.browser-proof.v1" ||
    observation.result !== "PASS" ||
    !Array.isArray(observation.tests) ||
    utilTypes.isProxy(observation.tests)
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser receipt identity drifted.");
  }
  assertExactStringArray(
    observation.graphReceipts,
    ["authoring", "host"],
    "Browser graph receipts",
    "BROWSER_OBSERVATION_INVALID",
  );
  const titles = observation.tests
    .map((candidate, index) => {
      const item = exactRecord(
        candidate,
        ["result", "title"],
        "Browser test " + index,
        "BROWSER_OBSERVATION_INVALID",
      );
      if (item.result !== "PASS" || typeof item.title !== "string") {
        fail("BROWSER_OBSERVATION_INVALID", "Browser test receipt contains a non-passing case.");
      }
      return item.title;
    })
    .sort();
  assertExactStringArray(
    titles,
    M10A_T06_BROWSER_TEST_TITLES,
    "Browser test inventory",
    "BROWSER_OBSERVATION_INVALID",
  );
  const assertions = exactRecord(
    observation.assertions,
    M10A_T06_BROWSER_ASSERTION_NAMES,
    "Browser assertions",
    "BROWSER_OBSERVATION_INVALID",
  );
  if (M10A_T06_BROWSER_ASSERTION_NAMES.some((name) => assertions[name] !== true)) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser assertion inventory drifted.");
  }
  return deepFreeze(structuredClone(observation));
}

function assertT06Catalog(identity) {
  const catalog = identity.catalog;
  if (
    catalog.id !== "run.desen.starter.web" ||
    catalog.version !== "0.3.0" ||
    catalog.target !== "web-react"
  ) {
    fail("CATALOG_INVALID", "Starter Catalog identity is not the reviewed T06 0.3.0 contract.");
  }
  const components = catalog.components;
  const ids = Object.keys(components).sort();
  assertExactStringArray(
    ids,
    M10A_T06_CAPABILITY_IDS,
    "Starter capability inventory",
    "CATALOG_INVALID",
  );

  for (const contract of FORM_CONTRACTS) {
    const component = components[contract.id];
    const propsSchema = component?.propsSchema;
    const payloadSchema = component?.events?.change?.payloadSchema;
    if (
      component?.category !== "input" ||
      component?.slots !== undefined ||
      propsSchema?.type !== "object" ||
      propsSchema?.additionalProperties !== false ||
      payloadSchema?.type !== "object" ||
      payloadSchema?.additionalProperties !== false
    ) {
      fail("CATALOG_INVALID", "Form-control contract boundary drifted: " + contract.id);
    }
    assertExactStringArray(
      Object.keys(propsSchema.properties ?? {}).sort(),
      contract.properties,
      contract.id + " props",
      "CATALOG_INVALID",
    );
    assertExactStringArray(
      propsSchema.required,
      contract.required,
      contract.id + " required props",
      "CATALOG_INVALID",
    );
    assertExactStringArray(
      Object.keys(component.styleParts ?? {}).sort(),
      contract.styleParts,
      contract.id + " style parts",
      "CATALOG_INVALID",
    );
    assertExactStringArray(
      component.visualStates,
      contract.visualStates,
      contract.id + " visual states",
      "CATALOG_INVALID",
    );
    if (
      Object.keys(component.events ?? {}).length !== 1 ||
      !Object.hasOwn(component.events ?? {}, "change") ||
      JSON.stringify(payloadSchema.required) !== JSON.stringify([contract.payloadKey]) ||
      Object.keys(payloadSchema.properties ?? {}).length !== 1 ||
      !Object.hasOwn(payloadSchema.properties ?? {}, contract.payloadKey)
    ) {
      fail("CATALOG_INVALID", "Form-control event payload boundary drifted: " + contract.id);
    }
    for (const stylePart of Object.values(component.styleParts ?? {})) {
      if (stylePart?.propertiesSchema?.additionalProperties !== false) {
        fail("CATALOG_INVALID", "Form-control style boundary drifted: " + contract.id);
      }
    }
  }

  const textAreaRows = components["run.desen.starter/TextArea"]?.propsSchema?.properties?.rows;
  const radioOptions = components["run.desen.starter/RadioGroup"]?.propsSchema?.properties?.options;
  const buttonProps = components["run.desen.starter/Button"]?.propsSchema?.properties;
  if (
    textAreaRows?.type !== "integer" ||
    textAreaRows?.minimum !== 2 ||
    textAreaRows?.maximum !== 12 ||
    radioOptions?.type !== "array" ||
    radioOptions?.maxItems !== 100 ||
    radioOptions?.items?.additionalProperties !== false ||
    buttonProps?.disabled?.type !== "boolean" ||
    buttonProps?.loading?.type !== "boolean"
  ) {
    fail("CATALOG_INVALID", "Bounded T06 form values or retained Button states drifted.");
  }
  return ids;
}

async function buildCurrentPackageIdentity(workspaceRoot) {
  const identity = await buildM10AT01PackageIdentity({ workspaceRoot });
  const trackedCatalog = await readRegularAuthority(
    workspaceRoot,
    CATALOG_RELATIVE_PATH,
    ARTIFACT_LIMIT,
  );
  if (!trackedCatalog.equals(identity.catalogBytes)) {
    fail("CATALOG_DRIFT", "Tracked starter Catalog differs from the current package identity.");
  }
  assertT06Catalog(identity);
  return identity;
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

/** Executes the real, bounded T06 Playwright proof in one owned temporary directory. */
export async function executeM10AT06BrowserProof() {
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "desen-m10a-t06-browser-")),
  );
  try {
    let result;
    try {
      result = await executeChild(M10A_T06_BROWSER_COMMAND.command, M10A_T06_BROWSER_COMMAND.args, {
        cwd: WORKSPACE_ROOT,
        env: { ...process.env, DESEN_M10A_T06_PROOF_TEMP: temporaryRoot },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      fail("BROWSER_EXECUTION_FAILED", "The real T06 Chromium proof could not start.");
    }
    if (
      result.code !== 0 ||
      result.signal !== null ||
      result.timedOut ||
      result.outputExceeded ||
      !result.processGroupClosed
    ) {
      fail(
        "BROWSER_EXECUTION_FAILED",
        "The real T06 Chromium proof did not close successfully: " +
          JSON.stringify({
            code: result.code,
            signal: result.signal,
            timedOut: result.timedOut,
            outputExceeded: result.outputExceeded,
            processGroupClosed: result.processGroupClosed,
          }),
      );
    }
    try {
      await assertBrowserPortReleased();
    } catch {
      fail("BROWSER_EXECUTION_FAILED", "The T06 browser process retained its fixed proof port.");
    }
    const bytes = await readRegularAuthority(temporaryRoot, "browser-proof.json", REPORT_LIMIT);
    return captureBrowserObservation(
      parseJson(bytes, "Browser proof report", "BROWSER_OBSERVATION_INVALID"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function buildArtifact(identity, browserObservation, historicalT05) {
  const capabilityIds = assertT06Catalog(identity);
  return deepFreeze({
    schemaVersion: 1,
    task: "M10A-T06",
    proofId: "m10a-t06",
    profile: "desen.m10a-t06.form-controls.v1",
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
      formControls: M10A_T06_FORM_CAPABILITY_IDS,
      controlledEventPayloads: [
        "TextField.change:{value:string}",
        "TextArea.change:{value:string}",
        "Checkbox.change:{checked:boolean}",
        "RadioGroup.change:{value:string}",
        "Switch.change:{checked:boolean}",
      ],
      accessibleParts: ["label", "help", "error"],
    },
    browser: browserObservation,
    historical: {
      m10aT05ArtifactSha256: historicalT05.artifactSha256,
      m10aT05CatalogSha256: historicalT05.catalogSha256,
    },
    claims: {
      boundedFormCapabilities: true,
      controlledEventPayloadsOnly: true,
      nativeLabelHelpErrorComposition: true,
      styleProjectionRetainsSemantics: true,
      keyboardFocusValidated: true,
      buttonDisabledLoadingRetained: true,
      malformedFormPayloadRejected: true,
      sameStaticAdaptersInCanvasAndHost: true,
      historicalArtifactsRewritten: false,
      runtimeCoreChanged: false,
    },
    tests: {
      rootTestNames: M10A_T06_ROOT_TEST_NAMES,
      packageCommand: "pnpm --filter @desen/starter-catalog-web test",
      browserCommand:
        M10A_T06_BROWSER_COMMAND.command + " " + M10A_T06_BROWSER_COMMAND.args.join(" "),
      browserExecutedByVerifier: true,
    },
    nonClaims: [
      "T06 does not add normal-App design editing, draft-library persistence, Publisher authority, or Runtime activation.",
      "T06 does not add arbitrary CSS selectors, executable markup, private DOM access, or remote media URLs.",
      "T06 does not create business actions or application state beyond bounded controlled form event payloads.",
      "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
}

/** Builds deterministic M10A-T06 evidence from one exact passing browser observation. */
export async function buildM10AT06Evidence(rawOptions) {
  const options = captureOptions(
    rawOptions,
    ["browserObservation", "workspaceRoot"],
    "M10A-T06 evidence options",
  );
  if (options.browserObservation === undefined) {
    fail("OPTIONS_INVALID", "M10A-T06 evidence requires one browser observation.");
  }
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const browser = captureBrowserObservation(options.browserObservation);
  const [identity, historicalT05] = await Promise.all([
    buildCurrentPackageIdentity(workspaceRoot),
    verifyM10AT05Evidence(),
  ]);
  const artifact = buildArtifact(identity, browser, historicalT05);
  const artifactBytes = prettyBytes(artifact);
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    identity,
  });
}

function captureArtifactBytes(value) {
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value) || value.byteLength > ARTIFACT_LIMIT) {
    fail("OPTIONS_INVALID", "artifactBytes must be one bounded non-Proxy Buffer.");
  }
  return Buffer.from(value);
}

/** Writes one newly captured T06 proof artifact through its exact atomic destination. */
export async function writeM10AT06Evidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "browserObservation", "workspaceRoot"],
    "M10A-T06 writer options",
  );
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
      ? await executeM10AT06BrowserProof()
      : captureBrowserObservation(options.browserObservation);
  const built = await buildM10AT06Evidence({ workspaceRoot, browserObservation: browser });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic T06 evidence write failed.");
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
 * checkpointed T06 artifact without permitting a source or receipt rewrite.
 */
export async function verifyM10AT06Evidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactBytes", "browserObservation", "workspaceRoot"],
    "M10A-T06 verifier options",
  );
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  let artifactBytes;
  let checkpointHeadSha256 = "TEST_OVERRIDE";
  if (options.artifactBytes === undefined) {
    const frozen = await readCheckpointedFrozenArtifact("M10A-T06", { workspaceRoot });
    if (frozen.path !== ARTIFACT_RELATIVE_PATH) {
      fail("ARTIFACT_DRIFT", "Checkpointed T06 artifact path drifted.");
    }
    artifactBytes = Buffer.from(frozen.bytes);
    checkpointHeadSha256 = frozen.checkpointHeadSha256;
  } else {
    artifactBytes = captureArtifactBytes(options.artifactBytes);
  }
  const browser =
    options.browserObservation === undefined
      ? await executeM10AT06BrowserProof()
      : captureBrowserObservation(options.browserObservation);
  const built = await buildM10AT06Evidence({ workspaceRoot, browserObservation: browser });
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Checkpointed T06 evidence differs from current authorities.");
  }
  return deepFreeze({
    status: "PASS",
    task: "M10A-T06",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: sha256(built.identity.catalogBytes),
    packageDigest: built.identity.packageIdentity.packageDigest,
    browserTests: built.artifact.browser.tests,
    checkpointHeadSha256,
    browserExecutedByVerifier: options.browserObservation === undefined,
  });
}
