import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/lib/auth";
import { getAllJobs, getAllUsers } from "@/lib/data";
import { Nav } from "@/components/nav";
import { JobsBoard } from "@/components/jobs-board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [jobs, users] = await Promise.all([getAllJobs(), getAllUsers()]);

  return (
    <>
      <Nav user={session.user} />
      <main className="container py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight">
              The <span className="gradient-text">Final Showdown</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track every application. See who's ahead. Ask for referrals.
            </p>
          </div>
        </div>
        <JobsBoard
          jobs={jobs.map((j) => ({
            ...j,
            createdAt: j.createdAt.toISOString(),
            entries: j.entries.map((e) => ({
              ...e,
              updatedAt: e.updatedAt.toISOString(),
            })),
          }))}
          users={users}
          currentUserId={session.user.id}
          isAdmin={isAdminEmail(session.user.email)}
        />
      </main>
    </>
  );
}
