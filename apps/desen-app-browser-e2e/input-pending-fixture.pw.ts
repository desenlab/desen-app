import { expect, test } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

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

test("routes complete controlled input into one unresolved synthetic operation", async ({
  page,
}) => {
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
      // The complete console failure is retained when its location is not one valid URL.
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
  const secure = inspector(page).getByRole("switch", { name: "Secure" });
  await secure.check();
  await expect(secure).toBeChecked();
  await connectInput(page, "password");

  await insertComponent(page, "Button", 3);
  await setTextProperty(page, "Label", "Continue");
  const operationConnection = inspector(page).getByRole("region", {
    name: "Operation connection",
  });
  await expect(
    operationConnection.getByRole("combobox", {
      name: "Operation connection Catalog operation",
    }),
  ).toHaveValue("com.example.auth/signIn");
  await expect(
    operationConnection.getByRole("combobox", { name: /Operation connection email/iu }),
  ).toHaveValue("email");
  await expect(
    operationConnection.getByRole("combobox", { name: /Operation connection password/iu }),
  ).toHaveValue("password");
  const concurrency = operationConnection.getByRole("combobox", {
    name: "Operation connection concurrency",
  });
  await expect(concurrency).toHaveValue("reject");
  await concurrency.selectOption("queue");
  await operationConnection.getByRole("button", { name: "Connect operation" }).click();
  await expect(operationConnection.getByRole("status")).toContainText(
    "Connected Press, operation.signIn, and Loading pending.",
  );

  await page.getByRole("button", { name: "Run" }).click();
  const canvas = page.getByRole("group", { name: "Managed sign-in canvas" });
  const email = canvas.getByRole("textbox", { name: "Email" });
  const password = canvas.getByLabel("Password");
  const submit = canvas.getByRole("button", { name: "Continue" });
  await expect(password).toHaveAttribute("type", "password");
  await email.pressSequentially("designer");
  await expect(email).toHaveValue("designer");
  await email.pressSequentially("@example.test");
  await expect(email).toHaveValue("designer@example.test");
  await password.pressSequentially("correct horse");
  await expect(password).toHaveValue("correct horse");
  await password.pressSequentially(" battery staple");
  await expect(password).toHaveValue("correct horse battery staple");

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
  await expect(complete).toBeDisabled();
  await expect(submit).not.toHaveAttribute("aria-busy");

  await submit.click();
  await expect(submit).toBeFocused();
  await expect(operation.getByRole("status")).toHaveText(
    "Pending · complete this fixture to settle the Runtime call.",
  );
  await expect(outcome).toBeDisabled();
  await expect(complete).toBeEnabled();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toHaveAttribute("aria-disabled", "true");
  await expect(submit).toHaveAttribute("data-loading", "true");
  await expect(email).toHaveValue("designer@example.test");
  await expect(password).toHaveValue("correct horse battery staple");

  await page.keyboard.press("Enter");
  await expect(operation.getByRole("status")).toHaveText(
    "Pending · complete this fixture to settle the Runtime call.",
  );
  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.getByRole("complementary", { name: "Run controls" })).toHaveCount(0);
  await page.getByRole("button", { name: "Run" }).click();
  const restoredOperation = page
    .getByRole("complementary", { name: "Run controls" })
    .getByRole("group", { name: "Operation signIn" });
  await expect(restoredOperation.getByRole("status")).toHaveText(
    "Pending · complete this fixture to settle the Runtime call.",
  );
  await expect(canvas.getByRole("button", { name: "Continue" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(email).toHaveValue("designer@example.test");
  await expect(password).toHaveValue("correct horse battery staple");
  await expect(canvas.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);

  const restoredOutcome = restoredOperation.getByRole("combobox", {
    name: "Next outcome for signIn",
  });
  const restoredComplete = restoredOperation.getByRole("button", {
    name: "Complete signIn fixture",
  });
  await restoredComplete.click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await expect(restoredOperation.getByRole("status")).toHaveText(
    "Synthetic public error completed.",
  );
  await expect(restoredOutcome).toBeEnabled();
  await expect(restoredComplete).toBeDisabled();
  const restoredSubmit = canvas.getByRole("button", { name: "Continue" });
  await expect(restoredSubmit).not.toHaveAttribute("aria-busy");
  await expect(restoredSubmit).not.toHaveAttribute("aria-disabled");
  await expect(restoredSubmit).not.toHaveAttribute("data-loading");
  await expect(email).toHaveValue("designer@example.test");
  await expect(password).toHaveValue("correct horse battery staple");
  await expect(canvas.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);
  expect(runtimeFailures).toEqual([]);
});
