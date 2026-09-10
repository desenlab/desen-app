import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4187;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PACKAGE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST_ROOT = await realpath(join(PACKAGE_ROOT, "dist"));

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function resolveRequest(pathname) {
  if (pathname === "/" || pathname === "/authoring.html") {
    return join(DIST_ROOT, "authoring", "authoring.html");
  }
  if (pathname === "/host.html") return join(DIST_ROOT, "host", "host.html");
  if (pathname === "/authoring-graph-proof.json") {
    return join(DIST_ROOT, "authoring", "authoring-graph-proof.json");
  }
  if (pathname === "/host-graph-proof.json") {
    return join(DIST_ROOT, "host", "host-graph-proof.json");
  }
  if (pathname.startsWith("/authoring-assets/")) {
    return join(DIST_ROOT, "authoring", normalize(pathname.slice(1)));
  }
  if (pathname.startsWith("/host-assets/")) {
    return join(DIST_ROOT, "host", normalize(pathname.slice(1)));
  }
  return undefined;
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, {
      allow: "GET, HEAD",
      "content-type": "text/plain; charset=utf-8",
    });
    response.end("Method not allowed");
    return;
  }
  try {
    const requestUrl = new URL(request.url ?? "/", ORIGIN);
    if (requestUrl.origin !== ORIGIN) throw new TypeError("Unexpected proof origin");
    const filePath = resolveRequest(requestUrl.pathname);
    if (filePath === undefined || !filePath.startsWith(`${DIST_ROOT}${sep}`)) {
      throw new TypeError("Unknown proof asset");
    }
    const entry = await lstat(filePath);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new TypeError("Unsafe proof asset");
    const canonicalFilePath = await realpath(filePath);
    if (!canonicalFilePath.startsWith(`${DIST_ROOT}${sep}`)) {
      throw new TypeError("Proof asset escaped its distribution root");
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
  process.stdout.write(`DESEN starter proof listening on http://127.0.0.1:${PORT}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
