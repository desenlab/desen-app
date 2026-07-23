import { describe, expect, it } from "vitest";

import {
  createWebReactPackageDigest,
  encodeWebReactPackageDigestPreimage,
  verifyWebReactPackageDigest,
  WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  WEB_REACT_PACKAGE_DIGEST_PROFILE,
} from "../src/index.js";

import type { DesenCatalog } from "@desen/protocol";
import type {
  WebReactPackageArtifactInput,
  WebReactPackageDigestCalculationInput,
} from "../src/index.js";

const MAGIC_TEXT = "DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n";
const BASE_CATALOG = {
  kind: "desen.catalog",
  desen: "0.1.0",
  id: "com.example.reference",
  version: "1.0.0",
  target: "web-react",
  packageDigest: WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  components: {},
  behaviors: {},
  operations: {},
  resources: {},
} satisfies DesenCatalog;

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function decodeAscii(value: Uint8Array): string {
  return String.fromCharCode(...value);
}

function createInput(
  artifacts: readonly WebReactPackageArtifactInput[] = [
    { path: "adapters/production.js", bytes: ascii("export const render = 1;\n") },
    { path: "styles/reference.css", bytes: ascii(".root{display:block}\n") },
  ],
  catalog: DesenCatalog = BASE_CATALOG,
): WebReactPackageDigestCalculationInput {
  return { catalog, artifacts };
}

function parsePreimage(
  bytes: Uint8Array,
): readonly Readonly<{ path: string; content: Uint8Array }>[] {
  expect(decodeAscii(bytes.slice(0, MAGIC_TEXT.length))).toBe(MAGIC_TEXT);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = MAGIC_TEXT.length;
  const entryCount = view.getUint32(offset);
  offset += 4;
  const entries: { path: string; content: Uint8Array }[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    const pathLength = view.getUint16(offset);
    offset += 2;
    const path = decodeAscii(bytes.slice(offset, offset + pathLength));
    offset += pathLength;
    const contentLength = view.getUint32(offset);
    offset += 4;
    const content = bytes.slice(offset, offset + contentLength);
    offset += contentLength;
    entries.push({ path, content });
  }
  expect(offset).toBe(bytes.length);
  return entries;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Object.keys(value)) {
    expectDeeplyFrozen((value as Record<string, unknown>)[key]);
  }
}

function unsafeInput(value: unknown): WebReactPackageDigestCalculationInput {
  return value as WebReactPackageDigestCalculationInput;
}

