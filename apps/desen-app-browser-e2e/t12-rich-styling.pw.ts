import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

const TEST_TITLE =
  "authors two component-level visual presentations and ordered responsive overrides through the normal DESEN Neutral product";
const AGGREGATE_WORKSPACE_PATH = "/v1/project-workspaces/desen-neutral-workspace";
const LEGACY_SOURCE_PATH = "/v1/sources/desen-neutral-source";
const STARTER_ROOT_SELECTOR =
  "[data-managed-capability-subtree='true'] > div:not([data-desen-starter-portals])";

interface PreviewSnapshot {
  readonly backgroundColor: string;
  readonly width: string;
}

interface AggregateRequest {
  readonly method: string;
  readonly pathname: string;
}

const PROOF_ASSERTIONS = Object.freeze({
  aggregateWorkspacePersistence: true,
  desktopPreview: true,
  distinctComponentBrandPresentations: true,
  literalBrandPresentation: true,
  mobilePreview: true,
  noJsxCssJsonAuthoring: true,
  normalStarterProfile: true,
  resetInheritance: true,
  resolvedTokenBrandPresentation: true,
  responsiveOverrideOrder: true,
  tabletPreview: true,
});

function stylePanel(page: Page): Locator {
  return page.locator("[data-authoring-style='true']");
}

function starterRoot(page: Page): Locator {
  return page.locator(STARTER_ROOT_SELECTOR);
}

function starterButton(page: Page): Locator {
  return starterRoot(page).getByRole("button", { name: "Button", exact: true });
}

function layerHierarchy(page: Page): Locator {
  return page.getByRole("region", { name: "Home layer hierarchy", exact: true });
}

function starterRootLayer(page: Page): Locator {
  return layerHierarchy(page).getByRole("button", {
    name: /^(?:Select|Deselect) Stack layer · desen-neutral\.home$/u,
  });
}

function starterButtonLayer(page: Page): Locator {
  return layerHierarchy(page).getByRole("button", {
    name: /^(?:Select|Deselect) Button layer · /u,
  });
}

function rootBackgroundColorControl(page: Page): Locator {
  return stylePanel(page)
    .locator("section[data-control-kind]")
    .filter({ has: page.getByText("backgroundColor", { exact: true }) })
    .filter({ has: page.getByText("root", { exact: true }) });
}

async function previewSnapshot(component: Locator): Promise<PreviewSnapshot> {
  return component.evaluate((node) => {
    const style = getComputedStyle(node);
    return Object.freeze({ backgroundColor: style.backgroundColor, width: style.width });
  });
}

async function expectPreviewFrame(
  page: Page,
  input: Readonly<{ readonly height: string; readonly viewport: string; readonly width: string }>,
): Promise<void> {
  const frame = page.locator("[data-canvas-frame]");
  await expect(frame).toHaveAttribute("data-style-preview-viewport", input.viewport);
  await expect(frame).toHaveAttribute("data-canvas-frame-width", input.width);
  await expect(frame).toHaveAttribute("data-canvas-frame-height", input.height);
}

async function selectLayerAndOpenStyle(page: Page, selection: Locator): Promise<void> {
  await expect(selection).toHaveCount(1);
  if ((await selection.getAttribute("aria-pressed")) !== "true") await selection.click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("tab", { name: "Style", exact: true }).click();
  await expect(stylePanel(page)).toBeVisible();
}

async function selectStarterRootAndOpenStyle(page: Page): Promise<void> {
  await selectLayerAndOpenStyle(page, starterRootLayer(page));
  await expect(starterRoot(page)).toHaveCount(1);
}

async function selectStarterButtonAndOpenStyle(page: Page): Promise<void> {
  await selectLayerAndOpenStyle(page, starterButtonLayer(page));
  await expect(starterButton(page)).toHaveCount(1);
}

async function selectStyleLayer(page: Page, name: "Desktop" | "Tablet" | "Mobile"): Promise<void> {
  const panel = stylePanel(page);
  const layerSelector = panel.getByRole("radiogroup", { name: "Style layer", exact: true });
  await layerSelector.getByText(name, { exact: true }).click();
  await expect(layerSelector.getByRole("radio", { name, exact: true })).toBeChecked();
}

