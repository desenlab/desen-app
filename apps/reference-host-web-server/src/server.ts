import { createServer } from "node:http";
import { lstat, open, opendir, realpath } from "node:fs/promises";
/* eslint-disable @typescript-eslint/no-invalid-void-type -- Public lifecycle methods are
 * deliberately receiver-independent at this loopback server boundary. */
import { constants } from "node:fs";
import { dirname, extname, isAbsolute, join } from "node:path";

import {
  openReferenceHostChannelActivationController,
  readReferenceHostDeliveryBytes,
} from "./channel-activation-controller.js";

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Dirent, Stats } from "node:fs";
import type { ReferenceHostChannelActivationController } from "./channel-activation-controller.js";

const LOOPBACK_ADDRESS = "127.0.0.1" as const;
const REFRESH_PATH = "/__desen/runtime/refresh";
const HOME_PATH = "/home";
const JSON_MEDIA_TYPE = "application/json";
const MAX_STATIC_FILE_BYTES = 16 * 1_024 * 1_024;
const MAX_STATIC_FILES = 256;
const MAX_STATIC_DIRECTORIES = 256;
const MAX_STATIC_ENTRIES = 384;
const MAX_STATIC_DEPTH = 16;
const MAX_STATIC_AGGREGATE_BYTES = 32 * 1_024 * 1_024;
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-elem 'self'",
  // The reviewed React Catalog currently emits component styles as DOM style attributes.
  "style-src-attr 'unsafe-inline'",
].join("; ");

interface StaticFile {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly immutable: boolean;
}

/** Trusted configuration for the independently built Web reference-host server. */
export interface OpenReferenceHostWebServerOptions {
  /** Absolute application-owned local-control-plane and activation root. */
  readonly rootDirectory: string;
  /** Absolute application-owned installed Web–React package root. */
  readonly installedPackageDirectory: string;
  /** Absolute canonical Vite output directory served without runtime module resolution. */
  readonly clientBuildDirectory: string;
  /** Exact loopback origin returned by the running T05 control plane. */
  readonly controlPlaneOrigin: string;
  /** Bearer secret retained only by this Node.js process. */
  readonly controlPlaneApiToken: string;
  /** Fixed server-owned channel consumed by every browser refresh request. */
  readonly channelName: string;
}

/** Successful fixed-loopback listener identity. */
export interface ReferenceHostWebServerListenResult {
  /** Exact IPv4 loopback address; callers cannot choose a public bind address. */
  readonly address: typeof LOOPBACK_ADDRESS;
  /** Actual port, including an operating-system-selected port when zero was requested. */
  readonly port: number;
  /** Same-origin browser origin derived only from the fixed address and actual port. */
  readonly origin: string;
}

/** Closed server lifetime with no token, package, activation, or filesystem authority. */
export interface ReferenceHostWebServer {
  /** Starts one listener on fixed IPv4 loopback and returns its exact same-origin identity. */
  readonly listen: (this: void, port?: number) => Promise<ReferenceHostWebServerListenResult>;
  /** Idempotently fences refresh work, closes activation state, and stops the listener. */
  readonly close: (this: void) => Promise<void>;
}

function exactOwnDataRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return captured;
  } catch {
    return undefined;
  }
}

function sameFileIdentity(before: Stats, after: Stats): boolean {
  return (
    before.dev === after.dev &&
    before.ino === after.ino &&
    before.nlink === 1 &&
    after.nlink === 1 &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs
  );
}

async function securelyReadStaticFile(path: string, expectedRoot: string): Promise<Uint8Array> {
  let handle;
  try {
    const canonicalParent = await realpath(dirname(path));
    if (canonicalParent !== expectedRoot && !canonicalParent.startsWith(`${expectedRoot}/`)) {
      throw new TypeError("The reference host client build contains an unsafe file.");
    }
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.size < 0 ||
      before.size > MAX_STATIC_FILE_BYTES
    ) {
      throw new TypeError("The reference host client build contains an unsafe file.");
    }
    const bytes = new Uint8Array(await handle.readFile());
    const after = await handle.stat();
    const canonicalParentAfterRead = await realpath(dirname(path));
    const pathAfterRead = await lstat(path);
    if (
      canonicalParentAfterRead !== canonicalParent ||
      !pathAfterRead.isFile() ||
      pathAfterRead.nlink !== 1 ||
      pathAfterRead.dev !== after.dev ||
      pathAfterRead.ino !== after.ino ||
      bytes.byteLength !== before.size ||
      !sameFileIdentity(before, after)
    ) {
      throw new TypeError("The reference host client build changed while it was read.");
    }
    return bytes;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    // eslint-disable-next-line preserve-caught-error -- Filesystem details are redacted by design.
    throw new TypeError("The reference host client build contains an unsafe file.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function mediaTypeFor(path: string): string | undefined {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
    case ".map":
      return JSON_MEDIA_TYPE;
    case ".svg":
      return "image/svg+xml";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return undefined;
  }
}

