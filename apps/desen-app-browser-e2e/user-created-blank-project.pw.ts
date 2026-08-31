import { expect, test } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

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

function sourcePersistence(page: Page): Locator {
  return page.getByRole("region", { name: "Source persistence" });
}

async function openSourceControls(page: Page): Promise<void> {
  await page.getByText("Source & release", { exact: true }).click();
  await expect(sourcePersistence(page)).toBeVisible();
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

async function bindValueToState(page: Page, stateName: string): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("combobox", { name: "Value value source" }).selectOption(stateName);
  await expect(inspector.getByRole("status")).toContainText(`Bound Value to state.${stateName}.`);
}

async function addChangeStateAction(page: Page, stateName: string): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("tab", { name: "Actions" }).click();
  const actions = inspector.getByRole("region", { name: "Events & Actions" });
  await actions.getByRole("button", { name: "Add change event handler" }).click();
  await actions.getByRole("button", { name: "Add action to change" }).click();
  await actions.getByRole("textbox", { name: "New action JSON for change" }).fill(
    JSON.stringify({
      type: "state.set",
      path: stateName,
      value: { $ref: "event.value" },
    }),
  );
  await actions.getByRole("button", { name: "Add complete action" }).click();
  await expect(actions.getByRole("article", { name: "action 1 in change" })).toBeVisible();
  await inspector.getByRole("tab", { name: "Inspector" }).click();
}

async function readEditorViewportSnapshot(page: Page) {
  return page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('[data-surface-editor="true"]');
    const commandBar = document.querySelector<HTMLElement>('[aria-label="Workspace commands"]');
    const authoring = document.querySelector<HTMLElement>('[data-authoring-layout="split"]');
    const canvas = document.querySelector<HTMLElement>('[data-canvas-workspace="true"]');
    const inspector = document.querySelector<HTMLElement>('[data-authoring-inspector="true"]');
    const frame = document.querySelector<HTMLElement>("[data-canvas-frame]");
    if (
      editor === null ||
      commandBar === null ||
      authoring === null ||
      canvas === null ||
      inspector === null ||
      frame === null
    ) {
      throw new Error("Expected the complete surface editor geometry.");
    }

    const verticalBounds = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return Object.freeze({ bottom: bounds.bottom, top: bounds.top });
    };

    return Object.freeze({
      authoring: verticalBounds(authoring),
      canvas: verticalBounds(canvas),
      commandBar: verticalBounds(commandBar),
      documentScrollTop: document.scrollingElement?.scrollTop ?? 0,
      editorClientHeight: editor.clientHeight,
      editorScrollHeight: editor.scrollHeight,
      editorScrollTop: editor.scrollTop,
      frame: verticalBounds(frame),
      inspector: verticalBounds(inspector),
      windowScrollY: window.scrollY,
    });
  });
}

async function layerIds(page: Page): Promise<(string | null)[]> {
  return page
    .getByRole("region", { name: "Sign-in layer hierarchy" })
    .locator("[data-layer-source-node-id]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-layer-source-node-id")));
}

async function expectAuthoredLayerOrder(page: Page): Promise<void> {
  await expect
    .poll(() => layerIds(page))
    .toEqual(["sign-in.layout", "node.text", "node.textfield", "node.textfield-2", "node.button"]);
}

async function expectAuthoredStateBindingsAndActions(page: Page): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("tab", { name: "State" }).click();
  const state = inspector.getByRole("region", { name: "Local state" });
  await expect(state.getByRole("heading", { level: 3, name: "email" })).toBeVisible();
  await expect(state.getByRole("heading", { level: 3, name: "password" })).toBeVisible();
  await inspector.getByRole("tab", { name: "Inspector" }).click();

  const hierarchy = page.getByRole("region", { name: "Sign-in layer hierarchy" });
  await hierarchy
    .getByRole("button", { name: "Select Text field layer · node.textfield", exact: true })
    .click();
  await expect(inspector.getByRole("combobox", { name: "Value value source" })).toHaveValue(
    "email",
  );
  await inspector.getByRole("tab", { name: "Actions" }).click();
  const emailAction = inspector.getByRole("article", { name: "action 1 in change" });
  await expect(emailAction).toContainText("Set state");
  await expect(emailAction).toContainText("email");
  await inspector.getByRole("tab", { name: "Inspector" }).click();

  await hierarchy
    .getByRole("button", { name: "Select Text field layer · node.textfield-2", exact: true })
    .click();
  await expect(inspector.getByRole("combobox", { name: "Value value source" })).toHaveValue(
    "password",
  );
  await expect(inspector.getByRole("switch", { name: "Secure" })).toBeChecked();
  await inspector.getByRole("tab", { name: "Actions" }).click();
  const passwordAction = inspector.getByRole("article", { name: "action 1 in change" });
  await expect(passwordAction).toContainText("Set state");
  await expect(passwordAction).toContainText("password");
  await inspector.getByRole("tab", { name: "Inspector" }).click();
}

