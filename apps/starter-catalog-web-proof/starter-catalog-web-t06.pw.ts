import { expect, test } from "@playwright/test";

import { STARTER_T06_BROWSER_PROOF_TEST_TITLES } from "./t06-proof-contract.js";

import type { Locator, Page } from "@playwright/test";

interface HostT06ProofApi {
  readonly dispatchMalformedRadioGroupEvent: () => "rejected" | "unexpected";
  readonly dispatchMalformedTextFieldEvent: () => "rejected" | "unexpected";
  readonly readFormState: () => Readonly<Record<string, unknown>> | undefined;
}

async function openPublisherDerivedT06Host(page: Page): Promise<void> {
  await page.goto("/t06-authoring.html");
  await expect(page.locator("[data-proof-ready='t06-authoring']")).toBeVisible();
  await page.goto("/t06-host.html");
  await expect(page.locator("[data-proof-ready='t06-host']")).toBeVisible();
}

function formSurface(page: Page): Locator {
  return page.locator("[data-proof-surface='t06-form']");
}

async function expectDescription(control: Locator, message: Locator): Promise<void> {
  const describedBy = await control.getAttribute("aria-describedby");
  const messageId = await message.getAttribute("id");
  expect(describedBy?.split(/\s+/u)).toContain(messageId);
}

async function expectLabelAssociation(control: Locator, label: Locator): Promise<void> {
  expect(await label.getAttribute("for")).toBe(await control.getAttribute("id"));
}

async function expectAriaLabelAssociation(control: Locator, label: Locator): Promise<void> {
  expect(await control.getAttribute("aria-labelledby")).toBe(await label.getAttribute("id"));
}

async function expectNativeChoiceLabelAssociation(
  nativeInputs: Locator,
  label: Locator,
): Promise<void> {
  const inputId = await label.getAttribute("for");
  expect(inputId).toBeTruthy();
  expect(
    await nativeInputs.evaluateAll(
      (inputs, expectedId) => inputs.some((input) => input.id === expectedId),
      inputId,
    ),
  ).toBe(true);
}

async function expectFormSemantics(page: Page): Promise<void> {
  const surface = formSurface(page);
  await expect(surface).toBeVisible();

  const textField = surface.getByRole("textbox", { name: "Project name" });
  const textArea = surface.getByRole("textbox", { name: "Project summary" });
  const checkbox = surface.getByRole("checkbox", { name: "Receive design updates" });
  const radioGroup = surface.getByRole("radiogroup", { name: "Publishing plan" });
  const radio = surface.getByRole("radio", { name: "Starter" });
  const radioLabel = surface.locator("label", { hasText: "Starter" });
  const teamRadio = surface.getByRole("radio", { name: "Team" });
  const teamLabel = surface.locator("label", { hasText: "Team" });
  const switchControl = surface.getByRole("switch", { name: "Enable review notifications" });

  await expect(textField).toBeVisible();
  await expect(textArea).toBeVisible();
  await expect(checkbox).toBeVisible();
  await expect(radioGroup).toBeVisible();
  await expect(radio).toBeVisible();
  await expect(switchControl).toBeVisible();

  const textFieldLabel = surface.locator("label", { hasText: "Project name" });
  const textAreaLabel = surface.locator("label", { hasText: "Project summary" });
  const checkboxLabel = surface.locator("label", { hasText: "Receive design updates" });
  const switchLabel = surface.locator("label", { hasText: "Enable review notifications" });
  await expectLabelAssociation(textField, textFieldLabel);
  await expectLabelAssociation(textArea, textAreaLabel);
  await expectNativeChoiceLabelAssociation(surface.locator("input"), checkboxLabel);
  await expectNativeChoiceLabelAssociation(surface.locator("input"), switchLabel);
  await expectAriaLabelAssociation(checkbox, checkboxLabel);
  await expectAriaLabelAssociation(switchControl, switchLabel);

  const groupLegend = surface.locator("legend", { hasText: "Publishing plan" });
  expect(await radioGroup.getAttribute("aria-labelledby")).toBe(
    await groupLegend.getAttribute("id"),
  );
  await expect(surface.getByRole("radio", { name: "Enterprise" })).toBeDisabled();

  const textHelp = surface.getByText("Used in the project overview.");
  const textError = surface.getByText("Add a clear project summary.");
  const checkboxHelp = surface.getByText("Only product and workflow updates are sent.");
  const radioHelp = surface.getByText("Choose the scope to prepare.");
  const radioError = surface.getByText("Choose an admitted publishing plan.");
  const switchHelp = surface.getByText("A notification is prepared when the review state changes.");
  await expectDescription(textField, textHelp);
  await expectDescription(textArea, textError);
  await expectDescription(checkbox, checkboxHelp);
  await expectDescription(radioGroup, radioHelp);
  await expectDescription(radioGroup, radioError);
  await expectDescription(switchControl, switchHelp);
  const textErrorId = await textError.getAttribute("id");
  if (textErrorId === null) throw new TypeError("T06 text-area error did not retain an identity.");
  await expect(textArea).toHaveAttribute("aria-errormessage", textErrorId);
  await expect(textArea).toHaveAttribute("aria-invalid", "true");

  const inlineStyle = await textField.getAttribute("style");
  expect(inlineStyle).toContain("border");
  await expect(textField).toHaveAttribute("aria-labelledby");
  await expect(textField).toHaveAttribute("aria-describedby");

  // Every declared RadioGroup state reaches its public part without weakening the semantic tree.
  await expect(radioGroup).toHaveAttribute(
    "style",
    /background-color:\s*rgb\(243,\s*243,\s*241\)/u,
  );
  await expect(radio).toHaveAttribute("style", /border-width:\s*2px/u);
  await expect(radioLabel).toHaveAttribute("style", /color:\s*rgb\(159,\s*18,\s*57\)/u);
  await radio.hover();
  await expect(radio).toHaveAttribute("style", /margin-inline:\s*12px/u);
  await expect(teamRadio).toHaveAttribute("style", /margin-inline:\s*4px/u);
  await radio.focus();
  await expect(radioLabel).toHaveAttribute("style", /font-weight:\s*700/u);
  await expect(teamLabel).not.toHaveAttribute("style", /font-weight:\s*700/u);
}

