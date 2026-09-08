import { resolve } from "node:path";
import process from "node:process";

import { startDesenAppLocalDemo } from "../desen-app/dev/local-demo-host.mjs";

// Only an IPC-owning browser fixture may run this wrapper. Human seed/reset uses the normal
// CLI; both paths call the same lifecycle and fixed app-owned demo namespace.
if (typeof process.send !== "function") {
  process.stderr.write("The repeatable demo proof requires an owning lifecycle.\n");
  process.exit(1);
}

let demo;
let starting;
let shutdownPromise;
let shutdownFailed = false;

function send(message) {
  return new Promise((resolveSent, rejectSent) => {
    if (!process.connected || typeof process.send !== "function") {
      rejectSent(new Error("The demo proof owner is unavailable."));
      return;
    }
    process.send(message, (error) => {
      if (error === null) resolveSent();
      else rejectSent(new Error("The demo proof owner is unavailable."));
    });
  });
}

function shutdown(failed = false) {
  shutdownFailed ||= failed;
  shutdownPromise ??= (async () => {
    try {
      // Shutdown can arrive during Vite startup. Drain that same startup before closing its
      // returned handle so no late listener or on-disk lease survives its owning child.
      await starting;
      await demo?.close();
      await send({ status: "stopped" });
      process.exit(shutdownFailed ? 1 : 0);
    } catch {
      process.exit(1);
    }
  })();
  return shutdownPromise;
}

process.on("message", (message) => {
  if (
    message === null ||
    typeof message !== "object" ||
    Object.getPrototypeOf(message) !== Object.prototype ||
    Reflect.ownKeys(message).length !== 1 ||
    message.command !== "shutdown"
  ) {
    void shutdown(true);
    return;
  }
  void shutdown();
});
process.once("disconnect", () => void shutdown());
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, () => void shutdown());

try {
  starting = startDesenAppLocalDemo({
    workspaceDirectory: resolve(import.meta.dirname, "../.."),
    reset: true,
  }).then((started) => {
    demo = started;
    return started;
  });
  await starting;
  if (shutdownPromise !== undefined) await shutdownPromise;
  if (
    demo.appOrigin !== "http://127.0.0.1:5173" ||
    typeof demo.referenceHostOrigin !== "string" ||
    !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/u.test(demo.referenceHostOrigin)
  ) {
    throw new Error("The normal demo composition has no independent host.");
  }
  await send({
    status: "ready",
    pid: process.pid,
    appOrigin: demo.appOrigin,
    referenceHostOrigin: demo.referenceHostOrigin,
  });
} catch {
  try {
    await demo?.close();
    await send({ status: "failed" });
  } finally {
    process.exit(1);
  }
}
