// Run with: npx tsx scripts/test-search.ts
//
// Exercises lib/search.ts against the same scenarios listed in the verification
// table of the search-expansion plan, plus edge cases around URL decoding,
// diacritics, multi-token AND matching, missing fields, and case-insensitive
// substring semantics.

import { buildSearchText, normalizeQuery, type SearchableJob } from "../lib/search";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const line = detail ? `${label} — ${detail}` : label;
    failures.push(line);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// Mimic the filter predicate the React component uses, so the test exercises
// the same shape: build index per-job, normalize+tokenize the query, AND-match.
function matches(jobs: SearchableJob[], query: string): SearchableJob[] {
  const index = new Map(jobs.map((j) => [j as object, buildSearchText(j)]));
  const q = normalizeQuery(query);
  if (!q) return jobs;
  const tokens = q.split(/\s+/).filter(Boolean);
  return jobs.filter((j) => {
    const hay = index.get(j as object);
    return hay !== undefined && tokens.every((t) => hay.includes(t));
  });
}

const FIXTURES: Array<SearchableJob & { _label: string }> = [
  {
    _label: "msft-frontend",
    company: "Microsoft",
    position: "Senior Frontend Engineer",
    link: "https://careers.microsoft.com/job/12345",
    notes: null,
    addedBy: { displayName: "Anthony", name: "Anthony Ramos" },
    entries: [
      { note: "applied via referral from Priya" },
      { note: null },
    ],
  },
  {
    _label: "amazon-backend",
    company: "Amazon",
    position: "Backend Engineer, Robotics",
    link: "https://amazon.jobs/en/jobs/9999/backend-engineer-robotics",
    notes: "high-priority — interview cycle is short",
    addedBy: { displayName: "Krish", name: "Krish K" },
    entries: [{ note: "OA scheduled for Friday" }],
  },
  {
    _label: "workday-fullstack",
    company: "Acme Corp",
    position: "Fullstack Engineer",
    link: "https://acme.wd1.myworkdayjobs.com/en-US/Acme/job/Remote/Fullstack-Engineer_R-12345",
    notes: null,
    addedBy: { displayName: "Sam", name: "Samantha Lee" },
    entries: [],
  },
  {
    _label: "diacritic-cafe",
    company: "Café Étoilé",
    position: "Software Engineer",
    link: "https://cafe-etoile.example/careers/swe",
    notes: null,
    addedBy: { displayName: "Léa", name: "Léa Dubois" },
    entries: [{ note: "résumé sent via email" }],
  },
  {
    _label: "encoded-url",
    company: "Stripe",
    position: "Platform Engineer",
    link: "https://stripe.com/jobs?team=Platform%20Engineering&loc=Remote",
    notes: null,
    addedBy: { displayName: "Krish", name: "Krish K" },
    entries: [],
  },
];

const get = (label: string) => {
  const j = FIXTURES.find((f) => f._label === label);
  if (!j) throw new Error(`fixture ${label} not found`);
  return j;
};

console.log("\nbuildSearchText covers expected fields:\n");
{
  const t = buildSearchText(get("msft-frontend"));
  assert("company → text", t.includes("microsoft"));
  assert("position → text", t.includes("senior frontend engineer"));
  assert("link host → text", t.includes("careers.microsoft.com"));
  assert("addedBy.displayName → text", t.includes("anthony"));
  assert("addedBy.name → text", t.includes("anthony ramos"));
  assert("entries[].note → text", t.includes("priya"));
  assert("null notes don't crash", typeof t === "string");
}

console.log("\nProtocol stripped, URL decoded:\n");
{
  const t = buildSearchText(get("encoded-url"));
  assert("https:// stripped", !t.includes("https://"), JSON.stringify(t).slice(0, 120));
  assert("URL-encoded spaces decoded", t.includes("platform engineering"));
}

console.log("\nDiacritic folding:\n");
{
  const t = buildSearchText(get("diacritic-cafe"));
  assert("café → cafe", t.includes("cafe"));
  assert("étoilé → etoile", t.includes("etoile"));
  assert("résumé → resume", t.includes("resume"));
  assert("Léa → lea", t.includes("lea dubois"));
}

console.log("\nQuery normalization:\n");
{
  assert("trims whitespace", normalizeQuery("  foo  ") === "foo");
  assert("lowercases", normalizeQuery("MICROSOFT") === "microsoft");
  assert("folds diacritics", normalizeQuery("café") === "cafe");
  assert("empty string", normalizeQuery("") === "");
  assert("whitespace only → empty", normalizeQuery("   ") === "");
}

