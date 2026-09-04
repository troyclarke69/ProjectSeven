import Link from "next/link";

const GITHUB_URL = "https://github.com/troyclarke69/ProjectSeven";

export const metadata = {
  title: "Guide — Projectry",
  description: "User and technical guide for Projectry",
};

export default function GuidePage() {
  return (
    <main className="shell">
      <div className="frame">
        <section className="panel prose">
          <div className="prose-toolbar">
            <Link href="/" className="button button-ghost">
              Back to dashboard
            </Link>
            <div className="prose-toolbar-links">
              <a className="button button-secondary" href="/project-seven-guide.md" download>
                Download guide (.md)
              </a>
              <a
                className="button button-primary"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source on GitHub
              </a>
            </div>
          </div>

          <p className="eyebrow">Projectry</p>
          <h1>User &amp; technical guide</h1>
          <p>
            Source code:{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              {GITHUB_URL}
            </a>
          </p>

          <h2>1. What this app is</h2>
          <p>
            Projectry is a project registry and documentation cockpit. It keeps a spreadsheet-style record of the
            projects you&apos;re working on (name, description, version, tools, platforms, status, links), generates
            written documentation for each project using AI, and tracks the human and AI effort spent on them over
            time.
          </p>
          <p>
            The app is multi-tenant: every account&apos;s projects, documentation history, and effort log are
            private to that account. Signing in is required before you can see or change any data.
          </p>

          <h2>2. Getting started</h2>
          <ol>
            <li>
              Go to <code>/register</code> and create an account with your email and a password.
            </li>
            <li>
              You&apos;ll be signed in automatically and redirected to the dashboard. If not, go to{" "}
              <code>/login</code> and sign in.
            </li>
            <li>
              Your account bar (top right of the hero card) shows your email and a <strong>Sign out</strong> button
              once you&apos;re signed in.
            </li>
            <li>
              Add your first project from the <strong>Projects Sheet</strong> using the <strong>Add project</strong>{" "}
              button.
            </li>
          </ol>
          <p>Every project you create belongs to your account only. No other user can see or edit it.</p>

          <h2>3. The Projects Sheet</h2>
          <p>
            Each project is shown as two stacked rows under two header rows, so a project with many fields
            doesn&apos;t get squeezed onto one very wide line:
          </p>
          <ul>
            <li>
              <strong>Row 1 fields:</strong> Name, Description, Version, Tools, Status
            </li>
            <li>
              <strong>Row 2 fields:</strong> Start date, Modified, Platforms, GitHub URL, Website URL
            </li>
          </ul>
          <p>
            Both rows for a project are visually grouped together (shared border/shading) so it&apos;s clear which
            second row belongs to which first row. The <strong>Actions</strong> column (save/delete, etc.) spans both
            rows.
          </p>
          <p>
            <strong>Tools</strong> and <strong>Platforms</strong> are free-text tag fields — type as many
            comma-separated values as you like (e.g. <code>Next.js, TypeScript, Postgres</code>). Spaces, commas, and
            punctuation all work normally while you&apos;re typing; the field only turns your text into a clean tag
            list once you save.
          </p>
          <p>Edits are saved per project with the Save action in that project&apos;s row.</p>

          <h2>4. Documentation generation</h2>
          <p>
            Projectry can write a documentation draft for a project automatically. When you trigger documentation
            generation for a project, the app tries the following providers in order, and uses the first one
            that&apos;s configured:
          </p>
          <ol>
            <li>
              <strong>Anthropic (Claude)</strong> — the primary AI writer.
            </li>
            <li>
              <strong>Google Gemini</strong> — used only if Anthropic isn&apos;t configured or fails.
            </li>
            <li>
              <strong>A deterministic built-in template</strong> — used if neither AI provider is available, so you
              always get a usable draft.
            </li>
          </ol>
          <p>
            Every generated draft is saved to that project&apos;s documentation history, so you can see how the
            documentation evolved over time.
          </p>

          <h2>5. Effort tracking</h2>
          <p>
            The <strong>Effort Tracking</strong> panel lets you log time in two ways, and both now include a{" "}
            <strong>Project</strong> dropdown so you control exactly which project the time is credited to (it no
            longer always applies to a single default project):
          </p>
          <ul>
            <li>
              <strong>Live Timer</strong> — pick a project, start the timer while you work, and stop it when
              you&apos;re done. The elapsed time is logged as human effort against the project you selected when you
              started the timer.
            </li>
            <li>
              <strong>Manual Entry</strong> — pick a project, enter a duration and optional notes, and save it
              directly without running a timer.
            </li>
          </ul>
          <p>The dropdown defaults to whichever project is currently selected in the sheet.</p>

          <h2>6. GitHub integration (optional)</h2>
          <p>
            If you connect a project&apos;s GitHub repository and configure the webhook secret, pushes to that
            repository can automatically trigger a fresh documentation pass for the matching project(s) — without
            you needing to trigger it by hand. This is entirely optional; the app works fully without it.
          </p>

          <h2>7. Technical setup (for running or deploying your own instance)</h2>
          <p>Projectry is a Next.js (App Router) application. To run it yourself you need:</p>
          <ul>
            <li>
              <strong>Node.js</strong> and <strong>npm</strong> to install dependencies and run the dev server.
            </li>
            <li>
              <strong>A Postgres database</strong> (this project is built and tested against{" "}
              <a href="https://neon.tech" target="_blank" rel="noopener noreferrer">
                Neon
              </a>
              ) — this is the primary data store for accounts, projects, documentation history, and effort entries.
            </li>
            <li>
              <strong>An Anthropic API key</strong> — for AI-generated documentation (primary provider).
            </li>
            <li>Optionally, a Google Gemini API key — used only as a fallback if Anthropic isn&apos;t configured.</li>
            <li>Optionally, a GitHub webhook secret — to enable automatic documentation refresh on push.</li>
          </ul>

          <h3>Environment variables</h3>
          <p>
            Set these in a <code>.env.local</code> file at the project root (never commit this file). See{" "}
            <code>.env.template</code> in the repository for the full annotated list. Key variables:
          </p>
          <ul>
            <li>
              <code>DATABASE_URL</code> — your Postgres connection string, e.g.{" "}
              <code>postgresql://user:password@host/dbname?sslmode=require</code>. Must start with{" "}
              <code>postgresql://</code> (this app uses Node&apos;s <code>pg</code> driver, not a{" "}
              <code>postgresql+asyncpg://</code>-style URL).
            </li>
            <li>
              <code>AUTH_SECRET</code> — a random secret used to sign session tokens. Generate one with{" "}
              <code>openssl rand -base64 32</code>.
            </li>
            <li>
              <code>ANTHROPIC_API_KEY</code> — enables Anthropic as the documentation writer.
            </li>
            <li>
              <code>GEMINI_API_KEY</code> — optional, enables Gemini as a fallback writer.
            </li>
            <li>
              <code>GITHUB_WEBHOOK_SECRET</code> — optional, enables the GitHub push webhook.
            </li>
            <li>Legacy Firebase variables — optional; kept only for backward compatibility with earlier single-tenant deployments.</li>
          </ul>

          <h3>Database setup</h3>
          <p>
            Apply the schema in <code>drizzle/0000_init.sql</code> to your Postgres database (via your
            provider&apos;s SQL console, or <code>npm run db:push</code> if you have <code>drizzle-kit</code>{" "}
            available). This creates the <code>users</code>, <code>projects</code>, <code>documentation_history</code>
            , and <code>effort_entries</code> tables, each scoped to an owning user (except <code>users</code>{" "}
            itself).
          </p>
          <p>
            If you have existing data from an older, single-tenant install (local JSON files), you can migrate it
            into Postgres under a specific account with:
          </p>
          <pre>
            <code>npm run db:seed</code>
          </pre>
          <p>
            which runs <code>scripts/migrate-local-data.mjs</code> and assigns the legacy data to the account you
            specify.
          </p>

          <h3>Running locally</h3>
          <pre>
            <code>{"npm install\nnpm run dev"}</code>
          </pre>
          <p>
            Then visit <code>http://localhost:3000</code>, register an account, and start adding projects.
          </p>

          <h2>8. Multi-tenancy and data model</h2>
          <p>
            Every project, documentation history entry, and effort entry is tagged with an owner (your account&apos;s
            user id). The server never returns another account&apos;s data, and once Postgres is configured the app
            will not silently fall back to shared or legacy data — if something isn&apos;t scoped to your account,
            you simply won&apos;t see it.
          </p>
          <p>
            <strong>Legacy single-tenant mode:</strong> if <code>DATABASE_URL</code> is not set at all, the app runs
            in its original single-tenant mode (no login wall, one shared project list) for backward compatibility
            with earlier deployments. Setting <code>DATABASE_URL</code> turns on full multi-tenant mode with required
            sign-in.
          </p>

          <h2>9. Source code</h2>
          <p>
            The full source, including the database schema, API routes, and this guide, is available at{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              {GITHUB_URL}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
