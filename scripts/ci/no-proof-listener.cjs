"use strict";

// CommonJS is required because this file is injected with Node's `--require` preload hook.
/* eslint-disable @typescript-eslint/no-require-imports -- This bounded preload must load before ESM. */
const childProcess = require("node:child_process");
const { createHash, timingSafeEqual } = require("node:crypto");
const dgram = require("node:dgram");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const {
  constants: fileConstants,
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} = require("node:fs");
const net = require("node:net");
const { syncBuiltinESMExports } = require("node:module");
const path = require("node:path");
const { types: utilTypes } = require("node:util");
/* eslint-enable @typescript-eslint/no-require-imports */

const INSTALLATION_MARKER = Symbol.for("desen.ci.no-proof-listener.v2");
const LISTENER_ERROR_CODE = "DESEN_CI_LISTENER_FORBIDDEN";
const NETWORK_ERROR_CODE = "DESEN_CI_NETWORK_FORBIDDEN";
const CHILD_PROCESS_ERROR_CODE = "DESEN_CI_CHILD_PROCESS_FORBIDDEN";
const AUTHORITY_PROFILE = "desen.ci.loopback-child-listener-authority.v1";
const AUTHORITY_FILE = ".desen-ci-loopback-child-listener-authority.json";
const AUTHORIZED_STEP_ID = "verify-reference-host-web-channel-consumption";
const TOKEN_PATTERN = /^[0-9a-f]{64}$/u;
const MAX_AUTHORITY_BYTES = 1_024;
const ENVIRONMENT_KEYS = Object.freeze({
  authorityPath: "DESEN_CI_LOOPBACK_CHILD_LISTENER_AUTHORITY_PATH",
  grant: "DESEN_CI_LOOPBACK_CHILD_LISTENER_GRANT",
  token: "DESEN_CI_LOOPBACK_CHILD_LISTENER_TOKEN",
});

function forbidden(message, code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function rejectListener() {
  forbidden("Proof workloads may not bind network listeners.", LISTENER_ERROR_CODE);
}

function rejectNetwork() {
  forbidden(
    "The proof child runtime may use only its admitted loopback listener.",
    NETWORK_ERROR_CODE,
  );
}

function rejectChildProcess() {
  forbidden(
    "The proof child runtime may spawn only its exact Vitest fork worker.",
    CHILD_PROCESS_ERROR_CODE,
  );
}

function exactOwnDataKeys(value, expectedKeys) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return false;
  const actual = [...keys].sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return false;
  }
  return actual.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs &&
    left.nlink === right.nlink
  );
}

function readBoundedStableFile(filePath, expectedEntry) {
  const flags = fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0);
  const descriptor = openSync(filePath, flags);
  try {
    const before = fstatSync(descriptor);
    if (
      !sameFileIdentity(before, expectedEntry) ||
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      (before.mode & 0o777) !== 0o600 ||
      before.size < 1 ||
      before.size > MAX_AUTHORITY_BYTES
    ) {
      return undefined;
    }
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
      if (count === 0) return undefined;
      offset += count;
    }
    const after = fstatSync(descriptor);
    return sameFileIdentity(before, after) ? bytes : undefined;
  } finally {
    closeSync(descriptor);
  }
}

