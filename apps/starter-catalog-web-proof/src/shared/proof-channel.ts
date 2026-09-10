import { canonicalizeJson } from "@desen/protocol";

/** Exact browser-local handoff used only between the two bounded proof entry graphs. */
export const STARTER_PROOF_CHANNEL_KEY = "run.desen.proof/m10a-t01-starter-bundles";

const MAX_ENVELOPE_CODE_UNITS = 8_388_608;
const LOCAL_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export interface StarterProofCatalogIdentity {
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly packageDigest: string;
}

export interface StarterProofEnvelope {
  readonly schemaVersion: 1;
  readonly catalog: StarterProofCatalogIdentity;
  readonly bundles: {
    readonly button: {
      readonly initial: unknown;
      readonly compatible: unknown;
    };
    readonly select: unknown;
    readonly dialog: unknown;
  };
  readonly roots: {
    readonly button: string;
    readonly select: string;
    readonly dialog: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
}

function readText(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : undefined;
}

/**
 * Reads only the proof channel envelope. Bundle and Catalog authority is established later by the
 * normal Runtime validators; this parser neither trusts nor repairs serialized input.
 */
export function readStarterProofEnvelope(storage: Storage): StarterProofEnvelope | undefined {
  let raw: string | null;
  try {
    raw = storage.getItem(STARTER_PROOF_CHANNEL_KEY);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;
  if (raw.length > MAX_ENVELOPE_CODE_UNITS) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["schemaVersion", "catalog", "bundles", "roots"]) ||
    parsed.schemaVersion !== 1
  )
    return undefined;
  if (
    !isRecord(parsed.catalog) ||
    !exactKeys(parsed.catalog, ["id", "version", "target", "packageDigest"])
  )
    return undefined;
  if (!isRecord(parsed.bundles) || !exactKeys(parsed.bundles, ["button", "select", "dialog"]))
    return undefined;
  if (
    !isRecord(parsed.bundles.button) ||
    !exactKeys(parsed.bundles.button, ["initial", "compatible"])
  )
    return undefined;
  if (!isRecord(parsed.roots) || !exactKeys(parsed.roots, ["button", "select", "dialog"]))
    return undefined;
  const id = readText(parsed.catalog, "id");
  const version = readText(parsed.catalog, "version");
  const target = readText(parsed.catalog, "target");
  const packageDigest = readText(parsed.catalog, "packageDigest");
  const button = readText(parsed.roots, "button");
  const select = readText(parsed.roots, "select");
  const dialog = readText(parsed.roots, "dialog");
  if (
    [id, version, target, packageDigest, button, select, dialog].some(
      (value) => value === undefined,
    )
  )
    return undefined;
  if (
    (id as string).length > 4_096 ||
    (version as string).length > 256 ||
    (target as string).length > 256 ||
    !SHA256_PATTERN.test(packageDigest as string) ||
    !LOCAL_ID_PATTERN.test(button as string) ||
    !LOCAL_ID_PATTERN.test(select as string) ||
    !LOCAL_ID_PATTERN.test(dialog as string)
  )
    return undefined;
  return parsed as unknown as StarterProofEnvelope;
}

/** Canonicalizes a detached inert snapshot, rejecting non-JSON values before browser handoff. */
export function writeStarterProofEnvelope(storage: Storage, envelope: StarterProofEnvelope): void {
  const serialized = canonicalizeJson(envelope);
  if (serialized.length > MAX_ENVELOPE_CODE_UNITS) {
    throw new TypeError("Starter proof envelope exceeds its finite browser-local budget.");
  }
  storage.setItem(STARTER_PROOF_CHANNEL_KEY, serialized);
}
