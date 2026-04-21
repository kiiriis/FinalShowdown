"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  HandHelping,
  Inbox,
  StickyNote,
  Copy,
  Check,
  CalendarDays,
} from "lucide-react";
import { AppStatus, ReferralStatus } from "@prisma/client";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatRelative, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StatusPill } from "./status-pill";
import { AddJobDialog } from "./add-job-dialog";
import { EditJobDialog } from "./edit-job-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { APP_STATUSES, APP_STATUS_LABEL } from "@/lib/status-maps";

type Entry = {
  id: string;
  userId: string;
  status: AppStatus;
  referral: ReferralStatus;
  updatedAt: Date | string;
};
type User = {
  id: string;
  displayName: string;
  name: string;
  image?: string | null;
};
type Job = {
  id: string;
  company: string;
  position: string;
  link: string;
  notes?: string | null;
  createdAt: Date | string;
  addedBy: User;
  entries: Entry[];
};

type SortKey = "newest" | "company" | "most-applied";

export function JobsBoard({
  jobs: initialJobs,
  users,
  currentUserId,
  isAdmin = false,
}: {
  jobs: Job[];
  users: User[];
  currentUserId: string;
  isAdmin?: boolean;
}) {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const initialStatus: AppStatus | "ALL" =
    statusParam && APP_STATUSES.includes(statusParam as AppStatus)
      ? (statusParam as AppStatus)
      : "ALL";

  const [jobs, setJobs] = React.useState(initialJobs);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [myStatus, setMyStatus] = React.useState<AppStatus | "ALL">(
    initialStatus,
  );
  const [onlyReferrals, setOnlyReferrals] = React.useState(false);
  const [onlyUntouched, setOnlyUntouched] = React.useState(false);
  // Day-grouping uses the viewer's local timezone. We only turn it on after
  // mount so SSR (server TZ) and first client render match — otherwise jobs
  // near a day boundary would land in different buckets and React would throw
  // a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  const PAGE_SIZE = 200;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  React.useEffect(() => setJobs(initialJobs), [initialJobs]);
  React.useEffect(() => setMounted(true), []);
  // Reset pagination whenever the filtered set changes — otherwise switching
  // filters could leave a huge window open or hide results behind the cap.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, myStatus, onlyReferrals, onlyUntouched, sort]);

  const searchIndex = React.useMemo(
    () =>
      new Map(
        jobs.map((j) => [
          j.id,
          `${j.company} ${j.position}`.toLowerCase(),
        ]),
      ),
    [jobs],
  );

  // Keyboard: "/" focuses search, "d" → dashboard
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "d" && !typing && !e.metaKey && !e.ctrlKey) {
        window.location.href = "/dashboard";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = React.useMemo(() => {
    let out = jobs;
    const q = deferredQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((j) => searchIndex.get(j.id)?.includes(q));
    }
    if (myStatus !== "ALL") {
      out = out.filter((j) => {
        const e = j.entries.find((x) => x.userId === currentUserId);
        const s = e?.status ?? "NONE";
        return s === myStatus;
      });
    }
    if (onlyReferrals) {
      out = out.filter((j) =>
        j.entries.some((e) => e.referral === "REQUESTED"),
      );
    }
    if (onlyUntouched) {
      out = out.filter((j) => {
        const touched = j.entries.some(
          (e) => e.status !== "NONE" && e.status !== "SKIPPED",
        );
        return !touched;
      });
    }
    if (sort === "company") {
      out = [...out].sort((a, b) => a.company.localeCompare(b.company));
    } else if (sort === "most-applied") {
      const score = (j: Job) =>
        j.entries.filter(
          (e) => e.status === "APPLIED" || e.status === "APPLIED_WITH_REFERRAL",
        ).length;
      out = [...out].sort((a, b) => score(b) - score(a));
    } else {
      out = [...out].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return out;
  }, [
    jobs,
    deferredQuery,
    myStatus,
    onlyReferrals,
    onlyUntouched,
    sort,
    currentUserId,
    searchIndex,
  ]);

  type DayGroup = {
    key: string;
    label: { date: string; weekday: string } | null;
    jobs: Job[];
  };
  const groups: DayGroup[] = React.useMemo(() => {
    const capped = filtered.slice(0, visibleCount);
    // Only chronological sort gets day headers — grouping A-Z or most-applied
    // by day would be meaningless.
    if (!mounted || sort !== "newest") {
      return [{ key: "flat", label: null, jobs: capped }];
    }
    const byKey = new Map<string, DayGroup>();
    for (const job of capped) {
      const d = new Date(job.createdAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;
      let g = byKey.get(key);
      if (!g) {
        g = {
          key,
          label: {
            date: d.toLocaleDateString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            }),
            weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
          },
          jobs: [],
        };
        byKey.set(key, g);
      }
      g.jobs.push(job);
    }
    return Array.from(byKey.values());
  }, [filtered, sort, mounted, visibleCount]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this job? This also clears everyone's status.")) return;
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    if (res.ok) {
      setJobs((s) => s.filter((j) => j.id !== id));
      toast.success("Job deleted");
      router.refresh();
    } else {
      toast.error("Couldn't delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or position… (press /)"
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5 mr-1" />
              Filter
              {(myStatus !== "ALL" || onlyReferrals || onlyUntouched) && (
                <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 text-[10px]">
                  •
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={myStatus}
              onValueChange={(v) => setMyStatus(v as AppStatus | "ALL")}
            >
              <DropdownMenuRadioItem value="ALL">All</DropdownMenuRadioItem>
              {APP_STATUSES.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {APP_STATUS_LABEL[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={onlyReferrals}
              onCheckedChange={(c) => setOnlyReferrals(Boolean(c))}
            >
              Someone needs referral
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={onlyUntouched}
              onCheckedChange={(c) => setOnlyUntouched(Boolean(c))}
            >
              Nobody applied yet
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              {sort === "newest"
                ? "Newest"
                : sort === "company"
                  ? "Company A–Z"
                  : "Most applied"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => setSort(v as SortKey)}
            >
              <DropdownMenuRadioItem value="newest">
                Newest
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="company">
                Company A–Z
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="most-applied">
                Most applied
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <AddJobDialog />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {filtered.length} of {jobs.length} jobs
        </span>
        <span>
          Press <kbd className="rounded bg-muted px-1">/</kbd> to search •{" "}
          <kbd className="rounded bg-muted px-1">N</kbd> to add •{" "}
          <kbd className="rounded bg-muted px-1">D</kbd> dashboard
        </span>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_420px_160px_64px] gap-4 px-4 py-2.5 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Company / Position</div>
          <div>Statuses</div>
          <div>Added</div>
          <div />
        </div>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              {group.label && (
                <div className="flex items-center gap-2 px-4 py-2 border-b text-sm bg-gradient-to-r from-violet-500/10 via-sky-500/10 to-transparent">
                  <CalendarDays className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
                  <span
                    className="font-semibold tabular-nums text-violet-700 dark:text-violet-200"
                    suppressHydrationWarning
                  >
                    {group.label.date}
                  </span>
                  <span
                    className="text-sky-700/80 dark:text-sky-300/80"
                    suppressHydrationWarning
                  >
                    · {group.label.weekday}
                  </span>
                  <span className="ml-auto text-xs font-medium rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-200 px-2 py-0.5">
                    {group.jobs.length}{" "}
                    {group.jobs.length === 1 ? "job" : "jobs"}
                  </span>
                </div>
              )}
              <ul className="divide-y">
                {group.jobs.map((job) => (
                  <li
                    key={job.id}
                    className="group grid md:grid-cols-[minmax(0,1fr)_420px_160px_64px] gap-2 md:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {job.company}
                      </span>
                      <Link
                        href={job.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Open job link"
                        title="Open job link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <CopyLinkButton link={job.link} />
                      {job.notes && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="text-amber-500 dark:text-amber-300 shrink-0 cursor-help"
                              aria-label="Has notes"
                            >
                              <StickyNote className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="max-w-xs whitespace-pre-wrap"
                          >
                            {job.notes}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {job.position || "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-3">
                    {users.map((u) => {
                      const entry = job.entries.find((e) => e.userId === u.id);
                      const isMe = u.id === currentUserId;
                      const canEdit = isMe || isAdmin;
                      return (
                        <div
                          key={u.id}
                          className="flex flex-col items-start gap-1 min-w-[88px]"
                        >
                          <span
                            className={cn(
                              "text-xs font-medium leading-none",
                              isMe
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {u.displayName}
                          </span>
                          <StatusPill
                            entryId={entry?.id ?? null}
                            jobId={job.id}
                            userId={u.id}
                            userName={u.displayName}
                            status={entry?.status ?? "NONE"}
                            referral={entry?.referral ?? "NONE"}
                            editable={canEdit}
                            onUpdated={(upd) => {
                              setJobs((prev) =>
                                prev.map((j) =>
                                  j.id === job.id
                                    ? {
                                        ...j,
                                        entries: upsertEntry(j.entries, {
                                          id: upd.entryId,
                                          userId: u.id,
                                          status: upd.status,
                                          referral: upd.referral,
                                          updatedAt: new Date(),
                                        }),
                                      }
                                    : j,
                                ),
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-5 w-5">
                      {job.addedBy.image && (
                        <AvatarImage
                          src={job.addedBy.image}
                          alt={job.addedBy.displayName}
                        />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {initials(job.addedBy.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">
                      {job.addedBy.displayName}
                    </span>
                    <span suppressHydrationWarning>
                      · {formatRelative(job.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {(job.addedBy.id === currentUserId || isAdmin) && (
                      <>
                        <EditJobDialog
                          job={job}
                          onSaved={(updated) =>
                            setJobs((prev) =>
                              prev.map((j) =>
                                j.id === updated.id ? { ...j, ...updated } : j,
                              ),
                            )
                          }
                        />
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          aria-label="Delete job"
                          title="Delete job"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      {filtered.length > visibleCount && (
        <div className="flex flex-col items-center gap-2 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setVisibleCount((v) =>
                Math.min(v + PAGE_SIZE, filtered.length),
              )
            }
          >
            Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {visibleCount.toLocaleString()} of{" "}
            {filtered.length.toLocaleString()} results
          </p>
        </div>
      )}
    </div>
  );
}

function upsertEntry(entries: Entry[], next: Entry): Entry[] {
  const i = entries.findIndex((e) => e.userId === next.userId);
  if (i === -1) return [...entries, next];
  const copy = [...entries];
  copy[i] = next;
  return copy;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">No jobs match those filters</p>
      <p className="text-sm text-muted-foreground max-w-sm mt-1">
        Try clearing filters or add a new job with{" "}
        <kbd className="rounded bg-muted px-1">N</kbd>.
      </p>
    </div>
  );
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "shrink-0 transition-colors",
        copied
          ? "text-emerald-500"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={copied ? "Link copied" : "Copy job link"}
      title={copied ? "Copied!" : "Copy link"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// Reference to avoid unused-import warning in some configs
void HandHelping;
