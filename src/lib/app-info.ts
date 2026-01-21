import "server-only";

import { execSync } from "node:child_process";
import pkg from "../../package.json";

export type RepositoryInfo = {
  owner: string;
  name: string;
  url: string;
};

export type AppInfo = {
  version: string;
  commitSha: string | null;
  commitShortSha: string | null;
  repository: RepositoryInfo;
};

const REPOSITORY: RepositoryInfo = {
  owner: "xinhai-ai",
  name: "temail",
  url: "https://github.com/xinhai-ai/temail",
};

function normalizeCommitSha(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9a-fA-F]{7,40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function getRepositoryInfo(): RepositoryInfo {
  return REPOSITORY;
}

export function getAppVersion(): string {
  const version = typeof pkg.version === "string" ? pkg.version.trim() : "";
  return version || "unknown";
}

export function getAppCommitSha(): string | null {
  const candidates = [
    process.env.TEMAIL_GIT_SHA,
    process.env.NEXT_PUBLIC_GIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.COMMIT_SHA,
    process.env.SOURCE_VERSION,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCommitSha(candidate);
    if (normalized) return normalized;
  }

  try {
    const stdout = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return normalizeCommitSha(stdout);
  } catch {
    return null;
  }
}

export function getAppInfo(): AppInfo {
  const commitSha = getAppCommitSha();
  return {
    version: getAppVersion(),
    commitSha,
    commitShortSha: commitSha ? commitSha.slice(0, 7) : null,
    repository: REPOSITORY,
  };
}

