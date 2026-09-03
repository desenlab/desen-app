import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

const ALIAS = "submitCredentials";

function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Inspector" });
}

async function insert(page: Page, surface: string, component: string, position: number) {
  await page
    .getByRole("button", {
      name: new RegExp(
        `^Insert ${component} into Stack ${surface}\\.layout default slot at position ${position}`,
        "u",
      ),
    })
    .click();
}

async function property(page: Page, name: string, value: string) {
  await inspector(page).getByRole("textbox", { name, exact: true }).fill(value);
  await inspector(page)
    .getByRole("button", { name: `Apply ${name}`, exact: true })
    .click();
}

async function state(page: Page, name: string) {
  await inspector(page).getByRole("tab", { name: "State", exact: true }).click();
  const panel = inspector(page).getByRole("region", { name: "Local state" });
  await panel.getByRole("textbox", { name: "New state name" }).fill(name);
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await inspector(page).getByRole("tab", { name: "Inspector", exact: true }).click();
}

async function connectInput(page: Page, name: string) {
  const connection = inspector(page).getByRole("region", { name: "Input connection" });
  await connection.getByRole("combobox", { name: "Input connection state" }).selectOption(name);
  await connection.getByRole("button", { name: "Connect input" }).click();
}

async function save(page: Page) {
  const commands = page.getByLabel("Workspace commands", { exact: true });
  await commands.getByText("Source & release", { exact: true }).click();
  const stored = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/v1/sources/flow-app-source",
  );
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  expect((await stored).ok()).toBe(true);
  await commands.getByText("Source & release", { exact: true }).click();
}

async function openSurface(page: Page, name: "Start" | "Result") {
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Flow app", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Flow app surfaces" })
    .getByRole("link", { name: new RegExp(`^${name}`, "u") })
    .click();
  await expect(page.getByRole("heading", { name, level: 2, exact: true })).toBeVisible();
}

