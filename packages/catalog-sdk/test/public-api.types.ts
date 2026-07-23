import {
  createCatalogManifest,
  deriveComponentInspectorControls,
  registerBehavior,
  registerComponent,
  registerOperation,
  registerResource,
} from "../src/index.js";

import type {
  BehaviorManifest,
  ComponentInspectorControlPlan,
  ComponentManifest,
  ComponentPropsOf,
  JsonSchemaValue,
  JsonValue,
  OperationManifest,
  ResourceManifest,
} from "../src/index.js";

const registration = registerComponent({
  id: "com.example.ui/Button",
  manifest: {
    propsSchema: {
      type: "object",
      additionalProperties: false,
      required: ["tone"],
      properties: {
        tone: { type: "string", enum: ["primary", "secondary"] },
      },
    },
    visualStates: ["focus", "disabled"],
  },
});

const exactId: "com.example.ui/Button" = registration.id;
const exactSchemaType: "object" = registration.manifest.propsSchema.type;
const exactFirstState: "focus" = registration.manifest.visualStates[0];
type RegisteredButtonProps = ComponentPropsOf<typeof registration>;
type ExactTone = JsonSchemaValue<{ readonly enum: readonly ["primary", "secondary"] }>;
const registeredButtonProps: RegisteredButtonProps = { tone: "primary" };
const exactTone: ExactTone = registeredButtonProps.tone;
const inspectorPlan: ComponentInspectorControlPlan = deriveComponentInspectorControls(registration);
const inertMetadata: JsonValue = { controlCount: inspectorPlan.controls.length };
void exactId;
void exactSchemaType;
void exactFirstState;
void exactTone;
void inspectorPlan;
void inertMetadata;

const schemaTypedManifest: ComponentManifest = {
  propsSchema: { type: "object" },
  visualStates: ["focus"],
  authoring: { displayName: "Schema typed manifest" },
};
registerComponent({ id: "com.example.ui/SchemaTyped", manifest: schemaTypedManifest });

const behaviorRegistration = registerBehavior({
  id: "com.example.interactions/Sortable",
  manifest: {
    propsSchema: { type: "object" },
    attachTo: {
      capabilities: ["com.example.ui/Button"],
      categories: ["collection"],
    },
    composition: {
      exclusiveChannels: ["pointer-drag"],
      compatibleWith: ["com.example.interactions/KeyboardSortable"],
    },
    visualStates: ["dragging"],
  },
});
const exactBehaviorId: "com.example.interactions/Sortable" = behaviorRegistration.id;
const exactAttachedCapability: "com.example.ui/Button" =
  behaviorRegistration.manifest.attachTo.capabilities[0];
const exactBehaviorState: "dragging" = behaviorRegistration.manifest.visualStates[0];
void exactBehaviorId;
void exactAttachedCapability;
void exactBehaviorState;

const operationRegistration = registerOperation({
  id: "com.example.auth/signIn",
  manifest: {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    errors: [{ code: "INVALID_CREDENTIALS" }],
    effect: "network",
  },
});
const exactOperationEffect: "network" = operationRegistration.manifest.effect;
const exactOperationError: "INVALID_CREDENTIALS" = operationRegistration.manifest.errors[0].code;
void exactOperationEffect;
void exactOperationError;

const resourceRegistration = registerResource({
  id: "com.example.stores/list",
  manifest: {
    inputSchema: { type: "object" },
    outputSchema: { type: "array" },
    errors: [{ code: "OFFLINE" }],
    policies: ["mount", "manual"],
  },
});
const exactResourcePolicy: "mount" = resourceRegistration.manifest.policies[0];
const exactResourceError: "OFFLINE" = resourceRegistration.manifest.errors[0].code;
void exactResourcePolicy;
void exactResourceError;

