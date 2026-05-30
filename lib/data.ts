import { prisma } from "./db";
import { AppStatus, ReferralStatus } from "@prisma/client";

export type JobWithEntries = Awaited<ReturnType<typeof getAllJobs>>[number];
export type PublicUser = Awaited<ReturnType<typeof getAllUsers>>[number];

export async function getAllUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      displayName: true,
      name: true,
      email: true,
      image: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAllJobs() {
  return prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      addedBy: {
        select: { id: true, displayName: true, name: true, image: true },
      },
      entries: {
        where: { user: { isActive: true } },
        select: {
          id: true,
          userId: true,
          status: true,
          referral: true,
          referralSentAt: true,
          referralFollowUpSent: true,
          coldEmailSent: true,
          coldEmailSentAt: true,
          coldEmailFollowUpSent: true,
          note: true,
          updatedAt: true,
        },
      },
    },
  });
}

export type EntryStatusCount = Record<AppStatus, number>;
export type ReferralCount = Record<ReferralStatus, number>;

export async function getDashboardData() {
  const [users, jobs] = await Promise.all([getAllUsers(), getAllJobs()]);
  const activeUserIds = new Set(users.map((u) => u.id));

  const totalJobs = jobs.length;

  // Per-user stats from entries
  const perUser = users.map((u) => {
    const entries = jobs.flatMap((j) =>
      j.entries.filter((e) => e.userId === u.id),
    );
    const statusCounts: EntryStatusCount = {
      NONE: 0,
      APPLIED: 0,
      APPLIED_WITH_REFERRAL: 0,
      FOLLOW_UP_SENT: 0,
      SKIPPED: 0,
      REJECTED: 0,
      EXPIRED: 0,
      OFFER: 0,
    };
    const refCounts: ReferralCount = {
      NONE: 0,
      REQUESTED: 0,
      RECEIVED: 0,
      NOT_NEEDED: 0,
    };
    for (const e of entries) {
      statusCounts[e.status]++;
      refCounts[e.referral]++;
    }
    // Pending = jobs with no explicit status for this user (either no entry OR NONE)
    const entriesByJob = new Map(entries.map((e) => [e.id, e]));
    void entriesByJob;
    const pending =
      jobs.length - (entries.length - statusCounts.NONE);
    // applications = anything not NONE/SKIPPED
    const applied =
      statusCounts.APPLIED +
      statusCounts.APPLIED_WITH_REFERRAL +
      statusCounts.OFFER;
    return {
      user: u,
      statusCounts,
      refCounts,
      totals: {
        applied,
        skipped: statusCounts.SKIPPED,
        rejected: statusCounts.REJECTED,
        pending,
        offers: statusCounts.OFFER,
      },
    };
  });

  // Jobs added over time by addedBy — last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const byDay = new Map<string, Record<string, number>>();
  const totalsByDay = new Map<string, number>();
  for (const j of jobs) {
    if (j.createdAt < cutoff) continue;
    const day = j.createdAt.toISOString().slice(0, 10);
    const row = byDay.get(day) ?? {};
    row[j.addedById] = (row[j.addedById] ?? 0) + 1;
    byDay.set(day, row);
    totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + 1);
  }
  // Treat any single day with 100+ jobs as a bulk import (CSV seed) and
  // exclude it from the timeline so a single spike doesn't swamp the chart.
  const importDays: Array<{ day: string; count: number }> = [];
  for (const [day, count] of totalsByDay) {
    if (count >= 100) {
      importDays.push({ day, count });
      byDay.delete(day);
    }
  }
  const timeline = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({ day, ...counts }));

  // Referrals needed (per user)
  const referralRequests = jobs
    .flatMap((j) =>
      j.entries
        .filter(
          (e) => e.referral === "REQUESTED" && activeUserIds.has(e.userId),
        )
        .map((e) => ({ job: j, entry: e })),
    )
    .sort((a, b) => b.entry.updatedAt.getTime() - a.entry.updatedAt.getTime());

  // Applications over time (day/week/month) per user. "Application" means an
  // entry whose status is APPLIED or APPLIED_WITH_REFERRAL; we use the entry's
  // updatedAt as when they applied. CSV-seeded statuses all share a single
  // updatedAt (the seed run) — detect and exclude those spike days so trends
  // stay readable, mirroring the `importDays` handling above.
  const applied: Array<{ userId: string; ts: Date }> = [];
  for (const j of jobs) {
    for (const e of j.entries) {
      if (e.status === "APPLIED" || e.status === "APPLIED_WITH_REFERRAL") {
        applied.push({ userId: e.userId, ts: e.updatedAt });
      }
    }
  }
  const appliedByDay = new Map<string, number>();
  for (const a of applied) {
    const k = a.ts.toISOString().slice(0, 10);
    appliedByDay.set(k, (appliedByDay.get(k) ?? 0) + 1);
  }
  const seedDays = new Set<string>();
  for (const [day, total] of appliedByDay) {
    if (total >= 200) seedDays.add(day);
  }
  const cleanApplied = applied.filter(
    (a) => !seedDays.has(a.ts.toISOString().slice(0, 10)),
  );

  const bucketDay = (d: Date) => d.toISOString().slice(0, 10);
  const bucketWeek = (d: Date) => {
    // Sunday-start week, labeled as YYYY-MM-DD of that Sunday (UTC).
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    x.setUTCDate(x.getUTCDate() - x.getUTCDay());
    return x.toISOString().slice(0, 10);
  };
  const bucketMonth = (d: Date) => d.toISOString().slice(0, 7);

  const buildSeries = (
    fn: (d: Date) => string,
    limit: number,
  ): Array<Record<string, string | number>> => {
    const byBucket = new Map<string, Record<string, number>>();
    for (const a of cleanApplied) {
      const k = fn(a.ts);
      const row = byBucket.get(k) ?? {};
      row[a.userId] = (row[a.userId] ?? 0) + 1;
      byBucket.set(k, row);
    }
    const sorted = Array.from(byBucket.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return sorted.slice(-limit).map(([bucket, counts]) => ({
      bucket,
      ...counts,
    }));
  };

  const applications = {
    day: buildSeries(bucketDay, 30),
    week: buildSeries(bucketWeek, 26),
    month: buildSeries(bucketMonth, 12),
  };

  return {
    users,
    totalJobs,
    perUser,
    timeline,
    referralRequests,
    importDays,
    applications,
  };
}
