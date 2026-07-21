import { describe, expect, it } from "vitest";

import {
  calculateDesenBundleRevision,
  calculateDesenSourceDigest,
  canonicalizeJson,
  canonicalizeJsonBytes,
  digestCanonicalJson,
  isSha256Digest,
  sha256Bytes,
  sha256Digest,
  sha256Hex,
} from "../src/index.js";

const RFC_CANONICAL_TEXT = `{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA'B\\"\\\\\\\\\\"/"}`;
const RFC_CANONICAL_HEX =
  "7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d32375d2c22737472696e67223a22e282ac245c75303030665c6e4127425c225c5c5c5c5c222f227d";
const RFC_CANONICAL_SHA256 = "2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function numberFromIeee754Hex(bits: string): number {
  const bytes = new Uint8Array(8);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 2, index * 2 + 2), 16);
  }
  return new DataView(bytes.buffer).getFloat64(0);
}

describe("RFC 8785 canonicalization", () => {
  it("matches the RFC canonical text, UTF-8 bytes, and independent SHA-256 golden", () => {
    const input = {
      numbers: [Number("333333333.33333329"), 1e30, 4.5, 2e-3, 1e-27],
      string: `€$\u000f\nA'B"\\\\"/`,
      literals: [null, true, false],
    };

    expect(canonicalizeJson(input)).toBe(RFC_CANONICAL_TEXT);
    expect(bytesToHex(canonicalizeJsonBytes(input))).toBe(RFC_CANONICAL_HEX);
    expect(sha256Hex(canonicalizeJsonBytes(input))).toBe(RFC_CANONICAL_SHA256);
    expect(digestCanonicalJson(input)).toBe(`sha256:${RFC_CANONICAL_SHA256}`);
  });

  it("sorts recursively by raw UTF-16 code units while preserving array order", () => {
    const rfcSortVector = {
      "€": "Euro Sign",
      "\r": "Carriage Return",
      דּ: "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "😀": "Emoji: Grinning Face",
      "\u0080": "Control",
      ö: "Latin Small Letter O With Diaeresis",
    };

    expect(canonicalizeJson(rfcSortVector)).toBe(
      `{"\\r":"Carriage Return","1":"One","":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}`,
    );
    expect(
      canonicalizeJson([
        { z: 1, a: 2 },
        { b: 3, a: 4 },
      ]),
    ).toBe(`[{"a":2,"z":1},{"a":4,"b":3}]`);
    expect(canonicalizeJson({ ab: 4, aa: 3, a: 2, "": 1 })).toBe(`{"":1,"a":2,"aa":3,"ab":4}`);
  });

  it("matches every finite number serialization sample in RFC 8785 Appendix B", () => {
    const vectors = [
      ["0000000000000000", "0"],
      ["8000000000000000", "0"],
      ["0000000000000001", "5e-324"],
      ["8000000000000001", "-5e-324"],
      ["7fefffffffffffff", "1.7976931348623157e+308"],
      ["ffefffffffffffff", "-1.7976931348623157e+308"],
      ["4340000000000000", "9007199254740992"],
      ["c340000000000000", "-9007199254740992"],
      ["4430000000000000", "295147905179352830000"],
      ["44b52d02c7e14af5", "9.999999999999997e+22"],
      ["44b52d02c7e14af6", "1e+23"],
      ["44b52d02c7e14af7", "1.0000000000000001e+23"],
      ["444b1ae4d6e2ef4e", "999999999999999700000"],
      ["444b1ae4d6e2ef4f", "999999999999999900000"],
      ["444b1ae4d6e2ef50", "1e+21"],
      ["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
      ["3eb0c6f7a0b5ed8d", "0.000001"],
      ["41b3de4355555553", "333333333.3333332"],
      ["41b3de4355555554", "333333333.33333325"],
      ["41b3de4355555555", "333333333.3333333"],
      ["41b3de4355555556", "333333333.3333334"],
      ["41b3de4355555557", "333333333.33333343"],
      ["becbf647612f3696", "-0.0000033333333333333333"],
      ["43143ff3c1cb0959", "1424953923781206.2"],
    ] as const;

    for (const [bits, expected] of vectors) {
      expect(canonicalizeJson(numberFromIeee754Hex(bits)), bits).toBe(expected);
    }
  });

  it("preserves Unicode spelling and rejects lone surrogates", () => {
    expect(canonicalizeJson("é")).toBe(`"é"`);
    expect(canonicalizeJson("e\u0301")).toBe(`"é"`);
    expect(digestCanonicalJson("é")).not.toBe(digestCanonicalJson("e\u0301"));
    expect(canonicalizeJson("😀")).toBe(`"😀"`);
    expect(bytesToHex(canonicalizeJsonBytes("😀"))).toBe("22f09f988022");

    expect(() => canonicalizeJson("\ud800")).toThrow(TypeError);
    expect(() => canonicalizeJson("\udc00")).toThrow(TypeError);
    expect(() => canonicalizeJson({ "\ud800": true })).toThrow(TypeError);
  });

  it("is independent of insertion order and permits shared acyclic values", () => {
    const shared = { z: 1, a: 2 };
    const first = { z: [shared], a: { beta: false, alpha: true } };
    const second = { a: { alpha: true, beta: false }, z: [{ a: 2, z: 1 }] };

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect(digestCanonicalJson({ first: shared, second: shared })).toBe(
      digestCanonicalJson({ second: { a: 2, z: 1 }, first: { z: 1, a: 2 } }),
    );
    expect(digestCanonicalJson([1, 2])).not.toBe(digestCanonicalJson([2, 1]));
  });

  it("rejects values that are not inert JSON data without invoking accessors or hooks", () => {
    const unsupported = [
      undefined,
      1n,
      Symbol("value"),
      () => true,
      Number.NaN,
      Infinity,
      -Infinity,
    ];
    for (const value of unsupported) expect(() => canonicalizeJson(value)).toThrow(TypeError);

    expect(() => canonicalizeJson({ nested: undefined })).toThrow(TypeError);
    expect(() => canonicalizeJson(new Array(1))).toThrow(TypeError);

    const arrayWithProperty: unknown[] & { extra?: boolean } = [];
    arrayWithProperty.extra = true;
    expect(() => canonicalizeJson(arrayWithProperty)).toThrow(TypeError);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeJson(cyclic)).toThrow(TypeError);

    let invoked = false;
    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        invoked = true;
        return 1;
      },
    });
    expect(() => canonicalizeJson(accessor)).toThrow(TypeError);
    expect(invoked).toBe(false);

    const serializationHook = {
      value: 1,
      toJSON() {
        invoked = true;
        return { changed: true };
      },
    };
    expect(() => canonicalizeJson(serializationHook)).toThrow(TypeError);
    expect(invoked).toBe(false);

    const symbolProperty = { value: 1 };
    Object.defineProperty(symbolProperty, Symbol("hidden"), { value: true });
    expect(() => canonicalizeJson(symbolProperty)).toThrow(TypeError);

    class NotJson {
      value = 1;
    }
    expect(() => canonicalizeJson(new NotJson())).toThrow(TypeError);
    expect(() => canonicalizeJson(Object.create(Object.create(null)))).toThrow(TypeError);

    let constructorNameInvoked = false;
    function FakeConstructor() {
      return undefined;
    }
    Object.defineProperty(FakeConstructor, "name", {
      get() {
        constructorNameInvoked = true;
        return "Object";
      },
    });
    const hostilePrototype = Object.create(null);
    Object.defineProperty(hostilePrototype, "constructor", { value: FakeConstructor });
    const hostileObject = Object.create(hostilePrototype);
    Object.defineProperty(hostileObject, "value", { enumerable: true, value: 1 });
    expect(() => canonicalizeJson(hostileObject)).toThrow(TypeError);
    expect(constructorNameInvoked).toBe(false);

    const namedObjectConstructor = function Object() {
      return undefined;
    };
    const spoofedPrototype = Object.create(null);
    Object.defineProperty(spoofedPrototype, "constructor", { value: namedObjectConstructor });
    const spoofedObject = Object.create(spoofedPrototype);
    Object.defineProperty(spoofedObject, "value", { enumerable: true, value: 1 });
    expect(() => canonicalizeJson(spoofedObject)).toThrow(TypeError);
  });
});

