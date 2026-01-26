import "server-only";

export type DeploymentMode = "default" | "vercel";

function normalizeMode(value: string | undefined): DeploymentMode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "vercel") return "vercel";
  if (normalized === "default" || normalized === "selfhost" || normalized === "self-hosted") return "default";
  return null;
}

export function getDeploymentMode(): DeploymentMode {
  const explicit = normalizeMode(process.env.TEMAIL_DEPLOYMENT_MODE);
  if (explicit) return explicit;

  // Auto-detect Vercel when not explicitly set.
  if (process.env.VERCEL === "1" || typeof process.env.VERCEL_ENV === "string") {
    return "vercel";
  }

  return "default";
}

export function isVercelDeployment(): boolean {
  return getDeploymentMode() === "vercel";
}

