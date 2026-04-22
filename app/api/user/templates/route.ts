import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  connectionTemplate: z.string().max(4000).nullable().optional(),
  referralTemplate: z.string().max(4000).nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { connectionTemplate, referralTemplate } = parsed.data;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(connectionTemplate !== undefined && {
        connectionTemplate: connectionTemplate === "" ? null : connectionTemplate,
      }),
      ...(referralTemplate !== undefined && {
        referralTemplate: referralTemplate === "" ? null : referralTemplate,
      }),
    },
    select: {
      connectionTemplate: true,
      referralTemplate: true,
    },
  });

  return NextResponse.json(user);
}
