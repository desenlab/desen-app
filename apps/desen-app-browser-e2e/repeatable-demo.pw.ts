import { fork } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  DEMO_LABELS,
  DEMO_OPERATION_ALIAS,
  authorRepeatableDemo,
  exerciseRealCredentials,
  exerciseRepeatableDemo,
  observeDemoWrites,
  publishRepeatableDemo,
  readDemoHostFingerprint,
  updateRepeatableDemo,
} from "./repeatable-demo-authoring.js";

import type { ChildProcess } from "node:child_process";
import type { BrowserContext, Page, Video } from "@playwright/test";
import type { DemoPublication } from "./repeatable-demo-authoring.js";

const CHILD_PATH = resolve(import.meta.dirname, "repeatable-demo-proof-server.mjs");
const APP_ORIGIN = "http://127.0.0.1:5173";

const REPEATABLE_DEMO_EVIDENCE = Object.freeze({
  profile: "desen.app.repeatable-demo-browser.v1",
  seed: "normal-empty-project-bootstrap",
  reset: "same-owned-normal-demo-lifecycle",
  cycles: 2,
  positiveInput: "normal-product-visible-authoring",
  nativeGestures: ["component-insertion", "layer-reordering"],
  operationAlias: DEMO_OPERATION_ALIAS,
  runtime: [
    "synthetic-pending",
    "synthetic-failure",
    "synthetic-success",
    "integration-401",
    "integration-200",
  ],
  delivery: [
    "save",
    "publish",
    "activate",
    "independent-host-401",
    "independent-host-200",
    "label-layout-republish",
  ],
  equality: [
    "canonical-source-A",
    "canonical-source-B",
    "canonical-bundle-A",
    "canonical-bundle-B",
  ],
  unchangedHostBuildWithinEachCycle: true,
});

interface DemoComposition {
  readonly pid: number;
  readonly hostOrigin: string;
  readonly close: () => Promise<void>;
}

async function waitForChildExit(child: ChildProcess, exit: Promise<number | null>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const code = await Promise.race([
      exit,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("The owned demo composition did not stop.")),
          5_000,
        );
      }),
    ]);
    if (code !== 0 || child.signalCode !== null)
      throw new Error("The owned demo composition did not stop cleanly.");
  } finally {
    clearTimeout(timer);
  }
}

async function startDemoComposition(): Promise<DemoComposition> {
  const child = fork(CHILD_PATH, [], {
    cwd: resolve(import.meta.dirname, "../.."),
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    serialization: "json",
  });
  const exit = new Promise<number | null>((resolveExit) => {
    child.once("exit", (code) => resolveExit(code));
    child.once("error", () => resolveExit(1));
  });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      if (child.connected && child.exitCode === null && child.signalCode === null)
        child.send({ command: "shutdown" }, () => undefined);
      await waitForChildExit(child, exit);
    } catch {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      // Emergency cleanup remains a failure. Never terminate a process found merely by port.
      await waitForChildExit(child, exit).catch(() => undefined);
      throw new Error("The demo proof required emergency owned-child cleanup.");
    }
  };

  try {
    return await new Promise<DemoComposition>((resolveReady, rejectReady) => {
      const deadline = setTimeout(fail, 60_000);
      function cleanup(): void {
        clearTimeout(deadline);
        child.off("message", receive);
        child.off("exit", fail);
        child.off("error", fail);
      }
      function fail(): void {
        cleanup();
        rejectReady(new Error("The normal demo reset/start did not become ready."));
      }
      function receive(value: unknown): void {
        if (value === null || typeof value !== "object") return fail();
        const reply = value as Record<string, unknown>;
        if (
          Object.keys(reply).length !== 4 ||
          reply.status !== "ready" ||
          reply.pid !== child.pid ||
          reply.appOrigin !== APP_ORIGIN ||
          typeof reply.referenceHostOrigin !== "string" ||
          !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/u.test(reply.referenceHostOrigin)
        )
          return fail();
        cleanup();
        resolveReady(
          Object.freeze({ pid: reply.pid as number, hostOrigin: reply.referenceHostOrigin, close }),
        );
      }
      child.on("message", receive);
      child.once("exit", fail);
      child.once("error", fail);
    });
  } catch {
    await close();
    throw new Error("The normal demo composition could not start.");
  }
}

