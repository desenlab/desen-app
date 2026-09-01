import { expect, test } from "@playwright/test";

import { createDesenEditorDocument } from "@desen/editor-core";

import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../desen-app/src/reference-empty-project.js";

import type { Locator, Page } from "@playwright/test";

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} to be an object.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`Expected ${label} to be an array.`);
  return value;
}

function componentCard(page: Page, displayName: string): Locator {
  return page.getByRole("group", {
    name: new RegExp(
      `^${displayName} component · drag to Stack sign-in\\.layout default slot`,
      "u",
    ),
  });
}

function componentDragHandle(page: Page, displayName: string): Locator {
  return componentCard(page, displayName).locator("[data-component-drag-handle='true']");
}

function placementTarget(page: Page): Locator {
  return page.getByRole("group", {
    name: /^Placement target · Stack sign-in\.layout default slot/u,
  });
}

async function addLocalState(page: Page, name: string): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const state = inspector.getByRole("region", { name: "Local state" });
  await state.getByRole("textbox", { name: "New state name" }).fill(name);
  await state.getByRole("button", { name: "Add" }).click();
  await expect(state.getByRole("heading", { level: 3, name })).toBeVisible();
}

async function setTextProperty(page: Page, name: string, value: string): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("textbox", { name }).fill(value);
  await inspector.getByRole("button", { name: `Apply ${name}` }).click();
  await expect(inspector.getByRole("status")).toContainText(`Updated ${name}.`);
}

async function bindPropertyToState(
  page: Page,
  propertyName: string,
  stateName: string,
): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector
    .getByRole("combobox", { name: `${propertyName} value source` })
    .selectOption(stateName);
  await expect(inspector.getByRole("status")).toContainText(
    `Bound ${propertyName} to state.${stateName}.`,
  );
}

async function restoreLocalProperty(page: Page, propertyName: string): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector
    .getByRole("combobox", { name: `${propertyName} value source` })
    .selectOption("__local__");
  await expect(inspector.getByRole("status")).toContainText(
    `Restored ${propertyName} to the bound state's initial value.`,
  );
}

async function addChangeStateAction(page: Page, stateName: string): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("tab", { name: "Actions" }).click();
  const actions = inspector.getByRole("region", { name: "Events & Actions" });
  await actions.getByRole("button", { name: "Add change event handler" }).click();
  await actions.getByRole("button", { name: "Add action to change" }).click();
  await actions.getByRole("combobox", { name: "State to update" }).selectOption(stateName);
  await expect(actions.getByRole("combobox", { name: "Value comes from" })).toHaveValue("event");
  await expect(actions.getByRole("combobox", { name: "Event field" })).toHaveValue("value");
  await actions.getByRole("button", { name: "Add action" }).click();
  await expect(actions.getByRole("article", { name: "action 1 in change" })).toBeVisible();
  await inspector.getByRole("tab", { name: "Inspector" }).click();
}

async function connectInput(page: Page, stateName: string): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const connection = inspector.getByRole("region", { name: "Input connection" });
  await connection
    .getByRole("combobox", { name: "Input connection state" })
    .selectOption(stateName);
  await connection.getByRole("button", { name: /^(?:Connect input|Repair connection)$/u }).click();
  await expect(connection.getByRole("status")).toContainText(
    `Connected Value and change to state.${stateName}.`,
  );
}

async function addOperationAction(page: Page): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("tab", { name: "Actions" }).click();
  const actions = inspector.getByRole("region", { name: "Events & Actions" });
  await actions.getByRole("button", { name: "Add press event handler" }).click();
  await actions.getByRole("button", { name: "Add action to press" }).click();
  await actions
    .getByRole("combobox", { name: "New action type for press" })
    .selectOption("operation.invoke");
  await expect(actions.getByRole("combobox", { name: "Catalog operation" })).toHaveValue(
    "com.example.auth/signIn",
  );
  await expect(actions.getByRole("textbox", { name: "Result name" })).toHaveValue("signIn");
  await expect(actions.getByRole("combobox", { name: /email/u })).toHaveValue("email");
  await expect(actions.getByRole("combobox", { name: /password/u })).toHaveValue("password");
  await actions.getByRole("button", { name: "Add action" }).click();
  await expect(actions.getByRole("article", { name: "action 1 in press" })).toBeVisible();
  await inspector.getByRole("tab", { name: "Inspector" }).click();
}

