"use strict";

// CommonJS is required because this file is injected with Node's `--require` preload hook.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsPromises = require("node:fs/promises");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawnSync } = require("node:child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHash } = require("node:crypto");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fileURLToPath } = require("node:url");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { types: utilTypes } = require("node:util");

const INSTALLATION_MARKER = Symbol.for("desen.ci.proof-filesystem-compatibility.v1");
const COMPATIBILITY_ERROR_CODE = "DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID";

const FILESYSTEM_COMPATIBILITY_POLICIES = Object.freeze({
  NONE: "NONE",
  FIXTURE_COPY: "FIXTURE_COPY",
  REVIEWED_SYMLINK: "REVIEWED_SYMLINK",
  FIXTURE_COPY_AND_REVIEWED_SYMLINK: "FIXTURE_COPY_AND_REVIEWED_SYMLINK",
});

const POLICY_BY_STEP_ID = Object.freeze({
  "test-protocol-snapshot": FILESYSTEM_COMPATIBILITY_POLICIES.FIXTURE_COPY_AND_REVIEWED_SYMLINK,
  "test-protocol-types": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-protocol-official-suite-parity": FILESYSTEM_COMPATIBILITY_POLICIES.FIXTURE_COPY,
  "test-sc-01-a2ui-bridge": FILESYSTEM_COMPATIBILITY_POLICIES.FIXTURE_COPY,
  "test-reference-catalog-web-components": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-reference-catalog-web-form-feedback": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-reference-catalog-web-parity": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-reference-catalog-web-capability-artifact":
    FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-reference-sign-in-fixtures-and-host-binding":
    FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-reference-tokens-and-synthetic-fixtures":
    FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-reference-host-web-shell": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-reference-host-web-sign-in": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-runtime-core-command-event-actions": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-runtime-core-local-state-identity": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-runtime-core-reactive-reevaluation": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-runtime-react-reconciliation-diagnostics":
    FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-runtime-react-failure-boundary": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  "test-sc-01-dtcg-compatibility": FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
});

const WORKSPACE_SYMLINK_BEHAVIORS = Object.freeze({
  TRACKED_ALIAS: "TRACKED_ALIAS",
  TEMP_FILE_MIRROR: "TEMP_FILE_MIRROR",
});

function workspaceSymlinkRule(relativeTarget, kind, behavior) {
  return Object.freeze({ relativeTarget, kind, behavior });
}

