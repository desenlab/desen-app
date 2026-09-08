import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import type { APIRequestContext, Locator, Page } from "@playwright/test";

const HOST_ORIGIN = "http://127.0.0.1:4178";
const BASELINE_LABEL = "Verified checkout";
const STABLE_LABEL = "Only valid changes become active";
const TEXT_POINTER = "/surfaces/sign-in/root/slots/default/0";

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected a Source record.");
  }
  return value as Record<string, unknown>;
}

function root(source: Record<string, unknown>): Record<string, unknown> {
  return record(record(record(source.surfaces)["sign-in"]).root);
}

function firstText(source: Record<string, unknown>): Record<string, unknown> {
  const children = record(root(source).slots).default;
  if (!Array.isArray(children)) throw new TypeError("Expected the authored default slot.");
  return record(children[0]);
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

function draft(page: Page): Locator {
  return page.getByRole("region", { name: "Advanced Source draft" });
}

async function openRelease(page: Page): Promise<void> {
  if (await publication(page).isVisible()) return;
  await page
    .getByLabel("Workspace commands", { exact: true })
    .getByText("Source & release", { exact: true })
    .click();
  await expect(publication(page)).toBeVisible();
}

async function openDraft(page: Page): Promise<string> {
  await openRelease(page);
  await page.getByRole("button", { name: "Advanced Source", exact: true }).click();
  await expect(draft(page)).toBeVisible();
  return draft(page).getByRole("textbox", { name: "Source JSON draft" }).inputValue();
}

async function closeRelease(page: Page): Promise<void> {
  await page
    .getByLabel("Workspace commands", { exact: true })
    .getByText("Source & release", { exact: true })
    .click();
  await expect(publication(page)).toBeHidden();
}

async function setText(page: Page, label: string): Promise<void> {
  await inspector(page).getByRole("textbox", { name: "Text", exact: true }).fill(label);
  await inspector(page).getByRole("button", { name: "Apply Text", exact: true }).click();
  await expect(inspector(page).getByRole("status")).toContainText("Updated Text.");
}

async function save(page: Page, generation: number): Promise<void> {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/v1/sources/account-app-source",
  );
  await persistence(page).getByRole("button", { name: "Save source", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(persistence(page).getByRole("status")).toContainText(
    `Source saved successfully. Generation ${String(generation)}.`,
  );
}

async function publish(page: Page, channelGeneration: number): Promise<string> {
  const responses = [
    page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /^\/v1\/bundles\/sha256:[0-9a-f]{64}$/u.test(new URL(response.url()).pathname),
    ),
    page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/v1/channels/preview",
    ),
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/v1/activate-published-revision",
    ),
  ];
  await publication(page).getByRole("button", { name: "Publish", exact: true }).click();
  for (const response of await Promise.all(responses)) expect(response.ok()).toBe(true);
  await expect(publication(page).getByRole("status")).toContainText(
    "is active in the reference host.",
  );
  const entries = publication(page).locator("dl > div");
  await expect(entries.filter({ has: page.locator("dt", { hasText: /^Channel$/u }) })).toHaveText(
    `Channelg${String(channelGeneration)}`,
  );
  const revision = await entries
    .filter({ has: page.locator("dt", { hasText: /^Revision$/u }) })
    .locator("dd")
    .getAttribute("title");
  expect(revision).toMatch(/^sha256:[0-9a-f]{64}$/u);
  if (revision === null) throw new TypeError("Expected the published revision identity.");
  return revision;
}

async function reloadHost(host: Page, label: string): Promise<unknown> {
  const delivered = host.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/__desen/runtime/refresh",
  );
  await host.reload();
  const response = await delivered;
  expect(response.ok()).toBe(true);
  const body = record((await response.json()) as unknown);
  await expect(host.getByText(label, { exact: true })).toBeVisible();
  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();
  return body.activation;
}

