/**
 * Merge a placeholder CSV-seed user into the real Google-signed-in user.
 *
 * Use when a display-name override typo caused NextAuth to create a second
 * user row (real email) alongside the seed placeholder (local email),
 * leaving CSV-imported entries orphaned on the placeholder.
 *
 * Usage:
 *   tsx scripts/merge-duplicate-user.ts \
 *     --from alice@final-showdown.local \
 *     --to alice.real@gmail.com \
 *     --displayName Alice
 *
 * Add --dry to preview without writing.
 */
import { PrismaClient } from "@prisma/client";

// Prefer the unpooled endpoint — PgBouncer's cached catalog has bitten us
// during schema-ish operations before. Falls back to DATABASE_URL for
// environments that only set one.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: { db: { url } },
});

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const fromEmail = arg("--from")?.toLowerCase();
  const toEmail = arg("--to")?.toLowerCase();
  const displayName = arg("--displayName");
  const dry = process.argv.includes("--dry");

  if (!fromEmail || !toEmail) {
    console.error(
      "Required: --from <placeholder-email> --to <real-email> [--displayName Name] [--dry]",
    );
    process.exit(1);
  }

  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { email: fromEmail } }),
    prisma.user.findUnique({ where: { email: toEmail } }),
  ]);
  if (!from) {
    console.error(`"from" user not found: ${fromEmail}`);
    process.exit(1);
  }
  if (!to) {
    console.error(`"to" user not found: ${toEmail}`);
    process.exit(1);
  }

  const fromEntries = await prisma.jobEntry.count({ where: { userId: from.id } });
  const toEntries = await prisma.jobEntry.count({ where: { userId: to.id } });
  const fromJobs = await prisma.job.count({ where: { addedById: from.id } });

  console.log(
    `Plan: move ${fromEntries} entries + ${fromJobs} jobs from ${from.email} (${from.id}) → ${to.email} (${to.id}). ` +
      `${to.email} already has ${toEntries} entries.`,
  );

  if (dry) {
    console.log("Dry run — no writes.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. For any job where BOTH users already have an entry, drop the
    // placeholder's entry (the real user's entry wins). This only happens
    // if the real user edited something before the merge.
    const fromRows = await tx.jobEntry.findMany({
      where: { userId: from.id },
      select: { jobId: true, id: true },
    });
    const toJobIds = new Set(
      (
        await tx.jobEntry.findMany({
          where: { userId: to.id },
          select: { jobId: true },
        })
      ).map((e) => e.jobId),
    );
    const conflictIds: string[] = [];
    const moveIds: string[] = [];
    for (const r of fromRows) {
      (toJobIds.has(r.jobId) ? conflictIds : moveIds).push(r.id);
    }
    if (conflictIds.length > 0) {
      await tx.jobEntry.deleteMany({ where: { id: { in: conflictIds } } });
    }
    if (moveIds.length > 0) {
      await tx.jobEntry.updateMany({
        where: { id: { in: moveIds } },
        data: { userId: to.id },
      });
    }

    // 2. Reassign any jobs added by the placeholder (shouldn't happen, but safe).
    await tx.job.updateMany({
      where: { addedById: from.id },
      data: { addedById: to.id },
    });

    // 3. Rename the real user if requested.
    if (displayName) {
      await tx.user.update({
        where: { id: to.id },
        data: { displayName },
      });
    }

    // 4. Delete the placeholder.
    await tx.user.delete({ where: { id: from.id } });

    console.log(
      `Merged. Moved ${moveIds.length} entries, dropped ${conflictIds.length} conflicts, deleted ${from.email}.`,
    );
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