describe("SHA-256", () => {
  it("matches independent empty, short, and multi-block golden vectors", () => {
    const vectors = [
      ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
      ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
      [
        "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
        "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
      ],
    ] as const;

    for (const [input, expected] of vectors) expect(sha256Hex(ascii(input))).toBe(expected);
  });

  it("handles padding boundaries and non-zero Uint8Array views", () => {
    const paddingVectors = [
      [55, "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318"],
      [56, "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a"],
      [63, "7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34"],
      [64, "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb"],
      [65, "635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0"],
    ] as const;
    for (const [length, expected] of paddingVectors) {
      expect(sha256Hex(new Uint8Array(length).fill(0x61))).toBe(expected);
    }

    const framed = Uint8Array.of(0xff, 0x61, 0x62, 0x63, 0xff);
    expect(sha256Hex(framed.subarray(1, 4))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(bytesToHex(sha256Bytes(ascii("abc")))).toHaveLength(64);

    // @ts-expect-error Runtime JavaScript callers still receive an explicit type error.
    expect(() => sha256Bytes("abc")).toThrow(TypeError);
    const disguisedUint16 = new Uint16Array([0x6261]);
    Object.defineProperty(disguisedUint16, Symbol.toStringTag, { value: "Uint8Array" });
    // @ts-expect-error A spoofed typed-array tag must not bypass the byte-view invariant.
    expect(() => sha256Bytes(disguisedUint16)).toThrow(TypeError);

    let tagGetterInvoked = false;
    const bytesWithTagHook = ascii("abc");
    Object.defineProperty(bytesWithTagHook, Symbol.toStringTag, {
      get() {
        tagGetterInvoked = true;
        bytesWithTagHook[0] = 0;
        return "Changed";
      },
    });
    expect(sha256Hex(bytesWithTagHook)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(tagGetterInvoked).toBe(false);

    let subarrayInvoked = false;
    const bytesWithShadows = ascii("abc");
    Object.defineProperties(bytesWithShadows, {
      length: { value: 0 },
      subarray: {
        value() {
          subarrayInvoked = true;
          bytesWithShadows[0] = 0;
          return new Uint8Array();
        },
      },
    });
    expect(sha256Hex(bytesWithShadows)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(subarrayInvoked).toBe(false);
  });

  it("formats and recognizes only exact DESEN SHA-256 digest strings", () => {
    const digest = sha256Digest(ascii("abc"));
    expect(digest).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(isSha256Digest(digest)).toBe(true);

    for (const invalid of [
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      `sha-256:${"0".repeat(64)}`,
      `sha256:${"0".repeat(63)}`,
      `sha256:${"0".repeat(65)}`,
      `sha256:${"A".repeat(64)}`,
      `sha256:${"g".repeat(64)}`,
      `sha256:${"0".repeat(64)}\n`,
      null,
    ]) {
      expect(isSha256Digest(invalid)).toBe(false);
    }
  });
});

describe("DESEN 0.1.0 digest projections", () => {
  it("omits only top-level authoring from a Source digest without mutation", () => {
    const source = {
      kind: "desen.source",
      nested: { authoring: { semantic: true } },
      authoring: { canvas: { x: 1 } },
      extensions: { "com.example/flag": true },
    };
    const before = canonicalizeJson(source);
    const baseline = calculateDesenSourceDigest(source);

    expect(calculateDesenSourceDigest({ ...source, authoring: { canvas: { x: 999 } } })).toBe(
      baseline,
    );
    expect(
      calculateDesenSourceDigest({ ...source, extensions: { "com.example/flag": false } }),
    ).not.toBe(baseline);
    expect(
      calculateDesenSourceDigest({
        ...source,
        nested: { authoring: { semantic: false } },
      }),
    ).not.toBe(baseline);
    expect(canonicalizeJson(source)).toBe(before);
  });

  it("omits only top-level revision and publication from a Bundle revision", () => {
    const bundle = {
      kind: "desen.bundle",
      revision: `sha256:${"0".repeat(64)}`,
      publication: { publishedAt: "2026-07-21T00:00:00Z" },
      sourceDigest: `sha256:${"1".repeat(64)}`,
      nested: { publication: { semantic: true }, revision: "semantic" },
      extensions: { "com.example/flag": true },
    };
    const before = canonicalizeJson(bundle);
    const baseline = calculateDesenBundleRevision(bundle);

    expect(
      calculateDesenBundleRevision({
        ...bundle,
        revision: `sha256:${"f".repeat(64)}`,
        publication: { publishedAt: "later" },
      }),
    ).toBe(baseline);
    expect(
      calculateDesenBundleRevision({ ...bundle, sourceDigest: `sha256:${"2".repeat(64)}` }),
    ).not.toBe(baseline);
    expect(
      calculateDesenBundleRevision({
        ...bundle,
        nested: { publication: { semantic: false }, revision: "semantic" },
      }),
    ).not.toBe(baseline);
    expect(canonicalizeJson(bundle)).toBe(before);
  });

  it("rejects non-object document roots without pretending to validate DESEN structure", () => {
    for (const value of [null, [], "desen.source", 1]) {
      expect(() => calculateDesenSourceDigest(value)).toThrow(TypeError);
      expect(() => calculateDesenBundleRevision(value)).toThrow(TypeError);
    }
  });
});
