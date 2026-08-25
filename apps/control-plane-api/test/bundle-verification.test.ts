import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  calculateDesenBundleRevision,
  calculateDesenSourceDigest,
  canonicalizeJsonBytes,
} from "@desen/protocol";
import { publishDesenSource } from "@desen/publisher";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  BUNDLE_INTEGRITY_LIMITS,
  SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
  verifyBundleStoreEntry,
} from "../src/index.js";
import {
  isBundleIntegrityAuthority,
  readBundleIntegrityAuthority,
} from "../src/bundle-verification-internal.js";

import type {
  BundleIntegrityVerificationResult,
  BundleSourceMaterial,
  BundleStoreEntry,
} from "../src/index.js";
import type { PublishCatalogPackageCandidate, PublishSuccess } from "@desen/publisher";

const FIXTURE_ROOT = resolve(import.meta.dirname, "../../..");
const OFFICIAL_SOURCE_PATH = join(
  FIXTURE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
);
const OFFICIAL_CATALOG_PATH = join(
  FIXTURE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
);
const EXPECTED_OFFICIAL_REVISION =
  "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";
const textEncoder = new TextEncoder();

let officialSource: Record<string, unknown>;
let officialSourceBytes: Uint8Array;
let officialBundle: Record<string, unknown>;
let officialEntry: BundleStoreEntry;

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function jsonRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

async function loadJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function requirePublishSuccess(value: ReturnType<typeof publishDesenSource>): PublishSuccess {
  if (!value.ok) throw new TypeError("Expected the frozen official Source to publish.");
  return value;
}

function sourceMaterial(sourceBytes: Uint8Array = officialSourceBytes): BundleSourceMaterial {
  return { status: "available", sourceBytes };
}

function textBytes(text: string): Uint8Array {
  return textEncoder.encode(text);
}

function entryWith(
  bytes: Uint8Array,
  revision: unknown = officialEntry.revision,
): BundleStoreEntry {
  return { revision, bytes } as BundleStoreEntry;
}

function entryForBundle(bundle: Record<string, unknown>): BundleStoreEntry {
  return {
    revision: String(bundle.revision),
    bytes: canonicalizeJsonBytes(bundle),
  };
}

function requireRejected(
  result: BundleIntegrityVerificationResult,
): Extract<BundleIntegrityVerificationResult, { readonly status: "rejected" }> {
  expect(result.status).toBe("rejected");
  if (result.status !== "rejected") throw new TypeError("Expected integrity rejection.");
  return result;
}

