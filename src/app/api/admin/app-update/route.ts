import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/rbac";
import { getAppInfo, getRepositoryInfo } from "@/lib/app-info";

type LatestVersionInfo = {
  tag: string;
  version: string | null;
  url: string;
  publishedAt: string | null;
};

type UpdateCheckResponse =
  | {
      ok: true;
      checkedAt: string;
      current: ReturnType<typeof getAppInfo>;
      latest: LatestVersionInfo | null;
      hasUpdate: boolean | null;
    }
  | {
      ok: false;
      checkedAt: string;
      current: ReturnType<typeof getAppInfo>;
      latest: LatestVersionInfo | null;
      hasUpdate: boolean | null;
      error: string;
    };

function parseSemver(input: string): [number, number, number] | null {
  const trimmed = (input || "").trim();
  const match = trimmed.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return null;
  return [major, minor, patch];
}

function compareSemver(a: [number, number, number], b: [number, number, number]) {
  for (let idx = 0; idx < 3; idx += 1) {
    if (a[idx] === b[idx]) continue;
    return a[idx] > b[idx] ? 1 : -1;
  }
  return 0;
}

function getHasUpdate(currentVersion: string, latestVersion: string | null) {
  if (!latestVersion) return null;
  const current = parseSemver(currentVersion);
  const latest = parseSemver(latestVersion);
  if (!current || !latest) return null;
  return compareSemver(current, latest) < 0;
}

async function fetchGitHubJson(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "temail",
    },
    next: { revalidate: 300 },
  });

  const body = await res.json().catch(() => null);
  return { res, body };
}

async function fetchLatestVersionInfo(): Promise<{ latest: LatestVersionInfo | null; error: string | null }> {
  const repo = getRepositoryInfo();
  const releaseUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/releases/latest`;
  const releaseResult = await fetchGitHubJson(releaseUrl);

  if (releaseResult.res.ok) {
    const tag = typeof releaseResult.body?.tag_name === "string" ? releaseResult.body.tag_name.trim() : "";
    const url = typeof releaseResult.body?.html_url === "string" ? releaseResult.body.html_url.trim() : "";
    const publishedAt = typeof releaseResult.body?.published_at === "string" ? releaseResult.body.published_at.trim() : null;

    if (tag) {
      const version = tag.startsWith("v") ? tag.slice(1) : tag;
      const fallbackUrl = `https://github.com/${repo.owner}/${repo.name}/releases/tag/${encodeURIComponent(tag)}`;
      return {
        latest: { tag, version: version || null, url: url || fallbackUrl, publishedAt },
        error: null,
      };
    }
  }

  if (releaseResult.res.status !== 404) {
    const message = typeof releaseResult.body?.message === "string" ? releaseResult.body.message : "Failed to fetch GitHub release info";
    return { latest: null, error: message };
  }

  const tagsUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/tags?per_page=1&page=1`;
  const tagsResult = await fetchGitHubJson(tagsUrl);
  if (!tagsResult.res.ok) {
    const message = typeof tagsResult.body?.message === "string" ? tagsResult.body.message : "Failed to fetch GitHub tag info";
    return { latest: null, error: message };
  }

  const first = Array.isArray(tagsResult.body) ? tagsResult.body[0] : null;
  const tag = typeof first?.name === "string" ? first.name.trim() : "";
  if (!tag) return { latest: null, error: "No tags found in repository" };

  const version = tag.startsWith("v") ? tag.slice(1) : tag;
  const url = `https://github.com/${repo.owner}/${repo.name}/tree/${encodeURIComponent(tag)}`;
  return { latest: { tag, version: version || null, url, publishedAt: null }, error: null };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const current = getAppInfo();

  try {
    const { latest, error } = await fetchLatestVersionInfo();
    const hasUpdate = latest ? getHasUpdate(current.version, latest.version) : null;

    if (error) {
      const payload: UpdateCheckResponse = { ok: false, checkedAt, current, latest, hasUpdate, error };
      return NextResponse.json(payload);
    }

    const payload: UpdateCheckResponse = { ok: true, checkedAt, current, latest, hasUpdate };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check updates";
    const payload: UpdateCheckResponse = { ok: false, checkedAt, current, latest: null, hasUpdate: null, error: message };
    return NextResponse.json(payload);
  }
}