const schemaTypedBehavior: BehaviorManifest = {
  propsSchema: {},
  attachTo: { categories: ["content"] },
};
const schemaTypedOperation: OperationManifest = {
  inputSchema: {},
  outputSchema: {},
  errors: [],
  effect: "none",
};
const schemaTypedResource: ResourceManifest = {
  inputSchema: {},
  outputSchema: {},
  errors: [],
  policies: ["manual"],
};
registerBehavior({ id: "com.example.interactions/SchemaTyped", manifest: schemaTypedBehavior });
registerOperation({ id: "com.example.operations/SchemaTyped", manifest: schemaTypedOperation });
registerResource({ id: "com.example.resources/SchemaTyped", manifest: schemaTypedResource });

createCatalogManifest({
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [registration],
  behaviors: [behaviorRegistration],
  operations: [operationRegistration],
  resources: [resourceRegistration],
});

// @ts-expect-error M03-T01-N01 Returned registration snapshots are recursively readonly.
registration.manifest.propsSchema.type = "array";

registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    extensions: {
      // @ts-expect-error M03-T01-N02 Executable values cannot enter generic manifest extensions.
      implementation: () => null,
    },
  },
});

registerComponent({
  id: "com.example.ui/Invalid",
  // @ts-expect-error M03-T01-N03 A component manifest must contain its schema-derived propsSchema field.
  manifest: {},
});

registerComponent({
  id: "com.example.ui/Invalid",
  manifest: { propsSchema: {} },
  // @ts-expect-error M03-T01-N04 Target adapter fields belong to renderer packages, not catalog registration.
  production: () => null,
});

registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    // @ts-expect-error M03-T01-N05 Unknown core manifest fields cannot name implementation artifacts.
    implementation: "./Button.js",
  },
});

registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    authoring: {
      displayName: "Invalid",
      // @ts-expect-error M03-T01-N06 Authoring adapters are outside the closed authoring contract.
      adapter: "./Button.preview.js",
    },
  },
});

createCatalogManifest({
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [registration],
  // @ts-expect-error M03-T01-N07 Catalog builder fields must remain schema-owned.
  registry: {},
});

const readonlyManifest = {
  propsSchema: {
    type: "object",
    properties: { tone: { enum: ["primary", "secondary"] } },
  },
  visualStates: ["focus", "disabled"],
} as const;
const readonlyRegistration = registerComponent({
  id: "com.example.ui/Readonly",
  manifest: readonlyManifest,
});
const readonlyState: "focus" = readonlyRegistration.manifest.visualStates[0];
void readonlyState;

const privateManifestKey = Symbol("private-manifest-key");
registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    // @ts-expect-error M03-T01-N08 Symbol-keyed members are not JSON object members.
    extensions: {
      visible: true,
      [privateManifestKey]: true,
    },
  },
});

class ExecutableManifestValue {
  static readonly label = "not data";
  readonly instance = true;
}
registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    extensions: {
      // @ts-expect-error M03-T01-N09 Constructable values cannot enter generic manifest extensions.
      implementation: ExecutableManifestValue,
    },
  },
});

const augmentedArray = Object.assign(["visible"], { implementation: "./adapter.js" });
registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    extensions: {
      // @ts-expect-error M03-T01-N10 Arrays with named properties are not JSON arrays.
      values: augmentedArray,
    },
  },
});

const namedRegistrationWithAdapter = {
  id: "com.example.ui/Invalid",
  manifest: { propsSchema: {} },
  production: () => null,
};
// @ts-expect-error M03-T01-N11 Named registration wrappers must remain exact.
registerComponent(namedRegistrationWithAdapter);

const namedCatalogWithDeferredCategory = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [],
  bindings: [],
};
// @ts-expect-error M03-T01-N12 Named Catalog inputs cannot add executable-binding collections.
createCatalogManifest(namedCatalogWithDeferredCategory);

const catalogWithUndefinedDescription = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [],
  description: undefined,
};
// @ts-expect-error M03-T01-N13 Present JSON fields cannot contain undefined.
createCatalogManifest(catalogWithUndefinedDescription);

