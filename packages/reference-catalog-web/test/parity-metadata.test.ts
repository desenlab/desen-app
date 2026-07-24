import { describe, expect, it } from "vitest";

import officialCatalog from "../../protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json";
import * as componentApi from "../src/components/index.js";
import { signInOperationRegistration } from "../src/operations/index.js";
import { REFERENCE_WEB_IMPLEMENTATION_METADATA } from "../src/parity/index.js";

const SELECTED_COMPONENT_REGISTRATIONS = Object.freeze({
  "com.example.ui/Alert": componentApi.alertComponentRegistration,
  "com.example.ui/Button": componentApi.buttonComponentRegistration,
  "com.example.ui/Stack": componentApi.stackComponentRegistration,
  "com.example.ui/Text": componentApi.textComponentRegistration,
  "com.example.ui/TextField": componentApi.textFieldComponentRegistration,
});

const EXPECTED_COMPONENT_CONTRACTS = Object.freeze({
  "com.example.ui/Alert": Object.freeze({
    productionExport: "Alert",
    props: ["text", "tone"],
    slots: [],
    events: [],
    commands: [],
    styleParts: ["icon", "root", "text"],
    visualStates: [],
  }),
  "com.example.ui/Button": Object.freeze({
    productionExport: "Button",
    props: ["disabled", "label", "loading", "variant"],
    slots: [],
    events: ["press"],
    commands: [],
    styleParts: ["label", "leadingIcon", "root"],
    visualStates: ["hover", "focus", "pressed", "disabled", "loading"],
  }),
  "com.example.ui/Stack": Object.freeze({
    productionExport: "Stack",
    props: ["align", "direction", "gap", "maxWidth"],
    slots: ["default"],
    events: [],
    commands: [],
    styleParts: ["root"],
    visualStates: [],
  }),
  "com.example.ui/Text": Object.freeze({
    productionExport: "Text",
    props: ["role", "text"],
    slots: [],
    events: [],
    commands: [],
    styleParts: ["text"],
    visualStates: [],
  }),
  "com.example.ui/TextField": Object.freeze({
    productionExport: "TextField",
    props: ["disabled", "invalid", "label", "placeholder", "secure", "value"],
    slots: [],
    events: ["change"],
    commands: ["focus"],
    styleParts: ["control", "label", "message", "root"],
    visualStates: ["focus", "disabled", "invalid"],
  }),
});

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function expectExecutableFree(value: unknown): void {
  expect(["function", "symbol", "bigint", "undefined"]).not.toContain(typeof value);
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    expect(["module", "modulePath", "url", "selector", "loader"]).not.toContain(key);
    expectExecutableFree(nested);
  }
}

