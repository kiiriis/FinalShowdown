import { PrismaClient } from "@prisma/client";
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { company: { contains: "test", mode: "insensitive" } },
        { position: { contains: "test", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      addedBy: { select: { displayName: true } },
      entries: {
        include: { user: { select: { displayName: true } } },
      },
    },
  });
  for (const j of jobs) {
    console.log(
      `\n• ${j.company} / ${j.position}  (added ${j.addedBy.displayName} @ ${j.createdAt.toISOString()})  id=${j.id}`,
    );
    for (const e of j.entries) {
      console.log(
        `    - ${e.user.displayName.padEnd(10)} status=${e.status.padEnd(22)} referral=${e.referral.padEnd(10)} updated=${e.updatedAt.toISOString()}`,
      );
    }
  }
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
