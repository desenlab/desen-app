import { fork } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test as base } from "@playwright/test";

import type { ChildProcess } from "node:child_process";
import type { BrowserContext, Locator, Page, Video } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:4179";
const HOST_ORIGIN = "http://127.0.0.1:4180";
const PROJECT_PATH = "/projects/account-app/surfaces/sign-in";
const BASELINE_LABEL = "First verified checkout";
const CURRENT_LABEL = "Current verified checkout";
const FINAL_LABEL = "Recovered checkout ready";
const STABLE_LABEL = "Only verified releases reach this host";
const CHILD_PATH = resolve(import.meta.dirname, "restart-recovery-proof-server.mjs");

const RESTART_RECOVERY_EVIDENCE = Object.freeze({
  profile: "desen.app.last-known-good-recovery-browser.v1",
  positiveInput: "normal-product-visible-authoring",
  negativeInput: "isolated-ipc-authenticated-bundle-put-and-channel-cas",
  restart: "full-composition-new-pid-and-fresh-browser-context",
  cases: ["corrupt-revision", "catalog-mismatch"],
  preserved: [
    "active-revision",
    "previous-good-revision",
    "activation-generation",
    "saved-source",
    "app-source",
    "host-build",
  ],
  invalidChannelRemainsSelected: true,
  appConfiguration: "normal-entry-rebuilt-for-fresh-launcher-origin",
  finalValidPublication: true,
});

interface ActivationRecord {
  readonly activeRevision: string;
  readonly previousGoodRevision: string | null;
  readonly generation: number;
}

interface ReadyReceipt {
  readonly pid: number;
  readonly ports: Readonly<{ controlPlane: number; activation: number }>;
  readonly builds: Readonly<{ app: string; host: string }>;
  readonly activeRecord: ActivationRecord | null;
  readonly appSource: string;
}

interface Observation {
  readonly pid: number;
  readonly channel: Readonly<{ channelName: "preview"; generation: number; revision: string }>;
  readonly activeRecord: ActivationRecord;
  readonly source: Readonly<{ etag: string; sha256: string }>;
  readonly candidate:
    | Readonly<{ status: "verified" }>
    | Readonly<{ status: "rejected"; stage: string; codes: readonly string[] }>;
  readonly builds: ReadyReceipt["builds"];
  readonly appSource: string;
}

type NegativeCase = "corrupt-revision" | "catalog-mismatch";
type NegativeReceipt = Observation &
  Readonly<{ kind: NegativeCase; bundlePutStatus: number; channelPutStatus: number }>;
type ChildCommand = "boot" | "observe" | "install-negative" | "shutdown";

interface RecoveryComposition {
  readonly initial: ReadyReceipt;
  readonly observe: () => Promise<Observation>;
  readonly installNegative: (kind: NegativeCase) => Promise<NegativeReceipt>;
  readonly restart: () => Promise<ReadyReceipt>;
  readonly close: () => Promise<void>;
}