async function loadStaticFiles(
  clientBuildDirectory: string,
): Promise<ReadonlyMap<string, StaticFile>> {
  if (!isAbsolute(clientBuildDirectory)) {
    throw new TypeError("The reference host client build directory is invalid.");
  }
  const rootStatus = await lstat(clientBuildDirectory);
  const canonicalRoot = await realpath(clientBuildDirectory);
  if (
    rootStatus.isSymbolicLink() ||
    !rootStatus.isDirectory() ||
    canonicalRoot !== clientBuildDirectory
  ) {
    throw new TypeError("The reference host client build directory is unsafe.");
  }
  const files = new Map<string, StaticFile>();
  let aggregateBytes = 0;
  let directoryCount = 0;
  let entryCount = 0;
  async function visit(directory: string, prefix: string, depth: number): Promise<void> {
    directoryCount += 1;
    if (depth > MAX_STATIC_DEPTH || directoryCount > MAX_STATIC_DIRECTORIES) {
      throw new TypeError("The reference host client build exceeds its fixed limits.");
    }
    const status = await lstat(directory);
    const canonicalDirectory = await realpath(directory);
    if (
      status.isSymbolicLink() ||
      !status.isDirectory() ||
      canonicalDirectory !== directory ||
      (directory !== canonicalRoot && !directory.startsWith(`${canonicalRoot}/`))
    ) {
      throw new TypeError("The reference host client build directory is unsafe.");
    }
    const entries: Dirent[] = [];
    const directoryHandle = await opendir(directory, { bufferSize: 32 });
    for await (const entry of directoryHandle) {
      entryCount += 1;
      if (entryCount > MAX_STATIC_ENTRIES) {
        throw new TypeError("The reference host client build exceeds its fixed limits.");
      }
      entries.push(entry);
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      if (
        entry.name.length === 0 ||
        entry.name === "." ||
        entry.name === ".." ||
        entry.name.includes("/") ||
        entry.name.includes("\\")
      ) {
        throw new TypeError("The reference host client build directory is unsafe.");
      }
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const absolute = join(directory, entry.name);
      const entryStatus = await lstat(absolute);
      if (entryStatus.isSymbolicLink()) {
        throw new TypeError("The reference host client build directory is unsafe.");
      }
      if (entryStatus.isDirectory()) {
        await visit(absolute, relative, depth + 1);
        continue;
      }
      if (!entryStatus.isFile() || entryStatus.nlink !== 1) {
        throw new TypeError("The reference host client build directory is unsafe.");
      }
      const mediaType = mediaTypeFor(relative);
      if (mediaType === undefined) {
        throw new TypeError("The reference host client build contains an unsupported file.");
      }
      aggregateBytes += entryStatus.size;
      if (files.size + 1 > MAX_STATIC_FILES || aggregateBytes > MAX_STATIC_AGGREGATE_BYTES) {
        throw new TypeError("The reference host client build exceeds its fixed limits.");
      }
      files.set(
        `/${relative}`,
        Object.freeze({
          bytes: await securelyReadStaticFile(absolute, canonicalRoot),
          mediaType,
          immutable: relative.startsWith("assets/"),
        }),
      );
    }
  }
  await visit(canonicalRoot, "", 0);
  const index = files.get("/index.html");
  if (index === undefined || index.mediaType !== "text/html; charset=utf-8") {
    throw new TypeError("The reference host client build has no index document.");
  }
  files.set("/", index);
  files.set(HOME_PATH, index);
  return files;
}

function singleHeader(request: IncomingMessage, name: string): string | undefined {
  let count = 0;
  let value: string | undefined;
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === name) {
      count += 1;
      value = request.rawHeaders[index + 1];
    }
  }
  return count === 1 ? value : undefined;
}

function hasHeader(request: IncomingMessage, name: string): boolean {
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === name) return true;
  }
  return false;
}

function requestOriginAndHostAreClosed(
  request: IncomingMessage,
  origin: string,
  host: string,
): boolean {
  const candidateHost = singleHeader(request, "host");
  if (candidateHost !== host) return false;
  if (hasHeader(request, "origin") && singleHeader(request, "origin") !== origin) return false;
  return true;
}

