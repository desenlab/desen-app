import { canonicalizeJson } from "@desen/protocol";

/** Exact browser-local handoff used only between the two isolated M10A-T06 proof entry graphs. */
export const STARTER_T06_PROOF_CHANNEL_KEY = "run.desen.proof/m10a-t06-form-bundles";

const MAX_ENVELOPE_CODE_UNITS = 8_388_608;
const LOCAL_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

/** Immutable Catalog tuple which the independent host must match exactly. */
export interface StarterT06ProofCatalogIdentity {
  readonly id: string;
  readonly version: string;
  readonly target: string;
  readonly packageDigest: string;
}

/** Serialized Publisher outputs and finite Source identities used by the isolated T06 proof only. */
export interface StarterT06ProofEnvelope {
  readonly schemaVersion: 1;
  readonly catalog: StarterT06ProofCatalogIdentity;
  readonly bundles: {
    readonly button: {
      readonly disabled: unknown;
      readonly loading: unknown;
    };
    readonly form: unknown;
  };
  readonly roots: {
    readonly button: string;
    readonly form: string;
  };
  readonly nodes: {
    readonly checkbox: string;
    readonly radioGroup: string;
    readonly switch: string;
    readonly textArea: string;
    readonly textField: string;
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
 * Reads only the finite T06 proof envelope; normal Runtime validators establish Bundle authority.
 *
 * @remarks This parser refuses malformed channel data instead of repairing it, so the independent
 * host cannot inherit an accidental or forged authoring-side shape.
 */
export function readStarterT06ProofEnvelope(storage: Storage): StarterT06ProofEnvelope | undefined {
  let raw: string | null;
  try {
    raw = storage.getItem(STARTER_T06_PROOF_CHANNEL_KEY);
  } catch {
    return undefined;
  }
  if (raw === null || raw.length > MAX_ENVELOPE_CODE_UNITS) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["schemaVersion", "catalog", "bundles", "roots", "nodes"]) ||
    parsed.schemaVersion !== 1 ||
    !isRecord(parsed.catalog) ||
    !exactKeys(parsed.catalog, ["id", "version", "target", "packageDigest"]) ||
    !isRecord(parsed.bundles) ||
    !exactKeys(parsed.bundles, ["button", "form"]) ||
    !isRecord(parsed.bundles.button) ||
    !exactKeys(parsed.bundles.button, ["disabled", "loading"]) ||
    !isRecord(parsed.roots) ||
    !exactKeys(parsed.roots, ["button", "form"]) ||
    !isRecord(parsed.nodes) ||
    !exactKeys(parsed.nodes, ["checkbox", "radioGroup", "switch", "textArea", "textField"])
  ) {
    return undefined;
  }
  const id = readText(parsed.catalog, "id");
  const version = readText(parsed.catalog, "version");
  const target = readText(parsed.catalog, "target");
  const packageDigest = readText(parsed.catalog, "packageDigest");
  const rootButton = readText(parsed.roots, "button");
  const rootForm = readText(parsed.roots, "form");
  const checkbox = readText(parsed.nodes, "checkbox");
  const radioGroup = readText(parsed.nodes, "radioGroup");
  const switchId = readText(parsed.nodes, "switch");
  const textArea = readText(parsed.nodes, "textArea");
  const textField = readText(parsed.nodes, "textField");
  const texts = [
    id,
    version,
    target,
    packageDigest,
    rootButton,
    rootForm,
    checkbox,
    radioGroup,
    switchId,
    textArea,
    textField,
  ];
  if (texts.some((value) => value === undefined)) return undefined;
  if (
    (id as string).length > 4_096 ||
    (version as string).length > 256 ||
    (target as string).length > 256 ||
    !SHA256_PATTERN.test(packageDigest as string) ||
    ![rootButton, rootForm, checkbox, radioGroup, switchId, textArea, textField].every((value) =>
      LOCAL_ID_PATTERN.test(value as string),
    )
  ) {
    return undefined;
  }
  return parsed as unknown as StarterT06ProofEnvelope;
}

/** Canonicalizes a detached inert snapshot before the strictly local authoring-to-host handoff. */
export function writeStarterT06ProofEnvelope(
  storage: Storage,
  envelope: StarterT06ProofEnvelope,
): void {
  const serialized = canonicalizeJson(envelope);
  if (serialized.length > MAX_ENVELOPE_CODE_UNITS) {
    throw new TypeError("M10A-T06 proof envelope exceeds its finite browser-local budget.");
  }
  storage.setItem(STARTER_T06_PROOF_CHANNEL_KEY, serialized);
}
