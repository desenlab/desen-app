import { describe, expect, it } from "vitest";

import {
  DESIGN_SYSTEM_ASSET_EXTENSION_KEY,
  admitDesignSystemAsset,
  createDesignSystemAssetMetadata,
  createDesignSystemImagePresentation,
  createMemoryDesignSystemAssetStore,
  isDesignSystemAssetHandle,
} from "../src/index.js";

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function png(width = 1, height = 1): Uint8Array {
  const bytes = new Uint8Array(58);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  bytes.set([(width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255], 16);
  bytes.set([(height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255], 20);
  bytes.set([8, 6, 0, 0, 0], 24);
  bytes.set([0, 0, 0, 1, 73, 68, 65, 84, 0, 0, 0, 0, 0], 33);
  bytes.set([0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0], 46);
  return bytes;
}

function svg(value = '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>'): Uint8Array {
  return asciiBytes(value);
}

function woff2(): Uint8Array {
  const bytes = new Uint8Array(48);
  bytes.set(asciiBytes("wOF2"), 0);
  bytes.set([0, 1, 0, 0], 4);
  bytes.set([0, 0, 0, 48], 8);
  bytes.set([0, 1], 12);
  bytes.set([0, 0, 0, 64], 16);
  bytes.set([0, 0, 0, 16], 20);
  return bytes;
}

describe("safe design-system asset admission", () => {
  it("content-addresses a bounded PNG and exposes only an opaque handle", () => {
    const result = admitDesignSystemAsset({
      id: "hero-image",
      name: "Hero image",
      kind: "image",
      mediaType: "image/png",
      bytes: png(4, 8),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isDesignSystemAssetHandle(result.asset.handle)).toBe(true);
    expect(result.asset.image).toEqual({ width: 4, height: 8, pixels: 32, fit: "contain" });
    expect(result.bytes).not.toBe(result.asset);
    expect(Object.isFrozen(result.asset)).toBe(true);
  });

  it("records only an inert namespaced project reference", () => {
    const result = admitDesignSystemAsset({
      id: "mark",
      name: "Mark",
      kind: "icon",
      mediaType: "image/svg+xml",
      bytes: svg(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const metadata = createDesignSystemAssetMetadata(result.asset);
    expect(metadata).toMatchObject({
      id: "mark",
      kind: "icon",
      extensions: { [DESIGN_SYSTEM_ASSET_EXTENSION_KEY]: { handle: result.asset.handle } },
    });
    expect(JSON.stringify(metadata)).not.toMatch(/url|script|fetch|loader/i);
  });

  it("admits restricted SVG icons and WOFF2 fonts", () => {
    const icon = admitDesignSystemAsset({
      id: "icon",
      name: "Icon",
      kind: "icon",
      mediaType: "image/svg+xml",
      bytes: svg("<svg/>"),
      sourceName: "icon.svg",
    });
    const font = admitDesignSystemAsset({
      id: "font",
      name: "Inter",
      kind: "font",
      mediaType: "font/woff2",
      bytes: woff2(),
      sourceName: "Inter.woff2",
    });
    expect(icon.ok).toBe(true);
    expect(font.ok).toBe(true);
    if (font.ok) expect(font.asset.font).toEqual({ format: "woff2", flavor: "truetype" });
  });

  it.each([
    [
      "active SVG",
      {
        id: "icon",
        name: "Icon",
        kind: "icon",
        mediaType: "image/svg+xml",
        bytes: svg("<svg><script>alert(1)</script></svg>"),
      },
    ],
    [
      "external SVG reference",
      {
        id: "icon",
        name: "Icon",
        kind: "icon",
        mediaType: "image/svg+xml",
        bytes: svg('<svg><use href="https://evil.test/icon"/></svg>'),
      },
    ],
    [
      "path traversal",
      {
        id: "image",
        name: "Image",
        kind: "image",
        mediaType: "image/png",
        bytes: png(),
        sourceName: "../image.png",
      },
    ],
    [
      "wrong magic",
      {
        id: "image",
        name: "Image",
        kind: "image",
        mediaType: "image/png",
        bytes: asciiBytes("not png"),
      },
    ],
    [
      "digest mismatch",
      {
        id: "image",
        name: "Image",
        kind: "image",
        mediaType: "image/png",
        bytes: png(),
        digest: `sha256:${"0".repeat(64)}`,
      },
    ],
  ])("rejects %s without a partial asset", (_label, input) => {
    const result = admitDesignSystemAsset(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toHaveLength(1);
  });

  it("rejects decoded image dimensions beyond the fixed limit", () => {
    const result = admitDesignSystemAsset({
      id: "huge",
      name: "Huge",
      kind: "image",
      mediaType: "image/png",
      bytes: png(8192, 8192),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe("IMAGE_LIMIT_EXCEEDED");
  });
});

describe("local content-addressed store and image presentation", () => {
  it("is immutable and returns a visible missing-handle diagnostic", async () => {
    const admission = admitDesignSystemAsset({
      id: "hero",
      name: "Hero",
      kind: "image",
      mediaType: "image/png",
      bytes: png(),
    });
    expect(admission.ok).toBe(true);
    if (!admission.ok) return;
    const store = createMemoryDesignSystemAssetStore();
    const first = await store.put({ asset: admission.asset, bytes: admission.bytes });
    const second = await store.put({ asset: admission.asset, bytes: admission.bytes });
    const read = await store.get(admission.asset.handle);
    const missing = await store.get(`desen-asset-${"f".repeat(64)}`);
    expect(first).toMatchObject({ ok: true, created: true });
    expect(second).toMatchObject({ ok: true, created: false });
    expect(read).toMatchObject({ ok: true, record: { asset: { handle: admission.asset.handle } } });
    expect(missing).toMatchObject({ ok: false, diagnostic: { code: "MISSING_ASSET" } });
  });

  it("validates bounded crop/fit data without accepting CSS", () => {
    const admission = admitDesignSystemAsset({
      id: "hero",
      name: "Hero",
      kind: "image",
      mediaType: "image/png",
      bytes: png(),
    });
    expect(admission.ok).toBe(true);
    if (!admission.ok) return;
    expect(
      createDesignSystemImagePresentation({
        handle: admission.asset.handle,
        fit: "cover",
        crop: { x: 0.1, y: 0, width: 0.8, height: 1 },
      }).ok,
    ).toBe(true);
    expect(
      createDesignSystemImagePresentation({
        handle: admission.asset.handle,
        fit: "cover",
        crop: { x: 0.5, y: 0, width: 0.8, height: 1 },
      }).ok,
    ).toBe(false);
    expect(
      createDesignSystemImagePresentation({ handle: "https://evil.test/image", fit: "cover" }).ok,
    ).toBe(false);
  });
});
