import NextAuth from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { consumeLoginToken } from "@/lib/auth-tokens";
import { getRegistrationMode } from "@/lib/registration";
import { getOrCreateDefaultUserGroupId } from "@/services/usergroups/default-group";
import { getAuthProviderConfig } from "@/lib/auth-providers";
import LinuxDo from "@/lib/linuxdo-provider";
import { getLinuxDoTrustLevelMapping, linuxDoTrustLevelBucket, normalizeLinuxDoTrustLevel } from "@/lib/linuxdo";

const adapterBase = PrismaAdapter(prisma);

const adapter = {
  ...adapterBase,
  async createUser(data: AdapterUser) {
    const mode = await getRegistrationMode();
    if (mode !== "open") {
      throw new Error("Registration is disabled");
    }

    const userGroupId = await getOrCreateDefaultUserGroupId();
    const emailVerified = data.email ? (data.emailVerified ?? new Date()) : data.emailVerified;

    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        image: data.image,
        emailVerified,
        role: "USER",
        isActive: true,
        password: null,
        userGroupId,
      },
    });
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(async () => {
  const providersConfig = await getAuthProviderConfig();
  const githubConfigured = Boolean(providersConfig.github.clientId && providersConfig.github.clientSecret);
  const linuxdoConfigured = Boolean(providersConfig.linuxdo.clientId && providersConfig.linuxdo.clientSecret);

  return {
    adapter: adapter as Adapter,
    session: { strategy: "jwt" },
    pages: {
      signIn: "/login",
    },
    providers: [
      ...(providersConfig.github.enabled && githubConfigured
        ? [
            GitHub({
              clientId: providersConfig.github.clientId as string,
              clientSecret: providersConfig.github.clientSecret as string,
              allowDangerousEmailAccountLinking: true,
            }),
          ]
        : []),
      ...(providersConfig.linuxdo.enabled && linuxdoConfigured
        ? [
            LinuxDo({
              clientId: providersConfig.linuxdo.clientId as string,
              clientSecret: providersConfig.linuxdo.clientSecret as string,
              allowDangerousEmailAccountLinking: true,
            }),
          ]
        : []),
      Credentials({
        name: "credentials",
        credentials: {
          loginToken: { label: "Login Token", type: "text" },
        },
        async authorize(credentials) {
          const extra = credentials as Partial<Record<string, unknown>>;
          const loginToken = typeof extra.loginToken === "string" ? extra.loginToken : undefined;
          if (!loginToken) return null;

          const consumed = await consumeLoginToken(loginToken);
          if (!consumed) return null;

          const user = await prisma.user.findUnique({
            where: { id: consumed.userId },
            select: { id: true, email: true, name: true, role: true, isActive: true },
          });

          if (!user?.isActive) return null;

          return { id: user.id, email: user.email, name: user.name, role: user.role };
        },
      }),
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        if (!user) return false;

        // Credentials logins should always map to an existing DB user.
        if (account?.type === "credentials") {
          if (!user.id) return false;
          const record = await prisma.user.findUnique({
            where: { id: String(user.id) },
            select: { isActive: true },
          });
          return Boolean(record?.isActive);
        }

        // For OAuth, the first-time sign-in `user.id` is the provider's user id (not our DB id),
        // so we need to check whether the OAuth account is already linked.
        if (account?.provider && account.providerAccountId) {
          const linked = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: String(account.providerAccountId),
              },
            },
            select: { user: { select: { isActive: true } } },
          });
          if (linked) return linked.user.isActive;
        }

        // If an existing user already owns the email, allow sign-in (account linking may happen),
        // even if new registrations are currently disabled.
        if (account?.type === "oauth" && user.email) {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { isActive: true },
          });
          if (existingUser) return existingUser.isActive;
        }

        // New OAuth user: enforce registration settings before we attempt to create the user.
        if (account?.provider === "github") {
          const providers = await getAuthProviderConfig();
          if (!providers.github.registrationEnabled) return false;

          const mode = await getRegistrationMode();
          if (mode !== "open") return false;
        }
        if (account?.provider === "linuxdo") {
          const providers = await getAuthProviderConfig();
          if (!providers.linuxdo.registrationEnabled) return false;

          const mode = await getRegistrationMode();
          if (mode !== "open") return false;

          const trustLevel = normalizeLinuxDoTrustLevel((profile as Record<string, unknown> | undefined)?.trust_level);
          const mapping = await getLinuxDoTrustLevelMapping();
          const bucket = linuxDoTrustLevelBucket(trustLevel);
          const rule = mapping[bucket];
          if (rule.action === "reject") return false;
        }

        // Our User.email is required; if the provider does not supply it, sign-in must be denied.
        if (!user.email) return false;

        return true;
      },
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          const role = (user as Partial<{ role: string }>).role;
          if (typeof role === "string" && role) {
            token.role = role;
          } else {
            const record = await prisma.user.findUnique({
              where: { id: user.id },
              select: { role: true },
            });
            token.role = record?.role ?? "USER";
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
        }
        return session;
      },
    },
    events: {
      async signIn({ user, account, profile }) {
        if (!user?.id) return;
        if (account?.provider !== "linuxdo") return;

        const linuxdoId = account.providerAccountId ? String(account.providerAccountId) : "";
        if (!linuxdoId) return;

        const rawProfile = (profile || {}) as Record<string, unknown>;
        const username = typeof rawProfile.username === "string" ? rawProfile.username.trim() : "";
        const name = typeof rawProfile.name === "string" ? rawProfile.name.trim() : null;
        const email = typeof rawProfile.email === "string" ? rawProfile.email.trim() : null;
        const avatarTemplate =
          typeof rawProfile.avatar_template === "string" ? rawProfile.avatar_template.trim() : null;
        const trustLevel = normalizeLinuxDoTrustLevel(rawProfile.trust_level);
        const active = typeof rawProfile.active === "boolean" ? rawProfile.active : true;
        const silenced = typeof rawProfile.silenced === "boolean" ? rawProfile.silenced : false;

        let raw: string | null = null;
        try {
          raw = JSON.stringify(rawProfile);
        } catch {
          raw = null;
        }

        try {
          await prisma.linuxDoUserLink.upsert({
            where: { userId: user.id },
            update: {
              linuxdoId,
              email,
              username: username || linuxdoId,
              name,
              avatarTemplate,
              trustLevel,
              active,
              silenced,
              raw,
              lastSyncedAt: new Date(),
            },
            create: {
              userId: user.id,
              linuxdoId,
              email,
              username: username || linuxdoId,
              name,
              avatarTemplate,
              trustLevel,
              active,
              silenced,
              raw,
              lastSyncedAt: new Date(),
            },
          });
        } catch (error) {
          console.error("[auth] failed to upsert LinuxDO user link:", error);
          return;
        }

        try {
          const mapping = await getLinuxDoTrustLevelMapping();
          const bucket = linuxDoTrustLevelBucket(trustLevel);
          const rule = mapping[bucket];
          if (rule.action !== "assign") return;

          await prisma.user.update({
            where: { id: user.id },
            data: { userGroupId: rule.userGroupId },
          });
        } catch (error) {
          console.error("[auth] failed to assign user group from LinuxDO trust level:", error);
        }
      },
    },
  };
});
