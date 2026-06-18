/**
 * ONE-TIME July-1 reconciliation: merge the frozen Neon history into the live
 * Supabase database.
 *
 * Context: on 2026-06-18 we went live on Supabase seeded from the April CSV,
 * because Neon's free compute quota was exhausted (resets 2026-07-01). Neon
 * still holds the *real* history (statuses, notes, outreach flags the CSV never
 * had, plus every job/entry added Apr–Jun). This script brings that history
 * into Supabase without clobbering anything friends changed in the meantime.
 *
 * Matching is by NATURAL KEYS so the two databases' cuids never collide:
 *   - User  → email
 *   - Job   → link
 *   - Entry → (job.link, user.email)
 *
 * Conflict policy for JobEntry (the only field-level conflict that matters):
 *   - Entry exists only in Neon            → create it in Supabase (full fidelity)
 *   - Entry exists in both, Supabase row
 *     was edited AFTER cutover             → KEEP Supabase (genuine window edit)
 *   - Entry exists in both, untouched
 *     since the seed (updatedAt <= cutover)→ OVERWRITE from Neon (real history)
 *
 * CUTOVER defaults to the go-live date. Override with MERGE_CUTOVER if needed.
 * Users/Jobs have no reliable updatedAt for window-edit detection, so for those
 * Neon only FILLS GAPS (never overwrites a non-empty Supabase value).
 *
 * SAFE BY DEFAULT: dry-run unless you pass --commit.
 *
 * Usage (on/after 2026-07-01, once Neon quota resets):
 *   NEON_DATABASE_URL=... npx tsx scripts/merge-neon-into-supabase.ts          # preview
 *   NEON_DATABASE_URL=... npx tsx scripts/merge-neon-into-supabase.ts --commit # apply
 */
import { PrismaClient } from "@prisma/client";

const COMMIT = process.argv.includes("--commit");
const CUTOVER = new Date(process.env.MERGE_CUTOVER ?? "2026-06-18T00:00:00Z");

const NEON_URL = process.env.NEON_DATABASE_URL;
const SUPA_URL = process.env.DATABASE_URL;

if (!NEON_URL) {
  console.error(
    "NEON_DATABASE_URL is required (the old Neon pooled string — see .env comments).",
  );
  process.exit(1);
}
if (!SUPA_URL) {
  console.error("DATABASE_URL (Supabase) is required.");
  process.exit(1);
}

const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });
const supa = new PrismaClient({ datasources: { db: { url: SUPA_URL } } });

const tag = COMMIT ? "[COMMIT]" : "[dry-run]";

