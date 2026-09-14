import { expect, test } from "@playwright/test";

import { STARTER_T07_BROWSER_PROOF_TEST_TITLES } from "./t07-proof-contract.js";

import type { Locator, Page } from "@playwright/test";

interface HostT07ProofApi {
  readonly dispatchMalformedNumericEvent: () => "rejected" | "unexpected";
  readonly dispatchMalformedSelectionEvent: () => "rejected" | "unexpected";
  readonly readSelectionNumericState: () => Readonly<Record<string, unknown>> | undefined;
}

async function openPublisherDerivedT07Host(page: Page): Promise<void> {
  await page.goto("/t07-authoring.html");
  await expect(page.locator("[data-proof-ready='t07-authoring']")).toBeVisible();
  await page.goto("/t07-host.html");
  await expect(page.locator("[data-proof-ready='t07-host']")).toBeVisible();
}

function selectionNumericSurface(page: Page): Locator {
  return page.locator("[data-proof-surface='t07-selection-numeric']");
}

function selectControl(surface: Locator, label: string): Locator {
  return surface.getByRole("combobox", { name: label, exact: true });
}

function comboboxInput(surface: Locator, disabled = false): Locator {
  const disabledSelector = disabled ? "[disabled]" : ":not([disabled])";
  return surface.locator(`input[placeholder='Search regions']${disabledSelector}`);
}

async function readHostState(page: Page): Promise<Readonly<Record<string, unknown>> | undefined> {
  return page.evaluate(() => {
    const api = (window as unknown as { __DESEN_STARTER_T07_HOST_PROOF__: HostT07ProofApi })
      .__DESEN_STARTER_T07_HOST_PROOF__;
    return api.readSelectionNumericState();
  });
}

async function expectSurfaceSemantics(page: Page): Promise<void> {
  const surface = selectionNumericSurface(page);
  await expect(surface).toBeVisible();

  const select = selectControl(surface, "Release channel");
  const combobox = comboboxInput(surface);
  const tabList = surface.getByRole("tablist");
  const overview = surface.getByRole("tab", { name: "Overview" });
  const details = surface.getByRole("tab", { name: "Details" });
  const locked = surface.getByRole("tab", { name: "Locked" });
  const slider = surface.getByRole("slider", { name: "Opacity", exact: true });
  const numberField = surface.getByRole("textbox", { name: "Columns", exact: true });

  await expect(select).toBeVisible();
  await expect(combobox).toBeVisible();
  await expect(tabList).toBeVisible();
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(details).toHaveAttribute("aria-selected", "false");
  await expect(locked).toBeDisabled();
  await expect(
    surface.getByText("Overview panel is paired to the stable overview identity."),
  ).toBeVisible();
  await expect(
    surface.getByText("Details panel is paired to the stable details identity."),
  ).toBeHidden();
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "100");
  await expect(slider).toHaveAttribute("aria-valuenow", "50");
  await expect(numberField).toHaveAttribute("aria-roledescription", "Number field");
  await expect(numberField).toHaveValue("2");
  await expect(surface.getByRole("button", { name: "Decrease Columns" })).toBeVisible();
  await expect(surface.getByRole("button", { name: "Increase Columns" })).toBeVisible();
}

test(STARTER_T07_BROWSER_PROOF_TEST_TITLES.publication, async ({ page, request }) => {
  await page.goto("/t07-authoring.html");
  await expect(page.locator("[data-proof-ready='t07-authoring']")).toBeVisible();

  await expect(page.locator("[data-proof-surface='t07-selection-numeric']")).toHaveCount(1);
  await expect(selectControl(selectionNumericSurface(page), "Release channel")).toBeVisible();
  await expect(comboboxInput(selectionNumericSurface(page))).toBeVisible();
  await expect(selectionNumericSurface(page).getByRole("tablist")).toBeVisible();
  await expect(
    selectionNumericSurface(page).getByRole("slider", { name: "Opacity", exact: true }),
  ).toBeVisible();
  await expect(
    selectionNumericSurface(page).getByRole("textbox", { name: "Columns", exact: true }),
  ).toBeVisible();

  const receiptResponse = await request.get("/t07-authoring-graph-proof.json");
  expect(receiptResponse.ok()).toBe(true);
  const receipt = (await receiptResponse.json()) as {
    readonly profile: string;
    readonly result: string;
    readonly assertions: {
      readonly exactStarterRegistryPresent: boolean;
      readonly t07FixturePresent: boolean;
      readonly publisherPresent: boolean;
    };
  };
  expect(receipt).toMatchObject({
    profile: "desen.m10a-t07.graph-proof.v1",
    result: "PASS",
    assertions: {
      exactStarterRegistryPresent: true,
      t07FixturePresent: true,
      publisherPresent: true,
    },
  });
});

