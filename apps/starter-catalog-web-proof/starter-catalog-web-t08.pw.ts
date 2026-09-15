import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STARTER_T08_BROWSER_PROOF_TEST_TITLES } from "./t08-proof-contract.js";

async function openHost(page: Page): Promise<void> {
  await page.goto("/t08-host.html");
  await expect(page.locator("[data-proof-ready='t08-host']")).toBeVisible();
}

function surface(page: Page) {
  return page.locator("[data-proof-surface='t08-overlay-disclosure']");
}

test(STARTER_T08_BROWSER_PROOF_TEST_TITLES.publication, async ({ page, request }) => {
  await page.goto("/t08-authoring.html");
  await expect(page.locator("[data-proof-ready='t08-authoring']")).toBeVisible();
  await expect(surface(page)).toHaveCount(1);
  await expect(surface(page).getByRole("button", { name: "Open dialog" })).toBeVisible();
  await expect(surface(page).getByRole("button", { name: "Open popover" })).toBeVisible();
  await expect(surface(page).getByRole("button", { name: "Open menu" })).toBeVisible();
  const receipt = await (await request.get("/t08-authoring-graph-proof.json")).json();
  expect(receipt).toMatchObject({
    profile: "desen.m10a-t08.graph-proof.v1",
    result: "PASS",
    assertions: { exactStarterRegistryPresent: true, t08FixturePresent: true },
  });
});

test(STARTER_T08_BROWSER_PROOF_TEST_TITLES.semantics, async ({ page, request }) => {
  await page.goto("/t08-authoring.html");
  await expect(page.locator("[data-proof-ready='t08-authoring']")).toBeVisible();
  await expect(surface(page).getByRole("button", { name: "Hover help" })).toBeVisible();
  await expect(surface(page).getByRole("button", { name: "Disabled help" })).toHaveAttribute(
    "data-trigger-disabled",
    "",
  );
  await expect(surface(page).getByRole("button", { name: "Overview" })).toBeVisible();
  await expect(surface(page).getByText("Overview panel")).toBeHidden();
  await page.goto("/t08-host.html");
  await expect(page.locator("[data-proof-ready='t08-host']")).toBeVisible();
  await expect(page.locator("[data-desen-starter-boundary]")).toHaveCount(1);
  await expect(
    page.locator("[data-desen-starter-boundary] [data-desen-starter-portals]"),
  ).toHaveCount(1);
  const receipt = await (await request.get("/t08-host-graph-proof.json")).json();
  expect(receipt).toMatchObject({
    profile: "desen.m10a-t08.graph-proof.v1",
    result: "PASS",
    assertions: { exactStarterRegistryPresent: true, independentHostAuthority: true },
  });
});

test(STARTER_T08_BROWSER_PROOF_TEST_TITLES.keyboard, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openHost(page);
  const current = surface(page);

  const dialogTrigger = current.getByRole("button", { name: "Open dialog" });
  await dialogTrigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(dialogTrigger).toBeFocused();

  const popoverTrigger = current.getByRole("button", { name: "Open popover" });
  await popoverTrigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).last().click();
  await expect(popoverTrigger).toBeFocused();

  const menuTrigger = current.getByRole("button", { name: "Open menu" });
  await menuTrigger.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(current.locator("[data-proof-events='t08']")).toContainText("menu:edit");

  const tooltipTrigger = current.getByRole("button", { name: "Hover help" });
  await tooltipTrigger.hover();
  await page.waitForTimeout(700);
  await expect(page.getByRole("tooltip")).toBeVisible({ timeout: 5_000 });

  const accordionTrigger = current.getByRole("button", { name: "Overview" });
  await accordionTrigger.click();
  await expect(current.getByText("Overview panel")).toBeVisible();
  expect(errors).toEqual([]);
});

test(STARTER_T08_BROWSER_PROOF_TEST_TITLES.boundaries, async ({ page }) => {
  await page.goto("/t08-authoring.html");
  const current = surface(page);
  await expect(current.locator("[data-negative-missing-slot='rejected']")).toHaveCount(1);
  await expect(current.locator("[data-negative-forged-portal='rejected']")).toHaveCount(1);
  await expect(current.locator("[data-negative-stale-interaction='rejected']")).toHaveCount(1);
  await expect(current.locator("[data-disabled-controls='rejected']")).toHaveCount(1);
  await expect(current.getByRole("button", { name: "Disabled help" })).toHaveAttribute(
    "data-trigger-disabled",
    "",
  );
});
