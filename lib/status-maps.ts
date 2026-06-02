import { AppStatus, ReferralStatus } from "@prisma/client";

export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  NONE: "Not applied",
  APPLIED: "Applied",
  APPLIED_WITH_REFERRAL: "Applied (ref)",
  FOLLOW_UP_SENT: "Follow-up sent",
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
  NONE: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  APPLIED: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  APPLIED_WITH_REFERRAL:
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  FOLLOW_UP_SENT:
    "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  SKIPPED:
    "bg-zinc-200/60 text-zinc-700 dark:bg-zinc-100/10 dark:text-zinc-200 border-zinc-300 dark:border-zinc-100/20",
  REJECTED: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  EXPIRED:
    "bg-stone-500/15 text-stone-600 dark:text-stone-400 border-stone-500/30",
  OFFER:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export const REFERRAL_STATUS_STYLE: Record<ReferralStatus, string> = {
  NONE: "bg-transparent text-muted-foreground border-transparent",
  REQUESTED:
    "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40",
  RECEIVED:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  NOT_NEEDED:
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40",
};

export const APP_STATUSES: AppStatus[] = [
  "APPLIED",
  "SKIPPED",
  "APPLIED_WITH_REFERRAL",
  "OFFER",
  "REJECTED",
  "EXPIRED",
  "NONE",
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
