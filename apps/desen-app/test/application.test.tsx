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

  it("renders a guided projects home with explicit landmarks and current navigation", async () => {
    renderApplication();

    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    const main = screen.getByRole("main");
    expect(main).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeTruthy();

    const projectsLink = screen.getByRole("link", { name: "Projects" });
    expect(projectsLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Capability catalogs").getAttribute("aria-disabled")).toBe("true");
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
    expect(
      screen.getByRole("complementary", { name: "A project is not a blank canvas." }),
    ).toBeTruthy();
    expect(await screen.findByText("One source")).toBeTruthy();
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

    expect(window.location.pathname).toBe("/projects/account-app/surfaces/sign-in");
    const projectHeading = screen.getByRole("heading", { level: 1, name: "Account app" });
    await waitFor(() => {
      expect(document.activeElement).toBe(projectHeading);
    });
    expect(document.title).toBe("Sign-in · Account app · DESEN");

    const surfaceNavigation = screen.getByRole("navigation", { name: "Account app surfaces" });
    const signInLink = within(surfaceNavigation).getByRole("link", { name: /Sign-in/ });
    expect(signInLink.getAttribute("aria-current")).toBe("page");

    fireEvent.click(within(surfaceNavigation).getByRole("link", { name: /Recovery/ }));
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

  it("renders the exact selected surface without claiming editor or publishing behavior", () => {
    renderApplication("/projects/account-app/surfaces/sign-in");

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Account app" }).getAttribute("href")).toBe(
      "/projects/account-app",
    );
    expect(within(breadcrumb).getByText("Sign-in").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(screen.getAllByText("account.sign-in")).toHaveLength(2);
    expect(
      screen.getByText(
        "This shell does not mutate Source data, render a canvas or publish a revision yet.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^run$/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /design|run/i })).toBeNull();
    expect(document.querySelector("canvas")).toBeNull();
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
