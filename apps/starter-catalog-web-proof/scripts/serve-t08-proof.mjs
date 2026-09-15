import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4191;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PACKAGE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const configuredProofTemp = process.env.DESEN_M10A_T08_PROOF_TEMP;
if (
  configuredProofTemp !== undefined &&
  (!isAbsolute(configuredProofTemp) ||
    resolve(configuredProofTemp) !== configuredProofTemp ||
    configuredProofTemp.includes("\0"))
) {
  throw new TypeError("DESEN_M10A_T08_PROOF_TEMP must be a canonical absolute directory.");
}
const DIST_ROOT = await realpath(
  configuredProofTemp === undefined
    ? join(PACKAGE_ROOT, "dist")
    : resolve(configuredProofTemp, "dist"),
);
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function resolveRequest(pathname) {
  if (pathname === "/" || pathname === "/t08-authoring.html") {
    return join(DIST_ROOT, "t08-authoring", "t08-authoring.html");
  }
  if (pathname === "/t08-host.html") return join(DIST_ROOT, "t08-host", "t08-host.html");
  if (pathname === "/t08-authoring-graph-proof.json") {
    return join(DIST_ROOT, "t08-authoring", "t08-authoring-graph-proof.json");
  }
  if (pathname === "/t08-host-graph-proof.json") {
    return join(DIST_ROOT, "t08-host", "t08-host-graph-proof.json");
  }
  if (pathname.startsWith("/t08-authoring-assets/")) {
    return join(DIST_ROOT, "t08-authoring", normalize(pathname.slice(1)));
  }
  if (pathname.startsWith("/t08-host-assets/")) {
    return join(DIST_ROOT, "t08-host", normalize(pathname.slice(1)));
  }
  return undefined;
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }
  try {
    const requestUrl = new URL(request.url ?? "/", ORIGIN);
    if (requestUrl.origin !== ORIGIN) throw new TypeError("Unexpected T08 proof origin");
    const filePath = resolveRequest(requestUrl.pathname);
    if (filePath === undefined || !filePath.startsWith(`${DIST_ROOT}${sep}`)) {
      throw new TypeError("Unknown T08 proof asset");
    }
    const entry = await lstat(filePath);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new TypeError("Unsafe T08 proof asset");
    const canonicalFilePath = await realpath(filePath);
    if (!canonicalFilePath.startsWith(`${DIST_ROOT}${sep}`)) {
      throw new TypeError("T08 proof asset escaped its distribution root");
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": CONTENT_TYPES.get(extname(canonicalFilePath)) ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(canonicalFilePath).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`DESEN M10A-T08 proof listening on ${ORIGIN}\n`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