const augmentedComponents = Object.assign([registration], { production: "./adapter.js" });
const catalogWithAugmentedComponents = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: augmentedComponents,
};
// @ts-expect-error M03-T01-N14 Catalog component lists cannot carry named properties.
createCatalogManifest(catalogWithAugmentedComponents);

const namedComponentWithAdapter = {
  id: registration.id,
  manifest: registration.manifest,
  adapter: "./adapter.js",
};
const catalogWithNamedComponentAdapter = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [namedComponentWithAdapter],
};
// @ts-expect-error M03-T01-N15 Named component entries must contain only id and manifest.
createCatalogManifest(catalogWithNamedComponentAdapter);

const rawComponentWithImplementation = {
  id: "com.example.ui/Invalid",
  manifest: { propsSchema: {}, implementation: "./Button.js" },
};
const catalogWithRawImplementation = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [rawComponentWithImplementation],
};
// @ts-expect-error M03-T01-N16 Raw Catalog composition cannot bypass exact manifest fields.
createCatalogManifest(catalogWithRawImplementation);

const negativeIndexArray = Object.assign(["visible"], { "-1": "not an element" });
registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    extensions: {
      // @ts-expect-error M03-T01-N17 Negative named keys are not JSON array indexes.
      values: negativeIndexArray,
    },
  },
});

const fractionalIndexArray = Object.assign(["visible"], { "1.5": "not an element" });
registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    extensions: {
      // @ts-expect-error M03-T01-N18 Fractional named keys are not JSON array indexes.
      values: fractionalIndexArray,
    },
  },
});

const paddedIndexArray = Object.assign(["visible"], { "01": "not an element" });
registerComponent({
  id: "com.example.ui/Invalid",
  manifest: {
    propsSchema: {},
    extensions: {
      // @ts-expect-error M03-T01-N19 Padded named keys are not JSON array indexes.
      values: paddedIndexArray,
    },
  },
});

const heterogeneousValidComponent = {
  id: "com.example.ui/Valid",
  manifest: { propsSchema: {} },
} as const;
const heterogeneousWrapperAdapter = {
  id: "com.example.ui/InvalidWrapper",
  manifest: { propsSchema: {} },
  adapter: "./adapter.js",
} as const;
const catalogWithHeterogeneousWrapper = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [heterogeneousValidComponent, heterogeneousWrapperAdapter] as const,
};
// @ts-expect-error M03-T01-N20 Heterogeneous tuples cannot hide component adapter fields.
createCatalogManifest(catalogWithHeterogeneousWrapper);

const heterogeneousManifestAdapter = {
  id: "com.example.ui/InvalidManifest",
  manifest: {
    propsSchema: {},
    attachTo: { capabilities: ["com.example.ui/Valid"] },
  },
} as const;
const catalogWithHeterogeneousManifest = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [heterogeneousValidComponent, heterogeneousManifestAdapter] as const,
};
// @ts-expect-error M03-T01-N21 Heterogeneous tuples cannot hide later-category manifest fields.
createCatalogManifest(catalogWithHeterogeneousManifest);

// @ts-expect-error M03-T02-N01 Behavior registration snapshots are recursively readonly.
behaviorRegistration.manifest.propsSchema.type = "array";

registerBehavior({
  id: "com.example.interactions/Invalid",
  // @ts-expect-error M03-T02-N02 Behavior manifests require propsSchema.
  manifest: { attachTo: { categories: ["content"] } },
});

registerBehavior({
  id: "com.example.interactions/Invalid",
  // @ts-expect-error M03-T02-N03 Behavior manifests require attachTo.
  manifest: { propsSchema: {} },
});

registerBehavior({
  id: "com.example.interactions/Invalid",
  manifest: { propsSchema: {}, attachTo: { categories: ["content"] } },
  // @ts-expect-error M03-T02-N04 Executable behavior adapters are renderer-owned.
  production: () => null,
});

