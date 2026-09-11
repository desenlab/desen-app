import { expect, test } from "@playwright/test";

import { STARTER_BROWSER_PROOF_TEST_TITLES } from "./proof-contract.js";

import type { Page } from "@playwright/test";

interface HostProofApi {
  readonly remountRoot: () => void;
  readonly readSelectState: () => Readonly<Record<string, unknown>> | undefined;
  readonly readDialogState: () => Readonly<Record<string, unknown>> | undefined;
  readonly dispatchMalformedSelectEvent: () => "rejected" | "unexpected";
  readonly publicationRuntimeIds: () => {
    readonly initial: string | undefined;
    readonly compatible: string | undefined;
  };
}

async function openPublisherDerivedHost(page: Page): Promise<void> {
  await page.goto("/authoring.html");
  await expect(page.locator("[data-proof-ready='authoring']")).toBeVisible();
  await page.goto("/host.html");
  await expect(page.locator("[data-proof-ready='host']")).toBeVisible();
}

test(STARTER_BROWSER_PROOF_TEST_TITLES.publication, async ({ page, request }) => {
  await page.goto("/authoring.html");
  await expect(page.locator("[data-proof-ready='authoring']")).toBeVisible();

  await expect(page.locator("[data-proof-surface]")).toHaveCount(3);
  await expect(page.locator("[data-negative-unknown-capability='rejected']")).toHaveCount(1);
  await expect(page.locator("[data-negative-unknown-part='rejected']")).toHaveCount(1);
  await expect(
    page.locator("[data-proof-surface='button'] button", { hasText: "Unavailable action" }),
  ).toBeDisabled();
  await expect(
    page
      .locator("[data-proof-surface='select']")
      .getByRole("combobox", { name: "Release channel" }),
  ).toBeVisible();
  await expect(
    page
      .locator("[data-proof-surface='dialog']")
      .getByRole("button", { name: "Review publication" }),
  ).toBeVisible();

  const receiptResponse = await request.get("/authoring-graph-proof.json");
  expect(receiptResponse.ok()).toBe(true);
  const receipt = (await receiptResponse.json()) as {
    readonly result: string;
    readonly assertions: {
      readonly publisherPresent: boolean;
      readonly exactStarterRegistryPresent: boolean;
    };
  };
  expect(receipt).toMatchObject({
    result: "PASS",
    assertions: { publisherPresent: true, exactStarterRegistryPresent: true },
  });
});

test(STARTER_BROWSER_PROOF_TEST_TITLES.interactions, async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openPublisherDerivedHost(page);

  const selectSurface = page.locator("[data-proof-surface='select']");
  const selectTrigger = selectSurface.getByRole("combobox", { name: "Release channel" });
  await page.evaluate(() => {
    const scope = document.querySelector("[data-proof-surface='select']");
    (window as unknown as { __rememberedSelect?: Element | null }).__rememberedSelect =
      scope?.querySelector("[role='combobox']") ?? null;
  });
  await selectTrigger.focus();
  await page.keyboard.press("ArrowDown");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  expect(
    await listbox.evaluate((node) => node.closest("[data-desen-starter-boundary]") !== null),
  ).toBe(true);
  expect(
    await listbox.evaluate((node) => node.closest("[data-desen-starter-portals]") !== null),
  ).toBe(true);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(selectTrigger).toContainText("Stable");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
          .__DESEN_STARTER_HOST_PROOF__;
        return api.readSelectState()?.selection;
      }),
    )
    .toBe("stable");
  expect(
    await page.evaluate(() => {
      const remembered = (window as unknown as { __rememberedSelect?: Element | null })
        .__rememberedSelect;
      const current = document.querySelector("[data-proof-surface='select'] [role='combobox']");
      return remembered !== null && remembered === current;
    }),
  ).toBe(true);

  const stateBeforeMalformedEvent = await page.evaluate(() => {
    const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
      .__DESEN_STARTER_HOST_PROOF__;
    return api.readSelectState();
  });
  expect(
    await page.evaluate(() => {
      const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
        .__DESEN_STARTER_HOST_PROOF__;
      return api.dispatchMalformedSelectEvent();
    }),
  ).toBe("rejected");
  expect(
    await page.evaluate(() => {
      const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
        .__DESEN_STARTER_HOST_PROOF__;
      return api.readSelectState();
    }),
  ).toEqual(stateBeforeMalformedEvent);

  const dialogSurface = page.locator("[data-proof-surface='dialog']");
  const dialogTrigger = dialogSurface.getByRole("button", { name: "Review publication" });
  await dialogTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Starter publication" });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((node) => node.closest("[data-desen-starter-boundary]") !== null),
  ).toBe(true);
  expect(
    await dialog.evaluate((node) => node.closest("[data-desen-starter-portals]") !== null),
  ).toBe(true);
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Open dialog" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
          .__DESEN_STARTER_HOST_PROOF__;
        return api.readDialogState()?.open;
      }),
    )
    .toBe(true);

  const nestedSelect = dialog.getByRole("combobox", { name: "Dialog channel" });
  await nestedSelect.focus();
  await page.keyboard.press("ArrowDown");
  const nestedListbox = page.getByRole("listbox");
  await expect(nestedListbox).toBeVisible();
  expect(await nestedListbox.evaluate((node) => node.closest("[role='dialog']") !== null)).toBe(
    true,
  );
  expect(
    await nestedListbox.evaluate((node) => node.closest("[data-desen-starter-portals]") !== null),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(nestedListbox).toBeHidden();
  await expect(nestedSelect).toBeFocused();
  await expect(dialog).toBeVisible();

  const closeDialog = dialog.getByRole("button", { name: "Close review" });
  await closeDialog.focus();
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
  }
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(dialogTrigger).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
          .__DESEN_STARTER_HOST_PROOF__;
        return api.readDialogState()?.open;
      }),
    )
    .toBe(false);
  expect(pageErrors).toEqual([]);
});