console.log("\nFiltering — every textual source surfaces a match:\n");
{
  const r = (q: string) => matches(FIXTURES, q).map((j) => (j as unknown as { _label: string })._label);

  assert("company → microsoft", r("microsoft").includes("msft-frontend"));
  assert("position → frontend", r("frontend").includes("msft-frontend"));
  assert(
    "link host → workday",
    r("workday").includes("workday-fullstack"),
  );
  assert(
    "decoded URL path → myworkdayjobs.com",
    r("myworkdayjobs.com").includes("workday-fullstack"),
  );
  assert(
    "URL-encoded segment after decoding → 'platform engineering'",
    r("platform engineering").includes("encoded-url"),
  );
  assert(
    "Job.notes → 'high-priority'",
    r("high-priority").includes("amazon-backend"),
  );
  assert(
    "current user's entry note → 'OA scheduled'",
    r("OA scheduled").includes("amazon-backend"),
  );
  assert(
    "another user's entry note → 'priya'",
    r("priya").includes("msft-frontend"),
  );
  assert(
    "addedBy.displayName → 'anthony'",
    r("anthony").includes("msft-frontend"),
  );
  assert(
    "addedBy full name → 'samantha lee'",
    r("samantha lee").includes("workday-fullstack"),
  );
}

console.log("\nMulti-token AND semantics:\n");
{
  const r = (q: string) => matches(FIXTURES, q).map((j) => (j as unknown as { _label: string })._label);
  const both = r("frontend microsoft");
  assert("'frontend microsoft' matches msft-frontend", both.includes("msft-frontend"));
  assert("'frontend microsoft' excludes amazon-backend", !both.includes("amazon-backend"));
  assert(
    "tokens AND-match across different fields (link host + entry note)",
    r("workday samantha").includes("workday-fullstack"),
  );
  assert(
    "no match if any token missing",
    r("frontend amazon").length === 0,
  );
}

console.log("\nCase / diacritic insensitivity at query time:\n");
{
  const r = (q: string) => matches(FIXTURES, q).map((j) => (j as unknown as { _label: string })._label);
  assert("uppercase MICROSOFT → matches", r("MICROSOFT").includes("msft-frontend"));
  assert("query 'cafe' matches Café Étoilé", r("cafe").includes("diacritic-cafe"));
  assert(
    "query 'CAFÉ' matches Café Étoilé (case + diacritics)",
    r("CAFÉ").includes("diacritic-cafe"),
  );
}

console.log("\nEmpty / whitespace queries are no-ops:\n");
{
  assert("empty returns all", matches(FIXTURES, "").length === FIXTURES.length);
  assert("whitespace-only returns all", matches(FIXTURES, "   ").length === FIXTURES.length);
}

console.log("\nMalformed URL fallback doesn't throw:\n");
{
  const broken: SearchableJob = {
    company: "BrokenCorp",
    position: "Engineer",
    link: "https://example.com/%E0%A4%A", // invalid UTF-8 percent escape
    notes: null,
    addedBy: { displayName: "X", name: "X" },
    entries: [],
  };
  let threw = false;
  let text = "";
  try {
    text = buildSearchText(broken);
  } catch {
    threw = true;
  }
  assert("does not throw on invalid %-encoding", !threw);
  assert("still includes company despite broken link", text.includes("brokencorp"));
}

console.log("\nNull-safety on missing optional fields:\n");
{
  const minimal: SearchableJob = {
    company: "Minimal",
    position: "Role",
    link: "https://x.test",
    entries: [],
  };
  const t = buildSearchText(minimal);
  assert("missing notes / addedBy / empty entries doesn't crash", typeof t === "string");
  assert("minimal job still has company in index", t.includes("minimal"));
}

console.log("\nLarge-dataset perf sanity (1500 jobs):\n");
{
  const big: SearchableJob[] = [];
  for (let i = 0; i < 1500; i++) {
    big.push({
      company: `Company${i}`,
      position: `Engineer ${i}`,
      link: `https://company${i}.example/jobs/${i}`,
      notes: i % 7 === 0 ? "high-priority urgent" : null,
      addedBy: { displayName: i % 2 === 0 ? "Krish" : "Anthony", name: "X" },
      entries: [
        { note: i % 5 === 0 ? "applied" : null },
        { note: i % 11 === 0 ? "interview scheduled" : null },
      ],
    });
  }
  const start = performance.now();
  const result = matches(big, "high-priority urgent");
  const elapsed = performance.now() - start;
  console.log(
    `  → 1500-job filter for 'high-priority urgent' took ${elapsed.toFixed(2)}ms (matched ${result.length})`,
  );
  assert("1500-job filter completes in <50ms", elapsed < 50);
  assert("1500-job filter finds expected matches", result.length > 0 && result.length < 1500);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
