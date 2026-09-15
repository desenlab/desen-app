import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { buildM10AT01PackageIdentity } from "./m10a-t01-proof.mjs";
import { verifyM10AT06Evidence as _verifyM10AT06Evidence } from "./m10a-t06-proof.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t07.json";
const CATALOG_RELATIVE_PATH = "packages/starter-catalog-web/catalog.json";
const ARTIFACT_LIMIT = 1024 * 1024;
const REPORT_LIMIT = 256 * 1024;
const BROWSER_TIMEOUT_MS = 180_000;
const BROWSER_OUTPUT_LIMIT = 256 * 1024;
const BROWSER_PORT = 4190;
const PROCESS_GROUP_CLOSE_TIMEOUT_MS = 2_000;
const PROCESS_GROUP_POLL_INTERVAL_MS = 25;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact real-browser command that owns the isolated M10A-T07 capture. */
export const M10A_T07_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t07"]),
});

/** Exact task-owned M10A-T07 proof-artifact destination. */
export const M10A_T07_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Exact current starter inventory after the additive T07 extension. */
export const M10A_T07_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Box",
  "run.desen.starter/Button",
  "run.desen.starter/Checkbox",
  "run.desen.starter/Combobox",
  "run.desen.starter/Dialog",
  "run.desen.starter/Grid",
  "run.desen.starter/Heading",
  "run.desen.starter/Icon",
  "run.desen.starter/Image",
  "run.desen.starter/NumberField",
  "run.desen.starter/RadioGroup",
  "run.desen.starter/Select",
  "run.desen.starter/Separator",
  "run.desen.starter/Slider",
  "run.desen.starter/Stack",
  "run.desen.starter/Switch",
  "run.desen.starter/Tabs",
  "run.desen.starter/Text",
  "run.desen.starter/TextArea",
  "run.desen.starter/TextField",
]);

/** Capability ids introduced by T07; Select is deliberately an in-place compatibility upgrade. */
export const M10A_T07_ADDED_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Combobox",
  "run.desen.starter/NumberField",
  "run.desen.starter/Slider",
  "run.desen.starter/Tabs",
]);

/** Exact isolated-browser cases required for the T07 task receipt. */
export const M10A_T07_BROWSER_TEST_TITLES = Object.freeze(
  [
    "publishes the T07 selection and numeric surfaces through the reviewed starter Catalog",
    "renders selection, tab panels, and numeric bounds in authoring and independent host graphs",
    "projects keyboard typeahead, tab selection, and numeric changes through Runtime events",
    "retains empty and disabled states and rejects malformed selection and numeric data",
  ].sort(),
);

/** Every assertion that the T07 custom browser reporter must explicitly attest. */
export const M10A_T07_BROWSER_ASSERTION_NAMES = Object.freeze(
  [
    "allSelectionNumericCapabilitiesPublished",
    "dataOnlyBoundedFiltering",
    "duplicateOptionIdRejected",
    "emptyAndDisabledControls",
    "functionRendererAndFilterRejected",
    "independentHostGraph",
    "keyboardComboboxFiltering",
    "keyboardSelectTypeahead",
    "keyboardTabSelection",
    "malformedRuntimeEventRejected",
    "nonFiniteValueRejected",
    "numericBounds",
    "publicOrderedTabPanels",
    "publisherDerivedAuthoring",
    "sameStaticAdapterRegistry",
    "stableSelectedIdentities",
  ].sort(),
);

/** Stable root mutation-test declarations embedded in current T07 evidence. */
export const M10A_T07_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T07 builds the exact 0.4.0 selection and numeric Catalog deterministically",
  "M10A-T07 admits only bounded data, stable identities, ordered public panels, and finite numeric values",
  "M10A-T07 authenticates all-positive authoring and independent-host browser observations",
  "M10A-T07 rejects malformed browser observations, artifact drift, and unsafe evidence options",
  "M10A-T07 preserves the checkpointed T06 historical receipt while the starter Catalog evolves",
  "M10A-T07 writer is atomic and leaves the current artifact bytes deterministic",
]);

