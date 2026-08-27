import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import {
  createDesenAppProjectPath,
  navigateDesenApp,
  readDesenAppLocation,
  readDesenAppRoute,
  readDesenAppServerLocation,
  subscribeDesenAppNavigation,
} from "./project-navigation.js";
import { DESEN_APP_PROJECTS, findDesenAppProject, findDesenAppSurface } from "./project-data.js";
import styles from "./application.module.css";

import type { MouseEvent, ReactNode } from "react";
import type { DesenAppRoute } from "./project-navigation.js";
import type { DesenAppProjectSummary, DesenAppSurfaceSummary } from "./project-data.js";

interface AppLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly ariaCurrent?: "page" | undefined;
}

function AppLink({ href, children, className, ariaCurrent }: AppLinkProps) {
  function followLink(event: MouseEvent<HTMLAnchorElement>): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigateDesenApp(href);
  }

  return (
    <a aria-current={ariaCurrent} className={className} href={href} onClick={followLink}>
      {children}
    </a>
  );
}

function SkipToMainContentLink() {
  function moveFocusToMain(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    document.getElementById("desen-app-content")?.focus();
  }

  return (
    <a className={styles.skipLink} href="#desen-app-content" onClick={moveFocusToMain}>
      Skip to main content
    </a>
  );
}

