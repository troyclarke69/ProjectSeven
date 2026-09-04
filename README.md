# Project Seven

A multi-tenant project registry with:

- Sign-in / sign-up (Auth.js), so each account only sees its own projects
- Postgres (Neon) as the primary data store, via Drizzle ORM
- Claude (Anthropic)-backed markdown documentation generation, with Gemini kept wired up as a secondary provider
- GitHub webhook support for code-change-triggered doc refreshes, across every tenant's tracked repos
- Documentation history snapshots for each refresh
- Firebase Admin support and a local-JSON fallback, kept as a legacy single-tenant path (see "Legacy / single-tenant mode" below)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.template` to `.env.local` and fill in:

   - `DATABASE_URL` — your Neon Postgres connection string (pooled). This turns on multi-tenant mode and requires sign-in.
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` — for Claude-generated documentation.
   - `GEMINI_API_KEY` / `GEMINI_MODEL` — optional secondary AI provider.
   - `GITHUB_WEBHOOK_SECRET` — HMAC secret shared by every repo's webhook. Each repo's webhook should point at `https://<your-domain>/api/github/webhook` and use this same secret.
   - Firebase variables — optional, legacy fallback only (see below).

3. Create the database schema. Either:

   ```bash
   npm run db:push        # drizzle-kit push, reads DATABASE_URL from your shell env
   ```

   or paste `drizzle/0000_init.sql` into the Neon SQL editor / run it with `psql "$DATABASE_URL" -f drizzle/0000_init.sql`.

4. Run the app and create your account:

   ```bash
   npm run dev
   ```

   Visit `/register` to create the first account.

5. (Optional) If you had projects saved locally before this change (in `.data/*.json`), migrate them into your new account:

   ```bash
   npm run db:seed -- you@example.com
   ```

   The email must match an account you already created in step 4. Safe to re-run.

## Multi-tenancy

Once `DATABASE_URL` is set, every page and API route requires a signed-in user (enforced in `middleware.ts`), and every project, documentation-history entry, and effort-log entry is scoped to the signed-in user's `ownerId` in Postgres (`lib/server/project-store.ts`). The GitHub webhook is the one exception: it authenticates with a shared HMAC secret rather than a session, so a single webhook secret currently triggers a repo-matching search across every tenant's projects. If you need per-tenant webhook isolation (separate secrets/endpoints per user), that's the next thing to add there.

## Legacy / single-tenant mode

If `DATABASE_URL` is not set, the app runs the way it originally did: no login wall, and data is stored in Firebase (if `FIREBASE_ADMIN_*` vars are set) or otherwise in local JSON files under `.data/`. This path is **not** multi-tenant-safe — there's no per-user scoping — so it's meant only for a quick local trial, not for real multi-user use. Firebase and Gemini wiring are both kept in the codebase for potential future use, but Postgres and Anthropic are the paths actively used once configured.

## Current behavior

- With `DATABASE_URL` set: projects, documentation history, and effort entries are stored in Postgres, scoped per account. Documentation generation prefers Anthropic (Claude), falls back to Gemini if Anthropic isn't configured or a call fails, and falls back further to a deterministic markdown template if neither AI provider is configured.
- Without `DATABASE_URL`: single-tenant legacy mode as described above.
- GitHub `push` webhooks sent to `/api/github/webhook` refresh docs for any tracked project (across all tenants) whose GitHub URL matches the repository.

## Recommended next steps

- Give each tenant their own GitHub webhook secret/endpoint so the webhook path is tenant-isolated too.
- Add project-level tags and release fields as the registry grows.
- Add a repo-to-project linking UI so webhook routing does not depend only on the GitHub URL field.
- Add diffing between documentation history entries to review how project context changed over time.
- Add OAuth providers (Google/GitHub) to Auth.js alongside email/password, if desired.
