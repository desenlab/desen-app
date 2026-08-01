"use strict";

// CommonJS is required because this file is injected with Node's `--require` preload hook.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dgram = require("node:dgram");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const net = require("node:net");

const INSTALLATION_MARKER = Symbol.for("desen.ci.no-proof-listener.v1");
const LISTENER_ERROR_CODE = "DESEN_CI_LISTENER_FORBIDDEN";

function rejectListener() {
  const error = new Error("Proof workloads may not bind network listeners.");
  error.code = LISTENER_ERROR_CODE;
  throw error;
}

function replaceMethod(prototype, method) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
  if (!descriptor || typeof descriptor.value !== "function") {
    throw new Error(`DESEN proof-listener guard could not secure ${method}.`);
  }
  Object.defineProperty(prototype, method, {
    ...descriptor,
    value: rejectListener,
    writable: false,
    configurable: false,
  });
}

if (globalThis[INSTALLATION_MARKER] !== true) {
  replaceMethod(net.Server.prototype, "listen");
  replaceMethod(dgram.Socket.prototype, "bind");
  Object.defineProperty(globalThis, INSTALLATION_MARKER, {
    value: true,
    writable: false,
    configurable: false,
    enumerable: false,
  });
}