async function openPublishedHost(
  context: BrowserContext,
  origin: string,
  label: string,
  revision: string,
): Promise<Readonly<{ page: Page; assertHealthy: () => void }>> {
  const page = await context.newPage();
  let pageErrors = 0;
  page.on("pageerror", () => {
    pageErrors += 1;
  });
  const delivered = page.waitForRequest(
    (candidate) =>
      candidate.frame() === page.mainFrame() &&
      candidate.method() === "POST" &&
      candidate.url() === `${origin}/__desen/runtime/refresh`,
  );
  await page.goto(`${origin}/`);
  const hostRequest = await delivered;
  const response = await hostRequest.response();
  if (response === null)
    throw new Error("The fresh host document received no activation response.");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/json");
  const identity = /^"desen-active:g:(0|[1-9][0-9]*):(sha256:[0-9a-f]{64})"$/u.exec(
    response.headers().etag ?? "",
  );
  expect(identity?.[2]).toBe(revision);
  // Product code must read/validate its bounded body and ETag before this fresh DOM can mount.
  await expect(page.locator('[data-desen-host-state="surface"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  return Object.freeze({
    page,
    assertHealthy: () =>
      expect(pageErrors, "The independent host had no uncaught browser error").toBe(0),
  });
}

async function labelGap(page: Page, label: string): Promise<number> {
  const title = await page.getByRole("heading", { name: label, exact: true }).boundingBox();
  const email = await page.getByRole("textbox", { name: "Email", exact: true }).boundingBox();
  if (title === null || email === null)
    throw new Error("The managed host has no measurable title/input layout.");
  return email.y - (title.y + title.height);
}

