import { describe, expect, it } from "vitest";

import { RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS } from "../src/registry.js";
import { createRuntimeReactReconciliationKey } from "../src/reconciliation.js";

import type { RuntimeJsonObject } from "@desen/runtime-core";
import type { RuntimeReactReconciliationKeyInput } from "../src/reconciliation.js";

function key(
  props: RuntimeJsonObject,
  remountOnProps: readonly string[] = [],
  runtimeNodeId = "node:1",
  capabilityId = "com.example.ui/Text",
): string {
  return createRuntimeReactReconciliationKey({
    runtimeNodeId,
    capabilityId,
    props,
    remountOnProps,
  });
}

describe("React reconciliation keys", () => {
  it("preserves instances across ordinary prop changes when no remount policy is declared", () => {
    expect(key({ label: "first", nested: { a: 1 } })).toBe(
      key({ label: "second", nested: { a: 999 }, additional: true }),
    );
  });

  it("projects only declared properties and distinguishes missing from present null", () => {
    const missing = key({ ordinary: "ignored" }, ["mode"]);
    const presentNull = key({ mode: null, ordinary: "ignored" }, ["mode"]);
    const presentValue = key({ mode: "compact", ordinary: "ignored" }, ["mode"]);

    expect(missing).not.toBe(presentNull);
    expect(presentNull).not.toBe(presentValue);
    expect(presentValue).toBe(key({ mode: "compact", ordinary: "changed" }, ["mode"]));
    expect(JSON.parse(missing)).toMatchObject({
      remountProps: [{ name: "mode", presence: "missing" }],
    });
    expect(JSON.parse(presentNull)).toMatchObject({
      remountProps: [{ name: "mode", presence: "present", value: null }],
    });
  });

  it("uses RFC 8785 semantic object ordering and a canonical policy ordering", () => {
    const first = key(
      {
        config: {
          z: 1,
          a: { beta: true, alpha: false },
        },
        mode: "wide",
      },
      ["mode", "config"],
    );
    const second = key(
      {
        mode: "wide",
        config: {
          a: { alpha: false, beta: true },
          z: 1,
        },
      },
      ["config", "mode"],
    );

    expect(first).toBe(second);
    expect(first).toBe(JSON.stringify(JSON.parse(first)));
  });

  it("frames runtime identity and capability without concatenation collisions", () => {
    const first = key({}, [], "ab", "c");
    const second = key({}, [], "a", "bc");
    const third = key({}, [], "ab", "different");

    expect(first).not.toBe(second);
    expect(first).not.toBe(third);
    expect(JSON.parse(first)).toMatchObject({
      capabilityId: "c",
      runtimeNodeId: "ab",
    });
  });

  it("does not read undeclared accessors but rejects a selected accessor without invoking it", () => {
    let calls = 0;
    const props = { stable: "yes" } as Record<string, unknown>;
    Object.defineProperty(props, "hostile", {
      enumerable: true,
      get() {
        calls += 1;
        return "never";
      },
    });

    expect(() => key(props as RuntimeJsonObject, [])).not.toThrow();
    expect(() => key(props as RuntimeJsonObject, ["hostile"])).toThrow(
      /selected prop "hostile" is not own data/u,
    );
    expect(calls).toBe(0);
  });

  it("rejects hostile input envelopes, accessors, symbols, and class instances", () => {
    const valid = {
      runtimeNodeId: "node:1",
      capabilityId: "com.example.ui/Text",
      props: {},
      remountOnProps: [],
    };
    let calls = 0;
    const accessor = { ...valid };
    Object.defineProperty(accessor, "runtimeNodeId", {
      enumerable: true,
      get() {
        calls += 1;
        return "node:1";
      },
    });
    const symbolic = { ...valid };
    Object.defineProperty(symbolic, Symbol("hidden"), { value: true });
    class InputEnvelope {
      readonly runtimeNodeId = valid.runtimeNodeId;
      readonly capabilityId = valid.capabilityId;
      readonly props = valid.props;
      readonly remountOnProps = valid.remountOnProps;
    }
    const revoked = Proxy.revocable(valid, {});
    revoked.revoke();

    for (const candidate of [accessor, symbolic, new InputEnvelope(), revoked.proxy]) {
      expect(() =>
        createRuntimeReactReconciliationKey(candidate as RuntimeReactReconciliationKeyInput),
      ).toThrow(TypeError);
    }
    expect(calls).toBe(0);
  });

  it("rejects hostile, sparse, symbolic, duplicate, subclass, and oversized policy arrays", () => {
    const accessor = ["safe"];
    let calls = 0;
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      get() {
        calls += 1;
        return "never";
      },
    });
    const symbolic = ["safe"];
    Object.defineProperty(symbolic, Symbol("hidden"), { value: true });
    const sparse = new Array<string>(1);
    class PolicyArray extends Array<string> {}
    const subclass = new PolicyArray("safe");
    const hidden = ["safe"];
    Object.defineProperty(hidden, "0", { enumerable: false, value: "safe" });
    const oversized = Array.from(
      { length: RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS.maxRemountPropsPerAdapter + 1 },
      (_, index) => `p${String(index)}`,
    );
    const revoked = Proxy.revocable(["safe"], {});
    revoked.revoke();

    for (const remountOnProps of [
      accessor,
      symbolic,
      sparse,
      subclass,
      hidden,
      oversized,
      revoked.proxy,
      ["same", "same"],
      ["\ud800"],
      [1],
    ]) {
      expect(() =>
        createRuntimeReactReconciliationKey({
          runtimeNodeId: "node:1",
          capabilityId: "com.example.ui/Text",
          props: {},
          remountOnProps,
        } as RuntimeReactReconciliationKeyInput),
      ).toThrow(TypeError);
    }
    expect(calls).toBe(0);
  });

  it("rejects non-JSON selected values while ignoring non-selected values", () => {
    const invalid = { selected: Number.POSITIVE_INFINITY, ordinary: Number.NaN };
    expect(() => key(invalid as RuntimeJsonObject, ["selected"])).toThrow(
      /not inert RFC 8785-compatible JSON/u,
    );
    expect(() => key(invalid as RuntimeJsonObject, [])).not.toThrow();
  });
});