describe("Web-React package digest profile", () => {
  it("exposes a deeply frozen, bounded, target-specific profile", () => {
    expect(WEB_REACT_PACKAGE_DIGEST_PROFILE).toEqual({
      id: "desen.web-react.package-digest",
      version: 1,
      target: "web-react",
      catalogPath: "catalog.json",
      catalogDigestPlaceholder: `sha256:${"0".repeat(64)}`,
      catalogDigestProjection: "replace-top-level-packageDigest-with-placeholder",
      pathOrdering: "lowercase-ascii-ascending",
      framing:
        "magic + uint32be(entry-count) + repeated uint16be(path-bytes), path, uint32be(content-bytes), content",
      limits: {
        artifacts: 1_024,
        catalogDepth: 128,
        catalogNodes: 100_000,
        entryBytes: 16 * 1_024 * 1_024,
        pathBytes: 240,
        preimageBytes: 64 * 1_024 * 1_024,
      },
    });
    expectDeeplyFrozen(WEB_REACT_PACKAGE_DIGEST_PROFILE);
  });

  it("matches the fixed framing and package digest golden", () => {
    const input = createInput();
    const preimage = encodeWebReactPackageDigestPreimage(input);
    const description = createWebReactPackageDigest(input);
    const entries = parsePreimage(preimage);

    expect(description).toMatchObject({
      profile: "desen.web-react.package-digest",
      profileVersion: 1,
      target: "web-react",
      packageDigest: "sha256:5a706536f9319476d39883bd2a4fddb9fb839c261e82452de397983d2edceadd",
      byteLength: 416,
      entries: [
        {
          path: "adapters/production.js",
          byteLength: 25,
          contentDigest: "sha256:b2e2b6c992639fddf7f115a56d7b9faccb4566173a0e025a182085813d8c2ecb",
        },
        {
          path: "catalog.json",
          byteLength: 260,
          contentDigest: "sha256:0975098bee5576f66837b27e9d16ca21bc723d5f3b8aa2fd4b802e8c8d011d3f",
        },
        {
          path: "styles/reference.css",
          byteLength: 21,
          contentDigest: "sha256:930ff58255d0f4b62610b42dcca5c7b4ca0156aa5e9cb18e3a0e7066379daa28",
        },
      ],
    });
    expect(preimage).toHaveLength(416);
    expect(entries.map(({ path }) => path)).toEqual([
      "adapters/production.js",
      "catalog.json",
      "styles/reference.css",
    ]);
    expect(decodeAscii(entries[0]?.content ?? new Uint8Array())).toBe("export const render = 1;\n");
    expect(decodeAscii(entries[1]?.content ?? new Uint8Array())).toBe(
      `{"behaviors":{},"components":{},"desen":"0.1.0","id":"com.example.reference","kind":"desen.catalog","operations":{},"packageDigest":"${WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER}","resources":{},"target":"web-react","version":"1.0.0"}`,
    );
    expect(decodeAscii(entries[2]?.content ?? new Uint8Array())).toBe(".root{display:block}\n");
  });

  it("is independent of Catalog key insertion order and artifact-list order", () => {
    const first = createInput();
    const reorderedCatalog = {
      resources: {},
      operations: {},
      behaviors: {},
      components: {},
      packageDigest: WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
      target: "web-react",
      version: "1.0.0",
      id: "com.example.reference",
      desen: "0.1.0",
      kind: "desen.catalog",
    } satisfies DesenCatalog;
    const second = createInput([...first.artifacts].reverse(), reorderedCatalog);

    expect(encodeWebReactPackageDigestPreimage(first)).toEqual(
      encodeWebReactPackageDigestPreimage(second),
    );
    expect(createWebReactPackageDigest(first).packageDigest).toBe(
      createWebReactPackageDigest(second).packageDigest,
    );
  });

  it("verifies a published Catalog without mutating its self-referential digest field", () => {
    const template = createInput();
    const calculated = createWebReactPackageDigest(template);
    const publishedCatalog = {
      ...BASE_CATALOG,
      packageDigest: calculated.packageDigest,
    };
    const published = createInput(template.artifacts, publishedCatalog);
    const before = JSON.stringify(publishedCatalog);

    expect(verifyWebReactPackageDigest(published)).toEqual(calculated);
    expect(JSON.stringify(publishedCatalog)).toBe(before);
    expect(publishedCatalog.packageDigest).toBe(calculated.packageDigest);

    expect(() =>
      verifyWebReactPackageDigest(
        createInput(template.artifacts, {
          ...publishedCatalog,
          packageDigest: `sha256:${"f".repeat(64)}`,
        }),
      ),
    ).toThrow(/declared .* but calculated/u);
  });

  it("changes the package digest for every exact content, path, or Catalog change", () => {
    const baseline = createWebReactPackageDigest(createInput()).packageDigest;
    const mutations = [
      createInput([
        { path: "adapters/production.js", bytes: ascii("export const render = 2;\n") },
        { path: "styles/reference.css", bytes: ascii(".root{display:block}\n") },
      ]),
      createInput([
        { path: "adapters/production-v2.js", bytes: ascii("export const render = 1;\n") },
        { path: "styles/reference.css", bytes: ascii(".root{display:block}\n") },
      ]),
      createInput(undefined, { ...BASE_CATALOG, version: "1.0.1" }),
    ];

    for (const mutation of mutations) {
      expect(createWebReactPackageDigest(mutation).packageDigest).not.toBe(baseline);
    }
  });

  it("returns detached fresh bytes and deeply frozen byte-free audit metadata", () => {
    const adapterBytes = ascii("adapter");
    const input = createInput([{ path: "adapters/production.js", bytes: adapterBytes }]);
    const firstBytes = encodeWebReactPackageDigestPreimage(input);
    const firstDescription = createWebReactPackageDigest(input);
    const firstDigest = firstDescription.packageDigest;

    firstBytes.fill(0);
    const secondBytes = encodeWebReactPackageDigestPreimage(input);
    expect(secondBytes.some((byte) => byte !== 0)).toBe(true);
    expect(createWebReactPackageDigest(input).packageDigest).toBe(firstDigest);
    expectDeeplyFrozen(firstDescription);
    expect(firstDescription.entries).toEqual([
      {
        path: "adapters/production.js",
        byteLength: 7,
        contentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
      {
        path: "catalog.json",
        byteLength: expect.any(Number),
        contentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
    ]);

    adapterBytes[0] = "A".charCodeAt(0);
    expect(firstDescription.packageDigest).toBe(firstDigest);
    expect(createWebReactPackageDigest(input).packageDigest).not.toBe(firstDigest);
  });

  it("reads the exact Uint8Array subview rather than adjacent backing-buffer bytes", () => {
    const backing = ascii("xadaptery");
    const subview = backing.subarray(1, backing.length - 1);
    const direct = ascii("adapter");

    expect(
      createWebReactPackageDigest(
        createInput([{ path: "adapters/production.js", bytes: subview }]),
      ),
    ).toEqual(
      createWebReactPackageDigest(createInput([{ path: "adapters/production.js", bytes: direct }])),
    );
  });

  it("does not mutate caller-owned Catalogs, lists, records, or bytes", () => {
    const bytes = ascii("adapter");
    const artifact = { path: "adapters/production.js", bytes };
    const artifacts = [artifact];
    const catalog = structuredClone(BASE_CATALOG);
    const beforeCatalog = JSON.stringify(catalog);
    const beforeBytes = [...bytes];

    createWebReactPackageDigest({ catalog, artifacts });

    expect(JSON.stringify(catalog)).toBe(beforeCatalog);
    expect(artifacts).toEqual([artifact]);
    expect(artifact).toEqual({ path: "adapters/production.js", bytes });
    expect([...bytes]).toEqual(beforeBytes);
    expect(Object.isFrozen(catalog)).toBe(false);
    expect(Object.isFrozen(artifacts)).toBe(false);
    expect(Object.isFrozen(artifact)).toBe(false);
  });

  it("accepts an empty target-artifact inventory while still fingerprinting the Catalog", () => {
    const description = createWebReactPackageDigest(createInput([]));

    expect(description.entries).toHaveLength(1);
    expect(description.entries[0]?.path).toBe("catalog.json");
    expect(parsePreimage(encodeWebReactPackageDigestPreimage(createInput([])))).toHaveLength(1);
  });

  it("rejects the wrong Catalog identity, protocol, target, or digest preimage value", () => {
    for (const catalog of [
      { ...BASE_CATALOG, kind: "desen.bundle" },
      { ...BASE_CATALOG, desen: "0.2.0" },
      { ...BASE_CATALOG, target: "react-native" },
      { ...BASE_CATALOG, packageDigest: `sha256:${"1".repeat(64)}` },
    ]) {
      expect(() => createWebReactPackageDigest(createInput([], catalog as DesenCatalog))).toThrow(
        TypeError,
      );
    }
  });

  it("rejects reserved, duplicate, nonportable, ambiguous, and overlong paths", () => {
    const invalidPaths = [
      "",
      "catalog.json",
      "/absolute.js",
      "trailing/",
      "double//segment.js",
      "../escape.js",
      "a/../escape.js",
      "Upper.js",
      "unicode-é.js",
      "back\\slash.js",
      "dot/.",
      "dash-",
      "percent%2fescape.js",
      "con",
      "devices/prn.txt",
      "devices/aux.data.json",
      "devices/nul.js",
      "devices/com1.bin",
      "devices/lpt9.css",
      `${"a".repeat(238)}.js`,
    ];
    for (const path of invalidPaths) {
      expect(
        () => createWebReactPackageDigest(createInput([{ path, bytes: new Uint8Array() }])),
        path,
      ).toThrow(TypeError);
    }

    expect(() =>
      createWebReactPackageDigest(
        createInput([
          { path: "adapters/a.js", bytes: new Uint8Array() },
          { path: "adapters/a.js", bytes: new Uint8Array() },
        ]),
      ),
    ).toThrow(/duplicate path/u);
  });

  it("accepts the maximum portable path length", () => {
    const path = `${"a".repeat(237)}.js`;
    expect(path).toHaveLength(240);
    expect(() =>
      createWebReactPackageDigest(createInput([{ path, bytes: new Uint8Array() }])),
    ).not.toThrow();
  });

  it("enforces byte-view and deterministic resource limits", () => {
    for (const bytes of [
      [],
      new Uint16Array([1]),
      new DataView(new ArrayBuffer(1)),
      new Uint8Array(16 * 1_024 * 1_024 + 1),
    ]) {
      expect(() =>
        createWebReactPackageDigest(
          unsafeInput({
            catalog: BASE_CATALOG,
            artifacts: [{ path: "adapters/a.js", bytes }],
          }),
        ),
      ).toThrow(TypeError);
    }

    if (typeof SharedArrayBuffer !== "undefined") {
      expect(() =>
        createWebReactPackageDigest(
          createInput([
            {
              path: "adapters/a.js",
              bytes: new Uint8Array(new SharedArrayBuffer(1)),
            },
          ]),
        ),
      ).toThrow(/SharedArrayBuffer/u);
    }

    const maximumEntry = new Uint8Array(16 * 1_024 * 1_024);
    expect(() =>
      createWebReactPackageDigest(
        createInput(
          ["a", "b", "c", "d"].map((name) => ({
            path: `assets/${name}.bin`,
            bytes: maximumEntry,
          })),
        ),
      ),
    ).toThrow(/framed preimage exceeds the 67108864-byte limit/u);

    let deeplyNested: Record<string, unknown> = { leaf: null };
    for (let depth = 0; depth < 129; depth += 1) {
      deeplyNested = { next: deeplyNested };
    }
    expect(() =>
      createWebReactPackageDigest(
        createInput([], {
          ...BASE_CATALOG,
          extensions: deeplyNested,
        } as DesenCatalog),
      ),
    ).toThrow(/128-level depth limit/u);

    let depthBoundaryDescriptorObservations = 0;
    const depthBoundary = new Proxy(
      { child: null },
      {
        getOwnPropertyDescriptor(target, property) {
          depthBoundaryDescriptorObservations += 1;
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );
    let depthBoundaryChain: unknown = depthBoundary;
    for (let depth = 0; depth < 127; depth += 1) {
      depthBoundaryChain = { next: depthBoundaryChain };
    }
    expect(() =>
      createWebReactPackageDigest(
        createInput([], {
          ...BASE_CATALOG,
          extensions: depthBoundaryChain,
        } as unknown as DesenCatalog),
      ),
    ).toThrow(/128-level depth limit/u);
    expect(depthBoundaryDescriptorObservations).toBe(0);

    expect(() =>
      createWebReactPackageDigest(
        createInput([], {
          ...BASE_CATALOG,
          extensions: new Array(100_001),
        } as unknown as DesenCatalog),
      ),
    ).toThrow(/100000-node limit/u);

    let fanoutOwnKeyObservations = 0;
    let fanoutDescriptorObservations = 0;
    const sharedFanout = new Proxy(new Array<null>(50_000).fill(null), {
      ownKeys(target) {
        fanoutOwnKeyObservations += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, property) {
        fanoutDescriptorObservations += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
    expect(() =>
      createWebReactPackageDigest(
        createInput([], {
          ...BASE_CATALOG,
          extensions: { first: sharedFanout, second: sharedFanout },
        } as unknown as DesenCatalog),
      ),
    ).toThrow(/100000-node limit/u);
    expect(fanoutOwnKeyObservations).toBe(1);
    expect(fanoutDescriptorObservations).toBe(50_002);

    const sharedLargeValue = "x".repeat(1 * 1_024 * 1_024);
    expect(() =>
      createWebReactPackageDigest(
        createInput([], {
          ...BASE_CATALOG,
          extensions: Object.fromEntries(
            Array.from({ length: 17 }, (_, index) => [`value${String(index)}`, sharedLargeValue]),
          ),
        } as DesenCatalog),
      ),
    ).toThrow(/canonical Catalog exceeds the 16777216-byte limit/u);

    expect(() =>
      createWebReactPackageDigest(
        createInput([], {
          ...BASE_CATALOG,
          extensions: {
            scalars: [null, true, false, -0, 1e30],
            text: '"\\\b\t\n\f\r\u0000é😀',
          },
        } as DesenCatalog),
      ),
    ).not.toThrow();

    expect(() =>
      createWebReactPackageDigest(
        createInput([], {
          ...BASE_CATALOG,
          extensions: { invalidUnicode: "\ud800" },
        } as DesenCatalog),
      ),
    ).toThrow(/unpaired high surrogate/u);
  });

  it("rejects sparse or decorated artifact arrays and the count above the profile limit", () => {
    expect(() =>
      createWebReactPackageDigest(unsafeInput({ catalog: BASE_CATALOG, artifacts: new Array(1) })),
    ).toThrow(TypeError);

    const decorated: WebReactPackageArtifactInput[] & { extra?: boolean } = [];
    decorated.extra = true;
    expect(() =>
      createWebReactPackageDigest(unsafeInput({ catalog: BASE_CATALOG, artifacts: decorated })),
    ).toThrow(TypeError);

    const tooMany = Array.from({ length: 1_025 }, (_, index) => ({
      path: `files/${String(index)}.js`,
      bytes: new Uint8Array(),
    }));
    expect(() => createWebReactPackageDigest(createInput(tooMany))).toThrow(/1024-artifact limit/u);
  });

  it("rejects unknown wrapper or artifact fields", () => {
    expect(() =>
      createWebReactPackageDigest(
        unsafeInput({ catalog: BASE_CATALOG, artifacts: [], adapter: "hidden" }),
      ),
    ).toThrow(TypeError);
    expect(() =>
      createWebReactPackageDigest(
        unsafeInput({
          catalog: BASE_CATALOG,
          artifacts: [{ path: "adapters/a.js", bytes: new Uint8Array(), role: "production" }],
        }),
      ),
    ).toThrow(TypeError);
  });

  it("rejects accessors without invoking them and snapshots Catalog identity once", () => {
    let invoked = false;
    const artifact = Object.defineProperties(
      {},
      {
        path: {
          enumerable: true,
          value: "adapters/a.js",
        },
        bytes: {
          enumerable: true,
          get() {
            invoked = true;
            return new Uint8Array();
          },
        },
      },
    );
    expect(() =>
      createWebReactPackageDigest(unsafeInput({ catalog: BASE_CATALOG, artifacts: [artifact] })),
    ).toThrow(TypeError);
    expect(invoked).toBe(false);

    const catalog = Object.defineProperty(structuredClone(BASE_CATALOG), "target", {
      enumerable: true,
      get() {
        invoked = true;
        return "web-react";
      },
    });
    expect(() => createWebReactPackageDigest(createInput([], catalog as DesenCatalog))).toThrow(
      TypeError,
    );
    expect(invoked).toBe(false);

    let targetObservations = 0;
    const statefulCatalog = new Proxy(structuredClone(BASE_CATALOG), {
      getOwnPropertyDescriptor(target, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        if (property !== "target" || descriptor === undefined || !("value" in descriptor)) {
          return descriptor;
        }
        targetObservations += 1;
        return {
          ...descriptor,
          value: targetObservations === 1 ? "web-react" : "react-native",
        };
      },
    });
    expect(() =>
      createWebReactPackageDigest(createInput([], statefulCatalog as DesenCatalog)),
    ).not.toThrow();
    expect(targetObservations).toBe(1);
  });

  it("retains byte-level distinctions such as line endings and UTF-8 spelling", () => {
    const lf = createInput([{ path: "adapters/a.js", bytes: ascii("a\n") }]);
    const crlf = createInput([{ path: "adapters/a.js", bytes: ascii("a\r\n") }]);
    const composed = createInput([{ path: "assets/label.txt", bytes: Uint8Array.of(0xc3, 0xa9) }]);
    const decomposed = createInput([
      { path: "assets/label.txt", bytes: Uint8Array.of(0x65, 0xcc, 0x81) },
    ]);

    expect(createWebReactPackageDigest(lf).packageDigest).not.toBe(
      createWebReactPackageDigest(crlf).packageDigest,
    );
    expect(createWebReactPackageDigest(composed).packageDigest).not.toBe(
      createWebReactPackageDigest(decomposed).packageDigest,
    );
  });

  it("separates entry boundaries even when concatenated path and content bytes look alike", () => {
    const first = createInput([
      { path: "files/a", bytes: ascii("bc") },
      { path: "files/d", bytes: ascii("e") },
    ]);
    const second = createInput([
      { path: "files/a", bytes: ascii("b") },
      { path: "files/cd", bytes: ascii("e") },
    ]);

    expect(encodeWebReactPackageDigestPreimage(first)).not.toEqual(
      encodeWebReactPackageDigestPreimage(second),
    );
    expect(createWebReactPackageDigest(first).packageDigest).not.toBe(
      createWebReactPackageDigest(second).packageDigest,
    );
  });
});
