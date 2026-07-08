import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emitChange } from "@/lib/events";
import { normalizeLinkForDedup } from "@/lib/url-normalize";

const createSchema = z.object({
  company: z.string().min(1),
  position: z.string().min(1),
  link: z.string().url(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      addedBy: { select: { id: true, displayName: true, image: true } },
      entries: true,
    },
  });
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Dedup on both the raw link (exact match, catches legacy rows that
  // predate backfill) and the normalized form (catches tracking-param
  // variants, trailing-slash variants, http/https, etc.).
  const linkNormalized = normalizeLinkForDedup(parsed.data.link);
  const existing = await prisma.job.findFirst({
    where: {
      OR: [{ link: parsed.data.link }, { linkNormalized }],
    },
    select: { id: true, company: true, position: true, link: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "Job already exists",
        id: existing.id,
        company: existing.company,
        position: existing.position,
        link: existing.link,
      },
      { status: 409 },
    );
  }

  // Return the same shape the board renders (addedBy + entries) so the
  // client can insert the new row locally without a full refetch.
  const job = await prisma.job.create({
    data: {
      company: parsed.data.company,
      position: parsed.data.position,
      link: parsed.data.link,
      linkNormalized,
      notes: parsed.data.notes ?? null,
      addedById: session.user.id,
      entries: {
        create: {
          userId: session.user.id,
          status: "APPLIED",
        },
      },
    },
    include: {
      addedBy: {
        select: { id: true, displayName: true, name: true, image: true },
      },
      entries: true,
    },
  });
  emitChange("job.created", session.user.id);
  return NextResponse.json(job, { status: 201 });
}
