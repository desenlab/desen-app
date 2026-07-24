import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  a2uiStreamToDesenSource,
  buildSc01A2uiBridgeEvidence,
  createSc01DesenFixture,
  DEFAULT_SC01_A2UI_FIXTURE_DIRECTORY,
  desenSourceToA2uiStream,
  SC01_A2UI_CATALOG_ID,
  SC01_A2UI_COMMIT,
  SC01_A2UI_REJECTION_CODES,
  SC01_A2UI_SPEC_TREE,
  SC01_A2UI_VERSION,
  SC01_PROFILE_ID,
  Sc01A2uiBridgeError,
  validateA2uiStreamAgainstPinnedSchemas,
  validateDesenSourceAgainstPinnedSchema,
  validatePinnedDesenCatalogProfile,
  verifySc01A2uiBridgeEvidence,
  writeSc01A2uiBridgeEvidence,
} from "../scripts/lib/sc-01-a2ui-bridge-spike.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const baselinePromise = buildSc01A2uiBridgeEvidence();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCode(error, code) {
  assert.ok(error instanceof Sc01A2uiBridgeError);
  assert.equal(error.code, code);
  return true;
}

function mutateSource(mutator) {
  const source = clone(createSc01DesenFixture());
  mutator(source);
  return source;
}

function mutateStream(mutator) {
  const stream = clone(desenSourceToA2uiStream(createSc01DesenFixture()));
  mutator(stream);
  return stream;
}

function sourceRoot(source) {
  return source.surfaces["bridge-demo"].root;
}

function firstText(source) {
  return sourceRoot(source).slots.default[0];
}

function createDepthSource(maximumDepth) {
  const source = clone(createSc01DesenFixture());
  let node = {
    id: `leaf-${maximumDepth}`,
    use: "com.example.ui/Text",
    props: {
      text: `Depth ${maximumDepth}`,
      role: "body",
    },
  };
  for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
    node = {
      id: depth === 0 ? "root" : `stack-${depth}`,
      use: "com.example.ui/Stack",
      props: {
        direction: "vertical",
        align: "stretch",
      },
      slots: {
        default: [node],
      },
    };
  }
  source.surfaces["bridge-demo"].root = node;
  return source;
}

function createDepthA2uiStream(maximumDepth) {
  const components = [];
  for (let depth = 0; depth < maximumDepth; depth += 1) {
    components.push({
      id: depth === 0 ? "root" : `stack-${depth}`,
      component: "Column",
      children: [depth + 1 === maximumDepth ? `leaf-${maximumDepth}` : `stack-${depth + 1}`],
      align: "stretch",
    });
  }
  components.push({
    id: `leaf-${maximumDepth}`,
    component: "Text",
    text: `Depth ${maximumDepth}`,
    variant: "body",
  });
  return [
    {
      version: "v0.9.1",
      createSurface: {
        surfaceId: "bridge-demo",
        catalogId: SC01_A2UI_CATALOG_ID,
      },
    },
    {
      version: "v0.9.1",
      updateComponents: {
        surfaceId: "bridge-demo",
        components,
      },
    },
  ];
}

function createComponentCountSource(componentCount) {
  const source = clone(createSc01DesenFixture());
  const children = [];
  for (let index = 1; index < componentCount; index += 1) {
    children.push({
      id: `node-${index}`,
      use: "com.example.ui/Text",
      props: {
        text: `Node ${index}`,
        role: "body",
      },
    });
  }
  sourceRoot(source).slots.default = children;
  return source;
}

function createComponentCountA2uiStream(componentCount) {
  const stream = clone(desenSourceToA2uiStream(createComponentCountSource(256)));
  const components = stream[1].updateComponents.components;
  for (let index = 256; index < componentCount; index += 1) {
    const id = `node-${index}`;
    components[0].children.push(id);
    components.push({
      id,
      component: "Text",
      text: `Node ${index}`,
      variant: "body",
    });
  }
  return stream;
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-sc-01-a2ui-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return directory;
}

