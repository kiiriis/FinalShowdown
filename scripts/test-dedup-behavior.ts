import { prisma } from "../lib/db";
import { normalizeLinkForDedup } from "../lib/url-normalize";

async function dedupLookup(rawLink: string) {
  const normalized = normalizeLinkForDedup(rawLink);
  const hit = await prisma.job.findFirst({
    where: { OR: [{ link: rawLink }, { linkNormalized: normalized }] },
    select: { id: true, company: true, position: true, link: true },
  });
  return { normalized, hit };
}

type Case = { name: string; input: string; shouldCollide: boolean };

async function main() {
  // Pick a real row to build realistic variants off of.
  const sample = await prisma.job.findFirst({
    where: { linkNormalized: { not: null } },
    select: { link: true, linkNormalized: true, company: true },
  });
  if (!sample) {
    console.error("No sample job with linkNormalized found — aborting.");
    process.exit(1);
  }
  console.log(`Sample row: ${sample.company}`);
  console.log(`  original:   ${sample.link}`);
  console.log(`  normalized: ${sample.linkNormalized}\n`);

  const cases: Case[] = [
    { name: "exact same link", input: sample.link, shouldCollide: true },
    {
      name: "same + utm_source",
      input: `${sample.link}${sample.link.includes("?") ? "&" : "?"}utm_source=test`,
      shouldCollide: true,
    },
    {
      name: "same + fragment",
      input: `${sample.link}#top`,
      shouldCollide: true,
    },
    {
      name: "same + trailing slash",
      input: /\?/.test(sample.link) ? sample.link : `${sample.link}/`,
      shouldCollide: true,
    },
    {
      name: "http:// instead of https://",
      input: sample.link.replace(/^https:\/\//, "http://"),
      shouldCollide: true,
    },
    {
      name: "uppercase host",
      input: sample.link.replace(
        /^https?:\/\/([^/]+)/,
        (_, host: string) => `https://${host.toUpperCase()}`,
      ),
      shouldCollide: true,
    },
    {
      name: "totally unrelated link should NOT collide",
      input: "https://example-nothing-here.test/jobs/abcdef12345?nope=1",
      shouldCollide: false,
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const c of cases) {
    const { normalized, hit } = await dedupLookup(c.input);
    const collided = hit !== null;
    const ok = collided === c.shouldCollide;
    if (ok) {
      console.log(
        `✓ ${c.name}  →  ${collided ? `hit ${hit!.id.slice(0, 8)}…` : "no match"}`,
      );
      passed++;
    } else {
      console.error(`✗ ${c.name}`);
      console.error(`    input:      ${c.input}`);
      console.error(`    normalized: ${normalized}`);
      console.error(`    expected:   ${c.shouldCollide ? "collision" : "no collision"}`);
      console.error(`    actual:     ${collided ? "collision" : "no collision"}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
