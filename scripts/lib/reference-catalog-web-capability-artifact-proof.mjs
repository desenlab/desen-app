import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  cp,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH,
  verifyReferenceCatalogWebParityEvidence,
} from "./reference-catalog-web-parity-proof.mjs";

const execFileAsync = promisify(execFile);
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const REFERENCE_PACKAGE_ROOT = path.join(WORKSPACE_ROOT, "packages/reference-catalog-web");
const REFERENCE_SOURCE_ROOT = path.join(REFERENCE_PACKAGE_ROOT, "src");
const REFERENCE_DIST_ROOT = path.join(REFERENCE_PACKAGE_ROOT, "dist");
const TSC_LINK_PATH = path.join(WORKSPACE_ROOT, "node_modules/typescript/bin/tsc");

/** Absolute path to the deterministic M03-T10 proof artifact. */
export const DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-catalog-web-capability-artifact.json",
);

/** Absolute path to the published Catalog generated and verified by the M03-T10 proof. */
export const DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH = path.join(
  REFERENCE_PACKAGE_ROOT,
  "catalog.json",
);

const DEFAULT_PATHS = Object.freeze({
  sourceDirectory: REFERENCE_SOURCE_ROOT,
  distDirectory: REFERENCE_DIST_ROOT,
  packageManifestPath: path.join(REFERENCE_PACKAGE_ROOT, "package.json"),
  packageTsconfigPath: path.join(REFERENCE_PACKAGE_ROOT, "tsconfig.json"),
  packageBuildTsconfigPath: path.join(REFERENCE_PACKAGE_ROOT, "tsconfig.build.json"),
  rootPackagePath: path.join(WORKSPACE_ROOT, "package.json"),
  rootTsconfigBasePath: path.join(WORKSPACE_ROOT, "tsconfig.base.json"),
  rootTsconfigBrowserPath: path.join(WORKSPACE_ROOT, "tsconfig.browser.json"),
  rootTsconfigReactWebPath: path.join(WORKSPACE_ROOT, "tsconfig.react-web.json"),
  componentApiPath: path.join(REFERENCE_DIST_ROOT, "components/index.js"),
  operationsApiPath: path.join(REFERENCE_DIST_ROOT, "operations/index.js"),
  profileApiPath: path.join(REFERENCE_DIST_ROOT, "index.js"),
  catalogSdkApiPath: path.join(WORKSPACE_ROOT, "packages/catalog-sdk/dist/index.js"),
  protocolApiPath: path.join(WORKSPACE_ROOT, "packages/protocol/dist/index.js"),
  validatorApiPath: path.join(WORKSPACE_ROOT, "packages/validator/dist/index.js"),
  prerequisiteArtifactPath: DEFAULT_REFERENCE_CATALOG_WEB_PARITY_ARTIFACT_PATH,
});

const BUILD_OPTION_NAMES = Object.freeze([
  "catalogApi",
  "componentApi",
  "operationsApi",
  "profileApi",
  "protocolApi",
  "validatorApi",
  ...Object.keys(DEFAULT_PATHS),
  "verifyPrerequisite",
]);

const CATALOG_ID = "run.desen.reference.sign-in";
const CATALOG_VERSION = "0.1.0";
const CATALOG_TARGET = "web-react";
const PROTOCOL_VERSION = "0.1.0";
const CATALOG_KIND = "desen.catalog";
const PACKAGE_DIGEST_PLACEHOLDER = `sha256:${"0".repeat(64)}`;

const COMPONENT_REGISTRATION_EXPORTS = Object.freeze([
  Object.freeze({
    id: "com.example.ui/Alert",
    exportName: "alertComponentRegistration",
  }),
  Object.freeze({
    id: "com.example.ui/Button",
    exportName: "buttonComponentRegistration",
  }),
  Object.freeze({
    id: "com.example.ui/Stack",
    exportName: "stackComponentRegistration",
  }),
  Object.freeze({
    id: "com.example.ui/Text",
    exportName: "textComponentRegistration",
  }),
  Object.freeze({
    id: "com.example.ui/TextField",
    exportName: "textFieldComponentRegistration",
  }),
]);
const OPERATION_ID = "com.example.auth/signIn";
const OPERATION_REGISTRATION_EXPORT = "signInOperationRegistration";
const ROOT_SCRIPT_NAMES = Object.freeze([
  "generate:reference-catalog-web-capability-artifact",
  "verify:reference-catalog-web-capability-artifact",
  "test:reference-catalog-web-capability-artifact",
]);
const ROOT_SCRIPT_PREFIX =
  "pnpm verify:catalog-manifest-registration && pnpm verify:reference-catalog-web-parity && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test && ";
const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  "generate:reference-catalog-web-capability-artifact": `${ROOT_SCRIPT_PREFIX}node scripts/generate-reference-catalog-web-capability-artifact-proof.mjs`,
  "verify:reference-catalog-web-capability-artifact": `${ROOT_SCRIPT_PREFIX}node scripts/verify-reference-catalog-web-capability-artifact.mjs`,
  "test:reference-catalog-web-capability-artifact": `${ROOT_SCRIPT_PREFIX}node --test tests/reference-catalog-web-capability-artifact.test.mjs`,
});
const EXPECTED_PACKAGE_EXPORTS = Object.freeze({
  ".": Object.freeze({
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  }),
  "./catalog.json": "./catalog.json",
  "./components": Object.freeze({
    types: "./dist/components/index.d.ts",
    import: "./dist/components/index.js",
  }),
  "./host-operations": Object.freeze({
    types: "./dist/host-operations/index.d.ts",
    import: "./dist/host-operations/index.js",
  }),
  "./operations": Object.freeze({
    types: "./dist/operations/index.d.ts",
    import: "./dist/operations/index.js",
  }),
  "./parity": Object.freeze({
    types: "./dist/parity/index.d.ts",
    import: "./dist/parity/index.js",
  }),
  "./tokens": Object.freeze({
    types: "./dist/tokens/index.d.ts",
    import: "./dist/tokens/index.js",
  }),
});
const TRACKED_IMPLEMENTATION_PATHS = Object.freeze([
  path.join(WORKSPACE_ROOT, "scripts/lib/atomic-proof-artifact.mjs"),
  path.join(WORKSPACE_ROOT, "scripts/lib/reference-catalog-web-capability-artifact-proof.mjs"),
  path.join(WORKSPACE_ROOT, "scripts/generate-reference-catalog-web-capability-artifact-proof.mjs"),
  path.join(WORKSPACE_ROOT, "scripts/verify-reference-catalog-web-capability-artifact.mjs"),
  path.join(WORKSPACE_ROOT, "tests/reference-catalog-web-capability-artifact.test.mjs"),
]);

/**
 * Stable failure shape for deterministic M03-T10 proof construction and verification.
 */
export class ReferenceCatalogWebCapabilityArtifactEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ReferenceCatalogWebCapabilityArtifactEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ReferenceCatalogWebCapabilityArtifactEvidenceError(code, message, details);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function deepFreezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreezeJson(nested);
  return Object.freeze(value);
}