async function saveCurrentSource(page: Page): Promise<void> {
  await page.getByText("Source & release", { exact: true }).click();
  const persistence = page.getByRole("region", { name: "Source persistence" });
  await expect(persistence).toBeVisible();
  const save = persistence.getByRole("button", { name: "Save source", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(persistence.getByRole("status")).toContainText("Source saved successfully.");
  await expect(save).toBeDisabled();
  await page.getByText("Source & release", { exact: true }).click();
}

async function setWidth(
  page: Page,
  target: "Desktop" | "Tablet" | "Mobile",
  value: string,
): Promise<void> {
  const panel = stylePanel(page);
  await panel.getByRole("spinbutton", { name: "width value", exact: true }).fill(value);
  await panel.getByRole("button", { name: `Apply width at ${target}`, exact: true }).click();
}

async function writeBrowserProofReceipt(): Promise<void> {
  const directory = process.env.DESEN_M10A_T12_PROOF_TEMP;
  if (directory === undefined || directory.length === 0) return;
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "browser-proof.json"),
    `${JSON.stringify(
      {
        assertions: PROOF_ASSERTIONS,
        profile: "desen.m10a-t12.browser-proof.v1",
        result: "PASS",
        tests: [{ result: "PASS", title: TEST_TITLE }],
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

test(TEST_TITLE, async ({ page }) => {
  const aggregateRequests: AggregateRequest[] = [];
  const legacySourceRequests: AggregateRequest[] = [];
  const runtimeFailures: string[] = [];
  let initialMissingAggregateConsoleObserved = false;

  page.on("request", (request) => {
    let pathname: string;
    try {
      pathname = new URL(request.url()).pathname;
    } catch {
      return;
    }
    const observation = Object.freeze({ method: request.method(), pathname });
    if (pathname === AGGREGATE_WORKSPACE_PATH) aggregateRequests.push(observation);
    if (pathname === LEGACY_SOURCE_PATH) legacySourceRequests.push(observation);
  });

  await page.goto("/");
  const workspaceChooser = page.getByRole("combobox", { name: "Local workspace", exact: true });
  await expect(workspaceChooser).toBeVisible();
  await workspaceChooser.selectOption("desen-neutral-web");
  // The shell's unselected default workspace is outside this product journey. Start observing
  // runtime faults once the user has picked the asserted DESEN Neutral workspace.
  page.on("pageerror", (error) => runtimeFailures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    let pathname = "";
    try {
      pathname = new URL(message.location().url).pathname;
    } catch {
      // Preserve non-URL console errors below rather than inventing a trusted origin.
    }
    if (
      !initialMissingAggregateConsoleObserved &&
      pathname === AGGREGATE_WORKSPACE_PATH &&
      message.text().includes("404")
    ) {
      initialMissingAggregateConsoleObserved = true;
      return;
    }
    runtimeFailures.push(
      `console: ${message.text()}${message.location().url === "" ? "" : ` · ${message.location().url}`}`,
    );
  });
  await expect(page).toHaveURL(/\/projects$/u);

  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create a project", exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("radio", { name: /^Blank DESEN Neutral project\b/u }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/desen-neutral\/surfaces\/home$/u);

  await selectStarterRootAndOpenStyle(page);
  const panel = stylePanel(page);
  await expect(panel.locator("textarea")).toHaveCount(0);
  await expect(panel.getByRole("textbox", { name: /(?:CSS|JSX|JSON)/u })).toHaveCount(0);
  await expectPreviewFrame(page, { height: "900", viewport: "desktop", width: "1440" });

  await panel.getByRole("textbox", { name: "backgroundColor hex", exact: true }).fill("#0b1f3a");
  await panel
    .getByRole("button", { name: "Apply backgroundColor at Desktop", exact: true })
    .click();
  await expect
    .poll(() => previewSnapshot(starterRoot(page)))
    .toMatchObject({
      backgroundColor: "rgb(11, 31, 58)",
    });
  await saveCurrentSource(page);

  await page.reload();
  await expect(page).toHaveURL(/\/projects\/desen-neutral\/surfaces\/home$/u);
  await selectStarterRootAndOpenStyle(page);
  await expect
    .poll(() => previewSnapshot(starterRoot(page)))
    .toMatchObject({
      backgroundColor: "rgb(11, 31, 58)",
    });

  const insertButton = page.getByRole("button", {
    name: /^Insert Button into Stack desen-neutral\.home default slot at position \d+$/u,
  });
  await expect(insertButton).toBeEnabled();
  await insertButton.click();
  await expect(starterButtonLayer(page)).toHaveAttribute("aria-pressed", "true");
  await selectStarterButtonAndOpenStyle(page);

  const rootBackgroundColor = rootBackgroundColorControl(page);
  await expect(rootBackgroundColor).toHaveCount(1);
  const colorToken = rootBackgroundColor.getByRole("combobox", {
    name: "backgroundColor design token for Desktop",
    exact: true,
  });
  await expect(colorToken.locator("option[value='color.action']")).toHaveCount(1);
  await colorToken.selectOption("color.action");
  await expect
    .poll(() => previewSnapshot(starterButton(page)))
    .toMatchObject({
      backgroundColor: "rgb(23, 23, 23)",
    });
  await expect
    .poll(() => previewSnapshot(starterRoot(page)))
    .toMatchObject({
      backgroundColor: "rgb(11, 31, 58)",
    });
  await saveCurrentSource(page);

  await selectStarterRootAndOpenStyle(page);
  await setWidth(page, "Desktop", "960");
  await expect.poll(() => previewSnapshot(starterRoot(page))).toMatchObject({ width: "960px" });
  await expectPreviewFrame(page, { height: "900", viewport: "desktop", width: "1440" });

  await selectStyleLayer(page, "Mobile");
  await expectPreviewFrame(page, { height: "844", viewport: "mobile", width: "390" });
  await setWidth(page, "Mobile", "320");
  await expect.poll(() => previewSnapshot(starterRoot(page))).toMatchObject({ width: "320px" });

  await selectStyleLayer(page, "Tablet");
  await expectPreviewFrame(page, { height: "768", viewport: "tablet", width: "1024" });
  await setWidth(page, "Tablet", "700");
  await expect.poll(() => previewSnapshot(starterRoot(page))).toMatchObject({ width: "700px" });

  await selectStyleLayer(page, "Mobile");
  await expectPreviewFrame(page, { height: "844", viewport: "mobile", width: "390" });
  await expect.poll(() => previewSnapshot(starterRoot(page))).toMatchObject({ width: "320px" });
  await panel.getByRole("button", { name: "Reset width at Mobile", exact: true }).click();
  await expect(panel.getByLabel("width layer provenance", { exact: true })).toContainText(
    "Inherits current cascade",
  );
  await expect.poll(() => previewSnapshot(starterRoot(page))).toMatchObject({ width: "700px" });

  await selectStyleLayer(page, "Desktop");
  await expectPreviewFrame(page, { height: "900", viewport: "desktop", width: "1440" });
  await expect.poll(() => previewSnapshot(starterRoot(page))).toMatchObject({ width: "960px" });
  await saveCurrentSource(page);

  await expect
    .poll(() => aggregateRequests.filter(({ method }) => method === "GET").length)
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(() => aggregateRequests.filter(({ method }) => method === "PUT").length)
    .toBeGreaterThanOrEqual(4);
  expect(legacySourceRequests).toEqual([]);

  await page.reload();
  await expect(page).toHaveURL(/\/projects\/desen-neutral\/surfaces\/home$/u);
  await selectStarterRootAndOpenStyle(page);
  await expect
    .poll(() => previewSnapshot(starterRoot(page)))
    .toMatchObject({
      backgroundColor: "rgb(11, 31, 58)",
      width: "960px",
    });
  await selectStarterButtonAndOpenStyle(page);
  await expect
    .poll(() => previewSnapshot(starterButton(page)))
    .toMatchObject({
      backgroundColor: "rgb(23, 23, 23)",
    });
  await expect
    .poll(() => previewSnapshot(starterRoot(page)))
    .toMatchObject({
      backgroundColor: "rgb(11, 31, 58)",
    });
  await selectStarterRootAndOpenStyle(page);
  await selectStyleLayer(page, "Mobile");
  await expect.poll(() => previewSnapshot(starterRoot(page))).toMatchObject({ width: "700px" });
  await expect(panel.getByLabel("width layer provenance", { exact: true })).toContainText(
    "Inherits current cascade",
  );

  expect(runtimeFailures).toEqual([]);
  await writeBrowserProofReceipt();
});
