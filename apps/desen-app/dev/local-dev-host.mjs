import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import { openLocalControlPlane } from "@desen/control-plane-api";
import { createServer as createViteServer } from "vite";

import { openDesenAppLocalOperationHost } from "./local-operation-host.mjs";

/** Exact browser origin owned by the normal Desen App local development profile. */
export const DESEN_APP_LOCAL_DEV_ORIGIN = "http://127.0.0.1:5173";

/** Exact Vite define consumed by `readInjectedDesenAppLocalRuntimeConfig`. */
export const DESEN_APP_LOCAL_RUNTIME_DEFINE_NAME = "__DESEN_APP_LOCAL_RUNTIME_CONFIG__";

/** Exact versioned local-runtime profile shared with the browser composition. */
export const DESEN_APP_LOCAL_RUNTIME_PROFILE = "desen.app.local-runtime.v1";

/** Exact independent Vite define for the explicitly selected local Integration service. */
export const DESEN_APP_LOCAL_OPERATION_DEFINE_NAME = "__DESEN_APP_LOCAL_OPERATION_CONFIG__";

/** Exact local Integration profile, deliberately separate from Source persistence authority. */
export const DESEN_APP_LOCAL_OPERATION_PROFILE = "desen.app.local-operation.v1";

const LOCAL_RUNTIME_TOKEN_BYTES = 32;
const LOOPBACK_ORIGIN_PATTERN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7e]+$/u;

/** Vite's pinned default secret-file denies plus the app-owned local state namespace. */
export const DESEN_APP_LOCAL_VITE_FS_DENY = Object.freeze([
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
  "**/.desen/**",
]);

/** @typedef {"INVALID_APP_DIRECTORY" | "INVALID_RUNTIME_CONFIG" | "INVALID_STATE_DIRECTORY" | "LOCAL_START_FAILED" | "LOCAL_STOP_FAILED" | "STATE_ROOT_UNAVAILABLE" | "UNSAFE_STATE_ROOT"} DesenAppLocalDevHostErrorCode */

const ERROR_MESSAGES = Object.freeze({
  INVALID_APP_DIRECTORY: "The Desen App local development directory is invalid.",
  INVALID_RUNTIME_CONFIG: "The Desen App local runtime configuration is invalid.",
  INVALID_STATE_DIRECTORY: "The Desen App local state directory is invalid.",
  LOCAL_START_FAILED: "The Desen App local runtime could not start.",
  LOCAL_STOP_FAILED: "The Desen App local runtime could not stop cleanly.",
  STATE_ROOT_UNAVAILABLE: "The Desen App local state directory is unavailable.",
  UNSAFE_STATE_ROOT: "The Desen App local state directory is unsafe.",
});

/** Redacted local launcher failure that never includes a token, path, or underlying error. */
export class DesenAppLocalDevHostError extends Error {
  /**
   * Creates one fixed-message launcher failure.
   *
   * @param {DesenAppLocalDevHostErrorCode} code Stable failure classification.
   */
  constructor(code) {
    super(ERROR_MESSAGES[code]);
    this.name = "DesenAppLocalDevHostError";
    /** @readonly */
    this.code = code;
  }
}

/**
 * @param {unknown} error
 * @returns {string | undefined}
 */
function nodeErrorCode(error) {
  try {
    if (error === null || typeof error !== "object") return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} directory
 * @returns {Promise<void>}
 */
async function ensurePrivateDirectory(directory) {
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (nodeErrorCode(error) !== "EEXIST") {
      throw new DesenAppLocalDevHostError("STATE_ROOT_UNAVAILABLE");
    }
  }
  try {
    const stats = await lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new DesenAppLocalDevHostError("UNSAFE_STATE_ROOT");
    }
    await chmod(directory, 0o700);
  } catch (error) {
    if (error instanceof DesenAppLocalDevHostError) throw error;
    throw new DesenAppLocalDevHostError("STATE_ROOT_UNAVAILABLE");
  }
}

/**
 * @param {string} directory
 * @returns {Promise<string>}
 */
async function captureCanonicalAppDirectory(directory) {
  if (typeof directory !== "string" || !isAbsolute(directory)) {
    throw new DesenAppLocalDevHostError("INVALID_APP_DIRECTORY");
  }
  try {
    const stats = await lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new DesenAppLocalDevHostError("INVALID_APP_DIRECTORY");
    }
    return await realpath(directory);
  } catch (error) {
    if (error instanceof DesenAppLocalDevHostError) throw error;
    throw new DesenAppLocalDevHostError("INVALID_APP_DIRECTORY");
  }
}

/**
 * @param {string} parent
 * @param {string} candidate
 * @returns {boolean}
 */
function containsDirectory(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." &&
      !pathFromParent.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromParent))
  );
}

/**
 * Creates and re-admits the durable application-owned `.desen/desen-app/control-plane` root.
 *
 * @param {string} stateDirectory Absolute `.desen` state directory outside the served app root.
 * @returns {Promise<string>} Canonical, private, non-symlink control-plane root.
 */
