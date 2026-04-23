import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emitChange } from "@/lib/events";
import { normalizeLinkForDedup } from "@/lib/url-normalize";

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
  if (
    job.addedById !== session.user.id &&
    !isAdminEmail(session.user.email)
  ) {
    return new NextResponse("Only the creator or an admin can edit this job", {
      status: 403,
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // If the link changed, enforce dedup against every other job and recompute
  // the normalized form. If the link is unchanged, leave both columns alone.
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.link && parsed.data.link !== job.link) {
    const linkNormalized = normalizeLinkForDedup(parsed.data.link);
    const clash = await prisma.job.findFirst({
      where: {
        id: { not: id },
        OR: [{ link: parsed.data.link }, { linkNormalized }],
      },
      select: { id: true, company: true, position: true, link: true },
    });
    if (clash) {
      return NextResponse.json(
        {
          error: "Another job already uses that link",
          id: clash.id,
          company: clash.company,
          position: clash.position,
          link: clash.link,
        },
        { status: 409 },
      );
    }
    data.linkNormalized = linkNormalized;
  }

  const updated = await prisma.job.update({
    where: { id },
    data,
  });
  emitChange("job.updated", session.user.id);
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
  if (
    job.addedById !== session.user.id &&
    !isAdminEmail(session.user.email)
  ) {
    return new NextResponse(
      "Only the creator or an admin can delete this job",
      { status: 403 },
    );
  }
  await prisma.job.delete({ where: { id } });
  emitChange("job.deleted", session.user.id);
  return new NextResponse(null, { status: 204 });
}