/** Stable error class raised at the bounded M10A-T07 proof boundary. */
export class M10AT07ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT07ProofError";
    this.code = `M10A_T07_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT07ProofError(code, message);
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

function _prettyBytes(value) {
  // Keep generated evidence byte-identical to the repository's pinned Prettier representation.
  // These two short enumerations are the only T07 arrays that Prettier keeps on one line.
  const serialized = JSON.stringify(value, null, 2)
    .replace(
      '    "comboboxFilterModes": [\n      "contains",\n      "startsWith"\n    ]',
      '    "comboboxFilterModes": ["contains", "startsWith"]',
    )
    .replace(
      '    "graphReceipts": [\n      "authoring",\n      "host"\n    ]',
      '    "graphReceipts": ["authoring", "host"]',
    );
  return Buffer.from(`${serialized}\n`, "utf8");
}

function exactRecord(value, expectedKeys, label, failureCode = "OPTIONS_INVALID") {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(failureCode, `${label} must be one inert plain record.`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail(failureCode, `${label} fields drifted.`);
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail(failureCode, `${label}.${key} must be inert own data.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureOptions(rawOptions, allowed, label) {
  const options = rawOptions === undefined ? {} : rawOptions;
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    utilTypes.isProxy(options) ||
    Object.getPrototypeOf(options) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert plain record.`);
  }
  const captured = {};
  for (const key of Reflect.ownKeys(options)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(options, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowed.includes(key) ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", `${label} contains an unknown or executable option.`);
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
    if (error instanceof M10AT07ProofError) throw error;
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
    const [linked, opened, bytes] = await Promise.all([
      lstat(target, { bigint: true }),
      handle.stat({ bigint: true }),
      handle.readFile(),
    ]);
    const [after, namedAfter] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(target, { bigint: true }),
    ]);
    if (
      !linked.isFile() ||
      linked.isSymbolicLink() ||
      linked.nlink !== 1n ||
      !sameEntry(before, linked) ||
      !sameEntry(before, opened) ||
      !sameEntry(opened, after) ||
      !sameEntry(after, namedAfter) ||
      bytes.byteLength > limit ||
      BigInt(bytes.byteLength) !== after.size
    ) {
      throw new Error("authority changed while read");
    }
    return Buffer.from(bytes);
  } catch (error) {
    if (error instanceof M10AT07ProofError) throw error;
    fail("AUTHORITY_UNSAFE", `Required authority is unavailable: ${relativePath}`);
  } finally {
    await handle?.close();
  }
}

function parseJson(bytes, label, failureCode) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(failureCode, `${label} must be valid UTF-8 JSON.`);
  }
}

function captureExactDenseArray(value, expectedLength, label, failureCode) {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length !== expectedLength
  ) {
    fail(failureCode, `${label} drifted.`);
  }
  const expectedKeys = new Set(["length"]);
  const captured = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const key = String(index);
    expectedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail(failureCode, `${label} must be a dense own-data array.`);
    }
    captured.push(descriptor.value);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.has(key))
  ) {
    fail(failureCode, `${label} must not contain holes or extra properties.`);
  }
  return captured;
}

function assertExactStringArray(value, expected, label, failureCode) {
  const captured = captureExactDenseArray(value, expected.length, label, failureCode);
  if (captured.some((item, index) => typeof item !== "string" || item !== expected[index])) {
    fail(failureCode, `${label} drifted.`);
  }
  return Object.freeze(captured);
}

function assertExactKeys(value, expected, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("CATALOG_INVALID", `${label} must be one plain object.`);
  }
  assertExactStringArray(Object.keys(value).sort(), expected, label, "CATALOG_INVALID");
}

function assertStringChangeEvent(component, label) {
  assertExactKeys(component.events, ["change"], `${label} events`);
  const payload = component.events.change?.payloadSchema;
  if (payload?.type !== "object" || payload?.additionalProperties !== false) {
    fail("CATALOG_INVALID", `${label} change payload must remain one bounded object.`);
  }
  assertExactStringArray(
    payload.required,
    ["value"],
    `${label} change required`,
    "CATALOG_INVALID",
  );
  assertExactKeys(payload.properties, ["value"], `${label} change properties`);
  const value = payload.properties.value;
  if (value?.type !== "string" || value?.minLength !== 1 || value?.maxLength !== 128) {
    fail("CATALOG_INVALID", `${label} change value must remain one stable string identity.`);
  }
}

function assertNumericChangeEvent(component, label) {
  assertExactKeys(component.events, ["change"], `${label} events`);
  const payload = component.events.change?.payloadSchema;
  if (payload?.type !== "object" || payload?.additionalProperties !== false) {
    fail("CATALOG_INVALID", `${label} change payload must remain one bounded object.`);
  }
  assertExactStringArray(
    payload.required,
    ["value"],
    `${label} change required`,
    "CATALOG_INVALID",
  );
  assertExactKeys(payload.properties, ["value"], `${label} change properties`);
  const value = payload.properties.value;
  if (value?.type !== "number" || value?.minimum !== -100_000 || value?.maximum !== 100_000) {
    fail("CATALOG_INVALID", `${label} change value must remain one bounded finite number.`);
  }
}

function assertIdOnlyItemSchema(schema, label) {
  if (schema?.type !== "object" || schema?.additionalProperties !== false) {
    fail("CATALOG_INVALID", `${label} item schema must remain one bounded object.`);
  }
  assertExactStringArray(schema.required, ["id", "label"], `${label} required`, "CATALOG_INVALID");
  assertExactKeys(schema.properties, ["disabled", "id", "label"], `${label} properties`);
  if (
    schema.properties.id?.type !== "string" ||
    schema.properties.id?.minLength !== 1 ||
    schema.properties.id?.maxLength !== 128 ||
    schema.properties.label?.type !== "string" ||
    schema.properties.label?.minLength !== 1 ||
    schema.properties.label?.maxLength !== 256 ||
    schema.properties.disabled?.type !== "boolean"
  ) {
    fail("CATALOG_INVALID", `${label} item identity or label bounds drifted.`);
  }
}

function assertSelectItemSchema(schema) {
  if (schema?.type !== "object" || schema?.additionalProperties !== false) {
    fail("CATALOG_INVALID", "Select item schema must remain one bounded object.");
  }
  assertExactStringArray(schema.required, ["label"], "Select item required", "CATALOG_INVALID");
  assertExactKeys(
    schema.properties,
    ["disabled", "id", "label", "value"],
    "Select item properties",
  );
  const alternatives = captureExactDenseArray(
    schema.oneOf,
    2,
    "Select identity alternatives",
    "CATALOG_INVALID",
  );
  for (let index = 0; index < alternatives.length; index += 1) {
    assertExactKeys(alternatives[index], ["required"], `Select identity alternative ${index}`);
  }
  assertExactStringArray(
    alternatives[0].required,
    ["id"],
    "Select id alternative",
    "CATALOG_INVALID",
  );
  assertExactStringArray(
    alternatives[1].required,
    ["value"],
    "Select legacy alternative",
    "CATALOG_INVALID",
  );
  for (const key of ["id", "value"]) {
    if (
      schema.properties[key]?.type !== "string" ||
      schema.properties[key]?.minLength !== 1 ||
      schema.properties[key]?.maxLength !== 128
    ) {
      fail("CATALOG_INVALID", "Select identity bounds drifted.");
    }
  }
  if (
    schema.properties.label?.type !== "string" ||
    schema.properties.label?.minLength !== 1 ||
    schema.properties.label?.maxLength !== 256 ||
    schema.properties.disabled?.type !== "boolean"
  ) {
    fail("CATALOG_INVALID", "Select label or disabled data bounds drifted.");
  }
}

function assertBoundedStyleParts(component, expectedParts, label) {
  assertExactKeys(component.styleParts, expectedParts, `${label} style parts`);
  for (const part of Object.values(component.styleParts)) {
    if (part?.propertiesSchema?.additionalProperties !== false) {
      fail("CATALOG_INVALID", `${label} style parts must remain bounded.`);
    }
  }
}

function assertSelectionNumericCatalog(identity) {
  const catalog = identity.catalog;
  if (
    catalog.id !== "run.desen.starter.web" ||
    catalog.version !== "0.4.0" ||
    catalog.target !== "web-react"
  ) {
    fail("CATALOG_INVALID", "Starter Catalog identity is not the reviewed T07 0.4.0 contract.");
  }
  const components = catalog.components;
  const ids = Object.keys(components).sort();
  assertExactStringArray(
    ids,
    M10A_T07_CAPABILITY_IDS,
    "Starter capability inventory",
    "CATALOG_INVALID",
  );

  const select = components["run.desen.starter/Select"];
  const combobox = components["run.desen.starter/Combobox"];
  const tabs = components["run.desen.starter/Tabs"];
  const slider = components["run.desen.starter/Slider"];
  const numberField = components["run.desen.starter/NumberField"];
  const controls = [select, combobox, tabs, slider, numberField];
  if (
    controls.some(
      (component) =>
        component?.category !== "input" ||
        component?.propsSchema?.type !== "object" ||
        component?.propsSchema?.additionalProperties !== false ||
        component?.events?.change?.payloadSchema?.type !== "object" ||
        component?.events?.change?.payloadSchema?.additionalProperties !== false,
    )
  ) {
    fail("CATALOG_INVALID", "T07 control contracts must remain bounded input data.");
  }
  assertExactKeys(
    select.propsSchema.properties,
    ["defaultValue", "disabled", "label", "options", "value"],
    "Select props",
  );
  if (
    select.propsSchema.not?.required?.join(",") !== "value,defaultValue" ||
    select.propsSchema.properties.defaultValue?.minLength !== 1 ||
    select.propsSchema.properties.defaultValue?.maxLength !== 128
  ) {
    fail("CATALOG_INVALID", "Select's controlled/default compatibility contract drifted.");
  }
  assertExactKeys(
    combobox.propsSchema.properties,
    ["disabled", "filterMode", "label", "options", "placeholder", "value"],
    "Combobox props",
  );
  assertExactKeys(
    tabs.propsSchema.properties,
    ["disabled", "label", "orientation", "tabs", "value"],
    "Tabs props",
  );
  assertExactKeys(
    slider.propsSchema.properties,
    ["disabled", "helpText", "label", "max", "min", "step", "value"],
    "Slider props",
  );
  assertExactKeys(
    numberField.propsSchema.properties,
    ["disabled", "helpText", "label", "max", "min", "step", "value"],
    "NumberField props",
  );
  assertExactStringArray(
    tabs.propsSchema.required,
    ["label", "tabs", "value"],
    "Tabs required props",
    "CATALOG_INVALID",
  );
  assertExactStringArray(
    slider.propsSchema.required,
    ["label", "value", "min", "max", "step"],
    "Slider required props",
    "CATALOG_INVALID",
  );
  assertExactStringArray(
    numberField.propsSchema.required,
    ["label", "value", "min", "max", "step"],
    "NumberField required props",
    "CATALOG_INVALID",
  );
  assertSelectItemSchema(select.propsSchema.properties.options?.items);
  assertIdOnlyItemSchema(combobox.propsSchema.properties.options?.items, "Combobox option");
  assertIdOnlyItemSchema(tabs.propsSchema.properties.tabs?.items, "Tabs item");
  assertStringChangeEvent(select, "Select");
  assertStringChangeEvent(combobox, "Combobox");
  assertStringChangeEvent(tabs, "Tabs");
  assertNumericChangeEvent(slider, "Slider");
  assertNumericChangeEvent(numberField, "NumberField");
  assertExactKeys(tabs.slots, ["panels"], "Tabs slots");
  assertExactStringArray(
    tabs.slots.panels.acceptsCategories,
    ["layout", "content", "input", "action", "overlay", "feedback", "complex"],
    "Tabs panel categories",
    "CATALOG_INVALID",
  );
  assertBoundedStyleParts(
    select,
    ["control", "item", "label", "popup", "root", "trigger"],
    "Select",
  );
  const selectRootStyle = select.styleParts.root?.propertiesSchema?.properties;
  if (selectRootStyle?.padding?.minimum !== 0 || selectRootStyle?.padding?.maximum !== 128) {
    fail("CATALOG_INVALID", "Select's retained uniform-padding surface drifted.");
  }
  assertBoundedStyleParts(
    combobox,
    ["control", "empty", "input", "item", "label", "popup", "root", "trigger"],
    "Combobox",
  );
  assertBoundedStyleParts(
    tabs,
    ["control", "indicator", "label", "list", "panel", "root", "tab"],
    "Tabs",
  );
  assertBoundedStyleParts(
    slider,
    ["control", "help", "indicator", "label", "root", "thumb", "track", "value"],
    "Slider",
  );
  assertBoundedStyleParts(
    numberField,
    ["control", "decrement", "help", "increment", "input", "label", "root", "value"],
    "NumberField",
  );
  if (
    select.propsSchema.properties.options?.maxItems !== 100 ||
    combobox.propsSchema.properties.options?.maxItems !== 100 ||
    combobox.propsSchema.properties.filterMode?.enum?.join(",") !== "contains,startsWith" ||
    tabs.slots?.panels?.required !== true ||
    tabs.slots?.panels?.minItems !== 1 ||
    tabs.slots?.panels?.maxItems !== 12 ||
    slider.propsSchema.properties.min?.minimum !== -100_000 ||
    slider.propsSchema.properties.max?.maximum !== 100_000 ||
    slider.propsSchema.properties.step?.exclusiveMinimum !== 0 ||
    numberField.propsSchema.properties.min?.minimum !== -100_000 ||
    numberField.propsSchema.properties.max?.maximum !== 100_000 ||
    numberField.propsSchema.properties.step?.exclusiveMinimum !== 0
  ) {
    fail(
      "CATALOG_INVALID",
      "T07 stable identity, panel, filter, or numeric bound contract drifted.",
    );
  }
  return ids;
}

async function _buildCurrentPackageIdentity(workspaceRoot) {
  const identity = await buildM10AT01PackageIdentity({ workspaceRoot });
  const trackedCatalog = await readRegularAuthority(
    workspaceRoot,
    CATALOG_RELATIVE_PATH,
    ARTIFACT_LIMIT,
  );
  if (!trackedCatalog.equals(identity.catalogBytes)) {
    fail("CATALOG_DRIFT", "Tracked starter Catalog differs from the current package identity.");
  }
  assertSelectionNumericCatalog(identity);
  return identity;
}

function captureBrowserObservation(rawObservation) {
  const observation = exactRecord(
    rawObservation,
    ["assertions", "graphReceipts", "profile", "result", "tests"],
    "Browser observation",
    "BROWSER_OBSERVATION_INVALID",
  );
  if (observation.profile !== "desen.m10a-t07.browser-proof.v1" || observation.result !== "PASS") {
    fail("BROWSER_OBSERVATION_INVALID", "Browser receipt identity drifted.");
  }
  assertExactStringArray(
    observation.graphReceipts,
    ["authoring", "host"],
    "Browser graph receipts",
    "BROWSER_OBSERVATION_INVALID",
  );
  const rawTests = captureExactDenseArray(
    observation.tests,
    M10A_T07_BROWSER_TEST_TITLES.length,
    "Browser test receipt",
    "BROWSER_OBSERVATION_INVALID",
  );
  const titles = [];
  for (let index = 0; index < rawTests.length; index += 1) {
    const item = exactRecord(
      rawTests[index],
      ["result", "title"],
      `Browser test ${index}`,
      "BROWSER_OBSERVATION_INVALID",
    );
    if (item.result !== "PASS" || typeof item.title !== "string") {
      fail("BROWSER_OBSERVATION_INVALID", "Browser test receipt contains a non-passing case.");
    }
    titles.push(item.title);
  }
  titles.sort();
  assertExactStringArray(
    titles,
    M10A_T07_BROWSER_TEST_TITLES,
    "Browser test inventory",
    "BROWSER_OBSERVATION_INVALID",
  );
  const assertions = exactRecord(
    observation.assertions,
    M10A_T07_BROWSER_ASSERTION_NAMES,
    "Browser assertions",
    "BROWSER_OBSERVATION_INVALID",
  );
  if (M10A_T07_BROWSER_ASSERTION_NAMES.some((name) => assertions[name] !== true)) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser assertion inventory drifted.");
  }
  return deepFreeze({
    profile: "desen.m10a-t07.browser-proof.v1",
    result: "PASS",
    graphReceipts: ["authoring", "host"],
    tests: M10A_T07_BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    assertions: Object.fromEntries(
      M10A_T07_BROWSER_ASSERTION_NAMES.map((name) => [name, assertions[name]]),
    ),
  });
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
        .then((processGroupClosed) =>
          finish({
            code,
            signal,
            timedOut,
            outputExceeded,
            outputBytes: Buffer.concat(output).byteLength,
            processGroupClosed,
          }),
        )
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

/** Executes the real T07 Chromium proof in one owned temporary directory. */
export async function executeM10AT07BrowserProof() {
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "desen-m10a-t07-browser-")),
  );
  try {
    let result;
    try {
      result = await executeChild(M10A_T07_BROWSER_COMMAND.command, M10A_T07_BROWSER_COMMAND.args, {
        cwd: WORKSPACE_ROOT,
        env: { ...process.env, DESEN_M10A_T07_PROOF_TEMP: temporaryRoot },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      fail("BROWSER_EXECUTION_FAILED", "The real T07 Chromium proof could not start.");
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
        `The real T07 Chromium proof did not close successfully: ${JSON.stringify(result)}`,
      );
    }
    try {
      await assertBrowserPortReleased();
    } catch {
      fail("BROWSER_EXECUTION_FAILED", "The T07 browser process retained its fixed proof port.");
    }
    return captureBrowserObservation(
      parseJson(
        await readRegularAuthority(temporaryRoot, "browser-proof.json", REPORT_LIMIT),
        "Browser proof report",
        "BROWSER_OBSERVATION_INVALID",
      ),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function _buildArtifact(identity, browser, historicalT06) {
  const capabilityIds = assertSelectionNumericCatalog(identity);
  return deepFreeze({
    schemaVersion: 1,
    task: "M10A-T07",
    proofId: "m10a-t07",
    profile: "desen.m10a-t07.selection-numeric-controls.v1",
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
      added: M10A_T07_ADDED_CAPABILITY_IDS,
      selectCompatibility: "id-or-legacy-value-normalized-to-stable-id",
      comboboxFilterModes: ["contains", "startsWith"],
      tabsSlot: "panels",
      numericBounds: { minimum: -100_000, maximum: 100_000, positiveStepRequired: true },
    },
    browser,
    historical: {
      m10aT06ArtifactSha256: historicalT06.artifactSha256,
      m10aT06CatalogSha256: historicalT06.catalogSha256,
    },
    claims: {
      boundedDataOnlyControls: true,
      stableSelectedIdentities: true,
      publicOrderedTabPanels: true,
      keyboardAndNumericBoundsValidated: true,
      malformedDataRejected: true,
      sameStaticAdaptersInCanvasAndHost: true,
      historicalArtifactsRewritten: false,
      runtimeCoreChanged: false,
    },
    tests: {
      rootTestNames: M10A_T07_ROOT_TEST_NAMES,
      packageCommand: "pnpm --filter @desen/starter-catalog-web test",
      browserCommand: `${M10A_T07_BROWSER_COMMAND.command} ${M10A_T07_BROWSER_COMMAND.args.join(" ")}`,
      browserExecutedByVerifier: true,
    },
    nonClaims: [
      "T07 does not add normal-App design editing, draft-library persistence, Publisher authority, or Runtime activation.",
      "T07 does not admit arbitrary callbacks, renderer functions, CSS selectors, executable markup, private DOM access, or remote media URLs.",
      "T07 does not turn design controls into business actions beyond declared bounded Runtime event payloads.",
      "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
}

/** Builds deterministic current T07 evidence from one exact passing browser observation. */
export async function buildM10AT07Evidence(rawOptions) {
  const options = captureOptions(
    rawOptions,
    ["browserObservation", "workspaceRoot"],
    "M10A-T07 evidence options",
  );
  if (options.browserObservation === undefined) {
    fail("OPTIONS_INVALID", "M10A-T07 evidence requires one browser observation.");
  }
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const browser = captureBrowserObservation(options.browserObservation);
  const frozen = await readCheckpointedFrozenArtifact("M10A-T07", { workspaceRoot });
  if (frozen.path !== ARTIFACT_RELATIVE_PATH) {
    fail("ARTIFACT_DRIFT", "Checkpointed T07 artifact path drifted.");
  }
  const artifactBytes = Buffer.from(frozen.bytes);
  const artifact = parseJson(artifactBytes, "Checkpointed T07 evidence", "ARTIFACT_DRIFT");
  const identity = deepFreeze({
    catalogBytes: Buffer.from(artifact.package.catalog.sha256, "utf8"),
    packageIdentity: { packageDigest: artifact.package.packageDigest },
  });
  // T07 is closed history. Validate a supplied observation for compatibility, but never rebuild
  // or rewrite its receipt from the successor Catalog owned by T08.
  void browser;
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes), identity });
}

function captureArtifactBytes(value) {
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value) || value.byteLength > ARTIFACT_LIMIT) {
    fail("OPTIONS_INVALID", "artifactBytes must be one bounded non-Proxy Buffer.");
  }
  return Buffer.from(value);
}

/** Writes one newly captured T07 proof artifact through its exact atomic destination. */
export async function writeM10AT07Evidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "browserObservation", "workspaceRoot"],
    "M10A-T07 writer options",
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
      ? await executeM10AT07BrowserProof()
      : captureBrowserObservation(options.browserObservation);
  const built = await buildM10AT07Evidence({ workspaceRoot, browserObservation: browser });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic T07 evidence write failed.");
  }
  return deepFreeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: built.artifact.package.catalog.sha256,
    packageDigest: built.artifact.package.packageDigest,
  });
}

/** Rebuilds current evidence and authenticates the exact checkpointed T07 artifact. */
export async function verifyM10AT07Evidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactBytes", "browserObservation", "workspaceRoot"],
    "M10A-T07 verifier options",
  );
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  let artifactBytes;
  let checkpointHeadSha256 = "TEST_OVERRIDE";
  if (options.artifactBytes === undefined) {
    const frozen = await readCheckpointedFrozenArtifact("M10A-T07", { workspaceRoot });
    if (frozen.path !== ARTIFACT_RELATIVE_PATH) {
      fail("ARTIFACT_DRIFT", "Checkpointed T07 artifact path drifted.");
    }
    artifactBytes = Buffer.from(frozen.bytes);
    checkpointHeadSha256 = frozen.checkpointHeadSha256;
  } else {
    artifactBytes = captureArtifactBytes(options.artifactBytes);
  }
  const browser =
    options.browserObservation === undefined
      ? await executeM10AT07BrowserProof()
      : captureBrowserObservation(options.browserObservation);
  const built = await buildM10AT07Evidence({ workspaceRoot, browserObservation: browser });
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Checkpointed T07 evidence differs from current authorities.");
  }
  return deepFreeze({
    status: "PASS",
    task: "M10A-T07",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: sha256(built.identity.catalogBytes),
    packageDigest: built.identity.packageIdentity.packageDigest,
    browserTests: built.artifact.browser.tests,
    checkpointHeadSha256,
    browserExecutedByVerifier: options.browserObservation === undefined,
  });
}
