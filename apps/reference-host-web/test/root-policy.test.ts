import { describe, expect, it, vi } from "vitest";

import { ignoreRuntimeReactRootCaughtError } from "@desen/runtime-react";

import { createReferenceHostRootOptions } from "../src/root-policy.js";

function hostileValue(onTrap: () => void): unknown {
  const target = {};
  return new Proxy(target, {
    get() {
      onTrap();
      throw new Error("raw error data must not be read");
    },
    getOwnPropertyDescriptor() {
      onTrap();
      throw new Error("raw error metadata must not be reflected");
    },
    getPrototypeOf() {
      onTrap();
      throw new Error("raw error provenance must not be inspected");
    },
    ownKeys() {
      onTrap();
      throw new Error("raw error keys must not be inspected");
    },
  });
}

describe("reference-host React root policy", () => {
  it("uses the exact caught-error suppression policy and emits only fixed redacted signals", () => {
    const events: unknown[] = [];
    const options = createReferenceHostRootOptions(
      (diagnostic) => {
        events.push(diagnostic);
      },
      () => {
        events.push("terminally-fenced");
      },
    );
    let traps = 0;
    const error = hostileValue(() => {
      traps += 1;
    });
    const errorInfo = hostileValue(() => {
      traps += 1;
    });

    expect(options.onCaughtError).toBe(ignoreRuntimeReactRootCaughtError);
    expect(Object.isFrozen(options)).toBe(true);

    options.onCaughtError?.(error, errorInfo as never);
    options.onUncaughtError?.(error, errorInfo as never);
    options.onRecoverableError?.(error, errorInfo as never);

    expect(traps).toBe(0);
    expect(events).toEqual([
      "terminally-fenced",
      {
        code: "REFERENCE_HOST_ROOT_UNCAUGHT",
        source: "reference-host-web",
      },
      {
        code: "REFERENCE_HOST_ROOT_RECOVERABLE",
        source: "reference-host-web",
      },
    ]);
    expect(
      events
        .filter((event): event is object => typeof event === "object" && event !== null)
        .every((diagnostic) => Object.isFrozen(diagnostic)),
    ).toBe(true);
  });

  it("contains throwing terminal fencing and observability without changing callback behavior", () => {
    const reporter = vi.fn(() => {
      throw new Error("telemetry unavailable");
    });
    const terminal = vi.fn(() => {
      throw new Error("terminal cleanup unavailable");
    });
    const options = createReferenceHostRootOptions(reporter, terminal);

    expect(() => {
      options.onUncaughtError?.(new Error("private"), {} as never);
      options.onRecoverableError?.(new Error("private"), {} as never);
    }).not.toThrow();
    expect(terminal).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing reporter or terminal fence before creating callback policy", () => {
    expect(() => createReferenceHostRootOptions(undefined as never, () => undefined)).toThrowError(
      "Reference-host root diagnostic reporter must be a function.",
    );
    expect(() => createReferenceHostRootOptions(() => undefined, undefined as never)).toThrowError(
      "Reference-host root terminal failure handler must be a function.",
    );
  });
});