function isPlainRecord(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeBuildOptions(options) {
  if (options === undefined) return Object.freeze({});
  if (!isPlainRecord(options)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      "Build options must be a plain own-data object.",
    );
  }
  const keys = Reflect.ownKeys(options);
  for (const key of keys) {
    if (typeof key !== "string" || !BUILD_OPTION_NAMES.includes(key)) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        "Build options contain an unknown or symbolic field.",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        "Build options must contain enumerable data properties only.",
      );
    }
  }
  for (const name of Object.keys(DEFAULT_PATHS)) {
    if (Object.hasOwn(options, name) && typeof options[name] !== "string") {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        `${name} must be an absolute path string.`,
      );
    }
    if (Object.hasOwn(options, name) && !path.isAbsolute(options[name])) {
      fail("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID", `${name} must be absolute.`);
    }
  }
  if (
    Object.hasOwn(options, "verifyPrerequisite") &&
    typeof options.verifyPrerequisite !== "boolean"
  ) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID", "verifyPrerequisite must be a boolean.");
  }
  return Object.freeze({ ...options });
}

function normalizeActionOptions(options, allowedNames) {
  if (options === undefined) return Object.freeze({});
  if (!isPlainRecord(options)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      "Action options must be a plain own-data object.",
    );
  }
  for (const key of Reflect.ownKeys(options)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(options, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowedNames.includes(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        "Action options contain an unknown, symbolic, inherited, or accessor field.",
      );
    }
  }
  for (const name of ["artifactPath", "catalogPath"]) {
    if (
      Object.hasOwn(options, name) &&
      (typeof options[name] !== "string" || !path.isAbsolute(options[name]))
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        `${name} must be an absolute path string.`,
      );
    }
  }
  for (const name of ["artifactBytes", "catalogBytes"]) {
    if (Object.hasOwn(options, name) && !utilTypes.isUint8Array(options[name])) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        `${name} must be exact Uint8Array bytes.`,
      );
    }
  }
  for (const name of ["beforeCatalogAtomicRename", "beforeArtifactAtomicRename"]) {
    if (Object.hasOwn(options, name) && typeof options[name] !== "function") {
      fail("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID", `${name} must be a function.`);
    }
  }
  return Object.freeze({ ...options });
}

function buildOverrides(options) {
  return Reflect.ownKeys(options)
    .filter((key) => typeof key === "string")
    .sort();
}

async function importFresh(modulePath) {
  return import(`${pathToFileURL(modulePath).href}?m03t10=${Date.now()}-${Math.random()}`);
}

function captureApi(api, requiredFunctions, requiredValues, label) {
  if (api === null || (typeof api !== "object" && typeof api !== "function")) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PUBLIC_API_DRIFT",
      `${label} is not a module namespace or API object.`,
    );
  }
  if (utilTypes.isProxy(api)) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_PUBLIC_API_DRIFT", `${label} must not be a Proxy.`);
  }
  const captured = Object.create(null);
  for (const name of [...requiredFunctions, ...requiredValues]) {
    const descriptor = Object.getOwnPropertyDescriptor(api, name);
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_PUBLIC_API_DRIFT",
        `${label} omits the required own data export ${name}.`,
      );
    }
    if (requiredFunctions.includes(name) && typeof descriptor.value !== "function") {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_PUBLIC_API_DRIFT",
        `${label}.${name} must be a function.`,
      );
    }
    captured[name] = descriptor.value;
  }
  return Object.freeze(captured);
}

function assertRegistration(registration, id, label) {
  if (!isPlainRecord(registration) || !Object.isFrozen(registration)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_REGISTRATION_DRIFT",
      `${label} must be an immutable inert registration record.`,
    );
  }
  const keys = Object.keys(registration);
  if (
    keys.length !== 2 ||
    keys[0] !== "id" ||
    keys[1] !== "manifest" ||
    registration.id !== id ||
    !isPlainRecord(registration.manifest) ||
    !Object.isFrozen(registration.manifest)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_REGISTRATION_DRIFT",
      `${label} does not expose the exact ${id} registration.`,
    );
  }
}

function assertCatalogIdentity(catalog, packageDigest) {
  const exact = {
    kind: CATALOG_KIND,
    desen: PROTOCOL_VERSION,
    id: CATALOG_ID,
    version: CATALOG_VERSION,
    target: CATALOG_TARGET,
    packageDigest,
  };
  for (const [key, expected] of Object.entries(exact)) {
    if (catalog?.[key] !== expected) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_CATALOG_IDENTITY_DRIFT",
        `Catalog ${key} differs from the exact M03-T10 identity.`,
        { expected, actual: catalog?.[key] },
      );
    }
  }
  const componentIds = Object.keys(catalog.components ?? {});
  const expectedComponentIds = COMPONENT_REGISTRATION_EXPORTS.map(({ id }) => id);
  if (
    componentIds.length !== expectedComponentIds.length ||
    componentIds.some((id, index) => id !== expectedComponentIds[index])
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_CATALOG_SCOPE_DRIFT",
      "The final Catalog must contain exactly the five selected component registrations.",
    );
  }
  if (
    Object.keys(catalog.behaviors ?? {}).length !== 0 ||
    Object.keys(catalog.resources ?? {}).length !== 0 ||
    Object.keys(catalog.operations ?? {}).length !== 1 ||
    !Object.hasOwn(catalog.operations, OPERATION_ID)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_CATALOG_SCOPE_DRIFT",
      "The final Catalog must contain only the selected components and signIn operation.",
    );
  }
}

function buildCatalog(catalogApi, registrations, packageDigest) {
  const catalog = catalogApi.createCatalogManifest({
    id: CATALOG_ID,
    version: CATALOG_VERSION,
    target: CATALOG_TARGET,
    packageDigest,
    components: registrations.components,
    operations: [registrations.operation],
  });
  assertCatalogIdentity(catalog, packageDigest);
  return catalog;
}

function assertValidationSuccess(result, stage) {
  if (
    !isPlainRecord(result) ||
    result.valid !== true ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length !== 0
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_VALIDATION_FAILED",
      `The exact final Catalog failed ${stage}.`,
      {
        diagnostics: Array.isArray(result?.diagnostics)
          ? result.diagnostics.map((diagnostic) => diagnostic?.code ?? "UNKNOWN")
          : [],
      },
    );
  }
}

function validateCatalog(validatorApi, catalog) {
  const stages = [
    ["structural", validatorApi.validateDesenCatalog, false],
    ["semantic", validatorApi.validateDesenCatalogSemantics, false],
    ["catalog-set", validatorApi.validateDesenCatalogSet, true],
    ["component-catalog-set", validatorApi.validateDesenComponentCatalogSet, true],
    ["interaction-catalog-set", validatorApi.validateDesenInteractionCatalogSet, true],
    ["execution-catalog-set", validatorApi.validateDesenExecutionCatalogSet, true],
  ];
  for (const [stage, validator, list] of stages) {
    assertValidationSuccess(validator(list ? [catalog] : catalog), stage);
  }
  return Object.freeze(stages.map(([stage]) => stage));
}

async function assertRegularFile(filePath, label) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_UNSAFE_PATH", `${label} is missing or inaccessible.`, {
      path: filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!entry.isFile()) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_UNSAFE_PATH", `${label} must resolve to a regular file.`, {
      path: filePath,
    });
  }
}