function expectRejectionCode(
  result: BundleIntegrityVerificationResult,
  code: string,
  pointer?: string,
  stage?: string,
): void {
  const rejected = requireRejected(result);
  expect(rejected.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
  if (pointer !== undefined) {
    expect(rejected.diagnostics.find((diagnostic) => diagnostic.code === code)?.pointer).toBe(
      pointer,
    );
  }
  if (stage !== undefined) expect(rejected.stage).toBe(stage);
  expect(Object.isFrozen(rejected)).toBe(true);
  expect(Object.isFrozen(rejected.diagnostics)).toBe(true);
  rejected.diagnostics.forEach((diagnostic) => {
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(diagnostic).not.toHaveProperty("cause");
  });
}

function requireVerified(
  result: BundleIntegrityVerificationResult,
): Extract<BundleIntegrityVerificationResult, { readonly status: "verified" }> {
  expect(result.status).toBe("verified");
  if (result.status !== "verified") throw new TypeError("Expected verified Bundle authority.");
  return result;
}

function bundleAtCanonicalSize(targetByteLength: number): Record<string, unknown> {
  const candidate = cloneJson(officialBundle);
  candidate.extensions = { padding: "" };
  candidate.revision = EXPECTED_OFFICIAL_REVISION;
  const emptyLength = canonicalizeJsonBytes(candidate).byteLength;
  if (emptyLength > targetByteLength) throw new TypeError("Target Bundle size is too small.");
  candidate.extensions = { padding: "x".repeat(targetByteLength - emptyLength) };
  candidate.revision = calculateDesenBundleRevision(candidate);
  expect(canonicalizeJsonBytes(candidate)).toHaveLength(targetByteLength);
  return candidate;
}

function canonicalExpansionBundle(): Readonly<{
  readonly entry: BundleStoreEntry;
  readonly canonicalByteLength: number;
  readonly rawText: string;
}> {
  const numberCount = 100_000;
  const numbers = new Array<number>(numberCount).fill(1e20);
  const candidate = cloneJson(officialBundle);
  candidate.extensions = { expanded: numbers };
  candidate.revision = calculateDesenBundleRevision(candidate);
  const canonicalByteLength = canonicalizeJsonBytes(candidate).byteLength;

  const marker = "__DESEN_CANONICAL_NUMBER_EXPANSION__";
  const rawCandidate = cloneJson(candidate);
  rawCandidate.extensions = { expanded: marker };
  const template = JSON.stringify(rawCandidate);
  const rawNumbers = `[${new Array<string>(numberCount).fill("1e20").join(",")}]`;
  const rawText = template.replace(JSON.stringify(marker), rawNumbers);
  const bytes = textBytes(rawText);
  expect(bytes.byteLength).toBeLessThan(BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes);
  expect(canonicalByteLength).toBeGreaterThan(BUNDLE_INTEGRITY_LIMITS.maxBundleCanonicalUtf8Bytes);
  return {
    entry: { revision: String(candidate.revision), bytes },
    canonicalByteLength,
    rawText,
  };
}

function sourceAtCanonicalSize(targetByteLength: number): Record<string, unknown> {
  const candidate = cloneJson(officialSource);
  candidate.authoring = { padding: "" };
  const emptyLength = canonicalizeJsonBytes(candidate).byteLength;
  if (emptyLength > targetByteLength) throw new TypeError("Target Source size is too small.");
  const delta = targetByteLength - emptyLength;
  candidate.authoring = {
    padding: `${"\u0000".repeat(Math.floor(delta / 6))}${"x".repeat(delta % 6)}`,
  };
  expect(canonicalizeJsonBytes(candidate)).toHaveLength(targetByteLength);
  return candidate;
}

function canonicalExpansionSource(): Readonly<{
  readonly bytes: Uint8Array;
  readonly canonicalByteLength: number;
  readonly rawText: string;
}> {
  const candidate = cloneJson(officialSource);
  candidate.authoring = { padding: "", expanded: 1e20 };
  const targetByteLength = BUNDLE_INTEGRITY_LIMITS.maxSourceCanonicalUtf8Bytes + 1;
  const emptyLength = canonicalizeJsonBytes(candidate).byteLength;
  const delta = targetByteLength - emptyLength;
  candidate.authoring = {
    padding: `${"\u0000".repeat(Math.floor(delta / 6))}${"x".repeat(delta % 6)}`,
    expanded: 1e20,
  };
  const canonicalByteLength = canonicalizeJsonBytes(candidate).byteLength;
  const canonicalNumber = "100000000000000000000";
  const rawText = JSON.stringify(candidate).replace(canonicalNumber, "1e20");
  expect(rawText).not.toContain(canonicalNumber);
  const bytes = textBytes(rawText);
  expect(bytes.byteLength).toBeLessThan(BUNDLE_INTEGRITY_LIMITS.maxSourceUtf8Bytes);
  expect(canonicalByteLength).toBe(targetByteLength);
  return { bytes, canonicalByteLength, rawText };
}

beforeAll(async () => {
  officialSource = jsonRecord(await loadJson(OFFICIAL_SOURCE_PATH), "Official Source");
  officialSourceBytes = canonicalizeJsonBytes(officialSource);
  const catalog = jsonRecord(await loadJson(OFFICIAL_CATALOG_PATH), "Official Catalog");
  const candidate: PublishCatalogPackageCandidate = {
    id: String(catalog.id),
    version: String(catalog.version),
    target: String(catalog.target),
    observedPackageDigest: String(catalog.packageDigest),
    catalog,
  };
  const published = requirePublishSuccess(
    publishDesenSource(JSON.stringify(officialSource), [candidate]),
  );
  officialBundle = jsonRecord(cloneJson(published.bundle), "Published Bundle");
  officialEntry = entryForBundle(officialBundle);
  expect(officialEntry.revision).toBe(EXPECTED_OFFICIAL_REVISION);
  expect(officialEntry.bytes).toHaveLength(2_173);
  expect(calculateDesenSourceDigest(officialSource)).toBe(officialBundle.sourceDigest);
});

describe("M07-T02 Bundle integrity verification", () => {
  it("authenticates the Publisher golden with matching or unavailable Source evidence", () => {
    const matched = requireVerified(verifyBundleStoreEntry(officialEntry, sourceMaterial()));
    const unavailable = requireVerified(
      verifyBundleStoreEntry(officialEntry, { status: "not-available" }),
    );

    expect(Object.isFrozen(matched)).toBe(true);
    expect(Object.isFrozen(matched.authority)).toBe(true);
    expect(Reflect.ownKeys(matched.authority)).toEqual([
      "bundle",
      "protocolVersion",
      "revision",
      "sourceDigest",
      "sourceDigestVerification",
      "storedByteLength",
      "canonicalByteLength",
    ]);
    expect(matched.authority).toMatchObject({
      protocolVersion: "0.1.0",
      revision: EXPECTED_OFFICIAL_REVISION,
      sourceDigest: officialBundle.sourceDigest,
      sourceDigestVerification: "matched",
      storedByteLength: 2_173,
      canonicalByteLength: 2_173,
    });
    expect(unavailable.authority.sourceDigestVerification).toBe("not-available");
    expect(matched.authority.bundle).toEqual(officialBundle);
    expect(Object.isFrozen(matched.authority.bundle)).toBe(true);
    expect(Object.isFrozen(matched.authority.bundle.surfaces)).toBe(true);
    expect(isBundleIntegrityAuthority(matched.authority)).toBe(true);
    expect(isBundleIntegrityAuthority(unavailable.authority)).toBe(true);
    expect(matched.authority).not.toBe(unavailable.authority);

    const matchedRecord = readBundleIntegrityAuthority(matched.authority);
    const unavailableRecord = readBundleIntegrityAuthority(unavailable.authority);
    expect(matchedRecord).toMatchObject({
      revision: EXPECTED_OFFICIAL_REVISION,
      sourceDigest: officialBundle.sourceDigest,
      sourceDigestVerification: "matched",
      storedByteLength: 2_173,
      canonicalByteLength: 2_173,
    });
    expect(unavailableRecord?.sourceDigestVerification).toBe("not-available");
    expect(Object.isFrozen(matchedRecord)).toBe(true);
    expect(Object.isFrozen(matchedRecord?.bundle)).toBe(true);
    expect(Object.isFrozen(matchedRecord?.bundle.surfaces)).toBe(true);

    const publicationVariant = cloneJson(officialBundle);
    publicationVariant.publication = { pipeline: "m07-t02-publication-variant" };
    expect(calculateDesenBundleRevision(publicationVariant)).toBe(EXPECTED_OFFICIAL_REVISION);
    const publicationEntry = entryForBundle(publicationVariant);
    expect(publicationEntry.bytes).not.toEqual(officialEntry.bytes);
    const publicationAuthority = requireVerified(
      verifyBundleStoreEntry(publicationEntry, { status: "not-available" }),
    ).authority;
    expect(publicationAuthority.revision).toBe(EXPECTED_OFFICIAL_REVISION);
    expect(publicationAuthority.bundle.publication).toEqual({
      pipeline: "m07-t02-publication-variant",
    });
  });

  it("accepts noncanonical whitespace and exact offset views without retaining caller bytes", () => {
    const formattedBundle = textBytes(JSON.stringify(officialBundle, null, 2));
    const backing = new Uint8Array(formattedBundle.byteLength + 8);
    backing.set(formattedBundle, 4);
    const exactView = backing.subarray(4, backing.byteLength - 4);
    const formattedSource = textBytes(JSON.stringify(officialSource, null, 2));
    const result = requireVerified(
      verifyBundleStoreEntry(
        { revision: officialEntry.revision, bytes: exactView },
        sourceMaterial(formattedSource),
      ),
    );
    backing.fill(0);
    formattedSource.fill(0);

    const record = readBundleIntegrityAuthority(result.authority);
    expect(record?.bundle).toEqual(officialBundle);
    expect(result.authority.bundle).toEqual(officialBundle);
    expect(result.authority.sourceDigestVerification).toBe("matched");
    expect(record?.storedByteLength).toBe(formattedBundle.byteLength);
    expect(record?.canonicalByteLength).toBe(2_173);
  });

  it("accepts authoring-only Source changes because the normative digest omits authoring", () => {
    const source = cloneJson(officialSource);
    source.authoring = { selected: "another-node", zoom: 2 };
    expect(calculateDesenSourceDigest(source)).toBe(officialBundle.sourceDigest);
    const result = requireVerified(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(canonicalizeJsonBytes(source))),
    );
    expect(readBundleIntegrityAuthority(result.authority)?.sourceDigestVerification).toBe(
      "matched",
    );
  });

  it("enforces the exact 2 MiB stored and complete canonical Bundle boundary", () => {
    const exact = bundleAtCanonicalSize(BUNDLE_INTEGRITY_LIMITS.maxBundleCanonicalUtf8Bytes);
    requireVerified(verifyBundleStoreEntry(entryForBundle(exact), { status: "not-available" }));

    const exactRawWithTrailingWhitespace = new Uint8Array(
      BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes,
    );
    exactRawWithTrailingWhitespace.fill(0x20);
    exactRawWithTrailingWhitespace.set(officialEntry.bytes);
    const exactRaw = requireVerified(
      verifyBundleStoreEntry(entryWith(exactRawWithTrailingWhitespace), {
        status: "not-available",
      }),
    );
    expect(exactRaw.authority.storedByteLength).toBe(BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes);
    expect(exactRaw.authority.canonicalByteLength).toBe(2_173);

    const oversized = bundleAtCanonicalSize(BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes + 1);
    expectRejectionCode(
      verifyBundleStoreEntry(entryForBundle(oversized), { status: "not-available" }),
      "BUNDLE_LIMIT_EXCEEDED",
      "",
      "bundle-size",
    );

    const excessWhitespace = new Uint8Array(BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes + 1);
    excessWhitespace.fill(0x20);
    excessWhitespace.set(
      officialEntry.bytes,
      excessWhitespace.byteLength - officialEntry.bytes.length,
    );
    expectRejectionCode(
      verifyBundleStoreEntry(entryWith(excessWhitespace), { status: "not-available" }),
      "BUNDLE_LIMIT_EXCEEDED",
      "",
      "bundle-size",
    );

    const expansion = canonicalExpansionBundle();
    expectRejectionCode(
      verifyBundleStoreEntry(expansion.entry, { status: "not-available" }),
      "BUNDLE_LIMIT_EXCEEDED",
      "",
      "bundle-size",
    );

    // The allocation guard must run before structural validation creates its canonical inert
    // snapshot. Keep the compact exponent form but also make the Bundle schema-invalid: the
    // canonical-size rejection must still win without entering the allocating validator path.
    const invalidExpansionText = expansion.rawText.replace('"sourceDigest"', '"sourceDigesx"');
    expect(invalidExpansionText).not.toBe(expansion.rawText);
    expectRejectionCode(
      verifyBundleStoreEntry(entryWith(textBytes(invalidExpansionText)), {
        status: "not-available",
      }),
      "BUNDLE_LIMIT_EXCEEDED",
      "",
      "bundle-size",
    );
  }, 10_000);

  it("enforces the exact 8 MiB complete canonical Source boundary", () => {
    const exact = sourceAtCanonicalSize(BUNDLE_INTEGRITY_LIMITS.maxSourceCanonicalUtf8Bytes);
    const exactResult = requireVerified(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(canonicalizeJsonBytes(exact))),
    );
    expect(exactResult.authority.sourceDigestVerification).toBe("matched");

    const expansion = canonicalExpansionSource();
    expectRejectionCode(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(expansion.bytes)),
      SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
      "",
      "source-json",
    );

    const invalidExpansion = expansion.rawText.replace('"catalogs"', '"catalogx"');
    expect(invalidExpansion).not.toBe(expansion.rawText);
    expectRejectionCode(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(textBytes(invalidExpansion))),
      SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
      "",
      "source-json",
    );
  });

  it("rejects malformed UTF-8, a BOM, trailing data, duplicate decoded keys, lone surrogates, and nonfinite numbers", () => {
    const cases = [
      Uint8Array.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3, 0x28, 0x7d]),
      Uint8Array.from([0xef, 0xbb, 0xbf, ...officialEntry.bytes]),
      textBytes(`${JSON.stringify(officialBundle)} true`),
      textBytes('{"desen":"0.1.0","des\\u0065n":"0.1.0"}'),
      textBytes('{"desen":"0.1.0","x":"\\ud800"}'),
      textBytes('{"desen":"0.1.0","x":1e400}'),
    ];
    cases.forEach((bytes) => {
      expectRejectionCode(
        verifyBundleStoreEntry(entryWith(bytes), { status: "not-available" }),
        "SCHEMA_INVALID",
        undefined,
        "bundle-json",
      );
    });
  });

  it("stops at fixed depth, value-count, number-token, and Source-string budgets", () => {
    const tooDeep = textBytes(`{"desen":"0.1.0","x":${"[".repeat(257)}0${"]".repeat(257)}}`);
    const tooManyValues = textBytes(
      `{"desen":"0.1.0","x":[${new Array(262_144).fill("0").join(",")}]}`,
    );
    const tooLongNumber = textBytes(
      `{"desen":"0.1.0","x":${"1".repeat(BUNDLE_INTEGRITY_LIMITS.maxNumberTokenCodeUnits + 1)}}`,
    );
    [tooDeep, tooManyValues, tooLongNumber].forEach((bytes) => {
      expectRejectionCode(
        verifyBundleStoreEntry(entryWith(bytes), { status: "not-available" }),
        "BUNDLE_LIMIT_EXCEEDED",
        undefined,
        "bundle-size",
      );
    });

    const source = cloneJson(officialSource);
    source.authoring = {
      padding: "x".repeat(BUNDLE_INTEGRITY_LIMITS.maxDecodedStringCodeUnits + 1),
    };
    expectRejectionCode(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(textBytes(JSON.stringify(source)))),
      SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
      undefined,
      "source-json",
    );

    const oversizedSource = new Uint8Array(BUNDLE_INTEGRITY_LIMITS.maxSourceUtf8Bytes + 1);
    oversizedSource.fill(0x20);
    oversizedSource.set(officialSourceBytes);
    expectRejectionCode(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(oversizedSource)),
      SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
      "",
      "source-material",
    );
  });

  it("gives an explicit unsupported protocol precedence before schema and revision checks", () => {
    const unsupported = textBytes('{"desen":"9.9.9"}');
    const hostileSource = Object.defineProperty({}, "status", {
      enumerable: true,
      get: vi.fn(() => {
        throw new Error("must not run");
      }),
    });
    const result = verifyBundleStoreEntry(
      entryWith(unsupported, "not-a-revision"),
      hostileSource as BundleSourceMaterial,
    );
    expectRejectionCode(result, "UNSUPPORTED_PROTOCOL", "/desen", "bundle-protocol");
    expect(requireRejected(result).diagnostics).toHaveLength(1);
  });

  it("preserves deterministic structural diagnostics without granting authority", () => {
    const unknown = cloneJson(officialBundle);
    unknown.unexpected = true;
    const first = verifyBundleStoreEntry(entryForBundle(unknown), { status: "not-available" });
    const second = verifyBundleStoreEntry(entryForBundle(unknown), { status: "not-available" });
    expectRejectionCode(first, "UNKNOWN_CORE_FIELD", "/unexpected", "bundle-schema");
    expect(first).toEqual(second);
    expect(first).not.toHaveProperty("authority");

    const missing = cloneJson(officialBundle);
    delete missing.entry;
    expectRejectionCode(
      verifyBundleStoreEntry(entryForBundle(missing), { status: "not-available" }),
      "SCHEMA_INVALID",
      "/entry",
      "bundle-schema",
    );
  });

  it("requires the stored, embedded, and independently calculated revisions to agree", () => {
    expectRejectionCode(
      verifyBundleStoreEntry(
        { revision: `sha256:${"f".repeat(64)}`, bytes: officialEntry.bytes },
        { status: "not-available" },
      ),
      "REVISION_MISMATCH",
      "/revision",
      "bundle-revision",
    );

    const falseClosure = cloneJson(officialBundle);
    falseClosure.revision = `sha256:${"f".repeat(64)}`;
    expectRejectionCode(
      verifyBundleStoreEntry(entryForBundle(falseClosure), { status: "not-available" }),
      "REVISION_MISMATCH",
      "/revision",
      "bundle-revision",
    );

    const tampered = cloneJson(officialBundle);
    tampered.id = "tampered-document";
    expectRejectionCode(
      verifyBundleStoreEntry(
        { revision: officialEntry.revision, bytes: canonicalizeJsonBytes(tampered) },
        { status: "not-available" },
      ),
      "REVISION_MISMATCH",
      "/revision",
      "bundle-revision",
    );
  });

  it("independently validates available Source bytes and rejects digest mismatch", () => {
    const otherSource = cloneJson(officialSource);
    otherSource.id = "another-document";
    expect(calculateDesenSourceDigest(otherSource)).not.toBe(officialBundle.sourceDigest);
    expectRejectionCode(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(canonicalizeJsonBytes(otherSource))),
      "SOURCE_DIGEST_MISMATCH",
      "/sourceDigest",
      "source-digest",
    );

    const invalidSource = cloneJson(officialSource);
    invalidSource.unknown = true;
    expectRejectionCode(
      verifyBundleStoreEntry(officialEntry, sourceMaterial(canonicalizeJsonBytes(invalidSource))),
      "UNKNOWN_CORE_FIELD",
      "/unknown",
      "source-schema",
    );
  });

  it("rejects unsupported or non-interoperable available Source material", () => {
    const unsupportedSource = cloneJson(officialSource);
    unsupportedSource.desen = "1.0.0";
    expectRejectionCode(
      verifyBundleStoreEntry(
        officialEntry,
        sourceMaterial(canonicalizeJsonBytes(unsupportedSource)),
      ),
      "UNSUPPORTED_PROTOCOL",
      "/desen",
      "source-protocol",
    );

    expectRejectionCode(
      verifyBundleStoreEntry(
        officialEntry,
        sourceMaterial(textBytes('{"kind":"desen.source","kind":"desen.source"}')),
      ),
      "SCHEMA_INVALID",
      "/kind",
      "source-json",
    );
  });

  it("captures only exact own-data entry and Source envelopes without invoking accessors", () => {
    const getter = vi.fn(() => officialEntry.bytes);
    const accessorEntry = Object.defineProperties(
      {},
      {
        revision: { enumerable: true, value: officialEntry.revision },
        bytes: { enumerable: true, get: getter },
      },
    );
    expectRejectionCode(
      verifyBundleStoreEntry(accessorEntry as BundleStoreEntry, { status: "not-available" }),
      "SCHEMA_INVALID",
      undefined,
      "entry-capture",
    );
    expect(getter).not.toHaveBeenCalled();

    const invalidEntries = [
      { ...officialEntry, extra: true },
      Object.assign(Object.create({ inherited: true }) as object, officialEntry),
      Object.assign({ ...officialEntry }, { [Symbol("extra")]: true }),
      new Proxy({ ...officialEntry }, {}),
    ];
    const revoked = Proxy.revocable({ ...officialEntry }, {});
    invalidEntries.push(revoked.proxy);
    revoked.revoke();
    invalidEntries.forEach((entry) => {
      expectRejectionCode(
        verifyBundleStoreEntry(entry as BundleStoreEntry, { status: "not-available" }),
        "SCHEMA_INVALID",
        undefined,
        "entry-capture",
      );
    });

    const nullPrototype = Object.assign(Object.create(null) as object, officialEntry);
    requireVerified(
      verifyBundleStoreEntry(nullPrototype as BundleStoreEntry, { status: "not-available" }),
    );

    const sourceGetter = vi.fn(() => officialSourceBytes);
    const accessorSource = Object.defineProperties(
      {},
      {
        status: { enumerable: true, value: "available" },
        sourceBytes: { enumerable: true, get: sourceGetter },
      },
    );
    expectRejectionCode(
      verifyBundleStoreEntry(officialEntry, accessorSource as BundleSourceMaterial),
      "SCHEMA_INVALID",
      undefined,
      "source-material",
    );
    expect(sourceGetter).not.toHaveBeenCalled();
  });

  it("accepts authentic Uint8Array subclasses and rejects spoofed, proxied, shared, or wrong views", () => {
    class ByteSubclass extends Uint8Array {}
    requireVerified(
      verifyBundleStoreEntry(
        { revision: officialEntry.revision, bytes: new ByteSubclass(officialEntry.bytes) },
        { status: "not-available" },
      ),
    );

    const spoof = {
      [Symbol.toStringTag]: "Uint8Array",
      byteLength: officialEntry.bytes.byteLength,
    };
    const shared = new Uint8Array(new SharedArrayBuffer(officialEntry.bytes.byteLength));
    shared.set(officialEntry.bytes);
    const detachedBuffer = new ArrayBuffer(officialEntry.bytes.byteLength);
    const detached = new Uint8Array(detachedBuffer);
    structuredClone(detachedBuffer, { transfer: [detachedBuffer] });
    const invalidViews: unknown[] = [
      new Uint8Array(),
      detached,
      spoof,
      new DataView(officialEntry.bytes.buffer),
      new Proxy(new Uint8Array(officialEntry.bytes), {}),
      shared,
    ];
    invalidViews.forEach((bytes) => {
      expectRejectionCode(
        verifyBundleStoreEntry(entryWith(bytes as Uint8Array), { status: "not-available" }),
        "SCHEMA_INVALID",
        undefined,
        "entry-capture",
      );
    });
  });

  it("rejects malformed Source availability envelopes after Bundle integrity succeeds", () => {
    const malformed: unknown[] = [
      {},
      { status: "unknown" },
      { status: "not-available", sourceBytes: officialSourceBytes },
      { status: "available" },
      { status: "available", sourceBytes: officialSourceBytes, extra: true },
      new Proxy({ status: "not-available" }, {}),
    ];
    malformed.forEach((material) => {
      expectRejectionCode(
        verifyBundleStoreEntry(officialEntry, material as BundleSourceMaterial),
        "SCHEMA_INVALID",
        undefined,
        "source-material",
      );
    });
  });

  it("does not observe Source material after an earlier revision rejection", () => {
    const sourceGetter = vi.fn(() => officialSourceBytes);
    const source = Object.defineProperties(
      {},
      {
        status: { enumerable: true, value: "available" },
        sourceBytes: { enumerable: true, get: sourceGetter },
      },
    );
    const result = verifyBundleStoreEntry(
      { revision: `sha256:${"f".repeat(64)}`, bytes: officialEntry.bytes },
      source as BundleSourceMaterial,
    );
    expectRejectionCode(result, "REVISION_MISMATCH", undefined, "bundle-revision");
    expect(sourceGetter).not.toHaveBeenCalled();
  });

  it("keeps authority identity unforgeable and returns no partial data on rejection", () => {
    const first = requireVerified(
      verifyBundleStoreEntry(officialEntry, { status: "not-available" }),
    );
    const second = requireVerified(
      verifyBundleStoreEntry(officialEntry, { status: "not-available" }),
    );
    expect(first.authority).not.toBe(second.authority);
    expect(readBundleIntegrityAuthority(first.authority)).not.toBe(
      readBundleIntegrityAuthority(second.authority),
    );
    expect(isBundleIntegrityAuthority({})).toBe(false);
    expect(isBundleIntegrityAuthority(Object.freeze({ ...first.authority }))).toBe(false);
    expect(readBundleIntegrityAuthority(null)).toBeUndefined();

    const rejected = requireRejected(
      verifyBundleStoreEntry(entryWith(textBytes("{}")), { status: "not-available" }),
    );
    expect(Reflect.ownKeys(rejected)).toEqual(["status", "stage", "diagnostics"]);
    expect(rejected.stage).toBe("bundle-schema");
    expect(JSON.stringify(rejected)).not.toContain(EXPECTED_OFFICIAL_REVISION);
    expect(JSON.stringify(rejected)).not.toContain(String(officialBundle.sourceDigest));
  });
});
