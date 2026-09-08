import { createHash } from "node:crypto";

import { canonicalizeJson } from "@desen/protocol";
import { expect } from "@playwright/test";

import type { APIRequestContext, Locator, Page } from "@playwright/test";

/** Explicit designer-owned invocation name; it is not an operation or endpoint authority. */
export const DEMO_OPERATION_ALIAS = "submitCredentials";
/** Stable authored text used to distinguish the two real publications. */
export const DEMO_LABELS = Object.freeze({
  initial: "Sign in to continue",
  updated: "Your workspace is ready",
  destination: "Welcome back",
  failure: "Check your email and password, then try again.",
});

/** Captured transport bytes stay in memory; only their digest projection may be attached. */
export interface DemoPublication {
  readonly sourceBytes: string;
  readonly bundleBytes: string;
  readonly sourceSha256: string;
  readonly bundleSha256: string;
  readonly revision: string;
}

/** Closed observation of normal browser writes, without interception or injected responses. */
export interface DemoWriteObserver {
  readonly sourceWrites: () => number;
  readonly operationCalls: () => number;
  readonly publication: () => DemoPublication;
  readonly assertHealthy: () => void;
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

function hierarchy(page: Page): Locator {
  return page.getByRole("region", { name: "Start layer hierarchy" });
}

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Observe bounded actual request bytes; no credentials, configuration or raw errors are retained. */
export function observeDemoWrites(page: Page): DemoWriteObserver {
  const sources: string[] = [];
  const bundles: string[] = [];
  let calls = 0;
  let invalidObservation = false;
  let pageErrors = 0;
  page.on("pageerror", () => {
    pageErrors += 1;
  });
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/api/sign-in") calls += 1;
    if (request.method() !== "PUT") return;
    const destination =
      pathname === "/v1/sources/flow-app-source"
        ? sources
        : /^\/v1\/bundles\/sha256:[0-9a-f]{64}$/u.test(pathname)
          ? bundles
          : null;
    if (destination === null) return;
    const bytes = request.postData();
    if (bytes === null || Buffer.byteLength(bytes) > 8 * 1_024 * 1_024 || destination.length >= 8) {
      invalidObservation = true;
      return;
    }
    destination.push(bytes);
  });

  return Object.freeze({
    sourceWrites: () => sources.length,
    operationCalls: () => calls,
    assertHealthy: () => {
      expect(invalidObservation, "Only bounded normal Source and Bundle writes were observed").toBe(
        false,
      );
      expect(pageErrors, "The normal App had no uncaught browser error").toBe(0);
    },
    publication: () => {
      const sourceBytes = sources.at(-1);
      const bundleBytes = bundles.at(-1);
      if (sourceBytes === undefined || bundleBytes === undefined)
        throw new Error("A visible Save and Publish must precede transport observation.");
      // Compare booleans, never raw bodies: failure reports must not serialize authored Source.
      let source: Record<string, unknown>;
      let bundle: Record<string, unknown>;
      try {
        source = JSON.parse(sourceBytes) as Record<string, unknown>;
        bundle = JSON.parse(bundleBytes) as Record<string, unknown>;
        expect(canonicalizeJson(source) === sourceBytes, "Saved Source is exactly canonical").toBe(
          true,
        );
        expect(
          canonicalizeJson(bundle) === bundleBytes,
          "Published Bundle is exactly canonical",
        ).toBe(true);
      } catch {
        throw new Error("Observed publication bytes are not canonical JSON.");
      }
      expect(source.id === "com.example.flow-app" && source.entry === "start").toBe(true);
      expect(bundle.id === source.id && bundle.entry === source.entry).toBe(true);
      expect(sourceBytes.includes(DEMO_OPERATION_ALIAS)).toBe(true);
      for (const forbidden of [
        "designer@example.test",
        "local-demo-pass",
        "local-host-user",
        "synthetic-only",
        "wrong-test-password",
        "http://127.0.0.1",
        "Bearer ",
        "__DESEN_APP_LOCAL_",
      ]) {
        expect(sourceBytes.includes(forbidden) || bundleBytes.includes(forbidden)).toBe(false);
      }
      const revision = bundle.revision;
      if (typeof revision !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(revision))
        throw new Error("The visible publication has no immutable revision identity.");
      return Object.freeze({
        sourceBytes,
        bundleBytes,
        sourceSha256: digest(sourceBytes),
        bundleSha256: digest(bundleBytes),
        revision,
      });
    },
  });
}

async function sourceControls(page: Page, open: boolean): Promise<void> {
  if ((await persistence(page).isVisible()) !== open)
    await page
      .getByLabel("Workspace commands", { exact: true })
      .getByText("Source & release", { exact: true })
      .click();
  await expect(persistence(page)).toBeVisible({ visible: open });
}

