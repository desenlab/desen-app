import type { DesenAppProjectSummary, DesenAppSurfaceSummary } from "./project-data.js";

const PROJECT_KEYS = Object.freeze([
  "id",
  "name",
  "description",
  "catalog",
  "navigationStatus",
  "surfaces",
] as const);
const SURFACE_KEYS = Object.freeze(["id", "sourceId", "name", "state", "detail"] as const);
const ROUTE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_PROJECTS = 1_024;
const MAX_SURFACES = 1_024;
const MAX_TOTAL_SURFACES = 4_096;
const MAX_TEXT_CODE_UNITS = 512;
const MAX_TOTAL_TEXT_CODE_UNITS = 1_048_576;

declare const PROJECT_INVENTORY_FIXTURE_HANDLE_BRAND: unique symbol;

/** Opaque identity for inert route/gallery examples that grant no Source or host authority. */
export interface ProjectInventoryFixtureHandle {
  readonly [PROJECT_INVENTORY_FIXTURE_HANDLE_BRAND]: true;
}

export type ProjectInventoryFixtureCreationResult =
  | Readonly<{
      readonly ok: true;
      readonly handle: ProjectInventoryFixtureHandle;
      readonly projects: readonly DesenAppProjectSummary[];
    }>
  | Readonly<{ readonly ok: false; readonly reason: "fixture-invalid" }>;

export type ProjectInventoryFixtureReadResult =
  | Readonly<{ readonly status: "read"; readonly projects: readonly DesenAppProjectSummary[] }>
  | Readonly<{ readonly status: "invalid-handle" }>;

const FIXTURE_AUTHORITIES = new WeakMap<
  ProjectInventoryFixtureHandle,
  readonly DesenAppProjectSummary[]
>();

function exactOwnDataRecord(
  input: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return null;
    }
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return null;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    return null;
  }
}

function captureArray(input: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum ||
      Reflect.ownKeys(input).length !== lengthDescriptor.value + 1
    ) {
      return null;
    }
    const captured: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return null;
      }
      captured.push(descriptor.value);
    }
    return Object.freeze(captured);
  } catch {
    return null;
  }
}

function boundedText(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_TEXT_CODE_UNITS) {
    return null;
  }
  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) return null;
  }
  return input;
}

function captureSurface(input: unknown): DesenAppSurfaceSummary | null {
  const captured = exactOwnDataRecord(input, SURFACE_KEYS);
  if (captured === null) return null;
  const id = boundedText(captured.id);
  const sourceId = boundedText(captured.sourceId);
  const name = boundedText(captured.name);
  const detail = boundedText(captured.detail);
  if (
    id === null ||
    !ROUTE_SEGMENT_PATTERN.test(id) ||
    sourceId === null ||
    name === null ||
    detail === null ||
    (captured.state !== "navigable" && captured.state !== "not-configured")
  ) {
    return null;
  }
  return Object.freeze({ id, sourceId, name, state: captured.state, detail });
}

function captureProject(input: unknown): DesenAppProjectSummary | null {
  const captured = exactOwnDataRecord(input, PROJECT_KEYS);
  if (captured === null) return null;
  const id = boundedText(captured.id);
  const name = boundedText(captured.name);
  const description = boundedText(captured.description);
  const navigationStatus = boundedText(captured.navigationStatus);
  const surfaceInputs = captureArray(captured.surfaces, MAX_SURFACES);
  if (
    id === null ||
    !ROUTE_SEGMENT_PATTERN.test(id) ||
    name === null ||
    description === null ||
    navigationStatus === null ||
    (captured.catalog !== undefined && boundedText(captured.catalog) === null) ||
    surfaceInputs === null
  ) {
    return null;
  }
  const surfaces: DesenAppSurfaceSummary[] = [];
  const routeIds = new Set<string>();
  const sourceIds = new Set<string>();
  for (const candidate of surfaceInputs) {
    const surface = captureSurface(candidate);
    if (surface === null || routeIds.has(surface.id) || sourceIds.has(surface.sourceId)) {
      return null;
    }
    routeIds.add(surface.id);
    sourceIds.add(surface.sourceId);
    surfaces.push(surface);
  }
  return Object.freeze({
    id,
    name,
    description,
    catalog: captured.catalog as string | undefined,
    navigationStatus,
    surfaces: Object.freeze(surfaces),
  });
}

/** Creates a detached inert inventory; it carries no document, persistence or runtime authority. */
export function createProjectInventoryFixture(
  input: readonly DesenAppProjectSummary[],
): ProjectInventoryFixtureCreationResult {
  const projectInputs = captureArray(input, MAX_PROJECTS);
  if (projectInputs === null) {
    return Object.freeze({ ok: false, reason: "fixture-invalid" });
  }
  const projects: DesenAppProjectSummary[] = [];
  const projectIds = new Set<string>();
  let totalSurfaces = 0;
  let totalTextCodeUnits = 0;
  for (const candidate of projectInputs) {
    const project = captureProject(candidate);
    if (project === null || projectIds.has(project.id)) {
      return Object.freeze({ ok: false, reason: "fixture-invalid" });
    }
    totalSurfaces += project.surfaces.length;
    totalTextCodeUnits +=
      project.id.length +
      project.name.length +
      project.description.length +
      (project.catalog?.length ?? 0) +
      project.navigationStatus.length +
      project.surfaces.reduce(
        (sum, surface) =>
          sum +
          surface.id.length +
          surface.sourceId.length +
          surface.name.length +
          surface.detail.length,
        0,
      );
    if (totalSurfaces > MAX_TOTAL_SURFACES || totalTextCodeUnits > MAX_TOTAL_TEXT_CODE_UNITS) {
      return Object.freeze({ ok: false, reason: "fixture-invalid" });
    }
    projectIds.add(project.id);
    projects.push(project);
  }
  const detached = Object.freeze(projects);
  const handle = Object.freeze({}) as ProjectInventoryFixtureHandle;
  FIXTURE_AUTHORITIES.set(handle, detached);
  return Object.freeze({ ok: true, handle, projects: detached });
}

/** Authenticates and reads one previously created inert project inventory. */
export function readProjectInventoryFixture(
  handle: ProjectInventoryFixtureHandle,
): ProjectInventoryFixtureReadResult {
  const projects = FIXTURE_AUTHORITIES.get(handle);
  return projects === undefined
    ? Object.freeze({ status: "invalid-handle" })
    : Object.freeze({ status: "read", projects });
}
