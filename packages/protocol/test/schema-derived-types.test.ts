import type { DesenBundle, DesenCatalog, DesenSource } from "../src/index.js";

const validSurface = {
  id: "main",
  state: {},
  resources: {},
  root: {
    id: "root",
    use: "desen.core/Stack",
    props: {
      nestedValue: [["text", { $token: "space.sm" }]],
    },
    when: { op: "truthy", args: [true] },
    variants: [
      { when: { op: "truthy", args: [true] }, props: { visible: true } },
      {
        when: { op: "truthy", args: [true] },
        style: { root: { default: { opacity: 1 } } },
      },
    ],
    on: {
      submit: [
        { type: "state.set", path: "form.email", value: "person@example.test" },
        { type: "state.toggle", path: "form.remember" },
        { type: "navigate", surface: "success" },
        {
          type: "operation.invoke",
          operation: "desen.auth/signIn",
          as: "signIn",
          input: { email: { $ref: "state.form.email" } },
        },
        { type: "resource.refresh", resource: "session" },
        { type: "component.command", target: "email", command: "focus" },
        { type: "event.emit", name: "analytics.signInSubmitted" },
      ],
    },
  },
} satisfies DesenSource["surfaces"][string];

const validSource = {
  kind: "desen.source",
  desen: "0.1.0",
  id: "sign-in",
  catalogs: [{ id: "desen.core", version: "1.0.0", target: "web-react" }],
  entry: "main",
  surfaces: { main: validSurface },
  authoring: { selectedNodeId: "root" },
} satisfies DesenSource;

const validBundle = {
  kind: "desen.bundle",
  desen: "0.1.0",
  id: "sign-in",
  revision: `sha256:${"0".repeat(64)}`,
  sourceDigest: `sha256:${"1".repeat(64)}`,
  requires: {
    catalogs: [
      {
        id: "desen.core",
        version: "1.0.0",
        target: "web-react",
        digest: `sha256:${"2".repeat(64)}`,
      },
    ],
  },
  entry: "main",
  surfaces: { main: validSurface },
} satisfies DesenBundle;

const validCatalog = {
  kind: "desen.catalog",
  desen: "0.1.0",
  id: "desen.core",
  version: "1.0.0",
  target: "web-react",
  packageDigest: `sha256:${"3".repeat(64)}`,
  components: {},
  behaviors: {
    "desen.core/Sortable": {
      propsSchema: {},
      attachTo: { categories: ["list"] },
    },
  },
  operations: {},
  resources: {},
} satisfies DesenCatalog;

const invalidSourceKind: DesenSource = {
  ...validSource,
  // @ts-expect-error Source and Bundle discriminants must never be interchangeable.
  kind: "desen.bundle",
};

const invalidProtocolVersion: DesenSource = {
  ...validSource,
  // @ts-expect-error These declarations represent only the frozen DESEN 0.1.0 contract.
  desen: "0.2.0",
};

const invalidExecutableMetadata: DesenSource = {
  ...validSource,
  authoring: {
    // @ts-expect-error DESEN document data cannot contain executable function values.
    runArbitraryCode: () => "not JSON",
  },
};

// @ts-expect-error The root Source schema requires a surfaces collection.
const missingSourceField: DesenSource = {
  kind: "desen.source",
  desen: "0.1.0",
  id: "missing-surfaces",
  catalogs: [{ id: "desen.core", version: "1.0.0" }],
  entry: "main",
};

const invalidNestedValue: DesenSource = {
  ...validSource,
  surfaces: {
    main: {
      ...validSurface,
      root: {
        ...validSurface.root,
        props: {
          // @ts-expect-error Undefined is not a DESEN value, including inside recursive arrays.
          invalid: [undefined],
        },
      },
    },
  },
};

const invalidPredicate: DesenSource = {
  ...validSource,
  surfaces: {
    main: {
      ...validSurface,
      root: {
        ...validSurface.root,
        when: {
          op: "truthy",
          args: [true],
          // @ts-expect-error predicateSpec is closed to unknown properties.
          unexpected: true,
        },
      },
    },
  },
};

const invalidVariant: DesenSource = {
  ...validSource,
  surfaces: {
    main: {
      ...validSurface,
      root: {
        ...validSurface.root,
        variants: [
          // @ts-expect-error A variant must provide props or style in addition to its predicate.
          { when: { op: "truthy", args: [true] } },
        ],
      },
    },
  },
};

const invalidAction: DesenSource = {
  ...validSource,
  surfaces: {
    main: {
      ...validSurface,
      root: {
        ...validSurface.root,
        on: {
          submit: [
            {
              // @ts-expect-error DESEN documents cannot select an unknown action kind.
              type: "script.execute",
            },
          ],
        },
      },
    },
  },
};

const invalidCatalogAttach: DesenCatalog = {
  ...validCatalog,
  behaviors: {
    "desen.core/Sortable": {
      propsSchema: {},
      // @ts-expect-error A behavior target must name capabilities or categories.
      attachTo: {},
    },
  },
};

const invalidBundleRequirement: DesenBundle = {
  ...validBundle,
  requires: {
    catalogs: [
      // @ts-expect-error Published bundles require an exact catalog digest.
      { id: "desen.core", version: "1.0.0", target: "web-react" },
    ],
  },
};

void [
  validSource,
  validBundle,
  validCatalog,
  invalidSourceKind,
  invalidProtocolVersion,
  invalidExecutableMetadata,
  missingSourceField,
  invalidNestedValue,
  invalidPredicate,
  invalidVariant,
  invalidAction,
  invalidCatalogAttach,
  invalidBundleRequirement,
];