async function property(page: Page, name: string, value: string): Promise<void> {
  await inspector(page).getByRole("textbox", { name, exact: true }).fill(value);
  await inspector(page)
    .getByRole("button", { name: `Apply ${name}`, exact: true })
    .click();
  await expect(inspector(page).getByRole("status")).toContainText(`Updated ${name}.`);
}

async function insert(
  page: Page,
  surface: string,
  component: string,
  position: number,
): Promise<void> {
  await page
    .getByRole("button", {
      name: new RegExp(
        `^Insert ${component} into Stack ${surface}\\.layout default slot at position ${position}`,
        "u",
      ),
    })
    .click();
}

async function localState(page: Page, name: string): Promise<void> {
  await inspector(page).getByRole("tab", { name: "State", exact: true }).click();
  const state = inspector(page).getByRole("region", { name: "Local state" });
  await state.getByRole("textbox", { name: "New state name" }).fill(name);
  await state.getByRole("button", { name: "Add", exact: true }).click();
  await expect(state.getByRole("heading", { name, level: 3, exact: true })).toBeVisible();
  await inspector(page).getByRole("tab", { name: "Inspector", exact: true }).click();
}

async function connectInput(page: Page, state: string): Promise<void> {
  const connection = inspector(page).getByRole("region", { name: "Input connection" });
  await connection.getByRole("combobox", { name: "Input connection state" }).selectOption(state);
  await connection.getByRole("button", { name: "Connect input", exact: true }).click();
  await expect(connection.getByRole("status")).toContainText(
    `Connected Value and change to state.${state}.`,
  );
}

async function save(page: Page, generation: number): Promise<void> {
  await sourceControls(page, true);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/v1/sources/flow-app-source",
  );
  await persistence(page).getByRole("button", { name: "Save source", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(persistence(page).getByRole("status")).toContainText(
    `Source saved successfully. Generation ${generation}.`,
  );
  await sourceControls(page, false);
}

async function openSurface(page: Page, name: "Start" | "Result"): Promise<void> {
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Flow app", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Flow app surfaces" })
    .getByRole("link", { name: new RegExp(`^${name}`, "u") })
    .click();
  await expect(page.getByRole("heading", { name, level: 2, exact: true })).toBeVisible();
}

/** Build both surfaces from New project using the ordinary constrained designer controls. */
export async function authorRepeatableDemo(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Local workspace" }).selectOption("reference-flow-web");
  await expect(page.getByRole("status").filter({ hasText: "0 projects" })).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await expect(dialog.getByRole("radio", { name: /Blank Flow app project/u })).toBeChecked();
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/flow-app\/surfaces\/start$/u);

  await openSurface(page, "Result");
  await insert(page, "result", "Text", 1);
  await property(page, "Text", DEMO_LABELS.destination);
  await save(page, 2);
  await openSurface(page, "Start");
  await localState(page, "email");
  await localState(page, "password");

  const title = page.getByRole("group", {
    name: /^Text component · drag to Stack start\.layout default slot/u,
  });
  const target = page.getByRole("group", {
    name: /^Placement target · Stack start\.layout default slot/u,
  });
  await title.locator("[data-component-drag-handle='true']").dragTo(target);
  await property(page, "Text", DEMO_LABELS.initial);
  await inspector(page)
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption({ label: "heading" });

  await insert(page, "start", "Text field", 2);
  await property(page, "Label", "Email");
  await connectInput(page, "email");
  await insert(page, "start", "Button", 3);
  await property(page, "Label", "Continue");
  const connection = inspector(page).getByRole("region", { name: "Operation connection" });
  await connection
    .getByRole("textbox", { name: "Operation connection result name" })
    .fill(DEMO_OPERATION_ALIAS);
  await connection.getByRole("button", { name: "Connect operation", exact: true }).click();
  await expect(connection.getByRole("status")).toContainText(`operation.${DEMO_OPERATION_ALIAS}`);
  await inspector(page).getByRole("tab", { name: "Actions", exact: true }).click();
  const success = inspector(page).getByRole("region", { name: "Success", exact: true });
  await success.getByRole("button", { name: /^Add action to/u }).click();
  await success.getByRole("combobox", { name: /^New action type/u }).selectOption("navigate");
  await success.getByRole("combobox", { name: "Destination surface" }).selectOption("result");
  await success.getByRole("button", { name: "Add action", exact: true }).click();
  await inspector(page).getByRole("tab", { name: "Inspector", exact: true }).click();

  await insert(page, "start", "Text field", 4);
  await property(page, "Label", "Password");
  await inspector(page).getByRole("button", { name: "Set Secure", exact: true }).click();
  await inspector(page).getByRole("switch", { name: "Secure", exact: true }).check();
  await connectInput(page, "password");
  await page
    .locator('[data-layer-drop-row-node-id="node.textfield-2"] [data-layer-drag-handle="true"]')
    .dragTo(
      hierarchy(page).getByRole("listitem", {
        name: "Stack start.layout default slot insertion boundary at position 3",
        exact: true,
      }),
    );

  await insert(page, "start", "Alert", 5);
  await page
    .getByRole("complementary", { name: "Authoring panel" })
    .getByRole("button", { name: "Delete Alert layer · node.alert", exact: true })
    .click();
  await expect(hierarchy(page).getByText("node.alert", { exact: true })).toHaveCount(0);
  await insert(page, "start", "Alert", 5);
  await property(page, "Text", DEMO_LABELS.failure);
  await inspector(page)
    .getByRole("combobox", { name: "Tone", exact: true })
    .selectOption("critical");
  const visibility = inspector(page).getByRole("region", { name: "Layer visibility" });
  await visibility
    .getByRole("combobox", { name: "Layer visibility mode" })
    .selectOption("operation");
  await visibility
    .getByRole("combobox", { name: "Visibility operation result" })
    .selectOption(DEMO_OPERATION_ALIAS);
  await visibility
    .getByRole("combobox", { name: "Visibility operation status" })
    .selectOption("failed");
  await visibility.getByRole("button", { name: "Apply visibility", exact: true }).click();

  const layers = hierarchy(page).locator("[data-layer-source-node-id]");
  const ids: (string | null)[] = [];
  for (let index = 0; index < (await layers.count()); index += 1)
    ids.push(await layers.nth(index).getAttribute("data-layer-source-node-id"));
  expect(ids).toEqual([
    "start.layout",
    "node.text",
    "node.textfield",
    "node.textfield-2",
    "node.button",
    "node.alert",
  ]);
  const frame = page.locator("[data-canvas-frame]");
  await expect(frame).toHaveAttribute("data-canvas-frame-width", "420");
  await expect(frame).toHaveAttribute("data-canvas-frame-height", "720");
  await save(page, 3);
}

