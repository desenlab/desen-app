import { sha256Digest } from "@desen/protocol";

/** Exact opaque handle prefix for admitted local assets. */
export const DESIGN_SYSTEM_ASSET_HANDLE_PREFIX = "desen-asset-" as const;

/** Namespaced inert metadata key used when an App project records an asset reference. */
export const DESIGN_SYSTEM_ASSET_EXTENSION_KEY = "desen.asset" as const;

/** Bounded asset admission limits. Decoded image limits are checked from trusted headers. */
export const DESIGN_SYSTEM_ASSET_LIMITS = Object.freeze({
  maxIdentifierCodeUnits: 128,
  maxLabelCodeUnits: 512,
  maxSourceNameCodeUnits: 512,
  maxImageEncodedBytes: 8 * 1024 * 1024,
  maxIconEncodedBytes: 1 * 1024 * 1024,
  maxFontEncodedBytes: 4 * 1024 * 1024,
  maxImageDimension: 8_192,
  maxImageDecodedPixels: 16_777_216,
  maxSvgCodeUnits: 1_000_000,
});

const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const HANDLE = /^desen-asset-[0-9a-f]{64}$/u;
const PATH_TRAVERSAL = /(?:^|[\\/])\.\.(?:$|[\\/])/u;
const SVG_ACTIVE_CONTENT =
  /<\/?(?:script|foreignObject|style|animate|animateMotion|animateTransform|set|iframe|object|embed|audio|video|canvas)\b|\bon[a-z][a-z0-9_-]*\s*=|\b(?:href|xlink:href|src)\s*=\s*["']\s*(?:https?:|data:|file:|javascript:|\/\/)|url\s*\(|<!ENTITY\b|<!DOCTYPE\b/i;
const SVG_ROOT = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)*<svg\b[^>]*>(?:[\s\S]*<\/svg>)?\s*$/i;

/** Supported non-executable asset categories. */
export type DesignSystemAssetKind = "font" | "icon" | "image";

/** Supported admitted media types. */
export type DesignSystemAssetMediaType =
  "font/woff2" | "image/jpeg" | "image/png" | "image/svg+xml" | "image/webp";

/** Stable image fit modes; values are data, not arbitrary CSS. */
export type DesignSystemImageFit = "cover" | "contain" | "fill" | "none" | "scale-down";

/** Bounded normalized crop rectangle for image presentation. */
export interface DesignSystemImageCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Image metadata captured from a validated binary header. */
export interface DesignSystemImageMetadata {
  readonly width: number;
  readonly height: number;
  readonly pixels: number;
  readonly fit: DesignSystemImageFit;
}

/** Font metadata captured without parsing or executing font-provided code. */
export interface DesignSystemFontMetadata {
  readonly format: "woff2";
  readonly flavor: "truetype" | "opentype" | "unknown";
}

/** Immutable admitted asset descriptor. Bytes are held separately by a local asset store. */
export interface AdmittedDesignSystemAsset {
  readonly id: string;
  readonly name: string;
  readonly kind: DesignSystemAssetKind;
  readonly mediaType: DesignSystemAssetMediaType;
  readonly handle: string;
  readonly digest: string;
  readonly byteLength: number;
  readonly image?: DesignSystemImageMetadata;
  readonly font?: DesignSystemFontMetadata;
}

/** Input accepted by the safe admission boundary. No URL, path or executable field is allowed. */
export interface DesignSystemAssetInput {
  readonly id: string;
  readonly name: string;
  readonly kind: DesignSystemAssetKind;
  readonly mediaType: DesignSystemAssetMediaType;
  readonly bytes: Uint8Array;
  readonly sourceName?: string;
  readonly digest?: string;
}

/** Stable diagnostic codes emitted by the asset admission boundary. */
export type DesignSystemAssetDiagnosticCode =
  | "INVALID_INPUT"
  | "INVALID_IDENTIFIER"
  | "INVALID_LABEL"
  | "INVALID_KIND"
  | "INVALID_MEDIA_TYPE"
  | "INVALID_BYTES"
  | "SOURCE_PATH_TRAVERSAL"
  | "DIGEST_MISMATCH"
  | "MAGIC_MISMATCH"
  | "UNSAFE_SVG"
  | "IMAGE_LIMIT_EXCEEDED"
  | "FONT_LIMIT_EXCEEDED";