function AppHeader({ route }: Readonly<{ readonly route: DesenAppRoute }>) {
  const projectsActive = route.kind === "projects" || route.kind === "project";
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <AppLink className={styles.brand} href="/projects">
          <span className={styles.brandMark} aria-hidden="true">
            D
          </span>
          <span>DESEN</span>
        </AppLink>

        <nav aria-label="Primary" className={styles.primaryNav}>
          <AppLink
            ariaCurrent={projectsActive ? "page" : undefined}
            className={`${styles.navLink} ${projectsActive ? styles.navLinkActive : ""}`}
            href="/projects"
          >
            Projects
          </AppLink>
          <span
            aria-disabled="true"
            className={styles.navDisabled}
            title="Available in a later M09 slice"
          >
            Capability catalogs
          </span>
        </nav>

        <div className={styles.profile} aria-label="Preview workspace">
          <span className={styles.profileAvatar} aria-hidden="true">
            DW
          </span>
          <span className={styles.profileCopy}>
            <strong>Demo workspace</strong>
            <span>Local shell preview</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function SectionHeading({
  eyebrow,
  title,
  id,
}: Readonly<{
  readonly eyebrow: string;
  readonly title: string;
  readonly id?: string | undefined;
}>) {
  return (
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function SurfaceState({ state }: Readonly<{ readonly state: DesenAppSurfaceSummary["state"] }>) {
  const label = state === "navigable" ? "Navigable" : "Not configured";
  const stateClass =
    state === "navigable" ? styles.statePillNavigable : styles.statePillNotConfigured;
  return <span className={`${styles.statePill} ${stateClass}`}>{label}</span>;
}

function ProjectCard({ project }: Readonly<{ readonly project: DesenAppProjectSummary }>) {
  const destination = createDesenAppProjectPath(project.id, project.surfaces[0]?.id);
  return (
    <article className={styles.projectCard}>
      <div className={styles.projectCardTopline}>
        <div>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
        </div>
        <AppLink className={styles.secondaryButton} href={destination}>
          {project.surfaces.length > 0 ? "Open project" : "Review setup"}
        </AppLink>
      </div>

      <dl className={styles.projectStats}>
        <div>
          <dt>Surfaces</dt>
          <dd>{project.surfaces.length}</dd>
        </div>
        <div>
          <dt>Catalog</dt>
          <dd>{project.catalog ?? "Not connected"}</dd>
        </div>
        <div>
          <dt>Shell status</dt>
          <dd>{project.navigationStatus}</dd>
        </div>
        <div>
          <dt>Data source</dt>
          <dd>Inert preview</dd>
        </div>
      </dl>

      {project.surfaces.length > 0 ? (
        <ul aria-label={`${project.name} surfaces`} className={styles.surfaceChips}>
          {project.surfaces.map((surface) => (
            <li key={surface.id}>
              <AppLink href={createDesenAppProjectPath(project.id, surface.id)}>
                <span>{surface.name}</span>
                <small>{surface.detail}</small>
              </AppLink>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

const WORKFLOW_STEPS = Object.freeze([
  Object.freeze({
    number: "01",
    title: "Connect",
    detail: "Choose one trusted capability package and exact version.",
  }),
  Object.freeze({
    number: "02",
    title: "Compose",
    detail: "Build through declared components, slots and bindings.",
  }),
  Object.freeze({
    number: "03",
    title: "Verify + publish",
    detail: "Run fixtures, review diagnostics, then activate safely.",
  }),
]);

function WorkflowGuide() {
  return (
    <aside className={styles.guideCard} aria-labelledby="bounded-surface-title">
      <p className={styles.eyebrow}>Start with a bounded surface</p>
      <h2 id="bounded-surface-title">A project is not a blank canvas.</h2>
      <p className={styles.guideIntro}>
        It starts with trusted capabilities, explicit slots, fixtures and a safe release channel.
      </p>
      <ol className={styles.workflowSteps}>
        {WORKFLOW_STEPS.map((step) => (
          <li key={step.number}>
            <span className={styles.stepNumber}>{step.number}</span>
            <span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function RoutePreview() {
  return (
    <section aria-labelledby="route-preview-title" className={styles.activitySection}>
      <SectionHeading
        eyebrow="Guided preview"
        id="route-preview-title"
        title="Routes you can inspect"
      />
      <ol className={styles.activityList}>
        <li>
          <span>
            <strong>Account app / Sign-in</strong>
            <small>Exact project and surface route</small>
          </span>
          <span>Fixture</span>
        </li>
        <li>
          <span>
            <strong>Account app / Recovery</strong>
            <small>Breadcrumb and active surface state</small>
          </span>
          <span>Fixture</span>
        </li>
        <li>
          <span>
            <strong>Checkout pilot</strong>
            <small>Setup-safe project route with no surfaces</small>
          </span>
          <span>Fixture</span>
        </li>
      </ol>
    </section>
  );
}

function ProjectContract() {
  return (
    <aside className={styles.contractCard} aria-labelledby="project-contract-title">
      <p className={styles.eyebrow}>Project contract</p>
      <h2 className={styles.visuallyHidden} id="project-contract-title">
        Project contract
      </h2>
      <dl>
        <div>
          <dt>One source</dt>
          <dd>Design and Run use the same document.</dd>
        </div>
        <div>
          <dt>Trusted code</dt>
          <dd>Only registered capabilities execute.</dd>
        </div>
        <div>
          <dt>Visible truth</dt>
          <dd>Fidelity and diagnostics are never hidden.</dd>
        </div>
        <div>
          <dt>Safe release</dt>
          <dd>Publish and activation stay separate.</dd>
        </div>
      </dl>
    </aside>
  );
}

function ProjectsHome() {
  const searchHelpId = useId();
  const newProjectHelpId = useId();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const projects = DESEN_APP_PROJECTS.filter((project) => {
    if (normalizedQuery === "") return true;
    const searchable = [
      project.name,
      project.description,
      project.catalog ?? "",
      ...project.surfaces.flatMap((surface) => [surface.name, surface.capabilityId]),
    ]
      .join(" ")
      .toLocaleLowerCase("en-US");
    return searchable.includes(normalizedQuery);
  });

  return (
    <>
      <section className={styles.hero} aria-labelledby="projects-title">
        <div>
          <p className={styles.eyebrow}>Your workspace</p>
          <h1 data-route-heading id="projects-title" tabIndex={-1}>
            Projects
          </h1>
          <p>Open a bounded product surface or continue from a trusted starting point.</p>
        </div>
        <div className={styles.heroActions}>
          <label className={styles.searchField}>
            <span className={styles.visuallyHidden}>Search projects</span>
            <input
              aria-describedby={searchHelpId}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search projects"
              type="search"
              value={query}
            />
          </label>
          <button
            aria-describedby={newProjectHelpId}
            className={styles.primaryButton}
            disabled
            type="button"
          >
            New project
          </button>
          <p className={styles.availabilityNote} id={newProjectHelpId}>
            Project creation unlocks with catalog setup.
          </p>
        </div>
        <p className={styles.visuallyHidden} id={searchHelpId}>
          Results update as you type.
        </p>
      </section>

      <aside className={styles.previewNotice} aria-label="Preview data boundary">
        <strong>Navigation preview</strong>
        <span>
          Project names and metadata are inert examples. No Source, save, diagnostics, revision or
          publication state is being read.
        </span>
      </aside>

      <div className={styles.projectsLayout}>
        <section aria-labelledby="recent-projects-title">
          <div className={styles.resultsHeading}>
            <SectionHeading
              eyebrow="Workspace"
              id="recent-projects-title"
              title="Recent projects"
            />
            <p aria-live="polite" role="status">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </p>
          </div>
          {projects.length > 0 ? (
            <div className={styles.projectList}>
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.eyebrow}>No matches</p>
              <h3>No project matches “{query.trim()}”.</h3>
              <p>Try a project, catalog or surface name.</p>
              <button className={styles.textButton} onClick={() => setQuery("")} type="button">
                Clear search
              </button>
            </div>
          )}
        </section>
        <WorkflowGuide />
      </div>

      <div className={styles.lowerGrid}>
        <RoutePreview />
        <ProjectContract />
      </div>
    </>
  );
}

function ProjectShell({
  project,
  selectedSurface,
}: Readonly<{
  readonly project: DesenAppProjectSummary;
  readonly selectedSurface: DesenAppSurfaceSummary | undefined;
}>) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
        <ol>
          <li>
            <AppLink href="/projects">Projects</AppLink>
          </li>
          {selectedSurface === undefined ? (
            <li aria-current="page">{project.name}</li>
          ) : (
            <>
              <li>
                <AppLink href={createDesenAppProjectPath(project.id)}>{project.name}</AppLink>
              </li>
              <li aria-current="page">{selectedSurface.name}</li>
            </>
          )}
        </ol>
      </nav>

      <section className={styles.projectHero} aria-labelledby="project-title">
        <div>
          <p className={styles.eyebrow}>Project shell</p>
          <h1 data-route-heading id="project-title" tabIndex={-1}>
            {project.name}
          </h1>
          <p>{project.description}</p>
        </div>
        <div className={styles.projectHealth}>
          <span className={styles.healthDot} aria-hidden="true" />
          <span>
            <strong>{project.navigationStatus}</strong>
            <small>Inert preview data</small>
          </span>
        </div>
      </section>

      <div className={styles.shellLayout}>
        <aside className={styles.surfaceSidebar} aria-labelledby="surfaces-title">
          <div className={styles.sidebarHeading}>
            <p className={styles.eyebrow}>Project structure</p>
            <h2 id="surfaces-title">Surfaces</h2>
          </div>
          {project.surfaces.length > 0 ? (
            <nav aria-label={`${project.name} surfaces`}>
              <ul className={styles.surfaceNavigation}>
                {project.surfaces.map((surface) => {
                  const active = surface.id === selectedSurface?.id;
                  return (
                    <li key={surface.id}>
                      <AppLink
                        ariaCurrent={active ? "page" : undefined}
                        className={`${styles.surfaceNavLink} ${active ? styles.surfaceNavLinkActive : ""}`}
                        href={createDesenAppProjectPath(project.id, surface.id)}
                      >
                        <span>
                          <strong>{surface.name}</strong>
                          <small>{surface.capabilityId}</small>
                        </span>
                        <SurfaceState state={surface.state} />
                      </AppLink>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : (
            <div className={styles.sidebarEmpty}>
              <p>No surfaces yet.</p>
              <span>Connect a trusted catalog before composing.</span>
            </div>
          )}
        </aside>

        <section className={styles.workspaceStage} aria-labelledby="workspace-title">
          {selectedSurface === undefined ? (
            <div className={styles.workspaceEmpty}>
              <p className={styles.eyebrow}>
                {project.catalog === undefined ? "Catalog required" : "Choose a surface"}
              </p>
              <h2 id="workspace-title">
                {project.catalog === undefined
                  ? "Connect a capability catalog to begin."
                  : "Choose a surface to open its workspace."}
              </h2>
              <p>
                {project.catalog === undefined
                  ? "A DESEN project starts from explicit, versioned capabilities—not an unrestricted blank canvas."
                  : "The project shell keeps your starting decision clear before authoring tools appear."}
              </p>
              <button className={styles.primaryButton} disabled type="button">
                {project.catalog === undefined ? "Connect catalog" : "Select a surface"}
              </button>
            </div>
          ) : (
            <>
              <div className={styles.workspaceToolbar}>
                <div>
                  <p className={styles.eyebrow}>Authoring workspace</p>
                  <h2 id="workspace-title">{selectedSurface.name}</h2>
                  <span>{selectedSurface.capabilityId}</span>
                </div>
                <SurfaceState state={selectedSurface.state} />
              </div>
              <div className={styles.workspaceCanvas}>
                <div className={styles.workspaceMessage}>
                  <span className={styles.workspaceMonogram} aria-hidden="true">
                    {selectedSurface.name.slice(0, 1)}
                  </span>
                  <p className={styles.eyebrow}>Navigation ready</p>
                  <h3>Your authoring workspace has a stable home.</h3>
                  <p>
                    Component browsing and the real adapter canvas will join this shell in the next
                    focused slices.
                  </p>
                </div>
              </div>
              <div className={styles.boundaryNote}>
                <span className={styles.healthDot} aria-hidden="true" />
                <p>
                  <strong>Honest boundary</strong>
                  <span>
                    This shell does not mutate Source data, render a canvas or publish a revision
                    yet.
                  </span>
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function NotFound({
  pathname,
  context,
}: Readonly<{ readonly pathname: string; readonly context?: string }>) {
  return (
    <section className={styles.notFound} aria-labelledby="not-found-title">
      <p className={styles.eyebrow}>Navigation stopped safely</p>
      <h1 data-route-heading id="not-found-title" tabIndex={-1}>
        This workspace route does not exist.
      </h1>
      <p>{context ?? "DESEN did not guess a project or silently redirect you somewhere else."}</p>
      <code>{pathname}</code>
      <AppLink className={styles.primaryButtonLink} href="/projects">
        Return to projects
      </AppLink>
    </section>
  );
}

function routeTitle(route: DesenAppRoute): string {
  if (route.kind === "projects") return "Projects · DESEN";
  if (route.kind === "not-found") return "Not found · DESEN";
  const project = findDesenAppProject(route.projectId);
  if (project === undefined) return "Project not found · DESEN";
  if (route.surfaceId === undefined) return `${project.name} · DESEN`;
  const surface = findDesenAppSurface(project, route.surfaceId);
  return surface === undefined
    ? `Surface not found · ${project.name} · DESEN`
    : `${surface.name} · ${project.name} · DESEN`;
}

function RouteView({ route }: Readonly<{ readonly route: DesenAppRoute }>) {
  if (route.kind === "projects") return <ProjectsHome />;
  if (route.kind === "not-found") return <NotFound pathname={route.pathname} />;

  const project = findDesenAppProject(route.projectId);
  if (project === undefined) {
    return (
      <NotFound
        context="That project is not present in this workspace. No similarly named project was substituted."
        pathname={route.pathname}
      />
    );
  }
  if (route.surfaceId === undefined)
    return <ProjectShell project={project} selectedSurface={undefined} />;

  const surface = findDesenAppSurface(project, route.surfaceId);
  if (surface === undefined) {
    return (
      <NotFound
        context={`“${project.name}” does not contain that surface. The project remains unchanged.`}
        pathname={route.pathname}
      />
    );
  }
  return <ProjectShell project={project} selectedSurface={surface} />;
}

/** M09-T01 product shell with exact project routes and no editor-behavior substitution. */
export function DesenAppApplication() {
  const routeLocation = useSyncExternalStore(
    subscribeDesenAppNavigation,
    readDesenAppLocation,
    readDesenAppServerLocation,
  );
  const route = readDesenAppRoute(routeLocation);
  const previousRouteLocation = useRef(routeLocation);

  useEffect(() => {
    document.title = routeTitle(route);
    if (previousRouteLocation.current !== routeLocation) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelector<HTMLElement>("[data-route-heading]")?.focus({ preventScroll: true });
      previousRouteLocation.current = routeLocation;
    }
  }, [routeLocation, route]);

  return (
    <div className={styles.app}>
      <SkipToMainContentLink />
      <AppHeader route={route} />
      <main className={styles.main} id="desen-app-content" tabIndex={-1}>
        <RouteView route={route} />
      </main>
      <footer className={styles.footer}>
        <span>DESEN workspace · local preview</span>
        <span>Exact routes · explicit boundaries</span>
        <span>M09 shell preview · no live data</span>
      </footer>
    </div>
  );
}
