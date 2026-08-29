// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authoringFixtures from "../src/authoring-fixtures.js";
import * as authoringPreview from "../src/authoring-preview.js";
import * as authoringSlots from "../src/authoring-slots.js";
import { DesenAppApplication } from "../src/application.js";

function renderApplication(pathname = "/projects") {
  window.history.replaceState(null, "", pathname);
  return render(<DesenAppApplication />);
}

const STACK_SLOT_ACCEPTANCE = "Accepts layout, content, input, action, feedback, complex";

function stackSlotName(
  itemCount: number,
  ownerId = "sign-in.layout",
  presence: "Absent" | "Present" = "Present",
): string {
  return `Choose Stack ${ownerId} default slot · Optional · ${presence} · ${itemCount} ${itemCount === 1 ? "item" : "items"} · minimum 0 · no maximum · ${STACK_SLOT_ACCEPTANCE}`;
}

describe("Desen App application shell", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.title = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    document.body.replaceChildren();
  });

  it("renders an app-native projects gallery with explicit landmarks and current navigation", () => {
    renderApplication();

    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    const main = screen.getByRole("main");
    expect(main).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "All projects" })).toBeTruthy();

    const projectsLink = screen.getByRole("link", { name: "Projects" });
    expect(projectsLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByLabelText("Capability catalogs").getAttribute("aria-disabled")).toBe("true");
    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink.getAttribute("href")).toBe("#desen-app-content");
    fireEvent.click(skipLink);
    expect(document.activeElement).toBe(main);
    expect(window.location.hash).toBe("");

    const search = screen.getByRole("searchbox", { name: "Search projects" });
    expect(search.getAttribute("aria-describedby")).toBeTruthy();
    const newProject = screen.getByRole("button", { name: "New project" }) as HTMLButtonElement;
    expect(newProject.disabled).toBe(true);
    const descriptionId = newProject.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? "")?.textContent).toContain(
      "Project creation unlocks with catalog setup.",
    );

    expect(screen.getByRole("status").textContent).toBe("2 projects");
    expect(screen.getByRole("heading", { level: 3, name: "Account app" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Checkout pilot" })).toBeTruthy();
    expect(screen.getByLabelText("Preview data boundary")).toBeTruthy();
    expect(document.title).toBe("Projects · DESEN");
  });

  it("filters only the fixed project inventory and provides a clear recovery action", () => {
    renderApplication();
    const search = screen.getByRole("searchbox", { name: "Search projects" });

    fireEvent.change(search, { target: { value: "recovery" } });
    expect(screen.getByRole("status").textContent).toBe("1 project");
    expect(screen.getByRole("heading", { name: "Account app" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Checkout pilot" })).toBeNull();

    fireEvent.change(search, { target: { value: "untrusted blank canvas" } });
    expect(screen.getByRole("status").textContent).toBe("0 projects");
    expect(
      screen.getByRole("heading", { name: "No project matches “untrusted blank canvas”." }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("2 projects");
  });

  it("uses same-document navigation and focuses the new route heading", async () => {
    renderApplication();

    fireEvent.click(screen.getByRole("link", { name: "Open project" }));

    expect(window.location.pathname).toBe("/projects/account-app");
    const projectHeading = screen.getByRole("heading", { level: 1, name: "Account app" });
    await waitFor(() => {
      expect(document.activeElement).toBe(projectHeading);
    });
    expect(document.title).toBe("Account app · DESEN");

    const surfaceNavigation = screen.getByRole("navigation", { name: "Account app surfaces" });
    const signInLink = within(surfaceNavigation).getByRole("link", { name: /Sign-in/ });
    fireEvent.click(signInLink);
    expect(window.location.pathname).toBe("/projects/account-app/surfaces/sign-in");
    expect(screen.getByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(document.title).toBe("Sign-in · Account app · DESEN");

    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    const refreshedSurfaceNavigation = screen.getByRole("navigation", {
      name: "Account app surfaces",
    });
    fireEvent.click(within(refreshedSurfaceNavigation).getByRole("link", { name: /Recovery/ }));
    expect(window.location.pathname).toBe("/projects/account-app/surfaces/recovery");
    expect(screen.getByRole("heading", { level: 2, name: "Recovery" })).toBeTruthy();
    expect(document.title).toBe("Recovery · Account app · DESEN");
  });

  it("reacts to browser traversal and keeps route focus inside the content landmark", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");

    act(() => {
      window.history.pushState(null, "", "/projects");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    const heading = screen.getByRole("heading", { level: 1, name: "Projects" });
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(screen.getByRole("main").contains(heading)).toBe(true);
    expect(document.title).toBe("Projects · DESEN");

    act(() => {
      window.history.replaceState(null, "", "/projects#workspace");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "This workspace route does not exist." }),
    ).toBeTruthy();
    expect(document.title).toBe("Not found · DESEN");
  });

  it("renders the editable Source hierarchy and keeps the exact managed adapter canvas read only", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Account app" }).getAttribute("href")).toBe(
      "/projects/account-app",
    );
    expect(within(breadcrumb).getByText("Sign-in").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(screen.getAllByText("account.sign-in")).toHaveLength(1);
    expect(screen.getByRole("complementary", { name: "Authoring panel" })).toBeTruthy();
    const layersTab = screen.getByRole("tab", { name: "Layers" });
    const componentsTab = screen.getByRole("tab", { name: "Components" });
    expect(layersTab.getAttribute("aria-selected")).toBe("true");
    expect(componentsTab.getAttribute("aria-selected")).toBe("false");
    const layersPanel = document.getElementById(layersTab.getAttribute("aria-controls") ?? "");
    const componentsPanel = document.getElementById(
      componentsTab.getAttribute("aria-controls") ?? "",
    );
    expect(layersPanel?.getAttribute("role")).toBe("tabpanel");
    expect(layersPanel?.hidden).toBe(false);
    expect(componentsPanel?.getAttribute("role")).toBe("tabpanel");
    expect(componentsPanel?.hidden).toBe(true);
    expect(layersPanel?.getAttribute("aria-labelledby")).toBe(layersTab.id);
    expect(componentsPanel?.getAttribute("aria-labelledby")).toBe(componentsTab.id);

    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    expect(within(hierarchy).getByText("sign-in.layout")).toBeTruthy();
    expect(within(hierarchy).getByText("sign-in.title")).toBeTruthy();
    expect(within(hierarchy).getByText("sign-in.email")).toBeTruthy();
    expect(within(hierarchy).getByText("sign-in.password")).toBeTruthy();
    expect(within(hierarchy).getByText("sign-in.error")).toBeTruthy();
    expect(within(hierarchy).getByText("sign-in.submit")).toBeTruthy();
    const stackSlot = within(hierarchy).getByRole("button", {
      name: stackSlotName(5),
    });
    expect(stackSlot.textContent).toContain("default slot");
    expect(stackSlot.textContent).toContain("Optional · Present");
    expect(stackSlot.textContent).toContain("5 items · minimum 0 · no maximum");
    expect(stackSlot.textContent).toContain(
      "Accepts layout, content, input, action, feedback, complex",
    );
    expect(stackSlot.getAttribute("aria-pressed")).toBe("true");
    expect(within(hierarchy).getByText("Conditional")).toBeTruthy();
    expect(within(hierarchy).queryByRole("tree")).toBeNull();
    expect(within(hierarchy).queryByRole("treeitem")).toBeNull();
    expect(hierarchy.querySelector("[aria-selected]")).toBeNull();
    expect(
      within(hierarchy)
        .getByRole("button", {
          name: "Select Stack layer · sign-in.layout",
        })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      within(hierarchy)
        .getByRole("button", {
          name: "Select Text field layer · sign-in.email",
        })
        .getAttribute("draggable"),
    ).toBe("true");
    expect(
      (
        within(hierarchy).getByRole("button", {
          name: "Move selected layer to Stack sign-in.layout default slot at position 1",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByRole("navigation", { name: "Sign-in layer hierarchy" })).toBeNull();
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    const canvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    expect(canvas).toBeInstanceOf(HTMLFieldSetElement);
    expect((canvas as HTMLFieldSetElement).disabled).toBe(true);
    const email = within(canvas).getByLabelText("Email") as HTMLInputElement;
    const password = within(canvas).getByLabelText("Password") as HTMLInputElement;
    const submit = within(canvas).getByRole("button", { name: "Sign in" });
    expect(email.type).toBe("text");
    expect(password.type).toBe("password");
    expect(email.matches(":disabled")).toBe(true);
    expect(password.matches(":disabled")).toBe(true);
    expect(submit.matches(":disabled")).toBe(true);
    expect(within(canvas).queryByRole("alert")).toBeNull();
    expect(screen.getByText("Design preview · controls are disabled.")).toBeTruthy();
    expect(
      screen.getByText(
        "Catalog-backed edits stay in this session. Scenarios are transient previews and never change the authored Source. Selection, placement, and Inspector chrome never enter the managed component tree.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeTruthy();
    expect(screen.getByText("Select a layer", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
    const modeControl = screen.getByRole("group", { name: "Design and Run mode" });
    expect(
      within(modeControl).getByRole("button", { name: "Design" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(modeControl).getByRole("button", { name: "Run" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.getByRole("status", { name: "Mode safety" }).textContent).toBe(
      "Design mode · managed controls are disabled; edits stay in this session draft.",
    );
    expect(screen.queryByRole("tab", { name: /design|run/i })).toBeNull();
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("selects Source layers accessibly and keeps the identity overlay outside managed adapters", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();

    const emailLayer = screen.getByRole("button", {
      name: "Select Text field layer · sign-in.email",
    });
    expect(emailLayer.tagName).toBe("BUTTON");
    expect(emailLayer.getAttribute("type")).toBe("button");
    emailLayer.focus();
    expect(document.activeElement).toBe(emailLayer);
    fireEvent.click(emailLayer);

    expect(emailLayer.getAttribute("aria-pressed")).toBe("true");
    expect(emailLayer.getAttribute("aria-label")).toBe("Deselect Text field layer · sign-in.email");
    expect(screen.getByText("Selected · Text field")).toBeTruthy();
    const overlay = await screen.findByRole("status", { name: "Selected layer preview" });
    const canvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    const managedSubtree = document.querySelector("[data-managed-capability-subtree='true']");
    expect(overlay.textContent).toContain("Text field");
    expect(overlay.textContent).toContain("sign-in.email");
    expect(overlay.textContent).toContain("Visible in preview");
    expect(canvas.parentElement).toBe(overlay.parentElement);
    expect(managedSubtree?.contains(overlay)).toBe(false);

    fireEvent.click(within(canvas).getByRole("button", { name: "Sign in" }));
    expect(emailLayer.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status", { name: "Selected layer preview" })).toBe(overlay);

    fireEvent.click(emailLayer);
    expect(emailLayer.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();

    const conditionalLayer = screen.getByRole("button", {
      name: "Select Alert layer · sign-in.error · Conditional",
    });
    fireEvent.click(conditionalLayer);
    const conditionalOverlay = screen.getByRole("status", { name: "Selected layer preview" });
    expect(conditionalLayer.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Selected · Alert · Conditional")).toBeTruthy();
    expect(conditionalOverlay.getAttribute("data-materialized")).toBe("false");
    expect(conditionalOverlay.textContent).toContain("Hidden by condition");
  });

  it("chooses an exact named-slot target and inserts Catalog defaults into Source and preview", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    const layersTab = within(authoring).getByRole("tab", { name: "Layers" });
    const componentsTab = within(authoring).getByRole("tab", { name: "Components" });
    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    const stackSlot = within(hierarchy).getByRole("button", {
      name: stackSlotName(5),
    });
    const managedSubtree = document.querySelector("[data-managed-capability-subtree='true']");

    expect(managedSubtree).toBeTruthy();
    expect(managedSubtree?.contains(stackSlot)).toBe(false);
    fireEvent.click(stackSlot);

    expect(layersTab.getAttribute("aria-selected")).toBe("false");
    expect(componentsTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(componentsTab);
    expect(
      within(authoring)
        .getByText("Choose a Catalog component for sign-in.layout · default.")
        .getAttribute("role"),
    ).toBe("status");

    const componentsPanel = document.getElementById(
      componentsTab.getAttribute("aria-controls") ?? "",
    );
    expect(componentsPanel).toBeTruthy();
    const componentView = within(componentsPanel as HTMLElement);
    const dropTarget = componentView.getByRole("group", {
      name: "Placement target · Stack sign-in.layout default slot · 5 items · minimum 0 · no maximum",
    });
    expect(dropTarget.textContent).toContain("Stack");
    expect(dropTarget.textContent).toContain("sign-in.layout · default");
    expect(dropTarget.textContent).toContain("5 items");
    expect(dropTarget.textContent).toContain(
      "Click Add or drag a component anywhere in this panel",
    );
    expect(managedSubtree?.contains(dropTarget)).toBe(false);

    const addAlert = componentView.getByRole("button", {
      name: "Insert Alert into Stack sign-in.layout default slot at position 6",
    }) as HTMLButtonElement;
    expect(addAlert.disabled).toBe(false);
    expect(addAlert.draggable).toBe(false);
    expect(addAlert.querySelector("[draggable='true']")).toBeTruthy();
    expect(managedSubtree?.contains(addAlert)).toBe(false);
    fireEvent.click(addAlert);

    expect(
      within(authoring)
        .getByText(
          "Inserted Alert in Stack default slot at position 6. Selected for editing · use Delete or Backspace to remove.",
        )
        .getAttribute("role"),
    ).toBe("status");
    expect(dropTarget.textContent).toContain("6 items");
    const canvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    expect(within(canvas).getByRole("status").textContent).toBe("Message");
    const deleteAlert = within(authoring).getByRole("button", {
      name: "Delete Alert layer · node.alert",
    }) as HTMLButtonElement;
    expect(deleteAlert.disabled).toBe(false);
    expect(managedSubtree?.contains(deleteAlert)).toBe(false);
    deleteAlert.focus();
    fireEvent.click(deleteAlert);

    expect(within(authoring).getByRole("status").textContent).toBe(
      "Deleted Alert layer · node.alert.",
    );
    expect(document.activeElement).toBe(layersTab);
    expect(layersTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("button", { name: "Select Alert layer · node.alert" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Alert layer · node.alert" })).toBeNull();
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
    expect(screen.getByRole("button", { name: stackSlotName(5) })).toBeTruthy();
    expect(
      within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).queryByRole("status"),
    ).toBeNull();
  });

  it.each(["Delete", "Backspace"])(
    "deletes a newly inserted selected layer with %s outside editable controls",
    async (key) => {
      renderApplication("/projects/account-app/surfaces/sign-in");
      expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

      const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
      const componentsTab = within(authoring).getByRole("tab", { name: "Components" });
      fireEvent.click(componentsTab);
      const componentsPanel = document.getElementById(
        componentsTab.getAttribute("aria-controls") ?? "",
      );
      const componentView = within(componentsPanel as HTMLElement);
      fireEvent.click(
        componentView.getByRole("button", {
          name: "Insert Alert into Stack sign-in.layout default slot at position 6",
        }),
      );

      expect(
        within(authoring).getByRole("button", { name: "Delete Alert layer · node.alert" }),
      ).toBeTruthy();
      expect(screen.getByRole("status", { name: "Selected layer preview" }).textContent).toContain(
        "node.alert",
      );

      fireEvent.keyDown(document.body, { key });

      expect(screen.queryByRole("button", { name: /Alert layer · node\.alert/ })).toBeNull();
      expect(within(authoring).getByRole("status").textContent).toBe(
        "Deleted Alert layer · node.alert.",
      );
      expect(document.activeElement).toBe(within(authoring).getByRole("tab", { name: "Layers" }));
    },
  );

  it("ignores deletion shortcuts from editable controls while retaining the selected layer", async () => {
    const deleteAttempt = vi.spyOn(authoringSlots, "applyAuthoringNodeDelete");
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    const componentsTab = within(authoring).getByRole("tab", { name: "Components" });
    fireEvent.click(componentsTab);
    const componentsPanel = document.getElementById(
      componentsTab.getAttribute("aria-controls") ?? "",
    );
    const componentView = within(componentsPanel as HTMLElement);
    fireEvent.click(
      componentView.getByRole("button", {
        name: "Insert Alert into Stack sign-in.layout default slot at position 6",
      }),
    );
    expect(
      within(authoring).getByRole("button", { name: "Delete Alert layer · node.alert" }),
    ).toBeTruthy();
    expect(screen.getByRole("status", { name: "Selected layer preview" }).textContent).toContain(
      "node.alert",
    );

    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const contentEditable = document.createElement("div");
    contentEditable.contentEditable = "true";
    contentEditable.setAttribute("contenteditable", "true");
    contentEditable.tabIndex = 0;
    document.body.append(textarea, select, contentEditable);
    const editableControls: readonly HTMLElement[] = [
      componentView.getByRole("searchbox", {
        name: "Search catalog components",
      }) as HTMLInputElement,
      textarea,
      select,
      contentEditable,
    ];

    for (const control of editableControls) {
      control.focus();
      expect(document.activeElement).toBe(control);
      fireEvent.keyDown(control, { key: "Delete" });
      fireEvent.keyDown(control, { key: "Backspace" });
      expect(
        within(authoring).getByRole("button", { name: "Delete Alert layer · node.alert" }),
      ).toBeTruthy();
    }
    expect(deleteAttempt).not.toHaveBeenCalled();
    textarea.remove();
    select.remove();
    contentEditable.remove();
  });

  it("disables deletion for the surface root and a slot-minimum preflight without changing preview", async () => {
    const evaluateDeletion = authoringSlots.evaluateAuthoringNodeDeletion;
    vi.spyOn(authoringSlots, "evaluateAuthoringNodeDeletion").mockImplementation(
      (route, model, selection) =>
        selection.sourceNodeId === "sign-in.title"
          ? Object.freeze({ accepted: false, reason: "cardinality-rejected" })
          : evaluateDeletion(route, model, selection),
    );
    const deleteAttempt = vi.spyOn(authoringSlots, "applyAuthoringNodeDelete");

    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    const rootLayer = screen.getByRole("button", {
      name: "Select Stack layer · sign-in.layout",
    });
    fireEvent.click(rootLayer);

    const rootDelete = within(authoring).getByRole("button", {
      name: "Delete Stack layer · sign-in.layout",
    }) as HTMLButtonElement;
    expect(rootDelete.disabled).toBe(true);
    expect(rootDelete.getAttribute("aria-describedby")).toBeTruthy();
    expect(
      document.getElementById(rootDelete.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toBe("The surface root cannot be deleted.");
    fireEvent.click(rootDelete);
    fireEvent.keyDown(document.body, { key: "Delete" });
    fireEvent.keyDown(rootLayer, { key: "Backspace" });
    expect(deleteAttempt).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Deselect Stack layer · sign-in.layout" }),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sign-in adapter canvas" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deselect Stack layer · sign-in.layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Text layer · sign-in.title" }));
    const minimumDelete = within(authoring).getByRole("button", {
      name: "Delete Text layer · sign-in.title",
    }) as HTMLButtonElement;
    expect(minimumDelete.disabled).toBe(true);
    expect(
      document.getElementById(minimumDelete.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toBe("The owning slot minimum requires this layer.");
    fireEvent.click(minimumDelete);
    fireEvent.keyDown(document.body, { key: "Delete" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Deselect Text layer · sign-in.title" }), {
      key: "Backspace",
    });

    expect(deleteAttempt).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Deselect Text layer · sign-in.title" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Selected layer preview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: stackSlotName(5) })).toBeTruthy();
  });

  it("preserves the selected layer, preview, and focus when deletion is rejected", async () => {
    vi.spyOn(authoringSlots, "applyAuthoringNodeDelete").mockReturnValue(
      Object.freeze({ ok: false, reason: "preview-unavailable" }),
    );

    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select Text layer · sign-in.title" }));
    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    const deleteTitle = within(authoring).getByRole("button", {
      name: "Delete Text layer · sign-in.title",
    }) as HTMLButtonElement;
    expect(deleteTitle.disabled).toBe(false);
    deleteTitle.focus();
    fireEvent.click(deleteTitle);

    expect(document.activeElement).toBe(deleteTitle);
    expect(within(authoring).getByRole("status").textContent).toBe(
      "The working preview could not accept this Source deletion.",
    );
    expect(
      screen.getByRole("button", { name: "Deselect Text layer · sign-in.title" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Selected layer preview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: stackSlotName(5) })).toBeTruthy();
  });

  it("uses only the App-owned drag intent and ignores forged native transfer authority", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: stackSlotName(5),
      }),
    );
    const componentView = within(
      document.getElementById(
        screen.getByRole("tab", { name: "Components" }).getAttribute("aria-controls") ?? "",
      ) as HTMLElement,
    );
    const alert = componentView.getByRole("button", {
      name: "Insert Alert into Stack sign-in.layout default slot at position 6",
    });
    const target = componentView.getByRole("group", {
      name: "Placement target · Stack sign-in.layout default slot · 5 items · minimum 0 · no maximum",
    });
    const writes: (readonly [string, string])[] = [];
    let reads = 0;
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData() {
        reads += 1;
        return "forged.node.authority";
      },
      setData(type: string, value: string) {
        writes.push([type, value]);
      },
    };

    fireEvent.drop(target, { dataTransfer });
    expect(reads).toBe(0);
    expect(screen.queryByRole("button", { name: "Select Alert layer · node.alert" })).toBeNull();

    const alertDragHandle = alert.querySelector("[draggable='true']") as HTMLElement;
    expect(alertDragHandle).toBeTruthy();
    fireEvent.click(alertDragHandle);
    expect(screen.queryByRole("button", { name: "Select Alert layer · node.alert" })).toBeNull();
    fireEvent.dragStart(alertDragHandle, { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe("copy");
    expect(writes).toEqual([["text/plain", "DESEN App authoring item"]]);
    expect(target.getAttribute("data-drag-active")).toBe("true");
    expect(target.getAttribute("data-drop-ready")).toBe("true");
    const panelDropSurface = target.parentElement as HTMLElement;
    expect(panelDropSurface.getAttribute("data-component-drag-active")).toBe("true");
    const dropPrompt = within(target).getByText("Release to add");
    fireEvent.dragEnter(target, { dataTransfer });
    fireEvent.dragEnter(dropPrompt, { dataTransfer });
    fireEvent.dragLeave(dropPrompt, { dataTransfer });
    expect(target.getAttribute("data-drop-hovered")).toBe("true");
    fireEvent.dragLeave(target, { dataTransfer });
    expect(target.getAttribute("data-drop-hovered")).toBe("false");
    fireEvent.dragEnter(target, { dataTransfer });
    const panelSearch = componentView.getByRole("searchbox", {
      name: "Search catalog components",
    });
    fireEvent.dragOver(panelSearch, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("copy");
    fireEvent.drop(panelSearch, { dataTransfer });

    expect(reads).toBe(0);
    expect(
      within(screen.getByRole("complementary", { name: "Authoring panel" }))
        .getByText(
          "Inserted Alert in Stack default slot at position 6. Selected for editing · use Delete or Backspace to remove.",
        )
        .getAttribute("role"),
    ).toBe("status");
    expect(
      within(screen.getByRole("complementary", { name: "Authoring panel" })).getByRole("button", {
        name: "Delete Alert layer · node.alert",
      }),
    ).toBeTruthy();
  });

  it("reorders a selected Source node through the keyboard placement control", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    const submitLayer = within(hierarchy).getByRole("button", {
      name: "Select Button layer · sign-in.submit",
    });
    fireEvent.click(submitLayer);

    const currentPosition = within(hierarchy).getAllByRole("button", {
      name: "Keep sign-in.submit at its current position 5 in Stack sign-in.layout default slot",
    }) as HTMLButtonElement[];
    expect(currentPosition).toHaveLength(2);
    expect(currentPosition.every(({ disabled }) => disabled)).toBe(true);

    const moveFirst = within(hierarchy).getByRole("button", {
      name: "Move sign-in.submit to Stack sign-in.layout default slot at position 1",
    }) as HTMLButtonElement;
    expect(moveFirst.disabled).toBe(false);
    moveFirst.focus();
    fireEvent.click(moveFirst);

    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    expect(within(authoring).getByRole("status").textContent).toBe(
      "Reordered sign-in.submit in Stack default slot.",
    );
    const reorderedLayer = within(hierarchy).getByRole("button", {
      name: "Deselect Button layer · sign-in.submit",
    });
    expect(reorderedLayer.getAttribute("aria-pressed")).toBe("true");

    const layerButtons = within(hierarchy).getAllByRole("button", {
      name: /^(?:Select|Deselect) .+ layer · /,
    });
    expect(layerButtons[0]?.getAttribute("aria-label")).toBe("Select Stack layer · sign-in.layout");
    expect(layerButtons[1]?.getAttribute("aria-label")).toBe(
      "Deselect Button layer · sign-in.submit",
    );
    expect(layerButtons[2]?.getAttribute("aria-label")).toBe("Select Text layer · sign-in.title");

    const canvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    const managedSubtree = document.querySelector("[data-managed-capability-subtree='true']");
    const submit = within(canvas).getByRole("button", { name: "Sign in" });
    const title = within(canvas).getByRole("heading", { level: 2, name: "Sign in" });
    expect(submit.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(managedSubtree?.contains(moveFirst)).toBe(false);
    expect(
      screen.getByRole("button", {
        name: stackSlotName(5),
      }).textContent,
    ).toContain("5 items · minimum 0 · no maximum");
  });

  it("snaps a native layer drag to the before or after half of a visible layer row", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    const submitLayer = within(hierarchy).getByRole("button", {
      name: "Select Button layer · sign-in.submit",
    });
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: vi.fn(),
      setData: vi.fn(),
    };

    fireEvent.dragStart(submitLayer, { dataTransfer });
    const titleLayer = within(hierarchy).getByRole("button", {
      name: "Select Text layer · sign-in.title",
    });
    Object.defineProperty(titleLayer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 140,
        height: 40,
        left: 0,
        right: 240,
        top: 100,
        width: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    });
    const dragOver = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperties(dragOver, {
      clientY: { value: 105 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(titleLayer, dragOver);
    expect(dataTransfer.dropEffect).toBe("move");
    expect(
      within(hierarchy)
        .getByRole("listitem", {
          name: "Stack sign-in.layout default slot insertion boundary at position 1",
        })
        .getAttribute("data-drop-hovered"),
    ).toBe("true");
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(drop, {
      clientY: { value: 105 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(titleLayer, drop);

    expect(
      within(screen.getByRole("complementary", { name: "Authoring panel" })).getByRole("status")
        .textContent,
    ).toBe("Reordered sign-in.submit in Stack default slot.");
    const reorderedLayers = within(hierarchy).getAllByRole("button", {
      name: /^(?:Select|Deselect) .+ layer · /,
    });
    expect(reorderedLayers[0]?.getAttribute("aria-label")).toBe(
      "Select Stack layer · sign-in.layout",
    );
    expect(reorderedLayers[1]?.getAttribute("aria-label")).toBe(
      "Select Button layer · sign-in.submit",
    );
    expect(reorderedLayers[2]?.getAttribute("aria-label")).toBe(
      "Select Text layer · sign-in.title",
    );

    const reorderedSubmit = within(hierarchy).getByRole("button", {
      name: "Select Button layer · sign-in.submit",
    });
    fireEvent.dragStart(reorderedSubmit, { dataTransfer });
    const reorderedTitle = within(hierarchy).getByRole("button", {
      name: "Select Text layer · sign-in.title",
    });
    Object.defineProperty(reorderedTitle, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 140,
        height: 40,
        left: 0,
        right: 240,
        top: 100,
        width: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    });
    const lowerHalfDragOver = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperties(lowerHalfDragOver, {
      clientY: { value: 135 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(reorderedTitle, lowerHalfDragOver);
    expect(
      within(hierarchy)
        .getByRole("listitem", {
          name: "Stack sign-in.layout default slot insertion boundary at position 3",
        })
        .getAttribute("data-drop-hovered"),
    ).toBe("true");
    const lowerHalfDrop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(lowerHalfDrop, {
      clientY: { value: 135 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(reorderedTitle, lowerHalfDrop);

    const restoredLayers = within(hierarchy).getAllByRole("button", {
      name: /^(?:Select|Deselect) .+ layer · /,
    });
    expect(restoredLayers[1]?.getAttribute("aria-label")).toBe("Select Text layer · sign-in.title");
    expect(restoredLayers[2]?.getAttribute("aria-label")).toBe(
      "Select Button layer · sign-in.submit",
    );
    expect(dataTransfer.getData).not.toHaveBeenCalled();
  });

  it("uses the release position when it crosses a row midpoint after the last dragover", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    const submitLayer = within(hierarchy).getByRole("button", {
      name: "Select Button layer · sign-in.submit",
    });
    const titleLayer = within(hierarchy).getByRole("button", {
      name: "Select Text layer · sign-in.title",
    });
    const slotList = titleLayer.closest("li")?.parentElement as HTMLUListElement;
    const slotSurface = slotList.parentElement as HTMLDivElement;
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: vi.fn(),
      setData: vi.fn(),
    };
    Object.defineProperty(titleLayer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 140,
        height: 40,
        left: 0,
        right: 240,
        top: 100,
        width: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    });
    Object.defineProperty(slotSurface, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 400,
        height: 320,
        left: 0,
        right: 240,
        top: 80,
        width: 240,
        x: 0,
        y: 80,
        toJSON: () => ({}),
      }),
    });

    fireEvent.dragStart(submitLayer, { dataTransfer });
    const lowerHalfDragOver = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperties(lowerHalfDragOver, {
      clientY: { value: 135 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(titleLayer, lowerHalfDragOver);
    expect(
      within(hierarchy)
        .getByRole("listitem", {
          name: "Stack sign-in.layout default slot insertion boundary at position 2",
        })
        .getAttribute("data-drop-hovered"),
    ).toBe("true");

    const upperHalfDrop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(upperHalfDrop, {
      clientY: { value: 105 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(titleLayer, upperHalfDrop);

    const reorderedLayers = within(hierarchy).getAllByRole("button", {
      name: /^(?:Select|Deselect) .+ layer · /,
    });
    expect(reorderedLayers[1]?.getAttribute("aria-label")).toBe(
      "Select Button layer · sign-in.submit",
    );
    expect(reorderedLayers[2]?.getAttribute("aria-label")).toBe(
      "Select Text layer · sign-in.title",
    );
  });

  it("keeps the admitted gap stable while the pointer jitters around a row midpoint", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    const submitLayer = within(hierarchy).getByRole("button", {
      name: "Select Button layer · sign-in.submit",
    });
    const titleLayer = within(hierarchy).getByRole("button", {
      name: "Select Text layer · sign-in.title",
    });
    Object.defineProperty(titleLayer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 140,
        height: 40,
        left: 0,
        right: 240,
        top: 100,
        width: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    });
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: vi.fn(),
      setData: vi.fn(),
    };
    const dragOverAt = (clientY: number): void => {
      const event = new Event("dragover", { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientY: { value: clientY },
        dataTransfer: { value: dataTransfer },
      });
      fireEvent(titleLayer, event);
    };
    const before = within(hierarchy).getByRole("listitem", {
      name: "Stack sign-in.layout default slot insertion boundary at position 1",
    });
    const after = within(hierarchy).getByRole("listitem", {
      name: "Stack sign-in.layout default slot insertion boundary at position 2",
    });

    fireEvent.dragStart(submitLayer, { dataTransfer });
    dragOverAt(118);
    expect(before.getAttribute("data-drop-hovered")).toBe("true");
    dragOverAt(122);
    expect(before.getAttribute("data-drop-hovered")).toBe("true");
    expect(after.getAttribute("data-drop-hovered")).toBe("false");
    dragOverAt(126);
    expect(after.getAttribute("data-drop-hovered")).toBe("true");
    fireEvent.dragEnd(submitLayer, { dataTransfer });
  });

  it("drops from a visible row with the last admitted projection when drop coordinates are absent", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    const submitLayer = within(hierarchy).getByRole("button", {
      name: "Select Button layer · sign-in.submit",
    });
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: vi.fn(() => "forged.node.authority"),
      setData: vi.fn(),
    };
    fireEvent.dragStart(submitLayer, { dataTransfer });

    const titleLayer = within(hierarchy).getByRole("button", {
      name: "Select Text layer · sign-in.title",
    });
    Object.defineProperty(titleLayer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 140,
        height: 40,
        left: 0,
        right: 240,
        top: 100,
        width: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    });

    for (const type of ["dragenter", "dragover"]) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientY: { value: 135 },
        dataTransfer: { value: dataTransfer },
      });
      fireEvent(titleLayer, event);
    }
    expect(dataTransfer.dropEffect).toBe("move");
    expect(
      within(hierarchy)
        .getByRole("listitem", {
          name: "Stack sign-in.layout default slot insertion boundary at position 2",
        })
        .getAttribute("data-drop-hovered"),
    ).toBe("true");

    const coordinateLessDrop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(coordinateLessDrop, "dataTransfer", { value: dataTransfer });
    fireEvent(titleLayer, coordinateLessDrop);

    expect(
      within(screen.getByRole("complementary", { name: "Authoring panel" })).getByRole("status")
        .textContent,
    ).toBe("Reordered sign-in.submit in Stack default slot.");
    const reorderedLayers = within(hierarchy).getAllByRole("button", {
      name: /^(?:Select|Deselect) .+ layer · /,
    });
    expect(reorderedLayers[1]?.getAttribute("aria-label")).toBe(
      "Select Text layer · sign-in.title",
    );
    expect(reorderedLayers[2]?.getAttribute("aria-label")).toBe(
      "Select Button layer · sign-in.submit",
    );
    expect(dataTransfer.getData).not.toHaveBeenCalled();
  });

  it("moves nodes across nested slots with keyboard and App-owned native drag intent", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    fireEvent.click(screen.getByRole("button", { name: stackSlotName(5) }));
    fireEvent.click(
      within(authoring).getByRole("button", {
        name: "Insert Stack into Stack sign-in.layout default slot at position 6",
      }),
    );
    fireEvent.click(within(authoring).getByRole("tab", { name: "Layers" }));

    const hierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    expect(
      within(hierarchy).getByRole("button", {
        name: stackSlotName(0, "node.stack", "Absent"),
      }),
    ).toBeTruthy();

    fireEvent.click(
      within(hierarchy).getByRole("button", {
        name: "Select Text field layer · sign-in.email",
      }),
    );
    const moveEmail = within(hierarchy).getByRole("button", {
      name: "Move sign-in.email to Stack node.stack default slot at position 1",
    }) as HTMLButtonElement;
    expect(moveEmail.disabled).toBe(false);
    fireEvent.click(moveEmail);

    expect(within(authoring).getByRole("status").textContent).toBe(
      "Moved sign-in.email to Stack default slot.",
    );
    const nestedAfterKeyboard = within(hierarchy).getByRole("button", {
      name: stackSlotName(1, "node.stack"),
    });
    expect(
      nestedAfterKeyboard.parentElement?.contains(
        within(hierarchy).getByRole("button", {
          name: "Deselect Text field layer · sign-in.email",
        }),
      ),
    ).toBe(true);

    const password = within(hierarchy).getByRole("button", {
      name: "Select Text field layer · sign-in.password",
    });
    const nestedEnd = within(hierarchy).getByLabelText(
      "Stack node.stack default slot insertion boundary at position 2",
    );
    const writes: (readonly [string, string])[] = [];
    let reads = 0;
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData() {
        reads += 1;
        return "forged.node.authority";
      },
      setData(type: string, value: string) {
        writes.push([type, value]);
      },
    };

    fireEvent.dragStart(password, { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe("move");
    expect(writes).toEqual([["text/plain", "DESEN App authoring item"]]);
    expect(nestedEnd.getAttribute("data-drop-ready")).toBe("true");
    const nestedStart = within(hierarchy).getByLabelText(
      "Stack node.stack default slot insertion boundary at position 1",
    );
    const nestedEmail = within(hierarchy).getByRole("button", {
      name: "Deselect Text field layer · sign-in.email",
    });
    Object.defineProperty(nestedEmail, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 140,
        height: 40,
        left: 0,
        right: 240,
        top: 100,
        width: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    });
    const nestedHeaderDragOver = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperties(nestedHeaderDragOver, {
      clientY: { value: 80 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(nestedAfterKeyboard, nestedHeaderDragOver);
    expect(nestedStart.getAttribute("data-drop-hovered")).toBe("true");
    expect(hierarchy.querySelectorAll("[data-drop-hovered='true']")).toHaveLength(1);

    const outerStart = within(hierarchy).getByLabelText(
      "Stack sign-in.layout default slot insertion boundary at position 1",
    );
    fireEvent.dragOver(outerStart, { dataTransfer });
    expect(outerStart.getAttribute("data-drop-hovered")).toBe("true");
    expect(nestedStart.getAttribute("data-drop-hovered")).toBe("false");
    expect(hierarchy.querySelectorAll("[data-drop-hovered='true']")).toHaveLength(1);

    const nestedBoundaryLine = nestedEnd.querySelector("[aria-hidden='true']");
    expect(nestedBoundaryLine).toBeTruthy();
    fireEvent.dragEnter(nestedEnd, { dataTransfer });
    fireEvent.dragEnter(nestedBoundaryLine as HTMLElement, { dataTransfer });
    fireEvent.dragLeave(nestedBoundaryLine as HTMLElement, { dataTransfer });
    fireEvent.dragOver(nestedBoundaryLine as HTMLElement, { dataTransfer });
    expect(nestedEnd.getAttribute("data-drop-hovered")).toBe("true");
    expect(outerStart.getAttribute("data-drop-hovered")).toBe("false");
    expect(hierarchy.querySelectorAll("[data-drop-hovered='true']")).toHaveLength(1);
    expect(dataTransfer.dropEffect).toBe("move");
    fireEvent.drop(nestedBoundaryLine as HTMLElement, { dataTransfer });

    expect(reads).toBe(0);
    expect(within(authoring).getByRole("status").textContent).toBe(
      "Moved sign-in.password to Stack default slot.",
    );
    expect(
      within(hierarchy).getByRole("button", {
        name: stackSlotName(2, "node.stack"),
      }),
    ).toBeTruthy();
    expect(
      within(hierarchy)
        .getByRole("button", {
          name: "Deselect Text field layer · sign-in.email",
        })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText("Email"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
        "Password",
      ),
    ).toBeTruthy();

    fireEvent.click(
      within(hierarchy).getByRole("button", {
        name: stackSlotName(2, "node.stack"),
      }),
    );
    fireEvent.click(
      within(authoring).getByRole("button", {
        name: "Insert Stack into Stack node.stack default slot at position 3",
      }),
    );
    fireEvent.click(within(authoring).getByRole("tab", { name: "Layers" }));

    const refreshedHierarchy = screen.getByRole("region", { name: "Sign-in layer hierarchy" });
    const parentStack = within(refreshedHierarchy).getByRole("button", {
      name: "Select Stack layer · node.stack",
    });
    fireEvent.click(parentStack);
    const cyclePlace = within(refreshedHierarchy).getByRole("button", {
      name: "Move node.stack to Stack node.stack-2 default slot at position 1",
    }) as HTMLButtonElement;
    const cycleTarget = within(refreshedHierarchy).getByLabelText(
      "Stack node.stack-2 default slot insertion boundary at position 1",
    );
    const cycleTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData() {
        reads += 1;
        return "forged.cycle.authority";
      },
      setData() {
        return undefined;
      },
    };

    expect(cyclePlace.disabled).toBe(true);
    fireEvent.dragStart(parentStack, { dataTransfer: cycleTransfer });
    expect(cycleTarget.getAttribute("data-drop-ready")).toBe("false");
    fireEvent.dragOver(cycleTarget, { dataTransfer: cycleTransfer });
    fireEvent.drop(cycleTarget, { dataTransfer: cycleTransfer });
    expect(reads).toBe(0);
    expect(
      within(refreshedHierarchy).getByRole("button", {
        name: "Deselect Stack layer · node.stack",
      }),
    ).toBeTruthy();
  });

  it("edits schema-derived string and enum props and refreshes the exact adapter preview", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Select Text layer · sign-in.title" }));
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getByText("sign-in.title")).toBeTruthy();
    expect(within(inspector).getByText("com.example.ui/Text")).toBeTruthy();
    expect(within(inspector).getByText("2 controls")).toBeTruthy();

    const text = within(inspector).getByRole("textbox", { name: "Text" }) as HTMLInputElement;
    expect(text.value).toBe("Sign in");
    fireEvent.change(text, { target: { value: "Welcome back" } });
    fireEvent.blur(text);
    expect(await screen.findByRole("heading", { level: 2, name: "Welcome back" })).toBeTruthy();
    expect(within(inspector).getByRole("status").textContent).toBe("Updated Text.");

    const role = within(inspector).getByRole("combobox", { name: "Role" });
    expect((role as HTMLSelectElement).value).toBe("option:1");
    fireEvent.change(role, { target: { value: "option:2" } });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Welcome back" })).toBeNull();
      expect(screen.getByText("Welcome back", { selector: "small" })).toBeTruthy();
    });
    expect(within(inspector).getByRole("status").textContent).toBe("Updated Role.");
    expect(screen.getByText("Session draft", { selector: "span" })).toBeTruthy();
  });

  it("preserves the prior Source and preview when Publisher rejects an oversized valid prop", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Select Text layer · sign-in.title" }));
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    const text = within(inspector).getByRole("textbox", { name: "Text" }) as HTMLInputElement;
    fireEvent.change(text, { target: { value: "x".repeat(2_200_000) } });
    fireEvent.blur(text);

    expect(
      within(inspector).getAllByText("This value is too large for the exact adapter preview."),
    ).toHaveLength(1);
    expect(within(inspector).getByRole("status").textContent).toBe(
      "Edits stay in this session until save is implemented.",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText("Preview unavailable")).toBeNull();
    expect(screen.getByText("Session draft", { selector: "span" })).toBeTruthy();

    fireEvent.keyDown(text, { key: "Escape" });
    expect(text.value).toBe("Sign in");
  });

  it("updates surface-local state and changes a compatible binding in the live preview", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    const canvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    const emailInput = within(canvas).getByLabelText("Email") as HTMLInputElement;
    expect(emailInput.value).toBe("");

    fireEvent.click(screen.getByRole("tab", { name: "State" }));
    const statePanel = screen.getByRole("region", { name: "Local state" });
    expect(within(statePanel).getByRole("list", { name: "Sign-in local state" })).toBeTruthy();
    expect(within(statePanel).getByLabelText("email usage count").textContent).toBe("Used by 3");
    const emailInitial = within(statePanel).getByRole("textbox", {
      name: "email initial value",
    });
    fireEvent.change(emailInitial, { target: { value: "person@example.com" } });
    fireEvent.click(within(statePanel).getByRole("button", { name: "Apply email local state" }));
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
            "Email",
          ) as HTMLInputElement
        ).value,
      ).toBe("person@example.com"),
    );
    expect(within(statePanel).getByRole("status").textContent).toBe("Updated email local state.");

    fireEvent.click(screen.getByRole("tab", { name: "Layers" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    const valueSource = within(inspector).getByRole("combobox", {
      name: "Value value source",
    });
    fireEvent.change(valueSource, { target: { value: "password" } });
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
            "Email",
          ) as HTMLInputElement
        ).value,
      ).toBe(""),
    );
    expect(within(inspector).getByRole("status").textContent).toBe(
      "Bound Value to state.password.",
    );

    fireEvent.click(screen.getByRole("tab", { name: "State" }));
    expect(within(statePanel).getByLabelText("email usage count").textContent).toBe("Used by 2");
    expect(within(statePanel).getByLabelText("password usage count").textContent).toBe("Used by 4");
    expect(
      (
        within(statePanel).getByRole("button", {
          name: "Delete password local state",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("keeps bound props explicit while boolean and numeric edits fail or apply atomically", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    let inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getByLabelText("Value bound value").textContent).toContain(
      "state.email",
    );
    expect(
      (within(inspector).getByRole("combobox", { name: "Value value source" }) as HTMLSelectElement)
        .value,
    ).toBe("email");
    expect(within(inspector).queryByRole("textbox", { name: "Value" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.password" }),
    );
    inspector = screen.getByRole("complementary", { name: "Inspector" });
    const secure = within(inspector).getByRole("switch", { name: "Secure" }) as HTMLInputElement;
    expect(secure.checked).toBe(true);
    fireEvent.click(secure);
    await waitFor(() => {
      expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
    });
    expect(within(inspector).getByRole("status").textContent).toBe("Updated Secure.");
    fireEvent.click(within(inspector).getByRole("button", { name: "Unset Secure" }));
    expect(within(inspector).getByRole("button", { name: "Set Secure" })).toBeTruthy();
    fireEvent.click(within(inspector).getByRole("button", { name: "Set Secure" }));
    await waitFor(() => {
      expect(within(inspector).getByRole("switch", { name: "Secure" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select Stack layer · sign-in.layout" }));
    inspector = screen.getByRole("complementary", { name: "Inspector" });
    const maxWidth = within(inspector).getByRole("spinbutton", {
      name: "Max Width",
    }) as HTMLInputElement;
    expect(maxWidth.value).toBe("420");
    fireEvent.change(maxWidth, { target: { value: "" } });
    fireEvent.blur(maxWidth);
    expect(maxWidth.getAttribute("aria-invalid")).toBe("true");
    expect(within(inspector).getByRole("alert").textContent).toBe("Enter a finite number.");
    expect(within(inspector).getByRole("status").textContent).toBe(
      "Edits stay in this session until save is implemented.",
    );

    fireEvent.change(maxWidth, { target: { value: "0" } });
    fireEvent.blur(maxWidth);
    expect(maxWidth.getAttribute("aria-invalid")).toBe("true");
    expect(
      within(inspector).getAllByText("This value does not satisfy the Catalog schema."),
    ).toHaveLength(1);

    fireEvent.change(maxWidth, { target: { value: "512" } });
    fireEvent.blur(maxWidth);
    await waitFor(() => {
      expect(maxWidth.getAttribute("aria-invalid")).toBe("false");
      expect(maxWidth.value).toBe("512");
    });
    expect(within(inspector).getByRole("status").textContent).toBe("Updated Max Width.");
  });

  it("resets local drafts across Source identities and qualifies repeated edit actions", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    let inspector = screen.getByRole("complementary", { name: "Inspector" });
    const emailPlaceholder = within(inspector).getByRole("textbox", {
      name: "Placeholder",
    }) as HTMLInputElement;
    expect(emailPlaceholder.value).toBe("");
    fireEvent.change(emailPlaceholder, { target: { value: "Uncommitted email draft" } });
    expect(emailPlaceholder.value).toBe("Uncommitted email draft");
    expect(within(inspector).getByRole("button", { name: "Apply Placeholder" })).toBeTruthy();
    expect(within(inspector).getByRole("button", { name: "Set Disabled" })).toBeTruthy();
    expect(within(inspector).getByRole("button", { name: "Set Invalid" })).toBeTruthy();
    expect(within(inspector).getByRole("button", { name: "Set Secure" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.password" }),
    );
    inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(
      (within(inspector).getByRole("textbox", { name: "Placeholder" }) as HTMLInputElement).value,
    ).toBe("");
    expect(within(inspector).getByRole("button", { name: "Apply Label" })).toBeTruthy();
    expect(within(inspector).getByRole("button", { name: "Apply Placeholder" })).toBeTruthy();
  });

  it("switches to the exact Catalog component library and filters only the local view", () => {
    renderApplication("/projects/account-app/surfaces/sign-in");

    const layersTab = screen.getByRole("tab", { name: "Layers" });
    const componentsTab = screen.getByRole("tab", { name: "Components" });
    const stateTab = screen.getByRole("tab", { name: "State" });
    const actionsTab = screen.getByRole("tab", { name: "Actions" });
    fireEvent.keyDown(layersTab, { key: "ArrowRight" });
    expect(componentsTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(componentsTab);
    fireEvent.keyDown(componentsTab, { key: "ArrowRight" });
    expect(stateTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(stateTab);
    fireEvent.keyDown(stateTab, { key: "ArrowRight" });
    expect(actionsTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(actionsTab);
    fireEvent.keyDown(actionsTab, { key: "ArrowRight" });
    expect(layersTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(layersTab);
    fireEvent.keyDown(layersTab, { key: "ArrowLeft" });
    expect(actionsTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(actionsTab);
    fireEvent.keyDown(actionsTab, { key: "Home" });
    expect(layersTab.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(layersTab, { key: "End" });
    expect(actionsTab.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(componentsTab);

    const componentsPanel = document.getElementById(
      componentsTab.getAttribute("aria-controls") ?? "",
    );
    expect(componentsPanel).toBeTruthy();
    const componentView = within(componentsPanel as HTMLElement);
    expect(componentView.getByText("run.desen.reference.sign-in")).toBeTruthy();
    expect(componentView.getByText("v0.1.0")).toBeTruthy();
    expect(componentView.getByRole("status").textContent).toBe("5 of 5 components");
    expect(componentView.getByText("Alert")).toBeTruthy();
    expect(componentView.getByText("Button")).toBeTruthy();
    expect(componentView.getByText("Stack")).toBeTruthy();
    expect(componentView.getByText("Text", { selector: "strong" })).toBeTruthy();
    expect(componentView.getByText("Text field")).toBeTruthy();

    const search = componentView.getByRole("searchbox", { name: "Search catalog components" });
    fireEvent.change(search, { target: { value: "feedback" } });
    expect(componentView.getByRole("status").textContent).toBe("1 of 5 components");
    expect(componentView.getByText("Alert")).toBeTruthy();
    expect(componentView.queryByText("Text field")).toBeNull();
    expect(window.location.pathname).toBe("/projects/account-app/surfaces/sign-in");

    fireEvent.click(layersTab);
    expect(document.getElementById(layersTab.getAttribute("aria-controls") ?? "")?.hidden).toBe(
      false,
    );
    expect(document.getElementById(componentsTab.getAttribute("aria-controls") ?? "")?.hidden).toBe(
      true,
    );
    fireEvent.click(componentsTab);
    const resumedSearch = componentView.getByRole("searchbox", {
      name: "Search catalog components",
    }) as HTMLInputElement;
    expect(resumedSearch.value).toBe("feedback");

    fireEvent.change(resumedSearch, { target: { value: "missing capability" } });
    expect(componentView.getByText("No catalog matches")).toBeTruthy();
    fireEvent.click(componentView.getByRole("button", { name: "Clear search" }));
    expect(componentView.getByRole("status").textContent).toBe("5 of 5 components");
    const target = componentView.getByRole("group", {
      name: "Placement target · Stack sign-in.layout default slot · 5 items · minimum 0 · no maximum",
    });
    expect(target.textContent).toContain("Stack");
    expect(target.textContent).toContain("sign-in.layout · default");
    expect(target.textContent).toContain("Click Add or drag a component anywhere in this panel");
    const alert = componentView.getByRole("button", {
      name: "Insert Alert into Stack sign-in.layout default slot at position 6",
    }) as HTMLButtonElement;
    expect(alert.disabled).toBe(false);
    expect(alert.draggable).toBe(false);
    expect(alert.querySelector("[draggable='true']")).toBeTruthy();
    expect(alert.textContent).toContain("Add");
    const changeTarget = componentView.getByRole("button", { name: "Change target in Layers" });
    fireEvent.click(changeTarget);
    expect(layersTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(layersTab);
    expect(
      screen
        .getByText("Choose a named slot in Layers, then return to Components.")
        .getAttribute("role"),
    ).toBe("status");
  });

  it("commits sign-in event handlers and complete actions through the live authoring session", async () => {
    const previewPreflight = vi.spyOn(authoringPreview, "prepareAuthoringPreviewBundle");
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));

    const panel = screen.getByRole("region", { name: "Events & Actions" });
    expect(within(panel).getByText("sign-in.email")).toBeTruthy();
    expect(within(panel).getByText("Handler added")).toBeTruthy();
    expect(within(panel).getByRole("article", { name: "action 1 in change" })).toBeTruthy();

    fireEvent.click(within(panel).getByRole("button", { name: "Delete change event handler" }));
    expect(within(panel).getByText("No handler")).toBeTruthy();
    const addHandler = within(panel).getByRole("button", { name: "Add change event handler" });
    expect(document.activeElement).toBe(addHandler);

    fireEvent.click(addHandler);
    const addAction = within(panel).getByRole("button", { name: "Add action to change" });
    expect(document.activeElement).toBe(addAction);
    fireEvent.click(addAction);

    const actionDraft = within(panel).getByRole("textbox", {
      name: "New action JSON for change",
    });
    fireEvent.change(actionDraft, {
      target: {
        value: '{"type":"state.set","path":"email","value":{"$ref":"event.value"}}',
      },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add complete action" }));

    expect(within(panel).getByRole("article", { name: "action 1 in change" })).toBeTruthy();
    expect(within(panel).getByRole("status").textContent).toBe("Added Set state to change.");
    expect(previewPreflight).toHaveBeenCalledTimes(4);
    const committedDocument = previewPreflight.mock.calls[3]?.[0];
    expect(committedDocument).toBeDefined();
    expect(
      committedDocument?.surfaces["sign-in"]?.root.slots?.default?.find(
        ({ id }) => id === "sign-in.email",
      )?.on?.change,
    ).toEqual([
      {
        type: "state.set",
        path: "email",
        value: { $ref: "event.value" },
      },
    ]);
    expect(previewPreflight.mock.results[3]?.value).toMatchObject({ ok: true });
    expect(await screen.findByRole("group", { name: "Sign-in adapter canvas" })).toBeTruthy();
    const managedSubtree = document.querySelector("[data-managed-capability-subtree]");
    expect(managedSubtree).toBeTruthy();
    expect(managedSubtree?.contains(panel)).toBe(false);
  });

  it("keeps the prior event projection and canvas when action preview preflight fails", async () => {
    const preparePreview = authoringPreview.prepareAuthoringPreviewBundle;
    const previewPreflight = vi
      .spyOn(authoringPreview, "prepareAuthoringPreviewBundle")
      .mockImplementationOnce(preparePreview)
      .mockReturnValueOnce(Object.freeze({ ok: false, reason: "publication-rejected" }));

    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    expect(previewPreflight).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));

    const panel = screen.getByRole("region", { name: "Events & Actions" });
    const baselineCanvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    const baselineManagedSubtree = document.querySelector(
      "[data-managed-capability-subtree='true']",
    );
    const baselineOverlay = screen.getByRole("status", { name: "Selected layer preview" });
    expect(within(panel).getByText("Handler added")).toBeTruthy();
    expect(within(panel).getByRole("article", { name: "action 1 in change" })).toBeTruthy();

    const deleteHandler = within(panel).getByRole("button", {
      name: "Delete change event handler",
    });
    fireEvent.click(deleteHandler);

    expect(previewPreflight).toHaveBeenCalledTimes(2);
    const rejectedCandidate = previewPreflight.mock.calls[1]?.[0];
    expect(rejectedCandidate).toBeDefined();
    expect(
      rejectedCandidate?.surfaces["sign-in"]?.root.slots?.default?.find(
        ({ id }) => id === "sign-in.email",
      )?.on?.change,
    ).toBeUndefined();
    expect(within(panel).getByRole("status").textContent).toBe(
      "The exact adapter preview could not accept this Source change.",
    );
    expect(within(panel).getByText("Handler added")).toBeTruthy();
    expect(within(panel).getByRole("article", { name: "action 1 in change" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sign-in adapter canvas" })).toBe(baselineCanvas);
    expect(document.querySelector("[data-managed-capability-subtree='true']")).toBe(
      baselineManagedSubtree,
    );
    expect(screen.getByRole("status", { name: "Selected layer preview" })).toBe(baselineOverlay);
    expect(within(baselineCanvas).getByLabelText("Email")).toBeTruthy();
  });

  it("switches modes accessibly while preserving selection, authoring views, and local drafts", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    let placeholder = within(inspector).getByRole("textbox", {
      name: "Placeholder",
    }) as HTMLInputElement;
    fireEvent.change(placeholder, { target: { value: "Work email" } });
    fireEvent.click(within(inspector).getByRole("button", { name: "Apply Placeholder" }));
    await waitFor(() => {
      expect(
        (
          within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
            "Email",
          ) as HTMLInputElement
        ).placeholder,
      ).toBe("Work email");
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: stackSlotName(5),
      }),
    );
    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    const componentsTab = within(authoring).getByRole("tab", { name: "Components" });
    const componentsPanel = document.getElementById(
      componentsTab.getAttribute("aria-controls") ?? "",
    ) as HTMLElement;
    const componentView = within(componentsPanel);
    const componentSearch = componentView.getByRole("searchbox", {
      name: "Search catalog components",
    }) as HTMLInputElement;
    fireEvent.change(componentSearch, { target: { value: "feedback" } });
    const alert = componentView.getByRole("button", {
      name: "Insert Alert into Stack sign-in.layout default slot at position 6",
    });
    const placementTarget = componentView.getByRole("group", {
      name: "Placement target · Stack sign-in.layout default slot · 5 items · minimum 0 · no maximum",
    });
    fireEvent.dragStart(alert.querySelector("[draggable='true']") as HTMLElement, {
      dataTransfer: {
        dropEffect: "none",
        effectAllowed: "none",
        getData: vi.fn(),
        setData: vi.fn(),
      },
    });
    expect(placementTarget.getAttribute("data-drag-active")).toBe("true");

    placeholder = within(inspector).getByRole("textbox", {
      name: "Placeholder",
    }) as HTMLInputElement;
    fireEvent.change(placeholder, { target: { value: "Unapplied design hint" } });
    placeholder.focus();

    const modeControl = screen.getByRole("group", { name: "Design and Run mode" });
    const designButton = within(modeControl).getByRole("button", { name: "Design" });
    const runButton = within(modeControl).getByRole("button", { name: "Run" });
    fireEvent.blur(placeholder, { relatedTarget: runButton });
    fireEvent.click(runButton);

    expect(document.activeElement).toBe(runButton);
    expect(runButton.getAttribute("aria-pressed")).toBe("true");
    expect(designButton.getAttribute("aria-pressed")).toBe("false");
    expect((authoring as HTMLElement).hidden).toBe(true);
    expect((inspector as HTMLElement).hidden).toBe(true);
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
    expect(screen.getByRole("status", { name: "Mode safety" }).textContent).toBe(
      "Run mode · controls are interactive against synthetic fixtures; live effects remain blocked.",
    );
    expect(
      screen.getByText(
        "Controls are live against this in-memory preview. Only the exact synthetic sign-in fixture is available; navigation, resources, storage, publication, activation, integration, and production calls remain blocked.",
      ),
    ).toBeTruthy();
    const runCanvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    expect((within(runCanvas).getByLabelText("Email") as HTMLInputElement).placeholder).toBe(
      "Work email",
    );

    fireEvent.click(designButton);

    expect(document.activeElement).toBe(designButton);
    expect(designButton.getAttribute("aria-pressed")).toBe("true");
    expect((authoring as HTMLElement).hidden).toBe(false);
    expect((inspector as HTMLElement).hidden).toBe(false);
    expect(componentsTab.getAttribute("aria-selected")).toBe("true");
    expect(componentSearch.value).toBe("feedback");
    await waitFor(() => {
      expect(placementTarget.getAttribute("data-drag-active")).toBe("false");
    });
    expect(
      (
        within(screen.getByRole("complementary", { name: "Inspector" })).getByRole("textbox", {
          name: "Placeholder",
        }) as HTMLInputElement
      ).value,
    ).toBe("Unapplied design hint");
    expect(screen.getByRole("status", { name: "Selected layer preview" }).textContent).toContain(
      "sign-in.email",
    );
    expect(
      (
        within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
          "Email",
        ) as HTMLInputElement
      ).placeholder,
    ).toBe("Work email");
  });

  it("rejects stale hidden authoring callbacks while Run interactions leave Source unchanged", async () => {
    const previewPreflight = vi.spyOn(authoringPreview, "prepareAuthoringPreviewBundle");
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const emailLayer = screen.getByRole("button", {
      name: "Select Text field layer · sign-in.email",
    });
    fireEvent.click(emailLayer);
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    const placeholder = within(inspector).getByRole("textbox", {
      name: "Placeholder",
    }) as HTMLInputElement;
    fireEvent.change(placeholder, { target: { value: "Run must not commit this" } });
    const staleApply = within(inspector).getByRole("button", { name: "Apply Placeholder" });
    const authoring = screen.getByRole("complementary", { name: "Authoring panel" });
    const staleDelete = within(authoring).getByRole("button", {
      name: "Delete Text field layer · sign-in.email",
    });
    const modeControl = screen.getByRole("group", { name: "Design and Run mode" });
    const runButton = within(modeControl).getByRole("button", { name: "Run" });
    const designButton = within(modeControl).getByRole("button", { name: "Design" });
    fireEvent.click(runButton);
    const preflightCountInRun = previewPreflight.mock.calls.length;

    fireEvent.click(emailLayer);
    fireEvent.click(staleApply);
    fireEvent.click(staleDelete);
    expect(previewPreflight).toHaveBeenCalledTimes(preflightCountInRun);

    const runCanvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    const liveEmail = within(runCanvas).getByLabelText("Email") as HTMLInputElement;
    await waitFor(() => expect(liveEmail.matches(":disabled")).toBe(false));
    await act(async () => {
      fireEvent.change(liveEmail, { target: { value: "runtime@example.com" } });
      await Promise.resolve();
    });
    await waitFor(() => expect(liveEmail.value).toBe("runtime@example.com"));
    expect(previewPreflight).toHaveBeenCalledTimes(preflightCountInRun);

    fireEvent.click(designButton);
    expect(
      screen.getByRole("button", { name: "Deselect Text field layer · sign-in.email" }),
    ).toBeTruthy();
    expect(screen.getByRole("status", { name: "Selected layer preview" })).toBeTruthy();
    expect(
      (
        within(screen.getByRole("complementary", { name: "Inspector" })).getByRole("textbox", {
          name: "Placeholder",
        }) as HTMLInputElement
      ).value,
    ).toBe("Run must not commit this");
    expect(
      (
        within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
          "Email",
        ) as HTMLInputElement
      ).placeholder,
    ).toBe("");
    expect(previewPreflight).toHaveBeenCalledTimes(preflightCountInRun);
  });

  it("keeps Catalog scenarios transient across Design and Run without changing Source values", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const fidelity = screen.getByRole("region", { name: "Preview context and fidelity" });
    expect(within(fidelity).getByText("Synthetic preview")).toBeTruthy();
    expect(within(fidelity).getByText("Same production adapters")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    const scenarioRegion = screen.getByRole("region", { name: "Scenario preview" });
    const scenario = within(scenarioRegion).getByRole("combobox", {
      name: "Component values",
    }) as HTMLSelectElement;
    expect([...scenario.options].map(({ textContent }) => textContent)).toEqual([
      "Source values",
      "default",
      "invalid",
    ]);
    expect(within(scenarioRegion).getByText("Preview only · not saved or published")).toBeTruthy();

    fireEvent.change(scenario, { target: { value: "catalog:invalid" } });
    const invalidEmail = (await within(
      screen.getByRole("group", { name: "Sign-in adapter canvas" }),
    ).findByLabelText("Email")) as HTMLInputElement;
    await waitFor(() => {
      expect(invalidEmail.value).toBe("bad");
      expect(invalidEmail.getAttribute("aria-invalid")).toBe("true");
    });
    expect(screen.getByText("Scenario preview")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(
      (
        within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
          "Email",
        ) as HTMLInputElement
      ).value,
    ).toBe("bad");
    expect(within(fidelity).getByText("Same production adapters")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    const restoredScenario = within(
      screen.getByRole("region", { name: "Scenario preview" }),
    ).getByRole("combobox", { name: "Component values" }) as HTMLSelectElement;
    expect(restoredScenario.value).toBe("catalog:invalid");
    fireEvent.change(restoredScenario, { target: { value: "source" } });
    await waitFor(() => {
      expect(
        (
          within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
            "Email",
          ) as HTMLInputElement
        ).value,
      ).toBe("");
    });
  });

  it("runs real pending lifecycle and settles only exact synthetic success and failure fixtures", async () => {
    window.history.replaceState(null, "", "/projects/account-app/surfaces/sign-in");
    render(
      <StrictMode>
        <DesenAppApplication />
      </StrictMode>,
    );
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    let controls = screen.getByRole("complementary", { name: "Run controls" });
    const synthetic = within(controls).getByRole("radio", { name: /^Synthetic/ });
    const integration = within(controls).getByRole("radio", { name: /^Integration/ });
    const production = within(controls).getByRole("radio", { name: /^Production/ });
    expect((synthetic as HTMLInputElement).checked).toBe(true);
    expect((integration as HTMLInputElement).disabled).toBe(true);
    expect((production as HTMLInputElement).disabled).toBe(true);
    expect(within(controls).getByText(/Integration and production calls are off/)).toBeTruthy();

    let outcome = within(controls).getByRole("combobox", {
      name: "Next sign-in outcome",
    }) as HTMLSelectElement;
    expect([...outcome.options].map(({ value }) => value)).toEqual([
      "success",
      "invalidCredentials",
    ]);
    expect([...outcome.options].map(({ value }) => value)).not.toContain("pending");
    fireEvent.change(outcome, { target: { value: "invalidCredentials" } });

    const canvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    const email = within(canvas).getByLabelText("Email") as HTMLInputElement;
    const password = within(canvas).getByLabelText("Password") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(email, {
        target: { value: "person@example.com" },
      });
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.change(password, {
        target: { value: "fixture-only" },
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(email.value).toBe("person@example.com");
      expect(password.value).toBe("fixture-only");
    });
    fireEvent.click(within(canvas).getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      controls = screen.getByRole("complementary", { name: "Run controls" });
      expect(within(controls).getByRole("status").textContent).toContain("Pending");
      expect(
        (
          within(controls).getByRole("button", {
            name: "Complete fixture",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
      expect(
        within(canvas).getByRole("button", { name: "Sign in" }).getAttribute("aria-busy"),
      ).toBe("true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByRole("complementary", { name: "Run controls" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    controls = screen.getByRole("complementary", { name: "Run controls" });
    expect(within(controls).getByRole("status").textContent).toContain("Pending");

    fireEvent.click(within(controls).getByRole("button", { name: "Complete fixture" }));
    expect((await within(canvas).findByRole("alert")).textContent).toBe(
      "Sign-in failed. Check your details and try again.",
    );
    await waitFor(() => {
      expect(within(controls).getByRole("status").textContent).toContain("Invalid credentials");
    });

    outcome = within(controls).getByRole("combobox", {
      name: "Next sign-in outcome",
    }) as HTMLSelectElement;
    fireEvent.change(outcome, { target: { value: "success" } });
    fireEvent.click(within(canvas).getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(within(controls).getByRole("status").textContent).toContain("Pending");
    });
    fireEvent.click(within(controls).getByRole("button", { name: "Complete fixture" }));
    await waitFor(() => {
      expect(within(controls).getByRole("status").textContent).toContain(
        "Production navigation remains blocked",
      );
      expect(within(canvas).queryByRole("alert")).toBeNull();
      expect(window.location.pathname).toBe("/projects/account-app/surfaces/sign-in");
    });
  });

  it("revokes the previous fixture authority synchronously when a scenario replaces its Bundle", async () => {
    const createFixtureController = authoringFixtures.createAuthoringSignInFixtureController;
    const controllers: ReturnType<typeof createFixtureController>[] = [];
    const contexts: Parameters<typeof createFixtureController>[0][] = [];
    vi.spyOn(authoringFixtures, "createAuthoringSignInFixtureController").mockImplementation(
      (context) => {
        contexts.push(context);
        const controller = createFixtureController(context);
        controllers.push(controller);
        return controller;
      },
    );

    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    const firstController = controllers[0];
    const firstContext = contexts[0];
    expect(firstController).toBeDefined();
    expect(firstContext).toBeDefined();
    if (firstController === undefined || firstContext === undefined) {
      throw new Error("Expected the initial fixture authority.");
    }
    const request = {
      context: {
        ...firstContext,
        requestId: "fixture-authority-replacement",
      },
      capabilityId: "com.example.auth/signIn",
      invocationAlias: "signIn",
      input: {},
      effect: "network" as const,
    };
    const pending = firstController.operationPort.invoke(request);
    expect(firstController.read().status).toBe("pending");

    const scenario = within(screen.getByRole("complementary", { name: "Inspector" })).getByRole(
      "combobox",
      { name: "Component values" },
    );
    fireEvent.change(scenario, { target: { value: "catalog:invalid" } });

    const replacement = controllers.at(-1);
    expect(replacement).toBeDefined();
    expect(replacement).not.toBe(firstController);
    expect(firstController.operationPort.invoke(request)).toEqual({ status: "denied" });
    await expect(Promise.resolve(pending)).resolves.toEqual({ status: "denied" });
    expect(replacement?.read().status).toBe("idle");
    await waitFor(() => expect(firstController.read().status).toBe("disposed"));
  });

  it("resets the ephemeral mode to Design when a new surface route mounts", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("button", { name: "Run" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    const surfaceNavigation = screen.getByRole("navigation", { name: "Account app surfaces" });
    fireEvent.click(within(surfaceNavigation).getByRole("link", { name: /Recovery/ }));

    expect(window.location.pathname).toBe("/projects/account-app/surfaces/recovery");
    expect(screen.getByRole("button", { name: "Design" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Run" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("complementary", { name: "Authoring panel" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Mode safety" }).textContent).toContain(
      "Design mode",
    );
  });

  it("does not substitute the sign-in Source tree or adapter canvas for another preview surface", () => {
    renderApplication("/projects/account-app/surfaces/recovery");

    expect(screen.getByText("No Source tree for Recovery")).toBeTruthy();
    expect(
      screen.getByText(
        "This preview surface has no exact Source fixture. DESEN will not substitute the sign-in tree.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Sign-in layer hierarchy" })).toBeNull();
    expect(screen.queryByText("sign-in.layout")).toBeNull();
    expect(screen.queryByRole("group", { name: "Sign-in adapter canvas" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Sign in" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();

    const componentsTab = screen.getByRole("tab", { name: "Components" });
    fireEvent.click(componentsTab);
    const componentsPanel = document.getElementById(
      componentsTab.getAttribute("aria-controls") ?? "",
    );
    expect(within(componentsPanel as HTMLElement).getByRole("status").textContent).toBe(
      "5 of 5 components",
    );
    const componentView = within(componentsPanel as HTMLElement);
    const target = componentView.getByRole("group", {
      name: "Placement target · choose a named slot",
    });
    expect(target.textContent).toContain("No drop target selected");
    expect(target.textContent).toContain("Choose a named slot in Layers");
    expect(componentView.getByRole("button", { name: "Choose slot in Layers" })).toBeTruthy();
    const alert = componentView.getByRole("button", {
      name: "Alert · choose a named slot first",
    }) as HTMLButtonElement;
    expect(alert.disabled).toBe(true);
    expect(alert.draggable).toBe(false);
  });

  it("removes the managed sign-in tree synchronously when routing to an unsupported surface", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    expect(await screen.findByRole("status", { name: "Selected layer preview" })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
    const surfaces = screen.getByRole("navigation", { name: "Account app surfaces" });
    fireEvent.click(within(surfaces).getByRole("link", { name: /Recovery/ }));

    expect(window.location.pathname).toBe("/projects/account-app/surfaces/recovery");
    expect(screen.queryByRole("heading", { level: 2, name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sign-in adapter canvas" })).toBeNull();
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
    await waitFor(() => {
      expect(screen.queryByLabelText("Email")).toBeNull();
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    });
  });

  it("guides a catalog-less project without inventing a surface or enabled action", () => {
    renderApplication("/projects/checkout-pilot");

    expect(screen.getByRole("heading", { level: 1, name: "Checkout pilot" })).toBeTruthy();
    expect(screen.getByText("No surfaces yet.")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Connect a capability catalog to begin." }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Connect catalog" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("navigation", { name: "Checkout pilot surfaces" })).toBeNull();
  });

  it.each([
    {
      pathname: "/projects/missing-project",
      context:
        "That project is not present in this workspace. No similarly named project was substituted.",
      title: "Project not found · DESEN",
    },
    {
      pathname: "/projects/account-app/surfaces/missing-surface",
      context: "“Account app” does not contain that surface. The project remains unchanged.",
      title: "Surface not found · Account app · DESEN",
    },
    {
      pathname: "/projects?mode=design",
      context: "DESEN did not guess a project or silently redirect you somewhere else.",
      title: "Not found · DESEN",
    },
    {
      pathname: "/#workspace",
      context: "DESEN did not guess a project or silently redirect you somewhere else.",
      title: "Not found · DESEN",
    },
  ])("fails closed for $pathname", ({ pathname, context, title }) => {
    renderApplication(pathname);

    expect(
      screen.getByRole("heading", { level: 1, name: "This workspace route does not exist." }),
    ).toBeTruthy();
    expect(screen.getByText(context)).toBeTruthy();
    expect(screen.getByText(pathname)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Return to projects" }).getAttribute("href")).toBe(
      "/projects",
    );
    expect(screen.queryByRole("button", { name: /publish|save|run/i })).toBeNull();
    expect(document.title).toBe(title);
  });
});