describe("reference Web implementation parity metadata", () => {
  it("publishes frozen executable-free metadata for only the exact sign-in reference slice", () => {
    expect(REFERENCE_WEB_IMPLEMENTATION_METADATA).toMatchObject({
      schemaVersion: 1,
      protocol: "0.1.0",
      target: "web-react",
      scope: "reference-sign-in-slice",
    });
    expect(Object.keys(REFERENCE_WEB_IMPLEMENTATION_METADATA.components).sort()).toEqual(
      Object.keys(SELECTED_COMPONENT_REGISTRATIONS).sort(),
    );
    expect(REFERENCE_WEB_IMPLEMENTATION_METADATA.behaviors).toEqual({});
    expect(REFERENCE_WEB_IMPLEMENTATION_METADATA.resources).toEqual({});
    expect(Object.keys(REFERENCE_WEB_IMPLEMENTATION_METADATA.operations)).toEqual([
      "com.example.auth/signIn",
    ]);
    expectDeeplyFrozen(REFERENCE_WEB_IMPLEMENTATION_METADATA);
    expectExecutableFree(REFERENCE_WEB_IMPLEMENTATION_METADATA);
  });

  it("matches every selected official component and operation entry without claiming the full example Catalog", () => {
    for (const [capabilityId, registration] of Object.entries(SELECTED_COMPONENT_REGISTRATIONS)) {
      expect(registration.manifest).toEqual(
        officialCatalog.components[capabilityId as keyof typeof officialCatalog.components],
      );
    }
    expect(signInOperationRegistration.manifest).toEqual(
      officialCatalog.operations["com.example.auth/signIn"],
    );
    expect(Object.keys(officialCatalog.components)).toContain("com.example.maps/Map");
    expect(Object.keys(officialCatalog.behaviors)).toContain("com.example.interactions/Sortable");
    expect(Object.keys(officialCatalog.resources)).toHaveLength(2);
  });

  it("covers every declared component surface and only that surface", () => {
    for (const [capabilityId, expected] of Object.entries(EXPECTED_COMPONENT_CONTRACTS)) {
      const contract = REFERENCE_WEB_IMPLEMENTATION_METADATA.components[capabilityId];
      expect(contract).toBeDefined();
      expect(contract?.capabilityId).toBe(capabilityId);
      expect(contract?.declared.props).toEqual(expected.props);
      expect(contract?.declared.slots).toEqual(expected.slots);
      expect(contract?.declared.events).toEqual(expected.events);
      expect(contract?.declared.commands).toEqual(expected.commands);
      expect(Object.keys(contract?.declared.styleParts ?? {}).sort()).toEqual(expected.styleParts);
      expect(contract?.declared.visualStates).toEqual(expected.visualStates);
      expect(Object.keys(contract?.trustedBindings.slots ?? {}).sort()).toEqual(expected.slots);
      expect(Object.keys(contract?.trustedBindings.events ?? {}).sort()).toEqual(expected.events);
      expect(Object.keys(contract?.trustedBindings.commands ?? {}).sort()).toEqual(
        expected.commands,
      );
    }
  });

  it("binds same-fidelity authoring and production roles to the same real component export", () => {
    const api = componentApi as Readonly<Record<string, unknown>>;
    for (const [capabilityId, expected] of Object.entries(EXPECTED_COMPONENT_CONTRACTS)) {
      const contract = REFERENCE_WEB_IMPLEMENTATION_METADATA.components[capabilityId];
      expect(contract?.productionExport).toBe(expected.productionExport);
      expect(contract?.authoringExport).toBe(expected.productionExport);
      expect(contract?.adapterFidelity).toBe("same");
      expect(contract?.differences).toEqual([]);
      expect(typeof api[contract?.productionExport ?? ""]).toBe("function");
      expect(api[contract?.authoringExport ?? ""]).toBe(api[contract?.productionExport ?? ""]);
    }
  });

  it("documents every style part as a semantic hook without inventing always-present content", () => {
    const textField = REFERENCE_WEB_IMPLEMENTATION_METADATA.components["com.example.ui/TextField"];
    const button = REFERENCE_WEB_IMPLEMENTATION_METADATA.components["com.example.ui/Button"];
    const alert = REFERENCE_WEB_IMPLEMENTATION_METADATA.components["com.example.ui/Alert"];

    expect(textField?.declared.styleParts.message).toEqual({
      meaning: "Validation-message surface when trusted message content exists.",
      presence: "conditional",
    });
    expect(button?.declared.styleParts.leadingIcon?.presence).toBe("conditional");
    expect(alert?.declared.styleParts.icon?.presence).toBe("conditional");
    for (const contract of Object.values(REFERENCE_WEB_IMPLEMENTATION_METADATA.components)) {
      for (const stylePart of Object.values(contract.declared.styleParts)) {
        expect(stylePart.meaning.length).toBeGreaterThan(0);
        expect(["always", "conditional"]).toContain(stylePart.presence);
      }
    }
  });

  it("records the exact explicitly delegated sign-in binding without carrying a handler", () => {
    const operation = REFERENCE_WEB_IMPLEMENTATION_METADATA.operations["com.example.auth/signIn"];

    expect(operation).toEqual({
      capabilityId: "com.example.auth/signIn",
      binding: "application-supplied",
      bindingFactoryExport: "bindReferenceSignInHostOperation",
      publicErrors: ["invalidCredentials", "unavailable"],
    });
    expect(Object.keys(operation ?? {}).sort()).toEqual([
      "binding",
      "bindingFactoryExport",
      "capabilityId",
      "publicErrors",
    ]);
  });
});