/** One frozen location-bearing admission diagnostic. */
export interface DesignSystemAssetDiagnostic {
  readonly code: DesignSystemAssetDiagnosticCode;
  readonly pointer: string;
  readonly message: string;
}

export interface DesignSystemAssetAdmissionSuccess {
  readonly ok: true;
  readonly asset: AdmittedDesignSystemAsset;
  readonly bytes: readonly number[];
  readonly diagnostics: readonly [];
}

export interface DesignSystemAssetAdmissionFailure {
  readonly ok: false;
  readonly diagnostics: readonly DesignSystemAssetDiagnostic[];
}

/** Result of admitting an unknown value as a safe local asset. */
export type DesignSystemAssetAdmissionResult =
  DesignSystemAssetAdmissionFailure | DesignSystemAssetAdmissionSuccess;

interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

interface Utf8Decoder {
  decode(input: Uint8Array, options?: { readonly fatal?: boolean }): string;
}

declare const TextDecoder: new (
  label?: string,
  options?: { readonly fatal?: boolean },
) => Utf8Decoder;

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

function failure(
  code: DesignSystemAssetDiagnosticCode,
  pointer: string,
  message: string,
): DesignSystemAssetAdmissionFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([{ code, pointer, message }]),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key))
  );
}

function isByteArray(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array && value.byteLength === value.length;
}

function byteAt(bytes: Uint8Array, offset: number): number {
  const value = bytes[offset];
  if (value === undefined) throw new RangeError("Asset header is truncated.");
  return value;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    byteAt(bytes, offset) * 0x1000000 +
    byteAt(bytes, offset + 1) * 0x10000 +
    byteAt(bytes, offset + 2) * 0x100 +
    byteAt(bytes, offset + 3)
  );
}