test(STARTER_T06_BROWSER_PROOF_TEST_TITLES.publication, async ({ page, request }) => {
  await page.goto("/t06-authoring.html");
  await expect(page.locator("[data-proof-ready='t06-authoring']")).toBeVisible();

  await expect(page.locator("[data-proof-surface]")).toHaveCount(2);
  await expect(formSurface(page).getByRole("textbox", { name: "Project name" })).toBeVisible();
  await expect(formSurface(page).getByRole("textbox", { name: "Project summary" })).toBeVisible();
  await expect(
    formSurface(page).getByRole("checkbox", { name: "Receive design updates" }),
  ).toBeVisible();
  await expect(
    formSurface(page).getByRole("radiogroup", { name: "Publishing plan" }),
  ).toBeVisible();
  await expect(
    formSurface(page).getByRole("switch", { name: "Enable review notifications" }),
  ).toBeVisible();
  await expect(
    page.locator("[data-proof-surface='t06-button'] button", { hasText: "Unavailable action" }),
  ).toBeDisabled();
  await expect(page.locator("[data-negative-invalid-rows='rejected']")).toHaveCount(1);
  await expect(page.locator("[data-negative-invalid-radio-option-value='rejected']")).toHaveCount(
    1,
  );

  const receiptResponse = await request.get("/t06-authoring-graph-proof.json");
  expect(receiptResponse.ok()).toBe(true);
  const receipt = (await receiptResponse.json()) as {
    readonly profile: string;
    readonly result: string;
    readonly assertions: {
      readonly exactStarterRegistryPresent: boolean;
      readonly t06FixturePresent: boolean;
      readonly publisherPresent: boolean;
    };
  };
  expect(receipt).toMatchObject({
    profile: "desen.m10a-t06.graph-proof.v1",
    result: "PASS",
    assertions: {
      exactStarterRegistryPresent: true,
      t06FixturePresent: true,
      publisherPresent: true,
    },
  });
});

test(STARTER_T06_BROWSER_PROOF_TEST_TITLES.semantics, async ({ page, request }) => {
  await page.goto("/t06-authoring.html");
  await expect(page.locator("[data-proof-ready='t06-authoring']")).toBeVisible();
  await expectFormSemantics(page);

  await page.goto("/t06-host.html");
  await expect(page.locator("[data-proof-ready='t06-host']")).toBeVisible();
  await expectFormSemantics(page);

  const receiptResponse = await request.get("/t06-host-graph-proof.json");
  expect(receiptResponse.ok()).toBe(true);
  const receipt = (await receiptResponse.json()) as {
    readonly profile: string;
    readonly result: string;
    readonly assertions: {
      readonly exactStarterRegistryPresent: boolean;
      readonly publisherPresent: boolean;
      readonly editorPresent: boolean;
      readonly independentHostAuthority: boolean;
    };
    readonly modules: readonly string[];
  };
  expect(receipt).toMatchObject({
    profile: "desen.m10a-t06.graph-proof.v1",
    result: "PASS",
    assertions: {
      exactStarterRegistryPresent: true,
      publisherPresent: false,
      editorPresent: false,
      independentHostAuthority: true,
    },
  });
  expect(receipt.modules.some((path) => path.includes("packages/publisher/"))).toBe(false);
  expect(receipt.modules.some((path) => path.includes("packages/editor-core/"))).toBe(false);
});

