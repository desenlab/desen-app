import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import {
  createCatalogManifest,
  registerBehavior,
  registerComponent,
  registerOperation,
  registerResource,
} from "../src/index.js";

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

function createRichBehaviorInput() {
  return {
    id: "com.example.interactions/Sortable",
    manifest: {
      description: "Adds sortable interaction mechanics.",
      category: "interaction",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { axis: { enum: ["vertical", "horizontal"] } },
      },
      attachTo: {
        capabilities: ["com.example.ui/Button"],
        categories: ["collection"],
      },
      slots: {
        preview: {
          maxItems: 1,
          acceptsCategories: ["content"],
          description: "Optional drag preview.",
        },
      },
      events: {
        reorder: {
          description: "Emitted with the requested order.",
          payloadSchema: {
            type: "object",
            required: ["ids"],
            properties: { ids: { type: "array", items: { type: "string" } } },
          },
        },
      },
      commands: {
        cancel: {
          description: "Cancels the active gesture.",
          inputSchema: { type: "object", additionalProperties: false },
        },
      },
      styleParts: {
        indicator: {
          description: "Drop indicator.",
          propertiesSchema: { type: "object", additionalProperties: false },
        },
      },
      visualStates: ["dragging", "invalid-target"],
      composition: {
        exclusiveChannels: ["pointer-drag"],
        compatibleWith: ["com.example.interactions/KeyboardSortable"],
      },
      authoring: {
        displayName: "Sortable",
        category: "Interaction",
        defaultProps: { axis: "vertical" },
        scenarios: {
          active: {
            props: { axis: "vertical" },
            state: { dragging: true },
            description: "Active drag preview.",
          },
        },
        adapterFidelity: "equivalent" as const,
      },
      deprecated: false,
      replacement: "com.example.interactions/SortableV2",
      extensions: { "com.example.audit/owner": "interaction-team" },
    },
  };
}

function createRichOperationInput() {
  return {
    id: "com.example.auth/signIn",
    manifest: {
      description: "Authenticates one account through a host-owned implementation.",
      inputSchema: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string" } },
      },
      outputSchema: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string" } },
      },
      errors: [
        { code: "INVALID_CREDENTIALS", description: "Credentials were rejected." },
        { code: "UNAVAILABLE", extensions: { retryable: true } },
      ],
      effect: "network" as const,
      authoring: {
        fixtures: {
          success: { userId: "synthetic-user" },
          invalid: { code: "INVALID_CREDENTIALS" },
        },
        extensions: { "com.example/scenario": "sign-in" },
      },
      deprecated: false,
      replacement: "com.example.auth/signInV2",
      extensions: { "com.example.audit/owner": "identity-team" },
    },
  };
}