async function readSafeInventory(rootDirectory, pathPrefix = "dist") {
  const rootEntry = await lstat(rootDirectory);
  if (!rootEntry.isDirectory()) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_UNSAFE_PATH",
      "Distribution inventory root must be a real directory.",
      { path: rootDirectory },
    );
  }
  const files = [];
  async function visit(directory, segments) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      const relativeSegments = [...segments, entry.name];
      if (entry.isSymbolicLink()) {
        fail(
          "REFERENCE_CAPABILITY_ARTIFACT_UNSAFE_PATH",
          "Distribution and source trees must not contain symbolic links.",
          { path: entryPath },
        );
      }
      if (entry.isDirectory()) {
        await visit(entryPath, relativeSegments);
        continue;
      }
      if (!entry.isFile()) {
        fail(
          "REFERENCE_CAPABILITY_ARTIFACT_UNSAFE_PATH",
          "Distribution and source trees may contain regular files only.",
          { path: entryPath },
        );
      }
      const relativePath = relativeSegments.join("/");
      const bytes = await readFile(entryPath);
      files.push(
        Object.freeze({
          path: `${pathPrefix}/${relativePath}`,
          relativePath,
          bytes,
          byteLength: bytes.length,
          sha256: sha256(bytes),
        }),
      );
    }
  }
  await visit(rootDirectory, []);
  if (files.length === 0) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_EMPTY_INVENTORY",
      "The final capability artifact cannot have an empty distribution inventory.",
    );
  }
  return Object.freeze(files);
}

function assertInventoriesEqual(left, right, label) {
  if (left.length !== right.length) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_BUILD_DRIFT", `${label} has a different file count.`, {
      left: left.length,
      right: right.length,
    });
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftEntry = left[index];
    const rightEntry = right[index];
    if (
      leftEntry.path !== rightEntry.path ||
      leftEntry.byteLength !== rightEntry.byteLength ||
      !byteEqual(leftEntry.bytes, rightEntry.bytes)
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_BUILD_DRIFT",
        `${label} differs at inventory index ${String(index)}.`,
        {
          leftPath: leftEntry.path,
          rightPath: rightEntry.path,
          leftSha256: leftEntry.sha256,
          rightSha256: rightEntry.sha256,
        },
      );
    }
  }
}

function inventoryAggregateDigest(inventory) {
  const hash = createHash("sha256");
  for (const entry of inventory) {
    const pathBytes = Buffer.from(entry.path, "ascii");
    const frame = Buffer.alloc(8);
    frame.writeUInt32BE(pathBytes.length, 0);
    frame.writeUInt32BE(entry.bytes.length, 4);
    hash.update(frame);
    hash.update(pathBytes);
    hash.update(entry.bytes);
  }
  return `sha256:${hash.digest("hex")}`;
}

function verifySourceMaps(inventory) {
  const byPath = new Map(inventory.map((entry) => [entry.path, entry]));
  let sourceMaps = 0;
  let declarationMaps = 0;
  for (const entry of inventory) {
    if (entry.path.endsWith(".js") || entry.path.endsWith(".d.ts")) {
      const mapPath = `${entry.path}.map`;
      if (!byPath.has(mapPath)) {
        fail(
          "REFERENCE_CAPABILITY_ARTIFACT_SOURCE_MAP_DRIFT",
          "Every emitted JavaScript and declaration file must retain its source map.",
          { path: entry.path },
        );
      }
      continue;
    }
    if (!entry.path.endsWith(".js.map") && !entry.path.endsWith(".d.ts.map")) {
      // Future regular output kinds still belong to the exhaustive digest inventory.
      continue;
    }
    const outputPath = entry.path.slice(0, -4);
    if (!byPath.has(outputPath)) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_SOURCE_MAP_DRIFT",
        "A source map has no emitted output.",
        { path: entry.path },
      );
    }
    let sourceMap;
    try {
      sourceMap = JSON.parse(entry.bytes.toString("utf8"));
    } catch {
      fail("REFERENCE_CAPABILITY_ARTIFACT_SOURCE_MAP_DRIFT", "An emitted source map is not JSON.", {
        path: entry.path,
      });
    }
    if (
      sourceMap.version !== 3 ||
      sourceMap.file !== path.posix.basename(outputPath) ||
      !Array.isArray(sourceMap.sources) ||
      sourceMap.sources.length === 0
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_SOURCE_MAP_DRIFT",
        "An emitted source map does not identify its output and original sources exactly.",
        { path: entry.path },
      );
    }
    sourceMaps += 1;
    if (entry.path.endsWith(".d.ts.map")) declarationMaps += 1;
  }
  return Object.freeze({ sourceMaps, declarationMaps });
}

async function copyRegularFile(sourcePath, destinationPath) {
  await assertRegularFile(sourcePath, "Mini-workspace input");
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

async function copyPackageDependency(sourcePackageRoot, destinationPackageRoot) {
  await mkdir(destinationPackageRoot, { recursive: true });
  await copyRegularFile(
    path.join(sourcePackageRoot, "package.json"),
    path.join(destinationPackageRoot, "package.json"),
  );
  const sourceDist = path.join(sourcePackageRoot, "dist");
  await readSafeInventory(sourceDist, "dependency-dist");
  await cp(sourceDist, path.join(destinationPackageRoot, "dist"), {
    recursive: true,
    dereference: true,
    errorOnExist: true,
  });
}

async function prepareMiniWorkspace(rootDirectory, paths) {
  const miniPackageRoot = path.join(rootDirectory, "packages/reference-catalog-web");
  await mkdir(miniPackageRoot, { recursive: true });
  await cp(paths.sourceDirectory, path.join(miniPackageRoot, "src"), {
    recursive: true,
    dereference: false,
    errorOnExist: true,
  });
  await Promise.all([
    copyRegularFile(paths.rootTsconfigBasePath, path.join(rootDirectory, "tsconfig.base.json")),
    copyRegularFile(
      paths.rootTsconfigBrowserPath,
      path.join(rootDirectory, "tsconfig.browser.json"),
    ),
    copyRegularFile(
      paths.rootTsconfigReactWebPath,
      path.join(rootDirectory, "tsconfig.react-web.json"),
    ),
    copyRegularFile(paths.packageManifestPath, path.join(miniPackageRoot, "package.json")),
    copyRegularFile(paths.packageTsconfigPath, path.join(miniPackageRoot, "tsconfig.json")),
    copyRegularFile(
      paths.packageBuildTsconfigPath,
      path.join(miniPackageRoot, "tsconfig.build.json"),
    ),
  ]);

  const miniNodeModules = path.join(miniPackageRoot, "node_modules");
  const catalogSdkRoot = path.join(WORKSPACE_ROOT, "packages/catalog-sdk");
  const protocolRoot = path.join(WORKSPACE_ROOT, "packages/protocol");
  await Promise.all([
    copyPackageDependency(catalogSdkRoot, path.join(miniNodeModules, "@desen/catalog-sdk")),
    copyPackageDependency(protocolRoot, path.join(miniNodeModules, "@desen/protocol")),
  ]);

  const reactRoot = await realpath(path.join(REFERENCE_PACKAGE_ROOT, "node_modules/react"));
  const reactTypesRoot = await realpath(
    path.join(REFERENCE_PACKAGE_ROOT, "node_modules/@types/react"),
  );
  const cssTypeRoot = await realpath(path.resolve(reactTypesRoot, "../..", "csstype"));
  await Promise.all([
    readSafeInventory(reactRoot, "react"),
    readSafeInventory(reactTypesRoot, "react-types"),
    readSafeInventory(cssTypeRoot, "csstype"),
  ]);
  await Promise.all([
    cp(reactRoot, path.join(miniNodeModules, "react"), {
      recursive: true,
      dereference: true,
      errorOnExist: true,
    }),
    cp(reactTypesRoot, path.join(miniNodeModules, "@types/react"), {
      recursive: true,
      dereference: true,
      errorOnExist: true,
    }),
    cp(cssTypeRoot, path.join(miniNodeModules, "csstype"), {
      recursive: true,
      dereference: true,
      errorOnExist: true,
    }),
  ]);
  return miniPackageRoot;
}

async function createCompilerInputSnapshot(paths, tscPath) {
  const snapshotOwner = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t10-snapshot-"));
  const snapshotRoot = path.join(snapshotOwner, "workspace");
  try {
    await prepareMiniWorkspace(snapshotRoot, paths);
    const typescriptPackageRoot = path.dirname(path.dirname(tscPath));
    await readSafeInventory(typescriptPackageRoot, "typescript");
    await mkdir(path.join(snapshotRoot, "toolchain"), { recursive: true });
    await cp(typescriptPackageRoot, path.join(snapshotRoot, "toolchain/typescript"), {
      recursive: true,
      dereference: true,
      errorOnExist: true,
    });
    await readSafeInventory(snapshotRoot, "snapshot");
    return Object.freeze({ snapshotOwner, snapshotRoot });
  } catch (error) {
    await rm(snapshotOwner, { recursive: true, force: true });
    throw error;
  }
}

async function buildIsolatedInventory(label, snapshotRoot) {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), `desen-m03-t10-${label}-`));
  try {
    const isolatedRoot = path.join(rootDirectory, "workspace");
    await cp(snapshotRoot, isolatedRoot, {
      recursive: true,
      dereference: false,
      errorOnExist: true,
    });
    const miniPackageRoot = path.join(isolatedRoot, "packages/reference-catalog-web");
    const isolatedTscPath = path.join(isolatedRoot, "toolchain/typescript/bin/tsc");
    try {
      await execFileAsync(
        process.execPath,
        [isolatedTscPath, "-p", "tsconfig.build.json", "--pretty", "false"],
        {
          cwd: miniPackageRoot,
          env: {
            ...process.env,
            LC_ALL: "C",
            SOURCE_DATE_EPOCH: "0",
            TZ: "UTC",
          },
          maxBuffer: 8 * 1024 * 1024,
          timeout: 120_000,
        },
      );
    } catch (error) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_ISOLATED_BUILD_FAILED",
        `Isolated TypeScript build ${label} failed.`,
        {
          stdout: String(error?.stdout ?? "").slice(-4_000),
          stderr: String(error?.stderr ?? "").slice(-4_000),
        },
      );
    }
    return await readSafeInventory(path.join(miniPackageRoot, "dist"));
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
}

