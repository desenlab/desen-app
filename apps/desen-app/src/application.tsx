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
import breadcrumbSeparatorUrl from "./assets/breadcrumb-separator.svg";
import desenLogoUrl from "./assets/desen-logo.svg";
import plusUrl from "./assets/plus.svg";
import settingsUrl from "./assets/settings.svg";
import themeUrl from "./assets/theme.svg";
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
  const project = route.kind === "project" ? findDesenAppProject(route.projectId) : undefined;
  const surface =
    project === undefined || route.kind !== "project" || route.surfaceId === undefined
      ? undefined
      : findDesenAppSurface(project, route.surfaceId);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <AppLink className={styles.brand} href="/projects">
          <img alt="" height="24" src={desenLogoUrl} width="24" />
          <span className={styles.visuallyHidden}>DESEN</span>
        </AppLink>

        {project === undefined ? (
          <div className={styles.pathCluster}>
            <nav aria-label="Primary" className={styles.pathDock}>
              <span className={styles.pathMuted}>OBSS Draft</span>
              <img alt="" height="12" src={breadcrumbSeparatorUrl} width="12" />
              <AppLink
                ariaCurrent={projectsActive ? "page" : undefined}
                className={styles.pathCurrent}
                href="/projects"
              >
                Projects
              </AppLink>
            </nav>
            {route.kind === "projects" ? (
              <button
                aria-describedby="new-project-unavailable"
                aria-label="New project"
                className={styles.addButton}
                disabled
                type="button"
              >
                <img alt="" height="12" src={plusUrl} width="12" />
              </button>
            ) : null}
          </div>
        ) : (
          <nav aria-label="Breadcrumb" className={styles.pathDock}>
            <AppLink className={styles.pathMutedLink} href="/projects">
              Projects
            </AppLink>
            <img alt="" height="12" src={breadcrumbSeparatorUrl} width="12" />
            {surface === undefined ? (
              <span aria-current="page" className={styles.pathCurrent}>
                {project.name}
              </span>
            ) : (
              <>
                <AppLink
                  className={styles.pathMutedLink}
                  href={createDesenAppProjectPath(project.id)}
                >
                  {project.name}
                </AppLink>
                <img alt="" height="12" src={breadcrumbSeparatorUrl} width="12" />
                <span aria-current="page" className={styles.pathCurrent}>
                  {surface.name}
                </span>
              </>
            )}
          </nav>
        )}

        <div className={styles.utilityDock} aria-label="Workspace utilities">
          <span aria-disabled="true" aria-label="Theme" className={styles.iconTool} title="Theme">
            <img alt="" height="24" src={themeUrl} width="24" />
          </span>
          <span
            aria-disabled="true"
            aria-label="Capability catalogs"
            className={styles.iconTool}
            title="Capability catalogs · available in a later M09 slice"
          >
            <img alt="" height="24" src={settingsUrl} width="24" />
          </span>
          <span className={styles.profileAvatar} aria-label="Selman Ay">
            SA
          </span>
        </div>
        <span className={styles.visuallyHidden} id="new-project-unavailable">
          Project creation unlocks with catalog setup.
        </span>
      </div>
    </header>
  );
}

function SurfaceState({ state }: Readonly<{ readonly state: DesenAppSurfaceSummary["state"] }>) {
  const label = state === "navigable" ? "Navigable" : "Not configured";
  const stateClass =
    state === "navigable" ? styles.statePillNavigable : styles.statePillNotConfigured;
  return <span className={`${styles.statePill} ${stateClass}`}>{label}</span>;
}

