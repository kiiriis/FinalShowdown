import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  company: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  link: z.string().url().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return new NextResponse("Not found", { status: 404 });
  if (job.addedById !== session.user.id) {
    return new NextResponse("Only the creator can edit this job", {
      status: 403,
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.job.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return new NextResponse("Not found", { status: 404 });
  if (job.addedById !== session.user.id) {
    return new NextResponse("Only the creator can delete this job", {
      status: 403,
    });
  }
  await prisma.job.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
