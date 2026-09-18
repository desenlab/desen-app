import {
  isDesignSystemAssetHandle,
  type DesignSystemImageCrop,
  type DesignSystemImageFit,
} from "./asset-admission.js";

/** Inert, bounded image presentation data stored beside a Source node. */
export interface DesignSystemImagePresentation {
  readonly handle: string;
  readonly fit: DesignSystemImageFit;
  readonly crop: DesignSystemImageCrop;
}

export type DesignSystemImagePresentationDiagnosticCode =
  "INVALID_HANDLE" | "INVALID_FIT" | "INVALID_CROP";

export interface DesignSystemImagePresentationFailure {
  readonly ok: false;
  readonly code: DesignSystemImagePresentationDiagnosticCode;
  readonly message: string;
}

export type DesignSystemImagePresentationResult =
  | Readonly<{ readonly ok: true; readonly presentation: DesignSystemImagePresentation }>
  | Readonly<DesignSystemImagePresentationFailure>;

const FITS: readonly DesignSystemImageFit[] = ["cover", "contain", "fill", "none", "scale-down"];
const DEFAULT_CROP: DesignSystemImageCrop = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validCrop(value: unknown): value is DesignSystemImageCrop {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const crop = value as Record<string, unknown>;
  if (![crop.x, crop.y, crop.width, crop.height].every(validNumber)) return false;
  const x = crop.x as number;
  const y = crop.y as number;
  const width = crop.width as number;
  const height = crop.height as number;
  return x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 && y + height <= 1;
}

/** Validates safe image fit/crop data without creating arbitrary CSS. */
export function createDesignSystemImagePresentation(input: {
  readonly handle: string;
  readonly fit: DesignSystemImageFit;
  readonly crop?: DesignSystemImageCrop;
}): DesignSystemImagePresentationResult {
  if (!isDesignSystemAssetHandle(input.handle))
    return Object.freeze({
      ok: false as const,
      code: "INVALID_HANDLE" as const,
      message: "Image presentation requires an admitted opaque asset handle.",
    });
  if (!FITS.includes(input.fit))
    return Object.freeze({
      ok: false as const,
      code: "INVALID_FIT" as const,
      message: "Image fit must be one of the bounded presentation modes.",
    });
  if (!validCrop(input.crop))
    return Object.freeze({
      ok: false as const,
      code: "INVALID_CROP" as const,
      message: "Image crop must be a normalized rectangle inside the image.",
    });
  const crop = input.crop === undefined ? DEFAULT_CROP : Object.freeze({ ...input.crop });
  return Object.freeze({
    ok: true as const,
    presentation: Object.freeze({ handle: input.handle, fit: input.fit, crop }),
  });
}