function requestFetchSiteIsOneOf(request: IncomingMessage, allowed: readonly string[]): boolean {
  if (!hasHeader(request, "sec-fetch-site")) return true;
  const fetchSite = singleHeader(request, "sec-fetch-site");
  return fetchSite !== undefined && allowed.includes(fetchSite);
}

async function hasZeroBody(request: IncomingMessage): Promise<boolean> {
  if (
    hasHeader(request, "transfer-encoding") ||
    hasHeader(request, "content-type") ||
    hasHeader(request, "content-encoding")
  ) {
    return false;
  }
  const contentLength = hasHeader(request, "content-length")
    ? singleHeader(request, "content-length")
    : undefined;
  if (hasHeader(request, "content-length") && contentLength === undefined) return false;
  if (contentLength !== undefined && contentLength !== "0") return false;
  try {
    for await (const chunk of request) {
      if (!Buffer.isBuffer(chunk) || chunk.byteLength > 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function secureHeaders(response: ServerResponse): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-security-policy", CONTENT_SECURITY_POLICY);
  response.setHeader("cross-origin-resource-policy", "same-origin");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
}

function empty(response: ServerResponse, statusCode: number): void {
  response.statusCode = statusCode;
  response.setHeader("content-length", "0");
  response.end();
}

function staticResponse(response: ServerResponse, method: string, file: StaticFile): void {
  response.statusCode = 200;
  response.setHeader(
    "cache-control",
    file.immutable ? "public, max-age=31536000, immutable" : "no-store",
  );
  response.setHeader("content-type", file.mediaType);
  response.setHeader("content-length", String(file.bytes.byteLength));
  response.end(method === "HEAD" ? undefined : file.bytes);
}

function captureOptions(value: unknown): OpenReferenceHostWebServerOptions | undefined {
  const captured = exactOwnDataRecord(value, [
    "rootDirectory",
    "installedPackageDirectory",
    "clientBuildDirectory",
    "controlPlaneOrigin",
    "controlPlaneApiToken",
    "channelName",
  ]);
  if (
    typeof captured?.rootDirectory !== "string" ||
    typeof captured.installedPackageDirectory !== "string" ||
    typeof captured.clientBuildDirectory !== "string" ||
    typeof captured.controlPlaneOrigin !== "string" ||
    typeof captured.controlPlaneApiToken !== "string" ||
    typeof captured.channelName !== "string"
  ) {
    return undefined;
  }
  return Object.freeze({
    rootDirectory: captured.rootDirectory,
    installedPackageDirectory: captured.installedPackageDirectory,
    clientBuildDirectory: captured.clientBuildDirectory,
    controlPlaneOrigin: captured.controlPlaneOrigin,
    controlPlaneApiToken: captured.controlPlaneApiToken,
    channelName: captured.channelName,
  });
}

/**
 * Opens the loopback Web reference host over a fixed static build and fixed DESEN channel.
 *
 * @remarks Opening performs no network listen. The bearer secret remains captured only inside the
 * server-side channel client and is never reflected into static bytes, response bodies or errors.
 *
 * @throws {TypeError} When trusted configuration, static build, or installed package is unsafe.
 */
export async function openReferenceHostWebServer(
  options: OpenReferenceHostWebServerOptions,
): Promise<ReferenceHostWebServer> {
  const captured = captureOptions(options);
  if (captured === undefined) {
    throw new TypeError("The reference host Web server configuration is invalid.");
  }
  let staticFiles: ReadonlyMap<string, StaticFile>;
  try {
    staticFiles = await loadStaticFiles(captured.clientBuildDirectory);
  } catch (error) {
    if (error instanceof TypeError) throw error;
    // eslint-disable-next-line preserve-caught-error -- Filesystem details are redacted by design.
    throw new TypeError("The reference host client build directory is invalid.");
  }
  let controller: ReferenceHostChannelActivationController | undefined;
  controller = await openReferenceHostChannelActivationController({
    rootDirectory: captured.rootDirectory,
    installedPackageDirectory: captured.installedPackageDirectory,
    controlPlaneOrigin: captured.controlPlaneOrigin,
    controlPlaneApiToken: captured.controlPlaneApiToken,
    channelName: captured.channelName,
  });

  let closed = false;
  let listening: ReferenceHostWebServerListenResult | undefined;
  let listenInFlight: Promise<ReferenceHostWebServerListenResult> | undefined;
  let closeInFlight: Promise<void> | undefined;
  const httpServer = createServer((request, response) => {
    void (async () => {
      secureHeaders(response);
      const activeController = controller;
      const listener = listening;
      if (closed || activeController === undefined || listener === undefined) {
        empty(response, 503);
        return;
      }
      const host = `${listener.address}:${String(listener.port)}`;
      if (!requestOriginAndHostAreClosed(request, listener.origin, host)) {
        empty(response, 403);
        return;
      }
      const target = request.url;
      if (
        target === undefined ||
        target.length === 0 ||
        target.length > 4_096 ||
        target.includes("?") ||
        target.includes("#") ||
        target.includes("%") ||
        target.includes("\\")
      ) {
        empty(response, 400);
        return;
      }
      if (target === REFRESH_PATH) {
        if (!requestFetchSiteIsOneOf(request, ["same-origin"])) {
          empty(response, 403);
          return;
        }
        if (request.method !== "POST") {
          response.setHeader("allow", "POST");
          empty(response, 405);
          return;
        }
        if (!(await hasZeroBody(request))) {
          empty(response, 400);
          return;
        }
        await activeController.refresh();
        if (closed || controller !== activeController) {
          empty(response, 503);
          return;
        }
        const delivery = readReferenceHostDeliveryBytes(activeController);
        if (delivery === undefined) {
          empty(response, 204);
          return;
        }
        response.statusCode = 200;
        response.setHeader("content-type", JSON_MEDIA_TYPE);
        response.setHeader("content-length", String(delivery.bytes.byteLength));
        response.setHeader("etag", delivery.etag);
        response.end(delivery.bytes);
        return;
      }
      if (!requestFetchSiteIsOneOf(request, ["same-origin", "none"])) {
        empty(response, 403);
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("allow", "GET, HEAD");
        empty(response, 405);
        return;
      }
      if (
        hasHeader(request, "transfer-encoding") ||
        hasHeader(request, "content-type") ||
        hasHeader(request, "content-encoding") ||
        (hasHeader(request, "content-length") && singleHeader(request, "content-length") !== "0")
      ) {
        empty(response, 400);
        return;
      }
      const file = staticFiles.get(target);
      if (file === undefined) {
        empty(response, 404);
        return;
      }
      staticResponse(response, request.method, file);
    })().catch(() => {
      if (!response.headersSent) secureHeaders(response);
      if (!response.writableEnded) empty(response, 503);
    });
  });
  httpServer.requestTimeout = 15_000;
  httpServer.headersTimeout = 10_000;
  httpServer.keepAliveTimeout = 5_000;
  httpServer.on("clientError", (_error, socket) => socket.destroy());
  httpServer.on("error", () => undefined);

  return Object.freeze({
    listen(port = 0): Promise<ReferenceHostWebServerListenResult> {
      if (
        closed ||
        listening !== undefined ||
        listenInFlight !== undefined ||
        !Number.isSafeInteger(port) ||
        port < 0 ||
        port > 65_535
      ) {
        return Promise.reject(new TypeError("The reference host listen request is invalid."));
      }
      const opening = new Promise<ReferenceHostWebServerListenResult>((resolve, reject) => {
        const onError = () => {
          httpServer.off("listening", onListening);
          reject(new TypeError("The reference host listener could not be opened."));
        };
        const onListening = () => {
          httpServer.off("error", onError);
          if (closed) {
            httpServer.close(() => reject(new TypeError("The reference host server is closed.")));
            return;
          }
          const address = httpServer.address();
          if (
            address === null ||
            typeof address === "string" ||
            address.address !== LOOPBACK_ADDRESS
          ) {
            void Promise.resolve(httpServer.close()).finally(() => {
              reject(new TypeError("The reference host listener identity is invalid."));
            });
            return;
          }
          listening = Object.freeze({
            address: LOOPBACK_ADDRESS,
            port: address.port,
            origin: `http://${LOOPBACK_ADDRESS}:${String(address.port)}`,
          });
          resolve(listening);
        };
        httpServer.once("error", onError);
        httpServer.once("listening", onListening);
        httpServer.listen(port, LOOPBACK_ADDRESS);
      });
      const tracked = opening.finally(() => {
        if (listenInFlight === tracked) listenInFlight = undefined;
      });
      listenInFlight = tracked;
      return tracked;
    },
    close(): Promise<void> {
      if (closeInFlight !== undefined) return closeInFlight;
      closed = true;
      controller?.close();
      controller = undefined;
      listening = undefined;
      closeInFlight = (async () => {
        await listenInFlight?.catch(() => undefined);
        if (!httpServer.listening) return;
        await new Promise<void>((resolve) => {
          httpServer.close(() => resolve());
          httpServer.closeAllConnections();
        });
      })();
      return closeInFlight;
    },
  });
}
