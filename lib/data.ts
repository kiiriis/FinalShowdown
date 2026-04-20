import { prisma } from "./db";
import { AppStatus, ReferralStatus } from "@prisma/client";

export type JobWithEntries = Awaited<ReturnType<typeof getAllJobs>>[number];
export type PublicUser = Awaited<ReturnType<typeof getAllUsers>>[number];

export async function getAllUsers() {
  return prisma.user.findMany({
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
        select: {
          id: true,
          userId: true,
          status: true,
          referral: true,
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
        .filter((e) => e.referral === "REQUESTED")
        .map((e) => ({ job: j, entry: e })),
    )
    .sort((a, b) => b.entry.updatedAt.getTime() - a.entry.updatedAt.getTime());

  return {
    users,
    totalJobs,
    perUser,
    timeline,
    referralRequests,
    importDays,
  };
}