function readUint24(bytes: Uint8Array, offset: number): number {
  return (
    byteAt(bytes, offset) * 0x10000 + byteAt(bytes, offset + 1) * 0x100 + byteAt(bytes, offset + 2)
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let output = "";
  for (let index = 0; index < length; index += 1)
    output += String.fromCharCode(byteAt(bytes, offset + index));
  return output;
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | undefined {
  if (bytes.byteLength < 45 || byteAt(bytes, 0) !== 137 || ascii(bytes, 1, 3) !== "PNG")
    return undefined;
  let offset = 8;
  let dimensions: ImageDimensions | undefined;
  let sawEnd = false;
  let sawData = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.byteLength) return undefined;
    if (type === "IHDR") {
      if (length !== 13 || dimensions !== undefined) return undefined;
      const width = readUint32(bytes, offset + 8);
      const height = readUint32(bytes, offset + 12);
      if (width === 0 || height === 0) return undefined;
      dimensions = { width, height };
    }
    if (type === "IDAT" && length > 0) sawData = true;
    offset = chunkEnd;
    if (type === "IEND") {
      sawEnd = length === 0;
      break;
    }
  }
  return sawEnd && sawData && offset === bytes.byteLength ? dimensions : undefined;
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | undefined {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 3 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) return undefined;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = byteAt(bytes, offset);
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda || marker === 0x00) return undefined;
    const length = byteAt(bytes, offset) * 0x100 + byteAt(bytes, offset + 1);
    if (length < 2 || offset + length > bytes.byteLength) return undefined;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && length >= 7) {
      const height = byteAt(bytes, offset + 3) * 0x100 + byteAt(bytes, offset + 4);
      const width = byteAt(bytes, offset + 5) * 0x100 + byteAt(bytes, offset + 6);
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    offset += length;
  }
  return undefined;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | undefined {
  if (bytes.byteLength < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP")
    return undefined;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && bytes.byteLength >= 30) {
    return { width: readUint24(bytes, 24) + 1, height: readUint24(bytes, 27) + 1 };
  }
  if (chunk === "VP8L" && bytes.byteLength >= 25 && bytes[21] === 0x2f) {
    const bits =
      byteAt(bytes, 22) |
      (byteAt(bytes, 23) << 8) |
      (byteAt(bytes, 24) << 16) |
      (byteAt(bytes, 25) << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

function imageDimensions(
  mediaType: DesignSystemAssetMediaType,
  bytes: Uint8Array,
): ImageDimensions | undefined {
  if (mediaType === "image/png") return pngDimensions(bytes);
  if (mediaType === "image/jpeg") return jpegDimensions(bytes);
  if (mediaType === "image/webp") return webpDimensions(bytes);
  return undefined;
}

function validateImageLimits(dimensions: ImageDimensions): boolean {
  return (
    dimensions.width <= DESIGN_SYSTEM_ASSET_LIMITS.maxImageDimension &&
    dimensions.height <= DESIGN_SYSTEM_ASSET_LIMITS.maxImageDimension &&
    dimensions.width * dimensions.height <= DESIGN_SYSTEM_ASSET_LIMITS.maxImageDecodedPixels
  );
}

function validateSvg(bytes: Uint8Array): boolean {
  if (bytes.byteLength > DESIGN_SYSTEM_ASSET_LIMITS.maxSvgCodeUnits * 4) return false;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  return (
    text.length <= DESIGN_SYSTEM_ASSET_LIMITS.maxSvgCodeUnits &&
    SVG_ROOT.test(text) &&
    !SVG_ACTIVE_CONTENT.test(text)
  );
}

function captureFontMetadata(bytes: Uint8Array): DesignSystemFontMetadata | undefined {
  if (bytes.byteLength < 48 || ascii(bytes, 0, 4) !== "wOF2") return undefined;
  const flavorWord = readUint32(bytes, 4);
  const flavor =
    ascii(bytes, 4, 4) === "OTTO" ? "opentype" : flavorWord === 0x00010000 ? "truetype" : "unknown";
  if (
    flavor === "unknown" ||
    readUint32(bytes, 8) !== bytes.byteLength ||
    byteAt(bytes, 12) * 0x100 + byteAt(bytes, 13) === 0 ||
    readUint32(bytes, 16) === 0 ||
    readUint32(bytes, 20) === 0
  )
    return undefined;
  return { format: "woff2", flavor };
}

function validateSourceName(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "string" &&
      value.length <= DESIGN_SYSTEM_ASSET_LIMITS.maxSourceNameCodeUnits &&
      !PATH_TRAVERSAL.test(value) &&
      !value.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/u.test(value))
  );
}

function mediaTypeForKind(
  kind: DesignSystemAssetKind,
  mediaType: string,
): mediaType is DesignSystemAssetMediaType {
  return (
    (kind === "font" && mediaType === "font/woff2") ||
    (kind === "icon" && mediaType === "image/svg+xml") ||
    (kind === "image" &&
      (mediaType === "image/png" || mediaType === "image/jpeg" || mediaType === "image/webp"))
  );
}

/** Returns true for one opaque handle produced by this package. */
export function isDesignSystemAssetHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE.test(value);
}

