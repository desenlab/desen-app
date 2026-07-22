import { describe, expect, it } from "vitest";

import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import { validateDesenComponentCatalogSet } from "../src/component-contract-validation.js";
import {
  getPreparedDesenEventPayloadSchema,
  validateDesenInteractionCatalogSet,
} from "../src/interaction-contract-validation.js";

describe("M02-T10 trusted event-schema bridge", () => {
  it("returns the frozen prepared schema for exact component and behavior declarations", () => {
    const prepared = validateDesenInteractionCatalogSet([validCatalog]);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected T09 catalog preparation to pass.");

    const componentSchema = getPreparedDesenEventPayloadSchema(
      prepared.value,
      "component",
      "com.example.ui/TextField",
      "change",
    );
    const behaviorSchema = getPreparedDesenEventPayloadSchema(
      prepared.value,
      "behavior",
      "com.example.interactions/Sortable",
      "reorder",
    );

    expect(componentSchema).toEqual(
      validCatalog.components["com.example.ui/TextField"].events.change.payloadSchema,
    );
    expect(behaviorSchema).toEqual(
      validCatalog.behaviors["com.example.interactions/Sortable"].events.reorder.payloadSchema,
    );
    expect(Object.isFrozen(componentSchema)).toBe(true);
    expect(Object.isFrozen(behaviorSchema)).toBe(true);
  });

  it("does not expose schemas through a forged T09 brand or an inexact selector", () => {
    const lowerStage = validateDesenComponentCatalogSet([validCatalog]);
    expect(lowerStage.valid).toBe(true);
    if (!lowerStage.valid) throw new TypeError("Expected T08 catalog preparation to pass.");

    expect(
      getPreparedDesenEventPayloadSchema(
        lowerStage.value as never,
        "component",
        "com.example.ui/TextField",
        "change",
      ),
    ).toBeUndefined();

    const prepared = validateDesenInteractionCatalogSet([validCatalog]);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected T09 catalog preparation to pass.");
    expect(
      getPreparedDesenEventPayloadSchema(
        prepared.value,
        "component",
        "com.example.ui/TextField",
        "missing",
      ),
    ).toBeUndefined();
  });
});
