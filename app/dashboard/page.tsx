import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, ExternalLink, HandHelping } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { Nav } from "@/components/nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusDonut } from "@/components/charts/status-donut";
import { UserBar } from "@/components/charts/user-bar";
import { Timeline } from "@/components/charts/timeline";
import { ApplicationsOverTime } from "@/components/charts/applications-over-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const data = await getDashboardData();

  const me = data.perUser.find((p) => p.user.id === session.user.id);

  const barData = data.perUser.map((p) => ({
    name: p.user.displayName,
    Applied: p.statusCounts.APPLIED,
    Referred: p.statusCounts.APPLIED_WITH_REFERRAL,
    Skipped: p.statusCounts.SKIPPED,
    Rejected: p.statusCounts.REJECTED,
    Offer: p.statusCounts.OFFER,
  }));

  const leaderboard = [...data.perUser].sort(
    (a, b) => b.totals.applied - a.totals.applied,
  );

  return (
    <>
      <Nav user={session.user} />
      <main className="container py-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live stats for the squad. Numbers don't lie.
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Total jobs" value={data.totalJobs} href="/" />
          <Kpi
            label="My applied"
            value={me?.totals.applied ?? 0}
            accent="sky"
            href="/?status=APPLIED"
          />
          <Kpi
            label="My skipped"
            value={me?.totals.skipped ?? 0}
            accent="zinc"
            href="/?status=SKIPPED"
          />
          <Kpi
            label="My rejected"
            value={me?.totals.rejected ?? 0}
            accent="rose"
            href="/?status=REJECTED"
          />
          <Kpi
            label="My offers"
            value={me?.totals.offers ?? 0}
            accent="emerald"
            href="/?status=OFFER"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>My status breakdown</CardTitle>
              <CardDescription>How you're spending swings.</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusDonut
                counts={
                  me?.statusCounts ?? {
                    NONE: 0,
                    APPLIED: 0,
                    APPLIED_WITH_REFERRAL: 0,
                    FOLLOW_UP_SENT: 0,
                    SKIPPED: 0,
                    REJECTED: 0,
                    EXPIRED: 0,
                    OFFER: 0,
                  }
                }
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>The showdown</CardTitle>
              <CardDescription>
                Stacked per-user totals. Who's putting in the work?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserBar data={barData} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Applications over time</CardTitle>
            <CardDescription>
              How many jobs each of you has applied to — toggle the granularity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplicationsOverTime
              series={data.applications}
              users={data.users.map((u) => ({
                id: u.id,
                displayName: u.displayName,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs added over time</CardTitle>
            <CardDescription>
              Last 90 days, stacked by who added the job.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.importDays.length > 0 && (
              <div className="mb-3 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {data.importDays.map((d) => (
                  <div key={d.day}>
                    {d.count.toLocaleString()} jobs imported from CSV on{" "}
                    <span className="font-medium text-foreground">{d.day}</span>{" "}
                    — excluded from chart below so daily trends stay readable.
                  </div>
                ))}
              </div>
            )}
            <Timeline
              data={data.timeline}
              users={data.users.map((u) => ({
                id: u.id,
                displayName: u.displayName,
              }))}
            />
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard
              </CardTitle>
              <CardDescription>Total applications, all time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {leaderboard.map((p, i) => (
                <div
                  key={p.user.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors"
                >
                  <span
                    className={
                      "w-6 text-center text-sm font-semibold " +
                      (i === 0
                        ? "text-amber-500"
                        : i === 1
                          ? "text-zinc-400"
                          : i === 2
                            ? "text-orange-400"
                            : "text-muted-foreground")
                    }
                  >
                    {i + 1}
                  </span>
                  <Avatar className="h-7 w-7">
                    {p.user.image && (
                      <AvatarImage
                        src={p.user.image}
                        alt={p.user.displayName}
                      />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {initials(p.user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.user.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.totals.applied} applied • {p.totals.skipped} skipped •{" "}
                      {p.totals.rejected} rejected
                    </div>
                  </div>
                  <div className="text-lg font-semibold tabular-nums">
                    {p.totals.applied}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandHelping className="h-4 w-4 text-amber-500" />
                Referrals needed
              </CardTitle>
              <CardDescription>
                Open requests from the squad — help each other out.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-80 overflow-auto scrollbar-thin">
              {data.referralRequests.length === 0 ? (
                <div className="text-sm text-muted-foreground py-10 text-center">
                  No open referral requests. 🎉
                </div>
              ) : (
                <ul className="space-y-1">
                  {data.referralRequests.map(({ job, entry }) => {
                    const u = data.users.find((x) => x.id === entry.userId);
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
                      >
                        <Avatar className="h-6 w-6">
                          {u?.image && (
                            <AvatarImage src={u.image} alt={u.displayName} />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {initials(u?.displayName ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {job.company}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {u?.displayName} asking •{" "}
                            {formatRelative(entry.updatedAt)}
                          </div>
                        </div>
                        <Link
                          href={job.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Open job link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function Kpi({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent?: "sky" | "zinc" | "rose" | "emerald" | "violet";
  href?: string;
}) {
  const color =
    accent === "sky"
      ? "from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-300"
      : accent === "zinc"
        ? "from-zinc-500/20 to-zinc-500/5 text-zinc-600 dark:text-zinc-300"
        : accent === "rose"
          ? "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-300"
          : accent === "emerald"
            ? "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-300"
            : "from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-300";
  const body = (
    <>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className="mt-1 text-3xl font-display font-semibold tabular-nums">
        {value}
      </div>
    </>
  );
  const classes = `relative rounded-xl border p-4 overflow-hidden bg-gradient-to-br ${color}`;
  if (href) {
    return (
      <Link
        href={href}
        className={`${classes} block transition-transform hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}
