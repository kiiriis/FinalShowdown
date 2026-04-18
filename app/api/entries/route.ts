import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppStatus, ReferralStatus } from "@prisma/client";

const patchSchema = z.object({
  jobId: z.string().min(1),
  userId: z.string().min(1),
  status: z.nativeEnum(AppStatus).optional(),
  referral: z.nativeEnum(ReferralStatus).optional(),
});

/** Upserts a JobEntry for (jobId, userId). Users may only modify their own. */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { jobId, userId, status, referral } = parsed.data;
  if (userId !== session.user.id) {
    return new NextResponse("You can only change your own status.", {
      status: 403,
    });
  }

  const entry = await prisma.jobEntry.upsert({
    where: { jobId_userId: { jobId, userId } },
    create: {
      jobId,
      userId,
      status: status ?? "NONE",
      referral: referral ?? "NONE",
    },
    update: {
      ...(status !== undefined && { status }),
      ...(referral !== undefined && { referral }),
    },
  });
  return NextResponse.json(entry);
}