const TRACKED_ARTIFACT_DIRECTORY = "docs/proof/artifacts";
const WORKSPACE_SYMLINK_RULES_BY_STEP_ID = Object.freeze({
  "test-reference-catalog-web-components": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/reference-catalog-web-components.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-reference-catalog-web-form-feedback": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/reference-catalog-web-form-feedback.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-reference-catalog-web-parity": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/reference-catalog-web-parity.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-reference-catalog-web-capability-artifact": Object.freeze([
    workspaceSymlinkRule(
      TRACKED_ARTIFACT_DIRECTORY,
      "directory",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-reference-sign-in-fixtures-and-host-binding": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/reference-sign-in-fixtures-and-host-binding.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-reference-tokens-and-synthetic-fixtures": Object.freeze([
    workspaceSymlinkRule(
      TRACKED_ARTIFACT_DIRECTORY,
      "directory",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-reference-host-web-shell": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/reference-host-web-0.1.0-shell.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
    workspaceSymlinkRule(
      "docs/proof/REFERENCE-HOST-WEB-SHELL.md",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
  ]),
  "test-reference-host-web-sign-in": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
    workspaceSymlinkRule(
      "docs/proof/REFERENCE-HOST-WEB-SIGN-IN.md",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
  ]),
  "test-runtime-core-command-event-actions": Object.freeze([
    workspaceSymlinkRule(
      TRACKED_ARTIFACT_DIRECTORY,
      "directory",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-runtime-core-local-state-identity": Object.freeze([
    workspaceSymlinkRule(
      TRACKED_ARTIFACT_DIRECTORY,
      "directory",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-runtime-core-reactive-reevaluation": Object.freeze([
    workspaceSymlinkRule(
      TRACKED_ARTIFACT_DIRECTORY,
      "directory",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
  "test-runtime-react-reconciliation-diagnostics": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
    workspaceSymlinkRule(
      "docs/proof/RUNTIME-REACT-RECONCILIATION-DIAGNOSTICS.md",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
  ]),
  "test-runtime-react-failure-boundary": Object.freeze([
    workspaceSymlinkRule(
      "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
    workspaceSymlinkRule(
      "docs/proof/RUNTIME-REACT-FAILURE-BOUNDARY.md",
      "file",
      WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ),
  ]),
  "test-sc-01-dtcg-compatibility": Object.freeze([
    workspaceSymlinkRule(
      TRACKED_ARTIFACT_DIRECTORY,
      "directory",
      WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ),
  ]),
});

const COPY_SOURCE_BY_STEP_ID = Object.freeze({
  "test-protocol-snapshot": "packages/protocol/upstream/0.1.0/snapshot",
  "test-protocol-official-suite-parity": "packages/protocol/upstream/0.1.0/snapshot",
  "test-sc-01-a2ui-bridge": "tests/fixtures/standards/a2ui/0.9.1",
});

const COPY_POLICIES = new Set([
  FILESYSTEM_COMPATIBILITY_POLICIES.FIXTURE_COPY,
  FILESYSTEM_COMPATIBILITY_POLICIES.FIXTURE_COPY_AND_REVIEWED_SYMLINK,
]);
const SYMLINK_POLICIES = new Set([
  FILESYSTEM_COMPATIBILITY_POLICIES.REVIEWED_SYMLINK,
  FILESYSTEM_COMPATIBILITY_POLICIES.FIXTURE_COPY_AND_REVIEWED_SYMLINK,
]);
const COPY_OPTION_KEYS = new Set(["preserveTimestamps", "recursive"]);
const MAXIMUM_COPY_DEPTH = 32;
const MAXIMUM_COPY_ENTRIES = 2_048;
const MAXIMUM_COPY_BYTES = 32 * 1024 * 1024;
const MAXIMUM_MIRROR_BYTES = 4 * 1024 * 1024;
const MIRROR_DIRECTORY_NAME = ".desen-ci-workspace-symlink-mirrors";
const MODULE_WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const SYMLINK_HELPER_PATH =
  process.platform === "darwin" || process.platform === "linux" ? "/bin/ln" : null;

const originalCopySync = fs.cpSync.bind(fs);
let mirrorSequence = 0;

function fail(message) {
  const error = new Error(message);
  error.code = COMPATIBILITY_ERROR_CODE;
  throw error;
}

function validateWorkspaceSymlinkRules() {
  const stepEntries = Object.entries(WORKSPACE_SYMLINK_RULES_BY_STEP_ID);
  const rules = stepEntries.flatMap(([, stepRules]) => stepRules);
  if (
    stepEntries.length !== 14 ||
    rules.length !== 18 ||
    rules.filter(({ behavior }) => behavior === WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS)
      .length !== 10 ||
    rules.filter(({ behavior }) => behavior === WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR)
      .length !== 8
  ) {
    fail("Reviewed workspace-symlink rule counts drifted.");
  }
  for (const [stepId, stepRules] of stepEntries) {
    if (!SYMLINK_POLICIES.has(POLICY_BY_STEP_ID[stepId])) {
      fail("A workspace-symlink rule is not owned by a reviewed symlink workload.");
    }
    const seenTargets = new Set();
    for (const rule of stepRules) {
      if (
        !rule ||
        Reflect.ownKeys(rule).length !== 3 ||
        typeof rule.relativeTarget !== "string" ||
        rule.relativeTarget.length === 0 ||
        path.posix.isAbsolute(rule.relativeTarget) ||
        path.posix.normalize(rule.relativeTarget) !== rule.relativeTarget ||
        rule.relativeTarget.split("/").includes("..") ||
        !["file", "directory"].includes(rule.kind) ||
        !Object.values(WORKSPACE_SYMLINK_BEHAVIORS).includes(rule.behavior) ||
        (rule.behavior === WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR && rule.kind !== "file") ||
        seenTargets.has(rule.relativeTarget)
      ) {
        fail("A reviewed workspace-symlink rule is invalid.");
      }
      seenTargets.add(rule.relativeTarget);
    }
  }
}

validateWorkspaceSymlinkRules();

function filesystemPath(value, label) {
  let resolved;
  if (typeof value === "string") {
    if (!path.isAbsolute(value)) fail(`${label} must be absolute.`);
    resolved = path.resolve(value);
  } else if (value instanceof URL && value.protocol === "file:") {
    resolved = path.resolve(fileURLToPath(value));
  } else {
    fail(`${label} must be an absolute string or file URL.`);
  }
  if (process.platform === "darwin" && (resolved === "/var" || resolved.startsWith("/var/"))) {
    return `/private${resolved}`;
  }
  return resolved;
}

function assertContained(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  ) {
    return relative;
  }
  fail(`${label} escaped its authenticated proof boundary.`);
}

function pathsOverlap(left, right) {
  const relative = path.relative(left, right);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  ) {
    return true;
  }
  const reverse = path.relative(right, left);
  return (
    reverse === "" ||
    (!reverse.startsWith(`..${path.sep}`) && reverse !== ".." && !path.isAbsolute(reverse))
  );
}

function lstatIfPresent(filePath) {
  try {
    return fs.lstatSync(filePath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function assertNoFollowPath(root, candidate, label, { leafMayBeMissing = false } = {}) {
  const relative = assertContained(root, candidate, label);
  const rootEntry = lstatIfPresent(root);
  if (!rootEntry?.isDirectory() || rootEntry.isSymbolicLink()) {
    fail(`${label} has an unsafe authenticated root.`);
  }
  if (relative === "") return rootEntry;

  const segments = relative.split(path.sep);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const entry = lstatIfPresent(current);
    if (entry === undefined) {
      if (leafMayBeMissing && index === segments.length - 1) return undefined;
      fail(`${label} contains a missing parent.`);
    }
    if (entry.isSymbolicLink()) fail(`${label} traverses a symbolic link.`);
    if (index < segments.length - 1 && !entry.isDirectory()) {
      fail(`${label} traverses a non-directory parent.`);
    }
    if (index === segments.length - 1) return entry;
  }
  fail(`${label} could not be authenticated.`);
}

function authenticatePermissionBoundary(stepId, workspaceRoot, tempRoot) {
  if (
    workspaceRoot !== MODULE_WORKSPACE_ROOT ||
    process.env.DESEN_CI_WORKSPACE_ROOT !== workspaceRoot
  ) {
    fail("Authenticated workspace root does not match the loaded compatibility module.");
  }
  if (
    process.env.TMPDIR !== tempRoot ||
    process.env.TMP !== tempRoot ||
    process.env.TEMP !== tempRoot
  ) {
    fail("Authenticated proof temp variables do not agree.");
  }
  const tempNamePrefix = `desen-ci-${stepId}-`;
  const tempName = path.basename(tempRoot);
  if (!tempName.startsWith(tempNamePrefix) || tempName.length !== tempNamePrefix.length + 6) {
    fail("Authenticated proof step does not own the supplied temp root.");
  }
  const moduleEntry = assertNoFollowPath(
    workspaceRoot,
    __filename,
    "Filesystem compatibility module",
  );
  const tempEntry = assertNoFollowPath(tempRoot, tempRoot, "Authenticated proof temp root");
  if (!moduleEntry.isFile() || !tempEntry.isDirectory() || pathsOverlap(workspaceRoot, tempRoot)) {
    fail("Filesystem compatibility roots have unsafe identity or overlap.");
  }
  let workspaceReadable;
  let workspaceWritable;
  let tempReadable;
  let tempWritable;
  let tempParentWritable;
  try {
    workspaceReadable = process.permission.has("fs.read", workspaceRoot);
    workspaceWritable = process.permission.has("fs.write", workspaceRoot);
    tempReadable = process.permission.has("fs.read", tempRoot);
    tempWritable = process.permission.has("fs.write", tempRoot);
    tempParentWritable = process.permission.has("fs.write", path.dirname(tempRoot));
  } catch {
    fail("Filesystem compatibility could not inspect the Node permission boundary.");
  }
  if (
    !workspaceReadable ||
    workspaceWritable ||
    !tempReadable ||
    !tempWritable ||
    tempParentWritable
  ) {
    fail("Filesystem compatibility permission grants do not match the reviewed boundary.");
  }
}

function validateCopyOptions(options) {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    utilTypes.isProxy(options)
  ) {
    fail("Fixture-copy options must be an ordinary object.");
  }
  const prototype = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("Fixture-copy options have an unsupported prototype.");
  }
  for (const key of Reflect.ownKeys(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (
      typeof key !== "string" ||
      !COPY_OPTION_KEYS.has(key) ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      fail("Fixture-copy options contain unsupported authority.");
    }
  }
  if (options.recursive !== true) {
    fail("Fixture-copy authority requires recursive: true.");
  }
  if (
    Object.hasOwn(options, "preserveTimestamps") &&
    typeof options.preserveTimestamps !== "boolean"
  ) {
    fail("Fixture-copy preserveTimestamps must be boolean.");
  }
  return Object.freeze({
    recursive: true,
    preserveTimestamps: options.preserveTimestamps === true,
  });
}

function readStableRegularFile(filePath, state, label = "Fixture-copy source") {
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(filePath, flags);
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) {
      fail(`${label} is not a regular file.`);
    }
    if (before.size > BigInt(state.remainingBytes)) {
      fail(`${label} exceeds its byte budget.`);
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      fail(`${label} changed while it was read.`);
    }
    state.remainingBytes -= bytes.byteLength;
    return {
      bytes: bytes.byteLength,
      contents: bytes,
      mode: Number(before.mode & 0o777n),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function regularTreeFingerprint(root) {
  const rootEntry = lstatIfPresent(root);
  if (!rootEntry?.isDirectory() || rootEntry.isSymbolicLink()) {
    fail("Fixture-copy tree root must be a real directory.");
  }
  const state = {
    entryCount: 0,
    remainingBytes: MAXIMUM_COPY_BYTES,
    records: [],
  };

  const visit = (directory, relativeDirectory, depth) => {
    if (depth > MAXIMUM_COPY_DEPTH) fail("Fixture-copy tree exceeds its depth budget.");
    const names = fs.readdirSync(directory).sort((left, right) => left.localeCompare(right));
    for (const name of names) {
      state.entryCount += 1;
      if (state.entryCount > MAXIMUM_COPY_ENTRIES) {
        fail("Fixture-copy tree exceeds its entry budget.");
      }
      const filePath = path.join(directory, name);
      const relativePath = relativeDirectory === "" ? name : path.join(relativeDirectory, name);
      const entry = fs.lstatSync(filePath, { bigint: true });
      if (entry.isSymbolicLink()) fail("Fixture-copy tree contains a symbolic link.");
      if (entry.isDirectory()) {
        state.records.push({
          kind: "directory",
          mode: Number(entry.mode & 0o777n),
          path: relativePath,
        });
        visit(filePath, relativePath, depth + 1);
      } else if (entry.isFile()) {
        const { contents: _contents, ...fileFingerprint } = readStableRegularFile(filePath, state);
        state.records.push({
          kind: "file",
          path: relativePath,
          ...fileFingerprint,
        });
      } else {
        fail("Fixture-copy tree contains a special filesystem entry.");
      }
    }
  };

  visit(root, "", 0);
  return createHash("sha256").update(JSON.stringify(state.records)).digest("hex");
}

function createWorkspaceFileMirror(tempRoot, targetPath) {
  const sourceState = { remainingBytes: MAXIMUM_MIRROR_BYTES };
  const source = readStableRegularFile(targetPath, sourceState, "Workspace mirror source");
  const mirrorRoot = path.join(tempRoot, MIRROR_DIRECTORY_NAME);
  const mirrorRootEntry = lstatIfPresent(mirrorRoot);
  if (mirrorRootEntry === undefined) {
    fs.mkdirSync(mirrorRoot, { mode: 0o700 });
  }
  assertNoFollowPath(tempRoot, mirrorRoot, "Workspace mirror root");

  mirrorSequence += 1;
  const targetDigest = createHash("sha256").update(targetPath).digest("hex").slice(0, 16);
  const mirrorPath = path.join(mirrorRoot, `${String(mirrorSequence)}-${targetDigest}`);
  assertNoFollowPath(tempRoot, mirrorPath, "Workspace mirror destination", {
    leafMayBeMissing: true,
  });
  fs.writeFileSync(mirrorPath, source.contents, { flag: "wx", mode: source.mode });
  const mirrorState = { remainingBytes: MAXIMUM_MIRROR_BYTES };
  const mirror = readStableRegularFile(mirrorPath, mirrorState, "Workspace mirror destination");
  if (mirror.bytes !== source.bytes || mirror.sha256 !== source.sha256) {
    fail("Workspace mirror destination does not match its reviewed source.");
  }
  return mirrorPath;
}

function copyReviewedFixtureTree(stepId, workspaceRoot, tempRoot, source, destination, options) {
  const sourcePath = filesystemPath(source, "Fixture-copy source");
  const destinationPath = filesystemPath(destination, "Fixture-copy destination");
  const expectedRelativeSource = COPY_SOURCE_BY_STEP_ID[stepId];
  if (expectedRelativeSource === undefined) fail("Fixture-copy workload has no reviewed source.");
  const expectedSource = path.join(workspaceRoot, expectedRelativeSource);
  if (sourcePath !== expectedSource) fail("Fixture-copy source does not match the reviewed root.");
  assertNoFollowPath(workspaceRoot, sourcePath, "Fixture-copy source");
  assertNoFollowPath(tempRoot, path.dirname(destinationPath), "Fixture-copy destination parent");
  const destinationEntry = assertNoFollowPath(
    tempRoot,
    destinationPath,
    "Fixture-copy destination",
    { leafMayBeMissing: true },
  );
  if (
    destinationEntry !== undefined &&
    (!destinationEntry.isDirectory() || fs.readdirSync(destinationPath).length !== 0)
  ) {
    fail("Fixture-copy destination must be absent or an empty real directory.");
  }
  const reviewedOptions = validateCopyOptions(options);
  const sourceFingerprint = regularTreeFingerprint(sourcePath);
  originalCopySync(sourcePath, destinationPath, reviewedOptions);
  const destinationFingerprint = regularTreeFingerprint(destinationPath);
  if (destinationFingerprint !== sourceFingerprint) {
    fail("Fixture-copy destination does not match the reviewed source tree.");
  }
}

function createReviewedSymlink(stepId, workspaceRoot, tempRoot, target, destination, type) {
  if (typeof target !== "string") fail("Reviewed symlink target must be a string.");
  if (type !== undefined && type !== "file" && type !== "dir") {
    fail("Reviewed symlink type is unsupported.");
  }
  const destinationPath = filesystemPath(destination, "Reviewed symlink destination");
  assertNoFollowPath(tempRoot, path.dirname(destinationPath), "Reviewed symlink parent");
  const existingDestination = assertNoFollowPath(
    tempRoot,
    destinationPath,
    "Reviewed symlink destination",
    { leafMayBeMissing: true },
  );
  if (existingDestination !== undefined) fail("Reviewed symlink destination already exists.");

  const targetPath = path.isAbsolute(target)
    ? filesystemPath(target, "Reviewed symlink target")
    : path.resolve(path.dirname(destinationPath), target);
  const workspaceRelative = path.relative(workspaceRoot, targetPath);
  const workspaceTarget =
    path.isAbsolute(target) &&
    (workspaceRelative === "" ||
      (!workspaceRelative.startsWith(`..${path.sep}`) &&
        workspaceRelative !== ".." &&
        !path.isAbsolute(workspaceRelative)));
  const targetRoot = workspaceTarget ? workspaceRoot : tempRoot;
  const targetEntry = assertNoFollowPath(targetRoot, targetPath, "Reviewed symlink target");
  if (!targetEntry.isFile() && !targetEntry.isDirectory()) {
    fail("Reviewed symlink target must be a regular file or real directory.");
  }

  let linkTarget = path.isAbsolute(target) ? targetPath : target;
  if (workspaceTarget) {
    const relativeTarget = workspaceRelative.split(path.sep).join("/");
    const rule = WORKSPACE_SYMLINK_RULES_BY_STEP_ID[stepId]?.find(
      (candidate) => candidate.relativeTarget === relativeTarget,
    );
    if (rule === undefined) fail("Workspace symlink target is not reviewed for this workload.");
    const actualKind = targetEntry.isFile() ? "file" : "directory";
    if (
      rule.kind !== actualKind ||
      (rule.kind === "directory" && type !== "dir") ||
      (rule.kind === "file" && type !== undefined && type !== "file")
    ) {
      fail("Workspace symlink target kind drifted from review.");
    }
    if (rule.behavior === WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR) {
      linkTarget = createWorkspaceFileMirror(tempRoot, targetPath);
    }
  } else if (
    (type === "file" && !targetEntry.isFile()) ||
    (type === "dir" && !targetEntry.isDirectory())
  ) {
    fail("Temporary symlink type does not match its target.");
  }

  if (SYMLINK_HELPER_PATH === null) fail("Reviewed symlinks require a reviewed POSIX host.");

  if (linkTarget.startsWith("-")) fail("Reviewed symlink target is option-like.");
  const result = spawnSync(SYMLINK_HELPER_PATH, ["-s", linkTarget, destinationPath], {
    cwd: tempRoot,
    encoding: "utf8",
    env: {},
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || result.signal !== null) {
    fail(
      `Reviewed symlink helper failed (${result.error?.code ?? "NO_ERROR"}, ${String(result.status)}, ${String(result.signal)}): ${result.stderr.slice(0, 512)}`,
    );
  }
  const linkEntry = fs.lstatSync(destinationPath);
  if (!linkEntry.isSymbolicLink() || fs.readlinkSync(destinationPath) !== linkTarget) {
    fail("Reviewed symlink helper produced an unexpected entry.");
  }
}

function replacePromiseMethod(method, replacement) {
  const descriptor = Object.getOwnPropertyDescriptor(fsPromises, method);
  if (!descriptor || typeof descriptor.value !== "function") {
    fail(`Node filesystem compatibility could not secure ${method}.`);
  }
  Object.defineProperty(fsPromises, method, {
    ...descriptor,
    value: replacement,
    writable: false,
    configurable: false,
  });
}

function install(policy, stepId, workspaceRoot, tempRoot) {
  if (process.permission === undefined) {
    fail("Filesystem compatibility requires the Node permission model.");
  }
  authenticatePermissionBoundary(stepId, workspaceRoot, tempRoot);

  if (COPY_POLICIES.has(policy)) {
    replacePromiseMethod("cp", async (source, destination, options) => {
      copyReviewedFixtureTree(stepId, workspaceRoot, tempRoot, source, destination, options);
    });
  }

  if (SYMLINK_POLICIES.has(policy)) {
    replacePromiseMethod("symlink", async (target, destination, type) => {
      createReviewedSymlink(stepId, workspaceRoot, tempRoot, target, destination, type);
    });
  }
}

function expectedPolicyForStep(stepId) {
  return POLICY_BY_STEP_ID[stepId] ?? FILESYSTEM_COMPATIBILITY_POLICIES.NONE;
}

const stepId = process.env.DESEN_CI_STEP_ID;
const suppliedPolicy = process.env.DESEN_CI_FILESYSTEM_COMPATIBILITY;
if (suppliedPolicy !== undefined) {
  const expectedPolicy = expectedPolicyForStep(stepId);
  if (
    suppliedPolicy !== expectedPolicy ||
    expectedPolicy === FILESYSTEM_COMPATIBILITY_POLICIES.NONE
  ) {
    fail("Filesystem compatibility policy does not match the code-owned workload.");
  }
  const workspaceRoot = filesystemPath(
    process.env.DESEN_CI_WORKSPACE_ROOT,
    "Authenticated workspace root",
  );
  const tempRoot = filesystemPath(process.env.TMPDIR, "Authenticated proof temp root");
  if (globalThis[INSTALLATION_MARKER] !== true) {
    install(expectedPolicy, stepId, workspaceRoot, tempRoot);
    Object.defineProperty(globalThis, INSTALLATION_MARKER, {
      value: true,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }
}

module.exports = Object.freeze({
  COMPATIBILITY_ERROR_CODE,
  FILESYSTEM_COMPATIBILITY_POLICIES,
  POLICY_BY_STEP_ID,
  WORKSPACE_SYMLINK_BEHAVIORS,
  WORKSPACE_SYMLINK_RULES_BY_STEP_ID,
  expectedPolicyForStep,
});