test(STARTER_T06_BROWSER_PROOF_TEST_TITLES.controlledEvents, async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openPublisherDerivedT06Host(page);

  const surface = formSurface(page);
  const textField = surface.getByRole("textbox", { name: "Project name" });
  await textField.focus();
  await expect(textField).toBeFocused();
  await textField.fill("North star");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.projectName;
      }),
    )
    .toBe("North star");

  const textArea = surface.getByRole("textbox", { name: "Project summary" });
  await textArea.focus();
  await expect(textArea).toBeFocused();
  await textArea.fill("A controlled multiline description.");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.projectSummary;
      }),
    )
    .toBe("A controlled multiline description.");

  const checkbox = surface.getByRole("checkbox", { name: "Receive design updates" });
  const checkboxLabel = surface.locator("label", { hasText: "Receive design updates" });
  await checkboxLabel.click();
  await expect(checkbox).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.receiveUpdates;
      }),
    )
    .toBe(true);
  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  await page.keyboard.press("Space");
  await expect(checkbox).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.receiveUpdates;
      }),
    )
    .toBe(false);

  const team = surface.getByRole("radio", { name: "Team" });
  await team.focus();
  await expect(team).toBeFocused();
  await page.keyboard.press("Space");
  await expect(team).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.plan;
      }),
    )
    .toBe("team");

  const enterprise = surface.getByRole("radio", { name: "Enterprise" });
  const enterpriseLabel = surface.locator("label", { hasText: "Enterprise" });
  await expect(enterprise).toBeDisabled();
  await expect(enterpriseLabel).toHaveCSS("cursor", "not-allowed");
  await enterpriseLabel.click({ force: true });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.plan;
      }),
    )
    .toBe("team");

  const switchControl = surface.getByRole("switch", { name: "Enable review notifications" });
  const switchLabel = surface.locator("label", { hasText: "Enable review notifications" });
  await switchLabel.click();
  await expect(switchControl).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.reviewNotifications;
      }),
    )
    .toBe(true);
  await switchControl.focus();
  await expect(switchControl).toBeFocused();
  await page.keyboard.press("Space");
  await expect(switchControl).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
          .__DESEN_STARTER_T06_HOST_PROOF__;
        return api.readFormState()?.reviewNotifications;
      }),
    )
    .toBe(false);

  expect(pageErrors).toEqual([]);
});

test(STARTER_T06_BROWSER_PROOF_TEST_TITLES.boundaries, async ({ page }) => {
  await openPublisherDerivedT06Host(page);

  const buttonSurface = page.locator("[data-proof-surface='t06-button']");
  const disabledButton = buttonSurface.getByRole("button", { name: "Unavailable action" });
  await expect(disabledButton).toBeDisabled();
  await expect(disabledButton).not.toHaveAttribute("aria-busy", "true");
  await page.locator("[data-t06-proof-switch-button]").click();
  const loadingButton = buttonSurface.getByRole("button", { name: "Publishing form controls…" });
  await expect(loadingButton).toHaveAttribute("aria-busy", "true");

  const stateBeforeMalformedEvent = await page.evaluate(() => {
    const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
      .__DESEN_STARTER_T06_HOST_PROOF__;
    return api.readFormState();
  });
  expect(
    await page.evaluate(() => {
      const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
        .__DESEN_STARTER_T06_HOST_PROOF__;
      return api.dispatchMalformedTextFieldEvent();
    }),
  ).toBe("rejected");
  expect(
    await page.evaluate(() => {
      const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
        .__DESEN_STARTER_T06_HOST_PROOF__;
      return api.dispatchMalformedRadioGroupEvent();
    }),
  ).toBe("rejected");
  expect(
    await page.evaluate(() => {
      const api = (window as unknown as { __DESEN_STARTER_T06_HOST_PROOF__: HostT06ProofApi })
        .__DESEN_STARTER_T06_HOST_PROOF__;
      return api.readFormState();
    }),
  ).toEqual(stateBeforeMalformedEvent);
});