export async function prepareDesenAppLocalStateRoot(stateDirectory) {
  if (typeof stateDirectory !== "string" || !isAbsolute(stateDirectory)) {
    throw new DesenAppLocalDevHostError("INVALID_STATE_DIRECTORY");
  }
  await ensurePrivateDirectory(stateDirectory);
  const appStateDirectory = join(stateDirectory, "desen-app");
  const controlPlaneDirectory = join(appStateDirectory, "control-plane");
  await ensurePrivateDirectory(appStateDirectory);
  await ensurePrivateDirectory(controlPlaneDirectory);
  try {
    const canonicalStateDirectory = await realpath(stateDirectory);
    const canonicalAppStateDirectory = await realpath(appStateDirectory);
    const canonicalControlPlaneDirectory = await realpath(controlPlaneDirectory);
    if (
      canonicalStateDirectory !== stateDirectory ||
      canonicalAppStateDirectory !== appStateDirectory ||
      canonicalControlPlaneDirectory !== controlPlaneDirectory
    ) {
      throw new DesenAppLocalDevHostError("UNSAFE_STATE_ROOT");
    }
    return canonicalControlPlaneDirectory;
  } catch (error) {
    if (error instanceof DesenAppLocalDevHostError) throw error;
    throw new DesenAppLocalDevHostError("STATE_ROOT_UNAVAILABLE");
  }
}

/**
 * @param {unknown} rawUrl
 * @returns {boolean}
 */
function requestTargetsLocalState(rawUrl) {
  if (typeof rawUrl !== "string") return true;
  try {
    let pathname = new URL(rawUrl, DESEN_APP_LOCAL_DEV_ORIGIN).pathname;
    for (let index = 0; index < 3; index += 1) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    }
    return pathname
      .replaceAll("\\", "/")
      .split("/")
      .some((segment) => segment.toLocaleLowerCase("en-US") === ".desen");
  } catch {
    return true;
  }
}

/** Adds an early fixed-response boundary so SPA fallback can never mask local state as HTTP 200. */
/** @returns {import("vite").Plugin} */
export function createDesenAppLocalStateDenyPlugin() {
  return Object.freeze({
    name: "desen-app-local-state-deny",
    enforce: "pre",
    configureServer(/** @type {import("vite").ViteDevServer} */ server) {
      server.middlewares.use(
        /**
         * @param {import("node:http").IncomingMessage} request
         * @param {import("node:http").ServerResponse} response
         * @param {() => void} next
         */
        (request, response, next) => {
          if (!requestTargetsLocalState(request.url)) {
            next();
            return;
          }
          response.statusCode = 403;
          response.setHeader("cache-control", "no-store");
          response.setHeader("content-type", "text/plain; charset=utf-8");
          response.setHeader("x-content-type-options", "nosniff");
          response.end("Forbidden.\n");
        },
      );
    },
  });
}

/**
 * Generates one 256-bit base64url bearer secret from an explicit cryptographic entropy source.
 *
 * @param {(size: number) => Uint8Array} [entropy] Injected only by focused tests.
 * @returns {string} A visible-ASCII token admitted by the local control plane.
 */
export function createDesenAppLocalApiToken(entropy = randomBytes) {
  let bytes;
  try {
    bytes = entropy(LOCAL_RUNTIME_TOKEN_BYTES);
  } catch {
    throw new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG");
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== LOCAL_RUNTIME_TOKEN_BYTES) {
    throw new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG");
  }
  const token = Buffer.from(bytes).toString("base64url");
  if (token.length < 32 || token.length > 256 || !VISIBLE_ASCII_PATTERN.test(token)) {
    throw new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG");
  }
  return token;
}

/**
 * Builds the sole Vite define carrying the in-memory local control-plane configuration.
 *
 * @param {string} controlPlaneOrigin Exact origin returned by the fixed-loopback listener.
 * @param {string} apiToken Fresh launcher-owned bearer secret.
 * @returns {Readonly<Record<string, string>>} Frozen define map safe for Vite configuration.
 */
export function createDesenAppLocalRuntimeDefine(controlPlaneOrigin, apiToken) {
  const match =
    typeof controlPlaneOrigin === "string"
      ? LOOPBACK_ORIGIN_PATTERN.exec(controlPlaneOrigin)
      : null;
  const port = match === null ? Number.NaN : Number(match[1]);
  if (
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    typeof apiToken !== "string" ||
    apiToken.length < 32 ||
    apiToken.length > 256 ||
    !VISIBLE_ASCII_PATTERN.test(apiToken)
  ) {
    throw new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG");
  }
  const config = Object.freeze({
    profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
    controlPlane: Object.freeze({ origin: controlPlaneOrigin, apiToken }),
  });
  return Object.freeze({
    [DESEN_APP_LOCAL_RUNTIME_DEFINE_NAME]: JSON.stringify(config),
  });
}