function artifactInputs(inventory) {
  return inventory.map((entry) =>
    Object.freeze({ path: entry.path, bytes: new Uint8Array(entry.bytes) }),
  );
}

/**
 * Proves that the final digest cannot recursively occur inside the bytes it fingerprints.
 */
export function verifyReferenceCatalogWebSelfReferenceExclusion(inventory, packageDigest) {
  if (
    !Array.isArray(inventory) ||
    utilTypes.isProxy(inventory) ||
    typeof packageDigest !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(packageDigest)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_SELF_REFERENCE_INPUT_INVALID",
      "Self-reference inspection requires an inventory and exact SHA-256 digest.",
    );
  }
  const digestBytes = Buffer.from(packageDigest, "ascii");
  for (const entry of inventory) {
    if (
      !isPlainRecord(entry) ||
      typeof entry.path !== "string" ||
      !utilTypes.isUint8Array(entry.bytes)
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_SELF_REFERENCE_INPUT_INVALID",
        "Self-reference inventory entries require path and exact bytes.",
      );
    }
    if (Buffer.from(entry.bytes).indexOf(digestBytes) !== -1) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_SELF_REFERENCE_DETECTED",
        "The final package digest occurs inside a fingerprinted dist artifact.",
        { path: entry.path },
      );
    }
  }
  return Object.freeze({
    packageDigestBytesAbsent: true,
    exactTupleBytesAbsent: true,
    reason: "the exact tuple necessarily contains the absent packageDigest",
  });
}

function verifyDigestMutations(profileApi, placeholderCatalog, artifacts, baselineDigest) {
  let byteVectors = 0;
  let pathVectors = 0;
  let removalVectors = 0;
  for (let index = 0; index < artifacts.length; index += 1) {
    const original = artifacts[index];
    if (original.bytes.length > 0) {
      const mutatedBytes = new Uint8Array(original.bytes);
      const byteIndex =
        createHash("sha256").update(original.path).digest().readUInt32BE(0) % mutatedBytes.length;
      mutatedBytes[byteIndex] ^= 1;
      const mutatedArtifacts = artifacts.slice();
      mutatedArtifacts[index] = Object.freeze({
        path: original.path,
        bytes: mutatedBytes,
      });
      const digest = profileApi.createWebReactPackageDigest({
        catalog: placeholderCatalog,
        artifacts: mutatedArtifacts,
      }).packageDigest;
      if (digest === baselineDigest) {
        fail(
          "REFERENCE_CAPABILITY_ARTIFACT_MUTATION_UNDETECTED",
          "A one-byte distribution mutation retained the package digest.",
          { path: original.path, byteIndex },
        );
      }
      byteVectors += 1;
    }

    const pathMutated = artifacts.slice();
    pathMutated[index] = Object.freeze({
      path: `mutation/${index.toString(36)}.bin`,
      bytes: original.bytes,
    });
    if (
      profileApi.createWebReactPackageDigest({
        catalog: placeholderCatalog,
        artifacts: pathMutated,
      }).packageDigest === baselineDigest
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_MUTATION_UNDETECTED",
        "A distribution path mutation retained the package digest.",
        { path: original.path },
      );
    }
    pathVectors += 1;

    const removed = artifacts.filter((_, artifactIndex) => artifactIndex !== index);
    if (
      profileApi.createWebReactPackageDigest({
        catalog: placeholderCatalog,
        artifacts: removed,
      }).packageDigest === baselineDigest
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_MUTATION_UNDETECTED",
        "A distribution inventory removal retained the package digest.",
        { path: original.path },
      );
    }
    removalVectors += 1;
  }
  const addedArtifacts = [
    ...artifacts,
    Object.freeze({
      path: "mutation/addition.bin",
      bytes: new Uint8Array([0x44, 0x45, 0x53, 0x45, 0x4e]),
    }),
  ];
  if (
    profileApi.createWebReactPackageDigest({
      catalog: placeholderCatalog,
      artifacts: addedArtifacts,
    }).packageDigest === baselineDigest
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_MUTATION_UNDETECTED",
      "A distribution inventory addition retained the package digest.",
    );
  }
  let unsafePathRejected = false;
  try {
    profileApi.createWebReactPackageDigest({
      catalog: placeholderCatalog,
      artifacts: [
        ...artifacts,
        Object.freeze({ path: "../forged.bin", bytes: new Uint8Array([1]) }),
      ],
    });
  } catch {
    unsafePathRejected = true;
  }
  if (!unsafePathRejected) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_UNSAFE_PATH_ACCEPTED",
      "The final digest construction accepted an unsafe added artifact path.",
    );
  }
  return Object.freeze({
    byteVectors,
    pathVectors,
    removalVectors,
    additionVectors: 1,
    unsafePathRejections: 1,
  });
}