async function createRecoveryComposition(): Promise<RecoveryComposition> {
  const controlPlaneToken = randomBytes(32).toString("base64url");
  const activationToken = randomBytes(32).toString("base64url");
  if (controlPlaneToken === activationToken)
    throw new Error("Independent proof credentials collided.");
  const root = await realpath(await mkdtemp(join(tmpdir(), "desen-restart-browser-proof-")));
  let child: ChildProcess | undefined;
  let exited: Promise<Readonly<{ code: number | null; signal: string | null }>> | undefined;
  let requestId = 0;
  let pending = false;
  let idle: Promise<void> = Promise.resolve();
  let terminating = false;
  let closed = false;
  let latest: ReadyReceipt | undefined;

  function launch(): void {
    requestId = 0;
    child = fork(CHILD_PATH, [], {
      cwd: resolve(import.meta.dirname, "../.."),
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      serialization: "json",
    });
    const launched = child;
    exited = new Promise((resolveExit) => {
      launched.once("exit", (code, signal) => resolveExit({ code, signal }));
      launched.once("error", () => resolveExit({ code: 1, signal: null }));
    });
  }

  async function command<T>(name: ChildCommand, payload: unknown = null): Promise<T> {
    const current = child;
    if (
      closed ||
      (terminating && name !== "shutdown") ||
      pending ||
      current === undefined ||
      !current.connected
    ) {
      throw new Error("Recovery proof child is not available for one serialized command.");
    }
    pending = true;
    let releaseIdle: () => void = () => undefined;
    idle = new Promise<void>((resolveIdle) => {
      releaseIdle = resolveIdle;
    });
    requestId += 1;
    const id = requestId;
    try {
      return await new Promise<T>((resolveReply, rejectReply) => {
        const deadline = setTimeout(() => fail(), name === "boot" ? 60_000 : 20_000);
        const cleanup = () => {
          clearTimeout(deadline);
          current.off("message", receive);
          current.off("exit", fail);
          current.off("error", fail);
        };
        const fail = () => {
          cleanup();
          rejectReply(new Error(`The isolated recovery child failed during ${name}.`));
        };
        const receive = (message: unknown) => {
          if (message === null || typeof message !== "object") {
            fail();
            return;
          }
          const reply = message as {
            id?: unknown;
            status?: unknown;
            result?: unknown;
            stage?: unknown;
          };
          if (
            reply.id === id &&
            reply.status === "failed" &&
            typeof reply.stage === "string" &&
            /^(?:ipc|boot-(?:input|build-identity|control-plane|reference-host|activation-bridge|origin-identity|build-fingerprint|app-preview|active-record))$/u.test(
              reply.stage,
            )
          ) {
            cleanup();
            rejectReply(new Error(`The isolated recovery child stopped at ${reply.stage}.`));
            return;
          }
          if (
            reply.id !== id ||
            (reply.status !== "ok" && !(name === "shutdown" && reply.status === "stopped"))
          ) {
            fail();
            return;
          }
          cleanup();
          resolveReply(reply.result as T);
        };
        current.on("message", receive);
        current.once("exit", fail);
        current.once("error", fail);
        current.send({ id, command: name, payload }, (error) => {
          if (error !== null) fail();
        });
      });
    } finally {
      pending = false;
      releaseIdle();
    }
  }

  async function waitForExit(
    milliseconds: number,
  ): Promise<Readonly<{ code: number | null; signal: string | null }>> {
    if (exited === undefined) throw new Error("No owned recovery child exit is pending.");
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        exited,
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(
            () => reject(new Error("The owned recovery child did not exit.")),
            milliseconds,
          );
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
  }

  async function stop(): Promise<void> {
    if (child === undefined) return;
    if (child.exitCode === null && child.signalCode === null) {
      await command("shutdown");
    }
    const result = await waitForExit(5_000);
    if (result.code !== 0 || result.signal !== null)
      throw new Error("Recovery child did not stop cleanly.");
  }

  async function boot(resume: boolean): Promise<ReadyReceipt> {
    launch();
    const ready = await command<ReadyReceipt>("boot", {
      root,
      controlPlaneToken,
      activationToken,
      resume,
      ports: latest?.ports ?? null,
      builds: latest?.builds ?? null,
    });
    expect(ready.pid).toBe(child?.pid);
    if (latest !== undefined) {
      expect(ready.pid).not.toBe(latest.pid);
      expect(ready.ports.controlPlane).toBe(latest.ports.controlPlane);
      expect(ready.builds.host).toBe(latest.builds.host);
      expect(ready.appSource).toBe(latest.appSource);
    }
    latest = ready;
    return ready;
  }

  async function close(): Promise<void> {
    if (closed) return;
    terminating = true;
    // A test timeout does not cancel a Node IPC promise. Drain its existing finite deadline
    // before sending shutdown; never overlap commands or misclassify in-flight work as a leak.
    await idle;
    let failed = false;
    try {
      await stop();
    } catch {
      failed = true;
      // Failure cleanup targets only this exact owned child, never an origin/port or process tree.
      if (child !== undefined && child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await waitForExit(5_000);
    } finally {
      closed = true;
      // Do not delete live service storage if process termination could not be confirmed.
      if (child === undefined || child.exitCode !== null || child.signalCode !== null) {
        await rm(root, { recursive: true, force: true });
      }
    }
    if (failed) throw new Error("Recovery proof required emergency child cleanup.");
  }

  try {
    const initial = await boot(false);
    return Object.freeze({
      initial,
      observe: () => command<Observation>("observe"),
      installNegative: (kind: NegativeCase) => command<NegativeReceipt>("install-negative", kind),
      restart: async () => {
        await stop();
        return boot(true);
      },
      close,
    });
  } catch {
    await close();
    throw new Error("The isolated recovery composition could not start.");
  }
}

const test = base.extend<{ composition: RecoveryComposition }>({
  composition: [
    async ({ browserName }, use) => {
      expect(browserName).toBe("chromium");
      const composition = await createRecoveryComposition();
      try {
        await use(composition);
      } finally {
        await composition.close();
      }
    },
    { timeout: 75_000 },
  ],
});

function inspector(page: Page): Locator {
  return page.getByRole("complementary", { name: "Inspector" });
}
function publication(page: Page): Locator {
  return page.getByRole("region", { name: "Publish saved Source" });
}
function persistence(page: Page): Locator {
  return page.getByRole("region", { name: "Source persistence" });
}

async function toggleSourceAndRelease(page: Page, open: boolean): Promise<void> {
  await page
    .getByLabel("Workspace commands", { exact: true })
    .getByText("Source & release", { exact: true })
    .click();
  if (open) await expect(publication(page)).toBeVisible();
  else await expect(publication(page)).toBeHidden();
}

async function setText(page: Page, value: string): Promise<void> {
  await inspector(page).getByRole("textbox", { name: "Text", exact: true }).fill(value);
  await inspector(page).getByRole("button", { name: "Apply Text", exact: true }).click();
  await expect(inspector(page).getByRole("status")).toContainText("Updated Text.");
}

async function saveAndPublish(page: Page, generation: number): Promise<string> {
  await toggleSourceAndRelease(page, true);
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
  const bundle = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      /^\/v1\/bundles\/sha256:[0-9a-f]{64}$/u.test(new URL(response.url()).pathname),
  );
  const channel = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/v1/channels/preview",
  );
  const activated = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/v1/activate-published-revision",
  );
  await publication(page).getByRole("button", { name: "Publish", exact: true }).click();
  expect((await bundle).ok()).toBe(true);
  expect((await channel).ok()).toBe(true);
  expect((await activated).ok()).toBe(true);
  await expect(publication(page).getByRole("status")).toContainText(
    "is active in the reference host.",
  );
  const revision = await publication(page)
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: /^Revision$/u }) })
    .locator("dd")
    .getAttribute("title");
  expect(revision).toMatch(/^sha256:[0-9a-f]{64}$/u);
  await toggleSourceAndRelease(page, false);
  if (revision === null) throw new Error("Visible publication revision is missing.");
  return revision;
}

