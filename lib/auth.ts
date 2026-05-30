import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "./db";

function parseAllowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseDisplayNames(): Map<string, string> {
  const raw = process.env.USER_DISPLAY_NAMES ?? "";
  const m = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [email, name] = pair.split("=").map((s) => s?.trim());
    if (email && name) m.set(email.toLowerCase(), name);
  }
  return m;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = (process.env.ADMIN_SEED_EMAIL ?? "").toLowerCase().trim();
  if (!admin || !email) return false;
  return email.toLowerCase() === admin;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const allowed = parseAllowedEmails();
      if (allowed.size > 0 && !allowed.has(email)) return false;

      const displayName =
        parseDisplayNames().get(email) ??
        user.name ??
        email.split("@")[0];

      const dbUser = await prisma.user.upsert({
        where: { email },
        update: {
          name: user.name ?? displayName,
          image: user.image ?? undefined,
        },
        create: {
          email,
          name: user.name ?? displayName,
          image: user.image ?? undefined,
          displayName,
        },
      });
      if (!dbUser.isActive) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.displayName = dbUser.displayName;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        session.user.displayName = token.displayName as string | undefined;
      }
      return session;
    },
  },
});
