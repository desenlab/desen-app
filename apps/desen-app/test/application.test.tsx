// @vitest-environment jsdom
import { act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DesenAppApplication } from "../src/application.js";

function renderApplication(pathname = "/projects") {
  window.history.replaceState(null, "", pathname);
  return render(<DesenAppApplication />);
}

describe("Desen App application shell", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.title = "";
  });

  afterEach(() => {
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

  it("renders the exact selected surface, layer hierarchy, and read-only managed adapter canvas", async () => {
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
    expect(within(hierarchy).getByText("default slot")).toBeTruthy();
    expect(within(hierarchy).getByText("Conditional")).toBeTruthy();
    expect(within(hierarchy).queryByRole("tree")).toBeNull();
    expect(within(hierarchy).queryByRole("treeitem")).toBeNull();
    expect(hierarchy.querySelector("[aria-selected]")).toBeNull();
    expect(within(hierarchy).getAllByRole("button")).toHaveLength(6);
    expect(
      within(hierarchy)
        .getAllByRole("button")
        .every((button) => button.getAttribute("aria-pressed") === "false"),
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
        "Catalog-backed property edits stay in this session and refresh the exact adapter preview. Selection and Inspector chrome never enter the managed component tree. Save, control-plane publication, and activation remain unavailable.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeTruthy();
    expect(screen.getByText("Select a layer", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^run$/i })).toBeNull();
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
    expect(screen.getByText("Session draft")).toBeTruthy();
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
    ).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText("Preview unavailable")).toBeNull();
    expect(screen.getByText("Session draft")).toBeTruthy();

    fireEvent.keyDown(text, { key: "Escape" });
    expect(text.value).toBe("Sign in");
  });

  it("keeps bound props locked while boolean and numeric edits fail or apply atomically", async () => {
    renderApplication("/projects/account-app/surfaces/sign-in");
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    let inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getByLabelText("Value bound value").textContent).toContain(
      "state.email",
    );
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
    expect(within(inspector).getByRole("status").textContent).toBe("Enter a finite number.");

    fireEvent.change(maxWidth, { target: { value: "0" } });
    fireEvent.blur(maxWidth);
    expect(maxWidth.getAttribute("aria-invalid")).toBe("true");
    expect(
      within(inspector).getAllByText("This value does not satisfy the Catalog schema."),
    ).toHaveLength(2);

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
    fireEvent.keyDown(layersTab, { key: "ArrowRight" });
    expect(componentsTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(componentsTab);
    fireEvent.keyDown(componentsTab, { key: "ArrowRight" });
    expect(layersTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(layersTab);
    fireEvent.keyDown(layersTab, { key: "ArrowLeft" });
    expect(componentsTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(componentsTab);
    fireEvent.keyDown(componentsTab, { key: "Home" });
    expect(layersTab.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(layersTab, { key: "End" });
    expect(componentsTab.getAttribute("aria-selected")).toBe("true");

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
    expect(
      (
        componentView.getByRole("searchbox", {
          name: "Search catalog components",
        }) as HTMLInputElement
      ).value,
    ).toBe("feedback");

    fireEvent.change(search, { target: { value: "missing capability" } });
    expect(componentView.getByText("No catalog matches")).toBeTruthy();
    fireEvent.click(componentView.getByRole("button", { name: "Clear search" }));
    expect(componentView.getByRole("status").textContent).toBe("5 of 5 components");
    expect(screen.queryByRole("button", { name: /insert|add|drag/i })).toBeNull();
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