registerBehavior({
  id: "com.example.interactions/Invalid",
  manifest: {
    propsSchema: {},
    attachTo: { categories: ["content"] },
    // @ts-expect-error M03-T02-N05 Behavior manifests cannot select implementation modules.
    implementation: "./Sortable.js",
  },
});

registerBehavior({
  id: "com.example.interactions/Invalid",
  manifest: {
    propsSchema: {},
    attachTo: {
      categories: ["content"],
      // @ts-expect-error M03-T02-N06 Behavior attachment contracts are closed.
      selector: "[data-sortable]",
    },
  },
});

registerBehavior({
  id: "com.example.interactions/Invalid",
  manifest: {
    propsSchema: {},
    attachTo: { categories: ["content"] },
    composition: {
      exclusiveChannels: ["pointer-drag"],
      // @ts-expect-error M03-T02-N07 Behavior composition cannot name a private library.
      library: "sortable",
    },
  },
});

// @ts-expect-error M03-T02-N08 Operation registration snapshots are recursively readonly.
operationRegistration.manifest.errors[0].code = "CHANGED";

registerOperation({
  id: "com.example.operations/Invalid",
  // @ts-expect-error M03-T02-N09 Operation manifests require inputSchema.
  manifest: { outputSchema: {}, errors: [], effect: "none" },
});

registerOperation({
  id: "com.example.operations/Invalid",
  // @ts-expect-error M03-T02-N10 Operation manifests require outputSchema.
  manifest: { inputSchema: {}, errors: [], effect: "none" },
});

registerOperation({
  id: "com.example.operations/Invalid",
  // @ts-expect-error M03-T02-N11 Operation manifests require public errors.
  manifest: { inputSchema: {}, outputSchema: {}, effect: "none" },
});

registerOperation({
  id: "com.example.operations/Invalid",
  // @ts-expect-error M03-T02-N12 Operation manifests require an effect class.
  manifest: { inputSchema: {}, outputSchema: {}, errors: [] },
});

registerOperation({
  id: "com.example.operations/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    // @ts-expect-error M03-T02-N13 Effect is the exact schema-derived closed vocabulary.
    effect: "authorized",
  },
});

registerOperation({
  id: "com.example.operations/Invalid",
  manifest: { inputSchema: {}, outputSchema: {}, errors: [], effect: "none" },
  // @ts-expect-error M03-T02-N14 Executable operation handlers are host-owned.
  execute: () => null,
});

registerOperation({
  id: "com.example.operations/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    effect: "network",
    // @ts-expect-error M03-T02-N15 Operation manifests cannot select endpoints.
    endpoint: "https://example.invalid/sign-in",
  },
});

registerOperation({
  id: "com.example.operations/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [
      {
        code: "DENIED",
        // @ts-expect-error M03-T02-N16 Public error entries cannot expose private codes.
        internalCode: "provider-42",
      },
    ],
    effect: "network",
  },
});

const namedOperationErrors = [{ code: "DENIED", internalCode: "provider-42" }];
registerOperation({
  id: "com.example.operations/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    // @ts-expect-error M03-T02-N17 Named error arrays retain recursively exact item shapes.
    errors: namedOperationErrors,
    effect: "network",
  },
});

registerOperation({
  id: "com.example.operations/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    effect: "none",
    authoring: {
      fixtures: {},
      // @ts-expect-error M03-T02-N18 Authoring adapters are outside the operation contract.
      adapter: "./operation-preview.js",
    },
  },
});

// @ts-expect-error M03-T02-N19 Resource registration snapshots are recursively readonly.
resourceRegistration.manifest.policies[0] = "once";

registerResource({
  id: "com.example.resources/Invalid",
  // @ts-expect-error M03-T02-N20 Resource manifests require policies.
  manifest: { inputSchema: {}, outputSchema: {}, errors: [] },
});