test("creates, authors, persists, reloads, and reopens a blank sign-in project through the normal product UI", async ({
  page,
}) => {
  const runtimeFailures: string[] = [];
  let initialMissingSourceObserved = false;
  page.on("pageerror", (error) => runtimeFailures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      let pathname = "";
      try {
        pathname = new URL(location.url).pathname;
      } catch {
        // The complete console failure is retained below when its location is not one valid URL.
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
    }
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/projects$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "All projects" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "0 projects" })).toBeVisible();
  expect(initialMissingSourceObserved).toBe(true);

  const newProject = page.getByRole("button", { name: "New project" });
  await expect(newProject).toBeEnabled();
  await newProject.click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Blank sign-in project/u })).toBeChecked();
  await expect(dialog).toContainText("one empty Stack · 420 × 720 portrait frame");
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);
  await expect(page.getByRole("heading", { level: 2, name: "Sign-in" })).toBeVisible();
  const hierarchy = page.getByRole("region", { name: "Sign-in layer hierarchy" });
  await expect(hierarchy.locator("[data-layer-source-node-id]")).toHaveCount(1);
  await expect(hierarchy.getByText("sign-in.layout", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Sign in" })).toHaveCount(0);
  await openSourceControls(page);
  const persistence = sourcePersistence(page);
  await expect(persistence.getByRole("status")).toContainText(
    "Source saved successfully. Generation 1.",
  );
  await expect(persistence.getByRole("button", { name: "Save source" })).toBeDisabled();
  await page.getByText("Source & release", { exact: true }).click();

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
  await setTextProperty(page, "Label", "Email");
  await bindValueToState(page, "email");
  await addChangeStateAction(page, "email");

  await page
    .getByRole("button", {
      name: /Insert Button into Stack sign-in\.layout default slot at position 3/u,
    })
    .click();
  await setTextProperty(page, "Label", "Sign in");

  await page
    .getByRole("button", {
      name: /Insert Text field into Stack sign-in\.layout default slot at position 4/u,
    })
    .click();
  await setTextProperty(page, "Label", "Password");
  await page.setViewportSize({ height: 840, width: 1_600 });
  const anchoredViewport = await readEditorViewportSnapshot(page);
  expect(anchoredViewport.windowScrollY).toBe(0);
  expect(anchoredViewport.documentScrollTop).toBe(0);
  expect(anchoredViewport.editorScrollTop).toBe(0);
  expect(anchoredViewport.editorScrollHeight).toBe(anchoredViewport.editorClientHeight);

  await inspector.getByRole("button", { name: "Set Secure" }).click();
  const secure = inspector.getByRole("switch", { name: "Secure" });
  await expect(secure).toBeFocused();
  await expect.poll(() => readEditorViewportSnapshot(page)).toEqual(anchoredViewport);

  await secure.check();
  await expect.poll(() => readEditorViewportSnapshot(page)).toEqual(anchoredViewport);
  await page.setViewportSize({ height: 1_000, width: 1_600 });
  await bindValueToState(page, "password");
  await addChangeStateAction(page, "password");

  const passwordDragHandle = page.locator(
    '[data-layer-drop-row-node-id="node.textfield-2"] [data-layer-drag-handle="true"]',
  );
  const positionThree = hierarchy.getByRole("listitem", {
    name: "Stack sign-in.layout default slot insertion boundary at position 3",
  });
  await passwordDragHandle.dragTo(positionThree);
  await expectAuthoredLayerOrder(page);

  await page
    .getByRole("button", {
      name: /Insert Alert into Stack sign-in\.layout default slot at position 5/u,
    })
    .click();
  await page
    .getByRole("complementary", { name: "Authoring panel" })
    .getByRole("button", { name: "Delete Alert layer · node.alert" })
    .click();
  await expect(hierarchy.getByText("node.alert", { exact: true })).toHaveCount(0);

  const frame = page.locator("[data-canvas-frame='portrait']");
  const managedSubtree = page.locator("[data-managed-capability-subtree='true']");
  await expect(frame).toHaveAttribute("data-canvas-frame-width", "420");
  await expect(frame).toHaveAttribute("data-canvas-frame-height", "720");
  const designManagedHtml = await managedSubtree.evaluate((node) => node.innerHTML);
  await page.getByRole("button", { name: "Run" }).click();
  const runCanvas = page.getByRole("group", { name: "Sign-in adapter canvas" });
  await expect(runCanvas.getByRole("heading", { level: 2, name: "Sign in" })).toBeVisible();
  await expect(runCanvas.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(runCanvas.getByLabel("Password")).toBeVisible();
  await expect(runCanvas.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect
    .poll(() => managedSubtree.evaluate((node) => node.innerHTML))
    .toBe(designManagedHtml);
  await page.getByRole("button", { name: "Design" }).click();

  await openSourceControls(page);
  const saveSource = persistence.getByRole("button", { name: "Save source" });
  await saveSource.click();
  await expect(persistence.getByRole("status")).toContainText(
    "Source saved successfully. Generation 2.",
  );
  await expect(saveSource).toBeDisabled();

  await page.reload();
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);
  await expect(page.getByRole("heading", { level: 2, name: "Sign in" })).toBeVisible();
  await expectAuthoredLayerOrder(page);
  await expectAuthoredStateBindingsAndActions(page);
  await openSourceControls(page);
  await expect(sourcePersistence(page).getByRole("status")).toContainText("Generation 2.");
  await page.getByText("Source & release", { exact: true }).click();

  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/projects$/u);
  await expect(page.getByRole("heading", { level: 3, name: "Account app" })).toBeVisible();
  await page.getByRole("link", { name: "Open project" }).click();
  await expect(page).toHaveURL(/\/projects\/account-app$/u);
  const surfaces = page.getByRole("navigation", { name: "Account app surfaces" });
  await surfaces.getByRole("link", { name: /Sign-in/u }).click();
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);
  await expect(page.getByRole("heading", { level: 2, name: "Sign in" })).toBeVisible();
  await expectAuthoredLayerOrder(page);
  await expectAuthoredStateBindingsAndActions(page);
  expect(runtimeFailures).toEqual([]);
});
