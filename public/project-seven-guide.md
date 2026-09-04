# Projectry (Project Seven) — User & Technical Guide

Source code: https://github.com/troyclarke69/ProjectSeven

## 1. What this app is

Projectry is a project registry and documentation cockpit. It keeps a
spreadsheet-style record of the projects you're working on (name, description,
version, tools, platforms, status, links), generates written documentation for
each project using AI, and tracks the human and AI effort spent on them over
time.

The app is multi-tenant: every account's projects, documentation history, and
effort log are private to that account. Signing in is required before you can
see or change any data.

## 2. Getting started

1. Go to `/register` and create an account with your email and a password.
2. You'll be signed in automatically and redirected to the dashboard. If not,
   go to `/login` and sign in.
3. Your account bar (top right of the hero card) shows your email and a
   **Sign out** button once you're signed in.
4. Add your first project from the **Projects Sheet** using the **Add
   project** button.

Every project you create belongs to your account only. No other user can see
or edit it.

## 3. The Projects Sheet

Each project is shown as two stacked rows under two header rows, so a project
with many fields doesn't get squeezed onto one very wide line:

- **Row 1 fields:** Name, Description, Version, Tools, Status
- **Row 2 fields:** Start date, Modified, Platforms, GitHub URL, Website URL

Both rows for a project are visually grouped together (shared border/shading)
so it's clear which second row belongs to which first row. The **Actions**
column (save/delete, etc.) spans both rows.

**Tools** and **Platforms** are free-text tag fields — type as many
comma-separated values as you like (e.g. `Next.js, TypeScript, Postgres`).
Spaces, commas, and punctuation all work normally while you're typing; the
field only turns your text into a clean tag list once you save.

Edits are saved per project with the **Save** action in that project's row.

## 4. Documentation generation

Projectry can write a documentation draft for a project automatically. When
you trigger documentation generation for a project, the app tries the
following providers in order, and uses the first one that's configured:

1. **Anthropic (Claude)** — the primary AI writer.
2. **Google Gemini** — used only if Anthropic isn't configured or fails.
3. **A deterministic built-in template** — used if neither AI provider is
   available, so you always get a usable draft.

Every generated draft is saved to that project's documentation history, so you
can see how the documentation evolved over time.

## 5. Effort tracking

The **Effort Tracking** panel lets you log time in two ways, and both now
include a **Project** dropdown so you control exactly which project the time
is credited to (it no longer always applies to a single default project):

- **Live Timer** — pick a project, start the timer while you work, and stop it
  when you're done. The elapsed time is logged as human effort against the
  project you selected when you started the timer.
- **Manual Entry** — pick a project, enter a duration and optional notes, and
  save it directly without running a timer.

The dropdown defaults to whichever project is currently selected in the sheet.

## 6. GitHub integration (optional)

If you connect a project's GitHub repository and configure the webhook
secret, pushes to that repository can automatically trigger a fresh
documentation pass for the matching project(s) — without you needing to
trigger it by hand. This is entirely optional; the app works fully without it.

## 7. Technical setup (for running or deploying your own instance)

Projectry is a Next.js (App Router) application. To run it yourself you need:

- **Node.js** and `npm` to install dependencies and run the dev server.
- **A Postgres database** (this project is built and tested against
  [Neon](https://neon.tech)) — this is the primary data store for accounts,
  projects, documentation history, and effort entries.
- **An Anthropic API key** — for AI-generated documentation (primary
  provider).
- Optionally, a **Google Gemini API key** — used only as a fallback if
  Anthropic isn't configured.
- Optionally, a **GitHub webhook secret** — to enable automatic
  documentation refresh on push.

### Environment variables

Set these in a `.env.local` file at the project root (never commit this
file). See `.env.template` in the repository for the full annotated list.
Key variables:

- `DATABASE_URL` — your Postgres connection string, e.g.
  `postgresql://user:password@host/dbname?sslmode=require`. Must start with
  `postgresql://` (this app uses Node's `pg` driver, not an
  `postgresql+asyncpg://`-style URL).
- `AUTH_SECRET` — a random secret used to sign session tokens. Generate one
  with `openssl rand -base64 32`.
- `ANTHROPIC_API_KEY` — enables Anthropic as the documentation writer.
- `GEMINI_API_KEY` — optional, enables Gemini as a fallback writer.
- `GITHUB_WEBHOOK_SECRET` — optional, enables the GitHub push webhook.
- Legacy Firebase variables — optional; kept only for backward compatibility
  with earlier single-tenant deployments.

### Database setup

Apply the schema in `drizzle/0000_init.sql` to your Postgres database (via
your provider's SQL console, or `npm run db:push` if you have `drizzle-kit`
available). This creates the `users`, `projects`, `documentation_history`,
and `effort_entries` tables, each scoped to an owning user (except `users`
itself).

If you have existing data from an older, single-tenant install (local JSON
files), you can migrate it into Postgres under a specific account with:

```
npm run db:seed
```

which runs `scripts/migrate-local-data.mjs` and assigns the legacy data to
the account you specify.

### Running locally

```
npm install
npm run dev
```

Then visit `http://localhost:3000`, register an account, and start adding
projects.

## 8. Multi-tenancy and data model

Every project, documentation history entry, and effort entry is tagged with
an owner (your account's user id). The server never returns another
account's data, and once Postgres is configured the app will not silently
fall back to shared or legacy data — if something isn't scoped to your
account, you simply won't see it.

**Legacy single-tenant mode:** if `DATABASE_URL` is not set at all, the app
runs in its original single-tenant mode (no login wall, one shared project
list) for backward compatibility with earlier deployments. Setting
`DATABASE_URL` turns on full multi-tenant mode with required sign-in.

## 9. Source code

The full source, including the database schema, API routes, and this guide,
is available at:

https://github.com/troyclarke69/ProjectSeven
