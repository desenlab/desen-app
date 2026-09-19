import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createDesenEditorDocument } from "@desen/editor-core";
import { expect, test } from "@playwright/test";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { Locator, Page } from "@playwright/test";

// A read-only projection of real HTTP observations, not App schema or admission authority.
// The complete original response object is retained for fingerprints and reopen equality.
interface ProjectRecord {
  readonly schemaVersion: number;
  readonly source: DesenEditorDocument;
  readonly designSystem: {
    readonly recipeGraph: {
      readonly definitions: readonly unknown[];
      readonly instances: readonly {
        readonly id: string;
        readonly rootId: string;
        readonly mapping: unknown;
        readonly overrides: readonly unknown[];
        readonly definitionDigest: string;
        readonly materializedDigest: string;
      }[];
    };
  };
}

interface ObservedWorkspace {
  readonly kind: string;
  readonly schemaVersion: number;
  readonly projects: readonly { readonly record: ProjectRecord }[];
}

const TEST_TITLE =
  "visually edits a master in normal Desen App, preserving linked overrides, detached Source, atomic history and complete reopen";
const WORKSPACE_PATH = "/v1/project-workspaces/desen-neutral-workspace";
const LEGACY_PATH = "/v1/sources/desen-neutral-source";
const LOCAL_TEXT = "This instance stays local";
const MASTER_TEXT = "The updated reusable title";
const MASTER_COLOR = "rgb(18, 52, 86)";

function hierarchy(page: Page): Locator {
  return page.getByRole("region", { name: "Home layer hierarchy", exact: true });
}

function textLayers(page: Page): Locator {
  return hierarchy(page).getByRole("button", { name: /^(?:Select|Deselect) Text layer · /u });
}

function preview(page: Page): Locator {
  return page.locator("[data-managed-capability-subtree='true']");
}

async function selectLayer(layer: Locator): Promise<void> {
  if ((await layer.getAttribute("aria-pressed")) !== "true") await layer.click();
  await expect(layer).toHaveAttribute("aria-pressed", "true");
}

async function editText(page: Page, value: string): Promise<void> {
  await page.getByRole("textbox", { name: "Text", exact: true }).fill(value);
  await page.getByRole("button", { name: "Apply Text", exact: true }).click();
}

async function myComponents(page: Page): Promise<void> {
  const summary = page.locator("summary").filter({ hasText: /^My components/u });
  if (!(await summary.locator("..").evaluate((element) => element.hasAttribute("open"))))
    await summary.click();
}

async function persistence(page: Page): Promise<Locator> {
  const region = page.getByRole("region", { name: "Project persistence", exact: true });
  if (!(await region.isVisible()))
    await page.getByText("Source & release", { exact: true }).click();
  return region;
}

function observedProject(workspace: ObservedWorkspace): ProjectRecord {
  expect(workspace.kind).toBe("desen.app.project-workspace");
  expect(workspace.schemaVersion).toBe(1);
  expect(workspace.projects).toHaveLength(1);
  const record = workspace.projects[0]?.record;
  if (record === undefined) throw new Error("The actual workspace has no project.");
  expect(record.schemaVersion).toBe(2);
  // This observation is not an App admission shortcut: the browser must also reopen and render it.
  expect(createDesenEditorDocument(record.source).ok).toBe(true);
  return record;
}

async function saveProject(page: Page): Promise<ProjectRecord> {
  const region = await persistence(page);
  const save = region.getByRole("button", { name: "Save project", exact: true });
  await expect(save).toBeEnabled();
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === WORKSPACE_PATH &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  await save.click();
  const response = await responsePromise;
  const record = observedProject(response.request().postDataJSON() as ObservedWorkspace);
  await expect(region.getByRole("status")).toContainText("Project saved successfully.");
  await expect(save).toBeDisabled();
  await page.getByText("Source & release", { exact: true }).click();
  return record;
}

async function textColor(page: Page, text: string): Promise<string> {
  return preview(page)
    .getByText(text, { exact: true })
    .evaluate((node) => getComputedStyle(node).color);
}

async function expectUpdatedPreview(page: Page): Promise<void> {
  await expect(preview(page).getByText(LOCAL_TEXT, { exact: true })).toBeVisible();
  await expect(preview(page).getByText(MASTER_TEXT, { exact: true })).toBeVisible();
  await expect(preview(page).getByText("Text", { exact: true })).toBeVisible();
  await expect.poll(() => textColor(page, LOCAL_TEXT)).toBe(MASTER_COLOR);
  await expect.poll(() => textColor(page, MASTER_TEXT)).toBe(MASTER_COLOR);
  expect(await textColor(page, "Text")).not.toBe(MASTER_COLOR);
}

function sourceNode(record: ProjectRecord, id: string) {
  const node = record.source.surfaces.home?.root.slots?.default?.find((child) => child.id === id);
  if (node === undefined) throw new Error("Missing observed Source child.");
  return node;
}