async function hostBuildFingerprint(request: APIRequestContext): Promise<string> {
  const index = await (await request.get(`${HOST_ORIGIN}/`, { failOnStatusCode: true })).body();
  const assets = [...index.toString("utf8").matchAll(/(?:src|href)="(\/assets\/[^"]+)"/gu)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
    .sort();
  expect(assets.some((asset) => asset.endsWith(".js"))).toBe(true);
  expect(assets.some((asset) => asset.endsWith(".css"))).toBe(true);
  const hash = createHash("sha256").update(index);
  for (const asset of assets) {
    hash.update(asset);
    hash.update(
      await (await request.get(`${HOST_ORIGIN}${asset}`, { failOnStatusCode: true })).body(),
    );
  }
  return hash.digest("hex");
}

const NEGATIVE_CASES = [
  {
    name: "prop",
    code: "PROP_TYPE_MISMATCH",
    pointer: `${TEXT_POINTER}/props/text`,
    target: `Select Node node.text at ${TEXT_POINTER}`,
    node: "node.text",
    mutate(source: Record<string, unknown>) {
      record(firstText(source).props).text = 42;
    },
  },
  {
    name: "event",
    code: "UNKNOWN_EVENT",
    pointer: `${TEXT_POINTER}/on/teleport`,
    target: `Select Node node.text at ${TEXT_POINTER}`,
    node: "node.text",
    mutate(source: Record<string, unknown>) {
      firstText(source).on = { teleport: [] };
    },
  },
  {
    name: "slot",
    code: "UNKNOWN_SLOT",
    pointer: "/surfaces/sign-in/root/slots/ghost",
    target: "Select Node sign-in.layout at /surfaces/sign-in/root",
    node: "sign-in.layout",
    mutate(source: Record<string, unknown>) {
      record(root(source).slots).ghost = [];
    },
  },
] as const;

