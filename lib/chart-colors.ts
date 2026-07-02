import { AppStatus } from "@prisma/client";

// Single source of truth for chart color assignment.
//
// USER_SERIES is a fixed-order categorical palette (color follows the user's
// index in the stable users list — never re-ranked by filters). Validated for
// CVD separation + ≥3:1 contrast against both the light (#fff) and dark
// (#131419) card surfaces, so the same hexes work in all three themes.
export const USER_SERIES = [
  "#4F63E6", // cobalt
  "#B87F16", // gold
  "#0798B4", // teal
  "#C2427A", // rose
  "#6E4FD8", // violet
] as const;

export function userSeriesColor(index: number): string {
  return USER_SERIES[index % USER_SERIES.length];
}

// Status colors are semantic and reserved: applied family = blues/violets,
// rejected = rose, offer = gold (the reward color), inert states = grays.
// Grays are legal here because every chart carries a legend + tooltip.
export const STATUS_CHART_COLORS: Record<AppStatus, string> = {
  NONE: "#9AA1AE",
  APPLIED: "#4F63E6",
  APPLIED_WITH_REFERRAL: "#6E4FD8",
  FOLLOW_UP_SENT: "#0798B4",
  SKIPPED: "#98A0AC",
  REJECTED: "#C2427A",
  EXPIRED: "#6E675C",
  OFFER: "#B87F16",
};

// Tooltip rendering lives in components/charts/chart-tooltip.tsx.
