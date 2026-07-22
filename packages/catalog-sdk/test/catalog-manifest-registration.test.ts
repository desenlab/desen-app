import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import { createCatalogManifest, registerComponent } from "../src/index.js";

import type { CreateCatalogManifestInput } from "../src/index.js";

const PACKAGE_DIGEST = `sha256:${"0".repeat(64)}`;

function createRichComponentInput() {
  return {
    id: "com.example.ui/Button",
    manifest: {
      description: "Accessible action button.",
      category: "action",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        properties: {
          label: { type: "string" },
          disabled: { type: "boolean" },
        },
      },
      slots: {
        leading: {
          maxItems: 1,
          acceptsCategories: ["content"],
          description: "Optional leading content.",
        },
      },
      events: {
        press: {
          description: "Emitted when the action is requested.",
          payloadSchema: { type: "object", additionalProperties: false },
        },
      },
      commands: {
        focus: {
          description: "Requests semantic focus.",
          inputSchema: { type: "object", additionalProperties: false },
        },
      },
      styleParts: {
        root: {
          description: "Stable outer action surface.",
          propertiesSchema: { type: "object", additionalProperties: false },
        },
      },
      visualStates: ["focus", "disabled"],
      authoring: {
        displayName: "Button",
        category: "Actions",
        icon: "button",
        defaultProps: { label: "Continue", disabled: false },
        controls: { label: { control: "text" } },
        scenarios: {
          default: {
            props: { label: "Continue" },
            description: "Default authoring state.",
          },
        },
        resize: { horizontal: "hug" as const, vertical: "hug" as const },
        adapterFidelity: "same" as const,
      },
      deprecated: false,
      replacement: "com.example.ui/PrimaryButton",
      extensions: { "com.example.audit/owner": "design-system" },
    },
  };
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Object.keys(value)) {
    expectDeeplyFrozen((value as Record<string, unknown>)[key]);
  }
}

function createCatalogInput(components: CreateCatalogManifestInput["components"]) {
  return {
    id: "com.example.catalog",
    version: "1.0.0",
    target: "web-react",
    packageDigest: PACKAGE_DIGEST,
    description: "Example component package.",
    components,
    authoring: { publisher: "example" },
    extensions: { "com.example/release": "alpha" },
  };
}