function verifyCatalogMutations(profileApi, placeholderCatalog, artifacts, baselineDigest) {
  const mutations = [
    ["id", (catalog) => (catalog.id = "run.desen.reference.sign-in-mutated")],
    ["version", (catalog) => (catalog.version = "0.1.1")],
    ["target", (catalog) => (catalog.target = "web-react-mutated")],
    ["description", (catalog) => (catalog.description = "Mutation vector.")],
    [
      "manifest",
      (catalog) => (catalog.components["com.example.ui/Button"].description = "Mutation vector."),
    ],
  ];
  let digestChanges = 0;
  let profileRejections = 0;
  for (const [label, mutate] of mutations) {
    const mutatedCatalog = JSON.parse(JSON.stringify(placeholderCatalog));
    mutate(mutatedCatalog);
    try {
      const mutatedDigest = profileApi.createWebReactPackageDigest({
        catalog: mutatedCatalog,
        artifacts,
      }).packageDigest;
      if (mutatedDigest === baselineDigest) {
        fail(
          "REFERENCE_CAPABILITY_ARTIFACT_MUTATION_UNDETECTED",
          `The Catalog ${label} mutation retained the package digest.`,
        );
      }
      digestChanges += 1;
    } catch (error) {
      if (error instanceof ReferenceCatalogWebCapabilityArtifactEvidenceError) {
        throw error;
      }
      profileRejections += 1;
    }
  }
  return Object.freeze({
    vectors: mutations.length,
    digestChanges,
    profileRejections,
  });
}

function verifyPublishedSelfDigestRejection(profileApi, publishedCatalog, artifacts) {
  const wrongCatalog = JSON.parse(JSON.stringify(publishedCatalog));
  wrongCatalog.packageDigest = `sha256:${"f".repeat(64)}`;
  try {
    profileApi.verifyWebReactPackageDigest({ catalog: wrongCatalog, artifacts });
  } catch {
    return;
  }
  fail(
    "REFERENCE_CAPABILITY_ARTIFACT_SELF_DIGEST_ACCEPTED",
    "The package verifier accepted a wrong published Catalog self-digest.",
  );
}

function readUint16(bytes, offset) {
  if (offset + 2 > bytes.length) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
      "Digest preimage ended inside a uint16 path-length frame.",
    );
  }
  return Object.freeze({ value: bytes.readUInt16BE(offset), offset: offset + 2 });
}

function readUint32(bytes, offset) {
  if (offset + 4 > bytes.length) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
      "Digest preimage ended inside a uint32 frame.",
    );
  }
  return Object.freeze({ value: bytes.readUInt32BE(offset), offset: offset + 4 });
}

function independentlyParseDigestPreimage(preimage, placeholderCatalog, artifacts, protocolApi) {
  const bytes = Buffer.from(preimage);
  const magic = Buffer.from("DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n", "ascii");
  if (bytes.length < magic.length || !bytes.subarray(0, magic.length).equals(magic)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
      "Digest preimage has the wrong versioned domain separator.",
    );
  }
  let offset = magic.length;
  const countFrame = readUint32(bytes, offset);
  offset = countFrame.offset;
  const parsed = [];
  for (let index = 0; index < countFrame.value; index += 1) {
    const pathFrame = readUint16(bytes, offset);
    offset = pathFrame.offset;
    if (offset + pathFrame.value > bytes.length) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
        "Digest preimage ended inside an entry path.",
      );
    }
    const pathBytes = bytes.subarray(offset, offset + pathFrame.value);
    offset += pathFrame.value;
    const contentFrame = readUint32(bytes, offset);
    offset = contentFrame.offset;
    if (offset + contentFrame.value > bytes.length) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
        "Digest preimage ended inside entry content.",
      );
    }
    const contentBytes = bytes.subarray(offset, offset + contentFrame.value);
    offset += contentFrame.value;
    parsed.push(
      Object.freeze({
        path: pathBytes.toString("ascii"),
        bytes: Buffer.from(contentBytes),
      }),
    );
  }
  if (offset !== bytes.length) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
      "Digest preimage contains trailing unframed bytes.",
    );
  }
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index - 1].path >= parsed[index].path) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
        "Digest entries are not in strict lowercase-ASCII path order.",
      );
    }
  }
  const expected = [
    Object.freeze({
      path: "catalog.json",
      bytes: Buffer.from(protocolApi.canonicalizeJsonBytes(placeholderCatalog)),
    }),
    ...artifacts.map(({ path: artifactPath, bytes: contentBytes }) =>
      Object.freeze({
        path: artifactPath,
        bytes: Buffer.from(contentBytes),
      }),
    ),
  ].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  if (expected.length !== parsed.length) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
      "Digest preimage entry count differs from the complete inventory.",
    );
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (
      expected[index].path !== parsed[index].path ||
      !expected[index].bytes.equals(parsed[index].bytes)
    ) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_FRAME_DRIFT",
        "Digest preimage path or content differs from the independently supplied inventory.",
        { index, expectedPath: expected[index].path, actualPath: parsed[index].path },
      );
    }
  }
  return Object.freeze({
    entries: parsed.length,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
}

function verifyRootScripts(rootPackage) {
  if (!isPlainRecord(rootPackage.scripts)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_COMMAND_WIRING_DRIFT",
      "The root package has no script map.",
    );
  }
  for (const name of ROOT_SCRIPT_NAMES) {
    const command = rootPackage.scripts[name];
    if (command !== EXPECTED_ROOT_SCRIPTS[name]) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_COMMAND_WIRING_DRIFT",
        `Root script ${name} differs from the complete reviewed M03-T10 chain.`,
      );
    }
  }
  const aggregateTests = String(rootPackage.scripts.test ?? "")
    .split("&&")
    .map((step) => step.trim());
  const qualityGate = String(rootPackage.scripts.check ?? "")
    .split("&&")
    .map((step) => step.trim());
  if (
    !aggregateTests.includes("pnpm test:reference-catalog-web-capability-artifact") ||
    !qualityGate.includes("pnpm verify:reference-catalog-web-capability-artifact") ||
    !qualityGate.includes("pnpm test")
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_COMMAND_WIRING_DRIFT",
      "The aggregate test or complete quality gate omits M03-T10.",
    );
  }
}

/**
 * Verifies that the generated Catalog is published as inert package data rather than a loader.
 */
export function verifyReferenceCatalogWebPackagePublicationSurface(packageManifest) {
  if (!isPlainRecord(packageManifest)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT",
      "The reference package manifest must be a plain JSON object.",
    );
  }
  if (
    packageManifest.type !== "module" ||
    packageManifest.sideEffects !== false ||
    !Array.isArray(packageManifest.files) ||
    packageManifest.files.length !== 2 ||
    packageManifest.files[0] !== "catalog.json" ||
    packageManifest.files[1] !== "dist" ||
    !isPlainRecord(packageManifest.exports) ||
    JSON.stringify(packageManifest.exports) !== JSON.stringify(EXPECTED_PACKAGE_EXPORTS)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT",
      "The package must publish exactly catalog.json plus dist and expose the Catalog as inert JSON data.",
    );
  }
  return Object.freeze({
    files: Object.freeze([...packageManifest.files]),
    exports: Object.freeze(Object.keys(EXPECTED_PACKAGE_EXPORTS)),
    export: "./catalog.json",
    target: "./catalog.json",
    executableLoader: false,
  });
}

async function compilerInputHashes(snapshotRoot) {
  const snapshotInventory = await readSafeInventory(snapshotRoot, "compiler-snapshot");
  return snapshotInventory.map((entry) => ({
    path: entry.path,
    bytes: entry.byteLength,
    sha256: entry.sha256,
  }));
}

