import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      displayName?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    displayName?: string;
    // Set once we've resolved uid from the DB, so later requests skip the
    // per-request DB lookup (the uid self-heal only needs to run one time).
    healed?: boolean;
  }
}