function secureTokenEqual(left, right) {
  if (!TOKEN_PATTERN.test(left) || !TOKEN_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function authenticateLoopbackChildListenerAuthority() {
  const stepId = process.env.DESEN_CI_STEP_ID;
  const authorityPath = process.env[ENVIRONMENT_KEYS.authorityPath];
  const grant = process.env[ENVIRONMENT_KEYS.grant];
  const token = process.env[ENVIRONMENT_KEYS.token];
  const tempRoot = process.env.TMPDIR;
  if (
    stepId !== AUTHORIZED_STEP_ID ||
    typeof authorityPath !== "string" ||
    typeof grant !== "string" ||
    typeof token !== "string" ||
    typeof tempRoot !== "string" ||
    !secureTokenEqual(grant, token) ||
    !path.isAbsolute(authorityPath) ||
    !path.isAbsolute(tempRoot) ||
    path.resolve(authorityPath) !== authorityPath ||
    path.resolve(tempRoot) !== tempRoot ||
    path.dirname(authorityPath) !== tempRoot ||
    path.basename(authorityPath) !== AUTHORITY_FILE
  ) {
    return false;
  }

  try {
    const tempEntry = lstatSync(tempRoot);
    const authorityEntry = lstatSync(authorityPath);
    if (
      !tempEntry.isDirectory() ||
      tempEntry.isSymbolicLink() ||
      !authorityEntry.isFile() ||
      authorityEntry.isSymbolicLink() ||
      authorityEntry.nlink !== 1 ||
      realpathSync.native(tempRoot) !== tempRoot ||
      realpathSync.native(authorityPath) !== authorityPath
    ) {
      return false;
    }
    const bytes = readBoundedStableFile(authorityPath, authorityEntry);
    if (bytes === undefined || bytes.at(-1) !== 0x0a) return false;
    const authority = JSON.parse(bytes.toString("utf8"));
    if (
      !exactOwnDataKeys(authority, [
        "profile",
        "stepId",
        "runtime",
        "transport",
        "family",
        "address",
        "port",
        "tokenSha256",
        "workspaceRoot",
      ]) ||
      authority.profile !== AUTHORITY_PROFILE ||
      authority.stepId !== AUTHORIZED_STEP_ID ||
      authority.runtime !== "VITEST_CHILD_PROCESS_TREE" ||
      authority.transport !== "TCP" ||
      authority.family !== "IPv4" ||
      authority.address !== "127.0.0.1" ||
      authority.port !== 0 ||
      typeof authority.workspaceRoot !== "string" ||
      !path.isAbsolute(authority.workspaceRoot) ||
      path.resolve(authority.workspaceRoot) !== authority.workspaceRoot ||
      realpathSync.native(authority.workspaceRoot) !== authority.workspaceRoot ||
      !TOKEN_PATTERN.test(authority.tokenSha256)
    ) {
      return false;
    }
    const canonicalBytes = Buffer.from(`${JSON.stringify(authority)}\n`);
    const tokenSha256 = createHash("sha256").update(token).digest("hex");
    return bytes.equals(canonicalBytes) && secureTokenEqual(tokenSha256, authority.tokenSha256)
      ? authority
      : undefined;
  } catch {
    return false;
  }
}

function isExactLoopbackEphemeralListenArguments(rawArguments) {
  if (!Array.isArray(rawArguments) || utilTypes.isProxy(rawArguments)) return false;
  if (
    (rawArguments.length === 2 || rawArguments.length === 3) &&
    rawArguments[0] === 0 &&
    rawArguments[1] === "127.0.0.1"
  ) {
    return rawArguments.length === 2 || typeof rawArguments[2] === "function";
  }
  if (rawArguments.length !== 1) return false;
  const options = rawArguments[0];
  const keys = exactOwnDataKeys(options, ["host", "port"])
    ? ["host", "port"]
    : exactOwnDataKeys(options, ["cb", "host", "port"])
      ? ["cb", "host", "port"]
      : undefined;
  if (keys === undefined || options.host !== "127.0.0.1" || options.port !== 0) return false;
  return !keys.includes("cb") || typeof options.cb === "function";
}

function normalizedFetchConnectOptions(rawArguments) {
  if (
    rawArguments.length !== 1 ||
    !Array.isArray(rawArguments[0]) ||
    utilTypes.isProxy(rawArguments[0])
  ) {
    return undefined;
  }
  const normalized = rawArguments[0];
  const keys = Reflect.ownKeys(normalized);
  const symbolKeys = keys.filter((key) => typeof key === "symbol");
  const stringKeys = keys.filter((key) => typeof key === "string").sort();
  if (
    normalized.length !== 2 ||
    stringKeys.length !== 3 ||
    stringKeys[0] !== "0" ||
    stringKeys[1] !== "1" ||
    stringKeys[2] !== "length" ||
    symbolKeys.length !== 1 ||
    symbolKeys[0].description !== "normalizedArgs" ||
    Object.getOwnPropertyDescriptor(normalized, symbolKeys[0])?.value !== true ||
    Object.getOwnPropertyDescriptor(normalized, "1")?.value !== null
  ) {
    return undefined;
  }
  const options = Object.getOwnPropertyDescriptor(normalized, "0")?.value;
  return exactOwnDataKeys(options, ["highWaterMark", "host", "localAddress", "path", "port"]) &&
    options.highWaterMark === 65_536 &&
    options.localAddress === null &&
    options.path === undefined
    ? options
    : undefined;
}

function exactLoopbackConnectPort(rawArguments) {
  if (!Array.isArray(rawArguments) || utilTypes.isProxy(rawArguments)) return undefined;
  const normalized = normalizedFetchConnectOptions(rawArguments);
  const options =
    normalized ??
    (rawArguments.length === 1 && exactOwnDataKeys(rawArguments[0], ["host", "port"])
      ? rawArguments[0]
      : rawArguments.length === 2 &&
          exactOwnDataKeys(rawArguments[0], ["host", "port"]) &&
          typeof rawArguments[1] === "function"
        ? rawArguments[0]
        : undefined);
  if (options === undefined || options.host !== "127.0.0.1") return undefined;
  const port =
    typeof options.port === "string" && /^(?:[1-9][0-9]{0,4})$/u.test(options.port)
      ? Number(options.port)
      : options.port;
  return Number.isSafeInteger(port) && port >= 1 && port <= 65_535 ? port : undefined;
}

function isExactActiveLoopbackConnectArguments(rawArguments, activePorts) {
  const port = exactLoopbackConnectPort(rawArguments);
  return port !== undefined && activePorts instanceof Set && activePorts.has(port);
}

function replaceMethod(prototype, method, replacement) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
  if (!descriptor || typeof descriptor.value !== "function") {
    throw new Error(`DESEN proof-listener guard could not secure ${method}.`);
  }
  Object.defineProperty(prototype, method, {
    ...descriptor,
    value: replacement,
    writable: false,
    configurable: false,
  });
  return descriptor.value;
}

function replaceOptionalMethods(target, methods, replacement) {
  for (const method of methods) {
    const descriptor = Object.getOwnPropertyDescriptor(target, method);
    if (descriptor?.value === undefined) continue;
    if (typeof descriptor.value !== "function") {
      throw new Error(`DESEN proof-listener guard could not secure ${method}.`);
    }
    Object.defineProperty(target, method, {
      ...descriptor,
      value: replacement,
      writable: false,
      configurable: false,
    });
  }
}

function admittedNumericLoopbackLookup(hostname, options, callback) {
  if (
    hostname !== "127.0.0.1" ||
    !exactOwnDataKeys(options, ["all"]) ||
    options.all !== true ||
    typeof callback !== "function"
  ) {
    rejectNetwork();
  }
  process.nextTick(callback, null, [{ address: "127.0.0.1", family: 4 }]);
}

function isExactVitestForkArguments(rawArguments, authority) {
  if (
    !Array.isArray(rawArguments) ||
    utilTypes.isProxy(rawArguments) ||
    rawArguments.length !== 3 ||
    typeof rawArguments[0] !== "string" ||
    !Array.isArray(rawArguments[1]) ||
    utilTypes.isProxy(rawArguments[1]) ||
    rawArguments[1].length !== 0 ||
    !exactOwnDataKeys(rawArguments[2], ["env", "execArgv", "serialization", "stdio"]) ||
    rawArguments[2].serialization !== "advanced" ||
    rawArguments[2].stdio !== "pipe" ||
    !Array.isArray(rawArguments[2].execArgv) ||
    utilTypes.isProxy(rawArguments[2].execArgv)
  ) {
    return false;
  }
  const workerEnvironment = rawArguments[2].env;
  if (
    workerEnvironment === null ||
    typeof workerEnvironment !== "object" ||
    Array.isArray(workerEnvironment) ||
    utilTypes.isProxy(workerEnvironment) ||
    (Object.getPrototypeOf(workerEnvironment) !== Object.prototype &&
      Object.getPrototypeOf(workerEnvironment) !== null) ||
    Reflect.ownKeys(workerEnvironment).length > 1_024 ||
    Reflect.ownKeys(workerEnvironment).some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(workerEnvironment, key);
      return (
        typeof key !== "string" ||
        descriptor === undefined ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      );
    })
  ) {
    return false;
  }
  const expectedEnvironment = {
    DESEN_CI_STEP_ID: process.env.DESEN_CI_STEP_ID,
    [ENVIRONMENT_KEYS.authorityPath]: process.env[ENVIRONMENT_KEYS.authorityPath],
    [ENVIRONMENT_KEYS.grant]: process.env[ENVIRONMENT_KEYS.grant],
    [ENVIRONMENT_KEYS.token]: process.env[ENVIRONMENT_KEYS.token],
    NODE_OPTIONS: process.env.NODE_OPTIONS,
    TMPDIR: process.env.TMPDIR,
  };
  for (const [key, expected] of Object.entries(expectedEnvironment)) {
    if (Object.getOwnPropertyDescriptor(workerEnvironment, key)?.value !== expected) return false;
  }
  try {
    const expectedWorker = realpathSync.native(
      path.join(authority.workspaceRoot, "node_modules/vitest/dist/workers/forks.js"),
    );
    const expectedWarningPreload = realpathSync.native(
      path.join(authority.workspaceRoot, "node_modules/vitest/suppress-warnings.cjs"),
    );
    const expectedExecArgv = [
      "--experimental-import-meta-resolve",
      "--require",
      expectedWarningPreload,
      "--conditions",
      "node",
      "--conditions",
      "development",
    ];
    return (
      path.isAbsolute(rawArguments[0]) &&
      realpathSync.native(rawArguments[0]) === expectedWorker &&
      rawArguments[2].execArgv.length === expectedExecArgv.length &&
      rawArguments[2].execArgv.every((value, index) => value === expectedExecArgv[index])
    );
  } catch {
    return false;
  }
}

