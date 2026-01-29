import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { consumeLoginToken } from "@/lib/auth-tokens";
import { getRegistrationMode } from "@/lib/registration";
import { getOrCreateDefaultUserGroupId } from "@/services/usergroups/default-group";

function getGitHubOAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.AUTH_GITHUB_ID || process.env.GITHUB_ID || "").trim();
  const clientSecret = (process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

const githubOAuthConfig = getGitHubOAuthConfig();

const adapterBase = PrismaAdapter(prisma);

const adapter: Adapter = {
  ...adapterBase,
  async createUser(data) {
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(githubOAuthConfig
      ? [
          GitHub({
            clientId: githubOAuthConfig.clientId,
            clientSecret: githubOAuthConfig.clientSecret,
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
    async signIn({ user }) {
      if (!user?.id) return false;
      const record = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true },
      });
      return Boolean(record?.isActive);
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
});
