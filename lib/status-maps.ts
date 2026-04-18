import { AppStatus, ReferralStatus } from "@prisma/client";

export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  NONE: "—",
  APPLIED: "Applied",
  APPLIED_WITH_REFERRAL: "Applied (ref)",
  SKIPPED: "Skipped",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  OFFER: "Offer",
};

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  NONE: "—",
  REQUESTED: "Requested",
  RECEIVED: "Received",
  NOT_NEEDED: "Not needed",
};

// Tailwind classes per status. Tuned for both light and dark themes.
export const APP_STATUS_STYLE: Record<AppStatus, string> = {
  NONE: "bg-muted text-muted-foreground border-border",
  APPLIED: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  APPLIED_WITH_REFERRAL:
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  SKIPPED: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30",
  REJECTED: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  EXPIRED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  OFFER:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export const REFERRAL_STATUS_STYLE: Record<ReferralStatus, string> = {
  NONE: "text-muted-foreground",
  REQUESTED: "text-amber-600 dark:text-amber-300",
  RECEIVED: "text-emerald-600 dark:text-emerald-300",
  NOT_NEEDED: "text-muted-foreground",
};

export const APP_STATUSES: AppStatus[] = [
  "NONE",
  "APPLIED",
  "APPLIED_WITH_REFERRAL",
  "SKIPPED",
  "REJECTED",
  "EXPIRED",
  "OFFER",
];

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "NONE",
  "REQUESTED",
  "RECEIVED",
  "NOT_NEEDED",
];

// CSV cell → AppStatus
export function parseCsvAppStatus(raw: string | undefined): AppStatus {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "NONE";
  if (v.includes("applied") && v.includes("referral")) return "APPLIED_WITH_REFERRAL";
  if (v.startsWith("applied")) return "APPLIED";
  if (v.startsWith("skip")) return "SKIPPED";
  if (v.startsWith("reject")) return "REJECTED";
  if (v.startsWith("expir")) return "EXPIRED";
  if (v.startsWith("offer")) return "OFFER";
  return "NONE";
}

export function parseCsvReferral(raw: string | undefined): ReferralStatus {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "NONE";
  if (v.includes("receiv") || v.includes("got")) return "RECEIVED";
  if (v.includes("not")) return "NOT_NEEDED";
  return "REQUESTED";
}
