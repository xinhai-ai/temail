export type AuthSource = "password" | string;

export function uniqueOAuthProviders(accounts: Array<{ provider: string }>) {
  const providers: string[] = [];
  for (const account of accounts) {
    const provider = account.provider.trim();
    if (!provider) continue;
    if (providers.includes(provider)) continue;
    providers.push(provider);
  }
  return providers;
}

export function computeAuthSources({
  hasPassword,
  oauthProviders,
}: {
  hasPassword: boolean;
  oauthProviders: string[];
}) {
  const sources: AuthSource[] = [];
  if (hasPassword) sources.push("password");
  for (const provider of oauthProviders) {
    if (!provider) continue;
    if (sources.includes(provider)) continue;
    sources.push(provider);
  }
  return sources;
}