async function showOnOperationFailure(page: Page): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const visibility = inspector.getByRole("region", { name: "Layer visibility" });
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

test("authors and saves a valid sign-in Source from the empty project in a real browser", async ({
  page,
}) => {
  const runtimeFailures: string[] = [];
  page.on("pageerror", (error) => runtimeFailures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeFailures.push(`console: ${message.text()}`);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Sign-in" })).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);

  const hierarchy = page.getByRole("region", { name: "Sign-in layer hierarchy" });
  await expect(hierarchy.getByText("sign-in.layout", { exact: true })).toBeVisible();
  await expect(hierarchy.locator("[data-layer-source-node-id]")).toHaveCount(1);
  await expect(
    hierarchy.getByRole("button", {
      name: /Choose Stack sign-in\.layout default slot · Optional · Absent · 0 items/u,
    }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Managed sign-in canvas" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Sign in" })).toHaveCount(0);
  await expect(page.getByText("web-react", { exact: true })).toBeVisible();
  await expect(page.getByText("run.desen.reference.sign-in", { exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Authoring status" })).toContainText(
    "Placement target · Stack sign-in.layout · default slot.",
  );

  await page.getByText("Source & release", { exact: true }).click();
  const persistence = page.getByRole("region", { name: "Source persistence" });
  const saveSource = persistence.getByRole("button", { name: "Save source" });
  await saveSource.click();
  await expect(persistence.getByRole("status")).toContainText(
    "Source saved successfully. Generation 1.",
  );
  const emptySavedDocument = await page.evaluate(() =>
    window.__DESEN_BROWSER_PROOF__.readSavedDocument(),
  );
  expect(emptySavedDocument).toEqual(EMPTY_REFERENCE_PROJECT_DOCUMENT);
  expect(await page.evaluate(() => window.__DESEN_BROWSER_PROOF__.readSaveCount())).toBe(1);
  await expect(saveSource).toBeDisabled();

  await placementTarget(page).evaluate((target) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "forged component authority");
    for (const type of ["dragenter", "dragover", "drop"]) {
      target.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    }
  });
  await expect(hierarchy.locator("[data-layer-source-node-id]")).toHaveCount(1);
  await expect(saveSource).toBeDisabled();
  expect(await page.evaluate(() => window.__DESEN_BROWSER_PROOF__.readSavedDocument())).toEqual(
    emptySavedDocument,
  );
  expect(await page.evaluate(() => window.__DESEN_BROWSER_PROOF__.readSaveCount())).toBe(1);
  await page.getByText("Source & release", { exact: true }).click();

  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("tab", { name: "State" }).click();
  await addLocalState(page, "email");
  await addLocalState(page, "password");
  await inspector.getByRole("tab", { name: "Inspector" }).click();

  await componentDragHandle(page, "Text").dragTo(placementTarget(page));
  await expect(
    hierarchy.getByRole("button", { name: "Deselect Text layer · node.text" }),
  ).toBeVisible();
  await setTextProperty(page, "Text", "Sign in");
  await inspector.getByRole("combobox", { name: "Role" }).selectOption({ label: "heading" });
  await expect(page.getByRole("heading", { level: 2, name: "Sign in" })).toBeVisible();

  await page
    .getByRole("button", {
      name: /Insert Text field into Stack sign-in\.layout default slot at position 2/u,
    })
    .click();
  await expect(
    hierarchy.getByRole("button", {
      name: "Deselect Text field layer · node.textfield",
    }),
  ).toBeVisible();
  await setTextProperty(page, "Label", "Email");
  await bindPropertyToState(page, "Placeholder", "email");
  await addChangeStateAction(page, "email");

  await page.getByRole("button", { name: "Run" }).click();
  const incorrectlyBoundEmail = page
    .getByRole("group", { name: "Managed sign-in canvas" })
    .getByRole("textbox", { name: "Email" });
  await incorrectlyBoundEmail.press("a");
  await expect(incorrectlyBoundEmail).toHaveValue("");
  await expect(incorrectlyBoundEmail).toHaveAttribute("placeholder", "a");
  await incorrectlyBoundEmail.press("b");
  await expect(incorrectlyBoundEmail).toHaveValue("");
  await expect(incorrectlyBoundEmail).toHaveAttribute("placeholder", "b");
  await page.getByRole("button", { name: "Design" }).click();

  await restoreLocalProperty(page, "Placeholder");
  await connectInput(page, "email");

  await page
    .getByRole("button", {
      name: /Insert Button into Stack sign-in\.layout default slot at position 3/u,
    })
    .click();
  await setTextProperty(page, "Label", "Sign in");
  await addOperationAction(page);

  await page
    .getByRole("button", {
      name: /Insert Text field into Stack sign-in\.layout default slot at position 4/u,
    })
    .click();
  await expect(
    hierarchy.getByRole("button", {
      name: "Deselect Text field layer · node.textfield-2",
    }),
  ).toBeVisible();
  await setTextProperty(page, "Label", "Password");
  await inspector.getByRole("button", { name: "Set Secure" }).click();
  await inspector.getByRole("switch", { name: "Secure" }).check();
  await connectInput(page, "password");

  const passwordDragHandle = page.locator(
    '[data-layer-drop-row-node-id="node.textfield-2"] [data-layer-drag-handle="true"]',
  );
  const positionThree = hierarchy.getByRole("listitem", {
    name: "Stack sign-in.layout default slot insertion boundary at position 3",
  });
  await passwordDragHandle.dragTo(positionThree);
  await expect
    .poll(async () =>
      hierarchy
        .locator("[data-layer-source-node-id]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-layer-source-node-id")),
        ),
    )
    .toEqual(["sign-in.layout", "node.text", "node.textfield", "node.textfield-2", "node.button"]);

  await page
    .getByRole("button", {
      name: /Insert Alert into Stack sign-in\.layout default slot at position 5/u,
    })
    .click();
  await expect(
    hierarchy.getByRole("button", { name: "Deselect Alert layer · node.alert" }),
  ).toBeVisible();
  await setTextProperty(page, "Text", "Unable to sign in. Check your details and try again.");
  await inspector.getByRole("combobox", { name: "Tone" }).selectOption("critical");
  await showOnOperationFailure(page);

  const frame = page.locator("[data-canvas-frame='portrait']");
  const managedSubtree = page.locator("[data-managed-capability-subtree='true']");
  await expect(frame).toHaveAttribute("data-canvas-frame-width", "420");
  await expect(frame).toHaveAttribute("data-canvas-frame-height", "720");
  const designManagedHtml = await managedSubtree.evaluate((node) => node.innerHTML);
  await page.getByRole("button", { name: "Run" }).click();
  const runCanvas = page.getByRole("group", { name: "Managed sign-in canvas" });
  await expect(runCanvas.getByRole("heading", { level: 2, name: "Sign in" })).toBeVisible();
  await expect(runCanvas.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(runCanvas.getByLabel("Password")).toBeVisible();
  await expect(runCanvas.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(runCanvas.getByRole("alert")).toHaveCount(0);
  await expect
    .poll(() => managedSubtree.evaluate((node) => node.innerHTML))
    .toBe(designManagedHtml);
  await expect(frame).toHaveAttribute("data-canvas-frame-width", "420");
  await expect(frame).toHaveAttribute("data-canvas-frame-height", "720");
  const runEmail = runCanvas.getByRole("textbox", { name: "Email" });
  const runPassword = runCanvas.getByLabel("Password");
  await runEmail.pressSequentially("designer@example.test");
  await expect(runEmail).toHaveValue("designer@example.test");
  await runPassword.pressSequentially("correct horse battery staple");
  await expect(runPassword).toHaveValue("correct horse battery staple");
  const runControls = page.getByRole("complementary", { name: "Run controls" });
  const outcomeControl = runControls
    .getByRole("combobox", { name: "Next outcome for signIn" })
    .locator("..");
  const completeFixture = runControls.getByRole("button", {
    name: "Complete signIn fixture",
  });
  await expect(outcomeControl).toHaveCSS("display", "grid");
  await expect(completeFixture).toHaveCSS("border-radius", "8px");
  await runControls
    .getByRole("combobox", { name: "Next outcome for signIn" })
    .selectOption("error:invalidCredentials");
  await runCanvas.getByRole("button", { name: "Sign in" }).click();
  await expect(runControls.getByRole("status")).toContainText("Pending");
  await completeFixture.click();
  await expect(runCanvas.getByRole("alert")).toContainText(
    "Unable to sign in. Check your details and try again.",
  );
  await page.getByRole("button", { name: "Design" }).click();

  await page.getByText("Source & release", { exact: true }).click();
  await saveSource.click();
  await expect(persistence.getByRole("status")).toContainText(
    "Source saved successfully. Generation 2.",
  );

  const savedDocument = await page.evaluate(() =>
    window.__DESEN_BROWSER_PROOF__.readSavedDocument(),
  );
  expect(await page.evaluate(() => window.__DESEN_BROWSER_PROOF__.readSaveCount())).toBe(2);
  const admitted = createDesenEditorDocument(savedDocument);
  expect(admitted.ok).toBe(true);
  if (!admitted.ok) throw new TypeError("Expected the browser-authored Source to be valid.");

  const signIn = record(record(admitted.document.surfaces, "surfaces")["sign-in"], "sign-in");
  const state = record(signIn.state, "sign-in state");
  expect(Object.keys(state).sort()).toEqual(["email", "password"]);
  const root = record(signIn.root, "sign-in root");
  const children = array(record(root.slots, "root slots").default, "default slot").map((node) =>
    record(node, "child node"),
  );
  expect(children.map((node) => node.use)).toEqual([
    "com.example.ui/Text",
    "com.example.ui/TextField",
    "com.example.ui/TextField",
    "com.example.ui/Button",
    "com.example.ui/Alert",
  ]);
  expect(children.map((node) => node.id)).toEqual([
    "node.text",
    "node.textfield",
    "node.textfield-2",
    "node.button",
    "node.alert",
  ]);
  expect(record(children[0]?.props, "title props")).toMatchObject({
    role: "heading",
    text: "Sign in",
  });
  expect(record(children[1]?.props, "email props")).toMatchObject({
    label: "Email",
    value: { $ref: "state.email" },
  });
  expect(record(children[2]?.props, "password props")).toMatchObject({
    label: "Password",
    secure: true,
    value: { $ref: "state.password" },
  });
  expect(record(children[3]?.props, "button props")).toMatchObject({ label: "Sign in" });
  expect(record(children[4]?.props, "alert props")).toMatchObject({
    text: "Unable to sign in. Check your details and try again.",
    tone: "critical",
  });
  expect(children[4]?.when).toEqual({
    op: "eq",
    args: [{ $ref: "operation.signIn.status" }, "failed"],
  });
  expect(record(children[1]?.on, "email events").change).toEqual([
    { type: "state.set", path: "email", value: { $ref: "event.value" } },
  ]);
  expect(record(children[2]?.on, "password events").change).toEqual([
    { type: "state.set", path: "password", value: { $ref: "event.value" } },
  ]);
  expect(record(children[3]?.on, "button events").press).toEqual([
    {
      type: "operation.invoke",
      operation: "com.example.auth/signIn",
      as: "signIn",
      input: {
        email: { $ref: "state.email" },
        password: { $ref: "state.password" },
      },
      concurrency: "reject",
    },
  ]);
  expect(runtimeFailures).toEqual([]);
});
