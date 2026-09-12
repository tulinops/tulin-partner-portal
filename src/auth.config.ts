import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no Prisma/bcrypt) — used by middleware.ts for a
 * cheap, non-authoritative redirect. The real Credentials provider lives in
 * src/auth.ts, which is only ever imported from Node-runtime code (route
 * handlers, server actions, layouts).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as typeof session.user.role;
      session.user.tenantId = token.tenantId as string | null;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      return session;
    },
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