registerResource({
  id: "com.example.resources/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    // @ts-expect-error M03-T02-N21 Resource policies use the exact schema-derived vocabulary.
    policies: ["write"],
  },
});

registerResource({
  id: "com.example.resources/Invalid",
  manifest: { inputSchema: {}, outputSchema: {}, errors: [], policies: ["manual"] },
  // @ts-expect-error M03-T02-N22 Executable resource readers are host-owned.
  read: () => null,
});

registerResource({
  id: "com.example.resources/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    policies: ["manual"],
    cacheHints: {
      ttlSeconds: 60,
      // @ts-expect-error M03-T02-N23 Cache hints cannot contain transport headers.
      header: "Cache-Control",
    },
  },
});

registerResource({
  id: "com.example.resources/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [
      {
        code: "OFFLINE",
        // @ts-expect-error M03-T02-N24 Resource errors use the same closed public shape.
        providerPayload: {},
      },
    ],
    policies: ["manual"],
  },
});

registerResource({
  id: "com.example.resources/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    policies: ["manual"],
    // @ts-expect-error M03-T02-N25 Resource manifests cannot select databases.
    database: "stores",
  },
});

const augmentedResources = Object.assign([resourceRegistration], {
  reader: "./stores.js",
});
const catalogWithAugmentedResources = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [],
  resources: augmentedResources,
};
// @ts-expect-error M03-T02-N26 Category registration arrays cannot carry named properties.
createCatalogManifest(catalogWithAugmentedResources);

const forgedBehaviorRegistration = {
  id: "com.example.interactions/Invalid",
  manifest: { propsSchema: {}, attachTo: { categories: ["content"] } },
  adapter: "./Sortable.js",
} as const;
const catalogWithForgedBehavior = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [],
  behaviors: [behaviorRegistration, forgedBehaviorRegistration] as const,
};
// @ts-expect-error M03-T02-N27 Heterogeneous behavior tuples cannot hide adapter fields.
createCatalogManifest(catalogWithForgedBehavior);

const catalogWithWrongCategory = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [],
  operations: [resourceRegistration],
};
// @ts-expect-error M03-T02-N28 Category lists cannot accept a different manifest contract.
createCatalogManifest(catalogWithWrongCategory);

const catalogWithUndefinedResources = {
  id: "com.example.catalog",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"0".repeat(64)}`,
  components: [],
  resources: undefined,
};
// @ts-expect-error M03-T02-N29 Present optional category lists cannot contain undefined.
createCatalogManifest(catalogWithUndefinedResources);

registerResource({
  id: "com.example.resources/Invalid",
  manifest: {
    inputSchema: {},
    outputSchema: {},
    errors: [],
    policies: ["manual"],
    extensions: {
      // @ts-expect-error M03-T02-N30 Executable values cannot enter resource extensions.
      connect: () => null,
    },
  },
});

type OptionalEndpointOperationManifest = OperationManifest & {
  readonly endpoint?: string;
};
const optionalEndpointOperationManifest: OptionalEndpointOperationManifest = {
  inputSchema: {},
  outputSchema: {},
  errors: [],
  effect: "network",
  endpoint: "/private/sign-in",
};
registerOperation({
  id: "com.example.operations/OptionalExtra",
  // @ts-expect-error M03-T02-N31 Optional extra fields cannot bypass closed manifest exactness.
  manifest: optionalEndpointOperationManifest,
});

type IndexedOperationManifest = OperationManifest & Readonly<Record<string, unknown>>;
const indexedOperationManifest: IndexedOperationManifest = {
  inputSchema: {},
  outputSchema: {},
  errors: [],
  effect: "network",
  endpoint: "/private/sign-in",
};
registerOperation({
  id: "com.example.operations/IndexedExtra",
  // @ts-expect-error M03-T02-N32 String index signatures cannot bypass closed manifest exactness.
  manifest: indexedOperationManifest,
});
