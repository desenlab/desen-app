# Proof Demo Runbook

Task owner: M10-T08. See the [evidence report](../proof/DESEN-APP-REPEATABLE-DEMO.md) for execution
and hosted closure receipts; the procedure itself is not a stored test result.

This local Web demo uses the ordinary Desen App, real adapters, Publisher, durable control plane,
and independently built reference host. No private account, production service, prepared sign-in
Source, handwritten managed screen, or required raw JSON is involved in the positive journey.
Account and Flow are explicitly installed reference workspaces, not arbitrary project templates.

## Prepare a clean checkout once

Use the Node and pnpm versions declared in the repository, install the exact lockfile, and build
the public workspace packages:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @desen/app-browser-e2e exec playwright install chromium
```

The browser install is needed for automated Chromium, not for manually using your own browser.
On a clean Linux CI image, Playwright's documented system dependencies are required as well.
Do not create another checkout or editor port for this demo.

## Start or reset

Stop any existing owned editor on 5173, then run from the repository root:

```bash
pnpm demo:reset
```

This one command resets and starts the demo at **http://127.0.0.1:5173**. The terminal also prints
the independent published-host URL; open that exact URL in a second tab. Other local services use
OS-assigned loopback ports, not a second editor. The command never kills a process found by port.

The known seed is empty durable product storage. Choose **Flow app** in the workspace selector;
there must be zero projects and an enabled **New project** action. Nothing has authored a sign-in
screen for you. App, Bundle store, preview channel, and host activation share the demo generation.

All demo data lives under the fixed private `.desen/m10-demo/current` directory. Reset moves the
previous generation into `.desen/m10-demo/previous`; the next reset replaces that older backup.
The ordinary `.desen/desen-app` projects are untouched. To resume without resetting:

```bash
pnpm demo
```

Stop with **Ctrl+C** and wait for the command to finish before restarting or resetting. A live
lease, unsafe link, tampered ownership marker, or uncertain shutdown fails closed. After a forced
process kill, inspect `.desen/m10-demo/lease` and confirm that the owning composition has fully
stopped before manually retiring that exact stale lease; do not delete `.desen`, kill a PID merely
because a file names it, or erase a designer's Source to clear a startup error. The last reset
backup can be restored only while stopped, after preserving the current generation separately.

## Visually author the two surfaces

1. Select **Flow app → New project → Blank Flow app project → Create project**. Start and Result
   are empty surfaces with explicit **420 × 720 px** frames and one Stack root each.
2. Use the breadcrumb to open **Result**. Add **Text**, set its Text to `Welcome back`, click
   **Apply Text**, then **Source & release → Save source**. Return to **Start**.
3. In the right sidebar's **State** tab, add two **String** states named `email` and `password`.
   Leave both initial values empty. These are designer-owned state names, not special editor keys.
4. Return to **Inspector**. Drag **Text** from Components' dotted grip to its visible **Drop target**,
   or use Add. Set Text to `Sign in to continue` and Role to `heading`.
5. Add a **Text field**. Set Label to `Email`. In **Input connection**, choose `email` and click
   **Connect input**. This connects both displayed Value and the change action; do not add a
   second competing change handler manually.
6. Add another **Text field** with Label `Password`. Choose **Set Secure** and turn Secure on.
   Connect its input to the `password` state. Full strings must remain editable in Run mode.
7. Add a **Button** with Label `Continue`. In **Operation connection**, select the Catalog's sign-in
   operation, choose Result name `submitCredentials`, map Email to `email` and Password to `password`,
   and choose **Connect operation**. This authors Press → Invoke operation and pending → Loading.
   The result name is your chosen reference, not an endpoint or an inferred application type.
8. With that Button selected, open **Actions → Success**, add a **Navigate** action and select
   **Result**. The operation's success now has an explicit authored destination.
9. Add an **Alert** with Text `Check your email and password, then try again.` and Tone `critical`.
   In **Visibility**, choose operation-based visibility, result `submitCredentials`, status
   **Failed**, then **Apply visibility**. The Alert starts absent, appears on a declared failure,
   and disappears on the next pending attempt. This particular demo intentionally shows all declared
   operation failures, not only the invalid-credentials error code.
10. In Layers, use the dotted grips and highlighted insertion boundaries to arrange the title,
    Email, Password, Continue and Alert. Add and remove a temporary Alert to check **Remove layer**.
    Removal affects only that chosen Source subtree; Stack roots cannot be deleted.
11. Save through **Source & release → Save source**. The frame contains only managed content;
    Components and Layers remain on the left, Inspector/State/Actions on the right.

## Exercise Synthetic and explicit Integration

Choose **Run**. The editor always begins in **Synthetic**; the right panel derives the operation
name and outcomes from your authored invocation and installed Catalog.

1. Select the invalid-credentials outcome for `submitCredentials`. Type complete values into both
   fields and press **Continue**. The button must show pending/loading and ignore duplicate presses.
   The fixture does not settle until you choose **Complete submitCredentials fixture**.
2. Complete it. The Alert appears; the frame stays centered and its width does not grow.
3. Select success, press Continue again, and complete the fixture. The authored Result surface
   displays `Welcome back`. This phase makes **zero real account-service requests**.
4. Choose **Restart run**, then explicitly select **Integration**. This clears transient inputs and
   removes Synthetic fixture controls. Enter `designer@example.test` with a wrong password:
   a real local HTTP 401 must show the Alert without navigation.
5. Change only the password to `local-demo-pass` and retry. A real HTTP 200 returns `local-host-user`
   and Runtime follows the authored Success → Navigate action. This output is intentionally distinct
   from the Catalog's `user-1` fixture. The credentials describe a public **local test account**, not
   production authentication or a persisted user database.
6. Return to **Design** and reload. The saved design reopens, but runtime credentials, outcomes and
   navigation are not saved into Source. Production remains unavailable.

## Publish the same design, then change it without rebuilding the host

1. In Design, open **Source & release**. Save if needed, then **Publish**. Wait for the exact revision
   to be reported **active in the reference host**. Saved Source generation, channel generation and
   host activation generation are different receipts; a saved draft alone is not an active release.
2. Reload the separately printed host URL. It must show your authored title and form through the
   same registered adapters, with no editor panels or handwritten sign-in tree.
3. Try the same wrong-password and correct-password sequence in that independent host. The first
   remains on Start; the second displays the authored Result at `/result`.
4. Back in the editor, change the title to `Your workspace is ready`. Select the Stack root and
   change **Gap** to `xl`. Save and Publish again without stopping either application.
5. Reload the independent host from its root URL. The new title and spacing must appear, with a
   different Bundle revision. Its HTML, JavaScript and CSS do not change between these publications.
   Normal launcher startup does rebuild the host once; restart is not claimed to reuse that build.

Account and Flow share one trusted `preview` destination. Publishing a valid Account project later
replaces that preview; this is not simultaneous multi-project hosting. Document data cannot change
the channel, endpoint, credentials, callback or executable modules.

## Deliberate negative cases and recovery

The positive journey above needs no JSON. For a deliberate invalid-input exercise, use
**Source & release → Advanced Source**, which opens a detached draft. Change a Text's `role` to
an unsupported value, add an undeclared event, or add an undeclared slot; do each separately.
Choose **Validate and apply Source**. Each must produce a linked validation issue while the
committed canvas and independently active host remain unchanged. Select the issue to reach its
real layer, then **Discard Source draft**, or repair it before applying and saving. A rejected draft
must never become a Source write, Bundle write, channel change or activation request.

The ordinary Publisher cannot produce a corrupt revision or false Catalog digest. Those transport
faults therefore belong to the explicitly isolated negative harness, not a designer control:

```bash
pnpm --filter @desen/app-browser-e2e exec playwright test --config invalid-publication-playwright.config.ts
pnpm --filter @desen/app-browser-e2e exec playwright test --config restart-recovery-playwright.config.ts
```

The first checks prop/event/slot rejection and valid repairs through visible Advanced Source.
The second places only named corrupt-revision/Catalog-mismatch negative fixtures through the public
store/channel boundary. It proves the last-known-good revision survives both rejection and complete
process restart with a new PID. It then publishes a valid successor. These retained T06/T07
journeys have their own Sources and exact receipts; they are not falsely described as the same
Flow instance from this manual session. They do not promise automatic rollback after corruption
of the durable good Bundles themselves.

## Repeatability and complete evidence

Stop the human demo before this command; the automated journey owns the same normal 5173 lifecycle
and resets only its documented demo namespace:

```bash
pnpm --filter @desen/app-browser-e2e exec playwright test --config repeatable-demo-playwright.config.ts
```

It performs **two** complete reset → empty project → visual authoring → Synthetic → Integration →
independent publication → label/layout update cycles. Actual outgoing canonical Source and Bundle
bytes and revisions for A and B must match across cycles exactly, without stripping IDs or
normalizing differences. Each cycle uses a new process and browser context. Receipts contain
digests and statuses, not raw designer documents or launcher credentials.

The package's complete browser command retains all earlier journeys and adds this one:

```bash
pnpm --filter @desen/app-browser-e2e test:e2e
```

The T08 proof report owns the final immutable artifact and local/hosted receipts. A seal checks
identity, never cached test success. T09 separately freezes the committed Runtime Core tree.
Until G10 implements and verifies the complete coordinator, root `pnpm proof` and `pnpm test:e2e`
remain explicitly unimplemented; do not treat an early stub or a single browser pass as M10 closure.

## Later milestones — not part of this M10 demo

The [M10A plan](M10A-IMPLEMENTATION-PLAN.md) now precedes M11: ready styled components, theme and
component authoring, separate Connections and a built-in design-system/visual-review workbench.
Those are planned product capabilities, not features demonstrated by this unchanged M10 runbook.

Store Map and Sortable Priority surfaces belong to M11. Their unchanged Runtime Core comparisons
use the T09 baseline. M12 owns final conformance reporting and public-alpha preparation. No map,
sortable, native target, domain deployment, production identity or package publication is implied
by this local sign-in demonstration.
