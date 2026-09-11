import { expect, test } from "@playwright/test";

import { WORKBENCH_BROWSER_PROOF_TEST_TITLES } from "./proof-contract.js";

import type { Page } from "@playwright/test";

async function openWorkbench(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("[data-proof-ready='workbench']")).toBeVisible();
  await expect(page.locator("[data-live-preview='ready']")).toBeVisible();
}

test(WORKBENCH_BROWSER_PROOF_TEST_TITLES.foundation, async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);

  await expect(page.getByRole("heading", { name: "DESEN Neutral" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Foundation specimen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Light" }).focus();
  await expect(page.getByRole("button", { name: "Light" })).toBeFocused();
  expect(
    await page
      .getByRole("button", { name: "Light" })
      .evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("2px");
  const workbench = page.locator("[data-proof-ready='workbench']");
  const preview = page.locator(".preview-stage");
  const lightCanvas = await preview.getAttribute("data-preview-color-canvas");

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(workbench).toHaveAttribute("data-mode", "dark");
  await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => preview.getAttribute("data-preview-color-canvas")).not.toBe(lightCanvas);

  await page.getByRole("button", { name: "Light" }).click();
  await expect(workbench).toHaveAttribute("data-mode", "light");
  await expect(preview).toHaveAttribute("data-preview-color-canvas", lightCanvas ?? "");

  const receiptResponse = await request.get("/workbench-graph-proof.json");
  expect(receiptResponse.ok()).toBe(true);
  const receipt = (await receiptResponse.json()) as {
    readonly result: string;
    readonly assertions: {
      readonly designSystemAuthoringPresent: boolean;
      readonly isolatedProofGraph: boolean;
      readonly forbiddenAuthorities: Readonly<Record<string, boolean>>;
    };
    readonly modules: readonly string[];
  };
  expect(receipt).toMatchObject({
    result: "PASS",
    assertions: {
      designSystemAuthoringPresent: true,
      isolatedProofGraph: true,
      forbiddenAuthorities: {
        desenApp: false,
        editor: false,
        publisher: false,
        runtime: false,
        starterCatalog: false,
      },
    },
  });
  expect(receipt.modules.some((path) => path.includes("apps/desen-app/"))).toBe(false);
  expect(receipt.modules.some((path) => path.includes("packages/publisher/"))).toBe(false);
  expect(receipt.modules.some((path) => path.includes("packages/runtime-core/"))).toBe(false);
  expect(pageErrors).toEqual([]);
});

test(WORKBENCH_BROWSER_PROOF_TEST_TITLES.editing, async ({ page }) => {
  await openWorkbench(page);
  const workbench = page.locator("[data-proof-ready='workbench']");
  const preview = page.locator(".preview-stage");
  const primaryAction = page.getByRole("button", { name: "Primary action" });
  const initialColor = await preview.getAttribute("data-preview-color-action");
  const initialRenderedColor = await primaryAction.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(initialRenderedColor).toBe("color(srgb 0.0901961 0.0901961 0.0901961)");
  const initialRevision = Number(await workbench.getAttribute("data-revision"));

  await page.getByLabel("Action color hex").fill("#6d28d9");
  await page.getByLabel("sRGB alpha component").fill("0.42");
  await page.getByRole("button", { name: "Apply color" }).click();
  await expect(preview).toHaveAttribute("data-preview-color-action", "#6d28d9");
  await expect(workbench).toHaveAttribute("data-color-action-alpha", "0.42");
  const editedRenderedColor = await primaryAction.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(editedRenderedColor).toBe("color(srgb 0.427451 0.156863 0.85098 / 0.42)");
  expect(editedRenderedColor).not.toBe(initialRenderedColor);
  await expect(workbench).toHaveAttribute("data-history-past", "1");
  await expect
    .poll(async () => Number(await workbench.getAttribute("data-revision")))
    .toBeGreaterThan(initialRevision);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(preview).toHaveAttribute("data-preview-color-action", initialColor ?? "");
  await expect(workbench).toHaveAttribute("data-history-future", "1");

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(preview).toHaveAttribute("data-preview-color-action", "#6d28d9");
  await expect(workbench).toHaveAttribute("data-history-future", "0");
  await expect(page.getByRole("status")).toContainText("restored");
});

test(WORKBENCH_BROWSER_PROOF_TEST_TITLES.compositeAndAlias, async ({ page }) => {
  await openWorkbench(page);
  const workbench = page.locator("[data-proof-ready='workbench']");
  const preview = page.locator(".preview-stage");
  const specimen = page.locator(".specimen-card");
  const revisionBeforeTypography = Number(await workbench.getAttribute("data-revision"));

  await expect(page.getByLabel("Font size value")).toHaveValue("16");
  await expect(page.getByLabel("Font size unit")).toHaveValue("px");
  await expect(page.getByLabel("Weight")).toHaveValue("400");
  await expect(preview).toHaveAttribute("data-preview-font-size", "16");
  await expect(preview).toHaveAttribute("data-preview-font-size-unit", "px");
  await expect(preview).toHaveAttribute("data-preview-font-weight", "400");
  expect(await specimen.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
  expect(await specimen.evaluate((element) => getComputedStyle(element).fontWeight)).toBe("400");

  await page.getByLabel("Font family").fill("Georgia, serif");
  await page.getByLabel("Font size value").fill("1.125");
  await page.getByLabel("Font size unit").selectOption("rem");
  await page.getByLabel("Weight").fill("semi-bold");
  await page.getByLabel("Letter spacing value").fill("0.00625");
  await page.getByLabel("Letter spacing unit").selectOption("rem");
  await page.getByLabel("Line height").fill("1.6");
  await page.getByRole("button", { name: "Apply typography" }).click();

  await expect(preview).toHaveAttribute("data-preview-font-family", "Georgia, serif");
  await expect(preview).toHaveAttribute("data-preview-font-size", "1.125");
  await expect(preview).toHaveAttribute("data-preview-font-size-unit", "rem");
  await expect(preview).toHaveAttribute("data-preview-font-weight", "semi-bold");
  await expect(preview).toHaveAttribute("data-preview-letter-spacing", "0.00625");
  await expect(preview).toHaveAttribute("data-preview-letter-spacing-unit", "rem");
  expect(await specimen.evaluate((element) => getComputedStyle(element).fontSize)).toBe("18px");
  expect(await specimen.evaluate((element) => getComputedStyle(element).fontWeight)).toBe("600");
  await expect
    .poll(async () => Number(await workbench.getAttribute("data-revision")))
    .toBe(revisionBeforeTypography + 1);
  await expect(page.getByRole("status")).toContainText("one composite token");

  await page.getByLabel("Action alias target").fill("palette.muted");
  await page.getByRole("button", { name: "Apply alias" }).click();
  await expect(workbench).toHaveAttribute("data-alias-target", "palette.muted");
  await expect
    .poll(() => preview.getAttribute("data-preview-color-action"))
    .toBe(await preview.getAttribute("data-preview-color-muted"));
  await expect(workbench).toHaveAttribute("data-history-past", "2");

  await page.getByLabel("New token path").fill("palette.brand");
  await page.getByRole("button", { name: "Create literal token" }).click();
  await expect(page.getByRole("status")).toContainText("palette.brand created");
  await page.getByLabel("New alias path").fill("color.brand");
  await page.getByLabel("Alias target path").fill("palette.brand");
  await page.getByRole("button", { name: "Create whole-token alias" }).click();
  await expect(page.getByRole("status")).toContainText("color.brand now references palette.brand");

  await page.getByRole("button", { name: "Duplicate selected mode" }).click();
  await expect(workbench).toHaveAttribute("data-mode", "custom");
  await page.getByLabel("Mode name", { exact: true }).fill("Studio mode");
  await page.getByRole("button", { name: "Rename mode" }).click();
  await expect(page.getByRole("button", { name: "Studio mode" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate selected theme" }).click();
  await expect(workbench).toHaveAttribute("data-theme", "brand");
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("brand");
  await expect(page.getByRole("heading", { name: "Brand system" })).toBeVisible();
  await page.getByLabel("Theme name", { exact: true }).fill("Studio system");
  await page.getByRole("button", { name: "Rename theme" }).click();
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("brand");
  await expect(page.getByRole("heading", { name: "Studio system" })).toBeVisible();
});

test(WORKBENCH_BROWSER_PROOF_TEST_TITLES.transfer, async ({ page }) => {
  await openWorkbench(page);
  const workbench = page.locator("[data-proof-ready='workbench']");
  const preview = page.locator(".preview-stage");

  await page.getByText("Import & export").click();
  await page.getByRole("button", { name: "Export document" }).click();
  const transfer = page.getByLabel("Export/import document");
  const canonicalText = await transfer.inputValue();
  expect(canonicalText.endsWith("\n")).toBe(false);
  await expect(workbench).toHaveAttribute(
    "data-canonical-bytes",
    String(new TextEncoder().encode(canonicalText).byteLength),
  );
  expect(JSON.parse(canonicalText)).toMatchObject({
    kind: "desen.theme-authoring",
    schemaVersion: 1,
  });

  await page.getByRole("button", { name: "Reimport current export" }).click();
  await expect(workbench).toHaveAttribute("data-roundtrip", "stable");
  await expect(page.getByRole("status")).toContainText("byte-stable");
  await expect(transfer).toHaveValue(canonicalText);

  const colorBeforeInvalidImport = await preview.getAttribute("data-preview-color-action");
  const historyBeforeInvalidImport = await workbench.getAttribute("data-history-past");
  await transfer.fill('{"kind":');
  await page.getByRole("button", { name: "Import document" }).click();
  await expect(workbench).toHaveAttribute("data-import-retention", "retained");
  await expect(page.getByRole("alert")).toContainText("working data retained");
  await expect(preview).toHaveAttribute(
    "data-preview-color-action",
    colorBeforeInvalidImport ?? "",
  );
  await expect(workbench).toHaveAttribute("data-history-past", historyBeforeInvalidImport ?? "");

  await page.getByRole("button", { name: "Export document" }).click();
  await expect(transfer).toHaveValue(canonicalText);

  const unsupportedDocument = JSON.parse(canonicalText) as {
    themes: {
      modes: {
        source: { document: Record<string, unknown> };
      }[];
    }[];
  };
  const darkDocument = unsupportedDocument.themes[0]?.modes[1]?.source.document;
  if (darkDocument === undefined) throw new TypeError("Expected the Neutral dark mode.");
  darkDocument.futureColor = {
    $type: "color",
    $value: { colorSpace: "display-p3", components: [0.8, 0.2, 0.6] },
  };
  await transfer.fill(JSON.stringify(unsupportedDocument));
  await page.getByRole("button", { name: "Import document" }).click();
  await expect(page.getByRole("status")).toContainText("unsupported standard feature preserved");
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(workbench).toHaveAttribute("data-live-preview", "unavailable");
  await expect(page.getByText("Selected mode cannot be previewed safely.")).toBeVisible();
  await expect(page.locator(".preview-canvas")).toHaveCount(0);
  await expect(preview).not.toHaveAttribute("data-preview-color-action");
  await expect(preview).not.toHaveAttribute("data-preview-font-family");
  await expect(workbench).not.toHaveAttribute("data-alias-target");
  await page.getByRole("button", { name: "Export document" }).click();
  expect(await transfer.inputValue()).toContain('"colorSpace":"display-p3"');
});
