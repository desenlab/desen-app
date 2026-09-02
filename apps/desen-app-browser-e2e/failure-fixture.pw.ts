import { expect, test } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

const PUBLIC_FAILURE_MESSAGE = "We could not sign in. Check your details and try again.";

function placementTarget(page: Page): Locator {
  return page.getByRole("group", {
    name: /^Placement target · Stack sign-in\.layout default slot/u,
  });
}

function inspector(page: Page): Locator {
  return page.getByRole("complementary", { name: "Inspector" });
}

async function createBlankProject(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/projects$/u);
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await expect(dialog.getByRole("radio", { name: /Blank Account app project/u })).toBeChecked();
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);
  await expect(placementTarget(page)).toBeVisible();
}

async function addLocalState(page: Page, name: string): Promise<void> {
  const panel = inspector(page);
  await panel.getByRole("tab", { name: "State" }).click();
  const state = panel.getByRole("region", { name: "Local state" });
  await state.getByRole("textbox", { name: "New state name" }).fill(name);
  await state.getByRole("button", { name: "Add" }).click();
  await expect(state.getByRole("heading", { level: 3, name })).toBeVisible();
  await panel.getByRole("tab", { name: "Inspector" }).click();
}

async function insertComponent(page: Page, displayName: string, position: number): Promise<void> {
  await page
    .getByRole("button", {
      name: new RegExp(
        `^Insert ${displayName} into Stack sign-in\\.layout default slot at position ${position}`,
        "u",
      ),
    })
    .click();
}

async function setTextProperty(page: Page, name: string, value: string): Promise<void> {
  const panel = inspector(page);
  await panel.getByRole("textbox", { name }).fill(value);
  await panel.getByRole("button", { name: `Apply ${name}` }).click();
  await expect(panel.getByRole("status")).toContainText(`Updated ${name}.`);
}

async function connectInput(page: Page, stateName: string): Promise<void> {
  const connection = inspector(page).getByRole("region", { name: "Input connection" });
  await connection
    .getByRole("combobox", { name: "Input connection state" })
    .selectOption(stateName);
  await connection.getByRole("button", { name: "Connect input" }).click();
  await expect(connection.getByRole("status")).toContainText(
    `Connected Value and change to state.${stateName}.`,
  );
}

async function configureOperationFailureVisibility(page: Page): Promise<void> {
  const visibility = inspector(page).getByRole("region", { name: "Layer visibility" });
  await visibility
    .getByRole("combobox", { name: "Layer visibility mode" })
    .selectOption("operation");
  await visibility
    .getByRole("combobox", { name: "Visibility operation result" })
    .selectOption("signIn");
  await visibility
    .getByRole("combobox", { name: "Visibility operation status" })
    .selectOption("failed");
  await visibility.getByRole("button", { name: "Apply visibility" }).click();
  await expect(visibility.getByRole("status")).toContainText("Updated this layer's visibility.");
}