/** Run pending, public failure, synthetic success and explicit real Integration on the same Source. */
export async function exerciseRepeatableDemo(
  page: Page,
  writes: DemoWriteObserver,
  checkpoint: (name: string, page: Page) => Promise<void>,
): Promise<void> {
  const savedWrites = writes.sourceWrites();
  const canvas = page.getByRole("group", { name: "Managed start canvas" });
  const result = page.getByRole("group", { name: "Managed result canvas" });
  const frame = page.locator("[data-canvas-frame]");
  const designBounds = await frame.boundingBox();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const controls = page.getByRole("complementary", { name: "Run controls" });
  const operation = controls.getByRole("group", {
    name: `Operation ${DEMO_OPERATION_ALIAS}`,
    exact: true,
  });
  const outcome = operation.getByRole("combobox", {
    name: `Next outcome for ${DEMO_OPERATION_ALIAS}`,
    exact: true,
  });
  const complete = operation.getByRole("button", {
    name: `Complete ${DEMO_OPERATION_ALIAS} fixture`,
    exact: true,
  });
  await expect(controls.getByRole("radio", { name: /^Synthetic/u })).toBeChecked();
  await expect(controls.getByRole("radio", { name: /^Integration/u })).toBeEnabled();
  await expect(controls.getByRole("radio", { name: /^Production/u })).toBeDisabled();
  await outcome.selectOption("error:invalidCredentials");
  const email = canvas.getByRole("textbox", { name: "Email", exact: true });
  const password = canvas.getByLabel("Password", { exact: true });
  const submit = canvas.getByRole("button", { name: "Continue", exact: true });
  await email.pressSequentially("synthetic@example.test");
  await password.pressSequentially("synthetic-only");
  await expect(email).toHaveValue("synthetic@example.test");
  await expect(password).toHaveValue("synthetic-only");
  await expect(password).toHaveAttribute("type", "password");
  await submit.click();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toHaveAttribute("aria-disabled", "true");
  await expect(canvas.getByRole("alert")).toHaveCount(0);
  await expect(operation.getByRole("status")).toHaveText(
    "Pending · complete this fixture to settle the Runtime call.",
  );
  await checkpoint("synthetic-pending", page);
  await complete.click();
  await expect(canvas.getByRole("alert")).toHaveText(DEMO_LABELS.failure);
  await expect(submit).not.toHaveAttribute("aria-busy");
  expect(await frame.boundingBox()).toEqual(designBounds);
  await checkpoint("synthetic-failure", page);
  await outcome.selectOption("success");
  await submit.click();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(canvas.getByRole("alert")).toHaveCount(0);
  await complete.click();
  await expect(result.getByText(DEMO_LABELS.destination, { exact: true })).toBeVisible();
  expect(writes.operationCalls()).toBe(0);
  expect(writes.sourceWrites()).toBe(savedWrites);
  expect(await frame.boundingBox()).toEqual(designBounds);

  await controls.getByRole("button", { name: "Restart run", exact: true }).click();
  await controls.getByRole("radio", { name: /^Integration/u }).check();
  await expect(controls.getByRole("combobox", { name: /^Next outcome/u })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: /fixture/u })).toHaveCount(0);
  await exerciseRealCredentials(page, canvas, result);
  expect(writes.operationCalls()).toBe(2);
  expect(writes.sourceWrites()).toBe(savedWrites);
  expect(await frame.boundingBox()).toEqual(designBounds);
  await checkpoint("integration-success", page);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(canvas).toBeVisible();
  await expect(email).toHaveValue("");
  await expect(email).toBeDisabled();
  await page.reload();
  await expect(
    canvas.getByRole("heading", { name: DEMO_LABELS.initial, exact: true }),
  ).toBeVisible();
  await expect(email).toHaveValue("");
  expect(writes.sourceWrites()).toBe(savedWrites);
  writes.assertHealthy();
}

