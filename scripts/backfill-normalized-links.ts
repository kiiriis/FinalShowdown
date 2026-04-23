import { prisma } from "../lib/db";
import { normalizeLinkForDedup } from "../lib/url-normalize";

async function main() {
  const jobs = await prisma.job.findMany({
    select: { id: true, link: true, company: true, position: true, linkNormalized: true },
  });
  console.log(`Scanning ${jobs.length} jobs…`);

  // Group by normalized to find collisions (two+ rows that would now dedup).
  const byNormalized = new Map<string, typeof jobs>();
  const toUpdate: Array<{ id: string; link: string; normalized: string }> = [];

  for (const j of jobs) {
    const normalized = normalizeLinkForDedup(j.link);
    const existing = byNormalized.get(normalized) ?? [];
    existing.push(j);
    byNormalized.set(normalized, existing);
    if (j.linkNormalized !== normalized) {
      toUpdate.push({ id: j.id, link: j.link, normalized });
    }
  }

  const collisions = [...byNormalized.entries()].filter(([, group]) => group.length > 1);

  if (collisions.length > 0) {
    console.warn(`\n⚠  Found ${collisions.length} collision group(s) in existing data:`);
    for (const [normalized, group] of collisions) {
      console.warn(`\n  normalized → ${normalized}`);
      for (const g of group) {
        console.warn(`    - [${g.id}] ${g.company} / ${g.position}`);
        console.warn(`        ${g.link}`);
      }
    }
    console.warn(
      "\n  (Dedup only affects NEW inserts. Existing rows keep their own link. " +
        "No rows are deleted. Review the above if you want to hand-merge later.)\n",
    );
  } else {
    console.log("✓ No collisions in existing data.");
  }

  if (toUpdate.length === 0) {
    console.log("✓ Every row already has the correct normalized value. Nothing to update.");
    return;
  }

  console.log(`Updating ${toUpdate.length} rows…`);
  // Batched updates in a transaction so backfill is atomic.
  const BATCH = 200;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const slice = toUpdate.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((u) =>
        prisma.job.update({
          where: { id: u.id },
          data: { linkNormalized: u.normalized },
        }),
      ),
    );
    console.log(`  ${Math.min(i + BATCH, toUpdate.length)} / ${toUpdate.length}`);
  }
  console.log("✓ Backfill complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
