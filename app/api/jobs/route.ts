import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emitChange } from "@/lib/events";

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

  const existing = await prisma.job.findUnique({
    where: { link: parsed.data.link },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Job already exists", id: existing.id },
      { status: 409 },
    );
  }

  const job = await prisma.job.create({
    data: {
      company: parsed.data.company,
      position: parsed.data.position,
      link: parsed.data.link,
      notes: parsed.data.notes ?? null,
      addedById: session.user.id,
    },
  });
  emitChange("job.created", session.user.id);
  return NextResponse.json(job, { status: 201 });
}