function fingerprint(record: ProjectRecord): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

test(TEST_TITLE, async ({ page }, testInfo) => {
  const workspaceMethods: string[] = [];
  const legacyMethods: string[] = [];
  const failures: string[] = [];
  let missingWorkspaceObserved = false;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === WORKSPACE_PATH) workspaceMethods.push(request.method());
    if (pathname === LEGACY_PATH) legacyMethods.push(request.method());
  });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Local workspace", exact: true })
    .selectOption("desen-neutral-web");
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    if (
      !missingWorkspaceObserved &&
      URL.canParse(location) &&
      new URL(location).pathname === WORKSPACE_PATH &&
      message.text().includes("404")
    ) {
      missingWorkspaceObserved = true;
      return;
    }
    failures.push(`console: ${message.text()}`);
  });
  await expect(page).toHaveURL(/\/projects$/u);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create a project", exact: true });
  await expect(
    dialog.getByRole("radio", { name: /^Blank DESEN Neutral project\b/u }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/desen-neutral\/surfaces\/home$/u);

  await selectLayer(
    hierarchy(page).getByRole("button", {
      name: /^(?:Select|Deselect) Stack layer · desen-neutral\.home$/u,
    }),
  );
  await page
    .getByRole("searchbox", { name: "Search catalog components", exact: true })
    .fill("Text");
  await page
    .getByRole("button", {
      name: /^Insert Text into Stack desen-neutral\.home default slot at position \d+$/u,
    })
    .click();
  // A valid Stack starts with one placeholder child. Remove it only after inserting a replacement.
  await expect(textLayers(page)).toHaveCount(2);
  await selectLayer(textLayers(page).nth(0));
  await page
    .getByRole("button", { name: "Delete Text layer · desen-neutral.home.content", exact: true })
    .click();
  await expect(textLayers(page)).toHaveCount(1);
  await selectLayer(textLayers(page));
  await myComponents(page);
  await page.getByRole("textbox", { name: "Component name", exact: true }).fill("Reusable title");
  await page.getByRole("button", { name: "Create master from selection", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Master", exact: true })).toHaveValue("master.1");
  await page.getByRole("button", { name: "Insert linked instance", exact: true }).click();
  await page.getByRole("button", { name: "Insert linked instance", exact: true }).click();
  await expect(textLayers(page)).toHaveCount(3);
  const allLinked = await saveProject(page);
  expect(allLinked.designSystem.recipeGraph.definitions).toHaveLength(1);
  expect(allLinked.designSystem.recipeGraph.instances).toHaveLength(3);
  const detachedId = allLinked.designSystem.recipeGraph.instances[2]?.rootId;
  if (detachedId === undefined) throw new Error("Missing third instance.");

  await selectLayer(textLayers(page).nth(0));
  await editText(page, LOCAL_TEXT);
  await expect(preview(page).getByText(LOCAL_TEXT, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Reset override text ·/u }).click();
  await expect(preview(page).getByText(LOCAL_TEXT, { exact: true })).toHaveCount(0);
  await expect(preview(page).getByText("Text", { exact: true })).toHaveCount(3);
  await editText(page, LOCAL_TEXT);
  await selectLayer(textLayers(page).nth(2));
  await page.getByRole("button", { name: "Detach instance", exact: true }).click();
  const before = await saveProject(page);
  expect(before.designSystem.recipeGraph.instances).toHaveLength(2);
  expect(before.designSystem.recipeGraph.instances[0]?.overrides).toHaveLength(1);
  expect(sourceNode(before, detachedId)).toEqual(sourceNode(allLinked, detachedId));

  await page.getByRole("button", { name: "Undo last authoring edit", exact: true }).click();
  await selectLayer(textLayers(page).nth(2));
  await expect(page.getByRole("button", { name: "Detach instance", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Redo authoring edit", exact: true }).click();
  await selectLayer(textLayers(page).nth(2));
  await expect(
    page.getByText("Selected content is not linked to a master.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Detach instance", exact: true })).toHaveCount(0);
  const savedControls = await persistence(page);
  await expect(
    savedControls.getByRole("button", { name: "Save project", exact: true }),
  ).toBeDisabled();
  await page.getByText("Source & release", { exact: true }).click();

  const writesBeforeDraft = workspaceMethods.filter((method) => method === "PUT").length;
  await page.getByRole("button", { name: "Edit master", exact: true }).click();
  const draft = page.getByRole("region", { name: "Master draft", exact: true });
  await expect(draft).toContainText("Editing master · Reusable title");
  await expect(
    page.getByText("Instance detached. Its design and wiring are unchanged.", { exact: true }),
  ).toHaveCount(0);
  await expect(preview(page).getByText("Text", { exact: true })).toHaveCount(1);
  await expect(textLayers(page)).toHaveCount(1);
  await selectLayer(textLayers(page));
  await editText(page, MASTER_TEXT);
  const inspector = page.getByRole("complementary", { name: "Inspector", exact: true });
  await inspector.getByRole("tab", { name: "Style", exact: true }).click();
  const style = page.locator("[data-authoring-style='true']");
  await style.getByRole("textbox", { name: "color hex", exact: true }).fill("#123456");
  await style.getByRole("button", { name: "Apply color at Desktop", exact: true }).click();
  await expect.poll(() => textColor(page, MASTER_TEXT)).toBe(MASTER_COLOR);
  await page.getByRole("button", { name: "Undo last authoring edit", exact: true }).click();
  expect(await textColor(page, MASTER_TEXT)).not.toBe(MASTER_COLOR);
  await page.getByRole("button", { name: "Redo authoring edit", exact: true }).click();
  await expect.poll(() => textColor(page, MASTER_TEXT)).toBe(MASTER_COLOR);
  const blockedControls = await persistence(page);
  await expect(
    blockedControls.getByRole("button", { name: "Save project", exact: true }),
  ).toBeDisabled();
  await expect(
    blockedControls.getByRole("button", { name: "Open project", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await page.getByText("Source & release", { exact: true }).click();
  expect(workspaceMethods.filter((method) => method === "PUT")).toHaveLength(writesBeforeDraft);
  await selectLayer(textLayers(page));
  await expect(style.getByRole("textbox", { name: "color hex", exact: true })).toHaveValue(
    "#123456",
  );
  await page.screenshot({ path: testInfo.outputPath("master-draft.png"), fullPage: true });
  await draft.getByRole("button", { name: "Apply master changes", exact: true }).click();
  await expect(draft).toHaveCount(0);
  await expectUpdatedPreview(page);
  const updated = await saveProject(page);
  expect(sourceNode(updated, detachedId)).toEqual(sourceNode(before, detachedId));
  expect(updated.designSystem.recipeGraph.instances).toHaveLength(2);
  for (const [index, instance] of updated.designSystem.recipeGraph.instances.entries()) {
    const previous = before.designSystem.recipeGraph.instances[index];
    expect(previous).toBeDefined();
    expect(instance.id).toBe(previous?.id);
    expect(instance.rootId).toBe(previous?.rootId);
    expect(instance.mapping).toEqual(previous?.mapping);
    expect(instance.overrides).toEqual(previous?.overrides);
    expect(instance.definitionDigest).not.toBe(previous?.definitionDigest);
    expect(instance.materializedDigest).not.toBe(previous?.materializedDigest);
  }
  expect(updated.designSystem.recipeGraph.instances[0]?.definitionDigest).toBe(
    updated.designSystem.recipeGraph.instances[1]?.definitionDigest,
  );

  // The two staged visual edits become exactly one live-project undo step.
  await page.getByRole("button", { name: "Undo last authoring edit", exact: true }).click();
  expect(await saveProject(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo authoring edit", exact: true }).click();
  expect(await saveProject(page)).toEqual(updated);
  const reopen = page
    .waitForResponse(
      (response) =>
        new URL(response.url()).pathname === WORKSPACE_PATH &&
        response.request().method() === "GET" &&
        response.ok(),
    )
    .then(async (response) => observedProject((await response.json()) as ObservedWorkspace));
  await page.reload();
  const reopened = await reopen;
  expect(reopened).toEqual(updated);
  await expect(textLayers(page)).toHaveCount(3);
  await expectUpdatedPreview(page);
  await myComponents(page);
  await expect(page.getByRole("combobox", { name: "Master", exact: true })).toHaveValue("master.1");
  await selectLayer(textLayers(page).nth(0));
  await expect(page.getByRole("button", { name: /^Reset override text ·/u })).toBeEnabled();
  await selectLayer(textLayers(page).nth(2));
  await expect(
    page.getByText("Selected content is not linked to a master.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Detach instance", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo last authoring edit", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("reopened-instances.png"), fullPage: true });
  expect(legacyMethods).toEqual([]);
  expect(failures).toEqual([]);

  const directory = process.env.DESEN_M10A_T15_PROOF_TEMP;
  if (directory !== undefined && directory.length > 0) {
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "browser-proof.json"),
      `${JSON.stringify(
        {
          profile: "desen.m10a-t15.browser-proof.v1",
          result: "PASS",
          tests: [{ title: TEST_TITLE, result: "PASS" }],
          observations: {
            allLinkedProjectSha256: fingerprint(allLinked),
            beforeMasterProjectSha256: fingerprint(before),
            updatedProjectSha256: fingerprint(updated),
            reopenedProjectSha256: fingerprint(reopened),
            instanceIds: updated.designSystem.recipeGraph.instances.map(({ id }) => id),
            detachedRootId: detachedId,
            observedWorkspacePutCount: workspaceMethods.filter((method) => method === "PUT").length,
          },
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
  }
});