/**
 * Builds the separate operation define from one fixed-loopback listener and its own bearer.
 *
 * @param {string} origin Exact local operation listener origin.
 * @param {string} apiToken Independent fresh launcher-owned operation bearer.
 * @returns {Readonly<Record<string, string>>} Closed, in-memory Vite operation configuration.
 */
export function createDesenAppLocalOperationDefine(origin, apiToken) {
  // Reuse the same finite origin/token rules without sharing either service's secret or shape.
  createDesenAppLocalRuntimeDefine(origin, apiToken);
  return Object.freeze({
    [DESEN_APP_LOCAL_OPERATION_DEFINE_NAME]: JSON.stringify({
      profile: DESEN_APP_LOCAL_OPERATION_PROFILE,
      origin,
      apiToken,
    }),
  });
}

/**
 * @typedef {Readonly<{
 *   appOrigin: typeof DESEN_APP_LOCAL_DEV_ORIGIN;
 *   close: () => Promise<void>;
 * }>} DesenAppLocalDevHost
 */

/**
 * @typedef {Readonly<{
 *   appDirectory: string;
 *   stateDirectory: string;
 *   createViteServer?: typeof createViteServer;
 *   entropy?: (size: number) => Uint8Array;
 *   openControlPlane?: typeof openLocalControlPlane;
 *   openOperationHost?: typeof openDesenAppLocalOperationHost;
 * }>} StartDesenAppLocalDevOptions
 */

/**
 * Starts independent Source persistence, opt-in local operations, and Vite as one local composition.
 *
 * @param {StartDesenAppLocalDevOptions} options Trusted launcher capabilities and app directory.
 * @returns {Promise<DesenAppLocalDevHost>} Revocable local host handle; no bearer secret is exposed.
 */
export async function startDesenAppLocalDev(options) {
  const openControlPlane = options.openControlPlane ?? openLocalControlPlane;
  const openOperationHost = options.openOperationHost ?? openDesenAppLocalOperationHost;
  const makeViteServer = options.createViteServer ?? createViteServer;
  const canonicalAppDirectory = await captureCanonicalAppDirectory(options.appDirectory);
  const apiToken = createDesenAppLocalApiToken(options.entropy);
  const operationApiToken = createDesenAppLocalApiToken(options.entropy);
  if (operationApiToken === apiToken) {
    throw new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG");
  }
  const rootDirectory = await prepareDesenAppLocalStateRoot(options.stateDirectory);
  const canonicalStateDirectory = dirname(dirname(rootDirectory));
  if (
    containsDirectory(canonicalAppDirectory, canonicalStateDirectory) ||
    containsDirectory(canonicalStateDirectory, canonicalAppDirectory)
  ) {
    throw new DesenAppLocalDevHostError("UNSAFE_STATE_ROOT");
  }
  let controlPlane;
  let operationHost;
  let viteServer;
  try {
    controlPlane = await openControlPlane({
      rootDirectory,
      apiToken,
      allowedOrigins: Object.freeze([DESEN_APP_LOCAL_DEV_ORIGIN]),
    });
    const listener = await controlPlane.listen(0);
    operationHost = await openOperationHost({
      apiToken: operationApiToken,
      allowedOrigin: DESEN_APP_LOCAL_DEV_ORIGIN,
    });
    const operationListener = await operationHost.listen(0);
    viteServer = await makeViteServer({
      root: canonicalAppDirectory,
      appType: "spa",
      configFile: false,
      envDir: false,
      clearScreen: false,
      define: {
        ...createDesenAppLocalRuntimeDefine(listener.origin, apiToken),
        ...createDesenAppLocalOperationDefine(operationListener.origin, operationApiToken),
      },
      plugins: [createDesenAppLocalStateDenyPlugin()],
      server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        open: false,
        origin: DESEN_APP_LOCAL_DEV_ORIGIN,
        fs: {
          strict: true,
          deny: [...DESEN_APP_LOCAL_VITE_FS_DENY],
        },
      },
    });
    await viteServer.listen();
  } catch {
    if (viteServer !== undefined) {
      try {
        await viteServer.close();
      } catch {
        // Startup already failed; continue revoking the storage authority.
      }
    }
    if (controlPlane !== undefined) {
      try {
        await controlPlane.close();
      } catch {
        // The public failure remains fixed and redacted across cleanup outcomes.
      }
    }
    if (operationHost !== undefined) {
      try {
        await operationHost.close();
      } catch {
        // A failed listener cannot leave the independently authorized operation service live.
      }
    }
    throw new DesenAppLocalDevHostError("LOCAL_START_FAILED");
  }

  let closePromise;
  const close = () => {
    closePromise ??= (async () => {
      let failed = false;
      try {
        await viteServer.close();
      } catch {
        failed = true;
      }
      try {
        await controlPlane.close();
      } catch {
        failed = true;
      }
      try {
        await operationHost.close();
      } catch {
        failed = true;
      }
      if (failed) throw new DesenAppLocalDevHostError("LOCAL_STOP_FAILED");
    })();
    return closePromise;
  };

  return Object.freeze({ appOrigin: DESEN_APP_LOCAL_DEV_ORIGIN, close });
}
