import {
  DESIGN_TOKEN_PROFILE,
  admitEditableProjectRecord,
  migrateEditableProjectRecord,
  resolveDesignTokens,
} from "@desen/design-system-core";

import type {
  DesignTokenResolutionRequest,
  DtcgColorValue,
  EditableProjectRecord,
} from "@desen/design-system-core";

declare const input: unknown;

const admission = admitEditableProjectRecord(input);
if (admission.ok) {
  const project: EditableProjectRecord = admission.record;
  const request: DesignTokenResolutionRequest = {
    sources: project.designSystem.tokenSources,
  };
  const resolution = resolveDesignTokens(request);
  if (resolution.ok) {
    const color = resolution.tokens["color.brand"]?.value;
    void color;

    // @ts-expect-error resolved maps are immutable
    resolution.tokens["color.brand"] = {} as never;
  }

  // @ts-expect-error admitted project identities are immutable
  project.id = "changed";
}

const migration = migrateEditableProjectRecord(input);
if (migration.ok) {
  const migrated: false = migration.migrated;
  const losses: readonly [] = migration.losses;
  void migrated;
  void losses;
}

const color: DtcgColorValue = {
  colorSpace: "srgb",
  components: [0, 0, 0],
};
const version: "2025.10" = DESIGN_TOKEN_PROFILE.formatVersion;

// @ts-expect-error the closed profile does not type a wide-gamut color literal
const unsupportedColor: DtcgColorValue = { colorSpace: "display-p3", components: [1, 0, 0] };

// @ts-expect-error selected token sources are required
const missingSources: DesignTokenResolutionRequest = {};

void color;
void version;
void unsupportedColor;
void missingSources;
