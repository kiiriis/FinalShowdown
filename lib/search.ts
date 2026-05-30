// Search helpers for the jobs board. Pure, side-effect-free, dependency-free
// so they can be exercised by a tsx test script as well as the React tree.

export type SearchableJob = {
  company: string;
  position: string;
  link: string;
  notes?: string | null;
  addedBy?: { displayName?: string | null; name?: string | null } | null;
  entries: Array<{ note?: string | null }>;
};

function foldDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

// Lowercase, diacritic-folded haystack covering every textual artifact on a
// job: company, position, link (with %-decoding so URL paths read naturally),
// the global Job.notes, the addedBy user's names, and every teammate's
// per-entry note.
export function buildSearchText(j: SearchableJob): string {
  let linkText = j.link;
  try {
    linkText = decodeURIComponent(j.link.replace(/^https?:\/\//, ""));
  } catch {
    // Malformed %-encoding — fall back to the protocol-stripped raw URL.
    linkText = j.link.replace(/^https?:\/\//, "");
  }
  const parts: string[] = [
    j.company,
    j.position,
    linkText,
    j.notes ?? "",
    j.addedBy?.displayName ?? "",
    j.addedBy?.name ?? "",
    ...j.entries.map((e) => e.note ?? ""),
  ];
  return foldDiacritics(parts.join(" ").toLowerCase());
}

export function normalizeQuery(q: string): string {
  return foldDiacritics(q.trim().toLowerCase());
}