async function selectFirstText(page: Page): Promise<void> {
  await page
    .getByRole("region", { name: "Sign-in layer hierarchy" })
    .getByRole("button", { name: "Select Text layer · node.text", exact: true })
    .click();
}

async function openVerifiedHost(
  context: BrowserContext,
  label: string,
): Promise<Readonly<{ page: Page; identity: Readonly<{ generation: number; revision: string }> }>> {
  const page = await context.newPage();
  const delivered = page.waitForRequest(
    (candidate) =>
      candidate.frame() === page.mainFrame() &&
      candidate.method() === "POST" &&
      candidate.url() === `${HOST_ORIGIN}/__desen/runtime/refresh`,
  );
  await page.goto(`${HOST_ORIGIN}/home`);
  const hostRequest = await delivered;
  const response = await hostRequest.response();
  if (response === null)
    throw new Error("The fresh host document received no activation response.");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/json");
  const etag = /^"desen-active:g:(0|[1-9][0-9]*):(sha256:[0-9a-f]{64})"$/u.exec(
    response.headers().etag ?? "",
  );
  if (etag === null) throw new Error("The fresh host response has no exact activation identity.");
  const generation = Number(etag[1]);
  expect(Number.isSafeInteger(generation)).toBe(true);
  // This is a fresh document. Product code consumes and verifies the full bounded body and ETag
  // before it mounts a surface; a second CDP response-body copy is not activation authority.
  await expect(page.locator('[data-desen-host-state="surface"]')).toBeVisible();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByText(STABLE_LABEL, { exact: true })).toBeVisible();
  await expect(page.getByText(/Rejected (?:corrupt|Catalog) checkout/u)).toHaveCount(0);
  return { page, identity: { generation, revision: etag[2] ?? "" } };
}