test(STARTER_T07_BROWSER_PROOF_TEST_TITLES.semantics, async ({ page, request }) => {
  await page.goto("/t07-authoring.html");
  await expect(page.locator("[data-proof-ready='t07-authoring']")).toBeVisible();
  await expectSurfaceSemantics(page);

  await page.goto("/t07-host.html");
  await expect(page.locator("[data-proof-ready='t07-host']")).toBeVisible();
  await expectSurfaceSemantics(page);

  const receiptResponse = await request.get("/t07-host-graph-proof.json");
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
    profile: "desen.m10a-t07.graph-proof.v1",
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

test(STARTER_T07_BROWSER_PROOF_TEST_TITLES.keyboard, async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openPublisherDerivedT07Host(page);

  const surface = selectionNumericSurface(page);
  const releaseChannel = selectControl(surface, "Release channel");
  await releaseChannel.focus();
  await expect(releaseChannel).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("s");
  await expect(page.getByRole("option", { name: "Stable" })).toHaveAttribute(
    "data-highlighted",
    "",
  );
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await readHostState(page))?.releaseChannel).toBe("stable");

  const region = comboboxInput(surface);
  await region.fill("south");
  await region.press("ArrowDown");
  await region.press("Enter");
  await expect.poll(async () => (await readHostState(page))?.region).toBe("south");

  const overview = surface.getByRole("tab", { name: "Overview" });
  await overview.focus();
  await expect(overview).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readHostState(page))?.section).toBe("details");
  await expect(surface.getByRole("tab", { name: "Details" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    surface.getByText("Details panel is paired to the stable details identity."),
  ).toBeVisible();

  const slider = surface.getByRole("slider", { name: "Opacity", exact: true });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readHostState(page))?.opacity).toBe(51);
  await page.keyboard.press("End");
  await expect.poll(async () => (await readHostState(page))?.opacity).toBe(100);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readHostState(page))?.opacity).toBe(100);
  await page.keyboard.press("Home");
  await expect.poll(async () => (await readHostState(page))?.opacity).toBe(0);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await readHostState(page))?.opacity).toBe(0);

  const columns = surface.getByRole("textbox", { name: "Columns", exact: true });
  await columns.focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await readHostState(page))?.columns).toBe(3);
  await columns.fill("12");
  await expect.poll(async () => (await readHostState(page))?.columns).toBe(12);
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await readHostState(page))?.columns).toBe(12);

  expect(pageErrors).toEqual([]);
});

test(STARTER_T07_BROWSER_PROOF_TEST_TITLES.boundaries, async ({ page }) => {
  await page.goto("/t07-authoring.html");
  await expect(page.locator("[data-proof-ready='t07-authoring']")).toBeVisible();
  await expect(page.locator("[data-negative-duplicate-option-id='rejected']")).toHaveCount(1);
  await expect(page.locator("[data-negative-nonfinite-value='rejected']")).toHaveCount(1);
  await expect(page.locator("[data-negative-function-renderer='rejected']")).toHaveCount(1);
  await expect(page.locator("[data-negative-function-filter='rejected']")).toHaveCount(1);

  await page.goto("/t07-host.html");
  await expect(page.locator("[data-proof-ready='t07-host']")).toBeVisible();
  const surface = selectionNumericSurface(page);
  const emptySelect = selectControl(surface, "No release channels");
  const disabledCombobox = comboboxInput(surface, true);
  const disabledComboboxTrigger = surface.getByRole("button", {
    name: "Unavailable regions",
    exact: true,
  });
  const disabledSlider = surface.getByRole("slider", { name: "Locked opacity", exact: true });
  await expect(emptySelect).toBeVisible();
  await expect(emptySelect).toHaveText(/No options/u);
  await expect(disabledCombobox).toBeDisabled();
  await expect(disabledComboboxTrigger).toBeDisabled();
  await expect(disabledSlider).toBeDisabled();

  const stateBeforeMalformedEvent = await readHostState(page);
  expect(
    await page.evaluate(() => {
      const api = (window as unknown as { __DESEN_STARTER_T07_HOST_PROOF__: HostT07ProofApi })
        .__DESEN_STARTER_T07_HOST_PROOF__;
      return api.dispatchMalformedSelectionEvent();
    }),
  ).toBe("rejected");
  expect(
    await page.evaluate(() => {
      const api = (window as unknown as { __DESEN_STARTER_T07_HOST_PROOF__: HostT07ProofApi })
        .__DESEN_STARTER_T07_HOST_PROOF__;
      return api.dispatchMalformedNumericEvent();
    }),
  ).toBe("rejected");
  expect(await readHostState(page)).toEqual(stateBeforeMalformedEvent);
});
