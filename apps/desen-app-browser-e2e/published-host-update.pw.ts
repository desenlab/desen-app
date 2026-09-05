import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import type { APIRequestContext, Locator, Page } from "@playwright/test";

const HOST_ORIGIN = "http://127.0.0.1:4178";
const BASELINE_LABEL = "Draft checkout";
const UPDATED_LABEL = "Ready to continue";
const STABLE_LABEL = "Your details stay private";

function hierarchy(page: Page): Locator {
  return page.getByRole("region", { name: "Sign-in layer hierarchy" });
}

function inspector(page: Page): Locator {
  return page.getByRole("complementary", { name: "Inspector" });
}

function publication(page: Page): Locator {
  return page.getByRole("region", { name: "Publish saved Source" });
}

function persistence(page: Page): Locator {
  return page.getByRole("region", { name: "Source persistence" });
}

async function openSourceAndRelease(page: Page): Promise<void> {
  const commands = page.getByLabel("Workspace commands", { exact: true });
  await commands.getByText("Source & release", { exact: true }).click();
  await expect(publication(page)).toBeVisible();
}

async function closeSourceAndRelease(page: Page): Promise<void> {
  const commands = page.getByLabel("Workspace commands", { exact: true });
  await commands.getByText("Source & release", { exact: true }).click();
  await expect(publication(page)).toBeHidden();
}

async function setText(page: Page, value: string): Promise<void> {
  await inspector(page).getByRole("textbox", { name: "Text", exact: true }).fill(value);
  await inspector(page).getByRole("button", { name: "Apply Text", exact: true }).click();
  await expect(inspector(page).getByRole("status")).toContainText("Updated Text.");
}

async function save(page: Page, expectedGeneration: number): Promise<void> {
  const stored = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/v1/sources/account-app-source",
  );
  await persistence(page).getByRole("button", { name: "Save source", exact: true }).click();
  expect((await stored).ok()).toBe(true);
  await expect(persistence(page).getByRole("status")).toContainText(
    `Source saved successfully. Generation ${String(expectedGeneration)}.`,
  );
}

async function publish(page: Page): Promise<Readonly<Record<string, string>>> {
  const bundleWrite = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      /^\/v1\/bundles\/sha256:[0-9a-f]{64}$/u.test(new URL(response.url()).pathname),
  );
  const channelWrite = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/v1/channels/preview",
  );
  const activation = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/v1/activate-published-revision",
  );
  await publication(page).getByRole("button", { name: "Publish", exact: true }).click();
  expect((await bundleWrite).ok()).toBe(true);
  expect((await channelWrite).ok()).toBe(true);
  expect((await activation).ok()).toBe(true);
  await expect(publication(page).getByRole("status")).toContainText(
    "is active in the reference host.",
  );
  const entries = publication(page).locator("dl > div");
  const receipt: Record<string, string> = Object.create(null) as Record<string, string>;
  for (let index = 0; index < (await entries.count()); index += 1) {
    const entry = entries.nth(index);
    const label = (await entry.locator("dt").innerText()).trim();
    const value = (await entry.locator("dd").innerText()).trim();
    receipt[label] = value;
    if (label === "Revision")
      receipt.RevisionIdentity = (await entry.locator("dd").getAttribute("title")) ?? "";
  }
  return Object.freeze(receipt);
}

async function hostBuildFingerprint(request: APIRequestContext): Promise<string> {
  const indexResponse = await request.get(`${HOST_ORIGIN}/`, { failOnStatusCode: true });
  const index = await indexResponse.body();
  const html = index.toString("utf8");
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/gu)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
    .sort();
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.some((asset) => asset.endsWith(".js"))).toBe(true);
  expect(assets.some((asset) => asset.endsWith(".css"))).toBe(true);
  const hash = createHash("sha256");
  hash.update(index);
  for (const asset of assets) {
    hash.update(asset);
    hash.update(
      await (await request.get(`${HOST_ORIGIN}${asset}`, { failOnStatusCode: true })).body(),
    );
  }
  return hash.digest("hex");
}

async function verticalDistance(page: Page): Promise<number> {
  const first = await page
    .getByText(new RegExp(`^(?:${BASELINE_LABEL}|${UPDATED_LABEL})$`, "u"))
    .boundingBox();
  const second = await page.getByText(STABLE_LABEL, { exact: true }).boundingBox();
  if (first === null || second === null) throw new Error("Expected both managed text bounds.");
  return second.y - (first.y + first.height);
}

