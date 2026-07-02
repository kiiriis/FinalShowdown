import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, ExternalLink, HandHelping } from "lucide-react";
import { KpiCard, KpiRow } from "@/components/dashboard/kpi-card";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
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

  // "This week" deltas from already-aggregated series — no extra queries.
  const last7 = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    last7.add(d.toISOString().slice(0, 10));
  }
  const myAppliedThisWeek = data.applications.day
    .filter((row) => last7.has(String(row.bucket)))
    .reduce((sum, row) => sum + (Number(row[session.user.id]) || 0), 0);
  const jobsAddedThisWeek = data.timeline
    .filter((row) => last7.has(row.day))
    .reduce(
      (sum, row) =>
        sum +
        Object.entries(row).reduce(
          (s, [k, v]) => (k === "day" ? s : s + (Number(v) || 0)),
          0,
        ),
      0,
    );

  return (
    <main className="container py-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
            Race control
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live stats for the squad. Numbers don’t lie.
          </p>
        </div>

        {/* KPI row */}
        <KpiRow>
          <KpiCard
            label="Total jobs"
            value={data.totalJobs}
            href="/"
            delta={{ value: jobsAddedThisWeek, label: "this week" }}
          />
          <KpiCard
            label="My applied"
            value={me?.totals.applied ?? 0}
            accent="applied"
            href="/?status=APPLIED"
            delta={{ value: myAppliedThisWeek, label: "this week" }}
          />
          <KpiCard
            label="My skipped"
            value={me?.totals.skipped ?? 0}
            accent="skipped"
            href="/?status=SKIPPED"
          />
          <KpiCard
            label="My rejected"
            value={me?.totals.rejected ?? 0}
            accent="rejected"
            href="/?status=REJECTED"
          />
          <KpiCard
            label="My offers"
            value={me?.totals.offers ?? 0}
            accent="offer"
            href="/?status=OFFER"
          />
        </KpiRow>

        <div className="grid lg:grid-cols-3 gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards [animation-delay:60ms]">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>My status breakdown</CardTitle>
              <CardDescription>How you’re spending swings.</CardDescription>
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
                Stacked per-user totals. Who’s putting in the work?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserBar data={barData} />
            </CardContent>
          </Card>
        </div>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards [animation-delay:120ms]">
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

        <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards [animation-delay:180ms]">
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

        <div className="grid lg:grid-cols-2 gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards [animation-delay:240ms]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" /> Standings
              </CardTitle>
              <CardDescription>Total applications, all time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaderboard.map((p, i) => {
                const max = leaderboard[0]?.totals.applied || 1;
                const pace = Math.max(
                  0.02,
                  p.totals.applied / max,
                );
                const leader = i === 0 && p.totals.applied > 0;
                return (
                  <div
                    key={p.user.id}
                    className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-backwards"
                    style={{ animationDelay: `${120 + i * 50}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-label={`Position ${i + 1}`}
                        className={
                          "w-7 font-mono text-sm font-bold tabular-nums " +
                          (leader ? "text-gold" : "text-muted-foreground")
                        }
                      >
                        P{i + 1}
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
                        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {p.totals.applied} applied · {p.totals.skipped}{" "}
                          skipped · {p.totals.rejected} rejected
                        </div>
                      </div>
                      <div className="font-display text-xl font-bold tabular-nums">
                        {p.totals.applied}
                      </div>
                    </div>
                    <div className="mt-1.5 ml-10 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          "h-full origin-left rounded-full animate-grow-x " +
                          (leader ? "bg-gold" : "bg-primary/70")
                        }
                        style={{
                          width: `${pace * 100}%`,
                          animationDelay: `${200 + i * 50}ms`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandHelping className="h-4 w-4 text-primary" />
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
  );
}