function createRichResourceInput() {
  return {
    id: "com.example.stores/list",
    manifest: {
      description: "Reads a host-provided store list.",
      inputSchema: {
        type: "object",
        properties: { region: { type: "string" } },
      },
      outputSchema: {
        type: "array",
        items: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
      errors: [
        { code: "OFFLINE", description: "The host is offline." },
        { code: "UNAVAILABLE", extensions: { retryable: true } },
      ],
      policies: ["mount" as const, "manual" as const, "once" as const],
      cacheHints: {
        ttlSeconds: 60,
        staleWhileRevalidateSeconds: 300,
      },
      authoring: {
        fixtures: {
          default: [{ id: "synthetic-store" }],
        },
        extensions: { "com.example/scenario": "store-list" },
      },
      deprecated: false,
      replacement: "com.example.stores/listV2",
      extensions: { "com.example.audit/owner": "store-team" },
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

describe("behavior, operation, and resource manifest registration", () => {
  it("preserves every category contract as detached, deeply frozen JSON data", () => {
    const behaviorInput = createRichBehaviorInput();
    const operationInput = createRichOperationInput();
    const resourceInput = createRichResourceInput();
    const cases = [
      [behaviorInput, () => registerBehavior(behaviorInput)],
      [operationInput, () => registerOperation(operationInput)],
      [resourceInput, () => registerResource(resourceInput)],
    ] as const;

    for (const [input, createRegistration] of cases) {
      const registration = createRegistration();
      expect(registration).toEqual(input);
      expect(canonicalizeJson(registration)).toBe(canonicalizeJson(input));
      expect(registration).not.toBe(input);
      expect(registration.manifest).not.toBe(input.manifest);
      expectDeeplyFrozen(registration);
      expect(Object.isFrozen(input)).toBe(false);
      expect(Object.isFrozen(input.manifest)).toBe(false);
    }

    const behavior = registerBehavior(behaviorInput);
    const operation = registerOperation(operationInput);
    const resource = registerResource(resourceInput);
    behaviorInput.manifest.description = "Caller mutation";
    behaviorInput.manifest.visualStates.push("caller-state");
    const [firstOperationError] = operationInput.manifest.errors;
    if (firstOperationError === undefined) throw new Error("Operation error fixture is missing.");
    firstOperationError.description = "Caller mutation";
    operationInput.manifest.authoring.fixtures.success.userId = "caller-user";
    resourceInput.manifest.policies.reverse();
    resourceInput.manifest.cacheHints.ttlSeconds = 999;

    expect(behavior.manifest.description).toBe("Adds sortable interaction mechanics.");
    expect(behavior.manifest.visualStates).toEqual(["dragging", "invalid-target"]);
    expect(operation.manifest.errors[0]?.description).toBe("Credentials were rejected.");
    expect(operation.manifest.authoring?.fixtures?.success).toEqual({
      userId: "synthetic-user",
    });
    expect(resource.manifest.policies).toEqual(["mount", "manual", "once"]);
    expect(resource.manifest.cacheHints?.ttlSeconds).toBe(60);
  });

  it("normalizes object key order while preserving behavior, error, and policy array order", () => {
    const operation = registerOperation(createRichOperationInput());
    const reordered = registerOperation({
      manifest: {
        replacement: "com.example.auth/signInV2",
        outputSchema: {
          properties: { userId: { type: "string" } },
          required: ["userId"],
          type: "object",
        },
        inputSchema: {
          properties: { email: { type: "string" } },
          required: ["email"],
          type: "object",
        },
        extensions: { "com.example.audit/owner": "identity-team" },
        errors: [
          { description: "Credentials were rejected.", code: "INVALID_CREDENTIALS" },
          { extensions: { retryable: true }, code: "UNAVAILABLE" },
        ],
        effect: "network",
        description: "Authenticates one account through a host-owned implementation.",
        deprecated: false,
        authoring: {
          extensions: { "com.example/scenario": "sign-in" },
          fixtures: {
            invalid: { code: "INVALID_CREDENTIALS" },
            success: { userId: "synthetic-user" },
          },
        },
      },
      id: "com.example.auth/signIn",
    });
    const reversedErrors = registerOperation({
      ...createRichOperationInput(),
      manifest: {
        ...createRichOperationInput().manifest,
        errors: [...createRichOperationInput().manifest.errors].reverse(),
      },
    });

    expect(JSON.stringify(operation)).toBe(JSON.stringify(reordered));
    expect(JSON.stringify(operation)).not.toBe(JSON.stringify(reversedErrors));

    const resource = registerResource(createRichResourceInput());
    const reversedPolicies = registerResource({
      ...createRichResourceInput(),
      manifest: {
        ...createRichResourceInput().manifest,
        policies: ["once", "manual", "mount"],
      },
    });
    expect(JSON.stringify(resource)).not.toBe(JSON.stringify(reversedPolicies));
  });

  it("rejects executable wrapper fields for every new manifest category", () => {
    const cases = [
      () =>
        registerBehavior({
          ...createRichBehaviorInput(),
          production: null,
        } as never),
      () =>
        registerOperation({
          ...createRichOperationInput(),
          execute: null,
        } as never),
      () =>
        registerResource({
          ...createRichResourceInput(),
          read: null,
        } as never),
    ] as const;

    for (const operation of cases) {
      expect(operation).toThrow(/expected only id, manifest/u);
    }
  });

  it("rejects non-JSON nested values without invoking accessors", () => {
    let accessorInvoked = false;
    const accessor = Object.defineProperty({}, "danger", {
      enumerable: true,
      get() {
        accessorInvoked = true;
        return "changed";
      },
    });
    const cases = [
      () =>
        registerBehavior({
          id: "com.example.interactions/Hostile",
          manifest: {
            propsSchema: {},
            attachTo: { categories: ["content"] },
            extensions: accessor,
          },
        } as never),
      () =>
        registerOperation({
          id: "com.example.operations/Hostile",
          manifest: {
            inputSchema: {},
            outputSchema: {},
            errors: [],
            effect: "none",
            extensions: { implementation: () => null },
          },
        } as never),
      () =>
        registerResource({
          id: "com.example.resources/Hostile",
          manifest: {
            inputSchema: {},
            outputSchema: {},
            errors: [],
            policies: ["manual"],
            extensions: { reader: new Map() },
          },
        } as never),
    ] as const;

    for (const operation of cases) {
      expect(operation).toThrow(TypeError);
    }
    expect(accessorInvoked).toBe(false);
  });

  it("preserves every schema-authoritative field without executable bindings", () => {
    const behavior = registerBehavior(createRichBehaviorInput());
    const operation = registerOperation(createRichOperationInput());
    const resource = registerResource(createRichResourceInput());

    expect(Object.keys(behavior.manifest)).toEqual([
      "attachTo",
      "authoring",
      "category",
      "commands",
      "composition",
      "deprecated",
      "description",
      "events",
      "extensions",
      "propsSchema",
      "replacement",
      "slots",
      "styleParts",
      "visualStates",
    ]);
    expect(Object.keys(operation.manifest)).toEqual([
      "authoring",
      "deprecated",
      "description",
      "effect",
      "errors",
      "extensions",
      "inputSchema",
      "outputSchema",
      "replacement",
    ]);
    expect(Object.keys(resource.manifest)).toEqual([
      "authoring",
      "cacheHints",
      "deprecated",
      "description",
      "errors",
      "extensions",
      "inputSchema",
      "outputSchema",
      "policies",
      "replacement",
    ]);
    expect("execute" in operation).toBe(false);
    expect("read" in resource).toBe(false);
    expect("production" in behavior).toBe(false);
  });
});

describe("Catalog manifest composition", () => {
  it("preserves the component-only call shape with empty optional-category maps", () => {
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

  it("builds all four exact capability maps without retaining registrations", () => {
    const component = registerComponent(createRichComponentInput());
    const behavior = registerBehavior(createRichBehaviorInput());
    const operation = registerOperation(createRichOperationInput());
    const resource = registerResource(createRichResourceInput());
    const input = {
      ...createCatalogInput([component]),
      description: "Complete capability package.",
      behaviors: [behavior],
      operations: [operation],
      resources: [resource],
    };
    const catalog = createCatalogManifest(input);

    expect(catalog).toEqual({
      kind: "desen.catalog",
      desen: "0.1.0",
      id: input.id,
      version: input.version,
      target: input.target,
      packageDigest: input.packageDigest,
      description: input.description,
      components: { [component.id]: component.manifest },
      behaviors: { [behavior.id]: behavior.manifest },
      operations: { [operation.id]: operation.manifest },
      resources: { [resource.id]: resource.manifest },
      authoring: input.authoring,
      extensions: input.extensions,
    });
    expectDeeplyFrozen(catalog);
    expect(catalog.behaviors[behavior.id]).not.toBe(behavior.manifest);
    expect(catalog.operations[operation.id]).not.toBe(operation.manifest);
    expect(catalog.resources[resource.id]).not.toBe(resource.manifest);
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

  it("rejects duplicate ids within every new category", () => {
    const behavior = registerBehavior(createRichBehaviorInput());
    const duplicateBehaviorInput = createRichBehaviorInput();
    const duplicateBehavior = registerBehavior({
      ...duplicateBehaviorInput,
      manifest: {
        ...duplicateBehaviorInput.manifest,
        description: "A distinct behavior registration with the same id.",
      },
    });
    const operation = registerOperation(createRichOperationInput());
    const duplicateOperationInput = createRichOperationInput();
    const duplicateOperation = registerOperation({
      ...duplicateOperationInput,
      manifest: {
        ...duplicateOperationInput.manifest,
        description: "A distinct operation registration with the same id.",
      },
    });
    const resource = registerResource(createRichResourceInput());
    const duplicateResourceInput = createRichResourceInput();
    const duplicateResource = registerResource({
      ...duplicateResourceInput,
      manifest: {
        ...duplicateResourceInput.manifest,
        description: "A distinct resource registration with the same id.",
      },
    });
    const cases = [
      { behaviors: [behavior, duplicateBehavior] },
      { operations: [operation, duplicateOperation] },
      { resources: [resource, duplicateResource] },
    ] as const;

    for (const category of cases) {
      expect(() =>
        createCatalogManifest({
          ...createCatalogInput([]),
          ...category,
        }),
      ).toThrow(/duplicate (behavior|operation|resource) id/u);
    }
  });

  it("rejects capability ids reused across different Catalog categories", () => {
    const id = "com.example.shared/Capability";
    const component = registerComponent({ id, manifest: { propsSchema: {} } });
    const behavior = registerBehavior({
      id,
      manifest: {
        propsSchema: {},
        attachTo: { categories: ["content"] },
      },
    });
    const operation = registerOperation({
      id,
      manifest: {
        inputSchema: {},
        outputSchema: {},
        errors: [],
        effect: "none",
      },
    });
    const resource = registerResource({
      id,
      manifest: {
        inputSchema: {},
        outputSchema: {},
        errors: [],
        policies: ["manual"],
      },
    });
    const cases = [
      { components: [component], behaviors: [behavior] },
      { components: [component], operations: [operation] },
      { components: [component], resources: [resource] },
      { components: [], behaviors: [behavior], operations: [operation] },
      { components: [], behaviors: [behavior], resources: [resource] },
      { components: [], operations: [operation], resources: [resource] },
    ] as const;

    for (const categories of cases) {
      expect(() =>
        createCatalogManifest({
          ...createCatalogInput(categories.components),
          ...categories,
        }),
      ).toThrow(/duplicate capability id "com\.example\.shared\/Capability"/u);
    }
  });

  it("treats capability ids as exact, case-sensitive strings", () => {
    const componentUpper = registerComponent({
      id: "com.example.ui/Text",
      manifest: { propsSchema: {} },
    });
    const componentLower = registerComponent({
      id: "com.example.ui/text",
      manifest: { propsSchema: {} },
    });
    const behaviorUpper = registerBehavior({
      id: "com.example.interactions/Sortable",
      manifest: { propsSchema: {}, attachTo: { categories: ["content"] } },
    });
    const behaviorLower = registerBehavior({
      id: "com.example.interactions/sortable",
      manifest: { propsSchema: {}, attachTo: { categories: ["content"] } },
    });
    const operationUpper = registerOperation({
      id: "com.example.operations/Save",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], effect: "none" },
    });
    const operationLower = registerOperation({
      id: "com.example.operations/save",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], effect: "none" },
    });
    const resourceUpper = registerResource({
      id: "com.example.resources/Stores",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], policies: ["manual"] },
    });
    const resourceLower = registerResource({
      id: "com.example.resources/stores",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], policies: ["manual"] },
    });

    const componentCatalog = createCatalogManifest(
      createCatalogInput([componentUpper, componentLower]),
    );
    const behaviorCatalog = createCatalogManifest({
      ...createCatalogInput([]),
      behaviors: [behaviorUpper, behaviorLower],
    });
    const operationCatalog = createCatalogManifest({
      ...createCatalogInput([]),
      operations: [operationUpper, operationLower],
    });
    const resourceCatalog = createCatalogManifest({
      ...createCatalogInput([]),
      resources: [resourceUpper, resourceLower],
    });

    expect(Object.keys(componentCatalog.components)).toEqual([
      "com.example.ui/Text",
      "com.example.ui/text",
    ]);
    expect(Object.keys(behaviorCatalog.behaviors)).toEqual([
      "com.example.interactions/Sortable",
      "com.example.interactions/sortable",
    ]);
    expect(Object.keys(operationCatalog.operations)).toEqual([
      "com.example.operations/Save",
      "com.example.operations/save",
    ]);
    expect(Object.keys(resourceCatalog.resources)).toEqual([
      "com.example.resources/Stores",
      "com.example.resources/stores",
    ]);
  });

  it("stores prototype-looking map keys as inert data in every category", () => {
    const component = registerComponent({ id: "__proto__", manifest: { propsSchema: {} } });
    const behavior = registerBehavior({
      id: "constructor",
      manifest: { propsSchema: {}, attachTo: { categories: ["content"] } },
    });
    const operation = registerOperation({
      id: "prototype",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], effect: "none" },
    });
    const resource = registerResource({
      id: "toString",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], policies: ["manual"] },
    });
    const catalog = createCatalogManifest({
      ...createCatalogInput([component]),
      behaviors: [behavior],
      operations: [operation],
      resources: [resource],
    });

    expect(Object.hasOwn(catalog.components, "__proto__")).toBe(true);
    expect(Object.hasOwn(catalog.behaviors, "constructor")).toBe(true);
    expect(Object.hasOwn(catalog.operations, "prototype")).toBe(true);
    expect(Object.hasOwn(catalog.resources, "toString")).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("rejects unknown Catalog builder fields and forged registration records", () => {
    const registration = registerComponent({
      id: "com.example.ui/Text",
      manifest: { propsSchema: {} },
    });
    expect(() =>
      createCatalogManifest({
        ...createCatalogInput([registration]),
        bindings: [],
      } as never),
    ).toThrow(/unknown registration field/u);
    expect(() =>
      createCatalogManifest({
        ...createCatalogInput([]),
        components: [{ id: registration.id, manifest: registration.manifest, adapter: null }],
      } as never),
    ).toThrow(/expected only id and manifest/u);
    expect(() =>
      createCatalogManifest({
        ...createCatalogInput([]),
        operations: [
          {
            id: "com.example.auth/signIn",
            manifest: createRichOperationInput().manifest,
            execute: null,
          },
        ],
      } as never),
    ).toThrow(/expected only id and manifest/u);
    expect(() =>
      createCatalogManifest({
        ...createCatalogInput([]),
        resources: undefined,
      } as never),
    ).toThrow(TypeError);
  });
});