describe("component manifest registration", () => {
  it("preserves the complete manifest as detached, deeply frozen JSON data", () => {
    const input = createRichComponentInput();
    const originalText = canonicalizeJson(input);
    const registration = registerComponent(input);

    expect(registration).toEqual(input);
    expect(canonicalizeJson(registration)).toBe(originalText);
    expect(registration).not.toBe(input);
    expect(registration.manifest).not.toBe(input.manifest);
    expectDeeplyFrozen(registration);

    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.manifest)).toBe(false);
    input.manifest.description = "Caller mutation";
    input.manifest.propsSchema.properties.label.type = "number";
    input.manifest.visualStates.push("pressed");

    expect(registration.manifest.description).toBe("Accessible action button.");
    expect(registration.manifest.propsSchema.properties.label.type).toBe("string");
    expect(registration.manifest.visualStates).toEqual(["focus", "disabled"]);
  });

  it("normalizes object key order deterministically while preserving array order", () => {
    const first = registerComponent({
      id: "com.example.ui/Text",
      manifest: {
        description: "Text",
        propsSchema: {
          type: "object",
          properties: { z: { type: "number" }, a: { type: "string" } },
          required: ["z", "a"],
        },
      },
    });
    const second = registerComponent({
      manifest: {
        propsSchema: {
          required: ["z", "a"],
          properties: { a: { type: "string" }, z: { type: "number" } },
          type: "object",
        },
        description: "Text",
      },
      id: "com.example.ui/Text",
    });
    const reversedArray = registerComponent({
      id: "com.example.ui/Text",
      manifest: {
        description: "Text",
        propsSchema: {
          type: "object",
          properties: { z: { type: "number" }, a: { type: "string" } },
          required: ["a", "z"],
        },
      },
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(reversedArray));
  });

  it("rejects unknown wrapper fields and non-JSON values without invoking accessors", () => {
    expect(() =>
      registerComponent({
        id: "com.example.ui/Text",
        manifest: { propsSchema: {} },
        production: null,
      } as never),
    ).toThrow(/expected only id, manifest/u);

    let getterInvoked = false;
    const accessor = Object.defineProperty({}, "danger", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return "changed";
      },
    });
    expect(() =>
      registerComponent({
        id: "com.example.ui/Text",
        manifest: { propsSchema: {}, extensions: accessor },
      } as never),
    ).toThrow(TypeError);
    expect(getterInvoked).toBe(false);

    class CustomValue {
      readonly value = true;
    }
    const unsupported = [
      undefined,
      () => true,
      Symbol("value"),
      1n,
      Number.NaN,
      Infinity,
      new Date(0),
      new Map([["key", "value"]]),
      new Set(["value"]),
      /value/u,
      new CustomValue(),
      Object.freeze(new Date(0)),
      Object.freeze(new Map([["key", "value"]])),
    ];
    for (const value of unsupported) {
      expect(() =>
        registerComponent({
          id: "com.example.ui/Text",
          manifest: { propsSchema: {}, extensions: { value } },
        } as never),
      ).toThrow(TypeError);
    }

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() =>
      registerComponent({
        id: "com.example.ui/Text",
        manifest: { propsSchema: {}, extensions: cycle },
      } as never),
    ).toThrow(TypeError);

    const sparse = new Array(1);
    const withExtra = Object.assign([], { extra: true });
    for (const value of [sparse, withExtra]) {
      expect(() =>
        registerComponent({
          id: "com.example.ui/Text",
          manifest: { propsSchema: {}, extensions: { value } },
        } as never),
      ).toThrow(TypeError);
    }

    const hidden = { visible: true };
    Object.defineProperty(hidden, "hidden", { enumerable: false, value: true });
    const symbolProperty = { visible: true };
    Object.defineProperty(symbolProperty, Symbol("hidden"), { value: true });
    const launderPrototype = <Value extends object>(value: Value): Value => {
      Object.setPrototypeOf(value, Object.prototype);
      return value;
    };
    for (const value of [hidden, symbolProperty]) {
      expect(() =>
        registerComponent({
          id: "com.example.ui/Text",
          manifest: { propsSchema: {}, extensions: { value } },
        } as never),
      ).toThrow(TypeError);
    }

    const prototypeLaundered = [
      launderPrototype(new Date(0)),
      launderPrototype(new Map([["key", "value"]])),
      launderPrototype(new Set(["value"])),
      launderPrototype(new WeakMap([[{}, "value"]])),
      launderPrototype(new WeakSet([{}])),
      launderPrototype(new Uint8Array([1, 2, 3])),
      launderPrototype(new ArrayBuffer(4)),
      launderPrototype(new SharedArrayBuffer(4)),
      launderPrototype(new DataView(new ArrayBuffer(4))),
      launderPrototype(new Boolean(true)),
      launderPrototype(new Number(1)),
      launderPrototype(new String("value")),
      launderPrototype(Object(1n) as object),
      launderPrototype(Object(Symbol("value")) as object),
      launderPrototype(/value/u),
      launderPrototype(new WeakRef({})),
      launderPrototype(new FinalizationRegistry(() => undefined)),
    ];
    for (const value of prototypeLaundered) {
      expect(() =>
        registerComponent({
          id: "com.example.ui/Text",
          manifest: { propsSchema: {}, extensions: { value } },
        } as never),
      ).toThrow(TypeError);
    }
  });

  it("preserves dangerous-looking extension keys as opaque JSON members", () => {
    const extensions = JSON.parse(
      '{"__proto__":{"polluted":false},"constructor":"data","prototype":"data"}',
    ) as {
      readonly __proto__: { readonly polluted: boolean };
      readonly constructor: string;
      readonly prototype: string;
    };
    const registration = registerComponent({
      id: "com.example.ui/Text",
      manifest: { propsSchema: {}, extensions },
    });

    expect(Object.hasOwn(registration.manifest.extensions ?? {}, "__proto__")).toBe(true);
    expect(registration.manifest.extensions).toEqual(extensions);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe("Catalog manifest composition", () => {
  it("builds the exact protocol root with empty later-category maps", () => {
    const registration = registerComponent(createRichComponentInput());
    const input = createCatalogInput([registration]);
    const catalog = createCatalogManifest(input);

    expect(catalog).toEqual({
      kind: "desen.catalog",
      desen: "0.1.0",
      id: input.id,
      version: input.version,
      target: input.target,
      packageDigest: input.packageDigest,
      description: input.description,
      components: { [registration.id]: registration.manifest },
      behaviors: {},
      operations: {},
      resources: {},
      authoring: input.authoring,
      extensions: input.extensions,
    });
    expectDeeplyFrozen(catalog);
    expect(catalog).not.toBe(input);
    expect(catalog.components[registration.id]).not.toBe(registration.manifest);
  });

  it("rejects duplicate ids even when their manifests are identical", () => {
    const registration = registerComponent({
      id: "com.example.ui/Text",
      manifest: { propsSchema: {} },
    });

    expect(() => createCatalogManifest(createCatalogInput([registration, registration]))).toThrow(
      /duplicate component id "com\.example\.ui\/Text"/u,
    );
  });

  it("treats capability ids as exact, case-sensitive strings", () => {
    const upper = registerComponent({
      id: "com.example.ui/Text",
      manifest: { propsSchema: {} },
    });
    const lower = registerComponent({
      id: "com.example.ui/text",
      manifest: { propsSchema: {} },
    });

    const catalog = createCatalogManifest(createCatalogInput([upper, lower]));
    expect(Object.keys(catalog.components)).toEqual(["com.example.ui/Text", "com.example.ui/text"]);
  });

  it("rejects unknown Catalog builder fields and forged registration records", () => {
    const registration = registerComponent({
      id: "com.example.ui/Text",
      manifest: { propsSchema: {} },
    });
    expect(() =>
      createCatalogManifest({
        ...createCatalogInput([registration]),
        behaviors: {},
      } as never),
    ).toThrow(/unknown registration field/u);
    expect(() =>
      createCatalogManifest({
        ...createCatalogInput([]),
        components: [{ id: registration.id, manifest: registration.manifest, adapter: null }],
      } as never),
    ).toThrow(/expected only id and manifest/u);
  });
});