test("encodes the exact canonical createSurface and updateComponents stream", () => {
  const stream = desenSourceToA2uiStream(createSc01DesenFixture());
  assert.deepEqual(stream, [
    {
      version: "v0.9.1",
      createSurface: {
        surfaceId: "bridge-demo",
        catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
      },
    },
    {
      version: "v0.9.1",
      updateComponents: {
        surfaceId: "bridge-demo",
        components: [
          {
            id: "root",
            component: "Column",
            children: ["title", "content-row"],
            align: "stretch",
          },
          {
            id: "title",
            component: "Text",
            text: "Desen bridge proof",
            variant: "h2",
          },
          {
            id: "content-row",
            component: "Row",
            children: ["body-copy", "caption"],
            align: "center",
          },
          {
            id: "body-copy",
            component: "Text",
            text: "Static body text",
            variant: "body",
          },
          {
            id: "caption",
            component: "Text",
            text: "Pinned A2UI 0.9.1",
            variant: "caption",
          },
        ],
      },
    },
  ]);
  assert.equal(Object.isFrozen(stream), true);
  assert.equal(Object.isFrozen(stream[1].updateComponents.components), true);
});

test("proves exact two-way structural roundtrips", () => {
  const source = createSc01DesenFixture();
  const stream = desenSourceToA2uiStream(source);
  assert.deepEqual(a2uiStreamToDesenSource(stream), source);
  assert.deepEqual(desenSourceToA2uiStream(a2uiStreamToDesenSource(stream)), stream);
});

test("accepts depth 32 from root=0 and rejects depth 33 in both directions", async () => {
  const boundarySource = createDepthSource(32);
  const boundaryStream = desenSourceToA2uiStream(boundarySource);
  assert.deepEqual(a2uiStreamToDesenSource(boundaryStream), boundarySource);
  assert.equal((await validateDesenSourceAgainstPinnedSchema(boundarySource)).result, "PASS");
  assert.equal((await validateA2uiStreamAgainstPinnedSchemas(boundaryStream)).result, "PASS");

  assert.throws(
    () => desenSourceToA2uiStream(createDepthSource(33)),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED),
  );
  assert.throws(
    () => a2uiStreamToDesenSource(createDepthA2uiStream(33)),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED),
  );
});

test("accepts 256 components and rejects 257 in both directions", async () => {
  const boundarySource = createComponentCountSource(256);
  const boundaryStream = desenSourceToA2uiStream(boundarySource);
  assert.deepEqual(a2uiStreamToDesenSource(boundaryStream), boundarySource);
  assert.equal((await validateDesenSourceAgainstPinnedSchema(boundarySource)).result, "PASS");
  assert.equal((await validateA2uiStreamAgainstPinnedSchemas(boundaryStream)).result, "PASS");

  assert.throws(
    () => desenSourceToA2uiStream(createComponentCountSource(257)),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED),
  );
  assert.throws(
    () => a2uiStreamToDesenSource(createComponentCountA2uiStream(257)),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.A2UI_STREAM_UNSUPPORTED),
  );
});

test("validates both messages offline against exact pinned official schemas", async () => {
  const stream = desenSourceToA2uiStream(createSc01DesenFixture());
  const validation = await validateA2uiStreamAgainstPinnedSchemas(stream);
  assert.equal(validation.result, "PASS");
  assert.equal(validation.messages, 2);
  assert.equal(validation.files.length, 3);
  assert.equal(
    validation.catalogAlias.resolverId,
    "https://a2ui.org/specification/v0_9/catalog.json",
  );
  assert.equal(validation.catalogAlias.emittedCatalogIdChanged, false);
  for (const file of validation.files) {
    assert.match(file.sha256, /^sha256:[a-f0-9]{64}$/u);
    assert.match(file.gitBlobSha1, /^[a-f0-9]{40}$/u);
    assert.ok(file.url.includes(SC01_A2UI_COMMIT));
  }
});

