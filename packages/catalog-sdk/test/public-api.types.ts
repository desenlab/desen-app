import { createCatalogManifest, registerComponent } from "../src/index.js";

import type { ComponentManifest } from "../src/index.js";

const registration = registerComponent({
  id: "com.example.ui/Button",
  manifest: {
    propsSchema: {
      type: "object",
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
void exactId;
void exactSchemaType;
void exactFirstState;

const schemaTypedManifest: ComponentManifest = {
  propsSchema: { type: "object" },
  visualStates: ["focus"],
  authoring: { displayName: "Schema typed manifest" },
};
registerComponent({ id: "com.example.ui/SchemaTyped", manifest: schemaTypedManifest });

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
  // @ts-expect-error M03-T01-N07 Behavior registration belongs to M03-T02.
  behaviors: {},
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
  behaviors: {},
};
// @ts-expect-error M03-T01-N12 Named Catalog inputs cannot bypass the M03-T02 scope fence.
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