/** Captures a validated asset as a content-addressed, inert descriptor. */
export function admitDesignSystemAsset(value: unknown): DesignSystemAssetAdmissionResult {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["id", "name", "kind", "mediaType", "bytes"], ["sourceName", "digest"])
  ) {
    return failure("INVALID_INPUT", "/", "Asset input contains an unsupported or missing field.");
  }
  if (typeof value.id !== "string" || !IDENTIFIER.test(value.id)) {
    return failure("INVALID_IDENTIFIER", "/id", "Asset id must be a bounded stable identifier.");
  }
  if (
    typeof value.name !== "string" ||
    value.name.length > DESIGN_SYSTEM_ASSET_LIMITS.maxLabelCodeUnits ||
    value.name.length === 0
  ) {
    return failure("INVALID_LABEL", "/name", "Asset name must be a non-empty bounded label.");
  }
  if (value.kind !== "font" && value.kind !== "icon" && value.kind !== "image") {
    return failure("INVALID_KIND", "/kind", "Asset kind must be font, icon or image.");
  }
  if (typeof value.mediaType !== "string" || !mediaTypeForKind(value.kind, value.mediaType)) {
    return failure(
      "INVALID_MEDIA_TYPE",
      "/mediaType",
      "The media type is not allowed for this asset kind.",
    );
  }
  if (!isByteArray(value.bytes))
    return failure("INVALID_BYTES", "/bytes", "Asset bytes must be a detached Uint8Array.");
  if (!validateSourceName(value.sourceName)) {
    return failure(
      "SOURCE_PATH_TRAVERSAL",
      "/sourceName",
      "Asset source names cannot contain absolute or traversal paths.",
    );
  }
  const maxBytes =
    value.kind === "font"
      ? DESIGN_SYSTEM_ASSET_LIMITS.maxFontEncodedBytes
      : value.kind === "icon"
        ? DESIGN_SYSTEM_ASSET_LIMITS.maxIconEncodedBytes
        : DESIGN_SYSTEM_ASSET_LIMITS.maxImageEncodedBytes;
  if (value.bytes.byteLength === 0 || value.bytes.byteLength > maxBytes) {
    return failure(
      value.kind === "font" ? "FONT_LIMIT_EXCEEDED" : "IMAGE_LIMIT_EXCEEDED",
      "/bytes",
      "Asset bytes exceed the bounded admission limit.",
    );
  }

  const bytes = new Uint8Array(value.bytes);
  if (value.kind === "icon") {
    if (!validateSvg(bytes))
      return failure(
        "UNSAFE_SVG",
        "/bytes",
        "SVG must be a restricted inert icon without active content or external references.",
      );
  } else if (value.kind === "image") {
    const dimensions = imageDimensions(value.mediaType, bytes);
    if (dimensions === undefined)
      return failure(
        "MAGIC_MISMATCH",
        "/bytes",
        "The binary header does not match the declared media type.",
      );
    if (!validateImageLimits(dimensions))
      return failure(
        "IMAGE_LIMIT_EXCEEDED",
        "/bytes",
        "Decoded image dimensions exceed the bounded limit.",
      );
  }
  const font = value.kind === "font" ? captureFontMetadata(bytes) : undefined;
  if (value.kind === "font" && font === undefined)
    return failure("MAGIC_MISMATCH", "/bytes", "The font is not a valid WOFF2 payload.");

  const digest = sha256Digest(bytes);
  if (value.digest !== undefined && value.digest !== digest)
    return failure(
      "DIGEST_MISMATCH",
      "/digest",
      "The supplied digest does not match the exact bytes.",
    );
  const handle = `${DESIGN_SYSTEM_ASSET_HANDLE_PREFIX}${digest.slice("sha256:".length)}`;
  const dimensions = value.kind === "image" ? imageDimensions(value.mediaType, bytes) : undefined;
  const asset: AdmittedDesignSystemAsset = {
    id: value.id,
    name: value.name,
    kind: value.kind,
    mediaType: value.mediaType,
    handle,
    digest,
    byteLength: bytes.byteLength,
    ...(dimensions === undefined
      ? {}
      : {
          image: {
            ...dimensions,
            pixels: dimensions.width * dimensions.height,
            fit: "contain" as const,
          },
        }),
    ...(font === undefined ? {} : { font }),
  };
  return Object.freeze({
    ok: true as const,
    asset: Object.freeze(asset),
    bytes: Object.freeze(Array.from(bytes)),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/** Creates inert project metadata that points at the opaque local handle. */
export function createDesignSystemAssetMetadata(
  asset: AdmittedDesignSystemAsset,
): Readonly<Record<string, unknown>> {
  if (!isDesignSystemAssetHandle(asset.handle))
    throw new TypeError("Asset handle is not an admitted opaque handle.");
  return Object.freeze({
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    mediaType: asset.mediaType,
    extensions: Object.freeze({
      [DESIGN_SYSTEM_ASSET_EXTENSION_KEY]: Object.freeze({
        handle: asset.handle,
        digest: asset.digest,
        byteLength: asset.byteLength,
        ...(asset.image === undefined ? {} : { image: asset.image }),
        ...(asset.font === undefined ? {} : { font: asset.font }),
      }),
    }),
  });
}