test("recreates one visible Flow demo with identical canonical publications across two normal resets", async ({
  browser,
  contextOptions,
  request,
}, testInfo) => {
  const evidence: {
    pid: number;
    sourceA: string;
    sourceB: string;
    revisionA: string;
    revisionB: string;
    hostBuild: string;
    gapA: number;
    gapB: number;
  }[] = [];
  const exact: { initial: DemoPublication; updated: DemoPublication }[] = [];
  const videos: Video[] = [];
  let composition: DemoComposition | undefined;
  let context: BrowserContext | undefined;
  let failed = false;
  let stage = "initial";
  try {
    for (const cycle of [1, 2]) {
      stage = `cycle-${cycle}:reset-start`;
      composition = await startDemoComposition();
      if (evidence.length > 0) expect(composition.pid).not.toBe(evidence[0]?.pid);
      context = await browser.newContext({
        ...contextOptions,
        baseURL: APP_ORIGIN,
        viewport: { width: 1_600, height: 1_000 },
        colorScheme: "light",
        locale: "en-US",
        timezoneId: "UTC",
        recordVideo: {
          dir: testInfo.outputPath(`cycle-${cycle}-video`),
          size: { width: 1_600, height: 1_000 },
        },
      });
      context.on("page", (page) => {
        const video = page.video();
        if (video !== null) videos.push(video);
      });
      const page = await context.newPage();
      const writes = observeDemoWrites(page);
      const screenshot = async (name: string, target: Page) => {
        await target.screenshot({ path: testInfo.outputPath(`cycle-${cycle}-${name}.png`) });
      };
      stage = `cycle-${cycle}:visible-authoring`;
      await authorRepeatableDemo(page);
      stage = `cycle-${cycle}:synthetic-and-integration`;
      await exerciseRepeatableDemo(page, writes, screenshot);
      stage = `cycle-${cycle}:initial-publication`;
      const baselineRevision = await publishRepeatableDemo(page, 3, 1);
      const initial = writes.publication();
      expect(initial.revision).toBe(baselineRevision);
      const hostBuild = await readDemoHostFingerprint(request, composition.hostOrigin);
      stage = `cycle-${cycle}:independent-host`;
      const initialDelivery = await openPublishedHost(
        context,
        composition.hostOrigin,
        DEMO_LABELS.initial,
        baselineRevision,
      );
      const initialHost = initialDelivery.page;
      const gapA = await labelGap(initialHost, DEMO_LABELS.initial);
      let hostCalls = 0;
      initialHost.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/sign-in")
          hostCalls += 1;
      });
      await exerciseRealCredentials(
        initialHost,
        initialHost.locator('[data-desen-host-state="surface"]'),
        initialHost.getByText(DEMO_LABELS.destination, { exact: true }).locator(".."),
      );
      await expect(initialHost).toHaveURL(`${composition.hostOrigin}/result`);
      await screenshot("published-host-success", initialHost);
      initialDelivery.assertHealthy();
      expect(hostCalls).toBe(2);

      stage = `cycle-${cycle}:visible-republication`;
      await updateRepeatableDemo(page);
      const updatedRevision = await publishRepeatableDemo(page, 4, 2);
      const updated = writes.publication();
      expect(updated.revision).toBe(updatedRevision);
      expect(updatedRevision).not.toBe(baselineRevision);
      expect(initial.sourceBytes === updated.sourceBytes).toBe(false);
      expect(initial.bundleBytes === updated.bundleBytes).toBe(false);
      const updatedDelivery = await openPublishedHost(
        context,
        composition.hostOrigin,
        DEMO_LABELS.updated,
        updatedRevision,
      );
      const updatedHost = updatedDelivery.page;
      await expect(updatedHost.getByText(DEMO_LABELS.initial, { exact: true })).toHaveCount(0);
      const gapB = await labelGap(updatedHost, DEMO_LABELS.updated);
      expect(gapB).toBeGreaterThan(gapA + 8);
      expect(await readDemoHostFingerprint(request, composition.hostOrigin)).toBe(hostBuild);
      await screenshot("republished-host", updatedHost);
      await screenshot("final-design", page);
      updatedDelivery.assertHealthy();
      writes.assertHealthy();
      expect(writes.operationCalls()).toBe(2);
      expect(writes.sourceWrites()).toBe(4);
      exact.push({ initial, updated });
      evidence.push({
        pid: composition.pid,
        sourceA: initial.sourceSha256,
        sourceB: updated.sourceSha256,
        revisionA: initial.revision,
        revisionB: updated.revision,
        hostBuild,
        gapA,
        gapB,
      });
      stage = `cycle-${cycle}:orderly-shutdown`;
      await context.close();
      context = undefined;
      await composition.close();
      composition = undefined;
    }
    stage = "exact-cross-cycle-equality";
    expect(exact.length).toBe(2);
    // Exact strings are compared without rewriting timestamps, IDs, order or authoring metadata.
    // Only booleans reach assertion output, so a mismatch cannot dump Source or Bundle contents.
    expect(exact[0]?.initial.sourceBytes === exact[1]?.initial.sourceBytes).toBe(true);
    expect(exact[0]?.initial.bundleBytes === exact[1]?.initial.bundleBytes).toBe(true);
    expect(exact[0]?.updated.sourceBytes === exact[1]?.updated.sourceBytes).toBe(true);
    expect(exact[0]?.updated.bundleBytes === exact[1]?.updated.bundleBytes).toBe(true);
  } catch {
    failed = true;
    if (context !== undefined) {
      for (const [index, page] of context.pages().entries()) {
        if (!page.isClosed())
          await page
            .screenshot({ path: testInfo.outputPath(`failure-page-${index}.png`) })
            .catch(() => undefined);
      }
    }
    throw new Error(`The repeatable normal-product demo stopped at ${stage}.`);
  } finally {
    await context?.close().catch(() => undefined);
    await composition?.close();
    await testInfo.attach("repeatable-demo-receipt", {
      body: JSON.stringify(
        {
          ...REPEATABLE_DEMO_EVIDENCE,
          completedCycles: evidence,
          failedStage: failed ? stage : null,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    if (!failed && testInfo.status === testInfo.expectedStatus)
      for (const video of videos) await video.delete();
  }
});
