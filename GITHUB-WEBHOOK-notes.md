Github webhooks are set up per-repository, but the secret itself is shared across your whole app rather than being per-repo.

Here's how it actually works: there's a single `GITHUB_WEBHOOK_SECRET` in your `.env.local`, and one endpoint (`/api/github/webhook`) that all repos post to. For any repository you want to auto-refresh documentation on push, you'd go into that repo's GitHub settings → Webhooks → Add webhook, and configure:

- Payload URL: `https://your-deployed-domain.com/api/github/webhook`
- Content type: `application/json`
- Secret: the same value as your `GITHUB_WEBHOOK_SECRET`
- Events: just the `push` event is enough (the route ignores everything else except a `ping` check)

On the app side, the project's **GitHub URL** field in the Projects Sheet has to match the repo's `full_name` or `html_url` from the payload — that's how the webhook handler figures out which project(s) to refresh when a push comes in.

The one thing worth flagging: because the secret is shared globally rather than per-tenant, any repo pointed at your webhook with the correct secret can trigger a refresh for whichever project(s) match its URL — there's no per-user isolation on the webhook itself, only on which project ends up getting updated. That's actually called out in the README as a recommended next step (per-tenant webhook secrets/endpoints) but it hasn't been built yet. If you're the only one wiring up repos for now it's not a practical problem, but if other users start adding their own GitHub projects, that's the gap to close before relying on it.