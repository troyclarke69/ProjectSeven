"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime, formatTagInput, parseTagInput } from "@/lib/projects";
import { DocumentationHistoryEntry, ProjectRecord } from "@/lib/types";

type SetupStatus = {
  firebaseAdminReady: boolean;
  firebaseClientReady: boolean;
  geminiReady: boolean;
  githubWebhookSecretReady: boolean;
  geminiModel: string;
  requiredEnv: {
    firebaseAdmin: string[];
    firebaseClient: string[];
    gemini: string[];
    githubWebhook: string[];
  };
};

async function loadProjects() {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error("Project load failed.");
  }

  const payload = (await response.json()) as { projects: ProjectRecord[] };
  return payload.projects;
}

async function persistProject(project: ProjectRecord) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ project }),
  });

  if (!response.ok) {
    throw new Error("Project save failed.");
  }

  const payload = (await response.json()) as { project: ProjectRecord };
  return payload.project;
}

type SaveState = Record<string, "idle" | "saving" | "saved" | "error">;

export function ProjectDashboard() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [globalMessage, setGlobalMessage] = useState("");
  const [saveStates, setSaveStates] = useState<SaveState>({});
  const [history, setHistory] = useState<DocumentationHistoryEntry[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

  useEffect(() => {
    loadProjects()
      .then((data) => {
        setProjects(data);
        setActiveProjectId(data[0]?.id ?? "");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SetupStatus | null) => {
        setSetupStatus(payload);
      })
      .catch(() => {
        setSetupStatus(null);
      });
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setHistory([]);
      return;
    }

    fetch(`/api/projects/${activeProjectId}/history`)
      .then((response) => (response.ok ? response.json() : { history: [] }))
      .then((payload: { history: DocumentationHistoryEntry[] }) => {
        setHistory(payload.history);
      })
      .catch(() => {
        setHistory([]);
      });
  }, [activeProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );

  const trackedProjects = projects.length;
  const documentedProjects = projects.filter((project) => Boolean(project.documentation.trim())).length;
  const stackCount = new Set(projects.flatMap((project) => [...project.platforms, ...project.tools])).size;
  const webhookUrl =
    typeof window === "undefined" ? "/api/github/webhook" : `${window.location.origin}/api/github/webhook`;

  const updateProject = (projectId: string, updater: (current: ProjectRecord) => ProjectRecord) => {
    setProjects((current) =>
      current.map((project) => (project.id === projectId ? updater(project) : project)),
    );
  };

  const saveProject = async (project: ProjectRecord, shouldRegenerateDocs = true) => {
    setSaveStates((current) => ({ ...current, [project.id]: "saving" }));

    const baseProject = {
      ...project,
      modifiedAt: new Date().toISOString(),
    };

    try {
      let finalProject = baseProject;

      if (shouldRegenerateDocs) {
        const response = await fetch("/api/documentation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project: baseProject,
            persist: true,
            reason: "metadata_update",
            source: "dashboard",
          }),
        });

        if (!response.ok) {
          throw new Error("Documentation refresh failed.");
        }

        const payload = (await response.json()) as {
          project: ProjectRecord;
        };

        finalProject = payload.project;
      } else {
        finalProject = (await persistProject(baseProject)) ?? baseProject;
      }

      updateProject(project.id, () => finalProject);
      setSaveStates((current) => ({ ...current, [project.id]: "saved" }));
      setGlobalMessage(
        shouldRegenerateDocs
          ? "Project saved and documentation refreshed."
          : "Project saved without regenerating documentation.",
      );
      if (finalProject.id === activeProjectId) {
        const historyResponse = await fetch(`/api/projects/${finalProject.id}/history`);
        if (historyResponse.ok) {
          const payload = (await historyResponse.json()) as { history: DocumentationHistoryEntry[] };
          setHistory(payload.history);
        }
      }
    } catch {
      setSaveStates((current) => ({ ...current, [project.id]: "error" }));
      setGlobalMessage("Saving failed. Review your Firebase or Gemini configuration and try again.");
    }
  };

  const addProject = () => {
    const next: ProjectRecord = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      version: "0.1.0",
      platforms: [],
      tools: [],
      startDate: new Date().toISOString().slice(0, 10),
      modifiedAt: new Date().toISOString(),
      githubUrl: "",
      websiteUrl: "",
      status: "Planning",
      documentation: "",
      documentationUpdatedAt: "",
    };
    setProjects((current) => [next, ...current]);
    setActiveProjectId(next.id);
    setGlobalMessage("New project row added. Fill it in and save when ready.");
  };

  return (
    <main className="shell">
      <div className="frame">
        <section className="hero">
          <div className="panel hero-card">
            <p className="eyebrow">Projectregistry</p>
            {/* <h1>Spreadsheet control for your active portfolio.</h1> */}
            {/* <p>
              Track project metadata in one place, save to Firebase, and regenerate markdown documentation
              through Gemini whenever a record changes.
            </p> */}
            <div className="hero-grid">
              <div className="metric">
                <strong>{trackedProjects}</strong>
                <span>Tracked projects</span>
              </div>
              <div className="metric">
                <strong>{documentedProjects}</strong>
                <span>With current docs</span>
              </div>
              <div className="metric">
                <strong>{stackCount}</strong>
                <span>Platforms and tools listed</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <ul className="status-list">
              <li>
                <span className="status-label">Storage mode</span>
                <span className="status-pill">Server-managed project store</span>
              </li>
              <li>
                <span className="status-label">Documentation route</span>
                <span className="status-pill">Ready for metadata-triggered refreshes</span>
              </li>
              <li>
                <span className="status-label">Portfolio message</span>
                <span className="status-pill">{globalMessage || "Edit any row to get started"}</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="panel board">
          <div className="toolbar">
            <div>
              <h2>Projects Sheet</h2>
              <p>
                Inline-edit the registry. Save any row to persist it and optionally refresh the markdown
                documentation snapshot.
              </p>
            </div>
            <div className="actions">
              <button className="button button-secondary" onClick={addProject} type="button">
                Add project
              </button>
              <button
                className="button button-primary"
                onClick={() => selectedProject && saveProject(selectedProject, true)}
                type="button"
                disabled={!selectedProject}
              >
                Save selected row
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Version</th>
                  <th>Platforms</th>
                  <th>Tools</th>
                  <th>Start Date</th>
                  <th>Modified</th>
                  <th>GitHub URL</th>
                  <th>Website URL</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11}>Loading projects...</td>
                  </tr>
                ) : (
                  projects.map((project) => (
                    <tr key={project.id} onClick={() => setActiveProjectId(project.id)}>
                      <td>
                        <input
                          value={project.name}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="Project name"
                        />
                      </td>
                      <td>
                        <textarea
                          value={project.description}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="What is this project?"
                        />
                      </td>
                      <td>
                        <input
                          value={project.version}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({ ...current, version: event.target.value }))
                          }
                          placeholder="0.1.0"
                        />
                      </td>
                      <td>
                        <input
                          value={formatTagInput(project.platforms)}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({
                              ...current,
                              platforms: parseTagInput(event.target.value),
                            }))
                          }
                          placeholder="Web, iOS, Android"
                        />
                      </td>
                      <td>
                        <input
                          value={formatTagInput(project.tools)}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({
                              ...current,
                              tools: parseTagInput(event.target.value),
                            }))
                          }
                          placeholder="Next.js, Firebase, Gemini"
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={project.startDate}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({ ...current, startDate: event.target.value }))
                          }
                        />
                      </td>
                      <td>{formatDateTime(project.modifiedAt)}</td>
                      <td>
                        <input
                          value={project.githubUrl}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({
                              ...current,
                              githubUrl: event.target.value,
                            }))
                          }
                          placeholder="https://github.com/..."
                        />
                      </td>
                      <td>
                        <input
                          value={project.websiteUrl}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({
                              ...current,
                              websiteUrl: event.target.value,
                            }))
                          }
                          placeholder="https://..."
                        />
                      </td>
                      <td>
                        <input
                          value={project.status}
                          onChange={(event) =>
                            updateProject(project.id, (current) => ({ ...current, status: event.target.value }))
                          }
                          placeholder="Planning"
                        />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="button button-primary"
                            onClick={() => saveProject(project, true)}
                            type="button"
                          >
                            Save + doc
                          </button>
                          <button
                            className="button button-ghost"
                            onClick={() => saveProject(project, false)}
                            type="button"
                          >
                            Save only
                          </button>
                          {saveStates[project.id] === "error" ? <span className="badge">Retry needed</span> : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="details">
          <article className="panel stack">
            <h2>Project Focus</h2>
            {selectedProject ? (
              <div className="project-summary">
                <div className="summary-row">
                  <span className="summary-label">Current project</span>
                  <strong>{selectedProject.name || "Untitled project"}</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Description</span>
                  <span>{selectedProject.description || "Add a description to make the generated docs sharper."}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Platforms</span>
                  <span>{formatTagInput(selectedProject.platforms) || "Not listed yet"}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Tools</span>
                  <span>{formatTagInput(selectedProject.tools) || "Not listed yet"}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Last documentation refresh</span>
                  <span>{formatDateTime(selectedProject.documentationUpdatedAt)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Automation note</span>
                  <span className="hint">
                    Metadata edits already trigger documentation refresh. The next step is connecting GitHub webhooks
                    so code pushes call the same route.
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Documentation snapshots</span>
                  <span>{history.length} recent versions stored</span>
                </div>
              </div>
            ) : (
              <p className="empty-state">Select a project row to inspect its details.</p>
            )}
          </article>

          <article className="panel stack">
            <h3>Documentation Preview</h3>
            {selectedProject?.documentation ? (
              <div className="doc-card">{selectedProject.documentation}</div>
            ) : (
              <p className="empty-state">
                Save a row with "Save + doc" and the generated markdown summary will appear here.
              </p>
            )}
          </article>
        </section>

        <section className="panel stack">
          <div className="setup-header">
            <div>
              <h3>Setup Guide</h3>
              <p className="hint">
                Wire the credentials when you are ready. Until then, projects keep working with the local `.data`
                fallback and template-based documentation.
              </p>
            </div>
            <span className="status-pill">
              {setupStatus?.firebaseAdminReady || setupStatus?.geminiReady
                ? "Partial integration ready"
                : "Local-only mode"}
            </span>
          </div>

          <div className="setup-grid">
            <article className="setup-card">
              <div className="setup-card-top">
                <h4>Firebase Admin</h4>
                <span className={setupStatus?.firebaseAdminReady ? "setup-ready" : "setup-pending"}>
                  {setupStatus?.firebaseAdminReady ? "Configured" : "Needed"}
                </span>
              </div>
              <p className="hint">
                Enables Firestore persistence for projects and documentation history, plus safe server-side webhook
                writes.
              </p>
              <div className="code-list">
                {(setupStatus?.requiredEnv.firebaseAdmin ?? []).map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
            </article>

            <article className="setup-card">
              <div className="setup-card-top">
                <h4>Gemini</h4>
                <span className={setupStatus?.geminiReady ? "setup-ready" : "setup-pending"}>
                  {setupStatus?.geminiReady ? "Configured" : "Needed"}
                </span>
              </div>
              <p className="hint">
                Powers AI-generated project documentation. Current model target:{" "}
                <strong>{setupStatus?.geminiModel ?? "gemini-2.5-flash"}</strong>.
              </p>
              <div className="code-list">
                {(setupStatus?.requiredEnv.gemini ?? []).map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
            </article>

            <article className="setup-card">
              <div className="setup-card-top">
                <h4>GitHub Webhook</h4>
                <span className={setupStatus?.githubWebhookSecretReady ? "setup-ready" : "setup-pending"}>
                  {setupStatus?.githubWebhookSecretReady ? "Secret set" : "Secret needed"}
                </span>
              </div>
              <p className="hint">
                Use a GitHub `push` webhook so repo changes trigger documentation refreshes for the matching project.
              </p>
              <div className="setup-field">
                <span className="summary-label">Webhook URL</span>
                <code>{webhookUrl}</code>
              </div>
              <div className="code-list">
                {(setupStatus?.requiredEnv.githubWebhook ?? []).map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
            </article>
          </div>

          <div className="setup-steps">
            <div className="summary-row">
              <span className="summary-label">1. Add env vars</span>
              <span>
                Populate the keys from <code>.env.local</code> using the names listed above.
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">2. Restart the app</span>
              <span>
                Restart <code>npm run dev</code> after changing env values so the server picks them up.
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">3. Link each repo</span>
              <span>
                Put the exact GitHub repository URL into the project row. That is how webhook events find the right
                project.
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">4. Create the webhook</span>
              <span>
                In GitHub, create a webhook for <code>push</code> events only, using the URL above and the shared
                secret from <code>GITHUB_WEBHOOK_SECRET</code>.
              </span>
            </div>
          </div>
        </section>

        <section className="panel stack">
          <h3>Documentation History</h3>
          {history.length ? (
            <div className="project-summary">
              {history.map((entry) => (
                <div className="summary-row" key={entry.id}>
                  <span className="summary-label">
                    {entry.reason.replace("_", " ")} via {entry.source.replace("_", " ")}
                  </span>
                  <strong>{formatDateTime(entry.createdAt)}</strong>
                  <span className="hint">
                    {entry.repository ? `${entry.repository}` : "No repository context"}{" "}
                    {entry.branch ? `on ${entry.branch}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Documentation history will appear after the first refreshed save.</p>
          )}
        </section>
      </div>
    </main>
  );
}