async function nextPaint(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test("authors and retries one visible Catalog-declared public failure", async ({ page }) => {
  const runtimeFailures: string[] = [];
  let initialMissingSourceObserved = false;
  page.on("pageerror", (error) => runtimeFailures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    let pathname = "";
    try {
      pathname = new URL(location.url).pathname;
    } catch {
      // Retain the complete console failure when its location is not one valid URL.
    }
    if (
      !initialMissingSourceObserved &&
      pathname === "/v1/sources/account-app-source" &&
      message.text() ===
        "Failed to load resource: the server responded with a status of 404 (Not Found)"
    ) {
      initialMissingSourceObserved = true;
      return;
    }
    runtimeFailures.push(
      `console: ${message.text()}${location.url === "" ? "" : ` · ${location.url}`}`,
    );
  });

  await createBlankProject(page);
  expect(initialMissingSourceObserved).toBe(true);
  await addLocalState(page, "email");
  await addLocalState(page, "password");

  await insertComponent(page, "Text field", 1);
  await setTextProperty(page, "Label", "Email");
  await connectInput(page, "email");

  await insertComponent(page, "Text field", 2);
  await setTextProperty(page, "Label", "Password");
  await inspector(page).getByRole("button", { name: "Set Secure" }).click();
  await inspector(page).getByRole("switch", { name: "Secure" }).check();
  await connectInput(page, "password");

  await insertComponent(page, "Button", 3);
  await setTextProperty(page, "Label", "Sign in");
  const operationConnection = inspector(page).getByRole("region", {
    name: "Operation connection",
  });
  await operationConnection.getByRole("button", { name: "Connect operation" }).click();
  await expect(operationConnection.getByRole("status")).toContainText(
    "Connected Press, operation.signIn, and Loading pending.",
  );

  await insertComponent(page, "Alert", 4);
  await setTextProperty(page, "Text", PUBLIC_FAILURE_MESSAGE);
  await inspector(page).getByRole("combobox", { name: "Tone" }).selectOption("critical");
  await configureOperationFailureVisibility(page);

  const canvas = page.getByRole("group", { name: "Managed sign-in canvas" });
  const frame = page.locator("[data-canvas-frame='portrait']");
  await expect(frame).toHaveAttribute("data-canvas-frame-width", "420");
  await expect(frame).toHaveAttribute("data-canvas-frame-height", "720");
  await expect(canvas.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "Run" }).click();
  const email = canvas.getByRole("textbox", { name: "Email" });
  const password = canvas.getByLabel("Password");
  const submit = canvas.getByRole("button", { name: "Sign in" });
  await email.pressSequentially("designer@example.test");
  await password.pressSequentially("correct horse battery staple");

  const runControls = page.getByRole("complementary", { name: "Run controls" });
  const operation = runControls.getByRole("group", { name: "Operation signIn" });
  const outcome = operation.getByRole("combobox", { name: "Next outcome for signIn" });
  const complete = operation.getByRole("button", { name: "Complete signIn fixture" });
  await expect(runControls.getByRole("radio", { name: /^Synthetic/u })).toBeChecked();
  await expect(runControls.getByRole("radio", { name: /^Integration/u })).toBeDisabled();
  await expect(runControls.getByRole("radio", { name: /^Production/u })).toBeDisabled();
  await expect
    .poll(() =>
      outcome
        .locator("option")
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)),
    )
    .toEqual(["success", "error:invalidCredentials"]);
  await outcome.selectOption("error:invalidCredentials");

  const initialFrameBox = await frame.boundingBox();
  expect(initialFrameBox).not.toBeNull();
  const initialHorizontalGeometry = await page.evaluate(() => ({
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));

  await submit.click();
  await expect(operation.getByRole("status")).toHaveText(
    "Pending · complete this fixture to settle the Runtime call.",
  );
  await expect(canvas.getByRole("alert")).toHaveCount(0);
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(email).toHaveValue("designer@example.test");
  await expect(password).toHaveValue("correct horse battery staple");

  await complete.click();
  await nextPaint(page);
  const alert = canvas.getByRole("alert");
  await expect(alert).toHaveText(PUBLIC_FAILURE_MESSAGE);
  await expect(alert).toHaveAttribute("data-tone", "critical");
  await expect(operation.getByRole("status")).toHaveText("Synthetic public error completed.");
  await expect(submit).not.toHaveAttribute("aria-busy");
  await expect(submit).not.toHaveAttribute("aria-disabled");
  await expect(submit).not.toHaveAttribute("data-loading");
  await expect(email).toHaveValue("designer@example.test");
  await expect(password).toHaveValue("correct horse battery staple");
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);

  const failureFrameBox = await frame.boundingBox();
  expect(failureFrameBox).toEqual(initialFrameBox);
  expect(
    await page.evaluate(() => ({
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    })),
  ).toEqual(initialHorizontalGeometry);

  await submit.click();
  await expect(operation.getByRole("status")).toHaveText(
    "Pending · complete this fixture to settle the Runtime call.",
  );
  await expect(alert).toHaveCount(0);
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toHaveAttribute("aria-disabled", "true");
  await expect(submit).toHaveAttribute("data-loading", "true");
  await expect(email).toHaveValue("designer@example.test");
  await expect(password).toHaveValue("correct horse battery staple");
  await complete.click();
  await nextPaint(page);
  await expect(canvas.getByRole("alert")).toHaveText(PUBLIC_FAILURE_MESSAGE);
  await expect(submit).not.toHaveAttribute("aria-busy");
  await expect(submit).not.toHaveAttribute("aria-disabled");
  await expect(submit).not.toHaveAttribute("data-loading");
  expect(await frame.boundingBox()).toEqual(initialFrameBox);
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);
  expect(runtimeFailures).toEqual([]);
});
