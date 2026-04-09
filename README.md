# Project Seven

This is a starter Next.js app for a project-management style registry with:

- A spreadsheet-like single page for project metadata
- Server-managed project persistence with Firebase Admin support
- Gemini-backed markdown documentation generation
- GitHub webhook support for code-change-triggered doc refreshes
- Documentation history snapshots for each refresh

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.

3. Add the credentials you want to use:

- `GEMINI_API_KEY` for AI-generated documentation
- `FIREBASE_ADMIN_*` for server-side Firestore persistence and webhook-safe updates
- `NEXT_PUBLIC_FIREBASE_*` if you later add direct browser-side Firebase features
- `GITHUB_WEBHOOK_SECRET` when connecting a GitHub webhook

4. Run the app:

   ```bash
   npm run dev
   ```

## Current behavior

- Without Firebase Admin env vars, the app stores projects and documentation history in local JSON files under `.data/`.
- When Firebase Admin env vars are present, project rows are saved into a `projects` Firestore collection.
- Documentation snapshots are stored in a `documentationHistory` collection when Firebase Admin is configured.
- When Gemini is configured, saving with documentation regeneration calls the Gemini API to produce markdown.
- When Gemini is not configured, a deterministic markdown template is generated instead.
- GitHub `push` webhooks sent to `/api/github/webhook` will refresh docs for any tracked project whose GitHub URL matches the repository.

## Recommended next steps

- Add Firebase Authentication before exposing the app publicly.
- Add project-level ownership, tags, and release fields as the registry grows.
- Add a repo-to-project linking UI so webhook routing does not depend only on the GitHub URL field.
- Add diffing between documentation history entries to review how project context changed over time.