/** Exercise the application's real same-origin/local operation responses without mock transport. */
export async function exerciseRealCredentials(
  page: Page,
  start: Locator,
  result: Locator,
): Promise<void> {
  const email = start.getByRole("textbox", { name: "Email", exact: true });
  const password = start.getByLabel("Password", { exact: true });
  const submit = start.getByRole("button", { name: "Continue", exact: true });
  await email.pressSequentially("designer@example.test");
  await password.pressSequentially("wrong-test-password");
  const denied = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/sign-in" && response.request().method() === "POST",
  );
  await submit.click();
  expect((await denied).status()).toBe(401);
  await expect(start.getByRole("alert")).toHaveText(DEMO_LABELS.failure);
  await expect(result).toHaveCount(0);
  await expect(email).toHaveValue("designer@example.test");
  await password.fill("local-demo-pass");
  const succeeded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/sign-in" && response.request().method() === "POST",
  );
  await submit.click();
  expect((await succeeded).status()).toBe(200);
  await expect(result.getByText(DEMO_LABELS.destination, { exact: true })).toBeVisible();
}

/** Publish the exact saved Source through all three ordinary product boundaries. */
export async function publishRepeatableDemo(
  page: Page,
  sourceGeneration: number,
  channelGeneration: number,
): Promise<string> {
  await sourceControls(page, true);
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
  const receipt: Record<string, string> = {};
  for (let index = 0; index < (await entries.count()); index += 1) {
    const item = entries.nth(index);
    const key = (await item.locator("dt").innerText()).trim();
    receipt[key] = (await item.locator("dd").innerText()).trim();
    if (key === "Revision")
      receipt.Revision = (await item.locator("dd").getAttribute("title")) ?? "";
  }
  expect(receipt.Source).toBe(`g${sourceGeneration}`);
  expect(receipt.Channel).toBe(`g${channelGeneration}`);
  expect(receipt.Revision).toMatch(/^sha256:[0-9a-f]{64}$/u);
  await sourceControls(page, false);
  return receipt.Revision ?? "";
}

/** Make the second publication solely through visible label and layout controls. */
export async function updateRepeatableDemo(page: Page): Promise<void> {
  await hierarchy(page)
    .getByRole("button", { name: "Select Text layer · node.text", exact: true })
    .click();
  await property(page, "Text", DEMO_LABELS.updated);
  await hierarchy(page)
    .getByRole("button", { name: "Select Stack layer · start.layout", exact: true })
    .click();
  await inspector(page)
    .getByRole("combobox", { name: "Gap", exact: true })
    .selectOption({ label: "xl" });
  await expect(inspector(page).getByRole("status")).toContainText("Updated Gap.");
  await save(page, 4);
}

/** Read the independent host's served build identity, never its configuration or secret headers. */
export async function readDemoHostFingerprint(
  request: APIRequestContext,
  origin: string,
): Promise<string> {
  const index = await (await request.get(`${origin}/`, { failOnStatusCode: true })).body();
  const assets = [...index.toString("utf8").matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/gu)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
    .sort();
  expect(assets.some((asset) => asset.endsWith(".js"))).toBe(true);
  expect(assets.some((asset) => asset.endsWith(".css"))).toBe(true);
  const hash = createHash("sha256").update(index);
  for (const asset of assets) {
    hash.update(asset);
    hash.update(await (await request.get(`${origin}${asset}`, { failOnStatusCode: true })).body());
  }
  return hash.digest("hex");
}