test("publishes visible label and layout edits into one unchanged independent host build", async ({
  context,
  page,
  request,
}) => {
  const appErrors: string[] = [];
  let initialMissingObserved = false;
  let initialMissingChannelObserved = false;
  page.on("pageerror", (error) => appErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const path = (() => {
      try {
        return new URL(message.location().url).pathname;
      } catch {
        return "";
      }
    })();
    if (
      !initialMissingObserved &&
      path === "/v1/sources/account-app-source" &&
      message.text() ===
        "Failed to load resource: the server responded with a status of 404 (Not Found)"
    ) {
      initialMissingObserved = true;
      return;
    }
    if (
      !initialMissingChannelObserved &&
      path === "/v1/channels/preview" &&
      message.text() ===
        "Failed to load resource: the server responded with a status of 404 (Not Found)"
    ) {
      initialMissingChannelObserved = true;
      return;
    }
    appErrors.push(`console: ${message.text()}`);
  });

  const host = await context.newPage();
  const hostErrors: string[] = [];
  host.on("pageerror", (error) => hostErrors.push(`pageerror: ${error.message}`));
  host.on("console", (message) => {
    if (message.type() === "error") hostErrors.push(`console: ${message.text()}`);
  });
  await host.goto(`${HOST_ORIGIN}/home`);
  await expect(
    host.getByRole("heading", { name: "Waiting for verified activation." }),
  ).toBeVisible();
  const buildBefore = await hostBuildFingerprint(request);

  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Create a project" })
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);

  await page
    .getByRole("button", {
      name: /Insert Text into Stack sign-in\.layout default slot at position 1/u,
    })
    .click();
  await setText(page, BASELINE_LABEL);
  await page
    .getByRole("button", {
      name: /Insert Text into Stack sign-in\.layout default slot at position 2/u,
    })
    .click();
  await setText(page, STABLE_LABEL);

  await openSourceAndRelease(page);
  await save(page, 2);
  const baselineReceipt = await publish(page);
  expect(baselineReceipt.Source).toBe("g2");
  expect(baselineReceipt.Channel).toBe("g1");
  expect(baselineReceipt.RevisionIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);

  await host.reload();
  await expect(host.getByText(BASELINE_LABEL, { exact: true })).toBeVisible();
  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();
  const baselineDistance = await verticalDistance(host);

  await closeSourceAndRelease(page);
  await hierarchy(page)
    .getByRole("button", { name: "Select Text layer · node.text", exact: true })
    .click();
  await setText(page, UPDATED_LABEL);
  await hierarchy(page)
    .getByRole("button", { name: "Select Stack layer · sign-in.layout", exact: true })
    .click();
  await inspector(page)
    .getByRole("combobox", { name: "Gap", exact: true })
    .selectOption({ label: "xl" });
  await expect(inspector(page).getByRole("status")).toContainText("Updated Gap.");

  await openSourceAndRelease(page);
  await save(page, 3);
  const updatedReceipt = await publish(page);
  expect(updatedReceipt.Source).toBe("g3");
  expect(updatedReceipt.Channel).toBe("g2");
  expect(updatedReceipt.RevisionIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);
  expect(updatedReceipt.RevisionIdentity).not.toBe(baselineReceipt.RevisionIdentity);

  await host.reload();
  await expect(host.getByText(UPDATED_LABEL, { exact: true })).toBeVisible();
  await expect(host.getByText(BASELINE_LABEL, { exact: true })).toHaveCount(0);
  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();
  const updatedDistance = await verticalDistance(host);
  expect(updatedDistance).toBeGreaterThan(baselineDistance + 8);
  expect(await hostBuildFingerprint(request)).toBe(buildBefore);

  await host.reload();
  await expect(host.getByText(UPDATED_LABEL, { exact: true })).toBeVisible();
  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();
  expect(initialMissingObserved).toBe(true);
  expect(initialMissingChannelObserved).toBe(true);
  expect(appErrors).toEqual([]);
  expect(hostErrors).toEqual([]);
  await host.screenshot({ path: test.info().outputPath("published-layout-update.png") });
});
