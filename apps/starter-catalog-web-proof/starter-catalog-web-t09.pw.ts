import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STARTER_T09_BROWSER_PROOF_TEST_TITLES } from "./t09-proof-contract.js";

function surface(page: Page) {
  return page.locator("[data-proof-surface='t09-data-display-feedback']");
}

test(STARTER_T09_BROWSER_PROOF_TEST_TITLES.publication, async ({ page, request }) => {
  await page.goto("/t09-authoring.html");
  await expect(page.locator("[data-proof-ready='t09-authoring']")).toBeVisible();
  await expect(surface(page)).toHaveCount(1);
  await expect(surface(page).getByRole("article", { name: "Project summary" })).toBeVisible();
  await expect(
    surface(page).getByRole("table", { name: "Project status", exact: true }),
  ).toBeVisible();
  const receipt = await (await request.get("/t09-authoring-graph-proof.json")).json();
  expect(receipt).toMatchObject({
    profile: "desen.m10a-t09.graph-proof.v1",
    result: "PASS",
    assertions: { exactStarterRegistryPresent: true, t09FixturePresent: true },
  });
});

test(STARTER_T09_BROWSER_PROOF_TEST_TITLES.semantics, async ({ page }) => {
  await page.goto("/t09-authoring.html");
  const current = surface(page);
  await expect(current.getByRole("img", { name: "Ada Lovelace" })).toHaveText("AL");
  await expect(current.getByRole("alert")).toContainText("Your draft is still available locally.");
  await expect(current.getByRole("status", { name: "Loading project details" })).toBeVisible();
  await expect(current.getByRole("progressbar", { name: "Uploading assets" })).toHaveAttribute(
    "aria-valuenow",
    "45",
  );
  await expect(
    current.getByRole("list", { name: "Project tasks" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(current.getByText("No tasks yet.")).toBeVisible();
  await expect(
    current.getByRole("columnheader", { name: "Name", exact: true }).first(),
  ).toBeVisible();
  await expect(current.getByText("No project rows yet.")).toBeVisible();
});

test(STARTER_T09_BROWSER_PROOF_TEST_TITLES.host, async ({ page, request }) => {
  await page.goto("/t09-host.html");
  await expect(page.locator("[data-proof-ready='t09-host']")).toBeVisible();
  await expect(surface(page).getByText(/sample data only · no operation binding/u)).toBeVisible();
  await expect(surface(page).locator("[data-desen-row-id='prototype']")).toHaveCount(1);
  const receipt = await (await request.get("/t09-host-graph-proof.json")).json();
  expect(receipt).toMatchObject({
    profile: "desen.m10a-t09.graph-proof.v1",
    result: "PASS",
    assertions: {
      exactStarterRegistryPresent: true,
      t09FixturePresent: true,
      independentHostAuthority: true,
    },
  });
});

test(STARTER_T09_BROWSER_PROOF_TEST_TITLES.boundaries, async ({ page }) => {
  await page.goto("/t09-authoring.html");
  const current = surface(page);
  await expect(current.locator("[data-negative-repeat-bound='rejected']")).toHaveCount(1);
  await expect(current.locator("[data-negative-row-identity='rejected']")).toHaveCount(1);
  await expect(current.locator("[data-negative-enterprise-grid='not-admitted']")).toHaveCount(1);
  await expect(current.locator("[role='grid']")).toHaveCount(0);
});
