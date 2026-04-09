export const normalizeGitHubRepo = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes("github.com")) {
      return null;
    }

    const [owner, repo] = parsed.pathname.replace(/^\/+/, "").replace(/\.git$/, "").split("/");
    if (!owner || !repo) {
      return null;
    }

    return `${owner}/${repo}`.toLowerCase();
  } catch {
    return null;
  }
};