test("preserves last-known-good across corrupt revision and Catalog mismatch through full cold restarts", async ({
  browser,
  contextOptions,
  composition,
}, testInfo) => {
  const evidence: unknown[] = [RESTART_RECOVERY_EVIDENCE, composition.initial];
  const errors: string[] = [];
  const initialMissing = new Set<string>();
  const videos: Video[] = [];
  let failed = false;
  let cleanupError: unknown;
  const createContext = async () => {
    const fresh = await browser.newContext({
      ...contextOptions,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { height: 1_000, width: 1_600 },
      recordVideo: {
        dir: testInfo.outputPath("video-recordings"),
        size: { height: 1_000, width: 1_600 },
      },
    });
    fresh.on("page", (opened) => {
      opened.on("pageerror", () => errors.push("A browser document reported an uncaught error."));
      opened.on("console", (message) => {
        if (message.type() !== "error") return;
        let path = "";
        try {
          path = new URL(message.location().url).pathname;
        } catch {
          /* Not a network location. */
        }
        if (
          ["/v1/sources/account-app-source", "/v1/channels/preview"].includes(path) &&
          !initialMissing.has(path) &&
          message.text() ===
            "Failed to load resource: the server responded with a status of 404 (Not Found)"
        ) {
          initialMissing.add(path);
          return;
        }
        errors.push("A browser document reported an unexpected console error.");
      });
      const video = opened.video();
      if (video !== null) videos.push(video);
    });
    return fresh;
  };
  let context = await createContext();
  let page = await context.newPage();
  try {
    await test.step("visually author and publish A then C with A as previous-good", async () => {
      expect(composition.initial.activeRecord).toBeNull();
      await page.goto(APP_ORIGIN);
      await page.getByRole("button", { name: "New project", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Create a project" })
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      await expect(page).toHaveURL(`${APP_ORIGIN}${PROJECT_PATH}`);
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
    });
    const revisionA = await saveAndPublish(page, 2);
    const first = await openVerifiedHost(context, BASELINE_LABEL);
    expect(first.identity).toEqual({ generation: 0, revision: revisionA });
    await first.page.close();
    await selectFirstText(page);
    await setText(page, CURRENT_LABEL);
    const revisionC = await saveAndPublish(page, 3);
    expect(revisionC).not.toBe(revisionA);
    const current = await openVerifiedHost(context, CURRENT_LABEL);
    expect(current.identity).toEqual({ generation: 1, revision: revisionC });
    await current.page.close();
    const baseline = await composition.observe();
    expect(baseline.activeRecord).toEqual({
      activeRevision: revisionC,
      previousGoodRevision: revisionA,
      generation: 1,
    });
    expect(baseline.channel).toEqual({
      channelName: "preview",
      generation: 2,
      revision: revisionC,
    });
    expect(baseline.candidate).toEqual({ status: "verified" });
    expect(baseline.builds).toEqual(composition.initial.builds);
    expect(baseline.appSource).toBe(composition.initial.appSource);
    evidence.push(baseline);
    let currentBuilds = baseline.builds;

    for (const [index, kind] of (["corrupt-revision", "catalog-mismatch"] as const).entries()) {
      await test.step(`${kind}: real Bundle PUT/CAS rejection and full cold restart preserve C/A`, async () => {
        const rejected = await composition.installNegative(kind);
        expect(rejected.bundlePutStatus).toBe(201);
        expect(rejected.channelPutStatus).toBe(200);
        expect(rejected.kind).toBe(kind);
        expect(rejected.channel.generation).toBe(3 + index);
        expect(rejected.channel.revision).not.toBe(revisionC);
        expect(rejected.activeRecord).toEqual(baseline.activeRecord);
        expect(rejected.source).toEqual(baseline.source);
        expect(rejected.builds).toEqual(currentBuilds);
        expect(rejected.appSource).toBe(baseline.appSource);
        expect(rejected.candidate).toEqual({
          status: "rejected",
          stage: kind === "corrupt-revision" ? "bundle-revision" : "package-digest",
          codes: [kind === "corrupt-revision" ? "REVISION_MISMATCH" : "CATALOG_DIGEST_MISMATCH"],
        });
        const preserved = await openVerifiedHost(context, CURRENT_LABEL);
        expect(preserved.identity).toEqual(current.identity);
        const beforeRestart = await composition.observe();
        expect(beforeRestart.channel).toEqual(rejected.channel);
        expect(beforeRestart.activeRecord).toEqual(baseline.activeRecord);
        await preserved.page.screenshot({ path: testInfo.outputPath(`${kind}-preserved.png`) });

        // Destroy all browser application state as well as every server process-local handle.
        await context.close();
        const restarted = await composition.restart();
        expect(restarted.pid).not.toBe(beforeRestart.pid);
        expect(restarted.activeRecord).toEqual(baseline.activeRecord);
        expect(restarted.builds.host).toBe(baseline.builds.host);
        expect(restarted.appSource).toBe(baseline.appSource);
        expect(restarted.ports.controlPlane).toBe(composition.initial.ports.controlPlane);
        currentBuilds = restarted.builds;
        context = await createContext();
        const recovered = await openVerifiedHost(context, CURRENT_LABEL);
        expect(recovered.identity).toEqual(current.identity);
        const afterRestart = await composition.observe();
        expect(afterRestart.pid).toBe(restarted.pid);
        expect(afterRestart.channel).toEqual(rejected.channel);
        expect(afterRestart.activeRecord).toEqual(baseline.activeRecord);
        expect(afterRestart.source).toEqual(baseline.source);
        expect(afterRestart.builds).toEqual(currentBuilds);
        expect(afterRestart.builds.host).toBe(baseline.builds.host);
        expect(afterRestart.appSource).toBe(baseline.appSource);
        expect(afterRestart.candidate).toEqual(rejected.candidate);
        await recovered.page.screenshot({
          path: testInfo.outputPath(`${kind}-cold-recovered.png`),
        });
        page = await context.newPage();
        await page.goto(`${APP_ORIGIN}${PROJECT_PATH}`);
        await expect(page.getByText(CURRENT_LABEL, { exact: true })).toBeVisible();
        await expect(page.getByText(STABLE_LABEL, { exact: true })).toBeVisible();
        evidence.push({
          kind,
          rejected,
          beforeRestart,
          restarted,
          afterRestart,
          identity: recovered.identity,
        });
      });
    }

    await test.step("normal App publishes valid D after recovery without changing App source or rebuilding the host", async () => {
      await selectFirstText(page);
      await setText(page, FINAL_LABEL);
      const revisionD = await saveAndPublish(page, 4);
      expect(revisionD).not.toBe(revisionC);
      const finalHost = await openVerifiedHost(context, FINAL_LABEL);
      expect(finalHost.identity).toEqual({ generation: 2, revision: revisionD });
      const final = await composition.observe();
      expect(final.channel).toEqual({ channelName: "preview", generation: 5, revision: revisionD });
      expect(final.activeRecord).toEqual({
        activeRevision: revisionD,
        previousGoodRevision: revisionC,
        generation: 2,
      });
      expect(final.candidate).toEqual({ status: "verified" });
      expect(final.source.etag).toBe('"g:4"');
      expect(final.source.sha256).not.toBe(baseline.source.sha256);
      expect(final.builds).toEqual(currentBuilds);
      expect(final.builds.host).toBe(baseline.builds.host);
      expect(final.appSource).toBe(baseline.appSource);
      await finalHost.page.screenshot({ path: testInfo.outputPath("final-valid-host.png") });
      await page.screenshot({ path: testInfo.outputPath("final-valid-app.png") });
      evidence.push(final);
    });
    expect(errors).toEqual([]);
    expect([...initialMissing].sort()).toEqual([
      "/v1/channels/preview",
      "/v1/sources/account-app-source",
    ]);
  } catch (error) {
    failed = true;
    for (const [index, opened] of context.pages().entries()) {
      await opened
        .screenshot({ path: testInfo.outputPath(`failure-page-${String(index)}.png`) })
        .catch(() => undefined);
    }
    throw error;
  } finally {
    // All values here are deliberately sanitized scalar receipts, never credentials or HTTP bodies.
    await testInfo.attach("restart-recovery-evidence", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
    try {
      await context.close();
    } catch (error) {
      // On timeout Playwright may already have revoked this exact context. Do not replace the
      // original failure with a second disposal error or skip retaining completed video files.
      if (!failed && testInfo.status !== "timedOut") cleanupError = error;
      failed = true;
    }
    // Manually created fresh contexts use the same retained-on-failure video policy as the
    // ordinary fixture. Playwright's artifact recorder already traces every created context.
    for (const video of videos) {
      try {
        if (failed)
          await testInfo.attach("recovery-video", {
            path: await video.path(),
            contentType: "video/webm",
          });
        else await video.delete();
      } catch (error) {
        if (!failed) cleanupError ??= error;
      }
    }
  }
  if (cleanupError !== undefined) throw cleanupError;
});