async function trackedFileHashes({ compilerInputs, implementationSnapshots }) {
  const fixedPaths = [...TRACKED_IMPLEMENTATION_PATHS];
  const records = [...compilerInputs];
  for (let index = 0; index < fixedPaths.length; index += 1) {
    const filePath = fixedPaths[index];
    const bytes = implementationSnapshots[index];
    records.push({
      path: path.relative(WORKSPACE_ROOT, filePath),
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  records.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return records;
}

async function verifyPrerequisite(enabled, artifactPath) {
  if (!enabled) {
    return Object.freeze({
      task: "M03-T09",
      result: "SKIPPED",
      artifactSha256: null,
    });
  }
  try {
    const result = await verifyReferenceCatalogWebParityEvidence({ artifactPath });
    return Object.freeze({
      task: "M03-T09",
      result: "PASS",
      artifactSha256: result.artifactSha256,
    });
  } catch (error) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PREREQUISITE_DRIFT",
      "The exact M03-T09 parity prerequisite did not verify.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function assertPreparedEvidence(result) {
  if (
    !isPlainRecord(result) ||
    !isPlainRecord(result.artifact) ||
    !(result.artifactBytes instanceof Uint8Array) ||
    !(result.catalogBytes instanceof Uint8Array) ||
    result.artifactSha256 !== sha256(result.artifactBytes) ||
    result.catalogSha256 !== sha256(result.catalogBytes)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PREPARED_RESULT_INVALID",
      "Prepared evidence is incomplete or internally inconsistent.",
    );
  }
}

/**
 * Builds M03-T10 evidence from two clean isolated TypeScript builds and the exact workspace dist.
 *
 * The published Catalog remains data-only. This proof composes the five official component
 * registrations and signIn operation through built package APIs, fingerprints every emitted byte,
 * and deliberately creates no executable adapter registry; runtime registration belongs to M05.
 */
export async function buildReferenceCatalogWebCapabilityArtifactEvidence(options = undefined) {
  const normalized = normalizeBuildOptions(options);
  const paths = Object.freeze(
    Object.fromEntries(
      Object.entries(DEFAULT_PATHS).map(([name, defaultPath]) => [
        name,
        normalized[name] ?? defaultPath,
      ]),
    ),
  );
  const tscPath = await realpath(TSC_LINK_PATH);
  await assertRegularFile(tscPath, "TypeScript compiler");

  const [
    componentApiRaw,
    operationsApiRaw,
    profileApiRaw,
    catalogApiRaw,
    protocolApiRaw,
    validatorApiRaw,
    rootPackageBytes,
    implementationSnapshots,
  ] = await Promise.all([
    normalized.componentApi ?? importFresh(paths.componentApiPath),
    normalized.operationsApi ?? importFresh(paths.operationsApiPath),
    normalized.profileApi ?? importFresh(paths.profileApiPath),
    normalized.catalogApi ?? importFresh(paths.catalogSdkApiPath),
    normalized.protocolApi ?? importFresh(paths.protocolApiPath),
    normalized.validatorApi ?? importFresh(paths.validatorApiPath),
    readFile(paths.rootPackagePath),
    Promise.all(TRACKED_IMPLEMENTATION_PATHS.map((filePath) => readFile(filePath))),
  ]);

  const componentApi = captureApi(
    componentApiRaw,
    [],
    COMPONENT_REGISTRATION_EXPORTS.map(({ exportName }) => exportName),
    "component API",
  );
  const operationsApi = captureApi(
    operationsApiRaw,
    [],
    [OPERATION_REGISTRATION_EXPORT],
    "operations API",
  );
  const profileApi = captureApi(
    profileApiRaw,
    [
      "createWebReactPackageDigest",
      "encodeWebReactPackageDigestPreimage",
      "verifyWebReactPackageDigest",
    ],
    ["WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER", "WEB_REACT_PACKAGE_DIGEST_PROFILE"],
    "digest profile API",
  );
  const catalogApi = captureApi(catalogApiRaw, ["createCatalogManifest"], [], "Catalog SDK API");
  const protocolApi = captureApi(protocolApiRaw, ["canonicalizeJsonBytes"], [], "protocol API");
  const validatorApi = captureApi(
    validatorApiRaw,
    [
      "validateDesenCatalog",
      "validateDesenCatalogSemantics",
      "validateDesenCatalogSet",
      "validateDesenComponentCatalogSet",
      "validateDesenInteractionCatalogSet",
      "validateDesenExecutionCatalogSet",
    ],
    [],
    "validator API",
  );
  if (
    profileApi.WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER !== PACKAGE_DIGEST_PLACEHOLDER ||
    profileApi.WEB_REACT_PACKAGE_DIGEST_PROFILE?.target !== CATALOG_TARGET
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PROFILE_DRIFT",
      "The built package does not expose the exact M03-T04 Web-React digest profile.",
    );
  }

  const registrations = {
    components: COMPONENT_REGISTRATION_EXPORTS.map(({ id, exportName }) => {
      const registration = componentApi[exportName];
      assertRegistration(registration, id, exportName);
      return registration;
    }),
    operation: operationsApi[OPERATION_REGISTRATION_EXPORT],
  };
  assertRegistration(registrations.operation, OPERATION_ID, OPERATION_REGISTRATION_EXPORT);
  const placeholderCatalog = buildCatalog(catalogApi, registrations, PACKAGE_DIGEST_PLACEHOLDER);
  const placeholderValidationStages = validateCatalog(validatorApi, placeholderCatalog);

  let rootPackage;
  try {
    rootPackage = JSON.parse(rootPackageBytes.toString("utf8"));
  } catch {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_COMMAND_WIRING_DRIFT",
      "The root package manifest is not JSON.",
    );
  }
  verifyRootScripts(rootPackage);

  const snapshot = await createCompilerInputSnapshot(paths, tscPath);
  let firstBuild;
  let secondBuild;
  let workspaceInventory;
  let prerequisite;
  let compilerInputs;
  let packagePublication;
  try {
    const packageManifestBytes = await readFile(
      path.join(snapshot.snapshotRoot, "packages/reference-catalog-web/package.json"),
    );
    let packageManifest;
    try {
      packageManifest = JSON.parse(packageManifestBytes.toString("utf8"));
    } catch {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT",
        "The snapshotted reference package manifest is not JSON.",
      );
    }
    packagePublication = verifyReferenceCatalogWebPackagePublicationSurface(packageManifest);
    [firstBuild, secondBuild, workspaceInventory, prerequisite, compilerInputs] = await Promise.all(
      [
        buildIsolatedInventory("a", snapshot.snapshotRoot),
        buildIsolatedInventory("b", snapshot.snapshotRoot),
        readSafeInventory(paths.distDirectory),
        verifyPrerequisite(normalized.verifyPrerequisite ?? true, paths.prerequisiteArtifactPath),
        compilerInputHashes(snapshot.snapshotRoot),
      ],
    );
  } finally {
    await rm(snapshot.snapshotOwner, { recursive: true, force: true });
  }
  assertInventoriesEqual(firstBuild, secondBuild, "The two isolated builds");
  assertInventoriesEqual(firstBuild, workspaceInventory, "The workspace distribution");
  const sourceMaps = verifySourceMaps(workspaceInventory);
  const artifacts = artifactInputs(workspaceInventory);

  const firstDescription = profileApi.createWebReactPackageDigest({
    catalog: placeholderCatalog,
    artifacts,
  });
  const secondDescription = profileApi.createWebReactPackageDigest({
    catalog: placeholderCatalog,
    artifacts: artifactInputs(secondBuild),
  });
  const preimage = profileApi.encodeWebReactPackageDigestPreimage({
    catalog: placeholderCatalog,
    artifacts,
  });
  const independentFrame = independentlyParseDigestPreimage(
    preimage,
    placeholderCatalog,
    artifacts,
    protocolApi,
  );
  const reorderedDescription = profileApi.createWebReactPackageDigest({
    catalog: placeholderCatalog,
    artifacts: [...artifacts].reverse(),
  });
  if (
    firstDescription.packageDigest !== secondDescription.packageDigest ||
    firstDescription.packageDigest !== independentFrame.sha256 ||
    firstDescription.packageDigest !== reorderedDescription.packageDigest ||
    firstDescription.byteLength !== independentFrame.bytes ||
    firstDescription.entries.length !== independentFrame.entries
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_DIGEST_DRIFT",
      "Equal isolated build bytes did not produce one independently confirmed digest.",
    );
  }

  const publishedCatalog = buildCatalog(catalogApi, registrations, firstDescription.packageDigest);
  const validationStages = validateCatalog(validatorApi, publishedCatalog);
  const selfReferenceExclusion = verifyReferenceCatalogWebSelfReferenceExclusion(
    workspaceInventory,
    firstDescription.packageDigest,
  );
  const verifiedDescription = profileApi.verifyWebReactPackageDigest({
    catalog: publishedCatalog,
    artifacts,
  });
  if (verifiedDescription.packageDigest !== firstDescription.packageDigest) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_DIGEST_DRIFT",
      "Published Catalog verification did not reproduce the calculated digest.",
    );
  }
  const catalogMutations = verifyCatalogMutations(
    profileApi,
    placeholderCatalog,
    artifacts,
    firstDescription.packageDigest,
  );
  verifyPublishedSelfDigestRejection(profileApi, publishedCatalog, artifacts);
  const mutations = verifyDigestMutations(
    profileApi,
    placeholderCatalog,
    artifacts,
    firstDescription.packageDigest,
  );

  const catalogText = await format(JSON.stringify(publishedCatalog), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const catalogBytes = Buffer.from(catalogText);
  const parsedCatalog = JSON.parse(catalogBytes.toString("utf8"));
  assertCatalogIdentity(parsedCatalog, firstDescription.packageDigest);
  const canonicalCatalogBytes = protocolApi.canonicalizeJsonBytes(publishedCatalog);
  const totalBytes = workspaceInventory.reduce((sum, entry) => sum + entry.byteLength, 0);
  const provenanceOverrides = buildOverrides(normalized);
  const artifact = {
    schemaVersion: 1,
    task: "M03-T10",
    result: "PASS",
    identity: {
      id: CATALOG_ID,
      version: CATALOG_VERSION,
      target: CATALOG_TARGET,
      protocol: PROTOCOL_VERSION,
    },
    tuple: {
      id: CATALOG_ID,
      version: CATALOG_VERSION,
      target: CATALOG_TARGET,
      packageDigest: firstDescription.packageDigest,
    },
    catalog: {
      path: "packages/reference-catalog-web/catalog.json",
      bytes: catalogBytes.length,
      sha256: sha256(catalogBytes),
      canonicalBytes: canonicalCatalogBytes.length,
      canonicalSha256: sha256(canonicalCatalogBytes),
      components: COMPONENT_REGISTRATION_EXPORTS.map(({ id }) => id),
      operations: [OPERATION_ID],
      behaviors: [],
      resources: [],
      validationStages,
      placeholderValidationStages,
      digestProjection:
        "packageDigest is replaced by the M03-T04 placeholder before canonical framing",
    },
    capabilityComposition: {
      source: "built inert registration APIs",
      componentRegistrations: COMPONENT_REGISTRATION_EXPORTS,
      operationRegistration: {
        id: OPERATION_ID,
        exportName: OPERATION_REGISTRATION_EXPORT,
        implementation: "trusted-host-supplied",
      },
      executableRegistryCreated: false,
      runtimeAdapterRegistrationOwner: "M05",
    },
    reproducibility: {
      isolatedBuilds: 2,
      byteIdentical: true,
      workspaceDistExactMatch: true,
      inventoryAggregateSha256: inventoryAggregateDigest(workspaceInventory),
      sourceMaps,
      selfReferenceExclusion,
    },
    inventory: {
      root: "dist",
      files: workspaceInventory.length,
      totalBytes,
      entries: workspaceInventory.map(({ path: artifactPath, byteLength, sha256: digest }) => ({
        path: artifactPath,
        bytes: byteLength,
        sha256: digest,
      })),
    },
    digest: {
      profile: firstDescription.profile,
      profileVersion: firstDescription.profileVersion,
      target: firstDescription.target,
      packageDigest: firstDescription.packageDigest,
      preimageBytes: firstDescription.byteLength,
      entries: firstDescription.entries.length,
      independentNodeSha256Agreement: true,
      independentFrame,
      artifactOrderInvariant: true,
      publishedCatalogVerification: true,
      exactArtifactBytesIncluded: true,
    },
    mutations: {
      ...mutations,
      catalogSemanticVectors: catalogMutations.vectors,
      catalogDigestChanges: catalogMutations.digestChanges,
      catalogProfileRejections: catalogMutations.profileRejections,
      publishedSelfDigestRejections: 1,
      total:
        mutations.byteVectors +
        mutations.pathVectors +
        mutations.removalVectors +
        mutations.additionVectors +
        mutations.unsafePathRejections +
        catalogMutations.vectors +
        1,
      coverage:
        "one byte mutation, one path mutation, and one removal per dist artifact, plus addition, unsafe-path, Catalog, and self-digest vectors",
    },
    prerequisite,
    evidence: {
      provenance: {
        mode: provenanceOverrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides: provenanceOverrides,
      },
      compilerInputSnapshot: {
        files: compilerInputs.length,
        aggregateSha256: inventoryAggregateDigest(
          compilerInputs.map((entry) => ({
            path: entry.path,
            bytes: Buffer.from(entry.sha256),
          })),
        ),
      },
      trackedFiles: await trackedFileHashes({
        compilerInputs,
        implementationSnapshots,
      }),
      rootScripts: ROOT_SCRIPT_NAMES,
      packagePublication,
    },
    included: [
      "one exact distinct reference Catalog identity",
      "five real Web-React component contracts and one host-supplied signIn contract",
      "two isolated byte-identical TypeScript builds",
      "exhaustive dist inventory including declaration and source-map bytes",
      "exact workspace-dist equality",
      "deterministic package digest and immutable id/version/target/digest tuple",
      "published Catalog self-digest projection and validation",
      "per-artifact byte, path, and inventory mutation sensitivity",
    ],
    deferred: [
      "M05 executable React adapter registry and runtime materialization",
      "M06 publication service and M07 distribution, retention, resolution, and activation",
      "npm archive bytes, signatures, authenticity, and native target profiles",
    ],
    limitations: [
      "The digest preimage is the versioned Web-React profile, not an npm tarball.",
      "SHA-256 establishes integrity, not publisher authenticity.",
      "The published Catalog file is canonicalized by the profile; its presentation whitespace is separately pinned by this proof artifact.",
      "No executable handler, adapter registry, network endpoint, or authorization decision is embedded in the Catalog.",
    ],
  };
  deepFreezeJson(artifact);
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    catalog: publishedCatalog,
    catalogBytes,
    catalogSha256: sha256(catalogBytes),
    distributionInventory: workspaceInventory,
  });
}