test("authors success navigation and explicitly runs the same Source through a real local host", async ({
  page,
}) => {
  const writes: string[] = [];
  let hostCalls = 0;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/api/sign-in" && request.method() === "POST") hostCalls += 1;
    if (path === "/v1/sources/flow-app-source" && request.method() === "PUT")
      writes.push(request.postData() ?? "");
  });

  // These are normal visible product controls. Neither Source nor runtime state is injected.
  await page.goto("/");
  await page.getByRole("combobox", { name: "Local workspace" }).selectOption("reference-flow-web");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await expect(dialog.getByRole("radio", { name: /Blank Flow app project/u })).toBeChecked();
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/flow-app\/surfaces\/start$/u);

  await openSurface(page, "Result");
  await insert(page, "result", "Text", 1);
  await property(page, "Text", "Operation completed");
  await save(page);
  await openSurface(page, "Start");
  await state(page, "email");
  await state(page, "password");
  await insert(page, "start", "Text field", 1);
  await property(page, "Label", "Email");
  await connectInput(page, "email");
  await insert(page, "start", "Text field", 2);
  await property(page, "Label", "Password");
  await inspector(page).getByRole("button", { name: "Set Secure" }).click();
  await inspector(page).getByRole("switch", { name: "Secure" }).check();
  await connectInput(page, "password");
  await insert(page, "start", "Button", 3);
  await property(page, "Label", "Continue");
  const connection = inspector(page).getByRole("region", { name: "Operation connection" });
  await connection.getByRole("textbox", { name: "Operation connection result name" }).fill(ALIAS);
  await connection.getByRole("button", { name: "Connect operation", exact: true }).click();
  await expect(connection.getByRole("status")).toContainText(`operation.${ALIAS}`);
  await inspector(page).getByRole("tab", { name: "Actions", exact: true }).click();
  const success = inspector(page).getByRole("region", { name: "Success", exact: true });
  await success.getByRole("button", { name: /^Add action to/u }).click();
  await success.getByRole("combobox", { name: /^New action type/u }).selectOption("navigate");
  await success.getByRole("combobox", { name: "Destination surface" }).selectOption("result");
  await success.getByRole("button", { name: "Add action", exact: true }).click();
  await inspector(page).getByRole("tab", { name: "Inspector", exact: true }).click();

  await insert(page, "start", "Alert", 4);
  await property(page, "Text", "Please check your details.");
  await inspector(page).getByRole("combobox", { name: "Tone" }).selectOption("critical");
  const visibility = inspector(page).getByRole("region", { name: "Layer visibility" });
  await visibility
    .getByRole("combobox", { name: "Layer visibility mode" })
    .selectOption("operation");
  await visibility
    .getByRole("combobox", { name: "Visibility operation result" })
    .selectOption(ALIAS);
  await visibility
    .getByRole("combobox", { name: "Visibility operation status" })
    .selectOption("failed");
  await visibility.getByRole("button", { name: "Apply visibility" }).click();
  await save(page);
  const savedWriteCount = writes.length;
  const savedSource = writes.at(-1);
  expect(savedSource).toContain(ALIAS);

  const start = page.getByRole("group", { name: "Managed start canvas" });
  const result = page.getByRole("group", { name: "Managed result canvas" });
  const frame = page.locator("[data-canvas-frame]");
  const originalFrame = await frame.boundingBox();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const controls = page.getByRole("complementary", { name: "Run controls" });
  await expect(controls.getByRole("radio", { name: /^Synthetic/u })).toBeChecked();
  await expect(controls.getByRole("radio", { name: /^Integration/u })).toBeEnabled();
  await expect(controls.getByRole("radio", { name: /^Production/u })).toBeDisabled();
  await start.getByRole("textbox", { name: "Email" }).pressSequentially("synthetic@example.test");
  await start.getByLabel("Password").pressSequentially("synthetic-only");
  await start.getByRole("button", { name: "Continue" }).click();
  await expect(start.getByRole("button", { name: "Continue" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await controls.getByRole("button", { name: `Complete ${ALIAS} fixture` }).click();
  await expect(result.getByText("Operation completed", { exact: true })).toBeVisible();
  expect(hostCalls).toBe(0);
  expect(writes).toHaveLength(savedWriteCount);
  await expect(page).toHaveURL(/\/projects\/flow-app\/surfaces\/start$/u);
  expect(await frame.boundingBox()).toEqual(originalFrame);

  await controls.getByRole("button", { name: "Restart run" }).click();
  await expect(start).toBeVisible();
  await controls.getByRole("radio", { name: /^Integration/u }).check();
  await expect(controls.getByRole("combobox", { name: /^Next outcome/u })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: /fixture/u })).toHaveCount(0);
  await start.getByRole("textbox", { name: "Email" }).pressSequentially("designer@example.test");
  await start.getByLabel("Password").pressSequentially("wrong-test-password");
  const denied = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/sign-in" && response.request().method() === "POST",
  );
  await start.getByRole("button", { name: "Continue" }).click();
  expect((await denied).status()).toBe(401);
  await expect(start.getByRole("alert")).toHaveText("Please check your details.");
  await expect(result).toHaveCount(0);
  await expect(start.getByRole("textbox", { name: "Email" })).toHaveValue("designer@example.test");

  await start.getByLabel("Password").fill("local-demo-pass");
  const succeeded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/sign-in" && response.request().method() === "POST",
  );
  await start.getByRole("button", { name: "Continue" }).click();
  const response = await succeeded;
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ userId: "local-host-user" });
  await expect(result.getByText("Operation completed", { exact: true })).toBeVisible();
  expect(hostCalls).toBe(2);
  expect(writes).toHaveLength(savedWriteCount);
  expect(writes.at(-1)).toBe(savedSource);
  expect(savedSource).not.toContain("designer@example.test");
  expect(savedSource).not.toContain("local-demo-pass");
  expect(savedSource).not.toContain("local-host-user");
  expect(await frame.boundingBox()).toEqual(originalFrame);
  await page.screenshot({ path: test.info().outputPath("integration-destination.png") });

  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(start).toBeVisible();
  await expect(start.getByRole("textbox", { name: "Email" })).toHaveValue("");
  await expect(start.getByRole("textbox", { name: "Email" })).toBeDisabled();
  await page.reload();
  await expect(start.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(start.getByRole("textbox", { name: "Email" })).toHaveValue("");
  expect(hostCalls).toBe(2);
  expect(writes).toHaveLength(savedWriteCount);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("restored-design.png") });
});