async function main() {
  // Fail fast & friendly if Neon is still quota-locked.
  try {
    await neon.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error(
      "Could not reach Neon. If it's before 2026-07-01 the compute quota is " +
        "still exhausted (HTTP 402) — wait for the reset, then re-run.\n",
      e,
    );
    process.exit(1);
  }

  console.log(`${tag} cutover = ${CUTOVER.toISOString()}\n`);

  // ── Users: match by email, fill gaps only ───────────────────────────────
  const neonUsers = await neon.user.findMany();
  const emailToSupaUserId = new Map<string, string>();
  let usersCreated = 0;
  let usersFilled = 0;

  for (const nu of neonUsers) {
    const existing = await supa.user.findUnique({ where: { email: nu.email } });
    if (!existing) {
      if (COMMIT) {
        const created = await supa.user.create({
          data: {
            email: nu.email,
            name: nu.name,
            image: nu.image,
            displayName: nu.displayName,
            connectionTemplate: nu.connectionTemplate,
            referralTemplate: nu.referralTemplate,
            followUpDelayDays: nu.followUpDelayDays,
            isActive: nu.isActive,
            createdAt: nu.createdAt,
          },
        });
        emailToSupaUserId.set(nu.email, created.id);
      }
      usersCreated++;
      continue;
    }
    emailToSupaUserId.set(nu.email, existing.id);
    // Fill only empty Supabase fields from Neon (never clobber window edits).
    const patch: Record<string, unknown> = {};
    if (!existing.connectionTemplate && nu.connectionTemplate)
      patch.connectionTemplate = nu.connectionTemplate;
    if (!existing.referralTemplate && nu.referralTemplate)
      patch.referralTemplate = nu.referralTemplate;
    if (!existing.image && nu.image) patch.image = nu.image;
    if (Object.keys(patch).length) {
      if (COMMIT)
        await supa.user.update({ where: { id: existing.id }, data: patch });
      usersFilled++;
    }
  }

  // ── Jobs: match by link, create missing, fill gaps ──────────────────────
  const neonJobs = await neon.job.findMany();
  const neonJobIdToSupaJobId = new Map<string, string>();
  const adminEmail = (process.env.ADMIN_SEED_EMAIL ?? "").toLowerCase();
  const adminSupaId = adminEmail ? emailToSupaUserId.get(adminEmail) : undefined;
  let jobsCreated = 0;
  let jobsFilled = 0;
  let jobsSkippedNoOwner = 0;

  for (const nj of neonJobs) {
    const existing = await supa.job.findUnique({ where: { link: nj.link } });
    if (existing) {
      neonJobIdToSupaJobId.set(nj.id, existing.id);
      if (!existing.notes && nj.notes) {
        if (COMMIT)
          await supa.job.update({
            where: { id: existing.id },
            data: { notes: nj.notes },
          });
        jobsFilled++;
      }
      continue;
    }
    // New job from Neon — remap its owner by email, fall back to admin.
    const neonOwner = neonUsers.find((u) => u.id === nj.addedById);
    const ownerSupaId =
      (neonOwner && emailToSupaUserId.get(neonOwner.email)) || adminSupaId;
    if (!ownerSupaId) {
      jobsSkippedNoOwner++;
      continue;
    }
    if (COMMIT) {
      const created = await supa.job.create({
        data: {
          company: nj.company,
          position: nj.position,
          link: nj.link,
          linkNormalized: nj.linkNormalized,
          notes: nj.notes,
          addedById: ownerSupaId,
          createdAt: nj.createdAt,
          updatedAt: nj.updatedAt,
        },
      });
      neonJobIdToSupaJobId.set(nj.id, created.id);
    }
    jobsCreated++;
  }

  // ── JobEntries: the real merge (updatedAt-based conflict resolution) ─────
  const neonEntries = await neon.jobEntry.findMany();
  let entriesCreated = 0;
  let entriesOverwritten = 0;
  let entriesKeptSupabase = 0;
  let entriesUnresolved = 0;

  for (const ne of neonEntries) {
    const supaJobId = neonJobIdToSupaJobId.get(ne.jobId);
    const neonUser = neonUsers.find((u) => u.id === ne.userId);
    const supaUserId = neonUser && emailToSupaUserId.get(neonUser.email);
    if (!supaJobId || !supaUserId) {
      // Owner/job couldn't be remapped — only happens in dry-run where creates
      // were skipped, or for an owner outside the allowlist.
      entriesUnresolved++;
      continue;
    }

    const existing = await supa.jobEntry.findUnique({
      where: { jobId_userId: { jobId: supaJobId, userId: supaUserId } },
    });

    const data = {
      status: ne.status,
      referral: ne.referral,
      referralSentAt: ne.referralSentAt,
      referralFollowUpSent: ne.referralFollowUpSent,
      coldEmailSent: ne.coldEmailSent,
      coldEmailSentAt: ne.coldEmailSentAt,
      coldEmailFollowUpSent: ne.coldEmailFollowUpSent,
      note: ne.note,
    };

    if (!existing) {
      if (COMMIT)
        await supa.jobEntry.create({
          data: { jobId: supaJobId, userId: supaUserId, ...data },
        });
      entriesCreated++;
    } else if (existing.updatedAt > CUTOVER) {
      // Edited in Supabase during the window → it wins.
      entriesKeptSupabase++;
    } else {
      // Untouched seed baseline → Neon's real history wins.
      if (COMMIT)
        await supa.jobEntry.update({ where: { id: existing.id }, data });
      entriesOverwritten++;
    }
  }

  console.log(
    [
      `${tag} RESULT`,
      `  users:   +${usersCreated} created, ${usersFilled} gap-filled`,
      `  jobs:    +${jobsCreated} created, ${jobsFilled} gap-filled, ${jobsSkippedNoOwner} skipped (no owner)`,
      `  entries: +${entriesCreated} created, ${entriesOverwritten} overwritten-from-neon, ${entriesKeptSupabase} kept-supabase, ${entriesUnresolved} unresolved`,
      "",
      COMMIT
        ? "Committed. ✅"
        : "Dry-run only — re-run with --commit to apply. (In dry-run, created jobs aren't mapped, so their entries show as 'unresolved'.)",
    ].join("\n"),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await neon.$disconnect();
    await supa.$disconnect();
  });