test("keeps the canonical A2UI re-encode valid against the official pinned schemas", async () => {
  const emitted = desenSourceToA2uiStream(createSc01DesenFixture());
  const reencoded = desenSourceToA2uiStream(a2uiStreamToDesenSource(emitted));
  assert.deepEqual(reencoded, emitted);
  const validation = await validateA2uiStreamAgainstPinnedSchemas(reencoded);
  assert.equal(validation.result, "PASS");
  assert.equal(validation.messages, 2);
});

test("validates sample and decoded Sources against the frozen DESEN 0.1.0 schema", async () => {
  const sample = createSc01DesenFixture();
  const decoded = a2uiStreamToDesenSource(desenSourceToA2uiStream(sample));
  const [sampleValidation, decodedValidation] = await Promise.all([
    validateDesenSourceAgainstPinnedSchema(sample),
    validateDesenSourceAgainstPinnedSchema(decoded),
  ]);
  for (const validation of [sampleValidation, decodedValidation]) {
    assert.equal(validation.result, "PASS");
    assert.equal(validation.schemaId, "https://schemas.desen.dev/0.1/desen-source.schema.json");
    assert.equal(
      validation.schemaSha256,
      "sha256:5ce5d541991940676ce0d3705e5b0658cd60f31025be8bfb96aec21a3116dba3",
    );
    assert.equal(validation.checksumLedger.sourceSchemaEntryMatched, true);
  }
});

test("pins the frozen DESEN example Catalog, schema, ledger, and Stack/Text contract", async () => {
  const validation = await validatePinnedDesenCatalogProfile();
  assert.equal(validation.result, "PASS");
  assert.equal(validation.profileId, "SC01_STATIC_TEXT_V1");
  assert.equal(
    validation.schema.sha256,
    "sha256:51014ab088b6a483502fd6aee5eed9fc4451be55556b6bd6220a5a6a1b610555",
  );
  assert.equal(
    validation.example.sha256,
    "sha256:7b9a8bad7b49340dc2a5f818ac008feb403fb43c8c476eecba5e1fcbdf3bf45d",
  );
  assert.deepEqual(validation.example.identity, {
    kind: "desen.catalog",
    desen: "0.1.0",
    id: "com.example.web-catalog",
    version: "1.0.0",
    target: "web-react",
  });
  assert.equal(validation.checksumLedger.catalogSchemaEntryMatched, true);
  assert.equal(validation.checksumLedger.catalogExampleEntryMatched, true);
  assert.equal(validation.contract.stackTextFieldsEnumsDefaultsExact, true);
  assert.equal(validation.contract.sampleStackPropsValid, true);
  assert.equal(validation.contract.sampleTextPropsValid, true);
});

test("pins the v0_9 schema Catalog identity while messages use v0.9.1", () => {
  assert.equal(SC01_PROFILE_ID, "SC01_STATIC_TEXT_V1");
  assert.equal(SC01_A2UI_VERSION, "v0.9.1");
  assert.equal(
    SC01_A2UI_CATALOG_ID,
    "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
  );
  assert.equal(SC01_A2UI_COMMIT, "d4723f29254520e1214d5004cb555d83eaafb828");
  assert.equal(SC01_A2UI_SPEC_TREE, "c7bbfeea1e6d62b0f24af4c83231c2d9fd55aa89");
});

