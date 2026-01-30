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

const adapterBase = PrismaAdapter(prisma);

const adapter = {
  ...adapterBase,
  async createUser(data: AdapterUser) {
    const providers = await getAuthProviderConfig();
    if (!providers.github.registrationEnabled) {
      throw new Error("Registration is disabled");
    }

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
      async signIn({ user, account }) {
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

        // New OAuth user: enforce registration settings before we attempt to create the user.
        if (account?.provider === "github") {
          const providers = await getAuthProviderConfig();
          if (!providers.github.registrationEnabled) return false;

          const mode = await getRegistrationMode();
          if (mode !== "open") return false;
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
  };
});
