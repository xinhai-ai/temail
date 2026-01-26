export function isVercelDeployment(): boolean {
  return process.env.NEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE === "vercel";
}