/**
 * Checks a staged distribution against the exact clean-build inventory retained by one build.
 */
export async function verifyReferenceCatalogWebDistributionInventory(options) {
  const normalized = normalizeActionOptions(options, ["expected", "distDirectory"]);
  const { expected, distDirectory } = normalized;
  assertPreparedEvidence(expected);
  if (typeof distDirectory !== "string" || !path.isAbsolute(distDirectory)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      "distDirectory must be an absolute path string.",
    );
  }
  if (!Array.isArray(expected.distributionInventory)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PREPARED_RESULT_INVALID",
      "Prepared evidence omits its exact in-memory distribution inventory.",
    );
  }
  const actual = await readSafeInventory(distDirectory);
  assertInventoriesEqual(
    expected.distributionInventory,
    actual,
    "The staged workspace distribution",
  );
  verifySourceMaps(actual);
  return Object.freeze({ result: "PASS", files: actual.length });
}

/**
 * Compares supplied published Catalog and proof bytes with one prepared deterministic build.
 *
 * This helper exists so root tests can exercise byte drift without repeating both compilers.
 */
export function verifyReferenceCatalogWebCapabilityArtifactOutputs(options) {
  const normalized = normalizeActionOptions(options, ["expected", "artifactBytes", "catalogBytes"]);
  const { expected, artifactBytes, catalogBytes } = normalized;
  assertPreparedEvidence(expected);
  if (!byteEqual(artifactBytes, expected.artifactBytes)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PROOF_DRIFT",
      "The M03-T10 proof artifact differs from the fresh deterministic build.",
      {
        expectedSha256: expected.artifactSha256,
        actualSha256: sha256(artifactBytes),
      },
    );
  }
  if (!byteEqual(catalogBytes, expected.catalogBytes)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_CATALOG_DRIFT",
      "The published reference Catalog differs from the fresh deterministic build.",
      {
        expectedSha256: expected.catalogSha256,
        actualSha256: sha256(catalogBytes),
      },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    catalogSha256: expected.catalogSha256,
    packageDigest: expected.artifact.tuple.packageDigest,
    inventoryFiles: expected.artifact.inventory.files,
    inventoryBytes: expected.artifact.inventory.totalBytes,
    mutationVectors: expected.artifact.mutations.total,
    sourceMaps: expected.artifact.reproducibility.sourceMaps.sourceMaps,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    provenanceMode: expected.artifact.evidence.provenance.mode,
  });
}