function ProjectCard({ project }: Readonly<{ readonly project: DesenAppProjectSummary }>) {
  const destination = createDesenAppProjectPath(project.id);
  return (
    <article className={styles.projectCard}>
      <div aria-hidden="true" className={styles.projectPreview}>
        <div className={styles.previewTopline}>
          <span>{project.surfaces.length} surfaces</span>
          <span>Preview data</span>
        </div>
        <div className={styles.previewDiagram}>
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className={styles.projectCardFooter}>
        <div className={styles.projectCardTitle}>
          <h3>{project.name}</h3>
          <p>{project.catalog ?? "No catalog connected"}</p>
        </div>
        <AppLink className={styles.secondaryButton} href={destination}>
          {project.surfaces.length > 0 ? "Open project" : "Review setup"}
        </AppLink>
      </div>

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

function ProjectsHome() {
  const searchHelpId = useId();
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
    <section className={styles.projectsHome} aria-labelledby="projects-title">
      <h1 className={styles.visuallyHidden} data-route-heading id="projects-title" tabIndex={-1}>
        Projects
      </h1>

      <div className={styles.collectionToolbar}>
        <div className={styles.collectionHeading}>
          <div>
            <h2 id="all-projects-title">All projects</h2>
            <p>Open a bounded product surface in OBSS Draft.</p>
          </div>
          <span className={styles.previewBadge}>Preview data</span>
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
        </div>
        <p className={styles.visuallyHidden} id={searchHelpId}>
          Results update as you type.
        </p>
      </div>

      <p className={styles.previewNotice} aria-label="Preview data boundary">
        Project names and metadata are inert examples. No Source, save, diagnostics, revision or
        publication state is being read.
      </p>

      <div className={styles.resultsHeading}>
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
          <p>No matches</p>
          <h3>No project matches “{query.trim()}”.</h3>
          <span>Try a project, catalog or surface name.</span>
          <button className={styles.textButton} onClick={() => setQuery("")} type="button">
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}

function ProjectShell({
  project,
  selectedSurface,
}: Readonly<{
  readonly project: DesenAppProjectSummary;
  readonly selectedSurface: DesenAppSurfaceSummary | undefined;
}>) {
  if (selectedSurface === undefined) {
    return (
      <section className={styles.surfaceGallery} aria-labelledby="surfaces-title">
        <h1 className={styles.visuallyHidden} data-route-heading id="project-title" tabIndex={-1}>
          {project.name}
        </h1>

        <div className={styles.collectionToolbar}>
          <div className={styles.collectionHeading}>
            <div>
              <h2 id="surfaces-title">All surfaces</h2>
              <p>{project.description}</p>
            </div>
            <span className={styles.previewBadge}>Preview data</span>
          </div>
        </div>

        {project.surfaces.length > 0 ? (
          <nav aria-label={`${project.name} surfaces`}>
            <ul className={styles.surfaceGalleryList}>
              {project.surfaces.map((surface) => (
                <li key={surface.id}>
                  <AppLink
                    className={styles.surfaceCard}
                    href={createDesenAppProjectPath(project.id, surface.id)}
                  >
                    <span aria-hidden="true" className={styles.surfacePreview}>
                      <span className={styles.surfacePreviewBar} />
                      <span className={styles.surfacePreviewField} />
                      <span className={styles.surfacePreviewField} />
                      <span className={styles.surfacePreviewAction} />
                    </span>
                    <span className={styles.surfaceCardFooter}>
                      <span>
                        <strong>{surface.name}</strong>
                        <small>{surface.capabilityId}</small>
                      </span>
                      <SurfaceState state={surface.state} />
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <div className={styles.setupEmpty}>
            <p>No surfaces yet.</p>
            <h2 id="workspace-title">Connect a capability catalog to begin.</h2>
            <span>
              A DESEN surface starts from an explicit, versioned capability—not an unrestricted
              blank canvas.
            </span>
            <button className={styles.primaryButton} disabled type="button">
              Connect catalog
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.surfaceEditor} aria-labelledby="workspace-title">
      <h1 className={styles.visuallyHidden} data-route-heading id="project-title" tabIndex={-1}>
        {project.name}
      </h1>

      <div className={styles.surfaceFrame}>
        <div className={styles.surfaceFrameHeader}>
          <div>
            <h2 id="workspace-title">{selectedSurface.name}</h2>
            <span>{selectedSurface.capabilityId}</span>
          </div>
          <SurfaceState state={selectedSurface.state} />
        </div>

        <div className={styles.surfaceFrameBody}>
          <div className={styles.framePlaceholder} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Navigation ready</p>
          <span>Adapter canvas is not available in this slice.</span>
        </div>

        <div className={styles.boundaryNote}>
          <strong>Preview data</strong>
          <span>
            This shell does not mutate Source data, render a canvas or publish a revision yet.
          </span>
        </div>
      </div>

      <div className={styles.editorStatus}>
        <span>{project.navigationStatus}</span>
        <span aria-hidden="true">·</span>
        <span>{selectedSurface.detail}</span>
      </div>
    </section>
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
    </div>
  );
}