test("rejects advanced prop, event, and slot candidates with node links before any publication", async ({
  context,
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (requested) => {
    const path = new URL(requested.url()).pathname;
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(requested.method()) &&
      (path.startsWith("/v1/sources/") ||
        path.startsWith("/v1/bundles/") ||
        path.startsWith("/v1/channels/") ||
        path === "/v1/activate-published-revision")
    ) {
      writes.push(`${requested.method()} ${path}`);
    }
  });
  const host = await context.newPage();
  host.on("pageerror", (error) => pageErrors.push(error.message));
  await host.goto(`${HOST_ORIGIN}/home`);
  await expect(
    host.getByRole("heading", { name: "Waiting for verified activation." }),
  ).toBeVisible();
  const buildIdentity = await hostBuildFingerprint(request);

  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Create a project" })
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/account-app\/surfaces\/sign-in$/u);
  for (const [index, label] of [BASELINE_LABEL, STABLE_LABEL].entries()) {
    await page
      .getByRole("button", {
        name: `Insert Text into Stack sign-in.layout default slot at position ${String(index + 1)}`,
        exact: true,
      })
      .click();
    await setText(page, label);
  }
  await openRelease(page);
  await save(page, 2);
  let activeRevision = await publish(page, 1);
  let activeLabel = BASELINE_LABEL;
  let activeIdentity = await reloadHost(host, activeLabel);
  expect(record(activeIdentity).revision).toBe(activeRevision);

  for (const [index, negative] of NEGATIVE_CASES.entries()) {
    await test.step(`Explicit Advanced Source negative fixture: invalid ${negative.name}`, async () => {
      const currentSource = await openDraft(page);
      const candidate = record(JSON.parse(currentSource) as unknown);
      negative.mutate(candidate);
      const writesBefore = [...writes];
      await draft(page)
        .getByRole("textbox", { name: "Source JSON draft" })
        .fill(JSON.stringify(candidate, null, 2));
      await draft(page)
        .getByRole("button", { name: "Validate and apply Source", exact: true })
        .click();
      await expect(draft(page)).toHaveAttribute("data-source-draft-state", "rejected");
      await expect(draft(page)).toContainText("Publisher stopped at");
      await page.screenshot({
        path: test.info().outputPath(`rejected-${negative.name}-advanced-input.png`),
      });
      await closeRelease(page);
      const diagnostics = page.getByRole("region", { name: "Validation diagnostics" });
      await expect(diagnostics.getByText(negative.code, { exact: true })).toBeVisible();
      await expect(diagnostics.getByText(negative.pointer, { exact: true })).toBeVisible();
      await diagnostics.getByRole("button", { name: negative.target, exact: true }).click();
      await expect(
        inspector(page)
          .getByRole("tabpanel", { name: "Inspector", exact: true })
          .locator("small")
          .filter({ hasText: new RegExp(`^${negative.node.replaceAll(".", "\\.")}$`, "u") }),
      ).toBeVisible();
      await page.screenshot({
        path: test.info().outputPath(`rejected-${negative.name}-node-diagnostics.png`),
      });
      await expect(
        page.locator('[data-managed-capability-subtree="true"]').getByText(activeLabel, {
          exact: true,
        }),
      ).toBeVisible();
      await openRelease(page);
      await expect(
        publication(page).getByRole("button", { name: "Publish", exact: true }),
      ).toBeDisabled();
      await expect(
        persistence(page).getByRole("button", { name: "Save source", exact: true }),
      ).toBeDisabled();
      await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
      expect(await reloadHost(host, activeLabel)).toEqual(activeIdentity);
      expect(writes).toEqual(writesBefore);

      // The invalid candidate is entered through the real, visible advanced editor, never through
      // injected Source, intercepted requests, hidden DOM mutation, or a proof-only product route.
      const repaired = record(JSON.parse(currentSource) as unknown);
      const repairedLabel = `Repaired ${negative.name} checkout`;
      record(firstText(repaired).props).text = repairedLabel;
      await draft(page)
        .getByRole("textbox", { name: "Source JSON draft" })
        .fill(JSON.stringify(repaired, null, 2));
      await draft(page)
        .getByRole("button", { name: "Validate and apply Source", exact: true })
        .click();
      await expect(draft(page)).toHaveAttribute("data-source-draft-state", "closed");
      await expect(draft(page).getByRole("status")).toHaveText(
        "Source applied locally. Save source, then Publish to update the host.",
      );
      await expect(
        page.locator('[data-managed-capability-subtree="true"]').getByText(repairedLabel, {
          exact: true,
        }),
      ).toBeVisible();
      expect(writes).toEqual(writesBefore);
      await openRelease(page);
      await expect(
        publication(page).getByRole("button", { name: "Publish", exact: true }),
      ).toBeDisabled();
      await save(page, index + 3);
      const nextRevision = await publish(page, index + 2);
      expect(nextRevision).not.toBe(activeRevision);
      activeLabel = repairedLabel;
      activeRevision = nextRevision;
      activeIdentity = await reloadHost(host, activeLabel);
      expect(record(activeIdentity).revision).toBe(activeRevision);
    });
  }

  const savedSource = await openDraft(page);
  const writesBeforeDiscard = [...writes];
  await draft(page).getByRole("textbox", { name: "Source JSON draft" }).fill("{");
  await draft(page).getByRole("button", { name: "Discard Source draft", exact: true }).click();
  await expect(draft(page)).toHaveAttribute("data-source-draft-state", "closed");
  await openRelease(page);
  await expect(
    publication(page).getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
  await expect(
    persistence(page).getByRole("button", { name: "Save source", exact: true }),
  ).toBeDisabled();
  expect(await openDraft(page)).toBe(savedSource);
  expect(await reloadHost(host, activeLabel)).toEqual(activeIdentity);
  expect(writes).toEqual(writesBeforeDiscard);
  expect(await hostBuildFingerprint(request)).toBe(buildIdentity);
  expect(pageErrors).toEqual([]);
  await closeRelease(page);
  await page.screenshot({ path: test.info().outputPath("invalid-publication-repaired.png") });
  await host.screenshot({ path: test.info().outputPath("invalid-publication-repaired-host.png") });
});