test(STARTER_BROWSER_PROOF_TEST_TITLES.isolation, async ({ page, request }) => {
  await openPublisherDerivedHost(page);

  const buttonSurface = page.locator("[data-proof-surface='button']");
  const initialButton = buttonSurface.getByRole("button", { name: "Unavailable action" });
  await expect(initialButton).toBeDisabled();
  await expect(initialButton).not.toHaveAttribute("aria-busy", "true");
  const initialRuntimeId = await buttonSurface.getAttribute("data-runtime-instance-id");
  await page.evaluate(() => {
    const scope = document.querySelector("[data-proof-surface='button']");
    (window as unknown as { __rememberedButton?: Element | null }).__rememberedButton =
      scope?.querySelector("button") ?? null;
  });

  await page.locator("[data-proof-switch-publication]").click();
  const loadingButton = buttonSurface.getByRole("button", { name: "Publishing starter…" });
  await expect(loadingButton).toHaveAttribute("aria-busy", "true");
  await expect(buttonSurface).toHaveAttribute("data-runtime-instance-id", initialRuntimeId ?? "");
  expect(
    await page.evaluate(() => {
      const remembered = (window as unknown as { __rememberedButton?: Element | null })
        .__rememberedButton;
      return (
        remembered !== null &&
        remembered === document.querySelector("[data-proof-surface='button'] button")
      );
    }),
  ).toBe(false);
  const publicationIds = await page.evaluate(() => {
    const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
      .__DESEN_STARTER_HOST_PROOF__;
    return api.publicationRuntimeIds();
  });
  expect(publicationIds.initial).toBeTruthy();
  expect(publicationIds.compatible).toBe(publicationIds.initial);

  await page.evaluate(() => {
    const api = (window as unknown as { __DESEN_STARTER_HOST_PROOF__: HostProofApi })
      .__DESEN_STARTER_HOST_PROOF__;
    api.remountRoot();
  });
  await expect(page.locator("[data-proof-ready='host']")).toBeVisible();
  const remountedTrigger = page
    .locator("[data-proof-surface='dialog']")
    .getByRole("button", { name: "Review publication" });
  await remountedTrigger.click();
  await expect(page.getByRole("dialog", { name: "Starter publication" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(remountedTrigger).toBeFocused();

  const receiptResponse = await request.get("/host-graph-proof.json");
  expect(receiptResponse.ok()).toBe(true);
  const receipt = (await receiptResponse.json()) as {
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