const listenerAuthority = authenticateLoopbackChildListenerAuthority();
const listenerAuthorityActive = listenerAuthority !== false && listenerAuthority !== undefined;

if (globalThis[INSTALLATION_MARKER] !== true) {
  if (listenerAuthorityActive) {
    const activePorts = new Map();
    const originalListen = Object.getOwnPropertyDescriptor(net.Server.prototype, "listen")?.value;
    const originalConnect = Object.getOwnPropertyDescriptor(net.Socket.prototype, "connect")?.value;
    if (typeof originalListen !== "function" || typeof originalConnect !== "function") {
      throw new Error("DESEN proof-listener guard could not capture the network boundary.");
    }

    replaceMethod(net.Server.prototype, "listen", function admittedLoopbackListen(...args) {
      if (!isExactLoopbackEphemeralListenArguments(args)) rejectListener();
      const onListening = () => {
        this.removeListener("error", onError);
        const address = this.address();
        if (
          address === null ||
          typeof address === "string" ||
          address.address !== "127.0.0.1" ||
          !Number.isSafeInteger(address.port) ||
          address.port < 1 ||
          address.port > 65_535
        ) {
          this.close();
          rejectListener();
        }
        activePorts.set(address.port, (activePorts.get(address.port) ?? 0) + 1);
        this.once("close", () => {
          const count = activePorts.get(address.port);
          if (count === 1) activePorts.delete(address.port);
          else if (count !== undefined) activePorts.set(address.port, count - 1);
        });
      };
      const onError = () => this.removeListener("listening", onListening);
      this.prependOnceListener("listening", onListening);
      this.prependOnceListener("error", onError);
      try {
        return Reflect.apply(originalListen, this, args);
      } catch (error) {
        this.removeListener("listening", onListening);
        this.removeListener("error", onError);
        throw error;
      }
    });
    replaceMethod(net.Socket.prototype, "connect", function admittedLoopbackConnect(...args) {
      if (!isExactActiveLoopbackConnectArguments(args, new Set(activePorts.keys())))
        rejectNetwork();
      return Reflect.apply(originalConnect, this, args);
    });
  } else {
    replaceMethod(net.Server.prototype, "listen", rejectListener);
  }
  replaceMethod(dgram.Socket.prototype, "bind", rejectListener);
  if (listenerAuthorityActive) {
    replaceMethod(dgram.Socket.prototype, "connect", rejectNetwork);
    replaceMethod(dgram.Socket.prototype, "send", rejectNetwork);
    replaceMethod(dns, "lookup", admittedNumericLoopbackLookup);
    const dnsNetworkMethods = [
      "lookupService",
      "resolve",
      "resolve4",
      "resolve6",
      "resolveAny",
      "resolveCaa",
      "resolveCname",
      "resolveMx",
      "resolveNaptr",
      "resolveNs",
      "resolvePtr",
      "resolveSoa",
      "resolveSrv",
      "resolveTxt",
      "reverse",
    ];
    replaceOptionalMethods(dns, dnsNetworkMethods, rejectNetwork);
    replaceOptionalMethods(dns.Resolver.prototype, dnsNetworkMethods, rejectNetwork);
    replaceOptionalMethods(dnsPromises, dnsNetworkMethods, rejectNetwork);
    replaceOptionalMethods(dnsPromises.Resolver.prototype, dnsNetworkMethods, rejectNetwork);

    const originalFork = Object.getOwnPropertyDescriptor(childProcess, "fork")?.value;
    if (typeof originalFork !== "function") {
      throw new Error("DESEN proof-listener guard could not capture the child-process boundary.");
    }
    const forkedVitestWorker = typeof process.send === "function";
    replaceMethod(childProcess, "fork", function admittedVitestFork(...args) {
      if (forkedVitestWorker || !isExactVitestForkArguments(args, listenerAuthority)) {
        rejectChildProcess();
      }
      return Reflect.apply(originalFork, this, args);
    });
    replaceOptionalMethods(
      childProcess,
      ["exec", "execFile", "execFileSync", "execSync", "spawn", "spawnSync"],
      rejectChildProcess,
    );
    syncBuiltinESMExports();
  }
  Object.defineProperty(globalThis, INSTALLATION_MARKER, {
    value: true,
    writable: false,
    configurable: false,
    enumerable: false,
  });
}

module.exports = Object.freeze({
  AUTHORITY_PROFILE,
  AUTHORIZED_STEP_ID,
  CHILD_PROCESS_ERROR_CODE,
  ENVIRONMENT_KEYS,
  LISTENER_ERROR_CODE,
  NETWORK_ERROR_CODE,
  isExactActiveLoopbackConnectArguments,
  isExactLoopbackEphemeralListenArguments,
  isExactVitestForkArguments,
  listenerAuthorityActive,
});