test("rejects every explicitly unsupported DESEN semantic with stable codes", () => {
  const cases = [
    [
      SC01_A2UI_REJECTION_CODES.AUTHORING_UNSUPPORTED,
      (source) => {
        source.authoring = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.EXTENSIONS_UNSUPPORTED,
      (source) => {
        source.extensions = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STATE_UNSUPPORTED,
      (source) => {
        source.surfaces["bridge-demo"].state.value = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.RESOURCES_UNSUPPORTED,
      (source) => {
        source.surfaces["bridge-demo"].resources.value = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STYLE_UNSUPPORTED,
      (source) => {
        sourceRoot(source).style = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.EVENTS_UNSUPPORTED,
      (source) => {
        sourceRoot(source).on = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.CONDITION_UNSUPPORTED,
      (source) => {
        sourceRoot(source).when = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.REPEAT_UNSUPPORTED,
      (source) => {
        sourceRoot(source).repeat = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.BEHAVIOR_UNSUPPORTED,
      (source) => {
        sourceRoot(source).behaviors = [];
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.VARIANTS_UNSUPPORTED,
      (source) => {
        sourceRoot(source).variants = [];
      },
    ],
  ];
  for (const [code, mutator] of cases) {
    assert.throws(
      () => desenSourceToA2uiStream(mutateSource(mutator)),
      (error) => expectCode(error, code),
    );
  }
});

test("rejects unsupported Stack layout semantics without approximation", () => {
  const cases = [
    [
      SC01_A2UI_REJECTION_CODES.STACK_GAP_UNSUPPORTED,
      (root) => {
        root.props.gap = "md";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STACK_MAX_WIDTH_UNSUPPORTED,
      (root) => {
        root.props.maxWidth = 420;
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STACK_DIRECTION_UNSUPPORTED,
      (root) => {
        delete root.props.direction;
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STACK_DIRECTION_UNSUPPORTED,
      (root) => {
        root.props.direction = "diagonal";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
      (root) => {
        root.props.align = "baseline";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
      (root) => {
        delete root.props.align;
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STACK_PROP_UNSUPPORTED,
      (root) => {
        root.props.justify = "center";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED,
      (root) => {
        root.slots.header = [];
      },
    ],
  ];
  for (const [code, mutator] of cases) {
    assert.throws(
      () =>
        desenSourceToA2uiStream(
          mutateSource((source) => {
            mutator(sourceRoot(source));
          }),
        ),
      (error) => expectCode(error, code),
    );
  }
});

test("rejects nonliteral, unsafe, and unmapped Text semantics", () => {
  const cases = [
    [
      SC01_A2UI_REJECTION_CODES.TEXT_VALUE_UNSUPPORTED,
      (text) => {
        text.props.text = { $ref: "state.title" };
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.TEXT_PLAIN_UNSAFE,
      (text) => {
        text.props.text = "<strong>unsafe</strong>";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.TEXT_PLAIN_UNSAFE,
      (text) => {
        text.props.text = "**Markdown**";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.TEXT_PLAIN_UNSAFE,
      (text) => {
        text.props.text = "---";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
      (text) => {
        text.props.role = "display";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.TEXT_PROP_UNSUPPORTED,
      (text) => {
        text.props.tone = "muted";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED,
      (text) => {
        text.slots = { default: [] };
      },
    ],
  ];
  for (const [code, mutator] of cases) {
    assert.throws(
      () =>
        desenSourceToA2uiStream(
          mutateSource((source) => {
            mutator(firstText(source));
          }),
        ),
      (error) => expectCode(error, code),
    );
  }
});

test("bounds literal Text to 4096 UTF-16 code units in both directions", () => {
  const maximum = mutateSource((source) => {
    firstText(source).props.text = "a".repeat(4096);
  });
  assert.equal(
    desenSourceToA2uiStream(maximum)[1].updateComponents.components[1].text.length,
    4096,
  );
  assert.throws(
    () =>
      desenSourceToA2uiStream(
        mutateSource((source) => {
          firstText(source).props.text = "a".repeat(4097);
        }),
      ),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.TEXT_LENGTH_UNSUPPORTED),
  );
  assert.throws(
    () =>
      a2uiStreamToDesenSource(
        mutateStream((stream) => {
          stream[1].updateComponents.components[1].text = "a".repeat(4097);
        }),
      ),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.TEXT_LENGTH_UNSUPPORTED),
  );
});

test("rejects non-JSON array shapes without invoking caller hooks", () => {
  let getterCalls = 0;
  const getterSource = mutateSource((source) => {
    const children = sourceRoot(source).slots.default;
    const first = children[0];
    Object.defineProperty(children, "0", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return first;
      },
    });
  });
  assert.throws(
    () => desenSourceToA2uiStream(getterSource),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED),
  );
  assert.equal(getterCalls, 0);

  let mapCalls = 0;
  const ownMapSource = mutateSource((source) => {
    Object.defineProperty(sourceRoot(source).slots.default, "map", {
      configurable: true,
      value() {
        mapCalls += 1;
        throw new Error("caller map must never execute");
      },
    });
  });
  assert.throws(
    () => desenSourceToA2uiStream(ownMapSource),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED),
  );
  assert.equal(mapCalls, 0);

  let iteratorCalls = 0;
  const ownIteratorSource = mutateSource((source) => {
    Object.defineProperty(sourceRoot(source).slots.default, Symbol.iterator, {
      configurable: true,
      value() {
        iteratorCalls += 1;
        throw new Error("caller iterator must never execute");
      },
    });
  });
  assert.throws(
    () => desenSourceToA2uiStream(ownIteratorSource),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED),
  );
  assert.equal(iteratorCalls, 0);

  class ArraySubclass extends Array {}
  const subclassSource = mutateSource((source) => {
    const original = sourceRoot(source).slots.default;
    const replacement = new ArraySubclass();
    let index = 0;
    while (index < original.length) {
      replacement.push(original[index]);
      index += 1;
    }
    sourceRoot(source).slots.default = replacement;
  });
  assert.throws(
    () => desenSourceToA2uiStream(subclassSource),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED),
  );

  const nullPrototypeSource = mutateSource((source) => {
    Object.setPrototypeOf(sourceRoot(source).slots.default, null);
  });
  assert.throws(
    () => desenSourceToA2uiStream(nullPrototypeSource),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.SLOTS_UNSUPPORTED),
  );
});

test("rejects null-prototype records outside the JSON.parse domain", () => {
  const source = mutateSource((value) => {
    const props = sourceRoot(value).props;
    sourceRoot(value).props = Object.assign(Object.create(null), props);
  });
  assert.throws(
    () => desenSourceToA2uiStream(source),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.STACK_PROP_UNSUPPORTED),
  );
  const stream = mutateStream((value) => {
    value[0] = Object.assign(Object.create(null), value[0]);
  });
  assert.throws(
    () => a2uiStreamToDesenSource(stream),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.A2UI_STREAM_UNSUPPORTED),
  );
});

test("does not invoke inherited Object.prototype dispatch getters", () => {
  const cases = [
    {
      property: "version",
      code: SC01_A2UI_REJECTION_CODES.A2UI_VERSION_UNSUPPORTED,
      input() {
        return mutateStream((stream) => {
          delete stream[0].version;
        });
      },
    },
    {
      property: "id",
      code: SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_ID_UNSUPPORTED,
      input() {
        return mutateStream((stream) => {
          delete stream[1].updateComponents.components[1].id;
        });
      },
    },
    {
      property: "component",
      code: SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
      input() {
        return mutateStream((stream) => {
          delete stream[1].updateComponents.components[1].component;
        });
      },
    },
  ];
  for (const { property, code, input } of cases) {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, property);
    let getterCalls = 0;
    Object.defineProperty(Object.prototype, property, {
      configurable: true,
      get() {
        getterCalls += 1;
        throw new Error(`inherited ${property} getter must not execute`);
      },
    });
    try {
      assert.throws(
        () => a2uiStreamToDesenSource(input()),
        (error) => expectCode(error, code),
      );
    } finally {
      if (previous === undefined) Reflect.deleteProperty(Object.prototype, property);
      else Object.defineProperty(Object.prototype, property, previous);
    }
    assert.equal(getterCalls, 0);
  }
});

test("rejects enum-like objects without PropertyKey coercion or caller hooks", () => {
  const targets = [
    {
      acceptedString: "vertical",
      code: SC01_A2UI_REJECTION_CODES.STACK_DIRECTION_UNSUPPORTED,
      input(value) {
        return mutateSource((source) => {
          sourceRoot(source).props.direction = value;
        });
      },
      convert: desenSourceToA2uiStream,
    },
    {
      acceptedString: "body",
      code: SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
      input(value) {
        return mutateSource((source) => {
          firstText(source).props.role = value;
        });
      },
      convert: desenSourceToA2uiStream,
    },
    {
      acceptedString: "body",
      code: SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
      input(value) {
        return mutateStream((stream) => {
          stream[1].updateComponents.components[1].variant = value;
        });
      },
      convert: a2uiStreamToDesenSource,
    },
  ];
  for (const target of targets) {
    const ordinaryJsonObject = JSON.parse('{"toString":null}');
    assert.throws(
      () => target.convert(target.input(ordinaryJsonObject)),
      (error) => expectCode(error, target.code),
    );

    let primitiveHookCalls = 0;
    const primitiveHookObject = {
      [Symbol.toPrimitive]() {
        primitiveHookCalls += 1;
        return target.acceptedString;
      },
    };
    assert.throws(
      () => target.convert(target.input(primitiveHookObject)),
      (error) => expectCode(error, target.code),
    );
    assert.equal(primitiveHookCalls, 0);

    let proxyHookCalls = 0;
    const proxy = new Proxy(
      {},
      {
        get() {
          proxyHookCalls += 1;
          throw new Error("enum Proxy getter must never execute");
        },
        getOwnPropertyDescriptor() {
          proxyHookCalls += 1;
          throw new Error("enum Proxy descriptor trap must never execute");
        },
        ownKeys() {
          proxyHookCalls += 1;
          throw new Error("enum Proxy ownKeys trap must never execute");
        },
      },
    );
    assert.throws(
      () => target.convert(target.input(proxy)),
      (error) => expectCode(error, target.code),
    );
    assert.equal(proxyHookCalls, 0);
  }
});

test("rejects identity, Catalog, root, and component drift", () => {
  const cases = [
    [
      SC01_A2UI_REJECTION_CODES.SOURCE_IDENTITY_UNSUPPORTED,
      (source) => {
        source.entry = "other";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.CATALOG_UNSUPPORTED,
      (source) => {
        source.catalogs[0].version = "2.0.0";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.ROOT_ID_UNSUPPORTED,
      (source) => {
        sourceRoot(source).id = "layout";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.COMPONENT_UNSUPPORTED,
      (source) => {
        firstText(source).use = "com.example.ui/Button";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.COMPONENT_ID_UNSUPPORTED,
      (source) => {
        firstText(source).id = "root";
      },
    ],
  ];
  for (const [code, mutator] of cases) {
    assert.throws(
      () => desenSourceToA2uiStream(mutateSource(mutator)),
      (error) => expectCode(error, code),
    );
  }
});

test("rejects A2UI version, Catalog alias, theme, state, action, and dynamic values", () => {
  const cases = [
    [
      SC01_A2UI_REJECTION_CODES.A2UI_VERSION_UNSUPPORTED,
      (stream) => {
        stream[0].version = "v0.9";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_CATALOG_UNSUPPORTED,
      (stream) => {
        stream[0].createSurface.catalogId =
          "https://a2ui.org/specification/v0_9_1/catalogs/basic/catalog.json";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_THEME_UNSUPPORTED,
      (stream) => {
        stream[0].createSurface.theme = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_STATE_UNSUPPORTED,
      (stream) => {
        stream[1] = {
          version: "v0.9.1",
          updateDataModel: { surfaceId: "bridge-demo", value: {} },
        };
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_ACTION_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components[1].onPress = {};
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_DYNAMIC_VALUE_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components[1].text = { path: "/title" };
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components[0].children = {
          componentId: "title",
          path: "/items",
        };
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.STACK_ALIGN_UNSUPPORTED,
      (stream) => {
        delete stream[1].updateComponents.components[0].align;
      },
    ],
  ];
  for (const [code, mutator] of cases) {
    assert.throws(
      () => a2uiStreamToDesenSource(mutateStream(mutator)),
      (error) => expectCode(error, code),
    );
  }
});

test("rejects official A2UI fields and components outside the exact subset", () => {
  const cases = [
    (stream) => {
      stream[1].updateComponents.components[0].justify = "center";
    },
    (stream) => {
      stream[1].updateComponents.components[1].weight = 1;
    },
    (stream) => {
      stream[1].updateComponents.components[1].component = "Button";
    },
    (stream) => {
      stream[1].updateComponents.components[1].variant = "h1";
    },
  ];
  const codes = [
    SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
    SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
    SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_UNSUPPORTED,
    SC01_A2UI_REJECTION_CODES.TEXT_ROLE_UNSUPPORTED,
  ];
  for (let index = 0; index < cases.length; index += 1) {
    assert.throws(
      () => a2uiStreamToDesenSource(mutateStream(cases[index])),
      (error) => expectCode(error, codes[index]),
    );
  }
});

test("rejects malformed A2UI component graphs and noncanonical ordering", () => {
  const graphCases = [
    [
      SC01_A2UI_REJECTION_CODES.A2UI_COMPONENT_ID_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components[1].id = "root";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components[0].children[0] = "missing";
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_ROOT_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components[2].children.push("root");
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components[0].children.push("title");
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_CHILDREN_UNSUPPORTED,
      (stream) => {
        stream[1].updateComponents.components.push({
          id: "orphan",
          component: "Text",
          text: "Orphan",
          variant: "body",
        });
      },
    ],
    [
      SC01_A2UI_REJECTION_CODES.A2UI_NON_CANONICAL,
      (stream) => {
        const components = stream[1].updateComponents.components;
        [components[1], components[2]] = [components[2], components[1]];
      },
    ],
  ];
  for (const [code, mutator] of graphCases) {
    assert.throws(
      () => a2uiStreamToDesenSource(mutateStream(mutator)),
      (error) => expectCode(error, code),
    );
  }
});

test("rejects output that fails the pinned official schema", async () => {
  const invalid = mutateStream((stream) => {
    stream[0].createSurface.unknown = true;
  });
  await assert.rejects(validateA2uiStreamAgainstPinnedSchemas(invalid), (error) =>
    expectCode(error, SC01_A2UI_REJECTION_CODES.A2UI_SCHEMA_INVALID),
  );
});

test("fails closed when any pinned official schema byte changes", async (t) => {
  const directory = await temporaryDirectory(t);
  const fixtureDirectory = path.join(directory, "0.9.1");
  await cp(DEFAULT_SC01_A2UI_FIXTURE_DIRECTORY, fixtureDirectory, {
    recursive: true,
  });
  const catalogPath = path.join(fixtureDirectory, "basic-catalog.json");
  const catalogBytes = await readFile(catalogPath);
  catalogBytes[catalogBytes.length - 2] ^= 1;
  await writeFile(catalogPath, catalogBytes);
  await assert.rejects(
    validateA2uiStreamAgainstPinnedSchemas(desenSourceToA2uiStream(createSc01DesenFixture()), {
      fixtureDirectory,
    }),
    (error) => expectCode(error, SC01_A2UI_REJECTION_CODES.FIXTURE_INTEGRITY_FAILED),
  );
});

test("builds byte-identical proof evidence with all roundtrips and rejections", async () => {
  const first = await baselinePromise;
  const second = await buildSc01A2uiBridgeEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.result, "PASS");
  assert.equal(first.artifact.profileId, "SC01_STATIC_TEXT_V1");
  assert.equal(first.artifact.scope.productionPackageApiChanged, false);
  assert.equal(first.artifact.schemaValidation.result, "PASS");
  assert.deepEqual(first.artifact.schemaValidation.desenSource, {
    sample: "PASS",
    decodedRoundtrip: "PASS",
    schemaSha256: "sha256:5ce5d541991940676ce0d3705e5b0658cd60f31025be8bfb96aec21a3116dba3",
  });
  assert.deepEqual(first.artifact.schemaValidation.desenCatalog, {
    result: "PASS",
    schemaSha256: "sha256:51014ab088b6a483502fd6aee5eed9fc4451be55556b6bd6220a5a6a1b610555",
    exampleSha256: "sha256:7b9a8bad7b49340dc2a5f818ac008feb403fb43c8c476eecba5e1fcbdf3bf45d",
    stackTextContract: "PASS",
  });
  assert.deepEqual(first.artifact.subset.finiteBounds, {
    maximumComponents: 256,
    maximumNodeDepthFromRoot: 32,
    rootDepth: 0,
    maximumTextUtf16CodeUnits: 4096,
  });
  assert.equal(first.artifact.streamContract.rowColumnAlign, "explicit and required");
  assert.ok(
    first.artifact.scope.nonClaims.includes(
      "rendered pixels, HTML, DOM, CSS, or accessibility-tree parity",
    ),
  );
  assert.equal(first.artifact.roundtrips.desenToA2uiToDesen.result, "PASS");
  assert.equal(first.artifact.roundtrips.a2uiToDesenToA2ui.result, "PASS");
  assert.equal(first.artifact.positiveCoverage.vectorCount, 1029);
  assert.deepEqual(first.artifact.positiveCoverage.categoryCounts, {
    textRoot: 1,
    emptyStack: 1,
    mappingMatrix: 24,
    depthBoundary: 1,
    componentBoundary: 1,
    unicodeTextAndPrototypeNamedIds: 1,
    seededTrees: 1000,
  });
  assert.deepEqual(first.artifact.positiveCoverage.exactRoundtrips, {
    desenToA2uiToDesen: 1029,
    a2uiToDesenToA2ui: 1029,
  });
  assert.deepEqual(first.artifact.positiveCoverage.schemaValidations, {
    desenSources: 1029,
    a2uiStreams: 1029,
    a2uiMessages: 2058,
  });
  assert.deepEqual(first.artifact.positiveCoverage.deterministicCorpus, {
    generator: "Park-Miller minimal standard PRNG",
    seed: 20260724,
    seededTreeCount: 1000,
  });
  assert.equal(
    first.artifact.positiveCoverage.aggregateReceipt.sha256,
    "sha256:57b173a684633743c6ab1806e68b00f5b7143fed1f734c32bd7f5afedb7a614e",
  );
  assert.deepEqual(first.artifact.positiveCoverage.boundaries.depth, {
    rootDepth: 0,
    maximumAcceptedDepthFromRoot: 32,
    acceptedLevelsIncludingRoot: 33,
    firstRejectedDepthFromRoot: 33,
    rejectionVectorIds: ["desen-depth-33", "a2ui-depth-33"],
  });
  assert.deepEqual(first.artifact.positiveCoverage.boundaries.components, {
    maximumAccepted: 256,
    firstRejected: 257,
    rejectionVectorIds: ["desen-components-257", "a2ui-components-257"],
  });
  assert.equal(first.artifact.rejections.count, 34);
  assert.equal(first.artifact.rejections.stableCodes.length, first.artifact.rejections.count);
  assert.ok(
    first.artifact.implementation.trackedFiles.some(
      ({ path: entryPath }) => entryPath === "scripts/lib/sc-01-a2ui-bridge-spike.mjs",
    ),
  );
});

test("writes through the shared atomic proof writer and verifies exact bytes", async (t) => {
  const directory = await temporaryDirectory(t);
  const artifactPath = path.join(directory, "sc-01-proof.json");
  const written = await writeSc01A2uiBridgeEvidence({ artifactPath });
  assert.equal(written.result, "PASS");
  assert.equal(written.positiveVectors, 1029);
  const verification = await verifySc01A2uiBridgeEvidence({ artifactPath });
  assert.equal(verification.result, "PASS");
  assert.equal(verification.roundtrips, 2);
  assert.equal(verification.positiveVectors, 1029);
  assert.equal(verification.rejections, 34);
});

test("detects proof presentation tampering", async () => {
  const baseline = await baselinePromise;
  const tampered = Buffer.from(baseline.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(verifySc01A2uiBridgeEvidence({ artifactBytes: tampered }), (error) =>
    expectCode(error, SC01_A2UI_REJECTION_CODES.PROOF_DRIFT),
  );
});

test("keeps test paths rooted in this workspace", () => {
  assert.equal(
    path.resolve(TEST_DIRECTORY, "fixtures/standards/a2ui/0.9.1"),
    DEFAULT_SC01_A2UI_FIXTURE_DIRECTORY,
  );
});
