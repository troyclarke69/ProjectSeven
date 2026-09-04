"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { formatDateTime, formatTagInput, parseTagInput } from "@/lib/projects";
import { DocumentationHistoryEntry, EffortEntry, EffortSummary, ProjectRecord } from "@/lib/types";

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

const idleThresholdMinutes = 20;
const chartWidth = 420;
const chartHeight = 210;

const formatMinutes = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs ? `${hrs}h ${mins}m` : `${mins}m`;
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

async function loadEffort(projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const response = await fetch(`/api/effort${query}`);
  if (!response.ok) {
    throw new Error("Effort load failed.");
  }

  return (await response.json()) as {
    entries: EffortEntry[];
    summary: EffortSummary[];
  };
}

type SaveState = Record<string, "idle" | "saving" | "saved" | "error">;

type ToastTone = "success" | "error" | "info";
type ToastMessage = { id: number; message: string; tone: ToastTone };

export function ProjectDashboardV2() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [globalMessage, setGlobalMessage] = useState("");
  const [saveStates, setSaveStates] = useState<SaveState>({});
  const [history, setHistory] = useState<DocumentationHistoryEntry[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [effortEntries, setEffortEntries] = useState<EffortEntry[]>([]);
  const [effortSummary, setEffortSummary] = useState<EffortSummary[]>([]);
  const [manualMinutes, setManualMinutes] = useState("30");
  const [manualNotes, setManualNotes] = useState("");
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [tagDrafts, setTagDrafts] = useState<Record<string, { platforms?: string; tools?: string }>>({});
  const [timerProjectId, setTimerProjectId] = useState<string>("");
  const [manualEntryProjectId, setManualEntryProjectId] = useState<string>("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const pushToast = (message: string, tone: ToastTone = "info") => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismissToast(id), 4000);
  };

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
      setEffortEntries([]);
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

    loadEffort(activeProjectId)
      .then((payload) => {
        setEffortEntries(payload.entries);
        setEffortSummary(payload.summary);
      })
      .catch(() => {
        setEffortEntries([]);
      });
  }, [activeProjectId]);

  useEffect(() => {
    loadEffort()
      .then((payload) => {
        setEffortSummary(payload.summary);
      })
      .catch(() => {
        setEffortSummary([]);
      });
  }, []);

  useEffect(() => {
    if (!timerStartedAt) {
      setTimerSeconds(0);
      return;
    }

    const tick = () => {
      setTimerSeconds(Math.max(0, Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000)));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [timerStartedAt]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );

  const selectedSummary = useMemo(
    () => effortSummary.find((entry) => entry.projectId === activeProjectId) ?? null,
    [activeProjectId, effortSummary],
  );

  const timerProject = useMemo(
    () => projects.find((project) => project.id === timerProjectId) ?? selectedProject,
    [timerProjectId, projects, selectedProject],
  );

  const manualEntryProject = useMemo(
    () => projects.find((project) => project.id === manualEntryProjectId) ?? selectedProject,
    [manualEntryProjectId, projects, selectedProject],
  );

  // Default each effort mechanism's target project to whatever is selected
  // in the Projects Sheet, but only when the current choice is missing or
  // no longer exists -- an explicit dropdown pick is never overridden.
  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    setTimerProjectId((current) => (projects.some((project) => project.id === current) ? current : selectedProject.id));
    setManualEntryProjectId((current) =>
      projects.some((project) => project.id === current) ? current : selectedProject.id,
    );
  }, [selectedProject, projects]);

  const trackedProjects = projects.length;
  const documentedProjects = projects.filter((project) => Boolean(project.documentation.trim())).length;
  const totalHumanMinutes = effortSummary.reduce((total, entry) => total + entry.humanMinutes, 0);
  const totalAiMinutes = effortSummary.reduce((total, entry) => total + entry.aiMinutes, 0);
  const totalTrackedMinutes = totalHumanMinutes + totalAiMinutes;
  const stackCount = new Set(projects.flatMap((project) => [...project.platforms, ...project.tools])).size;
  const [webhookUrl, setWebhookUrl] = useState("/api/github/webhook");

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/github/webhook`);
  }, []);

  const topChartProjects = effortSummary.slice(0, 6);
  const maxChartMinutes = Math.max(...topChartProjects.map((entry) => entry.totalMinutes), 1);
  const pieTotal = Math.max(totalTrackedMinutes, 1);
  const pieRadius = 56;
  const pieCx = 72;
  const pieCy = 72;
  const humanAngle = (totalHumanMinutes / pieTotal) * Math.PI * 2;
  const humanX = pieCx + pieRadius * Math.sin(humanAngle);
  const humanY = pieCy - pieRadius * Math.cos(humanAngle);
  const largeArc = humanAngle > Math.PI ? 1 : 0;
  const humanPath =
    totalTrackedMinutes === 0
      ? ""
      : `M ${pieCx} ${pieCy - pieRadius} A ${pieRadius} ${pieRadius} 0 ${largeArc} 1 ${humanX} ${humanY} L ${pieCx} ${pieCy} Z`;

  const updateProject = (projectId: string, updater: (current: ProjectRecord) => ProjectRecord) => {
    setProjects((current) =>
      current.map((project) => (project.id === projectId ? updater(project) : project)),
    );
  };

  const refreshEffortState = async (projectId?: string) => {
    const payload = await loadEffort(projectId);
    setEffortSummary(payload.summary);
    if (projectId) {
      setEffortEntries(payload.entries);
    }
  };

  const postEffortEntry = async (entry: Omit<EffortEntry, "id" | "createdAt">) => {
    const response = await fetch("/api/effort", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      throw new Error("Effort save failed.");
    }

    const payload = (await response.json()) as {
      entry: EffortEntry;
      summary: EffortSummary[];
    };

    setEffortSummary(payload.summary);
    if (entry.projectId === activeProjectId) {
      const selectedPayload = await loadEffort(entry.projectId);
      setEffortEntries(selectedPayload.entries);
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
    pushToast("New project row added. Fill it in and save when ready.", "info");
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
      setTagDrafts((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setSaveStates((current) => ({ ...current, [project.id]: "saved" }));
      const savedMessage = shouldRegenerateDocs
        ? "Project saved and documentation refreshed."
        : "Project saved without regenerating documentation.";
      setGlobalMessage(savedMessage);
      pushToast(savedMessage, "success");

      if (finalProject.id === activeProjectId) {
        const historyResponse = await fetch(`/api/projects/${finalProject.id}/history`);
        if (historyResponse.ok) {
          const payload = (await historyResponse.json()) as { history: DocumentationHistoryEntry[] };
          setHistory(payload.history);
        }
        await refreshEffortState(finalProject.id);
      } else {
        await refreshEffortState();
      }
    } catch {
      setSaveStates((current) => ({ ...current, [project.id]: "error" }));
      const saveFailedMessage = "Saving failed. Review your database and AI provider configuration and try again.";
      setGlobalMessage(saveFailedMessage);
      pushToast(saveFailedMessage, "error");
    }
  };

  const submitManualEntry = async () => {
    if (!manualEntryProject) {
      return;
    }

    const durationMinutes = Math.max(1, Number.parseInt(manualMinutes, 10) || 0);
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - durationMinutes * 60000);

    try {
      await postEffortEntry({
        projectId: manualEntryProject.id,
        projectName: manualEntryProject.name || "Untitled project",
        actor: "human",
        source: "manual_entry",
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMinutes,
        notes: manualNotes || "Manual time entry",
        idleMinutesExcluded: 0,
      });
      setManualNotes("");
      setGlobalMessage("Manual human effort saved.");
      pushToast("Manual human effort saved.", "success");
    } catch {
      setGlobalMessage("Manual effort entry failed to save.");
      pushToast("Manual effort entry failed to save.", "error");
    }
  };

  const startTimer = () => {
    setTimerStartedAt(new Date().toISOString());
    const timerStartedMessage = `Timer started. Sessions will later exclude roughly ${idleThresholdMinutes} idle minutes when auto-tracking is added.`;
    setGlobalMessage(timerStartedMessage);
    pushToast(timerStartedMessage, "info");
  };

  const stopTimer = async () => {
    if (!timerProject || !timerStartedAt) {
      return;
    }

    const endedAt = new Date().toISOString();
    const durationMinutes = Math.max(1, Math.round((Date.now() - new Date(timerStartedAt).getTime()) / 60000));

    try {
      await postEffortEntry({
        projectId: timerProject.id,
        projectName: timerProject.name || "Untitled project",
        actor: "human",
        source: "manual_timer",
        startedAt: timerStartedAt,
        endedAt,
        durationMinutes,
        notes: manualNotes || "Timed work session",
        idleMinutesExcluded: 0,
      });
      setTimerStartedAt(null);
      setManualNotes("");
      setGlobalMessage("Timed human effort saved.");
      pushToast("Timed human effort saved.", "success");
    } catch {
      setGlobalMessage("Timed effort entry failed to save.");
      pushToast("Timed effort entry failed to save.", "error");
    }
  };

  return (
    <main className="shell">
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="frame">
        {/* hero-single below matches the CSS override added while the right-hand
            status panel is disabled -- remove that class if the panel comes back. */}
        <section className="hero hero-single">
          <div className="panel hero-card">
            <div className="account-bar">
              <p className="eyebrow">Projectry</p>
              <div className="account-bar-right">
                {session?.user && (
                  <div className="account-bar-user">
                    <span>{session.user.email}</span>
                    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })}>
                      Sign out
                    </button>
                  </div>
                )}
                <div className="account-links">
                  <Link href="/guide">View guide</Link>
                  <a href="/project-seven-guide.md" download>
                    Download guide
                  </a>
                  <a href="https://github.com/troyclarke69/ProjectSeven" target="_blank" rel="noopener noreferrer">
                    Source on GitHub
                  </a>
                </div>
              </div>
            </div>
            {/* <h1>Spreadsheet control for your active portfolio.</h1>
            <p>
              Track project metadata, AI documentation activity, and human effort in one place so the work picture
              stays useful instead of scattered.
            </p> */}
            <div className="hero-grid">
              <div className="metric">
                <strong>{trackedProjects}</strong>
                <span>Tracked projects</span>
              </div>
              <div className="metric">
                <strong>{formatMinutes(totalHumanMinutes)}</strong>
                <span>Human effort logged</span>
              </div>
              <div className="metric">
                <strong>{formatMinutes(totalAiMinutes)}</strong>
                <span>AI effort logged</span>
              </div>
            </div>
          </div>

          {/* Storage mode / idle threshold / portfolio message panel --
              temporarily disabled, kept for later use.
          <div className="panel">
            <ul className="status-list">
              <li>
                <span className="status-label">Storage mode</span>
                <span className="status-pill">Server-managed project store</span>
              </li>
              <li>
                <span className="status-label">Idle threshold plan</span>
                <span className="status-pill">{idleThresholdMinutes} min default target</span>
              </li>
              <li>
                <span className="status-label">Portfolio message</span>
                <span className="status-pill">{globalMessage || "Edit any row to get started"}</span>
              </li>
            </ul>
          </div>
          */}
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
            <table className="sheet-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Version</th>
                  <th>Tools</th>
                  <th>Status</th>
                  <th rowSpan={2}>Actions</th>
                </tr>
                <tr>
                  <th>Start Date</th>
                  <th>Modified</th>
                  <th>Platforms</th>
                  <th>GitHub URL</th>
                  <th>Website URL</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Loading projects...</td>
                  </tr>
                ) : (
                  projects.flatMap((project) => {
                    const isActive = project.id === activeProjectId;
                    const rowClass = (position: "first" | "second") =>
                      `sheet-row-${position}${isActive ? " is-active" : ""}`;

                    return [
                      <tr
                        key={`${project.id}-a`}
                        className={rowClass("first")}
                        onClick={() => setActiveProjectId(project.id)}
                      >
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
                            value={tagDrafts[project.id]?.tools ?? formatTagInput(project.tools)}
                            onChange={(event) => {
                              const { value } = event.target;
                              setTagDrafts((current) => ({
                                ...current,
                                [project.id]: { ...current[project.id], tools: value },
                              }));
                              updateProject(project.id, (current) => ({
                                ...current,
                                tools: parseTagInput(value),
                              }));
                            }}
                            placeholder="Next.js, Firebase, Gemini"
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
                        <td rowSpan={2}>
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
                            {saveStates[project.id] === "error" ? (
                              <span className="badge">Retry needed</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>,
                      <tr
                        key={`${project.id}-b`}
                        className={rowClass("second")}
                        onClick={() => setActiveProjectId(project.id)}
                      >
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
                            value={tagDrafts[project.id]?.platforms ?? formatTagInput(project.platforms)}
                            onChange={(event) => {
                              const { value } = event.target;
                              setTagDrafts((current) => ({
                                ...current,
                                [project.id]: { ...current[project.id], platforms: value },
                              }));
                              updateProject(project.id, (current) => ({
                                ...current,
                                platforms: parseTagInput(value),
                              }));
                            }}
                            placeholder="Web, iOS, Android"
                          />
                        </td>
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
                      </tr>,
                    ];
                  })
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
                  <span className="summary-label">Human time</span>
                  <span>{formatMinutes(selectedSummary?.humanMinutes ?? 0)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">AI time</span>
                  <span>{formatMinutes(selectedSummary?.aiMinutes ?? 0)}</span>
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

        <section className="details">
          <article className="panel stack">
            <div className="setup-header">
              <div>
                <h3>Effort Tracking</h3>
                <p className="hint">
                  Human and AI effort now live together. AI time is logged automatically whenever documentation is
                  refreshed. Human time can be tracked manually now, with local idle filtering planned next.
                </p>
              </div>
              <span className="status-pill">Idle exclusion target: {idleThresholdMinutes} min</span>
            </div>

            <div className="effort-grid">
              <div className="setup-card">
                <div className="setup-card-top">
                  <h4>Live Timer</h4>
                  <span className={timerStartedAt ? "setup-ready" : "setup-pending"}>
                    {timerStartedAt ? "Running" : "Stopped"}
                  </span>
                </div>
                <label className="field">
                  <span className="summary-label">Project</span>
                  <select
                    value={timerProjectId}
                    onChange={(event) => setTimerProjectId(event.target.value)}
                    disabled={Boolean(timerStartedAt)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name || "Untitled project"}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="timer-display">{new Date(timerSeconds * 1000).toISOString().slice(11, 19)}</p>
                <div className="actions">
                  <button
                    className="button button-primary"
                    onClick={startTimer}
                    type="button"
                    disabled={Boolean(timerStartedAt) || !timerProject}
                  >
                    Start timer
                  </button>
                  <button
                    className="button button-ghost"
                    onClick={stopTimer}
                    type="button"
                    disabled={!timerStartedAt || !timerProject}
                  >
                    Stop timer
                  </button>
                </div>
              </div>

              <div className="setup-card">
                <div className="setup-card-top">
                  <h4>Manual Entry</h4>
                  <span className="setup-ready">Available</span>
                </div>
                <div className="manual-grid">
                  <label className="field">
                    <span className="summary-label">Project</span>
                    <select
                      value={manualEntryProjectId}
                      onChange={(event) => setManualEntryProjectId(event.target.value)}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name || "Untitled project"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="summary-label">Minutes</span>
                    <input value={manualMinutes} onChange={(event) => setManualMinutes(event.target.value)} />
                  </label>
                  <label className="field">
                    <span className="summary-label">Notes</span>
                    <input
                      value={manualNotes}
                      onChange={(event) => setManualNotes(event.target.value)}
                      placeholder="Debugging, planning, implementation..."
                    />
                  </label>
                </div>
                <button
                  className="button button-secondary"
                  onClick={submitManualEntry}
                  type="button"
                  disabled={!manualEntryProject}
                >
                  Add human time
                </button>
              </div>
            </div>
          </article>

          <article className="panel stack">
            <h3>Effort Snapshot</h3>
            <div className="hero-grid">
              <div className="metric">
                <strong>{formatMinutes(totalHumanMinutes)}</strong>
                <span>Total human time</span>
              </div>
              <div className="metric">
                <strong>{formatMinutes(totalAiMinutes)}</strong>
                <span>Total AI time</span>
              </div>
              <div className="metric">
                <strong>{formatMinutes(selectedSummary?.totalMinutes ?? 0)}</strong>
                <span>Selected project total</span>
              </div>
            </div>
          </article>
        </section>

        <section className="details">
          <article className="panel stack">
            <h3>Project Effort Chart</h3>
            {topChartProjects.length ? (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="chart-svg" role="img" aria-label="Project effort bar chart">
                {topChartProjects.map((entry, index) => {
                  const barY = 20 + index * 30;
                  const totalWidth = (entry.totalMinutes / maxChartMinutes) * 220;
                  const humanWidth = (entry.humanMinutes / maxChartMinutes) * 220;
                  const aiWidth = (entry.aiMinutes / maxChartMinutes) * 220;

                  return (
                    <g key={entry.projectId}>
                      <text x="0" y={barY + 12} className="chart-label">
                        {entry.projectName.slice(0, 18)}
                      </text>
                      <rect x="160" y={barY} width={totalWidth} height="18" rx="9" className="chart-bar-total" />
                      <rect x="160" y={barY} width={humanWidth} height="18" rx="9" className="chart-bar-human" />
                      <rect x={160 + humanWidth} y={barY} width={aiWidth} height="18" rx="9" className="chart-bar-ai" />
                      <text x={390} y={barY + 12} textAnchor="end" className="chart-value">
                        {formatMinutes(entry.totalMinutes)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <p className="empty-state">Charts will populate once effort entries exist.</p>
            )}
          </article>

          <article className="panel stack">
            <h3>Human vs AI Split</h3>
            <div className="split-chart">
              <svg viewBox="0 0 144 144" className="pie-svg" role="img" aria-label="Human versus AI effort pie chart">
                <circle cx={pieCx} cy={pieCy} r={pieRadius} className="pie-track" />
                {humanPath ? <path d={humanPath} className="pie-human" /> : null}
              </svg>
              <div className="project-summary">
                <div className="summary-row">
                  <span className="summary-label">Human</span>
                  <strong>{formatMinutes(totalHumanMinutes)}</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-label">AI</span>
                  <strong>{formatMinutes(totalAiMinutes)}</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Interpretation</span>
                  <span className="hint">
                    AI time is automatically captured from documentation work. Human time currently comes from manual
                    timer and manual entry controls.
                  </span>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Setup Guide -- temporarily disabled, kept for later use.
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
                Enables Firestore persistence for projects, documentation history, and effort logging.
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
                Optional for code-triggered documentation refreshes. Human time tracking does not depend on GitHub.
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
                Put the exact GitHub repository URL into the project row only if you want code-triggered documentation
                refreshes.
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">4. Human time today</span>
              <span>
                Use the manual timer or manual entry now. A local activity watcher with idle filtering can be layered in
                next without changing the data model.
              </span>
            </div>
          </div>
        </section>
        */}

        <section className="details">
          <article className="panel stack">
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
          </article>

          <article className="panel stack">
            <h3>Recent Effort Log</h3>
            {effortEntries.length ? (
              <div className="project-summary">
                {effortEntries.slice(0, 8).map((entry) => (
                  <div className="summary-row" key={entry.id}>
                    <span className="summary-label">
                      {entry.actor} via {entry.source.replace("_", " ")}
                    </span>
                    <strong>{formatMinutes(entry.durationMinutes)}</strong>
                    <span className="hint">
                      {formatDateTime(entry.endedAt)} {entry.notes ? `- ${entry.notes}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Effort entries will appear once you add manual time or trigger AI work.</p>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
