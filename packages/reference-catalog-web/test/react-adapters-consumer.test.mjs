import { describe, expect, it } from "vitest";

import * as publicReactAdapters from "@desen/reference-catalog-web/react-adapters";
import * as consumerReactAdapters from "./react-adapters-consumer.mjs";

const EXPECTED_PUBLIC_REACT_ADAPTER_EXPORTS = Object.freeze(
  [
    "AlertReactAdapter",
    "ButtonReactAdapter",
    "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
    "REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS",
    "StackReactAdapter",
    "TextFieldReactAdapter",
    "TextReactAdapter",
    "alertReactAdapterRegistration",
    "buttonReactAdapterRegistration",
    "stackReactAdapterRegistration",
    "textFieldReactAdapterRegistration",
    "textReactAdapterRegistration",
  ].sort(),
);

describe("reference Web React adapter package consumer", () => {
  it("loads the exact public react-adapters package subpath through the consumer fixture", () => {
    expect(Object.keys(consumerReactAdapters).sort()).toEqual(
      EXPECTED_PUBLIC_REACT_ADAPTER_EXPORTS,
    );
    expect(Object.keys(publicReactAdapters).sort()).toEqual(EXPECTED_PUBLIC_REACT_ADAPTER_EXPORTS);
    for (const exportName of EXPECTED_PUBLIC_REACT_ADAPTER_EXPORTS) {
      expect(consumerReactAdapters[exportName]).toBe(publicReactAdapters[exportName]);
    }
  });
});
