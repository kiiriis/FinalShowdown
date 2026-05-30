import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emitChange } from "@/lib/events";
import { AppStatus, ReferralStatus } from "@prisma/client";

const patchSchema = z.object({
  jobId: z.string().min(1),
  userId: z.string().min(1),
  status: z.nativeEnum(AppStatus).optional(),
  referral: z.nativeEnum(ReferralStatus).optional(),
  referralSentAt: z.string().nullable().optional(),
  referralFollowUpSent: z.boolean().optional(),
  // Tracks whether this user has sent a cold email / cold DM for the role.
  coldEmailSent: z.boolean().optional(),
  coldEmailSentAt: z.string().nullable().optional(),
  coldEmailFollowUpSent: z.boolean().optional(),
  // Per-user sticky note. Null/empty string clears it.
  note: z.string().max(2000).nullable().optional(),
});

function parseDateField(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00.000Z`
    : value;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Upserts a JobEntry for (jobId, userId). Users may only modify their own. */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    jobId,
    userId,
    status,
    referral,
    referralSentAt,
    referralFollowUpSent,
    coldEmailSent,
    coldEmailSentAt,
    coldEmailFollowUpSent,
    note,
  } = parsed.data;
  // Empty string → null so "clearing" a note doesn't leave a ghost row.
  const noteClean = note === undefined ? undefined : note === "" ? null : note;
  const referralDate = parseDateField(referralSentAt);
  const coldEmailDate = parseDateField(coldEmailSentAt);
  if (
    (referralSentAt !== undefined && referralDate === undefined) ||
    (coldEmailSentAt !== undefined && coldEmailDate === undefined)
  ) {
    return NextResponse.json({ error: "Invalid outreach date" }, { status: 400 });
  }
  if (userId !== session.user.id && !isAdminEmail(session.user.email)) {
    return new NextResponse("You can only change your own status.", {
      status: 403,
    });
  }

  const createReferral =
    referral ?? (referralDate ? "REQUESTED" : "NONE");
  const createColdEmailSent = coldEmailSent ?? Boolean(coldEmailDate);
  const entry = await prisma.jobEntry.upsert({
    where: { jobId_userId: { jobId, userId } },
    create: {
      jobId,
      userId,
      status: status ?? "NONE",
      referral: createReferral,
      referralSentAt: referralDate ?? null,
      referralFollowUpSent: referralFollowUpSent ?? false,
      coldEmailSent: createColdEmailSent,
      coldEmailSentAt: coldEmailDate ?? null,
      coldEmailFollowUpSent: coldEmailFollowUpSent ?? false,
      note: noteClean ?? null,
    },
    update: {
      ...(status !== undefined && { status }),
      ...(referral !== undefined && {
        referral,
        ...(referral === "NONE" && {
          referralSentAt: null,
          referralFollowUpSent: false,
        }),
      }),
      ...(referralDate !== undefined && { referralSentAt: referralDate }),
      ...(referralDate === null && { referralFollowUpSent: false }),
      ...(referralFollowUpSent !== undefined && { referralFollowUpSent }),
      ...(coldEmailSent !== undefined && {
        coldEmailSent,
        ...(coldEmailSent === false && {
          coldEmailSentAt: null,
          coldEmailFollowUpSent: false,
        }),
      }),
      ...(coldEmailDate !== undefined && {
        coldEmailSentAt: coldEmailDate,
        ...(coldEmailDate !== null && { coldEmailSent: true }),
      }),
      ...(coldEmailDate === null && {
        coldEmailSent: false,
        coldEmailFollowUpSent: false,
      }),
      ...(coldEmailFollowUpSent !== undefined && { coldEmailFollowUpSent }),
      ...(noteClean !== undefined && { note: noteClean }),
    },
  });

  // Cascade EXPIRED: if someone flags a posting as expired, anyone who hasn't
  // acted on it yet (status NONE, or no entry at all) gets auto-marked EXPIRED
  // too — otherwise the job sits with stale "Not applied" chips forever. We
  // don't touch explicit statuses (APPLIED / SKIPPED / REJECTED / OFFER).
  if (status === "EXPIRED") {
    const otherUsers = await prisma.user.findMany({
      where: { id: { not: userId }, isActive: true },
      select: { id: true },
    });
    if (otherUsers.length > 0) {
      await prisma.$transaction([
        prisma.jobEntry.updateMany({
          where: {
            jobId,
            userId: { in: otherUsers.map((u) => u.id) },
            status: "NONE",
          },
          data: { status: "EXPIRED" },
        }),
        prisma.jobEntry.createMany({
          data: otherUsers.map((u) => ({
            jobId,
            userId: u.id,
            status: "EXPIRED" as const,
            referral: "NONE" as const,
          })),
          skipDuplicates: true,
        }),
      ]);
    }
  }

  emitChange("entry.updated", session.user.id);
  return NextResponse.json(entry);
}
