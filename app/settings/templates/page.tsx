import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/nav";
import { TemplatesForm } from "@/components/templates-form";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      connectionTemplate: true,
      referralTemplate: true,
      displayName: true,
      email: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <>
      <Nav user={session.user} />
      <main className="container py-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight">
            Message <span className="gradient-text">templates</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the LinkedIn messages you copy from each job row.
            Placeholders auto-fill from the job data and your account.
          </p>
        </div>
        <TemplatesForm
          initialConnection={user.connectionTemplate}
          initialReferral={user.referralTemplate}
          previewCompany="Example Co"
          previewRole="Software Engineer"
          previewLink="https://example.com/jobs/123"
          userName={user.displayName}
          userEmail={user.email}
        />
      </main>
    </>
  );
}
