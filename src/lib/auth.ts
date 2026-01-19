import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { consumeLoginToken } from "@/lib/auth-tokens";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
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