async function canonicalTarget(filePath) {
  const parent = await realpath(path.dirname(path.resolve(filePath)));
  return path.join(parent, path.basename(filePath));
}

async function targetsDefault(filePath, defaultPath) {
  return (await canonicalTarget(filePath)) === (await canonicalTarget(defaultPath));
}

/**
 * Rebuilds and verifies both tracked M03-T10 outputs.
 *
 * `catalogPath` is explicit so publication tests can point at a staged Catalog without weakening
 * the fixed production default. Injected bytes are accepted only together with injected build
 * options or non-default destinations.
 */
export async function verifyReferenceCatalogWebCapabilityArtifactEvidence(options = undefined) {
  const normalized = normalizeActionOptions(options, [
    "artifactPath",
    "catalogPath",
    "artifactBytes",
    "catalogBytes",
    "buildOptions",
    "preparedEvidence",
  ]);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH;
  const catalogPath = normalized.catalogPath ?? DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH;
  const { artifactBytes, catalogBytes, buildOptions, preparedEvidence } = normalized;
  const artifactIsDefault = await targetsDefault(
    artifactPath,
    DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
  );
  const catalogIsDefault = await targetsDefault(
    catalogPath,
    DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH,
  );
  if (artifactIsDefault !== catalogIsDefault) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_MIXED_OUTPUT_TARGETS",
      "Catalog and proof destinations must both be tracked defaults or both be staged paths.",
    );
  }
  if (
    (artifactIsDefault || catalogIsDefault) &&
    (artifactBytes !== undefined ||
      catalogBytes !== undefined ||
      buildOptions !== undefined ||
      preparedEvidence !== undefined)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_NONDEFAULT_TRACKED_VERIFY",
      "Tracked M03-T10 outputs can only be verified from fixed production defaults.",
    );
  }
  if (artifactBytes === undefined) {
    await assertRegularFile(artifactPath, "M03-T10 proof artifact");
  }
  if (catalogBytes === undefined) {
    await assertRegularFile(catalogPath, "Published M03-T10 Catalog");
  }
  const expected =
    preparedEvidence ?? (await buildReferenceCatalogWebCapabilityArtifactEvidence(buildOptions));
  assertPreparedEvidence(expected);
  return verifyReferenceCatalogWebCapabilityArtifactOutputs({
    expected,
    artifactBytes: artifactBytes ?? (await readFile(artifactPath)),
    catalogBytes: catalogBytes ?? (await readFile(catalogPath)),
  });
}

/**
 * Atomically writes the published Catalog and proof artifact as two independently checked files.
 *
 * Both destinations reject symlinks and non-files through the shared atomic writer. The proof
 * contains the exact Catalog byte hash, so a process interruption between commits is detected by
 * the verifier and can never be reported as a valid tuple.
 */
export async function writeReferenceCatalogWebCapabilityArtifactEvidence(options = undefined) {
  const normalized = normalizeActionOptions(options, [
    "artifactPath",
    "catalogPath",
    "beforeCatalogAtomicRename",
    "beforeArtifactAtomicRename",
    "buildOptions",
    "preparedEvidence",
  ]);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH;
  const catalogPath = normalized.catalogPath ?? DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH;
  const { beforeCatalogAtomicRename, beforeArtifactAtomicRename, buildOptions, preparedEvidence } =
    normalized;
  const artifactIsDefault = await targetsDefault(
    artifactPath,
    DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
  );
  const catalogIsDefault = await targetsDefault(
    catalogPath,
    DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH,
  );
  if (artifactIsDefault !== catalogIsDefault) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_MIXED_OUTPUT_TARGETS",
      "Catalog and proof destinations must both be tracked defaults or both be staged paths.",
    );
  }
  if (
    (artifactIsDefault || catalogIsDefault) &&
    (beforeCatalogAtomicRename !== undefined ||
      beforeArtifactAtomicRename !== undefined ||
      buildOptions !== undefined ||
      preparedEvidence !== undefined)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_NONDEFAULT_TRACKED_WRITE",
      "Tracked M03-T10 outputs can only be generated from fixed production defaults.",
    );
  }
  const result =
    preparedEvidence ?? (await buildReferenceCatalogWebCapabilityArtifactEvidence(buildOptions));
  assertPreparedEvidence(result);
  try {
    await writeAtomicProofArtifact({
      artifactPath: catalogPath,
      artifactBytes: result.catalogBytes,
      beforeAtomicRename: beforeCatalogAtomicRename,
    });
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: result.artifactBytes,
      beforeAtomicRename: beforeArtifactAtomicRename,
    });
  } catch (error) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED",
      "The M03-T10 Catalog and proof outputs could not be committed safely.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  return result;
}

/** Root script names required to generate, verify, and mutation-test M03-T10. */
export const REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_ROOT_SCRIPTS = ROOT_SCRIPT_NAMES;
