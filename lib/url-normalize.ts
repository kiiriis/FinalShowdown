// Normalizes a URL so that different superficial variants (trailing slash,
// tracking params, case on the host, leading "www.", URL fragment, etc.) all
// collapse to the same string for duplicate-detection. The original link the
// user typed is stored separately and shown in the UI; this is purely an
// index for `findFirst` comparisons.
//
// Intentionally conservative: we only strip universally-agreed-on tracking
// params and formatting noise. We do NOT normalize the path case or try to
// unify LinkedIn/Indeed job-board URL variants — those choices vary too much
// to do safely without false positives.

const TRACKING_PARAMS = new Set([
  // Google / Analytics
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "utm_referrer",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  // Facebook / Meta
  "fbclid",
  // Microsoft / Bing / Yandex
  "msclkid",
  "yclid",
  // Mailchimp
  "mc_cid",
  "mc_eid",
  // HubSpot
  "_hsenc",
  "_hsmi",
  "_hsctatracking",
  "hsctatracking",
  // LinkedIn (non-canonical, safe to drop — `currentJobId` is NOT in here)
  "trk",
  "trackingid",
  "refid",
  "ref_src",
  "originalsubdomain",
  "lipi",
  "licu",
  // Twitter / X
  "s",
  "t",
  "twclid",
  // Instagram
  "igshid",
  // Generic / misc
  "ref",
  "referrer",
  "cid",
  "source",
  "src",
]);

function stripDefaultPort(host: string, protocol: string): string {
  if (protocol === "http:" && host.endsWith(":80")) return host.slice(0, -3);
  if (protocol === "https:" && host.endsWith(":443")) return host.slice(0, -4);
  return host;
}

/** Normalize a URL for dedup only. Returns the original string on parse error. */
export function normalizeLinkForDedup(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }

  // Protocol: unify http ↔ https so `http://x` and `https://x` dedup.
  const protocol = "https:";

  // Host: lowercase, strip leading www.
  let host = u.host.toLowerCase();
  host = stripDefaultPort(host, u.protocol);
  if (host.startsWith("www.")) host = host.slice(4);

  // Path: keep case (paths are case-sensitive); trim trailing slash except at root.
  let pathname = u.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // Query: drop tracking params, sort remaining ones.
  const kept: Array<[string, string]> = [];
  u.searchParams.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (TRACKING_PARAMS.has(lower)) return;
    if (lower.startsWith("utm_")) return;
    kept.push([key.toLowerCase(), value]);
  });
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const search = kept.length
    ? "?" + kept.map(([k, v]) => `${k}=${v}`).join("&")
    : "";

  // Fragment: always drop. Fragments never identify a new resource.
  return `${protocol}//${host}${pathname}${search}`;
}
