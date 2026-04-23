import { normalizeLinkForDedup } from "../lib/url-normalize";

type Case = { name: string; input: string; expect: string };

const cases: Case[] = [
  {
    name: "bare https URL unchanged",
    input: "https://example.com/job/123",
    expect: "https://example.com/job/123",
  },
  {
    name: "trailing slash on path",
    input: "https://example.com/job/123/",
    expect: "https://example.com/job/123",
  },
  {
    name: "bare domain with trailing slash kept at /",
    input: "https://example.com/",
    expect: "https://example.com/",
  },
  {
    name: "strips single utm_source",
    input: "https://example.com/job/123?utm_source=linkedin",
    expect: "https://example.com/job/123",
  },
  {
    name: "strips all utm_* and keeps legit params",
    input: "https://example.com/job/123?utm_source=a&utm_medium=b&foo=bar",
    expect: "https://example.com/job/123?foo=bar",
  },
  {
    name: "strips fragment",
    input: "https://example.com/job/123#apply",
    expect: "https://example.com/job/123",
  },
  {
    name: "lowercases host",
    input: "https://EXAMPLE.com/Job/123",
    expect: "https://example.com/Job/123",
  },
  {
    name: "strips www.",
    input: "https://www.example.com/job/123",
    expect: "https://example.com/job/123",
  },
  {
    name: "unifies http -> https",
    input: "http://example.com/job/123",
    expect: "https://example.com/job/123",
  },
  {
    name: "strips default https port",
    input: "https://example.com:443/job/123",
    expect: "https://example.com/job/123",
  },
  {
    name: "strips default http port after protocol unification",
    input: "http://example.com:80/job/123",
    expect: "https://example.com/job/123",
  },
  {
    name: "sorts remaining query params",
    input: "https://example.com/jobs?z=1&a=2&m=3",
    expect: "https://example.com/jobs?a=2&m=3&z=1",
  },
  {
    name: "strips gclid + fbclid",
    input: "https://example.com/job/123?gclid=abc&fbclid=xyz",
    expect: "https://example.com/job/123",
  },
  {
    name: "strips LinkedIn trk param",
    input:
      "https://www.linkedin.com/jobs/view/3876543210/?trk=flagship_nav_jobs&refId=abc",
    expect: "https://linkedin.com/jobs/view/3876543210",
  },
  {
    name: "passes through unknown params",
    input: "https://example.com/jobs?id=42&locale=en",
    expect: "https://example.com/jobs?id=42&locale=en",
  },
  {
    name: "invalid URL falls through (lowercased)",
    input: "Not A URL",
    expect: "not a url",
  },
  {
    name: "empty string stays empty",
    input: "",
    expect: "",
  },
  {
    name: "trailing whitespace trimmed",
    input: "  https://example.com/job/123/  ",
    expect: "https://example.com/job/123",
  },
  {
    name: "preserves path case (paths are case-sensitive)",
    input: "https://example.com/JOBS/ABC-123",
    expect: "https://example.com/JOBS/ABC-123",
  },
  {
    name: "preserves value case in kept params",
    input: "https://example.com/jobs?id=AbC-123",
    expect: "https://example.com/jobs?id=AbC-123",
  },
];

let passed = 0;
let failed = 0;
for (const c of cases) {
  const actual = normalizeLinkForDedup(c.input);
  const ok = actual === c.expect;
  if (ok) {
    passed++;
    console.log(`✓ ${c.name}`);
  } else {
    failed++;
    console.error(`✗ ${c.name}`);
    console.error(`    input:    ${JSON.stringify(c.input)}`);
    console.error(`    expected: ${JSON.stringify(c.expect)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed (${cases.length} total)`);
process.exit(failed === 0 ? 0 : 1);
